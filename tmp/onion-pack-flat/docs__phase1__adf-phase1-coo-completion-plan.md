# ADF Phase 1 COO Completion Plan

Date: 2026-03-31
Status: working replacement plan
Purpose: preserve the current recommended path for turning the COO into a solid, mature Phase 1 component without depending on the chat thread.

Update: 2026-04-01

Independent post-stabilization code review and audit confirmed that the COO is now runnable, but still not management-trustworthy.

Current critical path:

- add explicit end-to-end COO scope
- make memory-operation results and created IDs truthfully restorable in thread evidence
- stop unscoped retrieval and silent mis-scoped writes

Current decision:

- do not restart architecture
- do not move to onion implementation yet
- complete one more focused COO stabilization slice:
  - scope propagation
  - truthful write-result capture
  - scoped retrieval
  - governance surface honesty

Update: 2026-04-01 (later)

The focused stabilization slice above has now been implemented across the controller, client wrappers, memory-engine schemas, query layer, and storage migrations.

Implemented in this slice:

- scoped COO reads now fail closed on the normal runtime surfaces
- hidden COO recall now pushes trust/type policy into the search contract instead of filtering after truncation
- explicit memory-operation receipts now cover missing-scope search failures as well as write operations
- governance actions now require scope and action-specific inputs at the contract layer
- `memory_manage` now returns truthful receipts based on affected rows instead of reporting blind success
- telemetry is now treated as a required controller runtime dependency for supported COO entrypoints
- provenance provider drift is reduced, and embedding provenance is now richer for new writes

Current status after this slice:

- the COO is materially more honest and production-shaped than before
- the most serious scoped-memory/controller truthfulness issues are closed
- the remaining gaps are now mostly:
  - historical provenance quality
  - proving telemetry on a real supported run
  - end-to-end recovery evidence from a real COO conversation

Update: 2026-04-01 (route hardening)

The next review round found that some remaining problems were route-level, not endpoint-level. That slice is now closed as well.

Closed in the route-hardening slice:

- the decision logging route now persists successfully through the live SQL path
- `memory_manage` now enforces exact scope on the mutation route and returns truthful receipts from one transaction boundary
- normal COO classifier workflow contracts no longer advertise non-live `tool_path` / `specialist_path` routes
- telemetry batching now requeues on sink failure instead of dropping evidence immediately
- supported memory-engine tool routes now emit direct route telemetry instead of leaving most memory activity invisible

Current remaining gaps after route hardening:

- historical provenance is still dominated by legacy sentinel rows
- telemetry is now much broader and more durable, but still needs a real supported COO run to become management-grade evidence
- recovery proof still needs a real persisted CEO<->COO conversation artifact, not only code/tests/integration probes

Update: 2026-04-01 (route closure + supported-run proof)

The remaining route-level closures have now been implemented and verified against the live code paths, not only the schemas.

Closed in this slice:

- the decision evidence route now separates business reasoning from provenance reasoning
- the historical decision reasoning collision has a repair path through follow-up migrations instead of continuing to overload one column
- telemetry now has drain/join shutdown behavior instead of best-effort flush-only behavior
- supported COO startup is less brittle:
  - project root resolution is dynamic
  - MCP client/server resolution fails clearly
  - Codex shell execution now preflights required commands
- the supported COO route now has proof artifacts from a real run:
  - persisted thread JSON/TXT artifacts under `threads/`
  - fresh `COO/...` telemetry rows in Brain
  - successful resume on the same thread and scope

Current remaining gaps after supported-run proof:

- live route correctness is materially stronger and no longer the main blocker
- the main remaining weakness is historical evidence quality:
  - legacy sentinel provenance still dominates old rows
  - repaired legacy decision reasoning is weaker than new clean writes
- management-grade trust now depends more on historical evidence policy than on current COO route correctness

Update: 2026-04-01 (decision provenance continuity + bounded telemetry close)

The remaining system-level issues were handled as route problems, not endpoint bugs.

Closed in this slice:

- the COO decision route now carries both provenance chains end to end:
  - content provenance from the structured-decision extraction step
  - write provenance from the durable decision mutation
- the persisted thread route now records the extracted decision content with content provenance first, then the committed write receipt with both provenance chains and returned IDs
- the persisted decision row now distinguishes:
  - `direct_input`
  - `llm_extracted`
  - `legacy_unknown`
- telemetry shutdown on the supported CLI route is now bounded:
  - attempt normal drain
  - if the sink stays unavailable past the shutdown deadline, spool pending telemetry to a local outbox
  - replay the outbox on the next supported startup
- warm file-based residue now follows the local day instead of UTC day

