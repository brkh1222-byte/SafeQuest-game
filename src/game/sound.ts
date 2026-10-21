"use client";

import { useSyncExternalStore } from "react";

// Tiny synthesized sound effects (Web Audio): no files to load, works offline.
// The AudioContext starts on the first user gesture, as browsers require.

export type Sfx = "tap" | "found" | "wrong" | "win" | "oops" | "tick" | "go";

const KEY = "safequest:muted";
let ctx: AudioContext | null = null;
let muted = false;
const listeners = new Set<() => void>();

try {
  muted = typeof window !== "undefined" && window.localStorage.getItem(KEY) === "1";
} catch {
  // Storage blocked: default to sound on.
}

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** One tone: frequency glide from f0 to f1 over `dur` seconds, starting `at` seconds from now. */
function tone(ac: AudioContext, f0: number, f1: number, dur: number, at = 0, type: OscillatorType = "square", vol = 0.12) {
  const t = ac.currentTime + at;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(f0, t);
  osc.frequency.exponentialRampToValueAtTime(f1, t + dur);
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(ac.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

export function play(sfx: Sfx) {
  if (muted) return;
  const ac = audio();
  if (!ac) return;
  switch (sfx) {
    case "tap":
      return tone(ac, 660, 880, 0.06, 0, "triangle", 0.08);
    case "found":
      return tone(ac, 880, 1320, 0.1, 0, "square", 0.08);
    case "go":
      tone(ac, 523, 523, 0.08, 0, "square", 0.08);
      return tone(ac, 784, 784, 0.12, 0.09, "square", 0.08);
    case "tick":
      return tone(ac, 1200, 1100, 0.03, 0, "square", 0.05);
    case "wrong":
      return tone(ac, 220, 140, 0.18, 0, "sawtooth", 0.1);
    case "win":
      [523, 659, 784, 1047].forEach((f, i) => tone(ac, f, f, 0.12, i * 0.09, "square", 0.09));
      return;
    case "oops":
      tone(ac, 440, 180, 0.35, 0, "sawtooth", 0.1);
      return tone(ac, 180, 90, 0.3, 0.3, "triangle", 0.12);
  }
}

export function setMuted(next: boolean) {
  muted = next;
  try {
    window.localStorage.setItem(KEY, next ? "1" : "0");
  } catch {
    // Not persisted; fine for this session.
  }
  listeners.forEach((l) => l());
}

export function useMuted(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => muted,
    () => false,
  );
}
