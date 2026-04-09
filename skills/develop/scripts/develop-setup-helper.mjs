#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  nowIso,
  normalizeProjectRoot,
  normalizeSlashes,
  parseArgs,
  printJson,
  readJsonIfExists,
  requiredArg,
  writeJsonAtomic
} from "../../governed-feature-runtime.mjs";

const DEFAULT_MODELS = {
  implementor_model: "gpt-5.3-codex-spark",
  implementor_effort: "high",
  auditor_model: "gpt-5.4",
  auditor_effort: "high",
  reviewer_model: "gpt-5.4",
  reviewer_effort: "high",
  max_review_cycles: 5
};

function probeCommand(command, args = ["--version"]) {
  try {
    const result = spawnSync(command, args, {
      encoding: "utf8",
      windowsHide: true,
      timeout: 5000
    });
    return {
      available: result.status === 0,
      detail: (result.stdout || result.stderr || "").trim() || null
    };
  } catch {
    return {
      available: false,
      detail: null
    };
  }
}

function buildSetup(projectRoot) {
  return {
    schema_version: 1,
    project_root: projectRoot,
    created_at: nowIso(),
    llm_tools: {
      codex: probeCommand("codex"),
      claude: probeCommand("claude"),
      gemini: probeCommand("gemini")
    },
    defaults: DEFAULT_MODELS
  };
}

export async function ensureSetup({ projectRoot }) {
  const normalizedRoot = normalizeProjectRoot(projectRoot);
  const setupPath = join(normalizedRoot, ".codex", "develop", "setup.json");
  const existing = await readJsonIfExists(setupPath, null);
  if (existing && existing.schema_version === 1) {
    return {
      setupPath,
      setup: existing
    };
  }
  const setup = buildSetup(normalizedRoot);
  await writeJsonAtomic(setupPath, setup);
  return {
    setupPath,
    setup
  };
}

export function buildSetupOutput({ setupPath, setup, command = "write-setup" }) {
  return {
    command,
    setup_path: setupPath,
    setup
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const command = args.positionals[0] ?? "write-setup";
  const projectRoot = normalizeProjectRoot(requiredArg(args, "project-root"));
  const { setupPath, setup } = await ensureSetup({ projectRoot });
  printJson(buildSetupOutput({ command, setupPath, setup }));
}

const isDirectExecution = process.argv[1]
  && normalizeSlashes(process.argv[1]) === normalizeSlashes(fileURLToPath(import.meta.url));

if (isDirectExecution) {
  await main();
}
