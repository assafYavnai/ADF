import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { RoleBuilderRequest } from "../schemas/request.js";
import { loadSharedRulesComplianceEnforcerModule } from "./shared-module-loader.js";
import { emitInvocationFailureTelemetry, emitInvocationResultTelemetry } from "./llm-telemetry.js";

const REQUIRED_XML_TAGS = [
  "role",
  "authority",
  "scope",
  "context-gathering",
  "inputs",
  "guardrails",
  "steps",
  "outputs",
  "completion",
];

export function generateRoleMarkdown(request: RoleBuilderRequest): string {
  const req = request.role_requirements;
  const notInScope = uniqueStrings([...req.scope.not_in_scope, ...request.out_of_scope]);
  const requiredInputs = ensureItems(req.inputs.required, [
    "Board roster configuration (leader plus Codex/Claude reviewer pairs)",
    "Governance config (max_review_rounds, freeze/pushback rules)",
    "Runtime config (execution mode, watchdog timeout, launch attempts)",
  ]);
  const guardrails = ensureItems(req.guardrails, [
    "Freeze only when every reviewer approves and the leader reports no unresolved material issues",
    "Any reviewer disagreement or changes_required verdict keeps the run non-frozen until resolved",
  ]);
  const contextGathering = normalizeContextGathering(req.context_gathering);
  const steps = normalizeSteps(req.steps);
  const artifactSections = renderArtifacts(req.outputs.artifacts);

  return `<!-- profile: agent -->
# ${request.role_name}

<role>
${req.role_summary}
</role>

<authority>
- Reports to: ${req.authority.reports_to}
- Subordinate to: ${req.authority.subordinate_to.join(", ") || "none"}
- Owns:
${renderList(req.authority.owns)}
- Does not own:
${renderList(req.authority.does_not_own)}
</authority>

<scope>
Use when:
${renderList(req.scope.use_when)}

Not in scope:
${renderList(notInScope)}
</scope>

<context-gathering>
${contextGathering.map((c, i) => `${i + 1}. ${c}`).join("\n")}
</context-gathering>

<inputs>
Required:
${renderList(requiredInputs)}

Optional:
${renderList(req.inputs.optional)}

Examples:
${renderList(req.inputs.examples)}
</inputs>

<guardrails>
${renderList(guardrails)}
</guardrails>

<steps>
${steps}
</steps>

<outputs>
Canonical artifacts:
${artifactSections.canonical}

Evidence artifacts:
${artifactSections.evidence}

Internal run artifacts:
${artifactSections.internal}
</outputs>

<completion>
This workflow is complete when:
${renderList(req.completion)}
</completion>
`;
}

export interface RevisionFeedback {
  round: number;
  leaderRationale: string;
  unresolved: string[];
  fixChecklist: Array<{
    groupId: string;
    severity: string;
    summary: string;
    redesignGuidance: string;
    findingCount: number;
  }>;
  priorRoundIssueCount: number[];
  rulebook?: Array<{ id: string; rule: string; applies_to: string[]; do: string; dont: string; source: string; version: number }>;
  newRuleIds?: string[];
  selfCheckIssues?: Array<{ code: string; message: string }>;
  governanceContext: {
    component_review_prompt_path: string;
    component_contract_path: string;
    authority_doc_paths: string[];
  };
  bundleRoot?: string;
}

export interface RevisionResult {
  markdown: string;
  complianceMap: Array<{ rule_id: string; status: string; evidence_location: string; evidence_summary: string }>;
  fixItemsMap: Array<{ finding_id?: string; finding_group_id: string; severity?: string; action: string; summary: string; evidence_location?: string; rejection_reason?: string }>;
  diffSummary: { changed: boolean; prior_length: number; new_length: number; summary: string };
  audit: {
    bundleDir: string;
    manifestPath: string;
    rawResponsePath: string;
    wasFallback: boolean;
    invocationId?: string;
    provider: string;
    model: string;
  };
}

