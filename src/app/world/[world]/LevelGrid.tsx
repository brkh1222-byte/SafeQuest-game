"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Stars } from "@/components/Stars";
import type { World } from "@/game/constants";
import { LEVELS_BY_WORLD, WORLD_INFO } from "@/game/levels";
import { isUnlocked, useProfile } from "@/game/progress";

const MECHANIC_ICON = { drag_to_fix: "✋", tap_hazards: "👆", tap_safe_choice: "🤔" } as const;

export function LevelGrid({ world }: { world: World }) {
  const router = useRouter();
  const { profile } = useProfile();
  const info = WORLD_INFO.find((w) => w.id === world)!;
  const levels = LEVELS_BY_WORLD[world];
  const ids = levels.map((l) => l.id);

  useEffect(() => {
    if (profile === null) router.replace("/");
  }, [profile, router]);
  if (!profile) return null;

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-5 px-4 py-6">
      <header className="flex items-center gap-3">
        <Link href="/" className="btn-ghost px-4 py-2" aria-label="Буцах">
          ←
        </Link>
        <h1 className="text-3xl font-black">
          {info.emoji} {info.title_mn}
        </h1>
      </header>

      <ol className="grid grid-cols-3 gap-3 sm:grid-cols-5 md:grid-cols-7">
        {levels.map((level, i) => {
          const unlocked = isUnlocked(ids, i, profile.stars);
          const tile = (
            <div
              className={`flex aspect-square flex-col items-center justify-center gap-1 rounded-2xl p-1 text-center ${
                unlocked ? "text-white" : "bg-[#e9dfcf] text-muted"
              }`}
              style={unlocked ? { background: info.color, boxShadow: "0 5px 0 rgba(0,0,0,0.2)" } : undefined}
            >
              <span className="text-2xl font-black">{unlocked ? i + 1 : "🔒"}</span>
              <span className="text-lg leading-none">{MECHANIC_ICON[level.scene.mechanic]}</span>
              <Stars count={profile.stars[level.id] ?? 0} className="text-[0.7rem]" />
            </div>
          );
          return (
            <li key={level.id} title={level.title_mn}>
              {unlocked ? <Link href={`/world/${world}/${i + 1}`}>{tile}</Link> : tile}
            </li>
          );
        })}
      </ol>
    </main>
  );
}
