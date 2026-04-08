import test, { afterEach, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
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
import { inspectGitStatusWindow } from "./status-window.js";
import { renderStatusWithAgent } from "../briefing/status-render-agent.js";
import { assessSupportedLiveStatusBody } from "../briefing/status-render-agent.js";
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
  assertExecutiveBriefShape(result.output);
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

  assertExecutiveBriefShape(result.output);
  assert.doesNotMatch(result.output, /review governance should have applied/i);
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

  assertExecutiveBriefShape(result.output);
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

  assertExecutiveBriefShape(result.output);
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
  assertExecutiveBriefShape(result.output);
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

  assertExecutiveBriefShape(result.output);
  assert.ok(result.governance.additionalNext.length > 0);
});

test("deterministic fallback surface uses the same executive brief contract when prompts are unavailable", async () => {
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

  assertExecutiveBriefShape(result.output);
  assert.ok(!result.output.includes("Operational context:"));
  assert.ok(!result.output.includes("## Issues That Need Your Attention"));
  assert.ok(!result.output.includes("## What's Next"));
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
  assertExecutiveBriefShape(result.output);
  assert.equal(countLineOccurrences(result.output, "**Bottom line**"), 1);
  assert.equal(countLineOccurrences(result.output, "**Delivery health**"), 1);
  assert.equal(countLineOccurrences(result.output, "**Issues that need a decision**"), 1);
  assert.equal(countLineOccurrences(result.output, "**Parked / waiting**"), 1);
  assert.equal(countLineOccurrences(result.output, "**Recommendation**"), 1);
  assert.ok(result.output.includes("Where would you like to focus?"));
  assert.ok(result.output.includes("1. **"));
  assert.ok(result.output.includes("2. **"));
  assert.match(result.output, /^4\.\s\*\*Other\*\* - type what you need$/m);
  assert.equal(countFocusOptionLines(result.output), 4);
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

test("renderStatusWithAgent rejects structurally valid but evidence-dropping live output and falls back to the evidence-backed body", async () => {
  const promptsDir = join(tempRoot, "COO", "intelligence");
  await mkdir(promptsDir, { recursive: true });
  await writeFile(join(promptsDir, "prompt.md"), "You are the COO of ADF.", "utf-8");

  const context = {
    facts: {
      collectedAt: "2026-04-05T00:00:00.000Z",
      sourcePartition: "proof",
      sourceFreshnessAgeMs: 0,
      sourceAvailability: [],
      companyScopePath: "assafyavnai/adf/phase1",
      features: [
        {
          id: "feature-landed",
          label: "Feature Landed",
          status: "completed",
          lastActivityAt: "2026-04-05T00:00:00.000Z",
          missingSourceFamilies: [],
          evidence: { type: "direct_source" },
          completion: {
            mergedAt: "2026-04-05T00:00:00.000Z",
            reviewCycles: 1,
            tokenCostTokens: null,
            timing: null,
            keyIssue: null,
          },
        },
      ],
    } as any,
    brief: {
      issues: [],
      onTheTable: [
        {
          featureId: "feature-table",
          featureLabel: "Feature Table",
          summary: "Feature Table is awaiting a decision.",
        },
      ],
      inMotion: [
        {
          featureId: "feature-moving",
          featureLabel: "Feature Moving",
          progressSummary: "Feature Moving is actively executing.",
        },
      ],
      whatsNext: [],
      diagnostics: {
        counts: {
          issuesExpected: 0,
          issuesActual: 0,
          onTheTableExpected: 1,
          onTheTableActual: 1,
          inMotionExpected: 1,
          inMotionActual: 1,
          whatsNextExpected: 0,
          whatsNextActual: 0,
        },
      },
    } as any,
    governance: {
      companyScopePath: "assafyavnai/adf/phase1",
      statusNotes: [],
      landedAssessments: new Map([
        ["feature-landed", {
          classification: "suspicious",
          primaryConcern: "kpi",
          reviewAssessmentLine: "Review check: 1 completed review cycle is recorded.",
          approvalAssessmentLine: "Approval check: approved commit is recorded before merge.",
          tokenAssessmentLine: "KPI check: token cost is unavailable even though KPI capture was already live when this feature landed.",
          timingAssessmentLine: "Timing check: route only proves elapsed lifecycle time.",
          cooReadLine: "This is a route-quality problem.",
          recommendation: "Patch the closeout route.",
          businessImpact: "Cost visibility is incomplete.",
          businessSeverity: "high",
          businessPriority: "now",
          routeChain: ["implement-plan", "closeout", "status"],
          implicatedSubjects: ["route:implement-plan-closeout"],
        }],
      ]),
      additionalAttention: [
        {
          key: "issue:feature-one",
          featureId: "feature-one",
          featureLabel: "Feature One",
          classification: "suspicious",
          summary: "Feature One needs a route fix",
          recommendation: "Patch the route closeout path.",
          evidenceLine: "Direct source; fresh; high confidence.",
          rootCause: "The closeout route is dropping durable evidence.",
          systemFix: "Patch the closeout route and backfill the affected slices.",
          businessImpact: "Leadership loses cost visibility.",
          businessSeverity: "high",
          businessPriority: "now",
          routeChain: ["implement-plan", "closeout", "status"],
          implicatedSubjects: ["route:implement-plan-closeout"],
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
          "issue:feature-one": {
            key: "issue:feature-one",
            featureId: "feature-one",
            featureLabel: "Feature One",
            classification: "suspicious",
            summary: "Feature One needs a route fix",
            recommendation: "Patch the route closeout path.",
            evidenceLine: "Direct source; fresh; high confidence.",
            rootCause: "The closeout route is dropping durable evidence.",
            systemFix: "Patch the closeout route and backfill the affected slices.",
            businessImpact: "Leadership loses cost visibility.",
            businessSeverity: "high",
            businessPriority: "now",
            routeChain: ["implement-plan", "closeout", "status"],
            implicatedSubjects: ["route:implement-plan-closeout"],
            brainFindingId: null,
            brainOpenLoopId: null,
            status: "open",
            firstSeenAt: "2026-04-05T00:00:00.000Z",
            lastSeenAt: "2026-04-05T00:00:00.000Z",
            readyHandoff: {
              id: "handoff:feature-one",
              taskSummary: "Patch the closeout route and backfill the affected slices.",
              scopePath: "assafyavnai/adf/phase1/feature-one",
              preparedAt: "2026-04-05T00:00:00.000Z",
              evidenceDigest: "Closeout route gap",
              implicatedSubjects: ["route:implement-plan-closeout"],
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
      statusWindow: null,
      statusNotes: [],
      landed: [],
      issues: [
        {
          key: "issue:feature-one",
          featureId: "feature-one",
          featureLabel: "Feature One",
          summary: "Feature One needs a route fix",
          recommendation: "Patch the closeout route and backfill the affected slices.",
          severity: "high",
          priority: "now",
          actionLabel: "Fix action",
          evidenceLine: "Direct source; fresh; high confidence.",
        },
      ],
      onTheTable: [
        {
          key: "table:feature-table",
          featureId: "feature-table",
          featureLabel: "Feature Table",
          summary: "Feature Table is awaiting a decision.",
          recommendation: "Review the pending decision.",
          severity: "medium",
          priority: "next",
          actionLabel: "Next move",
          evidenceLine: "Derived from source evidence.",
        },
      ],
      inMotion: [
        {
          key: "motion:feature-moving",
          featureId: "feature-moving",
          featureLabel: "Feature Moving",
          summary: "Feature Moving is actively executing.",
          recommendation: null,
          severity: null,
          priority: null,
          actionLabel: null,
          evidenceLine: "Direct source; fresh; high confidence.",
        },
      ],
      whatsNext: [],
      operationalFooter: null,
    } as any,
    statusWindow: null,
  };

  const structurallyValidButWrong = [
    "Overall, everything looks calm.",
    "",
    "**Recent landings:**",
    "- Feature Landed (1 review cycle, approval before merge proved)",
    "",
    "## Issues That Need Your Attention",
    "No immediate issues.",
    "",
    "## On The Table",
    "No open items.",
    "",
    "## In Motion",
    "Nothing active.",
    "",
    "My recommendation is to focus on Unrelated One first.",
    "",
    "Where would you like to focus?",
    "",
    "1. **Unrelated One** (Recommended)",
    "2. **Unrelated Two**",
    "3. **Other** - type what you need",
  ].join("\n");

  const assessment = assessSupportedLiveStatusBody(structurallyValidButWrong, context);
  assert.match(assessment.violations.join(","), /parity:issues/);
  assert.match(assessment.violations.join(","), /parity:on-the-table/);
  assert.match(assessment.violations.join(","), /parity:in-motion/);
  assert.match(assessment.violations.join(","), /parity:focus-options/);

  const output = await renderStatusWithAgent({
    projectRoot: tempRoot,
    promptsDir,
    ...context,
    surface: context.surface,
    intelligenceParams: {
      cli: "codex",
      model: "gpt-5.4",
      reasoning: "medium",
      bypass: true,
      timeout_ms: 5_000,
    },
    invokeLLM: async () => ({
      provenance: {
        invocation_id: "status-agent-structural-drift",
        provider: "codex",
        model: "gpt-5.4",
        reasoning: "medium",
        was_fallback: false,
        source_path: "test",
        timestamp: "2026-04-05T00:00:00.000Z",
      },
      response: structurallyValidButWrong,
      latency_ms: 1,
      attempts: [],
    }),
  });

  assertExecutiveBriefShape(output);
  assert.match(output, /Cost auditability gap/);
  assert.match(output, /patch the closeout route and backfill the affected slices/i);
  assert.ok(output.includes("Feature Table"));
  assert.ok(output.includes("1. **Cost auditability gap** (Recommended)"));
  assert.ok(!output.includes("Unrelated One"));
  assert.ok(!output.includes("No immediate issues."));
  assert.ok(!output.includes("No open items."));
  assert.ok(!output.includes("Nothing active."));
});

test("prompt-backed issue parity includes brief-generated issues even when governance additionalAttention is empty", async () => {
  const promptsDir = join(tempRoot, "COO", "intelligence");
  await mkdir(promptsDir, { recursive: true });
  await writeFile(join(promptsDir, "prompt.md"), "You are the COO of ADF.", "utf-8");

  const context = {
    facts: {
      collectedAt: "2026-04-05T00:00:00.000Z",
      sourcePartition: "proof",
      sourceFreshnessAgeMs: 0,
      sourceAvailability: [],
      companyScopePath: "assafyavnai/adf/phase1",
      features: [
        {
          id: "feature-blocked",
          label: "Feature Blocked",
          status: "blocked",
          lastActivityAt: "2026-04-05T00:00:00.000Z",
          missingSourceFamilies: [],
          evidence: { type: "direct_source" },
          nextAction: "Unblock the missing dependency before resuming work.",
        },
      ],
    } as any,
    brief: {
      issues: [
        {
          featureId: "feature-blocked",
          featureLabel: "Feature Blocked",
          headline: "Feature Blocked is waiting on an unresolved dependency.",
          details: ["Unblock the missing dependency before resuming work."],
        },
      ],
      onTheTable: [],
      inMotion: [],
      whatsNext: [],
      diagnostics: {
        counts: {
          issuesExpected: 1,
          issuesActual: 1,
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
      additionalAttention: [],
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
        trackedIssues: {},
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
      opening: "Overall, one blocked item needs attention.",
      statusWindow: null,
      statusNotes: [],
      landed: [],
      issues: [
        {
          key: "issue:feature-blocked",
          featureId: "feature-blocked",
          featureLabel: "Feature Blocked",
          summary: "Feature Blocked is waiting on an unresolved dependency.",
          recommendation: "Unblock the missing dependency before resuming work.",
          severity: "high",
          priority: "now",
          actionLabel: "Fix action",
          evidenceLine: "The blocker comes directly from live COO thread/onion truth.",
        },
      ],
      onTheTable: [],
      inMotion: [],
      whatsNext: [],
      operationalFooter: null,
    } as any,
    statusWindow: null,
  };

  const structurallyValidButWrong = [
    "Overall, everything looks calm.",
    "",
    "## Issues That Need Your Attention",
    "No immediate issues.",
    "",
    "## On The Table",
    "No open items.",
    "",
    "## In Motion",
    "Nothing active.",
  ].join("\n");

  const assessment = assessSupportedLiveStatusBody(structurallyValidButWrong, context);
  assert.match(assessment.violations.join(","), /parity:issues/);
  assert.equal(assessment.visibility.issuesExpected, 1);
  assert.equal(assessment.visibility.issuesActual, 0);

  const output = await renderStatusWithAgent({
    projectRoot: tempRoot,
    promptsDir,
    ...context,
    intelligenceParams: {
      cli: "codex",
      model: "gpt-5.4",
      reasoning: "medium",
      bypass: true,
      timeout_ms: 5_000,
    },
    invokeLLM: async () => ({
      provenance: {
        invocation_id: "status-agent-brief-issue",
        provider: "codex",
        model: "gpt-5.4",
        reasoning: "medium",
        was_fallback: false,
        source_path: "test",
        timestamp: "2026-04-05T00:00:00.000Z",
      },
      response: structurallyValidButWrong,
      latency_ms: 1,
      attempts: [],
    }),
  });

  assert.ok(output.includes("Feature Blocked is waiting on an unresolved dependency."));
  assert.ok(output.includes("Fix: Unblock the missing dependency before resuming work."));
  assert.ok(!output.includes("No immediate issues."));
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
      statusWindow: null,
      statusNotes: [],
      landed: [],
      issues: [
        {
          key: "issue:one-option",
          featureId: "feature-one",
          featureLabel: "Feature One",
          summary: "Feature One needs a route fix",
          recommendation: "Patch Feature One",
          severity: "high",
          priority: "now",
          actionLabel: "Fix action",
          evidenceLine: "Derived from source evidence.",
        },
      ],
      onTheTable: [],
      inMotion: [],
      whatsNext: [],
      operationalFooter: null,
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

  assertExecutiveBriefShape(output);
  assert.ok(!output.includes("Where would you like to focus?"));
});

test("renderStatusWithAgent keeps a single ready-to-start slice visible in parked waiting even without focus options", async () => {
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
      whatsNext: [
        {
          featureId: "feature-next",
          featureLabel: "Feature Next",
          nextAction: "Start implementation for Feature Next",
        },
      ],
      diagnostics: {
        counts: {
          issuesExpected: 0,
          issuesActual: 0,
          onTheTableExpected: 0,
          onTheTableActual: 0,
          inMotionExpected: 0,
          inMotionActual: 0,
          whatsNextExpected: 1,
          whatsNextActual: 1,
        },
      },
    } as any,
    governance: {
      companyScopePath: "assafyavnai/adf/phase1",
      statusNotes: [],
      landedAssessments: new Map(),
      additionalAttention: [],
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
        trackedIssues: {},
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
      opening: "Overall, one slice is ready to start.",
      statusWindow: null,
      statusNotes: [],
      landed: [],
      issues: [],
      onTheTable: [],
      inMotion: [],
      whatsNext: [
        {
          featureId: "feature-next",
          featureLabel: "Feature Next",
          nextAction: "Start implementation for Feature Next",
        },
      ],
      operationalFooter: null,
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
        invocation_id: "status-agent-single-next",
        provider: "codex",
        model: "gpt-5.4",
        reasoning: "medium",
        was_fallback: false,
        source_path: "test",
        timestamp: "2026-04-05T00:00:00.000Z",
      },
      response: "Overall, the company is steady.\n\n**Bottom line**\n\nNothing is actively executing right now. No systemic issue needs your decision right now.\n\n---\n\n**Delivery health**\n\n- The work looks solid; the remaining questions are about route quality, not delivery quality.\n\n---\n\n**Issues that need a decision**\n\nNo systemic issue needs your decision right now.\n\n---\n\n**Parked / waiting**\n\n- Nothing material is parked or waiting right now.\n\n---\n\n**Recommendation**\n\nNo new escalation is stronger than the work already on the table.",
      latency_ms: 1,
      attempts: [],
    }),
  });

  assertExecutiveBriefShape(output);
  assert.ok(output.includes("Feature Next"));
});

test("status-window raises a first-run red flag when the current implement-plan worktree slice is missing from the COO surface", async () => {
  await initGitRepo(tempRoot);
  const projectRoot = join(tempRoot, ".codex", "implement-plan", "worktrees", "phase1", "feature-dashboard-blind-spot");
  await mkdir(projectRoot, { recursive: true });

  const statusWindow = await inspectGitStatusWindow({
    projectRoot,
    currentRenderedAt: "2026-04-05T00:00:00.000Z",
    previousAnchor: null,
    surfacedFeatureIds: [],
  });

  assert.equal(statusWindow.verificationBasis, "baseline_not_established");
  assert.equal(statusWindow.redFlag, true);
  assert.deepEqual(statusWindow.currentWorktreeFeatureSlugs, ["feature-dashboard-blind-spot"]);
  assert.deepEqual(statusWindow.droppedFeatureSlugs, ["feature-dashboard-blind-spot"]);
  assert.deepEqual(statusWindow.visibilityGapSources, ["current_worktree"]);
  assert.match(statusWindow.verificationNotes.join(" "), /current implement-plan worktree activity/i);
});

test("renderStatusWithAgent ranks a COO dashboard blind spot ahead of the KPI gap", async () => {
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
          key: "kpi-gap",
          title: "The implement-plan closeout route is dropping post-rollout KPI token totals from durable closeout truth.",
          summary: "The implement-plan closeout route is dropping post-rollout KPI token totals from durable closeout truth.",
          why: "Post-rollout KPI totals are missing from durable closeout truth.",
          impact: "Without durable token totals on post-rollout landings, the COO cannot fully audit delivery cost or compare company efficiency across recent work.",
          recommendation: "Patch the implement-plan closeout projection so post-rollout landings persist KPI token totals into durable truth, then backfill the affected landed slices.",
          system_fix: "Patch the implement-plan closeout projection so post-rollout landings persist KPI token totals into durable truth, then backfill the affected landed slices.",
          severity: "high",
          priority: "now",
          routeChain: [
            "Recent landed slices rely on implement-plan closeout for durable KPI totals.",
            "Those totals are dropping out after rollout closeout completes.",
          ],
          affected_count: 15,
          affected_feature_labels: ["Feature Cost One", "Feature Cost Two"],
          representative_handoff: {
            id: "handoff:kpi-gap",
            task_summary: "Fix the KPI closeout gap.",
          },
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
        trackedIssues: {},
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
      statusWindow: null,
      statusNotes: [],
      landed: [],
      issues: [],
      onTheTable: [],
      inMotion: [],
      whatsNext: [],
      operationalFooter: null,
    } as any,
    statusWindow: {
      currentRenderedAt: "2026-04-05T00:00:00.000Z",
      previousRenderedAt: null,
      previousHeadCommit: null,
      currentHeadCommit: "abc123",
      verificationBasis: "baseline_not_established",
      gitAvailable: true,
      commitsSincePrevious: 0,
      changedFeatureSlugs: [],
      droppedFeatureSlugs: ["coo-live-executive-status-wiring"],
      currentWorktreeFeatureSlugs: ["coo-live-executive-status-wiring"],
      visibilityGapSources: ["current_worktree"],
      verificationNotes: ["Red flag: current implement-plan worktree activity on coo-live-executive-status-wiring is missing from the COO surface."],
      redFlag: true,
    } as any,
    intelligenceParams: {
      cli: "codex",
      model: "gpt-5.4",
      reasoning: "medium",
      bypass: true,
      timeout_ms: 5_000,
    },
    invokeLLM: async () => ({
      provenance: {
        invocation_id: "status-agent-priority",
        provider: "codex",
        model: "gpt-5.4",
        reasoning: "medium",
        was_fallback: false,
        source_path: "test",
        timestamp: "2026-04-05T00:00:00.000Z",
      },
      response: "Malformed output",
      latency_ms: 1,
      attempts: [],
    }),
  });

  assertExecutiveBriefShape(output);
  assert.match(output, /1\.\s+COO dashboard blind spot/i);
  assert.match(output, /2\.\s+Cost auditability gap/i);
  assert.match(output, /Fix COO dashboard blind spot first, then cost auditability gap\./i);
});

