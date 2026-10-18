/**
 * index.js - Antigravity Skin & Theme Client Entry Point
 */

(() => {
  // 1. 本地配置缓存与 RPC 桥接
  let currentConfig = window.__AG_SKIN_CONFIG__ || {
    enabled: true,
    features: {
      bootAnimation: false,
      bootAnimationConfig: {
        type: 'video',
        customCodePath: '',
        videoPath: ''
      },
      themeStyles: false,
      crtScanlines: false,
      chineseLocalization: true,
      dynamicWallpaper: {
        enabled: false,
        videoPath: '',
        brightness: 0.85,
        contrast: 1.05
      }
    }
  };

  const API_PORT = window.__AG_SKIN_PORT__ || 59288;
  const API_BASE = `http://127.0.0.1:${API_PORT}`;

  // 状态句柄与壁纸状态缓存
  let wallpaperHandle = null;
  let crtHandle = null;
  let menuHandle = null;
  let lastWallpaperState = {
    isCustomTheme: undefined,
    isVideoOn: undefined,
    videoPath: undefined,
    brightness: undefined,
    contrast: undefined
  };

  function saveConfigRemote(newCfg) {
    currentConfig = newCfg;
    window.__AG_SKIN_CONFIG__ = newCfg;
    try {
      fetch(`${API_BASE}/api/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCfg)
      }).catch(err => {
        console.warn('[Antigravity Skin] Failed to save config to sidecar:', err);
      });
    } catch (e) {}
  }

  window.__agySkinBridge = {
    getConfig: () => currentConfig,
    saveConfig: saveConfigRemote
  };

  // 核心时序防护：仅在已播放或用户已在工作区产生实质输入时跳过开机动画
  function shouldAbandonBootAnimation(activeCfg) {
    if (sessionStorage.getItem('__agy_booted__')) return true;
    if (!activeCfg.features?.bootAnimation) return true;

    try {
      // 关键修复：页面初始自动获得焦点（如聊天输入框）不等于用户正在输入！必须有非空输入内容才判定为正在打字
      const activeEl = document.activeElement;
      const isUserTyping = activeEl && (
        (activeEl.tagName === 'TEXTAREA' && activeEl.value && activeEl.value.trim().length > 0) ||
        (activeEl.tagName === 'INPUT' && activeEl.value && activeEl.value.trim().length > 0) ||
        ((activeEl.isContentEditable || activeEl.getAttribute?.('contenteditable') === 'true') && activeEl.textContent && activeEl.textContent.trim().length > 0)
      );
      if (isUserTyping) {
        sessionStorage.setItem('__agy_booted__', 'true');
        window.__agyBootPlaying = false;
        if (typeof window.__agyResumeBootWallpaper === 'function') {
          try { window.__agyResumeBootWallpaper(); } catch (e) {}
        }
        return true;
      }
    } catch (_) {}

    return false;
  }

  function checkAndTriggerBootAnimation() {
    const bridge = window.__agySkinBridge;
    const cfg = bridge ? bridge.getConfig() : (window.__AG_SKIN_CONFIG__ || currentConfig);
    if (shouldAbandonBootAnimation(cfg)) return;
    if (typeof window.__triggerBootAnimation === 'function') {
      window.__triggerBootAnimation();
    }
  }

  if (window.__AG_SKIN_ATTACHED__) {
    console.log('[Antigravity Skin] Re-checking skin active state & DOM attachments...');
    if (typeof window.__agySyncTitleBar === 'function') {
      window.__agySyncTitleBar(true);
    }

    if (typeof window.__agyInitAppearanceMenu === 'function') {
      menuHandle = window.__agyInitAppearanceMenu(
        () => (window.__AG_SKIN_CONFIG__ || currentConfig),
        saveConfigRemote,
        (updatedConfig) => {
          if (typeof window.__agyApplyFeatures === 'function') {
            window.__agyApplyFeatures(updatedConfig);
          }
        }
      );
    }
    // 关键自愈：如果视频或样式在 DOM 中遗失（例如更新后重载或 SPA 导航），立即补挂（开机动效播放时除外）
    const needStyle = currentConfig.features?.themeStyles !== false;
    const needWallpaper = needStyle && currentConfig.features?.dynamicWallpaper?.enabled === true && !!currentConfig.features?.dynamicWallpaper?.videoPath;
    const isBootPlaying = !!window.__agyBootPlaying ||
                          !!document.getElementById('agy-video-boot-host') ||
                          !!document.getElementById('agy-custom-code-boot-host');
    const hasVideo = !!document.getElementById('agy-dynamic-video');
    const hasStyle = !!document.getElementById('agy-dynamic-wallpaper-style');
    if (!isBootPlaying) {
      if (!needWallpaper && hasVideo) {
        const oldVid = document.getElementById('agy-dynamic-video');
        if (oldVid) { try { oldVid.pause(); } catch(e){} oldVid.remove(); }
      }
      if ((needWallpaper && !hasVideo) || (needStyle && !hasStyle)) {
        console.log('[Antigravity Skin] Missing video or style in DOM, re-applying features immediately...');
        if (typeof window.__agyApplyFeatures === 'function') {
          window.__agyApplyFeatures(currentConfig);
        }
      }
    }

    // 检查并确保本会话未播放过的开机动画能够即刻呈现
    try {
      checkAndTriggerBootAnimation();
    } catch (e) {
      console.warn('[Antigravity Skin] Error triggering boot animation in attached re-entry:', e);
    }
    return;
  }
  window.__AG_SKIN_ATTACHED__ = true;

  console.log('[Antigravity Skin] Initializing custom theme and skin...');


  function applyFeatures(cfg) {
    const f = cfg.features || {};
    const dw = f.dynamicWallpaper || {};

    // A. 背景视频与毛玻璃增量细粒度更新
    const isCustomTheme = f.themeStyles !== false;
    if (isCustomTheme) {
      const isVideoOn = dw.enabled === true;
      const videoPath = dw.videoPath || '';
      const brightness = dw.brightness || 0.85;
      const contrast = dw.contrast || 1.05;
      const videoUrl = (isVideoOn && videoPath) ? `${API_BASE}/wallpaper.mp4?path=${encodeURIComponent(videoPath)}` : '';

      try {
        if (!wallpaperHandle) {
          if (typeof window.__agyInitWallpaper === 'function') {
            wallpaperHandle = window.__agyInitWallpaper({
              videoUrl,
              enableVideo: isVideoOn && !!videoPath,
              brightness,
              contrast,
              glassThemeCss: window.__AG_SKIN_GLASS_CSS__ || ''
            });
            lastWallpaperState = { isCustomTheme, isVideoOn, videoPath, brightness, contrast };
          }
        } else {
          // 仅当滤镜参数发生改变时才更新 CSS 变量（0 渲染开销，视频完全不中断）
          if (lastWallpaperState.brightness !== brightness || lastWallpaperState.contrast !== contrast) {
            wallpaperHandle.updateFilters(brightness, contrast);
            lastWallpaperState.brightness = brightness;
            lastWallpaperState.contrast = contrast;
          }
          if (typeof wallpaperHandle.updateStyle === 'function') {
            wallpaperHandle.updateStyle(window.__AG_SKIN_GLASS_CSS__ || '');
          }
          // 仅当视频开启状态、视频素材路径变动或视频元素未在播放时更新，杜绝无效重载同时保障开机自愈
          const vidEl = document.getElementById('agy-dynamic-video');
          const shouldRunVideo = isVideoOn && !!videoPath;
          const needVideoUpdate = lastWallpaperState.isVideoOn !== isVideoOn ||
                                  lastWallpaperState.videoPath !== videoPath ||
                                  lastWallpaperState.isCustomTheme !== isCustomTheme ||
                                  (shouldRunVideo && (!vidEl || vidEl.paused || vidEl.style.opacity !== '1'));
          if (needVideoUpdate) {
            if (typeof wallpaperHandle.setVideoEnabled === 'function') {
              wallpaperHandle.setVideoEnabled(shouldRunVideo, videoUrl);
            } else if (!shouldRunVideo) {
              const oldVid = document.getElementById('agy-dynamic-video');
              if (oldVid) {
                try { oldVid.pause(); } catch(e) {}
                oldVid.remove();
              }
            }
            lastWallpaperState.isVideoOn = isVideoOn;
            lastWallpaperState.videoPath = videoPath;
            lastWallpaperState.isCustomTheme = isCustomTheme;
          }
        }
      } catch (err) {
        console.warn('[Antigravity Skin] Failed to init/update wallpaper:', err);
      }
    } else {
      lastWallpaperState = { isCustomTheme: false, isVideoOn: false, videoPath: '', brightness: 0, contrast: 0 };
      if (wallpaperHandle) {
        try { wallpaperHandle.destroy(); } catch(e) {}
        wallpaperHandle = null;
      }
      try {
        const oldVid = document.getElementById('agy-dynamic-video');
        if (oldVid) {
          try { oldVid.pause(); } catch(e) {}
          oldVid.remove();
        }
        const oldBackdrop = document.getElementById('agy-wallpaper-backdrop');
        if (oldBackdrop) oldBackdrop.remove();
        if (document.documentElement && document.documentElement.dataset) {
          delete document.documentElement.dataset.agyHasVideo;
        }
        const oldStyle = document.getElementById('agy-dynamic-wallpaper-style');
        if (oldStyle) oldStyle.remove();
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

        if (window.__agyWallpaperObserver) {
          try { window.__agyWallpaperObserver.disconnect(); } catch (e) {}
          window.__agyWallpaperObserver = null;
        }
        if (window.__agyBubbleObserver) {
          try { window.__agyBubbleObserver.disconnect(); } catch (e) {}
          window.__agyBubbleObserver = null;
        }

        if (window.electronNative && typeof window.electronNative.setTitleBarOverlay === 'function') {
          const isDark = document.body && (document.body.classList.contains('dark') || document.body.classList.contains('theme-dark'));
          window.electronNative.setTitleBarOverlay({
            color: isDark ? '#18181b' : '#f8fafc',
            symbolColor: isDark ? '#f4f4f5' : '#334155',
            height: 35
          }).catch(() => {});
        }
      } catch (err) {}
    }

    // B. CRT 扫描线清理（已停用）
    if (crtHandle) {
      try { crtHandle.destroy(); } catch(e) {}
      crtHandle = null;
    }
    try {
      const crtEl = document.getElementById('agy-550c-theme');
      if (crtEl) crtEl.remove();
    } catch(e) {}

    // C. 语言切换
    try {
      if (f.language && window.__agyI18n && typeof window.__agyI18n.setLanguage === 'function') {
        window.__agyI18n.setLanguage(f.language);
      }
    } catch(e) {}
  }

  window.__agyApplyFeatures = applyFeatures;

  // 2.5 启动第零防线：第一时间强力同步标题栏完全透明
  if (typeof window.__agySyncTitleBar === 'function') {
    try { window.__agySyncTitleBar(true); } catch(e) {}
  }

  // 3. 开机引导动画优先检测与极速呈现（若开启且本 Session 未播放过）
  // 核心时序：优先挂载开屏动画素材，推迟动态壁纸资源的下载与渲染，彻底消除开机闪现壁纸的割裂感！
  try {
    checkAndTriggerBootAnimation();
  } catch (err) {
    console.warn('[Antigravity Skin] Error in early boot animation trigger:', err);
  }

  // 4. 初始生效其余主题与皮肤特性（若开屏动效正在播放，动态壁纸将自动进入推迟队列，仅注入毛玻璃与基础样式）
  try {
    applyFeatures(currentConfig);
  } catch (err) {
    console.warn('[Antigravity Skin] Error in initial applyFeatures:', err);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      if (typeof window.__agySyncTitleBar === 'function') {
        try { window.__agySyncTitleBar(true); } catch(e) {}
      }
      checkAndTriggerBootAnimation();
      try { applyFeatures(currentConfig); } catch (e) {}
    }, { once: true });
    window.addEventListener('load', () => {
      if (typeof window.__agySyncTitleBar === 'function') {
        try { window.__agySyncTitleBar(true); } catch(e) {}
      }
      try { applyFeatures(currentConfig); } catch (e) {}
    }, { once: true });
  }

  // 5. 挂载外观页面设置菜单
  try {
    if (typeof window.__agyInitAppearanceMenu === 'function') {
      menuHandle = window.__agyInitAppearanceMenu(
        () => (window.__AG_SKIN_CONFIG__ || currentConfig),
        saveConfigRemote,
        (updatedConfig) => {
          applyFeatures(updatedConfig);
        }
      );
    }
  } catch (err) {
    console.warn('[Antigravity Skin] Error in __agyInitAppearanceMenu:', err);
  }

  console.log('[Antigravity Skin] Custom skin running smoothly.');
})();
