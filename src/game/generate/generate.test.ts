import { describe, expect, it } from "vitest";
import { CITY_LEVELS } from "../levels/city";
import { EXTRA_SCENES } from "../levels/extra";
import { playabilityIssues } from "../geometry";
import { parseScene } from "../schema";
import { findCachedScene } from "./cached";
import { generate, orderProviders } from "./generate";
import { evaluateOutput, extractJsonObject } from "./parse";
import { buildMessages, SHORT_SYSTEM } from "./prompts";
import { chat, providersFromEnv, type ProviderConfig } from "./providers";
import { formatRequest, GenerateRequestSchema } from "./request";

const goodScene = CITY_LEVELS[0].scene;
const req = { placeId: "city_crosswalk", dangerId: "traffic" };

const reply = (content: string) =>
  new Response(JSON.stringify({ choices: [{ message: { content } }] }), { headers: { "content-type": "application/json" } });

/** Fake fetch routing by model name: string → reply, Error → thrown, number → HTTP status. */
const fakeFetch = (byModel: Record<string, string | Error | number>): typeof fetch =>
  (async (_url: string, init: RequestInit) => {
    const { model } = JSON.parse(String(init.body));
    const r = byModel[model];
    if (r instanceof Error) throw r;
    if (typeof r === "number") return new Response("nope", { status: r });
    return reply(r ?? "");
  }) as typeof fetch;

const hosted: ProviderConfig = { name: "hosted", url: "https://h/v1", models: { base: "h-base", finetuned: "h-ft" }, timeoutMs: 1000 };
const local: ProviderConfig = { name: "local", url: "http://l/v1", models: { base: "l-base", finetuned: "l-ft" }, timeoutMs: 1000 };

describe("extractJsonObject / evaluateOutput", () => {
  it("pulls JSON out of fences and chatter", () => {
    const raw = "Here you go:\n```json\n" + JSON.stringify(goodScene) + "\n```\nEnjoy!";
    expect(evaluateOutput(raw)).toMatchObject({ stage: "ok", errors: [] });
  });

  it("handles braces inside strings", () => {
    expect(extractJsonObject('x {"a":"}{","b":{"c":1}} y')).toBe('{"a":"}{","b":{"c":1}}');
  });

  it("repairs trailing commas", () => {
    const raw = JSON.stringify(goodScene).replace(/}]/, "},]");
    expect(evaluateOutput(raw).stage).toBe("ok");
  });

  it("reports how far bad output got", () => {
    expect(evaluateOutput("Би тоглоом хийж чадахгүй").stage).toBe("no_json");
    expect(evaluateOutput('{"world": "city",').stage).toBe("no_json");
    expect(evaluateOutput('{"world": city}').stage).toBe("invalid_json");
    expect(evaluateOutput(JSON.stringify({ ...goodScene, lesson_id: "eat_snow" }))).toMatchObject({ stage: "invalid_scene" });
  });
});

describe("prompts", () => {
  it("gives naive base and fine-tune the identical short prompt", () => {
    expect(buildMessages("base_naive", req)).toEqual(buildMessages("finetuned", req));
    expect(buildMessages("finetuned", req)[0].content).toBe(SHORT_SYSTEM);
  });

  it("gives the few-shot column the registries and examples", () => {
    const msgs = buildMessages("base_fewshot", req);
    expect(msgs[0].content).toContain("thin_ice");
    expect(msgs[0].content).toContain("traffic_wait_green");
    expect(msgs.filter((m) => m.role === "assistant")).toHaveLength(3);
    expect(msgs.at(-1)).toEqual({ role: "user", content: formatRequest(req) });
  });

  it("formats requests canonically", () => {
    expect(formatRequest({ placeId: "steppe_river", dangerId: "thin_ice", mechanic: "drag_to_fix", text: "хүүхэд" })).toBe(
      "Газар: Голын эрэг (steppe_river)\nАюул: Нимгэн мөс\nТоглоом: drag_to_fix\nТайлбар: хүүхэд",
    );
  });

  it("rejects empty or unknown requests", () => {
    expect(GenerateRequestSchema.safeParse({ placeId: "city_street" }).success).toBe(false);
    expect(GenerateRequestSchema.safeParse({ dangerId: "dragons" }).success).toBe(false);
    expect(GenerateRequestSchema.safeParse({ text: "гал" }).success).toBe(true);
  });
});

