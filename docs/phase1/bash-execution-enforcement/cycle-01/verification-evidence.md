# Verification Evidence

## Runtime checks from this session

### 1. `adf.cmd` with `SHELL` forced to PowerShell

Command:

```powershell
$env:SHELL='C:\WINDOWS\System32\WindowsPowerShell\v1.0\powershell.exe'; .\adf.cmd --help
```

Observed output:

```text
FATAL: ADF requires a working bash runtime on Windows.
       Install or expose an approved MSYS2 or Git Bash runtime and retry.
```

Why it matters:

- the wrapper did not treat the forced PowerShell `SHELL` value as authority
- it refused to launch unless it found an approved bash runtime candidate

### 2. PowerShell trampoline with `SHELL` forced to PowerShell

Command:

```powershell
$env:SHELL='C:\WINDOWS\System32\WindowsPowerShell\v1.0\powershell.exe'; powershell -ExecutionPolicy Bypass -File tools\adf-launcher.ps1 --help
```

Observed output excerpt:

```text
bash.exe : ... C:\Program Files\msys64\usr\bin\bash.exe: *** fatal error - couldn't create signal pipe, Win32 error 5
```

Why it matters:

- the wrapper ignored the non-bash `SHELL` candidate
- it selected the approved MSYS2 bash path and failed there instead of launching PowerShell as a fake shell route

### 3. Node trampoline with `SHELL` forced to PowerShell

Command:

```powershell
$env:SHELL='C:\WINDOWS\System32\WindowsPowerShell\v1.0\powershell.exe'; node tools\adf-launcher.mjs --help
```

Observed output:

```text
FATAL: bash is present but not runnable via "C:\Program Files\msys64\usr\bin\bash.exe".
       Fix the bash runtime and retry.
```

Why it matters:

- the Node trampoline also ignored the PowerShell `SHELL` candidate
- it resolved only an approved bash path

### 4. Syntax validation

Command:

```powershell
node --check tools\adf-launcher.mjs
```

Observed result:

- exit code `0`

## Source proof in this repo

- `adf.cmd` now filters candidates through `:is_approved_bash` before accepting `SHELL`, known paths, or `where` results.
- `tools/adf-launcher.ps1` now filters candidates through `Test-ApprovedBashCandidate`.
- `tools/adf-launcher.mjs` now filters candidates through `isApprovedBashPath`.
- `adf.sh` now:
  - defaults ADF launches to `assafyavnai/adf`
  - requires `npm.cmd`
  - requires `npx.cmd`
  - rejects generic Windows fallback to `npm` / `npx`

## Remaining external blocker

- Positive proof of the supported bash route is still blocked by this host bridge, which cannot start the configured MSYS bash runtime in this Codex session.
- That blocker is external to the repo changes in this cycle.
