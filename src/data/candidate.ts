import { findLeaks } from "@/eval/leak";
import { HELDOUT } from "@/eval/heldout";
import { playabilityIssues } from "@/game/geometry";
import { SHORT_SYSTEM, type ChatMessage } from "@/game/generate/prompts";
import { DANGER_BY_ID, DANGER_CARDS, formatRequest, GenerateRequestSchema, type GenerateRequest } from "@/game/generate/request";
import { CITY_LEVELS } from "@/game/levels/city";
import { EXTRA_SCENES } from "@/game/levels/extra";
import { parseScene, type Scene } from "@/game/schema";
import { simulateWin } from "@/eval/core";

// A candidate is one scene plus every judge request it correctly answers.
// Each request becomes one training example (spec §7): the same scene can be
// asked for with full cards, partial cards, or free Mongolian text.

export interface Candidate {
  id: string;
  source: "seed" | "expand";
  scene: Scene;
  requests: GenerateRequest[];
  /** Expansion batch that produced it (for auditing raw outputs). */
  batch?: string;
}

export interface Rejection {
  id: string;
  batch?: string;
  reasons: string[];
  raw: unknown;
}

// ------------------------------------------------------- training format

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * One fixed key order and 2-decimal coordinates for every training target.
 * A small model learns a consistent format much faster than a varied one.
 */
export function canonicalScene(s: Scene): Scene {
  return {
    world: s.world,
    backdrop_id: s.backdrop_id,
    mechanic: s.mechanic,
    instruction_mn: s.instruction_mn.trim(),
    objects: s.objects.map((o) => ({ sprite_id: o.sprite_id, x: round2(o.x), y: round2(o.y), role: o.role })),
    time_limit_s: s.time_limit_s,
    oops_mn: s.oops_mn.trim(),
    lesson_id: s.lesson_id,
  };
}

/** Exactly what the stage sends at demo time: same system prompt, same request format. */
export function toExample(req: GenerateRequest, scene: Scene): { messages: ChatMessage[] } {
  return {
    messages: [
      { role: "system", content: SHORT_SYSTEM },
      { role: "user", content: formatRequest(req) },
      { role: "assistant", content: JSON.stringify(canonicalScene(scene)) },
    ],
  };
}

// ----------------------------------------------------------------- vetting

/**
 * Same backdrop, sprites, roles, lesson and instruction = the same training
 * signal, even if objects moved a little. Different wording is kept.
 */
export function structuralKey(s: Scene): string {
  const objs = s.objects.map((o) => `${o.sprite_id}:${o.role}`).sort().join(",");
  return `${s.backdrop_id}|${s.mechanic}|${s.lesson_id}|${s.instruction_mn.trim().toLowerCase()}|${objs}`;
}

const heldoutLeak = (req: GenerateRequest) => {
  const line = JSON.stringify({ messages: [{ role: "user", content: formatRequest(req) }] });
  return findLeaks(HELDOUT, line).length > 0;
};

/** Why this request is NOT answered by this scene (empty = consistent). */
export function requestIssues(req: unknown, scene: Scene): string[] {
  const parsed = GenerateRequestSchema.safeParse(req);
  if (!parsed.success) return [`invalid request: ${parsed.error.issues.map((i) => i.message).join("; ")}`];
  const r = parsed.data;
  const issues: string[] = [];
  if (r.placeId && r.placeId !== scene.backdrop_id) issues.push(`place card ${r.placeId} but scene uses ${scene.backdrop_id}`);
  if (r.mechanic && r.mechanic !== scene.mechanic) issues.push(`game-type card ${r.mechanic} but scene is ${scene.mechanic}`);
  if (r.dangerId) {
    const card = DANGER_BY_ID.get(r.dangerId)!;
    if (card.world !== "any" && card.world !== scene.world) issues.push(`danger card ${card.id} is from ${card.world}, scene is ${scene.world}`);
    else if (!scene.objects.some((o) => card.sprites.includes(o.sprite_id))) issues.push(`danger card ${card.id} but none of its sprites are in the scene`);
  }
  if (heldoutLeak(r)) issues.push("matches a held-out eval prompt");
  return issues;
}

