#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function parseArgs(argv) {
  const values = new Map();
  const flags = new Set();

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      flags.add(key);
      continue;
    }
    values.set(key, next);
    index += 1;
  }

  return { values, flags };
}

function defaultProcessRunner(command, args) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    env: process.env,
  });

  return {
    status: typeof result.status === "number" ? result.status : 1,
    stdout: String(result.stdout ?? "").trim(),
    stderr: String(result.stderr ?? "").trim(),
  };
}

function pathEntriesForLookup(pathValue, platform) {
  if (!pathValue) return [];
  if (platform === "win32") {
    return pathValue.includes(";") ? pathValue.split(";").filter(Boolean) : pathValue.split(":").filter(Boolean);
  }
  return pathValue.split(":").filter(Boolean);
}

function candidateCommandNames(command, platform, env) {
  if (platform !== "win32") return [command];
  if (/\.[A-Za-z0-9]+$/.test(command)) return [command];
  const pathExt = String(env.PATHEXT ?? ".COM;.EXE;.BAT;.CMD")
    .split(";")
    .filter(Boolean)
    .map((value) => value.toLowerCase());
  return [command, ...pathExt.map((extension) => `${command}${extension.toLowerCase()}`)];
}

function manualPathLookup(command, { platform, env }) {
  for (const directory of pathEntriesForLookup(env.PATH ?? env.Path ?? "", platform)) {
    for (const candidate of candidateCommandNames(command, platform, env)) {
      const fullPath = join(directory, candidate);
      if (existsSync(fullPath)) {
        return fullPath;
      }
    }
  }
  return null;
}

