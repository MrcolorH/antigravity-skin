/**
 * dashboard-settings.js - Injects a native-styled Antigrative Dashboard toggle
 * right after Model Credits (before Gemini Models) under Settings -> Models & Usage.
 */

const CREDIT_TITLE_TARGETS = new Set([
  'model credits',
  '模型积分',
  'ai credits',
  'ai 积分'
]);

const PLAN_TITLE_TARGETS = new Set([
  'your plan',
  '您的套餐',
  '您的计划',
  '套餐详情',
  '套餐计划',
  'plan'
]);

function hasOtherSections(text, tier) {
  const lower = (text || '').toLowerCase();
  if (
    lower.includes('gemini models') ||
    lower.includes('gemini 模型') ||
    lower.includes('claude and gpt') ||
    lower.includes('claude 和 gpt') ||
    lower.includes('models & usage') ||
    lower.includes('模型与用量')
  ) {
    return true;
  }
  if (tier === 'credits') {
    return (
      lower.includes('your plan') ||
      lower.includes('您的套餐') ||
      lower.includes('您的计划') ||
      lower.includes('套餐计划') ||
      lower.includes('套餐详情')
    );
  }
  if (tier === 'plan') {
    return (
      lower.includes('model credits') ||
      lower.includes('模型积分') ||
      lower.includes('ai credits') ||
      lower.includes('ai 积分')
    );
  }
  return false;
}

function looksLikeCardEl(node) {
  if (!node) return false;
  const cls = String(node.className || '');
  if (
    cls.includes('rounded') ||
    cls.includes('border') ||
    cls.includes('card') ||
    cls.includes('bg-')
  ) {
    return true;
  }
  if (typeof node.querySelector === 'function') {
    return !!node.querySelector('[role="switch"], button, input[type="checkbox"]');
  }
  return false;
}

function resolveSectionFromHeading(modal, el, raw, tier) {
  // 1. Flat-sibling layout: heading (or small heading wrapper) followed directly by its card
  let headingBox = el;
  if (
    el.parentElement &&
    el.parentElement !== modal &&
    (el.parentElement.textContent || '').trim().toLowerCase() === raw &&
    !looksLikeCardEl(el.parentElement)
  ) {
    headingBox = el.parentElement;
  }

  const nextSib = headingBox.nextElementSibling;
  if (
    nextSib &&
    !hasOtherSections(nextSib.textContent || '', tier) &&
    looksLikeCardEl(nextSib) &&
    headingBox.parentElement &&
    hasOtherSections(headingBox.parentElement.textContent || '', tier)
  ) {
    return {
      anchor: nextSib,
      section: null,
      headingEl: el,
      headingRowEl: headingBox,
      cardEl: nextSib,
      tier
    };
  }

  // 2. Wrapped-section layout: walk up to the outermost container that stays within this single section
  let bestSection = null;
  let cur = el.parentElement;
  let depth = 0;
  while (cur && cur !== modal && depth < 6) {
    if (cur.closest?.('.bg-sidebar') || cur.querySelector?.('.bg-sidebar')) break;
    const curText = (cur.textContent || '').trim();
    if (hasOtherSections(curText, tier)) break;

    const hasCardContent =
      curText.length > raw.length ||
      !!cur.querySelector?.('[class*="rounded"], [class*="border"], [role="switch"], button');
    if (hasCardContent) {
      bestSection = cur;
    }
    cur = cur.parentElement;
    depth++;
  }

  if (!bestSection && el.parentElement && el.parentElement !== modal) {
    bestSection = el.parentElement;
  }
  if (!bestSection) return null;

  // Locate the inner card element inside bestSection
  let cardEl = null;
  if (typeof bestSection.querySelectorAll === 'function') {
    const candidates = Array.from(bestSection.querySelectorAll('div, section'));
    cardEl =
      candidates.find(
        (c) =>
          c !== el &&
          !c.contains?.(el) &&
          looksLikeCardEl(c)
      ) || null;
  }
  if (!cardEl && looksLikeCardEl(bestSection)) {
    cardEl = bestSection;
  }

  return {
    anchor: bestSection,
    section: bestSection,
    headingEl: el,
    headingRowEl: el.parentElement && el.parentElement !== bestSection ? el.parentElement : el,
    cardEl: cardEl || bestSection,
    tier
  };
}

