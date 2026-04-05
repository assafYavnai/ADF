# Implement-Plan Benchmark Harness

This folder holds the weekend benchmark runner for pre-merge multi-LLM implementation tests.

## What it does

- reads a benchmark manifest
- builds one shared prompt pack from:
  - task summary
  - inline instructions or an instructions file
  - optional context files
  - optional response requirements
- launches all configured engines in parallel through `shared/llm-invoker`
- provisions one detached git worktree per lane when `isolation.mode=git_worktree`
- prewarms isolated worktrees with local `node_modules`, built `dist` outputs, and install-state evidence before provider execution
- runs a real review/fix loop per lane:
  - invoke the model in its isolated worktree
  - run machine verification commands
  - feed failures back into the next cycle
  - stop at green, a classified blocker, or the configured review-cycle cap
- can stop unfinished lanes at a shared global cutoff and later resume them from the same run root
- keeps blocked lanes from taking down the rest of the matrix
- force-closes timed-out provider processes so one hung lane cannot stall suite closeout
- writes durable artifacts under `tests/artifacts/implement-plan-benchmark/...`

## KPIs captured

- full cycle wall-clock time
- total LLM latency
- total estimated prompt/output tokens
- total estimated cost
- review-cycle count
- provider invocation attempt count
- workspace preparation time
- machine verification time
- self-fix-loop count and timing
- per-lane persisted session handle / resume support
- verification history per cycle
- blocker classification and reason when a lane is skipped
- git status, diff stat, diff patch, and changed-path inventory
- heuristic artifact-quality score with edit-surface and required-path checks

## What it does not do

- no merge
- no push
- no implement-plan / review-cycle / merge-queue lifecycle mutation unless a benchmark manifest explicitly asks for it
- no human testing when `skip_human_testing=true`

## Files

- `harness.ts` - runner and manifest parser
- `suite.ts` - parallel multi-feature launcher for weekend runs
- `harness.test.ts` - loop / isolation / blocker / KPI tests
- `sample.manifest.json` - minimal smoke manifest
- `implementation-model-matrix.manifest.json` - broader provider/model matrix sample
- `coo-freeze-to-cto-admission-wiring.manifest.json` - pre-merge benchmark manifest for the freeze-to-admission slice
- `coo-live-executive-status-wiring.manifest.json` - pre-merge benchmark manifest for the live executive status slice

## Usage

From `C:/ADF`:

```powershell
C:\ADF\COO\node_modules\.bin\tsx.cmd tests\implement-plan-benchmark\harness.ts help
C:\ADF\COO\node_modules\.bin\tsx.cmd tests\implement-plan-benchmark\harness.ts run --manifest tests\implement-plan-benchmark\coo-freeze-to-cto-admission-wiring.manifest.json --global-cutoff-minutes 30
C:\ADF\COO\node_modules\.bin\tsx.cmd tests\implement-plan-benchmark\harness.ts run --manifest tests\implement-plan-benchmark\coo-live-executive-status-wiring.manifest.json --global-cutoff-minutes 30
C:\ADF\COO\node_modules\.bin\tsx.cmd tests\implement-plan-benchmark\harness.ts resume --run-root tests\artifacts\implement-plan-benchmark\<run-root> --global-cutoff-minutes 30
C:\ADF\COO\node_modules\.bin\tsx.cmd tests\implement-plan-benchmark\suite.ts run-current-phase1 --global-cutoff-minutes 30
C:\ADF\COO\node_modules\.bin\tsx.cmd tests\implement-plan-benchmark\suite.ts resume --suite-root tests\artifacts\implement-plan-benchmark\suites\<suite-id> --global-cutoff-minutes 30
C:\ADF\COO\node_modules\.bin\tsx.cmd tests\implement-plan-benchmark\harness.ts model-matrix-sample --output tmp\implementation-model-matrix.json
```

The feature manifests are pinned to `HEAD`, not `origin/main`, so they benchmark the current pre-merge codebase. The live phase-1 manifests currently carry `execution_policy.global_cutoff_minutes = 30`.

## Manifest shape

```json
{
  "schema_version": 1,
  "benchmark_id": "my-benchmark",
  "task_summary": "Short shared task summary",
  "instructions": "Inline instructions here",
  "instructions_path": "optional-relative-or-absolute-file-path",
  "context_files": ["docs/phase1/my-feature/README.md"],
  "response_requirements": "Optional output contract",
  "telemetry_metadata": {
    "benchmark_phase": "draft"
  },
  "execution_policy": {
    "max_review_cycles": 6,
    "skip_human_testing": true,
    "global_cutoff_minutes": 30
  },
  "verification_commands": [
    {
      "id": "focused-tests",
      "label": "focused tests",
      "command": "npx.cmd",
      "args": ["tsx", "--test", "tests/integration/my-feature.test.ts"],
      "cwd": ".",
      "timeout_ms": 600000
    }
  ],
  "artifact_policy": {
    "required_paths": ["docs/phase1/my-feature/completion-summary.md"],
    "required_changed_prefixes": ["docs/phase1/my-feature/"],
    "allowed_edit_prefixes": ["COO/controller/", "docs/phase1/my-feature/"]
  },
  "isolation": {
    "mode": "git_worktree",
    "target_slug": "my-feature",
    "base_ref": "HEAD"
  },
  "engines": [
    {
      "id": "codex-default",
      "display_name": "Codex GPT-5.4",
      "cli": "codex",
      "model": "gpt-5.4",
      "reasoning": "xhigh",
      "bypass": true,
      "timeout_ms": 120000
    }
  ]
}
```

## Rules

- use `instructions` or `instructions_path`, not both
- `benchmark_id` and each engine `id` must be safe slug values
- `isolation.mode=git_worktree` requires `base_ref`
- `execution_policy.max_review_cycles` is capped at `6`
- `execution_policy.global_cutoff_minutes` stops unfinished lanes after a shared wall-clock budget
- `skip_human_testing=true` tells the lane to stop at machine-verification green even if the plan asks for human review
- if a plan asks for human verification, the harness still disables it when `skip_human_testing=true`
- relative file paths resolve from the manifest directory
- `model` is passed through to the provider CLI unchanged
- when isolation is enabled, each lane gets its own detached git worktree, runtime dependencies are prewarmed into that checkout, and the provider CLI runs inside that checkout
- when `bypass=true`, the harness invokes providers in explicit non-interactive full-access mode:
  - Codex: `--dangerously-bypass-approvals-and-sandbox`
  - Claude: `--permission-mode bypassPermissions --dangerously-skip-permissions`
  - Gemini: headless `--prompt ""` plus `--sandbox false --approval-mode yolo --yolo`
- resumable lanes persist the latest provider session UUID in `lane-summary.json` / `lane-state.json` and reuse it on `resume` when the provider supports sessions

## Requested Model Matrix

- `gpt-5.4` `xhigh` baseline
- `gpt-5.3-codex-spark`
- `gpt-5.4-mini`
- `gpt-5.3-codex`
- `Claude Opus 4.6`
- `Claude Sonnet 4.6`
- `gemini-3.1-pro`
- `gemini-3-flash`

Generate the sample matrix with:

```powershell
C:\ADF\COO\node_modules\.bin\tsx.cmd tests\implement-plan-benchmark\harness.ts model-matrix-sample --output tmp\implementation-model-matrix.json
```

Provider note:

- the harness will pass any `model` string through unchanged
- provider CLIs may still reject a specific raw model name if that variant is unavailable in the local runtime/account
