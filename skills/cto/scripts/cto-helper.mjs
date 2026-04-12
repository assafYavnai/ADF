#!/usr/bin/env node

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
import { runCtoSelfCheck } from "./cto-self-check.mjs";

const HELPER_VERSION = 3;
const SCOPE = "adf-v2";
const SCRIPT_PATH = fileURLToPath(import.meta.url);
const SCRIPT_DIR = dirname(SCRIPT_PATH);
const IS_MAIN = process.argv[1] ? resolve(process.argv[1]) === SCRIPT_PATH : false;
const DOC_MEANINGS = {
  "DELIVERY-COMPLETION-DEFINITION.md": "define what complete means at the delivery boundary",
  "TRUST-MODEL.md": "freeze the broader trust model",
  "SYSTEM-OBLIGATIONS.md": "define system obligations",
  "BOXED-COMPONENT-MODEL.md": "define the boxed component model",
  "MISSION-STATEMENT.md": "define the mission foundation",
  "CTO-ROLE.md": "define the CTO role"
};

if (IS_MAIN) {
  main().catch((error) => {
    fail(error instanceof Error ? error.stack ?? error.message : String(error));
  });
}

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
    printJson(await renderHealthPayload(context, projectRoot));
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

export async function resolveRepoRoot(inputPath) {
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

export async function loadMissionFoundationContext(projectRoot) {
  const startedAt = nowIso();
  const missionFoundationRoot = join(projectRoot, "adf-v2", "00-mission-foundation");
  const handoffPath = join(missionFoundationRoot, "context", "HANDOFF.md");
  const nextStepPath = join(missionFoundationRoot, "context", "NEXT-STEP-HANDOFF.md");
  const openItemsPath = join(missionFoundationRoot, "context", "OPEN-ITEMS.md");
  const trustModelPath = join(missionFoundationRoot, "context", "artifacts", "TRUST-MODEL.md");
  const missionPath = join(missionFoundationRoot, "MISSION-STATEMENT.md");
  const deliveryCompletionPath = join(missionFoundationRoot, "DELIVERY-COMPLETION-DEFINITION.md");
  const systemObligationsPath = join(missionFoundationRoot, "SYSTEM-OBLIGATIONS.md");
  const boxedComponentModelPath = join(missionFoundationRoot, "BOXED-COMPONENT-MODEL.md");
  const ctoRolePath = join(projectRoot, "adf-v2", "CTO-ROLE.md");
  const ceoProtocolPath = join(projectRoot, "adf-v2", "CEO-AGENT-WORKING-PROTOCOL.md");
  const ctoArchitecturePath = join(missionFoundationRoot, "CTO-CONTEXT-ARCHITECTURE.md");
  const ctoCeoWorkingModePath = join(projectRoot, "adf-v2", "CTO-CEO-WORKING-MODE.md");

  const [
    handoffText,
    nextStepText,
    openItemsText,
    trustModelText,
    missionText,
    ctoRoleText,
    ceoProtocolText,
    ctoArchitectureText
  ] = await Promise.all([
    readFile(handoffPath, "utf8"),
    readFile(nextStepPath, "utf8"),
    readFile(openItemsPath, "utf8"),
    readFile(trustModelPath, "utf8"),
    readFile(missionPath, "utf8"),
    readFile(ctoRolePath, "utf8"),
    readFile(ceoProtocolPath, "utf8"),
    readFile(ctoArchitecturePath, "utf8")
  ]);
  const ctoCeoWorkingModeText = await readOptionalText(ctoCeoWorkingModePath);

  const broaderWorkBullets = extractBulletsFromHeading(handoffText, "### Broader work");
  const broaderWork = broaderWorkBullets.length > 0
    ? `finish phase 00 from outside to inside: ${broaderWorkBullets.join(", ")}`
    : extractSingleBulletAfterLabel(handoffText, "Broader work");
  const handoffCurrentTask = extractLeadParagraphFromHeading(handoffText, "### Current task");
  const handoffCurrentTaskPurpose = extractSupportingParagraphFromHeading(handoffText, "### Current task");
  const handoffNextStep = extractLeadParagraphFromHeading(handoffText, "### Next step");
  const laterStepBullets = extractBulletsFromHeading(handoffText, "### Later steps and open items").map(humanizeTask);
  const numberedWorkingSequence = extractNumberedItemsFromHeading(handoffText, "## Current Working Completion Sequence For Phase `00`").map(humanizeTask);
  const currentTaskRaw = handoffCurrentTask
    || extractSingleBulletAfterLabel(nextStepText, "Current task")
    || extractSingleBulletAfterLabel(nextStepText, "Current main task");
  const currentTaskDocName = extractFirstMarkdownCode(currentTaskRaw) ?? extractFileName(currentTaskRaw);
  const openItems = parseOpenItems(openItemsText);
  const activeTaskItems = openItems["Current Active Task Open Items"] ?? [];
  const broaderTrustItems = openItems["Broader Trust-Model Open Items"] ?? [];
  const laterDocumentItems = openItems["Later-Document Open Items"] ?? [];
  const currentTaskMeaning = humanizeTask(currentTaskRaw);
  const phase00WorkingSequence = numberedWorkingSequence.length > 0
    ? numberedWorkingSequence
    : uniqueList([currentTaskMeaning, ...laterStepBullets]).filter(Boolean);
  const currentTaskItems = selectCurrentTaskItems({
    current_task_meaning: currentTaskMeaning,
    active_task_items: activeTaskItems,
    later_document_items: laterDocumentItems
  });
  const activeTaskStateCounts = summarizeStates(currentTaskItems);
  const activeTaskThemeList = summarizeActiveTaskThemes(currentTaskItems);
  const currentTaskPurpose = extractSingleBulletAfterLabel(nextStepText, "Current task purpose")
    || handoffCurrentTaskPurpose;
  const nextStepMeaning = humanizeTask(handoffNextStep || extractSingleBulletAfterLabel(nextStepText, "Next step"));
  const immediateQuestion = extractSingleBulletAfterLabel(nextStepText, "Immediate next question")
    || extractSingleBulletAfterLabel(nextStepText, "Immediate next unresolved question");
  const explicitRecommendation = extractSingleBulletAfterLabel(nextStepText, "Recommendation");
  const trustModelPurpose = extractFieldValue(trustModelText, "Purpose");
  const missionIdentity = extractParagraphAfterHeading(missionText, "## Identity");
  const phaseMission = extractParagraphAfterHeading(missionText, "## Phase 1 mission");
  const operatingRoles = extractBulletsFromSection(missionText, "## Core operating roles");
  void ctoRoleText;
  void ceoProtocolText;
  void ctoArchitectureText;
  void ctoCeoWorkingModeText;

  const sourceAlignment = buildSourceAlignment({
    broader_work_source: normalizeSlashes(handoffPath),
    current_checkpoint_source: normalizeSlashes(nextStepPath),
    broader_work: broaderWork,
    phase00_working_sequence: phase00WorkingSequence,
    current_task_meaning: currentTaskMeaning,
    next_step_meaning: nextStepMeaning
  });
  const nextQuestion = buildNextQuestion({
    current_task_meaning: currentTaskMeaning,
    immediate_next_question: immediateQuestion,
    current_task_items: currentTaskItems
  });
  const nextRecommendation = buildNextRecommendation({
    current_task_meaning: currentTaskMeaning,
    current_task_items: currentTaskItems,
    next_step_meaning: nextStepMeaning,
    explicit_recommendation: explicitRecommendation
  });

  const broaderWorkLine = buildBroaderWorkLine({
    broader_work: broaderWork,
    phase00_working_sequence: phase00WorkingSequence
  });
  const currentTaskLine = buildCurrentTaskLine({
    current_task_meaning: currentTaskMeaning
  });
  const nextStepLine = buildNextStepLine({
    next_step_meaning: nextStepMeaning,
    next_question: nextQuestion,
    next_recommendation: nextRecommendation
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
    broader_work_raw: broaderWork,
    phase00_working_sequence: phase00WorkingSequence,
    current_main_task_raw: currentTaskRaw,
    current_task_doc_name: currentTaskDocName,
    current_task_meaning: currentTaskMeaning,
    current_task_purpose: currentTaskPurpose,
    next_step_meaning: nextStepMeaning,
    immediate_next_question: immediateQuestion,
    source_alignment: sourceAlignment,
    counts: {
      active_task_total: currentTaskItems.length,
      active_task_open: activeTaskStateCounts.open ?? 0,
      active_task_frozen_upstream_needs_incorporation: activeTaskStateCounts["frozen-upstream-needs-incorporation"] ?? 0,
      active_task_resolved: activeTaskStateCounts.resolved ?? 0,
      broader_trust_total: broaderTrustItems.length,
      later_document_total: laterDocumentItems.length
    },
    current_task_items: currentTaskItems,
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
        normalizeSlashes(deliveryCompletionPath),
        normalizeSlashes(systemObligationsPath),
        normalizeSlashes(boxedComponentModelPath),
        normalizeSlashes(handoffPath),
        normalizeSlashes(nextStepPath)
      ],
      layer2_sources: [
        normalizeSlashes(nextStepPath),
        normalizeSlashes(openItemsPath)
      ],
      layer3_sources: [
        normalizeSlashes(ctoArchitecturePath)
      ]
    },
    resolved_paths: {
      broader_work_source: normalizeSlashes(handoffPath),
      current_checkpoint_source: normalizeSlashes(nextStepPath)
    }
  };
}

