1. Findings

- failure class: Runtime-preflight schema omits truthful control-plane or execution-shell reporting.
  - broken route invariant in one sentence: Agents are required to use runtime-preflight as authority for shell behavior, but the JSON route does not expose a field that truthfully distinguishes the workflow shell from the control-plane shell that constructed the command.
  - exact route (A -> B -> C): Agent bootstrap -> `--runtime-preflight --json` -> shell/quoting decision for subsequent workflow commands.
  - exact file/line references: [agent-runtime-preflight.mjs](/C:/ADF/tools/agent-runtime-preflight.mjs#L353), [agent-runtime-preflight.mjs](/C:/ADF/tools/agent-runtime-preflight.mjs#L368), [cli-agent.md](/C:/ADF/docs/bootstrap/cli-agent.md#L29).
  - concrete operational impact: A Windows-hosted agent can still confuse a PowerShell-backed control plane with a real bash execution lane and construct fragile `bash -lc` command strings even after running the mandated preflight.
  - sweep scope: [AGENTS.md](/C:/ADF/AGENTS.md), [cli-agent.md](/C:/ADF/docs/bootstrap/cli-agent.md), [vscode-agent.md](/C:/ADF/docs/bootstrap/vscode-agent.md), [agent-runtime-preflight.test.mjs](/C:/ADF/tools/agent-runtime-preflight.test.mjs), [run-proof-sequence.sh](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/run-proof-sequence.sh).
  - closure proof: Runtime-preflight JSON must include a truthful control-plane or execution-shell field, bootstrap docs must consume it, and the test/proof route must show the field on both direct-bash and Windows-trampoline invocations.
  - shared-surface expansion risk: none.
  - negative proof required: Windows-trampoline proof must show the control plane is not misreported as a direct bash entrypoint.
  - live/proof isolation risk: none.
  - claimed-route vs proved-route mismatch risk: present because the route contract and docs speak about execution-shell awareness, but the implemented JSON schema does not.
  - status: live defect.

- failure class: Runtime-preflight schema omits Brain MCP availability or health reporting promised by the feature contract.
  - broken route invariant in one sentence: Agents are supposed to use runtime-preflight as startup authority, but the JSON route does not tell them whether the ADF Brain route is available, blocked, or only health-verifiable through doctor.
  - exact route (A -> B -> C): Agent bootstrap -> `--runtime-preflight --json` -> decision to continue, install, or doctor for Brain-aware work.
  - exact file/line references: [README.md](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/README.md#L22), [context.md](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/context.md#L30), [agent-runtime-preflight.mjs](/C:/ADF/tools/agent-runtime-preflight.mjs#L221), [agent-runtime-preflight.mjs](/C:/ADF/tools/agent-runtime-preflight.mjs#L389).
  - concrete operational impact: An agent can leave preflight without any machine-readable Brain readiness signal and either continue into Brain-dependent work blindly or escalate straight to doctor without knowing whether the route is merely unverified or actually blocked.
  - sweep scope: [adf.sh](/C:/ADF/adf.sh), [agent-runtime-preflight.mjs](/C:/ADF/tools/agent-runtime-preflight.mjs), [agent-runtime-preflight.test.mjs](/C:/ADF/tools/agent-runtime-preflight.test.mjs), [cli-agent.md](/C:/ADF/docs/bootstrap/cli-agent.md), [vscode-agent.md](/C:/ADF/docs/bootstrap/vscode-agent.md), [run-proof-sequence.sh](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/run-proof-sequence.sh).
  - closure proof: Runtime-preflight JSON must expose Brain MCP availability or verification status, docs must explain the distinction between availability and full doctor verification, and proof/test artifacts must show the field in the supported route.
  - shared-surface expansion risk: none.
  - negative proof required: When Brain smoke artifacts are missing or not yet verified, runtime-preflight must report the blocked or unverified state instead of implying full health.
  - live/proof isolation risk: none.
  - claimed-route vs proved-route mismatch risk: present because the feature contract explicitly promised Brain MCP availability or health in runtime-preflight output, but the current route proves only dependency and artifact checks.
  - status: live defect.

2. Conceptual Root Cause

- The implementation froze launcher/install split behavior but did not carry the full runtime-awareness contract into the machine-readable schema. The docs and feature contract were written around agent decision-making, but the helper implementation stopped at bash and artifact checks without encoding the remaining decision-critical dimensions.
- The route was treated partly as a launcher health check instead of as the authoritative agent bootstrap contract. That left control-plane shell truth and Brain route truth in prose and expectations instead of in the JSON schema the agents are told to trust.

3. High-Level View Of System Routes That Still Need Work

- Runtime bootstrap contract route.
  - what must be frozen before implementation: the JSON schema fields that agents may treat as authoritative for shell/control-plane interpretation and Brain readiness.
  - why endpoint-only fixes will fail: patching docs alone leaves the machine-readable route incomplete, and patching only the helper without updating proof/docs leaves the bootstrap contract ambiguous.
  - the minimal layers that must change to close the route: [agent-runtime-preflight.mjs](/C:/ADF/tools/agent-runtime-preflight.mjs), [agent-runtime-preflight.test.mjs](/C:/ADF/tools/agent-runtime-preflight.test.mjs), [AGENTS.md](/C:/ADF/AGENTS.md), [cli-agent.md](/C:/ADF/docs/bootstrap/cli-agent.md), [vscode-agent.md](/C:/ADF/docs/bootstrap/vscode-agent.md), and [run-proof-sequence.sh](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/run-proof-sequence.sh).
  - explicit non-goals, so scope does not widen into general refactoring: no Brain transport redesign, no new fallback transport, no launcher rewrite beyond exposing truthful runtime-preflight contract fields.
  - what done looks like operationally: an agent can run runtime-preflight once and get a truthful JSON answer for host OS, bash workflow shell, control-plane context, path/quoting guidance, and Brain route availability or verification status, with tests and proof showing that same route on supported bash and Windows-trampoline invocations.
