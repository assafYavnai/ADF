@echo off
setlocal

set "SCRIPT_DIR=%~dp0"
set "POWERSHELL_EXE=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"

if not exist "%POWERSHELL_EXE%" (
  echo FATAL: powershell.exe is not available at "%POWERSHELL_EXE%".
  exit /b 1
)

"%POWERSHELL_EXE%" -ExecutionPolicy Bypass -File "%SCRIPT_DIR%tools\adf-launcher.ps1" %*
