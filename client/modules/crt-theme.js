/**
 * crt-theme.js - 550C CRT Amber Theme & Scanlines
 */

export function initCrtTheme(cssContent = '') {
  let styleEl = document.getElementById('agy-550c-theme');
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'agy-550c-theme';
    (document.head || document.documentElement).appendChild(styleEl);
  }
  styleEl.textContent = cssContent;

  return {
    destroy: () => {
      const el = document.getElementById('agy-550c-theme');
      if (el) el.remove();
    }
  };
}

window.__agyInitCrtTheme = initCrtTheme;
