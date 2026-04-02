import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { handleTurn, DEFAULT_CLASSIFIER_PARAMS, DEFAULT_INTELLIGENCE_PARAMS, type ControllerConfig } from "../../COO/controller/loop.js";
import { ThreadSchema } from "../../COO/controller/thread.js";
import { MemoryEngineClient } from "../../COO/controller/memory-engine-client.js";
import { emitInvocationTelemetry } from "../../shared/llm-invoker/invoker.js";
import type {
  InvocationAttempt,
  InvocationParams,
  InvocationResult,
  InvocationUsageEstimate,
} from "../../shared/llm-invoker/types.js";
import { createLLMProvenance } from "../../shared/provenance/types.js";
import {
  close as closeTelemetry,
  configureSink,
  resetForTests as resetTelemetryForTests,
} from "../../shared/telemetry/collector.js";
import { pool } from "../../components/memory-engine/src/db/connection.js";
import { createSystemProvenance } from "../../shared/provenance/types.js";

const repoRoot = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const artifactRoot = resolve(repoRoot, "tests", "integration", "artifacts", "onion-route-proof");
const scopedProjectPath = "assafyavnai/shippingagent";

const scenarioMessages = {
  start: "We need an execution monitor for ADF so I can see what the system is currently doing, starting with the implementation queue.",
  expectedResult: "When this is done there should be a local URL that shows the current system status with live updates.",
  successView: "Success means I can open the page, see the queue, and drill into current execution details.",
  majorParts: "The main parts are queue view, flow view, node details, audit trail, and metrics.",
  partDetails: "Queue view shows active features, current status, owner, and any blocking reason. Flow view shows the current step path, review rounds, and visible branching for parallel execution. Node details show agent output, substeps, and timing. Audit trail shows completed steps, who did them, when they finished, and why state changed. Metrics show token usage plus total and per-step timing.",
  uiAndBoundaries: "UI meaning matters. It should be a single-page dashboard with a queue list, a flow canvas, and a detail drawer. Treat mockup execution-monitor-v1 as approved. Boundaries: Phase 1 focuses on the implementation queue first. This is not a full historical analytics suite. Open decision: Should live updates use polling or push for the first release?",
  resolveDecision: "Use timed polling every 10 seconds for the first release.",
  freezeApproval: "Freeze it.",
  reopenAfterFreeze: "Do not keep it frozen. Reopen the scope so I can correct it before we freeze again.",
} as const;

const parserUpdates = new Map<string, Record<string, unknown>>([
  [
    scenarioMessages.start,
    {
      topic: "Execution monitor for ADF",
      goal: "See what the system is currently doing, starting with the implementation queue.",
    },
  ],
  [
    scenarioMessages.expectedResult,
    {
      expected_result: "A local URL that shows the current system status with live updates.",
    },
  ],
  [
    scenarioMessages.successView,
    {
      success_view: "I can open the page, see the queue, and drill into current execution details.",
    },
  ],
  [
    scenarioMessages.majorParts,
    {
      major_parts: [
        { id: "queue_view", label: "Queue view" },
        { id: "flow_view", label: "Flow view" },
        { id: "node_details", label: "Node details" },
        { id: "audit_trail", label: "Audit trail" },
        { id: "metrics", label: "Metrics" },
      ],
    },
  ],
  [
    scenarioMessages.partDetails,
    {
      part_clarifications: [
        {
          part_id: "queue_view",
          detail: "Show active features, current status, owner, and any blocking reason.",
          questions_answered: ["What belongs in the queue view?"],
        },
        {
          part_id: "flow_view",
          detail: "Show the current step path, review rounds, and visible branching for parallel execution.",
          questions_answered: ["What belongs in the flow view?"],
        },
        {
          part_id: "node_details",
          detail: "Show agent output, substeps, and timing.",
          questions_answered: ["What should node details show?"],
        },
        {
          part_id: "audit_trail",
          detail: "Show completed steps, who did them, when they finished, and why state changed.",
          questions_answered: ["What belongs in the audit trail?"],
        },
        {
          part_id: "metrics",
          detail: "Show token usage plus total and per-step timing.",
          questions_answered: ["What belongs in metrics?"],
        },
      ],
    },
  ],
  [
    scenarioMessages.uiAndBoundaries,
    {
      experience_ui: {
        relevant: true,
        summary: "A single-page dashboard with a queue list, a flow canvas, and a detail drawer.",
        preview_status: "preview_approved",
        preview_artifact: "mockup://execution-monitor-v1",
        approval_notes: "Approved as the Phase 1 alignment target.",
      },
      boundaries: [
        {
          id: "phase1_queue_first",
          kind: "constraint",
          statement: "Phase 1 focuses on the implementation queue first.",
        },
        {
          id: "no_historic_analytics",
          kind: "non_goal",
          statement: "This is not a full historical analytics suite.",
        },
      ],
      open_decisions: [
        {
          id: "live_update_model",
          question: "Should live updates use polling or push for the first release?",
          impact: "This changes the product promise and testing expectations.",
          status: "open",
        },
      ],
    },
  ],
  [
    scenarioMessages.resolveDecision,
    {
      resolve_open_decisions: [
        {
          id: "live_update_model",
          resolution: "Use timed polling every 10 seconds for the first release.",
        },
      ],
    },
  ],
  [
    scenarioMessages.freezeApproval,
    {
      freeze_response: {
        action: "approve",
        note: "The human-facing scope is right. Freeze it.",
      },
    },
  ],
  [
    scenarioMessages.reopenAfterFreeze,
    {
      freeze_response: {
        action: "reject",
        note: "Reopening the frozen scope for corrections.",
      },
    },
  ],
]);

