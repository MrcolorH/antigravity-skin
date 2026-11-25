"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.attachLoadingOverlay = attachLoadingOverlay;

const electron_1 = require("electron");
const fs = require("fs");
const path = require("path");
const os = require("os");
const url = require("url");

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

function hasValidWallpaperSource(dw) {
  if (!dw || typeof dw !== 'object') return false;
  const sourceType = dw.sourceType || (dw.wallpaperDir ? 'scene' : 'video');
  if (sourceType === 'video') {
    return !!(dw.videoPath && String(dw.videoPath).trim());
  }
  return !!(dw.wallpaperDir && String(dw.wallpaperDir).trim());
}

function isWallpaperSkinActive(cfg) {
  if (!cfg || cfg.enabled === false) return false;
  const f = cfg.features || {};
  if (f.themeStyles === false) return false;
  const dw = f.dynamicWallpaper || {};
  return dw.enabled === true && hasValidWallpaperSource(dw);
}

function isBootActiveEffective(cfg) {
  if (!cfg || cfg.enabled === false) return false;
  const f = cfg.features || {};
  return f.themeStyles !== false && f.bootAnimation === true;
}

// 全局防御：拦截 BrowserWindow.prototype.setTitleBarOverlay
// 仅在开屏激活期间或动态壁纸皮肤激活态下保持纯透明底色；原版状态下原样放行原生实色标题栏
try {
  const BW = electron_1.BrowserWindow;
  if (BW && BW.prototype && typeof BW.prototype.setTitleBarOverlay === 'function' && !BW.__agyWcoProtoHooked) {
    BW.__agyWcoProtoHooked = true;
    const rawProtoSetTitleBarOverlay = BW.prototype.setTitleBarOverlay;
    BW.prototype.setTitleBarOverlay = function(options) {
      try {
        if (options && typeof options === 'object' && options.color && options.color !== 'rgba(0, 0, 0, 0)') {
          this.__agyLastNativeWcoOptions = Object.assign({}, options);
        }
        const cfg = getPluginConfig();
        const shouldForceTransparent = !!(this.__agyBootOverlayActive || isWallpaperSkinActive(cfg));
        if (shouldForceTransparent && options && typeof options === 'object') {
          options = Object.assign({}, options, {
            color: 'rgba(0, 0, 0, 0)'
          });
        }
      } catch (_) {}
      return rawProtoSetTitleBarOverlay.call(this, options);
    };
  }
} catch (_) {}

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
 * 生成开机引导 HTML
 */
