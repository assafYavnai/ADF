import {
  DEPARTMENT_IDENTITY,
  SUPPORTED_ROLES,
  deriveTeamMemberAuthor,
  type TeamRole,
  type TeamMemberIdentity,
} from "../schemas/identity.js";
import type { TeamPlaceholder } from "../schemas/state.js";

/**
 * Team registry for the dev_team department.
 *
 * Provides the canonical list of internal teams and utility functions
 * for resolving team-member audit identities.
 */

export const DEFAULT_TEAMS: readonly TeamPlaceholder[] = [
  { role: "designer", name: "design team", status: "placeholder" },
  { role: "developer", name: "development team", status: "placeholder" },
  { role: "reviewer", name: "review team", status: "placeholder" },
  { role: "integrator", name: "integration team", status: "placeholder" },
] as const;

/**
 * Resolve the team-member identity for a given feature slug and role.
 */
export function resolveTeamMemberIdentity(
  featureSlug: string,
  role: TeamRole
): TeamMemberIdentity {
  return {
    feature_slug: featureSlug,
    role,
    commit_author: deriveTeamMemberAuthor(featureSlug, role),
  };
}

/**
 * Resolve all team-member identities for a feature slug.
 */
export function resolveAllTeamIdentities(
  featureSlug: string
): TeamMemberIdentity[] {
  return SUPPORTED_ROLES.map((role) =>
    resolveTeamMemberIdentity(featureSlug, role)
  );
}

/**
 * Get the department-level identity summary.
 */
export function getDepartmentIdentitySummary() {
  return {
    ...DEPARTMENT_IDENTITY,
    supported_roles: [...SUPPORTED_ROLES],
    team_member_identity_pattern: "<feature-slug>-<role>",
    example_identities: [
      "mcp-boxing-slice-01-designer",
      "mcp-boxing-slice-01-developer",
      "mcp-boxing-slice-01-reviewer",
      "mcp-boxing-slice-01-integrator",
    ],
  };
}
