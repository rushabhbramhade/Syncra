/* eslint-disable @typescript-eslint/no-explicit-any */
import { test } from "node:test";
import assert from "node:assert/strict";

import { TokenBucket, CircuitBreaker } from "../lib/llm-gateway/resilience";
import {
  resolveNvidiaModel,
  resolveOpenRouterChain,
  missingProviderKeys,
  NVIDIA_MODEL_DEFAULTS,
} from "../lib/llm-gateway/config";
import { createGateway, openAiProvider, LlmGateway, LlmProvider, GatewayEvent, LlmGatewayError } from "../lib/llm-gateway/index";

// ---------------------------------------------------------------------------
// Deterministic clock
// ---------------------------------------------------------------------------
let clock = 1_000_000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function fakeProvider(name: "nvidia" | "openrouter", opts: { fail?: boolean; content?: string } = {}): LlmProvider {
  return {
    name,
    async request(params: Record<string, unknown>): Promise<unknown> {
      if (opts.fail) throw new Error(`${name} simulated failure`);
      const content = opts.content ?? `answer from ${name}`;
      if (params.stream === true) {
        return (async function* () {
          for (const piece of content.split("")) {
            yield { choices: [{ delta: { content: piece }, finish_reason: null }] };
          }
          yield { choices: [{ delta: {}, finish_reason: "stop" }] };
        })();
      }
      return { choices: [{ message: { content } }], usage: { prompt_tokens: 4, completion_tokens: 6 } };
    },
  };
}

function makeGateway(opts: {
  nvidiaFail?: boolean;
  openRouterFail?: boolean;
  events?: GatewayEvent[];
  nvidia?: LlmProvider;
  openRouter?: LlmProvider;
}) {
  const events = opts.events ?? [];
  const gateway = createGateway({
    now: () => clock,
    nvidiaProvider: opts.nvidia ?? fakeProvider("nvidia", { fail: opts.nvidiaFail }),
    openRouterProvider: opts.openRouter ?? fakeProvider("openrouter", { fail: opts.openRouterFail }),
    onEvent: (e) => events.push(e),
  });
  return { gateway, events };
}

// ---------------------------------------------------------------------------
// TokenBucket
// ---------------------------------------------------------------------------
test("TokenBucket: allows the full budget, denies over, refills after the window", () => {
  clock = 0;
  const bucket = new TokenBucket(35, 60_000, () => clock);
  assert.equal(bucket.available(), 35);
  for (let i = 0; i < 35; i++) assert.equal(bucket.tryTake(), true);
  assert.equal(bucket.tryTake(), false, "36th request blocked by the budget");
  clock += 60_000;
  assert.ok(bucket.available() >= 1, "bucket refilled after the full window");
  assert.equal(bucket.tryTake(), true);
});

test("TokenBucket: partial refill is proportional to elapsed time", () => {
  clock = 0;
  const bucket = new TokenBucket(10, 60_000, () => clock);
  for (let i = 0; i < 10; i++) bucket.tryTake();
  assert.equal(bucket.available(), 0);
  clock += 30_000;
  assert.equal(bucket.available(), 5, "half the window refills half the bucket");
});

// ---------------------------------------------------------------------------
// CircuitBreaker
// ---------------------------------------------------------------------------
test("CircuitBreaker: 5 failures in the window trip open and block attempts", () => {
  clock = 0;
  const breaker = new CircuitBreaker(5, 60_000, 45_000, () => clock);
  assert.equal(breaker.snapshot().state, "closed");
  for (let i = 0; i < 4; i++) {
    breaker.recordFailure();
    assert.equal(breaker.mayAttempt(), true, "still allowed before the threshold");
  }
  breaker.recordFailure();
  assert.equal(breaker.snapshot().state, "open");
  assert.equal(breaker.mayAttempt(), false, "no attempts while open");
});

test("CircuitBreaker: cooldown lapse allows a half-open trial; success closes it", () => {
  clock = 0;
  const breaker = new CircuitBreaker(5, 60_000, 45_000, () => clock);
  for (let i = 0; i < 5; i++) breaker.recordFailure();
  assert.equal(breaker.snapshot().state, "open");
  clock += 46_000;
  assert.equal(breaker.snapshot().state, "half_open");
  assert.equal(breaker.mayAttempt(), true, "half-open allows a trial");
  breaker.recordSuccess();
  assert.equal(breaker.snapshot().state, "closed");
  assert.equal(breaker.snapshot().failuresInWindow, 0);
});

