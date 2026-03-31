param(
  [string]$RunId = (Get-Date -Format "yyyyMMdd-HHmmss")
)

$root = Resolve-Path (Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) "..\\..\\..\\..")
Set-Location $root

$scripts = @(
  "tools\\agent-role-builder\\tests\\enforcer-loop-convergence\\group-a\\per-rule-full\\run.ps1",
  "tools\\agent-role-builder\\tests\\enforcer-loop-convergence\\group-a\\grouped-full\\run.ps1",
  "tools\\agent-role-builder\\tests\\enforcer-loop-convergence\\group-b\\per-rule-shrinking\\run.ps1",
  "tools\\agent-role-builder\\tests\\enforcer-loop-convergence\\group-b\\grouped-shrinking\\run.ps1",
  "tools\\agent-role-builder\\tests\\enforcer-loop-convergence\\group-c\\per-rule-learning\\run.ps1",
  "tools\\agent-role-builder\\tests\\enforcer-loop-convergence\\group-c\\grouped-learning\\run.ps1"
)

$processes = foreach ($script in $scripts) {
  Start-Process powershell `
    -ArgumentList @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", (Join-Path $root $script), "-RunId", $RunId) `
    -WorkingDirectory $root `
    -PassThru
}

$processes | Select-Object Id, ProcessName, StartTime
