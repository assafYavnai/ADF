import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { RoleBuilderRequest } from "./schemas/request.js";
import { RoleBuilderResult, RoleBuilderStatus, type ValidationIssue, type ParticipantRecord } from "./schemas/result.js";
import { validateRequest, selfCheck } from "./services/validator.js";
import { generateRoleMarkdown, generateRoleContract } from "./services/role-generator.js";
import { executeBoard } from "./services/board.js";
import { createSystemProvenance, emit } from "./shared-imports.js";

/**
 * agent-role-builder — governed tool for creating agent role packages.
 *
 * 1. Validate request
 * 2. Generate leader draft (markdown + contract)
 * 3. Self-check coherence
 * 4. Execute live board review
 * 5. Determine terminal status
 * 6. Promote or pushback
 */
export async function buildRole(requestPath: string, outputDir?: string): Promise<RoleBuilderResult> {
  const start = Date.now();
  const prov = createSystemProvenance("tools/agent-role-builder/build");

  // Parse request
  const rawRequest = JSON.parse(await readFile(requestPath, "utf-8"));
  const request = RoleBuilderRequest.parse(rawRequest);

  const runDir = outputDir ?? join("tools/agent-role-builder/runs", request.job_id);
  await mkdir(runDir, { recursive: true });

  // Save normalized request
  await writeFile(join(runDir, "normalized-request.json"), JSON.stringify(request, null, 2), "utf-8");

  // Step 1: Validate
  const validationIssues = validateRequest(request);
  const blockingIssues = validationIssues.filter((i) => i.severity === "error");

  if (blockingIssues.length > 0) {
    return buildResult(request, runDir, "blocked", validationIssues, [], [],
      `Blocked: ${blockingIssues.length} validation errors`, 0, start);
  }

  // Step 2: Generate leader draft
  const draftMarkdown = generateRoleMarkdown(request);
  const slug = request.role_slug;
  const roleMdPath = `${slug}-role.md`;
  const roleContractPath = `${slug}-role-contract.json`;
  const decisionLogPath = `${slug}-decision-log.md`;
  const boardSummaryPath = `${slug}-board-summary.md`;

  await mkdir(join(runDir, "drafts"), { recursive: true });
  await writeFile(join(runDir, "drafts", roleMdPath), draftMarkdown, "utf-8");

  const draftContract = generateRoleContract(
    request, roleMdPath, roleContractPath, decisionLogPath, boardSummaryPath
  );
  await writeFile(join(runDir, "drafts", roleContractPath), JSON.stringify(draftContract, null, 2), "utf-8");

  // Step 3: Self-check
  const selfCheckIssues = selfCheck(draftMarkdown, request);
  await writeFile(join(runDir, "self-check.json"), JSON.stringify(selfCheckIssues, null, 2), "utf-8");

  if (selfCheckIssues.some((i) => i.severity === "error") && request.board_roster.reviewer_count === 0) {
    return buildResult(request, runDir, "blocked",
      [...validationIssues, ...selfCheckIssues], [], [],
      `Blocked: self-check errors with no reviewers configured`, 0, start);
  }

  // Step 4: Execute board review
  const boardResult = await executeBoard(request, draftMarkdown, draftContract, selfCheckIssues);

  // Step 5: Write board summary
  const boardSummary = generateBoardSummary(request, boardResult);
  await writeFile(join(runDir, boardSummaryPath), boardSummary, "utf-8");

  // Step 6: If frozen, promote to canonical
  if (boardResult.status === "frozen") {
    const canonicalDir = join("tools/agent-role-builder/role");
    await mkdir(canonicalDir, { recursive: true });

    await writeFile(join(canonicalDir, roleMdPath), draftMarkdown, "utf-8");
    await writeFile(join(canonicalDir, roleContractPath), JSON.stringify(draftContract, null, 2), "utf-8");

    const decisionLog = `# ${request.role_name} — Decision Log\n\n## ${new Date().toISOString()} — ${request.operation}\n\n${boardSummary}`;
    await writeFile(join(canonicalDir, decisionLogPath), decisionLog, "utf-8");
    await writeFile(join(canonicalDir, boardSummaryPath), boardSummary, "utf-8");
  }

  // Step 7: If pushback, write pushback file
  if (boardResult.status === "pushback" || boardResult.status === "blocked") {
    const pushback = {
      schema_version: "1.0",
      status: boardResult.status,
      role_slug: request.role_slug,
      issue: "The requested role package is not safe to freeze as submitted.",
      why_it_blocks: boardResult.statusReason,
      evidence: {
        validation_issues: validationIssues,
        self_check_issues: selfCheckIssues,
        board_rounds: boardResult.rounds.length,
      },
    };
    await writeFile(join(runDir, `${slug}-pushback.json`), JSON.stringify(pushback, null, 2), "utf-8");
  }

  const result = buildResult(
    request, runDir, boardResult.status,
    [...validationIssues, ...selfCheckIssues],
    boardResult.allParticipants,
    boardResult.rounds.flatMap((r) => r.unresolved),
    boardResult.statusReason,
    boardResult.rounds.length,
    start
  );

  await writeFile(join(runDir, "result.json"), JSON.stringify(result, null, 2), "utf-8");

  emit({
    provenance: prov,
    category: "tool",
    operation: "agent-role-builder",
    latency_ms: Date.now() - start,
    success: boardResult.status === "frozen",
    board_rounds: boardResult.rounds.length,
    participants: boardResult.allParticipants.length,
  });

  return result;
}

