// Run from project root: ./tools/agent-role-builder/node_modules/.bin/tsx tools/agent-role-builder/src/index.ts <request.json>
// Do NOT use: npx tsx tools/agent-role-builder/src/index.ts (npx resolves from package dir, doubling the path)
import { readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { RoleBuilderRequest } from "./schemas/request.js";
import { type RoleBuilderResult, type RoleBuilderStatus, type ValidationIssue, type ParticipantRecord } from "./schemas/result.js";
import { validateRequestSanity, selfCheck } from "./services/validator.js";
import { generateRoleMarkdown, generateRoleContract } from "./services/role-generator.js";
import { executeBoard } from "./services/board.js";
import { buildAuditEnvelope, pathExists, uniqueStringsCaseInsensitive } from "./services/audit-utils.js";
import { appendIngressAuditEvent, normalizeJsonText, writeBootstrapIngressIncident, writeBootstrapStartupIncident } from "./services/json-ingress.js";
import { applyFutureRunRulebookPromotion } from "./services/rulebook-promotion.js";
import { assertResumePackageMatchesRole, buildNextResumePackage, loadResumeState } from "./services/resume-state.js";
import { buildInitialSessionRegistry, writeSessionRegistry } from "./services/session-registry.js";
import { writeRunTelemetry } from "./services/run-telemetry.js";
import { loadSharedGovernanceRuntimeModule } from "./services/shared-module-loader.js";
import { clearTelemetryBuffer, createSystemProvenance, emit, getTelemetryBuffer } from "./shared-imports.js";

interface CanonicalRolePaths {
  directory: string;
  markdown: string;
  contract: string;
  decisionLog: string;
  boardSummary: string;
}

interface GovernanceBindingValue {
  snapshot_id: string;
  snapshot_manifest_path: string;
}

interface LearningArtifactRef {
  path: string;
  effect: "future_run_candidate";
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
  const startIso = new Date().toISOString();
  const prov = createSystemProvenance("tools/agent-role-builder/build");
  clearTelemetryBuffer();
  const toolRunRoot = join("tools", "agent-role-builder", "runs");
  let governanceRuntime: Awaited<ReturnType<typeof loadSharedGovernanceRuntimeModule>>;
  try {
    governanceRuntime = await loadSharedGovernanceRuntimeModule();
  } catch (error) {
    const incidentPath = await writeBootstrapStartupIncident({
      toolRunRoot,
      requestPath,
      stage: "shared_governance_runtime_load",
      message: error instanceof Error ? error.message : String(error),
      details: {
        component: "shared/governance-runtime",
      },
    });
    throw new Error(`Failed to load governance runtime. Bootstrap incident: ${incidentPath}`);
  }

  let rawRequestText: string;
  try {
    rawRequestText = await readFile(requestPath, "utf-8");
  } catch (error) {
    const incidentPath = await writeBootstrapStartupIncident({
      toolRunRoot,
      requestPath,
      stage: "request_file_read",
      message: error instanceof Error ? error.message : String(error),
    });
    throw new Error(`Failed to read role-builder request file. Bootstrap incident: ${incidentPath}`);
  }
  const requestIngress = normalizeJsonText(rawRequestText);
  let rawRequest: unknown;
  try {
    rawRequest = JSON.parse(requestIngress.text);
  } catch (error) {
    const incidentPath = await writeBootstrapIngressIncident({
      toolRunRoot,
      requestPath,
      stage: "request_json_parse",
      meta: requestIngress.meta,
      message: error instanceof Error ? error.message : String(error),
    });
    throw new Error(`Failed to parse role-builder request JSON. Bootstrap incident: ${incidentPath}`);
  }
  let request: RoleBuilderRequest;
  try {
    request = RoleBuilderRequest.parse(rawRequest);
  } catch (error) {
    const incidentPath = await writeBootstrapStartupIncident({
      toolRunRoot,
      requestPath,
      stage: "request_schema_validation",
      message: error instanceof Error ? error.message : String(error),
      meta: requestIngress.meta,
      details: {
        error_name: error instanceof Error ? error.name : typeof error,
      },
    });
    throw new Error(`Failed to validate role-builder request schema. Bootstrap incident: ${incidentPath}`);
  }
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
  if (requestIngress.meta.had_utf8_bom) {
    await appendIngressAuditEvent(join(runDir, "runtime", "ingress-normalization.jsonl"), {
      stage: "request_json_parse",
      source_path: requestPath.replace(/\\/g, "/"),
      transform: "strip_utf8_bom",
      raw_sha256: requestIngress.meta.raw_sha256,
      normalized_sha256: requestIngress.meta.normalized_sha256,
      outcome: "continued",
      recorded_at: new Date().toISOString(),
    });
  }

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
  const sessionRegistryPath = join(runDir, "runtime", "session-registry.json");
  await writeSessionRegistry(
    sessionRegistryPath,
    buildInitialSessionRegistry({
      request,
      startedAtIso: startIso,
    })
  );

  const recordRunTelemetry = async (params: {
    currentPhase: string;
    roundsAttempted: number;
    roundsCompleted: number;
    participants: ParticipantRecord[];
    governanceBinding?: GovernanceBindingValue | null;
    latestLearningPath?: string | null;
    runPostmortemPath?: string | null;
    cyclePostmortemPath?: string | null;
    resultPath?: string | null;
    terminalStatus?: RoleBuilderStatus | null;
    stopReason?: string | null;
  }) => {
    await writeRunTelemetry({
      request,
      runDir,
      startedAtMs: start,
      startedAtIso: startIso,
      currentPhase: params.currentPhase,
      roundsAttempted: params.roundsAttempted,
      roundsCompleted: params.roundsCompleted,
      participants: params.participants,
      governanceBinding: params.governanceBinding ?? null,
      latestLearningPath: params.latestLearningPath ?? null,
      runPostmortemPath: params.runPostmortemPath ?? null,
      cyclePostmortemPath: params.cyclePostmortemPath ?? null,
      resultPath: params.resultPath ?? null,
      terminalStatus: params.terminalStatus ?? null,
      stopReason: params.stopReason ?? null,
    });
  };

  await recordRunTelemetry({
    currentPhase: "startup",
    roundsAttempted: 0,
    roundsCompleted: 0,
    participants: [],
  });

  const validationIssues = validateRequestSanity(request);
  let governanceBinding: GovernanceBindingValue | null = null;
  let governanceContext: {
    snapshot_id: string;
    snapshot_manifest_path: string;
    shared_contract_path: string;
    component_contract_path: string;
    component_rulebook_path: string;
    component_review_prompt_path: string;
    authority_doc_paths: string[];
    review_runtime_config: unknown;
  } | null = null;
  const authorityPaths = {
    shared_contract: join("shared", "learning-engine", "review-contract.json"),
    component_contract: join("tools", "agent-role-builder", "review-contract.json"),
    component_rulebook: join("tools", "agent-role-builder", "rulebook.json"),
    component_review_prompt: join("tools", "agent-role-builder", "review-prompt.json"),
    authority_docs: [
      join("docs", "v0", "review-process-architecture.md"),
      join("docs", "v0", "architecture.md"),
    ],
  };
  const governanceIncidentPath = join(runDir, "governance-incident.json");
  const intendedSnapshotManifestPath = join(runDir, "governance-snapshot.json").replace(/\\/g, "/");
  let blockingIssues = validationIssues.filter((issue) => issue.severity === "error");

  if (blockingIssues.length > 0) {
    const pushbackPath = join(runDir, `${request.role_slug}-pushback.json`);
    await writeFile(join(runDir, "self-check.json"), JSON.stringify([], null, 2), "utf-8");
    await writePushbackArtifact({
      request,
      runDir,
      status: "blocked",
      statusReason: `Blocked: ${blockingIssues.length} validation errors`,
      validationIssues,
      selfCheckIssues: [],
      boardRounds: 0,
    });
    const result = buildResult({
      request,
      status: "blocked",
      runDir,
      canonical,
      issues: validationIssues,
      validationIssues,
      selfCheckIssues: [],
      participants: [],
      governanceBinding,
      pushbackPath,
      learningArtifact: null,
      openQuestions: [],
      statusReason: `Blocked: ${blockingIssues.length} validation errors`,
      roundsExecuted: 0,
      arbitrationUsed: false,
    });
    await writeFile(join(runDir, "result.json"), JSON.stringify(result, null, 2), "utf-8");
    await writeZeroRoundRunPostmortem({
      request,
      runDir,
      status: result.status,
      statusReason: result.status_reason,
      validationIssues,
      selfCheckIssues: [],
      governanceBinding,
      pushbackPath,
      bindGovernance: governanceRuntime.bindGovernance,
    });
    await writeCyclePostmortem({
      request,
      runDir,
      status: result.status,
      statusReason: result.status_reason,
      roundsExecuted: 0,
      participants: [],
      validationIssues,
      selfCheckIssues: [],
      reviewIssueCount: 0,
      governanceBinding,
      bindGovernance: governanceRuntime.bindGovernance,
      startedAtMs: start,
    });
    return result;
  }

  try {
    const rosterBootstrap = await governanceRuntime.loadPilotRosterBootstrap(authorityPaths.shared_contract);
    const rosterFaults = governanceRuntime.validatePilotRoster(request.board_roster, rosterBootstrap) as Array<{
      code: string;
      message: string;
      evidence?: string;
    }>;
    validationIssues.push(
      ...rosterFaults.map((fault) => ({
        code: fault.code,
        severity: "error" as const,
        message: fault.message,
        evidence: fault.evidence,
      }))
    );
    if (rosterFaults.length > 0) {
      await writeFile(join(runDir, "self-check.json"), JSON.stringify([], null, 2), "utf-8");
      await governanceRuntime.writeGovernanceIncident(governanceIncidentPath, {
        governance_binding: null,
        stage: "pre_snapshot_roster_validation",
        faults: rosterFaults,
        status: "blocked",
        intended_snapshot_manifest_path: intendedSnapshotManifestPath,
      });
      const result = buildResult({
        request,
        status: "blocked",
        runDir,
        canonical,
        issues: validationIssues,
        validationIssues,
        selfCheckIssues: [],
        participants: [],
        governanceBinding,
        pushbackPath: null,
        learningArtifact: null,
        openQuestions: [],
        statusReason: `Blocked: ${rosterFaults.length} governed roster validation error${rosterFaults.length === 1 ? "" : "s"}`,
        roundsExecuted: 0,
        arbitrationUsed: false,
      });
      await writeFile(join(runDir, "result.json"), JSON.stringify(result, null, 2), "utf-8");
      await writeZeroRoundRunPostmortem({
        request,
        runDir,
        status: result.status,
        statusReason: result.status_reason,
        validationIssues,
        selfCheckIssues: [],
        governanceBinding,
        pushbackPath: null,
        bindGovernance: governanceRuntime.bindGovernance,
      });
      await writeCyclePostmortem({
        request,
        runDir,
        status: result.status,
        statusReason: result.status_reason,
        roundsExecuted: 0,
        participants: [],
        validationIssues,
        selfCheckIssues: [],
        reviewIssueCount: 0,
        governanceBinding,
        bindGovernance: governanceRuntime.bindGovernance,
        startedAtMs: start,
      });
      return result;
    }
  } catch (error) {
    await writeFile(join(runDir, "self-check.json"), JSON.stringify([], null, 2), "utf-8");
    await governanceRuntime.writeGovernanceIncident(governanceIncidentPath, {
      governance_binding: null,
      stage: "pre_snapshot_roster_bootstrap",
      faults: [{
        code: "GOVERNANCE_BOOTSTRAP_FAILED",
        message: error instanceof Error ? error.message : String(error),
      }],
      status: "blocked",
      intended_snapshot_manifest_path: intendedSnapshotManifestPath,
    });
    const result = buildResult({
      request,
      status: "blocked",
      runDir,
      canonical,
      issues: validationIssues,
      validationIssues,
      selfCheckIssues: [],
      participants: [],
      governanceBinding,
      pushbackPath: null,
      learningArtifact: null,
      openQuestions: [],
      statusReason: "Blocked: governance roster bootstrap failed",
      roundsExecuted: 0,
      arbitrationUsed: false,
    });
    await writeFile(join(runDir, "result.json"), JSON.stringify(result, null, 2), "utf-8");
    await writeZeroRoundRunPostmortem({
      request,
      runDir,
      status: result.status,
      statusReason: result.status_reason,
      validationIssues,
      selfCheckIssues: [],
      governanceBinding,
      pushbackPath: null,
      bindGovernance: governanceRuntime.bindGovernance,
    });
    await writeCyclePostmortem({
      request,
      runDir,
      status: result.status,
      statusReason: result.status_reason,
      roundsExecuted: 0,
      participants: [],
      validationIssues,
      selfCheckIssues: [],
      reviewIssueCount: 0,
      governanceBinding,
      bindGovernance: governanceRuntime.bindGovernance,
      startedAtMs: start,
    });
    return result;
  }

  blockingIssues = validationIssues.filter((issue) => issue.severity === "error");
  if (blockingIssues.length > 0) {
    const pushbackPath = join(runDir, `${request.role_slug}-pushback.json`);
    await writeFile(join(runDir, "self-check.json"), JSON.stringify([], null, 2), "utf-8");
    await writePushbackArtifact({
      request,
      runDir,
      status: "blocked",
      statusReason: `Blocked: ${blockingIssues.length} validation errors`,
      validationIssues,
      selfCheckIssues: [],
      boardRounds: 0,
    });
    const result = buildResult({
      request,
      status: "blocked",
      runDir,
      canonical,
      issues: validationIssues,
      validationIssues,
      selfCheckIssues: [],
      participants: [],
      governanceBinding,
      pushbackPath,
      learningArtifact: null,
      openQuestions: [],
      statusReason: `Blocked: ${blockingIssues.length} validation errors`,
      roundsExecuted: 0,
      arbitrationUsed: false,
    });
    await writeFile(join(runDir, "result.json"), JSON.stringify(result, null, 2), "utf-8");
    await writeZeroRoundRunPostmortem({
      request,
      runDir,
      status: result.status,
      statusReason: result.status_reason,
      validationIssues,
      selfCheckIssues: [],
      governanceBinding,
      pushbackPath,
      bindGovernance: governanceRuntime.bindGovernance,
    });
    await writeCyclePostmortem({
      request,
      runDir,
      status: result.status,
      statusReason: result.status_reason,
      roundsExecuted: 0,
      participants: [],
      validationIssues,
      selfCheckIssues: [],
      reviewIssueCount: 0,
      governanceBinding,
      bindGovernance: governanceRuntime.bindGovernance,
      startedAtMs: start,
    });
    return result;
  }

  try {
    governanceContext = await governanceRuntime.createPilotGovernanceContext({
      component: "agent-role-builder",
      run_dir: runDir,
      authority: authorityPaths,
    });
    governanceBinding = governanceRuntime.buildGovernanceBinding(governanceContext);
    await recordRunTelemetry({
      currentPhase: "governance-ready",
      roundsAttempted: 0,
      roundsCompleted: 0,
      participants: [],
      governanceBinding,
    });
  } catch (error) {
    const manifestExists = await pathExists(join(runDir, "governance-snapshot.json"));
    governanceBinding = manifestExists
      ? await governanceRuntime.readGovernanceBindingFromManifest(join(runDir, "governance-snapshot.json")).catch(() => null)
      : null;
    await writeFile(join(runDir, "self-check.json"), JSON.stringify([], null, 2), "utf-8");
    await governanceRuntime.writeGovernanceIncident(governanceIncidentPath, {
      governance_binding: governanceBinding,
      stage: manifestExists ? "post_snapshot_governance_validation" : "snapshot_creation",
      faults: [{
        code: "GOVERNANCE_SNAPSHOT_FAILED",
        message: error instanceof Error ? error.message : String(error),
      }],
      status: "blocked",
      intended_snapshot_manifest_path: manifestExists ? undefined : intendedSnapshotManifestPath,
    });
    const result = buildResult({
      request,
      status: "blocked",
      runDir,
      canonical,
      issues: validationIssues,
      validationIssues,
      selfCheckIssues: [],
      participants: [],
      governanceBinding,
      pushbackPath: null,
      learningArtifact: null,
      openQuestions: [],
      statusReason: "Blocked: governance snapshot creation failed",
      roundsExecuted: 0,
      arbitrationUsed: false,
    });
    await writeFile(join(runDir, "result.json"), JSON.stringify(result, null, 2), "utf-8");
    await writeZeroRoundRunPostmortem({
      request,
      runDir,
      status: result.status,
      statusReason: result.status_reason,
      validationIssues,
      selfCheckIssues: [],
      governanceBinding,
      pushbackPath: null,
      bindGovernance: governanceRuntime.bindGovernance,
    });
    await writeCyclePostmortem({
      request,
      runDir,
      status: result.status,
      statusReason: result.status_reason,
      roundsExecuted: 0,
      participants: [],
      validationIssues,
      selfCheckIssues: [],
      reviewIssueCount: 0,
      governanceBinding,
      bindGovernance: governanceRuntime.bindGovernance,
      startedAtMs: start,
    });
    return result;
  }

  let loadedResumeState: Awaited<ReturnType<typeof loadResumeState>> | null = null;
  if (request.resume) {
    try {
      loadedResumeState = await loadResumeState(request.resume.resume_package_path);
      assertResumePackageMatchesRole(loadedResumeState.resumePackage, request.role_slug);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const resumeValidationIssue: ValidationIssue = {
        code: "INVALID_RESUME_PACKAGE",
        severity: "error",
        message: `Failed to load resume package: ${message}`,
        evidence: request.resume.resume_package_path,
      };
      validationIssues.push(resumeValidationIssue);
      const pushbackPath = join(runDir, `${request.role_slug}-pushback.json`);
      await writeFile(join(runDir, "self-check.json"), JSON.stringify([], null, 2), "utf-8");
      await writePushbackArtifact({
        request,
        runDir,
        status: "blocked",
        statusReason: resumeValidationIssue.message,
        validationIssues,
        selfCheckIssues: [],
        boardRounds: 0,
      });
      const result = buildResult({
        request,
        status: "blocked",
        runDir,
        canonical,
        issues: validationIssues,
        validationIssues,
        selfCheckIssues: [],
        participants: [],
        governanceBinding,
        pushbackPath,
        learningArtifact: null,
        openQuestions: [],
        statusReason: resumeValidationIssue.message,
        roundsExecuted: 0,
        arbitrationUsed: false,
      });
      await writeFile(join(runDir, "result.json"), JSON.stringify(result, null, 2), "utf-8");
      await writeZeroRoundRunPostmortem({
        request,
        runDir,
        status: result.status,
        statusReason: result.status_reason,
        validationIssues,
        selfCheckIssues: [],
        governanceBinding,
        pushbackPath,
        bindGovernance: governanceRuntime.bindGovernance,
      });
      await writeCyclePostmortem({
        request,
        runDir,
        status: result.status,
        statusReason: result.status_reason,
        roundsExecuted: 0,
        participants: [],
        validationIssues,
        selfCheckIssues: [],
        reviewIssueCount: 0,
        governanceBinding,
        bindGovernance: governanceRuntime.bindGovernance,
        startedAtMs: start,
      });
      return result;
    }
  }

  let rulebookPromotionArtifactPath: string | null = null;
  if (loadedResumeState) {
    const rulebookPromotion = await applyFutureRunRulebookPromotion({
      runDir,
      sourceRulebookPath: governanceContext!.component_rulebook_path,
      resumePackage: loadedResumeState.resumePackage,
    });
    governanceContext = {
      ...governanceContext!,
      component_rulebook_path: rulebookPromotion.effectiveRulebookPath,
    };
    rulebookPromotionArtifactPath = rulebookPromotion.promotionArtifactPath;
  }

  const initialSessionHandles = loadedResumeState?.resumePackage.session_handles ?? {};
  await writeSessionRegistry(
    sessionRegistryPath,
    buildInitialSessionRegistry({
      request,
      startedAtIso: startIso,
      initialHandles: initialSessionHandles,
    })
  );

  const draftMarkdown = loadedResumeState?.markdown ?? generateRoleMarkdown(request);
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

  const boardResult = await executeBoard(
    request,
    draftMarkdown,
    draftContract,
    initialSelfCheckIssues,
    validationIssues,
    runDir,
    governanceContext!,
    {
      startedAtMs: start,
      startedAtIso: startIso,
    },
    loadedResumeState?.resumePackage.reviewer_status ?? {},
    initialSessionHandles
  );

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

  let pushbackPath: string | null = null;
  if (boardResult.status === "pushback" || boardResult.status === "blocked") {
    pushbackPath = join(runDir, `${request.role_slug}-pushback.json`);
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
    await writeFile(pushbackPath, JSON.stringify(pushback, null, 2), "utf-8");
  }

  if (boardResult.status === "resume_required") {
    const latestLearningPathForResume = boardResult.rounds.length > 0
      ? join(runDir, "rounds", `round-${boardResult.rounds[boardResult.rounds.length - 1].round}`, "learning.json").replace(/\\/g, "/")
      : null;
    const nextResumePackage = buildNextResumePackage({
      roleSlug: request.role_slug,
      requestJobId: request.job_id,
      unresolved: boardResult.rounds[boardResult.rounds.length - 1]?.unresolved ?? [],
      latestMarkdownPath: runArtifacts.markdown,
      latestContractPath: runArtifacts.contract,
      latestBoardSummaryPath: runArtifacts.boardSummary,
      latestDecisionLogPath: runArtifacts.decisionLog,
      latestLearningPath: latestLearningPathForResume && await pathExists(latestLearningPathForResume)
        ? latestLearningPathForResume
        : null,
      roundFiles: boardResult.rounds.map((round) => join(runDir, "rounds", `round-${round.round}.json`)),
      reviewerStatus: boardResult.finalReviewerStatus,
      sessionHandles: boardResult.finalSessionHandles,
      roundsCompletedThisRun: boardResult.rounds.length,
      priorResumePackage: loadedResumeState?.resumePackage ?? null,
    });
    await writeFile(
      join(runDir, "resume-package.json"),
      JSON.stringify(nextResumePackage, null, 2),
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

  const latestLearningPath = boardResult.rounds.length > 0
    ? join(runDir, "rounds", `round-${boardResult.rounds[boardResult.rounds.length - 1].round}`, "learning.json").replace(/\\/g, "/")
    : null;
  const result = buildResult({
    request,
    status: boardResult.status,
    runDir,
    canonical,
    issues: [...validationIssues, ...boardResult.finalSelfCheckIssues],
    validationIssues,
    selfCheckIssues: boardResult.finalSelfCheckIssues,
    participants: boardResult.allParticipants,
    governanceBinding,
    pushbackPath,
    learningArtifact: latestLearningPath && await pathExists(latestLearningPath)
      ? {
          path: latestLearningPath,
          effect: "future_run_candidate",
        }
      : null,
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
    validationIssues,
    selfCheckIssues: boardResult.finalSelfCheckIssues,
    reviewIssueCount: countBoardReviewIssues(boardResult.rounds),
    governanceBinding,
    bindGovernance: governanceRuntime.bindGovernance,
    startedAtMs: start,
    unresolvedTrend: boardResult.rounds.map((round) => round.unresolved.length),
  });
  await recordRunTelemetry({
    currentPhase: "terminal",
    roundsAttempted: boardResult.rounds.length,
    roundsCompleted: boardResult.rounds.length,
    participants: boardResult.allParticipants,
    governanceBinding,
    latestLearningPath: latestLearningPath && await pathExists(latestLearningPath) ? latestLearningPath : null,
    runPostmortemPath: join(runDir, "run-postmortem.json").replace(/\\/g, "/"),
    cyclePostmortemPath: join(runDir, "cycle-postmortem.json").replace(/\\/g, "/"),
    resultPath: join(runDir, "result.json").replace(/\\/g, "/"),
    terminalStatus: result.status,
    stopReason: result.status_reason,
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

async function writePushbackArtifact(params: {
  request: RoleBuilderRequest;
  runDir: string;
  status: "pushback" | "blocked";
  statusReason: string;
  validationIssues: ValidationIssue[];
  selfCheckIssues: ValidationIssue[];
  boardRounds: number;
}): Promise<void> {
  const pushback = {
    schema_version: "1.0",
    status: params.status,
    role_slug: params.request.role_slug,
    issue: "The requested role package is not safe to freeze as submitted.",
    why_it_blocks: params.statusReason,
    evidence: {
      validation_issues: params.validationIssues,
      self_check_issues: params.selfCheckIssues,
      board_rounds: params.boardRounds,
      decision_log_path: params.boardRounds > 0 ? join(params.runDir, `${params.request.role_slug}-decision-log.md`) : null,
      board_summary_path: params.boardRounds > 0 ? join(params.runDir, `${params.request.role_slug}-board-summary.md`) : null,
    },
  };
  await writeFile(join(params.runDir, `${params.request.role_slug}-pushback.json`), JSON.stringify(pushback, null, 2), "utf-8");
}

async function writeZeroRoundRunPostmortem(params: {
  request: RoleBuilderRequest;
  runDir: string;
  status: RoleBuilderStatus;
  statusReason: string;
  validationIssues: ValidationIssue[];
  selfCheckIssues: ValidationIssue[];
  governanceBinding: GovernanceBindingValue | null;
  pushbackPath: string | null;
  bindGovernance: <T extends Record<string, unknown>>(payload: T, context: { snapshot_id: string; snapshot_manifest_path: string }) => T & { governance_binding: GovernanceBindingValue };
}): Promise<void> {
  const postmortemPath = join(params.runDir, "run-postmortem.json");
  const selfCheckPath = join(params.runDir, "self-check.json");
  await writeFile(selfCheckPath, JSON.stringify(params.selfCheckIssues, null, 2), "utf-8");
  const artifactRefs = {
    result_json: join(params.runDir, "result.json"),
    run_postmortem: postmortemPath,
    pushback_json: params.pushbackPath,
    normalized_request: join(params.runDir, "normalized-request.json"),
    session_registry: join(params.runDir, "runtime", "session-registry.json"),
    self_check: selfCheckPath,
  };

  const postmortem = attachGovernanceBinding({
    schema_version: "1.0",
    component: "agent-role-builder",
    request_job_id: params.request.job_id,
    questions_ref: "shared/learning-engine/postmortem-questions.json",
    updated_at: new Date().toISOString(),
    terminal_status: params.status,
    rounds_completed: 0,
    round_snapshots: [],
    kpi_summary: {
      unresolved_trend: [],
      convergence_delta: 0,
      total_fallbacks: 0,
      total_participant_invocations: 0,
      skipped_reviewer_invocations: 0,
    },
    question_outputs: {
      "PM-002": {
        rounds: 0,
        participant_invocations: 0,
        total_latency_ms: 0,
        reviewer_reuse_savings: 0,
      },
      "PM-003": {
        validation_issue_count: params.validationIssues.length,
        self_check_issue_count: params.selfCheckIssues.length,
        total_issue_count: params.validationIssues.length + params.selfCheckIssues.length,
        review_issue_count: 0,
      },
      "PM-007": {
        unresolved_trend: [],
        latest_unresolved_count: 0,
        convergence_observed: true,
      },
    },
    audit: buildAuditEnvelope({
      requestJobId: params.request.job_id,
      round: 0,
      reviewMode: null,
      participants: [],
      artifactRefs,
    }),
  }, params.governanceBinding, params.bindGovernance);

  await writeFile(postmortemPath, JSON.stringify(postmortem, null, 2), "utf-8");
}

async function writeCyclePostmortem(params: {
  request: RoleBuilderRequest;
  runDir: string;
  status: RoleBuilderStatus;
  statusReason: string;
  roundsExecuted: number;
  participants: ParticipantRecord[];
  validationIssues: ValidationIssue[];
  selfCheckIssues: ValidationIssue[];
  reviewIssueCount: number;
  governanceBinding: GovernanceBindingValue | null;
  bindGovernance: <T extends Record<string, unknown>>(payload: T, context: { snapshot_id: string; snapshot_manifest_path: string }) => T & { governance_binding: GovernanceBindingValue };
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
  const selfCheckPath = join(params.runDir, "self-check.json");

  const finalizedPostmortem = attachGovernanceBinding({
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
      cycle_postmortem: true,
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
        self_check: selfCheckPath,
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
        validation_issue_count: params.validationIssues.length,
        self_check_issue_count: params.selfCheckIssues.length,
        review_issue_count: params.reviewIssueCount,
        total_issue_count: params.validationIssues.length + params.selfCheckIssues.length + params.reviewIssueCount,
      },
      "PM-007": {
        unresolved_trend: params.unresolvedTrend ?? [],
        converged: (params.unresolvedTrend?.length ?? 0) <= 1
          ? true
          : (params.unresolvedTrend?.[params.unresolvedTrend.length - 1] ?? 0) <= (params.unresolvedTrend?.[0] ?? 0),
      },
    },
  }, params.governanceBinding, params.bindGovernance);

  await writeFile(cyclePostmortemPath, JSON.stringify(finalizedPostmortem, null, 2), "utf-8");
  const latestLearningPath = params.roundsExecuted > 0
    ? join(params.runDir, "rounds", `round-${params.roundsExecuted - 1}`, "learning.json").replace(/\\/g, "/")
    : null;
  await writeRunTelemetry({
    request: params.request,
    runDir: params.runDir,
    startedAtMs: params.startedAtMs,
    startedAtIso: new Date(params.startedAtMs).toISOString(),
    currentPhase: "terminal",
    roundsAttempted: params.roundsExecuted,
    roundsCompleted: params.roundsExecuted,
    participants: params.participants,
    governanceBinding: params.governanceBinding,
    latestLearningPath: latestLearningPath && await pathExists(latestLearningPath) ? latestLearningPath : null,
    runPostmortemPath: join(params.runDir, "run-postmortem.json").replace(/\\/g, "/"),
    cyclePostmortemPath: cyclePostmortemPath.replace(/\\/g, "/"),
    resultPath: join(params.runDir, "result.json").replace(/\\/g, "/"),
    terminalStatus: params.status,
    stopReason: params.statusReason,
  });
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
  governanceBinding: GovernanceBindingValue | null;
  pushbackPath: string | null;
  learningArtifact: LearningArtifactRef | null;
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
    governanceBinding,
    pushbackPath,
    learningArtifact,
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
    pushback_path: pushbackPath,
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
    governance_binding: governanceBinding,
    learning_artifact: learningArtifact,
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

function sumOptionalNumber(values: Array<number | undefined>): number | null {
  const present = values.filter((value): value is number => typeof value === "number");
  if (present.length === 0) return null;
  return present.reduce((sum, value) => sum + value, 0);
}

function attachGovernanceBinding<T extends Record<string, unknown>>(
  payload: T,
  governanceBinding: GovernanceBindingValue | null,
  bindGovernance: <U extends Record<string, unknown>>(candidate: U, context: { snapshot_id: string; snapshot_manifest_path: string }) => U & { governance_binding: GovernanceBindingValue }
): T & { governance_binding: GovernanceBindingValue | null } {
  if (!governanceBinding) {
    return {
      ...payload,
      governance_binding: null,
    };
  }

  return bindGovernance(payload, governanceBinding);
}

function countBoardReviewIssues(rounds: Array<{ reviewerVerdicts: Map<string, { conceptual_groups: Array<{ severity: string; id?: string }> }> }>): number {
  return rounds.reduce((sum, round) => {
    const roundIssueCount = [...round.reviewerVerdicts.values()].reduce(
      (innerSum, verdict) => innerSum + verdict.conceptual_groups.filter((group) =>
        group.id !== "parse-error"
        && (
          group.severity === "blocking"
          || group.severity === "major"
          || group.severity === "minor"
          || group.severity === "suggestion"
        )
      ).length,
      0
    );
    return sum + roundIssueCount;
  }, 0);
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
