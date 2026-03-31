import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { invoke } from "../../../../shared/llm-invoker/invoker.js";
import type { InvocationResult, InvocationSessionHandle } from "../../../../shared/llm-invoker/types.js";
import { runRulesComplianceEnforcer } from "../../../../shared/rules-compliance-enforcer/engine.js";

type Provider = "codex" | "claude" | "gemini";
type Severity = "blocking" | "major" | "minor" | "suggestion" | "none";
type RuleStatus = "compliant" | "non_compliant" | "not_applicable";
type RunStatus = "approved" | "cycle_cap" | "review_error" | "sanity_failed";

const ROLE_START = "<<<ROLE_MD>>>";
const ROLE_END = "<<<END_ROLE_MD>>>";
const CONTRACT_START = "<<<ROLE_CONTRACT_JSON>>>";
const CONTRACT_END = "<<<END_ROLE_CONTRACT_JSON>>>";

interface ModelConfig {
  provider: Provider;
  model: string;
  reasoning?: string;
  timeout_ms: number;
}

interface Config {
  schema_version: "1.0";
  experiment_slug: string;
  reviewer_model: ModelConfig;
  fixer_model: ModelConfig;
  execution: {
    review_concurrency_limit: number;
    retry_once_on_failure: boolean;
    retry_backoff_ms: number;
    max_cycles: number;
  };
}

interface ScenarioConfig {
  scenario_slug: string;
  final_full_sanity_sweep: boolean;
  fixture: {
    role_markdown_path: string;
    contract_json_path: string;
    artifact_path_hint: string;
    component_name: string;
  };
}

interface RuleRecord {
  id: string;
  rule: string;
  applies_to: string[];
  do: string;
  dont: string;
  source: string;
  version: number;
}

interface Rulebook {
  rules: RuleRecord[];
}

interface GroupManifest {
  groups: Array<{ id: string; rules: string[] }>;
}

interface ReviewerEvaluation {
  rule_id: string;
  status: RuleStatus;
  severity: Severity;
  summary: string;
  evidence_location: string;
  evidence_quote: string;
  why_it_matters: string;
}

interface ReviewerResponse {
  reviewer_id: string;
  scenario: string;
  scope_id: string;
  evaluations: ReviewerEvaluation[];
  notes: string[];
}

interface ReviewerTask {
  taskId: string;
  scopeId: string;
  rules: RuleRecord[];
}

interface SessionRegistry {
  schema_version: "1.0";
  scenario_slug: string;
  updated_at: string;
  slots: Record<string, InvocationSessionHandle>;
}

interface InvocationSummary {
  provider: Provider;
  model: string;
  reasoning: string | null;
  session_statuses: string[];
  tokens_in_estimated: number;
  tokens_out_estimated: number;
  estimated_cost_usd: number;
  total_latency_ms: number;
  attempt_count: number;
}

interface ReviewTaskResult {
  task_id: string;
  scope_id: string;
  success: boolean;
  latency_ms: number;
  started_at: string;
  completed_at: string;
  reviewer_response: ReviewerResponse | null;
  error_message: string | null;
  invocation: InvocationSummary | null;
}

interface NormalizedFinding {
  finding_id: string;
  source_task_id: string;
  scope_id: string;
  rule_id: string;
  severity: Severity;
  summary: string;
  evidence_location: string;
  evidence_quote: string;
  why_it_matters: string;
}

interface CycleSummary {
  cycle: number;
  phase: "normal" | "final_sanity";
  active_rule_ids: string[];
  findings_count: number;
  review_error_count: number;
  review_time_ms: number;
  fix_time_ms: number;
  approved: boolean;
  fixed_changed_artifact: boolean;
}

interface RuntimeState {
  schema_version: "1.0";
  scenario_slug: string;
  run_id: string;
  run_started_at: string;
  current_artifact_text: string;
  current_contract_json_text: string;
  current_rulebook: RuleRecord[];
  inactive_rule_ids: string[];
  cycle_summaries: CycleSummary[];
  failed_reviews: number;
  review_invocations: InvocationSummary[];
  fix_invocations: InvocationSummary[];
  final_sanity_completed: boolean;
  approved: boolean;
  run_status: RunStatus;
}

interface ParsedArgs {
  scenarioPath: string;
  runId: string;
  stopAfterCycle: number | null;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const root = resolve(process.cwd());
  const config = await readJson<Config>(join(root, "tools", "agent-role-builder", "tests", "grouped-shrinking-readiness", "config.json"));
  const scenario = await readJson<ScenarioConfig>(resolve(root, args.scenarioPath));
  const scenarioDir = dirname(resolve(root, args.scenarioPath));
  const resultDir = join(scenarioDir, "results", args.runId);
  const cycleRoot = join(resultDir, "cycles");
  const progressLog = join(resultDir, "progress.log");
  const runtimeStatePath = join(resultDir, "runtime-state.json");
  const kpiSummaryPath = join(resultDir, "kpi-summary.json");
  const runManifestPath = join(resultDir, "run-manifest.json");

  if (await fileExists(kpiSummaryPath)) {
    await log(progressLog, `already completed ${scenario.scenario_slug}`);
    return;
  }

