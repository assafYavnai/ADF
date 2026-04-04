import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { access, mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createLLMProvenance, createSystemProvenance } from "../../../shared/provenance/types.js";
import type { InvocationParams, InvocationResult } from "../../../shared/llm-invoker/types.js";
import { close as closeTelemetry, configureSink, resetForTests as resetTelemetryForTests } from "../../../shared/telemetry/collector.js";
import { createThread, createEvent, FileSystemThreadStore } from "../../controller/thread.js";
import { buildWorkingScopeArtifact } from "../contracts/onion-artifact.js";
import { OnionWorkflowThreadState } from "../contracts/onion-live.js";
import { handleRequirementsGatheringOnion } from "./onion-live.js";

function buildReadyToFreezeState() {
  return {
    topic: "COO Freeze To CTO Admission Wiring",
    goal: "Persist CTO admission artifacts directly from the live freeze path.",
    expected_result: "The live COO route writes the CTO admission packet under the feature root.",
    success_view: "The thread carries explicit admission status and the artifact files exist on disk.",
    major_parts: [
      { id: "handoff", label: "Live handoff", order: 0 },
      { id: "artifacts", label: "Artifact persistence", order: 1 },
    ],
    part_clarifications: {
      handoff: {
        part_id: "handoff",
        detail: "Use the real finalized requirement artifact from the live freeze path.",
        questions_answered: ["What source should power the admission packet?"],
        status: "clarified" as const,
      },
      artifacts: {
        part_id: "artifacts",
        detail: "Persist the request, decision template, and summary under the deterministic feature root.",
        questions_answered: ["Which CTO admission artifacts must be written?"],
        status: "clarified" as const,
      },
    },
    experience_ui: {
      relevant: false,
      preview_status: "not_needed" as const,
    },
    boundaries: [
      { id: "no_queue_engine", kind: "non_goal" as const, statement: "Do not build a queue engine in this slice." },
      { id: "coo_owned_state", kind: "constraint" as const, statement: "Persist admission lifecycle facts in COO-owned state." },
    ],
    open_decisions: [],
    freeze_status: {
      status: "ready_to_request" as const,
      blockers: [],
      ready_since_turn_id: "turn-009",
    },
    approved_snapshot: null,
  };
}

