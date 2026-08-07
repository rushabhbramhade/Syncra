interface HttpError extends Error {
  status?: number;
  response?: { status?: number };
}

interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
}

const HTTP_RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: RetryOptions
): Promise<T> {
  const { maxRetries = 3, baseDelayMs = 1000, maxDelayMs = 30000 } = options || {};
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt >= maxRetries) break;

      const httpErr = err as HttpError;
      const status = httpErr.status || httpErr.response?.status || 0;
      if (status !== 0 && !HTTP_RETRYABLE_STATUSES.has(status)) break;

      const delay = Math.min(baseDelayMs * Math.pow(2, attempt) + Math.random() * 1000, maxDelayMs);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError || new Error("Retry failed");
}

export async function fetchWithRetry(
  url: string,
  init?: RequestInit,
  retries: number = 3
): Promise<Response> {
  return withRetry(async () => {
    const res = await fetch(url, init);
    if (!res.ok) {
      const err = new Error(`HTTP ${res.status}: ${res.statusText}`) as HttpError;
      err.status = res.status;
      throw err;
    }
    return res;
  }, { maxRetries: retries });
}
