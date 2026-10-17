@echo off
cd /d "%~dp0"
node scripts\restore-boot-overlay.mjs
echo.
pause
