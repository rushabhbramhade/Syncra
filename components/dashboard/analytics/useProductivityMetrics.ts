"use client";
import { useState, useCallback } from "react";

export interface ProductivityMetrics {
  emailsReplied: number;
  tasksCompleted: number;
  meetingsAttended: number;
  averageResponseTimeMinutes: number;
  focusHoursToday: number;
  aiInteractions: number;
  trend: "up" | "down" | "stable";
}

export function useProductivityMetrics(userId: string | undefined) {
  const [metrics, setMetrics] = useState<ProductivityMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!userId) return;
    setIsLoading(true);
    // Not yet implemented — requires real analytics data aggregation
    setMetrics(null);
    setIsLoading(false);
  }, [userId]);

  return { metrics, isLoading, refresh };
}
