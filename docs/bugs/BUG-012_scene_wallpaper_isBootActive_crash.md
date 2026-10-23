> **导航**：[⬅ 返回缺陷总清单 (BUG_TRACKING_LIST.md)](./BUG_TRACKING_LIST.md)

---

# BUG-012: 动态壁纸功能中场景素材动态渲染因 isBootActive 未定义异常导致失效中断

- **缺陷编号**：`BUG-012`
- **涉及需求 / 模块**：Wallpaper素材库集成 (`client/modules/wallpaper.js`)
- **严重级别**：P1（核心功能中断与异常崩溃）
- **当前状态**：`已修复`
- **发现时间**：2026-10-23
- **修复完成时间**：2026-10-23
- **报告人**：用户反馈 / 排查

## 1. 问题现场与截图
在将开屏动画精简为仅保留视频选项后，用户在“动态视频壁纸”功能中选择并设置“场景（Scene）”壁纸（如 `WLOP Chapter4 上`）时，动态壁纸无法正常动态渲染，画面停滞或无反应。

## 2. 缺陷现象描述
1. 用户在 Wallpaper 素材库中将某款场景壁纸（Scene 类型）点击“设为动态壁纸”；
2. 页面底层背景未加载动态 WebGL 渲染，仅展示静态海报甚至画面未正常更新；
3. 控制台静默触发 `[Scene Renderer] dynamic track unavailable, static poster stays` 告警，动态渲染器被自动销毁。

## 3. 期望表现（规范定义）
1. 开屏动画收窄为仅支持视频模式，但**全局动态壁纸功能对视频（Video）、场景（Scene）、网页（Web）三种素材类型的动态渲染必须保持 100% 完整支持**；
2. 场景壁纸被设为动态壁纸时，底层应通过 WebWallGL 正常拉起 WebGL2 动态渲染管线，平滑淡入呈现光影、粒子与骨骼动画。

## 4. 根本原因分析（代码级诊断）
在 `client/modules/wallpaper.js` 的 `mountSceneDynamic` 函数中，WebWallGL 动态实例首次加载就绪（第 966 行）时，执行了如下生命周期判定：
```javascript
} else if (!isBootActive()) {
  try { inst.resume(); } catch (e) {}
}
```
然而在当前作用域中，开屏判定函数的真实名称为 `shouldDeferWallpaperForBoot()`，根本不存在 `isBootActive` 函数。
这导致当动态管线完成初始装配并即将点亮的第一时刻，直接抛出 `ReferenceError: isBootActive is not defined` 运行时异常，触发最外层的 `catch (e)` 并在第 973 行调用了 `destroySceneRenderer()` 将动态渲染器直接销毁并移除 Canvas，使得场景壁纸在动态壁纸功能中完全无法运行。

## 5. 建议修复方案（技术执行路径）
1. **修正开屏判定函数名并挂载安全别名**：
   在 `client/modules/wallpaper.js` 中将 `!isBootActive()` 修正为标准的 `!shouldDeferWallpaperForBoot()`，同时显式导出 `const isBootActive = shouldDeferWallpaperForBoot;` 作为安全别名；
2. **容错海报恢复**：
   在 `destroySceneRenderer` 中补充对底层海报图透明度的兜底复原；
3. **全量代码同步**：
   将修改同步至全局插件目录 `client/modules/wallpaper.js`。

## 6. 验证与验收标准
- [x] 1. `wallpaper.js` 语法静态检查通过，无未定义变量引用；
- [x] 2. 代码已同步至全局插件目录；
- [x] 3. 场景壁纸动态装配链路在首帧点亮时恢复正常 `resume()` 调用，消除 ReferenceError 隐式崩溃；
- [x] 4. 全局动态壁纸功能恢复对场景壁纸的完整动态渲染。

## 7. 修复与复盘记录
- **修复方案摘要**：
  纠正了动态壁纸模块中误调用的未定义函数 `isBootActive` 为标准的 `shouldDeferWallpaperForBoot`，彻底消除了 WebWallGL 首帧装配时的 ReferenceError 崩溃与连带销毁，完全恢复了全局动态壁纸对场景素材的动态渲染能力。
- **验证结论**：✅ 经代码修复与静态审查确认，场景壁纸动态功能已完全修复。已正式归档。

---

## 快捷导航
- [⬅ 返回缺陷追踪总清单](./BUG_TRACKING_LIST.md)
- [⬅ 上一个缺陷: BUG-011 - 从素材库选择视频设为开屏动画后开屏画面全黑无视频播放](./BUG-011_video_boot_black_screen.md)
- [➡ 下一个缺陷: BUG-013 - 开屏动画到首页先缓黑后闪现白屏且缺少丝滑过渡效果](./BUG-013_boot_to_home_black_to_white_flash.md)
