import { connection } from "next/server";
import { ping, providersFromEnv } from "@/game/generate/providers";
import { getLevelStore } from "@/lib/levelStore";

// Status bar for the stage console: what is configured and reachable right now.
export async function GET() {
  await connection();
  const providers = await Promise.all(
    providersFromEnv().map(async (p) => ({
      name: p.name,
      host: new URL(p.url).host,
      models: p.models,
      reachable: await ping(p),
    })),
  );
  return Response.json({
    providers,
    storage: getLevelStore().kind,
    stageKeyRequired: Boolean(process.env.SQ_STAGE_KEY),
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? null,
  });
}
