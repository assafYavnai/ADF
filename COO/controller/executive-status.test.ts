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
import { renderStatusWithAgent } from "../briefing/status-render-agent.js";
import { BrainHardStopError } from "../briefing/status-governance.js";
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

class MockBrainClient {
  readonly captured: Array<{ contentType: string; content: unknown; tags: string[]; scope: string }> = [];
  readonly rules: Array<{ title: string; body: string; tags: string[]; scope: string }> = [];
  readonly decisions: Array<{ title: string; reasoning: string; scope: string }> = [];

  constructor(
    private readonly requirements = new Map<string, Record<string, unknown>>(),
  ) {}

  async getRequirement(memoryId: string): Promise<Record<string, unknown>> {
    const record = this.requirements.get(memoryId);
    if (!record) {
      throw new Error(`Requirement ${memoryId} not found`);
    }
    return record;
  }

  async searchMemory(query: string): Promise<Array<Record<string, unknown>>> {
    if (/Phase 1 COO evidence-first operating rule/i.test(query) && this.rules.length > 0) {
      return this.rules.map((rule) => ({ content: { text: rule.title } }));
    }
    return [];
  }

  async captureMemory(
    content: string | Record<string, unknown>,
    contentType: string,
    tags: string[],
    scope: string,
  ): Promise<Record<string, unknown>> {
    const id = `${contentType}-${this.captured.length + 1}`;
    this.captured.push({ contentType, content, tags, scope });
    return { id };
  }

  async logDecision(title: string, reasoning: string, _alternatives: unknown[], scope: string): Promise<Record<string, unknown>> {
    this.decisions.push({ title, reasoning, scope });
    return { id: `decision-${this.decisions.length}` };
  }

  async createRule(title: string, body: string, tags: string[], scope: string): Promise<Record<string, unknown>> {
    this.rules.push({ title, body, tags, scope });
    return { id: `rule-${this.rules.length}` };
  }
}

test("first run performs a deep audit, writes findings to Brain, and populates derived operating continuity", async () => {
  const fixture = await createFixture({ includeAdmissions: true });

  const result = await buildLiveExecutiveStatus({
    projectRoot: tempRoot,
    threadsDir: fixture.threadsDir,
    brainClient: fixture.brainClient,
    sourcePartition: "proof",
    statusScopePath: "assafyavnai/adf/phase1",
  });
  await drain();

  assert.equal(result.governance.deepAudit?.trigger, "first_run");
  assert.equal(result.governance.deepAudit?.scope, "company");
  assert.ok(result.output.includes("## Issues That Need Your Attention"));
  assert.ok(result.output.includes("## On The Table"));
  assert.ok(result.output.includes("## In Motion"));
  assert.ok(result.output.includes("## What's Next"));
  assert.ok(result.output.includes("Status notes:"));
  assert.ok(result.output.includes("deep audit ran"));
  assert.ok(fixture.brainClient.rules.some((rule) => /evidence-first operating rule/i.test(rule.title)));
  assert.ok(fixture.brainClient.captured.some((entry) => entry.tags.includes("deep-audit")));
  const operatingState = JSON.parse(await readFile(join(tempRoot, ".codex", "runtime", "coo-operating-state.json"), "utf-8"));
  assert.equal(operatingState.schemaVersion, 1);
  assert.ok(operatingState.lastDeepAuditAt);
  assertEventPresent("live_exec_brief_render_success_count");
});

test("Brain hard stop blocks status when Brain is unavailable", async () => {
  const fixture = await createFixture({ includeAdmissions: true });

  await assert.rejects(
    buildLiveExecutiveStatus({
      projectRoot: tempRoot,
      threadsDir: fixture.threadsDir,
      brainClient: null,
      sourcePartition: "proof",
      statusScopePath: "assafyavnai/adf/phase1",
    }),
    (error: unknown) => error instanceof BrainHardStopError
      && /Brain durable memory is unavailable/i.test(error.message),
  );
});

