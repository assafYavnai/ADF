# ADF v2 - V1 Pain Point And Fork Rationale

Status: working durable context
Purpose: preserve the plain-language reason ADF v2 exists so future agents do not need to reconstruct it from chat, commit history, or scattered slice artifacts

---

## What This Document Is

This document is not a mission statement, not an architecture spec, and not an implementation plan.

It exists to capture the missing context behind the v2 reset:

- what pain in v1 actually triggered the fork
- why continued v1 hardening stopped looking like the right main path
- what v2 is trying to resolve at the foundation level

---

## The Core Pain Point In v1

The main v1 pain was not simply that there were bugs.

The deeper problem was that the implementation route, especially around `implement-plan` and governed closeout, did not become trustworthy as a fire-and-forget path.

In practice, work often still required human distrust and human cleanup:

- a slice could look done without being truly complete
- completion still had to be manually verified
- the CEO or operator still had to check whether implementation shortcuts or silent interpretation happened
- closeout truth still had to be checked across commits, branch state, worktree state, summaries, and state files
- merge and post-merge cleanliness still had to be distrusted and rechecked
- route repair and truth repair kept reappearing after earlier hardening passes

The felt pain was:

**work was never fully complete in a way that could simply be trusted.**

That is the most important v1 pain statement to carry forward.

---

## Why This Became A Strategic Problem

Repeated hardening in v1 was not random maintenance.
It became a symptom that the main implementation path was not converging cleanly.

The repo history shows repeated passes around:

- governed implementation route hardening
- closeout truth
- approved-commit vs closeout separation
- merge closeout chain hardening
- approval gates and local sync hardening
- bootstrap governance hardening

Those passes produced real learning and real improvements.
But they also showed that the center of the system was still too fragile, too coupled, and too dependent on continued repair.

The issue was no longer just "finish one more hardening slice."
The issue became that the architecture and route assumptions underneath the hardening work were no longer trusted as the right long-term base.

---

## Why v2 Was Started

ADF v2 was started because continuing to patch v1 no longer looked like the right primary path.

The reset is based on these conclusions:

- legacy ADF contains useful learning, examples, substrate pieces, and narrow utilities
- legacy ADF should remain available as reference material
- legacy ADF should not remain the architectural source of truth
- v2 should become the new source of truth in the same repo

This is not a claim that all v1 work was wasted.
It is the opposite:

- v1 produced the evidence for what failed
- v1 produced the evidence for what must be preserved
- v1 produced the evidence that the next foundation should be thinner and more explicit

So v2 is a controlled fork in viewpoint and source of truth, not a denial that v1 taught anything.

---

## What v2 Is Trying To Resolve

v2 is trying to resolve the specific failure mode where implementation appears complete but still depends on hidden interpretation, manual checking, and cleanup.

At the highest level, v2 is trying to make these things true:

- a well-defined requirements package can be handed off without the CEO managing delivery mechanics
- completion means truly complete, not "done enough to inspect manually"
- delivery does not depend on hidden interpretation or prompt-only discipline
- every component and handoff follows explicit contracts
- failure, blocking, rejection, pushback, and completion all follow defined protocols
- the implementation layer is thin, explicit, and trustworthy
- the system can be treated as a real product path rather than an endlessly hardened experiment

---

## The v2 Direction Chosen From This Pain

The current v2 response to the v1 pain is:

- rewrite the implementation path around boxed, self-contained, contract-based components
- define one strong source of truth for the v2 Phase 1 mission and goal
- build only the minimum startup implementation layer first
- keep the operating model thin: CEO, CTO, Scripts, Agents, Durable state
- avoid dragging forward legacy company-shape assumptions as the new default

This means v2 Phase 1 is intentionally narrow.
It is not trying to rebuild the whole company model first.
It is trying to define and prove one trustworthy implementation startup model.

---

## What This Means For Legacy ADF

For mission-foundation purposes, legacy ADF should be treated as:

- reference implementation
- migration quarry
- evidence source
- source of lessons

It should not be treated as:

- the default architecture to continue
- the default state model to preserve
- the default workflow model to inherit
- the default implementation future to finish

In that sense, v1 is effectively deprecated as the main implementation direction, even if the repo still contains active artifacts from it.

---

## Evidence Basis For This Conclusion

This rationale is based on three durable evidence streams:

### 1. Repo history

The commit history shows repeated hardening and closeout-truth repair work around the governed implementation path instead of clean convergence.

### 2. Repo docs

The phase artifacts explicitly record route gaps such as:

- closeout truth still invalid
- governed chain requiring manual cleanup after merge
- partial route closure
- endpoint-only closure instead of full route closure
- completion claims needing reconciliation back to truthful state

### 3. Prior requirement-gathering discussion

The requirement-gathering discussion established the plain-language statement of the pain:

- the biggest pain in v1 was that work was never truly complete
- manual verification stayed necessary
- endless governance hardening was a symptom of that deeper failure

This document preserves that context so future sessions do not need to rediscover it.

---

## Working One-Sentence Summary

ADF v2 exists because v1 did not become a trustworthy fire-and-forget implementation path: work still needed manual verification, cleanup, and route repair, so the project is creating a new thin source of truth that can define and prove a cleaner implementation foundation instead of continuing to patch the old center.
