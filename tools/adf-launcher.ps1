[CmdletBinding()]
param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$CliArgs
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $PSScriptRoot
$AdfScript = Join-Path $RepoRoot "adf.sh"

function Get-BashPath {
  $candidates = @()

  if ($env:SHELL) {
    $candidates += $env:SHELL
  }

  $candidates += @(
    "C:\Program Files\msys64\usr\bin\bash.exe",
    "C:\Program Files\Git\bin\bash.exe",
    "C:\Program Files\Git\usr\bin\bash.exe"
  )

  $resolved = Get-Command "bash.exe" -ErrorAction SilentlyContinue
  if ($resolved) {
    if ($resolved.Source) {
      $candidates += $resolved.Source
    } elseif ($resolved.Path) {
      $candidates += $resolved.Path
    } else {
      $candidates += $resolved.Definition
    }
  }

  foreach ($candidate in $candidates) {
    if ($candidate -and (Test-Path -LiteralPath $candidate)) {
      return $candidate
    }
  }

  return $null
}

$bash = Get-BashPath
if (-not $bash) {
  throw "ADF requires a working bash runtime on Windows. Install or expose MSYS2 or Git Bash and retry."
}

& $bash --version *> $null
if ($LASTEXITCODE -ne 0) {
  throw "bash is present but not runnable via $bash. Fix the bash runtime and retry."
}

& $bash $AdfScript @CliArgs
exit $LASTEXITCODE
