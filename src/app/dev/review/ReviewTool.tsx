"use client";

import { useCallback, useEffect, useState } from "react";
import { PlayOverlay } from "@/components/PlayOverlay";
import { SceneThumb } from "@/components/SceneThumb";
import type { Candidate } from "@/data/candidate";
import { formatRequest } from "@/game/generate/request";
import { LESSON_BY_ID } from "@/game/registry/lessons";

// Human review of generated training scenes (spec §7 step 3). Same decisions
// as the CSV route, but the reviewer sees and can play each scene.
// Keys: A approve · R reject · S skip · P play.

interface Queue {
  pending: Candidate[];
  total: number;
  reviewed: number;
  approved: number;
}

export function ReviewTool() {
  const [queue, setQueue] = useState<Queue | null>(null);
  const [index, setIndex] = useState(0);
  const [instruction, setInstruction] = useState("");
  const [oops, setOops] = useState("");
  const [notes, setNotes] = useState("");
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const current = queue?.pending[index];

  const load = useCallback(async () => {
    const res = await fetch("/api/dev/review");
    setQueue(res.ok ? await res.json() : { pending: [], total: 0, reviewed: 0, approved: 0 });
    setIndex(0);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch
    load();
  }, [load]);

  useEffect(() => {
    // Reset the edit fields whenever a new scene comes up.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInstruction(current?.scene.instruction_mn ?? "");
    setOops(current?.scene.oops_mn ?? "");
    setNotes("");
    setError(null);
  }, [current]);

  const decide = useCallback(
    async (approve: boolean) => {
      if (!current || busy) return;
      setBusy(true);
      setError(null);
      const res = await fetch("/api/dev/review", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: current.id, approve, instruction_mn: instruction, oops_mn: oops, notes }),
      });
      setBusy(false);
      if (!res.ok) {
        setError((await res.json().catch(() => ({}))).error ?? `HTTP ${res.status}`);
        return;
      }
      setQueue((q) =>
        q && {
          ...q,
          pending: q.pending.filter((c) => c.id !== current.id),
          reviewed: q.reviewed + 1,
          approved: q.approved + (approve ? 1 : 0),
        },
      );
      setIndex((i) => Math.max(0, Math.min(i, (queue?.pending.length ?? 1) - 2)));
    },
    [current, busy, instruction, oops, notes, queue?.pending.length],
  );

  const skip = useCallback(() => setIndex((i) => (queue && queue.pending.length ? (i + 1) % queue.pending.length : 0)), [queue]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      if (typing || playing || e.metaKey || e.ctrlKey) return;
      const k = e.key.toLowerCase();
      if (k === "a") decide(true);
      else if (k === "r") decide(false);
      else if (k === "s" || e.key === "ArrowRight") skip();
      else if (k === "p") setPlaying(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [decide, skip, playing]);

  if (!queue) return <p className="p-6 font-bold text-muted">Ачаалж байна…</p>;

  const patched = current && { ...current.scene, instruction_mn: instruction || current.scene.instruction_mn, oops_mn: oops || current.scene.oops_mn };
  const lesson = current ? LESSON_BY_ID.get(current.scene.lesson_id) : undefined;
  const changed = current && (instruction !== current.scene.instruction_mn || oops !== current.scene.oops_mn);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-4 py-5">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-2xl font-black">Өгөгдөл шалгах · Review</h1>
        <span className="rounded-full bg-card px-3 py-1 text-sm font-black shadow-[0_3px_0_#e3d6c2]">
          {queue.reviewed}/{queue.total} шалгасан · {queue.approved} зөвшөөрсөн · {queue.pending.length} үлдсэн
        </span>
      </header>

      {!current || !patched ? (
        <p className="rounded-3xl bg-card p-6 text-center font-bold text-muted shadow-[0_5px_0_#e3d6c2]">
          Шалгах зүйл алга. Nothing pending. Generate more with <code>npm run data -- expand</code>.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-[3fr_2fr]">
          <section className="flex flex-col gap-3">
            <SceneThumb scene={patched} className="shadow-[0_5px_0_#e3d6c2]" />
            <div className="flex flex-wrap gap-2 text-xs font-black text-muted">
              <span>{current.id}</span>
              <span>· {current.scene.world}</span>
              <span>· {current.scene.mechanic}</span>
              <span>· {current.scene.objects.length} objects</span>
            </div>
            <div className="rounded-2xl bg-card p-3 shadow-[0_3px_0_#e3d6c2]">
              <p className="text-xs font-black text-muted">Сургамж (lesson) · таарч байна уу?</p>
              <p className="text-lg font-bold">{lesson?.text_mn}</p>
              <p className="text-sm text-muted">{lesson?.text_en}</p>
            </div>
            <div className="rounded-2xl bg-card p-3 shadow-[0_3px_0_#e3d6c2]">
              <p className="mb-1 text-xs font-black text-muted">Хүсэлтүүд (requests): Монгол бичвэр зөв үү?</p>
              <ul className="flex flex-col gap-1">
                {current.requests.map((r, i) => (
                  <li key={i} className={`whitespace-pre-wrap rounded-lg px-2 py-1 font-mono text-xs ${r.text ? "bg-[#fff1c2]" : "bg-background"}`}>
                    {formatRequest(r)}
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm font-black">
              Заавар (instruction_mn)
              <input value={instruction} onChange={(e) => setInstruction(e.target.value)} className="rounded-xl border-2 border-[#e3d6c2] bg-card px-3 py-2 text-lg font-bold" />
            </label>
            <label className="flex flex-col gap-1 text-sm font-black">
              Ой! мөр (oops_mn)
              <input value={oops} onChange={(e) => setOops(e.target.value)} className="rounded-xl border-2 border-[#e3d6c2] bg-card px-3 py-2 text-lg font-bold" />
            </label>
            <label className="flex flex-col gap-1 text-sm font-black">
              Тэмдэглэл (notes)
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="rounded-xl border-2 border-[#e3d6c2] bg-card px-3 py-2" />
            </label>

            <button className="btn-ghost" onClick={() => setPlaying(true)}>
              ▶ Тоглож үзэх <kbd className="text-xs opacity-60">P</kbd>
            </button>
            <div className="grid grid-cols-2 gap-3">
              <button className="btn disabled:opacity-40" style={{ background: "#2a9d8f", boxShadow: "0 5px 0 #1f7a6f" }} disabled={busy} onClick={() => decide(true)}>
                ✓ Зөв <kbd className="text-xs opacity-70">A</kbd>
              </button>
              <button className="btn disabled:opacity-40" style={{ background: "#d62828", boxShadow: "0 5px 0 #a51d1d" }} disabled={busy} onClick={() => decide(false)}>
                ✕ Буруу <kbd className="text-xs opacity-70">R</kbd>
              </button>
            </div>
            {/* Messages sit below the buttons so the buttons never jump. */}
            {changed && <p className="text-xs font-bold text-[#a16207]">Засвар хадгалагдана (fix will be saved with approval).</p>}
            {error && <p className="rounded-xl bg-[#ffe1e1] p-2 text-sm font-bold text-[#a4161a]">{error}</p>}
            <button className="text-sm font-bold text-muted underline" onClick={skip}>
              Алгасах (skip) <kbd className="text-xs">S</kbd>
            </button>
            <p className="text-xs text-muted">
              Reject if the lesson doesn&apos;t fit, the Mongolian is unnatural and can&apos;t be fixed above, a request asks for something else, or the game is confusing to play.
            </p>
          </section>
        </div>
      )}

      {playing && patched && <PlayOverlay scene={patched} onClose={() => setPlaying(false)} closeLabel="Буцах" />}
    </main>
  );
}
