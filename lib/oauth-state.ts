import * as crypto from "crypto";
import { getHmacSecret } from "./oauth";

const STATE_TTL_MS = 10 * 60 * 1000;

interface StatePayload {
  userId: string;
  timestamp: number;
  redirectUri?: string;
  codeVerifier?: string;
}

function encodePayload(userId: string, timestamp: number, redirectUri?: string, codeVerifier?: string): string {
  return JSON.stringify({ userId, timestamp, redirectUri, codeVerifier });
}

function decodePayload(payload: string): StatePayload | null {
  try {
    const obj = JSON.parse(payload);
    if (typeof obj.userId !== "string" || typeof obj.timestamp !== "number") return null;
    if (isNaN(obj.timestamp)) return null;
    if (Date.now() - obj.timestamp > STATE_TTL_MS) return null;
    return obj as StatePayload;
  } catch {
    return null;
  }
}

export function signState(userId: string, redirectUri?: string, codeVerifier?: string): string {
  const secret = getHmacSecret();
  const timestamp = Date.now();
  const payload = encodePayload(userId, timestamp, redirectUri, codeVerifier);
  const hmac = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  return `${payload}.${hmac}`;
}

export function verifyStateFull(state: string, expectedRedirectUri?: string): { userId: string; codeVerifier?: string } | null {
  try {
    const secret = getHmacSecret();
    const dotIndex = state.lastIndexOf(".");
    if (dotIndex === -1) return null;
    const payload = state.substring(0, dotIndex);
    const signature = state.substring(dotIndex + 1);

    const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
      return null;
    }

    const decoded = decodePayload(payload);
    if (!decoded) return null;

    if (expectedRedirectUri && decoded.redirectUri && decoded.redirectUri !== expectedRedirectUri) {
      return null;
    }

    return { userId: decoded.userId, codeVerifier: decoded.codeVerifier };
  } catch {
    return null;
  }
}

export function verifyState(state: string, expectedRedirectUri?: string): string | null {
  const result = verifyStateFull(state, expectedRedirectUri);
  return result?.userId || null;
}

const consumedStates = new Set<string>();

export function consumeState(state: string): boolean {
  const dotIndex = state.lastIndexOf(".");
  if (dotIndex === -1) return false;
  const payload = state.substring(0, dotIndex);
  const key = payload;
  if (consumedStates.has(key)) return false;
  consumedStates.add(key);
  setTimeout(() => consumedStates.delete(key), STATE_TTL_MS);
  return true;
}

export function setOAuthStateCookie(state: string): string {
  const isHttps = process.env.NODE_ENV === "production" ||
    (process.env.NEXT_PUBLIC_APP_URL || "").startsWith("https");
  const secure = isHttps ? "; Secure" : "";
  return `oauth_state=${state}; HttpOnly; SameSite=Lax; Path=/; Max-Age=600${secure}`;
}