interface StubInvoker {
  invocationIds: string[];
  invoke: (params: InvocationParams) => Promise<InvocationResult>;
}

function createStubInvoker(): StubInvoker {
  const invocationIds: string[] = [];
  let sessionCounter = 0;

  return {
    invocationIds,
    async invoke(params) {
      const response = buildStubResponse(params);
      const usage = estimateUsage(params.prompt, response);
      const invocationId = randomUUID();
      const latencyMs = params.source_path.startsWith("COO/classifier/classify/") ? 11 : 23;
      const provenance = createLLMProvenance(
        invocationId,
        params.cli,
        params.model,
        params.reasoning ?? params.effort ?? "default",
        false,
        params.source_path,
      );
      const sessionPersisted = Boolean(params.session?.persist);
      const attempt: InvocationAttempt = {
        provenance,
        latency_ms: latencyMs,
        success: true,
        session_status: sessionPersisted
          ? (params.session?.handle ? "resumed" : "fresh")
          : "none",
        usage,
      };
      const session = sessionPersisted
        ? {
            handle: {
              provider: params.cli,
              model: params.model,
              session_id: params.session?.handle?.session_id ?? `stub-session-${++sessionCounter}`,
              source: "provider_returned" as const,
            },
            status: params.session?.handle ? "resumed" as const : "fresh" as const,
          }
        : null;

      invocationIds.push(invocationId);
      emitInvocationTelemetry([attempt]);

      return {
        provenance,
        response,
        latency_ms: latencyMs,
        session,
        usage,
        attempts: [attempt],
      };
    },
  };
}

function buildStubResponse(params: InvocationParams): string {
  if (params.source_path.startsWith("COO/classifier/classify/")) {
    const userMessage = extractClassifierUserMessage(params.prompt);
    const onionEnabled = params.prompt.includes("requirements_gathering_onion_enabled: true");
    return JSON.stringify({
      intent: onionEnabled
        ? "continue requirements gathering"
        : "respond without entering onion while the gate is disabled",
      workflow: onionEnabled ? "requirements_gathering_onion" : "direct_coo_response",
      confidence: 0.99,
      reasoning: onionEnabled
        ? `Route "${userMessage}" into the live requirements onion lane.`
        : "The live requirements onion gate is disabled in this runtime.",
    });
  }

  if (params.source_path.includes("COO/requirements-gathering/live/turn-parser/")) {
    const userMessage = extractTagBlock(params.prompt, "ceo_message");
    const update = parserUpdates.get(userMessage);
    if (!update) {
      throw new Error(`No parser stub update exists for message: ${userMessage}`);
    }
    return JSON.stringify(update);
  }

  throw new Error(`Unexpected invoke source path in onion runtime proof: ${params.source_path}`);
}

function extractClassifierUserMessage(prompt: string): string {
  const marker = "User message:\n";
  const start = prompt.lastIndexOf(marker);
  if (start < 0) {
    throw new Error("Classifier prompt did not contain a user message block.");
  }
  const after = prompt.slice(start + marker.length);
  const end = after.indexOf("\n\nRespond with JSON only:");
  return (end >= 0 ? after.slice(0, end) : after).trim();
}

function extractTagBlock(prompt: string, tag: string): string {
  const match = new RegExp(`<${tag}>\\n([\\s\\S]*?)\\n<\\/${tag}>`).exec(prompt);
  if (!match) {
    throw new Error(`Prompt did not contain <${tag}>...</${tag}>.`);
  }
  return match[1].trim();
}

function estimateUsage(prompt: string, response: string): InvocationUsageEstimate {
  const promptChars = prompt.length;
  const responseChars = response.length;
  return {
    prompt_chars: promptChars,
    response_chars: responseChars,
    tokens_in_estimated: Math.max(1, Math.ceil(promptChars / 4)),
    tokens_out_estimated: Math.max(1, Math.ceil(responseChars / 4)),
    estimated_cost_usd: Number((((promptChars + responseChars) / 4) * 0.000005).toFixed(6)),
    token_estimation_basis: "char_heuristic_v1",
    cost_estimation_basis: "integration-test-stub",
  };
}

