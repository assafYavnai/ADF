1. Failure Classes
- Provider bypass mode was not frozen as an explicit full-access contract across all benchmarked CLIs.
- Gemini invocation was not explicitly forced into headless mode, leaving benchmark lanes vulnerable to interactive stalls.
- Benchmark artifacts did not record the resolved worker access mode, which weakened post-run auditability of KPI data.

2. Route Contracts
- Route: benchmark manifest -> harness lane request -> provider CLI invocation -> isolated worktree edits -> machine verification -> lane summary.
  Invariant: every `bypass=true` lane must execute under an explicit non-interactive full-access provider mode with no approval prompts or sandbox-elevation pauses.
  KPI Applicability: Applicable.
  KPI Route / Touched Path: `shared/llm-invoker/**`, `tests/implement-plan-benchmark/**`.
  KPI Raw-Truth Source: provider arg builders, generated lane request artifacts, harness/unit tests, and benchmark operator docs.
  KPI Coverage / Proof: green invoker, managed-process, harness, and suite tests plus harness/suite help smoke commands.
  KPI Production / Proof Partition: proof is isolated to the benchmark harness/runtime route; no production merge lifecycle was changed.
  Allowed mutation surfaces: `shared/llm-invoker/**`, `tests/implement-plan-benchmark/**`, and benchmark docs.
  Forbidden shared-surface expansion: no provider recommendation policy changes, no merge behavior changes, no unrelated workflow redesign.
  Docs that must be updated: `tests/implement-plan-benchmark/README.md`.

3. Sweep Scope
- Provider arg construction for Codex, Claude, and Gemini.
- Benchmark prompt/request artifact generation in `tests/implement-plan-benchmark/harness.ts`.
- Regression coverage in `shared/llm-invoker/*.test.ts` and `tests/implement-plan-benchmark/*.test.ts`.
- Existing timeout/process-tree stabilization in `shared/llm-invoker/managed-process.ts` to ensure the access-mode fix does not regress unattended closeout.

4. Planned Changes
- Extract testable provider argument builders from `shared/llm-invoker/invoker.ts`.
- Preserve Codex full-access bypass behavior and assert it in tests.
- Upgrade Claude bypass mode to explicit `--permission-mode bypassPermissions --dangerously-skip-permissions`.
- Upgrade Gemini bypass mode to explicit headless execution with `--prompt "" --sandbox false --approval-mode yolo --yolo`.
- Record `access_mode` in benchmark lane request artifacts and tell workers they already have full access in the cycle prompt.
- Update benchmark docs to state the exact per-provider full-access mapping.

5. Closure Proof
- `C:\\ADF\\COO\\node_modules\\.bin\\tsx.cmd --test shared\\llm-invoker\\invoker.test.ts`
- `C:\\ADF\\COO\\node_modules\\.bin\\tsx.cmd --test shared\\llm-invoker\\managed-process.test.ts`
- `C:\\ADF\\COO\\node_modules\\.bin\\tsx.cmd --test tests\\implement-plan-benchmark\\harness.test.ts`
- `C:\\ADF\\COO\\node_modules\\.bin\\tsx.cmd --test tests\\implement-plan-benchmark\\suite.test.ts`
- `C:\\ADF\\COO\\node_modules\\.bin\\tsx.cmd tests\\implement-plan-benchmark\\harness.ts help`
- `C:\\ADF\\COO\\node_modules\\.bin\\tsx.cmd tests\\implement-plan-benchmark\\suite.ts help`

6. Non-Goals
- No real provider benchmark matrix execution in this review cycle.
- No merge, push, or feature lifecycle closeout beyond review artifacts and verification.
- No changes to the selected model matrix itself.
