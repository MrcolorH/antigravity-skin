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

  // 极速冷启动优先级保障：若主进程已接管开机引导或本会话已播放过，彻底杜绝重复播放
  try {
    if (window.__agyMasterBootHandled || sessionStorage.getItem('__agy_booted__')) {
      sessionStorage.setItem('__agy_booted__', 'true');
      window.__agyBootPlaying = false;
    } else {
      const _earlyCfg = (window.__agySkinBridge && window.__agySkinBridge.getConfig()) || window.__AG_SKIN_CONFIG__ || {};
      if (_earlyCfg.features?.bootAnimation) {
        const activeEl = document.activeElement;
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
    }
  } catch (e) {}

  function pauseWallpaperVideo() {
    const v = document.getElementById('agy-dynamic-video');
    if (v) {
      try {
        v.style.visibility = 'visible';
        v.style.opacity = '1';
        v.muted = true;
        v.play().catch(() => {});
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
    // 核心诉求：场景壁纸在开屏准备期间绝对不暂停、不隐藏！在幕后全速预启动与预热，进入首页时已是流畅运行态
    const scene = document.getElementById('agy-dynamic-scene');
    if (scene) {
      try {
        scene.style.visibility = 'visible';
        scene.style.opacity = '1';
        if (window.__agySceneRenderer && typeof window.__agySceneRenderer.resume === 'function') {
          window.__agySceneRenderer.resume();
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

  function cleanMacAntiFlashAndNotify() {
    try {
      const st = document.getElementById('agy-macos-anti-flash');
      if (st) st.remove();
      if (document.documentElement && (document.documentElement.style.background === 'rgb(0, 0, 0)' || document.documentElement.style.background === '#000000')) {
        document.documentElement.style.background = '';
      }
      if (document.body && (document.body.style.background === 'rgb(0, 0, 0)' || document.body.style.background === '#000000')) {
        document.body.style.background = '';
      }
    } catch (_) {}
    if (typeof window !== 'undefined' && window.__AG_SKIN_PORT__) {
      fetch(`http://127.0.0.1:${window.__AG_SKIN_PORT__}/api/boot-finished`, { method: 'POST' }).catch(() => {});
    }
  }
  window.__agyCleanMacAntiFlash = cleanMacAntiFlashAndNotify;

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

  function ensureBootPillStyles() {
    if (document.getElementById('agy-boot-pill-style')) return;
    const st = document.createElement('style');
    st.id = 'agy-boot-pill-style';
    st.textContent = `
      .agy-boot-status-pill {
        position: absolute;
        bottom: 28px;
        right: 32px;
        padding: 8px 18px;
        border-radius: 9999px;
        background: rgba(15, 23, 42, 0.9);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        border: 1px solid rgba(52, 211, 153, 0.45);
        color: rgba(255, 255, 255, 0.88);
        font-size: 13px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
        display: flex;
        align-items: center;
        gap: 10px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
        user-select: none;
        -webkit-user-select: none;
        -webkit-app-region: no-drag;
        transition: all 350ms cubic-bezier(0.16, 1, 0.3, 1);
        z-index: 99999;
        cursor: pointer;
        pointer-events: auto;
      }
      .agy-boot-status-pill:hover {
        background: rgba(30, 41, 59, 0.98);
        border-color: rgba(52, 211, 153, 0.8);
        transform: translateY(-1px);
        box-shadow: 0 10px 36px rgba(16, 185, 129, 0.25);
      }
      .agy-boot-status-pill.status-loading .spinner {
        width: 14px; height: 14px;
        border: 2px solid rgba(56, 189, 248, 0.25);
        border-top-color: #38bdf8;
        border-radius: 50%;
        animation: agy-spin 0.8s linear infinite;
        flex-shrink: 0;
      }
      .agy-boot-status-pill.status-ready {
        border-color: rgba(52, 211, 153, 0.45);
        background: rgba(15, 23, 42, 0.9);
      }
      .agy-boot-status-pill.pill-shake {
        animation: agy-pill-shake 0.4s ease-in-out;
      }
      @keyframes agy-pill-shake {
        0%, 100% { transform: translateX(0); }
        20%, 60% { transform: translateX(-6px); }
        40%, 80% { transform: translateX(6px); }
      }
      @keyframes agy-spin {
        to { transform: rotate(360deg); }
      }
      .agy-boot-status-pill .ready-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #34d399;
        box-shadow: 0 0 10px #34d399, 0 0 4px #10b981;
        animation: agy-ready-pulse 2s infinite ease-in-out;
        flex-shrink: 0;
      }
      .agy-boot-status-pill kbd {
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
      @keyframes agy-ready-pulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.6; transform: scale(0.85); }
      }
    `;
    const targetHost = document.head || document.documentElement || document.body;
    if (targetHost) {
      targetHost.appendChild(st);
    } else {
      document.addEventListener('DOMContentLoaded', () => {
        (document.head || document.documentElement || document.body)?.appendChild(st);
      }, { once: true });
    }
  }

  function createBootStatusPill(id, dismissFn) {
    ensureBootPillStyles();
    let pill = document.getElementById(id);
    if (!pill) {
      pill = document.createElement('div');
      pill.id = id;
      pill.className = 'agy-boot-status-pill';
      if (typeof dismissFn === 'function') {
        pill.addEventListener('click', (e) => {
          e.stopPropagation();
          dismissFn();
        });
      }
    }
    return pill;
  }

  function checkIsSceneWallpaper() {
    try {
      const cfg = (window.__agySkinBridge && window.__agySkinBridge.getConfig()) || window.__AG_SKIN_CONFIG__ || {};
      const dw = cfg.features?.dynamicWallpaper || {};
      if (!dw.enabled) return false;
      return dw.sourceType === 'scene' || (!!dw.wallpaperDir && dw.sourceType !== 'video' && dw.sourceType !== 'web');
    } catch (_) {
      return false;
    }
  }

  function setupBootDismissScheduler(host, hintEl, dismissFn) {
    const bootCfg = getBootConfig();
    const delaySec = Number.isFinite(bootCfg.autoEnterDelay)
      ? Math.max(0, Math.min(10, Math.round(bootCfg.autoEnterDelay)))
      : 3;

    if (delaySec === 0) {
      if (hintEl) {
        hintEl.innerHTML = '<span class="ready-dot"></span><span class="status-text">就绪 · 按 <kbd>ESC</kbd> 或点击画面进入工作区</span>';
        hintEl.style.transition = 'opacity 1s ease';
        setTimeout(() => {
          try { hintEl.style.opacity = '0.45'; } catch (_) {}
        }, 5000);
        host.addEventListener('mousemove', () => {
          try { hintEl.style.opacity = '1'; } catch (_) {}
        });
      }
      return null;
    } else {
      if (hintEl) {
        hintEl.innerHTML = '<span class="ready-dot"></span><span class="status-text">就绪 · 按 <kbd>ESC</kbd> 或点击跳过</span>';
      }
      return setTimeout(dismissFn, Math.max(500, delaySec * 1000));
    }
  }

  function startVideoBoot(videoSrc, isManualPreview = false) {
    if (!isManualPreview) {
      if (window.__agyMasterBootHandled || sessionStorage.getItem('__agy_booted__')) {
        console.log('[Boot Animation] Suppressed duplicate video boot (handled by master).');
        return;
      }
    }
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

    let cleaned = false;
    let video = null;
    let autoTimer = null;
    let isHostReady = false;
    let readyCheckTimer = null;
    let pendingDismiss = false;
    let videoErrorFailed = false;

    // 权威防线：场景壁纸严格要求 WebGL 画布打上 live 标记且首帧稳定运行，或动态明确失败
    function canSafelyDismissBoot() {
      if (videoErrorFailed) return true; // 视频播放失败容灾：绝不让黑屏遮罩死锁视口
      if (!checkIsSceneWallpaper()) {
        return isHostReady;
      }
      const sceneCanvas = document.querySelector('#agy-dynamic-scene canvas.agy-scene-live');
      const isSceneLive = (window.__agySceneFirstFrameReady === true && !!sceneCanvas) || window.__agySceneDynamicFailed === true;
      return isHostReady && isSceneLive;
    }

    function updateLoadingSceneHint() {
      if (!hint || cleaned) return;
      hint.className = 'agy-boot-status-pill status-loading';
      if (hint.dataset.shaking) return;
      const isScene = checkIsSceneWallpaper();
      hint.innerHTML = `<div class="spinner"></div><span class="status-text">${
        isScene ? '🎬 正在装配 4K 场景着色器与动态图层...' : '正在载入主界面与动态壁纸...'
      }</span>`;
    }

    function closeVideoBoot() {
      if (cleaned) return;
      if (!canSafelyDismissBoot()) {
        pendingDismiss = true;
        updateLoadingSceneHint();
        return;
      }
      cleaned = true;
      if (autoTimer) {
        clearTimeout(autoTimer);
        autoTimer = null;
      }
      if (readyCheckTimer) {
        clearInterval(readyCheckTimer);
        readyCheckTimer = null;
      }
      window.__agyBootPlaying = false;
      restoreTitleBarOverlay();
      window.removeEventListener('keydown', onKeyDown, true);

      // 1. 在开屏遮罩开始淡出的第一时间（T=0）立即平滑唤醒底层壁纸（形成 500ms 交叉渐变 Cross-fade）
      if (typeof window.__agyResumeBootWallpaper === 'function') {
        try { window.__agyResumeBootWallpaper(); } catch(e) {}
      } else {
        resumeWallpaperVideo();
      }

      // 2. 电影级丝滑溶出：严禁在淡出前清空视频源（杜绝先缓黑！），以最后一帧画面配合轻柔景深微放缩平滑溶入首页
      host.style.transition = 'opacity 500ms cubic-bezier(0.25, 1, 0.5, 1), transform 500ms cubic-bezier(0.25, 1, 0.5, 1)';
      host.style.opacity = '0';
      host.style.transform = 'scale(1.02) translateZ(0)';

      // 3. 待 host 完全淡出后，后台静默释放硬件解码管道并平滑移除节点
      setTimeout(() => {
        if (video) {
          try {
            video.pause();
            video.removeAttribute('src');
            video.load();
          } catch(e) {}
        }
        try { host.remove(); } catch(e) {}
        restoreTitleBarOverlay();
        cleanMacAntiFlashAndNotify();
      }, 520);
    }

    function shakePill() {
      if (hint && !canSafelyDismissBoot()) {
        hint.classList.remove('pill-shake');
        void hint.offsetWidth;
        hint.classList.add('pill-shake');
        const txt = hint.querySelector('.status-text');
        if (txt && !hint.dataset.shaking) {
          hint.dataset.shaking = '1';
          const oldHtml = txt.innerHTML;
          txt.innerHTML = checkIsSceneWallpaper()
            ? '🎬 正在装配 4K 场景着色器与动态图层...'
            : '正在载入主界面与动态壁纸...';
          setTimeout(() => {
            delete hint.dataset.shaking;
            if (!canSafelyDismissBoot() && txt) txt.innerHTML = oldHtml;
          }, 1500);
        }
      }
    }

    function handleUserSkip(e) {
      if (e) {
        try { e.preventDefault(); e.stopPropagation(); } catch (_) {}
      }
      if (canSafelyDismissBoot()) {
        closeVideoBoot();
      } else {
        pendingDismiss = true;
        shakePill();
      }
    }

    function onDismissScheduleTriggered() {
      if (canSafelyDismissBoot()) {
        closeVideoBoot();
      } else {
        pendingDismiss = true;
        updateLoadingSceneHint();
      }
    }

    function onKeyDown(e) {
      if (delaySec === 0) {
        if (e.key === 'Escape' || e.code === 'Escape') {
          handleUserSkip(e);
        }
      } else if (e.key === 'Escape' || e.code === 'Escape' || e.key === ' ' || e.key === 'Enter') {
        handleUserSkip(e);
      }
    }

    const animStartTime = Date.now();
    window.addEventListener('keydown', onKeyDown, true);
    host.addEventListener('click', (e) => {
      if (Date.now() - animStartTime < 300) return;
      handleUserSkip(e);
    });

    const hint = createBootStatusPill('agy-video-boot-hint', handleUserSkip);
    hint.className = 'agy-boot-status-pill status-loading';
    hint.innerHTML = '<div class="spinner"></div><span class="status-text">系统启动中...</span>';
    host.appendChild(hint);

    function markHostReady() {
      if (isHostReady) return;
      isHostReady = true;
      if (!canSafelyDismissBoot()) {
        updateLoadingSceneHint();
      } else {
        hint.className = 'agy-boot-status-pill status-ready';
        if (delaySec === 0) {
          hint.innerHTML = '<span class="ready-dot"></span><span class="status-text">就绪 · 按 <kbd>ESC</kbd> 或点击画面进入工作区</span>';
        } else {
          hint.innerHTML = '<span class="ready-dot"></span><span class="status-text">就绪 · 按 <kbd>ESC</kbd> 或点击跳过</span>';
        }
      }
      autoTimer = setupBootDismissScheduler(host, hint, onDismissScheduleTriggered);
    }

    // 权威宿主就绪检测：确保首页 DOM 与动态壁纸（特别是场景壁纸活态帧）完全落地后再放行
    readyCheckTimer = setInterval(() => {
      if (cleaned) {
        if (readyCheckTimer) clearInterval(readyCheckTimer);
        return;
      }
      if (!isHostReady) {
        if (typeof window.__agyIsHostTrulyReady === 'function' && window.__agyIsHostTrulyReady()) {
          markHostReady();
        }
      }
      if (isHostReady) {
        if (canSafelyDismissBoot()) {
          if (hint.className.includes('status-loading')) {
            hint.className = 'agy-boot-status-pill status-ready';
            if (delaySec === 0) {
              hint.innerHTML = '<span class="ready-dot"></span><span class="status-text">就绪 · 按 <kbd>ESC</kbd> 或点击画面进入工作区</span>';
            } else {
              hint.innerHTML = '<span class="ready-dot"></span><span class="status-text">就绪 · 按 <kbd>ESC</kbd> 或点击跳过</span>';
            }
          }
          if (pendingDismiss) {
            closeVideoBoot();
          }
        } else {
          updateLoadingSceneHint();
        }
      }
    }, 60);

    // 25秒极限兜底
    setTimeout(markHostReady, 25000);

    if (!videoSrc) {
      const emptyBox = document.createElement('div');
      emptyBox.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);padding:28px 36px;background:rgba(15,23,42,0.95);border:1px solid rgba(56,189,248,0.3);border-radius:12px;color:#f8fafc;font-family:sans-serif;text-align:center;box-shadow:0 20px 50px rgba(0,0,0,0.8);z-index:99999;';
      emptyBox.innerHTML = `
        <div style="font-size:28px;margin-bottom:12px;">🎬</div>
        <div style="font-size:16px;font-weight:600;color:#38bdf8;margin-bottom:8px;">开机短视频：未载入视频素材</div>
        <div style="font-size:13px;opacity:0.8;line-height:1.6;max-width:380px;">请在「外观设置 -> 开机引导动画」中点击“📂 载入新开机视频”，导入您的专属视频素材。</div>
        <div style="font-size:12px;opacity:0.5;margin-top:16px;">${delaySec === 0 ? '按 ESC 或点击画面退出' : `按 ESC 或点击任意位置跳过 (${delaySec}秒后自动进入)`}</div>
      `;
      host.appendChild(emptyBox);
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
    if (delaySec === 0) {
      video.setAttribute('loop', '');
    }
    video.setAttribute('muted', '');
    video.setAttribute('autoplay', '');
    video.setAttribute('playsinline', '');
    video.setAttribute('preload', 'auto');
    video.src = videoSrc;
    host.prepend(video);

    video.addEventListener('ended', () => {
      if (!canSafelyDismissBoot()) {
        // 动态场景尚未就绪，视频绝不退出，立即无缝循环播放，死守全屏遮罩
        try {
          video.currentTime = 0;
          video.play().catch(() => {});
        } catch (_) {}
        return;
      }
      if (delaySec === 0) {
        try {
          video.currentTime = 0;
          video.play().catch(() => {});
        } catch (_) {}
        return;
      }
      if (delaySec > 0 && (video.currentTime > 0.3 || (video.duration && video.currentTime >= video.duration - 0.5))) {
        closeVideoBoot();
      }
    });

    // 零闪烁交叉淡入：结束前 450ms 提前在底层挂载主界面壁纸
    let preloadedWallpaper = false;
    video.addEventListener('timeupdate', () => {
      if (cleaned || !video.duration || !isFinite(video.duration)) return;
      // 若快要播放完毕（剩 0.25s）但场景壁纸仍在装配，提前回滚重播，避免末尾黑屏
      if (!canSafelyDismissBoot() && video.duration - video.currentTime <= 0.25) {
        try {
          video.currentTime = 0;
          video.play().catch(() => {});
        } catch (_) {}
        return;
      }
      if (preloadedWallpaper) return;
      if (delaySec > 0 && video.duration - video.currentTime <= 0.45 && canSafelyDismissBoot()) {
        preloadedWallpaper = true;
        if (typeof window.__agyResumeBootWallpaper === 'function') {
          try { window.__agyResumeBootWallpaper(); } catch (_) {}
        }
      }
    });
    video.addEventListener('error', (e) => {
      console.warn('[Boot Video] Video element error:', e, video.error);
      videoErrorFailed = true;
      setTimeout(closeVideoBoot, 300);
    });
    video.play().catch(err => {
      console.warn('[Boot Video] Playback failed or blocked, retrying muted:', err);
      video.muted = true;
      video.setAttribute('muted', '');
      video.play().catch(() => {
        videoErrorFailed = true;
        setTimeout(closeVideoBoot, 300);
      });
    });
  }

  /**
   * 场景封面开屏动效：支持真实 WebGL2 动态场景渲染与高清海报平滑兜底，
   * 依据 autoEnterDelay 配置平滑淡入主界面或纯手动驻留，兼顾极致画质与流畅动效。
   */
  // 开屏动画彻底专注于视频（Video）与脚本（Code），彻底弃用场景开屏
  function startSceneBoot() {
    window.__agyBootPlaying = false;
    restoreTitleBarOverlay();
    cleanMacAntiFlashAndNotify();
    if (typeof window.__agyResumeBootWallpaper === 'function') {
      try { window.__agyResumeBootWallpaper(); } catch (e) {}
    } else {
      resumeWallpaperVideo();
    }
  }

  async function startCustomCodeBoot(scriptPath, isManualPreview = false) {
    if (!isManualPreview) {
      if (window.__agyMasterBootHandled || sessionStorage.getItem('__agy_booted__')) {
        console.log('[Boot Animation] Suppressed duplicate code boot (handled by master).');
        return;
      }
    }
    if (document.getElementById('agy-custom-code-boot-host')) return;
    window.__agyBootPlaying = true;
    pauseWallpaperVideo();
    startBootTitleBarLock();

    const bootCfg = getBootConfig();
    const delaySec = Number.isFinite(bootCfg.autoEnterDelay) ? Math.max(0, Math.min(10, Math.round(bootCfg.autoEnterDelay))) : 3;

    const host = document.createElement('div');
    host.id = 'agy-custom-code-boot-host';
    host.style.cssText = 'position:fixed;inset:0;z-index:2147483647;width:100vw;height:100vh;background:#000;overflow:hidden;transition:opacity 400ms ease;';

    mountHost(host);
    sessionStorage.setItem('__agy_booted__', 'true');

    let cleaned = false;
    let customCleanup = null;
    let autoTimer = null;
    let isHostReady = false;
    let readyCheckTimer = null;
    let pendingDismiss = false;

    function canSafelyDismissCustomBoot() {
      if (!checkIsSceneWallpaper()) return isHostReady;
      const sceneCanvas = document.querySelector('#agy-dynamic-scene canvas.agy-scene-live');
      const isSceneLive = (window.__agySceneFirstFrameReady === true && !!sceneCanvas) || window.__agySceneDynamicFailed === true;
      return isHostReady && isSceneLive;
    }

    function updateCustomLoadingHint() {
      if (!hint || cleaned) return;
      hint.className = 'agy-boot-status-pill status-loading';
      if (hint.dataset.shaking) return;
      const isScene = checkIsSceneWallpaper();
      hint.innerHTML = `<div class="spinner"></div><span class="status-text">${
        isScene ? '🎬 正在装配 4K 场景着色器与动态图层...' : '正在载入主界面与动态壁纸...'
      }</span>`;
    }

    function closeCustomBoot() {
      if (cleaned) return;
      if (!canSafelyDismissCustomBoot()) {
        pendingDismiss = true;
        updateCustomLoadingHint();
        return;
      }
      cleaned = true;
      if (autoTimer) {
        clearTimeout(autoTimer);
        autoTimer = null;
      }
      if (readyCheckTimer) {
        clearInterval(readyCheckTimer);
        readyCheckTimer = null;
      }
      window.__agyBootPlaying = false;
      restoreTitleBarOverlay();
      window.removeEventListener('keydown', onKeyDown, true);
      // 在开屏遮罩淡出的一瞬间（T=0）平滑唤醒底层壁纸
      if (typeof window.__agyResumeBootWallpaper === 'function') {
        try { window.__agyResumeBootWallpaper(); } catch(e) {}
      } else {
        resumeWallpaperVideo();
      }

      host.style.transition = 'opacity 500ms cubic-bezier(0.25, 1, 0.5, 1), transform 500ms cubic-bezier(0.25, 1, 0.5, 1)';
      host.style.opacity = '0';
      host.style.transform = 'scale(1.02) translateZ(0)';

      setTimeout(() => {
        if (typeof customCleanup === 'function') {
          try { customCleanup(); } catch(e) {}
        }
        try { host.remove(); } catch(e) {}
        restoreTitleBarOverlay();
        cleanMacAntiFlashAndNotify();
      }, 520);
    }

    const hint = createBootStatusPill('agy-custom-boot-hint', closeCustomBoot);
    hint.className = 'agy-boot-status-pill status-loading';
    hint.innerHTML = '<div class="spinner"></div><span class="status-text">系统启动中...</span>';
    host.appendChild(hint);

    function onCustomDismissScheduled() {
      if (canSafelyDismissCustomBoot()) {
        closeCustomBoot();
      } else {
        pendingDismiss = true;
        updateCustomLoadingHint();
      }
    }

    readyCheckTimer = setInterval(() => {
      if (cleaned) {
        if (readyCheckTimer) clearInterval(readyCheckTimer);
        return;
      }
      if (!isHostReady) {
        if (typeof window.__agyIsHostTrulyReady === 'function' && window.__agyIsHostTrulyReady()) {
          isHostReady = true;
          if (!canSafelyDismissCustomBoot()) {
            updateCustomLoadingHint();
          } else {
            hint.className = 'agy-boot-status-pill status-ready';
            if (delaySec === 0) {
              hint.innerHTML = '<span class="ready-dot"></span><span class="status-text">就绪 · 按 <kbd>ESC</kbd> 或点击画面进入工作区</span>';
            } else {
              hint.innerHTML = '<span class="ready-dot"></span><span class="status-text">就绪 · 按 <kbd>ESC</kbd> 或点击跳过</span>';
            }
          }
          autoTimer = setupBootDismissScheduler(host, hint, onCustomDismissScheduled);
        }
      }
      if (isHostReady) {
        if (canSafelyDismissCustomBoot()) {
          if (hint.className.includes('status-loading')) {
            hint.className = 'agy-boot-status-pill status-ready';
            if (delaySec === 0) {
              hint.innerHTML = '<span class="ready-dot"></span><span class="status-text">就绪 · 按 <kbd>ESC</kbd> 或点击画面进入工作区</span>';
            } else {
              hint.innerHTML = '<span class="ready-dot"></span><span class="status-text">就绪 · 按 <kbd>ESC</kbd> 或点击跳过</span>';
            }
          }
          if (pendingDismiss) {
            closeCustomBoot();
          }
        } else {
          updateCustomLoadingHint();
        }
      }
    }, 60);
    setTimeout(() => { isHostReady = true; }, 25000);

    function onKeyDown(e) {
      if (delaySec === 0) {
        if (e.key === 'Escape' || e.code === 'Escape') {
          closeCustomBoot();
        }
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
        <div style="font-size:12px;opacity:0.5;margin-top:16px;">${delaySec === 0 ? '按 ESC 或点击画面退出' : `按 ESC 或点击任意位置跳过 (${delaySec}秒后自动进入)`}</div>
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

  window.__triggerBootAnimation = function(customType, customPath, customCodePath, customDir, isManualPreview = false) {
    if (!isManualPreview) {
      if (window.__agyMasterBootHandled || sessionStorage.getItem('__agy_booted__')) {
        console.log('[Boot Animation] Suppressed duplicate __triggerBootAnimation (handled by master).');
        return;
      }
    }
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
      startVideoBoot(src, isManualPreview);
      return;
    }

    if (type === 'scene') {
      // 关键收敛：开屏动画彻底弃用场景模式，只支持视频类素材；若传入场景模式，安全降级为视频播放或退出
      if (videoPath) {
        let src = (videoPath.startsWith('http://') || videoPath.startsWith('https://'))
          ? videoPath
          : `${API_BASE}/boot-video.mp4?path=${encodeURIComponent(videoPath)}`;
        startVideoBoot(src, isManualPreview);
      }
      return;
    }

    // type is 'code'
    startCustomCodeBoot(codePath, isManualPreview);
  };

})();
