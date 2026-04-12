#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  fail,
  normalizeProjectRoot,
  normalizeSlashes,
  parseArgs,
  pathExists,
  printJson,
  requiredArg
} from "../../governed-feature-runtime.mjs";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const SCRIPT_DIR = dirname(SCRIPT_PATH);
const HELPER_PATH = join(SCRIPT_DIR, "cto-helper.mjs");
const ROLE_CONTRACT_PATH = join(dirname(SCRIPT_DIR), "references", "role-contract.xml");

main().catch((error) => {
  fail(error instanceof Error ? error.stack ?? error.message : String(error));
});

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const prompt = await resolvePrompt(args);
  const projectRoot = await resolveRepoRoot(args.values["project-root"] ?? process.cwd());
  const route = detectRoute(prompt);

  if (route.answer_mode === "direct") {
    const helperOutput = runHelper(route.helper_action, projectRoot, route.helper_args);
    const finalAnswer = helperOutput?.ceo_default_response?.text;
    if (!finalAnswer) {
      fail("Helper did not return ceo_default_response.text.");
    }

    const payload = {
      command: "govern",
      supported: true,
      project_root: normalizeSlashes(projectRoot),
      prompt,
      route: route.name,
      answer_mode: "direct",
      final_answer: finalAnswer,
      helper_output: helperOutput
    };
    await emitResult(payload, args);
    return;
  }

  const [helperOutput, roleContract] = await Promise.all([
    Promise.resolve(runHelper(route.helper_action, projectRoot, route.helper_args)),
    readFile(ROLE_CONTRACT_PATH, "utf8")
  ]);

  const promptPacket = buildPromptPacket({
    prompt,
    route,
    helperOutput,
    roleContract
  });

  const payload = {
    command: "govern",
    supported: true,
    project_root: normalizeSlashes(projectRoot),
    prompt,
    route: route.name,
    answer_mode: "packet",
    prompt_packet: promptPacket,
    helper_output: helperOutput
  };
  await emitResult(payload, args);
}

async function resolveRepoRoot(inputPath) {
  let current = resolve(inputPath);

  while (true) {
    const hasAgents = await pathExists(join(current, "AGENTS.md"));
    const hasV2 = await pathExists(join(current, "adf-v2"));
    const hasSkills = await pathExists(join(current, "skills", "manifest.json"));
    if (hasAgents && hasV2 && hasSkills) {
      return normalizeProjectRoot(current);
    }

    const parent = dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }

  fail(`Unable to resolve the ADF repo root from '${inputPath}'.`);
}

async function resolvePrompt(args) {
  const promptFile = args.values["prompt-file"];
  const inlinePrompt = args.values.prompt;

  if (promptFile && inlinePrompt) {
    fail("Use either --prompt or --prompt-file, not both.");
  }

  if (promptFile) {
    const promptText = await readFile(resolve(promptFile), "utf8");
    if (!String(promptText).trim()) {
      fail(`Prompt file '${promptFile}' is empty.`);
    }
    return String(promptText).trim();
  }

  return requiredArg(args, "prompt");
}

async function emitResult(payload, args) {
  const outputFile = args.values["output-file"];
  if (outputFile) {
    await writeFile(resolve(outputFile), JSON.stringify(payload, null, 2) + "\n", "utf8");
  }
  printJson(payload);
}

function detectRoute(prompt) {
  const normalized = String(prompt).toLowerCase();

  if (normalized.includes("current status") && normalized.includes("v2")) {
    return {
      name: "status",
      helper_action: "status",
      helper_args: {},
      answer_mode: "direct"
    };
  }

  if (
    normalized.includes("implementation readiness")
    || normalized.includes("ready to implement")
    || normalized.includes("before implementation starts")
    || normalized.includes("implementation can begin")
  ) {
    return {
      name: "readiness",
      helper_action: "readiness",
      helper_args: {},
      answer_mode: "direct"
    };
  }

  if (
    normalized.includes("what is missing")
    || normalized.includes("what's missing")
    || normalized.includes("what still missing")
    || normalized.includes("what is still missing")
    || normalized.includes("gaps remain")
    || normalized.includes("still missing before implementation")
  ) {
    return {
      name: "gaps",
      helper_action: "gaps",
      helper_args: { limit: "5" },
      answer_mode: "direct"
    };
  }

  return {
    name: "guided-cto",
    helper_action: "context",
    helper_args: {},
    answer_mode: "packet",
    workflow_mode: detectWorkflowMode(normalized)
  };
}

