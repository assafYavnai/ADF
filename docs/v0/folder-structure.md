# ADF Folder Structure

Status: approved direction
Last updated: 2026-03-27

---

## Target Directory Structure

```
ADF/
  COO/                              # COO: controller + reasoning layer
    src/
      loop.ts                       # main control loop (stateless reducer)
      context-engineer.ts           # thread_to_prompt() - per-turn context assembly
      classifier.ts                 # intent classification (bounded LLM call)
      thread.ts                     # Thread + Event types (Zod schemas)
      tools.ts                      # tool registry + dispatch
    package.json
    tsconfig.json

  components/
    memory-engine/                  # all memory infrastructure (Tier 3)
      src/
        server.ts                   # Brain MCP server (TS)
        db/
          connection.ts             # PostgreSQL pool
          migrations/               # DB schema migrations
          queries/                  # query modules
        services/
          capture.ts                # memory capture + deduplication
          search.ts                 # hybrid semantic + keyword search
          context.ts                # context summary assembly
          scope.ts                  # scope hierarchy resolution
        schemas/                    # Zod schemas for memory types
        tools/                      # MCP tool definitions
      package.json
      tsconfig.json

  threads/                          # Tier 1: persisted thread state (JSON)
  memory/                           # Tier 2: daily residue
  prompts/                          # owned prompt templates (versioned)
  decisions/                        # imported decision board from handoff

  docs/
    VISION.md                       # long-range strategic vision
    PHASE1_VISION.md                # current phase investor-facing vision
    PHASE1_MASTER_PLAN.md           # current phase operating plan and alignment contract
    bootstrap/
      cli-agent.md                  # bootstrap doc for CLI agents
      vscode-agent.md               # bootstrap doc for VS Code agents
    v0/                             # current version docs
      architecture.md
      folder-structure.md           # this file
      implementation-phases.md
      memory_stack_strategy.md

  adf_coo_handoff_pack/             # reference: original handoff pack

  AGENTS.md                         # thin router -> docs/bootstrap/
  CLAUDE.md                         # -> read AGENTS.md
  GEMINI.md                         # -> read AGENTS.md
```

## Key Conventions

- **COO/** - the core deterministic orchestrator and reasoning layer. All TypeScript. Named COO because this is the COO's brain: controller, classifier, context engineer, tool dispatch.
- **components/memory-engine/** - all memory infrastructure under one roof. Brain MCP server (ported to TS), PostgreSQL queries, semantic search, memory capture, MCP tool definitions.
- **threads/** - Tier 1 (hot). Serialized thread state per session (JSON). Enables pause, resume, and replay.
- **memory/** - Tier 2 (warm). Daily residue files named by date (`YYYY-MM-DD.md`). Short-horizon context.
- **prompts/** - versioned prompt templates. Prompts are code, not incidental strings.
- **decisions/** - locked decisions carried forward from the handoff pack.
- **VISION.md** - long-range strategic vision for ADF as a virtual company.
- **PHASE1_VISION.md** - current phase mission and short-term goals.
- **PHASE1_MASTER_PLAN.md** - current phase alignment contract for agents, departments, and components.
- **AGENTS.md** - thin router only. Detects runtime (CLI vs VS Code) and points to the right bootstrap doc. Rules live in the memory engine, not here.
- **CLAUDE.md / GEMINI.md** - minimal pointer files: "read AGENTS.md and follow links."
