import { z } from "zod";
import { WorkflowName } from "../controller/workflow-contract.js";

/**
 * Intent Classifier — bounded LLM call that determines the workflow
 * for each user turn. The controller calls this before the COO.
 *
 * This is a small, focused classification — not the full COO reasoning.
 */

export const ClassifierOutput = z.object({
  intent: z.string(),
  workflow: WorkflowName,
  tool: z.string().optional(),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().optional(),
});

export type ClassifierOutput = z.infer<typeof ClassifierOutput>;

/**
 * Build the classifier prompt. This is a focused system prompt
 * that tells the model to classify intent, not to reason deeply.
 */
export function buildClassifierPrompt(
  userMessage: string,
  recentContext: string,
  options: {
    onionEnabled?: boolean;
    currentWorkflow?: string | null;
    persistedOnionState?: boolean;
    onionLifecycleStatus?: string | null;
  } = {}
): string {
  const onionEnabled = options.onionEnabled ?? false;
  const currentWorkflow = options.currentWorkflow ?? "none";
  const persistedOnionState = options.persistedOnionState ?? false;
  const onionLifecycleStatus = options.onionLifecycleStatus ?? "none";
  const workflowOptions = onionEnabled
    ? `"direct_coo_response" | "memory_operation" | "clarification" | "pushback" | "requirements_gathering_onion"`
    : `"direct_coo_response" | "memory_operation" | "clarification" | "pushback"`;
  const onionRules = onionEnabled
    ? `- If the thread is already in requirements_gathering_onion, keep routing continued scope-shaping answers, freeze approval/rejection, UI approval, boundaries, and open-decision answers to requirements_gathering_onion unless the user explicitly asked for a memory operation.
- If persisted_onion_state is true, this thread still belongs to requirements_gathering_onion even when current_workflow is none (for example after handoff_ready). Route reopen/correction/freeze follow-up turns to requirements_gathering_onion unless the user explicitly asked for a memory operation.
- If the user is starting or continuing feature requirements shaping, feature scope clarification, whole-onion freeze approval, or requirement freeze corrections, use requirements_gathering_onion.
- If the user asks to freeze the gathered feature scope, approve/reject a freeze request, answer a current scope-shaping question, or clarify major parts, boundaries, UI direction, or open business decisions, use requirements_gathering_onion.`
    : `- The requirements_gathering_onion workflow is disabled for this runtime. Do not return requirements_gathering_onion.`;

  return `You are an intent classifier for the ADF COO system.
Your job is to classify the user's message into one workflow type.
Respond ONLY with valid JSON matching this schema:

{
  "intent": "short description of what the user wants",
  "workflow": one of: ${workflowOptions},
  "tool": if workflow is "memory_operation", which tool: "memory_capture" | "memory_search" | "decision_log" | "rule_create" | "context_load",
  "confidence": 0.0 to 1.0,
  "reasoning": "brief explanation"
}

Important JSON rule:
- If workflow is NOT "memory_operation", omit the "tool" field completely.
- Never return "tool": null.

Classification rules:
- "save this decision", "log decision", "record this decision" -> memory_operation + decision_log
- "remember this", "save this", "note that" -> memory_operation + memory_capture
- "make this a rule", "new rule", "from now on" -> memory_operation + rule_create
- "what did we decide", "search memory", "find our", "load context" -> memory_operation + memory_search or context_load
- Questions about the project, status, plans -> direct_coo_response
- Unclear or ambiguous requests -> clarification
- Requests that conflict with known rules -> pushback
- Tool-specific requests that do not fit the current COO surface -> clarification
${onionRules}

Active workflow state:
- current_workflow: ${currentWorkflow}
- requirements_gathering_onion_enabled: ${onionEnabled ? "true" : "false"}
- persisted_onion_state: ${persistedOnionState ? "true" : "false"}
- onion_lifecycle_status: ${onionLifecycleStatus}

Recent context:
${recentContext}

User message:
${userMessage}

Respond with JSON only:`;
}

/**
 * Parse classifier response. Handles both clean JSON and
 * JSON wrapped in markdown code blocks.
 */
export function parseClassifierResponse(raw: string): ClassifierOutput {
  let cleaned = raw.trim();

  // Strip markdown code blocks if present
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  const parsed = JSON.parse(cleaned) as Record<string, unknown>;

  // Some providers return explicit null for optional fields.
  // Normalize that into field omission so the contract stays strict.
  if (parsed.tool === null) {
    delete parsed.tool;
  }
  if (parsed.reasoning === null) {
    delete parsed.reasoning;
  }

  return ClassifierOutput.parse(parsed);
}
