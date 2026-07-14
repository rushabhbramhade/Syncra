"use client";

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { syncUserToDatabase, signOutAction, getCurrentUserAction } from "@/app/actions";

export interface InsforgeUser {
  id: string;
  email: string;
  profile?: {
    name?: string;
    avatar_url?: string;
  } | null;
  providers?: string[];
  emailVerified?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface DatabaseUser {
  id: string;
  auth_user_id: string;
  email: string;
  full_name: string;
  avatar_url?: string | null;
  auth_provider: string;
  email_verified: boolean;
  created_at: string | null;
  last_login_at: string | null;
}

interface AuthContextType {
  user: InsforgeUser | null;
  dbUser: DatabaseUser | null;
  isLoading: boolean;
  errorMsg: string;
  refreshSession: () => Promise<void>;
  clearSession: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {

  const [user, setUser] = useState<InsforgeUser | null>(null);
  const [dbUser, setDbUser] = useState<DatabaseUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  const hasFetched = useRef(false);
  const isMounted = useRef(true);
  const isRefreshing = useRef(false);
  const lastSyncRef = useRef<number>(0);

  const clearSession = useCallback(() => {
    setUser(null);
    setDbUser(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem("syncra-user-session");
      localStorage.removeItem("syncra-db-user-session");
    }
  }, []);

  const refreshSession = useCallback(async () => {
    if (typeof window === "undefined") return;
    if (isRefreshing.current) return;
    isRefreshing.current = true;

    setIsLoading(true);
    setErrorMsg("");

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("AUTH_TIMEOUT")), 5000)
    );

    try {
      const result = await Promise.race([
        getCurrentUserAction(),
        timeoutPromise
      ]) as Awaited<ReturnType<typeof getCurrentUserAction>>;

      if (!isMounted.current) return;

      const { data, error } = result;

      const isDefinitiveUnauthenticated =
        (!error && !data?.user) ||
        (error && (error.statusCode === 401 || error.statusCode === 403 || error.error === "UNAUTHORIZED" || error.error === "AUTH_SESSION_MISSING"));

      if (isDefinitiveUnauthenticated) {
        clearSession();
        setIsLoading(false);
        signOutAction().finally(() => {
          window.location.href = "/sign-in";
        });
        return;
      }

      if (error) {
        console.warn("Non-definitive auth check failure:", error);
        clearSession();
        setErrorMsg("Unable to verify your session. Please sign in again.");
        setIsLoading(false);
        return;
      }

      const verifiedUser = data?.user as InsforgeUser;
      if (verifiedUser) {
        setUser(verifiedUser);
        if (typeof window !== "undefined") {
          localStorage.setItem("syncra-user-session", JSON.stringify(verifiedUser));
        }

        if (Date.now() - lastSyncRef.current >= 60000) {
          try {
            const syncedUser = await syncUserToDatabase({
              auth_user_id: verifiedUser.id,
              email: verifiedUser.email,
              full_name: verifiedUser.profile?.name || "New User",
              avatar_url: verifiedUser.profile?.avatar_url || null,
              auth_provider: verifiedUser.providers?.[0] || "email",
              email_verified: verifiedUser.emailVerified || false,
            });
            if (isMounted.current) {
              setDbUser(syncedUser);
              lastSyncRef.current = Date.now();
              if (typeof window !== "undefined") {
                localStorage.setItem("syncra-db-user-session", JSON.stringify(syncedUser));
              }
            }
          } catch (err) {
            console.error("Failed to sync user record:", err);
          }
        }
      }

      setIsLoading(false);

    } catch (err: unknown) {
      if (!isMounted.current) return;

      const errorObj = err as { message?: string };
      if (errorObj.message === "AUTH_TIMEOUT") {
        console.warn("Authentication request timed out after 5s ceiling.");
        setErrorMsg("Authentication server took too long to respond. Please refresh.");
        clearSession();
      } else {
        console.error("Session verification error:", err);
        setErrorMsg("Connection error while validating session.");
        clearSession();
      }
      
      setIsLoading(false);
    } finally {
      isRefreshing.current = false;
    }
  }, [clearSession]);

  useEffect(() => {
    isMounted.current = true;
    if (!hasFetched.current) {
      hasFetched.current = true;
      refreshSession();
    }
    return () => {
      isMounted.current = false;
    };
  }, [refreshSession]);

  return (
    <AuthContext.Provider value={{ user, dbUser, isLoading, errorMsg, refreshSession, clearSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
