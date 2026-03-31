# Analysis

- Scenario: per-rule
- Run id: live-002
- Wall clock ms: 325746
- Time to first useful finding ms: 18897
- Tester count: 24
- Tester failures: 0
- Findings: 24
- Cost USD: 0.586835

## Top Findings
- [blocking] ARB-016: The package does not define one authoritative artifact matrix; artifact authority is split across multiple sections, uses basename or placeholder paths in several places, and omits explicit write lifecycle behavior by operation and terminal state.
- [major] ARB-001: The authority model uses a flat subordinate list that treats governance documents as reporting authority instead of separating operative authority from reference evidence.
- [major] ARB-002: The artifact reuses "material pushback" as a freeze threshold but never provides a single canonical definition for that concept.
- [major] ARB-003: Canonical promoted artifacts and run-scoped evidence are mixed together without explicit labels or full tool-relative path conventions.
- [major] ARB-004: Terminal states are named but their mutually exclusive, evidence-testable triggers are not defined.
- [major] ARB-005: Step 3 requires out-of-scope verification, but the artifact only states a generic representation check and does not require semantic concept matching or evidence of which concepts were actually checked.
- [major] ARB-006: The markdown <scope> exclusions do not match the contract out_of_scope list exactly and include overlapping entries.
- [major] ARB-007: Arbitration is referenced but not mechanically defined in Step 4 or guardrails: the artifact does not specify the trigger threshold, arbitrating actor, required evidence fields, or the limits on terminal-outcome effects.
- [major] ARB-008: The artifact <outputs> section and contract package_files use basename or slug-template paths instead of the full canonical tool-relative paths required by the contract's required_outputs list.
- [major] ARB-009: Completion criteria are generic and do not define state-specific completion requirements for frozen, pushback, blocked, and resume_required.

## Failed Tasks