function commandLookupScript(command) {
  return `command -v '${String(command).replace(/'/g, `'\\''`)}'`;
}

function defaultCommandLookup(command, { processRunner, bashCommand, platform }) {
  if (bashCommand) {
    const bashResult = processRunner(bashCommand, ["-lc", commandLookupScript(command)]);
    if (bashResult.status === 0 && bashResult.stdout) {
      return bashResult.stdout.split(/\r?\n/)[0].trim();
    }
  }

  const fallbackCommand = platform === "win32" ? "where" : "which";
  const fallbackResult = processRunner(fallbackCommand, [command]);
  if (fallbackResult.status === 0 && fallbackResult.stdout) {
    return fallbackResult.stdout.split(/\r?\n/)[0].trim();
  }

  return manualPathLookup(command, { platform, env: process.env });
}

function classifyHostOs(platform) {
  if (platform === "win32") return "windows";
  if (platform === "darwin") return "macos";
  return "linux";
}

function classifyApprovedBashRuntime(hostOs, env, bashPath) {
  if (hostOs !== "windows") return "posix-bash";
  if (env.MSYSTEM) return `msys2-${String(env.MSYSTEM).toLowerCase()}`;
  const normalized = String(bashPath ?? env.SHELL ?? "").toLowerCase();
  if (normalized.includes("\\git\\") || normalized.includes("/git/")) return "git-bash";
  return "unknown-windows-bash";
}

function classifyTerminalShellHint(env) {
  if (env.MSYSTEM) return `msys2-${String(env.MSYSTEM).toLowerCase()}`;
  const shellValue = String(env.SHELL ?? "").toLowerCase();
  if (shellValue.includes("bash")) return "bash";
  if (shellValue.includes("powershell")) return "powershell";
  if (shellValue.includes("cmd")) return "cmd";
  return "unknown";
}

function classifyPathStyle(hostOs, env) {
  if (hostOs !== "windows") return "posix";
  if (env.MSYSTEM) return "mixed-windows-msys";
  return "windows-native";
}

function installStatePath(repoRoot) {
  return join(repoRoot, ".codex", "runtime", "install-state.json");
}

function readJsonIfPresent(path) {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

function recommendedCommands(hostOs) {
  const preflight = hostOs === "windows"
    ? "adf.cmd --runtime-preflight --json"
    : "./adf.sh --runtime-preflight --json";
  const install = hostOs === "windows"
    ? "adf.cmd --install"
    : "./adf.sh --install";
  const doctor = hostOs === "windows"
    ? "adf.cmd --doctor"
    : "./adf.sh --doctor";
  const launch = hostOs === "windows"
    ? "adf.cmd [flags] [-- <COO args>]"
    : "./adf.sh [flags] [-- <COO args>]";

  return {
    runtime_preflight: preflight,
    install,
    doctor,
    launch,
  };
}

function buildChecks(input) {
  const checks = [];
  const addCheck = (name, status, detail, fix = null) => {
    checks.push({ name, status, detail, fix });
  };

  addCheck(
    "host OS",
    "pass",
    `Detected ${input.hostOs}.`,
    null,
  );

  addCheck(
    "workflow shell",
    input.bash.working ? "pass" : "fail",
    input.bash.working
      ? `ADF workflow shell is bash via ${input.bash.path}.`
      : "bash is missing or not runnable from the current ADF workflow route.",
    input.bash.working ? null : "Install or repair an approved bash runtime, then rerun runtime preflight.",
  );

  addCheck(
    input.commands.node.command_name,
    input.commands.node.available ? "pass" : "fail",
    input.commands.node.available
      ? `${input.commands.node.command_name} is available via ${input.commands.node.path}.`
      : `${input.commands.node.command_name} is not on PATH.`,
    input.commands.node.available ? null : "Install or expose Node.js before launching ADF.",
  );

  addCheck(
    input.commands.npm.command_name,
    input.commands.npm.available ? "pass" : "fail",
    input.commands.npm.available
      ? `${input.commands.npm.command_name} is available via ${input.commands.npm.path}.`
      : `${input.commands.npm.command_name} is not on PATH.`,
    input.commands.npm.available
      ? null
      : `Install or expose ${input.commands.npm.command_name} before using ${input.recommended_commands.install}.`,
  );

  addCheck(
    input.commands.npx.command_name,
    input.commands.npx.available ? "pass" : "fail",
    input.commands.npx.available
      ? `${input.commands.npx.command_name} is available via ${input.commands.npx.path}.`
      : `${input.commands.npx.command_name} is not on PATH.`,
    input.commands.npx.available
      ? null
      : `Install or expose ${input.commands.npx.command_name} before using ${input.recommended_commands.install}.`,
  );

  addCheck(
    "ripgrep",
    input.commands.rg.available ? "pass" : "warn",
    input.commands.rg.available
      ? `rg is available via ${input.commands.rg.path}.`
      : "rg is not on PATH.",
    input.commands.rg.available ? null : "Install ripgrep for the documented fast-path search workflow.",
  );

  addCheck(
    "memory-engine dist",
    input.artifacts.memory_engine_dist.exists ? "pass" : "fail",
    input.artifacts.memory_engine_dist.exists
      ? `Found ${input.artifacts.memory_engine_dist.path}.`
      : `Missing ${input.artifacts.memory_engine_dist.path}.`,
    input.artifacts.memory_engine_dist.exists ? null : `Run ${input.recommended_commands.install} to build the memory-engine artifacts.`,
  );

  addCheck(
    "MCP SDK client",
    input.artifacts.mcp_sdk_client.exists ? "pass" : "fail",
    input.artifacts.mcp_sdk_client.exists
      ? `Found ${input.artifacts.mcp_sdk_client.path}.`
      : `Missing ${input.artifacts.mcp_sdk_client.path}.`,
    input.artifacts.mcp_sdk_client.exists ? null : `Run ${input.recommended_commands.install} to install memory-engine dependencies.`,
  );

  if (input.launch_mode === "built") {
    addCheck(
      "COO built entrypoint",
      input.artifacts.coo_dist.exists ? "pass" : "fail",
      input.artifacts.coo_dist.exists
        ? `Found ${input.artifacts.coo_dist.path}.`
        : `Missing ${input.artifacts.coo_dist.path}.`,
      input.artifacts.coo_dist.exists ? null : `Run ${input.recommended_commands.install} to build the COO distribution.`,
    );
  } else {
    addCheck(
      "COO tsx shim",
      input.artifacts.coo_tsx_shim.exists ? "pass" : "fail",
      input.artifacts.coo_tsx_shim.exists
        ? `Found ${input.artifacts.coo_tsx_shim.path}.`
        : `Missing ${input.artifacts.coo_tsx_shim.path}.`,
      input.artifacts.coo_tsx_shim.exists ? null : `Run ${input.recommended_commands.install} to install COO dependencies.`,
    );
  }

  if (input.commands.pg_isready.available) {
    addCheck(
      "PostgreSQL reachability",
      input.postgresql.reachable ? "pass" : "fail",
      input.postgresql.reachable
        ? "PostgreSQL is accepting connections on localhost:5432."
        : input.postgresql.detail,
      input.postgresql.reachable ? null : "Start PostgreSQL before launching ADF.",
    );
  } else {
    addCheck(
      "pg_isready",
      "warn",
      "pg_isready is not on PATH; PostgreSQL was not probed by runtime preflight.",
      "Install PostgreSQL client tools if you want preflight DB reachability checks.",
    );
  }

  addCheck(
    "install state",
    input.install_state.exists ? "pass" : "warn",
    input.install_state.exists
      ? `Found ${input.install_state.path}.`
      : `No install state recorded at ${input.install_state.path}.`,
    input.install_state.exists ? null : `Run ${input.recommended_commands.install} to record a successful install/bootstrap pass.`,
  );

  return checks;
}

function determineOverallStatus(checks) {
  if (checks.some((check) => check.status === "fail")) return "fail";
  if (checks.some((check) => check.status === "warn")) return "warn";
  return "pass";
}

function recommendedNextAction(overallStatus, commands) {
  if (overallStatus === "pass") {
    return `Runtime preflight passed. Launch through ${commands.launch}.`;
  }
  return `Runtime preflight found blocking issues. Run ${commands.install} for bounded repair, or ${commands.doctor} if you need full repair plus Brain verification.`;
}

export function buildRuntimePreflightReport({
  repoRoot,
  launchMode = "tsx-direct",
  env = process.env,
  platform = process.platform,
  cwd = process.cwd(),
  processRunner = defaultProcessRunner,
  commandLookup,
  pathExists = existsSync,
  jsonReader = readJsonIfPresent,
} = {}) {
  const resolvedRepoRoot = resolve(repoRoot ?? join(__dirname, ".."));
  const hostOs = classifyHostOs(platform);
  const bashCommand = String(env.BASH ?? env.SHELL ?? "bash");
  const lookup = (name) => (commandLookup ?? ((value) => defaultCommandLookup(value, { processRunner, bashCommand, platform })))(name);

  const bashPath = lookup("bash") ?? (env.BASH || env.SHELL || null);
  const bashVersion = bashPath ? processRunner(bashPath, ["--version"]) : { status: 1, stdout: "", stderr: "bash not found" };
  const bashWorking = bashVersion.status === 0;

  const npmCommand = hostOs === "windows" ? "npm.cmd" : "npm";
  const npxCommand = hostOs === "windows" ? "npx.cmd" : "npx";
  const nodePath = lookup("node");
  const npmPath = lookup(npmCommand);
  const npxPath = lookup(npxCommand);
  const rgPath = lookup("rg");
  const pgIsReadyPath = lookup("pg_isready");
  const pgReachability = pgIsReadyPath
    ? processRunner("pg_isready", ["-h", "localhost", "-p", "5432", "-q"])
    : { status: 1, stdout: "", stderr: "pg_isready unavailable" };

  const cooTsxShimPath = hostOs === "windows"
    ? join(resolvedRepoRoot, "COO", "node_modules", ".bin", "tsx.cmd")
    : join(resolvedRepoRoot, "COO", "node_modules", ".bin", "tsx");
  const cooDistPath = join(resolvedRepoRoot, "COO", "dist", "COO", "controller", "cli.js");
  const memoryEngineDistPath = join(resolvedRepoRoot, "components", "memory-engine", "dist", "server.js");
  const mcpSdkClientPath = join(
    resolvedRepoRoot,
    "components",
    "memory-engine",
    "node_modules",
    "@modelcontextprotocol",
    "sdk",
    "dist",
    "esm",
    "client",
    "index.js",
  );
  const installStateFile = installStatePath(resolvedRepoRoot);
  const installState = jsonReader(installStateFile);

  const report = {
    schema_version: 1,
    repo_root: resolvedRepoRoot,
    launch_mode: launchMode,
    host_os: hostOs,
    workflow_shell: "bash",
    terminal_shell_hint: classifyTerminalShellHint(env),
    execution_environment: {
      node_platform: platform,
      cwd,
      term_program: env.TERM_PROGRAM ?? null,
      msystem: env.MSYSTEM ?? null,
      shell_env: env.SHELL ?? null,
      bash_env: env.BASH ?? null,
    },
    shell_contract: {
      canonical_shell: "bash",
      approved_bash_runtime: classifyApprovedBashRuntime(hostOs, env, bashPath),
      bash_path: bashPath,
      bash_working: bashWorking,
      command_construction_mode: hostOs === "windows"
        ? "windows-host-bash-workflow"
        : "posix-bash-workflow",
      bash_write_style: hostOs === "windows"
        ? "Issue ADF workflow commands as bash commands. If the control plane is non-bash or quoting is complex, write a temporary .sh script and run it through bash."
        : "Issue ADF workflow commands directly in bash.",
      path_style: classifyPathStyle(hostOs, env),
      windows_native_leaf_shell: hostOs === "windows" ? "powershell-or-cmd-for-leaf-tasks-only" : null,
    },
    commands: {
      node: { command_name: "node", available: Boolean(nodePath), path: nodePath },
      npm: { command_name: npmCommand, available: Boolean(npmPath), path: npmPath },
      npx: { command_name: npxCommand, available: Boolean(npxPath), path: npxPath },
      rg: { command_name: "rg", available: Boolean(rgPath), path: rgPath },
      pg_isready: { command_name: "pg_isready", available: Boolean(pgIsReadyPath), path: pgIsReadyPath },
    },
    postgresql: {
      reachable: Boolean(pgIsReadyPath) && pgReachability.status === 0,
      detail: pgReachability.stderr || pgReachability.stdout || "PostgreSQL did not confirm readiness on localhost:5432.",
    },
    artifacts: {
      coo_tsx_shim: { path: cooTsxShimPath, exists: pathExists(cooTsxShimPath) },
      coo_dist: { path: cooDistPath, exists: pathExists(cooDistPath) },
      memory_engine_dist: { path: memoryEngineDistPath, exists: pathExists(memoryEngineDistPath) },
      mcp_sdk_client: { path: mcpSdkClientPath, exists: pathExists(mcpSdkClientPath) },
    },
    install_state: {
      path: installStateFile,
      exists: Boolean(installState),
      last_success_at: installState?.completed_at ?? installState?.updated_at ?? null,
    },
    recommended_commands: recommendedCommands(hostOs),
  };

  report.checks = buildChecks({
    hostOs,
    bash: {
      path: bashPath,
      working: bashWorking,
    },
    commands: report.commands,
    artifacts: report.artifacts,
    install_state: report.install_state,
    recommended_commands: report.recommended_commands,
    launch_mode: launchMode,
    postgresql: report.postgresql,
  });
  report.overall_status = determineOverallStatus(report.checks);
  report.recommended_next_action = recommendedNextAction(report.overall_status, report.recommended_commands);

  return report;
}

export function renderRuntimePreflightHuman(report) {
  const lines = ["ADF runtime preflight", ""];

  for (const check of report.checks) {
    const prefix = check.status === "pass" ? "[PASS]" : check.status === "warn" ? "[WARN]" : "[FAIL]";
    lines.push(`${prefix} ${check.name}`);
    lines.push(`  ${check.detail}`);
    if (check.fix) {
      lines.push(`  Fix: ${check.fix}`);
    }
  }

  lines.push("", "Recommended commands");
  lines.push(`- runtime preflight: ${report.recommended_commands.runtime_preflight}`);
  lines.push(`- install/bootstrap: ${report.recommended_commands.install}`);
  lines.push(`- doctor: ${report.recommended_commands.doctor}`);
  lines.push(`- launch: ${report.recommended_commands.launch}`);
  lines.push("", `Next action: ${report.recommended_next_action}`);

  return lines.join("\n");
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = args.values.get("repo-root") ?? join(__dirname, "..");
  const launchMode = args.values.get("launch-mode") ?? "tsx-direct";
  const json = args.flags.has("json");
  const assertOnly = args.flags.has("assert-only");

  const report = buildRuntimePreflightReport({
    repoRoot,
    launchMode,
  });

  if (assertOnly) {
    if (report.overall_status === "fail") {
      console.error(renderRuntimePreflightHuman(report));
      process.exit(1);
    }
    process.exit(0);
  }

  if (json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(renderRuntimePreflightHuman(report));
  }

  process.exit(report.overall_status === "fail" ? 1 : 0);
}

if (process.argv[1] && resolve(process.argv[1]) === __filename) {
  main();
}
