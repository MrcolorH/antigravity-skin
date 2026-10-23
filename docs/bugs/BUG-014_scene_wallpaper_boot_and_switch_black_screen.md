> **导航**：[⬅ 返回缺陷总清单 (BUG_TRACKING_LIST.md)](./BUG_TRACKING_LIST.md)

---

# BUG-014: 场景壁纸切换及开屏后黑屏早退，且多图层场景出现“空背景-黑屏-突现主角”穿帮

- **缺陷编号**：`BUG-014`
- **涉及需求 / 模块**：Wallpaper素材库集成 (`client/modules/wallpaper.js`, `loadingOverlay.js`, `scripts/patch-boot-overlay.mjs`, `scripts/sync-all.mjs`, `docs/plan/Wallpaper素材库集成/阶段11_*.md`)
- **严重级别**：P1（视觉割裂、状态阻断与图层时序缺陷）
- **当前状态**：`已修复`
- **发现时间**：2026-10-23
- **修复完成时间**：2026-10-23
- **报告人**：用户

## 1. 问题现场与说明
用户反馈：
> “动态壁纸，使用场景类型素材的时候，前置总是有黑屏，尤其是在切换壁纸和开屏动画结束后，怀疑是壁纸内部自带的前置loading，或者就是加载需要时间。  
> 我想要开屏loading时，系统加载完成，将首页加载好之后，再允许用户点击进去首页。这个可行吗？给个方案。现在其实是调整过的，但是不生效。  
> 我不想只支持视频格式。参考 https://github.com/WallpaperMachine/WallpaperMachine 这个仓库里是否有解决方案，它的macapp能完美支持场景类的素材。方案中加一条‘开机动效引擎修复’这个功能里的脚本也要同步更新。”  
> 
> 随后的实机反馈：  
> “开屏等待倒是有了，进首页不黑屏也有了，但是壁纸本身好像很奇怪，有前置一些环节，比如我现在用的这个壁纸，刚打开是一个无人的场景，等一会会黑屏然后变成这个带着龙的妹子。  
> 我怀疑无人场景和黑屏是场景素材里的。但是在成熟的壁纸引擎中是没有这个阶段的。所以是否我的pkg解析器写的有问题，应该删减掉一些部分？”

