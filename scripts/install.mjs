import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import { execSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { migrateLegacyPulse } from './migrate-pulse.mjs';
import {
  findOriginalResourcesDir,
  detectAsarPatchState,
  patchWindowsShortcuts,
  setupMacZeroPatchLauncher,
  resolveMacLaunchTarget,
  writeJsonAtomic,
  readJsonSafe,
  runPowerShellScript
} from './platform-host.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

const home = os.homedir();
const pluginsDir = path.join(home, '.gemini', 'config', 'plugins');
const targetPluginDir = path.join(pluginsDir, 'antigravity-skin');
const configFile = path.join(home, '.gemini', 'config', 'config.json');

console.log('==================================================');
console.log('  正在安装与优化 Antigravity 主题与皮肤插件...');
console.log('==================================================');

let detectedExePath = null;
const isInsideAntigravityHost = !!(process.env.ANTIGRAVITY_LS_ADDRESS || process.env.ANTIGRAVITY_CSRF_TOKEN);
const WITH_KERNEL_INJECTION = process.argv.includes('--with-kernel-injection');

// 0. 自动退出运行中的客户端及后台语言服务以解除文件锁定并杜绝配置覆写竞态
function ensureProcessClosed() {
  if (isInsideAntigravityHost) {
    console.log('💡 检测到当前正运行于 Antigravity 宿主环境/内置会话中，跳过退出主进程以防止会话中断。');
    return;
  }
  try {
    if (process.platform === 'win32') {
      try {
        const pPath = execSync('powershell.exe -NoProfile -NonInteractive -Command "(Get-Process -Name Antigravity, \'Antigravity IDE\' -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Path -First 1)"', { encoding: 'utf8' }).trim();
        if (pPath && fs.existsSync(pPath)) {
          detectedExePath = pPath;
        }
      } catch (_) {}

      const out = execSync('tasklist /NH', { encoding: 'utf8' }).toLowerCase();
      const isRunning = out.includes('antigravity.exe') || out.includes('antigravity ide.exe') || out.includes('language_server');
      if (isRunning) {
        console.log('⚠️ 检测到 Antigravity 客户端或后台服务正在运行，正在自动退出以解除文件锁定...');
        try { execSync('taskkill /IM Antigravity.exe /T', { stdio: 'ignore' }); } catch (_) {}
        try { execSync('taskkill /IM "Antigravity IDE.exe" /T', { stdio: 'ignore' }); } catch (_) {}
        const start = Date.now();
        while (Date.now() - start < 3500) {
          try {
            const chk = execSync('tasklist /NH', { encoding: 'utf8' }).toLowerCase();
            if (!chk.includes('antigravity.exe') && !chk.includes('antigravity ide.exe')) break;
          } catch (_) { break; }
          const t = Date.now(); while (Date.now() - t < 150) {}
        }
        try { execSync('taskkill /F /IM Antigravity.exe /T', { stdio: 'ignore' }); } catch (_) {}
        try { execSync('taskkill /F /IM "Antigravity IDE.exe" /T', { stdio: 'ignore' }); } catch (_) {}
        try { execSync('taskkill /F /IM language_server*.exe /T', { stdio: 'ignore' }); } catch (_) {}
        console.log('     ✅ Antigravity 客户端及后台语言服务已成功退出。');
      }
    } else if (process.platform === 'darwin') {
      let isRunning = false;
      try {
        const out = execSync('pgrep -i antigravity', { encoding: 'utf8' });
        if (out && out.trim()) isRunning = true;
      } catch (_) {}
      try {
        const outLs = execSync('pgrep -f "language_server.*antigravity"', { encoding: 'utf8' });
        if (outLs && outLs.trim()) isRunning = true;
      } catch (_) {}

      if (isRunning) {
        console.log('⚠️ 检测到 Antigravity 客户端或后台语言服务正在运行，正在执行安全优雅退出...');
        try { execSync('osascript -e \'tell application id "com.google.antigravity" to quit\'', { stdio: 'ignore' }); } catch (_) {}
        const start = Date.now();
        while (Date.now() - start < 4500) {
          let alive = false;
          try {
            const chk = execSync('pgrep -i antigravity', { encoding: 'utf8' });
            if (chk && chk.trim()) alive = true;
          } catch (_) {}
          try {
            const chkLs = execSync('pgrep -f "language_server.*antigravity"', { encoding: 'utf8' });
            if (chkLs && chkLs.trim()) alive = true;
          } catch (_) {}
          if (!alive) break;
          const t = Date.now(); while (Date.now() - t < 200) {}
        }
        try { execSync('pkill -i antigravity', { stdio: 'ignore' }); } catch (_) {}
        try { execSync('pkill -f "language_server.*antigravity"', { stdio: 'ignore' }); } catch (_) {}
        const t = Date.now(); while (Date.now() - t < 300) {}
        console.log('     ✅ Antigravity 客户端及后台语言服务已安全就绪。');
      }
    } else {
      try { execSync('pkill -f antigravity', { stdio: 'ignore' }); } catch (_) {}
      try { execSync('pkill -f language_server', { stdio: 'ignore' }); } catch (_) {}
    }
  } catch (_) {}
}

ensureProcessClosed();

// 0.5 检测并平滑替换存量独立版 antigravity-pulse（必须在部署和 patch-boot-overlay 之前还原旧版 app.asar 补丁）
try {
  const pulseMigration = await migrateLegacyPulse({
    home,
    pluginsDir,
    configFile,
    targetPluginDir,
    isInsideHost: isInsideAntigravityHost
  });
  if (pulseMigration.detected || pulseMigration.asarResult?.restored || pulseMigration.dataResult?.copied?.length) {
    console.log('🔄 检测到存量独立版反重力看板 (antigravity-pulse)，已完成无损数据迁移与平滑替换。');
  }
} catch (migErr) {
  console.error('❌ 存量反重力看板替换检查失败:', migErr.message);
  process.exit(1);
}

// 1. 确保全局 plugins 目录存在
if (!fs.existsSync(pluginsDir)) {
  fs.mkdirSync(pluginsDir, { recursive: true });
}

// 2. 方案 1：纯净白名单部署（绝不携带任何测试脚本、临时文件和截图）
console.log(`[1/3] 部署精简纯净运行时至 ${targetPluginDir}...`);

// 保护用户已有的个性化配置
let savedUserConfig = null;
const userConfigFile = path.join(targetPluginDir, 'config', 'config.json');
if (fs.existsSync(userConfigFile)) {
  try {
    savedUserConfig = fs.readFileSync(userConfigFile, 'utf8');
  } catch (e) {}
}

// 确保目标基础目录存在
fs.mkdirSync(targetPluginDir, { recursive: true });

// 清理旧的多余目录与截图（文件级清理，避免因进程锁定 CWD 抛出 EBUSY）
const obsoleteDirs = [];
for (const obs of obsoleteDirs) {
  const p = path.join(targetPluginDir, obs);
  if (fs.existsSync(p)) {
    try { fs.rmSync(p, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch (_) {}
  }
}

const WHITELIST_DIRS = ['client', 'sidecars', 'assets', 'scripts'];
const WHITELIST_FILES = [
  'plugin.json', 'config.default.json', 'package.json', 'README.md', 'CHANGELOG.md',
  'loadingOverlay.js', 'provisionSplash.js',
  'install.bat', 'uninstall.bat', 'install.ps1', 'uninstall.ps1', 'install.sh', 'uninstall.sh',
  'patch-loading.bat', 'restore-loading.bat', 'self-heal.bat'
];

function copyDirSafe(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.name.includes('.git') || entry.name.includes('node_modules') || entry.name.endsWith('.png.tmp')) continue;
    if (entry.isDirectory()) {
      copyDirSafe(srcPath, destPath);
    } else {
      try {
        let isSame = false;
        try {
          if (fs.existsSync(destPath)) {
            const sStat = fs.statSync(srcPath);
            const dStat = fs.statSync(destPath);
            if (sStat.size === dStat.size) isSame = true;
          }
        } catch (_) {}
        if (!isSame) {
          fs.copyFileSync(srcPath, destPath);
        }
      } catch (_) {}
    }
  }
}

for (const dir of WHITELIST_DIRS) {
  const src = path.join(PROJECT_ROOT, dir);
  const dest = path.join(targetPluginDir, dir);
  copyDirSafe(src, dest);
}

for (const file of WHITELIST_FILES) {
  const src = path.join(PROJECT_ROOT, file);
  const dest = path.join(targetPluginDir, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
  }
}

// 恢复用户的个性化配置，若为首次安装则由出厂默认配置初始化
const destConfigDir = path.join(targetPluginDir, 'config');
fs.mkdirSync(destConfigDir, { recursive: true });
const targetUserConfigFile = path.join(destConfigDir, 'config.json');

if (savedUserConfig) {
  fs.writeFileSync(targetUserConfigFile, savedUserConfig, 'utf8');
} else if (!fs.existsSync(targetUserConfigFile)) {
  const defaultCfg = path.join(targetPluginDir, 'config.default.json');
  if (fs.existsSync(defaultCfg)) {
    fs.copyFileSync(defaultCfg, targetUserConfigFile);
  }
}

// 兼容升级同步：若用户未显式配置 kernelInjection，则按当前 app.asar 状态平滑决定默认模式
let pluginFeatureCfg = readJsonSafe(targetUserConfigFile) || {};
if (!pluginFeatureCfg.features || typeof pluginFeatureCfg.features !== 'object') {
  pluginFeatureCfg.features = {};
}
let featureCfgChanged = false;
if (WITH_KERNEL_INJECTION && pluginFeatureCfg.features.kernelInjection !== true) {
  pluginFeatureCfg.features.kernelInjection = true;
  featureCfgChanged = true;
} else if (typeof pluginFeatureCfg.features.kernelInjection !== 'boolean') {
  const hostResources = findOriginalResourcesDir();
  const hostAsar = hostResources ? path.join(hostResources, 'app.asar') : null;
  const hostPatched = !!(hostAsar && fs.existsSync(hostAsar) && detectAsarPatchState(hostAsar).patched);
  pluginFeatureCfg.features.kernelInjection = hostPatched;
  featureCfgChanged = true;
  if (hostPatched) {
    console.log('  [i] 检测到旧版内置内核补丁，已自动平滑继承可选内核注入状态 (kernelInjection = true)。');
  }
}
if (pluginFeatureCfg.features.macLauncherMode !== 'keep_original' && pluginFeatureCfg.features.macLauncherMode !== 'isolate') {
  pluginFeatureCfg.features.macLauncherMode = 'isolate';
  featureCfgChanged = true;
}
if (featureCfgChanged) {
  writeJsonAtomic(targetUserConfigFile, pluginFeatureCfg);
}
const effectiveKernelInjection = pluginFeatureCfg.features.kernelInjection === true;
const effectiveMacLauncherMode = pluginFeatureCfg.features.macLauncherMode === 'keep_original' ? 'keep_original' : 'isolate';

// 验证
if (!fs.existsSync(path.join(targetPluginDir, 'plugin.json'))) {
  throw new Error('插件挂载失败：未能生成目标 plugin.json');
}

// 3. 方案 2：规范化写入插件启用状态（优先 RPC，安全原子回退）
console.log('[2/3] 配置插件启用状态...');

async function enablePluginViaRpc() {
  const lsAddress = process.env.ANTIGRAVITY_LS_ADDRESS;
  const csrfToken = process.env.ANTIGRAVITY_CSRF_TOKEN;
  if (!lsAddress || !csrfToken) return false;

  const [host, port] = lsAddress.split(':');
  const postData = JSON.stringify({
    userConfig: {
      plugins: {
        'antigravity-skin': { enabled: true }
      }
    }
  });

  return new Promise((resolve) => {
    const req = http.request({
      host,
      port: parseInt(port, 10),
      path: '/exa.language_server_pb.LanguageServerService/JetboxWriteState',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-codeium-csrf-token': csrfToken,
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: 2000
    }, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.write(postData);
    req.end();
  });
}

const rpcOk = await enablePluginViaRpc();
if (rpcOk) {
  console.log('  [√] 已通过 Antigravity 官方 Language Server RPC 热注册并启用插件。');
} else {
  // RPC 不可用时，执行具备原子保护的文件持久化
  let configData = readJsonSafe(configFile) || {};
  if (!configData.plugins) configData.plugins = {};
  configData.plugins['antigravity-skin'] = { enabled: true };
  writeJsonAtomic(configFile, configData);
  console.log('  [√] 已原子化写入 ~/.gemini/config/config.json 启用配置。');
}

// 4. 清理可能残留的观察器（热优化当前会话）
console.log('[3/3] 检测当前运行中的客户端会话...');
async function cleanRunningHost() {
  const portFile = process.platform === 'win32'
    ? path.join(process.env.APPDATA || path.join(home, 'AppData', 'Roaming'), 'Antigravity', 'DevToolsActivePort')
    : (process.platform === 'darwin'
      ? path.join(home, 'Library', 'Application Support', 'Antigravity', 'DevToolsActivePort')
      : path.join(home, '.config', 'Antigravity', 'DevToolsActivePort'));

  if (!fs.existsSync(portFile)) return;

  try {
    const raw = fs.readFileSync(portFile, 'utf8');
    const port = parseInt(raw.split(/\r?\n/)[0].trim(), 10);
    if (!port) return;

    const listRes = await new Promise((resolve, reject) => {
      http.get(`http://127.0.0.1:${port}/json/list`, res => {
        let d = '';
        res.on('data', chunk => d += chunk);
        res.on('end', () => {
          try { resolve(JSON.parse(d)); } catch(e) { reject(e); }
        });
      }).on('error', reject);
    });

    for (const target of listRes) {
      const url = target.url || '';
      if ((target.type === 'page' || !target.type) && target.webSocketDebuggerUrl &&
          !url.startsWith('data:') && !url.startsWith('plugin://') && !url.startsWith('devtools://')) {
        if (typeof WebSocket !== 'undefined') {
          const ws = new WebSocket(target.webSocketDebuggerUrl);
          ws.onopen = () => {
            const cleanScript = `
              if (window.__agyWallpaperObserver) { try { window.__agyWallpaperObserver.disconnect(); } catch(e){} window.__agyWallpaperObserver = null; }
              if (window.__agyBubbleObserver) { try { window.__agyBubbleObserver.disconnect(); } catch(e){} window.__agyBubbleObserver = null; }
              if (window.__agyMenuObserver) { try { window.__agyMenuObserver.disconnect(); } catch(e){} window.__agyMenuObserver = null; }
              if (typeof window.__agPulseDispose === 'function') { try { window.__agPulseDispose(); } catch(e){} }
              if (window.__agPulseRuntimeBridge && typeof window.__agPulseRuntimeBridge.dispose === 'function') { try { window.__agPulseRuntimeBridge.dispose(); } catch(e){} }
              const oldVid = document.getElementById('agy-dynamic-video');
              if (oldVid) { oldVid.pause(); oldVid.remove(); }
              window.__AG_SKIN_ATTACHED__ = false;
            `;
            ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: cleanScript } }));
            setTimeout(() => { try { ws.close(); } catch(e){} }, 300);
          };
        }
      }
    }
  } catch (e) {
    // 静默忽略
  }
}

