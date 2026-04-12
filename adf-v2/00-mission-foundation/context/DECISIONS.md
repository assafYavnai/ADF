# ADF v2 Mission Foundation — Decision Log

Status: active working log for frozen decisions made while defining `adf-v2/00-mission-foundation/`
Purpose: give the next agent a compact, append-only record of what was decided without forcing them to reconstruct the conversation

---

## Decision D-001 — First mission document name

Frozen decision:
- `adf-v2/00-mission-foundation/MISSION-STATEMENT.md`

Why:
- clearer than `VISION.md`
- does not compete with the root ADF vision documents
- more explicit for restart and handoff use

Rejected alternatives:
- `VISION.md`
- `FOUNDATION.md`

---

## Decision D-002 — Mission document style

Frozen decision:
- keep `MISSION-STATEMENT.md` **thin**

Why:
- `context/HANDOFF.md` already carries the wider context and session rationale
- the mission document should be an executive charter, not a strategy dump
- architecture, migration, and control-plane detail belong in later documents

Implication:
- mission statement stays short and decisive
- supporting context lives in separate files under the same foundation area

---

## Decision D-003 — Mission document structure

Frozen decision:
`MISSION-STATEMENT.md` will use this structure:

1. Identity
2. Core promise
3. Phase 1 mission
4. Phase 1 scope
5. Phase 1 out of scope
6. Core operating roles
7. Success test

Why:
- adds explicit scope, not only out-of-scope
- keeps the document useful for fast executive review
- prevents architecture and implementation detail from leaking into the mission charter

---

## Working rule from this point forward

For the remainder of the `00-mission-foundation` work:
- every frozen decision should be recorded here
- `context/HANDOFF.md` remains the broad session bridge and restart pack
- `DECISIONS.md` remains the concise authoritative log of frozen choices

---

## Decision D-025 — CTO role/rules sit above the context layers

Frozen decision:
- CTO context includes a governing `Layer 0` for role and rules above the 3 working context layers

Why:
- the context layers explain what CTO is holding, not how CTO must behave
- this keeps the operating contract separate from the active work context

---

## Decision D-026 — CTO context uses system graph, task subgraph, issue stack

Frozen decision:
- below `Layer 0`, the working model is:
  1. system graph
  2. current task subgraph
  3. current issue stack

Why:
- the system layer needs relationship awareness
- the task layer is the focused slice of that system context
- the issue layer is temporary and FILO

---

## Decision D-027 ג€” Trust is a core system concept

Frozen decision:
- trust is a core system concept in ADF v2

Why:
- ADF v2 cannot become truly fire-and-forget without an explicit trust concept

---

## Decision D-028 ג€” Trust model is separate from delivery completion

Frozen decision:
- the full trust model belongs in its own document, not inside `DELIVERY-COMPLETION-DEFINITION.md`

Why:
- delivery completion needs only the delivery-boundary trust condition
- the broader trust concept is wider than completion

---

## Decision D-029 ג€” Delivery completion uses only boundary trust

Frozen decision:
- `DELIVERY-COMPLETION-DEFINITION.md` should consume only the narrow delivery-boundary meaning of trust

Why:
- keeps the current task bounded and prevents trust-model drift from blocking it

---

## Decision D-030 ג€” Trust is bidirectional

Frozen decision:
- trust is bidirectional across adjacent boxes

Why:
- both sides of the relationship matter for diagnosis and governance

---

## Decision D-031 ג€” Trust is edge-based in a workflow graph

Frozen decision:
- trust is fundamentally edge-based inside a workflow graph

Why:
- workflows are not purely sequential and one node may sit on several adjacent trust edges

---

## Decision D-032 ג€” Upward box trust is not self-published

Frozen decision:
- a box does not self-publish its own trust level upward

Why:
- upward trust must not become self-certification

---

## Decision D-033 ג€” Box trust uses weakest critical edge direction

Frozen decision:
- the direction for box-trust aggregation is weakest critical edge, not average

Why:
- one critical weak edge can make the whole box unsafe to rely on

---

## Decision D-034 ג€” Trust is primarily governance owned

Frozen decision:
- trust should be handled primarily in the governance layer

Why:
- the mechanism must stay lightweight and operational rather than become manual bureaucracy

---

## Decision D-035 ג€” Low trust requires action

Frozen decision:
- low trust requires action, not only observation

