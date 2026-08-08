import pg from 'pg';
process.loadEnvFile("/Users/rushabhbramhade/Projects/Syncar/Syncra/.env.local");
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
const q = async (label, sql) => {
  try {
    const r = await client.query(sql);
    console.log(`\n=== ${label} (rows=${r.rowCount}) ===`);
    console.dir(r.rows, { depth: 5 });
  } catch (e) { console.log(`\n=== ${label} ERROR: ${e.message}`); }
};
await q("user a741acd5", `SELECT id, auth_user_id, email FROM users WHERE id='a741acd5-eeb0-4042-bed8-f6acb65f78f5'`);
await q("user a741acd5 integrations", `SELECT user_id, provider, status, sync_status, email, last_sync_at, created_at, last_error, scopes FROM user_integrations WHERE user_id='a741acd5-eeb0-4042-bed8-f6acb65f78f5' OR user_id=(SELECT auth_user_id FROM users WHERE id='a741acd5-eeb0-4042-bed8-f6acb65f78f5')`);
await q("user a741acd5 sync logs", `SELECT provider, status, message, created_at FROM integration_sync_logs WHERE user_id='a741acd5-eeb0-4042-bed8-f6acb65f78f5' OR user_id=(SELECT auth_user_id FROM users WHERE id='a741acd5-eeb0-4042-bed8-f6acb65f78f5') ORDER BY created_at DESC LIMIT 25`);
await q("briefing history", `SELECT id, user_id, schedule_id, status, errors, trigger_source, execution_time FROM briefing_history WHERE user_id='a741acd5-eeb0-4042-bed8-f6acb65f78f5' ORDER BY execution_time DESC LIMIT 12`);
await q("schedules", `SELECT id, user_id, name, frequency, enabled, integrations, next_run, last_run FROM briefing_schedules WHERE user_id='a741acd5-eeb0-4042-bed8-f6acb65f78f5'`);
await client.end();
