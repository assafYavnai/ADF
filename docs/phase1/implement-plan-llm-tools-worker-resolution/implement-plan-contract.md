# 1. Implementation Objective

Wire the runtime preflight `llm_tools` detection into the governed `implement-plan` and `review-cycle` worker-selection pipeline. After this fix, setup.json stores available LLM tools from preflight, `resolveWorkerSelection()` surfaces them, the workflow contract defines the spawn pattern, and the prepare output includes `available_workers`.

# 2. Slice Scope

- Update `implement-plan-setup-helper.mjs` to run preflight (or read its cached output) during setup write and store the `llm_tools` object in setup.json
- Update the setup.json contract to include `llm_tools` as a recognized field with the shape: `{ "<name>": { command_name, available, path, version, autonomous_invoke } }`
- Update `resolveWorkerSelection()` in `implement-plan-helper.mjs` to read `llm_tools` from setup and return `available_workers` alongside the resolved default worker
- Update the prepare output to include `available_workers` at the top level
- Update `implement-plan` workflow-contract.md to define the Bash spawn pattern for non-default workers
- Update `review-cycle` workflow-contract.md with the same spawn pattern for auditor/reviewer/implementor workers
- Update `review-cycle-setup-helper.mjs` to store `llm_tools` in its setup.json using the same pattern

# 3. Required Deliverables

- `implement-plan-setup-helper.mjs`: run preflight and store `llm_tools` in setup.json
- `implement-plan-helper.mjs`: `resolveWorkerSelection()` returns `available_workers` list
- `implement-plan-helper.mjs`: prepare output includes `available_workers`
- `implement-plan` workflow-contract.md: spawn pattern for non-default workers
- `review-cycle-setup-helper.mjs`: store `llm_tools` in its setup.json
- `review-cycle` workflow-contract.md: spawn pattern for non-default workers

# 4. Allowed Edits

- `C:/ADF/skills/implement-plan/scripts/implement-plan-setup-helper.mjs`
- `C:/ADF/skills/implement-plan/scripts/implement-plan-helper.mjs`
- `C:/ADF/skills/implement-plan/references/workflow-contract.md`
- `C:/ADF/skills/implement-plan/SKILL.md` — only if the setup contract or worker policy needs updating
- `C:/ADF/skills/review-cycle/scripts/review-cycle-setup-helper.mjs`
- `C:/ADF/skills/review-cycle/references/workflow-contract.md`
- `C:/ADF/skills/review-cycle/SKILL.md` — only if the access-mode rule needs updating
- `C:/ADF/docs/phase1/implement-plan-llm-tools-worker-resolution/**`
- Repo-owned skill install/check helpers only if source changes require refreshed generated installs

# 5. Forbidden Edits

- Do not change the preflight detection logic (`tools/agent-runtime-preflight.mjs`) — already done
- Do not change `cli-agent.md` — already updated
- Do not change how implementor results are collected or verified
- Do not change review-cycle auditor/reviewer/implementor prompt templates
- Do not change merge-queue, worktree lifecycle, or artifact layout
- Do not change the worker execution tracking / attempt lifecycle
- Do not redesign the full worker lifecycle beyond surfacing available tools

# 6. Acceptance Gates

1. After setup refresh, `setup.json` contains an `llm_tools` object with entries for each detected tool, including `available`, `path`, `version`, and `autonomous_invoke`
2. `resolveWorkerSelection()` returns `available_workers` as an array of `{ name, autonomous_invoke, version }` for every tool with `available: true` in setup `llm_tools`
3. The prepare output JSON includes `available_workers` at the top level, matching what `resolveWorkerSelection()` returns
4. The `implement-plan` workflow contract defines the exact Bash invocation pattern for spawning a non-default worker using `autonomous_invoke`
5. The `review-cycle` workflow contract defines the same spawn pattern for auditor/reviewer/implementor workers
6. `review-cycle-setup-helper.mjs` stores `llm_tools` in its setup.json using the same shape
7. Existing `detected_runtime_capabilities` fields in setup.json are preserved for backward compatibility — `llm_tools` is additive

