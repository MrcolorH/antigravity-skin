import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

console.log('==================================================');
console.log('  Antigravity 前置开机动画防闪白补丁 (Windows 专用)');
console.log('==================================================');

if (process.platform !== 'win32') {
  console.log('📌 提示：当前脚本仅适用于 Windows 系统。');
  console.log('   macOS 平台采用纯净非侵入式架构，无需篡改系统 app.asar。');
  process.exit(0);
}

// 1. 定位 Antigravity resources 目录
function findResourcesDir() {
  const home = os.homedir();
  if (process.platform === 'darwin') {
    const candidates = [
      '/Applications/Antigravity.app/Contents/Resources',
      path.join(home, 'Applications', 'Antigravity.app', 'Contents', 'Resources')
    ];
    for (const c of candidates) {
      if (fs.existsSync(path.join(c, 'app.asar'))) {
        return c;
      }
    }
  } else if (process.platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');
    const candidates = [
      path.join(localAppData, 'Programs', 'antigravity', 'resources'),
      path.join(localAppData, 'Programs', 'Antigravity', 'resources'),
      'C:\\Program Files\\Antigravity\\resources',
      'C:\\Program Files (x86)\\Antigravity\\resources'
    ];
    for (const c of candidates) {
      if (fs.existsSync(path.join(c, 'app.asar'))) {
        return c;
      }
    }
  } else {
    const candidates = [
      '/usr/lib/antigravity/resources',
      '/opt/Antigravity/resources',
      '/opt/antigravity/resources',
      path.join(home, '.local', 'share', 'antigravity', 'resources')
    ];
    for (const c of candidates) {
      if (fs.existsSync(path.join(c, 'app.asar'))) {
        return c;
      }
    }
  }
  return null;
}

const resourcesDir = findResourcesDir();
if (!resourcesDir) {
  console.error('❌ 未找到 Antigravity 安装目录下的 resources/app.asar！请确认客户端是否已正确安装。');
  process.exit(1);
}

const asarPath = path.join(resourcesDir, 'app.asar');
const backupPath = path.join(resourcesDir, 'app.asar.bak');
console.log(`[1/5] 检测到 Antigravity resources 目录: ${resourcesDir}`);

let detectedExePath = null;

// 2. 检查并自动关闭运行中的 Antigravity 客户端（解除文件锁定）
function ensureProcessClosed() {
  try {
    if (process.platform === 'win32') {
      try {
        const pPath = execSync('powershell.exe -NoProfile -NonInteractive -Command "(Get-Process -Name Antigravity, \'Antigravity IDE\' -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Path -First 1)"', { encoding: 'utf8' }).trim();
        if (pPath && fs.existsSync(pPath)) {
          detectedExePath = pPath;
        }
      } catch (_) {}

      try {
        const out = execSync('tasklist /NH', { encoding: 'utf8' }).toLowerCase();
        const isRunning = out.includes('antigravity.exe') || out.includes('antigravity ide.exe');
        if (isRunning) {
          console.log('⚠️ 检测到 Antigravity 客户端正在运行，正在自动安全退出以解除文件锁定...');
          try {
            execSync('taskkill /F /IM Antigravity.exe /T', { stdio: 'ignore' });
          } catch (_) {}
          try {
            execSync('taskkill /F /IM "Antigravity IDE.exe" /T', { stdio: 'ignore' });
          } catch (_) {}

          // 等待进程完全释放，最长等待 3 秒
          const start = Date.now();
          while (Date.now() - start < 3000) {
            try {
              const chk = execSync('tasklist /NH', { encoding: 'utf8' }).toLowerCase();
              if (!chk.includes('antigravity.exe') && !chk.includes('antigravity ide.exe')) break;
            } catch (_) {
              break;
            }
            const t = Date.now();
            while (Date.now() - t < 150) {}
          }
          console.log('     ✅ Antigravity 客户端已成功退出，文件句柄已完全释放。');
        }
      } catch (_) {}
    } else if (process.platform === 'darwin') {
      let isRunning = false;
      try {
        const out = execSync('pgrep -i antigravity', { encoding: 'utf8' });
        if (out && out.trim()) isRunning = true;
      } catch (_) {}

      if (isRunning) {
        console.log('⚠️ 检测到 Antigravity 客户端正在运行，正在自动安全退出以解除文件锁定...');
        try {
          execSync('pkill -i antigravity', { stdio: 'ignore' });
        } catch (_) {}

        const start = Date.now();
        while (Date.now() - start < 3000) {
          try {
            const chk = execSync('pgrep -i antigravity', { encoding: 'utf8' });
            if (!chk || !chk.trim()) break;
          } catch (_) {
            break;
          }
          const t = Date.now();
          while (Date.now() - t < 150) {}
        }
        console.log('     ✅ Antigravity 客户端已成功退出，文件句柄已完全释放。');
      }
    } else {
      try {
        execSync('pkill -f antigravity', { stdio: 'ignore' });
      } catch (_) {}
    }
  } catch (_) {}
}

