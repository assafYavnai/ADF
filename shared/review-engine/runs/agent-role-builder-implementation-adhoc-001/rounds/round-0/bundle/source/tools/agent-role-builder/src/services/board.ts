import { invoke, createSystemProvenance, emit } from "../shared-imports.js";
import type { RoleBuilderRequest, BoardParticipant } from "../schemas/request.js";
import type { ParticipantRecord, RoleBuilderStatus } from "../schemas/result.js";
import { selfCheck } from "./validator.js";
import { performInitialRuleSweep, reviseRoleMarkdown } from "./role-generator.js";
import {
  buildReviewerSummaryText,
  formatFocusAreas,
  formatIgnoreAreas,
  formatSourceAuthorities,
  loadReviewRuntimeConfig,
  resolveReviewMode,
  type ReviewFixDecision,
  type ReviewRuntimeConfig,
  type ReviewVerdictShape,
} from "./review-runtime.js";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

// --- Bug Report (Error Escalation Pattern) ---

interface BugReport {
  what_failed: string;
  error_message: string;
  where: string;
  context: Record<string, unknown>;
  input_that_caused_failure: string;
  expected_format: string;
  component: string;
  provenance: { invocation_id?: string; provider?: string; model?: string; participant_id?: string };
  timestamp: string;
}

interface BoardContext {
  runDir: string | null;
  bugReportCounter: number;
  reviewConfig?: ReviewRuntimeConfig;
}

async function writeBugReport(report: BugReport, ctx: BoardContext): Promise<string | null> {
  if (!ctx.runDir) return null;
  ctx.bugReportCounter++;
  const filename = `bug-report-${ctx.bugReportCounter}.json`;
  const path = join(ctx.runDir, filename);
  await writeFile(path, JSON.stringify(report, null, 2), "utf-8");
  console.error(`[board] Bug report written to ${path}`);
  return path;
}

async function attemptAutoFix(
  bugReport: BugReport,
  request: RoleBuilderRequest,
  rawInput: string
): Promise<string | null> {
  // TODO: Wire llm-tool-builder when complete. For now, use Codex agent.
  if (!rawInput || rawInput.trim().length === 0) {
    console.error("[board] Auto-fix skipped: empty input");
    return null;
  }
  try {
    const fixPrompt = `You are fixing a parse error in the agent-role-builder board.
The leader LLM returned a response that could not be parsed as JSON.

ERROR: ${bugReport.error_message}
EXPECTED FORMAT: ${bugReport.expected_format}
RAW INPUT (first 2000 chars):
${rawInput.slice(0, 2000)}

Extract the JSON from the raw input. The response may contain markdown, explanatory text, or multiple JSON blocks.
Return ONLY the valid JSON object matching the expected format. Nothing else.`;

    const result = await invoke({
      cli: request.board_roster.leader.provider as "codex" | "claude" | "gemini",
      model: request.board_roster.leader.model,
      reasoning: "medium",
      bypass: false,
      timeout_ms: 60_000,
      prompt: fixPrompt,
      source_path: "tools/agent-role-builder/auto-fix/parse-error",
    });

    const cleaned = cleanJsonResponse(result.response);
    JSON.parse(cleaned); // validate it's actual JSON
    return cleaned;
  } catch (e) {
    console.error("[board] Auto-fix attempt failed:", e instanceof Error ? e.message : e);
    return null;
  }
}

// --- Structured types ---

type ReviewerVerdict = ReviewVerdictShape;

interface LeaderVerdict {
  status: "frozen" | "pushback" | "blocked";
  rationale: string;
  unresolved: string[];
  improvements_applied: string[];
  arbitration_used: boolean;
  arbitration_rationale: string | null;
}

interface ComplianceEntry {
  rule_id: string;
  status: "compliant" | "non_compliant" | "not_applicable";
  evidence_location: string;
  evidence_summary: string;
}

interface FixItem {
  finding_id?: string;
  finding_group_id: string;
  action: "accepted" | "rejected";
  summary: string;
  evidence_location?: string;
  rejection_reason?: string;
}

interface ReviewerSlot {
  slotKey: string;
  slotIndex: number;
  participant: BoardParticipant;
}

export interface BoardRoundResult {
  round: number;
  reviewMode: "full" | "delta" | "regression_sanity";
  participants: ParticipantRecord[];
  leaderVerdict: string;
  leaderRationale: string;
  unresolved: string[];
  improvementsApplied: string[];
  markdown: string;
  selfCheckIssues: Array<{ code: string; message: string }>;
  reviewerVerdicts: Map<string, ReviewerVerdict>;
  complianceMap?: ComplianceEntry[];
  fixItemsMap?: FixItem[];
}

// --- Main board execution ---

