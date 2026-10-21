import { MicroGame } from "@/game/engine";
import { evaluateOutput, type OutputStage } from "@/game/generate/parse";
import { buildMessages, type Variant } from "@/game/generate/prompts";
import { chat, ProviderError, type ProviderConfig } from "@/game/generate/providers";
import { BACKDROP_BY_ID } from "@/game/registry/backdrops";
import { DANGER_BY_ID, formatRequest } from "@/game/generate/request";
import type { Scene } from "@/game/schema";
import type { EvalCase } from "./heldout";

// Scoring for the held-out eval (spec §8). Unlike the stage, the eval calls a
// provider directly: no fallback to another provider or to cached scenes,
// which would inflate the numbers.

export type CaseStage = OutputStage | "provider_error";

export interface CaseResult {
  caseId: string;
  variant: Variant;
  provider: string;
  model: string;
  prompt: string;
  promptChars: number;
  stage: CaseStage;
  errors: string[];
  warnings: string[];
  /** The engine reaches a win state by playing the intended solution. */
  playable: boolean;
  /** Only set when the request had that card. */
  followedPlace?: boolean;
  followedMechanic?: boolean;
  dangerOnTopic?: boolean;
  ms: number;
  raw?: string;
  scene?: Scene;
}

/** Plays the intended solution through the real engine. */
export function simulateWin(scene: Scene): boolean {
  const game = new MicroGame(scene);
  game.start();
  for (const body of game.bodies) {
    if (game.status !== "playing") break;
    const role = body.obj.role;
    if (scene.mechanic === "drag_to_fix" && role === "draggable") {
      const target = game.bodies.find((b) => b.obj.role === "target");
      if (target) game.drop(body.index, target.x, target.y);
    } else if (scene.mechanic === "tap_hazards" && role === "hazard") {
      game.tap(body.index);
    } else if (scene.mechanic === "tap_safe_choice" && role === "option_correct") {
      game.tap(body.index);
    }
  }
  return game.status === "won";
}

export function scoreScene(c: EvalCase, scene: Scene): Pick<CaseResult, "playable" | "followedPlace" | "followedMechanic" | "dangerOnTopic"> {
  const { placeId, mechanic, dangerId } = c.request;
  const danger = dangerId ? DANGER_BY_ID.get(dangerId) : undefined;
  return {
    playable: simulateWin(scene),
    followedPlace: placeId ? scene.backdrop_id === placeId && scene.world === BACKDROP_BY_ID.get(placeId)?.world : undefined,
    followedMechanic: mechanic ? scene.mechanic === mechanic : undefined,
    dangerOnTopic: danger ? scene.objects.some((o) => danger.sprites.includes(o.sprite_id)) : undefined,
  };
}

export async function runCase(
  c: EvalCase,
  variant: Variant,
  provider: ProviderConfig,
  model: string,
  fetchImpl?: typeof fetch,
): Promise<CaseResult> {
  const messages = buildMessages(variant, c.request);
  const base = {
    caseId: c.id,
    variant,
    provider: provider.name,
    model,
    prompt: formatRequest(c.request),
    promptChars: messages.reduce((n, m) => n + m.content.length, 0),
  };
  const started = performance.now();
  let raw: string;
  try {
    raw = await chat(provider, model, messages, fetchImpl);
  } catch (e) {
    const err = e instanceof ProviderError ? `${e.kind}: ${e.message}` : String(e);
    return { ...base, stage: "provider_error", errors: [err], warnings: [], playable: false, ms: Math.round(performance.now() - started) };
  }
  const ms = Math.round(performance.now() - started);
  const ev = evaluateOutput(raw);
  if (!ev.scene) return { ...base, stage: ev.stage, errors: ev.errors, warnings: [], playable: false, ms, raw };
  return { ...base, stage: ev.stage, errors: [], warnings: ev.warnings, ...scoreScene(c, ev.scene), ms, raw, scene: ev.scene };
}

// ------------------------------------------------------------- summary

export interface Ratio {
  n: number;
  of: number;
}

export interface VariantSummary {
  variant: Variant;
  model: string;
  cases: number;
  replied: Ratio;
  validJson: Ratio;
  schemaValid: Ratio;
  playable: Ratio;
  clean: Ratio;
  followedPlace: Ratio;
  followedMechanic: Ratio;
  dangerOnTopic: Ratio;
  medianMs: number | null;
  p90Ms: number | null;
  avgPromptChars: number;
  human?: { lessonFit: Ratio; mongolianMean: number | null; rated: number };
}

const ratio = (rows: CaseResult[], pred: (r: CaseResult) => boolean | undefined, of = rows.length): Ratio => ({
  n: rows.filter((r) => pred(r) === true).length,
  of,
});

