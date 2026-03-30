import { readFile } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
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

function resolveFromRepoRoot(path: string): string {
  return isAbsolute(path) ? path : resolve(process.cwd(), path);
}
