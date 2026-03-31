# Agent Role Builder: Replay vs Run 018 Artifact and Learning Analysis

Date: 2026-03-31

## Purpose

This report compares the two most relevant self-role artifacts for `agent-role-builder`:

- `replay`: `tools/agent-role-builder/runs/agent-role-builder-self-role-001-replay-001/`
- `run 018`: `tools/agent-role-builder/runs/agent-role-builder-self-role-018/`

It answers four questions:

1. Is the replay artifact actually better than run 018 when judged by artifact quality, source-faithfulness, internal coherence, governance precision, and operational usability?
2. What does run 018 still cover better than replay?
3. Why did the self-learning engine fail to turn the missing pieces into usable rule improvements?
4. What exact rules and pipeline changes would let replay keep its stronger semantics and also surpass run 018 cleanly?

This report is written for a reader with no prior chat context.

## Scope and Sources Reviewed

### Replay run artifacts

- `tools/agent-role-builder/runs/agent-role-builder-self-role-001-replay-001/agent-role-builder-role.md`
- `tools/agent-role-builder/runs/agent-role-builder-self-role-001-replay-001/agent-role-builder-role-contract.json`
- `tools/agent-role-builder/runs/agent-role-builder-self-role-001-replay-001/agent-role-builder-board-summary.md`
- `tools/agent-role-builder/runs/agent-role-builder-self-role-001-replay-001/result.json`
- `tools/agent-role-builder/runs/agent-role-builder-self-role-001-replay-001/self-check.json`
- `tools/agent-role-builder/runs/agent-role-builder-self-role-001-replay-001/runtime/run-telemetry.json`
- `tools/agent-role-builder/runs/agent-role-builder-self-role-001-replay-001/rounds/round-0/review.json`
- `tools/agent-role-builder/runs/agent-role-builder-self-role-001-replay-001/rounds/round-0/learning.json`

### Run 018 artifacts

- `tools/agent-role-builder/runs/agent-role-builder-self-role-018/agent-role-builder-role.md`
- `tools/agent-role-builder/runs/agent-role-builder-self-role-018/agent-role-builder-role-contract.json`
- `tools/agent-role-builder/runs/agent-role-builder-self-role-018/agent-role-builder-board-summary.md`
- `tools/agent-role-builder/runs/agent-role-builder-self-role-018/result.json`
- `tools/agent-role-builder/runs/agent-role-builder-self-role-018/self-check.json`
- `tools/agent-role-builder/runs/agent-role-builder-self-role-018/conditions-manifest.json`
- `tools/agent-role-builder/runs/agent-role-builder-self-role-018/runtime/run-telemetry.json`
- `tools/agent-role-builder/runs/agent-role-builder-self-role-018/rounds/round-0/review.json`
- `tools/agent-role-builder/runs/agent-role-builder-self-role-018/rounds/round-0/learning.json`

### Learning-engine and board code

- `shared/self-learning-engine/types.ts`
- `shared/self-learning-engine/engine.ts`
- `tools/agent-role-builder/src/services/board.ts`
- `tools/agent-role-builder/src/services/rulebook-promotion.ts`

## Executive Summary

Replay is the better artifact overall, but it is not yet a clean superset of run 018.

Replay wins on the most important dimension: governance semantics. It fixes the core freeze-legality problem by separating `material pushback` from `reviewer-clear`, preserving split-verdict plus `regression_sanity` behavior, and making freeze depend on actual reviewer-state legality instead of only on unresolved blocking or major findings. Evidence: replay role `agent-role-builder-role.md:91-108`, `143-180`, and `217-233`.

Run 018 still covers some operational branches better than replay. It declares a pre-review pushback closeout, explicit `resume_required` output handling, budget exhaustion behavior, history snapshots for update/fix, and honest "not yet implemented" self-check labeling. Evidence: run 018 role `agent-role-builder-role.md:157-167`, `221-229`, `257-275`, `306-311`, and `343-347`.

Replay's biggest remaining weakness is cross-surface drift. Its markdown role is stronger than run 018, but its JSON contract remains close to an older, much thinner model. Evidence: replay markdown authority and inputs at `agent-role-builder-role.md:8-40` and `74-89` versus replay contract authority and inputs at `agent-role-builder-role-contract.json:91-109` and `131-145`.

The self-learning engine did not capture the most important missing pieces because the board layer flattened reviewer findings before the engine saw them, the learning schema is too lossy, the engine cannot express "tighten ARB-004" or "route this to contract parity," and rulebook promotion only applies brand-new rule IDs. Evidence: `board.ts:466-467`, `board.ts:546-557`, `board.ts:1802-1845`, `types.ts:7-13`, `types.ts:50-60`, `engine.ts:85-90`, and `rulebook-promotion.ts:96-123`.

