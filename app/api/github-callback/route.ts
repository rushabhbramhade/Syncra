import { NextRequest, NextResponse } from "next/server";
import { saveConnection } from "@/app/actions/integrations";
import { verifyStateFull } from "@/lib/oauth-state";
import { getCanonicalOrigin } from "@/lib/oauth";
import { GitHubService } from "@/lib/github/github-service";

const OAUTH_LOG_PREFIX = "[GitHubCallback]";

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  access_denied: "You denied the GitHub authorization request.",
  redirect_uri_mismatch: "The redirect URI does not match the registered callback URL.",
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
      const msg = friendly || `GitHub returned error: ${errorParam}`;
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
    const expectedRedirectUri = `${base}/api/github-callback`;
    const verified = verifyStateFull(state, expectedRedirectUri);
    if (!verified) {
      console.error(`${OAUTH_LOG_PREFIX} state verification failed`);
      return NextResponse.redirect(
        new URL("/dashboard/integrations?error=invalid_oauth_state", request.url)
      );
    }

    const { userId } = verified;
    console.log(`${OAUTH_LOG_PREFIX} state verified for userId=${userId}`);

    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      throw new Error("GITHUB_CLIENT_ID or GITHUB_CLIENT_SECRET not configured.");
    }

    const tokens = await GitHubService.exchangeCode(code, clientId, clientSecret);

    const profile = await GitHubService.getProfile(tokens.accessToken);

    console.log(`${OAUTH_LOG_PREFIX} token exchange successful for ${profile.login}`);

    await saveConnection(
      userId,
      "github",
      (profile.email as string) || (profile.login as string),
      tokens.accessToken,
      undefined,
      86400 * 365,
      tokens.scope
    );

    console.log(`${OAUTH_LOG_PREFIX} connection saved for userId=${userId}`);

    return NextResponse.redirect(
      new URL("/dashboard/integrations?success=github", request.url)
    );
  } catch (err: unknown) {
    const errorObj = err as { message?: string };
    console.error(`${OAUTH_LOG_PREFIX} fatal error:`, err);
    return NextResponse.redirect(
      new URL(`/dashboard/integrations?error=${encodeURIComponent(errorObj.message || "GitHub OAuth failed.")}`, request.url)
    );
  }
}
