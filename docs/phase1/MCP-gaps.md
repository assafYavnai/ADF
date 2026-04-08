# ADF Phase 1 Pre-MCP-Boxing Baseline Gap Report

Audit date: 2026-04-08 (fourth revision)
Audit baseline commit: `dd17128` (origin/main)
Prior baselines: `884452e`, `d929715`, `192ad0b`, `6478c6c`
Purpose: Identify code-level defects, pattern inconsistencies, and structural debt on `main` that the MCP boxing model will inherit if not fixed before boxing slice-02 begins.

This report is written for a contextless agent. Every finding includes context, evidence, related slices, dependency chains, and suggested fix approach. Fix approaches are SUGGESTIONS — the fixer agent must verify the full dependency chain before acting.

---

## How to use this report

1. Run `git log --oneline -1` and compare the SHA to `dd17128`. If main has advanced, run `git log --oneline dd17128..HEAD` to see what changed, then re-verify each finding.
2. Each finding has a "Verify" block. Run the commands. Compare to the expected output.
3. Each finding has a "Related slice / dependency chain" section. Read it before attempting a fix. A finding that looks like a standalone bug may be part of a larger governed slice.
4. Findings are ordered by priority: P1 should be fixed before MCP boxing slice-02 starts, P2 should be fixed, P3 can be deferred.
5. Fix approaches are suggestions based on incomplete analysis. The fixer agent MUST read the referenced files and branches and verify the full context before implementing.

---

## Governance state summary (as of dd17128)

All feature slices with `implement-plan-state.json` on main now show `feature_status: completed`. Zero open slices remain in the governed pipeline.

The `coo-live-executive-status-wiring` slice was completed and merged during this audit session (was the last open slice). State on main now shows `completed / merged / marked_complete`.

Important caveat for contextless agents:

- main-side feature-local truth and local control-plane projections are not always the same thing
- `mcp-boxing/slice-01-dev-team-bootstrap` is completed and merged in its own `implement-plan-state.json` on main
- but local `.codex/implement-plan/features-index.json` can still lag in some workspaces
- when those projections disagree, trust slice-local main truth first, then git truth, and treat the local control-plane projection as potentially stale

Verify:
```
for dir in docs/phase1/*/; do slug=$(basename "$dir"); if [ -f "${dir}implement-plan-state.json" ]; then node -e "const d=require('./${dir}implement-plan-state.json'); if(d.feature_status !== 'completed') console.log('OPEN: $slug', d.feature_status, d.active_run_status);" 2>/dev/null; fi; done
```
Expected: no output (all completed)

---

## Historical dependency note

The earlier primary dependency from the third revision, `governed-implementation-route-hardening`, is now already merged on `origin/main`.

Current truth:

- approved feature commit: `d419a98`
- merge commit: `253d5c0`
- final closeout commit: `dd17128`

Why keep the details below:

- several findings in this report still refer to that slice as the historical home of fixes
- contextless agents may need to know that those fixes are already on main and should not be re-opened as fresh work

That slice hardens the skill layer (`implement-plan`, `review-cycle`, `merge-queue`) with:

Code changes (448 insertions across 3 helpers):
- `skills/implement-plan/scripts/implement-plan-helper.mjs` (+132 lines): stale closeout language detection gate in `markComplete`, authoritative requirement-freeze guard detecting base-branch changes to frozen authority files
- `skills/review-cycle/scripts/review-cycle-helper.mjs` (+190 lines): fix-cycle continuity (delta-only dispatch for rejection/fix cycles), reopen guardrail (blocks cycle N+1 unless new diffs or explicit reopen), anchor persistence validation
- `skills/review-cycle/scripts/review-cycle-setup-helper.mjs`: **replaces all duplicated enums and utility functions with imports from `governed-feature-runtime.mjs`** (this is findings 1.1, 1.2, and 3.4 below)
- `skills/merge-queue/scripts/merge-queue-helper.mjs` (+126 lines): `resume-blocked` command for governed blocked-merge recovery with blocker classification

