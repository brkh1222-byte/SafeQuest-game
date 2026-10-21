import * as Phaser from "phaser";
import { GAME_H, GAME_W } from "../constants";
import { MicroGame, type Result } from "../engine";
import { backdropArt, spriteArt } from "../registry/art";
import { BACKDROP_BY_ID, type BackdropLayer } from "../registry/backdrops";
import { SPRITE_BY_ID } from "../registry/sprites";
import type { Scene } from "../schema";
import type { Rasterized } from "./rasterize";

// Renders one micro-game. All rules live in MicroGame; this class only draws,
// maps input to engine calls, and plays feedback.

export interface MicroGameSceneData {
  scene: Scene;
  fontFamily: string;
  onEnd: (result: Result) => void;
  /** SVG art pre-rasterized by the caller (see rasterize.ts). */
  svgArt?: Rasterized;
}

const INTRO_MS = 900;

/** Emoji text until real art exists, then an image. Both scale from a stored base. */
type View = Phaser.GameObjects.Text | Phaser.GameObjects.Image;
const baseScale = (v: View): number => (v.getData("base") as number | undefined) ?? 1;
const spriteKey = (id: string) => `sprite:${id}`;
const BACKDROP_KEY = "backdrop";
const OUTRO_MS = 1300;

export class MicroGameScene extends Phaser.Scene {
  private data_!: MicroGameSceneData;
  private engine!: MicroGame;
  private views: View[] = [];
  private timerBar!: Phaser.GameObjects.Graphics;
  private hint?: Phaser.GameObjects.Text;
  private ended = false;

  constructor() {
    super("micro");
  }

  init(data: MicroGameSceneData) {
    this.data_ = data;
    this.engine = new MicroGame(data.scene);
    this.views = [];
    this.ended = false;
  }

  preload() {
    const { scene } = this.data_;
    const backdrop = backdropArt(scene.backdrop_id);
    if (backdrop && !backdrop.src.endsWith(".svg")) this.load.image(BACKDROP_KEY, backdrop.src);
    for (const id of new Set(scene.objects.map((o) => o.sprite_id))) {
      const art = spriteArt(id);
      if (art && !art.src.endsWith(".svg")) this.load.image(spriteKey(id), art.src);
    }
  }

  create() {
    const { scene, svgArt } = this.data_;
    // SVGs arrive as canvases; Phaser renders those correctly.
    svgArt?.sprites.forEach((canvas, id) => this.textures.addCanvas(spriteKey(id), canvas));
    if (svgArt?.backdrop) this.textures.addCanvas(BACKDROP_KEY, svgArt.backdrop);
    this.drawBackdrop(scene.backdrop_id);
    this.engine.bodies.forEach((body) => this.createObject(body.index));
    this.timerBar = this.add.graphics().setDepth(50);
    this.drawTimer();
    this.playIntro();
  }

  update(_time: number, delta: number) {
    if (this.ended) return;
    this.engine.tick(delta);
    this.drawTimer();
    if (this.engine.status === "lost") this.finish();
  }

  // ---------------------------------------------------------------- drawing

  private text(x: number, y: number, str: string, size: number, color = "#ffffff") {
    return this.add
      .text(x, y, str, { fontFamily: this.data_.fontFamily, fontSize: `${Math.round(size)}px`, color, align: "center" })
      .setOrigin(0.5)
      .setResolution(2);
  }

  /** Real art if loaded, else the emoji. Sized so its height is `height` px. */
  private spriteView(id: string, x: number, y: number, height: number): View {
    if (this.textures.exists(spriteKey(id))) {
      const img = this.add.image(x, y, spriteKey(id));
      const scale = height / img.height;
      return img.setScale(scale).setData("base", scale);
    }
    return this.text(x, y, SPRITE_BY_ID.get(id)?.emoji ?? "❓", height);
  }

