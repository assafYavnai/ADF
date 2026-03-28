# ADF Memory Engine Strategy

Status: approved direction
Last updated: 2026-03-26

---

## Three Source Components Analyzed

### 12-Factor Agents (Execution Architecture)
- Source: https://github.com/humanlayer/12-factor-agents/tree/main
- **Thread model**: typed event list (`user_input`, `tool_call`, `tool_result`, `error`, etc.)
- **Stateless reducer**: `next_event = agent(thread)` — pure function, no drift
- **FileSystemThreadStore**: dual-format persistence (JSON + serialized text)
- **Context engineering**: `thread_to_prompt()` assembles exactly what the LLM needs per turn
- **Pause/resume**: serialize thread = pause, deserialize = resume
- **Concrete TypeScript implementation** available as reference

### Memory-Stack (File-Based Knowledge Layer)
- Source: `C:\ProjectBrain\ADF\WAT\MD-examples\memory-stack`
- **6-layer separation of concerns** — each layer has one job
- **PARA structure** (`projects/`, `areas/`, `resources/`, `archives/`) for durable facts
- **Daily residue** (`memory/YYYY-MM-DD.md`) for short-horizon context
- **Routing-only MEMORY.md** — index, not warehouse
- **Managed blocks** — idempotent patching with markers
- **Non-destructive** — backups before any modification

### Brain MCP Server (Production Knowledge Engine)
- Source: `C:\ProjectBrain\ADF\Components\MCP` and `C:\ProjectBrain\ADF\Components\Brain`
- **PostgreSQL + pgvector** backend — real database, not just files
- **Hybrid semantic + keyword search** (768-d embeddings via Ollama/nomic-embed-text)
- **24+ MCP tools**: memory capture, search, decisions, discussions, plans, change requests, governance
- **Deduplication**: exact match + cosine similarity (>= 0.985)
- **Trust levels**: `working` → `reviewed` → `locked`
- **Context priority**: P0-P3 automatic assignment
- **Scope hierarchy**: org/project/initiative/phase/thread
- **Full provenance tracking**: who created what, when, with which model
- **Existing data**: memories, decisions, discussions, plans from ProjectBrain (requires triage)

---

## Architecture Decision: Three-Tier Memory Engine

These three components are not competing — they are three different layers.

| Tier | Temperature | What | Component |
|---|---|---|---|
| **1** | Hot | Current session, current turn, event log | 12-Factor Thread |
| **2** | Warm | Bootstrap routing, operating rules, daily notes, prompts | Simplified file conventions |
| **3** | Cold | Semantic search, decisions, discussions, plans, governance | Brain MCP (converted to TS) |

### Integration Point: Context Engineer

```
┌─────────────────────────────────────────────────────────┐
│                    CONTEXT ENGINEER                       │
│         thread_to_prompt() — assembles per-turn context  │
│                                                           │
│   Pulls from all 3 tiers → builds optimized LLM context  │
└────────┬──────────────────┬──────────────────┬───────────┘
         │                  │                  │
   ┌─────▼─────┐    ┌──────▼──────┐    ┌──────▼──────┐
   │  TIER 1   │    │   TIER 2    │    │   TIER 3    │
   │   HOT     │    │    WARM     │    │    COLD     │
   │           │    │             │    │             │
   │  Thread   │    │  Files      │    │  Brain MCP  │
   │  (JSON)   │    │  (markdown) │    │  (Postgres) │
   │           │    │             │    │             │
   │ • events  │    │ • AGENTS.md │    │ • semantic  │
   │ • tool    │    │   (router)  │    │   search    │
   │   calls   │    │ • daily     │    │ • decisions │
   │ • results │    │   residue   │    │ • rules     │
   │ • errors  │    │ • prompts/  │    │ • discuss.  │
   │ • state   │    │             │    │ • plans     │
   │   commits │    │             │    │ • govern.   │
   │           │    │             │    │ • embeddings│
   └───────────┘    └─────────────┘    └─────────────┘
    In-session       Cross-session      Cross-project
    Disposable       File-durable       DB-durable
```

