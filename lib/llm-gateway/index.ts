/**
 * Syncra's internal LLM Gateway.
 *
 * EVERY AI-calling feature goes through this module. It is the only place in
 * the codebase that holds a provider API key or talks to an LLM provider
 * directly. Callers use one signature:
 *
 *   llmGateway.complete({ task, messages, ... })  → OpenAI-style completion
 *   llmGateway.stream({ task, messages, tools })  → per-token deltas (AI Agent)
 *
 * Primary tier is NVIDIA NIM (free, OpenAI-compatible). OpenRouter is the
 * fallback used only when NVIDIA is rate-limited (token bucket), failing
 * (circuit breaker), or not configured. Routing is task-mapped by default and
 * `mode: "race"` is an explicit opt-in for latency-critical non-streaming
 * paths only.
 *
 * Guarantees:
 *   - API keys come from env only. Construction REFUSES to start when either
 *     NVIDIA_API_KEY or OPENROUTER_API_KEY is missing (fail fast at load — a
 *     single-provider deployment is treated as a misconfiguration, never
 *     silently degraded). `assertConfigured` is the same guard at call time for
 *     dependency-injected builds.
 *   - Every provider call is bounded by a per-task timeout (NVIDIA heavy/
 *     reasoning get up to ~60s; user-facing tasks stay at 30s) and a defined
 *     fallback; no unhandled rejection reaches a caller. AbortController is
 *     always used — nothing can block indefinitely.
 *   - Retries happen only inside the fallback chain (OpenRouter model list); a
 *     failing (or breaker-open / bucket-empty) NVIDIA provider is never
 *     retried directly. Errors are classified: timeout / 429 / 402 / 5xx /
 *     network fall through to the next configured model; a malformed request
 *     (HTTP 400) aborts the whole chain since no provider can fix it.
 *   - Circuit-breaker trips and bucket denials are logged and observable via
 *     `health()` and the optional `onEvent` hook. Every attempt emits a
 *     structured `llm.attempt` record (requestId, task, provider, model,
 *     attempt, timeoutMs, durationMs, result) — metadata only, never keys or
 *     prompt bodies.
 */

import OpenAI from "openai";
import { TokenBucket, CircuitBreaker, BreakerSnapshot } from "./resilience";
import {
  NVIDIA_BASE_URL,
  OPENROUTER_BASE_URL,
  NVIDIA_RPM,
  NVIDIA_RPM_WINDOW_MS,
  NVIDIA_BREAKER_FAILURE_THRESHOLD,
  NVIDIA_BREAKER_WINDOW_MS,
  NVIDIA_BREAKER_COOLDOWN_MS,
  routeForTask,
  resolveNvidiaTimeout,
  resolveOpenRouterTimeout,
  missingProviderKeys,
  TaskKey,
} from "./config";
import { classifyLlmError, LlmErrorClass } from "./errors";

export * from "./config";
export * from "./errors";
export { TokenBucket, CircuitBreaker };
export type { BreakerSnapshot };

export type LlmProviderName = "nvidia" | "openrouter";
export type LlmMode = "task" | "race";

/** Outcome of a single provider/model attempt, for observability. */
export type LlmAttemptResult =
  | "success"
  | "timeout"
  | "rate_limit"
  | "payment_required"
  | "server_error"
  | "authentication"
  | "malformed_request"
  | "model_not_found"
  | "network"
  | "error"
  | "skipped";

export interface LlmGatewayMessage {
  role: "system" | "user" | "assistant" | "tool";
  content?: string | null;
  name?: string;
  tool_call_id?: string;
  tool_calls?: Array<{ id?: string; type?: string; function?: { name: string; arguments: string } }>;
}

export interface LlmGatewayRequest {
  /** Which job class this request belongs to. Default: "chat". */
  task?: TaskKey;
  /** Explicit user-chosen model (OpenRouter-side); becomes the fallback-chain head. */
  model?: string;
  /** "task" (default) = mapped primary then fallback chain; "race" = parallel, first wins. */
  mode?: LlmMode;
  /** Ask for a JSON-structured completion. */
  json?: boolean;
  temperature?: number;
  maxTokens?: number;
  messages: LlmGatewayMessage[];
  tools?: Array<Record<string, unknown>>;
  signal?: AbortSignal;
  /** Correlation id surfaced in every attempt log (default: gateway-generated). */
  requestId?: string;
}

