#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = resolve(dirname(__filename), "..");
const adfScript = join(repoRoot, "adf.sh");

function candidateBashPaths() {
  const candidates = [];

  if (process.env.SHELL) {
    candidates.push(process.env.SHELL);
  }

  if (process.platform === "win32") {
    candidates.push(
      "C:\\Program Files\\msys64\\usr\\bin\\bash.exe",
      "C:\\Program Files\\Git\\bin\\bash.exe",
      "C:\\Program Files\\Git\\usr\\bin\\bash.exe",
    );
  } else {
    candidates.push("/bin/bash", "/usr/bin/bash");
  }

  return candidates.filter((entry, index, array) => entry && array.indexOf(entry) === index);
}

function isApprovedBashPath(candidate) {
  if (!candidate) {
    return false;
  }

  if (process.platform === "win32") {
    const normalized = candidate.toLowerCase();
    return basename(candidate).toLowerCase() === "bash.exe" &&
      (normalized.includes("\\msys64\\") || normalized.includes("\\git\\"));
  }

  return basename(candidate) === "bash";
}

function locateBash() {
  for (const candidate of candidateBashPaths()) {
    if (existsSync(candidate) && isApprovedBashPath(candidate)) {
      return candidate;
    }
  }

  const whereResult = spawnSync(process.platform === "win32" ? "where" : "which", [process.platform === "win32" ? "bash.exe" : "bash"], {
    encoding: "utf8",
  });
  if (whereResult.status === 0) {
    const discovered = whereResult.stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line && isApprovedBashPath(line));
    if (discovered) {
      return discovered;
    }
  }

  return null;
}

const bashPath = locateBash();
if (!bashPath) {
  console.error("FATAL: ADF requires a working approved bash runtime. Install or expose MSYS2 or Git Bash and retry.");
  process.exit(1);
}

const versionCheck = spawnSync(bashPath, ["--version"], { encoding: "utf8" });
if (versionCheck.status !== 0) {
  console.error(`FATAL: bash is present but not runnable via "${bashPath}".`);
  console.error("       Fix the bash runtime and retry.");
  process.exit(versionCheck.status ?? 1);
}

const result = spawnSync(bashPath, [adfScript, ...process.argv.slice(2)], {
  stdio: "inherit",
});

process.exit(result.status ?? 1);
