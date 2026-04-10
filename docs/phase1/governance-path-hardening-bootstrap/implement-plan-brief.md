# Implementor Brief

1. Implementation Objective

Implement the governance hardening frozen in `implement-plan-contract.md` without rewriting the plan model. The job is to close the real route defect classes across `implement-plan`, `merge-queue`, `review-cycle`, and shared runtime surfaces so the next dogfood slice can land without manual repair.

2. Exact Slice Scope

- `C:/ADF/skills/implement-plan/**`
- `C:/ADF/skills/merge-queue/**`
- `C:/ADF/skills/review-cycle/**`
- `C:/ADF/skills/governed-feature-runtime.mjs`
- route-owned tests under `C:/ADF/skills/tests/**`
- authoritative route contracts and skill docs only where required to keep the hardened path truthful
- this feature root under `C:/ADF/docs/phase1/governance-path-hardening-bootstrap/**`

3. Inputs / Authorities Read

- `README.md`
- `context.md`
- `requirements.md`
- `decisions.md`
- `implement-plan-contract.md`
- `C:/ADF/docs/phase1/governance-path-hardening-plan-v2.md`
- current helper/runtime surfaces and workflow contracts named in `context.md`

4. Required Deliverables

- Phase 0 contract-freeze updates before production code changes
- Phase 1 wrong-code-landing blockers
- explicit canonical-root and authority-plane handling
- persisted-schema versus hydrated-runtime split
- domain-scoped reconcile plus multi-plane validator
- remotely provable governed closeout
- hostile-case proofs and negative proofs for all retired authority paths

5. Forbidden Edits

- no widening into unrelated COO product/runtime work
- no Phase 6 backfill in the runtime hardening landing
- no persisted writes of runtime-derived fields
- no writable restoration of compatibility aliases
- no workspace mirror authority
- no global precedence ladder
- no manual state patches as the intended product fix

6. Integrity-Verified Assumptions Only

- the repo default branch language for this slice is `main`
- the current route under repair is not trusted to certify its own first landing
- manual governance review is required before the first production code change
- the seeded operational artifacts preserve `brief_ready` only as the last truthful pre-implementation checkpoint while live operational state stays blocked
- `bootstrap-approval.v1.json` is the sole bootstrap approval record, and the hold is cleared only after that artifact is stamped approved and a deliberate `feature-reopened` transition is recorded
- Brain context for this session was loaded through the documented repo fallback route after preflight/doctor exposed a bash-route defect
- the current route inventory in `context.md` is the minimum in-scope surface and must expand further if new sibling authority sites are discovered during implementation-preflight

7. Explicit Non-Goals

- no bulk historical convergence
- no generic doc cleanup outside the route
- no unrelated Brain hygiene work
- no broad COO reporting cleanup

8. Proof / Verification Expectations

- prove the blocked paths, not only the happy path
- run the repo-wide search gate before code changes
- keep proof route aligned with claimed route and mutated route
- include hostile-case coverage for zero-result, multi-result, stale-proof, wrong-root, stale-ref, wrong-branch, stale-worktree, and split-domain contradictions
- treat any reintroduced alias authority, workspace authority, or global precedence ladder as a defect-class regression

9. Required Artifact Updates

- keep `README.md`, `context.md`, `requirements.md`, `decisions.md`, and `implement-plan-contract.md` aligned with the implemented route
- refresh `implement-plan-execution-contract.v1.json` and `implement-plan-state.json` only truthfully
- keep manual-governance notes explicit until the trust-restoration gates are proven

10. Closeout Rules

- do not treat the current governed route as sufficient closeout authority for the first landing
- stop for manual review before starting production code changes
- do not clear the bootstrap hold except through the approval record in `bootstrap-approval.v1.json` followed by the deliberate reopen transition defined in `implement-plan-contract.md`
- during implementation review, emphasize:
  - illegal persisted writes of runtime-derived fields
  - writable compatibility aliases
  - global precedence collapse
  - validator plane omissions
  - workspace mirror authority
  - projection/cache source-truth leakage
- the slice is only ready to leave manual governance after the trust-restoration gates in `implement-plan-contract.md` are proven
