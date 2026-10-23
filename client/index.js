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
    contrast: undefined,
    fitKey: undefined
  };

  // 外部素材库路径 → web-proxy 路径安全编码（支持中文 / 空格 / 反斜杠）
  function toBase64UrlPath(str) {
    try {
      const bytes = new TextEncoder().encode(String(str || ''));
      let bin = '';
      for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    } catch (_) {
      return '';
    }
  }

  function applyFeatures(cfg) {
    const f = cfg.features || {};
    const dw = f.dynamicWallpaper || {};

    // A. 背景素材（视频 / 网页 / 场景）与毛玻璃增量细粒度更新
    const isCustomTheme = f.themeStyles !== false;
    if (isCustomTheme) {
      const isVideoOn = dw.enabled === true;
      const videoPath = dw.videoPath || '';
      const sourceType = dw.sourceType || (dw.wallpaperDir ? 'scene' : 'video');
      const wallpaperDir = dw.wallpaperDir || '';
      const previewFile = dw.previewFile || '';
      const entryFile = dw.entryFile || '';
      const audioFile = dw.audioFile || '';
      const audioEnabled = dw.audioEnabled === true;
      const brightness = dw.brightness || 0.85;
      const contrast = dw.contrast || 1.05;
      // 阶段六：铺满策略改为 auto——场景壁纸按「完整显示」处理，视频/网页仍铺满裁切
      const fit = dw.fit || 'auto';
      const fitPosition = dw.fitPosition || 'center';
      // 阶段七/八：场景动态渲染模式与精细控制（fps, renderDpr）
      const sceneRenderer = dw.sceneRenderer || 'dynamic';
      const sceneScripts = dw.sceneScripts === true;
      const fps = Number.isFinite(dw.fps) ? dw.fps : 60;
      const renderDpr = Number.isFinite(dw.renderDpr) ? dw.renderDpr : 1.0;

      const hasSource = sourceType === 'video' ? !!videoPath : !!wallpaperDir;
      const mediaOn = isVideoOn && hasSource;
      const videoUrl = (mediaOn && sourceType === 'video' && videoPath)
        ? `${API_BASE}/wallpaper.mp4?path=${encodeURIComponent(videoPath)}`
        : '';
      const webUrl = (mediaOn && sourceType === 'web' && wallpaperDir && entryFile)
        ? `${API_BASE}/api/wallpaper-library/web-proxy/${toBase64UrlPath(wallpaperDir)}/${String(entryFile).split('/').map(encodeURIComponent).join('/')}`
        : '';
      const audioUrl = (mediaOn && sourceType === 'scene' && audioFile && wallpaperDir)
        ? `${API_BASE}/api/wallpaper-library/audio?folder=${encodeURIComponent(wallpaperDir)}&file=${encodeURIComponent(audioFile)}`
        : '';
      const mediaKey = [mediaOn, sourceType, videoPath, wallpaperDir, previewFile, entryFile, audioEnabled, audioUrl, sceneRenderer, sceneScripts, fps, renderDpr].join('|');
      // 阶段五：铺满策略单独成键——它只影响几何，绝不该触发解码管道重建
      const fitKey = [fit, fitPosition].join('|');

      try {
        if (!wallpaperHandle) {
          if (typeof window.__agyInitWallpaper === 'function') {
            wallpaperHandle = window.__agyInitWallpaper({
              videoUrl,
              enableVideo: mediaOn,
              brightness,
              contrast,
              glassThemeCss: window.__AG_SKIN_GLASS_CSS__ || '',
              sourceType,
              wallpaperDir,
              previewFile,
              entryFile,
              webUrl,
              audioUrl,
              audioEnabled,
              fit,
              fitPosition,
              fps,
              renderDpr,
              sceneRenderer,
              sceneScripts
            });
            window.__agyWallpaperInstance = wallpaperHandle;
            lastWallpaperState = { isCustomTheme, isVideoOn, videoPath, brightness, contrast, mediaKey, fitKey };
          }
        } else {
          // 仅当滤镜参数发生改变时才更新 CSS 变量（0 渲染开销，素材完全不中断）
          if (lastWallpaperState.brightness !== brightness || lastWallpaperState.contrast !== contrast) {
            wallpaperHandle.updateFilters(brightness, contrast);
            lastWallpaperState.brightness = brightness;
            lastWallpaperState.contrast = contrast;
          }
          if (typeof wallpaperHandle.updateStyle === 'function') {
            wallpaperHandle.updateStyle(window.__AG_SKIN_GLASS_CSS__ || '');
          }
          // 阶段五：铺满策略热更新——仅重写几何声明，不触碰解码管道（切换零闪烁）
          if (lastWallpaperState.fitKey !== fitKey) {
            if (typeof wallpaperHandle.updateFit === 'function') {
              try { wallpaperHandle.updateFit({ fit, fitPosition }); } catch (e) {}
            }
            lastWallpaperState.fitKey = fitKey;
          }
          if (lastWallpaperState.mediaKey !== mediaKey) {
            if (typeof wallpaperHandle.updateMedia === 'function') {
              wallpaperHandle.updateMedia({
                enabled: mediaOn,
                sourceType,
                wallpaperDir,
                previewFile,
                entryFile,
                webUrl,
                audioUrl,
                audioEnabled,
                videoUrl,
                fit,
                fitPosition,
                fps,
                renderDpr,
                sceneRenderer,
                sceneScripts
              });
            } else if (typeof wallpaperHandle.setVideoEnabled === 'function') {
              wallpaperHandle.setVideoEnabled(mediaOn, videoUrl);
            }
            if (!mediaOn) {
              if (document.documentElement && document.documentElement.dataset) {
                document.documentElement.dataset.agyHasVideo = 'false';
              }
            }
            lastWallpaperState.mediaKey = mediaKey;
            lastWallpaperState.isVideoOn = isVideoOn;
            lastWallpaperState.videoPath = videoPath;
            lastWallpaperState.isCustomTheme = isCustomTheme;
          } else if (mediaOn && sourceType === 'video') {
            // 视频自愈保障：元素丢失或处于暂停态时轻量补挂，不触发场景/网页重建
            const vidEl = document.getElementById('agy-dynamic-video');
            if (!vidEl || vidEl.paused || vidEl.style.opacity !== '1') {
              if (typeof wallpaperHandle.setVideoEnabled === 'function') {
                wallpaperHandle.setVideoEnabled(true, videoUrl);
              }
            }
          }
        }
      } catch (err) {
        console.warn('[Antigravity Skin] Failed to init/update wallpaper:', err);
      }
    } else {
      lastWallpaperState = { isCustomTheme: false, isVideoOn: false, videoPath: '', brightness: 0, contrast: 0, mediaKey: '' };
      if (wallpaperHandle) {
        try { wallpaperHandle.destroy(); } catch(e) {}
        wallpaperHandle = null;
        window.__agyWallpaperInstance = null;
      }
      try {
        const oldVid = document.getElementById('agy-dynamic-video');
        if (oldVid) {
          try { oldVid.pause(); } catch(e) {}
          oldVid.remove();
        }
        const oldFrame = document.getElementById('agy-dynamic-iframe');
        if (oldFrame) { try { oldFrame.setAttribute('src', 'about:blank'); } catch(e) {} oldFrame.remove(); }
        const oldScene = document.getElementById('agy-dynamic-scene');
        if (oldScene) oldScene.remove();
        const oldAudio = document.getElementById('agy-dynamic-audio');
        if (oldAudio) { try { oldAudio.pause(); } catch(e) {} oldAudio.remove(); }
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

        if (typeof window.__agySyncTitleBar === 'function') {
          try { window.__agySyncTitleBar(true); } catch(e) {}
        } else if (window.electronNative && typeof window.electronNative.setTitleBarOverlay === 'function') {
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

  function saveConfigRemote(newCfg) {
    currentConfig = newCfg;
    window.__AG_SKIN_CONFIG__ = newCfg;
    try {
      applyFeatures(newCfg);
    } catch (e) {
      console.warn('[Antigravity Skin] Error applying features on saveConfigRemote:', e);
    }
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
    // 1. 若主进程已接管开机引导（Windows 补丁），绝不二次触发
    if (window.__agyMasterBootHandled) return true;
    if (sessionStorage.getItem('__agy_booted__')) return true;
    if (!activeCfg.features?.bootAnimation) return true;
    if (window.__agyBootPlaying) return true;
    if (document.getElementById('agy-video-boot-host') || document.getElementById('agy-custom-code-boot-host')) return true;

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
    window.__agyApplyFeatures = applyFeatures;
    try {
      applyFeatures(window.__AG_SKIN_CONFIG__ || currentConfig);
    } catch (e) {}

    if (typeof window.__agySyncTitleBar === 'function') {
      window.__agySyncTitleBar(true);
    }

    if (typeof window.__agyInitAppearanceMenu === 'function') {
      menuHandle = window.__agyInitAppearanceMenu(
        () => (window.__AG_SKIN_CONFIG__ || currentConfig),
        saveConfigRemote,
        (updatedConfig) => {
          applyFeatures(updatedConfig);
        }
      );
    }
    // 关键自愈：如果素材或样式在 DOM 中遗失（例如更新后重载或 SPA 导航），立即补挂（开机动效播放时除外）
    const needStyle = currentConfig.features?.themeStyles !== false;
    const dwCfg = currentConfig.features?.dynamicWallpaper || {};
    const dwSource = dwCfg.sourceType || (dwCfg.wallpaperDir ? 'scene' : 'video');
    const dwHasSource = dwSource === 'video' ? !!dwCfg.videoPath : !!dwCfg.wallpaperDir;
    const needWallpaper = needStyle && dwCfg.enabled === true && dwHasSource;
    const isBootPlaying = !!window.__agyBootPlaying ||
                          !!document.getElementById('agy-video-boot-host') ||
                          !!document.getElementById('agy-custom-code-boot-host') ||
                          !!document.getElementById('agy-scene-boot-host');
    const hasVideo = !!document.getElementById('agy-dynamic-video') ||
                     !!document.getElementById('agy-dynamic-iframe') ||
                     !!document.getElementById('agy-dynamic-scene');
    const hasStyle = !!document.getElementById('agy-dynamic-wallpaper-style');
    if (!isBootPlaying) {
      if (!needWallpaper && hasVideo) {
        ['agy-dynamic-video', 'agy-dynamic-iframe', 'agy-dynamic-scene', 'agy-dynamic-audio'].forEach(id => {
          const el = document.getElementById(id);
          if (el) {
            try { if (el.pause) el.pause(); } catch(e) {}
            el.remove();
          }
        });
      }
      if ((needWallpaper && !hasVideo) || (needStyle && !hasStyle)) {
        console.log('[Antigravity Skin] Missing video or style in DOM, re-applying features immediately...');
        applyFeatures(currentConfig);
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
