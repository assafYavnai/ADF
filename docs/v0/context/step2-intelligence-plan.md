# Step 2: Intelligence — Tools, Roles, LLM Wiring

Status: **planned**
Last updated: 2026-03-27

---

## CEO Directives

- Use CLI (codex/claude) not API SDKs — leverages existing auth and token pools
- Codex is primary, Claude is fallback
- Classifier uses medium reasoning (cheap model, no need to overthink)
- COO Intelligence uses strongest models with highest reasoning and full bypass permissions
- Classifier has no action permissions (read-only sandbox or no sandbox)
- **Every LLM-powered agent must have a governed role** created through agent-role-builder — no exceptions, even cheap models
- Import both agent-role-builder and tool-builder now (foundational tooling, no reason to defer)
- COO folder structure: controller/, classifier/, intelligence/, context-engineer/, shared/
- **LLM invoker is project-wide** — lives in `shared/llm-invoker/`, generic function signature, no hardcoded profiles. Each caller passes its own params. Callable by any component or external user.

## LLM Configuration (per-component, not global)

Each component sets its own invocation params. These are the current defaults:

| Role | Primary | Fallback |
|---|---|---|
| **Classifier** | codex / gpt-5.3-codex-spark / medium / read-only / 60s | claude / haiku / medium / 60s |
| **COO Intelligence** | codex / gpt-5.4 / xhigh / bypass / 120s | claude / opus / max / bypass / 120s |
| **Role Builder Leader** | codex / gpt-5.4 / xhigh / bypass / 600s | claude / opus / max / bypass / 600s |
| **Role Builder Reviewer** | codex / gpt-5.4 / high / 300s | claude / sonnet / high / 300s |

## Folder Structure

```
ADF/
  shared/                           # project-wide utilities
    provenance/                     # operation identity and traceability
      types.ts                      # Provenance schema, factory, sentinel
    llm-invoker/                    # generic LLM CLI invoker
      invoker.ts                    # core: params → CLI args → spawn → capture → fallback
      types.ts                      # Zod schemas for invocation params
    telemetry/                      # project-wide metrics
      collector.ts                  # async fire-and-forget metric emission via MCP
      types.ts                      # Zod schemas for metric events

  COO/
    controller/                     # deterministic loop — no LLM
      loop.ts
      thread.ts
    classifier/                     # intent classification — fast LLM
      classifier.ts
      role/
        classifier-role.md
        classifier-role-contract.json
      prompt.md
    intelligence/                   # COO reasoning — strong LLM
      intelligence.ts
      role/
        intelligence-role.md
        intelligence-role-contract.json
      prompt.md
    context-engineer/               # context assembly — no LLM
      context-engineer.ts
    shared/                         # COO-internal utilities
      tools.ts                      # tool registry
    package.json
    tsconfig.json

  tools/
    agent-role-builder/             # agent-role-builder (TS port, creates its own role)
    llm-tool-builder/               # llm-tool-builder (TS port, always calls agent-role-builder)

  components/
    memory-engine/                  # (already built)
```

---

## Implementation Plan (reordered for dependencies)

### Phase 2a: Create shared infrastructure (provenance + LLM invoker + telemetry)

**Provenance** (`shared/provenance/`):
- Create `types.ts` — Zod schema for the Provenance object:
  - `invocation_id`: UUID (from llm-invoker, or sentinel for non-LLM ops)
  - `provider`: codex | claude | gemini | system
  - `model`: string (gpt-5.4, opus, haiku, "none" for non-LLM)
  - `reasoning`: string (xhigh, medium, max, "none" for non-LLM)
  - `was_fallback`: boolean
  - `source_path`: string — `<component>/<layer>/<action>` pattern
  - `timestamp`: ISO 8601
- Factory functions:
  - `createProvenance(invocationResult, sourcePath)` — from LLM invoker result
  - `createSystemProvenance(sourcePath)` — for non-LLM operations (system provider, model "none")
  - `LEGACY_PROVENANCE` — sentinel for pre-provenance data:
    - `invocation_id: "00000000-0000-0000-0000-000000000000"`
    - `provider: "system"`, `model: "none"`, `source_path: "system/pre-provenance"`
