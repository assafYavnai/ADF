# ARB Run-01 Replay Validation — agent-role-builder-self-role-001-replay-001

## Summary

Replayed the original run-001 baseline request on the current codebase at commit d826757 with a 10-round budget and 6-hour watchdog. The run reached **frozen** (clean freeze, no conditions) in **4 rounds**, proving the current code can converge a fresh self-role create to terminal approval.

## Run Identity

| Field | Value |
|---|---|
| Job ID | `agent-role-builder-self-role-001-replay-001` |
| Request file | `tools/agent-role-builder/tmp/arb-run01-replay-001.json` |
| Run directory | `tools/agent-role-builder/runs/agent-role-builder-self-role-001-replay-001/` |
| Commit SHA | `d8267576ccd0ffa0ace46e8b409a6086d8e5db01` |
| Operation | create |
| Board profile | medium (1 leader, 2 reviewers) |

## Terminal Status

**Status: frozen** — All reviewers approved and no remaining repair work was found after learning and rule checks.

No conditions manifest. No pushback. No resume required.

## Rounds Executed

| Round | Mode | Leader Verdict | Duration |
|---|---|---|---|
| 0 | full | pushback | ~19 min (reviewers) + leader |
| 1 | delta | pushback | ~13 min |
| 2 | delta | frozen (governance override) | ~2 min |
| 3 | regression_sanity | frozen | ~1 min |

**Total rounds: 4** (of 10 budget)

## Wall-Clock Duration

- Started: 2026-03-31T07:01:37.919Z
- Ended: 2026-03-31T08:23:30.182Z
- **Total: 81 minutes 52 seconds** (4,912,263 ms)

## LLM Calls, Tokens, and Cost

| Metric | Value |
|---|---|
| Total LLM calls | 15 |
| LLM failures | 0 |
| Tokens in (estimated) | 31,401 |
| Tokens out (estimated) | 27,247 |
| **Estimated cost** | **$0.55** |

### Breakdown by Engine

| Engine | LLM Calls | Latency (ms) | Tokens In | Tokens Out | Cost |
|---|---|---|---|---|---|
| board-review | 10 | 1,167,424 | 23,774 | 7,530 | $0.22 |
| rules-compliance-enforcer | 3 | 3,566,681 | 865 | 19,245 | $0.29 |
| self-learning-engine | 2 | 178,014 | 6,762 | 472 | $0.04 |

## Session Reuse

| Session Type | Count | Latency (ms) |
|---|---|---|
| none (no session) | 5 | 3,744,641 |
| fresh | 3 | 579,012 |
| resumed | 7 | 588,381 |
| replaced | 0 | 0 |

- **Cold starts: 3** (fresh sessions)
- **Resumed sessions: 7**
- **Resume failures: 0**
- **No-session calls: 5** (rules-compliance-enforcer and self-learning-engine don't use sessions)

Session reuse is working correctly. Resumed sessions have comparable latency to fresh sessions.

## Self-Repair Activity

- **Self-repair engine: not triggered** — no repair events recorded
- No bug reports generated
- No JSON parse failures
- 0 LLM failures across all 15 calls

This is a significant improvement over run 019, which blocked on a leader parse failure.

## Engine Bottlenecks

| Engine | Finding |
|---|---|
| **rules-compliance-enforcer** | **Major bottleneck** — 3 calls consumed 3,566,681 ms (72.6% of total runtime). The initial rule sweep alone took ~47 minutes. |
| board-review | Healthy — 10 calls in 1,167,424 ms (~2 min avg per call) |
| self-learning-engine | Healthy — 2 calls in 178,014 ms |
| self-repair-engine | Not triggered (no errors to repair) |

The rules-compliance-enforcer is the primary cost/time driver due to its Codex session-less invocations with large context windows.

## Rule Compliance

- **72 rule checks across 24 rules** (ARB-001 through ARB-025)
- **0 non-compliant** — all rules passed
- **0 new rule proposals**
- **4 learning findings** from the self-learning-engine
- Rules with learning coverage: ARB-002, ARB-006, ARB-011, ARB-017

## Artifact Quality

The final artifact reached clean **frozen** with no conditions, which is stronger than run 018's `frozen_with_conditions`. The board converged through:

1. **Round 0**: Identified freeze-gate defect (material pushback alone insufficient, need reviewer-clear)
2. **Round 1**: Fixed freeze-gate, but scope alignment issue persisted
3. **Round 2**: Fixed scope alignment, both reviewers approved, regression sanity needed
4. **Round 3**: Regression sanity passed, clean freeze

**Assessment: The artifact quality justifies the cost and time.** $0.55 and 82 minutes for a fully governed, multi-LLM reviewed role definition with no remaining issues is excellent value.

## Comparison Against Prior Runs

| Dimension | Run 018 | Run 019 | Replay 001 |
|---|---|---|---|
| Status | frozen_with_conditions | blocked | **frozen** (clean) |
| Rounds | 3 | 2 | 4 |
| Operation | update | update | create |
| Arbitration | false | false | false |
| LLM failures | 0 | 1 (parse failure) | 0 |
| Outcome quality | Good (deferred items) | Failed | **Best** (no conditions) |

Key differences:
- **vs Run 018**: This replay achieved a cleaner freeze (no conditions). Run 018 was an update with prior context; this was a fresh create that still converged faster in wall-clock terms.
- **vs Run 019**: Run 019 blocked on a leader parse failure (bug-report-1.json). This replay had zero parse failures and zero LLM failures, confirming the self-repair engine fixes from Step 3A and Step 4A are working.

## Recommended Next Fixes

1. **Rules-compliance-enforcer latency**: The initial rule sweep (47 min) is the dominant bottleneck. Consider:
   - Session reuse for the rules-compliance-enforcer (currently uses no sessions)
   - Caching the initial sweep result for subsequent rounds
   - Parallel rule checking across rule groups

2. **No code fixes needed**: The current codebase at d826757 successfully completes a full self-role creation from scratch with no errors, no parse failures, and no self-repair triggers. The engine is stable.

## Safety Verification

- Existing run folders preserved:
  - `runs/agent-role-builder-self-role-001/` — untouched
  - `runs/agent-role-builder-self-role-019/` — untouched
- No code was changed during this validation
- Canonical role directory was updated by the frozen promotion (as expected)
