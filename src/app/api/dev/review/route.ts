import { writeFile } from "node:fs/promises";
import { connection } from "next/server";
import { z } from "zod";
import type { Review } from "@/data/build";
import { vetItem, type Candidate } from "@/data/candidate";
import { dataPaths, readJsonl, readReviews } from "@/data/run";

// Dev-only backend for /dev/review: reads and writes data/ on this machine.
// Disabled in production builds, where there is no dataset on disk.

const FILES = dataPaths("data");
const disabled = () => process.env.NODE_ENV === "production";
const notFound = () => Response.json({ error: "not found" }, { status: 404 });

export async function GET() {
  await connection();
  if (disabled()) return notFound();
  const candidates = (await readJsonl<Candidate>(FILES.candidates)).filter((c) => c.source === "expand");
  const reviews = await readReviews(FILES.reviews);
  return Response.json({
    pending: candidates.filter((c) => !reviews[c.id]),
    total: candidates.length,
    reviewed: candidates.filter((c) => reviews[c.id]).length,
    approved: candidates.filter((c) => reviews[c.id]?.approve).length,
  });
}

const DecisionSchema = z.object({
  id: z.string(),
  approve: z.boolean(),
  instruction_mn: z.string().trim().max(60).optional(),
  oops_mn: z.string().trim().max(80).optional(),
  notes: z.string().trim().max(300).optional(),
});

// One write at a time, so two quick decisions can't overwrite each other.
let queue: Promise<unknown> = Promise.resolve();

export async function POST(req: Request) {
  if (disabled()) return notFound();
  const body = DecisionSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return Response.json({ error: "bad request" }, { status: 400 });
  const { id, approve, instruction_mn, oops_mn, notes } = body.data;

  const candidate = (await readJsonl<Candidate>(FILES.candidates)).find((c) => c.id === id);
  if (!candidate) return Response.json({ error: `unknown candidate ${id}` }, { status: 404 });

  // Only record a fix if it differs, and only if the fixed scene still passes vetting.
  const review: Review = { approve, notes: notes || undefined };
  if (instruction_mn && instruction_mn !== candidate.scene.instruction_mn) review.instruction_mn = instruction_mn;
  if (oops_mn && oops_mn !== candidate.scene.oops_mn) review.oops_mn = oops_mn;
  if (approve && (review.instruction_mn || review.oops_mn)) {
    const patched = { ...candidate.scene, instruction_mn: review.instruction_mn ?? candidate.scene.instruction_mn, oops_mn: review.oops_mn ?? candidate.scene.oops_mn };
    const res = vetItem({ scene: patched, requests: candidate.requests }, { id, source: "expand" }, new Set());
    if (!res.ok) return Response.json({ error: res.reasons.join("; ") }, { status: 422 });
  }

  const write = queue.then(async () => {
    const reviews = await readReviews(FILES.reviews);
    reviews[id] = review;
    await writeFile(FILES.reviews, JSON.stringify(reviews, null, 2));
  });
  queue = write.catch(() => undefined);
  await write;
  return Response.json({ ok: true });
}