test("CircuitBreaker: a failed half-open trial re-opens for another cooldown", () => {
  clock = 0;
  const breaker = new CircuitBreaker(5, 60_000, 45_000, () => clock);
  for (let i = 0; i < 5; i++) breaker.recordFailure();
  clock += 46_000;
  breaker.recordFailure();
  assert.equal(breaker.snapshot().state, "open");
  assert.equal(breaker.mayAttempt(), false);
});

// ---------------------------------------------------------------------------
// Task routing config
// ---------------------------------------------------------------------------
test("resolveNvidiaModel uses defaults and honors env override", () => {
  const old = process.env.NVIDIA_MODEL_HEAVY;
  assert.equal(resolveNvidiaModel("heavy"), NVIDIA_MODEL_DEFAULTS.heavy);
  process.env.NVIDIA_MODEL_HEAVY = "vendor/override-model";
  try {
    assert.equal(resolveNvidiaModel("heavy"), "vendor/override-model");
  } finally {
    if (old === undefined) delete process.env.NVIDIA_MODEL_HEAVY;
    else process.env.NVIDIA_MODEL_HEAVY = old;
  }
});

test("resolveOpenRouterChain: explicit model first, then env, then defaults, deduped", () => {
  const oldModel = process.env.OPENROUTER_MODEL;
  const oldTask = process.env.OPENROUTER_MODEL_FAST;
  process.env.OPENROUTER_MODEL = "deepseek/deepseek-chat-v3";
  process.env.OPENROUTER_MODEL_FAST = "openai/gpt-4o-mini";
  try {
    const chain = resolveOpenRouterChain("fast", "custom/free-model");
    assert.equal(chain[0], "custom/free-model");
    assert.ok(chain.includes("openai/gpt-4o-mini"));
    assert.ok(chain.includes("deepseek/deepseek-chat-v3"));
    assert.equal(chain[chain.length - 1], "deepseek/deepseek-chat-v3");
  } finally {
    if (oldModel === undefined) delete process.env.OPENROUTER_MODEL;
    else process.env.OPENROUTER_MODEL = oldModel;
    if (oldTask === undefined) delete process.env.OPENROUTER_MODEL_FAST;
    else process.env.OPENROUTER_MODEL_FAST = oldTask;
  }
});

test("missingProviderKeys lists every absent key", () => {
  const oldN = process.env.NVIDIA_API_KEY;
  const oldO = process.env.OPENROUTER_API_KEY;
  delete process.env.NVIDIA_API_KEY;
  delete process.env.OPENROUTER_API_KEY;
  try {
    assert.deepEqual(missingProviderKeys(), ["NVIDIA_API_KEY", "OPENROUTER_API_KEY"]);
  } finally {
    if (oldN) process.env.NVIDIA_API_KEY = oldN;
    if (oldO) process.env.OPENROUTER_API_KEY = oldO;
  }
});

// ---------------------------------------------------------------------------
// Gateway behavior (fake HTTP — no network)
// ---------------------------------------------------------------------------
test("complete: NVIDIA primary serves the first request", async () => {
  const events: GatewayEvent[] = [];
  const { gateway } = makeGateway({ events });
  const result = await gateway.complete({ task: "heavy", messages: [{ role: "user", content: "hi" }] });
  assert.equal(result.provider, "nvidia");
  assert.match(result.content, /answer from nvidia/);
  assert.equal(result.model, NVIDIA_MODEL_DEFAULTS.heavy);
  assert.equal(result.usage?.inputTokens, 4);
  assert.equal(result.usage?.outputTokens, 6);
  assert.ok(events.some((e) => e.kind === "provider_success" && e.provider === "nvidia"));
});

test("complete: on NVIDIA failure falls through to OpenRouter", async () => {
  const events: GatewayEvent[] = [];
  const { gateway } = makeGateway({ nvidiaFail: true, events });
  const result = await gateway.complete({ task: "fast", messages: [{ role: "user", content: "hi" }] });
  assert.equal(result.provider, "openrouter");
  assert.match(result.content, /answer from openrouter/);
  assert.ok(events.some((e) => e.kind === "breaker_tripped" && e.provider === "nvidia"));
});

