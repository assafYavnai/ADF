#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  fail,
  isFilled,
  normalizeProjectRoot,
  normalizeSlashes,
  nowIso,
  parseArgs,
  pathExists,
  printJson,
  requiredArg
} from "../../governed-feature-runtime.mjs";

const HELPER_VERSION = 3;
const SCOPE = "adf-v2";
const SCRIPT_PATH = fileURLToPath(import.meta.url);
const SCRIPT_DIR = dirname(SCRIPT_PATH);
const SELF_CHECK_PATH = join(SCRIPT_DIR, "cto-self-check.mjs");
const DOC_MEANINGS = {
  "DELIVERY-COMPLETION-DEFINITION.md": "define what complete means at the delivery boundary",
  "TRUST-MODEL.md": "freeze the broader trust model",
  "SYSTEM-OBLIGATIONS.md": "define system obligations",
  "BOXED-COMPONENT-MODEL.md": "define the boxed component model",
  "ROLE-MODEL.md": "define the role model",
  "WORKFLOW-MODEL.md": "define the workflow model",
  "MISSION-STATEMENT.md": "define the mission foundation",
  "CTO-ROLE.md": "define the CTO role"
};
const FOUNDATION_OUTPUT_ORDER = [
  "DELIVERY-COMPLETION-DEFINITION.md",
  "SYSTEM-OBLIGATIONS.md",
  "BOXED-COMPONENT-MODEL.md",
  "ROLE-MODEL.md",
  "WORKFLOW-MODEL.md"
];

main().catch((error) => {
  fail(error instanceof Error ? error.stack ?? error.message : String(error));
});

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const command = resolveCommand(args);

  if (command === "help") {
    printJson(renderHelp());
    return;
  }

  const projectRoot = await resolveRepoRoot(args.values["project-root"] ?? process.cwd());
  const context = await loadMissionFoundationContext(projectRoot);

  if (command === "status") {
    printJson(renderStatusPayload(context));
    return;
  }

  if (command === "readiness") {
    printJson(renderReadinessPayload(context));
    return;
  }

  if (command === "gaps") {
    printJson(renderGapPayload(context, {
      limit: parseOptionalPositiveInteger(args.values.limit) ?? 10
    }));
    return;
  }

  if (command === "context") {
    printJson(renderContextPayload(context));
    return;
  }

  if (command === "health") {
    printJson(renderHealthPayload(context, projectRoot));
    return;
  }

  fail(`Unknown command '${command}'. Use help, status, readiness, gaps, context, or health.`);
}

function resolveCommand(args) {
  if (isFilled(args.positionals[0])) {
    return String(args.positionals[0]).toLowerCase();
  }
  if (isFilled(args.values.action)) {
    return String(args.values.action).toLowerCase();
  }
  return "help";
}

