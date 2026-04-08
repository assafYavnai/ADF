# ADF Phase 1 Pre-MCP-Boxing Baseline Gap Report

Audit date: 2026-04-08
Audit baseline commit: `6478c6c` (main)
Audit baseline message: `docs(implement-plan-review-cycle-kpi-enforcement): finalize merge closeout truth`
Purpose: Identify code-level defects, pattern inconsistencies, and structural debt on `main` that the MCP boxing model will inherit if not fixed before boxing slice-02 begins.

This report is written for a contextless agent. Every finding includes file paths, line references, and verification commands so the next agent can reproduce the finding, check whether it is still current, and act on it without reading prior conversation history.

---

## How to use this report

1. Run `git log --oneline -1` and compare the SHA to `6478c6c`. If main has advanced, re-verify each finding against the current HEAD before acting.
2. Each finding has a "Verify" command. Run it. If the output no longer matches, the finding may have been fixed.
3. Findings are ordered by priority: P1 must be fixed before MCP boxing slice-02 starts, P2 should be fixed, P3 can be deferred.

---

## Open governance items (not code defects)

### Only 1 feature slice is genuinely incomplete

Slice: `coo-live-executive-status-wiring`
State file: `docs/phase1/coo-live-executive-status-wiring/implement-plan-state.json`
State: `feature_status: active`, `active_run_status: context_ready`, `last_completed_step: context_collected`
Branch: `implement-plan/phase1/coo-live-executive-status-wiring` (24 commits ahead of main, NOT merged)
Completion summary says: "In progress. The live executive status wiring slice has not been completed yet."
Code on main: No executive status wiring exists. `COO/briefing/` read model is merged but the live wiring to the COO surface is missing.
MCP boxing impact: LOW. This is a CEO-facing display feature, not a structural dependency for the governed implementation chain. Safe to defer.

Verify:
```
node -e "const d=require('./docs/phase1/coo-live-executive-status-wiring/implement-plan-state.json'); console.log(d.feature_status, d.active_run_status);"
git merge-base --is-ancestor implement-plan/phase1/coo-live-executive-status-wiring main && echo MERGED || echo UNMERGED
```

### 3 unmerged feature branches exist

Branch: `implement-plan/phase1/approved-commit-closeout-state-separation`
Commits ahead of main: 1
Content: docs-only (state JSON and execution contract updates)
MCP boxing impact: NONE

Branch: `implement-plan/phase1/coo-live-executive-status-wiring`
Commits ahead of main: 24
Content: contract and review docs, no implementation code
MCP boxing impact: NONE

Branch: `implement-plan/phase1/governed-implementation-route-hardening`
Commits ahead of main: 8
Content: hardening logic and 4 governance test suites for the skill layer MCP boxing wraps
MCP boxing impact: MEDIUM (see finding 3.1 below)

Verify:
```
for b in implement-plan/phase1/approved-commit-closeout-state-separation implement-plan/phase1/coo-live-executive-status-wiring implement-plan/phase1/governed-implementation-route-hardening; do echo "$b:"; git merge-base --is-ancestor "$b" main && echo "  MERGED" || echo "  UNMERGED ($(git rev-list --count main..$b) ahead)"; done
```

---

## P1 findings: must fix before MCP boxing slice-02

These defects create pattern inconsistency in the skill layer. A boxed agent reading the skill layer will see conflicting patterns and may copy the wrong one.

### 1.1 review-cycle-setup-helper.mjs duplicates enums instead of importing them

File: `skills/review-cycle/scripts/review-cycle-setup-helper.mjs`
Lines: 19-60

Problem: This file locally redefines 5 enum sets that should be imported from `skills/governed-feature-runtime.mjs`:
- Line 19: `const ACCESS_MODES` (duplicates governed-feature-runtime.mjs lines 8-15)
- Line 28: `const RUNTIME_PERMISSION_MODELS` (duplicates lines 26-32)
- Line 36: `const EXECUTION_RUNTIMES` (duplicates lines 34-39)
- Line 43: `const PERSISTENT_EXECUTION_STRATEGIES` (duplicates lines 41-45)
- Line 49: `const CAPABILITY_KEYS` (duplicates lines 157-168)

