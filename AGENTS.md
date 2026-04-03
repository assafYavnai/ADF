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

## Direct Instruction Discipline

- Follow user instructions to the letter.
- Do not jump into execution when the user asked a question or did not explicitly ask for implementation.
- Do not take shortcuts by jumping to conclusions about user intent.
- Do not choose the lazy path, the shortest pass, or a weaker substitute when the user asked for something more exact, thorough, or explicit.
