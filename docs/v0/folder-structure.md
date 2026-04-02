# ADF Folder Structure

Status: approved direction
Last updated: 2026-04-01

---

## Target Directory Structure

```
ADF/
  COO/                              # COO: controller + reasoning layer
    controller/                     # deterministic loop - no LLM
      loop.ts
      thread.ts
      cli.ts
      memory-engine-client.ts
    requirements-gathering/         # CEO-facing feature shaping lane (live behind feature gate)
      contracts/                    # serializable onion state/artifact/observability contracts
      engine/                       # pure onion reducer, freeze, derivation, readiness, audit logic
      live/                         # thin controller integration adapter for the supported COO route
      fixtures/                     # deterministic sample turns/traces for route-free proof
      rulebook.json                 # seed rules for onion-based intake and freeze
      review-prompt.json            # review focus for scope-freeze quality
    classifier/                     # intent classification - fast LLM
      classifier.ts
      role/                         # governed role (created by agent-role-builder)
      rulebook.json                 # accumulated rules from review failures
      review-prompt.json            # domain-specific review focus
      prompt.md
    intelligence/                   # COO reasoning - strong LLM
      role/                         # governed role (created by agent-role-builder)
      rulebook.json
      review-prompt.json
      prompt.md
    context-engineer/               # context assembly - no LLM
      context-engineer.ts
    shared/                         # COO-internal utilities
      tools.ts
    package.json
    tsconfig.json

  shared/                           # project-wide utilities
    provenance/                     # operation identity and traceability
      types.ts
    llm-invoker/                    # generic LLM CLI invoker
      invoker.ts
      types.ts
    telemetry/                      # project-wide metrics
      collector.ts
      types.ts
    learning-engine/                # generic rule extraction from review feedback
      engine.ts
      types.ts

  tools/
    agent-role-builder/             # governed role creation tool
      src/
      role/                         # its own governed role (dog food)
      rulebook.json
      review-prompt.json
      runs/                         # permanent audit trail
    llm-tool-builder/               # governed tool creation tool
      src/
      role/                         # governed role
      rulebook.json
      review-prompt.json
      runs/

  components/
    memory-engine/                  # all memory infrastructure (Tier 3)
      src/
        server.ts                   # Brain MCP server (TS)
        db/
          connection.ts
          migrations/
        services/
        schemas/
        tools/
      package.json
      tsconfig.json

  threads/                          # Tier 1: persisted thread state (JSON)
  memory/                           # Tier 2: daily residue
  decisions/                        # imported decision board from handoff

  docs/
    VISION.md                       # long-range strategic vision
    PHASE1_VISION.md                # current phase investor-facing vision
    PHASE1_MASTER_PLAN.md           # current phase operating plan
    bootstrap/
      cli-agent.md
      vscode-agent.md
    v0/                             # current version docs
      architecture.md
      folder-structure.md           # this file
      components-and-layers.md
      review-process-architecture.md
      implementation-phases.md
      memory_stack_strategy.md
      context/                      # implementation context trail

  adf_coo_handoff_pack/             # reference: original handoff pack

  AGENTS.md                         # thin router -> docs/bootstrap/
  CLAUDE.md                         # -> read AGENTS.md
  GEMINI.md                         # -> read AGENTS.md
```

## Key Conventions

- **COO/** - the core deterministic orchestrator and reasoning layer. Organized by layers such as controller/, requirements-gathering/, classifier/, intelligence/, context-engineer/, shared/.
- **COO lanes** may start governance-first, then grow into live feature-gated runtime paths. The requirements-gathering lane now includes contracts, pure engine logic, a live controller adapter, and route-proof artifacts under the same folder.
- **Each LLM-powered layer** has its own `role/`, `rulebook.json`, `review-prompt.json`, and `prompt.md` in its directory (boxed hierarchy).
- **shared/** (root) - project-wide utilities callable by any component: provenance, llm-invoker, telemetry, learning-engine.
- **tools/** - governance tools (agent-role-builder, llm-tool-builder). Each has its own `role/`, `rulebook.json`, `review-prompt.json`, and `runs/` for permanent audit trails.
- **components/memory-engine/** - all memory infrastructure. Brain MCP server (TS), PostgreSQL, semantic search, MCP tool definitions.
- **threads/** - Tier 1 (hot). Serialized thread state per session (JSON).
- **memory/** - Tier 2 (warm). Daily residue files named by date (`YYYY-MM-DD.md`).
- **decisions/** - locked decisions carried forward from the handoff pack.
- **AGENTS.md** - thin router only. Detects runtime (CLI vs VS Code) and points to the right bootstrap doc.
- **CLAUDE.md / GEMINI.md** - minimal pointer files: "read AGENTS.md and follow links."
