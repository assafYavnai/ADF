# ADF Phase 1 Pre-MCP-Boxing Baseline Gap Report

Audit date: 2026-04-08 (updated same day after GOV-1 partial fix)
Audit baseline commit: `3301f61` (main)
Prior baselines: `192ad0b`, `6478c6c`
Purpose: Identify code-level defects, pattern inconsistencies, and structural debt on `main` that the MCP boxing model will inherit if not fixed before boxing slice-02 begins.

This report is written for a contextless agent. Every finding includes:
- Exact file paths and line numbers (verified against `192ad0b`)
- The specific problem in plain language
- A concrete fix description with reference to the correct pattern elsewhere in the codebase
- A shell command to verify whether the finding is still current
- Expected output of the verify command so the agent knows what "still broken" looks like

---

## How to use this report

1. Run `git log --oneline -1` and compare the SHA to `192ad0b`. If main has advanced, run `git log --oneline 192ad0b..HEAD` to see what changed, then re-verify each finding.
2. Each finding has a "Verify" block with a command and expected output. Run the command. If the output matches "Expected if fixed", the finding has been resolved. If it matches "Expected if still open", the finding needs work.
3. Findings are ordered by priority: P1 must be fixed before MCP boxing slice-02 starts, P2 should be fixed, P3 can be deferred.
4. For P1 fixes, the "Fix" section describes exactly what to change and points to the correct pattern file to copy from.

---

## Open governance items

### 1 feature slice is genuinely incomplete

Slice: `coo-live-executive-status-wiring`
State file: `docs/phase1/coo-live-executive-status-wiring/implement-plan-state.json`
State at audit time: `feature_status: active`, `active_run_status: context_ready`, `last_completed_step: context_collected`
Branch: `implement-plan/phase1/coo-live-executive-status-wiring` (24 commits ahead of main, NOT merged)
Completion summary (`docs/phase1/coo-live-executive-status-wiring/completion-summary.md`) says verbatim: "In progress. The live executive status wiring slice has not been completed yet."
The branch has 6 review cycles of contract/doc repairs but zero implementation code.
Code on main: No executive status wiring exists. `COO/briefing/` (the read model) is merged, but the live wiring to the COO surface is missing.
MCP boxing impact: LOW. This is a CEO-facing display feature, not a structural dependency for the governed implementation chain (`implement-plan` / `review-cycle` / `merge-queue`). Safe to defer past boxing slice-02.

Action: In progress as of 2026-04-08. No action needed for boxing baseline. Defer.

Verify:
```
node -e "const d=require('./docs/phase1/coo-live-executive-status-wiring/implement-plan-state.json'); console.log(d.feature_status, d.active_run_status);"
git merge-base --is-ancestor implement-plan/phase1/coo-live-executive-status-wiring main && echo MERGED || echo UNMERGED
```
Expected if still open: `active context_ready` and `UNMERGED`

### 2 stale unmerged branches should be deleted

#### Branch: `implement-plan/phase1/approved-commit-closeout-state-separation` — RESOLVED

Status: Feature branch and remote deleted on 2026-04-08 by CEO.
Remaining cleanup: Two local backup branches still exist:
- `backup/feature-approved-commit-closeout-state-separation-before-reset-20260406`
- `backup/main-before-approved-commit-closeout-reset-20260406`

These are pre-reset snapshots from 2026-04-06. The slice is complete on main. They carry no unique content needed going forward.

Action: Delete both backup branches when convenient.
```
git branch -D backup/feature-approved-commit-closeout-state-separation-before-reset-20260406
git branch -D backup/main-before-approved-commit-closeout-reset-20260406
```

Verify:
```
git branch | grep approved-commit-closeout
```
Expected if fully cleaned: no output
Expected if backup remains: backup branch names appear

#### Branch: `implement-plan/phase1/governed-implementation-route-hardening`

