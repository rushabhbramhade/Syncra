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

    if (!process.env.LINKEDIN_CLIENT_ID || !process.env.LINKEDIN_CLIENT_SECRET) {
      return NextResponse.redirect(new URL("/dashboard/integrations?error=missing_credentials", request.url));
    }

    const base = getCanonicalOrigin();
    const redirectUri = `${base}/api/linkedin-callback`;
    const signedState = signState(userId, redirectUri);

    const params = new URLSearchParams({
      response_type: "code",
      client_id: process.env.LINKEDIN_CLIENT_ID,
      redirect_uri: redirectUri,
      state: signedState,
      scope: "openid profile email w_member_social",
    });

    return NextResponse.redirect(`https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`);
  } catch (err: unknown) {
    const errorObj = err as { message?: string };
    console.error("[LinkedInOAuth] initiation error:", err);
    return new NextResponse(`Error initiating LinkedIn authentication: ${errorObj.message || ""}`, { status: 500 });
  }
}