export async function executeBoard(
  request: RoleBuilderRequest,
  draftMarkdown: string,
  draftContract: Record<string, unknown>,
  selfCheckIssues: Array<{ code: string; message: string }>,
  runDir: string | null = null
): Promise<{
  status: RoleBuilderStatus;
  rounds: BoardRoundResult[];
  allParticipants: ParticipantRecord[];
  statusReason: string;
  finalMarkdown: string;
  finalSelfCheckIssues: Array<{ code: string; message: string }>;
}> {
  const ctx: BoardContext = {
    runDir,
    bugReportCounter: 0,
    reviewConfig: await loadReviewRuntimeConfig(),
  };
  const maxRounds = request.governance.max_review_rounds;
  const rounds: BoardRoundResult[] = [];
  const allParticipants: ParticipantRecord[] = [];
  let currentMarkdown = draftMarkdown;
  let currentSelfCheckIssues = selfCheckIssues;
  const reviewerSlots: ReviewerSlot[] = request.board_roster.reviewers.map((participant, slotIndex) => ({
    slotKey: `reviewer-${slotIndex}-${participant.provider}`,
    slotIndex,
    participant,
  }));

  const reviewerStatus = new Map<string, "approved" | "conditional" | "reject" | "error" | "pending">();
  for (const reviewer of reviewerSlots) {
    reviewerStatus.set(reviewer.slotKey, "pending");
  }
  let consecutiveDisputeRounds = 0;

  // Load rulebook once
  let currentRulebook: Array<{ id: string; rule: string; applies_to: string[]; do: string; dont: string; source: string; version: number }> = [];
  try {
    const rulebookRaw = JSON.parse(await readFile(join("tools/agent-role-builder", "rulebook.json"), "utf-8"));
    currentRulebook = rulebookRaw.rules ?? [];
  } catch (e) { console.error("[board] Failed to load rulebook:", e instanceof Error ? e.message : e); }

  let pendingComplianceMap: ComplianceEntry[] = [];
  let pendingFixItemsMap: FixItem[] | undefined;
  try {
    const initialSweep = await performInitialRuleSweep(
      request,
      currentMarkdown,
      currentRulebook,
      currentSelfCheckIssues,
      ctx.runDir ? join(ctx.runDir, "runtime", "component-repair-engine", "initial-rule-sweep") : undefined
    );
    currentMarkdown = initialSweep.markdown;
    pendingComplianceMap = initialSweep.complianceMap as ComplianceEntry[];
    currentSelfCheckIssues = selfCheck(currentMarkdown, request).map((issue) => ({ code: issue.code, message: issue.message }));
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    await writeBugReport({
      what_failed: "Initial rulebook sweep before first review",
      error_message: errorMsg,
      where: "Pre-round-0 component-repair-engine pass",
      context: { markdown_length: currentMarkdown.length, rule_count: currentRulebook.length },
      input_that_caused_failure: currentMarkdown.slice(0, 3000),
      expected_format: "Updated markdown plus compliance_map from the component-repair-engine",
      component: "tools/agent-role-builder/board/initial-rule-sweep",
      provenance: { provider: request.board_roster.leader.provider, model: request.board_roster.leader.model },
      timestamp: new Date().toISOString(),
    }, ctx);
    return {
      status: "blocked",
      rounds,
      allParticipants,
      statusReason: `Initial rulebook sweep failed: ${errorMsg}`,
      finalMarkdown: currentMarkdown,
      finalSelfCheckIssues: currentSelfCheckIssues,
    };
  }

  for (let round = 0; round < maxRounds; round++) {
    const roundDir = ctx.runDir ? join(ctx.runDir, "rounds", `round-${round}`) : null;
    if (roundDir) await mkdir(roundDir, { recursive: true });

    // Bug 7: Use compliance map and fix items map produced by the prior round's revision
    const complianceMap = pendingComplianceMap;
    const fixItemsMap = pendingFixItemsMap;

    if (roundDir) {
      await writeFile(join(roundDir, "compliance-map.json"), JSON.stringify({
        schema_version: "1.0", component: "agent-role-builder",
        scope: round === 0 ? "full" : "delta",
        artifact_path: (ctx.runDir
          ? join(ctx.runDir, `${request.role_slug}-role.md`)
          : `tools/agent-role-builder/runs/${request.job_id}/${request.role_slug}-role.md`).replace(/\\/g, "/"),
        git_commit: undefined,
        round,
        entries: complianceMap,
        unchecked_rules: [],
        generated_at: new Date().toISOString(),
      }, null, 2), "utf-8");
      if (fixItemsMap && fixItemsMap.length > 0) {
        await writeFile(join(roundDir, "fix-items-map.json"), JSON.stringify({
          schema_version: "1.0", component: "agent-role-builder",
          round, items: fixItemsMap, generated_at: new Date().toISOString(),
        }, null, 2), "utf-8");
      }
    }

    // --- Step 3: Review ---
    const reviewersToRun = reviewerSlots.filter((reviewer) => {
      return reviewerStatus.get(reviewer.slotKey) !== "approved"
        && reviewerStatus.get(reviewer.slotKey) !== "conditional";
    });
    const isSanityCheck = reviewersToRun.length === 0;
    const activeReviewers = isSanityCheck ? reviewerSlots : reviewersToRun;

    let roundResult: BoardRoundResult;
    try {
      roundResult = await executeRound(
        request, currentMarkdown, draftContract, currentSelfCheckIssues,
        round, rounds, activeReviewers, complianceMap, fixItemsMap, ctx,
        resolveReviewMode(round, isSanityCheck, ctx.reviewConfig!)
      );
    } catch (err) {
      // Bug 1 fix: BoardBlockedError means an unrecoverable parse failure — stop immediately
      if (err instanceof BoardBlockedError) {
        console.error(`[board] Board blocked: ${err.message}`);
        return {
          status: "blocked", rounds, allParticipants,
          statusReason: `Unrecoverable parse failure in round ${round}. ${err.message}`,
          finalMarkdown: currentMarkdown,
          finalSelfCheckIssues: currentSelfCheckIssues,
        };
      }
      throw err; // Re-throw unexpected errors
    }
    roundResult.complianceMap = complianceMap;
    roundResult.fixItemsMap = fixItemsMap;
    rounds.push(roundResult);
    allParticipants.push(...roundResult.participants);

    // Save round result
    if (roundDir) {
      await writeFile(join(roundDir, "review.json"), JSON.stringify({
        round: roundResult.round, reviewMode: roundResult.reviewMode,
        leaderVerdict: roundResult.leaderVerdict,
        leaderRationale: roundResult.leaderRationale,
        unresolved: roundResult.unresolved,
        improvementsApplied: roundResult.improvementsApplied,
        reviewerVerdicts: Object.fromEntries(roundResult.reviewerVerdicts),
        participants: roundResult.participants.map((p) => ({
          participant_id: p.participant_id, provider: p.provider,
          model: p.model, role: p.role, round: p.round,
          latency_ms: p.latency_ms, invocation_id: p.invocation_id,
          was_fallback: p.was_fallback ?? false,
        })),
      }, null, 2), "utf-8");
    }

    // Update per-reviewer status (Bug 2 fix: parse-error verdicts are marked "error", not "reject")
    for (const [pid, verdict] of roundResult.reviewerVerdicts) {
      const key = pid.replace(/-r\d+$/, "");
      const isParseError = verdict.conceptual_groups.some((g) => g.id === "parse-error");
      if (isParseError) {
        reviewerStatus.set(key, "error");
      } else if (verdict.verdict === "approved") {
        reviewerStatus.set(key, "approved");
      } else if (verdict.verdict === "conditional") {
        reviewerStatus.set(key, "conditional");
      } else {
        reviewerStatus.set(key, "reject");
      }
    }

    const realVerdicts = [...reviewerStatus.values()].filter((status) => status !== "error" && status !== "pending");
    const hasReject = realVerdicts.some((status) => status === "reject");
    const hasApprove = realVerdicts.some((status) => status === "approved" || status === "conditional");
    if (hasReject && hasApprove) consecutiveDisputeRounds++;
    else consecutiveDisputeRounds = 0;

    const reviewChecklist = collectReviewChecklist(roundResult.reviewerVerdicts, fixItemsMap);
    const repairChecklist = extendRepairChecklist(reviewChecklist, complianceMap, currentSelfCheckIssues);
    const hasRepairWork = repairChecklist.length > 0 || roundResult.leaderVerdict === "pushback";
    const canRevise = round < maxRounds - 1 && roundResult.leaderVerdict !== "blocked" && hasRepairWork;

    // --- Step 4: Learning engine (always) + revision (if not final and unresolved) ---
    {
      try {

        let learningOutput = { new_rules: [] as unknown[], existing_rules_covering: [] as unknown[], no_rule_needed: [] as unknown[] };
        if (reviewChecklist.length > 0) {
          try {
            const learningResult = await invoke({
              cli: request.board_roster.leader.provider as "codex" | "claude" | "gemini",
              model: request.board_roster.leader.model,
              reasoning: "high",
              bypass: false,
              timeout_ms: 120_000,
              prompt: buildLearningPrompt(request, reviewChecklist, currentRulebook, roundResult.unresolved, round, ctx.reviewConfig!),
              source_path: "tools/agent-role-builder/learning-engine",
            });
            learningOutput = JSON.parse(cleanJsonResponse(learningResult.response));
          } catch (error) {
            console.error(`[board] Learning engine failed (round ${round}, findings: ${reviewChecklist.length}):`, error instanceof Error ? error.message : error);
          }
        }

        if (roundDir) {
          await writeFile(join(roundDir, "learning.json"), JSON.stringify(learningOutput, null, 2), "utf-8");
        }

        // Bug 2 fix: Write new rules from learning engine to rulebook.json and update in-memory copy
        // Bug 3 fix: Track new rule IDs so the revision prompt can flag them
        let newRuleIds: string[] = [];
        if (Array.isArray(learningOutput.new_rules) && learningOutput.new_rules.length > 0) {
          try {
            const rulebookPath = join("tools/agent-role-builder", "rulebook.json");
            const existingIds = new Set(currentRulebook.map((r) => r.id));
            const genuinelyNew = (learningOutput.new_rules as Array<{ id: string; rule: string; applies_to: string[]; do: string; dont: string; source: string; version: number }>)
              .filter((nr) => nr.id && !existingIds.has(nr.id));

            if (genuinelyNew.length > 0) {
              // IMP-017: Normalize applies_to to array before writing to rulebook
              for (const nr of genuinelyNew) {
                nr.applies_to = Array.isArray(nr.applies_to) ? nr.applies_to : [String(nr.applies_to)];
              }
              newRuleIds = genuinelyNew.map((r) => r.id);
              currentRulebook.push(...genuinelyNew);
              const rulebookOnDisk = JSON.parse(await readFile(rulebookPath, "utf-8"));
              rulebookOnDisk.rules = currentRulebook;
              rulebookOnDisk.last_updated = new Date().toISOString().slice(0, 10);
              await writeFile(rulebookPath, JSON.stringify(rulebookOnDisk, null, 2), "utf-8");
              console.error(`[board] Learning engine: added ${genuinelyNew.length} new rules to rulebook.json`);
            }
          } catch (e) {
            console.error("[board] Failed to update rulebook with new rules:", e instanceof Error ? e.message : e);
          }
        }

        let diffSummary = {
          prior_length: roundResult.markdown.length,
          new_length: currentMarkdown.length,
          changed: false,
          revision_skipped: !canRevise,
          reason: !canRevise
            ? (roundResult.leaderVerdict === "blocked"
                ? "leader blocked"
                : round >= maxRounds - 1
                  ? "final round"
                  : "no repair work")
            : undefined,
          summary: !canRevise
            ? "No repair pass was executed after this round."
            : "Repair pass executed.",
        };

        if (canRevise) {
          const revisionResult = await reviseRoleMarkdown(
            request,
            roundResult.markdown,
            {
              round: roundResult.round,
              leaderRationale: roundResult.leaderRationale,
              unresolved: roundResult.unresolved,
              fixChecklist: repairChecklist,
              priorRoundIssueCount: rounds.map((priorRound) => priorRound.unresolved.length),
              rulebook: currentRulebook,
              newRuleIds,
              selfCheckIssues: currentSelfCheckIssues,
              bundleRoot: ctx.runDir ? join(ctx.runDir, "runtime", "component-repair-engine", `revision-r${round}`) : undefined,
            }
          );
          currentMarkdown = revisionResult.markdown;
          pendingComplianceMap = revisionResult.complianceMap as ComplianceEntry[];
          pendingFixItemsMap = revisionResult.fixItemsMap as FixItem[];
          currentSelfCheckIssues = selfCheck(currentMarkdown, request).map((issue) => ({ code: issue.code, message: issue.message }));
          diffSummary = {
            prior_length: revisionResult.diffSummary.prior_length,
            new_length: revisionResult.diffSummary.new_length,
            changed: revisionResult.diffSummary.changed,
            revision_skipped: false,
            reason: undefined,
            summary: revisionResult.diffSummary.summary,
          };
        }

        if (roundDir) {
          await writeFile(join(roundDir, "diff-summary.json"), JSON.stringify(diffSummary, null, 2), "utf-8");
        }
      } catch (e) {
        // IMP-016: Revision is critical — never silently swallow. Write bug report, escalate.
        const errorMsg = e instanceof Error ? e.message : String(e);
        console.error("[board] Revision/learning failed (critical):", errorMsg);

        const bugReport: BugReport = {
          what_failed: "Revision or learning engine during board loop",
          error_message: errorMsg,
          where: `Round ${round}, revision/learning block`,
          context: { round, maxRounds, markdown_length: currentMarkdown.length, repair_item_count: repairChecklist.length },
          input_that_caused_failure: `(revision round ${round}, unresolved: ${roundResult.unresolved.join("; ").slice(0, 1000)})`,
          expected_format: "Successful revision producing updated markdown, compliance map, fix items map",
          component: "tools/agent-role-builder/board/revision-block",
          provenance: { provider: request.board_roster.leader.provider, model: request.board_roster.leader.model },
          timestamp: new Date().toISOString(),
        };
        await writeBugReport(bugReport, ctx);

        // Throw BoardBlockedError — the board cannot converge if revision crashes every round
        throw new BoardBlockedError(
          `Revision crashed in round ${round}: ${errorMsg}. Bug report written. Board cannot converge without working revision.`,
          null
        );
      }
    }

    if (roundResult.leaderVerdict === "blocked") {
      await writeRunPostmortem(request, rounds, ctx, "blocked");
      return { status: "blocked", rounds, allParticipants,
        statusReason: roundResult.leaderRationale,
        finalMarkdown: roundResult.markdown, finalSelfCheckIssues: roundResult.selfCheckIssues };
    }

    if (!hasRepairWork && roundResult.leaderVerdict === "frozen") {
      await writeRunPostmortem(request, rounds, ctx, "frozen");
      return { status: "frozen", rounds, allParticipants,
        statusReason: "All reviewers approved and no remaining repair work was found after learning and rule checks.",
        finalMarkdown: roundResult.markdown, finalSelfCheckIssues: roundResult.selfCheckIssues };
    }

    await writeRunPostmortem(request, rounds, ctx);
  }

  const lastRound = rounds[rounds.length - 1];
  await writeRunPostmortem(request, rounds, ctx, "resume_required");
  return { status: "resume_required", rounds, allParticipants,
    statusReason: `Budget exhausted after ${rounds.length} rounds. ${lastRound?.unresolved.length ?? 0} unresolved.`,
    finalMarkdown: lastRound?.markdown ?? currentMarkdown,
    finalSelfCheckIssues: lastRound?.selfCheckIssues ?? currentSelfCheckIssues };
}

