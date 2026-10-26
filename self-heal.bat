@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
echo ==================================================
echo   Antigravity Skin 开机动画补丁自检与自愈
echo ==================================================
node --experimental-websocket scripts\self-heal.mjs
set "HEAL_CODE=%errorlevel%"
echo.
if "%HEAL_CODE%"=="2" (
  echo 提示：Antigravity 客户端正在运行，为避免打断你的会话本次已跳过。
  echo       关闭客户端后再运行本脚本即可立即补打，或等下次登录 Windows 自动恢复。
)
if "%HEAL_CODE%"=="1" (
  echo 提示：自愈未能完成，可在外观设置中点击「一键修复」重试。
)
if "%HEAL_CODE%"=="3" (
  echo 提示：当前系统不是 Windows，无需开机动画补丁。
)
echo --------------------------------------------------
echo  自愈守护状态：
node scripts\register-self-heal.mjs --status
echo --------------------------------------------------
pause
