param(
  [string]$RunId = (Get-Date -Format "yyyyMMdd-HHmmss")
)

$root = Resolve-Path (Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) "..\\..\\..\\..\\..")
& (Join-Path $root "tools\\agent-role-builder\\node_modules\\.bin\\tsx.cmd") `
  (Join-Path $root "tools\\agent-role-builder\\tests\\enforcer-parallel-review-shape\\run-scenario.ts") `
  --scenario grouped-by-relevance `
  --run-id $RunId