async function writeRunPostmortem(
  request: RoleBuilderRequest,
  rounds: BoardRoundResult[],
  ctx: BoardContext,
  terminalStatus?: RoleBuilderStatus
): Promise<void> {
  if (!ctx.runDir) return;

  const roundSnapshots = rounds.map((round) => {
    const reviewerParticipants = round.participants.filter((participant) => participant.role === "reviewer");
    const severityCounts = countRoundSeverities(round.reviewerVerdicts);
    const verdictBreakdown = {
      approved: 0,
      conditional: 0,
      reject: 0,
      error: 0,
    };

    for (const verdict of round.reviewerVerdicts.values()) {
      const hasParseError = verdict.conceptual_groups.some((group) => group.id === "parse-error");
      if (hasParseError) {
        verdictBreakdown.error++;
      } else {
        verdictBreakdown[verdict.verdict]++;
      }
    }

    return {
      round: round.round,
      review_mode: round.reviewMode,
      reviewer_invocations: reviewerParticipants.length,
      reviewer_slots_total: request.board_roster.reviewers.length,
      reviewer_slots_skipped: Math.max(0, request.board_roster.reviewers.length - reviewerParticipants.length),
      participant_count: round.participants.length,
      leader_verdict: round.leaderVerdict,
      unresolved_count: round.unresolved.length,
      unresolved_items: round.unresolved,
      improvements_applied_count: round.improvementsApplied.length,
      reviewer_verdict_breakdown: verdictBreakdown,
      severity_counts: severityCounts,
      fallback_count: round.participants.filter((participant) => participant.was_fallback).length,
      latency_ms: {
        total: round.participants.reduce((sum, participant) => sum + (participant.latency_ms ?? 0), 0),
        max: Math.max(0, ...round.participants.map((participant) => participant.latency_ms ?? 0)),
        by_participant: round.participants.map((participant) => ({
          participant_id: participant.participant_id,
          latency_ms: participant.latency_ms ?? null,
          was_fallback: participant.was_fallback ?? false,
        })),
      },
      artifacts: {
        review_json: true,
        compliance_map: Boolean(round.complianceMap),
        fix_items_map: Boolean(round.fixItemsMap && round.fixItemsMap.length > 0),
      },
    };
  });

  const unresolvedTrend = roundSnapshots.map((snapshot) => snapshot.unresolved_count);
  const totalFallbacks = roundSnapshots.reduce((sum, snapshot) => sum + snapshot.fallback_count, 0);
  const postmortem = {
    schema_version: "1.0",
    component: "agent-role-builder",
    request_job_id: request.job_id,
    questions_ref: "shared/learning-engine/postmortem-questions.json",
    updated_at: new Date().toISOString(),
    terminal_status: terminalStatus ?? null,
    rounds_completed: rounds.length,
    round_snapshots: roundSnapshots,
    kpi_summary: {
      unresolved_trend: unresolvedTrend,
      convergence_delta: unresolvedTrend.length >= 2 ? unresolvedTrend[0] - unresolvedTrend[unresolvedTrend.length - 1] : 0,
      total_fallbacks: totalFallbacks,
      total_participant_invocations: roundSnapshots.reduce((sum, snapshot) => sum + snapshot.participant_count, 0),
      skipped_reviewer_invocations: roundSnapshots.reduce((sum, snapshot) => sum + snapshot.reviewer_slots_skipped, 0),
    },
    question_outputs: {
      "PM-002": {
        rounds: rounds.length,
        participant_invocations: roundSnapshots.reduce((sum, snapshot) => sum + snapshot.participant_count, 0),
        total_latency_ms: roundSnapshots.reduce((sum, snapshot) => sum + snapshot.latency_ms.total, 0),
        reviewer_reuse_savings: roundSnapshots.reduce((sum, snapshot) => sum + snapshot.reviewer_slots_skipped, 0),
      },
      "PM-007": {
        unresolved_trend: unresolvedTrend,
        latest_unresolved_count: unresolvedTrend[unresolvedTrend.length - 1] ?? 0,
        convergence_observed: unresolvedTrend.length > 1
          ? unresolvedTrend[unresolvedTrend.length - 1] <= unresolvedTrend[0]
          : true,
      },
    },
  };

  await writeFile(join(ctx.runDir, "run-postmortem.json"), JSON.stringify(postmortem, null, 2), "utf-8");
}

