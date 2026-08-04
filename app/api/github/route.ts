import { NextRequest, NextResponse } from "next/server";
import { getCanonicalOrigin } from "@/lib/oauth";
import { signState } from "@/lib/oauth-state";
import { getAuthenticatedUser } from "@/lib/auth-guard";

export async function GET(request: NextRequest) {
  try {
    const session = await getAuthenticatedUser();
    if ("error" in session) {
      return new NextResponse("Unauthorized.", { status: 401 });
    }
    const userId = session.user.id;

    if (!process.env.GITHUB_CLIENT_ID || !process.env.GITHUB_CLIENT_SECRET) {
      return NextResponse.redirect(new URL("/dashboard/integrations?error=missing_credentials", request.url));
    }

    const base = getCanonicalOrigin();
    const redirectUri = `${base}/api/github-callback`;
    const signedState = signState(userId, redirectUri);

    const params = new URLSearchParams({
      client_id: process.env.GITHUB_CLIENT_ID,
      redirect_uri: redirectUri,
      state: signedState,
      scope: "public_repo read:user notifications",
    });

    return NextResponse.redirect(`https://github.com/login/oauth/authorize?${params.toString()}`);
  } catch (err: unknown) {
    const errorObj = err as { message?: string };
    console.error("[GitHubOAuth] initiation error:", err);
    return new NextResponse(`Error initiating GitHub authentication: ${errorObj.message || ""}`, { status: 500 });
  }
}