Commits ahead of main: 8
No docs folder exists on main for this slice (`docs/phase1/governed-implementation-route-hardening/` does not exist on main).
Content: Hardening changes to `implement-plan-helper.mjs`, `review-cycle-helper.mjs`, `merge-queue-helper.mjs`, their SKILL.md and workflow-contract.md files, plus 4 new test files under `skills/tests/`:
- `merge-queue-resume-blocked.test.mjs`
- `requirement-freeze-guard.test.mjs`
- `review-cycle-continuity-reopen.test.mjs`
- `stale-closeout-language.test.mjs`

This is the only unmerged branch that carries code changes to the skill layer that MCP boxing wraps.

Risk of NOT merging: Boxing inherits helper gaps that this branch closes. Fixing after boxing is harder because the boxing layer is coupled.
Risk of merging: 8 commits, 39 files. May conflict with recent main. Needs careful merge with conflict resolution.

Action: CEO decision needed. Options:
- (a) Merge it before boxing slice-02 to strengthen the baseline.
- (b) Close it and accept the current helper state as the boxing baseline.
- (c) Cherry-pick only the 4 test files and skip the helper changes.

Verify:
```
git merge-base --is-ancestor implement-plan/phase1/governed-implementation-route-hardening main && echo MERGED || echo "UNMERGED ($(git rev-list --count main..implement-plan/phase1/governed-implementation-route-hardening) ahead)"
```
Expected if still open: `UNMERGED (8 ahead)`

---

## P1 findings: must fix before MCP boxing slice-02

These defects create pattern inconsistency in the skill layer. A boxed agent reading the skill layer sees conflicting patterns and may copy the wrong one.

### 1.1 review-cycle-setup-helper.mjs duplicates 5 enum definitions instead of importing them

File: `skills/review-cycle/scripts/review-cycle-setup-helper.mjs`

The problem: Lines 18-59 define 5 enum constants locally:
- Line 18: `const ACCESS_MODES = new Set([...])` (duplicates `governed-feature-runtime.mjs` line 8)
- Line 27: `const RUNTIME_PERMISSION_MODELS = new Set([...])` (duplicates line 26)
- Line 35: `const EXECUTION_RUNTIMES = new Set([...])` (duplicates line 34)
- Line 42: `const PERSISTENT_EXECUTION_STRATEGIES = new Set([...])` (duplicates line 41)
- Line 48: `const CAPABILITY_KEYS = [...]` (duplicates line 157)

The correct pattern (used by the other 3 setup helpers) is to import these from `governed-feature-runtime.mjs`. See:
- `skills/implement-plan/scripts/implement-plan-setup-helper.mjs` lines 4-30: imports all enums from `../../governed-feature-runtime.mjs`
- `skills/merge-queue/scripts/merge-queue-setup-helper.mjs` lines 2-27: same pattern

Risk: If enums are updated in `governed-feature-runtime.mjs`, this file will silently diverge. A boxed agent sees 3 files importing correctly and 1 duplicating.

Fix:
1. Delete lines 18-59 (the 5 local `const` blocks).
2. Add an import block at line 2 matching the pattern in `implement-plan-setup-helper.mjs` lines 4-30. Import at minimum: `ACCESS_MODES`, `CAPABILITY_KEYS`, `EXECUTION_RUNTIMES`, `PERSISTENT_EXECUTION_STRATEGIES`, `RUNTIME_PERMISSION_MODELS` from `"../../governed-feature-runtime.mjs"`.
3. Run `node --check skills/review-cycle/scripts/review-cycle-setup-helper.mjs` to confirm syntax.

Verify:
```
grep -n "const ACCESS_MODES\|const RUNTIME_PERMISSION\|const EXECUTION_RUNTIME\|const PERSISTENT_EXECUTION\|const CAPABILITY_KEYS" skills/review-cycle/scripts/review-cycle-setup-helper.mjs
```
Expected if fixed: no output (no local const definitions)
Expected if still open: 5 lines with local const definitions at lines 18, 27, 35, 42, 48

### 1.2 review-cycle-setup-helper.mjs duplicates 14 utility functions instead of importing them

