1. Objective Completed

Implemented the launcher/bootstrap split between explicit install/bootstrap repair and fast runtime preflight, added a machine-readable runtime-preflight helper for agent awareness, updated bootstrap docs to require that preflight first, and added proof/test artifacts for the new route.

2. Deliverables Produced

- Fast runtime-preflight route in [adf.sh](/C:/ADF/adf.sh) via [agent-runtime-preflight.mjs](/C:/ADF/tools/agent-runtime-preflight.mjs)
- Explicit install/bootstrap route in [adf.sh](/C:/ADF/adf.sh)
- Runtime/install state recording at `.codex/runtime/install-state.json` on successful install route execution
- Updated bootstrap docs in [AGENTS.md](/C:/ADF/AGENTS.md), [cli-agent.md](/C:/ADF/docs/bootstrap/cli-agent.md), [vscode-agent.md](/C:/ADF/docs/bootstrap/vscode-agent.md), and [architecture.md](/C:/ADF/docs/v0/architecture.md)
- Direct assertion test script in [agent-runtime-preflight.test.mjs](/C:/ADF/tools/agent-runtime-preflight.test.mjs)
- Manual proof runner in [run-proof-sequence.sh](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/run-proof-sequence.sh)

3. Files Changed And Why

- [adf.sh](/C:/ADF/adf.sh): added `--runtime-preflight`, `--install`, mode exclusivity, install-state writing, and switched normal launch to the fast runtime gate.
- [agent-runtime-preflight.mjs](/C:/ADF/tools/agent-runtime-preflight.mjs): added the structured runtime detection/reporting helper used by launcher preflight and agent bootstrap.
- [agent-runtime-preflight.test.mjs](/C:/ADF/tools/agent-runtime-preflight.test.mjs): added direct runnable assertions for the helper.
- [AGENTS.md](/C:/ADF/AGENTS.md), [cli-agent.md](/C:/ADF/docs/bootstrap/cli-agent.md), [vscode-agent.md](/C:/ADF/docs/bootstrap/vscode-agent.md), and [architecture.md](/C:/ADF/docs/v0/architecture.md): updated the bootstrap/runtime contract so agents must run preflight first.
- [run-proof-sequence.sh](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/run-proof-sequence.sh): added a live proof route for a real VS Code bash terminal.

4. Verification Evidence

- `node --check tools/agent-runtime-preflight.mjs`
- `node --check tools/agent-runtime-preflight.test.mjs`
- `node tools/agent-runtime-preflight.test.mjs`
- `node tools/agent-runtime-preflight.mjs --repo-root C:/ADF --launch-mode tsx-direct --json`

The direct CLI smoke above was intentionally run in the current non-compliant PowerShell-backed host and returned a structured failing JSON report instead of crashing. Live positive bash-route proof was not run from this session; that proof is deferred to [run-proof-sequence.sh](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/run-proof-sequence.sh) in a real VS Code bash terminal.

5. Feature Artifacts Updated

- [README.md](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/README.md)
- [context.md](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/context.md)
- [implement-plan-contract.md](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/implement-plan-contract.md)
- [implement-plan-brief.md](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/implement-plan-brief.md)
- [implement-plan-state.json](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/implement-plan-state.json)
- [completion-summary.md](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/completion-summary.md)
- [run-proof-sequence.sh](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/run-proof-sequence.sh)

6. Commit And Push Result

- Commit: pending
- Push: pending

7. Remaining Non-Goals / Debt

- Live positive proof for the supported bash route still needs to be executed from a real VS Code bash terminal with [run-proof-sequence.sh](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/run-proof-sequence.sh).
- Review-cycle still needs to audit the claimed route and either close the stream or surface additional route-level defects.
