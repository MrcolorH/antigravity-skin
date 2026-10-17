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
  let {
    videoUrl = 'http://127.0.0.1:59288/wallpaper.mp4',
    brightness = 0.85,
    contrast = 1.05,
    glassThemeCss = '',
    enableVideo = true
  } = options;

  // 1. 设置滤镜变量（安全容错防早期 null）
  function applyFilterVars() {
    if (document.documentElement && document.documentElement.style) {
      document.documentElement.style.setProperty('--agy-bg-brightness', String(brightness));
      document.documentElement.style.setProperty('--agy-bg-contrast', String(contrast));
    }
  }
  applyFilterVars();

  // 1.5 确保全局默认背景底板存在（无素材时呈现优雅纯白底/深色底，杜绝透出全黑）
  function ensureBackdrop() {
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
          if (!document.getElementById('agy-wallpaper-backdrop') && document.body) {
            document.body.prepend(backdropEl);
          }
        }, { once: true });
      }
    }
    return backdropEl;
  }

  // 2. 注入全局毛玻璃样式
  function ensureStyle() {
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
    const cfg = (window.__agySkinBridge && window.__agySkinBridge.getConfig()) || window.__AG_SKIN_CONFIG__ || {};
    const hasBootDom = !!document.getElementById('agy-video-boot-host') ||
                       !!document.getElementById('agy-custom-code-boot-host');
    if (hasBootDom) return true;
    if (cfg.features?.bootAnimation && !sessionStorage.getItem('__agy_booted__')) {
      return true;
    }
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

  function realMountVideo(fadeIn = true) {
    if (!enableVideo || !videoUrl) {
      if (document.documentElement && document.documentElement.dataset) {
        document.documentElement.dataset.agyHasVideo = 'false';
      }
      const v = document.getElementById('agy-dynamic-video');
      if (v) {
        try { v.pause(); } catch(e) {}
        v.remove();
      }
      ensureBackdrop();
      ensureStyle();
      return null;
    }

    if (document.documentElement && document.documentElement.dataset) {
      document.documentElement.dataset.agyHasVideo = 'true';
    }
    ensureBackdrop();

    let videoEl = document.getElementById('agy-dynamic-video');
    if (!videoEl) {
      videoEl = document.createElement('video');
      videoEl.id = 'agy-dynamic-video';
      videoEl.autoplay = true;
      videoEl.loop = true;
      videoEl.muted = true;
      videoEl.playsInline = true;
      videoEl.preload = 'auto';
      videoEl.setAttribute('muted', '');
      videoEl.setAttribute('autoplay', '');
      videoEl.setAttribute('loop', '');
      videoEl.setAttribute('playsinline', '');
      videoEl.setAttribute('preload', 'auto');
      // 默认完全就绪呈现，避免被卡在 opacity 0
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

    if (videoUrl) {
      let isSame = false;
      try {
        const curPath = new URL(videoEl.src, location.href).searchParams.get('path') || videoEl.src;
        const newPath = new URL(videoUrl, location.href).searchParams.get('path') || videoUrl;
        isSame = !!curPath && curPath === newPath;
      } catch (e) {
        isSame = (videoEl.src === videoUrl);
      }
      if (!isSame) {
        videoEl.src = videoUrl;
        try { videoEl.load(); } catch(e) {}
      }
    }

    const onPlayReady = () => {
      if (videoEl && videoEl.style.opacity !== '1') {
        requestAnimationFrame(() => {
          videoEl.style.opacity = '1';
        });
      }
    };

    videoEl.addEventListener('canplay', onPlayReady);
    videoEl.addEventListener('playing', onPlayReady);
    videoEl.addEventListener('loadeddata', onPlayReady);
    videoEl.addEventListener('timeupdate', onPlayReady);

    if (videoEl.readyState >= 2 && !videoEl.paused) {
      onPlayReady();
    } else {
      const p = videoEl.play();
      if (p && typeof p.catch === 'function') {
        p.then(onPlayReady).catch(() => {
          const tryPlayOnGesture = () => {
            videoEl.play().then(onPlayReady).catch(() => {});
            window.removeEventListener('click', tryPlayOnGesture);
            window.removeEventListener('keydown', tryPlayOnGesture);
          };
          window.addEventListener('click', tryPlayOnGesture, { once: true });
          window.addEventListener('keydown', tryPlayOnGesture, { once: true });
        });
      }
    }

    ensureStyle();
    return videoEl;
  }

  // 挂载/卸载动态视频元素
  function mountVideo() {
    syncTitleBarOverlay();
    return realMountVideo(true);
  }

  mountVideo();

  // 4. 用户提问气泡智能折叠/展开胶囊按钮与吸顶增强管理 (遵照 floating_user_bubble_spec.md v1.2.0)
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

  function enhanceUserBubbles() {
    const userSteps = document.querySelectorAll('[data-testid="user-input-step"], [class*="group/user-input-step"]');
    if (!userSteps.length) return;

    // 读阶段（Read Phase）：收集未增强过的 steps，避免在写 DOM 时穿插读取几何属性触发 Layout Thrashing
    const pendingSteps = [];
    userSteps.forEach(step => {
      if (step.hasAttribute('data-agy-enhanced')) return;

      const card = step.querySelector('[data-testid="lifted-context-menu-trigger"]') ||
                   step.querySelector('div.relative.p-px.rounded-xl.bg-card-border') ||
                   step.querySelector('.bg-card') ||
                   step;

      const textEl = step.querySelector('[data-quotable="true"]') || step.querySelector('.whitespace-pre-wrap');

      // 精准检测图片附件：必须是真正的图片上传（排除 @mention 范围内的 markdown.svg/图标等）
      const hasRealImg = !!step.querySelector(
        'button[aria-label*=".png"], button[aria-label*=".jpg"], button[aria-label*=".jpeg"], button[aria-label*=".webp"], div[data-no-scroll-jump="true"] img, img:not([src*=".svg"]):not(.context-scope-mention img)'
      );

      // 纯内存字符串快速预判（避免使用触发强制重排的 innerText）
      let isMultiLine = false;
      if (textEl) {
        const textContent = (textEl.textContent || '').trim();
        const lineCount = textContent.split(/\r?\n/).filter(Boolean).length;
        // 纯字符粗筛：换行大于1或字数超过65，直接确定为长文本
        if ((lineCount > 1 && textContent.length > 25) || textContent.length > 65) {
          isMultiLine = true;
        } else if (textContent.length > 20) {
          // 仅在临界字数时才读取一次 scrollHeight，且不调用 getComputedStyle
          isMultiLine = textEl.scrollHeight > 52;
        }
      }

      pendingSteps.push({
        step,
        card,
        needsCollapse: hasRealImg || isMultiLine
      });
    });

    if (!pendingSteps.length) return;

    // 写阶段（Write Phase）：批量写入 DOM 属性与组件挂载
    pendingSteps.forEach(({ step, card, needsCollapse }) => {
      step.setAttribute('data-agy-enhanced', 'true');
      step.setAttribute('data-user-collapsible', String(needsCollapse));

      if (!needsCollapse) {
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

  window.__enhanceUserBubbles = scheduleEnhanceUserBubbles;
  scheduleEnhanceUserBubbles();

  // 5. 单一轻量 DOM 监视器（合并冗余 Observer，精准节流）
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
    if (observerDebounceTimer) return;
    observerDebounceTimer = setTimeout(() => {
      observerDebounceTimer = null;
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
      syncTitleBarOverlay();
    }, 120);
  });

  const rootToObserve = document.body || document.documentElement;
  if (rootToObserve) {
    unifiedObserver.observe(rootToObserve, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'data-theme']
    });
  }
  window.__agyWallpaperObserver = unifiedObserver;

  return {
    updateFilters: (b, c) => {
      if (document.documentElement && document.documentElement.style) {
        document.documentElement.style.setProperty('--agy-bg-brightness', String(b));
        document.documentElement.style.setProperty('--agy-bg-contrast', String(c));
      }
    },
    updateVideoUrl: (newUrl) => {
      videoUrl = newUrl;
      const v = document.getElementById('agy-dynamic-video');
      if (v && newUrl) {
        v.src = newUrl;
        try { v.load(); } catch(e) {}
        v.play().catch(() => {});
      }
    },
    setVideoEnabled: (enabled, newUrl) => {
      enableVideo = !!enabled;
      if (newUrl !== undefined) videoUrl = newUrl;
      if (isWallpaperDeferred && !shouldDeferWallpaperForBoot()) {
        isWallpaperDeferred = false;
      }
      mountVideo();
    },
    updateStyle: (newCss) => {
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
      if (bootFallbackTimer) {
        clearTimeout(bootFallbackTimer);
        bootFallbackTimer = null;
      }
      isWallpaperDeferred = false;
      if (window.__agyWallpaperObserver) {
        try { window.__agyWallpaperObserver.disconnect(); } catch(e) {}
        window.__agyWallpaperObserver = null;
      }
      if (window.__agyBubbleObserver) {
        try { window.__agyBubbleObserver.disconnect(); } catch(e) {}
        window.__agyBubbleObserver = null;
      }
      const v = document.getElementById('agy-dynamic-video');
      if (v) v.remove();
      const backdrop = document.getElementById('agy-wallpaper-backdrop');
      if (backdrop) backdrop.remove();
      if (document.documentElement && document.documentElement.dataset) {
        delete document.documentElement.dataset.agyHasVideo;
      }
      const s = document.getElementById('agy-dynamic-wallpaper-style');
      if (s) s.remove();
      document.querySelectorAll('.user-bubble-toggle-btn, .agy-user-collapse-btn, [data-agy-collapse-btn]').forEach(b => b.remove());
      document.querySelectorAll('[data-user-collapsed], [data-agy-collapsed]').forEach(el => {
        el.removeAttribute('data-user-collapsed');
        el.removeAttribute('data-agy-collapsed');
        el.style.maxHeight = '';
        el.style.overflow = '';
      });
    }
  };
}

window.__agyInitWallpaper = initWallpaper;
