# SafeQuest — Spec

Hackathon: "Fine-tune for the Future: Equal Access to Health, Education, Skills" (Mongolia, 2 weeks).
Owner: Joe (product + build). Teammates: presentation, TDD.
Status: interview complete, 2026-10-21. Working name "SafeQuest" (English brand; all in-game text is Mongolian).

---

## 1. One-liner

A *Dumb Ways to Die*-style game of 5-second micro-games that teaches Mongolian kids what to do and what not to do around everyday hazards. A small fine-tuned model (Gemma 3) turns any danger a judge picks into a new playable micro-game in Mongolian within seconds.

## 2. Equal-access framing

- **Group:** Mongolian children, especially those without access to safety education in their own language.
- **Barrier:** Child-safety material is scarce in Mongolian, often print-only or in Russian/English, and is not tailored to local hazards (ger stoves, river ice, UB traffic).
- **Why the base model fails:** A small open model cannot produce a game scene that is valid for our engine, written in natural kid-level Mongolian, and correct about safety, all at once. Large models need long prompts and are slow and expensive.
- **What the fine-tune removes:** A small model that runs locally outputs engine-valid, Mongolian, safety-correct scenes from a one-line prompt. New content then costs close to nothing to make.
- **Pitch opener (presentation team):** Mongolian child injury and death statistics (NSO, WHO, NEMA): CO poisoning, traffic, burns, drowning or ice.

> Note: the SISERION judge's prize was a native-language *legal assistant*. SafeQuest is a game for kids, not an assistant, so it does not look derivative.

## 3. Player experience

### Audience and device
- Kids of all ages, playing **alone**.
- **Phone, landscape**, touch first. On stage, the laptop shows the game in a phone-shaped landscape frame.
- Web app, online. No install.

### Identity
- The kid picks a **nickname and avatar**. No password. Progress (stars, unlocked levels) is saved in the browser per nickname.

### Characters
- **Kid hero**: a Mongolian kid who appears in every scene and is the one in danger.
- **Animal sidekick** (e.g. a marmot or a small horse; decided during the art pass): delivers the "oops" reaction and the lesson.

### Structure: themed worlds
- **City (Ulaanbaatar)** is the only hand-built world in the demo build: **12–15 micro-games**, each with a star rating.
- Ger, Steppe, and Home & Health appear on the world map as "coming soon". Their **sprites still exist**, because live generation can use them (see §5).
- **Judges' World**: a world that fills up live during the pitch with games the judges generate (see §6).

### Micro-game mechanics (engine templates)
Every scene uses exactly one mechanic. Planned mix: mostly the first two.

| Mechanic | Player action | Win condition |
|---|---|---|
| `drag_to_fix` (primary) | Drag the kid or an object to a safe target zone | Correct object dropped in a valid zone before the timer ends |
| `tap_hazards` (primary) | Tap every dangerous object in the scene | All hazards tapped, no safe object tapped, before the timer ends |
| `tap_safe_choice` (sometimes) | 2–3 picture options; tap the safe one | Correct option tapped before the timer ends |

- Each micro-game lasts about 5 s. It shows a **2–4 word Mongolian instruction plus an animated hand or arrow hint**, so kids who cannot read yet still know what to do. There is no audio for instructions in v1.

### Failure tone
- **Cartoon "oops", never death.** The hero gets dizzy, soaked, or singed in a comic way. The sidekick then says the one-sentence lesson. The tone must be safe for parents, teachers, and judges.

## 4. Scene format (the model's output contract)

The model outputs one JSON object. The engine only accepts IDs that exist in the asset and lesson registries.

```jsonc
{
  "world": "city" | "ger" | "steppe" | "home",
  "backdrop_id": "city_crosswalk",
  "mechanic": "drag_to_fix" | "tap_hazards" | "tap_safe_choice",
  "instruction_mn": "Хүүхдийг замаас холдуул!",   // 2–4 words
  "objects": [
    { "sprite_id": "kid_hero", "x": 0.2, "y": 0.7, "role": "draggable" },
    { "sprite_id": "car_red",  "x": 0.6, "y": 0.6, "role": "hazard" },
    { "sprite_id": "sidewalk_zone", "x": 0.1, "y": 0.8, "role": "target" }
  ],
  "time_limit_s": 5,
  "oops_mn": "Ой! Машин ойртож байна!",           // short failure reaction
  "lesson_id": "traffic_wait_green"              // from the vetted lesson bank
}
```

