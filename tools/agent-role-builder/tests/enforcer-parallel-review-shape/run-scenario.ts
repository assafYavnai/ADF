import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { invoke } from "../../../../shared/llm-invoker/invoker.js";

type ScenarioName = "per-rule" | "grouped-by-relevance";
type Provider = "codex" | "claude" | "gemini";
type Severity = "blocking" | "major" | "minor" | "suggestion" | "none";
type RuleStatus = "compliant" | "non_compliant" | "not_applicable";

interface Config {
  schema_version: "1.0";
  experiment_slug: string;
  reviewer_model: {
    provider: Provider;
    model: string;
    reasoning?: string;
    timeout_ms: number;
  };
  execution: {
    concurrency_limit: number;
    retry_once_on_failure: boolean;
    retry_backoff_ms: number;
  };
}

interface FixtureManifest {
  fixture_slug: string;
  source_run: string;
  files: Array<{
    path: string;
    source_path: string;
    sha256: string;
    read_only: boolean;
  }>;
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
  schema_version: string;
  component: string;
  last_updated: string;
  rules: RuleRecord[];
}

interface GroupManifest {
  schema_version: string;
  experiment_slug: string;
  groups: Array<{
    id: string;
    rules: string[];
  }>;
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
  scenario: ScenarioName;
  scope_id: string;
  evaluations: ReviewerEvaluation[];
  notes: string[];
}

interface ReviewerTask {
  taskId: string;
  scopeId: string;
  rules: RuleRecord[];
}

interface TaskResult {
  task_id: string;
  scope_id: string;
  started_at: string;
  completed_at: string;
  latency_ms: number;
  success: boolean;
  reviewer_response: ReviewerResponse | null;
  error_message: string | null;
  invocation: {
    provider: Provider;
    model: string;
    reasoning: string | null;
    attempts: unknown[];
    session_statuses: string[];
    tokens_in_estimated: number;
    tokens_out_estimated: number;
    estimated_cost_usd: number;
  } | null;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const root = resolve(process.cwd());
  const goalDir = join(root, "tools", "agent-role-builder", "tests", "enforcer-parallel-review-shape");
  const scenarioDir = join(goalDir, args.scenario);
  const resultDir = join(scenarioDir, "results", args.runId);
  await mkdir(resultDir, { recursive: true });
  await mkdir(join(resultDir, "reviewer-prompts"), { recursive: true });
  await mkdir(join(resultDir, "reviewer-outputs"), { recursive: true });

  const config = await readJson<Config>(join(goalDir, "config.json"));
  const fixtureManifest = await readJson<FixtureManifest>(join(root, "tools", "agent-role-builder", "tests", "fixtures", "run01-role-artifact", "fixture-manifest.json"));
  const rulebook = await readJson<Rulebook>(join(root, "tools", "agent-role-builder", "rulebook.json"));
  const reviewPrompt = await readJson<Record<string, unknown>>(join(root, "tools", "agent-role-builder", "review-prompt.json"));
  const fixtureMarkdown = await readFile(join(root, "tools", "agent-role-builder", "tests", "fixtures", "run01-role-artifact", "agent-role-builder-role.md"), "utf-8");
  const fixtureContract = await readFile(join(root, "tools", "agent-role-builder", "tests", "fixtures", "run01-role-artifact", "agent-role-builder-role-contract.json"), "utf-8");

  const tasks = args.scenario === "per-rule"
    ? buildPerRuleTasks(rulebook.rules)
    : buildGroupedTasks(
        rulebook.rules,
        await readJson<GroupManifest>(join(goalDir, "grouped-by-relevance", "groups.json"))
      );

