# Bash Execution Enforcement Test Plan

Date: 2026-04-03
Status: reviewed test plan

Related docs:

- [2026-04-03-bash-execution-enforcement-plan.md](C:/ADF/docs/v0/context/2026-04-03-bash-execution-enforcement-plan.md)
- [cli-agent.md](C:/ADF/docs/bootstrap/cli-agent.md)
- [architecture.md](C:/ADF/docs/v0/architecture.md)
- [adf.sh](C:/ADF/adf.sh)
- [adf.cmd](C:/ADF/adf.cmd)

## Purpose

Define the proof required after the bash-enforcement implementation is complete.

This test plan verifies four things:

- agents launched from a supported VS Code terminal actually execute through bash
- `adf.sh` remains the authoritative COO launcher
- Windows wrappers only trampoline into bash
- doctor is fail-closed and only succeeds when bash and Brain MCP both work

## Required Outcomes

Implementation is acceptable only if all of the following are true:

- a supported VS Code bash terminal proves a real bash shell is active
- `./adf.sh` runs under bash and drives the COO route through bash
- `adf.cmd` does not implement a separate PowerShell workflow shell
- Windows trampolines accept only approved `MSYS2` or `Git Bash` runtimes, and they do not treat `SHELL` as authority
- on Windows bash hosts, launcher package-manager resolution fails closed unless `npm.cmd` / `npx.cmd` are available
- doctor does not silently continue when bash is broken
- doctor does not silently continue when Brain MCP is broken
- successful doctor runs write a Brain audit
- failed doctor runs write a durable local incident report

## Positive Proof

### 1. Real bash terminal proof

From the supported VS Code terminal profile:

- run `echo $0`
- run `bash --version`

Pass criteria:

- shell output identifies bash
- `bash --version` succeeds

### 2. `adf.sh` route proof

From the same bash terminal:

- run `./adf.sh --help`
- run `./adf.sh --built -- --resume-last`

Pass criteria:

- the script starts from bash without wrapper substitution
- bash controls the launch flow
- COO starts or fails only on real downstream defects

### 3. Windows wrapper proof

From Windows:

- run `adf.cmd --help`
- run `adf.cmd --help` again with `SHELL` pointed at `powershell.exe`

Pass criteria:

- the wrapper validates bash
- the wrapper ignores non-approved `SHELL` candidates and still selects only approved bash runtimes
- the wrapper forwards into `bash adf.sh ...`
- the wrapper does not become the real workflow shell

### 4. Windows package-manager proof

From a supported Windows bash terminal:

- verify `command -v npm.cmd`
- verify `command -v npx.cmd`
- run `./adf.sh --help`

Pass criteria:

- `npm.cmd` and `npx.cmd` are both required on the Windows bash route
- no generic `npm` / `npx` fallback is used

### 5. Doctor success proof

From the supported entrypoint:

- run `adf.cmd --doctor` on Windows or `./adf.sh`-backed doctor entry on POSIX once that route is finalized

Pass criteria:

- doctor may repair bounded prerequisites
- doctor proves bash works
- doctor proves Brain MCP works
- doctor writes Brain audit evidence

## Negative Proof

### 1. Broken bash

Induce a bash failure by using an invalid bash path or a runtime where `bash --version` fails.

Pass criteria:

- launcher hard-stops
- doctor hard-stops
- no silent PowerShell workflow substitution occurs

### 2. Fake bash environment

Run in an environment that exposes MSYS or VS Code bash indicators but where bash itself cannot start.

Pass criteria:

- environment variables alone do not count as proof
- the route blocks because the bash smoke test fails

### 3. Broken Brain MCP

Break the Brain MCP route after bounded repair attempts are exhausted.

Pass criteria:

- doctor hard-stops
- no hidden local transport fallback is used
- a durable incident report is written locally
- no false success audit is written to Brain

## Brain Audit Proof

After a successful doctor run:

- read back the most recent doctor audit entry from Brain

Pass criteria:

- the audit exists
- it is stored as current evidence
- it records the success path rather than a fallback path

## Minimal Manual Test Sequence

1. Open VS Code using the supported bash terminal profile.
2. Run `echo $0`.
3. Run `bash --version`.
4. Run `./adf.sh --help`.
5. Run `adf.cmd --help` on Windows.
6. Run doctor in a healthy environment.
7. Read back the Brain audit.
8. Repeat with bash intentionally broken.
9. Repeat with Brain MCP intentionally broken.

## Blocking Conditions

Implementation is not accepted if any of the following remain true:

- VS Code claims bash but the active execution bridge still routes agent commands through PowerShell without proof of bash
- `adf.cmd` contains independent workflow logic instead of pure trampoline behavior
- doctor succeeds without proving working bash
- doctor succeeds without proving working Brain MCP
- doctor writes success-shaped audit evidence when MCP is still broken
