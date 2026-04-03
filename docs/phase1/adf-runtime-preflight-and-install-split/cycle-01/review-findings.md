1. Closure Verdicts

- Runtime-preflight control-plane or execution-shell truth: Open
  - enforced route invariant: Not yet enforced.
  - evidence shown: [agent-runtime-preflight.mjs](/C:/ADF/tools/agent-runtime-preflight.mjs#L353) exposes `workflow_shell` and `terminal_shell_hint`, but no field that truthfully reports the control-plane or execution-shell context agents need for quoting decisions.
  - missing proof: No JSON evidence or proof-run artifact shows a control-plane-aware field on direct-bash versus Windows-trampoline invocations.
  - sibling sites still uncovered: [AGENTS.md](/C:/ADF/AGENTS.md), [cli-agent.md](/C:/ADF/docs/bootstrap/cli-agent.md), [vscode-agent.md](/C:/ADF/docs/bootstrap/vscode-agent.md), [agent-runtime-preflight.test.mjs](/C:/ADF/tools/agent-runtime-preflight.test.mjs), [run-proof-sequence.sh](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/run-proof-sequence.sh).
  - whether broader shared power was introduced and whether that was justified: none.
  - whether negative proof exists where required: no.
  - whether live-route vs proof-route isolation is shown: no.
  - claimed supported route / route mutated / route proved: claimed route is agent bootstrap using runtime-preflight as authority; mutated route is launcher plus JSON helper; proved route currently stops at artifact/bash truth and does not cover control-plane shell truth.
  - whether the patch is route-complete or endpoint-only: endpoint-only for shell-awareness.

- Runtime-preflight Brain MCP availability or health truth: Open
  - enforced route invariant: Not yet enforced.
  - evidence shown: the feature contract promises Brain MCP availability or health in runtime-preflight, but [agent-runtime-preflight.mjs](/C:/ADF/tools/agent-runtime-preflight.mjs#L221) only emits artifact and PostgreSQL checks, and [agent-runtime-preflight.mjs](/C:/ADF/tools/agent-runtime-preflight.mjs#L389) has no Brain route object or check.
  - missing proof: No JSON field or proof-run log shows whether Brain is available, blocked, or merely unverified pending doctor.
  - sibling sites still uncovered: [adf.sh](/C:/ADF/adf.sh), [cli-agent.md](/C:/ADF/docs/bootstrap/cli-agent.md), [vscode-agent.md](/C:/ADF/docs/bootstrap/vscode-agent.md), [run-proof-sequence.sh](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/run-proof-sequence.sh), [agent-runtime-preflight.test.mjs](/C:/ADF/tools/agent-runtime-preflight.test.mjs).
  - whether broader shared power was introduced and whether that was justified: none.
  - whether negative proof exists where required: no.
  - whether live-route vs proof-route isolation is shown: yes for doctor versus runtime-preflight separation at a high level, but not in the JSON schema or proof.
  - claimed supported route / route mutated / route proved: claimed route is runtime-preflight as the agent bootstrap authority; mutated route is the helper plus docs; proved route currently omits Brain route truth.
  - whether the patch is route-complete or endpoint-only: partial.

2. Remaining Root Cause

- The machine-readable bootstrap contract is still thinner than the prose contract. The helper implementation has not yet encoded all of the decision-critical route truth that the docs tell agents to trust.

3. Next Minimal Fix Pass

- Add control-plane or execution-shell truth to runtime-preflight.
  - what still breaks: agents cannot tell from JSON whether they are on a direct bash route or a Windows trampoline/control-plane path.
  - what minimal additional layers must change: [agent-runtime-preflight.mjs](/C:/ADF/tools/agent-runtime-preflight.mjs), [agent-runtime-preflight.test.mjs](/C:/ADF/tools/agent-runtime-preflight.test.mjs), [cli-agent.md](/C:/ADF/docs/bootstrap/cli-agent.md), [vscode-agent.md](/C:/ADF/docs/bootstrap/vscode-agent.md), [run-proof-sequence.sh](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/run-proof-sequence.sh).
  - what proof is still required: test assertions and proof-run logs showing the new field on the direct bash route and the Windows trampoline route.

- Add Brain MCP availability or verification truth to runtime-preflight.
  - what still breaks: agents cannot tell from JSON whether Brain is available, blocked, or unverified pending doctor.
  - what minimal additional layers must change: [agent-runtime-preflight.mjs](/C:/ADF/tools/agent-runtime-preflight.mjs), [agent-runtime-preflight.test.mjs](/C:/ADF/tools/agent-runtime-preflight.test.mjs), [cli-agent.md](/C:/ADF/docs/bootstrap/cli-agent.md), [vscode-agent.md](/C:/ADF/docs/bootstrap/vscode-agent.md), [run-proof-sequence.sh](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/run-proof-sequence.sh).
  - what proof is still required: JSON output plus proof/test evidence showing Brain route availability status and its distinction from full doctor verification.
