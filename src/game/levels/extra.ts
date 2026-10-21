import type { Role } from "../constants";
import type { Scene, SceneObject } from "../schema";

// Hand-written scenes for the worlds that have no hand-built levels yet. They
// back the stage's cached fallback (so any card combination still plays) and
// are seed examples for the fine-tune dataset.
// Mongolian copy is draft: needs a native-speaker pass.

const o = (sprite_id: string, x: number, y: number, role: Role): SceneObject => ({ sprite_id, x, y, role });

export const EXTRA_SCENES: Scene[] = [
  {
    world: "ger",
    backdrop_id: "ger_inside",
    mechanic: "drag_to_fix",
    instruction_mn: "Гадаа гарга!",
    objects: [
      o("smoke", 0.52, 0.22, "decor"),
      o("coal_stove", 0.52, 0.52, "hazard"),
      o("kid_hero", 0.3, 0.76, "draggable"),
      o("outside_zone", 0.86, 0.76, "target"),
    ],
    time_limit_s: 5,
    oops_mn: "Ой! Толгой эргэж байна!",
    lesson_id: "ger_co_symptoms",
  },
  {
    world: "ger",
    backdrop_id: "ger_inside",
    mechanic: "tap_hazards",
    instruction_mn: "Халуун зүйлсийг ол!",
    objects: [
      o("kettle_hot", 0.22, 0.66, "hazard"),
      o("hot_tea", 0.5, 0.74, "hazard"),
      o("coal_stove", 0.8, 0.56, "hazard"),
      o("winter_hat", 0.36, 0.9, "safe"),
      o("scarf", 0.66, 0.9, "safe"),
    ],
    time_limit_s: 6,
    oops_mn: "Ой! Халуун байна!",
    lesson_id: "ger_hot_water",
  },
  {
    world: "ger",
    backdrop_id: "ger_yard",
    mechanic: "drag_to_fix",
    instruction_mn: "Бээлийгээ өмс!",
    objects: [
      o("kid_hero", 0.5, 0.72, "decor"),
      o("wear_zone", 0.5, 0.54, "target"),
      o("mittens", 0.16, 0.86, "draggable"),
    ],
    time_limit_s: 6,
    oops_mn: "Ой! Гар хөрчихлөө!",
    lesson_id: "ger_cold_dress",
  },
  {
    world: "steppe",
    backdrop_id: "steppe_river",
    mechanic: "drag_to_fix",
    instruction_mn: "Эрэг рүү гарга!",
    objects: [
      o("thin_ice", 0.28, 0.7, "hazard"),
      o("thin_ice", 0.74, 0.72, "hazard"),
      o("kid_hero", 0.5, 0.66, "draggable"),
      o("riverbank_zone", 0.5, 0.88, "target"),
    ],
    time_limit_s: 5,
    oops_mn: "Ой! Мөс хагарч байна!",
    lesson_id: "steppe_thin_ice",
  },
  {
    world: "steppe",
    backdrop_id: "steppe_pasture",
    mechanic: "drag_to_fix",
    instruction_mn: "Мориноос холдуул!",
    objects: [
      o("horse", 0.46, 0.62, "hazard"),
      o("kid_hero", 0.68, 0.72, "draggable"),
      o("safe_zone", 0.14, 0.8, "target"),
    ],
    time_limit_s: 5,
    oops_mn: "Ой! Морь өшиглөх шахлаа!",
    lesson_id: "steppe_horse_behind",
  },
  {
    world: "steppe",
    backdrop_id: "steppe_pasture",
    mechanic: "tap_safe_choice",
    instruction_mn: "Шуурга ирвэл?",
    objects: [
      o("snowstorm", 0.5, 0.24, "decor"),
      o("kid_running", 0.32, 0.72, "option_wrong"),
      o("house", 0.68, 0.72, "option_correct"),
    ],
    time_limit_s: 5,
    oops_mn: "Ой! Шуурганд төөрөх шахлаа!",
    lesson_id: "steppe_snowstorm",
  },
  {
    world: "home",
    backdrop_id: "home_living_room",
    mechanic: "tap_hazards",
    instruction_mn: "Залгуурыг ол!",
    objects: [
      o("outlet", 0.18, 0.74, "hazard"),
      o("outlet", 0.68, 0.68, "hazard"),
      o("teddy", 0.42, 0.86, "safe"),
      o("books", 0.86, 0.88, "safe"),
    ],
    time_limit_s: 5,
    oops_mn: "Ой! Цахилгаан цохих шахлаа!",
    lesson_id: "home_outlet",
  },
  {
    world: "home",
    backdrop_id: "home_kitchen",
    mechanic: "drag_to_fix",
    instruction_mn: "Эмийг өндөрт тавь!",
    objects: [
      o("kid_hero", 0.2, 0.78, "decor"),
      o("medicine", 0.46, 0.78, "draggable"),
      o("shelf_zone", 0.8, 0.26, "target"),
    ],
    time_limit_s: 5,
    oops_mn: "Ой! Эм чихэр биш!",
    lesson_id: "home_medicine",
  },
  {
    world: "home",
    backdrop_id: "home_kitchen",
    mechanic: "tap_safe_choice",
    instruction_mn: "Хоолны өмнө?",
    objects: [
      o("apple", 0.28, 0.74, "option_wrong"),
      o("soap", 0.5, 0.74, "option_correct"),
      o("teddy", 0.72, 0.74, "option_wrong"),
    ],
    time_limit_s: 5,
    oops_mn: "Ой! Гар чинь бохир байна!",
    lesson_id: "home_hand_wash",
  },
];