The other 3 setup helpers all import from `governed-feature-runtime.mjs`:
- `skills/implement-plan/scripts/implement-plan-setup-helper.mjs` imports correctly
- `skills/merge-queue/scripts/merge-queue-setup-helper.mjs` imports correctly

Risk: If enums are updated in `governed-feature-runtime.mjs`, this file will not pick up the change. A boxed agent sees 3 correct examples and 1 incorrect one.

Fix: Replace local definitions with imports from `governed-feature-runtime.mjs`.

Verify:
```
grep -n "const ACCESS_MODES\|const RUNTIME_PERMISSION\|const EXECUTION_RUNTIME\|import.*governed" skills/review-cycle/scripts/review-cycle-setup-helper.mjs | head -10
```

### 1.2 review-cycle-setup-helper.mjs duplicates 14 utility functions

File: `skills/review-cycle/scripts/review-cycle-setup-helper.mjs`
Lines: 548-669

Problem: This file locally redefines these utility functions instead of importing from `governed-feature-runtime.mjs`:
`parseArgs`, `requiredArg`, `booleanArg`, `booleanFallback`, `coalesceNonEmpty`, `normalizeStringArray`, `normalizeSlashes`, `nowIso`, `isPlainObject`, `isFilled`, `describeError`, `pathExists`, `readJson`, `writeJson`

Same pattern issue as 1.1. The other setup helpers import these correctly.

Fix: Replace local definitions with imports from `governed-feature-runtime.mjs`.

Verify:
```
grep -c "^function \|^async function " skills/review-cycle/scripts/review-cycle-setup-helper.mjs
grep -c "^function \|^async function " skills/implement-plan/scripts/implement-plan-setup-helper.mjs
```
Expected: review-cycle will show a much higher count due to the duplicated utilities.

### 1.3 merge-queue-setup-helper.mjs missing llm_tools field

File: `skills/merge-queue/scripts/merge-queue-setup-helper.mjs`

Problem: Does not emit `llm_tools` in its derived setup output. Both `implement-plan-setup-helper.mjs` and `review-cycle-setup-helper.mjs` emit this field.

Risk: If the boxed merge-queue needs to detect available LLM workers, the setup won't have detection data. Creates an asymmetry that boxing orchestration will need to special-case.

Fix: Add `llm_tools` emission from preflight data, matching the pattern in `implement-plan-setup-helper.mjs`.

Verify:
```
grep -n "llm_tools" skills/implement-plan/scripts/implement-plan-setup-helper.mjs
grep -n "llm_tools" skills/review-cycle/scripts/review-cycle-setup-helper.mjs
grep -n "llm_tools" skills/merge-queue/scripts/merge-queue-setup-helper.mjs
```
Expected: first two return matches, third returns nothing.

### 1.4 Setup schema version inconsistency

Problem: Skills emit different `setup_schema_version` values with no documented reason.

| Skill | Version | File |
|-------|---------|------|
| implement-plan | 1 | `skills/implement-plan/scripts/implement-plan-setup-helper.mjs` |
| merge-queue | 1 | `skills/merge-queue/scripts/merge-queue-setup-helper.mjs` |
| review-cycle | 2 | `skills/review-cycle/scripts/review-cycle-setup-helper.mjs` |

Risk: Boxing layer will need to handle multiple versions or normalize. Undocumented inconsistency.

Fix: Normalize to version 2 across all skills, or document why they differ.

Verify:
```
grep -rn "setup_schema_version" skills/*/scripts/*-setup-helper.mjs
```

---

## P2 findings: should fix before boxing

These are structural issues that make the boxing integration harder or create maintenance debt that compounds under the boxing model.

### 2.1 COO has no root barrel export

Problem: No `COO/index.ts` exists. Only `COO/table/index.ts` and `COO/cto-admission/index.ts` have barrel exports. Modules `briefing/`, `classifier/`, `context-engineer/`, `requirements-gathering/` have no barrel files.

