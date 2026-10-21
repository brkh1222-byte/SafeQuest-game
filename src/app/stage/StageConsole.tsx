"use client";

import Link from "next/link";
import QRCode from "qrcode";
import { useCallback, useEffect, useRef, useState } from "react";
import { PlayOverlay } from "@/components/PlayOverlay";
import { SceneThumb } from "@/components/SceneThumb";
import type { Mechanic } from "@/game/constants";
import type { GenerateResult, Prefer } from "@/game/generate/generate";
import type { Variant } from "@/game/generate/prompts";
import { DANGER_BY_ID, DANGER_CARDS, MECHANIC_CARDS, PLACE_CARDS, formatRequest, type GenerateRequest } from "@/game/generate/request";
import { WORLD_INFO } from "@/game/levels";
import type { Scene } from "@/game/schema";

// The presenter's screen during the pitch (spec §6): judges pick cards, three
// columns answer the same request, the fine-tuned scene gets played, saved
// and shared by QR.

interface Health {
  providers: { name: string; host: string; models: { base?: string; finetuned?: string }; reachable: boolean }[];
  storage: "upstash" | "file";
  stageKeyRequired: boolean;
  siteUrl: string | null;
}

type Run = { status: "idle" } | { status: "loading"; startedAt: number } | { status: "done"; result: GenerateResult } | { status: "error"; error: string };

const COLUMNS: { variant: Variant; title: string; subtitle: string }[] = [
  { variant: "base_naive", title: "Gemma 3 · суурь", subtitle: "Fine-tune-тэй ижил богино заавар" },
  { variant: "base_fewshot", title: "Gemma 3 · суурь + урт заавар", subtitle: "Схем, бүх ID, 3 жишээ" },
  { variant: "finetuned", title: "SafeQuest fine-tune", subtitle: "Богино заавар" },
];

const IDLE: Record<Variant, Run> = { base_naive: { status: "idle" }, base_fewshot: { status: "idle" }, finetuned: { status: "idle" } };
const WORLD_COLOR = Object.fromEntries(WORLD_INFO.map((w) => [w.id, w.color]));
const KEY_STORAGE = "safequest:stageKey";

function readKey(): string {
  try {
    return window.localStorage.getItem(KEY_STORAGE) ?? "";
  } catch {
    return "";
  }
}