- Coordinates are normalized to 0–1 in landscape space.
- `role` depends on the mechanic: `draggable`, `target`, `hazard`, `safe`, `option_correct`, `option_wrong`, `decor`.
- **Guardrail:** the model **does not write the lesson text**. It picks a `lesson_id` from a vetted bank of about 60 lessons, written in Mongolian and checked against official sources (NEMA, Red Cross Mongolia, UNICEF). Only `instruction_mn` and `oops_mn` are free text. This way the model cannot teach a child a wrong safety rule.
- Validation (Zod): known `sprite_id`, `backdrop_id`, and `lesson_id`; the mechanic has the roles it needs (e.g. `drag_to_fix` has at least one draggable and at least one target); coordinates are in range; text length limits hold. A scene that fails validation is rejected, and the fallback chain runs (see §7).

## 5. Assets

- **Sprite library for all four worlds** (City, Ger, Steppe, Home & Health). The model only places sprites; it never draws them.
- Source: **free CC0 packs (e.g. Kenney) for generic objects** plus **AI-generated Mongolian items** (ger, coal stove, chimney, khashaa fence, deel-wearing hero, horse, river ice, etc.). Everything is post-processed into one flat style and palette, with transparent backgrounds.
- Rough target: about 50 City sprites, about 15–25 each for the other worlds, plus 4–8 backdrops per world.
- A **sprite registry** (`id`, world, tags, default size, allowed roles) is the single source of truth. It is used by the validator, by the training-data generator, and in the model's prompt vocabulary.

## 6. Live demo (centerpiece)

Slot: **7–10 minutes, about 5 of them live demo.** Suggested flow:

