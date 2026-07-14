import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAuthActions } from "@insforge/sdk/ssr";
import { syncUserToDatabase } from "@/app/actions";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("insforge_code");
    const errorParam = searchParams.get("insforge_error");

    if (errorParam) {
      return NextResponse.redirect(new URL(`/sign-in?error=${encodeURIComponent(errorParam)}`, request.url));
    }

    if (!code) {
      return NextResponse.redirect(new URL("/sign-in?error=missing_code", request.url));
    }

    const cookieStore = await cookies();
    const codeVerifier = cookieStore.get("insforge_code_verifier")?.value;

    if (!codeVerifier) {
      return NextResponse.redirect(new URL("/sign-in?error=missing_code_verifier", request.url));
    }

    const auth = createAuthActions({
      baseUrl: process.env.NEXT_PUBLIC_INSFORGE_BASE_URL,
      anonKey: process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY,
      cookies: cookieStore,
    });

    const { data, error } = await auth.exchangeOAuthCode(code, codeVerifier);

    if (error || !data?.user) {
      return NextResponse.redirect(
        new URL(`/sign-in?error=${encodeURIComponent(error?.message || "OAuth exchange failed")}`, request.url)
      );
    }

    try {
      await syncUserToDatabase({
        auth_user_id: data.user.id,
        email: data.user.email,
        full_name: (data.user.profile as { name?: string } | null)?.name || "New User",
        avatar_url: null,
        auth_provider: "google",
        email_verified: data.user.emailVerified,
      });
    } catch (syncError) {
      console.error("Failed to sync OAuth user to DB:", syncError);
      cookieStore.delete("insforge_code_verifier");
      return NextResponse.redirect(
        new URL("/sign-in?error=account_sync_failed", request.url)
      );
    }

    cookieStore.delete("insforge_code_verifier");

    return NextResponse.redirect(new URL("/dashboard", request.url));
  } catch (err: unknown) {
    const errorObj = err as { message?: string };
    console.error("OAuth callback error:", err);
    return NextResponse.redirect(
      new URL(`/sign-in?error=${encodeURIComponent(errorObj.message || "Internal server error")}`, request.url)
    );
  }
}
