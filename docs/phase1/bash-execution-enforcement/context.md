# Context

## Stream

- Phase: `1`
- Feature slug: `bash-execution-enforcement`
- Branch: `main`
- Active cycle: `cycle-01`

## Normalized Route Contract

- Claimed supported route: `Windows wrapper or POSIX shell entry -> bash launcher -> bounded doctor repairs -> Brain MCP smoke -> Brain audit write -> COO runtime entry`
- Failure classes to close in this stream:
  - launcher routes that claim bash authority but still execute workflow logic outside bash
  - doctor flows that claim fail-closed Brain enforcement but do not actually require a working bash runtime, a working Brain MCP route, and a truthful audit write
  - wrapper/proof ambiguity where Windows launch or doctor paths can appear compliant without proving the real bash-controlled route
  - documentation or bootstrap claims that do not match the actually enforced launcher route
- End-to-end invariants:
  - `adf.sh` is the authoritative ADF workflow entrypoint
  - `adf.cmd`, PowerShell, and Node wrappers are trampolines into `bash adf.sh ...` only
  - if bash is missing or broken, launch and doctor hard-stop rather than substitute another workflow shell
  - doctor may repair bounded prerequisites but must end with working bash, working Brain MCP, and a Brain audit write or stop with a durable incident report
  - claimed supported route, mutated route, and proved route must match
- Allowed mutation surfaces:
  - launcher wrappers and shared launcher helpers
  - doctor smoke/audit helpers
  - bootstrap and architecture docs
  - review-cycle artifacts for this stream
- Forbidden shared-surface expansion:
  - no hidden fallback transport around Brain MCP
  - no alternative workflow shell that can execute ADF business logic outside bash
  - no docs claim that a shell or route is supported without runnable proof
- Docs in scope:
  - `docs/bootstrap/cli-agent.md`
  - `docs/v0/architecture.md`
  - `docs/v0/context/2026-04-03-bash-execution-enforcement-plan.md`
  - `docs/v0/context/2026-04-03-bash-execution-enforcement-test-plan.md`
- Non-goals:
  - fixing the host/runtime bridge defect that prevents this Codex session from launching bash
  - redesigning Brain transport beyond enforcing the current MCP route
  - general shell abstraction work outside the launcher/doctor contract

## Current Implementation State

- The implementation under review is primarily in:
  - `adf.sh`
  - `adf.cmd`
  - `tools/adf-launcher.ps1`
  - `tools/adf-launcher.mjs`
  - `tools/doctor-brain-audit.mjs`
  - `tools/doctor-brain-connect-smoke.mjs`
  - `docs/bootstrap/cli-agent.md`
  - `docs/v0/architecture.md`
- The main implementation commit is `71bf4f5` (`Enforce bash-only ADF launch contract`).
- The stream should treat those files as evidence, not as the entire route scope.

## Proof Pack Already Present

- Bash enforcement plan:
  - `docs/v0/context/2026-04-03-bash-execution-enforcement-plan.md`
- Bash enforcement test plan:
  - `docs/v0/context/2026-04-03-bash-execution-enforcement-test-plan.md`
- Doctor incident proof of fail-closed behavior in this host:
  - `memory/doctor-incidents/20260403-105714-doctor-mcp-incident-2a76f895.json`

## Verification Already Run

- `node --check tools/doctor-brain-audit.mjs`
- `node --check tools/doctor-brain-connect-smoke.mjs`
- `node --check tools/adf-launcher.mjs`
- `adf.cmd --help`
- `powershell -ExecutionPolicy Bypass -File tools/adf-launcher.ps1 --help`
- `node tools/adf-launcher.mjs --help`

## Review Focus

- Determine whether the authoritative workflow route is genuinely owned by `adf.sh` rather than only documented that way.
- Check whether all wrapper entrypoints enforce bash rather than carrying duplicate business logic.
- Check whether doctor is fail-closed on both bash health and Brain MCP health, with no hidden fallback.
- Reject closure if:
  - any wrapper still runs ADF workflow logic outside bash
  - doctor can succeed without a real bash route, Brain MCP smoke, and Brain audit write
  - proof only covers a broken host bridge and not the claimed supported route
  - docs overclaim support that the current route does not actually enforce

## Environment Note

- The ADF bootstrap requires Brain context load through `project-brain` MCP, but this Codex runtime does not expose that MCP surface.
- The host bridge for this session also cannot launch the configured MSYS bash successfully (`couldn't create signal pipe, Win32 error 5`), so positive bash-route proof must be reasoned from code and any repo-carried artifacts, while negative fail-closed behavior can be observed directly here.
