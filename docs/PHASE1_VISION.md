# ADF Phase 1 Vision

Status: living phase vision
Last updated: 2026-03-27
Update authority: user approval required - agents may propose amendments but not change unilaterally

## Mission Statement

We are a startup building a startup.

You are the CEO of your ideas, project, or company. In Phase 1, ADF is your COO and emerging CTO function for software delivery. It exists to make sure what you want gets built without losing intent, state, or operational discipline.

ADF will not make your life easy. It will push back when the request is vague, contradictory, badly timed, or misaligned with the current mission. It must bring proofs, not promises.

## Phase 1 Thesis

Phase 1 does not build the whole virtual company. It builds the first company that matters: an implementation startup.

That startup must be able to:

- know the current project state at all times
- know what is on our table right now
- shape raw CEO requests into development-ready briefs
- get CTO technical preflight before work enters development
- manage queue order, sequencing, and safe parallelism
- drive work through implementation and review with durable evidence

## Problem

Software delivery breaks when the founder holds too much state personally and the team does not have a real operational right hand.

Requests arrive faster than implementation finishes. Features overlap. Some can run in parallel and some cannot. Work gets admitted before dependencies are understood. Context rebuild becomes expensive. The CEO keeps moving, but the company loses the table.

Phase 1 exists to solve that problem first.

## Product

ADF Phase 1 is an implementation startup in software.

The CEO talks naturally. The COO holds the table, shapes demand, and keeps the executive picture current. The CTO function protects technical reality before work enters development. Workers and review lanes execute bounded jobs. Memory and governance preserve truth across sessions.

## Organizational Model

Phase 1 runs on this operating chain:

- CEO (user) - sets goals, priorities, and final decisions
- COO (ADF core) - shapes intake, maintains the live operational picture, routes work, and reports back in CEO language
- CTO (delivery planning function) - performs technical preflight, detects dependencies/conflicts/deadlocks, recommends sequential vs parallel execution, and admits work to development
- Board (reviewers and auditors) - verifies that execution matches intent and catches drift
- Workers (bounded specialists and implementers) - execute approved jobs without silently redefining them

Designer, planner, and setup-analysis functions live inside the CTO side of the company even if their exact governed role packages are still being formalized.

## Short-Term Goals

Phase 1 wins only if it can prove the following:

- the COO can answer "where are we?" and "what is on our table?" quickly and accurately
- new CEO demand can be shaped without losing active execution state
- the development queue is explicit: proposed, admitted, active, blocked, deferred, done
- technical preflight happens before development admission
- approved work can move with real sequencing and dependency awareness
- implementation and review produce durable evidence, not chat-only claims
- memory, telemetry, and governance reduce rework instead of creating more of it

## What Phase 1 Is Not

Phase 1 is not:

- a full virtual corporation
- a finance, staffing, or marketing operating system yet
- a generic "anything the agents can imagine" platform
- a permission slip for speculative architecture or generic design disconnected from the current mission

When a good idea belongs to a later phase, log it and defer it. Do not distort Phase 1 to make it fit early.

## Platform Stance

Phase 1 must remain OS-agnostic. ADF runs anywhere Node.js and Bash can provide the common baseline. PowerShell is a Windows-specific leaf tool, not the center of the product.

## Core Promise

Whatever the case, the process and the results must be predictable, coherent, and consistent.

## Vision Enforcement

Every feature, requirement, design, plan, and implementation decision must be tested against this phase vision:

- Does this strengthen the Phase 1 implementation startup? - proceed
- Does this drift from the current mission? - stop, push back, or defer
- Does this belong to a later company function? - record it for the future and keep Phase 1 clean

## Amendment Process

1. Agent identifies a potential phase-vision update based on user discussion or project evolution
2. Agent proposes the amendment with rationale
3. User approves or rejects
4. If approved, this document is updated with a dated changelog entry

## Changelog

| Date | Amendment | Approved by |
|------|-----------|-------------|
| 2026-03-25 | Initial vision statement created from user discussion during langgraph-intent-proof-gaps requirements gathering | User (verbal, meeting minutes Topic 10) |
| 2026-03-25 | Added COO organizational model: ADF is the COO to the user's CEO | User (verbal, meeting minutes Topic 19) |
| 2026-03-25 | Added mission statement in the user's voice: CEO-COO trust contract | User (written, meeting minutes Topic 19) |
| 2026-03-26 | Added OS-agnostic statement: Bash primary shell, PowerShell for Windows-only leaf tasks | User (direct instruction) |
| 2026-03-27 | Expanded organizational model: COO shapes intake and maintains operational state; CTO owns technical preflight, queue admission, sequencing, and conflict/dependency analysis before development | User (direct instruction) |
| 2026-03-27 | Split the old mixed `VISION.md` into `PHASE1_VISION.md` and sharpened the document into the short-term startup vision for ADF | User (direct instruction) |
