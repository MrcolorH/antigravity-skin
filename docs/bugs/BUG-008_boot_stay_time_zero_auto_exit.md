> **导航**：[⬅ 返回缺陷总清单 (BUG_TRACKING_LIST.md)](./BUG_TRACKING_LIST.md)

---

# BUG-008: 开屏动画设置自动进入首页时间为0时未能一致常驻等待，依然自动进入首页

- **缺陷编号**：`BUG-008`
- **涉及需求 / 模块**：Wallpaper素材库集成 (`loadingOverlay.js`, `scripts/patch-boot-overlay.mjs`, `client/modules/boot-animation.js`)
- **严重级别**：P2（交互体验与时序控制缺陷）
- **当前状态**：`已修复`
- **发现时间**：2026-10-23
- **修复完成时间**：2026-10-23
- **报告人**：用户

## 1. 问题现场与说明
用户在「外观设置 -> 展陈参数与时序」或「进入首页时序控制 (Timing & Dismiss)」中将“自动进入首页时间”拖动设置为 `0 秒 (纯手动操作进入)`。按照产品设计预期，系统在启动呈现开屏动效后，应当一直处于静默或循环播放的等待驻留状态，绝不自动跳转进入首页，直到用户主动触发明确的跳过交互（按 `ESC` 键或鼠标左键点击窗口内的任意内容）时才平滑淡出进入首页。
然而实际运行中，无论是冷启动还是开屏动画播放过程中，开屏动画在视频播放完毕或特定时序触发后，仍会自动关闭并进入首页，未能实现纯手动停驻。

## 2. 缺陷现象描述
1. **冷启动自动切回首页**：在 Windows 平台打过前置防闪白补丁后，冷启动客户端时，开屏短视频播放完毕或当主窗口就绪后，开屏遮罩（`loadingOverlay`）直接触发淡出退出，未能常驻等待。
2. **超时机制强制截断**：即使视频未播放完，等待达到默认超时时间（15 秒）后，系统依然强制卸载遮罩并跳入主界面。
3. **按键过滤范围设计偏离**：在渲染端开屏动画的键盘事件处理中，当 `autoEnterDelay === 0` 时，代码将判定条件设为了“捕获到任意按键即退出”（甚至输入法按键、修饰键或系统按键），且底部引导提示为“按下任意键”，与“按 ESC 或点击窗口内容才进入首页”的明确设计规范不符。

## 3. 期望表现（规范定义）
1. **0 秒配置严格常驻等待**：
   - 当 `autoEnterDelay === 0`（纯手动操作进入模式）时，无论是主进程 `loadingOverlay` 还是渲染端 `boot-animation`，**一律禁止自动进入首页**。
   - 彻底关闭所有视频播放完毕自动退出（`ended` 自动 finish）、主窗口加载完成自动退出（`setReady` 自动 finish）以及 15 秒硬编码兜底自动关闭的定时器。
2. **视频与动效自动循环待机**：
   - 视频模式下，`<video>` 元素必须开启 `loop` 循环播放，支持持续循环待机；
   - 场景（Scene）或自定义脚本模式下，持续渲染动效画面保持待机。
3. **精准且唯一的退出交互手势**：
   - **键盘操作**：仅允许且只响应 `ESC` 键（`e.key === 'Escape' || e.code === 'Escape'`）；其他任意按键严禁触发退出；
   - **鼠标操作**：鼠标左键点击窗口有效区域内容（排除必要的防误触安全阈值，如开屏前 300~500ms 防穿透点击）；
   - 底部操作引导胶囊文案与提示应统一明确为：“按 <kbd>ESC</kbd> 或点击画面进入工作区”。

## 4. 根本原因分析（代码级诊断）
通过对全链路启动时序与动效控制代码的深度审查，导致该缺陷的核心原因包含以下三处：

1. **主进程前置开屏补丁（`loadingOverlay.js` 与 `scripts/patch-boot-overlay.mjs`）完全未适配 `autoEnterDelay`**：
   - 在 `loadingOverlay.js` 的 `generateOverlayHtml` 生成函数中，虽然读取了 `cfg?.features?.bootAnimationConfig`，但**完全没有读取或引用 `autoEnterDelay` 字段**。
   - 视频播放结束与主窗口就绪双向强绑定：
     ```javascript
     function setReady() {
       if (isHostReady) return;
       isHostReady = true;
       // ...
       if (isMediaDone) finish(); // 宿主已就绪且视频播放完，立即强退
     }
     if (v) {
       v.addEventListener('ended', () => {
         isMediaDone = true;
         if (isHostReady) finish(); // 视频播放完且宿主已就绪，立即强退
       });
     }
     ```
   - 并且在 `loadingOverlay.js` 中硬编码了两个强制退出的定时器：
     - 第 276/384 行：`setTimeout(finish, 15000);`
     - 第 739 行：`setTimeout(doRemove, 15000);`
     无论用户如何配置，15 秒后都会强行销毁 WebContentsView 遮罩进入首页。
   - 视频 DOM 元素 `<video id="boot-vid">` 没有配置 `loop` 属性，视频单次播放结束后即告终止并触发 `finish()`。

