import { bodiesOf, containsPoint, type Body } from "./geometry";
import type { Scene } from "./schema";

// Pure win/lose logic for every mechanic. No rendering, no timers of its own:
// the caller drives it with tick(). Phaser and the eval script both use it.

export type Status = "intro" | "playing" | "won" | "lost";
export type LoseReason = "timeout" | "hit_hazard" | "tapped_safe" | "wrong_choice";

export type TapResult =
  | { kind: "ignored" }
  | { kind: "found"; remaining: number }
  | { kind: "won" }
  | { kind: "lost"; reason: LoseReason };

export type DropResult =
  | { kind: "ignored" }
  | { kind: "returned" }
  | { kind: "placed"; targetIndex: number; remaining: number }
  | { kind: "won"; targetIndex: number }
  | { kind: "lost"; reason: LoseReason; hazardIndex: number };

export interface Result {
  status: "won" | "lost";
  reason?: LoseReason;
  timeLeftMs: number;
  stars: 0 | 1 | 2 | 3;
}

export class MicroGame {
  readonly bodies: Body[];
  readonly totalMs: number;
  status: Status = "intro";
  timeLeftMs: number;
  reason?: LoseReason;
  /** Hazards found (tap_hazards) or draggables placed (drag_to_fix). */
  readonly done = new Set<number>();

  constructor(readonly scene: Scene) {
    this.bodies = bodiesOf(scene);
    this.totalMs = scene.time_limit_s * 1000;
    this.timeLeftMs = this.totalMs;
  }

  start(): void {
    if (this.status === "intro") this.status = "playing";
  }

  /** Advance the clock. Running out of time while mid-drag still loses. */
  tick(dtMs: number): void {
    if (this.status !== "playing") return;
    this.timeLeftMs = Math.max(0, this.timeLeftMs - dtMs);
    if (this.timeLeftMs === 0) this.lose("timeout");
  }

  tap(index: number): TapResult {
    const body = this.bodies[index];
    if (this.status !== "playing" || !body) return { kind: "ignored" };
    const role = body.obj.role;

    if (this.scene.mechanic === "tap_hazards") {
      if (role === "safe") return this.lose("tapped_safe");
      if (role !== "hazard" || this.done.has(index)) return { kind: "ignored" };
      this.done.add(index);
      const remaining = this.count("hazard") - this.done.size;
      if (remaining === 0) return this.win();
      return { kind: "found", remaining };
    }

    if (this.scene.mechanic === "tap_safe_choice") {
      if (role === "option_correct") return this.win();
      if (role === "option_wrong") return this.lose("wrong_choice");
    }
    return { kind: "ignored" };
  }

  /** Can this object be picked up right now? */
  canDrag(index: number): boolean {
    const body = this.bodies[index];
    return (
      this.status === "playing" &&
      this.scene.mechanic === "drag_to_fix" &&
      body?.obj.role === "draggable" &&
      !this.done.has(index)
    );
  }

  /** Drop a draggable at pixel position (px, py). */
  drop(index: number, px: number, py: number): DropResult {
    if (!this.canDrag(index)) return { kind: "ignored" };

    const target = this.bodies.find((b) => b.obj.role === "target" && containsPoint(b, px, py));
    if (target) {
      this.done.add(index);
      const remaining = this.count("draggable") - this.done.size;
      if (remaining === 0) {
        this.win();
        return { kind: "won", targetIndex: target.index };
      }
      return { kind: "placed", targetIndex: target.index, remaining };
    }

    const hazard = this.bodies.find((b) => b.obj.role === "hazard" && containsPoint(b, px, py));
    if (hazard) {
      this.lose("hit_hazard");
      return { kind: "lost", reason: "hit_hazard", hazardIndex: hazard.index };
    }
    return { kind: "returned" };
  }

  result(): Result | null {
    if (this.status !== "won" && this.status !== "lost") return null;
    return { status: this.status, reason: this.reason, timeLeftMs: this.timeLeftMs, stars: this.stars() };
  }

  private stars(): Result["stars"] {
    if (this.status !== "won") return 0;
    const frac = this.timeLeftMs / this.totalMs;
    if (frac >= 0.5) return 3;
    if (frac >= 0.2) return 2;
    return 1;
  }

  private count(role: Body["obj"]["role"]): number {
    return this.bodies.filter((b) => b.obj.role === role).length;
  }

  private win(): { kind: "won" } {
    this.status = "won";
    return { kind: "won" };
  }

  private lose(reason: LoseReason): { kind: "lost"; reason: LoseReason } {
    this.status = "lost";
    this.reason = reason;
    return { kind: "lost", reason };
  }
}
