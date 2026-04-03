import type {
  BlockedWithReasonConversationState,
  ConversationScopeProjection,
  RequirementsConversationState,
} from "./conversation-state.js";

export function renderConversationResponse(state: RequirementsConversationState): string {
  switch (state.kind) {
    case "ask_smallest_question":
      return state.question;
    case "reflect_and_confirm":
      return [
        renderNaturalRecap(state.scope, { include_details: false }),
        state.question,
      ].filter(Boolean).join("\n\n");
    case "ready_for_approval":
      return [
        renderNaturalRecap(state.scope, { include_details: true }),
        "If that matches your intent, should I freeze this scope now?",
      ].filter(Boolean).join("\n\n");
    case "approved_and_frozen":
      return [
        renderNaturalRecap(state.scope, { include_details: false }),
        state.handoff_ready && state.finalized_requirement_memory_id
          ? `The scope is frozen and the finalized requirement artifact is stored as ${state.finalized_requirement_memory_id}. I will not reopen it unless you explicitly ask to change it.`
          : "The scope is already frozen and approved. I will not reopen it unless you explicitly ask to change it.",
      ].filter(Boolean).join("\n\n");
    case "blocked_with_reason":
      return renderBlockedWithReason(state);
  }
}

function renderBlockedWithReason(state: BlockedWithReasonConversationState): string {
  const sections: string[] = [];
  const recap = renderNaturalRecap(state.scope, { include_details: false });
  if (recap) {
    sections.push(recap);
  }

  if (state.reasons.length === 1) {
    const blockerClause = toClause(state.reasons[0]);
    const blockerLine = state.scope_frozen
      ? `I froze the human-facing scope, but I could not complete the durable handoff truthfully because ${blockerClause}`
      : `I could not complete the next step truthfully because ${blockerClause}`;
    sections.push(ensureTerminalPunctuation(blockerLine));
  } else {
    sections.push([
      state.scope_frozen
        ? "I froze the human-facing scope, but I could not complete the durable handoff truthfully because:"
        : "I could not complete the next step truthfully because:",
      ...state.reasons.map((reason) => `- ${trimTrailingPunctuation(reason)}`),
    ].join("\n"));
  }

  if (state.next_safe_move) {
    sections.push(state.next_safe_move);
  }

  return sections.join("\n\n");
}

function renderNaturalRecap(
  scope: ConversationScopeProjection,
  options: { include_details: boolean },
): string {
  const sentences: string[] = [];

  if (scope.topic) {
    sentences.push(ensureSentence(`I understand the request is about ${trimTrailingPunctuation(scope.topic)}`));
  }

  if (scope.goal) {
    sentences.push(ensureSentence(`The goal is ${trimTrailingPunctuation(scope.goal)}`));
  }

  if (scope.success_view) {
    sentences.push(ensureSentence(`I would consider this working when ${trimTrailingPunctuation(scope.success_view)}`));
  } else if (scope.expected_result) {
    sentences.push(ensureSentence(`The result should be ${normalizeNounPhrase(scope.expected_result)}`));
  }

  if (options.include_details && scope.major_parts.length > 0) {
    sentences.push(ensureSentence(`The main parts are ${joinHumanList(scope.major_parts)}`));
  }

  if (options.include_details && scope.boundaries.length > 0) {
    sentences.push(ensureSentence(`For now, this stays within ${joinHumanList(scope.boundaries)}`));
  }

  return sentences.join(" ");
}

function joinHumanList(items: string[]): string {
  if (items.length === 0) {
    return "";
  }
  if (items.length === 1) {
    return trimTrailingPunctuation(items[0]);
  }
  if (items.length === 2) {
    return `${trimTrailingPunctuation(items[0])} and ${trimTrailingPunctuation(items[1])}`;
  }
  return `${items.slice(0, -1).map(trimTrailingPunctuation).join(", ")}, and ${trimTrailingPunctuation(items.at(-1) ?? "")}`;
}

function ensureSentence(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) {
    return "";
  }
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function normalizeNounPhrase(text: string): string {
  const trimmed = trimTrailingPunctuation(text);
  if (!trimmed) {
    return trimmed;
  }
  return trimmed[0].toLowerCase() + trimmed.slice(1);
}

function toClause(text: string): string {
  const trimmed = trimTrailingPunctuation(text);
  if (!trimmed) {
    return trimmed;
  }
  return trimmed[0].toLowerCase() + trimmed.slice(1);
}

function trimTrailingPunctuation(text: string): string {
  return text.trim().replace(/[.!?]+$/u, "");
}

function ensureTerminalPunctuation(text: string): string {
  const trimmed = text.trim();
  return /[.!?)]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}
