"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PlayOverlay } from "@/components/PlayOverlay";
import { SceneRun } from "@/components/SceneRun";
import { SceneThumb } from "@/components/SceneThumb";
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

  if (finale && levels?.length) return <SceneRun title="🏆 Шүүгчдийн ертөнц · Финал" scenes={levels.map((l) => l.scene)} onExit={() => setFinale(false)} />;
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
