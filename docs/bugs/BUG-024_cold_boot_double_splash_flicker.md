> **导航**：[⬅ 返回缺陷总清单 (BUG_TRACKING_LIST.md)](./BUG_TRACKING_LIST.md)

---

# BUG-024: 冷启动开屏结束时闪黑并再次闪现开屏画面，宿主原生遮罩与前端 DOM 开屏存在异步竞态穿帮

- **缺陷编号**：`BUG-024`
- **涉及需求 / 模块**：开机引导动画 / Windows 原生遮罩与前端通信
- **严重级别**：P1
- **当前状态**：`已修复`
- **发现时间**：2026-10-27
- **修复完成时间**：2026-10-27
- **报告人**：用户实机反馈

## 1. 问题现场

| 环境 | 启动模式 | 异常表现 |
| :--- | :--- | :--- |
| Windows 11 · Antigravity 2.26.0 | 客户端彻底退出后的冷启动 (Cold Boot) | 开屏视频播放 3 秒结束时，屏幕突然黑一下，紧接着底层的开屏画面再次闪现一下，最后才跳入工作区首页 |
| Windows 11 · Antigravity 2.26.0 | 同一会话下的页面重载 / 热更 (Hot-Sync) | 表现正常，单一开屏平滑过渡，无重复闪现 |

## 2. 缺陷现象描述

1. **时序跳变与画面割裂**：
   - 彻底关闭退出客户端后重新打开（冷启动），用户观看开屏动画 3 秒（`autoEnterDelay: 3`）结束后；
   - 画面并未直接平滑进入主页，而是先发生短暂黑屏（“黑一下”）；
   - 紧接着开屏视频的画面又突然在屏幕上闪现了一下（“闪一下开屏”）；
   - 随后该画面被强行掐灭，才露出正式的首页内容。
2. **热调试掩盖冷启动隐患**：
   - 在开发与热更新期间，因为 `sessionStorage['__agy_booted__']` 已经置为 `'true'`，前端第二重开屏在同一会话中被自动跳过；导致在白天的调试中未能及时察觉冷启动状态下的跨进程竞态。

## 3. 根本原因深度分析（代码级诊断）

### 3.1 双重开屏架构缺少第 0 毫秒确定性互斥
- **双重开屏源头**：
  1. **宿主层**：`loadingOverlay.js`（打入 `app.asar` 的 `WebContentsView` 原生窗口遮罩）；
  2. **渲染层**：`client/modules/boot-animation.js`（通过 Sidecar CDP 注入到主页面 DOM 的 `<div id="agy-video-boot-host">`）。
- **冷启动时序空窗**：
  - 宿主 `loadingOverlay.js` 原本通过 `win.webContents.executeJavaScript` 试图写入 `window.__agyMasterBootHandled = true`。但 `executeJavaScript` 属于异步跨进程 IPC；
  - 而 Sidecar 注入是通过 CDP `Page.addScriptToEvaluateOnNewDocument` 在主页面文档创建第 0 毫秒同步生效；
  - 此时底层渲染进程检测 `__agyMasterBootHandled` 为 `undefined`，且冷启动下 `sessionStorage` 为空，前端误以为宿主未接管，在底层 DOM 中也创建了 `<div id="agy-video-boot-host">` 并在幕后同步加载播放。

### 3.2 宿主遮罩移除与底层 DOM 节点销毁存在反向倒挂
- **文件位置**：`loadingOverlay.js` 中的 `doRemove()`
- **诊断细节**：
  ```javascript
  const doRemove = () => {
    if (removed) return;
    removed = true;
    try {
      win.contentView.removeChildView(view); // 步骤 1：先拔除顶层原生遮罩
    } catch (_) {}
    try {
      win.webContents.executeJavaScript(`...h1.remove()...`); // 步骤 2：后异步通知底层销毁 DOM 节点
    } catch (_) {}
  ```
  在顶层原生遮罩被 `removeChildView` 瞬间移除的一刹那，发往渲染进程的 `executeJavaScript` 指令还在 IPC 队列中；
  因此用户肉眼直接看到了底层已经偷跑起来的 `agy-video-boot-host` DOM 画面（闪一下开屏），随后几十毫秒 IPC 到达后节点被 `remove()` 粗暴切除，才进入首页。

## 4. 修复方案实施（多维闭环）

1. **防线 1：Sidecar Client Bundle 注入源头锁定（第 0 毫秒互斥）**
   - 在 `sidecars/skin-engine/main.mjs` 中构建 client bundle 时判断：若为 Windows 平台且已安装补丁（`getBootPatchStatus().patched`）且开启了开机动效，在 bundle 最头部即刻注入：
     ```javascript
     window.__agyMasterBootHandled = true;
     try { sessionStorage.setItem('__agy_booted__', 'true'); } catch (_) {}
     ```
     彻底在 `document_start` 阶段封死前端 DOM 挂载逻辑。
2. **防线 2：前端代码层双保险守护（`client/index.js` & `boot-animation.js`）**
   - 增加对 `window.__agyHostOverlayActive` 标记的联合拦截，若宿主存在遮罩，前端杜绝抢跑。
3. **防线 3：主进程 `loadingOverlay.js` 原子交接防护**
   - 优化 `doRemove()` 执行时序：先异步清理渲染进程中的残留 DOM 节点，在回调确认或 35ms 超时保底后再安全卸载顶层原生 `view`，杜绝任何视口穿帮可能。

## 5. 验收标准
- [x] 彻底退出并重新打开客户端（冷启动），开机视频播放完毕后直接平滑过渡至工作区，不再出现闪黑或二次闪屏；
- [x] 外观设置中的手动预览开机动画（`isManualPreview = true`）不受影响，依然能正常预览。

## 6. 实机验证与复盘记录
- **实机验证结果**：用户彻底退出 Antigravity 客户端后进行多次冷启动实测，开屏视频播放 3 秒后直接平滑溶入工作区首页，黑闪和二次闪现完全消失，符合预期，确认修复封版。
- **技术复盘与沉淀**：
  跨进程（Main Process vs CDP Injected Renderer Process）协作场景下，绝不能依赖异步 IPC 的被动通知来阻止渲染端的高优先级行为。对于全生命周期仅执行一次的屏显动效，必须在文档创建的第 0 毫秒（`Page.addScriptToEvaluateOnNewDocument`）由注入源头注入确定性互斥标志。同时，视图层解绑（`removeChildView`）必须以渲染端清理指令的确认或防死锁定时器为前置条件，确保原子化交接。
