import type { World } from "../constants";

// The vetted lesson bank. The model may only pick a `lesson_id`; it never
// writes lesson text, so it cannot teach a child a wrong safety rule.
//
// STATUS: draft wording. Every entry must be checked by a native speaker and
// against NEMA / Red Cross Mongolia / UNICEF material before the demo, and
// `source` filled in.

export interface LessonDef {
  id: string;
  world: World | "any";
  text_mn: string;
  /** English gloss for the team and judges. */
  text_en: string;
  source?: string;
}

const l = (id: string, world: LessonDef["world"], text_mn: string, text_en: string): LessonDef => ({ id, world, text_mn, text_en });

export const LESSONS: LessonDef[] = [
  // City / traffic
  l("traffic_wait_green", "city", "Ногоон гэрэл асахыг хүлээгээд замаа гар.", "Wait for the green light before crossing."),
  l("traffic_use_crosswalk", "city", "Замыг зөвхөн явган хүний гарцаар гар.", "Only cross at a pedestrian crossing."),
  l("traffic_look_both_ways", "city", "Зам гарахаасаа өмнө зүүн, баруун тийшээ сайн хар.", "Look left and right before crossing."),
  l("traffic_no_play_road", "city", "Зам дээр бүү тогло. Бөмбөг зам руу өнхөрвөл том хүнд хэл.", "Never play on the road. If your ball rolls into the road, tell an adult."),
  l("traffic_no_phone_crossing", "city", "Зам гарахдаа утсаа цүнхэндээ хий, эргэн тойрноо хар.", "Put your phone away and watch around you when crossing."),
  l("traffic_behind_car", "city", "Машины ард бүү тогло. Жолооч чамайг харахгүй байж магадгүй.", "Don't play behind cars. The driver may not see you."),
  l("traffic_seatbelt", "city", "Машинд суухдаа хамгаалах бүсээ заавал зүү.", "Always wear a seatbelt in the car."),
  l("city_bike_helmet", "city", "Дугуй унахдаа заавал дуулга өмс.", "Always wear a helmet on a bike."),
  l("city_open_manhole", "city", "Задгай худгаас хол бай. Харвал том хүнд хэл.", "Stay away from open manholes. Tell an adult if you see one."),
  l("city_construction_zone", "city", "Барилгын талбай тоглох газар биш. Хаалтаас бүү давж ор.", "Construction sites are not for playing. Don't go past the fence."),
  l("city_falling_ice", "city", "Хаврын гэсгээр дээврээс мөс унадаг. Барилгын ханаас зайдуу алх.", "Ice falls from roofs during the thaw. Walk away from building walls."),
  l("city_icy_sidewalk", "city", "Мөстэй замаар оцон шувуу шиг жижиг алхмаар, алгуур алх.", "On ice, walk slowly with small steps like a penguin."),
  l("city_stranger_danger", "city", "Танихгүй хүний машинд хэзээ ч бүү суу, чихэр нь бүү ав.", "Never get into a stranger's car or take their candy."),
  l("city_stray_dogs", "city", "Золбин нохойноос хол бай. Бүү гүй, бүү хашгир, алгуур холд.", "Keep away from stray dogs. Don't run or shout; back away slowly."),
  l("city_electric_box", "city", "Цахилгааны хайрцаг, тасарсан утсанд хэзээ ч бүү хүр.", "Never touch electrical boxes or fallen wires."),
  l("city_lost_parent", "city", "Төөрвөл цагдаа эсвэл дэлгүүрийн ажилтнаас тусламж хүс.", "If you're lost, ask a police officer or shop worker for help."),

  // Ger district
  l("ger_co_damper", "ger", "Нүүрс бүрэн шатаагүй байхад яндангийн хаалтыг бүү хаа.", "Don't close the chimney damper while coal is still burning."),
  l("ger_co_symptoms", "ger", "Толгой өвдөж, дотор муухайрвал гадаа гараад том хүнд хэл.", "If you get a headache or feel sick, go outside and tell an adult."),
  l("ger_stove_hot", "ger", "Халуун зуухнаас хол бай, бүү хүр.", "Stay away from the hot stove; don't touch it."),
  l("ger_hot_water", "ger", "Буцалсан ус, халуун цайнаас болгоомжил.", "Be careful with boiling water and hot tea."),
  l("ger_matches", "ger", "Шүдэнз, асаагууртай хэзээ ч бүү тогло.", "Never play with matches or lighters."),
  l("ger_cold_dress", "ger", "Хүйтэнд малгай, бээлий, ороолтоо заавал өмс.", "In the cold, always wear a hat, mittens and a scarf."),

  // Steppe
  l("steppe_thin_ice", "steppe", "Голын нимгэн мөсөн дээр бүү гар.", "Don't walk on thin river ice."),
  l("steppe_horse_behind", "steppe", "Морины ард бүү зогс. Морь өшиглөж магадгүй.", "Don't stand behind a horse. It may kick."),
  l("steppe_guard_dog", "steppe", "Айлд очвол «Нохой хорио!» гэж дуудаад хүлээ.", "At a herder's home, call 'Hold the dog!' and wait."),
  l("steppe_lost", "steppe", "Төөрвөл нэг газраа зогсоод хүлээ, хол бүү яв.", "If you're lost, stay in one place and wait."),
  l("steppe_snowstorm", "steppe", "Цасан шуурга ирж байвал гэртээ бай.", "Stay inside when a snowstorm is coming."),
  l("steppe_no_swim_alone", "steppe", "Том хүнгүйгээр усанд бүү ор.", "Never go into water without an adult."),

  // Home & health
  l("home_outlet", "home", "Цахилгааны залгуурт хуруу, төмөр юм бүү хий.", "Never put fingers or metal into a socket."),
  l("home_medicine", "home", "Эм бол чихэр биш. Том хүнээс асуулгүй бүү уу.", "Medicine is not candy. Don't take it without asking an adult."),
  l("home_chemicals", "home", "Цэвэрлэгээний бодисыг бүү уу, бүү үнэрлэ.", "Never drink or sniff cleaning products."),
  l("home_window", "home", "Цонх, тагтан дээр бүү авир.", "Never climb on windows or balconies."),
  l("home_sharp", "home", "Хутга, хайчаар бүү тогло.", "Don't play with knives or scissors."),
  l("home_hand_wash", "home", "Хоолны өмнө гараа савандаж угаа.", "Wash your hands with soap before eating."),
];

export const LESSON_BY_ID: ReadonlyMap<string, LessonDef> = new Map(LESSONS.map((x) => [x.id, x]));