test("renderStatusWithAgent keeps non-KPI findings distinct when KPI gaps also exist", async () => {
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
      features: [
        {
          id: "feature-landed-kpi",
          label: "Feature Landed KPI",
          status: "completed",
          lastActivityAt: "2026-04-05T00:00:00.000Z",
          openLoops: [],
          openDecisions: [],
          currentLayer: null,
          progressSummary: "Completed cleanly.",
          blockers: [],
          isFinalized: true,
          briefingState: "closeout",
          nextAction: null,
          sourceFamilies: ["implement_plan"],
          missingSourceFamilies: [],
          evidence: {},
          completion: {
            mergedAt: "2026-04-05T00:00:00.000Z",
            reviewCycles: 1,
            tokenCostTokens: null,
            timing: null,
            keyIssue: null,
          },
        },
      ],
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
      landedAssessments: new Map([
        ["feature-landed-kpi", {
          classification: "suspicious",
          primaryConcern: "kpi",
          reviewAssessmentLine: "Review check: 1 completed review cycle is recorded.",
          approvalAssessmentLine: "Approval check: approved commit is recorded before merge.",
          tokenAssessmentLine: "KPI check: token cost is unavailable even though KPI capture was already live when this feature landed.",
          timingAssessmentLine: "Timing check: route only proves elapsed lifecycle time.",
          cooReadLine: "This is a route-quality problem.",
          recommendation: "Patch the closeout route.",
          businessImpact: "Cost visibility is incomplete.",
          businessSeverity: "high",
          businessPriority: "now",
          routeChain: ["implement-plan", "closeout", "status"],
          implicatedSubjects: ["route:implement-plan-closeout"],
        }],
      ]),
      additionalAttention: [
        {
          key: "review-gap",
          featureId: "feature-review-gap",
          featureLabel: "Feature Review Gap",
          classification: "suspicious",
          summary: "Review governance proof is incomplete for this landing.",
          recommendation: "Restore the missing review evidence.",
          evidenceLine: "Direct source; fresh; high confidence.",
          rootCause: "The landing does not prove required review governance.",
          systemFix: "Restore the missing review evidence.",
          businessImpact: "Leadership cannot fully trust the review trail for this landing.",
          businessSeverity: "high",
          businessPriority: "now",
          routeChain: ["review-cycle", "closeout", "status"],
          implicatedSubjects: ["route:review-cycle"],
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
        trackedIssues: {},
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
      opening: "",
      statusWindow: null,
      statusNotes: [],
      landed: [],
      issues: [],
      onTheTable: [],
      inMotion: [],
      whatsNext: [],
      operationalFooter: null,
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
        invocation_id: "status-agent-mixed-classification",
        provider: "codex",
        model: "gpt-5.4",
        reasoning: "medium",
        was_fallback: false,
        source_path: "test",
        timestamp: "2026-04-05T00:00:00.000Z",
      },
      response: "Malformed output",
      latency_ms: 1,
      attempts: [],
    }),
  });

  assertExecutiveBriefShape(output);
  assert.match(output, /Review evidence gap/i);
  assert.match(output, /Fix: Restore the missing review evidence\./i);
  assert.doesNotMatch(output, /1\.\s+Cost auditability gap/i);
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
  assertExecutiveBriefShape(result.output);
  assert.ok(result.output.includes("CTO Admission") || result.output.includes("CTO admission"));
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