  private drawBackdrop(id: string) {
    if (this.textures.exists(BACKDROP_KEY)) {
      this.add.image(GAME_W / 2, GAME_H / 2, BACKDROP_KEY).setDisplaySize(GAME_W, GAME_H);
      return;
    }
    const g = this.add.graphics();
    const layers: BackdropLayer[] = BACKDROP_BY_ID.get(id)?.layers ?? [{ type: "rect", x: 0, y: 0, w: 1, h: 1, color: 0x9ad7ff }];
    for (const l of layers) {
      g.fillStyle(l.color, 1);
      if (l.type === "rect") g.fillRect(l.x * GAME_W, l.y * GAME_H, l.w * GAME_W, l.h * GAME_H);
      else if (l.type === "circle") g.fillCircle(l.x * GAME_W, l.y * GAME_H, l.r * GAME_H);
      else {
        // Alternating stripes across the rect.
        const n = l.count * 2 - 1;
        for (let i = 0; i < n; i += 2) {
          if (l.vertical) g.fillRect((l.x + (l.w / n) * i) * GAME_W, l.y * GAME_H, (l.w / n) * GAME_W, l.h * GAME_H);
          else g.fillRect(l.x * GAME_W, (l.y + (l.h / n) * i) * GAME_H, l.w * GAME_W, (l.h / n) * GAME_H);
        }
      }
    }
  }

  private createObject(index: number) {
    const body = this.engine.bodies[index];
    const def = SPRITE_BY_ID.get(body.obj.sprite_id);
    const role = body.obj.role;

    if (body.rect && def?.zone) {
      const zone = this.add.graphics();
      zone.fillStyle(def.zone.color, 0.55);
      zone.lineStyle(4, 0xffffff, 0.9);
      const { w, h } = body.rect;
      zone.fillRoundedRect(body.x - w / 2, body.y - h / 2, w, h, 16);
      zone.strokeRoundedRect(body.x - w / 2, body.y - h / 2, w, h, 16);
      if (role === "target") {
        this.tweens.add({ targets: zone, alpha: { from: 1, to: 0.55 }, yoyo: true, repeat: -1, duration: 600 });
      }
      const label = this.text(body.x, body.y + h / 2 - 12, def.label_mn, 15, "#1b1b1b");
      const icon = this.spriteView(def.id, body.x, body.y - 6, Math.min(h * 0.5, 44));
      this.views[index] = icon;
      label.setDepth(1);
      return;
    }

    const view = this.spriteView(body.obj.sprite_id, body.x, body.y, (def?.size ?? 0.15) * GAME_H).setDepth(10 + body.y / GAME_H);
    this.views[index] = view;

    // Choice icons alone can be ambiguous (🐧 = "walk slowly"), so name them.
    if (def && role.startsWith("option")) {
      this.text(body.x, body.y + body.r + 18, def.label_mn, 20, "#ffffff").setStroke("#1b1b1b", 6).setDepth(11);
    }

    switch (def?.anim) {
      case "bob":
        this.tweens.add({ targets: view, y: body.y - 6, yoyo: true, repeat: -1, duration: 700, ease: "Sine.inOut" });
        break;
      case "pulse":
        this.tweens.add({ targets: view, scale: baseScale(view) * 1.08, yoyo: true, repeat: -1, duration: 500, ease: "Sine.inOut" });
        break;
      case "shake":
        this.tweens.add({ targets: view, angle: { from: -4, to: 4 }, yoyo: true, repeat: -1, duration: 220 });
        break;
    }

    if (role === "draggable") {
      view.setInteractive({ draggable: true, useHandCursor: true });
      view.on("dragstart", () => {
        if (!this.engine.canDrag(index)) return;
        this.clearHint();
        this.tweens.killTweensOf(view);
        view.setScale(baseScale(view) * 1.15).setDepth(40);
      });
      view.on("drag", (_p: Phaser.Input.Pointer, x: number, y: number) => {
        if (this.engine.canDrag(index)) view.setPosition(x, y);
      });
      view.on("dragend", () => this.onDrop(index));
    } else if (role !== "decor" && role !== "target") {
      view.setInteractive({ useHandCursor: true });
      view.on("pointerdown", () => this.onTap(index));
    }
  }

