import { describe, it, before, after } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";

import { SetupInput } from "./schemas/setup.js";
import { DepartmentState, createInitialState } from "./schemas/state.js";
import { setStateDir, loadState, saveState } from "./services/state.js";
import { setupDepartment } from "./services/setup.js";
import { getDepartmentStatus } from "./services/status.js";
import {
  DEPARTMENT_IDENTITY,
  SUPPORTED_ROLES,
  deriveTeamMemberAuthor,
} from "./schemas/identity.js";
import { getDepartmentIdentitySummary, resolveTeamMemberIdentity } from "./teams/registry.js";
import { SETUP_TOOL_DEFINITIONS } from "./tools/setup-tools.js";
import { STATUS_TOOL_DEFINITIONS } from "./tools/status-tools.js";

let tmpDir: string;

before(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "devteam-test-"));
  setStateDir(tmpDir);
});

after(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe("schemas", () => {
  it("createInitialState returns valid uninitialized state", () => {
    const state = createInitialState();
    DepartmentState.parse(state);
    assert.equal(state.department, "dev_team");
    assert.equal(state.governance_owner, "VPRND");
    assert.equal(state.bootstrap_phase, "uninitialized");
    assert.equal(state.settings, null);
    assert.equal(state.teams.length, 4);
    assert.equal(state.active_lanes.length, 0);
  });

  it("SetupInput validates correctly", () => {
    const valid = SetupInput.parse({
      repo_root: "C:/ADF",
      implementation_lanes_root: "C:/ADF/.codex/implement-plan/worktrees",
    });
    assert.equal(valid.repo_root, "C:/ADF");

    assert.throws(() => SetupInput.parse({ repo_root: "", implementation_lanes_root: "x" }));
    assert.throws(() => SetupInput.parse({ repo_root: "x" }));
  });
});

describe("identity", () => {
  it("DEPARTMENT_IDENTITY is correct", () => {
    assert.equal(DEPARTMENT_IDENTITY.department, "dev_team");
    assert.equal(DEPARTMENT_IDENTITY.governance_owner, "VPRND");
    assert.equal(DEPARTMENT_IDENTITY.bootstrap_commit_author, "VPRND");
  });

  it("SUPPORTED_ROLES has 4 roles", () => {
    assert.equal(SUPPORTED_ROLES.length, 4);
    assert.ok(SUPPORTED_ROLES.includes("designer"));
    assert.ok(SUPPORTED_ROLES.includes("developer"));
    assert.ok(SUPPORTED_ROLES.includes("reviewer"));
    assert.ok(SUPPORTED_ROLES.includes("integrator"));
  });

  it("deriveTeamMemberAuthor produces correct format", () => {
    assert.equal(
      deriveTeamMemberAuthor("mcp-boxing-slice-01", "developer"),
      "mcp-boxing-slice-01-developer"
    );
  });

  it("resolveTeamMemberIdentity returns full identity", () => {
    const id = resolveTeamMemberIdentity("my-feature", "reviewer");
    assert.equal(id.feature_slug, "my-feature");
    assert.equal(id.role, "reviewer");
    assert.equal(id.commit_author, "my-feature-reviewer");
  });

  it("getDepartmentIdentitySummary includes pattern and examples", () => {
    const summary = getDepartmentIdentitySummary();
    assert.equal(summary.department, "dev_team");
    assert.equal(summary.team_member_identity_pattern, "<feature-slug>-<role>");
    assert.ok(summary.example_identities.length > 0);
  });
});

describe("state persistence", () => {
  it("loadState returns initial state when no file exists", async () => {
    const freshDir = await fs.mkdtemp(path.join(os.tmpdir(), "devteam-fresh-"));
    setStateDir(freshDir);
    const state = await loadState();
    assert.equal(state.bootstrap_phase, "uninitialized");
    await fs.rm(freshDir, { recursive: true, force: true });
    setStateDir(tmpDir);
  });

  it("saveState + loadState round-trips correctly", async () => {
    const state = createInitialState();
    state.settings = {
      repo_root: "C:/test",
      implementation_lanes_root: "C:/test/lanes",
    };
    state.bootstrap_phase = "settings_installed";
    await saveState(state);
    const loaded = await loadState();
    assert.equal(loaded.bootstrap_phase, "settings_installed");
    assert.equal(loaded.settings?.repo_root, "C:/test");
    assert.equal(loaded.settings?.implementation_lanes_root, "C:/test/lanes");
  });
});

describe("setup route", () => {
  it("setupDepartment installs settings and transitions phase", async () => {
    // Reset to fresh state
    const freshDir = await fs.mkdtemp(path.join(os.tmpdir(), "devteam-setup-"));
    setStateDir(freshDir);

    const result = await setupDepartment({
      repo_root: "C:/ADF",
      implementation_lanes_root: "C:/ADF/.codex/implement-plan/worktrees",
    });

    assert.equal(result.success, true);
    assert.equal(result.department, "dev_team");
    assert.equal(result.governance_owner, "VPRND");
    assert.equal(result.bootstrap_phase, "settings_installed");
    assert.equal(result.settings_installed.repo_root, "C:/ADF");
    assert.equal(result.teams_registered, 4);

    // Verify state persisted
    const state = await loadState();
    assert.equal(state.bootstrap_phase, "settings_installed");
    assert.notEqual(state.initialized_at, null);

    await fs.rm(freshDir, { recursive: true, force: true });
    setStateDir(tmpDir);
  });
});

describe("status surface", () => {
  it("getDepartmentStatus returns truthful state after setup", async () => {
    const freshDir = await fs.mkdtemp(path.join(os.tmpdir(), "devteam-status-"));
    setStateDir(freshDir);

    // Before setup
    const beforeStatus = await getDepartmentStatus();
    assert.equal(beforeStatus.is_initialized, false);
    assert.equal(beforeStatus.bootstrap_phase, "uninitialized");
    assert.equal(beforeStatus.settings.repo_root, null);
    assert.equal(beforeStatus.teams.length, 4);

    // After setup
    await setupDepartment({
      repo_root: "C:/MyRepo",
      implementation_lanes_root: "C:/MyRepo/lanes",
    });

    const afterStatus = await getDepartmentStatus();
    assert.equal(afterStatus.is_initialized, true);
    assert.equal(afterStatus.bootstrap_phase, "settings_installed");
    assert.equal(afterStatus.settings.repo_root, "C:/MyRepo");
    assert.equal(afterStatus.settings.implementation_lanes_root, "C:/MyRepo/lanes");
    assert.equal(afterStatus.active_lanes_count, 0);

    // Identity policy
    assert.equal(afterStatus.identity_policy.department, "dev_team");
    assert.equal(afterStatus.identity_policy.governance_owner, "VPRND");
    assert.equal(afterStatus.identity_policy.bootstrap_commit_author, "VPRND");
    assert.equal(afterStatus.identity_policy.team_member_identity_pattern, "<feature-slug>-<role>");

    await fs.rm(freshDir, { recursive: true, force: true });
    setStateDir(tmpDir);
  });
});

describe("tool definitions", () => {
  it("SETUP_TOOL_DEFINITIONS has devteam_setup", () => {
    assert.equal(SETUP_TOOL_DEFINITIONS.length, 1);
    assert.equal(SETUP_TOOL_DEFINITIONS[0].name, "devteam_setup");
    assert.ok(SETUP_TOOL_DEFINITIONS[0].inputSchema.required.includes("repo_root"));
    assert.ok(SETUP_TOOL_DEFINITIONS[0].inputSchema.required.includes("implementation_lanes_root"));
  });

  it("STATUS_TOOL_DEFINITIONS has devteam_status", () => {
    assert.equal(STATUS_TOOL_DEFINITIONS.length, 1);
    assert.equal(STATUS_TOOL_DEFINITIONS[0].name, "devteam_status");
  });
});

describe("isolation", () => {
  it("no imports from skills, COO, tools, or memory-engine", async () => {
    // This is a structural assertion: the source files in this component
    // should not import from outside the component boundary.
    const srcDir = path.resolve(new URL(".", import.meta.url).pathname.replace(/^\//, ""));
    const files = await collectTsFiles(srcDir);

    const forbidden = ["/skills/", "/COO/", "/tools/agent-", "/memory-engine/"];
    for (const file of files) {
      const content = await fs.readFile(file, "utf-8");
      for (const pattern of forbidden) {
        assert.ok(
          !content.includes(pattern),
          `File ${file} contains forbidden import pattern: ${pattern}`
        );
      }
    }
  });
});

async function collectTsFiles(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectTsFiles(full)));
    } else if (entry.name.endsWith(".ts")) {
      files.push(full);
    }
  }
  return files;
}