2. **渲染端开屏动效（`client/modules/boot-animation.js`）按键响应与设计偏离**：
   - 在 `startVideoBoot`、`startSceneBoot` 和 `startCustomCodeBoot` 的键盘监听 `onKeyDown` 中，代码逻辑为：
     ```javascript
     function onKeyDown(e) {
       if (delaySec === 0) {
         closeVideoBoot(); // 缺陷：只要捕获到任何按键（甚至输入法击键或误触）均直接触发退出
       } else if (e.key === 'Escape' || e.code === 'Escape' || e.key === ' ' || e.key === 'Enter') {
         closeVideoBoot();
       }
     }
     ```
   - 此处将 `delaySec === 0` 判定为“任意键退出”，与产品要求的“按 ESC 或点击窗口内容才进入首页”产生严重偏离。同时，提示文案显示为“按下任意键”，诱导了非预期的键盘操作触发退出。
   - 此外，`video.loop = (delaySec === 0)` 仅设置了 JavaScript 属性，未同步显式添加 DOM 属性 `video.setAttribute('loop', '')`，且若视频加载异常时内嵌了 `setTimeout(closeVideoBoot, 1500)` 降级强退。

3. **双通道生命周期缺乏手动驻留状态同步**：
   - 主进程原生遮罩层与渲染进程页面级开屏遮罩处于分立状态。主进程遮罩在视频播放完毕后擅自调用 `doRemove()`，导致原生遮罩瞬间消失，而此时渲染端已被注入 `sessionStorage.setItem('__agy_booted__', 'true')`，主界面直接裸露出来，使得“保持等待”的设计全面失效。

## 5. 建议修复方案（技术执行路径）
1. **主进程补丁层适配 `autoEnterDelay` 状态机 (`loadingOverlay.js` & `scripts/patch-boot-overlay.mjs`)**：
   - 从 `bootCfg` 中提取 `delaySec = Number.isFinite(bootCfg.autoEnterDelay) ? Math.max(0, Math.min(10, Math.round(bootCfg.autoEnterDelay))) : 3;`；
   - **当 `delaySec === 0` 时**：
     - `<video>` 元素显式添加 `loop` 属性并在 JS 中置 `v.loop = true`；
     - 禁用 `ended` 监听中的 `finish()` 调用，禁用 `setReady()` 中的 `if (isMediaDone) finish();`；
     - 禁用/取消 `setTimeout(finish, 15000)` 及主进程外部的 `setTimeout(doRemove, 15000)` 超时退出机制；
     - 右下角状态胶囊文案提示调整为：`就绪 · 按 <kbd>ESC</kbd> 或点击画面进入工作区`；
     - 仅在用户按下 `ESC`（`input.key === 'Escape'`）或鼠标点击画面时触发 `finish()`。
2. **渲染端开屏模块规范化改造 (`client/modules/boot-animation.js`)**：
   - 统一收窄 `onKeyDown` 退出键位判定：无论 `delaySec` 为 0 还是大于 0，**按键退出仅允许 `e.key === 'Escape' || e.code === 'Escape'`**，严禁响应其他无关按键；
   - 视频元素补充 `video.setAttribute('loop', '')`；
   - 底部提示胶囊文案在 0 秒模式下统一规范为：“按下 <kbd>ESC</kbd> 或点击画面进入工作区”；
   - 保证在 `delaySec === 0` 模式下，画面持续渲染/循环播放，不设任何自动退出定时器。
3. **同步更新打包补丁模板**：
   - 将 `loadingOverlay.js` 的改动完整同步至 `scripts/patch-boot-overlay.mjs` 中的补丁代码模板，并重新对客户端执行补丁注入验证。

## 6. 验证与验收标准
- [x] 在「外观设置 -> 展陈参数与时序」中将开屏“自动进入首页时间”拖动为 `0 秒 (纯手动操作进入)` 并保存；
- [x] 点击「▶ 立即预览」测试：
  - [x] 动效呈现后一直循环播放或静止待机，经过 10 秒、30 秒以上绝不自动退出；
  - [x] 敲击键盘其他按键（如字母、数字、空格、Enter、Tab、Shift 等），动效保持播放，不退出；
  - [x] 仅当敲击键盘 `ESC` 键，或鼠标左键点击画面内容时，动效平滑淡出并进入首页；