## 2. 深入排查与根因深度诊断
通过深入克隆并阅读 [WallpaperMachine](https://github.com/WallpaperMachine/WallpaperMachine) 的官方源码（`Renderer/Engine/src/Scene/WPPkgFs.cpp` 与 `Renderer/Surface/StillPreview.hpp`），对比排查出本项目存在的 4 个关键死穴：

1. **就绪检测存在“伪就绪提前放行”漏洞**：
   在 `client/modules/wallpaper.js` 的 `__agyIsHostTrulyReady` 中，当 WebWallGL Canvas 尚未出帧时，若静态海报（Poster）先完成加载，代码提前返回了 `true`。主进程误判就绪提前关闭开屏遮罩，露出未编译完的动态场景与黑屏。
2. **切换壁纸时的“自毁式清场”导致黑屏断层**：
   在 `mountSceneDynamic` 中，切换新壁纸时立即执行 `box.querySelectorAll('canvas').forEach(c => c.remove())` 抹除旧画布，而海报层透明度为 0，在新壁纸出首帧前造成 1~2 秒的全黑底板。
3. **“无人的场景”源于静态海报提取器选错单层底图**：
   `scene-pkg.mjs` 中的 `extractScenePoster` 算法为寻找最大画布分辨率，精准挑中了《熠烛 御剑驭龙-红鸾樱落》65 个图层中的 `obj 0: 新壁纸，樱`（纯背景风景，无主角、无龙），并将人物骨骼当成部件过滤。前端在动态场景未完成时挂载了该底图，造成“空无一人”的严重穿帮。WallpaperMachine 源码证实：其压根没有海报提取器，绝不把半成品单层图当封面。
4. **“前置黑屏”源于 WebWallGL Camera Fade 未关闭**：
   Wallpaper Engine 场景素材配置了 `camerafade: true`（相机从黑淡入），且新 Canvas 插入瞬间图层贴图未全部上传至 GPU。Canvas 遮住底图时呈黑色，淡入后主角才出现。WallpaperMachine 源码未实现 camerafade，从物理上避开了黑屏。

## 3. 建议与实施修复方案
结合 WallpaperMachine 的**“原子性呈现（Atomic Presentation）与双缓冲”**哲学，重塑动态场景状态机：

1. **彻底废除动态模式下的单层半成品海报曝光（断舍离）**：
   - 在 `mountScene` 中，当处于 `dynamic` / `eco` 动态渲染模式时，强制将海报 `img` 设置为 `display: none`；
   - 严禁在动态场景装配期间提前暴露空无一人的背景底图；海报仅在静态档位（`static`）或 WebGL 崩溃报错时充当容灾兜底。
2. **强行掐灭素材相机黑屏淡入（Kill Camera Fade）**：
   - 在 WebWallGL 挂载参数中显式注入 `fade: false, fadeDuration: 0`，强制将素材自带的相机全黑淡入掐灭，确保从第一帧起即为全彩画面。
3. **幕后深度暖机与真就绪阻断（Offscreen Burn-in 1200ms）**：
   - 开屏动画死守视口，让 WebWallGL 在幕后安静完成 65 个图层的 GPU 贴图上传；
   - 权威就绪检测 `__agyIsHostTrulyReady` 严格要求动态首帧稳定存活 `>= 1200ms` 才返回 `true`；未就绪前用户按键或点击只提示“`正在载入主界面与动态场景...`”，严禁早退。
4. **原子性双缓冲换轨（Double Buffering Cross-fade）**：
   - 切换壁纸时旧 Canvas 标记为 `agy-scene-retiring` 保持最上层渲染；新 Canvas 出帧稳定后通过 500ms 电影级淡入覆盖，再安全销毁旧实例，全程 0 毫秒黑屏。
5. **全链路同步更新“开机动效引擎修复”脚本**：
   - 将 `loadingOverlay.js` 同步纳入构建与插件安装清单；
   - 重新执行在线热注入，将最新防早退与深度就绪检测打入宿主 `app.asar`。
6. **归档阶段规划文档**：
   - 建立专用阶段规划：[`阶段11_场景壁纸原子性呈现与无缝换轨引擎（参考WallpaperMachine）.md`](../plan/Wallpaper素材库集成/阶段11_场景壁纸原子性呈现与无缝换轨引擎（参考WallpaperMachine）.md)。

## 4. 验证与验收标准
- [x] 1. `client/modules/wallpaper.js` 落地双缓冲切换机制，旧画面保持到新画面淡入后才销毁；
- [x] 2. `window.__agyIsHostTrulyReady` 修复漏洞，动态场景必须出首帧并预跑 1.2 秒才判定就绪；
- [x] 3. 动态模式下海报 `img` 彻底隐藏，杜绝多图层场景（如 3233141951）出现“空无一人”的底图穿帮；
- [x] 4. WebWallGL 显式注入 `fade: false`，彻底消除相机 1 秒黑屏；
- [x] 5. `loadingOverlay.js` 与插件脚本目录全量同步，主进程 `app.asar` 在线热注入完成；
- [x] 6. 实机用户验证：开屏等待结束点击进入首页，直接呈现 4K 原生动态成型画面，0 空背景、0 黑屏；素材库连续切换壁纸无黑闪。

## 5. 修复与复盘记录
- **技术复盘**：
  1. **不要用静态思维去解决动态场景的问题**：场景壁纸由几十个图层、着色器和网格动画实时合成，从二进制中强行提取单张静态图片往往只能拿到没有主角的底板；试图用静态图片作为动态画面的垫底，反而会给用户带来“先看到半成品，再看到成品”的拼凑感与割裂感；
  2. **深入开源对标是破局的关键**：通过深挖 WallpaperMachine 源码发现，优秀的原生壁纸引擎从来不展示半成品，它要么不露，一露就是 100% 完整的帧缓冲区（Layer holds last frame）。引入“原子性呈现”与“后台充分暖机”后，彻底根治了该顽疾。
- **验证结论**：✅ 经用户多轮实机重启与壁纸切换确认，多图层场景壁纸前置黑屏与空场景问题彻底消除，开屏与换轨体验流畅丝滑。本缺陷正式核销并封版归档。

---

## 快捷导航
- [⬅ 返回缺陷追踪总清单](./BUG_TRACKING_LIST.md)
- [⬅ 上一个缺陷: BUG-013 - 开屏动画到首页先缓黑后闪现白屏且缺少丝滑过渡效果](./BUG-013_boot_to_home_black_to_white_flash.md)
- [➡ 下一个缺陷: BUG-015 - 场景素材动态壁纸在切换至深色模式后画面消失并呈现全黑底色](./BUG-015_scene_wallpaper_dark_mode_black_screen.md)
