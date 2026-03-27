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

export async function reviseRoleMarkdown(
  request: RoleBuilderRequest,
  currentMarkdown: string,
  currentContract: Record<string, unknown>,
  latestRound: {
    round: number;
    leaderRationale: string;
    unresolved: string[];
    participants: Array<{ participant_id: string; verdict?: string }>;
  },
  priorRounds: Array<{ round: number; leaderRationale: string; unresolved: string[] }>
): Promise<string> {
  const { invoke } = await import("../shared-imports.js");

  const revisionPrompt = [
    `You are revising a role markdown draft for ${request.role_name}.`,
    `Return ONLY the full updated markdown document. Do not wrap it in code fences.`,
    ``,
    `Non-negotiable constraints:`,
    `- Keep the required XML tags exactly once each: ${REQUIRED_XML_TAGS.map((tag) => `<${tag}>`).join(", ")}`,
    `- Do not invent new authority, scope, runtime modes, or artifacts that are not supported by the request or current implementation`,
    `- Remove duplicate or contradictory scope boundaries`,
    `- Keep live Codex+Claude reviewer-pair governance mandatory for every run`,
    `- Clarify non-freeze artifact behavior as evidence-only, not canonical`,
    `- Clarify that write authority is limited to role-package artifacts only`,
    ``,
    `Role request summary:`,
    `- Intent: ${request.intent}`,
    `- Primary objective: ${request.primary_objective}`,
    `- Out of scope: ${request.out_of_scope.join("; ")}`,
    `- Governance mode: ${request.governance.mode}`,
    `- Max review rounds: ${request.governance.max_review_rounds}`,
    ``,
    `Current contract summary:`,
    JSON.stringify({
      board_roster: request.board_roster,
      governance: request.governance,
      runtime: request.runtime,
      required_outputs: request.required_outputs,
      package_files: currentContract["package_files"],
    }, null, 2),
    ``,
    `Latest round (${latestRound.round}) leader rationale:`,
    latestRound.leaderRationale,
    ``,
    `Latest unresolved issues:`,
    ...latestRound.unresolved.map((issue) => `- ${issue}`),
    ``,
    `Reviewer feedback this round:`,
    ...latestRound.participants.map((p) => `- ${p.participant_id}: ${(p.verdict ?? "(no verdict)").trim()}`),
    ``,
    priorRounds.length > 0
      ? `Prior round context:\n${priorRounds.map((round) => `- Round ${round.round}: ${round.unresolved.join("; ") || round.leaderRationale}`).join("\n")}\n`
      : "",
    `Current markdown:`,
    currentMarkdown,
    ``,
    `Updated markdown:`,
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

  const revised = stripCodeFences(result.response).trim();
  return revised || currentMarkdown;
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
