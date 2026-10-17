$ErrorActionPreference = "Stop"

Write-Host "==================================================" -ForegroundColor Yellow
Write-Host "  正在卸载 Antigravity 主题与皮肤插件..." -ForegroundColor Yellow
Write-Host "=================================================="

$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Definition
node (Join-Path $scriptPath "scripts\uninstall.mjs")
