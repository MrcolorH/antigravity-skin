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
        type: 'code',
        codeMode: '550c',
        customCodePath: '',
        videoPath: 'assets/videos/default-bg.mp4'
      },
      themeStyles: true,
      crtScanlines: false,
      chineseLocalization: true,
      dynamicWallpaper: {
        enabled: true,
        videoPath: "assets/videos/default-bg.mp4",
        brightness: 0.85,
        contrast: 1.05
      }
    }
  };

  const API_PORT = window.__AG_SKIN_PORT__ || 59288;
  const API_BASE = `http://127.0.0.1:${API_PORT}`;

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

  function checkAndTriggerBootAnimation() {
    const activeCfg = (window.__agySkinBridge && window.__agySkinBridge.getConfig()) || currentConfig || window.__AG_SKIN_CONFIG__ || {};
    if (activeCfg.features?.bootAnimation && !sessionStorage.getItem('__agy_booted__')) {
      sessionStorage.setItem('__agy_booted__', 'true');
      if (typeof window.__triggerBootAnimation === 'function') {
        window.__triggerBootAnimation();
      } else if (typeof window.__trigger550C === 'function') {
        window.__trigger550C();
      }
    }
  }

  if (window.__AG_SKIN_ATTACHED__) {
    console.log('[Antigravity Skin] Re-checking skin active state & DOM attachments...');
    if (typeof window.__agySyncTitleBar === 'function') {
      window.__agySyncTitleBar();
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
    const needWallpaper = needStyle && currentConfig.features?.dynamicWallpaper?.enabled !== false;
    const isBootPlaying = !!document.querySelector('.dsh550c-host') ||
                          !!document.getElementById('agy-video-boot-host') ||
                          !!document.getElementById('agy-custom-code-boot-host');
    const hasVideo = !!document.getElementById('agy-dynamic-video');
    const hasStyle = !!document.getElementById('agy-dynamic-wallpaper-style');
    if (!isBootPlaying && ((needWallpaper && !hasVideo) || (needStyle && !hasStyle))) {
      console.log('[Antigravity Skin] Missing video or style in DOM, re-applying features immediately...');
      if (typeof window.__agyApplyFeatures === 'function') {
        window.__agyApplyFeatures(currentConfig);
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

  // 2. 状态句柄与壁纸状态缓存
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

  function applyFeatures(cfg) {
    const f = cfg.features || {};
    const dw = f.dynamicWallpaper || {};

    // A. 背景视频与毛玻璃增量细粒度更新
    const isCustomTheme = f.themeStyles !== false;
    if (isCustomTheme) {
      const isVideoOn = dw.enabled !== false;
      const videoPath = dw.videoPath || 'assets/videos/default-bg.mp4';
      const brightness = dw.brightness || 0.85;
      const contrast = dw.contrast || 1.05;
      const videoUrl = isVideoOn ? `${API_BASE}/wallpaper.mp4?path=${encodeURIComponent(videoPath)}` : '';

      try {
        if (!wallpaperHandle) {
          if (typeof window.__agyInitWallpaper === 'function') {
            wallpaperHandle = window.__agyInitWallpaper({
              videoUrl,
              enableVideo: isVideoOn,
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
          // 仅当视频开启状态或视频素材路径真实发生变动时，才调用 setVideoEnabled
          // 彻底阻断切换开机动画、切换语言等无关操作导致的背景视频重载与黑屏闪烁！
          const needVideoUpdate = lastWallpaperState.isVideoOn !== isVideoOn ||
                                  lastWallpaperState.videoPath !== videoPath ||
                                  lastWallpaperState.isCustomTheme !== isCustomTheme;
          if (needVideoUpdate) {
            if (typeof wallpaperHandle.setVideoEnabled === 'function') {
              wallpaperHandle.setVideoEnabled(isVideoOn, videoUrl);
            } else if (!isVideoOn) {
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
        const oldStyle = document.getElementById('agy-dynamic-wallpaper-style');
        if (oldStyle) oldStyle.remove();
        const testStyle = document.getElementById('test-popover-glass-style');
        if (testStyle) testStyle.remove();

        document.querySelectorAll('.user-bubble-toggle-btn, .agy-user-collapse-btn, [data-agy-collapse-btn]').forEach(b => b.remove());
        document.querySelectorAll('[data-user-collapsed], [data-agy-collapsed]').forEach(el => {
          el.removeAttribute('data-user-collapsed');
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

  // 3. 初始生效
  try {
    applyFeatures(currentConfig);
  } catch (err) {
    console.warn('[Antigravity Skin] Error in initial applyFeatures:', err);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      try { applyFeatures(currentConfig); } catch (e) {}
    }, { once: true });
    window.addEventListener('load', () => {
      try { applyFeatures(currentConfig); } catch (e) {}
    }, { once: true });
  }

  // 4. 挂载外观页面设置菜单
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

  // 5. 开机引导动画（如果开启且未在本 Session 播放过）
  // 极速零延迟冷启动：第一时间即刻全屏呈现 550C 终端，绝不干等 window.load，消除死黑假死感！
  checkAndTriggerBootAnimation();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkAndTriggerBootAnimation, { once: true });
  }

  console.log('[Antigravity Skin] Custom skin running smoothly.');
})();
