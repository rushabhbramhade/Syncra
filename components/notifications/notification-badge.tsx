"use client";

import { useState, useEffect } from "react";
import { Bell, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth-provider";

export function NotificationBadge() {
  const { user } = useAuth();
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;

    const load = async () => {
      try {
        const { getUnreadCountAction } = await import("@/app/actions/notification-center");
        const result = await getUnreadCountAction(user.id);
        if (result.success) setCount(result.count);
      } catch {
        // Quiet fail
      } finally {
        setLoading(false);
      }
    };

    load();

    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [user?.id]);

  return (
    <button
      onClick={() => window.location.href = "/dashboard/notifications"}
      className="relative p-2 rounded-xl hover:bg-border-mist text-text-slate transition-colors"
    >
      {loading ? (
        <Loader2 className="w-5 h-5 animate-spin" />
      ) : (
        <Bell className="w-5 h-5" />
      )}
      {count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full shadow-sm">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </button>
  );
}