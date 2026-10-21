// Logical game resolution (landscape 16:9). Scene coordinates are normalized
// 0–1 and mapped onto this space; Phaser scales it to fit the screen.
export const GAME_W = 960;
export const GAME_H = 540;

export const WORLDS = ["city", "ger", "steppe", "home"] as const;
export type World = (typeof WORLDS)[number];

export const MECHANICS = ["drag_to_fix", "tap_hazards", "tap_safe_choice"] as const;
export type Mechanic = (typeof MECHANICS)[number];

export const ROLES = [
  "draggable",
  "target",
  "hazard",
  "safe",
  "option_correct",
  "option_wrong",
  "decor",
] as const;
export type Role = (typeof ROLES)[number];