  const reviewPrompt = await readJson<Record<string, unknown>>(join(root, "tools", "agent-role-builder", "review-prompt.json"));
  const rulebook = await readJson<Rulebook>(join(root, "tools", "agent-role-builder", "rulebook.json"));
  const groupManifest = await readJson<GroupManifest>(join(root, "tools", "agent-role-builder", "tests", "enforcer-parallel-review-shape", "grouped-by-relevance", "groups.json"));
  const roleMarkdown = await readFile(resolve(root, scenario.fixture.role_markdown_path), "utf-8");
  const contractJsonText = await readFile(resolve(root, scenario.fixture.contract_json_path), "utf-8");
  const sourceAuthorityPaths = [
    join(root, "docs", "v0", "review-process-architecture.md"),
    join(root, "docs", "v0", "architecture.md"),
  ];

  await mkdir(resultDir, { recursive: true });
  await mkdir(cycleRoot, { recursive: true });
  await writeFile(runManifestPath, JSON.stringify({
    schema_version: "1.0",
    scenario_slug: scenario.scenario_slug,
    run_id: args.runId,
    final_full_sanity_sweep: scenario.final_full_sanity_sweep,
    fixture: scenario.fixture,
  }, null, 2), "utf-8");

  const sessionRegistryPath = join(resultDir, "session-registry.json");
  const sessionRegistry = await loadOrCreateSessionRegistry(sessionRegistryPath, scenario.scenario_slug);
  const priorState = await loadRuntimeState(runtimeStatePath);

  let currentArtifactText = priorState?.current_artifact_text ?? renderBundle(roleMarkdown, contractJsonText);
  let currentContractJsonText = priorState?.current_contract_json_text ?? contractJsonText;
  let currentRulebook = priorState?.current_rulebook ?? [...rulebook.rules];
  const ruleState = new Map(currentRulebook.map((rule) => [rule.id, { active: true }]));
  for (const ruleId of priorState?.inactive_rule_ids ?? []) {
    ruleState.set(ruleId, { active: false });
  }
  const cycleSummaries = priorState?.cycle_summaries ?? [];
  const reviewInvocations = priorState?.review_invocations ?? [];
  const fixInvocations = priorState?.fix_invocations ?? [];
  let failedReviews = priorState?.failed_reviews ?? 0;
  let approved = priorState?.approved ?? false;
  let runStatus: RunStatus = priorState?.run_status ?? "cycle_cap";
  let finalSanityCompleted = priorState?.final_sanity_completed ?? false;
  const runStartedAt = priorState?.run_started_at ?? new Date().toISOString();

  if (priorState) {
    await log(progressLog, `resumed ${scenario.scenario_slug} from cycle ${cycleSummaries.length + 1}`);
  } else {
    await log(progressLog, `started ${scenario.scenario_slug}`);
  }

