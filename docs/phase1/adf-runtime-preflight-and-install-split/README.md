# adf-runtime-preflight-and-install-split

## Implementation Objective

Implement a production-grade ADF startup split between explicit install/bootstrap repair and fast runtime preflight, with mandatory agent runtime detection and review-cycle closeout.

## Requested Scope

Authoritative slice root:
Treat docs/phase1/adf-runtime-preflight-and-install-split/ as the authoritative slice root for this work.
If the slice already exists there, treat its saved contract, brief, state, and prior implementation/review artifacts as the authoritative continuity source.
Do not fork a parallel slice unless integrity requires it and you explain exactly why.

Scope hint:
Implement a bounded ADF launcher/bootstrap slice that adds a mandatory runtime preflight contract for agents and splits explicit install/healing from fast runtime startup checks.

Current problem evidence:
- Agents can misread the actual runtime and issue commands with the wrong shell quoting model.
- Normal ADF launch currently pays deep dependency/build checks that belong to install or doctor, not to every runtime start.
- VS Code integrated agents do not currently get a production-grade first-run runtime fact report, so they can confuse Windows host state, bash terminal state, and PowerShell-backed execution.

Target behavior:
- ADF exposes a fast runtime preflight route that reports machine-readable truth about host OS, execution shell, bash health, command construction mode, approved bash runtime, path style, launcher guidance, and Brain MCP availability/health.
- ADF exposes an explicit install/bootstrap route for slower dependency/build/setup repair work.
- Normal launch uses only the fast runtime gate plus cheap artifact existence checks, not repeated install/build freshness scans.
- AGENTS/bootstrap docs require agents to run the runtime preflight first and use its output as authority before issuing workflow commands.
- On Windows, the resulting guidance must make agents aware of Windows host semantics while still enforcing bash as the ADF workflow shell.

Required deliverables:
- launcher/runtime changes under adf.sh/adf.cmd/tools as needed
- a machine-readable runtime-preflight route, preferably JSON-capable
- an explicit install/bootstrap route separated from normal runtime launch
- updated AGENTS/bootstrap docs for CLI and VS Code agents
- tests or proof scripts covering runtime-preflight output and the install-vs-runtime split
- review-cycle handoff and closure proof

Acceptance gates:
1. ADF startup has a distinct explicit install/bootstrap path and a distinct fast runtime-preflight path.
2. Normal runtime launch no longer performs deep install/build freshness checks on every invocation.
3. Runtime preflight emits enough structured truth for agents to choose the right shell/quoting/path behavior without guessing.
4. Windows host plus bash-shell enforcement remains truthful and fail-closed.
5. Missing or broken bash still blocks launch.
6. Doctor remains bounded repair plus fail-closed, not silent fallback.
7. AGENTS/bootstrap docs make the mandatory preflight route explicit for both CLI and VS Code integrated agents.
8. Tests or proof artifacts cover the supported runtime-preflight route and the install/runtime split.
9. Implementation is committed, pushed, and sent to review-cycle with until_complete=true.

Allowed edits:
- adf.sh
- adf.cmd
- tools/adf-launcher.* helpers if still needed as trampolines
- new runtime preflight helper(s) or install-state helper(s)
- docs/bootstrap/*
- AGENTS.md
- docs/v0/architecture.md and tightly related context/test-plan docs if materially affected
- targeted tests or proof runners under docs/phase1/<feature>/ or tests/

Forbidden edits:
- do not redesign Brain transport
- do not add silent fallback away from required bash or MCP contracts
- do not introduce package auto-upgrade on startup
- do not widen this into generic package-management or global COO behavior refactoring
- do not weaken the bash-only ADF shell contract

Observability / audit:
- runtime preflight should truthfully show the detected execution environment and blocking reasons
- install/bootstrap and doctor routes should remain distinguishable from normal runtime preflight
- claimed route and proved route must match in review-cycle artifacts

## Non-Goals

- no Brain transport redesign
- no automatic package version upgrades on load
- no replacing bash with PowerShell or Python as the ADF workflow shell
- no unrelated COO product behavior changes

## Artifact Map

- context.md
- implement-plan-state.json
- implement-plan-contract.md
- implement-plan-pushback.md
- implement-plan-brief.md
- implementation-run/
- completion-summary.md

## Lifecycle

- active
- blocked
- completed
- closed
