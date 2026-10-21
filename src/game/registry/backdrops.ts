import type { World } from "../constants";

// Backdrops are drawn from primitive layers (normalized coords) until real
// background art exists.

export type BackdropLayer =
  | { type: "rect"; x: number; y: number; w: number; h: number; color: number }
  | { type: "stripes"; x: number; y: number; w: number; h: number; color: number; count: number; vertical: boolean }
  | { type: "circle"; x: number; y: number; r: number; color: number };

export interface BackdropDef {
  id: string;
  world: World;
  label_mn: string;
  layers: BackdropLayer[];
}

const rect = (x: number, y: number, w: number, h: number, color: number): BackdropLayer => ({ type: "rect", x, y, w, h, color });
const stripes = (x: number, y: number, w: number, h: number, color: number, count: number, vertical = true): BackdropLayer => ({
  type: "stripes", x, y, w, h, color, count, vertical,
});
const circle = (x: number, y: number, r: number, color: number): BackdropLayer => ({ type: "circle", x, y, r, color });

const SKY = 0x9ad7ff;
const WINTER_SKY = 0xdcecff;
const ASPHALT = 0x4b4f58;
const PAVEMENT = 0xc9c9c9;

const skyline = (color: number): BackdropLayer[] => [
  rect(0.02, 0.2, 0.12, 0.25, color),
  rect(0.16, 0.12, 0.1, 0.33, color),
  rect(0.3, 0.24, 0.14, 0.21, color),
  rect(0.6, 0.16, 0.12, 0.29, color),
  rect(0.76, 0.26, 0.1, 0.19, color),
  rect(0.88, 0.1, 0.1, 0.35, color),
];