test("complete: total failure explains the per-provider cause in the error", async () => {
  const { gateway } = makeGateway({ nvidiaFail: true, openRouterFail: true });
  await assert.rejects(
    () => gateway.complete({ task: "chat", messages: [{ role: "user", content: "hi" }] }),
    (err: any) =>
      err instanceof LlmGatewayError &&
      /All LLM providers failed/.test(err.message) &&
      /Chain:/.test(err.message) &&
      /nvidia\//.test(err.message) &&
      /openrouter\//.test(err.message),
  );
});

test("complete: exhausted NVIDIA budget routes straight to fallback without another call", async () => {
  let nvidiaCalls = 0;
  const countingNvidia: LlmProvider = {
    name: "nvidia",
    async request() {
      nvidiaCalls++;
      return { choices: [{ message: { content: "nv" } }] };
    },
  };
  const gateway2 = createGateway({
    now: () => clock,
    nvidiaProvider: countingNvidia,
    openRouterProvider: fakeProvider("openrouter"),
  });
  for (let i = 0; i < 35; i++) {
    await gateway2.complete({ messages: [{ role: "user", content: "x" }] });
  }
  assert.equal(nvidiaCalls, 35);
  const result = await gateway2.complete({ messages: [{ role: "user", content: "y" }] });
  assert.equal(nvidiaCalls, 35, "the 36th request must not reach NVIDIA");
  assert.equal(result.provider, "openrouter");
});

test("complete: circuit breaker opens after 5 NVIDIA failures and routes to fallback", async () => {
  // Toggleable fakes: fail everything for the first 5 calls, then let the
  // OpenRouter fallback recover so we can observe the shift of traffic.
  let nvidiaDown = true;
  let openRouterDown = true;
  const flaky = {
    nvidia: {
      name: "nvidia",
      async request() {
        if (nvidiaDown) throw new Error("nvidia boom");
        return { choices: [{ message: { content: "nv ok" } }] };
      },
    } as LlmProvider,
    openRouter: {
      name: "openrouter",
      async request() {
        if (openRouterDown) throw new Error("or boom");
        return { choices: [{ message: { content: "or ok" } }] };
      },
    } as LlmProvider,
  };
  const events: GatewayEvent[] = [];
  const gateway = createGateway({
    now: () => clock,
    nvidiaProvider: flaky.nvidia,
    openRouterProvider: flaky.openRouter,
    onEvent: (e) => events.push(e),
  });
  for (let i = 0; i < 5; i++) {
    await assert.rejects(() => gateway.complete({ messages: [{ role: "user", content: "x" }] }), LlmGatewayError);
  }
  assert.equal(gateway.health().nvidia.breaker.state, "open");
  assert.ok(events.some((e) => e.kind === "breaker_tripped" && e.provider === "nvidia"));
  // NVIDIA is in cooldown. OpenRouter recovers → traffic shifts to it.
  openRouterDown = false;
  const result = await gateway.complete({ messages: [{ role: "user", content: "y" }] });
  assert.equal(result.provider, "openrouter");
  assert.equal(result.content, "or ok");
});

test("construction: refuses to start when NO provider API key is configured (both missing)", () => {
  const oldN = process.env.NVIDIA_API_KEY;
  const oldO = process.env.OPENROUTER_API_KEY;
  delete process.env.NVIDIA_API_KEY;
  delete process.env.OPENROUTER_API_KEY;
  try {
    assert.throws(
      () => createGateway({}),
      (err: any) => err instanceof LlmGatewayError && /missing provider API key/.test(err.message),
    );
  } finally {
    if (oldN) process.env.NVIDIA_API_KEY = oldN;
    if (oldO) process.env.OPENROUTER_API_KEY = oldO;
  }
});