await cleanRunningHost();

// 5. 启动入口配置：默认采用 100% 零改包 / 零重签纯净启动；仅在用户显式开启 kernelInjection 时同步内核补丁
if (effectiveKernelInjection) {
  if (process.platform === 'win32') {
    const registerScript = path.join(targetPluginDir, 'scripts', 'register-self-heal.mjs');
    if (fs.existsSync(registerScript)) {
      try {
        console.log('\n[4/5] 检测到已启用可选内核注入，正在同步开机自愈守护...');
        execSync(`"${process.execPath}" "${registerScript}"`, { stdio: 'inherit' });
      } catch (e) {
        console.log('  ⚠️ 开机自愈守护注册失败，可稍后双击 self-heal.bat 手动重试。');
      }
    }
    try { patchWindowsShortcuts({ pluginRoot: targetPluginDir }); } catch (_) {}
  }

  console.log('\n[5/5] 正在同步可选客户端内核调试端口与前置动效补丁 (kernelInjection = true)...');
  const deployedPatchScript = path.join(targetPluginDir, 'scripts', 'patch-boot-overlay.mjs');
  const patchScript = fs.existsSync(deployedPatchScript) ? deployedPatchScript : path.join(PROJECT_ROOT, 'scripts', 'patch-boot-overlay.mjs');
  if (fs.existsSync(patchScript)) {
    try {
      execSync(`"${process.execPath}" "${patchScript}"`, { stdio: 'inherit' });
    } catch (e) {
      console.log('  ⚠️ 可选内核补丁执行出现异常:', e.message);
      console.log('     👉 您可随时在插件控制面板中点击「重新修复」或「还原官方原版」！');
    }
  }
} else if (process.platform === 'win32') {
  const registerScript = path.join(targetPluginDir, 'scripts', 'register-self-heal.mjs');
  if (fs.existsSync(registerScript)) {
    try { execSync(`"${process.execPath}" "${registerScript}" --unregister`, { stdio: 'ignore' }); } catch (_) {}
  }
  console.log('\n[4/4] 正在配置 Windows 零改包快捷方式启动参数 (--remote-debugging-port=0)...');
  try {
    const scRes = patchWindowsShortcuts({ pluginRoot: targetPluginDir });
    console.log(`  [√] 快捷方式配置完成：更新 ${scRes.updated} 项${scRes.userCreated > 0 ? `，新建用户级快捷方式 ${scRes.userCreated} 项` : ''}。`);
    if (scRes.skippedReadOnly > 0 && scRes.userCreated === 0) {
      console.log(`  ⚠️ 有 ${scRes.skippedReadOnly} 个系统只读目录快捷方式无写入权限，请从桌面用户级入口启动。`);
    }
  } catch (e) {
    console.log('  ⚠️ 配置快捷方式时出现非致命异常:', e.message);
  }
} else if (process.platform === 'darwin') {
  console.log(`\n[4/4] 正在配置 macOS 零改包 / 零重签无感启动器 (模式: ${effectiveMacLauncherMode})...`);
  try {
    const macRes = setupMacZeroPatchLauncher({
      mode: effectiveMacLauncherMode,
      isInsideHost: isInsideAntigravityHost
    });
    if (macRes.ok) {
      console.log(`  [√] macOS 启动器已就绪: ${macRes.launcherPath || 'Antigravity.app'}`);
    } else if (macRes.reason === 'host-running-skip-isolate') {
      console.log('  💡 检测到运行于 Antigravity 宿主会话中，跳过在线迁移 /Applications/Antigravity.app（下次关闭后重启或手动部署脚本可执行隔离），CLI 入口已就绪。');
    } else {
      console.log(`  ⚠️ macOS 启动器构建未能完成 (${macRes.reason || macRes.error || 'unknown'})，已回退至命令行包装 ~/.local/bin/antigravity。`);
    }
  } catch (e) {
    console.log('  ⚠️ 配置 macOS 启动器失败:', e.message);
  }
} else if (process.platform === 'linux') {
  console.log('\n[4/4] 正在配置 Linux 零改包 CLI 启动包装 (--remote-debugging-port=0)...');
  try {
    const binDir = path.join(home, '.local', 'bin');
    fs.mkdirSync(binDir, { recursive: true });
    const wrapperPath = path.join(binDir, 'antigravity');
    const wrapperContent = [
      '#!/usr/bin/env bash',
      '# antigravity-skin zero-patch launcher wrapper',
      'REAL_BIN=""',
      'for p in /usr/bin/antigravity /usr/local/bin/antigravity /opt/Antigravity/antigravity /opt/antigravity/antigravity; do',
      '  if [ -x "$p" ] && [ "$p" != "$0" ]; then REAL_BIN="$p"; break; fi',
      'done',
      'if [ -z "$REAL_BIN" ]; then echo "Antigravity binary not found" >&2; exit 1; fi',
      'exec "$REAL_BIN" --remote-debugging-port=0 "$@"',
      ''
    ].join('\n');
    fs.writeFileSync(wrapperPath, wrapperContent, { mode: 0o755 });
    console.log(`  [√] 已配置 CLI 启动包装: ${wrapperPath}`);
  } catch (e) {
    console.log('  ⚠️ 配置 Linux CLI 启动包装失败:', e.message);
  }
}

