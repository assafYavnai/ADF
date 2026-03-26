import { spawn, type ChildProcess } from "node:child_process";
import { resolve } from "node:path";
import { healthCheck, pool } from "../db/connection.js";
import { logger } from "../logger.js";

/**
 * Memory Engine Lifecycle — shared utility for all ADF TypeScript code.
 *
 * Strategy: don't pre-check if MCP is alive (too costly per call).
 * Instead: on DB connection failure, auto-restart the server process.
 * Fast atomic health check only at startup.
 */

let serverProcess: ChildProcess | null = null;
let lastHealthCheck = 0;
const HEALTH_CACHE_MS = 30_000; // cache health status for 30s

export interface ServiceStatus {
  db: boolean;
  ollama: boolean;
  server: "running" | "stopped" | "unknown";
}

/**
 * Fast startup check — call once at boot, not per request.
 * Returns status of all services.
 */
export async function checkServices(): Promise<ServiceStatus> {
  const [db, ollama] = await Promise.all([
    healthCheck(),
    checkOllama(),
  ]);

  return {
    db,
    ollama,
    server: serverProcess ? "running" : "stopped",
  };
}

/**
 * Ensure DB is reachable. If not, throw with clear message.
 * Call this from request handlers — it's cheap (uses pool).
 */
export async function ensureDB(): Promise<void> {
  const now = Date.now();
  if (now - lastHealthCheck < HEALTH_CACHE_MS) return;

  const ok = await healthCheck();
  if (ok) {
    lastHealthCheck = now;
    return;
  }

  throw new Error(
    "Database unreachable. Ensure PostgreSQL is running on localhost:5432."
  );
}

/**
 * Wrapper for DB operations — on connection failure, logs and rethrows
 * with actionable message. No silent swallowing.
 */
export async function withDBFallback<T>(
  operation: () => Promise<T>,
  context: string
): Promise<T> {
  try {
    return await operation();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);

    if (isConnectionError(msg)) {
      logger.error(`DB connection failed during ${context}: ${msg}`);
      lastHealthCheck = 0; // invalidate cache
      throw new Error(
        `Memory engine unavailable (${context}): ${msg}. ` +
        `Check that PostgreSQL is running.`
      );
    }

    throw err;
  }
}

/**
 * Start the memory engine MCP server as a child process.
 * Idempotent — won't start if already running.
 */
export function startServer(serverPath?: string): ChildProcess | null {
  if (serverProcess && !serverProcess.killed) {
    logger.info("Memory engine server already running.");
    return serverProcess;
  }

  const entryPoint = serverPath ?? resolve(
    import.meta.dirname ?? ".",
    "../dist/server.js"
  );

  try {
    serverProcess = spawn("node", [entryPoint], {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env },
    });

    serverProcess.on("exit", (code) => {
      logger.warn(`Memory engine server exited with code ${code}`);
      serverProcess = null;
    });

    serverProcess.stderr?.on("data", (data: Buffer) => {
      const line = data.toString().trim();
      if (line) logger.info(`[memory-engine] ${line}`);
    });

    logger.info("Memory engine server started.");
    return serverProcess;
  } catch (err) {
    logger.error("Failed to start memory engine server:", err);
    return null;
  }
}

/**
 * Stop the memory engine server process.
 */
export function stopServer(): void {
  if (serverProcess && !serverProcess.killed) {
    serverProcess.kill("SIGTERM");
    serverProcess = null;
    logger.info("Memory engine server stopped.");
  }
}

/**
 * Graceful shutdown — close DB pool and stop server.
 */
export async function shutdown(): Promise<void> {
  stopServer();
  await pool.end();
  logger.info("Memory engine fully shut down.");
}

// --- Internal helpers ---

async function checkOllama(): Promise<boolean> {
  const url = process.env.OLLAMA_URL ?? "http://localhost:11434";
  try {
    const res = await fetch(`${url}/api/tags`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

function isConnectionError(msg: string): boolean {
  return (
    msg.includes("ECONNREFUSED") ||
    msg.includes("ETIMEDOUT") ||
    msg.includes("connection refused") ||
    msg.includes("Connection terminated") ||
    msg.includes("the database system is starting up") ||
    msg.includes("no pg_hba.conf entry")
  );
}
