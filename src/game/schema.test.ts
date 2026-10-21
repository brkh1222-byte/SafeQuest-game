import { describe, expect, it } from "vitest";
import { playabilityIssues } from "./geometry";
import { LEVELS_BY_WORLD } from "./levels";
import { parseScene } from "./schema";

const valid = {
  world: "city",
  backdrop_id: "city_street",
  mechanic: "tap_safe_choice",
  instruction_mn: "Зөвийг сонго!",
  objects: [
    { sprite_id: "look_eyes", x: 0.3, y: 0.6, role: "option_correct" },
    { sprite_id: "phone", x: 0.7, y: 0.6, role: "option_wrong" },
  ],
  time_limit_s: 5,
  oops_mn: "Ой!",
  lesson_id: "traffic_look_both_ways",
};

const errorsFor = (patch: object) => {
  const r = parseScene({ ...valid, ...patch });
  return r.ok ? [] : r.errors;
};

describe("parseScene", () => {
  it("accepts a valid scene", () => {
    expect(parseScene(valid).ok).toBe(true);
  });

  it("rejects non-objects and missing fields", () => {
    expect(parseScene("not json").ok).toBe(false);
    expect(parseScene({ ...valid, lesson_id: undefined }).ok).toBe(false);
  });

  it("rejects unknown ids", () => {
    expect(errorsFor({ backdrop_id: "moon_base" }).join()).toMatch(/unknown backdrop_id/);
    expect(errorsFor({ lesson_id: "eat_snow" }).join()).toMatch(/unknown lesson_id/);
    expect(
      errorsFor({ objects: [...valid.objects, { sprite_id: "dragon", x: 0.5, y: 0.5, role: "decor" }] }).join(),
    ).toMatch(/unknown sprite_id/);
  });

  it("rejects lessons and sprites from another world", () => {
    expect(errorsFor({ lesson_id: "steppe_thin_ice" }).join()).toMatch(/belongs to world/);
    expect(
      errorsFor({ objects: [...valid.objects, { sprite_id: "horse", x: 0.5, y: 0.3, role: "decor" }] }).join(),
    ).toMatch(/belongs to world/);
  });

  it("rejects out-of-range coordinates", () => {
    expect(errorsFor({ objects: [{ ...valid.objects[0], x: 1.4 }, valid.objects[1]] }).length).toBeGreaterThan(0);
  });

  it("enforces mechanic role rules", () => {
    expect(errorsFor({ objects: [valid.objects[1]] }).join()).toMatch(/exactly one option_correct/);
    expect(errorsFor({ mechanic: "drag_to_fix" }).join()).toMatch(/not used by drag_to_fix/);
    expect(
      errorsFor({
        mechanic: "drag_to_fix",
        objects: [
          { sprite_id: "kid_hero", x: 0.5, y: 0.6, role: "draggable" },
          { sprite_id: "tree", x: 0.2, y: 0.6, role: "target" },
        ],
      }).join(),
    ).toMatch(/needs a zone sprite/);
  });

  it("rejects long instructions", () => {
    expect(errorsFor({ instruction_mn: "Нэг хоёр гурав дөрөв тав зургаа" }).join()).toMatch(/words/);
  });
});

describe("shipped levels", () => {
  const all = Object.values(LEVELS_BY_WORLD).flat();

  it("have unique ids", () => {
    expect(new Set(all.map((l) => l.id)).size).toBe(all.length);
  });

  it.each(all.map((l) => [l.id, l] as const))("%s is valid and playable", (_id, level) => {
    const parsed = parseScene(level.scene);
    expect(parsed.ok ? [] : parsed.errors).toEqual([]);
    expect(playabilityIssues(level.scene)).toEqual([]);
  });
});