export type VetResult =
  | { ok: true; candidate: Candidate; droppedRequests: { request: unknown; reasons: string[] }[] }
  | { ok: false; reasons: string[] };

/**
 * Training targets must be perfect: valid, cleanly laid out, winnable, not a
 * duplicate, and every kept request must really be answered by the scene.
 */
export function vetItem(raw: unknown, meta: Pick<Candidate, "id" | "source" | "batch">, seenKeys: Set<string>): VetResult {
  const item = (raw ?? {}) as { scene?: unknown; requests?: unknown };
  const parsed = parseScene(item.scene);
  if (!parsed.ok) return { ok: false, reasons: parsed.errors.map((e) => `invalid scene: ${e}`) };
  const scene = canonicalScene(parsed.scene);

  // Rounding can move objects; re-check after canonicalizing.
  const layout = playabilityIssues(scene);
  if (layout.length) return { ok: false, reasons: layout.map((e) => `layout: ${e}`) };
  if (!simulateWin(scene)) return { ok: false, reasons: ["engine cannot reach a win"] };

  const key = structuralKey(scene);
  if (seenKeys.has(key)) return { ok: false, reasons: ["duplicate of an existing scene"] };

  const requests: GenerateRequest[] = [];
  const droppedRequests: { request: unknown; reasons: string[] }[] = [];
  const seenPrompts = new Set<string>();
  for (const req of Array.isArray(item.requests) ? item.requests : []) {
    const issues = requestIssues(req, scene);
    if (issues.length) {
      droppedRequests.push({ request: req, reasons: issues });
      continue;
    }
    const r = GenerateRequestSchema.parse(req);
    const prompt = formatRequest(r);
    if (seenPrompts.has(prompt)) continue;
    seenPrompts.add(prompt);
    requests.push(r);
  }
  if (!requests.length) return { ok: false, reasons: ["no request is consistent with the scene", ...droppedRequests.flatMap((d) => d.reasons)] };

  seenKeys.add(key);
  return { ok: true, candidate: { ...meta, scene, requests }, droppedRequests };
}

// ------------------------------------------------------------------- seeds

/** Card requests a judge could use to get this hand-built scene. */
export function deriveSeedRequests(scene: Scene): GenerateRequest[] {
  const dangers = DANGER_CARDS.filter(
    (d) => (d.world === "any" || d.world === scene.world) && scene.objects.some((o) => d.sprites.includes(o.sprite_id)),
  ).slice(0, 2);
  const out: GenerateRequest[] = dangers.flatMap((d) => [
    { placeId: scene.backdrop_id, dangerId: d.id, mechanic: scene.mechanic },
    { placeId: scene.backdrop_id, dangerId: d.id },
    { dangerId: d.id },
  ]);
  // The instruction itself is a natural free-text ask ("Дуулгаа өмс").
  out.push({ text: scene.instruction_mn.replace(/[!?]/g, "").trim() });
  return out;
}

export function seedCandidates(): { candidates: Candidate[]; rejections: Rejection[] } {
  const seen = new Set<string>();
  const scenes = [
    ...CITY_LEVELS.map((l) => ({ id: `seed-${l.id}`, scene: l.scene })),
    ...EXTRA_SCENES.map((s, i) => ({ id: `seed-extra-${String(i + 1).padStart(2, "0")}`, scene: s })),
  ];
  const candidates: Candidate[] = [];
  const rejections: Rejection[] = [];
  for (const { id, scene } of scenes) {
    const res = vetItem({ scene, requests: deriveSeedRequests(scene) }, { id, source: "seed" }, seen);
    if (res.ok) candidates.push(res.candidate);
    else rejections.push({ id, reasons: res.reasons, raw: scene });
  }
  return { candidates, rejections };
}
