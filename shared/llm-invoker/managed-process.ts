import { existsSync, readFileSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";
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
  const launch = resolveLaunchCommand(params);
  const proc = spawn(launch.command, launch.args, {
    cwd: params.cwd,
    env: params.env,
    shell: launch.shell,
    windowsVerbatimArguments: launch.windowsVerbatimArguments ?? false,
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

function resolveLaunchCommand(params: ManagedProcessParams): {
  command: string;
  args: string[];
  shell: boolean;
  windowsVerbatimArguments?: boolean;
} {
  if (process.platform !== "win32" || params.shell) {
    return {
      command: params.command,
      args: params.args,
      shell: params.shell ?? false,
    };
  }

  const resolvedCommand = resolveWindowsCommand(params.command, params.env) ?? params.command;
  if (isBatchShim(resolvedCommand)) {
    const parsedNodeShim = resolveNodeShimLaunch(resolvedCommand, params.args, params.env);
    if (parsedNodeShim) {
      return parsedNodeShim;
    }

    return {
      command: resolveWindowsCommand(process.env.ComSpec ?? "cmd.exe", params.env) ?? (process.env.ComSpec ?? "cmd.exe"),
      args: ["/d", "/v:off", "/c", composeBatchShimCommandLine(resolvedCommand, params.args)],
      shell: false,
      windowsVerbatimArguments: true,
    };
  }

  return {
    command: resolvedCommand,
    args: params.args,
    shell: false,
  };
}

function resolveNodeShimLaunch(
  command: string,
  args: string[],
  env?: NodeJS.ProcessEnv
): { command: string; args: string[]; shell: boolean } | null {
  const parsed = parseNodeBatchShim(command);
  if (!parsed) {
    return null;
  }

  const shimDir = dirname(command);
  const localNode = resolve(shimDir, "node.exe");
  const nodeCommand = existsSync(localNode)
    ? localNode
    : (resolveWindowsCommand("node", env) ?? process.execPath);

  return {
    command: nodeCommand,
    args: [...parsed.nodeArgs, parsed.scriptPath, ...args],
    shell: false,
  };
}

function parseNodeBatchShim(command: string): { nodeArgs: string[]; scriptPath: string } | null {
  let contents: string;
  try {
    contents = readFileSync(command, "utf-8");
  } catch {
    return null;
  }

  const shimDir = dirname(command);
  const line = contents
    .split(/\r?\n/)
    .find((entry) => /"%_prog%"/i.test(entry) && /%dp0%\\.*node_modules.*\.js/i.test(entry) && /%\*/.test(entry));
  if (!line) {
    return null;
  }

  const match = line.match(/"%_prog%"\s*(?<prefix>.*?)"%dp0%\\(?<script>[^"]+?\.js)"\s+%\*/i);
  if (!match?.groups?.script) {
    return null;
  }

  return {
    nodeArgs: tokenizeShimArgs(match.groups.prefix ?? ""),
    scriptPath: resolve(shimDir, match.groups.script),
  };
}

function tokenizeShimArgs(value: string): string[] {
  const trimmed = value.trim();
  if (!trimmed) {
    return [];
  }

  const tokens: string[] = [];
  const matcher = /"([^"]*)"|([^\s]+)/g;
  let match: RegExpExecArray | null;
  while ((match = matcher.exec(trimmed)) !== null) {
    tokens.push(match[1] ?? match[2] ?? "");
  }
  return tokens;
}

function resolveWindowsCommand(command: string, env?: NodeJS.ProcessEnv): string | null {
  if (/[\\/]/.test(command)) {
    return command;
  }

  const lookup = spawnSync("where", [command], {
    env,
    encoding: "utf-8",
    windowsHide: true,
    stdio: ["ignore", "pipe", "ignore"],
  });
  if (lookup.status !== 0 || !lookup.stdout) {
    return null;
  }

  const matches = lookup.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (matches.length === 0) {
    return null;
  }

  const ranked = matches
    .map((candidate) => ({
      candidate,
      rank: windowsCommandRank(candidate),
    }))
    .sort((left, right) => left.rank - right.rank);

  return ranked[0]?.candidate ?? null;
}

function composeBatchShimCommandLine(command: string, args: string[]): string {
  const assignments = args
    .map((arg, index) => `set "ADF_MANAGED_ARG_${index}=${escapeBatchShimValue(arg)}"`)
    .join(" && ");
  const argRefs = args
    .map((_, index) => `"%ADF_MANAGED_ARG_${index}%"`)
    .join(" ");
  const commandPath = `"${command.replace(/"/g, "\"\"")}"`;

  if (args.length === 0) {
    return `setlocal DisableDelayedExpansion && call ${commandPath}`;
  }

  return `setlocal DisableDelayedExpansion && ${assignments} && call ${commandPath} ${argRefs}`;
}

function escapeBatchShimValue(value: string): string {
  return value
    .replace(/\^/g, "^^")
    .replace(/&/g, "^&")
    .replace(/\|/g, "^|")
    .replace(/</g, "^<")
    .replace(/>/g, "^>")
    .replace(/\(/g, "^(")
    .replace(/\)/g, "^)")
    .replace(/%/g, "%%")
    .replace(/"/g, "\"\"");
}

function isBatchShim(command: string): boolean {
  const extension = extname(command).toLowerCase();
  return extension === ".cmd" || extension === ".bat";
}

function windowsCommandRank(command: string): number {
  const extension = extname(command).toLowerCase();
  switch (extension) {
    case ".exe":
      return 0;
    case ".cmd":
      return 1;
    case ".bat":
      return 2;
    default:
      return 3;
  }
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
