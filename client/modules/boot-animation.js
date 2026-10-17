/**
 * boot-animation.js - Modular & Extensible Boot Animation Framework
 * 
 * Supports:
 *  1. Custom Video Boot (MP4 / WebM with seamless titlebar & wallpaper sync)
 *  2. Custom Code Boot (JS / Canvas / DOM script rendering with container injection)
 */

(() => {
  if (typeof window === 'undefined') return;
  window.__antigravityBootInstalled = true;

  // 极速冷启动优先级保障：若配置开启开机动画且本会话未播放过，第 0 毫秒置位全局播放标志（带超时与就绪熔断）
  try {
    const _earlyCfg = (window.__agySkinBridge && window.__agySkinBridge.getConfig()) || window.__AG_SKIN_CONFIG__ || {};
    if (_earlyCfg.features?.bootAnimation && !sessionStorage.getItem('__agy_booted__')) {
      const _nav = (typeof performance !== 'undefined' && typeof performance.getEntriesByType === 'function')
        ? performance.getEntriesByType('navigation')[0]
        : null;
      const _perfNow = (typeof performance !== 'undefined' && typeof performance.now === 'function')
        ? performance.now()
        : 9999;
      const _hasWorkbench = !!(
        document.querySelector('.relative.w-screen') ||
        document.querySelector('.bg-background') ||
        document.querySelector('.monaco-workbench') ||
        document.querySelector('[data-conversation-id]') ||
        document.querySelector('main') ||
        (document.body && document.body.children.length >= 3)
      );
      const _shouldAbort = (document.readyState === 'complete' && _hasWorkbench) ||
                           (_nav && _nav.loadEventEnd > 0 && _perfNow > 280) ||
                           (_perfNow > 380);
      if (!_shouldAbort) {
        window.__agyBootPlaying = true;
      } else {
        sessionStorage.setItem('__agy_booted__', 'true');
        window.__agyBootPlaying = false;
      }
    }
  } catch (e) {}

  function pauseWallpaperVideo() {
    const v = document.getElementById('agy-dynamic-video');
    if (v) {
      try {
        v.dataset.bootPaused = '1';
        v.style.transition = 'opacity 0.2s ease';
        v.style.opacity = '0';
        v.pause();
      } catch(e) {}
    }
  }

  function resumeWallpaperVideo() {
    const v = document.getElementById('agy-dynamic-video');
    if (v && v.dataset.bootPaused === '1') {
      delete v.dataset.bootPaused;
      try {
        v.style.transition = 'opacity 0.6s ease';
        v.style.opacity = '1';
        v.play().catch(() => {});
      } catch(e) {}
    }
  }

  let bootTitleBarTimer = null;

  function setBootTitleBarOverlay() {
    if (typeof window !== 'undefined' && window.electronNative && typeof window.electronNative.setTitleBarOverlay === 'function') {
      window.electronNative.setTitleBarOverlay({
        color: 'rgba(0, 0, 0, 0)',
        symbolColor: '#f8fafc',
        height: 35
      }).catch(() => {});
    }
  }

  function startBootTitleBarLock() {
    stopBootTitleBarLock();
    setBootTitleBarOverlay();
    // 关键：以 80ms 高频持续锁定，彻底压制宿主在开机动画期间加载完成引发的实色覆盖！
    bootTitleBarTimer = setInterval(() => {
      const isPlaying = !!window.__agyBootPlaying ||
                        !!document.getElementById('agy-video-boot-host') ||
                        !!document.getElementById('agy-custom-code-boot-host');
      if (!isPlaying) {
        stopBootTitleBarLock();
        return;
      }
      setBootTitleBarOverlay();
    }, 80);
  }

  function stopBootTitleBarLock() {
    if (bootTitleBarTimer) {
      clearInterval(bootTitleBarTimer);
      bootTitleBarTimer = null;
    }
  }

  function restoreTitleBarOverlay() {
    stopBootTitleBarLock();
    if (typeof window !== 'undefined' && typeof window.__agySyncTitleBar === 'function') {
      window.__agySyncTitleBar(true);
    }
  }

  function startVideoBoot(videoSrc) {
    if (document.getElementById('agy-video-boot-host')) return;
    window.__agyBootPlaying = true;
    pauseWallpaperVideo();
    startBootTitleBarLock();

    const host = document.createElement('div');
    host.id = 'agy-video-boot-host';
    host.style.cssText = 'position:fixed;inset:0;z-index:2147483647;width:100vw;height:100vh;background:#000;display:flex;align-items:center;justify-content:center;overflow:hidden;transition:opacity 400ms ease;';

    const hint = document.createElement('div');
    hint.id = 'agy-video-boot-hint';
    hint.style.cssText = 'position:absolute;bottom:24px;right:32px;padding:6px 14px;border-radius:6px;background:rgba(0,0,0,0.65);border:1px solid rgba(255,255,255,0.2);color:rgba(255,255,255,0.75);font-size:12px;font-family:monospace;pointer-events:none;z-index:99999;';
    hint.innerHTML = '按下 <kbd style="padding:2px 6px;background:rgba(255,255,255,0.2);border-radius:4px;color:#fff;">ESC</kbd> 或点击跳过';

    host.appendChild(hint);
    (document.body || document.documentElement).appendChild(host);

    let cleaned = false;
    let video = null;
    function closeVideoBoot() {
      if (cleaned) return;
      cleaned = true;
      window.__agyBootPlaying = false;
      restoreTitleBarOverlay();
      if (typeof window.__agyResumeBootWallpaper === 'function') {
        try { window.__agyResumeBootWallpaper(); } catch(e) {}
      }
      host.style.opacity = '0';
      setTimeout(() => {
        if (video) {
          try { video.pause(); } catch(e) {}
        }
        host.remove();
        resumeWallpaperVideo();
        restoreTitleBarOverlay();
      }, 400);
      window.removeEventListener('keydown', onKeyDown, true);
    }

    function onKeyDown(e) {
      if (e.key === 'Escape' || e.code === 'Escape' || e.key === ' ' || e.key === 'Enter') {
        closeVideoBoot();
      }
    }

    const animStartTime = Date.now();
    window.addEventListener('keydown', onKeyDown, true);
    host.addEventListener('click', () => {
      if (Date.now() - animStartTime < 800) return;
      closeVideoBoot();
    });

    if (!videoSrc) {
      const emptyBox = document.createElement('div');
      emptyBox.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);padding:28px 36px;background:rgba(15,23,42,0.95);border:1px solid rgba(56,189,248,0.3);border-radius:12px;color:#f8fafc;font-family:sans-serif;text-align:center;box-shadow:0 20px 50px rgba(0,0,0,0.8);z-index:99999;';
      emptyBox.innerHTML = `
        <div style="font-size:28px;margin-bottom:12px;">🎬</div>
        <div style="font-size:16px;font-weight:600;color:#38bdf8;margin-bottom:8px;">开机短视频：未载入视频素材</div>
        <div style="font-size:13px;opacity:0.8;line-height:1.6;max-width:380px;">请在「外观设置 -> 开机引导动画」中点击“📂 载入新开机视频”，导入您的专属视频素材。</div>
        <div style="font-size:12px;opacity:0.5;margin-top:16px;">按 ESC 或点击任意位置跳过 (3秒后自动进入)</div>
      `;
      host.appendChild(emptyBox);
      setTimeout(() => {
        closeVideoBoot();
      }, 3000);
      return;
    }

    video = document.createElement('video');
    video.style.cssText = 'width:100%;height:100%;object-fit:cover;pointer-events:none;';
    video.autoplay = true;
    video.muted = true;
    video.playsInline = true;
    video.src = videoSrc;
    host.prepend(video);

    video.addEventListener('ended', closeVideoBoot);
    video.play().catch(err => {
      console.warn('[Boot Video] Playback failed or blocked, closing:', err);
      closeVideoBoot();
    });
  }

  async function startCustomCodeBoot(scriptPath) {
    if (document.getElementById('agy-custom-code-boot-host')) return;
    window.__agyBootPlaying = true;
    pauseWallpaperVideo();
    startBootTitleBarLock();

    const host = document.createElement('div');
    host.id = 'agy-custom-code-boot-host';
    host.style.cssText = 'position:fixed;inset:0;z-index:2147483647;width:100vw;height:100vh;background:#000;overflow:hidden;transition:opacity 400ms ease;';

    const hint = document.createElement('div');
    hint.id = 'agy-custom-boot-hint';
    hint.style.cssText = 'position:absolute;bottom:24px;right:32px;padding:6px 14px;border-radius:6px;background:rgba(0,0,0,0.65);border:1px solid rgba(255,255,255,0.2);color:rgba(255,255,255,0.75);font-size:12px;font-family:monospace;pointer-events:none;z-index:99999;';
    hint.innerHTML = '按下 <kbd style="padding:2px 6px;background:rgba(255,255,255,0.2);border-radius:4px;color:#fff;">ESC</kbd> 或点击跳过';

    host.appendChild(hint);
    (document.body || document.documentElement).appendChild(host);

    let cleaned = false;
    let customCleanup = null;

    function closeCustomBoot() {
      if (cleaned) return;
      cleaned = true;
      window.__agyBootPlaying = false;
      if (typeof customCleanup === 'function') {
        try { customCleanup(); } catch(e) {}
      }
      restoreTitleBarOverlay();
      if (typeof window.__agyResumeBootWallpaper === 'function') {
        try { window.__agyResumeBootWallpaper(); } catch(e) {}
      }
      host.style.opacity = '0';
      setTimeout(() => {
        host.remove();
        resumeWallpaperVideo();
        restoreTitleBarOverlay();
      }, 400);
      window.removeEventListener('keydown', onKeyDown, true);
    }

    function onKeyDown(e) {
      if (e.key === 'Escape' || e.code === 'Escape') {
        closeCustomBoot();
      }
    }

    window.addEventListener('keydown', onKeyDown, true);
    host.addEventListener('click', (e) => {
      if (e.target === host || e.target === hint) {
        closeCustomBoot();
      }
    });

    if (!scriptPath) {
      const emptyBox = document.createElement('div');
      emptyBox.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);padding:28px 36px;background:rgba(15,23,42,0.95);border:1px solid rgba(56,189,248,0.3);border-radius:12px;color:#f8fafc;font-family:sans-serif;text-align:center;box-shadow:0 20px 50px rgba(0,0,0,0.8);z-index:99999;';
      emptyBox.innerHTML = `
        <div style="font-size:28px;margin-bottom:12px;">🎨</div>
        <div style="font-size:16px;font-weight:600;color:#38bdf8;margin-bottom:8px;">开机引导动效：未配置脚本</div>
        <div style="font-size:13px;opacity:0.8;line-height:1.6;max-width:380px;">请在「外观设置 -> 开机引导动画」中配置本地 JS 脚本路径，自定义您的专属开屏效果。</div>
        <div style="font-size:12px;opacity:0.5;margin-top:16px;">按 ESC 或点击任意位置跳过 (3秒后自动进入)</div>
      `;
      host.appendChild(emptyBox);
      setTimeout(() => {
        closeCustomBoot();
      }, 3000);
      return;
    }

    try {
      const API_BASE = `http://127.0.0.1:${window.__AG_SKIN_PORT__ || 59288}`;
      const url = (scriptPath && (scriptPath.startsWith('http://') || scriptPath.startsWith('https://')))
        ? scriptPath
        : `${API_BASE}/api/script?path=${encodeURIComponent(scriptPath)}&t=${Date.now()}`;

      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`无法读取动效脚本 (${res.status}): ${await res.text()}`);
      }
      const code = await res.text();

      const execFn = new Function('container', 'close', 'exports', code);
      const exportsObj = {};
      const ret = execFn(host, closeCustomBoot, exportsObj);
      if (typeof ret === 'function') {
        customCleanup = ret;
      } else if (exportsObj.cleanup && typeof exportsObj.cleanup === 'function') {
        customCleanup = exportsObj.cleanup;
      } else if (window.__customBootAnimation && typeof window.__customBootAnimation === 'function') {
        const cleanupFn = window.__customBootAnimation(host, closeCustomBoot);
        if (typeof cleanupFn === 'function') customCleanup = cleanupFn;
      }
    } catch (err) {
      console.error('[Boot Animation] Custom code execution error:', err);
      const errBox = document.createElement('div');
      errBox.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);padding:24px 32px;background:rgba(20,10,10,0.92);border:1px solid #ef4444;border-radius:12px;color:#fca5a5;font-family:monospace;max-width:80vw;box-shadow:0 20px 40px rgba(0,0,0,0.85);z-index:999999;';
      errBox.innerHTML = `
        <div style="font-size:16px;font-weight:bold;margin-bottom:12px;color:#f87171;display:flex;align-items:center;gap:8px;">❌ 自定义动效代码加载或执行失败</div>
        <div style="font-size:12px;opacity:0.9;white-space:pre-wrap;word-break:break-all;">${err.message}</div>
        <div style="font-size:11px;opacity:0.6;margin-top:16px;">按 ESC 或点击任意处退出</div>
      `;
      host.appendChild(errBox);
      host.onclick = closeCustomBoot;
    }
  }

  window.__triggerVideoBoot = startVideoBoot;
  window.__triggerCustomCodeBoot = startCustomCodeBoot;
  window.__agyStartBootTitleBarLock = startBootTitleBarLock;
  window.__agyStopBootTitleBarLock = stopBootTitleBarLock;

  window.__triggerBootAnimation = function(customType, customPath, customCodePath) {
    window.__agyBootPlaying = true;
    const config = (window.__agySkinBridge && window.__agySkinBridge.getConfig()) || window.__AG_SKIN_CONFIG__ || {};
    const bootCfg = config.features?.bootAnimationConfig || {};
    const type = customType || bootCfg.type || 'video';
    const videoPath = customPath !== undefined ? customPath : (bootCfg.videoPath || '');
    const codePath = (customCodePath !== undefined && customCodePath !== '') ? customCodePath : (bootCfg.customCodePath || 'assets/scripts/default-boot.js');

    if (type === 'video') {
      const API_BASE = `http://127.0.0.1:${window.__AG_SKIN_PORT__ || 59288}`;
      let src = '';
      if (videoPath && (videoPath.startsWith('http://') || videoPath.startsWith('https://'))) {
        src = videoPath;
      } else if (videoPath) {
        src = `${API_BASE}/api/video?path=${encodeURIComponent(videoPath)}&t=${Date.now()}`;
      }
      startVideoBoot(src);
    } else {
      // type is 'code'
      startCustomCodeBoot(codePath);
    }
  };

})();
