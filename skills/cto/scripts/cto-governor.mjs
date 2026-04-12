#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  fail,
  isFilled,
  normalizeProjectRoot,
  normalizeSlashes,
  parseArgs,
  pathExists,
  printJson,
  requiredArg
} from "../../governed-feature-runtime.mjs";
import { loadMissionFoundationContext, renderContextPayload, renderGapPayload, renderHealthPayload, renderReadinessPayload, renderStatusPayload } from "./cto-helper.mjs";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const SCRIPT_DIR = dirname(SCRIPT_PATH);
const ROLE_CONTRACT_PATH = join(dirname(SCRIPT_DIR), "references", "role-contract.xml");
const IS_MAIN = process.argv[1] ? resolve(process.argv[1]) === SCRIPT_PATH : false;

if (IS_MAIN) {
  main().catch((error) => {
    fail(error instanceof Error ? error.stack ?? error.message : String(error));
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  await governPromptRequest({
    promptFile: args.values["prompt-file"],
    prompt: args.values.prompt,
    outputFile: args.values["output-file"],
    projectRoot: args.values["project-root"] ?? process.cwd()
  });
}

export async function governPromptRequest(input) {
  const prompt = await resolvePrompt(input);
  const projectRoot = await resolveRepoRoot(input.projectRoot ?? process.cwd());
  const route = detectRoute(prompt);
  const helperOutput = await runHelper(route.helper_action, projectRoot, route.helper_args);

  if (route.answer_mode === "direct") {
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
    await emitResult(payload, input.outputFile);
    return payload;
  }

  const roleContract = await readFile(ROLE_CONTRACT_PATH, "utf8");
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
  await emitResult(payload, input.outputFile);
  return payload;
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

async function resolvePrompt(input) {
  const promptFile = input.promptFile;
  const inlinePrompt = input.prompt;

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

  if (!isFilled(inlinePrompt)) {
    fail("Missing required argument --prompt.");
  }

  return String(inlinePrompt).trim();
}

async function emitResult(payload, outputFile) {
  if (outputFile) {
    await writeFile(resolve(outputFile), JSON.stringify(payload, null, 2) + "\n", "utf8");
  }
  printJson(payload);
}

function detectRoute(prompt) {
  const normalized = String(prompt).toLowerCase();

  if (
    normalized.includes("v2")
    && (
      normalized.includes("current status")
      || normalized.includes("next step")
      || normalized.includes("what should we do next")
      || normalized.includes("where are we")
    )
  ) {
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

  if (
    (normalized.includes("problems running") && normalized.includes("$cto"))
    || (normalized.includes("problems running cto"))
    || (normalized.includes("encounter") && normalized.includes("$cto"))
    || (normalized.includes("encounter") && normalized.includes("cto"))
    || (normalized.includes("avoid in the future") && normalized.includes("$cto"))
    || (normalized.includes("avoid in the future") && normalized.includes("cto"))
    || (normalized.includes("improve") && normalized.includes("$cto"))
  ) {
    return {
      name: "health",
      helper_action: "health",
      helper_args: {},
      answer_mode: "direct"
    };
  }

  return {
    name: "guided-cto",
    helper_action: "context",
    helper_args: {},
    answer_mode: "packet",
    workflow_mode: detectWorkflowMode(normalized),
    governance_mode: detectGovernanceMode(normalized),
    batch_requested: detectBatchRequested(normalized)
  };
}

function detectWorkflowMode(normalizedPrompt) {
  if (
    normalizedPrompt.includes("define ")
    || normalizedPrompt.includes("what needs to be decided")
    || normalizedPrompt.includes("what still needs to be decided")
    || normalizedPrompt.includes("freeze")
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
    || normalizedPrompt.includes("next step")
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

function detectGovernanceMode(normalizedPrompt) {
  if (
    normalizedPrompt.includes("review/freeze-read")
    || normalizedPrompt.includes("freeze-read")
    || normalizedPrompt.includes("review this draft")
    || normalizedPrompt.includes("review the draft")
    || normalizedPrompt.includes("is this ready to freeze")
  ) {
    return "review-freeze-read";
  }

  if (
    normalizedPrompt.includes("approved to draft")
    || normalizedPrompt.includes("i approve drafting")
    || normalizedPrompt.includes("go ahead and draft")
    || normalizedPrompt.includes("go ahead and write")
    || normalizedPrompt.includes("write the draft")
    || normalizedPrompt.includes("create the draft")
    || normalizedPrompt.includes("draft the document")
    || normalizedPrompt.includes("draft it")
    || normalizedPrompt.includes("prepare the draft")
  ) {
    return "draft-after-approval";
  }

  return "requirements-discussion";
}

function detectBatchRequested(normalizedPrompt) {
  return (
    normalizedPrompt.includes("what still needs to be decided")
    || normalizedPrompt.includes("what needs to be decided")
    || normalizedPrompt.includes("what is missing")
    || normalizedPrompt.includes("what's missing")
    || normalizedPrompt.includes("gaps")
    || normalizedPrompt.includes("list")
    || normalizedPrompt.includes("batch")
  );
}

async function runHelper(action, projectRoot, helperArgs = {}) {
  const context = await loadMissionFoundationContext(projectRoot);
  if (action === "status") {
    return renderStatusPayload(context);
  }
  if (action === "readiness") {
    return renderReadinessPayload(context);
  }
  if (action === "gaps") {
    return renderGapPayload(context, {
      limit: parseHelperLimit(helperArgs.limit) ?? 10
    });
  }
  if (action === "context") {
    return renderContextPayload(context);
  }
  if (action === "health") {
    return renderHealthPayload(context, projectRoot);
  }
  fail(`Unknown helper action '${action}'.`);
}

function parseHelperLimit(value) {
  if (!isFilled(value)) {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    fail("--limit must be a positive integer.");
  }
  return parsed;
}

function buildPromptPacket(input) {
  const nextStep = input.helperOutput.response_basis?.next_step
    ?? input.helperOutput.ceo_default_response?.lines?.at(-1)
    ?? "";
  const governanceState = buildGovernanceState(input.route);
  const answerBlueprint = buildAnswerBlueprint({
    workflowMode: input.route.workflow_mode ?? "executive-guidance",
    governanceMode: governanceState.mode,
    batchRequested: input.route.batch_requested === true
  });

  return {
    contract_version: 3,
    user_request: input.prompt,
    route: input.route.name,
    workflow_mode: input.route.workflow_mode ?? "executive-guidance",
    governance_mode: governanceState.mode,
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
        "hold the restart frame clearly as broader work, current task, next step, and later or open items",
        "identify the fundamental next question when work is still open",
        "push the work forward with the next move when possible",
        "preserve draft vs frozen vs open vs stubbed truth",
        "treat no explicit approval as discussion, not freeze",
        "stay in requirements mode unless explicit approval to draft is present",
        "when the space is still open, give one recommended next step or one bounded recommendation batch of up to 5 items",
        "park out-of-scope issues in later or open items instead of silently absorbing them into the current task",
        "if a draft is created after approval, present it as a draft and ask for review or freeze-read before treating it as accepted progress"
      ],
      must_not_do: [
        "do not dump file paths, filenames, branch state, or repo audits unless proof was requested",
        "do not widen into raw repo narration when the packet already contains sufficient context",
        "do not treat a local issue as the whole frame",
        "do not stop at recap without an explicit next step and recommendation",
        "do not let filename, document packaging, or future-doc naming replace the real current task",
        "do not draft a new artifact or materially rewrite existing artifacts when the approval gate is still closed",
        "do not update handoff, current-state, open-items, or similar repo truth as accepted progress before explicit review and approval",
        "do not present inferred direction as if the CEO already approved it"
      ]
    },
    approval_gate: governanceState,
    decision_batching: {
      default_limit: 5,
      batch_requested: input.route.batch_requested === true,
      rule: "If several low-level choices are needed, present them in one executive batch of up to 5 items, each with recommendation plus approval or discussion request."
    },
    context_layers: input.helperOutput.context_layers ?? {},
    response_basis: input.helperOutput.response_basis ?? null,
    later_open_items: input.helperOutput.response_basis?.later_open_items ?? null,
    answer_blueprint: answerBlueprint,
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

function buildGovernanceState(route) {
  const mode = route.governance_mode ?? "requirements-discussion";
  const draftingAllowed = mode === "draft-after-approval";
  const reviewRequested = mode === "review-freeze-read";

  return {
    mode,
    explicit_approval_detected_in_request: draftingAllowed,
    explicit_review_or_freeze_read_requested: reviewRequested,
    drafting_allowed_now: draftingAllowed,
    accepted_progress_update_allowed_now: false,
    rule: "No explicit approval means discussion.",
    review_rule: "After drafting, ask for review or freeze-read before treating the work as accepted progress.",
    allowed_now: draftingAllowed
      ? [
          "state the approved high-level framing you are drafting from",
          "produce a bounded draft or proposed wording",
          "mark it clearly as draft",
          "ask for review or freeze-read"
        ]
      : reviewRequested
        ? [
            "review the draft against the approved framing",
            "report the smallest blocking issues or confirm it is ready for freeze decision",
            "ask for explicit freeze approval or requested changes"
          ]
        : [
            "explain the real current task",
            "ask the next shaping question",
            "give a recommendation",
            "ask for approval or discussion",
            "park later issues explicitly"
          ],
    blocked_now: draftingAllowed
      ? [
          "do not present the draft as frozen or accepted",
          "do not advance repo truth as if review already happened"
        ]
      : reviewRequested
        ? [
            "do not silently mark the draft frozen without explicit approval",
            "do not widen review into unrelated future work"
          ]
        : [
            "do not create or materially update an artifact as if the framing were already approved",
            "do not update handoff, current-state, or open-items as accepted progress",
            "do not replace the current task with filename or packaging discussion"
          ]
  };
}

function buildAnswerBlueprint(input) {
  if (input.governanceMode === "draft-after-approval") {
    return {
      default_shape: [
        "Approved framing: one short line",
        "Proposed draft: short bounded content or wording",
        "Review request: ask for review or freeze-read"
      ],
      default_count_limit: 3
    };
  }

  if (input.governanceMode === "review-freeze-read") {
    return {
      default_shape: [
        "Current task: one short line",
        "Review result: ready or not ready",
        "Next step: one recommended approval or change request"
      ],
      default_count_limit: 3
    };
  }

  if (input.batchRequested || input.workflowMode === "clarification-loop") {
    return {
      default_shape: [
        "Current task: one short line",
        "Decision batch: up to 5 items, each with recommendation",
        "Approval ask: ask the CEO to approve or discuss this batch"
      ],
      default_count_limit: 5
    };
  }

  return {
    default_shape: [
      "Current task: one short line",
      "Next decision: one short line",
      "Recommendation: one short line",
      "Approval ask: approve or discuss"
    ],
    default_count_limit: 4
  };
}
