import { z } from "zod";
import {
  MajorPart,
  OnionLayer,
  OnionState,
  hasMeaningfulText,
  type OnionState as OnionStateType,
} from "../contracts/onion-state.js";
import {
  runTimedOperation,
  type OnionOperationRecord,
  type OperationClock,
} from "../contracts/onion-observability.js";

export const ClarificationQuestionTarget = z.enum([
  "topic",
  "goal",
  "expected_result",
  "success_view",
  "major_parts",
  "part_clarification",
  "experience_ui",
  "experience_ui_preview",
  "boundaries",
  "open_decision",
]);
export type ClarificationQuestionTarget = z.infer<typeof ClarificationQuestionTarget>;

export const ClarificationQuestion = z.object({
  target: ClarificationQuestionTarget,
  part_id: z.string().optional(),
  question: z.string(),
  reason: z.string(),
});
export type ClarificationQuestion = z.infer<typeof ClarificationQuestion>;

export const ClarificationSelection = z.object({
  current_layer: OnionLayer,
  next_question: ClarificationQuestion.nullable(),
  no_question_reason: z.string().nullable(),
  decision_reason: z.string(),
});
export type ClarificationSelection = z.infer<typeof ClarificationSelection>;

export function getMissingOuterShellFields(stateInput: OnionStateType): Array<"topic" | "goal" | "expected_result" | "success_view"> {
  const state = OnionState.parse(stateInput);
  const missing: Array<"topic" | "goal" | "expected_result" | "success_view"> = [];

  if (!hasMeaningfulText(state.topic)) {
    missing.push("topic");
  }
  if (!hasMeaningfulText(state.goal)) {
    missing.push("goal");
  }
  if (!hasMeaningfulText(state.expected_result)) {
    missing.push("expected_result");
  }
  if (!hasMeaningfulText(state.success_view)) {
    missing.push("success_view");
  }

  return missing;
}

export function getPartsNeedingClarification(stateInput: OnionStateType): MajorPart[] {
  const state = OnionState.parse(stateInput);

  return state.major_parts.filter((part) => {
    const clarification = state.part_clarifications[part.id];
    return !clarification || clarification.status !== "clarified" || !hasMeaningfulText(clarification.detail);
  });
}

export function determineCurrentLayer(stateInput: OnionStateType): z.infer<typeof OnionLayer> {
  const state = OnionState.parse(stateInput);
  const missingOuterShell = getMissingOuterShellFields(state);
  if (state.freeze_status.status === "approved" && state.approved_snapshot) {
    return "approved";
  }
  if (missingOuterShell.length > 0) {
    return missingOuterShell[0];
  }
  if (state.major_parts.length === 0) {
    return "major_parts";
  }
  if (getPartsNeedingClarification(state).length > 0) {
    return "part_clarification";
  }
  if (state.experience_ui.relevant === null) {
    return "experience_ui";
  }
  if (state.experience_ui.relevant) {
    if (!hasMeaningfulText(state.experience_ui.summary ?? "")) {
      return "experience_ui";
    }
    if (state.experience_ui.preview_status !== "preview_approved") {
      return "experience_ui";
    }
  }
  if (state.boundaries.length === 0) {
    return "boundaries";
  }
  if (state.open_decisions.some((decision) => decision.status === "open")) {
    return "open_decisions";
  }
  return "whole_onion_freeze";
}

