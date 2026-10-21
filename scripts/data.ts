// SafeQuest fine-tune dataset pipeline (spec §7).
//
//   npm run data -- status
//   npm run data -- expand [--calls 10] [--per-call 4] [--concurrency 3] [--effort high] [--model claude-opus-5-5] [--seed N]
//   npm run data -- review-sheet                 → data/review.csv (pending expanded scenes)
//   npm run data -- apply-review [data/review.csv]
//   npm run data -- build [--val 0.1] [--include-unreviewed] [--seed 1]
//
// Files under data/:
//   candidates.jsonl  vetted expanded scenes (seeds are rebuilt from code every run)
//   rejected.jsonl    what the vetting threw out, with reasons
//   raw/<batch>.jsonl every raw model reply, for auditing
//   reviews.json      human decisions and text fixes
//   out/              train.jsonl, val.jsonl, stats.md

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { buildDataset, buildReviewSheet, parseReviewSheet } from "@/data/build";
import type { Candidate } from "@/data/candidate";
import { claudeComplete, DEFAULT_EXPAND_MODEL } from "@/data/claude";
import { dataPaths, loadSeeds, readJsonl, readReviews, runExpansion } from "@/data/run";

try {
  process.loadEnvFile(".env.local");
} catch {
  // No .env.local: rely on the shell environment.
}

const DIR = "data";
const FILES = dataPaths(DIR);

function fail(msg: string): never {
  console.error(`data: ${msg}`);
  process.exit(1);
}

async function cmdStatus() {
  const seeds = loadSeeds();
  const expanded = await readJsonl<Candidate>(FILES.candidates);
  const rejected = await readJsonl<unknown>(FILES.rejected);
  const reviews = await readReviews(FILES.reviews);
  const decided = expanded.filter((c) => reviews[c.id]);
  console.log(`seeds:     ${seeds.length} scenes, ${seeds.reduce((n, c) => n + c.requests.length, 0)} requests`);
  console.log(`expanded:  ${expanded.length} scenes, ${expanded.reduce((n, c) => n + c.requests.length, 0)} requests`);
  console.log(`rejected:  ${rejected.length} by automatic vetting`);
  console.log(`reviewed:  ${decided.length}/${expanded.length} (${decided.filter((c) => reviews[c.id].approve).length} approved)`);
}

async function cmdExpand(argv: string[]) {
  const { values } = parseArgs({
    args: argv,
    options: {
      calls: { type: "string", default: "10" },
      "per-call": { type: "string", default: "4" },
      concurrency: { type: "string", default: "3" },
      model: { type: "string", default: DEFAULT_EXPAND_MODEL },
      effort: { type: "string", default: "high" },
      seed: { type: "string" },
    },
  });
  const effort = values.effort as Parameters<typeof claudeComplete>[0]["effort"];
  if (!["low", "medium", "high", "xhigh", "max"].includes(effort)) fail(`bad --effort ${values.effort}`);

  console.log(`expanding: ${values.calls} calls × ${values["per-call"]} scenes · ${values.model} effort=${effort}`);
  const s = await runExpansion(claudeComplete({ model: values.model, effort }), {
    dir: DIR,
    calls: Number(values.calls),
    perCall: Number(values["per-call"]),
    concurrency: Number(values.concurrency),
    seed: values.seed ? Number(values.seed) : Date.now() % 1e9,
  });
  console.log(`\nbatch ${s.batch}: accepted ${s.accepted}, rejected ${s.rejected}, failed calls ${s.failedCalls}`);
  console.log(`tokens in ${s.tokensIn.toLocaleString()} / out ${s.tokensOut.toLocaleString()}`);
  console.log(`rejection reasons: ${FILES.rejected} · raw replies: ${FILES.raw}/${s.batch}.jsonl · next: npm run data -- review-sheet`);
}

async function cmdReviewSheet() {
  const expanded = await readJsonl<Candidate>(FILES.candidates);
  const { csv, rows } = buildReviewSheet(expanded, await readReviews(FILES.reviews));
  await mkdir(DIR, { recursive: true });
  await writeFile(FILES.sheet, csv);
  console.log(`wrote ${FILES.sheet} with ${rows} pending scenes.`);
  console.log("Reviewer: mark approve y/n; fix Mongolian in the fix_* columns if needed; then: npm run data -- apply-review");
}

async function cmdApplyReview(argv: string[]) {
  const file = argv[0] ?? FILES.sheet;
  const decisions = parseReviewSheet(await readFile(file, "utf8").catch(() => fail(`cannot read ${file}`)));
  const merged = { ...(await readReviews(FILES.reviews)), ...decisions };
  await writeFile(FILES.reviews, JSON.stringify(merged, null, 2));
  const n = Object.keys(decisions).length;
  console.log(`recorded ${n} decisions (${Object.values(decisions).filter((d) => d.approve).length} approved) → ${FILES.reviews}`);
}

async function cmdBuild(argv: string[]) {
  const { values } = parseArgs({
    args: argv,
    options: {
      val: { type: "string", default: "0.1" },
      "include-unreviewed": { type: "boolean", default: false },
      seed: { type: "string", default: "1" },
    },
  });
  const result = buildDataset(loadSeeds(), await readJsonl<Candidate>(FILES.candidates), await readReviews(FILES.reviews), {
    valFraction: Number(values.val),
    includeUnreviewed: values["include-unreviewed"],
    seed: Number(values.seed),
  });
  if (result.leaks.length) {
    for (const l of result.leaks) console.error(`LEAK held-out ${l.caseId}: ${l.reason}`);
    fail("held-out prompts leaked into the dataset; nothing written");
  }
  await mkdir(FILES.out, { recursive: true });
  await writeFile(path.join(FILES.out, "train.jsonl"), result.train);
  await writeFile(path.join(FILES.out, "val.jsonl"), result.val);
  await writeFile(path.join(FILES.out, "stats.md"), result.stats);
  console.log(result.stats);
  console.log(`wrote ${FILES.out}/train.jsonl (${result.counts.trainExamples}), val.jsonl (${result.counts.valExamples}), stats.md`);
  const pending = result.excluded.filter((e) => e.reason === "not reviewed yet").length;
  if (pending) console.log(`${pending} expanded scenes are waiting for review (use --include-unreviewed only for a throwaway test run)`);
}

const [cmd = "status", ...rest] = process.argv.slice(2);
const commands: Record<string, (argv: string[]) => Promise<void>> = {
  status: cmdStatus,
  expand: cmdExpand,
  "review-sheet": cmdReviewSheet,
  "apply-review": cmdApplyReview,
  build: cmdBuild,
};
(commands[cmd] ?? (() => fail(`unknown command "${cmd}" (${Object.keys(commands).join(" | ")})`)))(rest).catch((e) =>
  fail(e instanceof Error ? e.message : String(e)),
);
