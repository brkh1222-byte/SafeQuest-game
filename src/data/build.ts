import { findLeaks } from "@/eval/leak";
import { HELDOUT } from "@/eval/heldout";
import { mulberry32, parseCsv, toCsv } from "@/eval/review";
import { MECHANICS, WORLDS } from "@/game/constants";
import { DANGER_CARDS, type GenerateRequest } from "@/game/generate/request";
import { LESSON_BY_ID, LESSONS } from "@/game/registry/lessons";
import { toExample, vetItem, type Candidate } from "./candidate";

// Human review (spec §7 step 3) and the final train/val files.

export interface Review {
  approve: boolean;
  instruction_mn?: string;
  oops_mn?: string;
  notes?: string;
}

const REVIEW_COLUMNS = [
  "id", "world", "mechanic", "objects", "instruction_mn", "oops_mn", "lesson_mn", "lesson_en", "free_text_requests",
  "approve (y/n)", "fix_instruction_mn", "fix_oops_mn", "notes",
];

/** One row per expanded scene that has no decision yet. */
export function buildReviewSheet(candidates: Candidate[], reviews: Record<string, Review>): { csv: string; rows: number } {
  const pending = candidates.filter((c) => c.source === "expand" && !reviews[c.id]);
  const lines = [
    REVIEW_COLUMNS,
    ...pending.map((c) => {
      const lesson = LESSON_BY_ID.get(c.scene.lesson_id);
      return [
        c.id,
        c.scene.world,
        c.scene.mechanic,
        c.scene.objects.map((o) => `${o.sprite_id}:${o.role}`).join(" "),
        c.scene.instruction_mn,
        c.scene.oops_mn,
        lesson?.text_mn ?? c.scene.lesson_id,
        lesson?.text_en ?? "",
        c.requests.flatMap((r) => (r.text ? [r.text] : [])).join(" | "),
        "", "", "", "",
      ];
    }),
  ];
  return { csv: toCsv(lines), rows: pending.length };
}

/** Reads decisions from a filled sheet. Rows without y/n are skipped (still pending). */
export function parseReviewSheet(csv: string): Record<string, Review> {
  const [header, ...rows] = parseCsv(csv);
  const col = (prefix: string) => header.findIndex((h) => h.trim().toLowerCase().startsWith(prefix));
  const idx = { id: col("id"), approve: col("approve"), fixI: col("fix_instruction"), fixO: col("fix_oops"), notes: col("notes") };
  if (idx.id < 0 || idx.approve < 0) throw new Error("review sheet needs id and approve columns");

  const out: Record<string, Review> = {};
  for (const row of rows) {
    const decision = row[idx.approve]?.trim().toLowerCase();
    if (!decision || !["y", "yes", "n", "no"].includes(decision)) continue;
    const get = (i: number) => (i >= 0 && row[i]?.trim() ? row[i].trim() : undefined);
    out[row[idx.id].trim()] = {
      approve: decision.startsWith("y"),
      instruction_mn: get(idx.fixI),
      oops_mn: get(idx.fixO),
      notes: get(idx.notes),
    };
  }
  return out;
}

// ------------------------------------------------------------------- build

export interface BuildOptions {
  valFraction: number;
  includeUnreviewed: boolean;
  seed: number;
}

export interface BuildResult {
  train: string;
  val: string;
  stats: string;
  counts: { trainExamples: number; valExamples: number; scenes: number };
  excluded: { id: string; reason: string }[];
  leaks: ReturnType<typeof findLeaks>;
}

/**
 * FNV-1a plus murmur3's fmix32 finalizer: a stable per-candidate split that
 * doesn't move when data is added. Without the finalizer, sequential IDs
 * ("x-1", "x-2", ...) cluster in the high bits and land on the same side.
 */
