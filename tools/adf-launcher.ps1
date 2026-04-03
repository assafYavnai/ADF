[CmdletBinding()]
param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$CliArgs
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $PSScriptRoot
$MemoryEngineDir = Join-Path $RepoRoot "components\memory-engine"
$CooDir = Join-Path $RepoRoot "COO"
$DefaultScope = "assafyavnai/shippingagent"
$DoctorAuditScope = "assafyavnai/adf"
$DoctorAuditScript = Join-Path $RepoRoot "tools\doctor-brain-audit.mjs"
$DoctorIncidentDir = Join-Path $RepoRoot "memory\doctor-incidents"
$NpmCommand = "npm.cmd"
$PgIsReadyCommand = "pg_isready"

function Ensure-RepoLayout {
  $required = @(
    (Join-Path $RepoRoot "COO\package.json"),
    (Join-Path $RepoRoot "components\memory-engine\package.json")
  )

  foreach ($path in $required) {
    if (-not (Test-Path -LiteralPath $path)) {
      throw "ADF repo marker not found: $path"
    }
  }
}

function Get-LocalTsxShim {
  param([string]$PackageDir)

  $candidates = @(
    (Join-Path $PackageDir "node_modules\.bin\tsx.cmd"),
    (Join-Path $PackageDir "node_modules\.bin\tsx")
  )

  foreach ($candidate in $candidates) {
    if (Test-Path -LiteralPath $candidate) {
      return $candidate
    }
  }

  return $null
}

function Test-NeedsNpmInstall {
  param([string]$PackageDir)

  $nodeModulesDir = Join-Path $PackageDir "node_modules"
  $marker = Join-Path $nodeModulesDir ".package-lock.json"
  $packageLock = Join-Path $PackageDir "package-lock.json"

  if (-not (Test-Path -LiteralPath $nodeModulesDir)) { return $true }
  if (-not (Test-Path -LiteralPath $marker)) { return $true }
  if (-not (Test-Path -LiteralPath $packageLock)) { return $true }

  return (Get-Item -LiteralPath $packageLock).LastWriteTimeUtc -gt (Get-Item -LiteralPath $marker).LastWriteTimeUtc
}

function Test-NewerTypeScript {
  param(
    [string]$RootDir,
    [datetime]$ArtifactTimeUtc,
    [string[]]$SkipDirectoryNames = @()
  )

  if (-not (Test-Path -LiteralPath $RootDir)) {
    return $false
  }

  $skipSet = @{}
  foreach ($name in $SkipDirectoryNames) {
    $skipSet[$name] = $true
  }

  $queue = [System.Collections.Generic.Queue[string]]::new()
  $queue.Enqueue($RootDir)

  while ($queue.Count -gt 0) {
    $current = $queue.Dequeue()
    foreach ($entry in Get-ChildItem -LiteralPath $current -Force) {
      if ($entry.PSIsContainer) {
        if (-not $skipSet.ContainsKey($entry.Name)) {
          $queue.Enqueue($entry.FullName)
        }
        continue
      }

      if ($entry.Extension -eq ".ts" -and $entry.LastWriteTimeUtc -gt $ArtifactTimeUtc) {
        return $true
      }
    }
  }

  return $false
}

function Test-NeedsMemoryEngineBuild {
  $artifact = Join-Path $MemoryEngineDir "dist\server.js"
  if (-not (Test-Path -LiteralPath $artifact)) {
    return $true
  }

  return Test-NewerTypeScript -RootDir (Join-Path $MemoryEngineDir "src") -ArtifactTimeUtc (Get-Item -LiteralPath $artifact).LastWriteTimeUtc
}

function Test-NeedsCooBuild {
  $artifact = Join-Path $CooDir "dist\COO\controller\cli.js"
  if (-not (Test-Path -LiteralPath $artifact)) {
    return $true
  }

  return Test-NewerTypeScript -RootDir $CooDir -ArtifactTimeUtc (Get-Item -LiteralPath $artifact).LastWriteTimeUtc -SkipDirectoryNames @("dist", "node_modules")
}