export interface LlmGatewayStreamRequest extends LlmGatewayRequest {
  stream: true;
}

export interface LlmGatewayResult {
  provider: LlmProviderName;
  model: string;
  content: string;
  mode: LlmMode;
  latencyMs: number;
  usage?: { inputTokens: number; outputTokens: number };
}

export interface LlmGatewayStreamDelta {
  provider: LlmProviderName;
  model: string;
  content?: string;
  toolCalls?: Array<{ index: number; id?: string; name?: string; argumentsDelta?: string }>;
  finishReason?: string | null;
}

export interface LlmGatewayHealth {
  ready: boolean;
  reason?: string;
  nvidia: {
    configured: boolean;
    model: string;
    bucketAvailable: number;
    breaker: BreakerSnapshot;
    timeoutMs: number;
  };
  openRouter: { configured: boolean; timeoutMs: number; model: string };
}

export interface LlmProvider {
  name: LlmProviderName;
  /** params may include `stream: true`; returns a completion object or async iterable. */
  request(params: Record<string, unknown>): Promise<unknown>;
}

export class LlmGatewayError extends Error {
  constructor(
    message: string,
    public readonly provider: LlmProviderName | null = null,
    public readonly model?: string,
    public readonly classification?: LlmErrorClass,
  ) {
    super(message);
    this.name = "LlmGatewayError";
  }
}

interface CompletionLike {
  choices?: Array<{ message?: { content?: string | null } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

interface StreamChunkLike {
  choices?: Array<{
    delta?: {
      content?: string;
      tool_calls?: Array<{ index?: number; id?: string; function?: { name?: string; arguments?: string } }>;
    };
    finish_reason?: string | null;
  }>;
}

export interface GatewayEvent {
  kind:
    | "breaker_tripped"
    | "breaker_opened"
    | "provider_failure"
    | "bucket_empty"
    | "provider_success"
    | "fallback_used"
    | "no_provider"
    | "attempt"
    | "all_providers_failed";
  provider: LlmProviderName;
  model?: string;
  notes?: string;
  /** Structured attempt/timing observability (set for `attempt`/`all_providers_failed`). */
  requestId?: string;
  task?: string;
  attempt?: number;
  timeoutMs?: number;
  durationMs?: number;
  result?: LlmAttemptResult | "all_providers_failed";
  maxTokens?: number;
  originalMaxTokens?: number;
  affordableMaxTokens?: number;
  retryMaxTokens?: number;
  retryReason?: string;
  usage?: { inputTokens: number; outputTokens: number };
}

export interface GatewayDeps {
  nvidiaProvider?: LlmProvider;
  openRouterProvider?: LlmProvider;
  now?: () => number;
  onEvent?: (event: GatewayEvent) => void;
}

export interface LlmGateway {
  complete(req: LlmGatewayRequest): Promise<LlmGatewayResult>;
  stream(req: LlmGatewayStreamRequest): AsyncGenerator<LlmGatewayStreamDelta>;
  health(): LlmGatewayHealth;
  assertConfigured(): void;
}

function errMessage(err: unknown): string {
  const e = err as { message?: string };
  return e?.message || String(err);
}

function deadline(signal: AbortSignal | undefined, timeoutMs: number): { signal: AbortSignal; done: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error(`request timed out after ${timeoutMs}ms`)), timeoutMs);
  const onAbort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  else signal?.addEventListener("abort", onAbort, { once: true });
  return {
    signal: controller.signal,
    done: () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    },
  };
}

