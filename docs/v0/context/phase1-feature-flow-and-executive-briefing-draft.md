# Phase 1 Feature Flow and Executive Briefing Draft

Status: draft discussion record
Last updated: 2026-03-28
Purpose: capture the current high-level Phase 1 decisions discussed with the user so a contextless agent can resume without reconstructing the conversation.

---

## Why This Draft Exists

This document captures the current agreed direction for:

- what Phase 1 company scope is
- what the first supported work type is
- what the high-level feature lifecycle is
- how queue ownership should work between CEO, COO, and CTO
- how pushback and CEO alerts should behave
- how the CEO-facing executive briefing should work

This is not yet a final governed spec.

All decisions here should be treated as **draft high-level decisions** until the actual workflows, contracts, and governance surfaces are implemented and revised against runtime reality.

---

## Phase 1 Company Scope

### Agreed direction

Phase 1 is focused on **implementation**.

The first and most important supported work type is **feature delivery**.

This is intentionally close to the ProjectBrain flow, but with stronger governance in ADF.

The goal of Phase 1 is:

- turn vague feature ideas into high-quality production implementation
- do it through governed phase boundaries
- add learning loops at every step
- preserve company state so the CEO does not have to hold it all manually

### Not the goal of Phase 1

Phase 1 is not trying to become the full virtual company yet.

Later capabilities such as finance, broader staffing, marketing, lighter effort modes, bugfix-first flows, task flows, and research flows are understood as **later master-plan versions** or later sub-phases, not the current foundation.

---

## Phase 1 Golden Path For Features

The current intended feature lifecycle is:

`requirements gathering -> review cycle -> design -> review cycle -> planning -> review cycle -> setup analysis -> review cycle -> implementation -> review cycle -> finalization -> postmortem`

### Important note

This order is still **draft high-level direction**.

However, one best-practice decision has now been chosen:

- `finalization -> postmortem` is intentional

Reasoning:

- finalization should close the operational delivery and handoff path
- postmortem should happen after the full outcome is known
- learning should be based on the actual completed run, not a partial pre-close snapshot

### CEO completion view

From the CEO's point of view, a feature is not truly complete after finalization alone.

The feature should be treated as truly complete only **after postmortem**.

That CEO-facing completion closeout should include:

- result
- short implementation-run summary
- improvements and learnings

The current intended CEO-facing postmortem closeout should cover:

#### 1. Result

Clear business outcome such as:

- done
- failed
- partial
- completed with errors

#### 2. Run summary

A short business-level summary of the run, for example:

- time
- tokens / cost / effort
- blockers
- major friction points

#### 3. Improvements

What the company learned from the run, for example:

- what improved compared with prior runs
- what degraded
- what needs watching
- where the company became more efficient

Example direction from discussion:

- a previous implementation needed 7 review cycles
- this run needed 4
- therefore the company improved

For now, the important thing is:

- every meaningful phase has its own workflow
- every meaningful phase has a review gate
- learning can be captured from both phase work and phase review failure
- the feature should not be treated as truly complete until postmortem is captured

---

## How Feature Intake Starts

### CEO starting point

The user starts high level by default.

The CEO is not expected to provide technical details unless they want to.

ADF should guide the CEO through questions, reflection, and clarification to understand what the CEO actually wants.

### ADF must extract at least 3 things

For a feature, ADF must determine:

#### A. Feature goal

Example:

- add a dashboard to the project to track open tickets

#### B. High-level requirements list

Example:

- list of tickets and their status
- ticket history
- actions such as open new, close, clarification needed
- audit trail including who opened the ticket, why, and when

#### C. Expected results

Example:

- a URL to test implementation
- all features implemented and testable through the UI

### UI handling rule

If the feature involves UI, whether new UI or changes to existing UI, ADF should create a mockup.

That mockup may be:

- static
- interactive

The choice depends on the feature.

ADF should provide something the CEO can run or review locally and then iterate with the CEO until ADF and the CEO are clearly aligned.

The intent is:

- use the mockup to reduce ambiguity early
- freeze UI understanding before later stages harden

---

## Requirements Acceptance Model

### High-level acceptance loop

When ADF believes it has enough high-level information, it should present a high-level summary to the CEO.

At minimum, that summary should include:

- goal
- features / high-level requirements
- expected results
- approved UI direction when UI is part of the feature

If the CEO pushes back, the requirement-gathering process repeats until acceptance is reached.

### Detailed requirement artifact

After high-level acceptance, ADF creates a more detailed requirements artifact that includes:

- high-level requirements
- low-level requirements compatible with ADF contracts and later phases

