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

test("full-source happy path renders a scan-friendly evidence-qualified executive surface", async () => {
  const fixture = await createFixture({ includeAdmissions: true });
  await writeCompletedFeatureTruth({
    featureSlug: "feature-landed",
    updatedAt: "2026-04-03T16:04:00.000Z",
    contextCollectedAt: "2026-04-02T14:34:00.000Z",
    closeoutFinishedAt: "2026-04-03T16:04:00.000Z",
    reviewCycles: 1,
    completionSummary: "Token cost unavailable. No implementation-quality defects recorded.",
    reviewFinding: "Proof partition contamination of the live artifact root.",
  });

  const result = await buildLiveExecutiveStatus({
    projectRoot: tempRoot,
    threadsDir: fixture.threadsDir,
    brainClient: fixture.brainClient,
    sourcePartition: "proof",
    telemetryContext: {
      status_surface: "unit_test",
    },
    loadStatusUpdateAnchor: async () => ({
      renderedAt: "2026-04-03T15:00:00.000Z",
      headCommit: "1111111111111111111111111111111111111111",
    }),
    inspectGitStatusWindow: async () => makeStatusWindow({
      currentRenderedAt: "2026-04-03T16:05:00.000Z",
      previousRenderedAt: "2026-04-03T15:00:00.000Z",
      previousHeadCommit: "1111111111111111111111111111111111111111",
      currentHeadCommit: "2222222222222222222222222222222222222222",
      verificationBasis: "previous_head_commit",
      commitsSincePrevious: 2,
      changedFeatureSlugs: ["feature-landed", "feature-moving"],
      droppedFeatureSlugs: [],
      verificationNotes: ["Git checked 2 commit(s) since the previous status update."],
      redFlag: false,
    }),
    saveStatusUpdateAnchor: async () => {},
  });
  await drain();

  assert.ok(result.output.includes("# COO Executive Status"));
  assert.ok(result.output.includes("Status window:"));
  assert.ok(result.output.includes("This COO update: 2026-04-03 16:05:00Z (2222222)"));
  assert.ok(result.output.includes("Previous COO update: 2026-04-03 15:00:00Z (1111111)"));
  assert.ok(result.output.includes("Coverage check: derived from git commit history between the previous recorded HEAD and the current HEAD."));
  assert.ok(result.output.includes("What landed:"));
  assert.ok(result.output.includes("1. **Feature Landed** - completed and merged"));
  assert.ok(result.output.includes("Timing: about"));
  assert.ok(result.output.includes("elapsed lifecycle time"));
  assert.ok(result.output.includes("Active work time is unknown."));
  assert.ok(result.output.includes("Reviews: 1 completed review cycle is recorded."));
  assert.ok(result.output.includes("Token cost: unavailable."));
  assert.ok(result.output.includes("Evidence:"));
  assert.ok(result.output.includes("What is moving:"));
  assert.ok(result.output.includes("**Feature Moving** -"));
  assert.ok(result.output.includes("What needs your attention now:"));
  assert.ok(result.output.includes("**Feature Blocked** - Vendor sign-off missing"));
  assert.ok(!result.output.includes("featureStatus"));
  assert.ok(!result.output.includes("assafyavnai/adf/feature-moving"));

  assertEventPresent("live_status_invocation_count");
  assertEventPresent("live_exec_brief_build_latency_ms");
  assertEventPresent("live_exec_brief_render_success_count");
  assert.equal(findEvents("live_exec_brief_render_failure_count").length, 0);
  assert.equal(assertSingleEvent("issues_visibility_parity_count").metadata?.parity_match, true);
  assert.equal(assertSingleEvent("table_visibility_parity_count").metadata?.parity_match, true);
  assert.equal(assertSingleEvent("in_motion_visibility_parity_count").metadata?.parity_match, true);
  assert.equal(assertSingleEvent("next_visibility_parity_count").metadata?.parity_match, true);
  assert.equal(assertSingleEvent("live_exec_brief_render_success_count").metadata?.git_context_red_flag, false);
});

