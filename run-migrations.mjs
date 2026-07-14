import pg from 'pg';
import fs from 'fs';
import path from 'path';

const connectionString = "postgresql://postgres:285554db63178390c9b959f6728a85ab@b7fawddm.ap-southeast.database.insforge.app:5432/insforge?sslmode=require";
const migrationsDir = './migrations';

async function main() {
  const client = new pg.Client({ connectionString });
  await client.connect();
  console.log("Connected to database via TCP.");

  // Get applied migrations
  const appliedRes = await client.query("SELECT version FROM system.custom_migrations");
  const appliedVersions = new Set(appliedRes.rows.map(r => r.version));
  console.log("Already applied migrations:", Array.from(appliedVersions));

  // Read local migration files
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort(); // Sort so they execute in chronological order

  for (const file of files) {
    // Parse version and name
    const match = file.match(/^(\d+)_(.+)\.sql$/);
    if (!match) {
      console.warn(`Skipping invalid migration file name: ${file}`);
      continue;
    }

    const [_, version, name] = match;
    if (appliedVersions.has(version)) {
      console.log(`Migration ${version} (${name}) already applied. Skipping.`);
      continue;
    }

    console.log(`Applying migration ${version} (${name})...`);
    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, 'utf8');

    // Start transaction
    await client.query('BEGIN');
    try {
      // Execute the migration SQL
      await client.query(sql);

      // Record in custom_migrations
      await client.query(
        "INSERT INTO system.custom_migrations (version, name, statements, created_at) VALUES ($1, $2, $3, NOW())",
        [version, name, [sql]]
      );

      await client.query('COMMIT');
      console.log(`Migration ${version} applied successfully.`);
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`Error applying migration ${file}:`, err);
      throw err;
    }
  }

  await client.end();
  console.log("All migrations checked and executed.");
}

main().catch(err => {
  console.error("Migration execution failed:", err);
  process.exit(1);
});
