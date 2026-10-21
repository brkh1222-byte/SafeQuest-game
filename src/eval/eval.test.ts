import { describe, expect, it } from "vitest";
import { CITY_LEVELS } from "@/game/levels/city";
import { EXTRA_SCENES } from "@/game/levels/extra";
import { FEW_SHOT_REQUESTS } from "@/game/generate/prompts";
import type { ProviderConfig } from "@/game/generate/providers";
import { formatRequest, GenerateRequestSchema } from "@/game/generate/request";
import { percentile, renderMarkdown, runCase, simulateWin, summarize, type CaseResult } from "./core";
import { HELDOUT } from "./heldout";
import { findLeaks } from "./leak";
import { applyReview, buildReviewSheet, parseCsv, toCsv } from "./review";

const provider: ProviderConfig = { name: "local", url: "http://x/v1", models: { base: "b", finetuned: "f" }, timeoutMs: 1000 };
const replyWith = (content: string): typeof fetch =>
  (async () => new Response(JSON.stringify({ choices: [{ message: { content } }] }))) as unknown as typeof fetch;

describe("held-out set", () => {
  it("has 50 valid, unique prompts", () => {
    expect(HELDOUT).toHaveLength(50);
    for (const c of HELDOUT) expect(GenerateRequestSchema.safeParse(c.request).success, c.id).toBe(true);
    expect(new Set(HELDOUT.map((c) => formatRequest(c.request))).size).toBe(50);
    expect(new Set(HELDOUT.map((c) => c.id)).size).toBe(50);
  });

  it("does not overlap the few-shot examples", () => {
    const fewShot = new Set(FEW_SHOT_REQUESTS.map(([, r]) => formatRequest(r)));
    expect(HELDOUT.filter((c) => fewShot.has(formatRequest(c.request)))).toEqual([]);
  });

  it("covers every world and mechanic", () => {
    const text = HELDOUT.map((c) => formatRequest(c.request)).join("\n");
    for (const w of ["city_", "ger_", "steppe_", "home_"]) expect(text).toContain(w);
    for (const m of ["drag_to_fix", "tap_hazards", "tap_safe_choice"]) expect(text).toContain(m);
  });
});

describe("simulateWin", () => {
  it.each([...CITY_LEVELS.map((l) => l.scene), ...EXTRA_SCENES].map((s, i) => [i, s] as const))("hand-built scene %i is winnable", (_i, s) => {
    expect(simulateWin(s)).toBe(true);
  });

  it("fails when no win is reachable", () => {
    // tap_hazards with zero hazards: the schema would reject it, but the
    // simulator must not report it as winnable on its own.
    expect(simulateWin({ ...EXTRA_SCENES[1], objects: EXTRA_SCENES[1].objects.filter((o) => o.role !== "hazard") })).toBe(false);
  });
});

describe("runCase", () => {
  const caseThinIce = HELDOUT.find((c) => c.id === "h21")!; // steppe_river + thin_ice
  const iceScene = EXTRA_SCENES.find((s) => s.backdrop_id === "steppe_river")!;

  it("scores a good reply", async () => {
    const r = await runCase(caseThinIce, "finetuned", provider, "f", replyWith(JSON.stringify(iceScene)));
    expect(r).toMatchObject({ stage: "ok", playable: true, followedPlace: true, dangerOnTopic: true, followedMechanic: undefined });
  });

  it("records instruction-following misses", async () => {
    const cityScene = CITY_LEVELS[0].scene;
    const r = await runCase(caseThinIce, "finetuned", provider, "f", replyWith(JSON.stringify(cityScene)));
    expect(r).toMatchObject({ stage: "ok", playable: true, followedPlace: false, dangerOnTopic: false });
  });

  it("records failures without crashing", async () => {
    expect((await runCase(caseThinIce, "base_naive", provider, "b", replyWith("Сайн уу"))).stage).toBe("no_json");
    const down = (async () => {
      throw new Error("ECONNREFUSED");
    }) as unknown as typeof fetch;
    expect(await runCase(caseThinIce, "base_naive", provider, "b", down)).toMatchObject({ stage: "provider_error", playable: false });
  });

  it("counts the few-shot prompt as much larger", async () => {
    const a = await runCase(caseThinIce, "base_naive", provider, "b", replyWith(""));
    const b = await runCase(caseThinIce, "base_fewshot", provider, "b", replyWith(""));
    expect(b.promptChars).toBeGreaterThan(a.promptChars * 10);
  });
});

