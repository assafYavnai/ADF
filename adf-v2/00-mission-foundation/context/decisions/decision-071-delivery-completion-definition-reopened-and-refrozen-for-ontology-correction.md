# Decision D-071 - Delivery completion definition reopened and re-frozen for ontology correction

Frozen decision:
- `DELIVERY-COMPLETION-DEFINITION.md` was reopened for ontology correction and re-frozen in place as the current ontology-aligned layer output
- the service boundary wording is now `CEO -> CTO -> DEV`
- the underlying completion semantics remain the same unless they depended on the obsolete ontology wording
- `D-047` remains the historical freeze milestone, while this decision records the current ontology-aligned freeze state

Why:
- the delivery-completion document is frozen canon and therefore needed an explicit re-freeze trail rather than an untracked wording edit
- the service boundary needed to align with the corrected ontology without widening the document beyond its approved scope
- future agents need one clear current freeze state for this artifact
