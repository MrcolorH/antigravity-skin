@echo off
chcp 65001 >nul
title 安装 Antigravity 主题与皮肤插件
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1"
if %ERRORLEVEL% equ 0 (
    echo.
    echo ==================================================
    echo  [√] 安装成功！请完全退出并重新打开 Antigravity。
    echo ==================================================
) else (
    echo.
    echo [X] 安装失败，请检查上方错误提示。
)
echo.
pause
