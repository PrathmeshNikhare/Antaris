import { Pool, PoolConfig } from "pg";
import { loadConfig } from "../config";

let pool: Pool | null = null;

export function getPoolConfig(): PoolConfig {
  const config = loadConfig();
  try {
    const url = new URL(config.databaseUrl);
    return {
      host: url.hostname || "127.0.0.1",
      port: parseInt(url.port || "5432", 10),
      user: url.username || "postgres",
      password: decodeURIComponent(url.password || "admin"),
      database: url.pathname.replace(/^\//, "") || "maitri_bharati",
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    };
  } catch {
    return {
      connectionString: config.databaseUrl,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    };
  }
}

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool(getPoolConfig());
    pool.on("error", (err) => {
      console.error("[db] Unexpected error on idle client", err);
    });
  }
  return pool;
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

export async function checkDbConnection(): Promise<boolean> {
  try {
    const p = getPool();
    const res = await p.query("SELECT 1 AS healthy;");
    return res.rows.length > 0;
  } catch (err) {
    console.error("[db] Health check failed:", err);
    return false;
  }
}
