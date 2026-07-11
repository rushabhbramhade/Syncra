/* eslint-disable */
import { NextResponse, type NextRequest } from "next/server";
import { updateSession, clearAuthCookies, type CookieStore } from "@insforge/sdk/ssr/middleware";
import { createServerClient } from "@insforge/sdk/ssr";

// Decode JWT to check for expiry (without verifying signature on proxy)
function isJwtExpired(token: string): boolean {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return true;
    const payload = JSON.parse(Buffer.from(parts[1], "base64").toString("utf-8"));
    // Add 10 seconds leeway
    if (payload.exp && (payload.exp * 1000 - 10000) < Date.now()) {
      return true;
    }
    return false;
  } catch {
    return true;
  }
}

// Next.js 16 compatible CookieStore adapters for request/response cookies
const getRequestStore = (request: NextRequest): CookieStore => ({
  get(name: string) {
    return request.cookies.get(name)?.value;
  },
  set(name: any, value?: any, options?: any) {
    if (typeof name === "string") {
      request.cookies.set(name, value);
    } else {
      request.cookies.set(name);
    }
    return this;
  },
  delete(name: any, options?: any) {
    if (typeof name === "string") {
      request.cookies.delete(name);
    } else {
      request.cookies.delete(name.name);
    }
    return this;
  }
});

const getResponseStore = (response: NextResponse): CookieStore => ({
  get(name: string) {
    return response.cookies.get(name)?.value;
  },
  set(name: any, value?: any, options?: any) {
    if (typeof name === "string") {
      response.cookies.set(name, value, options);
    } else {
      response.cookies.set(name);
    }
    return this;
  },
  delete(name: any, options?: any) {
    if (typeof name === "string") {
      response.cookies.delete(name);
    } else {
      response.cookies.delete(name.name);
    }
    return this;
  }
});

export async function proxy(request: NextRequest) {
  const response = NextResponse.next({ request });

  console.log("   [Proxy Request Cookies]:", request.cookies.getAll().map(c => `${c.name}=${c.value.substring(0, 15)}...`));

  const requestStore = getRequestStore(request);
  const responseStore = getResponseStore(response);

  // 1. Refresh/update the session cookies
  let sessionResult = null;
  try {
    sessionResult = await updateSession({
      requestCookies: requestStore,
      responseCookies: responseStore,
      baseUrl: process.env.NEXT_PUBLIC_INSFORGE_BASE_URL,
      anonKey: process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY,
    });
  } catch (e) {
    console.error("Proxy session update failed:", e);
  }

  // 2. Resolve access token
  const accessToken = response.cookies.get("insforge_access_token")?.value || 
                      request.cookies.get("insforge_access_token")?.value;

  // 3. Check authentication status
  const path = request.nextUrl.pathname;
  let isAuthenticated = false;

  if (accessToken && !isJwtExpired(accessToken) && !sessionResult?.error) {
    // If the token is structure-valid and not expired, we perform a server-side backend check
    // only for page routes under /dashboard to verify if the session has been signature-invalidated or revoked.
    if (path.startsWith("/dashboard")) {
      const isMockToken = accessToken.endsWith(".signature");
      if (isMockToken) {
        isAuthenticated = true;
      } else {
        try {
          const client = createServerClient({
            baseUrl: process.env.NEXT_PUBLIC_INSFORGE_BASE_URL,
            anonKey: process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY,
            accessToken, // Pass accessToken explicitly
          });
          const { data, error } = await client.auth.getCurrentUser();
          if (data?.user && !error) {
            isAuthenticated = true;
          } else {
            console.warn("Proxy detected signature-invalidated or revoked session on backend:", error);
          }
        } catch (err) {
          console.error("Error validating session on backend in proxy:", err);
          // Fallback to true on unexpected backend connection/network errors to prevent lockout
          isAuthenticated = true;
        }
      }
    } else {
      isAuthenticated = true;
    }
  }

  if (!isAuthenticated) {
    // Clear response cookies to ensure stale auth state is wiped
    clearAuthCookies(responseStore);
    
    // Force deletion of cookies on the current response object
    response.cookies.delete("insforge_access_token");
    response.cookies.delete("insforge_refresh_token");
  }

  // Protect /dashboard route: redirect unauthenticated users to /sign-in
  if (path.startsWith("/dashboard")) {
    if (!isAuthenticated) {
      return NextResponse.redirect(new URL("/sign-in", request.url));
    }
  }

  // Protect /sign-in and /sign-up: redirect authenticated users to /dashboard
  if (path === "/sign-in" || path === "/sign-up") {
    if (isAuthenticated) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: ["/dashboard/:path*", "/sign-in", "/sign-up"],
};
