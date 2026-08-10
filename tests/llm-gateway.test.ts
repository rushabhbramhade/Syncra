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
import { classifyLlmError, extractAffordableMaxTokens } from "../lib/llm-gateway/errors";

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

// ---------------------------------------------------------------------------
// Adaptive 402 affordability retry (OpenRouter low-balance recovery)
// ---------------------------------------------------------------------------

/** Provider that 402s with an OpenRouter-style "can only afford N" message. */
function affordable402Provider(affordable: number, opts: { retrySucceeds?: boolean; failEveryTime?: boolean } = {}): LlmProvider {
  let calls = 0;
  return {
    name: "openrouter",
    async request(params: Record<string, unknown>) {
      calls++;
      // Retry attempt (second call for the same model) succeeds unless told otherwise.
      if (calls >= 2 && opts.retrySucceeds !== false && !opts.failEveryTime) {
        return { choices: [{ message: { content: `retry success (max_tokens=${params.max_tokens})` } }] };
      }
      const err = new Error(
        `You requested up to ${(params.max_tokens as number) ?? 512} tokens, but can only afford ${affordable}.`,
      ) as Error & { status: number };
      err.status = 402;
      throw err;
    },
  };
}

/** OpenRouter provider that always 402s (no affordable signal variation). */
function forever402Provider(affordable: number): LlmProvider {
  return {
    name: "openrouter",
    async request() {
      const err = new Error(`Insufficient credits: can only afford ${affordable}.`) as Error & { status: number };
      err.status = 402;
      throw err;
    },
  };
}

test("complete: 402 with affordable budget retries the SAME model once at the clamped budget", async () => {
  // NVIDIA down → OpenRouter chain: gpt-4o-mini first. It 402s saying it can
  // only afford 707; the gateway must retry gpt-4o-mini once with max_tokens=707.
  const openRouter = affordable402Provider(707);
  const events: GatewayEvent[] = [];
  const gateway = createGateway({
    now: () => clock,
    nvidiaProvider: fakeProvider("nvidia", { fail: true }),
    openRouterProvider: openRouter,
    onEvent: (e) => events.push(e),
  });
  const result = await gateway.complete({ task: "chat", maxTokens: 4096, messages: [{ role: "user", content: "hi" }] });
  assert.equal(result.provider, "openrouter");
  assert.equal(result.content, "retry success (max_tokens=707)");
  // The retry attempt was recorded as a distinct attempt with retryReason set.
  const retryEvent = events.find((e) => e.kind === "attempt" && e.retryReason === "payment_required_affordable_budget");
  assert.ok(retryEvent, "retry attempt must carry retryReason");
  assert.equal(retryEvent?.originalMaxTokens, 4096);
  assert.equal(retryEvent?.affordableMaxTokens, 707);
  assert.equal(retryEvent?.retryMaxTokens, 707);
  assert.equal(retryEvent?.maxTokens, 707, "epoch carries the reduced budget");
});

test("complete: affordable budget is clamped to the ORIGINAL max_tokens, never raised", async () => {
  const openRouter = affordable402Provider(5000); // affordable exceeds the requested budget
  const gateway = createGateway({
    now: () => clock,
    nvidiaProvider: fakeProvider("nvidia", { fail: true }),
    openRouterProvider: openRouter,
  });
  const result = await gateway.complete({ task: "chat", maxTokens: 1024, messages: [{ role: "user", content: "hi" }] });
  assert.equal(result.content, "retry success (max_tokens=1024)", "clamp to min(affordable, original)");
});

test("complete: affordable budget < 256 is NOT retried — next model in the chain is tried", async () => {
  // gpt-4o-mini 402s with affordable=100 (<256, too small for a meaningful
  // completion) → no retry; deepseek should then be attempted and fail too.
  const events: GatewayEvent[] = [];
  const gateway = createGateway({
    now: () => clock,
    nvidiaProvider: fakeProvider("nvidia", { fail: true }),
    openRouterProvider: forever402Provider(100),
    onEvent: (e) => events.push(e),
  });
  await assert.rejects(() => gateway.complete({ task: "chat", maxTokens: 4096, messages: [{ role: "user", content: "hi" }] }), LlmGatewayError);
  const attempts = events.filter((e) => e.kind === "attempt");
  assert.ok(attempts.length >= 2, "both chain models were attempted");
  assert.ok(!attempts.some((e) => e.retryReason), "no affordability retry ran for budget < 256");
  assert.ok(attempts.every((e) => e.originalMaxTokens === undefined), "no retry epoch recorded");
});

test("complete: affordable budget == 256 IS retried (floor is inclusive)", async () => {
  const openRouter = affordable402Provider(256);
  const gateway = createGateway({
    now: () => clock,
    nvidiaProvider: fakeProvider("nvidia", { fail: true }),
    openRouterProvider: openRouter,
  });
  const result = await gateway.complete({ task: "chat", maxTokens: 4096, messages: [{ role: "user", content: "hi" }] });
  assert.equal(result.content, "retry success (max_tokens=256)");
});

