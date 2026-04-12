# ADF v2 - Trust Model

Status: first-draft working artifact  
Scope: `adf-v2/00-mission-foundation/`  
Purpose: propose a high-level trust model for ADF v2 that a future agent can take from concept toward production implementation

---

## What This Document Is

This document is a first draft.

It is not yet a frozen foundation rule.
It is a working proposal for how trust should be understood and governed in ADF v2.

It is written for a future contextless agent that may need to:
- refine the concept
- turn it into a frozen foundation document
- connect it to `DELIVERY-COMPLETION-DEFINITION.md`
- connect it to `SYSTEM-OBLIGATIONS.md`
- later implement it in governance, reporting, or self-healing behavior

---

## Why This Exists

ADF v2 is trying to become a fire-and-forget implementation system.

That means success is not only:
- functionality exists
- the route technically completed
- the artifact was returned

It also means:
- the chain can be relied on
- problems are contained at the correct layer
- work does not need distrust, repeated checking, or manual repair from above

This session exposed that trust is not just a feeling.
It is a system property.
It affects:
- delivery quality
- governance quality
- delegation quality
- executive confidence
- the ability to scale without supervision

Without an explicit trust model, the system can look operational while still leaking hidden burden upward.

---

## Problem To Solve

The system needs a simple way to answer:

- can one box rely on the next box?
- where is trust weakening?
- when is action required?
- how can the system detect deep problems before they become executive burden?

This matters because failure often appears first as trust degradation before it appears as a visible hard failure.

Examples:
- repeated pushback loops
- repeated review cycles
- repeated correction of preventable mistakes
- surprising hidden cleanup
- promises that technically close but cannot be relied on
- teams or components that only work under supervision

ADF v2 needs a model that exposes this early, without becoming heavy bureaucracy.

---

## Proposed Definition

### Trust

`Trust` is justified confidence that the adjacent box will carry out its obligations reliably, truthfully, and predictably.

Its primary meaning is whether that boundary is safe to rely on now.
Longer-term interaction quality matters as supporting evidence, but it is not the primary definition.

### Trust Level

`Trust Level` is the current executive health of that adjacent relationship.

This means trust level is not:
- self-praise
- a vague feeling
- a final-output-only metric

It is a governed signal about whether delegation across a boundary is actually safe.

---

## Working Decisions Already Made

These are the decisions already reached in this session, even if the full trust model is not yet frozen.

### 1. Trust Is A Core System Concept

Trust is not only a communication quality or a soft feeling.
It is a system property that affects whether ADF v2 can actually become fire-and-forget.

### 2. Trust Must Be Treated As Separate From Delivery Completion

`DELIVERY-COMPLETION-DEFINITION.md` needs only the delivery-boundary trust condition.
The full trust model is broader and should live in its own document.

### 3. Trust For Delivery Completion Is Narrower Than The Full Trust Model

For delivery completion, the needed trust meaning is:
- the CEO can rely on the CTO completion claim without manual supervision, verification, reconstruction, or repair
- internal problems may happen, but they must be contained before completion is declared upward

The broader scoring, ownership, and governance model belongs elsewhere.

### 4. Trust Is Bidirectional

Trust is not one-way.
Adjacent boxes may each hold trust in the other side.

Examples:
- CTO trust in Dev
- Dev trust in CTO
- Review trust in Implementor
- Implementor trust in Review

### 5. Trust Is Not Self-Published

A box does not define its own trust level upward.

The parent holds trust in the child.
The child may separately hold trust in the parent.

This preserves honesty and avoids self-certification.

### 6. Trust Is Edge-Based

Trust is fundamentally about adjacent relationships.
It is not only a flat property of one actor or one team.

### 7. Workflows Are Graph-Shaped, Not Purely Sequential

The real structure underneath is a workflow graph.
One node may sit on several adjacent trust edges at once.

### 8. Executive Trust Should Be Aggregated Upward At The Box Level

Internal trust may stay detailed.
Upward reporting should stay executive.

Parents should see the trust state of the asset, not the full internal blame map.

### 9. Aggregation Should Use The Weakest Critical Edge

The current agreed direction is:
- not average
- use the weakest critical edge relevant to delivery

This is still not fully specified, but the direction itself is already decided.

### 10. Trust Should Primarily Be Handled In The Governance Layer

The mechanism should stay lightweight and should not turn into manual bureaucracy.

### 11. Low Trust Requires Action

Trust is not only an observation signal.
When it drops too low, action is required.

The current direction from the session is:
- `9/10` or higher = healthy minimum
- `8/10` = action now

### 12. Trust Is Meant To Support Future Self-Healing And Self-Improving Behavior

At first, low trust may only trigger:
- reporting
- recommendation
- corrective action

Later, the same model should support:
- self-healing
- self-improvement
- automatic tightening of controls

---

## Core Model

### 1. Trust Is Bidirectional

Trust is not one-way.

For any adjacent pair, both sides may assess trust independently.