  const runStartedMs = Date.now();
  const runStartedIso = new Date(runStartedMs).toISOString();
  const taskResults = await runWithConcurrency(tasks, config.execution.concurrency_limit, async (task, index) => {
    const prompt = buildReviewerPrompt({
      scenario: args.scenario,
      task,
      fixtureMarkdown,
      fixtureContract,
      reviewPrompt,
    });
    await writeFile(join(resultDir, "reviewer-prompts", `${sanitize(task.taskId)}.txt`), prompt, "utf-8");
    const startedMs = Date.now();
    const startedAt = new Date(startedMs).toISOString();
    try {
      const invocationResult = await invokeReviewerWithRetry({
        provider: config.reviewer_model.provider,
        model: config.reviewer_model.model,
        reasoning: config.reviewer_model.reasoning,
        timeoutMs: config.reviewer_model.timeout_ms,
        retryOnceOnFailure: config.execution.retry_once_on_failure,
        retryBackoffMs: config.execution.retry_backoff_ms,
        prompt,
        sourcePath: `tools/agent-role-builder/tests/enforcer-parallel-review-shape/${args.scenario}/${task.taskId}`,
      });
      const parsed = parseReviewerResponse(invocationResult.response);
      const completedMs = Date.now();
      const completedAt = new Date(completedMs).toISOString();
      await writeFile(
        join(resultDir, "reviewer-outputs", `${sanitize(task.taskId)}.json`),
        JSON.stringify({
          task_id: task.taskId,
          reviewer_index: index,
          response: parsed,
          invocation: summarizeInvocation(invocationResult.attempts),
        }, null, 2),
        "utf-8"
      );
      return {
        task_id: task.taskId,
        scope_id: task.scopeId,
        started_at: startedAt,
        completed_at: completedAt,
        latency_ms: completedMs - startedMs,
        success: true,
        reviewer_response: parsed,
        error_message: null,
        invocation: {
          provider: config.reviewer_model.provider,
          model: config.reviewer_model.model,
          reasoning: config.reviewer_model.reasoning ?? null,
          attempts: invocationResult.attempts,
          session_statuses: invocationResult.attempts.map((attempt) => attempt.session_status),
          tokens_in_estimated: sumNumbers(invocationResult.attempts.map((attempt) => attempt.usage?.tokens_in_estimated)),
          tokens_out_estimated: sumNumbers(invocationResult.attempts.map((attempt) => attempt.usage?.tokens_out_estimated)),
          estimated_cost_usd: round6(sumNumbers(invocationResult.attempts.map((attempt) => attempt.usage?.estimated_cost_usd))),
        },
      } satisfies TaskResult;
    } catch (error) {
      const completedMs = Date.now();
      const completedAt = new Date(completedMs).toISOString();
      const errorMessage = error instanceof Error ? error.message : String(error);
      await writeFile(
        join(resultDir, "reviewer-outputs", `${sanitize(task.taskId)}.error.json`),
        JSON.stringify({
          task_id: task.taskId,
          reviewer_index: index,
          error_message: errorMessage,
        }, null, 2),
        "utf-8"
      );
      return {
        task_id: task.taskId,
        scope_id: task.scopeId,
        started_at: startedAt,
        completed_at: completedAt,
        latency_ms: completedMs - startedMs,
        success: false,
        reviewer_response: null,
        error_message: errorMessage,
        invocation: null,
      } satisfies TaskResult;
    }
  });

  const mergeStartedMs = Date.now();
  const normalizedFindings = normalizeFindings(taskResults);
  const mergeOverheadMs = Date.now() - mergeStartedMs;
  const runCompletedMs = Date.now();
  const kpiSummary = buildKpiSummary({
    taskResults,
    normalizedFindings,
    wallClockMs: runCompletedMs - runStartedMs,
    mergeOverheadMs,
    parallelWidth: config.execution.concurrency_limit,
    testerCount: tasks.length,
  });

  const runManifest = {
    experiment_slug: config.experiment_slug,
    scenario: args.scenario,
    run_id: args.runId,
    started_at: runStartedIso,
    completed_at: new Date(runCompletedMs).toISOString(),
    fixture: fixtureManifest,
    config,
    task_count: tasks.length,
    result_files: [
      "run-manifest.json",
      "raw-findings.json",
      "normalized-findings.json",
      "kpi-summary.json",
      "analysis.md",
    ],
  };

