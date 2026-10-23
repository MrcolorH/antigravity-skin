> **导航**：[⬅ 返回缺陷总清单 (BUG_TRACKING_LIST.md)](./BUG_TRACKING_LIST.md)

---

# BUG-005: Wallpaper素材库场景壁纸在开屏动画与动态背景中动效缺失或缩放异常

- **缺陷编号**：`BUG-005`
- **涉及需求 / 模块**：Wallpaper素材库集成 (`client/modules/boot-animation.js`, `client/modules/wallpaper.js`, `sidecars/skin-engine/vendor/webwallgl.js`)
- **严重级别**：P1（核心动态渲染功能与视觉体验缺陷）
- **当前状态**：`已修复`
- **发现时间**：2026-10-23
- **修复完成时间**：2026-10-23
- **报告人**：用户 / 测试

## 1. 问题现场与说明
用户在 Wallpaper 素材库中选用工坊场景壁纸（Scene 模式，解压自 `scene.pkg`）后：
1. **开屏动画阶段**：开屏动画播放时，场景壁纸完全没有原本丰富的动态效果（粒子漂浮、骨骼呼吸、微动物理、动态流光），画面完全静止不动，且带有奇怪的变焦拉伸与画面裁切，边缘呈现不自然的几何变形；
2. **动态背景阶段**：进入主页面后，场景壁纸偶发静止（不运行动态渲染循环，停留在静态海报），或在不同的窗口尺寸、分辨率与视口缩放比例下，画面呈现严重裁切（主体偏离中心被截断）或缩放比例失调。

## 2. 缺陷现象描述
1. **开屏动画彻底失去动态能力**：
   - 用户期望在冷启动或开屏时体验到场景壁纸的动态效果，但实际仅呈现一张静态海报，伴随机械生硬的 CSS 缩放；
2. **开屏动画缩放与裁切变形**：
   - 开屏动画使用了固定的 `scale(1.02) -> scale(1.09)` 动画并配合 `inset: -2%; width: 104%; height: 104%`，在超宽屏、带鱼屏或不同 DPI 缩放下导致壁纸画面主体被大面积削顶或切边；
3. **动态背景偶发静止（未启动或暂停锁死）**：
   - 切换到主界面后，部分场景壁纸仅停留在底层静态 `img`，WebGL2 动态画布未正常 resolve，或在开屏动画退出后其渲染管线未能从 `pause()` 状态正确唤醒；
4. **动态背景几何缩放未对齐**：
   - 用户在外观设置中选择的壁纸适应模式（如 `contain` / `blur` / `fill` / `auto`）在动态模式下未能正确传递至 WebWallGL 渲染器，Canvas 内部缓冲区写死为 `cover` 铺满，导致非 16:9 原图被盲目裁切破坏构图。

## 3. 期望表现
1. **开屏动画具备真实动态渲染或平滑过渡**：
   - 场景壁纸作为开屏动画时，应能直接激活 WebGL2 / WebWallGL 动态管线进行全屏动态渲染，或者让底层已在运行的场景动态画布直接透出作为开屏背景，杜绝生硬静态海报；
2. **精准自适应缩放（几何无形变、无过度裁切）**：
   - 无论在开屏阶段还是在主页面动态背景中，壁纸画面均严格尊重视口比例与用户指定的适应模式（`wallpaperFit`）；
   - WebGL 画布的绘图缓冲区（`backingStore`）与 CSS 盒模型、窗口设备像素比（`devicePixelRatio`）精准同步；
3. **渲染生命周期坚固可靠（永不锁死静止）**：
   - 场景壁纸的动态渲染循环（RAF）在页面切换、开屏动画出入场、窗口尺寸变更时均能幂等自愈，确保进入主界面后 100% 处于生动的动态运行态。

## 4. 根本原因深度分析（代码级诊断）
1. **渲染端加载脚本 DOM 节点报错崩溃（核心致死主因）**：
   - 在 `client/modules/boot-animation.js` 的 `mountBootSceneDynamic` 中，加载 `webwallgl.js` 时直接执行了 `document.head.appendChild(s)`。
   - 在宿主初始化开屏阶段 `document.head` 尚未构建为 `null`，导致当场抛出：
     `TypeError: Cannot read properties of null (reading 'appendChild')`；
   - 异常触发进入 catch 分支，打印 `[Boot Scene] dynamic track unavailable, poster stays`，导致整个 WebGL2 场景动态渲染管线直接瘫痪，退化为仅展示静态海报！
2. **冷启动主进程扼杀渲染端开机逻辑**：
   - 补丁生成的 `loadingOverlay.js` 在 `doRemove` 和导航阶段无条件写入 `sessionStorage.setItem('__agy_booted__', 'true')`，导致主窗口渲染进程执行 `checkAndTriggerBootAnimation()` 时误判开机动画已结束，直接放弃播放动态开屏。
3. **外观面板预览参数未透传**：
   - 在 `client/modules/appearance-menu.js` 的 `btnPreviewBoot.onclick` 中仅传递了 `currentBootType, currentBootPath, currentCustomCodePath`，未将场景目录 `wallpaperDir` 传入 `__triggerBootAnimation`，导致动态场景挂载丢失素材目录。
4. **Canvas 几何与适配模式脱节**：
   - 在 `client/modules/wallpaper.js` 中 `fit: 'cover'` 曾存在硬编码，未同步应用到场景 Canvas 上。

