import type { RoleBuilderRequest } from "../schemas/request.js";

/**
 * Generate role markdown from request + sources.
 */
export function generateRoleMarkdown(request: RoleBuilderRequest): string {
  const req = request.role_requirements;

  const steps = req.steps
    .map(
      (step, i) =>
        `### ${i + 1}. ${step.title}\n${step.actions.map((a) => `- ${a}`).join("\n")}\n\nOutput:\n${step.outputs.map((o) => `- ${o}`).join("\n")}`
    )
    .join("\n\n");

  const artifacts = req.outputs.artifacts
    .map((a) => `- ${a.path} -- ${a.description}`)
    .join("\n");

  return `<!-- profile: workflow -->
# ${request.role_name}

<role>
${req.role_summary}
</role>

<authority>
- Reports to: ${req.authority.reports_to}
- Subordinate to: ${req.authority.subordinate_to.join(", ") || "none"}
- Owns: ${req.authority.owns.join(", ") || "none"}
- Does not own: ${req.authority.does_not_own.join(", ") || "none"}
</authority>

<scope>
Use when:
${req.scope.use_when.map((w) => `- ${w}`).join("\n")}

Not in scope:
${req.scope.not_in_scope.map((n) => `- ${n}`).join("\n")}
${request.out_of_scope.map((o) => `- ${o}`).join("\n")}
</scope>

<context-gathering>
${req.context_gathering.map((c, i) => `${i + 1}. ${c}`).join("\n")}
</context-gathering>

<inputs>
Required:
${req.inputs.required.map((r) => `- ${r}`).join("\n")}

Optional:
${req.inputs.optional.map((o) => `- ${o}`).join("\n")}

Examples:
${req.inputs.examples.map((e) => `- ${e}`).join("\n")}
</inputs>

<guardrails>
- Primary objective: ${request.primary_objective}
${req.guardrails.map((g) => `- ${g}`).join("\n")}
</guardrails>

<steps>
${steps}
</steps>

<outputs>
Artifacts:
${artifacts}
</outputs>

<completion>
This workflow is complete when:
${req.completion.map((c) => `- ${c}`).join("\n")}
</completion>
`;
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
