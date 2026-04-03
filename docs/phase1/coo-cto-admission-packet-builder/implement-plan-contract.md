# 1. Implementation Objective

Build a standalone COO -> CTO admission packet builder under `COO/cto-admission/` that reads a finalized requirement artifact, validates required fields, and writes three governed output artifacts: `cto-admission-request.json`, `cto-admission-decision.template.json`, and `cto-admission-summary.md`. Include KPI instrumentation types, audit metadata, and fixture tests for admitted, deferred, blocked, and malformed-input paths.

# 2. Slice Scope

- `COO/cto-admission/types.ts` — TypeScript types for the admission contract pack, request, decision, KPIs
- `COO/cto-admission/validate.ts` — input validation for finalized requirement artifacts
- `COO/cto-admission/build-packet.ts` — main packet builder logic
- `COO/cto-admission/render-summary.ts` — Markdown summary renderer
- `COO/cto-admission/kpi.ts` — KPI tracking types and counter logic
- `COO/cto-admission/index.ts` — public API barrel export
- `tests/integration/cto-admission-packet-builder.test.ts` — fixture tests
- `docs/phase1/coo-cto-admission-packet-builder/**` — feature docs

# 3. Required Deliverables

- Packet-builder code under `COO/cto-admission/**`
- Request JSON generation matching shared contract pack fields
- Decision template JSON generation with admit / defer / block
- Summary Markdown generation
- KPI type definitions and counter logic
- Fixture tests: admitted, deferred, blocked, malformed-input paths
- `context.md` and `completion-summary.md`

# 4. Allowed Edits

- `COO/cto-admission/**`
- `COO/tsconfig.json` (add `cto-admission/**/*` to includes)
- `tests/integration/cto-admission-packet-builder.test.ts`
- `docs/phase1/coo-cto-admission-packet-builder/**`

# 5. Forbidden Edits

- `COO/controller/cli.ts`
- `COO/controller/loop.ts`
- `COO/requirements-gathering/live/onion-live.ts`
- implement-plan skill files
- queue engine files
- live freeze path files
- KPI-owned active route surfaces
- other slice folders

# 6. Acceptance Gates

**Machine Verification Plan**
- Run `node --test tests/integration/cto-admission-packet-builder.test.ts`
- Validate generated JSON files parse cleanly
- Validate fixture cases for admitted, deferred, blocked, and malformed-input paths
- Validate KPI counters track outcomes correctly

**Human Verification Plan**
- Required: false
- Reason: this slice creates a manual technical bridge artifact, not a new human-facing route

# 7. Observability / Audit

KPI definitions:
- `admission_packet_build_latency_ms` (p50, p95, p99)
- Slow bucket thresholds: 1s, 10s, 60s
- `admission_packets_built_count`
- `admission_packets_admitted_count`
- `admission_packets_deferred_count`
- `admission_packets_blocked_count`
- `missing_required_input_count`
- `dependency_blocked_count`
- `scope_conflict_detected_count`
- `admission_source_metadata_completeness_rate`
- `requirement_to_packet_parity_count`
- Partition/isolation proof for production vs proof inputs

Audit rules:
- Finalized requirement artifact is authoritative source
- Admission packet is derived governed handoff artifact
- KPI claims auditable from requirement input + generated artifacts
- Clear distinction: not-built-due-to-missing-input vs built-then-blocked/deferred
- Raw-vs-derived parity semantics preserved
- Production/proof isolation maintained

Worktree: `C:/ADF/.codex/implement-plan/worktrees/phase1/coo-cto-admission-packet-builder`
Feature branch: `implement-plan/phase1/coo-cto-admission-packet-builder`
Base branch: `main`
Merge status: tracked via implement-plan state

# 8. Dependencies / Constraints

- Standalone package — no COO runtime wiring required
- Uses `zod` from COO package.json for validation
- Uses `node:test` and `node:assert/strict` for tests
- Manual invocation only — no auto-queueing

# 9. Non-Goals

- No live freeze-path integration
- No queue ownership engine
- No priority arbitration engine
- No auto-spawn into implement-plan
- No review-cycle redesign

# 10. Source Authorities

- `docs/phase1/coo-cto-admission-packet-builder/README.md` — approved plan
- `docs/phase1/coo-cto-admission-packet-builder/context.md` — architectural context
- Brain convention: COO owns requirements gathering, CTO manages admission/sequencing
- Brain convention: the finalized requirement list is the COO handoff artifact
