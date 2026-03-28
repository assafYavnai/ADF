# ADF Components and Layers

Status: active
Last updated: 2026-03-27

---

## Components

A component is a top-level bounded system within ADF. Each component has its own directory, config, and internal structure.

| Component | Directory | Purpose |
|---|---|---|
| **COO** | `COO/` | The user-facing operational core. Deterministic controller + LLM-powered reasoning. The CEO talks to the COO. |
| **Memory Engine** | `components/memory-engine/` | Durable knowledge store. PostgreSQL + pgvector + MCP server. Semantic search, decisions, rules, governance. |
| **Shared** | `shared/` | Project-wide utilities callable by any component or external user. Not a component itself — infrastructure. |
| **agent-role-builder** | `tools/agent-role-builder/` | Governed tool for creating agent role packages. Live multi-LLM review board. Every agent role must be created through this tool. Creates its own role as first act (eats own dog food). |
| **llm-tool-builder** | `tools/llm-tool-builder/` | Governed tool for creating LLM-powered tools. Contract-based, schema-validated, with after-action review. Always calls agent-role-builder — no tool exists without a role. |

## Layers (COO Internal)

A layer is an internal subdivision of a component. Each layer has its own directory, role (if LLM-powered), and prompt.

### COO Layers

| Layer | Directory | LLM? | Purpose |
|---|---|---|---|
| **Controller** | `COO/controller/` | No | Deterministic main loop. Stateless reducer. Orchestrates all other layers. Owns the thread model. |
| **Classifier** | `COO/classifier/` | Yes (fast/cheap) | Intent classification per turn. Reads user message, outputs structured JSON routing decision. No action permissions. |
| **Intelligence** | `COO/intelligence/` | Yes (strongest) | COO executive reasoning. Receives assembled context, produces responses, extracts decisions, handles memory operations. Full permissions. |
| **Context Engineer** | `COO/context-engineer/` | No | Assembles per-turn LLM context from all 3 tiers (thread + files + Brain MCP). Deterministic pre-fetch. |
| **Shared** | `COO/shared/` | — | COO-internal utilities: tool registry, common types. |

### Layer Rules

- Every LLM-powered layer has a **role** (`role/` subdirectory) with a role definition markdown and role contract JSON
- Every role is created through the **Role Builder** tool — no exceptions, even for cheap models
- Every LLM-powered layer has its own **rulebook** (`rulebook.json`) and **review prompt** (`review-prompt.json`) in its directory
- Every layer has its own **prompt** file if LLM-powered
- Non-LLM layers are pure TypeScript — no role needed
- Layers do not call each other directly — the Controller orchestrates all interaction

## Shared Infrastructure

| Module | Directory | Purpose |
|---|---|---|
| **LLM Invoker** | `shared/llm-invoker/` | Generic CLI-based LLM caller. Takes invocation params (cli, model, reasoning, timeout, etc.) → spawns process → captures output → handles fallback. No hardcoded profiles — each caller passes its own params. Callable by any component or external user. |
| **Telemetry** | `shared/telemetry/` | Project-wide metrics collection. Async fire-and-forget via MCP. Writes to PostgreSQL `telemetry` table. Every resource-consuming operation must emit telemetry. Queryable by COO for cost/performance governance. |
| **Learning Engine** | `shared/learning-engine/` | Generic service that extracts generalizable rules from review feedback. Same engine, different domain prompt per component (loaded from component's `review-prompt.json`). Updates the specific component's `rulebook.json`. Runs between every review and fix cycle. |
| **Provenance** | `shared/provenance/` | Operation identity and traceability. Every DB write, MCP call, thread event, telemetry emit, and tool artifact carries provenance (invocation UUID, provider, model, reasoning, source_path). |

### Telemetry Flow

```
Any component (llm-invoker, memory-engine, tools, controller)
  → emit_metric via MCP (async, zero latency to caller)
  → Memory Engine MCP server receives
  → Batches and writes to telemetry table
  → COO queries via query_metrics / get_cost_summary when needed
```

### Future Layers

Additional layers may be added as needed:
- **Specialist** — bounded worker agents for specific domains
- **Workflow** — multi-step execution flows
- **Audit** — execution monitoring and compliance