Live proof now includes a real COO decision route:

- thread: `82cd8901-61ab-451d-9b71-d1fa228def69`
- decision: `b7637c70-0fe8-4ac9-90f2-55bd8f16306c`
- the thread, the decision row, and Brain telemetry all agree on the live provenance chain

Current remaining gaps after this slice:

- current COO route correctness is no longer the main concern
- historical evidence quality is still the main remaining weakness:
  - legacy sentinel provenance still dominates old rows
  - historical rows can now be partitioned more honestly, but they are not equal in trust to modern rows
- broader management-grade proof still needs richer real conversations beyond the current direct-response + decision-route evidence

## Executive Decision

The current COO should be treated as:

- a **salvageable prototype**
- built on a broadly correct architectural shape
- but **not yet trustworthy enough** to serve as the real Phase 1 COO lane

Therefore:

- do **not** start over
- do **not** continue the old COO plan mechanically
- do **not** move to onion implementation yet
- first run a focused **COO stabilization** slice

Only after that stabilization slice passes should the COO move into the onion requirements lane and requirement-artifact flow.

## Why The Plan Changed

Independent review and audit found that the current COO is weak in the exact areas that matter most for Phase 1:

- persistence correctness
- crash recovery
- real resume and recovery behavior
- memory retrieval truthfulness
- telemetry and provenance truthfulness
- honest capability surface

The architecture was mostly right.

The implementation is not yet mature enough.

That means the correct move is:

- keep the architectural foundation
- stabilize the runtime truthfulness
- only then build the real COO lane on top of it

## Current Disposition

### Keep

Keep and build on:

- controller
- thread model
- context engineer
- Brain client and memory-engine integration
- CLI front door
- provenance and telemetry foundations

These are still the right core surfaces unless a later fix round proves otherwise.

### Fix

Fix before onion work:

- broken decision logging path
- broken governance/rule creation path
- broken deep scope resolution
- ineffective repeated-error escalation
- missing real CLI resume and recovery flow
- unbounded prompt growth from raw event replay
- misleading tool and specialist workflow surface
- non-operational telemetry sink and missing LLM telemetry
- truth-unsafe memory search and knowledge injection
- mid-turn persistence gap
- partial or misleading provenance trust story
- missing end-to-end COO scope
- untruthful memory-operation success reporting
- missing created-ID/result capture in COO thread evidence
- unscoped retrieval and scope-blind governance writes

### Defer

Defer until the COO is stable:

- rich downstream feature-function expansion
- design / planning / setup-analysis split
- generalized specialist execution
- broader implementation-engine recovery
- heavy review optimization
- polish work that does not improve continuity, truthfulness, or requirement creation

## Phase 1 COO Objective

Finish a usable COO that can:

- hold the table
- lose nothing important
- recover truthfully after interruption
- converse naturally enough with the CEO
- produce a real requirement-list artifact
- hand off cleanly into the downstream feature lane

## Success Criteria

The COO slice is done when:

1. nothing important is lost
2. recovery after interruption is operational and truthful
3. memory retrieval is trustworthy enough to support COO reasoning
4. telemetry and provenance are honest enough for management use
5. visible COO capability matches real COO capability
6. COO conversation feels natural enough
7. the system can create, revise, and finalize a requirement-list artifact
8. the requirement list can be handed off cleanly

## Maturity Gates

The COO should only be treated as a mature Phase 1 component when all 5 gates below are true.

### Gate 1: Persistence Truth

Required outcomes:

- decision logging works
- rule/governance creation works or is explicitly removed from the live capability surface
- scope resolution works across the intended hierarchy
- side effects and thread evidence stay aligned

Pass condition:

- the system no longer advertises write paths that fail structurally at runtime

### Gate 2: Recovery Truth

Required outcomes:

- current turn is durably recoverable enough for the Phase 1 promise
- repeated failure escalation actually triggers
- CLI resume and recovery are real, not only latent in lower layers
- conversation continuity does not depend on a single long in-memory process

Pass condition:

- interruption and restart do not require manual archaeology to continue

### Gate 3: Memory Truth

Required outcomes:

- search does not inject low-signal or zero-signal rows as relevant memory
- hidden context loading is trustworthy enough for COO reasoning
- memory failure is visible when it matters, not silently indistinguishable from “no memory found”

Pass condition:

- the COO can rely on memory retrieval without smuggling bad evidence into answers

### Gate 4: Observability Truth

Required outcomes:

- COO telemetry actually lands somewhere durable
- model activity is observable enough to support runtime and cost decisions
- provenance claims match the level of truth the system really has
- historical sentinel provenance is clearly bounded in trust

