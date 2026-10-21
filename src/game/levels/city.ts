import type { Role } from "../constants";
import type { Scene, SceneObject } from "../schema";

// Hand-built City (Ulaanbaatar) world. These double as seed examples for the
// fine-tune dataset, so keep them clean and varied.
// Mongolian copy is draft: needs a native-speaker pass before the demo.

export interface Level {
  id: string;
  title_mn: string;
  scene: Scene;
}

const o = (sprite_id: string, x: number, y: number, role: Role): SceneObject => ({ sprite_id, x, y, role });

export const CITY_LEVELS: Level[] = [
  {
    id: "city-01",
    title_mn: "Улаан гэрэл",
    scene: {
      world: "city",
      backdrop_id: "city_crosswalk",
      mechanic: "drag_to_fix",
      instruction_mn: "Явган зам руу аваач!",
      objects: [
        o("traffic_light", 0.66, 0.36, "decor"),
        o("kid_hero", 0.5, 0.66, "draggable"),
        o("car_red", 0.2, 0.7, "hazard"),
        o("bus", 0.84, 0.68, "hazard"),
        o("sidewalk_zone", 0.5, 0.9, "target"),
      ],
      time_limit_s: 5,
      oops_mn: "Ой! Улаан гэрэл асаж байсан!",
      lesson_id: "traffic_wait_green",
    },
  },
  {
    id: "city-02",
    title_mn: "Задгай худаг",
    scene: {
      world: "city",
      backdrop_id: "city_street",
      mechanic: "tap_hazards",
      instruction_mn: "Задгай худгийг ол!",
      objects: [
        o("manhole_open", 0.18, 0.9, "hazard"),
        o("manhole_open", 0.55, 0.5, "hazard"),
        o("manhole_open", 0.82, 0.92, "hazard"),
        o("tree", 0.36, 0.38, "safe"),
        o("bench", 0.68, 0.9, "safe"),
        o("pigeon", 0.42, 0.9, "decor"),
      ],
      time_limit_s: 6,
      oops_mn: "Ой! Нүх рүү унах шахлаа!",
      lesson_id: "city_open_manhole",
    },
  },
  {
    id: "city-03",
    title_mn: "Хоёр тийшээ хар",
    scene: {
      world: "city",
      backdrop_id: "city_crosswalk",
      mechanic: "tap_safe_choice",
      instruction_mn: "Зам гарахаас өмнө?",
      objects: [
        o("kid_hero", 0.1, 0.88, "decor"),
        o("kid_running", 0.3, 0.68, "option_wrong"),
        o("look_eyes", 0.5, 0.68, "option_correct"),
        o("phone", 0.7, 0.68, "option_wrong"),
      ],
      time_limit_s: 5,
      oops_mn: "Ой! Машин харсангүй!",
      lesson_id: "traffic_look_both_ways",
    },
  },
  {
    id: "city-04",
    title_mn: "Бөмбөг зам дээр",
    scene: {
      world: "city",
      backdrop_id: "city_street",
      mechanic: "drag_to_fix",
      instruction_mn: "Тоглоомын талбай руу!",
      objects: [
        o("ball", 0.62, 0.66, "decor"),
        o("kid_hero", 0.46, 0.68, "draggable"),
        o("truck", 0.88, 0.68, "hazard"),
        o("playground_zone", 0.16, 0.86, "target"),
      ],
      time_limit_s: 5,
      oops_mn: "Ой! Ачааны машин ирж байна!",
      lesson_id: "traffic_no_play_road",
    },
  },
  {
    id: "city-05",
    title_mn: "Унжсан мөс",
    scene: {
      world: "city",
      backdrop_id: "city_winter_sidewalk",
      mechanic: "tap_hazards",
      instruction_mn: "Унжсан мөсийг ол!",
      objects: [
        o("icicle", 0.12, 0.17, "hazard"),
        o("icicle", 0.45, 0.27, "hazard"),
        o("icicle", 0.82, 0.14, "hazard"),
        o("snowman", 0.3, 0.78, "safe"),
        o("tree", 0.7, 0.72, "safe"),
        o("kid_hero", 0.52, 0.76, "decor"),
      ],
      time_limit_s: 6,
      oops_mn: "Ой! Дээврээс мөс унав!",
      lesson_id: "city_falling_ice",
    },
  },
  {
    id: "city-06",
    title_mn: "Танихгүй хүн",
    scene: {
      world: "city",
      backdrop_id: "city_courtyard",
      mechanic: "tap_safe_choice",
      instruction_mn: "Танихгүй хүн дуудвал?",
      objects: [
        o("stranger", 0.86, 0.66, "decor"),
        o("candy", 0.22, 0.72, "option_wrong"),
        o("stranger_car", 0.44, 0.72, "option_wrong"),
        o("mom", 0.66, 0.72, "option_correct"),
      ],
      time_limit_s: 5,
      oops_mn: "Ой! Танихгүй хүнтэй бүү яв!",
      lesson_id: "city_stranger_danger",
    },
  },
  {
    id: "city-07",
    title_mn: "Барилгын талбай",
    scene: {
      world: "city",
      backdrop_id: "city_construction",
      mechanic: "drag_to_fix",
      instruction_mn: "Барилгаас гарга!",
      objects: [
        o("crane", 0.72, 0.36, "decor"),
        o("kid_hero", 0.62, 0.74, "draggable"),
        o("bricks", 0.82, 0.8, "hazard"),
        o("bricks", 0.5, 0.88, "hazard"),
        o("cone", 0.34, 0.86, "decor"),
        o("safe_zone", 0.14, 0.78, "target"),
      ],
      time_limit_s: 5,
      oops_mn: "Ой! Энд тоглож болохгүй!",
      lesson_id: "city_construction_zone",
    },
  },
  {
    id: "city-08",
    title_mn: "Золбин нохой",
    scene: {
      world: "city",
      backdrop_id: "city_street",
      mechanic: "tap_hazards",
      instruction_mn: "Золбин нохойг ол!",
      objects: [
        o("dog_stray", 0.14, 0.9, "hazard"),
        o("dog_stray", 0.6, 0.48, "hazard"),
        o("dog_stray", 0.86, 0.9, "hazard"),
        o("pigeon", 0.4, 0.9, "safe"),
        o("tree", 0.28, 0.38, "safe"),
        o("shop", 0.8, 0.34, "decor"),
      ],
      time_limit_s: 6,
      oops_mn: "Ой! Нохой хуцаж байна!",
      lesson_id: "city_stray_dogs",
    },
  },
  {
    id: "city-09",
    title_mn: "Дугуйн дуулга",
    scene: {
      world: "city",
      backdrop_id: "city_park",
      mechanic: "drag_to_fix",
      instruction_mn: "Дуулгаа өмс!",
      objects: [
        o("bicycle", 0.66, 0.74, "decor"),
        o("kid_hero", 0.5, 0.66, "decor"),
        o("wear_zone", 0.5, 0.5, "target"),
        o("bike_helmet", 0.16, 0.84, "draggable"),
      ],
      time_limit_s: 6,
      oops_mn: "Ой! Толгойгоо хамгаал!",
      lesson_id: "city_bike_helmet",
    },
  },
  {
    id: "city-10",
    title_mn: "Мөстэй зам",
    scene: {
      world: "city",
      backdrop_id: "city_winter_sidewalk",
      mechanic: "tap_safe_choice",
      instruction_mn: "Мөстэй зам дээр?",
      objects: [
        o("ice_skate", 0.28, 0.72, "option_wrong"),
        o("penguin_walk", 0.5, 0.72, "option_correct"),
        o("kid_running", 0.72, 0.72, "option_wrong"),
      ],
      time_limit_s: 5,
      oops_mn: "Ой! Хальтирч унах шахлаа!",
      lesson_id: "city_icy_sidewalk",
    },
  },
  {
    id: "city-11",
    title_mn: "Цахилгаан",
    scene: {
      world: "city",
      backdrop_id: "city_courtyard",
      mechanic: "tap_hazards",
      instruction_mn: "Цахилгааны аюулыг ол!",
      objects: [
        o("electric_box", 0.12, 0.62, "hazard"),
        o("loose_wire", 0.62, 0.86, "hazard"),
        o("slide", 0.36, 0.72, "safe"),
        o("ball", 0.84, 0.82, "safe"),
        o("bench", 0.84, 0.6, "decor"),
      ],
      time_limit_s: 5,
      oops_mn: "Ой! Цахилгаанд цохиулах шахлаа!",
      lesson_id: "city_electric_box",
    },
  },
  {
    id: "city-12",
    title_mn: "Төөрчихлөө",
    scene: {
      world: "city",
      backdrop_id: "city_park",
      mechanic: "drag_to_fix",
      instruction_mn: "Цагдаагаас тусламж хүс!",
      objects: [
        o("tree", 0.12, 0.42, "decor"),
        o("kid_hero", 0.46, 0.72, "draggable"),
        o("stranger_car", 0.16, 0.86, "hazard"),
        o("help_zone", 0.82, 0.78, "target"),
        o("police_officer", 0.82, 0.76, "decor"),
      ],
      time_limit_s: 5,
      oops_mn: "Ой! Танихгүй машинд бүү суу!",
      lesson_id: "city_lost_parent",
    },
  },
  {
    id: "city-13",
    title_mn: "Утсаа хурааж ав",
    scene: {
      world: "city",
      backdrop_id: "city_crosswalk",
      mechanic: "tap_safe_choice",
      instruction_mn: "Зам гарахдаа утсаа?",
      objects: [
        o("phone", 0.28, 0.68, "option_wrong"),
        o("headphones", 0.5, 0.68, "option_wrong"),
        o("backpack", 0.72, 0.68, "option_correct"),
      ],
      time_limit_s: 5,
      oops_mn: "Ой! Утас харж байгаад машин анзаарсангүй!",
      lesson_id: "traffic_no_phone_crossing",
    },
  },
  {
    id: "city-14",
    title_mn: "Машины ард",
    scene: {
      world: "city",
      backdrop_id: "city_parking",
      mechanic: "drag_to_fix",
      instruction_mn: "Машины араас холдуул!",
      objects: [
        o("car_red", 0.55, 0.55, "hazard"),
        o("taxi", 0.82, 0.55, "hazard"),
        o("kid_hero", 0.55, 0.82, "draggable"),
        o("sidewalk_zone", 0.13, 0.88, "target"),
      ],
      time_limit_s: 5,
      oops_mn: "Ой! Жолооч чамайг хараагүй!",
      lesson_id: "traffic_behind_car",
    },
  },
];
