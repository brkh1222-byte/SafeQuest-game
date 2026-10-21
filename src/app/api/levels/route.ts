import { connection } from "next/server";
import { z } from "zod";
import { parseScene } from "@/game/schema";
import { getLevelStore } from "@/lib/levelStore";
import { stageAuthError } from "@/lib/stageAuth";

const BodySchema = z.object({
  scene: z.unknown(),
  prompt: z.string().max(500).default(""),
  source: z.string().max(20),
  model: z.string().max(120).optional(),
  judge: z.boolean().default(true),
});

/** Judges' World: every level saved from the stage, oldest first. */
export async function GET() {
  await connection();
  return Response.json({ levels: await getLevelStore().listJudges() });
}

export async function POST(req: Request) {
  const denied = stageAuthError(req);
  if (denied) return denied;

  const body = BodySchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return Response.json({ error: "bad request" }, { status: 400 });
  // Never store a scene the engine would reject.
  const parsed = parseScene(body.data.scene);
  if (!parsed.ok) return Response.json({ error: parsed.errors.join("; ") }, { status: 422 });

  const { prompt, source, model, judge } = body.data;
  const level = await getLevelStore().save({ scene: parsed.scene, prompt, source, model }, { judge });
  return Response.json({ id: level.id }, { status: 201 });
}