function countFocusOptionLines(output: string): number {
  const lines = output.split("\n");
  const focusIndex = lines.findIndex((line) => line.trim() === "Where would you like to focus?");
  if (focusIndex < 0) {
    return 0;
  }

  return lines
    .slice(focusIndex + 1)
    .map((line) => line.trim())
    .filter((line) => /^\d+\.\s/.test(line))
    .length;
}

function assertExecutiveBriefShape(output: string): void {
  const requiredHeadings = [
    "**Bottom line**",
    "**Delivery health**",
    "**Issues that need a decision**",
    "**Parked / waiting**",
    "**Recommendation**",
  ];

  for (const heading of requiredHeadings) {
    assert.ok(output.includes(heading), `Expected executive heading ${heading}.`);
    assert.equal(countLineOccurrences(output, heading), 1, `Expected executive heading ${heading} exactly once.`);
  }

  assert.ok(!output.includes("## Issues That Need Your Attention"));
  assert.ok(!output.includes("## On The Table"));
  assert.ok(!output.includes("## In Motion"));
  assert.ok(!output.includes("## What's Next"));
  assert.ok(!output.includes("Operational context:"));
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
      cto_admission: null,
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

async function initGitRepo(repoRoot: string): Promise<void> {
  const runGit = (args: string[]): void => {
    const result = spawnSync("git", ["-C", repoRoot, ...args], {
      encoding: "utf-8",
      windowsHide: true,
    });
    assert.equal(result.status, 0, result.stderr || result.stdout || `git ${args.join(" ")} failed`);
  };

  runGit(["init"]);
  runGit(["config", "user.email", "tests@example.com"]);
  runGit(["config", "user.name", "ADF Tests"]);
  await writeFile(join(repoRoot, ".gitkeep"), "fixture\n", "utf-8");
  runGit(["add", ".gitkeep"]);
  runGit(["commit", "-m", "init"]);
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
