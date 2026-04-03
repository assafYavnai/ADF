# System-Wide KPI Instrumentation Requirement

Status: locked governance rule
Last updated: 2026-04-03
Scope recommendation: `assafyavnai/adf` and all child scopes

## Purpose

Make production-grade KPI instrumentation mandatory for every new implementation surface and every substantive production-affecting refactor.

This is a binding governance rule, not optional guidance.

## Rule

No new component, workflow, live route, or substantive refactor may be treated as production-ready, route-complete, management-trustworthy, or eligible for truthful closeout unless it ships with production-grade KPI instrumentation and proof that match the real route being claimed.

This rule applies to:

- every new component
- every new workflow
- every new live route
- every substantive refactor of an existing component
- every touched production path that consumes resources or changes runtime behavior

## Mandatory KPI Coverage

Where relevant to the touched route, the implementation must durably capture and preserve:

1. Latency
   - route-level latency
   - step-level latency for the materially meaningful stages

2. Success / failure
   - success flag
   - failure flag
   - failure reason or error class
   - blocked / degraded / retried outcomes when they exist

3. LLM cost truth
   - tokens in
   - tokens out
   - estimated cost
   - provider / model / fallback truth

4. Route / audit traceability
   - real entry surface
   - route stage
   - step name
   - trace id
   - thread / workflow / scope identity when applicable

5. Recovery-relevant events
   - retries
   - resume / replay
   - spool / drain behavior
   - gate-disabled or fail-closed branches
   - cleanup / rollback / archive / supersede actions when applicable

6. Production / proof isolation
   - proof telemetry must be partitioned from production telemetry
   - proof rows must never silently count as production KPI truth
   - rollups must default to production-only unless proof is explicitly requested

7. Truthful CLI-entry proof for live routes
   - if the production front door is CLI, proof must enter through the real CLI path
   - inner-function or controller-only proof may not be used to claim CLI closure
   - route claims must match the proved entry surface exactly

8. Ownership / recovery truth
   - durable evidence must show which route, workflow, or actor owned the state transition
   - recovery and handoff paths must preserve truthful owner / resume state instead of relying on transient memory

9. Atomic finalization lifecycle when applicable
   - create / publish / lock / retire / supersede lifecycles must emit truthful intermediate and terminal evidence
   - no current-looking artifact, id, or KPI success claim may be published before the full lifecycle succeeds

10. Final sanity approval when applicable
   - if a route includes freeze, approval, publish, handoff, or release-style finalization, the final sanity decision and its outcome must be durably instrumented

## Enforcement

- Missing KPI coverage is a production-blocking defect.
- Missing KPI coverage means the route or refactor may not be called complete, production-ready, or route-closed.
- Missing KPI coverage means proof must be treated as partial and any production claim must be removed or blocked.
- Missing production/proof separation means KPI rollups are non-authoritative until corrected.
- Missing truthful CLI-entry proof means the implementation may claim only the narrower route that was actually proved.
- Missing ownership / recovery truth means the route is not acceptable for management-trustworthy operation.
- Missing atomic finalization evidence means finalization must fail closed or remain explicitly provisional.
- If a change lands without full KPI closure, it must stay explicitly non-production, carry an owner, carry a recovery date, and record the missing coverage as a blocking open loop.

## Required Proof

Proof must be route-complete, durable, and truthful. At minimum:

- positive proof must exercise the real claimed route
- negative sibling proof must show that adjacent shared surfaces cannot fake, hide, republish, or bypass the claimed lifecycle or partition boundary
- proof artifacts must preserve the actual route boundary, not a narrower inner seam disguised as end-to-end proof
- production and proof partitions must be queryable and distinguishable in durable telemetry
- failure / blocked / cleanup branches must be evidenced, not omitted
- recovery and replay behavior must be evidenced when the route has recovery semantics
- finalization branches must prove atomicity, rollback / cleanup truth, and default-reader truth where applicable

## Exceptions Policy

- There is no blanket exception for speed, smallness, or convenience.
- Purely non-production changes may be excluded only if they do not touch a production path, do not consume production resources, and do not change runtime behavior.
- Temporary exceptions require explicit written approval, explicit owner, explicit expiry, explicit compensating control, and explicit statement that the route is not yet production-complete.
- A temporary exception does not permit proof telemetry to count as production telemetry.
- A temporary exception does not permit a fake CLI-proof claim, fake finalization claim, or misleading recovery claim.

## Failure Classes This Rule Explicitly Guards Against

