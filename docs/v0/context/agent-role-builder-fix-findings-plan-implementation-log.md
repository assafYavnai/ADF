# Agent Role Builder Fix: Findings, Plan, Implementation Log

Status: active working log
Last updated: 2026-03-29
Purpose: capture the current `agent-role-builder` fix context in one place so future agents do not need to reconstruct the problem from scattered runs, reviews, and code diffs.

Design note (2026-03-29): the governance/meta-policy split in this step is an authority cleanup only. It re-homes policy between guides, contracts, and rulebooks; it is not by itself a runtime-system fix.

---

## Scope

This log covers the current repair lane for:

- boxed review contracts
- built-in KPI artifacts
- review/runtime audit improvements
- agent-role-builder integration of the shared review contract direction
- naming and extraction direction for the shared reviewer and repair services
- enforcement of the standard review -> learning -> rule check -> fix -> re-review sequence

The current round closes the main runtime gaps that were still open after the earlier contract/KPI integration checkpoint.

---

## Frozen Naming

For this lane, the production naming is now treated as frozen:

- shared reviewer runtime: `shared/review-engine/`
- shared repair runtime: `shared/component-repair-engine/`

`fixer` remains an alias for conversation only. The production implementation name is `component-repair-engine`.

---

## Current Problem Statement

`agent-role-builder` improved materially across runs 010 through 016, but the tool still had a structural gap:

- the review contract was stronger in docs than in runtime
- KPI/postmortem artifacts were defined in architecture but not produced by the tool
- review protocol fields were still partly hardcoded inside `board.ts`
- the learning engine and revision flow were not fully boxed to component-owned contract files
- fallback and audit signals were too weak for reliable operations analysis

Run 016 confirmed that review itself was no longer the main failure point. Review, leader synthesis, and learning all completed. The hard failure was the revision path after round 0.

---

## Findings

### 1. Contract drift existed between docs, shared schemas, and runtime

The architecture in `docs/v0/review-process-architecture.md` defined a stronger protocol than the live board runtime was enforcing.

Examples:

- reviewer protocol was still assembled inline in `tools/agent-role-builder/src/services/board.ts`
- `shared/learning-engine/compliance-map.ts` did not allow `non_compliant`
- fix negotiation was keyed too narrowly around `finding_group_id`
- the component-local review contract did not exist as a first-class file

### 2. KPI artifacts were missing

The architecture required:

- `run-postmortem.json`
- `cycle-postmortem.json`

But `agent-role-builder` did not emit them.

That made it harder to measure:

- round count
- fallback rate
- reviewer reuse savings
- convergence trend
- latency accumulation

### 3. Boxed component ownership was incomplete

The intended model is:

- shared engine owns generic protocol
- component owns review prompt and contract
- runtime loads component-owned config

Before this round, `agent-role-builder` had a local `review-prompt.json`, but not a full boxed review contract, and the runtime still depended heavily on hardcoded protocol text.

### 4. Leader input was too expensive and too loose

The leader prompt was receiving raw reviewer verdict blobs instead of a normalized summary. That increased token usage and kept the runtime farther from a stable machine-facing protocol.

### 5. Fallback behavior was under-audited

Codex is meant to remain the default. If fallback happens, the system must surface it clearly as a warning and preserve it in audit/KPI outputs.

Before this round, fallback state was not strong enough in the standalone `agent-role-builder` telemetry path.

---

## Working Plan For This Round

The implementation plan for this round was:

1. Define a canonical shared review contract in the toolbox.
2. Add a draft coding review contract for future shared reviewer use.
3. Tighten the shared schemas so they match the live protocol better.
4. Add a boxed component-local review contract for `agent-role-builder`.
5. Make `agent-role-builder` load the shared/component review contracts at runtime.
6. Add built-in KPI artifacts:
   - `run-postmortem.json`
   - `cycle-postmortem.json`
7. Improve runtime audit:
   - review mode
   - fallback visibility
   - participant-level fallback capture
8. Reduce prompt bloat by giving the leader a normalized reviewer summary instead of raw reviewer blobs.
9. Keep all changes boxed to:
   - `shared/learning-engine/`
   - `tools/agent-role-builder/`

---

## Historical Commit Trail

This is the relevant local commit trail leading into the current fix lane.

### Architecture and planning