function restartAntigravity() {
  if (isInsideAntigravityHost) {
    console.log('\n✨ 插件、配置与启动入口已全量就绪！');
    return;
  }
  console.log('\n✨ 正在自动为您重新拉起 Antigravity 客户端...');
  try {
    if (process.platform === 'darwin') {
      const launch = resolveMacLaunchTarget();
      const argSuffix = launch.isLauncher ? '' : ' --args --remote-debugging-port=0';
      if (launch.target.startsWith('/') || launch.target.includes('.app')) {
        execSync(`open -a "${launch.target}"${argSuffix}`, { stdio: 'ignore' });
      } else {
        execSync(`open -b "${launch.target}"${argSuffix}`, { stdio: 'ignore' });
      }
      console.log('✨ 客户端已成功重新拉起启动！');
    } else if (process.platform === 'win32') {
      // 1. 如果客户端已由补丁脚本成功唤醒，避免重复拉起引发冲突
      try {
        const chk = execSync('tasklist /NH', { encoding: 'utf8' }).toLowerCase();
        if (chk.includes('antigravity.exe') || chk.includes('antigravity ide.exe')) {
          console.log('✨ 客户端已成功重新拉起启动并就绪！');
          return;
        }
      } catch (_) {}

      function findExe() {
        if (detectedExePath && fs.existsSync(detectedExePath)) return detectedExePath;
        try {
          const t = runPowerShellScript(`
            $desktop = [Environment]::GetFolderPath('Desktop')
            $wsh = New-Object -ComObject WScript.Shell
            foreach ($n in @('Antigravity.lnk', 'Antigravity IDE.lnk', 'Antigravity (Skin).lnk')) {
              $p = Join-Path $desktop $n
              if (Test-Path $p) {
                $tp = $wsh.CreateShortcut($p).TargetPath
                if ($tp -and (Test-Path $tp)) { Write-Output $tp; break }
              }
            }
          `);
          if (t && fs.existsSync(t)) return t;
        } catch (_) {}
        const localAppData = process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');
        const candidates = [
          path.join(localAppData, 'Programs', 'antigravity', 'Antigravity.exe'),
          path.join(localAppData, 'Programs', 'Antigravity', 'Antigravity.exe'),
          path.join(localAppData, 'Programs', 'Antigravity IDE', 'Antigravity IDE.exe'),
          'C:\\Program Files\\Antigravity\\Antigravity.exe',
          'C:\\Program Files (x86)\\Antigravity\\Antigravity.exe',
          'D:\\soft\\Antigravity IDE\\Antigravity IDE.exe'
        ];
        return candidates.find(c => fs.existsSync(c));
      }

      const exe = findExe();
      if (exe) {
        const exeDir = path.dirname(exe);
        const cleanEnv = { ...process.env };
        delete cleanEnv.ELECTRON_RUN_AS_NODE;
        delete cleanEnv.ELECTRON_NO_ASAR;
        delete cleanEnv.NODE_OPTIONS;
        delete cleanEnv.NODE_ENV;
        delete cleanEnv.ATOM_SHELL_INTERNAL_RUN_AS_NODE;

        const escapedExe = exe.replace(/'/g, "''");
        const escapedDir = exeDir.replace(/'/g, "''");
        try {
          execSync(`powershell.exe -NoProfile -NonInteractive -Command "Start-Process -FilePath '${escapedExe}' -ArgumentList '--remote-debugging-port=0' -WorkingDirectory '${escapedDir}'"`, {
            windowsHide: true,
            stdio: 'ignore',
            env: cleanEnv
          });
        } catch (_) {
          const child = spawn(exe, ['--remote-debugging-port=0'], { cwd: exeDir, detached: true, stdio: 'ignore', env: cleanEnv });
          child.unref();
        }
        console.log('✨ 客户端已成功重新拉起启动！');
      } else {
        console.log('💡 未能自动找到 Antigravity.exe，请手动启动客户端。');
      }
    } else {
      execSync('antigravity --remote-debugging-port=0 &', { stdio: 'ignore' });
      console.log('✨ 客户端已成功重新拉起启动！');
    }
  } catch (_) {
    console.log('💡 如未自动启动，请手动打开 Antigravity 客户端。');
  }
}

restartAntigravity();

console.log('==================================================');
console.log(' [√] 部署与优化完成！');
console.log(` 部署目录：${targetPluginDir}`);
console.log('--------------------------------------------------');
console.log(' 🔔 重要提示：');
console.log(' 插件核心文件已全部复制到上述持久化目录。');
console.log(' 当前解压出来的安装包文件夹【已不需要，请直接删除】！');
console.log(' 本地无需保留任何多余文件，完全不影响插件正常运行。');
console.log('--------------------------------------------------');
if (effectiveKernelInjection) {
  console.log(' ⚡ 当前运行模式：可选内核注入模式 (kernelInjection = true)');
  console.log('   如需随时恢复官方原版 100% 未修改包，可在控制面板「零改包与高级模式」一键切换，或运行 restore-loading.bat。');
} else {
  console.log(' 🛡️ 当前运行模式：100% 零改包 / 零重签纯净启动 (推荐默认)');
  console.log('   未修改任何官方 app.asar 与原版代码签名，仅通过官方标准启动入口激活插件调试端口。');
  console.log('   如需开机首帧视频等高阶能力，可在插件控制面板底部开启「内核级前置注入 (实验性)」。');
}
console.log('==================================================');
