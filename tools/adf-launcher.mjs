#!/usr/bin/env node

import { spawn, spawnSync } from "node:child_process";
import {
  existsSync,
  readdirSync,
  statSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const toolsDir = dirname(__filename);
const repoRoot = resolve(toolsDir, "..");
const isWindows = process.platform === "win32";

const DEFAULT_SCOPE = "assafyavnai/shippingagent";
const MODES = new Set(["tsx-direct", "built", "watch"]);

const commandNames = {
  bash: isWindows ? "bash.exe" : "bash",
  git: isWindows ? "git.exe" : "git",
  npm: isWindows ? "npm.cmd" : "npm",
  npx: isWindows ? "npx.cmd" : "npx",
  pgIsReady: isWindows ? "pg_isready.exe" : "pg_isready",
  rg: isWindows ? "rg.exe" : "rg",
};

async function main() {
  const options = parseArgs(process.argv.slice(2));
  ensureRepoLayout();

  if (options.help) {
    printHelp();
    return;
  }

  if (options.doctor) {
    const report = await runDoctor();
    printDoctorReport(report);
    process.exitCode = report.some((check) => check.status === "fail") ? 1 : 0;
    return;
  }

  runLaunchPreflight(options);
  await launchCoo(options);
}

function parseArgs(argv) {
  const options = {
    cooArgs: [],
    doctor: false,
    help: false,
    mode: "tsx-direct",
    onionEnabled: true,
    scope: DEFAULT_SCOPE,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--") {
      options.cooArgs.push(...argv.slice(index + 1));
      break;
    }

    switch (arg) {
      case "--help":
      case "-h":
        options.help = true;
        break;
      case "--doctor":
        options.doctor = true;
        break;
      case "--scope": {
        const value = argv[index + 1];
        if (!value) {
          throw new Error("--scope requires a value");
        }
        options.scope = value;
        index += 1;
        break;
      }
      case "--no-onion":
        options.onionEnabled = false;
        break;
      case "--watch":
        options.mode = "watch";
        break;
      case "--built":
        options.mode = "built";
        break;
      case "--tsx-direct":
        options.mode = "tsx-direct";
        break;
      default:
        throw new Error(`Unknown flag: ${arg} (use -- to pass flags directly to COO)`);
    }
  }

  if (!MODES.has(options.mode)) {
    throw new Error(`Unsupported mode: ${options.mode}`);
  }

  return options;
}

function printHelp() {
  console.log(`ADF launcher

Usage
  node tools/adf-launcher.mjs [flags] [-- <COO args>]
  ./adf.sh [flags] [-- <COO args>]
  adf.cmd [flags] [-- <COO args>]

Flags
  --help, -h     Show this help text
  --doctor       Run non-mutating environment diagnostics
  --scope <id>   Override Brain scope (default: ${DEFAULT_SCOPE})
  --no-onion     Disable onion requirements lane
  --tsx-direct   Run COO through the local tsx shim (default)
  --watch        Run COO through tsx watch
  --built        Run compiled COO JavaScript
  --             Pass remaining args directly to COO

Examples
  node tools/adf-launcher.mjs --doctor
  node tools/adf-launcher.mjs --scope assafyavnai/adf -- --resume-last
  ./adf.sh --built -- --thread-id <uuid>
  adf.cmd --watch`);
}

function ensureRepoLayout() {
  const requiredPaths = [
    join(repoRoot, "COO", "package.json"),
    join(repoRoot, "components", "memory-engine", "package.json"),
  ];

  for (const requiredPath of requiredPaths) {
    if (!existsSync(requiredPath)) {
      throw new Error(`ADF repo marker not found: ${requiredPath}`);
    }
  }
}

