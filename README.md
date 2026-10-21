# SafeQuest

5-second safety micro-games for Mongolian kids. Spec: `.plans/safequest-spec.md`.

```bash
npm run dev     # http://localhost:3000
npm test        # engine, schema, and "every level is valid + playable"
```

## Layout

| Path | What |
|---|---|
| `src/game/schema.ts` | Scene format (spec §4) + `parseScene` validator. The fine-tuned model's output contract. |
| `src/game/engine.ts` | Pure win/lose logic for `drag_to_fix`, `tap_hazards`, `tap_safe_choice`. No rendering. |
| `src/game/geometry.ts` | Normalized → pixel bodies, hit tests, `playabilityIssues` (also for the eval script). |
| `src/game/registry/` | Sprites (emoji placeholders), backdrops (drawn shapes), vetted lesson bank. |
| `src/game/levels/city.ts` | 14 hand-built City levels; also seed examples for the fine-tune dataset. |
| `src/game/phaser/` | Phaser renderer. Draws and maps input to the engine only. |
| `src/game/progress.ts` | Nickname + avatar profiles and stars in localStorage. |
| `src/app/` | Profile screen, world map, level grid, play screen. |

## Stage and AI generation

| Route | What |
|---|---|
| `/stage` | Presenter console: judge cards and free text, then 3 columns (base naive / base few-shot / fine-tune), play, save + QR |
| `/play/<id>` | A saved level (what the QR opens) |
| `/world/judges` | Judges' World plus the back-to-back "Финал" |
| `/api/generate`, `/api/levels`, `/api/health` | The routes behind them |

Code: `src/game/generate/`. `formatRequest()` in `request.ts` is the one canonical prompt format. The fine-tune dataset and eval script must use it too, or the model sees different prompts on stage than in training.

Configure models in `.env.local` (see `.env.example`). Both providers speak the OpenAI-compatible chat API:

```bash
# Local (demo laptop): Ollama
ollama pull gemma3:4b                       # base model for the comparison
ollama create safequest-ft -f Modelfile     # from the exported GGUF
# .env.local: SQ_LOCAL_MODEL_BASE=gemma3:4b  SQ_LOCAL_MODEL_FT=safequest-ft
```

Fallback chain on each press: fine-tune = preferred provider → other provider → cached scene. Cached scenes are always labeled "НӨӨЦ · шууд биш" on screen. Base columns never fall back; their failures are the comparison. To pre-cache real fine-tune outputs, put them in `src/game/generate/precomputed.json` keyed by `formatRequest(request)`.

Saved levels use Upstash Redis when `KV_REST_API_URL`/`KV_REST_API_TOKEN` are set (Vercel Marketplace). Otherwise they go to `.data/levels.json` for offline use. Set `NEXT_PUBLIC_SITE_URL` so QR codes open on phones.

## Eval (backup evidence, spec §8)

```bash
npm run eval -- run --provider local          # 50 held-out prompts × 3 variants → eval-results/<date>-local/
npm run eval -- run --dry-run                  # print the prompts, call nothing
npm run eval -- score eval-results/<dir>       # after a native speaker fills review.csv
npm run eval -- check-leak train.jsonl         # run before EVERY training run
```

- The eval calls one provider directly for all variants. There's no fallback to other providers or to cached scenes, so numbers aren't inflated. Cases run one at a time with variants interleaved, so latency is comparable.
- `summary.md` is the slide table: valid JSON, schema-valid, **playable** (the real engine wins when the intended solution is played), card following, latency, and prompt size.
- `review.csv` is a **blind** sheet for lesson fit (y/n) and Mongolian quality (1–5). It hides variant names. Don't open `review-key.json` while rating.
- The held-out prompts live in `src/eval/heldout.ts` and must never be in training data. `check-leak` fails if any appear.

## Fine-tune dataset (spec §7)

```bash
npm run data -- status
npm run data -- expand --calls 10             # Claude writes ~40 new scenes, aimed at the least-covered danger × game type
npm run data -- review-sheet                  # data/review.csv for a native speaker
npm run data -- apply-review                  # record approve/reject + Mongolian fixes
npm run data -- build                         # data/out/train.jsonl, val.jsonl, stats.md
```