The current fix direction has changed in one important way: the first concrete remediation step is no longer "patch the learning engine in place." The first step is to create a new governed top-level `implementation-engine` and use that as the generic implementation, review, compliance, learning, and revision loop for governed artifacts. The learning-engine fixes then attach to that engine instead of remaining scattered inside ARB.

## Architecture Decision Update (2026-03-31)

### New decision

ADF does not currently have a governed generic implementation tool. It has shared sub-engines and one mature domain tool:

- `shared/self-learning-engine/` for rule extraction
- `shared/rules-compliance-enforcer/` for rule walk and governed revision
- `shared/review-engine/` for review execution
- `tools/agent-role-builder/` as the most mature current domain implementation of the full governed loop

The first step in fixing the replay vs run 018 quality gaps and the learning-engine blind spots is therefore to create a new governed `implementation-engine`.

### Why `implementation-engine` is now Step 1

The missing replay improvements are not only learning problems. They are governed implementation problems:

- no stable generic implementer that can take review findings and produce evidence-backed artifact revisions
- no generic place to combine review, rule-compliance, learning, and re-verification into one reusable loop
- no generic place to enforce thread-safe, gated rulebook mutation when multiple implementation jobs run in parallel

Until that top-level engine exists, learning improvements remain partially trapped inside ARB-specific code paths.

### Why not use `llm-tool-builder` as the builder of record yet

`llm-tool-builder` is not mature enough yet to build the first version of `implementation-engine`.

- Its current code path validates a request, optionally invokes ARB, writes `tool-contract.json`, and writes `result.json`. Evidence: `tools/llm-tool-builder/src/index.ts:36-123`.
- It does not yet execute a governed implement -> rules-compliance -> review -> learning -> revise -> verify loop.
- By contrast, ARB already contains a working governed pattern with validation, artifact generation, board execution, telemetry, postmortems, and future-run rulebook promotion. Evidence: `tools/agent-role-builder/src/index.ts:7-16`, `224-291`, `745`, `771-786`, and `932-1224`.

### What `implementation-engine` must be at a high level

The agreed model is:

- the engine has its own fixed role, contract, and generic implementer rulebook
- each invocation also supplies target-specific governance inputs
- the engine's own contract stays fixed even when the target artifact is itself a contract
- the engine is parallel-safe for work execution
- governance-surface promotion and shared-governance mutation go through a serialized gatekeeper path

Additional boundary decisions now frozen for Step 1:

- `implementation-engine` is a top-level orchestrator, not a replacement for every shared engine
- it should orchestrate `shared/review-engine/`, `shared/self-learning-engine/`, and `shared/rules-compliance-enforcer/`
- it should not absorb governance ownership of those shared engines
- `shared/component-repair-engine/` is not part of the target steady-state stack and should be merged into, aliased to, or retired in favor of `shared/rules-compliance-enforcer/`
- the gatekeeper must route and serialize changes across rulebook, contract, validator or enforcer, review prompt, and docs surfaces, not only rulebooks
- terminal semantics must include `frozen_with_conditions`
- conditional acceptance remains invoker-owned, not silently engine-owned
- parity audit is part of Step 1, not a later optional enhancement

This means the future fix path is:

- build `implementation-engine` first
- then improve learning and parity flows around that generic engine
- then move ARB and other governed tools onto that reusable base

Detailed step-1 plan: `docs/contex/learning-engine-fix-step-1-implementation-engine.md`

## High-Level Verdict

| Dimension | Replay | Run 018 | Winner |
|---|---|---|---|
| Freeze legality and review semantics | Stronger | Weaker | Replay |
| Authority layering | Stronger | Good | Replay |
| Scope and input precision | Stronger | Good | Replay |
| Non-happy-path branch coverage | Thinner | Stronger | Run 018 |
| Artifact matrix completeness | Good, but missing some branches | Stronger | Run 018 |
| Self-check honesty | Over-claims by omission | More honest | Run 018 |
| Markdown to JSON parity | Poor | Also poor, but branch coverage is better | Run 018 on branch coverage, neither on true parity |
| Board summary fidelity | Imperfect | Imperfect | Neither |
| Actual run package coherence | Better role semantics | Better branch surface | Mixed |
| Best overall base artifact | Yes | No | Replay |

## Detailed Replay vs Run 018 Comparison

### 1. Role and mission clarity

