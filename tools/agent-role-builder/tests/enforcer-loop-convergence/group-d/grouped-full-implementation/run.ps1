param(
  [string]$RunId = (Get-Date -Format "yyyyMMdd-HHmmss")
)

$root = Resolve-Path (Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) "..\\..\\..\\..\\..\\..")
Set-Location $root

& (Join-Path $root "tools\\agent-role-builder\\node_modules\\.bin\\tsx.cmd") `
  (Join-Path $root "tools\\agent-role-builder\\tests\\enforcer-loop-convergence\\run-loop-scenario.ts") `
  --scenario "tools\\agent-role-builder\\tests\\enforcer-loop-convergence\\group-d\\grouped-full-implementation\\scenario.json" `
  --run-id $RunId