Examples:
- CTO measures trust in Dev
- Dev measures trust in CTO
- Review measures trust in Implementor
- Implementor measures trust in Review

Why this matters:
- one-sided blame is weak diagnosis
- two-sided trust exposes whether the issue is:
  - weak execution
  - weak review
  - weak contract
  - weak handoff
  - weak expectations

### 2. Trust Is Edge-Based

Trust is held across adjacent edges, not only as one global score per actor.

Why:
- workflows are not purely sequential
- one node may touch several others
- one weak adjacent relationship may matter more than several healthy ones

Example:
an Implementor may depend on:
- Review
- Integrator
- Tester

That means the Implementor sits on several trust edges, not one.

### 3. Trust Lives Inside A Workflow Graph

The real shape underneath is a workflow graph, not a simple chain.

Executive language may still describe a chain such as:
- CEO -> CTO -> Dev

But under the hood, the working structure is graph-shaped:
- several nodes
- several adjacent edges
- several local trust relationships

### 4. Box Trust Is Aggregated Upward

Internally, trust may be detailed and edge-based.

Upward, each box should expose one executive trust status to its parent.

Why:
- the parent should not need to inspect internals to decide
- the box is responsible for governing its own internals
- upward reporting should stay executive

### 5. Aggregation Uses The Weakest Critical Edge

Box trust should not be a simple average.

The proposed rule is:
- the trust level of a box is determined by the weakest critical edge relevant to the active workflow

Why:
- one critical weak edge can make the whole box unsafe to rely on
- this is simple
- this matches fire-and-forget reality better than averaging

---

## Governance Ownership

The trust model should be handled primarily in the governance layer.

Why:
- it must stay lightweight
- it must not become manual bureaucracy
- it should be synthesized from observed behavior, not argued informally after the fact

Proposed high-level ownership split:

- adjacent nodes hold and update their own trust assessment of each other
- governance records, compares, and synthesizes trust signals
- box leadership uses internal trust detail for diagnosis and improvement
- parent boxes see only executive trust state plus required action

Important:
- a box does not self-publish its own trust level upward
- the parent trusts the child based on governed evidence
- the child may separately hold trust in the parent

This preserves bidirectionality while keeping upward reporting honest.

---

## Threshold And Action

The current suggested direction from this session is:

- `9/10` or higher = healthy minimum
- `8/10` = action required now
- below `8/10` = escalation / recovery / improvement is required

This threshold is intentionally high.

Why:
- ADF v2 is trying to be fire-and-forget
- low-trust delegation is directly against that goal

When trust falls below threshold, the model should require action.
At this stage, that action means:

- report upward
- state the problem at the right level
- recommend corrective action

Trust should also influence verification intensity:
- lower-trust boundaries require deeper governed verification before upward certification
- initial implementation should assume governed verification by default until trust is earned

In later stages, the system may evolve toward:
- self-healing
- self-improvement
- automatic tightening of controls
- automatic workflow or contract correction

---

## What Increases Trust

The current direction from this session suggests that trust rises when behavior is:

- coherent
- factual
- predictable
- truthful
- aligned to the agreed contract
- handled at the correct layer without leaking burden upward

Examples:
- a box catches and fixes internal failures before reporting complete
- a box reports problems truthfully instead of hiding them
- a box proactively recommends improvements when a weak pattern is discovered
- a node consistently produces outputs that need little correction

---

## What Decreases Trust

Trust falls when behavior is:

- incoherent
- surprising
- repeatedly wrong in preventable ways
- dependent on supervision
- noisy at handoff boundaries
- not aligned with the agreed contract

Examples:
- repeated preventable mistakes
- repeated review loops to get basic quality
- hidden cleanup discovered after completion claims
- promises made before obvious checks were done
- repeated CEO correction because CTO did not govern tightly enough

The deeper point:
- trust does not fall only when a final outcome fails
- trust can fall when the route becomes unreliable to rely on

---

## Session Evidence

This session itself provided useful evidence for the model.

### Example 1 - Trust can degrade before visible hard failure

The assistant repeatedly:
- froze decisions before approval
- answered before checking docs
- gave too much information when only a decision summary was needed

Even when no code or artifact was broken yet, trust already dropped.

Why this matters:
- the failure appeared first as governance burden
- the CEO had to catch mistakes manually
- this is exactly the kind of hidden non-fire-and-forget behavior the model should expose

### Example 2 - Proper containment preserves higher-level trust

The session clarified an important point:
- Dev may fail
- if CTO catches it, pushes back internally, and reports upward truthfully, CEO trust in CTO can remain high

This shows trust is not the same as “no problems happened.”
Trust is about whether the right layer governed the problem correctly.

### Example 3 - Weak trust helps locate deeper system issues

The discussion also showed that low trust may indicate:
- weak actor
- weak contract
- weak handoff
- weak workflow
- weak governance

This is why trust should not be treated only as a judgment of people.
It is also a system-diagnosis signal.

---

## How The Model Should Be Used

### Executive Use

