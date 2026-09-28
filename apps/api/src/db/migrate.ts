import fs from "fs";
import path from "path";
import { getPool, closePool } from "./pool";

export async function runMigrations(): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();

  try {
    console.log("[migrate] Checking migrations table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(50) PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    const migrationsDir = path.join(__dirname, "migrations");
    if (!fs.existsSync(migrationsDir)) {
      console.warn("[migrate] No migrations directory found at", migrationsDir);
      return;
    }

    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    for (const file of files) {
      const version = path.basename(file, ".sql");
      const checkRes = await client.query(
        "SELECT version FROM schema_migrations WHERE version = $1",
        [version]
      );

      if (checkRes.rows.length === 0) {
        console.log(`[migrate] Applying migration: ${file}...`);
        const sql = fs.readFileSync(path.join(migrationsDir, file), "utf-8");
        await client.query("BEGIN");
        await client.query(sql);
        await client.query(
          "INSERT INTO schema_migrations (version) VALUES ($1)",
          [version]
        );
        await client.query("COMMIT");
        console.log(`[migrate] Successfully applied: ${file}`);
      } else {
        console.log(`[migrate] Already applied: ${file}`);
      }
    }
    console.log("[migrate] All migrations up to date.");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[migrate] Migration failed:", err);
    throw err;
  } finally {
    client.release();
  }
}

// Allow running directly via CLI
if (require.main === module) {
  runMigrations()
    .then(async () => {
      await closePool();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error(err);
      await closePool();
      process.exit(1);
    });
}