test("0 review cycles is investigated as acceptable legacy when route timing says review was not required", async () => {
  const brainClient = new MockBrainClient();
  const threadsDir = join(tempRoot, "threads");
  const implementPlanRoot = join(tempRoot, ".codex", "implement-plan");
  const featureRoot = join(tempRoot, "docs", "phase1", "feature-legacy-review-gap");
  await mkdir(threadsDir, { recursive: true });
  await mkdir(implementPlanRoot, { recursive: true });
  await mkdir(featureRoot, { recursive: true });

  await writeJson(join(implementPlanRoot, "features-index.json"), {
    version: 1,
    updated_at: "2026-04-03T16:00:00.000Z",
    features: {
      "phase1/feature-legacy-review-gap": {
        phase_number: 1,
        feature_slug: "feature-legacy-review-gap",
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
    feature_slug: "feature-legacy-review-gap",
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
    brainClient,
    sourcePartition: "proof",
    statusScopePath: "assafyavnai/adf/phase1",
  });

  assert.ok(result.output.includes("review-cycle was not required for this landing"));
  assert.ok(result.output.includes("## On The Table"));
  assert.ok(result.output.includes("Feature Legacy Review Gap"));
});

test("0 review cycles after review governance is active is treated as suspicious and raises a tracked issue", async () => {
  const fixture = await createFixture({ includeAdmissions: false });
  await writeCompletedFeatureTruth({
    featureSlug: "feature-review-gap",
    updatedAt: "2026-04-05T16:04:00.000Z",
    contextCollectedAt: "2026-04-05T14:00:00.000Z",
    closeoutFinishedAt: "2026-04-05T16:04:00.000Z",
    reviewCycles: 0,
    completionSummary: "Token cost unavailable.",
    reviewFinding: null,
  });
  await writeGovernanceMilestones();

  const result = await buildLiveExecutiveStatus({
    projectRoot: tempRoot,
    threadsDir: fixture.threadsDir,
    brainClient: fixture.brainClient,
    sourcePartition: "proof",
    statusScopePath: "assafyavnai/adf/phase1",
  });

  assert.ok(result.output.includes("review governance should have applied"));
  assert.ok(result.output.includes("## Issues That Need Your Attention"));
  assert.ok(result.governance.additionalAttention.some((item) => item.featureId === "feature-review-gap"));
  assert.ok(fixture.brainClient.captured.some((entry) => entry.tags.includes("tracked-issue")));
});

test("merged landing without approved-commit proof is treated as suspicious and raised in issues", async () => {
  const fixture = await createFixture({ includeAdmissions: false });
  await writeCompletedFeatureTruth({
    featureSlug: "feature-approval-gap",
    updatedAt: "2026-04-05T16:04:00.000Z",
    contextCollectedAt: "2026-04-05T14:00:00.000Z",
    closeoutFinishedAt: "2026-04-05T16:04:00.000Z",
    reviewCycles: 1,
    completionSummary: "Token cost unavailable.",
    reviewFinding: null,
    approvedCommitSha: null,
  });

  const result = await buildLiveExecutiveStatus({
    projectRoot: tempRoot,
    threadsDir: fixture.threadsDir,
    brainClient: fixture.brainClient,
    sourcePartition: "proof",
    statusScopePath: "assafyavnai/adf/phase1",
  });

  assert.ok(result.output.includes("approved commit"));
  assert.ok(result.governance.additionalAttention.some((item) => item.featureId === "feature-approval-gap"));
  assert.ok(fixture.brainClient.captured.some((entry) =>
    entry.tags.includes("tracked-issue") && JSON.stringify(entry.content).includes("approved commit"),
  ));
});

test("deep audit escalates from targeted to company scope when multiple suspicious findings exist", async () => {
  const fixture = await createFixture({ includeAdmissions: false });
  await writeCompletedFeatureTruth({
    featureSlug: "feature-gap-one",
    updatedAt: "2026-04-05T16:04:00.000Z",
    contextCollectedAt: "2026-04-05T14:00:00.000Z",
    closeoutFinishedAt: "2026-04-05T16:04:00.000Z",
    reviewCycles: 0,
    completionSummary: "Token cost unavailable.",
    reviewFinding: null,
  });
  await writeCompletedFeatureTruth({
    featureSlug: "feature-gap-two",
    updatedAt: "2026-04-05T16:05:00.000Z",
    contextCollectedAt: "2026-04-05T14:05:00.000Z",
    closeoutFinishedAt: "2026-04-05T16:05:00.000Z",
    reviewCycles: 0,
    completionSummary: "Token cost unavailable.",
    reviewFinding: null,
  });
  await writeGovernanceMilestones();
  await seedOperatingState({
    lastDeepAuditAt: "2026-04-04T09:00:00.000Z",
    lastDeepAuditTrigger: "first_run",
    lastDeepAuditScope: "company",
    lastDeepAuditJustified: true,
    lastSensitivityAssessment: "adequate",
  });

  const result = await buildLiveExecutiveStatus({
    projectRoot: tempRoot,
    threadsDir: fixture.threadsDir,
    brainClient: fixture.brainClient,
    sourcePartition: "proof",
    statusScopePath: "assafyavnai/adf/phase1",
  });

  assert.equal(result.governance.deepAudit?.scope, "company");
  assert.equal(result.governance.deepAudit?.trigger, "suspicious_finding");
});

test("credible drift immediately downgrades trust and surfaces the downgrade to the CEO", async () => {
  const fixture = await createFixture({ includeAdmissions: false });
  await writeCompletedFeatureTruth({
    featureSlug: "feature-trust-drop",
    updatedAt: "2026-04-05T16:04:00.000Z",
    contextCollectedAt: "2026-04-05T14:00:00.000Z",
    closeoutFinishedAt: "2026-04-05T16:04:00.000Z",
    reviewCycles: 0,
    completionSummary: "Token cost unavailable.",
    reviewFinding: null,
  });
  await writeGovernanceMilestones();
  await seedOperatingState({
    trustSubjects: {
      "route:review-cycle": {
        id: "route:review-cycle",
        kind: "route",
        label: "Route Review Cycle",
        score: 45,
        state: "normal",
        lastEvidenceAt: "2026-04-04T10:00:00.000Z",
        lastAuditAt: "2026-04-04T10:00:00.000Z",
        lastChangedAt: "2026-04-04T10:00:00.000Z",
        reason: "Seeded test state",
        pendingProposalAt: null,
        pendingProposalReason: null,
      },
    },
  });

  const result = await buildLiveExecutiveStatus({
    projectRoot: tempRoot,
    threadsDir: fixture.threadsDir,
    brainClient: fixture.brainClient,
    sourcePartition: "proof",
    statusScopePath: "assafyavnai/adf/phase1",
  });

  assert.ok(result.governance.trustNotes.some((note) => /guarded trust/i.test(note.summary)));
  assert.ok(result.output.includes("guarded trust"));
});

test("fresh deep audit plus repeated evidence agreement creates a full-trust proposal instead of auto-upgrading", async () => {
  const fixture = await createFixture({ includeAdmissions: true });
  await writeCompletedFeatureTruth({
    featureSlug: "feature-landed",
    updatedAt: "2026-04-05T16:04:00.000Z",
    contextCollectedAt: "2026-04-05T14:00:00.000Z",
    closeoutFinishedAt: "2026-04-05T16:04:00.000Z",
    reviewCycles: 2,
    completionSummary: "tokens used: 1234",
    reviewFinding: "Implementation detail cleaned before merge.",
  });
  await seedOperatingState({
    trustSubjects: {
      "route:implement-plan": {
        id: "route:implement-plan",
        kind: "route",
        label: "Route Implement Plan",
        score: 100,
        state: "trusted",
        lastEvidenceAt: "2026-04-04T10:00:00.000Z",
        lastAuditAt: "2026-04-04T10:00:00.000Z",
        lastChangedAt: "2026-04-04T10:00:00.000Z",
        reason: "Seeded test state",
        pendingProposalAt: null,
        pendingProposalReason: null,
      },
    },
  });

  const result = await buildLiveExecutiveStatus({
    projectRoot: tempRoot,
    threadsDir: fixture.threadsDir,
    brainClient: fixture.brainClient,
    sourcePartition: "proof",
    statusScopePath: "assafyavnai/adf/phase1",
  });

  assert.ok(result.output.includes("## What's Next"));
  assert.ok(result.output.includes("Full trust can now be proposed"));
  assert.ok(result.governance.additionalNext.length > 0);
});

test("deterministic fallback surface keeps the internal 4 sections and operational footer when prompts are unavailable", async () => {
  const fixture = await createFixture({ includeAdmissions: true });
  const currentThreadId = await firstThreadId(fixture.threadsDir);

  const result = await buildLiveExecutiveStatus({
    projectRoot: tempRoot,
    threadsDir: fixture.threadsDir,
    brainClient: fixture.brainClient,
    sourcePartition: "proof",
    statusScopePath: "assafyavnai/adf/phase1",
    currentThreadId,
  });

  assert.ok(result.output.includes("## Issues That Need Your Attention"));
  assert.ok(result.output.includes("## On The Table"));
  assert.ok(result.output.includes("## In Motion"));
  assert.ok(result.output.includes("## What's Next"));
  assert.ok(result.output.includes("Operational context:"));
  assert.ok(result.output.includes("Current thread ID:"));
  assert.ok(result.output.includes("Scope path: assafyavnai/adf/feature-"));
});

test("live agent route hands the evidence pack to the COO model and repairs malformed live output back to the supported live contract", async () => {
  const fixture = await createFixture({ includeAdmissions: true });
  await writeGovernanceMilestones();
  const promptsDir = join(tempRoot, "COO", "intelligence");
  await mkdir(promptsDir, { recursive: true });
  await writeFile(join(promptsDir, "prompt.md"), "You are the COO of ADF.", "utf-8");

  let capturedPrompt = "";
  const result = await buildLiveExecutiveStatus({
    projectRoot: tempRoot,
    threadsDir: fixture.threadsDir,
    brainClient: fixture.brainClient,
    sourcePartition: "proof",
    statusScopePath: "assafyavnai/adf/phase1",
    promptsDir,
    intelligenceParams: {
      cli: "codex",
      model: "gpt-5.4",
      reasoning: "medium",
      bypass: true,
      timeout_ms: 5_000,
    },
    invokeLLM: async (params) => {
      capturedPrompt = params.prompt;
      return {
        provenance: {
          invocation_id: "status-agent",
          provider: "codex",
          model: "gpt-5.4",
          reasoning: "medium",
          was_fallback: false,
          source_path: "test",
          timestamp: "2026-04-05T00:00:00.000Z",
        },
        response: "## On The Table\nOne pending decision.\n\n## Issues That Need Your Attention\nNo immediate issues.\n\n## In Motion\nNo active work.\n\n## In Motion\nStill no active work.\n\nWhere would you like to focus?\n\n1. **Feature Moving** (Recommended)\n2. **Feature Next**\n3. **Other** - type what you need\n4. **Unexpected** - should not be here",
        latency_ms: 1,
        attempts: [],
      };
    },
  });

  assert.ok(!result.output.trimStart().startsWith("## "));
  assert.ok(result.output.includes("## Issues That Need Your Attention"));
  assert.ok(result.output.includes("## On The Table"));
  assert.ok(result.output.includes("## In Motion"));
  assert.equal(countLineOccurrences(result.output, "## Issues That Need Your Attention"), 1);
  assert.equal(countLineOccurrences(result.output, "## On The Table"), 1);
  assert.equal(countLineOccurrences(result.output, "## In Motion"), 1);
  assert.ok(!result.output.includes("## What's Next"));
  assert.ok(!result.output.includes("Operational context:"));
  assert.ok(result.output.includes("Where would you like to focus?"));
  assert.ok(result.output.includes("1. **"));
  assert.ok(result.output.includes("2. **"));
  assert.match(result.output, /^3\.\s\*\*Other\*\* - type what you need$/m);
  assert.equal(result.output.split("\n").filter((line) => /^\d+\.\s/.test(line.trim())).length, 3);
  assert.match(capturedPrompt, /<status_evidence>/);
  assert.match(capturedPrompt, /"tracked_findings"/);
  assert.match(capturedPrompt, /"landed_recently"/);
  assert.match(capturedPrompt, /"recent_landings_compact"/);
  assert.match(capturedPrompt, /"company_performance"/);
  assert.match(capturedPrompt, /"focus_options"/);
  assert.match(capturedPrompt, /"coo_recommendation_summary"/);
  assert.match(capturedPrompt, /"supported_live_contract"/);
  assert.match(capturedPrompt, /route_chain/);
  assert.match(capturedPrompt, /Formatting rules:/);
});

test("renderStatusWithAgent omits the final focus-choice block when fewer than two concrete options are evidenced", async () => {
  const promptsDir = join(tempRoot, "COO", "intelligence");
  await mkdir(promptsDir, { recursive: true });
  await writeFile(join(promptsDir, "prompt.md"), "You are the COO of ADF.", "utf-8");

  const output = await renderStatusWithAgent({
    projectRoot: tempRoot,
    promptsDir,
    facts: {
      collectedAt: "2026-04-05T00:00:00.000Z",
      sourcePartition: "proof",
      sourceFreshnessAgeMs: 0,
      sourceAvailability: [],
      companyScopePath: "assafyavnai/adf/phase1",
      features: [],
    } as any,
    brief: {
      issues: [],
      onTheTable: [],
      inMotion: [],
      whatsNext: [],
      diagnostics: {
        counts: {
          issuesExpected: 0,
          issuesActual: 0,
          onTheTableExpected: 0,
          onTheTableActual: 0,
          inMotionExpected: 0,
          inMotionActual: 0,
          whatsNextExpected: 0,
          whatsNextActual: 0,
        },
      },
    } as any,
    governance: {
      companyScopePath: "assafyavnai/adf/phase1",
      statusNotes: [],
      landedAssessments: new Map(),
      additionalAttention: [
        {
          key: "issue:one-option",
          featureId: "feature-one",
          featureLabel: "Feature One",
          classification: "suspicious",
          summary: "Feature One needs a route fix",
          recommendation: "Patch Feature One",
          evidenceLine: "Derived from source evidence.",
          rootCause: "A route issue is still open.",
          systemFix: "Patch Feature One",
          businessImpact: "The issue remains open.",
          businessSeverity: "high",
          businessPriority: "now",
          routeChain: ["status", "closeout"],
          implicatedSubjects: ["route:status"],
        },
      ],
      additionalTable: [],
      additionalNext: [],
      deepAudit: null,
      trustNotes: [],
      currentThread: {
        threadId: null,
        activeWorkflow: null,
        onionLayer: null,
        scopePath: "assafyavnai/adf/phase1",
        lastStateCommitAt: null,
      },
      operatingState: {
        schemaVersion: 1,
        baselineEstablishedAt: "2026-04-05T00:00:00.000Z",
        lastDeepAuditAt: null,
        lastDeepAuditTrigger: null,
        lastDeepAuditScope: null,
        lastDeepAuditJustified: null,
        trackedIssues: {
          "issue:one-option": {
            key: "issue:one-option",
            featureId: "feature-one",
            featureLabel: "Feature One",
            classification: "suspicious",
            summary: "Feature One needs a route fix",
            recommendation: "Patch Feature One",
            evidenceLine: "Derived from source evidence.",
            rootCause: "A route issue is still open.",
            systemFix: "Patch Feature One",
            businessImpact: "The issue remains open.",
            businessSeverity: "high",
            businessPriority: "now",
            routeChain: ["status", "closeout"],
            implicatedSubjects: ["route:status"],
            brainFindingId: null,
            brainOpenLoopId: null,
            status: "open",
            firstSeenAt: "2026-04-05T00:00:00.000Z",
            lastSeenAt: "2026-04-05T00:00:00.000Z",
            readyHandoff: {
              id: "handoff:feature-one",
              taskSummary: "Patch Feature One",
              scopePath: "assafyavnai/adf/phase1/feature-one",
              preparedAt: "2026-04-05T00:00:00.000Z",
              evidenceDigest: "Feature One issue",
              implicatedSubjects: ["route:status"],
              status: "ready_if_approved",
            },
          },
        },
        trustSubjects: {},
        auditHistory: [],
        triggerTuning: {
          contradictionSensitivity: 1,
          stalePressureDays: 7,
          companyEscalationThreshold: 2,
          lastChangedAt: "2026-04-05T00:00:00.000Z",
          lastChangedReason: null,
        },
      },
    } as any,
    surface: {
      opening: "Overall, the company is stable.",
    } as any,
    statusWindow: null,
    intelligenceParams: {
      cli: "codex",
      model: "gpt-5.4",
      reasoning: "medium",
      bypass: true,
      timeout_ms: 5_000,
    },
    invokeLLM: async () => ({
      provenance: {
        invocation_id: "status-agent-one-option",
        provider: "codex",
        model: "gpt-5.4",
        reasoning: "medium",
        was_fallback: false,
        source_path: "test",
        timestamp: "2026-04-05T00:00:00.000Z",
      },
      response: "Overall, the company is stable.\n\n## Issues That Need Your Attention\n- Feature One needs a route fix.\n\n## On The Table\nNo open items.\n\n## In Motion\nNothing active.\n\nWhere would you like to focus?\n\n1. **Feature One** (Recommended)\n2. **Other** - type what you need",
      latency_ms: 1,
      attempts: [],
    }),
  });

  assert.ok(output.includes("## Issues That Need Your Attention"));
  assert.ok(output.includes("## On The Table"));
  assert.ok(output.includes("## In Motion"));
  assert.ok(!output.includes("Where would you like to focus?"));
  assert.equal(output.split("\n").filter((line) => /^\d+\.\s/.test(line.trim())).length, 0);
});

test("live agent evidence pack only marks truly recent landed work as recent", async () => {
  const fixture = await createFixture({ includeAdmissions: false });
  await writeCompletedFeatureTruth({
    featureSlug: "feature-stale-landed",
    updatedAt: "2026-03-01T10:00:00.000Z",
    contextCollectedAt: "2026-03-01T09:00:00.000Z",
    closeoutFinishedAt: "2026-03-01T10:00:00.000Z",
    reviewCycles: 1,
    completionSummary: "Token cost unavailable.",
    reviewFinding: null,
  });
  await writeCompletedFeatureTruth({
    featureSlug: "feature-recent-landed",
    updatedAt: "2026-04-05T16:04:00.000Z",
    contextCollectedAt: "2026-04-05T14:00:00.000Z",
    closeoutFinishedAt: "2026-04-05T16:04:00.000Z",
    reviewCycles: 1,
    completionSummary: "Token cost unavailable.",
    reviewFinding: null,
  });
  const promptsDir = join(tempRoot, "COO", "intelligence");
  await mkdir(promptsDir, { recursive: true });
  await writeFile(join(promptsDir, "prompt.md"), "You are the COO of ADF.", "utf-8");

  let capturedPrompt = "";
  await buildLiveExecutiveStatus({
    projectRoot: tempRoot,
    threadsDir: fixture.threadsDir,
    brainClient: fixture.brainClient,
    sourcePartition: "proof",
    statusScopePath: "assafyavnai/adf/phase1",
    promptsDir,
    intelligenceParams: {
      cli: "codex",
      model: "gpt-5.4",
      reasoning: "medium",
      bypass: true,
      timeout_ms: 5_000,
    },
    invokeLLM: async (params) => {
      capturedPrompt = params.prompt;
      return {
        provenance: {
          invocation_id: "status-agent-recent",
          provider: "codex",
          model: "gpt-5.4",
          reasoning: "medium",
          was_fallback: false,
          source_path: "test",
          timestamp: "2026-04-05T00:00:00.000Z",
        },
        response: "Overall, the company is steady.\n\n**Recent landings:**\n- Feature Recent Landed (1 review cycle, approval before merge proved)\n\n## Issues That Need Your Attention\nNo immediate issues.\n\n## On The Table\nNo open items.\n\n## In Motion\nNothing active.\n\nWhere would you like to focus?\n\n1. **Feature Recent Landed** (Recommended)\n2. **Feature Moving**\n3. **Other** - type what you need",
        latency_ms: 1,
        attempts: [],
      };
    },
  });

  const evidence = extractStatusEvidence(capturedPrompt);
  assert.equal(evidence.company_performance.recent_landed_count, 1);
  assert.equal(evidence.recent_landings_compact.length, 1);
  assert.match(JSON.stringify(evidence.recent_landings_compact), /Feature Recent Landed/);
  assert.doesNotMatch(JSON.stringify(evidence.recent_landings_compact), /Feature Stale Landed/);
});

test("status-window anchor only advances after a successful status render", async () => {
  const fixture = await createFixture({ includeAdmissions: true });
  const promptsDir = join(tempRoot, "COO", "intelligence");
  await mkdir(promptsDir, { recursive: true });
  await writeFile(join(promptsDir, "prompt.md"), "You are the COO of ADF.", "utf-8");
  const anchorPath = join(tempRoot, ".codex", "runtime", "coo-live-status-window.json");
  const originalAnchor = {
    renderedAt: "2026-04-01T00:00:00.000Z",
    headCommit: "old-head",
  };
  await writeJson(anchorPath, originalAnchor);

  await assert.rejects(
    buildLiveExecutiveStatus({
      projectRoot: tempRoot,
      threadsDir: fixture.threadsDir,
      brainClient: fixture.brainClient,
      sourcePartition: "proof",
      statusScopePath: "assafyavnai/adf/phase1",
      promptsDir,
      intelligenceParams: {
        cli: "codex",
        model: "gpt-5.4",
        reasoning: "medium",
        bypass: true,
        timeout_ms: 5_000,
      },
      invokeLLM: async () => {
        throw new Error("synthetic render failure");
      },
    }),
    /synthetic render failure/i,
  );

  const afterFailure = JSON.parse(await readFile(anchorPath, "utf-8"));
  assert.deepEqual(afterFailure, originalAnchor);

  await buildLiveExecutiveStatus({
    projectRoot: tempRoot,
    threadsDir: fixture.threadsDir,
    brainClient: fixture.brainClient,
    sourcePartition: "proof",
    statusScopePath: "assafyavnai/adf/phase1",
    promptsDir,
    intelligenceParams: {
      cli: "codex",
      model: "gpt-5.4",
      reasoning: "medium",
      bypass: true,
      timeout_ms: 5_000,
    },
    invokeLLM: async () => ({
      provenance: {
        invocation_id: "status-agent-success",
        provider: "codex",
        model: "gpt-5.4",
        reasoning: "medium",
        was_fallback: false,
        source_path: "test",
        timestamp: "2026-04-05T00:00:00.000Z",
      },
      response: "Overall, the company is steady.\n\n## Issues That Need Your Attention\nNo immediate issues.\n\n## On The Table\nNo open items.\n\n## In Motion\nNothing active.\n\nWhere would you like to focus?\n\n1. **Feature Moving** (Recommended)\n2. **Feature Next**\n3. **Other** - type what you need",
      latency_ms: 1,
      attempts: [],
    }),
  });

  const afterSuccess = JSON.parse(await readFile(anchorPath, "utf-8"));
  assert.notDeepEqual(afterSuccess, originalAnchor);
  assert.ok(typeof afterSuccess.renderedAt === "string");
});

test("tracked issues persist both Brain-backed findings and local ready handoffs for crash continuity", async () => {
  const fixture = await createFixture({ includeAdmissions: false });
  await writeCompletedFeatureTruth({
    featureSlug: "feature-kpi-gap",
    updatedAt: "2026-04-05T16:04:00.000Z",
    contextCollectedAt: "2026-04-05T14:00:00.000Z",
    closeoutFinishedAt: "2026-04-05T16:04:00.000Z",
    reviewCycles: 1,
    completionSummary: "Token cost unavailable.",
    reviewFinding: "Closeout evidence missed KPI totals",
  });
  await writeJson(join(tempRoot, "docs", "phase1", "coo-kpi-instrumentation", "implement-plan-state.json"), {
    updated_at: "2026-04-05T12:00:00.000Z",
    run_timestamps: {
      closeout_finished_at: "2026-04-05T12:00:00.000Z",
    },
  });

  const first = await buildLiveExecutiveStatus({
    projectRoot: tempRoot,
    threadsDir: fixture.threadsDir,
    brainClient: fixture.brainClient,
    sourcePartition: "proof",
    statusScopePath: "assafyavnai/adf/phase1",
  });

  const trackedIssue = fixture.brainClient.captured.find((entry) => entry.tags.includes("tracked-issue"));
  assert.ok(trackedIssue);
  assert.match(JSON.stringify(trackedIssue?.content), /ready_handoff/i);

  const persisted = JSON.parse(await readFile(join(tempRoot, ".codex", "runtime", "coo-operating-state.json"), "utf-8"));
  const persistedIssue = persisted.trackedIssues["landed:kpi-closeout-gap:feature-kpi-gap"];
  assert.ok(persistedIssue);
  assert.equal(persistedIssue.readyHandoff.status, "ready_if_approved");
  assert.match(persistedIssue.readyHandoff.id, /^handoff:/);
  assert.match(persistedIssue.rootCause, /closeout[- ](projection|route) gap/i);
  assert.match(persistedIssue.systemFix, /(persist run\.kpi_projection token totals|token totals survive into durable closeout truth)/i);
  assert.match(persistedIssue.businessImpact, /cannot fully audit delivery cost|cost auditability/i);
  assert.equal(persistedIssue.businessPriority, "now");
  assert.ok(Array.isArray(persistedIssue.routeChain));
  assert.ok(persistedIssue.routeChain.length >= 2);

  const second = await buildLiveExecutiveStatus({
    projectRoot: tempRoot,
    threadsDir: fixture.threadsDir,
    brainClient: fixture.brainClient,
    sourcePartition: "proof",
    statusScopePath: "assafyavnai/adf/phase1",
  });

  assert.ok(second.governance.operatingState.trackedIssues["landed:kpi-closeout-gap:feature-kpi-gap"]);
  assert.equal(
    second.governance.operatingState.trackedIssues["landed:kpi-closeout-gap:feature-kpi-gap"].readyHandoff.status,
    "ready_if_approved",
  );
  assert.ok(first.governance.additionalAttention.some((item) => item.featureId === "feature-kpi-gap"));
});

test("missing-source fallback stays explicit and source files are not mutated", async () => {
  const fixture = await createFixture({ includeAdmissions: false });
  const watchedPaths = [
    ...(await readdir(fixture.threadsDir)).map((entry) => join(fixture.threadsDir, entry)),
    join(tempRoot, ".codex", "implement-plan", "features-index.json"),
  ];
  const before = await Promise.all(watchedPaths.map((path) => readFile(path, "utf-8")));

  const result = await buildLiveExecutiveStatus({
    projectRoot: tempRoot,
    threadsDir: fixture.threadsDir,
    brainClient: fixture.brainClient,
    sourcePartition: "proof",
    statusScopePath: "assafyavnai/adf/phase1",
  });

  const after = await Promise.all(watchedPaths.map((path) => readFile(path, "utf-8")));
  assert.deepEqual(after, before);
  assert.ok(result.output.includes("Missing source families remain visible"));
  assert.ok(result.output.includes("CTO admission truth"));
});

async function createFixture(options: { includeAdmissions: boolean }): Promise<{
  threadsDir: string;
  brainClient: MockBrainClient;
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

  const brainClient = new MockBrainClient(new Map<string, Record<string, unknown>>([
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
  ]));

  return {
    threadsDir,
    brainClient,
  };
}

function countLineOccurrences(text: string, line: string): number {
  return text
    .split("\n")
    .map((entry) => entry.trim())
    .filter((entry) => entry === line)
    .length;
}

async function writeCompletedFeatureTruth(input: {
  featureSlug: string;
  updatedAt: string;
  contextCollectedAt: string;
  closeoutFinishedAt: string;
  reviewCycles: number;
  completionSummary: string;
  reviewFinding: string | null;
  mergeStatus?: string;
  approvedCommitSha?: string | null;
}): Promise<void> {
  const featureRoot = join(tempRoot, "docs", "phase1", input.featureSlug);
  await mkdir(featureRoot, { recursive: true });
  await writeJson(join(featureRoot, "implement-plan-state.json"), {
    phase_number: 1,
    feature_slug: input.featureSlug,
    feature_status: "completed",
    active_run_status: "completed",
    merge_status: input.mergeStatus ?? "merged",
    last_completed_step: "marked_complete",
    updated_at: input.updatedAt,
    created_at: input.contextCollectedAt,
    merge_commit_sha: "merge-commit-sha",
    approved_commit_sha: input.approvedCommitSha === undefined ? "approved-commit-sha" : input.approvedCommitSha,
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

async function writeGovernanceMilestones(): Promise<void> {
  await writeJson(join(tempRoot, "docs", "phase1", "implement-plan-verification-and-approval-flow", "implement-plan-state.json"), {
    updated_at: "2026-04-04T12:00:00.000Z",
    run_timestamps: {
      closeout_finished_at: "2026-04-04T12:00:00.000Z",
    },
  });
  await writeJson(join(tempRoot, "docs", "phase1", "coo-kpi-instrumentation", "implement-plan-state.json"), {
    updated_at: "2026-04-04T12:00:00.000Z",
    run_timestamps: {
      closeout_finished_at: "2026-04-04T12:00:00.000Z",
    },
  });
}

async function seedOperatingState(partial: Record<string, unknown>): Promise<void> {
  await writeJson(join(tempRoot, ".codex", "runtime", "coo-operating-state.json"), {
    schemaVersion: 1,
    baselineEstablishedAt: "2026-04-04T10:00:00.000Z",
    lastDeepAuditAt: null,
    lastDeepAuditTrigger: null,
    lastDeepAuditScope: null,
    lastDeepAuditJustified: null,
    lastSensitivityAssessment: null,
    deepAuditCounter: 0,
    unjustifiedAuditStreak: 0,
    triggerConfig: {
      suspiciousFindingThreshold: 1,
      ambiguityThreshold: 2,
      stalePressureDays: 14,
      companyEscalationThreshold: 2,
      fullTrustScore: 85,
      trustedScore: 70,
      guardedScore: 40,
    },
    trustSubjects: {},
    trackedIssues: {},
    rebasedRuleRecordedAt: "2026-04-04T10:00:00.000Z",
    lastTuningChangeAt: null,
    lastTuningChangeNote: null,
    ...partial,
  });
}

async function writeAdmissionArtifacts(
  featureSlug: string,
  decision: "admit" | "defer" | "block",
  decisionReason: string,
): Promise<void> {
  const featureRoot = join(tempRoot, "docs", "phase1", featureSlug);
  await mkdir(featureRoot, { recursive: true });
  await writeJson(join(featureRoot, "cto-admission-request.json"), {
    feature_slug: featureSlug,
    packet_built_at: "2026-04-03T16:00:00.000Z",
  });
  await writeJson(join(featureRoot, "cto-admission-decision.template.json"), {
    feature_slug: featureSlug,
    decision,
    decision_reason: decisionReason,
    decided_at: "2026-04-03T16:05:00.000Z",
    dependency_blocked: false,
    scope_conflict_detected: false,
  });
}

function makeOnionThread(input: {
  scopePath: string;
  topic: string;
  lifecycleStatus: "active" | "awaiting_freeze_approval" | "approved" | "handoff_ready" | "blocked";
  currentLayer: "topic" | "goal" | "expected_result" | "success_view" | "major_parts" | "part_clarification" | "experience_ui" | "boundaries" | "open_decisions" | "whole_onion_freeze" | "approved";
  blockers: string[];
  openDecisions: Array<{ id: string; question: string; impact: string; status: "open" | "resolved" }>;
  openLoops: string[];
  finalizedRequirementMemoryId: string | null;
  updatedAt?: string;
}): Thread {
  const updatedAt = input.updatedAt ?? "2026-04-03T16:00:00.000Z";
  const thread = createThread(input.scopePath);
  thread.createdAt = updatedAt;
  thread.updatedAt = updatedAt;

  const state = createEmptyOnionState();
  state.topic = input.topic;
  state.goal = `${input.topic} business goal`;
  state.expected_result = `${input.topic} expected result`;
  state.success_view = `${input.topic} success view`;
  state.open_decisions = input.openDecisions.map((decision) => ({
    id: decision.id,
    question: decision.question,
    impact: decision.impact,
    status: decision.status,
  }));
  state.freeze_status = {
    status: input.blockers.length > 0
      ? "blocked"
      : input.lifecycleStatus === "awaiting_freeze_approval"
        ? "ready_to_request"
        : input.lifecycleStatus === "approved" || input.lifecycleStatus === "handoff_ready" || input.lifecycleStatus === "blocked"
          ? "approved"
          : "draft",
    blockers: input.blockers,
    approved_turn_id: input.lifecycleStatus === "approved" || input.lifecycleStatus === "handoff_ready" || input.lifecycleStatus === "blocked"
      ? "turn-approved"
      : undefined,
    approval_note: input.lifecycleStatus === "approved" || input.lifecycleStatus === "handoff_ready" || input.lifecycleStatus === "blocked"
      ? "Approved for handoff"
      : undefined,
  };
  if (input.lifecycleStatus === "approved" || input.lifecycleStatus === "handoff_ready" || input.lifecycleStatus === "blocked") {
    state.approved_snapshot = createApprovedOnionSnapshot(state, "turn-approved", updatedAt);
  }

  const workingArtifact = {
    schema_version: "1.0" as const,
    artifact_kind: "working_scope" as const,
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
    scope_summary: [
      `Topic: ${state.topic}`,
      `Goal: ${state.goal}`,
    ],
  };

  thread.workflowState = {
    active_workflow: "requirements_gathering_onion",
    onion: {
      trace_id: `trace:${input.scopePath}`,
      last_turn_id: "turn-latest",
      lifecycle_status: input.lifecycleStatus,
      current_layer: input.currentLayer,
      selected_next_question: input.lifecycleStatus === "active" ? "What still needs clarification?" : null,
      no_question_reason: input.lifecycleStatus === "handoff_ready" ? "Scope is frozen and ready for handoff." : null,
      state,
      working_artifact: workingArtifact,
      requirement_artifact: null,
      finalized_requirement_memory_id: input.finalizedRequirementMemoryId,
      latest_audit_trace: {
        trace_id: `trace:${input.scopePath}`,
        turn_id: "turn-latest",
        current_layer: input.currentLayer,
        workflow_step: input.lifecycleStatus === "handoff_ready" ? "freeze_gate" : "clarification",
        decision_reason: input.blockers[0] ?? `${input.topic} remains in live COO shaping.`,
        selected_next_question: input.lifecycleStatus === "active" ? "What still needs clarification?" : null,
        no_question_reason: input.lifecycleStatus === "handoff_ready" ? "Scope is frozen and ready for handoff." : null,
        freeze_blockers: input.blockers,
        open_decisions_snapshot: state.open_decisions,
        artifact_change_summary: [`Updated ${input.topic} thread state.`],
        result_status: input.blockers.length > 0
          ? "blocked"
          : input.lifecycleStatus === "handoff_ready"
            ? "freeze_ready"
            : "clarification_needed",
      },
      latest_llm_calls: [],
      latest_persistence_receipts: [],
    },
  };
  thread.events.push(createEvent("state_commit", {
    summary: `${input.topic} latest checkpoint.`,
    openLoops: input.openLoops,
    decisions: input.openDecisions.filter((decision) => decision.status === "resolved").map((decision) => decision.question),
  }));

  return thread;
}

async function writeThread(threadsDir: string, thread: Thread): Promise<void> {
  await writeJson(join(threadsDir, `${thread.id}.json`), thread);
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf-8");
}

async function firstThreadId(threadsDir: string): Promise<string> {
  const entries = (await readdir(threadsDir))
    .filter((entry) => entry.endsWith(".json"))
    .sort((left, right) => left.localeCompare(right));
  assert.ok(entries.length > 0, "Expected at least one thread fixture.");
  return entries[0].replace(/\.json$/i, "");
}

function assertEventPresent(operation: string): void {
  assert.ok(
    capturedEvents.some((event) => event.operation === operation),
    `Expected telemetry event ${operation} to be emitted.`,
  );
}

function extractStatusEvidence(prompt: string): Record<string, any> {
  const match = prompt.match(/<status_evidence>\n([\s\S]*?)\n<\/status_evidence>/);
  assert.ok(match, "Expected a <status_evidence> block in the captured prompt.");
  return JSON.parse(match[1]);
}
