import "server-only";
import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { Redis } from "@upstash/redis";
import type { Scene } from "@/game/schema";

// Saved levels behind the QR codes, plus the Judges' World list.
// Upstash Redis (Vercel Marketplace) when its env vars exist; otherwise a JSON
// file under .data/ for the offline laptop demo and local development.

export interface StoredLevel {
  id: string;
  scene: Scene;
  prompt: string;
  source: string;
  model?: string;
  createdAt: string;
}

export interface LevelStore {
  kind: "upstash" | "file";
  save(level: Omit<StoredLevel, "id" | "createdAt">, opts: { judge: boolean }): Promise<StoredLevel>;
  get(id: string): Promise<StoredLevel | null>;
  listJudges(): Promise<StoredLevel[]>;
}

// No look-alike characters, so a typed short link is hard to get wrong.
const ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz";
const newId = () => Array.from(randomBytes(6), (b) => ALPHABET[b % ALPHABET.length]).join("");
export const isLevelId = (id: string) => /^[2-9a-hjkmnp-z]{6}$/.test(id);

const JUDGES_KEY = "sq:judges";
const levelKey = (id: string) => `sq:level:${id}`;

function upstashStore(redis: Redis): LevelStore {
  return {
    kind: "upstash",
    async save(level, { judge }) {
      const stored: StoredLevel = { ...level, id: newId(), createdAt: new Date().toISOString() };
      await redis.set(levelKey(stored.id), stored);
      if (judge) await redis.rpush(JUDGES_KEY, stored.id);
      return stored;
    },
    async get(id) {
      return (await redis.get<StoredLevel>(levelKey(id))) ?? null;
    },
    async listJudges() {
      const ids = await redis.lrange<string>(JUDGES_KEY, 0, -1);
      if (!ids.length) return [];
      const levels = await redis.mget<(StoredLevel | null)[]>(...ids.map(levelKey));
      return levels.filter((l): l is StoredLevel => !!l);
    },
  };
}

interface FileData {
  levels: Record<string, StoredLevel>;
  judges: string[];
}

function fileStore(file: string): LevelStore {
  const load = async (): Promise<FileData> => {
    try {
      return JSON.parse(await readFile(file, "utf8")) as FileData;
    } catch {
      return { levels: {}, judges: [] };
    }
  };
  // Serialize writes so two quick saves can't drop each other.
  let queue: Promise<unknown> = Promise.resolve();
  const update = <T>(fn: (d: FileData) => T): Promise<T> => {
    const next = queue.then(async () => {
      const data = await load();
      const out = fn(data);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, JSON.stringify(data, null, 2));
      return out;
    });
    queue = next.catch(() => undefined);
    return next;
  };

  return {
    kind: "file",
    save(level, { judge }) {
      return update((d) => {
        const stored: StoredLevel = { ...level, id: newId(), createdAt: new Date().toISOString() };
        d.levels[stored.id] = stored;
        if (judge) d.judges.push(stored.id);
        return stored;
      });
    },
    async get(id) {
      return (await load()).levels[id] ?? null;
    },
    async listJudges() {
      const d = await load();
      return d.judges.map((id) => d.levels[id]).filter(Boolean);
    },
  };
}

let store: LevelStore | undefined;

export function getLevelStore(): LevelStore {
  if (store) return store;
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  store = url && token ? upstashStore(new Redis({ url, token })) : fileStore(path.join(process.cwd(), ".data", "levels.json"));
  return store;
}
