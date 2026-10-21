import { GAME_H, GAME_W } from "@/game/constants";
import { backdropArt, spriteArt } from "@/game/registry/art";
import { BACKDROP_BY_ID } from "@/game/registry/backdrops";
import { SPRITE_BY_ID } from "@/game/registry/sprites";
import type { Scene } from "@/game/schema";

// Static SVG preview of a scene: cheap enough to show many at once (stage
// columns, Judges' World) without spinning up Phaser.

const hex = (n: number) => `#${n.toString(16).padStart(6, "0")}`;

/** Real art centered at (x, y) with the given height, or the emoji placeholder. */
function SpriteMark({ id, x, y, height }: { id: string; x: number; y: number; height: number }) {
  const art = spriteArt(id);
  if (art) {
    const width = (height * art.w) / art.h;
    return <image href={art.src} x={x - width / 2} y={y - height / 2} width={width} height={height} />;
  }
  return (
    <text x={x} y={y} fontSize={height} textAnchor="middle" dominantBaseline="central">
      {SPRITE_BY_ID.get(id)?.emoji ?? "❓"}
    </text>
  );
}

export function SceneThumb({ scene, className = "" }: { scene: Scene; className?: string }) {
  const backdrop = backdropArt(scene.backdrop_id);
  const layers = backdrop ? [] : (BACKDROP_BY_ID.get(scene.backdrop_id)?.layers ?? []);
  return (
    <svg viewBox={`0 0 ${GAME_W} ${GAME_H}`} className={`block w-full rounded-xl bg-[#9ad7ff] ${className}`} role="img" aria-label={scene.instruction_mn}>
      {backdrop && <image href={backdrop.src} width={GAME_W} height={GAME_H} preserveAspectRatio="xMidYMid slice" />}
      {layers.map((l, i) => {
        if (l.type === "rect") return <rect key={i} x={l.x * GAME_W} y={l.y * GAME_H} width={l.w * GAME_W} height={l.h * GAME_H} fill={hex(l.color)} />;
        if (l.type === "circle") return <circle key={i} cx={l.x * GAME_W} cy={l.y * GAME_H} r={l.r * GAME_H} fill={hex(l.color)} />;
        const n = l.count * 2 - 1;
        return (
          <g key={i} fill={hex(l.color)}>
            {Array.from({ length: l.count }, (_, k) =>
              l.vertical ? (
                <rect key={k} x={(l.x + (l.w / n) * k * 2) * GAME_W} y={l.y * GAME_H} width={(l.w / n) * GAME_W} height={l.h * GAME_H} />
              ) : (
                <rect key={k} x={l.x * GAME_W} y={(l.y + (l.h / n) * k * 2) * GAME_H} width={l.w * GAME_W} height={(l.h / n) * GAME_H} />
              ),
            )}
          </g>
        );
      })}
      {scene.objects.map((o, i) => {
        const def = SPRITE_BY_ID.get(o.sprite_id);
        const x = o.x * GAME_W;
        const y = o.y * GAME_H;
        if (def?.zone) {
          const w = def.zone.w * GAME_W;
          const h = def.zone.h * GAME_H;
          return (
            <g key={i}>
              <rect x={x - w / 2} y={y - h / 2} width={w} height={h} rx={16} fill={hex(def.zone.color)} fillOpacity={0.55} stroke="#fff" strokeWidth={4} />
              <SpriteMark id={o.sprite_id} x={x} y={y} height={Math.min(h * 0.5, 44)} />
            </g>
          );
        }
        return <SpriteMark key={i} id={o.sprite_id} x={x} y={y} height={(def?.size ?? 0.15) * GAME_H} />;
      })}
      <g transform={`translate(${GAME_W / 2} 52)`}>
        <rect x={-260} y={-30} width={520} height={60} rx={20} fill="#ff7a00" />
        <text fontSize={34} fontWeight={900} fill="#fff" textAnchor="middle" dominantBaseline="central" fontFamily="var(--font-nunito)">
          {scene.instruction_mn}
        </text>
      </g>
    </svg>
  );
}
