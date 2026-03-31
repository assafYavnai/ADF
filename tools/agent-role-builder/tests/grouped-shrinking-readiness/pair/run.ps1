param(
  [string]$RunId = (Get-Date -Format "yyyyMMdd-HHmmss")
)

$root = Resolve-Path (Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) "..\\..\\..\\..\\..")
Set-Location $root

& (Join-Path $root "tools\\agent-role-builder\\node_modules\\.bin\\tsx.cmd") `
  (Join-Path $root "tools\\agent-role-builder\\tests\\grouped-shrinking-readiness\\run-readiness-scenario.ts") `
  --scenario "tools\\agent-role-builder\\tests\\grouped-shrinking-readiness\\pair\\scenario.json" `
  --run-id $RunId
