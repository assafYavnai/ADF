# Feature Context

## Feature

- phase_number: 1
- feature_slug: brain-ops-skill-and-codex-claude-wiring
- project_root: C:/ADF
- feature_root: C:/ADF/.codex/implement-plan/worktrees/phase1/brain-ops-skill-and-codex-claude-wiring/docs/phase1/brain-ops-skill-and-codex-claude-wiring
- worktree_path: C:/ADF/.codex/implement-plan/worktrees/phase1/brain-ops-skill-and-codex-claude-wiring
- current_branch: implement-plan/phase1/brain-ops-skill-and-codex-claude-wiring

## Task Summary

Create a repo-owned Brain operations skill under `skills/`, wire it into ADF CLI bootstrap for Codex and Claude, and refresh generated Codex and Claude skill installs so future ADF work can read, write, verify, and promote Brain entries without rediscovering the route.

## Scope Hint

Repo-owned Brain operations skill plus ADF CLI bootstrap/install wiring for Codex and Claude only.

## Why This Is Needed

- Brain works in ADF, but the path is too easy to rediscover from scratch.
- COO and doctor already prove the supported direct stdio route, yet agents can still get stuck because the bootstrap only partially explains the fallback.
- A repo-owned skill is a better operational fix than another standalone doc because it can be installed, invoked, and verified the same way as the other ADF skills.

## Concrete Existing Truth

- Brain server:
  - `components/memory-engine/src/server.ts`
- direct client route already used by COO:
  - `COO/controller/memory-engine-client.ts`
- verified health/write helpers already in repo:
  - `tools/doctor-brain-connect-smoke.mjs`
  - `tools/doctor-brain-audit.mjs`
- existing generated skill install route:
  - `skills/manage-skills.mjs`
  - `skills/manifest.json`
- existing bootstrap guidance that must become more operational:
  - `AGENTS.md`
  - `docs/bootstrap/cli-agent.md`

## Constraints

- use the supported built Brain client route, not raw DB access
- do not invent a new always-on daemon model
- treat installed Codex and Claude skill copies as generated output
- keep the slice bounded; no general Brain architecture redesign
- do not create yet another standalone guide if a skill plus bootstrap pointer can solve the problem

## Target Outcome

After this slice, a contextless Codex or Claude agent working on ADF should be able to:
- discover the `brain-ops` skill immediately
- verify Brain health quickly
- read Brain context without repo archaeology
- perform a controlled durable write when needed
- promote or manage trust truthfully
- rely on generated installed copies for Codex and Claude
