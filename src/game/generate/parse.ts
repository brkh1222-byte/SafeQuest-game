import { playabilityIssues } from "../geometry";
import { parseScene, type Scene } from "../schema";

// Turns raw model text into a scene, recording exactly how far it got. The
// stage shows `stage` as the failure reason; the eval script counts them.

export type OutputStage = "no_json" | "invalid_json" | "invalid_scene" | "ok";

export interface Evaluated {
  stage: OutputStage;
  scene?: Scene;
  errors: string[];
  /** Playability problems (overlap, off-screen). The scene still loads. */
  warnings: string[];
}

/** Finds the first balanced {...} block, ignoring braces inside strings. */
export function extractJsonObject(raw: string): string | null {
  const text = raw.replace(/```(?:json)?/gi, "");
  const start = text.indexOf("{");
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (c === "\\") i++;
      else if (c === '"') inString = false;
    } else if (c === '"') inString = true;
    else if (c === "{") depth++;
    else if (c === "}" && --depth === 0) return text.slice(start, i + 1);
  }
  return null;
}

export function evaluateOutput(raw: string): Evaluated {
  const block = extractJsonObject(raw);
  if (!block) return { stage: "no_json", errors: ["no JSON object in output"], warnings: [] };

  let value: unknown;
  try {
    value = JSON.parse(block);
  } catch {
    try {
      // The one repair we allow: trailing commas, a common small-model slip.
      value = JSON.parse(block.replace(/,\s*([}\]])/g, "$1"));
    } catch (e) {
      return { stage: "invalid_json", errors: [`invalid JSON: ${(e as Error).message}`], warnings: [] };
    }
  }

  const parsed = parseScene(value);
  if (!parsed.ok) return { stage: "invalid_scene", errors: parsed.errors, warnings: [] };
  return { stage: "ok", scene: parsed.scene, errors: [], warnings: playabilityIssues(parsed.scene) };
}