Contract/doc changes:
- `skills/implement-plan/SKILL.md` (+12 lines): requirement-freeze guard section
- `skills/review-cycle/SKILL.md` (+22 lines): fix-cycle continuity rule, reopen guardrail rule
- `skills/merge-queue/SKILL.md` (+26 lines): `resume-blocked` action, blocked-merge recovery route
- `skills/implement-plan/references/workflow-contract.md` (+13 lines): requirement-freeze guard contract
- `skills/review-cycle/references/workflow-contract.md` (+27 lines): fix-cycle continuity and reopen guardrail contracts
- `skills/merge-queue/references/workflow-contract.md` (+27 lines): blocked-merge resume/resolve rules
- `docs/bootstrap/cli-agent.md`: sibling-worker invocation examples (Windows-host + bash-workflow patterns)

Test files (1,450 lines, 19 new tests):
- `skills/tests/merge-queue-resume-blocked.test.mjs` (241 lines, 5 tests)
- `skills/tests/requirement-freeze-guard.test.mjs` (387 lines, 4 tests)
- `skills/tests/review-cycle-continuity-reopen.test.mjs` (605 lines, 4 tests)
- `skills/tests/stale-closeout-language.test.mjs` (217 lines, 6 tests)

Historical governance artifacts produced by that slice:
- `docs/phase1/governed-implementation-route-hardening/` — full slice lifecycle: README, context, contract, brief, pushback, completion-summary, 4 review cycles (cycle-01 through cycle-04), state.json, execution contracts

Review cycle history on branch:
- cycle-01: initial implementation reviewed, route gaps found
- cycle-02: behavioral enforcement fixes, artifact route closed
- cycle-03: review-cycle route defects closed
- cycle-04: anchor persistence and delta-only dispatch defects closed (most recent)

Verification status (from branch completion-summary):
- `node --check` passed on all modified helpers
- All 54 tests pass (19 new + 35 existing), zero regressions
- `git diff --check` passed

Why this matters for MCP boxing: These fixes are already in the current main baseline, so agents should treat them as present behavior rather than as a pending prerequisite branch.
- No stale-closeout language validation in `implement-plan`
- No requirement-freeze guard in `implement-plan`
- No fix-cycle continuity in `review-cycle` (full prompt resend instead of delta-only)
- No reopen guardrail in `review-cycle`
- No governed blocked-merge recovery in `merge-queue`
- Duplicated enums/utilities in `review-cycle-setup-helper.mjs`

Historical verify command from the earlier revision:
```
git merge-base --is-ancestor implement-plan/phase1/governed-implementation-route-hardening main && echo MERGED || echo "UNMERGED ($(git rev-list --count main..implement-plan/phase1/governed-implementation-route-hardening) ahead)"
```
Expected in the third revision: `UNMERGED (10 ahead)`

Historical merge test from the earlier revision:
```
git merge --no-commit --no-ff implement-plan/phase1/governed-implementation-route-hardening 2>&1; echo "EXIT: $?"; git merge --abort 2>/dev/null
```
Expected in the third revision: `Automatic merge went well; stopped before committing as requested` and `EXIT: 0`

---

## P1 findings

### 1.1 + 1.2 + 3.4 review-cycle-setup-helper.mjs duplicates enums, utilities, and has dead code

File on main: `skills/review-cycle/scripts/review-cycle-setup-helper.mjs`

Problem: Lines 18-59 define 5 enum constants locally (`ACCESS_MODES`, `RUNTIME_PERMISSION_MODELS`, `EXECUTION_RUNTIMES`, `PERSISTENT_EXECUTION_STRATEGIES`, `CAPABILITY_KEYS`). Lines 548-675 define 14+ utility functions locally (`parseArgs`, `requiredArg`, `booleanArg`, `normalizeSlashes`, `nowIso`, `isPlainObject`, `isFilled`, `describeError`, `pathExists`, `readJson`, `writeJson`, `printJson`, `fail`, etc.). Line 541 defines `isSetupComplete()` which is never called. Lines 65-78 define a local `installBrokenPipeGuards()`.

