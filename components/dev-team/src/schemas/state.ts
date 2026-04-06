import { z } from "zod";
import { TeamRole } from "./identity.js";

/**
 * Department-owned state model.
 *
 * Persisted as a single JSON file on disk. Represents the durable truth
 * for the dev_team department: settings, identity, team ownership,
 * lane visibility, and bootstrap lifecycle.
 */

export const BootstrapPhase = z.enum([
  "uninitialized",
  "settings_installed",
  "ready",
]);
export type BootstrapPhase = z.infer<typeof BootstrapPhase>;

export const DepartmentSettings = z.object({
  repo_root: z.string().min(1),
  implementation_lanes_root: z.string().min(1),
});
export type DepartmentSettings = z.infer<typeof DepartmentSettings>;

export const TeamPlaceholder = z.object({
  role: TeamRole,
  name: z.string().min(1),
  status: z.enum(["placeholder", "active"]),
});
export type TeamPlaceholder = z.infer<typeof TeamPlaceholder>;

export const LaneEntry = z.object({
  lane_id: z.string().min(1),
  feature_slug: z.string().min(1),
  status: z.enum(["active", "blocked", "completed", "closed"]),
  created_at: z.string(),
});
export type LaneEntry = z.infer<typeof LaneEntry>;

export const DepartmentState = z.object({
  department: z.literal("dev_team"),
  governance_owner: z.literal("VPRND"),
  bootstrap_phase: BootstrapPhase,
  settings: DepartmentSettings.nullable(),
  teams: z.array(TeamPlaceholder),
  active_lanes: z.array(LaneEntry),
  initialized_at: z.string().nullable(),
  last_updated_at: z.string(),
});
export type DepartmentState = z.infer<typeof DepartmentState>;

/**
 * Factory for a fresh uninitialized department state.
 */
export function createInitialState(): DepartmentState {
  const now = new Date().toISOString();
  return {
    department: "dev_team",
    governance_owner: "VPRND",
    bootstrap_phase: "uninitialized",
    settings: null,
    teams: [
      { role: "designer", name: "design team", status: "placeholder" },
      { role: "developer", name: "development team", status: "placeholder" },
      { role: "reviewer", name: "review team", status: "placeholder" },
      { role: "integrator", name: "integration team", status: "placeholder" },
    ],
    active_lanes: [],
    initialized_at: null,
    last_updated_at: now,
  };
}
