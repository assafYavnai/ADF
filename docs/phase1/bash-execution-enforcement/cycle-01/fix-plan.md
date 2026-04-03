1. Failure Classes

- Windows trampolines trust `SHELL` too broadly and can treat non-approved executables as launcher candidates.
- On Windows bash hosts, `adf.sh` can silently fall back from `npm.cmd` / `npx.cmd` to generic `npm` / `npx`.

2. Route Contracts

- Claimed supported route: `Windows launcher trampoline -> approved MSYS2 or Git Bash runtime -> adf.sh -> bounded preflight or doctor -> COO or Brain MCP`.
- End-to-end invariants:
  - Windows trampolines accept only approved bash runtimes.
  - `SHELL` is only a candidate hint, never authority.
  - On Windows bash hosts, package-manager resolution fails closed unless `npm.cmd` and `npx.cmd` are available.
  - Existing fail-closed behavior on broken bash and broken MCP stays intact.
- Allowed mutation surfaces:
  - `adf.cmd`
  - `tools/adf-launcher.ps1`
  - `tools/adf-launcher.mjs`
  - `adf.sh`
  - bootstrap and plan/test docs only where the enforced contract changes materially
- Forbidden shared-surface expansion:
  - no new launcher runtime
  - no MCP fallback
  - no host-bridge redesign
  - no general refactor of COO launch behavior
- Docs to update:
  - `docs/bootstrap/cli-agent.md`
  - `docs/v0/context/2026-04-03-bash-execution-enforcement-test-plan.md`

3. Sweep Scope

- Windows candidate resolution in:
  - `adf.cmd`
  - `tools/adf-launcher.ps1`
  - `tools/adf-launcher.mjs`
- Windows package-manager resolution in:
  - `adf.sh`
- Proof and contract artifacts in:
  - `docs/phase1/bash-execution-enforcement/context.md`
  - `docs/phase1/bash-execution-enforcement/cycle-01/*`

4. Planned Changes

- Add approved-bash candidate filtering to every Windows trampoline so only MSYS2 or Git Bash `bash.exe` paths are accepted.
- Make Windows package-manager resolution in `adf.sh` require `npm.cmd` and `npx.cmd`.
- Add the smallest truthful repo/runtime proof showing:
  - non-bash `SHELL` is ignored
  - Windows package-manager fallback is removed in source
- Do not broaden launcher power or add new shell-selection inputs.

5. Closure Proof

- Static/source proof:
  - show every Windows trampoline filters candidates to approved `bash.exe` paths only
  - show `adf.sh` fails closed when `npm.cmd` / `npx.cmd` are unavailable on Windows
- Runtime proof available in this host:
  - run a wrapper with `SHELL` forced to PowerShell and show it still resolves only approved bash paths
  - run wrapper/help checks and capture the resulting fail-closed output from the broken bash host
- Negative proof:
  - confirm the wrapper does not treat `SHELL` as authority when it points at PowerShell
  - confirm no generic `npm` / `npx` fallback remains on Windows
- Live/proof isolation check:
  - call out that positive bash-route proof is still blocked by the external host bridge and remains open after this cycle

6. Non-Goals

- Fixing the external host bridge that cannot launch bash in this Codex session
- Changing the default ADF scope again in this fix pass
- Redesigning doctor, Brain transport, or COO launch architecture beyond the two reported failure classes
