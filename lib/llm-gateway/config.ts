/**
 * Task → model routing table for the LLM gateway.
 *
 * Task-mapped routing is the default: one NVIDIA model per job so free quota
 * is never spent on the wrong-sized model. OpenAI-NVIDIA-compatible server.
 * Each NVIDIA model and each OpenRouter fallback is overridable via env vars
 * (the OpenRouter `:free` lineup rotates, so env override is the supported way
 * to re-point it without a code deploy).
 *
 * Pure module: reads process.env at call time, no IO beyond that — directly
 * unit-testable.
 */

export type TaskKey = "chat" | "heavy" | "reasoning" | "fast" | "code";

/**
 * Task → NVIDIA model table. Verified live against the NVIDIA NIM API on
 * 2026-08-09 (models that 404/410 for this account are deliberately absent):
 *
 *   heavy     nvidia/nemotron-3-ultra-550b-a55b   long-context heavy jobs
 *   chat      minimaxai/minimax-m3                default / interactive chat
 *   reasoning nvidia/nemotron-3-ultra-550b-a55b   latent synthesis (digests)
 *              ^ heavy and reasoning alias the same NVIDIA model
 *   fast      minimaxai/minimax-m3                latency-critical drafts
 *   code      minimaxai/minimax-m3                code-generation tools
 *
 * NOTE: deepseek-ai/deepseek-v4-pro (the old heavy/chat default) reached end
 * of life 2026-08-07 — NVIDIA returns HTTP 410 for it. minimax-m3 is the
 * dependable workhorse on this account; nemotron-ultra occasionally 503s on
 * worker-capacity bursts (the OpenRouter fallback covers that).
 */
export const NVIDIA_MODEL_DEFAULTS: Record<TaskKey, string> = {
  heavy: "nvidia/nemotron-3-ultra-550b-a55b",
  reasoning: "nvidia/nemotron-3-ultra-550b-a55b",
  fast: "minimaxai/minimax-m3",
  code: "minimaxai/minimax-m3",
  chat: "minimaxai/minimax-m3",
};

/**
 * Built-in OpenRouter fallback chain (used when no task-level env is set).
 * gpt-4o-mini first: it is the only widely-available steady model on this
 * account. deepseek/deepseek-chat-v3 was re-ordered LAST because it returns
 * HTTP 402 when the OpenRouter credit balance is near zero (observed with
 * max_tokens >= ~500). Retired slugs (google/gemini-2.0-flash-001 → 404, and
 * the vanishing `:free` lineup) are not listed. Any of these can be overridden
 * per task with OPENROUTER_MODEL_<TASK>.
 */
export const OPENROUTER_FALLBACK_DEFAULTS = [
  "openai/gpt-4o-mini",
  "deepseek/deepseek-chat-v3",
];

/** NVIDIA endpoints. */
export const NVIDIA_BASE_URL = process.env.NVIDIA_BASE_URL || "https://integrate.api.nvidia.com/v1";
export const OPENROUTER_BASE_URL = process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1";

const TASK_ENV = {
  heavy: "NVIDIA_MODEL_HEAVY",
  reasoning: "NVIDIA_MODEL_REASONING",
  fast: "NVIDIA_MODEL_FAST",
  code: "NVIDIA_MODEL_CODE",
  chat: "NVIDIA_MODEL_CHAT",
} as const;

/** Number of NVIDIA requests allowed per minute against the shared key. */
export const NVIDIA_RPM = 35;
export const NVIDIA_RPM_WINDOW_MS = 60_000;
export const NVIDIA_TIMEOUT_MS = 20_000;
export const OPENROUTER_TIMEOUT_MS = 30_000;

/** Circuit breaker policy for the NVIDIA provider. */
export const NVIDIA_BREAKER_FAILURE_THRESHOLD = 5;
export const NVIDIA_BREAKER_WINDOW_MS = 60_000;
export const NVIDIA_BREAKER_COOLDOWN_MS = 45_000;

export interface TaskRoute {
  nvidiaModel: string;
  openRouterFallback: string[];
}

/** Resolve the NVIDIA model for a task (env override wins, else default). */
export function resolveNvidiaModel(task: TaskKey): string {
  return process.env[TASK_ENV[task]] || NVIDIA_MODEL_DEFAULTS[task];
}

/**
 * Resolve the OpenRouter fallback chain for a task.
 * Order: explicit model (user-chosen, e.g. from the UI) → task-level env →
 * legacy OPENROUTER_MODEL → built-in defaults. All `:free` slugs live in env.
 */
export function resolveOpenRouterChain(task: TaskKey, explicitModel?: string | null): string[] {
  const chain: string[] = [];
  const pushUnique = (model?: string | null) => {
    if (model && !chain.includes(model)) chain.push(model);
  };
  pushUnique(explicitModel);
  pushUnique(process.env[`OPENROUTER_MODEL_${task.toUpperCase()}`]);
  pushUnique(process.env.OPENROUTER_MODEL);
  for (const m of OPENROUTER_FALLBACK_DEFAULTS) pushUnique(m);
  return chain;
}

/** Everything the gateway needs for a task, resolved once per request. */
export function routeForTask(task: TaskKey, explicitModel?: string | null): TaskRoute {
  return {
    nvidiaModel: resolveNvidiaModel(task),
    openRouterFallback: resolveOpenRouterChain(task, explicitModel),
  };
}

/**
 * Fails loudly (not silently) when the gateway cannot serve ANY request:
 * neither provider key is configured. Individual keys missing are a soft
 * constraint — NVIDIA missing still allows OpenRouter and vice-versa.
 */
export function missingProviderKeys(): string[] {
  const missing: string[] = [];
  if (!process.env.NVIDIA_API_KEY) missing.push("NVIDIA_API_KEY");
  if (!process.env.OPENROUTER_API_KEY) missing.push("OPENROUTER_API_KEY");
  return missing;
}