export async function performInitialRuleSweep(
  request: RoleBuilderRequest,
  currentMarkdown: string,
  rulebook: Array<{ id: string; rule: string; applies_to: string[]; do: string; dont: string; source: string; version: number }>,
  selfCheckIssues: Array<{ code: string; message: string }>,
  governanceContext: {
    component_review_prompt_path: string;
    component_contract_path: string;
    authority_doc_paths: string[];
  },
  bundleRoot?: string
): Promise<RevisionResult> {
  return runRepairPass(
    request,
    currentMarkdown,
    {
      round: 0,
      leaderRationale: "Initial rulebook sweep before first review.",
      unresolved: [],
      fixChecklist: [],
      priorRoundIssueCount: [],
      rulebook,
      newRuleIds: [],
      selfCheckIssues,
      governanceContext,
      bundleRoot,
    },
    "initial_rule_sweep"
  );
}

export async function reviseRoleMarkdown(
  request: RoleBuilderRequest,
  currentMarkdown: string,
  feedback: RevisionFeedback
): Promise<RevisionResult> {
  return runRepairPass(request, currentMarkdown, feedback, "revision");
}

async function runRepairPass(
  request: RoleBuilderRequest,
  currentMarkdown: string,
  feedback: RevisionFeedback,
  mode: "initial_rule_sweep" | "revision"
): Promise<RevisionResult> {
  const { invoke, emit, createSystemProvenance } = await import("../shared-imports.js");
  const { runRulesComplianceEnforcer } = await loadSharedRulesComplianceEnforcerModule();

  const bundleDir = feedback.bundleRoot
    ?? join("tools", "agent-role-builder", "runs", request.job_id, "runtime", "rules-compliance-enforcer", `${mode}-r${feedback.round}`);
  await mkdir(bundleDir, { recursive: true });

  const repairStart = Date.now();
  let repairResult: Awaited<ReturnType<typeof runRulesComplianceEnforcer>>;
  try {
    repairResult = await runRulesComplianceEnforcer(
      {
      component: "agent-role-builder",
      mode,
      round: feedback.round,
      artifactTag: "draft",
      artifactPathHint: join("tools", "agent-role-builder", "role", `${request.role_slug}-role.md`),
      artifactText: currentMarkdown,
      requiredArtifactInstructions: [
        "Return the full updated role-definition markdown.",
        `It must include all required XML tags: ${REQUIRED_XML_TAGS.map((tag) => `<${tag}>`).join(", ")}.`,
        "Preserve approved intent unless the rulebook, review findings, self-check issues, or authority documents require a change.",
      ].join("\n"),
      rulebook: feedback.rulebook ?? [],
      newRuleIds: feedback.newRuleIds ?? [],
      findings: feedback.fixChecklist,
      unresolved: feedback.unresolved,
      leaderRationale: [feedback.leaderRationale, buildConvergenceNote(feedback)].filter(Boolean).join("\n"),
      selfCheckIssues: feedback.selfCheckIssues ?? [],
      bundleDir,
      reviewPromptPath: feedback.governanceContext.component_review_prompt_path,
      reviewContractPath: feedback.governanceContext.component_contract_path,
      sourceAuthorityPaths: feedback.governanceContext.authority_doc_paths,
      priorIssueCounts: feedback.priorRoundIssueCount,
    },
    async (prompt: string, sourcePath: string) => {
      try {
        const result = await invoke({
          cli: request.board_roster.leader.provider,
          model: request.board_roster.leader.model,
          reasoning: request.board_roster.leader.throttle,
          fallback: buildRepairFallback(request),
          bypass: false,
          timeout_ms: request.runtime.watchdog_timeout_seconds * 1000,
          prompt,
          source_path: sourcePath,
        });
        emitInvocationResultTelemetry(result, {
          engine: "rules-compliance-enforcer",
          stage: mode,
          round: feedback.round,
          metadata: {
            provider: request.board_roster.leader.provider,
            model: request.board_roster.leader.model,
          },
        });
        return {
          response: result.response,
          provenance: {
            invocation_id: result.provenance.invocation_id,
            provider: result.provenance.provider,
            model: result.provenance.model,
            was_fallback: result.provenance.was_fallback,
          },
        };
      } catch (error) {
        emitInvocationFailureTelemetry(error, {
          engine: "rules-compliance-enforcer",
          stage: mode,
          round: feedback.round,
          metadata: {
            provider: request.board_roster.leader.provider,
            model: request.board_roster.leader.model,
          },
        }, {
          provider: request.board_roster.leader.provider,
          model: request.board_roster.leader.model,
          reasoning: request.board_roster.leader.throttle ?? "default",
          sourcePath,
          errorMessage: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
      }
    );
  } catch (error) {
    emit({
      provenance: createSystemProvenance("tools/agent-role-builder/role-generator"),
      category: "tool",
      operation: "rules-compliance-enforcer",
      latency_ms: Date.now() - repairStart,
      success: false,
      metadata: {
        engine: "rules-compliance-enforcer",
        mode,
        round: feedback.round,
        unresolved_count: feedback.unresolved.length,
        error: error instanceof Error ? error.message : String(error),
      },
    });
    throw error;
  }

  emit({
    provenance: createSystemProvenance("tools/agent-role-builder/role-generator"),
    category: "tool",
    operation: "rules-compliance-enforcer",
    latency_ms: Date.now() - repairStart,
    success: true,
    metadata: {
      engine: "rules-compliance-enforcer",
      mode,
      round: feedback.round,
      rule_count_checked: repairResult.complianceMap.length,
      rule_ids_checked: repairResult.complianceMap.map((entry: { rule_id: string }) => entry.rule_id),
      compliant_count: repairResult.complianceMap.filter((entry: { status: string }) => entry.status === "compliant").length,
      non_compliant_count: repairResult.complianceMap.filter((entry: { status: string }) => entry.status === "non_compliant").length,
      rule_ids_non_compliant: repairResult.complianceMap
        .filter((entry: { status: string }) => entry.status === "non_compliant")
        .map((entry: { rule_id: string }) => entry.rule_id),
      not_applicable_count: repairResult.complianceMap.filter((entry: { status: string }) => entry.status === "not_applicable").length,
      fix_item_count: repairResult.fixItemsMap.length,
      changed: repairResult.diffSummary.changed,
      new_rule_ids: feedback.newRuleIds ?? [],
      unresolved_count: feedback.unresolved.length,
    },
  });

  return {
    markdown: repairResult.artifact || currentMarkdown,
    complianceMap: repairResult.complianceMap,
    fixItemsMap: repairResult.fixItemsMap,
    diffSummary: repairResult.diffSummary,
    audit: {
      bundleDir: repairResult.audit.bundleDir,
      manifestPath: repairResult.audit.manifestPath,
      rawResponsePath: repairResult.audit.rawResponsePath,
      wasFallback: repairResult.audit.wasFallback,
      invocationId: repairResult.audit.invocationId,
      provider: repairResult.audit.provider ?? request.board_roster.leader.provider,
      model: repairResult.audit.model ?? request.board_roster.leader.model,
    },
  };
}

export function generateRoleContract(
  request: RoleBuilderRequest,
  markdownPath: string,
  contractPath: string,
  decisionLogPath: string,
  boardSummaryPath: string
): Record<string, unknown> {
  return {
    schema_version: "1.0",
    request_job_id: request.job_id,
    role_slug: request.role_slug,
    role_name: request.role_name,
    operation: request.operation,
    intent: request.intent,
    business_context: request.business_context,
    primary_objective: request.primary_objective,
    out_of_scope: request.out_of_scope,
    source_refs: request.source_refs,
    board_roster: request.board_roster,
    governance: request.governance,
    runtime: request.runtime,
    required_outputs: request.required_outputs,
    role_requirements: request.role_requirements,
    pushback_policy: request.pushback_policy,
    package_files: {
      role_markdown_path: markdownPath,
      role_contract_path: contractPath,
      decision_log_path: decisionLogPath,
      board_summary_path: boardSummaryPath,
    },
    package_generated_at_utc: new Date().toISOString(),
  };
}

function renderList(items: string[]): string {
  return items.length > 0 ? items.map((item) => `- ${item}`).join("\n") : "- none";
}

function uniqueStrings(items: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const item of items.map((value) => value.trim()).filter(Boolean)) {
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }

  return result;
}

function ensureItems(existing: string[], required: string[]): string[] {
  const merged = [...existing];

  for (const item of required) {
    if (!merged.some((candidate) => candidate.toLowerCase() === item.toLowerCase())) {
      merged.push(item);
    }
  }

  return merged;
}

function normalizeContextGathering(items: string[]): string[] {
  return items.map((item) => {
    if (item.toLowerCase().includes("baseline role package")) {
      return "If operation is update or fix, load the baseline role package before draft generation (Step 2).";
    }
    if (item.toLowerCase().includes("resume package")) {
      return "If resuming a prior run, load the resume package before board review and treat it as evidence that constrains the next round.";
    }
    return item;
  });
}

function normalizeSteps(steps: RoleBuilderRequest["role_requirements"]["steps"]): string {
  return steps
    .map((step, index) => {
      const actions = [...step.actions];

      if (step.title.toLowerCase().includes("self-check")) {
        actions.push(
          `Verify the required XML tag set exactly matches: ${REQUIRED_XML_TAGS.map((tag) => `<${tag}>`).join(", ")}`
        );
      }

      if (step.title.toLowerCase().includes("board review")) {
        actions.push("Treat any mixed reviewer verdict within a pair or across pairs as non-frozen until explicitly resolved.");
        actions.push("Freeze only when every reviewer approves and the leader sees no unresolved material issues.");
      }

      return `### ${index + 1}. ${step.title}\n${renderList(uniqueStrings(actions))}\n\nOutputs:\n${renderList(step.outputs)}`;
    })
    .join("\n\n");
}

function renderArtifacts(artifacts: RoleBuilderRequest["role_requirements"]["outputs"]["artifacts"]): {
  canonical: string;
  evidence: string;
  internal: string;
} {
  const canonical: string[] = [];
  const evidence: string[] = [];
  const internal: string[] = [];

  for (const artifact of artifacts) {
    const line = `- ${artifact.path} -- ${artifact.description}`;
    const description = artifact.description.toLowerCase();
    if (description.includes("internal")) {
      internal.push(line);
    } else if (description.includes("always produced") || description.includes("conditional") || description.includes("evidence")) {
      evidence.push(line);
    } else {
      canonical.push(line);
    }
  }

  if (internal.length === 0) {
    internal.push("- normalized-request.json -- Internal request snapshot for audit");
    internal.push("- source-manifest.json -- Internal source inventory for audit");
    internal.push("- self-check.json -- Internal self-check evidence");
    internal.push("- rounds/round-<n>.json -- Internal board round transcripts");
    internal.push("- runtime/session-registry.json -- Internal runtime session state");
  }

  return {
    canonical: canonical.join("\n") || "- none",
    evidence: evidence.join("\n") || "- none",
    internal: internal.join("\n") || "- none",
  };
}

function buildRepairFallback(request: RoleBuilderRequest) {
  if (request.board_roster.leader.provider !== "codex") {
    return undefined;
  }

  const claudeReviewer = request.board_roster.reviewers.find((reviewer) => reviewer.provider === "claude");
  if (!claudeReviewer) {
    return undefined;
  }

  return {
    cli: "claude" as const,
    model: claudeReviewer.model,
    effort: claudeReviewer.throttle,
    bypass: false,
    timeout_ms: request.runtime.watchdog_timeout_seconds * 1000,
  };
}

function buildConvergenceNote(feedback: RevisionFeedback): string {
  if (feedback.priorRoundIssueCount.length === 0) {
    return "";
  }

  const latestPrior = feedback.priorRoundIssueCount[feedback.priorRoundIssueCount.length - 1];
  return `Convergence trend: ${feedback.priorRoundIssueCount.join(" -> ")} -> ${feedback.fixChecklist.length} issues. ${
    latestPrior <= feedback.fixChecklist.length
      ? "NOT CONVERGING - apply all fixes precisely this round."
      : "Converging - keep fixing."
  }`;
}
