// Fill src/game/generate/precomputed.json with fine-tuned outputs for every
// stage card combination (spec §7, timeline day 12).
//
//   npm run precache -- --provider local [--tries 2] [--limit 20] [--refresh] [--dry-run] [--out file.json]
//
// Resumable: existing entries are kept unless --refresh; progress is saved
// every 10 combos. Restart the dev server (or redeploy) to pick up new entries.

import { readFile, writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { runCase } from "@/eval/core";
import { cacheKey, cacheRejectReason, comboCase, stageCardCombos } from "@/data/precache";
import { providersFromEnv, type ProviderConfig } from "@/game/generate/providers";
import type { Scene } from "@/game/schema";

try {
  process.loadEnvFile(".env.local");
} catch {
  // No .env.local: rely on the shell environment.
}

const FILE = "src/game/generate/precomputed.json";

function fail(msg: string): never {
  console.error(`precache: ${msg}`);
  process.exit(1);
}

const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    provider: { type: "string" },
    tries: { type: "string", default: "2" },
    limit: { type: "string" },
    timeout: { type: "string", default: "30000" },
    refresh: { type: "boolean", default: false },
    "dry-run": { type: "boolean", default: false },
    out: { type: "string", default: FILE },
  },
});

async function main() {
  const combos = stageCardCombos();
  const cache = JSON.parse(await readFile(values.out, "utf8").catch(() => "{}")) as Record<string, Scene>;
  const todo = combos.filter((r) => values.refresh || !cache[cacheKey(r)]).slice(0, values.limit ? Number(values.limit) : undefined);

  console.log(`${combos.length} card combos · ${Object.keys(cache).length} cached · ${todo.length} to run`);
  if (values["dry-run"]) return;

  const all = providersFromEnv().filter((p) => p.models.finetuned);
  if (!all.length) fail("no fine-tuned model configured (SQ_LOCAL_MODEL_FT or SQ_HOSTED_MODEL_FT)");
  const chosen: ProviderConfig =
    (values.provider ? all.find((p) => p.name === values.provider) : all.length === 1 ? all[0] : undefined) ??
    fail(values.provider ? `provider "${values.provider}" has no fine-tuned model` : `pick one with --provider ${all.map((p) => p.name).join("|")}`);
  const provider = { ...chosen, timeoutMs: Number(values.timeout) };

  const save = () => writeFile(values.out, JSON.stringify(Object.fromEntries(Object.entries(cache).sort(([a], [b]) => a.localeCompare(b))), null, 1) + "\n");

  let added = 0;
  const missed: string[] = [];
  for (const [i, req] of todo.entries()) {
    let hit: Scene | undefined;
    let last = "";
    for (let t = 0; t < Number(values.tries) && !hit; t++) {
      const r = await runCase(comboCase(req, i), "finetuned", provider, provider.models.finetuned!);
      const reason = cacheRejectReason(r);
      if (reason === null) hit = r.scene;
      else last = reason;
    }
    const label = cacheKey(req).replace(/\n/g, " · ");
    if (hit) {
      cache[cacheKey(req)] = hit;
      added++;
      console.log(`[${i + 1}/${todo.length}] ok    ${label}`);
    } else {
      missed.push(label);
      console.log(`[${i + 1}/${todo.length}] miss  ${label} (${last})`);
    }
    if ((i + 1) % 10 === 0) await save();
  }
  await save();

  console.log(`\nadded ${added}, missed ${missed.length}, total cached ${Object.keys(cache).length}/${combos.length}`);
  if (missed.length) console.log("Missed combos fall back to the closest hand-built scene on stage. Consider more training data for them.");
}

main().catch((e) => fail(e instanceof Error ? e.message : String(e)));
