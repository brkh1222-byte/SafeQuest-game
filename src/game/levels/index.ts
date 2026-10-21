import type { World } from "../constants";
import { CITY_LEVELS, type Level } from "./city";

export type { Level };

export const LEVELS_BY_WORLD: Record<World, Level[]> = {
  city: CITY_LEVELS,
  ger: [],
  steppe: [],
  home: [],
};

export interface WorldInfo {
  id: World;
  title_mn: string;
  emoji: string;
  color: string;
}

export const WORLD_INFO: WorldInfo[] = [
  { id: "city", title_mn: "Хот", emoji: "🏙️", color: "#4f8cff" },
  { id: "ger", title_mn: "Гэр хороолол", emoji: "🛖", color: "#e07a3f" },
  { id: "steppe", title_mn: "Хөдөө", emoji: "🐎", color: "#5aa65a" },
  { id: "home", title_mn: "Гэр ба эрүүл мэнд", emoji: "🏠", color: "#c45bd6" },
];

export const isWorld = (v: string): v is World => WORLD_INFO.some((w) => w.id === v);