Pass condition:

- management-facing telemetry and provenance surfaces can be used without misleading the CEO

### Gate 5: Capability Honesty

Required outcomes:

- dead-end paths are removed, disabled, or clearly bounded
- the live runtime surface is smaller but honest if necessary
- only implemented paths are presented as active capability

Pass condition:

- the COO no longer appears more complete than it really is

## Stabilization Plan

## Phase 0: Lock Keep / Fix / Defer

Goal:

- freeze what is worth keeping
- prevent accidental restart-from-zero behavior
- prevent sideways work during stabilization

Output:

- keep / fix / defer classification locked for the COO

## Phase 1: Persistence and Capability Repair

Goal:

- make the currently advertised write and routing paths structurally real or explicitly unavailable

Focus:

- decision path
- governance / rule creation path
- scope hierarchy resolution
- dead-end routing cleanup

Management outcome:

- the COO stops claiming capabilities that fail on first real use

## Phase 2: Recovery and Continuity Repair

Goal:

- make continuity operational rather than theoretical

Focus:

- mid-turn durability strategy
- repeated-error escalation
- resume and recovery through the real CLI path
- bounded prompt growth and better turn-state compression

Management outcome:

- the COO can survive interruption without losing the plot

## Phase 3: Memory and Observability Repair

Goal:

- make memory and telemetry safe enough to govern the COO lane

Focus:

- relevance-safe memory retrieval
- visible handling of retrieval degradation
- real telemetry sink
- real LLM activity telemetry
- provenance trust boundary clarity

Management outcome:

- the COO becomes trustworthy as an operational and management surface

## Current Next Slice

The next implementation slice is now narrower than the original stabilization wave.

It must finish these 4 things:

1. historical provenance trust policy
   - define how legacy sentinel rows are handled in management reporting

2. historical decision evidence policy
   - distinguish clean current writes from repaired or legacy-unknown rows

3. supported COO operational proof expansion
   - run richer real COO conversations
   - verify recovery from interruption with persisted artifacts
   - include more memory/governance routes, not only direct response and decision logging

4. management-facing evidence acceptance
   - confirm telemetry, provenance, and recovery evidence are strong enough to begin onion work

This is the current blocker between "supported COO route" and "management-trustworthy COO".

## Phase 4: Continuity Foundation Freeze

Goal:

- declare the ADF continuity foundation real enough to support the COO lane

This phase is complete when:

- persistence truth is acceptable
- recovery truth is acceptable
- memory truth is acceptable
- observability truth is acceptable
- capability honesty is acceptable

Management outcome:

- the foundation under the COO lane is stable enough to build on

## Phase 5: COO Onion Lane

Only after the continuity foundation is frozen:

- build the real CEO <-> COO requirements-gathering lane
- outer-shell-first discussion
- one-question-at-a-time clarification
- explicit reflection back to the CEO
- explicit freeze check
- pushback when scope is not ready

Management outcome:

- the COO behaves like a real operator, not a form filler

## Phase 6: Requirement Artifact

Turn the approved onion into a real artifact flow.

Scope:

- draft requirement list
- revision cycle
- finalized requirement list

Management outcome:

- the company has durable requirement truth, not just a conversation

## Phase 7: Requirement Freeze and Handoff

Finish the first feature-function boundary.

Scope:

- requirement-list review and freeze
- frozen requirement list or pushback back to COO
- handoff package into the downstream lane

Management outcome:

- COO pre-function work hands off cleanly into governed execution

## Acceptance Model

The stabilization slice should be treated as complete only when:

1. the current COO no longer contains known high-severity structural failures on core paths
2. interruption and recovery are tested and accepted
3. memory retrieval is trustworthy enough to support CEO-facing answers
4. telemetry and provenance are honest enough for management use
5. the live COO capability surface is explicit and truthful

Only then should onion implementation begin.

## What We Are Explicitly Not Doing Yet

Defer for now:

- the full downstream chain expansion
- design / planning / setup-analysis split
- generalized specialist routing beyond what is needed for COO truthfulness
- broader implementation-engine recovery
- heavy review optimization
- polish work that does not improve continuity, truthfulness, or requirement creation

## Decision Rule

- do not start over
- do not finish the old plan as written
- do not build onion behavior on top of a weak runtime
- stabilize first, then complete the real COO lane

## Execution Order

1. lock keep / fix / defer list
2. repair persistence truth and capability honesty
3. repair recovery and continuity
4. repair memory and observability truth
5. freeze the continuity foundation
6. build the onion lane
7. build the requirement artifact
8. build requirement freeze and handoff
