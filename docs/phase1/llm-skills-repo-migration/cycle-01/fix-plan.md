1. Failure Classes

- Installer documentation route drift for Claude and Gemini default target roots.

2. Route Contracts

- Claimed supported route: `C:/ADF/skills/manage-skills.mjs` installs Codex, Claude, and Gemini skills into generated user-scope runtime roots unless an explicit env-var override or install-root override is provided.
- End-to-end invariant: The repo-owned migration/install guidance must name the same default target roots that the live installer resolves and validates.
- Allowed mutation surfaces: `C:/ADF/docs/skills-repo-migration-plan.md` only.
- Forbidden shared-surface expansion: Do not change installer code, manifest shape, supported targets, env-var names, or install-root override behavior.
- Docs that must be updated: `C:/ADF/docs/skills-repo-migration-plan.md`.

3. Sweep Scope

- Sibling repo-owned install guidance under `C:/ADF/docs` and `C:/ADF/skills`.
- Generated install surfaces under `C:/Users/sufin/.claude/skills` and `C:/Users/sufin/.gemini/skills` for proof only.
- Exclude unrelated repo churn and non-skill product routes.

4. Planned Changes

- Update the migration plan so the Claude default root is `~/.claude/skills`.
- Update the migration plan so the Gemini default root is `~/.gemini/skills`.
- New power introduced on a shared surface: None.

5. Closure Proof

- Proved route: repo-owned migration guidance -> `manage-skills.mjs` default target resolution -> generated installed Claude/Gemini skill trees.
- Negative proof required: Re-sweep repo-owned docs to prove there are no remaining claims that the default roots are `<project_root>/.claude/skills` or `<project_root>/.gemini/skills`.
- Live/proof isolation checks: Use live installer `status`/`check` output, not a mock or alternate harness path.
- Targeted regression checks:
  - `node C:/ADF/skills/manage-skills.mjs check --target claude --project-root C:/ADF`
  - `node C:/ADF/skills/manage-skills.mjs check --target gemini --project-root C:/ADF`
  - `node C:/ADF/skills/manage-skills.mjs status --target claude,gemini --project-root C:/ADF`
  - `rg` sweep for stale root claims in repo-owned docs

6. Non-Goals

- Do not add project-local install mode flags or change default install behavior.
- Do not refactor the installer or manifest.
- Do not widen this pass into unrelated skill-family cleanup.
