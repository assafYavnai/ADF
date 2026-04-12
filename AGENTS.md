# ADF Agent Bootstrap

## Brain Integration
All agents must load context from Brain at startup and capture durable knowledge (decisions, conventions, lessons) during work. See cli-agent.md for the full protocol.

## Runtime Preflight
Before substantive work, every agent must run the ADF runtime preflight and use its output as authority for host OS, workflow shell, command construction style, path style, launcher entrypoint, and bounded repair commands.
At minimum, treat `execution_shell`, `control_plane.kind`, `control_plane.entrypoint`, `shell_contract.*`, and `brain_mcp.*` as authoritative startup truth after routing into the correct bootstrap doc below.

## Routing

### If you are a CLI agent (Claude Code, Codex CLI, Gemini CLI):
Read [docs/bootstrap/cli-agent.md](docs/bootstrap/cli-agent.md)

### If you are a VS Code integrated agent (Copilot, Claude panel, Gemini panel):
Read [docs/bootstrap/vscode-agent.md](docs/bootstrap/vscode-agent.md)

## ADF v2 Context

If the work touches ADF v2, agents must treat `adf-v2/` as the active source of truth and load v2 context before doing substantive work.

When working directly with the user on ADF v2 shaping, definition, readiness, or freeze work, the agent must operate as CTO unless a governing v2 document explicitly says otherwise.

### Required v2 reading order

Read these in order:

1. `adf-v2/LAYER-LIFECYCLE.md`
2. `adf-v2/00-mission-foundation/context/HANDOFF.md`
3. `adf-v2/00-mission-foundation/context/NEXT-STEP-HANDOFF.md`
4. `adf-v2/00-mission-foundation/MISSION-STATEMENT.md`
5. `adf-v2/00-mission-foundation/DELIVERY-COMPLETION-DEFINITION.md`
6. `adf-v2/00-mission-foundation/context/DECISIONS.md`
7. `adf-v2/CEO-AGENT-WORKING-PROTOCOL.md`
8. `adf-v2/CTO-CEO-WORKING-MODE.md`
9. `adf-v2/CTO-ROLE.md`
10. `adf-v2/00-mission-foundation/CTO-CONTEXT-ARCHITECTURE.md`
11. `adf-v2/00-mission-foundation/V1-PAIN-POINT-AND-V2-FORK-RATIONALE.md`

### Current-state rule

For current state, authority starts with:
- `adf-v2/00-mission-foundation/context/HANDOFF.md`
- `adf-v2/00-mission-foundation/context/NEXT-STEP-HANDOFF.md`
- current git status under `adf-v2/`
- Brain readout

Agents must check for local drafts, uncommitted files, and active checkpoint notes before claiming they understand the current state.

For mission-foundation startup:
- `HANDOFF.md` is the canonical layer restart authority
- it should carry the broader work, current task, next step, and later-step/open-item frame together
- `NEXT-STEP-HANDOFF.md` is only a thin checkpoint companion and must stay aligned to `HANDOFF.md`

### v2 boundary rule

For v2 work:
- prefer `adf-v2/` docs over legacy ADF docs
- do not reconstruct v2 intent from old ADF files unless the v2 docs explicitly point there or the user asks
- treat legacy ADF as reference only, not source of truth, for v2

### Document-state rule

Agents must distinguish clearly between:
- frozen decisions in `context/decisions/`
- draft artifacts in `context/artifacts/`
- layer-global support docs in `context/`
- promoted layer outputs in the layer root

Do not treat draft artifacts as frozen canon.

## Direct Instruction Discipline

- Follow user instructions to the letter.
- Do not jump into execution when the user asked a question or did not explicitly ask for implementation.
- Do not take shortcuts by jumping to conclusions about user intent.
- Do not choose the lazy path, the shortest pass, or a weaker substitute when the user asked for something more exact, thorough, or explicit.
