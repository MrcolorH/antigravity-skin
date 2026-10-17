@echo off
chcp 65001 >nul
title 卸载 Antigravity 主题与皮肤插件
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0uninstall.ps1"
if %ERRORLEVEL% equ 0 (
    echo.
    echo ==================================================
    echo  [√] 卸载完成！
    echo ==================================================
) else (
    echo.
    echo [X] 卸载失败，请检查上方错误提示。
)
echo.
pause
