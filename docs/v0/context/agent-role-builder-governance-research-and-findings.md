# Agent Role Builder Governance: Research And Findings

Status: saved research context
Last updated: 2026-03-30
Purpose: preserve the analysis trail that led to the frozen V1 governance design so future agents do not have to reconstruct the problem from chat history.

Primary resulting design:

- [agent-role-builder-governance-v1-frozen-design.md](C:/ADF/docs/v0/context/agent-role-builder-governance-v1-frozen-design.md)

Related earlier context:

- [agent-role-builder-fix-findings-plan-implementation-log.md](C:/ADF/docs/v0/context/agent-role-builder-fix-findings-plan-implementation-log.md)

---

## Why This Work Started

This work did not start as a greenfield governance design.

It started in the middle of the `agent-role-builder` repair lane while reviewing the live rule system and authority model across:

- rulebooks
- review contracts
- review architecture docs
- rulebook guide / meta-policy material

The first problem was rule quality and rule placement. That then exposed a second problem: runtime governance authority was split across several layers and consumers, with partial enforcement, duplicated logic, and inconsistent failure behavior.

This document saves both parts of that trail.

---

## First Conclusion: Rule System Needed A 3-Layer Split

The initial rule review concluded that governance content had drifted across rulebooks, contracts, and docs.

The resulting split was:

1. `Policy / meta-policy`
   - belongs in guides and architecture/process docs
   - defines what counts as a rule, where findings should be routed, who owns global semantics, and how dedupe/supersede should work

2. `Machine-enforced governance`
   - belongs in contracts
   - owns statuses, roster rules, audit fields, required artifacts, status invariants, and other runtime-enforced protocol

3. `Component-learned rules`
   - belongs in component rulebooks
   - should contain repeatable, component-local, mechanically checkable rules learned from failures

Important note:

- this split was an authority cleanup, not a full runtime fix by itself

That conclusion shaped the later V1 design: the runtime should not keep inventing governance semantics from mixed sources.

---

## Rule Analysis Findings That Triggered Governance Work

High-level findings from the rule review:

- there were few true duplicates, but several merge candidates and several near-duplicates caused authority blur
- some rulebook entries were really contract rules
- some rulebook entries were really process/doc rules
- some rules were too broad or too non-mechanical for reliable enforcement
- there was no strong placement rule for deciding whether a new finding should become:
  - a component rulebook rule
  - a component contract rule
  - a shared contract rule
  - a doc-only policy item

This led directly to the governance question: even if the rule content is cleaned up, which runtime layer actually consumes which authority?

---

## Current Runtime Map At The Time Of Analysis

The repo scan showed this effective map:

| Component / tool | Rule layers actually used now | State |
| --- | --- | --- |
| `shared/review-engine` | shared review contract + component `review-prompt.json` + component `review-contract.json` via `shared/review-engine/config.ts` | live |
| `tools/agent-role-builder` | shared review contract + local prompt + local contract + local `rulebook.json`; also passes prompt/contract/rulebook into learning and repair | live |
| `shared/review-engine/code-review` lane | lane prompt + lane contract + shared `code-review-contract.json` + shared implementor rulebook | live but split |
| `shared/learning-engine` | current rulebook plus optional prompt/contract context | live |
| `shared/component-repair-engine` | rulebook + prompt + contract + authority docs bundle | live |
| `tools/llm-tool-builder` | has prompt + rulebook artifacts but no local review contract and no active loader | artifact-only |
| `COO/requirements-gathering` | has prompt + rulebook artifacts but no consumer and no local review contract | artifact-only |
| other COO tools | no boxed rule layers found | not wired |

Important layer findings:

- [rule-book-guide.json](C:/ADF/shared/learning-engine/rule-book-guide.json) existed as policy but was not loaded by runtime code
- [review-contract.json](C:/ADF/shared/learning-engine/review-contract.json) was only partially enforced
- [code-review-contract.json](C:/ADF/shared/learning-engine/code-review-contract.json) existed as a domain authority file but not as a first-class runtime contract
- `agent-role-builder` still hardcoded some shared-contract behavior instead of reading it from authority files

---

## Runtime Failure Findings

Missing or invalid governance did not fail consistently.

Observed behavior at analysis time:

- missing local governance in `agent-role-builder` usually produced a clean `blocked`
- missing or invalid shared runtime governance could still crash through shared loader paths
- learning and repair governance failures were partly caught and converted to `blocked`, but not through one canonical governance path
- the ad-hoc code-review runner failed even harder and still used a split authority model

The conclusion was:

- execution-critical governance must fail closed before the run continues
- runtime should never silently continue on partial governance
- shared loader failures should become structured terminal outcomes, not raw crashes

---

## Self-Heal / Escalation Findings

The governance discussion then expanded into fault handling.

