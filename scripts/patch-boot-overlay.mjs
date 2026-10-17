import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

console.log('==================================================');
console.log('  Antigravity 前置开机动画终极防闪白溶出补丁');
console.log('==================================================');

// 1. 定位 Antigravity resources 目录
function findResourcesDir() {
  const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
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

// 2. 检查 Antigravity 是否正在运行
function isProcessRunning() {
  try {
    const out = execSync('tasklist /FI "IMAGENAME eq Antigravity.exe" /NH', { encoding: 'utf8' });
    return out.toLowerCase().includes('antigravity.exe');
  } catch (_) {
    return false;
  }
}

if (isProcessRunning()) {
  console.log('⚠️ 检测到 Antigravity 客户端正在运行！');
  console.log('   由于 Windows 系统安全机制，运行中的程序会锁定 app.asar 文件。');
  console.log('   👉 请先彻底退出 Antigravity 客户端（右键系统托盘图标退出），然后重新运行本脚本！');
  process.exit(0);
}

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
  execSync(`npx --yes asar extract "${asarPath}" "${tempExtractDir}"`, { stdio: 'inherit' });
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
      const vidUrl = "file:///" + vidPath.replace(/\\\\/g, "/");
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
 * 挂载 Loading Overlay
 */
function attachLoadingOverlay(win, foregroundColor, backgroundColor) {
  try {
    const cfg = getPluginConfig();
    if (cfg && cfg.features && cfg.features.bootAnimation === false) {
      return;
    }

    const isCustom = !!(cfg?.features?.bootAnimation && (cfg.features.bootAnimationConfig?.videoPath || cfg.features.bootAnimationConfig?.customCodePath || cfg.features.bootAnimationConfig?.type === 'code'));

    // 关键修复 1：右上角窗口控制按钮 100% 纯透明
    if (isCustom && typeof win.setTitleBarOverlay === 'function') {
      try {
        win.setTitleBarOverlay({
          color: '#00000000',
          symbolColor: '#f8fafc',
          height: 30
        });
      } catch (_) {}
    }

    // 关键修复 2：主窗口底色绝对锁黑，并在底层主页面注入黑底防护，杜绝任何白底闪烁！
    if (isCustom) {
      try {
        win.setBackgroundColor('#000000');
      } catch (_) {}
      try {
        win.webContents.on('did-start-navigation', () => {
          win.webContents.insertCSS("html, body { background: #000000 !important; background-color: #000000 !important; }").catch(() => {});
        });
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

// B. 关键增强：对 dist/utils.js 中的 createWindow 进行纯黑物理加固，杜绝 BrowserWindow 浅色默认背景
const targetUtilsFile = path.join(tempExtractDir, 'dist', 'utils.js');
if (fs.existsSync(targetUtilsFile)) {
  let utilsCode = fs.readFileSync(targetUtilsFile, 'utf8');
  // 查找 backgroundColor 的定义处，将浅色回退锁定为 #000000
  if (utilsCode.includes("const backgroundColor = isLight ? '#FAFAFA' : '#131313';")) {
    utilsCode = utilsCode.replace(
      "const backgroundColor = isLight ? '#FAFAFA' : '#131313';",
      "const backgroundColor = '#000000';"
    );
    fs.writeFileSync(targetUtilsFile, utilsCode, 'utf8');
    console.log('     ✅ 已对 utils.js createWindow 进行纯黑物理锁死 (原生 BrowserWindow 100% 黑底防闪)。');
  }
}

// 6. 重新打包 app.asar
console.log(`[5/5] 正在重新安全封装 app.asar ...`);
const tempAsarOut = path.join(resourcesDir, 'app.asar.tmp');

try {
  execSync(`npx --yes asar pack "${tempExtractDir}" "${tempAsarOut}"`, { stdio: 'inherit' });
  
  if (fs.existsSync(tempAsarOut) && fs.statSync(tempAsarOut).size > 100000) {
    if (fs.existsSync(asarPath)) {
      fs.unlinkSync(asarPath);
    }
    fs.renameSync(tempAsarOut, asarPath);
    console.log('🎉 恭喜！前置开机动画已成功完成动态联动升级！');
    console.log('');
    console.log('📌 本次真·零闪白终极升级：');
    console.log('  1. 【硬件合成图层锁死】：video 与舞台预先启用 3D 硬件图层 (translateZ)，绝不发生 DirectComposition 销毁闪白！');
    console.log('  2. 【原生 BrowserWindow 物理锁黑】：修改 utils.js 原生窗口底色从诞生第一纳秒即锁定 #000000，彻底根除 #FAFAFA 浅色闪现！');
    console.log('  3. 【事件穿透阻断】：全屏 video 设置 pointer-events: none，点击全部由黑色舞台承接，消除媒体焦点闪烁！');
    console.log('  4. 【电影级溶图衔接】：450ms 贝塞尔曲线淡出完成后后台静默卸载视图，实现平滑溶出主界面。');
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