function Invoke-Checked {
  param(
    [string]$Command,
    [string[]]$Arguments,
    [string]$WorkingDirectory,
    [string]$Description
  )

  Push-Location -LiteralPath $WorkingDirectory
  try {
    & $Command @Arguments
    if ($LASTEXITCODE -ne 0) {
      throw "$Description failed with exit code $LASTEXITCODE."
    }
  } finally {
    Pop-Location
  }
}

function Invoke-Capture {
  param(
    [string]$Command,
    [string[]]$Arguments,
    [string]$WorkingDirectory
  )

  $previous = Get-Location
  if ($WorkingDirectory) {
    Push-Location -LiteralPath $WorkingDirectory
  }

  try {
    $output = & $Command @Arguments 2>&1 | Out-String
    $exitCode = $LASTEXITCODE
    return [pscustomobject]@{
      ExitCode = $exitCode
      Output = $output.Trim()
    }
  } catch {
    return [pscustomobject]@{
      ExitCode = 1
      Output = $_.Exception.Message
    }
  } finally {
    if ($WorkingDirectory) {
      Pop-Location
    } else {
      Set-Location -LiteralPath $previous
    }
  }
}

function New-DoctorItem {
  param(
    [string]$Name,
    [ValidateSet("pass", "warn", "fail")]
    [string]$Status,
    [string]$Detail,
    [string]$Fix = ""
  )

  return [pscustomobject]@{
    Name = $Name
    Status = $Status
    Detail = $Detail
    Fix = $Fix
  }
}

function New-RepairItem {
  param(
    [string]$Name,
    [ValidateSet("applied", "failed")]
    [string]$Status,
    [string]$Detail,
    [string]$StartedAt,
    [string]$CompletedAt
  )

  return [pscustomobject]@{
    Name = $Name
    Status = $Status
    Detail = $Detail
    StartedAt = $StartedAt
    CompletedAt = $CompletedAt
  }
}

function Test-CommandPresence {
  param(
    [string]$Name,
    [string]$Command,
    [switch]$Required
  )

  $resolved = Get-Command $Command -ErrorAction SilentlyContinue
  if ($resolved) {
    $location = if ($resolved.Source) { $resolved.Source } elseif ($resolved.Path) { $resolved.Path } else { $resolved.Definition }
    return New-DoctorItem -Name $Name -Status "pass" -Detail "$Name is available via $location."
  }

  $status = if ($Required) { "fail" } else { "warn" }
  $fix = if ($Required) {
    "Install or expose $Name on PATH before using the launcher."
  } else {
    "Install $Name or update PATH if you want the documented fast-path tooling."
  }

  return New-DoctorItem -Name $Name -Status $status -Detail "$Name is not on PATH." -Fix $fix
}

