# Decision D-064 - CTO requirement gathering stays in the requirements layer and uses a freeze-read gate

Frozen decision:
- while working directly with the CEO, CTO must keep the discussion in the requirements layer
- CEO discussion should stay focused on behavior, contracts, boundaries, and governing intent
- lower-layer schema, repo-layout, workflow-policy, and implementation-detail questions should be derived below that boundary or parked as open items for the correct later doc
- before asking for freeze or promotion, CTO must run a freeze-read against frozen upstream truth, aligned sibling docs, and the current artifact

Why:
- this captures the strongest process lesson from the session
- it keeps the CEO at the correct abstraction level
- it prevents promotion requests before promise carry-through, abstraction purity, and doc alignment have actually been checked