  await writeFile(join(resultDir, "run-manifest.json"), JSON.stringify(runManifest, null, 2), "utf-8");
  await writeFile(join(resultDir, "raw-findings.json"), JSON.stringify(taskResults, null, 2), "utf-8");
  await writeFile(join(resultDir, "normalized-findings.json"), JSON.stringify(normalizedFindings, null, 2), "utf-8");
  await writeFile(join(resultDir, "kpi-summary.json"), JSON.stringify(kpiSummary, null, 2), "utf-8");
  await writeFile(join(resultDir, "analysis.md"), buildAnalysisMarkdown(args.scenario, args.runId, kpiSummary, normalizedFindings, taskResults), "utf-8");
}

function parseArgs(argv: string[]): { scenario: ScenarioName; runId: string } {
  const args = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (key?.startsWith("--") && value) {
      args.set(key.slice(2), value);
    }
  }
  const scenario = args.get("scenario");
  const runId = args.get("run-id");
  if (scenario !== "per-rule" && scenario !== "grouped-by-relevance") {
    throw new Error(`Expected --scenario per-rule|grouped-by-relevance, received: ${scenario ?? "missing"}`);
  }
  if (!runId) {
    throw new Error("Expected --run-id");
  }
  return { scenario, runId };
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf-8")) as T;
}

function buildPerRuleTasks(rules: RuleRecord[]): ReviewerTask[] {
  return rules.map((rule) => ({
    taskId: `rule-${rule.id}`,
    scopeId: rule.id,
    rules: [rule],
  }));
}

function buildGroupedTasks(rules: RuleRecord[], groups: GroupManifest): ReviewerTask[] {
  const ruleMap = new Map(rules.map((rule) => [rule.id, rule]));
  return groups.groups.map((group) => ({
    taskId: `group-${group.id}`,
    scopeId: group.id,
    rules: group.rules.map((ruleId) => {
      const rule = ruleMap.get(ruleId);
      if (!rule) {
        throw new Error(`Grouping manifest references unknown rule: ${ruleId}`);
      }
      return rule;
    }),
  }));
}

function buildReviewerPrompt(params: {
  scenario: ScenarioName;
  task: ReviewerTask;
  fixtureMarkdown: string;
  fixtureContract: string;
  reviewPrompt: Record<string, unknown>;
}): string {
  const serializedRules = JSON.stringify(
    params.task.rules.map((rule) => ({
      id: rule.id,
      rule: rule.rule,
      applies_to: rule.applies_to,
      do: rule.do,
      dont: rule.dont,
      source: rule.source,
      version: rule.version,
    })),
    null,
    2
  );

  const severityDefinitions = JSON.stringify(params.reviewPrompt["severity_definitions"] ?? {}, null, 2);
  return [
    "You are a focused ARB rules reviewer.",
    `Scenario: ${params.scenario}.`,
    `Scope id: ${params.task.scopeId}.`,
    "Review ONLY the assigned rules below against the supplied artifact and contract.",
    "Do not propose fixes. Do not review unrelated concerns. Do not evaluate any rule not assigned to you.",
    "Return JSON only. No markdown fences. No prose outside JSON.",
    "",
    "Assigned rules:",
    serializedRules,
    "",
    "Severity definitions:",
    severityDefinitions,
    "",
    "Artifact markdown:",
    params.fixtureMarkdown,
    "",
    "Artifact contract JSON:",
    params.fixtureContract,
    "",
    "Required JSON shape:",
    JSON.stringify({
      reviewer_id: params.task.taskId,
      scenario: params.scenario,
      scope_id: params.task.scopeId,
      evaluations: [
        {
          rule_id: "ARB-001",
          status: "compliant | non_compliant | not_applicable",
          severity: "blocking | major | minor | suggestion | none",
          summary: "short finding summary",
          evidence_location: "exact section or artifact location",
          evidence_quote: "short exact quote from the artifact",
          why_it_matters: "why this matters",
        },
      ],
      notes: ["optional short notes"],
    }, null, 2),
    "",
    "Rules:",
    "- Return exactly one evaluation object per assigned rule.",
    "- Use status=non_compliant only when the artifact actually violates that rule.",
    "- Use severity=none when status is compliant or not_applicable.",
    "- Keep evidence_quote short and exact.",
    "- If a rule is not applicable to this artifact, say why in why_it_matters.",
  ].join("\n");
}

