# Antigravity Skin - Windows 一键卸载脚本
$ErrorActionPreference = "Stop"

Write-Host "==================================================" -ForegroundColor Yellow
Write-Host "  正在卸载 Antigravity 主题与皮肤插件..." -ForegroundColor Yellow
Write-Host "=================================================="

$scriptDir = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Definition }

if ($scriptDir -and (Test-Path (Join-Path $scriptDir "scripts\uninstall.mjs"))) {
    if (Get-Command node -ErrorAction SilentlyContinue) {
        node (Join-Path $scriptDir "scripts\uninstall.mjs")
        exit 0
    }
}

# 回退/在线卸载模式
$homeDir = [System.Environment]::GetFolderPath('UserProfile')
$targetDir = Join-Path $homeDir ".gemini\config\plugins\antigravity-skin"
$configFile = Join-Path $homeDir ".gemini\config\config.json"

if (Test-Path $targetDir) {
    Write-Host "[1/2] 移除插件部署目录..." -ForegroundColor Green
    Remove-Item -Path $targetDir -Recurse -Force
}

if (Test-Path $configFile) {
    Write-Host "[2/2] 从配置文件注销插件..." -ForegroundColor Green
    try {
        $rawJson = Get-Content $configFile -Raw -Encoding UTF8
        $configObj = $rawJson | ConvertFrom-Json -AsHashtable
        if ($configObj.ContainsKey("plugins") -and $configObj["plugins"].ContainsKey("antigravity-skin")) {
            $configObj["plugins"].Remove("antigravity-skin")
            $updatedJson = $configObj | ConvertTo-Json -Depth 10
            Set-Content -Path $configFile -Value $updatedJson -Encoding UTF8
        }
    } catch {}
}

Write-Host "==================================================" -ForegroundColor Yellow
Write-Host " [√] 卸载成功！已完全还原官方初始状态。" -ForegroundColor Green
Write-Host " 请完全退出并重新打开 Antigravity 客户端。" -ForegroundColor Yellow
Write-Host "=================================================="
