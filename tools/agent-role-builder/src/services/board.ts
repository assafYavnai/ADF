import { invoke, createSystemProvenance, emit } from "../shared-imports.js";
import type { RoleBuilderRequest, BoardParticipant } from "../schemas/request.js";
import type { ParticipantRecord, RoleBuilderStatus, ValidationIssue } from "../schemas/result.js";
import { selfCheck } from "./validator.js";
import { stripUtf8Bom } from "./json-ingress.js";
import { performInitialRuleSweep, reviseRoleMarkdown } from "./role-generator.js";
import { buildAuditEnvelope, pathExists, uniqueStringsCaseSensitive } from "./audit-utils.js";
import { mkdir, open, readFile, stat, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { loadSharedGovernanceRuntimeModule, loadSharedLearningEngineModule, loadSharedReviewEngineModule } from "./shared-module-loader.js";

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
  validationIssues: ValidationIssue[];
  reviewEngine?: Awaited<ReturnType<typeof loadSharedReviewEngineModule>>;
  reviewConfig?: Awaited<ReturnType<Awaited<ReturnType<typeof loadSharedReviewEngineModule>>["loadReviewRuntimeConfig"]>>;
  governanceContext: {
    snapshot_id: string;
    snapshot_manifest_path: string;
    component_rulebook_path: string;
    component_review_prompt_path: string;
    component_contract_path: string;
    authority_doc_paths: string[];
    review_runtime_config: unknown;
  };
  bindGovernance: <T extends Record<string, unknown>>(payload: T, context: { snapshot_id: string; snapshot_manifest_path: string }) => T & {
    governance_binding: { snapshot_id: string; snapshot_manifest_path: string };
  };
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
  rawInput: string,
  contextLabel: "leader" | "reviewer"
): Promise<string | null> {
  // TODO: Wire llm-tool-builder when complete. For now, use Codex agent.
  if (!rawInput || rawInput.trim().length === 0) {
    console.error("[board] Auto-fix skipped: empty input");
    return null;
  }
  try {
    const reviewEngine = await loadSharedReviewEngineModule();
    const fixPrompt = `You are fixing a parse error in the agent-role-builder board.
The ${contextLabel} LLM returned a response that could not be parsed as JSON.

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

    const cleaned = reviewEngine.cleanJsonResponse(result.response);
    JSON.parse(stripUtf8Bom(cleaned)); // validate it's actual JSON
    return cleaned;
  } catch (e) {
    console.error("[board] Auto-fix attempt failed:", e instanceof Error ? e.message : e);
    return null;
  }
}

// --- Structured types ---

type ReviewerVerdict = ReturnType<Awaited<ReturnType<typeof loadSharedReviewEngineModule>>["parseReviewerOutput"]>;

interface LeaderVerdict {
  status: "frozen" | "frozen_with_conditions" | "pushback" | "blocked" | "resume_required";
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
  severity?: "blocking" | "major" | "minor" | "suggestion";
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
  deferredItems: string[];
  improvementsApplied: string[];
  arbitrationUsed: boolean;
  arbitrationRationale: string | null;
  markdown: string;
  selfCheckIssues: ValidationIssue[];
  reviewerVerdicts: Map<string, ReviewerVerdict>;
  complianceMap?: ComplianceEntry[];
  fixItemsMap?: FixItem[];
}

// --- Main board execution ---

export async function executeBoard(
  request: RoleBuilderRequest,
  draftMarkdown: string,
  draftContract: Record<string, unknown>,
  selfCheckIssues: ValidationIssue[],
  validationIssues: ValidationIssue[] = [],
  runDir: string | null = null,
  governanceContext: {
    snapshot_id: string;
    snapshot_manifest_path: string;
    component_rulebook_path: string;
    component_review_prompt_path: string;
    component_contract_path: string;
    authority_doc_paths: string[];
    review_runtime_config: unknown;
  }
): Promise<{
  status: RoleBuilderStatus;
  rounds: BoardRoundResult[];
  allParticipants: ParticipantRecord[];
  statusReason: string;
  finalMarkdown: string;
  finalSelfCheckIssues: ValidationIssue[];
}> {
  const reviewEngine = await loadSharedReviewEngineModule();
  const governanceRuntime = await loadSharedGovernanceRuntimeModule();
  const ctx: BoardContext = {
    runDir,
    bugReportCounter: 0,
    validationIssues,
    governanceContext,
    bindGovernance: governanceRuntime.bindGovernance,
    reviewEngine,
    reviewConfig: governanceContext.review_runtime_config as Awaited<ReturnType<Awaited<ReturnType<typeof loadSharedReviewEngineModule>>["loadReviewRuntimeConfig"]>>,
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
    const rulebookRaw = JSON.parse(stripUtf8Bom(await readFile(governanceContext.component_rulebook_path, "utf-8")));
    currentRulebook = rulebookRaw.rules ?? [];
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    await writeBugReport({
      what_failed: "Loading governed rulebook before board execution",
      error_message: errorMsg,
      where: "executeBoard startup",
      context: {
        rulebook_path: governanceContext.component_rulebook_path,
      },
      input_that_caused_failure: "(rulebook load)",
      expected_format: "Valid JSON rulebook with a top-level rules array",
      component: "tools/agent-role-builder/board/startup",
      provenance: { provider: request.board_roster.leader.provider, model: request.board_roster.leader.model },
      timestamp: new Date().toISOString(),
    }, ctx);
    await writeRunPostmortem(request, rounds, ctx, "blocked");
    return {
      status: "blocked",
      rounds,
      allParticipants,
      statusReason: `Failed to load required rulebook: ${errorMsg}`,
      finalMarkdown: currentMarkdown,
      finalSelfCheckIssues: currentSelfCheckIssues,
    };
  }

  let pendingComplianceMap: ComplianceEntry[] = [];
  let pendingFixItemsMap: FixItem[] | undefined;
  try {
    const initialSweep = await performInitialRuleSweep(
      request,
      currentMarkdown,
      currentRulebook,
      currentSelfCheckIssues,
      governanceContext,
      ctx.runDir ? join(ctx.runDir, "runtime", "component-repair-engine", "initial-rule-sweep") : undefined
    );
    currentMarkdown = initialSweep.markdown;
    pendingComplianceMap = initialSweep.complianceMap as ComplianceEntry[];
    currentSelfCheckIssues = selfCheck(currentMarkdown, request);
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
    await writeRunPostmortem(request, rounds, ctx, "blocked");
    return {
      status: "blocked",
      rounds,
      allParticipants,
      statusReason: `Initial rulebook sweep failed: ${errorMsg}`,
      finalMarkdown: currentMarkdown,
      finalSelfCheckIssues: currentSelfCheckIssues,
    };
  }

  try {
    for (let round = 0; round < maxRounds; round++) {
    const roundDir = ctx.runDir ? join(ctx.runDir, "rounds", `round-${round}`) : null;
    if (roundDir) await mkdir(roundDir, { recursive: true });
    const roundSnapshotPaths = roundDir
      ? await writeRoundInputSnapshots(roundDir, request, currentMarkdown, currentSelfCheckIssues)
      : null;

    // Bug 7: Use compliance map and fix items map produced by the prior round's revision
    const complianceMap = pendingComplianceMap;
    const fixItemsMap = pendingFixItemsMap;

    if (roundDir) {
      await writeFile(join(roundDir, "compliance-map.json"), JSON.stringify({
        schema_version: "1.0", component: "agent-role-builder",
        scope: round === 0 ? "full" : "delta",
        artifact_path: (roundSnapshotPaths?.artifactMarkdownPath
          ?? (ctx.runDir
            ? join(ctx.runDir, `${request.role_slug}-role.md`)
            : `tools/agent-role-builder/runs/${request.job_id}/${request.role_slug}-role.md`)).replace(/\\/g, "/"),
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

    const roundResult = await executeRound(
        request, currentMarkdown, draftContract, currentSelfCheckIssues,
        round, rounds, activeReviewers, complianceMap, fixItemsMap, ctx,
        ctx.reviewEngine.resolveReviewMode(round, isSanityCheck, ctx.reviewConfig!)
      );
    roundResult.complianceMap = complianceMap;
    roundResult.fixItemsMap = fixItemsMap;
    rounds.push(roundResult);
    allParticipants.push(...roundResult.participants);

    // Update per-reviewer status so reviewer-local parse/runtime failures stay in the reviewer error lane.
    for (const [pid, verdict] of roundResult.reviewerVerdicts) {
      const key = pid.replace(/-r\d+$/, "");
      if (isParseErrorVerdict(verdict)) {
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
    const materialRepairChecklist = filterMaterialChecklist(repairChecklist);
    const finalRound = round >= maxRounds - 1;
    const hasAnyRepairWork = repairChecklist.length > 0 || roundResult.leaderVerdict === "pushback";
    const hasMaterialRepairWork = materialRepairChecklist.length > 0 || roundResult.leaderVerdict === "pushback";
    const legalityDecision = governanceRuntime.resolvePilotTerminalVerdict({
      leaderVerdict: roundResult.leaderVerdict,
      finalRound,
      hasAnyRepairWork,
      hasMaterialRepairWork,
    });
    let effectiveLeaderVerdict = legalityDecision.effectiveVerdict;
    let leaderVerdictOverrideReason: string | null = legalityDecision.overrideReason;
    if (leaderVerdictOverrideReason) {
      if (
        roundResult.leaderVerdict === "frozen"
        || roundResult.leaderVerdict === "frozen_with_conditions"
      ) {
        await writeBugReport({
          what_failed: `Leader emitted invalid ${roundResult.leaderVerdict} verdict`,
          error_message: leaderVerdictOverrideReason,
          where: `Round ${round}, leader terminal-state validation`,
          context: {
            round,
            material_repair_items: materialRepairChecklist.map((item) => item.groupId),
            unresolved: roundResult.unresolved,
            effective_leader_verdict: effectiveLeaderVerdict,
          },
          input_that_caused_failure: JSON.stringify({
            leader_verdict: roundResult.leaderVerdict,
            leader_rationale: roundResult.leaderRationale,
            material_repair_items: materialRepairChecklist,
            any_repair_items: repairChecklist.map((item) => item.groupId),
          }, null, 2).slice(0, 3000),
          expected_format: "A leader verdict that matches the live repair state after review, learning, and self-check evaluation.",
          component: "tools/agent-role-builder/board/leader-contract-validation",
          provenance: { provider: request.board_roster.leader.provider, model: request.board_roster.leader.model },
          timestamp: new Date().toISOString(),
        }, ctx);
      }
      roundResult.leaderRationale = `${roundResult.leaderRationale}\nGovernance override: ${leaderVerdictOverrideReason}`;
    }
    const canRevise = !finalRound
      && effectiveLeaderVerdict !== "blocked"
      && effectiveLeaderVerdict !== "resume_required"
      && effectiveLeaderVerdict !== "frozen"
      && effectiveLeaderVerdict !== "frozen_with_conditions"
      && hasAnyRepairWork;
    roundResult.deferredItems = collectDeferredItems(roundResult.reviewerVerdicts);
    roundResult.leaderVerdict = effectiveLeaderVerdict;
    roundResult.unresolved = buildCanonicalUnresolvedItems({
      effectiveLeaderVerdict,
      leaderUnresolved: roundResult.unresolved,
      materialRepairChecklist,
      deferredItems: roundResult.deferredItems,
    });

    if (roundDir) {
      await writeRoundReviewArtifact(roundDir, request, roundResult, ctx);
    }

    // --- Step 4: Learning engine (always) + revision (if not final and unresolved) ---
    {
      try {
        const { extractRules } = await loadSharedLearningEngineModule();
        let learningOutput = { new_rules: [] as unknown[], existing_rules_covering: [] as unknown[], no_rule_needed: [] as unknown[] };
        if (reviewChecklist.length > 0) {
          learningOutput = await extractRules(
            {
              component: "agent-role-builder",
              round,
              review_findings: reviewChecklist.map((finding) => ({
                group_id: finding.groupId,
                summary: finding.summary,
                severity: normalizeLearningSeverity(finding.severity),
                redesign_guidance: finding.redesignGuidance,
                finding_count: finding.findingCount,
              })),
              current_rulebook: currentRulebook,
              review_prompt_domain: ctx.reviewConfig?.componentPrompt.domain ?? "design",
              review_prompt_path: governanceContext.component_review_prompt_path,
              review_contract_path: governanceContext.component_contract_path,
              unresolved_from_leader: roundResult.unresolved,
            },
            async (prompt: string, sourcePath: string) => {
              const learningResult = await invoke({
                cli: request.board_roster.leader.provider as "codex" | "claude" | "gemini",
                model: request.board_roster.leader.model,
                reasoning: "high",
                bypass: false,
                timeout_ms: 120_000,
                prompt,
                source_path: sourcePath,
              });
              return learningResult.response;
            }
          );
        }

        if (roundDir) {
          await writeFile(join(roundDir, "learning.json"), JSON.stringify(learningOutput, null, 2), "utf-8");
        }

        // Frozen V1: learning is evidence-only for the current run and never mutates same-run authority.
        const newRuleIds: string[] = [];

        let diffSummary = {
          prior_length: roundResult.markdown.length,
          new_length: currentMarkdown.length,
          changed: false,
          revision_skipped: !canRevise,
          reason: !canRevise
            ? (effectiveLeaderVerdict === "blocked"
                ? "leader blocked"
                : finalRound
                  ? "final round"
                  : "no repair work")
            : undefined,
          summary: !canRevise
            ? (leaderVerdictOverrideReason
                ? `No repair pass was executed after this round. Governance override applied: ${leaderVerdictOverrideReason}`
                : "No repair pass was executed after this round.")
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
              governanceContext,
              bundleRoot: ctx.runDir ? join(ctx.runDir, "runtime", "component-repair-engine", `revision-r${round}`) : undefined,
            }
          );
          currentMarkdown = revisionResult.markdown;
          pendingComplianceMap = revisionResult.complianceMap as ComplianceEntry[];
          pendingFixItemsMap = revisionResult.fixItemsMap as FixItem[];
          currentSelfCheckIssues = selfCheck(currentMarkdown, request);
          diffSummary = {
            prior_length: revisionResult.diffSummary.prior_length,
            new_length: revisionResult.diffSummary.new_length,
            changed: revisionResult.diffSummary.changed,
            revision_skipped: false,
            reason: undefined,
            summary: revisionResult.diffSummary.summary,
          };
        } else if (finalRound && hasMaterialRepairWork && roundResult.leaderVerdict !== "blocked") {
          const ultimatumChecklist = buildBudgetExhaustionChecklist(
            roundResult.reviewerVerdicts,
            fixItemsMap,
            complianceMap,
            currentSelfCheckIssues
          );
          if (ultimatumChecklist.length > 0) {
            const revisionResult = await reviseRoleMarkdown(
              request,
              roundResult.markdown,
              {
                round: roundResult.round,
                leaderRationale: `${roundResult.leaderRationale}\nFinal-round ultimatum applied to the single most important remaining material item from each reviewer plus system material gaps.`,
                unresolved: roundResult.unresolved,
                fixChecklist: ultimatumChecklist,
                priorRoundIssueCount: rounds.map((priorRound) => priorRound.unresolved.length),
                rulebook: currentRulebook,
                newRuleIds,
                selfCheckIssues: currentSelfCheckIssues,
                governanceContext,
                bundleRoot: ctx.runDir ? join(ctx.runDir, "runtime", "component-repair-engine", `final-ultimatum-r${round}`) : undefined,
              }
            );
            currentMarkdown = revisionResult.markdown;
            pendingComplianceMap = revisionResult.complianceMap as ComplianceEntry[];
            pendingFixItemsMap = revisionResult.fixItemsMap as FixItem[];
            currentSelfCheckIssues = selfCheck(currentMarkdown, request);
            roundResult.markdown = currentMarkdown;
            roundResult.selfCheckIssues = currentSelfCheckIssues;
            roundResult.complianceMap = pendingComplianceMap;
            roundResult.fixItemsMap = pendingFixItemsMap;
            diffSummary = {
              prior_length: revisionResult.diffSummary.prior_length,
              new_length: revisionResult.diffSummary.new_length,
              changed: revisionResult.diffSummary.changed,
              revision_skipped: false,
              reason: "budget_exhaustion_ultimatum",
              summary: `${revisionResult.diffSummary.summary} Final-round ultimatum repair applied to ${ultimatumChecklist.length} items before exiting resume_required.`,
            };
          }
        }

        if (roundDir) {
          if (finalRound && diffSummary.reason === "budget_exhaustion_ultimatum") {
            await writeFile(join(roundDir, "compliance-map.json"), JSON.stringify({
              schema_version: "1.0",
              component: "agent-role-builder",
              scope: "delta",
              artifact_path: (roundSnapshotPaths?.artifactMarkdownPath
                ?? (ctx.runDir
                  ? join(ctx.runDir, `${request.role_slug}-role.md`)
                  : `tools/agent-role-builder/runs/${request.job_id}/${request.role_slug}-role.md`)).replace(/\\/g, "/"),
              git_commit: undefined,
              round,
              entries: pendingComplianceMap,
              unchecked_rules: [],
              generated_at: new Date().toISOString(),
            }, null, 2), "utf-8");
            if (pendingFixItemsMap && pendingFixItemsMap.length > 0) {
              await writeFile(join(roundDir, "fix-items-map.json"), JSON.stringify({
                schema_version: "1.0",
                component: "agent-role-builder",
                round,
                items: pendingFixItemsMap,
                generated_at: new Date().toISOString(),
              }, null, 2), "utf-8");
            }
          }
          await writeFile(join(roundDir, "diff-summary.json"), JSON.stringify(diffSummary, null, 2), "utf-8");
          await writeRoundReviewArtifact(roundDir, request, roundResult, ctx);
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

    if (effectiveLeaderVerdict === "blocked") {
      await writeRunPostmortem(request, rounds, ctx, "blocked");
      return { status: "blocked", rounds, allParticipants,
        statusReason: roundResult.leaderRationale,
        finalMarkdown: roundResult.markdown, finalSelfCheckIssues: roundResult.selfCheckIssues };
    }

    if (effectiveLeaderVerdict === "resume_required") {
      await writeRunPostmortem(request, rounds, ctx, "resume_required");
      return { status: "resume_required", rounds, allParticipants,
        statusReason: roundResult.leaderRationale,
        finalMarkdown: currentMarkdown, finalSelfCheckIssues: currentSelfCheckIssues };
    }

    if (!hasMaterialRepairWork && effectiveLeaderVerdict === "frozen_with_conditions") {
      await writeRunPostmortem(request, rounds, ctx, "frozen_with_conditions");
      return { status: "frozen_with_conditions", rounds, allParticipants,
        statusReason: roundResult.leaderRationale,
        finalMarkdown: currentMarkdown, finalSelfCheckIssues: currentSelfCheckIssues };
    }

    if (!hasMaterialRepairWork && effectiveLeaderVerdict === "frozen") {
      await writeRunPostmortem(request, rounds, ctx, "frozen");
      return { status: "frozen", rounds, allParticipants,
        statusReason: "All reviewers approved and no remaining repair work was found after learning and rule checks.",
        finalMarkdown: currentMarkdown, finalSelfCheckIssues: currentSelfCheckIssues };
    }

    if (finalRound && hasMaterialRepairWork) {
      await writeRunPostmortem(request, rounds, ctx, "resume_required");
      return { status: "resume_required", rounds, allParticipants,
        statusReason: `Budget exhausted after ${rounds.length} rounds. Final-round ultimatum applied; ${materialRepairChecklist.length} material items remain deferred.`,
        finalMarkdown: currentMarkdown, finalSelfCheckIssues: currentSelfCheckIssues };
    }

    await writeRunPostmortem(request, rounds, ctx);
  }
  } catch (error) {
    if (error instanceof BoardBlockedError) {
      console.error(`[board] Board blocked: ${error.message}`);
      await writeRunPostmortem(request, rounds, ctx, "blocked");
      return {
        status: "blocked",
        rounds,
        allParticipants,
        statusReason: error.message,
        finalMarkdown: currentMarkdown,
        finalSelfCheckIssues: currentSelfCheckIssues,
      };
    }
    throw error;
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
  const runDir = ctx.runDir;

  const roundSnapshots = await Promise.all(rounds.map(async (round) => {
    const reviewerParticipants = round.participants.filter((participant) => participant.role === "reviewer");
    const severityCounts = countRoundSeverities(round.reviewerVerdicts);
    const verdictBreakdown = {
      approved: 0,
      conditional: 0,
      reject: 0,
      error: 0,
    };

    for (const verdict of round.reviewerVerdicts.values()) {
      if (isParseErrorVerdict(verdict)) {
        verdictBreakdown.error++;
      } else {
        switch (verdict.verdict) {
          case "approved":
            verdictBreakdown.approved++;
            break;
          case "conditional":
            verdictBreakdown.conditional++;
            break;
          case "reject":
            verdictBreakdown.reject++;
            break;
          default:
            verdictBreakdown.reject++;
            break;
        }
      }
    }

    const artifactRefs = await buildRunArtifactRefs(runDir, join(runDir, "rounds", `round-${round.round}`), request);
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
        review_json: await pathExists(artifactRefs.review_json),
        compliance_map: await pathExists(artifactRefs.compliance_map),
        fix_items_map: artifactRefs.fix_items_map ? await pathExists(artifactRefs.fix_items_map) : false,
      },
      artifact_refs: artifactRefs,
    };
  }));

  const unresolvedTrend = roundSnapshots.map((snapshot) => snapshot.unresolved_count);
  const totalFallbacks = roundSnapshots.reduce((sum, snapshot) => sum + snapshot.fallback_count, 0);
  const totalReviewIssueCount = roundSnapshots.reduce(
    (sum, snapshot) =>
      sum
      + snapshot.severity_counts.blocking
      + snapshot.severity_counts.major
      + snapshot.severity_counts.minor
      + snapshot.severity_counts.suggestion,
    0
  );
  const latestRound = rounds.length > 0 ? rounds[rounds.length - 1] : null;
  const latestArtifactRefs = latestRound
    ? await buildRunArtifactRefs(runDir, join(runDir, "rounds", `round-${latestRound.round}`), request)
    : null;
  const postmortem = attachGovernanceBinding({
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
      "PM-003": {
        validation_issue_count: ctx.validationIssues.length,
        self_check_issue_count: latestRound?.selfCheckIssues.length ?? 0,
        review_issue_count: totalReviewIssueCount,
        total_issue_count: ctx.validationIssues.length + (latestRound?.selfCheckIssues.length ?? 0) + totalReviewIssueCount,
      },
      "PM-007": {
        unresolved_trend: unresolvedTrend,
        latest_unresolved_count: unresolvedTrend[unresolvedTrend.length - 1] ?? 0,
        convergence_observed: unresolvedTrend.length > 1
          ? unresolvedTrend[unresolvedTrend.length - 1] <= unresolvedTrend[0]
          : true,
      },
    },
    audit: {
      ...buildAuditEnvelope({
        requestJobId: request.job_id,
        round: latestRound?.round ?? 0,
        reviewMode: latestRound?.reviewMode ?? null,
        participants: latestRound?.participants ?? [],
        artifactRefs: latestArtifactRefs,
      }),
    },
  }, ctx);

  await writeFile(join(runDir, "run-postmortem.json"), JSON.stringify(postmortem, null, 2), "utf-8");
}

function buildRoundSnapshotPaths(roundDir: string, request: RoleBuilderRequest) {
  return {
    artifactMarkdownPath: join(roundDir, `${request.role_slug}-role.md`),
    selfCheckPath: join(roundDir, "self-check.json"),
  };
}

async function writeRoundInputSnapshots(
  roundDir: string,
  request: RoleBuilderRequest,
  markdown: string,
  selfCheckIssues: ValidationIssue[]
) {
  const paths = buildRoundSnapshotPaths(roundDir, request);
  await writeFile(paths.artifactMarkdownPath, markdown, "utf-8");
  await writeFile(paths.selfCheckPath, JSON.stringify(selfCheckIssues, null, 2), "utf-8");
  return paths;
}

async function buildRoundArtifactRefs(
  roundDir: string,
  request: RoleBuilderRequest
) {
  const roundSnapshots = buildRoundSnapshotPaths(roundDir, request);
  const fixItemsMapPath = join(roundDir, "fix-items-map.json");
  const learningJsonPath = join(roundDir, "learning.json");
  const diffSummaryPath = join(roundDir, "diff-summary.json");
  return {
    review_json: join(roundDir, "review.json").replace(/\\/g, "/"),
    compliance_map: join(roundDir, "compliance-map.json").replace(/\\/g, "/"),
    fix_items_map: await pathExists(fixItemsMapPath) ? fixItemsMapPath.replace(/\\/g, "/") : null,
    learning_json: await pathExists(learningJsonPath) ? learningJsonPath.replace(/\\/g, "/") : null,
    diff_summary: await pathExists(diffSummaryPath) ? diffSummaryPath.replace(/\\/g, "/") : null,
    artifact_markdown: roundSnapshots.artifactMarkdownPath.replace(/\\/g, "/"),
    self_check: roundSnapshots.selfCheckPath.replace(/\\/g, "/"),
  };
}

async function buildRunArtifactRefs(
  runDir: string,
  roundDir: string,
  request: RoleBuilderRequest
) {
  const fixItemsMapPath = join(roundDir, "fix-items-map.json");
  const learningJsonPath = join(roundDir, "learning.json");
  const diffSummaryPath = join(roundDir, "diff-summary.json");
  return {
    review_json: join(roundDir, "review.json").replace(/\\/g, "/"),
    compliance_map: join(roundDir, "compliance-map.json").replace(/\\/g, "/"),
    fix_items_map: await pathExists(fixItemsMapPath) ? fixItemsMapPath.replace(/\\/g, "/") : null,
    learning_json: await pathExists(learningJsonPath) ? learningJsonPath.replace(/\\/g, "/") : null,
    diff_summary: await pathExists(diffSummaryPath) ? diffSummaryPath.replace(/\\/g, "/") : null,
    artifact_markdown: join(runDir, `${request.role_slug}-role.md`).replace(/\\/g, "/"),
    self_check: join(runDir, "self-check.json").replace(/\\/g, "/"),
  };
}

async function writeRoundReviewArtifact(
  roundDir: string,
  request: RoleBuilderRequest,
  roundResult: BoardRoundResult,
  ctx: BoardContext
) {
  const artifactRefs = await buildRoundArtifactRefs(roundDir, request);
  const audit = buildAuditEnvelope({
    requestJobId: request.job_id,
    round: roundResult.round,
    reviewMode: roundResult.reviewMode,
    participants: roundResult.participants,
    artifactRefs,
  });
  await writeFile(join(roundDir, "review.json"), JSON.stringify(attachGovernanceBinding({
    round: roundResult.round,
    reviewMode: roundResult.reviewMode,
    leaderVerdict: roundResult.leaderVerdict,
    leaderRationale: roundResult.leaderRationale,
    unresolved: roundResult.unresolved,
    deferredItems: roundResult.deferredItems,
    improvementsApplied: roundResult.improvementsApplied,
    arbitrationUsed: roundResult.arbitrationUsed,
    arbitrationRationale: roundResult.arbitrationRationale,
    reviewerVerdicts: Object.fromEntries(roundResult.reviewerVerdicts),
    audit: {
      ...audit,
      participants: roundResult.participants.map((participant) => ({
        participant_id: participant.participant_id,
        provider: participant.provider,
        model: participant.model,
        latency_ms: participant.latency_ms ?? null,
        fallback_used: participant.was_fallback ?? false,
        invocation_id: participant.invocation_id ?? null,
      })),
    },
    participants: roundResult.participants.map((p) => ({
      participant_id: p.participant_id,
      provider: p.provider,
      model: p.model,
      role: p.role,
      round: p.round,
      latency_ms: p.latency_ms,
      invocation_id: p.invocation_id,
      was_fallback: p.was_fallback ?? false,
    })),
  }, ctx), null, 2), "utf-8");
}

function attachGovernanceBinding<T extends Record<string, unknown>>(payload: T, ctx: BoardContext) {
  return ctx.bindGovernance(payload, {
    snapshot_id: ctx.governanceContext.snapshot_id,
    snapshot_manifest_path: ctx.governanceContext.snapshot_manifest_path,
  });
}

async function withFileLock<T>(lockPath: string, action: () => Promise<T>): Promise<T> {
  const maxAttempts = 20;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let handle: Awaited<ReturnType<typeof open>> | null = null;
    try {
      handle = await open(lockPath, "wx");
      const result = await action();
      await handle.close();
      await unlink(lockPath).catch(() => {});
      return result;
    } catch (error) {
      if (handle) {
        await handle.close().catch(() => {});
        await unlink(lockPath).catch(() => {});
      }
      const code = error instanceof Error && "code" in error ? (error as NodeJS.ErrnoException).code : undefined;
      if (code === "EEXIST" && attempt < maxAttempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, 50 * (attempt + 1)));
        continue;
      }
      throw error;
    }
  }

  throw new Error(`Failed to acquire file lock: ${lockPath}`);
}

// Bug 7: generateComplianceMap() and generateFixItemsMap() removed.
// Compliance map and fix items map are now produced as part of the merged revision call
// in reviseRoleMarkdown() — see role-generator.ts.

// --- Round execution ---

async function executeRound(
  request: RoleBuilderRequest, markdown: string,
  contract: Record<string, unknown>,
  selfCheckIssues: ValidationIssue[],
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
    reviewerVerdicts.set(record.participant_id, await parseReviewerResponse(record.verdict ?? "", request, roundIndex, record.participant_id, ctx, fixItemsMap));
  }

  const leaderInputReviewerVerdicts = new Map(
    [...reviewerVerdicts.entries()].filter(([, verdict]) => !isParseErrorVerdict(verdict))
  );
  if (leaderInputReviewerVerdicts.size === 0) {
    const reportPath = await writeBugReport({
      what_failed: "No healthy reviewer verdicts remained after reviewer-local parse/runtime failures",
      error_message: "All active reviewer slots failed before producing governed JSON verdicts.",
      where: `Round ${roundIndex}, reviewer aggregation before leader synthesis`,
      context: {
        round: roundIndex,
        active_reviewer_count: activeReviewers.length,
        reviewer_ids: [...reviewerVerdicts.keys()],
      },
      input_that_caused_failure: JSON.stringify(Object.fromEntries(reviewerVerdicts), null, 2).slice(0, 3000),
      expected_format: "At least one successfully parsed reviewer verdict must remain before leader synthesis can continue.",
      component: "tools/agent-role-builder/board/executeRound",
      provenance: { provider: request.board_roster.leader.provider, model: request.board_roster.leader.model },
      timestamp: new Date().toISOString(),
    }, ctx ?? createNullBoardContext());
    throw new BoardBlockedError(
      `All reviewer slots failed before producing usable verdicts in round ${roundIndex}. Bug report: ${reportPath ?? "unknown"}`,
      reportPath
    );
  }

  const leaderRecord = await executeParticipant(
    request.board_roster.leader, request, markdown, contract, selfCheckIssues,
    roundIndex, "leader", priorRounds, leaderInputReviewerVerdicts, complianceMap, fixItemsMap, ctx,
    undefined, reviewMode
  );
  participants.push(leaderRecord);
  const leaderResponse = await parseLeaderResponse(leaderRecord.verdict ?? "pushback", request, roundIndex, leaderRecord.participant_id, ctx);

  return {
    round: roundIndex, reviewMode, participants, leaderVerdict: leaderResponse.status,
    leaderRationale: leaderResponse.rationale, unresolved: leaderResponse.unresolved,
    deferredItems: [],
    improvementsApplied: leaderResponse.improvements_applied,
    arbitrationUsed: leaderResponse.arbitration_used,
    arbitrationRationale: leaderResponse.arbitration_rationale,
    markdown, selfCheckIssues, reviewerVerdicts,
  };
}

async function executeParticipant(
  participant: BoardParticipant, request: RoleBuilderRequest,
  markdown: string, contract: Record<string, unknown>,
  selfCheckIssues: ValidationIssue[],
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
  selfCheckIssues: ValidationIssue[],
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
    : join(process.env.TEMP ?? process.env.TMP ?? (process.env.USERPROFILE ? `${process.env.USERPROFILE}\\AppData\\Local\\Temp` : process.cwd()), `adf-brief-${role}-${round}.md`);
  await writeFile(markdownFile, markdown, "utf-8");
  const mdRef = markdownFile.replace(/\\/g, "/");
  const reviewConfig = ctx?.reviewConfig;

  const selfCheckContext = selfCheckIssues.length > 0
    ? `\n\nSelf-check issues:\n${selfCheckIssues.map((i) => `- [${i.severity}/${i.code}] ${i.message}`).join("\n")}`
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
  const { buildLeaderPrompt, buildReviewerPrompt } = ctx!.reviewEngine;
  const promptInput = {
    componentName: "agent-role-builder",
    artifactLabel: `${request.role_name} draft role package`,
    round,
    reviewMode,
    artifactPath: mdRef,
    contractSummary,
    selfCheckContext,
    complianceContext,
    fixItemsContext,
    priorRounds: priorRounds.map((priorRound) => ({
      round: priorRound.round,
      reviewMode: priorRound.reviewMode,
      leaderVerdict: priorRound.leaderVerdict,
      unresolved: priorRound.unresolved,
      improvementsApplied: priorRound.improvementsApplied,
    })),
    currentRoundReviewers,
    config: reviewConfig!,
  };

  if (role === "reviewer") {
    return buildReviewerPrompt(promptInput);
  }

  return buildLeaderPrompt(promptInput);
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

function isParseErrorGroup(group: { id: string }): boolean {
  return group.id === "parse-error";
}

function isParseErrorVerdict(verdict: ReviewerVerdict): boolean {
  return verdict.conceptual_groups.some((group: { id: string }) => isParseErrorGroup(group));
}

function buildReviewerParseErrorVerdict(participantId: string | undefined, message: string, bugReportPath: string | null): ReviewerVerdict {
  const evidence = bugReportPath
    ? `Review transport/runtime failure. See bug report: ${bugReportPath}`
    : "Review transport/runtime failure. Bug report path unavailable.";

  return {
    verdict: "reject",
    conceptual_groups: [
      {
        id: "parse-error",
        summary: message,
        severity: "blocking",
        findings: [
          {
            id: "parse-error-detail",
            description: evidence,
            source_section: participantId ?? "reviewer-response",
          },
        ],
        redesign_guidance: "Treat this reviewer slot as unavailable for the round. Do not convert this transport/runtime failure into artifact repair work.",
      },
    ],
    fix_decisions: [],
    residual_risks: [
      "One reviewer slot failed before producing a governed verdict for this round.",
    ],
    strengths: [],
  };
}

async function parseReviewerResponse(
  raw: string,
  request: RoleBuilderRequest,
  round: number,
  participantId?: string,
  ctx?: BoardContext,
  fixItemsMap?: FixItem[]
): Promise<ReviewerVerdict> {
  const defaultCtx: BoardContext = ctx ?? createNullBoardContext();
  const reviewEngine = ctx?.reviewEngine ?? await loadSharedReviewEngineModule();
  // Bug 3 fix: pre-validate before any JSON parsing
  const preValidationFailure = reviewEngine.preValidateResponse(raw);
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
    console.error(`[board] Reviewer response pre-validation failed: ${preValidationFailure}`);
    return buildReviewerParseErrorVerdict(
      participantId,
      `Reviewer ${participantId ?? "unknown"} response pre-validation failed: ${preValidationFailure}.`,
      reportPath
    );
  }

  try {
    return reviewEngine.parseReviewerOutput(raw, {
      requireFixDecisions: Boolean(fixItemsMap && fixItemsMap.length > 0),
      config: ctx?.reviewConfig,
    });
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

    const fixed = await attemptAutoFix(bugReport, request, raw, "reviewer");
    if (fixed) {
      try {
        console.error("[board] Auto-fix succeeded for reviewer response parse");
        return reviewEngine.parseReviewerOutput(fixed, {
          requireFixDecisions: Boolean(fixItemsMap && fixItemsMap.length > 0),
          config: ctx?.reviewConfig,
        });
      } catch (autoFixError) {
        console.error("[board] Auto-fix produced invalid JSON:", autoFixError instanceof Error ? autoFixError.message : autoFixError);
      }
    }

    // Bug 1 fix: auto-fix failed — throw BoardBlockedError instead of returning degraded fallback
    console.error("[board] Reviewer parse failed and auto-fix failed. Returning reviewer-local parse-error verdict.");
    return buildReviewerParseErrorVerdict(
      participantId,
      `Reviewer ${participantId ?? "unknown"} response parse failed after auto-fix attempt.`,
      reportPath
    );
  }
}

async function parseLeaderResponse(raw: string, request: RoleBuilderRequest, round: number, participantId?: string, ctx?: BoardContext): Promise<LeaderVerdict> {
  const defaultCtx: BoardContext = ctx ?? createNullBoardContext();
  const reviewEngine = ctx?.reviewEngine ?? await loadSharedReviewEngineModule();
  // Bug 3 fix: pre-validate before any JSON parsing
  const preValidationFailure = reviewEngine.preValidateResponse(raw);
  if (preValidationFailure) {
    const bugReport: BugReport = {
      what_failed: "Leader response pre-validation",
      error_message: preValidationFailure,
      where: `Round ${round}, leader response pre-validation`,
      context: { round, raw_length: raw?.length ?? 0 },
      input_that_caused_failure: raw?.slice(0, 3000) ?? "(null/undefined)",
      expected_format: '{"status":"frozen|frozen_with_conditions|pushback|blocked|resume_required","rationale":"...","unresolved":[...],"improvements_applied":[...],"arbitration_used":false,"arbitration_rationale":null}',
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

  try {
    return reviewEngine.parseLeaderOutput(raw, { config: ctx?.reviewConfig });
  } catch (firstError) {
    // Error escalation: write bug report, attempt auto-fix
    const bugReport: BugReport = {
      what_failed: "Leader response JSON parse",
      error_message: firstError instanceof Error ? firstError.message : String(firstError),
      where: `Round ${round}, leader response parsing`,
      context: { round, raw_length: raw.length },
      input_that_caused_failure: raw.slice(0, 3000),
      expected_format: '{"status":"frozen|frozen_with_conditions|pushback|blocked|resume_required","rationale":"...","unresolved":[...],"improvements_applied":[...],"arbitration_used":false,"arbitration_rationale":null}',
      component: "tools/agent-role-builder/board/parseLeaderResponse",
      provenance: { participant_id: participantId },
      timestamp: new Date().toISOString(),
    };
    const reportPath = await writeBugReport(bugReport, defaultCtx);

    const fixed = await attemptAutoFix(bugReport, request, raw, "leader");
    if (fixed) {
      try {
        console.error("[board] Auto-fix succeeded for leader response parse");
        return reviewEngine.parseLeaderOutput(fixed, { config: ctx?.reviewConfig });
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

function createNullBoardContext(): BoardContext {
  return {
    runDir: null,
    bugReportCounter: 0,
    validationIssues: [],
    governanceContext: {
      snapshot_id: "none",
      snapshot_manifest_path: "none",
      component_rulebook_path: "none",
      component_review_prompt_path: "none",
      component_contract_path: "none",
      authority_doc_paths: [],
      review_runtime_config: null,
    },
    bindGovernance: <T extends Record<string, unknown>>(payload: T) => ({
      ...payload,
      governance_binding: {
        snapshot_id: "none",
        snapshot_manifest_path: "none",
      },
    }),
  };
}

function countRoundSeverities(reviewerVerdicts: Map<string, ReviewerVerdict>) {
  const counts = { blocking: 0, major: 0, minor: 0, suggestion: 0 };

  for (const verdict of reviewerVerdicts.values()) {
    for (const group of verdict.conceptual_groups) {
      if (isParseErrorGroup(group)) continue;
      switch (group.severity) {
        case "blocking":
          counts.blocking++;
          break;
        case "major":
          counts.major++;
          break;
        case "minor":
          counts.minor++;
          break;
        case "suggestion":
          counts.suggestion++;
          break;
        default:
          break;
      }
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
      if (isParseErrorGroup(group)) continue;
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
      const linkedSeverity = linkedFixItem?.severity
        ?? findSeverityForFixDecision(verdict, decision.finding_id, decision.finding_group_id)
        ?? "major";

      checklist.push({
        groupId: checklistId,
        severity: linkedSeverity,
        summary: linkedFixItem?.summary ?? `Fix decision ${decision.decision} requires more work`,
        redesignGuidance: decision.reason,
        findingCount: 1,
      });
    }
  }

  return checklist;
}

function findSeverityForFixDecision(
  verdict: ReviewerVerdict,
  findingId?: string,
  findingGroupId?: string
): "blocking" | "major" | "minor" | "suggestion" | null {
  if (findingGroupId) {
    const directGroup = verdict.conceptual_groups.find((group: { id: string; severity: "blocking" | "major" | "minor" | "suggestion" }) => group.id === findingGroupId);
    if (directGroup) return directGroup.severity;
  }

  if (findingId) {
    const matchedGroup = verdict.conceptual_groups.find((group: {
      severity: "blocking" | "major" | "minor" | "suggestion";
      findings: Array<{ id: string }>;
    }) =>
      group.findings.some((finding: { id: string }) => finding.id === findingId)
    );
    if (matchedGroup) return matchedGroup.severity;
  }

  return null;
}

function extendRepairChecklist(
  reviewChecklist: Array<{ groupId: string; severity: string; summary: string; redesignGuidance: string; findingCount: number }>,
  complianceMap: ComplianceEntry[],
  selfCheckIssues: ValidationIssue[]
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
      severity: issue.severity === "error"
        ? "major"
        : issue.severity === "warning"
          ? "minor"
          : "suggestion",
      summary: issue.message,
      redesignGuidance: `Resolve self-check issue ${issue.code} before the artifact can freeze.`,
      findingCount: 1,
    });
  }

  return checklist;
}

function filterMaterialChecklist(
  checklist: Array<{ groupId: string; severity: string; summary: string; redesignGuidance: string; findingCount: number }>
) {
  return checklist.filter((item) => item.severity === "blocking" || item.severity === "major");
}

function collectDeferredItems(reviewerVerdicts: Map<string, ReviewerVerdict>): string[] {
  return [...reviewerVerdicts.values()]
    .flatMap((verdict) => verdict.conceptual_groups)
    .filter((group) => group.severity === "minor" || group.severity === "suggestion")
    .map((group) => `${group.id}: ${group.summary}`);
}

function buildCanonicalUnresolvedItems(params: {
  effectiveLeaderVerdict: string;
  leaderUnresolved: string[];
  materialRepairChecklist: Array<{ groupId: string; summary: string }>;
  deferredItems: string[];
}): string[] {
  if (params.effectiveLeaderVerdict === "frozen") {
    return [];
  }

  if (params.effectiveLeaderVerdict === "frozen_with_conditions") {
    return uniqueStringsCaseSensitive(params.deferredItems);
  }

  if (
    params.effectiveLeaderVerdict === "pushback"
    || params.effectiveLeaderVerdict === "blocked"
    || params.effectiveLeaderVerdict === "resume_required"
  ) {
    const canonicalMaterialItems = params.materialRepairChecklist.map((item) => `${item.groupId}: ${item.summary}`);
    return canonicalMaterialItems.length > 0
      ? uniqueStringsCaseSensitive(canonicalMaterialItems)
      : uniqueStringsCaseSensitive(params.leaderUnresolved);
  }

  return uniqueStringsCaseSensitive(params.leaderUnresolved);
}

function buildBudgetExhaustionChecklist(
  reviewerVerdicts: Map<string, ReviewerVerdict>,
  fixItemsMap: FixItem[] | undefined,
  complianceMap: ComplianceEntry[],
  selfCheckIssues: ValidationIssue[]
): Array<{ groupId: string; severity: string; summary: string; redesignGuidance: string; findingCount: number }> {
  const ultimatumItems: Array<{ groupId: string; severity: string; summary: string; redesignGuidance: string; findingCount: number }> = [];
  const seen = new Set<string>();

  for (const verdict of reviewerVerdicts.values()) {
    const candidateGroups = collectReviewChecklist(new Map([["reviewer", verdict]]), fixItemsMap)
      .filter((item) => item.severity === "blocking" || item.severity === "major");
    const selected = candidateGroups[0];
    if (!selected || seen.has(selected.groupId)) continue;
    seen.add(selected.groupId);
    ultimatumItems.push(selected);
  }

  for (const entry of complianceMap) {
    if (entry.status !== "non_compliant") continue;
    const groupId = `rule-${entry.rule_id}`;
    if (seen.has(groupId)) continue;
    seen.add(groupId);
    ultimatumItems.push({
      groupId,
      severity: "major",
      summary: `Rule ${entry.rule_id} remains non-compliant`,
      redesignGuidance: entry.evidence_summary,
      findingCount: 1,
    });
  }

  for (const issue of selfCheckIssues) {
    const groupId = `self-check-${issue.code}`;
    if (seen.has(groupId)) continue;
    seen.add(groupId);
    ultimatumItems.push({
      groupId,
      severity: issue.severity === "error"
        ? "major"
        : issue.severity === "warning"
          ? "minor"
          : "suggestion",
      summary: issue.message,
      redesignGuidance: `Resolve self-check issue ${issue.code} before a future freeze attempt.`,
      findingCount: 1,
    });
  }

  return ultimatumItems;
}

function normalizeLearningSeverity(severity: string): "blocking" | "major" | "minor" | "suggestion" {
  if (severity === "blocking" || severity === "major" || severity === "minor" || severity === "suggestion") {
    return severity;
  }
  return "major";
}
