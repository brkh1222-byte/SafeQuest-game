import type { ReactNode } from "react";
import type { Result } from "@/game/engine";
import { LESSON_BY_ID } from "@/game/registry/lessons";
import { Stars } from "./Stars";

/** Win/oops card with the sidekick's lesson. Actions are passed as children. */
export function ResultCard({ result, oops, lessonId, children }: { result: Result; oops: string; lessonId: string; children: ReactNode }) {
  const won = result.status === "won";
  const lesson = LESSON_BY_ID.get(lessonId);

  return (
    <div className="absolute inset-0 z-20 grid place-items-center bg-black/55 p-3 animate-[fadeIn_200ms_ease-out]">
      <div className="flex w-full max-w-lg flex-col items-center gap-3 rounded-3xl bg-card p-5 text-center text-foreground shadow-[0_8px_0_#e3d6c2]">
        {won ? (
          <>
            <Stars count={result.stars} className="text-4xl" />
            <h2 className="text-3xl font-black text-[#2a9d8f]">Гоё! Чи чадлаа!</h2>
          </>
        ) : (
          <h2 className="text-2xl font-black text-[#d62828]">{oops}</h2>
        )}

        {lesson && (
          <div className="flex items-start gap-3 rounded-2xl bg-background p-3 text-left">
            <span className="text-4xl leading-none" aria-hidden>
              🐿️
            </span>
            <p className="text-lg font-bold leading-snug">{lesson.text_mn}</p>
          </div>
        )}

        <div className="flex flex-wrap justify-center gap-3 pt-1">{children}</div>
      </div>
    </div>
  );
}
