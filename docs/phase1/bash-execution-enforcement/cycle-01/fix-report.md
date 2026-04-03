1. Failure Classes Closed

- Windows trampolines no longer treat `SHELL` as authority and now accept only approved `MSYS2` or `Git Bash` runtime candidates.
- `adf.sh` no longer falls back from `npm.cmd` / `npx.cmd` to generic `npm` / `npx` on Windows bash hosts.
- The authoritative launcher default scope now aligns with ADF by defaulting to `assafyavnai/adf`.

2. Route Contracts Now Enforced

- Windows launch trampolines (`adf.cmd`, `tools/adf-launcher.ps1`, `tools/adf-launcher.mjs`) now resolve bash through approved-runtime filtering only.
- A non-bash or unapproved `SHELL` value is only a candidate hint and cannot become the workflow shell.
- On Windows bash hosts, `adf.sh` now requires `npm.cmd` and `npx.cmd`; generic fallback is blocked.
- Live launcher defaults now target the ADF project scope unless the user explicitly overrides `--scope`.

3. Files Changed And Why

- `adf.cmd`: added approved-bash candidate filtering and fail-closed messaging for Windows trampoline selection.
- `tools/adf-launcher.ps1`: added approved-bash candidate filtering so the PowerShell trampoline cannot accept PowerShell or other non-approved executables as shell authority.
- `tools/adf-launcher.mjs`: added approved-bash candidate filtering for the Node trampoline.
- `adf.sh`: required `npm.cmd` / `npx.cmd` on Windows and aligned the default scope with `assafyavnai/adf`.
- `docs/bootstrap/cli-agent.md`: documented approved Windows bash runtimes and the fail-closed `npm.cmd` / `npx.cmd` requirement.
- `docs/v0/context/2026-04-03-bash-execution-enforcement-test-plan.md`: extended the test plan to cover approved-runtime filtering and Windows package-manager fail-closed proof.
- `docs/phase1/bash-execution-enforcement/cycle-01/verification-evidence.md`: captured the truthful repo/runtime proof available from this session.

4. Sibling Sites Checked

- Windows candidate resolution across all three trampolines:
  - `adf.cmd`
  - `tools/adf-launcher.ps1`
  - `tools/adf-launcher.mjs`
- Windows package-manager resolution in `adf.sh`
- Default scope wiring in `adf.sh` help and launch modes
- Bootstrap and test-plan docs that describe the enforced shell contract

5. Proof Of Closure

- Static/source proof:
  - `adf.cmd` filters `SHELL`, explicit paths, and `where bash.exe` results through `:is_approved_bash`.
  - `tools/adf-launcher.ps1` filters candidates through `Test-ApprovedBashCandidate`.
  - `tools/adf-launcher.mjs` filters candidates through `isApprovedBashPath`.
  - `adf.sh` sets `DEFAULT_SCOPE="assafyavnai/adf"` and requires `npm.cmd` / `npx.cmd` on Windows.
- Runtime proof from this session:
  - with `SHELL` forced to `powershell.exe`, `.\adf.cmd --help` refused to launch and required an approved bash runtime
  - with `SHELL` forced to `powershell.exe`, the PowerShell trampoline still selected the approved MSYS2 bash path and failed there, not on the fake candidate
  - with `SHELL` forced to `powershell.exe`, the Node trampoline still selected the approved MSYS2 bash path and failed there, not on the fake candidate
  - `node --check tools\adf-launcher.mjs` succeeded
- Live/proof isolation:
  - this cycle proves the negative fail-closed path from the current host bridge
  - the supported positive bash route remains a separate proof obligation and is not claimed closed here

6. Remaining Debt / Non-Goals

- Positive proof of the supported VS Code bash route is still missing because this Codex host bridge cannot start the configured MSYS bash runtime (`Win32 error 5`).
- This cycle did not attempt to fix the external host bridge defect.
- No MCP transport redesign or broader launcher refactor was attempted.

7. Next Cycle Starting Point

- Run the positive proof from a real supported VS Code bash terminal:
  - `echo $0`
  - `bash --version`
  - `./adf.sh --help`
  - one successful doctor or launch path that produces Brain-audit evidence
- If that supported-route proof succeeds without further code changes, the next cycle can focus on closure evidence rather than another implementation pass.
