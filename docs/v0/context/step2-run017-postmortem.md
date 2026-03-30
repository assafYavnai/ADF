# Run 017 Post-Mortem

Status: **blocked** (exit code 1)
Date: 2026-03-30
Rounds completed: 1 of 3

---

## PM-001: Communication Quality

**Round 0 review reports are up to spec.** Both reviewers produced:
- Structured verdicts (reject/conditional)
- Conceptual groups with severity (blocking/major/minor)
- Individual findings with source_section references
- Redesign guidance per group
- fix_decisions array (Codex: 3 entries, Claude: empty — correct for round 0)
- residual_risks (Codex: 2, Claude: 3)
- strengths (Codex: 4, Claude: 7)

New fields from refactoring working: reviewMode, deferredItems, arbitrationUsed, audit, governance_binding.

**Gap:** Communication between revision and fixer never happened because the fixer was never called. See PM-003 finding 2.

## PM-002: Timing

| Phase | Duration | Status |
|---|---|---|
| Pre-round (governance snapshot, initial compliance, self-check) | ~5 min | completed |
| Round 0 reviewers (Codex 132s, Claude 138s, Leader 137s) | ~7 min | completed |
| Round 0→1 learning engine | unknown | completed (proposed rules) |
| Round 1 revision | unknown | **blocked — Codex exit null** |
| Total | ~15 min | blocked after 1 round |

## PM-003: What Was Found

### Finding 1: Codex stdin fix reverted in shared-imports.ts

**What happened:** The refactoring between commits dce786c and eee6934 rewrote `tools/agent-role-builder/src/shared-imports.ts`. The rewrite reverted `callCodex()` back to stdin piping (`proc.stdin?.write(params.prompt)` at line 213) instead of the temp-file + shell-variable approach.

**Evidence:**
- Canonical invoker (`shared/llm-invoker/invoker.ts` lines 100-126) still has the fix: writes prompt to temp file, loads via `bash -c` shell variable, passes as CLI argument
- shared-imports.ts `callCodex` (line 213) uses `proc.stdin?.write(params.prompt)` — the old broken pattern
- Codex stderr output shows "Reading prompt from stdin..." confirming stdin was used
- Bug report `tools/agent-role-builder/runs/agent-role-builder-self-role-017/bug-report-1.json` confirms: `codex failed (exit null)`

**Root cause:** shared-imports.ts is a 200+ line manual copy of shared/ modules. Any refactoring that touches this file rewrites it from scratch, losing all prior fixes. This is the 4th time a fix was applied to the canonical module and lost in the copy:
1. B-1 (Gemini shell injection) — fixed in canonical, missed in copy (step2f review R2-1)
2. shell:true removal — fixed in canonical, missed in copy (step2f review R2-1)
3. Codex stdin → temp file — fixed in canonical (commit 30bc958), lost in refactoring
4. This run — same fix, lost again in the same refactoring

**Why it keeps happening:** SYS-001 says "compliance map must list ALL locations." But there's no automated check. The refactoring agent doesn't know shared-imports.ts is a copy that must match the canonical. There's no test, no lint rule, no contract that enforces this.

**What would fix it permanently:** npm workspace references or a build step that generates shared-imports.ts from the canonical modules. Manual copies will always diverge.

### Finding 2: Fixer not called on revision failure

**What happened:** When the revision Codex call failed with exit null, the error escalation path was:
1. `reviseRoleMarkdown()` called `invoke()` which spawned Codex
2. Codex exited with null (killed by OS or timeout)
3. `invoke()` threw: `codex failed (exit null): Reading prompt from stdin...`
4. The error propagated to the revision catch block in `board.ts` (~line 382)
5. The catch block wrote `bug-report-1.json` with full context
6. The catch block threw `BoardBlockedError` immediately
7. `executeBoard()` caught `BoardBlockedError` at line 218 and returned `status: "blocked"`

**What was NOT called:**
- `attemptAutoFix()` — this function exists at line ~36 of board.ts but is only called inside `parseReviewerResponse()` and `parseLeaderResponse()`. It is designed to fix JSON parse errors by asking an LLM to extract JSON from malformed responses.
- No provider fallback — when Codex fails, the system doesn't try Claude as an alternative
- No retry with different parameters — the system doesn't try a smaller prompt, different sandbox mode, or different model

**Evidence:**
- `bug-report-1.json` exists — confirms the bug report was written
- No `auto-fix-attempt.json` or similar artifact — confirms no fix was attempted
- The error message starts with "codex failed" not "Parse failed" — the auto-fix is keyed on parse failures, not provider failures
- grep for `attemptAutoFix` call sites shows only 2: both inside parse functions, none in the revision catch block