export const BACKDROPS: BackdropDef[] = [
  {
    id: "city_crosswalk", world: "city", label_mn: "Явган хүний гарц",
    layers: [rect(0, 0, 1, 0.45, SKY), ...skyline(0x8aa0b8), rect(0, 0.45, 1, 0.1, PAVEMENT), rect(0, 0.55, 1, 0.3, ASPHALT),
      stripes(0.4, 0.57, 0.2, 0.26, 0xffffff, 6), rect(0, 0.85, 1, 0.15, PAVEMENT)],
  },
  {
    id: "city_street", world: "city", label_mn: "Гудамж",
    layers: [rect(0, 0, 1, 0.45, SKY), ...skyline(0x9aa8c0), rect(0, 0.45, 1, 0.1, PAVEMENT), rect(0, 0.55, 1, 0.3, ASPHALT),
      stripes(0.02, 0.695, 0.96, 0.02, 0xffe066, 8, true), rect(0, 0.85, 1, 0.15, PAVEMENT)],
  },
  {
    id: "city_park", world: "city", label_mn: "Цэцэрлэгт хүрээлэн",
    layers: [rect(0, 0, 1, 0.5, SKY), ...skyline(0xb0bccc), rect(0, 0.45, 1, 0.55, 0x7cc66b), rect(0, 0.68, 1, 0.08, 0xd8c39a),
      circle(0.85, 0.12, 0.06, 0xffe066)],
  },
  {
    id: "city_construction", world: "city", label_mn: "Барилгын талбай",
    layers: [rect(0, 0, 1, 0.5, SKY), rect(0.55, 0.1, 0.3, 0.4, 0xa0a0a0), stripes(0.55, 0.1, 0.3, 0.4, 0x808080, 5, false),
      rect(0, 0.5, 1, 0.5, 0xc49a6c), stripes(0.32, 0.4, 0.04, 0.6, 0xff9f1c, 1), rect(0.32, 0.4, 0.04, 0.6, 0xff9f1c)],
  },
  {
    id: "city_winter_sidewalk", world: "city", label_mn: "Өвлийн явган зам",
    layers: [rect(0, 0, 1, 0.5, WINTER_SKY), rect(0, 0.08, 0.3, 0.42, 0x8d99ae), rect(0.32, 0.18, 0.34, 0.32, 0x7b8aa3),
      rect(0.68, 0.05, 0.32, 0.45, 0x8d99ae), rect(0, 0.08, 1, 0.03, 0xffffff), rect(0, 0.5, 1, 0.5, 0xf2f7ff),
      rect(0, 0.62, 1, 0.22, 0xcfe8ff)],
  },
  {
    id: "city_courtyard", world: "city", label_mn: "Байрны хашаа",
    layers: [rect(0, 0, 1, 0.5, SKY), rect(0, 0.02, 0.45, 0.48, 0xe0b48a), stripes(0.02, 0.06, 0.41, 0.4, 0x7fb7e6, 6),
      rect(0.55, 0.06, 0.45, 0.44, 0xd9a273), stripes(0.57, 0.1, 0.41, 0.36, 0x7fb7e6, 6), rect(0, 0.5, 1, 0.5, 0x6d7380)],
  },
  {
    id: "city_parking", world: "city", label_mn: "Зогсоол",
    layers: [rect(0, 0, 1, 0.42, SKY), ...skyline(0x9aa8c0), rect(0, 0.42, 1, 0.58, ASPHALT),
      stripes(0.25, 0.42, 0.6, 0.3, 0xffffff, 4), rect(0, 0.78, 0.26, 0.22, PAVEMENT)],
  },
  {
    id: "ger_inside", world: "ger", label_mn: "Гэрийн дотор",
    layers: [rect(0, 0, 1, 0.6, 0xf1e3c6), stripes(0, 0.1, 1, 0.5, 0xc89b6d, 16), rect(0, 0.6, 1, 0.4, 0x8b5a2b),
      rect(0.46, 0, 0.08, 0.6, 0xd35400)],
  },
  {
    id: "ger_yard", world: "ger", label_mn: "Хашаа",
    layers: [rect(0, 0, 1, 0.55, 0xc9d6e3), rect(0, 0.3, 1, 0.25, 0x8b5a2b), stripes(0, 0.3, 1, 0.25, 0x6b4423, 20),
      rect(0, 0.55, 1, 0.45, 0xf4f8ff)],
  },
  {
    id: "steppe_river", world: "steppe", label_mn: "Голын эрэг",
    layers: [rect(0, 0, 1, 0.45, WINTER_SKY), circle(0.2, 0.45, 0.25, 0xb8c4d6), circle(0.7, 0.45, 0.3, 0xa9b6c9),
      rect(0, 0.45, 1, 0.55, 0xe9f1ff), rect(0, 0.6, 1, 0.22, 0x9fd3ff)],
  },
  {
    id: "steppe_pasture", world: "steppe", label_mn: "Бэлчээр",
    layers: [rect(0, 0, 1, 0.5, SKY), circle(0.25, 0.52, 0.22, 0x8bb174), circle(0.75, 0.52, 0.28, 0x7aa364),
      rect(0, 0.5, 1, 0.5, 0x9ccc65)],
  },
  {
    id: "home_kitchen", world: "home", label_mn: "Гал тогоо",
    layers: [rect(0, 0, 1, 0.62, 0xfff3d6), rect(0, 0.42, 1, 0.2, 0xb08968), stripes(0, 0.62, 1, 0.38, 0xe9ecef, 10),
      rect(0, 0.62, 1, 0.38, 0xdee2e6)],
  },
  {
    id: "home_living_room", world: "home", label_mn: "Зочны өрөө",
    layers: [rect(0, 0, 1, 0.62, 0xe6f0ff), rect(0.62, 0.1, 0.26, 0.32, 0x9ad7ff), rect(0, 0.62, 1, 0.38, 0xc08552),
      stripes(0, 0.62, 1, 0.38, 0xa0693c, 12)],
  },
];

export const BACKDROP_BY_ID: ReadonlyMap<string, BackdropDef> = new Map(BACKDROPS.map((b) => [b.id, b]));