  for (let cycle = cycleSummaries.length + 1; cycle <= config.execution.max_cycles; cycle++) {
    const activeRuleIds = currentRulebook.filter((rule) => ruleState.get(rule.id)?.active !== false).map((rule) => rule.id);
    const tasks = buildGroupedTasks(currentRulebook.filter((rule) => activeRuleIds.includes(rule.id)), groupManifest);
    const cycleDir = join(cycleRoot, `cycle-${cycle}`);
    const promptsDir = join(cycleDir, "reviewer-prompts");
    const outputsDir = join(cycleDir, "reviewer-outputs");
    await mkdir(promptsDir, { recursive: true });
    await mkdir(outputsDir, { recursive: true });
    await writeArtifactFiles(cycleDir, "artifact-before-fix", currentArtifactText);
    await writeFile(join(cycleDir, "active-rules.json"), JSON.stringify(activeRuleIds, null, 2), "utf-8");
    await log(progressLog, `cycle ${cycle}: ${tasks.length} review tasks`);

    const reviewStartedMs = Date.now();
    const reviewResults = await runWithConcurrency(tasks, config.execution.review_concurrency_limit, async (task) => {
      const reviewBundle = await writeReviewerBundle(cycleDir, task, currentArtifactText, currentContractJsonText);
      const prompt = buildReviewerPrompt(scenario.scenario_slug, task, reviewBundle, reviewPrompt);
      await writeFile(join(promptsDir, `${sanitize(task.taskId)}.txt`), prompt, "utf-8");
      const startedMs = Date.now();
      const startedAt = new Date(startedMs).toISOString();
      try {
        const invocation = await invokeWithResume(
          config.reviewer_model,
          prompt,
          `tools/agent-role-builder/tests/grouped-shrinking-readiness/${scenario.scenario_slug}/${task.taskId}`,
          `review-${task.taskId}`,
          sessionRegistry,
          sessionRegistryPath,
          config.execution.retry_once_on_failure,
          config.execution.retry_backoff_ms
        );
        const invocationSummary = summarizeInvocation(invocation);
        reviewInvocations.push(invocationSummary);
        const parsed = parseReviewerResponse(invocation.response);
        const completedMs = Date.now();
        const result: ReviewTaskResult = {
          task_id: task.taskId,
          scope_id: task.scopeId,
          success: true,
          latency_ms: completedMs - startedMs,
          started_at: startedAt,
          completed_at: new Date(completedMs).toISOString(),
          reviewer_response: parsed,
          error_message: null,
          invocation: invocationSummary,
        };
        await writeFile(join(outputsDir, `${sanitize(task.taskId)}.json`), JSON.stringify(result, null, 2), "utf-8");
        return result;
      } catch (error) {
        const completedMs = Date.now();
        const message = error instanceof Error ? error.message : String(error);
        const result: ReviewTaskResult = {
          task_id: task.taskId,
          scope_id: task.scopeId,
          success: false,
          latency_ms: completedMs - startedMs,
          started_at: startedAt,
          completed_at: new Date(completedMs).toISOString(),
          reviewer_response: null,
          error_message: message,
          invocation: null,
        };
        await writeFile(join(outputsDir, `${sanitize(task.taskId)}.error.json`), JSON.stringify(result, null, 2), "utf-8");
        return result;
      }
    });
    const reviewTimeMs = Date.now() - reviewStartedMs;
    const normalizedFindings = normalizeFindings(reviewResults);
    const reviewErrorCount = reviewResults.filter((result) => !result.success).length;
    await writeFile(join(cycleDir, "review-results.json"), JSON.stringify(reviewResults, null, 2), "utf-8");
    await writeFile(join(cycleDir, "normalized-findings.json"), JSON.stringify(normalizedFindings, null, 2), "utf-8");

    if (reviewErrorCount > 0) {
      cycleSummaries.push({
        cycle,
        phase: "normal",
        active_rule_ids: activeRuleIds,
        findings_count: normalizedFindings.length,
        review_error_count: reviewErrorCount,
        review_time_ms: reviewTimeMs,
        fix_time_ms: 0,
        approved: false,
        fixed_changed_artifact: false,
      });
      runStatus = "review_error";
      await persistState(runtimeStatePath, scenario.scenario_slug, args.runId, runStartedAt, currentArtifactText, currentContractJsonText, currentRulebook, ruleState, cycleSummaries, failedReviews, reviewInvocations, fixInvocations, finalSanityCompleted, approved, runStatus);
      await log(progressLog, `cycle ${cycle}: review errors=${reviewErrorCount}, stopping`);
      break;
    }

    if (normalizedFindings.length === 0) {
      approved = true;
      runStatus = "approved";
      cycleSummaries.push({
        cycle,
        phase: "normal",
        active_rule_ids: activeRuleIds,
        findings_count: 0,
        review_error_count: 0,
        review_time_ms: reviewTimeMs,
        fix_time_ms: 0,
        approved: true,
        fixed_changed_artifact: false,
      });
      await persistState(runtimeStatePath, scenario.scenario_slug, args.runId, runStartedAt, currentArtifactText, currentContractJsonText, currentRulebook, ruleState, cycleSummaries, failedReviews, reviewInvocations, fixInvocations, finalSanityCompleted, approved, runStatus);
      await log(progressLog, `cycle ${cycle}: approved`);
      break;
    }

    failedReviews += 1;
    await log(progressLog, `cycle ${cycle}: running fix stage`);
    const fixStartedMs = Date.now();
    const fixResult = await runRulesComplianceEnforcer(
      {
        component: scenario.fixture.component_name,
        mode: cycle === 1 ? "initial_rule_sweep" : "revision",
        round: cycle,
        artifactTag: "draft",
        artifactPathHint: scenario.fixture.artifact_path_hint,
        artifactText: currentArtifactText,
        requiredArtifactInstructions: buildBundleFixInstructions(),
        rulebook: currentRulebook,
        newRuleIds: [],
        findings: normalizedFindings.map((finding) => ({
          groupId: finding.rule_id,
          severity: finding.severity === "none" ? "minor" : finding.severity,
          summary: finding.summary,
          redesignGuidance: `${finding.why_it_matters}\nEvidence: ${finding.evidence_location}\nQuote: ${finding.evidence_quote}`,
          findingCount: 1,
        })),
        unresolved: normalizedFindings.map((finding) => finding.rule_id),
        leaderRationale: `Grouped-shrinking readiness fix pass for cycle ${cycle}.`,
        selfCheckIssues: [],
        bundleDir: join(cycleDir, "fixer"),
        reviewPromptPath: join(root, "tools", "agent-role-builder", "review-prompt.json"),
        reviewContractPath: join(root, "tools", "agent-role-builder", "review-contract.json"),
        sourceAuthorityPaths,
      },
      async (prompt: string, sourcePath: string) => {
        const invocation = await invokeWithResume(
          config.fixer_model,
          prompt,
          sourcePath,
          "fixer-main",
          sessionRegistry,
          sessionRegistryPath,
          config.execution.retry_once_on_failure,
          config.execution.retry_backoff_ms
        );
        fixInvocations.push(summarizeInvocation(invocation));
        return {
          response: invocation.response,
          provenance: {
            invocation_id: invocation.provenance.invocation_id,
            provider: invocation.provenance.provider,
            model: invocation.provenance.model,
            was_fallback: invocation.provenance.was_fallback,
          },
        };
      }
    );
    const fixTimeMs = Date.now() - fixStartedMs;
    currentArtifactText = normalizeBundleArtifact(fixResult.artifact, currentContractJsonText);
    currentContractJsonText = parseBundle(currentArtifactText)?.contractJsonText ?? currentContractJsonText;
    await writeArtifactFiles(cycleDir, "artifact-after-fix", currentArtifactText);
    await writeFile(join(cycleDir, "fix-result.json"), JSON.stringify(fixResult, null, 2), "utf-8");

    updateActiveRuleSet(ruleState, reviewResults);
    const cycleSummary: CycleSummary = {
      cycle,
      phase: "normal",
      active_rule_ids: activeRuleIds,
      findings_count: normalizedFindings.length,
      review_error_count: 0,
      review_time_ms: reviewTimeMs,
      fix_time_ms: fixTimeMs,
      approved: false,
      fixed_changed_artifact: fixResult.diffSummary.changed,
    };
    cycleSummaries.push(cycleSummary);
    await writeFile(join(cycleDir, "cycle-summary.json"), JSON.stringify(cycleSummary, null, 2), "utf-8");
    await persistState(runtimeStatePath, scenario.scenario_slug, args.runId, runStartedAt, currentArtifactText, currentContractJsonText, currentRulebook, ruleState, cycleSummaries, failedReviews, reviewInvocations, fixInvocations, finalSanityCompleted, approved, runStatus);
    await log(progressLog, `cycle ${cycle}: findings=${normalizedFindings.length}, changed=${fixResult.diffSummary.changed}`);

    if (args.stopAfterCycle !== null && cycle >= args.stopAfterCycle) {
      await log(progressLog, `checkpoint stop_after_cycle=${args.stopAfterCycle}`);
      return;
    }
  }

