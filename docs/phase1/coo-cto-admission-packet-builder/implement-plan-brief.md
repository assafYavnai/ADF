# 1. Implementation Objective

Build a standalone COO -> CTO admission packet builder that converts finalized requirement artifacts into normalized CTO admission requests with governed output artifacts, KPI instrumentation, and audit traceability.

# 2. Exact Slice Scope

- `COO/cto-admission/types.ts` — contract pack types, request/decision schemas, KPI types
- `COO/cto-admission/validate.ts` — Zod-based input validation for finalized requirement artifacts
- `COO/cto-admission/build-packet.ts` — main packet builder: read input, validate, produce request + decision template + summary
- `COO/cto-admission/render-summary.ts` — Markdown summary renderer
- `COO/cto-admission/kpi.ts` — KPI counter and latency tracking
- `COO/cto-admission/index.ts` — barrel export
- `COO/tsconfig.json` — add `cto-admission/**/*` to includes
- `tests/integration/cto-admission-packet-builder.test.ts` — fixture tests
- `docs/phase1/coo-cto-admission-packet-builder/**` — feature docs and artifacts

# 3. Inputs / Authorities Read

- `docs/phase1/coo-cto-admission-packet-builder/README.md` — approved plan
- `docs/phase1/coo-cto-admission-packet-builder/context.md` — architectural context
- Brain convention: COO owns requirements gathering, CTO manages admission/sequencing
- `COO/package.json` — dependency availability (zod)
- `COO/tsconfig.json` — compilation config

# 4. Required Deliverables

- Packet-builder code under `COO/cto-admission/**` with types, validation, build, render, KPI, and index
- `cto-admission-request.json` generation matching contract pack field names
- `cto-admission-decision.template.json` generation with admit/defer/block
- `cto-admission-summary.md` generation
- Fixture tests for admitted, deferred, blocked, and malformed-input paths
- KPI counter evidence in test output

# 5. Forbidden Edits

- `COO/controller/cli.ts`
- `COO/controller/loop.ts`
- `COO/requirements-gathering/live/onion-live.ts`
- implement-plan skill files
- queue engine
- live freeze path
- KPI-owned active route surfaces
- other slice folders

# 6. Integrity-Verified Assumptions Only

- Zod is available in COO/package.json
- `node:test` is the project test runner
- No existing `COO/cto-admission/` directory — clean creation
- The packet builder is standalone and does not require COO runtime
- TypeScript compilation uses ES2022 + Node16 module resolution

# 7. Explicit Non-Goals

- No live freeze-path integration
- No queue ownership engine
- No priority arbitration engine
- No auto-spawn into implement-plan
- No review-cycle redesign
- No runtime handoff into implement-plan

# 8. Proof / Verification Expectations

**Machine Verification Plan:**
- Run `node --test tests/integration/cto-admission-packet-builder.test.ts`
- Validate JSON output parses cleanly
- Validate admitted, deferred, blocked, and malformed-input fixture paths
- Validate KPI counters

**Human Verification Plan:**
- Required: false
- Reason: manual technical bridge artifact, not human-facing

# 9. Required Artifact Updates

- `docs/phase1/coo-cto-admission-packet-builder/context.md` — update if needed
- `docs/phase1/coo-cto-admission-packet-builder/completion-summary.md` — fill on completion
- `docs/phase1/coo-cto-admission-packet-builder/implement-plan-contract.md` — written
- `docs/phase1/coo-cto-admission-packet-builder/implement-plan-brief.md` — this file
- `docs/phase1/coo-cto-admission-packet-builder/implement-plan-state.json` — updated by helper

# 10. Closeout Rules

- Human testing: not required
- Review-cycle: not invoked (post_send_to_review=false)
- Post-human-approval sanity pass: not required
- Final completion happens only after merge-queue lands the merge successfully
- Completion-summary.md must report merge status and local target sync status truthfully
