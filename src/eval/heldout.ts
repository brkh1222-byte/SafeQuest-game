import type { GenerateRequest } from "@/game/generate/request";

// 50 held-out prompts (spec §7–8). These must NEVER appear in fine-tune
// training data. `npm run eval -- check-leak <train.jsonl>` verifies that.
// The mix mirrors how judges will ask on stage: full card combos, partial
// cards, and free Mongolian text (informal, lowercase, one with a typo).

export interface EvalCase {
  id: string;
  request: GenerateRequest;
}

const c = (id: string, request: GenerateRequest): EvalCase => ({ id, request });

export const HELDOUT: EvalCase[] = [
  // Place + danger + mechanic
  c("h01", { placeId: "city_parking", dangerId: "traffic", mechanic: "drag_to_fix" }),
  c("h02", { placeId: "city_courtyard", dangerId: "stranger", mechanic: "tap_safe_choice" }),
  c("h03", { placeId: "city_winter_sidewalk", dangerId: "falling_ice", mechanic: "tap_hazards" }),
  c("h04", { placeId: "city_construction", dangerId: "construction", mechanic: "drag_to_fix" }),
  c("h05", { placeId: "city_park", dangerId: "stray_dog", mechanic: "tap_safe_choice" }),
  c("h06", { placeId: "ger_inside", dangerId: "co_smoke", mechanic: "tap_safe_choice" }),
  c("h07", { placeId: "ger_inside", dangerId: "matches", mechanic: "tap_hazards" }),
  c("h08", { placeId: "ger_yard", dangerId: "cold", mechanic: "tap_safe_choice" }),
  c("h09", { placeId: "steppe_river", dangerId: "thin_ice", mechanic: "tap_hazards" }),
  c("h10", { placeId: "steppe_pasture", dangerId: "horse", mechanic: "tap_safe_choice" }),
  c("h11", { placeId: "home_kitchen", dangerId: "chemicals", mechanic: "drag_to_fix" }),
  c("h12", { placeId: "home_living_room", dangerId: "window", mechanic: "drag_to_fix" }),

  // Place + danger
  c("h13", { placeId: "city_street", dangerId: "traffic" }),
  c("h14", { placeId: "city_courtyard", dangerId: "electric" }),
  c("h15", { placeId: "city_park", dangerId: "stranger" }),
  c("h16", { placeId: "city_winter_sidewalk", dangerId: "icy_road" }),
  c("h17", { placeId: "ger_inside", dangerId: "hot" }),
  c("h18", { placeId: "ger_yard", dangerId: "co_smoke" }),
  c("h19", { placeId: "steppe_pasture", dangerId: "guard_dog" }),
  c("h20", { placeId: "steppe_pasture", dangerId: "storm" }),
  c("h21", { placeId: "steppe_river", dangerId: "thin_ice" }),
  c("h22", { placeId: "home_kitchen", dangerId: "sharp" }),
  c("h23", { placeId: "home_living_room", dangerId: "electric" }),
  c("h24", { placeId: "home_kitchen", dangerId: "germs" }),

  // Danger only (some with a mechanic)
  c("h25", { dangerId: "manhole" }),
  c("h26", { dangerId: "construction" }),
  c("h27", { dangerId: "matches" }),
  c("h28", { dangerId: "horse", mechanic: "drag_to_fix" }),
  c("h29", { dangerId: "medicine" }),
  c("h30", { dangerId: "window" }),
  c("h31", { dangerId: "cold", mechanic: "drag_to_fix" }),
  c("h32", { dangerId: "stray_dog", mechanic: "tap_hazards" }),

  // Free text only
  c("h33", { text: "Хүүхэд голын мөсөн дээр гулгаж байна" }),
  c("h34", { text: "Гэрт утаа их байна, толгой өвдөж байна" }),
  c("h35", { text: "Хүүхэд залгуурт хуруугаа хийх гэж байна" }),
  c("h36", { text: "Эмийг чихэр гэж бодоод идэх гэж байна" }),
  c("h37", { text: "Танихгүй хүн машиндаа суу гэж байна" }),
  c("h38", { text: "Морины ард зогсож байна" }),
  c("h39", { text: "Байрны хашаанд машин ухарч байна" }),
  c("h40", { text: "хөдөө цасан шуурга ирж байна" }),
  c("h41", { text: "хүүхэд цонхон дээр авирч байна" }),
  c("h42", { text: "нохой хуцаад хөөж байна" }),
  c("h43", { text: "буцалсан ус асгарах гээд байна" }),
  c("h44", { text: "хүйтэнд бээлийгүй гарах гэж байна" }),
  c("h45", { text: "мөстэи замаар гүйж байна" }), // deliberate typo: и for й
  c("h46", { text: "Цахилгааны утас тасарчихсан байна" }),

  // Cards + free text
  c("h47", { placeId: "steppe_river", text: "хүүхэд мөсөн дээр бөмбөг хөөж байна" }),
  c("h48", { placeId: "city_crosswalk", text: "гэрлэн дохио улаан байхад гүйх гэж байна" }),
  c("h49", { placeId: "home_kitchen", dangerId: "medicine", text: "эмийн шил шалан дээр унасан" }),
  c("h50", { placeId: "ger_inside", dangerId: "co_smoke", mechanic: "drag_to_fix", text: "шөнө унтахын өмнө" }),
];