function createConfig(
  runtimeRoot: string,
  client: MemoryEngineClient,
  invokeLLM: (params: InvocationParams) => Promise<InvocationResult>,
  enableRequirementsGatheringOnion: boolean,
): ControllerConfig {
  return {
    projectRoot: repoRoot,
    threadsDir: join(runtimeRoot, "threads"),
    promptsDir: resolve(repoRoot, "COO", "intelligence"),
    memoryDir: join(runtimeRoot, "memory"),
    classifierParams: DEFAULT_CLASSIFIER_PARAMS,
    intelligenceParams: DEFAULT_INTELLIGENCE_PARAMS,
    brainCreateRequirement: (title, body, tags, scopePath, provenance) =>
      client.createRequirement(title, body, tags, scopePath, provenance),
    brainManageMemory: (action, memoryId, scopePath, provenance, options) =>
      client.manageMemory(action, memoryId, scopePath, provenance, options),
    enableRequirementsGatheringOnion,
    invokeLLM,
  };
}

async function openRuntimeHarness(runtimeRoot: string, enableRequirementsGatheringOnion: boolean, stubInvoker: StubInvoker) {
  resetTelemetryForTests();
  await mkdir(runtimeRoot, { recursive: true });
  const client = await MemoryEngineClient.connect(repoRoot);
  configureSink(async (events) => {
    await client.emitMetricsBatch(events);
  }, {
    outboxPath: join(runtimeRoot, "memory", "telemetry-outbox.json"),
    shutdownTimeoutMs: 5_000,
  });

  return {
    client,
    config: createConfig(runtimeRoot, client, stubInvoker.invoke, enableRequirementsGatheringOnion),
  };
}

async function closeRuntimeHarness(client: MemoryEngineClient | null): Promise<void> {
  await closeTelemetry();
  await client?.close();
  resetTelemetryForTests();
}

async function runTurns(
  config: ControllerConfig,
  scopePath: string | null,
  startingThreadId: string | null,
  messages: string[],
): Promise<{
  threadId: string;
  responses: string[];
}> {
  let threadId = startingThreadId;
  const responses: string[] = [];

  for (const message of messages) {
    const result = await handleTurn(threadId, message, config, scopePath);
    threadId = result.threadId;
    responses.push(result.response);
  }

  if (!threadId) {
    throw new Error("Expected onion runtime proof to produce a thread id.");
  }

  return { threadId, responses };
}

async function readThreadArtifacts(runtimeRoot: string, threadId: string) {
  const jsonPath = join(runtimeRoot, "threads", `${threadId}.json`);
  const txtPath = join(runtimeRoot, "threads", `${threadId}.txt`);
  const [jsonRaw, txt] = await Promise.all([
    readFile(jsonPath, "utf-8"),
    readFile(txtPath, "utf-8"),
  ]);

  return {
    jsonPath,
    txtPath,
    thread: ThreadSchema.parse(JSON.parse(jsonRaw)),
    txt,
  };
}

function getLatestOnionTurnResultEvent(thread: ReturnType<typeof ThreadSchema.parse>) {
  for (let index = thread.events.length - 1; index >= 0; index -= 1) {
    const event = thread.events[index];
    if (event.type === "onion_turn_result") {
      return event;
    }
  }
  throw new Error("Expected the thread to contain an onion_turn_result event.");
}