Risk: When boxing wraps the COO as a department, there is no single import surface. Each consumer needs to know internal paths. This makes it harder to define a clean API boundary.

Fix: Create `COO/index.ts` that re-exports public APIs from each submodule. Create barrel files for modules that lack them.

Verify:
```
ls COO/index.ts 2>/dev/null || echo "MISSING"
for d in briefing classifier context-engineer requirements-gathering; do ls "COO/$d/index.ts" 2>/dev/null || echo "MISSING: COO/$d/index.ts"; done
```

### 2.2 COO/tsconfig.json includes empty directories

File: `COO/tsconfig.json`

Problem:
- Includes `"intelligence/**/*"` but `COO/intelligence/` contains only `prompt.md` and an empty `role/` directory (no TypeScript files)
- Includes `"shared/**/*"` but `COO/shared/` is empty (0 files)
- `rootDir: ".."` points to repo root instead of COO directory

Risk: Misleading for tooling and agents that inspect tsconfig to understand module structure.

Verify:
```
ls COO/intelligence/*.ts 2>/dev/null || echo "NO TS FILES in intelligence/"
ls COO/shared/ 2>/dev/null; echo "EXIT: $?"
grep rootDir COO/tsconfig.json
```

### 2.3 KPI pattern inconsistency across COO modules

Problem: Three different KPI instrumentation patterns exist across COO modules.

| Module | File | Pattern |
|--------|------|---------|
| briefing | `COO/briefing/kpi.ts` | Functional, returns `BriefKpiReport` interface |
| table | `COO/table/kpi.ts` | Functional, returns `TableKpiReport` interface |
| cto-admission | `COO/cto-admission/kpi.ts` | Class-based `AdmissionKpiTracker` with `snapshot()` |
| cto-admission | `COO/cto-admission/live-state.ts` | Zod schema-based `AdmissionKpiState` |

Risk: A boxed department aggregating telemetry needs to handle all three patterns, or the boxing layer must normalize.

Fix: Can be addressed as part of boxing telemetry design. Document the current state so the boxing agent knows what to expect.

Verify:
```
grep -n "export.*Kpi\|class.*Kpi" COO/briefing/kpi.ts COO/table/kpi.ts COO/cto-admission/kpi.ts COO/cto-admission/live-state.ts
```

### 2.4 Unmerged governed-implementation-route-hardening branch

Branch: `implement-plan/phase1/governed-implementation-route-hardening`
Commits ahead of main: 8
Files touched: 39 (skill helpers, SKILL.md docs, workflow contracts, 4 new test files)

Key content not on main:
- Hardening changes to `implement-plan-helper.mjs`, `review-cycle-helper.mjs`, `merge-queue-helper.mjs`
- 4 governance test suites: `merge-queue-resume-blocked.test.mjs`, `requirement-freeze-guard.test.mjs`, `review-cycle-continuity-reopen.test.mjs`, `stale-closeout-language.test.mjs`

Risk of NOT merging before boxing: MCP boxing wraps the current skill helpers. If those helpers have known hardening gaps that this branch closes, boxing inherits the gaps. Fixing them after boxing is harder because the boxing layer is coupled.

Risk of merging: 8 commits, 39 files. May conflict with recent main changes. Needs careful merge.

Decision needed: merge or close before boxing slice-02 begins.

Verify:
```
git merge-base --is-ancestor implement-plan/phase1/governed-implementation-route-hardening main && echo MERGED || echo "UNMERGED ($(git rev-list --count main..implement-plan/phase1/governed-implementation-route-hardening) ahead)"
git diff --stat main...implement-plan/phase1/governed-implementation-route-hardening | tail -3
```

---

## P3 findings: can defer

### 3.1 tools/ directory has 4 orphaned subdirectories

Directories: `tools/agent-role-builder/`, `tools/implementation-engine/`, `tools/llm-tool-builder/`, `tools/self-repair-engine/`
Each has its own `package.json` and `node_modules/`. None are referenced by `adf.sh` or any active code.

Risk: A boxing agent scanning `tools/` for available capabilities will find dead entries.

