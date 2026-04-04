1. Implementation Objective

Create the benchmark-suite skill family under skills/benchmark-suite/ with a shared benchmark-runtime.mjs module, delivering a production supervisor that runs the real governed implementation flow across a JSON-defined provider/model/runtime matrix with per-lane isolation, stop/resume/reset controls, KPI capture, and Brain persistence.

2. Exact Slice Scope

New files:
- skills/benchmark-suite/SKILL.md
- skills/benchmark-suite/agents/openai.yaml
- skills/benchmark-suite/references/setup-contract.md
- skills/benchmark-suite/references/workflow-contract.md
- skills/benchmark-suite/references/prompt-templates.md
- skills/benchmark-suite/scripts/benchmark-suite-helper.mjs (main supervisor ~2000 lines)
- skills/benchmark-suite/scripts/benchmark-suite-setup-helper.mjs (~200 lines)
- skills/benchmark-runtime.mjs (shared infrastructure ~800 lines)

Modified files:
- skills/governed-feature-runtime.mjs (add BENCHMARK_LANE_STATUSES, BENCHMARK_SUITE_STATUSES, BENCHMARK_EVENTS, BENCHMARK_TERMINAL_LANE_STATUSES)
- skills/manifest.json (add benchmark-suite entry)

3. Inputs / Authorities Read

- skills/implement-plan/SKILL.md — governed implementation flow contract
- skills/implement-plan/references/workflow-contract.md — execution contract schema, run modes, worker selection
- skills/implement-plan/references/prompt-templates.md — integrity/implementor/contract templates
- skills/review-cycle/SKILL.md — review flow contract
- skills/review-cycle/references/workflow-contract.md — review execution contract
- skills/merge-queue/SKILL.md — merge flow (not used by default in benchmark)
- skills/governed-feature-runtime.mjs — shared enums and utilities
- skills/manifest.json — skill registration structure
- skills/manage-skills.mjs — install/check tool
- tests/implement-plan-benchmark/harness.ts — Spec 1 proven patterns for worktree provisioning, KPI capture, blocker classification, resume, artifact quality
- tests/implement-plan-benchmark/suite.ts — multi-manifest parallel runner pattern
- docs/PHASE1_MASTER_PLAN.md — Phase 1 alignment
- .codex/implement-plan/setup.json — current runtime capability detection

4. Required Deliverables

- benchmark-suite-helper.mjs with 10 commands: help, run, resume, status, tail-lane, stop-lane, stop-provider, stop-suite, reset-lane, dry-run
- benchmark-suite-setup-helper.mjs with write-setup command
- benchmark-runtime.mjs with: worktree provisioning + prewarming, verification execution, blocker classification, failure scope classification, KPI builders, artifact quality heuristic, stop signal management, heartbeat management, event logging, Brain summary builder, config parsing (v1 compat + v2 native)
- SKILL.md documenting the full command surface and supervisor behavior
- agents/openai.yaml for OpenAI agent definition
- references/setup-contract.md, workflow-contract.md, prompt-templates.md
- Updated manifest.json with benchmark-suite skill entry
- Updated governed-feature-runtime.mjs with benchmark enum exports

5. Forbidden Edits

- skills/implement-plan/ (no logic modifications)
- skills/review-cycle/ (no logic modifications)
- skills/merge-queue/ (no logic modifications)
- skills/manage-skills.mjs
- tests/implement-plan-benchmark/ (no Spec 1 modifications)
- COO/, components/, shared/
- Any production runtime outside the allowed edits

6. Integrity-Verified Assumptions Only

- IMPLEMENT_PLAN_RUN_MODES already includes "benchmarking" — verified in governed-feature-runtime.mjs line 43-46
- implement-plan-helper.mjs already supports --run-mode benchmarking with supervisor_deferred lifecycle status — verified via grep across the file
- The harness.ts execution patterns (worktree provisioning, KPI capture, blocker classification) are proven by existing tests in harness.test.ts and suite.test.ts
- The skill registration pattern in manifest.json requires: name, legacy_public_names, required_files array
- All skill helpers follow the pattern: installBrokenPipeGuards() -> main() -> parseArgs -> command dispatch -> printJson
- Setup helpers follow the pattern: loadExisting -> detectCapabilities -> deriveSetup -> validateSetup -> writeAtomic under lock
- The governed-feature-runtime.mjs exports are stable and used by all existing helpers

7. Explicit Non-Goals

- Spec 1 harness.ts rewrite or migration
- Spec 3 dashboard/UI for live monitoring
- Cross-suite comparison and trending
- Result archival and cleanup policies
- Provider-specific session optimization
- Parallel feature benchmarks (multiple features in one suite)
- Real-provider integration tests
- merge-queue integration by default
- Modification of existing skills

8. Proof / Verification Expectations

Machine Verification Plan:
- node --check on every new or modified .mjs file
- git diff --check on all changed source files
- dry-run command smoke test: parse sample v2 config, validate engines, show planned matrix
- Config parsing: valid v1, valid v2, invalid rejection
- Stop signal round-trip: create -> detect -> clear
- Status output shape verification
- manage-skills install + check for manifest registration

Human Verification Plan:
Required: false

9. Required Artifact Updates

- skills/manifest.json — add benchmark-suite entry with required_files list
- skills/governed-feature-runtime.mjs — add benchmark enum exports
- docs/phase1/implementation-benchmarking-supervisor-skill/implement-plan-contract.md — already written
- docs/phase1/implementation-benchmarking-supervisor-skill/completion-summary.md — write at closeout

10. Closeout Rules

- Human testing is not required for this slice
- Review-cycle runs after machine verification (post_send_to_review=true, review_until_complete=true, max_cycles=5)
- Post-human-approval sanity pass is not required (human verification not required)
- Final completion happens only after merge success via merge-queue
- The feature branch must be committed and pushed before merge-queue enqueue
- completion-summary.md must be written before marking complete
