@echo off
cd /d "%~dp0"
node scripts\patch-boot-overlay.mjs
if %errorlevel% neq 0 pause