export function StageConsole() {
  const [health, setHealth] = useState<Health | null>(null);
  const [stageKey, setStageKey] = useState("");
  const [placeId, setPlaceId] = useState<string>();
  const [dangerId, setDangerId] = useState<string>();
  const [mechanic, setMechanic] = useState<Mechanic>();
  const [text, setText] = useState("");
  const [prefer, setPrefer] = useState<Prefer>("auto");
  const [compare, setCompare] = useState(true);
  const [runs, setRuns] = useState(IDLE);
  const [now, setNow] = useState(0);
  const [playing, setPlaying] = useState<Scene | null>(null);
  const [share, setShare] = useState<{ url: string; qr: string } | null>(null);
  const [judgeCount, setJudgeCount] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const runId = useRef(0);
  const [warm, setWarm] = useState<Warm>({ status: "idle" });
  const autoWarmed = useRef(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const refreshHealth = useCallback(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => setHealth(null));
    fetch("/api/levels")
      .then((r) => r.json())
      .then((d: { levels: unknown[] }) => setJudgeCount(d.levels.length))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    // localStorage only exists in the browser, so read it after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStageKey(readKey());
    refreshHealth();
  }, [refreshHealth]);

  const loading = Object.values(runs).some((r) => r.status === "loading");
  useEffect(() => {
    if (!loading) return;
    const t = setInterval(() => setNow(performance.now()), 100);
    return () => clearInterval(t);
  }, [loading]);

  const place = PLACE_CARDS.find((p) => p.id === placeId);
  const dangers = DANGER_CARDS.filter((d) => !place || d.world === "any" || d.world === place.world);
  const request: GenerateRequest = { placeId, dangerId, mechanic, text: text.trim() || undefined };
  const canGenerate = Boolean(dangerId || text.trim()) && !loading;

  const headers = { "content-type": "application/json", ...(stageKey ? { "x-stage-key": stageKey } : {}) };

  const warmUp = useCallback(async () => {
    setWarm({ status: "running" });
    try {
      const res = await fetch("/api/warmup", { method: "POST", headers: stageKey ? { "x-stage-key": stageKey } : {} });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setWarm({ status: "done", models: data.models });
    } catch (e) {
      setWarm({ status: "error", error: (e as Error).message });
    }
  }, [stageKey]);

  // Load the models as soon as the stage opens, long before a judge presses the button.
  useEffect(() => {
    if (autoWarmed.current || !health?.providers.length) return;
    if (health.stageKeyRequired && !stageKey) return;
    autoWarmed.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- kicks off an async request
    warmUp();
  }, [health, stageKey, warmUp]);

  async function clearJudges() {
    if (!confirmClear) {
      setConfirmClear(true);
      setTimeout(() => setConfirmClear(false), 4000);
      return;
    }
    setConfirmClear(false);
    const res = await fetch("/api/levels", { method: "DELETE", headers });
    const data = await res.json().catch(() => ({}));
    setNotice(res.ok ? `Шүүгчдийн ертөнц цэвэрлэгдлээ (${data.cleared} тоглоом). QR холбоосууд ажилласаар байна.` : `Цэвэрлэж чадсангүй: ${data.error ?? res.status}`);
    if (res.ok) setJudgeCount(0);
  }

  async function runGenerate() {
    if (!canGenerate) return;
    const id = ++runId.current;
    const variants: Variant[] = compare ? COLUMNS.map((c) => c.variant) : ["finetuned"];
    const startedAt = performance.now();
    setNow(startedAt);
    setNotice(null);
    setRuns({ ...IDLE, ...Object.fromEntries(variants.map((v) => [v, { status: "loading", startedAt }])) });

    await Promise.all(
      variants.map(async (variant) => {
        let run: Run;
        try {
          const res = await fetch("/api/generate", { method: "POST", headers, body: JSON.stringify({ variant, request, prefer }) });
          const data = await res.json();
          run = res.ok ? { status: "done", result: data as GenerateResult } : { status: "error", error: data.error ?? `HTTP ${res.status}` };
        } catch (e) {
          run = { status: "error", error: (e as Error).message };
        }
        if (id === runId.current) setRuns((prev) => ({ ...prev, [variant]: run }));
      }),
    );
  }

  async function saveAndShare(result: GenerateResult) {
    if (!result.scene) return;
    const res = await fetch("/api/levels", {
      method: "POST",
      headers,
      body: JSON.stringify({ scene: result.scene, prompt: formatRequest(request), source: result.source, model: result.model, judge: true }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setNotice(`Хадгалж чадсангүй: ${data.error ?? res.status}`);
      return;
    }
    const base = health?.siteUrl || window.location.origin;
    const url = `${base.replace(/\/$/, "")}/play/${data.id}`;
    setShare({ url, qr: await QRCode.toDataURL(url, { margin: 1, width: 360 }) });
    setJudgeCount((n) => (n ?? 0) + 1);
  }

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 px-4 py-4">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-3xl font-black">
          Safe<span className="text-accent">Quest</span> <span className="text-muted">· Тайз</span>
        </h1>
        <StatusChips health={health} onRefresh={refreshHealth} />
        {(health?.providers.length ?? 0) > 0 && <WarmChip warm={warm} onWarm={warmUp} />}
        <Segmented
          value={prefer}
          onChange={setPrefer}
          options={[
            ["auto", "Авто"],
            ["hosted", "Hosted"],
            ["local", "Local"],
          ]}
        />
        <label className="flex items-center gap-2 text-sm font-bold">
          <input type="checkbox" checked={compare} onChange={(e) => setCompare(e.target.checked)} className="size-4 accent-[var(--accent)]" />3
          баганаар
        </label>
        <Link href="/world/judges" className="btn-ghost py-2 text-sm">
          🏆 Шүүгчдийн ертөнц{judgeCount !== null ? ` (${judgeCount})` : ""}
        </Link>
        <button
          onClick={clearJudges}
          className={`rounded-xl px-3 py-2 text-sm font-black ${confirmClear ? "bg-[#d62828] text-white" : "text-muted"}`}
          title="Бэлтгэлийн тоглоомуудыг жагсаалтаас хасна (QR холбоос ажилласаар)"
        >
          {confirmClear ? "Дахин дарж баталгаажуул" : "🧹 Цэвэрлэх"}
        </button>
      </header>

      {health?.stageKeyRequired && (
        <input
          type="password"
          value={stageKey}
          placeholder="Тайзны түлхүүр (SQ_STAGE_KEY)"
          onChange={(e) => {
            setStageKey(e.target.value);
            try {
              window.localStorage.setItem(KEY_STORAGE, e.target.value);
            } catch {
              // Not persisted; fine for this session.
            }
          }}
          className="w-64 rounded-xl border-2 border-[#e3d6c2] bg-card px-3 py-2 text-sm"
        />
      )}

      <section className="flex flex-col gap-3 rounded-3xl bg-card p-4 shadow-[0_5px_0_#e3d6c2]">
        <CardRow label="Газар">
          {PLACE_CARDS.map((p) => (
            <Chip
              key={p.id}
              active={placeId === p.id}
              color={WORLD_COLOR[p.world]}
              onClick={() => {
                const next = placeId === p.id ? undefined : p.id;
                setPlaceId(next);
                const d = dangerId ? DANGER_BY_ID.get(dangerId) : undefined;
                if (next && d && d.world !== "any" && d.world !== p.world) setDangerId(undefined);
              }}
            >
              {p.label_mn}
            </Chip>
          ))}
        </CardRow>
        <CardRow label="Аюул">
          {dangers.map((d) => (
            <Chip key={d.id} active={dangerId === d.id} color={d.world === "any" ? "#6b6b80" : WORLD_COLOR[d.world]} onClick={() => setDangerId(dangerId === d.id ? undefined : d.id)}>
              {d.emoji} {d.label_mn}
            </Chip>
          ))}
        </CardRow>
        <CardRow label="Тоглоом">
          {MECHANIC_CARDS.map((m) => (
            <Chip key={m.id} active={mechanic === m.id} color="#2b2240" onClick={() => setMechanic(mechanic === m.id ? undefined : m.id)}>
              {m.emoji} {m.label_mn}
            </Chip>
          ))}
        </CardRow>
        <form
          className="flex flex-wrap gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            runGenerate();
          }}
        >
          <input
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 200))}
            placeholder="Эсвэл бичих: жишээ нь «Хүүхэд голын мөсөн дээр гарлаа»"
            className="min-w-0 flex-1 rounded-2xl border-2 border-[#e3d6c2] bg-background px-4 py-3 text-lg font-semibold outline-none focus:border-accent"
          />
          <button type="submit" className="btn text-lg disabled:opacity-40" disabled={!canGenerate}>
            {loading ? "Бүтээж байна…" : "✨ Тоглоом бүтээх"}
          </button>
        </form>
        {(dangerId || text.trim()) && (
          <pre className="whitespace-pre-wrap rounded-xl bg-background px-3 py-2 font-mono text-xs text-muted">{formatRequest(request)}</pre>
        )}
      </section>

      {notice && <p className="rounded-xl bg-[#ffe1e1] px-4 py-2 font-bold text-[#a4161a]">{notice}</p>}

      <section className={`grid gap-4 ${compare ? "md:grid-cols-3" : "mx-auto w-full max-w-xl"}`}>
        {COLUMNS.filter((c) => compare || c.variant === "finetuned").map((c) => (
          <Column key={c.variant} {...c} run={runs[c.variant]} now={now} onPlay={setPlaying} onSave={saveAndShare} />
        ))}
      </section>

      {playing && <PlayOverlay scene={playing} onClose={() => setPlaying(null)} closeLabel="Тайз руу" />}
      {share && <ShareModal {...share} onClose={() => setShare(null)} />}
    </main>
  );
}

