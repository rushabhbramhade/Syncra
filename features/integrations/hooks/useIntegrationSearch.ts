"use client";

import { useMemo, useState } from "react";
import type { WorkspaceIntegration } from "@/app/actions/integrations";

export function useIntegrationSearch(integrations: WorkspaceIntegration[]) {
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return integrations;
    return integrations.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        i.provider.toLowerCase().includes(q) ||
        (i.email || "").toLowerCase().includes(q) ||
        (i.scopes || "").toLowerCase().includes(q)
    );
  }, [integrations, query]);

  return { query, setQuery, results };
}