- **Every DB write, MCP call, thread event, telemetry emit, commit, and tool artifact must include provenance — no exceptions**

**LLM Invoker** (`shared/llm-invoker/`):
- Create `types.ts` — Zod schemas for invocation params:
  - cli (codex | claude | gemini)
  - model, reasoning/effort level, sandbox, bypass, timeout
  - fallback config (optional, same shape)
  - prompt (string)
  - `source_path` (required — caller must identify themselves)
- Create `invoker.ts` — generic invoke function:
  - Takes params → builds CLI-specific args → spawns process → captures output
  - **Assigns a UUID to every LLM invocation**
  - **Returns full Provenance object** alongside the response
  - Handles fallback: if primary fails, retry with fallback params (new UUID, was_fallback=true)
  - Handles temp files (Codex `-o` flag), cleanup
  - **Emits telemetry** after every call (with full provenance)
  - No opinions about caller identity or purpose
- Return type: `{ provenance: Provenance, response: string, latencyMs: number }`

**Telemetry** (`shared/telemetry/`):
- Create `types.ts` — Zod schemas for metric events:
  - **provenance**: full Provenance object (mandatory on every event)
  - category (llm | memory | tool | turn | system)
  - operation name, latency_ms, success/failure
  - LLM-specific: tokens_in, tokens_out, estimated_cost_usd
  - Memory-specific: results_count, embedding_generated
  - Tool-specific: board_rounds, participants, budget_consumed
  - Turn-specific: total_ms, classifier_ms, intelligence_ms, context_ms
- Create `collector.ts` — async fire-and-forget emission:
  - `emit(metric)` — sends metric to memory engine MCP server, returns immediately
  - Zero latency to caller — non-blocking
  - Batching if needed for performance

**Memory Engine Updates**:
- New SQL migration `006_telemetry.sql`:
  - `telemetry` table (append-only) with provenance columns
- New SQL migration `007_provenance.sql`:
  - Add provenance columns to `memory_items` table (invocation_id, provider, model, reasoning, was_fallback, source_path)
  - Backfill all existing rows with sentinel provenance (`00000000...`, `system/pre-provenance`)
- New MCP tools:
  - `emit_metric` — fire-and-forget write (accepts provenance)
  - `query_metrics` — filtered read with provenance fields
  - `get_cost_summary` — aggregated read by provider/model/source_path
- Update ALL existing MCP tools to accept and store provenance:
  - `capture_memory` — provenance stored with item
  - `search_memory` — provenance in telemetry for the search op
  - `log_decision` — provenance stored with decision
  - `memory_manage` — provenance in telemetry for the manage op
  - All governance tools (rules_manage, roles_manage, etc.) — provenance stored
  - All discussion/plan tools — provenance stored

**Refactor existing components for provenance:**

| Component | Change |
|---|---|
| `COO/controller/thread.ts` | Add `provenance` field to every ThreadEvent type |
| `COO/controller/loop.ts` | Pass provenance from invoker into all events |
| `COO/classifier/` | Attach provenance to classifier_result events |
| `COO/intelligence/` | Attach provenance to coo_response events |
| `COO/context-engineer/` | System provenance with source_path `COO/context-engineer/assemble` |
| `components/memory-engine/server.ts` | All tool handlers accept and forward provenance |
| `components/memory-engine/services/capture.ts` | Store provenance with captured item |
| `components/memory-engine/services/search.ts` | Emit telemetry with provenance per search |
| `components/memory-engine/services/context.ts` | Emit telemetry with provenance per query |
| `components/memory-engine/services/lifecycle.ts` | System provenance for health checks |

**Provenance verification sweep (mandatory before moving to Phase 2b):**
1. Automated scan: grep all DB writes — every INSERT/UPDATE must include provenance columns
2. Automated scan: grep all MCP tool calls — every call must pass provenance
3. Automated scan: grep all ThreadEvent creation — every createEvent must include provenance
4. Automated scan: grep all telemetry emit calls — every emit must include provenance
5. No exceptions found = pass. Any exception = fix before proceeding.

