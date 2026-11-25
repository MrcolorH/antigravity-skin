/**
 * dashboard-settings.js - Injects a single native-styled Antigrative Dashboard toggle
 * under Settings -> Models & Usage -> Your Plan (compatible with light & dark themes).
 */

export function findModelsUsagePlanAnchor(modal) {
  if (!modal) return null;
  const text = (modal.textContent || '').trim();
  const isModelsUsagePage =
    text.includes('Models & Usage') ||
    text.includes('模型与用量') ||
    ((text.includes('Quota') || text.includes('配额') || text.includes('额度')) &&
      (text.includes('Your Plan') || text.includes('您的计划') || text.includes('您的套餐') || text.includes('套餐详情') || text.includes('AI 积分') || text.includes('AI Credits')));
  if (!isModelsUsagePage) return null;

  const headings = Array.from(modal.querySelectorAll('h1, h2, h3, h4, div, span, p'));
  const planTitleTargets = new Set([
    'your plan',
    '您的计划',
    '您的套餐',
    '套餐详情',
    '套餐计划',
    'plan',
    'ai credits',
    'ai 积分'
  ]);

  for (const el of headings) {
    if (el.closest('#agy-dashboard-settings-card')) continue;
    const raw = (el.textContent || '').trim().toLowerCase();
    if (!planTitleTargets.has(raw)) continue;

    let card = el.parentElement;
    let depth = 0;
    while (card && card !== modal && depth < 5) {
      const cardText = (card.textContent || '').trim();
      const cls = String(card.className || '');
      const looksLikeCard =
        cls.includes('rounded') ||
        cls.includes('border') ||
        cls.includes('card') ||
        cls.includes('bg-');
      if (looksLikeCard && cardText.length > raw.length && cardText.length < 1500) {
        return card;
      }
      card = card.parentElement;
      depth++;
    }
    if (el.parentElement && el.parentElement !== modal) {
      return el.parentElement;
    }
  }
  return null;
}

