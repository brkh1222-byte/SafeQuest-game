"use client";

import { useCallback, useSyncExternalStore } from "react";

// Nickname + avatar profiles with per-level best stars, kept in this browser.
// Every storage access is guarded: private mode or blocked storage must not
// break the game, it just forgets progress.

export interface Profile {
  nickname: string;
  avatar: string;
  stars: Record<string, number>;
}

interface Store {
  current: string | null;
  profiles: Record<string, Profile>;
}

export const AVATARS = ["🐯", "🦊", "🐻", "🐼", "🐰", "🦁", "🐸", "🐨"];

const KEY = "safequest:v1";
const EMPTY: Store = { current: null, profiles: {} };

let cache: Store | null = null;
const listeners = new Set<() => void>();

function read(): Store {
  if (cache) return cache;
  try {
    const raw = window.localStorage.getItem(KEY);
    cache = raw ? { ...EMPTY, ...JSON.parse(raw) } : EMPTY;
  } catch {
    cache = EMPTY;
  }
  return cache!;
}

function write(next: Store) {
  cache = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage unavailable: keep progress in memory for this session.
  }
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** `undefined` while not yet hydrated, `null` when no profile is selected. */
export function useProfile() {
  const store = useSyncExternalStore<Store | undefined>(subscribe, read, () => undefined);
  const profile = store === undefined ? undefined : store.current ? (store.profiles[store.current] ?? null) : null;

  const createProfile = useCallback((nickname: string, avatar: string) => {
    const s = read();
    const name = nickname.trim();
    const existing = s.profiles[name];
    write({
      current: name,
      profiles: { ...s.profiles, [name]: existing ? { ...existing, avatar } : { nickname: name, avatar, stars: {} } },
    });
  }, []);

  const signOut = useCallback(() => write({ ...read(), current: null }), []);

  const recordStars = useCallback((levelId: string, stars: number) => {
    const s = read();
    const p = s.current ? s.profiles[s.current] : null;
    if (!p || (p.stars[levelId] ?? 0) >= stars) return;
    write({ ...s, profiles: { ...s.profiles, [p.nickname]: { ...p, stars: { ...p.stars, [levelId]: stars } } } });
  }, []);

  return { profile, profiles: store ? Object.values(store.profiles) : [], createProfile, signOut, recordStars };
}

/** Level i is unlocked once the previous level has at least one star. */
export const isUnlocked = (levelIds: string[], i: number, stars: Record<string, number>) =>
  i === 0 || (stars[levelIds[i - 1]] ?? 0) > 0;
