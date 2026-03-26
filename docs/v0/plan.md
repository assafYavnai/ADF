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

## What's Next

### Step 1: Scaffold project structure
- Create `COO/` with `src/`, `package.json`, `tsconfig.json`
- Create `components/memory-engine/` with `src/` subdirs
- Create `threads/`, `memory/`, `prompts/`, `decisions/`
- Create `AGENTS.md` (thin router)
- Create `CLAUDE.md`, `GEMINI.md` (pointer files)
- Create `docs/bootstrap/cli-agent.md`, `docs/bootstrap/vscode-agent.md`

### Step 2: Initialize COO package
- `package.json` with dependencies (Zod, Anthropic SDK, etc.)
- `tsconfig.json` for strict TypeScript
- Install dependencies

### Step 3: Build Thread model
- `COO/src/thread.ts` — Zod schemas for Thread, Event, all event types
- `FileSystemThreadStore` — create/get/update persisting to `threads/`
- `serializeForLLM()` method

### Step 4: Port Brain MCP to TypeScript
- Port server code from JS/MJS → TypeScript
- Port database queries, MCP tool definitions
- Set up under `components/memory-engine/`

### Step 5: Brain data triage
- Export all existing Brain entries
- Classify: generic vs ProjectBrain-specific
- Import only generic entries into ADF Brain instance
- Regenerate embeddings

### Step 6: Context engineer
- `COO/src/context-engineer.ts`
- Integrate Tier 1 (thread) + Tier 2 (files) + Tier 3 (Brain MCP)
- Pre-fetch relevant knowledge before each LLM call

### Step 7: Manual memory commands
- Register memory engine tools in tool schema registry
- Classifier recognizes memory-related intents
- COO routes to appropriate memory engine operations

---

## Locked Decisions

- Fresh start in ADF repo, ProjectBrain is deprecated reference only
- Node.js + TypeScript for all new code
- Bash is the primary shell, PowerShell only for Windows-specific leaf tasks
- 12-factor thread model is the execution backbone
- Brain MCP (ported to TS) is the durable knowledge store
- Architecture-first, step by step, no scope creep
- "Commit" always means commit + push to origin
