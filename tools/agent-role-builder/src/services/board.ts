import { invoke, createSystemProvenance, emit } from "../shared-imports.js";
import type { RoleBuilderRequest, BoardParticipant } from "../schemas/request.js";
import type { ParticipantRecord, RoleBuilderStatus } from "../schemas/result.js";
import { selfCheck } from "./validator.js";
import { reviseRoleMarkdown } from "./role-generator.js";
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

interface ReviewerVerdict {
  verdict: "approved" | "conditional" | "reject";
  conceptual_groups: Array<{
    id: string;
    summary: string;
    severity: "blocking" | "major" | "minor" | "suggestion";
    findings: Array<{ id: string; description: string; source_section: string }>;
    redesign_guidance: string;
  }>;
  fix_decisions?: Array<{
    finding_group_id: string;
    decision: "accept_fix" | "reject_fix" | "accept_rejection" | "reject_rejection";
    reason: string;
  }>;
  residual_risks: string[];
  strengths: string[];
}

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
  finding_group_id: string;
  action: "accepted" | "rejected";
  summary: string;
  evidence_location?: string;
  rejection_reason?: string;
}

export interface BoardRoundResult {
  round: number;
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
  const ctx: BoardContext = { runDir, bugReportCounter: 0 };
  const maxRounds = request.governance.max_review_rounds;
  const rounds: BoardRoundResult[] = [];
  const allParticipants: ParticipantRecord[] = [];
  let currentMarkdown = draftMarkdown;
  let currentSelfCheckIssues = selfCheckIssues;

  const reviewerStatus = new Map<string, "approved" | "conditional" | "reject" | "error" | "pending">();
  for (const r of request.board_roster.reviewers) {
    reviewerStatus.set(`reviewer-${r.provider}`, "pending");
  }
  let consecutiveDisputeRounds = 0;

  // Load rulebook once
  let currentRulebook: Array<{ id: string; rule: string; applies_to: string[]; do: string; dont: string; source: string; version: number }> = [];
  try {
    const rulebookRaw = JSON.parse(await readFile(join("tools/agent-role-builder", "rulebook.json"), "utf-8"));
    currentRulebook = rulebookRaw.rules ?? [];
  } catch (e) { console.error("[board] Failed to load rulebook:", e instanceof Error ? e.message : e); }

  // Bug 7 fix: compliance map and fix items map are now produced as part of the revision call.
  // For round 1+, they come from the prior revision.
  // Bug 5 fix: For round 0, generate an initial compliance map by checking each rulebook rule against the draft.
  let pendingComplianceMap: ComplianceEntry[] = generateInitialComplianceMap(currentRulebook, currentMarkdown);
  let pendingFixItemsMap: FixItem[] | undefined;