// Bug 7: generateComplianceMap() and generateFixItemsMap() removed.
// Compliance map and fix items map are now produced as part of the merged revision call
// in reviseRoleMarkdown() — see role-generator.ts.

// --- Round execution ---

async function executeRound(
  request: RoleBuilderRequest, markdown: string,
  contract: Record<string, unknown>,
  selfCheckIssues: Array<{ code: string; message: string }>,
  roundIndex: number, priorRounds: BoardRoundResult[],
  activeReviewers: ReviewerSlot[],
  complianceMap?: ComplianceEntry[], fixItemsMap?: FixItem[],
  ctx?: BoardContext,
  reviewMode: "full" | "delta" | "regression_sanity" = "full"
): Promise<BoardRoundResult> {
  const participants: ParticipantRecord[] = [];
  const reviewerVerdicts = new Map<string, ReviewerVerdict>();

  for (const reviewer of activeReviewers) {
    const record = await executeParticipant(
      reviewer.participant, request, markdown, contract, selfCheckIssues,
      roundIndex, "reviewer", priorRounds, undefined, complianceMap, fixItemsMap, ctx,
      reviewer.slotKey, reviewMode
    );
    participants.push(record);
    reviewerVerdicts.set(record.participant_id, await parseReviewerResponse(record.verdict ?? "", request, roundIndex, record.participant_id, ctx));
  }

  const leaderRecord = await executeParticipant(
    request.board_roster.leader, request, markdown, contract, selfCheckIssues,
    roundIndex, "leader", priorRounds, reviewerVerdicts, complianceMap, fixItemsMap, ctx,
    undefined, reviewMode
  );
  participants.push(leaderRecord);
  const leaderResponse = await parseLeaderResponse(leaderRecord.verdict ?? "pushback", request, roundIndex, leaderRecord.participant_id, ctx);

  return {
    round: roundIndex, reviewMode, participants, leaderVerdict: leaderResponse.status,
    leaderRationale: leaderResponse.rationale, unresolved: leaderResponse.unresolved,
    improvementsApplied: leaderResponse.improvements_applied,
    markdown, selfCheckIssues, reviewerVerdicts,
  };
}

