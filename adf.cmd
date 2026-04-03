@echo off
setlocal EnableExtensions

set "SCRIPT_DIR=%~dp0"
set "BASH_EXE="

if defined SHELL if exist "%SHELL%" (
  set "BASH_EXE=%SHELL%"
)

if not defined BASH_EXE if exist "%ProgramFiles%\msys64\usr\bin\bash.exe" (
  set "BASH_EXE=%ProgramFiles%\msys64\usr\bin\bash.exe"
)

if not defined BASH_EXE if exist "%ProgramFiles%\Git\bin\bash.exe" (
  set "BASH_EXE=%ProgramFiles%\Git\bin\bash.exe"
)

if not defined BASH_EXE if exist "%ProgramFiles%\Git\usr\bin\bash.exe" (
  set "BASH_EXE=%ProgramFiles%\Git\usr\bin\bash.exe"
)

if not defined BASH_EXE (
  for /f "delims=" %%F in ('where bash.exe 2^>nul') do (
    set "BASH_EXE=%%F"
    goto bash_found
  )
)

:bash_found
if not defined BASH_EXE (
  echo FATAL: ADF requires a working bash runtime on Windows.
  echo        Install or expose MSYS2 or Git Bash and retry.
  exit /b 1
)

"%BASH_EXE%" --version >nul 2>&1
if errorlevel 1 (
  echo FATAL: bash is present but not runnable via "%BASH_EXE%".
  echo        ADF requires a working bash runtime on Windows.
  echo        Fix the bash runtime and retry.
  exit /b 1
)

"%BASH_EXE%" "%SCRIPT_DIR%adf.sh" %*
exit /b %ERRORLEVEL%
