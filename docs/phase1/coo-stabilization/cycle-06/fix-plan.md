# Cycle 06 Fix Plan

## Goal

Close the remaining live route defects from cycle-06 without widening scope:

1. telemetry provenance authenticity on durable telemetry writes
2. byte-stable Windows/provider launch transport
3. small capability-surface cleanup for `artifact_ref`

## Route Contracts

### 1. Telemetry provenance route

Contract:
- direct telemetry writes must require full provenance
- caller-visible tool routes must either preserve caller provenance or emit telemetry under one explicit internal-event provenance contract
- no fresh telemetry row may invent actor identity from partial provenance

Sweep:
- `components/memory-engine/src/tools/telemetry-tools.ts`
- `components/memory-engine/src/server.ts`
- sibling telemetry emit paths through `emit_metric`, `emit_metrics_batch`, and tool-route telemetry

Proof:
- DB-backed negative tests for `emit_metric` and `emit_metrics_batch`
- DB-backed route proof that caller-visible tool telemetry no longer fabricates caller provenance
- live DB probe showing no fresh telemetry rows with synthesized `system/none/none` actor fields from partial caller provenance

### 2. Managed launch transport route

Contract:
- supported provider/helper launch routes must deliver argv literally
- Windows shim resolution must not require `shell: true`
- provider/session launches must avoid shell re-parsing on supported paths

Sweep:
- `shared/llm-invoker/managed-process.ts`
- `shared/llm-invoker/invoker.ts`
- sibling launch paths for managed shim launches, Claude session launches, and Codex prompt delivery

Proof:
- Windows regression test proving metacharacter args remain literal through the managed shim route
- no `shell: true` on supported provider/session launch paths after the fix
- live smoke proof that `claude`, `gemini`, and `codex` still launch on the supported Windows runtime

### 3. Capability-surface parity cleanup

Contract:
- `artifact_ref` must not appear as a governable/injectable live family unless there is a published end-to-end manage route

Sweep:
- `components/memory-engine/src/schemas/governance.ts`
- `COO/context-engineer/context-engineer.ts`
- `COO/controller/loop.ts`
- sibling tests and docs that describe injectable/governable families

Proof:
- schema/tests show `artifact_ref` no longer appears in the governable or hidden-recall live surface
- no new MCP family is introduced in this cycle

## Non-Goals

- no telemetry transport redesign
- no invoker architecture rewrite
- no new `artifact_refs_manage` subsystem
- no historical backfill/refactor beyond what is required to keep current live routes honest
