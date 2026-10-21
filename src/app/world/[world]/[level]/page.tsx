import { notFound } from "next/navigation";
import { isWorld, LEVELS_BY_WORLD } from "@/game/levels";
import { PlayScreen } from "./PlayScreen";

// Everything here is static and tiny; a blocking navigation is fine.
export const instant = false;

export function generateStaticParams() {
  return Object.entries(LEVELS_BY_WORLD).flatMap(([world, levels]) =>
    levels.map((_, i) => ({ world, level: String(i + 1) })),
  );
}

export default async function LevelPage({ params }: PageProps<"/world/[world]/[level]">) {
  const { world, level } = await params;
  if (!isWorld(world)) notFound();
  const index = Number(level) - 1;
  if (!Number.isInteger(index) || !LEVELS_BY_WORLD[world][index]) notFound();
  return <PlayScreen world={world} index={index} />;
}
