1. Implementation Objective

Create a new repo-owned benchmark-suite skill under skills/benchmark-suite/ that supervises isolated benchmark lanes running the real governed implementation flow (implement-plan -> machine verification -> review-cycle until_complete -> stop before merge) across a JSON-defined provider/model/runtime matrix. The skill must build on the shared Spec 1 execution contract from tests/implement-plan-benchmark/harness.ts without replacing implement-plan or review-cycle.

2. Slice Scope

- New skill family: skills/benchmark-suite/ (SKILL.md, agents/openai.yaml, references/*, scripts/benchmark-suite-helper.mjs, scripts/benchmark-suite-setup-helper.mjs)
- New shared benchmark infrastructure: skills/benchmark-runtime.mjs (extracted from harness.ts + new supervisor capabilities)
- Enum additions to skills/governed-feature-runtime.mjs (BENCHMARK_LANE_STATUSES, BENCHMARK_SUITE_STATUSES, BENCHMARK_EVENTS, BENCHMARK_TERMINAL_LANE_STATUSES)
- Manifest registration in skills/manifest.json
- Feature documentation under docs/phase1/implementation-benchmarking-supervisor-skill/

3. Required Deliverables

- skills/benchmark-suite/SKILL.md with full command surface documentation
- skills/benchmark-suite/agents/openai.yaml
- skills/benchmark-suite/references/setup-contract.md
- skills/benchmark-suite/references/workflow-contract.md
- skills/benchmark-suite/references/prompt-templates.md
- skills/benchmark-suite/scripts/benchmark-suite-helper.mjs with commands: help, run, resume, status, tail-lane, stop-lane, stop-provider, stop-suite, reset-lane, dry-run
- skills/benchmark-suite/scripts/benchmark-suite-setup-helper.mjs
- skills/benchmark-runtime.mjs with worktree provisioning, prewarming, verification execution, blocker classification, KPI builders, artifact quality heuristic, stop signal management, heartbeat management, event logging, failure scope classification, Brain summary builder, config validation
- Updated skills/manifest.json with benchmark-suite entry
- Updated skills/governed-feature-runtime.mjs with benchmark enums
- implement-plan-contract.md (this file)
- completion-summary.md

4. Allowed Edits

- skills/benchmark-suite/ (new, entire directory)
- skills/benchmark-runtime.mjs (new file)
- skills/governed-feature-runtime.mjs (add new exported const Sets only)
- skills/manifest.json (add benchmark-suite entry only)
- docs/phase1/implementation-benchmarking-supervisor-skill/ (feature artifacts)

5. Forbidden Edits

- skills/implement-plan/ (no modifications to existing skill logic)
- skills/review-cycle/ (no modifications to existing skill logic)
- skills/merge-queue/ (no modifications to existing skill logic)
- skills/manage-skills.mjs (no modifications)
- tests/implement-plan-benchmark/harness.ts (no modifications to existing Spec 1 code)
- tests/implement-plan-benchmark/suite.ts (no modifications)
- COO/ (no modifications)
- components/ (no modifications)
- shared/ (no modifications)
- Any file outside the allowed edits list

6. Acceptance Gates

KPI Applicability: not required
KPI Non-Applicability Rationale: This slice creates a new benchmark supervisor skill that orchestrates governed flows. It does not touch production KPI instrumentation routes. The benchmark skill itself captures KPIs from the real governed workflow but does not introduce or modify the KPI measurement pipeline. KPI coverage of the benchmark skill's own internal routes is deferred to a future KPI-specific slice when the skill reaches production maturity.

Vision Compatibility: Compatible. The ADF vision includes transparent, observable, and governed AI-assisted development. A benchmark supervisor skill that runs the real governed flow across a provider matrix directly supports the vision of evidence-based quality comparison and governed execution transparency.

Phase 1 Compatibility: Compatible. Phase 1 focuses on building reliable ADF startup (intake -> queue -> implementation -> review -> delivery). The benchmark skill strengthens Phase 1 by enabling pre-merge quality validation across providers using the real governed route, without modifying the core pipeline.

Master-Plan Compatibility: Compatible. The master plan calls for transparent execution, observable workflows, and governed feature delivery. The benchmark supervisor skill adds a new observable execution mode that reuses the existing governed route truthfully.

Current Gap-Closure Compatibility: Compatible. The current gap closure plan includes implementation benchmarking as a priority feature stream. This slice directly closes the Spec 2 gap for the benchmark supervisor skill.

Later-Company Check: no
Compatibility Decision: compatible
Compatibility Evidence: The benchmark-suite skill is explicitly listed in the Phase 1 feature backlog as "implementation-benchmarking-supervisor-skill". It reuses the existing implement-plan and review-cycle governed routes without modification. It adds no new production routes, modifies no existing production behavior, and operates as a pure supervisor above the governed flow.

Machine Verification Plan:
- node --check on every new or modified .mjs file (governed-feature-runtime.mjs, benchmark-runtime.mjs, benchmark-suite-helper.mjs, benchmark-suite-setup-helper.mjs)
- git diff --check on all changed source files
- dry-run command smoke test: parse a sample v2 config JSON, validate engines array, show planned matrix without execution
- Config parsing validation: valid v1 manifest, valid v2 config, invalid config rejection
- Stop signal round-trip: create -> detect -> clear
- Status command: verify output shape includes total/active/blocked/completed/failed/resumable counts
- manage-skills install --target claude followed by manage-skills check --target claude to verify manifest registration

Human Verification Plan:
Required: false

7. Observability / Audit

- All benchmark suite runs produce durable artifacts under the run-root directory
- Suite-state.json and per-lane lane-state.json provide machine-readable status
- File-based event log under run-root/events/ for durable notification history
- Brain summary persistence (markdown + JSON) after suite completion
- Heartbeat files per lane for live progress monitoring
- The skill does not modify implement-plan or review-cycle observability

8. Dependencies / Constraints

- Depends on existing Spec 1 infrastructure in tests/implement-plan-benchmark/harness.ts for proven patterns (conceptual port, not runtime import)
- Depends on governed-feature-runtime.mjs for shared enums and utilities
- Depends on implement-plan-helper.mjs prepare --run-mode benchmarking for governed flow integration
- Depends on review-cycle-helper.mjs prepare for review flow integration
- Depends on shared/llm-invoker for provider invocation
- Must not modify existing skill behavior
- Must preserve backward compatibility with v1 manifests

9. Non-Goals

- Spec 1 harness.ts rewrite or migration
- Spec 3 dashboard/UI for live benchmark monitoring
- Cross-suite comparison and trending
- Benchmark result archival and cleanup policies
- Provider-specific session optimization beyond what Spec 1 already provides
- Parallel feature benchmarks (multiple features in one suite)
- End-to-end real-provider integration tests
- merge-queue integration by default (lanes stop at merge_ready)
- Modification of existing implement-plan, review-cycle, or merge-queue skills

10. Source Authorities

- C:/ADF/skills/implement-plan/SKILL.md
- C:/ADF/skills/implement-plan/references/workflow-contract.md
- C:/ADF/skills/review-cycle/SKILL.md
- C:/ADF/skills/review-cycle/references/workflow-contract.md
- C:/ADF/skills/merge-queue/SKILL.md
- C:/ADF/skills/governed-feature-runtime.mjs
- C:/ADF/skills/manifest.json
- C:/ADF/skills/manage-skills.mjs
- C:/ADF/tests/implement-plan-benchmark/harness.ts (Spec 1 reference implementation)
- C:/ADF/tests/implement-plan-benchmark/suite.ts (Spec 1 suite runner)
- C:/ADF/docs/PHASE1_MASTER_PLAN.md
