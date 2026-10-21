"use client";

import type { ReactNode } from "react";
import { setMuted, useMuted } from "@/game/sound";

type LockableOrientation = ScreenOrientation & { lock?: (o: "landscape") => Promise<void> };

/** Fullscreen + landscape lock where the browser allows it (Android Chrome); harmless elsewhere. */
async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }
    await document.documentElement.requestFullscreen();
    await (screen.orientation as LockableOrientation).lock?.("landscape").catch(() => undefined);
  } catch {
    // iOS Safari has no fullscreen API for pages; the rotate hint covers it.
  }
}

/** Top-right controls shared by every play screen. Extra items render to the left. */
export function PlayControls({ children }: { children?: ReactNode }) {
  const muted = useMuted();
  const btn = "grid size-11 place-items-center rounded-full bg-black/35 text-xl text-white";
  return (
    <div className="absolute right-3 top-8 z-10 flex items-center gap-2">
      {children}
      <button className={btn} onClick={() => setMuted(!muted)} aria-label={muted ? "Дуу асаах" : "Дуу хаах"}>
        {muted ? "🔇" : "🔊"}
      </button>
      <button className={btn} onClick={toggleFullscreen} aria-label="Бүтэн дэлгэц">
        ⛶
      </button>
    </div>
  );
}
