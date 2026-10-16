/**
 * wallpaper.js - Antigravity Dynamic Video Wallpaper & Glassmorphism Engine
 */

export function initWallpaper(options = {}) {
  const {
    videoUrl = 'http://127.0.0.1:59288/wallpaper.mp4',
    brightness = 0.85,
    contrast = 1.05,
    glassThemeCss = ''
  } = options;

  // 1. 设置滤镜变量
  document.documentElement.style.setProperty('--agy-bg-brightness', String(brightness));
  document.documentElement.style.setProperty('--agy-bg-contrast', String(contrast));

  // 2. 注入全局毛玻璃样式
  if (glassThemeCss) {
    let styleEl = document.getElementById('agy-dynamic-wallpaper-style');
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'agy-dynamic-wallpaper-style';
      (document.head || document.documentElement).appendChild(styleEl);
    }
    if (styleEl.textContent !== glassThemeCss) {
      styleEl.textContent = glassThemeCss;
    }
  }

  // 3. 挂载动态视频元素
  function mountVideo() {
    let videoEl = document.getElementById('agy-dynamic-video');
    if (!videoEl) {
      videoEl = document.createElement('video');
      videoEl.id = 'agy-dynamic-video';
      videoEl.autoplay = true;
      videoEl.loop = true;
      videoEl.muted = true;
      videoEl.playsInline = true;
      if (document.body) {
        document.body.prepend(videoEl);
      } else {
        document.documentElement.appendChild(videoEl);
      }
    }
    if (videoUrl && videoEl.src !== videoUrl) {
      videoEl.src = videoUrl;
      videoEl.play().catch(() => {});
    }
    return videoEl;
  }

  mountVideo();

  // 4. 用户气泡折叠增强按钮管理
  function updateCollapseBtnIcon(btn, isCollapsed) {
    if (isCollapsed) {
      btn.title = '展开提问';
      btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>';
    } else {
      btn.title = '收起提问';
      btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>';
    }
  }

  function enhanceUserBubbles() {
    const userSteps = document.querySelectorAll('[data-testid="user-input-step"], [class*="group/user-input-step"]');
    userSteps.forEach(step => {
      const card = step.querySelector('[data-testid="lifted-context-menu-trigger"]') ||
                   step.querySelector('div.relative.p-px.rounded-xl.bg-card-border') ||
                   step.querySelector('.bg-card') ||
                   step;
      
      const textEl = step.querySelector('[data-quotable="true"]') || step.querySelector('.whitespace-pre-wrap');
      const hasImg = !!step.querySelector('img');
      
      let isMultiLine = false;
      if (textEl) {
        const lh = parseFloat(window.getComputedStyle(textEl).lineHeight) || 24;
        isMultiLine = textEl.scrollHeight > (lh * 2.2) || textEl.innerText.includes('\n') || textEl.innerText.length > 60;
      }
      
      const needsCollapse = hasImg || isMultiLine;
      if (!needsCollapse) {
        step.removeAttribute('data-user-collapsed');
        const existingBtn = card.querySelector('.agy-user-collapse-btn');
        if (existingBtn) existingBtn.remove();
        return;
      }

      if (!step.hasAttribute('data-user-collapsed')) {
        step.setAttribute('data-user-collapsed', 'true');
      }

      let btn = card.querySelector('.agy-user-collapse-btn');
      if (!btn) {
        btn = document.createElement('button');
        btn.className = 'agy-user-collapse-btn';
        btn.setAttribute('type', 'button');
        btn.setAttribute('aria-label', '折叠/展开用户提问');
        btn.onclick = (e) => {
          e.stopPropagation();
          e.preventDefault();
          const isCollapsed = step.getAttribute('data-user-collapsed') === 'true';
          step.setAttribute('data-user-collapsed', isCollapsed ? 'false' : 'true');
          updateCollapseBtnIcon(btn, !isCollapsed);
        };
        card.appendChild(btn);
      }
      const currentCollapsed = step.getAttribute('data-user-collapsed') === 'true';
      updateCollapseBtnIcon(btn, currentCollapsed);
    });
  }

  window.__enhanceUserBubbles = enhanceUserBubbles;
  enhanceUserBubbles();

  // 5. DOM 监视器持续保活
  if (!window.__agyWallpaperObserver) {
    window.__agyWallpaperObserver = new MutationObserver(() => {
      mountVideo();
      enhanceUserBubbles();
    });
    window.__agyWallpaperObserver.observe(document.documentElement, {
      childList: true,
      subtree: false
    });
    if (document.head) {
      window.__agyWallpaperObserver.observe(document.head, {
        childList: true
      });
    }
  }

  if (!window.__agyBubbleObserver) {
    window.__agyBubbleObserver = new MutationObserver(() => {
      enhanceUserBubbles();
    });
    window.__agyBubbleObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
    window.addEventListener('scroll', () => {
      enhanceUserBubbles();
    }, { passive: true, capture: true });
  }

  return {
    updateFilters: (b, c) => {
      document.documentElement.style.setProperty('--agy-bg-brightness', String(b));
      document.documentElement.style.setProperty('--agy-bg-contrast', String(c));
    },
    updateVideoUrl: (newUrl) => {
      const v = document.getElementById('agy-dynamic-video');
      if (v && newUrl) {
        v.src = newUrl;
        v.play().catch(() => {});
      }
    },
    destroy: () => {
      const v = document.getElementById('agy-dynamic-video');
      if (v) v.remove();
      const s = document.getElementById('agy-dynamic-wallpaper-style');
      if (s) s.remove();
    }
  };
}

window.__agyInitWallpaper = initWallpaper;
