import { NextRequest, NextResponse } from "next/server";
import { IntegrationRegistry } from "@/lib/integrations";
import { getRedirectUri } from "@/lib/oauth";
import { signState } from "@/lib/oauth-state";
import { getAuthenticatedUser } from "@/lib/auth-guard";

const OAUTH_LOG_PREFIX = "[GmailOAuth]";

export async function GET(request: NextRequest) {
  try {
    const session = await getAuthenticatedUser();
    if ("error" in session) {
      return new NextResponse("Unauthorized.", { status: 401 });
    }
    const userId = session.user.id;

    const provider = IntegrationRegistry.get("gmail");
    if (!provider) {
      return new NextResponse("Gmail provider not configured or registered.", { status: 500 });
    }

    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      return NextResponse.redirect(new URL("/dashboard/integrations?error=missing_credentials", request.url));
    }

    console.log(`${OAUTH_LOG_PREFIX} initiating for userId=${userId}, redirect_uri=${getRedirectUri()}`);

    const redirectUri = getRedirectUri();
    const signedState = signState(userId, redirectUri);
    const authUrl = provider.getAuthUrl("", signedState);

    return NextResponse.redirect(authUrl);
  } catch (err: unknown) {
    const errorObj = err as { message?: string };
    console.error(`${OAUTH_LOG_PREFIX} initiation error:`, err);
    return new NextResponse(`Error initiating authentication: ${errorObj.message || ""}`, { status: 500 });
  }
}
