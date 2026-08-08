import pg from 'pg';
process.loadEnvFile("/Users/rushabhbramhade/Projects/Syncar/Syncra/.env.local");
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
const q = async (label, sql) => {
  try {
    const r = await client.query(sql);
    console.log(`\n=== ${label} ===`);
    console.dir(r.rows, { depth: 4 });
  } catch (e) { console.log(`\n=== ${label} ERROR: ${e.message}`); }
};
await q("users", `SELECT id, auth_user_id, email FROM users LIMIT 5`);
await q("user_integrations", `SELECT user_id, provider, status, sync_status, email, scopes, last_sync_at, created_at, last_error FROM user_integrations ORDER BY provider`);
await q("integration_sync_logs latest", `SELECT user_id, provider, status, message, duration_ms, created_at FROM integration_sync_logs ORDER BY created_at DESC LIMIT 30`);
await client.end();
