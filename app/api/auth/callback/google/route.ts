import { NextRequest, NextResponse } from "next/server";
import { IntegrationRegistry } from "@/lib/integrations";
import { saveConnection } from "@/app/actions/integrations";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const errorParam = searchParams.get("error");
    const state = searchParams.get("state"); // Google returns the state parameter containing the userId

    if (errorParam) {
      return NextResponse.redirect(new URL(`/dashboard/integrations?error=${encodeURIComponent(errorParam)}`, request.url));
    }

    if (!code) {
      return NextResponse.redirect(new URL("/dashboard/integrations?error=missing_code", request.url));
    }

    // Verify the HMAC-signed state parameter to prevent forged OAuth flows
    if (!state) {
      return NextResponse.redirect(new URL("/dashboard/integrations?error=missing_session_state", request.url));
    }

    const { verifyState } = await import("@/app/api/auth/google/route");
    const userId = verifyState(state);
    if (!userId) {
      return NextResponse.redirect(new URL("/dashboard/integrations?error=invalid_oauth_state", request.url));
    }
    const origin = new URL(request.url).origin;

    const provider = IntegrationRegistry.get("gmail");
    if (!provider) {
      throw new Error("Gmail provider adapter is not registered.");
    }

    // 2. Exchange authorization code for access and refresh tokens
    const tokens = await provider.exchangeCode(code, origin);

    // 3. Fetch user's profile to retrieve their real email address
    const profile = await provider.getProfile(tokens.accessToken);
    const email = profile.email;

    if (!email) {
      throw new Error("Unable to retrieve email address from Google Profile.");
    }

    // 4. Save connection tokens securely (will encrypt and save in db)
    await saveConnection(
      userId,
      "gmail",
      email,
      tokens.accessToken,
      tokens.refreshToken,
      tokens.expiresIn,
      provider.scopes.join(" ")
    );

    // 5. Redirect back to integrations page with success parameter
    return NextResponse.redirect(new URL("/dashboard/integrations?success=gmail", request.url));
  } catch (err: unknown) {
    const errorObj = err as { message?: string };
    console.error("Google OAuth callback error:", err);
    const msg = errorObj.message || "OAuth authentication failed.";
    return NextResponse.redirect(new URL(`/dashboard/integrations?error=${encodeURIComponent(msg)}`, request.url));
  }
}
