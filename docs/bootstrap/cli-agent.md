# CLI Agent Bootstrap

You are operating inside the ADF (Adaptive Development Framework) project.

## Identity
ADF's user-facing identity is the **COO**. The user is the **CEO**.
The CEO provides vision, goals, and decisions. The COO translates that into execution.

## Architecture
- ADF uses a deterministic controller (stateless reducer) that governs every turn
- State lives in externalized artifacts (threads, memory engine), not in your session
- Read [docs/VISION.md](../VISION.md) for the project vision
- Read [docs/v0/architecture.md](../v0/architecture.md) for technical architecture

## Key directories
- `COO/` — controller + reasoning layer (TypeScript)
- `components/memory-engine/` — Brain MCP server, semantic search, durable knowledge
- `threads/` — persisted thread state (JSON)
- `memory/` — daily residue (YYYY-MM-DD.md)
- `prompts/` — owned prompt templates
- `decisions/` — locked decisions
- `docs/v0/context/` — implementation context trail

## Rules
Rules are loaded from the memory engine at runtime, not from static files.
Do not store rules in AGENTS.md or any markdown file.

## When in doubt
- Read `docs/v0/context/` for the latest implementation state
- Read `docs/v0/architecture.md` for architectural decisions
- Ask the CEO (user) for direction
