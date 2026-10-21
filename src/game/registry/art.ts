import { GAME_H } from "../constants";
import manifest from "./art-manifest.json";
import { BACKDROPS } from "./backdrops";
import { SPRITES, type SpriteDef } from "./sprites";

// Real art, when it exists. `npm run sprites` scans public/sprites and
// public/backdrops and regenerates art-manifest.json; anything without a file
// keeps its emoji / drawn placeholder, so art can land one sprite at a time.

export interface SpriteArt {
  src: string;
  w: number;
  h: number;
}

export interface ArtManifest {
  sprites: Record<string, SpriteArt>;
  backdrops: Record<string, { src: string }>;
}

const ART = manifest as ArtManifest;

export const spriteArt = (id: string): SpriteArt | undefined => ART.sprites[id];
export const backdropArt = (id: string): { src: string } | undefined => ART.backdrops[id];

/** Pixel height an artist should draw at: 2× the on-screen height, for sharp phones. */
export const targetHeightPx = (def: Pick<SpriteDef, "size">) => Math.round(def.size * GAME_H * 2);

export const SPRITE_FORMATS = ["png", "svg"] as const;
export const BACKDROP_FORMATS = ["png", "jpg", "jpeg", "webp", "svg"] as const;

export interface ArtFile {
  dir: "sprites" | "backdrops";
  name: string;
  /** Intrinsic size; required for sprites. */
  w?: number;
  h?: number;
}

export interface ArtReport {
  manifest: ArtManifest;
  /** Files whose name matches no registry id (usually a typo). */
  unknown: string[];
  /** Sprite files with an unreadable size or unsupported format. */
  invalid: string[];
  missingSprites: SpriteDef[];
  missingBackdrops: string[];
}

/** Pure: turns a directory listing into the manifest plus a to-do list for artists. */
export function buildArtManifest(files: ArtFile[]): ArtReport {
  const spriteIds = new Set(SPRITES.map((s) => s.id));
  const backdropIds = new Set(BACKDROPS.map((b) => b.id));
  const out: ArtReport = { manifest: { sprites: {}, backdrops: {} }, unknown: [], invalid: [], missingSprites: [], missingBackdrops: [] };

  for (const f of [...files].sort((a, b) => a.name.localeCompare(b.name))) {
    const dot = f.name.lastIndexOf(".");
    const id = f.name.slice(0, dot);
    const ext = f.name.slice(dot + 1).toLowerCase();
    const src = `/${f.dir}/${f.name}`;
    if (f.dir === "sprites") {
      if (!spriteIds.has(id)) out.unknown.push(src);
      else if (!(SPRITE_FORMATS as readonly string[]).includes(ext) || !f.w || !f.h) out.invalid.push(src);
      else if (!out.manifest.sprites[id]) out.manifest.sprites[id] = { src, w: f.w, h: f.h };
    } else {
      if (!backdropIds.has(id)) out.unknown.push(src);
      else if (!(BACKDROP_FORMATS as readonly string[]).includes(ext)) out.invalid.push(src);
      else out.manifest.backdrops[id] ??= { src };
    }
  }
  out.missingSprites = SPRITES.filter((s) => !out.manifest.sprites[s.id]);
  out.missingBackdrops = BACKDROPS.filter((b) => !out.manifest.backdrops[b.id]).map((b) => b.id);
  return out;
}

/** PNG width/height from the IHDR chunk. */
export function pngSize(buf: Uint8Array): { w: number; h: number } | null {
  const sig = [0x89, 0x50, 0x4e, 0x47];
  if (buf.length < 24 || sig.some((b, i) => buf[i] !== b)) return null;
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  return { w: view.getUint32(16), h: view.getUint32(20) };
}

/** SVG size from viewBox, falling back to width/height attributes. */
export function svgSize(text: string): { w: number; h: number } | null {
  const tag = text.match(/<svg\b[^>]*>/i)?.[0];
  if (!tag) return null;
  const vb = tag.match(/viewBox\s*=\s*["']\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)/i);
  if (vb) return { w: Number(vb[1]), h: Number(vb[2]) };
  const w = tag.match(/\bwidth\s*=\s*["']([\d.]+)/i);
  const h = tag.match(/\bheight\s*=\s*["']([\d.]+)/i);
  return w && h ? { w: Number(w[1]), h: Number(h[1]) } : null;
}