  if (approved && scenario.final_full_sanity_sweep && !finalSanityCompleted) {
    await runFinalSanitySweep({
      root,
      config,
      scenario,
      groupManifest,
      reviewPrompt,
      currentArtifactText,
      currentContractJsonText,
      currentRulebook,
      sessionRegistry,
      sessionRegistryPath,
      cycleRoot,
      progressLog,
      cycleSummaries,
      reviewInvocations,
      fixInvocations,
      ruleState,
      runtimeStatePath,
      args,
      runStartedAt,
      stateRef: {
        get approved() { return approved; },
        set approved(value: boolean) { approved = value; },
        get runStatus() { return runStatus; },
        set runStatus(value: RunStatus) { runStatus = value; },
        get finalSanityCompleted() { return finalSanityCompleted; },
        set finalSanityCompleted(value: boolean) { finalSanityCompleted = value; },
        get failedReviews() { return failedReviews; },
      }
    });
  }

  const kpiSummary = {
    schema_version: "1.0",
    scenario_slug: scenario.scenario_slug,
    approved,
    run_status: runStatus,
    final_full_sanity_sweep: scenario.final_full_sanity_sweep,
    final_sanity_completed: finalSanityCompleted,
    cycles_completed: cycleSummaries.length,
    wall_clock_ms: Date.now() - Date.parse(runStartedAt),
    total_review_time_ms: sumNumbers(cycleSummaries.map((entry) => entry.review_time_ms)),
    total_fix_time_ms: sumNumbers(cycleSummaries.map((entry) => entry.fix_time_ms)),
    initial_findings_count: cycleSummaries[0]?.findings_count ?? 0,
    final_findings_count: cycleSummaries[cycleSummaries.length - 1]?.findings_count ?? 0,
    review_error_count: sumNumbers(cycleSummaries.map((entry) => entry.review_error_count)),
    active_session_slots: Object.keys(sessionRegistry.slots).length,
    stage_metrics: {
      review: summarizeStage(reviewInvocations),
      fix: summarizeStage(fixInvocations),
    },
  };

  await writeFile(join(resultDir, "session-registry.json"), JSON.stringify(sessionRegistry, null, 2), "utf-8");
  await writeFile(join(resultDir, "cycles.json"), JSON.stringify(cycleSummaries, null, 2), "utf-8");
  await writeCurrentArtifacts(resultDir, currentArtifactText);
  await writeFile(kpiSummaryPath, JSON.stringify(kpiSummary, null, 2), "utf-8");
  await writeFile(join(resultDir, "analysis.md"), buildAnalysis(kpiSummary, cycleSummaries), "utf-8");
  await log(progressLog, `completed ${scenario.scenario_slug}: approved=${approved}, run_status=${runStatus}`);
}

