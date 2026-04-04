# coo-live-executive-status-wiring — Context

## Purpose
This slice makes the merged `COO/briefing/**` package visible in the live COO runtime so the CEO can get a real executive status surface.

## Why It Exists
- The briefing package exists but is still standalone.
- Phase 1 still lacks a strong live answer to "what is on our table?"
- The live status surface should consume admission truth when present and degrade gracefully when it is not.

## Key Constraints
- Keep the briefing layer derived-only.
- Do not mutate source truth while building the brief.
- Keep the output business-level and concise.
- Human verification is required because this becomes a real CEO-facing surface.

## 2026-04-03 Design Decisions
- KPI applicability is `required` because this slice wires a live CEO-facing status route, not a standalone helper.
- The claimed production route is the real COO CLI/startup summary or status surface, not an internal helper-only seam.
- Missing source families must be counted and rendered as degraded-but-usable status, not collapsed into a silent empty state.
- Source-family priority for the live brief is:
  - active COO thread/onion truth
  - finalized requirement artifacts
  - CTO-admission artifacts when present
  - implement-plan feature truth when present
- The runtime surface must stay business-level: blocked work goes to `Issues That Need Your Attention`, unresolved shaping/awaiting-decision work goes to `On The Table`, active execution goes to `In Motion`, and only concise forward-looking items go to `What's Next`.
- The live runtime surface is exposed through existing CLI conventions with `--status` for one-shot status rendering and `/status` during an interactive or scripted session, instead of forcing the full brief into every startup path.
- Source families are correlated by normalized feature slug or scope path so thread/onion truth, finalized requirements, CTO admission artifacts, and implement-plan records can join into one executive feature snapshot without mutating any source system.
- Implement-plan truth resolves from the nearest ancestor `.codex/implement-plan/features-index.json` so dedicated feature worktrees can reuse the shared feature index without creating slice-local plan copies.
- Missing-source accounting is split between globally unavailable families and per-feature expected-but-missing families, with per-feature counts only emitted when that family is otherwise available. This keeps "source not installed here" distinct from "this feature is missing expected truth."

## Dependency Note
This slice should run after the freeze-to-admission wiring slice if possible, so the live status surface can read real admission-state truth. It should still degrade gracefully if admission artifacts are not present yet.

## 2026-04-04 Design Decisions
- Human verification exposed that one-shot `--status` output cannot share the interactive CLI banner and footer; the status route now bypasses that chrome so the CEO sees the brief itself rather than an interactive bootstrap transcript.
- Live source correlation now resolves feature identity from the final slug-like scope-path segment, mirroring the freeze-to-admission route contract from commit `597f32c`, so full scope paths can join cleanly with requirement, CTO-admission, and implement-plan truth.
- The executive surface suppresses plan-index-only features that are merely context-ready or closeout bookkeeping. Pure implement-plan truth can surface without thread/admission companions only when it represents active implementation, a completed-but-not-landed outcome, or an explicit error worth attention.
- The interactive `exit` path must fail closed without prompting again after `readline.close()`. Prompt rendering and resume logic now guard against shutdown state so the CLI exits cleanly instead of throwing `ERR_USE_AFTER_CLOSE`.
- Human verification also exposed that same-scope COO threads can coexist at different fidelity levels. The live adapter now merges duplicate scope threads by choosing the richest signal instead of letting a later low-value direct-response or error shell overwrite a handoff-ready onion thread.
- `handoff_ready` and other admission-pending states are not "completed" for executive reporting. They remain on `On The Table`, and their concrete admission action is allowed onto `What's Next` so the CEO still gets a forward-looking next move.
- Recently completed merged implementations must remain visible without inventing a fifth briefing section. The live status surface now summarizes up to three recent merged completions in `Status notes`.
- Older persisted onion threads can lack `layer_metrics` on historic `onion_turn_result` events. The onion thread schema now defaults those metrics so legacy threads continue to parse and can feed the live status surface.
- Finalized requirement truth cannot rely only on the Brain read route. When the Brain read path fails or is missing, the live adapter now falls back to the thread-carried finalized `requirement_artifact` embedded in the onion workflow state.
- The live CEO-facing surface now has an explicit evidence-normalization step between `BriefSourceFacts` and the final render. The internal 4-section brief still exists for parity and visibility proof, but the human-facing live output is rendered from normalized landed / moving / attention items instead of directly printing the internal buckets.
- Every feature snapshot built by the live adapter now carries evidence qualification, freshness, confidence, and completion metadata. Claims are classified as `direct_source`, `derived_from_sources`, `fallback_missing_source`, `ambiguous`, or `unavailable` before rendering.
- Missing source families are only treated as material when they matter to the claim being made. For example, completed work is no longer downgraded just because a live thread is absent when implement-plan closeout truth is sufficient on its own.
- Historical implement-plan errors are not treated as current blockers once the feature is already completed or merged. The live route only surfaces plan errors as active blockers when the plan truth still reflects unfinished work.
- Completed-work timing is now rendered as elapsed lifecycle time from implement-plan timestamps when that is all the route can prove. The live CEO surface explicitly says active work time is unknown instead of flattening wall-clock lifecycle time into implementation time.
- The current live CEO surface uses this compact shape:
  - one short opening paragraph
  - `Status window`
  - `What landed`
  - optional `What is moving`
  - optional `What stands out`
  - `What needs your attention now`
- Item-level evidence notes now expose provenance, freshness, and confidence in human-facing text so the CEO can tell direct truth apart from derived, fallback, stale, and ambiguous conclusions.
- The COO live status route now records a runtime-only last-status-update anchor under `.codex/runtime/coo-live-status-window.json` so the next status run has an explicit comparison frame without mutating tracked source truth.
- Git verification is intentionally bounded to this live COO surface. It compares feature-slice activity since the previous COO status update and raises a red flag when a recently touched slice is missing from the current COO report, but it does not change the broader context-gathering tool in this slice.
- Human verification for this slice must now validate both readability and the comparison frame: current update time, previous update time, git coverage basis, and any red-flag context-drop finding.
- Landed-item review governance can no longer flatten `0` or missing review cycles into plain `unavailable`. The live route now inspects each slice folder for `review-cycle-state.json`, `cycle-*` artifacts, and `completion-summary.md` review status so the CEO can distinguish:
  - review-cycle explicitly not invoked
  - review-cycle count recorded directly
  - review-cycle count derived from slice artifacts
  - review status not provable because closeout/review artifacts are missing