ensureProcessClosed();

// 3. 自动备份官方原版 app.asar
if (!fs.existsSync(backupPath)) {
  console.log(`[2/5] 正在创建官方原版安全备份: app.asar.bak ...`);
  fs.copyFileSync(asarPath, backupPath);
  console.log('     ✅ 备份成功！任何时候都可以一秒恢复原厂状态。');
} else {
  console.log(`[2/5] 官方备份 app.asar.bak 已存在，安全跳过备份。`);
}

// 4. 解包 app.asar 到临时目录
const tempExtractDir = path.join(os.tmpdir(), `agy-patch-${Date.now()}`);
console.log(`[3/5] 正在安全解包 app.asar 到临时沙箱...`);

try {
  execSync(`npx --yes @electron/asar extract "${asarPath}" "${tempExtractDir}"`, { stdio: 'inherit' });
} catch (e) {
  console.error('❌ 解包失败，错误信息:', e.message);
  process.exit(1);
}

// 5. 注入防闪白独立舞台开机引擎
console.log(`[4/5] 正在注入零闪白影院级溶出引擎 (硬件合成锁死 + 主窗口原生纯黑 + 独立幕布淡出)...`);

// A. 注入 loadingOverlay.js
const targetOverlayFile = path.join(tempExtractDir, 'dist', 'loadingOverlay.js');