File: `skills/review-cycle/scripts/review-cycle-setup-helper.mjs`

The problem: Lines 548-675 define 14 utility functions locally that are already exported by `governed-feature-runtime.mjs`:

| Local line | Function | Canonical export in governed-feature-runtime.mjs |
|------------|----------|--------------------------------------------------|
| 548 | `parseArgs()` | line 186 |
| 579 | `requiredArg()` | line 218 |
| 587 | `booleanArg()` | line 234 |
| 601 | `booleanFallback()` | not exported (review-cycle local, can keep or remove) |
| 605 | `coalesceNonEmpty()` | not exported (review-cycle local, can keep or remove) |
| 614 | `normalizeStringArray()` | not exported directly, but `implement-plan-setup-helper.mjs` defines its own at line 422 |
| 625 | `normalizeSlashes()` | line 578 |
| 629 | `nowIso()` | line 648 |
| 633 | `isPlainObject()` | line 652 |
| 637 | `isFilled()` | line 656 |
| 641 | `describeError()` | line 664 |
| 648 | `pathExists()` | line 324 |
| 660 | `readJson()` | line 347 |
| 665 | `writeJson()` | line 382 (as `writeJsonAtomic`) |

The correct pattern: `implement-plan-setup-helper.mjs` imports `parseArgs`, `requiredArg`, `booleanArg`, `describeError`, `isFilled`, `isPlainObject`, `nowIso`, `pathExists`, `readJson`, `writeJsonAtomic`, `printJson`, `fail` from `governed-feature-runtime.mjs` (lines 4-30).

Fix:
1. Delete the locally defined functions listed above (lines 548-675).
2. Add the matching imports to the import block created in finding 1.1.
3. For `booleanFallback`, `coalesceNonEmpty`, `normalizeStringArray`: these are not in `governed-feature-runtime.mjs`. Keep them as local helpers unless they can be replaced by existing exports. Check if `booleanArg` (which takes a fallback) can replace `booleanFallback` usage.
4. Replace `writeJson` calls with `writeJsonAtomic` (the canonical name).
5. Run `node --check skills/review-cycle/scripts/review-cycle-setup-helper.mjs` to confirm syntax.

Verify:
```
grep -c "^function \|^async function " skills/review-cycle/scripts/review-cycle-setup-helper.mjs
grep -c "^function \|^async function " skills/implement-plan/scripts/implement-plan-setup-helper.mjs
```
Expected if fixed: counts should be roughly similar (review-cycle may have a few more due to its extra validation logic, but not 14+ more)
Expected if still open: review-cycle count is ~28, implement-plan count is ~15

### 1.3 merge-queue-setup-helper.mjs does not emit llm_tools in setup output

File: `skills/merge-queue/scripts/merge-queue-setup-helper.mjs`

The problem: The `deriveSetup()` function does not include `llm_tools` in the returned setup object. The other two setup helpers do:
- `skills/implement-plan/scripts/implement-plan-setup-helper.mjs` line 241: `llm_tools: input.llmTools ?? input.existing.llm_tools ?? {},`
- `skills/review-cycle/scripts/review-cycle-setup-helper.mjs` line 286: `llm_tools: input.llmTools ?? input.existing.llm_tools ?? {},`
- `skills/merge-queue/scripts/merge-queue-setup-helper.mjs`: no `llm_tools` field

Risk: If the boxed merge-queue needs to detect available LLM workers (e.g., to spawn a post-merge verification worker), the setup won't have that data. Creates an asymmetry.

Fix:
1. Find the `deriveSetup()` function in `merge-queue-setup-helper.mjs` (around line 105).
2. Find where it builds the return object (around line 152).
3. Add `llm_tools: input.llmTools ?? input.existing.llm_tools ?? {},` to the return object, matching the pattern in the other two helpers.
4. Find the `detectLlmToolsViaPreflight()` function call site — if merge-queue doesn't have one, add it following the same pattern as `implement-plan-setup-helper.mjs` lines 147-165.
5. Run `node --check skills/merge-queue/scripts/merge-queue-setup-helper.mjs`.