function buildInvocationResult(params: InvocationParams, response: string): InvocationResult {
  const provenance = createLLMProvenance(
    randomUUID(),
    params.cli,
    params.model,
    params.reasoning ?? params.effort ?? "medium",
    false,
    params.source_path,
  );
  const usage = {
    prompt_chars: params.prompt.length,
    response_chars: response.length,
    tokens_in_estimated: Math.max(1, Math.ceil(params.prompt.length / 4)),
    tokens_out_estimated: Math.max(1, Math.ceil(response.length / 4)),
    estimated_cost_usd: 0.0005,
    token_estimation_basis: "char_heuristic_v1" as const,
    cost_estimation_basis: "test-proof",
  };

  return {
    provenance,
    response,
    latency_ms: 7,
    session: null,
    usage,
    attempts: [
      {
        provenance,
        latency_ms: 7,
        success: true,
        session_status: "none",
        usage,
      },
    ],
  };
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

test("freeze approval wires the finalized requirement into persisted CTO admission state", async (t) => {
  resetTelemetryForTests();
  configureSink(async () => {});
  t.after(async () => {
    await closeTelemetry({ timeoutMs: 100 });
    resetTelemetryForTests();
  });

  const projectRoot = await mkdtemp(join(tmpdir(), "adf-onion-live-cto-admission-"));
  await mkdir(join(projectRoot, "docs", "phase1"), { recursive: true });
  const threadsDir = join(projectRoot, "threads");
  const store = new FileSystemThreadStore(threadsDir);
  const thread = createThread("assafyavnai/adf/coo-freeze-to-cto-admission-wiring");
  const readyState = buildReadyToFreezeState();
  const workingArtifact = buildWorkingScopeArtifact(readyState);

  thread.workflowState = {
    active_workflow: "requirements_gathering_onion",
    onion: OnionWorkflowThreadState.parse({
      trace_id: "onion::cto-admission-live-test",
      last_turn_id: "turn-009",
      lifecycle_status: "awaiting_freeze_approval",
      current_layer: "whole_onion_freeze",
      selected_next_question: "Approve freezing the whole scope?",
      no_question_reason: null,
      state: readyState,
      working_artifact: workingArtifact,
      requirement_artifact: null,
      finalized_requirement_memory_id: null,
      cto_admission: null,
      latest_audit_trace: {
        trace_id: "onion::cto-admission-live-test",
        turn_id: "turn-009",
        current_layer: "whole_onion_freeze",
        workflow_step: "freeze_requested",
        decision_reason: "The scope is ready for explicit freeze approval.",
        selected_next_question: "Approve freezing the whole scope?",
        no_question_reason: null,
        freeze_blockers: [],
        open_decisions_snapshot: [],
        artifact_change_summary: ["Prepared the whole-onion freeze request."],
        result_status: "freeze_requested",
      },
      latest_llm_calls: [],
      latest_persistence_receipts: [],
    }),
  };
  thread.events.push(
    createEvent(
      "user_input",
      { message: "Approve the freeze and build the CTO admission packet." },
      createSystemProvenance("COO/requirements-gathering/live/onion-live.test"),
    ),
  );

  const finalizedRequirementMemoryId = "22222222-2222-4222-8222-222222222222";
  const result = await handleRequirementsGatheringOnion({
    userMessage: "Approve the freeze and build the CTO admission packet.",
    thread,
    store,
    config: {
      projectRoot,
      telemetryPartition: "proof",
      intelligenceParams: {
        cli: "codex",
        model: "gpt-5.4",
        reasoning: "medium",
        timeout_ms: 5_000,
      },
      invokeLLM: async (params) => buildInvocationResult(
        params,
        JSON.stringify({
          freeze_response: {
            action: "approve",
            note: "Approved for CTO admission handoff.",
          },
        }),
      ),
      brainCreateFinalizedRequirementCandidate: async () => ({
        id: finalizedRequirementMemoryId,
      }),
      brainManageMemory: async () => ({
        success: true,
        status: "locked",
        affected_rows: 1,
      }),
      brainPublishFinalizedRequirement: async () => ({
        success: true,
        status: "locked",
        affected_rows: 1,
      }),
    },
  });

  const onion = thread.workflowState.onion;
  assert.ok(onion);
  assert.equal(onion.lifecycle_status, "handoff_ready");
  assert.equal(onion.finalized_requirement_memory_id, finalizedRequirementMemoryId);
  assert.ok(onion.cto_admission);
  assert.equal(onion.cto_admission?.status, "admission_pending_decision");
  assert.equal(onion.cto_admission?.partition, "proof");
  assert.equal(onion.cto_admission?.kpi.finalized_requirement_handoff_count, 1);
  assert.ok(onion.latest_persistence_receipts.some((receipt) => receipt.kind === "cto_admission_build" && receipt.success));
  assert.ok(
    onion.latest_persistence_receipts.some(
      (receipt) => receipt.kind === "cto_admission_artifact_persist" && receipt.success,
    ),
  );
  assert.match(result.response, /CTO admission artifacts are built/i);

  const requestPath = onion.cto_admission?.artifact_paths.request_json;
  const decisionTemplatePath = onion.cto_admission?.artifact_paths.decision_template_json;
  const summaryPath = onion.cto_admission?.artifact_paths.summary_md;
  assert.ok(requestPath);
  assert.ok(decisionTemplatePath);
  assert.ok(summaryPath);

  const request = JSON.parse(await readFile(resolve(projectRoot, requestPath), "utf-8")) as Record<string, unknown>;
  const decisionTemplate = JSON.parse(await readFile(resolve(projectRoot, decisionTemplatePath), "utf-8")) as Record<string, unknown>;
  const summary = await readFile(resolve(projectRoot, summaryPath), "utf-8");

  assert.equal(request.partition, "proof");
  assert.equal(
    request.requirement_artifact_source,
    `memory://finalized-requirement/${finalizedRequirementMemoryId}`,
  );
  assert.equal(decisionTemplate.decision, null);
  assert.match(summary, /\*\*Decision:\*\* pending/);

  const latestOnionTurn = [...thread.events].reverse().find((event) => event.type === "onion_turn_result");
  assert.ok(latestOnionTurn);
  if (latestOnionTurn?.type === "onion_turn_result") {
    assert.equal(latestOnionTurn.data.cto_admission?.status, "admission_pending_decision");
  }
});

test("proof freeze approval fails closed on a repo-like project root", async (t) => {
  resetTelemetryForTests();
  configureSink(async () => {});
  t.after(async () => {
    await closeTelemetry({ timeoutMs: 100 });
    resetTelemetryForTests();
  });

  const projectRoot = await mkdtemp(join(tmpdir(), "adf-onion-live-cto-admission-proof-root-"));
  await mkdir(join(projectRoot, "docs", "phase1"), { recursive: true });
  await writeFile(join(projectRoot, "AGENTS.md"), "# test\n", "utf-8");
  await mkdir(join(projectRoot, "COO"), { recursive: true });
  await writeFile(join(projectRoot, "COO", "package.json"), "{\n  \"name\": \"coo\"\n}\n", "utf-8");
  await mkdir(join(projectRoot, "components", "memory-engine"), { recursive: true });
  await writeFile(
    join(projectRoot, "components", "memory-engine", "package.json"),
    "{\n  \"name\": \"memory-engine\"\n}\n",
    "utf-8",
  );

  const threadsDir = join(projectRoot, "threads");
  const store = new FileSystemThreadStore(threadsDir);
  const thread = createThread("assafyavnai/adf/coo-freeze-to-cto-admission-wiring");
  const readyState = buildReadyToFreezeState();
  const workingArtifact = buildWorkingScopeArtifact(readyState);

  thread.workflowState = {
    active_workflow: "requirements_gathering_onion",
    onion: OnionWorkflowThreadState.parse({
      trace_id: "onion::cto-admission-proof-root-test",
      last_turn_id: "turn-009",
      lifecycle_status: "awaiting_freeze_approval",
      current_layer: "whole_onion_freeze",
      selected_next_question: "Approve freezing the whole scope?",
      no_question_reason: null,
      state: readyState,
      working_artifact: workingArtifact,
      requirement_artifact: null,
      finalized_requirement_memory_id: null,
      cto_admission: null,
      latest_audit_trace: {
        trace_id: "onion::cto-admission-proof-root-test",
        turn_id: "turn-009",
        current_layer: "whole_onion_freeze",
        workflow_step: "freeze_requested",
        decision_reason: "The scope is ready for explicit freeze approval.",
        selected_next_question: "Approve freezing the whole scope?",
        no_question_reason: null,
        freeze_blockers: [],
        open_decisions_snapshot: [],
        artifact_change_summary: ["Prepared the whole-onion freeze request."],
        result_status: "freeze_requested",
      },
      latest_llm_calls: [],
      latest_persistence_receipts: [],
    }),
  };
  thread.events.push(
    createEvent(
      "user_input",
      { message: "Approve the freeze and build the CTO admission packet." },
      createSystemProvenance("COO/requirements-gathering/live/onion-live.test"),
    ),
  );

  const finalizedRequirementMemoryId = "33333333-3333-4333-8333-333333333333";
  const result = await handleRequirementsGatheringOnion({
    userMessage: "Approve the freeze and build the CTO admission packet.",
    thread,
    store,
    config: {
      projectRoot,
      telemetryPartition: "proof",
      intelligenceParams: {
        cli: "codex",
        model: "gpt-5.4",
        reasoning: "medium",
        timeout_ms: 5_000,
      },
      invokeLLM: async (params) => buildInvocationResult(
        params,
        JSON.stringify({
          freeze_response: {
            action: "approve",
            note: "Approved for CTO admission handoff.",
          },
        }),
      ),
      brainCreateFinalizedRequirementCandidate: async () => ({
        id: finalizedRequirementMemoryId,
      }),
      brainManageMemory: async () => ({
        success: true,
        status: "locked",
        affected_rows: 1,
      }),
      brainPublishFinalizedRequirement: async () => ({
        success: true,
        status: "locked",
        affected_rows: 1,
      }),
    },
  });

  const onion = thread.workflowState.onion;
  assert.ok(onion?.cto_admission);
  assert.equal(onion?.cto_admission?.status, "admission_build_failed");
  assert.equal(onion?.cto_admission?.outcome, "admitted");
  assert.match(onion?.cto_admission?.last_error ?? "", /isolated temp project root/i);
  assert.ok(
    onion?.latest_persistence_receipts.some(
      (receipt) => receipt.kind === "cto_admission_artifact_persist" && receipt.success === false,
    ),
  );
  assert.match(result.response, /CTO admission build failed/i);
  assert.equal(
    await pathExists(resolve(projectRoot, "docs", "phase1", "coo-freeze-to-cto-admission-wiring", "cto-admission-request.json")),
    false,
  );
});
