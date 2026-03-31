import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { invoke } from "../../../../shared/llm-invoker/invoker.js";
import type { InvocationResult, InvocationSessionHandle } from "../../../../shared/llm-invoker/types.js";
import { runRulesComplianceEnforcer } from "../../../../shared/rules-compliance-enforcer/engine.js";
import { extractRules } from "../../../../shared/self-learning-engine/engine.js";
import { generateRoleContract } from "../../src/services/role-generator.js";
import type { RoleBuilderRequest } from "../../src/schemas/request.js";

type Provider = "codex" | "claude" | "gemini";
type Severity = "blocking" | "major" | "minor" | "suggestion" | "none";
type RuleStatus = "compliant" | "non_compliant" | "not_applicable";
type ReviewShape = "per-rule" | "grouped-by-relevance";

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
  learning_model: ModelConfig;
  execution: {
    review_concurrency_limit: number;
    retry_once_on_failure: boolean;
    retry_backoff_ms: number;
    max_cycles: number;
    learning_after_failed_reviews: number;
  };
}

interface ScenarioConfig {
  scenario_slug: string;
  group: "group-a" | "group-b" | "group-c";
  review_shape: ReviewShape;
  shrinking_active_set: boolean;
  learning_mode: "none" | "after-second-failed-review";
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
  active_rule_ids: string[];
  review_shape: ReviewShape;
  findings_count: number;
  review_error_count: number;
  review_time_ms: number;
  fix_time_ms: number;
  learning_time_ms: number;
  approved: boolean;
  learning_triggered: boolean;
  new_rule_ids: string[];
  fixed_changed_artifact: boolean;
}

