import { GAME_H, GAME_W } from "./constants";
import { SPRITE_BY_ID } from "./registry/sprites";
import type { Scene, SceneObject } from "./schema";

// Converts normalized scene objects into pixel-space bodies. Used by both the
// pure engine (hit tests) and the Phaser renderer, so they always agree.

export interface Body {
  index: number;
  obj: SceneObject;
  x: number;
  y: number;
  /** Circle hit radius for sprites. */
  r: number;
  /** Rectangle for zones (centered on x/y). */
  rect?: { w: number; h: number };
}

export function bodyOf(obj: SceneObject, index: number): Body {
  const def = SPRITE_BY_ID.get(obj.sprite_id);
  const size = def?.size ?? 0.15;
  const body: Body = { index, obj, x: obj.x * GAME_W, y: obj.y * GAME_H, r: (size * GAME_H) / 2 };
  if (def?.zone) body.rect = { w: def.zone.w * GAME_W, h: def.zone.h * GAME_H };
  return body;
}

export const bodiesOf = (scene: Scene): Body[] => scene.objects.map(bodyOf);

export function containsPoint(body: Body, px: number, py: number): boolean {
  if (body.rect) {
    return Math.abs(px - body.x) <= body.rect.w / 2 && Math.abs(py - body.y) <= body.rect.h / 2;
  }
  return Math.hypot(px - body.x, py - body.y) <= body.r;
}

/** Static playability checks beyond the schema (used by the eval script too). */
export function playabilityIssues(scene: Scene): string[] {
  const issues: string[] = [];
  const bodies = bodiesOf(scene);
  const interactive = bodies.filter((b) => b.obj.role !== "decor" && b.obj.role !== "target");

  for (const b of bodies) {
    const halfW = b.rect ? b.rect.w / 2 : b.r * 0.6;
    const halfH = b.rect ? b.rect.h / 2 : b.r * 0.6;
    if (b.x - halfW < 0 || b.x + halfW > GAME_W || b.y - halfH < 0 || b.y + halfH > GAME_H) {
      issues.push(`object ${b.index} (${b.obj.sprite_id}) is cut off by the screen edge`);
    }
  }

  for (let i = 0; i < interactive.length; i++) {
    for (let j = i + 1; j < interactive.length; j++) {
      const a = interactive[i];
      const c = interactive[j];
      if (Math.hypot(a.x - c.x, a.y - c.y) < (a.r + c.r) * 0.7) {
        issues.push(`objects ${a.index} and ${c.index} overlap too much to tap`);
      }
    }
  }

  if (scene.mechanic === "drag_to_fix") {
    for (const d of bodies.filter((b) => b.obj.role === "draggable")) {
      if (bodies.some((t) => t.obj.role === "target" && containsPoint(t, d.x, d.y))) {
        issues.push(`draggable ${d.index} already starts inside a target`);
      }
    }
  }
  return issues;
}