Why:
- fire-and-forget delegation cannot tolerate persistently low trust

---

## Decision D-036 ג€” Trust supports self-healing and self-improvement

Frozen decision:
- the trust model should support future self-healing and self-improving behavior

Why:
- trust should help the system learn and improve, not only escalate

---

## Decision D-037 - Delivery-boundary trust includes justified CEO doubt

Frozen decision:
- at the delivery boundary, trust includes not only absence of visible manual repair work, but also absence of justified CEO doubt that supervision, verification, reconstruction, resume-driving, or repair might still be required

Why:
- justified CEO doubt is itself leaked operational burden
- completion should not leave the CEO needing to check whether the route is truly safe to rely on

---

## Decision D-038 - Delivery-boundary trust includes scope fidelity

Frozen decision:
- at the delivery boundary, trust includes scope fidelity: the system must return the approved implementation package truthfully, not a silently reinterpreted substitute

Why:
- a clean-looking return is not trustworthy if the CEO still has to inspect whether the requested thing was quietly changed in meaning
- silent reinterpretation is a form of leaked burden because it pushes validation of scope truth back upward

---

## Decision D-039 - Completion requires return into the production tree

Frozen decision:
- delivery is not complete while the result remains only in a side worktree, temporary branch state, or other pre-production-tree holding state
- completion requires that the requested artifact has actually returned into the production tree

Why:
- otherwise the result remains pre-terminal
- pre-production-tree state still leaves doubt about whether delivery has truly finished

---

## Decision D-040 - Terminal states are complete and blocked

Frozen decision:
- the only top-level terminal states are `complete` and `blocked`
- `pushback` is not its own top-level state; it is a `blocked` reason
- `blocked` carries a reason or substate such as `pushback`, `waiting for user verification`, `missing input`, `failed`, `cancelled`, or `superseded`
- not all components are required to support all blocked reasons; valid blocked reasons depend on the component and boundary

Why:
- this keeps the top-level terminal model thin for a fire-and-forget system
- it preserves truthful status while letting each component expose only the blocked reasons that actually make sense for its boundary
- it avoids inflating the top-level terminal-state set with what are really blocked variants

---

## Decision D-041 - Blocked may be external or internal

Frozen decision:
- `blocked` does not mean only waiting on something external to the system
- `blocked` may also represent an internally detected terminal failure when the system cannot truthfully complete from the current state without explicit resolution

Why:
- this keeps the terminal model truthful
- it avoids creating a separate top-level state when the real meaning is still that completion cannot be certified from the current state

---

## Decision D-042 - Component inputs and outputs use JSON payloads

Frozen decision:
- all component-to-component inputs and outputs are JSON payloads with defined relevant fields
- human-readable explanation may accompany a payload when useful, but the JSON payload is the authoritative package form

Why:
- this keeps contracts machine-readable, structured, and durable across component boundaries
- it makes package transfer, validation, logging, persistence, and recovery more reliable
- it avoids hidden interpretation at handoff boundaries

---

## Decision D-043 - Current bundled trust and contract assumptions

Frozen decision:
- `blocked` is a terminal outcome for the current component run
- `user verification` is a reserved blocked reason used when that boundary requires human verification before progress can continue
- trust is defined primarily by whether the current boundary is safe to rely on now; longer-term interaction quality is supporting evidence, not the primary definition
- every component contract has one canonical pair of JSON payloads: input payload and output payload
- blocked reasons and resolve packages are part of the output contract
- recoverable blocked states should be resumable from governed state
- ended blocked states such as `cancelled`, `superseded`, and some `failed` cases do not require in-place resume, but must still return enough structured truth to drive the next step safely

Why:
- this keeps the trust and contract model oriented around truthful current-state delegation
- it preserves a thin top-level system model while still making blocked outcomes operationally useful
- it keeps resumability strong where it matters without pretending every ended state should reopen in place

---

## Decision D-044 - Low-level decisions use batched executive approval

Frozen decision:
- when a task reaches small or low-level decision points, CTO should present them in executive batches of up to 5 items at a time
- each item must include a recommendation
- the CEO may either explicitly approve an item or comment for further discussion
- no explicit approval means discussion, not silent acceptance

Why:
- this reduces approval noise without silently freezing low-level assumptions
- it keeps the CEO interaction high level while still preserving explicit decision control
- it prevents accidental closure from ambiguity or non-response