test("construction: refuses to start when EITHER key is missing (no silent single-provider degradation)", () => {
  const oldN = process.env.NVIDIA_API_KEY;
  const oldO = process.env.OPENROUTER_API_KEY;
  try {
    // OpenRouter missing only.
    delete process.env.OPENROUTER_API_KEY;
    process.env.NVIDIA_API_KEY = "nvapi-test";
    assert.throws(
      () => createGateway({}),
      (err: any) => err instanceof LlmGatewayError && /OPENROUTER_API_KEY/.test(err.message),
    );
    // NVIDIA missing only.
    delete process.env.NVIDIA_API_KEY;
    process.env.OPENROUTER_API_KEY = "sk-or-test";
    assert.throws(
      () => createGateway({}),
      (err: any) => err instanceof LlmGatewayError && /NVIDIA_API_KEY/.test(err.message),
    );
  } finally {
    if (oldN) process.env.NVIDIA_API_KEY = oldN;
    else delete process.env.NVIDIA_API_KEY;
    if (oldO) process.env.OPENROUTER_API_KEY = oldO;
    else delete process.env.OPENROUTER_API_KEY;
  }
});

test("construction: injected deps bypass the env-key gate (tests/deps only)", () => {
  const oldN = process.env.NVIDIA_API_KEY;
  const oldO = process.env.OPENROUTER_API_KEY;
  delete process.env.NVIDIA_API_KEY;
  delete process.env.OPENROUTER_API_KEY;
  try {
    const gateway = createGateway({
      nvidiaProvider: fakeProvider("nvidia"),
      openRouterProvider: fakeProvider("openrouter"),
    });
    assert.ok(gateway.health().ready);
  } finally {
    if (oldN) process.env.NVIDIA_API_KEY = oldN;
    if (oldO) process.env.OPENROUTER_API_KEY = oldO;
  }
});

test("openAiProvider: `signal` goes to SDK options, never into the JSON body", async () => {
  let captured: { body?: Record<string, unknown>; options?: Record<string, unknown> } = {};
  const fake = {
    chat: {
      completions: {
        async create(body: Record<string, unknown>, options: Record<string, unknown>) {
          captured = { body, options };
          return { choices: [{ message: { content: "x" } }] };
        },
      },
    },
  };
  const provider = openAiProvider("nvidia", fake as never);
  await provider.request({ messages: [], model: "m", signal: new AbortController().signal });
  assert.equal(captured.body?.signal, undefined, "signal must be stripped from the request body");
  assert.ok(captured.options?.signal instanceof AbortSignal, "signal must be passed as an SDK option");
});

test("complete: forced NVIDIA 429 rate-limit falls through to OpenRouter without a user-facing error", async () => {
  // Simulate the SDK's 429 shape (status on the error object) — what NVIDIA
  // returns when its free budget or the shared RPM cap refuses the request.
  const rateLimitedNvidia: LlmProvider = {
    name: "nvidia",
    async request() {
      const err = new Error("NVIDIA free tier rate limit exceeded") as Error & { status: number };
      err.status = 429;
      throw err;
    },
  };
  const events: GatewayEvent[] = [];
  const gateway = createGateway({
    now: () => clock,
    nvidiaProvider: rateLimitedNvidia,
    openRouterProvider: fakeProvider("openrouter", { content: "fallback answer" }),
    onEvent: (e) => events.push(e),
  });
  const result = await gateway.complete({ task: "chat", messages: [{ role: "user", content: "hi" }] });
  assert.equal(result.provider, "openrouter", "429 must fall through to the fallback tier");
  assert.equal(result.content, "fallback answer");
  assert.equal(result.mode, "task");
  assert.ok(events.some((e) => e.kind === "breaker_tripped" && e.provider === "nvidia"));
  assert.ok(events.some((e) => e.kind === "fallback_used"));
  // No error surfaces to the caller — the promise above resolved, not rejected.
});

test("stream: forced NVIDIA 429 rate-limit falls through to OpenRouter and streams", async () => {
  const rateLimitedNvidia: LlmProvider = {
    name: "nvidia",
    async request() {
      const err = new Error("nvidia 429") as Error & { status: number };
      err.status = 429;
      throw err;
    },
  };
  const { gateway } = makeGateway({ nvidia: rateLimitedNvidia });
  const deltas: any[] = [];
  for await (const d of gateway.stream({ stream: true, messages: [{ role: "user", content: "t" }] })) deltas.push(d);
  assert.equal(deltas[0].provider, "openrouter");
  assert.equal(deltas[0].content, "answer from openrouter".split("")[0]);
});

