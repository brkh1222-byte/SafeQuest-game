import type { World } from "../constants";

// Single source of truth for everything the engine (and the model) may place.
// `emoji` is placeholder art until the CC0 + AI sprite pass lands; swapping in
// real textures only needs a `texture` field here, no level changes.

export type SpriteKind = "character" | "object" | "zone";
export type SpriteAnim = "none" | "bob" | "pulse" | "shake";

export interface SpriteDef {
  id: string;
  world: World | "any";
  kind: SpriteKind;
  emoji: string;
  label_mn: string;
  /** Height as a fraction of the game height. */
  size: number;
  anim?: SpriteAnim;
  /** Zones only: drop-target rectangle as fractions of game width/height. */
  zone?: { w: number; h: number; color: number };
}

const s = (
  id: string,
  world: SpriteDef["world"],
  kind: SpriteKind,
  emoji: string,
  label_mn: string,
  size = 0.16,
  anim: SpriteAnim = "none",
): SpriteDef => ({ id, world, kind, emoji, label_mn, size, anim });

const zone = (
  id: string,
  world: SpriteDef["world"],
  emoji: string,
  label_mn: string,
  w: number,
  h: number,
  color: number,
): SpriteDef => ({ id, world, kind: "zone", emoji, label_mn, size: 0.1, zone: { w, h, color } });