async function runSuccessProof(runtimeRoot: string) {
  const stubA = createStubInvoker();
  const stubB = createStubInvoker();
  let clientA: MemoryEngineClient | null = null;
  let clientB: MemoryEngineClient | null = null;

  try {
    const harnessA = await openRuntimeHarness(runtimeRoot, true, stubA);
    clientA = harnessA.client;
    const phaseOne = await runTurns(harnessA.config, scopedProjectPath, null, [
      scenarioMessages.start,
      scenarioMessages.expectedResult,
      scenarioMessages.successView,
      scenarioMessages.majorParts,
      scenarioMessages.partDetails,
    ]);

    const checkpoint = await readThreadArtifacts(runtimeRoot, phaseOne.threadId);
    assert.equal(checkpoint.thread.workflowState.active_workflow, "requirements_gathering_onion");
    assert.equal(checkpoint.thread.workflowState.onion?.current_layer, "experience_ui");
    assert.equal(
      checkpoint.thread.workflowState.onion?.selected_next_question,
      "Does UI or user-experience meaning matter to this scope before freeze?",
    );
    assert.match(checkpoint.txt, /<workflow_state>/);

    await closeRuntimeHarness(clientA);
    clientA = null;

    const harnessB = await openRuntimeHarness(runtimeRoot, true, stubB);
    clientB = harnessB.client;
    const phaseTwo = await runTurns(harnessB.config, scopedProjectPath, phaseOne.threadId, [
      scenarioMessages.uiAndBoundaries,
      scenarioMessages.resolveDecision,
      scenarioMessages.freezeApproval,
    ]);

    assert.match(
      phaseTwo.responses[0],
      /Should live updates use polling or push for the first release\?/,
    );
    assert.match(
      phaseTwo.responses[1],
      /Is anything missing or wrong, and should I freeze it now\?/,
    );
    assert.match(
      phaseTwo.responses[2],
      /I froze the requirements onion and stored the finalized requirement artifact/,
    );

    await closeTelemetry();

    const finalArtifacts = await readThreadArtifacts(runtimeRoot, phaseTwo.threadId);
    const finalOnion = finalArtifacts.thread.workflowState.onion;
    const traceId = `onion::${phaseTwo.threadId}`;
    assert.equal(finalArtifacts.thread.workflowState.active_workflow, null);
    assert.equal(finalOnion?.lifecycle_status, "handoff_ready");
    assert.equal(finalOnion?.state.freeze_status.status, "approved");
    assert.ok(finalOnion?.finalized_requirement_memory_id);
    assert.match(finalArtifacts.txt, /<thread_checkpoint>/);
    assert.match(finalArtifacts.txt, /Workflow owner: requirements_gathering_onion \(persisted\)/);
    assert.match(finalArtifacts.txt, /Approved snapshot turn id:/);

    const latestOnionTurn = getLatestOnionTurnResultEvent(finalArtifacts.thread);
    const finalizedRequirementId = latestOnionTurn.data.finalized_requirement_memory_id;
    assert.ok(finalizedRequirementId);
    assert.equal(latestOnionTurn.data.operation_records.length, 6);
    assert.equal(latestOnionTurn.data.llm_calls.length, 1);
    assert.ok(
      latestOnionTurn.data.persistence_receipts.some(
        (receipt) => receipt.kind === "finalized_requirement_create" && receipt.success,
      ),
    );
    assert.ok(
      latestOnionTurn.data.persistence_receipts.some(
        (receipt) => receipt.kind === "finalized_requirement_lock" && receipt.success,
      ),
    );

    const requirementRows = await pool.query(
      `SELECT id, content_type, trust_level, tags, source_path, content
         FROM memory_items
        WHERE id = $1`,
      [finalizedRequirementId],
    );
    assert.equal(requirementRows.rows.length, 1);
    assert.equal(requirementRows.rows[0]?.content_type, "requirement");
    assert.equal(requirementRows.rows[0]?.trust_level, "locked");
    assert.ok(requirementRows.rows[0]?.tags.includes("requirements-gathering"));
    assert.equal(
      requirementRows.rows[0]?.content?.artifact?.human_scope?.topic,
      "Execution monitor for ADF",
    );

    const llmRows = await pool.query(
      `SELECT source_path, provider, model, latency_ms, tokens_in, tokens_out
         FROM telemetry
        WHERE invocation_id = ANY($1::uuid[])
        ORDER BY created_at ASC`,
      [[...stubA.invocationIds, ...stubB.invocationIds]],
    );
    assert.ok(llmRows.rows.length >= 16);
    assert.ok(
      llmRows.rows.some((row) =>
        String(row.source_path).includes("COO/requirements-gathering/live/turn-parser/")
        && Number(row.tokens_in) > 0
        && Number(row.tokens_out) > 0,
      ),
    );

    const operationRows = await pool.query(
      `SELECT operation, latency_ms, metadata
         FROM telemetry
        WHERE metadata->>'trace_id' = $1
        ORDER BY created_at ASC`,
      [traceId],
    );
    const operations = new Set(operationRows.rows.map((row) => String(row.operation)));
    assert.deepEqual([...operations].sort(), [
      "artifact_deriver",
      "audit_trace_build",
      "clarification_policy",
      "freeze_check",
      "onion_reducer",
      "readiness_check",
    ]);

    const turnRows = await pool.query(
      `SELECT metadata
         FROM telemetry
        WHERE operation = 'handle_turn'
          AND metadata->>'thread_id' = $1
        ORDER BY created_at DESC`,
      [phaseTwo.threadId],
    );
    assert.ok(turnRows.rows.length >= 8);
    assert.equal(turnRows.rows[0]?.metadata?.workflow, "requirements_gathering_onion");

    return {
      runtime_root: runtimeRoot,
      checkpoint_thread_json_path: checkpoint.jsonPath,
      checkpoint_thread_txt_path: checkpoint.txtPath,
      final_thread_json_path: finalArtifacts.jsonPath,
      final_thread_txt_path: finalArtifacts.txtPath,
      thread_id: phaseTwo.threadId,
      trace_id: traceId,
      checkpoint_layer: checkpoint.thread.workflowState.onion?.current_layer,
      checkpoint_next_question: checkpoint.thread.workflowState.onion?.selected_next_question,
      final_lifecycle_status: finalOnion?.lifecycle_status,
      final_freeze_status: finalOnion?.state.freeze_status.status,
      finalized_requirement_memory_id: finalizedRequirementId,
      latest_persistence_receipts: latestOnionTurn.data.persistence_receipts,
      latest_operation_record_count: latestOnionTurn.data.operation_records.length,
      latest_llm_call_count: latestOnionTurn.data.llm_calls.length,
      requirement_row: requirementRows.rows[0],
      llm_telemetry_rows: llmRows.rows.length,
      sample_llm_telemetry_rows: llmRows.rows.slice(0, 4),
      onion_operation_rows: operationRows.rows.length,
      sample_onion_operation_rows: operationRows.rows.slice(0, 6),
      handle_turn_rows: turnRows.rows.length,
      final_response: phaseTwo.responses[2],
    };
  } finally {
    await closeRuntimeHarness(clientA);
    await closeRuntimeHarness(clientB);
  }
}

