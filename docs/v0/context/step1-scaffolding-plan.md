# ADF v0 Implementation Plan — Phase 1 Foundation

Status: **done**
Last updated: 2026-03-27
Completed: 2026-03-27

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

## Implementation Results

### COO Controller (COO/src/)
- **thread.ts** — 9 Zod-typed event types (`user_input`, `classifier_result`, `tool_call`, `tool_result`, `coo_response`, `error`, `human_request`, `state_commit`, `memory_operation`). Thread schema with status tracking. `FileSystemThreadStore` persists to `threads/` as dual-format (JSON + serialized text). `serializeForLLM()` produces XML-tagged event stream. State queries: `lastEvent`, `isAwaitingHuman`, `isAwaitingApproval`, `consecutiveErrors`.
- **context-engineer.ts** — `assembleContext()` pulls from 3 tiers per turn: Tier 1 (thread serialization), Tier 2 (daily residue + system prompt from files), Tier 3 (Brain MCP search via injected callback). `buildPrompt()` combines into XML-tagged sections. Falls back to default COO prompt if `prompts/coo-system.md` missing.
- **classifier.ts** — Bounded LLM call for intent classification. Outputs Zod-validated JSON: `intent`, `workflow` (6 types), `tool`, `confidence`, `reasoning`. Handles markdown code block wrapping in responses.
- **tools.ts** — 7 tool types as Zod discriminated union: `memory_capture`, `memory_search`, `decision_log`, `rule_create`, `context_load`, `direct_response`, `clarification`. Each has example phrases for classification.
- **loop.ts** — `handleTurn()` is the stateless reducer. Flow: load thread → append user input → classify intent → route to workflow handler → append response → commit to store. Memory operation handlers for capture/search/decision/rule/context. Error escalation after 3 consecutive failures.

### Memory Engine (components/memory-engine/src/)
- **server.ts** — MCP server (stdio transport) with 16 registered tools. Health check on startup, graceful shutdown on SIGINT/SIGTERM.
- **schemas/** — 5 Zod schema files: `memory-item.ts` (ContentType, TrustLevel, ContextPriority, CompressionPolicy, ScopeLevel, CaptureInput, SearchInput, ManageInput), `decision.ts` (DecisionAlternative, LogDecisionInput), `discussion.ts` (append/list/get/close inputs), `plan.ts` (create/get/list/revision/finalize/diff/CR inputs), `governance.ts` (7 family types, CRUD actions).
- **services/capture.ts** — Memory capture with exact + semantic deduplication (cosine >= 0.985). Content normalization, text extraction, auto-embedding via Ollama. Transaction-safe writes.
- **services/search.ts** — Hybrid semantic + keyword search. Configurable weighting (default 0.7 semantic). Scope filtering, content type filtering. Falls back to keyword-only if embedding fails.
- **services/context.ts** — Priority-sorted context summaries (p0→p3). Paginated `listRecent` with total counts.
- **services/scope.ts** — Hierarchical scope resolution (org/project/initiative/phase/thread). SQL filter builder for scope-based queries.
- **services/context-policy.ts** — Auto-resolves context priority and compression policy from content type + tags.
- **tools/** — 3 tool modules: memory (5 tools), decisions (1 tool with enrichment), governance (6 tools for rules/roles/requirements/settings/findings/open_loops).
- **db/connection.ts** — PostgreSQL pool (max 10, idle 30s) with transaction helper.
- **db/migrations/001-005** — Full schema: organizations → projects → initiatives → phases → threads hierarchy, memory_items with JSONB content, memory_embeddings with pgvector (768-d HNSW), decisions, context_priority, workflow metadata, authority workflow tables (plan, plan_revision, change_request, discussion, discussion_entry).

### Infrastructure
- **AGENTS.md** — Thin router: CLI agents → `docs/bootstrap/cli-agent.md`, VS Code agents → `docs/bootstrap/vscode-agent.md`. Rules live in memory engine, not here.
- **CLAUDE.md / GEMINI.md** — One-liner pointer files: "Read AGENTS.md if it exists and follow links."
- **docs/bootstrap/cli-agent.md** — CLI agent bootstrap: identity (COO/CEO), architecture overview, key directories, rules-from-memory-engine principle.
- **docs/bootstrap/vscode-agent.md** — VS Code agent bootstrap: same identity/architecture, scoped to file editing, defers architectural decisions to CLI COO.
- **prompts/coo-system.md** — Default COO system prompt: identity, communication style, behavior rules, memory engine usage.
- **decisions/brain-import-candidates.json** — 12 generic items triaged from 3158 Brain entries (4 conventions, 6 lessons, 2 requirements). Discarded: 3146 ProjectBrain-specific entries.
- **.gitignore** — node_modules, dist, .env files.

### Build Verification
- COO: `npx tsc --noEmit` — clean, zero errors
- Memory Engine: `npx tsc --noEmit` — clean, zero errors
- Both: `npx tsc` (full build) — clean, dist/ artifacts generated

### Environment Setup (also completed this session)
- Node.js v24.13.1, npm 11.8.0, TypeScript 6.0.2, Python 3.14.3
- Bash 5.2.12 (MSYS2 UCRT64), Git 2.39.1
- Claude CLI 2.1.84, Codex CLI 0.116.0, Gemini CLI 0.34.0
- MSYS2 `/tmp` remapped to user temp via fstab + permissions
- MSYS2 PATH inheritance via `-full-path` flag in VS Code profile
- `~/.bashrc` adds `~/.local/bin` and npm global to PATH
- Git identity: Assaf Yavnai <sufinoon@gmail.com>

---

## What's Next

Phase 1 (Foundation) is complete. Next context file: `step2-intelligence.md`

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
- When hitting errors, fix root cause — never work around it