  private drawTimer() {
    const frac = this.engine.timeLeftMs / this.engine.totalMs;
    const w = GAME_W - 40;
    this.timerBar.clear();
    this.timerBar.fillStyle(0x000000, 0.35).fillRoundedRect(20, 10, w, 14, 7);
    const color = frac > 0.5 ? 0x5ad65a : frac > 0.2 ? 0xffc93c : 0xff5a5f;
    if (frac > 0) this.timerBar.fillStyle(color, 1).fillRoundedRect(20, 10, Math.max(14, w * frac), 14, 7);
  }

  // ------------------------------------------------------------ game flow

  private playIntro() {
    const { scene } = this.data_;
    const banner = this.add.container(GAME_W / 2, GAME_H / 2).setDepth(60);
    const label = this.text(0, 0, scene.instruction_mn, 52, "#ffffff").setStroke("#1b1b1b", 10);
    const bg = this.add.graphics();
    const bw = label.width + 60;
    bg.fillStyle(0xff7a00, 1).fillRoundedRect(-bw / 2, -46, bw, 92, 26);
    banner.add([bg, label]).setScale(0.2);

    this.tweens.chain({
      targets: banner,
      tweens: [
        { scale: 1, duration: 280, ease: "Back.out" },
        { scale: 1, duration: INTRO_MS - 280 },
        { y: 64, scale: 0.55, duration: 250, ease: "Sine.inOut" },
      ],
      onComplete: () => {
        this.engine.start();
        this.showHint();
      },
    });
  }

  private showHint() {
    const { scene } = this.data_;
    const bodies = this.engine.bodies;
    const hand = this.text(0, 0, "👆", 56).setDepth(70).setAlpha(0);
    this.hint = hand;

    if (scene.mechanic === "drag_to_fix") {
      const from = bodies.find((b) => b.obj.role === "draggable");
      const to = bodies.find((b) => b.obj.role === "target");
      if (!from || !to) return;
      hand.setPosition(from.x + 10, from.y + 40);
      this.tweens.chain({
        targets: hand,
        repeat: 1,
        tweens: [
          { alpha: 1, duration: 150 },
          { x: to.x + 10, y: to.y + 40, duration: 700, ease: "Sine.inOut" },
          { alpha: 0, duration: 150 },
          { x: from.x + 10, y: from.y + 40, duration: 0 },
        ],
        onComplete: () => this.clearHint(),
      });
    } else {
      // Show the gesture, not the answer: a tapping motion near the bottom.
      const options = bodies.filter((b) => b.obj.role.startsWith("option"));
      const xs = options.length ? options.map((b) => b.x) : [GAME_W * 0.5];
      const y = options.length ? options[0].y + 70 : GAME_H * 0.85;
      hand.setPosition(Math.min(...xs), y);
      this.tweens.chain({
        targets: hand,
        tweens: [
          { alpha: 1, duration: 150 },
          ...(options.length ? [{ x: Math.max(...xs), duration: 900, ease: "Sine.inOut" }] : []),
          { y: y - 16, yoyo: true, repeat: 2, duration: 180 },
          { alpha: 0, duration: 200 },
        ],
        onComplete: () => this.clearHint(),
      });
    }
  }

  private clearHint() {
    if (!this.hint) return;
    this.tweens.killTweensOf(this.hint);
    this.hint.destroy();
    this.hint = undefined;
  }