function runLaunchPreflight(options) {
  assertCommandAvailable(process.execPath, ["--version"], "Node.js");
  assertCommandAvailable(commandNames.npm, ["--version"], "npm");

  const memoryEngineDir = join(repoRoot, "components", "memory-engine");
  const cooDir = join(repoRoot, "COO");

  if (needsNpmInstall(memoryEngineDir)) {
    runChecked(commandNames.npm, ["install", "--no-fund", "--no-audit"], {
      cwd: memoryEngineDir,
      description: "Installing memory-engine dependencies",
    });
  }

  if (needsMemoryEngineBuild(memoryEngineDir)) {
    runChecked(commandNames.npm, ["run", "build"], {
      cwd: memoryEngineDir,
      description: "Building memory-engine",
    });
  }

  if (needsNpmInstall(cooDir)) {
    runChecked(commandNames.npm, ["install", "--no-fund", "--no-audit"], {
      cwd: cooDir,
      description: "Installing COO dependencies",
    });
  }

  if (options.mode === "built" && needsCooBuild(cooDir)) {
    runChecked(commandNames.npm, ["run", "build"], {
      cwd: cooDir,
      description: "Building COO",
    });
  }

  const memoryArtifact = join(memoryEngineDir, "dist", "server.js");
  if (!existsSync(memoryArtifact)) {
    throw new Error(`Memory-engine build artifact missing: ${memoryArtifact}`);
  }

  const mcpSdkClientDir = join(
    memoryEngineDir,
    "node_modules",
    "@modelcontextprotocol",
    "sdk",
    "dist",
    "esm",
    "client",
  );
  if (!existsSync(mcpSdkClientDir)) {
    throw new Error(`MCP SDK client runtime missing: ${mcpSdkClientDir}`);
  }

  if (options.mode === "tsx-direct" || options.mode === "watch") {
    const tsxShim = resolveLocalTsxShim(cooDir);
    if (!tsxShim) {
      throw new Error(`Local tsx shim not found under ${join(cooDir, "node_modules", ".bin")}`);
    }
  }

  if (options.mode === "built") {
    const cooArtifact = join(cooDir, "dist", "COO", "controller", "cli.js");
    if (!existsSync(cooArtifact)) {
      throw new Error(`COO build artifact missing: ${cooArtifact}`);
    }
  }

  const pgIsReadyPath = locateCommand(commandNames.pgIsReady);
  if (pgIsReadyPath) {
    const pgStatus = runCapture(commandNames.pgIsReady, ["-h", "localhost", "-p", "5432", "-q"]);
    if (pgStatus.status !== 0) {
      throw new Error("PostgreSQL is not reachable on localhost:5432. Start it before launching ADF.");
    }
  }
}

async function launchCoo(options) {
  const cooDir = join(repoRoot, "COO");
  const onionFlag = options.onionEnabled ? "--enable-onion" : "--disable-onion";

  let command;
  let args;

  if (options.mode === "built") {
    command = process.execPath;
    args = [join(cooDir, "dist", "COO", "controller", "cli.js"), "--scope", options.scope, onionFlag, ...options.cooArgs];
  } else {
    const tsxShim = resolveLocalTsxShim(cooDir);
    if (!tsxShim) {
      throw new Error("Local tsx shim unavailable. Re-run with --doctor for details.");
    }
    command = tsxShim;
    args = options.mode === "watch"
      ? ["watch", "controller/cli.ts", "--scope", options.scope, onionFlag, ...options.cooArgs]
      : ["controller/cli.ts", "--scope", options.scope, onionFlag, ...options.cooArgs];
  }

  console.log(`Launching COO
  mode: ${options.mode}
  cwd:  ${cooDir}
  cmd:  ${command} ${args.join(" ")}`);

  await execStreaming(command, args, { cwd: cooDir });
}

