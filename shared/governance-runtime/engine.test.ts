import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createPilotGovernanceContext, resolvePilotTerminalVerdict } from "./engine.js";
import type { GovernanceSnapshot } from "./types.js";

function normalizePath(pathValue: string): string {
  return pathValue.replace(/\\/g, "/");
}

test("createPilotGovernanceContext relativizes absolute in-repo authority paths", async () => {
  const repoRoot = process.cwd();
  const runDir = await mkdtemp(join(tmpdir(), "adf-governance-runtime-test-"));

  try {
    const context = await createPilotGovernanceContext({
      component: "agent-role-builder",
      run_dir: runDir,
      authority: {
        shared_contract: join(repoRoot, "shared", "self-learning-engine", "review-contract.json"),
        component_contract: join(repoRoot, "tools", "agent-role-builder", "review-contract.json"),
        component_rulebook: join(repoRoot, "tools", "agent-role-builder", "rulebook.json"),
        component_review_prompt: join(repoRoot, "tools", "agent-role-builder", "review-prompt.json"),
        authority_docs: [
          join(repoRoot, "docs", "v0", "review-process-architecture.md"),
          join(repoRoot, "docs", "v0", "architecture.md"),
        ],
      },
    });

    const snapshot = JSON.parse(
      await readFile(join(runDir, "governance-snapshot.json"), "utf-8")
    ) as GovernanceSnapshot;

    const sharedContractEntry = snapshot.governed_files.find((entry) => entry.kind === "shared_contract");
    assert.ok(sharedContractEntry);
    assert.equal(sharedContractEntry.repo_path, "shared/self-learning-engine/review-contract.json");
    assert.match(sharedContractEntry.snapshot_path, /\/governance\/shared\/self-learning-engine\/review-contract\.json$/);
    assert.ok(context.authority_doc_paths.every((entry) => entry.includes("/governance/docs/v0/")));
  } finally {
    await rm(runDir, { recursive: true, force: true });
  }
});

test("createPilotGovernanceContext rejects absolute authority paths outside the repo root", async () => {
  const repoRoot = process.cwd();
  const runDir = await mkdtemp(join(tmpdir(), "adf-governance-runtime-test-"));
  const outsideRoot = await mkdtemp(join(tmpdir(), "adf-governance-outside-"));
  const outsideContractPath = join(outsideRoot, "review-contract.json");

  try {
    await writeFile(outsideContractPath, "{\"schema_version\":\"1\"}", "utf-8");

    await assert.rejects(
      createPilotGovernanceContext({
        component: "agent-role-builder",
        run_dir: runDir,
        authority: {
          shared_contract: outsideContractPath,
          component_contract: join(repoRoot, "tools", "agent-role-builder", "review-contract.json"),
          component_rulebook: join(repoRoot, "tools", "agent-role-builder", "rulebook.json"),
          component_review_prompt: join(repoRoot, "tools", "agent-role-builder", "review-prompt.json"),
          authority_docs: [
            join(repoRoot, "docs", "v0", "review-process-architecture.md"),
            join(repoRoot, "docs", "v0", "architecture.md"),
          ],
        },
      }),
      /outside the repo root/i
    );
  } finally {
    await rm(runDir, { recursive: true, force: true });
    await rm(outsideRoot, { recursive: true, force: true });
  }
});

test("createPilotGovernanceContext rejects relative traversal authority paths", async () => {
  const repoRoot = process.cwd();
  const runDir = await mkdtemp(join(tmpdir(), "adf-governance-runtime-test-"));

  try {
    await assert.rejects(
      createPilotGovernanceContext({
        component: "agent-role-builder",
        run_dir: runDir,
        authority: {
          shared_contract: "../outside.json",
          component_contract: join(repoRoot, "tools", "agent-role-builder", "review-contract.json"),
          component_rulebook: join(repoRoot, "tools", "agent-role-builder", "rulebook.json"),
          component_review_prompt: join(repoRoot, "tools", "agent-role-builder", "review-prompt.json"),
          authority_docs: [
            join(repoRoot, "docs", "v0", "review-process-architecture.md"),
            join(repoRoot, "docs", "v0", "architecture.md"),
          ],
        },
      }),
      /cannot escape repo bounds/i
    );
  } finally {
    await rm(runDir, { recursive: true, force: true });
  }
});

test("createPilotGovernanceContext rejects governed rulebooks without a rules array", async () => {
  const repoRoot = process.cwd();
  const inRepoTmpRoot = join(repoRoot, "tools", "agent-role-builder", "tmp");
  await mkdir(inRepoTmpRoot, { recursive: true });
  const invalidRoot = await mkdtemp(join(inRepoTmpRoot, "governance-runtime-invalid-rulebook-"));
  const invalidRulebookPath = join(invalidRoot, "rulebook.json");
  const runDir = await mkdtemp(join(tmpdir(), "adf-governance-runtime-test-"));

  try {
    await writeFile(invalidRulebookPath, JSON.stringify({ schema_version: "1.0" }, null, 2), "utf-8");

    await assert.rejects(
      createPilotGovernanceContext({
        component: "agent-role-builder",
        run_dir: runDir,
        authority: {
          shared_contract: join(repoRoot, "shared", "self-learning-engine", "review-contract.json"),
          component_contract: join(repoRoot, "tools", "agent-role-builder", "review-contract.json"),
          component_rulebook: invalidRulebookPath,
          component_review_prompt: join(repoRoot, "tools", "agent-role-builder", "review-prompt.json"),
          authority_docs: [
            join(repoRoot, "docs", "v0", "review-process-architecture.md"),
            join(repoRoot, "docs", "v0", "architecture.md"),
          ],
        },
      }),
      /top-level rules array/i
    );
  } finally {
    await rm(runDir, { recursive: true, force: true });
    await rm(invalidRoot, { recursive: true, force: true });
  }
});

test("resolvePilotTerminalVerdict normalizes illegal pushback and resume_required when only non-material work remains", () => {
  const pushbackOnlyMinor = resolvePilotTerminalVerdict({
    leaderVerdict: "pushback",
    finalRound: false,
    hasAnyRepairWork: true,
    hasMaterialRepairWork: false,
  });
  assert.equal(pushbackOnlyMinor.effectiveVerdict, "frozen_with_conditions");
  assert.match(pushbackOnlyMinor.overrideReason ?? "", /only non-material repair work remained/i);

  const resumeNoWork = resolvePilotTerminalVerdict({
    leaderVerdict: "resume_required",
    finalRound: true,
    hasAnyRepairWork: false,
    hasMaterialRepairWork: false,
  });
  assert.equal(resumeNoWork.effectiveVerdict, "frozen");
  assert.match(resumeNoWork.overrideReason ?? "", /no repair work remained/i);
});
