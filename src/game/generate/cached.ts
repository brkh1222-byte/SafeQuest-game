import { CITY_LEVELS } from "../levels/city";
import { EXTRA_SCENES } from "../levels/extra";
import { BACKDROP_BY_ID } from "../registry/backdrops";
import type { Scene } from "../schema";
import { DANGER_BY_ID, formatRequest, type GenerateRequest } from "./request";
import precomputed from "./precomputed.json";

// Last link of the fallback chain: a scene that is always available offline.
// 1. An exact hit in precomputed.json (fine-tuned outputs saved before the
//    demo, keyed by formatRequest()).
// 2. Otherwise the closest hand-built scene by world, place, danger, mechanic.
// The stage always labels these CACHED; they are never presented as live.

const PRECOMPUTED = precomputed as Record<string, Scene>;
const POOL: Scene[] = [...CITY_LEVELS.map((l) => l.scene), ...EXTRA_SCENES];

export function findCachedScene(req: GenerateRequest): { scene: Scene; exact: boolean } {
  const exact = PRECOMPUTED[formatRequest(req)];
  if (exact) return { scene: exact, exact: true };

  const place = req.placeId ? BACKDROP_BY_ID.get(req.placeId) : undefined;
  const danger = req.dangerId ? DANGER_BY_ID.get(req.dangerId) : undefined;
  const world = place?.world ?? (danger && danger.world !== "any" ? danger.world : undefined);
  const text = req.text?.toLowerCase() ?? "";

  let best = POOL[0];
  let bestScore = -1;
  for (const scene of POOL) {
    let score = 0;
    if (world && scene.world === world) score += 3;
    if (place && scene.backdrop_id === place.id) score += 2;
    if (req.mechanic && scene.mechanic === req.mechanic) score += 2;
    if (danger && scene.objects.some((o) => danger.sprites.includes(o.sprite_id))) score += 4;
    if (text && (text.includes(scene.instruction_mn.toLowerCase().replace(/[!?]/g, "")) || scene.oops_mn.toLowerCase().includes(text))) score += 1;
    if (score > bestScore) {
      best = scene;
      bestScore = score;
    }
  }
  return { scene: best, exact: false };
}
