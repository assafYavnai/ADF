#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { realpath } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  fail,
  normalizeProjectRoot,
  normalizeSlashes,
  parseArgs,
  pathExists,
  printJson
} from "../../governed-feature-runtime.mjs";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const SCRIPT_DIR = dirname(SCRIPT_PATH);
const SKILL_DIR = dirname(SCRIPT_DIR);
const CODEX_HOME = process.env.CODEX_HOME
  ? resolve(process.env.CODEX_HOME)
  : resolve(process.env.USERPROFILE ?? process.env.HOME ?? ".", ".codex");
const IS_MAIN = process.argv[1] ? resolve(process.argv[1]) === SCRIPT_PATH : false;

if (IS_MAIN) {
  main().catch((error) => {
    fail(error instanceof Error ? error.stack ?? error.message : String(error));
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const projectRoot = normalizeProjectRoot(resolve(args.values["project-root"] ?? process.cwd()));
  const runtimePreflightMode = String(args.values["runtime-preflight"] ?? "deferred").toLowerCase();
  const result = await runCtoSelfCheck({
    projectRoot,
    runtimePreflightMode
  });
  printJson(result);
}

export async function runCtoSelfCheck(input = {}) {
  const projectRoot = normalizeProjectRoot(resolve(input.projectRoot ?? process.cwd()));
  const installedSkillDir = join(CODEX_HOME, "skills", "cto");
  const missionFoundationRoot = join(projectRoot, "adf-v2", "00-mission-foundation");
  const repoSkillDir = join(projectRoot, "skills", "cto");
  const repoLauncher = join(repoSkillDir, "scripts", "cto-launcher.mjs");
  const installedLauncher = join(installedSkillDir, "scripts", "cto-launcher.mjs");
  const workingModePath = join(projectRoot, "adf-v2", "CTO-CEO-WORKING-MODE.md");
  const deliveryPromotedPath = join(missionFoundationRoot, "DELIVERY-COMPLETION-DEFINITION.md");
  const deliveryDraftPath = join(missionFoundationRoot, "context", "artifacts", "DELIVERY-COMPLETION-DEFINITION.md");
  const runtimePreflightMode = String(input.runtimePreflightMode ?? "deferred").toLowerCase();
  const preflight = runtimePreflightMode === "run"
    ? runRuntimePreflight(projectRoot)
    : {
      invoked: false,
      mode: "deferred",
      command: "adf.cmd --runtime-preflight --json",
      exit_status: null,
      valid_json: null,
      overall_status: null,
      detail: "Deferred by cto-self-check so governed `$CTO` health does not depend on nested launcher preflight spawning."
    };

  const checks = await Promise.all([
    makeCheck("repo_skill_dir", repoSkillDir),
    makeCheck("repo_launcher", repoLauncher),
    makeCheck("installed_skill_dir", installedSkillDir),
    makeCheck("installed_launcher", installedLauncher),
    makeCheck("working_mode_doc", workingModePath),
    makeCheck("delivery_definition_promoted", deliveryPromotedPath),
    makeCheck("delivery_definition_draft", deliveryDraftPath)
  ]);

  const checkMap = Object.fromEntries(checks.map((item) => [item.name, item]));
  const deliveryResolution = resolveDeliveryState(checkMap);
  const skillWiring = await resolveSkillWiring(repoSkillDir, installedSkillDir);
  const warnings = [];

  if (!checkMap.repo_skill_dir.exists || !checkMap.repo_launcher.exists) {
    warnings.push("Repo skill source is incomplete; edit or reinstalling from this branch may fail.");
  }
  if (!checkMap.installed_skill_dir.exists || !checkMap.installed_launcher.exists) {
    warnings.push("Installed Codex skill copy is missing; `$CTO` autocomplete/runtime may not use this branch until the skill is installed.");
  }
  if (skillWiring.state === "separate-copy") {
    warnings.push("Installed Codex skill is a separate copy instead of a thin pointer to the repo skill.");
  }
  if (!checkMap.working_mode_doc.exists) {
    warnings.push("CTO-CEO-WORKING-MODE.md is missing, so the skill source set is incomplete.");
  }
  if (deliveryResolution.state === "missing") {
    warnings.push("DELIVERY-COMPLETION-DEFINITION.md is missing in both promoted and draft-artifact locations.");
  }
  if (runtimePreflightMode === "run" && !preflight.valid_json) {
    warnings.push("Runtime preflight did not return usable JSON through the repo launcher.");
  }

  return {
    command: "cto-self-check",
    project_root: normalizeSlashes(projectRoot),
    codex_home: normalizeSlashes(CODEX_HOME),
    checks,
    skill_wiring: skillWiring,
    delivery_definition_resolution: deliveryResolution,
    runtime_preflight: preflight,
    ready: warnings.length === 0,
    warnings,
    recommendation: warnings.length === 0
      ? "Skill source and runtime locations look consistent enough for governed `$CTO` use."
      : "Resolve the warnings before relying on `$CTO` for a fresh governed run."
  };
}

async function makeCheck(name, path) {
  return {
    name,
    path: normalizeSlashes(path),
    exists: await pathExists(path)
  };
}

function resolveDeliveryState(checkMap) {
  if (checkMap.delivery_definition_promoted.exists) {
    return {
      state: "promoted",
      path: checkMap.delivery_definition_promoted.path
    };
  }
  if (checkMap.delivery_definition_draft.exists) {
    return {
      state: "draft-artifact",
      path: checkMap.delivery_definition_draft.path
    };
  }
  return {
    state: "missing",
    path: null
  };
}

async function resolveSkillWiring(repoSkillDir, installedSkillDir) {
  if (!existsSync(repoSkillDir) || !existsSync(installedSkillDir)) {
    return {
      state: "unresolved",
      repo_realpath: null,
      installed_realpath: null
    };
  }

  const [repoRealPath, installedRealPath] = await Promise.all([
    realpath(repoSkillDir),
    realpath(installedSkillDir)
  ]);

  return {
    state: normalizeSlashes(repoRealPath) === normalizeSlashes(installedRealPath) ? "pointer" : "separate-copy",
    repo_realpath: normalizeSlashes(repoRealPath),
    installed_realpath: normalizeSlashes(installedRealPath)
  };
}

function runRuntimePreflight(projectRoot) {
  const adfCmdPath = join(projectRoot, "adf.cmd");
  const adfShPath = join(projectRoot, "adf.sh");

  if (process.platform === "win32" && existsSync(adfCmdPath)) {
    const commandText = `"${normalizeSlashes(adfCmdPath)}" --runtime-preflight --json`;
    const result = spawnSync("cmd.exe", ["/d", "/c", adfCmdPath, "--runtime-preflight", "--json"], {
      cwd: projectRoot,
      encoding: "utf8",
      windowsHide: true,
      timeout: 60000
    });
    return normalizePreflightResult(commandText, result);
  }

  if (existsSync(adfShPath)) {
    const commandText = `${normalizeSlashes(adfShPath)} --runtime-preflight --json`;
    const result = spawnSync("bash", [adfShPath, "--runtime-preflight", "--json"], {
      cwd: projectRoot,
      encoding: "utf8",
      windowsHide: true,
      timeout: 60000
    });
    return normalizePreflightResult(commandText, result);
  }

  return {
    invoked: false,
    command: null,
    exit_status: null,
    valid_json: false,
    overall_status: null,
    detail: "No supported ADF launcher was found for runtime preflight."
  };
}

function normalizePreflightResult(commandText, result) {
  const stdout = String(result.stdout ?? "").trim();
  const stderr = String(result.stderr ?? "").trim();

  try {
    const parsed = JSON.parse(stdout);
    return {
      invoked: true,
      mode: "run",
      command: commandText,
      exit_status: result.status,
      valid_json: true,
      overall_status: parsed.overall_status ?? null,
      recommended_next_action: parsed.recommended_next_action ?? null,
      detail: stderr || null
    };
  } catch {
    return {
      invoked: true,
      mode: "run",
      command: commandText,
      exit_status: result.status,
      valid_json: false,
      overall_status: null,
      detail: stderr || stdout || "Runtime preflight did not emit JSON."
    };
  }
}
