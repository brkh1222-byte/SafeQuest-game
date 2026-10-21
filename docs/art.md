# SafeQuest art guide

Art replaces the emoji placeholders one file at a time. No code changes are needed.

## How to add a sprite

1. Run `npm run sprites`. It lists every missing sprite with its exact file name and target height.
2. Save the file as `public/sprites/<sprite_id>.png` (or `.svg`), for example `public/sprites/car_red.png`.
3. Run `npm run sprites` again (it updates `src/game/registry/art-manifest.json`), then restart the dev server.

The game, the stage previews and the Judges' World all use the file automatically. Anything without a file keeps its emoji.

## Sprite rules

| | |
|---|---|
| Format | **PNG with transparent background**, or SVG with a `viewBox` |
| Size | Draw at the height `npm run sprites` prints (2× the on-screen size, so it stays sharp on phones). Width is free; the aspect ratio is kept. |
| Framing | Crop tight to the object. The game centers the sprite on its position. |
| Facing | Characters and vehicles face **right** by default. |
| Name | Exactly the sprite ID: `kid_hero.png`, not `Kid Hero.png` or `kid-hero.png`. A misnamed file is reported and ignored. |

Zones (`safe_zone`, `sidewalk_zone`, ...) are drawn by the game as colored rounded boxes. A file for a zone replaces only the small icon inside the box.

## Backdrops

`public/backdrops/<backdrop_id>.png|jpg|webp|svg`, **1920×1080** (landscape 16:9). Keep the ground line where the placeholder has it (about 45–55% from the top), because levels place objects on it. Leave the top ~15% calm: the instruction banner sits there.

## Style (keep it one game)

- Flat colors, thick dark outline (~6 px at 2× size), no gradients or textures.
- Friendly and cartoony, never scary: this game is for 5–12 year olds, and failures are "oops", not injuries.
- Mongolian setting: deel and modern clothes for the kid hero, ger, khashaa fence, UB apartment blocks, steppe, coal stove.
- Hazards should *read* as hazards at a glance (open manhole = dark hole with no lid, thin ice = cracks), because players have under 5 seconds.

## Mixing sources

CC0 packs (for example Kenney) are fine for generic objects. AI-generated images are fine for Mongolian-specific items. Before adding either, recolor to the shared palette and add the outline, so nothing looks pasted in from another game.

## Known limitation

Phaser 4 renders SVG textures as black boxes under WebGL. The game works around this by rasterizing SVGs in the browser first (`src/game/phaser/rasterize.ts`). If an SVG still shows up black, export it as PNG instead.
