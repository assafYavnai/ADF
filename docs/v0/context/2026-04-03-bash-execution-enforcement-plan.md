# Bash Execution Enforcement Plan

Date: 2026-04-03
Status: reviewed implementation plan

Related docs:

- [architecture.md](C:/ADF/docs/v0/architecture.md)
- [cli-agent.md](C:/ADF/docs/bootstrap/cli-agent.md)
- [adf.sh](C:/ADF/adf.sh)

## Purpose

Freeze the implementation plan for making ADF strictly bash-based while still remaining Windows-aware on Windows hosts.

This plan is based on the discussion that established:

- ADF's canonical shell is `bash`
- Windows remains a supported host OS
- agents running on Windows must still execute ADF shell actions through `bash`
- `adf.sh` is the real COO launcher
- Windows wrappers must be trampolines into `bash`, not replacements for `bash`
- MCP failures must not be hidden behind automatic transport fallbacks
- doctor may attempt bounded repairs, but it must end with working `bash` and working MCP or block

## Current Diagnosis

Observed in the current Codex runtime:

- the outer terminal environment is VS Code with MSYS2/UCRT64 environment variables
- VS Code is already configured to use `MSYS2 UCRT64 Bash` as the default terminal profile
- the actual command host visible to this agent is still `powershell.exe`
- all tested bash entrypoints fail from this agent bridge with:
  - `couldn't create signal pipe, Win32 error 5`
- both MSYS2 bash and Git Bash fail the same way

This means the current problem is not just "install bash" or "pick a different VS Code terminal profile".

The current problem is:

- the host/editor configuration intends to use bash
- but the active agent command bridge is still executing through PowerShell
- and bash startup is not healthy inside that bridge

## Frozen Outcomes From Discussion

### 1. Shell policy

- `bash` is the canonical ADF shell on all platforms
- ADF must not silently replace bash workflow logic with PowerShell logic
- Python is not the preferred answer for this problem

### 2. Windows policy

- Windows is a supported host OS
- on Windows, agents must remain aware that they are on Windows
- on Windows, ADF shell execution must still happen through `bash`
- agents may call native Windows programs when needed, but ADF shell commands remain bash commands

### 3. Launcher policy

- `adf.sh` is the authoritative COO launcher
- `adf.cmd` exists only to probe and forward into bash on Windows
- if bash is missing or broken, ADF must hard-stop

### 4. MCP policy

- MCP must not be bypassed with automatic hidden fallback routing
- doctor may repair prerequisites, but it must finish with working MCP
- if MCP remains broken, doctor must block and emit a durable report

## Implementation Order

### Step 1. Freeze the shell contract in docs

Update architecture and bootstrap docs so they state unambiguously:

- canonical shell: `bash`
- Windows host support does not change the shell contract
- Windows wrappers are trampolines only
- non-bash execution is non-compliant

Acceptance:

- no doc describes PowerShell as an equivalent ADF workflow shell
- Windows guidance explicitly says "Windows host, bash shell"

### Step 2. Re-center launcher authority on `adf.sh`

Refactor launcher ownership so:

- [adf.sh](C:/ADF/adf.sh) remains the real launcher
- [adf.cmd](C:/ADF/adf.cmd) only:
  - verifies that bash exists
  - verifies that bash starts successfully
  - forwards into `bash adf.sh ...`
- any PowerShell launch logic stays limited to bootstrap/trampoline behavior

Acceptance:

- the authoritative COO path is always `adf.sh`
- Windows wrappers do not implement separate business logic

### Step 3. Make doctor enforce bash plus MCP

Doctor should verify, in order:

1. bash exists
2. bash starts successfully
3. required tooling is reachable from the supported runtime
4. Brain MCP is healthy

Doctor may repair only bounded prerequisites such as:

- missing/stale installs
- missing/stale build artifacts

Doctor must not:

- switch to a hidden non-MCP transport
- silently continue without bash
- silently continue without working Brain MCP

Acceptance:

- doctor success means:
  - bash works
  - MCP works
  - Brain audit write succeeds
- doctor failure means:
  - hard stop
  - durable local incident report

### Step 4. Make agent bootstrap Windows-aware and bash-executing

Agent instructions should explicitly teach:

- detect whether the host OS is Windows
- remain aware of Windows path/process behavior when on Windows
- still issue ADF shell operations through `bash`
- use native Windows binaries only when necessary
- never treat PowerShell as a substitute for the ADF shell contract

Acceptance:

- bootstrap guidance clearly distinguishes host OS from shell contract
- agents are told how to behave on Windows without weakening bash enforcement

### Step 5. Fix the host/runtime bridge, not just repo docs

The repo cannot fully solve a host integration defect.

The host/editor/agent runtime must ensure:

- agent command execution actually runs inside a real bash session or bash PTY
- the selected VS Code bash profile is honored by the execution bridge, not just by the visible terminal UI

If the runtime cannot provide that:

- ADF should fail closed instead of pretending the environment is compliant

Acceptance:

- agent command execution proves a real bash shell can start and run commands
- the current `signal pipe` startup failure is eliminated

### Step 6. Add proof and regression gates

Add route-proof checks that verify:

- Windows launch path forwards into bash
- bash smoke test passes
- doctor blocks when bash or MCP is unhealthy
- no silent PowerShell workflow path is accepted as compliant

Acceptance:

- CI or controlled proof runs detect regression immediately

## Non-Goals

- rewriting ADF workflow scripting to Python
- treating PowerShell as an equal long-term workflow shell
- hiding MCP defects under transport fallback
- assuming VS Code terminal profile settings alone guarantee agent-shell compliance

## What "Done" Looks Like

ADF is compliant when all of the following are true:

- `adf.sh` is the single authoritative COO launcher
- Windows launchers only trampoline into bash
- agents know when they are on Windows and still execute ADF shell work through bash
- doctor can repair bounded prerequisites
- doctor hard-stops if bash or MCP still fails
- successful doctor runs are written to Brain
- failed doctor runs produce durable local incident reports
- no silent PowerShell replacement path remains for ADF workflow execution
