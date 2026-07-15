export class MetricsCollector {
  private counters: Map<string, number> = new Map();
  private histograms: Map<string, number[]> = new Map();

  increment(counter: string, value: number = 1): void {
    this.counters.set(counter, (this.counters.get(counter) ?? 0) + value);
  }

  recordLatency(metric: string, ms: number): void {
    const values = this.histograms.get(metric) ?? [];
    values.push(ms);
    this.histograms.set(metric, values);
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

  reset(): void {
    this.counters.clear();
    this.histograms.clear();
  }
}

export const dashboardMetrics = new MetricsCollector();
