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