async function main(): Promise<void> {
  const { scenarioPath, runId } = parseArgs(process.argv.slice(2));
  const root = resolve(process.cwd());
  const config = await readJson<Config>(join(root, "tools", "agent-role-builder", "tests", "enforcer-loop-convergence", "config.json"));
  const scenario = await readJson<ScenarioConfig>(resolve(root, scenarioPath));
  const scenarioDir = dirname(resolve(root, scenarioPath));
  const resultDir = join(scenarioDir, "results", runId);
  const cycleRoot = join(resultDir, "cycles");
  const progressLog = join(resultDir, "progress.log");
  const reviewPrompt = await readJson<Record<string, unknown>>(join(root, "tools", "agent-role-builder", "review-prompt.json"));
  const rulebook = await readJson<Rulebook>(join(root, "tools", "agent-role-builder", "rulebook.json"));
  const groupManifest = await readJson<GroupManifest>(join(root, "tools", "agent-role-builder", "tests", "enforcer-parallel-review-shape", "grouped-by-relevance", "groups.json"));
  const fixtureRoot = join(root, "tools", "agent-role-builder", "tests", "fixtures", "run01-role-artifact");
  const fixtureMarkdown = await readFile(join(fixtureRoot, "agent-role-builder-role.md"), "utf-8");
  const baselineRequest = await readJson<RoleBuilderRequest>(join(root, "tools", "agent-role-builder", "runs", "agent-role-builder-self-role-001", "normalized-request.json"));
  const contractSummary = buildContractSummary(
    generateRoleContract(
      baselineRequest,
      `${baselineRequest.role_slug}-role.md`,
      `${baselineRequest.role_slug}-role-contract.json`,
      `${baselineRequest.role_slug}-decision-log.md`,
      `${baselineRequest.role_slug}-board-summary.md`
    )
  );

  await mkdir(resultDir, { recursive: true });
  await mkdir(cycleRoot, { recursive: true });
  const sessionRegistryPath = join(resultDir, "session-registry.json");
  const sessionRegistry = await loadOrCreateSessionRegistry(sessionRegistryPath, scenario.scenario_slug);

  let currentMarkdown = fixtureMarkdown;
  let currentRulebook = [...rulebook.rules];
  const ruleState = new Map(currentRulebook.map((rule) => [rule.id, { active: true }]));
  const cycleSummaries: CycleSummary[] = [];
  const reviewInvocations: InvocationSummary[] = [];
  const fixInvocations: InvocationSummary[] = [];
  const learningInvocations: InvocationSummary[] = [];
  let failedReviews = 0;
  let approved = false;
  let runStatus: "approved" | "cycle_cap" | "review_error" = "cycle_cap";
  const runStartedMs = Date.now();

  await log(progressLog, `started ${scenario.scenario_slug}`);

  for (let cycle = 1; cycle <= config.execution.max_cycles; cycle++) {
    const cycleDir = join(cycleRoot, `cycle-${cycle}`);
    const promptsDir = join(cycleDir, "reviewer-prompts");
    const outputsDir = join(cycleDir, "reviewer-outputs");
    await mkdir(promptsDir, { recursive: true });
    await mkdir(outputsDir, { recursive: true });

    const activeRuleIds = currentRulebook.filter((rule) => ruleState.get(rule.id)?.active !== false).map((rule) => rule.id);
    const tasks = buildTasks(scenario.review_shape, currentRulebook.filter((rule) => activeRuleIds.includes(rule.id)), groupManifest);
    await writeFile(join(cycleDir, "artifact-before-fix.md"), currentMarkdown, "utf-8");
    await writeFile(join(cycleDir, "active-rules.json"), JSON.stringify(activeRuleIds, null, 2), "utf-8");
    await log(progressLog, `cycle ${cycle}: ${tasks.length} review tasks`);

    const reviewStartedMs = Date.now();
    const reviewResults = await runWithConcurrency(tasks, config.execution.review_concurrency_limit, async (task) => {
      const reviewBundle = await writeReviewerBundle(cycleDir, task, currentMarkdown, contractSummary);
      const prompt = buildReviewerPrompt(scenario.scenario_slug, scenario.review_shape, task, reviewBundle, reviewPrompt);
      await writeFile(join(promptsDir, `${sanitize(task.taskId)}.txt`), prompt, "utf-8");
      const startedMs = Date.now();
      const startedAt = new Date(startedMs).toISOString();
      try {
        const invocation = await invokeWithResume(config.reviewer_model, prompt, `tools/agent-role-builder/tests/enforcer-loop-convergence/${scenario.scenario_slug}/${task.taskId}`, `review-${task.taskId}`, sessionRegistry, sessionRegistryPath, config.execution.retry_once_on_failure, config.execution.retry_backoff_ms);
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
        active_rule_ids: activeRuleIds,
        review_shape: scenario.review_shape,
        findings_count: normalizedFindings.length,
        review_error_count: reviewErrorCount,
        review_time_ms: reviewTimeMs,
        fix_time_ms: 0,
        learning_time_ms: 0,
        approved: false,
        learning_triggered: false,
        new_rule_ids: [],
        fixed_changed_artifact: false,
      });
      await log(progressLog, `cycle ${cycle}: review errors=${reviewErrorCount}, stopping`);
      runStatus = "review_error";
      break;
    }

    if (normalizedFindings.length === 0) {
      approved = true;
      runStatus = "approved";
      cycleSummaries.push({
        cycle,
        active_rule_ids: activeRuleIds,
        review_shape: scenario.review_shape,
        findings_count: 0,
        review_error_count: 0,
        review_time_ms: reviewTimeMs,
        fix_time_ms: 0,
        learning_time_ms: 0,
        approved: true,
        learning_triggered: false,
        new_rule_ids: [],
        fixed_changed_artifact: false,
      });
      await log(progressLog, `cycle ${cycle}: approved`);
      break;
    }

    failedReviews += 1;
    let learningTimeMs = 0;
    let newRuleIds: string[] = [];
    const learningTriggered = scenario.learning_mode === "after-second-failed-review" && failedReviews >= config.execution.learning_after_failed_reviews;
    if (learningTriggered) {
      await log(progressLog, `cycle ${cycle}: running learning`);
      const learningStartedMs = Date.now();
      const learningOutput = await extractRules(
        {
          component: "agent-role-builder",
          round: cycle,
          review_findings: normalizedFindings.map((finding) => ({
            group_id: finding.rule_id,
            summary: finding.summary,
            severity: normalizeLearningSeverity(finding.severity),
            redesign_guidance: `${finding.why_it_matters}\nEvidence: ${finding.evidence_location}\nQuote: ${finding.evidence_quote}`,
            finding_count: 1,
          })),
          current_rulebook: currentRulebook,
          review_prompt_domain: String(reviewPrompt["domain"] ?? "design"),
          review_prompt_path: join(root, "tools", "agent-role-builder", "review-prompt.json"),
          review_contract_path: join(root, "tools", "agent-role-builder", "review-contract.json"),
          unresolved_from_leader: normalizedFindings.map((finding) => `${finding.rule_id}: ${finding.summary}`),
        },
        async (prompt: string, sourcePath: string) => {
          const invocation = await invokeWithResume(config.learning_model, prompt, sourcePath, "learning-main", sessionRegistry, sessionRegistryPath, config.execution.retry_once_on_failure, config.execution.retry_backoff_ms);
          learningInvocations.push(summarizeInvocation(invocation));
          return invocation.response;
        }
      );
      learningTimeMs = Date.now() - learningStartedMs;
      newRuleIds = learningOutput.new_rules.map((rule) => rule.id);
      currentRulebook = mergeRules(currentRulebook, learningOutput.new_rules as RuleRecord[]);
      for (const ruleId of newRuleIds) {
        if (!ruleState.has(ruleId)) {
          ruleState.set(ruleId, { active: true });
        }
      }
      await writeFile(join(cycleDir, "learning.json"), JSON.stringify(learningOutput, null, 2), "utf-8");
    }

    await log(progressLog, `cycle ${cycle}: running fix stage`);
    const fixStartedMs = Date.now();
    const fixResult = await runRulesComplianceEnforcer(
      {
        component: "agent-role-builder",
        mode: cycle === 1 ? "initial_rule_sweep" : "revision",
        round: cycle,
        artifactTag: "draft",
        artifactPathHint: join("tools", "agent-role-builder", "role", "agent-role-builder-role.md"),
        artifactText: currentMarkdown,
        requiredArtifactInstructions: [
          "Return the full updated role-definition markdown.",
          "It must include all required XML tags: <role>, <authority>, <scope>, <context-gathering>, <inputs>, <guardrails>, <steps>, <outputs>, <completion>.",
          "Preserve approved intent unless the rulebook or findings require a change."
        ].join("\n"),
        rulebook: currentRulebook,
        newRuleIds,
        findings: normalizedFindings.map((finding) => ({
          groupId: finding.rule_id,
          severity: finding.severity === "none" ? "minor" : finding.severity,
          summary: finding.summary,
          redesignGuidance: `${finding.why_it_matters}\nEvidence: ${finding.evidence_location}\nQuote: ${finding.evidence_quote}`,
          findingCount: 1,
        })),
        unresolved: normalizedFindings.map((finding) => finding.rule_id),
        leaderRationale: `Loop-test fix pass for cycle ${cycle}.`,
        selfCheckIssues: [],
        bundleDir: join(cycleDir, "fixer"),
        reviewPromptPath: join(root, "tools", "agent-role-builder", "review-prompt.json"),
        reviewContractPath: join(root, "tools", "agent-role-builder", "review-contract.json"),
        sourceAuthorityPaths: [
          join(root, "docs", "v0", "review-process-architecture.md"),
          join(root, "docs", "v0", "architecture.md"),
        ],
      },
      async (prompt: string, sourcePath: string) => {
        const invocation = await invokeWithResume(config.fixer_model, prompt, sourcePath, "fixer-main", sessionRegistry, sessionRegistryPath, config.execution.retry_once_on_failure, config.execution.retry_backoff_ms);
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
    currentMarkdown = fixResult.artifact;
    await writeFile(join(cycleDir, "artifact-after-fix.md"), currentMarkdown, "utf-8");
    await writeFile(join(cycleDir, "fix-result.json"), JSON.stringify(fixResult, null, 2), "utf-8");

    if (scenario.shrinking_active_set) {
      updateActiveRuleSet(ruleState, reviewResults);
      for (const ruleId of newRuleIds) {
        ruleState.set(ruleId, { active: true });
      }
    }

    const cycleSummary: CycleSummary = {
      cycle,
      active_rule_ids: activeRuleIds,
      review_shape: scenario.review_shape,
      findings_count: normalizedFindings.length,
      review_error_count: 0,
      review_time_ms: reviewTimeMs,
      fix_time_ms: fixTimeMs,
      learning_time_ms: learningTimeMs,
      approved: false,
      learning_triggered: learningTriggered,
      new_rule_ids: newRuleIds,
      fixed_changed_artifact: fixResult.diffSummary.changed,
    };
    cycleSummaries.push(cycleSummary);
    await writeFile(join(cycleDir, "cycle-summary.json"), JSON.stringify(cycleSummary, null, 2), "utf-8");
    await log(progressLog, `cycle ${cycle}: findings=${normalizedFindings.length}, changed=${fixResult.diffSummary.changed}`);
  }

  const kpiSummary = {
    schema_version: "1.0",
    scenario_slug: scenario.scenario_slug,
    group: scenario.group,
    approved,
    run_status: runStatus,
    cycles_completed: cycleSummaries.length,
    wall_clock_ms: Date.now() - runStartedMs,
    total_review_time_ms: sumNumbers(cycleSummaries.map((entry) => entry.review_time_ms)),
    total_fix_time_ms: sumNumbers(cycleSummaries.map((entry) => entry.fix_time_ms)),
    total_learning_time_ms: sumNumbers(cycleSummaries.map((entry) => entry.learning_time_ms)),
    initial_findings_count: cycleSummaries[0]?.findings_count ?? 0,
    final_findings_count: cycleSummaries[cycleSummaries.length - 1]?.findings_count ?? 0,
    review_error_count: sumNumbers(cycleSummaries.map((entry) => entry.review_error_count)),
    active_session_slots: Object.keys(sessionRegistry.slots).length,
    stage_metrics: {
      review: summarizeStage(reviewInvocations),
      fix: summarizeStage(fixInvocations),
      learning: summarizeStage(learningInvocations),
    },
  };

  await writeFile(join(resultDir, "session-registry.json"), JSON.stringify(sessionRegistry, null, 2), "utf-8");
  await writeFile(join(resultDir, "cycles.json"), JSON.stringify(cycleSummaries, null, 2), "utf-8");
  await writeFile(join(resultDir, "current-artifact.md"), currentMarkdown, "utf-8");
  await writeFile(join(resultDir, "kpi-summary.json"), JSON.stringify(kpiSummary, null, 2), "utf-8");
  await writeFile(join(resultDir, "run-manifest.json"), JSON.stringify({
    schema_version: "1.0",
    scenario_slug: scenario.scenario_slug,
    group: scenario.group,
    review_shape: scenario.review_shape,
    shrinking_active_set: scenario.shrinking_active_set,
    learning_mode: scenario.learning_mode,
    run_id: runId,
  }, null, 2), "utf-8");
  await writeFile(join(resultDir, "analysis.md"), buildAnalysis(kpiSummary, cycleSummaries), "utf-8");
  await log(progressLog, `completed ${scenario.scenario_slug}: approved=${approved}, run_status=${runStatus}`);
}

function buildTasks(reviewShape: ReviewShape, rules: RuleRecord[], groupManifest: GroupManifest): ReviewerTask[] {
  if (reviewShape === "per-rule") {
    return rules.map((rule) => ({ taskId: `rule-${rule.id}`, scopeId: rule.id, rules: [rule] }));
  }
  const ruleMap = new Map(rules.map((rule) => [rule.id, rule]));
  const tasks: ReviewerTask[] = [];
  for (const group of groupManifest.groups) {
    const groupedRules = group.rules.map((ruleId) => ruleMap.get(ruleId)).filter((rule): rule is RuleRecord => Boolean(rule));
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
  artifactMarkdown: string,
  contractSummary: string
): Promise<{
  artifactPath: string;
  contractSummaryPath: string;
  assignedRulesPath: string;
}> {
  const bundleDir = join(cycleDir, "review-bundles", sanitize(task.taskId));
  await mkdir(bundleDir, { recursive: true });
  const artifactPath = join(bundleDir, "artifact.md");
  const contractSummaryPath = join(bundleDir, "contract-summary.json");
  const assignedRulesPath = join(bundleDir, "assigned-rules.json");
  await writeFile(artifactPath, artifactMarkdown, "utf-8");
  await writeFile(contractSummaryPath, contractSummary, "utf-8");
  await writeFile(assignedRulesPath, JSON.stringify(task.rules, null, 2), "utf-8");
  return {
    artifactPath: artifactPath.replace(/\\/g, "/"),
    contractSummaryPath: contractSummaryPath.replace(/\\/g, "/"),
    assignedRulesPath: assignedRulesPath.replace(/\\/g, "/"),
  };
}

function buildReviewerPrompt(
  scenarioSlug: string,
  reviewShape: ReviewShape,
  task: ReviewerTask,
  reviewBundle: { artifactPath: string; contractSummaryPath: string; assignedRulesPath: string },
  reviewPrompt: Record<string, unknown>
): string {
  return [
    "You are a focused ARB rules reviewer inside a loop-convergence experiment.",
    `Scenario: ${scenarioSlug}`,
    `Review shape: ${reviewShape}`,
    `Scope id: ${task.scopeId}`,
    "Review ONLY the assigned rules declared in the files below.",
    "Read the artifact markdown and contract summary from disk.",
    "Do not propose fixes. Return findings only.",
    "Return JSON only. No markdown fences.",
    "",
    `Assigned rules file: ${reviewBundle.assignedRulesPath}`,
    `Artifact markdown file: ${reviewBundle.artifactPath}`,
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

function mergeRules(current: RuleRecord[], proposed: RuleRecord[]): RuleRecord[] {
  const existingIds = new Set(current.map((rule) => rule.id));
  return [...current, ...proposed.filter((rule) => !existingIds.has(rule.id))];
}

function buildContractSummary(contract: Record<string, unknown>): string {
  return JSON.stringify(
    {
      intent: contract.intent,
      primary_objective: contract.primary_objective,
      out_of_scope: contract.out_of_scope,
      governance: contract.governance,
      runtime: contract.runtime,
      package_files: contract.package_files,
    },
    null,
    2
  );
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

async function invokeWithResume(modelConfig: ModelConfig, prompt: string, sourcePath: string, slotKey: string, registry: SessionRegistry, registryPath: string, retryOnceOnFailure: boolean, retryBackoffMs: number): Promise<InvocationResult> {
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

function summarizeStage(invocations: InvocationSummary[]): {
  total_invocations: number;
  total_attempts: number;
  total_latency_ms: number;
  total_tokens_in_estimated: number;
  total_tokens_out_estimated: number;
  total_estimated_cost_usd: number;
  session_none: number;
  session_fresh: number;
  session_resumed: number;
  session_replaced: number;
} {
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

function normalizeLearningSeverity(severity: Severity): "blocking" | "major" | "minor" | "suggestion" {
  return severity === "none" ? "minor" : severity;
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
    `- Cycles completed: ${summary.cycles_completed}`,
    `- Wall clock ms: ${summary.wall_clock_ms}`,
    `- Review time ms: ${summary.total_review_time_ms}`,
    `- Fix time ms: ${summary.total_fix_time_ms}`,
    `- Learning time ms: ${summary.total_learning_time_ms}`,
    `- Review error count: ${summary.review_error_count}`,
    "",
    "## Cycles",
    ...cycles.map((cycle) => `- cycle ${cycle.cycle}: findings=${cycle.findings_count}, review_errors=${cycle.review_error_count}, review_ms=${cycle.review_time_ms}, fix_ms=${cycle.fix_time_ms}, learning_ms=${cycle.learning_time_ms}`)
  ].join("\n");
}

function parseArgs(argv: string[]): { scenarioPath: string; runId: string } {
  const args = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (key?.startsWith("--") && value) args.set(key.slice(2), value);
  }
  const scenarioPath = args.get("scenario");
  const runId = args.get("run-id");
  if (!scenarioPath || !runId) throw new Error("Expected --scenario <path> --run-id <id>");
  return { scenarioPath, runId };
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
