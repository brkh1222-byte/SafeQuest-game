"use client";

import { useEffect, useRef } from "react";
import type { Result } from "@/game/engine";
import type { Scene } from "@/game/schema";

/** Mounts one Phaser micro-game. Remount (change `key`) to replay. */
export function GameCanvas({ scene, onEnd }: { scene: Scene; onEnd: (r: Result) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const onEndRef = useRef(onEnd);

  useEffect(() => {
    onEndRef.current = onEnd;
  }, [onEnd]);

  useEffect(() => {
    let cancelled = false;
    let game: { destroy: (removeCanvas: boolean) => void } | undefined;

    (async () => {
      const [{ createGame }, { rasterizeSvgArt }] = await Promise.all([
        import("@/game/phaser/createGame"),
        import("@/game/phaser/rasterize"),
        // Phaser draws text to canvas, so the web font must be ready first.
        document.fonts?.ready,
      ]);
      const svgArt = await rasterizeSvgArt(scene);
      const fontFamily = getComputedStyle(document.body).fontFamily;
      await document.fonts?.load(`900 32px ${fontFamily}`, "Ой").catch(() => undefined);
      if (cancelled || !ref.current) return;
      game = createGame(ref.current, { scene, fontFamily, svgArt, onEnd: (r) => onEndRef.current(r) });
    })();

    return () => {
      cancelled = true;
      game?.destroy(true);
    };
  }, [scene]);

  return <div ref={ref} className="absolute inset-0 touch-none" />;
}
