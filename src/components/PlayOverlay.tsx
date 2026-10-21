"use client";

import { useState } from "react";
import type { Result } from "@/game/engine";
import type { Scene } from "@/game/schema";
import { GameCanvas } from "./GameCanvas";
import { ResultCard } from "./ResultCard";
import { PlayControls } from "./PlayControls";
import { RotateHint } from "./RotateHint";

/** Fullscreen play of a single scene with retry. Used by the stage and saved levels. */
export function PlayOverlay({ scene, onClose, closeLabel = "✕ Хаах" }: { scene: Scene; onClose?: () => void; closeLabel?: string }) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<Result | null>(null);

  return (
    <div className="fixed inset-0 z-40 bg-[#1b1b2f]">
      <GameCanvas key={attempt} scene={scene} onEnd={setResult} />
      {onClose && (
        <button
          onClick={onClose}
          className="absolute left-3 top-8 z-10 grid size-11 place-items-center rounded-full bg-black/35 text-xl font-black text-white"
          aria-label="Хаах"
        >
          ✕
        </button>
      )}
      {result && (
        <ResultCard result={result} oops={scene.oops_mn} lessonId={scene.lesson_id}>
          {onClose && (
            <button className="btn-ghost" onClick={onClose}>
              {closeLabel}
            </button>
          )}
          <button
            className="btn"
            onClick={() => {
              setResult(null);
              setAttempt((a) => a + 1);
            }}
          >
            ↻ Дахин
          </button>
        </ResultCard>
      )}
      <PlayControls />
      <RotateHint />
    </div>
  );
}