/** Wrap an OpenAI SDK-compatible client behind the structural provider. */
export function openAiProvider(name: LlmProviderName, client: OpenAI): LlmProvider {
  return {
    name,
    request(params: Record<string, unknown>): Promise<unknown> {
      // The AbortSignal must never be serialized into the request body —
      // NVIDIA's NIM rejects any unknown body key with 400 ("Unsupported
      // parameter(s): `signal`"). Hand it to the SDK as an option instead.
      const { signal, ...body } = params;
      const options: { signal?: AbortSignal } = {};
      if (signal instanceof AbortSignal) options.signal = signal;
      return client.chat.completions.create(body as never, options as never) as unknown as Promise<unknown>;
    },
  };
}

function makeDummyProvider(name: LlmProviderName): LlmProvider {
  return {
    name,
    request() {
      return Promise.reject(new Error(`${name} provider is not configured`));
    },
  };
}

export function createGateway(deps?: GatewayDeps): LlmGateway {
  const now = deps?.now ?? Date.now;

  const emit = (event: GatewayEvent) => {
    deps?.onEvent?.(event);
    if (event.kind !== "provider_success") {
      console.warn(`[llm-gateway] ${event.kind}`, { provider: event.provider, model: event.model, notes: event.notes ?? "" });
    }
  };

  let requestIdCounter = 0;
  const nextRequestId = (): string =>
    `req_${now().toString(36)}_${(requestIdCounter++).toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  /**
   * Structured observability for every provider attempt. Metadata only —
   * never keys, headers, tokens, or prompt bodies.
   */
  const logAttempt = (info: {
    requestId: string;
    task: TaskKey;
    provider: LlmProviderName;
    model: string;
    attempt: number;
    timeoutMs: number;
    durationMs: number;
    result: LlmAttemptResult;
    maxTokens?: number;
    originalMaxTokens?: number;
    affordableMaxTokens?: number;
    retryMaxTokens?: number;
    retryReason?: string;
    usage?: { inputTokens: number; outputTokens: number };
  }) => {
    const { requestId, task, provider, model, attempt, timeoutMs, durationMs, result, maxTokens, originalMaxTokens, affordableMaxTokens, retryMaxTokens, retryReason, usage } = info;
    console.log(
      JSON.stringify({
        event: "llm.attempt",
        requestId,
        task,
        provider,
        model,
        attempt,
        timeoutMs,
        durationMs,
        result,
        maxTokens: maxTokens ?? null,
        originalMaxTokens: originalMaxTokens ?? null,
        affordableMaxTokens: affordableMaxTokens ?? null,
        retryMaxTokens: retryMaxTokens ?? null,
        retryReason: retryReason ?? null,
        usage: usage ?? null,
        ts: new Date().toISOString(),
      }),
    );
    deps?.onEvent?.({
      kind: "attempt",
      provider,
      model,
      requestId,
      task,
      attempt,
      timeoutMs,
      durationMs,
      result,
      maxTokens,
      originalMaxTokens,
      affordableMaxTokens,
      retryMaxTokens,
      retryReason,
      usage,
    });
  };

  const logAllFailed = (requestId: string, task: TaskKey, attempts: number, notes: string) => {
    console.log(
      JSON.stringify({
        event: "llm.all_failed",
        requestId,
        task,
        result: "all_providers_failed",
        attempts,
        chain: notes,
        ts: new Date().toISOString(),
      }),
    );
    deps?.onEvent?.({
      kind: "all_providers_failed",
      provider: "nvidia",
      requestId,
      task,
      result: "all_providers_failed",
      notes,
    });
  };

  const nvidiaConfigured = Boolean(process.env.NVIDIA_API_KEY);
  const openRouterConfigured = Boolean(process.env.OPENROUTER_API_KEY);
  const injectNvidia = Boolean(deps?.nvidiaProvider);
  const injectOpenRouter = Boolean(deps?.openRouterProvider);

  // Fail fast instead of silently degrading to one provider. The gateway is
  // only allowed to skip keys that were explicitly injected via deps (tests).
  const missing = missingProviderKeys().filter(
    (k) => !(k === "NVIDIA_API_KEY" && injectNvidia) && !(k === "OPENROUTER_API_KEY" && injectOpenRouter),
  );
  if (missing.length > 0) {
    throw new LlmGatewayError(
      `LLM gateway cannot start: missing provider API key(s): ${missing.join(", ")}`,
    );
  }

  const nvidiaProvider: LlmProvider =
    deps?.nvidiaProvider ??
    (nvidiaConfigured
      ? openAiProvider("nvidia", new OpenAI({ apiKey: process.env.NVIDIA_API_KEY, baseURL: NVIDIA_BASE_URL, maxRetries: 0 }))
      : makeDummyProvider("nvidia"));

  const openRouterProvider: LlmProvider =
    deps?.openRouterProvider ??
    (openRouterConfigured
      ? openAiProvider("openrouter", new OpenAI({ apiKey: process.env.OPENROUTER_API_KEY, baseURL: OPENROUTER_BASE_URL, maxRetries: 0 }))
      : makeDummyProvider("openrouter"));

  const bucket = new TokenBucket(NVIDIA_RPM, NVIDIA_RPM_WINDOW_MS, now);
  const breaker = new CircuitBreaker(NVIDIA_BREAKER_FAILURE_THRESHOLD, NVIDIA_BREAKER_WINDOW_MS, NVIDIA_BREAKER_COOLDOWN_MS, now);

  const nvidiaEnabled = () => Boolean(nvidiaConfigured || deps?.nvidiaProvider);
  const openRouterEnabled = () => Boolean(openRouterConfigured || deps?.openRouterProvider);

  const nvidiaAllowed = (): boolean => {
    if (!nvidiaEnabled()) return false;
    if (!breaker.mayAttempt()) {
      emit({ kind: "breaker_opened", provider: "nvidia", notes: "cooldown in effect; routing to fallback" });
      return false;
    }
    if (!bucket.tryTake()) {
      emit({ kind: "bucket_empty", provider: "nvidia", notes: `${NVIDIA_RPM} requests/min budget exhausted` });
      return false;
    }
    return true;
  };

  interface AttemptCtx {
    task: TaskKey;
    requestId: string;
    attempt: number;
    maxTokens?: number;
    originalMaxTokens?: number;
    affordableMaxTokens?: number;
    retryMaxTokens?: number;
    retryReason?: string;
  }

  const attemptNvidia = async (baseParams: Record<string, unknown>, nvidiaModel: string, ctx: AttemptCtx, signal?: AbortSignal) => {
    const start = now();
    const timeoutMs = resolveNvidiaTimeout(ctx.task);
    const { signal: dlSignal, done } = deadline(signal, timeoutMs);
    try {
      const response = (await nvidiaProvider.request({ ...baseParams, model: nvidiaModel, signal: dlSignal })) as unknown as CompletionLike;
      done();
      breaker.recordSuccess();
      const usage = response.usage
        ? { inputTokens: response.usage.prompt_tokens ?? 0, outputTokens: response.usage.completion_tokens ?? 0 }
        : undefined;
      logAttempt({
        requestId: ctx.requestId,
        task: ctx.task,
        provider: "nvidia",
        model: nvidiaModel,
        attempt: ctx.attempt,
        timeoutMs,
        durationMs: now() - start,
        result: "success",
        maxTokens: ctx.maxTokens,
        usage,
      });
      emit({ kind: "provider_success", provider: "nvidia", model: nvidiaModel });
      return {
        provider: "nvidia" as const,
        model: nvidiaModel,
        content: response.choices?.[0]?.message?.content ?? "",
        mode: "task" as const,
        latencyMs: now() - start,
        usage,
      };
    } catch (err) {
      done();
      breaker.recordFailure();
      const cls = classifyLlmError(err);
      logAttempt({
        requestId: ctx.requestId,
        task: ctx.task,
        provider: "nvidia",
        model: nvidiaModel,
        attempt: ctx.attempt,
        timeoutMs,
        durationMs: now() - start,
        result: cls.kind === "unknown" ? "error" : cls.kind,
        maxTokens: ctx.maxTokens,
      });
      emit({ kind: "breaker_tripped", provider: "nvidia", model: nvidiaModel, notes: errMessage(err) });
      throw new LlmGatewayError(`NVIDIA request failed: ${errMessage(err)}`, "nvidia", nvidiaModel, cls);
    }
  };

  const attemptOpenRouter = async (baseParams: Record<string, unknown>, model: string, ctx: AttemptCtx, signal?: AbortSignal) => {
    const start = now();
    const timeoutMs = resolveOpenRouterTimeout(ctx.task);
    const { signal: dlSignal, done } = deadline(signal, timeoutMs);
    try {
      const response = (await openRouterProvider.request({ ...baseParams, model, signal: dlSignal })) as unknown as CompletionLike;
      done();
      const usage = response.usage
        ? { inputTokens: response.usage.prompt_tokens ?? 0, outputTokens: response.usage.completion_tokens ?? 0 }
        : undefined;
      logAttempt({
        requestId: ctx.requestId,
        task: ctx.task,
        provider: "openrouter",
        model,
        attempt: ctx.attempt,
        timeoutMs,
        durationMs: now() - start,
        result: "success",
        maxTokens: ctx.maxTokens,
        originalMaxTokens: ctx.originalMaxTokens,
        affordableMaxTokens: ctx.affordableMaxTokens,
        retryMaxTokens: ctx.retryMaxTokens,
        retryReason: ctx.retryReason,
        usage,
      });
      emit({ kind: "provider_success", provider: "openrouter", model });
      return {
        provider: "openrouter" as const,
        model,
        content: response.choices?.[0]?.message?.content ?? "",
        mode: "task" as const,
        latencyMs: now() - start,
        usage,
      };
    } catch (err) {
      done();
      const cls = classifyLlmError(err);
      logAttempt({
        requestId: ctx.requestId,
        task: ctx.task,
        provider: "openrouter",
        model,
        attempt: ctx.attempt,
        timeoutMs,
        durationMs: now() - start,
        result: cls.kind === "unknown" ? "error" : cls.kind,
        maxTokens: ctx.maxTokens,
        originalMaxTokens: ctx.originalMaxTokens,
        affordableMaxTokens: ctx.affordableMaxTokens,
        retryMaxTokens: ctx.retryMaxTokens,
        retryReason: ctx.retryReason,
      });
      emit({ kind: "provider_failure", provider: "openrouter", model, notes: errMessage(err) });
      throw new LlmGatewayError(`OpenRouter request failed: ${errMessage(err)}`, "openrouter", model, cls);
    }
  };

  const normalizeRequest = (req: LlmGatewayRequest) => {
    const task = req.task ?? "chat";
    const route = routeForTask(task, req.model);
    const baseParams: Record<string, unknown> = {
      messages: req.messages,
      temperature: req.temperature ?? 0.7,
      max_tokens: req.maxTokens ?? 512,
      tools: req.tools && req.tools.length > 0 ? req.tools : undefined,
      response_format: req.json ? { type: "json_object" } : undefined,
    };
    for (const key of Object.keys(baseParams)) {
      if (baseParams[key] === undefined) delete baseParams[key];
    }
    return { task, route, baseParams };
  };

  const assertConfigured = () => {
    if (!nvidiaEnabled() && !openRouterEnabled()) {
      const missing = missingProviderKeys().join(", ");
      emit({ kind: "no_provider", provider: "nvidia", notes: missing });
      throw new LlmGatewayError(`LLM gateway is not configured. Set at least one of: ${missing}`);
    }
  };

  /**
   * Shared OpenAI-shaped streaming driver. Applies a first-chunk budget; once
   * the first token arrives the timer is released so a long-running agent turn
   * is never cut by the first-token deadline.
   */
  const streamFromProvider = async function* (
    providerName: LlmProviderName,
    model: string,
    baseParams: Record<string, unknown>,
    signal: AbortSignal | undefined,
    firstTokenMs: number,
    ctx: AttemptCtx,
  ): AsyncGenerator<LlmGatewayStreamDelta> {
    const provider = providerName === "nvidia" ? nvidiaProvider : openRouterProvider;
    const wrap = new AbortController();
    const start = now();
    const timer = setTimeout(() => wrap.abort(new Error(`stream waited >${firstTokenMs}ms for first token`)), firstTokenMs);
    const onAbort = () => wrap.abort();
    if (signal?.aborted) wrap.abort();
    else signal?.addEventListener("abort", onAbort, { once: true });

    const recordStreamResult = (result: LlmAttemptResult) =>
      logAttempt({
        requestId: ctx.requestId,
        task: ctx.task,
        provider: providerName,
        model,
        attempt: ctx.attempt,
        timeoutMs: firstTokenMs,
        durationMs: now() - start,
        result,
      });

    let source: AsyncIterable<StreamChunkLike>;
    try {
      source = (await provider.request({ ...baseParams, model, stream: true, signal: wrap.signal })) as unknown as AsyncIterable<StreamChunkLike>;
    } catch (err) {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      if (providerName === "nvidia") breaker.recordFailure();
      const cls = classifyLlmError(err);
      recordStreamResult(cls.kind === "unknown" ? "error" : cls.kind);
      emit({ kind: "breaker_tripped", provider: providerName, model, notes: `stream connection failed: ${errMessage(err)}` });
      throw new LlmGatewayError(`${providerName} stream connection failed: ${errMessage(err)}`, providerName, model, cls);
    }

    let first = true;
    try {
      for await (const raw of source) {
        if (first) {
          first = false;
          clearTimeout(timer);
          signal?.removeEventListener("abort", onAbort);
        }
        const choice = raw.choices?.[0];
        const delta = choice?.delta;
        yield {
          provider: providerName,
          model,
          content: delta?.content ?? undefined,
          toolCalls: delta?.tool_calls?.map((tc) => ({
            index: tc.index ?? 0,
            id: tc.id,
            name: tc.function?.name,
            argumentsDelta: tc.function?.arguments,
          })),
          finishReason: choice?.finish_reason ?? null,
        };
      }
      if (providerName === "nvidia") breaker.recordSuccess();
      recordStreamResult("success");
      emit({ kind: "provider_success", provider: providerName, model });
    } catch (err) {
      clearTimeout(timer);
      if (providerName === "nvidia") breaker.recordFailure();
      const cls = classifyLlmError(err);
      recordStreamResult(cls.kind === "unknown" ? "error" : cls.kind);
      emit({ kind: "breaker_tripped", provider: providerName, model, notes: `stream aborted: ${errMessage(err)}` });
      throw new LlmGatewayError(`${providerName} stream aborted: ${errMessage(err)}`, providerName, model, cls);
    }
  };

  const complete = async (req: LlmGatewayRequest): Promise<LlmGatewayResult> => {
    assertConfigured();
    if (!req.messages?.length) throw new LlmGatewayError("messages is required");
    const task = req.task ?? "chat";
    const requestId = req.requestId ?? nextRequestId();
    const { route, baseParams } = normalizeRequest(req);

    const failureNotes: string[] = [];
    const describeFailure = (provider: string, model: string | undefined, err: unknown) => {
      const cause = errMessage(err);
      failureNotes.push(`${provider}${model ? `/${model}` : ""}: ${cause}`);
    };

    // Non-fallbackable (e.g. HTTP 400 malformed) aborts the WHOLE chain — the
    // request is broken, no other provider can fix it.
    const classificationOf = (err: unknown): LlmErrorClass =>
      err instanceof LlmGatewayError && err.classification ? err.classification : classifyLlmError(err);

    let attemptCount = 0;
    let chainFailureClass: LlmErrorClass | undefined;

    /**
     * Sequential fallback chain over the OpenRouter models. Each model is
     * attempted in order; a fallbackable failure moves to the next model, a
     * terminal failure (HTTP 400 etc.) aborts the entire request.
     *
     * On HTTP 402 (payment_required) with an affordableMaxTokens signal from
     * the provider, the SAME model is retried ONCE with the affordable budget.
     * The retry never exceeds the original requested max_tokens and is only
     * attempted when affordableMaxTokens >= 256 (a floor for a meaningful
     * completion). This turns a transient low-balance condition into a real
     * fallback without fabricating credits.
     */
    const tryOpenRouterChain = async (forwardAttempt: number, signal?: AbortSignal): Promise<LlmGatewayResult | null> => {
      for (const model of route.openRouterFallback) {
        attemptCount++;
        const attemptNumber = forwardAttempt + (attemptCount - 1);
        const originalMaxTokens = baseParams.max_tokens as number | undefined;

        // Primary attempt
        try {
          return await attemptOpenRouter(baseParams, model, { task, requestId, attempt: attemptNumber, maxTokens: originalMaxTokens }, signal);
        } catch (err) {
          describeFailure("openrouter", model, err);
          const cls = classificationOf(err);
          chainFailureClass = cls;

          // Terminal errors (e.g. malformed request) abort the entire chain
          if (!cls.fallbackable) throw err;

          // Adaptive affordability retry: only for 402 with a usable budget signal
          if (cls.kind === "payment_required" && cls.affordableMaxTokens !== undefined && cls.affordableMaxTokens >= 256) {
            const retryMaxTokens = Math.min(cls.affordableMaxTokens, originalMaxTokens ?? cls.affordableMaxTokens);

            // Record the affordability retry as a separate structured attempt
            attemptCount++;
            const retryAttemptNumber = forwardAttempt + (attemptCount - 1);

            try {
              const retryParams = { ...baseParams, max_tokens: retryMaxTokens };
              const retryResult = await attemptOpenRouter(retryParams, model, {
                task,
                requestId,
                attempt: retryAttemptNumber,
                maxTokens: retryMaxTokens,
                originalMaxTokens,
                affordableMaxTokens: cls.affordableMaxTokens,
                retryMaxTokens,
                retryReason: "payment_required_affordable_budget",
              }, signal);
              return retryResult;
            } catch (retryErr) {
              // Retry failed — continue to next model in chain (attempt already logged by attemptOpenRouter)
            }
          }
        }
      }
      return null;
    };

    if (req.mode === "race") {
      const nvidiaLeg = async (): Promise<LlmGatewayResult | null> => {
        try {
          attemptCount++;
          return await attemptNvidia(baseParams, route.nvidiaModel, { task, requestId, attempt: 1 }, req.signal);
        } catch (err) {
          describeFailure("nvidia", route.nvidiaModel, err);
          if (!classificationOf(err).fallbackable) throw err;
          return null;
        }
      };
      const [nvidiaResult, openRouterResult] = await Promise.all([nvidiaLeg(), tryOpenRouterChain(1, req.signal)]);
      const finished = [nvidiaResult, openRouterResult].filter((r): r is LlmGatewayResult => r !== null);
      if (finished.length === 0) {
        const detail = failureNotes.join(" | ");
        logAllFailed(requestId, task, attemptCount, detail || "race produced no leg");
        throw new LlmGatewayError(`All LLM providers failed; unable to serve the request.${detail ? ` Chain: ${detail}` : ""}`, "nvidia", undefined, chainFailureClass);
      }
      // True "first to finish": both legs start together; pick the fastest one.
      finished.sort((a, b) => a.latencyMs - b.latencyMs);
      return { ...finished[0], mode: "race" };
    }

    if (nvidiaAllowed()) {
      try {
        attemptCount++;
        return await attemptNvidia(baseParams, route.nvidiaModel, { task, requestId, attempt: 1 }, req.signal);
      } catch (err) {
        describeFailure("nvidia", route.nvidiaModel, err);
        if (!classificationOf(err).fallbackable) throw err;
        emit({ kind: "fallback_used", provider: "openrouter", notes: `NVIDIA failed; moving down the chain: ${errMessage(err)}` });
      }
    } else if (openRouterEnabled() || deps?.openRouterProvider) {
      emit({ kind: "fallback_used", provider: "openrouter", notes: "NVIDIA unavailable (breaker/bucket); running fallback" });
    }

    const openRouterResult = await tryOpenRouterChain(1, req.signal);
    if (openRouterResult) return openRouterResult;
    const detail = failureNotes.join(" | ");
    logAllFailed(requestId, task, attemptCount, detail || "OpenRouter chain exhausted");
    // Attach the last OpenRouter failure's classification (e.g. payment_required
    // when every model hit an affordable-budget 402) so the final error is an
    // honest reflection of why the chain died — never a generic timeout/unknown.
    throw new LlmGatewayError(`All LLM providers failed; unable to serve the request.${detail ? ` Chain: ${detail}` : ""}`, "openrouter", undefined, chainFailureClass);
  };

  const completeStream = async function* (req: LlmGatewayStreamRequest): AsyncGenerator<LlmGatewayStreamDelta> {
    assertConfigured();
    if (!req.messages?.length) throw new LlmGatewayError("messages is required");
    if (req.mode === "race") {
      // Flag the gap loudly instead of silently buffering a streamed answer.
      throw new LlmGatewayError("mode: race is not supported for streaming — use task mode");
    }
    const task = req.task ?? "chat";
    const requestId = req.requestId ?? nextRequestId();
    const { route, baseParams } = normalizeRequest(req);

    const streamFailureNotes: string[] = [];
    const classificationOf = (err: unknown): LlmErrorClass =>
      err instanceof LlmGatewayError && err.classification ? err.classification : classifyLlmError(err);

    let streamAttempts = 0;
    if (nvidiaAllowed()) {
      streamAttempts++;
      try {
        yield* streamFromProvider("nvidia", route.nvidiaModel, baseParams, req.signal, resolveNvidiaTimeout(task), {
          task,
          requestId,
          attempt: 1,
        });
        return;
      } catch (err) {
        streamFailureNotes.push(`nvidia/${route.nvidiaModel}: ${errMessage(err)}`);
        if (!classificationOf(err).fallbackable) throw err;
        emit({ kind: "fallback_used", provider: "openrouter", notes: `NVIDIA stream failed before first token: ${errMessage(err)}` });
      }
    }

    for (const model of route.openRouterFallback) {
      streamAttempts++;
      try {
        yield* streamFromProvider("openrouter", model, baseParams, req.signal, resolveOpenRouterTimeout(task), {
          task,
          requestId,
          attempt: streamAttempts,
        });
        return;
      } catch (err) {
        streamFailureNotes.push(`openrouter/${model}: ${errMessage(err)}`);
        if (!classificationOf(err).fallbackable) throw err;
      }
    }
    const streamDetail = streamFailureNotes.join(" | ");
    logAllFailed(requestId, task, streamAttempts, streamDetail || "OpenRouter stream chain exhausted");
    throw new LlmGatewayError(`All LLM providers failed to stream.${streamDetail ? ` Chain: ${streamDetail}` : ""}`);
  };

  const health = (): LlmGatewayHealth => {
    const route = routeForTask("chat");
    const nv = nvidiaEnabled();
    const or = openRouterEnabled();
    return {
      ready: nv || or,
      reason: nv || or ? undefined : "no provider API key configured",
      nvidia: {
        configured: nv,
        model: route.nvidiaModel,
        bucketAvailable: bucket.available(),
        breaker: breaker.snapshot(),
        timeoutMs: resolveNvidiaTimeout("chat"),
      },
      openRouter: {
        configured: or,
        timeoutMs: resolveOpenRouterTimeout("chat"),
        model: route.openRouterFallback[0] ?? "",
      },
    };
  };

  return { complete, stream: completeStream, assertConfigured, health };
}

let gatewayInstance: LlmGateway | null = null;

/**
 * Lazy-built singleton. Constructed on first use so that the missing-key
 * fail-fast (createGateway) surfaces at the moment the app first speaks to an
 * LLM — without breaking imports in environments that never call it.
 */
export const llmGateway: LlmGateway = new Proxy({} as LlmGateway, {
  get(_target, prop: string | symbol) {
    if (typeof prop === "symbol") return undefined;
    const live = gatewayInstance ?? (gatewayInstance = createGateway());
    return Reflect.get(live, prop);
  },
});