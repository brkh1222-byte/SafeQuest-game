"use client";

import { useState } from "react";
import type { Result } from "@/game/engine";
import { LESSON_BY_ID } from "@/game/registry/lessons";
import type { Scene } from "@/game/schema";
import { GameCanvas } from "./GameCanvas";
import { PlayControls } from "./PlayControls";
import { RotateHint } from "./RotateHint";

/**
 * Back-to-back run of micro-games, Dumb Ways to Die style, ending on a
 * scoreboard of the lessons. Used for the Judges' World finale and the City
 * "play all" demo run.
 */
export function SceneRun({ scenes, title, onExit }: { scenes: Scene[]; title: string; onExit: () => void }) {
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<Result[]>([]);
  const [flash, setFlash] = useState<Result | null>(null);
  const [round, setRound] = useState(0);
  const done = index >= scenes.length;

  function onEnd(r: Result) {
    setResults((prev) => [...prev, r]);
    setFlash(r);
    setTimeout(() => {
      setFlash(null);
      setIndex((i) => i + 1);
    }, 900);
  }

  function restart() {
    setResults([]);
    setIndex(0);
    setRound((n) => n + 1);
  }

  if (done) {
    const wins = results.filter((r) => r.status === "won").length;
    return (
      <main className="fixed inset-0 z-40 grid place-items-center overflow-auto bg-[#1b1b2f] p-4">
        <div className="flex w-full max-w-2xl flex-col items-center gap-4 rounded-3xl bg-card p-6 text-center">
          <p className="text-sm font-black text-muted">{title}</p>
          <h2 className="text-5xl font-black">
            {wins}/{scenes.length} {wins === scenes.length ? "🏆" : "🎉"}
          </h2>
          <ul className="flex max-h-[50vh] w-full flex-col gap-2 overflow-auto text-left">
            {scenes.map((s, i) => (
              <li key={i} className="flex items-start gap-2 rounded-xl bg-background p-2 font-bold">
                <span>{results[i]?.status === "won" ? "✅" : "❌"}</span>
                <span>{LESSON_BY_ID.get(s.lesson_id)?.text_mn}</span>
              </li>
            ))}
          </ul>
          <div className="flex gap-3">
            <button className="btn-ghost" onClick={onExit}>
              Дуусгах
            </button>
            <button className="btn" onClick={restart}>
              ↻ Дахин
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="fixed inset-0 z-40 bg-[#1b1b2f]">
      <GameCanvas key={`${round}-${index}`} scene={scenes[index]} onEnd={onEnd} />
      <button
        onClick={onExit}
        className="absolute left-3 top-8 z-10 grid size-11 place-items-center rounded-full bg-black/35 text-xl font-black text-white"
        aria-label="Гарах"
      >
        ✕
      </button>
      <PlayControls>
        <span className="rounded-full bg-black/40 px-3 py-1 font-black text-white">
          {index + 1}/{scenes.length}
        </span>
      </PlayControls>
      {flash && (
        <div className="absolute inset-0 z-20 grid place-items-center bg-black/40 text-9xl animate-[fadeIn_150ms_ease-out]">
          {flash.status === "won" ? "✅" : "❌"}
        </div>
      )}
      <RotateHint />
    </main>
  );
}
