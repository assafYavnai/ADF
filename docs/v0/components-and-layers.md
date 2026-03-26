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
| **Role Builder** | `tools/role-builder/` | Governed tool for creating agent role packages. Live multi-LLM review board. Every agent role must be created through this tool. |
| **Tool Builder** | `tools/tool-builder/` | Governed tool for creating specialist tools. Contract-based, schema-validated, with after-action review. |

## Layers (COO Internal)

A layer is an internal subdivision of a component. Each layer has its own directory, role (if LLM-powered), and prompt.

### COO Layers

| Layer | Directory | LLM? | Purpose |
|---|---|---|---|
| **Controller** | `COO/controller/` | No | Deterministic main loop. Stateless reducer. Orchestrates all other layers. Owns the thread model. |
| **Classifier** | `COO/classifier/` | Yes (fast/cheap) | Intent classification per turn. Reads user message, outputs structured JSON routing decision. No action permissions. |
| **Intelligence** | `COO/intelligence/` | Yes (strongest) | COO executive reasoning. Receives assembled context, produces responses, extracts decisions, handles memory operations. Full permissions. |
| **Context Engineer** | `COO/context-engineer/` | No | Assembles per-turn LLM context from all 3 tiers (thread + files + Brain MCP). Deterministic pre-fetch. |
| **Shared** | `COO/shared/` | — | Cross-layer utilities: LLM CLI caller, tool registry, common types. |

### Layer Rules

- Every LLM-powered layer has a **role** (`role/` subdirectory) with a role definition markdown and role contract JSON
- Every role is created through the **Role Builder** tool — no exceptions, even for cheap models
- Every layer has its own **prompt** file if LLM-powered
- Non-LLM layers are pure TypeScript — no role needed
- Layers do not call each other directly — the Controller orchestrates all interaction

### Future Layers

Additional layers may be added as needed:
- **Specialist** — bounded worker agents for specific domains
- **Workflow** — multi-step execution flows
- **Audit** — execution monitoring and compliance
