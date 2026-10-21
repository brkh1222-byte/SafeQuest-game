import Anthropic from "@anthropic-ai/sdk";
import type { Complete } from "./expand";

// Claude client for dataset expansion. Credentials come from the environment
// (ANTHROPIC_API_KEY, ANTHROPIC_AUTH_TOKEN, or an `ant auth login` profile).

export const DEFAULT_EXPAND_MODEL = "claude-opus-5-5";

export class RefusalError extends Error {}

export function claudeComplete(opts: { model: string; effort: "low" | "medium" | "high" | "xhigh" | "max" }): Complete {
  const client = new Anthropic();
  return async (system, user) => {
    const stream = client.beta.messages.stream({
      model: opts.model,
      max_tokens: 64000,
      thinking: { type: "adaptive" },
      output_config: { effort: opts.effort },
      // On a safety decline, let the API re-run the request on its recommended model.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      // The system prompt is identical on every call: cache it.
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: user }],
    });
    const message = await stream.finalMessage();
    if (message.stop_reason === "refusal") {
      throw new RefusalError(`refused (${message.stop_details?.category ?? "no category"})`);
    }
    const text = message.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
    return {
      text,
      stopReason: message.stop_reason,
      inputTokens: message.usage.input_tokens + (message.usage.cache_read_input_tokens ?? 0) + (message.usage.cache_creation_input_tokens ?? 0),
      outputTokens: message.usage.output_tokens,
    };
  };
}
