import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { HELDOUT } from "@/eval/heldout";
import { parseCsv, toCsv } from "@/eval/review";
import { SHORT_SYSTEM } from "@/game/generate/prompts";
import { formatRequest, GenerateRequestSchema, type GenerateRequest } from "@/game/generate/request";
import { CITY_LEVELS } from "@/game/levels/city";
import { EXTRA_SCENES } from "@/game/levels/extra";
import type { Scene } from "@/game/schema";
import { buildDataset, buildReviewSheet, hash01, parseReviewSheet, requestStyle } from "./build";
import { canonicalScene, deriveSeedRequests, requestIssues, seedCandidates, structuralKey, toExample, vetItem, type Candidate } from "./candidate";
import { coverage, EXPAND_SYSTEM, expandUserPrompt, parseExpansion, planTargets, type Complete } from "./expand";
import { acceptForCache, cacheKey, stageCardCombos } from "./precache";
import { dataPaths, readJsonl, runExpansion } from "./run";

const iceScene = EXTRA_SCENES.find((s) => s.backdrop_id === "steppe_river")!; // drag_to_fix, thin_ice
const iceRequests: GenerateRequest[] = [
  { placeId: "steppe_river", dangerId: "thin_ice", mechanic: "drag_to_fix" },
  { dangerId: "thin_ice" },
  { text: "хүүхэд голын мөсөн дээр тоглож байна" },
];

/** A valid scene that is structurally different from the seed for each n (different decor). */
const DECOR = ["eagle", "sheep", "camel", "mountain", "lifebuoy", "snowstorm"];
const variantOf = (s: Scene, n = 1): Scene => ({
  ...s,
  objects: [
    ...s.objects,
    ...DECOR.filter((_, i) => (n >> i) & 1).map((sprite_id, i) => ({ sprite_id, x: 0.15 + 0.14 * i, y: 0.2, role: "decor" as const })),
  ],
});

describe("training format", () => {
  it("canonicalizes key order and rounds coordinates", () => {
    const messy = { ...iceScene, lesson_id: iceScene.lesson_id, objects: iceScene.objects.map((o) => ({ role: o.role, y: o.y + 0.00444, x: o.x, sprite_id: o.sprite_id })) };
    const c = canonicalScene(messy as Scene);
    expect(Object.keys(c)).toEqual(["world", "backdrop_id", "mechanic", "instruction_mn", "objects", "time_limit_s", "oops_mn", "lesson_id"]);
    expect(Object.keys(c.objects[0])).toEqual(["sprite_id", "x", "y", "role"]);
    expect(c.objects[0].y).toBe(Math.round((iceScene.objects[0].y + 0.00444) * 100) / 100);
  });

  it("matches the stage's fine-tune prompt exactly", () => {
    const ex = toExample(iceRequests[0], iceScene);
    expect(ex.messages[0]).toEqual({ role: "system", content: SHORT_SYSTEM });
    expect(ex.messages[1].content).toBe(formatRequest(iceRequests[0]));
    expect(JSON.parse(ex.messages[2].content)).toEqual(canonicalScene(iceScene));
  });
});

describe("requestIssues", () => {
  it("accepts consistent requests", () => {
    for (const r of iceRequests) expect(requestIssues(r, iceScene)).toEqual([]);
  });

  it("explains inconsistent ones", () => {
    expect(requestIssues({ placeId: "steppe_pasture", dangerId: "thin_ice" }, iceScene)[0]).toMatch(/place card/);
    expect(requestIssues({ dangerId: "thin_ice", mechanic: "tap_hazards" }, iceScene)[0]).toMatch(/game-type/);
    expect(requestIssues({ dangerId: "horse" }, iceScene)[0]).toMatch(/none of its sprites/);
    expect(requestIssues({ dangerId: "medicine" }, iceScene)[0]).toMatch(/from home/);
    expect(requestIssues({ placeId: "steppe_river" }, iceScene)[0]).toMatch(/invalid request/);
  });

  it("blocks held-out prompts, even as free text inside a longer ask", () => {
    expect(requestIssues(HELDOUT.find((c) => c.id === "h21")!.request, iceScene)).toContain("matches a held-out eval prompt");
    expect(requestIssues({ text: "Хүүхэд голын мөсөн дээр гулгаж байна" }, iceScene)).toContain("matches a held-out eval prompt");
  });
});

