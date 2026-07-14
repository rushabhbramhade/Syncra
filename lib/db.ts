import { createAdminClient } from "@insforge/sdk";

export function createAdminDb() {
  const baseUrl = process.env.NEXT_PUBLIC_INSFORGE_BASE_URL;
  const apiKey = process.env.INSFORGE_API_KEY;

  if (!baseUrl || !apiKey) {
    throw new Error("Missing InsForge configuration: NEXT_PUBLIC_INSFORGE_BASE_URL and INSFORGE_API_KEY must be set.");
  }

  return createAdminClient({ baseUrl, apiKey });
}