// ------------------------------------------------------------------ pieces

const OUTCOME_LABEL: Record<string, string> = {
  ok: "✅ Тоглох боломжтой",
  no_json: "❌ JSON гаргасангүй",
  invalid_json: "❌ Эвдэрсэн JSON",
  invalid_scene: "❌ Тоглоомд таарахгүй",
  timeout: "⏱️ Хугацаа хэтэрсэн",
  network: "📡 Холбогдсонгүй",
  http: "❌ Серверийн алдаа",
};

const SOURCE_STYLE: Record<string, { label: string; className: string }> = {
  hosted: { label: "HOSTED · шууд", className: "bg-[#dbe8ff] text-[#1d4ed8]" },
  local: { label: "LOCAL · шууд", className: "bg-[#d9f7df] text-[#15803d]" },
  cached: { label: "НӨӨЦ · шууд биш", className: "bg-[#fff1c2] text-[#a16207]" },
};

function Column(props: {
  variant: Variant;
  title: string;
  subtitle: string;
  run: Run;
  now: number;
  onPlay: (s: Scene) => void;
  onSave: (r: GenerateResult) => void;
}) {
  const { variant, title, subtitle, run, now, onPlay, onSave } = props;
  const isFt = variant === "finetuned";

  return (
    <article className={`flex min-w-0 flex-col gap-3 rounded-3xl bg-card p-4 shadow-[0_5px_0_#e3d6c2] ${isFt ? "ring-4 ring-accent" : ""}`}>
      <header>
        <h2 className="text-xl font-black">{title}</h2>
        <p className="text-sm font-semibold text-muted">
          {subtitle}
          {run.status === "done" && run.result.model ? ` · ${run.result.model}` : ""}
        </p>
      </header>

      {run.status === "idle" && <div className="grid aspect-video place-items-center rounded-xl bg-background text-4xl opacity-40">🎴</div>}

      {run.status === "loading" && (
        <div className="grid aspect-video place-items-center rounded-xl bg-background">
          <div className="flex flex-col items-center gap-2">
            <span className="animate-bounce text-5xl">🔨</span>
            <span className="font-black">Тоглоом бүтээж байна…</span>
            <span className="font-mono text-sm text-muted">{((now - run.startedAt) / 1000).toFixed(1)}s</span>
          </div>
        </div>
      )}

      {run.status === "error" && <p className="rounded-xl bg-[#ffe1e1] p-3 font-bold text-[#a4161a]">{run.error}</p>}

      {run.status === "done" && <ColumnResult result={run.result} isFt={isFt} onPlay={onPlay} onSave={onSave} />}
    </article>
  );
}

