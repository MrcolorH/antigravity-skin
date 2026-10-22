/**
 * agy-modal.js - Antigravity 通用弹窗与悬浮堆叠管理基座
 *
 * 特性：
 * 1. 单例统一管理，挂载在 document.body，避免宿主 overflow 截断
 * 2. 捕获阶段拦截 ESC 键，阻止向外冒泡，防止误关宿主设置窗口
 * 3. 高层级堆叠：Backdrop 5900，Modal 6000，悬浮胶囊 5500
 * 4. 自动聚焦与焦点归还管理
 * 5. 适配 Antigravity 深色 / 浅色毛玻璃视觉风格
 */

(() => {
  if (typeof window === 'undefined') return;

  const MODAL_STYLE_ID = 'agy-modal-common-style';
  const openModals = new Map(); // id -> { backdropEl, modalEl, prevActiveEl, onClose }

  function ensureStyle() {
    if (document.getElementById(MODAL_STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = MODAL_STYLE_ID;
    style.textContent = `
      .agy-modal-backdrop {
        position: fixed;
        inset: 0;
        z-index: 5900;
        background: rgba(0, 0, 0, 0.58);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        opacity: 0;
        transition: opacity 0.22s cubic-bezier(0.16, 1, 0.3, 1);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
        box-sizing: border-box;
      }
      .agy-modal-backdrop.agy-modal-visible {
        opacity: 1;
      }
      .agy-modal-container {
        position: relative;
        z-index: 6000;
        display: flex;
        flex-direction: column;
        background: rgba(24, 24, 27, 0.88);
        border: 1px solid rgba(255, 255, 255, 0.12);
        box-shadow: 0 24px 64px -12px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(255, 255, 255, 0.05);
        border-radius: 16px;
        color: #f4f4f5;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        box-sizing: border-box;
        overflow: hidden;
        transform: scale(0.96) translateY(8px);
        opacity: 0;
        transition: transform 0.24s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease;
      }
      .agy-modal-visible .agy-modal-container {
        transform: scale(1) translateY(0);
        opacity: 1;
      }
      /* 浅色模式适配 */
      body:not(.dark):not(.theme-dark) .agy-modal-container {
        background: rgba(255, 255, 255, 0.94);
        border-color: rgba(0, 0, 0, 0.12);
        color: #18181b;
        box-shadow: 0 24px 64px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.05);
      }
      .agy-modal-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px 20px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        user-select: none;
      }
      body:not(.dark):not(.theme-dark) .agy-modal-header {
        border-bottom-color: rgba(0, 0, 0, 0.08);
      }
      .agy-modal-title-group {
        display: flex;
        flex-direction: column;
        gap: 3px;
        overflow: hidden;
      }
      .agy-modal-title {
        font-size: 15px;
        font-weight: 600;
        letter-spacing: -0.01em;
        margin: 0;
        white-space: nowrap;
        text-overflow: ellipsis;
        overflow: hidden;
      }
      .agy-modal-subtitle {
        font-size: 12px;
        opacity: 0.65;
        margin: 0;
        white-space: nowrap;
        text-overflow: ellipsis;
        overflow: hidden;
      }
      .agy-modal-close-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        border-radius: 8px;
        background: transparent;
        border: none;
        color: inherit;
        cursor: pointer;
        opacity: 0.65;
        transition: background 0.15s, opacity 0.15s;
        font-size: 18px;
        line-height: 1;
        padding: 0;
      }
      .agy-modal-close-btn:hover {
        opacity: 1;
        background: rgba(255, 255, 255, 0.1);
      }
      body:not(.dark):not(.theme-dark) .agy-modal-close-btn:hover {
        background: rgba(0, 0, 0, 0.06);
      }
      .agy-modal-body {
        padding: 20px;
        overflow-y: auto;
        overflow-x: hidden;
        flex: 1 1 auto;
        box-sizing: border-box;
      }
      .agy-modal-body::-webkit-scrollbar {
        width: 6px;
      }
      .agy-modal-body::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.15);
        border-radius: 3px;
      }
      .agy-modal-footer {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 10px;
        padding: 14px 20px;
        border-top: 1px solid rgba(255, 255, 255, 0.08);
        box-sizing: border-box;
      }
      body:not(.dark):not(.theme-dark) .agy-modal-footer {
        border-top-color: rgba(0, 0, 0, 0.08);
      }
      /* 通用按钮规范 */
      .agy-btn-secondary {
        padding: 6px 14px;
        border-radius: 8px;
        font-size: 12.5px;
        font-weight: 500;
        border: 1px solid rgba(255, 255, 255, 0.15);
        background: rgba(255, 255, 255, 0.06);
        color: inherit;
        cursor: pointer;
        transition: background 0.15s, border-color 0.15s;
      }
      .agy-btn-secondary:hover {
        background: rgba(255, 255, 255, 0.12);
        border-color: rgba(255, 255, 255, 0.25);
      }
      body:not(.dark):not(.theme-dark) .agy-btn-secondary {
        border-color: rgba(0, 0, 0, 0.15);
        background: rgba(0, 0, 0, 0.04);
      }
      body:not(.dark):not(.theme-dark) .agy-btn-secondary:hover {
        background: rgba(0, 0, 0, 0.08);
      }
      .agy-btn-primary {
        padding: 6px 16px;
        border-radius: 8px;
        font-size: 12.5px;
        font-weight: 600;
        border: 1px solid rgba(56, 189, 248, 0.4);
        background: #0284c7;
        color: #ffffff;
        cursor: pointer;
        transition: background 0.15s, box-shadow 0.15s;
      }
      .agy-btn-primary:hover {
        background: #0369a1;
        box-shadow: 0 2px 10px rgba(2, 132, 199, 0.35);
      }
    `;
    document.head.appendChild(style);
  }

  // 顶层 ESC 拦截守卫：捕获阶段拦截，阻止冒泡到外层宿主设置弹窗
  let escListenerInstalled = false;
  function ensureEscListener() {
    if (escListenerInstalled) return;
    escListenerInstalled = true;
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' || e.key === 'Esc') {
        if (openModals.size > 0) {
          // 获取最后压栈的弹窗关闭
          const keys = Array.from(openModals.keys());
          const topKey = keys[keys.length - 1];
          if (topKey) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            close(topKey);
          }
        }
      }
    }, true); // true = capture phase!
  }

  function open({ id, title = '', subtitle = '', width = '560px', height = 'auto', maxWidth = '92vw', maxHeight = '88vh', render, onClose }) {
    if (!id) id = 'agy-modal-' + Math.random().toString(36).slice(2, 8);
    ensureStyle();
    ensureEscListener();

    if (openModals.has(id)) {
      close(id);
    }

    const prevActiveEl = document.activeElement;

    const backdrop = document.createElement('div');
    backdrop.className = 'agy-modal-backdrop';
    backdrop.id = `agy-backdrop-${id}`;

    const container = document.createElement('div');
    container.className = 'agy-modal-container';
    container.style.width = width;
    container.style.height = height;
    container.style.maxWidth = maxWidth;
    container.style.maxHeight = maxHeight;

    const header = document.createElement('div');
    header.className = 'agy-modal-header';

    const titleGroup = document.createElement('div');
    titleGroup.className = 'agy-modal-title-group';

    const titleEl = document.createElement('h3');
    titleEl.className = 'agy-modal-title';
    titleEl.textContent = title;
    titleGroup.appendChild(titleEl);

    if (subtitle) {
      const subtitleEl = document.createElement('p');
      subtitleEl.className = 'agy-modal-subtitle';
      subtitleEl.textContent = subtitle;
      titleGroup.appendChild(subtitleEl);
    }

    const closeBtn = document.createElement('button');
    closeBtn.className = 'agy-modal-close-btn';
    closeBtn.innerHTML = '✕';
    closeBtn.title = '关闭 (ESC)';
    closeBtn.addEventListener('click', () => close(id));

    header.appendChild(titleGroup);
    header.appendChild(closeBtn);

    const body = document.createElement('div');
    body.className = 'agy-modal-body';

    container.appendChild(header);
    container.appendChild(body);
    backdrop.appendChild(container);

    // 点击背景空白处关闭
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        close(id);
      }
    });

    document.body.appendChild(backdrop);

    // 触发过渡动画
    requestAnimationFrame(() => {
      backdrop.classList.add('agy-modal-visible');
    });

    const modalObj = {
      id,
      backdropEl: backdrop,
      modalEl: container,
      bodyEl: body,
      headerEl: header,
      prevActiveEl,
      onClose
    };

    openModals.set(id, modalObj);

    if (typeof render === 'function') {
      try {
        render(body, {
          close: () => close(id),
          setHeaderSubtitle: (text) => {
            let sub = titleGroup.querySelector('.agy-modal-subtitle');
            if (!sub) {
              sub = document.createElement('p');
              sub.className = 'agy-modal-subtitle';
              titleGroup.appendChild(sub);
            }
            sub.textContent = text;
          },
          setHeaderTitle: (text) => {
            titleEl.textContent = text;
          }
        });
      } catch (err) {
        console.error(`[agy-modal] Error rendering modal ${id}:`, err);
      }
    }

    return modalObj;
  }

  function close(id) {
    const modalObj = openModals.get(id);
    if (!modalObj) return;

    openModals.delete(id);

    const { backdropEl, prevActiveEl, onClose } = modalObj;
    backdropEl.classList.remove('agy-modal-visible');

    setTimeout(() => {
      try { backdropEl.remove(); } catch (_) {}
      if (typeof onClose === 'function') {
        try { onClose(); } catch (e) {}
      }
      if (prevActiveEl && typeof prevActiveEl.focus === 'function') {
        try { prevActiveEl.focus(); } catch (_) {}
      }
    }, 240);
  }

  function closeAll() {
    const ids = Array.from(openModals.keys());
    for (const id of ids) {
      close(id);
    }
  }

  function isOpen(id) {
    return openModals.has(id);
  }

  /**
   * 兼容保留接口：已废弃实时悬浮几何计算（升级为框内流式集成，0 Layout Thrashing）
   */
  function syncAnchor(targetEl, fabEl) {
    if (fabEl) fabEl.style.display = 'none';
  }

  window.__agyModal = {
    ensureStyle,
    open,
    close,
    closeAll,
    isOpen,
    syncAnchor
  };
})();