- `860905c` - Add Step 2e tool bootstrap plan, log convergence bug to Brain
- `399dc09` - Add Review Process Architecture - complete governance specification
- `b5d8f06` - Implement shared learning engine + compliance/fix map schemas (Track 1)
- `6304862` - Add efficiency optimization plan - merge 3 LLM calls into 1

### Runtime hardening and convergence work

- `b246074` - Implement error escalation pattern + fix leader parse failure
- `0302472` - Fix error escalation review: 3 major + 2 minor resolved
- `79cdbfa` - Fix 3 board bugs: full-stop on failure, error!=reject, pre-validation
- `30bc958` - Fix all 7 bugs: Codex stdin, rulebook wiring, efficiency merge
- `214a1c9` - Fix 6 bugs + deep analysis: revision crash, type safety, split-verdict
- `c17f72a` - Fix all 6 minor issues - zero outstanding
- `58bdf8a` - Add source authority references to revision prompt + save context
- `3214408` - Fix prompt size: write context to files, keep prompts under 4KB

### Observed run state

- `d81e2a3` - Run 012: first real 2-reviewer run - 4->4->3 unresolved, Claude conditional R2
- `a8adc39` - Run 013: 4 unresolved, 0 crashes, rulebook 15->22, learning engine working
- `5eb4502` - Run 016: blocked - Codex exit null on revision (not prompt size)

Interpretation:

- the commit trail fixed many real transport/runtime issues
- but it still left the review contract, KPI, and audit model under-specified in the live runtime

---

## This Round: Implemented Changes

This round is currently a working-tree change set. It has not been committed yet.

### A. New shared review contract artifacts

Added:

- `shared/learning-engine/review-contract.json`
- `shared/learning-engine/code-review-contract.json`

These establish:

- canonical verdict/severity protocol
- review modes
- implementer/reviewer/leader output expectations
- audit requirements
- boxed component ownership rules

### B. New component-local boxed contract

Added:

- `tools/agent-role-builder/review-contract.json`

Updated:

- `tools/agent-role-builder/review-prompt.json`

These now declare:

- component-local review modes
- source authority paths
- schema refs
- ignore areas
- budget hints

### C. Shared schema tightening

Updated:

- `shared/learning-engine/compliance-map.ts`
- `shared/learning-engine/fix-items-map.ts`
- `shared/learning-engine/types.ts`
- `shared/learning-engine/engine.ts`
- `shared/learning-engine/review-prompt-template.json`

Main changes:

- `ComplianceMap` now supports `non_compliant`
- fix items and fix decisions can carry `finding_id`
- the learning engine can receive component-local prompt/contract paths
- the template now reflects boxed review modes and authority-path concepts

### D. Runtime contract loading and prompt normalization

Added:

- `tools/agent-role-builder/src/services/review-runtime.ts`

Updated:

- `tools/agent-role-builder/src/services/board.ts`

Main changes:

- board loads shared + component review config
- review mode is now explicit per round
- reviewer identity is slot-based instead of provider-only
- leader prompt now receives normalized reviewer summaries
- reviewer `fix_decisions` are pulled into next-round fix checklist logic

### E. Built-in KPI and postmortem artifact emission

Updated:

- `tools/agent-role-builder/src/services/board.ts`
- `tools/agent-role-builder/src/index.ts`

Main changes:

- `run-postmortem.json` is written as rounds complete
- `cycle-postmortem.json` is written on terminal result
- KPI summary now includes:
  - unresolved trend
  - fallback count
  - participant counts
  - reviewer reuse savings
  - latency rollups

### F. Fallback audit improvements

Updated:

- `tools/agent-role-builder/src/shared-imports.ts`
- `tools/agent-role-builder/src/schemas/result.ts`

Main changes:

- LLM telemetry events now record primary/fallback outcomes
- fallback emits a warning in the standalone invoker path
- participant records can carry `was_fallback`
- telemetry buffer can be cleared at run start

### G. Revision contract alignment

Updated:

- `tools/agent-role-builder/src/services/role-generator.ts`

Main changes:

- revision was replaced with a boxed component-repair-engine style flow
- the repair path now writes a run-scoped bundle with manifest, copied component config, copied authority docs, findings, and self-check evidence
- revision no longer depends on broad bypass access for repo roaming
- Codex remains primary and Claude is selected as the repair fallback when the leader provider is Codex

