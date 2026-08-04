import { createAdminClient } from "@insforge/sdk";

process.loadEnvFile(".env.local");

const baseUrl = process.env.NEXT_PUBLIC_INSFORGE_BASE_URL;
const apiKey = process.env.INSFORGE_API_KEY;
if (!baseUrl || !apiKey) {
  console.error("NEXT_PUBLIC_INSFORGE_BASE_URL and INSFORGE_API_KEY must be set in .env.local");
  process.exit(1);
}

const db = createAdminClient({
  baseUrl,
  apiKey,
  timeout: 10000,
});

const uid = "b81aafe4-e5a5-4299-ad1d-05bbccb895c5";

const { data: briefs } = await db.database
  .from("briefings")
  .select("id, user_id, generated_at")
  .eq("user_id", uid)
  .order("generated_at", { ascending: false })
  .limit(1);

if (!briefs?.length) {
  console.log("NO BRIEFINGS - Click Generate Now");
  process.exit(0);
}

const b = briefs[0];
const { data: items } = await db.database
  .from("briefing_items")
  .select("id, platform, category")
  .eq("briefing_id", b.id)
  .limit(10);

console.log(`Briefing: ${b.id?.substring(0, 8)} at ${b.generated_at}`);
console.log(`Items: ${items?.length || 0}`);

if (items?.length) {
  for (const i of items) {
    console.log(`  platform=${i.platform} category=${i.category}`);
  }
}