async function invokeReviewerWithRetry(params: {
  provider: Provider;
  model: string;
  reasoning?: string;
  timeoutMs: number;
  retryOnceOnFailure: boolean;
  retryBackoffMs: number;
  prompt: string;
  sourcePath: string;
}) {
  try {
    return await invoke({
      cli: params.provider,
      model: params.model,
      reasoning: params.reasoning,
      timeout_ms: params.timeoutMs,
      prompt: params.prompt,
      source_path: params.sourcePath,
    });
  } catch (error) {
    if (!params.retryOnceOnFailure) {
      throw error;
    }
    await sleep(params.retryBackoffMs);
    return await invoke({
      cli: params.provider,
      model: params.model,
      reasoning: params.reasoning,
      timeout_ms: params.timeoutMs,
      prompt: params.prompt,
      source_path: params.sourcePath,
    });
  }
}

function parseReviewerResponse(raw: string): ReviewerResponse {
  const candidate = extractJsonText(raw);
  const parsed = JSON.parse(candidate) as ReviewerResponse;
  if (!parsed || !Array.isArray(parsed.evaluations)) {
    throw new Error("Reviewer response JSON missing evaluations array");
  }
  return parsed;
}

function extractJsonText(raw: string): string {
  const trimmed = raw.trim();
  const unfenced = trimmed
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  try {
    JSON.parse(unfenced);
    return unfenced;
  } catch {
    const firstBrace = unfenced.indexOf("{");
    const lastBrace = unfenced.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      return unfenced.slice(firstBrace, lastBrace + 1);
    }
    throw new Error("Could not extract reviewer JSON response");
  }
}

async function runWithConcurrency<T, R>(
  items: T[],
  concurrencyLimit: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(concurrencyLimit, items.length)) }, async () => {
    while (true) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      if (currentIndex >= items.length) {
        return;
      }
      results[currentIndex] = await worker(items[currentIndex], currentIndex);
    }
  });
  await Promise.all(workers);
  return results;
}

function normalizeFindings(taskResults: TaskResult[]) {
  return taskResults
    .filter((task) => task.success && task.reviewer_response)
    .flatMap((task) =>
      (task.reviewer_response?.evaluations ?? [])
        .filter((evaluation) => evaluation.status === "non_compliant")
        .map((evaluation) => ({
          finding_id: `${task.scope_id}-${evaluation.rule_id}`,
          source_task_id: task.task_id,
          scope_id: task.scope_id,
          rule_id: evaluation.rule_id,
          severity: evaluation.severity,
          summary: evaluation.summary,
          evidence_location: evaluation.evidence_location,
          evidence_quote: evaluation.evidence_quote,
          why_it_matters: evaluation.why_it_matters,
        }))
    );
}