  for (let round = 0; round < maxRounds; round++) {
    const roundDir = ctx.runDir ? join(ctx.runDir, "rounds", `round-${round}`) : null;
    if (roundDir) await mkdir(roundDir, { recursive: true });

    // Bug 7: Use compliance map and fix items map produced by the prior round's revision
    const complianceMap = pendingComplianceMap;
    const fixItemsMap = pendingFixItemsMap;

    if (roundDir) {
      await writeFile(join(roundDir, "compliance-map.json"), JSON.stringify({
        schema_version: "1.0", component: "agent-role-builder",
        scope: round === 0 ? "full" : "delta", round, entries: complianceMap,
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
    const reviewersToRun = request.board_roster.reviewers.filter((r) => {
      const key = `reviewer-${r.provider}`;
      return reviewerStatus.get(key) !== "approved" && reviewerStatus.get(key) !== "conditional";
    });
    const isSanityCheck = reviewersToRun.length === 0;
    const activeReviewers = isSanityCheck ? request.board_roster.reviewers : reviewersToRun;

    let roundResult: BoardRoundResult;
    try {
      roundResult = await executeRound(
        request, currentMarkdown, draftContract, currentSelfCheckIssues,
        round, rounds, activeReviewers, complianceMap, fixItemsMap, ctx
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
        round: roundResult.round, leaderVerdict: roundResult.leaderVerdict,
        leaderRationale: roundResult.leaderRationale,
        unresolved: roundResult.unresolved,
        improvementsApplied: roundResult.improvementsApplied,
        reviewerVerdicts: Object.fromEntries(roundResult.reviewerVerdicts),
        participants: roundResult.participants.map((p) => ({
          participant_id: p.participant_id, provider: p.provider,
          model: p.model, role: p.role, round: p.round,
          latency_ms: p.latency_ms, invocation_id: p.invocation_id,
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

    if (roundResult.leaderVerdict === "frozen") {
      return { status: "frozen", rounds, allParticipants,
        statusReason: "All reviewers approved/conditional, leader confirmed freeze.",
        finalMarkdown: roundResult.markdown, finalSelfCheckIssues: roundResult.selfCheckIssues };
    }
    if (roundResult.leaderVerdict === "blocked") {
      return { status: "blocked", rounds, allParticipants,
        statusReason: roundResult.leaderRationale,
        finalMarkdown: roundResult.markdown, finalSelfCheckIssues: roundResult.selfCheckIssues };
    }

    // Arbitration check (Bug 2 fix: only count real verdicts, not "error" or "pending")
    const realVerdicts = [...reviewerStatus.values()].filter((s) => s !== "error" && s !== "pending");
    const hasReject = realVerdicts.some((s) => s === "reject");
    const hasApprove = realVerdicts.some((s) => s === "approved" || s === "conditional");
    if (hasReject && hasApprove) consecutiveDisputeRounds++;
    else consecutiveDisputeRounds = 0;

    if (consecutiveDisputeRounds >= 2 && request.governance.allow_single_arbitration_round) {
      const lastRound = rounds[rounds.length - 1];
      return { status: lastRound.unresolved.length <= 2 ? "frozen" : "resume_required",
        rounds, allParticipants,
        statusReason: `Arbitration after ${consecutiveDisputeRounds} consecutive splits: ${lastRound.leaderRationale}`,
        finalMarkdown: lastRound.markdown, finalSelfCheckIssues: lastRound.selfCheckIssues };
    }

    // --- Step 4: Learning engine (always) + revision (if not final and unresolved) ---
    {
      try {
        const canRevise = round < maxRounds - 1 && roundResult.unresolved.length > 0;
        const fixChecklist: Array<{
          groupId: string; severity: string; summary: string;
          redesignGuidance: string; findingCount: number;
        }> = [];

        for (const [, rv] of roundResult.reviewerVerdicts) {
          for (const group of rv.conceptual_groups) {
            fixChecklist.push({
              groupId: group.id, severity: group.severity,
              summary: group.summary, redesignGuidance: group.redesign_guidance,
              findingCount: Array.isArray(group.findings) ? group.findings.length : 0,
            });
          }
        }

        // Learning engine call
        let learningOutput = { new_rules: [] as unknown[], existing_rules_covering: [] as unknown[], no_rule_needed: [] as unknown[] };
        try {
          const learningResult = await invoke({
            cli: request.board_roster.leader.provider as "codex" | "claude" | "gemini",
            model: request.board_roster.leader.model, reasoning: "high",
            bypass: false, timeout_ms: 120_000,
            prompt: buildLearningPrompt(request, fixChecklist, currentRulebook, roundResult.unresolved, round),
            source_path: "tools/agent-role-builder/learning-engine",
          });
          learningOutput = JSON.parse(cleanJsonResponse(learningResult.response));
        } catch (e) { console.error(`[board] Learning engine failed (round ${round}, findings: ${fixChecklist.length}):`, e instanceof Error ? e.message : e); }

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

        // Revision (only if not final round and unresolved exist)
        // Bug 7: revision now returns compliance map and fix items map for the NEXT round
        if (canRevise) {
          const revisionResult = await reviseRoleMarkdown(
            request, roundResult.markdown,
            { round: roundResult.round, leaderRationale: roundResult.leaderRationale,
              unresolved: roundResult.unresolved, fixChecklist,
              priorRoundIssueCount: rounds.map((pr) => pr.unresolved.length),
              rulebook: currentRulebook, newRuleIds }
          );
          currentMarkdown = revisionResult.markdown;
          pendingComplianceMap = revisionResult.complianceMap as ComplianceEntry[];
          pendingFixItemsMap = revisionResult.fixItemsMap as FixItem[];
          currentSelfCheckIssues = selfCheck(currentMarkdown, request).map((i) => ({ code: i.code, message: i.message }));
        }

        // Diff summary always written (shows whether revision happened)
        if (roundDir) {
          await writeFile(join(roundDir, "diff-summary.json"), JSON.stringify({
            prior_length: roundResult.markdown.length, new_length: currentMarkdown.length,
            changed: roundResult.markdown !== currentMarkdown,
            revision_skipped: !canRevise,
            reason: !canRevise ? (round >= maxRounds - 1 ? "final round" : "no unresolved issues") : undefined,
          }, null, 2), "utf-8");
        }
      } catch (e) {
        // IMP-016: Revision is critical — never silently swallow. Write bug report, escalate.
        const errorMsg = e instanceof Error ? e.message : String(e);
        console.error("[board] Revision/learning failed (critical):", errorMsg);

        const bugReport: BugReport = {
          what_failed: "Revision or learning engine during board loop",
          error_message: errorMsg,
          where: `Round ${round}, revision/learning block`,
          context: { round, maxRounds, markdown_length: currentMarkdown.length, unresolved_count: roundResult.unresolved.length },
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
  }

  const lastRound = rounds[rounds.length - 1];
  return { status: "resume_required", rounds, allParticipants,
    statusReason: `Budget exhausted after ${rounds.length} rounds. ${lastRound?.unresolved.length ?? 0} unresolved.`,
    finalMarkdown: lastRound?.markdown ?? currentMarkdown,
    finalSelfCheckIssues: lastRound?.selfCheckIssues ?? currentSelfCheckIssues };
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
  activeReviewers: BoardParticipant[],
  complianceMap?: ComplianceEntry[], fixItemsMap?: FixItem[],
  ctx?: BoardContext
): Promise<BoardRoundResult> {
  const participants: ParticipantRecord[] = [];
  const reviewerVerdicts = new Map<string, ReviewerVerdict>();

  for (const reviewer of activeReviewers) {
    const record = await executeParticipant(
      reviewer, request, markdown, contract, selfCheckIssues,
      roundIndex, "reviewer", priorRounds, undefined, complianceMap, fixItemsMap, ctx
    );
    participants.push(record);
    reviewerVerdicts.set(record.participant_id, await parseReviewerResponse(record.verdict ?? "", request, roundIndex, record.participant_id, ctx));
  }

  const leaderRecord = await executeParticipant(
    request.board_roster.leader, request, markdown, contract, selfCheckIssues,
    roundIndex, "leader", priorRounds, participants, complianceMap, fixItemsMap, ctx
  );
  participants.push(leaderRecord);
  const leaderResponse = await parseLeaderResponse(leaderRecord.verdict ?? "pushback", request, roundIndex, leaderRecord.participant_id, ctx);

  return {
    round: roundIndex, participants, leaderVerdict: leaderResponse.status,
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
  currentRoundReviewers?: ParticipantRecord[],
  complianceMap?: ComplianceEntry[], fixItemsMap?: FixItem[],
  ctx?: BoardContext
): Promise<ParticipantRecord> {
  const participantId = `${role}-${participant.provider}-r${round}`;
  const sourcePath = `tools/agent-role-builder/${role === "leader" ? "leader-synthesis" : "review"}`;

  const brief = await buildBrief(
    request, markdown, contract, selfCheckIssues,
    round, role, priorRounds, currentRoundReviewers, complianceMap, fixItemsMap, ctx
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
      board_rounds: round + 1, participants: 1 });
    return { participant_id: participantId, provider: participant.provider,
      model: participant.model, role, verdict: result.response,
      round, latency_ms, invocation_id: result.provenance.invocation_id };
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
  currentRoundReviewers?: ParticipantRecord[],
  complianceMap?: ComplianceEntry[], fixItemsMap?: FixItem[],
  ctx?: BoardContext
): Promise<string> {
  // Write markdown to temp file — prompts must stay under 4KB
  const markdownFile = ctx?.runDir
    ? join(ctx.runDir, `brief-markdown-r${round}-${role}.md`)
    : join(process.env.USERPROFILE ? `${process.env.USERPROFILE}\\AppData\\Local\\Temp` : ".", `adf-brief-${role}-${round}.md`);
  const { writeFile: wf } = await import("node:fs/promises");
  await wf(markdownFile, markdown, "utf-8");
  const mdRef = markdownFile.replace(/\\/g, "/");
  const priorContext = priorRounds.length > 0
    ? `\n\nPrior rounds:\n${priorRounds.map((r) =>
        `Round ${r.round}: Leader=${r.leaderVerdict}. Unresolved: ${r.unresolved.length}. Improvements: ${r.improvementsApplied.length}.`
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
        `- [${f.finding_group_id}] ${f.action}: ${f.summary}${f.rejection_reason ? ` (REJECTED: ${f.rejection_reason})` : ""}`
      ).join("\n")}` : "";

  const contractSummary = JSON.stringify({
    intent: request.intent, primary_objective: request.primary_objective,
    out_of_scope: request.out_of_scope, governance: request.governance,
    runtime: request.runtime, package_files: contract["package_files"],
  }, null, 2);

  if (role === "reviewer") {
    const fixDecisionInstruction = fixItemsMap && fixItemsMap.length > 0
      ? `\n\nIMPORTANT: The implementer provided a fix items map. For each item, you MUST respond with a fix_decisions array:
[{ "finding_group_id": "...", "decision": "accept_fix" | "reject_fix" | "accept_rejection" | "reject_rejection", "reason": "..." }]
Include this in your JSON response as "fix_decisions".` : "";

    return `You are a REVIEWER for the agent-role-builder tool (round ${round}).
Review the draft role package for ${request.role_name} (slug: ${request.role_slug}).

RESPOND WITH JSON ONLY:
{
  "verdict": "approved" | "conditional" | "reject",
  "conceptual_groups": [{ "id": "group-1", "summary": "...", "severity": "blocking"|"major"|"minor"|"suggestion",
    "findings": [{ "id": "f1", "description": "...", "source_section": "..." }], "redesign_guidance": "..." }],
  ${fixItemsMap && fixItemsMap.length > 0 ? '"fix_decisions": [{ "finding_group_id": "...", "decision": "accept_fix"|"reject_fix"|"accept_rejection"|"reject_rejection", "reason": "..." }],' : ''}
  "residual_risks": ["..."], "strengths": ["..."]
}

VERDICT RULES:
- "approved" = no blocking or major issues
- "conditional" = minor issues only
- "reject" = blocking or major issues
- Group findings by root cause with severity and source_section
${fixDecisionInstruction}

REVIEW SCOPE: tag completeness, authority clarity, scope boundaries, artifact lifecycle, no invented semantics
Source authority: read docs/v0/review-process-architecture.md and docs/v0/architecture.md for canonical governance.

READ the draft role markdown from: ${mdRef}

Contract summary:
${contractSummary}
${selfCheckContext}${complianceContext}${fixItemsContext}${priorContext}

JSON response:`;
  }

  const reviewerContext = currentRoundReviewers
    ? `\n\nReviewer verdicts:\n${currentRoundReviewers.map((r) =>
        `${r.participant_id}:\n${r.verdict ?? "(no verdict)"}`).join("\n\n")}` : "";

  return `You are the LEADER for the agent-role-builder tool (round ${round}).
Synthesize reviewer feedback and determine terminal status for ${request.role_name}.

RESPOND WITH JSON ONLY:
{ "status": "frozen"|"pushback"|"blocked", "rationale": "...",
  "unresolved": ["blocking/major only"], "improvements_applied": ["..."],
  "arbitration_used": false, "arbitration_rationale": null }

RULES: frozen = all approved/conditional, no blocking. pushback = any reject with blocking/major.
Count only blocking+major as material. Minor/suggestion don't block freeze.

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

// --- Initial compliance map (Bug 5 fix) ---

/**
 * Generate an initial compliance map by checking each rulebook rule against the draft markdown.
 * Uses keyword matching from applies_to and rule text to determine if the markdown
 * addresses each rule's concern area. This is a heuristic — the LLM-generated compliance
 * map from revision rounds will be more accurate.
 */
function generateInitialComplianceMap(
  rulebook: Array<{ id: string; rule: string; applies_to: string[] | string }>,
  markdown: string
): ComplianceEntry[] {
  const mdLower = markdown.toLowerCase();
  return rulebook.map((r) => {
    const appliesTo = Array.isArray(r.applies_to) ? r.applies_to : [String(r.applies_to)];
    // Extract keywords from applies_to and first 100 chars of rule
    const keywords = appliesTo
      .flatMap((a) => a.toLowerCase().split(/[\s,<>()]+/).filter((w) => w.length > 3))
      .concat(r.rule.toLowerCase().split(/\s+/).slice(0, 8).filter((w) => w.length > 3));

    const matchCount = keywords.filter((kw) => mdLower.includes(kw)).length;
    const coverage = keywords.length > 0 ? matchCount / keywords.length : 0;

    if (coverage >= 0.5) {
      return { rule_id: r.id, status: "compliant" as const, evidence_location: "initial draft", evidence_summary: `Keyword coverage ${Math.round(coverage * 100)}% — initial heuristic check` };
    } else if (coverage >= 0.2) {
      return { rule_id: r.id, status: "non_compliant" as const, evidence_location: "initial draft", evidence_summary: `Low keyword coverage ${Math.round(coverage * 100)}% — needs LLM review` };
    } else {
      return { rule_id: r.id, status: "not_applicable" as const, evidence_location: "initial draft", evidence_summary: `Rule topic not found in draft — may not apply to this section` };
    }
  });
}

// --- Learning prompt ---

function buildLearningPrompt(
  request: RoleBuilderRequest,
  findings: Array<{ groupId: string; severity: string; summary: string; redesignGuidance: string }>,
  rulebook: Array<{ id: string; rule: string }>,
  unresolved: string[], round: number
): string {
  return `You are the ADF Learning Engine. Extract generalizable rules from review feedback.

DOMAIN: design (role definition)
COMPONENT: agent-role-builder
ROUND: ${round}

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
