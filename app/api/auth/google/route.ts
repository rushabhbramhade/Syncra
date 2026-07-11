import { NextRequest, NextResponse } from "next/server";
import { IntegrationRegistry } from "@/lib/integrations";
import * as crypto from "crypto";

function signState(userId: string): string {
  const secret = process.env.INSFORGE_API_KEY || process.env.ENCRYPTION_KEY || "syncra-fallback-hmac-secret-key";
  const hmac = crypto.createHmac("sha256", secret).update(userId).digest("hex");
  return `${userId}.${hmac}`;
}

export function verifyState(state: string): string | null {
  const secret = process.env.INSFORGE_API_KEY || process.env.ENCRYPTION_KEY || "syncra-fallback-hmac-secret-key";
  const dotIndex = state.lastIndexOf(".");
  if (dotIndex === -1) return null;
  const userId = state.substring(0, dotIndex);
  const signature = state.substring(dotIndex + 1);
  const expected = crypto.createHmac("sha256", secret).update(userId).digest("hex");
  
  try {
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
      return null;
    }
  } catch {
    return null;
  }
  return userId;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    // Authenticated user ID is passed from the client-side component where they are logged in
    if (!userId) {
      return new NextResponse("Unauthorized. Missing userId parameter.", { status: 401 });
    }

    const provider = IntegrationRegistry.get("gmail");
    if (!provider) {
      return new NextResponse("Gmail provider not configured or registered.", { status: 500 });
    }

    const isIdSet = !!process.env.GOOGLE_CLIENT_ID;
    const isSecretSet = !!process.env.GOOGLE_CLIENT_SECRET;
    if (!isIdSet || !isSecretSet) {
      return NextResponse.redirect(new URL("/dashboard/integrations?error=missing_credentials", request.url));
    }

    const origin = new URL(request.url).origin;
    
    // Sign the userId with HMAC to prevent tampering during OAuth roundtrip
    const signedState = signState(userId);
    const authUrl = provider.getAuthUrl(origin, signedState);

    return NextResponse.redirect(authUrl);
  } catch (err: unknown) {
    const errorObj = err as { message?: string };
    console.error("Google auth initiation error:", err);
    return new NextResponse(`Error initiating authentication: ${errorObj.message || ""}`, { status: 500 });
  }
}
