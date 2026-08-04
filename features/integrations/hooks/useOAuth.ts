"use client";

import { useCallback } from "react";
import { getProviderMeta } from "@/features/integrations/constants/providers";
import { PROVIDER_IDS } from "@/features/integrations/types";

const OAUTH_ROUTES: Record<string, string> = {
  gmail: "/api/google",
  slack: "/api/slack",
  github: "/api/github",
  discord: "/api/discord",
  linkedin: "/api/linkedin",
};

/**
 * Kicks off provider OAuth. Returns { needsModal } so callers can fall back
 * to token/pairing flows (WhatsApp, Telegram) for non-OAuth providers.
 */
export function useOAuth() {
  const startOAuth = useCallback((provider: string, userId: string): { needsModal: boolean; url: string | null } => {
    const route = OAUTH_ROUTES[provider];
    if (!route) return { needsModal: true, url: null };
    const url = route;
    window.location.assign(url);
    return { needsModal: false, url };
  }, []);

  const isOAuthProvider = useCallback((provider: string) => {
    const meta = getProviderMeta(provider);
    return meta.hasOAuth && OAUTH_ROUTES[provider] !== undefined;
  }, []);

  return { startOAuth, isOAuthProvider, oauthProviders: PROVIDER_IDS.filter((p) => OAUTH_ROUTES[p]) };
}
