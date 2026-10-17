# Antigravity Skin - Windows 一键安装脚本
$ErrorActionPreference = "Stop"

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "  正在安装 Antigravity 主题与皮肤插件..." -ForegroundColor Cyan
Write-Host "=================================================="

$scriptDir = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Definition }

# 模式 A：本地已有解压文件且系统已安装 node
if ($scriptDir -and (Test-Path (Join-Path $scriptDir "scripts\install.mjs"))) {
    if (Get-Command node -ErrorAction SilentlyContinue) {
        node --experimental-websocket (Join-Path $scriptDir "scripts\install.mjs")
        exit 0
    }
}

# 模式 B：通过管道远程一行命令执行 (irm ... | iex)，或者机器上无可用 node 环境
$homeDir = [System.Environment]::GetFolderPath('UserProfile')
$targetDir = Join-Path $homeDir ".gemini\config\plugins\antigravity-skin"
$configFile = Join-Path $homeDir ".gemini\config\config.json"
$pluginsDir = Join-Path $homeDir ".gemini\config\plugins"

if (-not (Test-Path $pluginsDir)) {
    New-Item -ItemType Directory -Force -Path $pluginsDir | Out-Null
}

$sourceRoot = $scriptDir
$tempCleanup = $false
$tempZip = Join-Path $env:TEMP "antigravity-skin-latest.zip"
$tempExtract = Join-Path $env:TEMP "antigravity-skin-extracted"

if (-not $sourceRoot -or -not (Test-Path (Join-Path $sourceRoot "plugin.json"))) {
    Write-Host "[1/3] 检测到在线安装模式，正在下载最新 Release 安装包..." -ForegroundColor Yellow
    $zipUrl = "https://github.com/MrcolorH/antigravity-skin/releases/latest/download/antigravity-skin.zip"
    try {
        Invoke-WebRequest -Uri $zipUrl -OutFile $tempZip -UseBasicParsing
    } catch {
        # 如果尚未发布 release，回退至主分支归档
        $zipUrl = "https://github.com/MrcolorH/antigravity-skin/archive/refs/heads/main.zip"
        Invoke-WebRequest -Uri $zipUrl -OutFile $tempZip -UseBasicParsing
    }

    if (Test-Path $tempExtract) { Remove-Item -Recurse -Force $tempExtract }
    Expand-Archive -Path $tempZip -DestinationPath $tempExtract -Force
    $sourceRoot = $tempExtract
    $subDir = Get-ChildItem -Path $tempExtract -Directory | Select-Object -First 1
    if ($subDir -and (Test-Path (Join-Path $subDir.FullName "plugin.json"))) {
        $sourceRoot = $subDir.FullName
    }
    $tempCleanup = $true
}

