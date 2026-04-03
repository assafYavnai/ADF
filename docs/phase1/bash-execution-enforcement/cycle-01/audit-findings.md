1. Findings
- failure class: default launch scope still points at the legacy shippingagent project
  broken route invariant in one sentence: the authoritative ADF launcher claims the ADF bash route but still defaults live COO launches into `assafyavnai/shippingagent` instead of `assafyavnai/adf`.
  exact route (A -> B -> C): `adf.cmd` or `adf.sh` -> `launch_coo` -> COO `--scope`
  exact file/line references: `adf.sh:14`, `adf.sh:58`, `adf.sh:115`, `adf.sh:699`, `adf.sh:703`, `adf.sh:707`, `docs/bootstrap/cli-agent.md:37-49`, `docs/bootstrap/cli-agent.md:79-80`, `docs/v0/architecture.md:41-47`
  concrete operational impact: a default launch can still attach thread and Brain traffic to the wrong project scope, which breaks the claimed ADF route contract and can misfile durable memory and telemetry.
  sweep scope: every launcher path and doc claim that derives or displays the default project scope, including help text and built/watch launch modes.
  closure proof: show the default scope is `assafyavnai/adf` in the launcher source and help text, and verify every live launch mode forwards that scope unless the user overrides it.
  shared-surface expansion risk: none.
  negative proof required: show no other launcher path still carries the shippingagent default unless explicitly passed by the user.
  live/proof isolation risk: none.
  claimed-route vs proved-route mismatch risk: present, because the docs and Brain conventions claim ADF scope while the live default route still targets shippingagent.
  status: live defect.
- failure class: supported-route proof is still missing for the real bash launch path
  broken route invariant in one sentence: the implementation claims a bash-only launcher contract, but no concrete proof artifact shows the supported VS Code bash route succeeding end to end.
  exact route (A -> B -> C): supported VS Code bash terminal -> `./adf.sh` or `adf.cmd` -> bash-controlled doctor or COO launch
  exact file/line references: `docs/v0/context/2026-04-03-bash-execution-enforcement-test-plan.md:25-35`, `docs/v0/context/2026-04-03-bash-execution-enforcement-test-plan.md:37-88`, `docs/phase1/bash-execution-enforcement/context.md:46-54`, `memory/doctor-incidents/20260403-105714-doctor-mcp-incident-2a76f895.json`
  concrete operational impact: the route is only partially proved. Negative fail-closed behavior is observed here, but the supported positive path remains unproved, so closure would overclaim real operator readiness.
  sweep scope: supported VS Code bash terminal proof, `./adf.sh --help`, one real launch path, and one successful doctor path with Brain audit evidence.
  closure proof: capture and persist proof from a real VS Code bash terminal showing `echo $0`, `bash --version`, `./adf.sh --help`, and a successful doctor or launch route under bash.
  shared-surface expansion risk: none.
  negative proof required: keep the existing broken-bash and broken-MCP fail-closed evidence alongside the positive proof.
  live/proof isolation risk: present, because the current observed evidence comes from a host bridge where bash cannot start, not from the claimed supported route.
  claimed-route vs proved-route mismatch risk: present, because the claimed supported route is a real VS Code bash terminal while the proved route is only the negative fail-closed path from a PowerShell-backed bridge.
  status: policy edge case.

2. Conceptual Root Cause
- The launcher contract was tightened at the wrapper and documentation level, but one inherited live-route default from the older shippingagent scope remained in the authoritative bash script.
- The implementation also froze a test plan without completing the required positive-route proof collection, so closure evidence is still narrower than the claimed supported route.

3. High-Level View Of System Routes That Still Need Work
- Route: default launcher scope alignment
  what must be frozen before implementation: `adf.sh` must default live launches to the ADF project scope everywhere the launcher derives, displays, or forwards its default.
  why endpoint-only fixes will fail: changing only the help text or only one launch mode would still leave another path silently targeting shippingagent.
  the minimal layers that must change to close the route: the authoritative default-scope constant and any directly derived help/launch text.
  explicit non-goals, so scope does not widen into general refactoring: no redesign of COO scope parsing or Brain scope semantics.
  what done looks like operationally: every launcher mode defaults to `assafyavnai/adf` unless the user passes `--scope`.
- Route: supported bash-route proof completion
  what must be frozen before implementation: the exact supported operator path must remain `VS Code bash terminal -> bash launcher -> doctor or COO`.
  why endpoint-only fixes will fail: static code edits alone cannot close a route that still lacks runtime proof from the claimed shell environment.
  the minimal layers that must change to close the route: proof artifacts and, if needed, the smallest launcher corrections discovered while running the supported path.
  explicit non-goals, so scope does not widen into general refactoring: no host-bridge redesign inside this repo.
  what done looks like operationally: a committed proof pack shows the supported bash route works, and the existing negative proofs still show fail-closed behavior when bash or MCP is broken.
