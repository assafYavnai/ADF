import { invoke, createSystemProvenance, emit } from "../shared-imports.js";
import type { RoleBuilderRequest, BoardParticipant } from "../schemas/request.js";
import type { ParticipantRecord, RoleBuilderStatus } from "../schemas/result.js";
import { selfCheck } from "./validator.js";
import { reviseRoleMarkdown } from "./role-generator.js";

export interface BoardRoundResult {
  round: number;
  participants: ParticipantRecord[];
  leaderVerdict: string;
  leaderRationale: string;
  unresolved: string[];
  improvementsApplied: string[];
  markdown: string;
  selfCheckIssues: Array<{ code: string; message: string }>;
}

/**
 * Execute the full board review process.
 * Returns all round results, the final terminal decision, and the last draft state.
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
  finalMarkdown: string;
  finalSelfCheckIssues: Array<{ code: string; message: string }>;
}> {
  const maxRounds = request.governance.max_review_rounds;
  const rounds: BoardRoundResult[] = [];
  const allParticipants: ParticipantRecord[] = [];
  let currentMarkdown = draftMarkdown;
  let currentSelfCheckIssues = selfCheckIssues;

  for (let round = 0; round < maxRounds; round++) {
    const roundResult = await executeRound(
      request,
      currentMarkdown,
      draftContract,
      currentSelfCheckIssues,
      round,
      rounds
    );
    rounds.push(roundResult);
    allParticipants.push(...roundResult.participants);

    if (roundResult.leaderVerdict === "frozen") {
      return {
        status: "frozen",
        rounds,
        allParticipants,
        statusReason: "All reviewers approved, leader confirmed freeze.",
        finalMarkdown: roundResult.markdown,
        finalSelfCheckIssues: roundResult.selfCheckIssues,
      };
    }

    if (roundResult.leaderVerdict === "blocked") {
      return {
        status: "blocked",
        rounds,
        allParticipants,
        statusReason: roundResult.leaderRationale,
        finalMarkdown: roundResult.markdown,
        finalSelfCheckIssues: roundResult.selfCheckIssues,
      };
    }

    if (round < maxRounds - 1 && roundResult.unresolved.length > 0) {
      try {
        currentMarkdown = await reviseRoleMarkdown(
          request,
          roundResult.markdown,
          draftContract,
          {
            round: roundResult.round,
            leaderRationale: roundResult.leaderRationale,
            unresolved: roundResult.unresolved,
            participants: roundResult.participants.map((participant) => ({
              participant_id: participant.participant_id,
              verdict: participant.verdict,
            })),
          },
          rounds.map((priorRound) => ({
            round: priorRound.round,
            leaderRationale: priorRound.leaderRationale,
            unresolved: priorRound.unresolved,
          }))
        );
        currentSelfCheckIssues = selfCheck(currentMarkdown, request).map((issue) => ({
          code: issue.code,
          message: issue.message,
        }));
      } catch {
        currentMarkdown = roundResult.markdown;
        currentSelfCheckIssues = roundResult.selfCheckIssues;
      }
    }
  }

  const lastRound = rounds[rounds.length - 1];

  if (
    request.governance.allow_single_arbitration_round &&
    lastRound &&
    lastRound.leaderVerdict === "pushback" &&
    lastRound.unresolved.length > 0
  ) {
    return {
      status: "resume_required",
      rounds,
      allParticipants,
      statusReason: `Review budget exhausted after ${rounds.length} rounds. ${lastRound.unresolved.length} unresolved issues remain.`,
      finalMarkdown: lastRound.markdown,
      finalSelfCheckIssues: lastRound.selfCheckIssues,
    };
  }

  return {
    status: "pushback",
    rounds,
    allParticipants,
    statusReason: `Review completed ${rounds.length} rounds without achieving freeze.`,
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
  priorRounds: BoardRoundResult[]
): Promise<BoardRoundResult> {
  const participants: ParticipantRecord[] = [];

  for (const reviewer of request.board_roster.reviewers) {
    const record = await executeParticipant(
      reviewer,
      request,
      markdown,
      contract,
      selfCheckIssues,
      roundIndex,
      "reviewer",
      priorRounds
    );
    participants.push(record);
  }

  const leaderRecord = await executeParticipant(
    request.board_roster.leader,
    request,
    markdown,
    contract,
    selfCheckIssues,
    roundIndex,
    "leader",
    priorRounds,
    participants
  );
  participants.push(leaderRecord);

  const leaderResponse = parseLeaderResponse(leaderRecord.verdict ?? "pushback");

  return {
    round: roundIndex,
    participants,
    leaderVerdict: leaderResponse.status,
    leaderRationale: leaderResponse.rationale,
    unresolved: leaderResponse.unresolved,
    improvementsApplied: leaderResponse.improvementsApplied,
    markdown,
    selfCheckIssues,
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
    request,
    markdown,
    contract,
    selfCheckIssues,
    round,
    role,
    priorRounds,
    currentRoundReviewers
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
  request: RoleBuilderRequest,
  markdown: string,
  contract: Record<string, unknown>,
  selfCheckIssues: Array<{ code: string; message: string }>,
  round: number,
  role: "leader" | "reviewer",
  priorRounds: BoardRoundResult[],
  currentRoundReviewers?: ParticipantRecord[]
): string {
  const priorContext =
    priorRounds.length > 0
      ? `\n\nPrior rounds:\n${priorRounds
          .map((result) => `Round ${result.round}: Leader verdict ${result.leaderVerdict}. Unresolved: ${result.unresolved.join(", ") || "none"}`)
          .join("\n")}`
      : "";

  const reviewerContext = currentRoundReviewers
    ? `\n\nReviewer verdicts this round (full text, not truncated):\n${currentRoundReviewers
        .map((result) => `${result.participant_id}:\n${result.verdict ?? "(no verdict)"}`)
        .join("\n\n")}`
    : "";

  const selfCheckContext =
    selfCheckIssues.length > 0
      ? `\n\nSelf-check issues:\n${selfCheckIssues.map((issue) => `- [${issue.code}] ${issue.message}`).join("\n")}`
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
${JSON.stringify(
      {
        intent: request.intent,
        primary_objective: request.primary_objective,
        out_of_scope: request.out_of_scope,
        governance: request.governance,
        runtime: request.runtime,
        package_files: contract["package_files"],
      },
      null,
      2
    )}
${selfCheckContext}${priorContext}

JSON response:`;
  }

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
- Do NOT invent resolution; flag missing answers as unresolved
- Any mixed reviewer verdict keeps the round non-frozen until the conflict is resolved

Draft role markdown:
${markdown}
${selfCheckContext}${reviewerContext}${priorContext}

JSON response:`;
}

function parseLeaderResponse(raw: string): {
  status: string;
  rationale: string;
  unresolved: string[];
  improvementsApplied: string[];
} {
  try {
    const cleaned = raw.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    return {
      status: parsed.status ?? "pushback",
      rationale: parsed.rationale ?? "No rationale provided",
      unresolved: Array.isArray(parsed.unresolved) ? parsed.unresolved : [],
      improvementsApplied: Array.isArray(parsed.improvements_applied)
        ? parsed.improvements_applied
        : [],
    };
  } catch {
    return {
      status: "pushback",
      rationale: `Failed to parse leader response: ${raw.slice(0, 200)}`,
      unresolved: ["Leader response parsing failed"],
      improvementsApplied: [],
    };
  }
}