async function runFinalSanitySweep(input: {
  root: string;
  config: Config;
  scenario: ScenarioConfig;
  groupManifest: GroupManifest;
  reviewPrompt: Record<string, unknown>;
  currentArtifactText: string;
  currentContractJsonText: string;
  currentRulebook: RuleRecord[];
  sessionRegistry: SessionRegistry;
  sessionRegistryPath: string;
  cycleRoot: string;
  progressLog: string;
  cycleSummaries: CycleSummary[];
  reviewInvocations: InvocationSummary[];
  fixInvocations: InvocationSummary[];
  ruleState: Map<string, { active: boolean }>;
  runtimeStatePath: string;
  args: ParsedArgs;
  runStartedAt: string;
  stateRef: {
    approved: boolean;
    runStatus: RunStatus;
    finalSanityCompleted: boolean;
    failedReviews: number;
  };
}): Promise<void> {
  const sanityCycle = input.cycleSummaries.length + 1;
  const cycleDir = join(input.cycleRoot, `cycle-${sanityCycle}`);
  const promptsDir = join(cycleDir, "reviewer-prompts");
  const outputsDir = join(cycleDir, "reviewer-outputs");
  await mkdir(promptsDir, { recursive: true });
  await mkdir(outputsDir, { recursive: true });
  const activeRuleIds = input.currentRulebook.map((rule) => rule.id);
  const tasks = buildGroupedTasks(input.currentRulebook, input.groupManifest);
  await writeArtifactFiles(cycleDir, "artifact-before-sanity", input.currentArtifactText);
  await writeFile(join(cycleDir, "active-rules.json"), JSON.stringify(activeRuleIds, null, 2), "utf-8");
  await log(input.progressLog, `cycle ${sanityCycle}: final sanity ${tasks.length} review tasks`);

  const reviewStartedMs = Date.now();
  const reviewResults = await runWithConcurrency(tasks, input.config.execution.review_concurrency_limit, async (task) => {
    const reviewBundle = await writeReviewerBundle(cycleDir, task, input.currentArtifactText, input.currentContractJsonText);
    const prompt = buildReviewerPrompt(`${input.scenario.scenario_slug}-final-sanity`, task, reviewBundle, input.reviewPrompt);
    await writeFile(join(promptsDir, `${sanitize(task.taskId)}.txt`), prompt, "utf-8");
    const startedMs = Date.now();
    const startedAt = new Date(startedMs).toISOString();
    try {
      const invocation = await invokeWithResume(
        input.config.reviewer_model,
        prompt,
        `tools/agent-role-builder/tests/grouped-shrinking-readiness/${input.scenario.scenario_slug}/final-sanity/${task.taskId}`,
        `review-final-${task.taskId}`,
        input.sessionRegistry,
        input.sessionRegistryPath,
        input.config.execution.retry_once_on_failure,
        input.config.execution.retry_backoff_ms
      );
      const invocationSummary = summarizeInvocation(invocation);
      input.reviewInvocations.push(invocationSummary);
      const parsed = parseReviewerResponse(invocation.response);
      const completedMs = Date.now();
      const result: ReviewTaskResult = {
        task_id: task.taskId,
        scope_id: task.scopeId,
        success: true,
        latency_ms: completedMs - startedMs,
        started_at: startedAt,
        completed_at: new Date(completedMs).toISOString(),
        reviewer_response: parsed,
        error_message: null,
        invocation: invocationSummary,
      };
      await writeFile(join(outputsDir, `${sanitize(task.taskId)}.json`), JSON.stringify(result, null, 2), "utf-8");
      return result;
    } catch (error) {
      const completedMs = Date.now();
      const message = error instanceof Error ? error.message : String(error);
      const result: ReviewTaskResult = {
        task_id: task.taskId,
        scope_id: task.scopeId,
        success: false,
        latency_ms: completedMs - startedMs,
        started_at: startedAt,
        completed_at: new Date(completedMs).toISOString(),
        reviewer_response: null,
        error_message: message,
        invocation: null,
      };
      await writeFile(join(outputsDir, `${sanitize(task.taskId)}.error.json`), JSON.stringify(result, null, 2), "utf-8");
      return result;
    }
  });
  const reviewTimeMs = Date.now() - reviewStartedMs;
  const normalizedFindings = normalizeFindings(reviewResults);
  const reviewErrorCount = reviewResults.filter((result) => !result.success).length;
  await writeFile(join(cycleDir, "review-results.json"), JSON.stringify(reviewResults, null, 2), "utf-8");
  await writeFile(join(cycleDir, "normalized-findings.json"), JSON.stringify(normalizedFindings, null, 2), "utf-8");

  input.stateRef.finalSanityCompleted = true;
  if (reviewErrorCount > 0) {
    input.stateRef.approved = false;
    input.stateRef.runStatus = "review_error";
  } else if (normalizedFindings.length > 0) {
    input.stateRef.approved = false;
    input.stateRef.runStatus = "sanity_failed";
  } else {
    input.stateRef.approved = true;
    input.stateRef.runStatus = "approved";
  }

  const cycleSummary: CycleSummary = {
    cycle: sanityCycle,
    phase: "final_sanity",
    active_rule_ids: activeRuleIds,
    findings_count: normalizedFindings.length,
    review_error_count: reviewErrorCount,
    review_time_ms: reviewTimeMs,
    fix_time_ms: 0,
    approved: input.stateRef.approved,
    fixed_changed_artifact: false,
  };
  input.cycleSummaries.push(cycleSummary);
  await writeFile(join(cycleDir, "cycle-summary.json"), JSON.stringify(cycleSummary, null, 2), "utf-8");
  await persistState(
    input.runtimeStatePath,
    input.scenario.scenario_slug,
    input.args.runId,
    input.runStartedAt,
    input.currentArtifactText,
    input.currentContractJsonText,
    input.currentRulebook,
    input.ruleState,
    input.cycleSummaries,
    input.stateRef.failedReviews,
    input.reviewInvocations,
    input.fixInvocations,
    input.stateRef.finalSanityCompleted,
    input.stateRef.approved,
    input.stateRef.runStatus
  );
  await log(input.progressLog, input.stateRef.approved ? `cycle ${sanityCycle}: final sanity approved` : `cycle ${sanityCycle}: final sanity findings=${normalizedFindings.length}`);
}

