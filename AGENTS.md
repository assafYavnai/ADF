# ADF Agent Bootstrap

## Brain Integration
All agents must load context from Brain at startup and capture durable knowledge (decisions, conventions, lessons) during work. See cli-agent.md for the full protocol.

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
