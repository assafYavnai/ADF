param(
  [string]$RunId
)

if (-not $RunId) {
  throw "RunId is required"
}

$root = Resolve-Path (Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) "..\\..\\..\\..")
Set-Location $root

$scripts = @(
  "tools\\agent-role-builder\\tests\\grouped-shrinking-readiness\\safety-final-sanity\\run.ps1",
  "tools\\agent-role-builder\\tests\\grouped-shrinking-readiness\\safety-always-active\\run.ps1",
  "tools\\agent-role-builder\\tests\\grouped-shrinking-readiness\\safety-impact-reactivation\\run.ps1"
)

$procs = foreach ($script in $scripts) {
  Start-Process powershell `
    -ArgumentList @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", (Join-Path $root $script), "-RunId", $RunId) `
    -WorkingDirectory $root `
    -PassThru
}

$procs | Wait-Process
$failed = @()
foreach ($proc in $procs) {
  $proc.Refresh()
  if ($proc.ExitCode -ne 0) {
    $failed += [pscustomobject]@{ Id = $proc.Id; ExitCode = $proc.ExitCode }
  }
}

$procs | Select-Object Id, ProcessName, StartTime, ExitCode

if ($failed.Count -gt 0) {
  throw "One or more safety-layer scenarios failed in batch $RunId"
}
