# Context Cache Layer Ideas

Status: discussion notes
Last updated: 2026-03-27
Purpose: preserve the high-level discussion about context loading, cache layering, COO responsibilities, and the proposed `get-context` capability so a fresh agent can resume without re-deriving the design.

---

## Why This Discussion Started

The current ADF architecture has a context engineer and a Brain-backed memory engine, but there is no stable, shared, production-grade `get-context` contract that every agent and tool can call for immediate project-state restoration.

This gap showed up in practice:

- A fresh agent needed manual direction about what to read.
- Context gathering was slow and resource-expensive.
- Different sources are only partially implemented today.
- The current approach does not yet guarantee that every agent spin-up gets the same "what is happening now?" frame.

The CEO explicitly wants a production-level solution rather than repeating manual context-gathering instructions on each new spin-up.

---

## Current Architectural Baseline

The repo already points to the right integration point:

- `docs/v0/memory_stack_strategy.md`
  - three-tier memory engine
  - context engineer as the integration point
- `docs/v0/architecture.md`
  - controller is a stateless reducer
  - continuity comes from externalized state
  - controller should load current state and retrieve scoped context
- current code:
  - `COO/context-engineer/context-engineer.ts`
  - `COO/controller/loop.ts`
  - `COO/controller/memory-engine-client.ts`

But the existing implementation is still primitive:

- there is context assembly logic
- there is Brain MCP access
- there is no formal context service contract
- there is no dedicated context cache/service layer
- there is no universal fast path for agent/tool startup

---

## CEO Problem Statement

The COO must always know:

1. the real project state
2. what open items exist
3. what is being developed right now
4. the gap between production and development reality
5. most importantly: **what is currently on our table**

This is not a convenience feature. It is core COO behavior.

The CEO framed the COO role from real-company first principles:

- the CEO does not track every operational detail
- the COO does
- the COO is the right hand of the CEO
- the COO is the connection layer between CEO and execution
- the COO does not personally perform all work
- the COO keeps the company state coherent, routes work, and ensures nothing important falls through

Organizational chain:

`CEO <-> COO <-> departments <-> workers`

The software equivalent should preserve that model.

Additional refinement from later discussion:

- the COO must also know the queue state, not only active execution state
- some requested work is only proposed
- some work is shaped and waiting for CTO technical preflight
- some items can run in parallel
- some must be sequential
- some conflict with or negate other queued/active work
- the CEO should not have to manage those technical interactions manually

Therefore, "what is on our table" includes both active execution and pending/admission-state work.

---

## High-Level Goal Of The Proposed Capability

Create a **fast, shared context service** that gives the COO and any delegated agent/tool immediate access to the current operational frame without requiring full manual repo + git + memory + artifact rediscovery each time.

This should serve two purposes:

1. startup / spin-up recovery
2. steady-state "what is on our table?" awareness

The service should behave like a production capability of the memory engine, not a one-off script or an informal prompt ritual.

---

## Early Tool Shape Proposed In Discussion

An early proposed output shape was:

- `where_we_are`
- `why_we_believe_that`
- `active_decisions`
- `open_loops`
- `next_steps`
- `confidence_and_gaps`

This was later corrected:

These are useful **derived outputs**, but they should not be the primary cached artifact.

Instead, the cache should store deterministic underlying state and evidence pointers, and derive these narrative fields from that state.

---

## What Should Actually Be Cached

Do not primarily cache prose summaries.

Cache deterministic primitives such as:

- thread/session summary
- proposed work summary
- queue admission state
- CTO preflight outcomes
- active open loops
- locked decisions/rules relevant to the scope
- daily residue snapshot if present
- active work summaries
- source freshness and dirty-state markers
- evidence pointers:
  - thread ids
  - memory ids
  - decision ids
  - artifact paths
  - timestamps

Then derive:

- `where_we_are`
- `why_we_believe_that`
- `next_steps`
- `confidence_and_gaps`

Rationale:

- deterministic state is more stable to cache
- summaries can become stale or opinionated
- evidence-backed derivation is safer than caching narrative claims

---

## Cache Layering Direction

The CEO agreed with layering, but refined it:

### Hot / short-term cache

This should cache current-session / current-scope operational context, for example:

- what did we decide about X in this session?
- what are the current open loops?
- what is active right now?
- what is on our table?

This is the fast path.

### Cold / long-memory retrieval

