import test, { afterEach, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  configureMetadataDefaults,
  configurePersistence,
  configureSink,
  drain,
  resetForTests,
} from "../../shared/telemetry/collector.js";
import type { MetricEvent } from "../../shared/telemetry/types.js";
import { buildLiveExecutiveStatus } from "./executive-status.js";
import { createEvent, createThread, type Thread } from "./thread.js";
import { createApprovedOnionSnapshot, createEmptyOnionState } from "../requirements-gathering/contracts/onion-state.js";

let tempRoot = "";
let capturedEvents: MetricEvent[] = [];

beforeEach(async () => {
  resetForTests();
  tempRoot = await mkdtemp(join(tmpdir(), "adf-live-executive-status-"));
  capturedEvents = [];
  configurePersistence();
  configureMetadataDefaults({
    telemetry_partition: "proof",
    runtime_entry_surface: "unit_test",
  });
  configureSink(async (events) => {
    capturedEvents.push(...events);
  });
});

afterEach(async () => {
  await drain();
  resetForTests();
  if (tempRoot) {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test("live executive status renders all four sections from live sources and emits KPI telemetry", async () => {
  const fixture = await createFixture({ includeAdmissions: true });

  const result = await buildLiveExecutiveStatus({
    projectRoot: tempRoot,
    threadsDir: fixture.threadsDir,
    brainClient: fixture.brainClient,
    sourcePartition: "proof",
    telemetryContext: {
      status_surface: "unit_test",
    },
  });
  await drain();

  assert.ok(result.output.includes("# COO Executive Status"));
  assert.ok(result.output.includes("## Issues That Need Your Attention"));
  assert.ok(result.output.includes("## On The Table"));
  assert.ok(result.output.includes("## In Motion"));
  assert.ok(result.output.includes("## What's Next"));
  assert.ok(result.output.includes("Vendor sign-off missing"));
  assert.ok(result.output.includes("Feature Table"));
  assert.ok(result.output.includes("Feature Moving"));
  assert.ok(result.output.includes("Kick off implementation against the prepared feature branch."));
  assert.ok(!result.output.includes("featureStatus"), "status surface must stay business-level");

  assert.equal(result.diagnostics.missingSourceCount, 0);

  assertEventPresent("live_status_invocation_count");
  const buildEvent = assertSingleEvent("live_exec_brief_build_latency_ms");
  assert.equal(buildEvent.metadata?.telemetry_partition, "proof");
  assert.equal(buildEvent.metadata?.source_partition, "proof");
  assert.equal(buildEvent.metadata?.over_1s, 0);
  assert.equal(buildEvent.metadata?.over_10s, 0);
  assert.equal(buildEvent.metadata?.over_60s, 0);
  assertEventPresent("live_exec_brief_render_success_count");
  assert.equal(findEvents("live_exec_brief_render_failure_count").length, 0);

  const missingEvent = assertSingleEvent("live_source_adapter_missing_source_count");
  assert.equal(missingEvent.metadata?.count, 0);

  assert.equal(assertSingleEvent("issues_visibility_parity_count").metadata?.parity_match, true);
  assert.equal(assertSingleEvent("table_visibility_parity_count").metadata?.parity_match, true);
  assert.equal(assertSingleEvent("in_motion_visibility_parity_count").metadata?.parity_match, true);
  assert.equal(assertSingleEvent("next_visibility_parity_count").metadata?.parity_match, true);
  assertEventPresent("live_source_freshness_age_ms");
});

test("live executive status degrades cleanly when CTO admission artifacts are missing", async () => {
  const fixture = await createFixture({ includeAdmissions: false });

  const result = await buildLiveExecutiveStatus({
    projectRoot: tempRoot,
    threadsDir: fixture.threadsDir,
    brainClient: fixture.brainClient,
    sourcePartition: "proof",
  });
  await drain();

  assert.ok(result.output.includes("Status notes:"));
  assert.ok(result.output.includes("CTO admission truth is not available yet"));
  assert.ok(result.output.includes("## Issues That Need Your Attention"));
  assert.ok(result.output.includes("## On The Table"));
  assert.ok(result.output.includes("## In Motion"));
  assert.ok(result.output.includes("## What's Next"));
  assert.ok(result.diagnostics.unavailableFamilies.includes("cto_admission"));

  const missingEvent = assertSingleEvent("live_source_adapter_missing_source_count");
  assert.ok(Number(missingEvent.metadata?.count ?? 0) >= 1);
});

test("live executive status renders the four sections cleanly for an empty source set", async () => {
  const threadsDir = join(tempRoot, "threads");
  await mkdir(threadsDir, { recursive: true });
  await mkdir(join(tempRoot, "docs", "phase1"), { recursive: true });

  const result = await buildLiveExecutiveStatus({
    projectRoot: tempRoot,
    threadsDir,
    brainClient: null,
    sourcePartition: "proof",
  });
  await drain();

  assert.ok(result.output.includes("## Issues That Need Your Attention"));
  assert.ok(result.output.includes("## On The Table"));
  assert.ok(result.output.includes("## In Motion"));
  assert.ok(result.output.includes("## What's Next"));
  assert.ok(result.output.includes("No blocked items"));
  assert.ok(result.output.includes("No open decisions"));
  assert.ok(result.output.includes("No features actively"));
  assert.ok(result.output.includes("No pending next actions"));
  assert.equal(result.facts.features.length, 0);
  assert.equal(result.diagnostics.sourceFreshnessAgeMs >= 0, true);
});

test("live executive status keeps mixed source partition distinct from proof telemetry partition", async () => {
  const fixture = await createFixture({ includeAdmissions: true });

  const result = await buildLiveExecutiveStatus({
    projectRoot: tempRoot,
    threadsDir: fixture.threadsDir,
    brainClient: fixture.brainClient,
    sourcePartition: "mixed",
  });
  await drain();

  assert.equal(result.brief.sourcePartition, "mixed");
  const buildEvent = assertSingleEvent("live_exec_brief_build_latency_ms");
  assert.equal(buildEvent.metadata?.telemetry_partition, "proof");
  assert.equal(buildEvent.metadata?.source_partition, "mixed");
});

test("live executive status stays derived-only and does not mutate source files", async () => {
  const fixture = await createFixture({ includeAdmissions: true });
  const threadFiles = (await readdir(fixture.threadsDir))
    .filter((entry) => entry.endsWith(".json"))
    .map((entry) => join(fixture.threadsDir, entry));
  const watchedPaths = [
    ...threadFiles,
    join(tempRoot, "docs", "phase1", "feature-moving", "cto-admission-decision.template.json"),
    join(tempRoot, ".codex", "implement-plan", "features-index.json"),
  ];

  const before = await Promise.all(watchedPaths.map((path) => readFile(path, "utf-8")));

  await buildLiveExecutiveStatus({
    projectRoot: tempRoot,
    threadsDir: fixture.threadsDir,
    brainClient: fixture.brainClient,
    sourcePartition: "proof",
  });
  await drain();

  const after = await Promise.all(watchedPaths.map((path) => readFile(path, "utf-8")));
  assert.deepEqual(after, before);
});

async function createFixture(options: { includeAdmissions: boolean }): Promise<{
  threadsDir: string;
  brainClient: {
    getRequirement: (
      memoryId: string,
      scope: string,
      provenance: Record<string, unknown>,
      options?: Record<string, unknown>,
    ) => Promise<Record<string, unknown>>;
  };
}> {
  const threadsDir = join(tempRoot, "threads");
  const phaseRoot = join(tempRoot, "docs", "phase1");
  const implementPlanRoot = join(tempRoot, ".codex", "implement-plan");
  await mkdir(threadsDir, { recursive: true });
  await mkdir(phaseRoot, { recursive: true });
  await mkdir(implementPlanRoot, { recursive: true });

  const blockedId = "11111111-1111-4111-8111-111111111111";
  const movingId = "22222222-2222-4222-8222-222222222222";
  const nextId = "33333333-3333-4333-8333-333333333333";

  await writeThread(threadsDir, makeOnionThread({
    scopePath: "feature-blocked",
    topic: "Feature Blocked",
    lifecycleStatus: "blocked",
    currentLayer: "goal",
    blockers: ["Vendor sign-off missing"],
    openDecisions: [
      { id: "dec-blocked", question: "Which vendor can clear the dependency?", impact: "delivery timeline", status: "open" as const },
    ],
    openLoops: ["Confirm vendor path"],
    finalizedRequirementMemoryId: blockedId,
  }));
  await writeThread(threadsDir, makeOnionThread({
    scopePath: "feature-table",
    topic: "Feature Table",
    lifecycleStatus: "awaiting_freeze_approval",
    currentLayer: "whole_onion_freeze",
    blockers: [],
    openDecisions: [
      { id: "dec-table", question: "Which launch market comes first?", impact: "go-to-market timing", status: "open" as const },
    ],
    openLoops: [],
    finalizedRequirementMemoryId: null,
  }));
  await writeThread(threadsDir, makeOnionThread({
    scopePath: "feature-moving",
    topic: "Feature Moving",
    lifecycleStatus: "handoff_ready",
    currentLayer: "approved",
    blockers: [],
    openDecisions: [],
    openLoops: [],
    finalizedRequirementMemoryId: movingId,
  }));
  await writeThread(threadsDir, makeOnionThread({
    scopePath: "feature-next",
    topic: "Feature Next",
    lifecycleStatus: "handoff_ready",
    currentLayer: "approved",
    blockers: [],
    openDecisions: [],
    openLoops: [],
    finalizedRequirementMemoryId: nextId,
  }));

  await writeJson(join(implementPlanRoot, "features-index.json"), {
    version: 1,
    updated_at: "2026-04-03T16:00:00.000Z",
    features: {
      "phase1/feature-moving": {
        phase_number: 1,
        feature_slug: "feature-moving",
        feature_status: "active",
        active_run_status: "implementation_in_progress",
        merge_status: "not_ready",
        last_completed_step: "context_ready",
        updated_at: "2026-04-03T16:00:00.000Z",
        feature_branch: "implement-plan/phase1/feature-moving",
      },
      "phase1/feature-next": {
        phase_number: 1,
        feature_slug: "feature-next",
        feature_status: "active",
        active_run_status: "context_ready",
        merge_status: "not_ready",
        last_completed_step: "context_collected",
        updated_at: "2026-04-03T16:01:00.000Z",
        feature_branch: "implement-plan/phase1/feature-next",
      },
    },
  });

  if (options.includeAdmissions) {
    await writeAdmissionArtifacts("feature-moving", "admit", "Scope approved for implementation.");
    await writeAdmissionArtifacts("feature-next", "admit", "Ready for implementation kickoff.");
  }

  const requirementRecords = new Map<string, Record<string, unknown>>([
    [blockedId, {
      content: {
        feature_slug: "feature-blocked",
        requirement_summary: "Blocked scope is frozen but cannot proceed until the vendor path is cleared.",
        open_business_decisions: [],
        blockers: ["Vendor sign-off missing"],
        derivation_status: "ready",
      },
      created_at: "2026-04-03T15:45:00.000Z",
      updated_at: "2026-04-03T15:45:00.000Z",
    }],
    [movingId, {
      content: {
        feature_slug: "feature-moving",
        requirement_summary: "Implementation scope is frozen and technically admitted.",
        open_business_decisions: [],
        blockers: [],
        derivation_status: "ready",
      },
      created_at: "2026-04-03T15:50:00.000Z",
      updated_at: "2026-04-03T15:50:00.000Z",
    }],
    [nextId, {
      content: {
        feature_slug: "feature-next",
        requirement_summary: "The next implementation scope is frozen and ready to start.",
        open_business_decisions: [],
        blockers: [],
        derivation_status: "ready",
      },
      created_at: "2026-04-03T15:55:00.000Z",
      updated_at: "2026-04-03T15:55:00.000Z",
    }],
  ]);

  return {
    threadsDir,
    brainClient: {
      async getRequirement(
        memoryId: string,
        _scope: string,
        _provenance: Record<string, unknown>,
        _options?: Record<string, unknown>,
      ): Promise<Record<string, unknown>> {
        const record = requirementRecords.get(memoryId);
        if (!record) {
          throw new Error(`Requirement ${memoryId} not found`);
        }
        return record;
      },
    },
  };
}

async function writeAdmissionArtifacts(
  featureSlug: string,
  decision: "admit" | "defer" | "block",
  decisionReason: string,
): Promise<void> {
  const featureRoot = join(tempRoot, "docs", "phase1", featureSlug);
  await mkdir(featureRoot, { recursive: true });
  await writeJson(join(featureRoot, "cto-admission-request.json"), {
    schema_version: 1,
    feature_slug: featureSlug,
    requirement_artifact_source: "brain",
    business_priority: "high",
    claimed_scope_paths: [featureSlug],
    non_goals: [],
    boundaries: [],
    sequencing_hint: "any",
    dependency_notes: [],
    conflict_notes: [],
    suggested_execution_mode: "safe-parallel",
    requirement_summary: `${featureSlug} requirement summary`,
    source_frozen_at: "2026-04-03T15:40:00.000Z",
    packet_built_at: "2026-04-03T15:58:00.000Z",
    build_latency_ms: 12,
    source_metadata_completeness: {
      total_fields: 1,
      present_fields: 1,
      missing_fields: [],
      completeness_rate: 1,
    },
    partition: "proof",
  });
  await writeJson(join(featureRoot, "cto-admission-decision.template.json"), {
    schema_version: 1,
    feature_slug: featureSlug,
    decision,
    decision_reason: decisionReason,
    decided_by: "cto",
    decided_at: "2026-04-03T15:59:00.000Z",
    dependency_blocked: false,
    scope_conflict_detected: false,
    admit_conditions: [],
    defer_conditions: [],
    block_conditions: [],
  });
}

function makeOnionThread(input: {
  scopePath: string;
  topic: string;
  lifecycleStatus: "active" | "awaiting_freeze_approval" | "approved" | "handoff_ready" | "blocked";
  currentLayer: "goal" | "whole_onion_freeze" | "approved";
  blockers: string[];
  openDecisions: Array<{ id: string; question: string; impact: string; status: "open" | "resolved" }>;
  openLoops: string[];
  finalizedRequirementMemoryId: string | null;
}): Thread {
  const timestamp = "2026-04-03T16:00:00.000Z";
  const thread = createThread(input.scopePath);
  const state = createEmptyOnionState();
  state.topic = input.topic;
  state.goal = `${input.topic} goal`;
  state.expected_result = `${input.topic} expected result`;
  state.success_view = `${input.topic} success view`;
  state.major_parts = [{ id: "part-1", label: "Part 1", order: 0 }];
  state.open_decisions = input.openDecisions;
  state.freeze_status = {
    status: input.blockers.length > 0
      ? "blocked"
      : input.lifecycleStatus === "awaiting_freeze_approval"
        ? "ready_to_request"
        : input.lifecycleStatus === "approved" || input.lifecycleStatus === "handoff_ready"
          ? "approved"
          : "draft",
    blockers: input.blockers,
    ready_since_turn_id: "turn-001",
    approved_turn_id: input.lifecycleStatus === "approved" || input.lifecycleStatus === "handoff_ready" ? "turn-001" : undefined,
  };
  if (input.lifecycleStatus === "approved" || input.lifecycleStatus === "handoff_ready") {
    state.approved_snapshot = createApprovedOnionSnapshot(state, "turn-001", timestamp);
  }

  thread.updatedAt = timestamp;
  thread.workflowState = {
    active_workflow: "requirements_gathering_onion",
    onion: {
      trace_id: `trace-${input.scopePath}`,
      last_turn_id: "turn-001",
      lifecycle_status: input.lifecycleStatus,
      current_layer: input.currentLayer,
      selected_next_question: input.openDecisions[0]?.question ?? null,
      no_question_reason: input.openDecisions.length > 0 ? null : "No next question.",
      state,
      working_artifact: {
        schema_version: "1.0",
        artifact_kind: "working_scope",
        topic: state.topic,
        goal: state.goal,
        expected_result: state.expected_result,
        success_view: state.success_view,
        major_parts: state.major_parts,
        part_clarifications: state.part_clarifications,
        experience_ui: state.experience_ui,
        boundaries: state.boundaries,
        open_decisions: state.open_decisions,
        freeze_status: state.freeze_status,
        approved_snapshot: state.approved_snapshot,
        scope_summary: [`Topic: ${state.topic}`, `Goal: ${state.goal}`],
      },
      requirement_artifact: null,
      finalized_requirement_memory_id: input.finalizedRequirementMemoryId,
      latest_audit_trace: {
        trace_id: `trace-${input.scopePath}`,
        turn_id: "turn-001",
        current_layer: input.currentLayer,
        workflow_step: "clarification",
        decision_reason: "Fixture state",
        selected_next_question: input.openDecisions[0]?.question ?? null,
        no_question_reason: input.openDecisions.length > 0 ? null : "No next question.",
        freeze_blockers: input.blockers,
        open_decisions_snapshot: state.open_decisions,
        artifact_change_summary: ["Fixture state created"],
        result_status: input.blockers.length > 0 ? "blocked" : "clarification_needed",
      },
      latest_llm_calls: [],
      latest_persistence_receipts: [],
    },
  };
  thread.events.push(createEvent("state_commit", {
    summary: `${input.topic} state committed`,
    openLoops: input.openLoops,
    decisions: [],
  }));

  return thread;
}

async function writeThread(threadsDir: string, thread: Thread): Promise<void> {
  await writeJson(join(threadsDir, `${thread.id}.json`), thread);
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(value, null, 2), "utf-8");
}

function findEvents(operation: string): MetricEvent[] {
  return capturedEvents.filter((event) => event.operation === operation);
}

function assertEventPresent(operation: string): void {
  assert.ok(findEvents(operation).length > 0, `Expected telemetry event ${operation}`);
}

function assertSingleEvent(operation: string): MetricEvent {
  const events = findEvents(operation);
  assert.equal(events.length, 1, `Expected exactly one telemetry event for ${operation}`);
  return events[0];
}