---

## What We Keep vs Drop From Each Source

### From 12-Factor Agents: KEEP
- Thread model (event list, typed events, Zod schemas)
- Stateless reducer pattern
- FileSystemThreadStore
- Context engineer concept
- Pause/resume via thread serialization
- Error compaction pattern

### From Memory-Stack: KEEP (simplified)
- AGENTS.md as thin router (NOT a rule store — rules live in Brain)
- Daily residue convention (`memory/YYYY-MM-DD.md`)
- Non-destructive principle

### From Memory-Stack: DROP
- LCM (Layer B) — 12-factor thread IS the session state
- Gigabrain (Layer E) — context engineer replaces this
- OpenStinger (Layer F) — Brain MCP hybrid search covers this
- PARA as files — Brain PostgreSQL is a better durable store
- Installer scripts / managed blocks — not needed
- `~/life/` directory structure — not needed

### From Brain MCP: KEEP
- PostgreSQL + pgvector backend
- Hybrid semantic + keyword search
- Memory capture with deduplication
- Decision logging with alternatives
- Trust levels and context priority
- Scope hierarchy
- MCP tool interface
- **Existing data** — after triage (see below)
- **Governance storage** — rulebook entries, review decisions, and learning engine outputs are stored as memory_items with appropriate content_types and trust levels

### From Brain MCP: CONVERT
- All JavaScript/MJS scripts → TypeScript
- All Brain server code → TypeScript under ADF structure

---

## Brain Data Triage Strategy

Most existing Brain entries are ProjectBrain-specific and will be noise for ADF. Triage approach:

### Keep (import to ADF)
- Generic conventions and lessons learned
- Architecture decisions that apply to ADF (from handoff pack D-001 through D-016)
- Reusable rules about agent behavior, governance patterns
- Tool-building conventions

### Discard (do not import)
- ProjectBrain-specific project/initiative/phase data
- ShippingAgent-specific entries
- Stale discussions tied to old project structure
- Embeddings for discarded entries (regenerate for kept entries)

### Process
1. Export all Brain memory items
2. Classify each as generic vs project-specific
3. Import only generic entries into ADF's Brain instance
4. Regenerate embeddings for imported entries

---

## Manual Memory Operations

The memory engine must support direct user commands through natural language. The COO interprets these and routes to the appropriate memory engine operation.

### Supported Commands (via natural language)
- **"Save this decision"** → `capture_memory` with content_type `decision` + `log_decision`
- **"Make this a rule"** → `rules_manage` create
- **"Remember this"** → `capture_memory` with appropriate content_type
- **"Load context about X"** → `search_memory` + inject into current thread
- **"What did we decide about X?"** → `search_memory` filtered to decisions
- **"List open discussions"** → `discussion_list`
- **"Update rule X"** → `rules_manage` update
- **"Archive this"** → `memory_manage` archive

### Implementation
These are not special commands — they are natural language intents that the COO/classifier recognizes and routes to memory engine tool calls. The memory engine tools are registered in the tool schema registry like any other tool.

---

## Folder Structure

All memory engine components live under one directory. The COO (controller + reasoning) lives under `COO/`.