async function executeParticipant(
  participant: BoardParticipant, request: RoleBuilderRequest,
  markdown: string, contract: Record<string, unknown>,
  selfCheckIssues: Array<{ code: string; message: string }>,
  round: number, role: "leader" | "reviewer",
  priorRounds: BoardRoundResult[],
  currentRoundReviewers?: Map<string, ReviewerVerdict>,
  complianceMap?: ComplianceEntry[], fixItemsMap?: FixItem[],
  ctx?: BoardContext,
  participantKey?: string,
  reviewMode: "full" | "delta" | "regression_sanity" = "full"
): Promise<ParticipantRecord> {
  const participantId = `${participantKey ?? `${role}-${participant.provider}`}-r${round}`;
  const sourcePath = `tools/agent-role-builder/${role === "leader" ? "leader-synthesis" : "review"}`;

  const brief = await buildBrief(
    request, markdown, contract, selfCheckIssues,
    round, role, priorRounds, currentRoundReviewers, complianceMap, fixItemsMap, ctx, reviewMode
  );

  const start = Date.now();
  try {
    const result = await invoke({
      cli: participant.provider as "codex" | "claude" | "gemini",
      model: participant.model, reasoning: participant.throttle,
      bypass: false, timeout_ms: request.runtime.watchdog_timeout_seconds * 1000,
      prompt: brief, source_path: sourcePath,
    });
    const latency_ms = Date.now() - start;
    emit({ provenance: result.provenance, category: "tool",
      operation: `role-builder-${role}`, latency_ms, success: true,
      board_rounds: round + 1, participants: 1,
      metadata: { review_mode: reviewMode, was_fallback: result.provenance.was_fallback } });
    return { participant_id: participantId, provider: participant.provider,
      model: participant.model, role, verdict: result.response,
      round, latency_ms, invocation_id: result.provenance.invocation_id,
      was_fallback: result.provenance.was_fallback };
  } catch (err) {
    const latency_ms = Date.now() - start;
    const errorMsg = err instanceof Error ? err.message : String(err);
    emit({ provenance: createSystemProvenance(sourcePath), category: "tool",
      operation: `role-builder-${role}`, latency_ms, success: false,
      metadata: { error: errorMsg } });
    return { participant_id: participantId, provider: participant.provider,
      model: participant.model, role, verdict: `ERROR: ${errorMsg}`,
      round, latency_ms };
  }
}

// --- Prompts ---

