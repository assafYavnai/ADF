import test from "node:test";
import assert from "node:assert/strict";
import { createEvent, createThread, serializeForLLM, getLatestSessionHandles } from "./thread.js";

test("serializeForLLM compacts around the latest state commit", () => {
  const thread = createThread();
  thread.events.push(
    createEvent("state_commit", {
      summary: "checkpoint",
      openLoops: ["loop-a"],
      decisions: ["decision-a"],
      sessionHandles: {
        classifier: {
          provider: "codex",
          model: "gpt-5.3-codex-spark",
          session_id: "11111111-1111-1111-1111-111111111111",
          source: "provider_returned",
        },
        intelligence: {
          provider: "codex",
          model: "gpt-5.4",
          session_id: "22222222-2222-2222-2222-222222222222",
          source: "caller_assigned",
        },
      },
    })
  );

  for (let i = 0; i < 20; i++) {
    thread.events.push(createEvent("user_input", { message: `recent-${i}` }));
  }

  const serialized = serializeForLLM(thread);

  assert.match(serialized, /<state_commit>/);
  assert.match(serialized, /recent-19/);
  assert.ok(!serialized.includes("recent-0"));
});

test("getLatestSessionHandles returns the latest checkpointed session handles", () => {
  const thread = createThread();
  thread.events.push(
    createEvent("state_commit", {
      summary: "checkpoint",
      openLoops: [],
      decisions: [],
      sessionHandles: {
        classifier: {
          provider: "claude",
          model: "sonnet",
          session_id: "33333333-3333-3333-3333-333333333333",
          source: "manual_recovery",
        },
      },
    })
  );

  const handles = getLatestSessionHandles(thread);
  assert.equal(handles.classifier?.session_id, "33333333-3333-3333-3333-333333333333");
});

test("createThread preserves explicit scope path", () => {
  const thread = createThread("assafyavnai/shippingagent/phase1-baseline");
  assert.equal(thread.scopePath, "assafyavnai/shippingagent/phase1-baseline");
});

test("serializeForLLM includes active onion workflow state and latest onion turn result summary", () => {
  const thread = createThread("assafyavnai/shippingagent/phase1-onion");
  const onionState = {
    trace_id: "onion::thread-test",
    last_turn_id: "turn-001",
    lifecycle_status: "active" as const,
    current_layer: "goal" as const,
    selected_next_question: "Why do you want this feature?",
    no_question_reason: null,
    state: {
      topic: "Execution monitor for ADF",
      goal: "",
      expected_result: "",
      success_view: "",
      major_parts: [],
      part_clarifications: {},
      experience_ui: {
        relevant: null,
        preview_status: "not_needed" as const,
      },
      boundaries: [],
      open_decisions: [],
      freeze_status: {
        status: "draft" as const,
        blockers: [],
      },
      approved_snapshot: null,
    },
    working_artifact: {
      schema_version: "1.0" as const,
      artifact_kind: "working_scope" as const,
      topic: "Execution monitor for ADF",
      goal: "",
      expected_result: "",
      success_view: "",
      major_parts: [],
      part_clarifications: {},
      experience_ui: {
        relevant: null,
        preview_status: "not_needed" as const,
      },
      boundaries: [],
      open_decisions: [],
      freeze_status: {
        status: "draft" as const,
        blockers: [],
      },
      approved_snapshot: null,
      scope_summary: [
        "Topic: Execution monitor for ADF",
        "Goal: missing",
      ],
    },
    requirement_artifact: null,
    finalized_requirement_memory_id: null,
    latest_audit_trace: {
      trace_id: "onion::thread-test",
      turn_id: "turn-001",
      current_layer: "goal" as const,
      workflow_step: "clarification",
      decision_reason: "The business goal is still missing.",
      selected_next_question: "Why do you want this feature?",
      no_question_reason: null,
      freeze_blockers: ["Outer-shell field \"goal\" is still missing."],
      open_decisions_snapshot: [],
      artifact_change_summary: ["Updated topic."],
      result_status: "clarification_needed",
    },
    latest_llm_calls: [],
    latest_persistence_receipts: [],
  };
  thread.workflowState = {
    active_workflow: "requirements_gathering_onion",
    onion: onionState,
  };
  thread.events.push(
    createEvent("onion_turn_result", {
      trace_id: "onion::thread-test",
      turn_id: "turn-001",
      lifecycle_status: "active",
      current_layer: "goal",
      state: onionState.state,
      working_artifact: onionState.working_artifact,
      requirement_artifact: null,
      finalized_requirement_memory_id: null,
      workflow_trace: onionState.latest_audit_trace,
      operation_records: [],
      llm_calls: [],
      persistence_receipts: [],
      state_commit_summary: "Requirements-gathering onion advanced without silently freezing.",
      open_loops: ["Why do you want this feature?"],
    })
  );

  const serialized = serializeForLLM(thread);

  assert.match(serialized, /<workflow_state>/);
  assert.match(serialized, /Workflow owner: requirements_gathering_onion \(active\)/);
  assert.match(serialized, /Next question: Why do you want this feature\?/);
  assert.match(serialized, /<onion_turn_result>/);
});