function Get-DoctorChecks {
  $checks = [System.Collections.Generic.List[object]]::new()

  $checks.Add((Test-CommandPresence -Name "node" -Command "node" -Required))
  $checks.Add((Test-CommandPresence -Name "npm" -Command $NpmCommand -Required))
  $checks.Add((Test-CommandPresence -Name "rg" -Command "rg"))

  $bash = Get-Command "bash.exe" -ErrorAction SilentlyContinue
  if (-not $bash) {
    $checks.Add((New-DoctorItem -Name "bash" -Status "warn" -Detail "bash is not on PATH. The Windows launcher remains usable." -Fix "Install a working bash only if you need direct .sh execution outside Windows wrappers."))
  } else {
    $bashResult = Invoke-Capture -Command $bash.Source -Arguments @("--version") -WorkingDirectory $RepoRoot
    if ($bashResult.ExitCode -eq 0) {
      $checks.Add((New-DoctorItem -Name "bash" -Status "pass" -Detail "bash starts successfully via $($bash.Source)."))
    } else {
      $checks.Add((New-DoctorItem -Name "bash" -Status "warn" -Detail $bashResult.Output -Fix "Do not assume bash is usable on this runtime. Use adf.cmd or the PowerShell launcher instead."))
    }
  }

  $cooTsxShim = Get-LocalTsxShim -PackageDir $CooDir
  if ($cooTsxShim) {
    $checks.Add((New-DoctorItem -Name "COO tsx shim" -Status "pass" -Detail "Local COO tsx shim found at $cooTsxShim."))
  } else {
    $checks.Add((New-DoctorItem -Name "COO tsx shim" -Status "fail" -Detail "COO local tsx shim is missing." -Fix "Run npm.cmd install in COO."))
  }

  $memoryTsxShim = Get-LocalTsxShim -PackageDir $MemoryEngineDir
  if ($memoryTsxShim) {
    $checks.Add((New-DoctorItem -Name "memory-engine tsx shim" -Status "pass" -Detail "Local memory-engine tsx shim found at $memoryTsxShim."))
  } else {
    $checks.Add((New-DoctorItem -Name "memory-engine tsx shim" -Status "fail" -Detail "memory-engine local tsx shim is missing." -Fix "Run npm.cmd install in components/memory-engine."))
  }

  $rootTsxImport = Invoke-Capture -Command "node" -Arguments @("--import", "tsx", "-e", "console.log('ok')") -WorkingDirectory $RepoRoot
  if ($rootTsxImport.ExitCode -eq 0) {
    $checks.Add((New-DoctorItem -Name "repo-root tsx import" -Status "pass" -Detail "Repo-root node --import tsx works."))
  } else {
    $checks.Add((New-DoctorItem -Name "repo-root tsx import" -Status "warn" -Detail $rootTsxImport.Output -Fix "Use the package-local tsx shim or execute node --import tsx from COO or components/memory-engine."))
  }

  $git = Get-Command "git" -ErrorAction SilentlyContinue
  if (-not $git) {
    $checks.Add((New-DoctorItem -Name "git" -Status "warn" -Detail "git is not on PATH." -Fix "Install git and add it to PATH if you need repo status and version control operations."))
  } else {
    $gitStatus = Invoke-Capture -Command $git.Source -Arguments @("status", "--short") -WorkingDirectory $RepoRoot
    if ($gitStatus.ExitCode -eq 0) {
      $checks.Add((New-DoctorItem -Name "git safe.directory" -Status "pass" -Detail "git status works without extra safe.directory flags."))
    } elseif ($gitStatus.Output -match "dubious ownership|safe\.directory") {
      $checks.Add((New-DoctorItem -Name "git safe.directory" -Status "warn" -Detail $gitStatus.Output -Fix "Run git config --global --add safe.directory $($RepoRoot -replace '\\','/')."))
    } else {
      $checks.Add((New-DoctorItem -Name "git safe.directory" -Status "warn" -Detail $gitStatus.Output -Fix "Inspect git configuration for this workspace."))
    }
  }

  $pgIsReady = Get-Command $PgIsReadyCommand -ErrorAction SilentlyContinue
  if (-not $pgIsReady) {
    $checks.Add((New-DoctorItem -Name "pg_isready" -Status "warn" -Detail "pg_isready is not on PATH. PostgreSQL reachability was not probed." -Fix "Install PostgreSQL client tools if you want preflight DB checks from the launcher."))
  } else {
    $pgStatus = Invoke-Capture -Command $pgIsReady.Source -Arguments @("-h", "localhost", "-p", "5432", "-q") -WorkingDirectory $RepoRoot
    if ($pgStatus.ExitCode -eq 0) {
      $checks.Add((New-DoctorItem -Name "PostgreSQL reachability" -Status "pass" -Detail "PostgreSQL is accepting connections on localhost:5432."))
    } else {
      $checks.Add((New-DoctorItem -Name "PostgreSQL reachability" -Status "fail" -Detail $pgStatus.Output -Fix "Start PostgreSQL before launching ADF."))
    }
  }

  $memoryEngineClientArtifact = Join-Path $CooDir "dist\COO\controller\memory-engine-client.js"
  $memoryEngineServerArtifact = Join-Path $MemoryEngineDir "dist\server.js"
  if (-not (Test-Path -LiteralPath $memoryEngineClientArtifact) -or -not (Test-Path -LiteralPath $memoryEngineServerArtifact)) {
    $checks.Add((New-DoctorItem -Name "memory-engine connect smoke" -Status "warn" -Detail "Built artifacts for memory-engine connectivity smoke are missing." -Fix "Run npm.cmd run build in COO and components/memory-engine."))
  } else {
    $smokeScript = @"
import { pathToFileURL } from 'node:url';

const moduleUrl = pathToFileURL(process.argv[1]).href;
const repoRoot = process.argv[2];
const { MemoryEngineClient } = await import(moduleUrl);
let client;
try {
  client = await MemoryEngineClient.connect(repoRoot);
  await client.close();
  console.log('ok');
} finally {
  if (client) {
    try {
      await client.close();
    } catch {}
  }
}
"@

    $smoke = Invoke-Capture -Command "node" -Arguments @("--input-type=module", "-e", $smokeScript, $memoryEngineClientArtifact, $RepoRoot) -WorkingDirectory $RepoRoot
    if ($smoke.ExitCode -eq 0) {
      $checks.Add((New-DoctorItem -Name "memory-engine connect smoke" -Status "pass" -Detail "MemoryEngineClient.connect() succeeded from the current runtime."))
    } else {
      $checks.Add((New-DoctorItem -Name "memory-engine connect smoke" -Status "fail" -Detail $smoke.Output -Fix "The runtime still blocks the child-process Brain client. Fix MCP startup or execution permissions; doctor must fail until the stdio Brain route works."))
    }
  }

  return $checks
}

