import { z } from "zod";

/**
 * Audit identity model for the dev_team department.
 *
 * Bootstrap-layer commits are owned by VPRND.
 * Later feature-scoped commits use team-member identities derived from the
 * feature slug: <feature-slug>-designer, <feature-slug>-developer, etc.
 */

export const TeamRole = z.enum([
  "designer",
  "developer",
  "reviewer",
  "integrator",
]);
export type TeamRole = z.infer<typeof TeamRole>;

export const DepartmentIdentity = z.object({
  department: z.literal("dev_team"),
  governance_owner: z.literal("VPRND"),
  bootstrap_commit_author: z.literal("VPRND"),
});
export type DepartmentIdentity = z.infer<typeof DepartmentIdentity>;

export const TeamMemberIdentity = z.object({
  feature_slug: z.string().min(1),
  role: TeamRole,
  commit_author: z.string().min(1),
});
export type TeamMemberIdentity = z.infer<typeof TeamMemberIdentity>;

/**
 * Derive the commit author string for a feature-scoped team member.
 * Example: "mcp-boxing-slice-01-developer"
 */
export function deriveTeamMemberAuthor(
  featureSlug: string,
  role: TeamRole
): string {
  return `${featureSlug}-${role}`;
}

export const DEPARTMENT_IDENTITY: DepartmentIdentity = {
  department: "dev_team",
  governance_owner: "VPRND",
  bootstrap_commit_author: "VPRND",
};

export const SUPPORTED_ROLES: readonly TeamRole[] = [
  "designer",
  "developer",
  "reviewer",
  "integrator",
] as const;