async function runDoctor() {
  const checks = [];
  const cooDir = join(repoRoot, "COO");
  const memoryEngineDir = join(repoRoot, "components", "memory-engine");

  checks.push(checkCommand("node", process.execPath, ["--version"], "required"));
  checks.push(checkCommand("npm", commandNames.npm, ["--version"], "required"));
  checks.push(checkCommand("rg", commandNames.rg, ["--version"], "advisory"));

  const bashPath = locateCommand(commandNames.bash);
  if (!bashPath) {
    checks.push({
      detail: "bash is not on PATH. The Node launcher and adf.cmd remain usable.",
      fix: "Install a working bash only if you need direct .sh execution outside the Node launcher.",
      name: "bash",
      status: "warn",
    });
  } else {
    const bashStatus = runCapture(commandNames.bash, ["--version"], { timeout: 10000 });
    checks.push(
      bashStatus.status === 0
        ? {
            detail: `bash starts successfully via ${bashPath}.`,
            name: "bash",
            status: "pass",
          }
        : {
            detail: summarizeFailure(bashStatus) || "bash exists on PATH but could not start.",
            fix: "Do not assume bash is usable on this runtime. Use adf.cmd or node tools/adf-launcher.mjs instead.",
            name: "bash",
            status: "warn",
          },
    );
  }

  const cooTsxShim = resolveLocalTsxShim(cooDir);
  checks.push(
    cooTsxShim
      ? {
          detail: `Local COO tsx shim found at ${cooTsxShim}.`,
          name: "COO tsx shim",
          status: "pass",
        }
      : {
          detail: "COO local tsx shim is missing.",
          fix: `Run ${commandNames.npm} install in COO.`,
          name: "COO tsx shim",
          status: "fail",
        },
  );

  const memoryEngineTsxShim = resolveLocalTsxShim(memoryEngineDir);
  checks.push(
    memoryEngineTsxShim
      ? {
          detail: `Local memory-engine tsx shim found at ${memoryEngineTsxShim}.`,
          name: "memory-engine tsx shim",
          status: "pass",
        }
      : {
          detail: "memory-engine local tsx shim is missing.",
          fix: `Run ${commandNames.npm} install in components/memory-engine.`,
          name: "memory-engine tsx shim",
          status: "fail",
        },
  );

  const rootTsxImport = runCapture(process.execPath, ["--import", "tsx", "-e", "console.log('ok')"], {
    cwd: repoRoot,
    timeout: 10000,
  });
  checks.push(
    rootTsxImport.status === 0
      ? {
          detail: "Repo-root node --import tsx works.",
          name: "repo-root tsx import",
          status: "pass",
        }
      : {
          detail: summarizeFailure(rootTsxImport) || "Repo-root node --import tsx is unresolved.",
          fix: "Use the package-local tsx shim or execute node --import tsx from COO/ or components/memory-engine/.",
          name: "repo-root tsx import",
          status: "warn",
        },
  );

  const gitPath = locateCommand(commandNames.git);
  if (!gitPath) {
    checks.push({
      detail: "git is not on PATH.",
      fix: "Install git and add it to PATH if you need repo status and version control operations.",
      name: "git",
      status: "warn",
    });
  } else {
    const gitStatus = runCapture(commandNames.git, ["status", "--short"], { cwd: repoRoot, timeout: 10000 });
    const combinedGitOutput = `${gitStatus.stdout}\n${gitStatus.stderr}`;
    checks.push(
      gitStatus.status === 0
        ? {
            detail: "git status works without extra safe.directory flags.",
            name: "git safe.directory",
            status: "pass",
          }
        : /dubious ownership|safe\.directory/i.test(combinedGitOutput)
          ? {
              detail: combinedGitOutput.trim(),
              fix: `Run git config --global --add safe.directory ${repoRoot.replace(/\\/g, "/")}.`,
              name: "git safe.directory",
              status: "warn",
            }
          : {
              detail: summarizeFailure(gitStatus) || "git status failed.",
              fix: "Inspect git configuration for this workspace.",
              name: "git safe.directory",
              status: "warn",
            },
    );
  }

  const pgIsReadyPath = locateCommand(commandNames.pgIsReady);
  if (!pgIsReadyPath) {
    checks.push({
      detail: "pg_isready is not on PATH. PostgreSQL reachability was not probed.",
      fix: "Install PostgreSQL client tools if you want preflight DB checks from the launcher.",
      name: "pg_isready",
      status: "warn",
    });
  } else {
    const pgStatus = runCapture(commandNames.pgIsReady, ["-h", "localhost", "-p", "5432", "-q"], {
      timeout: 10000,
    });
    checks.push(
      pgStatus.status === 0
        ? {
            detail: "PostgreSQL is accepting connections on localhost:5432.",
            name: "PostgreSQL reachability",
            status: "pass",
          }
        : {
            detail: summarizeFailure(pgStatus) || "PostgreSQL is not reachable on localhost:5432.",
            fix: "Start PostgreSQL before launching ADF.",
            name: "PostgreSQL reachability",
            status: "fail",
          },
    );
  }

  const memoryEngineServerArtifact = join(memoryEngineDir, "dist", "server.js");
  const memoryEngineClientArtifact = join(cooDir, "dist", "COO", "controller", "memory-engine-client.js");
  if (!existsSync(memoryEngineServerArtifact) || !existsSync(memoryEngineClientArtifact)) {
    checks.push({
      detail: "Built artifacts for memory-engine connectivity smoke are missing.",
      fix: `Run ${commandNames.npm} run build in COO and components/memory-engine.`,
      name: "memory-engine connect smoke",
      status: "warn",
    });
  } else {
    const smoke = await runMemoryEngineConnectSmoke(memoryEngineClientArtifact);
    checks.push(smoke);
  }

  return checks;
}

