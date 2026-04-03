1. Closure Verdicts
- failure class: default launch scope still points at the legacy shippingagent project
  Open
  enforced route invariant: default launcher scope must match the ADF project scope across every live launch mode.
  evidence shown: `adf.sh` still sets `DEFAULT_SCOPE=\"assafyavnai/shippingagent\"` and forwards it into tsx, watch, and built launch modes.
  missing proof: source and help output showing the default scope is `assafyavnai/adf` in every launcher path.
  sibling sites still uncovered: all help/launch sites derived from `DEFAULT_SCOPE`.
  whether broader shared power was introduced and whether that was justified: no broader shared power was introduced.
  whether negative proof exists where required: not applicable.
  whether live-route vs proof-route isolation is shown: no, because the launcher route still points at the wrong default scope.
  claimed supported route / route mutated / route proved: claimed `ADF launcher -> ADF scope`; mutated `ADF launcher -> shippingagent scope`; proved static source mismatch.
  whether the patch is route-complete or endpoint-only: endpoint-only. The bash-only shell enforcement did not close the full launcher contract.
- failure class: supported-route proof is still missing for the real bash launch path
  Open
  enforced route invariant: the claimed supported route must be proved from a real VS Code bash terminal, not only reasoned from code or inferred from a failure path.
  evidence shown: the test plan names the required positive proof, and the only committed runtime evidence in this stream is a blocked doctor incident from a non-working host bridge.
  missing proof: committed positive proof for `echo $0`, `bash --version`, `./adf.sh --help`, and a successful doctor or launch route under the supported bash terminal.
  sibling sites still uncovered: `./adf.sh` positive route, `adf.cmd` trampoline proof, and successful doctor Brain-audit proof.
  whether broader shared power was introduced and whether that was justified: no broader shared power was introduced.
  whether negative proof exists where required: partial. Broken-bash and broken-MCP behavior is documented, but the positive route is still absent.
  whether live-route vs proof-route isolation is shown: partial. Fail-closed behavior is shown, but the live supported route is not.
  claimed supported route / route mutated / route proved: claimed `VS Code bash terminal -> bash launcher`; mutated route appears consistent in code; proved route is only the negative fail-closed path from this host bridge.
  whether the patch is route-complete or endpoint-only: not route-complete.

2. Remaining Root Cause
- The route contract was not normalized all the way through launch defaults and proof obligations. One legacy scope default survived in the authoritative launcher, and the supported positive bash route still lacks concrete closure evidence.

3. Next Minimal Fix Pass
- Fix the authoritative default scope in `adf.sh` so every launch mode defaults to `assafyavnai/adf`, then verify the help text and forwarded COO args stay aligned.
- After that, run the supported VS Code bash terminal proof from a real bash host and persist the resulting evidence. Without that proof, the stream stays open even if the code fix is applied.