describe("providers", () => {
  it("only configures what env provides", () => {
    expect(providersFromEnv({})).toEqual([]);
    const ps = providersFromEnv({ SQ_LOCAL_MODEL_FT: "sq-ft", SQ_HOSTED_URL: "https://x/v1/", SQ_HOSTED_MODEL_BASE: "b" });
    expect(ps.map((p) => p.name)).toEqual(["hosted", "local"]);
    expect(ps[0].url).toBe("https://x/v1");
    expect(ps[1]).toMatchObject({ url: "http://localhost:11434/v1", models: { finetuned: "sq-ft", base: undefined } });
  });

  it("orders by preference", () => {
    expect(orderProviders([local, hosted], "auto").map((p) => p.name)).toEqual(["hosted", "local"]);
    expect(orderProviders([hosted, local], "local").map((p) => p.name)).toEqual(["local", "hosted"]);
  });

  it("times out slow providers", async () => {
    const slow = ((_u: string, init: RequestInit) =>
      new Promise((_, rej) => init.signal?.addEventListener("abort", () => rej(new Error("aborted"))))) as typeof fetch;
    await expect(chat({ ...local, timeoutMs: 20 }, "m", [], slow)).rejects.toMatchObject({ kind: "timeout" });
  });
});

describe("generate fallback chain", () => {
  const good = JSON.stringify(goodScene);

  it("returns the first provider's valid fine-tuned scene", async () => {
    const r = await generate("finetuned", req, { providers: [hosted, local], fetchImpl: fakeFetch({ "h-ft": good }) });
    expect(r).toMatchObject({ ok: true, source: "hosted", model: "h-ft" });
    expect(r.attempts).toHaveLength(1);
  });

  it("falls back hosted → local when hosted is down", async () => {
    const r = await generate("finetuned", req, {
      providers: [hosted, local],
      fetchImpl: fakeFetch({ "h-ft": new Error("ENOTFOUND"), "l-ft": good }),
    });
    expect(r).toMatchObject({ ok: true, source: "local" });
    expect(r.attempts.map((a) => a.outcome)).toEqual(["network", "ok"]);
  });

  it("falls back to a labeled cached scene when every provider fails, keeping the bad raw output", async () => {
    const r = await generate("finetuned", req, {
      providers: [hosted, local],
      fetchImpl: fakeFetch({ "h-ft": 500, "l-ft": "not json" }),
    });
    expect(r).toMatchObject({ ok: true, source: "cached", raw: "not json" });
    expect(r.attempts.map((a) => a.outcome)).toEqual(["http", "no_json", "ok"]);
  });

  it("uses the cache with no providers at all", async () => {
    const r = await generate("finetuned", req, { providers: [] });
    expect(r.source).toBe("cached");
    expect(r.scene?.objects.some((o) => o.sprite_id === "car_red" || o.sprite_id === "bus")).toBe(true);
  });

  it("never caches base columns: bad output is shown as-is", async () => {
    const r = await generate("base_naive", req, { providers: [hosted], fetchImpl: fakeFetch({ "h-base": "Сайн уу!" }) });
    expect(r).toMatchObject({ ok: false, source: "hosted", raw: "Сайн уу!" });
    expect(r.scene).toBeUndefined();
  });

  it("says when a base model is not configured", async () => {
    const r = await generate("base_fewshot", req, { providers: [] });
    expect(r).toMatchObject({ ok: false, errors: ["no base model configured"] });
  });
});

describe("cached scenes", () => {
  it.each(EXTRA_SCENES.map((s, i) => [i, s] as const))("extra scene %i is valid and playable", (_i, scene) => {
    const parsed = parseScene(scene);
    expect(parsed.ok ? [] : parsed.errors).toEqual([]);
    expect(playabilityIssues(scene)).toEqual([]);
  });

  it("matches the requested world and danger", () => {
    expect(findCachedScene({ dangerId: "thin_ice" }).scene.backdrop_id).toBe("steppe_river");
    expect(findCachedScene({ placeId: "home_kitchen", dangerId: "medicine" }).scene.lesson_id).toBe("home_medicine");
    expect(findCachedScene({ dangerId: "co_smoke" }).scene.world).toBe("ger");
  });
});