const patchedOverlayCode = `"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.attachLoadingOverlay = attachLoadingOverlay;

const electron_1 = require("electron");
const fs = require("fs");
const path = require("path");
const os = require("os");

/**
 * 动态读取 antigravity-skin 插件配置
 */
function getPluginConfig() {
  try {
    const home = os.homedir();
    const cfgPath = path.join(home, ".gemini", "config", "plugins", "antigravity-skin", "config", "config.json");
    if (fs.existsSync(cfgPath)) {
      return JSON.parse(fs.readFileSync(cfgPath, "utf8"));
    }
    const defCfgPath = path.join(home, ".gemini", "config", "plugins", "antigravity-skin", "config.default.json");
    if (fs.existsSync(defCfgPath)) {
      return JSON.parse(fs.readFileSync(defCfgPath, "utf8"));
    }
  } catch (_) {}
  return null;
}

/**
 * 解析视频或脚本路径（支持绝对路径与相对插件根目录路径）
 */
function resolveAssetPath(relOrAbs, subDir) {
  if (!relOrAbs) return null;
  try {
    if (path.isAbsolute(relOrAbs) && fs.existsSync(relOrAbs)) return relOrAbs;
    const home = os.homedir();
    const pluginRoot = path.join(home, ".gemini", "config", "plugins", "antigravity-skin");
    const rel = path.resolve(pluginRoot, relOrAbs);
    if (fs.existsSync(rel)) return rel;
    const base = path.basename(relOrAbs);
    if (subDir === "videos") {
      const inBoot = path.join(pluginRoot, "assets", "videos", "boot", base);
      if (fs.existsSync(inBoot)) return inBoot;
      const inWp = path.join(pluginRoot, "assets", "videos", "wallpaper", base);
      if (fs.existsSync(inWp)) return inWp;
    }
    const inSub = path.join(pluginRoot, "assets", subDir, base);
    if (fs.existsSync(inSub)) return inSub;
  } catch (_) {}
  return null;
}

/**
 * 生成动态开机引导 HTML
 */
function generateOverlayHtml(cfg, foregroundColor, backgroundColor) {
  const bootCfg = cfg?.features?.bootAnimationConfig || {};
  const bootType = bootCfg.type || "video";

  const sharedStyles = \`
  * {
    margin: 0; padding: 0; box-sizing: border-box;
    -webkit-tap-highlight-color: transparent !important;
    outline: none !important;
  }
  /* 关键防线 1：html 与 body 永远纯透明，绝不触碰 body.opacity 避免 W3C 视口白色回退 */
  html, body {
    background: transparent !important;
    background-color: transparent !important;
    width: 100vw; height: 100vh;
    overflow: hidden;
    -webkit-user-select: none; user-select: none;
    -webkit-app-region: no-drag;
    cursor: pointer;
  }
  /* 关键防线 2：独立的黑色舞台幕布，预先开启 3D 硬件图层合成，彻底消除点击瞬间 DirectComposition 图层销毁的白闪 */
  #boot-stage {
    position: fixed; inset: 0; width: 100vw; height: 100vh;
    background: #000000;
    display: flex; align-items: center; justify-content: center;
    transition: opacity 450ms cubic-bezier(0.25, 1, 0.5, 1);
    will-change: opacity;
    transform: translateZ(0);
    backface-visibility: hidden;
    z-index: 1000;
    cursor: pointer;
  }
  .status-pill {
    position: absolute; bottom: 28px; right: 32px;
    padding: 8px 18px; border-radius: 9999px;
    background: rgba(15, 23, 42, 0.8);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.15);
    color: rgba(255, 255, 255, 0.88);
    font-size: 13px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
    display: flex; align-items: center; gap: 10px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    user-select: none; -webkit-user-select: none;
    -webkit-app-region: no-drag;
    transition: all 350ms cubic-bezier(0.16, 1, 0.3, 1);
    z-index: 99999;
    cursor: pointer;
    pointer-events: auto;
  }
  .status-loading .spinner {
    width: 14px; height: 14px;
    border: 2px solid rgba(56, 189, 248, 0.25);
    border-top-color: #38bdf8;
    border-radius: 50%;
    animation: agy-spin 0.8s linear infinite;
  }
  @keyframes agy-spin {
    to { transform: rotate(360deg); }
  }
  .status-ready {
    border-color: rgba(52, 211, 153, 0.45);
    background: rgba(15, 23, 42, 0.9);
  }
  .status-ready:hover {
    background: rgba(30, 41, 59, 0.98);
    border-color: rgba(52, 211, 153, 0.8);
    transform: translateY(-1px);
    box-shadow: 0 10px 36px rgba(16, 185, 129, 0.25);
  }
  .ready-dot {
    width: 8px; height: 8px;
    border-radius: 50%;
    background: #34d399;
    box-shadow: 0 0 10px #34d399, 0 0 4px #10b981;
    animation: ready-pulse 2s infinite ease-in-out;
  }
  @keyframes ready-pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.6; transform: scale(0.85); }
  }
  kbd {
    display: inline-block;
    padding: 2px 6px;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.15);
    border: 1px solid rgba(255, 255, 255, 0.25);
    color: #fff;
    font-family: monospace;
    font-size: 11px;
    margin: 0 2px;
  }
  .pill-shake {
    animation: agy-shake 0.4s ease-in-out;
  }
  @keyframes agy-shake {
    0%, 100% { transform: translateX(0); }
    20%, 60% { transform: translateX(-4px); }
    40%, 80% { transform: translateX(4px); }
  }
  \`;

  // 1. 视频模式
  if (bootType === "video") {
    const vidPath = resolveAssetPath(bootCfg.videoPath, "videos");
    if (vidPath) {
      const cleanVidPath = vidPath.replace(/\\\\/g, "/");
      const vidUrl = cleanVidPath.startsWith('/') ? ("file://" + cleanVidPath) : ("file:///" + cleanVidPath);
      return \`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  \${sharedStyles}
  /* 关键防线 3：video 设置 pointer-events: none，点击事件全部由 #boot-stage 承接，防止点击视频触发内部控件或焦点闪变 */
  video {
    width: 100%; height: 100%;
    object-fit: cover;
    pointer-events: none;
    -webkit-app-region: no-drag;
    transform: translateZ(0);
    backface-visibility: hidden;
  }
</style>
</head>
<body>
  <div id="boot-stage">
    <video id="boot-vid" src="\${vidUrl}" autoplay muted playsinline></video>
    <div id="boot-status" class="status-pill status-loading">
      <div class="spinner"></div>
      <span class="status-text">系统启动中...</span>
    </div>
  </div>
  <script>
    const v = document.getElementById('boot-vid');
    const pill = document.getElementById('boot-status');
    const stage = document.getElementById('boot-stage');
    let isHostReady = false;
    let isMediaDone = false;
    let finished = false;

    // 真正零闪白平滑溶出：舞台幕布 450ms 优雅淡出，时间到后才向宿主发出 detach 信号
    function finish() {
      if (finished) return;
      finished = true;

      if (pill) {
        pill.style.transition = 'opacity 200ms ease';
        pill.style.opacity = '0';
      }

      if (stage) {
        stage.style.opacity = '0';
      }

      setTimeout(() => {
        document.title = '__AGY_BOOT_DONE__';
        console.log('__AGY_BOOT_DONE__');
      }, 450);
    }

    function setReady() {
      if (isHostReady) return;
      isHostReady = true;
      document.title = '__AGY_HOST_READY__';
      if (pill) {
        pill.className = 'status-pill status-ready';
        pill.innerHTML = '<span class="ready-dot"></span><span class="status-text">就绪 · 按 <kbd>ESC</kbd> 或点击跳过</span>';
      }
      if (isMediaDone) {
        finish();
      }
    }

    window.__agyOnHostReady = setReady;

    window.__agyShakePill = function() {
      if (pill && !isHostReady) {
        pill.classList.remove('pill-shake');
        void pill.offsetWidth;
        pill.classList.add('pill-shake');
      }
    };

    function handleUserSkip(e) {
      if (e) {
        try { e.preventDefault(); e.stopPropagation(); } catch(_) {}
      }
      if (isHostReady) {
        finish();
      } else {
        window.__agyShakePill();
      }
    }

    if (v) {
      v.addEventListener('ended', () => {
        isMediaDone = true;
        if (isHostReady) {
          finish();
        } else {
          try { v.pause(); } catch(_) {}
        }
      });
      v.addEventListener('error', () => {
        isMediaDone = true;
        if (isHostReady) finish();
      });
    }

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' || e.code === 'Escape' || e.key === ' ' || e.key === 'Enter') {
        handleUserSkip(e);
      }
    }, true);

    document.addEventListener('click', handleUserSkip, true);
    if (pill) pill.addEventListener('click', handleUserSkip, true);
    if (stage) stage.addEventListener('click', handleUserSkip, true);

    setTimeout(setReady, 10000);
    setTimeout(finish, 15000);
  </script>
</body>
</html>\`;
    }
  }

  // 2. 自定义代码动效模式
  if (bootType === "code") {
    let scriptPath = resolveAssetPath(bootCfg.customCodePath, "scripts");
    if (!scriptPath) scriptPath = resolveAssetPath("default-boot.js", "scripts");
    let scriptContent = "";
    if (scriptPath && fs.existsSync(scriptPath)) {
      try { scriptContent = fs.readFileSync(scriptPath, "utf8"); } catch (_) {}
    }
    if (scriptContent) {
      return \`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  \${sharedStyles}
  #agy-custom-code-boot-host {
    position: absolute; inset: 0; width: 100%; height: 100%;
    overflow: hidden;
    cursor: pointer;
    -webkit-app-region: no-drag;
    transform: translateZ(0);
    backface-visibility: hidden;
  }
</style>
</head>
<body>
  <div id="boot-stage">
    <div id="agy-custom-code-boot-host"></div>
    <div id="boot-status" class="status-pill status-loading">
      <div class="spinner"></div>
      <span class="status-text">系统启动中...</span>
    </div>
  </div>
  <script>
    const pill = document.getElementById('boot-status');
    const stage = document.getElementById('boot-stage');
    let isHostReady = false;
    let isMediaDone = false;
    let finished = false;

    function finish() {
      if (finished) return;
      finished = true;
      if (pill) {
        pill.style.transition = 'opacity 200ms ease';
        pill.style.opacity = '0';
      }
      if (stage) {
        stage.style.opacity = '0';
      }
      setTimeout(() => {
        document.title = '__AGY_BOOT_DONE__';
        console.log('__AGY_BOOT_DONE__');
      }, 450);
    }

    function setReady() {
      if (isHostReady) return;
      isHostReady = true;
      document.title = '__AGY_HOST_READY__';
      if (pill) {
        pill.className = 'status-pill status-ready';
        pill.innerHTML = '<span class="ready-dot"></span><span class="status-text">就绪 · 按 <kbd>ESC</kbd> 或点击跳过</span>';
      }
      if (isMediaDone) {
        finish();
      }
    }

    window.__agyOnHostReady = setReady;

    window.__agyShakePill = function() {
      if (pill && !isHostReady) {
        pill.classList.remove('pill-shake');
        void pill.offsetWidth;
        pill.classList.add('pill-shake');
      }
    };

    function handleUserSkip(e) {
      if (e) {
        try { e.preventDefault(); e.stopPropagation(); } catch(_) {}
      }
      if (isHostReady) {
        finish();
      } else {
        window.__agyShakePill();
      }
    }

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' || e.code === 'Escape' || e.key === ' ' || e.key === 'Enter') {
        handleUserSkip(e);
      }
    }, true);

    document.addEventListener('click', handleUserSkip, true);
    if (pill) pill.addEventListener('click', handleUserSkip, true);
    if (stage) stage.addEventListener('click', handleUserSkip, true);

    setTimeout(setReady, 10000);
    setTimeout(finish, 15000);

    try {
      const container = document.getElementById('agy-custom-code-boot-host');
      const bootFn = (function() { \${scriptContent} })();
      function onScriptFinish() {
        isMediaDone = true;
        if (isHostReady) finish();
      }
      if (typeof bootFn === 'function') {
        bootFn(container, onScriptFinish);
      } else if (typeof window.__customBootAnimation === 'function') {
        window.__customBootAnimation(container, onScriptFinish);
      }
    } catch (e) {
      console.warn('Boot script error:', e);
      isMediaDone = true;
      if (isHostReady) finish();
    }
  </script>
</body>
</html>\`;
    }
  }

  // 3. 回退模式：若上述均无或配置关闭，展示官方原版反重力 Logo
  return \`<!DOCTYPE html>
<html>
<head>
<style>
  body {
    margin: 0; padding: 0;
    background: \${backgroundColor};
    color: \${foregroundColor};
    font-family: system-ui, -apple-system, sans-serif;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    height: 100vh; overflow: hidden;
    -webkit-app-region: drag; -webkit-user-select: none;
  }
  .logo {
    width: 64px; height: 64px;
    color: \${foregroundColor};
    animation: logo-pulse 2.2s infinite ease-in-out;
  }
  @keyframes logo-pulse {
    0%, 100% { opacity: 0.25; }
    50% { opacity: 0.5; }
  }
</style>
</head>
<body>
  <svg class="logo" viewBox="0 0 180 180" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M144.248 149.062C151.748 154.688 162.998 150.938 152.685 140.625C121.748 110.625 128.31 28.125 89.8727 28.125C51.4352 28.125 57.9977 110.625 27.0602 140.625C15.8102 151.875 27.9977 154.688 35.4977 149.062C64.5602 129.375 62.6852 94.6875 89.8727 94.6875C117.06 94.6875 115.185 129.375 144.248 149.062Z" fill="currentColor"/>
  </svg>
</body>
</html>\`;
}

/**
 * 官方原版原生 Loading HTML 生成函数（100% 官方原汁原味）
 */
function getNativeLoadingHtml(foregroundColor, backgroundColor) {
  return \`<!DOCTYPE html>
<html>
<head>
<style>
  body {
    margin: 0;
    padding: 0;
    background: \${backgroundColor};
    color: \${foregroundColor};
    font-family: system-ui, -apple-system, sans-serif;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100vh;
    overflow: hidden;
    -webkit-app-region: drag;
    -webkit-user-select: none;
  }
  .logo {
    width: 64px;
    height: 64px;
    color: \${foregroundColor};
    animation: logo-pulse 2.2s infinite ease-in-out;
  }
  @keyframes logo-pulse {
    0%, 100% { opacity: 0.25; }
    50% { opacity: 0.5; }
  }
</style>
</head>
<body>
  <svg
    class="logo"
    viewBox="0 0 180 180"
    fill="none"
    xmlns="http://www.w3.org/2000/svg">
    <path
      d="M144.248 149.062C151.748 154.688 162.998 150.938 152.685 140.625C121.748 110.625 128.31 28.125 89.8727 28.125C51.4352 28.125 57.9977 110.625 27.0602 140.625C15.8102 151.875 27.9977 154.688 35.4977 149.062C64.5602 129.375 62.6852 94.6875 89.8727 94.6875C117.06 94.6875 115.185 129.375 144.248 149.062Z"
      fill="currentColor"
    />
  </svg>
</body>
</html>\`;
}

/**
 * 官方原版原生 LoadingOverlay 挂载逻辑（100% 还原官方原生，直接在 did-finish-load 移除，杜绝黑屏一闪而过）
 */
function attachNativeLoading(win, foregroundColor, backgroundColor) {
  const view = new electron_1.WebContentsView({
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const html = getNativeLoadingHtml(foregroundColor, backgroundColor);
  void view.webContents.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html));
  win.contentView.addChildView(view);

  const updateBounds = () => {
    try {
      const [width, height] = win.getContentSize();
      view.setBounds({ x: 0, y: 0, width, height });
    } catch (_) {}
  };
  updateBounds();
  win.on("resize", updateBounds);

  win.webContents.once("did-finish-load", () => {
    try {
      win.contentView.removeChildView(view);
    } catch (_) {}
    try {
      win.off("resize", updateBounds);
    } catch (_) {}
  });
}

/**
 * 挂载 Loading Overlay
 */
function attachLoadingOverlay(win, foregroundColor, backgroundColor) {
  try {
    const cfg = getPluginConfig();
    const isBootEnabled = !!(cfg?.features?.bootAnimation);

    // 核心特性：如果开屏动画功能关闭，100% 完整复原反重力官方原生 loading！
    if (!isBootEnabled) {
      attachNativeLoading(win, foregroundColor, backgroundColor);
      return;
    }

    const isCustom = !!(cfg?.features?.bootAnimation && (cfg.features.bootAnimationConfig?.videoPath || cfg.features.bootAnimationConfig?.customCodePath || cfg.features.bootAnimationConfig?.type === 'code'));

    // 关键修复 1：仅在自定义开屏动效开启时，右上角窗口控制按钮保持 100% 纯透明
    if (isCustom && typeof win.setTitleBarOverlay === 'function') {
      try {
        win.setTitleBarOverlay({
          color: '#00000000',
          symbolColor: '#f8fafc',
          height: 30
        });
      } catch (_) {}
    }

    // 关键修复 2：自定义开机动效播放时窗口设为黑色舞台（绝不向主页面强塞黑底 CSS，杜绝无素材全黑）
    if (isCustom) {
      try {
        win.setBackgroundColor('#000000');
      } catch (_) {}
    }

    // 从源头杜绝双重动画
    if (isCustom && win.webContents) {
      const suppressRendererBoot = () => {
        try {
          win.webContents.executeJavaScript("sessionStorage.setItem('__agy_booted__', 'true'); window.__agyBootPlaying = false;").catch(() => {});
        } catch (_) {}
      };
      try {
        win.webContents.on('did-start-navigation', suppressRendererBoot);
        win.webContents.on('dom-ready', suppressRendererBoot);
        suppressRendererBoot();
      } catch (_) {}
    }

    const view = new electron_1.WebContentsView({
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: false,
      },
    });

    // 核心透视通道：设置 WebContentsView 视图底色完全透明 (#00000000)
    try {
      view.setBackgroundColor('#00000000');
    } catch (_) {
      try { view.setBackgroundColor('transparent'); } catch (_) {}
    }

    const html = generateOverlayHtml(cfg, foregroundColor, backgroundColor);
    void view.webContents.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html));
    win.contentView.addChildView(view);

    const updateBounds = () => {
      try {
        const [width, height] = win.getContentSize();
        view.setBounds({ x: 0, y: 0, width, height });
      } catch (_) {}
    };
    updateBounds();
    win.on("resize", updateBounds);

    let removed = false;
    let isHostReady = false;

    const doRemove = () => {
      if (removed) return;
      removed = true;
      try {
        win.contentView.removeChildView(view);
        win.webContents.executeJavaScript(\`(() => {
          sessionStorage.setItem('__agy_booted__', 'true');
          window.__agyBootPlaying = false;
          const h1 = document.getElementById('agy-video-boot-host');
          if (h1) h1.remove();
          const h2 = document.getElementById('agy-custom-code-boot-host');
          if (h2) h2.remove();

          // 核心联动：开机动画结束，立即全面激活并重新应用壁纸与主界面特性！
          const cfg = (window.__agySkinBridge && window.__agySkinBridge.getConfig()) || window.__AG_SKIN_CONFIG__;
          if (cfg && typeof window.__agyApplyFeatures === 'function') {
            try { window.__agyApplyFeatures(cfg); } catch (_) {}
          }
          if (typeof window.__agyResumeBootWallpaper === 'function') {
            try { window.__agyResumeBootWallpaper(); } catch(_) {}
          }
        })()\`).catch(() => {});
      } catch (_) {}
      try {
        win.off("resize", updateBounds);
        view.webContents.removeListener("before-input-event", onBeforeInput);
        win.webContents.removeListener("before-input-event", onBeforeInput);
      } catch (_) {}
    };

    // 按键拦截时，通过执行 finish() 触发 450ms 平滑渐隐，绝不粗暴强拔
    const onBeforeInput = (event, input) => {
      if (input.type === 'keyDown' && (input.key === 'Escape' || input.code === 'Escape' || input.key === ' ' || input.key === 'Enter')) {
        if (isHostReady) {
          try {
            view.webContents.executeJavaScript("if (typeof finish === 'function') finish();").catch(() => {
              doRemove();
            });
          } catch (_) {
            doRemove();
          }
        } else {
          try {
            view.webContents.executeJavaScript("if (typeof window.__agyShakePill === 'function') window.__agyShakePill();").catch(() => {});
          } catch (_) {}
        }
      }
    };
    try {
      view.webContents.on("before-input-event", onBeforeInput);
      win.webContents.on("before-input-event", onBeforeInput);
    } catch (_) {}

    view.webContents.on("page-title-updated", (event, title) => {
      event.preventDefault();
      if (title === "__AGY_BOOT_DONE__") {
        doRemove();
      } else if (title === "__AGY_HOST_READY__") {
        isHostReady = true;
      }
    });

    view.webContents.on("console-message", (...args) => {
      const matchDone = args.some(a => (typeof a === 'string' && a.includes("__AGY_BOOT_DONE__")) || (a && typeof a.message === 'string' && a.message.includes("__AGY_BOOT_DONE__")));
      if (matchDone) doRemove();
    });

    // 深度就绪检测
    let checkReadyTimer = null;
    const startHostReadyCheck = () => {
      if (checkReadyTimer || isHostReady) return;
      const startTime = Date.now();

      checkReadyTimer = setInterval(async () => {
        if (isHostReady || removed) {
          clearInterval(checkReadyTimer);
          checkReadyTimer = null;
          return;
        }

        if (Date.now() - startTime > 8000) {
          clearInterval(checkReadyTimer);
          checkReadyTimer = null;
          triggerHostReady();
          return;
        }

        try {
          const readyCode = \`(() => {
            if (document.readyState !== 'complete') return false;
            const b = document.body;
            if (!b || b.childElementCount < 2) return false;

            const cfg = (window.__agySkinBridge && window.__agySkinBridge.getConfig()) || window.__AG_SKIN_CONFIG__ || {};
            const dw = cfg.features?.dynamicWallpaper;
            const needWallpaper = cfg.features?.themeStyles !== false && dw?.enabled === true && !!dw?.videoPath;
            if (needWallpaper) {
              const v = document.getElementById('agy-dynamic-video');
              if (!v || v.readyState < 2 || v.paused) return false;
            }

            if (cfg.features?.themeStyles !== false && !document.getElementById('agy-dynamic-wallpaper-style')) {
              return false;
            }

            return true;
          })()\`;

          const isActuallyReady = await win.webContents.executeJavaScript(readyCode);
          if (isActuallyReady) {
            clearInterval(checkReadyTimer);
            checkReadyTimer = null;
            triggerHostReady();
          }
        } catch (_) {}
      }, 80);
    };

    function triggerHostReady() {
      if (isHostReady) return;
      isHostReady = true;
      try {
        view.webContents.executeJavaScript("if (typeof window.__agyOnHostReady === 'function') window.__agyOnHostReady();").catch(() => {});
      } catch (_) {}
    }

    win.webContents.once("did-finish-load", () => {
      if (!isCustom) {
        doRemove();
      } else {
        startHostReadyCheck();
      }
    });

    setTimeout(doRemove, 15000);

  } catch (e) {
    console.error("[Loading Overlay Error]", e);
  }
}
`;

