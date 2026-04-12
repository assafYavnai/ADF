#!/usr/bin/env node

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

main().catch((error) => {
  fail(error instanceof Error ? error.stack ?? error.message : String(error));
});

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const projectRoot = normalizeProjectRoot(resolve(args.values["project-root"] ?? process.cwd()));
  const installedSkillDir = join(CODEX_HOME, "skills", "cto");
  const missionFoundationRoot = join(projectRoot, "adf-v2", "00-mission-foundation");
  const repoSkillDir = join(projectRoot, "skills", "cto");
  const repoLauncher = join(repoSkillDir, "scripts", "cto-launcher.mjs");
  const installedLauncher = join(installedSkillDir, "scripts", "cto-launcher.mjs");
  const workingModePath = join(projectRoot, "adf-v2", "CTO-CEO-WORKING-MODE.md");
  const deliveryPromotedPath = join(missionFoundationRoot, "DELIVERY-COMPLETION-DEFINITION.md");
  const deliveryDraftPath = join(missionFoundationRoot, "context", "artifacts", "DELIVERY-COMPLETION-DEFINITION.md");

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
  const warnings = [];

  if (!checkMap.repo_skill_dir.exists || !checkMap.repo_launcher.exists) {
    warnings.push("Repo skill source is incomplete; edit or reinstalling from this branch may fail.");
  }
  if (!checkMap.installed_skill_dir.exists || !checkMap.installed_launcher.exists) {
    warnings.push("Installed Codex skill copy is missing; `$CTO` autocomplete/runtime may not use this branch until the skill is installed.");
  }
  if (!checkMap.working_mode_doc.exists) {
    warnings.push("CTO-CEO-WORKING-MODE.md is missing, so the skill source set is incomplete.");
  }
  if (deliveryResolution.state === "missing") {
    warnings.push("DELIVERY-COMPLETION-DEFINITION.md is missing in both promoted and draft-artifact locations.");
  }

  printJson({
    command: "cto-self-check",
    project_root: normalizeSlashes(projectRoot),
    codex_home: normalizeSlashes(CODEX_HOME),
    checks,
    delivery_definition_resolution: deliveryResolution,
    ready: warnings.length === 0,
    warnings,
    recommendation: warnings.length === 0
      ? "Skill source and runtime locations look consistent enough for governed `$CTO` use."
      : "Resolve the warnings before relying on `$CTO` for a fresh governed run."
  });
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
