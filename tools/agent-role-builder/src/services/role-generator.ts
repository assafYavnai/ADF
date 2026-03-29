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

/**
 * Generate role markdown from request + sources.
 */
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
  rulebook?: Array<{ id: string; rule: string; applies_to: string[]; do: string; dont: string }>;
  newRuleIds?: string[];
}

export interface RevisionResult {
  markdown: string;
  complianceMap: Array<{ rule_id: string; status: string; evidence_location: string; evidence_summary: string }>;
  fixItemsMap: Array<{ finding_group_id: string; action: string; summary: string; evidence_location?: string; rejection_reason?: string }>;
}

export async function reviseRoleMarkdown(
  request: RoleBuilderRequest,
  currentMarkdown: string,
  feedback: RevisionFeedback
): Promise<RevisionResult> {
  const { invoke } = await import("../shared-imports.js");

  // Build actionable fix checklist from parsed reviewer feedback
  const fixItems = feedback.fixChecklist
    .filter((g) => g.severity === "blocking" || g.severity === "major")
    .map((g, i) => `${i + 1}. [${g.groupId}] (${g.severity}) ${g.summary}\n   FIX: ${g.redesignGuidance}`)
    .join("\n\n");

  const minorItems = feedback.fixChecklist
    .filter((g) => g.severity === "minor" || g.severity === "suggestion")
    .map((g) => `- [${g.groupId}] ${g.summary}: ${g.redesignGuidance}`)
    .join("\n");

  const convergenceNote = feedback.priorRoundIssueCount.length > 0
    ? `Convergence trend: ${feedback.priorRoundIssueCount.join(" -> ")} -> ${feedback.fixChecklist.length} issues. ${
        feedback.priorRoundIssueCount[feedback.priorRoundIssueCount.length - 1] <= feedback.fixChecklist.length
          ? "NOT CONVERGING — apply all fixes precisely this round."
          : "Converging — keep fixing."
      }`
    : "";

  // Build rulebook compliance checklist if available, marking new rules added this round
  const newRuleSet = new Set(feedback.newRuleIds ?? []);
  const rulebookSection = feedback.rulebook && feedback.rulebook.length > 0
    ? `=== RULEBOOK (check EVERY rule before submitting) ===\n${feedback.rulebook.map((r) => {
        const prefix = newRuleSet.has(r.id) ? `[NEW — added this round] ` : "";
        const appliesTo = Array.isArray(r.applies_to) ? r.applies_to.join(", ") : String(r.applies_to);
        return `${prefix}${r.id}: ${r.rule}\n  DO: ${r.do.slice(0, 200)}\n  DONT: ${r.dont.slice(0, 200)}\n  Applies to: ${appliesTo}`;
      }).join("\n\n")}`
    : "";

  // Build prior findings section for fix items map (round 1+ only)
  const priorFindings = feedback.fixChecklist
    .filter((g) => g.severity === "blocking" || g.severity === "major")
    .map((g) => `[${g.groupId}] (${g.severity}) ${g.summary}\n  Guidance: ${g.redesignGuidance}`)
    .join("\n\n");

  const fixItemsInstruction = feedback.round > 0 && priorFindings
    ? `\nAfter <draft>, also produce a <fix_items_map> section:
<fix_items_map>
[{ "finding_group_id": "group-1", "action": "accepted" | "rejected", "summary": "what was changed or why rejected", "evidence_location": "<section>", "rejection_reason": "only if rejected" }]
</fix_items_map>

PRIOR FINDINGS TO ADDRESS:
${priorFindings}`
    : "";

  // Bug 7 fix: Merge revision + compliance map + fix items map into 1 LLM call
  const revisionPrompt = [
    `You are revising a role markdown draft for ${request.role_name}.`,
    ``,
    `RESPOND IN THIS EXACT FORMAT (three XML-tagged sections):`,
    ``,
    `<draft>`,
    `...full updated markdown (no code fences)...`,
    `</draft>`,
    ``,
    `<compliance_map>`,
    `[{ "rule_id": "ARB-001", "status": "compliant" | "non_compliant" | "not_applicable", "evidence_location": "<section>", "evidence_summary": "..." }]`,
    `</compliance_map>`,
    fixItemsInstruction,
    ``,
    `CRITICAL: You MUST fix every blocking/major item below. Each has specific guidance.`,
    `CRITICAL: You MUST check every rule in the RULEBOOK below. Violations will be caught by the reviewer.`,
    `If you do not fix an item, the next review round will reject again for the same reason.`,
    ``,
    convergenceNote,
    ``,
    `=== BLOCKING/MAJOR FIXES REQUIRED ===`,
    fixItems || "(none — only minor issues remain)",
    ``,
    minorItems ? `=== MINOR FIXES (address if possible) ===\n${minorItems}` : "",
    ``,
    `=== LEADER RATIONALE ===`,
    feedback.leaderRationale,
    ``,
    `=== UNRESOLVED FROM LEADER ===`,
    ...feedback.unresolved.map((u) => `- ${u}`),
    ``,
    rulebookSection ? `\n${rulebookSection}\n` : "",
    `=== SOURCE AUTHORITY (use these as canonical truth — do NOT invent governance) ===`,
    `- Arbitration model: defined in docs/v0/review-process-architecture.md "Arbitration (Minor Items Only)" section. Arbitration is minor-only, result is frozen_with_conditions, invoker decides acceptance.`,
    `- Error escalation: defined in docs/v0/review-process-architecture.md "Error Escalation Pattern" section.`,
    `- Agent role governance rule: defined in docs/v0/architecture.md "Agent Role Governance Rule" section.`,
    `- Review process: defined in docs/v0/review-process-architecture.md "The Review Process (Per Round)" section.`,
    `- Terminal states: frozen (all approved/conditional, no blocking), pushback (reject with blocking/major), blocked (unrecoverable), resume_required (budget exhausted).`,
    `- Canonical artifact paths: tools/agent-role-builder/role/agent-role-builder-role.md, -role-contract.json, -decision-log.md, -board-summary.md`,
    `- DO NOT invent governance semantics. If a behavior is not defined in the source documents above, do not include it in the role definition.`,
    ``,
    `=== CONSTRAINTS ===`,
    `- Keep required XML tags exactly once each: ${REQUIRED_XML_TAGS.map((t) => `<${t}>`).join(", ")}`,
    `- Do not invent new authority, scope, runtime modes, or artifacts not in the request`,
    `- Write authority limited to role-package artifacts only`,
    `- Governance: ${request.governance.mode}, max ${request.governance.max_review_rounds} rounds`,
    ``,
    `=== CURRENT MARKDOWN ===`,
    currentMarkdown,
    ``,
    `=== PRODUCE YOUR RESPONSE (draft + compliance_map${feedback.round > 0 ? " + fix_items_map" : ""}) ===`,
  ].filter(Boolean).join("\n");

  const result = await invoke({
    cli: request.board_roster.leader.provider,
    model: request.board_roster.leader.model,
    reasoning: request.board_roster.leader.throttle,
    bypass: false,
    timeout_ms: request.runtime.watchdog_timeout_seconds * 1000,
    prompt: revisionPrompt,
    source_path: "tools/agent-role-builder/revise-draft",
  });

  // Parse the combined response by extracting XML-tagged sections
  const draftMatch = result.response.match(/<draft>([\s\S]*?)<\/draft>/);
  const complianceMatch = result.response.match(/<compliance_map>([\s\S]*?)<\/compliance_map>/);
  const fixItemsMatch = result.response.match(/<fix_items_map>([\s\S]*?)<\/fix_items_map>/);

  const revised = draftMatch ? stripCodeFences(draftMatch[1]).trim() : stripCodeFences(result.response).trim();

  let complianceMap: RevisionResult["complianceMap"] = [];
  if (complianceMatch) {
    try { complianceMap = JSON.parse(complianceMatch[1].trim()); } catch (e) {
      console.error("[role-generator] Failed to parse compliance_map from revision response:", e instanceof Error ? e.message : e);
    }
  }

  let fixItemsMap: RevisionResult["fixItemsMap"] = [];
  if (fixItemsMatch) {
    try { fixItemsMap = JSON.parse(fixItemsMatch[1].trim()); } catch (e) {
      console.error("[role-generator] Failed to parse fix_items_map from revision response:", e instanceof Error ? e.message : e);
    }
  }

  return {
    markdown: revised || currentMarkdown,
    complianceMap: Array.isArray(complianceMap) ? complianceMap : [],
    fixItemsMap: Array.isArray(fixItemsMap) ? fixItemsMap : [],
  };
}

/**
 * Generate role contract JSON from request.
 */
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
