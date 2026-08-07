export class MetricsCollector {
  private counters: Map<string, number> = new Map();
  private histograms: Map<string, number[]> = new Map();

  increment(counter: string, value: number = 1): void {
    this.counters.set(counter, (this.counters.get(counter) ?? 0) + value);
  }

  recordLatency(metric: string, ms: number): void {
    const values = this.histograms.get(metric) ?? [];
    if (values.length >= 1000) values.shift();
    values.push(ms);
    this.histograms.set(metric, values);
  }

  trackProviderFetch(provider: string, durationMs: number, success: boolean, retryCount = 0): void {
    this.recordLatency(`provider_fetch_latency_ms_${provider}`, durationMs);
    this.increment(success ? `provider_success_total_${provider}` : `provider_error_total_${provider}`);
    if (retryCount > 0) {
      this.increment(`provider_retries_total_${provider}`, retryCount);
    }
  }

  trackAILatency(model: string, durationMs: number, success: boolean): void {
    const sanitizedModel = model.replace(/[^a-zA-Z0-9_-]/g, "_");
    this.recordLatency(`ai_latency_ms_${sanitizedModel}`, durationMs);
    this.increment(success ? `ai_success_total_${sanitizedModel}` : `ai_error_total_${sanitizedModel}`);
  }

  trackDbLatency(operation: string, durationMs: number): void {
    this.recordLatency(`db_latency_ms_${operation}`, durationMs);
  }

  trackDashboardGen(durationMs: number, success: boolean): void {
    this.recordLatency("dashboard_gen_latency_ms", durationMs);
    this.increment(success ? "dashboard_gen_success_total" : "dashboard_gen_error_total");
  }

  getCounters(): Record<string, number> {
    return Object.fromEntries(this.counters);
  }

  getLatencyAverages(): Record<string, number> {
    const result: Record<string, number> = {};
    for (const [key, values] of this.histograms) {
      const sum = values.reduce((a, b) => a + b, 0);
      result[key] = values.length > 0 ? Math.round((sum / values.length) * 100) / 100 : 0;
    }
    return result;
  }

  getSummary(): { counters: Record<string, number>; latencyAverages: Record<string, number> } {
    return {
      counters: this.getCounters(),
      latencyAverages: this.getLatencyAverages(),
    };
  }

  reset(): void {
    this.counters.clear();
    this.histograms.clear();
  }
}

export const dashboardMetrics = new MetricsCollector();
