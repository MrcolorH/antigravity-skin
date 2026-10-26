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

  // ==========================================================================
  // 壁纸明暗自适应引擎（Auto Luminance Probe）
  // 用途：高透明面板下，深色壁纸必须配浅字、浅色壁纸必须配深字，否则字糊在底上。
  // 策略：按需读取当前壁纸的封面/预览图 → 32x32 缩略采样算平均相对亮度 →
  //       在 <html> 上打 agy-dark-wallpaper / agy-light-wallpaper 标记，
  //       由 glass-theme.css 第 15 节根据标记切换「浅字 + 深玻璃」/「深字 + 浅玻璃」。
  // ==========================================================================
  let luminanceProbeSeq = 0;

  function applyLuminanceClass(isDark) {
    const html = document.documentElement;
    if (!html || !html.classList) return;
    html.classList.toggle('agy-dark-wallpaper', !!isDark);
    html.classList.toggle('agy-light-wallpaper', !isDark);
    scheduleContrastGuard(260);
  }

  // 顶部条带专用明暗判定：
  // 实测坑：壁纸「整体」平均亮度偏亮，但标题栏所在的最上方条带可能接近纯黑
  // （例如地球/夜景类壁纸），此时若按整体亮度填深色字，顶部文字会黑到看不见。
  function applyTopbarTone(topLum, hasMeasure) {
    const html = document.documentElement;
    if (!html || !html.classList) return;
    const isDark = typeof topLum === 'number' ? topLum < 0.22 : nativeThemeIsDark();
    html.classList.toggle('agy-dark-topbar', !!isDark);
    html.classList.toggle('agy-light-topbar', !isDark);
    if (hasMeasure) {
      try { html.dataset.agyTopLum = topLum.toFixed(3); } catch (_) {}
    } else {
      try { delete html.dataset.agyTopLum; } catch (_) {}
      try {
        html.dataset.agyTopLum = (nativeThemeIsDark() ? '0.030' : '0.940');
      } catch (_) {}
    }
    scheduleContrastGuard(260);
  }

  function nativeThemeIsDark() {
    const b = document.body;
    if (!b || !b.classList) return false;
    return b.classList.contains('dark') || b.classList.contains('theme-dark');
  }

  // ==========================================================================
  // 透明面上「文字对比度守护」（Contrast Guard）
  // --------------------------------------------------------------------------
  // 痛点：面板越透，原生浅色主题的深色字就会直接压在深色壁纸上，很多页面
  //       （顶部菜单、侧边栏标题、空状态、按钮文字……）黑字压黑底，完全看不清。
  // 策略：逐个「直接含文本」的元素求最近的不透明背景，算 WCAG 对比度；
  //       低于 3:1 就把字色翻到反向（深底→浅字 / 浅底→深字），并记录原值以便回滚。
  //       只在需要时改，绝不无脑全量改色；靠着壁纸的透明面才会被改。
  // ==========================================================================
  const CG_ATTR = 'data-agy-cg';
  const CG_LIGHT = '#f4f7fb';
  const CG_DARK = '#0b0f14';
  const CG_MIN_CONTRAST = 3.0;
  const CG_MAX_FLIPS = 900;
  let cgTimer = null;
  let cgObserver = null;

  const cgToLinear = (v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  const cgRelLum = (r, g, b) => 0.2126 * cgToLinear(r) + 0.7152 * cgToLinear(g) + 0.0722 * cgToLinear(b);
  const cgParseColor = (str) => {
    const m = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?/i.exec(str || '');
    if (!m) return null;
    return { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] };
  };
  const cgContrast = (l1, l2) => {
    const a = Math.max(l1, l2);
    const b = Math.min(l1, l2);
    return (a + 0.05) / (b + 0.05);
  };

  // 解析简单渐变（linear-gradient(...)）里的颜色停靠点，按 alpha 加权求均值
  // 目的：主题里大量玻璃面板用低透明 渐变 而非纯色，不能因此把整个元素当成「不可判定」
  function cgGradientColor(cs) {
    const gi = cs.backgroundImage;
    if (!gi || gi === 'none') return null;
    const matches = gi.match(/rgba?\([^)]+\)/gi);
    if (!matches || !matches.length) return null;
    let r = 0, g = 0, b = 0, aSum = 0, aAvg = 0, n = 0;
    for (const m of matches) {
      const c = cgParseColor(m);
      if (!c) continue;
      r += c.r * c.a;
      g += c.g * c.a;
      b += c.b * c.a;
      aSum += c.a;
      aAvg += c.a;
      n++;
    }
    if (!n || aSum === 0) return null;
    return { r: r / aSum, g: g / aSum, b: b / aSum, a: aAvg / n };
  }

  // 求元素「实际压在什么颜色上」：最近的不透明祖先面板，否则就是壁纸
  // 壁纸部分使用「纵向亮度剖面」按元素所在高度取值（不能只看全图平均值）
  function cgBackdrop(el, cache, rect) {
    let node = el;
    while (node && node !== document.documentElement) {
      if (cache && cache.has(node)) {
        const hit = cache.get(node);
        if (hit) return hit;
        node = node.parentElement;
        continue;
      }
      const cs = getComputedStyle(node);
      const bg = cgParseColor(cs.backgroundColor);
      let found = null;
      if (bg && bg.a >= 0.5) {
        found = { lum: cgRelLum(bg.r, bg.g, bg.b) };
      } else {
        const grad = cgGradientColor(cs);
        if (grad && grad.a >= 0.5) found = { lum: cgRelLum(grad.r, grad.g, grad.b) };
      }
      if (cache && found) cache.set(node, found);
      if (found) return found;
      node = node.parentElement;
    }
    const html = document.documentElement;
    let profile = [];
    try {
      profile = (html.dataset.agyLumProfile || '')
        .split(',')
        .map((v) => parseFloat(v))
        .filter((v) => !isNaN(v));
    } catch (_) {}
    if (profile.length && rect) {
      const vh = window.innerHeight || document.documentElement.clientHeight || 0;
      if (vh > 0) {
        const frac = Math.min(0.999, Math.max(0, (rect.top + rect.height / 2) / vh));
        const idx = Math.min(profile.length - 1, Math.floor(frac * profile.length));
        return { lum: profile[idx] };
      }
    }
    const globalLum = parseFloat(html.dataset.agyWallpaperLum || '');
    if (!isNaN(globalLum)) return { lum: globalLum };
    return { lum: html.classList.contains('agy-dark-wallpaper') ? 0.04 : 0.96 };
  }

  function cgRevert(el) {
    // 注意：不能只靠 data-* 属性判断（React 重渲染可能重建节点/丢失属性），
    // 用 __agyCgApplied 标记双保险，避免「属性没了但 inline 色还留着」的脏状态
    if (!el.hasAttribute(CG_ATTR) && !el.__agyCgApplied) return;
    el.removeAttribute(CG_ATTR);
    const orig = el.__agyCgOrigColor;
    if (orig) {
      el.style.setProperty('color', orig);
    } else {
      el.style.removeProperty('color');
    }
    el.style.removeProperty('text-shadow');
    el.__agyCgOrigColor = null;
    el.__agyCgOrigFg = null;
    el.__agyCgApplied = false;
  }

  function runContrastGuard() {
    const body = document.body;
    const html = document.documentElement;
    if (!body || !html) return;
    if (!html.classList.contains('agy-dark-wallpaper') && !html.classList.contains('agy-light-wallpaper')) return;

    let flipped = 0;
    const backdropCache = new Map();
    let candidates = body.querySelectorAll('*');
    for (const el of candidates) {
      if (flipped > CG_MAX_FLIPS) break;

      // 只处理「直接包含非空文本节点」或「图标按钮（直接子 SVG）」的元素，避免无意义遍历
      let hasText = false;
      const kids = el.childNodes;
      for (let i = 0; i < kids.length; i++) {
        const n = kids[i];
        if (n.nodeType === 3 && n.nodeValue && n.nodeValue.trim()) { hasText = true; break; }
      }
      let hasIcon = false;
      if (!hasText) {
        // 图标通常嵌在 button > span > span > svg 这种多层结构里，
        // 条件是「自身无文本 + 内部有 svg/codicon」
        const childCount = el.childElementCount;
        if (childCount > 0 && childCount <= 3 && !(el.textContent || '').trim()) {
          if (el.querySelector('svg, .codicon')) hasIcon = true;
        }
      }
      if (!hasText && !hasIcon) {
        if (el.hasAttribute(CG_ATTR)) cgRevert(el);
        continue;
      }
      if (el.closest('#agy-dynamic-iframe,#agy-wallpaper-backdrop,#agy-video-boot-host,#agy-custom-code-boot-host,#agy-scene-boot-host,[data-agy-no-cg]')) continue;

      const rect = el.getBoundingClientRect();
      if (!rect.width || !rect.height) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none' || parseFloat(cs.opacity) < 0.05) continue;
      // 透明文字（比如有些图标字）不做处理
      const fg = cgParseColor(cs.color);
      if (!fg || fg.a < 0.35) continue;

      const bd = cgBackdrop(el, backdropCache, rect);
      if (!bd) { cgRevert(el); continue; }

      // 关键：始终用「元素本来的字色」判定，绝不能用我们改完之后的颜色回算，
      // 否则「翻完→颜色变浅→对比度看着够了→再翻回去」会无限抖动。
      const baseFg = el.__agyCgOrigFg || fg;
      const fgLum = cgRelLum(baseFg.r, baseFg.g, baseFg.b);
      if (cgContrast(fgLum, bd.lum) >= CG_MIN_CONTRAST) { cgRevert(el); continue; }

      const tone = bd.lum < 0.35 ? 'light' : 'dark';
      const targetRgb = tone === 'light' ? 'rgb(244, 247, 251)' : 'rgb(11, 15, 20)';
      // 已就位（标记一致且颜色确实生效）则跳过
      if (el.getAttribute(CG_ATTR) === tone && cs.color === targetRgb) continue;
      if (!el.__agyCgOrigFg) el.__agyCgOrigFg = { r: baseFg.r, g: baseFg.g, b: baseFg.b };
      if (!el.hasAttribute(CG_ATTR)) {
        el.__agyCgOrigColor = el.style.getPropertyValue('color') || null;
      }
      el.setAttribute(CG_ATTR, tone);
      el.__agyCgApplied = true;
      // 双保险：属性选择器（react 重渲染冲不掉）+ inline important（战胜主题的高特指度 !important）
      el.style.setProperty('color', tone === 'light' ? CG_LIGHT : CG_DARK, 'important');
      if (hasText) {
        el.style.setProperty('text-shadow', tone === 'light' ? '0 1px 2px rgba(0,0,0,.6)' : '0 1px 2px rgba(255,255,255,.6)');
      }
      flipped++;
    }
  }

  function scheduleContrastGuard(delay) {
    try {
      clearTimeout(cgTimer);
      cgTimer = setTimeout(() => {
        try { runContrastGuard(); } catch (_) {}
        try { watchContrastDom(); } catch (_) {}
      }, typeof delay === 'number' ? delay : 400);
    } catch (_) {}
  }

  let cgWatchTimer = null;
  function watchContrastDom() {
    if (cgObserver || !document.body) return;
    try {
      cgObserver = new MutationObserver(() => {
        clearTimeout(cgWatchTimer);
        cgWatchTimer = setTimeout(() => {
          try { runContrastGuard(); } catch (_) {}
        }, 1200);
      });
      // 只监听结构变化（属性变化是我们自己引起的，监听会造成回环）
      cgObserver.observe(document.body, { childList: true, subtree: true });
    } catch (_) {}
  }

  // 调试入口：控制台执行 window.__agyContrastGuard() 可立即重算
  try { window.__agyContrastGuard = () => { runContrastGuard(); return 'done'; }; } catch (_) {}

  function detectWallpaperLuminance(dw, mediaOn) {
    try {
      if (!mediaOn) {
        // 无壁纸（纯毛玻璃）时，直接跟随原生主题
        applyLuminanceClass(nativeThemeIsDark());
        applyTopbarTone(null, false);
        return;
      }

      const folder = String(dw.wallpaperDir || '');
      const preview = String(dw.previewFile || '');

      // 视频壁纸通常没有封面图，退回原生主题判断
      if (!folder || !preview) {
        applyLuminanceClass(nativeThemeIsDark());
        applyTopbarTone(null, false);
        return;
      }

      const seq = ++luminanceProbeSeq;
      const url = `${API_BASE}/api/wallpaper-library/preview?folder=${encodeURIComponent(folder)}&file=${encodeURIComponent(preview)}`;
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        if (seq !== luminanceProbeSeq) return; // 竞态守卫：换壁纸后丢弃旧结果
        try {
          const N = 32;
          const canvas = document.createElement('canvas');
          canvas.width = N;
          canvas.height = N;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (!ctx) return;
          ctx.drawImage(img, 0, 0, N, N);
          const data = ctx.getImageData(0, 0, N, N).data;

          // 按 WCAG 定义计算真实相对亮度（sRGB → 线性光照），而不是 gamma 空间的粗略加权
          const toLinear = (v) => {
            const c = v / 255;
            return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
          };
          let sum = 0;
          let count = 0;
          let topSum = 0;
          let topCount = 0;
          // 顶部条带 = 图像最上方 9%（对应标题栏 0~35px 区域，按 cover 裁切近似）
          const topRows = Math.max(1, Math.round(N * 0.09));
          // 纵向亮度剖面：把画面横向切成 8 条，供「局部对比度判定」使用
          // （同一张壁纸「整体偏亮」但顶部/底部可能几乎纯黑，只看全局平均值会误判）
          const STRIPS = 8;
          const stripSum = new Array(STRIPS).fill(0);
          const stripCnt = new Array(STRIPS).fill(0);
          for (let i = 0; i < data.length; i += 4) {
            const l = 0.2126 * toLinear(data[i]) + 0.7152 * toLinear(data[i + 1]) + 0.0722 * toLinear(data[i + 2]);
            sum += l;
            count++;
            const y = ((i / 4) / N) | 0;
            if (y < topRows) { topSum += l; topCount++; }
            const si = Math.min(STRIPS - 1, Math.floor((y * STRIPS) / N));
            stripSum[si] += l;
            stripCnt[si]++;
          }
          const lum = count ? sum / count : 0;
          const topLum = topCount ? topSum / topCount : lum;
          // 阈值 0.22 ≈ 中灰 (RGB 127) 的相对亮度。低于它就走「深色玻璃 + 白字」
          applyLuminanceClass(lum < 0.22);
          applyTopbarTone(topLum, true);
          try {
            document.documentElement.dataset.agyWallpaperLum = lum.toFixed(3);
            document.documentElement.dataset.agyLumProfile = stripSum
              .map((s, i) => (stripCnt[i] ? (s / stripCnt[i]).toFixed(3) : '0'))
              .join(',');
          } catch (_) {}
        } catch (_) {
          // 画布被污染等异常：退回原生主题
          applyLuminanceClass(nativeThemeIsDark());
          applyTopbarTone(null, false);
        }
      };
      img.onerror = () => {
        if (seq === luminanceProbeSeq) {
          applyLuminanceClass(nativeThemeIsDark());
          applyTopbarTone(null, false);
        }
      };
      img.src = url;
    } catch (_) {}
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
      // 铺满策略默认 cover（铺满裁切）
      const fit = dw.fit || 'cover';
      const fitPosition = dw.fitPosition || 'center';
      // 阶段七/八：场景动态渲染模式与精细控制（fps, renderDpr）
      const sceneRenderer = dw.sceneRenderer || 'dynamic';
      const sceneScripts = (sourceType === 'scene' || !!wallpaperDir) ? true : (dw.sceneScripts !== false);
      const wallpaperId = dw.wallpaperId || '';
      const wallpaperUserProperties = dw.wallpaperUserProperties || {};
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

      // 壁纸明暗自适应：仅在素材本身变化时重新采样（避免每次 applyFeatures 都拉图）
      const lumKey = [mediaOn, sourceType, wallpaperDir, previewFile, videoPath].join('|');
      if (lastWallpaperState.lumKey !== lumKey) {
        detectWallpaperLuminance(dw, mediaOn);
        lastWallpaperState.lumKey = lumKey;
      }

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
              sceneScripts,
              wallpaperId,
              wallpaperUserProperties
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
                sceneScripts,
                wallpaperId,
                wallpaperUserProperties
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
      lastWallpaperState = { isCustomTheme: false, isVideoOn: false, videoPath: '', brightness: 0, contrast: 0, mediaKey: '', lumKey: '' };
      applyLuminanceClass(nativeThemeIsDark());
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
    // 关键修正：若开机 DOM 容器已在视口中则不重复创建；但 window.__agyBootPlaying 作为预留锁，绝不反向阻断初次启动
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
    if (shouldAbandonBootAnimation(cfg)) {
      if (typeof window.__agyCleanMacAntiFlash === 'function') {
        try { window.__agyCleanMacAntiFlash(); } catch (_) {}
      }
      return;
    }
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
