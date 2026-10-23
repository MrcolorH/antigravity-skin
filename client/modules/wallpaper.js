/**
 * wallpaper.js - Antigravity Dynamic Video Wallpaper & Glassmorphism Engine
 */


// 0. 同步并持久锁定 Windows 原生窗口控制按钮（WCO）强制完全透明与图标色
function syncTitleBarOverlay(force = false) {
  if (typeof window !== 'undefined' && window.electronNative && typeof window.electronNative.setTitleBarOverlay === 'function') {
    const cfg = (window.__agySkinBridge && window.__agySkinBridge.getConfig()) || window.__AG_SKIN_CONFIG__ || {};
    const isCustomThemeEnabled = cfg.features?.themeStyles !== false;

    // 若未启用自定义皮肤与动效增强，恢复官方原生深浅色实色背景
    if (!isCustomThemeEnabled) {
      const isDark = (document.body && (
        document.body.classList.contains('dark') ||
        document.body.classList.contains('theme-dark')
      )) || (document.documentElement && document.documentElement.classList.contains('dark'));
      const color = isDark ? '#18181b' : '#f8fafc';
      const symbolColor = isDark ? '#f4f4f5' : '#334155';
      const cacheKey = `native__${color}__${symbolColor}`;
      if (!force && window.__agyLastTitleBarKey === cacheKey) return;
      window.__agyLastTitleBarKey = cacheKey;

      window.electronNative.setTitleBarOverlay({
        color,
        symbolColor,
        height: 35
      }).catch(() => {});
      return;
    }

    // 核心规范：在自定义皮肤与动效增强开启时，右上角 win 栏三个按钮必须始终保持强制完全透明！
    const isBootPlaying = !!window.__agyBootPlaying ||
                          !!document.getElementById('agy-video-boot-host') ||
                          !!document.getElementById('agy-custom-code-boot-host') ||
                          !!document.getElementById('agy-scene-boot-host') ||
                          (cfg.features?.bootAnimation && !sessionStorage.getItem('__agy_booted__'));

    // 无论开机动画还是主界面视频壁纸/毛玻璃，底色始终强制纯透明
    const color = 'rgba(0, 0, 0, 0)';

    let symbolColor = '#f8fafc';
    if (!isBootPlaying) {
      const isDark = (document.body && (
        document.body.classList.contains('dark') ||
        document.body.classList.contains('theme-dark')
      )) || (document.documentElement && document.documentElement.classList.contains('dark'));
      // 主界面非开机时：根据深浅色自适应图标颜色，浅色主题使用纯黑色图标保证在浅色天空/亮色壁纸下清晰可辨
      symbolColor = isDark ? '#f8fafc' : '#000000';
    }

    const cacheKey = `custom_trans__${color}__${symbolColor}`;
    // 关键修复：在 force 强制模式或开机动画播放中，绝不被缓存阻断！彻底压制宿主在 0~8 秒内异步覆盖的白色背景！
    if (!force && !isBootPlaying && window.__agyLastTitleBarKey === cacheKey) return;
    window.__agyLastTitleBarKey = cacheKey;

    window.electronNative.setTitleBarOverlay({
      color,
      symbolColor,
      height: 35
    }).catch(() => {});
  }
}

window.__agySyncTitleBar = syncTitleBarOverlay;

// 启动阶段多梯队保活执行（彻底压制宿主冷启动 0~8 秒内的延迟主题初始化）
if (typeof window !== 'undefined') {
  syncTitleBarOverlay(true);
  [50, 100, 200, 300, 500, 800, 1200, 1800, 2500, 3500, 5000, 7500].forEach(delay => {
    setTimeout(() => syncTitleBarOverlay(true), delay);
  });
  window.addEventListener('focus', () => syncTitleBarOverlay(true));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') syncTitleBarOverlay(true);
  });

  // 监听 body 和 html class 变动（深浅色切换），即刻同步
  if (typeof MutationObserver !== 'undefined') {
    const themeObs = new MutationObserver(() => {
      syncTitleBarOverlay();
    });
    const observeEl = (el) => {
      if (el) themeObs.observe(el, { attributes: true, attributeFilter: ['class'] });
    };
    observeEl(document.body);
    observeEl(document.documentElement);
    if (!document.body) {
      document.addEventListener('DOMContentLoaded', () => {
        observeEl(document.body);
      }, { once: true });
    }
  }
}

