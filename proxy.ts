import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@insforge/sdk/ssr/middleware";

export async function proxy(request: NextRequest) {
  const response = NextResponse.next({ request });

  // Update/refresh session if needed
  if (request.cookies.has("insforge_refresh_token")) {
    await updateSession({
      requestCookies: request.cookies as unknown as Parameters<typeof updateSession>[0]["requestCookies"],
      responseCookies: response.cookies as unknown as Parameters<typeof updateSession>[0]["responseCookies"],
      baseUrl: process.env.NEXT_PUBLIC_INSFORGE_BASE_URL,
      anonKey: process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY,
    });
  }

  // Check if we have an access token in request or response cookies
  const accessToken =
    request.cookies.get("insforge_access_token")?.value ||
    response.cookies.get("insforge_access_token")?.value;
  const isAuthenticated = !!accessToken;

  const path = request.nextUrl.pathname;

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
