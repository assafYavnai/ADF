# Decision D-023 - Queryability And Resumability Are Explicit

Frozen decision:
- queryability and resumability are explicit trust conditions of the delivery service

What that means:
- the implementation state must always be queryable
- any non-terminal in-progress or pending state must be safely resumable without manual repair
- the service must recover from interruption, refresh, malformed transient state, or similar non-terminal disruption without pushing the burden past CTO governance back to the CEO

Analogy carried forward:
- the intended robustness is closer to a production web application than to a fragile script
- interruption, refresh, transient breakage, or temporary state corruption should be survivable
- the service should know how to recover and continue without making the CEO reconstruct or repair it manually

Why this was accepted:
- prevents these trust conditions from being left implicit and lost later
- carries forward an important part of the v1 pain: inability to trust interrupted or partially completed routes
- sets the expected resilience level for the service boundary without dropping into implementation detail
