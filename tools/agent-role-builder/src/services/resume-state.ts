import { access, readFile } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { z } from "zod";

export const ResumeReviewerStatus = z.enum(["approved", "conditional", "reject", "error", "pending"]);
export type ResumeReviewerStatus = z.infer<typeof ResumeReviewerStatus>;

export const ResumePackageSchema = z.object({
  schema_version: z.literal("1.0"),
  role_slug: z.string(),
  request_job_id: z.string(),
  next_step: z.string(),
  unresolved: z.array(z.string()).default([]),
  latest_markdown_path: z.string(),
  latest_contract_path: z.string(),
  latest_board_summary_path: z.string(),
  latest_decision_log_path: z.string(),
  latest_learning_path: z.string().optional(),
  round_files: z.array(z.string()).default([]),
  reviewer_status: z.record(ResumeReviewerStatus).default({}),
  rounds_completed: z.number().int().nonnegative().optional(),
});

export type ResumePackage = z.infer<typeof ResumePackageSchema>;

export async function loadResumeState(resumePackagePath: string): Promise<{
  resumePackage: ResumePackage;
  markdown: string;
}> {
  const resolvedResumePath = resolveFromRepoRoot(resumePackagePath);
  const rawResume = await readFile(resolvedResumePath, "utf-8");
  const resumePackage = ResumePackageSchema.parse(JSON.parse(rawResume));
  const resolvedMarkdownPath = resolveFromRepoRoot(resumePackage.latest_markdown_path);
  const markdown = await readFile(resolvedMarkdownPath, "utf-8");
  return {
    resumePackage,
    markdown,
  };
}

export function buildNextResumePackage(params: {
  roleSlug: string;
  requestJobId: string;
  unresolved: string[];
  latestMarkdownPath: string;
  latestContractPath: string;
  latestBoardSummaryPath: string;
  latestDecisionLogPath: string;
  latestLearningPath?: string | null;
  roundFiles: string[];
  reviewerStatus: Record<string, ResumeReviewerStatus>;
  roundsCompletedThisRun: number;
  priorResumePackage?: ResumePackage | null;
}): ResumePackage {
  const priorRoundFiles = params.priorResumePackage?.round_files ?? [];
  const mergedRoundFiles = [...new Set([...priorRoundFiles, ...params.roundFiles])];
  return {
    schema_version: "1.0",
    role_slug: params.roleSlug,
    request_job_id: params.requestJobId,
    next_step: "resume_board_review",
    unresolved: params.unresolved,
    latest_markdown_path: params.latestMarkdownPath,
    latest_contract_path: params.latestContractPath,
    latest_board_summary_path: params.latestBoardSummaryPath,
    latest_decision_log_path: params.latestDecisionLogPath,
    ...(params.latestLearningPath ? { latest_learning_path: params.latestLearningPath } : {}),
    round_files: mergedRoundFiles,
    reviewer_status: params.reviewerStatus,
    rounds_completed: (params.priorResumePackage?.rounds_completed ?? 0) + params.roundsCompletedThisRun,
  };
}

export function assertResumePackageMatchesRole(resumePackage: ResumePackage, roleSlug: string): void {
  if (resumePackage.role_slug !== roleSlug) {
    throw new Error(
      `Resume package role_slug mismatch: expected "${roleSlug}", got "${resumePackage.role_slug}"`
    );
  }
}

export async function resolveResumeLearningArtifactPath(resumePackage: ResumePackage): Promise<string | null> {
  if (resumePackage.latest_learning_path) {
    return resolveFromRepoRoot(resumePackage.latest_learning_path);
  }

  const lastRoundFile = resumePackage.round_files[resumePackage.round_files.length - 1];
  if (!lastRoundFile) {
    return null;
  }

  const candidate = join(dirname(resolveFromRepoRoot(lastRoundFile)), "learning.json");
  try {
    await access(candidate);
    return candidate;
  } catch {
    return null;
  }
}

function resolveFromRepoRoot(path: string): string {
  return isAbsolute(path) ? path : resolve(process.cwd(), path);
}
