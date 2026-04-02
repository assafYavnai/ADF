// Run from project root: tools/self-repair-engine/node_modules/.bin/tsx.cmd tools/implementation-engine/src/index.ts <request.json> [output-dir]
import { createHash } from "node:crypto";
import { access, cp, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { parseJsonTextWithBomSupport } from "./json-ingress.js";
import {
  loadSharedGovernanceRuntimeModule,
  loadSharedReviewEngineModule,
  loadSharedRulesComplianceEnforcerModule,
  loadSharedSelfLearningEngineModule,
} from "./shared-module-loader.js";

type Operation = "create" | "update" | "fix";
type TerminalStatus = "frozen" | "frozen_with_conditions" | "resume_required" | "pushback" | "blocked";

interface SourceRef {
  path: string;
  purpose: string;
  required: boolean;
  content_type?: string;
  notes?: string;
}

interface GovernedSurfaceRef {
  path: string;
  kind?: string;
  must_exist?: boolean;
}

interface TargetOutputDeclaration {
  path: string;
  artifact_class: string;
  promotion_strategy: string;
}

interface TargetGovernance {
  artifact_kind: string;
  writable_surface: string[];
  writable_surface_base_version: string;
  target_contract: GovernedSurfaceRef;
  target_rulebook: GovernedSurfaceRef;
  target_review_prompt: GovernedSurfaceRef;
  authority_documents: SourceRef[];
  runtime_review_configuration: Record<string, unknown>;
  output_declarations: {
    run_root: string;
    candidate_root: string;
    staged_final_root: string;
    target_outputs: TargetOutputDeclaration[];
    preserved_history_outputs?: Array<Record<string, unknown>>;
  };
  stop_conditions: {
    budget_exhaustion_outcome: string;
    missing_authority_outcome: "pushback" | "blocked";
    failed_parity_outcome: string;
    blocked_execution_outcome: string;
  };
  conditional_acceptance_authority: {
    owner_type: string;
    owner_ref: string;
    delegated_to_run: boolean;
  };
}

interface ImplementationRequest {
  job_id: string;
  operation: Operation;
  source_refs: SourceRef[];
  target_governance: TargetGovernance;
}

interface SharedStackStatus {
  governance_runtime: "loaded";
  review_engine: "loaded";
  self_learning_engine: "loaded";
  rules_compliance_enforcer: "loaded";
}

interface GovernanceBindingValue {
  snapshot_id: string;
  snapshot_manifest_path: string;
}

interface RunPaths {
  runDir: string;
  candidateRoot: string;
  stagedFinalRoot: string;
}

interface ManifestEntry {
  path: string;
  purpose: string;
  required: boolean;
  exists: boolean;
  sha256: string | null;
}

interface PreReviewIssue {
  code: string;
  severity: "error" | "warning";
  message: string;
  evidence?: string;
}

interface ImplementationResult {
  schema_version: "1.0";
  tool_name: "implementation-engine";
  request_job_id: string;
  status: TerminalStatus;
  status_reason: string;
  output_dir: string;
  governance_binding: GovernanceBindingValue | null;
  candidate_root: string | null;
  staged_final_root: string | null;
  promoted_outputs: string[];
  shared_stack: SharedStackStatus | null;
  artifacts: Record<string, string | null>;
  issues: PreReviewIssue[];
}

const TOOL_NAME = "implementation-engine" as const;
const TOOL_ROOT = join("tools", "implementation-engine");
const FIXED_SURFACES = {
  toolContract: join(TOOL_ROOT, "tool-contract.json"),
  reviewContract: join(TOOL_ROOT, "review-contract.json"),
  reviewPrompt: join(TOOL_ROOT, "review-prompt.json"),
  rulebook: join(TOOL_ROOT, "rulebook.json"),
  roleMarkdown: join(TOOL_ROOT, "role", "implementation-engine-role.md"),
  roleContract: join(TOOL_ROOT, "role", "implementation-engine-role-contract.json"),
  invocationSchema: join(TOOL_ROOT, "schemas", "invocation-request.schema.json"),
  governanceRoutingSchema: join(TOOL_ROOT, "schemas", "governance-routing-record.schema.json"),
  sharedReviewContract: join("shared", "self-learning-engine", "review-contract.json"),
};

export async function runImplementation(requestPath: string, outputDir?: string): Promise<ImplementationResult> {
  const request = await loadImplementationRequest(requestPath);
  const runPaths = resolveRunPaths(request, outputDir);
  const artifacts = {
    normalized_request: normalizePath(join(runPaths.runDir, "normalized-request.json")),
    target_governance_manifest: normalizePath(join(runPaths.runDir, "target-governance-manifest.json")),
    source_manifest: normalizePath(join(runPaths.runDir, "source-manifest.json")),
    write_domain: normalizePath(join(runPaths.runDir, "write-domain.json")),
    candidate_manifest: normalizePath(join(runPaths.runDir, "candidate-manifest.json")),
    result_json: normalizePath(join(runPaths.runDir, "result.json")),
    pre_review_pushback: normalizePath(join(runPaths.runDir, "pre-review-pushback.json")),
    parity_audit: normalizePath(join(runPaths.runDir, "parity-audit.json")),
    bug_report: normalizePath(join(runPaths.runDir, "bug-report.json")),
    cycle_postmortem: normalizePath(join(runPaths.runDir, "cycle-postmortem.json")),
  };

  await prepareRunDirectory(runPaths.runDir);
  await writeJson(artifacts.normalized_request, request);

  try {
    const reviewContract = await loadFixedGovernance();
    const sharedStack = await loadSharedStack();
    const governanceBinding = await createEngineGovernanceSnapshot(runPaths.runDir, reviewContract);
    const sourceManifest = await materializeManifest(request.source_refs);
    const authorityManifest = await materializeManifest(request.target_governance.authority_documents);
    const surfaceChecks = await validateTargetGovernanceSurfaces(request.target_governance);
    const issues = [
      ...missingManifestIssues("source_refs", sourceManifest),
      ...missingManifestIssues("target_governance.authority_documents", authorityManifest),
      ...missingSurfaceIssues(surfaceChecks),
      ...authorityConflictIssues(request.source_refs, request.target_governance.authority_documents),
      ...writableSurfaceIssues(request.target_governance),
      ...(await baselineIssues(request)),
    ];

    await writeJson(artifacts.source_manifest, {
      schema_version: "1.0",
      manifest_kind: "source_refs",
      generated_at_utc: new Date().toISOString(),
      entries: sourceManifest,
    });
    await writeJson(artifacts.target_governance_manifest, {
      schema_version: "1.0",
      artifact_kind: request.target_governance.artifact_kind,
      writable_surface: request.target_governance.writable_surface.map((entry) => normalizePath(toRepoRelativePath(entry))),
      writable_surface_base_version: request.target_governance.writable_surface_base_version,
      runtime_review_configuration: request.target_governance.runtime_review_configuration,
      output_declarations: normalizeOutputDeclarations(request.target_governance.output_declarations),
      stop_conditions: request.target_governance.stop_conditions,
      conditional_acceptance_authority: request.target_governance.conditional_acceptance_authority,
      target_surfaces: surfaceChecks,
      authority_documents_manifest_kind: "target_governance.authority_documents",
      generated_at_utc: new Date().toISOString(),
    });

    if (issues.length > 0) {
      return finalizePreReviewOutcome(request, runPaths, governanceBinding, sharedStack, artifacts, issues);
    }

    await writeJson(artifacts.write_domain, {
      schema_version: "1.0",
      job_id: request.job_id,
      operation: request.operation,
      writable_surface: request.target_governance.writable_surface.map((entry) => normalizePath(toRepoRelativePath(entry))),
      writable_surface_base_version: request.target_governance.writable_surface_base_version,
      target_output_paths: request.target_governance.output_declarations.target_outputs.map((entry) => normalizePath(toRepoRelativePath(entry.path))),
      frozen_at_utc: new Date().toISOString(),
    });
    await writeJson(artifacts.candidate_manifest, await stageCandidateWorkspace(request, runPaths));

    const statusReason = "Bootstrap runtime core is implemented through governed staging. Live implementation, compliance, review, learning, revision, and parity-audit execution are not wired yet, so the run fails closed after Step 2.";
    await writeJson(artifacts.bug_report, {
      schema_version: "1.0",
      tool_name: TOOL_NAME,
      request_job_id: request.job_id,
      stage: "step_3_not_wired",
      issue: "Live shared-engine execution hooks are not wired yet.",
      why_it_blocks: statusReason,
      evidence: {
        completed_steps: [1, 2],
        missing_runtime_phases: ["implement_or_revise", "self_check", "rules_compliance", "review", "learning", "parity_audit", "terminal_promotion"],
        candidate_manifest_path: artifacts.candidate_manifest,
        source_manifest_path: artifacts.source_manifest,
        target_governance_manifest_path: artifacts.target_governance_manifest,
        write_domain_path: artifacts.write_domain,
      },
      generated_at_utc: new Date().toISOString(),
      governance_binding: governanceBinding,
    });
    await writeJson(artifacts.cycle_postmortem, cyclePostmortem(request, "blocked", statusReason, governanceBinding, sharedStack, [1, 2], []));

    const result: ImplementationResult = {
      schema_version: "1.0",
      tool_name: TOOL_NAME,
      request_job_id: request.job_id,
      status: "blocked",
      status_reason: statusReason,
      output_dir: normalizePath(runPaths.runDir),
      governance_binding: governanceBinding,
      candidate_root: normalizePath(runPaths.candidateRoot),
      staged_final_root: null,
      promoted_outputs: [],
      shared_stack: sharedStack,
      artifacts: {
        normalized_request: artifacts.normalized_request,
        target_governance_manifest: artifacts.target_governance_manifest,
        source_manifest: artifacts.source_manifest,
        write_domain: artifacts.write_domain,
        candidate_manifest: artifacts.candidate_manifest,
        pre_review_pushback: null,
        parity_audit: null,
        bug_report: artifacts.bug_report,
        cycle_postmortem: artifacts.cycle_postmortem,
      },
      issues: [],
    };
    await writeJson(artifacts.result_json, result);
    return result;
  } catch (error) {
    const statusReason = error instanceof Error ? error.message : String(error);
    await writeJson(artifacts.bug_report, {
      schema_version: "1.0",
      tool_name: TOOL_NAME,
      request_job_id: request.job_id,
      stage: "runtime_exception",
      issue: "Implementation-engine bootstrap runtime failed before terminal orchestration could continue.",
      why_it_blocks: statusReason,
      error_name: error instanceof Error ? error.name : typeof error,
      stack: error instanceof Error ? error.stack ?? null : null,
      generated_at_utc: new Date().toISOString(),
    });
    await writeJson(artifacts.cycle_postmortem, cyclePostmortem(request, "blocked", statusReason, null, null, [], [{ code: "IMPLEMENTATION_RUNTIME_EXCEPTION", severity: "error", message: statusReason }]));
    const result: ImplementationResult = {
      schema_version: "1.0",
      tool_name: TOOL_NAME,
      request_job_id: request.job_id,
      status: "blocked",
      status_reason: statusReason,
      output_dir: normalizePath(runPaths.runDir),
      governance_binding: null,
      candidate_root: null,
      staged_final_root: null,
      promoted_outputs: [],
      shared_stack: null,
      artifacts: {
        normalized_request: artifacts.normalized_request,
        target_governance_manifest: null,
        source_manifest: null,
        write_domain: null,
        candidate_manifest: null,
        pre_review_pushback: null,
        parity_audit: null,
        bug_report: artifacts.bug_report,
        cycle_postmortem: artifacts.cycle_postmortem,
      },
      issues: [{ code: "IMPLEMENTATION_RUNTIME_EXCEPTION", severity: "error", message: statusReason }],
    };
    await writeJson(artifacts.result_json, result);
    return result;
  }
}

async function loadImplementationRequest(requestPath: string): Promise<ImplementationRequest> {
  const raw = await readFile(requestPath, "utf-8");
  const parsed = parseJsonTextWithBomSupport<Record<string, unknown>>(raw, `implementation-engine request at ${requestPath}`).value;
  const targetGovernance = parsed.target_governance as Record<string, unknown>;
  const outputDeclarations = targetGovernance.output_declarations as Record<string, unknown>;
  const stopConditions = targetGovernance.stop_conditions as Record<string, unknown>;
  const conditionalAuthority = targetGovernance.conditional_acceptance_authority as Record<string, unknown>;

  return {
    job_id: requiredString(parsed.job_id, "job_id"),
    operation: requiredEnum(parsed.operation, "operation", ["create", "update", "fix"]) as Operation,
    source_refs: requiredArray(parsed.source_refs, "source_refs").map(parseSourceRef),
    target_governance: {
      artifact_kind: requiredString(targetGovernance.artifact_kind, "target_governance.artifact_kind"),
      writable_surface: requiredArray(targetGovernance.writable_surface, "target_governance.writable_surface").map((entry) => requiredString(entry, "writable_surface[]")),
      writable_surface_base_version: requiredString(targetGovernance.writable_surface_base_version, "target_governance.writable_surface_base_version"),
      target_contract: parseSurfaceRef(targetGovernance.target_contract, "target_governance.target_contract"),
      target_rulebook: parseSurfaceRef(targetGovernance.target_rulebook, "target_governance.target_rulebook"),
      target_review_prompt: parseSurfaceRef(targetGovernance.target_review_prompt, "target_governance.target_review_prompt"),
      authority_documents: requiredArray(targetGovernance.authority_documents, "target_governance.authority_documents").map(parseSourceRef),
      runtime_review_configuration: requiredObject(targetGovernance.runtime_review_configuration, "target_governance.runtime_review_configuration"),
      output_declarations: {
        run_root: requiredString(outputDeclarations.run_root, "target_governance.output_declarations.run_root"),
        candidate_root: requiredString(outputDeclarations.candidate_root, "target_governance.output_declarations.candidate_root"),
        staged_final_root: requiredString(outputDeclarations.staged_final_root, "target_governance.output_declarations.staged_final_root"),
        target_outputs: requiredArray(outputDeclarations.target_outputs, "target_governance.output_declarations.target_outputs").map(parseTargetOutput),
        preserved_history_outputs: Array.isArray(outputDeclarations.preserved_history_outputs)
          ? outputDeclarations.preserved_history_outputs.map((entry) => requiredObject(entry, "target_governance.output_declarations.preserved_history_outputs[]"))
          : undefined,
      },
      stop_conditions: {
        budget_exhaustion_outcome: requiredString(stopConditions.budget_exhaustion_outcome, "target_governance.stop_conditions.budget_exhaustion_outcome"),
        missing_authority_outcome: requiredEnum(stopConditions.missing_authority_outcome, "target_governance.stop_conditions.missing_authority_outcome", ["pushback", "blocked"]) as "pushback" | "blocked",
        failed_parity_outcome: requiredString(stopConditions.failed_parity_outcome, "target_governance.stop_conditions.failed_parity_outcome"),
        blocked_execution_outcome: requiredString(stopConditions.blocked_execution_outcome, "target_governance.stop_conditions.blocked_execution_outcome"),
      },
      conditional_acceptance_authority: {
        owner_type: requiredString(conditionalAuthority.owner_type, "target_governance.conditional_acceptance_authority.owner_type"),
        owner_ref: requiredString(conditionalAuthority.owner_ref, "target_governance.conditional_acceptance_authority.owner_ref"),
        delegated_to_run: requiredBoolean(conditionalAuthority.delegated_to_run, "target_governance.conditional_acceptance_authority.delegated_to_run"),
      },
    },
  };
}

async function loadFixedGovernance(): Promise<Record<string, unknown>> {
  const reviewContract = await readJsonRequired<Record<string, unknown>>(FIXED_SURFACES.reviewContract, "implementation-engine review contract");
  await Promise.all([
    access(FIXED_SURFACES.toolContract),
    access(FIXED_SURFACES.reviewPrompt),
    access(FIXED_SURFACES.rulebook),
    access(FIXED_SURFACES.roleMarkdown),
    access(FIXED_SURFACES.roleContract),
    access(FIXED_SURFACES.invocationSchema),
    access(FIXED_SURFACES.governanceRoutingSchema),
    access(FIXED_SURFACES.sharedReviewContract),
  ]);
  return reviewContract;
}

async function loadSharedStack(): Promise<SharedStackStatus> {
  await Promise.all([
    loadSharedGovernanceRuntimeModule(),
    loadSharedReviewEngineModule(),
    loadSharedSelfLearningEngineModule(),
    loadSharedRulesComplianceEnforcerModule(),
  ]);
  return {
    governance_runtime: "loaded",
    review_engine: "loaded",
    self_learning_engine: "loaded",
    rules_compliance_enforcer: "loaded",
  };
}

async function createEngineGovernanceSnapshot(runDir: string, reviewContract: Record<string, unknown>): Promise<GovernanceBindingValue> {
  const governanceRuntime = await loadSharedGovernanceRuntimeModule();
  const authorityDocs = requiredArray(reviewContract.source_authority_paths, "review_contract.source_authority_paths").map((entry) => requiredString(entry, "source_authority_paths[]"));
  const context = await governanceRuntime.createPilotGovernanceContext({
    component: TOOL_NAME,
    run_dir: normalizePath(runDir),
    authority: {
      shared_contract: FIXED_SURFACES.sharedReviewContract,
      component_contract: FIXED_SURFACES.reviewContract,
      component_rulebook: FIXED_SURFACES.rulebook,
      component_review_prompt: FIXED_SURFACES.reviewPrompt,
      authority_docs: authorityDocs,
    },
  });
  return governanceRuntime.buildGovernanceBinding(context) as GovernanceBindingValue;
}

async function materializeManifest(refs: SourceRef[]): Promise<ManifestEntry[]> {
  const entries: ManifestEntry[] = [];
  for (const ref of refs) {
    const resolved = resolveRepoPath(ref.path);
    try {
      const raw = await readFile(resolved, "utf-8");
      entries.push({ path: normalizePath(toRepoRelativePath(ref.path)), purpose: ref.purpose, required: ref.required, exists: true, sha256: sha256(raw) });
    } catch (error) {
      const code = error instanceof Error && "code" in error ? (error as NodeJS.ErrnoException).code : undefined;
      if (code !== "ENOENT") throw error;
      entries.push({ path: normalizePath(toRepoRelativePath(ref.path)), purpose: ref.purpose, required: ref.required, exists: false, sha256: null });
    }
  }
  return entries;
}

async function validateTargetGovernanceSurfaces(targetGovernance: TargetGovernance) {
  const refs = [
    { label: "target_contract", ref: targetGovernance.target_contract },
    { label: "target_rulebook", ref: targetGovernance.target_rulebook },
    { label: "target_review_prompt", ref: targetGovernance.target_review_prompt },
  ];
  const checks = [] as Array<{ label: string; path: string; kind: string; must_exist: boolean; exists: boolean }>;
  for (const entry of refs) {
    let exists = false;
    try { await access(resolveRepoPath(entry.ref.path)); exists = true; } catch (error) {
      const code = error instanceof Error && "code" in error ? (error as NodeJS.ErrnoException).code : undefined;
      if (code !== "ENOENT") throw error;
    }
    checks.push({ label: entry.label, path: normalizePath(toRepoRelativePath(entry.ref.path)), kind: entry.ref.kind ?? "artifact", must_exist: entry.ref.must_exist ?? true, exists });
  }
  return checks;
}

async function baselineIssues(request: ImplementationRequest): Promise<PreReviewIssue[]> {
  if (request.operation === "create") return [];
  let existingCount = 0;
  for (const output of request.target_governance.output_declarations.target_outputs) {
    try { await access(resolveRepoPath(output.path)); existingCount += 1; } catch (error) {
      const code = error instanceof Error && "code" in error ? (error as NodeJS.ErrnoException).code : undefined;
      if (code !== "ENOENT") throw error;
    }
  }
  return existingCount > 0 ? [] : [{
    code: "MISSING_BASELINE_TARGET_OUTPUTS",
    severity: "error",
    message: `Operation ${request.operation} requires at least one existing target output to stage, but none of the declared target outputs exist yet.`,
    evidence: request.target_governance.output_declarations.target_outputs.map((entry) => normalizePath(toRepoRelativePath(entry.path))).join(", "),
  }];
}

function missingManifestIssues(label: string, entries: ManifestEntry[]): PreReviewIssue[] {
  return entries.filter((entry) => entry.required && !entry.exists).map((entry) => ({ code: "MISSING_REQUIRED_REF", severity: "error", message: `${label} requires ${entry.path}, but the file does not exist.`, evidence: entry.path }));
}

function missingSurfaceIssues(checks: Array<{ label: string; path: string; must_exist: boolean; exists: boolean }>): PreReviewIssue[] {
  return checks.filter((entry) => entry.must_exist && !entry.exists).map((entry) => ({ code: "MISSING_TARGET_GOVERNANCE_SURFACE", severity: "error", message: `${entry.label} is required but missing: ${entry.path}`, evidence: entry.path }));
}

function authorityConflictIssues(sourceRefs: SourceRef[], authorityDocuments: SourceRef[]): PreReviewIssue[] {
  const authorityByPath = new Map(authorityDocuments.map((entry) => [normalizePath(toRepoRelativePath(entry.path)), entry]));
  return sourceRefs.flatMap((entry) => {
    const authority = authorityByPath.get(normalizePath(toRepoRelativePath(entry.path)));
    if (!authority || authority.purpose === entry.purpose) return [];
    return [{ code: "SOURCE_AUTHORITY_CONFLICT", severity: "error", message: `Invocation source ref ${normalizePath(toRepoRelativePath(entry.path))} conflicts with target-governance authority_documents for the same path.`, evidence: `source_refs purpose=${entry.purpose}; authority_documents purpose=${authority.purpose}` }];
  });
}

function writableSurfaceIssues(targetGovernance: TargetGovernance): PreReviewIssue[] {
  const writable = targetGovernance.writable_surface.map((entry) => normalizePath(toRepoRelativePath(entry)));
  return targetGovernance.output_declarations.target_outputs.flatMap((entry) => {
    const outputPath = normalizePath(toRepoRelativePath(entry.path));
    const inside = writable.some((surface) => outputPath === surface || outputPath.startsWith(`${surface}/`));
    if (inside) return [];
    return [{ code: "TARGET_OUTPUT_OUTSIDE_WRITABLE_SURFACE", severity: "error", message: `Declared target output ${outputPath} is outside the bounded writable surface.`, evidence: writable.join(", ") }];
  });
}

async function stageCandidateWorkspace(request: ImplementationRequest, runPaths: RunPaths) {
  await mkdir(runPaths.candidateRoot, { recursive: true });
  const entries = [] as Array<{ target_output_path: string; candidate_path: string; exists_in_source: boolean; copied: boolean }>;
  for (const output of request.target_governance.output_declarations.target_outputs) {
    const sourcePath = resolveRepoPath(output.path);
    const candidatePath = join(runPaths.candidateRoot, ...safeSegments(toRepoRelativePath(output.path)));
    try {
      const sourceStat = await stat(sourcePath);
      await mkdir(dirname(candidatePath), { recursive: true });
      await cp(sourcePath, candidatePath, { recursive: sourceStat.isDirectory(), force: true });
      entries.push({ target_output_path: normalizePath(toRepoRelativePath(output.path)), candidate_path: normalizePath(candidatePath), exists_in_source: true, copied: true });
    } catch (error) {
      const code = error instanceof Error && "code" in error ? (error as NodeJS.ErrnoException).code : undefined;
      if (code !== "ENOENT") throw error;
      entries.push({ target_output_path: normalizePath(toRepoRelativePath(output.path)), candidate_path: normalizePath(candidatePath), exists_in_source: false, copied: false });
    }
  }
  return {
    schema_version: "1.0",
    job_id: request.job_id,
    operation: request.operation,
    generated_at_utc: new Date().toISOString(),
    candidate_root: normalizePath(runPaths.candidateRoot),
    entries,
  };
}

async function finalizePreReviewOutcome(
  request: ImplementationRequest,
  runPaths: RunPaths,
  governanceBinding: GovernanceBindingValue | null,
  sharedStack: SharedStackStatus | null,
  artifacts: Record<string, string>,
  issues: PreReviewIssue[]
): Promise<ImplementationResult> {
  const status: TerminalStatus = request.target_governance.stop_conditions.missing_authority_outcome === "pushback" ? "pushback" : "blocked";
  const statusReason = `Pre-review target-governance or authority validation failed with ${issues.length} issue${issues.length === 1 ? "" : "s"}.`;
  if (status === "pushback") {
    await writeJson(artifacts.pre_review_pushback, {
      schema_version: "1.0",
      tool_name: TOOL_NAME,
      request_job_id: request.job_id,
      issue: "Recoverable pre-review authority or target-governance ambiguity blocked entry into review.",
      why_it_blocks: statusReason,
      issues,
      generated_at_utc: new Date().toISOString(),
      governance_binding: governanceBinding,
    });
    await writeJson(artifacts.parity_audit, {
      schema_version: "1.0",
      status: "not_applicable_pre_review_pushback",
      reason: statusReason,
      generated_at_utc: new Date().toISOString(),
    });
  } else {
    await writeJson(artifacts.bug_report, {
      schema_version: "1.0",
      tool_name: TOOL_NAME,
      request_job_id: request.job_id,
      stage: "pre_review_validation",
      issue: "Pre-review validation failed and the governed stop condition requires blocked closeout.",
      why_it_blocks: statusReason,
      issues,
      generated_at_utc: new Date().toISOString(),
      governance_binding: governanceBinding,
    });
  }
  await writeJson(artifacts.cycle_postmortem, cyclePostmortem(request, status, statusReason, governanceBinding, sharedStack, [1], issues));
  const result: ImplementationResult = {
    schema_version: "1.0",
    tool_name: TOOL_NAME,
    request_job_id: request.job_id,
    status,
    status_reason: statusReason,
    output_dir: normalizePath(runPaths.runDir),
    governance_binding: governanceBinding,
    candidate_root: null,
    staged_final_root: null,
    promoted_outputs: [],
    shared_stack: sharedStack,
    artifacts: {
      normalized_request: artifacts.normalized_request,
      target_governance_manifest: artifacts.target_governance_manifest,
      source_manifest: artifacts.source_manifest,
      write_domain: null,
      candidate_manifest: null,
      pre_review_pushback: status === "pushback" ? artifacts.pre_review_pushback : null,
      parity_audit: status === "pushback" ? artifacts.parity_audit : null,
      bug_report: status === "blocked" ? artifacts.bug_report : null,
      cycle_postmortem: artifacts.cycle_postmortem,
    },
    issues,
  };
  await writeJson(artifacts.result_json, result);
  return result;
}

function cyclePostmortem(
  request: ImplementationRequest,
  status: TerminalStatus,
  statusReason: string,
  governanceBinding: GovernanceBindingValue | null,
  sharedStack: SharedStackStatus | null,
  completedSteps: number[],
  issues: PreReviewIssue[]
) {
  return {
    schema_version: "1.0",
    tool_name: TOOL_NAME,
    request_job_id: request.job_id,
    final_status: status,
    final_status_reason: statusReason,
    completed_steps: completedSteps,
    live_execution_wired: false,
    shared_stack: sharedStack,
    issue_count: issues.length,
    issues,
    generated_at_utc: new Date().toISOString(),
    governance_binding: governanceBinding,
  };
}

function resolveRunPaths(request: ImplementationRequest, outputDir?: string): RunPaths {
  const declaredRunDir = resolveRepoPath(request.target_governance.output_declarations.run_root);
  if (outputDir && normalizePath(resolve(outputDir)) !== normalizePath(declaredRunDir)) {
    throw new Error(`outputDir must match target_governance.output_declarations.run_root. Got ${normalizePath(resolve(outputDir))} vs ${normalizePath(declaredRunDir)}.`);
  }
  const expectedRunDir = normalizePath(join(TOOL_ROOT, "runs", request.job_id));
  if (normalizePath(toRepoRelativePath(declaredRunDir)) !== expectedRunDir) {
    throw new Error(`target_governance.output_declarations.run_root must be ${expectedRunDir}.`);
  }
  const candidateRoot = resolveRepoPath(request.target_governance.output_declarations.candidate_root);
  const stagedFinalRoot = resolveRepoPath(request.target_governance.output_declarations.staged_final_root);
  assertInside(candidateRoot, declaredRunDir, "candidate_root");
  assertInside(stagedFinalRoot, declaredRunDir, "staged_final_root");
  return { runDir: declaredRunDir, candidateRoot, stagedFinalRoot };
}

async function prepareRunDirectory(runDir: string): Promise<void> {
  await mkdir(runDir, { recursive: true });
  await mkdir(join(runDir, "rounds"), { recursive: true });
  await mkdir(join(runDir, "runtime"), { recursive: true });
}

function normalizeOutputDeclarations(outputDeclarations: TargetGovernance["output_declarations"]) {
  return {
    run_root: normalizePath(toRepoRelativePath(outputDeclarations.run_root)),
    candidate_root: normalizePath(toRepoRelativePath(outputDeclarations.candidate_root)),
    staged_final_root: normalizePath(toRepoRelativePath(outputDeclarations.staged_final_root)),
    target_outputs: outputDeclarations.target_outputs.map((entry) => ({
      path: normalizePath(toRepoRelativePath(entry.path)),
      artifact_class: entry.artifact_class,
      promotion_strategy: entry.promotion_strategy,
    })),
    preserved_history_outputs: outputDeclarations.preserved_history_outputs ?? [],
  };
}

function parseSourceRef(value: unknown): SourceRef {
  const record = requiredObject(value, "source_ref");
  return {
    path: requiredString(record.path, "source_ref.path"),
    purpose: requiredString(record.purpose, "source_ref.purpose"),
    required: requiredBoolean(record.required, "source_ref.required"),
    content_type: optionalString(record.content_type),
    notes: optionalString(record.notes),
  };
}

function parseSurfaceRef(value: unknown, label: string): GovernedSurfaceRef {
  const record = requiredObject(value, label);
  return {
    path: requiredString(record.path, `${label}.path`),
    kind: optionalString(record.kind),
    must_exist: typeof record.must_exist === "boolean" ? record.must_exist : true,
  };
}

function parseTargetOutput(value: unknown): TargetOutputDeclaration {
  const record = requiredObject(value, "target_output");
  return {
    path: requiredString(record.path, "target_output.path"),
    artifact_class: requiredString(record.artifact_class, "target_output.artifact_class"),
    promotion_strategy: requiredString(record.promotion_strategy, "target_output.promotion_strategy"),
  };
}

function requiredObject(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object.`);
  return value as Record<string, unknown>;
}
function requiredArray(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value) || value.length === 0) throw new Error(`${label} must be a non-empty array.`);
  return value;
}
function requiredString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) throw new Error(`${label} must be a non-empty string.`);
  return value;
}
function requiredBoolean(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") throw new Error(`${label} must be a boolean.`);
  return value;
}
function requiredEnum(value: unknown, label: string, allowed: readonly string[]): string {
  const text = requiredString(value, label);
  if (!allowed.includes(text)) throw new Error(`${label} must be one of ${allowed.join(" | ")}.`);
  return text;
}
function optionalString(value: unknown): string | undefined {
  return value === undefined ? undefined : requiredString(value, "optional string");
}
async function readJsonRequired<T>(pathValue: string, label: string): Promise<T> {
  return parseJsonTextWithBomSupport<T>(await readFile(pathValue, "utf-8"), `${label} at ${pathValue}`).value;
}
async function writeJson(pathValue: string, value: unknown): Promise<void> {
  await mkdir(dirname(pathValue), { recursive: true });
  await writeFile(pathValue, JSON.stringify(value, null, 2), "utf-8");
}
function resolveRepoPath(pathValue: string): string {
  return isAbsolute(pathValue) ? resolve(pathValue) : resolve(process.cwd(), pathValue);
}
function toRepoRelativePath(pathValue: string): string {
  const normalizedInput = normalizePath(pathValue);
  if (!isAbsolute(pathValue)) {
    if (normalizedInput.split("/").includes("..")) throw new Error(`Relative path cannot escape repo bounds: ${pathValue}`);
    return normalizedInput;
  }
  const repoRelative = normalizePath(relative(resolve(process.cwd()), resolve(pathValue)));
  if (repoRelative.startsWith("../") || repoRelative === "..") throw new Error(`Path ${normalizedInput} is outside the repo root.`);
  return repoRelative;
}
function normalizePath(value: string): string {
  return value.replace(/\\/g, "/");
}
function safeSegments(pathValue: string): string[] {
  const segments = normalizePath(pathValue).split("/").filter((segment) => segment && segment !== ".");
  if (segments.includes("..")) throw new Error(`Path cannot escape repo bounds: ${pathValue}`);
  return segments;
}
function assertInside(candidatePath: string, parentPath: string, label: string): void {
  const rel = normalizePath(relative(parentPath, candidatePath));
  if (rel.startsWith("../") || rel === "..") throw new Error(`${label} must stay inside ${normalizePath(parentPath)}.`);
}
function sha256(content: string): string {
  return createHash("sha256").update(content, "utf-8").digest("hex");
}

if (process.argv[1]?.endsWith("index.ts") || process.argv[1]?.endsWith("index.js")) {
  const requestPath = process.argv[2];
  const outputDir = process.argv[3];
  if (!requestPath) {
    console.error("Usage: implementation-engine <request.json> [output-dir]");
    process.exit(1);
  }
  runImplementation(requestPath, outputDir)
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
      process.exit(result.status === "frozen" || result.status === "frozen_with_conditions" ? 0 : 1);
    })
    .catch((error) => {
      console.error("Fatal:", error);
      process.exit(2);
    });
}
