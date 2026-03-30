import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { RoleBuilderRequest } from "../schemas/request.js";

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
  bundleRoot?: string;
}

export interface RevisionResult {
  markdown: string;
  complianceMap: Array<{ rule_id: string; status: string; evidence_location: string; evidence_summary: string }>;
  fixItemsMap: Array<{ finding_id?: string; finding_group_id: string; action: string; summary: string; evidence_location?: string; rejection_reason?: string }>;
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
  const { invoke } = await import("../shared-imports.js");

  const bundleDir = feedback.bundleRoot
    ?? join("tools", "agent-role-builder", "runs", request.job_id, "runtime", "component-repair-engine", `${mode}-r${feedback.round}`);
  await mkdir(bundleDir, { recursive: true });

  const artifactFile = join(bundleDir, `${request.role_slug}-artifact.md`);
  const rulebookFile = join(bundleDir, "rulebook.json");
  const findingsFile = join(bundleDir, "findings.json");
  const selfCheckFile = join(bundleDir, "self-check.json");
  const reviewPromptSource = join("tools", "agent-role-builder", "review-prompt.json");
  const reviewContractSource = join("tools", "agent-role-builder", "review-contract.json");
  const reviewPromptFile = join(bundleDir, "review-prompt.json");
  const reviewContractFile = join(bundleDir, "review-contract.json");
  const authorityDir = join(bundleDir, "authority");
  await mkdir(authorityDir, { recursive: true });

  await writeFile(artifactFile, currentMarkdown, "utf-8");
  await writeFile(rulebookFile, JSON.stringify({
    schema_version: "1.0",
    generated_at: new Date().toISOString(),
    new_rule_ids: feedback.newRuleIds ?? [],
    rules: (feedback.rulebook ?? []).map((rule) => ({
      ...rule,
      is_new_this_round: (feedback.newRuleIds ?? []).includes(rule.id),
    })),
  }, null, 2), "utf-8");
  await writeFile(findingsFile, JSON.stringify({
    schema_version: "1.0",
    mode,
    round: feedback.round,
    leader_rationale: feedback.leaderRationale,
    unresolved: feedback.unresolved,
    convergence_note: buildConvergenceNote(feedback),
    findings: feedback.fixChecklist.map((group, index) => ({
      finding_group_id: group.groupId,
      severity: group.severity,
      summary: group.summary,
      redesign_guidance: group.redesignGuidance,
      finding_count: group.findingCount,
      order: index + 1,
    })),
  }, null, 2), "utf-8");
  await writeFile(selfCheckFile, JSON.stringify({
    schema_version: "1.0",
    round: feedback.round,
    issues: feedback.selfCheckIssues ?? [],
  }, null, 2), "utf-8");

  await copyIfPresent(reviewPromptSource, reviewPromptFile);
  await copyIfPresent(reviewContractSource, reviewContractFile);

  const authorityCopies = await Promise.all([
    copyAuthorityFile("docs/v0/review-process-architecture.md", join(authorityDir, "review-process-architecture.md")),
    copyAuthorityFile("docs/v0/architecture.md", join(authorityDir, "architecture.md")),
  ]);

  const manifestPath = join(bundleDir, "manifest.json");
  await writeFile(manifestPath, JSON.stringify({
    schema_version: "1.0",
    component: "agent-role-builder",
    engine: "component-repair-engine",
    mode,
    round: feedback.round,
    artifact: artifactFile.replace(/\\/g, "/"),
    rulebook: rulebookFile.replace(/\\/g, "/"),
    findings: findingsFile.replace(/\\/g, "/"),
    self_check: selfCheckFile.replace(/\\/g, "/"),
    review_prompt: reviewPromptFile.replace(/\\/g, "/"),
    review_contract: reviewContractFile.replace(/\\/g, "/"),
    source_authorities: authorityCopies.filter((value): value is string => Boolean(value)).map((value) => value.replace(/\\/g, "/")),
    canonical_artifact_hint: `tools/agent-role-builder/role/${request.role_slug}-role.md`,
  }, null, 2), "utf-8");

