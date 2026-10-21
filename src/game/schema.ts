import { z } from "zod";
import { MECHANICS, ROLES, WORLDS, type Mechanic, type Role } from "./constants";
import { BACKDROP_BY_ID } from "./registry/backdrops";
import { LESSON_BY_ID } from "./registry/lessons";
import { SPRITE_BY_ID } from "./registry/sprites";

// The model's output contract (spec §4). Every scene, hand-built or generated,
// goes through `parseScene` before the engine sees it.

const unit = z.number().min(0).max(1);

export const SceneObjectSchema = z.object({
  sprite_id: z.string(),
  x: unit,
  y: unit,
  role: z.enum(ROLES),
});

export const SceneSchema = z
  .object({
    world: z.enum(WORLDS),
    backdrop_id: z.string(),
    mechanic: z.enum(MECHANICS),
    instruction_mn: z.string().trim().min(2).max(40),
    objects: z.array(SceneObjectSchema).min(1).max(12),
    time_limit_s: z.number().min(3).max(10),
    oops_mn: z.string().trim().min(2).max(60),
    lesson_id: z.string(),
  })
  .superRefine((scene, ctx) => {
    const issue = (message: string, path: (string | number)[] = []) => ctx.addIssue({ code: "custom", message, path });

    const words = scene.instruction_mn.split(/\s+/).filter(Boolean).length;
    if (words > 5) issue(`instruction_mn has ${words} words; max 5`, ["instruction_mn"]);

    const backdrop = BACKDROP_BY_ID.get(scene.backdrop_id);
    if (!backdrop) issue(`unknown backdrop_id "${scene.backdrop_id}"`, ["backdrop_id"]);
    else if (backdrop.world !== scene.world) issue(`backdrop "${backdrop.id}" belongs to world "${backdrop.world}"`, ["backdrop_id"]);

    const lesson = LESSON_BY_ID.get(scene.lesson_id);
    if (!lesson) issue(`unknown lesson_id "${scene.lesson_id}"`, ["lesson_id"]);
    else if (lesson.world !== "any" && lesson.world !== scene.world) issue(`lesson "${lesson.id}" belongs to world "${lesson.world}"`, ["lesson_id"]);

    scene.objects.forEach((obj, i) => {
      const sprite = SPRITE_BY_ID.get(obj.sprite_id);
      if (!sprite) return issue(`unknown sprite_id "${obj.sprite_id}"`, ["objects", i, "sprite_id"]);
      if (sprite.world !== "any" && sprite.world !== scene.world) {
        // Cross-world props are allowed (a dog can be in the city), but only
        // as non-interactive decor would look odd; keep it strict for now.
        issue(`sprite "${sprite.id}" belongs to world "${sprite.world}"`, ["objects", i, "sprite_id"]);
      }
      const isZone = sprite.kind === "zone";
      if (obj.role === "target" && !isZone) issue(`role "target" needs a zone sprite, got "${sprite.id}"`, ["objects", i, "role"]);
      if (isZone && obj.role !== "target" && obj.role !== "decor") issue(`zone "${sprite.id}" can only be target or decor`, ["objects", i, "role"]);
      if (!ALLOWED_ROLES[scene.mechanic].has(obj.role)) issue(`role "${obj.role}" not used by ${scene.mechanic}`, ["objects", i, "role"]);
    });

    const count = (role: Role) => scene.objects.filter((o) => o.role === role).length;
    switch (scene.mechanic) {
      case "drag_to_fix":
        if (count("draggable") < 1) issue("drag_to_fix needs at least one draggable");
        if (count("target") < 1) issue("drag_to_fix needs at least one target");
        break;
      case "tap_hazards":
        if (count("hazard") < 1) issue("tap_hazards needs at least one hazard");
        break;
      case "tap_safe_choice":
        if (count("option_correct") !== 1) issue("tap_safe_choice needs exactly one option_correct");
        if (count("option_wrong") < 1 || count("option_wrong") > 2) issue("tap_safe_choice needs 1–2 option_wrong");
        break;
    }
  });

const ALLOWED_ROLES: Record<Mechanic, ReadonlySet<Role>> = {
  drag_to_fix: new Set<Role>(["draggable", "target", "hazard", "decor"]),
  tap_hazards: new Set<Role>(["hazard", "safe", "decor"]),
  tap_safe_choice: new Set<Role>(["option_correct", "option_wrong", "decor"]),
};

export type SceneObject = z.infer<typeof SceneObjectSchema>;
export type Scene = z.infer<typeof SceneSchema>;

export type ParseResult = { ok: true; scene: Scene } | { ok: false; errors: string[] };

export function parseScene(input: unknown): ParseResult {
  const result = SceneSchema.safeParse(input);
  if (result.success) return { ok: true, scene: result.data };
  return {
    ok: false,
    errors: result.error.issues.map((i) => (i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message)),
  };
}
