# ADF v2 Reset — Work Order

Status: active
Owner: reset planning / architecture lane
Purpose: define the approved ordered work for the v2 reset so implementation and cleanup stay in lane

## Rule of interpretation

This work order is ordered.
Later steps do not start as destructive work until earlier steps are materially completed or explicitly re-sequenced by a frozen decision.

---

## Step 1 — Rewrite top truth

Goal:
- rewrite the top truth for v2 so drift stops at the source

Required outputs:
- `MISSION-STATEMENT.md`
- `VISION.md`
- `PHASE1.md`

Must establish:
- v2 is a clean restart
- v1/legacy is reference-only unless explicitly carried over
- active startup ontology is CEO / CTO / DEV
- current CTO code on branch is exploratory, not main truth
- Brain/MCP and other substrates are not automatically the business architecture

Exit condition:
- these files exist and are good enough to anchor further work

---

## Step 2 — Freeze carry-over classification

Goal:
- classify what carries over from legacy/v1 and what does not

Required output:
- `CARRY-OVER-CLASSIFICATION.md`

Classification buckets:
- certain carry-over
- probable carry-over
- reference-only
- not carried over

Must cover at minimum:
- MCP Brain
- LangGraph
- older docs
- older runtime surfaces
- old engines / tool stacks / governance stacks

Exit condition:
- major repo surfaces are classified well enough to support archive/remove planning

---

## Step 3 — Isolate and archive legacy from active truth

Goal:
- stop legacy/v1 from acting like active truth during the reset

Required actions:
- label historical/legacy surfaces clearly
- separate active reset truth from legacy reference truth
- decide archive targets before delete/remove work
- wire agent/session entrypoints toward reset truth first

Typical outputs:
- updated routing docs
- legacy banners / archive notes
- reset-aware handoff surfaces

Exit condition:
- a new agent/session can enter the repo and find reset truth first without accidental legacy drift

---

## Step 4 — Run the active-tree reset

Goal:
- clean the active project tree after truth and classification are frozen

Possible actions:
- archive reference v1 code
- remove legacy code from active project surfaces
- retire legacy project-brain surfaces after policy is frozen
- clean obsolete engines or dead architecture roots

Guardrails:
- no destructive work without a frozen classification basis
- archive before delete when practical
- record every material destructive decision in `DECISIONS.md`

Exit condition:
- active repo truth matches the new v2 framing closely enough that legacy no longer masquerades as active architecture

---

## Immediate next action

The current next action is still Step 1:
- write or refactor the top truth files first

## Explicitly not yet started

- legacy archive/delete run
- project-brain cleanup
- migration of legacy files into active v2 truth without classification
