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
