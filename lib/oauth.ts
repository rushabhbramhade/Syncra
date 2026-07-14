export function getCanonicalOrigin(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "");
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  if (process.env.NEXT_PUBLIC_VERCEL_URL) {
    return `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`;
  }
  return "http://localhost:3000";
}

export function getRedirectUri(): string {
  if (process.env.OAUTH_REDIRECT_URI) {
    return process.env.OAUTH_REDIRECT_URI;
  }
  const base = getCanonicalOrigin();
  return `${base}/api/gmail-callback`;
}

export function getGoogleConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  return { clientId, clientSecret };
}

export function validateOAuthConfig(): string[] {
  const errors: string[] = [];
  if (!process.env.GOOGLE_CLIENT_ID) errors.push("GOOGLE_CLIENT_ID");
  if (!process.env.GOOGLE_CLIENT_SECRET) errors.push("GOOGLE_CLIENT_SECRET");
  if (!process.env.NEXT_PUBLIC_APP_URL && !process.env.VERCEL_URL) {
    errors.push("NEXT_PUBLIC_APP_URL (or VERCEL_URL)");
  }
  if (process.env.OAUTH_REDIRECT_URI && !process.env.OAUTH_REDIRECT_URI.startsWith("https://") && !process.env.OAUTH_REDIRECT_URI.startsWith("http://localhost")) {
    errors.push("OAUTH_REDIRECT_URI must be a valid https URL (or http://localhost for development)");
  }
  return errors;
}

export function getHmacSecret(): string {
  const secret = process.env.OAUTH_STATE_SECRET || process.env.TOKEN_ENCRYPTION_KEY;
  if (!secret) {
    throw new Error(
      "OAUTH_STATE_SECRET or TOKEN_ENCRYPTION_KEY must be set for OAuth state signing. " +
      "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
    );
  }
  return secret;
}
