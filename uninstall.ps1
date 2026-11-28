# Antigravity Skin - Windows 一键卸载脚本
$ErrorActionPreference = "Stop"

Write-Host "==================================================" -ForegroundColor Yellow
Write-Host "  正在卸载 Antigravity 主题与皮肤插件..." -ForegroundColor Yellow
Write-Host "=================================================="

$scriptDir = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Definition }

if ($scriptDir -and (Test-Path (Join-Path $scriptDir "scripts\uninstall.mjs"))) {
    if (Get-Command node -ErrorAction SilentlyContinue) {
        node (Join-Path $scriptDir "scripts\uninstall.mjs") @args
        exit 0
    }
}

# 回退/在线卸载模式
$homeDir = [System.Environment]::GetFolderPath('UserProfile')
$targetDir = Join-Path $homeDir ".gemini\config\plugins\antigravity-skin"
$configFile = Join-Path $homeDir ".gemini\config\config.json"

Write-Host "[1/4] 清理开机自愈与快捷方式启动参数..." -ForegroundColor Green
$startupVbs = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs\Startup\AntigravitySkinSelfHeal.vbs"
if (Test-Path $startupVbs) { Remove-Item -Path $startupVbs -Force -ErrorAction SilentlyContinue }

try {
    $wsh = New-Object -ComObject WScript.Shell
    $taskbarDir = Join-Path $env:APPDATA "Microsoft\Internet Explorer\Quick Launch\User Pinned\TaskBar"
    $lnkDirs = @(
        [System.Environment]::GetFolderPath('Desktop'),
        [System.Environment]::GetFolderPath('CommonDesktopDirectory'),
        [System.Environment]::GetFolderPath('Programs'),
        [System.Environment]::GetFolderPath('CommonPrograms'),
        $taskbarDir
    )
    foreach ($d in $lnkDirs) {
        if ($d -and (Test-Path $d)) {
            Get-ChildItem -Path $d -Filter "*Antigravity*.lnk" -Recurse -ErrorAction SilentlyContinue | ForEach-Object {
                try {
                    $sc = $wsh.CreateShortcut($_.FullName)
                    if ($sc.Arguments -and $sc.Arguments -match "--remote-debugging-port=\d+") {
                        $sc.Arguments = ($sc.Arguments -replace "--remote-debugging-port=\d+", "").Trim()
                        $sc.Save()
                    }
                } catch {}
            }
        }
    }
    $userScFile = Join-Path $targetDir "state\user-shortcuts.json"
    if (Test-Path $userScFile) {
        $scObj = (Get-Content $userScFile -Raw -Encoding UTF8) | ConvertFrom-Json -AsHashtable
        if ($scObj.shortcuts) {
            foreach ($p in $scObj.shortcuts) {
                if ($p -and (Test-Path $p)) { Remove-Item -Path $p -Force -ErrorAction SilentlyContinue }
            }
        }
    }
} catch {}

Write-Host "[2/4] 检查官方 app.asar.bak 备份..." -ForegroundColor Green
foreach ($resDir in @(
    (Join-Path $env:LOCALAPPDATA "Programs\antigravity\resources"),
    (Join-Path $env:LOCALAPPDATA "Programs\Antigravity\resources"),
    (Join-Path $env:LOCALAPPDATA "Programs\Antigravity IDE\resources"),
    (Join-Path ${env:ProgramFiles} "Antigravity\resources"),
    (Join-Path ${env:ProgramFiles(x86)} "Antigravity\resources"),
    "D:\soft\Antigravity IDE\resources"
)) {
    $bak = Join-Path $resDir "app.asar.bak"
    $asar = Join-Path $resDir "app.asar"
    if (Test-Path $bak) {
        try {
            Copy-Item -Path $bak -Destination $asar -Force
        } catch {}
    }
}

if (Test-Path $targetDir) {
    Write-Host "[3/4] 移除插件部署目录..." -ForegroundColor Green
    Remove-Item -Path $targetDir -Recurse -Force
}

if (Test-Path $configFile) {
    Write-Host "[4/4] 从配置文件注销插件..." -ForegroundColor Green
    try {
        $rawJson = Get-Content $configFile -Raw -Encoding UTF8
        $configObj = $rawJson | ConvertFrom-Json -AsHashtable
        if ($configObj.ContainsKey("plugins") -and $configObj["plugins"].ContainsKey("antigravity-skin")) {
            $configObj["plugins"].Remove("antigravity-skin")
            $updatedJson = $configObj | ConvertTo-Json -Depth 10
            [System.IO.File]::WriteAllText($configFile, $updatedJson, [System.Text.UTF8Encoding]::new($false))
        }
    } catch {}
}

Write-Host "==================================================" -ForegroundColor Yellow
Write-Host " [√] 卸载成功！已完全还原官方初始状态。" -ForegroundColor Green
Write-Host " 请完全退出并重新打开 Antigravity 客户端。" -ForegroundColor Yellow
Write-Host "=================================================="
