param(
  [string]$RunId = (Get-Date -Format "yyyyMMdd-HHmmss")
)

$scenarioDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$goalDir = Split-Path -Parent $scenarioDir
$testsDir = Split-Path -Parent $goalDir
$fixtureDir = Join-Path $testsDir "fixtures\\run01-role-artifact"
$resultDir = Join-Path $scenarioDir "results\\$RunId"

New-Item -ItemType Directory -Force -Path $resultDir | Out-Null

$manifest = [ordered]@{
  experiment_slug = "enforcer-parallel-review-shape"
  scenario = "per-rule"
  run_id = $RunId
  created_at = (Get-Date).ToString("o")
  fixture = @{
    root = "tools/agent-role-builder/tests/fixtures/run01-role-artifact"
    role_markdown = "tools/agent-role-builder/tests/fixtures/run01-role-artifact/agent-role-builder-role.md"
    role_contract = "tools/agent-role-builder/tests/fixtures/run01-role-artifact/agent-role-builder-role-contract.json"
  }
  shared_kpi_model = "tools/agent-role-builder/tests/enforcer-parallel-review-shape/kpi-model.json"
  expected_outputs = @(
    "run-manifest.json",
    "raw-findings.json",
    "normalized-findings.json",
    "kpi-summary.json",
    "analysis.md"
  )
}

$manifest | ConvertTo-Json -Depth 6 | Set-Content -Encoding UTF8 (Join-Path $resultDir "run-manifest.json")
"[]" | Set-Content -Encoding UTF8 (Join-Path $resultDir "raw-findings.json")
"[]" | Set-Content -Encoding UTF8 (Join-Path $resultDir "normalized-findings.json")
"{}" | Set-Content -Encoding UTF8 (Join-Path $resultDir "kpi-summary.json")
@"
# Analysis

- Scenario: per-rule
- Run id: $RunId
- Fill this file after the scenario completes.
"@ | Set-Content -Encoding UTF8 (Join-Path $resultDir "analysis.md")

Write-Output "Prepared result scaffold: $resultDir"

