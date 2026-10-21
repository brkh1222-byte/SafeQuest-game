"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { GameCanvas } from "@/components/GameCanvas";
import { ResultCard } from "@/components/ResultCard";
import { RotateHint } from "@/components/RotateHint";
import type { World } from "@/game/constants";
import type { Result } from "@/game/engine";
import { LEVELS_BY_WORLD } from "@/game/levels";
import { useProfile } from "@/game/progress";

export function PlayScreen({ world, index }: { world: World; index: number }) {
  const router = useRouter();
  const { profile, recordStars } = useProfile();
  const level = LEVELS_BY_WORLD[world][index];
  const hasNext = index + 1 < LEVELS_BY_WORLD[world].length;
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    if (profile === null) router.replace("/");
  }, [profile, router]);

  const onEnd = useCallback(
    (r: Result) => {
      setResult(r);
      if (r.status === "won") recordStars(level.id, r.stars);
    },
    [level.id, recordStars],
  );

  if (!profile) return null;
  const won = result?.status === "won";

  return (
    <main className="fixed inset-0 bg-[#1b1b2f]">
      <GameCanvas key={`${level.id}-${attempt}`} scene={level.scene} onEnd={onEnd} />

      <Link
        href={`/world/${world}`}
        className="absolute left-3 top-8 z-10 grid size-11 place-items-center rounded-full bg-black/35 text-xl font-black text-white"
        aria-label="Гарах"
      >
        ✕
      </Link>

      {result && (
        <ResultCard result={result} oops={level.scene.oops_mn} lessonId={level.scene.lesson_id}>
          <Link href={`/world/${world}`} className="btn-ghost" aria-label="Газрын зураг">
            🗺️
          </Link>
          <button
            className={won ? "btn-ghost" : "btn"}
            onClick={() => {
              setResult(null);
              setAttempt((a) => a + 1);
            }}
          >
            ↻ Дахин
          </button>
          {won && hasNext && (
            <Link href={`/world/${world}/${index + 2}`} className="btn">
              Дараах ▶
            </Link>
          )}
        </ResultCard>
      )}
      <RotateHint />
    </main>
  );
}