test("partial-source path stays visible as fallback when CTO admission truth is missing", async () => {
  const threadsDir = join(tempRoot, "threads");
  const implementPlanRoot = join(tempRoot, ".codex", "implement-plan");
  await mkdir(threadsDir, { recursive: true });
  await mkdir(join(tempRoot, "docs", "phase1"), { recursive: true });
  await mkdir(implementPlanRoot, { recursive: true });

  const thread = makeOnionThread({
    scopePath: "assafyavnai/shippingagent",
    topic: "/status command in the COO CLI",
    lifecycleStatus: "handoff_ready",
    currentLayer: "approved",
    blockers: [],
    openDecisions: [],
    openLoops: [],
    finalizedRequirementMemoryId: "55555555-5555-4555-8555-555555555555",
  });
  await writeThread(threadsDir, thread);

  await writeJson(join(implementPlanRoot, "features-index.json"), {
    version: 1,
    updated_at: "2026-04-03T16:06:00.000Z",
    features: {},
  });

  const result = await buildLiveExecutiveStatus({
    projectRoot: tempRoot,
    threadsDir,
    brainClient: {
      async getRequirement(): Promise<Record<string, unknown>> {
        throw new Error("synthetic Brain read failure");
      },
    },
    sourcePartition: "proof",
  });
  await drain();

  assert.ok(
    result.output.includes("CTO admission truth is missing")
      || result.output.includes("falls back to thread and finalized requirement truth"),
  );
  assert.ok(result.output.includes("Review the finalized requirement for technical admission."));
  assert.ok(result.output.includes("What needs your attention now:"));
  assert.ok(result.output.includes("**/status command in the COO CLI**"));
  assert.ok(result.diagnostics.unavailableFamilies.includes("cto_admission"));
});

test("empty-state path stays scan-friendly and does not pretend missing sources mean calm truth", async () => {
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

  assert.ok(result.output.includes("# COO Executive Status"));
  assert.ok(result.output.includes("Some source truth is missing"));
  assert.ok(result.output.includes("What landed:"));
  assert.ok(result.output.includes("No recent landed work is visible in the current evidence."));
  assert.ok(result.output.includes("What needs your attention now:"));
  assert.ok(result.output.includes("Nothing urgent is blocked right now"));
  assert.equal(result.facts.features.length, 0);
});

test("blocked-item path surfaces the blocker with direct-source evidence", async () => {
  const fixture = await createFixture({ includeAdmissions: true });

  const result = await buildLiveExecutiveStatus({
    projectRoot: tempRoot,
    threadsDir: fixture.threadsDir,
    brainClient: fixture.brainClient,
    sourcePartition: "proof",
  });
  await drain();

  assert.ok(result.output.includes("**Feature Blocked** - Vendor sign-off missing"));
  assert.ok(result.output.includes("Recommendation:"));
  assert.ok(result.output.includes("The blocker comes directly from live COO thread/onion truth."));
  assert.ok(result.output.includes("high confidence"));
});

test("stale-source path reduces confidence and surfaces staleness explicitly", async () => {
  const fixture = await createFixture({ includeAdmissions: true });

  const result = await buildLiveExecutiveStatus({
    projectRoot: tempRoot,
    threadsDir: fixture.threadsDir,
    brainClient: fixture.brainClient,
    sourcePartition: "proof",
    now: new Date("2026-04-10T12:00:00.000Z"),
  });
  await drain();

  assert.ok(result.output.includes("stale"));
  assert.ok(result.output.includes("low confidence"));
});

test("landed work explains when review-cycle was explicitly not invoked in the slice folder", async () => {
  const threadsDir = join(tempRoot, "threads");
  const implementPlanRoot = join(tempRoot, ".codex", "implement-plan");
  const featureRoot = join(tempRoot, "docs", "phase1", "feature-no-review");
  await mkdir(threadsDir, { recursive: true });
  await mkdir(implementPlanRoot, { recursive: true });
  await mkdir(featureRoot, { recursive: true });

  await writeJson(join(implementPlanRoot, "features-index.json"), {
    version: 1,
    updated_at: "2026-04-03T16:00:00.000Z",
    features: {
      "phase1/feature-no-review": {
        phase_number: 1,
        feature_slug: "feature-no-review",
        feature_status: "completed",
        active_run_status: "completed",
        merge_status: "merged",
        last_completed_step: "marked_complete",
        updated_at: "2026-04-03T16:00:00.000Z",
      },
    },
  });
  await writeJson(join(featureRoot, "implement-plan-state.json"), {
    phase_number: 1,
    feature_slug: "feature-no-review",
    feature_status: "completed",
    active_run_status: "completed",
    merge_status: "merged",
    last_completed_step: "marked_complete",
    updated_at: "2026-04-03T16:00:00.000Z",
    run_timestamps: {
      context_collected_at: "2026-04-03T15:30:00.000Z",
      closeout_finished_at: "2026-04-03T16:00:00.000Z",
    },
  });
  await writeFile(
    join(featureRoot, "completion-summary.md"),
    [
      "Human Verification Requirement:",
      "- Required: false",
      "",
      "Review-Cycle Status:",
      "- Not invoked (post_send_to_review=false)",
      "",
      "Token cost unavailable.",
    ].join("\n"),
    "utf-8",
  );

  const result = await buildLiveExecutiveStatus({
    projectRoot: tempRoot,
    threadsDir,
    brainClient: null,
    sourcePartition: "proof",
  });
  await drain();

  assert.ok(result.output.includes("**Feature No Review** - completed and merged"));
  assert.ok(result.output.includes("Reviews: 0 completed review cycles are recorded. Slice closeout says Not invoked (post_send_to_review=false)."));
});