Replay is clearer and more disciplined.

- Replay defines a standing mission in governance terms: create, update, and repair governed role packages; stop at missing authority, missing prerequisites, or material pushback. Evidence: replay role `agent-role-builder-role.md:4-6`.
- Run 018 is also clear, but it still frames the role partly in terms of board-review orchestration and self-governance bootstrap rather than as a durable governance package. Evidence: run 018 role `agent-role-builder-role.md:4-6`.

Assessment: replay is stronger.

### 2. Authority model

Replay is materially better.

- Replay uses a layered authority chain: COO controller, shared review contract, component review contract, then rulebook. It explicitly separates runtime-scoped inputs from reference evidence. Evidence: replay role `agent-role-builder-role.md:8-40`.
- Run 018 improved its authority model over earlier runs by collapsing operative authority to the COO controller plus the active runtime review contract and moving rulebook and review-prompt into a separate governance-file list. Evidence: run 018 role `agent-role-builder-role.md:8-19`.
- However, replay is still more explicit about writable surface, inherited runtime obligations, and the relationship between active review contracts and runtime-scoped inputs. Evidence: replay role `agent-role-builder-role.md:25-40`.

Assessment: replay is stronger.

### 3. Scope and ownership boundaries

Replay is stronger.

- Replay keeps scope and ownership tight and non-contradictory. Evidence: replay role `agent-role-builder-role.md:43-62`.
- Run 018 is good, but replay is more explicit that board-facing audit artifacts and promotion behavior are in scope, while broader runtime orchestration is not. Evidence: replay role `agent-role-builder-role.md:50-55`.

Assessment: replay is stronger.

### 4. Context gathering and prerequisites

Replay is stronger.

- Replay requires loading the active shared review contract reference, active component review contract, governance files, source refs, baseline package, resume package, and runtime review settings before Step 1. Evidence: replay role `agent-role-builder-role.md:64-89`.
- Run 018 has a smaller prerequisite set. It loads request, source refs, runtime review contract, governance files, baseline package, and resume package, but it does not carry the same explicit runtime settings and contract layering detail. Evidence: run 018 role `agent-role-builder-role.md:63-91`.

Assessment: replay is stronger.

### 5. Guardrails and semantic definitions

Replay is the strongest artifact in this category.

- Replay defines `material pushback`, `reviewer-clear`, and `round leader` once and then reuses them everywhere. Evidence: replay role `agent-role-builder-role.md:91-108`.
- Replay explicitly states that any active reviewer `reject`, even on minor items, keeps `reviewer-clear` false and blocks both frozen states. Evidence: replay role `agent-role-builder-role.md:100-105`.
- Run 018 improved mutual exclusivity and no-arbitration vs arbitration semantics, but it still anchors `frozen_with_conditions` to arbitration use only. Evidence: run 018 role `agent-role-builder-role.md:94-114`.
- The actual run 018 package contradicts that rule, because the run ends `frozen_with_conditions` with `arbitration_used: false` and uses deferred items instead. Evidence: run 018 result `result.json:7-10`, `result.json:18-25`, and `conditions-manifest.json:5-8`.

Assessment: replay is stronger and more source-faithful.

### 6. Step flow and round mechanics

This is the most mixed category.

Replay advantages:

- Replay has the clearest split-verdict and `regression_sanity` mechanics. Evidence: replay role `agent-role-builder-role.md:143-165`.
- Replay correctly delays freeze after split-verdict convergence until the previously approving reviewer completes `regression_sanity`. Evidence: replay role `agent-role-builder-role.md:161-165`; replay board summary `agent-role-builder-board-summary.md:39-43`; replay result leader verdict `result.json:110-114`.

Run 018 advantages:

- Run 018 explicitly distinguishes Step 1 validation failure from pre-review semantic ambiguity. Evidence: run 018 role `agent-role-builder-role.md:132-135`.
- Run 018 explicitly defines budget exhaustion and `resume_required`. Evidence: run 018 role `agent-role-builder-role.md:221-225`, `257-262`, and `331-335`.
- Run 018 explicitly defines the pre-review pushback exit and its artifacts. Evidence: run 018 role `agent-role-builder-role.md:271-275` and `343-347`.

Assessment: replay is better on legality of review and freeze; run 018 is better on branch completeness.

### 7. Output declarations and artifact matrix

Run 018 still covers more.