async function runGateDisabledProof(runtimeRoot: string) {
  const stubEnabled = createStubInvoker();
  let clientEnabled: MemoryEngineClient | null = null;
  let clientDisabled: MemoryEngineClient | null = null;

  try {
    const enabledHarness = await openRuntimeHarness(runtimeRoot, true, stubEnabled);
    clientEnabled = enabledHarness.client;
    const frozen = await runTurns(enabledHarness.config, scopedProjectPath, null, [
      scenarioMessages.start,
      scenarioMessages.expectedResult,
      scenarioMessages.successView,
      scenarioMessages.majorParts,
      scenarioMessages.partDetails,
      scenarioMessages.uiAndBoundaries,
      scenarioMessages.resolveDecision,
      scenarioMessages.freezeApproval,
    ]);
    const frozenArtifacts = await readThreadArtifacts(runtimeRoot, frozen.threadId);
    assert.equal(frozenArtifacts.thread.workflowState.active_workflow, null);
    assert.equal(frozenArtifacts.thread.workflowState.onion?.lifecycle_status, "handoff_ready");
    await closeRuntimeHarness(clientEnabled);
    clientEnabled = null;

    const disabledHarness = await openRuntimeHarness(runtimeRoot, false, createStubInvoker());
    clientDisabled = disabledHarness.client;
    const resumed = await handleTurn(
      frozen.threadId,
      scenarioMessages.reopenAfterFreeze,
      disabledHarness.config,
      scopedProjectPath,
    );
    await closeTelemetry();

    assert.match(
      resumed.response,
      /persisted requirements-gathering onion state|Re-run with --enable-onion/,
    );

    const artifacts = await readThreadArtifacts(runtimeRoot, frozen.threadId);
    assert.equal(artifacts.thread.workflowState.active_workflow, null);
    assert.equal(artifacts.thread.workflowState.onion?.lifecycle_status, "handoff_ready");
    assert.equal(artifacts.thread.workflowState.onion?.state.topic, "Execution monitor for ADF");
    assert.equal(artifacts.thread.events.at(-3)?.type, "error");
    assert.equal(artifacts.thread.events.at(-2)?.type, "coo_response");
    assert.equal(artifacts.thread.events.at(-1)?.type, "state_commit");

    const gateTelemetryRows = await pool.query(
      `SELECT metadata, success
         FROM telemetry
        WHERE operation = 'handle_turn'
          AND metadata->>'thread_id' = $1
        ORDER BY created_at DESC
        LIMIT 1`,
      [frozen.threadId],
    );
    assert.equal(gateTelemetryRows.rows.length, 1);
    assert.equal(gateTelemetryRows.rows[0]?.success, false);
    assert.equal(gateTelemetryRows.rows[0]?.metadata?.workflow, "requirements_gathering_onion");
    assert.equal(gateTelemetryRows.rows[0]?.metadata?.gate_status, "disabled");

    return {
      runtime_root: runtimeRoot,
      thread_json_path: artifacts.jsonPath,
      thread_txt_path: artifacts.txtPath,
      thread_id: frozen.threadId,
      response: resumed.response,
      active_workflow_after: artifacts.thread.workflowState.active_workflow,
      lifecycle_status_after: artifacts.thread.workflowState.onion?.lifecycle_status,
      preserved_topic: artifacts.thread.workflowState.onion?.state.topic,
      gate_turn_telemetry: gateTelemetryRows.rows[0],
    };
  } finally {
    await closeRuntimeHarness(clientEnabled);
    await closeRuntimeHarness(clientDisabled);
  }
}

