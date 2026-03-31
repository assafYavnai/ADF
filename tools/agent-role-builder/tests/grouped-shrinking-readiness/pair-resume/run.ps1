param(
  [string]$RunId = (Get-Date -Format "yyyyMMdd-HHmmss")
)

$root = Resolve-Path (Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) "..\\..\\..\\..\\..")
Set-Location $root
$runner = Join-Path $root "tools\\agent-role-builder\\tests\\grouped-shrinking-readiness\\run-readiness-scenario.ts"
$tsx = Join-Path $root "tools\\agent-role-builder\\node_modules\\.bin\\tsx.cmd"
$scenario = "tools\\agent-role-builder\\tests\\grouped-shrinking-readiness\\pair-resume\\scenario.json"

& $tsx $runner --scenario $scenario --run-id $RunId --stop-after-cycle 1
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

& $tsx $runner --scenario $scenario --run-id $RunId
exit $LASTEXITCODE