export function findModelsUsageAnchorInfo(modal) {
  if (!modal) return null;
  const text = (modal.textContent || '').trim();
  const isModelsUsagePage =
    text.includes('Models & Usage') ||
    text.includes('模型与用量') ||
    ((text.includes('Quota') || text.includes('配额') || text.includes('额度')) &&
      (text.includes('Your Plan') ||
        text.includes('您的计划') ||
        text.includes('您的套餐') ||
        text.includes('套餐详情') ||
        text.includes('套餐计划') ||
        text.includes('Model Credits') ||
        text.includes('模型积分') ||
        text.includes('AI Credits') ||
        text.includes('AI 积分')));
  if (!isModelsUsagePage) return null;

  const headings = Array.from(modal.querySelectorAll('h1, h2, h3, h4, div, span, p'));
  const tiers = [
    { tier: 'credits', targets: CREDIT_TITLE_TARGETS },
    { tier: 'plan', targets: PLAN_TITLE_TARGETS }
  ];

  for (const { tier, targets } of tiers) {
    for (const el of headings) {
      if (el.closest?.('#agy-dashboard-settings-card') || el.closest?.('.bg-sidebar')) continue;
      const raw = (el.textContent || '').trim().toLowerCase();
      if (!targets.has(raw)) continue;

      // Prefer the deepest element holding this exact heading text
      const childMatch = Array.from(el.children || []).some(
        (ch) => (ch.textContent || '').trim().toLowerCase() === raw
      );
      if (childMatch) continue;

      const resolved = resolveSectionFromHeading(modal, el, raw, tier);
      if (resolved) return resolved;
    }
  }
  return null;
}

export function findModelsUsagePlanAnchor(modal) {
  return findModelsUsageAnchorInfo(modal)?.anchor || null;
}

function sanitizeClasses(cls) {
  return String(cls || '')
    .split(/\s+/)
    .filter((c) => c && !c.startsWith('agy-'))
    .join(' ');
}

function extractNativeTemplates(info) {
  const sectionClass =
    info.section && info.section !== info.cardEl ? sanitizeClasses(info.section.className) : '';
  const headingClass = sanitizeClasses(info.headingEl?.className);
  const rawCardClass = sanitizeClasses(info.cardEl?.className);
  const cardHasNativeStyle =
    rawCardClass.includes('rounded') || rawCardClass.includes('border') || rawCardClass.includes('bg-');
  const cardClass = cardHasNativeStyle ? rawCardClass : '';

  let rowClass = '';
  let titleClass = '';
  let descClass = '';

  const cardEl = info.cardEl;
  if (cardEl && typeof cardEl.querySelector === 'function') {
    const nativeSwitch = cardEl.querySelector('[role="switch"], button[aria-checked], input[type="checkbox"]');

    const cardIsFlexRow =
      cardClass.includes('flex') &&
      cardClass.includes('justify-between') &&
      !cardClass.includes('flex-col');
    if (!cardIsFlexRow) {
      const rowCandidate = Array.from(cardEl.querySelectorAll('div')).find((d) => {
        const c = String(d.className || '');
        return c.includes('flex') && c.includes('justify-between');
      });
      if (rowCandidate) rowClass = sanitizeClasses(rowCandidate.className);
    }

    const textEls = Array.from(cardEl.querySelectorAll('div, span, p')).filter((node) => {
      if (nativeSwitch && (node === nativeSwitch || nativeSwitch.contains(node))) return false;
      if (node.closest?.('button')) return false;
      if (node.children && node.children.length > 0) return false;
      return (node.textContent || '').trim().length > 0;
    });
    if (textEls[0]) titleClass = sanitizeClasses(textEls[0].className);
    if (textEls[1]) descClass = sanitizeClasses(textEls[1].className);
  }

  return {
    sectionClass,
    headingClass,
    cardClass,
    rowClass,
    titleClass,
    descClass
  };
}

