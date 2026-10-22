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

  // 极速冷启动优先级保障：若配置开启开机动画且本会话未播放过，第 0 毫秒置位全局播放标志
  try {
    const _earlyCfg = (window.__agySkinBridge && window.__agySkinBridge.getConfig()) || window.__AG_SKIN_CONFIG__ || {};
    if (_earlyCfg.features?.bootAnimation && !sessionStorage.getItem('__agy_booted__')) {
      const activeEl = document.activeElement;
      // 关键修复：页面初始自动获得焦点（如聊天输入框）不等于用户正在输入！必须有非空输入内容才判定为正在打字
      const _hasTypedText = activeEl && (
        (activeEl.tagName === 'TEXTAREA' && activeEl.value && activeEl.value.trim().length > 0) ||
        (activeEl.tagName === 'INPUT' && activeEl.value && activeEl.value.trim().length > 0) ||
        ((activeEl.isContentEditable || activeEl.getAttribute?.('contenteditable') === 'true') && activeEl.textContent && activeEl.textContent.trim().length > 0)
      );
      if (!_hasTypedText) {
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
    // 网页 / 场景壁纸在开屏期间优雅挂起（平滑设置 opacity，绝不突变隐藏）
    const frame = document.getElementById('agy-dynamic-iframe');
    if (frame) {
      try {
        frame.dataset.bootPaused = '1';
        frame.style.transition = 'opacity 0.2s ease';
        frame.style.opacity = '0';
        frame.contentWindow?.postMessage({ type: 'agy-wallpaper-pause' }, '*');
      } catch(e) {}
    }
    const scene = document.getElementById('agy-dynamic-scene');
    if (scene) {
      try {
        scene.dataset.bootPaused = '1';
        scene.style.transition = 'opacity 0.2s ease';
        scene.style.opacity = '0';
        if (window.__agySceneRenderer && typeof window.__agySceneRenderer.pause === 'function') {
          window.__agySceneRenderer.pause();
        }
      } catch(e) {}
    }
    const audio = document.getElementById('agy-dynamic-audio');
    if (audio) {
      try { audio.pause(); } catch(e) {}
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
    const frame = document.getElementById('agy-dynamic-iframe');
    if (frame && frame.dataset.bootPaused === '1') {
      delete frame.dataset.bootPaused;
      try {
        frame.style.visibility = 'visible';
        frame.style.transition = 'opacity 0.6s ease';
        frame.style.opacity = '1';
        frame.contentWindow?.postMessage({ type: 'agy-wallpaper-resume' }, '*');
      } catch(e) {}
    }
    const scene = document.getElementById('agy-dynamic-scene');
    if (scene && scene.dataset.bootPaused === '1') {
      delete scene.dataset.bootPaused;
      try {
        scene.style.visibility = 'visible';
        scene.style.transition = 'opacity 0.6s ease';
        scene.style.opacity = '1';
        if (window.__agySceneRenderer && typeof window.__agySceneRenderer.resume === 'function') {
          window.__agySceneRenderer.resume();
        }
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

  function mountHost(el) {
    if (!el || el.parentElement) return;
    const target = document.body || document.documentElement;
    if (target) {
      target.appendChild(el);
      return;
    }
    // 关键容错：若处于 document_start 等极早期生命周期，安全等待 DOM 根节点就绪
    const observer = new MutationObserver(() => {
      const t = document.body || document.documentElement;
      if (t && !el.parentElement) {
        observer.disconnect();
        t.appendChild(el);
      }
    });
    try {
      observer.observe(document, { childList: true, subtree: true });
    } catch (_) {}
    document.addEventListener('DOMContentLoaded', () => {
      try { observer.disconnect(); } catch (_) {}
      const t = document.body || document.documentElement;
      if (t && !el.parentElement) {
        t.appendChild(el);
      }
    }, { once: true });
  }

  function getBootConfig() {
    try {
      const cfg = (window.__agySkinBridge && window.__agySkinBridge.getConfig()) || window.__AG_SKIN_CONFIG__ || {};
      return cfg.features?.bootAnimationConfig || {};
    } catch (_) {
      return {};
    }
  }

  function setupBootDismissScheduler(host, hintEl, dismissFn) {
    const bootCfg = getBootConfig();
    const delaySec = Number.isFinite(bootCfg.autoEnterDelay)
      ? Math.max(0, Math.min(10, Math.round(bootCfg.autoEnterDelay)))
      : 3;

    if (delaySec === 0) {
      if (hintEl) {
        hintEl.innerHTML = '按下 <kbd style="padding:2px 6px;background:rgba(255,255,255,0.2);border-radius:4px;color:#fff;">任意键</kbd> 或点击画面进入工作区';
        hintEl.style.transition = 'opacity 1s ease';
        setTimeout(() => {
          try { hintEl.style.opacity = '0.35'; } catch (_) {}
        }, 5000);
        host.addEventListener('mousemove', () => {
          try { hintEl.style.opacity = '0.85'; } catch (_) {}
        });
      }
      return null;
    } else {
      if (hintEl) {
        hintEl.innerHTML = '按下 <kbd style="padding:2px 6px;background:rgba(255,255,255,0.2);border-radius:4px;color:#fff;">ESC</kbd> 或点击跳过';
      }
      return setTimeout(dismissFn, Math.max(500, delaySec * 1000));
    }
  }

  function startVideoBoot(videoSrc) {
    let host = document.getElementById('agy-video-boot-host');
    if (host && host.querySelector('video')) return;

    window.__agyBootPlaying = true;
    pauseWallpaperVideo();
    startBootTitleBarLock();

    const bootCfg = getBootConfig();
    const delaySec = Number.isFinite(bootCfg.autoEnterDelay) ? Math.max(0, Math.min(10, Math.round(bootCfg.autoEnterDelay))) : 3;

    if (!host) {
      host = document.createElement('div');
      host.id = 'agy-video-boot-host';
      host.style.cssText = 'position:fixed;inset:0;z-index:2147483647;width:100vw;height:100vh;background:#000;display:flex;align-items:center;justify-content:center;overflow:hidden;transition:opacity 400ms ease;';
      mountHost(host);
    } else {
      mountHost(host);
    }

    sessionStorage.setItem('__agy_booted__', 'true');

    let hint = document.getElementById('agy-video-boot-hint');
    if (!hint) {
      hint = document.createElement('div');
      hint.id = 'agy-video-boot-hint';
      hint.style.cssText = 'position:absolute;bottom:24px;right:32px;padding:6px 14px;border-radius:6px;background:rgba(0,0,0,0.65);border:1px solid rgba(255,255,255,0.2);color:rgba(255,255,255,0.75);font-size:12px;font-family:monospace;pointer-events:none;z-index:99999;';
      host.appendChild(hint);
    }

    let cleaned = false;
    let video = null;
    let autoTimer = null;

    function closeVideoBoot() {
      if (cleaned) return;
      cleaned = true;
      if (autoTimer) {
        clearTimeout(autoTimer);
        autoTimer = null;
      }
      window.__agyBootPlaying = false;
      restoreTitleBarOverlay();
      window.removeEventListener('keydown', onKeyDown, true);

      // 1. 在开屏遮罩开始淡出的第一时间（T=0）立即平滑唤醒底层壁纸（形成 400ms~600ms 交叉渐变 Cross-fade）
      if (typeof window.__agyResumeBootWallpaper === 'function') {
        try { window.__agyResumeBootWallpaper(); } catch(e) {}
      } else {
        resumeWallpaperVideo();
      }

      // 2. 停止并释放 boot video 硬件解码管道
      if (video) {
        try {
          video.pause();
          video.src = '';
          video.load();
        } catch(e) {}
      }
      host.style.opacity = '0';

      // 3. 待 host 完全淡出后平滑移除节点
      setTimeout(() => {
        try { host.remove(); } catch(e) {}
        restoreTitleBarOverlay();
      }, 400);
    }

    function onKeyDown(e) {
      if (delaySec === 0) {
        closeVideoBoot();
      } else if (e.key === 'Escape' || e.code === 'Escape' || e.key === ' ' || e.key === 'Enter') {
        closeVideoBoot();
      }
    }

    const animStartTime = Date.now();
    window.addEventListener('keydown', onKeyDown, true);
    host.addEventListener('click', () => {
      if (Date.now() - animStartTime < 500) return;
      closeVideoBoot();
    });

    if (!videoSrc) {
      const emptyBox = document.createElement('div');
      emptyBox.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);padding:28px 36px;background:rgba(15,23,42,0.95);border:1px solid rgba(56,189,248,0.3);border-radius:12px;color:#f8fafc;font-family:sans-serif;text-align:center;box-shadow:0 20px 50px rgba(0,0,0,0.8);z-index:99999;';
      emptyBox.innerHTML = `
        <div style="font-size:28px;margin-bottom:12px;">🎬</div>
        <div style="font-size:16px;font-weight:600;color:#38bdf8;margin-bottom:8px;">开机短视频：未载入视频素材</div>
        <div style="font-size:13px;opacity:0.8;line-height:1.6;max-width:380px;">请在「外观设置 -> 开机引导动画」中点击“📂 载入新开机视频”，导入您的专属视频素材。</div>
        <div style="font-size:12px;opacity:0.5;margin-top:16px;">${delaySec === 0 ? '按任意键或点击退出' : `按 ESC 或点击任意位置跳过 (${delaySec}秒后自动进入)`}</div>
      `;
      host.appendChild(emptyBox);
      autoTimer = setupBootDismissScheduler(host, hint, closeVideoBoot);
      return;
    }

    const b = Number.isFinite(bootCfg.brightness) ? bootCfg.brightness : 1.0;
    const c = Number.isFinite(bootCfg.contrast) ? bootCfg.contrast : 1.0;
    const fit = bootCfg.fit || 'cover';
    const pos = bootCfg.fitPosition || 'center';

    video = document.createElement('video');
    video.style.cssText = `width:100%;height:100%;object-fit:${fit};object-position:${pos};filter:brightness(${b}) contrast(${c});pointer-events:none;`;
    video.autoplay = true;
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.loop = (delaySec === 0); // 0秒手动驻留时支持循环
    video.setAttribute('muted', '');
    video.setAttribute('autoplay', '');
    video.setAttribute('playsinline', '');
    video.setAttribute('preload', 'auto');
    video.src = videoSrc;
    host.prepend(video);

    autoTimer = setupBootDismissScheduler(host, hint, closeVideoBoot);

    video.addEventListener('ended', () => {
      if (delaySec > 0 && (video.currentTime > 0.3 || (video.duration && video.currentTime >= video.duration - 0.5))) {
        closeVideoBoot();
      }
    });

    // 零闪烁交叉淡入：结束前 450ms 提前在底层挂载主界面壁纸
    let preloadedWallpaper = false;
    video.addEventListener('timeupdate', () => {
      if (preloadedWallpaper || cleaned || !video.duration || !isFinite(video.duration)) return;
      if (delaySec > 0 && video.duration - video.currentTime <= 0.45) {
        preloadedWallpaper = true;
        if (typeof window.__agyResumeBootWallpaper === 'function') {
          try { window.__agyResumeBootWallpaper(); } catch (_) {}
        }
      }
    });
    video.addEventListener('error', (e) => {
      console.warn('[Boot Video] Video element error:', e, video.error);
      setTimeout(closeVideoBoot, 1500);
    });
    video.play().catch(err => {
      console.warn('[Boot Video] Playback failed or blocked, retrying muted:', err);
      video.muted = true;
      video.setAttribute('muted', '');
      video.play().catch(() => {
        setTimeout(closeVideoBoot, 1500);
      });
    });
  }

  /**
   * 场景封面开屏动效：以外部 Wallpaper 场景壁纸的高清封面做 Ken Burns 微视差，
   * 依据 autoEnterDelay 配置平滑淡入主界面或纯手动驻留，兼顾高画质与极低资源占用。
   */
  function startSceneBoot(imageSrc, options = {}) {
    if (document.getElementById('agy-scene-boot-host')) return;
    window.__agyBootPlaying = true;
    pauseWallpaperVideo();
    startBootTitleBarLock();

    const bootCfg = getBootConfig();
    const delaySec = Number.isFinite(bootCfg.autoEnterDelay) ? Math.max(0, Math.min(10, Math.round(bootCfg.autoEnterDelay))) : 3;

    const host = document.createElement('div');
    host.id = 'agy-scene-boot-host';
    host.style.cssText = 'position:fixed;inset:0;z-index:2147483647;width:100vw;height:100vh;background:#000;overflow:hidden;transition:opacity 420ms ease;';

    const hint = document.createElement('div');
    hint.id = 'agy-scene-boot-hint';
    hint.style.cssText = 'position:absolute;bottom:24px;right:32px;padding:6px 14px;border-radius:6px;background:rgba(0,0,0,0.65);border:1px solid rgba(255,255,255,0.2);color:rgba(255,255,255,0.75);font-size:12px;font-family:monospace;pointer-events:none;z-index:99999;';

    const b = Number.isFinite(bootCfg.brightness) ? bootCfg.brightness : 1.0;
    const c = Number.isFinite(bootCfg.contrast) ? bootCfg.contrast : 1.0;
    const fit = bootCfg.fit || 'cover';
    const pos = bootCfg.fitPosition || 'center';

    const img = document.createElement('img');
    img.alt = options.title || '';
    img.style.cssText = `position:absolute;inset:-2%;width:104%;height:104%;object-fit:${fit};object-position:${pos};filter:brightness(${b}) contrast(${c});display:block;opacity:0;transition:opacity 700ms ease;animation:agyBootKenBurns 8s ease-out forwards;will-change:transform;`;
    if (imageSrc) img.src = imageSrc;
    // 真实画面加载失败时回落缩略图，保证开屏至少有画面
    const fallbackSrc = options.fallbackSrc || '';
    img.addEventListener('load', () => { img.style.opacity = '1'; }, { once: true });
    img.addEventListener('error', () => {
      img.style.opacity = '1';
      if (fallbackSrc && img.src !== fallbackSrc) img.src = fallbackSrc;
    });

    const style = document.createElement('style');
    style.textContent = '@keyframes agyBootKenBurns { from { transform: scale(1.02) translate3d(0,0,0); } to { transform: scale(1.09) translate3d(-0.8%,-1%,0); } }';
    host.appendChild(style);
    host.appendChild(img);
    host.appendChild(hint);
    mountHost(host);
    sessionStorage.setItem('__agy_booted__', 'true');

    let cleaned = false;
    let closeTimer = null;
    function closeSceneBoot() {
      if (cleaned) return;
      cleaned = true;
      if (closeTimer) {
        clearTimeout(closeTimer);
        closeTimer = null;
      }
      window.__agyBootPlaying = false;
      restoreTitleBarOverlay();
      window.removeEventListener('keydown', onKeyDown, true);
      // 在开屏遮罩淡出的一瞬间（T=0）平滑唤醒底层壁纸
      if (typeof window.__agyResumeBootWallpaper === 'function') {
        try { window.__agyResumeBootWallpaper(); } catch (e) {}
      } else {
        resumeWallpaperVideo();
      }

      host.style.opacity = '0';
      setTimeout(() => {
        try { host.remove(); } catch (e) {}
        restoreTitleBarOverlay();
      }, 400);
    }

    function onKeyDown(e) {
      if (delaySec === 0) {
        closeSceneBoot();
      } else if (e.key === 'Escape' || e.code === 'Escape' || e.key === ' ' || e.key === 'Enter') {
        closeSceneBoot();
      }
    }

    const startedAt = Date.now();
    window.addEventListener('keydown', onKeyDown, true);
    host.addEventListener('click', () => {
      if (Date.now() - startedAt < 500) return;
      closeSceneBoot();
    });

    closeTimer = setupBootDismissScheduler(host, hint, closeSceneBoot);
  }

  async function startCustomCodeBoot(scriptPath) {
    if (document.getElementById('agy-custom-code-boot-host')) return;
    window.__agyBootPlaying = true;
    pauseWallpaperVideo();
    startBootTitleBarLock();

    const bootCfg = getBootConfig();
    const delaySec = Number.isFinite(bootCfg.autoEnterDelay) ? Math.max(0, Math.min(10, Math.round(bootCfg.autoEnterDelay))) : 3;

    const host = document.createElement('div');
    host.id = 'agy-custom-code-boot-host';
    host.style.cssText = 'position:fixed;inset:0;z-index:2147483647;width:100vw;height:100vh;background:#000;overflow:hidden;transition:opacity 400ms ease;';

    const hint = document.createElement('div');
    hint.id = 'agy-custom-boot-hint';
    hint.style.cssText = 'position:absolute;bottom:24px;right:32px;padding:6px 14px;border-radius:6px;background:rgba(0,0,0,0.65);border:1px solid rgba(255,255,255,0.2);color:rgba(255,255,255,0.75);font-size:12px;font-family:monospace;pointer-events:none;z-index:99999;';

    host.appendChild(hint);
    mountHost(host);
    sessionStorage.setItem('__agy_booted__', 'true');

    let cleaned = false;
    let customCleanup = null;
    let autoTimer = null;

    function closeCustomBoot() {
      if (cleaned) return;
      cleaned = true;
      if (autoTimer) {
        clearTimeout(autoTimer);
        autoTimer = null;
      }
      window.__agyBootPlaying = false;
      if (typeof customCleanup === 'function') {
        try { customCleanup(); } catch(e) {}
      }
      restoreTitleBarOverlay();
      window.removeEventListener('keydown', onKeyDown, true);
      // 在开屏遮罩淡出的一瞬间（T=0）平滑唤醒底层壁纸
      if (typeof window.__agyResumeBootWallpaper === 'function') {
        try { window.__agyResumeBootWallpaper(); } catch(e) {}
      } else {
        resumeWallpaperVideo();
      }

      host.style.opacity = '0';
      setTimeout(() => {
        try { host.remove(); } catch(e) {}
        restoreTitleBarOverlay();
      }, 400);
    }

    function onKeyDown(e) {
      if (delaySec === 0) {
        closeCustomBoot();
      } else if (e.key === 'Escape' || e.code === 'Escape') {
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
        <div style="font-size:12px;opacity:0.5;margin-top:16px;">${delaySec === 0 ? '按任意键或点击退出' : `按 ESC 或点击任意位置跳过 (${delaySec}秒后自动进入)`}</div>
      `;
      host.appendChild(emptyBox);
      autoTimer = setupBootDismissScheduler(host, hint, closeCustomBoot);
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
    const API_BASE = `http://127.0.0.1:${window.__AG_SKIN_PORT__ || 59288}`;

    if (type === 'video') {
      let src = '';
      if (videoPath && (videoPath.startsWith('http://') || videoPath.startsWith('https://'))) {
        src = videoPath;
      } else if (videoPath) {
        src = `${API_BASE}/boot-video.mp4?path=${encodeURIComponent(videoPath)}`;
      }
      startVideoBoot(src);
      return;
    }

    if (type === 'scene') {
      // 外部场景壁纸：优先用 scene.pkg 解包出的原生分辨率画面，缩略图仅作兜底
      const dir = bootCfg.wallpaperDir || '';
      const preview = bootCfg.previewFile || 'preview.jpg';
      const src = dir
        ? `${API_BASE}/api/wallpaper-library/scene-poster?folder=${encodeURIComponent(dir)}`
        : '';
      const fallback = dir
        ? `${API_BASE}/api/wallpaper-library/preview?folder=${encodeURIComponent(dir)}&file=${encodeURIComponent(preview)}`
        : '';
      startSceneBoot(src, { title: bootCfg.wallpaperTitle || bootCfg.title || '', fallbackSrc: fallback });
      return;
    }

    // type is 'code'
    startCustomCodeBoot(codePath);
  };

})();
