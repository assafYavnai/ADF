import type { SetupInput, SetupOutput } from "../schemas/setup.js";
import { loadState, saveState } from "./state.js";

/**
 * VPRND-owned setup / initialization route for the dev_team department.
 *
 * Installs department settings (repo_root, implementation_lanes_root),
 * transitions bootstrap phase to settings_installed, and returns a
 * confirmation with the installed state.
 */
export async function setupDepartment(input: SetupInput): Promise<SetupOutput> {
  const state = await loadState();

  state.settings = {
    repo_root: input.repo_root,
    implementation_lanes_root: input.implementation_lanes_root,
  };

  const now = new Date().toISOString();
  if (state.bootstrap_phase === "uninitialized") {
    state.initialized_at = now;
  }
  state.bootstrap_phase = "settings_installed";
  state.last_updated_at = now;

  await saveState(state);

  return {
    success: true,
    department: "dev_team",
    governance_owner: "VPRND",
    bootstrap_phase: state.bootstrap_phase,
    settings_installed: {
      repo_root: input.repo_root,
      implementation_lanes_root: input.implementation_lanes_root,
    },
    teams_registered: state.teams.length,
    message: `dev_team department initialized by VPRND. Settings installed: repo_root=${input.repo_root}, implementation_lanes_root=${input.implementation_lanes_root}. ${state.teams.length} team placeholders registered.`,
  };
}