function buildGroupedTasks(rules: RuleRecord[], groupManifest: GroupManifest): ReviewerTask[] {
  const ruleMap = new Map(rules.map((rule) => [rule.id, rule]));
  const tasks: ReviewerTask[] = [];
  for (const group of groupManifest.groups) {
    const groupedRules = group.rules
      .map((ruleId) => ruleMap.get(ruleId))
      .filter((rule): rule is RuleRecord => Boolean(rule));
    if (groupedRules.length > 0) {
      tasks.push({ taskId: `group-${group.id}`, scopeId: group.id, rules: groupedRules });
    }
  }
  const assigned = new Set(tasks.flatMap((task) => task.rules.map((rule) => rule.id)));
  const extras = rules.filter((rule) => !assigned.has(rule.id));
  if (extras.length > 0) {
    tasks.push({ taskId: "group-learned-rules", scopeId: "learned-rules", rules: extras });
  }
  return tasks;
}

async function writeReviewerBundle(
  cycleDir: string,
  task: ReviewerTask,
  artifactText: string,
  contractJsonText: string
): Promise<{ artifactPath: string; contractSummaryPath: string; assignedRulesPath: string }> {
  const bundleDir = join(cycleDir, "review-bundles", sanitize(task.taskId));
  await mkdir(bundleDir, { recursive: true });
  const artifactPath = join(bundleDir, "artifact.md");
  const contractSummaryPath = join(bundleDir, "contract-summary.json");
  const assignedRulesPath = join(bundleDir, "assigned-rules.json");
  await writeFile(artifactPath, artifactText, "utf-8");
  await writeFile(contractSummaryPath, contractJsonText, "utf-8");
  await writeFile(assignedRulesPath, JSON.stringify(task.rules, null, 2), "utf-8");
  return {
    artifactPath: artifactPath.replace(/\\/g, "/"),
    contractSummaryPath: contractSummaryPath.replace(/\\/g, "/"),
    assignedRulesPath: assignedRulesPath.replace(/\\/g, "/"),
  };
}

async function writeArtifactFiles(targetDir: string, stem: string, artifactText: string): Promise<void> {
  await writeFile(join(targetDir, `${stem}.md`), artifactText, "utf-8");
  const parsed = parseBundle(artifactText);
  if (parsed) {
    await writeFile(join(targetDir, `${stem}-role.md`), parsed.roleMarkdown, "utf-8");
    await writeFile(join(targetDir, `${stem}-contract.json`), parsed.contractJsonText, "utf-8");
  }
}

async function writeCurrentArtifacts(resultDir: string, artifactText: string): Promise<void> {
  await writeFile(join(resultDir, "current-artifact.md"), artifactText, "utf-8");
  const parsed = parseBundle(artifactText);
  if (parsed) {
    await writeFile(join(resultDir, "current-role.md"), parsed.roleMarkdown, "utf-8");
    await writeFile(join(resultDir, "current-contract.json"), parsed.contractJsonText, "utf-8");
  }
}

function buildReviewerPrompt(
  scenarioSlug: string,
  task: ReviewerTask,
  reviewBundle: { artifactPath: string; contractSummaryPath: string; assignedRulesPath: string },
  reviewPrompt: Record<string, unknown>
): string {
  return [
    "You are a focused ARB rules reviewer inside a grouped-shrinking readiness experiment.",
    `Scenario: ${scenarioSlug}`,
    `Scope id: ${task.scopeId}`,
    "The artifact bundle file contains BOTH the role markdown and the companion role-contract JSON.",
    "Review ONLY the assigned rules declared in the files below.",
    "Use the contract summary file as the current governed contract surface for parity checks.",
    "Do not propose fixes. Return findings only.",
    "Return JSON only. No markdown fences.",
    "",
    `Assigned rules file: ${reviewBundle.assignedRulesPath}`,
    `Artifact bundle file: ${reviewBundle.artifactPath}`,
    `Contract summary file: ${reviewBundle.contractSummaryPath}`,
    "",
    "Severity definitions:",
    JSON.stringify(reviewPrompt["severity_definitions"] ?? {}, null, 2),
    "",
    "Required JSON shape:",
    JSON.stringify({
      reviewer_id: task.taskId,
      scenario: scenarioSlug,
      scope_id: task.scopeId,
      evaluations: [{
        rule_id: "ARB-001",
        status: "compliant | non_compliant | not_applicable",
        severity: "blocking | major | minor | suggestion | none",
        summary: "short finding summary",
        evidence_location: "exact section or artifact location",
        evidence_quote: "short exact quote from artifact",
        why_it_matters: "why this matters"
      }],
      notes: []
    }, null, 2),
    "",
    "- Return exactly one evaluation per assigned rule.",
    "- Use severity=none when status is compliant or not_applicable.",
    "- Keep evidence_quote short and exact."
  ].join("\n");
}

function buildBundleFixInstructions(): string {
  return [
    "Return the full updated role-package bundle using exactly these markers and in this order:",
    ROLE_START,
    "<full updated role-definition markdown>",
    ROLE_END,
    CONTRACT_START,
    "<full updated valid JSON contract>",
    CONTRACT_END,
    "The role markdown must include all required XML tags: <role>, <authority>, <scope>, <context-gathering>, <inputs>, <guardrails>, <steps>, <outputs>, <completion>.",
    "The contract JSON must stay valid and must remain aligned with the role markdown.",
    "Preserve approved intent unless the rulebook or findings require a change."
  ].join("\n");
}