1. **Hook (presentation team):** injury statistics, then a 20-second City playthrough on screen.
2. **Judge makes a game:** a judge combines **picture cards** (place, danger, mechanic) or types free text, e.g. "Гол дээрх нимгэн мөс" ("thin ice on a river").
3. **Three-column comparison** of the same prompt:
   - Base Gemma 3, naive prompt (only the judge's prompt and a one-line instruction).
   - Base Gemma 3, few-shot prompt (full schema and examples).
   - **Fine-tuned Gemma 3** (short prompt).
   The base columns produce broken JSON, unknown sprites, wrong or unsafe content, or awkward Mongolian, or they are slow. The fine-tuned column becomes a playable scene.
4. **Another judge plays it** on the big screen.
5. **QR code** appears. Judges open the generated level on their own phones. The game is also added to the **Judges' World**.
6. **Finale:** all judge-made games played back to back.
7. **Backup slide (shown if asked):** the eval table and training loss (see §8).

**Latency budget:** under **8 s** from pressing Generate to a playable scene. A "building your game" animation fills the wait. The 3-column view may run the three requests in parallel.

## 7. AI system

### Model and training
- **Base:** Gemma 3, 1B or 4B. Choose using the latency test on the demo laptop. 4B is preferred if it stays under 8 s locally.
- **Method:** LoRA with Unsloth on **Colab free T4**.
- **Data pipeline:**
  1. The team hand-writes about 40–60 perfect seed scenes across all worlds and mechanics.
  2. A large model (Claude or GPT) expands them into several hundred to about 1,000 (prompt → scene JSON) pairs. Prompts imitate how a judge would phrase things: card combinations and free text in Mongolian, short or long, with typos.
  3. Automatic filtering with the same Zod validator, then a human review pass for Mongolian quality and for whether the `lesson_id` fits the scene.
  4. Hold out 50 prompts for evaluation. They must never appear in the training data.
- Save Colab training logs and the loss curve. Organizers may ask for them.

### Serving
- **Primary (product):** a hosted endpoint (Hugging Face or Together) behind a Next.js API route.
- **Demo fallback:** the LoRA merged and exported to GGUF, running in **Ollama on the demo laptop**. A switch in the stage console selects it. This also supports the "runs with no internet" story for the UYACH judge.
- **Fallback chain for each Generate press:** hosted → local → **pre-cached scene** for that card combination. Pre-generate scenes for every card combination you expect, so the stage never shows an empty screen.

### Generated-level storage
- Every valid generated scene gets a short ID and is stored server-side in a small KV/Redis store from the Vercel Marketplace. It is served at `/play/<id>`, and that link is what the QR code points to. The Judges' World is a list of these IDs.

## 8. Evaluation (backup evidence)

A cheap script on the 50 held-out prompts, run for each variant: naive base, few-shot base, fine-tuned.

| Metric | How |
|---|---|
| Valid JSON % | parses |
| Schema-valid % | passes Zod (known IDs, required roles) |
| Playable % | the mechanic engine can reach a win state |
| Lesson fit % | spot-check by a human or an LLM judge on a sample |
| Mongolian quality | small human rating (1–5) on a sample |
| Median latency | same hardware for all variants |

The output is one table plus the loss curve, used for one backup slide.

## 9. Architecture

- **Next.js (App Router) + Phaser 3** on Vercel.
  - Next.js handles menus, the nickname/avatar screen, the world map, `/play/<id>`, the **stage console** (`/stage`: card picker, free-text input, 3-column comparison, model switch, QR display), and the API routes.
  - Phaser renders the micro-game scenes. Phaser scenes are thin; game logic lives in pure TypeScript.
- **Pure TS packages:**
  - `scene-schema`: Zod schema and registries (sprites, backdrops, lessons).
  - `mechanics`: win/lose state machines for each mechanic, with no rendering. Phaser and the eval script both use them.
  - `generate`: prompt builders (naive, few-shot, fine-tuned), provider adapters (hosted, Ollama), JSON repair or reject, and the fallback chain.
- API routes: `POST /api/generate` (variant, prompt) → scene or error with timing; `POST /api/levels` → id; `GET /api/levels/:id`.

## 10. Ownership

- **Joe:** product, Phaser and Next build, scene schema and registries, data pipeline, fine-tune, serving, stage console.
- **TDD teammates (first priorities):**
  1. **Mechanic engines:** tests for win and lose logic in `drag_to_fix`, `tap_hazards`, `tap_safe_choice`, including edge cases (timer reaching zero while dragging, tapping a safe object, an option tapped twice).
  2. **Eval script:** the harness from §8, runnable from the CLI and producing a table.
- **Presentation teammates:** evidence, deck, judge cards, stage choreography and rehearsal.

## 11. Timeline (14 days, suggested)

| Days | Milestone |
|---|---|
| 1–2 | Scene schema and registries; benchmark Gemma 3 1B vs 4B for local latency; seed scenes started; art style locked |
| 3–5 | Mechanic engines (TDD) and Phaser renderer; first 5 City games playable; sprite pass 1 |
| 5–7 | Data expansion and filtering; first LoRA run; eval script working |
| 8–9 | City reaches 12–15 games; nickname/avatar, world map, stars; stage console |
| 10–11 | Second LoRA run on cleaned data; GGUF and Ollama; hosted endpoint; fallback chain; KV and QR |
| 12 | Pre-cache scenes for all card combinations; eval table; sprites for all four worlds done |
| 13–14 | Full rehearsals with offline Wi-Fi drills; bug fixes; freeze |

## 12. Explicit non-goals (v1)

- Measuring learning outcomes (no pre/post quiz, no pilot). Pitched as roadmap only.
- Business model. "Free" for now.
- Hand-built Ger, Steppe, and Home worlds (their sprites exist for generation only).
- Voice instructions or TTS, parent accounts, offline/PWA, on-device model in the browser.

## 13. Risks and open questions

- **Pinecone judge (learning outcomes)** and **TechPack judge (who pays)** get weak answers because of the non-goals above. Prepare at least one sentence each for Q&A, e.g. "next step: classroom pilot with pre/post quiz", "distribution via telco/schools/NEMA campaigns".
- **Gemma 3 Mongolian quality:** if it is still weak after fine-tuning, keep `instruction_mn` and `oops_mn` very short, or let the model choose from phrase templates.
- **The QR code needs internet.** If the venue network is down, the QR step fails even when local generation works. Mitigation: a phone hotspot for the laptop, and pre-uploaded cached levels.
- **Hosted inference for a custom LoRA may cost money** (HF Inference Endpoints, Together dedicated). Confirm the cheapest option on day 1. If nothing is free, the "hosted" path can be the laptop behind a tunnel during the event.
- **Fairness of the comparison:** keep the exact prompts for all three columns in the repo and show them if a judge asks.
- **Art consistency** between CC0 packs and AI-generated items: lock the palette and outline style on day 2.
- Ask organizers: are training logs or eval metrics expected? What is the exact slot length? Is a projector or second screen available for the 3-column view?