function Print-DoctorReport {
  param(
    [object[]]$Checks,
    [object[]]$Repairs = @(),
    [string]$ReportPath = "",
    [string]$BrainAuditResult = ""
  )

  Write-Host "ADF doctor"
  if ($Repairs.Count -gt 0) {
    Write-Host "Repairs attempted"
    foreach ($repair in $Repairs) {
      $marker = if ($repair.Status -eq "applied") { "FIXED" } else { "FAILED" }
      Write-Host "[$marker] $($repair.Name)"
      Write-Host "  $($repair.Detail)"
    }
  }
  foreach ($check in $Checks) {
    $marker = switch ($check.Status) {
      "pass" { "PASS" }
      "fail" { "FAIL" }
      default { "WARN" }
    }

    Write-Host "[$marker] $($check.Name)"
    Write-Host "  $($check.Detail)"
    if ($check.Fix) {
      Write-Host "  Fix: $($check.Fix)"
    }
  }
  if ($BrainAuditResult) {
    Write-Host "[PASS] Brain audit"
    Write-Host "  $BrainAuditResult"
  }
  if ($ReportPath) {
    Write-Host "[REPORT] Local incident"
    Write-Host "  $ReportPath"
  }
}

function Invoke-RepairStep {
  param(
    [string]$Name,
    [string]$Detail,
    [scriptblock]$Operation,
    [System.Collections.Generic.List[object]]$Repairs
  )

  $startedAt = (Get-Date).ToString("o")
  try {
    & $Operation
    $Repairs.Add((New-RepairItem -Name $Name -Status "applied" -Detail $Detail -StartedAt $startedAt -CompletedAt (Get-Date).ToString("o")))
  } catch {
    $message = $_.Exception.Message
    $Repairs.Add((New-RepairItem -Name $Name -Status "failed" -Detail "$Detail Failed: $message" -StartedAt $startedAt -CompletedAt (Get-Date).ToString("o")))
    throw
  }
}

function Repair-DoctorPrerequisites {
  param([System.Collections.Generic.List[object]]$Repairs)

  $node = Get-Command "node" -ErrorAction SilentlyContinue
  if (-not $node) {
    throw "node is not installed or not on PATH."
  }

  $npm = Get-Command $NpmCommand -ErrorAction SilentlyContinue
  if (-not $npm) {
    throw "$NpmCommand is not installed or not on PATH."
  }

  if (Test-NeedsNpmInstall -PackageDir $MemoryEngineDir) {
    Invoke-RepairStep -Name "memory-engine dependencies" -Detail "Installed missing or stale memory-engine dependencies." -Repairs $Repairs -Operation {
      Invoke-Checked -Command $NpmCommand -Arguments @("install", "--no-fund", "--no-audit") -WorkingDirectory $MemoryEngineDir -Description "Installing memory-engine dependencies"
    }
  }

  if (Test-NeedsMemoryEngineBuild) {
    Invoke-RepairStep -Name "memory-engine build" -Detail "Built memory-engine artifacts required for MCP startup." -Repairs $Repairs -Operation {
      Invoke-Checked -Command $NpmCommand -Arguments @("run", "build") -WorkingDirectory $MemoryEngineDir -Description "Building memory-engine"
    }
  }

  if (Test-NeedsNpmInstall -PackageDir $CooDir) {
    Invoke-RepairStep -Name "COO dependencies" -Detail "Installed missing or stale COO dependencies." -Repairs $Repairs -Operation {
      Invoke-Checked -Command $NpmCommand -Arguments @("install", "--no-fund", "--no-audit") -WorkingDirectory $CooDir -Description "Installing COO dependencies"
    }
  }

  $cooMemoryClientArtifact = Join-Path $CooDir "dist\COO\controller\memory-engine-client.js"
  if ((Test-NeedsCooBuild) -or -not (Test-Path -LiteralPath $cooMemoryClientArtifact)) {
    Invoke-RepairStep -Name "COO build" -Detail "Built COO artifacts required for Brain MCP connectivity checks." -Repairs $Repairs -Operation {
      Invoke-Checked -Command $NpmCommand -Arguments @("run", "build") -WorkingDirectory $CooDir -Description "Building COO"
    }
  }
}