function renderBundle(roleMarkdown: string, contractJsonText: string): string {
  return [
    ROLE_START,
    roleMarkdown.trim(),
    ROLE_END,
    CONTRACT_START,
    contractJsonText.trim(),
    CONTRACT_END,
    ""
  ].join("\n");
}

function parseBundle(text: string): { roleMarkdown: string; contractJsonText: string } | null {
  const roleStart = text.indexOf(ROLE_START);
  const roleEnd = text.indexOf(ROLE_END);
  const contractStart = text.indexOf(CONTRACT_START);
  const contractEnd = text.indexOf(CONTRACT_END);
  if (roleStart === -1 || roleEnd === -1 || contractStart === -1 || contractEnd === -1) {
    return null;
  }
  const roleMarkdown = text.slice(roleStart + ROLE_START.length, roleEnd).trim();
  const contractJsonText = text.slice(contractStart + CONTRACT_START.length, contractEnd).trim();
  return { roleMarkdown, contractJsonText };
}

function normalizeBundleArtifact(artifactText: string, fallbackContractJsonText: string): string {
  const parsed = parseBundle(artifactText);
  if (parsed) {
    return renderBundle(parsed.roleMarkdown, parsed.contractJsonText);
  }
  return renderBundle(artifactText.trim(), fallbackContractJsonText);
}

function normalizeFindings(results: ReviewTaskResult[]): NormalizedFinding[] {
  return results.flatMap((result) =>
    (result.reviewer_response?.evaluations ?? [])
      .filter((evaluation) => evaluation.status === "non_compliant")
      .map((evaluation) => ({
        finding_id: `${result.scope_id}-${evaluation.rule_id}`,
        source_task_id: result.task_id,
        scope_id: result.scope_id,
        rule_id: evaluation.rule_id,
        severity: evaluation.severity,
        summary: evaluation.summary,
        evidence_location: evaluation.evidence_location,
        evidence_quote: evaluation.evidence_quote,
        why_it_matters: evaluation.why_it_matters,
      }))
  );
}

function updateActiveRuleSet(ruleState: Map<string, { active: boolean }>, results: ReviewTaskResult[]): void {
  for (const result of results) {
    for (const evaluation of result.reviewer_response?.evaluations ?? []) {
      if (evaluation.status === "non_compliant") {
        ruleState.set(evaluation.rule_id, { active: true });
      } else {
        ruleState.set(evaluation.rule_id, { active: false });
      }
    }
  }
}

async function loadOrCreateSessionRegistry(path: string, scenarioSlug: string): Promise<SessionRegistry> {
  try {
    return JSON.parse(await readFile(path, "utf-8")) as SessionRegistry;
  } catch {
    const created: SessionRegistry = { schema_version: "1.0", scenario_slug: scenarioSlug, updated_at: new Date().toISOString(), slots: {} };
    await writeFile(path, JSON.stringify(created, null, 2), "utf-8");
    return created;
  }
}

async function loadRuntimeState(path: string): Promise<RuntimeState | null> {
  try {
    return JSON.parse(await readFile(path, "utf-8")) as RuntimeState;
  } catch {
    return null;
  }
}

async function persistState(
  path: string,
  scenarioSlug: string,
  runId: string,
  runStartedAt: string,
  currentArtifactText: string,
  currentContractJsonText: string,
  currentRulebook: RuleRecord[],
  ruleState: Map<string, { active: boolean }>,
  cycleSummaries: CycleSummary[],
  failedReviews: number,
  reviewInvocations: InvocationSummary[],
  fixInvocations: InvocationSummary[],
  finalSanityCompleted: boolean,
  approved: boolean,
  runStatus: RunStatus
): Promise<void> {
  const state: RuntimeState = {
    schema_version: "1.0",
    scenario_slug: scenarioSlug,
    run_id: runId,
    run_started_at: runStartedAt,
    current_artifact_text: currentArtifactText,
    current_contract_json_text: currentContractJsonText,
    current_rulebook: currentRulebook,
    inactive_rule_ids: currentRulebook.filter((rule) => ruleState.get(rule.id)?.active === false).map((rule) => rule.id),
    cycle_summaries: cycleSummaries,
    failed_reviews: failedReviews,
    review_invocations: reviewInvocations,
    fix_invocations: fixInvocations,
    final_sanity_completed: finalSanityCompleted,
    approved,
    run_status: runStatus,
  };
  await writeFile(path, JSON.stringify(state, null, 2), "utf-8");
}

async function invokeWithResume(
  modelConfig: ModelConfig,
  prompt: string,
  sourcePath: string,
  slotKey: string,
  registry: SessionRegistry,
  registryPath: string,
  retryOnceOnFailure: boolean,
  retryBackoffMs: number
): Promise<InvocationResult> {
  let handle = registry.slots[slotKey] ?? null;
  const runOnce = async (currentHandle: InvocationSessionHandle | null) => {
    const result = await invoke({
      cli: modelConfig.provider,
      model: modelConfig.model,
      reasoning: modelConfig.reasoning,
      timeout_ms: modelConfig.timeout_ms,
      prompt,
      source_path: sourcePath,
      session: { persist: true, handle: currentHandle },
    });
    if (result.session?.handle) {
      registry.slots[slotKey] = result.session.handle;
      registry.updated_at = new Date().toISOString();
      await writeFile(registryPath, JSON.stringify(registry, null, 2), "utf-8");
    }
    return result;
  };
  try {
    return await runOnce(handle);
  } catch (error) {
    if (!retryOnceOnFailure) {
      throw error;
    }
    await sleep(retryBackoffMs);
    handle = null;
    return await runOnce(handle);
  }
}

