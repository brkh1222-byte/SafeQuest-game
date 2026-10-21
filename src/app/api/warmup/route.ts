import { chat, providersFromEnv, type ModelRole } from "@/game/generate/providers";
import { stageAuthError } from "@/lib/stageAuth";

// Loads every configured model into memory before the pitch. Ollama loads a
// model on its first request, which can take far longer than the 8 s budget;
// a warm-up turns that into a one-time cost paid before the judges watch.

const WARMUP_TIMEOUT_MS = 90_000;

export async function POST(req: Request) {
  const denied = stageAuthError(req);
  if (denied) return denied;

  const results = await Promise.all(
    providersFromEnv().map(async (p) => {
      const out: { provider: string; role: ModelRole; model: string; ok: boolean; ms: number; error?: string }[] = [];
      // One model at a time per provider: parallel loads on one laptop just thrash memory.
      for (const role of ["finetuned", "base"] as const) {
        const model = p.models[role];
        if (!model) continue;
        const started = performance.now();
        try {
          await chat({ ...p, timeoutMs: WARMUP_TIMEOUT_MS }, model, [{ role: "user", content: "OK" }], fetch, { maxTokens: 1 });
          out.push({ provider: p.name, role, model, ok: true, ms: Math.round(performance.now() - started) });
        } catch (e) {
          out.push({ provider: p.name, role, model, ok: false, ms: Math.round(performance.now() - started), error: (e as Error).message });
        }
      }
      return out;
    }),
  );
  return Response.json({ models: results.flat() });
}