function buildResult(
  request: RoleBuilderRequest,
  runDir: string,
  status: RoleBuilderStatus,
  issues: ValidationIssue[],
  participants: ParticipantRecord[],
  openQuestions: string[],
  statusReason: string,
  roundsExecuted: number,
  startTime: number
): RoleBuilderResult {
  const slug = request.role_slug;
  const frozen = status === "frozen";

  return {
    schema_version: "1.0",
    tool_name: "agent-role-builder",
    request_job_id: request.job_id,
    role_slug: slug,
    operation: request.operation,
    status,
    execution_mode: "live-roster-v1",
    summary: `${request.role_name} role ${status === "frozen" ? "frozen successfully" : `${status}: ${statusReason}`}`,
    status_reason: statusReason,
    output_dir: runDir,
    canonical_role_directory: frozen ? `tools/agent-role-builder/role` : null,
    canonical_role_markdown_path: frozen ? `tools/agent-role-builder/role/${slug}-role.md` : null,
    canonical_role_contract_path: frozen ? `tools/agent-role-builder/role/${slug}-role-contract.json` : null,
    canonical_decision_log_path: frozen ? `tools/agent-role-builder/role/${slug}-decision-log.md` : null,
    canonical_board_summary_path: frozen ? `tools/agent-role-builder/role/${slug}-board-summary.md` : null,
    pushback_path: (status === "pushback" || status === "blocked") ? join(runDir, `${slug}-pushback.json`) : null,
    resume_package_path: status === "resume_required" ? join(runDir, "resume-package.json") : null,
    board: {
      profile: request.board_roster.profile,
      leader_count: 1,
      reviewer_count: request.board_roster.reviewer_count,
      rounds_executed: roundsExecuted,
      arbitration_used: false,
      participant_records: participants,
    },
    evidence: {
      source_count: request.source_refs.length,
      missing_required_source_count: issues.filter((i) => i.code === "MISSING_REQUIRED_SOURCE").length,
      validation_issue_count: issues.filter((i) => i.severity === "error").length,
      self_check_issue_count: issues.filter((i) => i.code?.startsWith("MISSING_")).length,
    },
    validation_issues: issues,
    open_questions: openQuestions,
    red_flags: issues.filter((i) => i.severity === "error").map((i) => i.message),
  };
}

function generateBoardSummary(
  request: RoleBuilderRequest,
  boardResult: { status: string; rounds: Array<{ round: number; leaderVerdict: string; leaderRationale: string; participants: ParticipantRecord[] }>; statusReason: string }
): string {
  const lines = [
    `# Board Summary: ${request.role_name}`,
    ``,
    `**Status:** ${boardResult.status}`,
    `**Reason:** ${boardResult.statusReason}`,
    `**Rounds:** ${boardResult.rounds.length}`,
    ``,
  ];

  for (const round of boardResult.rounds) {
    lines.push(`## Round ${round.round}`);
    lines.push(`Leader verdict: ${round.leaderVerdict}`);
    lines.push(`Rationale: ${round.leaderRationale}`);
    lines.push(`Participants: ${round.participants.length}`);
    for (const p of round.participants) {
      lines.push(`- ${p.participant_id} (${p.provider}/${p.model}): ${(p.verdict ?? "").slice(0, 100)}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

// --- CLI entry point ---
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
      process.exit(result.status === "frozen" ? 0 : 1);
    })
    .catch((err) => {
      console.error("Fatal:", err);
      process.exit(2);
    });
}
