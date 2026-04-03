1. Closure Verdicts

- installer documentation route drift for Claude and Gemini target roots: Open
  enforced route invariant: None yet. The implementation still presents two different default-root contracts for the same install route.
  evidence shown: `C:/ADF/skills/manage-skills.mjs:115-124` resolves Claude and Gemini to `homedir()` user-scope roots; `node C:/ADF/skills/manage-skills.mjs status --target claude,gemini --project-root C:/ADF` reports `C:/Users/sufin/.claude/skills` and `C:/Users/sufin/.gemini/skills`.
  missing proof: The operator-facing migration plan still needs to be updated and then rechecked against the live installer route.
  sibling sites still uncovered: Repo-owned migration/install docs have been swept and only `C:/ADF/docs/skills-repo-migration-plan.md:47-48` still carries the stale project-local claim.
  whether broader shared power was introduced and whether that was justified: No broader shared power was introduced by this defect.
  whether negative proof exists where required: Partial. The sibling grep sweep found no additional repo-owned docs with the stale roots, but the migration plan itself still fails the route contract.
  whether live-route vs proof-route isolation is shown: Yes. The proof is the live installer status/check route, not a test seam or alternate harness path.
  claimed supported route / route mutated / route proved: Claimed route = `<project_root>/.claude/skills` and `<project_root>/.gemini/skills` in the migration plan; route mutated = `manage-skills.mjs` now resolves `~/.claude/skills` and `~/.gemini/skills`; route proved = live installer install/status/check at the user-scope roots.
  whether the patch is route-complete or endpoint-only: Endpoint-only. Code was updated but the repo-owned operator guidance was not brought forward.

2. Remaining Root Cause

- The migration slice did not enforce claimed-route vs proved-route closure for installer documentation, so the source-of-truth repo still tells operators to use the old path after the runtime route changed.

3. Next Minimal Fix Pass

- what still breaks: The repo migration plan misstates the default Claude and Gemini install roots.
  what minimal additional layers must change: Update `C:/ADF/docs/skills-repo-migration-plan.md` to the user-scope defaults and keep the env-var override wording intact.
  what proof is still required: Re-run the Claude and Gemini status/check commands after the doc update and re-sweep repo-owned docs to show no stale project-local default-root claims remain.