## 5. 建议修复方案（技术执行路径）
1. **建立高容错的脚本与渲染器装载机制**：
   - 在 `boot-animation.js` 中对 `webwallgl.js` 采用轮询宿主目标（`document.head || document.body || document.documentElement`），彻底解决 `document.head` 为 null 导致的崩溃。
2. **打通 `window.__triggerBootAnimation` 完整参数**：
   - 扩展支持 `customDir` 参数，外观设置点击“▶ 预览开机动画”时完整透传 `wallpaperDir`。
3. **解绑主进程与渲染端的强扼杀关系**：
   - 主进程在 `scene` 模式下仅淡出自身黑屏遮罩，绝不向渲染端写入 `__agy_booted__ = true`，交由渲染端接力呈现完整动态。

## 6. 验证与验收标准
- [x] 在“外观设置 -> 开机引导动画”中选用工坊场景壁纸素材（如《落樱少女》或《NFFA画风 雌小鬼》）；
- [x] 点击“▶ 预览开机动画”，开屏画面在短暂首帧海报后平滑过渡至真实的动态渲染（人物呼吸、微动物理、粒子漂浮）；
- [x] 冷启动客户端，开机全屏展示生动的场景动态画面，零拉伸变形；
- [x] 动态场景壁纸在冷启动完成后 1:1 像素平滑无缝溶入主界面动态背景，零缩略图跳变、零黑闪。

## 7. 修复与复盘记录
- **修复方案摘要**：
  1. 修复 DOM 挂载崩溃：在 `client/modules/boot-animation.js` 中重构脚本装载通道，若 `window.WebWallGL` 已就绪直接 resolve，否则轮询宿主可用容器安全追加，彻底根除 `appendChild of null` 导致的降级瘫痪。
  2. 修复 4K 原生大图提取缺陷（解决缩略图闪现）：在 `sidecars/skin-engine/scene-pkg.mjs` 中修复了 TEX 纹理贴图解析时 `imageCount < 1` 的边界判定，放行 `imageCount === 0` 的 4K 原生贴图，成功从 `scene.pkg` 中秒级提取出 3840×2160 的超高清 4K 原图大图（8.28MB）；同时建立了本地双重持久化机制（自动写入壁纸目录 `scene-poster.png` 与全局持久缓存），彻底取代了此前被迫降级回退的 300x300 正方形缩略图 `preview.jpg`。
  3. 冷启动 1:1 像素级大图直接就绪与动态严格对齐：在主进程 LoadingOverlay 候选列表中将当前所选壁纸专属的 `scene-poster.jpg/png` 置为最高优先级，同时在专属缓存 `cache/poster-${wpId}` 中按当前壁纸 ID 精准寻址，彻底杜绝全局写死名称与跨壁纸串图；在主窗口 WebGL2 场景画布首帧就绪后以 450ms 贝塞尔曲线平滑淡出，大图与动态画布 1:1 像素重合，彻底根除“系统准备中用缩略图、加载完成后跳变大图”的尺寸与清晰度闪现！
  4. 选定素材自动持久化原画：在素材库界面（`applyBoot`/`applyWallpaper`）以及 sidecar 配置保存接口（`POST /api/config`）中，引入 `ensureScenePoster` 自动异步提取机制，用户只要选定壁纸，后台即时从 `scene.pkg` 提取 4K/1080P 高清大图并存盘，确保下次无论何时冷启动均能秒出当前所选素材的高清原画。
  5. 补齐预览参数链路：在 `boot-animation.js` 中扩展 `window.__triggerBootAnimation` 参数，支持 `customDir` 显式入参，并在 `appearance-menu.js` 的预览按钮回调中完整传递当前场景目录。
  6. 根治系统准备完成后的黑闪现象：排查发现主进程 LoadingOverlay 淡出后，渲染端接力创建的 `agy-scene-boot-host` 容器原本设置了纯黑底色（`background: #000`），且其承接海报被错误加上了 `filter: blur(28px) brightness(0.22); opacity: 0;`，导致在主进程海报淡出与 WebGL2 场景画布首帧就绪之间的几百毫秒空当内，屏幕出现明显的黑屏闪烁。本次彻底重构：
     - 将渲染端接力宿主改为纯透明背景，承接海报直接以 1:1 像素正常亮度和清晰度（`opacity: 1`）秒级挂载；
     - 在主进程 `startHostReadyCheck` 探测器中增加双向严密握手（确保渲染端宿主挂载且海报图片 `complete` 或 WebGL 画布就绪后才允许主进程淡出）；
     - WebGL2 动态场景首帧渲染后，以 550ms 优雅淡入覆盖海报，海报再隐去，实现全程 100% 连贯平滑的影院级 Cross-fade 溶出，彻底根除交接阶段的黑闪缺陷。
- **效果验证**：✅ 经实机验证与用户最终确认，冷启动系统准备中精准呈现当前所选素材的高清原画，准备完成后 1:1 无缝平滑溶入 WebGL2 动态场景，无缩略图跳变、无黑闪。已正式归档。

---

## 快捷导航
- [⬅ 返回缺陷追踪总清单](./BUG_TRACKING_LIST.md)
- [⬅ 上一个缺陷: BUG-004 - 输入框快捷指令斜杠菜单完全透明，导致文字与背景严重混杂无法辨识](./BUG-004_slash_command_menu_transparent.md)
- [➡ 下一个缺陷: BUG-006 - Windows版运行补丁脚本后官方原版loading依旧出现且导致开屏动效异常](./BUG-006_windows_patch_loading_conflict.md)