function detectWorkflowMode(normalizedPrompt) {
  if (
    normalizedPrompt.includes("freeze")
    || normalizedPrompt.includes("what needs to be decided")
    || normalizedPrompt.includes("still needs to be decided")
    || normalizedPrompt.includes("clarify")
    || normalizedPrompt.includes("missing before")
  ) {
    return "clarification-loop";
  }

  if (
    normalizedPrompt.includes("status")
    || normalizedPrompt.includes("state")
    || normalizedPrompt.includes("where are we")
  ) {
    return "executive-status";
  }

  if (
    normalizedPrompt.includes("ready")
    || normalizedPrompt.includes("readiness")
  ) {
    return "readiness-check";
  }

  return "executive-guidance";
}

function runHelper(action, projectRoot, helperArgs = {}) {
  const cliArgs = [HELPER_PATH, action, "--project-root", projectRoot];
  for (const [key, value] of Object.entries(helperArgs)) {
    cliArgs.push(`--${key}`, String(value));
  }

  const result = spawnSync(process.execPath, cliArgs, {
    cwd: projectRoot,
    encoding: "utf8",
    windowsHide: true,
    timeout: 30000
  });

  if (result.status !== 0) {
    throw new Error(result.stderr?.trim() || `cto-helper exited ${result.status}`);
  }

  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    throw new Error(`Failed to parse cto-helper JSON output: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function buildPromptPacket(input) {
  const nextStep = input.helperOutput.response_basis?.next_step
    ?? input.helperOutput.ceo_default_response?.lines?.at(-1)
    ?? "";

  return {
    contract_version: 2,
    user_request: input.prompt,
    route: input.route.name,
    workflow_mode: input.route.workflow_mode ?? "executive-guidance",
    answer_goal: "Give the CEO the minimum truthful information needed to reach the next correct decision.",
    role_contract: input.roleContract.trim(),
    response_contract: {
      audience: "CEO",
      style: ["meaning-first", "brief", "decision-shaped", "action-driving"],
      must_do: [
        "answer from the prompt packet rather than raw repo inspection",
        "stay at the highest relevant abstraction level",
        "keep the CEO at high-level behavior, contract, boundary, and governing-intent decisions",
        "derive lower-layer artifacts below that boundary instead of pushing them back upward",
        "keep broader work, current task, and next step aligned to the same packet truth",
        "identify the fundamental next question when work is still open",
        "push the work forward with the next move when possible",
        "preserve draft vs frozen vs open vs stubbed truth"
      ],
      must_not_do: [
        "do not dump file paths, filenames, branch state, or repo audits unless proof was requested",
        "do not widen into raw repo narration when the packet already contains sufficient context",
        "do not treat a local issue as the whole frame",
        "do not stop at recap without an explicit next step and recommendation"
      ]
    },
    context_layers: input.helperOutput.context_layers ?? {},
    response_basis: input.helperOutput.response_basis ?? null,
    suggested_opening: input.helperOutput.ceo_default_response?.lines?.[0] ?? "",
    suggested_next_move: nextStep,
    fundamental_next_question: input.helperOutput.response_basis?.next_question ?? "",
    recommendation: input.helperOutput.response_basis?.recommendation ?? "",
    stubs: [
      "Layer 3 durable issue-stack storage is still a stub in this reference implementation.",
      "Broader CTO route coverage beyond the current governor set is intentionally not complete yet."
    ]
  };
}