Verify:
```
grep -n "llm_tools" skills/merge-queue/scripts/merge-queue-setup-helper.mjs
```
Expected if fixed: at least 1 match showing `llm_tools` in the setup object
Expected if still open: no output (exit code 1)

### 1.4 setup_schema_version differs across skills with no documented reason

Files:
- `skills/implement-plan/scripts/implement-plan-setup-helper.mjs` line 242: `setup_schema_version: 1`
- `skills/merge-queue/scripts/merge-queue-setup-helper.mjs` line 178: `setup_schema_version: 1`
- `skills/benchmark-suite/scripts/benchmark-suite-setup-helper.mjs` line 180: `setup_schema_version: 1`
- `skills/review-cycle/scripts/review-cycle-setup-helper.mjs` line 287: `setup_schema_version: 2`

The problem: review-cycle uses version 2 while all others use version 1. No documentation explains what changed between versions or why review-cycle is different.

Risk: A boxing orchestrator reading setup objects will see mixed versions. Without knowing what differs, it cannot safely normalize or validate.

Fix: Either:
- (a) Normalize all to version 2 and document what version 2 means, OR
- (b) Add a comment in each file explaining the version semantics, so the boxing layer knows what to expect.

Verify:
```
grep -rn "setup_schema_version" skills/*/scripts/*-setup-helper.mjs
```
Expected if fixed: all show the same version number, or each has an adjacent comment explaining the version
Expected if still open: review-cycle shows `2`, others show `1`, no comments

---

## P2 findings: should fix before boxing

### 2.1 COO has no root barrel export

Problem: No `COO/index.ts` exists. Only `COO/table/index.ts` and `COO/cto-admission/index.ts` have barrel exports. These modules lack barrel files: `briefing/`, `classifier/`, `context-engineer/`, `requirements-gathering/`.

Risk: When boxing wraps the COO as a department, there is no single import surface. Each consumer needs to know internal paths (`COO/dist/COO/briefing/builder.js`). This makes it harder to define a clean API boundary.

Fix:
1. Create `COO/index.ts` that re-exports the public APIs from each submodule.
2. Create `COO/briefing/index.ts`, `COO/classifier/index.ts`, `COO/context-engineer/index.ts`, `COO/requirements-gathering/index.ts` following the pattern in `COO/table/index.ts` and `COO/cto-admission/index.ts`.
3. Run `npm --prefix COO run build` to confirm TypeScript compiles.

Verify:
```
ls COO/index.ts 2>/dev/null || echo "MISSING: COO/index.ts"
for d in briefing classifier context-engineer requirements-gathering; do ls "COO/$d/index.ts" 2>/dev/null || echo "MISSING: COO/$d/index.ts"; done
```
Expected if fixed: no "MISSING" output
Expected if still open: `MISSING: COO/index.ts` and 4 `MISSING:` lines

### 2.2 COO/tsconfig.json includes empty directories and has misleading rootDir

File: `COO/tsconfig.json`

Problems:
- Includes `"intelligence/**/*"` but `COO/intelligence/` contains only `prompt.md` and an empty `role/` subdirectory (no `.ts` files)
- Includes `"shared/**/*"` but `COO/shared/` is completely empty
- `rootDir: ".."` points to repo root instead of COO directory

Risk: Misleading for tooling and boxing agents that read tsconfig to understand module boundaries.

Fix:
1. Remove `"intelligence/**/*"` and `"shared/**/*"` from the `include` array (or populate those directories with actual TypeScript).
2. Change `rootDir` from `".."` to `"."`.
3. Run `npm --prefix COO run build` to confirm TypeScript still compiles.