- Replay has a strong matrix with canonical role content, canonical governance history, and run-scoped evidence. Evidence: replay role `agent-role-builder-role.md:182-215`.
- But replay does not declare a dedicated pre-review pushback artifact, a `resume-package.json`, or history snapshots for update/fix. Evidence: replay role `agent-role-builder-role.md:175-179`, `199-214`, and `227-232`.
- Run 018 declares `resume-package.json`, `agent-role-builder-pushback.json`, decision-log snapshot, prior board-summary snapshot, and the write timing for each. Evidence: run 018 role `agent-role-builder-role.md:294-311`.
- Run 018 is still not complete: the actual run package contains `conditions-manifest.json`, but the role markdown never declares it in the artifact matrix. Evidence: run 018 result `result.json:17-19`; run 018 conditions file `conditions-manifest.json:1-12`; run 018 matrix `agent-role-builder-role.md:290-311`.

Assessment: run 018 is stronger on branch coverage, but neither artifact has a fully authoritative matrix.

### 8. Completion and terminal-state semantics

Replay is stronger overall.

- Replay defines ordered mutually exclusive terminal predicates and clearly separates `resume_required`, `pushback`, `frozen_with_conditions`, and `frozen`. Evidence: replay role `agent-role-builder-role.md:217-233`.
- Replay allows `frozen_with_conditions` when reviewer-clear is true, no material pushback remains, and either arbitration was used or deferred minor items remain accepted as conditions. Evidence: replay role `agent-role-builder-role.md:222-223`.
- Run 018 defines `frozen_with_conditions` as the arbitration-used path and `frozen` as the no-arbitration path. Evidence: run 018 role `agent-role-builder-role.md:96-99`, `251-255`, and `326-329`.
- The actual run 018 result contradicts that theory: the result is `frozen_with_conditions`, yet `arbitration_used` is `false`. Evidence: run 018 result `result.json:7-10` and `result.json:24-25`.

Assessment: replay is stronger because its semantics match the kind of package the runs actually produce.

### 9. Markdown to JSON contract alignment

Both are weak. Replay is worse because its markdown advanced further while the JSON stayed behind.

Replay drift:

- Markdown authority is layered and contract-driven. Evidence: replay role `agent-role-builder-role.md:8-40`.
- JSON authority still says the role is subordinate to `docs/v0/architecture.md` and `docs/VISION.md`. Evidence: replay contract `agent-role-builder-role-contract.json:91-109`.
- Markdown inputs require reviewer roster, round mode, job id, runtime settings, and governance files. Evidence: replay role `agent-role-builder-role.md:74-89`.
- JSON inputs only require request JSON and source refs. Evidence: replay contract `agent-role-builder-role-contract.json:131-145`.
- Markdown outputs declare a full artifact matrix. Evidence: replay role `agent-role-builder-role.md:182-215`.
- JSON outputs still declare only four package artifacts plus broad state changes. Evidence: replay contract `agent-role-builder-role-contract.json:221-245`.

Run 018 drift:

- Run 018 contract also remains tied to older subordinate-to docs and a thinner output model. Evidence: run 018 contract `agent-role-builder-role-contract.json:85-103`, `125-137`, and `215-249`.
- Run 018's contract does at least carry more non-happy-path concepts than replay's contract, including `resume-package.json` and pushback artifacts. Evidence: run 018 contract `agent-role-builder-role-contract.json:198-212` and `233-244`.

Assessment: neither artifact has true markdown/JSON parity; replay's mismatch is more consequential because the markdown is substantially richer than the contract.

### 10. Self-check credibility

Run 018 is more honest; replay has better target behavior but weaker evidence honesty.

- Replay Step 3 claims semantic checks for output lifecycle, reviewer legality, and terminal mutual exclusivity. Evidence: replay role `agent-role-builder-role.md:132-139`.
- Yet the run-level `self-check.json` is literally empty. Evidence: replay self-check `self-check.json:1`.
- Replay result also reports `self_check_issue_count: 0`, which makes the empty evidence look like a fully successful check rather than a not-implemented surface. Evidence: replay result `result.json:145-150`.
- Run 018 explicitly says some self-checks are "Target-state checks not yet implemented." Evidence: run 018 role `agent-role-builder-role.md:157-165`.
- But run 018's run-level `self-check.json` is also empty. Evidence: run 018 self-check `self-check.json:1`.

Assessment: both are weak on actual evidence, but run 018 is better on honesty.

### 11. Board summary fidelity

Both board summaries are unreliable enough that `result.json` remains the safer source of truth.

Replay:

- Board summary round 2 says `Leader verdict: frozen`. Evidence: replay board summary `agent-role-builder-board-summary.md:39-40`.
- The rationale in that same section says freeze is not yet available. Evidence: replay board summary `agent-role-builder-board-summary.md:41-43`.
- The actual participant record for that round shows the leader verdict was `pushback`. Evidence: replay result `result.json:110-114`.

Run 018:

- Board summary round 2 says `Leader verdict: frozen_with_conditions`. Evidence: run 018 board summary `agent-role-builder-board-summary.md:43-45`.
- The same section says "Leader returned frozen while non-material repair work remained." Evidence: run 018 board summary `agent-role-builder-board-summary.md:46`.
- The actual participant record shows the leader verdict was `frozen`, while the effective run status became `frozen_with_conditions`. Evidence: run 018 result `result.json:93-99` and `result.json:7-10`.

Assessment: neither board summary is sufficiently reliable as the sole governance record.

## What Run 018 Still Does Better Than Replay

Run 018 still has six important advantages:

1. Explicit pre-review pushback closeout.
   Evidence: `agent-role-builder-role.md:271-275` and `343-347`.

2. Explicit `resume_required` and budget exhaustion handling.
   Evidence: `agent-role-builder-role.md:221-225`, `257-262`, and `331-335`.

3. Explicit history snapshots before mutating canonical files on update/fix.
   Evidence: `agent-role-builder-role.md:116-120`, `247-248`, and `310-311`.

4. More honest self-check language about what is not implemented.
   Evidence: `agent-role-builder-role.md:157-165`.

5. Better branch artifact coverage in both role text and contract.
   Evidence: role `agent-role-builder-role.md:294-311`; contract `agent-role-builder-role-contract.json:198-212` and `233-244`.

6. Useful dedicated deferred-items artifact in the actual run package.
   Evidence: `conditions-manifest.json:1-12`.

## What Replay Clearly Does Better Than Run 018

Replay has five decisive advantages:

1. Better freeze legality.
   Evidence: replay role `agent-role-builder-role.md:91-108` and `217-233`.

2. Better split-verdict plus `regression_sanity` semantics.
   Evidence: replay role `agent-role-builder-role.md:143-165`.

3. Better distinction between `material pushback` and `reviewer-clear`.
   Evidence: replay role `agent-role-builder-role.md:91-108`.

4. Better authority layering, prerequisites, and runtime-governance precision.
   Evidence: replay role `agent-role-builder-role.md:8-40` and `64-89`.

5. Better fit to the actual final-state behavior the runs need, because replay allows deferred minor conditions without requiring fake arbitration.
   Evidence: replay completion `agent-role-builder-role.md:222-223`; compare with run 018 result `result.json:24-25`.

## Rules That Would Let Replay Surpass Run 018

Replay should remain the base artifact. To surpass run 018 cleanly, it needs rules that add run 018's branch completeness without giving up replay's stronger freeze semantics.

### System and pipeline rules

- `SYS-003`: Learning input must preserve reviewer-local identity and finding-level detail.
  Do: namespace checklist IDs by reviewer and pass actual finding IDs, descriptions, source sections, severity, reviewer identity, and fix-decision outcomes.
  Do not: collapse multiple reviewers' `group-1` entries into one checklist record.

- `SYS-004`: Learning must consume the full repair surface.
  Do: feed review findings, reject-fix outcomes, compliance gaps, self-check issues, residual risks, deferred items, and terminal audit findings into the learning engine.
  Do not: learn only from the initial reviewer-group checklist.

- `SYS-005`: Learning output must support refinement and routing.
  Do: allow `refine_existing_rule`, `supersedes`, and `route_to_surface` outputs such as `component_rulebook`, `component_contract`, `validator`, or `doc_only`.
  Do not: force every gap into only `new_rules`, `existing_rules_covering`, or `no_rule_needed`.

- `SYS-006`: Every governed run must produce a learnable parity audit.
  Do: compare markdown, JSON contract, self-check evidence, and actual emitted artifact inventory after each terminal result.
  Do not: rely on reviewers alone to notice cross-surface drift.

### Artifact rules for replay

- `ARB-004 v2`: Pre-review ambiguity exits and governed-review terminal states must be distinct.
  Do: define disjoint triggers and artifact sets for `pre-review pushback`, `blocked`, `resume_required`, `frozen_with_conditions`, and `frozen`.
  Do not: let review-loop rejection and pre-review ambiguity share one `pushback` shape.

- `ARB-005 v2`: Self-checks may claim only implemented checks and must emit evidence.
  Do: label unimplemented checks as target-state only and emit real structured evidence for executed checks.
  Do not: write empty `[]` while the role claims lifecycle or parity validation.