function ColumnResult({ result, isFt, onPlay, onSave }: { result: GenerateResult; isFt: boolean; onPlay: (s: Scene) => void; onSave: (r: GenerateResult) => void }) {
  const [saving, setSaving] = useState(false);
  const live = result.attempts.filter((a) => a.source !== "cached");
  const lastLive = live.at(-1);
  const outcome = result.source === "cached" ? (lastLive?.outcome ?? "ok") : (lastLive?.outcome ?? "none");
  const source = result.source ? SOURCE_STYLE[result.source] : undefined;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 text-sm font-black">
        {result.source !== "cached" && <span>{OUTCOME_LABEL[outcome] ?? "⚪ Тохируулаагүй"}</span>}
        {source && <span className={`rounded-full px-2 py-0.5 text-xs ${source.className}`}>{source.label}</span>}
        {result.source !== "cached" && result.ms > 0 && <span className="font-mono text-muted">{(result.ms / 1000).toFixed(1)}s</span>}
      </div>

      {result.source === "cached" && (
        <p className="rounded-xl bg-[#fff1c2] p-2 text-xs font-bold text-[#a16207]">
          Шууд үүсгэж чадсангүй → {result.cacheExact ? "урьдчилан үүсгэсэн" : "хамгийн ойр гар хийцийн"} тоглоом.
          {live.length > 0 && ` Оролдлого: ${live.map((a) => `${a.source} ${OUTCOME_LABEL[a.outcome] ?? a.outcome}`).join(", ")}`}
        </p>
      )}

      {result.scene ? (
        <SceneThumb scene={result.scene} />
      ) : (
        <div className="grid aspect-video place-items-center rounded-xl bg-[#2b2240] text-5xl">💥</div>
      )}

      {result.errors.length > 0 && (
        <ul className="max-h-32 overflow-auto rounded-xl bg-[#ffe1e1] p-2 font-mono text-xs text-[#a4161a]">
          {result.errors.slice(0, 6).map((e, i) => (
            <li key={i}>• {e}</li>
          ))}
          {result.errors.length > 6 && <li>… +{result.errors.length - 6}</li>}
        </ul>
      )}
      {result.warnings.length > 0 && <p className="text-xs font-semibold text-[#a16207]">⚠️ {result.warnings.join("; ")}</p>}

      {isFt && result.scene && (
        <div className="flex flex-wrap gap-2">
          <button className="btn flex-1" onClick={() => onPlay(result.scene!)}>
            ▶ Тоглох
          </button>
          <button
            className="btn-ghost flex-1 disabled:opacity-40"
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              await onSave(result);
              setSaving(false);
            }}
          >
            📱 Хадгалах + QR
          </button>
        </div>
      )}

      {result.raw !== undefined && (
        <details className="text-xs">
          <summary className="cursor-pointer font-bold text-muted">Моделийн гаралт (raw)</summary>
          <pre className="mt-1 max-h-60 overflow-auto whitespace-pre-wrap break-all rounded-xl bg-[#2b2240] p-2 font-mono text-[#e9e4ff]">{result.raw || "(хоосон)"}</pre>
        </details>
      )}
      <details className="text-xs">
        <summary className="cursor-pointer font-bold text-muted">Заавар (prompt) · {result.messages.length} мессеж</summary>
        <pre className="mt-1 max-h-60 overflow-auto whitespace-pre-wrap rounded-xl bg-background p-2 font-mono">
          {result.messages.map((m) => `[${m.role}]\n${m.content}`).join("\n\n")}
        </pre>
      </details>
    </>
  );
}

