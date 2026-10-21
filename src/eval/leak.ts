import { formatRequest } from "@/game/generate/request";
import type { EvalCase } from "./heldout";

// A held-out prompt that leaks into training data makes the eval meaningless.
// Checks a chat-format JSONL dataset (one {"messages": [...]} per line).

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

export interface Leak {
  caseId: string;
  line: number;
  reason: "same prompt" | "same free text";
}

export function findLeaks(cases: EvalCase[], jsonl: string): Leak[] {
  const prompts = cases.map((c) => ({ id: c.id, prompt: norm(formatRequest(c.request)), text: c.request.text ? norm(c.request.text) : null }));
  const leaks: Leak[] = [];

  jsonl.split(/\r?\n/).forEach((raw, i) => {
    if (!raw.trim()) return;
    let users: string[];
    try {
      const row = JSON.parse(raw) as { messages?: { role: string; content: string }[] };
      users = (row.messages ?? []).filter((m) => m.role === "user").map((m) => norm(m.content));
    } catch {
      throw new Error(`line ${i + 1} is not valid JSON`);
    }
    for (const p of prompts) {
      if (users.some((u) => u === p.prompt)) leaks.push({ caseId: p.id, line: i + 1, reason: "same prompt" });
      else if (p.text && users.some((u) => u.includes(p.text!))) leaks.push({ caseId: p.id, line: i + 1, reason: "same free text" });
    }
  });
  return leaks;
}
