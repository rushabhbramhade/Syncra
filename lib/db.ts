import { createAdminClient } from "@insforge/sdk";

export function createAdminDb(opts?: { timeout?: number }) {
  const baseUrl = process.env.NEXT_PUBLIC_INSFORGE_BASE_URL;
  const apiKey = process.env.INSFORGE_API_KEY;

  if (!baseUrl || !apiKey) {
    if (process.env.NODE_ENV !== "production") {
      return {
        database: {
          from: () => {
            throw new Error("InsForge not configured - set NEXT_PUBLIC_INSFORGE_BASE_URL and INSFORGE_API_KEY");
          },
        },
      } as unknown as ReturnType<typeof createAdminClient>;
    }
    throw new Error("Missing InsForge configuration: NEXT_PUBLIC_INSFORGE_BASE_URL and INSFORGE_API_KEY must be set.");
  }

  return createAdminClient({ baseUrl, apiKey, timeout: opts?.timeout ?? 10000 });
}