export function hash01(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export function buildDataset(seeds: Candidate[], expanded: Candidate[], reviews: Record<string, Review>, opts: BuildOptions): BuildResult {
  const excluded: { id: string; reason: string }[] = [];
  const kept: Candidate[] = [];
  // Seeds first so they win dedupe against look-alike expansions.
  const seen = new Set<string>();

  for (const c of [...seeds, ...expanded]) {
    let scene = c.scene;
    if (c.source === "expand") {
      const review = reviews[c.id];
      if (review && !review.approve) {
        excluded.push({ id: c.id, reason: `rejected in review${review.notes ? `: ${review.notes}` : ""}` });
        continue;
      }
      if (!review && !opts.includeUnreviewed) {
        excluded.push({ id: c.id, reason: "not reviewed yet" });
        continue;
      }
      if (review) scene = { ...scene, instruction_mn: review.instruction_mn ?? scene.instruction_mn, oops_mn: review.oops_mn ?? scene.oops_mn };
    }
    // Re-vet everything: a reviewer's fix or a registry change can break a scene.
    const res = vetItem({ scene, requests: c.requests }, { id: c.id, source: c.source, batch: c.batch }, seen);
    if (!res.ok) {
      excluded.push({ id: c.id, reason: res.reasons[0] });
      continue;
    }
    kept.push(res.candidate);
  }

  const rand = mulberry32(opts.seed);
  const shuffle = <T>(a: T[]) => {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  // Split by scene, never by row: the requests of one scene stay together, so
  // val measures generalization rather than recall of a sibling example.
  const isVal = (c: Candidate) => c.source === "expand" && hash01(c.id) < opts.valFraction;
  const examples = (cs: Candidate[]) => shuffle(cs.flatMap((c) => c.requests.map((r) => JSON.stringify(toExample(r, c.scene)))));
  const trainLines = examples(kept.filter((c) => !isVal(c)));
  const valLines = examples(kept.filter(isVal));

  const train = trainLines.join("\n") + (trainLines.length ? "\n" : "");
  const val = valLines.join("\n") + (valLines.length ? "\n" : "");
  const leaks = [...findLeaks(HELDOUT, train), ...findLeaks(HELDOUT, val)];

  return {
    train,
    val,
    stats: renderStats(kept, excluded, { train: trainLines.length, val: valLines.length }),
    counts: { trainExamples: trainLines.length, valExamples: valLines.length, scenes: kept.length },
    excluded,
    leaks,
  };
}

// ------------------------------------------------------------------- stats

type Style = "full cards" | "partial cards" | "free text" | "cards + text";
export function requestStyle(r: GenerateRequest): Style {
  const cards = [r.placeId, r.dangerId, r.mechanic].filter(Boolean).length;
  if (r.text) return cards ? "cards + text" : "free text";
  return cards === 3 ? "full cards" : "partial cards";
}

function renderStats(kept: Candidate[], excluded: { id: string; reason: string }[], n: { train: number; val: number }): string {
  const count = <K extends string>(keys: K[]) => keys.reduce((m, k) => m.set(k, (m.get(k) ?? 0) + 1), new Map<K, number>());
  const table = (title: string, m: Map<string, number>, all?: string[]) =>
    [`### ${title}`, "", "| | scenes |", "|---|---|", ...(all ?? [...m.keys()]).map((k) => `| ${k} | ${m.get(k) ?? 0}${(m.get(k) ?? 0) < 3 ? " ⚠️" : ""} |`), ""].join("\n");

  const requests = kept.flatMap((c) => c.requests);
  const styles = count(requests.map(requestStyle));
  const byLesson = count(kept.map((c) => c.scene.lesson_id));
  const comboCounts = count(kept.flatMap((c) => [...new Set(c.requests.flatMap((r) => (r.dangerId ? [`${r.dangerId}|${c.scene.mechanic}`] : [])))]));
  const reasons = count(excluded.map((e) => e.reason.replace(/:.*/, "")));

  return [
    "# SafeQuest fine-tune dataset",
    "",
    `- Scenes: ${kept.length} (${kept.filter((c) => c.source === "seed").length} seed, ${kept.filter((c) => c.source === "expand").length} expanded)`,
    `- Examples: ${n.train} train, ${n.val} val (split by scene)`,
    `- Avg requests per scene: ${(requests.length / Math.max(1, kept.length)).toFixed(1)}`,
    `- Request styles: ${[...styles].map(([k, v]) => `${k} ${v}`).join(", ")}`,
    `- Excluded: ${excluded.length}${excluded.length ? ` (${[...reasons].map(([k, v]) => `${k} ×${v}`).join(", ")})` : ""}`,
    "",
    "⚠️ = fewer than 3 scenes. Expand more for these before training.",
    "",
    table("By world", count(kept.map((c) => c.scene.world)), [...WORLDS]),
    table("By mechanic", count(kept.map((c) => c.scene.mechanic)), [...MECHANICS]),
    table("By lesson", byLesson, LESSONS.map((l) => l.id)),
    "### Danger card × mechanic",
    "",
    `| danger | ${MECHANICS.join(" | ")} |`,
    `|---|${MECHANICS.map(() => "---").join("|")}|`,
    ...DANGER_CARDS.map((d) => `| ${d.id} | ${MECHANICS.map((m) => comboCounts.get(`${d.id}|${m}`) ?? 0).join(" | ")} |`),
    "",
  ].join("\n");
}

