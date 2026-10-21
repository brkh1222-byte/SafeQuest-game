// SafeQuest held-out eval (spec §8).
//
//   npm run eval -- run --provider local [--variants a,b] [--limit 10] [--timeout 30000]
//                       [--review 15] [--seed 1] [--out dir] [--dry-run]
//   npm run eval -- score <results-dir> [--sheet filled.csv]
//   npm run eval -- check-leak <train.jsonl>
//
// `run` calls ONE provider directly for every variant: no fallback to another
// provider or to cached scenes. Cases run one at a time, variants interleaved,
// so latency is comparable and machine slowdowns hit every variant equally.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { VARIANTS, type Variant } from "@/game/generate/prompts";
import { providersFromEnv, type ModelRole, type ProviderConfig } from "@/game/generate/providers";
import { formatRequest } from "@/game/generate/request";
import { renderMarkdown, runCase, summarize, type CaseResult, type VariantSummary } from "@/eval/core";
import { HELDOUT } from "@/eval/heldout";
import { findLeaks } from "@/eval/leak";
import { applyReview, buildReviewSheet, type ReviewKeyEntry } from "@/eval/review";

try {
  process.loadEnvFile(".env.local");
} catch {
  // No .env.local: rely on the shell environment.
}

const ROLE: Record<Variant, ModelRole> = { base_naive: "base", base_fewshot: "base", finetuned: "finetuned" };

function fail(msg: string): never {
  console.error(`eval: ${msg}`);
  process.exit(1);
}

async function cmdRun(argv: string[]) {
  const { values } = parseArgs({
    args: argv,
    options: {
      provider: { type: "string" },
      variants: { type: "string", default: VARIANTS.join(",") },
      limit: { type: "string" },
      timeout: { type: "string", default: "30000" },
      review: { type: "string", default: "15" },
      seed: { type: "string", default: "1" },
      out: { type: "string" },
      "dry-run": { type: "boolean", default: false },
    },
  });

  const variants = values.variants.split(",").map((v) => v.trim()) as Variant[];
  for (const v of variants) if (!VARIANTS.includes(v)) fail(`unknown variant "${v}" (use ${VARIANTS.join(", ")})`);
  const cases = values.limit ? HELDOUT.slice(0, Number(values.limit)) : HELDOUT;

  if (values["dry-run"]) {
    for (const c of cases) console.log(`${c.id}\n${formatRequest(c.request)}\n`);
    console.log(`${cases.length} cases × ${variants.length} variants`);
    return;
  }

  const all = providersFromEnv();
  if (!all.length) fail("no provider configured. Set SQ_LOCAL_MODEL_* or SQ_HOSTED_* in .env.local (see .env.example)");
  let provider: ProviderConfig | undefined;
  if (values.provider) provider = all.find((p) => p.name === values.provider) ?? fail(`provider "${values.provider}" is not configured`);
  else if (all.length === 1) provider = all[0];
  else fail(`several providers configured; pick one with --provider ${all.map((p) => p.name).join("|")}`);
  provider = { ...provider, timeoutMs: Number(values.timeout) };

  const runnable = variants.filter((v) => {
    if (provider!.models[ROLE[v]]) return true;
    console.warn(`skipping ${v}: no ${ROLE[v]} model on ${provider!.name}`);
    return false;
  });
  if (!runnable.length) fail("nothing to run");

  const date = new Date().toISOString();
  const outDir = values.out ?? path.join("eval-results", `${date.replace(/[:.]/g, "-")}-${provider.name}`);
  await mkdir(outDir, { recursive: true });

  console.log(`provider ${provider.name} (${provider.url}) · ${cases.length} cases · ${runnable.join(", ")}`);
  const results: CaseResult[] = [];
  const total = cases.length * runnable.length;
  for (const c of cases) {
    for (const v of runnable) {
      const r = await runCase(c, v, provider, provider.models[ROLE[v]]!);
      results.push(r);
      const flag = r.playable ? "playable" : r.stage;
      console.log(`[${String(results.length).padStart(3)}/${total}] ${c.id} ${v.padEnd(13)} ${flag.padEnd(14)} ${(r.ms / 1000).toFixed(1)}s`);
    }
  }

  const summaries = summarize(results);
  const meta = { provider: `${provider.name} (${provider.url})`, date, cases: cases.length };
  const review = buildReviewSheet(results, Number(values.review), Number(values.seed));

  await writeFile(path.join(outDir, "results.jsonl"), results.map((r) => JSON.stringify(r)).join("\n") + "\n");
  await writeFile(path.join(outDir, "summary.json"), JSON.stringify({ meta, summaries }, null, 2));
  await writeFile(path.join(outDir, "summary.md"), renderMarkdown(summaries, meta));
  await writeFile(path.join(outDir, "review.csv"), review.csv);
  await writeFile(path.join(outDir, "review-key.json"), JSON.stringify(review.key, null, 2));

  console.log("\n" + renderMarkdown(summaries, meta));
  console.log(`wrote ${outDir}/ (results.jsonl, summary.md, summary.json, review.csv, review-key.json)`);
  console.log(`next: have a native speaker fill review.csv (don't open review-key.json), then: npm run eval -- score ${outDir}`);
}

async function cmdScore(argv: string[]) {
  const { values, positionals } = parseArgs({ args: argv, allowPositionals: true, options: { sheet: { type: "string" } } });
  const dir = positionals[0] ?? fail("usage: npm run eval -- score <results-dir> [--sheet filled.csv]");
  const read = (f: string) => readFile(f, "utf8").catch(() => fail(`cannot read ${f}`));

  const { meta, summaries } = JSON.parse(await read(path.join(dir, "summary.json"))) as { meta: { provider: string; date: string; cases: number }; summaries: VariantSummary[] };
  const key = JSON.parse(await read(path.join(dir, "review-key.json"))) as ReviewKeyEntry[];
  const scored = applyReview(summaries, key, await read(values.sheet ?? path.join(dir, "review.csv")));

  await writeFile(path.join(dir, "summary.json"), JSON.stringify({ meta, summaries: scored }, null, 2));
  await writeFile(path.join(dir, "summary.md"), renderMarkdown(scored, meta));
  console.log(renderMarkdown(scored, meta));
}

async function cmdCheckLeak(argv: string[]) {
  const file = argv[0] ?? fail("usage: npm run eval -- check-leak <train.jsonl>");
  const leaks = findLeaks(HELDOUT, await readFile(file, "utf8").catch(() => fail(`cannot read ${file}`)));
  if (!leaks.length) {
    console.log(`ok: none of the ${HELDOUT.length} held-out prompts appear in ${file}`);
    return;
  }
  for (const l of leaks) console.error(`LEAK ${l.caseId} at line ${l.line}: ${l.reason}`);
  fail(`${leaks.length} held-out prompt(s) found in training data. Remove those lines before training.`);
}

const [cmd = "run", ...rest] = process.argv.slice(2);
const commands: Record<string, (argv: string[]) => Promise<void>> = { run: cmdRun, score: cmdScore, "check-leak": cmdCheckLeak };
(commands[cmd] ?? (() => fail(`unknown command "${cmd}" (run | score | check-leak)`)))(rest).catch((e) => fail(e instanceof Error ? e.message : String(e)));
