import type { ChatMessage } from "./prompts";

// Model endpoints. Both speak the OpenAI-compatible chat API:
//   hosted = Hugging Face / Together endpoint serving the merged LoRA
//   local  = Ollama on the demo laptop (http://localhost:11434/v1)
// A provider only counts as configured for a role when its model name is set.

export type ProviderName = "hosted" | "local";
export type ModelRole = "base" | "finetuned";

export interface ProviderConfig {
  name: ProviderName;
  url: string;
  apiKey?: string;
  models: Partial<Record<ModelRole, string>>;
  timeoutMs: number;
}

type Env = Record<string, string | undefined>;

const num = (v: string | undefined, fallback: number) => (v && Number.isFinite(Number(v)) ? Number(v) : fallback);

export function providersFromEnv(env: Env = process.env): ProviderConfig[] {
  const providers: ProviderConfig[] = [];
  if (env.SQ_HOSTED_URL) {
    providers.push({
      name: "hosted",
      url: env.SQ_HOSTED_URL.replace(/\/$/, ""),
      apiKey: env.SQ_HOSTED_API_KEY,
      models: { base: env.SQ_HOSTED_MODEL_BASE || undefined, finetuned: env.SQ_HOSTED_MODEL_FT || undefined },
      timeoutMs: num(env.SQ_HOSTED_TIMEOUT_MS, 6000),
    });
  }
  if (env.SQ_LOCAL_MODEL_BASE || env.SQ_LOCAL_MODEL_FT) {
    providers.push({
      name: "local",
      url: (env.SQ_LOCAL_URL || "http://localhost:11434/v1").replace(/\/$/, ""),
      models: { base: env.SQ_LOCAL_MODEL_BASE || undefined, finetuned: env.SQ_LOCAL_MODEL_FT || undefined },
      timeoutMs: num(env.SQ_LOCAL_TIMEOUT_MS, 9000),
    });
  }
  return providers;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    readonly kind: "timeout" | "network" | "http",
  ) {
    super(message);
  }
}

/** Same sampling settings for every variant so the comparison stays fair. */
export const SAMPLING = { temperature: 0.4, max_tokens: 900 } as const;

export async function chat(
  cfg: ProviderConfig,
  model: string,
  messages: ChatMessage[],
  fetchImpl: typeof fetch = fetch,
  opts: { maxTokens?: number } = {},
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), cfg.timeoutMs);
  try {
    const res = await fetchImpl(`${cfg.url}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(cfg.apiKey ? { authorization: `Bearer ${cfg.apiKey}` } : {}),
      },
      body: JSON.stringify({ model, messages, stream: false, ...SAMPLING, ...(opts.maxTokens ? { max_tokens: opts.maxTokens } : {}) }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new ProviderError(`HTTP ${res.status} ${body.slice(0, 200)}`.trim(), "http");
    }
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return data.choices?.[0]?.message?.content ?? "";
  } catch (e) {
    if (e instanceof ProviderError) throw e;
    if (controller.signal.aborted) throw new ProviderError(`timed out after ${cfg.timeoutMs}ms`, "timeout");
    throw new ProviderError((e as Error).message || "network error", "network");
  } finally {
    clearTimeout(timer);
  }
}

/** Quick reachability probe for the stage status bar. */
export async function ping(cfg: ProviderConfig, fetchImpl: typeof fetch = fetch): Promise<boolean> {
  try {
    const res = await fetchImpl(`${cfg.url}/models`, {
      headers: cfg.apiKey ? { authorization: `Bearer ${cfg.apiKey}` } : {},
      signal: AbortSignal.timeout(1500),
    });
    return res.ok;
  } catch {
    return false;
  }
}