export const SPRITES: SpriteDef[] = [
  // Shared characters
  s("kid_hero", "any", "character", "🧒", "Хүүхэд", 0.2, "bob"),
  s("sidekick_marmot", "any", "character", "🐿️", "Тарвага", 0.16, "bob"),
  s("mom", "any", "character", "👩", "Ээж", 0.18),
  s("police_officer", "any", "character", "👮", "Цагдаа", 0.2),
  s("stranger", "any", "character", "🕴️", "Танихгүй хүн", 0.2, "shake"),

  // Shared choice icons (tap_safe_choice options)
  s("look_eyes", "any", "object", "👀", "Хоёр тийшээ харах", 0.2, "pulse"),
  s("kid_running", "any", "character", "🏃", "Гүйх", 0.2),
  s("phone", "any", "object", "📱", "Утас", 0.16),
  s("backpack", "any", "object", "🎒", "Цүнх", 0.18),
  s("headphones", "any", "object", "🎧", "Чихэвч", 0.16),
  s("candy", "any", "object", "🍬", "Чихэр", 0.14),
  s("house", "any", "object", "🏠", "Гэр", 0.2),
  s("penguin_walk", "any", "character", "🐧", "Оцон шувуу шиг алхах", 0.2, "bob"),
  s("ice_skate", "any", "object", "⛸️", "Гулгах", 0.18),

  // Shared zones
  zone("safe_zone", "any", "✅", "Аюулгүй газар", 0.22, 0.24, 0x7ed957),
  zone("help_zone", "any", "🆘", "Тусламж", 0.2, 0.28, 0x6ec6ff),
  zone("wear_zone", "any", "⬇️", "Өмс", 0.1, 0.12, 0xffd166),

  // City
  s("car_red", "city", "object", "🚗", "Машин", 0.2, "shake"),
  s("taxi", "city", "object", "🚕", "Такси", 0.2, "shake"),
  s("bus", "city", "object", "🚌", "Автобус", 0.24, "shake"),
  s("truck", "city", "object", "🚚", "Ачааны машин", 0.24, "shake"),
  s("stranger_car", "city", "object", "🚙", "Танихгүй машин", 0.22),
  s("traffic_light", "city", "object", "🚦", "Гэрлэн дохио", 0.2),
  s("bicycle", "city", "object", "🚲", "Дугуй", 0.18),
  s("bike_helmet", "city", "object", "⛑️", "Дуулга", 0.14, "pulse"),
  s("ball", "city", "object", "⚽", "Бөмбөг", 0.1, "bob"),
  s("manhole_open", "city", "object", "🕳️", "Задгай худаг", 0.14),
  s("cone", "city", "object", "🚧", "Хаалт", 0.14),
  s("crane", "city", "object", "🏗️", "Кран", 0.3),
  s("bricks", "city", "object", "🧱", "Тоосго", 0.14, "shake"),
  s("dog_stray", "city", "character", "🐕", "Золбин нохой", 0.16, "shake"),
  s("icicle", "city", "object", "🧊", "Унжсан мөс", 0.12, "shake"),
  s("snowman", "city", "object", "⛄", "Цасан хүн", 0.18),
  s("electric_box", "city", "object", "⚡", "Цахилгааны хайрцаг", 0.16, "pulse"),
  s("loose_wire", "city", "object", "➰", "Тасарсан утас", 0.14, "shake"),
  s("slide", "city", "object", "🛝", "Гулгуур", 0.2),
  s("tree", "city", "object", "🌳", "Мод", 0.24),
  s("bench", "city", "object", "🪑", "Сандал", 0.14),
  s("pigeon", "city", "character", "🐦", "Тагтаа", 0.1, "bob"),
  s("shop", "city", "object", "🏪", "Дэлгүүр", 0.24),
  zone("sidewalk_zone", "city", "🚶", "Явган зам", 0.24, 0.18, 0xd9d9d9),
  zone("playground_zone", "city", "🛝", "Тоглоомын талбай", 0.24, 0.24, 0x9be564),

  // Ger district (winter home)
  s("ger", "ger", "object", "🛖", "Гэр", 0.3),
  s("coal_stove", "ger", "object", "🔥", "Зуух", 0.2, "pulse"),
  s("coal_bucket", "ger", "object", "🪣", "Нүүрсний хувин", 0.14),
  s("kettle_hot", "ger", "object", "🫖", "Халуун данх", 0.14, "shake"),
  s("hot_tea", "ger", "object", "☕", "Халуун цай", 0.12),
  s("matches", "ger", "object", "🧨", "Шүдэнз", 0.12, "shake"),
  s("mittens", "ger", "object", "🧤", "Бээлий", 0.12),
  s("winter_hat", "ger", "object", "🧢", "Малгай", 0.12),
  s("scarf", "ger", "object", "🧣", "Ороолт", 0.12),
  s("smoke", "ger", "object", "💨", "Утаа", 0.16, "pulse"),
  zone("outside_zone", "ger", "🚪", "Гадаа", 0.2, 0.26, 0xbde0fe),

  // Steppe / countryside
  s("horse", "steppe", "character", "🐎", "Морь", 0.26),
  s("guard_dog", "steppe", "character", "🐕‍🦺", "Айлын нохой", 0.18, "shake"),
  s("sheep", "steppe", "character", "🐑", "Хонь", 0.14, "bob"),
  s("camel", "steppe", "character", "🐫", "Тэмээ", 0.26),
  s("thin_ice", "steppe", "object", "🧊", "Нимгэн мөс", 0.14, "shake"),
  s("snowstorm", "steppe", "object", "🌨️", "Цасан шуурга", 0.22, "pulse"),
  s("mountain", "steppe", "object", "⛰️", "Уул", 0.3),
  s("eagle", "steppe", "character", "🦅", "Бүргэд", 0.14, "bob"),
  s("lifebuoy", "steppe", "object", "🛟", "Аврах цагираг", 0.14),
  zone("riverbank_zone", "steppe", "🌾", "Эрэг", 0.24, 0.22, 0xa7d676),

  // Home & health
  s("outlet", "home", "object", "🔌", "Залгуур", 0.14, "pulse"),
  s("medicine", "home", "object", "💊", "Эм", 0.12),
  s("chemicals", "home", "object", "🧴", "Цэвэрлэгээний бодис", 0.14),
  s("window_open", "home", "object", "🪟", "Онгорхой цонх", 0.24),
  s("knife", "home", "object", "🔪", "Хутга", 0.12, "shake"),
  s("scissors", "home", "object", "✂️", "Хайч", 0.12),
  s("soap", "home", "object", "🧼", "Саван", 0.12, "pulse"),
  s("teddy", "home", "object", "🧸", "Тоглоом", 0.14),
  s("books", "home", "object", "📚", "Ном", 0.14),
  s("apple", "home", "object", "🍎", "Алим", 0.1),
  zone("shelf_zone", "home", "🗄️", "Өндөр тавиур", 0.2, 0.16, 0xf4d35e),
];

export const SPRITE_BY_ID: ReadonlyMap<string, SpriteDef> = new Map(SPRITES.map((d) => [d.id, d]));
