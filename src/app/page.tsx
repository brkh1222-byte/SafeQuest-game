"use client";

import Link from "next/link";
import { useState } from "react";
import { LEVELS_BY_WORLD, WORLD_INFO } from "@/game/levels";
import { AVATARS, useProfile, type Profile } from "@/game/progress";

export default function Home() {
  const { profile, profiles, createProfile, signOut } = useProfile();
  if (profile === undefined) return null;
  if (profile === null) return <ProfileForm existing={profiles} onDone={createProfile} />;
  return <WorldMap profile={profile} onSignOut={signOut} />;
}

function Brand() {
  return (
    <h1 className="text-4xl font-black tracking-tight">
      Safe<span className="text-accent">Quest</span> <span aria-hidden>🐿️</span>
    </h1>
  );
}

function ProfileForm({ existing, onDone }: { existing: Profile[]; onDone: (name: string, avatar: string) => void }) {
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState(AVATARS[0]);
  const valid = name.trim().length >= 2;

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-6 px-4 py-8 text-center">
      <Brand />
      <p className="text-lg font-semibold text-muted">Сайн уу! Чиний нэрийг хэн гэдэг вэ?</p>

      {existing.length > 0 && (
        <div className="flex flex-wrap justify-center gap-2">
          {existing.map((p) => (
            <button key={p.nickname} className="btn-ghost" onClick={() => onDone(p.nickname, p.avatar)}>
              <span className="text-2xl">{p.avatar}</span> {p.nickname}
            </button>
          ))}
        </div>
      )}

      <form
        className="flex w-full flex-col items-center gap-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) onDone(name, avatar);
        }}
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, 16))}
          placeholder="Нэр"
          aria-label="Нэр"
          autoComplete="off"
          className="w-full max-w-xs rounded-2xl border-4 border-white bg-card px-4 py-3 text-center text-2xl font-black shadow-[0_5px_0_#e3d6c2] outline-none focus:border-accent"
        />
        <div className="grid grid-cols-4 gap-3" role="radiogroup" aria-label="Аватар">
          {AVATARS.map((a) => (
            <button
              type="button"
              key={a}
              role="radio"
              aria-checked={a === avatar}
              onClick={() => setAvatar(a)}
              className={`grid size-16 place-items-center rounded-2xl text-4xl transition ${
                a === avatar ? "scale-110 bg-accent shadow-[0_5px_0_var(--accent-dark)]" : "bg-card shadow-[0_5px_0_#e3d6c2]"
              }`}
            >
              {a}
            </button>
          ))}
        </div>
        <button type="submit" className="btn text-xl disabled:opacity-40" disabled={!valid}>
          Эхлэх ▶
        </button>
      </form>
    </main>
  );
}

function WorldMap({ profile, onSignOut }: { profile: Profile; onSignOut: () => void }) {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-6">
      <header className="flex items-center justify-between gap-3">
        <Brand />
        <button className="btn-ghost py-2" onClick={onSignOut} title="Тоглогч солих">
          <span className="text-2xl">{profile.avatar}</span>
          <span className="max-w-[8rem] truncate">{profile.nickname}</span>
        </button>
      </header>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {WORLD_INFO.map((w) => {
          const levels = LEVELS_BY_WORLD[w.id];
          const open = levels.length > 0;
          const earned = levels.reduce((n, l) => n + (profile.stars[l.id] ?? 0), 0);
          const card = (
            <div
              className={`flex h-full flex-col items-center gap-2 rounded-3xl p-4 text-center text-white transition ${
                open ? "hover:-translate-y-1" : "opacity-50 grayscale"
              }`}
              style={{ background: w.color, boxShadow: "0 6px 0 rgba(0,0,0,0.2)" }}
            >
              <span className="text-6xl">{w.emoji}</span>
              <span className="text-lg font-black leading-tight">{w.title_mn}</span>
              {open ? (
                <span className="rounded-full bg-black/20 px-3 py-0.5 text-sm font-black">
                  ⭐ {earned}/{levels.length * 3}
                </span>
              ) : (
                <span className="rounded-full bg-black/20 px-3 py-0.5 text-sm font-black">Тун удахгүй</span>
              )}
            </div>
          );
          return open ? (
            <Link key={w.id} href={`/world/${w.id}`}>
              {card}
            </Link>
          ) : (
            <div key={w.id} aria-disabled>
              {card}
            </div>
          );
        })}
      </div>

      <Link
        href="/world/judges"
        className="flex items-center gap-4 rounded-3xl p-4 text-white transition hover:-translate-y-1"
        style={{ background: "#e0a800", boxShadow: "0 6px 0 rgba(0,0,0,0.2)" }}
      >
        <span className="text-5xl">🏆</span>
        <span className="flex flex-col">
          <span className="text-lg font-black">Шүүгчдийн ертөнц</span>
          <span className="text-sm font-bold opacity-90">Тайзан дээр бүтээсэн тоглоомууд</span>
        </span>
      </Link>

      <section className="flex items-center gap-3 rounded-3xl bg-card p-4 shadow-[0_5px_0_#e3d6c2]">
        <span className="text-4xl">🐿️</span>
        <p className="font-semibold">
          Тарвага: «Сайн уу, {profile.nickname}! Хотын аюулаас эхэлцгээе!»
        </p>
      </section>
    </main>
  );
}
