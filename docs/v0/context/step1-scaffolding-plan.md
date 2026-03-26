# ADF v0 Implementation Plan

Status: active
Last updated: 2026-03-26

---

## CEO Comments on Memory Engine Strategy (2026-03-26)

These are direct instructions from the CEO that override defaults in the strategy doc.

1. **Brain data triage** — Most Brain entries are ProjectBrain-specific noise. Scan all entries, keep only generic/reusable ones (decisions, conventions, lessons) applicable to ADF. Discard project-specific data.

2. **Convert Brain + MCP to TypeScript** — All Brain server code and MCP scripts must be ported to TypeScript. No JS/MJS in the new codebase.

3. **Manual memory commands** — The user must be able to directly tell the COO things like "save this decision", "our discussion", "make that a rule", "load context from memory engine". Memory engine capabilities must be accessible through natural language, not just automated.

4. **Single memory folder** — All memory engine components live under one folder (e.g., `components/memory-engine/`). No scattering.

5. **Thin AGENTS.md + bootstrap routing** — AGENTS.md must be very thin. Rules are NOT stored in the md file — they live in the memory engine. AGENTS.md is a router only: detect runtime (CLI vs VS Code) and point to the right bootstrap doc. Create `CLAUDE.md` and `GEMINI.md` as minimal pointers that say "read AGENTS.md if it exists and follow links."

6. **COO/ folder** — All COO functionality (controller, classifier, context engineer, tools) lives under `COO/`, not `controller/`.

---

## What's Done

| Item | Status | Date |
|---|---|---|
| GitHub repo created (assafYavnai/ADF) | done | 2026-03-26 |
| VISION.md + handoff pack committed | done | 2026-03-26 |
| docs/v0/architecture.md | done | 2026-03-26 |
| docs/v0/folder-structure.md | done | 2026-03-26 |
| docs/v0/implementation-phases.md | done | 2026-03-26 |
| docs/v0/memory_stack_strategy.md | done | 2026-03-26 |
| Environment verified (Node, TS, Bash, CLIs) | done | 2026-03-26 |
| MSYS2 temp dir + PATH permissions fixed | done | 2026-03-26 |
| Git identity configured (global) | done | 2026-03-26 |
| Step 1: Scaffold project structure | done | 2026-03-26 |
| Step 2: Initialize COO + memory-engine packages | done | 2026-03-26 |
| Step 3: Thread model (COO/src/thread.ts) | done | 2026-03-26 |
| Step 4: Brain MCP ported to TypeScript | done | 2026-03-26 |
| Step 5: Brain data triage (12 items from 3158) | done | 2026-03-26 |
| Step 6: Context engineer (COO/src/context-engineer.ts) | done | 2026-03-26 |
| Step 7: Controller loop + classifier + tools | done | 2026-03-26 |

## Key Files Created

| File | Purpose |
|---|---|
| `COO/src/thread.ts` | 9 event types, Thread schema, FileSystemThreadStore, serializeForLLM |
| `COO/src/context-engineer.ts` | 3-tier context assembly (thread + files + Brain MCP) |
| `COO/src/classifier.ts` | Intent classification via bounded LLM call |
| `COO/src/tools.ts` | Tool registry (7 tools) with Zod schemas |
| `COO/src/loop.ts` | handleTurn() — the stateless reducer main loop |
| `components/memory-engine/src/server.ts` | MCP server entry point (16 tools) |
| `components/memory-engine/src/services/capture.ts` | Memory capture with dedup |
| `components/memory-engine/src/services/search.ts` | Hybrid semantic + keyword search |
| `components/memory-engine/src/services/context.ts` | Context summary + list recent |
| `components/memory-engine/src/services/scope.ts` | Scope hierarchy resolution |
| `components/memory-engine/src/tools/decision-tools.ts` | Decision logging with alternatives |
| `components/memory-engine/src/tools/governance-tools.ts` | Rules, roles, requirements CRUD |
| `components/memory-engine/src/db/migrations/001-005` | PostgreSQL schema (from ProjectBrain) |
| `decisions/brain-import-candidates.json` | 12 generic items triaged for import |
| `prompts/coo-system.md` | Default COO system prompt |
| `AGENTS.md` | Thin router (CLI vs VS Code) |
| `CLAUDE.md` / `GEMINI.md` | Pointer files → AGENTS.md |

## What's Next

Phase 1 (Foundation) is complete. Next phases:

### Phase 2: Intelligence
- Wire up actual LLM API calls (Anthropic SDK) in the controller
- End-to-end test: user message → classify → respond
- Connect Brain MCP as live service

### Phase 3: Resilience
- Pause/resume (thread serialization)
- Approval gates for high-stakes operations
- Error compaction

### Phase 4: Scale
- Specialist agents
- Cross-session recall
- Multi-channel triggers

---

## Locked Decisions

- Fresh start in ADF repo, ProjectBrain is deprecated reference only
- Node.js + TypeScript for all new code
- Bash is the primary shell, PowerShell only for Windows-specific leaf tasks
- 12-factor thread model is the execution backbone
- Brain MCP (ported to TS) is the durable knowledge store
- Architecture-first, step by step, no scope creep
- "Commit" always means commit + push to origin
