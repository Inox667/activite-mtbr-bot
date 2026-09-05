@echo off
REM Arrete TOUTES les instances du bot MTBR (utile si plusieurs se sont accumulees).
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"name='node.exe'\" | Where-Object { $_.CommandLine -match 'src.index.js' } | ForEach-Object { Write-Host ('Arret PID ' + $_.ProcessId); Stop-Process -Id $_.ProcessId -Force }"
echo Termine.
pause
