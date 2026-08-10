/**
 * LLM error classification.
 *
 * Decides whether a provider error is worth falling through to the next
 * configured model/provider (fallbackable) or is a hard, request-level failure
 * that no other provider can fix (terminal). Pure module — no env, no IO —
 * so it is directly unit-testable.
 *
 * Fallbackable (transient / provider-specific):
 *   timeout, AbortError, HTTP 408, HTTP 429, HTTP 402, HTTP 404,
 *   HTTP 401, HTTP 5xx, connection reset / network failure, unknown.
 *
 * Terminal (cannot succeed on another provider):
 *   HTTP 400 malformed request. A broken request body fails identically on
 *   every provider, so retrying it is a retry storm with no upside.
 *
 * NOTE: HTTP 402 (insufficient OpenRouter balance) is deliberately
 * fallbackable — the configured chain may contain a model that is still paid
 * or available, and OpenRouter's own model-level fallback contract is exactly
 * "try the next model in order".
 */

export type LlmErrorKind =
  | "timeout"
  | "rate_limit"
  | "payment_required"
  | "server_error"
  | "authentication"
  | "malformed_request"
  | "model_not_found"
  | "network"
  | "unknown";

export interface LlmErrorClass {
  kind: LlmErrorKind;
  /** True → record the attempt and move to the next model/provider. */
  fallbackable: boolean;
  status?: number;
  /**
   * Set on HTTP 402 when the provider's message includes how many output
   * tokens the account can actually afford (e.g. OpenRouter:
   * "can only afford 707"). The gateway uses this to re-request the SAME
   * model once with a budget that fits — turning a "low balance" 402 into a
   * successful fallback instead of an honest-but-avoidable failure.
   */
  affordableMaxTokens?: number;
}

const TIMEOUT_MARKERS = [
  "timed out",
  "timeout",
  "aborted",
  "abort",
  "operation was aborted",
];

const NETWORK_MARKERS = [
  "fetch failed",
  "econnreset",
  "econnrefused",
  "enetunreach",
  "etimedout",
  "eai_again",
  "epipe",
  "econnaborted",
  "enotfound",
  "getaddrinfo",
  "socket hang up",
  "connection reset",
  "network",
  "underlying socket",
];

const KNOWN_ERROR_CODES = new Set([
  "ECONNRESET",
  "ECONNREFUSED",
  "ENETUNREACH",
  "ETIMEDOUT",
  "EAI_AGAIN",
  "EPIPE",
  "ECONNABORTED",
  "ENOTFOUND",
  "ABORT_ERR",
  "ERR_SOCKET_CONNECTION_TIMEOUT",
  "UND_ERR_SOCKET",
]);

/** Extract an HTTP status from the many shapes providers/SDKs throw. */
function extractStatus(err: unknown): number | undefined {
  if (!err || typeof err !== "object") return undefined;
  const e = err as Record<string, unknown>;
  const candidate = e.status ?? e.statusCode ?? (e.response as Record<string, unknown> | undefined)?.status;
  const num = typeof candidate === "number" ? candidate : typeof candidate === "string" ? Number(candidate) : NaN;
  return Number.isFinite(num) && num >= 100 && num < 600 ? num : undefined;
}

function hasName(err: unknown, name: string): boolean {
  return !!(err && typeof err === "object" && (err as { name?: unknown }).name === name);
}

function messageOf(err: unknown): string {
  return (err as { message?: unknown })?.message ? String((err as { message?: unknown }).message) : "";
}

/**
 * Parse the affordable output budget from a provider 402 message. OpenRouter
 * phrases it as "You requested up to N tokens, but can only afford M". Returns
 * a floor of 1 to avoid a legit "affordable 0" being treated as absent.
 */
export function extractAffordableMaxTokens(message: string): number | undefined {
  const match = /can only afford\s+([\d,]+)/i.exec(message);
  if (!match) return undefined;
  const raw = Number(match[1].replace(/,/g, ""));
  return Number.isFinite(raw) && raw >= 1 ? Math.floor(raw) : undefined;
}

/**
 * Classify a thrown provider error. Fast and conservative: a status code we
 * recognise maps directly; otherwise message/code heuristics; anything else
 * is treated as fallbackable "unknown" so a single opaque provider error can
 * never take down the briefing when another provider is available.
 */
export function classifyLlmError(err: unknown): LlmErrorClass {
  if (hasName(err, "AbortError") || (err as { code?: unknown }).code === "ABORT_ERR") {
    return { kind: "timeout", fallbackable: true };
  }

  const status = extractStatus(err);
  if (status !== undefined) {
    switch (status) {
      case 400:
        return { kind: "malformed_request", fallbackable: false, status };
      case 401:
        return { kind: "authentication", fallbackable: true, status };
      case 402:
        return {
          kind: "payment_required",
          fallbackable: true,
          status,
          affordableMaxTokens: extractAffordableMaxTokens(messageOf(err)),
        };
      case 404:
        return { kind: "model_not_found", fallbackable: true, status };
      case 408:
        return { kind: "timeout", fallbackable: true, status };
      case 429:
        return { kind: "rate_limit", fallbackable: true, status };
      default:
        if (status >= 500 && status < 600) {
          return { kind: "server_error", fallbackable: true, status };
        }
        break;
    }
  }

  const code = (err as { code?: unknown }).code;
  if (typeof code === "string" && KNOWN_ERROR_CODES.has(code.toUpperCase())) {
    return { kind: code.toUpperCase() === "ABORT_ERR" ? "timeout" : "network", fallbackable: true };
  }

  const msg = messageOf(err).toLowerCase();
  if (TIMEOUT_MARKERS.some((m) => msg.includes(m))) {
    return { kind: "timeout", fallbackable: true };
  }
  if (NETWORK_MARKERS.some((m) => msg.includes(m))) {
    return { kind: "network", fallbackable: true };
  }

  return { kind: "unknown", fallbackable: true };
}
