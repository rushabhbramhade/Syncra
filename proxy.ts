import { NextResponse, type NextRequest } from "next/server";
import { updateSession, type CookieStore } from "@insforge/sdk/ssr/middleware";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

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

  if (!accessToken) {
    const signInUrl = new URL("/sign-in", request.url);
    signInUrl.searchParams.set("redirect", pathname);
    const redirect = NextResponse.redirect(signInUrl);
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  }

  return response;
}

export const config = {
  matcher: ["/dashboard/:path*", "/app/:path*"],
};
