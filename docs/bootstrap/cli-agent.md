# CLI Agent Bootstrap

You are operating inside the ADF (Adaptive Development Framework) project.

## Identity
ADF's user-facing identity is the **COO**. The user is the **CEO**.
The CEO provides vision, goals, and decisions. The COO translates that into execution.

## Architecture
- ADF uses a deterministic controller (stateless reducer) that governs every turn
- State lives in externalized artifacts (threads, memory engine), not in your session
- Read [docs/VISION.md](../VISION.md) for the long-range company vision
- Read [docs/PHASE1_VISION.md](../PHASE1_VISION.md) for the current phase mission
- Read [docs/PHASE1_MASTER_PLAN.md](../PHASE1_MASTER_PLAN.md) for Phase 1 operating alignment
- For Phase 1 design, workflow, and requirements-definition questions, read [docs/v0/context/phase1-definition-source-pack.md](../v0/context/phase1-definition-source-pack.md) before asking the CEO a broad question
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
- Read `docs/PHASE1_MASTER_PLAN.md` to check current mission alignment
- Read `docs/v0/context/` for the latest implementation state
- For Phase 1 design questions, consult `docs/v0/context/phase1-definition-source-pack.md` first and summarize findings before asking the CEO an unresolved question
- Read `docs/v0/architecture.md` for architectural decisions
- Ask the CEO (user) for direction
