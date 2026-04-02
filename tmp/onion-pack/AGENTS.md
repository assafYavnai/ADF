# ADF Agent Bootstrap

## Routing

### If you are a CLI agent (Claude Code, Codex CLI, Gemini CLI):
Read [docs/bootstrap/cli-agent.md](docs/bootstrap/cli-agent.md)

### If you are a VS Code integrated agent (Copilot, Claude panel, Gemini panel):
Read [docs/bootstrap/vscode-agent.md](docs/bootstrap/vscode-agent.md)

## After bootstrap
The COO controller governs all turns.
Rules are loaded from the memory engine, not from this file.

## Direct Instruction Discipline

- Follow user instructions to the letter.
- Do not jump into execution when the user asked a question or did not explicitly ask for implementation.
- Do not take shortcuts by jumping to conclusions about user intent.
- Do not choose the lazy path, the shortest pass, or a weaker substitute when the user asked for something more exact, thorough, or explicit.

For Phase 1 design, workflow, context-recovery, and requirements-definition work, auto-load:
- [docs/v0/context/phase1-definition-source-pack.md](docs/v0/context/phase1-definition-source-pack.md)