function renderHelp() {
  return {
    command: "help",
    helper_version: HELPER_VERSION,
    scope: SCOPE,
    purpose: "Gather deterministic ADF v2 mission-foundation context so $CTO answers from governed packets instead of raw repo improvisation.",
    supported_commands: ["help", "status", "readiness", "gaps", "context", "health"],
    default_routes: {
      status: "node skills/cto/scripts/cto-helper.mjs status [--project-root <repo>]",
      readiness: "node skills/cto/scripts/cto-helper.mjs readiness [--project-root <repo>]",
      gaps: "node skills/cto/scripts/cto-helper.mjs gaps [--project-root <repo>] [--limit <n>]",
      context: "node skills/cto/scripts/cto-helper.mjs context [--project-root <repo>]",
      health: "node skills/cto/scripts/cto-helper.mjs health [--project-root <repo>]"
    },
    notes: [
      "status returns the default CEO-facing three-layer status pack",
      "readiness returns implementation-readiness truth for the current checkpoint",
      "gaps returns unresolved active-task gaps in question plus recommendation form",
      "context returns the 4-layer CTO packet basis with explicit stubs where implementation is still undefined",
      "health returns deterministic `$CTO` runtime-health truth and next improvements"
    ]
  };
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

async function readOptionalText(filePath) {
  if (!(await pathExists(filePath))) {
    return null;
  }
  return readFile(filePath, "utf8");
}

async function loadMissionFoundationContext(projectRoot) {
  const startedAt = nowIso();
  const missionFoundationRoot = join(projectRoot, "adf-v2", "00-mission-foundation");
  const nextStepPath = join(missionFoundationRoot, "context", "NEXT-STEP-HANDOFF.md");
  const openItemsPath = join(missionFoundationRoot, "context", "OPEN-ITEMS.md");
  const deliveryCompletionLocation = await resolveLayerDocumentPath(missionFoundationRoot, "DELIVERY-COMPLETION-DEFINITION.md");
  const deliveryCompletionPath = deliveryCompletionLocation.path;
  const trustModelPath = join(missionFoundationRoot, "context", "artifacts", "TRUST-MODEL.md");
  const missionPath = join(missionFoundationRoot, "MISSION-STATEMENT.md");
  const ctoRolePath = join(projectRoot, "adf-v2", "CTO-ROLE.md");
  const ceoProtocolPath = join(projectRoot, "adf-v2", "CEO-AGENT-WORKING-PROTOCOL.md");
  const ctoArchitecturePath = join(missionFoundationRoot, "CTO-CONTEXT-ARCHITECTURE.md");
  const ctoCeoWorkingModePath = join(projectRoot, "adf-v2", "CTO-CEO-WORKING-MODE.md");

  const promotedOutputPaths = FOUNDATION_OUTPUT_ORDER.map((fileName) => ({
    file_name: fileName,
    path: join(missionFoundationRoot, fileName)
  }));

  const [
    nextStepText,
    openItemsText,
    deliveryCompletionText,
    trustModelText,
    missionText,
    ctoRoleText,
    ceoProtocolText,
    ctoArchitectureText
  ] = await Promise.all([
    readFile(nextStepPath, "utf8"),
    readFile(openItemsPath, "utf8"),
    readFile(deliveryCompletionPath, "utf8"),
    readFile(trustModelPath, "utf8"),
    readFile(missionPath, "utf8"),
    readFile(ctoRolePath, "utf8"),
    readFile(ceoProtocolPath, "utf8"),
    readFile(ctoArchitecturePath, "utf8")
  ]);
  const [ctoCeoWorkingModeText, promotedOutputChecks] = await Promise.all([
    readOptionalText(ctoCeoWorkingModePath),
    Promise.all(promotedOutputPaths.map(async (item) => ({
      ...item,
      exists: await pathExists(item.path)
    })))
  ]);

  const currentMainTask = extractSingleBulletAfterLabel(nextStepText, "Current main task");
  const immediateQuestion = extractSingleBulletAfterLabel(nextStepText, "Immediate next unresolved question");
  const afterThatTasks = extractBulletsAfterPhrase(nextStepText, "Then continue with");
  const currentTaskDocName = extractFirstMarkdownCode(currentMainTask) ?? extractFileName(currentMainTask);
  const openItems = parseOpenItems(openItemsText);
  const activeTaskItems = openItems["Current Active Task Open Items"] ?? [];
  const broaderTrustItems = openItems["Broader Trust-Model Open Items"] ?? [];
  const laterDocumentItems = openItems["Later-Document Open Items"] ?? [];
  const activeTaskStateCounts = summarizeStates(activeTaskItems);
  const activeTaskThemeList = summarizeActiveTaskThemes(activeTaskItems);
  const currentTaskMeaning = humanizeTask(currentMainTask);
  const currentTaskPurpose = extractFieldValue(deliveryCompletionText, "Purpose");
  const trustModelPurpose = extractFieldValue(trustModelText, "Purpose");
  const missionIdentity = extractParagraphAfterHeading(missionText, "## Identity");
  const phaseMission = extractParagraphAfterHeading(missionText, "## Phase 1 mission");
  const operatingRoles = extractBulletsFromSection(missionText, "## Core operating roles");
  void ctoRoleText;
  void ceoProtocolText;
  void ctoArchitectureText;
  void ctoCeoWorkingModeText;

  const promotedOutputs = promotedOutputChecks.filter((item) => item.exists).map((item) => item.file_name);
  const remainingFoundationOutputs = FOUNDATION_OUTPUT_ORDER.filter((fileName) => !promotedOutputs.includes(fileName));
  const sourceAlignment = buildSourceAlignment({
    currentTaskDocName,
    currentTaskMeaning,
    promotedOutputs,
    immediateQuestion
  });
  const nextQuestion = buildNextQuestion({
    current_task_meaning: currentTaskMeaning,
    current_task_doc_name: currentTaskDocName,
    immediate_next_question: immediateQuestion,
    current_task_items: activeTaskItems,
    source_alignment: sourceAlignment,
    remaining_foundation_outputs: remainingFoundationOutputs
  });
  const nextRecommendation = buildNextRecommendation({
    current_task_meaning: currentTaskMeaning,
    current_task_items: activeTaskItems,
    source_alignment: sourceAlignment,
    remaining_foundation_outputs: remainingFoundationOutputs
  });

  const broaderWorkLine = buildBroaderWorkLine({
    currentTaskMeaning,
    remainingFoundationOutputs,
    activeTaskTotal: activeTaskItems.length,
    broaderTrustTotal: broaderTrustItems.length,
    afterThatTasks,
    sourceAlignment
  });
  const currentTaskLine = buildCurrentTaskLine({
    currentTaskMeaning,
    activeTaskTotal: activeTaskItems.length,
    activeTaskOpen: activeTaskStateCounts.open ?? 0,
    activeTaskCarryIn: activeTaskStateCounts["frozen-upstream-needs-incorporation"] ?? 0,
    activeTaskThemes: activeTaskThemeList,
    sourceAlignment,
    remainingFoundationOutputs
  });
  const nextStepLine = buildNextStepLine({
    nextQuestion,
    nextRecommendation
  });

  return {
    helper_version: HELPER_VERSION,
    scope: SCOPE,
    project_root: normalizeSlashes(projectRoot),
    started_at: startedAt,
    completed_at: nowIso(),
    current_layer: "mission-foundation",
    current_phase_mode: "definition",
    mission_identity: missionIdentity,
    phase_mission: phaseMission,
    operating_roles: operatingRoles,
    current_main_task_raw: currentMainTask,
    current_task_doc_name: currentTaskDocName,
    current_task_meaning: currentTaskMeaning,
    current_task_purpose: currentTaskPurpose,
    immediate_next_question: immediateQuestion,
    after_that_tasks: afterThatTasks.map(humanizeTask),
    promoted_outputs: promotedOutputs.map(humanizeTask),
    remaining_foundation_outputs: remainingFoundationOutputs.map(humanizeTask),
    source_alignment: sourceAlignment,
    counts: {
      active_task_total: activeTaskItems.length,
      active_task_open: activeTaskStateCounts.open ?? 0,
      active_task_frozen_upstream_needs_incorporation: activeTaskStateCounts["frozen-upstream-needs-incorporation"] ?? 0,
      active_task_resolved: activeTaskStateCounts.resolved ?? 0,
      broader_trust_total: broaderTrustItems.length,
      later_document_total: laterDocumentItems.length
    },
    current_task_items: activeTaskItems,
    broader_trust_items: broaderTrustItems,
    later_document_items: laterDocumentItems,
    active_task_theme_list: activeTaskThemeList,
    trust_model_purpose: trustModelPurpose,
    derived_lines: {
      broader_work: broaderWorkLine,
      current_task: currentTaskLine,
      next_step: nextStepLine
    },
    derived_actions: {
      next_question: nextQuestion,
      recommendation: nextRecommendation
    },
    source_context: {
      layer0_sources: [
        normalizeSlashes(ctoRolePath),
        normalizeSlashes(ceoProtocolPath),
        normalizeSlashes(ctoArchitecturePath),
        ...(ctoCeoWorkingModeText ? [normalizeSlashes(ctoCeoWorkingModePath)] : [])
      ],
      layer1_sources: [
        normalizeSlashes(missionPath),
        normalizeSlashes(nextStepPath)
      ],
      layer2_sources: [
        normalizeSlashes(nextStepPath),
        normalizeSlashes(openItemsPath),
        normalizeSlashes(deliveryCompletionPath)
      ],
      layer3_sources: [
        normalizeSlashes(ctoArchitecturePath)
      ]
    },
    resolved_paths: {
      delivery_completion_definition: {
        state: deliveryCompletionLocation.state,
        path: normalizeSlashes(deliveryCompletionLocation.path)
      }
    }
  };
}

function renderStatusPayload(context) {
  return {
    command: "status",
    helper_version: HELPER_VERSION,
    scope: SCOPE,
    project_root: context.project_root,
    status: context.derived_lines,
    ceo_default_response: {
      lines: [
        context.derived_lines.broader_work,
        context.derived_lines.current_task,
        context.derived_lines.next_step
      ],
      text: [
        context.derived_lines.broader_work,
        context.derived_lines.current_task,
        context.derived_lines.next_step
      ].join("\n")
    },
    context_summary: context
  };
}

function renderReadinessPayload(context) {
  const blockers = context.current_task_items
    .filter((item) => item.state !== "resolved" && item.state !== "moved")
    .slice(0, 4)
    .map((item) => buildGapQuestion(item));
  const readinessLine = "Implementation readiness: not ready. v2 is still in definition work, not build work.";
  const broaderWork = context.derived_lines.broader_work;
  const currentTask = context.derived_lines.current_task;

  return {
    command: "readiness",
    helper_version: HELPER_VERSION,
    scope: SCOPE,
    project_root: context.project_root,
    readiness: {
      ready: false,
      blockers,
      readiness_line: readinessLine,
      broader_work: broaderWork,
      current_task: currentTask,
      next_step: context.derived_lines.next_step,
      next_question: context.derived_actions.next_question,
      recommendation: context.derived_actions.recommendation
    },
    ceo_default_response: {
      lines: [readinessLine, broaderWork, currentTask, context.derived_lines.next_step],
      text: [readinessLine, broaderWork, currentTask, context.derived_lines.next_step].join("\n")
    },
    context_summary: context
  };
}

function renderGapPayload(context, options) {
  const activeGaps = context.current_task_items
    .filter((item) => item.state !== "resolved" && item.state !== "moved")
    .slice(0, options.limit)
    .map((item) => ({
      id: item.id,
      title: item.title,
      state: item.state,
      question: buildGapQuestion(item),
      recommendation: buildGapRecommendation(item)
    }));
  const nextMove = activeGaps[0] ?? null;
  const lines = [];
  if (activeGaps.length > 0) {
    lines.push(`Current task: ${activeGaps.length} unresolved gap${activeGaps.length === 1 ? "" : "s"} still block ${describeTaskAsNoun(context.current_task_meaning)}.`);
    if (nextMove) {
      lines.push(`Next step: ${nextMove.question}. Recommendation: ${nextMove.recommendation}.`);
    }
    for (let index = 0; index < activeGaps.length; index += 1) {
      const gap = activeGaps[index];
      lines.push(`${index + 1}. ${gap.question} Recommendation: ${gap.recommendation}.`);
    }
  } else {
    lines.push(`Current task: no unresolved gaps are currently listed for ${context.current_task_meaning}.`);
    lines.push(`Next step: confirm whether the active checkpoint should advance. Recommendation: save the next explicit checkpoint state before moving the work forward.`);
  }

  return {
    command: "gaps",
    helper_version: HELPER_VERSION,
    scope: SCOPE,
    project_root: context.project_root,
    gap_count: activeGaps.length,
    gaps: activeGaps,
    ceo_default_response: {
      lines,
      text: lines.join("\n")
    },
    context_summary: context
  };
}

function renderContextPayload(context) {
  const firstGap = context.current_task_items.find((item) => item.state !== "resolved" && item.state !== "moved") ?? null;
  const layer0 = {
    status: "defined",
    purpose: "governing role and rules for CEO-facing CTO behavior",
    source_docs: context.source_context.layer0_sources,
    core_obligations: [
      "protect the CEO boundary",
      "drive one gap at a time when requirements are still open",
      "give minimum information needed for the current decision",
      "save durable truth instead of leaving important state only in chat",
      "keep status, task, and next step aligned to the same checked source pass",
      "end substantive answers with the explicit next move and recommendation"
    ]
  };
  const layer1 = {
    status: "defined",
    purpose: "system context for the current ADF v2 checkpoint",
    mission_identity: context.mission_identity,
    phase_mission: context.phase_mission,
    operating_model: context.operating_roles,
    current_layer: context.current_layer,
    current_phase_mode: context.current_phase_mode,
    major_remaining_work: buildMajorRemainingWork({
      currentTaskMeaning: context.current_task_meaning,
      remainingFoundationOutputs: context.remaining_foundation_outputs,
      activeTaskTotal: context.counts.active_task_total,
      broaderTrustTotal: context.counts.broader_trust_total,
      afterThatTasks: context.after_that_tasks,
      sourceAlignment: context.source_alignment
    }),
    source_alignment: context.source_alignment,
    source_docs: context.source_context.layer1_sources
  };
  const layer2 = {
    status: "defined",
    purpose: "task context for the current active definition pass",
    current_task: context.current_task_meaning,
    current_task_purpose: context.current_task_purpose,
    open_item_counts: {
      total: context.counts.active_task_total,
      open: context.counts.active_task_open,
      carry_in_frozen_items: context.counts.active_task_frozen_upstream_needs_incorporation
    },
    open_item_themes: context.active_task_theme_list,
    current_focus_summary: context.derived_lines.current_task,
    next_question: context.derived_actions.next_question,
    recommendation: context.derived_actions.recommendation,
    leading_gap: firstGap ? {
      id: firstGap.id,
      title: firstGap.title,
      question: buildGapQuestion(firstGap),
      recommendation: buildGapRecommendation(firstGap)
    } : null,
    source_docs: context.source_context.layer2_sources
  };
  const layer3 = {
    status: "stub",
    purpose: "temporary issue stack for local dives that must pop back into the task and system frame",
    current_issue_stack: [],
    required_pop_behavior: [
      "state what changes in rules or behavior",
      "state what changes in the current task or artifact",
      "state any wider system concern exposed",
      "present the next decision or recommended action"
    ],
    current_stub_boundary: "Durable issue-stack storage and replay are not yet defined for this reference implementation.",
    source_docs: context.source_context.layer3_sources
  };

  return {
    command: "context",
    helper_version: HELPER_VERSION,
    scope: SCOPE,
    project_root: context.project_root,
    context_layers: {
      layer_0: layer0,
      layer_1: layer1,
      layer_2: layer2,
      layer_3: layer3
    },
    response_basis: {
      broader_work: context.derived_lines.broader_work,
      current_task: context.derived_lines.current_task,
      next_step: context.derived_lines.next_step,
      next_question: context.derived_actions.next_question,
      recommendation: context.derived_actions.recommendation,
      source_alignment: context.source_alignment
    },
    ceo_default_response: {
      lines: [
        context.derived_lines.broader_work,
        context.derived_lines.current_task,
        context.derived_lines.next_step
      ],
      text: [
        context.derived_lines.broader_work,
        context.derived_lines.current_task,
        context.derived_lines.next_step
      ].join("\n")
    },
    context_summary: context
  };
}

function renderHealthPayload(context, projectRoot) {
  const selfCheck = runJsonHelper(SELF_CHECK_PATH, ["--project-root", projectRoot], projectRoot);
  const preflight = selfCheck.runtime_preflight ?? {};
  const lines = [];

  lines.push("Yes. A few reliability issues were worth fixing around `$CTO`.");

  if (selfCheck.ready) {
    lines.push("The main avoidable problem is drift between the repo copy and the installed runtime copy of the skill. Edit `skills/cto` in the repo, reinstall after meaningful changes, and run `cto-self-check` before first use in a fresh checkout.");
  } else {
    lines.push(`There are still runtime setup warnings to clear before trusting a fresh CTO run: ${joinWithCommasAnd(selfCheck.warnings ?? [])}.`);
  }

  lines.push("Lifecycle drift was another real risk: governed docs can live either as draft artifacts or promoted layer-root canon. The helper now resolves both so document promotion should not break `$CTO` routes by itself.");

  if (preflight.valid_json) {
    lines.push("Runtime preflight itself is not currently broken here. The repo launcher returns usable JSON in this checkout.");
  } else {
    lines.push("Runtime preflight is still a live problem here because the repo launcher did not return usable JSON. Recommendation: make the launcher fail closed on empty or non-JSON preflight output.");
  }

  return {
    command: "health",
    helper_version: HELPER_VERSION,
    scope: SCOPE,
    project_root: context.project_root,
    self_check: selfCheck,
    ceo_default_response: {
      lines,
      text: lines.join("\n")
    },
    context_summary: context
  };
}

function parseOpenItems(text) {
  const sectionTitles = [
    "Current Active Task Open Items",
    "Broader Trust-Model Open Items",
    "Later-Document Open Items"
  ];

  const sections = {};
  for (let index = 0; index < sectionTitles.length; index += 1) {
    const title = sectionTitles[index];
    const nextTitle = sectionTitles[index + 1] ?? null;
    const sectionText = extractSectionByHeading(text, `## ${title}`, nextTitle ? `## ${nextTitle}` : null);
    sections[title] = parseOpenItemSection(sectionText);
  }
  return sections;
}

function parseOpenItemSection(sectionText) {
  if (!sectionText) {
    return [];
  }

  const rawItems = sectionText.split(/^###\s+/m).slice(1);
  return rawItems.map((chunk) => {
    const lines = chunk.split(/\r?\n/);
    const firstLine = lines[0]?.trim() ?? "";
    const headingMatch = /^(O-\d+)\s+-\s+(.+)$/.exec(firstLine);
    const body = lines.slice(1).join("\n");
    return {
      id: headingMatch?.[1] ?? "unknown",
      title: headingMatch?.[2] ?? firstLine,
      state: cleanInlineCode(extractSingleBulletAfterLabel(body, "State")),
      why_open: extractSingleBulletAfterLabel(body, "Why it is open"),
      target_document: cleanInlineCode(extractSingleBulletAfterLabel(body, "Target document")),
      notes: extractBulletsAfterLabel(body, "Notes")
    };
  });
}

function summarizeStates(items) {
  const counts = {};
  for (const item of items) {
    const key = item.state || "unknown";
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function summarizeActiveTaskThemes(items) {
  const themes = [];
  for (const item of items) {
    const lower = item.title.toLowerCase();
    if (lower.includes("trust wording")) {
      themes.push("the final trust wording");
      continue;
    }
    if (lower.includes("final wording of `complete`") || lower.includes("final wording of complete")) {
      themes.push("the exact definition of complete");
      continue;
    }
    if (lower.includes("terminal outcomes")) {
      themes.push("truthful non-complete terminal outcomes");
      continue;
    }
    if (lower.includes("production tree")) {
      themes.push("how explicit completion should be about production return");
      continue;
    }
    if (lower.includes("certification basis")) {
      themes.push("the certification basis for CTO signoff");
      continue;
    }
    if (lower.includes("hidden heroics")) {
      themes.push("whether hidden heroics must be banned explicitly");
      continue;
    }
    if (lower.includes("queryability") || lower.includes("resumability") || lower.includes("fire-and-forget")) {
      themes.push("how explicitly to name queryability and safe resumability");
      continue;
    }
    if (lower.includes("human testing")) {
      themes.push("whether required human testing must be named directly");
      continue;
    }
    if (lower.includes("ceo need not understand")) {
      themes.push("whether the CEO boundary should be stated directly");
      continue;
    }
    if (lower.includes("incorporate")) {
      themes.push("bringing already-frozen boundary conditions fully into the document");
    }
  }

  return uniqueList(themes).slice(0, 4);
}

function buildGapQuestion(item) {
  const lower = item.title.toLowerCase();
  if (lower.includes("trust wording")) {
    return "What exact minimum trust condition must be true before the CEO can rely on a CTO completion claim without extra checking or rescue";
  }
  if (lower.includes("final wording of `complete`") || lower.includes("final wording of complete")) {
    return "What exact sentence should define complete";
  }
  if (lower.includes("terminal outcomes")) {
    return "How should truthful non-complete terminal outcomes be named";
  }
  if (lower.includes("production tree")) {
    return "How explicit should the completion definition be about return into the production tree";
  }
  if (lower.includes("certification basis")) {
    return "Should the document say explicitly that certification must rest on governed system truth";
  }
  if (lower.includes("hidden heroics")) {
    return "Should the delivery boundary explicitly ban hidden heroics";
  }
  if (lower.includes("queryability") || lower.includes("resumability") || lower.includes("fire-and-forget")) {
    return "How explicit should the document be about queryability, resumability, and error-only upward surfacing";
  }
  if (lower.includes("human testing")) {
    return "Should required human testing be named explicitly as part of trustworthy approval readiness";
  }
  if (lower.includes("ceo need not understand")) {
    return "Should the completion definition state directly that the CEO need not understand the internal route";
  }
  if (lower.includes("incorporate")) {
    return "Which already-frozen boundary conditions still need to be pulled fully into the completion definition";
  }
  return `What decision is still needed for ${item.title.toLowerCase()}`;
}

function buildGapRecommendation(item) {
  const lower = item.title.toLowerCase();
  if (lower.includes("trust wording")) {
    return buildNarrowTrustRecommendation();
  }
  if (lower.includes("final wording of `complete`") || lower.includes("final wording of complete")) {
    return "define complete as a trustworthy return into the production tree that the CTO can certify upward without leaked burden";
  }
  if (lower.includes("terminal outcomes")) {
    return "name truthful non-complete outcomes explicitly, keep them legitimate, and do not let them weaken the meaning of complete";
  }
  if (lower.includes("production tree")) {
    return "say it directly so completion cannot be confused with a worktree-only or pre-merge state";
  }
  if (lower.includes("certification basis")) {
    return "state it explicitly so completion cannot rest on informal belief or manual reconstruction";
  }
  if (lower.includes("hidden heroics")) {
    return "name it explicitly because invisible rescue work breaks trust at the delivery boundary";
  }
  if (lower.includes("queryability") || lower.includes("resumability") || lower.includes("fire-and-forget")) {
    return "name queryability and safe resumability directly, while keeping operational mechanics out of this document";
  }
  if (lower.includes("human testing")) {
    return "state required human testing explicitly whenever approval readiness depends on it";
  }
  if (lower.includes("ceo need not understand")) {
    return "keep the CEO boundary explicit if it helps preserve the meaning of trustworthy completion";
  }
  if (lower.includes("incorporate")) {
    return "pull the already-frozen delivery-boundary conditions into the document before freezing new wording";
  }
  return "resolve the gap explicitly before declaring the definition ready";
}

function buildSourceAlignment(input) {
  const currentTaskPromoted = Boolean(
    input.currentTaskDocName
    && input.promotedOutputs.includes(input.currentTaskDocName)
  );

  if (currentTaskPromoted) {
    return {
      handoff_needs_refresh: true,
      reason: `${input.currentTaskDocName} is already promoted in layer-root canon, so the older handoff no longer names the current active output explicitly.`
    };
  }

  return {
    handoff_needs_refresh: false,
    reason: ""
  };
}

function buildMajorRemainingWork(input) {
  const work = [];

  if (!input.sourceAlignment.handoff_needs_refresh && input.currentTaskMeaning) {
    work.push(input.currentTaskMeaning);
  }

  if (input.broaderTrustTotal > 0) {
    work.push("settle the broader trust model");
  }

  for (const output of input.remainingFoundationOutputs) {
    work.push(humanizeTask(output));
  }

  for (const task of input.afterThatTasks) {
    work.push(humanizeTask(task));
  }

  return uniqueList(work).filter(Boolean);
}

function buildBroaderWorkLine(input) {
  const majorWorkText = buildExecutiveRemainingWorkText(input);

  if (input.sourceAlignment.handoff_needs_refresh) {
    return `Broader work: v2 is still in mission-foundation, and canon has advanced past the last recorded handoff. To finish this stage, we still need to close ${majorWorkText}.`;
  }

  return `Broader work: v2 is still in mission-foundation. To finish this stage, we still need to close ${majorWorkText}.`;
}

function buildCurrentTaskLine(input) {
  if (input.sourceAlignment.handoff_needs_refresh) {
    const nextOutput = input.remainingFoundationOutputs[0]
      ? humanizeTask(input.remainingFoundationOutputs[0])
      : "name the next mission-foundation output explicitly";
    return `Current task: the last handoff still points at ${input.currentTaskMeaning}, but that output is already promoted. The current checkpoint now needs to make ${nextOutput} explicit as the active output.`;
  }

  const bottleneck = describeTaskBottleneck(input.currentTaskMeaning, input.activeTaskThemes);
  if (input.activeTaskCarryIn > 0) {
    return `Current task: we are trying to freeze ${describeTaskAsNoun(input.currentTaskMeaning)}. The active bottleneck is ${bottleneck}, while already-frozen boundary conditions still need to be folded in cleanly.`;
  }
  return `Current task: we are trying to freeze ${describeTaskAsNoun(input.currentTaskMeaning)}. The active bottleneck is ${bottleneck}.`;
}

function buildNextStepLine(input) {
  return `Next step: ${input.nextQuestion}. Recommendation: ${input.nextRecommendation}.`;
}

function buildNarrowTrustRecommendation() {
  return "freeze it narrowly: completion is trustworthy only when the CEO can rely on the CTO claim without extra supervision, reconstruction, or rescue, and without silent scope drift. Keep broader trust scoring and governance in the separate trust model";
}

function buildCheckpointRefreshQuestion(remainingFoundationOutputs) {
  if (remainingFoundationOutputs.length === 0) {
    return "refresh the checkpoint so the next active mission-foundation output is explicit";
  }

  return `refresh the checkpoint so the next active output is ${humanizeTask(remainingFoundationOutputs[0])}`;
}

function buildGenericRecommendation() {
  return "take the fundamental unresolved gap, recommend the narrowest freeze-ready answer, get approval, save it durably, and then move to the next gap";
}

function buildNextQuestion(context) {
  const currentTaskMeaning = context.current_task_meaning ?? context.currentTaskMeaning ?? "";
  const immediateQuestion = context.immediate_next_question ?? context.immediateQuestion ?? "";
  const currentTaskItems = context.current_task_items ?? context.currentTaskItems ?? [];
  const sourceAlignment = context.source_alignment ?? context.sourceAlignment ?? { handoff_needs_refresh: false };
  const remainingFoundationOutputs = context.remaining_foundation_outputs ?? context.remainingFoundationOutputs ?? [];

  if (sourceAlignment.handoff_needs_refresh) {
    return buildCheckpointRefreshQuestion(remainingFoundationOutputs);
  }
  if (currentTaskMeaning === "define what complete means at the delivery boundary") {
    return "can the CEO rely on a CTO completion claim without extra checking, supervision, or rescue";
  }
  const firstGap = currentTaskItems.find((item) => item.state !== "resolved" && item.state !== "moved");
  if (firstGap) {
    return buildGapQuestion(firstGap);
  }
  return humanizeQuestion(immediateQuestion);
}

function buildNextRecommendation(context) {
  const currentTaskMeaning = context.current_task_meaning ?? context.currentTaskMeaning ?? "";
  const currentTaskItems = context.current_task_items ?? context.currentTaskItems ?? [];
  const sourceAlignment = context.source_alignment ?? context.sourceAlignment ?? { handoff_needs_refresh: false };
  const remainingFoundationOutputs = context.remaining_foundation_outputs ?? context.remainingFoundationOutputs ?? [];

  if (sourceAlignment.handoff_needs_refresh) {
    const nextOutput = remainingFoundationOutputs[0]
      ? humanizeTask(remainingFoundationOutputs[0])
      : "the next active mission-foundation output";
    return `save one explicit checkpoint decision that names ${nextOutput} as the next active output, so canon and handoff stop diverging`;
  }
  if (currentTaskMeaning === "define what complete means at the delivery boundary") {
    return buildNarrowTrustRecommendation();
  }
  const firstGap = currentTaskItems.find((item) => item.state !== "resolved" && item.state !== "moved");
  if (firstGap) {
    return buildGapRecommendation(firstGap);
  }
  return buildGenericRecommendation();
}

function humanizeTask(text) {
  const fileName = extractFirstMarkdownCode(text) ?? extractFileName(text);
  if (fileName && DOC_MEANINGS[fileName]) {
    return DOC_MEANINGS[fileName];
  }

  const cleaned = cleanInlineCode(text)
    .replace(/^refine and freeze\s+/i, "")
    .replace(/^freeze\s+/i, "")
    .trim();

  return cleaned || text;
}

function humanizeQuestion(text) {
  let output = cleanInlineCode(text);
  for (const [fileName, meaning] of Object.entries(DOC_MEANINGS)) {
    output = output.replaceAll(fileName, meaning);
  }
  output = output.replace(/\s+/g, " ").trim();
  return output;
}

function describeTaskAsNoun(text) {
  const cleaned = String(text ?? "").trim();
  if (cleaned.toLowerCase().startsWith("define ")) {
    return `the definition of ${cleaned.slice(7)}`;
  }
  if (cleaned.toLowerCase().startsWith("freeze ")) {
    return `the freeze of ${cleaned.slice(7)}`;
  }
  return cleaned;
}

function describeTaskBottleneck(currentTaskMeaning, activeTaskThemes) {
  if (currentTaskMeaning === "define what complete means at the delivery boundary") {
    return "the final trust condition the CEO should require before accepting a CTO completion claim";
  }
  const firstTheme = activeTaskThemes.find(Boolean);
  if (firstTheme) {
    return firstTheme;
  }
  return "the fundamental unresolved question";
}

function extractParagraphAfterHeading(text, heading) {
  const section = extractSection(text, heading);
  if (!section) {
    return "";
  }
  return section
    .split(/\r?\n\r?\n/)
    .map((part) => part.trim())
    .find((part) => part.length > 0 && !part.startsWith("-") && !part.startsWith("###"))
    ?? "";
}

function extractBulletsFromSection(text, heading) {
  const section = extractSection(text, heading);
  if (!section) {
    return [];
  }
  return section
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.replace(/^-+\s*/, "").trim())
    .map(cleanInlineCode);
}

function extractFirstMarkdownCode(text) {
  const match = /`([^`]+)`/.exec(text);
  return match ? match[1] : null;
}

function extractFileName(text) {
  const match = /\b([A-Z0-9-]+\.md)\b/i.exec(text);
  return match ? match[1] : null;
}

function extractSingleBulletAfterLabel(text, label) {
  const pattern = new RegExp(`${escapeRegex(label)}:\\s*\\r?\\n-\\s+([^\\n]+)`);
  const match = pattern.exec(text);
  return match ? cleanInlineCode(match[1].trim()) : "";
}

function extractBulletsAfterLabel(text, label) {
  const pattern = new RegExp(`${escapeRegex(label)}:\\s*\\r?\\n((?:-\\s+[^\\n]+\\r?\\n?)+)`);
  const match = pattern.exec(text);
  if (!match) {
    return [];
  }

  return match[1]
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => cleanInlineCode(line.replace(/^-+\s*/, "").trim()));
}

function extractBulletsAfterPhrase(text, phrase) {
  const pattern = new RegExp(`${escapeRegex(phrase)}:\\s*\\r?\\n((?:-\\s+[^\\n]+\\r?\\n?)+)`);
  const match = pattern.exec(text);
  if (!match) {
    return [];
  }

  return match[1]
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => cleanInlineCode(line.replace(/^-+\s*/, "").trim()));
}

function extractFieldValue(text, fieldName) {
  const pattern = new RegExp(`^${escapeRegex(fieldName)}:\\s*(.+)$`, "m");
  const match = pattern.exec(text);
  return match ? cleanInlineCode(match[1].trim()) : "";
}

function extractSection(text, heading) {
  const lines = String(text).split(/\r?\n/);
  const startIndex = lines.findIndex((line) => line.trim() === heading);
  if (startIndex < 0) {
    return "";
  }

  let endIndex = lines.length;
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    if (lines[index].startsWith("## ")) {
      endIndex = index;
      break;
    }
  }

  return lines.slice(startIndex + 1, endIndex).join("\n").trim();
}

function extractSectionByHeading(text, heading, nextHeading) {
  const start = text.indexOf(heading);
  if (start < 0) {
    return "";
  }
  const fromStart = text.slice(start + heading.length);
  if (!nextHeading) {
    return fromStart.trim();
  }
  const endOffset = fromStart.indexOf(nextHeading);
  if (endOffset < 0) {
    return fromStart.trim();
  }
  return fromStart.slice(0, endOffset).trim();
}

function parseOptionalPositiveInteger(value) {
  if (!isFilled(value)) {
    return null;
  }
  const parsed = Number(requiredArg({ values: { limit: value } }, "limit"));
  if (!Number.isInteger(parsed) || parsed < 1) {
    fail("--limit must be a positive integer.");
  }
  return parsed;
}

function uniqueList(items) {
  return [...new Set(items.filter(Boolean))];
}

function runJsonHelper(scriptPath, args, cwd) {
  const result = spawnSync(process.execPath, [scriptPath, ...args], {
    cwd,
    encoding: "utf8",
    windowsHide: true,
    timeout: 60000
  });

  if (result.status !== 0) {
    throw new Error(result.stderr?.trim() || `Helper '${scriptPath}' exited ${result.status}`);
  }

  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    throw new Error(`Failed to parse JSON from '${scriptPath}': ${error instanceof Error ? error.message : String(error)}`);
  }
}

function joinWithCommasAnd(items) {
  const filtered = items.filter(Boolean);
  if (filtered.length === 0) {
    return "";
  }
  if (filtered.length === 1) {
    return filtered[0];
  }
  if (filtered.length === 2) {
    return `${filtered[0]} and ${filtered[1]}`;
  }
  return `${filtered.slice(0, -1).join(", ")}, and ${filtered[filtered.length - 1]}`;
}

function buildExecutiveRemainingWorkText(input) {
  const majorRemainingWork = buildMajorRemainingWork(input);
  const currentTaskMeaning = input.currentTaskMeaning;
  const includesCurrentTask = majorRemainingWork.includes(currentTaskMeaning);
  const otherWork = majorRemainingWork.filter((item) => item !== currentTaskMeaning);
  const remainingFoundationDefinitions = otherWork.filter((item) =>
    item === "define system obligations"
    || item === "define the boxed component model"
    || item === "define the role model"
    || item === "define the workflow model"
  );
  const otherNamedWork = otherWork.filter((item) => !remainingFoundationDefinitions.includes(item));
  const parts = [];

  if (includesCurrentTask) {
    parts.push("what complete means at the delivery boundary");
  }

  if (otherNamedWork.includes("settle the broader trust model")) {
    parts.push("the broader trust model");
  }

  if (remainingFoundationDefinitions.length > 0) {
    parts.push("the remaining foundation documents");
  }

  const leftoverNamedWork = otherNamedWork.filter((item) => item !== "settle the broader trust model");
  for (const item of leftoverNamedWork) {
    parts.push(item);
  }

  return joinWithCommasAnd(parts);
}

function cleanInlineCode(value) {
  return String(value ?? "").replace(/`/g, "").trim();
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function resolveLayerDocumentPath(layerRoot, fileName) {
  const promotedPath = join(layerRoot, fileName);
  if (await pathExists(promotedPath)) {
    return {
      state: "promoted",
      path: promotedPath
    };
  }

  const draftPath = join(layerRoot, "context", "artifacts", fileName);
  if (await pathExists(draftPath)) {
    return {
      state: "draft-artifact",
      path: draftPath
    };
  }

  fail(`Unable to resolve '${fileName}' in promoted or draft-artifact locations under '${layerRoot}'.`);
}
