/**
 * platform-host.mjs - 跨平台零改包启动器、快捷方式与原版客户端寻址共享底座
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync, execFileSync } from 'node:child_process';

export const BOOT_PATCH_MARKER = 'agy-video-boot-host';
export const MAC_LAUNCHER_BUNDLE_ID = 'com.antigravity-skin.launcher';
export const MAC_OFFICIAL_BUNDLE_ID = 'com.google.antigravity';
export const LSREGISTER_PATH = '/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister';

export function getDefaultPluginRoot(home = os.homedir()) {
  return path.join(home, '.gemini', 'config', 'plugins', 'antigravity-skin');
}

export function getMacIsolationPaths(home = os.homedir()) {
  const isolationDir = path.join(home, 'Library', 'Application Support', 'AntigravitySkin.noindex');
  const isolatedApp = path.join(isolationDir, 'Antigravity.app');
  const systemAppsApp = '/Applications/Antigravity.app';
  const userAppsApp = path.join(home, 'Applications', 'Antigravity.app');
  const keepOriginalLauncher = path.join(home, 'Applications', 'Antigravity Skin.app');
  return {
    isolationDir,
    isolatedApp,
    systemAppsApp,
    userAppsApp,
    keepOriginalLauncher
  };
}

export function writeJsonAtomic(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmpFile = `${filePath}.tmp.${process.pid}.${Date.now()}`;
  const json = JSON.stringify(data, null, 2);
  fs.writeFileSync(tmpFile, json, 'utf8');
  try {
    fs.renameSync(tmpFile, filePath);
  } catch (_) {
    fs.copyFileSync(tmpFile, filePath);
    try { fs.unlinkSync(tmpFile); } catch (__) {}
  }
}

export function readJsonSafe(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, ''));
  } catch (_) {
    return null;
  }
}

export function updateKernelInjectionConfig(enabled, pluginRoot = getDefaultPluginRoot()) {
  const cfgPath = path.join(pluginRoot, 'config', 'config.json');
  const defPath = path.join(pluginRoot, 'config.default.json');
  const cfg = readJsonSafe(cfgPath) || readJsonSafe(defPath) || { enabled: true, features: {} };
  if (!cfg.features || typeof cfg.features !== 'object') cfg.features = {};
  cfg.features.kernelInjection = !!enabled;
  writeJsonAtomic(cfgPath, cfg);
  return cfg;
}

export function getMacBundleId(appBundlePath) {
  if (!appBundlePath) return '';
  try {
    const plistPath = path.join(appBundlePath, 'Contents', 'Info.plist');
    if (!fs.existsSync(plistPath)) return '';
    const plist = fs.readFileSync(plistPath, 'utf8');
    const m = plist.match(/<key>CFBundleIdentifier<\/key>\s*<string>([^<]+)<\/string>/);
    return m ? m[1].trim() : '';
  } catch (_) {
    return '';
  }
}

export function isLauncherAppBundle(appBundlePath) {
  if (!appBundlePath || !fs.existsSync(appBundlePath)) return false;
  if (getMacBundleId(appBundlePath) === MAC_LAUNCHER_BUNDLE_ID) return true;
  return fs.existsSync(path.join(appBundlePath, 'Contents', 'Resources', '.agy-launcher-marker'));
}

export function findMacOriginalAppBundle({ home = os.homedir(), extraBundles = [] } = {}) {
  const { isolatedApp, systemAppsApp, userAppsApp } = getMacIsolationPaths(home);
  const candidates = [...extraBundles, isolatedApp, systemAppsApp, userAppsApp];
  for (const appPath of candidates) {
    try {
      if (!appPath || !fs.existsSync(appPath)) continue;
      if (isLauncherAppBundle(appPath)) continue;
      const asar = path.join(appPath, 'Contents', 'Resources', 'app.asar');
      const bak = path.join(appPath, 'Contents', 'Resources', 'app.asar.bak');
      if (fs.existsSync(asar) || fs.existsSync(bak)) {
        return appPath;
      }
    } catch (_) {}
  }
  return null;
}

export function findAllOriginalResourcesDirs({
  platform = process.platform,
  home = os.homedir(),
  env = process.env,
  includeBackupOnly = false
} = {}) {
  const candidates = [];
  if (platform === 'darwin') {
    const { isolatedApp, systemAppsApp, userAppsApp } = getMacIsolationPaths(home);
    for (const appPath of [isolatedApp, systemAppsApp, userAppsApp]) {
      if (fs.existsSync(appPath) && !isLauncherAppBundle(appPath)) {
        candidates.push(path.join(appPath, 'Contents', 'Resources'));
      }
    }
  } else if (platform === 'win32') {
    const localAppData = env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');
    const programFiles = env.ProgramFiles || 'C:\\Program Files';
    const programFilesX86 = env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
    candidates.push(
      path.join(localAppData, 'Programs', 'antigravity', 'resources'),
      path.join(localAppData, 'Programs', 'Antigravity', 'resources'),
      path.join(localAppData, 'Programs', 'Antigravity IDE', 'resources'),
      path.join(programFiles, 'Antigravity', 'resources'),
      path.join(programFiles, 'Antigravity IDE', 'resources'),
      path.join(programFilesX86, 'Antigravity', 'resources'),
      'D:\\soft\\Antigravity IDE\\resources'
    );
  } else {
    candidates.push(
      '/usr/lib/antigravity/resources',
      '/opt/Antigravity/resources',
      '/opt/antigravity/resources',
      path.join(home, '.local', 'share', 'antigravity', 'resources')
    );
  }

  const found = [];
  const seen = new Set();
  for (const dir of candidates) {
    try {
      const asar = path.join(dir, 'app.asar');
      const bak = path.join(dir, 'app.asar.bak');
      if (!fs.existsSync(asar) && !(includeBackupOnly && fs.existsSync(bak))) continue;
      let key = dir;
      if (platform === 'win32') {
        try { key = fs.realpathSync.native(dir).toLowerCase(); } catch (_) { key = dir.toLowerCase(); }
      }
      if (seen.has(key)) continue;
      seen.add(key);
      found.push(dir);
    } catch (_) {}
  }
  return found;
}

export function findOriginalResourcesDir(opts = {}) {
  return findAllOriginalResourcesDirs(opts)[0] || null;
}

export function detectAsarPatchState(asarPath, readFileRawFn = null) {
  if (!asarPath || !fs.existsSync(asarPath)) {
    return { bootMarkerPresent: false, hasRemoteDebugSwitch: false, patched: false };
  }
  try {
    const buf = typeof readFileRawFn === 'function' ? readFileRawFn(asarPath) : fs.readFileSync(asarPath);
    const bootMarkerPresent = buf.includes(BOOT_PATCH_MARKER);
    const hasRemoteDebugSwitch = buf.includes("appendSwitch('remote-debugging-port'");
    return {
      bootMarkerPresent,
      hasRemoteDebugSwitch,
      patched: bootMarkerPresent || hasRemoteDebugSwitch
    };
  } catch (_) {
    return { bootMarkerPresent: false, hasRemoteDebugSwitch: false, patched: false };
  }
}

export function runPowerShellScript(scriptText) {
  const tmp = path.join(os.tmpdir(), `agy-ps-${process.pid}-${Date.now()}.ps1`);
  fs.writeFileSync(tmp, '\ufeff' + scriptText, 'utf8');
  try {
    return execFileSync('powershell.exe', [
      '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', tmp
    ], {
      encoding: 'utf8',
      windowsHide: true
    }).trim();
  } finally {
    try { fs.unlinkSync(tmp); } catch (_) {}
  }
}

export function patchWindowsShortcuts({ pluginRoot = getDefaultPluginRoot() } = {}) {
  if (process.platform !== 'win32') {
    return { ok: true, updated: 0, userCreated: 0, skippedReadOnly: 0 };
  }

  const stateFile = path.join(pluginRoot, 'state', 'user-shortcuts.json');
  const existingState = readJsonSafe(stateFile) || { created: [] };
  const psScript = `
$ErrorActionPreference = 'SilentlyContinue'
$wsh = New-Object -ComObject WScript.Shell
$userDesktop = [Environment]::GetFolderPath('Desktop')
$userPrograms = [Environment]::GetFolderPath('Programs')
$commonDesktop = [Environment]::GetFolderPath('CommonDesktopDirectory')
$commonPrograms = [Environment]::GetFolderPath('CommonPrograms')
$taskbar = Join-Path ([Environment]::GetFolderPath('ApplicationData')) 'Microsoft\\Internet Explorer\\Quick Launch\\User Pinned\\TaskBar'

$dirs = @($userDesktop, $userPrograms, $commonDesktop, $commonPrograms, $taskbar) | Where-Object { $_ -and (Test-Path $_) }
$updated = 0
$skippedReadOnly = 0
$readOnlyTargets = New-Object System.Collections.Generic.List[string]

foreach ($d in $dirs) {
  Get-ChildItem -Path $d -Filter "*Antigravity*.lnk" -Recurse | ForEach-Object {
    try {
      $sc = $wsh.CreateShortcut($_.FullName)
      if ($sc.TargetPath -and $sc.TargetPath.ToLower().Contains("antigravity")) {
        if ($sc.Arguments -notmatch "remote-debugging-port") {
          $sc.Arguments = ($sc.Arguments + " --remote-debugging-port=0").Trim()
          try {
            $sc.Save()
            $updated++
          } catch {
            $skippedReadOnly++
            if (-not $readOnlyTargets.Contains($sc.TargetPath)) {
              $readOnlyTargets.Add($sc.TargetPath)
            }
          }
        }
      }
    } catch {}
  }
}

$userCreated = New-Object System.Collections.Generic.List[string]
foreach ($targetExe in $readOnlyTargets) {
  if ($targetExe -and (Test-Path $targetExe)) {
    foreach ($uDir in @($userDesktop, $userPrograms)) {
      if ($uDir -and (Test-Path $uDir)) {
        $lnkPath = Join-Path $uDir "Antigravity (Skin).lnk"
        if (-not (Test-Path $lnkPath)) {
          try {
            $sc = $wsh.CreateShortcut($lnkPath)
            $sc.TargetPath = $targetExe
            $sc.Arguments = "--remote-debugging-port=0"
            $sc.WorkingDirectory = Split-Path -Parent $targetExe
            $sc.IconLocation = "$targetExe,0"
            $sc.Description = "Antigravity Skin Launcher"
            $sc.Save()
            $userCreated.Add($lnkPath)
          } catch {}
        }
      }
    }
  }
}

@{
  updated = $updated
  skippedReadOnly = $skippedReadOnly
  created = @($userCreated)
} | ConvertTo-Json -Compress
`;
  try {
    const out = runPowerShellScript(psScript);
    const res = out ? JSON.parse(out) : { updated: 0, skippedReadOnly: 0, created: [] };
    const createdList = Array.isArray(res.created) ? res.created : (res.created ? [res.created] : []);
    if (createdList.length > 0) {
      const merged = Array.from(new Set([...(existingState.created || []), ...createdList]));
      writeJsonAtomic(stateFile, { created: merged });
    }
    return {
      ok: true,
      updated: Number(res.updated) || 0,
      skippedReadOnly: Number(res.skippedReadOnly) || 0,
      userCreated: createdList.length
    };
  } catch (err) {
    return { ok: false, updated: 0, userCreated: 0, skippedReadOnly: 0, error: err.message };
  }
}

export function restoreWindowsShortcuts({ pluginRoot = getDefaultPluginRoot() } = {}) {
  if (process.platform !== 'win32') return { ok: true, cleaned: 0 };
  const stateFile = path.join(pluginRoot, 'state', 'user-shortcuts.json');
  const existingState = readJsonSafe(stateFile) || { created: [] };
  const createdJson = JSON.stringify(Array.isArray(existingState.created) ? existingState.created : []);
  const psScript = `
$ErrorActionPreference = 'SilentlyContinue'
$wsh = New-Object -ComObject WScript.Shell
$userDesktop = [Environment]::GetFolderPath('Desktop')
$userPrograms = [Environment]::GetFolderPath('Programs')
$commonDesktop = [Environment]::GetFolderPath('CommonDesktopDirectory')
$commonPrograms = [Environment]::GetFolderPath('CommonPrograms')
$taskbar = Join-Path ([Environment]::GetFolderPath('ApplicationData')) 'Microsoft\\Internet Explorer\\Quick Launch\\User Pinned\\TaskBar'
$dirs = @($userDesktop, $userPrograms, $commonDesktop, $commonPrograms, $taskbar) | Where-Object { $_ -and (Test-Path $_) }
$cleaned = 0

foreach ($d in $dirs) {
  Get-ChildItem -Path $d -Filter "*Antigravity*.lnk" -Recurse | ForEach-Object {
    try {
      $sc = $wsh.CreateShortcut($_.FullName)
      if ($sc.Arguments -and $sc.Arguments -match "--remote-debugging-port=\\d+") {
        $sc.Arguments = ($sc.Arguments -replace "\\s*--remote-debugging-port=\\d+", "").Trim()
        $sc.Save()
        $cleaned++
      }
    } catch {}
  }
}

$createdPaths = ConvertFrom-Json '${createdJson.replace(/'/g, "''")}'
foreach ($cp in $createdPaths) {
  if ($cp -and (Test-Path $cp)) {
    try { Remove-Item -Path $cp -Force; $cleaned++ } catch {}
  }
}
$cleaned
`;
  try {
    const out = runPowerShellScript(psScript);
    try { if (fs.existsSync(stateFile)) fs.unlinkSync(stateFile); } catch (_) {}
    return { ok: true, cleaned: parseInt(out, 10) || 0 };
  } catch (err) {
    return { ok: false, cleaned: 0, error: err.message };
  }
}

export function extractPlistArraySection(plistContent, keyName) {
  if (typeof plistContent !== 'string' || !plistContent || !keyName) return '';
  const escapedKey = keyName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const startMatch = new RegExp(`<key>${escapedKey}</key>\\s*<array>`, 'm').exec(plistContent);
  if (!startMatch) return '';

  const sectionStart = startMatch.index;
  const openTagEnd = startMatch.index + startMatch[0].length;
  let depth = 1;
  const tagRe = /<\/?array>/g;
  tagRe.lastIndex = openTagEnd;

  let m;
  while ((m = tagRe.exec(plistContent)) !== null) {
    if (m[0] === '<array>') depth++;
    else depth--;
    if (depth === 0) {
      return plistContent.slice(sectionStart, m.index + m[0].length);
    }
  }
  return '';
}

export function buildMacLauncherAppleScript(targetAppPath) {
  const escaped = String(targetAppPath).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return [
    `property realAppPath : "${escaped}"`,
    '',
    'on ensureTargetExists()',
    '  try',
    '    do shell script "test -d " & quoted form of realAppPath',
    '    return true',
    '  on error',
    '    display dialog "未找到 Antigravity 官方主程序，请确认文件未被删除或重新安装插件恢复。\\n\\n预期路径: " & realAppPath with title "Antigravity Skin" buttons {"确定"} default button 1',
    '    return false',
    '  end try',
    'end ensureTargetExists',
    '',
    'on run',
    '  if not ensureTargetExists() then return',
    '  do shell script "open -a " & quoted form of realAppPath & " --args --remote-debugging-port=0 >/dev/null 2>&1 &"',
    'end run',
    '',
    'on open theItems',
    '  if not ensureTargetExists() then return',
    '  set itemArgs to ""',
    '  repeat with anItem in theItems',
    '    set itemArgs to itemArgs & " " & quoted form of (POSIX path of anItem)',
    '  end repeat',
    '  do shell script "open -a " & quoted form of realAppPath & itemArgs & " --args --remote-debugging-port=0 >/dev/null 2>&1 &"',
    'end open',
    '',
    'on open location theUrl',
    '  if not ensureTargetExists() then return',
    '  do shell script "open -a " & quoted form of realAppPath & " " & quoted form of theUrl & " --args --remote-debugging-port=0 >/dev/null 2>&1 &"',
    'end open location'
  ].join('\n');
}

export function buildMacLauncherInfoPlist(originalPlistContent, { name = 'Antigravity', version = '1.0.0' } = {}) {
  const docTypes = extractPlistArraySection(originalPlistContent, 'CFBundleDocumentTypes');
  const urlTypes = extractPlistArraySection(originalPlistContent, 'CFBundleURLTypes');
  const verMatch = originalPlistContent?.match(/<key>CFBundleShortVersionString<\/key>\s*<string>([^<]+)<\/string>/);
  const shortVer = verMatch ? verMatch[1].trim() : version;
  const iconMatch = originalPlistContent?.match(/<key>CFBundleIconFile<\/key>\s*<string>([^<]+)<\/string>/);
  const iconFile = iconMatch ? iconMatch[1].trim() : 'AppIcon';

  const extraSections = [docTypes, urlTypes].filter(Boolean).map(s => '  ' + s.replace(/\n/g, '\n  ')).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDevelopmentRegion</key>
  <string>en</string>
  <key>CFBundleExecutable</key>
  <string>applet</string>
  <key>CFBundleIconFile</key>
  <string>${iconFile}</string>
  <key>CFBundleIdentifier</key>
  <string>${MAC_LAUNCHER_BUNDLE_ID}</string>
  <key>CFBundleInfoDictionaryVersion</key>
  <string>6.0</string>
  <key>CFBundleName</key>
  <string>${name}</string>
  <key>CFBundleDisplayName</key>
  <string>${name}</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>${shortVer}</string>
  <key>CFBundleVersion</key>
  <string>${shortVer}</string>
  <key>LSMinimumSystemVersion</key>
  <string>11.0</string>
  <key>LSUIElement</key>
  <true/>
  <key>NSHighResolutionCapable</key>
  <true/>
${extraSections ? extraSections + '\n' : ''}</dict>
</plist>
`;
}

export function isMacAppRunning() {
  if (process.platform !== 'darwin') return false;
  try {
    const out = execSync('pgrep -f "/[A]ntigravity\\.app/Contents/"', { encoding: 'utf8' }).trim();
    return Boolean(out);
  } catch (_) {
    return false;
  }
}

export function syncMacManualReinstallIfNeeded({ home = os.homedir(), isInsideHost = false } = {}) {
  if (process.platform !== 'darwin') return { synced: false };
  const { isolatedApp, systemAppsApp } = getMacIsolationPaths(home);
  if (fs.existsSync(systemAppsApp) && !isLauncherAppBundle(systemAppsApp) && fs.existsSync(isolatedApp)) {
    if (isInsideHost) {
      return { synced: false, deferred: 'inside_host' };
    }
    try {
      fs.rmSync(isolatedApp, { recursive: true, force: true });
      return { synced: true, removedStaleIsolated: true };
    } catch (_) {
      return { synced: false };
    }
  }
  return { synced: false };
}

function moveMacAppSafely(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  try {
    fs.renameSync(src, dest);
    return true;
  } catch (_) {}
  try {
    execFileSync('mv', [src, dest], { stdio: 'ignore' });
    return true;
  } catch (_) {}
  try {
    const cmd = `do shell script "mkdir -p " & quoted form of "${path.dirname(dest)}" & " && mv " & quoted form of "${src}" & " " & quoted form of "${dest}" with administrator privileges`;
    execFileSync('osascript', ['-e', cmd], { stdio: 'ignore' });
    return true;
  } catch (_) {
    return false;
  }
}

function writeMacCliBin(targetLauncherOrApp) {
  try {
    const binDir = path.join(os.homedir(), '.local', 'bin');
    fs.mkdirSync(binDir, { recursive: true });
    const cliFile = path.join(binDir, 'antigravity');
    const escapedTarget = targetLauncherOrApp.replace(/"/g, '\\"');
    const content = [
      '#!/usr/bin/env bash',
      `REAL_OR_LAUNCHER="${escapedTarget}"`,
      'if [ -d "$REAL_OR_LAUNCHER" ]; then',
      '  open -a "$REAL_OR_LAUNCHER" "$@" --args --remote-debugging-port=0 2>/dev/null',
      'else',
      '  open -a Antigravity "$@" --args --remote-debugging-port=0 2>/dev/null || open -b com.google.antigravity "$@" --args --remote-debugging-port=0 2>/dev/null',
      'fi',
      ''
    ].join('\n');
    fs.writeFileSync(cliFile, content, 'utf8');
    fs.chmodSync(cliFile, 0o755);
  } catch (_) {}
}

export function setupMacZeroPatchLauncher({
  mode = 'isolate',
  home = os.homedir(),
  isInsideHost = false
} = {}) {
  if (process.platform !== 'darwin') return { ok: true, mode };
  const { isolationDir, isolatedApp, systemAppsApp, userAppsApp, keepOriginalLauncher } = getMacIsolationPaths(home);

  syncMacManualReinstallIfNeeded({ home, isInsideHost });

  let effectiveMode = mode === 'keep_original' ? 'keep_original' : 'isolate';
  let realAppPath = findMacOriginalAppBundle({ home });
  if (!realAppPath) {
    return { ok: false, reason: 'not_installed' };
  }

  if (effectiveMode === 'isolate') {
    if (realAppPath === systemAppsApp || realAppPath === userAppsApp) {
      if (isInsideHost && isMacAppRunning()) {
        return { ok: false, deferred: 'inside_host', mode: effectiveMode, realAppPath };
      }
      if (fs.existsSync(isolatedApp)) {
        fs.rmSync(isolatedApp, { recursive: true, force: true });
      }
      const moved = moveMacAppSafely(realAppPath, isolatedApp);
      if (moved && fs.existsSync(isolatedApp)) {
        realAppPath = isolatedApp;
      } else {
        effectiveMode = 'keep_original';
      }
    }
  } else {
    // 切换为 keep_original 时，若后台存在隔离原版且 /Applications/Antigravity.app 是启动器或不存在，先移回
    if (fs.existsSync(isolatedApp)) {
      if (isLauncherAppBundle(systemAppsApp)) {
        fs.rmSync(systemAppsApp, { recursive: true, force: true });
      }
      if (!fs.existsSync(systemAppsApp) && moveMacAppSafely(isolatedApp, systemAppsApp)) {
        realAppPath = systemAppsApp;
      }
    }
  }

  const launcherPath = effectiveMode === 'isolate' ? systemAppsApp : keepOriginalLauncher;
  const origPlistPath = path.join(realAppPath, 'Contents', 'Info.plist');
  const origPlist = fs.existsSync(origPlistPath) ? fs.readFileSync(origPlistPath, 'utf8') : '';

  const tmpSrc = path.join(os.tmpdir(), `agy-launcher-${Date.now()}.applescript`);
  const tmpOutApp = path.join(os.tmpdir(), `agy-launcher-${Date.now()}.app`);
  try {
    fs.writeFileSync(tmpSrc, buildMacLauncherAppleScript(realAppPath), 'utf8');
    execFileSync('osacompile', ['-o', tmpOutApp, tmpSrc], { stdio: 'ignore' });

    // 复制原版图标
    const origResDir = path.join(realAppPath, 'Contents', 'Resources');
    const outResDir = path.join(tmpOutApp, 'Contents', 'Resources');
    fs.mkdirSync(outResDir, { recursive: true });
    if (fs.existsSync(origResDir)) {
      for (const f of fs.readdirSync(origResDir)) {
        if (f.endsWith('.icns')) {
          try { fs.copyFileSync(path.join(origResDir, f), path.join(outResDir, f)); } catch (_) {}
        }
      }
    }
    fs.writeFileSync(path.join(outResDir, '.agy-launcher-marker'), MAC_LAUNCHER_BUNDLE_ID, 'utf8');
    fs.writeFileSync(
      path.join(tmpOutApp, 'Contents', 'Info.plist'),
      buildMacLauncherInfoPlist(origPlist, { name: effectiveMode === 'isolate' ? 'Antigravity' : 'Antigravity Skin' }),
      'utf8'
    );
    try { execFileSync('xattr', ['-cr', tmpOutApp], { stdio: 'ignore' }); } catch (_) {}

    if (fs.existsSync(launcherPath)) {
      if (!isLauncherAppBundle(launcherPath)) {
        return { ok: false, reason: 'target_occupied_by_real_app', mode: effectiveMode };
      }
      fs.rmSync(launcherPath, { recursive: true, force: true });
    }

    if (!moveMacAppSafely(tmpOutApp, launcherPath)) {
      fs.mkdirSync(path.dirname(keepOriginalLauncher), { recursive: true });
      moveMacAppSafely(tmpOutApp, keepOriginalLauncher);
      effectiveMode = 'keep_original';
    }

    const finalLauncher = effectiveMode === 'isolate' ? launcherPath : keepOriginalLauncher;
    try { execFileSync('xattr', ['-cr', finalLauncher], { stdio: 'ignore' }); } catch (_) {}

    if (fs.existsSync(LSREGISTER_PATH)) {
      if (effectiveMode === 'isolate' && fs.existsSync(isolatedApp)) {
        try { execFileSync(LSREGISTER_PATH, ['-u', isolatedApp], { stdio: 'ignore' }); } catch (_) {}
      }
      try { execFileSync(LSREGISTER_PATH, ['-f', finalLauncher], { stdio: 'ignore' }); } catch (_) {}
    }

    writeMacCliBin(realAppPath);
    return {
      ok: true,
      mode: effectiveMode,
      realAppPath,
      launcherPath: finalLauncher,
      isolationDir
    };
  } finally {
    try { fs.unlinkSync(tmpSrc); } catch (_) {}
    try { if (fs.existsSync(tmpOutApp)) fs.rmSync(tmpOutApp, { recursive: true, force: true }); } catch (_) {}
  }
}

export function teardownMacZeroPatchLauncher({ home = os.homedir() } = {}) {
  if (process.platform !== 'darwin') return { ok: true };
  const { isolationDir, isolatedApp, systemAppsApp, keepOriginalLauncher } = getMacIsolationPaths(home);

  try {
    if (fs.existsSync(keepOriginalLauncher) && isLauncherAppBundle(keepOriginalLauncher)) {
      fs.rmSync(keepOriginalLauncher, { recursive: true, force: true });
    }
    if (fs.existsSync(systemAppsApp) && isLauncherAppBundle(systemAppsApp)) {
      fs.rmSync(systemAppsApp, { recursive: true, force: true });
    }
    if (fs.existsSync(isolatedApp) && !fs.existsSync(systemAppsApp)) {
      moveMacAppSafely(isolatedApp, systemAppsApp);
    }
    try {
      if (fs.existsSync(isolationDir) && fs.readdirSync(isolationDir).length === 0) {
        fs.rmdirSync(isolationDir);
      }
    } catch (_) {}
    if (fs.existsSync(LSREGISTER_PATH) && fs.existsSync(systemAppsApp)) {
      try { execFileSync(LSREGISTER_PATH, ['-f', systemAppsApp], { stdio: 'ignore' }); } catch (_) {}
    }
    const cliFile = path.join(home, '.local', 'bin', 'antigravity');
    if (fs.existsSync(cliFile)) {
      try { fs.unlinkSync(cliFile); } catch (_) {}
    }
    return { ok: true, restoredPath: fs.existsSync(systemAppsApp) ? systemAppsApp : '' };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

export function resolveMacLaunchTarget(resourcesDir = '', { home = os.homedir() } = {}) {
  const { isolatedApp, systemAppsApp, keepOriginalLauncher } = getMacIsolationPaths(home);
  if (fs.existsSync(systemAppsApp) && isLauncherAppBundle(systemAppsApp)) {
    return { target: systemAppsApp, isLauncher: true };
  }
  if (fs.existsSync(keepOriginalLauncher) && isLauncherAppBundle(keepOriginalLauncher)) {
    return { target: keepOriginalLauncher, isLauncher: true };
  }
  if (resourcesDir) {
    const candidate = path.resolve(resourcesDir, '..', '..');
    if (candidate.endsWith('.app') && fs.existsSync(candidate)) {
      return { target: candidate, isLauncher: false };
    }
  }
  const orig = findMacOriginalAppBundle({ home, extraBundles: [isolatedApp] });
  return { target: orig || systemAppsApp, isLauncher: false };
}
