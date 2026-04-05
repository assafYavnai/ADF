# coo-live-executive-status-wiring - Context

## Purpose
This slice no longer means only "wire the executive brief into the CLI."

It now means:
- build a company-first COO executive surface
- cross-check evidence before briefing upward
- investigate anomalies
- maintain bounded operating continuity and trust continuity
- fail closed when Brain is unavailable

## Rebased Scope Decision - 2026-04-05
- The original narrow live-status contract was insufficient for Phase 1.
- The COO is expected to act as an executive operator, not a field renderer.
- The slice is therefore rebased, not abandoned.
- Existing live-status wiring, provenance plumbing, git status window, and briefing package remain the foundation.
- The slice now adds bounded situational awareness, operating-table continuity, deep-audit behavior, and trust-aware judgment on top of that foundation.

## Evidence Hierarchy Decision - 2026-04-05
When evidence disagrees, the COO trusts:
1. direct workspace reality
2. canonical lifecycle artifacts
3. docs and Brain
4. worker claims / summaries / KPI surfaces
5. the derived trust ledger

The trust ledger may increase or decrease suspicion, but it never outranks stronger evidence.

## Brain Decision - 2026-04-05
- Brain is the primary durable memory for the rebased COO path.
- Local persisted state is allowed only for regenerable runtime continuity:
  - operating table continuity
  - trust continuity
  - status-window comparison anchor
- If Brain is unavailable, the COO must hard stop.
- No fake Brain-backed conclusion is allowed.

## Company-First Decision - 2026-04-05
- `/status` defaults to company-level state.
- The current thread remains visible only as operational context.
- The current thread must not define the entire CEO answer.

## Investigation Decision - 2026-04-05
- Suspicious surfaced facts must be investigated before being briefed upward.
- Example: `0 review cycles` is not a reportable conclusion by itself.
- The COO must determine whether it is:
  - acceptable legacy timing
  - acceptable route policy
  - suspicious route failure
  - contradicted or not provable
- The implicated worker, component, or route should be identified when failure is real.
- For KPI gaps, the COO now cross-checks workspace route code against landed slice closeout truth.
- In the current repo shape, that investigation showed a specific route fault: implement-plan computes KPI totals in `run.kpi_projection`, but some landed feature closeout truth does not persist that projection into durable `implement-plan-state.json`.
- That means the CEO-facing report should frame the problem as a system closeout-route gap, not as a feature-delivery failure.

## Deep-Audit Decision - 2026-04-05
- First run performs a deep audit when no prior valid baseline exists.
- Later deep audits are bounded and trigger from:
  - suspicious findings
  - git-backed dropped-context red flags
  - trust transitions
  - staleness pressure
- Deep audits are targeted by default and expand to company-wide only when findings justify broader concern.
- Deep audits write findings to Brain through the runtime path and should be visible to the CEO through status notes.

## Trust Decision - 2026-04-05
- Trust subjects are workers, components, and routes.
- Trust rises from repeated evidence agreement and softens under staleness pressure.
- Credible drift or contradiction can downgrade trust immediately.
- Trust changes only the intensity of checking and suspicion.
- Full trust requires:
  - a fresh deep audit
  - a COO recommendation
  - a CEO approval opportunity

## Status Surface Decision - 2026-04-05
- The live CEO-facing output must stay readable and business-level.
- The internal executive brief keeps the 4 executive sections as derived operating truth.
- The default live CEO-facing surface is now frozen to the currently human-approved contract:
  - opening summary
  - optional delivery snapshot
  - optional recent landings
  - Issues That Need Your Attention
  - On The Table
  - In Motion
  - recommendation sentence plus final focus options when the evidence supports at least two concrete next-focus options
- The runtime should gather and normalize the evidence deterministically, but the final CEO-facing wording should come from the COO model, not from hardcoded slot-filled prose.
- The agent should receive a strict evidence pack, not a pre-rendered prose template, so the COO can brief the CEO naturally from source truth instead of echoing a canned surface.
- The live route now validates the model-rendered output against that frozen contract and falls back to a deterministic version of the same contract if the model drifts.
- The live route now treats the final focus-choice block as evidence-gated: if fewer than two concrete next-focus options are supported, it omits that block instead of inventing a second option.
- Attention items should surface:
  - the issue title on its own line
  - why it is happening
  - business impact
  - the system fix
  - urgency / priority
  - whether a handoff is already prepared
- The live status should also end with a short call for action when there are clear next-focus options.