test("landed work calls out when the slice folder cannot prove review status", async () => {
  const threadsDir = join(tempRoot, "threads");
  const implementPlanRoot = join(tempRoot, ".codex", "implement-plan");
  const featureRoot = join(tempRoot, "docs", "phase1", "feature-missing-governance");
  await mkdir(threadsDir, { recursive: true });
  await mkdir(implementPlanRoot, { recursive: true });
  await mkdir(featureRoot, { recursive: true });
  await writeFile(join(featureRoot, "README.md"), "# placeholder\n", "utf-8");

  await writeJson(join(implementPlanRoot, "features-index.json"), {
    version: 1,
    updated_at: "2026-04-03T16:00:00.000Z",
    features: {
      "phase1/feature-missing-governance": {
        phase_number: 1,
        feature_slug: "feature-missing-governance",
        feature_status: "completed",
        active_run_status: "completed",
        merge_status: "merged",
        last_completed_step: "marked_complete",
        updated_at: "2026-04-03T16:00:00.000Z",
      },
    },
  });

  const result = await buildLiveExecutiveStatus({
    projectRoot: tempRoot,
    threadsDir,
    brainClient: null,
    sourcePartition: "proof",
  });
  await drain();

  assert.ok(result.output.includes("**Feature Missing Governance** - completed and merged"));
  assert.ok(result.output.includes("Reviews: unavailable. The slice folder does not carry closeout or review-cycle artifacts, so review status is not provable."));
});

test("status window persists the last COO update time so the next run has a comparison frame", async () => {
  const fixture = await createFixture({ includeAdmissions: true });

  await buildLiveExecutiveStatus({
    projectRoot: tempRoot,
    threadsDir: fixture.threadsDir,
    brainClient: fixture.brainClient,
    sourcePartition: "proof",
    now: new Date("2026-04-03T10:00:00.000Z"),
  });

  const result = await buildLiveExecutiveStatus({
    projectRoot: tempRoot,
    threadsDir: fixture.threadsDir,
    brainClient: fixture.brainClient,
    sourcePartition: "proof",
    now: new Date("2026-04-03T12:00:00.000Z"),
  });
  await drain();

  assert.ok(result.output.includes("Status window:"));
  assert.ok(result.output.includes("This COO update: 2026-04-03 12:00:00Z"));
  assert.ok(result.output.includes("Previous COO update: 2026-04-03 10:00:00Z"));
  assert.ok(result.statusWindow);
  assert.equal(result.statusWindow?.previousRenderedAt, "2026-04-03T10:00:00.000Z");
});

test("ambiguous timing path does not present elapsed lifecycle time as active work duration", async () => {
  const fixture = await createFixture({ includeAdmissions: true });
  await writeCompletedFeatureTruth({
    featureSlug: "feature-landed",
    updatedAt: "2026-04-03T16:04:00.000Z",
    contextCollectedAt: "2026-04-02T14:34:00.000Z",
    closeoutFinishedAt: "2026-04-03T16:04:00.000Z",
    reviewCycles: 1,
    completionSummary: "Token cost unavailable.",
    reviewFinding: "Proof partition contamination of the live artifact root.",
  });

  const result = await buildLiveExecutiveStatus({
    projectRoot: tempRoot,
    threadsDir: fixture.threadsDir,
    brainClient: fixture.brainClient,
    sourcePartition: "proof",
  });
  await drain();

  assert.ok(result.output.includes("elapsed lifecycle time"));
  assert.ok(result.output.includes("Active work time is unknown."));
  assert.ok(!result.output.includes("implementation took 1d 1h"));
});