- **Seeds**: the 23 hand-built scenes, each with card requests plus its instruction as free text. They're rebuilt from code on every run.
- **Expand**: `claude-opus-5-5` with adaptive thinking (`--effort high`), a cached system prompt, and server-side refusal fallback. It needs `ANTHROPIC_API_KEY` (or `ant auth login`). Each scene comes back with 4–5 judge-style requests: full cards, partial cards, and free Mongolian text in mixed styles. Raw replies are kept in `data/raw/`.
- **Automatic vetting** throws out anything that isn't a perfect target: schema errors, layout warnings, scenes the engine can't win, duplicates, and requests the scene doesn't actually answer (wrong place, game type, or danger). It also removes anything matching a held-out eval prompt. Reasons go to `data/rejected.jsonl`.
- **Review** in the browser at `/dev/review` while `npm run dev` is running (dev only). Each pending scene is shown as a picture and can be played; fix the Mongolian, then press A to approve, R to reject or S to skip. Decisions go to `data/reviews.json`, the same file the CSV route writes, so reviewers can use either.
- **Build** includes only reviewed and approved expansions (`--include-unreviewed` is for throwaway test runs). It re-vets reviewer fixes and splits train/val by scene, not by row. It refuses to write if any held-out prompt leaked. `stats.md` flags lessons and danger × game-type combos with fewer than 3 scenes; expand those next.
- **Format**: chat JSONL whose system prompt and user text are exactly what `/stage` sends. Gemma 3 has no system role, so make sure your training chat template and Ollama's template both fold the system text into the first user turn. Unsloth's `gemma-3` template and Ollama's `gemma3` template both do.

## Training → demo loop

1. **Pick 1B vs 4B (day 1).** Install Ollama and run `ollama pull gemma3:4b` and `ollama pull gemma3:1b`. Then run `npm run eval -- run --provider local --variants base_naive --limit 10` once per size (set `SQ_LOCAL_MODEL_BASE`), and read the median latency. Use 4B if it fits the 8 s budget on the demo laptop.
2. **Dataset:** `npm run data -- build` (see above), then `npm run eval -- check-leak data/out/train.jsonl`.
3. **Train:** open `training/safequest_finetune.ipynb` in Colab (T4) and upload `train.jsonl` and `val.jsonl`. Set `MODEL` from step 1 and run all cells. It asserts that the prompt format matches Gemma 3's chat template, then trains on the answers only. It saves `loss_curve.png` and `training_log.csv` (backup slide) and exports a GGUF.
4. **Serve locally:** put the GGUF in `training/` as `safequest-ft.gguf`, run `ollama create safequest-ft -f training/Modelfile`, and set `SQ_LOCAL_MODEL_FT=safequest-ft`. The Modelfile template mirrors the notebook's `render_prompt` exactly. If you change one, change the other.
5. **Measure:** `npm run eval -- run --provider local`, then have a native speaker fill `review.csv` and run `npm run eval -- score <dir>`.
6. **Pre-cache:** `npm run precache -- --provider local` covers all 436 card combinations the stage offers. It only keeps scenes that are clean, winnable and follow every card, and it can be resumed. Restart the dev server or redeploy afterwards.

## Adding a level

Add a scene to `src/game/levels/city.ts`. `npm test` fails if it uses unknown IDs, breaks a mechanic rule, or has overlapping or off-screen objects.

## Before the demo

- Mongolian copy (instructions, oops lines, lessons) needs a native-speaker pass. Lessons also need checking against NEMA, Red Cross Mongolia, and UNICEF sources (`source` field).
- Art: drop `public/sprites/<sprite_id>.png` (or `.svg`) files in and run `npm run sprites`. That prints what's still missing and at what size, and updates the manifest. Each file replaces its emoji everywhere; levels don't change. Brief for artists: `docs/art.md`.
# SafeQuest-game