test("complete: a failed affordability retry continues to the NEXT model, max one retry per model", async () => {
  // Both models 402 forever. The retry-once rule must not loop: after the
  // first model's primary 402 + failed retry, the chain moves to deepseek,
  // whose primary 402 + failed retry exhausts the chain.
  const events: GatewayEvent[] = [];
  const gateway = createGateway({
    now: () => clock,
    nvidiaProvider: fakeProvider("nvidia", { fail: true }),
    openRouterProvider: forever402Provider(707),
    onEvent: (e) => events.push(e),
  });
  await assert.rejects(
    () => gateway.complete({ task: "chat", maxTokens: 4096, messages: [{ role: "user", content: "hi" }] }),
    (err: any) => {
      assert.ok(err instanceof LlmGatewayError);
      // Both models reported 402 affordability — the final error must be
      // classified as payment_required, never timeout/unknown/success.
      assert.equal(err.classification?.kind, "payment_required");
      return true;
    },
  );
  const attempts = events.filter((e) => e.kind === "attempt");
  assert.equal(attempts.filter((e) => e.retryReason).length, 2, "exactly one retry per chain model");
  assert.equal(attempts.length, 5, "1 NVIDIA + 2 OpenRouter primaries + 2 retries, no loops");
  assert.ok(events.some((e) => e.kind === "all_providers_failed"));
});

test("complete: 402 with no affordable signal falls through to the next model (no retry)", async () => {
  const noSignal: LlmProvider = {
    name: "openrouter",
    async request() {
      const err = new Error("Insufficient credits, top up your account.") as Error & { status: number };
      err.status = 402;
      throw err;
    },
  };
  const events: GatewayEvent[] = [];
  const gateway = createGateway({
    now: () => clock,
    nvidiaProvider: fakeProvider("nvidia", { fail: true }),
    openRouterProvider: noSignal,
    onEvent: (e) => events.push(e),
  });
  await assert.rejects(() => gateway.complete({ task: "chat", messages: [{ role: "user", content: "hi" }] }), LlmGatewayError);
  const attempts = events.filter((e) => e.kind === "attempt");
  assert.ok(attempts.length >= 2, "chain still iterates every model");
  assert.ok(!attempts.some((e) => e.retryReason), "no retry without an affordable signal");
});

test("complete: NVIDIA timeout → gpt-4o-mini 402 → affordability retry @ 707 succeeds", async () => {
  // The production scenario: NVIDIA hangs (timeout), the first OpenRouter
  // model 402s with a usable budget, and the affordability retry at the
  // clamped budget recovers the briefing without fabricating credits.
  const attemptAt = new Map<string, number>();
  const orchestratedOpenRouter: LlmProvider = {
    name: "openrouter",
    async request(params: Record<string, unknown>) {
      const model = params.model as string;
      const n = (attemptAt.get(model) ?? 0) + 1;
      attemptAt.set(model, n);
      if (model.includes("deepseek")) {
        const err = new Error(`Insufficient credits, can only afford 412.`) as Error & { status: number };
        err.status = 402;
        throw err;
      }
      if (model.includes("gpt-4o-mini")) {
        if (n === 1) {
          const err = new Error(`You requested up to 4096 tokens, but can only afford 707.`) as Error & { status: number };
          err.status = 402;
          throw err;
        }
        return { choices: [{ message: { content: `recovered (max_tokens=${params.max_tokens})` } }] };
      }
      return { choices: [{ message: { content: "fallback" } }] };
    },
  };
  const timeoutNvidia: LlmProvider = {
    name: "nvidia",
    async request() {
      const err = new Error("The request timed out") as Error & { status: number };
      err.status = 408;
      throw err;
    },
  };
  const events: GatewayEvent[] = [];
  const gateway = createGateway({
    now: () => clock,
    nvidiaProvider: timeoutNvidia,
    openRouterProvider: orchestratedOpenRouter,
    onEvent: (e) => events.push(e),
  });
  const result = await gateway.complete({ task: "reasoning", maxTokens: 4096, messages: [{ role: "user", content: "brief me" }] });
  assert.equal(result.provider, "openrouter");
  assert.equal(result.content, "recovered (max_tokens=707)");
  const nvidiaAttempt = events.find((e) => e.kind === "attempt" && e.provider === "nvidia");
  assert.equal(nvidiaAttempt?.result, "timeout", "NVIDIA failure classified as timeout, not a user error");
  assert.ok(events.some((e) => e.kind === "fallback_used"));
  const retries = events.filter((e) => e.kind === "attempt" && e.retryReason === "payment_required_affordable_budget");
  assert.equal(retries.length, 1, "gpt-4o-mini retried exactly once and recovered");
  assert.equal(retries[0]?.retryMaxTokens, 707);
});

test("classifyLlmError: 402 with 'can only afford N' is payment_required + carries the budget", () => {
  assert.equal(extractAffordableMaxTokens("You requested up to 4096 tokens, but can only afford 707."), 707);
  assert.equal(extractAffordableMaxTokens("can only afford 1,024"), 1024);
  assert.equal(extractAffordableMaxTokens("Insufficient credits, top up."), undefined);
  const cls = classifyLlmError((() => {
    const e = new Error("You requested up to 4096 tokens, but can only afford 412.") as Error & { status: number };
    e.status = 402;
    return e;
  })());
  assert.equal(cls.kind, "payment_required");
  assert.equal(cls.fallbackable, true);
  assert.equal(cls.affordableMaxTokens, 412);
});

test("classifyLlmError: 402 without an affordable signal still falls back but has no budget", () => {
  const err = new Error("Insufficient credits.") as Error & { status: number };
  err.status = 402;
  const cls = classifyLlmError(err);
  assert.equal(cls.kind, "payment_required");
  assert.equal(cls.fallbackable, true);
  assert.equal(cls.affordableMaxTokens, undefined);
});