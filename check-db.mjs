import pg from 'pg';

process.loadEnvFile(".env.local");

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL must be set in .env.local");
  process.exit(1);
}

async function main() {
  const client = new pg.Client({ connectionString });
  await client.connect();
  console.log("Connected to database successfully.");

  // Check system.custom_migrations columns
  const columnsRes = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'custom_migrations' AND table_schema = 'system'
  `);
  console.log("system.custom_migrations columns:");
  columnsRes.rows.forEach(r => console.log(`- ${r.column_name}: ${r.data_type}`));

  // Check what migrations are currently marked as applied
  const appliedRes = await client.query(`
    SELECT version, name, run_on FROM system.custom_migrations ORDER BY version ASC
  `);
  console.log("Applied Migrations:");
  appliedRes.rows.forEach(r => console.log(`- ${r.version}: ${r.name} (${r.run_on})`));

  await client.end();
}
main().catch(console.error);
