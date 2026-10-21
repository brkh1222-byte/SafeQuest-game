import { z } from "zod";
import { MECHANICS, type Mechanic, type World } from "../constants";
import { BACKDROPS, BACKDROP_BY_ID } from "../registry/backdrops";

// What a judge asks for on stage: picture cards and/or free text.
// `formatRequest` is the ONE canonical text form of a request. The stage, the
// eval script and the fine-tune dataset must all use it, or the fine-tuned
// model sees prompts at demo time that look nothing like its training data.

export interface DangerCard {
  id: string;
  label_mn: string;
  emoji: string;
  world: World | "any";
  /** Sprites that express this danger (used to match cached scenes). */
  sprites: string[];
}

export const DANGER_CARDS: DangerCard[] = [
  { id: "traffic", label_mn: "Машин, зам", emoji: "🚗", world: "city", sprites: ["car_red", "taxi", "bus", "truck"] },
  { id: "manhole", label_mn: "Задгай худаг", emoji: "🕳️", world: "city", sprites: ["manhole_open"] },
  { id: "falling_ice", label_mn: "Унжсан мөс", emoji: "🧊", world: "city", sprites: ["icicle"] },
  { id: "stray_dog", label_mn: "Золбин нохой", emoji: "🐕", world: "city", sprites: ["dog_stray"] },
  { id: "stranger", label_mn: "Танихгүй хүн", emoji: "🕴️", world: "city", sprites: ["stranger", "stranger_car", "candy"] },
  { id: "construction", label_mn: "Барилгын талбай", emoji: "🏗️", world: "city", sprites: ["crane", "bricks", "cone"] },
  { id: "icy_road", label_mn: "Мөстэй зам", emoji: "⛸️", world: "city", sprites: ["penguin_walk", "ice_skate"] },
  { id: "electric", label_mn: "Цахилгаан", emoji: "⚡", world: "any", sprites: ["electric_box", "loose_wire", "outlet"] },
  { id: "co_smoke", label_mn: "Утаа, угаарын хий", emoji: "💨", world: "ger", sprites: ["smoke", "coal_stove"] },
  { id: "hot", label_mn: "Халуун зүйл", emoji: "🫖", world: "ger", sprites: ["kettle_hot", "hot_tea", "coal_stove"] },
  { id: "cold", label_mn: "Хүйтэн", emoji: "🧤", world: "ger", sprites: ["mittens", "winter_hat", "scarf"] },
  { id: "matches", label_mn: "Шүдэнз", emoji: "🧨", world: "ger", sprites: ["matches"] },
  { id: "thin_ice", label_mn: "Нимгэн мөс", emoji: "🧊", world: "steppe", sprites: ["thin_ice"] },
  { id: "horse", label_mn: "Морь", emoji: "🐎", world: "steppe", sprites: ["horse"] },
  { id: "guard_dog", label_mn: "Айлын нохой", emoji: "🐕‍🦺", world: "steppe", sprites: ["guard_dog"] },
  { id: "storm", label_mn: "Цасан шуурга", emoji: "🌨️", world: "steppe", sprites: ["snowstorm"] },
  { id: "medicine", label_mn: "Эм", emoji: "💊", world: "home", sprites: ["medicine"] },
  { id: "chemicals", label_mn: "Химийн бодис", emoji: "🧴", world: "home", sprites: ["chemicals"] },
  { id: "sharp", label_mn: "Хурц зүйл", emoji: "🔪", world: "home", sprites: ["knife", "scissors"] },
  { id: "window", label_mn: "Цонх, тагт", emoji: "🪟", world: "home", sprites: ["window_open"] },
  { id: "germs", label_mn: "Бохир гар", emoji: "🧼", world: "home", sprites: ["soap"] },
];

export const DANGER_BY_ID: ReadonlyMap<string, DangerCard> = new Map(DANGER_CARDS.map((d) => [d.id, d]));

/** Place cards are the backdrops. */
export const PLACE_CARDS = BACKDROPS.map((b) => ({ id: b.id, label_mn: b.label_mn, world: b.world }));

export const MECHANIC_CARDS: { id: Mechanic; label_mn: string; emoji: string }[] = [
  { id: "drag_to_fix", label_mn: "Чирж засах", emoji: "✋" },
  { id: "tap_hazards", label_mn: "Аюулыг олох", emoji: "👆" },
  { id: "tap_safe_choice", label_mn: "Зөвийг сонгох", emoji: "🤔" },
];

export const GenerateRequestSchema = z
  .object({
    placeId: z.string().optional(),
    dangerId: z.string().optional(),
    mechanic: z.enum(MECHANICS).optional(),
    text: z.string().trim().max(200).optional(),
  })
  .refine((r) => r.dangerId || r.text, { message: "pick a danger card or type a prompt" })
  .refine((r) => !r.placeId || BACKDROP_BY_ID.has(r.placeId), { message: "unknown place card" })
  .refine((r) => !r.dangerId || DANGER_BY_ID.has(r.dangerId), { message: "unknown danger card" });

export type GenerateRequest = z.infer<typeof GenerateRequestSchema>;

export function formatRequest(req: GenerateRequest): string {
  const lines: string[] = [];
  const place = req.placeId ? BACKDROP_BY_ID.get(req.placeId) : undefined;
  const danger = req.dangerId ? DANGER_BY_ID.get(req.dangerId) : undefined;
  if (place) lines.push(`Газар: ${place.label_mn} (${place.id})`);
  if (danger) lines.push(`Аюул: ${danger.label_mn}`);
  if (req.mechanic) lines.push(`Тоглоом: ${req.mechanic}`);
  if (req.text) lines.push(`Тайлбар: ${req.text}`);
  return lines.join("\n");
}