  const prompt = `You are the ADF Component Repair Engine for ${request.role_name}.

MODE: ${mode}
COMPONENT: tools/agent-role-builder

READ ONLY THE FILES DECLARED IN THIS MANIFEST:
${manifestPath.replace(/\\/g, "/")}

IMPORTANT BOXING RULES:
- Stay boxed to the manifest files and copied authority files.
- Do not roam the repo.
- Do not change unknown scripts or files outside the declared artifact.
- Use the review prompt, review contract, rulebook, findings, and self-check evidence together.

YOUR JOB:
1. Mechanically walk every rule in the rulebook against the artifact.
2. Fix direct review findings from findings.json.
3. Fix any rule-compliance gaps you detect, even if the reviewer did not call them out.
4. Fix self-check issues.
5. Produce a full updated artifact plus machine-readable compliance and fix evidence.

ARTIFACT REQUIREMENTS:
- The artifact is role-definition markdown.
- It must include all required XML tags: ${REQUIRED_XML_TAGS.map((tag) => `<${tag}>`).join(", ")}.
- Preserve intent unless a change is required by the rulebook, review findings, or authority docs.

RESPONSE FORMAT:
<draft>
...full updated markdown...
</draft>

<compliance_map>
[{"rule_id":"ARB-001","status":"compliant"|"non_compliant"|"not_applicable","evidence_location":"<section>","evidence_summary":"..."}]
</compliance_map>
${mode === "revision" ? `
<fix_items_map>
[{"finding_id":"preferred-if-known","finding_group_id":"group-1","action":"accepted"|"rejected","summary":"...","evidence_location":"<section>","rejection_reason":"only if rejected"}]
</fix_items_map>` : ""}

${buildConvergenceNote(feedback)}
CRITICAL:
- Check every rule.
- If there are no findings, still perform a full rulebook sweep.
- Return only the tagged sections above.`;

  const result = await invoke({
    cli: request.board_roster.leader.provider,
    model: request.board_roster.leader.model,
    reasoning: request.board_roster.leader.throttle,
    fallback: buildRepairFallback(request),
    bypass: false,
    timeout_ms: request.runtime.watchdog_timeout_seconds * 1000,
    prompt,
    source_path: "tools/agent-role-builder/component-repair-engine",
  });

  const rawResponsePath = join(bundleDir, "response.raw.txt");
  await writeFile(rawResponsePath, result.response, "utf-8");

  const draftMatch = result.response.match(/<draft>([\s\S]*?)<\/draft>/);
  const complianceMatch = result.response.match(/<compliance_map>([\s\S]*?)<\/compliance_map>/);
  const fixItemsMatch = result.response.match(/<fix_items_map>([\s\S]*?)<\/fix_items_map>/);

  if (!draftMatch || !complianceMatch) {
    throw new Error(`Repair engine response missing required sections in ${rawResponsePath}`);
  }

  const revised = stripCodeFences(draftMatch[1]).trim();

  let complianceMap: RevisionResult["complianceMap"] = [];
  try {
    complianceMap = JSON.parse(complianceMatch[1].trim());
  } catch (error) {
    throw new Error(`Failed to parse compliance_map from repair response: ${error instanceof Error ? error.message : String(error)}`);
  }

  let fixItemsMap: RevisionResult["fixItemsMap"] = [];
  if (mode === "revision" && fixItemsMatch) {
    try {
      fixItemsMap = JSON.parse(fixItemsMatch[1].trim());
    } catch (error) {
      throw new Error(`Failed to parse fix_items_map from repair response: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  await writeFile(join(bundleDir, "response.parsed.json"), JSON.stringify({
    artifact_length: revised.length,
    compliance_entries: Array.isArray(complianceMap) ? complianceMap.length : 0,
    fix_item_entries: Array.isArray(fixItemsMap) ? fixItemsMap.length : 0,
    was_fallback: result.provenance.was_fallback,
    provider: result.provenance.provider,
    model: result.provenance.model,
  }, null, 2), "utf-8");

  return {
    markdown: revised || currentMarkdown,
    complianceMap: Array.isArray(complianceMap) ? complianceMap : [],
    fixItemsMap: Array.isArray(fixItemsMap) ? fixItemsMap : [],
    diffSummary: {
      changed: revised !== currentMarkdown,
      prior_length: currentMarkdown.length,
      new_length: revised.length,
      summary: revised !== currentMarkdown
        ? `${mode} updated the artifact and regenerated compliance evidence.`
        : `${mode} kept the artifact text unchanged but regenerated evidence.`,
    },
    audit: {
      bundleDir,
      manifestPath,
      rawResponsePath,
      wasFallback: result.provenance.was_fallback,
      invocationId: result.provenance.invocation_id,
      provider: result.provenance.provider,
      model: result.provenance.model,
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

function stripCodeFences(text: string): string {
  return text.replace(/^```(?:markdown|md)?\s*/i, "").replace(/\s*```$/, "");
}

async function copyIfPresent(source: string, destination: string): Promise<void> {
  try {
    const content = await readFile(source, "utf-8");
    await writeFile(destination, content, "utf-8");
  } catch {
    await writeFile(destination, "{}", "utf-8");
  }
}

async function copyAuthorityFile(source: string, destination: string): Promise<string | null> {
  try {
    const content = await readFile(source, "utf-8");
    await writeFile(destination, content, "utf-8");
    return destination;
  } catch {
    return null;
  }
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
