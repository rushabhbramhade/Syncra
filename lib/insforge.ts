import { createBrowserClient } from "@insforge/sdk/ssr";

const baseUrl = process.env.NEXT_PUBLIC_INSFORGE_BASE_URL;
const anonKey = process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY;

if (!baseUrl) {
  throw new Error("NEXT_PUBLIC_INSFORGE_BASE_URL is not defined in environment variables.");
}

if (!anonKey) {
  throw new Error("NEXT_PUBLIC_INSFORGE_ANON_KEY is not defined in environment variables.");
}

export const insforge = createBrowserClient({
  baseUrl,
  anonKey,
});

