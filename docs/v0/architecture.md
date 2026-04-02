# ADF Architecture

Status: locked decisions
Last updated: 2026-04-01

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
| **Shell** | Bash is the default ADF shell. PowerShell is for Windows-only leaf tasks. |
| **Python** | Allowed for specialist tools, not for the controller core |

## LLM Model Configuration

ADF uses CLI-based LLM calls through `shared/llm-invoker`.

| Role | Primary | Reasoning | Fallback | Effort |
|---|---|---|---|---|
| **Classifier** | `gpt-5.3-codex-spark` | `medium` | `claude --model haiku` | `medium` |
| **COO / Onion Parser** | `gpt-5.4` | `xhigh` | `claude --model opus` | `max` |

The classifier is bounded and cheap. COO reasoning and onion parsing use the stronger model path.

## Core Principle

The controller is a deterministic orchestrator, not a drifting agent session.

Each turn is a reducer-style flow:

`thread + user_input -> classifier -> selected workflow -> validated outputs -> durable state commit`

Continuity comes from externalized state, not hidden model memory.

## Live Turn Flow

```
User input
  ->
Controller ingress
  ->
Load thread truth
  - thread events
  - workflow state
  - session handles
  - scoped route context
  ->
Intent classification
  - bounded classifier model call
  ->
Select workflow
  - direct_coo_response
  - memory_operation
  - requirements_gathering_onion
  - clarification / pushback
  ->
Execute selected path
  - COO reasoning call
  - or bounded workflow adapter call
  ->
Validate outputs
  ->
Commit thread + workflow state
  ->
Emit telemetry / audit
  ->
Return COO response
```

## Supported COO Runtime Workflows

The supported live controller routes are:

- `direct_coo_response`
- `memory_operation`
- `clarification`
- `pushback`
- `requirements_gathering_onion`

`requirements_gathering_onion` is explicit and feature-gated.
It is enabled only when `ADF_ENABLE_REQUIREMENTS_GATHERING_ONION` or `--enable-onion` is set.

## Key Components

1. **Thread model**
   - typed event log plus typed workflow state
   - current live event types include `user_input`, `classifier_result`, `coo_response`, `error`, `human_request`, `memory_operation`, `onion_turn_result`, and `state_commit`
   - the thread is the durable session truth

2. **Controller loop**
   - deterministic TypeScript orchestrator
   - owns routing, validation, state commit, and failure handling

3. **Intent classifier**
   - bounded LLM call
   - returns Zod-validated structured routing decisions
   - controller and classifier contracts must stay aligned

4. **Context engineer**
   - deterministic context assembly for COO reasoning calls
   - not required for every bounded workflow adapter

5. **COO reasoning / workflow adapters**
   - per-turn function-style calls
   - includes bounded live adapters such as the requirements-gathering onion lane
   - no hidden long-lived business state

6. **Memory engine client**
   - governed Brain MCP bridge
   - used for scoped search, durable governance writes, requirement persistence, and telemetry sink integration

## Requirements-Gathering Onion Integration

The onion lane is now part of the supported COO runtime behind the explicit feature gate.

Runtime capability route shape:

`CLI -> controller -> classifier -> requirements_gathering_onion adapter -> thread workflow state + governed requirement persistence -> COO response -> telemetry`

Current integration-proof entry route:

`controller.handleTurn -> classifier -> requirements_gathering_onion adapter -> thread workflow state + governed requirement persistence -> COO response -> telemetry`

The live onion adapter is intentionally thin:

- parse one CEO turn into a structured onion update
- apply the dormant pure onion engine
- persist workflow state in the thread
- derive the finalized requirement artifact only from the approved snapshot
- write the finalized requirement artifact through governed memory routes
- emit operation timing, LLM metrics, and workflow audit evidence

## Determinism Rules

- controller routing is explicit code
- thread state is durable and serializable
- classifier output is schema-validated before routing
- onion business logic is implemented in pure reducer/checker functions
- freeze is explicit, never silent
- unresolved business decisions block freeze
- finalized requirement artifacts are derived only from the approved human snapshot

## Observability Rules

Every resource-consuming operation must emit telemetry.

Current required surfaces include:

- classifier / COO / parser LLM attempt telemetry
- controller turn telemetry
- memory operation telemetry
- live onion operation timing
- live onion workflow audit trace

Telemetry is durable through the Brain telemetry table.

## Persistence Rules

- the thread remains the first durable session truth
- governed artifacts belong in Brain, not only in thread prose
- if scope or write preconditions are missing, persistence fails closed
- success is reported only when the governed write actually succeeds

For the live onion lane this means:

- working onion state lives in thread workflow state
- freeze status and approved snapshot live in thread workflow state
- finalized requirement artifacts are written through `requirements_manage`
- the persisted finalized requirement is then locked through `memory_manage`
- if a frozen scope reopens, the adapter attempts to archive the prior finalized artifact; if that archive mutation is rejected, lifecycle stays `blocked` with explicit failure receipts

## Operational Principles

- input always enters through the controller
- intent classification is model-assisted, not heuristic-only
- controller behavior stays deterministic even when models are called
- continuity comes from persisted thread state, governed artifacts, and typed receipts
- feature gates are explicit controller choices, not hidden prompt behavior

## Governance Source Of Truth

The memory engine is the durable source of truth for:

- decisions
- rules
- requirements
- settings
- findings
- telemetry

The thread is the durable truth for the active session and live workflow progression.

## Documentation Rule

When the live route changes, the following docs must stay aligned:

- `docs/v0/architecture.md`
- `docs/v0/components-and-layers.md`
- `docs/v0/folder-structure.md`
- relevant `docs/phase1/*` status and planning docs
- the business source document for the onion model