### H. Shared runtime extraction

Added:

- `shared/review-engine/`
- `shared/component-repair-engine/`

Main changes:

- shared review runtime config/types now exist under `shared/review-engine/`
- shared component-repair runtime/types now exist under `shared/component-repair-engine/`
- these shared modules define the generic protocol shape future governed components can use

### I. Standard sequence enforcement in the live board

Updated:

- `tools/agent-role-builder/src/services/board.ts`
- `tools/agent-role-builder/src/services/validator.ts`

Main changes:

- round 0 now starts with an initial rulebook sweep instead of heuristic compliance guessing
- the board now runs learning before terminal freeze decisions
- freeze is blocked when repair work still exists from:
  - reviewer findings
  - rejected fix decisions
  - non-compliant rule entries
  - self-check failures
- conditional/minor follow-up now forces a repair pass and a re-review path instead of freezing early
- stale heuristic initial compliance generation was removed
- required output / completion self-check gaps are now execution-gating errors, not warnings

---

## Current Working Tree Files

Modified:

- `shared/review-engine/config.ts`
- `shared/review-engine/engine.ts`
- `shared/review-engine/types.ts`
- `shared/component-repair-engine/engine.ts`
- `shared/component-repair-engine/types.ts`
- `shared/learning-engine/compliance-map.ts`
- `shared/learning-engine/engine.ts`
- `shared/learning-engine/fix-items-map.ts`
- `shared/learning-engine/review-prompt-template.json`
- `shared/learning-engine/types.ts`
- `tools/agent-role-builder/review-prompt.json`
- `tools/agent-role-builder/src/index.ts`
- `tools/agent-role-builder/src/schemas/result.ts`
- `tools/agent-role-builder/src/services/board.ts`
- `tools/agent-role-builder/src/services/role-generator.ts`
- `tools/agent-role-builder/src/shared-imports.ts`

Added:

- `shared/learning-engine/code-review-contract.json`
- `shared/learning-engine/review-contract.json`
- `shared/review-engine/config.ts`
- `shared/review-engine/engine.ts`
- `shared/review-engine/types.ts`
- `shared/component-repair-engine/engine.ts`
- `shared/component-repair-engine/types.ts`
- `tools/agent-role-builder/review-contract.json`
- `tools/agent-role-builder/src/services/review-runtime.ts`

---

## Verification Done In This Round

Completed:

- TypeScript validation for `agent-role-builder`
- TypeScript validation for `shared`

Command:

```powershell
& 'C:\ADF\tools\agent-role-builder\node_modules\.bin\tsc.cmd' --noEmit -p 'C:\ADF\tools\agent-role-builder\tsconfig.json'
```

Result:

- passed with 0 TypeScript errors

Command:

```powershell
& 'C:\ADF\shared\node_modules\.bin\tsc.cmd' --noEmit -p 'C:\ADF\shared\tsconfig.json'
```

Result:

- passed with 0 TypeScript errors

Not completed in this round:

- full end-to-end live run of `agent-role-builder`

Reason:

- the new flow was exercised in a real self-role run (`agent-role-builder-self-role-017-test`) far enough to confirm:
  - initial component-repair-engine sweep executed and wrote boxed audit artifacts
  - round 0 review executed
  - round 0 learning executed and added a new rule
  - revision-r0 bundle was created with boxed repair inputs
- that run then timed out before terminal completion during the first revision pass, so terminal-state verification is still pending

---

## What This Round Does Not Solve Yet

These items remain open:

1. A real live governed run is still needed to validate the new boxed repair path under actual Codex/Claude execution.
2. At the point this log was last updated, the code changes were still not committed.

---

## Components Still Requiring Work

The implementation footprint for this closure round spans these components:

- `tools/agent-role-builder/`
- `shared/review-engine/`
- `shared/component-repair-engine/`
- `shared/learning-engine/`

---

## Recommended Next Step

Run one real `agent-role-builder` self-role job against the updated runtime and confirm:

- boxed contracts are loaded
- `run-postmortem.json` is produced
- `cycle-postmortem.json` is produced
- `review.json` includes `reviewMode`
- participant records include `was_fallback` when applicable
- the run reaches a correct terminal state or exposes the next concrete runtime bug

If the run passes, commit this round as the first "review-contract + KPI integration" checkpoint.