- [x] 场景壁纸（Scene Boot）与短视频右下角操作指示胶囊全面对齐为 `status-pill` 规范，带有呼吸绿点、高阻光毛玻璃模糊及精致白边框按键提示，消除视觉割裂；
- [x] 彻底退出 Antigravity 客户端重新冷启动测试：
  - [x] 前置开屏遮罩启动后持续循环播放，右下角提示“就绪 · 按 ESC 或点击画面进入工作区”；
  - [x] 客户端在 15 秒后绝不自动关闭遮罩；
  - [x] 按 `ESC` 键或点击画面后，平滑淡入主工作区。

## 7. 修复与复盘记录
- **修复方案摘要**：
  1. **主进程前置遮罩层适配纯手动常驻待机**：
     - 在 `scripts/patch-boot-overlay.mjs` 及 `loadingOverlay.js` 的 `generateOverlayHtml` 中完整接入 `delaySec` 计算；
     - 当 `delaySec === 0` 时，视频元素配置 `loop` 循环播放，切断视频 `ended` 监听与 `setReady()` 中的自动 `finish()` 调用，取消 15 秒超时强制退出定时器；
     - 底部胶囊文案在 0 秒模式下规范为“就绪 · 按 <kbd>ESC</kbd> 或点击画面进入工作区”；
     - 键盘事件仅放行 `input.key === 'Escape' || input.code === 'Escape'`，屏蔽其余所有按键；
  2. **渲染端开屏动画规范化收窄退出键位**：
     - 在 `client/modules/boot-animation.js` 中重构 `startVideoBoot`、`startSceneBoot` 及 `startCustomCodeBoot` 的 `onKeyDown` 判定；
     - 无论延时如何，键盘退出严格且仅响应 `ESC` 键，彻底消除原本 `delaySec === 0` 时“任意键退出”造成的键盘误触跳过缺陷；
     - 视频元素补充 DOM 属性 `video.setAttribute('loop', '')`，并在 `ended` 事件中追加循环播放保护；
  3. **右下角操作指示胶囊全面视觉统一（彻底消除“两套样式”割裂）**：
     - 在 `client/modules/boot-animation.js` 中新增 `ensureBootPillStyles()` 与 `createBootStatusPill()`，将原先等宽字体小黑方框（`border-radius: 6px; font-family: monospace`）彻底重构替换为视频原汁原味的 **`status-pill` 科技感圆角胶囊**；
     - 完整接入呼吸绿点（`.ready-dot`）、高阻光毛玻璃模糊（`backdrop-filter: blur(12px)`）、13px 系统字体以及悬停微浮光晕；
     - 文案统一规范为：
       - `0 秒模式`：`<span class="ready-dot"></span><span class="status-text">就绪 · 按 <kbd>ESC</kbd> 或点击画面进入工作区</span>`
       - `>0 秒模式`：`<span class="ready-dot"></span><span class="status-text">就绪 · 按 <kbd>ESC</kbd> 或点击跳过</span>`
     - 视频模式、场景壁纸模式以及自定义脚本动效模式无论是冷启动还是界面预览，右下角指示胶囊 100% 视觉风格与交互体验统一；
  4. **参数配置面板提示文案同步更新**：
     - 在 `client/modules/media-display-modal.js` 中将 0 秒纯手动驻留模式的操作指引更新为“需按 ESC 或点击画面进入首页”；
  5. **全量构建与部署同步**：
     - 完成代码语法自检并运行同步脚本将更新文件即时部署至全局插件目录。
- **验证结论**：✅ 经用户实机环境测试确认通过。开屏动效在 0 秒模式下完美常驻待机、仅按 ESC 键或鼠标点击才退出；短视频与场景壁纸的右下角指示胶囊已 100% 达成像素级视觉对齐与交互统一。本缺陷正式核销封版并归档。

---

## 快捷导航
- [⬅ 返回缺陷追踪总清单](./BUG_TRACKING_LIST.md)
- [⬅ 上一个缺陷: BUG-007 - 快捷指令毛玻璃材质调整与设置页面样式耦合，导致浅色主题下设置页面毛玻璃效果异常](./BUG-007_slash_menu_blur_decouple_appearance.md)
- [➡ 下一个缺陷: BUG-009 - 场景壁纸开屏加载首帧海报提取错误导致画面呈现拆解部件与诡异穿帮](./BUG-009_scene_poster_extraction_glitch.md)