That requirement artifact then passes through governed review before it moves downstream.

Current discussion direction:

- the requirement list passes through 2 agents' reviews before being passed to the designer process

This specific review shape should still be treated as **draft until implemented**.

---

## Learning Loops

Learning is not only a final postmortem concern.

The current agreed direction is:

- both requirement gathering and review should identify root causes of failure
- phases should ask why a review failed or why an artifact was not good enough
- ADF should improve future behavior from those lessons

The intent is:

- repeated pitfalls become explicit rules, checks, or guidance
- agents should self-check against those learned rules before passing artifacts forward

### KPI ownership

The COO should think about which KPIs the company needs in order to show:

- improvement
- degradation
- cost
- effort
- recurring friction

Current draft ownership model:

- the COO defines the initial `v1` KPI set
- the CTO may add CTO-side KPIs for implementation management
- the CEO sees the reporting and may add, remove, or reshape KPIs based on preference

### Important governance note

The exact promotion path for rules is still open.

Later implementation must still freeze:

- whether rules are auto-applied
- whether they are proposed first
- whether they mature from lesson -> convention -> rule

For now, only the **high-level intent** is agreed:

- ADF must learn from failure at each stage

---

## CTO Role In Phase 1

### Agreed direction

The CTO's main high-level job in this part of Phase 1 is to manage the path from accepted feature to actual implementation execution.

That includes:

- queue awareness
- ordering recommendation
- later parallel execution management

The CTO should help decide whether one feature should move before another, even if it entered later.

### Planned maturity path

Current intended maturity order:

1. `FIFO`
2. `priority review`, approved by the CEO
3. `parallel feature implementation`, including priority review when needed

This is intentionally staged so the full company chain works end-to-end before optimization gets more sophisticated.

---

## Queue Entry And Ownership

### Important terminology correction from discussion

There was a term mismatch during discussion.

The user's intent is:

- from the **CEO perspective**, a feature enters the company's implementation ownership as soon as requirements are accepted and frozen
- from the **technical/internal perspective**, actual coding should still wait until the appropriate downstream technical stages are complete

### Draft decision

#### CEO-facing meaning

After requirements acceptance / freeze:

- the feature is off the CEO's head
- the company now owns it
- the COO tracks it
- the CTO receives it for downstream progression

From the CEO's point of view, the feature is now "under implementation" in the broad business sense.

#### Internal meaning

The company should still preserve a separate internal distinction between:

- broad implementation ownership
- actual build / coding readiness

The exact internal state machine is not yet frozen here because the discussion shifted toward the CEO-facing executive model.

### Draft high-level queue decision

For now, the safest wording is:

- **feature enters company ownership after requirements freeze**
- **CTO then manages downstream movement through design, planning, setup-analysis, and later actual build execution**

This should be treated as the current **draft high-level queue decision**.

---

## Pushback And CEO Alerts

### Why this matters

The user explicitly pointed out a key human reality:

- once the CEO hands something off, they mentally unload it
- if the company silently stalls or rejects it, the CEO may incorrectly assume it is moving or done

Because of that, a rejected or blocked feature must not silently disappear inside the company.

### Draft decision

If a feature becomes blocked by missing CEO decision, rejection, or unresolved pushback:

- it becomes an **urgent CEO alert by default**

This applies to failure or pushback from any phase.

### Ownership model

Current draft direction:

- the workflow writes durable state
- the COO owns surfacing the issue to the CEO

### Timing model

Current draft direction:

- if the issue appears during an active session, surface it immediately
- if it appears in the background, surface it at the next CEO interaction before normal business

### No silent stall rule

This principle is effectively agreed:

**No silent feature stall.**

If a handed-off feature cannot continue, the CEO must be informed promptly and explicitly.

### CEO response options

Current draft decision:

When alerted, the CEO can:

- address the issue now
- defer it

More detailed response options can be added later if needed.

### Alert persistence

Current draft decision:

- alerts should persist until explicitly resolved or deferred

Because the CEO is notified immediately, the system should not silently drop them after one mention.

### Resume after pushback

Current draft direction:

- resume behavior should be based on the ProjectBrain model and the referenced Claude discussion (`fe414e1e-ec03-430b-ad0c-05662a3f4fda`)

This needs to be re-frozen later when the real implementation and workflow contracts are written.

---

## CEO-Facing Model: Not A State Machine

One important correction emerged during discussion:

The CEO-facing layer should **not** be modeled as a workflow state machine.

The CEO does not care how the CTO runs the internal team unless there is a problem.

The CEO does not want operational noise by default.

The CEO mainly cares about:

1. fixing problems in the company
2. driving the company forward

