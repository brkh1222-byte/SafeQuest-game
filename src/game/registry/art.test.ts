import { describe, expect, it } from "vitest";
import { GAME_H } from "../constants";
import { buildArtManifest, pngSize, svgSize, targetHeightPx } from "./art";
import { SPRITES } from "./sprites";

describe("buildArtManifest", () => {
  it("maps files to registry ids and lists what's missing", () => {
    const r = buildArtManifest([
      { dir: "sprites", name: "car_red.png", w: 400, h: 220 },
      { dir: "sprites", name: "kid_hero.svg", w: 100, h: 200 },
      { dir: "backdrops", name: "city_street.jpg" },
    ]);
    expect(r.manifest.sprites).toEqual({
      car_red: { src: "/sprites/car_red.png", w: 400, h: 220 },
      kid_hero: { src: "/sprites/kid_hero.svg", w: 100, h: 200 },
    });
    expect(r.manifest.backdrops).toEqual({ city_street: { src: "/backdrops/city_street.jpg" } });
    expect(r.missingSprites).toHaveLength(SPRITES.length - 2);
    expect(r.missingSprites.some((s) => s.id === "car_red")).toBe(false);
    expect(r.missingBackdrops).not.toContain("city_street");
  });

  it("flags typos and unusable files instead of loading them", () => {
    const r = buildArtManifest([
      { dir: "sprites", name: "car-red.png", w: 10, h: 10 },
      { dir: "sprites", name: "bus.gif", w: 10, h: 10 },
      { dir: "sprites", name: "taxi.svg" },
      { dir: "backdrops", name: "moon.png" },
    ]);
    expect(r.unknown).toEqual(["/sprites/car-red.png", "/backdrops/moon.png"]);
    expect(r.invalid).toEqual(["/sprites/bus.gif", "/sprites/taxi.svg"]);
    expect(r.manifest.sprites).toEqual({});
  });

  it("asks artists for 2× the on-screen height", () => {
    expect(targetHeightPx({ size: 0.2 })).toBe(Math.round(0.2 * GAME_H * 2));
  });
});

describe("image size readers", () => {
  it("reads PNG IHDR", () => {
    const buf = new Uint8Array(24);
    buf.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const v = new DataView(buf.buffer);
    v.setUint32(16, 432);
    v.setUint32(20, 300);
    expect(pngSize(buf)).toEqual({ w: 432, h: 300 });
    expect(pngSize(new Uint8Array(24))).toBeNull();
  });

  it("reads SVG viewBox, then width/height", () => {
    expect(svgSize('<?xml version="1.0"?><svg xmlns="x" viewBox="0 0 120.5 80">')).toEqual({ w: 120.5, h: 80 });
    expect(svgSize("<svg width='64' height=\"32\">")).toEqual({ w: 64, h: 32 });
    expect(svgSize("<svg>")).toBeNull();
  });
});
