import type { Variant } from "@/game/generate/prompts";
import { LESSON_BY_ID } from "@/game/registry/lessons";
import type { CaseResult, Ratio, VariantSummary } from "./core";

// Blind human review (spec §8: lesson fit + Mongolian quality). Reviewers get
// a CSV without variant names; the key that maps rows back stays in a
// separate file so nobody grades the fine-tune generously by accident.

export interface ReviewKeyEntry {
  item: string;
  variant: Variant;
  caseId: string;
}

export const REVIEW_HEADER = ["item", "prompt", "instruction_mn", "oops_mn", "lesson_mn", "lesson_fit (y/n)", "mongolian_1to5", "notes"];

/** Deterministic PRNG so the same seed gives the same sample. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], rand: () => number): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function buildReviewSheet(results: CaseResult[], perVariant: number, seed: number): { csv: string; key: ReviewKeyEntry[] } {
  const rand = mulberry32(seed);
  const variants = [...new Set(results.map((r) => r.variant))];
  const picked = variants.flatMap((v) => shuffle(results.filter((r) => r.variant === v && r.scene), rand).slice(0, perVariant));
  const rows = shuffle(picked, rand);

  const key: ReviewKeyEntry[] = [];
  const lines = [REVIEW_HEADER];
  rows.forEach((r, i) => {
    const item = `R${String(i + 1).padStart(3, "0")}`;
    key.push({ item, variant: r.variant, caseId: r.caseId });
    lines.push([item, r.prompt, r.scene!.instruction_mn, r.scene!.oops_mn, LESSON_BY_ID.get(r.scene!.lesson_id)?.text_mn ?? r.scene!.lesson_id, "", "", ""]);
  });
  return { csv: toCsv(lines), key };
}

export function applyReview(summaries: VariantSummary[], key: ReviewKeyEntry[], csv: string): VariantSummary[] {
  const [header, ...rows] = parseCsv(csv);
  const col = (name: string) => header.findIndex((h) => h.trim().toLowerCase().startsWith(name));
  const [iItem, iFit, iMn] = [col("item"), col("lesson_fit"), col("mongolian")];
  if (iItem < 0 || iFit < 0 || iMn < 0) throw new Error("review sheet is missing item / lesson_fit / mongolian columns");

  const byItem = new Map(key.map((k) => [k.item, k]));
  const acc = new Map<Variant, { fit: Ratio; scores: number[] }>();
  for (const row of rows) {
    const entry = byItem.get(row[iItem]?.trim());
    if (!entry) continue;
    const a = acc.get(entry.variant) ?? { fit: { n: 0, of: 0 }, scores: [] };
    const fit = row[iFit]?.trim().toLowerCase();
    if (fit === "y" || fit === "yes" || fit === "n" || fit === "no") {
      a.fit.of++;
      if (fit.startsWith("y")) a.fit.n++;
    }
    const score = Number(row[iMn]?.trim());
    if (row[iMn]?.trim() && Number.isFinite(score) && score >= 1 && score <= 5) a.scores.push(score);
    acc.set(entry.variant, a);
  }

  return summaries.map((s) => {
    const a = acc.get(s.variant);
    if (!a) return s;
    const mean = a.scores.length ? a.scores.reduce((x, y) => x + y, 0) / a.scores.length : null;
    return { ...s, human: { lessonFit: a.fit, mongolianMean: mean, rated: a.scores.length } };
  });
}

// ----------------------------------------------------------------- CSV

const cell = (v: string) => (/[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/** RFC 4180 CSV with a BOM so Excel opens Cyrillic correctly. */
export const toCsv = (rows: string[][]) => "﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";

export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((f) => f !== ""));
}
