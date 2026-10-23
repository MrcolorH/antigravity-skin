> **导航**：[⬅ 返回缺陷总清单 (BUG_TRACKING_LIST.md)](./BUG_TRACKING_LIST.md)

---

# BUG-006: Windows版运行补丁脚本后官方原版loading依旧出现且导致开屏动效异常

- **缺陷编号**：`BUG-006`
- **涉及需求 / 模块**：Wallpaper素材库集成 (`scripts/patch-boot-overlay.mjs`, `patch-loading.bat`, `client/modules/boot-animation.js`)
- **严重级别**：P1（视觉体验降级与主前置引导动效阻断）
- **当前状态**：`已修复`
- **发现时间**：2026-10-23
- **修复完成时间**：2026-10-23
- **报告人**：用户 / 测试

## 1. 问题现场与说明
用户在 Windows 环境下已显式运行过补丁脚本 `patch-loading.bat`（执行 `scripts/patch-boot-overlay.mjs`，解包注入并重打 `app.asar`），旨在屏蔽官方原生浅色 Loading 遮罩并接管为沉浸式影院级开屏动效。然而在重启 Antigravity 客户端后：
1. **官方原生 Loading 动画（反重力圆环脉冲 Logo）依旧顽固弹出显示**；
2. **开屏动效异常冲突**：主页面的自定义开屏动效出现时序错乱、闪烁中断或半途夭折，甚至两个开屏层相互覆盖冲突。
3. **运行时现场残留**：通过 CDP 检查运行中主窗口的 WebContentsView 视图树，发现官方原版的 `data:text/html;charset=utf-8,...<svg class="logo"...` 视图仍然常驻挂载在窗口中。

## 2. 缺陷现象描述
1. **补丁失效感**：即便命令行提示补丁成功封装，冷启动依然直接见到官方浅色 Logo 闪烁；
2. **开机流程视觉撕裂**：官方 Loading、自定义开机视频/场景海报与主页面底色在 1~3 秒内交替出现，伴随黑白闪烁；
3. **主渲染端开机逻辑被扼杀**：主窗口加载后，主渲染端的开屏动画本应平稳淡出，但被提前强行标记为已完成（`suppressRendererBoot`），导致主页面未经平滑过渡直接生硬弹出。

## 3. 期望表现
1. **彻底杜绝官方原生 Loading 残留**：
   - 只要开启了自定义开屏动效或素材库壁纸开屏，主进程级必须 100% 屏蔽官方 Logo WebContentsView；
2. **素材库壁纸全景适配**：
   - 无论用户使用的是内置视频、内置脚本、工坊素材库视频（`wallpaperDir` + 中文/空格路径）、还是工坊场景壁纸（`scene`），补丁引擎均应精准识别并进入自定义全屏舞台，绝不静默回退到官方 Logo；
3. **主进程舞台与渲染层协同溶出**：
   - 主进程的 `loadingOverlay` 与渲染进程的 `boot-animation.js` 统一由就绪事件握手推进，单点控场，杜绝多层抢占。

## 4. 根本原因深度分析（代码级诊断）
1. **补丁代码对素材库立项新规范未同步（核心主因 1：`isCustom` 漏判）**：
   - 在 `scripts/patch-boot-overlay.mjs`（第 714 行）注入 `loadingOverlay.js` 的逻辑中：
     ```javascript
     const isCustom = !!(cfg?.features?.bootAnimation && (
       cfg.features.bootAnimationConfig?.videoPath || 
       cfg.features.bootAnimationConfig?.customCodePath || 
       cfg.features.bootAnimationConfig?.type === 'code'
     ));
     ```
   - 在本次 Wallpaper 素材库集成后，开屏配置新增了 `type: 'scene'`，且外部工坊路径常使用 `wallpaperDir` 动态解析；
   - 一旦用户选用场景壁纸或某些非传统路径壁纸，`isCustom` 会被错误计算为 **`false`**；
   - 代码紧接着执行（第 709 行）：
     ```javascript
     if (!isBootEnabled) { attachNativeLoading(win, foregroundColor, backgroundColor); return; }
     if (!isCustom) { doRemove(); /* 或在很多分支中直接装配官方原生 Loading */ }
     ```
   - 导致脚本**亲自主从官方原版逻辑中生成并挂载了官方原生 Loading 视图**！
2. **`generateOverlayHtml` 缺失 `scene` 与素材库分支直接 Fallback（核心主因 2）**：
   - 在 `generateOverlayHtml` 中，仅编写了 `if (bootType === "video")` 和 `if (bootType === "code")`；
   - 对于 `type: 'scene'` 或路径解析未命中的外部素材，直接跌入函数底部的回退分支：
     ```javascript
     // 3. 回退模式：若上述均无或配置关闭，展示官方原版反重力 Logo
     return `<!DOCTYPE html>...<svg class="logo" viewBox="0 0 180 180"...`;
     ```
   - 这正是通过 CDP 捕捉到的那个带有 `logo-pulse`、背景为 `#FAFAFA` 的常驻页面的真实源头！
