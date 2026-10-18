/**
 * appearance-menu.js - Integrates Custom Skin Menu seamlessly into Antigravity Native Appearance Card
 * 
 * 1. 在原生“主题”胶囊行追加第4个选项：“✨ 自定义”；
 * 2. 在“主题”行正下方紧跟第二行：“界面语言 (Language)”；
 * 3. 原生系统/浅色/深色模式下：严格隐藏所有自定义视频与配置，彻底恢复官方原生黑白效果；
 * 4. 自定义主题模式下：隐藏原生的 Contrast 及原生配色卡片，展开自定义主题细项；
 * 5. 开机动画支持双素材模式：💻 自定义代码动效 vs 🎬 自定义短视频；
 * 6. 全面重构 Switch 控件为高对比度立体胶囊，解决浅色/深色背景下不明显的问题。
 */

export function initAppearanceMenu(getConfig, saveConfig, onConfigChange) {
  if (window.__agyCurrentMenuInstance && typeof window.__agyCurrentMenuInstance.destroy === 'function') {
    try { window.__agyCurrentMenuInstance.destroy(); } catch (e) {}
    window.__agyCurrentMenuInstance = null;
  }

  function cleanupLegacyPanels() {
    try {
      document.querySelectorAll('#agy-slot-custom-theme, #agy-skin-settings-panel, .bg-sidebar #agy-skin-settings-panel, .bg-sidebar [id^="agy-"]').forEach(el => el.remove());
    } catch (e) {}
  }

  function checkIsWindows() {
    if (typeof window !== 'undefined' && typeof window.__AGY_IS_WINDOWS__ === 'boolean') {
      return window.__AGY_IS_WINDOWS__;
    }
    if (typeof navigator !== 'undefined') {
      const ua = (navigator.userAgent || '').toLowerCase();
      const plat = (navigator.platform || '').toLowerCase();
      if (ua.includes('macintosh') || ua.includes('mac os x') || plat.includes('mac')) return false;
      if (ua.includes('windows') || ua.includes('win') || plat.includes('win')) return true;
    }
    return true;
  }

  function findAppearanceCard(modal) {
    if (!modal) return null;

    // 1. 优先通过“主题”按钮组定位核心外观卡片
    const allGroups = Array.from(modal.querySelectorAll('[role="group"]'));
    let themeBtnGroup = null;
    let themeRow = null;

    for (const group of allGroups) {
      if (group.closest('.bg-sidebar')) continue;
      const btns = Array.from(group.querySelectorAll('button'));
      const hasThemeBtn = btns.some(b => {
        const aria = (b.getAttribute('aria-label') || '').trim();
        const text = (b.textContent || '').trim();
        return aria === '系统' || aria === '浅色' || aria === '深色' ||
               aria === 'System' || aria === 'Light' || aria === 'Dark' ||
               text.includes('系统') || text.includes('浅色') || text.includes('深色') ||
               text.includes('System') || text.includes('Light') || text.includes('Dark');
      });

      if (hasThemeBtn) {
        themeBtnGroup = group;
        let row = group;
        const potentialCard = group.parentElement?.closest('div.border, div.rounded-xl, div.rounded-2xl, div[class*="border"]');
        if (potentialCard && !potentialCard.closest('.bg-sidebar')) {
          while (row && row.parentElement !== potentialCard) {
            row = row.parentElement;
          }
          if (row && row.parentElement === potentialCard) {
            themeRow = row;
            break;
          }
        }
      }
    }

    // 2. 兜底方案：通过“Contrast/对比度”文本定位卡片
    let card = themeRow?.parentElement;
    if (!card || card.closest('.bg-sidebar')) {
      const contrastSpan = Array.from(modal.querySelectorAll('*')).find(el => {
        if (el.children.length > 0) return false;
        const txt = (el.textContent || '').trim();
        return (txt === 'Contrast' || txt === '对比度') && !el.closest('.bg-sidebar');
      });
      if (contrastSpan) {
        card = contrastSpan.closest('div.border, div.rounded-xl, div.rounded-2xl, div[class*="border"]');
        if (card && !card.closest('.bg-sidebar')) {
          themeRow = Array.from(card.children).find(child => {
            if (child.id === 'agy-integrated-lang-row' || child.id === 'agy-integrated-custom-options' || child.id === 'agy-integrated-custom-switch-row') return false;
            const txt = child.textContent || '';
            return (txt.includes('主题') || txt.includes('Theme')) && child.querySelector('[role="group"]');
          });
        }
      }
    }

    if (!card || !themeRow) return null;

    // 对比度行（可选）
    let contrastRow = null;
    const contrastSpan = Array.from(card.querySelectorAll('*')).find(el => {
      if (el.children.length > 0) return false;
      const txt = (el.textContent || '').trim();
      return (txt === 'Contrast' || txt === '对比度');
    });
    if (contrastSpan) {
      let cr = contrastSpan;
      while (cr && cr.parentElement !== card) {
        cr = cr.parentElement;
      }
      contrastRow = cr;
    }

    return { card, themeRow, contrastRow };
  }

  function ensureSwitchStyle() {
    let style = document.getElementById('agy-switch-style');
    if (!style) {
      style = document.createElement('style');
      style.id = 'agy-switch-style';
      style.textContent = `
        .agy-switch-label {
          position: relative;
          display: inline-block;
          width: 42px;
          height: 22px;
          cursor: pointer;
          user-select: none;
        }
        .agy-switch-input {
          opacity: 0;
          width: 0;
          height: 0;
          position: absolute;
          margin: 0;
        }
        .agy-switch-track {
          position: absolute;
          inset: 0;
          background-color: #94a3b8;
          border-radius: 22px;
          transition: all .2s cubic-bezier(.4, 0, .2, 1);
          border: 1.5px solid #64748b;
          box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.2);
        }
        .agy-switch-thumb {
          position: absolute;
          content: '';
          height: 16px;
          width: 16px;
          left: 2.5px;
          top: 1.5px;
          background-color: #ffffff;
          border-radius: 50%;
          transition: all .2s cubic-bezier(.4, 0, .2, 1);
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.4);
        }
        .agy-switch-input:checked + .agy-switch-track {
          background-color: #007acc !important;
          border-color: #007acc !important;
        }
        .agy-switch-input:checked + .agy-switch-track .agy-switch-thumb {
          left: 21px !important;
        }
      `;
      const container = document.head || document.documentElement || document.body;
      if (container) {
        container.appendChild(style);
      } else {
        document.addEventListener('DOMContentLoaded', () => {
          const c = document.head || document.documentElement || document.body;
          if (c && !document.getElementById('agy-switch-style')) c.appendChild(style);
        }, { once: true });
      }
    }
  }

  // 高对比度 Switch 生成辅助函数（双保险：CSS 伪类 + 初始内联样式）
  function createSwitchHtml(id, checked) {
    ensureSwitchStyle();
    const isChecked = !!checked;
    return `
      <label class="agy-switch-label">
        <input type="checkbox" id="${id}" class="agy-switch-input" ${isChecked ? 'checked' : ''}>
        <span class="agy-switch-track" style="background-color: ${isChecked ? '#007acc' : '#94a3b8'}; border-color: ${isChecked ? '#007acc' : '#64748b'};">
          <span class="agy-switch-thumb" style="left: ${isChecked ? '21px' : '2.5px'};"></span>
        </span>
      </label>
    `;
  }

  function syncSwitchUI(checkbox) {
    if (!checkbox) return;
    const track = checkbox.parentElement?.querySelector('.agy-switch-track') || checkbox.nextElementSibling;
    if (!track) return;
    const thumb = track.querySelector('.agy-switch-thumb') || track.querySelector('span');
    const targetBg = checkbox.checked ? '#007acc' : '#94a3b8';
    const targetBorder = checkbox.checked ? '#007acc' : '#64748b';
    const targetLeft = checkbox.checked ? '21px' : '2.5px';
    if (track.style.backgroundColor !== targetBg) track.style.backgroundColor = targetBg;
    if (track.style.borderColor !== targetBorder) track.style.borderColor = targetBorder;
    if (thumb && thumb.style.left !== targetLeft) thumb.style.left = targetLeft;
  }

  // 高对比度现代化分段选择器（Segmented Control）交互样式体系
  function ensureSegmentedStyle() {
    let style = document.getElementById('agy-segmented-style');
    if (!style) {
      style = document.createElement('style');
      style.id = 'agy-segmented-style';
      style.textContent = `
        /* 外层胶囊轨道容器 */
        .agy-seg-group {
          display: inline-flex !important;
          align-items: center !important;
          background: rgba(0, 0, 0, 0.06) !important;
          border: 1px solid rgba(0, 0, 0, 0.09) !important;
          border-radius: 8px !important;
          padding: 2px !important;
          gap: 2.5px !important;
          user-select: none !important;
          box-sizing: border-box !important;
          box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.05) !important;
        }
        .theme-dark .agy-seg-group,
        .dark .agy-seg-group {
          background: rgba(255, 255, 255, 0.08) !important;
          border-color: rgba(255, 255, 255, 0.12) !important;
          box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.3) !important;
        }

        /* 基础选项按钮 */
        .agy-seg-btn {
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          border: 1.5px solid transparent !important;
          outline: none !important;
          cursor: pointer !important;
          user-select: none !important;
          border-radius: 6px !important;
          background: transparent !important;
          color: #64748b !important;
          font-weight: 500 !important;
          transition: all 0.16s cubic-bezier(0.4, 0, 0.2, 1) !important;
          white-space: nowrap !important;
          text-decoration: none !important;
          box-sizing: border-box !important;
          height: 100% !important;
        }
        .theme-dark .agy-seg-btn,
        .theme-standalone.theme-dark .agy-seg-btn,
        .dark .agy-seg-btn,
        [data-theme="dark"] .agy-seg-btn {
          color: #94a3b8 !important;
        }

        /* 悬停态（仅未激活项生效） */
        .agy-seg-btn:not(.active):hover {
          background: rgba(0, 0, 0, 0.06) !important;
          color: #0f172a !important;
        }
        .theme-dark .agy-seg-btn:not(.active):hover,
        .theme-standalone.theme-dark .agy-seg-btn:not(.active):hover,
        .dark .agy-seg-btn:not(.active):hover,
        [data-theme="dark"] .agy-seg-btn:not(.active):hover {
          background: rgba(255, 255, 255, 0.08) !important;
          color: #f8fafc !important;
        }

        /* 激活选中态（高对比度高亮科技蓝立体胶囊，纯白加粗，视觉焦点一眼即辨） */
        .agy-seg-btn.active,
        .agy-seg-btn[aria-pressed="true"],
        .agy-seg-btn[data-pressed],
        .theme-light .agy-seg-btn.active,
        .theme-standalone.theme-light .agy-seg-btn.active {
          background: #0284c7 !important;
          color: #ffffff !important;
          font-weight: 700 !important;
          border: 1.5px solid #0284c7 !important;
          box-shadow: 0 2px 8px rgba(2, 132, 199, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.25) !important;
        }
        .agy-seg-btn.active span,
        .agy-seg-btn[aria-pressed="true"] span,
        .agy-seg-btn[data-pressed] span {
          color: #ffffff !important;
        }
        .theme-dark .agy-seg-btn.active,
        .theme-standalone.theme-dark .agy-seg-btn.active,
        .theme-dark .agy-seg-btn[aria-pressed="true"],
        .theme-dark .agy-seg-btn[data-pressed],
        .dark .agy-seg-btn.active,
        .dark .agy-seg-btn[aria-pressed="true"],
        .dark .agy-seg-btn[data-pressed],
        [data-theme="dark"] .agy-seg-btn.active {
          background: #0284c7 !important;
          color: #ffffff !important;
          font-weight: 700 !important;
          border: 1.5px solid #38bdf8 !important;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.5), 0 0 12px rgba(56, 189, 248, 0.45) !important;
        }
      `;
      const container = document.head || document.documentElement || document.body;
      if (container) {
        container.appendChild(style);
      } else {
        document.addEventListener('DOMContentLoaded', () => {
          const c = document.head || document.documentElement || document.body;
          if (c && !document.getElementById('agy-segmented-style')) c.appendChild(style);
        }, { once: true });
      }
    }
  }

  function syncSegmentedState(group, activeBtn) {
    if (!group) return;
    const btns = Array.from(group.querySelectorAll('.agy-seg-btn, button'));
    btns.forEach(b => {
      const isActive = b === activeBtn;
      if (isActive) {
        if (!b.classList.contains('active')) b.classList.add('active');
        if (!b.hasAttribute('data-pressed')) b.setAttribute('data-pressed', '');
        if (b.getAttribute('aria-pressed') !== 'true') b.setAttribute('aria-pressed', 'true');
      } else {
        if (b.classList.contains('active')) b.classList.remove('active');
        if (b.hasAttribute('data-pressed')) b.removeAttribute('data-pressed');
        if (b.getAttribute('aria-pressed') !== 'false') b.setAttribute('aria-pressed', 'false');
      }
    });
  }

  let wasModalOpen = false;

  function getSettingsModal() {
    const modalByClass = document.querySelector('.settings-modal-container');
    if (modalByClass && document.body.contains(modalByClass)) return modalByClass;

    const dialogs = document.querySelectorAll('[role="dialog"]');
    for (const d of dialogs) {
      if (document.body.contains(d)) {
        if (d.classList.contains('settings-modal-container') || d.querySelector('.bg-sidebar, [role="group"]')) {
          return d;
        }
      }
    }
    return null;
  }


  // 核心规则：只有当用户彻底关闭设置弹窗后，才执行校验。若动态壁纸或开机短视频开关开着，但没有内容，才把开关关闭掉。
  // 在设置弹窗打开期间，绝不主动关闭用户的开关，保证用户能够从容载入素材！
  function validateAndAutoOffEmptyFeatures() {
    // 弹窗依然在 DOM 中时，坚决不关停！
    if (getSettingsModal()) return;

    const cfg = getConfig();
    if (!cfg || !cfg.features) return;
    let changed = false;

    // 1. 动态壁纸校验：开启但无视频素材 -> 自动关闭开关
    if (cfg.features.dynamicWallpaper?.enabled === true) {
      const vPath = (cfg.features.dynamicWallpaper.videoPath || '').trim();
      if (!vPath) {
        console.log('[Antigravity Skin] 关闭设置时校验：未配置壁纸素材，自动关闭全局动态视频壁纸开关');
        cfg.features.dynamicWallpaper.enabled = false;
        changed = true;
      }
    }

    // 2. 开机短视频校验：开启且形式为短视频，但无有效视频素材 -> 自动关闭开机动画开关
    if (cfg.features.bootAnimation === true) {
      const bCfg = cfg.features.bootAnimationConfig || {};
      const isVideo = bCfg.type === 'video';
      if (isVideo) {
        const vPath = (bCfg.videoPath || '').trim();
        if (!vPath) {
          console.log('[Antigravity Skin] 关闭设置时校验：未配置开机短视频素材，自动关闭开机引导动画开关');
          cfg.features.bootAnimation = false;
          changed = true;
        }
      }
    }

    if (changed) {
      saveConfig(cfg);
      if (typeof onConfigChange === 'function') {
        onConfigChange(cfg);
      }
    }
  }

  function integrateNativeMenu() {
    cleanupLegacyPanels();
    ensureSegmentedStyle();

    const modal = getSettingsModal();
    if (!modal) {
      if (wasModalOpen) {
        wasModalOpen = false;
        validateAndAutoOffEmptyFeatures();
      }
      return;
    }

    // 弹窗当前存在于 DOM 中
    wasModalOpen = true;

    const elements = findAppearanceCard(modal);
    if (!elements) {
      const dynamicLang = document.getElementById('agy-integrated-lang-row');
      if (dynamicLang) dynamicLang.remove();
      const dynamicCustomSwitch = document.getElementById('agy-integrated-custom-switch-row');
      if (dynamicCustomSwitch) dynamicCustomSwitch.remove();
      const dynamicCustom = document.getElementById('agy-integrated-custom-options');
      if (dynamicCustom) dynamicCustom.remove();
      const dynamicBtn = document.getElementById('agy-slot-custom-theme');
      if (dynamicBtn) dynamicBtn.remove();
      return;
    }

    const { card, themeRow, contrastRow } = elements;
    const themeBtnGroup = themeRow.querySelector('[role="group"]');
    if (!themeBtnGroup) return;

    // 清理可能遗留的旧版第4项自定义胶囊按钮，彻底归还原生主题按钮组
    const legacyCustomBtn = document.getElementById('agy-slot-custom-theme');
    if (legacyCustomBtn) legacyCustomBtn.remove();

    const config = getConfig();
    const f = config.features || {};
    const dw = f.dynamicWallpaper || {};
    const bootCfg = f.bootAnimationConfig || { type: 'video', customCodePath: '', videoPath: '' };
    const currentLang = f.language || (window.__agyI18n ? window.__agyI18n.getLanguage() : 'zh-CN');
    let isZh = currentLang !== 'en';
    let isCustomThemeEnabled = f.themeStyles !== false;
    const hasWallVal = !!(dw.videoPath && dw.videoPath.trim());
    const hasBootVal = !!(bootCfg.videoPath && bootCfg.videoPath.trim());

    function triggerSave() {
      const activeCfg = getConfig() || config;
      saveConfig(activeCfg);
      if (typeof onConfigChange === 'function') {
        try { onConfigChange(activeCfg); } catch (e) {}
      }
      if (typeof window.__agyApplyFeatures === 'function') {
        try { window.__agyApplyFeatures(activeCfg); } catch (e) {}
      }
    }

    // 1. 在主题行正下方插入“界面语言 (Language)”行
    let langRow = document.getElementById('agy-integrated-lang-row');
    if (langRow && !langRow.querySelector('#agy-group-lang')) {
      langRow.remove();
      langRow = null;
    }
    if (!langRow) {
      langRow = document.createElement('div');
      langRow.id = 'agy-integrated-lang-row';
      langRow.className = 'py-2 px-3 w-full bg-transparent flex justify-between gap-4 items-center';
      langRow.innerHTML = `
        <div class="flex-1 flex flex-col gap-0.5">
          <div class="flex items-center gap-1.5">
            <span class="text-sm font-normal">界面语言</span>
            <span class="text-xs text-muted-foreground opacity-60">Language</span>
          </div>
        </div>
        <div class="shrink-0">
          <div role="group" id="agy-group-lang" class="agy-seg-group select-none h-8">
            <button type="button" id="agy-lang-btn-zh" class="agy-seg-btn text-xs px-3 gap-1 ${isZh ? 'active' : ''}" ${isZh ? 'data-pressed="" aria-pressed="true"' : 'aria-pressed="false"'}>
              <span>🇨🇳 简体中文</span>
            </button>
            <button type="button" id="agy-lang-btn-en" class="agy-seg-btn text-xs px-3 gap-1 ${!isZh ? 'active' : ''}" ${!isZh ? 'data-pressed="" aria-pressed="true"' : 'aria-pressed="false"'}>
              <span>🇺🇸 English</span>
            </button>
          </div>
        </div>
      `;
      themeRow.insertAdjacentElement('afterend', langRow);
    } else if (langRow.previousElementSibling !== themeRow) {
      themeRow.insertAdjacentElement('afterend', langRow);
    }

    // 2. 在语言行正下方插入“自定义主题与动效增强”总开关行
    let customSwitchRow = document.getElementById('agy-integrated-custom-switch-row');
    if (customSwitchRow && !customSwitchRow.querySelector('#agy-opt-custom-theme')) {
      customSwitchRow.remove();
      customSwitchRow = null;
    }
    if (!customSwitchRow) {
      customSwitchRow = document.createElement('div');
      customSwitchRow.id = 'agy-integrated-custom-switch-row';
      customSwitchRow.className = 'py-2.5 px-3 w-full bg-transparent flex justify-between gap-4 items-center';
      customSwitchRow.innerHTML = `
        <div class="flex-1 flex flex-col gap-0.5">
          <div class="flex items-center gap-1.5">
            <span class="shrink-0 flex items-center text-amber-400">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
              </svg>
            </span>
            <span class="text-sm font-medium">自定义皮肤与动效增强</span>
          </div>
          <span class="text-xs text-muted-foreground opacity-65">开启后启用毛玻璃穿透、动态壁纸与自定义动效，原生浅色/深色均可自由搭配</span>
        </div>
        <div class="shrink-0">
          ${createSwitchHtml('agy-opt-custom-theme', isCustomThemeEnabled)}
        </div>
      `;
      langRow.insertAdjacentElement('afterend', customSwitchRow);
    } else if (customSwitchRow.previousElementSibling !== langRow) {
      langRow.insertAdjacentElement('afterend', customSwitchRow);
    }

    // 3. 插入自定义主题的配置项容器（紧跟在自定义总开关行正下方）
    const isWin = checkIsWindows();
    let customOptions = document.getElementById('agy-integrated-custom-options');
    if (customOptions && (!customOptions.querySelector('#agy-select-builtin-wallpaper') || !customOptions.querySelector('#agy-group-boot-type') || !customOptions.querySelector('#agy-wrap-boot-code-config') || !customOptions.querySelector('#agy-select-boot-code') || customOptions.querySelector('#agy-input-custom-code-path') || customOptions.querySelector('#agy-group-code-mode') || customOptions.querySelector('#agy-wrap-550c-source') || customOptions.querySelector('#agy-opt-crt') || !customOptions.querySelector('#agy-wrap-plugin-update') || (isWin && !customOptions.querySelector('#agy-btn-fix-boot-overlay')))) {
      customOptions.remove();
      customOptions = null;
    }
    if (!customOptions) {
      customOptions = document.createElement('div');
      customOptions.id = 'agy-integrated-custom-options';
      customOptions.className = 'divide-y divide-border bg-transparent';
      customOptions.style.display = isCustomThemeEnabled ? 'block' : 'none';
      customOptions.innerHTML = `
        <!-- 全局动态视频壁纸开关 -->
        <div class="py-2.5 px-3 w-full bg-transparent flex justify-between gap-4 items-center">
          <div class="flex-1 flex flex-col gap-0.5">
            <div class="flex items-center gap-1.5">
              <span class="text-sm font-medium">全局动态视频壁纸</span>
            </div>
            <span class="text-xs text-muted-foreground opacity-65">在底层循环播放流媒体壁纸（关闭时仅保留毛玻璃穿透）</span>
          </div>
          <div class="shrink-0">
            ${createSwitchHtml('agy-opt-wallpaper', dw.enabled === true)}
          </div>
        </div>

        <!-- 视频路径与内置预设选择配置 -->
        <div class="py-2.5 px-3 w-full bg-transparent flex flex-col gap-2 min-h-[96px] justify-center" id="agy-wrap-video-path" style="display: ${dw.enabled === true ? 'flex' : 'none'};">
          <!-- 真实内容容器（直接静态展示，绝不抖动或抽风） -->
          <div id="agy-wallpaper-content" style="display: flex; flex-direction: column; gap: 8px; width: 100%;">
            <!-- 选择动态壁纸下拉框与删除按钮 -->
            <div class="flex justify-between items-center gap-3">
              <div class="flex flex-col gap-0.5">
                <span class="text-xs font-medium opacity-85 shrink-0">选择动态壁纸</span>
                <span class="text-[11px] text-muted-foreground opacity-60">选择已载入的壁纸或导入新素材</span>
              </div>
              <div class="flex items-center gap-1.5 shrink-0">
                <select id="agy-select-builtin-wallpaper" class="text-xs px-2.5 py-1 rounded-md border border-border bg-secondary/30 text-foreground outline-none cursor-pointer max-w-[210px] truncate">
                  <option value="">(素材库为空，请点击下方载入视频)</option>
                </select>
                <button type="button" id="agy-btn-delete-wallpaper" title="${hasWallVal ? '彻底从插件素材库中删除该素材' : '当前未选择任何视频素材'}" ${hasWallVal ? '' : 'disabled'} class="text-xs p-1.5 rounded border border-rose-500/30 text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                  </svg>
                </button>
              </div>
            </div>

            <!-- 载入新视频壁纸交互行 -->
            <div class="flex items-center justify-between pt-1.5 border-t border-border/40">
              <span class="text-[11px] text-muted-foreground opacity-75" id="agy-wallpaper-upload-tip">
                支持 MP4/WebM，直接导入插件素材库
              </span>
              <div class="flex items-center gap-2">
                <input type="file" id="agy-file-wallpaper" accept="video/mp4,video/webm,video/mov,video/mkv" style="display: none;">
                <button type="button" id="agy-btn-pick-video" class="text-xs px-2.5 py-1 rounded border border-sky-500/40 text-sky-400 bg-sky-500/10 hover:bg-sky-500/20 cursor-pointer flex items-center gap-1 font-medium">
                  <span>📂 载入新视频壁纸</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- 亮度与对比度 -->
        <div class="py-2 px-3 w-full bg-transparent grid grid-cols-2 gap-4" id="agy-wrap-sliders" style="display: ${dw.enabled === true ? 'grid' : 'none'};">
          <div class="flex flex-col gap-1">
            <div class="flex justify-between text-xs">
              <span class="opacity-75">壁纸亮度 (Brightness)</span>
              <span id="agy-val-brightness" class="font-mono">${dw.brightness || 0.85}</span>
            </div>
            <input type="range" id="agy-slider-brightness" min="0.2" max="1.5" step="0.05" value="${dw.brightness || 0.85}" class="w-full cursor-pointer accent-sky-500">
          </div>
          <div class="flex flex-col gap-1">
            <div class="flex justify-between text-xs">
              <span class="opacity-75">壁纸对比度 (Contrast)</span>
              <span id="agy-val-contrast" class="font-mono">${dw.contrast || 1.05}</span>
            </div>
            <input type="range" id="agy-slider-contrast" min="0.5" max="1.5" step="0.05" value="${dw.contrast || 1.05}" class="w-full cursor-pointer accent-sky-500">
          </div>
        </div>

        <!-- 开机引导动画行 -->
        <div class="py-2.5 px-3 w-full bg-transparent flex justify-between gap-4 items-center">
          <div class="flex-1 flex flex-col gap-0.5">
            <div class="flex items-center gap-1.5">
              <span class="text-sm font-medium">开机引导动画 (Boot Animation)</span>
              <button type="button" id="agy-btn-preview-boot" class="text-xs px-2 py-0.5 rounded border border-sky-500/40 text-sky-400 bg-sky-500/10 hover:bg-sky-500/20 cursor-pointer">▶️ 立即预览</button>
            </div>
            <span class="text-xs text-muted-foreground opacity-65">客户端启动时呈现引导动效，按 ESC 随时跳过</span>
          </div>
          <div class="shrink-0">
            ${createSwitchHtml('agy-opt-boot', !!f.bootAnimation)}
          </div>
        </div>

        <!-- 开机动画素材形式及参数配置子区域 -->
        <div class="py-2.5 px-3 w-full bg-transparent flex flex-col gap-2.5" id="agy-wrap-boot-config" style="display: ${f.bootAnimation ? 'flex' : 'none'}; background: rgba(0,0,0,0.08); border-radius: 8px; margin: 4px 0 8px 0;">
          <div class="flex justify-between items-center">
            <div>
              <span class="text-xs font-medium">动画素材形式 (Source Type)</span>
              <div class="text-[11px] opacity-65 mt-0.5" id="agy-boot-type-desc">
                ${bootCfg.type === 'video' ? '🎬 播放本地短视频文件（全屏沉浸播放，播放完毕或按 ESC 跳过）' : '💻 执行动态脚本代码渲染开机引导动效'}
              </div>
            </div>
            <div role="group" id="agy-group-boot-type" class="agy-seg-group select-none h-7">
              <button type="button" id="agy-boot-type-code" class="agy-seg-btn text-xs px-2.5 gap-1 ${bootCfg.type !== 'video' ? 'active' : ''}" ${bootCfg.type !== 'video' ? 'data-pressed="" aria-pressed="true"' : 'aria-pressed="false"'}>
                <span>💻 代码动效</span>
              </button>
              <button type="button" id="agy-boot-type-video" class="agy-seg-btn text-xs px-2.5 gap-1 ${bootCfg.type === 'video' ? 'active' : ''}" ${bootCfg.type === 'video' ? 'data-pressed="" aria-pressed="true"' : 'aria-pressed="false"'}>
                <span>🎬 自定义短视频</span>
              </button>
            </div>
          </div>

          <!-- 开机短视频素材配置（仅在选自定义短视频时展示） -->
          <div class="flex flex-col gap-2 pt-1.5 border-t border-border/40 min-h-[96px] justify-center" id="agy-wrap-boot-video-path" style="display: ${bootCfg.type === 'video' ? 'flex' : 'none'};">
            <!-- 真实内容容器（直接静态展示，绝不抖动或抽风） -->
            <div id="agy-boot-video-content" style="display: flex; flex-direction: column; gap: 8px; width: 100%;">
              <!-- 选择开机短视频下拉框与删除按钮 -->
              <div class="flex justify-between items-center gap-3">
                <div class="flex flex-col gap-0.5">
                  <span class="text-xs font-medium opacity-85 shrink-0">选择开机短视频</span>
                  <span class="text-[11px] text-muted-foreground opacity-60">选择已载入的开机短视频或导入新素材</span>
                </div>
                <div class="flex items-center gap-1.5 shrink-0">
                  <select id="agy-select-boot-video" class="text-xs px-2.5 py-1 rounded-md border border-border bg-secondary/30 text-foreground outline-none cursor-pointer max-w-[210px] truncate">
                    <option value="">(素材库为空，请点击下方载入视频)</option>
                  </select>
                  <button type="button" id="agy-btn-delete-boot-video" title="${hasBootVal ? '彻底从插件素材库中删除该素材' : '当前未选择任何视频素材'}" ${hasBootVal ? '' : 'disabled'} class="text-xs p-1.5 rounded border border-rose-500/30 text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                    </svg>
                  </button>
                </div>
              </div>

              <!-- 载入新开机短视频交互行 -->
              <div class="flex items-center justify-between pt-1.5 border-t border-border/40">
                <span class="text-[11px] text-muted-foreground opacity-75" id="agy-boot-video-upload-tip">
                  支持 MP4/WebM，直接导入插件素材库
                </span>
                <div class="flex items-center gap-2">
                  <input type="file" id="agy-file-boot-video" accept="video/mp4,video/webm,video/mov,video/mkv" style="display: none;">
                  <button type="button" id="agy-btn-pick-boot-video" class="text-xs px-2.5 py-1 rounded border border-sky-500/40 text-sky-400 bg-sky-500/10 hover:bg-sky-500/20 cursor-pointer flex items-center gap-1 font-medium">
                    <span>📂 载入新开机视频</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- 代码动效配置区（仅在选中代码动效时展示） -->
          <div class="flex flex-col gap-2 pt-1.5 border-t border-border/40 min-h-[96px] justify-center" id="agy-wrap-boot-code-config" style="display: ${bootCfg.type !== 'video' ? 'flex' : 'none'};">
            <!-- 真实内容容器（直接静态展示，绝不抖动或抽风） -->
            <div id="agy-boot-code-content" style="display: flex; flex-direction: column; gap: 8px; width: 100%;">
              <!-- 选择代码动效下拉框与删除按钮 -->
              <div class="flex justify-between items-center gap-3">
                <div class="flex flex-col gap-0.5">
                  <span class="text-xs font-medium opacity-85 shrink-0">选择代码动效方案</span>
                  <span class="text-[11px] text-muted-foreground opacity-60">选择已载入的动效脚本或导入新方案</span>
                </div>
                <div class="flex items-center gap-1.5 shrink-0">
                  <select id="agy-select-boot-code" class="text-xs px-2.5 py-1 rounded-md border border-border bg-secondary/30 text-foreground outline-none cursor-pointer max-w-[210px] truncate">
                    <option value="assets/scripts/default-boot.js">🌟 默认极客科技动效 (default-boot.js)</option>
                  </select>
                  <button type="button" id="agy-btn-delete-boot-code" title="默认动效方案受系统保护，不可删除" disabled class="text-xs p-1.5 rounded border border-rose-500/30 text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                    </svg>
                  </button>
                </div>
              </div>

              <!-- 载入新动效脚本交互行 -->
              <div class="flex items-center justify-between pt-1.5 border-t border-border/40">
                <span class="text-[11px] text-muted-foreground opacity-75" id="agy-boot-code-upload-tip">
                  支持 JS 动效脚本，直接导入插件动效库
                </span>
                <div class="flex items-center gap-2">
                  <input type="file" id="agy-file-boot-code" accept=".js,application/javascript,text/javascript" style="display: none;">
                  <button type="button" id="agy-btn-pick-boot-code" class="text-xs px-2.5 py-1 rounded border border-sky-500/40 text-sky-400 bg-sky-500/10 hover:bg-sky-500/20 cursor-pointer flex items-center gap-1 font-medium">
                    <span>📂 载入新动效脚本</span>
                  </button>
                </div>
              </div>

              <!-- 提示说明 -->
              <div class="text-[11px] text-muted-foreground opacity-65 pt-1">
                💡 支持任意 Canvas / WebGL / DOM 渲染脚本，可直接执行或导出 <code>window.__customBootAnimation(container, close)</code>。按 ESC 随时跳过。
              </div>
            </div>
          </div>

          <!-- Windows 平台专属：客户端更新后一键修复补丁入口 -->
          ${isWin ? `
          <div class="flex items-center justify-between pt-2 border-t border-border/40 mt-1" id="agy-wrap-win-patch" style="display: flex;">
            <div class="flex flex-col gap-0.5">
              <div class="flex items-center gap-1.5">
                <span class="text-xs font-medium text-amber-400 flex items-center gap-1">
                  <span>🛠️ 开机动效引擎修复</span>
                </span>
                <span class="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono">Win 专属</span>
              </div>
              <span class="text-[11px] text-muted-foreground opacity-75" id="agy-win-patch-tip">
                客户端版本更新后开机动效失效？点击一键重新合入补丁（将自动重启客户端生效）
              </span>
            </div>
            <button type="button" id="agy-btn-fix-boot-overlay" class="text-xs px-2.5 py-1 rounded border border-amber-500/40 text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 cursor-pointer flex items-center gap-1 font-medium shrink-0">
              <span>⚡ 一键修复</span>
            </button>
          </div>
          ` : ''}
        </div>

        <!-- 插件版本与在线热更新入口 (跨平台：macOS / Windows 统一支持) -->
        <div class="py-2.5 px-3 w-full bg-transparent flex flex-col gap-2 pt-2.5 border-t border-border/40 mt-1" id="agy-wrap-plugin-update">
          <div class="flex justify-between items-center gap-3">
            <div class="flex flex-col gap-0.5">
              <div class="flex items-center gap-1.5 flex-wrap">
                <span class="text-xs font-medium text-foreground flex items-center gap-1">
                  <span>⚡ 插件版本与在线热更新</span>
                </span>
                <span id="agy-update-cur-ver" class="text-[10px] px-1.5 py-0.2 rounded bg-sky-500/15 text-sky-400 border border-sky-500/30 font-mono font-medium">v0.0.5</span>
                <span id="agy-update-badge" style="display: none;" class="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-medium items-center gap-0.5">
                  <span>✨ 发现新版本</span>
                </span>
              </div>
              <span class="text-[11px] text-muted-foreground opacity-75" id="agy-update-status-tip">
                点击检查 GitHub Release 最新版本，免手动下载与安装，支持一键无感热生效
              </span>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <button type="button" id="agy-btn-check-update" class="text-xs px-2.5 py-1 rounded border border-border bg-secondary/30 hover:bg-secondary/60 text-foreground cursor-pointer flex items-center gap-1 font-medium transition-colors">
                <span>🔄 检查更新</span>
              </button>
              <button type="button" id="agy-btn-apply-update" style="display: none;" class="text-xs px-2.5 py-1 rounded border border-emerald-500/40 text-emerald-300 bg-emerald-500/20 hover:bg-emerald-500/30 cursor-pointer flex items-center gap-1 font-medium transition-colors">
                <span>🚀 立即热更新</span>
              </button>
            </div>
          </div>

          <!-- 新版本更新日志抽屉 (有更新时展示) -->
          <div id="agy-update-changelog-box" style="display: none; background: rgba(0,0,0,0.12); border-radius: 6px; padding: 8px 10px; margin-top: 2px;" class="border border-border/40 text-xs flex-col gap-1.5">
            <div class="flex justify-between items-center text-[11px] font-medium text-emerald-400 border-b border-border/30 pb-1">
              <span id="agy-update-changelog-title">🎉 发现新版本</span>
              <span id="agy-update-changelog-date" class="opacity-60 text-muted-foreground font-mono"></span>
            </div>
            <div id="agy-update-changelog-content" class="text-[11px] text-muted-foreground whitespace-pre-wrap max-h-24 overflow-y-auto leading-relaxed pt-1 select-text"></div>
          </div>
        </div>
      `;
      customSwitchRow.insertAdjacentElement('afterend', customOptions);
    } else if (customOptions.previousElementSibling !== customSwitchRow) {
      customSwitchRow.insertAdjacentElement('afterend', customOptions);
    }

    // 强力兜底保障：无论何时运行 integrateNativeMenu，customOptions 的展示状态必须与 isCustomThemeEnabled 严格一致
    if (customOptions) {
      const targetDisplay = isCustomThemeEnabled ? 'block' : 'none';
      if (customOptions.style.display !== targetDisplay) {
        customOptions.style.display = targetDisplay;
      }
    }

    // 4. 自定义主题总开关事件绑定与初始同步
    const optCustomTheme = customSwitchRow.querySelector('#agy-opt-custom-theme');
    if (optCustomTheme) {
      optCustomTheme.checked = isCustomThemeEnabled;
      syncSwitchUI(optCustomTheme);
      optCustomTheme.onchange = () => {
        syncSwitchUI(optCustomTheme);
        const isEnabled = optCustomTheme.checked;
        isCustomThemeEnabled = isEnabled;
        if (customOptions) {
          const td = isEnabled ? 'block' : 'none';
          if (customOptions.style.display !== td) customOptions.style.display = td;
        }
        const activeCfg = getConfig() || config;
        if (!activeCfg.features) activeCfg.features = {};
        activeCfg.features.themeStyles = isEnabled;
        config.features.themeStyles = isEnabled;
        triggerSave();
      };
    }

    // 6. 语言切换
    const langGroup = langRow.querySelector('#agy-group-lang') || langRow.querySelector('[role="group"]');
    const langBtnZh = langRow.querySelector('#agy-lang-btn-zh');
    const langBtnEn = langRow.querySelector('#agy-lang-btn-en');

    function syncLangUI(zhActive) {
      syncSegmentedState(langGroup, zhActive ? langBtnZh : langBtnEn);
    }

    syncLangUI(isZh);

    // 状态更新与素材/动效列表同步核心函数（提升至作用域顶部，确保首次与所有幂等巡检均可同步）
    function updateDeleteBtnState(selectEl, btnEl, expectedScope = 'wallpaper') {
      if (!selectEl || !btnEl) return;
      const currentVal = selectEl.value;
      const hasVal = !!currentVal && currentVal !== '';
      if (!hasVal) {
        btnEl.disabled = true;
        btnEl.setAttribute('title', '当前未选择任何视频素材');
        return;
      }
      if (expectedScope === 'wallpaper' && currentVal.startsWith('assets/videos/boot/')) {
        btnEl.disabled = true;
        btnEl.setAttribute('title', '此素材属于开机视频库，请在下方开机引导动画中管理删除');
        return;
      }
      if (expectedScope === 'boot' && currentVal.startsWith('assets/videos/wallpaper/')) {
        btnEl.disabled = true;
        btnEl.setAttribute('title', '此素材属于动态壁纸库，请在上方动态壁纸中管理删除');
        return;
      }
      btnEl.disabled = false;
      btnEl.setAttribute('title', '彻底从当前素材库中删除该素材');
    }

    function updateDeleteScriptBtnState(selectEl, btnEl) {
      if (!selectEl || !btnEl) return;
      const currentVal = selectEl.value;
      const isDefault = !currentVal || currentVal === 'assets/scripts/default-boot.js' || currentVal.endsWith('/default-boot.js');
      btnEl.disabled = isDefault;
      if (isDefault) {
        btnEl.setAttribute('title', '默认动效方案受系统保护，不可删除');
      } else {
        btnEl.setAttribute('title', '彻底从插件动效库中删除该脚本方案');
      }
    }

    let isSyncingWallpaperVideos = false;
    async function syncWallpaperVideos(forceSelectedPath = '') {
      if (isSyncingWallpaperVideos) return;
      isSyncingWallpaperVideos = true;

      try {
        const res = await fetch(`http://127.0.0.1:${window.__AG_SKIN_PORT__ || 59288}/api/wallpaper/list`);
        const data = await res.json();
        if (data.ok && Array.isArray(data.videos)) {
          let currentWallPath = config.features?.dynamicWallpaper?.videoPath || '';

          if (forceSelectedPath) {
            currentWallPath = forceSelectedPath;
            if (!config.features.dynamicWallpaper) config.features.dynamicWallpaper = {};
            config.features.dynamicWallpaper.videoPath = forceSelectedPath;
          }

          const curSelectWall = document.getElementById('agy-select-builtin-wallpaper');
          const curBtnDelWall = document.getElementById('agy-btn-delete-wallpaper');

          if (curSelectWall) {
            curSelectWall.innerHTML = '';
            const wallVideos = data.videos || [];
            const crossVideos = data.crossVideos || [];

            if (wallVideos.length === 0 && crossVideos.length === 0) {
              const emptyOpt = document.createElement('option');
              emptyOpt.value = '';
              emptyOpt.textContent = '(壁纸素材库为空，请点击下方载入视频)';
              curSelectWall.appendChild(emptyOpt);
            } else {
              let matched = false;

              // 1. 壁纸专属素材库分组
              if (wallVideos.length > 0) {
                const groupWall = document.createElement('optgroup');
                groupWall.label = '── 动态壁纸素材库 ──';
                wallVideos.forEach(v => {
                  const opt = document.createElement('option');
                  opt.value = v.relPath;
                  opt.textContent = v.displayName;
                  if (currentWallPath && (currentWallPath === v.relPath || currentWallPath.endsWith('/' + v.name))) {
                    opt.selected = true;
                    matched = true;
                  }
                  groupWall.appendChild(opt);
                });
                curSelectWall.appendChild(groupWall);
              }

              // 2. 跨库复用：开机视频素材库（支持同一个视频自由共享，绝不独占）
              if (crossVideos.length > 0) {
                const groupCross = document.createElement('optgroup');
                groupCross.label = '── 可复用开机素材库 ──';
                crossVideos.forEach(v => {
                  const opt = document.createElement('option');
                  opt.value = v.relPath;
                  opt.textContent = `🎬 [开机库] ${v.name}`;
                  if (currentWallPath && (currentWallPath === v.relPath || currentWallPath.endsWith('/' + v.name))) {
                    opt.selected = true;
                    matched = true;
                  }
                  groupCross.appendChild(opt);
                });
                curSelectWall.appendChild(groupCross);
              }

              // 3. 外部绝对路径
              if (!matched && currentWallPath && !currentWallPath.startsWith('assets/videos/')) {
                const extOpt = document.createElement('option');
                extOpt.value = currentWallPath;
                const fileName = currentWallPath.split(/[\/\\]/).pop();
                extOpt.textContent = `📁 外部素材: ${fileName}`;
                extOpt.selected = true;
                curSelectWall.appendChild(extOpt);
                matched = true;
              }
            }

            if (currentWallPath) curSelectWall.value = currentWallPath;
            updateDeleteBtnState(curSelectWall, curBtnDelWall, 'wallpaper');
          }
        }
      } catch (err) {
        console.warn('[Skin Menu] Failed to load wallpaper list:', err);
      } finally {
        isSyncingWallpaperVideos = false;
      }
    }

    let isSyncingBootVideos = false;
    async function syncBootVideos(forceSelectedPath = '') {
      if (isSyncingBootVideos) return;
      isSyncingBootVideos = true;

      try {
        let res = await fetch(`http://127.0.0.1:${window.__AG_SKIN_PORT__ || 59288}/api/boot-video/list`);
        if (!res.ok && res.status === 404) {
          res = await fetch(`http://127.0.0.1:${window.__AG_SKIN_PORT__ || 59288}/api/wallpaper/list`);
        }
        let data = {};
        try {
          data = await res.json();
        } catch (_) {}
        if (data.ok && Array.isArray(data.videos)) {
          let currentBootPath = config.features?.bootAnimationConfig?.videoPath || '';

          if (forceSelectedPath) {
            currentBootPath = forceSelectedPath;
            if (!config.features.bootAnimationConfig) config.features.bootAnimationConfig = {};
            config.features.bootAnimationConfig.videoPath = forceSelectedPath;
          }

          const curSelectBoot = document.getElementById('agy-select-boot-video');
          const curBtnDelBoot = document.getElementById('agy-btn-delete-boot-video');

          if (curSelectBoot) {
            curSelectBoot.innerHTML = '';
            const bootVideos = data.videos || [];
            const crossVideos = data.crossVideos || [];

            if (bootVideos.length === 0 && crossVideos.length === 0) {
              const emptyOpt = document.createElement('option');
              emptyOpt.value = '';
              emptyOpt.textContent = '(开机视频库为空，请点击下方载入视频)';
              curSelectBoot.appendChild(emptyOpt);
            } else {
              let matched = false;

              // 1. 开机短视频专属素材库分组
              if (bootVideos.length > 0) {
                const groupBoot = document.createElement('optgroup');
                groupBoot.label = '── 开机短视频素材库 ──';
                bootVideos.forEach(v => {
                  const opt = document.createElement('option');
                  opt.value = v.relPath;
                  opt.textContent = v.displayName;
                  if (currentBootPath && (currentBootPath === v.relPath || currentBootPath.endsWith('/' + v.name))) {
                    opt.selected = true;
                    matched = true;
                  }
                  groupBoot.appendChild(opt);
                });
                curSelectBoot.appendChild(groupBoot);
              }

              // 2. 跨库复用：动态壁纸素材库（支持同一个视频自由共享，绝不独占）
              if (crossVideos.length > 0) {
                const groupCross = document.createElement('optgroup');
                groupCross.label = '── 可复用壁纸素材库 ──';
                crossVideos.forEach(v => {
                  const opt = document.createElement('option');
                  opt.value = v.relPath;
                  opt.textContent = `🎬 [壁纸库] ${v.name}`;
                  if (currentBootPath && (currentBootPath === v.relPath || currentBootPath.endsWith('/' + v.name))) {
                    opt.selected = true;
                    matched = true;
                  }
                  groupCross.appendChild(opt);
                });
                curSelectBoot.appendChild(groupCross);
              }

              // 3. 外部绝对路径
              if (!matched && currentBootPath && !currentBootPath.startsWith('assets/videos/')) {
                const extOpt = document.createElement('option');
                extOpt.value = currentBootPath;
                const fileName = currentBootPath.split(/[\/\\]/).pop();
                extOpt.textContent = `📁 外部素材: ${fileName}`;
                extOpt.selected = true;
                curSelectBoot.appendChild(extOpt);
                matched = true;
              }
            }

            if (currentBootPath) curSelectBoot.value = currentBootPath;
            updateDeleteBtnState(curSelectBoot, curBtnDelBoot, 'boot');
          }
        }
      } catch (err) {
        console.warn('[Skin Menu] Failed to load boot video list:', err);
      } finally {
        isSyncingBootVideos = false;
      }
    }

    async function syncWallpapers(forceSelectedPath = '', targetScope = 'all') {
      if (targetScope === 'wallpaper') {
        await syncWallpaperVideos(forceSelectedPath);
        await syncBootVideos();
      } else if (targetScope === 'boot') {
        await syncBootVideos(forceSelectedPath);
        await syncWallpaperVideos();
      } else {
        await Promise.all([syncWallpaperVideos(forceSelectedPath), syncBootVideos(forceSelectedPath)]);
      }
    }

    let isSyncingBootScripts = false;
    async function syncBootScripts(forceSelectedPath = '') {
      if (isSyncingBootScripts) return;
      isSyncingBootScripts = true;

      try {
        const res = await fetch(`http://127.0.0.1:${window.__AG_SKIN_PORT__ || 59288}/api/boot-script/list`);
        const data = await res.json();
        if (data.ok && Array.isArray(data.scripts)) {
          let currentCodePath = forceSelectedPath || config.features?.bootAnimationConfig?.customCodePath || 'assets/scripts/default-boot.js';
          if (forceSelectedPath) {
            if (!config.features.bootAnimationConfig) config.features.bootAnimationConfig = {};
            config.features.bootAnimationConfig.customCodePath = forceSelectedPath;
          }

          const curSelectCode = document.getElementById('agy-select-boot-code');
          const curBtnDelCode = document.getElementById('agy-btn-delete-boot-code');

          if (curSelectCode) {
            curSelectCode.innerHTML = '';
            let matchedCode = false;
            data.scripts.forEach(s => {
              const opt = document.createElement('option');
              opt.value = s.relPath;
              opt.textContent = s.displayName;
              if (currentCodePath === s.relPath || currentCodePath.endsWith(s.name)) {
                opt.selected = true;
                matchedCode = true;
              }
              curSelectCode.appendChild(opt);
            });
            if (!matchedCode && currentCodePath && !currentCodePath.startsWith('assets/scripts/')) {
              const extOpt = document.createElement('option');
              extOpt.value = currentCodePath;
              const fileName = currentCodePath.split(/[\/\\]/).pop();
              extOpt.textContent = `📁 外部动效: ${fileName}`;
              extOpt.selected = true;
              curSelectCode.appendChild(extOpt);
            }
            if (currentCodePath) curSelectCode.value = currentCodePath;
            updateDeleteScriptBtnState(curSelectCode, curBtnDelCode);
          }
        }
      } catch (err) {
        console.warn('[Skin Menu] Failed to load boot scripts list:', err);
      } finally {
        isSyncingBootScripts = false;
      }
    }

    // 关键防抖幂等保护：如果自定义配置卡片已完整挂载且就绪，重新同步一次状态后跳过后续多余的重复事件绑定
    if (customOptions && customOptions.dataset.agyReady === 'true') {
      // 同步动态壁纸开关及展开区域状态
      const optW = customOptions.querySelector('#agy-opt-wallpaper');
      const wrapV = customOptions.querySelector('#agy-wrap-video-path');
      const wrapS = customOptions.querySelector('#agy-wrap-sliders');
      const isWallOn = dw.enabled === true;
      if (optW && optW.checked !== isWallOn) {
        optW.checked = isWallOn;
        syncSwitchUI(optW);
      }
      if (wrapV) {
        const d = isWallOn ? 'flex' : 'none';
        if (wrapV.style.display !== d) wrapV.style.display = d;
      }
      if (wrapS) {
        const d = isWallOn ? 'grid' : 'none';
        if (wrapS.style.display !== d) wrapS.style.display = d;
      }

      // 同步开机动画开关及展开区域状态
      const optB = customOptions.querySelector('#agy-opt-boot');
      const wrapB = customOptions.querySelector('#agy-wrap-boot-config');
      const isBootOn = !!f.bootAnimation;
      if (optB && optB.checked !== isBootOn) {
        optB.checked = isBootOn;
        syncSwitchUI(optB);
      }
      if (wrapB) {
        const d = isBootOn ? 'flex' : 'none';
        if (wrapB.style.display !== d) wrapB.style.display = d;
      }

      const gBoot = customOptions.querySelector('#agy-group-boot-type');
      const bCode = customOptions.querySelector('#agy-boot-type-code');
      const bVideo = customOptions.querySelector('#agy-boot-type-video');
      const isVideo = bootCfg.type === 'video';
      if (gBoot && bCode && bVideo) {
        syncSegmentedState(gBoot, isVideo ? bVideo : bCode);
      }
      const wrapBootVideoPath = customOptions.querySelector('#agy-wrap-boot-video-path');
      const wrapBootCodeConfig = customOptions.querySelector('#agy-wrap-boot-code-config');
      const bootTypeDesc = customOptions.querySelector('#agy-boot-type-desc');
      if (wrapBootVideoPath) {
        const d = isVideo ? 'flex' : 'none';
        if (wrapBootVideoPath.style.display !== d) wrapBootVideoPath.style.display = d;
      }
      if (wrapBootCodeConfig) {
        const d = isVideo ? 'none' : 'flex';
        if (wrapBootCodeConfig.style.display !== d) wrapBootCodeConfig.style.display = d;
      }
      if (bootTypeDesc) {
        const text = isVideo
          ? '🎬 播放本地短视频文件（全屏沉浸播放，播放完毕或按 ESC 跳过）'
          : '💻 执行动态脚本代码渲染开机引导动效';
        if (bootTypeDesc.textContent !== text) bootTypeDesc.textContent = text;
      }
      syncWallpaperVideos();
      syncBootVideos();
      syncBootScripts();
      return;
    }

    function switchLanguage(lang) {
      isZh = lang !== 'en';
      syncLangUI(isZh);
      config.features.language = lang;
      if (window.__agyI18n && typeof window.__agyI18n.setLanguage === 'function') {
        window.__agyI18n.setLanguage(lang);
      }
      triggerSave();
    }

    syncLangUI(isZh);

    langBtnZh.onclick = () => switchLanguage('zh-CN');
    langBtnEn.onclick = () => switchLanguage('en');

    // 7. 自定义配置项表单事件
    const optWallpaper = customOptions.querySelector('#agy-opt-wallpaper');
    const wrapVideoPath = customOptions.querySelector('#agy-wrap-video-path');
    const wrapSliders = customOptions.querySelector('#agy-wrap-sliders');
    const sliderBrightness = customOptions.querySelector('#agy-slider-brightness');
    const valBrightness = customOptions.querySelector('#agy-val-brightness');
    const sliderContrast = customOptions.querySelector('#agy-slider-contrast');
    const valContrast = customOptions.querySelector('#agy-val-contrast');
    
    // 开机动画相关元素
    const optBoot = customOptions.querySelector('#agy-opt-boot');
    const btnPreviewBoot = customOptions.querySelector('#agy-btn-preview-boot');
    const wrapBootConfig = customOptions.querySelector('#agy-wrap-boot-config');
    const bootTypeDesc = customOptions.querySelector('#agy-boot-type-desc');
    const bootTypeCode = customOptions.querySelector('#agy-boot-type-code');
    const bootTypeVideo = customOptions.querySelector('#agy-boot-type-video');
    const wrapBootVideoPath = customOptions.querySelector('#agy-wrap-boot-video-path');

    const wrapBootCodeConfig = customOptions.querySelector('#agy-wrap-boot-code-config');
    const wrapCustomCodeInput = customOptions.querySelector('#agy-wrap-custom-code-input');
    const fileCustomCode = customOptions.querySelector('#agy-file-custom-code');
    const btnPickCodeFile = customOptions.querySelector('#agy-btn-pick-code-file');
    const btnClearCode = customOptions.querySelector('#agy-btn-clear-code');
    const inputCustomCodePath = customOptions.querySelector('#agy-input-custom-code-path');

    // 动态壁纸开关显式同步与事件监听
    if (optWallpaper) {
      const isWallOn = dw.enabled === true;
      optWallpaper.checked = isWallOn;
      syncSwitchUI(optWallpaper);
      if (wrapVideoPath) wrapVideoPath.style.display = isWallOn ? 'flex' : 'none';
      if (wrapSliders) wrapSliders.style.display = isWallOn ? 'grid' : 'none';
      optWallpaper.onchange = () => {
        syncSwitchUI(optWallpaper);
        const isEnabled = optWallpaper.checked;
        if (wrapVideoPath) wrapVideoPath.style.display = isEnabled ? 'flex' : 'none';
        if (wrapSliders) wrapSliders.style.display = isEnabled ? 'grid' : 'none';
        const activeCfg = getConfig() || config;
        if (!activeCfg.features) activeCfg.features = {};
        if (!activeCfg.features.dynamicWallpaper) activeCfg.features.dynamicWallpaper = {};
        activeCfg.features.dynamicWallpaper.enabled = isEnabled;
        config.features.dynamicWallpaper.enabled = isEnabled;
        if (isEnabled && !activeCfg.features.dynamicWallpaper.videoPath && selectBuiltinWallpaper && selectBuiltinWallpaper.value) {
          activeCfg.features.dynamicWallpaper.videoPath = selectBuiltinWallpaper.value;
          config.features.dynamicWallpaper.videoPath = selectBuiltinWallpaper.value;
        }
        triggerSave();
      };
    }

    if (sliderBrightness && valBrightness) {
      sliderBrightness.value = String(dw.brightness || 0.85);
      valBrightness.textContent = sliderBrightness.value;
      sliderBrightness.oninput = () => {
        valBrightness.textContent = sliderBrightness.value;
        config.features.dynamicWallpaper.brightness = parseFloat(sliderBrightness.value);
        triggerSave();
      };
    }

    if (sliderContrast && valContrast) {
      sliderContrast.value = String(dw.contrast || 1.05);
      valContrast.textContent = sliderContrast.value;
      sliderContrast.oninput = () => {
        valContrast.textContent = sliderContrast.value;
        config.features.dynamicWallpaper.contrast = parseFloat(sliderContrast.value);
        triggerSave();
      };
    }

    // A. 元素获取
    // 壁纸素材相关
    const selectBuiltinWallpaper = customOptions.querySelector('#agy-select-builtin-wallpaper');
    const btnDeleteWallpaper = customOptions.querySelector('#agy-btn-delete-wallpaper');
    const btnPickVideo = customOptions.querySelector('#agy-btn-pick-video');
    const fileWallpaper = customOptions.querySelector('#agy-file-wallpaper');
    const wallpaperUploadTip = customOptions.querySelector('#agy-wallpaper-upload-tip');

    // 开机短视频相关
    const selectBootVideo = customOptions.querySelector('#agy-select-boot-video');
    const btnDeleteBootVideo = customOptions.querySelector('#agy-btn-delete-boot-video');
    const btnPickBootVideo = customOptions.querySelector('#agy-btn-pick-boot-video');
    const fileBootVideo = customOptions.querySelector('#agy-file-boot-video');
    const bootVideoUploadTip = customOptions.querySelector('#agy-boot-video-upload-tip');

    // 开机代码动效相关
    const selectBootCode = customOptions.querySelector('#agy-select-boot-code');
    const btnDeleteBootCode = customOptions.querySelector('#agy-btn-delete-boot-code');
    const btnPickBootCode = customOptions.querySelector('#agy-btn-pick-boot-code');
    const fileBootCode = customOptions.querySelector('#agy-file-boot-code');
    const bootCodeUploadTip = customOptions.querySelector('#agy-boot-code-upload-tip');

    // D. 上传载入视频通用处理函数
    async function handleUploadVideo(file, targetType) {
      if (!file) return;
      const isWallpaper = targetType === 'wallpaper';
      const tipEl = isWallpaper ? wallpaperUploadTip : bootVideoUploadTip;
      const defaultTip = '支持 MP4/WebM，直接导入插件素材库';

      if (tipEl) {
        tipEl.textContent = `⏳ 正在载入素材「${file.name}」到内置库...`;
        tipEl.className = 'text-[11px] text-sky-400 font-medium';
      }

      try {
        const uploadEndpoint = isWallpaper ? '/api/wallpaper/upload' : '/api/boot-video/upload';
        const uploadUrl = `http://127.0.0.1:${window.__AG_SKIN_PORT__ || 59288}${uploadEndpoint}?name=${encodeURIComponent(file.name)}`;
        let res = await fetch(uploadUrl, {
          method: 'POST',
          body: file
        });
        if (!res.ok && res.status === 404 && !isWallpaper) {
          const fallbackUrl = `http://127.0.0.1:${window.__AG_SKIN_PORT__ || 59288}/api/wallpaper/upload?name=${encodeURIComponent(file.name)}`;
          res = await fetch(fallbackUrl, {
            method: 'POST',
            body: file
          });
        }
        let data;
        const text = await res.text();
        try {
          data = JSON.parse(text);
        } catch (_) {
          throw new Error(`服务响应异常 (${res.status}): ${text || res.statusText}`);
        }
        if (data.ok && data.relPath) {
          if (isWallpaper) {
            if (!config.features.dynamicWallpaper) config.features.dynamicWallpaper = {};
            config.features.dynamicWallpaper.videoPath = data.relPath;
            config.features.dynamicWallpaper.enabled = true;
            const curOptWall = customOptions.querySelector('#agy-opt-wallpaper') || document.getElementById('agy-opt-wallpaper');
            if (curOptWall) {
              curOptWall.checked = true;
              syncSwitchUI(curOptWall);
              const curWrapV = customOptions.querySelector('#agy-wrap-video-path') || document.getElementById('agy-wrap-video-path');
              const curWrapS = customOptions.querySelector('#agy-wrap-sliders') || document.getElementById('agy-wrap-sliders');
              if (curWrapV) curWrapV.style.display = 'flex';
              if (curWrapS) curWrapS.style.display = 'grid';
            }
            triggerSave();
            await syncWallpaperVideos(data.relPath);
            syncBootVideos();
            if (tipEl) {
              tipEl.textContent = `✅ 已成功载入「${data.fileName}」并设为当前壁纸！`;
              tipEl.className = 'text-[11px] text-emerald-400 font-medium';
            }
          } else {
            if (!config.features.bootAnimationConfig) config.features.bootAnimationConfig = {};
            config.features.bootAnimationConfig.videoPath = data.relPath;
            config.features.bootAnimationConfig.type = 'video';
            config.features.bootAnimation = true;
            const curOptBoot = customOptions.querySelector('#agy-opt-boot') || document.getElementById('agy-opt-boot');
            if (curOptBoot) {
              curOptBoot.checked = true;
              syncSwitchUI(curOptBoot);
              const curWrapB = customOptions.querySelector('#agy-wrap-boot-config') || document.getElementById('agy-wrap-boot-config');
              if (curWrapB) curWrapB.style.display = 'flex';
            }
            syncBootTypeUI('video');
            triggerSave();
            await syncBootVideos(data.relPath);
            syncWallpaperVideos();
            if (tipEl) {
              tipEl.textContent = `✅ 已成功载入「${data.fileName}」并设为开机视频！`;
              tipEl.className = 'text-[11px] text-emerald-400 font-medium';
            }
          }
          setTimeout(() => {
            if (tipEl) {
              tipEl.textContent = defaultTip;
              tipEl.className = 'text-[11px] text-muted-foreground opacity-75';
            }
          }, 5000);
        } else {
          throw new Error(data.error || '上传文件失败');
        }
      } catch (err) {
        if (tipEl) {
          tipEl.textContent = `❌ 载入失败：${err.message}`;
          tipEl.className = 'text-[11px] text-rose-400 font-medium';
          setTimeout(() => {
            tipEl.textContent = defaultTip;
            tipEl.className = 'text-[11px] text-muted-foreground opacity-75';
          }, 6000);
        }
      }
    }

    // E. 删除视频通用处理函数（直接物理删除插件对应专属子库文件）
    async function handleDeleteVideo(selectEl, tipEl, targetType) {
      const isWallpaper = targetType === 'wallpaper';
      const curSelect = (isWallpaper ? document.getElementById('agy-select-builtin-wallpaper') : document.getElementById('agy-select-boot-video')) || selectEl;
      if (!curSelect) return;
      const val = curSelect.value;
      if (!val) {
        alert('当前未选中任何可删除的视频素材。');
        return;
      }
      const fileName = val.split(/[\/\\]/).pop();
      const libraryName = isWallpaper ? '动态壁纸素材库' : '开机短视频素材库';
      const confirmed = confirm(`确定要彻底删除素材「${fileName}」吗？\n\n该操作将直接从${libraryName}中物理删除此视频文件，不可恢复。`);
      if (!confirmed) return;

      if (tipEl) {
        tipEl.textContent = `⏳ 正在删除素材「${fileName}」...`;
        tipEl.className = 'text-[11px] text-amber-400 font-medium';
      }

      try {
        const deleteEndpoint = isWallpaper ? '/api/wallpaper/delete' : '/api/boot-video/delete';
        let res = await fetch(`http://127.0.0.1:${window.__AG_SKIN_PORT__ || 59288}${deleteEndpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: val })
        });
        if (!res.ok && res.status === 404 && !isWallpaper) {
          res = await fetch(`http://127.0.0.1:${window.__AG_SKIN_PORT__ || 59288}/api/wallpaper/delete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: val })
          });
        }
        let data;
        const text = await res.text();
        try {
          data = JSON.parse(text);
        } catch (_) {
          throw new Error(`服务响应异常 (${res.status}): ${text || res.statusText}`);
        }
        if (data.ok) {
          if (isWallpaper) {
            if (config.features?.dynamicWallpaper?.videoPath && (config.features.dynamicWallpaper.videoPath === val || config.features.dynamicWallpaper.videoPath.includes(fileName))) {
              config.features.dynamicWallpaper.videoPath = '';
            }
            triggerSave();
            await syncWallpaperVideos();
            syncBootVideos();
          } else {
            if (config.features?.bootAnimationConfig?.videoPath && (config.features.bootAnimationConfig.videoPath === val || config.features.bootAnimationConfig.videoPath.includes(fileName))) {
              config.features.bootAnimationConfig.videoPath = '';
            }
            triggerSave();
            await syncBootVideos();
            syncWallpaperVideos();
          }

          if (tipEl) {
            tipEl.textContent = `🗑️ 素材「${fileName}」已成功删除。`;
            tipEl.className = 'text-[11px] text-emerald-400 font-medium';
            setTimeout(() => {
              tipEl.textContent = '支持 MP4/WebM，直接导入插件素材库';
              tipEl.className = 'text-[11px] text-muted-foreground opacity-75';
            }, 5000);
          }
        } else {
          throw new Error(data.error || '删除失败');
        }
      } catch (err) {
        if (tipEl) {
          tipEl.textContent = `❌ 删除失败：${err.message}`;
          tipEl.className = 'text-[11px] text-rose-400 font-medium';
        }
      }
    }

    // G. 上传载入动效脚本通用处理函数
    async function handleUploadScript(file) {
      if (!file) return;
      const tipEl = bootCodeUploadTip;
      const defaultTip = '支持 JS 动效脚本，直接导入插件动效库';

      if (tipEl) {
        tipEl.textContent = `⏳ 正在载入动效「${file.name}」到内置库...`;
        tipEl.className = 'text-[11px] text-sky-400 font-medium';
      }

      try {
        const uploadUrl = `http://127.0.0.1:${window.__AG_SKIN_PORT__ || 59288}/api/boot-script/upload?name=${encodeURIComponent(file.name)}`;
        const res = await fetch(uploadUrl, {
          method: 'POST',
          body: file
        });
        let data;
        const text = await res.text();
        try {
          data = JSON.parse(text);
        } catch (_) {
          throw new Error(`服务响应异常 (${res.status}): ${text || res.statusText}`);
        }
        if (data.ok && data.relPath) {
          if (!config.features.bootAnimationConfig) config.features.bootAnimationConfig = {};
          config.features.bootAnimationConfig.customCodePath = data.relPath;
          triggerSave();
          await syncBootScripts(data.relPath);
          if (tipEl) {
            tipEl.textContent = `✅ 已成功载入「${data.fileName}」并设为当前动效！`;
            tipEl.className = 'text-[11px] text-emerald-400 font-medium';
          }
          setTimeout(() => {
            if (tipEl) {
              tipEl.textContent = defaultTip;
              tipEl.className = 'text-[11px] text-muted-foreground opacity-75';
            }
          }, 5000);
        } else {
          throw new Error(data.error || '上传脚本失败');
        }
      } catch (err) {
        if (tipEl) {
          tipEl.textContent = `❌ 载入失败：${err.message}`;
          tipEl.className = 'text-[11px] text-rose-400 font-medium';
          setTimeout(() => {
            tipEl.textContent = defaultTip;
            tipEl.className = 'text-[11px] text-muted-foreground opacity-75';
          }, 6000);
        }
      }
    }

    // H. 删除动效脚本通用处理函数（直接物理删除插件目录对应文件）
    async function handleDeleteScript(selectEl, tipEl) {
      const curSelect = document.getElementById('agy-select-boot-code') || selectEl;
      if (!curSelect) return;
      const val = curSelect.value;
      if (!val || val === 'assets/scripts/default-boot.js' || val.endsWith('/default-boot.js')) {
        alert('官方默认动效受系统保护，不可删除。');
        return;
      }
      const fileName = val.split(/[\/\\]/).pop();
      const confirmed = confirm(`确定要彻底删除动效方案「${fileName}」吗？\n\n该操作将直接从插件动效库中物理删除此脚本文件，不可恢复。`);
      if (!confirmed) return;

      if (tipEl) {
        tipEl.textContent = `⏳ 正在删除动效「${fileName}」...`;
        tipEl.className = 'text-[11px] text-amber-400 font-medium';
      }

      try {
        const res = await fetch(`http://127.0.0.1:${window.__AG_SKIN_PORT__ || 59288}/api/boot-script/delete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: val })
        });
        let data;
        const text = await res.text();
        try {
          data = JSON.parse(text);
        } catch (_) {
          throw new Error(`服务响应异常 (${res.status}): ${text || res.statusText}`);
        }
        if (data.ok) {
          if (config.features?.bootAnimationConfig?.customCodePath && (config.features.bootAnimationConfig.customCodePath === val || config.features.bootAnimationConfig.customCodePath.includes(fileName))) {
            config.features.bootAnimationConfig.customCodePath = 'assets/scripts/default-boot.js';
          }
          triggerSave();
          await syncBootScripts();

          if (tipEl) {
            tipEl.textContent = `🗑️ 动效方案「${fileName}」已成功删除并恢复默认动效。`;
            tipEl.className = 'text-[11px] text-emerald-400 font-medium';
            setTimeout(() => {
              tipEl.textContent = '支持 JS 动效脚本，直接导入插件动效库';
              tipEl.className = 'text-[11px] text-muted-foreground opacity-75';
            }, 5000);
          }
        } else {
          throw new Error(data.error || '删除失败');
        }
      } catch (err) {
        if (tipEl) {
          tipEl.textContent = `❌ 删除失败：${err.message}`;
          tipEl.className = 'text-[11px] text-rose-400 font-medium';
        }
      }
    }

    // I. 壁纸下拉框与按钮事件绑定
    if (selectBuiltinWallpaper) {
      selectBuiltinWallpaper.onchange = () => {
        const val = selectBuiltinWallpaper.value;
        if (!config.features.dynamicWallpaper) config.features.dynamicWallpaper = {};
        config.features.dynamicWallpaper.videoPath = val;
        updateDeleteBtnState(selectBuiltinWallpaper, btnDeleteWallpaper, 'wallpaper');
        triggerSave();
      };
    }

    if (btnDeleteWallpaper) {
      btnDeleteWallpaper.onclick = () => handleDeleteVideo(selectBuiltinWallpaper, wallpaperUploadTip, 'wallpaper');
    }

    if (btnPickVideo && fileWallpaper) {
      btnPickVideo.onclick = () => fileWallpaper.click();
      fileWallpaper.onchange = () => {
        const file = fileWallpaper.files && fileWallpaper.files[0];
        if (file) {
          handleUploadVideo(file, 'wallpaper');
          fileWallpaper.value = '';
        }
      };
    }

    // G. 开机视频下拉框与按钮事件绑定
    if (selectBootVideo) {
      selectBootVideo.onchange = () => {
        const val = selectBootVideo.value;
        if (!config.features.bootAnimationConfig) config.features.bootAnimationConfig = {};
        config.features.bootAnimationConfig.videoPath = val;
        updateDeleteBtnState(selectBootVideo, btnDeleteBootVideo, 'boot');
        triggerSave();
      };
    }

    if (btnDeleteBootVideo) {
      btnDeleteBootVideo.onclick = () => handleDeleteVideo(selectBootVideo, bootVideoUploadTip, 'boot');
    }

    if (btnPickBootVideo && fileBootVideo) {
      btnPickBootVideo.onclick = () => fileBootVideo.click();
      fileBootVideo.onchange = () => {
        const file = fileBootVideo.files && fileBootVideo.files[0];
        if (file) {
          handleUploadVideo(file, 'boot');
          fileBootVideo.value = '';
        }
      };
    }

    // 首次载入素材库（静态载入，不带闪烁动画）
    syncWallpaperVideos();
    syncBootVideos();
    syncBootScripts();

    // 开机动画总开关显式同步与事件监听
    if (optBoot) {
      const isBootOn = !!f.bootAnimation;
      optBoot.checked = isBootOn;
      syncSwitchUI(optBoot);
      if (wrapBootConfig) wrapBootConfig.style.display = isBootOn ? 'flex' : 'none';
      optBoot.onchange = () => {
        syncSwitchUI(optBoot);
        const isEnabled = optBoot.checked;
        if (wrapBootConfig) wrapBootConfig.style.display = isEnabled ? 'flex' : 'none';
        const activeCfg = getConfig() || config;
        if (!activeCfg.features) activeCfg.features = {};
        activeCfg.features.bootAnimation = isEnabled;
        config.features.bootAnimation = isEnabled;
        if (isEnabled) {
          if (!activeCfg.features.bootAnimationConfig) activeCfg.features.bootAnimationConfig = {};
          if (!config.features.bootAnimationConfig) config.features.bootAnimationConfig = {};
          if (!activeCfg.features.bootAnimationConfig.type) {
            activeCfg.features.bootAnimationConfig.type = 'video';
            config.features.bootAnimationConfig.type = 'video';
            syncBootTypeUI('video');
          }
          if (activeCfg.features.bootAnimationConfig.type === 'video' && !activeCfg.features.bootAnimationConfig.videoPath && selectBootVideo && selectBootVideo.value) {
            activeCfg.features.bootAnimationConfig.videoPath = selectBootVideo.value;
            config.features.bootAnimationConfig.videoPath = selectBootVideo.value;
          }
        }
        triggerSave();
      };
    }

    // 开机动画形式切换函数（代码动效 vs 自定义短视频）
    const groupBootType = customOptions.querySelector('#agy-group-boot-type') || customOptions.querySelector('#agy-wrap-boot-config [role="group"]');
    function syncBootTypeUI(type) {
      const isVideo = type === 'video';
      syncSegmentedState(groupBootType, isVideo ? bootTypeVideo : bootTypeCode);
      if (isVideo) {
        wrapBootVideoPath.style.display = 'flex';
        wrapBootCodeConfig.style.display = 'none';
        bootTypeDesc.textContent = '🎬 播放本地短视频文件（全屏沉浸播放，播放完毕或按 ESC 跳过）';
      } else {
        wrapBootVideoPath.style.display = 'none';
        wrapBootCodeConfig.style.display = 'flex';
        bootTypeDesc.textContent = '💻 执行动态脚本代码渲染开机引导动效';
      }
    }

    syncBootTypeUI(bootCfg.type || 'video');

    function setBootType(type) {
      if (!config.features.bootAnimationConfig) config.features.bootAnimationConfig = {};
      config.features.bootAnimationConfig.type = type;
      syncBootTypeUI(type);
      triggerSave();
    }

    bootTypeCode.onclick = () => setBootType('code');
    bootTypeVideo.onclick = () => setBootType('video');

    // K. 开机动效脚本下拉框与按钮事件绑定
    if (selectBootCode) {
      selectBootCode.onchange = () => {
        const val = selectBootCode.value;
        if (!config.features.bootAnimationConfig) config.features.bootAnimationConfig = {};
        config.features.bootAnimationConfig.customCodePath = val;
        updateDeleteScriptBtnState(selectBootCode, btnDeleteBootCode);
        triggerSave();
      };
    }

    if (btnDeleteBootCode) {
      btnDeleteBootCode.onclick = () => handleDeleteScript(selectBootCode, bootCodeUploadTip);
    }

    if (btnPickBootCode && fileBootCode) {
      btnPickBootCode.onclick = () => fileBootCode.click();
      fileBootCode.onchange = () => {
        const file = fileBootCode.files && fileBootCode.files[0];
        if (file) {
          handleUploadScript(file);
          fileBootCode.value = '';
        }
      };
    }

    // 开机动画预览按钮
    btnPreviewBoot.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const currentBootType = config.features?.bootAnimationConfig?.type || 'video';
      const currentBootPath = config.features?.bootAnimationConfig?.videoPath || (selectBootVideo ? selectBootVideo.value : '');
      const currentCustomCodePath = config.features?.bootAnimationConfig?.customCodePath || (selectBootCode ? selectBootCode.value : 'assets/scripts/default-boot.js');

      if (typeof window.__triggerBootAnimation === 'function') {
        window.__triggerBootAnimation(currentBootType, currentBootPath, currentCustomCodePath);
      }
    };

    // Windows 平台专属：一键修复开机动效引擎补丁
    const wrapWinPatch = customOptions.querySelector('#agy-wrap-win-patch');
    const btnFixBoot = customOptions.querySelector('#agy-btn-fix-boot-overlay');
    const tipWinPatch = customOptions.querySelector('#agy-win-patch-tip');

    if (wrapWinPatch) {
      wrapWinPatch.style.display = isWin ? 'flex' : 'none';
    }

    // 尝试向 sidecar 异步确认一次实际平台（避免某些环境 UA 被重写）
    if (typeof fetch === 'function' && typeof window.__AGY_IS_WINDOWS__ === 'undefined') {
      fetch(`http://127.0.0.1:${window.__AG_SKIN_PORT__ || 59288}/api/system-info`)
        .then(res => res.json())
        .then(info => {
          if (info && info.ok) {
            window.__AGY_IS_WINDOWS__ = !!info.isWindows;
            if (wrapWinPatch) {
              wrapWinPatch.style.display = info.isWindows ? 'flex' : 'none';
            }
          }
        })
        .catch(() => {});
    }

    if (btnFixBoot && isWin) {
      btnFixBoot.onclick = async (e) => {
        e.preventDefault();
        e.stopPropagation();

        const confirmed = confirm(
          '⚠️ 即将执行开机动效引擎修复：\n\n' +
          '• 原理：Antigravity 客户端升级会覆盖官方资源文件，此操作将重新合入开机动效引擎补丁。\n' +
          '• 提示：执行时需要自动退出客户端以解除文件锁定，并在约 3 秒后自动重新启动客户端。\n\n' +
          '是否立即开始修复？'
        );
        if (!confirmed) return;

        btnFixBoot.disabled = true;
        btnFixBoot.innerHTML = '<span>⏳ 正在启动修复并重启...</span>';
        if (tipWinPatch) {
          tipWinPatch.textContent = '🚀 正在启动修复引擎并安全退出客户端，请稍候片刻...';
          tipWinPatch.className = 'text-[11px] text-amber-400 font-medium';
        }

        try {
          const res = await fetch(`http://127.0.0.1:${window.__AG_SKIN_PORT__ || 59288}/api/patch-boot`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
          });
          const data = await res.json();
          if (!data.ok) {
            throw new Error(data.error || '调用修复接口失败');
          }
        } catch (err) {
          alert('修复调用失败：' + err.message);
          btnFixBoot.disabled = false;
          btnFixBoot.innerHTML = '<span>⚡ 一键修复</span>';
          if (tipWinPatch) {
            tipWinPatch.textContent = '客户端版本更新后开机动效失效？点击一键重新合入补丁（将自动重启客户端生效）';
            tipWinPatch.className = 'text-[11px] text-muted-foreground opacity-75';
          }
        }
      };
    }

    // ==========================================
    // 插件在线热更新事件绑定与自愈巡检 (Cross-Platform)
    // ==========================================
    const curVerSpan = customOptions.querySelector('#agy-update-cur-ver');
    const updateBadge = customOptions.querySelector('#agy-update-badge');
    const statusTip = customOptions.querySelector('#agy-update-status-tip');
    const btnCheck = customOptions.querySelector('#agy-btn-check-update');
    const btnApply = customOptions.querySelector('#agy-btn-apply-update');
    const changelogBox = customOptions.querySelector('#agy-update-changelog-box');
    const changelogTitle = customOptions.querySelector('#agy-update-changelog-title');
    const changelogDate = customOptions.querySelector('#agy-update-changelog-date');
    const changelogContent = customOptions.querySelector('#agy-update-changelog-content');

    let updateDataCache = window.__agyLastUpdateCheckResult || null;

    function applyUpdateUI(data) {
      if (!data) return;
      if (curVerSpan && data.currentVersion) {
        curVerSpan.textContent = `v${data.currentVersion}`;
      }
      if (data.hasUpdate) {
        if (updateBadge) {
          updateBadge.style.display = 'inline-flex';
          updateBadge.textContent = `✨ 发现新版 v${data.latestVersion}`;
        }
        if (btnApply) {
          btnApply.style.display = 'inline-flex';
          btnApply.innerHTML = `<span>🚀 立即热更新 (v${data.latestVersion})</span>`;
        }
        if (statusTip) {
          statusTip.textContent = `发现新版本 v${data.latestVersion}！点击右侧按钮即可一键在客户端内无感热更新。`;
          statusTip.className = 'text-[11px] text-emerald-400 font-medium';
        }
        if (changelogBox && changelogContent) {
          changelogBox.style.display = 'flex';
          if (changelogTitle) {
            changelogTitle.textContent = data.name ? `🎉 ${data.name}` : `🎉 发现新版本 v${data.latestVersion}`;
          }
          if (changelogDate && data.publishedAt) {
            changelogDate.textContent = new Date(data.publishedAt).toLocaleDateString();
          }
          changelogContent.textContent = data.changelog || '常规功能优化与体验提升';
        }
      } else {
        if (updateBadge) updateBadge.style.display = 'none';
        if (btnApply) btnApply.style.display = 'none';
        if (changelogBox) changelogBox.style.display = 'none';
      }
    }

    function compareSemver(v1, v2) {
      const p1 = (v1 || '').replace(/^[^\d]*/, '').split('.').map(n => parseInt(n, 10) || 0);
      const p2 = (v2 || '').replace(/^[^\d]*/, '').split('.').map(n => parseInt(n, 10) || 0);
      const len = Math.max(p1.length, p2.length);
      for (let i = 0; i < len; i++) {
        const a = p1[i] || 0;
        const b = p2[i] || 0;
        if (a > b) return 1;
        if (a < b) return -1;
      }
      return 0;
    }

    if (updateDataCache) {
      applyUpdateUI(updateDataCache);
    }

    async function handleCheckUpdate(isSilent = false) {
      if (!btnCheck) return;
      if (!isSilent) {
        btnCheck.disabled = true;
        btnCheck.innerHTML = '<span>⏳ 正在检查...</span>';
        if (statusTip) {
          statusTip.textContent = '正在连接 GitHub Releases 检查最新版本...';
          statusTip.className = 'text-[11px] text-sky-400 font-medium';
        }
      }

      try {
        const port = window.__AG_SKIN_PORT__ || 59288;
        let data = null;

        // 1. 优先尝试本地 Sidecar 接口
        try {
          const res = await fetch(`http://127.0.0.1:${port}/api/update/check`, { signal: AbortSignal.timeout(3000) });
          if (res.ok) {
            data = await res.json();
          }
        } catch (_) {}

        // 2. 若本地 Sidecar 接口未响应，直接在浏览器中请求 GitHub Releases 官方开放接口 (CORS: *)
        if (!data || !data.ok) {
          try {
            const ghRes = await fetch('https://api.github.com/repos/MrcolorH/antigravity-skin/releases/latest', {
              headers: { 'Accept': 'application/vnd.github.v3+json' },
              signal: AbortSignal.timeout(5000)
            });
            if (ghRes.ok) {
              const ghData = await ghRes.json();
              if (ghData && ghData.tag_name) {
                const latestTag = ghData.tag_name.replace(/^[^\d]*/, '');
                const curVer = '0.0.5';
                const assetZip = ghData.assets && Array.isArray(ghData.assets)
                  ? ghData.assets.find(a => a.name && a.name.endsWith('.zip'))?.browser_download_url
                  : null;
                data = {
                  ok: true,
                  currentVersion: curVer,
                  latestVersion: latestTag,
                  hasUpdate: compareSemver(latestTag, curVer) > 0,
                  name: ghData.name || `v${latestTag}`,
                  changelog: ghData.body || '无更新说明',
                  publishedAt: ghData.published_at || new Date().toISOString(),
                  downloadUrl: assetZip || `https://github.com/MrcolorH/antigravity-skin/releases/download/${ghData.tag_name}/antigravity-skin.zip`
                };
              }
            }
          } catch (_) {}
        }

        // 3. 第三重兜底：若 GitHub API 被频控或网络受限，直接读 jsDelivr CDN
        if (!data || !data.ok) {
          try {
            const cdnRes = await fetch('https://fastly.jsdelivr.net/gh/MrcolorH/antigravity-skin@main/plugin.json', { signal: AbortSignal.timeout(5000) });
            if (cdnRes.ok) {
              const cdnData = await cdnRes.json();
              if (cdnData && cdnData.version) {
                const latestTag = cdnData.version;
                const curVer = '0.0.5';
                data = {
                  ok: true,
                  currentVersion: curVer,
                  latestVersion: latestTag,
                  hasUpdate: compareSemver(latestTag, curVer) > 0,
                  name: `v${latestTag}`,
                  changelog: cdnData.description || '常规功能优化与体验提升',
                  publishedAt: new Date().toISOString(),
                  downloadUrl: `https://github.com/MrcolorH/antigravity-skin/releases/latest/download/antigravity-skin.zip`
                };
              }
            }
          } catch (_) {}
        }

        if (!data || !data.ok) {
          throw new Error('无法连接到更新服务器，请检查网络连接后重试。');
        }

        window.__agyLastUpdateCheckResult = data;
        updateDataCache = data;
        applyUpdateUI(data);

        if (!data.hasUpdate && !isSilent && statusTip) {
          statusTip.textContent = `当前已是最新版本 (v${data.currentVersion || '0.0.5'})，无需更新。`;
          statusTip.className = 'text-[11px] text-muted-foreground opacity-75';
        }
      } catch (err) {
        if (!isSilent && statusTip) {
          statusTip.textContent = '检查更新失败：' + err.message;
          statusTip.className = 'text-[11px] text-rose-400';
        }
      } finally {
        if (btnCheck) {
          btnCheck.disabled = false;
          btnCheck.innerHTML = '<span>🔄 检查更新</span>';
        }
      }
    }

    if (btnCheck) {
      btnCheck.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        handleCheckUpdate(false);
      };
    }

    if (btnApply) {
      btnApply.onclick = async (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (!updateDataCache || !updateDataCache.hasUpdate) return;
        const targetVer = updateDataCache.latestVersion;

        const confirmed = confirm(
          `⚡ 确认立即热更新至 v${targetVer} 吗？\n\n` +
          `• 本次更新将在后台全自动下载最新发布代码并安全部署；\n` +
          `• 您的个性化配置与已上传的所有壁纸/视频素材将受到 100% 严格保护；\n` +
          `• 更新完成后客户端无需退出，新特性将即刻无感生效。\n\n` +
          `是否立即开始？`
        );
        if (!confirmed) return;

        btnApply.disabled = true;
        if (btnCheck) btnCheck.disabled = true;
        btnApply.innerHTML = '<span>⏳ 正在部署更新...</span>';
        if (statusTip) {
          statusTip.textContent = '🚀 正在下载安装包并安全解压部署，请稍候片刻...';
          statusTip.className = 'text-[11px] text-amber-400 font-medium';
        }

        try {
          const port = window.__AG_SKIN_PORT__ || 59288;
          const res = await fetch(`http://127.0.0.1:${port}/api/update/apply`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              downloadUrl: updateDataCache.downloadUrl,
              version: targetVer
            })
          });
          const result = await res.json();
          if (!result.ok) throw new Error(result.error || '执行更新失败');

          // 更新成功
          window.__agyLastUpdateCheckResult = null;
          updateDataCache = null;
          if (curVerSpan) curVerSpan.textContent = `v${result.version || targetVer}`;
          if (updateBadge) updateBadge.style.display = 'none';
          if (btnApply) btnApply.style.display = 'none';
          if (changelogBox) changelogBox.style.display = 'none';
          if (statusTip) {
            statusTip.textContent = `✨ 恭喜！已成功热更新至 v${result.version || targetVer}，新特性已实时生效！`;
            statusTip.className = 'text-[11px] text-emerald-400 font-medium';
          }

          setTimeout(() => {
            alert(`🎉 恭喜！Antigravity 皮肤插件已成功热更新至 v${result.version || targetVer}！\n新特性已即时生效。`);
          }, 300);
        } catch (err) {
          if (statusTip) {
            statusTip.textContent = '更新失败：' + err.message;
            statusTip.className = 'text-[11px] text-rose-400';
          }
          btnApply.disabled = false;
          btnApply.innerHTML = `<span>🚀 重试热更新 (v${targetVer})</span>`;
          if (btnCheck) btnCheck.disabled = false;
        }
      };
    }

    // 会话级首次打开静默检测一次
    if (!window.__agyHasSilentCheckedUpdate) {
      window.__agyHasSilentCheckedUpdate = true;
      setTimeout(() => handleCheckUpdate(true), 800);
    }

    // 确保 CRT 扫描线彻底停用并清理残留样式
    if (config.features.crtScanlines) {
      config.features.crtScanlines = false;
      triggerSave();
    }
    const residualCrt = document.getElementById('agy-550c-theme');
    if (residualCrt) residualCrt.remove();

    if (customOptions) customOptions.dataset.agyReady = 'true';
    if (langRow) langRow.dataset.agyReady = 'true';
  }

  // 三重监听机制：全局捕获 + MutationObserver + 弹窗轻量轮询，确保 100% 稳定响应
  let timer = null;
  if (window.__agyIntegratedMenuObserver) {
    try { window.__agyIntegratedMenuObserver.disconnect(); } catch (e) {}
  }
  const observer = new MutationObserver((mutations) => {
    // 关键过滤：若变动全部发生在插件自管容器内部，说明是插件自身交互引起的，直接忽略，彻底斩断死循环
    if (mutations && mutations.length > 0) {
      const hasHostMutation = mutations.some(m => {
        const target = m.target;
        if (!target) return false;
        if (target.closest && target.closest('#agy-integrated-custom-options, #agy-integrated-lang-row, #agy-integrated-custom-switch-row, #agy-slot-custom-theme')) {
          return false;
        }
        return true;
      });
      if (!hasHostMutation) return;
    }

    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      integrateNativeMenu();
    }, 150);
  });
  window.__agyIntegratedMenuObserver = observer;

  if (document.body) {
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'aria-hidden', 'data-state']
    });
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      if (document.body && !window.__agyIntegratedMenuObserverAttached) {
        window.__agyIntegratedMenuObserverAttached = true;
        observer.observe(document.body, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ['class', 'aria-hidden', 'data-state']
        });
      }
    }, { once: true });
  }

  // 全局捕获点击事件（利用 closest 穿透图标与子元素，确保点击“外观”100% 触发）
  if (!window.__agyGlobalClickBound) {
    window.__agyGlobalClickBound = true;
    let clickDebounceTimer = null;
    document.addEventListener('click', (e) => {
      const target = e.target;
      if (!target) return;
      const el = target.closest('button, [role="tab"], [role="button"], a, div');
      const text = (el?.textContent || '').trim();
      const aria = (el?.getAttribute && (el.getAttribute('aria-label') || '')) || '';
      if (text.includes('设置') || text.includes('Settings') || text.includes('外观') || text.includes('Appearance') ||
          aria.includes('设置') || aria.includes('Settings') || aria.includes('外观') || aria.includes('Appearance')) {
        if (clickDebounceTimer) clearTimeout(clickDebounceTimer);
        clickDebounceTimer = setTimeout(integrateNativeMenu, 60);
      }
    }, true);
  }

  // 弹窗状态兜底巡检（弹窗处于外观面板且未完成注入时快速自愈，弹窗完全移出 DOM 时触发自动关停）
  if (window.__agyMenuPoller) {
    clearInterval(window.__agyMenuPoller);
  }
  window.__agyMenuPoller = setInterval(() => {
    const modal = getSettingsModal();
    if (!modal) {
      if (wasModalOpen) {
        wasModalOpen = false;
        validateAndAutoOffEmptyFeatures();
      }
      return;
    }
    wasModalOpen = true;
    if (!document.getElementById('agy-integrated-custom-switch-row') || !document.getElementById('agy-integrated-custom-options')) {
      integrateNativeMenu();
    }
  }, 400);

  // 监听 ESC 键：在弹窗关闭后微任务中检测
  if (!window.__agyModalCloseBound) {
    window.__agyModalCloseBound = true;
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        setTimeout(() => {
          if (!getSettingsModal() && wasModalOpen) {
            wasModalOpen = false;
            validateAndAutoOffEmptyFeatures();
          }
        }, 100);
      }
    }, true);
  }

  integrateNativeMenu();

  const instance = {
    validateAndAutoOff: validateAndAutoOffEmptyFeatures,
    destroy: () => {
      validateAndAutoOffEmptyFeatures();
      if (timer) clearTimeout(timer);
      timer = null;
      if (window.__agyMenuPoller) clearInterval(window.__agyMenuPoller);
      window.__agyMenuPoller = null;
      if (observer) observer.disconnect();
      window.__agyIntegratedMenuObserver = null;
      if (window.__agyCurrentMenuInstance === instance) {
        window.__agyCurrentMenuInstance = null;
      }
      cleanupLegacyPanels();
      const dynamicLang = document.getElementById('agy-integrated-lang-row');
      if (dynamicLang) dynamicLang.remove();
      const dynamicSwitch = document.getElementById('agy-integrated-custom-switch-row');
      if (dynamicSwitch) dynamicSwitch.remove();
      const dynamicCustom = document.getElementById('agy-integrated-custom-options');
      if (dynamicCustom) dynamicCustom.remove();
      const dynamicBtn = document.getElementById('agy-slot-custom-theme');
      if (dynamicBtn) dynamicBtn.remove();
    }
  };
  window.__agyCurrentMenuInstance = instance;
  return instance;
}

window.__agyInitAppearanceMenu = initAppearanceMenu;
