1. Implementation Objective

Continue the existing `coo-live-executive-status-wiring` slice and rebaseline it into the bounded rebased COO for Phase 1.

This slice now implements:
- company-first executive status
- evidence cross-checking
- anomaly investigation
- operating-table continuity
- bounded deep-audit and trust logic
- Brain hard-stop enforcement

2. Exact Slice Scope

- `COO/briefing/**`
- `COO/controller/**`
- `COO/requirements-gathering/**` only for additive read helpers
- tightly scoped tests for the same route
- `docs/phase1/coo-live-executive-status-wiring/**`

3. Required Deliverables

- rebased runtime implementation on top of the existing live-status wiring
- 4-section company-first CEO-facing `/status`
- bounded operating-table/trust/deep-audit layer
- Brain-backed runtime finding and trust persistence
- Brain hard-stop behavior
- updated slice docs, COO prompt, and Phase 1 wording
- proof/tests
- truthful completion summary

4. Forbidden Edits

- implement-plan changes
- review-cycle changes
- merge-queue changes
- queue scheduler buildout
- unrelated onion redesign
- broad memory-engine redesign
- edits to other slice folders

5. Accepted Product Decisions

- the COO remains bounded in authority
- Brain is primary durable memory
- direct workspace reality outranks worker-reported surfaces
- trust is secondary to evidence and never overrides stronger truth
- `/status` is company-first
- the CEO still controls launch into major execution

6. Proof Expectations

- first-run deep audit
- Brain hard stop
- anomaly classification and investigation
- tracked COO issue creation
- immediate trust downgrade on credible drift
- full-trust proposal path
- company-first `/status`
- no silent fallback / no silent source mutation

7. Human Verification

Required: true

Verify from the feature worktree:
```bash
./adf.sh -- --status --scope-path assafyavnai/adf/phase1
```

Check:
- readable business-level output
- 4 executive sections present
- evidence gaps stay visible
- Brain hard-stop message is explicit if Brain is unavailable
- any git-backed dropped-context warning is understandable

8. Change Request 02 - Rebased COO Operator

This slice is no longer only "wire the executive brief."

Approved rebaseline:
- keep the current foundation
- add bounded company situational awareness
- add evidence cross-checking and anomaly investigation
- add bounded trust and deep-audit behavior
- keep the route derived-only and Phase 1 bounded

9. Review / Compatibility Gates

- post_send_to_review: true
- review_until_complete: true
- review_max_cycles: 3

Vision Compatibility:
- compatible
- This slice strengthens the COO as the executive operating surface of the startup by improving leadership visibility, continuity, and evidence-grounded judgment without widening into later-company autonomy.

Phase 1 Compatibility:
- compatible
- The work stays within the Phase 1 mission of a real startup that can shape demand, manage the table, admit work intelligently, and brief leadership truthfully.

Master-Plan Compatibility:
- compatible
- The slice builds on the stabilized COO runtime and the merged briefing/admission foundations instead of restarting architecture, and it improves the real COO management seam that the master plan requires.

Current Gap-Closure Compatibility:
- compatible
- The slice closes the active gap around the COO business-level surface by turning it from status compression into evidence-validated operational judgment plus company-table visibility.

Compatibility Evidence:
- company-first `/status` now renders the 4 executive sections from live evidence
- suspicious surfaced facts such as `0 review cycles` are investigated rather than merely repeated
- deep-audit, trust, tracked-issue, and Brain hard-stop behavior are implemented and tested
- the route remains bounded and derived-only rather than becoming a second canonical company database

Compatibility Decision:
- compatible