try {
    Write-Host "[2/3] 部署插件运行环境至 $targetDir..." -ForegroundColor Green
    if (-not (Test-Path $targetDir)) {
        New-Item -ItemType Directory -Force -Path $targetDir | Out-Null
    }

    # 保护已有个性化配置
    $userCfgPath = Join-Path $targetDir "config\config.json"
    $savedUserCfg = if (Test-Path $userCfgPath) { Get-Content $userCfgPath -Raw -Encoding UTF8 } else { $null }

    # 白名单实体复制（装完后用户可以随意删除解压目录）
    $whitelistDirs = @("client", "sidecars", "assets", "scripts")
    $whitelistFiles = @("plugin.json", "config.default.json", "package.json", "README.md", "install.bat", "uninstall.bat", "install.ps1", "uninstall.ps1", "install.sh", "uninstall.sh", "patch-loading.bat", "restore-loading.bat")

    foreach ($dir in $whitelistDirs) {
        $srcPath = Join-Path $sourceRoot $dir
        $destPath = Join-Path $targetDir $dir
        if (Test-Path $srcPath) {
            Copy-Item -Path $srcPath -Destination $targetDir -Recurse -Force
        }
    }

    foreach ($file in $whitelistFiles) {
        $srcFile = Join-Path $sourceRoot $file
        if (Test-Path $srcFile) {
            Copy-Item -Path $srcFile -Destination $targetDir -Force
        }
    }

    # 恢复或初始化配置
    $targetCfgDir = Join-Path $targetDir "config"
    if (-not (Test-Path $targetCfgDir)) { New-Item -ItemType Directory -Force -Path $targetCfgDir | Out-Null }
    if ($savedUserCfg) {
        Set-Content -Path $userCfgPath -Value $savedUserCfg -Encoding UTF8
    } elseif (-not (Test-Path $userCfgPath)) {
        $defaultCfg = Join-Path $targetDir "config.default.json"
        if (Test-Path $defaultCfg) { Copy-Item -Path $defaultCfg -Destination $userCfgPath -Force }
    }

    Write-Host "[3/3] 注册并启用插件状态..." -ForegroundColor Green
    $configObj = @{}
    if (Test-Path $configFile) {
        try {
            $rawJson = Get-Content $configFile -Raw -Encoding UTF8
            $configObj = $rawJson | ConvertFrom-Json -AsHashtable
        } catch {}
    }
    if (-not $configObj.ContainsKey("plugins")) {
        $configObj["plugins"] = @{}
    }
    $configObj["plugins"]["antigravity-skin"] = @{ "enabled" = $true }
    $updatedJson = $configObj | ConvertTo-Json -Depth 10
    Set-Content -Path $configFile -Value $updatedJson -Encoding UTF8

    # 4. Windows 开机动画引擎自动配置（若 Node.js 可用）
    $patchScript = Join-Path $targetDir "scripts\patch-boot-overlay.mjs"
    if (Test-Path $patchScript) {
        if (Get-Command node -ErrorAction SilentlyContinue) {
            try {
                Write-Host "[4/4] 正在配置 Windows 客户端前置开机动画引擎 (零闪白溶出)..." -ForegroundColor Green
                node $patchScript
            } catch {
                Write-Host "  ⚠️ 开机动画补丁未能在安装时自动合入（通常因客户端正在运行中）。" -ForegroundColor Yellow
                Write-Host "     👉 请完全退出 Antigravity 客户端后，双击执行 patch-loading.bat 即可一键完成升级！" -ForegroundColor Yellow
            }
        }
    }

    Write-Host "==================================================" -ForegroundColor Cyan
    Write-Host " [√] 安装部署完成！" -ForegroundColor Green
    Write-Host " 插件已部署至: $targetDir" -ForegroundColor Cyan
    Write-Host "--------------------------------------------------" -ForegroundColor DarkGray
    Write-Host " 🔔 重要提示：" -ForegroundColor Yellow
    Write-Host " 插件核心文件已全部复制到上述持久化目录。" -ForegroundColor Yellow
    Write-Host " 当前解压出来的安装包文件夹【已不需要，请直接删除】！" -ForegroundColor Yellow
    Write-Host " 本地无需保留任何多余文件，完全不影响插件正常运行。" -ForegroundColor Yellow
    Write-Host "--------------------------------------------------" -ForegroundColor DarkGray
    Write-Host " 🎬 Windows 开机动画专属提示：" -ForegroundColor Magenta
    Write-Host " 若需彻底消除官方 Logo 呼吸动画并使用自定义开机动画：" -ForegroundColor Magenta
    Write-Host " 请先完全退出 Antigravity 客户端，然后随时双击运行 patch-loading.bat！" -ForegroundColor Magenta
    Write-Host " 如需恢复官方原版开机动画，可随时双击 restore-loading.bat。" -ForegroundColor DarkGray
    Write-Host "--------------------------------------------------" -ForegroundColor DarkGray
    Write-Host " 请完全退出并重新打开 Antigravity 客户端即可生效！" -ForegroundColor Cyan
    Write-Host "==================================================" -ForegroundColor Cyan
} finally {
    if ($tempCleanup) {
        Remove-Item -Path $tempZip -Force -ErrorAction SilentlyContinue
        Remove-Item -Path $tempExtract -Recurse -Force -ErrorAction SilentlyContinue
    }
}
