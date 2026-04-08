# Decisions

## Decision 1

Use `brain-ops` as the repo-owned skill name.

Why:
- it is short enough for agent prompts
- it describes the operational scope rather than the storage implementation
- it can remain valid whether the agent uses assistant MCP tools or the repo fallback path

## Decision 2

Treat `skills/brain-ops/` as the only source of truth and treat installed Codex and Claude copies as generated output.

Why:
- ADF already uses `skills/manage-skills.mjs` as the authoritative install route
- direct edits under `~/.codex/skills` or `~/.claude/skills` would create drift immediately

## Decision 3

Use the supported built Brain client route for the repo fallback path.

Why:
- the doctor scripts and COO already prove this route
- it avoids raw DB access and avoids inventing a new integration
- it stays consistent with the supported on-demand stdio MCP model

## Decision 4

Wire the skill through existing bootstrap docs instead of creating another standalone Brain operations guide.

Why:
- the repo already has multiple Brain-related docs
- the failure here is operational discoverability, not total lack of documentation
- a skill plus a short bootstrap pointer is a better long-term fix than another free-floating guide

## Decision 5

Keep generated install proof bounded to Codex and Claude in this slice.

Why:
- that is the user-requested target set
- Gemini can remain unchanged unless the manifest/install contract forces a minimal aligned update
