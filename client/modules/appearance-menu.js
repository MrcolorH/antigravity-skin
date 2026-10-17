/**
 * appearance-menu.js - Integrates Custom Skin Menu seamlessly into Antigravity Native Appearance Card
 * 
 * 1. 在原生“主题”胶囊行追加第4个选项：“✨ 自定义”；
 * 2. 在“主题”行正下方紧跟第二行：“界面语言 (Language)”；
 * 3. 原生系统/浅色/深色模式下：严格隐藏所有自定义视频与配置，彻底恢复官方原生黑白效果；
 * 4. 自定义主题模式下：隐藏原生的 Contrast 及原生配色卡片，展开自定义主题细项；
 * 5. 开机动画支持双素材模式：💻 550C 代码动效 vs 🎬 自定义短视频；
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

  function integrateNativeMenu() {
    cleanupLegacyPanels();
    ensureSegmentedStyle();

    const modal = document.querySelector('.settings-modal-container');
    if (!modal) return;

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
    const bootCfg = f.bootAnimationConfig || { type: 'code', codeMode: '550c', customCodePath: '', videoPath: 'assets/videos/default-bg.mp4' };
    const currentLang = f.language || (window.__agyI18n ? window.__agyI18n.getLanguage() : 'zh-CN');
    let isZh = currentLang !== 'en';
    let isCustomThemeEnabled = f.themeStyles !== false;

    function triggerSave() {
      saveConfig(config);
      if (typeof onConfigChange === 'function') {
        onConfigChange(config);
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
    let customOptions = document.getElementById('agy-integrated-custom-options');
    if (customOptions && (!customOptions.querySelector('#agy-select-builtin-wallpaper') || !customOptions.querySelector('#agy-group-boot-type') || !customOptions.querySelector('#agy-group-code-mode') || !customOptions.querySelector('#agy-wrap-boot-code-config') || customOptions.querySelector('#agy-opt-crt'))) {
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
            ${createSwitchHtml('agy-opt-wallpaper', dw.enabled !== false)}
          </div>
        </div>

        <!-- 视频路径与内置预设选择配置 -->
        <div class="py-2.5 px-3 w-full bg-transparent flex flex-col gap-2 min-h-[96px] justify-center" id="agy-wrap-video-path" style="display: ${dw.enabled !== false ? 'flex' : 'none'};">
          <!-- 首次加载骨架与过渡 Loading 占位态 -->
          <div id="agy-wallpaper-loading" class="flex items-center justify-center gap-2.5 py-4 text-xs text-muted-foreground/80 select-none">
            <svg class="animate-spin text-sky-400" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <circle class="opacity-20" cx="12" cy="12" r="10" stroke="currentColor"></circle>
              <path class="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span class="font-medium text-sky-400/90 tracking-wide">正在读取壁纸素材库...</span>
          </div>

          <!-- 真实内容容器（初始隐藏，数据载入后淡入平滑展现） -->
          <div id="agy-wallpaper-content" style="display: none; flex-direction: column; gap: 8px; width: 100%; opacity: 0; transition: opacity 0.2s ease;">
            <!-- 选择动态壁纸下拉框与删除按钮 -->
            <div class="flex justify-between items-center gap-3">
              <div class="flex flex-col gap-0.5">
                <span class="text-xs font-medium opacity-85 shrink-0">选择动态壁纸</span>
                <span class="text-[11px] text-muted-foreground opacity-60">选择已载入的壁纸或导入新素材</span>
              </div>
              <div class="flex items-center gap-1.5 shrink-0">
                <select id="agy-select-builtin-wallpaper" class="text-xs px-2.5 py-1 rounded-md border border-border bg-secondary/30 text-foreground outline-none cursor-pointer max-w-[210px] truncate">
                  <option value="assets/videos/default-bg.mp4">🌟 默认动态壁纸 (default-bg.mp4)</option>
                </select>
                <button type="button" id="agy-btn-delete-wallpaper" title="删除当前选中的自定义素材" class="text-xs p-1.5 rounded border border-rose-500/30 text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center">
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
        <div class="py-2 px-3 w-full bg-transparent grid grid-cols-2 gap-4" id="agy-wrap-sliders" style="display: ${dw.enabled !== false ? 'grid' : 'none'};">
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
            <!-- 首次加载骨架与过渡 Loading 占位态 -->
            <div id="agy-boot-video-loading" class="flex items-center justify-center gap-2.5 py-4 text-xs text-muted-foreground/80 select-none">
              <svg class="animate-spin text-sky-400" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <circle class="opacity-20" cx="12" cy="12" r="10" stroke="currentColor"></circle>
                <path class="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span class="font-medium text-sky-400/90 tracking-wide">正在同步开机视频素材...</span>
            </div>

            <!-- 真实内容容器（初始隐藏，数据载入后淡入平滑展现） -->
            <div id="agy-boot-video-content" style="display: none; flex-direction: column; gap: 8px; width: 100%; opacity: 0; transition: opacity 0.2s ease;">
              <!-- 选择开机短视频下拉框与删除按钮 -->
              <div class="flex justify-between items-center gap-3">
                <div class="flex flex-col gap-0.5">
                  <span class="text-xs font-medium opacity-85 shrink-0">选择开机短视频</span>
                  <span class="text-[11px] text-muted-foreground opacity-60">选择已载入的开机短视频或导入新素材</span>
                </div>
                <div class="flex items-center gap-1.5 shrink-0">
                  <select id="agy-select-boot-video" class="text-xs px-2.5 py-1 rounded-md border border-border bg-secondary/30 text-foreground outline-none cursor-pointer max-w-[210px] truncate">
                    <option value="assets/videos/default-bg.mp4">🌟 默认动态壁纸 (default-bg.mp4)</option>
                  </select>
                  <button type="button" id="agy-btn-delete-boot-video" title="删除当前选中的自定义素材" class="text-xs p-1.5 rounded border border-rose-500/30 text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center">
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
          <div class="flex flex-col gap-2 pt-1.5 border-t border-border/40" id="agy-wrap-boot-code-config" style="display: ${bootCfg.type !== 'video' ? 'flex' : 'none'};">
            <div class="flex justify-between items-center">
              <span class="text-xs font-medium opacity-85">动效代码来源</span>
              <div role="group" id="agy-group-code-mode" class="agy-seg-group select-none h-6">
                <button type="button" id="agy-code-mode-550c" class="agy-seg-btn text-[11px] px-2 gap-1 ${bootCfg.codeMode !== 'custom' ? 'active' : ''}" ${bootCfg.codeMode !== 'custom' ? 'data-pressed="" aria-pressed="true"' : 'aria-pressed="false"'}>
                  <span>🌟 550C 样例动效</span>
                </button>
                <button type="button" id="agy-code-mode-custom" class="agy-seg-btn text-[11px] px-2 gap-1 ${bootCfg.codeMode === 'custom' ? 'active' : ''}" ${bootCfg.codeMode === 'custom' ? 'data-pressed="" aria-pressed="true"' : 'aria-pressed="false"'}>
                  <span>📁 导入动效代码</span>
                </button>
              </div>
            </div>

            <!-- 550C 样例说明与来源标注（当选中 550C 样例时显示） -->
            <div id="agy-wrap-550c-source" style="display: ${bootCfg.codeMode !== 'custom' ? 'block' : 'none'}; padding: 7px 10px; background: rgba(56, 189, 248, 0.08); border: 1px solid rgba(56, 189, 248, 0.22); border-radius: 6px;">
              <div class="flex items-center gap-1.5 text-xs text-sky-400 font-medium">
                <span>💻 流浪地球2 550C 量子计算机引导（官方内置样例）</span>
              </div>
              <div class="text-[11px] text-muted-foreground opacity-90 mt-1 flex flex-wrap items-center gap-1.5">
                <span>开源样例代码来源：</span>
                <a href="https://github.com/bl4346324-alt/antigravity-550c.git" id="agy-link-550c-repo" target="_blank" rel="noopener noreferrer" class="text-sky-400 hover:underline font-mono" style="word-break: break-all;">https://github.com/bl4346324-alt/antigravity-550c.git</a>
                <button type="button" id="agy-btn-copy-550c-url" class="text-[10px] px-1.5 py-0.5 rounded border border-border bg-secondary/40 hover:bg-secondary/80 cursor-pointer">复制链接</button>
              </div>
            </div>

            <!-- 自定义动效代码路径输入与文件选择（当选中导入动效代码时显示） -->
            <div id="agy-wrap-custom-code-input" style="display: ${bootCfg.codeMode === 'custom' ? 'flex' : 'none'}; flex-direction: column; gap: 6px;">
              <div class="flex justify-between items-center">
                <span class="text-xs font-medium opacity-85">本地 JS 动效脚本路径</span>
                <div class="flex gap-1.5">
                  <input type="file" id="agy-file-custom-code" accept=".js" style="display: none;">
                  <button type="button" id="agy-btn-pick-code-file" class="text-xs px-2 py-0.5 rounded border border-border bg-secondary/30 hover:bg-secondary/60 cursor-pointer">📂 选择文件</button>
                  <button type="button" id="agy-btn-restore-550c" class="text-xs px-2 py-0.5 rounded border border-border bg-secondary/30 hover:bg-secondary/60 cursor-pointer">使用 550C 样例</button>
                </div>
              </div>
              <input type="text" id="agy-input-custom-code-path" value="${bootCfg.customCodePath || ''}" placeholder="本地 JS 脚本绝对路径（例如：D:\\Scripts\\my-boot.js）" class="w-full text-xs px-2.5 py-1.5 rounded-md border border-border bg-secondary/20 outline-none text-foreground">
              <div class="text-[11px] text-muted-foreground opacity-70">
                💡 支持任意 Canvas / DOM 渲染脚本，可直接执行或导出 <code>window.__customBootAnimation(container, close)</code>。按 ESC 退出。
              </div>
            </div>
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

    // 关键防抖幂等保护：如果自定义配置卡片已完整挂载且就绪，重新同步一次状态后跳过后续多余的重复事件绑定
    if (customOptions && customOptions.dataset.agyReady === 'true') {
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
      const gCode = customOptions.querySelector('#agy-group-code-mode');
      const c550 = customOptions.querySelector('#agy-code-mode-550c');
      const cCustom = customOptions.querySelector('#agy-code-mode-custom');
      const isCustom = bootCfg.codeMode === 'custom';
      if (gCode && c550 && cCustom) {
        syncSegmentedState(gCode, isCustom ? cCustom : c550);
      }
      const wrap550cSource = customOptions.querySelector('#agy-wrap-550c-source');
      const wrapCustomCodeInput = customOptions.querySelector('#agy-wrap-custom-code-input');
      if (wrap550cSource) {
        const d = isCustom ? 'none' : 'block';
        if (wrap550cSource.style.display !== d) wrap550cSource.style.display = d;
      }
      if (wrapCustomCodeInput) {
        const d = isCustom ? 'flex' : 'none';
        if (wrapCustomCodeInput.style.display !== d) wrapCustomCodeInput.style.display = d;
      }
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
    const codeMode550c = customOptions.querySelector('#agy-code-mode-550c');
    const codeModeCustom = customOptions.querySelector('#agy-code-mode-custom');
    const wrap550cSource = customOptions.querySelector('#agy-wrap-550c-source');
    const wrapCustomCodeInput = customOptions.querySelector('#agy-wrap-custom-code-input');
    const fileCustomCode = customOptions.querySelector('#agy-file-custom-code');
    const btnPickCodeFile = customOptions.querySelector('#agy-btn-pick-code-file');
    const btnRestore550c = customOptions.querySelector('#agy-btn-restore-550c');
    const inputCustomCodePath = customOptions.querySelector('#agy-input-custom-code-path');
    const btnCopy550cUrl = customOptions.querySelector('#agy-btn-copy-550c-url');
    const link550cRepo = customOptions.querySelector('#agy-link-550c-repo');

    // 动态壁纸开关显式同步与事件监听
    if (optWallpaper) {
      const isWallOn = dw.enabled !== false;
      optWallpaper.checked = isWallOn;
      syncSwitchUI(optWallpaper);
      if (wrapVideoPath) wrapVideoPath.style.display = isWallOn ? 'flex' : 'none';
      if (wrapSliders) wrapSliders.style.display = isWallOn ? 'grid' : 'none';
      optWallpaper.onchange = () => {
        syncSwitchUI(optWallpaper);
        const isEnabled = optWallpaper.checked;
        if (wrapVideoPath) wrapVideoPath.style.display = isEnabled ? 'flex' : 'none';
        if (wrapSliders) wrapSliders.style.display = isEnabled ? 'grid' : 'none';
        if (!config.features.dynamicWallpaper) config.features.dynamicWallpaper = {};
        config.features.dynamicWallpaper.enabled = isEnabled;
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
    const wallpaperLoading = customOptions.querySelector('#agy-wallpaper-loading');
    const wallpaperContent = customOptions.querySelector('#agy-wallpaper-content');

    // 开机短视频相关
    const selectBootVideo = customOptions.querySelector('#agy-select-boot-video');
    const btnDeleteBootVideo = customOptions.querySelector('#agy-btn-delete-boot-video');
    const btnPickBootVideo = customOptions.querySelector('#agy-btn-pick-boot-video');
    const fileBootVideo = customOptions.querySelector('#agy-file-boot-video');
    const bootVideoUploadTip = customOptions.querySelector('#agy-boot-video-upload-tip');
    const bootVideoLoading = customOptions.querySelector('#agy-boot-video-loading');
    const bootVideoContent = customOptions.querySelector('#agy-boot-video-content');

    // B. 更新删除按钮禁用/启用状态
    function updateDeleteBtnState(selectEl, btnEl) {
      if (!selectEl || !btnEl) return;
      const currentVal = selectEl.value;
      const isDefault = !currentVal || currentVal === 'assets/videos/default-bg.mp4' || currentVal.endsWith('/default-bg.mp4');
      btnEl.disabled = isDefault;
      if (isDefault) {
        btnEl.setAttribute('title', '默认素材受系统保护，不可删除');
      } else {
        btnEl.setAttribute('title', '彻底从插件素材库中删除该素材');
      }
    }

    // C. 统一同步素材库列表（壁纸与开机短视频共享同一个素材库）
    let isSyncingWallpapers = false;
    async function syncWallpapers(initialLoad = false) {
      if (isSyncingWallpapers) return;
      isSyncingWallpapers = true;

      if (initialLoad) {
        if (wallpaperLoading && wallpaperContent) {
          wallpaperLoading.style.display = 'flex';
          wallpaperContent.style.display = 'none';
          wallpaperContent.style.opacity = '0';
        }
        if (bootVideoLoading && bootVideoContent) {
          bootVideoLoading.style.display = 'flex';
          bootVideoContent.style.display = 'none';
          bootVideoContent.style.opacity = '0';
        }
      }

      try {
        const res = await fetch(`http://127.0.0.1:${window.__AG_SKIN_PORT__ || 59288}/api/wallpaper/list`);
        const data = await res.json();
        if (data.ok && Array.isArray(data.videos)) {
          const currentWallPath = config.features?.dynamicWallpaper?.videoPath || 'assets/videos/default-bg.mp4';
          const currentBootPath = config.features?.bootAnimationConfig?.videoPath || 'assets/videos/default-bg.mp4';

          // 填充壁纸下拉框
          if (selectBuiltinWallpaper) {
            selectBuiltinWallpaper.innerHTML = '';
            let matchedWall = false;
            data.videos.forEach(v => {
              const opt = document.createElement('option');
              opt.value = v.relPath;
              opt.textContent = v.displayName;
              if (currentWallPath === v.relPath || currentWallPath.endsWith(v.name)) {
                opt.selected = true;
                matchedWall = true;
              }
              selectBuiltinWallpaper.appendChild(opt);
            });
            if (!matchedWall && currentWallPath && !currentWallPath.startsWith('assets/videos/')) {
              const extOpt = document.createElement('option');
              extOpt.value = currentWallPath;
              const fileName = currentWallPath.split(/[\/\\]/).pop();
              extOpt.textContent = `📁 外部素材: ${fileName}`;
              extOpt.selected = true;
              selectBuiltinWallpaper.appendChild(extOpt);
            }
            updateDeleteBtnState(selectBuiltinWallpaper, btnDeleteWallpaper);
          }

          // 填充开机短视频下拉框
          if (selectBootVideo) {
            selectBootVideo.innerHTML = '';
            let matchedBoot = false;
            data.videos.forEach(v => {
              const opt = document.createElement('option');
              opt.value = v.relPath;
              opt.textContent = v.displayName;
              if (currentBootPath === v.relPath || currentBootPath.endsWith(v.name)) {
                opt.selected = true;
                matchedBoot = true;
              }
              selectBootVideo.appendChild(opt);
            });
            if (!matchedBoot && currentBootPath && !currentBootPath.startsWith('assets/videos/')) {
              const extOpt = document.createElement('option');
              extOpt.value = currentBootPath;
              const fileName = currentBootPath.split(/[\/\\]/).pop();
              extOpt.textContent = `📁 外部素材: ${fileName}`;
              extOpt.selected = true;
              selectBootVideo.appendChild(extOpt);
            }
            updateDeleteBtnState(selectBootVideo, btnDeleteBootVideo);
          }
        }
      } catch (err) {
        console.warn('[Skin Menu] Failed to load wallpaper list:', err);
      } finally {
        isSyncingWallpapers = false;
        if (wallpaperLoading && wallpaperContent) {
          wallpaperLoading.style.display = 'none';
          wallpaperContent.style.display = 'flex';
          requestAnimationFrame(() => { wallpaperContent.style.opacity = '1'; });
        }
        if (bootVideoLoading && bootVideoContent) {
          bootVideoLoading.style.display = 'none';
          bootVideoContent.style.display = 'flex';
          requestAnimationFrame(() => { bootVideoContent.style.opacity = '1'; });
        }
      }
    }

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
        const uploadUrl = `http://127.0.0.1:${window.__AG_SKIN_PORT__ || 59288}/api/wallpaper/upload?name=${encodeURIComponent(file.name)}`;
        const res = await fetch(uploadUrl, {
          method: 'POST',
          body: file
        });
        const data = await res.json();
        if (data.ok && data.relPath) {
          if (isWallpaper) {
            if (!config.features.dynamicWallpaper) config.features.dynamicWallpaper = {};
            config.features.dynamicWallpaper.videoPath = data.relPath;
            triggerSave();
            await syncWallpapers();
            if (tipEl) {
              tipEl.textContent = `✅ 已成功载入「${data.fileName}」并设为当前壁纸！`;
              tipEl.className = 'text-[11px] text-emerald-400 font-medium';
            }
          } else {
            if (!config.features.bootAnimationConfig) config.features.bootAnimationConfig = {};
            config.features.bootAnimationConfig.videoPath = data.relPath;
            triggerSave();
            await syncWallpapers();
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

    // E. 删除视频通用处理函数（直接物理删除插件目录对应文件）
    async function handleDeleteVideo(selectEl, tipEl, targetType) {
      if (!selectEl) return;
      const val = selectEl.value;
      if (!val || val === 'assets/videos/default-bg.mp4' || val.endsWith('/default-bg.mp4')) {
        alert('官方默认素材受系统保护，不可删除。');
        return;
      }
      const fileName = val.split(/[\/\\]/).pop();
      const confirmed = confirm(`确定要彻底删除素材「${fileName}」吗？\n\n该操作将直接从插件素材库中物理删除此视频文件，不可恢复。`);
      if (!confirmed) return;

      if (tipEl) {
        tipEl.textContent = `⏳ 正在删除素材「${fileName}」...`;
        tipEl.className = 'text-[11px] text-amber-400 font-medium';
      }

      try {
        const res = await fetch(`http://127.0.0.1:${window.__AG_SKIN_PORT__ || 59288}/api/wallpaper/delete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: val })
        });
        const data = await res.json();
        if (data.ok) {
          if (config.features?.dynamicWallpaper?.videoPath && (config.features.dynamicWallpaper.videoPath === val || config.features.dynamicWallpaper.videoPath.includes(fileName))) {
            config.features.dynamicWallpaper.videoPath = 'assets/videos/default-bg.mp4';
          }
          if (config.features?.bootAnimationConfig?.videoPath && (config.features.bootAnimationConfig.videoPath === val || config.features.bootAnimationConfig.videoPath.includes(fileName))) {
            config.features.bootAnimationConfig.videoPath = 'assets/videos/default-bg.mp4';
          }
          triggerSave();
          await syncWallpapers();

          if (tipEl) {
            tipEl.textContent = `🗑️ 素材「${fileName}」已成功删除并恢复默认素材。`;
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

    // F. 壁纸下拉框与按钮事件绑定
    if (selectBuiltinWallpaper) {
      selectBuiltinWallpaper.onchange = () => {
        const val = selectBuiltinWallpaper.value;
        if (!config.features.dynamicWallpaper) config.features.dynamicWallpaper = {};
        config.features.dynamicWallpaper.videoPath = val;
        updateDeleteBtnState(selectBuiltinWallpaper, btnDeleteWallpaper);
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
        updateDeleteBtnState(selectBootVideo, btnDeleteBootVideo);
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

    // 首次载入素材库
    syncWallpapers(true);

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
        config.features.bootAnimation = isEnabled;
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

    syncBootTypeUI(bootCfg.type || 'code');

    function setBootType(type) {
      if (!config.features.bootAnimationConfig) config.features.bootAnimationConfig = {};
      config.features.bootAnimationConfig.type = type;
      syncBootTypeUI(type);
      triggerSave();
    }

    bootTypeCode.onclick = () => setBootType('code');
    bootTypeVideo.onclick = () => setBootType('video');

    // 代码动效模式切换函数（550C 样例 vs 导入自定义代码）
    const groupCodeMode = customOptions.querySelector('#agy-group-code-mode') || customOptions.querySelector('#agy-wrap-boot-code-config [role="group"]');
    function syncCodeModeUI(mode) {
      const isCustom = mode === 'custom';
      syncSegmentedState(groupCodeMode, isCustom ? codeModeCustom : codeMode550c);
      if (isCustom) {
        wrap550cSource.style.display = 'none';
        wrapCustomCodeInput.style.display = 'flex';
      } else {
        wrap550cSource.style.display = 'block';
        wrapCustomCodeInput.style.display = 'none';
      }
    }

    syncCodeModeUI(bootCfg.codeMode || '550c');

    function setCodeMode(mode) {
      if (!config.features.bootAnimationConfig) config.features.bootAnimationConfig = {};
      config.features.bootAnimationConfig.codeMode = mode;
      syncCodeModeUI(mode);
      triggerSave();
    }

    codeMode550c.onclick = () => setCodeMode('550c');
    codeModeCustom.onclick = () => setCodeMode('custom');

    // 复制 550C 仓库链接
    if (btnCopy550cUrl) {
      btnCopy550cUrl.onclick = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        try {
          await navigator.clipboard.writeText('https://github.com/bl4346324-alt/antigravity-550c.git');
          const orig = btnCopy550cUrl.textContent;
          btnCopy550cUrl.textContent = '已复制 √';
          setTimeout(() => btnCopy550cUrl.textContent = orig, 1500);
        } catch (err) {}
      };
    }

    if (link550cRepo) {
      link550cRepo.onclick = (e) => {
        e.preventDefault();
        try {
          if (window.electronNative && typeof window.electronNative.openExternal === 'function') {
            window.electronNative.openExternal('https://github.com/bl4346324-alt/antigravity-550c.git');
            return;
          }
        } catch (err) {}
        window.open('https://github.com/bl4346324-alt/antigravity-550c.git', '_blank');
      };
    }

    // 自定义代码文件选择与恢复样例
    if (btnPickCodeFile && fileCustomCode) {
      btnPickCodeFile.onclick = () => fileCustomCode.click();
      fileCustomCode.onchange = () => {
        const file = fileCustomCode.files && fileCustomCode.files[0];
        if (file) {
          const filePath = file.path || file.name;
          inputCustomCodePath.value = filePath;
          if (!config.features.bootAnimationConfig) config.features.bootAnimationConfig = {};
          config.features.bootAnimationConfig.customCodePath = filePath;
          triggerSave();
        }
      };
    }

    if (btnRestore550c) {
      btnRestore550c.onclick = () => setCodeMode('550c');
    }

    inputCustomCodePath.onchange = () => {
      if (!config.features.bootAnimationConfig) config.features.bootAnimationConfig = {};
      config.features.bootAnimationConfig.customCodePath = inputCustomCodePath.value.trim();
      triggerSave();
    };

    // 开机动画预览按钮
    btnPreviewBoot.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const currentBootType = config.features?.bootAnimationConfig?.type || 'code';
      const currentBootPath = config.features?.bootAnimationConfig?.videoPath || (selectBootVideo ? selectBootVideo.value : 'assets/videos/default-bg.mp4');
      const currentCodeMode = config.features?.bootAnimationConfig?.codeMode || '550c';
      const currentCustomCodePath = config.features?.bootAnimationConfig?.customCodePath || inputCustomCodePath.value.trim() || '';

      if (typeof window.__triggerBootAnimation === 'function') {
        window.__triggerBootAnimation(currentBootType, currentBootPath, currentCodeMode, currentCustomCodePath);
      } else if (typeof window.__trigger550C === 'function') {
        window.__trigger550C();
      }
    };

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

  // 弹窗状态兜底巡检（弹窗处于外观面板且未完成注入时快速自愈）
  if (window.__agyMenuPoller) {
    clearInterval(window.__agyMenuPoller);
  }
  window.__agyMenuPoller = setInterval(() => {
    const modal = document.querySelector('.settings-modal-container') || document.querySelector('[role="dialog"]');
    if (modal) {
      if (!document.getElementById('agy-integrated-custom-switch-row') || !document.getElementById('agy-integrated-custom-options')) {
        integrateNativeMenu();
      }
    }
  }, 400);

  integrateNativeMenu();

  const instance = {
    destroy: () => {
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
