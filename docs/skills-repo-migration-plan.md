# Skills Repo Migration Plan

## Objective

Move the governed ADF skill families out of the standalone `~/.codex/skills` git repo and make `C:/ADF/skills` the source of truth.

## Target layout

`C:/ADF/skills/`

- `review-cycle/`
- `implement-plan/`
- `governed-feature-runtime.mjs`
- `manifest.json`
- `manage-skills.mjs`
- `install-skills.ps1`

Rules:

- only two public skill folders live under `skills/`
- setup logic is folded into each root skill folder
- no separate `review-cycle-setup/` or `implement-plan-setup/` source folders remain in the repo-owned layout
- installed copies under Codex, Claude, or Gemini roots are generated output, not authored source

## Migration decisions

- `review-cycle` and `implement-plan` remain the only public skill names
- setup contracts and setup helper scripts live inside each root skill folder
- shared helper runtime used by `implement-plan` moves to `skills/governed-feature-runtime.mjs`
- `implement-plan` adds `post_send_to_review`, keeps `post_send_for_review` as a compatibility alias, and supports review handoff loop flags
- `review-cycle` adds `until_complete` and `max_cycles`, with a default cap of `5` when continuous mode is enabled
- `implement-plan` must not mark a feature completed after `post_send_to_review` until `review-cycle` closes cleanly

## Install / check model

Use `C:/ADF/skills/manage-skills.mjs` as the install and verification entrypoint.

Supported targets:

- `codex`
- `claude`
- `gemini`

Default target roots:

- Codex: `CODEX_HOME/skills` when `CODEX_HOME` is set, otherwise `~/.codex/skills`
- Claude: `CLAUDE_SKILLS_ROOT` when set, otherwise `~/.claude/skills`
- Gemini: `GEMINI_SKILLS_ROOT` when set, otherwise `~/.gemini/skills`

Install:

```powershell
node C:/ADF/skills/manage-skills.mjs install --target codex --project-root C:/ADF
```

Check:

```powershell
node C:/ADF/skills/manage-skills.mjs check --target codex --project-root C:/ADF
```

Install all targets:

```powershell
node C:/ADF/skills/manage-skills.mjs install --target all --project-root C:/ADF
```

## Execution status

Implemented in this migration:

- repo-owned `review-cycle/` source folder
- repo-owned `implement-plan/` source folder
- setup helper code copied into each root skill folder
- repo-owned shared runtime file
- manifest-driven install/check tooling
- Codex install executed from the repo-owned source

Deferred until after testing:

- deleting the old standalone `~/.codex/skills` git repository