function printDoctorReport(checks) {
  console.log("ADF doctor");
  for (const check of checks) {
    const marker = check.status === "pass" ? "PASS" : check.status === "fail" ? "FAIL" : "WARN";
    console.log(`[${marker}] ${check.name}`);
    console.log(`  ${check.detail}`);
    if (check.fix) {
      console.log(`  Fix: ${check.fix}`);
    }
  }
}

function checkCommand(name, command, args, strictness) {
  const location = locateCommand(command);
  const result = runCapture(command, args, { timeout: 10000 });
  if (result.status === 0) {
    return {
      detail: `${name} is available${location ? ` via ${location}` : ""}.`,
      name,
      status: "pass",
    };
  }

  return {
    detail: summarizeFailure(result) || `${name} is unavailable.`,
    fix: strictness === "required"
      ? `Install or expose ${name} on PATH before using the launcher.`
      : `Install ${name} or update PATH if you want the documented fast-path tooling.`,
    name,
    status: strictness === "required" ? "fail" : "warn",
  };
}

function assertCommandAvailable(command, args, label) {
  const result = runCapture(command, args, { timeout: 10000 });
  if (result.status !== 0) {
    throw new Error(`${label} is unavailable. ${summarizeFailure(result)}`);
  }
}

function runChecked(command, args, options) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    encoding: "utf8",
    shell: false,
    stdio: "inherit",
    windowsHide: true,
  });
  if (typeof result.status === "number" && result.status === 0) {
    return;
  }
  throw new Error(`${options.description} failed${result.error ? `: ${result.error.message}` : ""}`);
}

function runCapture(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    encoding: "utf8",
    shell: false,
    stdio: "pipe",
    timeout: options.timeout,
    windowsHide: true,
  });
  return {
    error: result.error ?? null,
    signal: result.signal ?? null,
    status: typeof result.status === "number" ? result.status : null,
    stderr: result.stderr ?? "",
    stdout: result.stdout ?? "",
  };
}

function locateCommand(command) {
  const locator = isWindows ? "where.exe" : "which";
  const result = spawnSync(locator, [command], {
    encoding: "utf8",
    shell: false,
    stdio: "pipe",
    windowsHide: true,
  });
  if (result.status !== 0) {
    return null;
  }
  return result.stdout.split(/\r?\n/).map((line) => line.trim()).find(Boolean) ?? null;
}