- ownership / recovery truth failures
- fake or missing real CLI-entry proof
- production / proof mixing
- non-atomic finalization lifecycle
- misleading dedicated-only lifecycle control claims without negative sibling proof
- lack of final sanity approval evidence
- claimed-route-vs-proved-route drift

## Preferred Improvement Order For Future KPI Work

1. pre-code route contract freeze
2. new-power / capability-scope audit
3. mandatory negative sibling proofs
4. live-vs-proof isolation gate
5. claimed-route-vs-proved-route gate
6. regression forecast block
7. earlier requirements normalization
8. optional same-invocation final sanity

## Rationale

Recent ADF cycles already exposed the exact failure patterns this rule is intended to prevent:

- route-complete claims overstated CLI-entry and lifecycle proof until the real proof route was tightened
- live-vs-proof bootstrap mixing created a truth hazard until explicit isolation was enforced
- finalized artifact handoff was once non-atomic and could publish current-looking truth before lock succeeded
- shared lifecycle controls widened beyond their dedicated routes and required negative sibling proofs to close the regression
- recovery truth and observability truth were repeatedly called out as management-grade gates, not optional polish

## Brain Rule Payload

```json
{
  "surface": "rules_manage",
  "arguments": {
    "action": "create",
    "scope": "assafyavnai/adf",
    "title": "Mandatory KPI Instrumentation For Production Routes And Refactors",
    "tags": [
      "governance",
      "kpi",
      "telemetry",
      "instrumentation",
      "production",
      "proof-isolation",
      "cli-entry-proof",
      "recovery-truth",
      "atomic-finalization"
    ],
    "body": {
      "scope_recommendation": {
        "primary_scope": "assafyavnai/adf",
        "inherit_to_child_scopes": true,
        "notes": "Applies system-wide to current and future components, workflows, live routes, and substantive production-affecting refactors."
      },
      "rule_text": "Production-grade KPI instrumentation is mandatory for every new component, every new workflow, every new live route, every substantive refactor of an existing component, and every touched production path that consumes resources or changes runtime behavior. No covered change may be treated as production-ready, route-complete, or management-trustworthy without truthful KPI instrumentation and truthful proof.",
      "applies_to": [
        "every new component",
        "every new workflow",
        "every new live route",
        "every substantive refactor of an existing component",
        "every touched production path that consumes resources or changes runtime behavior"
      ],
      "must_measure": [
        "latency",
        "success/failure",
        "tokens/cost when LLMs are used",
        "route/audit traceability",
        "recovery-relevant events",
        "production/proof isolation",
        "truthful CLI-entry proof for live routes",
        "ownership/recovery truth",
        "atomic finalization lifecycle when applicable",
        "final sanity approval when applicable"
      ],
      "proof_expectations": [
        "Positive proof exercises the real claimed route.",
        "Negative sibling proof shows adjacent shared surfaces cannot fake, hide, republish, or bypass the claimed lifecycle or partition boundary.",
        "Production and proof telemetry remain durably partitioned.",
        "Failure, blocked, cleanup, recovery, and finalization branches are evidenced when applicable.",
        "If the production front door is CLI, proof enters through the real CLI path."
      ],
      "enforcement_expectations": [
        "Missing KPI coverage is a production-blocking defect.",
        "Missing KPI coverage blocks truthful closeout and route-complete claims.",
        "Missing production/proof separation makes KPI rollups non-authoritative.",
        "Missing ownership/recovery truth or atomic finalization evidence is unacceptable for management-trustworthy operation."
      ],
      "exceptions_policy": [
        "No blanket exception for speed, smallness, or convenience.",
        "Temporary exceptions require explicit approval, owner, expiry, compensating control, and explicit non-production status.",
        "Temporary exceptions do not allow proof telemetry to count as production telemetry or fake route-closure claims."
      ],
      "rationale": [
        "Guards against ownership/recovery truth failures.",
        "Guards against fake or missing real CLI-entry proof.",
        "Guards against production/proof mixing.",
        "Guards against non-atomic finalization lifecycle.",
        "Guards against misleading dedicated-only lifecycle control claims without negative sibling proof.",
        "Guards against lack of final sanity approval evidence."
      ],
      "priority_order": [
        "pre-code route contract freeze",
        "new-power / capability-scope audit",
        "mandatory negative sibling proofs",
        "live-vs-proof isolation gate",
        "claimed-route-vs-proved-route gate",
        "regression forecast block",
        "earlier requirements normalization",
        "optional same-invocation final sanity"
      ]
    }
  }
}
```
