@echo off
rem ---------------------------------------------------------------
rem  PayrollPro - starts everything on this computer:
rem    1. MySQL (XAMPP), if it isn't running yet
rem    2. the payroll system (Spring Boot) on http://localhost:8080
rem    3. the Cloudflare Tunnel, if it has been set up (see DEPLOYMENT.md),
rem       so the system is also reachable at your domain
rem  Close this window (or press Ctrl+C) to stop the system.
rem ---------------------------------------------------------------
title PayrollPro Server
cd /d "%~dp0backend"

set JAR=target\payroll-biometric-system-0.1.0.jar
set XAMPP=C:\xampp

rem 1. MySQL
"%SystemRoot%\System32\tasklist.exe" /FI "IMAGENAME eq mysqld.exe" | "%SystemRoot%\System32\find.exe" /I "mysqld.exe" >nul
if errorlevel 1 (
    if not exist "%XAMPP%\mysql\bin\mysqld.exe" (
        echo MySQL is not running and XAMPP was not found in %XAMPP%.
        echo Start MySQL from the XAMPP Control Panel, then run this again.
        pause
        exit /b 1
    )
    echo Starting MySQL...
    start "MySQL (XAMPP)" /min "%XAMPP%\mysql\bin\mysqld.exe" --defaults-file="%XAMPP%\mysql\bin\my.ini" --standalone
    "%SystemRoot%\System32\timeout.exe" /t 6 /nobreak >nul
) else (
    echo MySQL is already running.
)

rem 2. Restart: stop an older PayrollPro server still holding port 8080 (e.g.
rem    one started earlier from this script or from VS Code). Anything else on
rem    port 8080 is left alone and reported.
powershell -NoProfile -Command "$c = Get-NetTCPConnection -LocalPort 8080 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1; if (-not $c) { exit 0 }; $p = Get-CimInstance Win32_Process -Filter ('ProcessId=' + $c.OwningProcess); if ($p.CommandLine -match 'PayrollApplication|payroll-biometric-system') { Write-Host 'Stopping the PayrollPro server that is already running...'; Stop-Process -Id $p.ProcessId -Force; Start-Sleep -Seconds 2; exit 0 }; Write-Host ('Port 8080 is used by another program: ' + $p.Name + ' (PID ' + $p.ProcessId + '). Close it, then run this again.'); exit 1"
if errorlevel 1 (
    pause
    exit /b 1
)

rem 3. Build the system the first time (needs internet once for Maven), and
rem    again whenever the Java code is newer than the last build.
powershell -NoProfile -Command "$j = Get-Item '%JAR%' -ErrorAction SilentlyContinue; if (-not $j) { exit 1 }; $n = Get-ChildItem src, pom.xml -Recurse -File | Where-Object { $_.LastWriteTime -gt $j.LastWriteTime -and $_.Name -ne 'application.properties' } | Select-Object -First 1; if ($n) { exit 1 } else { exit 0 }"
if errorlevel 1 (
    echo Building the system - this takes a minute or two...
    call mvn -q package -DskipTests
    if errorlevel 1 (
        echo Build failed. See the messages above.
        pause
        exit /b 1
    )
)

rem 4. Cloudflare Tunnel (only when set up; see DEPLOYMENT.md), unless it is
rem    already running from an earlier start.
"%SystemRoot%\System32\where.exe" cloudflared >nul 2>nul
if not errorlevel 1 if exist "%USERPROFILE%\.cloudflared\config.yml" (
    "%SystemRoot%\System32\tasklist.exe" /FI "IMAGENAME eq cloudflared.exe" | "%SystemRoot%\System32\find.exe" /I "cloudflared.exe" >nul
    if errorlevel 1 (
        echo Starting the Cloudflare Tunnel...
        start "Cloudflare Tunnel" /min cloudflared tunnel run
    ) else (
        echo The Cloudflare Tunnel is already running.
    )
)

echo.
echo  PayrollPro is starting. Open  http://localhost:8080  in the browser.
echo  Keep this window open while using the system.
echo.
rem application.properties is read from src\main\resources, so edits there
rem (email, device IP, ...) apply on the next start without rebuilding.
java -Djava.library.path=lib -jar "%JAR%" --spring.config.additional-location=file:src/main/resources/ --frontend.dir=..
pause