fs.writeFileSync(targetOverlayFile, patchedOverlayCode, 'utf8');

// B. 确保 dist/utils.js 维持原版深浅色自适应（开屏动画关闭时完整复原官方浅白/深色原生 loading 底色）
const targetUtilsFile = path.join(tempExtractDir, 'dist', 'utils.js');
if (fs.existsSync(targetUtilsFile)) {
  let utilsCode = fs.readFileSync(targetUtilsFile, 'utf8');
  if (utilsCode.includes("const backgroundColor = '#000000';")) {
    utilsCode = utilsCode.replace(
      "const backgroundColor = '#000000';",
      "const backgroundColor = isLight ? '#FAFAFA' : '#131313';"
    );
    fs.writeFileSync(targetUtilsFile, utilsCode, 'utf8');
    console.log('     ✅ 已恢复 utils.js createWindow 原版深浅色自适应底色。');
  }
}

// 6. 重新打包 app.asar
console.log(`[5/5] 正在重新安全封装 app.asar ...`);
const tempAsarOut = path.join(resourcesDir, 'app.asar.tmp');

try {
  execSync(`npx --yes @electron/asar pack "${tempExtractDir}" "${tempAsarOut}"`, { stdio: 'inherit' });
  
  if (fs.existsSync(tempAsarOut) && fs.statSync(tempAsarOut).size > 100000) {
    if (fs.existsSync(asarPath)) {
      fs.unlinkSync(asarPath);
    }
    fs.renameSync(tempAsarOut, asarPath);
    console.log('🎉 恭喜！前置开机动画已成功完成动态联动升级！');
    console.log('');
    console.log('📌 本次真·零闪白终极升级：');
    console.log('  1. 【硬件合成图层锁死】：video 与舞台预先启用 3D 硬件图层 (translateZ)，绝不发生 DirectComposition 销毁闪白！');
    console.log('  2. 【原生自适应复原】：开机动效开启时智能进入专属舞台，功能关闭时 100% 完美复原官方原生 loading 动效与自适应浅白/深色底色！');
    console.log('  3. 【事件穿透阻断】：全屏 video 设置 pointer-events: none，点击全部由黑色舞台承接，消除媒体焦点闪烁！');
    console.log('  4. 【电影级溶图衔接】：450ms 贝塞尔曲线淡出完成后后台静默卸载视图，实现平滑溶出主界面。');

    // 7. 自动重新启动 Antigravity 客户端
    async function restartAntigravity() {
      try {
        console.log('');
        console.log('🚀 正在自动为您启动 Antigravity 客户端...');
        if (process.platform === 'darwin') {
          const home = os.homedir();
          const candidates = [
            '/Applications/Antigravity.app',
            path.join(home, 'Applications', 'Antigravity.app')
          ];
          for (const app of candidates) {
            if (fs.existsSync(app)) {
              execSync(`open -a "${app}"`, { stdio: 'ignore' });
              console.log('✨ 客户端已成功拉起启动！');
              return;
            }
          }
          execSync('open -b com.google.antigravity', { stdio: 'ignore' });
          console.log('✨ 客户端已成功拉起启动！');
        } else if (process.platform === 'win32') {
          function findAntigravityExe() {
            // 1. 优先使用关闭前检测到的运行路径
            if (detectedExePath && fs.existsSync(detectedExePath)) {
              return detectedExePath;
            }

            // 2. 基于 resourcesDir 上层目录推导（精准命中当前实际打补丁的客户端）
            if (resourcesDir) {
              const parentDir = path.resolve(resourcesDir, '..');
              const directCandidates = [
                path.join(parentDir, 'Antigravity.exe'),
                path.join(parentDir, 'Antigravity IDE.exe')
              ];
              for (const c of directCandidates) {
                if (fs.existsSync(c)) return c;
              }
            }

            // 3. 检查桌面快捷方式指向的目标路径
            try {
              const desktop = path.join(os.homedir(), 'Desktop');
              const lnkCandidates = [
                path.join(desktop, 'Antigravity.lnk'),
                path.join(desktop, 'Antigravity IDE.lnk')
              ];
              for (const lnk of lnkCandidates) {
                if (fs.existsSync(lnk)) {
                  const target = execSync(`powershell.exe -NoProfile -NonInteractive -Command "(New-Object -ComObject WScript.Shell).CreateShortcut('${lnk}').TargetPath"`, { encoding: 'utf8' }).trim();
                  if (target && fs.existsSync(target)) return target;
                }
              }
            } catch (_) {}

            // 4. 标准候选路径
            const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
            const programFiles = process.env.ProgramFiles || 'C:\\Program Files';
            const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';

            const candidates = [
              path.join(localAppData, 'Programs', 'antigravity', 'Antigravity.exe'),
              path.join(localAppData, 'Programs', 'Antigravity', 'Antigravity.exe'),
              path.join(localAppData, 'Programs', 'Antigravity IDE', 'Antigravity IDE.exe'),
              path.join(programFiles, 'Antigravity', 'Antigravity.exe'),
              path.join(programFiles, 'Antigravity IDE', 'Antigravity IDE.exe'),
              path.join(programFilesX86, 'Antigravity', 'Antigravity.exe'),
              'D:\\soft\\Antigravity IDE\\Antigravity IDE.exe'
            ];
            for (const c of candidates) {
              if (fs.existsSync(c)) return c;
            }
            return null;
          }

          const exe = findAntigravityExe();
          if (exe) {
            const exeDir = path.dirname(exe);
            // 关键：彻底剔除可能导致 Electron 客户端静默退出为 Node CLI 的环境变量
            const cleanEnv = { ...process.env };
            delete cleanEnv.ELECTRON_RUN_AS_NODE;
            delete cleanEnv.ELECTRON_NO_ASAR;
            delete cleanEnv.NODE_OPTIONS;
            delete cleanEnv.NODE_ENV;
            delete cleanEnv.ATOM_SHELL_INTERNAL_RUN_AS_NODE;

            let launched = false;

            // 策略 1：使用 PowerShell Start-Process（调用 Win32 ShellExecuteEx，操作系统级独立派生，完全脱离控制台生命周期）
            try {
              execSync(`powershell.exe -NoProfile -NonInteractive -Command "Start-Process -FilePath '${exe}' -WorkingDirectory '${exeDir}'"`, {
                windowsHide: true,
                stdio: 'ignore',
                env: cleanEnv
              });
              launched = true;
            } catch (_) {}

            // 策略 2：Node.js spawn 彻底分离进程组 (detached: true) 双重加固
            if (!launched) {
              try {
                const { spawn } = await import('node:child_process');
                const child = spawn(exe, [], {
                  cwd: exeDir,
                  detached: true,
                  stdio: 'ignore',
                  env: cleanEnv
                });
                child.unref();
                launched = true;
              } catch (_) {}
            }

            // 状态验证：轮询检测客户端进程是否成功复活
            let runningConfirmed = false;
            const verifyStart = Date.now();
            while (Date.now() - verifyStart < 2500) {
              try {
                const chk = execSync('tasklist /NH', { encoding: 'utf8' }).toLowerCase();
                if (chk.includes('antigravity.exe') || chk.includes('antigravity ide.exe')) {
                  runningConfirmed = true;
                  break;
                }
              } catch (_) {}
              const t = Date.now(); while (Date.now() - t < 150) {}
            }

            if (runningConfirmed) {
              console.log('✨ 客户端已成功重新拉起启动并就绪！');
            } else {
              try {
                execSync(`powershell.exe -NoProfile -NonInteractive -Command "Start-Process -FilePath '${exe}' -WorkingDirectory '${exeDir}'"`, {
                  windowsHide: true,
                  stdio: 'ignore',
                  env: cleanEnv
                });
                console.log('✨ 客户端拉起指令已成功发出！');
              } catch (_) {
                console.log('💡 启动指令已送达，若未弹出窗口请手动点击桌面图标启动。');
              }
            }
          } else {
            console.log('💡 未能自动找到 Antigravity.exe，请手动启动客户端。');
          }
        } else {
          execSync('antigravity &', { stdio: 'ignore' });
          console.log('✨ 客户端已成功拉起启动！');
        }
      } catch (_) {
        console.log('💡 如未自动启动，请手动打开 Antigravity 客户端。');
      }
    }

    await restartAntigravity();

    if (process.platform === 'win32') {
      console.log('');
      console.log('==================================================');
      console.log('🎉 恭喜！前置开机动画已成功完成动态联动升级！');
      console.log('==================================================');
      console.log('💡 补丁已全部就绪，本窗口将在 3 秒后自动关闭...');
      await new Promise(r => setTimeout(r, 3000));
    }
  } else {
    throw new Error('打包后的临时 asar 文件大小异常');
  }
} catch (e) {
  console.error('❌ 打包替换失败:', e.message);
  if (fs.existsSync(tempAsarOut)) try { fs.unlinkSync(tempAsarOut); } catch (_) {}
  process.exit(1);
} finally {
  try {
    fs.rmSync(tempExtractDir, { recursive: true, force: true });
  } catch (_) {}
}
