import type { CaseResult } from "@/eval/core";
import type { EvalCase } from "@/eval/heldout";
import { MECHANICS } from "@/game/constants";
import { DANGER_CARDS, formatRequest, PLACE_CARDS, type GenerateRequest } from "@/game/generate/request";

// Pre-caching (spec §7): before the demo, run the fine-tuned model over every
// card combination a judge can pick and keep the good outputs. On stage these
// are the "НӨӨЦ" fallback when no model answers. Free text can't be pre-cached;
// that falls back to the closest hand-built scene.

/** Every card combination the stage accepts (mirrors the stage's filtering). */
export function stageCardCombos(): GenerateRequest[] {
  const mechanics = [undefined, ...MECHANICS];
  const withPlace = PLACE_CARDS.flatMap((p) =>
    DANGER_CARDS.filter((d) => d.world === "any" || d.world === p.world).flatMap((d) =>
      mechanics.map((m) => ({ placeId: p.id, dangerId: d.id, ...(m ? { mechanic: m } : {}) })),
    ),
  );
  const dangerOnly = DANGER_CARDS.flatMap((d) => mechanics.map((m) => ({ dangerId: d.id, ...(m ? { mechanic: m } : {}) })));
  return [...withPlace, ...dangerOnly];
}

export const comboCase = (req: GenerateRequest, i: number): EvalCase => ({ id: `c${String(i).padStart(3, "0")}`, request: req });

/**
 * Why a reply can't be cached (null = accept). A cached scene is shown when
 * nothing live works, so it must be at least as good as a live one: valid,
 * clean layout, winnable, and faithful to every card.
 */
export function cacheRejectReason(r: CaseResult): string | null {
  if (r.stage !== "ok") return r.errors[0] ?? r.stage;
  if (r.warnings.length) return `layout: ${r.warnings[0]}`;
  if (!r.playable) return "engine cannot reach a win";
  if (r.followedPlace === false) return "ignored the place card";
  if (r.followedMechanic === false) return "ignored the game-type card";
  if (r.dangerOnTopic === false) return "danger card not in the scene";
  return null;
}

export const acceptForCache = (r: CaseResult) => cacheRejectReason(r) === null;

export const cacheKey = formatRequest;
