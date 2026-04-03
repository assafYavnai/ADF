import test from "node:test";
import assert from "node:assert/strict";
import type { OnionPersistenceReceipt as OnionPersistenceReceiptType } from "../contracts/onion-live.js";
import {
  createApprovedOnionSnapshot,
  createEmptyOnionState,
} from "../contracts/onion-state.js";
import { deriveConversationState } from "./conversation-state.js";
import { renderConversationResponse } from "./conversation-renderer.js";

function createFullScopeState() {
  const state = createEmptyOnionState();
  state.topic = "Execution monitor for ADF";
  state.goal = "see the current implementation queue and drill into active work";
  state.expected_result = "a local URL that shows the current system status with live updates";
  state.success_view = "I can open the page, see the queue, and drill into current execution details";
  state.major_parts = [
    { id: "queue_view", label: "Queue view", order: 0 },
    { id: "node_details", label: "Node details", order: 1 },
  ];
  state.boundaries = [
    { id: "phase1_queue", kind: "constraint", statement: "Phase 1 focuses on the implementation queue first" },
  ];
  state.experience_ui = {
    relevant: true,
    summary: "A single-page dashboard with a queue list and a detail drawer",
    preview_status: "preview_approved",
  };
  return state;
}

function createPersistenceFailure(message: string): OnionPersistenceReceiptType {
  return {
    kind: "finalized_requirement_lock",
    target: "memory_engine",
    status: "failed",
    artifact_kind: "requirement_list",
    action: "publish_finalized_requirement",
    scope_path: "project://scope",
    record_id: null,
    duration_ms: 0,
    success: false,
    message,
  };
}

test("unclear intent asks exactly one smallest next question without slot-dump recap", () => {
  const state = deriveConversationState({
    lifecycleStatus: "active",
    state: createEmptyOnionState(),
    clarificationQuestion: "What are we trying to build?",
    freezeRequest: null,
    finalizedRequirementMemoryId: null,
    persistenceFailures: [],
    stateCommitSummary: "Requirements-gathering onion advanced without silently freezing.",
  });

  assert.equal(state.kind, "ask_smallest_question");
  const response = renderConversationResponse(state);
  assert.equal(response, "What are we trying to build?");
  assert.doesNotMatch(response, /Topic:|Goal:|Expected result:/);
});

test("clear intent but missing detail reflects naturally and asks one next question", () => {
  const state = createEmptyOnionState();
  state.topic = "Execution monitor for ADF";
  state.goal = "see the current system status";

  const conversation = deriveConversationState({
    lifecycleStatus: "active",
    state,
    clarificationQuestion: "When this work is done, what should exist?",
    freezeRequest: null,
    finalizedRequirementMemoryId: null,
    persistenceFailures: [],
    stateCommitSummary: "Requirements-gathering onion advanced without silently freezing.",
  });

  assert.equal(conversation.kind, "reflect_and_confirm");
  const response = renderConversationResponse(conversation);
  assert.match(response, /I understand the request is about Execution monitor for ADF\./);
  assert.match(response, /The goal is see the current system status\./);
  assert.match(response, /When this work is done, what should exist\?/);
  assert.doesNotMatch(response, /Topic:|Goal:|Expected result:/);
});

test("ready for approval gives a concise human recap and an explicit freeze check", () => {
  const conversation = deriveConversationState({
    lifecycleStatus: "active",
    state: createFullScopeState(),
    clarificationQuestion: null,
    freezeRequest: "This is the full human-facing onion. Is anything missing or wrong, and should I freeze it now?",
    finalizedRequirementMemoryId: null,
    persistenceFailures: [],
    stateCommitSummary: "Requirements-gathering onion is ready for explicit whole-onion freeze approval.",
  });

  assert.equal(conversation.kind, "ready_for_approval");
  const response = renderConversationResponse(conversation);
  assert.match(response, /I understand the request is about Execution monitor for ADF\./);
  assert.match(response, /If that matches your intent, should I freeze this scope now\?/);
  assert.doesNotMatch(response, /Topic:|Goal:|Expected result:/);
});

test("approved scope confirms frozen state without reopening casually", () => {
  const state = createFullScopeState();
  state.freeze_status.status = "approved";
  state.approved_snapshot = createApprovedOnionSnapshot(
    state,
    "turn-009",
    "2026-04-03T10:00:00.000Z",
  );

  const conversation = deriveConversationState({
    lifecycleStatus: "handoff_ready",
    state,
    clarificationQuestion: null,
    freezeRequest: null,
    finalizedRequirementMemoryId: "7f5496b5-40a7-4bc0-b611-8810ef0f2997",
    persistenceFailures: [],
    stateCommitSummary: "Requirements-gathering onion is frozen and the finalized requirement artifact is durably stored.",
  });

  assert.equal(conversation.kind, "approved_and_frozen");
  const response = renderConversationResponse(conversation);
  assert.match(response, /The scope is frozen and the finalized requirement artifact is stored as 7f5496b5-40a7-4bc0-b611-8810ef0f2997\./);
  assert.match(response, /I will not reopen it unless you explicitly ask to change it\./);
  assert.doesNotMatch(response, /Topic:|Goal:|Expected result:/);
});

test("blocked state explains the blocker and the next safe move", () => {
  const state = createFullScopeState();
  state.freeze_status.status = "approved";

  const conversation = deriveConversationState({
    lifecycleStatus: "blocked",
    state,
    clarificationQuestion: null,
    freezeRequest: null,
    finalizedRequirementMemoryId: null,
    persistenceFailures: [
      createPersistenceFailure("Could not lock the finalized requirement artifact after approved freeze."),
    ],
    stateCommitSummary: "Requirements-gathering onion froze the human scope, but durable artifact persistence is blocked.",
  });

  assert.equal(conversation.kind, "blocked_with_reason");
  const response = renderConversationResponse(conversation);
  assert.match(response, /I froze the human-facing scope, but I could not complete the durable handoff truthfully because could not lock the finalized requirement artifact after approved freeze\./i);
  assert.match(response, /Restore the blocked route and re-run the turn once the handoff can complete truthfully\./);
  assert.doesNotMatch(response, /Topic:|Goal:|Expected result:/);
});
