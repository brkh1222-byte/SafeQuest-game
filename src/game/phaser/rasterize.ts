import { GAME_H, GAME_W } from "../constants";
import { backdropArt, spriteArt, targetHeightPx } from "../registry/art";
import { SPRITE_BY_ID } from "../registry/sprites";
import type { Scene } from "../schema";

// Phaser 4's WebGL renderer draws SVG textures as solid black (both
// load.svg and load.image). The browser rasterizes SVG fine, so we draw each
// SVG onto a canvas at its target size first and hand Phaser the canvas.

export interface Rasterized {
  sprites: Map<string, HTMLCanvasElement>;
  backdrop?: HTMLCanvasElement;
}

async function toCanvas(src: string, width: number, height: number): Promise<HTMLCanvasElement | undefined> {
  try {
    const img = new Image();
    img.src = src;
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width));
    canvas.height = Math.max(1, Math.round(height));
    canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas;
  } catch {
    // Missing or broken file: the scene falls back to the emoji placeholder.
    return undefined;
  }
}

export async function rasterizeSvgArt(scene: Scene): Promise<Rasterized> {
  const out: Rasterized = { sprites: new Map() };
  const jobs = [...new Set(scene.objects.map((o) => o.sprite_id))].map(async (id) => {
    const art = spriteArt(id);
    const def = SPRITE_BY_ID.get(id);
    if (!art || !def || !art.src.endsWith(".svg")) return;
    const h = targetHeightPx(def);
    const canvas = await toCanvas(art.src, (h * art.w) / art.h, h);
    if (canvas) out.sprites.set(id, canvas);
  });
  const bd = backdropArt(scene.backdrop_id);
  if (bd?.src.endsWith(".svg")) {
    jobs.push(
      toCanvas(bd.src, GAME_W * 2, GAME_H * 2).then((c) => {
        out.backdrop = c;
      }),
    );
  }
  await Promise.all(jobs);
  return out;
}