async function buildBrief(
  request: RoleBuilderRequest, markdown: string,
  contract: Record<string, unknown>,
  selfCheckIssues: Array<{ code: string; message: string }>,
  round: number, role: "leader" | "reviewer",
  priorRounds: BoardRoundResult[],
  currentRoundReviewers?: Map<string, ReviewerVerdict>,
  complianceMap?: ComplianceEntry[], fixItemsMap?: FixItem[],
  ctx?: BoardContext,
  reviewMode: "full" | "delta" | "regression_sanity" = "full"
): Promise<string> {
  // Write markdown to temp file — prompts must stay under 4KB
  const markdownFile = ctx?.runDir
    ? join(ctx.runDir, `brief-markdown-r${round}-${role}.md`)
    : join(process.env.USERPROFILE ? `${process.env.USERPROFILE}\\AppData\\Local\\Temp` : ".", `adf-brief-${role}-${round}.md`);
  const { writeFile: wf } = await import("node:fs/promises");
  await wf(markdownFile, markdown, "utf-8");
  const mdRef = markdownFile.replace(/\\/g, "/");
  const reviewConfig = ctx?.reviewConfig;
  const verdicts = reviewConfig?.sharedContract.reviewer_output?.verdicts ?? ["approved", "conditional", "reject"];
  const severities = reviewConfig?.sharedContract.reviewer_output?.severity_levels ?? ["blocking", "major", "minor", "suggestion"];
  const fixDecisionValues = reviewConfig?.sharedContract.reviewer_output?.fix_decisions?.allowed_decisions
    ?? ["accept_fix", "reject_fix", "accept_rejection", "reject_rejection"];
  const focusAreas = reviewConfig ? formatFocusAreas(reviewConfig) : "- authority model\n- scope boundaries\n- terminal states";
  const sourceAuthorities = reviewConfig
    ? formatSourceAuthorities(reviewConfig)
    : "- docs/v0/review-process-architecture.md\n- docs/v0/architecture.md";
  const ignoreAreas = reviewConfig ? formatIgnoreAreas(reviewConfig) : "";
  const priorContext = priorRounds.length > 0
    ? `\n\nPrior rounds:\n${priorRounds.map((r) =>
        `Round ${r.round}: mode=${r.reviewMode}, Leader=${r.leaderVerdict}. Unresolved: ${r.unresolved.length}. Improvements: ${r.improvementsApplied.length}.`
      ).join("\n")}` : "";

  const selfCheckContext = selfCheckIssues.length > 0
    ? `\n\nSelf-check issues:\n${selfCheckIssues.map((i) => `- [${i.code}] ${i.message}`).join("\n")}`
    : "\n\nSelf-check: passed";

  const complianceContext = complianceMap && complianceMap.length > 0
    ? `\n\nCompliance map (${complianceMap.length} rules checked):\n${complianceMap.map((e) =>
        `- ${e.rule_id}: ${e.status} — ${e.evidence_summary}`
      ).join("\n")}` : "";

  const fixItemsContext = fixItemsMap && fixItemsMap.length > 0
    ? `\n\nFix items map from implementer:\n${fixItemsMap.map((f) =>
        `- [${f.finding_id ?? f.finding_group_id}] ${f.action}: ${f.summary}${f.rejection_reason ? ` (REJECTED: ${f.rejection_reason})` : ""}`
      ).join("\n")}` : "";

  const contractSummary = JSON.stringify({
    intent: request.intent, primary_objective: request.primary_objective,
    out_of_scope: request.out_of_scope, governance: request.governance,
    runtime: request.runtime, package_files: contract["package_files"],
  }, null, 2);

  if (role === "reviewer") {
    const fixDecisionInstruction = fixItemsMap && fixItemsMap.length > 0
      ? `\n\nIMPORTANT: The implementer provided a fix items map. For each item, you MUST respond with a fix_decisions array:
[{ "finding_id": "preferred-if-known", "finding_group_id": "group-fallback", "decision": ${fixDecisionValues.map((value) => `"${value}"`).join(" | ")}, "reason": "..." }]
Include this in your JSON response as "fix_decisions".` : "";

    return `You are a REVIEWER for the agent-role-builder tool (round ${round}).
Review the draft role package for ${request.role_name} (slug: ${request.role_slug}).
Review mode: ${reviewMode}
Domain: ${reviewConfig?.componentPrompt.domain ?? "design"} (${reviewConfig?.componentPrompt.artifact_kind ?? "role-definition"})

RESPOND WITH JSON ONLY:
{
  "verdict": ${verdicts.map((value) => `"${value}"`).join(" | ")},
  "conceptual_groups": [{ "id": "group-1", "summary": "...", "severity": ${severities.map((value) => `"${value}"`).join("|")},
    "findings": [{ "id": "f1", "description": "...", "source_section": "..." }], "redesign_guidance": "..." }],
  ${fixItemsMap && fixItemsMap.length > 0 ? '"fix_decisions": [{ "finding_id": "preferred-if-known", "finding_group_id": "group-fallback", "decision": "accept_fix"|"reject_fix"|"accept_rejection"|"reject_rejection", "reason": "..." }],' : ''}
  "residual_risks": ["..."], "strengths": ["..."]
}

VERDICT RULES:
- "approved" = no blocking or major issues
- "conditional" = minor issues only
- "reject" = blocking or major issues
- Group findings by root cause with severity and source_section
${fixDecisionInstruction}

FOCUS AREAS:
${focusAreas || "- none specified"}

SOURCE AUTHORITY:
${sourceAuthorities}
${ignoreAreas ? `\nIGNORE AREAS:\n${ignoreAreas}` : ""}

READ the draft role markdown from: ${mdRef}

Contract summary:
${contractSummary}
${selfCheckContext}${complianceContext}${fixItemsContext}${priorContext}

JSON response:`;
  }

  const reviewerContext = currentRoundReviewers && currentRoundReviewers.size > 0
    ? `\n\nReviewer verdict summary:\n${buildReviewerSummaryText(currentRoundReviewers)}`
    : "";

  return `You are the LEADER for the agent-role-builder tool (round ${round}).
Synthesize reviewer feedback and determine terminal status for ${request.role_name}.
Review mode: ${reviewMode}

RESPOND WITH JSON ONLY:
{ "status": ${(reviewConfig?.sharedContract.leader_output?.allowed_statuses ?? ["frozen", "pushback", "blocked"]).map((value) => `"${value}"`).join("|")}, "rationale": "...",
  "unresolved": ["blocking/major only"], "improvements_applied": ["..."],
  "arbitration_used": false, "arbitration_rationale": null }

RULES: frozen = all approved/conditional, no blocking. pushback = any reject with blocking/major.
Count only blocking+major as material. Minor/suggestion don't block freeze.

FOCUS AREAS:
${focusAreas || "- none specified"}

SOURCE AUTHORITY:
${sourceAuthorities}
${ignoreAreas ? `\nIGNORE AREAS:\n${ignoreAreas}` : ""}

READ the draft from: ${mdRef}
${selfCheckContext}${complianceContext}${fixItemsContext}${reviewerContext}${priorContext}

JSON response:`;
}

// --- Response parsing with error escalation ---

/** Thrown when a parse failure is unrecoverable and the board must stop immediately. */
class BoardBlockedError extends Error {
  bugReportPath: string | null;
  constructor(message: string, bugReportPath: string | null) {
    super(message);
    this.name = "BoardBlockedError";
    this.bugReportPath = bugReportPath;
  }
}

/**
 * Pre-validate raw LLM response before attempting JSON parse.
 * Returns a failure reason string, or null if validation passes.
 */
function preValidateResponse(raw: string): string | null {
  if (!raw || raw.trim().length === 0) {
    return "Response is empty or whitespace-only";
  }
  if (raw.trimStart().startsWith("ERROR:")) {
    return `CLI failure detected: ${raw.slice(0, 200)}`;
  }
  if (!raw.includes("{") && !raw.includes("[")) {
    return `No JSON content found in response (no '{' or '[' characters): ${raw.slice(0, 200)}`;
  }
  return null;
}

function cleanJsonResponse(raw: string): string {
  let cleaned = raw.trim();
  // Strip markdown code fences
  cleaned = cleaned.replace(/```json?\n?/g, "").replace(/\n?```/g, "").trim();
  // Detect whether the response is an object or array
  const objStart = cleaned.indexOf("{");
  const arrStart = cleaned.indexOf("[");
  // Use whichever appears first (or the one that exists)
  const isArray = arrStart >= 0 && (objStart < 0 || arrStart < objStart);
  const openChar = isArray ? "[" : "{";
  const closeChar = isArray ? "]" : "}";
  // Extract from first open to last close
  const start = cleaned.indexOf(openChar);
  if (start > 0) cleaned = cleaned.slice(start);
  const end = cleaned.lastIndexOf(closeChar);
  if (end > 0) cleaned = cleaned.slice(0, end + 1);
  return cleaned;
}

