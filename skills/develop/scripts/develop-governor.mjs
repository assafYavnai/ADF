#!/usr/bin/env node

import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  normalizeFeatureSlug,
  normalizeProjectRoot,
  normalizeSlashes,
  parseArgs,
  parsePositiveInteger,
  pathExists,
  printJson,
  readJsonIfExists,
  readTextIfExists,
  requiredArg,
  resolveFeatureRoot,
  validateHeadingContract
} from "../../governed-feature-runtime.mjs";

const CONTRACT_HEADINGS = [
  "1. Implementation Objective",
  "2. Slice Scope",
  "3. Required Deliverables",
  "4. Allowed Edits",
  "5. Forbidden Edits",
  "6. Acceptance Gates",
  "7. Observability / Audit",
  "8. Dependencies / Constraints",
  "9. Non-Goals",
  "10. Source Authorities"
];

function extractLabelValue(text, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = text.match(new RegExp("^" + escaped + ":\\s*(.+)$", "mi"));
  return match ? match[1].trim() : "";
}

async function collectLaneConflicts(projectRoot, phaseNumber, featureSlug) {
  const lanesRoot = join(projectRoot, ".codex", "develop", "lanes");
  if (!(await pathExists(lanesRoot))) {
    return [];
  }
  const entries = await readdir(lanesRoot, { withFileTypes: true });
  const conflicts = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const laneStatePath = join(lanesRoot, entry.name, "lane-state.json");
    const laneState = await readJsonIfExists(laneStatePath, null);
    if (!laneState || laneState.feature_slug !== featureSlug || Number(laneState.phase_number) !== phaseNumber) {
      continue;
    }
    const status = String(laneState.status ?? "").trim().toLowerCase();
    if (!status || ["completed", "failed", "cancelled", "closed", "idle"].includes(status)) {
      continue;
    }
    conflicts.push({
      lane_id: entry.name,
      status,
      path: laneStatePath.replace(/\\/g, "/")
    });
  }

  return conflicts;
}

export async function checkLaneConflict({ projectRoot, phaseNumber, featureSlug }) {
  const conflicts = await collectLaneConflicts(projectRoot, phaseNumber, featureSlug);
  return {
    status: conflicts.length === 0 ? "pass" : "fail",
    findings: conflicts.length === 0
      ? []
      : conflicts.map((conflict) => "Active lane conflict: " + conflict.lane_id + " (" + conflict.status + ") at " + conflict.path),
    blocker: conflicts.length === 0 ? null : "conflicting active lane detected"
  };
}

export async function validatePrerequisites({ projectRoot, phaseNumber, featureSlug, featureStatusOverride = null }) {
  const featureRoot = resolveFeatureRoot(projectRoot, phaseNumber, featureSlug);
  const contractPath = join(featureRoot, "implement-plan-contract.md");
  const contextPath = join(featureRoot, "context.md");
  const statePath = join(featureRoot, "implement-plan-state.json");
  const findings = [];

  if (!(await pathExists(contractPath))) {
    findings.push("contract.md not found at " + contractPath.replace(/\\/g, "/"));
  } else {
    const validation = validateHeadingContract(await readTextIfExists(contractPath), CONTRACT_HEADINGS);
    if (!validation.valid) {
      findings.push(validation.error);
    }
  }

  if (!(await readTextIfExists(contextPath)).trim()) {
    findings.push("context.md missing or empty at " + contextPath.replace(/\\/g, "/"));
  }

  const state = await readJsonIfExists(statePath, null);
  const featureStatus = String(featureStatusOverride ?? state?.feature_status ?? "").trim().toLowerCase();
  if (!featureStatusOverride && (featureStatus === "completed" || featureStatus === "closed")) {
    findings.push("feature is already in terminal lifecycle state '" + featureStatus + "'");
  }

  const laneConflict = await checkLaneConflict({ projectRoot, phaseNumber, featureSlug });
  findings.push(...laneConflict.findings);

  return {
    status: findings.length === 0 ? "pass" : "fail",
    findings,
    blocker: findings.length === 0 ? null : findings[0]
  };
}

