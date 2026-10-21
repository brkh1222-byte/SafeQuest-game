import { getLevelStore, isLevelId } from "@/lib/levelStore";

export async function GET(_req: Request, ctx: RouteContext<"/api/levels/[id]">) {
  const { id } = await ctx.params;
  if (!isLevelId(id)) return Response.json({ error: "not found" }, { status: 404 });
  const level = await getLevelStore().get(id);
  if (!level) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json(level);
}
