import pg from "pg";

const DB_APP_URL =
  process.env.DB_APP_URL ??
  "postgresql://brain_user:grmXHahJAW50oEpP@localhost:5432/project_brain";

export const pool = new pg.Pool({
  connectionString: DB_APP_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
});

export async function withTransaction<T>(
  fn: (client: pg.PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function healthCheck(): Promise<boolean> {
  try {
    await pool.query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}