function generateOverlayHtml(cfg, foregroundColor, backgroundColor) {
  const bootCfg = cfg?.features?.bootAnimationConfig || {};
  const bootType = bootCfg.type || "video";
  const autoEnterDelay = Number.isFinite(bootCfg.autoEnterDelay) ? Math.max(0, Math.min(10, Math.round(bootCfg.autoEnterDelay))) : 3;

  const sharedStyles = `
  * {
    margin: 0; padding: 0; box-sizing: border-box;
    -webkit-tap-highlight-color: transparent !important;
    outline: none !important;
  }
  html, body {
    background: transparent !important;
    background-color: transparent !important;
    width: 100vw; height: 100vh;
    overflow: hidden;
    -webkit-user-select: none; user-select: none;
    -webkit-app-region: no-drag;
    cursor: default;
  }
  #boot-stage {
    position: fixed; inset: 0; width: 100vw; height: 100vh;
    background: #000000;
    display: flex; align-items: center; justify-content: center;
    transition: opacity 450ms cubic-bezier(0.25, 1, 0.5, 1), transform 450ms cubic-bezier(0.25, 1, 0.5, 1);
    will-change: opacity, transform;
    transform: translateZ(0);
    backface-visibility: hidden;
    z-index: 1000;
  }
  .status-pill {
    position: absolute; bottom: 28px; right: 32px;
    padding: 8px 18px; border-radius: 9999px;
    background: rgba(15, 23, 42, 0.85);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.15);
    color: rgba(255, 255, 255, 0.88);
    font-size: 13px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
    display: flex; align-items: center; gap: 10px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    user-select: none; -webkit-user-select: none;
    -webkit-app-region: no-drag;
    transition: all 300ms cubic-bezier(0.16, 1, 0.3, 1);
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
    border-color: rgba(52, 211, 153, 0.5);
    background: rgba(15, 23, 42, 0.92);
  }
  .status-ready:hover {
    background: rgba(30, 41, 59, 0.98);
    border-color: rgba(52, 211, 153, 0.85);
    transform: translateY(-1px);
    box-shadow: 0 10px 36px rgba(16, 185, 129, 0.28);
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
  `;

  // 1. 视频模式（零白闪、零黑屏、T=0秒秒播）
  if (bootType === "video") {
    const rawVidPath = resolveAssetPath(bootCfg.videoPath, "videos");
    if (rawVidPath && fs.existsSync(rawVidPath)) {
      const vidUrl = url.pathToFileURL(rawVidPath).href;
      const fit = bootCfg.fit || 'cover';
      const fitPos = bootCfg.fitPosition || 'center';
      const brightness = Number.isFinite(bootCfg.brightness) ? bootCfg.brightness : 1;
      const contrast = Number.isFinite(bootCfg.contrast) ? bootCfg.contrast : 1;

      return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  ${sharedStyles}
  video {
    width: 100%; height: 100%;
    object-fit: ${fit};
    object-position: ${fitPos};
    filter: brightness(${brightness}) contrast(${contrast});
    pointer-events: none;
    -webkit-app-region: no-drag;
    transform: translateZ(0);
    backface-visibility: hidden;
  }
</style>
</head>
<body>
  <div id="boot-stage">
    <video id="boot-vid" src="${vidUrl}" autoplay loop muted playsinline></video>
    <div id="boot-status" class="status-pill status-loading">
      <div class="spinner"></div>
      <span class="status-text">系统准备中...</span>
    </div>
  </div>
  <script>
    const v = document.getElementById('boot-vid');
    const pill = document.getElementById('boot-status');
    const stage = document.getElementById('boot-stage');
    let isHostReady = false;
    let finished = false;
    let autoEnterTimer = null;
    const autoEnterDelay = ${autoEnterDelay};

    function finish() {
      if (finished) return;
      finished = true;
      if (autoEnterTimer) { clearTimeout(autoEnterTimer); autoEnterTimer = null; }

      // 核心修正：绝不在独立 WebContentsView 内部盲等 450ms 纯黑！立即解绑移除遮罩，直接无感切换至已 100% 渲染成型的主工作区
      document.title = '__AGY_BOOT_DONE__';
      console.log('__AGY_BOOT_DONE__');
    }

    function setReady() {
      if (isHostReady) return;
      isHostReady = true;
      document.title = '__AGY_HOST_READY__';
      if (pill) {
        pill.className = 'status-pill status-ready';
        pill.innerHTML = '<span class="ready-dot"></span><span class="status-text">进入工作区 · 按 <kbd>ESC</kbd> 或点击</span>';
      }
      // 若配置了自动进入秒数（且 > 0），到点自动平滑淡入工作区
      if (autoEnterDelay > 0) {
        autoEnterTimer = setTimeout(finish, autoEnterDelay * 1000);
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

    // 极限保底：若因任何极端原因未收到宿主通知，10 秒必定强行变绿防死锁（正常由宿主就绪 2 秒内极速触发）
    setTimeout(setReady, 10000);
  </script>
</body>
</html>`;
    }
  }

  // 默认纯黑静默过渡（消除官方 Logo）
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  html, body {
    margin: 0; padding: 0;
    background: #000000 !important;
    background-color: #000000 !important;
    height: 100vh; width: 100vw;
    overflow: hidden;
  }
</style>
</head>
<body></body>
</html>`;
}

/**
 * 挂载 Loading Overlay
 */
function attachLoadingOverlay(win, foregroundColor, backgroundColor) {
  try {
    const cfg = getPluginConfig();
    const isBootEnabled = isBootActiveEffective(cfg);
    const isWallActiveAtBoot = isWallpaperSkinActive(cfg);
    win.__agyBootOverlayActive = isBootEnabled;

    // 核心解除：强制关闭 Chromium 对底层主渲染进程的后台节流，确保全速 60fps 初始化与着色器编译！
    try {
      if (win.webContents && typeof win.webContents.setBackgroundThrottling === 'function') {
        win.webContents.setBackgroundThrottling(false);
      }
    } catch (_) {}

    // 主窗口原生底色与标题栏(WCO)：仅在开屏激活或壁纸皮肤激活时设黑与纯透明，否则保留官方原版设置
    if (typeof win.setTitleBarOverlay === 'function' && !win.__agyWcoWinHooked) {
      win.__agyWcoWinHooked = true;
      const rawWinSetTitleBarOverlay = win.setTitleBarOverlay.bind(win);
      win.setTitleBarOverlay = function(options) {
        try {
          if (options && typeof options === 'object' && options.color && options.color !== 'rgba(0, 0, 0, 0)') {
            win.__agyLastNativeWcoOptions = Object.assign({}, options);
          }
          const liveCfg = getPluginConfig();
          const shouldForceTransparent = !!(win.__agyBootOverlayActive || isWallpaperSkinActive(liveCfg));
          if (shouldForceTransparent && options && typeof options === 'object') {
            options = Object.assign({}, options, {
              color: 'rgba(0, 0, 0, 0)'
            });
          }
        } catch (_) {}
        return rawWinSetTitleBarOverlay(options);
      };
    }

    const TITLEBAR_H = 30;
    const applyTitleBarOverlay = (isDark) => {
      try {
        if (!win || win.isDestroyed()) return;
        if (typeof win.setTitleBarOverlay !== 'function') return;
        win.setTitleBarOverlay({
          color: 'rgba(0, 0, 0, 0)',
          symbolColor: isDark ? '#e8eef7' : '#1c2430',
          height: TITLEBAR_H
        });
      } catch (_) {}
    };

    const restoreNativeTitleBarAndBg = () => {
      try {
        if (!win || win.isDestroyed()) return;
        const dark = !!(electron_1.nativeTheme && electron_1.nativeTheme.shouldUseDarkColors);
        const fallbackBg = backgroundColor || (dark ? '#131313' : '#FAFAFA');
        try { win.setBackgroundColor(fallbackBg); } catch (_) {}
        if (typeof win.setTitleBarOverlay === 'function') {
          const nativeOpts = win.__agyLastNativeWcoOptions
            ? Object.assign({}, win.__agyLastNativeWcoOptions)
            : {
                color: backgroundColor || (dark ? '#131313' : '#FFFFFF'),
                symbolColor: foregroundColor || (dark ? '#FAFAFA' : '#334155'),
                height: TITLEBAR_H
              };
          win.setTitleBarOverlay(nativeOpts);
        }
      } catch (_) {}
    };

    let lastTitleBarDark = true;
    const syncTitleBarTone = (force) => {
      try {
        if (!win || win.isDestroyed() || !win.webContents) return;
        const liveCfg = getPluginConfig();
        if (!win.__agyBootOverlayActive && !isWallpaperSkinActive(liveCfg)) return;
        win.webContents.executeJavaScript(`(() => {
          const el = document.documentElement;
          const top = parseFloat(el.dataset.agyTopLum || '');
          const all = parseFloat(el.dataset.agyWallpaperLum || '');
          const v = isNaN(top) ? all : top;
          if (!isNaN(v)) return v;
          return el.classList.contains('agy-dark-wallpaper') ? 0.04 : 0.96;
        })()`).then((lum) => {
          const isDark = typeof lum === 'number' ? lum < 0.32 : true;
          if (!force && isDark === lastTitleBarDark) return;
          lastTitleBarDark = isDark;
          applyTitleBarOverlay(isDark);
        }).catch(() => {});
      } catch (_) {}
    };

    if (isBootEnabled || isWallActiveAtBoot) {
      try {
        win.setBackgroundColor('#000000');
        applyTitleBarOverlay(true);
      } catch (_) {}
    }

    // 壁纸切换 / 窗口重新聚焦时自动跟随顶部壁纸明暗，保证按钮始终清晰可见
    if (!win.__agyTitleBarToneHooked) {
      win.__agyTitleBarToneHooked = true;
      try { win.on('focus', () => syncTitleBarTone(false)); } catch (_) {}
      try { win.on('restore', () => syncTitleBarTone(false)); } catch (_) {}
    }

    const buildRendererBootSyncScript = ({ overlayActive, removeHosts = false, resumeWallpaper = false } = {}) => `(() => {
      try {
        window.__agyMasterBootHandled = true;
        window.__agyHostOverlayActive = ${overlayActive ? 'true' : 'false'};
        try { sessionStorage.setItem('__agy_booted__', 'true'); } catch (_) {}
        window.__agyBootPlaying = false;${removeHosts ? `
        const h1 = document.getElementById('agy-video-boot-host');
        if (h1) h1.remove();
        const h2 = document.getElementById('agy-custom-code-boot-host');
        if (h2) h2.remove();` : ''}
        try {
          const st = document.getElementById('agy-macos-anti-flash');
          if (st) st.remove();
          if (document.documentElement && (document.documentElement.style.background === 'rgb(0, 0, 0)' || document.documentElement.style.background === '#000000')) {
            document.documentElement.style.background = '';
          }
          if (document.body && (document.body.style.background === 'rgb(0, 0, 0)' || document.body.style.background === '#000000')) {
            document.body.style.background = '';
          }
          if (typeof window.__agyCleanMacAntiFlash === 'function') {
            window.__agyCleanMacAntiFlash();
          }
        } catch (_) {}${resumeWallpaper ? `
        if (typeof window.__agyResumeBootWallpaper === 'function') {
          try { window.__agyResumeBootWallpaper(); } catch (_) {}
        }` : ''}
      } catch (_) {}
    })()`;

    // 从源头杜绝前端渲染进程重复播放开机动画与纯黑防闪白残留 (BUG-024)
    if (isBootEnabled && win.webContents) {
      const suppressRendererBoot = () => {
        try {
          win.webContents.executeJavaScript(buildRendererBootSyncScript({ overlayActive: true })).catch(() => {});
        } catch (_) {}
      };
      try {
        win.webContents.on('did-start-navigation', suppressRendererBoot);
        win.webContents.on('did-navigate', suppressRendererBoot);
        win.webContents.on('dom-ready', suppressRendererBoot);
        win.webContents.on('did-finish-load', suppressRendererBoot);
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

    try {
      view.setBackgroundColor('#00000000');
    } catch (_) {}

    const html = generateOverlayHtml(cfg, foregroundColor, backgroundColor);
    void view.webContents.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html));
    win.contentView.addChildView(view);

    const updateBounds = () => {
      try {
        if (win.isDestroyed()) return;
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

      const cleanupNativeView = () => {
        win.__agyBootOverlayActive = false;
        try {
          if (win && !win.isDestroyed()) {
            win.contentView.removeChildView(view);
          }
        } catch (_) {}
        // 幕布移除后：若开启动态壁纸皮肤则交还给壁纸明暗适配；否则还原官方原生实色标题栏与背景
        try {
          const latestCfg = getPluginConfig();
          if (isWallpaperSkinActive(latestCfg)) {
            syncTitleBarTone(true);
            setTimeout(() => syncTitleBarTone(false), 1200);
            setTimeout(() => syncTitleBarTone(false), 4000);
          } else {
            restoreNativeTitleBarAndBg();
          }
        } catch (_) {}
        try {
          view.webContents.close();
        } catch (_) {}
      };

      try {
        win.off("resize", updateBounds);
        view.webContents.removeListener("before-input-event", onBeforeInput);
        win.webContents.removeListener("before-input-event", onBeforeInput);
      } catch (_) {}

      // 核心时序原子化闭环 (BUG-024)：
      // 绝对不能先拔掉顶层遮罩再异步清底层 DOM！
      // 先向渲染进程下发清除指令，保证任何潜在的前端开屏容器已被切除，再安全移走顶层原生视图，彻底消除黑闪与穿帮！
      try {
        if (win && !win.isDestroyed() && win.webContents) {
          let cleanedUp = false;
          const safeCleanup = () => {
            if (cleanedUp) return;
            cleanedUp = true;
            cleanupNativeView();
          };

          win.webContents.executeJavaScript(
            buildRendererBootSyncScript({ overlayActive: false, removeHosts: true, resumeWallpaper: true })
          ).then(safeCleanup).catch(safeCleanup);

          // 35ms 极限防死锁保底：即使 IPC 阻塞也不阻断主窗口呈现
          setTimeout(safeCleanup, 35);
          return;
        }
      } catch (_) {}

      cleanupNativeView();
    };

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

    // 联动唤醒底层壁纸
    const triggerFadeStart = () => {
      try {
        win.webContents.executeJavaScript(
          buildRendererBootSyncScript({ overlayActive: false, resumeWallpaper: true })
        ).catch(() => {});
      } catch (_) {}
    };

    view.webContents.on("page-title-updated", (event, title) => {
      event.preventDefault();
      if (title === "__AGY_BOOT_FADING__") {
        triggerFadeStart();
      } else if (title === "__AGY_BOOT_DONE__") {
        doRemove();
      } else if (title === "__AGY_HOST_READY__") {
        isHostReady = true;
      }
    });

    view.webContents.on("console-message", (...args) => {
      const isFading = args.some(a => (typeof a === 'string' && a.includes("__AGY_BOOT_FADING__")) || (a && typeof a.message === 'string' && a.message.includes("__AGY_BOOT_FADING__")));
      if (isFading) triggerFadeStart();
      const matchDone = args.some(a => (typeof a === 'string' && a.includes("__AGY_BOOT_DONE__")) || (a && typeof a.message === 'string' && a.message.includes("__AGY_BOOT_DONE__")));
      if (matchDone) doRemove();
    });

    function triggerHostReady() {
      if (isHostReady) return;
      isHostReady = true;
      try {
        view.webContents.executeJavaScript("if (typeof window.__agyOnHostReady === 'function') window.__agyOnHostReady();").catch(() => {});
      } catch (_) {}
    }

    // 深度极速就绪检测：1.5 ~ 2 秒极速判定，绝不卡死
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

        // 极限保底：10 秒防死锁放行（正常 2 秒左右由主页面完整成型真实唤醒，绝不提前穿帮抢跑）
        if (Date.now() - startTime > 10000) {
          clearInterval(checkReadyTimer);
          checkReadyTimer = null;
          triggerHostReady();
          return;
        }

        try {
          const readyCode = `(() => {
            // 1. 优先信任前端权威判定
            if (typeof window.__agyIsHostTrulyReady === 'function') {
              return window.__agyIsHostTrulyReady();
            }
            // 2. 基础 DOM 必须摆脱 loading 阶段
            if (document.readyState === 'loading') return false;

            // 3. 必须确保 Antigravity 宿主真实 React 交互框架已渲染成型（绝不在空骨架阶段放行！）
            const hasInput = !!(
              document.querySelector('textarea') ||
              document.querySelector('input') ||
              document.querySelector('[contenteditable="true"]') ||
              document.querySelector('[role="textbox"]')
            );
            if (!hasInput) return false;

            // 4. 插件必须已完成注入
            if (!window.__AG_SKIN_ATTACHED__) return false;

            // 5. 动态壁纸就绪判定（仅当壁纸皮肤激活且存在有效素材时才等待首帧与样式落地）
            const cfg = (window.__agySkinBridge && window.__agySkinBridge.getConfig()) || window.__AG_SKIN_CONFIG__ || {};
            const dw = cfg.features?.dynamicWallpaper;
            const dwSource = dw?.sourceType || (dw?.wallpaperDir ? 'scene' : 'video');
            const dwHasSource = dwSource === 'video'
              ? !!(dw?.videoPath && String(dw.videoPath).trim())
              : !!(dw?.wallpaperDir && String(dw.wallpaperDir).trim());
            if (cfg.enabled !== false && cfg.features?.themeStyles !== false && dw?.enabled === true && dwHasSource) {
              const isScene = dw.sourceType === 'scene' || (!dw.sourceType && !!dw.wallpaperDir);
              if (isScene) {
                const s = document.getElementById('agy-dynamic-scene');
                if (!s) return false;
                const c = s.querySelector('canvas.agy-scene-live') || s.querySelector('canvas');
                const p = s.querySelector('img.agy-scene-poster') || s.querySelector('img.agy-scene-img') || s.querySelector('img');
                const hasVisual = c || (p && p.complete && p.naturalWidth > 0);
                if (!hasVisual) return false;
              } else if (dw.sourceType === 'video' || (!dw.sourceType && dw.videoPath)) {
                const v = document.getElementById('agy-dynamic-video');
                if (!v || v.readyState < 3) return false;
              }

              if (!document.getElementById('agy-dynamic-wallpaper-style')) {
                return false;
              }
            }
            return true;
          })()`;

          const isActuallyReady = await win.webContents.executeJavaScript(readyCode);
          if (isActuallyReady) {
            clearInterval(checkReadyTimer);
            checkReadyTimer = null;
            triggerHostReady();
          }
        } catch (_) {}
      }, 80);
    };

    if (isBootEnabled) {
      // 立即启动检测，不需要死等 did-finish-load，抢跑提速！
      startHostReadyCheck();
      win.webContents.once("did-finish-load", startHostReadyCheck);
    } else {
      win.webContents.once("dom-ready", doRemove);
      win.webContents.once("did-finish-load", doRemove);
      setTimeout(doRemove, 1000);
    }

    // 全局防假死 12 秒保底强制移除
    setTimeout(doRemove, 12000);

  } catch (e) {
    console.error("[Loading Overlay Error]", e);
  }
}
