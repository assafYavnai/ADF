# ADF v2 Layer Lifecycle

Status: active v2 structure rule  
Scope: all v2 layers such as `00-mission-foundation`, `01-*`, `02-*`, and later  
Purpose: define one consistent document lifecycle and folder structure for all v2 work

---

## Why This Exists

ADF v2 needs one repeatable rule for how layer documents move from working material to frozen layer outputs to broader v2 canon.

Without that rule, the repo will keep mixing:
- in-progress artifacts
- frozen layer documents
- decision logs
- handoff and restart material

This document defines that lifecycle once so every future layer follows the same model.

---

## Standard Layer Shape

Each v2 layer should use this structure:

- `adf-v2/<layer>/`
- `adf-v2/<layer>/context/`
- `adf-v2/<layer>/context/decisions/`
- `adf-v2/<layer>/context/artifacts/`

Meaning:

- layer root contains the frozen canonical documents for that layer
- `context/` contains layer-level support material such as handoffs, restart packs, indexes, and other global context docs for the layer
- `context/decisions/` contains frozen decision records made while shaping the layer
- `context/artifacts/` contains working artifacts, drafts, and other in-progress support material that have not yet been promoted

---

## Promotion Model

The lifecycle is:

1. working material starts in `context/artifacts/` when it is still in progress
2. frozen decision records are saved in `context/decisions/`
3. once a layer document or artifact is frozen as a canonical output of that layer, it is promoted to the layer root
4. once the whole layer is complete and frozen, its canonical outputs may be promoted upward into `adf-v2/` when they become cross-layer v2 canon

This means:

- `context/` is not the final home of frozen layer outputs
- layer root is the canonical home for frozen documents belonging to that layer
- `adf-v2/` is reserved for cross-layer v2 canon, protocols, and material promoted beyond a single layer

---

## Promotion Rule Of Thumb

Use these questions:

- if it is still being shaped, challenged, or iterated, it belongs in `context/artifacts/`
- if it records a frozen choice, it belongs in `context/decisions/`
- if it is a frozen deliverable of the current layer, it belongs in the layer root
- if it applies across multiple layers or defines v2-wide rules, it belongs in `adf-v2/`

---

## First Applied Example

`00-mission-foundation` is the first layer using this structure.

Examples:

- `MISSION-STATEMENT.md` belongs in `00-mission-foundation/` because it is a frozen layer output
- `V1-PAIN-POINT-AND-V2-FORK-RATIONALE.md` belongs in `00-mission-foundation/` because it is frozen foundation context, not just working support material
- `CTO-REQUIREMENT-GATHERING-FINDINGS.md` belongs in `00-mission-foundation/` while mission foundation is still the active layer, because it is a frozen output of this layer
- `CEO-AGENT-WORKING-PROTOCOL.md` belongs in `adf-v2/` because it is a cross-layer v2 rule rather than a single-layer artifact

When later layers such as `01-*` and `02-*` are created, they should follow the same lifecycle unless an explicit higher-level decision changes it.
