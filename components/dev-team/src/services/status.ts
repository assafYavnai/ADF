import { loadState } from "./state.js";
import { getDepartmentIdentitySummary } from "../teams/registry.js";

/**
 * Status / progress surface for the dev_team department.
 *
 * Returns a truthful snapshot of the department bootstrap state,
 * including settings, team ownership, lane visibility, and identity
 * policy. The invoker can use this to understand whether the department
 * is initialized and ready for later slices.
 */

export interface LaneGateContext {
  gate: string;
  reason: string | null;
  updated_at: string;
}

export interface LaneStatusEntry {
  lane_id: string;
  feature_slug: string;
  status: string;
  gate_context: LaneGateContext | null;
}

export interface DepartmentStatus {
  department: "dev_team";
  governance_owner: "VPRND";
  bootstrap_phase: string;
  is_initialized: boolean;
  settings: {
    repo_root: string | null;
    implementation_lanes_root: string | null;
  };
  teams: Array<{
    role: string;
    name: string;
    status: string;
  }>;
  active_lanes_count: number;
  active_lanes: LaneStatusEntry[];
  identity_policy: {
    department: string;
    governance_owner: string;
    bootstrap_commit_author: string;
    supported_roles: string[];
    team_member_identity_pattern: string;
  };
  initialized_at: string | null;
  last_updated_at: string;
}

export async function getDepartmentStatus(): Promise<DepartmentStatus> {
  const state = await loadState();
  const identity = getDepartmentIdentitySummary();

  return {
    department: "dev_team",
    governance_owner: "VPRND",
    bootstrap_phase: state.bootstrap_phase,
    is_initialized: state.bootstrap_phase !== "uninitialized",
    settings: {
      repo_root: state.settings?.repo_root ?? null,
      implementation_lanes_root: state.settings?.implementation_lanes_root ?? null,
    },
    teams: state.teams.map((t) => ({
      role: t.role,
      name: t.name,
      status: t.status,
    })),
    active_lanes_count: state.active_lanes.length,
    active_lanes: state.active_lanes.map((l) => ({
      lane_id: l.lane_id,
      feature_slug: l.feature_slug,
      status: l.status,
      gate_context: l.gate_context ?? null,
    })),
    identity_policy: {
      department: identity.department,
      governance_owner: identity.governance_owner,
      bootstrap_commit_author: identity.bootstrap_commit_author,
      supported_roles: identity.supported_roles,
      team_member_identity_pattern: identity.team_member_identity_pattern,
    },
    initialized_at: state.initialized_at,
    last_updated_at: state.last_updated_at,
  };
}