This should not be pre-cached broadly.

Examples:

- what topics did we discuss last week?
- what did we ever decide about X?
- historical exploration across older sessions

This should use search/retrieval on demand.

Conclusion:

- short-term operational memory: cache
- long-term exploratory memory: search

This means the context system is primarily about **current operational state**, not full historical recall.

---

## Base Cache + Overlay Model

The discussion converged on a 2-layer model:

### 1. Base context cache

Fast, precomputed, shared, scope-aware.

Contains stable operational context such as:

- proposed work
- admitted queue
- active work
- blocked work
- CTO preflight recommendations
- active/open work
- locked rules
- current decisions in force
- current thread/session state
- daily residue if present
- freshness and missing-source indicators

### 2. Query overlay

Small live retrieval on top of the base cache.

Used for topic-specific questions such as:

- "what did we decide about provenance?"
- "load context about memory engine"

This keeps the system fast while still allowing focused live retrieval.

---

## Dirty State And Refresh Strategy

Initial idea: refresh cache every time the memory engine is called.

Refinement from discussion:

- reads should generally not force recompute
- writes and meaningful state changes should invalidate or patch cache

Likely invalidation triggers:

- memory create/update/delete/archive
- open-loop create/update/close
- rule/decision/convention change
- thread commit / summary change
- prompt change
- daily residue change
- session closeout / handoff closeout

Recommended behavior:

- stale-while-revalidate
- immediate cached return if acceptable
- async background refresh after invalidation
- explicit fresh mode when a caller truly needs it

---

## Background Process Requirement

The CEO suggested the cache should refresh while:

- the controller is idle, waiting for user input
- a process is already running
- the COO is thinking on a response and already loaded context

Agreed high-level direction:

- this should be a **background capability**
- it should belong to the **memory engine**
- it should keep context warm for future callers

Important framing:

- not a controller-local trick
- not a one-off per-agent implementation
- a reusable shared service that other tools and agents consume

---

## No Existing Shared Context Contract

This was identified as a core problem.

The CEO explicitly noted two symptoms:

1. there is no existing contract to load context, so manual direction is needed on each agent spin-up
2. the context gathering effort was expensive in both time and resources

This is why the discussion moved from "improve startup prompts" to "create a production-grade context service."

---

## LLM Boundary

The CEO added an important architectural rule:

If a tool requires an LLM to decipher user intent or route natural-language requests, it must be built through `llm-tool-builder`.

This led to a split:

### Deterministic side

TypeScript / memory-engine APIs only.

Examples:

- `get_context`
- `get_context_status`
- `refresh_context`
- `invalidate_context`

Fast, deterministic, shared, non-LLM.

### Thin LLM side

Natural-language interpretation and routing only.

Examples:

- understand "catch me up"
- decide whether the user wants:
  - current operational context
  - topic-specific overlay
  - historical search
- translate NL into deterministic API calls

This LLM layer is complementary, not the main implementation.

---

## Tool Decomposition Principle

The CEO explicitly wants:

- deterministic fast operations for most actions
- a thin, slower interpretation layer only when needed

In other words:

- the tool is **LLM-complementary**
- not LLM-dependent for the core work

This is aligned with the broader ADF direction:

- most software should be deterministic
- model calls should sit at the interpretation/reasoning boundary
- core operational state management should stay in typed code

---

## Relation To Step 2 And Step 3

Question raised:

If Step 2 is still being implemented, what can proceed in parallel?

Working conclusion:

- a context service should be treated as a **parallel Step 3 lane**
- not as a random side tool
- and not as a replacement for Step 2

Suggested high-level sequencing:

### Step 3a

Define the context-service contract at a high level:

- scope
- cached primitives
- hot vs cold responsibilities
- dirty/freshness model
- background refresh model
- consumer profiles

### Step 3b

Implement deterministic memory-engine context service.

### Step 3c

Integrate controller and agents with the context service.

### Step 3d

Add thin LLM routing layer if needed, via `llm-tool-builder`.

Important:

The deterministic service can be defined in parallel with ongoing Step 2 work, provided the write scope is isolated.

---

## Partial Sources Reality

The discussion also recognized that not all intended context sources fully exist yet.

Current reality in ADF:

- some thread/context infrastructure exists
- memory engine exists
- Brain MCP exists
- AGENTS routing exists
- full file-layer memory-stack import is incomplete
- `MEMORY.md` and `PARA.md` are not present in current ADF repo
- daily residue is only partially real today
- imported/searchable Brain coverage is still incomplete for some architecture topics