test("complete: json requests are honored and content returned", async () => {
  const { gateway } = makeGateway({});
  const result = await gateway.complete({ json: true, messages: [{ role: "user", content: "return json" }] });
  assert.equal(result.provider, "nvidia");
  assert.ok(result.content.length > 0);
});

// ---------------------------------------------------------------------------
// Streaming
// ---------------------------------------------------------------------------
test("stream: yields content deltas from NVIDIA and reports provider/model", async () => {
  const { gateway } = makeGateway({});
  const deltas: any[] = [];
  for await (const d of gateway.stream({ stream: true, messages: [{ role: "user", content: "t" }] })) deltas.push(d);
  assert.ok(deltas.length >= 2);
  assert.equal(deltas[0].provider, "nvidia");
  assert.equal(deltas[0].content, "answer from nvidia".split("")[0]);
  assert.equal(deltas[0].model, NVIDIA_MODEL_DEFAULTS.chat);
});

test("stream: NVIDIA connection failure falls through to OpenRouter", async () => {
  const { gateway } = makeGateway({ nvidiaFail: true });
  const deltas: any[] = [];
  for await (const d of gateway.stream({ stream: true, messages: [{ role: "user", content: "t" }] })) deltas.push(d);
  assert.equal(deltas[0].provider, "openrouter");
});

test("stream: tool call deltas are surfaced, not only text", async () => {
  const toolProvider: LlmProvider = {
    name: "nvidia",
    async request(params: Record<string, unknown>): Promise<unknown> {
      if (params.stream === true) {
        const chunk = (delta: unknown, finishReason: string | null) => ({ choices: [{ delta, finish_reason: finishReason }] });
        return (async function* () {
          yield chunk({ tool_calls: [{ index: 0, id: "call_1", function: { name: "gmail_search_emails", arguments: '{"q":"' } }] }, null);
          yield chunk({ tool_calls: [{ index: 0, function: { arguments: "unread}" } }] }, null);
          yield chunk({}, "tool_calls");
        })();
      }
      return { choices: [{ message: { content: "" } }] };
    },
  };
  const gateway = createGateway({
    now: () => clock,
    nvidiaProvider: toolProvider,
    openRouterProvider: fakeProvider("openrouter"),
  });
  const deltas: any[] = [];
  for await (const d of gateway.stream({ stream: true, messages: [{ role: "user", content: "t" }] })) deltas.push(d);
  assert.equal(deltas[0].toolCalls.length, 1);
  assert.equal(deltas[0].toolCalls[0].name, "gmail_search_emails");
  assert.equal(deltas[0].toolCalls[0].argumentsDelta, '{"q":"');
  assert.equal(deltas[1].toolCalls[0].argumentsDelta, "unread}");
  assert.equal(deltas[2].finishReason, "tool_calls");
});

test("stream: explicitly rejects race mode instead of faking a buffered answer", async () => {
  const { gateway } = makeGateway({});
  await assert.rejects(
    async () => {
      for await (const delta of gateway.stream({ stream: true, mode: "race", messages: [{ role: "user", content: "x" }] })) {
        void delta;
      }
    },
    /race is not supported for streaming/i,
  );
});

// ---------------------------------------------------------------------------
// Race mode (non-streaming)
// ---------------------------------------------------------------------------
test("complete: race mode resolves with the leg that finishes first", async () => {
  const slowNvidia: LlmProvider = {
    name: "nvidia",
    async request() {
      await sleep(60);
      clock += 60;
      return { choices: [{ message: { content: "slow" } }] };
    },
  };
  const fastOpenRouter: LlmProvider = {
    name: "openrouter",
    async request() {
      return { choices: [{ message: { content: "fast" } }] };
    },
  };
  const gateway = createGateway({
    now: () => clock,
    nvidiaProvider: slowNvidia,
    openRouterProvider: fastOpenRouter,
  });
  const result = await gateway.complete({ mode: "race", messages: [{ role: "user", content: "r" }] });
  assert.equal(result.provider, "openrouter", "the faster leg wins the race");
  assert.equal(result.mode, "race");
});