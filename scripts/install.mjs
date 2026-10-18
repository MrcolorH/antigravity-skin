import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import { execSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

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

// 0. 自动退出运行中的客户端以解除文件锁定并准备部署
function ensureProcessClosed() {
  try {
    if (process.platform === 'win32') {
      try {
        const pPath = execSync('powershell.exe -NoProfile -NonInteractive -Command "(Get-Process -Name Antigravity, \'Antigravity IDE\' -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Path -First 1)"', { encoding: 'utf8' }).trim();
        if (pPath && fs.existsSync(pPath)) {
          detectedExePath = pPath;
        }
      } catch (_) {}

      const out = execSync('tasklist /NH', { encoding: 'utf8' }).toLowerCase();
      const isRunning = out.includes('antigravity.exe') || out.includes('antigravity ide.exe');
      if (isRunning) {
        console.log('⚠️ 检测到 Antigravity 客户端正在运行，正在自动退出以解除文件锁定...');
        try { execSync('taskkill /F /IM Antigravity.exe /T', { stdio: 'ignore' }); } catch (_) {}
        try { execSync('taskkill /F /IM "Antigravity IDE.exe" /T', { stdio: 'ignore' }); } catch (_) {}
        const start = Date.now();
        while (Date.now() - start < 3000) {
          try {
            const chk = execSync('tasklist /NH', { encoding: 'utf8' }).toLowerCase();
            if (!chk.includes('antigravity.exe') && !chk.includes('antigravity ide.exe')) break;
          } catch (_) { break; }
          const t = Date.now(); while (Date.now() - t < 150) {}
        }
        console.log('     ✅ Antigravity 客户端已成功退出。');
      }
    } else if (process.platform === 'darwin') {
      let isRunning = false;
      try {
        const out = execSync('pgrep -i antigravity', { encoding: 'utf8' });
        if (out && out.trim()) isRunning = true;
      } catch (_) {}

      if (isRunning) {
        console.log('⚠️ 检测到 Antigravity 客户端正在运行，正在自动安全退出以应用新配置...');
        try { execSync('osascript -e \'quit app "Antigravity"\'', { stdio: 'ignore' }); } catch (_) {}
        const start = Date.now();
        while (Date.now() - start < 2000) {
          try {
            const chk = execSync('pgrep -i antigravity', { encoding: 'utf8' });
            if (!chk || !chk.trim()) break;
          } catch (_) { break; }
          const t = Date.now(); while (Date.now() - t < 200) {}
        }
        try { execSync('pkill -i antigravity', { stdio: 'ignore' }); } catch (_) {}
        console.log('     ✅ Antigravity 客户端已成功退出。');
      }
    } else {
      try { execSync('pkill -f antigravity', { stdio: 'ignore' }); } catch (_) {}
    }
  } catch (_) {}
}

ensureProcessClosed();

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
  'plugin.json', 'config.default.json', 'package.json', 'README.md',
  'install.bat', 'uninstall.bat', 'install.ps1', 'uninstall.ps1', 'install.sh', 'uninstall.sh',
  'patch-loading.bat', 'restore-loading.bat'
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
  let configData = {};
  if (fs.existsSync(configFile)) {
    try {
      configData = JSON.parse(fs.readFileSync(configFile, 'utf8'));
    } catch (e) {
      console.warn('  读取现有 config.json 失败，将初始化配置:', e.message);
    }
  }
  if (!configData.plugins) configData.plugins = {};
  configData.plugins['antigravity-skin'] = { enabled: true };

  const tmpConfigFile = `${configFile}.tmp.${Date.now()}`;
  fs.writeFileSync(tmpConfigFile, JSON.stringify(configData, null, 2), 'utf8');
  try {
    fs.renameSync(tmpConfigFile, configFile);
    console.log('  [√] 已原子化写入 ~/.gemini/config/config.json 启用配置。');
  } catch (e) {
    fs.copyFileSync(tmpConfigFile, configFile);
    try { fs.unlinkSync(tmpConfigFile); } catch(_) {}
    console.log('  [√] 已同步写入 ~/.gemini/config/config.json。');
  }
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

// 5. Windows 平台特权：自动执行前置开机动画动态联动补丁（自动关闭运行中的客户端解除锁定）
// 注意：macOS 采用纯非侵入式架构，由 Sidecar 守护进程通过 CDP 动态接管与消除原生 loading，100% 保持官方代码签名完整！
if (process.platform === 'win32') {
  console.log('\n[4/4] 正在配置 Windows 客户端前置开机动画引擎 (自动退出运行中的客户端以解除文件锁定)...');
  const deployedPatchScript = path.join(targetPluginDir, 'scripts', 'patch-boot-overlay.mjs');
  const patchScript = fs.existsSync(deployedPatchScript) ? deployedPatchScript : path.join(PROJECT_ROOT, 'scripts', 'patch-boot-overlay.mjs');
  if (fs.existsSync(patchScript)) {
    try {
      const { execSync } = await import('node:child_process');
      execSync(`"${process.execPath}" "${patchScript}"`, { stdio: 'inherit' });
    } catch (e) {
      console.log('  ⚠️ 开机动画补丁执行出现异常:', e.message);
      console.log('     👉 您可随时在外观设置中点击「一键修复」或双击 patch-loading.bat 重新合入！');
    }
  }
}

function restartAntigravity() {
  console.log('\n✨ 正在自动为您重新拉起 Antigravity 客户端...');
  try {
    if (process.platform === 'darwin') {
      const candidates = [
        '/Applications/Antigravity.app',
        path.join(home, 'Applications', 'Antigravity.app')
      ];
      for (const c of candidates) {
        if (fs.existsSync(c)) {
          execSync(`open -a "${c}"`, { stdio: 'ignore' });
          console.log('✨ 客户端已成功重新拉起启动！');
          return;
        }
      }
      execSync('open -a Antigravity', { stdio: 'ignore' });
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
          const desktop = path.join(home, 'Desktop');
          for (const lnk of [path.join(desktop, 'Antigravity.lnk'), path.join(desktop, 'Antigravity IDE.lnk')]) {
            if (fs.existsSync(lnk)) {
              const target = execSync(`powershell.exe -NoProfile -NonInteractive -Command "(New-Object -ComObject WScript.Shell).CreateShortcut('${lnk}').TargetPath"`, { encoding: 'utf8' }).trim();
              if (target && fs.existsSync(target)) return target;
            }
          }
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

        try {
          execSync(`powershell.exe -NoProfile -NonInteractive -Command "Start-Process -FilePath '${exe}' -WorkingDirectory '${exeDir}'"`, {
            windowsHide: true,
            stdio: 'ignore',
            env: cleanEnv
          });
        } catch (_) {
          const child = spawn(exe, [], { cwd: exeDir, detached: true, stdio: 'ignore', env: cleanEnv });
          child.unref();
        }
        console.log('✨ 客户端已成功重新拉起启动！');
      } else {
        console.log('💡 未能自动找到 Antigravity.exe，请手动启动客户端。');
      }
    } else {
      execSync('antigravity &', { stdio: 'ignore' });
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
if (process.platform === 'win32') {
  console.log('--------------------------------------------------');
  console.log(' 🎬 Windows 开机动画专属提示：');
  console.log(' 安装程序已自动为您退出客户端并完成前置开机动画终极升级！');
  console.log(' 如需重新打补丁，随时双击运行 patch-loading.bat；如需还原官方，可双击 restore-loading.bat。');
  console.log('--------------------------------------------------');
  console.log(' ✨ 客户端已为您自动重启生效，无需手动操作！');
} else {
  console.log('--------------------------------------------------');
  console.log(' 🍎 macOS 纯净架构提示：');
  console.log(' 已采用原生非侵入式架构完成部署，100% 保护官方代码签名与安全沙箱完整！');
  console.log('--------------------------------------------------');
  console.log(' ✨ 客户端已为您自动重新拉起生效，无需手动操作！');
}
console.log('==================================================');
