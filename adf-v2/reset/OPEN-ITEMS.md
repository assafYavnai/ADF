# Reset Open Items

Status: active unresolved-item list
Purpose: track unresolved questions without letting them silently become assumptions

## O-001 - Exact LangGraph carry-over status

Question:
- should LangGraph remain a probable carry-over candidate, or is repo evidence now strong enough to classify it as certain carry-over?

Why it matters:
- this affects the first real carry-over ledger and later architecture shaping

Owner:
- CTO / architecture lane

Blocking:
- no

---

## O-002 - Exact Brain carry-over boundary

Question:
- which current Brain-related surfaces count as likely carry-over substrate, and which surrounding legacy integration or governance layers remain reference-only?

Why it matters:
- Step 2 needs a concrete ledger, not only a high-level statement that Brain is likely to carry over

Owner:
- CTO / architecture lane

Blocking:
- yes

---

## O-003 - Runtime and tooling carry-over boundary

Question:
- which runtime wrappers, scripts, engines, and workflow surfaces on `main` are true substrate candidates versus reference-only legacy scaffolding?

Why it matters:
- cleanup and isolation work cannot proceed safely until the active-tree support surfaces are classified

Owner:
- reset architecture lane

Blocking:
- yes