---

## Decision D-045 - Complete means complete status with no trust failures

Frozen decision:
- `complete` means the status is `complete`, the artifact has returned into the production tree, the working environment is clean, and no delivery-boundary trust condition has failed
- this may stay high level; the document does not need to expand into a low-level checklist here

Why:
- this keeps the meaning of complete tied to both artifact return and trustworthy delivery conditions
- it makes cleanliness and trust-preservation part of completion rather than optional polish
- it lets the document stay high level while still making `complete` materially testable

---

## Decision D-046 - CTO certification rests on governed system truth

Frozen decision:
- CTO certification should explicitly rest on governed system truth rather than belief, memory, or manual reconstruction after the fact
- when trust is low, governed verification is required before certification
- for the initial implementation stage, this should be treated as required by default

Why:
- this keeps upward certification trustworthy
- it prevents “looks fine” or reconstructed confidence from counting as completion
- it leaves the detailed trust-threshold verification matrix for later trust-model work

---

## Decision D-047 - Delivery completion definition approved for freeze and promoted

Frozen decision:
- `DELIVERY-COMPLETION-DEFINITION.md` is approved for freeze as a canonical `00-mission-foundation` output
- once frozen, it is promoted from `context/artifacts/` to the layer root according to `LAYER-LIFECYCLE.md`

Why:
- this turns the approved delivery-completion definition into one canonical layer source of truth
- it removes ambiguity between draft and frozen locations
- it follows the v2 layer lifecycle instead of leaving an approved document parked in working artifacts

---

## Decision D-048 - New v2 agents bootstrap into CTO working mode

Frozen decision:
- when working directly with the user on ADF v2 shaping, definition, readiness, or freeze work, the agent operates as CTO unless a governing v2 document explicitly says otherwise
- the bootstrap reading set must include the promoted `DELIVERY-COMPLETION-DEFINITION.md` and a compact CTO working-mode document
- short executive answers, fundamental-question discipline, same-pass source-of-truth propagation, and commit-push after meaningful file CRUD are operating rules, not optional style choices

Why:
- this reduces re-onboarding cost for the next agent
- it turns CEO working preferences into explicit operating rules
- it prevents drift between approved collaboration mode and what a new agent assumes by default

---

## Decision D-049 - CEO decides high-level objects and CTO derives lower layers

Frozen decision:
- the CEO decides high-level system behavior, contracts, boundaries, and governing intent
- the CTO's role is to help the CEO define and freeze those high-level objects clearly and completely
- once those are clear enough, CTO should derive the lower-level artifacts and implementation-facing outputs without pushing that decomposition burden back onto the CEO

Why:
- this keeps the CEO at the correct abstraction level
- it makes the CTO role explicitly responsible for lower-layer derivation rather than only discussion support
- it reduces drift caused by asking the CEO to design lower layers directly

---

## Decision D-050 - Governed components inherit universal obligation guarantees

Frozen decision:
- every component must accept and return authoritative JSON contracts
- terminal truth is `complete` or `blocked`; the system must not fake success
- execution happens only in project-governed isolated working areas, never in hidden agent-private areas
- repo and worktree state stay clean; meaningful CRUD batches trigger commit and push
- commit messages must be descriptive enough that a reader of history can understand the high-level change without scanning code first
- KPI truth must measure usage, effort and time, and cost, so bottlenecks can be improved from evidence over time
- everything is boxed, self-contained, standalone-testable, and connected only through contracts plus approved shared system tools
- components are workflow-agnostic building blocks that can be reused, reordered, repeated, and run in parallel
- everything must be concurrency-safe and parallel-safe
- components must be retry-safe and re-invocation-safe
- every run must leave durable audit truth for both success and failure
- contract evolution must be explicit and governed

Why:
- this locks the practical universal guarantee layer the system must satisfy before lower-level schema and workflow details are defined
- it keeps later component, role, and workflow work from drifting away from the approved fire-and-forget building-block model
- it gives implementation one explicit requirement baseline without forcing the CEO to design lower-level schemas

---

## Decision D-051 - Boxed components inherit a shared structural model

Frozen decision:
- a `box` is the smallest governed component unit that can be invoked, inspected, retried or re-invoked safely, tested, and certified on its own
- every box must expose common high-level structural surfaces:
  - input package
  - output package
  - status surface
  - blocked reason and resolve-package surface where applicable
  - audit and checkpoint surface
  - KPI and reporting surface
