import { describe, expect, it } from "vitest";
import { GAME_H, GAME_W } from "./constants";
import { MicroGame } from "./engine";
import type { Scene } from "./schema";

const base = { world: "city", backdrop_id: "city_street", instruction_mn: "Тест!", time_limit_s: 5, oops_mn: "Ой!", lesson_id: "traffic_wait_green" } as const;

const dragScene: Scene = {
  ...base,
  mechanic: "drag_to_fix",
  objects: [
    { sprite_id: "kid_hero", x: 0.5, y: 0.6, role: "draggable" },
    { sprite_id: "car_red", x: 0.8, y: 0.6, role: "hazard" },
    { sprite_id: "sidewalk_zone", x: 0.2, y: 0.88, role: "target" },
  ],
};

const tapScene: Scene = {
  ...base,
  mechanic: "tap_hazards",
  objects: [
    { sprite_id: "manhole_open", x: 0.2, y: 0.8, role: "hazard" },
    { sprite_id: "manhole_open", x: 0.5, y: 0.8, role: "hazard" },
    { sprite_id: "tree", x: 0.8, y: 0.5, role: "safe" },
    { sprite_id: "pigeon", x: 0.8, y: 0.9, role: "decor" },
  ],
};

const choiceScene: Scene = {
  ...base,
  mechanic: "tap_safe_choice",
  objects: [
    { sprite_id: "look_eyes", x: 0.3, y: 0.6, role: "option_correct" },
    { sprite_id: "phone", x: 0.7, y: 0.6, role: "option_wrong" },
  ],
};

const started = (scene: Scene) => {
  const g = new MicroGame(scene);
  g.start();
  return g;
};
const px = (x: number, y: number): [number, number] => [x * GAME_W, y * GAME_H];

describe("timer", () => {
  it("ignores input during intro", () => {
    const g = new MicroGame(tapScene);
    expect(g.tap(0)).toEqual({ kind: "ignored" });
  });

  it("loses on timeout", () => {
    const g = started(tapScene);
    g.tick(4999);
    expect(g.status).toBe("playing");
    g.tick(5);
    expect(g.result()).toMatchObject({ status: "lost", reason: "timeout", stars: 0 });
  });

  it("loses when time runs out mid-drag, and the late drop is ignored", () => {
    const g = started(dragScene);
    expect(g.canDrag(0)).toBe(true);
    g.tick(6000);
    expect(g.status).toBe("lost");
    expect(g.drop(0, ...px(0.2, 0.88))).toEqual({ kind: "ignored" });
  });
});

describe("drag_to_fix", () => {
  it("wins when the draggable lands in a target", () => {
    const g = started(dragScene);
    expect(g.drop(0, ...px(0.2, 0.88))).toEqual({ kind: "won", targetIndex: 2 });
    expect(g.result()?.stars).toBe(3);
  });

  it("returns the object when dropped on empty ground", () => {
    const g = started(dragScene);
    expect(g.drop(0, ...px(0.5, 0.3))).toEqual({ kind: "returned" });
    expect(g.status).toBe("playing");
  });

  it("loses when dropped on a hazard", () => {
    const g = started(dragScene);
    expect(g.drop(0, ...px(0.8, 0.6))).toMatchObject({ kind: "lost", reason: "hit_hazard", hazardIndex: 1 });
  });

  it("cannot drag non-draggables", () => {
    const g = started(dragScene);
    expect(g.canDrag(1)).toBe(false);
    expect(g.drop(1, ...px(0.2, 0.88))).toEqual({ kind: "ignored" });
  });

  it("needs every draggable placed", () => {
    const g = started({
      ...dragScene,
      objects: [...dragScene.objects, { sprite_id: "ball", x: 0.4, y: 0.4, role: "draggable" }],
    });
    expect(g.drop(0, ...px(0.2, 0.88))).toMatchObject({ kind: "placed", remaining: 1 });
    expect(g.canDrag(0)).toBe(false);
    expect(g.drop(3, ...px(0.2, 0.88))).toMatchObject({ kind: "won" });
  });
});

describe("tap_hazards", () => {
  it("wins after all hazards are found; repeat taps don't count", () => {
    const g = started(tapScene);
    expect(g.tap(0)).toEqual({ kind: "found", remaining: 1 });
    expect(g.tap(0)).toEqual({ kind: "ignored" });
    expect(g.tap(1)).toEqual({ kind: "won" });
  });

  it("loses when a safe object is tapped", () => {
    const g = started(tapScene);
    expect(g.tap(2)).toEqual({ kind: "lost", reason: "tapped_safe" });
  });

  it("ignores decor", () => {
    const g = started(tapScene);
    expect(g.tap(3)).toEqual({ kind: "ignored" });
    expect(g.status).toBe("playing");
  });
});

describe("tap_safe_choice", () => {
  it("wins on the correct option", () => {
    expect(started(choiceScene).tap(0)).toEqual({ kind: "won" });
  });

  it("loses on a wrong option, and a second tap after the end is ignored", () => {
    const g = started(choiceScene);
    expect(g.tap(1)).toEqual({ kind: "lost", reason: "wrong_choice" });
    expect(g.tap(0)).toEqual({ kind: "ignored" });
    expect(g.status).toBe("lost");
  });
});

describe("stars", () => {
  it.each([
    [1000, 3],
    [3000, 2],
    [4500, 1],
  ])("after %ims gives %i stars", (elapsed, stars) => {
    const g = started(choiceScene);
    g.tick(elapsed);
    g.tap(0);
    expect(g.result()?.stars).toBe(stars);
  });
});