export function initDashboardSettings(getConfig, saveConfig) {
  if (typeof window !== 'undefined' && window.__agyDashboardSettingsHandle && typeof window.__agyDashboardSettingsHandle.destroy === 'function') {
    try { window.__agyDashboardSettingsHandle.destroy(); } catch (_) {}
    window.__agyDashboardSettingsHandle = null;
  }
  const CARD_ID = 'agy-dashboard-settings-card';
  const API_PORT = (typeof window !== 'undefined' && window.__AG_SKIN_PORT__) || 59288;
  let statusTimer = null;
  let observer = null;
  let pollTimer = null;
  let domReadyHandler = null;

  function isZh(cfg) {
    return cfg?.features?.chineseLocalization !== false;
  }

  function ensureStyles() {
    if (typeof document === 'undefined') return;
    let style = document.getElementById('agy-dashboard-settings-style');
    if (!style) {
      style = document.createElement('style');
      style.id = 'agy-dashboard-settings-style';
      (document.head || document.documentElement || document.body)?.appendChild(style);
    }
    const nextCss = `
      #${CARD_ID} {
        color: var(--foreground, inherit);
        font-family: inherit;
      }
      #${CARD_ID}.agy-dash-section-standalone {
        margin-top: 24px;
      }
      #${CARD_ID} .agy-dash-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }
      #${CARD_ID} .agy-dash-head.agy-dash-head-gap {
        margin-bottom: 8px;
      }
      #${CARD_ID} .agy-dash-title-fallback {
        font-size: 13px;
        font-weight: 500;
        color: var(--foreground, inherit);
        opacity: 0.92;
      }
      #${CARD_ID} .agy-dash-status {
        font-size: 11px;
        color: var(--muted-foreground, inherit);
        opacity: 0.58;
        font-weight: 400;
      }
      #${CARD_ID} .agy-dash-box-fallback {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        padding: 12px 16px;
        border-radius: 8px;
        border: 1px solid var(--border, rgba(128, 128, 128, 0.22));
        background: var(--secondary, rgba(128, 128, 128, 0.05));
      }
      #${CARD_ID} .agy-dash-row-fallback {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        width: 100%;
      }
      #${CARD_ID} .agy-dash-text-col {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
        flex: 1;
      }
      #${CARD_ID} .agy-dash-label-fallback {
        font-size: 13px;
        font-weight: 500;
        line-height: 1.4;
        color: var(--foreground, inherit);
      }
      #${CARD_ID} .agy-dash-desc-fallback {
        font-size: 12px;
        line-height: 1.45;
        color: var(--muted-foreground, inherit);
        opacity: 0.72;
      }
      #${CARD_ID} .agy-dash-switch {
        box-sizing: border-box;
        position: relative;
        display: inline-flex;
        align-items: center;
        width: 36px;
        height: 20px;
        padding: 0;
        border-radius: 9999px;
        border: 2px solid transparent;
        background-color: rgba(128, 128, 128, 0.38);
        cursor: pointer;
        flex-shrink: 0;
        outline: none;
        transition: background-color 150ms cubic-bezier(0.4, 0, 0.2, 1);
      }
      #${CARD_ID} .agy-dash-switch[data-state="checked"],
      #${CARD_ID} .agy-dash-switch[aria-checked="true"] {
        background-color: #007acc;
      }
      #${CARD_ID} .agy-dash-switch-thumb {
        display: block;
        width: 16px;
        height: 16px;
        border-radius: 9999px;
        background-color: #ffffff;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.28);
        pointer-events: none;
        transform: translateX(0);
        transition: transform 150ms cubic-bezier(0.4, 0, 0.2, 1);
      }
      #${CARD_ID} .agy-dash-switch[data-state="checked"] .agy-dash-switch-thumb,
      #${CARD_ID} .agy-dash-switch[aria-checked="true"] .agy-dash-switch-thumb {
        transform: translateX(16px);
      }
    `;
    if (style.textContent !== nextCss) {
      style.textContent = nextCss;
    }
  }

  function getSettingsModal() {
    const dialogs = Array.from(document.querySelectorAll('[role="dialog"], .settings-modal, .antigravity-settings-modal'));
    return (
      dialogs.find((d) => {
        const style = window.getComputedStyle(d);
        if (style.display === 'none' || style.visibility === 'hidden') return false;
        const t = d.textContent || '';
        return (
          t.includes('Appearance') ||
          t.includes('外观') ||
          t.includes('Models & Usage') ||
          t.includes('模型与用量') ||
          t.includes('Settings') ||
          t.includes('设置')
        );
      }) || null
    );
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

  function syncSwitchState(btn, checked) {
    if (!btn) return;
    const state = checked ? 'checked' : 'unchecked';
    btn.setAttribute('aria-checked', checked ? 'true' : 'false');
    btn.setAttribute('data-state', state);
    const thumb = btn.querySelector('.agy-dash-switch-thumb, span');
    if (thumb) {
      thumb.setAttribute('data-state', state);
    }
  }

  function injectIfReady() {
    const modal = getSettingsModal();
    if (!modal) {
      if (statusTimer) {
        clearInterval(statusTimer);
        statusTimer = null;
      }
      return;
    }
    const info = findModelsUsageAnchorInfo(modal);
    if (!info || !info.anchor) return;

    const existing = document.getElementById(CARD_ID);
    if (existing) {
      // If Model Credits appeared asynchronously after Your Plan, recreate right after Model Credits with its native styles
      if (info.tier === 'credits' && (existing.dataset.agyTier !== 'credits' || existing.previousElementSibling !== info.anchor)) {
        existing.remove();
      } else {
        return;
      }
    }

    ensureStyles();
    const cfg = getConfig() || {};
    const zh = isZh(cfg);
    const dash = cfg.features?.dashboard || { enabled: true, inlineEnabled: true };
    const mainOn = dash.enabled !== false;
    const tpl = extractNativeTemplates(info);

    const card = document.createElement('section');
    card.id = CARD_ID;
    card.dataset.agyTier = info.tier;
    card.className = tpl.sectionClass
      ? `${tpl.sectionClass} agy-dash-section`
      : 'agy-dash-section agy-dash-section-standalone';

    const hasParentGap = /\b(gap-|space-y-)/.test(tpl.sectionClass);
    const headClass = hasParentGap ? 'agy-dash-head' : 'agy-dash-head agy-dash-head-gap';
    const headingCls = tpl.headingClass || 'agy-dash-title-fallback';
    const boxCls = tpl.cardClass || 'agy-dash-box-fallback';
    const titleCls = tpl.titleClass || 'agy-dash-label-fallback';
    const descCls = tpl.descClass || 'agy-dash-desc-fallback';
    const switchCls = 'agy-dash-switch';
    const thumbCls = 'agy-dash-switch-thumb';
    const stateStr = mainOn ? 'checked' : 'unchecked';

    const rowInnerHtml = `
      <div class="agy-dash-text-col">
        <div class="${titleCls}">${zh ? '开启反重力看板' : 'Enable Antigrative Dashboard'}</div>
        <div class="${descCls}">${
          zh
            ? '在对话输入框旁与右侧扩展栏显示生成速率、缓存命中率、上下文占用与共享额度。'
            : 'Show throughput, cache hit rate, context usage and shared quota beside composer and in Extensions.'
        }</div>
      </div>
      <button
        type="button"
        role="switch"
        id="agy-opt-dashboard-enabled"
        aria-checked="${mainOn ? 'true' : 'false'}"
        data-state="${stateStr}"
        class="${switchCls}"
      >
        <span data-state="${stateStr}" class="${thumbCls}"></span>
      </button>
    `;

    const boxBodyHtml =
      !tpl.cardClass ||
      (tpl.cardClass.includes('flex') && tpl.cardClass.includes('justify-between') && !tpl.cardClass.includes('flex-col'))
        ? rowInnerHtml
        : `<div class="${tpl.rowClass || 'agy-dash-row-fallback'}">${rowInnerHtml}</div>`;

    card.innerHTML = `
      <div class="${headClass}">
        <span class="${headingCls}">${zh ? '反重力看板' : 'Antigrative Dashboard'}</span>
        <span id="agy-dash-status-text" class="agy-dash-status"></span>
      </div>
      <div class="${boxCls}">
        ${boxBodyHtml}
      </div>
    `;

    info.anchor.after(card);

    const switchBtn = document.getElementById('agy-opt-dashboard-enabled');
    switchBtn?.addEventListener('click', () => {
      const nextOn = switchBtn.getAttribute('aria-checked') !== 'true';
      syncSwitchState(switchBtn, nextOn);
      const nextCfg = JSON.parse(JSON.stringify(getConfig() || {}));
      if (!nextCfg.features) nextCfg.features = {};
      nextCfg.features.dashboard = {
        enabled: nextOn,
        inlineEnabled: nextOn
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
      const relevant = mutations.some((m) => {
        const t = m.target;
        if (!t) return false;
        if (t.id === CARD_ID || t.id === 'ag-pulse-status-bar') return false;
        if (t.closest && (t.closest(`#${CARD_ID}`) || t.closest('#ag-pulse-status-bar'))) return false;
        return true;
      });
      if (relevant) injectIfReady();
    });
    const attachObserver = () => {
      const target = document.body || document.documentElement;
      if (target && observer) {
        try {
          observer.disconnect();
          observer.observe(target, { childList: true, subtree: true });
        } catch (_) {}
      }
    };
    attachObserver();
    if (!document.body && typeof document.addEventListener === 'function') {
      domReadyHandler = () => {
        attachObserver();
        injectIfReady();
      };
      document.addEventListener('DOMContentLoaded', domReadyHandler, { once: true });
    }
    pollTimer = setInterval(injectIfReady, 1200);
    injectIfReady();
  }

  return {
    refresh: injectIfReady,
    destroy() {
      if (observer) observer.disconnect();
      if (pollTimer) clearInterval(pollTimer);
      if (statusTimer) clearInterval(statusTimer);
      if (domReadyHandler && typeof document !== 'undefined' && typeof document.removeEventListener === 'function') {
        document.removeEventListener('DOMContentLoaded', domReadyHandler);
      }
      document.getElementById(CARD_ID)?.remove();
    }
  };
}

if (typeof window !== 'undefined') {
  window.__agyInitDashboardSettings = initDashboardSettings;
  window.__agyFindModelsUsagePlanAnchor = findModelsUsagePlanAnchor;
  window.__agyFindModelsUsageAnchorInfo = findModelsUsageAnchorInfo;
}