type Warm =
  | { status: "idle" | "running" }
  | { status: "done"; models: { provider: string; role: string; model: string; ok: boolean; ms: number; error?: string }[] }
  | { status: "error"; error: string };

function WarmChip({ warm, onWarm }: { warm: Warm; onWarm: () => void }) {
  const chip = "rounded-full bg-card px-3 py-1 text-xs font-black shadow-[0_3px_0_#e3d6c2]";
  if (warm.status === "running") return <span className={`${chip} animate-pulse`}>🔥 Модель халааж байна…</span>;
  if (warm.status === "done") {
    const bad = warm.models.filter((m) => !m.ok);
    const title = warm.models.map((m) => `${m.provider} ${m.role} ${m.model}: ${m.ok ? `${(m.ms / 1000).toFixed(1)}s` : m.error}`).join("\n");
    return (
      <button onClick={onWarm} className={`${chip} ${bad.length ? "text-[#a4161a]" : ""}`} title={title}>
        {bad.length ? `⚠️ ${bad.length} модель ачаалсангүй` : `🔥 ${warm.models.length} модель бэлэн`}
      </button>
    );
  }
  return (
    <button onClick={onWarm} className={chip} title={warm.status === "error" ? warm.error : "Load models into memory"}>
      {warm.status === "error" ? "⚠️ Халаах" : "🔥 Халаах"}
    </button>
  );
}

function StatusChips({ health, onRefresh }: { health: Health | null; onRefresh: () => void }) {
  if (!health) return <span className="text-sm font-bold text-muted">Төлөв ачаалж байна…</span>;
  const chip = "rounded-full bg-card px-3 py-1 text-xs font-black shadow-[0_3px_0_#e3d6c2]";
  return (
    <button onClick={onRefresh} className="flex flex-wrap gap-2" title="Дахин шалгах">
      {health.providers.length === 0 && <span className={`${chip} text-[#a16207]`}>⚠️ Модель тохируулаагүй · зөвхөн нөөц</span>}
      {health.providers.map((p) => (
        <span key={p.name} className={chip} title={`${p.host} · base: ${p.models.base ?? "—"} · ft: ${p.models.finetuned ?? "—"}`}>
          {p.reachable ? "🟢" : "🔴"} {p.name}
        </span>
      ))}
      <span className={chip}>💾 {health.storage === "upstash" ? "Upstash" : "файл (offline)"}</span>
    </button>
  );
}

function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: [T, string][] }) {
  return (
    <div className="flex rounded-xl bg-card p-1 text-sm font-black shadow-[0_3px_0_#e3d6c2]">
      {options.map(([v, label]) => (
        <button key={v} onClick={() => onChange(v)} className={`rounded-lg px-3 py-1 ${v === value ? "bg-accent text-white" : ""}`}>
          {label}
        </button>
      ))}
    </div>
  );
}

function CardRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-16 shrink-0 text-sm font-black text-muted">{label}</span>
      {children}
    </div>
  );
}

function Chip({ active, color, onClick, children }: { active: boolean; color: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className="rounded-xl border-2 px-3 py-1.5 text-sm font-black transition"
      style={active ? { background: color, borderColor: color, color: "#fff" } : { borderColor: `${color}55`, color }}
    >
      {children}
    </button>
  );
}

function ShareModal({ url, qr, onClose }: { url: string; qr: string; onClose: () => void }) {
  const isLocal = /localhost|127\.0\.0\.1|\[::1\]/.test(url);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <div className="flex max-w-md flex-col items-center gap-3 rounded-3xl bg-card p-6 text-center" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-2xl font-black">Утсаараа уншуулаад тогло! 📱</h2>
        {/* eslint-disable-next-line @next/next/no-img-element -- data URL from the qrcode lib */}
        <img src={qr} alt={`QR: ${url}`} className="size-72 rounded-xl" />
        <code className="break-all rounded-lg bg-background px-2 py-1 text-sm">{url}</code>
        {isLocal && (
          <p className="text-sm font-bold text-[#a16207]">
            ⚠️ localhost хаяг утаснаас нээгдэхгүй. NEXT_PUBLIC_SITE_URL-г тохируулах эсвэл LAN хаягаар нээнэ үү.
          </p>
        )}
        <p className="text-sm font-semibold text-muted">Шүүгчдийн ертөнцөд нэмэгдлээ 🏆</p>
        <button className="btn" onClick={onClose}>
          Болсон
        </button>
      </div>
    </div>
  );
}