- every box output must include KPI truth for the current invocation
- every box must preserve durable long-term audit evidence and change history, including governed audit artifacts, KPI history, issues found, status and error history, and commit or change trail over time
- every box must inherit a shared structural layout so governed components look and behave consistently
- every box is self-contained inside its own governed folder or module boundary
- outward interaction happens only through authoritative contracts plus approved shared system tools
- every box must be executable and testable as a standalone unit while remaining reusable inside larger workflows

Why:
- this freezes the shared structural base that later component, role, and workflow artifacts should inherit
- it turns boxed components from a slogan into a governed model with consistent surfaces, auditability, and reuse
- it keeps the decision at the right abstraction level by freezing the structural requirements without prematurely locking exact schemas or storage details

---

## Decision D-052 - Boxes use one universal outer JSON envelope

Frozen decision:
- every box uses one universal outer JSON envelope
- standard cross-box fields live in that outer envelope
- box-specific content lives inside a nested payload section

Why:
- this gives all governed components one consistent contract shape without flattening away box-specific meaning
- it keeps status, blocked reason, KPI truth, audit references, and checkpoint references in predictable locations across the system
- it reduces later role and workflow drift by freezing the contract shape at the correct high level before exact schema details are defined

---

## Decision D-053 - Boxes inherit one governed shared layout

Frozen decision:
- every box inherits one governed shared layout
- that layout must provide standard areas for:
  - contracts
  - runtime state
  - audit history
  - tests
  - internal artifacts

Why:
- this gives all boxes one inspectable and automatable governance shape without prematurely locking exact folder names
- it keeps execution, audit, and testing discoverable across the system
- it reduces component drift by freezing the required layout areas before later specialization

---

## Decision D-054 - Universal box envelope uses standard field families

Frozen decision:
- the universal outer JSON envelope for every box must provide standard field families for:
  - identity
  - status
  - blocked
  - payload
  - KPI
  - audit refs
  - checkpoint refs
  - contract version

Why:
- this keeps the shared contract shape meaningful without prematurely locking exact key names
- it ensures the core operational truths of every box appear in predictable places across the system
- it gives later schema work a bounded field-family target instead of letting each component invent its own outer contract meaning

---

## Decision D-055 - Blocked is universal and resolve package is universal-optional

Frozen decision:
- `blocked` is a universal field family in the outer box envelope for all boxes
- `resolve package` is universal-optional: it appears only for boxes that support governed continuation after blocking

Why:
- this preserves one truthful blocked-reporting shape across the whole system
- it avoids forcing fake or meaningless resolve content on boxes that cannot continue from the current state
- it keeps continuation support explicit and governed without weakening the shared contract structure

---

## Decision D-056 - Scope fidelity is a universal system obligation and box surface

Frozen decision:
- the system must preserve fidelity to the approved implementation request package
- if scope, semantics, or requested outcome need to change, that change must surface as governed truth through blocked, pushback, or explicit re-approval rather than silent reinterpretation
- the box model must reserve a structural place for approved-package fidelity and scope-preservation truth

Why:
- scope fidelity is already part of delivery-boundary trust and must therefore be carried operationally and structurally below that boundary
- this prevents silent semantic drift after handoff
- it keeps fidelity truth machine-carrying rather than leaving it to manual interpretation

---

## Decision D-057 - Box model stays logical and box exceptions remain governed

Frozen decision:
- `BOXED-COMPONENT-MODEL.md` defines the logical governed component structure, not physical repository layout, source-control evolution policy, or implementation workflow policy
- core governed execution units are boxes
- approved shared system tools or substrate may exist as a separate governed class and are not forced into the box type merely because boxes depend on them

Why:
- this keeps the box model at the correct abstraction level
- it prevents repository or workflow policy from leaking into the runtime component definition
- it preserves the boxed execution model without overconstraining framework-level governed assets

---

## Decision D-058 - System obligations and box model are aligned sibling foundation docs

Frozen decision:
- `SYSTEM-OBLIGATIONS.md` and `BOXED-COMPONENT-MODEL.md` should be treated as aligned sibling foundation documents
- `SYSTEM-OBLIGATIONS.md` defines the universal guarantee layer
- `BOXED-COMPONENT-MODEL.md` defines the logical common carrier shape for those guarantees
- neither document should be written as though the other were already a lower-layer implementation detail