async function runNoScopeProof(runtimeRoot: string) {
  const stub = createStubInvoker();
  let client: MemoryEngineClient | null = null;

  try {
    const harness = await openRuntimeHarness(runtimeRoot, true, stub);
    client = harness.client;
    const run = await runTurns(harness.config, null, null, [
      scenarioMessages.start,
      scenarioMessages.expectedResult,
      scenarioMessages.successView,
      scenarioMessages.majorParts,
      scenarioMessages.partDetails,
      scenarioMessages.uiAndBoundaries,
      scenarioMessages.resolveDecision,
      scenarioMessages.freezeApproval,
    ]);
    await closeTelemetry();

    assert.match(
      run.responses.at(-1) ?? "",
      /I froze the human-facing scope, but I could not complete the durable handoff truthfully/,
    );

    const artifacts = await readThreadArtifacts(runtimeRoot, run.threadId);
    const finalOnion = artifacts.thread.workflowState.onion;
    const latestOnionTurn = getLatestOnionTurnResultEvent(artifacts.thread);
    const failedReceipts = latestOnionTurn.data.persistence_receipts.filter((receipt) => !receipt.success);
    assert.equal(artifacts.thread.workflowState.active_workflow, "requirements_gathering_onion");
    assert.equal(finalOnion?.lifecycle_status, "blocked");
    assert.equal(finalOnion?.state.freeze_status.status, "approved");
    assert.equal(finalOnion?.finalized_requirement_memory_id, null);
    assert.ok(
      failedReceipts.some((receipt) =>
        receipt.kind === "finalized_requirement_create"
        && /without an explicit scope/i.test(receipt.message),
      ),
    );

    return {
      runtime_root: runtimeRoot,
      thread_json_path: artifacts.jsonPath,
      thread_txt_path: artifacts.txtPath,
      thread_id: run.threadId,
      response: run.responses.at(-1) ?? "",
      lifecycle_status: finalOnion?.lifecycle_status,
      freeze_status: finalOnion?.state.freeze_status.status,
      finalized_requirement_memory_id: finalOnion?.finalized_requirement_memory_id,
      failed_persistence_receipts: failedReceipts,
    };
  } finally {
    await closeRuntimeHarness(client);
  }
}

async function runSupersessionProof(runtimeRoot: string) {
  const stub = createStubInvoker();
  let client: MemoryEngineClient | null = null;

  try {
    const harness = await openRuntimeHarness(runtimeRoot, true, stub);
    client = harness.client;
    const frozen = await runTurns(harness.config, scopedProjectPath, null, [
      scenarioMessages.start,
      scenarioMessages.expectedResult,
      scenarioMessages.successView,
      scenarioMessages.majorParts,
      scenarioMessages.partDetails,
      scenarioMessages.uiAndBoundaries,
      scenarioMessages.resolveDecision,
      scenarioMessages.freezeApproval,
    ]);

    const frozenArtifacts = await readThreadArtifacts(runtimeRoot, frozen.threadId);
    const frozenRequirementId = frozenArtifacts.thread.workflowState.onion?.finalized_requirement_memory_id;
    assert.ok(frozenRequirementId);
    assert.equal(frozenArtifacts.thread.workflowState.onion?.lifecycle_status, "handoff_ready");

    const reopened = await runTurns(harness.config, scopedProjectPath, frozen.threadId, [
      scenarioMessages.reopenAfterFreeze,
    ]);
    const reopenedArtifacts = await readThreadArtifacts(runtimeRoot, reopened.threadId);
    const reopenedOnion = reopenedArtifacts.thread.workflowState.onion;
    const reopenedTurn = getLatestOnionTurnResultEvent(reopenedArtifacts.thread);
    const retireReceipt = reopenedTurn.data.persistence_receipts.find(
      (receipt) => receipt.kind === "superseded_requirement_retire",
    );

    assert.equal(reopenedArtifacts.thread.workflowState.active_workflow, "requirements_gathering_onion");
    assert.equal(reopenedOnion?.lifecycle_status, "active");
    assert.equal(reopenedOnion?.state.freeze_status.status, "draft");
    assert.ok(retireReceipt?.success);
    assert.equal(retireReceipt?.status, "superseded");
    assert.equal(retireReceipt?.record_id, frozenRequirementId);
    assert.equal(reopenedOnion?.finalized_requirement_memory_id, null);

    const retiredRows = await pool.query(
      `SELECT id, tags, trust_level, workflow_metadata
         FROM memory_items
        WHERE id = $1`,
      [frozenRequirementId],
    );
    assert.equal(retiredRows.rows.length, 1);
    assert.ok(Array.isArray(retiredRows.rows[0]?.tags));
    assert.ok(retiredRows.rows[0]?.tags.includes("superseded"));
    assert.equal(retiredRows.rows[0]?.trust_level, "locked");
    assert.equal(retiredRows.rows[0]?.workflow_metadata?.status, "superseded");

    const replacement = await runTurns(harness.config, scopedProjectPath, reopened.threadId, [
      scenarioMessages.freezeApproval,
    ]);
    await closeTelemetry();

    const replacementArtifacts = await readThreadArtifacts(runtimeRoot, replacement.threadId);
    const replacementOnion = replacementArtifacts.thread.workflowState.onion;
    const latestOnionTurn = getLatestOnionTurnResultEvent(replacementArtifacts.thread);
    const replacementRequirementId = replacementOnion?.finalized_requirement_memory_id;

    assert.equal(replacementArtifacts.thread.workflowState.active_workflow, null);
    assert.equal(replacementOnion?.lifecycle_status, "handoff_ready");
    assert.equal(replacementOnion?.state.freeze_status.status, "approved");
    assert.ok(replacementRequirementId);
    assert.notEqual(replacementRequirementId, frozenRequirementId);

    const replacementRows = await pool.query(
      `SELECT id, tags, trust_level, workflow_metadata
         FROM memory_items
        WHERE id = $1`,
      [replacementRequirementId],
    );
    assert.equal(replacementRows.rows.length, 1);
    assert.equal(replacementRows.rows[0]?.trust_level, "locked");
    assert.ok(!replacementRows.rows[0]?.workflow_metadata?.status);
    assert.ok(
      latestOnionTurn.data.persistence_receipts.some(
        (receipt) => receipt.kind === "finalized_requirement_create" && receipt.success,
      ),
    );
    assert.ok(
      latestOnionTurn.data.persistence_receipts.some(
        (receipt) => receipt.kind === "finalized_requirement_lock" && receipt.success,
      ),
    );

    const requirementsList = await (client as any).callJsonTool("requirements_manage", {
      action: "list",
      scope: scopedProjectPath,
    }) as Array<Record<string, unknown>>;
    assert.ok(!requirementsList.some((row) => row.id === frozenRequirementId));
    assert.ok(requirementsList.some((row) => row.id === replacementRequirementId));

    const searchResults = await client.searchMemory(
      "Finalized requirements",
      scopedProjectPath,
      createSystemProvenance("tests/integration/onion-route:supersession-search"),
      {
        content_types: ["requirement"],
        trust_levels: ["locked"],
        max_results: 20,
      },
    );
    assert.ok(!searchResults.some((row) => row.id === frozenRequirementId));
    assert.ok(searchResults.some((row) => row.id === replacementRequirementId));

    return {
      runtime_root: runtimeRoot,
      thread_json_path: replacementArtifacts.jsonPath,
      thread_txt_path: replacementArtifacts.txtPath,
      thread_id: replacement.threadId,
      reopen_response: reopened.responses.at(-1) ?? "",
      replacement_response: replacement.responses.at(-1) ?? "",
      previous_finalized_requirement_memory_id: frozenRequirementId,
      replacement_finalized_requirement_memory_id: replacementRequirementId,
      lifecycle_status_after_reopen: reopenedOnion?.lifecycle_status,
      lifecycle_status_after_reapproval: replacementOnion?.lifecycle_status,
      freeze_status_after_reapproval: replacementOnion?.state.freeze_status.status,
      active_workflow_after_reapproval: replacementArtifacts.thread.workflowState.active_workflow,
      superseded_retire_receipt: retireReceipt ?? null,
      retired_requirement_row: retiredRows.rows[0],
      replacement_requirement_row: replacementRows.rows[0],
    };
  } finally {
    await closeRuntimeHarness(client);
  }
}

