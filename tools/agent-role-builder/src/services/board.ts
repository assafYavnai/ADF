import { invoke, createSystemProvenance, emit } from "../shared-imports.js";
import type { RoleBuilderRequest, BoardParticipant } from "../schemas/request.js";
import type { ParticipantRecord, RoleBuilderStatus } from "../schemas/result.js";
import { selfCheck } from "./validator.js";
import { reviseRoleMarkdown } from "./role-generator.js";

/**
 * Structured review feedback — not flat string lists.
 * Findings grouped by root cause, with severity and redesign guidance.
 */
interface ReviewerVerdict {
  verdict: "approved" | "conditional" | "reject";
  conceptual_groups: Array<{
    id: string;
    summary: string;
    severity: "blocking" | "major" | "minor" | "suggestion";
    findings: Array<{
      id: string;
      description: string;
      source_section: string;
    }>;
    redesign_guidance: string;
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
}

export async function executeBoard(
  request: RoleBuilderRequest,
  draftMarkdown: string,
  draftContract: Record<string, unknown>,
  selfCheckIssues: Array<{ code: string; message: string }>
): Promise<{
  status: RoleBuilderStatus;
  rounds: BoardRoundResult[];
  allParticipants: ParticipantRecord[];
  statusReason: string;
  finalMarkdown: string;
  finalSelfCheckIssues: Array<{ code: string; message: string }>;
}> {
  const maxRounds = request.governance.max_review_rounds;
  const rounds: BoardRoundResult[] = [];
  const allParticipants: ParticipantRecord[] = [];
  let currentMarkdown = draftMarkdown;
  let currentSelfCheckIssues = selfCheckIssues;

  // Track per-reviewer verdict history for split-verdict strategy
  const reviewerStatus = new Map<string, "approved" | "conditional" | "reject" | "pending">();
  for (const r of request.board_roster.reviewers) {
    reviewerStatus.set(`reviewer-${r.provider}`, "pending");
  }

  // Track consecutive dispute count for arbitration trigger
  let consecutiveDisputeRounds = 0;

  for (let round = 0; round < maxRounds; round++) {
    // Split-verdict strategy: only run reviewers that haven't approved yet
    const reviewersToRun = request.board_roster.reviewers.filter((r) => {
      const key = `reviewer-${r.provider}`;
      const status = reviewerStatus.get(key);
      return status !== "approved"; // run pending, conditional, reject
    });

    // If all reviewers approved in prior round, run sanity check with all
    const isSanityCheck = reviewersToRun.length === 0;
    const activeReviewers = isSanityCheck ? request.board_roster.reviewers : reviewersToRun;

    const roundResult = await executeRound(
      request, currentMarkdown, draftContract, currentSelfCheckIssues,
      round, rounds, activeReviewers, isSanityCheck
    );
    rounds.push(roundResult);
    allParticipants.push(...roundResult.participants);

    // Update per-reviewer status
    for (const [pid, verdict] of roundResult.reviewerVerdicts) {
      const key = pid.replace(/-r\d+$/, ""); // strip round suffix
      if (verdict.verdict === "approved") reviewerStatus.set(key, "approved");
      else if (verdict.verdict === "conditional") reviewerStatus.set(key, "conditional");
      else reviewerStatus.set(key, "reject");
    }

    // Check for frozen
    if (roundResult.leaderVerdict === "frozen") {
      return {
        status: "frozen", rounds, allParticipants,
        statusReason: "All reviewers approved/conditional, leader confirmed freeze.",
        finalMarkdown: roundResult.markdown,
        finalSelfCheckIssues: roundResult.selfCheckIssues,
      };
    }

    if (roundResult.leaderVerdict === "blocked") {
      return {
        status: "blocked", rounds, allParticipants,
        statusReason: roundResult.leaderRationale,
        finalMarkdown: roundResult.markdown,
        finalSelfCheckIssues: roundResult.selfCheckIssues,
      };
    }

    // Check dispute pattern for arbitration
    const hasReject = [...reviewerStatus.values()].some((s) => s === "reject");
    const hasApprove = [...reviewerStatus.values()].some((s) => s === "approved" || s === "conditional");
    if (hasReject && hasApprove) {
      consecutiveDisputeRounds++;
    } else {
      consecutiveDisputeRounds = 0;
    }

    // Arbitration trigger: same split for 2+ consecutive rounds
    if (consecutiveDisputeRounds >= 2 && request.governance.allow_single_arbitration_round) {
      // Leader makes final call with full evidence
      const lastRound = rounds[rounds.length - 1];
      return {
        status: lastRound.unresolved.length <= 2 ? "frozen" : "resume_required",
        rounds, allParticipants,
        statusReason: `Arbitration triggered after ${consecutiveDisputeRounds} consecutive split verdicts. Leader arbitration: ${lastRound.leaderRationale}`,
        finalMarkdown: lastRound.markdown,
        finalSelfCheckIssues: lastRound.selfCheckIssues,
      };
    }

    // Revise draft for next round if there are unresolved issues
    if (round < maxRounds - 1 && roundResult.unresolved.length > 0) {
      try {
        currentMarkdown = await reviseRoleMarkdown(
          request, roundResult.markdown, draftContract,
          {
            round: roundResult.round,
            leaderRationale: roundResult.leaderRationale,
            unresolved: roundResult.unresolved,
            participants: roundResult.participants.map((p) => ({
              participant_id: p.participant_id,
              verdict: p.verdict,
            })),
          },
          rounds.map((pr) => ({
            round: pr.round,
            leaderRationale: pr.leaderRationale,
            unresolved: pr.unresolved,
          }))
        );
        currentSelfCheckIssues = selfCheck(currentMarkdown, request).map((i) => ({
          code: i.code, message: i.message,
        }));
      } catch {
        currentMarkdown = roundResult.markdown;
        currentSelfCheckIssues = roundResult.selfCheckIssues;
      }
    }
  }

  const lastRound = rounds[rounds.length - 1];
  return {
    status: "resume_required",
    rounds, allParticipants,
    statusReason: `Review budget exhausted after ${rounds.length} rounds. ${lastRound?.unresolved.length ?? 0} unresolved.`,
    finalMarkdown: lastRound?.markdown ?? currentMarkdown,
    finalSelfCheckIssues: lastRound?.selfCheckIssues ?? currentSelfCheckIssues,
  };
}

async function executeRound(
  request: RoleBuilderRequest,
  markdown: string,
  contract: Record<string, unknown>,
  selfCheckIssues: Array<{ code: string; message: string }>,
  roundIndex: number,
  priorRounds: BoardRoundResult[],
  activeReviewers: BoardParticipant[],
  isSanityCheck: boolean
): Promise<BoardRoundResult> {
  const participants: ParticipantRecord[] = [];
  const reviewerVerdicts = new Map<string, ReviewerVerdict>();

  for (const reviewer of activeReviewers) {
    const record = await executeParticipant(
      reviewer, request, markdown, contract, selfCheckIssues,
      roundIndex, "reviewer", priorRounds
    );
    participants.push(record);
    reviewerVerdicts.set(record.participant_id, parseReviewerResponse(record.verdict ?? ""));
  }

  const leaderRecord = await executeParticipant(
    request.board_roster.leader, request, markdown, contract, selfCheckIssues,
    roundIndex, "leader", priorRounds, participants
  );
  participants.push(leaderRecord);

  const leaderResponse = parseLeaderResponse(leaderRecord.verdict ?? "pushback");

  return {
    round: roundIndex,
    participants,
    leaderVerdict: leaderResponse.status,
    leaderRationale: leaderResponse.rationale,
    unresolved: leaderResponse.unresolved,
    improvementsApplied: leaderResponse.improvements_applied,
    markdown,
    selfCheckIssues,
    reviewerVerdicts,
  };
}

async function executeParticipant(
  participant: BoardParticipant,
  request: RoleBuilderRequest,
  markdown: string,
  contract: Record<string, unknown>,
  selfCheckIssues: Array<{ code: string; message: string }>,
  round: number,
  role: "leader" | "reviewer",
  priorRounds: BoardRoundResult[],
  currentRoundReviewers?: ParticipantRecord[]
): Promise<ParticipantRecord> {
  const participantId = `${role}-${participant.provider}-r${round}`;
  const sourcePath = `tools/agent-role-builder/${role === "leader" ? "leader-synthesis" : "review"}`;

  const brief = buildBrief(
    request, markdown, contract, selfCheckIssues,
    round, role, priorRounds, currentRoundReviewers
  );

  const start = Date.now();
  try {
    const result = await invoke({
      cli: participant.provider as "codex" | "claude" | "gemini",
      model: participant.model,
      reasoning: participant.throttle,
      bypass: false,
      timeout_ms: request.runtime.watchdog_timeout_seconds * 1000,
      prompt: brief,
      source_path: sourcePath,
    });

    const latency_ms = Date.now() - start;
    emit({
      provenance: result.provenance,
      category: "tool",
      operation: `role-builder-${role}`,
      latency_ms, success: true,
      board_rounds: round + 1, participants: 1,
    });

    return {
      participant_id: participantId,
      provider: participant.provider,
      model: participant.model,
      role, verdict: result.response,
      round, latency_ms,
      invocation_id: result.provenance.invocation_id,
    };
  } catch (err) {
    const latency_ms = Date.now() - start;
    const errorMsg = err instanceof Error ? err.message : String(err);
    emit({
      provenance: createSystemProvenance(sourcePath),
      category: "tool",
      operation: `role-builder-${role}`,
      latency_ms, success: false,
      metadata: { error: errorMsg },
    });
    return {
      participant_id: participantId,
      provider: participant.provider,
      model: participant.model,
      role, verdict: `ERROR: ${errorMsg}`,
      round, latency_ms,
    };
  }
}

// --- Structured prompts ---

function buildBrief(
  request: RoleBuilderRequest,
  markdown: string,
  contract: Record<string, unknown>,
  selfCheckIssues: Array<{ code: string; message: string }>,
  round: number,
  role: "leader" | "reviewer",
  priorRounds: BoardRoundResult[],
  currentRoundReviewers?: ParticipantRecord[]
): string {
  const priorContext = priorRounds.length > 0
    ? `\n\nPrior rounds:\n${priorRounds.map((r) =>
        `Round ${r.round}: Leader=${r.leaderVerdict}. Unresolved: ${r.unresolved.length}. Improvements: ${r.improvementsApplied.length}.`
      ).join("\n")}`
    : "";

  const selfCheckContext = selfCheckIssues.length > 0
    ? `\n\nSelf-check issues:\n${selfCheckIssues.map((i) => `- [${i.code}] ${i.message}`).join("\n")}`
    : "\n\nSelf-check: passed";

  const contractSummary = JSON.stringify({
    intent: request.intent,
    primary_objective: request.primary_objective,
    out_of_scope: request.out_of_scope,
    governance: request.governance,
    runtime: request.runtime,
    package_files: contract["package_files"],
  }, null, 2);

  if (role === "reviewer") {
    return `You are a REVIEWER for the agent-role-builder tool (round ${round}).
Review the draft role package for ${request.role_name} (slug: ${request.role_slug}).

RESPOND WITH JSON ONLY matching this schema:
{
  "verdict": "approved" | "conditional" | "reject",
  "conceptual_groups": [
    {
      "id": "group-1",
      "summary": "root cause description",
      "severity": "blocking" | "major" | "minor" | "suggestion",
      "findings": [
        { "id": "f1", "description": "specific issue", "source_section": "<tag> or line" }
      ],
      "redesign_guidance": "what to do about it"
    }
  ],
  "residual_risks": ["risks that are not blocking but need tracking"],
  "strengths": ["what is good"]
}

VERDICT RULES:
- "approved" = no blocking or major issues, ready to freeze
- "conditional" = minor issues only, can freeze after these specific fixes
- "reject" = blocking or major issues require redesign before freeze
- Group findings by root cause, not as flat lists
- Every finding must have severity and source_section
- Include redesign_guidance for every group with blocking/major severity

REVIEW SCOPE:
- Tag completeness and structural coherence
- Authority clarity and boundary consistency
- Scope delineation (no contradictions between sections)
- Artifact lifecycle consistency (outputs match completion criteria)
- No invented semantics or authority expansion

Draft role markdown:
${markdown}

Contract summary:
${contractSummary}
${selfCheckContext}${priorContext}

JSON response:`;
  }

  // Leader prompt
  const reviewerContext = currentRoundReviewers
    ? `\n\nReviewer verdicts this round:\n${currentRoundReviewers.map((r) =>
        `${r.participant_id}:\n${r.verdict ?? "(no verdict)"}`
      ).join("\n\n")}`
    : "";

  return `You are the LEADER for the agent-role-builder tool (round ${round}).
Synthesize reviewer feedback and determine terminal status for ${request.role_name}.

RESPOND WITH JSON ONLY:
{
  "status": "frozen" | "pushback" | "blocked",
  "rationale": "explanation",
  "unresolved": ["only blocking/major issues still open"],
  "improvements_applied": ["what was fixed since last round"],
  "arbitration_used": false,
  "arbitration_rationale": null
}

DECISION RULES:
- "frozen" = ALL reviewers approved or conditional, no blocking groups remain
- "pushback" = any reviewer has reject verdict with blocking/major groups
- "blocked" = non-recoverable structural issue
- Ignore "suggestion" severity findings for freeze decision
- "minor" severity findings can be frozen with (conditional status from reviewer)
- If one reviewer approved and another rejected, flag the split but focus only on the rejecting reviewer's blocking findings
- Count only blocking and major severity groups as material pushback

Draft:
${markdown}
${selfCheckContext}${reviewerContext}${priorContext}

JSON response:`;
}

// --- Response parsing ---

function parseReviewerResponse(raw: string): ReviewerVerdict {
  try {
    const cleaned = raw.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    const verdict = parsed.verdict === "approve" ? "approved" : parsed.verdict;
    return {
      verdict: verdict ?? "reject",
      conceptual_groups: Array.isArray(parsed.conceptual_groups) ? parsed.conceptual_groups : [],
      residual_risks: Array.isArray(parsed.residual_risks) ? parsed.residual_risks : [],
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
    };
  } catch {
    return {
      verdict: "reject",
      conceptual_groups: [{ id: "parse-error", summary: "Failed to parse reviewer response", severity: "blocking", findings: [], redesign_guidance: "Fix reviewer output format" }],
      residual_risks: [],
      strengths: [],
    };
  }
}

function parseLeaderResponse(raw: string): LeaderVerdict {
  try {
    const cleaned = raw.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    return {
      status: parsed.status ?? "pushback",
      rationale: parsed.rationale ?? "No rationale",
      unresolved: Array.isArray(parsed.unresolved) ? parsed.unresolved : [],
      improvements_applied: Array.isArray(parsed.improvements_applied) ? parsed.improvements_applied : [],
      arbitration_used: parsed.arbitration_used ?? false,
      arbitration_rationale: parsed.arbitration_rationale ?? null,
    };
  } catch {
    return {
      status: "pushback",
      rationale: `Parse failed: ${raw.slice(0, 200)}`,
      unresolved: ["Leader response parsing failed"],
      improvements_applied: [],
      arbitration_used: false,
      arbitration_rationale: null,
    };
  }
}
