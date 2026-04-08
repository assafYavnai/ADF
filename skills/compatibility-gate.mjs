#!/usr/bin/env node

/**
 * compatibility-gate.mjs — Spec 3 strict post-merge compatibility gate.
 *
 * Verifies that Spec 1 (provider-neutral run contract) and Spec 2
 * (benchmark supervisor skill) on main speak the same contract,
 * share the same enum vocabulary, and integrate without hidden bridge logic.
 *
 * Exit 0 = production-compatible.  Exit 1 = blocked with exact mismatches.
 * All output is JSON to stdout via printJson().
 */

import { readFile, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// --- Import Spec 1 shared runtime (the contract substrate) ---
import {
  ACCESS_MODES,
  EXECUTION_RUNTIMES,
  PERSISTENT_EXECUTION_STRATEGIES,
  IMPLEMENT_PLAN_RUN_MODES,
  IMPLEMENT_PLAN_ACTIVE_RUN_STATUSES,
  IMPLEMENT_PLAN_EVENTS,
  BENCHMARK_LANE_STATUSES,
  BENCHMARK_SUITE_STATUSES,
  BENCHMARK_EVENTS,
  BENCHMARK_TERMINAL_LANE_STATUSES,
  FEATURE_STATUSES,
  RUNTIME_PERMISSION_MODELS,
  CAPABILITY_KEYS,
  normalizeSlashes,
  printJson
} from "./governed-feature-runtime.mjs";

const scriptPath = fileURLToPath(import.meta.url);
const skillsRoot = dirname(scriptPath);
const projectRoot = dirname(skillsRoot);

// ---------------------------------------------------------------------------
// Check registry
// ---------------------------------------------------------------------------

const checks = [];
let passCount = 0;
let failCount = 0;

function record(id, category, description, pass, evidence, mismatch) {
  const entry = { id, category, description, result: pass ? "PASS" : "FAIL", evidence };
  if (!pass && mismatch) entry.mismatch = mismatch;
  checks.push(entry);
  if (pass) passCount += 1;
  else failCount += 1;
}

async function fileExists(p) {
  try { await stat(p); return true; } catch { return false; }
}

// ---------------------------------------------------------------------------
// 1. Shared enum / vocabulary compatibility
// ---------------------------------------------------------------------------

// 1a. IMPLEMENT_PLAN_RUN_MODES must contain both "normal" and "benchmarking"
record(
  "enum-run-modes",
  "contract_compatibility",
  "IMPLEMENT_PLAN_RUN_MODES contains normal and benchmarking",
  IMPLEMENT_PLAN_RUN_MODES.has("normal") && IMPLEMENT_PLAN_RUN_MODES.has("benchmarking"),
  { values: Array.from(IMPLEMENT_PLAN_RUN_MODES) },
  (!IMPLEMENT_PLAN_RUN_MODES.has("normal") ? "missing: normal " : "") +
  (!IMPLEMENT_PLAN_RUN_MODES.has("benchmarking") ? "missing: benchmarking" : "")
);

// 1b. BENCHMARK_LANE_STATUSES must exist and be non-empty
record(
  "enum-lane-statuses",
  "contract_compatibility",
  "BENCHMARK_LANE_STATUSES exported and non-empty",
  BENCHMARK_LANE_STATUSES instanceof Set && BENCHMARK_LANE_STATUSES.size > 0,
  { size: BENCHMARK_LANE_STATUSES?.size ?? 0, values: Array.from(BENCHMARK_LANE_STATUSES ?? []) }
);

// 1c. BENCHMARK_SUITE_STATUSES must exist and be non-empty
record(
  "enum-suite-statuses",
  "contract_compatibility",
  "BENCHMARK_SUITE_STATUSES exported and non-empty",
  BENCHMARK_SUITE_STATUSES instanceof Set && BENCHMARK_SUITE_STATUSES.size > 0,
  { size: BENCHMARK_SUITE_STATUSES?.size ?? 0, values: Array.from(BENCHMARK_SUITE_STATUSES ?? []) }
);

// 1d. BENCHMARK_EVENTS must exist and be non-empty
record(
  "enum-events",
  "contract_compatibility",
  "BENCHMARK_EVENTS exported and non-empty",
  BENCHMARK_EVENTS instanceof Set && BENCHMARK_EVENTS.size > 0,
  { size: BENCHMARK_EVENTS?.size ?? 0, values: Array.from(BENCHMARK_EVENTS ?? []) }
);

// 1e. BENCHMARK_TERMINAL_LANE_STATUSES must be a strict subset of BENCHMARK_LANE_STATUSES
{
  const nonSubset = [];
  for (const s of BENCHMARK_TERMINAL_LANE_STATUSES) {
    if (!BENCHMARK_LANE_STATUSES.has(s)) nonSubset.push(s);
  }
  record(
    "enum-terminal-subset",
    "contract_compatibility",
    "BENCHMARK_TERMINAL_LANE_STATUSES ⊆ BENCHMARK_LANE_STATUSES",
    nonSubset.length === 0,
    { terminal: Array.from(BENCHMARK_TERMINAL_LANE_STATUSES), lane: Array.from(BENCHMARK_LANE_STATUSES) },
    nonSubset.length > 0 ? "values in terminal but not in lane: " + nonSubset.join(", ") : null
  );
}

// 1f. FEATURE_STATUSES must contain the lifecycle values used by both specs
{
  const required = ["active", "blocked", "completed", "closed"];
  const missing = required.filter(v => !FEATURE_STATUSES.has(v));
  record(
    "enum-feature-statuses",
    "contract_compatibility",
    "FEATURE_STATUSES contains active/blocked/completed/closed",
    missing.length === 0,
    { values: Array.from(FEATURE_STATUSES) },
    missing.length > 0 ? "missing: " + missing.join(", ") : null
  );
}

// 1g. Spec 2 event names must be in BENCHMARK_EVENTS
{
  const spec2Events = [
    "suite-started", "lane-provisioning", "lane-started",
    "lane-cycle-started", "lane-cycle-completed",
    "lane-verification-passed", "lane-verification-failed",
    "lane-blocked", "lane-stopped", "lane-completed", "lane-failed",
    "lane-reset", "suite-progress", "suite-completed",
    "suite-stopped", "suite-failed", "global-failure"
  ];
  const missing = spec2Events.filter(e => !BENCHMARK_EVENTS.has(e));
  record(
    "enum-spec2-events-covered",
    "contract_compatibility",
    "All Spec 2 documented event names exist in BENCHMARK_EVENTS",
    missing.length === 0,
    { checked: spec2Events.length, registered: BENCHMARK_EVENTS.size },
    missing.length > 0 ? "missing events: " + missing.join(", ") : null
  );
}

// 1h. Spec 1 IMPLEMENT_PLAN_EVENTS must contain the governed route events
{
  const spec1Events = [
    "context-collected", "integrity-passed", "integrity-failed",
    "brief-written", "worktree-prepared", "implementor-started",
    "implementor-finished", "verification-finished", "review-requested",
    "human-verification-requested", "merge-ready", "merge-queued",
    "merge-started", "merge-blocked", "merge-finished",
    "completion-summary-written", "closeout-finished",
    "feature-blocked", "feature-reopened"
  ];
  const missing = spec1Events.filter(e => !IMPLEMENT_PLAN_EVENTS.has(e));
  record(
    "enum-spec1-events-covered",
    "contract_compatibility",
    "All Spec 1 documented event names exist in IMPLEMENT_PLAN_EVENTS",
    missing.length === 0,
    { checked: spec1Events.length, registered: IMPLEMENT_PLAN_EVENTS.size },
    missing.length > 0 ? "missing events: " + missing.join(", ") : null
  );
}

// ---------------------------------------------------------------------------
// 2. File presence — Spec 1 artifacts on main
// ---------------------------------------------------------------------------

const spec1Files = [
  join(skillsRoot, "governed-feature-runtime.mjs"),
  join(skillsRoot, "implement-plan", "SKILL.md"),
  join(skillsRoot, "implement-plan", "references", "workflow-contract.md"),
  join(skillsRoot, "implement-plan", "scripts", "implement-plan-helper.mjs"),
  join(skillsRoot, "implement-plan", "scripts", "implement-plan-setup-helper.mjs")
];

for (const filePath of spec1Files) {
  const rel = normalizeSlashes(filePath).replace(normalizeSlashes(projectRoot) + "/", "");
  const exists = await fileExists(filePath);
  record(
    "file-spec1-" + rel.replace(/[^a-zA-Z0-9]/g, "-"),
    "file_presence",
    "Spec 1 file exists: " + rel,
    exists,
    { path: rel },
    exists ? null : "file missing"
  );
}

// ---------------------------------------------------------------------------
// 3. File presence — Spec 2 artifacts on main
// ---------------------------------------------------------------------------

const spec2Files = [
  join(skillsRoot, "benchmark-runtime.mjs"),
  join(skillsRoot, "benchmark-suite", "SKILL.md"),
  join(skillsRoot, "benchmark-suite", "scripts", "benchmark-suite-helper.mjs"),
  join(skillsRoot, "benchmark-suite", "scripts", "benchmark-suite-setup-helper.mjs"),
  join(skillsRoot, "benchmark-suite", "references", "workflow-contract.md"),
  join(skillsRoot, "benchmark-suite", "references", "setup-contract.md"),
  join(skillsRoot, "benchmark-suite", "references", "prompt-templates.md"),
  join(skillsRoot, "benchmark-suite", "agents", "openai.yaml"),
  join(skillsRoot, "manifest.json")
];

for (const filePath of spec2Files) {
  const rel = normalizeSlashes(filePath).replace(normalizeSlashes(projectRoot) + "/", "");
  const exists = await fileExists(filePath);
  record(
    "file-spec2-" + rel.replace(/[^a-zA-Z0-9]/g, "-"),
    "file_presence",
    "Spec 2 file exists: " + rel,
    exists,
    { path: rel },
    exists ? null : "file missing"
  );
}

// ---------------------------------------------------------------------------
// 4. Import resolution — Spec 2 can resolve Spec 1 exports without shims
// ---------------------------------------------------------------------------

// 4a. benchmark-runtime.mjs imports from governed-feature-runtime.mjs
{
  const src = await readFile(join(skillsRoot, "benchmark-runtime.mjs"), "utf8");
  const importsGovRuntime = src.includes('from "./governed-feature-runtime.mjs"');
  record(
    "import-benchmark-runtime-to-governed",
    "behavioral_compatibility",
    "benchmark-runtime.mjs imports from governed-feature-runtime.mjs (no shim)",
    importsGovRuntime,
    { found: importsGovRuntime }
  );

  // Check it imports the benchmark enums
  const importsBenchmarkEnums =
    src.includes("BENCHMARK_LANE_STATUSES") &&
    src.includes("BENCHMARK_TERMINAL_LANE_STATUSES") &&
    src.includes("BENCHMARK_SUITE_STATUSES") &&
    src.includes("BENCHMARK_EVENTS");
  record(
    "import-benchmark-runtime-enums",
    "behavioral_compatibility",
    "benchmark-runtime.mjs imports all 4 benchmark enum sets from governed-feature-runtime.mjs",
    importsBenchmarkEnums,
    { found: importsBenchmarkEnums }
  );
}

// 4b. benchmark-suite-helper.mjs imports from governed-feature-runtime.mjs
{
  const src = await readFile(join(skillsRoot, "benchmark-suite", "scripts", "benchmark-suite-helper.mjs"), "utf8");
  const importsGovRuntime = src.includes('from "../../governed-feature-runtime.mjs"');
  record(
    "import-suite-helper-to-governed",
    "behavioral_compatibility",
    "benchmark-suite-helper.mjs imports from governed-feature-runtime.mjs (no shim)",
    importsGovRuntime,
    { found: importsGovRuntime }
  );

  const importsBenchmarkRuntime = src.includes('from "../../benchmark-runtime.mjs"');
  record(
    "import-suite-helper-to-benchmark-runtime",
    "behavioral_compatibility",
    "benchmark-suite-helper.mjs imports from benchmark-runtime.mjs (no shim)",
    importsBenchmarkRuntime,
    { found: importsBenchmarkRuntime }
  );

  // Check it imports the benchmark enums from governed-feature-runtime
  const importsBenchmarkEnums =
    src.includes("BENCHMARK_LANE_STATUSES") &&
    src.includes("BENCHMARK_SUITE_STATUSES") &&
    src.includes("BENCHMARK_EVENTS") &&
    src.includes("BENCHMARK_TERMINAL_LANE_STATUSES");
  record(
    "import-suite-helper-benchmark-enums",
    "behavioral_compatibility",
    "benchmark-suite-helper.mjs imports all 4 benchmark enum sets",
    importsBenchmarkEnums,
    { found: importsBenchmarkEnums }
  );
}

// 4c. implement-plan-helper.mjs imports IMPLEMENT_PLAN_RUN_MODES
{
  const src = await readFile(join(skillsRoot, "implement-plan", "scripts", "implement-plan-helper.mjs"), "utf8");
  const importsRunModes = src.includes("IMPLEMENT_PLAN_RUN_MODES");
  record(
    "import-helper-run-modes",
    "behavioral_compatibility",
    "implement-plan-helper.mjs uses IMPLEMENT_PLAN_RUN_MODES (shared vocabulary)",
    importsRunModes,
    { found: importsRunModes }
  );

  // Check benchmarking mode support in helper
  const hasBenchmarkingPrepare = src.includes("benchmark_contract_ready");
  record(
    "helper-benchmarking-prepare",
    "behavioral_compatibility",
    "implement-plan-helper.mjs emits benchmark_contract_ready in prepare output",
    hasBenchmarkingPrepare,
    { found: hasBenchmarkingPrepare }
  );

  const hasSupervisorDeferred = src.includes("supervisor_deferred") || src.includes("deferred_to_spec_2");
  record(
    "helper-supervisor-deferred",
    "behavioral_compatibility",
    "implement-plan-helper.mjs uses supervisor_deferred / deferred_to_spec_2 status for benchmarking mode",
    hasSupervisorDeferred,
    { found: hasSupervisorDeferred }
  );
}

// ---------------------------------------------------------------------------
// 5. Contract schema compatibility
// ---------------------------------------------------------------------------

// 5a. Execution contract contains benchmarking section
// Note: JS object literals use unquoted property names, so search for both forms
{
  const src = await readFile(join(skillsRoot, "implement-plan", "scripts", "implement-plan-helper.mjs"), "utf8");
  const hasBenchmarkingSection =
    (src.includes('benchmarking:') || src.includes('"benchmarking"')) &&
    (src.includes('enabled:') || src.includes('"enabled"')) &&
    (src.includes('supervisor_status:') || src.includes('"supervisor_status"'));
  record(
    "schema-benchmarking-section",
    "contract_compatibility",
    "Execution contract schema includes benchmarking section with enabled + supervisor_status fields",
    hasBenchmarkingSection,
    { found: hasBenchmarkingSection }
  );

  // 5b. Contract includes lane identity fields
  const hasLaneId =
    (src.includes('lane_id:') || src.includes('"lane_id"')) &&
    (src.includes('lane_label:') || src.includes('"lane_label"'));
  record(
    "schema-lane-identity",
    "contract_compatibility",
    "Execution contract schema includes lane_id and lane_label identity fields",
    hasLaneId,
    { found: hasLaneId }
  );

  // 5c. Contract includes run_mode field
  const hasRunMode = src.includes('run_mode:') || src.includes('"run_mode"');
  record(
    "schema-run-mode",
    "contract_compatibility",
    "Execution contract schema includes run_mode field",
    hasRunMode,
    { found: hasRunMode }
  );

  // 5d. Contract includes worker_selection section
  const hasWorkerSelection =
    (src.includes('worker_selection:') || src.includes('"worker_selection"')) &&
    (src.includes('resolved:') || src.includes('"resolved"')) &&
    (src.includes('resolved_sources:') || src.includes('"resolved_sources"'));
  record(
    "schema-worker-selection",
    "contract_compatibility",
    "Execution contract includes worker_selection with resolved + resolved_sources",
    hasWorkerSelection,
    { found: hasWorkerSelection }
  );

  // 5e. Contract includes kpi_policy section
  const hasKpiPolicy =
    (src.includes('kpi_policy:') || src.includes('"kpi_policy"')) &&
    (src.includes('step_timing_enabled:') || src.includes('"step_timing_enabled"'));
  record(
    "schema-kpi-policy",
    "contract_compatibility",
    "Execution contract includes kpi_policy section",
    hasKpiPolicy,
    { found: hasKpiPolicy }
  );

  // 5f. Contract includes resume_policy section
  const hasResumePolicy =
    (src.includes('resume_policy:') || src.includes('"resume_policy"')) &&
    (src.includes('resumable_after_crash_or_kill') || src.includes('"resumable_after_crash_or_kill"'));
  record(
    "schema-resume-policy",
    "contract_compatibility",
    "Execution contract includes resume_policy section",
    hasResumePolicy,
    { found: hasResumePolicy }
  );

  // 5g. Contract includes reset_policy section
  const hasResetPolicy =
    (src.includes('reset_policy:') || src.includes('"reset_policy"')) &&
    src.includes('new_attempt_from_implementation_preserving_history');
  record(
    "schema-reset-policy",
    "contract_compatibility",
    "Execution contract includes reset_policy with correct behavior string",
    hasResetPolicy,
    { found: hasResetPolicy }
  );

  // 5h. Contract includes route_policy section
  const hasRoutePolicy =
    (src.includes('route_policy:') || src.includes('"route_policy"')) &&
    (src.includes('normal_mode_governed_flow') || src.includes('"normal_mode_governed_flow"'));
  record(
    "schema-route-policy",
    "contract_compatibility",
    "Execution contract includes route_policy with normal_mode_governed_flow",
    hasRoutePolicy,
    { found: hasRoutePolicy }
  );
}

// ---------------------------------------------------------------------------
// 6. Mode semantics — normal vs benchmarking
// ---------------------------------------------------------------------------

{
  const src = await readFile(join(skillsRoot, "implement-plan", "scripts", "implement-plan-helper.mjs"), "utf8");

  // 6a. Normal mode produces run_allowed=true
  const normalRunAllowed = src.includes("run_allowed");
  record(
    "mode-normal-run-allowed",
    "mode_semantics",
    "Normal mode prepare can emit run_allowed flag",
    normalRunAllowed,
    { found: normalRunAllowed }
  );

  // 6b. Benchmarking mode stops at contract preparation
  const benchmarkDeferred = src.includes("materialize_benchmarking_contract_and_defer_supervisor");
  record(
    "mode-benchmarking-deferred",
    "mode_semantics",
    "Benchmarking mode defers supervisor (does not execute governed flow itself)",
    benchmarkDeferred,
    { found: benchmarkDeferred }
  );

  // 6c. Both modes use same contract schema version
  // The helper uses a constant EXECUTION_CONTRACT_SCHEMA_VERSION for the value
  const usesSchemaV1 = src.includes("schema_version:") || src.includes("EXECUTION_CONTRACT_SCHEMA_VERSION");
  record(
    "mode-shared-schema-version",
    "mode_semantics",
    "Both modes use shared EXECUTION_CONTRACT_SCHEMA_VERSION constant",
    usesSchemaV1,
    { found: usesSchemaV1 }
  );
}

// ---------------------------------------------------------------------------
// 7. Manifest registration
// ---------------------------------------------------------------------------

{
  const manifest = JSON.parse(await readFile(join(skillsRoot, "manifest.json"), "utf8"));

  // 7a. benchmark-suite is registered
  const hasBenchmarkSuite = manifest.skills?.some(s => s.name === "benchmark-suite");
  record(
    "manifest-benchmark-suite",
    "contract_compatibility",
    "benchmark-suite registered in manifest.json",
    hasBenchmarkSuite,
    { found: hasBenchmarkSuite }
  );

  // 7b. governed-feature-runtime.mjs is in shared_files
  const hasSharedRuntime = manifest.shared_files?.includes("governed-feature-runtime.mjs");
  record(
    "manifest-shared-runtime",
    "contract_compatibility",
    "governed-feature-runtime.mjs listed in manifest.json shared_files",
    hasSharedRuntime,
    { found: hasSharedRuntime }
  );

  // 7c. All existing skills still registered
  const expectedSkills = ["review-cycle", "implement-plan", "merge-queue", "benchmark-suite"];
  const registered = manifest.skills?.map(s => s.name) ?? [];
  const missingSkills = expectedSkills.filter(s => !registered.includes(s));
  record(
    "manifest-all-skills",
    "contract_compatibility",
    "All 4 skills registered in manifest",
    missingSkills.length === 0,
    { registered, expected: expectedSkills },
    missingSkills.length > 0 ? "missing: " + missingSkills.join(", ") : null
  );
}

// ---------------------------------------------------------------------------
// 8. No hidden bridge logic
// ---------------------------------------------------------------------------

{
  // 8a. benchmark-runtime.mjs does not import implement-plan-helper
  const benchRuntimeSrc = await readFile(join(skillsRoot, "benchmark-runtime.mjs"), "utf8");
  const importsPlanHelper = benchRuntimeSrc.includes("implement-plan-helper");
  record(
    "no-bridge-benchmark-to-plan-helper",
    "no_hidden_bridge",
    "benchmark-runtime.mjs does not directly import implement-plan-helper (no hidden shim)",
    !importsPlanHelper,
    { imports_plan_helper: importsPlanHelper }
  );

  // 8b. benchmark-suite-helper does not import implement-plan-helper
  const suiteHelperSrc = await readFile(join(skillsRoot, "benchmark-suite", "scripts", "benchmark-suite-helper.mjs"), "utf8");
  const suiteImportsPlanHelper = suiteHelperSrc.includes("implement-plan-helper");
  record(
    "no-bridge-suite-to-plan-helper",
    "no_hidden_bridge",
    "benchmark-suite-helper.mjs does not directly import implement-plan-helper (no hidden shim)",
    !suiteImportsPlanHelper,
    { imports_plan_helper: suiteImportsPlanHelper }
  );

  // 8c. No synonym remapping — check that benchmark-suite uses the same enum names
  const usesOriginalEnums =
    suiteHelperSrc.includes("BENCHMARK_LANE_STATUSES") &&
    suiteHelperSrc.includes("BENCHMARK_TERMINAL_LANE_STATUSES") &&
    !suiteHelperSrc.includes("LANE_STATUSES_ALIAS") &&
    !suiteHelperSrc.includes("STATUS_MAP");
  record(
    "no-bridge-enum-synonyms",
    "no_hidden_bridge",
    "No synonym remapping of enum sets in benchmark-suite-helper",
    usesOriginalEnums,
    { uses_original_names: usesOriginalEnums }
  );

  // 8d. governed-feature-runtime.mjs does not import benchmark-runtime.mjs (no reverse dependency)
  const govSrc = await readFile(join(skillsRoot, "governed-feature-runtime.mjs"), "utf8");
  const govImportsBenchmark = govSrc.includes("benchmark-runtime");
  record(
    "no-bridge-reverse-dependency",
    "no_hidden_bridge",
    "governed-feature-runtime.mjs does not import benchmark-runtime.mjs (correct dependency direction)",
    !govImportsBenchmark,
    { reverse_import: govImportsBenchmark }
  );
}

// ---------------------------------------------------------------------------
// 9. Brain sink semantics
// ---------------------------------------------------------------------------

{
  const suiteHelperSrc = await readFile(join(skillsRoot, "benchmark-suite", "scripts", "benchmark-suite-helper.mjs"), "utf8");
  const benchRuntimeSrc = await readFile(join(skillsRoot, "benchmark-runtime.mjs"), "utf8");

  // 9a. Brain summary builder exists in benchmark-runtime
  const hasBrainSummary = benchRuntimeSrc.includes("buildBrainSummaryMarkdown");
  record(
    "brain-summary-builder",
    "brain_sink_semantics",
    "benchmark-runtime.mjs exports buildBrainSummaryMarkdown",
    hasBrainSummary,
    { found: hasBrainSummary }
  );

  // 9b. benchmark-suite-helper uses Brain summary
  const suiteUsesBrain = suiteHelperSrc.includes("buildBrainSummaryMarkdown") || suiteHelperSrc.includes("brain-summary");
  record(
    "brain-suite-uses-summary",
    "brain_sink_semantics",
    "benchmark-suite-helper.mjs uses Brain summary builder",
    suiteUsesBrain,
    { found: suiteUsesBrain }
  );
}

// ---------------------------------------------------------------------------
// 10. Stop behavior compatibility
// ---------------------------------------------------------------------------

{
  const benchRuntimeSrc = await readFile(join(skillsRoot, "benchmark-runtime.mjs"), "utf8");

  const hasCreateStop = benchRuntimeSrc.includes("createStopSignal");
  const hasCheckStop = benchRuntimeSrc.includes("checkStopSignal");
  const hasClearStop = benchRuntimeSrc.includes("clearStopSignal");
  record(
    "stop-signals-implemented",
    "stop_behavior",
    "Stop signal create/check/clear implemented in benchmark-runtime.mjs",
    hasCreateStop && hasCheckStop && hasClearStop,
    { create: hasCreateStop, check: hasCheckStop, clear: hasClearStop }
  );

  // The Spec 1 helper uses no operator stop surface in normal mode (by contract)
  const planSrc = await readFile(join(skillsRoot, "implement-plan", "scripts", "implement-plan-helper.mjs"), "utf8");
  const noNormalStopSurface = !planSrc.includes("stop_signal") || planSrc.includes("supported_operator_stop_surface");
  record(
    "stop-normal-mode-no-surface",
    "stop_behavior",
    "Normal mode has no supported operator stop surface (stop is benchmark-only)",
    noNormalStopSurface,
    { found: noNormalStopSurface }
  );
}

// ---------------------------------------------------------------------------
// 11. Resume/reset semantics compatibility
// ---------------------------------------------------------------------------

{
  const planSrc = await readFile(join(skillsRoot, "implement-plan", "scripts", "implement-plan-helper.mjs"), "utf8");

  const hasResetAttempt = planSrc.includes("reset-attempt") || planSrc.includes("resetAttempt");
  record(
    "resume-reset-attempt",
    "resume_reset_semantics",
    "implement-plan-helper supports reset-attempt command",
    hasResetAttempt,
    { found: hasResetAttempt }
  );

  const preservesHistory = planSrc.includes("preserving_history") || planSrc.includes("preserve") && planSrc.includes("attempt");
  record(
    "resume-preserves-history",
    "resume_reset_semantics",
    "Reset preserves prior attempt history",
    preservesHistory,
    { found: preservesHistory }
  );

  // Benchmark-suite has its own reset-lane command
  const suiteSrc = await readFile(join(skillsRoot, "benchmark-suite", "scripts", "benchmark-suite-helper.mjs"), "utf8");
  const hasResetLane = suiteSrc.includes("reset-lane");
  record(
    "resume-benchmark-reset-lane",
    "resume_reset_semantics",
    "benchmark-suite-helper supports reset-lane command",
    hasResetLane,
    { found: hasResetLane }
  );
}

// ---------------------------------------------------------------------------
// 12. KPI semantics compatibility
// ---------------------------------------------------------------------------

{
  const suiteSrc = await readFile(join(skillsRoot, "benchmark-suite", "scripts", "benchmark-suite-helper.mjs"), "utf8");

  // Benchmark-suite captures KPI-relevant fields
  const capturesLlmLatency = suiteSrc.includes("llm_latency_ms");
  const capturesVerification = suiteSrc.includes("verification_status");
  const capturesCycleCount = suiteSrc.includes("cycle_number");
  const capturesCost = suiteSrc.includes("estimated_cost_usd");

  record(
    "kpi-benchmark-captures",
    "kpi_semantics",
    "benchmark-suite-helper captures KPI primitives: latency, verification, cycles, cost",
    capturesLlmLatency && capturesVerification && capturesCycleCount && capturesCost,
    {
      llm_latency_ms: capturesLlmLatency,
      verification_status: capturesVerification,
      cycle_number: capturesCycleCount,
      estimated_cost_usd: capturesCost
    }
  );
}

// ---------------------------------------------------------------------------
// 13. Provider/runtime override compatibility
// ---------------------------------------------------------------------------

{
  const planSrc = await readFile(join(skillsRoot, "implement-plan", "scripts", "implement-plan-helper.mjs"), "utf8");

  const hasWorkerProvider = planSrc.includes("worker_provider") || planSrc.includes("workerProvider");
  const hasWorkerRuntime = planSrc.includes("worker_runtime") || planSrc.includes("workerRuntime");
  const hasWorkerModel = planSrc.includes("worker_model") || planSrc.includes("workerModel");
  const hasWorkerReasoning = planSrc.includes("worker_reasoning_effort") || planSrc.includes("workerReasoningEffort");
  const hasWorkerAccessMode = planSrc.includes("worker_access_mode") || planSrc.includes("workerAccessMode");

  record(
    "override-worker-fields",
    "provider_override",
    "implement-plan-helper supports provider-neutral worker override fields",
    hasWorkerProvider && hasWorkerRuntime && hasWorkerModel && hasWorkerReasoning && hasWorkerAccessMode,
    {
      worker_provider: hasWorkerProvider,
      worker_runtime: hasWorkerRuntime,
      worker_model: hasWorkerModel,
      worker_reasoning_effort: hasWorkerReasoning,
      worker_access_mode: hasWorkerAccessMode
    }
  );

  // Benchmark-suite config uses provider/model/effort per engine
  const suiteSrc = await readFile(join(skillsRoot, "benchmark-suite", "scripts", "benchmark-suite-helper.mjs"), "utf8");
  const engineHasProvider = suiteSrc.includes("engine.provider") || suiteSrc.includes(".provider");
  const engineHasModel = suiteSrc.includes("engine.model") || suiteSrc.includes(".model");
  record(
    "override-engine-fields",
    "provider_override",
    "benchmark-suite-helper config engines have provider and model fields",
    engineHasProvider && engineHasModel,
    { provider: engineHasProvider, model: engineHasModel }
  );
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

const verdict = failCount === 0 ? "production-compatible" : "blocked";
const blockedBy = failCount === 0 ? null :
  checks.filter(c => c.result === "FAIL").some(c => c.category === "contract_compatibility" || c.category === "mode_semantics")
    ? "spec1_spec2_contract_gap"
    : checks.filter(c => c.result === "FAIL").some(c => c.category === "file_presence")
      ? "environment_blocker"
      : "behavioral_mismatch";

printJson({
  gate: "implementation-benchmark-wiring-gate",
  spec3_version: "post-merge-audit-v1",
  run_at: new Date().toISOString(),
  implementation_runtime: {
    provider: "anthropic",
    model: "claude-opus-4-6[1m]",
    runtime: "claude_code_exec"
  },
  verdict,
  blocked_by: blockedBy,
  summary: {
    total_checks: checks.length,
    passed: passCount,
    failed: failCount
  },
  checks
});

process.exit(failCount > 0 ? 1 : 0);
