1. Findings

- failure class: installer documentation route drift for Claude and Gemini target roots
  broken route invariant in one sentence: The documented default install route must match the actual default target root resolved by the installer for every supported runtime.
  exact route (A -> B -> C): `C:/ADF/skills/manage-skills.mjs resolveTargetRoot()` -> generated user-scope installs under `~/.claude/skills` and `~/.gemini/skills` -> operator-facing migration/install guidance in `C:/ADF/docs/skills-repo-migration-plan.md`
  exact file/line references: `C:/ADF/skills/manage-skills.mjs:115`, `C:/ADF/skills/manage-skills.mjs:118`, `C:/ADF/skills/manage-skills.mjs:121`, `C:/ADF/skills/manage-skills.mjs:124`, `C:/ADF/docs/skills-repo-migration-plan.md:47`, `C:/ADF/docs/skills-repo-migration-plan.md:48`
  concrete operational impact: A user following the migration plan will inspect or script against project-local Claude/Gemini skill directories that are never populated by the installer, causing false install failures and stale repo-local assumptions.
  sweep scope: All repo-owned docs and wrappers that describe default install roots or install/check commands for Codex, Claude, and Gemini.
  closure proof: Update the migration plan to the actual default roots, then rerun installer status/check for Claude and Gemini and prove there are no remaining repo-owned docs claiming project-local defaults.
  shared-surface expansion risk: none
  negative proof required: Prove no sibling repo-owned guidance still claims `<project_root>/.claude/skills` or `<project_root>/.gemini/skills` as the defaults.
  live/proof isolation risk: none
  claimed-route vs proved-route mismatch risk: present and why: The doc claims project-local install roots while the proved route from live installer status is user-scope home-directory installs.
  status: live defect

2. Conceptual Root Cause

- The migration contract for install-surface ownership was changed in code before the operator-facing default-root contract was updated in docs, so the claimed supported route drifted away from the implemented route.

3. High-Level View Of System Routes That Still Need Work

- route: repo-owned install-source-of-truth guidance for Claude and Gemini
  what must be frozen before implementation: The default-root contract must say user-scope installs are the canonical defaults, with env-var overrides as the only alternate route documented here.
  why endpoint-only fixes will fail: Fixing only `manage-skills.mjs` or only one command example leaves the operator route split between runtime truth and stale migration guidance.
  the minimal layers that must change to close the route: `docs/skills-repo-migration-plan.md`, plus a sibling sweep over repo-owned docs for the same root claims.
  explicit non-goals, so scope does not widen into general refactoring: Do not redesign the installer, add new targets, or refactor the manifest/install machinery.
  what done looks like operationally: The docs and live installer both resolve Claude to `~/.claude/skills` and Gemini to `~/.gemini/skills`, and status/check evidence matches the written guidance.
