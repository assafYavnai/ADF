param(
  [ValidateSet("install", "check", "status")]
  [string]$Command = "install",
  [string]$Target = "codex",
  [string]$ProjectRoot = "C:/ADF",
  [string]$InstallRoot
)

$scriptPath = Join-Path $PSScriptRoot "manage-skills.mjs"
$args = @($scriptPath, $Command, "--project-root", $ProjectRoot, "--target", $Target)

if ($InstallRoot) {
  $args += @("--install-root", $InstallRoot)
}

node @args