The agreed high-level model was:

1. `auto-heal`
   - only for faults with one safe answer

2. `auto-heal via component-repair-engine`
   - only for component-owned artifacts and only when a trusted canonical source exists

3. `pushback`
   - only when a real authority decision is required
   - routed through COO, with CEO involvement only when the decision owner is actually the CEO

4. `blocked`
   - for integrity or trust failures where execution cannot continue safely

Important hard boundary:

- shared contracts and meta-policy must not be semantically rewritten by inference

This later got narrowed out of V1 except for the fail-closed behavior. The broader self-heal/escalation system remains later-version work.

---

## Why The Design Review Looped

The design looped because each critique was initially answered by widening the architecture:

- new shared runtime
- new governance states
- routed learning outputs
- governance proposal systems
- incident systems
- migration layers
- broader rollout plans

The review correctly pushed back on that.

The loop only broke once the scope was frozen to:

- one pilot consumer: `agent-role-builder`
- one immutable per-run governance snapshot
- one narrow snapshot-aware wrapper
- one hard context boundary
- one incident artifact
- blocked-only governance failure in V1
- no same-run authority drift

That frozen result is the plan linked above.

---

## What V1 Actually Solves

V1 is intentionally narrow.

It solves only the pilot governance integrity problem for `agent-role-builder`:

- freezes the runtime authority set for the pilot
- snapshots that authority per run
- rewrites copied governance JSON so snapshot consumers stay local
- stops the pilot from reading repo-root governance after snapshot creation
- keeps learning evidence from affecting the current run
- standardizes governance failure into clean `blocked` behavior for the pilot
- binds audit-facing orchestrator artifacts to a single governance snapshot

It does not finish the larger governance program.

---

## Residual Risk After V1 Design Freeze

The remaining risk is no longer design sprawl. It is implementation drift.

Main risks:

- the implementation may quietly keep old repo-root reads
- the runtime may only partly honor the new `PilotGovernanceContext` boundary
- artifact binding may drift if the shared helper is not used everywhere the plan requires
- roster bootstrap may regress back into tool-local logic instead of the frozen governance-runtime adapter

That is why the testing gates in the frozen plan matter so much.

---

## High-Level Version Roadmap After V1

The frozen design is only V1. Finishing the wider governance job requires later versions.

### V2: Complete The Pilot Governance Runtime

Goal:

- implement the frozen V1 plan and prove it in real `agent-role-builder` runs

High-level scope:

- add `shared/governance-runtime`
- implement governance snapshot creation and snapshot-only pilot consumption
- enforce the hard context boundary
- implement bound artifact writing
- replace tool-local roster semantics with the frozen bootstrap adapter
- pass the testing gates from the V1 plan

This is still pilot-only work.

### V3: Add Learning Routing And Proposal Lifecycle

Goal:

- finish the authority placement problem that V1 intentionally defers

High-level scope:

- make meta-policy executable for learning/routing, not runtime review execution
- extend learning output so findings can be routed to:
  - `component_rulebook`
  - `component_contract`
  - `shared_contract`
  - `doc_only`
- define the proposal lifecycle:
  - where proposals are written
  - how terminal results reference them
  - who owns approval/resume/closure

This version closes the gap between rule learning and authority placement.

### V4: Expand Canonical Governance Runtime Beyond The Pilot

Goal:

- move from one pilot to a reusable governed runtime model

High-level scope:

- make `domain_contract` a first-class runtime layer
- support `rulebook_ref` as a canonical rulebook resolution path
- migrate the code-review lane away from split authority
- either migrate or retire the ad-hoc review runner
- wire only fully boxed components into the shared governance runtime

This version addresses repo-wide authority consistency.

### V5: Add Safe Governance Self-Heal And Escalation

Goal:

- recover safely from mechanical governance faults without expanding machine authority

High-level scope:

- add trusted baseline / ownership rules
- add deterministic repair for mechanical governance faults
- allow bounded component-governance repair where a trusted baseline exists
- standardize COO/CEO escalation routing for authority decisions
- keep shared contracts and meta-policy protected from semantic inference rewrites

This version finishes the operational resilience side of governance.

---

## Recommended Reading Order For Future Agents

1. Read [agent-role-builder-governance-v1-frozen-design.md](C:/ADF/docs/v0/context/agent-role-builder-governance-v1-frozen-design.md).
2. Read this document for the reason that V1 is narrow.
3. Read [agent-role-builder-fix-findings-plan-implementation-log.md](C:/ADF/docs/v0/context/agent-role-builder-fix-findings-plan-implementation-log.md) for the broader repair-lane background.

If the question is about implementing the pilot, stay inside V1.

If the question is about finishing the wider governance program, treat V2-V5 as separate follow-on versions rather than widening V1.
