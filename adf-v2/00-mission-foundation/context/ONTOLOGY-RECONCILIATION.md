# ADF v2 - Ontology Reconciliation

Status: active reconciliation record  
Scope: `adf-v2/00-mission-foundation/`  
Purpose: preserve the canonical record of the `CEO / CTO / DEV` ontology correction pass, the reviewed source inventory, and the current supersession map

---

## What This File Is

This file is the canonical durable reconciliation record for the mission-foundation ontology correction pass.

If a contextless next agent needs to understand:
- what was corrected
- what old wording is now historical or superseded
- which files were reviewed
- which files changed
- what the post-pass restart truth now is

this is the one canonical place to look.

---

## Corrected Ontology

The corrected mission-foundation top-level ontology is:
- `CEO`
- `CTO`
- `DEV`

At this layer:
- `CTO` is a top-level entity assembled from boxed components
- `DEV` is a top-level entity assembled from boxed components
- `Scripts`, `Agents`, and `Durable state` remain below that layer as lower-level governed ingredients or capabilities
- this wording is intentionally non-exhaustive and does not freeze one universal internal recipe for every box

Canonical naming:
- `DEV` is the canonical high-level name
- `startup development team` is historical wording kept only for traceability

Post-pass restart truth:
- ontology correction is complete
- `DEV` role or rules is the required next artifact
- `context/OPEN-ITEMS.md` is the primary canonical register for that next artifact
- `context/NEXT-STEP-HANDOFF.md` is the required mirror

---

## Supersession Map

- the ontology-layer implications preserved in compact-log `D-003` are superseded where they keep `Core operating roles` as the current top-level framing
- decision file `D-011` is preserved for traceability, but its top-level reading is superseded
- the old five-item peer ontology wording in `MISSION-STATEMENT.md` is superseded and replaced by `Top-level entities`
- the old five-item peer ontology wording in `DELIVERY-COMPLETION-DEFINITION.md` is superseded and replaced by the `CEO -> CTO -> DEV` service boundary
- the old five-item startup truth in `context/HANDOFF.md` and `context/NEXT-STEP-HANDOFF.md` is superseded
- the old five-item draft framing in `context/artifacts/TOP-LEVEL-GOVERNING-ENTITIES.md` is superseded
- `decision-014` and `decision-022` remain historical service-boundary precedents and were reviewed without text change; their old naming is interpreted through the `DEV` naming decision rather than as competing current canon
- `D-047` remains the historical freeze milestone for `DELIVERY-COMPLETION-DEFINITION.md`; `D-071` records the ontology-aligned re-freeze in place
- `D-062` remains the historical freeze milestone for `SYSTEM-OBLIGATIONS.md`; `D-072` records the ontology-aligned re-freeze in place
- `D-063` remains the historical freeze milestone for `BOXED-COMPONENT-MODEL.md`; `D-073` records the ontology-aligned re-freeze in place
- `D-011` remains a preserved historical decision file; `D-074` records its ontology-correction reopen-and-re-freeze trail as a historical trace record

---

## Reviewed Source Inventory

### Updated

- `adf-v2/00-mission-foundation/MISSION-STATEMENT.md`
  status: `updated`
  note: replaces the obsolete five-item peer ontology with `Top-level entities` and explicit `CEO / CTO / DEV` framing

- `adf-v2/00-mission-foundation/DELIVERY-COMPLETION-DEFINITION.md`
  status: `updated`
  note: reopened and re-frozen in place for ontology correction; service boundary now reads `CEO -> CTO -> DEV`

- `adf-v2/00-mission-foundation/SYSTEM-OBLIGATIONS.md`
  status: `updated`
  note: header and canonical-state wording aligned to its frozen promoted status; references cleaned up to current root-path canon

- `adf-v2/00-mission-foundation/BOXED-COMPONENT-MODEL.md`
  status: `updated`
  note: header and canonical-state wording aligned to its frozen promoted status; references cleaned up to current root-path canon

- `adf-v2/00-mission-foundation/context/HANDOFF.md`
  status: `updated`
  note: restart truth now reflects ontology correction complete and `DEV` role or rules as the required next artifact

- `adf-v2/00-mission-foundation/context/NEXT-STEP-HANDOFF.md`
  status: `updated`
  note: checkpoint truth now mirrors the corrected ontology and points to `OPEN-ITEMS.md` as the primary register for the next artifact