**What the spec says should happen (docs/v0/review-process-architecture.md):**
- Step 4: "Call the builder (llm-tool-builder when complete, Codex agent as interim) with the bug report"
- Step 5: "If the relaunched component succeeds: continue execution"
- Step 6: "If auto-fix fails: produce a final error report for the CEO"

The current implementation skips Steps 4 and 5 entirely for revision failures. It goes straight from bug report (Step 2) to full stop (Step 6).

**Why this matters:** The revision failure is recoverable. Claude handles large prompts via stdin. If the fixer had been called with provider fallback (use Claude when Codex fails), the revision would have succeeded and the run would have continued.

### Finding 3: Resume doesn't carry forward reviewer status

**What happened:** Run 017 is an "update" operation resuming from a baseline where Claude has been conditional on prior runs. But `executeBoard()` initializes all reviewer status to "pending" (line 201-203). Both reviewers ran in round 0.

**Evidence:**
- Round 0 review.json shows both `reviewer-0-codex-r0` and `reviewer-1-claude-r0` produced verdicts
- `reviewerStatus` map initialized at line 201: `new Map<string, ...>()` — no loading from prior run
- No code reads the resume package's reviewer verdicts
- Claude went conditional (0 blocking) — its review was valid but unnecessary if prior status carried forward

**Impact:** One unnecessary reviewer call per resumed run (~138s of Claude time). Minor — Claude's review was useful (found the hardcoded run-path in authority section). But per the split-verdict spec, an already-conditional reviewer should be skipped until sanity check.

**What would fix it:** Load prior run's final reviewer status from the resume package and initialize `reviewerStatus` from it instead of "pending" for all.

### Finding 4: Learning engine produced rules but rulebook growth needs verification

**What happened:** The learning engine ran on round 0 and the log shows "proposed rules." But the run blocked before round 1, so we can't verify if the rules were applied to the rulebook or if the revision would have used them.

**Evidence:**
- `rounds/round-0/learning.json` exists
- Rulebook at start: 22 rules (ARB-001 to ARB-022) — needs to be checked if it grew after learning

**Impact:** Cannot assess learning engine effectiveness in the refactored implementation.

## PM-004: Communication Contract Updates

1. **Fixer contract needed:** The error escalation pattern in the docs describes a fixer step but no concrete contract exists for it. Need:
   - `shared/fixer/fix-contract.json` — what the fixer receives (bug report, source files, provider config)
   - Provider fallback rule: if provider X failed, fixer uses provider Y
   - Fix verification: fixer output goes through review before being applied

2. **Resume contract needed:** When a run resumes, the resume package should include prior reviewer verdicts so the split-verdict strategy works across runs.

## PM-005: New Rule Candidates

**IMP-018 candidate:** "When refactoring a file that is a manual copy of another module, verify the copy still includes all prior fixes by diffing against the canonical module. If the copy diverges from the canonical, the refactoring must preserve all prior fix patterns or document why they were removed."
- Source: Run 017, Finding 1 — 4th occurrence of SYS-001 (fix lost in copy)

**IMP-019 candidate:** "The error escalation fixer must support provider fallback. When a failure is caused by a specific provider (e.g., Codex exit null), the fixer must attempt the same operation with an alternative provider (e.g., Claude) before declaring the error unrecoverable."
- Source: Run 017, Finding 2 — revision failure recoverable by using Claude instead of Codex

## PM-006: Rule-book-guide Updates

Add to routing_questions: "Is this failure caused by a provider-specific limitation? If yes, the fix should include provider fallback, not just error reporting."

## PM-007: Convergence Trend

```
Run 012:  4→4→3      (both reviewers, first real run, revision worked)
Run 013:  5→6→4      (revision crashed — applies_to.join bug)
Run 014:  3→3        (revision worked, arbitration after 2 splits)
Run 015:  4→blocked  (Codex exit null on revision — prompt too large)
Run 016:  4→blocked  (Codex exit null — file-based prompt, bypass:true)
Run 017:  3→blocked  (Codex exit null — shared-imports reverted fix)
```

Round 0 quality is improving (3 unresolved vs 4-5 in earlier runs). But we haven't completed a multi-round run with both reviewers since run 012. Every run since has been blocked by Codex revision failures.

**The blocker is not the tool's review logic — it's the Codex invocation infrastructure.** The review quality, compliance maps, learning engine, and split-verdict all work correctly. The only thing preventing convergence is Codex failing on the revision call.

## Decisions Needed

1. Fix shared-imports.ts Codex stdin (apply temp-file fix from canonical) OR resolve B-2 permanently (workspace imports)
2. Implement provider fallback in fixer (use Claude when Codex fails on revision)
3. Implement resume with prior reviewer status carry-forward
4. Add IMP-018 and IMP-019 to implementor rulebook
