# SafeQuest demo runbook

The pitch is 7–10 minutes, with about 5 minutes of live demo (spec §6). This page covers what to do before and during it, and what to do when something breaks.

## The day before

- [ ] `npm test` and `npx next build` pass on the demo laptop.
- [ ] `.env.local` is filled in (see `.env.example`): local models, `SQ_STAGE_KEY`, and `NEXT_PUBLIC_SITE_URL` set to the deployed URL, so QR codes open on phones.
- [ ] Ollama serves both models: `ollama list` shows `gemma3:4b` (or 1b) and `safequest-ft`.
- [ ] `npm run precache -- --provider local` has run, and `src/game/generate/precomputed.json` is committed and deployed.
- [ ] Full rehearsal **with Wi-Fi off**. The stage must still generate (Local), play, and fall back to labeled backup scenes.
- [ ] Phones: open `NEXT_PUBLIC_SITE_URL` on two phones, add to home screen, and check landscape and sound.

## 1 hour before

1. Start Ollama so models stay loaded for the whole session:
   `OLLAMA_KEEP_ALIVE=2h ollama serve`
   The default unloads after 5 minutes idle, and reloading is slow.
2. Start the app: `npm run build && npm start` (production is faster than `npm run dev`).
3. Open `/stage` in Chrome. Enter the stage key if asked. Wait for **🔥 N модель бэлэн** (models ready). If it says ⚠️, click it to retry and read the tooltip.
4. Do one Generate with any card, so every column has answered once.
5. Click **🧹 Цэвэрлэх** twice (clear) to empty the Judges' World from rehearsals. Saved QR links keep working.
6. Projector: browser zoom 90–100% so the three columns fit. Turn on laptop sound.
7. Have the phone hotspot on and paired, as the fallback for QR codes.

## On stage (about 5 minutes)

| Time | Action | Screen |
|---|---|---|
| 0:00 | Hook: City → **⚡ Бүгдийг дараалан** (play all), play 3–4 levels | game, sound on |
| 0:40 | Hand cards to a judge: place + danger (+ game type) | `/stage` |
| 0:50 | **✨ Тоглоом бүтээх** (generate): three columns race. Point at the base columns' failure reasons, then the fine-tune's ✅ and latency | `/stage` |
| 1:30 | **▶ Тоглох** (play): another judge plays it on the big screen | play overlay |
| 2:00 | **📱 Хадгалах + QR** (save + QR): judges scan and play on their phones | QR modal |
| 2:30 | Repeat with a free-text prompt from a judge | `/stage` |
| 3:30 | **🏆 Шүүгчдийн ертөнц → 🎬 Финал** (Judges' World finale): every judge game back to back, then the lesson scoreboard | finale |
| 4:30 | If asked: open a column's raw output and prompt; show the eval table and loss curve slides | |

## When something breaks

| Symptom | What it means | Do this |
|---|---|---|
| Fine-tune column shows **НӨӨЦ · шууд биш** | No model answered; a backup scene is shown, clearly labeled | Say so honestly ("offline backup"). Switch **Auto → Local**, re-warm, and try again |
| 🔴 next to `local` | Ollama isn't running or reachable | `OLLAMA_KEEP_ALIVE=2h ollama serve`, then click the status chips to recheck |
| First generate takes >8 s | Model wasn't loaded | Click **🔥** to warm, wait for "бэлэн" (ready) |
| Base columns show "no base model configured" | `SQ_LOCAL_MODEL_BASE` not set | Untick **3 баганаар** (3 columns) to show only the fine-tune, and explain the comparison with the eval slide |
| QR opens nothing on phones | QR points at `localhost`, or venue Wi-Fi blocks it | Set `NEXT_PUBLIC_SITE_URL`; connect phones and the laptop to the hotspot |
| "stage key required" | `SQ_STAGE_KEY` is set but not entered | Type the key in the field under the header |
| Game shows a black box instead of art | A broken or unsupported image | Delete that file from `public/sprites/`, run `npm run sprites`, restart |
| No sound | Browser mute, laptop volume, or the 🔇 toggle | Click 🔊 in the top-right of the game |

## After the demo

- Judges' World levels stay in storage (Upstash or `.data/`), so the QR links keep working for the judges afterwards.
- Save the stage screenshots and the eval results folder for the follow-up deck.