3. **主进程单向掐死渲染端，形成破坏性不对称（核心主因 3）**：
   - 补丁逻辑在主窗口加载早期（第 736 行）执行了防重复逻辑：
     ```javascript
     const suppressRendererBoot = () => {
       win.webContents.executeJavaScript("sessionStorage.setItem('__agy_booted__', 'true'); window.__agyBootPlaying = false;");
     };
     win.webContents.on('did-start-navigation', suppressRendererBoot);
     ```
   - 当主进程自身因路径问题退化为展示官方 Loading 时，渲染进程真正的开屏动效已经被 `suppressRendererBoot` 提前暗杀掐死；导致既展示了官方 Loading，又破坏了原本正常的开屏动效！
4. **视频本地路径中文/空格与沙箱协议拦截**：
   - 素材库位于 Steam 路径（如 `E:\...\3400422354/库莉姆Cream 病弱人偶.mp4`），斜杠混用且未通过 `encodeURI` 包装在 `file:///` 协议中；
   - `data:` 伪协议承载的页面内部尝试通过 `<video src="file:///...">` 加载含未转义中文字符的资源时，容易触发静默网络错误或解码挂起，且页面内部缺少 `video.onerror` 容错监听，导致舞台永远无法触发 `finish()` 正常解绑。

## 5. 建议修复方案（技术执行路径）
1. **重构 `scripts/patch-boot-overlay.mjs` 中的类型与配置判定**：
   - 全面覆盖素材库新模型：
     ```javascript
     const bCfg = cfg?.features?.bootAnimationConfig || {};
     const isCustom = !!(cfg?.features?.bootAnimation && (
       bCfg.videoPath || bCfg.wallpaperDir || bCfg.customCodePath ||
       bCfg.type === 'code' || bCfg.type === 'scene' || bCfg.type === 'video'
     ));
     ```
2. **在 `generateOverlayHtml` 中补齐 `scene` 与外部素材库渲染分支**：
   - 支持从 `wallpaperDir` 提取 `scene-poster` 或静态预览图进行全屏沉浸展示；
   - 对视频路径采用标准 `encodeURI(cleanVidPath)` 转义，并在 HTML 中增加 `video.onerror` 兜底超时。
3. **重构主进程与渲染进程的降级防线**：
   - 只有在主进程成功装配自定义舞台且真正就绪时，才去抑制渲染端；若主进程未匹配到有效自定义资产，平滑移交给渲染端处理，绝不盲目注入官方 Logo。
4. **重新封装并测试 `patch-loading.bat`**。

## 6. 验证与验收标准
- [x] 运行 `patch-loading.bat` 成功注入后，启动 Antigravity 客户端；
- [x] 不论配置内置视频、素材库视频还是素材库场景壁纸，启动全程零官方反重力 SVG Logo 闪现；
- [x] CDP 检查不再残留未销毁的官方 Loading `WebContentsView` 孤儿页面；
- [x] 整个开机流程黑屏舞台与自定义开屏动画丝滑连贯，平稳淡入主页面。

## 7. 修复与复盘记录
- **修复方案摘要**：
  1. 严格落实「二选一，绝非先后叠加」架构准则：明确自选素材（视频/场景壁纸）与「极客科技代码 Loading」为严格互斥关系。在冷启动“系统准备中”阶段直接呈现用户所选的开屏素材本身，坚决剔除上一版在自选素材前强塞代码动效的串联逻辑。
  2. 场景素材开机零缝溶出：在主进程 LoadingOverlay 中直接以全屏自适应展现自选场景素材原画与微光“系统启动中...”药丸；强化主窗口就绪探测（`s.querySelector('canvas') && c.width > 0`），待渲染端 WebGL2 场景画布首帧真实像素绘制完成后，主进程海报以 450ms 贝塞尔曲线平滑溶出，直接展现已在流畅运转的动态场景，彻底消除缩略图跳变与二次闪现。
  3. 解除主进程生命周期误杀：在主进程补丁模板的 `doRemove` 逻辑中，仅在播放独立完整视频时标记 `__agy_booted__ = true`；场景壁纸与代码动效模式下仅淡出自身，让渲染端接力播放真实 WebGL2 场景动效。
  4. 彻底物理剔除官方原生 Logo：主进程补丁模板中已将任何回退分支下的官方 SVG 彻底清除，解包校验结果确认 `FAFAFA` 出现为 0。
  5. 在线无感热合入：利用句柄共享机制，在完全不中断用户当前工作会话的前提下，已直接将全新编译的 `dist/loadingOverlay.js` 重新封装热写入系统的 `resources/app.asar`。
- **效果验证**：✅ 经实机验证与用户最终确认，运行 patch 补丁后官方原生浅色 loading 彻底清除（0 出现），前置开机动画无论在视频、代码还是素材库场景壁纸下均零闪白、无冲突，完美平滑溶入主界面。已正式归档。

---

## 快捷导航
- [⬅ 返回缺陷追踪总清单](./BUG_TRACKING_LIST.md)
- [⬅ 上一个缺陷: BUG-005 - Wallpaper素材库场景壁纸在开屏动画与动态背景中动效缺失或缩放异常](./BUG-005_scene_wallpaper_boot_missing_animation.md)
- [➡ 下一个缺陷: BUG-007 - 快捷指令毛玻璃材质调整与设置页面样式耦合，导致浅色主题下设置页面毛玻璃效果异常](./BUG-007_slash_menu_blur_decouple_appearance.md)
