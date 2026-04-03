# Review Context

## Review Target

Review the repo-owned `C:/ADF/skills` migration and installer route for:

- `review-cycle`
- `implement-plan`
- `manage-skills.mjs`
- `install-skills.ps1`
- `docs/skills-repo-migration-plan.md`

## Claimed Route

Repo-owned skill source under `C:/ADF/skills` is installed into generated runtime surfaces for:

- Codex
- Claude
- Gemini

The install/check route is:

`C:/ADF/skills/manage-skills.mjs` -> target root resolution -> generated installed skill trees -> downstream runtime discovery.

## Scope Notes

- Review only the skill migration slice and its install surfaces.
- Exclude unrelated repo churn outside `C:/ADF/skills`, `docs/skills-repo-migration-plan.md`, and generated installs under `~/.codex/skills`, `~/.claude/skills`, and `~/.gemini/skills`.
- Existing `.codex/skills` deletions in the repo are part of the migration context but are not the primary route under review here.

## Evidence Collected

- `node C:/ADF/skills/manage-skills.mjs install --target claude --project-root C:/ADF`
- `node C:/ADF/skills/manage-skills.mjs install --target gemini --project-root C:/ADF`
- `node C:/ADF/skills/manage-skills.mjs check --target claude --project-root C:/ADF`
- `node C:/ADF/skills/manage-skills.mjs check --target gemini --project-root C:/ADF`
- `node C:/ADF/skills/manage-skills.mjs status --target claude,gemini --project-root C:/ADF`
- repo-owned installer default roots at `C:/ADF/skills/manage-skills.mjs`
- migration plan default-root claims at `C:/ADF/docs/skills-repo-migration-plan.md`

## Initial Observation

The live installer route resolves Claude and Gemini to user-scope directories under the home directory, while the migration plan still documents project-local roots for those two targets.
