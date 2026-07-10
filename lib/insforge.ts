import { createClient } from "@insforge/sdk";

const baseUrl = process.env.NEXT_PUBLIC_INSFORGE_BASE_URL;
const anonKey = process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY;

if (!baseUrl) {
  throw new Error("NEXT_PUBLIC_INSFORGE_BASE_URL is not defined in environment variables.");
}

export const insforge = createClient({
  baseUrl,
  anonKey,
});