export function renderStatusPayload(context) {
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

export function renderReadinessPayload(context) {
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

export function renderGapPayload(context, options) {
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

export function renderContextPayload(context) {
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
      phase00_working_sequence: context.phase00_working_sequence
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

export async function renderHealthPayload(context, projectRoot) {
  const selfCheck = await runCtoSelfCheck({
    projectRoot,
    runtimePreflightMode: "deferred"
  });
  const preflight = selfCheck.runtime_preflight ?? {};
  const skillWiring = selfCheck.skill_wiring ?? {};
  const lines = [];

  if (selfCheck.ready) {
    lines.push("No. The governed `$CTO` route is now running cleanly from the repo skill.");
  } else {
    lines.push("Yes. A few `$CTO` runtime issues still need cleanup.");
  }

  if (skillWiring.state === "pointer") {
    lines.push("The installed Codex skill is thin wiring back to `skills/cto` in ADF, so the live logic stays under repo control instead of drifting as a second active copy under `.codex`.");
  } else if (selfCheck.ready) {
    lines.push("The main remaining risk would be repo-vs-installed drift. Keep editing `skills/cto` in ADF and reinstall only as thin wiring.");
  } else {
    lines.push(`There are still runtime setup warnings to clear before trusting a fresh CTO run: ${joinWithCommasAnd(selfCheck.warnings ?? [])}.`);
  }

  lines.push("The governed route no longer depends on a nested launcher-to-governor-to-helper-to-self-check process chain for normal answers, so the Windows control-plane `EPERM` issue from deep child-process nesting is removed from the common `$CTO` path.");

  lines.push("Lifecycle drift is also covered: the helper resolves governed documents from promoted canon first and draft-artifact fallback second, so document promotion should not break `$CTO` routes by itself.");

  if (preflight.mode === "deferred") {
    lines.push("Runtime preflight is still the ADF startup authority, but `$CTO` health no longer shells into it by default. That keeps the skill health check focused on `$CTO` integration instead of broader repo bootstrap state.");
  } else if (preflight.valid_json && preflight.overall_status === "fail") {
    lines.push("Runtime preflight itself is working as a truth source here: it returns usable JSON, and it is correctly reporting broader repo install or Brain issues outside the `$CTO` route.");
  } else if (preflight.valid_json) {
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

function selectCurrentTaskItems(input) {
  const activeTaskItems = input.active_task_items ?? [];
  const laterDocumentItems = input.later_document_items ?? [];
  const unresolvedActiveItems = activeTaskItems.filter((item) => item.state !== "resolved" && item.state !== "moved");
  const normalizedCurrentTask = stripTrailingPunctuation(String(input.current_task_meaning ?? "")).toLowerCase();

  if (unresolvedActiveItems.length > 0) {
    return unresolvedActiveItems;
  }

  if (normalizedCurrentTask === "define who exists at the top") {
    return laterDocumentItems.filter((item) => {
      const haystack = `${item.title} ${item.target_document}`.toLowerCase();
      return haystack.includes("top-level governing-entity")
        || haystack.includes("filename")
        || haystack.includes("final shape");
    });
  }

  return unresolvedActiveItems;
}

function summarizeActiveTaskThemes(items) {
  const themes = [];
  for (const item of items) {
    const lower = item.title.toLowerCase();
    if (lower.includes("entity set")) {
      themes.push("the minimum top-level entity set");
      continue;
    }
    if (lower.includes("workflow detail")) {
      themes.push("the boundary between top entities and later workflow detail");
      continue;
    }
    if (lower.includes("component derivation")) {
      themes.push("the boundary between top entities and later component derivation");
      continue;
    }
    if (lower.includes("durable state")) {
      themes.push("how Durable state belongs at the top boundary");
      continue;
    }
    if (lower.includes("naming") || lower.includes("filename") || lower.includes("final shape")) {
      themes.push("whether naming changes meaning or is only presentation");
    }
  }

  return uniqueList(themes).slice(0, 4);
}

function buildGapQuestion(item) {
  const lower = item.title.toLowerCase();
  if (lower.includes("entity set")) {
    return "What is the minimum top-level governing entity set phase 00 must freeze first";
  }
  if (lower.includes("workflow detail")) {
    return "Where is the line between top entities and later workflow detail";
  }
  if (lower.includes("component derivation")) {
    return "Where is the line between top entities and later component derivation";
  }
  if (lower.includes("durable state")) {
    return "How should Durable state appear at the top boundary";
  }
  if (lower.includes("naming") || lower.includes("filename") || lower.includes("final shape")) {
    return "Does any naming choice here change governing meaning, or is it only presentation";
  }
  return `What decision is still needed for ${item.title.toLowerCase()}`;
}

function buildGapRecommendation(item) {
  const lower = item.title.toLowerCase();
  if (lower.includes("entity set")) {
    return "freeze only the top-level entities needed to define the governing surface, and leave lower-layer structure for the later passes";
  }
  if (lower.includes("workflow detail")) {
    return "state the top boundary only, then defer movement and route shape to the workflow pass";
  }
  if (lower.includes("component derivation")) {
    return "name what must exist at the top, but do not derive the component map until the workflow pass is clear";
  }
  if (lower.includes("durable state")) {
    return "keep Durable state explicit at the top only if it is a true governing entity or boundary, not just an implementation support detail";
  }
  if (lower.includes("naming") || lower.includes("filename") || lower.includes("final shape")) {
    return "only freeze a naming choice if it changes boundary or behavior; otherwise keep the task focused on meaning";
  }
  return "resolve the gap explicitly before declaring the definition ready";
}

function buildSourceAlignment(input) {
  return {
    mode: "canonical-handoff-plus-checkpoint-companion",
    canonical_startup_source: input.broader_work_source,
    checkpoint_companion_source: input.current_checkpoint_source,
    broader_work_present: Boolean(input.broader_work),
    current_sequence_present: Array.isArray(input.phase00_working_sequence) && input.phase00_working_sequence.length > 0,
    current_task_present: Boolean(input.current_task_meaning),
    next_step_present: Boolean(input.next_step_meaning)
  };
}

function buildMajorRemainingWork(input) {
  return uniqueList((input.phase00_working_sequence ?? []).map(humanizeTask)).filter(Boolean);
}

function buildBroaderWorkLine(input) {
  const broaderWork = stripTrailingPunctuation(input.broader_work);
  if (broaderWork) {
    return `Broader work: ${broaderWork}.`;
  }

  const sequence = joinWithCommasAnd((input.phase00_working_sequence ?? []).map(humanizeTask));
  return `Broader work: finish phase 00 by moving through ${sequence}.`;
}

function buildCurrentTaskLine(input) {
  return `Current task: ${lowercaseInitialPhrase(input.current_task_meaning)}.`;
}

function buildNextStepLine(input) {
  const nextStep = lowercaseInitialPhrase(input.next_step_meaning);
  const fallback = stripTrailingPunctuation(input.next_question);
  const recommendation = stripTrailingPunctuation(input.next_recommendation);
  const stepText = nextStep || fallback || "take the next explicit checkpoint move";
  return `Next step: ${stepText}.${recommendation ? ` Recommendation: ${recommendation}.` : ""}`;
}

function buildGenericRecommendation() {
  return "take the fundamental unresolved gap, recommend the narrowest freeze-ready answer, get approval, save it durably, and then move to the next gap";
}

function buildNextQuestion(context) {
  const immediateQuestion = context.immediate_next_question ?? context.immediateQuestion ?? "";
  const currentTaskItems = context.current_task_items ?? context.currentTaskItems ?? [];
  if (isFilled(immediateQuestion)) {
    return humanizeQuestion(immediateQuestion);
  }
  const firstGap = currentTaskItems.find((item) => item.state !== "resolved" && item.state !== "moved");
  if (firstGap) {
    return buildGapQuestion(firstGap);
  }
  return humanizeQuestion(immediateQuestion);
}

function buildNextRecommendation(context) {
  const currentTaskMeaning = stripTrailingPunctuation(context.current_task_meaning ?? context.currentTaskMeaning ?? "").toLowerCase();
  const currentTaskItems = context.current_task_items ?? context.currentTaskItems ?? [];
  const explicitRecommendation = context.explicit_recommendation ?? context.explicitRecommendation ?? "";
  if (isFilled(explicitRecommendation)) {
    return humanizeQuestion(explicitRecommendation);
  }
  if (currentTaskMeaning === "define who exists at the top") {
    return "keep it thin: define only the top-level entities and their high-level boundaries, and leave workflow, component, connection, and trust detail to later passes";
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

function extractBulletsFromHeading(text, heading) {
  const section = extractSectionFromHeadingLine(text, heading);
  if (!section) {
    return [];
  }

  return section
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => cleanInlineCode(line.replace(/^-+\s*/, "").trim()));
}

function extractLeadParagraphFromHeading(text, heading) {
  const section = extractSectionFromHeadingLine(text, heading);
  if (!section) {
    return "";
  }

  const line = section
    .split(/\r?\n/)
    .map((part) => part.trim())
    .find((part) => part.length > 0 && !part.startsWith("-") && !part.startsWith("###"));

  return line ?? "";
}

function extractSupportingParagraphFromHeading(text, heading) {
  const section = extractSectionFromHeadingLine(text, heading);
  if (!section) {
    return "";
  }

  const paragraphs = section
    .split(/\r?\n\r?\n/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && !part.startsWith("-") && !part.startsWith("###"));

  return paragraphs[1] ?? "";
}

function extractNumberedItemsFromHeading(text, heading) {
  const section = extractSectionFromHeadingLine(text, heading);
  if (!section) {
    return [];
  }

  return section
    .split(/\r?\n/)
    .map((line) => line.trim())
    .map((line) => /^\d+\.\s+(.+)$/.exec(line)?.[1] ?? null)
    .filter(Boolean)
    .map(cleanInlineCode);
}

function extractSectionFromHeadingLine(text, heading) {
  const lines = String(text).split(/\r?\n/);
  const startIndex = lines.findIndex((line) => line.trim() === heading);
  if (startIndex < 0) {
    return "";
  }

  let endIndex = lines.length;
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const trimmed = lines[index].trim();
    if ((trimmed.startsWith("## ") || trimmed.startsWith("### ")) && trimmed !== heading) {
      endIndex = index;
      break;
    }
  }

  return lines.slice(startIndex + 1, endIndex).join("\n").trim();
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

function stripTrailingPunctuation(value) {
  return String(value ?? "").trim().replace(/[.?!:;]+$/g, "").trim();
}

function lowercaseInitialPhrase(value) {
  const cleaned = stripTrailingPunctuation(value);
  if (!cleaned) {
    return "";
  }
  return cleaned.charAt(0).toLowerCase() + cleaned.slice(1);
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
