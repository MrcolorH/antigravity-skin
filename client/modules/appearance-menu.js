/**
 * appearance-menu.js - Integrates Custom Skin Menu into Antigravity Settings -> Appearance Page
 */

export function initAppearanceMenu(getConfig, saveConfig, onConfigChange) {
  let isMounted = false;

  function findAppearanceContainer() {
    // 查找设置弹窗内部的主内容区
    const modalContainers = document.querySelectorAll('.settings-modal-container, [role="dialog"], div[class*="settings"]');
    for (const container of modalContainers) {
      // 检查当前是否在“外观”面板（寻找关键词“配置智能体的视觉主题与显示偏好设置”或“主题预设”）
      const text = container.textContent || '';
      if ((text.includes('视觉主题') || text.includes('主题预设') || text.includes('Contrast')) &&
          (text.includes('外观') || text.includes('Appearance'))) {
        // 找到右侧主滚动内容区
        const mainPane = container.querySelector('div.flex-1.overflow-y-auto, div.overflow-y-auto, [class*="overflow-y"]') || container;
        return mainPane;
      }
    }
    return null;
  }

  function mountSkinSection() {
    const pane = findAppearanceContainer();
    if (!pane) return;

    if (pane.querySelector('#agy-skin-settings-panel')) {
      return; // 已经挂载
    }

    const config = getConfig();
    const dw = (config.features && config.features.dynamicWallpaper) || {};

    const panel = document.createElement('div');
    panel.id = 'agy-skin-settings-panel';
    panel.style.cssText = `
      margin-top: 24px;
      margin-bottom: 24px;
      padding: 18px 20px;
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.14);
      backdrop-filter: blur(16px);
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.05);
      font-size: 13px;
    `;

    panel.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 10px;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 16px;">🎨</span>
          <span style="font-weight: 600; font-size: 14px;">自定义主题与动态皮肤设置</span>
          <span style="font-size: 11px; padding: 2px 6px; border-radius: 4px; background: rgba(0, 122, 204, 0.2); color: #38bdf8; font-weight: 500;">官方插件版</span>
        </div>
        <div style="font-size: 11px; opacity: 0.6;">v1.0.0</div>
      </div>

      <!-- 1. 动态视频壁纸开关 -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <div>
          <div style="font-weight: 500;">全局动态视频壁纸与毛玻璃</div>
          <div style="font-size: 11.5px; opacity: 0.7;">在底层无缝循环播放视频，主界面 100% 透光化</div>
        </div>
        <label style="position: relative; display: inline-block; width: 40px; height: 22px;">
          <input type="checkbox" id="agy-opt-wallpaper" ${dw.enabled !== false ? 'checked' : ''} style="opacity: 0; width: 0; height: 0;">
          <span style="position: absolute; cursor: pointer; inset: 0; background-color: ${dw.enabled !== false ? '#007acc' : 'rgba(255,255,255,0.2)'}; border-radius: 22px; transition: .2s;">
            <span style="position: absolute; content: ''; height: 16px; width: 16px; left: ${dw.enabled !== false ? '21px' : '3px'}; bottom: 3px; background-color: white; border-radius: 50%; transition: .2s;"></span>
          </span>
        </label>
      </div>

      <!-- 2. 视频路径 -->
      <div style="margin-bottom: 12px; display: ${dw.enabled !== false ? 'block' : 'none'};" id="agy-wrap-video-path">
        <div style="font-size: 12px; font-weight: 500; margin-bottom: 4px;">视频文件路径 (MP4/WebM)</div>
        <div style="display: flex; gap: 8px;">
          <input type="text" id="agy-input-video-path" value="${dw.videoPath || ''}" placeholder="本地绝对路径或留空使用内置壁纸" style="flex: 1; padding: 6px 10px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.15); background: rgba(0,0,0,0.15); color: inherit; font-size: 12px; outline: none;">
          <button id="agy-btn-reset-video" style="padding: 6px 12px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.15); background: rgba(255,255,255,0.08); cursor: pointer; font-size: 11px;">恢复内置</button>
        </div>
      </div>

      <!-- 3. 亮度与对比度滑块 -->
      <div style="display: ${dw.enabled !== false ? 'grid' : 'none'}; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 14px;" id="agy-wrap-sliders">
        <div>
          <div style="display: flex; justify-content: space-between; font-size: 11.5px; margin-bottom: 4px;">
            <span>壁纸亮度 (Brightness)</span>
            <span id="agy-val-brightness">${dw.brightness || 0.85}</span>
          </div>
          <input type="range" id="agy-slider-brightness" min="0.2" max="1.5" step="0.05" value="${dw.brightness || 0.85}" style="width: 100%; cursor: pointer;">
        </div>
        <div>
          <div style="display: flex; justify-content: space-between; font-size: 11.5px; margin-bottom: 4px;">
            <span>壁纸对比度 (Contrast)</span>
            <span id="agy-val-contrast">${dw.contrast || 1.05}</span>
          </div>
          <input type="range" id="agy-slider-contrast" min="0.5" max="1.5" step="0.05" value="${dw.contrast || 1.05}" style="width: 100%; cursor: pointer;">
        </div>
      </div>

      <div style="height: 1px; background: rgba(255,255,255,0.08); margin: 12px 0;"></div>

      <!-- 4. 550C CRT 扫描线开关 -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <div>
          <div style="font-weight: 500;">550C CRT 荧光扫描线与琥珀金</div>
          <div style="font-size: 11.5px; opacity: 0.7;">流浪地球2 量子终端扫描线质感与复古金滚动条</div>
        </div>
        <label style="position: relative; display: inline-block; width: 40px; height: 22px;">
          <input type="checkbox" id="agy-opt-crt" ${config.features?.crtScanlines ? 'checked' : ''} style="opacity: 0; width: 0; height: 0;">
          <span style="position: absolute; cursor: pointer; inset: 0; background-color: ${config.features?.crtScanlines ? '#007acc' : 'rgba(255,255,255,0.2)'}; border-radius: 22px; transition: .2s;">
            <span style="position: absolute; content: ''; height: 16px; width: 16px; left: ${config.features?.crtScanlines ? '21px' : '3px'}; bottom: 3px; background-color: white; border-radius: 50%; transition: .2s;"></span>
          </span>
        </label>
      </div>

      <!-- 5. 550C 开机引导动画开关 -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <div>
          <div style="font-weight: 500;">550C 开机引导动画 (Boot Animation)</div>
          <div style="font-size: 11.5px; opacity: 0.7;">每次启动时全屏呈现 550C 量子终端引导特效，按 ESC 跳过</div>
        </div>
        <label style="position: relative; display: inline-block; width: 40px; height: 22px;">
          <input type="checkbox" id="agy-opt-boot" ${config.features?.bootAnimation ? 'checked' : ''} style="opacity: 0; width: 0; height: 0;">
          <span style="position: absolute; cursor: pointer; inset: 0; background-color: ${config.features?.bootAnimation ? '#007acc' : 'rgba(255,255,255,0.2)'}; border-radius: 22px; transition: .2s;">
            <span style="position: absolute; content: ''; height: 16px; width: 16px; left: ${config.features?.bootAnimation ? '21px' : '3px'}; bottom: 3px; background-color: white; border-radius: 50%; transition: .2s;"></span>
          </span>
        </label>
      </div>

      <!-- 6. 中文语言切换 -->
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <div style="font-weight: 500;">中文界面汉化 (Chinese Localization)</div>
          <div style="font-size: 11.5px; opacity: 0.7;">内置隔离汉化引擎，关闭后恢复官方原生英文</div>
        </div>
        <label style="position: relative; display: inline-block; width: 40px; height: 22px;">
          <input type="checkbox" id="agy-opt-hans" ${config.features?.chineseLocalization !== false ? 'checked' : ''} style="opacity: 0; width: 0; height: 0;">
          <span style="position: absolute; cursor: pointer; inset: 0; background-color: ${config.features?.chineseLocalization !== false ? '#007acc' : 'rgba(255,255,255,0.2)'}; border-radius: 22px; transition: .2s;">
            <span style="position: absolute; content: ''; height: 16px; width: 16px; left: ${config.features?.chineseLocalization !== false ? '21px' : '3px'}; bottom: 3px; background-color: white; border-radius: 50%; transition: .2s;"></span>
          </span>
        </label>
      </div>
    `;

    // 绑定事件
    const optWallpaper = panel.querySelector('#agy-opt-wallpaper');
    const wrapVideoPath = panel.querySelector('#agy-wrap-video-path');
    const wrapSliders = panel.querySelector('#agy-wrap-sliders');
    const inputVideoPath = panel.querySelector('#agy-input-video-path');
    const btnResetVideo = panel.querySelector('#agy-btn-reset-video');
    const sliderBrightness = panel.querySelector('#agy-slider-brightness');
    const valBrightness = panel.querySelector('#agy-val-brightness');
    const sliderContrast = panel.querySelector('#agy-slider-contrast');
    const valContrast = panel.querySelector('#agy-val-contrast');
    const optCrt = panel.querySelector('#agy-opt-crt');
    const optBoot = panel.querySelector('#agy-opt-boot');
    const optHans = panel.querySelector('#agy-opt-hans');

    function syncSwitchUI(checkbox) {
      const bg = checkbox.nextElementSibling;
      const circle = bg.querySelector('span');
      if (checkbox.checked) {
        bg.style.backgroundColor = '#007acc';
        circle.style.left = '21px';
      } else {
        bg.style.backgroundColor = 'rgba(255,255,255,0.2)';
        circle.style.left = '3px';
      }
    }

    optWallpaper.addEventListener('change', () => {
      syncSwitchUI(optWallpaper);
      const isEnabled = optWallpaper.checked;
      wrapVideoPath.style.display = isEnabled ? 'block' : 'none';
      wrapSliders.style.display = isEnabled ? 'grid' : 'none';
      config.features.dynamicWallpaper.enabled = isEnabled;
      triggerSave();
    });

    sliderBrightness.addEventListener('input', () => {
      valBrightness.textContent = sliderBrightness.value;
      config.features.dynamicWallpaper.brightness = parseFloat(sliderBrightness.value);
      triggerSave();
    });

    sliderContrast.addEventListener('input', () => {
      valContrast.textContent = sliderContrast.value;
      config.features.dynamicWallpaper.contrast = parseFloat(sliderContrast.value);
      triggerSave();
    });

    inputVideoPath.addEventListener('change', () => {
      config.features.dynamicWallpaper.videoPath = inputVideoPath.value.trim();
      triggerSave();
    });

    btnResetVideo.addEventListener('click', () => {
      inputVideoPath.value = 'assets/videos/default-bg.mp4';
      config.features.dynamicWallpaper.videoPath = 'assets/videos/default-bg.mp4';
      triggerSave();
    });

    optCrt.addEventListener('change', () => {
      syncSwitchUI(optCrt);
      config.features.crtScanlines = optCrt.checked;
      triggerSave();
    });

    optBoot.addEventListener('change', () => {
      syncSwitchUI(optBoot);
      config.features.bootAnimation = optBoot.checked;
      triggerSave();
    });

    optHans.addEventListener('change', () => {
      syncSwitchUI(optHans);
      config.features.chineseLocalization = optHans.checked;
      triggerSave();
    });

    function triggerSave() {
      saveConfig(config);
      if (typeof onConfigChange === 'function') {
        onConfigChange(config);
      }
    }

    // 插入到主区域的合适位置（插入在最后或在浅色/深色主题卡片之后）
    pane.appendChild(panel);
  }

  // 使用 MutationObserver 监听设置弹窗的挂载
  const observer = new MutationObserver(() => {
    mountSkinSection();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  // 初始尝试挂载
  mountSkinSection();

  return {
    destroy: () => {
      observer.disconnect();
      const p = document.getElementById('agy-skin-settings-panel');
      if (p) p.remove();
    }
  };
}

window.__agyInitAppearanceMenu = initAppearanceMenu;
