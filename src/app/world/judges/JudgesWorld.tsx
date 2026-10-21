"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { GameCanvas } from "@/components/GameCanvas";
import { PlayOverlay } from "@/components/PlayOverlay";
import { RotateHint } from "@/components/RotateHint";
import { SceneThumb } from "@/components/SceneThumb";
import type { Result } from "@/game/engine";
import { LESSON_BY_ID } from "@/game/registry/lessons";
import { parseScene, type Scene } from "@/game/schema";

// Every game the judges generated on stage. "Финал" plays them back to back.

interface Level {
  id: string;
  scene: Scene;
}

export function JudgesWorld() {
  const [levels, setLevels] = useState<Level[] | null>(null);
  const [playing, setPlaying] = useState<Scene | null>(null);
  const [finale, setFinale] = useState(false);

  useEffect(() => {
    fetch("/api/levels")
      .then((r) => r.json())
      .then((d: { levels: { id: string; scene: unknown }[] }) =>
        setLevels(
          d.levels.flatMap((l) => {
            const p = parseScene(l.scene);
            return p.ok ? [{ id: l.id, scene: p.scene }] : [];
          }),
        ),
      )
      .catch(() => setLevels([]));
  }, []);

  if (finale && levels?.length) return <Finale scenes={levels.map((l) => l.scene)} onExit={() => setFinale(false)} />;
  if (playing) return <PlayOverlay scene={playing} onClose={() => setPlaying(null)} />;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-5 px-4 py-6">
      <header className="flex flex-wrap items-center gap-3">
        <Link href="/" className="btn-ghost px-4 py-2" aria-label="Буцах">
          ←
        </Link>
        <h1 className="mr-auto text-3xl font-black">🏆 Шүүгчдийн ертөнц</h1>
        {levels && levels.length > 0 && (
          <button className="btn text-lg" onClick={() => setFinale(true)}>
            🎬 Финал · {levels.length} тоглоом
          </button>
        )}
      </header>

      {levels === null && <p className="font-bold text-muted">Ачаалж байна…</p>}
      {levels?.length === 0 && (
        <p className="rounded-3xl bg-card p-6 text-center text-lg font-bold text-muted shadow-[0_5px_0_#e3d6c2]">
          Одоохондоо хоосон. Тайзан дээр шүүгчид тоглоом бүтээхэд энд нэмэгдэнэ.
        </p>
      )}

      <ol className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {levels?.map((l, i) => (
          <li key={l.id}>
            <button className="w-full text-left" onClick={() => setPlaying(l.scene)}>
              <SceneThumb scene={l.scene} className="shadow-[0_5px_0_#e3d6c2] transition hover:-translate-y-1" />
              <span className="mt-1 block font-black">
                {i + 1}. {l.scene.instruction_mn}
              </span>
            </button>
          </li>
        ))}
      </ol>
    </main>
  );
}

/** Back-to-back run of every judge game, DWtD style, with a scoreboard. */
function Finale({ scenes, onExit }: { scenes: Scene[]; onExit: () => void }) {
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<Result[]>([]);
  const [flash, setFlash] = useState<Result | null>(null);
  const done = index >= scenes.length;

  function onEnd(r: Result) {
    setResults((prev) => [...prev, r]);
    setFlash(r);
    setTimeout(() => {
      setFlash(null);
      setIndex((i) => i + 1);
    }, 900);
  }

  if (done) {
    const wins = results.filter((r) => r.status === "won").length;
    return (
      <main className="fixed inset-0 grid place-items-center overflow-auto bg-[#1b1b2f] p-4">
        <div className="flex w-full max-w-2xl flex-col items-center gap-4 rounded-3xl bg-card p-6 text-center">
          <h2 className="text-5xl font-black">
            {wins}/{scenes.length} 🎉
          </h2>
          <ul className="flex w-full flex-col gap-2 text-left">
            {scenes.map((s, i) => (
              <li key={i} className="flex items-start gap-2 rounded-xl bg-background p-2 font-bold">
                <span>{results[i]?.status === "won" ? "✅" : "❌"}</span>
                <span>{LESSON_BY_ID.get(s.lesson_id)?.text_mn}</span>
              </li>
            ))}
          </ul>
          <button className="btn" onClick={onExit}>
            Дуусгах
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="fixed inset-0 bg-[#1b1b2f]">
      <GameCanvas key={index} scene={scenes[index]} onEnd={onEnd} />
      <div className="absolute right-3 top-8 z-10 rounded-full bg-black/40 px-3 py-1 font-black text-white">
        {index + 1}/{scenes.length}
      </div>
      <button onClick={onExit} className="absolute left-3 top-8 z-10 grid size-11 place-items-center rounded-full bg-black/35 text-xl font-black text-white" aria-label="Гарах">
        ✕
      </button>
      {flash && (
        <div className="absolute inset-0 z-20 grid place-items-center bg-black/40 text-9xl animate-[fadeIn_150ms_ease-out]">
          {flash.status === "won" ? "✅" : "❌"}
        </div>
      )}
      <RotateHint />
    </main>
  );
}
