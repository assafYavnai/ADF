import { createHash } from "node:crypto";
import { access, readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type pg from "pg";
import { pool } from "./connection.js";
import { logger } from "../logger.js";

const MIGRATIONS_TABLE = "adf_schema_migrations";
const LOCK_NAMESPACE = "adf-memory-engine-migrations";
const MIGRATION_FILE_PATTERN = /^\d+.*\.sql$/i;
const MIGRATIONS_DIR_CANDIDATES = [
  resolve(import.meta.dirname ?? ".", "migrations"),
  resolve(import.meta.dirname ?? ".", "../../src/db/migrations"),
];

interface MigrationFile {
  name: string;
  path: string;
  sql: string;
  checksum: string;
}

interface AppliedMigration {
  filename: string;
  checksum: string;
  applied_at: string;
}

interface MigrationStatus {
  file: MigrationFile;
  applied: boolean;
  appliedAt: string | null;
  checksumMatch: boolean;
}

export async function listMigrationFiles(): Promise<MigrationFile[]> {
  const migrationsDir = await resolveMigrationsDir();
  const entries = await readdir(migrationsDir, { withFileTypes: true });
  const names = entries
    .filter((entry) => entry.isFile() && MIGRATION_FILE_PATTERN.test(entry.name))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  const files: MigrationFile[] = [];
  for (const name of names) {
    const path = resolve(migrationsDir, name);
    const sql = (await readFile(path, "utf-8")).replace(/^\uFEFF/, "");
    files.push({
      name,
      path,
      sql,
      checksum: createHash("sha256").update(sql).digest("hex"),
    });
  }

  return files;
}

async function resolveMigrationsDir(): Promise<string> {
  for (const candidate of MIGRATIONS_DIR_CANDIDATES) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      continue;
    }
  }

  throw new Error(
    `Could not locate migrations directory. Tried:\n${MIGRATIONS_DIR_CANDIDATES.join("\n")}`
  );
}

async function ensureMigrationsTable(client: pg.PoolClient): Promise<void> {
  await client.query(
    `CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
       filename TEXT PRIMARY KEY,
       checksum TEXT NOT NULL,
       applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
     )`
  );
}

async function withMigrationLock<T>(
  client: pg.PoolClient,
  fn: () => Promise<T>
): Promise<T> {
  await client.query("SELECT pg_advisory_lock(hashtext($1))", [LOCK_NAMESPACE]);
  try {
    return await fn();
  } finally {
    await client.query("SELECT pg_advisory_unlock(hashtext($1))", [LOCK_NAMESPACE]);
  }
}

async function loadAppliedMigrations(
  client: pg.PoolClient
): Promise<Map<string, AppliedMigration>> {
  const { rows } = await client.query<AppliedMigration>(
    `SELECT filename, checksum, applied_at::text
     FROM ${MIGRATIONS_TABLE}
     ORDER BY filename ASC`
  );

  return new Map(rows.map((row) => [row.filename, row]));
}

export async function getMigrationStatus(
  client: pg.PoolClient
): Promise<MigrationStatus[]> {
  await ensureMigrationsTable(client);
  const [files, applied] = await Promise.all([
    listMigrationFiles(),
    loadAppliedMigrations(client),
  ]);

  return files.map((file) => {
    const existing = applied.get(file.name);
    return {
      file,
      applied: Boolean(existing),
      appliedAt: existing?.applied_at ?? null,
      checksumMatch: existing ? existing.checksum === file.checksum : true,
    };
  });
}

function assertNoChecksumDrift(statuses: MigrationStatus[]): void {
  const drifted = statuses.filter((status) => status.applied && !status.checksumMatch);
  if (drifted.length === 0) return;

  const details = drifted
    .map((status) => `- ${status.file.name}: applied checksum differs from current file`)
    .join("\n");

  throw new Error(
    `Refusing to continue: detected checksum drift in applied migrations.\n${details}`
  );
}

function usesExplicitTransaction(sql: string): boolean {
  return /^\s*BEGIN\b/im.test(sql) && /^\s*COMMIT\b/im.test(sql);
}

async function executeMigration(
  client: pg.PoolClient,
  migration: MigrationFile
): Promise<void> {
  logger.info(`Applying migration ${migration.name}`);

  if (usesExplicitTransaction(migration.sql)) {
    await client.query(migration.sql);
  } else {
    await client.query("BEGIN");
    try {
      await client.query(migration.sql);
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    }
  }

  await client.query(
    `INSERT INTO ${MIGRATIONS_TABLE} (filename, checksum)
     VALUES ($1, $2)
     ON CONFLICT (filename) DO UPDATE
       SET checksum = EXCLUDED.checksum,
           applied_at = NOW()`,
    [migration.name, migration.checksum]
  );
}

export async function applyPendingMigrations(): Promise<MigrationStatus[]> {
  const client = await pool.connect();
  try {
    return await withMigrationLock(client, async () => {
      const before = await getMigrationStatus(client);
      assertNoChecksumDrift(before);

      for (const status of before) {
        if (status.applied) continue;
        await executeMigration(client, status.file);
      }

      const after = await getMigrationStatus(client);
      assertNoChecksumDrift(after);
      return after;
    });
  } finally {
    client.release();
  }
}

async function printStatus(): Promise<void> {
  const client = await pool.connect();
  try {
    const migrationsDir = await resolveMigrationsDir();
    const statuses = await withMigrationLock(client, () => getMigrationStatus(client));
    const applied = statuses.filter((status) => status.applied).length;
    const pending = statuses.filter((status) => !status.applied).length;
    const drifted = statuses.filter((status) => status.applied && !status.checksumMatch).length;

    console.log(`Migrations directory: ${migrationsDir}`);
    console.log(`Applied: ${applied}`);
    console.log(`Pending: ${pending}`);
    console.log(`Checksum drift: ${drifted}`);
    console.log("");

    for (const status of statuses) {
      const marker = status.applied ? "[applied]" : "[pending]";
      const checksum = status.checksumMatch ? "" : " CHECKSUM_MISMATCH";
      const appliedAt = status.appliedAt ? ` @ ${status.appliedAt}` : "";
      console.log(`${marker} ${status.file.name}${appliedAt}${checksum}`);
    }
  } finally {
    client.release();
  }
}

async function runApply(): Promise<void> {
  const statuses = await applyPendingMigrations();
  const pending = statuses.filter((status) => !status.applied);
  console.log(`Applied migrations successfully. Pending after apply: ${pending.length}`);
  for (const status of statuses) {
    const marker = status.applied ? "[applied]" : "[pending]";
    console.log(`${marker} ${status.file.name}`);
  }
}

async function main(): Promise<void> {
  const command = process.argv[2] ?? "status";

  try {
    switch (command) {
      case "status":
        await printStatus();
        break;
      case "apply":
        await runApply();
        break;
      default:
        throw new Error(`Unknown command "${command}". Use "status" or "apply".`);
    }
  } finally {
    await pool.end();
  }
}

if (process.argv[1]?.endsWith("migrate.ts") || process.argv[1]?.endsWith("migrate.js")) {
  main().catch((err) => {
    logger.error("Migration runner failed:", err);
    process.exit(1);
  });
}
