@echo off
set "SHELL=C:\WINDOWS\System32\WindowsPowerShell\v1.0\powershell.exe"
call "C:\ADF\adf.cmd" --help
exit /b %ERRORLEVEL%