export function initWallpaper(options = {}) {
  let isDestroyed = false;
  let {
    videoUrl = 'http://127.0.0.1:59288/wallpaper.mp4',
    brightness = 0.85,
    contrast = 1.05,
    glassThemeCss = '',
    enableVideo = true,
    // —— 多形态壁纸适配（阶段三）——
    sourceType = 'video',      // 'video' | 'web' | 'scene'
    wallpaperDir = '',         // 外部壁纸绝对目录（零拷贝）
    previewFile = '',
    entryFile = '',
    webUrl = '',               // 网页壁纸入口（Sidecar web-proxy 绝对 URL）
    audioUrl = '',             // 场景壁纸内嵌氛围音
    audioEnabled = false,
    // —— 阶段五：铺满策略（cover / auto / blur / contain / fill）——
    // 默认使用 cover 铺满裁切
    fit = 'cover',
    fitPosition = 'center',
    // —— 阶段八：解耦渲染模式与精细性能项 ——
    fps = 60,
    renderDpr = 1.0,
    sceneRenderer = 'dynamic', // 'dynamic' 实时WebGL2 | 'static' 静态海报
    sceneScripts = false  // SceneScript 沙箱非安全边界，同源宿主默认关（配置可开）
  } = options;

  const API_BASE = `http://127.0.0.1:${window.__AG_SKIN_PORT__ || 59288}`;

  // 1. 设置滤镜变量（安全容错防早期 null）
  function applyFilterVars() {
    if (isDestroyed) return;
    if (document.documentElement && document.documentElement.style) {
      document.documentElement.style.setProperty('--agy-bg-brightness', String(brightness));
      document.documentElement.style.setProperty('--agy-bg-contrast', String(contrast));
    }
  }
  applyFilterVars();

  // 1.5 确保全局默认背景底板存在（无素材时呈现优雅纯白底/深色底，杜绝透出全黑）
  function ensureBackdrop() {
    if (isDestroyed) return null;
    let backdropEl = document.getElementById('agy-wallpaper-backdrop');
    if (!backdropEl) {
      backdropEl = document.createElement('div');
      backdropEl.id = 'agy-wallpaper-backdrop';
      const parent = document.body || document.documentElement;
      if (parent) {
        if (parent === document.body) {
          parent.prepend(backdropEl);
        } else {
          parent.appendChild(backdropEl);
        }
      } else {
        document.addEventListener('DOMContentLoaded', () => {
          if (!isDestroyed && !document.getElementById('agy-wallpaper-backdrop') && document.body) {
            document.body.prepend(backdropEl);
          }
        }, { once: true });
      }
    }
    return backdropEl;
  }

  // 2. 注入全局毛玻璃样式
  function ensureStyle() {
    if (isDestroyed) return;
    applyFilterVars();
    ensureBackdrop();
    const cssToUse = glassThemeCss || window.__AG_SKIN_GLASS_CSS__ || '';
    if (!cssToUse) return;
    let styleEl = document.getElementById('agy-dynamic-wallpaper-style');
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'agy-dynamic-wallpaper-style';
      const container = document.head || document.documentElement || document.body;
      if (container) {
        container.appendChild(styleEl);
      } else {
        document.addEventListener('DOMContentLoaded', () => {
          const c = document.head || document.documentElement || document.body;
          if (c && !document.getElementById('agy-dynamic-wallpaper-style')) {
            c.appendChild(styleEl);
          }
        }, { once: true });
      }
    }
    if (styleEl && styleEl.textContent !== cssToUse) {
      styleEl.textContent = cssToUse;
    }
  }

  // 2.5 挂载时即刻同步一次
  ensureBackdrop();
  syncTitleBarOverlay();

  // 3. 动态壁纸推迟加载状态与超时安全兜底
  let isWallpaperDeferred = false;
  let bootFallbackTimer = null;

  function shouldDeferWallpaperForBoot() {
    // 关键架构革新：开屏动画期间绝不推迟动态壁纸！
    // 动态壁纸在后台持续进行静默预启动与预热（预跑 1 秒以上），确保开屏结束时已是流畅运行态
    return false;
  }
  const isBootActive = shouldDeferWallpaperForBoot;

  // 开机动画结束时与壁纸同步的平滑渐入接口（视频 / 网页 / 场景统一接管，增量幂等唤醒，绝不销毁已有管线）
  window.__agyResumeBootWallpaper = function() {
    window.__agyBootPlaying = false;
    const mode = currentMode();

    if (mode === 'scene') {
      const box = document.getElementById('agy-dynamic-scene');
      if (box) {
        delete box.dataset.bootPaused;
        box.style.visibility = 'visible';
        box.style.opacity = '1';
        if (sceneRendererInstance && typeof sceneRendererInstance.resume === 'function') {
          try { sceneRendererInstance.resume(); } catch (_) {}
        }
        const audio = document.getElementById('agy-dynamic-audio');
        if (audio && audioEnabled && audio.paused) {
          try { audio.play().catch(() => {}); } catch (_) {}
        }
        return;
      }
      const el = mountMedia(true);
      if (el) {
        el.style.transition = 'opacity 0.6s cubic-bezier(0.4, 0, 0.2, 1)';
        el.style.opacity = '1';
      }
      return;
    }

    if (mode === 'web') {
      const frame = document.getElementById('agy-dynamic-iframe');
      if (frame) {
        delete frame.dataset.bootPaused;
        frame.style.visibility = 'visible';
        frame.style.transition = 'opacity 0.6s cubic-bezier(0.4, 0, 0.2, 1)';
        frame.style.opacity = '1';
        try { frame.contentWindow?.postMessage({ type: 'agy-wallpaper-resume' }, '*'); } catch (_) {}
        return;
      }
      const el = mountMedia(true);
      if (el) {
        el.style.transition = 'opacity 0.6s cubic-bezier(0.4, 0, 0.2, 1)';
        el.style.opacity = '1';
      }
      return;
    }

    let v = document.getElementById('agy-dynamic-video');
    if (!v) {
      v = realMountVideo(true);
    }
    if (v) {
      delete v.dataset.bootPaused;
      v.style.transition = 'opacity 0.6s cubic-bezier(0.4, 0, 0.2, 1)';
      v.style.opacity = '1';
      try {
        const p = v.play();
        if (p && typeof p.catch === 'function') {
          p.catch(() => {
            try {
              v.play().catch(() => {});
            } catch (_) {}
            const resumeOnInteraction = () => {
              v.play().catch(() => {});
              window.removeEventListener('click', resumeOnInteraction);
              window.removeEventListener('keydown', resumeOnInteraction);
            };
            window.addEventListener('click', resumeOnInteraction, { once: true });
            window.addEventListener('keydown', resumeOnInteraction, { once: true });
          });
        }
      } catch(e) {}
    }
  };

  function normalizeVideoSrc(src) {
    if (!src) return '';
    try {
      const u = new URL(src, location.href);
      const raw = u.searchParams.get('path') || u.pathname || src;
      return decodeURIComponent(raw).replace(/\\/g, '/');
    } catch (_) {
      try {
        return decodeURIComponent(src).replace(/\\/g, '/');
      } catch (__) {
        return String(src).replace(/\\/g, '/');
      }
    }
  }

  // ==========================================================
  // 多形态壁纸渲染适配器（Video / Web / Scene）
  // 统一使用 z-index: -999999 的固定底层容器，互斥挂载，切形态时彻底销毁旧节点
  // ==========================================================
  function buildPreviewUrl() {
    if (!wallpaperDir) return '';
    const file = previewFile || 'preview.jpg';
    return `${API_BASE}/api/wallpaper-library/preview?folder=${encodeURIComponent(wallpaperDir)}&file=${encodeURIComponent(file)}`;
  }

  function buildWebUrl() {
    if (!webUrl) return '';
    return /^https?:\/\//i.test(webUrl) ? webUrl : `${API_BASE}${webUrl}`;
  }

  function currentMode() {
    if (!enableVideo) return 'none';
    const st = sourceType || (wallpaperDir ? 'scene' : 'video');
    if (st === 'web' && (webUrl || wallpaperDir)) return 'web';
    if (st === 'scene' && (wallpaperDir || previewFile)) return 'scene';
    if (videoUrl) return 'video';
    if (wallpaperDir) return 'scene';
    return 'none';
  }

  function ensureSceneStyle() {
    if (document.getElementById('agy-scene-style')) return;
    const style = document.createElement('style');
    style.id = 'agy-scene-style';
    style.textContent = `
      #agy-dynamic-scene { position: fixed; inset: 0; width: 100vw; height: 100vh; overflow: hidden; z-index: -999999; pointer-events: none; contain: strict; transform: translateZ(0); }
      #agy-dynamic-scene canvas.agy-scene-canvas {
        position: absolute; inset: 0;
        width: 100%; height: 100%;
        display: block;
        opacity: 0;
        transition: opacity 0.6s cubic-bezier(0.4, 0, 0.2, 1);
        pointer-events: none;
      }
      #agy-dynamic-scene canvas.agy-scene-canvas.agy-scene-live { opacity: 1; z-index: 3; }
      #agy-dynamic-scene canvas.agy-scene-canvas.agy-scene-retiring { opacity: 1; z-index: 2; }
      html, html.dark, html.theme-dark, html[class*="dark"],
      body, body.dark, body.theme-dark, body[class*="dark"], body[class*="theme-"] {
        background: transparent !important;
        background-color: transparent !important;
      }
    `;
    const host = document.head || document.documentElement;
    if (host) host.appendChild(style);
  }

  function applyMediaFilter(el) {
    if (!el || !el.style) return;
    el.style.filter = 'brightness(var(--agy-bg-brightness, 0.85)) contrast(var(--agy-bg-contrast, 1.05))';
  }

  // ==========================================================
  // 2.6 统一媒体几何控制器（阶段五：铺满视口 / 彻底消除黑边）
  //
  // 历史缺陷：三种背景形态的定位尺寸写法不一致——
  //   - iframe 在 mountWeb() 里用 cssText 内联写死（安全）
  //   - scene  依赖独立注入的 #agy-scene-style（安全，不依赖毛玻璃 CSS）
  //   - video  的 width/height/object-fit 完全依赖 glass-theme.css 注入的 <style>
  //            → 一旦该 style 节点内容被清空（updateStyle('') / 宿主重渲染 / CSS 读取失败），
  //              <video> 就退回「素材原始分辨率」裸渲染，表现为无法铺满窗口、四周大片黑边，
  //              且与素材本身是横屏还是竖屏毫无关系。
  //
  // 本控制器把所有几何属性统一以 !important 内联写到元素自身，任何外部 CSS 都无法影响；
  // 同时用 top/right/bottom/left + 100% 取代 100vw/100vh —— 后者含纵向滚动条宽度，
  // 会出现水平溢出与右侧被裁，百分比相对 initial containing block，在高 DPI 缩放下更精确。
  // ==========================================================
  const FIT_MODES = ['cover', 'contain', 'fill', 'blur'];
  // auto：按素材形态自动决定（场景壁纸默认完整显示，其余铺满裁切）
  const FIT_SETTINGS = ['auto'].concat(FIT_MODES);
  const FIT_POSITIONS = [
    'center', 'top', 'bottom', 'left', 'right',
    'top left', 'top right', 'bottom left', 'bottom right'
  ];

  function normalizeFitMode(v) {
    const s = String(v == null ? '' : v).trim().toLowerCase();
    return FIT_MODES.indexOf(s) >= 0 ? s : 'cover';
  }

  // 配置层（可含 auto），与 normalizeFitMode 的「具体模式」区分开
  function normalizeFitSetting(v) {
    const s = String(v == null ? '' : v).trim().toLowerCase();
    return FIT_SETTINGS.indexOf(s) >= 0 ? s : 'cover';
  }

  function normalizeFitPosition(v) {
    const s = String(v == null ? '' : v).trim().toLowerCase().replace(/\s+/g, ' ');
    return FIT_POSITIONS.indexOf(s) >= 0 ? s : 'center';
  }

  // 场景壁纸的画质底线：缩略图本身只有 1024²（部分甚至 160²~256²），
  // 无上限放大会直接糊成色块，因此限制最大放大倍数，超出部分交给模糊填充层兜底。
  const SCENE_MAX_UPSCALE = 2;

  // 当前生效的铺满策略（支持运行时热更新，无需重建媒体节点）
  // wallpaperFitSetting 保存配置原值（可能是 auto），wallpaperFit 保存解析后的具体模式
  let wallpaperFitSetting = normalizeFitSetting(fit);
  let wallpaperFit = 'cover';
  let wallpaperFitPosition = normalizeFitPosition(fitPosition);

  // auto 解析：场景壁纸的素材是正方形缩略图，铺满裁切会切掉近一半画面，故默认完整显示
  function resolveFitSetting(setting) {
    const s = normalizeFitSetting(setting);
    if (s !== 'auto') return s;
    return currentMode() === 'scene' ? 'blur' : 'cover';
  }

  function refreshResolvedFit() {
    wallpaperFit = resolveFitSetting(wallpaperFitSetting);
    return wallpaperFit;
  }
  refreshResolvedFit();

  // 模糊填充层的低频时间轴校正定时器（双实例解码会缓慢漂移）
  let videoBackdropSyncTimer = null;
  let geometryRaf = null;

  // 内联写 !important，压过宿主 Tailwind preflight 的 img,video{max-width:100%;height:auto}
  function setImp(el, prop, value) {
    if (!el || !el.style || value === undefined || value === null) return;
    try { el.style.setProperty(prop, String(value), 'important'); } catch (_) {}
  }

  function clearImp(el, prop) {
    if (!el || !el.style) return;
    try { el.style.removeProperty(prop); } catch (_) {}
  }

  // 视口盒子：fixed + 四边贴合 + 100% 尺寸，永不受滚动条与宿主容器影响
  function applyViewportBox(el, zIndex) {
    if (!el) return;
    setImp(el, 'position', 'fixed');
    setImp(el, 'top', '0px');
    setImp(el, 'right', '0px');
    setImp(el, 'bottom', '0px');
    setImp(el, 'left', '0px');
    setImp(el, 'width', '100%');
    setImp(el, 'height', '100%');
    setImp(el, 'max-width', 'none');
    setImp(el, 'max-height', 'none');
    setImp(el, 'min-width', '0px');
    setImp(el, 'min-height', '0px');
    setImp(el, 'margin', '0px');
    setImp(el, 'padding', '0px');
    setImp(el, 'box-sizing', 'border-box');
    setImp(el, 'z-index', String(zIndex == null ? -999999 : zIndex));
    setImp(el, 'pointer-events', 'none');
  }

  // 替换元素（video / img）的填充方式；blur 模式下前景层退化为 contain
  function applyElementFit(el, mode, position) {
    const fitMode = mode === 'blur' ? 'contain' : mode;
    setImp(el, 'object-fit', fitMode);
    setImp(el, 'object-position', position);
    return fitMode;
  }

  // —— 视频：主层 + 可选模糊填充层 ——
  function syncBackdropTime() {
    const fg = document.getElementById('agy-dynamic-video');
    const bg = document.getElementById('agy-dynamic-video-backdrop');
    if (!fg || !bg) return;
    try {
      if (fg.paused && !bg.paused) bg.pause();
      else if (!fg.paused && bg.paused) {
        const p = bg.play();
        if (p && typeof p.catch === 'function') p.catch(() => {});
      }
      if (Math.abs((bg.currentTime || 0) - (fg.currentTime || 0)) > 0.4) {
        bg.currentTime = fg.currentTime || 0;
      }
    } catch (_) {}
  }

  function destroyVideoBackdrop() {
    if (videoBackdropSyncTimer) {
      clearInterval(videoBackdropSyncTimer);
      videoBackdropSyncTimer = null;
    }
    const bg = document.getElementById('agy-dynamic-video-backdrop');
    if (!bg) return;
    try {
      bg.pause();
      bg.removeAttribute('src');
      bg.load();
    } catch (_) {}
    bg.remove();
  }

  function syncVideoBackdrop(enable) {
    if (!enable) {
      destroyVideoBackdrop();
      return;
    }
    const fg = document.getElementById('agy-dynamic-video');
    const src = fg ? (fg.currentSrc || fg.src) : '';
    // readyState < 1 表示元数据还没到：此时不预建模糊层，避免为坏链/未就绪素材
    // 白白拉起第二路解码管道。loadedmetadata 后的几何回调会自动补建。
    if (!fg || !src || fg.readyState < 1) {
      destroyVideoBackdrop();
      return;
    }

    let bg = document.getElementById('agy-dynamic-video-backdrop');
    // 已就绪且素材未变：只校准播放状态。
    // resize 期间会被高频调用，此处必须短路，避免重复写样式与反复 play() 引发抖动。
    if (bg && bg.getAttribute('data-agy-src') === src) {
      if (bg.paused && !fg.paused) {
        try {
          const p = bg.play();
          if (p && typeof p.catch === 'function') p.catch(() => {});
        } catch (_) {}
      }
      return;
    }
    if (!bg) {
      bg = document.createElement('video');
      bg.id = 'agy-dynamic-video-backdrop';
      bg.muted = true;
      bg.defaultMuted = true;
      bg.loop = true;
      bg.autoplay = true;
      bg.playsInline = true;
      bg.preload = 'auto';
      bg.setAttribute('muted', '');
      bg.setAttribute('loop', '');
      bg.setAttribute('autoplay', '');
      bg.setAttribute('playsinline', '');
      bg.setAttribute('preload', 'auto');
      bg.setAttribute('aria-hidden', 'true');
      // 插到主视频之前：两层同为 z-index:-999999，DOM 顺序决定模糊层在下
      try {
        const parent = fg.parentNode || document.body || document.documentElement;
        if (parent) parent.insertBefore(bg, fg);
        else if (document.body) document.body.appendChild(bg);
      } catch (_) {
        if (document.body) document.body.appendChild(bg);
      }
    }
    if (bg.getAttribute('src') !== src) {
      bg.setAttribute('src', src);
      try { bg.load(); } catch (_) {}
    }
    bg.setAttribute('data-agy-src', src);

    applyViewportBox(bg, -999999);
    setImp(bg, 'display', 'block');
    setImp(bg, 'object-fit', 'cover');
    setImp(bg, 'object-position', 'center');
    // 重度模糊 + 压暗 + 轻微放大，避免模糊边缘透出容器底色
    setImp(bg, 'filter', 'blur(48px) brightness(0.7) saturate(1.15)');
    setImp(bg, 'transform', 'scale(1.16)');
    setImp(bg, 'will-change', 'transform');
    setImp(bg, 'background', 'transparent');

    try {
      const p = bg.play();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    } catch (_) {}
    syncBackdropTime();

    if (!videoBackdropSyncTimer) {
      videoBackdropSyncTimer = setInterval(syncBackdropTime, 8000);
    }
  }

  function applyVideoGeometry() {
    const v = document.getElementById('agy-dynamic-video');
    if (!v) {
      destroyVideoBackdrop();
      return;
    }
    // 形态可能在 applyMediaGeometry 之外被单独切换（例如 setVideoEnabled 直接挂载），
    // 这里再解析一次 auto，避免沿用上一个形态的解析结果（scene→contain 会污染 video）
    refreshResolvedFit();
    applyViewportBox(v, -999999);
    setImp(v, 'display', 'block');
    setImp(v, 'background', 'transparent');
    setImp(v, 'transform', 'translateZ(0)');
    setImp(v, 'will-change', 'transform');
    applyElementFit(v, wallpaperFit, wallpaperFitPosition);
    applyMediaFilter(v);
    syncVideoBackdrop(wallpaperFit === 'blur');
  }

  // —— 网页壁纸：iframe 无 object-fit 语义，仅保证容器 100% 覆盖视口 ——
  function applyWebGeometry() {
    const f = document.getElementById('agy-dynamic-iframe');
    if (!f) return;
    applyViewportBox(f, -999999);
    setImp(f, 'border', '0px');
    setImp(f, 'background', '#000');
    applyMediaFilter(f);
  }

  function mapFitToWebWall(fit) {
    if (fit === 'blur' || fit === 'contain') return 'contain';
    if (fit === 'fill') return 'fill';
    return 'cover';
  }

  function applySceneGeometry() {
    const box = document.getElementById('agy-dynamic-scene');
    if (!box) return;
    refreshResolvedFit();
    applyViewportBox(box, -999999);
    setImp(box, 'overflow', 'hidden');
    setImp(box, 'transform', 'translateZ(0)');

    // 动态同步 WebWallGL 实例的视口适应模式（cover / contain / fill）
    if (sceneRendererInstance && typeof sceneRendererInstance.setFit === 'function') {
      try { sceneRendererInstance.setFit(mapFitToWebWall(wallpaperFit)); } catch (_) {}
    }

    const canvas = box.querySelector('canvas.agy-scene-canvas');
    if (canvas) {
      setImp(canvas, 'position', 'absolute');
      setImp(canvas, 'inset', '0px');
      setImp(canvas, 'width', '100%');
      setImp(canvas, 'height', '100%');
      setImp(canvas, 'display', 'block');
      setImp(canvas, 'margin', '0px');
    }
  }

  // 统一入口：任何形态、任何时刻都能把几何重新收敛到「铺满视口」
  function applyMediaGeometry() {
    if (isDestroyed) return;
    // 形态可能已切换（video/scene/web），auto 策略须先按当前形态重新解析
    refreshResolvedFit();
    if (document.documentElement && document.documentElement.dataset) {
      document.documentElement.dataset.agyFit = wallpaperFit;
    }
    applyVideoGeometry();
    applyWebGeometry();
    applySceneGeometry();
  }

  // 视口变化（窗口缩放 / 分屏 / 全屏 / DevTools 停靠 / 高 DPI 切换）统一重算
  function scheduleGeometrySync() {
    if (isDestroyed || geometryRaf) return;
    geometryRaf = requestAnimationFrame(() => {
      geometryRaf = null;
      applyMediaGeometry();
    });
  }
  window.addEventListener('resize', scheduleGeometrySync, { passive: true });
  window.addEventListener('orientationchange', scheduleGeometrySync, { passive: true });
  document.addEventListener('fullscreenchange', scheduleGeometrySync);
  if (typeof ResizeObserver !== 'undefined' && document.documentElement) {
    try {
      const vpObserver = new ResizeObserver(scheduleGeometrySync);
      vpObserver.observe(document.documentElement);
      window.__agyViewportObserver = vpObserver;
    } catch (_) {}
  }

  function destroyVideoEl() {
    // 先撤模糊填充层，避免主视频销毁后残留一路解码管道
    destroyVideoBackdrop();
    const v = document.getElementById('agy-dynamic-video');
    if (!v) return;
    try {
      v.pause();
      v.removeAttribute('src');
      v.load();
    } catch (_) {}
    v.remove();
  }

  function destroyWebEl() {
    const f = document.getElementById('agy-dynamic-iframe');
    if (!f) return;
    try {
      f.setAttribute('src', 'about:blank');
    } catch (_) {}
    f.remove();
  }

  // ==========================================================
  // 阶段七：场景动态渲染轨（WebWallGL / WebGL2）
  // - sceneRenderer !== 'static' 时在静态海报之上叠加 WebGL canvas，
  //   onReady 后淡入并隐藏海报；mount 失败则海报继续兜底（永不黑屏）
  // - 实例句柄全局单例：同一时间只允许一个 WebGL 上下文
  // ==========================================================
  let sceneRendererInstance = null;
  let sceneRendererDir = '';
  let sceneRendererMounting = false;
  let sceneRendererModule = null; // 全局包加载缓存（window.WebWallGL）
  let sceneRendererLoadSeq = 0;   // 换壁纸竞态守卫

  function normalizeSceneRenderer(v) {
    return v === 'static' ? 'static' : 'dynamic';
  }

  // webwallgl 以 UMD 全局包（window.WebWallGL）注入：其 ESM 版含裸依赖 mediabunny，
  // 无法直接 import()，故用经典 <script> 加载自包含 bundle
  function importSceneRenderer() {
    return new Promise((resolve, reject) => {
      if (sceneRendererModule) return resolve(sceneRendererModule);
      if (window.WebWallGL && typeof window.WebWallGL.mount === 'function') {
        sceneRendererModule = window.WebWallGL;
        return resolve(sceneRendererModule);
      }
      const s = document.createElement('script');
      s.src = `${API_BASE}/vendor/webwallgl.js`;
      s.async = true;
      s.onload = () => {
        if (window.WebWallGL && typeof window.WebWallGL.mount === 'function') {
          sceneRendererModule = window.WebWallGL;
          resolve(sceneRendererModule);
        } else {
          reject(new Error('WebWallGL global missing after load'));
        }
      };
      s.onerror = () => reject(new Error('webwallgl bundle load failed'));
      // initWallpaper 可能在 document.head/body 尚未就绪时同步触发，此时 appendChild 会拿到 null。
      // 这里轮询等待宿主节点出现后再挂载（最长 ~6s，之后交由上层静态海报兜底）
      const startedAt = Date.now();
      const tryAppend = () => {
        const host = document.head || document.body || document.documentElement;
        if (host) {
          host.appendChild(s);
          return;
        }
        if (Date.now() - startedAt > 6000) {
          reject(new Error('document host not ready for vendor script'));
          return;
        }
        setTimeout(tryAppend, 50);
      };
      tryAppend();
    });
  }

  function destroySceneRenderer() {
    if (sceneRendererInstance) {
      try { sceneRendererInstance.destroy(); } catch (e) {}
      sceneRendererInstance = null;
    }
    if (typeof window !== 'undefined') {
      window.__agySceneRenderer = null;
      window.__agySceneFirstFrameReady = false;
      window.__agySceneFirstFrameTime = 0;
    }
    sceneRendererDir = '';
    // canvas 一并移除（无论是否带 agy-scene-canvas 类，彻底清空）
    const box = document.getElementById('agy-dynamic-scene');
    if (box) {
      box.querySelectorAll('canvas').forEach(c => { try { c.remove(); } catch (e) {} });
    }
  }

  // Source 适配器：scene.pkg 整包交给库自行解析（sidecar file 路由流式供给）
  function buildSceneSource(dir) {
    const pkgUrl = `${API_BASE}/api/wallpaper-library/file?folder=${encodeURIComponent(dir)}&file=scene.pkg`;
    const projectUrl = `${API_BASE}/api/wallpaper-library/file?folder=${encodeURIComponent(dir)}&file=project.json`;
    const dirName = String(dir).split(/[\\/]/).filter(Boolean).pop() || 'scene';
    return {
      key: `workshop-${dirName}`,
      scenePkg: async (signal) => {
        const r = await fetch(pkgUrl, { signal });
        if (!r.ok) throw new Error('scene.pkg fetch failed: ' + r.status);
        return r.arrayBuffer();
      },
      project: async () => {
        try {
          const r = await fetch(projectUrl);
          if (!r.ok) return null;
          return await r.json();
        } catch (_) { return null; }
      }
    };
  }

  async function mountSceneDynamic(box) {
    if (isDestroyed || !wallpaperDir) return;
    if (normalizeSceneRenderer(sceneRenderer) === 'static') { destroySceneRenderer(); return; }
    const dir = wallpaperDir;
    const targetFps = Number.isFinite(fps) ? fps : 60;
    // 性能重构：彻底掐死 Retina 屏幕导致的 4 倍~8 倍像素爆炸！
    // renderDpr 是用户设定的缩放比例（默认 1.0），背景壁纸绘图分辨率严格封顶在 1.0
    // （在 4K 屏上 1.0 已经是 3840×2160 原生像素，绝不乘以 devicePixelRatio(2.0) 导致 8K 像素超载）。
    const userScale = Number.isFinite(renderDpr) ? renderDpr : 1.0;
    const targetDpr = Math.min(Math.max(userScale, 0.5), 1.0);

    // 已在渲染同一目录：仅按独立参数热调，不重建上下文
    if (sceneRendererInstance && sceneRendererDir === dir) {
      try {
        sceneRendererInstance.setFps(targetFps);
        sceneRendererInstance.setRenderDpr(targetDpr);
        const c = sceneRendererInstance.canvas || (box ? box.querySelector('canvas') : null);
        if (c) {
          c.classList.add('agy-scene-canvas');
          c.classList.add('agy-scene-live');
        }
      } catch (e) {}
      return;
    }
    if (sceneRendererMounting) return; // 上一轮还在装配，等它落地（或被新目录判废）
    sceneRendererMounting = true;
    const seq = ++sceneRendererLoadSeq;

    // 核心双缓冲机制 (Double Buffering)：
    // 切换壁纸时不销毁旧 canvas，标记为 retiring 并保持顶层渲染，杜绝解包与编译期间的黑屏断层！
    const retiringCanvas = box.querySelector('canvas.agy-scene-live');
    const retiringInst = sceneRendererInstance;
    if (retiringCanvas) {
      retiringCanvas.classList.remove('agy-scene-live');
      retiringCanvas.classList.add('agy-scene-retiring');
      retiringCanvas.style.zIndex = '2';
      retiringCanvas.style.pointerEvents = 'none';
    }

    try {
      const mod = await importSceneRenderer();
      if (isDestroyed || seq !== sceneRendererLoadSeq || wallpaperDir !== dir) {
        if (retiringInst) try { retiringInst.destroy(); } catch (_) {}
        if (retiringCanvas) try { retiringCanvas.remove(); } catch (_) {}
        return;
      }

      // 清理非当前保留的游离 canvas
      box.querySelectorAll('canvas:not(.agy-scene-retiring)').forEach(c => { try { c.remove(); } catch (e) {} });

      // 传入容器 box，库在其内自建 WebGL canvas 并管理 backing store 与适配。
      // 注意：mount() 的 Promise 由首帧(onReady)落地，onReady 在 await 返回前触发，
      // 因此回调内不能引用尚未赋值的 inst——所有 canvas 样式一律放到 await 之后处理。
      const inst = await mod.mount(box, {
        source: buildSceneSource(dir),
        fit: mapFitToWebWall(wallpaperFit),
        fps: targetFps,
        renderDpr: targetDpr,
        autoQuality: true,
        scripts: !!sceneScripts,
        volume: 0,
        fade: false,
        fadeDuration: 0,
        occlusion: false,
        mountTimeoutMs: 20000,
        onError: (err) => {
          console.warn('[Scene Renderer] mount failed, fallback to static poster:', err);
          if (seq === sceneRendererLoadSeq) {
            if (typeof window !== 'undefined') window.__agySceneDynamicFailed = true;
            destroySceneRenderer();
          }
        }
      });
      if (isDestroyed || seq !== sceneRendererLoadSeq || wallpaperDir !== dir) {
        try { inst.destroy(); } catch (e) {}
        if (retiringInst) try { retiringInst.destroy(); } catch (_) {}
        if (retiringCanvas) try { retiringCanvas.remove(); } catch (_) {}
        return;
      }

      // 首帧已就绪（mount 已 resolve）：接管新 canvas 样式铺满容器，淡入盖过旧画面
      const c = inst.canvas || box.querySelector('canvas:not(.agy-scene-retiring)');
      if (c) {
        c.classList.add('agy-scene-canvas');
        c.style.position = 'absolute';
        c.style.inset = '0';
        c.style.width = '100%';
        c.style.height = '100%';
        c.style.zIndex = '3';
        c.style.opacity = '0';
        c.style.transition = 'opacity 0.5s ease-out';
        c.classList.add('agy-scene-live');
        void c.offsetWidth;
        c.style.opacity = '1';
      }

      // 关键无缝 Cross-fade：等待新 WebGL canvas 500ms 淡入完成、画面完全呈现后，优雅销毁旧实例并移除旧 canvas
      setTimeout(() => {
        if (retiringInst) {
          try { retiringInst.destroy(); } catch (_) {}
        }
        if (retiringCanvas && retiringCanvas.parentNode) {
          try { retiringCanvas.remove(); } catch (_) {}
        }
      }, 520);

      console.log('[Scene Renderer] first frame ready, dynamic track live');
      sceneRendererInstance = inst;
      sceneRendererDir = dir;
      if (typeof window !== 'undefined') {
        window.__agySceneRenderer = inst;
        window.__agySceneFirstFrameReady = true;
        window.__agySceneFirstFrameTime = Date.now();
        window.__agySceneDynamicFailed = false;
      }
      // 核心诉求：无论开屏动效是否在播放或视口是否暂时处于遮罩后，场景壁纸必须在后台持续全速运行预热（绝不暂停），彻底吸收 Shader 编译与首帧卡顿！
      try { inst.resume(); } catch (e) {}
    } catch (e) {
      console.warn('[Scene Renderer] dynamic track unavailable:', e);
      if (seq === sceneRendererLoadSeq) {
        if (typeof window !== 'undefined') window.__agySceneDynamicFailed = true;
        destroySceneRenderer();
      }
      if (retiringInst) try { retiringInst.destroy(); } catch (_) {}
      if (retiringCanvas) try { retiringCanvas.remove(); } catch (_) {}
    } finally {
      if (seq === sceneRendererLoadSeq) sceneRendererMounting = false;
    }
  }

  function destroySceneEl() {
    destroySceneRenderer();
    const box = document.getElementById('agy-dynamic-scene');
    if (box) {
      box.remove();
    }
  }

  function destroyAudioEl() {
    const audio = document.getElementById('agy-dynamic-audio');
    if (!audio) return;
    try {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    } catch (_) {}
    audio.remove();
  }

  function mountWeb() {
    ensureBackdrop();
    ensureStyle();
    let frame = document.getElementById('agy-dynamic-iframe');
    const url = buildWebUrl();
    if (!frame) {
      frame = document.createElement('iframe');
      frame.id = 'agy-dynamic-iframe';
      frame.setAttribute('title', 'Dynamic Web Wallpaper');
      frame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-pointer-lock allow-popups');
      frame.setAttribute('allow', 'autoplay; fullscreen');
      frame.setAttribute('referrerpolicy', 'no-referrer');
      frame.style.cssText = 'border:0;z-index:-999999;pointer-events:none;background:#000;opacity:1;transition:opacity .6s cubic-bezier(.4,0,.2,1);contain:strict;transform:translateZ(0);';
      applyMediaFilter(frame);
      const parent = document.body || document.documentElement;
      if (parent) parent.prepend(frame);
    }
    if (url && frame.getAttribute('src') !== url) {
      frame.setAttribute('src', url);
    }
    if (document.documentElement && document.documentElement.dataset) {
      document.documentElement.dataset.agyHasVideo = 'true';
    }
    // 几何统一收口到控制器（iframe 无 object-fit 语义，仅保证容器铺满）
    applyWebGeometry();
    return frame;
  }

  function mountScene(fadeIn = true) {
    ensureBackdrop();
    ensureSceneStyle();
    ensureStyle();
    let box = document.getElementById('agy-dynamic-scene');
    if (!box) {
      box = document.createElement('div');
      box.id = 'agy-dynamic-scene';
      // 场景底板恒定保持 100% 不透明，画面渐变全权交给双缓冲 Canvas 处理，彻底消除容器级二次淡入闪黑
      box.style.opacity = '1';
      applyMediaFilter(box);
      const parent = document.body || document.documentElement;
      if (parent) parent.prepend(box);
    } else {
      box.style.opacity = '1';
    }

    if (document.documentElement && document.documentElement.dataset) {
      document.documentElement.dataset.agyHasVideo = 'true';
    }

    // 几何统一收口到控制器
    applySceneGeometry();
    mountSceneAudio();

    // 动态渲染轨：异步装配，时序保护（避免冷启动早期 DOM 骨架未就绪 / 尺寸为 0 导致装配异常）
    const triggerDynamic = () => {
      if (isDestroyed) return;
      mountSceneDynamic(box).catch(() => {});
    };
    // 核心生命线：使用宏任务立即触发装配，彻底打破 Chromium 开屏遮罩下的 rAF 死锁！
    if (typeof document !== 'undefined' && document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        setTimeout(triggerDynamic, 0);
      }, { once: true });
    } else {
      setTimeout(triggerDynamic, 0);
    }
    return box;
  }

  function mountSceneAudio() {
    if (!audioEnabled || !audioUrl) {
      destroyAudioEl();
      return null;
    }
    let audio = document.getElementById('agy-dynamic-audio');
    const src = /^https?:\/\//i.test(audioUrl) ? audioUrl : `${API_BASE}${audioUrl}`;
    if (!audio) {
      audio = document.createElement('audio');
      audio.id = 'agy-dynamic-audio';
      audio.loop = true;
      audio.volume = 0.28;
      audio.preload = 'none';
      audio.style.display = 'none';
      (document.body || document.documentElement).appendChild(audio);
    }
    if (audio.getAttribute('src') !== src) {
      audio.setAttribute('src', src);
    }
    if (document.visibilityState === 'visible') {
      const p = audio.play();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    }
    return audio;
  }

  // 互斥挂载：切换形态时彻底释放旧解码/渲染管道，避免内存与 GPU 资源泄漏
  function mountMedia(fadeIn = true) {
    if (isDestroyed) return null;
    ensureStyle();
    const mode = currentMode();

    if (mode === 'web') {
      destroyVideoEl();
      destroySceneEl();
      destroyAudioEl();
      return mountWeb();
    }
    if (mode === 'scene') {
      destroyVideoEl();
      destroyWebEl();
      return mountScene(fadeIn);
    }
    // 视频模式（含无素材时的清理）
    destroyWebEl();
    destroySceneEl();
    destroyAudioEl();
    return realMountVideo(fadeIn);
  }

  function realMountVideo(fadeIn = true) {
    if (isDestroyed) return null;
    if (!enableVideo || !videoUrl) {
      if (document.documentElement && document.documentElement.dataset) {
        document.documentElement.dataset.agyHasVideo = 'false';
      }
      const v = document.getElementById('agy-dynamic-video');
      if (v) {
        try { v.pause(); v.removeAttribute('src'); v.load(); } catch(e) {}
        v.remove();
      }
      const cfg = (window.__agySkinBridge && window.__agySkinBridge.getConfig()) || window.__AG_SKIN_CONFIG__ || {};
      if (cfg.features?.themeStyles !== false && !isDestroyed) {
        ensureBackdrop();
        ensureStyle();
      }
      return null;
    }

    if (document.documentElement && document.documentElement.dataset) {
      document.documentElement.dataset.agyHasVideo = 'true';
    }
    ensureBackdrop();

    let videoEl = document.getElementById('agy-dynamic-video');
    const targetPath = normalizeVideoSrc(videoUrl);

    // 关键修复：如果已有 video 元素存在且视频素材发生了切换（!isSame）
    // 在 macOS / Electron 下，同一个 video 标签复用并热更 src 时，极易因 VideoToolbox / AVFoundation
    // 硬件解码管道未彻底断开导致 AbortError 进而永久卡滞在 paused 状态。彻底销毁旧节点重建是 100% 恢复的绝对保障！
    if (videoEl) {
      const currentPath = normalizeVideoSrc(videoEl.src);
      if (currentPath && targetPath && currentPath !== targetPath) {
        try {
          videoEl.pause();
          videoEl.removeAttribute('src');
          videoEl.load();
        } catch (_) {}
        videoEl.remove();
        videoEl = null;
      }
    }

    if (!videoEl) {
      videoEl = document.createElement('video');
      videoEl.id = 'agy-dynamic-video';
      applyViewportBox(videoEl, -999999);
      setImp(videoEl, 'display', 'block');
      setImp(videoEl, 'pointer-events', 'none');
      videoEl.autoplay = true;
      videoEl.loop = true;
      videoEl.muted = true;
      videoEl.defaultMuted = true;
      videoEl.playsInline = true;
      videoEl.preload = 'auto';
      videoEl.setAttribute('muted', '');
      videoEl.setAttribute('autoplay', '');
      videoEl.setAttribute('loop', '');
      videoEl.setAttribute('playsinline', '');
      videoEl.setAttribute('preload', 'auto');
      videoEl.style.opacity = '1';
      videoEl.style.transition = 'opacity 0.6s cubic-bezier(0.4, 0, 0.2, 1)';

      if (document.body) {
        document.body.prepend(videoEl);
      } else {
        const parent = document.documentElement || document.head;
        if (parent) parent.appendChild(videoEl);
        document.addEventListener('DOMContentLoaded', () => {
          if (videoEl && document.body && videoEl.parentNode !== document.body) {
            document.body.prepend(videoEl);
          }
        }, { once: true });
      }
    } else if (document.body && videoEl.parentNode !== document.body) {
      applyViewportBox(videoEl, -999999);
      document.body.prepend(videoEl);
    }

    applyVideoGeometry();

    // 设置或更新视频源
    if (videoUrl && (!videoEl.src || normalizeVideoSrc(videoEl.src) !== targetPath)) {
      videoEl.src = videoUrl;
      try { videoEl.load(); } catch(e) {}
    }

    const onPlayReady = () => {
      if (videoEl && videoEl.style.opacity !== '1') {
        requestAnimationFrame(() => {
          videoEl.style.opacity = '1';
        });
      }
    };

    const safePlay = () => {
      if (!videoEl || !enableVideo) return;
      videoEl.muted = true;
      videoEl.defaultMuted = true;
      const p = videoEl.play();
      if (p && typeof p.then === 'function') {
        p.then(onPlayReady).catch(() => {
          // 针对 Windows Chromium Background Media 节电机制拦截 (AbortError):
          // 1. 微任务与 rAF 延迟微重试 (避开 DOM 挂载同步阶段的省电判定)
          requestAnimationFrame(() => {
            if (videoEl && videoEl.paused && enableVideo) {
              videoEl.play().then(onPlayReady).catch(() => {});
            }
          });
          // 2. 挂载全局一次性交互唤醒兜底 (用户点击下拉框或页面任意处即刻恢复播放)
          const resumeOnInteraction = () => {
            if (videoEl && videoEl.paused && enableVideo) {
              videoEl.play().then(onPlayReady).catch(() => {});
            }
            window.removeEventListener('pointerdown', resumeOnInteraction, true);
            window.removeEventListener('click', resumeOnInteraction, true);
            window.removeEventListener('keydown', resumeOnInteraction, true);
          };
          window.addEventListener('pointerdown', resumeOnInteraction, { once: true, capture: true });
          window.addEventListener('click', resumeOnInteraction, { once: true, capture: true });
          window.addEventListener('keydown', resumeOnInteraction, { once: true, capture: true });
        });
      }
    };

    if (!videoEl.__agyBound) {
      videoEl.__agyBound = true;
      const onDataReady = () => {
        onPlayReady();
        // 元数据就绪后补一次几何收敛：blur 模式下模糊层需要真实的 currentSrc 才能复制
        if (videoEl && videoEl.dataset.agyGeomReady !== '1') {
          videoEl.dataset.agyGeomReady = '1';
          applyVideoGeometry();
        }
        if (videoEl && videoEl.paused && enableVideo) {
          safePlay();
        }
      };
      videoEl.addEventListener('loadedmetadata', onDataReady);
      videoEl.addEventListener('loadeddata', onDataReady);
      videoEl.addEventListener('canplay', onDataReady);
      videoEl.addEventListener('canplaythrough', onDataReady);
      videoEl.addEventListener('playing', onPlayReady);
      videoEl.addEventListener('timeupdate', onPlayReady);
    }

    // 立即触发一次播放尝试
    if (videoEl.readyState >= 2 && !videoEl.paused) {
      onPlayReady();
    } else {
      safePlay();
    }

    // 几何控制器介入：尺寸与 object-fit 不再依赖 glass-theme.css 是否成功注入
    applyVideoGeometry();
    ensureStyle();
    return videoEl;
  }

  // 挂载/卸载动态壁纸（按 sourceType 自动路由到视频 / 网页 / 场景适配器）
  function mountVideo() {
    if (isDestroyed) return null;
    ensureStyle();
    syncTitleBarOverlay();
    return mountMedia(true);
  }

  mountVideo();

  // ==========================================================
  // 性能守卫：窗口失焦 / 最小化时挂起解码与合成，回到前台瞬间平滑唤醒
  // ==========================================================
  let suspendTimer = null;
  let suspended = false;

  function suspendMedia(reason) {
    if (suspended) return;
    suspended = true;
    const v = document.getElementById('agy-dynamic-video');
    if (v) {
      try {
        v.dataset.agySuspended = '1';
        v.pause();
      } catch (_) {}
    }
    const f = document.getElementById('agy-dynamic-iframe');
    if (f) {
      f.style.visibility = 'hidden';
      try {
        f.contentWindow?.postMessage({ type: 'agy-wallpaper-pause' }, '*');
      } catch (_) {}
    }
    const audio = document.getElementById('agy-dynamic-audio');
    if (audio) {
      try { audio.pause(); } catch (_) {}
    }
    void reason;
  }

  function resumeMedia() {
    if (!suspended) return;
    suspended = false;
    const v = document.getElementById('agy-dynamic-video');
    if (v && v.dataset.agySuspended === '1') {
      delete v.dataset.agySuspended;
      const p = v.play();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    }
    const f = document.getElementById('agy-dynamic-iframe');
    if (f) {
      f.style.visibility = 'visible';
      try {
        f.contentWindow?.postMessage({ type: 'agy-wallpaper-resume' }, '*');
      } catch (_) {}
    }
    const audio = document.getElementById('agy-dynamic-audio');
    if (audio && audioEnabled) {
      const p = audio.play();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (isDestroyed) return;
    if (document.visibilityState === 'hidden') {
      suspendMedia('hidden');
    } else {
      resumeMedia();
    }
  });

  window.addEventListener('blur', () => {
    if (isDestroyed) return;
    clearTimeout(suspendTimer);
    // 轻微延迟，避免点击 DevTools / 系统弹窗造成的抖动式挂起
    suspendTimer = setTimeout(() => {
      if (document.visibilityState === 'hidden') suspendMedia('blur');
    }, 1200);
  });

  window.addEventListener('focus', () => {
    clearTimeout(suspendTimer);
    resumeMedia();
  });

  // 4. 用户提问气泡智能折叠/展开胶囊按钮与防遮挡管理 (遵照 floating_user_bubble_spec.md v1.2.0)
  function updateCollapseBtnIcon(btn, isCollapsed) {
    if (isCollapsed) {
      btn.title = '展开提问';
      btn.setAttribute('aria-label', '展开提问');
      btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>';
    } else {
      btn.title = '收起提问';
      btn.setAttribute('aria-label', '收起提问');
      btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>';
    }
  }

  let bubbleObserver = null;
  function getBubbleObserver() {
    if (!bubbleObserver) {
      bubbleObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            enhanceSingleBubble(entry.target);
            bubbleObserver.unobserve(entry.target);
          }
        });
      }, {
        rootMargin: '120px 0px 120px 0px',
        threshold: 0
      });
      window.__agyBubbleObserver = bubbleObserver;
    }
    return bubbleObserver;
  }

  function enhanceSingleBubble(step) {
    if (!step || step.classList.contains('user-input-buttons-container')) return;
    if (step.getAttribute('data-agy-enhanced') === 'true') {
      const cardEl = step.querySelector('[data-testid="lifted-context-menu-trigger"]') ||
                     step.querySelector('div.relative.p-px.rounded-xl.bg-card-border') ||
                     step.querySelector('.bg-card') ||
                     step;
      if (cardEl && cardEl.querySelector('.user-bubble-toggle-btn, .agy-user-collapse-btn')) return;
    }

    const card = step.querySelector('[data-testid="lifted-context-menu-trigger"]') ||
                 step.querySelector('div.relative.p-px.rounded-xl.bg-card-border') ||
                 step.querySelector('.bg-card') ||
                 step;

    const textEl = step.querySelector('[data-quotable="true"]') ||
                   step.querySelector('.whitespace-pre-wrap') ||
                   step.querySelector('.user-bubble-text');

    const hasRealImg = !!step.querySelector(
      'button[aria-label*=".png"], button[aria-label*=".jpg"], button[aria-label*=".jpeg"], button[aria-label*=".webp"], div[data-no-scroll-jump="true"] img, img:not([src*=".svg"]):not(.context-scope-mention img)'
    );

    // 纯内存瞬时判定：换行数与字数，0 次读取 scrollHeight 避免强制回流
    const textContent = (textEl ? textEl.textContent : step.textContent || '').trim();
    const lineCount = textContent.split(/\r?\n/).filter(Boolean).length;

    let isLongContent = false;
    if (hasRealImg || lineCount > 1 || textContent.length > 45) {
      isLongContent = true;
    }

    step.setAttribute('data-agy-enhanced', 'true');
    step.setAttribute('data-user-collapsible', String(isLongContent));

    if (!isLongContent) {
      step.removeAttribute('data-user-collapsed');
      const existingBtn = card.querySelector('.user-bubble-toggle-btn, .agy-user-collapse-btn');
      if (existingBtn) existingBtn.remove();
      return;
    }

    if (!step.hasAttribute('data-user-collapsed')) {
      step.setAttribute('data-user-collapsed', 'true');
    }

    let btn = card.querySelector('.user-bubble-toggle-btn, .agy-user-collapse-btn');
    if (!btn) {
      btn = document.createElement('button');
      btn.className = 'user-bubble-toggle-btn agy-user-collapse-btn';
      btn.setAttribute('type', 'button');
      btn.onclick = (e) => {
        e.stopPropagation();
        e.preventDefault();
        const isCollapsed = step.getAttribute('data-user-collapsed') === 'true';
        const nextState = !isCollapsed;
        step.setAttribute('data-user-collapsed', String(nextState));
        updateCollapseBtnIcon(btn, nextState);
      };
      card.appendChild(btn);
    }
    const currentCollapsed = step.getAttribute('data-user-collapsed') === 'true';
    updateCollapseBtnIcon(btn, currentCollapsed);
  }

  function enhanceUserBubbles() {
    // 视口感知懒加载：只注册微秒级 IntersectionObserver 监听，视口外元素 0 算力消耗
    const userSteps = document.querySelectorAll(
      '[data-testid="user-input-step"], div.group\\/user-input-step, div[class*="group/user-input-step"]'
    );
    if (!userSteps.length) return;
    const observer = getBubbleObserver();
    userSteps.forEach(step => {
      if (step.classList.contains('user-input-buttons-container')) return;
      if (step.getAttribute('data-agy-enhanced') === 'true') return;
      if (step.closest('[data-agy-lazy-page="hidden"]')) return;
      observer.observe(step);
    });
  }

  let bubbleRaf = null;
  function scheduleEnhanceUserBubbles() {
    if (bubbleRaf) return;
    bubbleRaf = requestAnimationFrame(() => {
      bubbleRaf = null;
      enhanceUserBubbles();
    });
  }

  // ========================================================
  // 4.5 官方原生会话切换过渡与原生 Loading 引擎 (Native Session Switch Transition)
  // 1. 常驻独立 GPU 合成层单例 Overlay，零创建销毁开销，纯合成器透明度切换
  // 2. pointerdown / mousedown 超前第 0 毫秒感知介入（比 click 早 150ms+，先于 React 任何渲染长任务）
  // 3. 点击瞬间零同步重排（No Forced Reflow），100% 官方原生 progress_activity 灰圆圈秒开即转
  // 4. 新会话挂载就绪后以 0.12s 平滑淡出，彻底告别“先卡一会才出现 loading”
  // ========================================================
  function createSessionTransitionManager() {
    let currentObservedContainer = null;
    let containerObserver = null;
    let isSessionSwitching = false;
    let sessionSwitchTimeout = null;
    let loadingStartTime = 0;
    let targetSessionId = null;
    const MIN_TRANSITION_TIME = 150; // 微妙平滑阈值

    // 1. 常驻单例原生 Loading 节点（预置独立合成层，零 DOM 解析创建开销）
    function ensureOverlay() {
      let el = document.getElementById('agy-session-loader-overlay');
      if (!el) {
        el = document.createElement('div');
        el.className = 'agy-session-loader-overlay';
        el.id = 'agy-session-loader-overlay';
        el.setAttribute('aria-hidden', 'true');
        // 关键绝对物理防线：内联注入绝对定位与隐匿安全样式，在任何 CSS 加载延迟或缺失情况下坚决防止作为普通流 static 块级元素撑开 body 视口！
        el.style.cssText = 'position:fixed!important;top:0!important;right:0!important;bottom:0!important;left:var(--agy-sidebar-right, 354px)!important;display:flex!important;align-items:center!important;justify-content:center!important;pointer-events:none!important;user-select:none!important;opacity:0!important;visibility:hidden!important;z-index:99999!important;transform:translateZ(0)!important;';
        el.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 -960 960 960" fill="currentColor" class="animate-spin text-muted-foreground shrink-0 opacity-70" data-testid="status-loading-spinner" aria-label="Loading session"><path d="M332.55-129.9q-69.29-29.9-121.02-81.63T129.9-332.55T100-480.35t29.96-147.5t81.58-120.61t121.04-81.58T480-860q12.75,0 21.37,8.63T510-829.99t-8.62,21.37T480-800q-133,0-226.5,93.5T160-480t93.5,226.5T480-160t226.5-93.5T800-480q0-12.77 8.63-21.38T830.01-510t21.37,8.62T860-480q0,77.99-29.96,147.42T748.46-211.54T627.85-129.96T480.35-100t-147.8-29.9Z"/></svg>';
      }
      if (!el.isConnected) {
        const mountRoot = document.body || document.documentElement;
        if (mountRoot) mountRoot.appendChild(el);
      }
      return el;
    }

    // 2. 侧边栏宽度异步解耦缓存（严禁在用户点击瞬间调用 getBoundingClientRect 触发重排！）
    function syncSidebarRight() {
      try {
        const sidebar = document.querySelector('[role="navigation"]') ||
                        document.querySelector('[data-testid="conversation-row-sidebar"]')?.closest('[role="navigation"]') ||
                        document.querySelector('nav');
        if (sidebar) {
          const rect = sidebar.getBoundingClientRect();
          if (rect.width > 50) {
            document.documentElement.style.setProperty('--agy-sidebar-right', `${Math.round(rect.right)}px`);
          }
        }
      } catch (_) {}
    }
    syncSidebarRight();
    window.addEventListener('resize', syncSidebarRight, { passive: true });

    function getSessionIdFromUrl(url = window.location.href) {
      if (!url) return null;
      const m = url.match(/\/c\/([a-zA-Z0-9_-]+)/);
      return m ? m[1] : null;
    }

    function findMessageContainer() {
      return document.querySelector('.relative.flex.flex-col.gap-y-3') ||
             document.querySelector('[data-testid="user-input-step"]')?.parentElement;
    }

    // 零开销纯合成器状态切换
    function showSessionLoading() {
      const el = ensureOverlay();
      if (el) {
        el.classList.add('agy-loader-active');
        el.style.opacity = '1';
        el.style.visibility = 'visible';
      }
    }

    function hideSessionLoading() {
      clearTimeout(sessionSwitchTimeout);
      const el = document.getElementById('agy-session-loader-overlay');
      if (el) {
        el.classList.remove('agy-loader-active');
        el.style.opacity = '0';
        el.style.visibility = 'hidden';
      }
    }

    function startSessionSwitch(nextSessionId) {
      if (typeof shouldDeferWallpaperForBoot === 'function' && shouldDeferWallpaperForBoot()) {
        return;
      }

      if (!nextSessionId) return;
      const currentId = getSessionIdFromUrl(window.location.href);
      if (nextSessionId === currentId && !isSessionSwitching) return;

      // 核心：第 0 毫秒纯合成器秒级呼出！在 React 和任何主线程长任务介入前即刻上屏！
      isSessionSwitching = true;
      targetSessionId = nextSessionId;
      loadingStartTime = performance.now();

      showSessionLoading();

      // 3 秒安全兜底定时器（防止极端异常导致假死）
      clearTimeout(sessionSwitchTimeout);
      sessionSwitchTimeout = setTimeout(() => {
        endSessionSwitch();
      }, 3000);
    }

    function endSessionSwitch() {
      clearTimeout(sessionSwitchTimeout);
      hideSessionLoading();
      isSessionSwitching = false;
      targetSessionId = null;
    }

    function requestEndSessionSwitch() {
      if (!isSessionSwitching) return;
      const elapsed = performance.now() - loadingStartTime;
      const remaining = Math.max(0, MIN_TRANSITION_TIME - elapsed);
      clearTimeout(sessionSwitchTimeout);
      if (remaining > 0) {
        sessionSwitchTimeout = setTimeout(() => {
          endSessionSwitch();
        }, remaining);
      } else {
        endSessionSwitch();
      }
    }

    function cleanLegacyPaginationAttributes(container) {
      if (!container) return;
      container.removeAttribute('data-agy-lazy-page');
      container.querySelectorAll('[data-agy-lazy-page], [data-agy-revealed]').forEach(el => {
        el.removeAttribute('data-agy-lazy-page');
        el.removeAttribute('data-agy-revealed');
      });
      const w = container.querySelector('.agy-load-more-container');
      if (w) w.remove();
    }

    function attachContainerObserver(container) {
      if (!container || container === currentObservedContainer) return;
      if (containerObserver) {
        try { containerObserver.disconnect(); } catch (e) {}
      }
      currentObservedContainer = container;
      cleanLegacyPaginationAttributes(container);

      containerObserver = new MutationObserver(() => {
        cleanLegacyPaginationAttributes(container);
        if (isSessionSwitching) {
          requestAnimationFrame(() => {
            requestEndSessionSwitch();
          });
        }
      });
      containerObserver.observe(container, { childList: true });
    }

    function checkSessionState() {
      const container = findMessageContainer();
      if (!container) return;

      cleanLegacyPaginationAttributes(container);
      attachContainerObserver(container);

      if (isSessionSwitching) {
        requestAnimationFrame(() => {
          requestEndSessionSwitch();
        });
      }
    }

    // 关键优化：pointerdown / mousedown / click 统一超前感知触发！
    // 用户手指按下鼠标第一微秒立即调起 loading，绝不在松开 click 后才卡顿响应！
    function handleSessionTrigger(e) {
      const row = e.target.closest && (
        e.target.closest('[data-testid="conversation-row-sidebar"]') ||
        e.target.closest('[role="navigation"] a[href*="/c/"]') ||
        e.target.closest('a[href^="/c/"]')
      );
      if (!row) return;

      let targetId = row.getAttribute('data-cascade-id');
      if (!targetId) {
        const link = row.tagName === 'A' ? row : row.querySelector('a[href*="/c/"]');
        if (link) {
          const href = link.getAttribute('href') || link.href;
          targetId = getSessionIdFromUrl(href);
        }
      }

      if (targetId) {
        const currentId = getSessionIdFromUrl(window.location.href);
        if (targetId !== currentId) {
          showSessionLoading();
          startSessionSwitch(targetId);
        }
      }
    }

    if (window.__agySessionTriggerHandler) {
      document.removeEventListener('pointerdown', window.__agySessionTriggerHandler, true);
      document.removeEventListener('mousedown', window.__agySessionTriggerHandler, true);
      document.removeEventListener('click', window.__agySessionTriggerHandler, true);
    }
    window.__agySessionTriggerHandler = handleSessionTrigger;
    document.addEventListener('pointerdown', handleSessionTrigger, true);
    document.addEventListener('mousedown', handleSessionTrigger, true);
    document.addEventListener('click', handleSessionTrigger, true);

    // 劫持路由切换以实现秒级响应
    window.__agyOnHistoryTransition = function(targetUrl) {
      const targetId = getSessionIdFromUrl(targetUrl);
      if (targetId) {
        startSessionSwitch(targetId);
        requestAnimationFrame(checkSessionState);
      }
    };

    if (!window.__agyPaginationRouteHooked) {
      window.__agyPaginationRouteHooked = true;
      const originalPushState = history.pushState;
      if (originalPushState) {
        history.pushState = function(...args) {
          if (typeof window.__agyOnHistoryTransition === 'function') {
            window.__agyOnHistoryTransition(args[2]);
          }
          const res = originalPushState.apply(this, args);
          requestAnimationFrame(checkSessionState);
          return res;
        };
      }
      const originalReplaceState = history.replaceState;
      if (originalReplaceState) {
        history.replaceState = function(...args) {
          if (typeof window.__agyOnHistoryTransition === 'function') {
            window.__agyOnHistoryTransition(args[2]);
          }
          const res = originalReplaceState.apply(this, args);
          requestAnimationFrame(checkSessionState);
          return res;
        };
      }
      window.addEventListener('popstate', () => {
        if (typeof window.__agyOnHistoryTransition === 'function') {
          window.__agyOnHistoryTransition(window.location.href);
        }
        requestAnimationFrame(checkSessionState);
      });
    }

    return {
      check: checkSessionState,
      showLoading: showSessionLoading,
      hideLoading: hideSessionLoading,
      destroy: () => {
        clearTimeout(sessionSwitchTimeout);
        hideSessionLoading();
        if (containerObserver) {
          try { containerObserver.disconnect(); } catch (e) {}
          containerObserver = null;
        }
        if (window.__agySessionTriggerHandler) {
          document.removeEventListener('pointerdown', window.__agySessionTriggerHandler, true);
          document.removeEventListener('mousedown', window.__agySessionTriggerHandler, true);
          document.removeEventListener('click', window.__agySessionTriggerHandler, true);
          window.__agySessionTriggerHandler = null;
        }
        currentObservedContainer = null;
        const c = findMessageContainer();
        if (c) {
          c.removeAttribute('data-agy-session-switching');
          cleanLegacyPaginationAttributes(c);
        }
      }
    };
  }

  if (window.__agyPaginationEngine) {
    try { window.__agyPaginationEngine.destroy(); } catch (e) {}
    window.__agyPaginationEngine = null;
  }
  const paginationEngine = createSessionTransitionManager();
  window.__agyPaginationEngine = paginationEngine;
  paginationEngine.check();
  if (window.__agyWallpaperObserver) {
    try { window.__agyWallpaperObserver.disconnect(); } catch (e) {}
    window.__agyWallpaperObserver = null;
  }
  if (window.__agyBubbleObserver) {
    try { window.__agyBubbleObserver.disconnect(); } catch (e) {}
    window.__agyBubbleObserver = null;
  }

  let observerDebounceTimer = null;
  const unifiedObserver = new MutationObserver((mutations) => {
    if (isDestroyed) return;

    // 关键优化：若所有变更均来自侧边栏内部的虚拟列表滚动，严禁触发长会话气泡扫描，避免主线程抖动
    const isOnlySidebar = mutations.every(m => {
      const el = m.target;
      return el && el.closest && el.closest('[role="navigation"]');
    });
    if (isOnlySidebar) return;

    if (observerDebounceTimer) return;
    observerDebounceTimer = setTimeout(() => {
      observerDebounceTimer = null;
      if (isDestroyed) return;

      const cfg = (window.__agySkinBridge && window.__agySkinBridge.getConfig()) || window.__AG_SKIN_CONFIG__ || {};
      if (cfg.features?.themeStyles === false) return;

      // 若处于开屏动画播放期间，严禁补挂动态壁纸
      if (shouldDeferWallpaperForBoot()) {
        scheduleEnhanceUserBubbles();
        syncTitleBarOverlay();
        return;
      }
      const needVideo = currentMode() !== 'none';
      const hasVid = !!document.getElementById('agy-dynamic-video') ||
                     !!document.getElementById('agy-dynamic-iframe') ||
                     !!document.getElementById('agy-dynamic-scene');
      const hasStyle = !!document.getElementById('agy-dynamic-wallpaper-style');
      if ((needVideo && !hasVid) || !hasStyle) {
        mountVideo();
      }
      scheduleEnhanceUserBubbles();
      if (paginationEngine) paginationEngine.check();
      syncTitleBarOverlay();
    }, 180);
  });

  const rootToObserve = document.body || document.documentElement;
  if (rootToObserve) {
    unifiedObserver.observe(rootToObserve, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'data-theme']
    });
  }
  // ==========================================================
  // 智能能效守护：最小化 / 彻底隐藏时优雅挂起 WebGL 循环，回到前台瞬间唤醒
  // 保持 M4 / Apple Silicon 及所有 CPU/GPU 冰凉运行（空闲时占用 < 3%）
  // ==========================================================
  let energyDebounceTimer = null;
  function syncSceneEnergyProfile() {
    if (!sceneRendererInstance || isDestroyed) return;
    // 开屏动画未完成前，严禁暂停，确保首帧暖机成功
    if (window.__agyBootPlaying || !sessionStorage.getItem('__agy_booted__')) return;

    if (energyDebounceTimer) clearTimeout(energyDebounceTimer);
    energyDebounceTimer = setTimeout(() => {
      if (!sceneRendererInstance || isDestroyed) return;
      if (document.hidden || (document.visibilityState && document.visibilityState === 'hidden')) {
        try { sceneRendererInstance.pause(); } catch (_) {}
      } else {
        try { sceneRendererInstance.resume(); } catch (_) {}
      }
    }, 120);
  }

  document.addEventListener('visibilitychange', syncSceneEnergyProfile);

  window.__agyWallpaperObserver = unifiedObserver;

  return {
    updateFilters: (b, c) => {
      if (isDestroyed) return;
      if (document.documentElement && document.documentElement.style) {
        document.documentElement.style.setProperty('--agy-bg-brightness', String(b));
        document.documentElement.style.setProperty('--agy-bg-contrast', String(c));
      }
    },
    updateVideoUrl: (newUrl) => {
      if (isDestroyed) return;
      videoUrl = newUrl;
      mountVideo();
    },
    // 阶段五：铺满策略热更新（只重写几何，不重建解码管道，切换零闪烁）
    updateFit: (payload = {}) => {
      if (isDestroyed) return;
      if (payload.fit !== undefined) wallpaperFitSetting = normalizeFitSetting(payload.fit);
      if (payload.fitPosition !== undefined) wallpaperFitPosition = normalizeFitPosition(payload.fitPosition);
      refreshResolvedFit();
      applyMediaGeometry();
    },
    // 多形态素材切换（视频 / 网页 / 场景），供配置变更时统一调用
    updateMedia: (payload = {}) => {
      if (isDestroyed) return;
      if (payload.fit !== undefined) wallpaperFitSetting = normalizeFitSetting(payload.fit);
      if (payload.fitPosition !== undefined) wallpaperFitPosition = normalizeFitPosition(payload.fitPosition);
      if (payload.sourceType !== undefined) sourceType = payload.sourceType || 'video';
      if (payload.wallpaperDir !== undefined) wallpaperDir = payload.wallpaperDir || '';
      if (payload.previewFile !== undefined) previewFile = payload.previewFile || '';
      if (payload.entryFile !== undefined) entryFile = payload.entryFile || '';
      if (payload.webUrl !== undefined) webUrl = payload.webUrl || '';
      if (payload.audioUrl !== undefined) audioUrl = payload.audioUrl || '';
      if (payload.audioEnabled !== undefined) audioEnabled = !!payload.audioEnabled;
      if (payload.videoUrl !== undefined) videoUrl = payload.videoUrl || '';
      if (payload.enabled !== undefined) enableVideo = !!payload.enabled;
      // 阶段八：精细渲染控制与模式解耦
      if (payload.fps !== undefined) {
        fps = Number.isFinite(payload.fps) ? payload.fps : 60;
        syncSceneEnergyProfile();
      }
      if (payload.renderDpr !== undefined) {
        renderDpr = Number.isFinite(payload.renderDpr) ? payload.renderDpr : 1.0;
        if (sceneRendererInstance) {
          try {
            const userScale = Number.isFinite(renderDpr) ? renderDpr : 1.0;
            sceneRendererInstance.setRenderDpr(Math.min(Math.max(userScale, 0.5), 1.0));
          } catch (_) {}
        }
      }
      if (payload.sceneRenderer !== undefined) sceneRenderer = normalizeSceneRenderer(payload.sceneRenderer);
      if (payload.sceneScripts !== undefined) sceneScripts = !!payload.sceneScripts;
      if (isWallpaperDeferred && !shouldDeferWallpaperForBoot()) {
        isWallpaperDeferred = false;
      }
      mountVideo();
    },
    setVideoEnabled: (enabled, newUrl) => {
      if (isDestroyed) return;
      enableVideo = !!enabled;
      if (newUrl !== undefined) videoUrl = newUrl;
      if (isWallpaperDeferred && !shouldDeferWallpaperForBoot()) {
        isWallpaperDeferred = false;
      }
      mountVideo();
    },
    updateStyle: (newCss) => {
      if (isDestroyed) return;
      glassThemeCss = newCss;
      let s = document.getElementById('agy-dynamic-wallpaper-style');
      if (!s) {
        s = document.createElement('style');
        s.id = 'agy-dynamic-wallpaper-style';
        const container = document.head || document.documentElement || document.body;
        if (container) container.appendChild(s);
      }
      if (s) s.textContent = newCss;
    },
    destroy: () => {
      isDestroyed = true;
      if (paginationEngine) {
        try { paginationEngine.destroy(); } catch (e) {}
      }
      if (window.__agyPaginationEngine) {
        try { window.__agyPaginationEngine.destroy(); } catch (e) {}
        window.__agyPaginationEngine = null;
      }
      if (bootFallbackTimer) {
        clearTimeout(bootFallbackTimer);
        bootFallbackTimer = null;
      }
      if (observerDebounceTimer) {
        clearTimeout(observerDebounceTimer);
        observerDebounceTimer = null;
      }
      isWallpaperDeferred = false;
      if (unifiedObserver) {
        try { unifiedObserver.disconnect(); } catch(e) {}
      }
      if (window.__agyWallpaperObserver) {
        try { window.__agyWallpaperObserver.disconnect(); } catch(e) {}
        window.__agyWallpaperObserver = null;
      }
      if (bubbleObserver) {
        try { bubbleObserver.disconnect(); } catch(e) {}
        bubbleObserver = null;
      }
      if (window.__agyBubbleObserver) {
        try { window.__agyBubbleObserver.disconnect(); } catch(e) {}
        window.__agyBubbleObserver = null;
      }
      enableVideo = false;
      // 阶段五：几何控制器资源回收
      if (geometryRaf) {
        cancelAnimationFrame(geometryRaf);
        geometryRaf = null;
      }
      window.removeEventListener('resize', scheduleGeometrySync);
      window.removeEventListener('orientationchange', scheduleGeometrySync);
      document.removeEventListener('fullscreenchange', scheduleGeometrySync);
      if (window.__agyViewportObserver) {
        try { window.__agyViewportObserver.disconnect(); } catch (e) {}
        window.__agyViewportObserver = null;
      }
      destroyVideoEl();
      destroyWebEl();
      destroySceneEl();
      destroyAudioEl();
      const backdrop = document.getElementById('agy-wallpaper-backdrop');
      if (backdrop) backdrop.remove();
      if (document.documentElement && document.documentElement.dataset) {
        delete document.documentElement.dataset.agyHasVideo;
      }
      const s = document.getElementById('agy-dynamic-wallpaper-style');
      if (s) s.remove();
      const testStyle = document.getElementById('test-popover-glass-style');
      if (testStyle) testStyle.remove();

      document.querySelectorAll('.user-bubble-toggle-btn, .agy-user-collapse-btn, [data-agy-collapse-btn]').forEach(b => b.remove());
      document.querySelectorAll('[data-user-collapsed], [data-user-collapsible], [data-agy-enhanced], [data-agy-collapsed]').forEach(el => {
        el.removeAttribute('data-user-collapsed');
        el.removeAttribute('data-user-collapsible');
        el.removeAttribute('data-agy-enhanced');
        el.removeAttribute('data-agy-collapsed');
        el.style.maxHeight = '';
        el.style.overflow = '';
      });
      syncTitleBarOverlay(true);
    }
  };
}