describe("vetItem", () => {
  const meta = { id: "x1", source: "expand" as const };

  it("keeps consistent requests and drops the rest", () => {
    const res = vetItem({ scene: iceScene, requests: [...iceRequests, { dangerId: "horse" }, iceRequests[1]] }, meta, new Set());
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.candidate.requests).toHaveLength(3); // duplicate and inconsistent dropped
    expect(res.droppedRequests).toHaveLength(1);
  });

  it("rejects invalid, unplayable, duplicate, and request-less items", () => {
    expect(vetItem({ scene: { ...iceScene, lesson_id: "eat_snow" }, requests: iceRequests }, meta, new Set())).toMatchObject({ ok: false });
    const overlapping = { ...iceScene, objects: iceScene.objects.map((o) => (o.role === "hazard" ? { ...o, x: 0.5, y: 0.66 } : o)) };
    expect(vetItem({ scene: overlapping, requests: iceRequests }, meta, new Set())).toMatchObject({ ok: false });

    const seen = new Set([structuralKey(iceScene)]);
    expect(vetItem({ scene: iceScene, requests: iceRequests }, meta, seen)).toEqual({ ok: false, reasons: ["duplicate of an existing scene"] });
    expect(vetItem({ scene: variantOf(iceScene), requests: [{ dangerId: "horse" }] }, meta, new Set())).toMatchObject({ ok: false });
    expect(vetItem("garbage", meta, new Set())).toMatchObject({ ok: false });
  });
});

describe("seeds", () => {
  it("all hand-built scenes become candidates with consistent requests", () => {
    const { candidates, rejections } = seedCandidates();
    expect(rejections).toEqual([]);
    expect(candidates).toHaveLength(CITY_LEVELS.length + EXTRA_SCENES.length);
    for (const c of candidates) {
      expect(c.requests.length).toBeGreaterThan(0);
      for (const r of c.requests) expect(requestIssues(r, c.scene)).toEqual([]);
    }
  });

  it("derives card and free-text requests", () => {
    const reqs = deriveSeedRequests(iceScene);
    expect(reqs).toContainEqual({ placeId: "steppe_river", dangerId: "thin_ice", mechanic: "drag_to_fix" });
    expect(reqs).toContainEqual({ text: "Эрэг рүү гарга" });
  });
});

describe("expansion planning", () => {
  it("targets the least-covered danger × mechanic combos first", () => {
    const { candidates } = seedCandidates();
    const before = coverage(candidates);
    const targets = planTargets(candidates, 10, 42);
    expect(targets).toHaveLength(10);
    for (const t of targets) expect(before.get(`${t.dangerId}|${t.mechanic}`) ?? 0).toBe(0);
    expect(new Set(targets.map((t) => `${t.dangerId}|${t.mechanic}`)).size).toBe(10);
    expect(planTargets(candidates, 10, 42)).toEqual(targets);
  });

  it("builds prompts with every ID and the target", () => {
    expect(EXPAND_SYSTEM).toContain("thin_ice");
    expect(EXPAND_SYSTEM).toContain("traffic_wait_green");
    expect(EXPAND_SYSTEM).toContain("guard_dog [steppe");
    const user = expandUserPrompt({ dangerId: "thin_ice", mechanic: "tap_hazards", world: "steppe" }, 4, []);
    expect(user).toMatch(/Write 4 distinct items/);
    expect(user).toMatch(/steppe_river/);
  });

  it("parses replies defensively", () => {
    const item = { scene: iceScene, requests: iceRequests };
    expect(parseExpansion("Here:\n```json\n" + JSON.stringify({ items: [item] }) + "\n```").items).toHaveLength(1);
    expect(parseExpansion("sorry").error).toMatch(/no JSON/);
    expect(parseExpansion('{"scenes": []}').error).toMatch(/no items/);
    expect(parseExpansion('{"items": [}').items).toEqual([]);
  });
});

describe("runExpansion (fake model, temp dir)", () => {
  it("vets replies, logs raw output, survives failed calls, and dedupes across calls", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "sq-data-"));
    let call = 0;
    const complete: Complete = async (system) => {
      expect(system).toBe(EXPAND_SYSTEM);
      call++;
      if (call === 2) throw new Error("overloaded");
      // Every call returns the same new scene: only the first copy is accepted.
      const good = { scene: variantOf(iceScene, 5), requests: iceRequests };
      const bad = { scene: { ...iceScene, lesson_id: "eat_snow" }, requests: iceRequests };
      return { text: JSON.stringify({ items: [good, bad] }), stopReason: "end_turn", inputTokens: 10, outputTokens: 5 };
    };
    const s = await runExpansion(complete, { dir, calls: 3, perCall: 2, concurrency: 1, seed: 1, batch: "T", log: () => {} });
    expect(s).toMatchObject({ accepted: 1, rejected: 3, failedCalls: 1, tokensIn: 20, tokensOut: 10 });

    const p = dataPaths(dir);
    const accepted = await readJsonl<Candidate>(p.candidates);
    expect(accepted.map((c) => c.id)).toEqual(["x-T-000-0"]);
    const rejected = await readJsonl<{ reasons: string[] }>(p.rejected);
    expect(rejected.map((r) => r.reasons[0])).toEqual(expect.arrayContaining(["duplicate of an existing scene"]));
    expect((await readFile(path.join(p.raw, "T.jsonl"), "utf8")).trim().split("\n")).toHaveLength(3);
    await rm(dir, { recursive: true });
  });
});

