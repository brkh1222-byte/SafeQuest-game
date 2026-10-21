import { notFound } from "next/navigation";
import { isWorld, WORLD_INFO } from "@/game/levels";
import { LevelGrid } from "./LevelGrid";

// Everything here is static and tiny; a blocking navigation is fine.
export const instant = false;

export function generateStaticParams() {
  return WORLD_INFO.map((w) => ({ world: w.id }));
}

export default async function WorldPage({ params }: PageProps<"/world/[world]">) {
  const { world } = await params;
  if (!isWorld(world)) notFound();
  return <LevelGrid world={world} />;
}
