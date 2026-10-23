> **导航**：[⬅ 返回缺陷总清单 (BUG_TRACKING_LIST.md)](./BUG_TRACKING_LIST.md)

---

# BUG-017: 场景壁纸模式冷启动核心样式缺失导致会话加载器错位、视口滚动条溢出与10秒死锁

- **缺陷编号**：`BUG-017`
- **涉及需求 / 模块**：Wallpaper素材库集成 (`client/modules/wallpaper.js`, 会话切换动效引擎, 宿主深度就绪判定)
- **严重级别**：P0（紧急致命缺陷：阻断开屏秒级放行并导致视口严重变形撑出滚动条）
- **当前状态**：`已修复`
- **发现时间**：2026-10-23
- **修复完成时间**：2026-10-23
- **报告人**：用户实机测试反馈

## 1. 缺陷现象描述
1. **错位的旋转 Loading 与视口纵向滚动条**：
   在开屏动画启动时以及进入首页后，窗口左下角均露出一半截旋转中的圆环 Loading 菊花（`aria-label="Loading session"` SVG）。主窗口右侧与底部被强制撑出全局滚动条，把主工作区往上顶起约 32px，露出了最底部的一截背景壁纸。
2. **长达 10 秒的假死阻塞**：
   该错位 Loading 与滚动条在进入首页后长达约 10 秒内不消失；直到整整 10 秒后才停止加载，滚动条瞬间消失，正确的动态壁纸才最终显示出来。

## 2. 期望表现（规范定义）
1. **严禁破坏文档流与视口**：
   会话切换 Loading 层单例应当仅在用户显式切换历史会话时按需激活，平时必须处于绝对物理隐藏状态，绝不允许作为普通 Block 流元素把 `body` 撑开产生滚动条；
2. **全形态样式零缺失**：
   无论是视频模式、网页模式还是场景壁纸模式，全局基础毛玻璃样式表 `#agy-dynamic-wallpaper-style` 必须在第 0 毫秒挂载就绪；
3. **极速就绪秒级放行**：
   宿主权威深度就绪检测 `__agyIsHostTrulyReady` 应在 1~2 秒内检测到首帧与核心 UI 正常就绪放行，杜绝触发 10 秒超时保底机制。

## 3. 根本原因深度分析

### 3.1 致命断点：场景壁纸分支漏调 `ensureStyle()`
在 `client/modules/wallpaper.js` 的互斥挂载入口中，原代码仅在视频模式 `realMountVideo()` 的末尾调用了全局样式注入方法 `ensureStyle()`：
```javascript
// 旧代码：场景模式与网页模式只调用了自身特有样式，遗漏了核心全局毛玻璃与组件样式！
if (mode === 'scene') {
  destroyVideoEl();
  destroyWebEl();
  return mountScene(fadeIn); // 内部仅调用 ensureSceneStyle()，漏调 ensureStyle()
}
```
当用户启用 Wallpaper 场景壁纸（`sourceType === 'scene'`）时，`<style id="agy-dynamic-wallpaper-style">`（内含毛玻璃样式、全局基础布局以及 `.agy-session-loader-overlay` 的类定义）在冷启动早期**完全没有被注入到页面 DOM 中**！

### 3.2 裸奔上屏：Session Loader 缺乏内联样式防线
会话切换管理引擎 `createSessionTransitionManager` 在模块被执行的第一时间调用了 `ensureOverlay()`，无条件向 `document.body` 追加了 `<div id="agy-session-loader-overlay">...</div>`：
- 该节点此前完全依赖外部 CSS 类 `.agy-session-loader-overlay`（`position: fixed; opacity: 0; visibility: hidden;`）来隐匿和定位；
- 因断点 3.1 导致外部 CSS 缺失，该节点降级为普通 `display: block; position: static;` 块级元素，直接排在 `body` 最末端；
- 由于内部包含 Antigravity 官方 Tailwind 的 `animate-spin` 动画类，该 32px 高度的 SVG 图标一直旋转，并将 `body` 撑出了 32px 额外高度，直接触发了 Chromium 窗口原生纵向滚动条，并露出了最底部的底层壁纸。

### 3.3 宿主就绪检测死锁并击中 10 秒保底
在 `window.__agyIsHostTrulyReady` 以及主进程 `loadingOverlay.js` 的就绪判定中，有一项铁律规则：
```javascript
// 3. 毛玻璃样式已生效
if (!document.getElementById('agy-dynamic-wallpaper-style')) return false;
```
由于场景模式冷启动漏掉了 `ensureStyle()`，`#agy-dynamic-wallpaper-style` 为 `null`，检测逻辑次次返回 `false`。
系统判定进入僵死等待，直到击中 `loadingOverlay.js` 的 10 秒极限安全超时（`Date.now() - startTime > 10000`）强行放行。超时放行后，开屏遮罩解锁，后续链路自愈补挂了样式表，CSS 生效使该节点获得 `position: fixed; opacity: 0;`，滚动条瞬间消失，壁纸呈现。

## 4. 实施修复方案

### 4.1 全形态壁纸无条件确保核心样式注入
在 `client/modules/wallpaper.js` 中：
1. 在互斥挂载总入口 `mountMedia()` 最顶部增加无条件 `ensureStyle()` 调用；
2. 在 `mountScene()`、`mountWeb()` 及壁纸入口 `mountVideo()` 中加入 `ensureStyle()` 多重防御；
3. 确保在任何壁纸形态（包括场景壁纸冷启动第 0 毫秒）下，`#agy-dynamic-wallpaper-style` 均优先就绪。

### 4.2 为 Session Loader Overlay 构筑内联绝对物理防线
在 `createSessionTransitionManager` 的 `ensureOverlay()` 中：
1. 为 `#agy-session-loader-overlay` 直接内联赋予绝对定位与隐匿安全样式：
   ```javascript
   el.style.cssText = 'position:fixed!important;top:0!important;right:0!important;bottom:0!important;left:var(--agy-sidebar-right, 354px)!important;display:flex!important;align-items:center!important;justify-content:center!important;pointer-events:none!important;user-select:none!important;opacity:0!important;visibility:hidden!important;z-index:99999!important;transform:translateZ(0)!important;';
   ```
   杜绝任何因 CSS 加载延迟或外部样式缺失导致降级为普通流块级元素的可能；
2. 消除冷启动贪婪挂载，改为在 `showSessionLoading()` 首次触发时按需挂载；
3. 在 `showSessionLoading()` 与 `hideSessionLoading()` 中同步切换行内 `opacity` 与 `visibility`。

## 5. 验证与验收标准
- [x] 1. 场景壁纸模式下冷启动，第 0 毫秒即刻注入 `#agy-dynamic-wallpaper-style`；
- [x] 2. 开屏动画期间视口规整，窗口边缘绝不出现纵向/横向滚动条；
- [x] 3. 开机及进入首页时，左下角彻底消除错位的旋转 Loading 菊花；
- [x] 4. 宿主深度就绪检测 `__agyIsHostTrulyReady` 摆脱 10 秒超时死锁，在场景首帧出帧后（1~2秒）即刻平滑放行；
- [x] 5. 切换历史会话时，Loading 菊花依然能在正中央精准秒开秒关、平滑过渡。

## 6. 复盘与封版归档
- **验证结果**：用户实机冷启动与日常切换验证全部通过，错位 Loading 彻底消除，滚动条消失，10 秒超时死锁解除，壁纸渲染秒级呈现。
- **归档状态**：`已封版归档`
- **归档时间**：2026-10-23

