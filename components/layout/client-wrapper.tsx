"use client";

import React, { useEffect } from "react";
import { usePathname } from "next/navigation";
import { Lenis } from "lenis/react";

export function ClientWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isDashboard = pathname.startsWith("/dashboard");

  // Force light mode on non-dashboard pages
  useEffect(() => {
    const root = document.documentElement;
    if (!isDashboard) {
      root.classList.remove("dark");
    }
  }, [isDashboard]);

  return (
    <Lenis root options={{ autoRaf: true }}>
      {children}
    </Lenis>
  );
}