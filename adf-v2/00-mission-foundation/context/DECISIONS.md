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
