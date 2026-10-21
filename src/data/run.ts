import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { Review } from "./build";
import { seedCandidates, structuralKey, vetItem, type Candidate } from "./candidate";
import { EXPAND_SYSTEM, expandUserPrompt, parseExpansion, pickExamples, planTargets, type Complete, type Target } from "./expand";

// File layout and the expansion loop. The directory is a parameter so tests
// can run the whole loop against a temp dir and a fake model.

export function dataPaths(dir: string) {
  return {
    candidates: path.join(dir, "candidates.jsonl"),
    rejected: path.join(dir, "rejected.jsonl"),
    reviews: path.join(dir, "reviews.json"),
    sheet: path.join(dir, "review.csv"),
    raw: path.join(dir, "raw"),
    out: path.join(dir, "out"),
  };
}

export async function readJsonl<T>(file: string): Promise<T[]> {
  const text = await readFile(file, "utf8").catch(() => "");
  return text.split("\n").filter((l) => l.trim()).map((l) => JSON.parse(l) as T);
}

export const readReviews = async (file: string): Promise<Record<string, Review>> =>
  JSON.parse(await readFile(file, "utf8").catch(() => "{}")) as Record<string, Review>;

export function loadSeeds(log: (msg: string) => void = console.warn): Candidate[] {
  const { candidates, rejections } = seedCandidates();
  for (const r of rejections) log(`seed ${r.id} rejected: ${r.reasons.join("; ")}`);
  return candidates;
}

/** Runs async jobs with at most `limit` in flight. */
async function pool<T>(items: T[], limit: number, fn: (item: T, i: number) => Promise<void>) {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        await fn(items[i], i);
      }
    }),
  );
}

export interface ExpansionOptions {
  dir: string;
  calls: number;
  perCall: number;
  concurrency: number;
  seed: number;
  /** Defaults to a timestamp; tests pin it. */
  batch?: string;
  log?: (msg: string) => void;
}

export interface ExpansionSummary {
  batch: string;
  accepted: number;
  rejected: number;
  failedCalls: number;
  tokensIn: number;
  tokensOut: number;
}

export async function runExpansion(complete: Complete, o: ExpansionOptions): Promise<ExpansionSummary> {
  const log = o.log ?? console.log;
  const p = dataPaths(o.dir);
  const seeds = loadSeeds(log);
  const existing = await readJsonl<Candidate>(p.candidates);
  const seen = new Set([...seeds, ...existing].map((c) => structuralKey(c.scene)));
  const targets = planTargets([...seeds, ...existing], o.calls, o.seed);
  const batch = o.batch ?? new Date().toISOString().replace(/[-:]/g, "").replace(/\..*/, "");
  const rawFile = path.join(p.raw, `${batch}.jsonl`);
  await mkdir(p.raw, { recursive: true });

  const s: ExpansionSummary = { batch, accepted: 0, rejected: 0, failedCalls: 0, tokensIn: 0, tokensOut: 0 };

  await pool(targets, o.concurrency, async (target: Target, i) => {
    const user = expandUserPrompt(target, o.perCall, pickExamples(seeds, target));
    let text: string;
    try {
      const res = await complete(EXPAND_SYSTEM, user);
      text = res.text;
      s.tokensIn += res.inputTokens;
      s.tokensOut += res.outputTokens;
      await appendFile(rawFile, JSON.stringify({ batch, call: i, target, stopReason: res.stopReason, text }) + "\n");
      if (res.stopReason === "max_tokens") log(`call ${i}: hit max_tokens, reply may be truncated`);
    } catch (e) {
      s.failedCalls++;
      await appendFile(rawFile, JSON.stringify({ batch, call: i, target, error: String(e) }) + "\n");
      log(`call ${i} (${target.dangerId}/${target.mechanic}) failed: ${e instanceof Error ? e.message : e}`);
      return;
    }

    const { items, error } = parseExpansion(text);
    if (error) log(`call ${i}: ${error}`);
    for (const [j, item] of items.entries()) {
      const id = `x-${batch}-${String(i).padStart(3, "0")}-${j}`;
      // Vetting and the seen-set update happen synchronously, so concurrent
      // calls can't both accept the same duplicate.
      const res = vetItem(item, { id, source: "expand", batch }, seen);
      if (res.ok) {
        s.accepted++;
        await appendFile(p.candidates, JSON.stringify(res.candidate) + "\n");
      } else {
        s.rejected++;
        await appendFile(p.rejected, JSON.stringify({ id, batch, reasons: res.reasons, raw: item }) + "\n");
      }
    }
    log(`call ${String(i + 1).padStart(3)}/${targets.length} ${target.world}/${target.dangerId}/${target.mechanic}: ${items.length} items`);
  });

  return s;
}