All of these should be imported from `skills/governed-feature-runtime.mjs`, as the other setup helpers do:
- `skills/implement-plan/scripts/implement-plan-setup-helper.mjs` lines 4-30: imports all from `governed-feature-runtime.mjs`
- `skills/merge-queue/scripts/merge-queue-setup-helper.mjs` lines 2-27: same pattern

Related slice / dependency chain:
**This fix is ALREADY IMPLEMENTED on `origin/main` via `governed-implementation-route-hardening`** (implementation commit `1fb89af`, merged through `253d5c0`, finalized by `dd17128`). The slice replaces all local definitions with imports and keeps only `booleanFallback`, `coalesceNonEmpty`, and `normalizeStringArray` as local helpers (no export in `governed-feature-runtime.mjs`). It also replaces `writeJson` calls with `writeJsonAtomic`, removes `isSetupComplete`, and moves the `main()` call to match the pattern in other helpers.

DO NOT fix this standalone. It is already resolved on the current main baseline.

Verify on main:
```
grep -n "const ACCESS_MODES\|const RUNTIME_PERMISSION\|const EXECUTION_RUNTIME" skills/review-cycle/scripts/review-cycle-setup-helper.mjs
```
Expected if still open: 3 lines showing local const definitions
Expected if fixed (after hardening merge): no output

### 1.3 merge-queue-setup-helper.mjs does not emit llm_tools in setup output

File: `skills/merge-queue/scripts/merge-queue-setup-helper.mjs`

Problem: The `deriveSetup()` function does not include `llm_tools` in its returned setup object. Both `implement-plan-setup-helper.mjs` (line 241) and `review-cycle-setup-helper.mjs` (line 286) emit this field.

Related slice / dependency chain:
- The hardening branch (`governed-implementation-route-hardening`) does NOT touch `merge-queue-setup-helper.mjs`. This finding is independent.
- The `implement-plan-llm-tools-worker-resolution` slice (already completed and merged) added `llm_tools` to implement-plan and review-cycle but not merge-queue.
- The pattern to follow is in `implement-plan-setup-helper.mjs` lines 147-165 (`detectLlmToolsViaPreflight()`) and line 241 (`llm_tools: input.llmTools ?? input.existing.llm_tools ?? {}`).

Suggested fix approach:
1. Read `skills/implement-plan/scripts/implement-plan-setup-helper.mjs` to understand the `detectLlmToolsViaPreflight()` pattern.
2. Read `skills/merge-queue/scripts/merge-queue-setup-helper.mjs` to understand its `deriveSetup()` structure.
3. Add `llm_tools` detection and emission matching the implement-plan pattern.
4. Run `node --check skills/merge-queue/scripts/merge-queue-setup-helper.mjs`.

Note: The fixer agent should verify whether merge-queue actually needs `llm_tools` (it may not spawn workers). If it doesn't, the fix may be to document the intentional asymmetry rather than adding the field.

Verify:
```
grep -n "llm_tools" skills/merge-queue/scripts/merge-queue-setup-helper.mjs
```
Expected if still open: no output
Expected if fixed: at least 1 match

### 1.4 setup_schema_version differs across skills with no documented reason

Files and current values:
- `skills/implement-plan/scripts/implement-plan-setup-helper.mjs` line 242: `setup_schema_version: 1`
- `skills/merge-queue/scripts/merge-queue-setup-helper.mjs` line 178: `setup_schema_version: 1`
- `skills/benchmark-suite/scripts/benchmark-suite-setup-helper.mjs` line 180: `setup_schema_version: 1`
- `skills/review-cycle/scripts/review-cycle-setup-helper.mjs` line 287: `setup_schema_version: 2`

Related slice / dependency chain:
- The hardening branch does NOT change schema versions.
- The version `2` in review-cycle may have been introduced during a prior review-cycle-specific change. The fixer agent should check `git log -p --all -S "setup_schema_version.*2" -- skills/review-cycle/scripts/review-cycle-setup-helper.mjs` to find when and why it was changed.
- This may be intentional if review-cycle setup has fields the others don't. The fixer agent should compare the setup object shapes across all helpers before normalizing.

