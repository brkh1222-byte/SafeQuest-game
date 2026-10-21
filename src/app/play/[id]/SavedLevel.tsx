"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PlayOverlay } from "@/components/PlayOverlay";
import { SceneThumb } from "@/components/SceneThumb";
import { parseScene, type Scene } from "@/game/schema";

type State = { status: "loading" } | { status: "missing" } | { status: "ready"; scene: Scene };

/** A level a judge generated on stage, opened from its QR code. */
export function SavedLevel({ id }: { id: string }) {
  const [state, setState] = useState<State>({ status: "loading" });
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    fetch(`/api/levels/${encodeURIComponent(id)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((level) => {
        const parsed = level ? parseScene(level.scene) : null;
        setState(parsed?.ok ? { status: "ready", scene: parsed.scene } : { status: "missing" });
      })
      .catch(() => setState({ status: "missing" }));
  }, [id]);

  if (state.status === "ready" && playing) return <PlayOverlay scene={state.scene} onClose={() => setPlaying(false)} />;

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-5 px-4 py-8 text-center">
      <h1 className="text-3xl font-black">
        Safe<span className="text-accent">Quest</span> 🐿️
      </h1>
      {state.status === "loading" && <p className="font-bold text-muted">Ачаалж байна…</p>}
      {state.status === "missing" && <p className="font-bold text-muted">Энэ тоглоом олдсонгүй 😢</p>}
      {state.status === "ready" && (
        <>
          <p className="font-bold text-muted">Шүүгчийн бүтээсэн тоглоом</p>
          <SceneThumb scene={state.scene} className="shadow-[0_6px_0_#e3d6c2]" />
          <button className="btn text-xl" onClick={() => setPlaying(true)}>
            ▶ Тоглох
          </button>
        </>
      )}
      <Link href="/" className="font-bold text-muted underline">
        Бүх тоглоом
      </Link>
    </main>
  );
}