describe("review sheet", () => {
  const expanded: Candidate[] = [1, 2, 3].map((n) => ({ id: `x-${n}`, source: "expand", scene: variantOf(iceScene, n), requests: iceRequests }));

  it("lists only pending expanded scenes and round-trips decisions and fixes", () => {
    const { csv, rows } = buildReviewSheet(expanded, { "x-3": { approve: true } });
    expect(rows).toBe(2);
    const filled = parseCsv(csv).map((r, i) => {
      if (i === 0) return r;
      const out = [...r];
      out[9] = r[0] === "x-1" ? "y" : "";
      out[10] = r[0] === "x-1" ? "Мөснөөс гарга!" : "";
      return out;
    });
    expect(parseReviewSheet(toCsv(filled))).toEqual({ "x-1": { approve: true, instruction_mn: "Мөснөөс гарга!", oops_mn: undefined, notes: undefined } });
  });
});

describe("buildDataset", () => {
  const expanded: Candidate[] = Array.from({ length: 30 }, (_, n) => ({
    id: `x-${n}`,
    source: "expand",
    scene: variantOf(iceScene, n + 1),
    requests: iceRequests,
  }));
  const { candidates: seeds } = seedCandidates();
  const opts = { valFraction: 0.2, includeUnreviewed: false, seed: 1 };

  it("excludes unreviewed and rejected scenes by default", () => {
    const res = buildDataset(seeds, expanded, { "x-0": { approve: false, notes: "wrong lesson" }, "x-1": { approve: true } }, opts);
    expect(res.excluded.find((e) => e.id === "x-0")?.reason).toBe("rejected in review: wrong lesson");
    expect(res.excluded.filter((e) => e.reason === "not reviewed yet")).toHaveLength(28);
    expect(res.counts.scenes).toBe(seeds.length + 1);
  });

  it("applies reviewer fixes, and drops a fix that breaks the scene", () => {
    const res = buildDataset([], expanded.slice(0, 2), {
      "x-0": { approve: true, instruction_mn: "Мөснөөс гарга!" },
      "x-1": { approve: true, instruction_mn: "" + "үг ".repeat(8) },
    }, { ...opts, valFraction: 0 });
    expect(res.train).toContain("Мөснөөс гарга!");
    expect(res.excluded.find((e) => e.id === "x-1")?.reason).toMatch(/words/);
  });

  it("splits by scene, keeps seeds in train, and is deterministic", () => {
    const reviews = Object.fromEntries(expanded.map((c) => [c.id, { approve: true }]));
    const a = buildDataset(seeds, expanded, reviews, opts);
    const b = buildDataset(seeds, expanded, reviews, opts);
    expect(a.train).toBe(b.train);
    expect(a.counts.valExamples).toBeGreaterThan(0);
    const valScenes = new Set(a.val.trim().split("\n").map((l) => JSON.parse(l).messages[2].content));
    const trainScenes = new Set(a.train.trim().split("\n").map((l) => JSON.parse(l).messages[2].content));
    for (const s of valScenes) expect(trainScenes.has(s)).toBe(false);
    for (const s of seeds) expect(trainScenes.has(JSON.stringify(canonicalScene(s.scene)))).toBe(true);
    expect(a.leaks).toEqual([]);
    expect(a.stats).toContain("By lesson");
  });

  it("spreads sequential ids across the split", () => {
    const hs = Array.from({ length: 200 }, (_, n) => hash01(`x-${n}`));
    const below = hs.filter((h) => h < 0.1).length;
    expect(below).toBeGreaterThan(8);
    expect(below).toBeLessThan(35);
  });

  it("labels request styles", () => {
    expect(requestStyle(iceRequests[0])).toBe("full cards");
    expect(requestStyle(iceRequests[1])).toBe("partial cards");
    expect(requestStyle(iceRequests[2])).toBe("free text");
    expect(requestStyle({ placeId: "steppe_river", text: "x" })).toBe("cards + text");
  });
});

describe("precache", () => {
  it("enumerates every valid stage card combo once", () => {
    const combos = stageCardCombos();
    expect(combos).toHaveLength(436);
    expect(new Set(combos.map(cacheKey)).size).toBe(combos.length);
    for (const r of combos) expect(GenerateRequestSchema.safeParse(r).success).toBe(true);
    expect(combos).toContainEqual({ placeId: "steppe_river", dangerId: "thin_ice", mechanic: "drag_to_fix" });
    expect(combos).not.toContainEqual({ placeId: "steppe_river", dangerId: "medicine" });
  });

  it("only accepts scenes that are clean and follow every card", () => {
    const base = {
      caseId: "c1", variant: "finetuned" as const, provider: "local", model: "f", prompt: "", promptChars: 0,
      stage: "ok" as const, errors: [], warnings: [], playable: true, ms: 1,
    };
    expect(acceptForCache(base)).toBe(true);
    expect(acceptForCache({ ...base, followedPlace: true, dangerOnTopic: true })).toBe(true);
    expect(acceptForCache({ ...base, warnings: ["overlap"] })).toBe(false);
    expect(acceptForCache({ ...base, followedMechanic: false })).toBe(false);
    expect(acceptForCache({ ...base, dangerOnTopic: false })).toBe(false);
    expect(acceptForCache({ ...base, stage: "invalid_scene", playable: false })).toBe(false);
  });
});