test("serializeForLLM keeps frozen onion scope visible after handoff_ready", () => {
  const thread = createThread("assafyavnai/shippingagent/phase1-onion");
  thread.workflowState = {
    active_workflow: null,
    onion: {
      trace_id: "onion::thread-test-frozen",
      last_turn_id: "turn-010",
      lifecycle_status: "handoff_ready",
      current_layer: "approved",
      selected_next_question: null,
      no_question_reason: "Scope is frozen and ready for handoff.",
      state: {
        topic: "Execution monitor for ADF",
        goal: "See the system status now.",
        expected_result: "A local URL with live updates.",
        success_view: "I can open the page and drill into queue details.",
        major_parts: [
          { id: "queue_view", label: "Queue view", order: 0 },
        ],
        part_clarifications: {},
        experience_ui: {
          relevant: true,
          summary: "Single page dashboard",
          preview_status: "preview_approved",
          preview_artifact: "mockup://execution-monitor-v1",
          approval_notes: "Approved",
        },
        boundaries: [],
        open_decisions: [],
        freeze_status: {
          status: "approved",
          blockers: [],
          ready_since_turn_id: "turn-009",
          approved_turn_id: "turn-010",
          approval_note: "Freeze approved",
        },
        approved_snapshot: {
          approved_turn_id: "turn-010",
          approved_at: "2026-04-02T18:53:09.739Z",
          topic: "Execution monitor for ADF",
          goal: "See the system status now.",
          expected_result: "A local URL with live updates.",
          success_view: "I can open the page and drill into queue details.",
          major_parts: [
            { id: "queue_view", label: "Queue view", order: 0 },
          ],
          part_clarifications: {},
          experience_ui: {
            relevant: true,
            summary: "Single page dashboard",
            preview_status: "preview_approved",
            preview_artifact: "mockup://execution-monitor-v1",
            approval_notes: "Approved",
          },
          boundaries: [],
          open_decisions: [],
        },
      },
      working_artifact: {
        schema_version: "1.0",
        artifact_kind: "working_scope",
        topic: "Execution monitor for ADF",
        goal: "See the system status now.",
        expected_result: "A local URL with live updates.",
        success_view: "I can open the page and drill into queue details.",
        major_parts: [
          { id: "queue_view", label: "Queue view", order: 0 },
        ],
        part_clarifications: {},
        experience_ui: {
          relevant: true,
          summary: "Single page dashboard",
          preview_status: "preview_approved",
          preview_artifact: "mockup://execution-monitor-v1",
          approval_notes: "Approved",
        },
        boundaries: [],
        open_decisions: [],
        freeze_status: {
          status: "approved",
          blockers: [],
          ready_since_turn_id: "turn-009",
          approved_turn_id: "turn-010",
          approval_note: "Freeze approved",
        },
        approved_snapshot: {
          approved_turn_id: "turn-010",
          approved_at: "2026-04-02T18:53:09.739Z",
          topic: "Execution monitor for ADF",
          goal: "See the system status now.",
          expected_result: "A local URL with live updates.",
          success_view: "I can open the page and drill into queue details.",
          major_parts: [
            { id: "queue_view", label: "Queue view", order: 0 },
          ],
          part_clarifications: {},
          experience_ui: {
            relevant: true,
            summary: "Single page dashboard",
            preview_status: "preview_approved",
            preview_artifact: "mockup://execution-monitor-v1",
            approval_notes: "Approved",
          },
          boundaries: [],
          open_decisions: [],
        },
        scope_summary: [
          "Topic: Execution monitor for ADF",
          "Goal: See the system status now.",
        ],
      },
      requirement_artifact: null,
      finalized_requirement_memory_id: "11111111-1111-4111-8111-111111111111",
      latest_audit_trace: {
        trace_id: "onion::thread-test-frozen",
        turn_id: "turn-010",
        current_layer: "approved",
        workflow_step: "freeze_approved",
        decision_reason: "Explicit freeze approval was recorded.",
        selected_next_question: null,
        no_question_reason: "Scope is frozen and ready for handoff.",
        freeze_blockers: [],
        open_decisions_snapshot: [],
        artifact_change_summary: ["Recorded explicit whole-onion freeze approval."],
        result_status: "frozen",
      },
      latest_llm_calls: [],
      latest_persistence_receipts: [],
    },
  };

  const serialized = serializeForLLM(thread);

  assert.match(serialized, /Workflow owner: requirements_gathering_onion \(persisted\)/);
  assert.match(serialized, /Lifecycle status: handoff_ready/);
  assert.match(serialized, /Topic: Execution monitor for ADF/);
  assert.match(serialized, /Approved snapshot turn id: turn-010/);
  assert.match(serialized, /Finalized requirement memory id: 11111111-1111-4111-8111-111111111111/);
});