function Get-DoctorIncidentPath {
  param([string]$RunId)

  $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
  $shortRunId = $RunId.Substring(0, 8)
  return Join-Path $DoctorIncidentDir "$timestamp-doctor-mcp-incident-$shortRunId.json"
}

function Write-DoctorIncidentReport {
  param(
    [string]$RunId,
    [string]$StartedAt,
    [string]$CompletedAt,
    [string]$Stage,
    [string]$Message,
    [object[]]$Checks,
    [object[]]$Repairs
  )

  $reportPath = Get-DoctorIncidentPath -RunId $RunId
  New-Item -ItemType Directory -Force -Path $DoctorIncidentDir | Out-Null

  $report = [ordered]@{
    run_id = $RunId
    scope = $DoctorAuditScope
    status = "blocked"
    stage = $Stage
    started_at = $StartedAt
    completed_at = $CompletedAt
    message = $Message
    repairs_attempted = @($Repairs)
    checks = @($Checks)
  }

  $report | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $reportPath -Encoding utf8
  return $reportPath
}

function Invoke-BrainDoctorAudit {
  param(
    [string]$RunId,
    [string]$StartedAt,
    [string]$CompletedAt,
    [object[]]$Checks,
    [object[]]$Repairs
  )

  if (-not (Test-Path -LiteralPath $DoctorAuditScript)) {
    throw "Doctor Brain audit script is missing: $DoctorAuditScript"
  }

  $outcome = if ($Repairs.Count -gt 0) { "healed" } else { "verified" }
  $summary = if ($Repairs.Count -gt 0) {
    "Doctor repaired Brain MCP prerequisites and verified working MCP connectivity."
  } else {
    "Doctor verified working Brain MCP connectivity without repairs."
  }

  $payloadPath = Join-Path $RepoRoot "tmp\doctor-audit-$RunId.json"
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $payloadPath) | Out-Null

  $payload = [ordered]@{
    run_id = $RunId
    scope = $DoctorAuditScope
    title = "ADF doctor Brain MCP health audit"
    summary = $summary
    outcome = $outcome
    started_at = $StartedAt
    completed_at = $CompletedAt
    repairs_attempted = @($Repairs)
    checks = @($Checks)
    tags = @("doctor", "mcp-health", "audit", $outcome)
  }

  try {
    $payload | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $payloadPath -Encoding utf8
    $result = Invoke-Capture -Command "node" -Arguments @($DoctorAuditScript, $payloadPath) -WorkingDirectory $RepoRoot
    if ($result.ExitCode -ne 0) {
      throw $result.Output
    }
    return $result.Output
  } finally {
    if (Test-Path -LiteralPath $payloadPath) {
      Remove-Item -LiteralPath $payloadPath -Force
    }
  }
}