window.__agyInitWallpaper = initWallpaper;

// 全局权威宿主深度就绪判定：确保首页 DOM 与动态壁纸（特别是场景壁纸首帧与视频解码）完全落地后才放行退出开屏
if (typeof window !== 'undefined') {
  window.__agyIsHostTrulyReady = function() {
    // 核心时序：只要 DOM 构建完成（interactive 或 complete）即可，绝不盲等长轮询/SSE 结清（避免被会话冷启动拖延 20 秒）
    if (document.readyState === 'loading') return false;
    const cfg = (window.__agySkinBridge && window.__agySkinBridge.getConfig()) || window.__AG_SKIN_CONFIG__ || {};
    const f = cfg.features || {};
    const dw = f.dynamicWallpaper || {};

    // 1. 若未开启自定义皮肤或未开启动态壁纸：页面主体框架加载完成即就绪
    if (f.themeStyles === false || !dw.enabled) {
      return !!(document.querySelector('main') || document.getElementById('root') || (document.body && document.body.childElementCount > 3));
    }

    // 2. 开启了动态壁纸：必须严格验证底层素材已产生有效画面（绝不在卡顿与黑屏期间放行！）
    const source = dw.sourceType || (dw.wallpaperDir ? 'scene' : 'video');
    if (source === 'scene') {
      const sceneBox = document.getElementById('agy-dynamic-scene');
      if (!sceneBox) return false;
      // 零海报架构：动态场景必须 WebWallGL 首帧完成，并且带有 live 状态标识！
      if (window.__agySceneDynamicFailed) {
        return true; // 异常兜底，放行避免死锁
      }
      const isLiveCanvas = !!(
        window.__agySceneFirstFrameReady &&
        window.__agySceneRenderer &&
        sceneBox.querySelector('canvas.agy-scene-live')
      );
      if (!isLiveCanvas) return false;
      const liveDuration = Date.now() - (window.__agySceneFirstFrameTime || 0);
      if (liveDuration < 1000) return false;
      return true;
    } else if (source === 'video') {
      const vid = document.getElementById('agy-dynamic-video');
      if (!vid || vid.readyState < 3) return false;
    }

    // 3. 毛玻璃样式已生效
    if (!document.getElementById('agy-dynamic-wallpaper-style')) return false;

    // 4. 宿主核心交互框架（输入框/工作区）必须已经真实渲染落地（绝不在空骨架阶段放行，杜绝开机淡出后眼睁睁看着组件拼凑！）
    const hasCoreUI = !!(
      document.querySelector('textarea') ||
      document.querySelector('input') ||
      document.querySelector('[contenteditable="true"]') ||
      document.querySelector('[role="textbox"]')
    );
    if (!hasCoreUI) return false;

    return true;
  };
}