test("provenance path distinguishes direct, derived, and fallback claims", async () => {
  const fixture = await createFixture({ includeAdmissions: false });
  await writeCompletedFeatureTruth({
    featureSlug: "feature-landed",
    updatedAt: "2026-04-03T16:04:00.000Z",
    contextCollectedAt: "2026-04-03T14:00:00.000Z",
    closeoutFinishedAt: "2026-04-03T16:04:00.000Z",
    reviewCycles: 0,
    completionSummary: "No implementation-quality defects recorded.",
    reviewFinding: null,
  });
  await writeThread(fixture.threadsDir, makeOnionThread({
    scopePath: "assafyavnai/adf/feature-gap",
    topic: "Feature Gap",
    lifecycleStatus: "handoff_ready",
    currentLayer: "approved",
    blockers: [],
    openDecisions: [],
    openLoops: [],
    finalizedRequirementMemoryId: "77777777-7777-4777-8777-777777777777",
  }));

  const result = await buildLiveExecutiveStatus({
    projectRoot: tempRoot,
    threadsDir: fixture.threadsDir,
    brainClient: fixture.brainClient,
    sourcePartition: "proof",
  });
  await drain();

  assert.ok(result.output.includes("The blocker comes directly from live COO thread/onion truth."));
  assert.ok(result.output.includes("This landed summary is derived from implement-plan closeout plus any recorded review artifacts."));
  assert.ok(
    result.output.includes("CTO admission truth is missing")
      || result.output.includes("falls back to thread and finalized requirement truth"),
  );
});

