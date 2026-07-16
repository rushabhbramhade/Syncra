import { NextRequest, NextResponse } from "next/server";
import { saveConnection } from "@/app/actions/integrations";
import { verifyStateFull, consumeState } from "@/lib/oauth-state";
import { getCanonicalOrigin } from "@/lib/oauth";
import { SlackApiService } from "@/lib/integrations/slack-provider";

const OAUTH_LOG_PREFIX = "[SlackCallback]";

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  access_denied: "You denied the Slack authorization request.",
  invalid_client: "Slack OAuth client configuration is invalid. Check SLACK_CLIENT_ID and SLACK_CLIENT_SECRET.",
  invalid_scope: "The requested Slack permissions are invalid or have been removed.",
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
      const msg = friendly || `Slack returned error: ${errorParam}`;
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
    const expectedRedirectUri = `${base}/api/slack-callback`;
    const verified = verifyStateFull(state, expectedRedirectUri);
    if (!verified) {
      console.error(`${OAUTH_LOG_PREFIX} state verification failed`);
      return NextResponse.redirect(
        new URL("/dashboard/integrations?error=invalid_oauth_state", request.url)
      );
    }

    if (!consumeState(state)) {
      console.error(`${OAUTH_LOG_PREFIX} state already consumed (replay attack detected)`);
      return NextResponse.redirect(
        new URL("/dashboard/integrations?error=oauth_state_reused", request.url)
      );
    }

    const { userId, codeVerifier } = verified;
    console.log(`${OAUTH_LOG_PREFIX} state verified for userId=${userId}${codeVerifier ? ' (PKCE)' : ''}`);

    const clientId = process.env.SLACK_CLIENT_ID;
    const clientSecret = process.env.SLACK_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      throw new Error("SLACK_CLIENT_ID or SLACK_CLIENT_SECRET not configured.");
    }

    const tokens = await SlackApiService.exchangeCode(code, clientId, clientSecret, expectedRedirectUri, codeVerifier);
    console.log(`${OAUTH_LOG_PREFIX} token exchange successful`);

    await saveConnection(
      userId,
      "slack",
      tokens.authedUserId || tokens.botUserId || "slack-user",
      tokens.accessToken,
      undefined,
      86400 * 365,
      "channels:read,channels:history,chat:write,users:read,team:read,im:read,mpim:read,groups:read"
    );

    console.log(`${OAUTH_LOG_PREFIX} connection saved for userId=${userId}`);

    return NextResponse.redirect(
      new URL("/dashboard/integrations?success=slack", request.url)
    );
  } catch (err: unknown) {
    const errorObj = err as { message?: string };
    console.error(`${OAUTH_LOG_PREFIX} fatal error:`, err);
    return NextResponse.redirect(
      new URL(`/dashboard/integrations?error=${encodeURIComponent(errorObj.message || "Slack OAuth failed.")}`, request.url)
    );
  }
}