async function runCliEntryProof(runtimeRoot: string) {
  await mkdir(runtimeRoot, { recursive: true });
  const threadsDir = join(runtimeRoot, "threads");
  const memoryDir = join(runtimeRoot, "memory");
  await mkdir(threadsDir, { recursive: true });
  await mkdir(memoryDir, { recursive: true });

  const parserUpdatePath = join(runtimeRoot, "parser-updates.json");
  await writeFile(parserUpdatePath, JSON.stringify(Object.fromEntries(parserUpdates), null, 2), "utf-8");

  const replayedInvocationId = randomUUID();
  const telemetryOutboxPath = join(memoryDir, "telemetry-outbox.json");
  await writeFile(telemetryOutboxPath, JSON.stringify([
    {
      provenance: {
        ...createSystemProvenance("tests/integration/onion-route:cli-replay"),
        invocation_id: replayedInvocationId,
      },
      category: "system",
      operation: "cli_replay_seed",
      latency_ms: 1,
      success: true,
      metadata: {
        source: "cli-entry-proof",
      },
    },
  ], null, 2), "utf-8");

  const cliPath = resolve(repoRoot, "COO", "controller", "cli.ts");
  const tsxPath = resolve(repoRoot, "COO", "node_modules", ".bin", "tsx.cmd");
  const child = spawn(process.env.ComSpec ?? "cmd.exe", [
    "/d",
    "/s",
    "/c",
    `${tsxPath} ${cliPath} --enable-onion --scope ${scopedProjectPath}`,
  ], {
    cwd: repoRoot,
    env: {
      ...process.env,
      ADF_ENABLE_REQUIREMENTS_GATHERING_ONION: "0",
      ADF_COO_TEST_PARSER_UPDATES_FILE: parserUpdatePath,
      ADF_COO_THREADS_DIR: threadsDir,
      ADF_COO_MEMORY_DIR: memoryDir,
    },
    stdio: ["pipe", "pipe", "pipe"],
  });

  const stdoutChunks: Buffer[] = [];
  const stderrChunks: Buffer[] = [];
  child.stdout.on("data", (chunk) => {
    stdoutChunks.push(Buffer.from(chunk));
  });
  child.stderr.on("data", (chunk) => {
    stderrChunks.push(Buffer.from(chunk));
  });

  child.stdin.write(`${scenarioMessages.start}\n`);
  child.stdin.write(`${scenarioMessages.expectedResult}\n`);
  child.stdin.write("exit\n");
  child.stdin.end();

  const exitCode = await new Promise<number>((resolvePromise, rejectPromise) => {
    child.on("error", rejectPromise);
    child.on("close", (code) => {
      resolvePromise(code ?? -1);
    });
  });

  const stdout = Buffer.concat(stdoutChunks).toString("utf-8");
  const stderr = Buffer.concat(stderrChunks).toString("utf-8");
  const stdoutPath = join(runtimeRoot, "cli-stdout.txt");
  const stderrPath = join(runtimeRoot, "cli-stderr.txt");
  await writeFile(stdoutPath, stdout, "utf-8");
  await writeFile(stderrPath, stderr, "utf-8");

  assert.equal(exitCode, 0);
  assert.equal(stderr.trim(), "");
  assert.match(stdout, /Recovered 1 persisted telemetry event\(s\) from the local outbox\./);
  assert.match(stdout, /Requirements-gathering onion: enabled \(feature gate\)/);
  assert.match(stdout, /COO> Current scope so far:/);
  assert.match(stdout, /Session ended\./);

  const threadIdMatch = stdout.match(/\[thread: ([0-9a-f-]{36}), scope:/i);
  assert.ok(threadIdMatch);
  const threadId = threadIdMatch[1];
  const threadArtifacts = await readThreadArtifacts(runtimeRoot, threadId);
  assert.equal(threadArtifacts.thread.workflowState.active_workflow, "requirements_gathering_onion");
  assert.equal(threadArtifacts.thread.workflowState.onion?.current_layer, "success_view");

  const replayedTelemetryRows = await pool.query(
    `SELECT operation
       FROM telemetry
      WHERE invocation_id = $1::uuid`,
    [replayedInvocationId],
  );
  assert.ok(replayedTelemetryRows.rows.some((row) => row.operation === "cli_replay_seed"));

  const cliTurnTelemetryRows = await pool.query(
    `SELECT metadata, success
       FROM telemetry
      WHERE operation = 'handle_turn'
        AND metadata->>'thread_id' = $1
      ORDER BY created_at ASC`,
    [threadId],
  );
  assert.ok(cliTurnTelemetryRows.rows.length >= 2);
  assert.ok(cliTurnTelemetryRows.rows.every((row) => row.success === true));

  const remainingOutbox = await readOptionalFile(telemetryOutboxPath);
  assert.equal(remainingOutbox, null);

  return {
    runtime_root: runtimeRoot,
    stdout_path: stdoutPath,
    stderr_path: stderrPath,
    thread_json_path: threadArtifacts.jsonPath,
    thread_txt_path: threadArtifacts.txtPath,
    thread_id: threadId,
    replayed_invocation_id: replayedInvocationId,
    handle_turn_rows: cliTurnTelemetryRows.rows.length,
    latest_lifecycle_status: threadArtifacts.thread.workflowState.onion?.lifecycle_status,
  };
}

async function readOptionalFile(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf-8");
  } catch (error) {
    if (error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

async function main() {
  await rm(artifactRoot, { recursive: true, force: true });
  await mkdir(artifactRoot, { recursive: true });

  const cliEntry = await runCliEntryProof(join(artifactRoot, "cli-runtime"));
  const success = await runSuccessProof(join(artifactRoot, "success-runtime"));
  const gateDisabled = await runGateDisabledProof(join(artifactRoot, "gate-disabled-runtime"));
  const supersession = await runSupersessionProof(join(artifactRoot, "supersession-runtime"));
  const noScope = await runNoScopeProof(join(artifactRoot, "no-scope-runtime"));

  const report = {
    generated_at: new Date().toISOString(),
    live_route_under_proof: "CLI -> controller -> classifier -> requirements_gathering_onion live adapter -> thread workflow state + governed requirement persistence -> COO response -> telemetry",
    cli_entry: cliEntry,
    controller_detail_route_under_proof: "controller.handleTurn -> classifier -> requirements_gathering_onion live adapter -> thread workflow state + governed requirement persistence -> COO response -> telemetry",
    success,
    gate_disabled: gateDisabled,
    supersession,
    no_scope: noScope,
  };

  await writeFile(join(artifactRoot, "report.json"), JSON.stringify(report, null, 2), "utf-8");
  console.log(JSON.stringify(report, null, 2));
}

main()
  .then(async () => {
    await closeTelemetry();
    resetTelemetryForTests();
    await pool.end();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error(error);
    await closeTelemetry().catch(() => {});
    resetTelemetryForTests();
    await pool.end().catch(() => {});
    process.exit(1);
  });
