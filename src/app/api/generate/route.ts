import { z } from "zod";
import { generate } from "@/game/generate/generate";
import { VARIANTS } from "@/game/generate/prompts";
import { providersFromEnv } from "@/game/generate/providers";
import { GenerateRequestSchema } from "@/game/generate/request";
import { stageAuthError } from "@/lib/stageAuth";

const BodySchema = z.object({
  variant: z.enum(VARIANTS),
  request: GenerateRequestSchema,
  prefer: z.enum(["auto", "hosted", "local"]).default("auto"),
});

export async function POST(req: Request) {
  const denied = stageAuthError(req);
  if (denied) return denied;

  const body = BodySchema.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return Response.json({ error: body.error.issues.map((i) => i.message).join("; ") }, { status: 400 });
  }
  const { variant, request, prefer } = body.data;
  const result = await generate(variant, request, { providers: providersFromEnv(), prefer });
  return Response.json(result);
}
