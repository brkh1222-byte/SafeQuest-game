import { MECHANICS, ROLES, WORLDS } from "../constants";
import { CITY_LEVELS } from "../levels/city";
import { BACKDROPS } from "../registry/backdrops";
import { LESSONS } from "../registry/lessons";
import { SPRITES } from "../registry/sprites";
import { formatRequest, type GenerateRequest } from "./request";

// The three columns of the stage comparison (spec §6). The exact messages are
// returned with every result so a judge can see nothing is hidden.

export const VARIANTS = ["base_naive", "base_fewshot", "finetuned"] as const;
export type Variant = (typeof VARIANTS)[number];

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** Shared by the naive base column and the fine-tuned model (and its training data). */
export const SHORT_SYSTEM = "Чи SafeQuest тоглоомын мини тоглоомын үзэгдлийг JSON хэлбэрээр гаргана. Зөвхөн JSON буцаа.";

export function buildMessages(variant: Variant, req: GenerateRequest): ChatMessage[] {
  const user: ChatMessage = { role: "user", content: formatRequest(req) };
  if (variant !== "base_fewshot") return [{ role: "system", content: SHORT_SYSTEM }, user];
  return [{ role: "system", content: fewShotSystem() }, ...FEW_SHOT_EXAMPLES.flat(), user];
}

const byWorld = <T extends { world: string; id: string }>(items: T[], fmt: (x: T) => string = (x) => x.id) =>
  [...WORLDS, "any"]
    .map((w) => {
      const ids = items.filter((x) => x.world === w).map(fmt);
      return ids.length ? `  ${w}: ${ids.join(", ")}` : null;
    })
    .filter(Boolean)
    .join("\n");

let cachedSystem: string | undefined;

function fewShotSystem(): string {
  cachedSystem ??= `You generate one micro-game scene for SafeQuest, a child-safety game for Mongolian kids.
Reply with ONLY a JSON object, no prose, no code fences.

${sceneReference()}`;
  return cachedSystem;
}

/** Scene schema, rules and every allowed ID. Shared with the dataset generator. */
export function sceneReference(): string {
  return `Schema:
{
  "world": ${WORLDS.map((w) => `"${w}"`).join(" | ")},
  "backdrop_id": string,            // must belong to the same world
  "mechanic": ${MECHANICS.map((m) => `"${m}"`).join(" | ")},
  "instruction_mn": string,         // 2-4 Mongolian words, imperative, e.g. "Аюулыг ол!"
  "objects": [{ "sprite_id": string, "x": 0..1, "y": 0..1, "role": ${ROLES.map((r) => `"${r}"`).join(" | ")} }],
  "time_limit_s": 3..10,
  "oops_mn": string,                // short Mongolian failure line starting with "Ой!"
  "lesson_id": string               // pick from the lesson bank; never invent lessons
}

Rules:
- drag_to_fix: >=1 "draggable", >=1 "target" (zone sprites only), optional "hazard"/"decor". Draggables must not start inside a target.
- tap_hazards: >=1 "hazard", optional "safe" (tapping it loses) and "decor".
- tap_safe_choice: exactly 1 "option_correct", 1-2 "option_wrong", optional "decor".
- x,y are the sprite center; y=0 is the top. Ground is roughly y>0.5. Keep tappable objects apart and on screen.
- Sprites and lessons must belong to the scene's world or to "any".

Backdrops:
${byWorld(BACKDROPS)}

Sprites (zones are drop targets):
${byWorld(SPRITES, (s) => (s.kind === "zone" ? `${s.id}[zone]` : s.id))}

Lesson bank:
${byWorld(LESSONS, (l) => `${l.id} (${l.text_en})`)}`;
}

// Three worked examples, one per mechanic, drawn from the hand-built levels.
const example = (levelId: string, req: GenerateRequest): ChatMessage[] => {
  const level = CITY_LEVELS.find((l) => l.id === levelId);
  if (!level) throw new Error(`missing few-shot level ${levelId}`);
  return [
    { role: "user", content: formatRequest(req) },
    { role: "assistant", content: JSON.stringify(level.scene) },
  ];
};

export const FEW_SHOT_REQUESTS: [levelId: string, req: GenerateRequest][] = [
  ["city-01", { placeId: "city_crosswalk", dangerId: "traffic", mechanic: "drag_to_fix" }],
  ["city-02", { placeId: "city_street", dangerId: "manhole" }],
  ["city-10", { dangerId: "icy_road", text: "Мөстэй замаар яаж алхах вэ?" }],
];

const FEW_SHOT_EXAMPLES: ChatMessage[][] = FEW_SHOT_REQUESTS.map(([id, req]) => example(id, req));
