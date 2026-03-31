param(
  [int]$BatchCount = 3,
  [string]$RunPrefix = "batch"
)

$root = Resolve-Path (Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) "..\\..\\..\\..")
Set-Location $root
$batchRunner = Join-Path $root "tools\\agent-role-builder\\tests\\grouped-shrinking-readiness\\run-batch.ps1"

for ($i = 1; $i -le $BatchCount; $i++) {
  $runId = "{0}-{1:D3}" -f $RunPrefix, $i
  Write-Host "=== START $runId ==="
  powershell -NoProfile -ExecutionPolicy Bypass -File $batchRunner -RunId $runId
  if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
  }
  Write-Host "=== DONE $runId ==="
}
