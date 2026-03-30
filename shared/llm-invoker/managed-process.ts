import { spawn, spawnSync, type ChildProcess } from "node:child_process";

export interface ManagedProcessParams {
  command: string;
  args: string[];
  timeoutMs: number;
  label: string;
  stdinText?: string;
  shell?: boolean;
  cwd?: string;
  env?: NodeJS.ProcessEnv;
}

export interface ManagedProcessResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  pid: number | null;
}

const activeProcessTreeRoots = new Map<number, { detached: boolean }>();
let cleanupHandlersInstalled = false;

export async function runManagedProcess(params: ManagedProcessParams): Promise<ManagedProcessResult> {
  ensureCleanupHandlers();

  const detached = process.platform !== "win32";
  const proc = spawn(params.command, params.args, {
    cwd: params.cwd,
    env: params.env,
    shell: params.shell ?? false,
    detached,
    windowsHide: true,
    stdio: ["pipe", "pipe", "pipe"],
  });

  if (typeof proc.pid === "number") {
    activeProcessTreeRoots.set(proc.pid, { detached });
  }

  return await new Promise<ManagedProcessResult>((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    let settled = false;
    let timedOut = false;
    let timeoutHandle: NodeJS.Timeout | null = null;

    const finalize = (callback: () => void): void => {
      if (settled) return;
      settled = true;
      if (timeoutHandle) clearTimeout(timeoutHandle);
      if (typeof proc.pid === "number") {
        activeProcessTreeRoots.delete(proc.pid);
      }
      callback();
    };

    proc.stdout?.on("data", (data: Buffer) => {
      stdout += data.toString();
    });
    proc.stderr?.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on("error", (error: Error) => {
      finalize(() => reject(new Error(`${params.label} failed: ${error.message}`)));
    });

    proc.on("close", (code: number | null, signal: NodeJS.Signals | null) => {
      if (timedOut) {
        finalize(() => reject(new Error(buildTimeoutErrorMessage(params.label, params.timeoutMs, stderr))));
        return;
      }
      if (code !== 0) {
        finalize(() => reject(new Error(`${params.label} failed (exit ${code}): ${stderr}`)));
        return;
      }
      finalize(() =>
        resolve({
          stdout: stdout.trim(),
          stderr,
          exitCode: code,
          signal,
          pid: proc.pid ?? null,
        })
      );
    });

    timeoutHandle = setTimeout(() => {
      timedOut = true;
      void killProcessTree(proc).catch(() => {});
    }, params.timeoutMs);

    if (params.stdinText !== undefined) {
      proc.stdin?.write(params.stdinText);
    }
    proc.stdin?.end();
  });
}

function ensureCleanupHandlers(): void {
  if (cleanupHandlersInstalled) return;
  cleanupHandlersInstalled = true;

  process.once("SIGINT", () => handleTerminationSignal("SIGINT"));
  process.once("SIGTERM", () => handleTerminationSignal("SIGTERM"));
  process.on("exit", () => {
    killTrackedProcessTreesSync();
  });
}

function handleTerminationSignal(signal: "SIGINT" | "SIGTERM"): void {
  killTrackedProcessTreesSync();
  process.exit(signal === "SIGINT" ? 130 : 143);
}

async function killProcessTree(proc: ChildProcess): Promise<void> {
  if (typeof proc.pid !== "number") return;
  if (process.platform === "win32") {
    await spawnAndIgnore("taskkill", ["/PID", String(proc.pid), "/T", "/F"]);
    return;
  }

  try {
    process.kill(-proc.pid, "SIGKILL");
  } catch {
    try {
      proc.kill("SIGKILL");
    } catch {
      // Best-effort cleanup only.
    }
  }
}

function killTrackedProcessTreesSync(): void {
  for (const [pid, metadata] of activeProcessTreeRoots) {
    if (process.platform === "win32") {
      try {
        spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"], {
          windowsHide: true,
          stdio: "ignore",
        });
      } catch {
        // Best-effort cleanup only.
      }
      continue;
    }

    try {
      process.kill(metadata.detached ? -pid : pid, "SIGKILL");
    } catch {
      // Best-effort cleanup only.
    }
  }
  activeProcessTreeRoots.clear();
}

async function spawnAndIgnore(command: string, args: string[]): Promise<void> {
  await new Promise<void>((resolve) => {
    const proc = spawn(command, args, {
      windowsHide: true,
      stdio: "ignore",
    });
    proc.on("error", () => resolve());
    proc.on("close", () => resolve());
  });
}

function buildTimeoutErrorMessage(label: string, timeoutMs: number, stderr: string): string {
  const trimmedStderr = stderr.trim();
  if (!trimmedStderr) {
    return `${label} timed out after ${timeoutMs}ms`;
  }
  return `${label} timed out after ${timeoutMs}ms: ${trimmedStderr}`;
}