- `ARB-009 v2`: Completion semantics must declare both write and no-write behavior per state.
  Do: enumerate what each terminal state writes and what it intentionally does not write.
  Do not: rely on "all applicable artifacts."

- `ARB-013 v2`: Update and fix paths must preserve prior canonical history mechanically.
  Do: snapshot the prior decision log and prior board summary before mutation.
  Do not: mutate canonical history without preserving a run-scoped copy.

- `ARB-016 v2`: One authoritative artifact matrix must include every conditional artifact.
  Do: include pushback artifacts, resume package, bug report, postmortems, snapshots, and any conditions manifest in one matrix.
  Do not: leave branch artifacts declared only in step prose.

- `ARB-026`: Markdown role and JSON contract must be semantically identical.
  Do: keep authority, inputs, outputs, branch semantics, and completion logic synchronized and parity-checked.
  Do not: let markdown define behavior that JSON omits or contradicts.

- `ARB-027`: `frozen_with_conditions` requires a dedicated machine-readable conditions artifact.
  Do: write a separate conditions or deferred-items manifest with IDs, rationale, and evidence.
  Do not: bury deferred conditions only in `result.json` prose.

- `ARB-028`: Completeness additions must not weaken stronger inherited freeze legality.
  Do: add pushback, resume, history, and conditions coverage on top of replay's `reviewer-clear` and `regression_sanity` gates.
  Do not: reintroduce run 018's arbitration-only definition of `frozen_with_conditions`.

## Why the Learning Engine Missed These Findings

### 1. Reviewer findings collide before the learning engine sees them

The board layer de-duplicates by plain conceptual-group ID across all reviewers.

- `collectReviewChecklist()` creates `seenChecklistIds` from raw `group.id` values. Evidence: `board.ts:1802-1819`.
- That means different reviewers can both emit `group-1`, but only the first one survives.

Run 018 proof:

- Codex reviewer round 0 emits `group-1 = "Terminal states are not source-faithful or mutually exclusive."` Evidence: `runs/agent-role-builder-self-role-018/rounds/round-0/review.json:29-31`.
- Claude reviewer round 0 also emits `group-1 = "Post-mortem artifacts absent from outputs matrix and steps"`. Evidence: `runs/agent-role-builder-self-role-018/rounds/round-0/review.json:98-100`.
- Learning output contains only one `group-1`. Evidence: `runs/agent-role-builder-self-role-018/rounds/round-0/learning.json:3-8`.

Replay proof:

- Codex reviewer round 0 emits `group-1 = "Freeze and terminal-state logic can bypass an active reviewer reject..."`. Evidence: `runs/agent-role-builder-self-role-001-replay-001/rounds/round-0/review.json:25-27`.
- Claude reviewer round 0 also emits `group-1 = "Role Not-in-scope item 5 has no counterpart..."`. Evidence: `runs/agent-role-builder-self-role-001-replay-001/rounds/round-0/review.json:65-67`.
- Learning output contains only one `group-1`. Evidence: `runs/agent-role-builder-self-role-001-replay-001/rounds/round-0/learning.json:3-8`.

Impact:

- The engine never sees the full set of reviewer findings.
- Missing artifact declarations, postmortem gaps, and scope or self-check misalignment can disappear before learning even begins.

### 2. The learning schema is too lossy

The engine only accepts group-level summaries.

- Input schema keeps only `group_id`, `summary`, `severity`, `redesign_guidance`, and `finding_count`. Evidence: `types.ts:7-13`.
- It drops finding-level descriptions, `source_section`, reviewer identity, and fix-decision outcomes.

Impact:

- The engine cannot learn from the actual concrete issue.
- It cannot distinguish "missing pre-review pushback closeout" from "missing conditions manifest" if both are flattened into broad summaries.

### 3. The board passes the wrong checklist into learning

The board builds a richer repair checklist, but learning only receives the thinner review checklist.

- `reviewChecklist` and `repairChecklist` are built together. Evidence: `board.ts:466-468`.
- `repairChecklist` extends the review checklist with compliance-map and self-check issues. Evidence: `board.ts:1875-1885`.
- But learning input is built from `reviewChecklist.map(...)`, not from `repairChecklist`. Evidence: `board.ts:546-557`.

Impact:

- Compliance non-compliance never becomes learnable input.
- Self-check failures never become learnable input.
- This directly blocks learning from issues such as "self-check claims what it cannot prove" and "artifact matrix omits declared branch artifacts."

### 4. Residual risks and deferred items are not part of the learning input