Suggested fix approach:
1. Investigate why review-cycle uses version 2 (git history).
2. Compare the actual setup object shapes returned by each helper's `deriveSetup()`.
3. Either normalize all to the same version, or add a comment in each file explaining the version semantics.

Verify:
```
grep -rn "setup_schema_version" skills/*/scripts/*-setup-helper.mjs
```
Expected if still open: review-cycle shows `2`, others show `1`, no explanatory comments

---

## P2 findings

### 2.1 COO has no root barrel export

Problem: No `COO/index.ts` exists. Only `COO/table/index.ts` and `COO/cto-admission/index.ts` have barrel exports. These modules lack barrel files: `briefing/`, `classifier/`, `context-engineer/`, `requirements-gathering/`.

Related slice / dependency chain:
- No existing slice or branch addresses this. It is a standalone structural task.
- The hardening branch does not touch COO.
- The `coo-executive-brief-read-model` slice (completed) built `COO/briefing/` without a barrel export.
- The `company-table-queue-read-model` slice (completed) built `COO/table/` WITH a barrel export (good pattern to copy).

Suggested fix approach:
1. Read `COO/table/index.ts` and `COO/cto-admission/index.ts` as pattern references.
2. Create barrel files for modules that lack them.
3. Create `COO/index.ts` as a root re-export.
4. Run `npm --prefix COO run build` to verify.

Note: The fixer agent should check what each module actually exports before creating barrels. Some modules may be internal-only and should not have public barrel exports.

Verify:
```
ls COO/index.ts 2>/dev/null || echo "MISSING: COO/index.ts"
for d in briefing classifier context-engineer requirements-gathering; do ls "COO/$d/index.ts" 2>/dev/null || echo "MISSING: COO/$d/index.ts"; done
```
Expected if still open: `MISSING` for COO/index.ts and 4 submodules

### 2.2 COO/tsconfig.json includes empty directories and has misleading rootDir

File: `COO/tsconfig.json`

Problems:
- Includes `"intelligence/**/*"` but `COO/intelligence/` contains only `prompt.md` and an empty `role/` subdirectory (no `.ts` files)
- Includes `"shared/**/*"` but `COO/shared/` is completely empty
- `rootDir: ".."` points to repo root instead of COO directory

Related slice / dependency chain:
- No existing slice or branch addresses this. Standalone task.
- The hardening branch does not touch COO.
- `COO/intelligence/` may be a placeholder for future work. The fixer agent should check if any planning docs or Brain memories reference it before removing.
- `rootDir: ".."` exists because the COO build outputs to `dist/COO/...` which preserves the directory structure relative to the repo root. Changing rootDir to `"."` may change the dist output path structure. The fixer agent MUST test `npm --prefix COO run build` and verify the dist layout still works after any rootDir change.

Suggested fix approach:
1. Check if `intelligence/` is referenced anywhere (Brain, planning docs, PHASE1_MASTER_PLAN).
2. Remove empty includes if confirmed unused.
3. Test rootDir change carefully — the dist output path is load-bearing.

Verify:
```
ls COO/intelligence/*.ts 2>/dev/null || echo "NO TS IN intelligence/"
ls COO/shared/ 2>/dev/null; echo "FILES: $?"
node -e "const t=require('./COO/tsconfig.json'); console.log('rootDir:', t.compilerOptions.rootDir); console.log('includes:', t.include.filter(i => i.includes('intelligence') || i.includes('shared')));"
```

### 2.3 KPI pattern inconsistency across COO modules

Problem: Three different KPI instrumentation patterns exist.

| Module | File | Pattern |
|--------|------|---------|
| briefing | `COO/briefing/kpi.ts` | Functional, returns `BriefKpiReport` interface |
| table | `COO/table/kpi.ts` | Functional, returns `TableKpiReport` interface |
| cto-admission | `COO/cto-admission/kpi.ts` | Class-based `AdmissionKpiTracker` with `snapshot()` |
| cto-admission | `COO/cto-admission/live-state.ts` | Zod schema-based `AdmissionKpiState` |

