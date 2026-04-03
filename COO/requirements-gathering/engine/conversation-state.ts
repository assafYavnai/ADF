import type {
  OnionPersistenceReceipt as OnionPersistenceReceiptType,
  OnionWorkflowLifecycleStatus as OnionWorkflowLifecycleStatusType,
} from "../contracts/onion-live.js";
import {
  hasMeaningfulText,
  type ApprovedOnionSnapshot,
  type OnionState as OnionStateType,
} from "../contracts/onion-state.js";

export interface ConversationScopeProjection {
  topic: string | null;
  goal: string | null;
  expected_result: string | null;
  success_view: string | null;
  major_parts: string[];
  boundaries: string[];
  experience_summary: string | null;
}

export interface AskSmallestQuestionConversationState {
  kind: "ask_smallest_question";
  question: string;
}

export interface ReflectAndConfirmConversationState {
  kind: "reflect_and_confirm";
  scope: ConversationScopeProjection;
  question: string;
}

export interface ReadyForApprovalConversationState {
  kind: "ready_for_approval";
  scope: ConversationScopeProjection;
}

export interface ApprovedAndFrozenConversationState {
  kind: "approved_and_frozen";
  scope: ConversationScopeProjection;
  handoff_ready: boolean;
  finalized_requirement_memory_id: string | null;
}

export interface BlockedWithReasonConversationState {
  kind: "blocked_with_reason";
  scope: ConversationScopeProjection;
  scope_frozen: boolean;
  reasons: string[];
  next_safe_move: string | null;
}

export type RequirementsConversationState =
  | AskSmallestQuestionConversationState
  | ReflectAndConfirmConversationState
  | ReadyForApprovalConversationState
  | ApprovedAndFrozenConversationState
  | BlockedWithReasonConversationState;

export function deriveConversationState(input: {
  lifecycleStatus: OnionWorkflowLifecycleStatusType;
  state: OnionStateType;
  clarificationQuestion: string | null;
  freezeRequest: string | null;
  finalizedRequirementMemoryId: string | null;
  persistenceFailures: OnionPersistenceReceiptType[];
  stateCommitSummary: string;
}): RequirementsConversationState {
  const scope = buildConversationScopeProjection(input.state);
  const blockerReasons = listConversationBlockers({
    lifecycleStatus: input.lifecycleStatus,
    state: input.state,
    persistenceFailures: input.persistenceFailures,
    stateCommitSummary: input.stateCommitSummary,
  });

  if (blockerReasons.length > 0) {
    return {
      kind: "blocked_with_reason",
      scope,
      scope_frozen: input.state.freeze_status.status === "approved",
      reasons: blockerReasons,
      next_safe_move: "Restore the blocked route and re-run the turn once the handoff can complete truthfully.",
    };
  }

  if (input.lifecycleStatus === "handoff_ready" || input.state.freeze_status.status === "approved") {
    return {
      kind: "approved_and_frozen",
      scope,
      handoff_ready: input.lifecycleStatus === "handoff_ready" && hasMeaningfulText(input.finalizedRequirementMemoryId ?? ""),
      finalized_requirement_memory_id: input.finalizedRequirementMemoryId,
    };
  }

  if (input.freezeRequest) {
    return {
      kind: "ready_for_approval",
      scope,
    };
  }

  if (input.clarificationQuestion) {
    if (shouldReflectBeforeQuestion(scope)) {
      return {
        kind: "reflect_and_confirm",
        scope,
        question: input.clarificationQuestion,
      };
    }

    return {
      kind: "ask_smallest_question",
      question: input.clarificationQuestion,
    };
  }

  return {
    kind: "blocked_with_reason",
    scope,
    scope_frozen: false,
    reasons: [input.stateCommitSummary],
    next_safe_move: null,
  };
}

export function buildConversationScopeProjection(stateInput: OnionStateType): ConversationScopeProjection {
  const scope = getConversationScopeSource(stateInput);

  return {
    topic: toMeaningfulText(scope.topic),
    goal: toMeaningfulText(scope.goal),
    expected_result: toMeaningfulText(scope.expected_result),
    success_view: toMeaningfulText(scope.success_view),
    major_parts: scope.major_parts
      .map((part) => part.label.trim())
      .filter((label) => label.length > 0),
    boundaries: scope.boundaries
      .map((boundary) => boundary.statement.trim())
      .filter((statement) => statement.length > 0),
    experience_summary: scope.experience_ui.relevant
      ? toMeaningfulText(scope.experience_ui.summary ?? "")
      : null,
  };
}

function getConversationScopeSource(state: OnionStateType): ApprovedOnionSnapshot | OnionStateType {
  return state.approved_snapshot ?? state;
}

function toMeaningfulText(value: string | null | undefined): string | null {
  return typeof value === "string" && hasMeaningfulText(value) ? value.trim() : null;
}

function shouldReflectBeforeQuestion(scope: ConversationScopeProjection): boolean {
  return scope.topic !== null || countKnownScopeFacts(scope) >= 2;
}

function countKnownScopeFacts(scope: ConversationScopeProjection): number {
  let count = 0;
  if (scope.topic) count++;
  if (scope.goal) count++;
  if (scope.expected_result) count++;
  if (scope.success_view) count++;
  if (scope.major_parts.length > 0) count++;
  if (scope.boundaries.length > 0) count++;
  if (scope.experience_summary) count++;
  return count;
}

function listConversationBlockers(input: {
  lifecycleStatus: OnionWorkflowLifecycleStatusType;
  state: OnionStateType;
  persistenceFailures: OnionPersistenceReceiptType[];
  stateCommitSummary: string;
}): string[] {
  if (input.persistenceFailures.length > 0) {
    return input.persistenceFailures.map((receipt) => receipt.message).filter((message) => message.trim().length > 0);
  }

  if (input.lifecycleStatus === "blocked") {
    if (input.state.freeze_status.blockers.length > 0) {
      return [...input.state.freeze_status.blockers];
    }
    return [input.stateCommitSummary];
  }

  return [];
}