function Run-Doctor {
  $runId = [guid]::NewGuid().Guid
  $startedAt = (Get-Date).ToString("o")
  $repairs = [System.Collections.Generic.List[object]]::new()
  $checks = [System.Collections.Generic.List[object]]::new()
  $stage = "repair"
  $brainAuditResult = ""
  $reportPath = ""

  try {
    Repair-DoctorPrerequisites -Repairs $repairs
    $stage = "verify"
    $checks = Get-DoctorChecks
    if (@($checks | Where-Object { $_.Status -eq "fail" }).Count -gt 0) {
      throw "Doctor verification failed. Brain MCP did not reach a healthy state."
    }

    $stage = "brain_audit"
    $brainAuditResult = Invoke-BrainDoctorAudit -RunId $runId -StartedAt $startedAt -CompletedAt (Get-Date).ToString("o") -Checks @($checks) -Repairs @($repairs)

    return [pscustomobject]@{
      Blocked = $false
      BrainAuditResult = $brainAuditResult
      Checks = @($checks)
      ErrorMessage = $null
      Repairs = @($repairs)
      ReportPath = $null
      RunId = $runId
    }
  } catch {
    $message = $_.Exception.Message
    if (@($checks).Count -eq 0) {
      $checks.Add((New-DoctorItem -Name "doctor stage" -Status "fail" -Detail $message -Fix "Inspect the blocking prerequisite and rerun doctor."))
    }

    $reportPath = Write-DoctorIncidentReport -RunId $runId -StartedAt $startedAt -CompletedAt (Get-Date).ToString("o") -Stage $stage -Message $message -Checks @($checks) -Repairs @($repairs)

    return [pscustomobject]@{
      Blocked = $true
      BrainAuditResult = ""
      Checks = @($checks)
      ErrorMessage = $message
      Repairs = @($repairs)
      ReportPath = $reportPath
      RunId = $runId
    }
  }
}

function Print-Help {
  @"
ADF launcher

Usage
  powershell -ExecutionPolicy Bypass -File tools/adf-launcher.ps1 [flags] [-- <COO args>]
  adf.cmd [flags] [-- <COO args>]

Flags
  --help, -h     Show this help text
  --doctor       Attempt self-healing repairs, require working Brain MCP, and log success to Brain
  --scope <id>   Override Brain scope (default: $DefaultScope)
  --no-onion     Disable onion requirements lane
  --tsx-direct   Run COO through the local tsx shim (default)
  --watch        Run COO through tsx watch
  --built        Run compiled COO JavaScript
  --             Pass remaining args directly to COO

Examples
  adf.cmd --doctor
  powershell -ExecutionPolicy Bypass -File tools/adf-launcher.ps1 --scope assafyavnai/adf -- --resume-last
  adf.cmd --built -- --thread-id <uuid>
"@ | Write-Host
}

function Parse-Options {
  $options = [ordered]@{
    Help = $false
    Doctor = $false
    Scope = $DefaultScope
    OnionEnabled = $true
    Mode = "tsx-direct"
    CooArgs = [System.Collections.Generic.List[string]]::new()
  }

  for ($index = 0; $index -lt $CliArgs.Length; $index += 1) {
    $arg = $CliArgs[$index]
    switch ($arg) {
      "--help" { $options.Help = $true; continue }
      "-h" { $options.Help = $true; continue }
      "--doctor" { $options.Doctor = $true; continue }
      "--scope" {
        if ($index + 1 -ge $CliArgs.Length) {
          throw "--scope requires a value"
        }
        $options.Scope = $CliArgs[$index + 1]
        $index += 1
        continue
      }
      "--no-onion" { $options.OnionEnabled = $false; continue }
      "--watch" { $options.Mode = "watch"; continue }
      "--built" { $options.Mode = "built"; continue }
      "--tsx-direct" { $options.Mode = "tsx-direct"; continue }
      "--" {
        for ($tail = $index + 1; $tail -lt $CliArgs.Length; $tail += 1) {
          $options.CooArgs.Add($CliArgs[$tail])
        }
        $index = $CliArgs.Length
        continue
      }
      default {
        throw "Unknown flag: $arg (use -- to pass flags directly to COO)"
      }
    }
  }

  return $options
}

