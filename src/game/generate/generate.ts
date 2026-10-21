import type { Scene } from "../schema";
import { findCachedScene } from "./cached";
import { evaluateOutput, type OutputStage } from "./parse";
import { buildMessages, type ChatMessage, type Variant } from "./prompts";
import { chat, ProviderError, type ModelRole, type ProviderConfig, type ProviderName } from "./providers";
import type { GenerateRequest } from "./request";

// One Generate press for one column. Fallback chain (spec §7):
//   fine-tuned: preferred provider → other provider → cached scene
//   base columns: providers only, never cached. Their failures are the point
//   of the comparison and must not be papered over.

export type Source = ProviderName | "cached";
export type Prefer = "auto" | "hosted" | "local";

export interface Attempt {
  source: Source;
  model?: string;
  ms: number;
  /** Where it stopped: provider failure, or how far the output got. */
  outcome: OutputStage | "timeout" | "network" | "http";
  error?: string;
}

export interface GenerateResult {
  variant: Variant;
  ok: boolean;
  scene?: Scene;
  /** The answering model's raw text (the last provider that replied). */
  raw?: string;
  errors: string[];
  warnings: string[];
  /** Latency of the attempt that produced this result. */
  ms: number;
  source?: Source;
  model?: string;
  /** Exact-match precomputed cache vs closest hand-built scene. */
  cacheExact?: boolean;
  attempts: Attempt[];
  messages: ChatMessage[];
}

const ROLE_FOR: Record<Variant, ModelRole> = { base_naive: "base", base_fewshot: "base", finetuned: "finetuned" };

export function orderProviders(providers: ProviderConfig[], prefer: Prefer): ProviderConfig[] {
  const first: ProviderName = prefer === "local" ? "local" : "hosted";
  return [...providers.filter((p) => p.name === first), ...providers.filter((p) => p.name !== first)];
}

export async function generate(
  variant: Variant,
  req: GenerateRequest,
  opts: { providers: ProviderConfig[]; prefer?: Prefer; fetchImpl?: typeof fetch },
): Promise<GenerateResult> {
  const messages = buildMessages(variant, req);
  const role = ROLE_FOR[variant];
  const isFinetuned = variant === "finetuned";
  const attempts: Attempt[] = [];
  let lastReply: GenerateResult | undefined;

  for (const provider of orderProviders(opts.providers, opts.prefer ?? "auto")) {
    const model = provider.models[role];
    if (!model) continue;
    const started = performance.now();
    try {
      const raw = await chat(provider, model, messages, opts.fetchImpl);
      const ms = Math.round(performance.now() - started);
      const ev = evaluateOutput(raw);
      attempts.push({ source: provider.name, model, ms, outcome: ev.stage, error: ev.errors[0] });
      lastReply = {
        variant, ok: ev.stage === "ok", scene: ev.scene, raw, errors: ev.errors, warnings: ev.warnings,
        ms, source: provider.name, model, attempts, messages,
      };
      // Base columns report the first reply as-is. The fine-tune keeps going
      // on a bad reply so the stage still gets a playable scene.
      if (lastReply.ok || !isFinetuned) return lastReply;
    } catch (e) {
      const err = e instanceof ProviderError ? e : new ProviderError(String(e), "network");
      attempts.push({ source: provider.name, model, ms: Math.round(performance.now() - started), outcome: err.kind, error: err.message });
    }
  }

  if (isFinetuned) {
    const { scene, exact } = findCachedScene(req);
    attempts.push({ source: "cached", ms: 0, outcome: "ok" });
    return {
      variant, ok: true, scene, errors: [], warnings: [], ms: 0, source: "cached", cacheExact: exact,
      // Keep the failed live reply visible next to the cached scene.
      raw: lastReply?.raw, attempts, messages,
    };
  }

  if (lastReply) return lastReply;
  const configured = opts.providers.some((p) => p.models[role]);
  return {
    variant, ok: false, ms: 0, attempts, messages, warnings: [],
    errors: [configured ? "no provider answered" : `no ${role} model configured`],
  };
}
