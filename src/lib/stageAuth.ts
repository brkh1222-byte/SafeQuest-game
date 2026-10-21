import "server-only";
import { timingSafeEqual } from "node:crypto";

// The stage console's write endpoints call paid model APIs and create public
// levels. When SQ_STAGE_KEY is set, they require it in the x-stage-key header.

export function stageAuthError(req: Request): Response | null {
  const expected = process.env.SQ_STAGE_KEY;
  if (!expected) return null;
  const given = req.headers.get("x-stage-key") ?? "";
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length === b.length && timingSafeEqual(a, b)) return null;
  return Response.json({ error: "stage key required" }, { status: 401 });
}