## Human-Facing Follow-Up Decision - 2026-04-05
- The CEO-facing status was still too dense after the first rebased pass.
- The live evidence pack now groups duplicate route findings, carries business impact plus route-chain diagnosis, and adds a compact company KPI/auditability summary.
- The live status render instructions now explicitly bias toward:
  - short bullet lists
  - separate title lines
  - plain-language root-cause explanation
  - urgency-based ordering in the final focus options
  - a closing choice prompt when there are clear prepared options
- The CLI now shows a status-loading cue while the COO gathers notes so the CEO does not see an apparently frozen terminal.
- The landed-work summary now uses a compact `Recent landings` bullet list instead of dense prose.
- Each landing should surface:
  - review status
  - pre-merge approval-proof status when provable
  - a short note when a gap is acceptable legacy
  - `see issue below` when the landing carries a suspicious route gap
- If a landing is merged but durable closeout truth does not prove the approved commit before merge, the COO must raise that as an issue instead of silently treating the landing as normal.
- The separate `What's Next` section is dropped from the live CEO-facing status. The COO recommendation now appears as the summary line immediately above the final focus-choice options.

## Review-Cycle Alignment Decision - 2026-04-05
- Review-cycle cycle-02 found that the live agent path, the deterministic fallback, the tests, and the docs had drifted into conflicting contracts.
- The chosen bounded fix is to preserve the currently human-approved live CEO-facing contract instead of silently restoring the older 4-section live surface.
- The internal 4-section executive brief remains derived operating truth, but the supported live CEO-facing route is now:
  - opening summary
  - optional delivery snapshot
  - optional recent landings
  - Issues That Need Your Attention
  - On The Table
  - In Motion
  - recommendation sentence plus 3 focus options when the evidence supports at least two concrete next-focus options
- `What's Next` remains internal truth and is merged into the recommendation/focus prompt on the live route.
- The default live CEO-facing route no longer prints a separate operational footer.
- The agent evidence pack must reuse the same recent-landings freshness window as the normalized surface.
- The git comparison anchor must only advance after a successful CEO-visible status render.

## Review-Cycle Exactness Decision - 2026-04-05
- Review-cycle cycle-03 found that the live route still left part of the approved CEO-facing contract to model compliance.
- The route now needs exact post-render enforcement for:
  - opening-summary presence
  - exact-once required headings
  - required heading order
  - no extra `##` sections on the live CEO-facing surface
  - no underfilled or overfilled final focus-choice block
- The final focus-choice block now has an explicit no-fake-options rule:
  - show it only when at least two concrete next-focus options are evidenced
  - otherwise omit it entirely

## Accepted-Body Parity Decision - 2026-04-05
- Review-cycle cycle-04 found that structural exactness alone was still too weak.
- A structurally valid live CEO-facing body can still be wrong if it drops evidenced issues, table items, active work, or recent landing risk notes.
- The supported live route now treats accepted-body evidence parity as part of the contract:
  - `Issues`, `On The Table`, `In Motion`, and `Recent landings` must retain the evidenced items when they exist
  - suspicious recent landings must keep their `see issue below` carry-through
  - handoff-ready attention items must keep the fix path visible on the accepted CEO-facing body
  - final focus-option visibility is measured against the accepted CEO-facing body, not the internal brief
- Visibility telemetry for the prompt-backed route now measures the final accepted CEO-facing body rather than the internal brief counts.
- If the model returns copy that is structurally clean but evidence-dropping, the route deterministically falls back to the supported evidence-based body.

## Launcher Note - 2026-04-05
- The worktree launcher surfaced real shell errors because `adf.sh` called `coo_needs_build` and `memory_engine_needs_build` without defining them.
- This slice now restores those missing wrapper functions so the live status route can launch cleanly from the governed worktree path.

## Timing Truth Decision - 2026-04-05
- Elapsed lifecycle time is not the same as active implementation time.
- If only lifecycle timestamps are available, the COO must say active work time is unknown.
- This rule is enforced both in landed-item rendering and in anomaly classification.

## Operating Continuity Decision - 2026-04-05
Derived runtime continuity currently lives under:
- `.codex/runtime/coo-operating-state.json`
- `.codex/runtime/coo-live-status-window.json`

These files are:
- regenerable
- derived
- secondary to stronger evidence
- not a second canonical company database

Tracked COO issues inside the operating state now also carry:
- a prepared handoff id
- a task summary
- implicated subjects
- an evidence digest

This keeps the COO ready to move directly into implement-plan after approval without reopening the same investigation after a crash or restart.

## Open Constraint
- This slice does not widen into autonomous execution launch.
- The COO may investigate, classify, track, and prepare.
- The CEO still controls launch into major downstream execution.
