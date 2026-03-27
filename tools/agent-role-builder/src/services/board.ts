import { randomUUID } from "node:crypto";
import { invoke, createSystemProvenance, emit } from "../shared-imports.js";
import type { RoleBuilderRequest, BoardParticipant } from "../schemas/request.js";
import type { ParticipantRecord, RoleBuilderStatus } from "../schemas/result.js";

export interface BoardRoundResult {
  round: number;
  participants: ParticipantRecord[];
  leaderVerdict: string;
  leaderRationale: string;
  unresolved: string[];
}

/**
 * Execute the full board review process.
 * Returns all round results and the final terminal decision.
 */
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
}> {
  const maxRounds = request.governance.max_review_rounds;
  const rounds: BoardRoundResult[] = [];
  const allParticipants: ParticipantRecord[] = [];

  for (let round = 0; round < maxRounds; round++) {
    const roundResult = await executeRound(
      request, draftMarkdown, draftContract, selfCheckIssues, round, rounds
    );
    rounds.push(roundResult);
    allParticipants.push(...roundResult.participants);

    if (roundResult.leaderVerdict === "frozen") {
      return {
        status: "frozen",
        rounds,
        allParticipants,
        statusReason: "All reviewers approved, leader confirmed freeze.",
      };
    }

    if (roundResult.leaderVerdict === "blocked") {
      return {
        status: "blocked",
        rounds,
        allParticipants,
        statusReason: roundResult.leaderRationale,
      };
    }
  }

  // Budget exhausted — try arbitration if enabled
  if (request.governance.allow_single_arbitration_round && rounds.length > 0) {
    const lastRound = rounds[rounds.length - 1];
    if (lastRound.leaderVerdict === "pushback" && lastRound.unresolved.length > 0) {
      return {
        status: "resume_required",
        rounds,
        allParticipants,
        statusReason: `Review budget exhausted after ${rounds.length} rounds. ${lastRound.unresolved.length} unresolved issues remain.`,
      };
    }
  }

  return {
    status: "pushback",
    rounds,
    allParticipants,
    statusReason: `Review completed ${rounds.length} rounds without achieving freeze.`,
  };
}

async function executeRound(
  request: RoleBuilderRequest,
  markdown: string,
  contract: Record<string, unknown>,
  selfCheckIssues: Array<{ code: string; message: string }>,
  roundIndex: number,
  priorRounds: BoardRoundResult[]
): Promise<BoardRoundResult> {
  const participants: ParticipantRecord[] = [];

  // Execute reviewers
  for (const reviewer of request.board_roster.reviewers) {
    const record = await executeParticipant(
      reviewer, request, markdown, contract, selfCheckIssues,
      roundIndex, "reviewer", priorRounds
    );
    participants.push(record);
  }

  // Execute leader (sees reviewer results)
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
  const sourcePath = `tools/agent-role-builder/${role === "leader" ? "leader-draft" : "review-round"}`;

  const brief = buildBrief(
    participant, request, markdown, contract, selfCheckIssues,
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
      latency_ms,
      success: true,
      board_rounds: round + 1,
      participants: 1,
    });

    return {
      participant_id: participantId,
      provider: participant.provider,
      model: participant.model,
      role,
      verdict: result.response,
      round,
      latency_ms,
      invocation_id: result.provenance.invocation_id,
    };
  } catch (err) {
    const latency_ms = Date.now() - start;
    const errorMsg = err instanceof Error ? err.message : String(err);

    emit({
      provenance: createSystemProvenance(sourcePath),
      category: "tool",
      operation: `role-builder-${role}`,
      latency_ms,
      success: false,
      metadata: { error: errorMsg },
    });

    return {
      participant_id: participantId,
      provider: participant.provider,
      model: participant.model,
      role,
      verdict: `ERROR: ${errorMsg}`,
      round,
      latency_ms,
    };
  }
}

function buildBrief(
  participant: BoardParticipant,
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
    ? `\n\nPrior rounds:\n${priorRounds.map((r) => `Round ${r.round}: Leader verdict: ${r.leaderVerdict}. Unresolved: ${r.unresolved.join(", ") || "none"}`).join("\n")}`
    : "";

  const reviewerContext = currentRoundReviewers
    ? `\n\nReviewer verdicts this round:\n${currentRoundReviewers.map((r) => `${r.participant_id}: ${(r.verdict ?? "").slice(0, 500)}`).join("\n")}`
    : "";

  const selfCheckContext = selfCheckIssues.length > 0
    ? `\n\nSelf-check issues:\n${selfCheckIssues.map((i) => `- [${i.code}] ${i.message}`).join("\n")}`
    : "\n\nSelf-check: passed (no issues)";

  if (role === "reviewer") {
    return `You are a REVIEWER for the agent-role-builder tool (round ${round}).
Your job: independently review the draft role package for ${request.role_name} (slug: ${request.role_slug}).

RESPOND WITH JSON ONLY:
{
  "verdict": "approve" | "changes_required" | "pushback",
  "findings": ["list of specific issues found"],
  "strengths": ["what is good about the draft"],
  "open_questions": ["questions that need answers"]
}

RULES:
- Do NOT invent missing role semantics or authority
- Do NOT expand beyond the defined scope
- Return pushback instead of guessing
- Review the markdown for tag completeness, authority clarity, scope boundaries

Draft role markdown:
${markdown}

Draft role contract (summary):
Intent: ${request.intent}
Primary objective: ${request.primary_objective}
Out of scope: ${request.out_of_scope.join(", ")}
${selfCheckContext}${priorContext}

JSON response:`;
  }

  // Leader prompt
  return `You are the LEADER for the agent-role-builder tool (round ${round}).
Your job: synthesize all reviewer feedback and determine the terminal status for the ${request.role_name} role package.

RESPOND WITH JSON ONLY:
{
  "status": "frozen" | "pushback" | "blocked",
  "rationale": "explanation of decision",
  "disagreements": ["any reviewer disagreements to note"],
  "unresolved": ["issues still open"],
  "improvements_applied": ["changes made based on feedback"]
}

RULES:
- "frozen" = all material issues resolved, safe to promote
- "pushback" = material changes still required
- "blocked" = non-recoverable issue found
- Do NOT freeze if material pushback remains
- Do NOT invent resolution — flag as unresolved

Draft role markdown:
${markdown}
${selfCheckContext}${reviewerContext}${priorContext}

JSON response:`;
}

function parseLeaderResponse(raw: string): {
  status: string;
  rationale: string;
  unresolved: string[];
} {
  try {
    const cleaned = raw.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    return {
      status: parsed.status ?? "pushback",
      rationale: parsed.rationale ?? "No rationale provided",
      unresolved: parsed.unresolved ?? [],
    };
  } catch {
    return {
      status: "pushback",
      rationale: `Failed to parse leader response: ${raw.slice(0, 200)}`,
      unresolved: ["Leader response parsing failed"],
    };
  }
}
