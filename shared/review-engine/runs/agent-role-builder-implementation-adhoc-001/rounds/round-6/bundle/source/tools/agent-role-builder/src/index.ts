// Run from project root: ./tools/agent-role-builder/node_modules/.bin/tsx tools/agent-role-builder/src/index.ts <request.json>
// Do NOT use: npx tsx tools/agent-role-builder/src/index.ts (npx resolves from package dir, doubling the path)
import { readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { RoleBuilderRequest } from "./schemas/request.js";
import { type RoleBuilderResult, type RoleBuilderStatus, type ValidationIssue, type ParticipantRecord } from "./schemas/result.js";
import { validateRequest, selfCheck } from "./services/validator.js";
import { generateRoleMarkdown, generateRoleContract } from "./services/role-generator.js";
import { executeBoard } from "./services/board.js";
import { buildAuditEnvelope, pathExists, uniqueStringsCaseInsensitive } from "./services/audit-utils.js";
import { clearTelemetryBuffer, createSystemProvenance, emit, getTelemetryBuffer } from "./shared-imports.js";

interface CanonicalRolePaths {
  directory: string;
  markdown: string;
  contract: string;
  decisionLog: string;
  boardSummary: string;
}

/**
 * agent-role-builder — governed tool for creating agent role packages.
 *
 * 1. Validate request
 * 2. Generate leader draft (markdown + contract)
 * 3. Self-check coherence
 * 4. Execute live board review with revision between rounds
 * 5. Persist evidence artifacts
 * 6. Promote to canonical outputs on freeze
 */
export async function buildRole(requestPath: string, outputDir?: string): Promise<RoleBuilderResult> {
  const start = Date.now();
  const prov = createSystemProvenance("tools/agent-role-builder/build");
  clearTelemetryBuffer();

  const rawRequest = JSON.parse(await readFile(requestPath, "utf-8"));
  const request = RoleBuilderRequest.parse(rawRequest);
  const runDir = outputDir ?? join("tools/agent-role-builder/runs", request.job_id);

  // Bug 4 fix: Guard against duplicate runs on the same job ID
  const existingResult = join(runDir, "result.json");
  try {
    await stat(existingResult);
    // If stat succeeds, the file exists — block the run
    throw new Error(
      `Run directory already has a result (${existingResult}). Use a different job_id or delete the existing run.`
    );
  } catch (e) {
    // ENOENT means file doesn't exist — that's the expected case, continue
    if (e instanceof Error && "code" in e && (e as NodeJS.ErrnoException).code === "ENOENT") {
      // OK — no prior result, proceed
    } else if (e instanceof Error && e.message.includes("Run directory already has a result")) {
      throw e; // Re-throw our own guard error
    } else {
      console.error("[build] Could not check for prior result.json:", e instanceof Error ? e.message : e);
      // Non-fatal: proceed with the run
    }
  }

  const canonical = resolveCanonicalPaths(request);
  const runArtifacts = createRunArtifactPaths(request, runDir);

  await mkdir(runDir, { recursive: true });
  await mkdir(join(runDir, "drafts"), { recursive: true });
  await mkdir(join(runDir, "rounds"), { recursive: true });
  await mkdir(join(runDir, "runtime"), { recursive: true });

  await writeFile(join(runDir, "normalized-request.json"), JSON.stringify(request, null, 2), "utf-8");
  await writeFile(
    join(runDir, "source-manifest.json"),
    JSON.stringify(
      {
        request_path: requestPath,
        source_refs: request.source_refs,
      },
      null,
      2
    ),
    "utf-8"
  );
  await writeFile(
    join(runDir, "runtime", "session-registry.json"),
    JSON.stringify(
      {
        request_job_id: request.job_id,
        role_slug: request.role_slug,
        execution_mode: request.runtime.execution_mode,
        watchdog_timeout_seconds: request.runtime.watchdog_timeout_seconds,
        started_at_utc: new Date().toISOString(),
      },
      null,
      2
    ),
    "utf-8"
  );

  const validationIssues = validateRequest(request);
  const blockingIssues = validationIssues.filter((issue) => issue.severity === "error");

  if (blockingIssues.length > 0) {
    const result = buildResult({
      request,
      status: "blocked",
      runDir,
      canonical,
      issues: validationIssues,
      validationIssues,
      selfCheckIssues: [],
      participants: [],
      openQuestions: [],
      statusReason: `Blocked: ${blockingIssues.length} validation errors`,
      roundsExecuted: 0,
      arbitrationUsed: false,
    });
    await writeFile(join(runDir, "result.json"), JSON.stringify(result, null, 2), "utf-8");
    await writeCyclePostmortem({
      request,
      runDir,
      status: result.status,
      statusReason: result.status_reason,
      roundsExecuted: 0,
      participants: [],
      validationIssues,
      startedAtMs: start,
    });
    return result;
  }

  const draftMarkdown = generateRoleMarkdown(request);
  const draftContract = generateRoleContract(
    request,
    basename(canonical.markdown),
    basename(canonical.contract),
    basename(canonical.decisionLog),
    basename(canonical.boardSummary)
  );

  await writeFile(join(runDir, "drafts", basename(canonical.markdown)), draftMarkdown, "utf-8");
  await writeFile(join(runDir, "drafts", basename(canonical.contract)), JSON.stringify(draftContract, null, 2), "utf-8");

  const initialSelfCheckIssues = selfCheck(draftMarkdown, request);
  await writeFile(join(runDir, "self-check.json"), JSON.stringify(initialSelfCheckIssues, null, 2), "utf-8");

  const boardResult = await executeBoard(request, draftMarkdown, draftContract, initialSelfCheckIssues, runDir);

  for (const round of boardResult.rounds) {
    await writeFile(
      join(runDir, "rounds", `round-${round.round}.json`),
      JSON.stringify(round, null, 2),
      "utf-8"
    );
  }

  const finalContract = {
    ...draftContract,
    package_generated_at_utc: new Date().toISOString(),
    final_status: boardResult.status,
    final_markdown_path: relative(runDir, runArtifacts.markdown),
  };

  await writeFile(runArtifacts.markdown, boardResult.finalMarkdown, "utf-8");
  await writeFile(runArtifacts.contract, JSON.stringify(finalContract, null, 2), "utf-8");
  await writeFile(join(runDir, "self-check.json"), JSON.stringify(boardResult.finalSelfCheckIssues, null, 2), "utf-8");

  const boardSummary = generateBoardSummary(request, boardResult);
  await writeFile(runArtifacts.boardSummary, boardSummary, "utf-8");

  const decisionLog = buildDecisionLog(request, boardResult.status, boardResult.statusReason, boardSummary);
  await writeFile(runArtifacts.decisionLog, decisionLog, "utf-8");

  if (boardResult.status === "pushback" || boardResult.status === "blocked") {
    const pushback = {
      schema_version: "1.0",
      status: boardResult.status,
      role_slug: request.role_slug,
      issue: "The requested role package is not safe to freeze as submitted.",
      why_it_blocks: boardResult.statusReason,
      evidence: {
        validation_issues: validationIssues,
        self_check_issues: boardResult.finalSelfCheckIssues,
        board_rounds: boardResult.rounds.length,
        decision_log_path: runArtifacts.decisionLog,
        board_summary_path: runArtifacts.boardSummary,
      },
    };
    await writeFile(join(runDir, `${request.role_slug}-pushback.json`), JSON.stringify(pushback, null, 2), "utf-8");
  }

  if (boardResult.status === "resume_required") {
    await writeFile(
      join(runDir, "resume-package.json"),
      JSON.stringify(
        {
          schema_version: "1.0",
          role_slug: request.role_slug,
          request_job_id: request.job_id,
          next_step: "resume_board_review",
          unresolved: boardResult.rounds[boardResult.rounds.length - 1]?.unresolved ?? [],
          latest_markdown_path: runArtifacts.markdown,
          latest_contract_path: runArtifacts.contract,
          latest_board_summary_path: runArtifacts.boardSummary,
          latest_decision_log_path: runArtifacts.decisionLog,
          round_files: boardResult.rounds.map((round) => join(runDir, "rounds", `round-${round.round}.json`)),
        },
        null,
        2
      ),
      "utf-8"
    );
  }

  if (boardResult.status === "frozen_with_conditions") {
    await writeFile(
      join(runDir, "conditions-manifest.json"),
      JSON.stringify(
        {
          schema_version: "1.0",
          role_slug: request.role_slug,
          request_job_id: request.job_id,
          arbitration_used: boardResult.rounds.some((round) => round.arbitrationUsed),
          deferred_items: boardResult.rounds[boardResult.rounds.length - 1]?.deferredItems ?? [],
          latest_markdown_path: runArtifacts.markdown,
          latest_contract_path: runArtifacts.contract,
          latest_board_summary_path: runArtifacts.boardSummary,
          latest_decision_log_path: runArtifacts.decisionLog,
        },
        null,
        2
      ),
      "utf-8"
    );
  }

  if (boardResult.status === "frozen" || boardResult.status === "frozen_with_conditions") {
    await mkdir(canonical.directory, { recursive: true });
    await writeFile(canonical.markdown, boardResult.finalMarkdown, "utf-8");
    await writeFile(canonical.contract, JSON.stringify(finalContract, null, 2), "utf-8");
    await writeFile(canonical.decisionLog, decisionLog, "utf-8");
    await writeFile(canonical.boardSummary, boardSummary, "utf-8");
  }

  const result = buildResult({
    request,
    status: boardResult.status,
    runDir,
    canonical,
    issues: [...validationIssues, ...boardResult.finalSelfCheckIssues.map(toValidationIssue)],
    validationIssues,
    selfCheckIssues: boardResult.finalSelfCheckIssues.map(toValidationIssue),
    participants: boardResult.allParticipants,
    openQuestions: boardResult.rounds.flatMap((round) => round.unresolved),
    statusReason: boardResult.statusReason,
    roundsExecuted: boardResult.rounds.length,
    arbitrationUsed: boardResult.rounds.some((round) => round.arbitrationUsed),
  });

  await writeFile(join(runDir, "result.json"), JSON.stringify(result, null, 2), "utf-8");
  await writeCyclePostmortem({
    request,
    runDir,
    status: result.status,
    statusReason: result.status_reason,
    roundsExecuted: boardResult.rounds.length,
    participants: boardResult.allParticipants,
    validationIssues: [...validationIssues, ...boardResult.finalSelfCheckIssues.map(toValidationIssue)],
    startedAtMs: start,
    unresolvedTrend: boardResult.rounds.map((round) => round.unresolved.length),
  });

  emit({
    provenance: prov,
    category: "tool",
    operation: "agent-role-builder",
    latency_ms: Date.now() - start,
    success: boardResult.status === "frozen" || boardResult.status === "frozen_with_conditions",
    board_rounds: boardResult.rounds.length,
    participants: boardResult.allParticipants.length,
  });

  return result;
}

async function writeCyclePostmortem(params: {
  request: RoleBuilderRequest;
  runDir: string;
  status: RoleBuilderStatus;
  statusReason: string;
  roundsExecuted: number;
  participants: ParticipantRecord[];
  validationIssues: ValidationIssue[];
  startedAtMs: number;
  unresolvedTrend?: number[];
}): Promise<void> {
  const telemetry = getTelemetryBuffer();
  const llmEvents = telemetry.filter((event) => event.category === "llm");
  const toolEvents = telemetry.filter((event) => event.category === "tool");
  const reviewerParticipants = params.participants.filter((participant) => participant.role === "reviewer");
  const fallbackCount = params.participants.filter((participant) => participant.was_fallback).length;
  const reviewerInvocations = reviewerParticipants.length;
  const reviewerSlotsTotal = params.request.board_roster.reviewers.length * Math.max(params.roundsExecuted, 1);
  const skippedReviewerInvocations = Math.max(0, reviewerSlotsTotal - reviewerInvocations);

  const resultJsonExists = await pathExists(join(params.runDir, "result.json"));
  const runPostmortemExists = await pathExists(join(params.runDir, "run-postmortem.json"));
  const normalizedRequestExists = await pathExists(join(params.runDir, "normalized-request.json"));
  const sessionRegistryExists = await pathExists(join(params.runDir, "runtime", "session-registry.json"));
  const cyclePostmortemPath = join(params.runDir, "cycle-postmortem.json");

  const basePostmortem = {
    schema_version: "1.0",
    component: "agent-role-builder",
    request_job_id: params.request.job_id,
    role_slug: params.request.role_slug,
    final_status: params.status,
    final_status_reason: params.statusReason,
    generated_at: new Date().toISOString(),
    questions_ref: "shared/learning-engine/postmortem-questions.json",
    kpi_summary: {
      total_duration_ms: Date.now() - params.startedAtMs,
      rounds_executed: params.roundsExecuted,
      participant_invocations: params.participants.length,
      reviewer_invocations: reviewerInvocations,
      skipped_reviewer_invocations: skippedReviewerInvocations,
      fallback_count: fallbackCount,
      llm_call_count: llmEvents.length,
      llm_failures: llmEvents.filter((event) => !event.success).length,
      tool_events: toolEvents.length,
      total_llm_latency_ms: llmEvents.reduce((sum, event) => sum + event.latency_ms, 0),
      total_tokens_in: sumOptionalNumber(llmEvents.map((event) => event.tokens_in)),
      total_tokens_out: sumOptionalNumber(llmEvents.map((event) => event.tokens_out)),
      total_estimated_cost_usd: sumOptionalNumber(llmEvents.map((event) => event.estimated_cost_usd)),
      unresolved_trend: params.unresolvedTrend ?? [],
    },
    artifacts: {
      result_json: resultJsonExists,
      run_postmortem: runPostmortemExists,
      cycle_postmortem: false,
      normalized_request: normalizedRequestExists,
      session_registry: sessionRegistryExists,
    },
    audit: buildAuditEnvelope({
      requestJobId: params.request.job_id,
      round: Math.max(0, params.roundsExecuted - 1),
      reviewMode: null,
      participants: params.participants,
      artifactRefs: {
        result_json: join(params.runDir, "result.json"),
        run_postmortem: join(params.runDir, "run-postmortem.json"),
        cycle_postmortem: cyclePostmortemPath,
        normalized_request: join(params.runDir, "normalized-request.json"),
        session_registry: join(params.runDir, "runtime", "session-registry.json"),
      },
    }),
    question_outputs: {
      "PM-002": {
        rounds: params.roundsExecuted,
        duration_ms: Date.now() - params.startedAtMs,
        llm_call_count: llmEvents.length,
        fallback_count: fallbackCount,
        reviewer_reuse_savings: skippedReviewerInvocations,
      },
      "PM-003": {
        telemetry_events_captured: telemetry.length,
        validation_issue_count: params.validationIssues.length,
      },
      "PM-007": {
        unresolved_trend: params.unresolvedTrend ?? [],
        converged: (params.unresolvedTrend?.length ?? 0) <= 1
          ? true
          : (params.unresolvedTrend?.[params.unresolvedTrend.length - 1] ?? 0) <= (params.unresolvedTrend?.[0] ?? 0),
      },
    },
  };

  await writeFile(cyclePostmortemPath, JSON.stringify(basePostmortem, null, 2), "utf-8");
  const cyclePostmortemExists = await pathExists(cyclePostmortemPath);
  if (cyclePostmortemExists) {
    const finalizedPostmortem = {
      ...basePostmortem,
      artifacts: {
        ...basePostmortem.artifacts,
        cycle_postmortem: true,
      },
    };
    await writeFile(cyclePostmortemPath, JSON.stringify(finalizedPostmortem, null, 2), "utf-8");
  }
}

function buildResult(params: {
  request: RoleBuilderRequest;
  status: RoleBuilderStatus;
  runDir: string;
  canonical: CanonicalRolePaths;
  issues: ValidationIssue[];
  validationIssues: ValidationIssue[];
  selfCheckIssues: ValidationIssue[];
  participants: ParticipantRecord[];
  openQuestions: string[];
  statusReason: string;
  roundsExecuted: number;
  arbitrationUsed: boolean;
}): RoleBuilderResult {
  const {
    request,
    status,
    runDir,
    canonical,
    issues,
    validationIssues,
    selfCheckIssues,
    participants,
    openQuestions,
    statusReason,
    roundsExecuted,
    arbitrationUsed,
  } = params;
  const frozen = status === "frozen" || status === "frozen_with_conditions";

  return {
    schema_version: "1.0",
    tool_name: "agent-role-builder",
    request_job_id: request.job_id,
    role_slug: request.role_slug,
    operation: request.operation,
    status,
    execution_mode: request.runtime.execution_mode,
    summary: `${request.role_name} role ${frozen ? "frozen successfully" : `${status}: ${statusReason}`}`,
    status_reason: statusReason,
    output_dir: runDir,
    canonical_role_directory: frozen ? canonical.directory : null,
    canonical_role_markdown_path: frozen ? canonical.markdown : null,
    canonical_role_contract_path: frozen ? canonical.contract : null,
    canonical_decision_log_path: frozen ? canonical.decisionLog : null,
    canonical_board_summary_path: frozen ? canonical.boardSummary : null,
    pushback_path: status === "pushback" || status === "blocked" ? join(runDir, `${request.role_slug}-pushback.json`) : null,
    conditions_manifest_path: status === "frozen_with_conditions" ? join(runDir, "conditions-manifest.json") : null,
    resume_package_path: status === "resume_required" ? join(runDir, "resume-package.json") : null,
    board: {
      profile: request.board_roster.profile,
      leader_count: request.board_roster.leader_count,
      reviewer_count: request.board_roster.reviewer_count,
      rounds_executed: roundsExecuted,
      arbitration_used: arbitrationUsed,
      participant_records: participants,
    },
    evidence: {
      source_count: request.source_refs.length,
      missing_required_source_count: validationIssues.filter((issue) => issue.code === "MISSING_REQUIRED_SOURCE").length,
      validation_issue_count: validationIssues.length,
      self_check_issue_count: selfCheckIssues.length,
    },
    validation_issues: issues,
    open_questions: uniqueStringsCaseInsensitive(openQuestions),
    red_flags: issues.filter((issue) => issue.severity === "error").map((issue) => issue.message),
  };
}

function generateBoardSummary(
  request: RoleBuilderRequest,
  boardResult: {
    status: string;
    rounds: Array<{
      round: number;
      leaderVerdict: string;
      leaderRationale: string;
      participants: ParticipantRecord[];
      unresolved: string[];
      improvementsApplied: string[];
    }>;
    statusReason: string;
  }
): string {
  const lines = [
    `# Board Summary: ${request.role_name}`,
    "",
    `Status: ${boardResult.status}`,
    `Reason: ${boardResult.statusReason}`,
    `Rounds: ${boardResult.rounds.length}`,
    "",
  ];

  for (const round of boardResult.rounds) {
    lines.push(`## Round ${round.round}`);
    lines.push(`Leader verdict: ${round.leaderVerdict}`);
    lines.push(`Rationale: ${round.leaderRationale}`);
    if (round.improvementsApplied.length > 0) {
      lines.push("Improvements applied:");
      lines.push(...round.improvementsApplied.map((item) => `- ${item}`));
    }
    if (round.unresolved.length > 0) {
      lines.push("Unresolved:");
      lines.push(...round.unresolved.map((item) => `- ${item}`));
    }
    lines.push(`Participants: ${round.participants.length}`);
    lines.push(...round.participants.map((participant) => `- ${participant.participant_id} (${participant.provider}/${participant.model})`));
    lines.push("");
  }

  return lines.join("\n");
}

function buildDecisionLog(
  request: RoleBuilderRequest,
  status: RoleBuilderStatus,
  statusReason: string,
  boardSummary: string
): string {
  return [
    `# ${request.role_name} - Decision Log`,
    "",
    `## ${new Date().toISOString()} - ${request.operation}`,
    "",
    `Status: ${status}`,
    `Reason: ${statusReason}`,
    "",
    boardSummary,
    "",
  ].join("\n");
}

function resolveCanonicalPaths(request: RoleBuilderRequest): CanonicalRolePaths {
  const match = (suffix: string) =>
    request.required_outputs.find((path) => path.endsWith(`${request.role_slug}${suffix}`));

  const markdown = match("-role.md");
  const contract = match("-role-contract.json");
  const decisionLog = match("-decision-log.md");
  const boardSummary = match("-board-summary.md");

  if (!markdown || !contract || !decisionLog || !boardSummary) {
    throw new Error("required_outputs must declare markdown, contract, decision log, and board summary canonical paths");
  }

  const directory = dirname(markdown);
  return { directory, markdown, contract, decisionLog, boardSummary };
}

function createRunArtifactPaths(request: RoleBuilderRequest, runDir: string) {
  return {
    markdown: join(runDir, `${request.role_slug}-role.md`),
    contract: join(runDir, `${request.role_slug}-role-contract.json`),
    decisionLog: join(runDir, `${request.role_slug}-decision-log.md`),
    boardSummary: join(runDir, `${request.role_slug}-board-summary.md`),
  };
}

function toValidationIssue(issue: { code: string; message: string }): ValidationIssue {
  return {
    code: issue.code,
    severity: "error",
    message: issue.message,
  };
}

function sumOptionalNumber(values: Array<number | undefined>): number | null {
  const present = values.filter((value): value is number => typeof value === "number");
  if (present.length === 0) return null;
  return present.reduce((sum, value) => sum + value, 0);
}

function basename(path: string): string {
  return path.replace(/^.*[\\/]/, "");
}

if (process.argv[1]?.endsWith("index.ts") || process.argv[1]?.endsWith("index.js")) {
  const requestPath = process.argv[2];
  const outputDir = process.argv[3];

  if (!requestPath) {
    console.error("Usage: agent-role-builder <request.json> [output-dir]");
    process.exit(1);
  }

  buildRole(requestPath, outputDir)
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
      process.exit(result.status === "frozen" || result.status === "frozen_with_conditions" ? 0 : 1);
    })
    .catch((err) => {
      console.error("Fatal:", err);
      process.exit(2);
    });
}