- Replay round 0 contains residual risks about budget exhaustion drift. Evidence: `runs/agent-role-builder-self-role-001-replay-001/rounds/round-0/review.json:50-52`.
- Replay round 0 also contains deferred items about scope/contract alignment. Evidence: `runs/agent-role-builder-self-role-001-replay-001/rounds/round-0/review.json:9-10`.
- The learning schema has no place for residual risks or deferred items. Evidence: `types.ts:27-36`.

Impact:

- The engine misses exactly the kind of "still weak, not terminally blocking, but should become a rule" findings that matter most for replay vs run 018.

### 5. The engine cannot express "tighten an existing rule"

- The prompt says "Prefer updating existing rules over creating new ones (but don't update here - just flag)." Evidence: `engine.ts:85-90`.
- But the output schema has only `new_rules`, `existing_rules_covering`, and `no_rule_needed`. Evidence: `types.ts:50-60`.

Impact:

- The model has no legal output shape for "ARB-004 is too broad; refine it to distinguish pre-review pushback from governed review closeout."
- As a result, the engine often collapses concrete findings into "covered by existing rule" and no change happens.

### 6. Rulebook promotion only applies brand-new rule IDs

- Promotion merges `parsedLearning.new_rules` into the rulebook. Evidence: `rulebook-promotion.ts:96-104`.
- If no new IDs are added, the status becomes `no_new_rules`. Evidence: `rulebook-promotion.ts:106-123`.

Impact:

- Even if the right answer is "tighten ARB-005" or "supersede ARB-016," the current future-run promotion path cannot do that.
- The system is append-only by new rule ID.

## What the Run Logs and Learning Artifacts Show

### Replay

- Replay completed four rounds and reached `frozen`. Evidence: `runtime/run-telemetry.json:10-18`.
- The self-learning engine ran twice, saw four review findings, and proposed zero new rules. Evidence: `runtime/run-telemetry.json:89-107`.
- Rule metrics show repeated `learning_cover_count` hits but zero proposals. Evidence: `runtime/run-telemetry.json:114-287`.
- Round 0 learning output contains only one covered finding group and no new rules. Evidence: `rounds/round-0/learning.json:1-10`.

Interpretation:

- Replay produced richer telemetry than run 018, but the richer telemetry did not help the learning surface.
- The engine mainly said "already covered" and proposed nothing.

### Run 018

- Run 018 completed three rounds and ended `frozen_with_conditions`. Evidence: `runtime/run-telemetry.json:10-25`.
- Round 0 learning output mapped five conceptual groups to existing rules and proposed zero new rules. Evidence: `rounds/round-0/learning.json:1-31`.
- Several of those findings were exactly the branch-completeness and artifact-matrix issues later relevant to replay: postmortems, blocked routing, snapshot production, and artifact-matrix omissions. Evidence: `rounds/round-0/review.json:99-157`.

Interpretation:

- The engine saw the branch-coverage failures in run 018.
- It still emitted no new rules, because the current model and promotion pipeline cannot refine an existing rule or route the fix to contract parity and artifact-matrix completeness.

## Recommended Solution: Keep Replay as the Base, Add the Best of Run 018, Fix the Learning Pipeline

### A. Use replay as the semantic base

Keep these replay strengths:

- `reviewer-clear` as a distinct legality gate
- `material pushback` as a distinct severity gate
- split-verdict convergence plus `regression_sanity`
- `frozen_with_conditions` that allows accepted deferred minor items without pretending arbitration occurred

Evidence: replay role `agent-role-builder-role.md:91-108`, `161-165`, and `217-233`.

### B. Merge back the best operational coverage from run 018

Merge these concepts into replay:

- pre-review pushback closeout with its own artifact
- explicit `resume_required` and budget-exhaustion branch
- explicit update/fix history snapshots
- machine-readable deferred-items artifact for conditional freeze
- honest "not yet implemented" self-check labeling unless real evidence exists

Evidence: run 018 role `agent-role-builder-role.md:157-165`, `221-225`, `257-275`, `294-311`, and `343-347`; run 018 conditions artifact `conditions-manifest.json:1-12`.

### C. Add a parity audit stage after every terminal run

The audit should compare:

- role markdown
- role contract JSON
- actual emitted artifacts in the run directory
- self-check evidence
- terminal result payload

It should emit synthetic findings for:

- markdown/JSON drift
- missing branch artifacts
- undeclared emitted artifacts such as `conditions-manifest.json`
- empty self-check evidence when the role claims implemented checks

### D. Change the learning input shape

Pass to the learning engine:

- reviewer-qualified group IDs such as `reviewer-0::group-1`
- finding IDs and descriptions
- `source_section`
- reviewer identity
- fix-decision outcomes
- compliance-map non-compliance
- self-check issues
- residual risks
- deferred items
- parity-audit findings

### E. Change the learning output shape

Add outputs such as:

- `refine_existing_rules`
- `new_rules`
- `route_to_surface`
- `requires_validator_change`
- `requires_contract_parity_change`

That lets the system say:

- "tighten ARB-004"
- "add ARB-026"
- "fix contract parity, not rulebook wording"
- "self-check needs a validator implementation, not a prose rule only"

## Updated Master Plan

The earlier plan in this report focused on patching the learning pipeline directly. The current plan is broader and starts one layer earlier.

### Step 1. Create `implementation-engine` as the generic governed implementer

Create a new governed top-level tool that owns the reusable implementation loop:

- load fixed engine governance
- load target governance inputs
- freeze a bounded implementation slice
- implement or revise the artifact
- run rules-compliance
- run review
- run learning extraction
- route governance-surface proposals through a serialized gatekeeper
- revise and re-verify
- run parity audit
- close with governed terminal semantics, including `frozen_with_conditions`

This is the first step because it creates the reusable place where replay-vs-018 lessons can be enforced generically rather than only inside ARB.

Detailed plan: `docs/contex/learning-engine-fix-step-1-implementation-engine.md`

Current draft status: bootstrap `implementation-engine` role and companion governance artifacts now exist under `tools/implementation-engine/`, but remain unfrozen pending another independent review.

Step 1 must also freeze four boundaries before role and contract drafting:

- shared-engine orchestration vs replacement
- minimum target-governance input package
- terminal-state artifact matrix
- gatekeeper mutation-routing scope

### Step 2. Upgrade the shared learning engine to feed and improve `implementation-engine`

Once `implementation-engine` exists, improve `shared/self-learning-engine/` so it can:

- preserve finding-level evidence
- learn from review and rules-enforcer outputs
- emit rule refinements, not only brand-new rules
- route changes to the correct enforcement surface
- measure effort, quality, and cost with evidence-backed KPIs

### Step 3. Retrofit ARB onto `implementation-engine`

Keep ARB as the domain authority for role-package semantics, but move its generic implementation loop onto `implementation-engine`.

That should shrink ARB to domain-specific governance, artifacts, and terminal semantics while removing its need to own the full generic revise/review/learn loop directly.

### Step 4. Mature `llm-tool-builder` after `implementation-engine` exists

`llm-tool-builder` can later be rebuilt or simplified around the new engine. It is not the right bootstrap path for Step 1, but it can become a cleaner governed tool-construction surface once the reusable implementation core exists.

## Best Combined Target State

The best future artifact is not "replay or 018." It is replay plus selected 018 operational surfaces, backed by a better learning pipeline.

The target package should have:

- replay's freeze legality and split-verdict semantics
- run 018's pre-review pushback and resume handling
- run 018's update/fix snapshot preservation
- a dedicated conditions artifact declared in the matrix
- truthful self-check evidence
- markdown and JSON kept in parity by audit, not by manual discipline
- a reusable `implementation-engine` so those behaviors are not trapped inside one ARB-specific loop

## Residual Risks

- If markdown/JSON parity is not enforced mechanically, replay will continue to look better to a human than to a machine consumer.
- If self-check evidence remains empty, the artifact will still overstate its operational trustworthiness even after prose improvements.
- If learning remains reviewer-group-only and append-only by new rule ID, the system will continue to miss refinement work and will keep reporting "covered by existing rules" while the same gaps recur.
- If board summaries remain able to drift from effective terminal results, operators may trust the wrong audit surface.

## Final Conclusion

Replay is the better artifact base because it fixes the hardest and most important problem: freeze legality and review-state semantics.

Run 018 is still valuable because it covers operational branches replay still under-specifies: pre-review pushback, resume handling, budget exhaustion, history snapshots, and self-check honesty.

The self-learning engine did not pick up those missing pieces because the board layer collapsed findings before learning, the learning schema was too lossy, the model could not express refinement, and rulebook promotion only handles brand-new rule IDs.

The right path is now:

1. Create `implementation-engine` as the generic governed implementer.
2. Use replay's semantic model as the base for ARB-specific terminal and governance semantics.
3. Merge run 018's missing branch and artifact declarations into that stronger base.
4. Add parity audit and real self-check evidence.
5. Upgrade the learning pipeline so it can learn from concrete findings and refine existing rules instead of only appending new IDs.
