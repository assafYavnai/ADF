1. Failure Classes

- Runtime-preflight JSON omits truthful control-plane or execution-shell reporting needed for agent shell decisions.
- Runtime-preflight JSON omits Brain MCP availability or verification state promised by the feature contract.

2. Route Contracts

- claimed supported route: Agent bootstrap -> `./adf.sh --runtime-preflight --json` or `adf.cmd --runtime-preflight --json` -> agent chooses shell/path/repair behavior from JSON -> agent continues or stops truthfully.
- end-to-end invariants:
  - runtime-preflight JSON must distinguish the canonical workflow shell from the control-plane or entrypoint context that invoked it.
  - runtime-preflight JSON must expose Brain route availability or verification state without pretending doctor-level health when doctor was not run.
  - CLI and VS Code bootstrap docs must list the authoritative fields that agents are expected to use.
  - proof and tests must show the same route that the docs claim.
- allowed mutation surfaces:
  - [agent-runtime-preflight.mjs](/C:/ADF/tools/agent-runtime-preflight.mjs)
  - [agent-runtime-preflight.test.mjs](/C:/ADF/tools/agent-runtime-preflight.test.mjs)
  - [run-proof-sequence.sh](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/run-proof-sequence.sh)
  - [AGENTS.md](/C:/ADF/AGENTS.md)
  - [cli-agent.md](/C:/ADF/docs/bootstrap/cli-agent.md)
  - [vscode-agent.md](/C:/ADF/docs/bootstrap/vscode-agent.md)
  - [completion-summary.md](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/completion-summary.md)
- forbidden shared-surface expansion:
  - no Brain transport redesign
  - no new fallback route around bash or MCP
  - no new generic launcher modes
  - no package-management redesign
- docs that must be updated:
  - [AGENTS.md](/C:/ADF/AGENTS.md)
  - [cli-agent.md](/C:/ADF/docs/bootstrap/cli-agent.md)
  - [vscode-agent.md](/C:/ADF/docs/bootstrap/vscode-agent.md)
  - [completion-summary.md](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/completion-summary.md)

3. Sweep Scope

- launcher bootstrap contract: [adf.sh](/C:/ADF/adf.sh)
- runtime-preflight schema and rendering: [agent-runtime-preflight.mjs](/C:/ADF/tools/agent-runtime-preflight.mjs)
- helper assertions: [agent-runtime-preflight.test.mjs](/C:/ADF/tools/agent-runtime-preflight.test.mjs)
- proof route: [run-proof-sequence.sh](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/run-proof-sequence.sh)
- bootstrap docs: [AGENTS.md](/C:/ADF/AGENTS.md), [cli-agent.md](/C:/ADF/docs/bootstrap/cli-agent.md), [vscode-agent.md](/C:/ADF/docs/bootstrap/vscode-agent.md)

4. Planned Changes

- Extend runtime-preflight JSON with explicit control-plane or invocation-entrypoint truth and Brain MCP availability or verification truth.
- Add checks and human rendering for the new schema surfaces.
- Update tests to assert the new fields and blocked-state behavior.
- Update proof runner to capture the strengthened JSON route, including doctor when requested.
- Update bootstrap docs to list the new authoritative fields and explain the difference between runtime-preflight Brain availability and full doctor verification.

5. Closure Proof

- Prove route: `--runtime-preflight --json` on the authoritative bash route and on the Windows trampoline route.
- Targeted checks:
  - `node --check tools/agent-runtime-preflight.mjs`
  - `node --check tools/agent-runtime-preflight.test.mjs`
  - `node tools/agent-runtime-preflight.test.mjs`
  - direct JSON smoke for the helper from the current runtime
- Negative proof required:
  - a non-direct-bash entrypoint must not be misreported as a direct bash route
  - runtime-preflight must report Brain as unavailable or unverified when only artifacts are present and doctor has not been run
- live/proof isolation checks:
  - runtime-preflight must report availability or verification state without silently turning into doctor
  - doctor remains the only route that claims full Brain verification

6. Non-Goals

- No redesign of doctor or Brain transport.
- No new package install policy.
- No change to the bash-only workflow-shell contract.
- No unrelated COO or review-cycle framework changes.