Verify:
```
for d in tools/agent-role-builder tools/implementation-engine tools/llm-tool-builder tools/self-repair-engine; do grep -rl "$(basename $d)" adf.sh skills/ tools/*.mjs 2>/dev/null | head -1 || echo "ORPHANED: $d"; done
```

### 3.2 Provenance bug in memory-engine

File: `components/memory-engine/src/provenance.ts`
Documentation: `docs/bootstrap/cli-agent.md` line 115

Problem: Known bug where `legacy sentinel provenance` error blocks `discussion_append` and `discussion_import_from_text` MCP operations. Workaround exists (write to `docs/v0/context/` as fallback).

Risk: If boxing uses Brain for department-level discussion capture, these operations fail. Workaround is documented but not a proper MCP path.

Verify:
```
grep -n "LEGACY_PROVENANCE\|legacy.*sentinel" components/memory-engine/src/provenance.ts
grep -n "provenance bug" docs/bootstrap/cli-agent.md
```

### 3.3 Hardcoded C:/ADF in test fixtures

File: `tools/agent-runtime-preflight.test.mjs` (lines 45, 126, 173)

Problem: Test fixtures use `const repoRoot = "C:/ADF"` and other hardcoded Windows paths. Tests are not portable.

Verify:
```
grep -n "C:/ADF" tools/agent-runtime-preflight.test.mjs | head -5
```

### 3.4 Unused function in review-cycle-setup-helper.mjs

File: `skills/review-cycle/scripts/review-cycle-setup-helper.mjs` line 541
Function: `isSetupComplete(setup, projectRoot = null)` is defined but never called.

Verify:
```
grep -n "isSetupComplete" skills/review-cycle/scripts/review-cycle-setup-helper.mjs
```

### 3.5 Misplaced import in memory-engine provenance.ts

File: `components/memory-engine/src/provenance.ts` line 40
Problem: `import { randomUUID } from "node:crypto"` appears after the `LEGACY_PROVENANCE` definition on line 30, instead of at the top of the file with other imports.

Verify:
```
grep -n "^import" components/memory-engine/src/provenance.ts
```

---

## Summary table

| ID | Priority | Category | File(s) | Status at 6478c6c |
|----|----------|----------|---------|-------------------|
| 1.1 | P1 | Enum duplication | `review-cycle-setup-helper.mjs:19-60` | Open |
| 1.2 | P1 | Utility duplication | `review-cycle-setup-helper.mjs:548-669` | Open |
| 1.3 | P1 | Missing field | `merge-queue-setup-helper.mjs` | Open |
| 1.4 | P1 | Schema version drift | All `*-setup-helper.mjs` | Open |
| 2.1 | P2 | Missing barrel export | `COO/index.ts` (missing) | Open |
| 2.2 | P2 | Stale tsconfig | `COO/tsconfig.json` | Open |
| 2.3 | P2 | KPI pattern inconsistency | `COO/*/kpi.ts` | Open |
| 2.4 | P2 | Unmerged hardening branch | `governed-implementation-route-hardening` | Decision needed |
| 3.1 | P3 | Orphaned tools | `tools/agent-role-builder/` etc. | Open |
| 3.2 | P3 | Provenance bug | `memory-engine/src/provenance.ts` | Known, workaround exists |
| 3.3 | P3 | Hardcoded paths | `agent-runtime-preflight.test.mjs` | Open |
| 3.4 | P3 | Dead code | `review-cycle-setup-helper.mjs:541` | Open |
| 3.5 | P3 | Import placement | `memory-engine/src/provenance.ts:40` | Open |

---

## Next audit instructions

When re-auditing this report:
1. Start from the baseline commit `6478c6c`. Run `git log --oneline 6478c6c..HEAD` to see what changed since this audit.
2. Run every "Verify" command in this document. Mark findings as FIXED if the verify output no longer matches the described problem.
3. Check if the `governed-implementation-route-hardening` branch decision was made.
4. Check if `coo-live-executive-status-wiring` is still the only open slice.
5. If new slices were created after `6478c6c`, audit those separately.