Related slice / dependency chain:
- The `coo-kpi-instrumentation` slice (completed) introduced the KPI pattern. The fixer agent should read its completion summary at `docs/phase1/coo-kpi-instrumentation/completion-summary.md` to understand the original design intent.
- The hardening branch does not touch KPI.
- This may be intentional — different modules may need different patterns. The fixer agent should understand why before normalizing.

Suggested fix approach: This is likely best addressed as part of the MCP boxing telemetry design rather than as a standalone fix. Document the current patterns so the boxing agent knows what to expect.

Verify:
```
grep -n "export.*Kpi\|class.*Kpi" COO/briefing/kpi.ts COO/table/kpi.ts COO/cto-admission/kpi.ts COO/cto-admission/live-state.ts
```

---

## P3 findings

### 3.1 tools/ directory has 4 orphaned subdirectories

Directories: `tools/agent-role-builder/`, `tools/implementation-engine/`, `tools/llm-tool-builder/`, `tools/self-repair-engine/`
Each has its own `package.json` and `node_modules/`. None are referenced by `adf.sh`, any skill script, or any active tool `.mjs` file.

Related slice / dependency chain: No related slice. These appear to be pre-Phase-1 scaffolding tools. The fixer agent should check git history (`git log --oneline --all -- tools/agent-role-builder/`) to understand their origin and confirm they are truly unused before deleting.

Verify:
```
for d in tools/agent-role-builder tools/implementation-engine tools/llm-tool-builder tools/self-repair-engine; do echo "--- $d ---"; grep -rl "$(basename $d)" adf.sh skills/ tools/*.mjs 2>/dev/null | head -1 || echo "ORPHANED"; done
```

### 3.2 Provenance bug in memory-engine blocks MCP discussion writes

File: `components/memory-engine/src/provenance.ts` line 30 (`LEGACY_PROVENANCE` constant)
Documentation: `docs/bootstrap/cli-agent.md` line 115

Problem: The `LEGACY_PROVENANCE` sentinel causes `discussion_append` and `discussion_import_from_text` MCP tool calls to fail with "legacy sentinel provenance" error. Documented workaround: write to `docs/v0/context/` markdown files as fallback.

Related slice / dependency chain: No existing slice addresses this. The provenance system was built in Phase 0 (`components/memory-engine/`). The fixer agent should read `components/memory-engine/src/server.ts` (the MCP server) to find `extractToolProvenance()` and understand the validation chain before attempting a fix. This is a non-trivial fix that touches the Brain MCP surface.

Verify:
```
grep -n "LEGACY_PROVENANCE" components/memory-engine/src/provenance.ts
grep -n "provenance bug" docs/bootstrap/cli-agent.md
```

### 3.3 Hardcoded C:/ADF in test fixtures

File: `tools/agent-runtime-preflight.test.mjs` lines 29, 44-47

Problem: Test fixtures use `const repoRoot = "C:/ADF"` and hardcoded Windows-specific paths.

Related slice / dependency chain:
- The `adf-runtime-preflight-and-install-split` slice (completed) wrote these tests. The hardcoded paths were part of the original implementation.
- The hardening branch does not touch this file.

Verify:
```
grep -n '"C:/ADF"' tools/agent-runtime-preflight.test.mjs | head -5
```

### 3.5 Misplaced import in memory-engine provenance.ts

File: `components/memory-engine/src/provenance.ts`
Line 7: `import { z } from "zod";`
Line 40: `import { randomUUID } from "node:crypto";`

Problem: The `randomUUID` import appears after the `LEGACY_PROVENANCE` constant definition (line 30). All imports should be at the top.

Related slice / dependency chain: No related slice. Standalone cosmetic fix.

Verify:
```
grep -n "^import" components/memory-engine/src/provenance.ts
```
Expected if still open: imports at line 7 and line 40

### GOV-1 Stale backup branches for approved-commit-closeout-state-separation

Status: Feature branch and remote were deleted on 2026-04-08 by CEO. Two local backup branches remain:
- `backup/feature-approved-commit-closeout-state-separation-before-reset-20260406`
- `backup/main-before-approved-commit-closeout-reset-20260406`

