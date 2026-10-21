@echo off
rem ---------------------------------------------------------------
rem  Starts the payroll system without a window, for Windows Task
rem  Scheduler ("At startup").
rem  MySQL and the Cloudflare Tunnel run as Windows services.
rem  Output goes to logs\payroll.log in the project folder.
rem  The JAR must already be built (mvn package -DskipTests in backend).
rem ---------------------------------------------------------------
cd /d "%~dp0..\backend"
if not exist "..\logs" mkdir "..\logs"

rem Give MySQL a moment after a restart.
rem (ping instead of timeout: timeout fails without a console window)
ping -n 21 127.0.0.1 >nul

java -Djava.library.path=lib -jar target\payroll-biometric-system-0.1.0.jar --spring.config.additional-location=file:src/main/resources/ --frontend.dir=.. >> "..\logs\payroll.log" 2>&1
