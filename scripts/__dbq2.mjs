import pg from 'pg';
process.loadEnvFile("/Users/rushabhbramhade/Projects/Syncar/Syncra/.env.local");
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
const q = async (label, sql) => {
  try {
    const r = await client.query(sql);
    console.log(`\n=== ${label} (rows=${r.rowCount}) ===`);
    console.dir(r.rows, { depth: 4 });
  } catch (e) { console.log(`\n=== ${label} ERROR: ${e.message}`); }
};
await q("briefings", `SELECT id, user_id, title, priority_score, status, generated_at, provider_health FROM briefings ORDER BY generated_at DESC LIMIT 6`);
await q("briefing items", `SELECT b.title, i.platform, i.category, i.priority, i.status, i.source_id, i.timestamp, i.metadata->>'title' AS item_title FROM briefing_items i JOIN briefings b ON b.id=i.briefing_id ORDER BY i.created_at DESC LIMIT 40`);
await q("unified_messages count by integration", `SELECT integration_id, count(*) FROM unified_messages GROUP BY integration_id LIMIT 20`);
await q("unified_messages sample", `SELECT user_id, integration_id, provider_message_id, channel_id, body_text, sent_at, direction FROM unified_messages ORDER BY sent_at DESC LIMIT 20`);
await client.end();
