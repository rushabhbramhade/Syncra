import { NextRequest, NextResponse } from "next/server";
import { IntegrationRegistry } from "@/lib/integrations";
import { saveConnection } from "@/app/actions/integrations";
import { verifyState, consumeState } from "@/lib/oauth-state";
import { getRedirectUri } from "@/lib/oauth";

const OAUTH_LOG_PREFIX = "[GmailCallback]";

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  redirect_uri_mismatch:
    "Google rejected the request: the callback URL does not match what is registered in Google Cloud Console. " +
    "Add the following redirect URI to your Google Cloud Console: ",
  access_denied: "You denied the authorization request.",
  invalid_client: "Google OAuth client configuration is invalid. Check GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.",
  invalid_scope: "The requested permissions are invalid or have been removed.",
  invalid_grant: "The authorization code has expired or was already used. Please try again.",
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const errorParam = searchParams.get("error");
    const state = searchParams.get("state");

    console.log(`${OAUTH_LOG_PREFIX} received redirect with:`, {
      hasCode: !!code,
      error: errorParam,
      hasState: !!state,
    });

    if (errorParam) {
      const friendly = OAUTH_ERROR_MESSAGES[errorParam];
      const msg = friendly
        ? `${friendly}${getRedirectUri()}`
        : `Google returned error: ${errorParam}`;
      console.error(`${OAUTH_LOG_PREFIX} error:`, msg);
      return NextResponse.redirect(
        new URL(`/dashboard/integrations?error=${encodeURIComponent(msg)}`, request.url)
      );
    }

    if (!code) {
      return NextResponse.redirect(
        new URL("/dashboard/integrations?error=missing_code", request.url)
      );
    }

    if (!state) {
      return NextResponse.redirect(
        new URL("/dashboard/integrations?error=missing_session_state", request.url)
      );
    }

    const expectedRedirectUri = getRedirectUri();
    const userId = verifyState(state, expectedRedirectUri);
    if (!userId) {
      console.error(`${OAUTH_LOG_PREFIX} state verification failed`);
      return NextResponse.redirect(
        new URL("/dashboard/integrations?error=invalid_oauth_state", request.url)
      );
    }

    console.log(`${OAUTH_LOG_PREFIX} state verified for userId=${userId}`);

    if (!consumeState(state)) {
      console.error(`${OAUTH_LOG_PREFIX} state already consumed (replay attack detected)`);
      return NextResponse.redirect(
        new URL("/dashboard/integrations?error=oauth_state_reused", request.url)
      );
    }

    const provider = IntegrationRegistry.get("gmail");
    if (!provider) {
      throw new Error("Gmail provider adapter is not registered.");
    }

    const tokens = await provider.exchangeCode(code, "");
    console.log(`${OAUTH_LOG_PREFIX} token exchange successful:`, {
      hasAccessToken: !!tokens.accessToken,
      hasRefreshToken: !!tokens.refreshToken,
      expiresIn: tokens.expiresIn,
    });

    const profile = await provider.getProfile(tokens.accessToken);
    const email = profile.email;

    if (!email) {
      throw new Error("Unable to retrieve email address from Google Profile.");
    }

    await saveConnection(
      userId,
      "gmail",
      email,
      tokens.accessToken,
      tokens.refreshToken,
      tokens.expiresIn,
      provider.scopes.join(" ")
    );

    console.log(`${OAUTH_LOG_PREFIX} connection saved for email=${email}`);

    return NextResponse.redirect(
      new URL("/dashboard/integrations?success=gmail", request.url)
    );
  } catch (err: unknown) {
    const errorObj = err as { message?: string };
    console.error(`${OAUTH_LOG_PREFIX} fatal error:`, err);
    let msg = errorObj.message || "OAuth authentication failed.";
    if (msg.includes("redirect_uri_mismatch")) {
      msg = `redirect_uri_mismatch: add "${getRedirectUri()}" to Google Cloud Console > Authorized Redirect URIs.`;
    }
    return NextResponse.redirect(
      new URL(`/dashboard/integrations?error=${encodeURIComponent(msg)}`, request.url)
    );
  }
}
