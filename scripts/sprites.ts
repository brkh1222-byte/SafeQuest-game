// Art checklist + manifest (see docs/art.md).
//
//   npm run sprites            scan public/sprites + public/backdrops, write the manifest, print what's missing
//   npm run sprites -- --check also exit 1 on misnamed or unreadable files (for CI)

import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { WORLDS } from "@/game/constants";
import { buildArtManifest, pngSize, svgSize, targetHeightPx, type ArtFile } from "@/game/registry/art";
import { SPRITES } from "@/game/registry/sprites";

const MANIFEST = "src/game/registry/art-manifest.json";

async function scan(dir: ArtFile["dir"]): Promise<ArtFile[]> {
  const abs = path.join("public", dir);
  await mkdir(abs, { recursive: true });
  const names = (await readdir(abs)).filter((n) => !n.startsWith(".") && n.includes(".") && !n.toLowerCase().endsWith(".md"));
  return Promise.all(
    names.map(async (name) => {
      if (dir === "backdrops") return { dir, name };
      const file = path.join(abs, name);
      const size = name.toLowerCase().endsWith(".svg") ? svgSize(await readFile(file, "utf8")) : pngSize(await readFile(file));
      return { dir, name, ...(size ?? {}) };
    }),
  );
}

async function main() {
  const report = buildArtManifest([...(await scan("sprites")), ...(await scan("backdrops"))]);
  await writeFile(MANIFEST, JSON.stringify(report.manifest, null, 2) + "\n");

  const done = SPRITES.length - report.missingSprites.length;
  console.log(`sprites:   ${done}/${SPRITES.length} have art`);
  console.log(`backdrops: ${Object.keys(report.manifest.backdrops).length}/${Object.keys(report.manifest.backdrops).length + report.missingBackdrops.length} have art\n`);

  for (const world of [...WORLDS, "any"] as const) {
    const missing = report.missingSprites.filter((s) => s.world === world);
    if (!missing.length) continue;
    console.log(`${world}: ${missing.length} missing`);
    for (const s of missing) console.log(`  ${s.emoji}  ${s.id}.png  (${s.label_mn}, draw ~${targetHeightPx(s)}px tall${s.kind === "zone" ? ", zone icon" : ""})`);
  }
  if (report.missingBackdrops.length) console.log(`\nbackdrops missing (1920×1080): ${report.missingBackdrops.join(", ")}`);

  for (const f of report.unknown) console.warn(`\n⚠️  ${f} matches no sprite/backdrop id (typo?). It is ignored.`);
  for (const f of report.invalid) console.warn(`⚠️  ${f}: unsupported format or unreadable size (sprites: .png or .svg with a viewBox)`);
  console.log(`\nwrote ${MANIFEST}. Restart the dev server to pick it up.`);

  if (process.argv.includes("--check") && (report.unknown.length || report.invalid.length)) process.exit(1);
}

main().catch((e) => {
  console.error(`sprites: ${e instanceof Error ? e.message : e}`);
  process.exit(1);
});