Therefore the context service must support **partial mode**:

- use available sources
- mark missing sources explicitly
- do not block because a noncritical layer is absent

This applies to queue intelligence as well:

- before a full CTO queue/admission component exists, the context system may only expose partial queue state
- it must still distinguish between known facts and missing technical judgment

---

## First-Principles Reframe Introduced By CEO

The discussion shifted from "context loading tool" to a first-principles question:

What is the COO's job?
What is the best-performing COO that a CEO would want?

The CEO stressed:

- the COO is not a generic assistant
- the COO is not merely a chat agent with memory
- the COO is the operational right hand of the CEO
- the COO always knows what is happening in the company
- the COO always knows what is currently on the table
- the COO coordinates departments and workers instead of personally doing all work
- the COO should shape requests, but technical admission into development needs CTO judgment

This reframing matters because the context service is not just a convenience for startup.

It is a core mechanism that allows the COO to fulfill the real COO function:

- state awareness
- operational continuity
- prioritization
- delegation readiness
- executive reporting

---

## Documents Read Or Requested For This Reframe

For grounding the first-principles discussion, the following were explicitly read or requested:

### In current ADF repo

- `docs/VISION.md`

### In ProjectBrain legacy COO materials

- `C:\ProjectBrain\ADF\COO\ADF-ROLE.md`
- `C:\ProjectBrain\ADF\COO\CONTEXT-LOADER.md`
- `C:\ProjectBrain\ADF\COO\guides\coo-rules.md`

### In redesign materials

- `C:\ProjectBrain\prompts\coo_redesign_pack\README-FIRST.md`
- `C:\ProjectBrain\prompts\coo_redesign_pack\coo_rebuild_spec.md`

Why these matter:

- they show the older COO intent
- they expose old context-loading assumptions
- they show where the redesign already tried to move toward a cleaner, end-weighted bootstrap and executive-summary model

---

## Key Legacy Signals Relevant To This Discussion

From the older COO materials and redesign pack:

- COO is the CEO's right hand, not a task worker
- COO must maintain context continuity and project awareness
- bootstrap should end with an executive brief, not start with noisy startup chatter
- "what is currently on the table" is a core briefing need
- the old context loader was procedural and manually enumerated, which does not scale
- the redesign already pushed toward:
  - thin bootstrap
  - better current-context restoration
  - curated executive summary rather than brute-force dumps

This supports the new direction:

- replace ad hoc context restoration with a real context service
- optimize for executive operational awareness

---

## Open Design Questions Preserved For Follow-Up

1. What exactly counts as the minimal operational frame the COO must always hold?
2. What should the cache key be?
   - thread?
   - scope?
   - role/profile?
   - user/session?
3. Which data belongs in hot cache versus cold retrieval?
4. What are the authoritative invalidation triggers?
5. Should context cache store structured facts only, or also stable derived summaries?
6. What exact deterministic API surface should exist?
7. Should a "catch up" NL command be implemented immediately, or only after the deterministic service is in place?
8. How should controller idle time or long-running task time be used for background refresh without creating race/confusion?
9. Which part belongs to memory engine versus controller versus future context-specific component?
10. What is the best production framing:
    - "get-context tool"
    - "context service"
    - "operational state service"
    - something more aligned with COO semantics?
11. How should proposed work, admitted queue, blocked queue, and active execution be represented distinctly?
12. What exact contract should exist between COO intake-shaping and CTO technical preflight before work enters development?

---

## Working High-Level Conclusion So Far

The discussion has not yet finalized implementation details, but the high-level direction is:

- ADF needs a fast, shared, production-grade context capability.
- This capability should be based on cached deterministic operational state, not cached prose.
- It should optimize for current operational awareness, not full historical recall.
- That operational awareness must include queue/admission state, not only current execution state.
- The service should eventually reflect the long-range company vision while staying tightly aligned with the current Phase 1 mission.
- Long-memory exploration should remain search-driven.
- The deterministic API should live in the memory engine.
- A thin LLM routing layer may sit on top when natural-language interpretation is needed.
- This should be treated as a major Step 3 lane, not as an incidental helper.
- The design must start from the real-world COO job: keeping the CEO continuously aware of what matters now through reliable operational state, delegation, and executive framing.
