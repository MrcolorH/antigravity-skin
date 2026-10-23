> **导航**：[⬅ 返回缺陷总清单 (BUG_TRACKING_LIST.md)](./BUG_TRACKING_LIST.md)

---

# BUG-019: macOS客户端启动时闪烁黑屏白屏再延迟进入开屏动画

- **缺陷编号**：`BUG-019`
- **涉及需求 / 模块**：Wallpaper素材库集成 (`sidecars/skin-engine/main.mjs`, `client/modules/boot-animation.js`, `client/index.js`, 跨平台启动架构)
- **严重级别**：P1（视觉体验断层、黑白频闪与开屏时钟竞态）
- **当前状态**：`已修复`
- **发现时间**：2026-10-24
- **修复完成时间**：2026-10-24
- **报告人**：用户实机测试反馈 (macOS)

---

## 1. 缺陷现象描述
在 macOS 客户端配置了开机引导动画并冷启动 Antigravity 时，画面呈现严重割裂的跳变断层：
1. **第一段：先闪黑屏**：官方原生反重力脉冲圆环 Logo 闪烁被强行置黑；
2. **第二段：紧接着闪现刺眼白屏**：官方遮罩被主进程卸载，底层裸露的主窗口由于样式与主题尚未就绪，在屏幕上产生 100~300ms 的浅色/白色底板闪现；
3. **第三段：延迟进入开屏动效**：经过数百毫秒的异步脚本解析与挂载后，全屏开屏动效才终于弹出来播放。

用户体验为：**黑屏 ➔ 白屏 ➔ 开屏动画** 的连续闪烁与割裂感。

---

## 2. 期望表现（规范定义）
1. **macOS 零改包与代码签名 100% 完整**：恪守 Apple Gatekeeper 安全机制，不触碰系统 `app.asar`；
2. **绝对零白闪、零跳变**：从 Electron 窗口展开、官方遮罩退场到前端开屏动效播放，整个视口底板必须全程物理级保持纯黑 (`#000000`)；
3. **影院级平滑无缝接力**：官方原生遮罩在退场时，底层主窗口早已准备好同色纯黑舞台，开屏视频首帧出帧即无感呈现，实现 macOS 与 Windows 双平台一致的极致启动体验；
4. **两端隔离**：macOS 的启动防闪机制与 Windows 的 ASAR 主进程极速轨物理隔离，互不干扰。

---

## 3. 根本原因深度分析

### 3.1 跨平台架构本质差异
- **Windows 极速轨**：通过 `patch-loading.bat` 将自研 `loadingOverlay.js` 打包进系统 `resources/app.asar`，Electron 在创建主窗口的第 0 毫秒直接由主进程挂载全屏视频 WebContentsView，因此 Windows 拥有 T=0 秒硬解秒播能力；
- **macOS 纯净轨**：为避免触发 macOS Gatekeeper 签名报毒或闪退，macOS 严禁修改 `app.asar`，只能由外部 Sidecar 守护进程通过 Chromium DevTools Protocol (CDP) 动态向主窗口渲染层注入。

### 3.2 官方遮罩提前自毁与底色真空空档
官方原版 `loadingOverlay.js` 的生命周期为：
```javascript
win.webContents.once('did-finish-load', () => {
  win.contentView.removeChildView(view);
});
```
当主窗口完成基本 HTML 文档加载时，官方主进程即刻无条件移走 Loading 遮罩。
而此时：
1. Sidecar 通过 CDP 的 `handleNativeLoadingOverlay` 已将官方遮罩强行刷黑（导致用户先看到黑屏）；
2. 官方主进程触发 `removeChildView` 把遮罩移除；
3. **底层主窗口的 DOM 尚未注入皮肤主题和开屏动画**，默认的浅色底板暴露在屏幕上（导致刺眼白闪）；
4. 随后，Sidecar 注入的庞大 Client Bundle 执行完毕，`boot-animation.js` 插入 `#agy-video-boot-host` 并载入视频（开机动画延迟出现）。

---

## 4. 实施修复方案

### 4.1 macOS 专属 CDP 硬件级视口底板置黑（T=0ms）
在 `sidecars/skin-engine/main.mjs` 中，当检测到主窗口（`Target.isMainAppTarget`）并在 `ws.onopen` 握手的第 0 毫秒：
```javascript
if (process.platform === 'darwin') {
  const cfg = readConfig();
  if (cfg?.enabled && cfg?.features?.bootAnimation) {
    // 1. 底层 Chromium 渲染器画布强制置黑，物理级杜绝任何白闪
    await send('Emulation.setDefaultBackgroundColorOverride', {
      color: { r: 0, g: 0, b: 0, a: 1 }
    });
    // 2. 0ms 内联纯黑根节点防护样式
    await send('Runtime.evaluate', {
      expression: `(() => {
        try {
          if (sessionStorage.getItem('__agy_booted__')) return;
          document.documentElement.style.background = '#000000';
          if (document.body) document.body.style.background = '#000000';
          if (!document.getElementById('agy-macos-anti-flash')) {
            const st = document.createElement('style');
            st.id = 'agy-macos-anti-flash';
            st.textContent = 'html, body { background: #000000 !important; }';
            (document.head || document.documentElement).appendChild(st);
          }
        } catch (_) {}
      })()`
    });
  }
}
```

### 4.2 Client Bundle 最前置置黑防线
在 `buildClientBundle()` 生成的代码最顶部，前置注入防闪白纯黑样式，确保无论网络与解析快慢，主窗口在 DOM 开始绘制的瞬间即为纯黑，与官方黑色遮罩严丝合缝衔接。

### 4.3 开屏动画平滑退出与底色覆盖安全释放
1. 在 `sidecars/skin-engine/main.mjs` 中新增 `/api/boot-finished` 路由；
2. 当开机引导动画播放完毕或用户按下 ESC 跳过进入工作区时：
   - 渲染端 `client/modules/boot-animation.js` 自动清理 `#agy-macos-anti-flash` 并恢复 `document.documentElement` 底色；
   - 自动向 Sidecar 发送 `/api/boot-finished`，Sidecar 调用 `Emulation.setDefaultBackgroundColorOverride` 清除底色覆盖；
   - 视口无缝交还给动态壁纸与毛玻璃主题工作区。

---

## 5. 跨平台隔离与验证标准
- [x] 1. 所有 macOS 专属底色重载逻辑严格受 `process.platform === 'darwin'` 守卫；
- [x] 2. Windows 平台（`win32`）不受任何影响，继续保持 `v0.1.4` 主进程 DirectComposition 极速秒播与秒进；
- [x] 3. macOS 冷启动全程背景严格恒定为纯黑，彻底消灭“黑屏 ➔ 白屏 ➔ 开屏”闪烁断层；
- [x] 4. 开机动画退出后，毛玻璃主题与动态壁纸正常渲染，底板覆盖干净释放无残留；
- [x] 5. 语法检查与跨平台编译 100% 通过。

---

## 6. 归档与封版
- **归档状态**：`已封版归档`
- **归档时间**：2026-10-24

---

## 快捷导航
- [⬅ 返回缺陷追踪总清单](./BUG_TRACKING_LIST.md)
- [⬅ 上一个缺陷: BUG-018 - Windows客户端开屏动画退出进入首页出现450ms黑屏停滞一闪而过](./BUG-018_windows_boot_black_flicker_and_delay_stuck.md)
