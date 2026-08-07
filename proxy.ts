import { NextResponse, type NextRequest } from "next/server";
import { updateSession, type CookieStore } from "@insforge/sdk/ssr/middleware";

function redirectWithSessionCookies(url: URL, response: NextResponse) {
  const redirect = NextResponse.redirect(url);
  response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isProtectedRoute = pathname === "/dashboard" || pathname.startsWith("/dashboard/") || pathname === "/app" || pathname.startsWith("/app/");
  const isAuthRoute = pathname === "/sign-in" || pathname === "/sign-up";

  const response = NextResponse.next({ request });

  let accessToken: string | undefined;
  try {
    const session = await updateSession({
      // Next 16's RequestCookies.set/delete are typed narrower than the SDK's
      // CookieStore but accept the same calls at runtime; Set-Cookie headers flow via responseCookies.
      requestCookies: request.cookies as unknown as CookieStore,
      responseCookies: response.cookies,
      baseUrl: process.env.NEXT_PUBLIC_INSFORGE_BASE_URL,
      anonKey: process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY,
    });
    accessToken = session.accessToken ?? undefined;
  } catch (err) {
    // Missing/misconfigured env must not 500 every protected route.
    console.error("proxy: updateSession failed, treating as unauthenticated", err);
  }

  if (!accessToken && isProtectedRoute) {
    const signInUrl = new URL("/sign-in", request.url);
    signInUrl.searchParams.set("redirect", `${pathname}${search}`);
    return redirectWithSessionCookies(signInUrl, response);
  }

  if (accessToken && isAuthRoute) {
    return redirectWithSessionCookies(new URL("/dashboard", request.url), response);
  }

  return response;
}

export const config = {
  matcher: ["/dashboard/:path*", "/app/:path*", "/sign-in", "/sign-up"],
};
