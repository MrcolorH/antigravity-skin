@echo off
chcp 65001 >nul
title 安装 Antigravity 主题与皮肤插件
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1"
if %ERRORLEVEL% equ 0 (
    echo.
    echo ==================================================
    echo  [√] 安装部署完成！
    echo --------------------------------------------------
    echo  🔔 重要提醒：
    echo  插件运行文件已完整复制到系统官方持久化目录中。
    echo  当前您解压出来的这个文件夹【已经不需要了】！
    echo  关闭此窗口后，请直接将本文件夹【删除/移入回收站】即可，
    echo  本地无需保留任何临时文件，完全不影响插件正常运行。
    echo --------------------------------------------------
    echo  客户端已为您自动重新启动生效！
    echo ==================================================
) else (
    echo.
    echo [X] 安装失败，请检查上方错误提示。
)
echo.
pause