Why:
- this removes the unstable dependency wording between the two drafts
- it makes freeze order less ambiguous
- it keeps the guarantee layer and carrier-shape layer distinct without splitting them into conflicting abstractions

---

## Decision D-059 - Universal obligation wording stays high-level at mission-foundation level

Frozen decision:
- at mission-foundation level, universal obligation wording must stay at the level of cleanliness, isolation, and truthful traceability
- specific git workflow rules such as commit-push cadence or commit-message policy belong in lower-layer governance or implementation-facing documents rather than the universal obligation wording

Why:
- this keeps `SYSTEM-OBLIGATIONS.md` at the right abstraction level
- it avoids mixing workflow policy into the foundation guarantee layer
- it resolves the freeze-read pushback on low-level policy leakage

---

## Decision D-060 - Frozen requirement language uses must while permitted exceptions use may

Frozen decision:
- in mission-foundation documents, frozen universal or structural rules must use `must`
- `should` is reserved for non-frozen guidance or explanatory intent
- `may` or `optional` is reserved for permitted exceptions such as shared tools or substrate and continuation-specific resolve-package presence

Why:
- this removes normative ambiguity at freeze time
- it keeps the mandatory contract readable as mandatory rather than advisory
- it resolves the remaining freeze-read blocker around wording softness

---

## Decision D-061 - Verification and certification truth has an explicit structural home

Frozen decision:
- the box model must explicitly carry governed verification and certification evidence or references as part of its structural surfaces
- that truth belongs within the box's audit, checkpoint, and reporting surfaces rather than in hidden narration

Why:
- the system obligations already require governed verification and truthful upward certification
- the box model needs an explicit structural home for that truth
- this closes the remaining clarity gap without forcing exact schema design

---

## Decision D-062 - System obligations approved for freeze and promoted

Frozen decision:
- `SYSTEM-OBLIGATIONS.md` is approved for freeze as a canonical `00-mission-foundation` output
- once frozen, it is promoted from `context/artifacts/` to the layer root according to `LAYER-LIFECYCLE.md`

Why:
- this turns the approved obligations definition into one canonical layer source of truth
- it removes ambiguity between draft and frozen locations
- it promotes the universal guarantee layer to the same canonical status already used for other frozen mission-foundation outputs

---

## Decision D-063 - Boxed component model approved for freeze and promoted

Frozen decision:
- `BOXED-COMPONENT-MODEL.md` is approved for freeze as a canonical `00-mission-foundation` output
- once frozen, it is promoted from `context/artifacts/` to the layer root according to `LAYER-LIFECYCLE.md`

Why:
- this turns the approved box model into one canonical layer source of truth
- it removes ambiguity between working-draft and frozen locations
- it completes the current mission-foundation box-definition pass and clears the way for role modeling next

---

## Decision D-064 - CTO requirement gathering stays in the requirements layer and uses a freeze-read gate

Frozen decision:
- while working directly with the CEO, CTO must keep the discussion in the requirements layer
- CEO discussion should stay focused on behavior, contracts, boundaries, and governing intent
- lower-layer schema, repo-layout, workflow-policy, and implementation-detail questions should be derived below that boundary or parked as open items for the correct later doc
- before asking for freeze or promotion, CTO must run a freeze-read against frozen upstream truth, aligned sibling docs, and the current artifact

Why:
- this captures the strongest process lesson from the session
- it keeps the CEO at the correct abstraction level
- it prevents promotion requests before promise carry-through, abstraction purity, and doc alignment have actually been checked

---

## Decision D-065 - CTO uses bundled recommendations, batch mode, open-item lighthouse, and one-step `what next`

Frozen decision:
- when possible, CTO should synthesize a bundled recommendation rather than surfacing raw ambiguity upward
- small or low-level decisions should be handled in executive batches of up to 5 items, each with a recommendation
- no explicit approval means discussion, not freeze
- the open-item structure serves as both the CTO's internal task-completeness lighthouse and the CEO-facing fast answer surface for current status
- if the CEO asks `what next?`, CTO should answer with one recommended next step unless alternatives were explicitly requested

Why:
- this captures the operating pattern that actually worked in the session
- it reduces approval noise without losing decision control
- it keeps progress explicit, bounded, and easy to trust
