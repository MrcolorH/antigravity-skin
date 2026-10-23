> **导航**：[⬅ 返回缺陷总清单 (BUG_TRACKING_LIST.md)](./BUG_TRACKING_LIST.md)

---

# BUG-003: 从开屏动画到首页完整加载动态背景出现黑闪与跳动

- **缺陷编号**：`BUG-003`
- **涉及需求 / 模块**：Wallpaper素材库集成 (`client/modules/wallpaper.js`, `client/modules/boot-animation.js`)
- **严重级别**：P1（严重视觉闪烁与体验割裂）
- **当前状态**：`已修复`
- **发现时间**：2026-10-23
- **修复完成时间**：2026-10-23
- **报告人**：用户

## 1. 问题现场与重现路径
1. 在外观设置中开启“开机引导动画”（如播放自定义短视频 `合成_1_3.mp4`）；
2. 开启“全局动态视频壁纸”并选用 Wallpaper Engine 工坊素材（如当前生效的 WebGL2 场景动态壁纸“落樱少女”）；
3. 启动或刷新 Antigravity 客户端，开屏动画正常全屏播放；
4. 待开屏视频播放完毕自然退出，或用户主动按 ESC/点击退出进入主界面时，**动态背景画面发生剧烈黑闪、抽搐跳动 1~2 次才恢复正常**。在本次 Wallpaper 素材库集成之前该现象不存在。

## 2. 缺陷现象描述
- 开屏动画结束淡出时，底层背景没有平滑承接，而是伴随瞬间黑屏、静态海报闪现、WebGL 画布重新加载渲染的视觉跳动；
- 会话初次进入主页的沉浸感被闪屏破坏。

## 3. 期望表现
- 从开屏动画结束到主界面完整展示的过程中，动态背景必须实现**像素级平滑 Cross-fade 交叉淡化**过渡；
- 开屏动画淡出（`opacity: 0`）的同时，底层动态壁纸平滑渐入（`opacity: 1`），画面全程不露黑、不闪白、不重载、不抽搐。

## 4. 根本原因深度分析（代码级诊断）
1. **唤醒接口误调全量重新挂载（核心主因）**：
   - 在 `client/modules/wallpaper.js` 的 `window.__agyResumeBootWallpaper()` 中：
     ```javascript
     if (mode === 'web' || mode === 'scene') {
       const el = mountMedia(true); // 致命错误：误将“恢复播放”写成“重新挂载”！
       ...
     ```
   - 对于 `scene` 场景壁纸，`mountMedia(true)` 会执行 `mountScene(true)`，进而重新调用 `mountSceneDynamic()`。
   - `mountSceneDynamic()` 内部执行了：
     ```javascript
     box.querySelectorAll('canvas').forEach(c => { try { c.remove(); } catch (e) {} });
     ```
     **直接把正在平稳运行的 WebGL2 Canvas 当场 `remove()` 彻底销毁！** 画面瞬间退回到静态海报或空白底板；待新的 WebGL 上下文重新编译、贴图解包并 resolve 首帧后才淡入，导致了极为刺眼的黑闪与画面抽动！
2. **时序双重触发风暴**：
   - 在 `client/modules/boot-animation.js` 中：
     - 在视频倒数 0.45 秒时：`video.addEventListener('timeupdate')` 触发了一次 `__agyResumeBootWallpaper()`；
     - 在视频自然播完触发 `closeVideoBoot()` 时：250ms 定时器里又触发了一次 `__agyResumeBootWallpaper()`！
     - 导致在短短 500ms 内，WebGL 画布被连续销毁、重建了两次，闪屏程度呈几何级放大。
3. **缺乏交叉淡入时序协同**：
   - 旧逻辑在开屏动画遮罩 `host.style.opacity = '0'` 后，等待了 250ms 定时器才去唤醒壁纸；
   - 遮罩已接近透明，而底层壁纸尚未被唤醒，露出了中间数十毫秒的画面真空期。

## 5. 建议修复方案（技术执行路径）
1. **重构 `__agyResumeBootWallpaper` 为增量幂等唤醒**：
   - 检查若 `box`（`#agy-dynamic-scene`）或已有 WebGL 实例存在，**绝不调用 `mountMedia`，绝不销毁 Canvas**；
   - 仅恢复其 `opacity: 1` 与 `visibility: visible`，并轻量调用 `sceneRendererInstance.resume()` 与伴音播放；
   - 对于 `video` 与 `web` 模式同样实施全量幂等保护。
2. **优化 Cross-fade 衔接时机**：
   - 在开屏动画开始淡出（T=0）的同一时刻立即触发底层壁纸平滑渐入（600ms CSS 过渡）；
   - 提前在开屏动画结束前 0.45 秒在后台静默预热，确保开屏遮罩变淡时底层已稳定处于动画渲染态。
3. **消除挂起态生硬切换**：
   - 统一采用 CSS `opacity: 0` 替代突兀的 `visibility: hidden`，使得状态流转始终受控在缓动曲线中。

## 6. 验证与验收标准
- [x] 开启自定义短视频开屏动画与场景动态壁纸，冷启动客户端；
- [x] 开屏视频播放完毕自然退出进入主页面，动态背景平滑过渡，无黑屏与画面抽搐；
- [x] 按 ESC 或点击画面提前跳过开屏动画，过渡依然平滑连贯，零视觉闪烁；
- [x] 连续多次刷新或会话切换，背景管线稳定不退化。

## 7. 修复与复盘记录
- **修复方案摘要**：
  1. 重构壁纸唤醒接口：在 `client/modules/wallpaper.js` 中将 `window.__agyResumeBootWallpaper()` 升级为增量幂等逻辑。若场景容器 `#agy-dynamic-scene` 或 WebGL 实例已存在，仅恢复 `opacity: 1` 与伴音播放，并调用 `sceneRendererInstance.resume()`，彻底杜绝调用 `mountMedia()` 导致的 Canvas 当场销毁重建与黑屏闪烁。
  2. 海报防覆盖防护：在 `mountScene()` 中增加画布状态检查，当动态画布正在活跃渲染时，海报保持 `opacity: 0`，不再被重置显示。
  3. 协同 Cross-fade 过渡时序：在 `client/modules/boot-animation.js` 中，开屏遮罩淡出（T=0）的同一时刻立即唤醒底层壁纸平滑渐入，形成平滑的 400ms~600ms 交叉淡化过渡，消除中间真空期；同时采用 `opacity: 0` 替代突兀的 `visibility: hidden` 挂起。
- **效果验证**：✅ 经实机验证与用户最终确认，从开屏动画到首页完整加载动态背景过渡丝滑连贯，零黑闪、零抽搐。已正式归档。

---

## 快捷导航
- [⬅ 返回缺陷追踪总清单](./BUG_TRACKING_LIST.md)
- [⬅ 上一个缺陷: BUG-002 - 外观设置残留冗余横幅卡片，且热更新标题在深色主题下异常显示为黑色](./BUG-002_appearance_settings_redundant_banner_and_dark_title.md)
- [➡ 下一个缺陷: BUG-004 - 输入框快捷指令斜杠菜单完全透明，导致文字与背景严重混杂无法辨识](./BUG-004_slash_command_menu_transparent.md)