function summarizeInvocation(result: InvocationResult): InvocationSummary {
  return {
    provider: result.provenance.provider,
    model: result.provenance.model,
    reasoning: result.provenance.reasoning ?? null,
    session_statuses: result.attempts.map((attempt) => attempt.session_status),
    tokens_in_estimated: sumNumbers(result.attempts.map((attempt) => attempt.usage?.tokens_in_estimated)),
    tokens_out_estimated: sumNumbers(result.attempts.map((attempt) => attempt.usage?.tokens_out_estimated)),
    estimated_cost_usd: round6(sumNumbers(result.attempts.map((attempt) => attempt.usage?.estimated_cost_usd))),
    total_latency_ms: sumNumbers(result.attempts.map((attempt) => attempt.latency_ms)),
    attempt_count: result.attempts.length,
  };
}

function summarizeStage(invocations: InvocationSummary[]) {
  const counts = { none: 0, fresh: 0, resumed: 0, replaced: 0 };
  for (const status of invocations.flatMap((entry) => entry.session_statuses)) {
    if (status === "none" || status === "fresh" || status === "resumed" || status === "replaced") {
      counts[status] += 1;
    }
  }
  return {
    total_invocations: invocations.length,
    total_attempts: sumNumbers(invocations.map((entry) => entry.attempt_count)),
    total_latency_ms: sumNumbers(invocations.map((entry) => entry.total_latency_ms)),
    total_tokens_in_estimated: sumNumbers(invocations.map((entry) => entry.tokens_in_estimated)),
    total_tokens_out_estimated: sumNumbers(invocations.map((entry) => entry.tokens_out_estimated)),
    total_estimated_cost_usd: round6(sumNumbers(invocations.map((entry) => entry.estimated_cost_usd))),
    session_none: counts.none,
    session_fresh: counts.fresh,
    session_resumed: counts.resumed,
    session_replaced: counts.replaced,
  };
}

function parseReviewerResponse(raw: string): ReviewerResponse {
  const trimmed = raw.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
  const extracted = tryParseJson(trimmed) ?? tryParseJson(trimmed.slice(trimmed.indexOf("{"), trimmed.lastIndexOf("}") + 1));
  if (!extracted || !Array.isArray((extracted as ReviewerResponse).evaluations)) {
    throw new Error("Reviewer response missing evaluations array");
  }
  return extracted as ReviewerResponse;
}

function tryParseJson(text: string): unknown | null {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function runWithConcurrency<T, R>(items: T[], concurrencyLimit: number, worker: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(concurrencyLimit, items.length)) }, async () => {
    while (true) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      if (currentIndex >= items.length) return;
      results[currentIndex] = await worker(items[currentIndex], currentIndex);
    }
  });
  await Promise.all(workers);
  return results;
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf-8")) as T;
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await readFile(path, "utf-8");
    return true;
  } catch {
    return false;
  }
}

async function log(progressLog: string, message: string): Promise<void> {
  const line = `[${new Date().toISOString()}] ${message}\n`;
  process.stdout.write(line);
  await appendFile(progressLog, line, "utf-8");
}

function buildAnalysis(summary: Record<string, unknown>, cycles: CycleSummary[]): string {
  return [
    "# Analysis",
    "",
    `- Approved: ${summary.approved}`,
    `- Run status: ${summary.run_status}`,
    `- Final sanity requested: ${summary.final_full_sanity_sweep}`,
    `- Final sanity completed: ${summary.final_sanity_completed}`,
    `- Cycles completed: ${summary.cycles_completed}`,
    `- Wall clock ms: ${summary.wall_clock_ms}`,
    `- Review time ms: ${summary.total_review_time_ms}`,
    `- Fix time ms: ${summary.total_fix_time_ms}`,
    `- Review error count: ${summary.review_error_count}`,
    "",
    "## Cycles",
    ...cycles.map((cycle) => `- cycle ${cycle.cycle} (${cycle.phase}): findings=${cycle.findings_count}, review_errors=${cycle.review_error_count}, review_ms=${cycle.review_time_ms}, fix_ms=${cycle.fix_time_ms}`)
  ].join("\n");
}

function parseArgs(argv: string[]): ParsedArgs {
  const args = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (key?.startsWith("--") && value) args.set(key.slice(2), value);
  }
  const scenarioPath = args.get("scenario");
  const runId = args.get("run-id");
  const stopAfterCycle = args.get("stop-after-cycle");
  if (!scenarioPath || !runId) {
    throw new Error("Expected --scenario <path> --run-id <id>");
  }
  return {
    scenarioPath,
    runId,
    stopAfterCycle: stopAfterCycle ? Number(stopAfterCycle) : null,
  };
}

function sumNumbers(values: Array<number | undefined>): number {
  return values.reduce((sum, value) => sum + (value ?? 0), 0);
}

function round6(value: number): number {
  return Number(value.toFixed(6));
}

function sanitize(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]+/g, "-");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

void main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