async function parseReviewerResponse(raw: string, request: RoleBuilderRequest, round: number, participantId?: string, ctx?: BoardContext): Promise<ReviewerVerdict> {
  const defaultCtx: BoardContext = ctx ?? { runDir: null, bugReportCounter: 0 };
  // Bug 3 fix: pre-validate before any JSON parsing
  const preValidationFailure = preValidateResponse(raw);
  if (preValidationFailure) {
    const bugReport: BugReport = {
      what_failed: "Reviewer response pre-validation",
      error_message: preValidationFailure,
      where: `Round ${round}, reviewer response pre-validation`,
      context: { round, raw_length: raw?.length ?? 0 },
      input_that_caused_failure: raw?.slice(0, 3000) ?? "(null/undefined)",
      expected_format: '{"verdict":"approved|conditional|reject","conceptual_groups":[...],"residual_risks":[...],"strengths":[...]}',
      component: "tools/agent-role-builder/board/parseReviewerResponse",
      provenance: { participant_id: participantId },
      timestamp: new Date().toISOString(),
    };
    const reportPath = await writeBugReport(bugReport, defaultCtx);
    // Pre-validation failures are not auto-fixable — return parse-error verdict
    // (the board loop will detect parse-error and mark reviewer as "error")
    console.error(`[board] Reviewer response pre-validation failed: ${preValidationFailure}`);
    return { verdict: "reject",
      conceptual_groups: [{ id: "parse-error", summary: `Pre-validation failed: ${preValidationFailure.slice(0, 100)}`, severity: "blocking", findings: [], redesign_guidance: `Response failed pre-validation. Bug report: ${reportPath ?? "unknown"}` }],
      residual_risks: [], strengths: [] };
  }

  const cleaned = cleanJsonResponse(raw);
  try {
    const parsed = JSON.parse(cleaned);
    return {
      verdict: parsed.verdict === "approve" ? "approved" : (parsed.verdict ?? "reject"),
      conceptual_groups: Array.isArray(parsed.conceptual_groups) ? parsed.conceptual_groups : [],
      fix_decisions: Array.isArray(parsed.fix_decisions) ? parsed.fix_decisions : undefined,
      residual_risks: Array.isArray(parsed.residual_risks) ? parsed.residual_risks : [],
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
    };
  } catch (firstError) {
    // Error escalation: write bug report, attempt auto-fix
    const bugReport: BugReport = {
      what_failed: "Reviewer response JSON parse",
      error_message: firstError instanceof Error ? firstError.message : String(firstError),
      where: `Round ${round}, reviewer response parsing`,
      context: { round, raw_length: raw.length },
      input_that_caused_failure: raw.slice(0, 3000),
      expected_format: '{"verdict":"approved|conditional|reject","conceptual_groups":[...],"residual_risks":[...],"strengths":[...]}',
      component: "tools/agent-role-builder/board/parseReviewerResponse",
      provenance: { participant_id: participantId },
      timestamp: new Date().toISOString(),
    };
    const reportPath = await writeBugReport(bugReport, defaultCtx);

    const fixed = await attemptAutoFix(bugReport, request, raw);
    if (fixed) {
      try {
        const parsed = JSON.parse(fixed);
        console.error("[board] Auto-fix succeeded for reviewer response parse");
        return {
          verdict: parsed.verdict === "approve" ? "approved" : (parsed.verdict ?? "reject"),
          conceptual_groups: Array.isArray(parsed.conceptual_groups) ? parsed.conceptual_groups : [],
          fix_decisions: Array.isArray(parsed.fix_decisions) ? parsed.fix_decisions : undefined,
          residual_risks: Array.isArray(parsed.residual_risks) ? parsed.residual_risks : [],
          strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
        };
      } catch (autoFixError) {
        console.error("[board] Auto-fix produced invalid JSON:", autoFixError instanceof Error ? autoFixError.message : autoFixError);
      }
    }

    // Bug 1 fix: auto-fix failed — throw BoardBlockedError instead of returning degraded fallback
    console.error("[board] Reviewer parse failed and auto-fix failed. Blocking board.");
    throw new BoardBlockedError(
      `Reviewer ${participantId ?? "unknown"} response parse failed after auto-fix attempt. Bug report: ${reportPath ?? "unknown"}`,
      reportPath
    );
  }
}

async function parseLeaderResponse(raw: string, request: RoleBuilderRequest, round: number, participantId?: string, ctx?: BoardContext): Promise<LeaderVerdict> {
  const defaultCtx: BoardContext = ctx ?? { runDir: null, bugReportCounter: 0 };
  // Bug 3 fix: pre-validate before any JSON parsing
  const preValidationFailure = preValidateResponse(raw);
  if (preValidationFailure) {
    const bugReport: BugReport = {
      what_failed: "Leader response pre-validation",
      error_message: preValidationFailure,
      where: `Round ${round}, leader response pre-validation`,
      context: { round, raw_length: raw?.length ?? 0 },
      input_that_caused_failure: raw?.slice(0, 3000) ?? "(null/undefined)",
      expected_format: '{"status":"frozen|pushback|blocked","rationale":"...","unresolved":[...],"improvements_applied":[...],"arbitration_used":false,"arbitration_rationale":null}',
      component: "tools/agent-role-builder/board/parseLeaderResponse",
      provenance: { participant_id: participantId },
      timestamp: new Date().toISOString(),
    };
    const reportPath = await writeBugReport(bugReport, defaultCtx);
    // Pre-validation failures on leader are unrecoverable — block immediately
    console.error(`[board] Leader response pre-validation failed: ${preValidationFailure}`);
    throw new BoardBlockedError(
      `Leader ${participantId ?? "unknown"} response pre-validation failed: ${preValidationFailure}. Bug report: ${reportPath ?? "unknown"}`,
      reportPath
    );
  }

  const cleaned = cleanJsonResponse(raw);
  try {
    const parsed = JSON.parse(cleaned);
    return {
      status: parsed.status ?? "pushback", rationale: parsed.rationale ?? "No rationale",
      unresolved: Array.isArray(parsed.unresolved) ? parsed.unresolved : [],
      improvements_applied: Array.isArray(parsed.improvements_applied) ? parsed.improvements_applied : [],
      arbitration_used: parsed.arbitration_used ?? false,
      arbitration_rationale: parsed.arbitration_rationale ?? null,
    };
  } catch (firstError) {
    // Error escalation: write bug report, attempt auto-fix
    const bugReport: BugReport = {
      what_failed: "Leader response JSON parse",
      error_message: firstError instanceof Error ? firstError.message : String(firstError),
      where: `Round ${round}, leader response parsing`,
      context: { round, raw_length: raw.length },
      input_that_caused_failure: raw.slice(0, 3000),
      expected_format: '{"status":"frozen|pushback|blocked","rationale":"...","unresolved":[...],"improvements_applied":[...],"arbitration_used":false,"arbitration_rationale":null}',
      component: "tools/agent-role-builder/board/parseLeaderResponse",
      provenance: { participant_id: participantId },
      timestamp: new Date().toISOString(),
    };
    const reportPath = await writeBugReport(bugReport, defaultCtx);

    const fixed = await attemptAutoFix(bugReport, request, raw);
    if (fixed) {
      try {
        const parsed = JSON.parse(fixed);
        console.error("[board] Auto-fix succeeded for leader response parse");
        return {
          status: parsed.status ?? "pushback", rationale: parsed.rationale ?? "No rationale",
          unresolved: Array.isArray(parsed.unresolved) ? parsed.unresolved : [],
          improvements_applied: Array.isArray(parsed.improvements_applied) ? parsed.improvements_applied : [],
          arbitration_used: parsed.arbitration_used ?? false,
          arbitration_rationale: parsed.arbitration_rationale ?? null,
        };
      } catch (autoFixError) {
        console.error("[board] Auto-fix produced invalid JSON:", autoFixError instanceof Error ? autoFixError.message : autoFixError);
      }
    }

    // Bug 1 fix: auto-fix failed — throw BoardBlockedError instead of returning degraded fallback
    console.error("[board] Leader parse failed and auto-fix failed. Blocking board.");
    throw new BoardBlockedError(
      `Leader ${participantId ?? "unknown"} response parse failed after auto-fix attempt. Bug report: ${reportPath ?? "unknown"}`,
      reportPath
    );
  }
}

