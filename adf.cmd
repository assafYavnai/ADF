@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "SCRIPT_DIR=%~dp0"
set "BASH_EXE="

if defined SHELL call :consider_candidate "%SHELL%"

if not defined BASH_EXE call :consider_candidate "%ProgramFiles%\msys64\usr\bin\bash.exe"

if not defined BASH_EXE call :consider_candidate "%ProgramFiles%\Git\bin\bash.exe"

if not defined BASH_EXE call :consider_candidate "%ProgramFiles%\Git\usr\bin\bash.exe"

if not defined BASH_EXE call :scan_where

:bash_found
if not defined BASH_EXE (
  echo FATAL: ADF requires a working bash runtime on Windows.
  echo        Install or expose an approved MSYS2 or Git Bash runtime and retry.
  exit /b 1
)

"%BASH_EXE%" --version >nul 2>&1
if errorlevel 1 (
  echo FATAL: bash is present but not runnable via "%BASH_EXE%".
  echo        ADF requires a working bash runtime on Windows.
  echo        Fix the bash runtime and retry.
  exit /b 1
)

set "ADF_ENTRYPOINT=adf.cmd"
set "ADF_CONTROL_PLANE_KIND=windows-cmd-trampoline"
"%BASH_EXE%" "%SCRIPT_DIR%adf.sh" %*
exit /b %ERRORLEVEL%

:consider_candidate
set "CANDIDATE=%~1"
if not defined CANDIDATE exit /b 1
if not exist "%CANDIDATE%" exit /b 1
call :is_approved_bash "%CANDIDATE%"
if errorlevel 1 exit /b 1
set "BASH_EXE=%CANDIDATE%"
exit /b 0

:is_approved_bash
set "CANDIDATE=%~f1"
if /I not "%~nx1"=="bash.exe" exit /b 1
set "NORMALIZED=!CANDIDATE!"
set "MSYS_MATCH=!NORMALIZED:\msys64\=!"
if /I not "!MSYS_MATCH!"=="!NORMALIZED!" exit /b 0
set "GIT_MATCH=!NORMALIZED:\Git\=!"
if /I not "!GIT_MATCH!"=="!NORMALIZED!" exit /b 0
set "GIT_MATCH=!NORMALIZED:\git\=!"
if /I not "!GIT_MATCH!"=="!NORMALIZED!" exit /b 0
exit /b 1

:scan_where
for /f "delims=" %%F in ('where bash.exe 2^>nul') do (
  call :consider_candidate "%%F"
  if defined BASH_EXE exit /b 0
)
exit /b 1