function resolveLocalTsxShim(packageDir) {
  const candidates = isWindows
    ? [join(packageDir, "node_modules", ".bin", "tsx.cmd"), join(packageDir, "node_modules", ".bin", "tsx.exe")]
    : [join(packageDir, "node_modules", ".bin", "tsx")];
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

function needsNpmInstall(packageDir) {
  const nodeModulesDir = join(packageDir, "node_modules");
  const installMarker = join(nodeModulesDir, ".package-lock.json");
  const packageLock = join(packageDir, "package-lock.json");

  if (!existsSync(nodeModulesDir) || !existsSync(packageLock) || !existsSync(installMarker)) {
    return true;
  }

  return statSync(packageLock).mtimeMs > statSync(installMarker).mtimeMs;
}

function needsMemoryEngineBuild(memoryEngineDir) {
  const artifact = join(memoryEngineDir, "dist", "server.js");
  if (!existsSync(artifact)) {
    return true;
  }
  return treeHasNewerTypeScript(join(memoryEngineDir, "src"), statSync(artifact).mtimeMs);
}

function needsCooBuild(cooDir) {
  const artifact = join(cooDir, "dist", "COO", "controller", "cli.js");
  if (!existsSync(artifact)) {
    return true;
  }
  return treeHasNewerTypeScript(cooDir, statSync(artifact).mtimeMs, new Set(["dist", "node_modules"]));
}

function treeHasNewerTypeScript(startDir, artifactMtimeMs, skipDirs = new Set()) {
  if (!existsSync(startDir)) {
    return false;
  }

  const queue = [startDir];
  while (queue.length > 0) {
    const current = queue.pop();
    const entries = readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = join(current, entry.name);
      if (entry.isDirectory()) {
        if (!skipDirs.has(entry.name)) {
          queue.push(entryPath);
        }
        continue;
      }
      if (entry.isFile() && entry.name.endsWith(".ts") && statSync(entryPath).mtimeMs > artifactMtimeMs) {
        return true;
      }
    }
  }

  return false;
}

async function runMemoryEngineConnectSmoke(memoryEngineClientArtifact) {
  try {
    const { MemoryEngineClient } = await import(pathToFileURL(memoryEngineClientArtifact).href);
    let client;
    try {
      client = await withTimeout(MemoryEngineClient.connect(repoRoot), 10000);
      await withTimeout(client.close(), 5000);
      return {
        detail: "MemoryEngineClient.connect() succeeded from the current runtime.",
        name: "memory-engine connect smoke",
        status: "pass",
      };
    } finally {
      if (client) {
        try {
          await client.close();
        } catch {
          // Best effort close only.
        }
      }
    }
  } catch (error) {
    return {
      detail: error instanceof Error ? error.message : String(error),
      fix: "The runtime still blocks the child-process Brain client. Use repo-backed authority or add an in-process fallback before relying on live Brain startup here.",
      name: "memory-engine connect smoke",
      status: "fail",
    };
  }
}

function withTimeout(promise, timeoutMs) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      promise.finally(() => clearTimeout(timer)).catch(() => clearTimeout(timer));
    }),
  ]);
}

function summarizeFailure(result) {
  if (result.error) {
    return result.error.message;
  }

  const stderr = result.stderr.trim();
  if (stderr) {
    return stderr;
  }

  const stdout = result.stdout.trim();
  if (stdout) {
    return stdout;
  }

  if (result.signal) {
    return `Process terminated by signal ${result.signal}.`;
  }

  if (typeof result.status === "number") {
    return `Process exited with status ${result.status}.`;
  }

  return null;
}

function execStreaming(command, args, options) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      shell: false,
      stdio: "inherit",
      windowsHide: true,
    });

    child.once("error", rejectPromise);
    child.once("exit", (code, signal) => {
      if (signal) {
        rejectPromise(new Error(`COO exited from signal ${signal}`));
        return;
      }
      if ((code ?? 0) !== 0) {
        rejectPromise(new Error(`COO exited with status ${code}`));
        return;
      }
      resolvePromise();
    });
  });
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`FATAL: ${message}`);
  process.exitCode = 1;
});
