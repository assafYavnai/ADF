1. Failure Classes Closed

- Runtime-preflight JSON now reports explicit control-plane entrypoint truth and execution-shell truth instead of leaving agents to infer shell context from partial hints.
- Runtime-preflight JSON now reports Brain MCP route availability versus doctor-level verification state instead of omitting Brain route truth entirely.

2. Route Contracts Now Enforced

- Runtime-preflight remains the fast bootstrap route, but it now encodes the control-plane or entrypoint context that invoked it:
  - `execution_shell`
  - `control_plane.kind`
  - `control_plane.entrypoint`
- Runtime-preflight now distinguishes Brain route availability from full verification:
  - `brain_mcp.availability_status`
  - `brain_mcp.verification_status`
  - `brain_mcp.verification_command`
- Bootstrap docs now instruct agents to treat those fields as authoritative and to reserve `--doctor` for full bash + Brain verification rather than assuming runtime-preflight already proved Brain health.

3. Files Changed And Why

- [agent-runtime-preflight.mjs](/C:/ADF/tools/agent-runtime-preflight.mjs): added control-plane or entrypoint fields, execution-shell reporting, Brain MCP availability or verification reporting, and matching human checks.
- [agent-runtime-preflight.test.mjs](/C:/ADF/tools/agent-runtime-preflight.test.mjs): added assertions for direct-bash and Windows-trampoline control-plane truth plus Brain MCP route status.
- [adf.sh](/C:/ADF/adf.sh): now stamps direct-bash runtime-preflight invocations with explicit control-plane markers.
- [adf.cmd](/C:/ADF/adf.cmd), [adf-launcher.ps1](/C:/ADF/tools/adf-launcher.ps1), [adf-launcher.mjs](/C:/ADF/tools/adf-launcher.mjs): now stamp trampoline invocations with truthful control-plane markers before entering `adf.sh`.
- [AGENTS.md](/C:/ADF/AGENTS.md), [cli-agent.md](/C:/ADF/docs/bootstrap/cli-agent.md), [vscode-agent.md](/C:/ADF/docs/bootstrap/vscode-agent.md): now list the strengthened authoritative runtime-preflight fields and the distinction between Brain availability and full doctor verification.
- [run-proof-sequence.sh](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/run-proof-sequence.sh): updated its contract text to call out the strengthened JSON proof expectations.
- [completion-summary.md](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/completion-summary.md), [implement-plan-state.json](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/implement-plan-state.json): corrected closeout truth and recorded the strengthened schema work.

4. Sibling Sites Checked

- [adf.sh](/C:/ADF/adf.sh)
- [adf.cmd](/C:/ADF/adf.cmd)
- [adf-launcher.ps1](/C:/ADF/tools/adf-launcher.ps1)
- [adf-launcher.mjs](/C:/ADF/tools/adf-launcher.mjs)
- [AGENTS.md](/C:/ADF/AGENTS.md)
- [cli-agent.md](/C:/ADF/docs/bootstrap/cli-agent.md)
- [vscode-agent.md](/C:/ADF/docs/bootstrap/vscode-agent.md)
- [run-proof-sequence.sh](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/run-proof-sequence.sh)

5. Proof Of Closure

- `node --check C:\ADF\tools\agent-runtime-preflight.mjs`
- `node --check C:\ADF\tools\agent-runtime-preflight.test.mjs`
- `node C:\ADF\tools\agent-runtime-preflight.test.mjs`
  - result: `agent-runtime-preflight tests passed`
- `node C:\ADF\tools\agent-runtime-preflight.mjs --repo-root C:/ADF --launch-mode tsx-direct --json`
  - result: runtime-preflight now emits `execution_shell`, `control_plane.*`, and `brain_mcp.*` even when the current host remains non-compliant
  - result: the direct helper invocation is now truthfully reported as `direct-helper-invocation` / `implicit-shell-context` instead of being mislabeled as `adf.sh` / `direct-bash`
- Negative proof covered in tests:
  - Windows-trampoline fixture reports `control_plane.kind=windows-cmd-trampoline`
  - Brain route can be `blocked` when required artifacts are absent

Live proof still required for full route closure:

- Run [run-proof-sequence.sh](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/run-proof-sequence.sh) from a real VS Code bash terminal and capture the proof bundle for:
  - authoritative bash runtime-preflight JSON
  - Windows trampoline runtime-preflight JSON
  - explicit install route
  - optional doctor route

6. Remaining Debt / Non-Goals

- Remaining open route work: live proof for the strengthened runtime-preflight JSON on a real VS Code bash terminal is still pending from outside this PowerShell-backed session.
- Non-goals intentionally preserved:
  - no Brain transport redesign
  - no fallback around bash or MCP
  - no package auto-upgrade policy change

7. Next Cycle Starting Point

- Execute [run-proof-sequence.sh](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/run-proof-sequence.sh) from a real VS Code bash terminal, persist the proof bundle under this feature root, then rerun reviewer closeout on that bundle.