function Run-LaunchPreflight {
  $node = Get-Command "node" -ErrorAction SilentlyContinue
  if (-not $node) {
    throw "node is not installed or not on PATH."
  }

  $npm = Get-Command $NpmCommand -ErrorAction SilentlyContinue
  if (-not $npm) {
    throw "$NpmCommand is not installed or not on PATH."
  }

  if (Test-NeedsNpmInstall -PackageDir $MemoryEngineDir) {
    Invoke-Checked -Command $NpmCommand -Arguments @("install", "--no-fund", "--no-audit") -WorkingDirectory $MemoryEngineDir -Description "Installing memory-engine dependencies"
  }

  if (Test-NeedsMemoryEngineBuild) {
    Invoke-Checked -Command $NpmCommand -Arguments @("run", "build") -WorkingDirectory $MemoryEngineDir -Description "Building memory-engine"
  }

  if (Test-NeedsNpmInstall -PackageDir $CooDir) {
    Invoke-Checked -Command $NpmCommand -Arguments @("install", "--no-fund", "--no-audit") -WorkingDirectory $CooDir -Description "Installing COO dependencies"
  }

  if ($Options.Mode -eq "built" -and (Test-NeedsCooBuild)) {
    Invoke-Checked -Command $NpmCommand -Arguments @("run", "build") -WorkingDirectory $CooDir -Description "Building COO"
  }

  $memoryArtifact = Join-Path $MemoryEngineDir "dist\server.js"
  if (-not (Test-Path -LiteralPath $memoryArtifact)) {
    throw "Memory-engine build artifact missing: $memoryArtifact"
  }

  $mcpSdkClientDir = Join-Path $MemoryEngineDir "node_modules\@modelcontextprotocol\sdk\dist\esm\client"
  if (-not (Test-Path -LiteralPath $mcpSdkClientDir)) {
    throw "MCP SDK client runtime missing: $mcpSdkClientDir"
  }

  if ($Options.Mode -in @("tsx-direct", "watch")) {
    $tsxShim = Get-LocalTsxShim -PackageDir $CooDir
    if (-not $tsxShim) {
      throw "Local tsx shim not found under COO\node_modules\.bin."
    }
  }

  if ($Options.Mode -eq "built") {
    $cooArtifact = Join-Path $CooDir "dist\COO\controller\cli.js"
    if (-not (Test-Path -LiteralPath $cooArtifact)) {
      throw "COO build artifact missing: $cooArtifact"
    }
  }

  $pgIsReady = Get-Command $PgIsReadyCommand -ErrorAction SilentlyContinue
  if ($pgIsReady) {
    $pgStatus = Invoke-Capture -Command $pgIsReady.Source -Arguments @("-h", "localhost", "-p", "5432", "-q") -WorkingDirectory $RepoRoot
    if ($pgStatus.ExitCode -ne 0) {
      throw "PostgreSQL is not reachable on localhost:5432. Start it before launching ADF."
    }
  }
}

function Launch-Coo {
  $onionFlag = if ($Options.OnionEnabled) { "--enable-onion" } else { "--disable-onion" }

  if ($Options.Mode -eq "built") {
    $command = "node"
    $arguments = [System.Collections.Generic.List[string]]::new()
    $arguments.Add((Join-Path $CooDir "dist\COO\controller\cli.js"))
  } else {
    $command = Get-LocalTsxShim -PackageDir $CooDir
    if (-not $command) {
      throw "Local tsx shim unavailable. Re-run with --doctor for details."
    }

    $arguments = [System.Collections.Generic.List[string]]::new()
    if ($Options.Mode -eq "watch") {
      $arguments.Add("watch")
    }
    $arguments.Add("controller/cli.ts")
  }

  $arguments.Add("--scope")
  $arguments.Add($Options.Scope)
  $arguments.Add($onionFlag)
  foreach ($extra in $Options.CooArgs) {
    $arguments.Add($extra)
  }

  Write-Host "Launching COO"
  Write-Host "  mode: $($Options.Mode)"
  Write-Host "  cwd:  $CooDir"
  Write-Host "  cmd:  $command $($arguments -join ' ')"

  Push-Location -LiteralPath $CooDir
  try {
    $argumentArray = $arguments.ToArray()
    & $command @argumentArray
    exit $LASTEXITCODE
  } finally {
    Pop-Location
  }
}

Ensure-RepoLayout
$Options = Parse-Options

if ($Options.Help) {
  Print-Help
  exit 0
}

if ($Options.Doctor) {
  $report = Run-Doctor
  Print-DoctorReport -Checks $report.Checks -Repairs $report.Repairs -ReportPath $report.ReportPath -BrainAuditResult $report.BrainAuditResult
  if ($report.Blocked) {
    exit 1
  }
  exit 0
}

Run-LaunchPreflight
Launch-Coo