**Independent review cycle (mandatory before moving to Phase 2b):**
1. Spin up Codex gpt-5.4 with xhigh reasoning, no permissions (read-only)
2. Prompt: "Review the entire shared/ and components/memory-engine/ implementation for provenance completeness. Every DB write, MCP call, thread event, and telemetry emit must include provenance. Report any gaps."
3. Fix all reported gaps
4. Re-review until Codex reports zero gaps
5. Save review artifacts as evidence in `docs/v0/reviews/step2a-provenance-review/`

### Phase 2b: Restructure COO folders
- Move files from `COO/src/` to new layer structure:
  - `loop.ts` → `COO/controller/loop.ts`
  - `thread.ts` → `COO/controller/thread.ts`
  - `classifier.ts` → `COO/classifier/classifier.ts`
  - `context-engineer.ts` → `COO/context-engineer/context-engineer.ts`
  - `tools.ts` → `COO/shared/tools.ts`
  - `prompts/coo-system.md` → `COO/intelligence/prompt.md`
- Update tsconfig and all import paths
- Remove `COO/src/`
- Verify compile

### Phase 2c: Port agent-role-builder to TypeScript
- Port from PowerShell (`C:\ProjectBrain\ADF\COO\tools\agent-role-builder\`) to TS
- Place under `tools/agent-role-builder/`
- Keep core architecture:
  - Live board with Codex+Claude reviewer pairs
  - Multi-round review with arbitration
  - 4 terminal states: frozen / pushback / blocked / resume_required
  - Schema validation + self-check
  - Slug-prefixed role packages
  - Decision log + board summary + after-action review
- Uses `shared/llm-invoker/` for all CLI calls
- Port 5 schemas to Zod
- **First act: agent-role-builder creates its own role** (eats own dog food, proves it works)

### Phase 2d: Port llm-tool-builder to TypeScript
- Port from PowerShell (`C:\ProjectBrain\ADF\COO\tools\tool-builder\`) to TS
- **Rename from tool-builder to llm-tool-builder** (it builds LLM tools, not generic utilities)
- Place under `tools/llm-tool-builder/`
- **Fix: must always call agent-role-builder** when creating a new tool — no tool exists without a role
- Uses `shared/llm-invoker/` for all CLI calls
- Deep analysis of existing tool-builder needed before implementation

### Phase 2e: Bootstrap verification (no shortcuts)
This is the evidence-based validation that the tools work:

1. **agent-role-builder creates its own role** — proves agent-role-builder works
   - Input: role definition request for agent-role-builder itself
   - Output: frozen role package at `tools/agent-role-builder/role/`
   - Evidence: role.md + role-contract.json + decision-log.md + board-summary.md

2. **llm-tool-builder(update) attaches the role to agent-role-builder** — proves llm-tool-builder works and integrates with agent-role-builder
   - Input: update request for agent-role-builder with role from step 1
   - Output: updated tool package
   - Evidence: tool contract + role contract aligned

3. **llm-tool-builder creates tool-builder's own role via agent-role-builder** — proves the integration pipeline end-to-end
   - Evidence: llm-tool-builder has a governed role created through agent-role-builder

4. **Verify all artifacts** — no artifact = not done

### Phase 2f: Create COO roles via agent-role-builder
- Build **Intelligence role** (COO reasoning agent):
  - Authority: reports to CEO, owns execution/planning/memory operations
  - Scope: executive reasoning, structured responses, decision extraction
  - Guardrails: CEO language, evidence-based, pushback on bad decisions
  - Informed by: current ADF-ROLE.md + redesign pack + 12 proven rules
- Build **Classifier role** (intent classification agent):
  - Authority: reports to Controller, read-only
  - Scope: classify user intent into workflow routing
  - Guardrails: JSON-only output, no actions, no reasoning beyond classification

### Phase 2g: Wire controller loop + end-to-end test
- Update `COO/controller/loop.ts` to use `shared/llm-invoker/`
- Create `COO/controller/cli.ts` — REPL entry point
- End-to-end test: user input → classify → context → COO response → thread commit
- Telemetry verified: provenance flowing through thread events and telemetry table
- Full provenance chain verified: every LLM call, DB write, and MCP op traceable

---

## Dependencies
- Codex CLI installed and authenticated (verified: v0.116.0)
- Claude CLI installed and authenticated (verified: v2.1.84)
- PostgreSQL running for memory engine (verified: port 5432)
- Ollama running for embeddings (verified: port 11434)

## Open Questions
- Should the COO CLI entry point also start the memory engine server, or assume it's running separately?
- Do we need `--no-color` or similar flag for clean stdout parsing from Claude?
- Max buffer size for LLM responses — 10MB enough?
- llm-tool-builder: what is the minimal port scope? Full contract governance or simplified for v1?
- Gemini as third provider in review board — include now or defer?

## Files to Create/Modify

| File | Action |
|---|---|
| `shared/provenance/types.ts` | create — Provenance schema, factory, sentinel |
| `shared/llm-invoker/invoker.ts` | create — generic LLM CLI invoker (returns Provenance) |
| `shared/llm-invoker/types.ts` | create — Zod schemas for invocation params |
| `shared/telemetry/collector.ts` | create — async fire-and-forget metric emission via MCP |
| `shared/telemetry/types.ts` | create — Zod schemas for metric events (includes Provenance) |
| `components/memory-engine/src/db/migrations/006_telemetry.sql` | create — telemetry table with provenance columns |
| `components/memory-engine/src/db/migrations/007_provenance.sql` | create — add provenance to memory_items, backfill sentinel |
| `components/memory-engine/src/tools/telemetry-tools.ts` | create — emit_metric, query_metrics, get_cost_summary |
| `components/memory-engine/src/server.ts` | update — all MCP tools accept/store provenance |
| `components/memory-engine/src/services/capture.ts` | update — store provenance with items |
| `components/memory-engine/src/services/search.ts` | update — emit provenance in telemetry |
| `components/memory-engine/src/services/context.ts` | update — emit provenance in telemetry |
| `COO/controller/loop.ts` | move from src/, add provenance to all events |
| `COO/controller/thread.ts` | move from src/, add provenance field to ThreadEvent |
| `COO/classifier/classifier.ts` | move from src/, update imports |
| `COO/classifier/role/` | create via role-builder |
| `COO/classifier/prompt.md` | create |
| `COO/intelligence/intelligence.ts` | create — COO reasoning handler |
| `COO/intelligence/role/` | create via role-builder |
| `COO/intelligence/prompt.md` | move from prompts/coo-system.md |
| `COO/context-engineer/context-engineer.ts` | move from src/, update imports |
| `COO/shared/tools.ts` | move from src/, update imports |
| `COO/controller/cli.ts` | create — REPL entry point |
| `tools/agent-role-builder/` | create — TS port, creates its own role first |
| `tools/agent-role-builder/role/` | created BY agent-role-builder (eats own dog food) |
| `tools/llm-tool-builder/` | create — TS port, renamed from tool-builder |
| `tools/llm-tool-builder/role/` | created BY agent-role-builder via llm-tool-builder |
| `docs/v0/reviews/step2a-provenance-review/` | Codex review artifacts — evidence of independent verification |

## Tool Governance (carry forward from ProjectBrain, updated)

| Tool | Governance Model | Review Board? | Own Role? | Role Created By |
|---|---|---|---|---|
| **agent-role-builder** | Live multi-LLM review board (Codex+Claude pairs) | Yes — always | Yes (creates its own) | Itself (first act, bootstrap) |
| **llm-tool-builder** | Contract-based autonomy, fire-and-forget | No (per-contract optional) | Yes | agent-role-builder (via llm-tool-builder integration) |

**Rule: llm-tool-builder must always call agent-role-builder** when creating a new tool. No tool exists without a governed role.

Both tools carry forward their existing governance models. The learning cycle (after-action reviews → rule candidates → rules guide) ports as-is.

## Open Loops (deferred)

| Loop | Target | Logged |
|---|---|---|
| Commit contract + tool | Step 3 (Resilience) | Brain (working/p1) |
