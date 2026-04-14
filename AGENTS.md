# ADF Agent Bootstrap

## Brain Integration

All agents must load context from Brain at startup and capture durable knowledge during work.
See `docs/bootstrap/cli-agent.md` for the full protocol.

## Runtime Preflight

Before substantive work, every agent must run the ADF runtime preflight and use its output as authority for host OS, workflow shell, command construction style, path style, launcher entrypoint, and bounded repair commands.
At minimum, treat `execution_shell`, `control_plane.kind`, `control_plane.entrypoint`, `shell_contract.*`, and `brain_mcp.*` as authoritative startup truth after routing into the correct bootstrap doc below.

## Reset-First v2 Routing

Before any normal bootstrap routing, every agent touching ADF v2 must read these files first, in order:
1. `adf-v2/README.md`
2. `adf-v2/reset/README.md`
3. `adf-v2/reset/STATE.md`
4. `adf-v2/reset/DECISIONS.md`
5. `adf-v2/reset/WORKORDER.md`
6. `adf-v2/reset/OPEN-ITEMS.md`

Interpretation rules:
- legacy and v1 code or docs are reference-only unless explicitly classified otherwise
- older visible repo surfaces must not be assumed to be active v2 truth by default
- `adf-v2/00-mission-foundation/` is historical source material, not the active reset pack

## Routing

### If you are a CLI agent (Claude Code, Codex CLI, Gemini CLI):

Read [docs/bootstrap/cli-agent.md](docs/bootstrap/cli-agent.md)

### If you are a VS Code integrated agent (Copilot, Claude panel, Gemini panel):

Read [docs/bootstrap/vscode-agent.md](docs/bootstrap/vscode-agent.md)

## Direct Instruction Discipline

- follow user instructions to the letter
- do not jump into execution when the user asked a question or did not explicitly ask for implementation
- do not take shortcuts by jumping to conclusions about user intent
- do not choose the lazy path, the shortest pass, or a weaker substitute when the user asked for something more exact, thorough, or explicit
