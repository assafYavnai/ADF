import { readFile } from "node:fs/promises";
import { LearningInput as LearningInputSchema, LearningOutput as LearningOutputSchema } from "./types.js";
import type { LearningInput, LearningOutput, ProposedRule } from "./types.js";

/**
 * Learning Engine — extracts generalizable rules from review feedback.
 *
 * Generic service. Same engine, different domain prompt per component.
 * Loads review-prompt.json from the component directory for domain context.
 *
 * Does NOT write to rulebook directly — returns proposals for the caller to apply.
 */

export async function extractRules(
  input: LearningInput,
  invoker: (prompt: string, sourcePath: string) => Promise<string>,
): Promise<LearningOutput> {
  LearningInputSchema.parse(input);
  let reviewPromptContext = "";
  let reviewContractContext = "";

  if (input.review_prompt_path) {
    reviewPromptContext = await readJsonContextFile(input.review_prompt_path, "review prompt");
  }

  if (input.review_contract_path) {
    reviewContractContext = await readJsonContextFile(input.review_contract_path, "review contract");
  }

  const existingRulesSummary = input.current_rulebook
    .map((r) => `${r.id}: ${r.rule}`)
    .join("\n");

  const findingsSummary = input.review_findings
    .map((f) => `[${f.group_id}] (${f.severity}) ${f.summary}\n  Guidance: ${f.redesign_guidance}`)
    .join("\n\n");

  const unresolvedSummary = input.unresolved_from_leader
    .map((u, i) => `${i + 1}. ${u}`)
    .join("\n");

  const prompt = `You are the ADF Learning Engine. Your job is to analyze review feedback and extract generalizable rules.

DOMAIN: ${input.review_prompt_domain}
COMPONENT: ${input.component}
ROUND: ${input.round}

COMPONENT REVIEW PROMPT:
${reviewPromptContext || "(not provided)"}

COMPONENT REVIEW CONTRACT:
${reviewContractContext || "(not provided)"}

EXISTING RULEBOOK (${input.current_rulebook.length} rules):
${existingRulesSummary || "(empty)"}

REVIEW FINDINGS THIS ROUND:
${findingsSummary || "(none)"}

LEADER'S UNRESOLVED ISSUES:
${unresolvedSummary || "(none)"}

YOUR TASK:
For each finding, determine ONE of:
1. It reveals a NEW generalizable rule not covered by existing rules -> propose a new rule
2. It is ALREADY COVERED by an existing rule -> cite which rule and explain
3. It is TOO SPECIFIC to generalize -> explain why

For new rules, follow this format:
- id: ${input.component.toUpperCase().replace(/-/g, "").slice(0, 3)}-NNN (next available number)
- rule: one sentence, high-level principle (understandable without context)
- applies_to: which sections/files it applies to
- do: concrete example of compliance (actionable, copy-able)
- dont: concrete example of violation (recognizable)
- source: "Round ${input.round}: [brief description of what was observed]"

RESPOND WITH JSON ONLY:
{
  "new_rules": [{ "id", "rule", "applies_to", "do", "dont", "source", "version": 1 }],
  "existing_rules_covering": [{ "finding_group_id", "covered_by_rule_id", "explanation" }],
  "no_rule_needed": [{ "finding_group_id", "reason" }]
}

IMPORTANT:
- Only propose rules that are GENERAL enough to apply across runs
- The "do" must include a concrete example a first-time implementer can follow
- The "dont" must include a concrete example of the violation
- If an existing rule covers it, cite it — don't create duplicates
- Prefer updating existing rules over creating new ones (but don't update here — just flag)

JSON response:`;

  const rawResponse = await invoker(prompt, `shared/learning-engine/extract-rules/${input.component}`);
  const cleaned = rawResponse.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(cleaned) as Record<string, unknown>;
  } catch (error) {
    throw new Error(
      `Failed to parse learning engine response: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  const validated = LearningOutputSchema.safeParse(parsed);
  if (!validated.success) {
    throw new Error(`Learning engine response failed schema validation: ${validated.error.message}`);
  }

  return validated.data;
}

/**
 * Apply proposed rules to a rulebook (in memory).
 * Returns the updated rules array. Caller writes to disk.
 */
export function applyProposedRules(
  currentRules: Array<{ id: string; [key: string]: unknown }>,
  proposedRules: ProposedRule[]
): Array<{ id: string; [key: string]: unknown }> {
  const existingIds = new Set(currentRules.map((r) => r.id));
  const newRules = proposedRules.filter((r) => !existingIds.has(r.id));
  return [...currentRules, ...newRules];
}

async function readJsonContextFile(path: string, label: string): Promise<string> {
  const raw = await readFile(path, "utf-8");
  try {
    JSON.parse(raw);
  } catch (error) {
    throw new Error(
      `Failed to parse ${label} at ${path}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
  return raw;
}