```
ADF/
  COO/                              # COO: controller + reasoning layer
    src/
      loop.ts                       # main control loop (stateless reducer)
      context-engineer.ts           # thread_to_prompt() — assembles per-turn context
      classifier.ts                 # intent classification (bounded LLM call)
      thread.ts                     # Thread + Event types (Zod schemas)
      tools.ts                      # tool registry + dispatch
    package.json
    tsconfig.json

  components/
    memory-engine/                  # all memory infrastructure
      src/
        server.ts                   # Brain MCP server (TS port)
        db/
          connection.ts             # PostgreSQL pool
          migrations/               # DB schema migrations
          queries/                  # query modules
            memory.ts               # memory CRUD + search
            decisions.ts            # decision operations
            discussions.ts          # discussion operations
            plans.ts                # plan operations
            governance.ts           # rules, roles, requirements, findings
            embeddings.ts           # embedding generation + search
        services/
          capture.ts                # memory capture + deduplication
          search.ts                 # hybrid semantic + keyword search
          context.ts                # context summary assembly
          scope.ts                  # scope hierarchy resolution
        schemas/                    # Zod schemas for all memory types
          memory-item.ts
          decision.ts
          discussion.ts
          plan.ts
          governance.ts
          thread-event.ts           # memory-related event types
        tools/                      # MCP tool definitions
          memory-tools.ts
          decision-tools.ts
          discussion-tools.ts
          plan-tools.ts
          governance-tools.ts
      package.json
      tsconfig.json

  threads/                          # Tier 1: persisted thread state (JSON)
  memory/                           # Tier 2: daily residue
    YYYY-MM-DD.md
  prompts/                          # owned prompt templates (versioned)
  decisions/                        # imported decision board from handoff

  AGENTS.md                         # thin router (see below)
  CLAUDE.md                         # → read AGENTS.md
  GEMINI.md                         # → read AGENTS.md
  docs/
    VISION.md
    v0/
      architecture.md
      folder-structure.md
      implementation-phases.md
      memory_stack_strategy.md      # this file
```

---

## AGENTS.md: Thin Router

AGENTS.md is a pure router. It does NOT contain rules, facts, or memory. Rules live in the memory engine (Tier 3).

```markdown
# ADF Agent Bootstrap

## Routing

### If you are a CLI agent (Claude Code, Codex, Gemini CLI):
→ Read `docs/bootstrap/cli-agent.md`

### If you are a VS Code integrated agent:
→ Read `docs/bootstrap/vscode-agent.md`

## After bootstrap:
→ The COO controller governs all turns.
→ Rules are loaded from the memory engine, not from this file.
```

### CLAUDE.md / GEMINI.md
Minimal pointer files:
```markdown
Read AGENTS.md if it exists and follow links.
```

These exist so that Claude Code and Gemini CLI auto-discover the bootstrap path when opening the project.

---

## Implementation Phases (Memory Engine Specific)

### Phase 1: Thread Model
- Zod schemas for Thread, Event, all event types
- FileSystemThreadStore (create/get/update) persisting to `threads/`
- `serializeForLLM()` method
- Daily residue convention (`memory/YYYY-MM-DD.md`)

### Phase 2: Brain MCP Port to TypeScript
- Port Brain server code from JS/MJS → TypeScript
- Port all database queries
- Port MCP tool definitions
- Verify against existing PostgreSQL database
- Set up under `components/memory-engine/`

### Phase 3: Brain Data Triage
- Export all existing Brain entries
- Classify generic vs ProjectBrain-specific
- Import generic entries into ADF Brain instance
- Regenerate embeddings

### Phase 4: Context Engineer
- Build `thread_to_prompt()` in `COO/src/context-engineer.ts`
- Integrate Tier 1 (thread) + Tier 2 (files) + Tier 3 (Brain MCP)
- Pre-fetch relevant knowledge before each LLM call

### Phase 5: Manual Memory Commands
- Register memory engine tools in tool schema registry
- Classifier recognizes memory-related intents
- COO routes to appropriate memory engine operations

---

## Technology Stack (Memory Engine)

| Component | Technology |
|---|---|
| Thread persistence | JSON files (`threads/`) |
| Database | PostgreSQL + pgvector |
| Embeddings | Ollama + nomic-embed-text (768-d) |
| Schemas | Zod (TypeScript-native) |
| MCP interface | @modelcontextprotocol/sdk |
| Server | TypeScript + Node.js |
| Search | Hybrid semantic + keyword (PostgreSQL function) |

---

## References

- 12-factor-agents: https://github.com/humanlayer/12-factor-agents/tree/main
- Brain MCP source: `C:\ProjectBrain\ADF\Components\MCP`
- Brain data: `C:\ProjectBrain\ADF\Components\Brain`
- Memory-stack design: `C:\ProjectBrain\ADF\WAT\MD-examples\memory-stack`
- ADF handoff pack: `C:\ADF\adf_coo_handoff_pack\`
