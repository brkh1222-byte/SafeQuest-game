# SafeQuest fine-tune dataset

- Scenes: 23 (23 seed, 0 expanded)
- Examples: 72 train, 0 val (split by scene)
- Avg requests per scene: 3.1
- Request styles: full cards 18, partial cards 31, free text 23
- Excluded: 0

⚠️ = fewer than 3 scenes. Expand more for these before training.

### By world

| | scenes |
|---|---|
| city | 14 |
| ger | 3 |
| steppe | 3 |
| home | 3 |

### By mechanic

| | scenes |
|---|---|
| drag_to_fix | 11 |
| tap_hazards | 6 |
| tap_safe_choice | 6 |

### By lesson

| | scenes |
|---|---|
| traffic_wait_green | 1 ⚠️ |
| traffic_use_crosswalk | 0 ⚠️ |
| traffic_look_both_ways | 1 ⚠️ |
| traffic_no_play_road | 1 ⚠️ |
| traffic_no_phone_crossing | 1 ⚠️ |
| traffic_behind_car | 1 ⚠️ |
| traffic_seatbelt | 0 ⚠️ |
| city_bike_helmet | 1 ⚠️ |
| city_open_manhole | 1 ⚠️ |
| city_construction_zone | 1 ⚠️ |
| city_falling_ice | 1 ⚠️ |
| city_icy_sidewalk | 1 ⚠️ |
| city_stranger_danger | 1 ⚠️ |
| city_stray_dogs | 1 ⚠️ |
| city_electric_box | 1 ⚠️ |
| city_lost_parent | 1 ⚠️ |
| ger_co_damper | 0 ⚠️ |
| ger_co_symptoms | 1 ⚠️ |
| ger_stove_hot | 0 ⚠️ |
| ger_hot_water | 1 ⚠️ |
| ger_matches | 0 ⚠️ |
| ger_cold_dress | 1 ⚠️ |
| steppe_thin_ice | 1 ⚠️ |
| steppe_horse_behind | 1 ⚠️ |
| steppe_guard_dog | 0 ⚠️ |
| steppe_lost | 0 ⚠️ |
| steppe_snowstorm | 1 ⚠️ |
| steppe_no_swim_alone | 0 ⚠️ |
| home_outlet | 1 ⚠️ |
| home_medicine | 1 ⚠️ |
| home_chemicals | 0 ⚠️ |
| home_window | 0 ⚠️ |
| home_sharp | 0 ⚠️ |
| home_hand_wash | 1 ⚠️ |

### Danger card × mechanic

| danger | drag_to_fix | tap_hazards | tap_safe_choice |
|---|---|---|---|
| traffic | 3 | 0 | 0 |
| manhole | 0 | 1 | 0 |
| falling_ice | 0 | 1 | 0 |
| stray_dog | 0 | 1 | 0 |
| stranger | 1 | 0 | 1 |
| construction | 1 | 0 | 0 |
| icy_road | 0 | 0 | 1 |
| electric | 0 | 2 | 0 |
| co_smoke | 1 | 1 | 0 |
| hot | 1 | 1 | 0 |
| cold | 1 | 0 | 0 |
| matches | 0 | 0 | 0 |
| thin_ice | 1 | 0 | 0 |
| horse | 1 | 0 | 0 |
| guard_dog | 0 | 0 | 0 |
| storm | 0 | 0 | 1 |
| medicine | 1 | 0 | 0 |
| chemicals | 0 | 0 | 0 |
| sharp | 0 | 0 | 0 |
| window | 0 | 0 | 0 |
| germs | 0 | 0 | 1 |