Verify:
```
ls COO/intelligence/*.ts 2>/dev/null || echo "NO TS IN intelligence/"
ls COO/shared/ 2>/dev/null; echo "FILES: $?"
node -e "const t=require('./COO/tsconfig.json'); console.log('rootDir:', t.compilerOptions.rootDir); console.log('includes:', t.include.filter(i => i.includes('intelligence') || i.includes('shared')));"
```
Expected if fixed: no `intelligence` or `shared` in includes, `rootDir: "."`
Expected if still open: `NO TS IN intelligence/`, empty shared, `rootDir: ".."`

### 2.3 KPI pattern inconsistency across COO modules

Problem: Three different KPI instrumentation patterns exist.

| Module | File | Pattern |
|--------|------|---------|
| briefing | `COO/briefing/kpi.ts` | Functional, returns `BriefKpiReport` interface |
| table | `COO/table/kpi.ts` | Functional, returns `TableKpiReport` interface |
| cto-admission | `COO/cto-admission/kpi.ts` | Class-based `AdmissionKpiTracker` with `snapshot()` method returning `KpiSnapshot` |
| cto-admission | `COO/cto-admission/live-state.ts` | Zod schema-based `AdmissionKpiState` |

Risk: A boxed department aggregating telemetry needs to handle all three. This compounds under boxing.

Fix: Can be addressed as part of boxing telemetry design. For now, document the current state so the boxing agent knows what to expect.

Verify:
```
grep -n "export.*Kpi\|class.*Kpi" COO/briefing/kpi.ts COO/table/kpi.ts COO/cto-admission/kpi.ts COO/cto-admission/live-state.ts
```

---

## P3 findings: can defer

### 3.1 tools/ directory has 4 orphaned subdirectories

Directories: `tools/agent-role-builder/`, `tools/implementation-engine/`, `tools/llm-tool-builder/`, `tools/self-repair-engine/`
Each has its own `package.json` and `node_modules/`. None are referenced by `adf.sh`, any skill script, or any active tool `.mjs` file.

Risk: A boxing agent scanning `tools/` for available capabilities will find dead entries.

Action: Delete the directories, or move them to `.archive/tools/`. Confirm they are still unreferenced before deleting.

Verify:
```
for d in tools/agent-role-builder tools/implementation-engine tools/llm-tool-builder tools/self-repair-engine; do echo "--- $d ---"; grep -rl "$(basename $d)" adf.sh skills/ tools/*.mjs 2>/dev/null | head -1 || echo "ORPHANED"; done
```
Expected if still open: `ORPHANED` for all 4

### 3.2 Provenance bug in memory-engine blocks MCP discussion writes

File: `components/memory-engine/src/provenance.ts` line 30 (`LEGACY_PROVENANCE` constant)
Documentation: `docs/bootstrap/cli-agent.md` line 115

Problem: The `LEGACY_PROVENANCE` sentinel causes `discussion_append` and `discussion_import_from_text` MCP tool calls to fail with "legacy sentinel provenance" error. Workaround: write to `docs/v0/context/` markdown files as fallback.

Risk: If MCP boxing uses Brain for department-level discussion capture, these operations fail silently.

Action: Fix the provenance validation in the memory-engine MCP server, or defer and document the workaround for boxing agents.

Verify:
```
grep -n "LEGACY_PROVENANCE" components/memory-engine/src/provenance.ts
grep -n "provenance bug" docs/bootstrap/cli-agent.md
```
Expected if fixed: `LEGACY_PROVENANCE` removed or provenance validation updated
Expected if still open: `LEGACY_PROVENANCE` defined at line 30, bug documented at line 115

### 3.3 Hardcoded C:/ADF in test fixtures

File: `tools/agent-runtime-preflight.test.mjs`
Lines: 29, 44-47

Problem: Test fixtures use `const repoRoot = "C:/ADF"` and hardcoded Windows-specific paths. Tests are not portable.

Action: Replace with dynamic path resolution using `import.meta.url` or `process.cwd()`.

Verify:
```
grep -n '"C:/ADF"' tools/agent-runtime-preflight.test.mjs | head -5
```
Expected if fixed: no output
Expected if still open: matches showing hardcoded `"C:/ADF"` strings