test("live executive status stays derived-only and does not mutate source files", async () => {
  const fixture = await createFixture({ includeAdmissions: true });
  await writeCompletedFeatureTruth({
    featureSlug: "feature-landed",
    updatedAt: "2026-04-03T16:04:00.000Z",
    contextCollectedAt: "2026-04-03T14:00:00.000Z",
    closeoutFinishedAt: "2026-04-03T16:04:00.000Z",
    reviewCycles: 0,
    completionSummary: "No implementation-quality defects recorded.",
    reviewFinding: null,
  });

  const threadFiles = (await readdir(fixture.threadsDir))
    .filter((entry) => entry.endsWith(".json"))
    .map((entry) => join(fixture.threadsDir, entry));
  const watchedPaths = [
    ...threadFiles,
    join(tempRoot, "docs", "phase1", "feature-moving", "cto-admission-decision.template.json"),
    join(tempRoot, ".codex", "implement-plan", "features-index.json"),
    join(tempRoot, "docs", "phase1", "feature-landed", "implement-plan-state.json"),
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

test("parity and visibility proof keeps blocked or attention-worthy items visible", async () => {
  const fixture = await createFixture({ includeAdmissions: true });

  const result = await buildLiveExecutiveStatus({
    projectRoot: tempRoot,
    threadsDir: fixture.threadsDir,
    brainClient: fixture.brainClient,
    sourcePartition: "proof",
  });
  await drain();

  assert.equal(result.brief.parity.issuesExpected, result.brief.parity.issuesActual);
  assert.equal(result.brief.parity.tableExpected, result.brief.parity.tableActual);
  assert.equal(result.brief.parity.inMotionExpected, result.brief.parity.inMotionActual);
  assert.equal(result.brief.parity.whatsNextExpected, result.brief.parity.whatsNextActual);
  assert.ok(result.output.includes("Feature Blocked"));
  assert.ok(result.output.includes("Feature Table"));
});

test("git verification raises a red flag when recent feature work is missing from the current COO context", async () => {
  const fixture = await createFixture({ includeAdmissions: true });

  const result = await buildLiveExecutiveStatus({
    projectRoot: tempRoot,
    threadsDir: fixture.threadsDir,
    brainClient: fixture.brainClient,
    sourcePartition: "proof",
    loadStatusUpdateAnchor: async () => ({
      renderedAt: "2026-04-03T15:00:00.000Z",
      headCommit: "1111111111111111111111111111111111111111",
    }),
    inspectGitStatusWindow: async () => makeStatusWindow({
      currentRenderedAt: "2026-04-03T16:00:00.000Z",
      previousRenderedAt: "2026-04-03T15:00:00.000Z",
      previousHeadCommit: "1111111111111111111111111111111111111111",
      currentHeadCommit: "3333333333333333333333333333333333333333",
      verificationBasis: "previous_head_commit",
      commitsSincePrevious: 3,
      changedFeatureSlugs: ["feature-blocked", "feature-hidden"],
      droppedFeatureSlugs: ["feature-hidden"],
      verificationNotes: [
        "Git checked 3 commit(s) since the previous status update.",
        "Red flag: git shows recent work on feature-hidden, but the current COO surface does not carry it.",
      ],
      redFlag: true,
    }),
    saveStatusUpdateAnchor: async () => {},
  });
  await drain();

  assert.ok(result.output.includes("What stands out:"));
  assert.ok(result.output.includes("Red flag: git shows recent work on Feature Hidden"));
  assert.ok(result.output.includes("1. **Status coverage** - Recent git activity on Feature Hidden is missing from the current COO status."));
  assert.equal(assertSingleEvent("live_exec_brief_render_success_count").metadata?.git_context_red_flag, true);
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
    scopePath: "assafyavnai/adf/feature-blocked",
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
    scopePath: "assafyavnai/adf/feature-table",
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
    scopePath: "assafyavnai/adf/feature-moving",
    topic: "Feature Moving",
    lifecycleStatus: "handoff_ready",
    currentLayer: "approved",
    blockers: [],
    openDecisions: [],
    openLoops: [],
    finalizedRequirementMemoryId: movingId,
  }));
  await writeThread(threadsDir, makeOnionThread({
    scopePath: "assafyavnai/adf/feature-next",
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

async function writeCompletedFeatureTruth(input: {
  featureSlug: string;
  updatedAt: string;
  contextCollectedAt: string;
  closeoutFinishedAt: string;
  reviewCycles: number;
  completionSummary: string;
  reviewFinding: string | null;
}): Promise<void> {
  const featureRoot = join(tempRoot, "docs", "phase1", input.featureSlug);
  await mkdir(featureRoot, { recursive: true });
  await writeJson(join(featureRoot, "implement-plan-state.json"), {
    phase_number: 1,
    feature_slug: input.featureSlug,
    feature_status: "completed",
    active_run_status: "completed",
    merge_status: "merged",
    last_completed_step: "marked_complete",
    updated_at: input.updatedAt,
    created_at: input.contextCollectedAt,
    merge_commit_sha: "merge-commit-sha",
    approved_commit_sha: "approved-commit-sha",
    run_timestamps: {
      context_collected_at: input.contextCollectedAt,
      closeout_finished_at: input.closeoutFinishedAt,
    },
  });
  await writeJson(join(featureRoot, "review-cycle-state.json"), {
    last_completed_cycle: input.reviewCycles,
  });
  await writeFile(join(featureRoot, "completion-summary.md"), input.completionSummary, "utf-8");

  if (input.reviewCycles > 0 && input.reviewFinding) {
    const cycleRoot = join(featureRoot, `cycle-${String(input.reviewCycles).padStart(2, "0")}`);
    await mkdir(cycleRoot, { recursive: true });
    await writeFile(
      join(cycleRoot, "review-findings.md"),
      `1. Findings\n- Failure class: ${input.reviewFinding}\n`,
      "utf-8",
    );
  }
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
  const requirementArtifact = state.approved_snapshot && input.finalizedRequirementMemoryId
    ? {
        schema_version: "1.0" as const,
        artifact_kind: "requirement_list" as const,
        artifact_id: `artifact::${input.scopePath}`,
        source_approval_turn_id: "turn-001",
        human_scope: state.approved_snapshot,
        requirement_items: [{
          id: "scope-anchor",
          title: "Feature outcome",
          detail: `${state.goal}\n${state.expected_result}`,
          source_refs: ["goal", "expected_result"],
          meaning_preservation: "verbatim_from_approved_snapshot" as const,
        }],
        explicit_boundaries: state.boundaries,
        open_business_decisions: state.open_decisions,
        derivation_status: "ready" as const,
        blockers: input.blockers,
        derivation_notes: ["Derived from approved snapshot."],
      }
    : null;

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
      requirement_artifact: requirementArtifact,
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

function makeStatusWindow(input: {
  currentRenderedAt: string;
  previousRenderedAt: string | null;
  previousHeadCommit: string | null;
  currentHeadCommit: string | null;
  verificationBasis: "previous_head_commit" | "previous_rendered_at" | "baseline_not_established" | "unavailable";
  commitsSincePrevious: number;
  changedFeatureSlugs: string[];
  droppedFeatureSlugs: string[];
  verificationNotes: string[];
  redFlag: boolean;
}) {
  return {
    ...input,
    gitAvailable: input.verificationBasis !== "unavailable",
  };
}