Everything else is background unless asked.

---

## Executive Briefing Model

The agreed direction is that the CEO-facing layer is an **executive attention model**.

Example interaction:

- CEO comes in the morning and says: `Talk to me.`
- COO gives a compact current snapshot
- CEO decides what needs focus, what the priorities are, and how the day should look

The CEO may also implicitly mean:

- how my day is likely to look
- what needs my focus
- what is next

### Draft executive briefing sections

#### 1. Issues That Need Your Attention

This section contains:

- urgent decisions
- blocked features
- missing clarifications
- any feature stall that requires CEO attention

This is the highest-priority section.

Important communication rule:

- issue descriptions must be concrete and executive-usable
- avoid internal shorthand or vague labels that force the CEO to decode the problem

Bad example:

- `The boiling eggs crisis`

Good example:

- `Boiling eggs is blocked. Throughput is too low. I need you to decide its priority and how many resources you want dedicated to it. Current allocation is XXXX.`

#### 2. On The Table

This section contains:

- items currently being shaped or discussed
- important open items
- summary of backlog volume rather than a raw dump

The CEO can ask for more detail if desired, but default behavior should be compression.

#### 3. In Motion

This is the current best high-level replacement for terms like "under construction."

This section contains:

- what the company is actively working on now

It should stay business-level and concise.

#### 4. What's Next

The COO should also provide a very short forward frame.

Current draft direction:

- 1 to 2 items maximum
- focus frame only
- not a long roadmap

The intent is to support the CEO's short attention span and let the COO help set today's direction without overwhelming the CEO.

### Behavioral rule

By default:

- compress
- do not enumerate everything
- reveal detail only when asked or when a problem requires it
- keep the forward-looking frame to 1-2 items maximum

### Brief style adaptation

The COO should not stay a fixed reporting robot.

Current draft direction:

- executive briefs and CEO responses should be saved in the memory engine
- periodically, for example every 5 briefs, a background process should analyze the COO brief and the CEO response
- the goal is to learn the CEO's briefing preferences and adapt over time

This is considered critical to the COO role.

### Future feature: brief level

Current requested future capability:

- `focused`
- `balanced`
- `detailed`

This should become a user-settable briefing style later.

For now, the default expected style is closest to:

- `focused`

---

## What Is Agreed Enough To Derive Other Docs

The current discussion is strong enough to support:

- long-range vision wording
- Phase 1 vision wording
- Phase 1 master-plan wording
- high-level COO/CTO company model
- Phase 1 feature-flow framing
- executive briefing framing

It is **not yet enough** to safely derive all workflow contracts and governance specs in detail.

Those still require later freezing against implementation reality.

---

## Still Open Or Only Partially Frozen

These points remain open or draft-only:

- exact per-phase workflow contracts
- exact review depth and board shape per phase
- exact rule-promotion authority path
- exact internal operational state model beneath the CEO-facing brief
- exact resume semantics after pushback across all phases
- exact CEO approval boundaries between phases
- exact git/branch/merge governance for implementation execution
- effort modes such as production vs ad-hoc and how they affect phase intensity

---

## Practical Working Summary

If a contextless agent needs the current practical understanding in one block, use this:

- Phase 1 is an implementation-focused startup.
- Features are the first supported work type.
- The feature path is governed phase-by-phase, with review between meaningful stages.
- ADF starts from vague user intent and must extract goal, high-level requirements, expected results, and UI direction when relevant.
- If UI is involved, mockups are part of alignment before later phases harden.
- Requirements acceptance is a real company handoff point.
- After requirements freeze, the feature is off the CEO's head and owned by the company.
- The CTO then manages downstream progression and later actual implementation readiness.
- Any rejected or blocked feature is an urgent CEO alert by default.
- No silent feature stall is allowed.
- The CEO-facing interface is not a state dump; it is an executive brief.
- The executive brief should center on:
- Issues That Need Your Attention
- On The Table
- In Motion
- What's Next
- Issue descriptions must be concrete and tell the CEO what failed and what decision or attention is needed.
- The forward-looking frame should be capped at 1-2 items.
- Briefs should eventually be learned and personalized from memory-engine analysis of repeated COO-CEO briefing interactions.
- A feature is truly complete for the CEO only after postmortem.
- That completion closeout should include result, run summary, and improvements.
- The COO defines the initial `v1` KPI set, the CTO may add delivery KPIs, and the CEO may reshape the KPI view by preference.

---

## Draft Authority Note

This document records current discussion truth only.

It should be treated as:

- detailed enough for context recovery
- not yet a final governed authority document
- expected to be revised when the actual implementation contracts are designed
