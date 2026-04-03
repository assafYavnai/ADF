# ADF Architecture

Status: locked decisions
Last updated: 2026-04-03

---

## Technology Stack

| Layer | Decision |
|---|---|
| **Controller runtime** | Node.js + TypeScript |
| **Process orchestration** | `node:child_process` |
| **Schemas / validation** | Zod + JSON Schema for external consumers |
| **Thread persistence** | JSON files as the current durable thread truth |
| **Memory persistence** | PostgreSQL + pgvector through the Brain MCP engine |
| **LLM calls** | CLI-based only. Codex primary, Claude fallback. |
| **Shell** | Bash is the canonical ADF shell on every host OS. On Windows, `adf.cmd` is only a trampoline into `bash adf.sh ...`, and non-bash workflow execution is non-compliant. |
| **Bootstrap / runtime gate** | Agents must run `--runtime-preflight` first. Normal launch uses a fast runtime gate plus cheap required-artifact checks. Dependency/build repair lives on explicit `--install`, and full bash + Brain verification lives on fail-closed `--doctor`. |
| **Python** | Allowed for specialist tools, not for the controller core |

## Core Principle

The controller is a deterministic orchestrator, not a drifting agent session.

Each turn is a reducer-style flow:

`thread + user_input -> classifier -> selected workflow -> validated outputs -> durable state commit`

Continuity comes from externalized state, not hidden model memory.

## Live Turn Flow

```
User input -> Controller ingress -> Load thread truth -> Intent classification
  -> Select workflow -> Execute selected path -> Validate outputs
  -> Commit thread + workflow state -> Emit telemetry -> Return COO response
```

## Governance Source Of Truth

The memory engine is the durable source of truth for decisions, rules, requirements, settings, findings, and telemetry.
The thread is the durable truth for the active session and live workflow progression.
The system-wide KPI instrumentation rule is defined in `docs/v0/kpi-instrumentation-requirement.md`.
No new live route, resource-consuming production path, or substantive production-affecting refactor is complete until that rule is satisfied with truthful proof.
Raw KPI truth remains append-only in the PostgreSQL `telemetry` table; derived summaries must stay read-only and must be computed from raw telemetry rather than replacing it.
Production-vs-proof telemetry isolation is mandatory. Rollups default to production and proof rows must remain explicitly partitioned.

## Full Detail

Full architecture (supported workflows, requirements-gathering onion integration, determinism rules, observability rules, persistence rules, operational principles, documentation rule) preserved at git tag `audit/pre-bootstrap-slim-v1`.
Current architecture decisions are in Brain (scope: `assafyavnai/adf`).