function countRoundSeverities(reviewerVerdicts: Map<string, ReviewerVerdict>) {
  const counts = { blocking: 0, major: 0, minor: 0, suggestion: 0 };

  for (const verdict of reviewerVerdicts.values()) {
    for (const group of verdict.conceptual_groups) {
      counts[group.severity]++;
    }
  }

  return counts;
}

function collectReviewChecklist(
  reviewerVerdicts: Map<string, ReviewerVerdict>,
  fixItemsMap?: FixItem[]
): Array<{ groupId: string; severity: string; summary: string; redesignGuidance: string; findingCount: number }> {
  const checklist: Array<{ groupId: string; severity: string; summary: string; redesignGuidance: string; findingCount: number }> = [];
  const seenChecklistIds = new Set<string>();

  for (const [, verdict] of reviewerVerdicts) {
    for (const group of verdict.conceptual_groups) {
      if (seenChecklistIds.has(group.id)) continue;
      seenChecklistIds.add(group.id);
      checklist.push({
        groupId: group.id,
        severity: group.severity,
        summary: group.summary,
        redesignGuidance: group.redesign_guidance,
        findingCount: Array.isArray(group.findings) ? group.findings.length : 0,
      });
    }

    for (const decision of verdict.fix_decisions ?? []) {
      if (decision.decision !== "reject_fix" && decision.decision !== "reject_rejection") {
        continue;
      }
      const checklistId = decision.finding_id ?? decision.finding_group_id ?? "unknown-fix-decision";
      if (seenChecklistIds.has(checklistId)) continue;
      seenChecklistIds.add(checklistId);

      const linkedFixItem = fixItemsMap?.find((item) =>
        (decision.finding_id && item.finding_id === decision.finding_id)
        || (decision.finding_group_id && item.finding_group_id === decision.finding_group_id)
      );

      checklist.push({
        groupId: checklistId,
        severity: "major",
        summary: linkedFixItem?.summary ?? `Fix decision ${decision.decision} requires more work`,
        redesignGuidance: decision.reason,
        findingCount: 1,
      });
    }
  }

  return checklist;
}

function extendRepairChecklist(
  reviewChecklist: Array<{ groupId: string; severity: string; summary: string; redesignGuidance: string; findingCount: number }>,
  complianceMap: ComplianceEntry[],
  selfCheckIssues: Array<{ code: string; message: string }>
): Array<{ groupId: string; severity: string; summary: string; redesignGuidance: string; findingCount: number }> {
  const checklist = [...reviewChecklist];
  const seenChecklistIds = new Set(reviewChecklist.map((item) => item.groupId));

  for (const entry of complianceMap) {
    if (entry.status !== "non_compliant") continue;
    const checklistId = `rule-${entry.rule_id}`;
    if (seenChecklistIds.has(checklistId)) continue;
    seenChecklistIds.add(checklistId);
    checklist.push({
      groupId: checklistId,
      severity: "major",
      summary: `Rule ${entry.rule_id} is currently non-compliant`,
      redesignGuidance: `${entry.evidence_summary}. Update the artifact so this rule is demonstrably compliant.`,
      findingCount: 1,
    });
  }

  for (const issue of selfCheckIssues) {
    const checklistId = `self-check-${issue.code}`;
    if (seenChecklistIds.has(checklistId)) continue;
    seenChecklistIds.add(checklistId);
    checklist.push({
      groupId: checklistId,
      severity: "major",
      summary: issue.message,
      redesignGuidance: `Resolve self-check issue ${issue.code} before the artifact can freeze.`,
      findingCount: 1,
    });
  }

  return checklist;
}

// --- Learning prompt ---

function buildLearningPrompt(
  request: RoleBuilderRequest,
  findings: Array<{ groupId: string; severity: string; summary: string; redesignGuidance: string }>,
  rulebook: Array<{ id: string; rule: string }>,
  unresolved: string[], round: number,
  reviewConfig: ReviewRuntimeConfig
): string {
  const focusAreas = formatFocusAreas(reviewConfig);
  const sourceAuthorities = formatSourceAuthorities(reviewConfig);
  return `You are the ADF Learning Engine. Extract generalizable rules from review feedback.

DOMAIN: ${reviewConfig.componentPrompt.domain ?? "design"} (${reviewConfig.componentPrompt.artifact_kind ?? "role-definition"})
COMPONENT: ${reviewConfig.componentContract.component ?? "agent-role-builder"}
ROUND: ${round}

FOCUS AREAS:
${focusAreas || "- none specified"}

SOURCE AUTHORITY:
${sourceAuthorities}

EXISTING RULEBOOK (${rulebook.length} rules):
${rulebook.map((r) => `${r.id}: ${r.rule}`).join("\n") || "(empty)"}

FINDINGS:
${findings.map((f) => `[${f.groupId}] (${f.severity}) ${f.summary}\n  Guidance: ${f.redesignGuidance}`).join("\n\n") || "(none)"}

UNRESOLVED:
${unresolved.map((u, i) => `${i + 1}. ${u}`).join("\n") || "(none)"}

For each finding: NEW rule, ALREADY COVERED, or TOO SPECIFIC.

RESPOND JSON:
{ "new_rules": [{"id": "ARB-NNN", "rule": "...", "applies_to": ["array", "of", "section names"], "do": "...", "dont": "...", "source": "...", "version": 1}],
  "existing_rules_covering": [{"finding_group_id": "...", "covered_by_rule_id": "...", "explanation": "..."}],
  "no_rule_needed": [{"finding_group_id": "...", "reason": "..."}] }

IMPORTANT: "applies_to" MUST be a JSON array of strings, never a plain string. Example: ["design (role definition)"] not "design (role definition)".

JSON:`;
}
