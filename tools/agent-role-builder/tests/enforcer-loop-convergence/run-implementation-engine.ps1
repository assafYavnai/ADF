param(
  [string]$RunId = (Get-Date -Format "yyyyMMdd-HHmmss")
)

$root = Resolve-Path (Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) "..\\..\\..\\..")
Set-Location $root

$scripts = @(
  "tools\\agent-role-builder\\tests\\enforcer-loop-convergence\\group-d\\grouped-full-implementation\\run.ps1",
  "tools\\agent-role-builder\\tests\\enforcer-loop-convergence\\group-d\\grouped-shrinking-implementation\\run.ps1",
  "tools\\agent-role-builder\\tests\\enforcer-loop-convergence\\group-d\\grouped-targeted-shrinking-implementation\\run.ps1",
  "tools\\agent-role-builder\\tests\\enforcer-loop-convergence\\group-d\\per-rule-shrinking-implementation\\run.ps1"
)

$processes = foreach ($script in $scripts) {
  Start-Process powershell `
    -ArgumentList @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", (Join-Path $root $script), "-RunId", $RunId) `
    -WorkingDirectory $root `
    -PassThru
}

$processes | Select-Object Id, ProcessName, StartTime