These are pre-reset snapshots from 2026-04-06. The underlying slice is `completed / merged` on main. They carry no unique content.

Action: Delete when convenient.
```
git branch -D backup/feature-approved-commit-closeout-state-separation-before-reset-20260406
git branch -D backup/main-before-approved-commit-closeout-reset-20260406
```

Verify:
```
git branch | grep approved-commit-closeout
```
Expected if cleaned: no output

---

## Summary table

| ID | Priority | Category | File(s) | Related slice/branch | Status at dd17128 | Suggested action |
|----|----------|----------|---------|---------------------|-------------------|------------------|
| 1.1+1.2+3.4 | P1 | Enum/utility duplication + dead code | `review-cycle-setup-helper.mjs` | **governed-implementation-route-hardening** (commit `1fb89af`) | Fixed on current main baseline | No action; keep as historical reference |
| 1.3 | P1 | Missing llm_tools field | `merge-queue-setup-helper.mjs` | Independent (implement-plan-llm-tools-worker-resolution missed this) | Open | Add llm_tools or document why it's absent |
| 1.4 | P1 | Schema version drift | All `*-setup-helper.mjs` | Independent (needs git history investigation) | Open | Investigate and normalize or document |
| 2.1 | P2 | Missing barrel export | `COO/index.ts` (missing) | Independent | Open | Create barrel exports |
| 2.2 | P2 | Stale tsconfig | `COO/tsconfig.json` | Independent (rootDir is load-bearing, test carefully) | Open | Clean up empty includes, test rootDir change |
| 2.3 | P2 | KPI pattern inconsistency | `COO/*/kpi.ts` | coo-kpi-instrumentation (completed) | Open | Document for boxing; normalize later |
| 3.1 | P3 | Orphaned tools | `tools/agent-role-builder/` etc. | Pre-Phase-1 scaffolding | Open | Verify unused, then archive or delete |
| 3.2 | P3 | Provenance bug | `memory-engine/src/provenance.ts` | Phase 0 memory-engine, non-trivial | Known, workaround exists | Fix in memory-engine or document for boxing |
| 3.3 | P3 | Hardcoded paths | `agent-runtime-preflight.test.mjs` | adf-runtime-preflight-and-install-split (completed) | Open | Use dynamic paths |
| 3.5 | P3 | Import placement | `memory-engine/src/provenance.ts:40` | Independent, cosmetic | Open | Move import to top |
| GOV-1 | P3 | Stale backup branches | local branches only | approved-commit-closeout-state-separation (completed) | 2 backup refs remain | Delete backup branches |

---

## Recommended action sequence

1. **Finish `governed-approval-gates-and-local-sync-hardening`** — this is now the highest-value bounded hardening slice because it directly fixes approval truth, split-review truth, pre-refresh, and dirty-local-sync preservation without widening into general cleanup.
2. **Proceed with `mcp-boxing/slice-02-lane-admission-and-artifact-bridge`** — Step 2 explicitly keeps full downstream implementation, review, merge, and full approval-gate implementation out of scope.
3. **Investigate and fix 1.3 and 1.4 if still relevant to Slice 02 intake/setup behavior** — these are independent and smaller in scope than the approval/local-sync hardening route.
4. **Treat P2 and P3 items as later cleanup unless they become a direct blocker for boxing** — do not let them delay the bounded Step 2 admission/bridge route by default.

---

## Next audit instructions

When re-auditing this report:

1. Start from baseline commit `dd17128`. Run `git log --oneline dd17128..HEAD` to see what changed.
2. Run every "Verify" command. Compare output to the expected values. Mark each finding as FIXED or STILL OPEN.
3. For FIXED findings, update the summary table status and add the fixing commit SHA.
4. Re-check whether `governed-approval-gates-and-local-sync-hardening` is still active or has landed, because it is now the primary bounded precondition slice for safer boxing intake.
5. If new slices or branches were created after `dd17128`, audit those separately and append findings.
6. After completing the re-audit, update the "Audit date" and "Audit baseline commit" at the top of this file.
