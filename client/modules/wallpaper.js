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
    enableVideo = true
  } = options;

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
    if (window.__agyBootPlaying) return true;
    const hasBootDom = !!document.getElementById('agy-video-boot-host') ||
                       !!document.getElementById('agy-custom-code-boot-host');
    if (hasBootDom) return true;
    return false;
  }

  // 开机动画结束时与壁纸同步的平滑渐入接口
  window.__agyResumeBootWallpaper = function() {
    window.__agyBootPlaying = false;
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
              v.load();
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
      return u.searchParams.get('path') || u.pathname || src;
    } catch (_) {
      return src;
    }
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
      document.body.prepend(videoEl);
    }

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
          // 若加载中发生 AbortError，等待 canplay/loadeddata 自动重新尝试
        });
      }
    };

    if (!videoEl.__agyBound) {
      videoEl.__agyBound = true;
      const onDataReady = () => {
        onPlayReady();
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

    ensureStyle();
    return videoEl;
  }

  // 挂载/卸载动态视频元素
  function mountVideo() {
    if (isDestroyed) return null;
    syncTitleBarOverlay();
    return realMountVideo(true);
  }

  mountVideo();

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
        el.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 -960 960 960" fill="currentColor" class="animate-spin text-muted-foreground shrink-0 opacity-70" data-testid="status-loading-spinner" aria-label="Loading session"><path d="M332.55-129.9q-69.29-29.9-121.02-81.63T129.9-332.55T100-480.35t29.96-147.5t81.58-120.61t121.04-81.58T480-860q12.75,0 21.37,8.63T510-829.99t-8.62,21.37T480-800q-133,0-226.5,93.5T160-480t93.5,226.5T480-160t226.5-93.5T800-480q0-12.77 8.63-21.38T830.01-510t21.37,8.62T860-480q0,77.99-29.96,147.42T748.46-211.54T627.85-129.96T480.35-100t-147.8-29.9Z"/></svg>';
      }
      if (!el.isConnected) {
        const mountRoot = document.body || document.documentElement;
        if (mountRoot) mountRoot.appendChild(el);
      }
      return el;
    }
    ensureOverlay();

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
      }
    }

    function hideSessionLoading() {
      clearTimeout(sessionSwitchTimeout);
      const el = document.getElementById('agy-session-loader-overlay');
      if (el) {
        el.classList.remove('agy-loader-active');
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
      const needVideo = enableVideo && videoUrl;
      const hasVid = !!document.getElementById('agy-dynamic-video');
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
      const v = document.getElementById('agy-dynamic-video');
      if (v) {
        try { v.pause(); } catch(e) {}
        v.remove();
      }
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