### 3.4 Unused function isSetupComplete in review-cycle-setup-helper.mjs

File: `skills/review-cycle/scripts/review-cycle-setup-helper.mjs` line 541

Problem: `function isSetupComplete(setup, projectRoot = null)` is defined but never called anywhere in the file or any other file.

Action: Delete the function. If fixing 1.2, this gets cleaned up naturally.

Verify:
```
grep -rn "isSetupComplete" skills/
```
Expected if fixed: no output (or only an import, no definition)
Expected if still open: definition at line 541

### 3.5 Misplaced import in memory-engine provenance.ts

File: `components/memory-engine/src/provenance.ts`

Problem: `import { randomUUID } from "node:crypto"` appears at line 40, after the `LEGACY_PROVENANCE` constant definition at line 30. The other import (`zod`) is at line 7. All imports should be at the top of the file.

Action: Move line 40 to line 8 (after the `zod` import).

Verify:
```
grep -n "^import" components/memory-engine/src/provenance.ts
```
Expected if fixed: all `import` lines appear before line 10
Expected if still open: `import` at line 7 and another at line 40

---

## Summary table

| ID | Priority | Category | File(s) | Status at 192ad0b | Action |
|----|----------|----------|---------|-------------------|--------|
| 1.1 | P1 | Enum duplication | `review-cycle-setup-helper.mjs:18-59` | Open | Replace with imports from `governed-feature-runtime.mjs` |
| 1.2 | P1 | Utility duplication | `review-cycle-setup-helper.mjs:548-675` | Open | Replace with imports from `governed-feature-runtime.mjs` |
| 1.3 | P1 | Missing field | `merge-queue-setup-helper.mjs` | Open | Add `llm_tools` to setup output |
| 1.4 | P1 | Schema version drift | All `*-setup-helper.mjs` | Open | Normalize or document |
| 2.1 | P2 | Missing barrel export | `COO/index.ts` (missing) | Open | Create barrel exports |
| 2.2 | P2 | Stale tsconfig | `COO/tsconfig.json` | Open | Remove empty includes, fix rootDir |
| 2.3 | P2 | KPI pattern inconsistency | `COO/*/kpi.ts` | Open | Document for boxing, normalize later |
| 2.4 | P2 | Unmerged hardening branch | `governed-implementation-route-hardening` | CEO decision needed | Merge, close, or cherry-pick |
| GOV-1 | P2 | Stale branch | `approved-commit-closeout-state-separation` | Mostly fixed (2 backup refs remain) | Delete backup branches |
| 3.1 | P3 | Orphaned tools | `tools/agent-role-builder/` etc. | Open | Delete or archive |
| 3.2 | P3 | Provenance bug | `memory-engine/src/provenance.ts` | Known, workaround exists | Fix or document for boxing |
| 3.3 | P3 | Hardcoded paths | `agent-runtime-preflight.test.mjs` | Open | Use dynamic paths |
| 3.4 | P3 | Dead code | `review-cycle-setup-helper.mjs:541` | Open | Delete (part of 1.2 fix) |
| 3.5 | P3 | Import placement | `memory-engine/src/provenance.ts:40` | Open | Move import to top |

---

## Next audit instructions

When re-auditing this report:

1. Start from baseline commit `192ad0b`. Run `git log --oneline 192ad0b..HEAD` to see what changed.
2. Run every "Verify" command. Compare output to the "Expected if fixed" / "Expected if still open" values. Mark each finding as FIXED or STILL OPEN.
3. For FIXED findings, update the summary table status and add the fixing commit SHA.
4. Check if the `governed-implementation-route-hardening` branch decision was made (finding 2.4).
5. Check if the `approved-commit-closeout-state-separation` branches were deleted (finding GOV-1).
6. Check if `coo-live-executive-status-wiring` is still the only open slice.
7. If new slices or branches were created after `192ad0b`, audit those separately and append findings.
8. After completing the re-audit, update the "Audit date" and "Audit baseline commit" at the top of this file.