const row = (over: Partial<CaseResult>): CaseResult => ({
  caseId: "h01", variant: "finetuned", provider: "local", model: "f", prompt: "Аюул: Морь", promptChars: 100,
  stage: "ok", errors: [], warnings: [], playable: true, ms: 1000, ...over,
});

describe("summarize", () => {
  it("computes ratios with card-specific denominators", () => {
    const [s] = summarize([
      row({ dangerOnTopic: true }),
      row({ stage: "invalid_scene", playable: false, dangerOnTopic: undefined, prompt: "Тайлбар: x" }),
      row({ stage: "provider_error", playable: false, ms: 9000, prompt: "Тайлбар: y" }),
      row({ warnings: ["overlap"], dangerOnTopic: false, ms: 3000 }),
    ]);
    expect(s.replied).toEqual({ n: 3, of: 4 });
    expect(s.validJson).toEqual({ n: 3, of: 4 });
    expect(s.schemaValid).toEqual({ n: 2, of: 4 });
    expect(s.playable).toEqual({ n: 2, of: 4 });
    expect(s.clean).toEqual({ n: 1, of: 4 });
    expect(s.dangerOnTopic).toEqual({ n: 1, of: 2 });
    expect(s.followedPlace).toEqual({ n: 0, of: 0 });
    // Provider errors are excluded from latency.
    expect(s.medianMs).toBe(1000);
  });

  it("uses nearest-rank percentiles", () => {
    expect(percentile([5, 1, 3, 2, 4], 50)).toBe(3);
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 90)).toBe(9);
    expect(percentile([], 50)).toBeNull();
  });

  it("renders a table with n/a for empty denominators", () => {
    const md = renderMarkdown(summarize([row({})]), { provider: "local", date: "d", cases: 1 });
    expect(md).toContain("| **Playable** (engine reaches a win) | **100% (1/1)** |");
    expect(md).toContain("| Followed place card | n/a |");
  });
});

describe("blind review", () => {
  const results = [
    ...Array.from({ length: 5 }, (_, i) => row({ caseId: `h0${i}`, variant: "finetuned", scene: CITY_LEVELS[i].scene })),
    ...Array.from({ length: 5 }, (_, i) => row({ caseId: `h0${i}`, variant: "base_fewshot", scene: CITY_LEVELS[i + 5].scene })),
    row({ caseId: "h09", variant: "base_naive", stage: "no_json", playable: false }),
  ];

  it("hides the variant, samples only real scenes, and is reproducible", () => {
    const a = buildReviewSheet(results, 3, 7);
    expect(a.key).toHaveLength(6);
    expect(a.csv).not.toMatch(/finetuned|base_/);
    expect(buildReviewSheet(results, 3, 7).csv).toBe(a.csv);
  });

  it("folds filled ratings back into the summary", () => {
    const { csv, key } = buildReviewSheet(results, 3, 7);
    const filled = parseCsv(csv).map((cells, i) => {
      if (i === 0) return cells;
      const variant = key.find((k) => k.item === cells[0])!.variant;
      return [...cells.slice(0, 5), variant === "finetuned" ? "y" : "n", variant === "finetuned" ? "5" : "3", ""];
    });
    const [ft, fs] = applyReview(summarize(results).filter((s) => s.variant !== "base_naive"), key, toCsv(filled));
    expect(ft.human).toEqual({ lessonFit: { n: 3, of: 3 }, mongolianMean: 5, rated: 3 });
    expect(fs.human).toEqual({ lessonFit: { n: 0, of: 3 }, mongolianMean: 3, rated: 3 });
  });

  it("round-trips CSV with quotes, commas, newlines and Cyrillic", () => {
    const rows = [["a", 'say "hi", ok'], ["Ой!\nдахин", ""]];
    expect(parseCsv(toCsv(rows))).toEqual(rows);
  });
});

describe("findLeaks", () => {
  const line = (user: string) => JSON.stringify({ messages: [{ role: "system", content: "s" }, { role: "user", content: user }, { role: "assistant", content: "{}" }] });

  it("passes clean data and catches exact and free-text leaks", () => {
    expect(findLeaks(HELDOUT, line("Аюул: Шинэ аюул") + "\n")).toEqual([]);
    const leaked = [line(formatRequest(HELDOUT[0].request)), line("Тайлбар: МОРИНЫ  ард зогсож байна!!")].join("\n");
    expect(findLeaks(HELDOUT, leaked)).toEqual([
      { caseId: "h01", line: 1, reason: "same prompt" },
      { caseId: "h38", line: 2, reason: "same free text" },
    ]);
  });
});
