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
    // Simulated — replace with real analytics query
    await new Promise(r => setTimeout(r, 500));
    setMetrics({
      emailsReplied: 12,
      tasksCompleted: 5,
      meetingsAttended: 3,
      averageResponseTimeMinutes: 18,
      focusHoursToday: 4.5,
      aiInteractions: 8,
      trend: "up",
    });
    setIsLoading(false);
  }, [userId]);

  return { metrics, isLoading, refresh };
}