export function initDashboardSettings(getConfig, saveConfig) {
  const CARD_ID = 'agy-dashboard-settings-card';
  const API_PORT = (typeof window !== 'undefined' && window.__AG_SKIN_PORT__) || 59288;
  let statusTimer = null;
  let observer = null;
  let pollTimer = null;

  function isZh(cfg) {
    return cfg?.features?.chineseLocalization !== false;
  }

  function ensureStyles() {
    if (typeof document === 'undefined' || document.getElementById('agy-dashboard-settings-style')) return;
    const style = document.createElement('style');
    style.id = 'agy-dashboard-settings-style';
    style.textContent = `
      #${CARD_ID} {
        margin: 16px 0 12px 0;
        color: var(--foreground, inherit);
        font-family: inherit;
      }
      #${CARD_ID} .agy-dash-section-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        margin-bottom: 8px;
      }
      #${CARD_ID} .agy-dash-section-title {
        font-size: 13px;
        font-weight: 500;
        color: var(--foreground, inherit);
        opacity: 0.92;
      }
      #${CARD_ID} .agy-dash-status {
        font-size: 11px;
        color: var(--muted-foreground, inherit);
        opacity: 0.72;
      }
      #${CARD_ID} .agy-dash-box {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        padding: 12px 14px;
        border-radius: 8px;
        border: 1px solid var(--border, rgba(128, 128, 128, 0.22));
        background: var(--secondary, rgba(128, 128, 128, 0.05));
      }
      #${CARD_ID} .agy-dash-label {
        font-size: 13px;
        font-weight: 500;
        line-height: 1.35;
        color: var(--foreground, inherit);
      }
      #${CARD_ID} .agy-dash-desc {
        font-size: 12px;
        line-height: 1.4;
        color: var(--muted-foreground, inherit);
        opacity: 0.72;
        margin-top: 2px;
      }
      #${CARD_ID} .agy-switch-label {
        position: relative;
        display: inline-flex;
        align-items: center;
        cursor: pointer;
        flex: none;
      }
      #${CARD_ID} .agy-switch-input {
        position: absolute;
        opacity: 0;
        width: 0;
        height: 0;
      }
      #${CARD_ID} .agy-switch-track {
        position: relative;
        width: 34px;
        height: 19px;
        border-radius: 999px;
        background-color: rgba(128, 128, 128, 0.35);
        border: 1px solid rgba(128, 128, 128, 0.25);
        transition: background-color 150ms ease, border-color 150ms ease;
      }
      #${CARD_ID} .agy-switch-input:checked + .agy-switch-track {
        background-color: var(--primary, #007acc);
        border-color: var(--primary, #007acc);
      }
      #${CARD_ID} .agy-switch-thumb {
        position: absolute;
        top: 2px;
        left: 2px;
        width: 13px;
        height: 13px;
        border-radius: 50%;
        background: #ffffff;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.24);
        transition: transform 150ms ease;
      }
      #${CARD_ID} .agy-switch-input:checked + .agy-switch-track .agy-switch-thumb {
        transform: translateX(15px);
      }
    `;
    document.head.appendChild(style);
  }

  function getSettingsModal() {
    const dialogs = Array.from(document.querySelectorAll('[role="dialog"], .settings-modal, .antigravity-settings-modal'));
    return dialogs.find(d => {
      const style = window.getComputedStyle(d);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
      const t = d.textContent || '';
      return t.includes('Appearance') || t.includes('外观') || t.includes('Models & Usage') || t.includes('模型与用量') || t.includes('Settings') || t.includes('设置');
    }) || null;
  }

  async function refreshStatusText() {
    const el = document.getElementById('agy-dash-status-text');
    if (!el) return;
    const cfg = getConfig() || {};
    const zh = isZh(cfg);
    try {
      const res = await fetch(`http://127.0.0.1:${API_PORT}/api/dashboard/status`);
      if (!res.ok) throw new Error('status error');
      const data = await res.json();
      if (!data.enabled) {
        el.textContent = zh ? '已停用' : 'Disabled';
      } else if (data.state === 'mounted') {
        el.textContent = zh ? '运行中' : 'Running';
      } else if (data.state === 'waiting-for-composer') {
        el.textContent = zh ? '等待对话窗口' : 'Waiting for composer';
      } else {
        el.textContent = zh ? '未连接' : 'Offline';
      }
    } catch (_) {
      el.textContent = '';
    }
  }

  function injectIfReady() {
    const modal = getSettingsModal();
    if (!modal) {
      if (statusTimer) { clearInterval(statusTimer); statusTimer = null; }
      return;
    }
    const anchor = findModelsUsagePlanAnchor(modal);
    if (!anchor) return;
    if (document.getElementById(CARD_ID)) return;

    ensureStyles();
    const cfg = getConfig() || {};
    const zh = isZh(cfg);
    const dash = cfg.features?.dashboard || { enabled: true, inlineEnabled: true };
    const mainOn = dash.enabled !== false;

    const card = document.createElement('section');
    card.id = CARD_ID;
    card.innerHTML = `
      <div class="agy-dash-section-head">
        <span class="agy-dash-section-title">${zh ? '反重力看板' : 'Antigrative Dashboard'}</span>
        <span id="agy-dash-status-text" class="agy-dash-status"></span>
      </div>
      <div class="agy-dash-box">
        <div>
          <div class="agy-dash-label">${zh ? '开启反重力看板' : 'Enable Antigrative Dashboard'}</div>
          <div class="agy-dash-desc">${zh ? '在对话输入框旁与右侧扩展栏显示生成速率、缓存命中率、上下文占用与共享额度。' : 'Show throughput, cache hit rate, context usage and shared quota beside composer and in Extensions.'}</div>
        </div>
        <label class="agy-switch-label">
          <input type="checkbox" id="agy-opt-dashboard-enabled" class="agy-switch-input" ${mainOn ? 'checked' : ''}>
          <span class="agy-switch-track"><span class="agy-switch-thumb"></span></span>
        </label>
      </div>
    `;

    anchor.after(card);

    const mainInput = document.getElementById('agy-opt-dashboard-enabled');
    mainInput?.addEventListener('change', () => {
      const nextCfg = JSON.parse(JSON.stringify(getConfig() || {}));
      if (!nextCfg.features) nextCfg.features = {};
      const on = !!mainInput.checked;
      nextCfg.features.dashboard = {
        enabled: on,
        inlineEnabled: on
      };
      saveConfig(nextCfg);
      setTimeout(refreshStatusText, 450);
      setTimeout(refreshStatusText, 1400);
    });

    void refreshStatusText();
    if (statusTimer) clearInterval(statusTimer);
    statusTimer = setInterval(refreshStatusText, 2500);
  }

  if (typeof document !== 'undefined') {
    observer = new MutationObserver((mutations) => {
      const relevant = mutations.some(m => {
        const t = m.target;
        if (!t) return false;
        if (t.id === CARD_ID || t.id === 'ag-pulse-status-bar') return false;
        if (t.closest && (t.closest(`#${CARD_ID}`) || t.closest('#ag-pulse-status-bar'))) return false;
        return true;
      });
      if (relevant) injectIfReady();
    });
    observer.observe(document.body || document.documentElement, { childList: true, subtree: true });
    pollTimer = setInterval(injectIfReady, 1200);
    injectIfReady();
  }

  return {
    refresh: injectIfReady,
    destroy() {
      if (observer) observer.disconnect();
      if (pollTimer) clearInterval(pollTimer);
      if (statusTimer) clearInterval(statusTimer);
      document.getElementById(CARD_ID)?.remove();
    }
  };
}

if (typeof window !== 'undefined') {
  window.__agyInitDashboardSettings = initDashboardSettings;
  window.__agyFindModelsUsagePlanAnchor = findModelsUsagePlanAnchor;
}
