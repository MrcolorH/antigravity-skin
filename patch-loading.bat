@echo off
cd /d "%~dp0"
node scripts\patch-boot-overlay.mjs
echo.
pause
