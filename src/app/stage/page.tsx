import type { Metadata } from "next";
import { StageConsole } from "./StageConsole";

export const metadata: Metadata = { title: "SafeQuest · Тайз" };

export default function StagePage() {
  return <StageConsole />;
}