export function percentile(values: number[], p: number): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  // Nearest-rank method.
  return sorted[Math.max(0, Math.ceil((p / 100) * sorted.length) - 1)];
}

export function summarize(results: CaseResult[]): VariantSummary[] {
  const variants = [...new Set(results.map((r) => r.variant))];
  return variants.map((variant) => {
    const rows = results.filter((r) => r.variant === variant);
    const replied = rows.filter((r) => r.stage !== "provider_error");
    const latencies = replied.map((r) => r.ms);
    return {
      variant,
      model: rows[0]?.model ?? "",
      cases: rows.length,
      replied: ratio(rows, (r) => r.stage !== "provider_error"),
      validJson: ratio(rows, (r) => r.stage === "invalid_scene" || r.stage === "ok"),
      schemaValid: ratio(rows, (r) => r.stage === "ok"),
      playable: ratio(rows, (r) => r.playable),
      clean: ratio(rows, (r) => r.playable && r.warnings.length === 0),
      // Denominators are the cases that had that card, not all cases.
      followedPlace: ratio(rows, (r) => r.followedPlace, rows.filter((r) => hasCard(r, "place")).length),
      followedMechanic: ratio(rows, (r) => r.followedMechanic, rows.filter((r) => hasCard(r, "mechanic")).length),
      dangerOnTopic: ratio(rows, (r) => r.dangerOnTopic, rows.filter((r) => hasCard(r, "danger")).length),
      medianMs: percentile(latencies, 50),
      p90Ms: percentile(latencies, 90),
      avgPromptChars: Math.round(rows.reduce((n, r) => n + r.promptChars, 0) / Math.max(1, rows.length)),
    };
  });
}

const CARD_PREFIX = { place: "Газар:", mechanic: "Тоглоом:", danger: "Аюул:" } as const;
const hasCard = (r: CaseResult, card: keyof typeof CARD_PREFIX) => r.prompt.split("\n").some((l) => l.startsWith(CARD_PREFIX[card]));

const VARIANT_LABEL: Record<Variant, string> = {
  base_naive: "Base, short prompt",
  base_fewshot: "Base, few-shot prompt",
  finetuned: "Fine-tuned, short prompt",
};

const pct = (r: Ratio) => (r.of === 0 ? "n/a" : `${Math.round((100 * r.n) / r.of)}% (${r.n}/${r.of})`);
const sec = (ms: number | null) => (ms === null ? "n/a" : `${(ms / 1000).toFixed(1)}s`);

export function renderMarkdown(summaries: VariantSummary[], meta: { provider: string; date: string; cases: number }): string {
  const cols = summaries.map((s) => `${VARIANT_LABEL[s.variant]}<br><sub>${s.model}</sub>`);
  const row = (label: string, f: (s: VariantSummary) => string) => `| ${label} | ${summaries.map(f).join(" | ")} |`;
  const lines = [
    `# SafeQuest eval`,
    "",
    `${meta.cases} held-out prompts · provider: ${meta.provider} · ${meta.date}`,
    "",
    `| Metric | ${cols.join(" | ")} |`,
    `|---|${summaries.map(() => "---").join("|")}|`,
    row("Model replied", (s) => pct(s.replied)),
    row("Valid JSON", (s) => pct(s.validJson)),
    row("Schema-valid scene", (s) => pct(s.schemaValid)),
    row("**Playable** (engine reaches a win)", (s) => `**${pct(s.playable)}**`),
    row("Playable, no layout warnings", (s) => pct(s.clean)),
    row("Followed place card", (s) => pct(s.followedPlace)),
    row("Followed game-type card", (s) => pct(s.followedMechanic)),
    row("Danger card on topic", (s) => pct(s.dangerOnTopic)),
    row("Median latency", (s) => sec(s.medianMs)),
    row("p90 latency", (s) => sec(s.p90Ms)),
    row("Avg prompt size (chars)", (s) => s.avgPromptChars.toLocaleString("en-US")),
  ];
  if (summaries.some((s) => s.human)) {
    lines.push(
      row("Lesson fits scene (human, blind)", (s) => (s.human ? pct(s.human.lessonFit) : "n/a")),
      row("Mongolian quality 1–5 (human, blind)", (s) =>
        s.human?.mongolianMean != null ? `${s.human.mongolianMean.toFixed(1)} (n=${s.human.rated})` : "n/a",
      ),
    );
  }
  lines.push(
    "",
    "Playable = schema-valid and the real game engine reaches a win when the intended solution is played.",
    "No fallback to other providers or cached scenes is used in this eval.",
    "Human rows come from a blind review sheet (variant hidden), sampled from schema-valid scenes only.",
    "",
  );
  return lines.join("\n");
}