- `adf-v2/00-mission-foundation/context/OPEN-ITEMS.md`
  status: `updated`
  note: records `DEV` role or rules as the required next artifact and resolves the sibling-doc status mismatch item

- `adf-v2/00-mission-foundation/context/DECISIONS.md`
  status: `updated`
  note: compact log now carries the ontology correction, the `DEV` naming decision, and the delivery completion re-freeze trail

- `adf-v2/00-mission-foundation/context/artifacts/TOP-LEVEL-GOVERNING-ENTITIES.md`
  status: `updated`
  note: draft now defines only `CEO`, `CTO`, and `DEV` at the top-level ontology layer

- `adf-v2/00-mission-foundation/context/decisions/decision-011-core-operating-roles.md`
  status: `updated`
  note: preserved for traceability with explicit ontology-status annotation so it cannot be mistaken for current top-level canon

- `adf-v2/00-mission-foundation/context/decisions/decision-069-mission-foundation-top-level-ontology-is-ceo-cto-dev.md`
  status: `updated`
  note: new canonical ontology correction decision

- `adf-v2/00-mission-foundation/context/decisions/decision-070-dev-is-the-canonical-high-level-name.md`
  status: `updated`
  note: new canonical naming decision

- `adf-v2/00-mission-foundation/context/decisions/decision-071-delivery-completion-definition-reopened-and-refrozen-for-ontology-correction.md`
  status: `updated`
  note: new canonical re-freeze decision for delivery completion

- `adf-v2/00-mission-foundation/context/decisions/decision-072-system-obligations-reopened-and-refrozen-for-ontology-correction.md`
  status: `updated`
  note: new canonical re-freeze decision for system obligations

- `adf-v2/00-mission-foundation/context/decisions/decision-073-boxed-component-model-reopened-and-refrozen-for-ontology-correction.md`
  status: `updated`
  note: new canonical re-freeze decision for boxed component model

- `adf-v2/00-mission-foundation/context/decisions/decision-074-decision-011-reopened-and-refrozen-as-historical-trace-record.md`
  status: `updated`
  note: new canonical historical-trace re-freeze decision for `D-011`

- `adf-v2/00-mission-foundation/context/ONTOLOGY-RECONCILIATION.md`
  status: `updated`
  note: canonical reconciliation record and full reviewed source inventory

### Reviewed-No-Change

- `adf-v2/00-mission-foundation/context/decisions/decision-014-delivery-definition-as-service-contract.md`
  status: `reviewed-no-change`
  note: historical wording `startup development team` is now explicitly marked inside the file and interpreted through `D-070`; file retained for traceability

- `adf-v2/00-mission-foundation/context/decisions/decision-022-system-owns-the-route-after-handoff.md`
  status: `reviewed-no-change`
  note: historical wording `startup development team` is now explicitly marked inside the file and interpreted through `D-070`; file retained for traceability

- `adf-v2/CTO-ROLE.md`
  status: `reviewed-no-change`
  note: already aligned to a top-level entity with explicit role and rules

- `adf-v2/00-mission-foundation/CTO-CONTEXT-ARCHITECTURE.md`
  status: `reviewed-no-change`
  note: already aligned to the corrected ontology and still serves as valid CTO precedent

---

## Current Restart References

Canonical startup authority:
- `adf-v2/00-mission-foundation/context/HANDOFF.md`

Checkpoint companion:
- `adf-v2/00-mission-foundation/context/NEXT-STEP-HANDOFF.md`

Primary parking register for the next artifact:
- `adf-v2/00-mission-foundation/context/OPEN-ITEMS.md`

Corrected top-level ontology draft:
- `adf-v2/00-mission-foundation/context/artifacts/TOP-LEVEL-GOVERNING-ENTITIES.md`

If drift appears between these files during the next pass:
- `HANDOFF.md` remains the canonical startup authority
- `OPEN-ITEMS.md` remains the primary register for the next DEV role or rules artifact

---

## One-Sentence Summary

The ontology correction pass moved current mission-foundation canon from the obsolete five-item peer ontology to `CEO / CTO / DEV`, preserved older wording only as traceable historical context, reopened and re-froze delivery completion in place, and left `DEV` role or rules as the required next artifact with `OPEN-ITEMS.md` as the primary canonical register.