## KPI Applicability

KPI Applicability: not required
KPI Non-Applicability Rationale: This slice wires internal plumbing between preflight detection and helper worker selection. It does not introduce or modify a product/runtime route that needs KPI telemetry.

## Vision / Phase 1 / Master-Plan / Gap-Closure Compatibility

Vision Compatibility: Strengthens operational discipline and delegation by enabling the governed workflow to select the right tool for each worker role, rather than silently defaulting.
Phase 1 Compatibility: Phase 1 implementation startup infrastructure. Worker selection is foundational to governed implementation and review. Not a full virtual corporation function.
Master-Plan Compatibility: 1. Yes — strengthens the implementation startup. 2. Yes — helps the COO manage the queue by knowing which tools are available. 3. Yes — directly improves implementation and review by enabling tool-specific workers. 4. Required now — without this, the orchestrator cannot honor "reviewers must be codex" requests. 5. Yes — reduces ambiguity by making tool availability structured data instead of assumptions.
Current Gap-Closure Compatibility: Infrastructure supporting all gap closure by enabling the governed workflow to use the right tool for each task.
Later-Company Check: no
Compatibility Decision: compatible
Compatibility Evidence: The preflight `llm_tools` detection was merged at `867bcce` but the data never reaches the helper or orchestrator. This slice closes that gap.

## Machine Verification Plan

- Run `node --check` on all modified helper and script files
- Run setup refresh and verify `llm_tools` appears in setup.json with correct entries
- Run prepare and verify `available_workers` appears in the output JSON
- Verify `resolveWorkerSelection()` returns `available_workers` with at least one entry when tools are available
- Verify existing `detected_runtime_capabilities` fields are preserved in setup.json
- Refresh installed skill targets if source changes materially

## Human Verification Plan

- Required: false
- Reason: this is internal plumbing between preflight and helper. Fully provable through machine verification. No user-facing surface changes.

# 7. Observability / Audit

- The prepare output must include `available_workers` showing all available LLM tools
- Setup refresh must log which tools were detected and stored
- If preflight fails or returns no tools, the setup must still complete but `llm_tools` should be empty — not missing

# 8. Dependencies / Constraints

- Depends on preflight `llm_tools` section (already merged at `867bcce`)
- Must not break existing setup.json files that lack `llm_tools` — treat missing as empty
- Must not break existing `resolveWorkerSelection()` callers — `available_workers` is additive
- The setup helper runs preflight via `bash adf.sh --runtime-preflight --json` or reads the preflight script directly

# 9. Non-Goals

- No preflight detection changes
- No cli-agent.md changes
- No prompt template changes
- No merge-queue or worktree changes
- No worker execution tracking changes
- No full worker lifecycle redesign

# 10. Source Authorities

- `C:/ADF/docs/phase1/implement-plan-llm-tools-worker-resolution/README.md`
- `C:/ADF/docs/phase1/implement-plan-llm-tools-worker-resolution/context.md`
- `C:/ADF/tools/agent-runtime-preflight.mjs`
- `C:/ADF/skills/implement-plan/scripts/implement-plan-setup-helper.mjs`
- `C:/ADF/skills/implement-plan/scripts/implement-plan-helper.mjs`
- `C:/ADF/skills/implement-plan/references/workflow-contract.md`
- `C:/ADF/skills/review-cycle/scripts/review-cycle-setup-helper.mjs`
- `C:/ADF/skills/review-cycle/references/workflow-contract.md`

# 11. Closeout Rules

- Run machine verification before review handoff
- Use review-cycle with `until_complete=true` after implementation
- Human verification is not required
- Commit and push feature-branch changes before merge-queue handoff
- Do not mark complete until review closure and merge-queue closeout succeed truthfully
