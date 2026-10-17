$ErrorActionPreference = "Stop"

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "  正在安装 Antigravity 主题与皮肤插件..." -ForegroundColor Cyan
Write-Host "=================================================="

$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Definition
node --experimental-websocket (Join-Path $scriptPath "scripts\install.mjs")
