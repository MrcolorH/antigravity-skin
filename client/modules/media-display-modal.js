/**
 * media-display-modal.js - 独立参数弹窗：壁纸显示与渲染设置 & 开屏动效设置
 *
 * 核心特性：
 * 1. 精细渲染控制：渲染帧率 (FPS) 与渲染精度 (Render Scale / DPR) 独立配置，两处互不干扰
 * 2. 壁纸即时热更新：无刷新热调 WebWallGL fps / renderDpr / 静态海报模式 / CSS 滤镜与铺满几何
 * 3. 开屏独立调色与几何，以及进入首页时序控制 (0~10s，0s 纯手动驻留)
 * 4. 提供现场立即试看能力 [▶ 立即预览]
 */

(() => {
  if (typeof window === 'undefined') return;

  function ensureStyles() {
    if (document.getElementById('agy-media-display-modal-style')) return;
    const style = document.createElement('style');
    style.id = 'agy-media-display-modal-style';
    style.textContent = `
      .agy-modal-section {
        margin-bottom: 20px;
        padding-bottom: 16px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      }
      body:not(.dark):not(.theme-dark) .agy-modal-section {
        border-bottom-color: rgba(0, 0, 0, 0.08);
      }
      .agy-modal-section:last-of-type {
        margin-bottom: 0;
        padding-bottom: 0;
        border-bottom: none;
      }
      .agy-section-title {
        font-size: 13px;
        font-weight: 600;
        letter-spacing: 0.02em;
        margin-bottom: 12px;
        display: flex;
        align-items: center;
        gap: 6px;
        opacity: 0.9;
      }
      .agy-grid-2 {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 14px;
      }
      .agy-control-group {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .agy-control-label {
        font-size: 12px;
        font-weight: 500;
        opacity: 0.8;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .agy-control-val {
        font-family: monospace;
        font-size: 11.5px;
        opacity: 0.85;
      }
      .agy-control-select {
        height: 32px;
        padding: 0 10px;
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.06);
        border: 1px solid rgba(255, 255, 255, 0.14);
        color: inherit;
        font-size: 12.5px;
        outline: none;
        cursor: pointer;
        transition: border-color 0.15s, background 0.15s;
      }
      .agy-control-select:focus {
        border-color: #38bdf8;
      }
      body:not(.dark):not(.theme-dark) .agy-control-select {
        background: rgba(0, 0, 0, 0.04);
        border-color: rgba(0, 0, 0, 0.14);
      }
      .agy-control-select option {
        background: #18181b;
        color: #f4f4f5;
      }
      body:not(.dark):not(.theme-dark) .agy-control-select option {
        background: #ffffff;
        color: #18181b;
      }
      .agy-control-slider {
        -webkit-appearance: none;
        appearance: none;
        width: 100%;
        height: 5px;
        border-radius: 3px;
        background: rgba(255, 255, 255, 0.16);
        outline: none;
        cursor: pointer;
        margin: 6px 0;
      }
      body:not(.dark):not(.theme-dark) .agy-control-slider {
        background: rgba(0, 0, 0, 0.15);
      }
      .agy-control-slider::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 15px;
        height: 15px;
        border-radius: 50%;
        background: #38bdf8;
        border: 2px solid #ffffff;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        cursor: pointer;
        transition: transform 0.12s;
      }
      .agy-control-slider::-webkit-slider-thumb:hover {
        transform: scale(1.18);
      }
      .agy-segmented-btn-group {
        display: flex;
        background: rgba(255, 255, 255, 0.06);
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 8px;
        padding: 2px;
        gap: 2px;
      }
      body:not(.dark):not(.theme-dark) .agy-segmented-btn-group {
        background: rgba(0, 0, 0, 0.04);
        border-color: rgba(0, 0, 0, 0.12);
      }
      .agy-segmented-btn {
        flex: 1;
        padding: 5px 8px;
        border-radius: 6px;
        border: none;
        background: transparent;
        color: inherit;
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        text-align: center;
        transition: all 0.16s ease;
        opacity: 0.7;
      }
      .agy-segmented-btn:hover {
        opacity: 1;
      }
      .agy-segmented-btn.active {
        background: rgba(255, 255, 255, 0.16);
        color: #ffffff;
        opacity: 1;
        box-shadow: 0 2px 6px rgba(0,0,0,0.2);
        font-weight: 600;
      }
      body:not(.dark):not(.theme-dark) .agy-segmented-btn.active {
        background: #ffffff;
        color: #0284c7;
        box-shadow: 0 1px 4px rgba(0,0,0,0.12);
      }
      .agy-helper-text {
        font-size: 11.5px;
        opacity: 0.65;
        line-height: 1.5;
        margin-top: 5px;
      }
      .agy-modal-footer-left {
        display: flex;
        gap: 8px;
        margin-right: auto;
      }
    `;
    document.head.appendChild(style);
  }

  function getActiveConfig(ctx) {
    if (ctx && typeof ctx.getConfig === 'function') {
      return ctx.getConfig() || {};
    }
    return (window.__agySkinBridge && window.__agySkinBridge.getConfig()) || window.__AG_SKIN_CONFIG__ || {};
  }

  function triggerSave(ctx, nextCfg) {
    if (ctx && typeof ctx.saveConfig === 'function') {
      ctx.saveConfig(nextCfg);
    } else if (window.__agySkinBridge && typeof window.__agySkinBridge.saveConfig === 'function') {
      window.__agySkinBridge.saveConfig(nextCfg);
    }
    if (ctx && typeof ctx.onConfigChange === 'function') {
      ctx.onConfigChange(nextCfg);
    }
  }

  /**
   * 1. 壁纸显示与渲染设置独立弹窗
   */
  function openWallpaperDisplaySettings(ctx = {}) {
    ensureStyles();
    const cfg = JSON.parse(JSON.stringify(getActiveConfig(ctx)));
    const dw = cfg.features?.dynamicWallpaper || {};
    const title = dw.title || (dw.wallpaperDir ? `素材：${dw.wallpaperDir}` : (dw.videoPath ? '本地短视频' : '未选择'));

    window.__agyModal.open({
      id: 'agy-wallpaper-display-modal',
      title: '动态壁纸显示与渲染设置',
      subtitle: `当前素材：${title} (${dw.sourceType || 'video'})`,
      width: '560px',
      render: (bodyEl, modalApi) => {
        // 当前参数状态
        let currentFit = dw.fit || 'auto';
        let currentPos = dw.fitPosition || 'center';
        let currentBrightness = Number.isFinite(dw.brightness) ? dw.brightness : 0.85;
        let currentContrast = Number.isFinite(dw.contrast) ? dw.contrast : 1.05;
        let currentFps = Number.isFinite(dw.fps) ? dw.fps : 60;
        let currentRenderDpr = Number.isFinite(dw.renderDpr) ? dw.renderDpr : 1.0;
        let currentSceneRenderer = dw.sceneRenderer === 'static' ? 'static' : 'dynamic';

        function applyLive() {
          // 热更新 CSS 滤镜
          if (window.__agyWallpaperInstance && typeof window.__agyWallpaperInstance.updateFilters === 'function') {
            window.__agyWallpaperInstance.updateFilters(currentBrightness, currentContrast);
          }
          // 热更新铺满几何
          if (window.__agyWallpaperInstance && typeof window.__agyWallpaperInstance.updateFit === 'function') {
            window.__agyWallpaperInstance.updateFit({ fit: currentFit, fitPosition: currentPos });
          }
          // 热更新场景 WebWallGL
          if (window.__agySceneRenderer) {
            try {
              window.__agySceneRenderer.setFps(currentFps);
              window.__agySceneRenderer.setRenderDpr(currentRenderDpr * (window.devicePixelRatio || 1));
            } catch (_) {}
          }
          // 更新临时对象并落盘保存
          dw.fit = currentFit;
          dw.fitPosition = currentPos;
          dw.brightness = currentBrightness;
          dw.contrast = currentContrast;
          dw.fps = currentFps;
          dw.renderDpr = currentRenderDpr;
          dw.sceneRenderer = currentSceneRenderer;
          cfg.features.dynamicWallpaper = dw;
          triggerSave(ctx, cfg);
        }

        bodyEl.innerHTML = `
          <!-- 展陈几何 -->
          <div class="agy-modal-section">
            <div class="agy-section-title">📐 展陈几何 (Display Geometry)</div>
            <div class="agy-grid-2">
              <div class="agy-control-group">
                <label class="agy-control-label">铺满方式</label>
                <select class="agy-control-select" id="agy-w-fit">
                  <option value="auto">按素材形态自动 (推荐)</option>
                  <option value="cover">铺满裁切 (Cover)</option>
                  <option value="blur">模糊铺满 (Blur Fill)</option>
                  <option value="contain">等比完整显示 (Contain)</option>
                  <option value="fill">非等比拉伸 (Fill)</option>
                </select>
              </div>
              <div class="agy-control-group">
                <label class="agy-control-label">对齐位置</label>
                <select class="agy-control-select" id="agy-w-pos">
                  <option value="center">居中对齐 (Center)</option>
                  <option value="top">顶部居中 (Top)</option>
                  <option value="bottom">底部居中 (Bottom)</option>
                  <option value="left">左侧居中 (Left)</option>
                  <option value="right">右侧居中 (Right)</option>
                  <option value="top left">左上角 (Top Left)</option>
                  <option value="top right">右上角 (Top Right)</option>
                  <option value="bottom left">左下角 (Bottom Left)</option>
                  <option value="bottom right">右下角 (Bottom Right)</option>
                </select>
              </div>
            </div>
            <div class="agy-helper-text">比例与窗口不一致时的裁切方式；推荐「按素材形态自动」或「铺满裁切」消除黑边。</div>
          </div>

          <!-- 画面调色 -->
          <div class="agy-modal-section">
            <div class="agy-section-title">🎨 画面调色 (Color Grading)</div>
            <div class="agy-grid-2">
              <div class="agy-control-group">
                <div class="agy-control-label">
                  <span>壁纸亮度</span>
                  <span class="agy-control-val" id="agy-w-bright-val">${currentBrightness.toFixed(2)}</span>
                </div>
                <input type="range" class="agy-control-slider" id="agy-w-bright" min="0.2" max="1.5" step="0.05" value="${currentBrightness}">
              </div>
              <div class="agy-control-group">
                <div class="agy-control-label">
                  <span>壁纸对比度</span>
                  <span class="agy-control-val" id="agy-w-contrast-val">${currentContrast.toFixed(2)}</span>
                </div>
                <input type="range" class="agy-control-slider" id="agy-w-contrast" min="0.5" max="1.5" step="0.05" value="${currentContrast}">
              </div>
            </div>
            <div class="agy-helper-text">适当压暗亮度可确保前景聊天文字与毛玻璃可读性；调整实时生效。</div>
          </div>

          <!-- 性能与渲染控制 -->
          <div class="agy-modal-section">
            <div class="agy-section-title">⚡ 性能与渲染控制 (Performance & Rendering)</div>
            <div class="agy-grid-2">
              <div class="agy-control-group">
                <label class="agy-control-label">渲染帧率上限 (FPS)</label>
                <select class="agy-control-select" id="agy-w-fps">
                  <option value="30">30 FPS (极致省电 / 办公降温)</option>
                  <option value="60">60 FPS (推荐流畅 / 视觉平滑)</option>
                  <option value="120">120 FPS (高刷电竞 / 丝滑动态)</option>
                  <option value="0">0 (原生无限制 / 随屏幕刷新率)</option>
                </select>
              </div>
              <div class="agy-control-group">
                <label class="agy-control-label">渲染精度 / 采样比例</label>
                <select class="agy-control-select" id="agy-w-dpr">
                  <option value="0.5">0.5x (轻载减负 / 低配集显)</option>
                  <option value="0.75">0.75x (平衡性能 / 节能清晰)</option>
                  <option value="1.0">1.0x (原生高清 / 100% 像素点)</option>
                  <option value="1.25">1.25x (抗锯齿增强)</option>
                  <option value="1.5">1.5x (超采样超级清晰)</option>
                </select>
              </div>
            </div>
            <div style="margin-top:12px;" class="agy-control-group">
              <label class="agy-control-label">场景渲染模式 (Scene Pipeline)</label>
              <div class="agy-segmented-btn-group" id="agy-w-pipeline">
                <button type="button" class="agy-segmented-btn ${currentSceneRenderer === 'dynamic' ? 'active' : ''}" data-val="dynamic">实时动态渲染 (WebGL2)</button>
                <button type="button" class="agy-segmented-btn ${currentSceneRenderer === 'static' ? 'active' : ''}" data-val="static">静态原画海报 (极低功耗)</button>
              </div>
            </div>
            <div class="agy-helper-text">独立精细控制壁纸功耗与画质；与开屏设置完全隔离。修改后画面即时热应用。</div>
          </div>

          <!-- 底部操作栏 -->
          <div class="agy-modal-footer">
            <div class="agy-modal-footer-left">
              <button type="button" class="agy-btn-secondary" id="agy-w-reset">↺ 恢复默认</button>
            </div>
            <button type="button" class="agy-btn-primary" id="agy-w-done">完成</button>
          </div>
        `;

        // 绑定初始选中态
        const fitSelect = bodyEl.querySelector('#agy-w-fit');
        fitSelect.value = currentFit;
        fitSelect.addEventListener('change', (e) => {
          currentFit = e.target.value;
          applyLive();
        });

        const posSelect = bodyEl.querySelector('#agy-w-pos');
        posSelect.value = currentPos;
        posSelect.addEventListener('change', (e) => {
          currentPos = e.target.value;
          applyLive();
        });

        const brightSlider = bodyEl.querySelector('#agy-w-bright');
        const brightVal = bodyEl.querySelector('#agy-w-bright-val');
        brightSlider.addEventListener('input', (e) => {
          currentBrightness = parseFloat(e.target.value);
          brightVal.textContent = currentBrightness.toFixed(2);
          applyLive();
        });

        const contrastSlider = bodyEl.querySelector('#agy-w-contrast');
        const contrastVal = bodyEl.querySelector('#agy-w-contrast-val');
        contrastSlider.addEventListener('input', (e) => {
          currentContrast = parseFloat(e.target.value);
          contrastVal.textContent = currentContrast.toFixed(2);
          applyLive();
        });

        const fpsSelect = bodyEl.querySelector('#agy-w-fps');
        fpsSelect.value = String(currentFps);
        fpsSelect.addEventListener('change', (e) => {
          currentFps = parseInt(e.target.value, 10);
          applyLive();
        });

        const dprSelect = bodyEl.querySelector('#agy-w-dpr');
        dprSelect.value = currentRenderDpr.toFixed(currentRenderDpr % 1 === 0 ? 1 : 2);
        dprSelect.addEventListener('change', (e) => {
          currentRenderDpr = parseFloat(e.target.value);
          applyLive();
        });

        const pipelineGroup = bodyEl.querySelector('#agy-w-pipeline');
        pipelineGroup.querySelectorAll('.agy-segmented-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            pipelineGroup.querySelectorAll('.agy-segmented-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentSceneRenderer = btn.dataset.val;
            applyLive();
          });
        });

        // 恢复默认
        bodyEl.querySelector('#agy-w-reset').addEventListener('click', () => {
          currentFit = 'auto';
          currentPos = 'center';
          currentBrightness = 0.85;
          currentContrast = 1.05;
          currentFps = 60;
          currentRenderDpr = 1.0;
          currentSceneRenderer = 'dynamic';

          fitSelect.value = currentFit;
          posSelect.value = currentPos;
          brightSlider.value = currentBrightness;
          brightVal.textContent = currentBrightness.toFixed(2);
          contrastSlider.value = currentContrast;
          contrastVal.textContent = currentContrast.toFixed(2);
          fpsSelect.value = '60';
          dprSelect.value = '1.0';

          pipelineGroup.querySelectorAll('.agy-segmented-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.val === 'dynamic');
          });

          applyLive();
        });

        // 完成
        bodyEl.querySelector('#agy-w-done').addEventListener('click', () => {
          modalApi.close();
        });
      }
    });
  }

  /**
   * 2. 开屏动效显示与渲染设置独立弹窗
   */
  function openBootDisplaySettings(ctx = {}) {
    ensureStyles();
    const cfg = JSON.parse(JSON.stringify(getActiveConfig(ctx)));
    const bootCfg = cfg.features?.bootAnimationConfig || {};
    const title = bootCfg.wallpaperTitle || bootCfg.title || (bootCfg.type === 'video' ? '开机短视频' : '开屏动效素材');

    window.__agyModal.open({
      id: 'agy-boot-display-modal',
      title: '开屏动效显示与渲染设置',
      subtitle: `当前素材：${title} (${bootCfg.type || 'video'})`,
      width: '560px',
      render: (bodyEl, modalApi) => {
        // 当前参数状态
        let currentFit = bootCfg.fit || 'cover';
        let currentPos = bootCfg.fitPosition || 'center';
        let currentBrightness = Number.isFinite(bootCfg.brightness) ? bootCfg.brightness : 1.0;
        let currentContrast = Number.isFinite(bootCfg.contrast) ? bootCfg.contrast : 1.0;
        let currentFps = Number.isFinite(bootCfg.fps) ? bootCfg.fps : 60;
        let currentRenderDpr = Number.isFinite(bootCfg.renderDpr) ? bootCfg.renderDpr : 1.0;
        let currentDelay = Number.isFinite(bootCfg.autoEnterDelay) ? bootCfg.autoEnterDelay : 3;

        function saveParams() {
          bootCfg.fit = currentFit;
          bootCfg.fitPosition = currentPos;
          bootCfg.brightness = currentBrightness;
          bootCfg.contrast = currentContrast;
          bootCfg.fps = currentFps;
          bootCfg.renderDpr = currentRenderDpr;
          bootCfg.autoEnterDelay = currentDelay;
          cfg.features.bootAnimationConfig = bootCfg;
          triggerSave(ctx, cfg);
        }

        function updateDelayHint() {
          const hintEl = bodyEl.querySelector('#agy-b-delay-hint');
          if (!hintEl) return;
          if (currentDelay === 0) {
            hintEl.innerHTML = `ℹ️ <strong>0 秒纯手动驻留模式</strong>：开屏呈现后<strong>保持停驻待机</strong>，需按 ESC 或点击画面进入首页。`;
            hintEl.style.color = '#38bdf8';
          } else {
            hintEl.innerHTML = `ℹ️ 开屏准备完成后，等待 <strong>${currentDelay} 秒</strong> 自动平滑淡入主界面；播放期间也可随时点击画面跳过。`;
            hintEl.style.color = '';
          }
        }

        bodyEl.innerHTML = `
          <!-- 展陈几何 -->
          <div class="agy-modal-section">
            <div class="agy-section-title">📐 展陈几何 (Display Geometry)</div>
            <div class="agy-grid-2">
              <div class="agy-control-group">
                <label class="agy-control-label">铺满方式</label>
                <select class="agy-control-select" id="agy-b-fit">
                  <option value="cover">铺满全屏裁切 (Cover - 推荐)</option>
                  <option value="contain">等比完整显示 (Contain)</option>
                  <option value="fill">拉伸全屏 (Fill)</option>
                </select>
              </div>
              <div class="agy-control-group">
                <label class="agy-control-label">居中裁切位置</label>
                <select class="agy-control-select" id="agy-b-pos">
                  <option value="center">居中对齐 (Center)</option>
                  <option value="top">偏向上方 (Top)</option>
                  <option value="bottom">偏向下方 (Bottom)</option>
                </select>
              </div>
            </div>
            <div class="agy-helper-text">开屏动效独立控制缩放比例，不影响桌面长驻壁纸的铺满策略。</div>
          </div>

          <!-- 画面调色 -->
          <div class="agy-modal-section">
            <div class="agy-section-title">🎨 画面调色 (Color Grading)</div>
            <div class="agy-grid-2">
              <div class="agy-control-group">
                <div class="agy-control-label">
                  <span>开屏亮度</span>
                  <span class="agy-control-val" id="agy-b-bright-val">${currentBrightness.toFixed(2)}</span>
                </div>
                <input type="range" class="agy-control-slider" id="agy-b-bright" min="0.2" max="1.5" step="0.05" value="${currentBrightness}">
              </div>
              <div class="agy-control-group">
                <div class="agy-control-label">
                  <span>开屏对比度</span>
                  <span class="agy-control-val" id="agy-b-contrast-val">${currentContrast.toFixed(2)}</span>
                </div>
                <input type="range" class="agy-control-slider" id="agy-b-contrast" min="0.5" max="1.5" step="0.05" value="${currentContrast}">
              </div>
            </div>
            <div class="agy-helper-text">开屏默认为原色 1.00，无毛玻璃文字遮挡时建议保持纯净原画。</div>
          </div>

          <!-- 独立渲染性能 -->
          <div class="agy-modal-section">
            <div class="agy-section-title">⚡ 独立渲染性能 (Performance & Rendering)</div>
            <div class="agy-grid-2">
              <div class="agy-control-group">
                <label class="agy-control-label">动效渲染帧率 (FPS)</label>
                <select class="agy-control-select" id="agy-b-fps">
                  <option value="30">30 FPS (节能省电)</option>
                  <option value="60">60 FPS (原生刷新率 / 流畅推荐)</option>
                  <option value="120">120 FPS (极速高刷)</option>
                  <option value="0">0 (不限)</option>
                </select>
              </div>
              <div class="agy-control-group">
                <label class="agy-control-label">动效渲染精度</label>
                <select class="agy-control-select" id="agy-b-dpr">
                  <option value="0.5">0.5x (轻载)</option>
                  <option value="0.75">0.75x (平衡)</option>
                  <option value="1.0">1.0x (高清全屏 - 推荐)</option>
                  <option value="1.25">1.25x (增强细腻)</option>
                </select>
              </div>
            </div>
            <div class="agy-helper-text">可为短时开屏保留 1.0x 高清与高帧率，不受壁纸省电模式限制。</div>
          </div>

          <!-- 进入首页时序控制 -->
          <div class="agy-modal-section">
            <div class="agy-section-title">⏱️ 进入首页时序控制 (Timing & Dismiss)</div>
            <div class="agy-control-group">
              <div class="agy-control-label">
                <span>自动进入首页时间</span>
                <span class="agy-control-val" id="agy-b-delay-val">${currentDelay === 0 ? '0 秒 (纯手动操作进入)' : `${currentDelay} 秒`}</span>
              </div>
              <input type="range" class="agy-control-slider" id="agy-b-delay" min="0" max="10" step="1" value="${currentDelay}">
            </div>
            <div class="agy-helper-text" id="agy-b-delay-hint"></div>
          </div>

          <!-- 底部操作栏 -->
          <div class="agy-modal-footer">
            <div class="agy-modal-footer-left">
              <button type="button" class="agy-btn-secondary" id="agy-b-preview" title="按当前配置立即试看开机动效">▶ 立即预览</button>
              <button type="button" class="agy-btn-secondary" id="agy-b-reset">↺ 恢复默认</button>
            </div>
            <button type="button" class="agy-btn-primary" id="agy-b-done">完成</button>
          </div>
        `;

        const fitSelect = bodyEl.querySelector('#agy-b-fit');
        fitSelect.value = currentFit;
        fitSelect.addEventListener('change', (e) => {
          currentFit = e.target.value;
          saveParams();
        });

        const posSelect = bodyEl.querySelector('#agy-b-pos');
        posSelect.value = currentPos;
        posSelect.addEventListener('change', (e) => {
          currentPos = e.target.value;
          saveParams();
        });

        const brightSlider = bodyEl.querySelector('#agy-b-bright');
        const brightVal = bodyEl.querySelector('#agy-b-bright-val');
        brightSlider.addEventListener('input', (e) => {
          currentBrightness = parseFloat(e.target.value);
          brightVal.textContent = currentBrightness.toFixed(2);
          saveParams();
        });

        const contrastSlider = bodyEl.querySelector('#agy-b-contrast');
        const contrastVal = bodyEl.querySelector('#agy-b-contrast-val');
        contrastSlider.addEventListener('input', (e) => {
          currentContrast = parseFloat(e.target.value);
          contrastVal.textContent = currentContrast.toFixed(2);
          saveParams();
        });

        const fpsSelect = bodyEl.querySelector('#agy-b-fps');
        fpsSelect.value = String(currentFps);
        fpsSelect.addEventListener('change', (e) => {
          currentFps = parseInt(e.target.value, 10);
          saveParams();
        });

        const dprSelect = bodyEl.querySelector('#agy-b-dpr');
        dprSelect.value = currentRenderDpr.toFixed(currentRenderDpr % 1 === 0 ? 1 : 2);
        dprSelect.addEventListener('change', (e) => {
          currentRenderDpr = parseFloat(e.target.value);
          saveParams();
        });

        const delaySlider = bodyEl.querySelector('#agy-b-delay');
        const delayVal = bodyEl.querySelector('#agy-b-delay-val');
        delaySlider.addEventListener('input', (e) => {
          currentDelay = parseInt(e.target.value, 10);
          delayVal.textContent = currentDelay === 0 ? '0 秒 (纯手动操作进入)' : `${currentDelay} 秒`;
          updateDelayHint();
          saveParams();
        });
        updateDelayHint();

        // 立即预览
        bodyEl.querySelector('#agy-b-preview').addEventListener('click', () => {
          saveParams();
          sessionStorage.removeItem('__agy_booted__');
          if (typeof window.__triggerBootAnimation === 'function') {
            window.__triggerBootAnimation();
          }
        });

        // 恢复默认
        bodyEl.querySelector('#agy-b-reset').addEventListener('click', () => {
          currentFit = 'cover';
          currentPos = 'center';
          currentBrightness = 1.0;
          currentContrast = 1.0;
          currentFps = 60;
          currentRenderDpr = 1.0;
          currentDelay = 3;

          fitSelect.value = currentFit;
          posSelect.value = currentPos;
          brightSlider.value = currentBrightness;
          brightVal.textContent = currentBrightness.toFixed(2);
          contrastSlider.value = currentContrast;
          contrastVal.textContent = currentContrast.toFixed(2);
          fpsSelect.value = '60';
          dprSelect.value = '1.0';
          delaySlider.value = currentDelay;
          delayVal.textContent = `${currentDelay} 秒`;
          updateDelayHint();

          saveParams();
        });

        // 完成
        bodyEl.querySelector('#agy-b-done').addEventListener('click', () => {
          saveParams();
          modalApi.close();
        });
      }
    });
  }

  window.__agyMediaDisplayModal = {
    openWallpaperDisplaySettings,
    openBootDisplaySettings
  };
})();
