import pg from 'pg';
process.loadEnvFile("/Users/rushabhbramhade/Projects/Syncar/Syncra/.env.local");
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
const q = async (label, sql) => {
  try { const r = await client.query(sql); console.log(`\n=== ${label} (rows=${r.rowCount}) ===`); console.dir(r.rows, { depth: 4 }); }
  catch (e) { console.log(`\n=== ${label} ERROR: ${e.message}`); }
};
await q("unified counts by integration+user", `SELECT m.integration_id, u.provider, u.user_id, count(*) AS n, min(m.sent_at) AS oldest, max(m.sent_at) AS newest FROM unified_messages m JOIN user_integrations u ON u.id=m.integration_id GROUP BY 1,2,3 ORDER BY 4 DESC`);
await q("unified_messages what was persisted", `SELECT m.integration_id, m.provider_message_id, left(m.body_text,60) AS body, m.sent_at FROM unified_messages m ORDER BY m.sent_at DESC LIMIT 25`);
await q("sessions", `SELECT user_id, char_length(session_data::text) AS len, updated_at FROM whatsapp_sessions`);
await client.end();