export function selectNextClarificationQuestionPure(stateInput: OnionStateType): ClarificationSelection {
  const state = OnionState.parse(stateInput);
  const currentLayer = determineCurrentLayer(state);

  switch (currentLayer) {
    case "topic":
      return {
        current_layer: currentLayer,
        next_question: {
          target: "topic",
          question: "What are we trying to build?",
          reason: "The outer shell cannot progress until the feature topic is explicit.",
        },
        no_question_reason: null,
        decision_reason: "The feature topic is still missing.",
      };
    case "goal":
      return {
        current_layer: currentLayer,
        next_question: {
          target: "goal",
          question: `Why do you want ${state.topic}?`,
          reason: "The business goal must be explicit before deeper scope shaping.",
        },
        no_question_reason: null,
        decision_reason: "The business goal is still missing.",
      };
    case "expected_result":
      return {
        current_layer: currentLayer,
        next_question: {
          target: "expected_result",
          question: "When this work is done, what should exist?",
          reason: "The expected result is required before asking about deeper parts.",
        },
        no_question_reason: null,
        decision_reason: "The expected result is still missing.",
      };
    case "success_view":
      return {
        current_layer: currentLayer,
        next_question: {
          target: "success_view",
          question: "How will you recognize that this works from your point of view?",
          reason: "The CEO-facing success view must be explicit before moving inward.",
        },
        no_question_reason: null,
        decision_reason: "The success view is still missing.",
      };
    case "major_parts":
      return {
        current_layer: currentLayer,
        next_question: {
          target: "major_parts",
          question: "What are the main parts of this feature?",
          reason: "Major parts must be defined before per-part clarification.",
        },
        no_question_reason: null,
        decision_reason: "The outer shell is clear enough; the main capability list is still missing.",
      };
    case "part_clarification": {
      const nextPart = getPartsNeedingClarification(state)[0];
      return {
        current_layer: currentLayer,
        next_question: {
          target: "part_clarification",
          part_id: nextPart.id,
          question: `For "${nextPart.label}", what does this part mean in business terms?`,
          reason: "The smallest next question is the first unclarified major part.",
        },
        no_question_reason: null,
        decision_reason: `Major part "${nextPart.label}" still needs clarification.`,
      };
    }
    case "experience_ui":
      if (state.experience_ui.relevant === null) {
        return {
          current_layer: currentLayer,
          next_question: {
            target: "experience_ui",
            question: "Does UI or user-experience meaning matter to this scope before freeze?",
            reason: "UI alignment is only required when the feature meaning depends on it.",
          },
          no_question_reason: null,
          decision_reason: "The role of UI/experience is still unknown.",
        };
      }
      if (!hasMeaningfulText(state.experience_ui.summary ?? "")) {
        return {
          current_layer: currentLayer,
          next_question: {
            target: "experience_ui",
            question: "What should the user see and do when using this feature?",
            reason: "UI meaning matters and needs an explicit working summary before freeze.",
          },
          no_question_reason: null,
          decision_reason: "UI matters here, but the user experience is still underspecified.",
        };
      }
      return {
        current_layer: currentLayer,
        next_question: {
          target: "experience_ui_preview",
          question: "Should we treat the current preview or mockup direction as the alignment target before freeze?",
          reason: "When UI meaning matters, the preview loop must be closed explicitly.",
        },
        no_question_reason: null,
        decision_reason: "UI meaning is present, but the preview loop is not approved yet.",
      };
    case "boundaries":
      return {
        current_layer: currentLayer,
        next_question: {
          target: "boundaries",
          question: "What boundaries, non-goals, or constraints should be explicit before freeze?",
          reason: "The freeze gate requires explicit boundaries and constraints.",
        },
        no_question_reason: null,
        decision_reason: "Boundaries and constraints are still missing.",
      };
    case "open_decisions": {
      const nextDecision = state.open_decisions.find((decision) => decision.status === "open");
      return {
        current_layer: currentLayer,
        next_question: {
          target: "open_decision",
          question: nextDecision?.question ?? "Which remaining business decision still needs a CEO answer?",
          reason: "Open business decisions must be explicit and resolved before freeze.",
        },
        no_question_reason: null,
        decision_reason: `Open business decision "${nextDecision?.id ?? "unknown"}" still blocks freeze.`,
      };
    }
    case "whole_onion_freeze":
      return {
        current_layer: currentLayer,
        next_question: null,
        no_question_reason: "Clarification is complete. The next step is an explicit whole-onion freeze request.",
        decision_reason: "The onion is coherent enough to request freeze approval.",
      };
    case "approved":
      return {
        current_layer: currentLayer,
        next_question: null,
        no_question_reason: "The onion is already frozen and approved.",
        decision_reason: "No further clarification is needed on the approved human scope.",
      };
  }
}

export function selectNextClarificationQuestion(input: {
  trace_id: string;
  turn_id: string;
  state: OnionStateType;
  clock?: OperationClock;
}): {
  selection: ClarificationSelection;
  record: OnionOperationRecord;
} {
  const timed = runTimedOperation({
    trace_id: input.trace_id,
    turn_id: input.turn_id,
    operation: "clarification_policy",
    clock: input.clock,
    input_summary: {
      current_layer: determineCurrentLayer(input.state),
      major_part_count: OnionState.parse(input.state).major_parts.length,
      open_decision_count: OnionState.parse(input.state).open_decisions.filter((decision) => decision.status === "open").length,
    },
    execute: () => selectNextClarificationQuestionPure(input.state),
    summarize_output: (selection) => ({
      current_layer: selection.current_layer,
      has_question: selection.next_question !== null,
      next_target: selection.next_question?.target ?? "none",
    }),
  });

  return {
    selection: timed.result,
    record: timed.record,
  };
}
