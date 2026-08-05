import { NextRequest, NextResponse } from "next/server";
import { saveConnection } from "@/app/actions/integrations";
import { verifyStateFull } from "@/lib/oauth-state";
import { getCanonicalOrigin } from "@/lib/oauth";
import { LinkedInService } from "@/lib/linkedin/linkedin-service";

const OAUTH_LOG_PREFIX = "[LinkedInCallback]";

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  access_denied: "You denied the LinkedIn authorization request.",
  invalid_client: "LinkedIn OAuth client configuration is invalid. Check LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET.",
  invalid_scope: "The requested LinkedIn permissions are invalid or have been removed.",
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
      const msg = friendly || `LinkedIn returned error: ${errorParam}`;
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

    const base = getCanonicalOrigin();
    const expectedRedirectUri = `${base}/api/linkedin-callback`;
    const verified = verifyStateFull(state, expectedRedirectUri);
    if (!verified) {
      console.error(`${OAUTH_LOG_PREFIX} state verification failed`);
      return NextResponse.redirect(
        new URL("/dashboard/integrations?error=invalid_oauth_state", request.url)
      );
    }

    const { userId } = verified;
    console.log(`${OAUTH_LOG_PREFIX} state verified for userId=${userId}`);

    const clientId = process.env.LINKEDIN_CLIENT_ID;
    const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      throw new Error("LINKEDIN_CLIENT_ID or LINKEDIN_CLIENT_SECRET not configured.");
    }

    const tokens = await LinkedInService.exchangeCode(code, clientId, clientSecret, expectedRedirectUri);

    const profile = await LinkedInService.getProfile(tokens.accessToken);

    console.log(`${OAUTH_LOG_PREFIX} token exchange successful for ${profile.email}`);

    await saveConnection(
      userId,
      "linkedin",
      profile.email || `${profile.sub}@linkedin.com`,
      tokens.accessToken,
      tokens.refreshToken,
      tokens.expiresIn,
      tokens.scope
    );

    console.log(`${OAUTH_LOG_PREFIX} connection saved for userId=${userId}`);

    return NextResponse.redirect(
      new URL("/dashboard/integrations?success=linkedin", request.url)
    );
  } catch (err: unknown) {
    const errorObj = err as { message?: string };
    console.error(`${OAUTH_LOG_PREFIX} fatal error:`, err);
    return NextResponse.redirect(
      new URL(`/dashboard/integrations?error=${encodeURIComponent(errorObj.message || "LinkedIn OAuth failed.")}`, request.url)
    );
  }
}
