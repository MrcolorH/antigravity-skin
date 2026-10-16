/**
 * index.js - Antigravity Skin & Theme Client Entry Point
 */

(() => {
  if (window.__AG_SKIN_ATTACHED__) {
    console.log('[Antigravity Skin] Already attached, skipping.');
    return;
  }
  window.__AG_SKIN_ATTACHED__ = true;

  console.log('[Antigravity Skin] Initializing custom theme and skin...');

  // 1. 本地配置缓存与 RPC 桥接
  let currentConfig = window.__AG_SKIN_CONFIG__ || {
    enabled: true,
    features: {
      bootAnimation: false,
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

  // 2. 状态句柄
  let wallpaperHandle = null;
  let crtHandle = null;
  let menuHandle = null;

  function applyFeatures(cfg) {
    const f = cfg.features || {};

    // A. 背景视频与毛玻璃
    if (f.dynamicWallpaper && f.dynamicWallpaper.enabled !== false) {
      const videoUrl = `${API_BASE}/wallpaper.mp4?t=${Date.now()}`;
      if (!wallpaperHandle) {
        if (typeof window.__agyInitWallpaper === 'function') {
          wallpaperHandle = window.__agyInitWallpaper({
            videoUrl,
            brightness: f.dynamicWallpaper.brightness || 0.85,
            contrast: f.dynamicWallpaper.contrast || 1.05,
            glassThemeCss: window.__AG_SKIN_GLASS_CSS__ || ''
          });
        }
      } else {
        wallpaperHandle.updateFilters(f.dynamicWallpaper.brightness || 0.85, f.dynamicWallpaper.contrast || 1.05);
      }
    } else {
      if (wallpaperHandle) {
        wallpaperHandle.destroy();
        wallpaperHandle = null;
      }
    }

    // B. CRT 扫描线
    if (f.crtScanlines) {
      if (!crtHandle && typeof window.__agyInitCrtTheme === 'function') {
        crtHandle = window.__agyInitCrtTheme(window.__AG_SKIN_CRT_CSS__ || '');
      }
    } else {
      if (crtHandle) {
        crtHandle.destroy();
        crtHandle = null;
      }
    }
  }

  // 3. 初始生效
  applyFeatures(currentConfig);

  // 4. 挂载外观页面设置菜单
  if (typeof window.__agyInitAppearanceMenu === 'function') {
    menuHandle = window.__agyInitAppearanceMenu(
      () => currentConfig,
      saveConfigRemote,
      (updatedConfig) => {
        applyFeatures(updatedConfig);
      }
    );
  }

  // 5. 开机引导动画（如果开启且未在本 Session 播放过）
  if (currentConfig.features?.bootAnimation && !sessionStorage.getItem('__agy_booted__')) {
    sessionStorage.setItem('__agy_booted__', 'true');
    if (typeof window.__trigger550C === 'function') {
      window.__trigger550C();
    }
  }

  console.log('[Antigravity Skin] Custom skin running smoothly.');
})();
