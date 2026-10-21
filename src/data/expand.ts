import { MECHANICS, type Mechanic, type World } from "@/game/constants";
import { extractJsonObject } from "@/game/generate/parse";
import { sceneReference } from "@/game/generate/prompts";
import { DANGER_CARDS, MECHANIC_CARDS, PLACE_CARDS, type DangerCard } from "@/game/generate/request";
import { WORLDS } from "@/game/constants";
import type { Candidate } from "./candidate";
import { mulberry32 } from "@/eval/review";

// Expansion (spec §7 step 2): a large model writes new scenes plus the judge
// requests each one answers. Targets go to the (danger, mechanic) combos the
// dataset covers least, so coverage evens out batch by batch.

export interface Target {
  dangerId: string;
  mechanic: Mechanic;
  world: World;
}

/** Scenes per (danger card, mechanic) combo, counting every candidate. */
export function coverage(candidates: Candidate[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const c of candidates) {
    const dangers = new Set(c.requests.map((r) => r.dangerId).filter(Boolean) as string[]);
    for (const d of dangers) {
      const k = `${d}|${c.scene.mechanic}`;
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
  }
  return counts;
}

/** The n least-covered combos (ties broken by a seeded shuffle). */
export function planTargets(candidates: Candidate[], n: number, seed: number): Target[] {
  const rand = mulberry32(seed);
  const counts = coverage(candidates);
  const combos = DANGER_CARDS.flatMap((d) => MECHANICS.map((m) => ({ d, m, tiebreak: rand() })));
  const planned = new Map<string, number>();
  const targets: Target[] = [];
  for (let i = 0; i < n; i++) {
    combos.sort((a, b) => {
      const ka = `${a.d.id}|${a.m}`;
      const kb = `${b.d.id}|${b.m}`;
      const ca = (counts.get(ka) ?? 0) + (planned.get(ka) ?? 0);
      const cb = (counts.get(kb) ?? 0) + (planned.get(kb) ?? 0);
      return ca - cb || a.tiebreak - b.tiebreak;
    });
    const { d, m } = combos[0];
    const k = `${d.id}|${m}`;
    planned.set(k, (planned.get(k) ?? 0) + 4);
    targets.push({ dangerId: d.id, mechanic: m, world: d.world === "any" ? WORLDS[Math.floor(rand() * WORLDS.length)] : d.world });
  }
  return targets;
}

// ----------------------------------------------------------------- prompts

export const EXPAND_SYSTEM = `You write training data for SafeQuest, a 5-second child-safety micro-game for Mongolian kids (Dumb Ways to Die style, never scary: failures are cartoon "oops", never death).

Each item is one game scene plus the requests a judge on stage could give that this exact scene answers.
A small model will be fine-tuned on (request -> scene), so every scene must be correct, varied and genuinely useful for teaching a child.

${sceneReference()}

Card IDs a request may use:
  place cards (placeId): ${PLACE_CARDS.map((p) => p.id).join(", ")}
  danger cards (dangerId): ${DANGER_CARDS.map((d) => `${d.id} [${d.world}; sprites: ${d.sprites.join("/")}]`).join(", ")}
  game-type cards (mechanic): ${MECHANIC_CARDS.map((m) => m.id).join(", ")}

Quality bar:
- One clear, true safety behavior per scene, matching the chosen lesson_id. If no lesson in the bank fits, do not write that scene.
- The intended action must be obvious from the picture and the instruction alone (players are 5–12, many cannot read well).
- Natural, child-level Cyrillic Mongolian. instruction_mn: 2–4 words, imperative with "!" (or a very short question for tap_safe_choice). oops_mn: starts with "Ой!", under 8 words, playful, never graphic.
- Vary layouts, backdrops (within the world), object counts and wording across items. Do not copy the example scenes.
- Respect every schema rule. Coordinates are sprite centers; keep tappable objects apart and fully on screen.

Requests for each scene (4–5 total, all must be answered by THIS scene):
1. Full cards: {"placeId": <scene backdrop_id>, "dangerId": <target danger>, "mechanic": <scene mechanic>}
2. Partial cards: {"dangerId": ...} or {"placeId": ..., "dangerId": ...}
3. Two or three free-text asks {"text": "..."} in Mongolian, at most 12 words, describing the situation the way a judge would say it. Mix styles: one neat sentence; one casual lowercase; one with a small realistic typo or combined with a placeId card.

Reply with ONLY this JSON, no prose:
{"items": [{"scene": {...}, "requests": [{...}, ...]}, ...]}`;

export function expandUserPrompt(target: Target, count: number, examples: Candidate[]): string {
  const danger = DANGER_CARDS.find((d) => d.id === target.dangerId) as DangerCard;
  const places = PLACE_CARDS.filter((p) => p.world === target.world).map((p) => p.id);
  return [
    `Write ${count} distinct items.`,
    `World: ${target.world} (backdrops: ${places.join(", ")})`,
    `Danger card: ${danger.id} "${danger.label_mn}" (use at least one of: ${danger.sprites.join(", ")})`,
    `Mechanic: ${target.mechanic}`,
    "",
    "Reference scenes (for format only, do not copy):",
    ...examples.map((e) => JSON.stringify(e.scene)),
  ].join("\n");
}

/** Up to n seed scenes as references, preferring the same mechanic and world. */
export function pickExamples(seeds: Candidate[], target: Target, n = 2): Candidate[] {
  const score = (c: Candidate) => (c.scene.mechanic === target.mechanic ? 2 : 0) + (c.scene.world === target.world ? 1 : 0);
  return [...seeds].sort((a, b) => score(b) - score(a)).slice(0, n);
}

/** Pulls the items array out of a model reply; never throws. */
export function parseExpansion(text: string): { items: unknown[]; error?: string } {
  const block = extractJsonObject(text);
  if (!block) return { items: [], error: "no JSON object in reply" };
  try {
    const value = JSON.parse(block) as { items?: unknown };
    return Array.isArray(value.items) ? { items: value.items } : { items: [], error: "reply has no items array" };
  } catch (e) {
    return { items: [], error: `invalid JSON: ${(e as Error).message}` };
  }
}

// ------------------------------------------------------------- model call

export interface Completion {
  text: string;
  stopReason: string | null;
  inputTokens: number;
  outputTokens: number;
}

/** Injected so the pipeline is testable without the network. */
export type Complete = (system: string, user: string) => Promise<Completion>;