function buildKpiSummary(params: {
  taskResults: TaskResult[];
  normalizedFindings: ReturnType<typeof normalizeFindings>;
  wallClockMs: number;
  mergeOverheadMs: number;
  parallelWidth: number;
  testerCount: number;
}) {
  const firstUsefulFindingMs = params.taskResults
    .filter((task) => task.success && (task.reviewer_response?.evaluations ?? []).some((evaluation) => evaluation.status === "non_compliant"))
    .map((task) => task.latency_ms)
    .sort((left, right) => left - right)[0] ?? params.wallClockMs;

  const successfulTasks = params.taskResults.filter((task) => task.success);
  const failedTasks = params.taskResults.filter((task) => !task.success);

  return {
    schema_version: "1.0",
    wall_clock_ms: params.wallClockMs,
    time_to_first_useful_finding_ms: firstUsefulFindingMs,
    tester_count: params.testerCount,
    tester_failure_count: failedTasks.length,
    parallel_width: params.parallelWidth,
    merge_overhead_ms: params.mergeOverheadMs,
    findings_raw_count: successfulTasks.reduce((sum, task) => sum + (task.reviewer_response?.evaluations.filter((evaluation) => evaluation.status === "non_compliant").length ?? 0), 0),
    findings_deduped_count: params.normalizedFindings.length,
    blocking_findings_count: params.normalizedFindings.filter((finding) => finding.severity === "blocking").length,
    major_findings_count: params.normalizedFindings.filter((finding) => finding.severity === "major").length,
    minor_findings_count: params.normalizedFindings.filter((finding) => finding.severity === "minor").length,
    suggestion_findings_count: params.normalizedFindings.filter((finding) => finding.severity === "suggestion").length,
    false_positive_count: 0,
    false_positive_count_measured: false,
    total_tokens_in: sumNumbers(successfulTasks.map((task) => task.invocation?.tokens_in_estimated)),
    total_tokens_out: sumNumbers(successfulTasks.map((task) => task.invocation?.tokens_out_estimated)),
    estimated_cost_usd: round6(sumNumbers(successfulTasks.map((task) => task.invocation?.estimated_cost_usd))),
  };
}

function buildAnalysisMarkdown(
  scenario: ScenarioName,
  runId: string,
  kpiSummary: ReturnType<typeof buildKpiSummary>,
  normalizedFindings: ReturnType<typeof normalizeFindings>,
  taskResults: TaskResult[]
): string {
  const topFindings = normalizedFindings
    .sort((left, right) => severityWeight(right.severity) - severityWeight(left.severity))
    .slice(0, 10)
    .map((finding) => `- [${finding.severity}] ${finding.rule_id}: ${finding.summary}`)
    .join("\n");

  return [
    "# Analysis",
    "",
    `- Scenario: ${scenario}`,
    `- Run id: ${runId}`,
    `- Wall clock ms: ${kpiSummary.wall_clock_ms}`,
    `- Time to first useful finding ms: ${kpiSummary.time_to_first_useful_finding_ms}`,
    `- Tester count: ${kpiSummary.tester_count}`,
    `- Tester failures: ${kpiSummary.tester_failure_count}`,
    `- Findings: ${kpiSummary.findings_deduped_count}`,
    `- Cost USD: ${kpiSummary.estimated_cost_usd}`,
    "",
    "## Top Findings",
    topFindings || "- None",
    "",
    "## Failed Tasks",
    ...taskResults.filter((task) => !task.success).map((task) => `- ${task.task_id}: ${task.error_message}`),
  ].join("\n");
}

function summarizeInvocation(attempts: Array<{
  latency_ms: number;
  success: boolean;
  session_status: string;
  error_message?: string;
  usage?: {
    tokens_in_estimated: number;
    tokens_out_estimated: number;
    estimated_cost_usd?: number;
  };
}>) {
  return {
    attempt_count: attempts.length,
    total_latency_ms: sumNumbers(attempts.map((attempt) => attempt.latency_ms)),
    session_statuses: attempts.map((attempt) => attempt.session_status),
    total_tokens_in_estimated: sumNumbers(attempts.map((attempt) => attempt.usage?.tokens_in_estimated)),
    total_tokens_out_estimated: sumNumbers(attempts.map((attempt) => attempt.usage?.tokens_out_estimated)),
    estimated_cost_usd: round6(sumNumbers(attempts.map((attempt) => attempt.usage?.estimated_cost_usd))),
    errors: attempts.filter((attempt) => !attempt.success).map((attempt) => attempt.error_message ?? "unknown error"),
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

function severityWeight(severity: Severity): number {
  switch (severity) {
    case "blocking":
      return 4;
    case "major":
      return 3;
    case "minor":
      return 2;
    case "suggestion":
      return 1;
    default:
      return 0;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

void main().catch(async (error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});