export async function validateIntegrity({ projectRoot, phaseNumber, featureSlug }) {
  const contractPath = join(resolveFeatureRoot(projectRoot, phaseNumber, featureSlug), "implement-plan-contract.md");
  const contractText = await readTextIfExists(contractPath);
  const findings = [];

  if (!contractText.trim()) {
    return {
      status: "fail",
      findings: ["implement-plan-contract.md missing or empty at " + contractPath.replace(/\\/g, "/")],
      blocker: "contract missing"
    };
  }

  const kpiApplicability = extractLabelValue(contractText, "KPI Applicability").toLowerCase();
  if (!kpiApplicability) {
    findings.push("KPI Applicability is missing.");
  } else if (!["required", "not required", "temporary exception approved"].includes(kpiApplicability)) {
    findings.push("KPI Applicability has an invalid value.");
  }

  if (kpiApplicability === "required" || kpiApplicability === "temporary exception approved") {
    for (const label of [
      "KPI Route / Touched Path",
      "KPI Raw-Truth Source",
      "KPI Coverage / Proof",
      "KPI Production / Proof Partition"
    ]) {
      if (!extractLabelValue(contractText, label)) {
        findings.push(label + " is missing.");
      }
    }
  }
  if (kpiApplicability === "not required" && !extractLabelValue(contractText, "KPI Non-Applicability Rationale")) {
    findings.push("KPI Non-Applicability Rationale is missing.");
  }
  if (kpiApplicability === "temporary exception approved") {
    for (const label of [
      "KPI Exception Owner",
      "KPI Exception Expiry",
      "KPI Exception Production Status",
      "KPI Compensating Control"
    ]) {
      if (!extractLabelValue(contractText, label)) {
        findings.push(label + " is missing.");
      }
    }
  }

  for (const label of [
    "Vision Compatibility",
    "Phase 1 Compatibility",
    "Master-Plan Compatibility",
    "Current Gap-Closure Compatibility",
    "Later-Company Check",
    "Compatibility Decision",
    "Compatibility Evidence"
  ]) {
    if (!extractLabelValue(contractText, label)) {
      findings.push(label + " is missing.");
    }
  }

  if (extractLabelValue(contractText, "Compatibility Decision").toLowerCase() !== "compatible") {
    findings.push("Compatibility Decision is not compatible.");
  }
  if (extractLabelValue(contractText, "Later-Company Check").toLowerCase() === "yes") {
    findings.push("Later-Company Check is yes.");
  }
  if (!/Machine Verification Plan:/i.test(contractText)) {
    findings.push("Machine Verification Plan is missing.");
  }
  const humanRequired = extractLabelValue(contractText, "Required").toLowerCase();
  if (!/Human Verification Plan:/i.test(contractText) || !["true", "false"].includes(humanRequired)) {
    findings.push("Human Verification Plan is missing Required: true|false.");
  }

  return {
    status: findings.length === 0 ? "pass" : "fail",
    findings,
    blocker: findings.length === 0 ? null : findings[0]
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const command = args.positionals[0] ?? "help";
  const projectRoot = normalizeProjectRoot(requiredArg(args, "project-root"));
  const phaseNumber = parsePositiveInteger(requiredArg(args, "phase-number"), "phase-number");
  const featureSlug = normalizeFeatureSlug(requiredArg(args, "feature-slug"));

  let result;
  if (command === "validate-prerequisites") {
    result = await validatePrerequisites({
      projectRoot,
      phaseNumber,
      featureSlug,
      featureStatusOverride: args.values["feature-status-override"] ?? null
    });
  } else if (command === "validate-integrity") {
    result = await validateIntegrity({ projectRoot, phaseNumber, featureSlug });
  } else if (command === "check-lane-conflict") {
    result = await checkLaneConflict({ projectRoot, phaseNumber, featureSlug });
  } else {
    result = {
      status: "pass",
      supported_commands: [
        "validate-prerequisites",
        "validate-integrity",
        "check-lane-conflict"
      ]
    };
  }

  printJson({
    command,
    project_root: projectRoot,
    phase_number: phaseNumber,
    feature_slug: featureSlug,
    ...result
  });
}

const isDirectExecution = process.argv[1]
  && normalizeSlashes(process.argv[1]) === normalizeSlashes(fileURLToPath(import.meta.url));

if (isDirectExecution) {
  await main();
}