Executives should see:
- the trust level of their direct assets
- whether the level is healthy or below threshold
- whether action is already underway
- the minimum reason needed for decision

They should not need to inspect internal blame distribution unless escalation requires it.

### Internal Regulation Use

Inside a box, detailed trust should help:
- detect weak edges
- detect repeated friction
- detect weak contracts
- surface problems before they leak upward

### Improvement Use

Trust is not only for escalation.
It should also support:
- identifying weak assets
- identifying weak contracts
- identifying noisy workflows
- prioritizing improvement work

This is the bridge to future self-healing and self-improving behavior.

---

## Relationship To Other Planned Documents

This draft should eventually connect to:

- `DELIVERY-COMPLETION-DEFINITION.md`
  because complete delivery must be trustworthy, not only functionally returned

- `SYSTEM-OBLIGATIONS.md`
  because the system will need rules for recording, surfacing, and acting on trust degradation

- `BOXED-COMPONENT-MODEL.md`
  because trust should likely become part of the obligations and reporting shape of each box

- the later thin top-level governing-entity document and `WORKFLOW-MODEL.md`
  because trust edges are meaningful only across defined roles and workflow relationships

---

## This Document Should Own

To avoid losing trust work between adjacent documents, this document should explicitly own the trust topics that do not belong inside `DELIVERY-COMPLETION-DEFINITION.md`.

This document should own:

- the canonical definition of `trust`
- the canonical definition of `trust level`
- the difference between edge trust, box trust, and any later workflow or chain trust
- trust ownership rules, including who assesses whom, who can see what, and what may go upward versus stay internal
- the aggregation rule for box trust
- trust thresholds and the required action bands
- the principled signal model for what raises and lowers trust

This document should not try to fully own:

- the operational enforcement mechanics, audit pipelines, and runtime truth plumbing of trust
- the component reporting shape that later boxes must expose
- the full workflow-model structure that gives trust edges their concrete runtime topology

Those should be connected from here into later documents rather than left implicit.

---

## Open Questions To Freeze

These are the unresolved items that still need explicit freezing before trust can become a canonical foundation rule.

### 1. What Exactly Is Being Scored

We still need one crisp frozen statement for:

- `trust`
- `trust level`
- the difference between:
  - edge trust
  - box trust
  - chain or workflow trust

### 2. Who Owns Each Trust View

We agreed that trust is not self-published, but we still need the exact rule for:

- who assesses whom
- who can see what
- what goes upward
- what stays internal

### 3. Aggregation Rule

We have the direction:
- weakest critical edge, not average

But we still need to freeze:

- what counts as a critical edge
- whether aggregation is per active workflow or per box overall
- whether inactive edges matter

### 4. Threshold And Required Action

We have the direction:

- `9/10` healthy minimum
- `8/10` action now

But we still need to freeze:

- what action is mandatory at each threshold
- what must be reported upward
- what can be handled internally first
- what escalation or recovery is required below threshold

### 5. What Raises And Lowers Trust

We have examples, but not yet a frozen signal model.

We still need a short principled set for:

- trust-building signals
- trust-degrading signals

### 6. Where Trust Belongs In The System

We still need to freeze exactly how trust connects to:

- `DELIVERY-COMPLETION-DEFINITION.md`
- `SYSTEM-OBLIGATIONS.md`
- `BOXED-COMPONENT-MODEL.md`
- the later thin top-level governing-entity document
- `WORKFLOW-MODEL.md`

### 7. Governance Mechanics

We still need to freeze the high-level operational mechanics for:

- how governance records trust
- how governance compares two-way trust on the same edge
- how often trust updates
- whether trust decays over time
- how trust changes are explained and audited

### 8. Self-Healing And Self-Improvement Progression

We still need to freeze how the model evolves over maturity levels:

- what happens in the early human-governed stage
- what can later become self-healing
- what can later become self-improving
- what still must remain under human approval

These questions should stay here until they are either:
- frozen into trust decisions
- moved into the correct later doc
- or explicitly rejected

---

## Open-Item Placement

To avoid losing gaps between documents, the intended placement is:

- this file holds the unresolved trust-model questions until they are frozen
- `DELIVERY-COMPLETION-DEFINITION.md` should consume only the delivery-boundary trust condition
- `SYSTEM-OBLIGATIONS.md` should later define the operational behavior required when trust changes or drops
- future decision files should be created only when specific trust items are actually frozen

---

## Recommended Next Step

Use this draft as the concept input for a later freeze pass.

That freeze pass should likely:

1. confirm the final definition of trust
2. confirm edge-based and bidirectional trust as foundation rules
3. confirm weakest-critical-edge aggregation for box trust
4. define minimum governance actions when trust drops below threshold
5. connect the frozen model into delivery completion and system obligations

---

## One-Sentence Draft Summary

ADF v2 should treat trust as a lightweight governance signal over adjacent workflow relationships: bidirectional at the edge level, aggregated upward at the box level by the weakest critical edge, and used both to preserve fire-and-forget delegation and to detect deeper system problems early.
