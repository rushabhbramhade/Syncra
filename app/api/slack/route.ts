import { NextRequest, NextResponse } from "next/server";
import { getCanonicalOrigin } from "@/lib/oauth";
import { signState } from "@/lib/oauth-state";
import { SlackApiService } from "@/lib/integrations/slack-provider";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return new NextResponse("Unauthorized. Missing userId parameter.", { status: 401 });
    }

    if (!process.env.SLACK_CLIENT_ID || !process.env.SLACK_CLIENT_SECRET) {
      return NextResponse.redirect(new URL("/dashboard/integrations?error=missing_credentials", request.url));
    }

    const base = getCanonicalOrigin();
    const redirectUri = `${base}/api/slack-callback`;

    console.log("[SlackOAuth] initiating with:", {
      base,
      redirectUri,
      clientId: process.env.SLACK_CLIENT_ID?.slice(0, 10) + "...",
    });

    const codeVerifier = SlackApiService.generateCodeVerifier();
    const codeChallenge = SlackApiService.computeCodeChallenge(codeVerifier);

    const signedState = signState(userId, redirectUri, codeVerifier);

    const authUrl = SlackApiService.getAuthUrl(
      process.env.SLACK_CLIENT_ID,
      redirectUri,
      signedState,
      codeChallenge
    );

    console.log("[SlackOAuth] redirect URL (first 200 chars):", authUrl.slice(0, 200) + "...");

    return NextResponse.redirect(authUrl);
  } catch (err: unknown) {
    const errorObj = err as { message?: string };
    console.error("[SlackOAuth] initiation error:", err);
    return new NextResponse(`Error initiating Slack authentication: ${errorObj.message || ""}`, { status: 500 });
  }
}