  private onTap(index: number) {
    this.clearHint();
    const view = this.views[index];
    const res = this.engine.tap(index);
    if (res.kind === "found" || (res.kind === "won" && this.data_.scene.mechanic === "tap_hazards")) {
      this.mark(view, "✅");
      this.tweens.add({ targets: view, scale: baseScale(view) * 0.8, duration: 150, yoyo: true });
    } else if (res.kind === "won") {
      this.mark(view, "✅");
    } else if (res.kind === "lost") {
      this.mark(view, "❌");
    }
    if (res.kind === "won" || res.kind === "lost") this.finish();
  }

  private onDrop(index: number) {
    const view = this.views[index];
    const body = this.engine.bodies[index];
    if (!view.input?.enabled) return;
    const res = this.engine.drop(index, view.x, view.y);
    view.setScale(baseScale(view)).setDepth(10 + view.y / GAME_H);

    if (res.kind === "returned" || res.kind === "ignored") {
      if (this.engine.status === "playing") {
        this.tweens.add({ targets: view, x: body.x, y: body.y, duration: 220, ease: "Back.out" });
      }
      return;
    }
    if (res.kind === "placed" || res.kind === "won") {
      const target = this.engine.bodies[res.targetIndex];
      view.disableInteractive();
      this.tweens.add({ targets: view, x: target.x, y: target.y - 6, duration: 160, ease: "Back.out" });
      this.mark(view, "✅", target.x + 40, target.y - 40);
      if (res.kind === "won") this.finish();
      return;
    }
    this.mark(this.views[res.hazardIndex], "💥");
    this.finish();
  }

  private mark(view: View | undefined, emoji: string, x?: number, y?: number) {
    if (!view) return;
    const m = this.text(x ?? view.x + view.displayWidth * 0.3, y ?? view.y - view.displayHeight * 0.3, emoji, 40).setDepth(80).setScale(0);
    this.tweens.add({ targets: m, scale: 1, duration: 220, ease: "Back.out" });
  }

  private finish() {
    if (this.ended) return;
    this.ended = true;
    this.clearHint();
    this.input.enabled = false;
    this.drawTimer();
    const result = this.engine.result();
    if (!result) return;

    const heroIndex = this.engine.bodies.find((b) => b.obj.sprite_id === "kid_hero")?.index;
    const hero = heroIndex === undefined ? undefined : this.views[heroIndex];

    if (result.status === "won") {
      this.celebrate();
      if (hero) this.tweens.add({ targets: hero, y: hero.y - 40, yoyo: true, repeat: 1, duration: 220, ease: "Quad.out" });
    } else {
      this.cameras.main.shake(300, 0.012);
      if (hero) {
        this.tweens.killTweensOf(hero);
        this.tweens.add({ targets: hero, angle: 360, duration: 700, ease: "Cubic.out" });
        this.text(hero.x, hero.y - hero.displayHeight * 0.6, "💫", 44).setDepth(80);
      }
      const label = this.text(GAME_W / 2, GAME_H / 2, "Ой!", 120, "#ffffff").setStroke("#d62828", 16).setDepth(90).setScale(0);
      this.tweens.add({ targets: label, scale: 1, duration: 300, ease: "Back.out" });
    }
    this.time.delayedCall(OUTRO_MS, () => this.data_.onEnd(result));
  }

  private celebrate() {
    const label = this.text(GAME_W / 2, GAME_H / 2, "Гоё!", 110, "#ffffff").setStroke("#2a9d8f", 16).setDepth(90).setScale(0);
    this.tweens.add({ targets: label, scale: 1, duration: 300, ease: "Back.out" });
    for (let i = 0; i < 18; i++) {
      const c = this.text(GAME_W / 2, GAME_H / 2, ["⭐", "🎉", "✨"][i % 3], 34).setDepth(85);
      const angle = (i / 18) * Math.PI * 2;
      this.tweens.add({
        targets: c,
        x: GAME_W / 2 + Math.cos(angle) * 320,
        y: GAME_H / 2 + Math.sin(angle) * 220,
        alpha: 0,
        duration: 900,
        ease: "Cubic.out",
      });
    }
  }
}
