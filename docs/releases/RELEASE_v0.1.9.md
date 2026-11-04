# 🌟 Antigravity Theme & Skin v0.1.9 发布说明

本版本为 **冷启动开屏体验优化与跨进程原子交接专项修复版**。

彻底消除了彻底退出客户端（冷启动）后开屏视频播放结束时「黑一下 → 闪一下开屏 → 进首页」的时序竞态穿帮，实现了电影级丝滑单一开屏与首页无缝平滑溶入。

---

### 🐛 核心缺陷修复 (BUG-024)

#### 🛡️ 冷启动双重开屏与闪黑/二次闪现穿帮彻底根除
- **现象回顾**：
  在彻底关闭客户端后重新打开时，开屏动画播放完毕后屏幕会先黑一下，底层已在静默偷跑的前端开屏视频突然在屏幕上闪现露馅，随后被切除跳入首页。
- **根因分析**：
  - **双重开屏竞态**：宿主层（`loadingOverlay.js` 原生 WebContentsView）与前端 DOM 层（`boot-animation.js` 中的 `<div id="agy-video-boot-host">`）在冷启动第 0 毫秒缺少同步互斥锁；
  - **倒序拔除穿帮**：宿主遮罩先调用了 `removeChildView` 拔除了顶层原生视图，随后才异步下发清理底层 DOM 的 IPC 指令，导致底层偷跑的视频画面在几十毫秒的时间窗口内暴露。
- **三大递进拦截防线**：
  1. **第 0 毫秒源头封锁**：Sidecar 注入 client bundle 时，在 Windows 补丁环境下于文档初始化的第 0 毫秒（`document_start`）首行同步立下 `window.__agyMasterBootHandled = true` 铁锁，从根本上阻止前端 DOM 容器并行挂载；
  2. **前端代码层双保险守护**：`index.js` 与 `boot-animation.js` 引入对宿主遮罩活性标记 `window.__agyHostOverlayActive` 的联合拦截，日常冷启动绝不抢跑；
  3. **宿主遮罩移除原子化倒序重构**：调整 `doRemove()` 顺序为**先向底层渲染进程发送清除指令并唤醒底层壁纸，待确认回调或 35ms 超时保底后再安全卸载顶层原生视图**，彻底消除任何闪屏与画面残留。

---

### 🎨 其余优化与维护

- **外观设置面板手动预览兼容**：修复后外观设置中的「手动预览开机动画」（`isManualPreview = true`）依然完美支持，不受互斥锁影响。
- **跨平台一致性保证**：macOS 平台的纯净非侵入 CDP 架构与原生红绿灯按钮不受影响。

---

### 📦 安装与升级指南

下载 Release 资产包 `antigravity-skin.zip`，解压后覆盖安装或运行对应系统的安装脚本（Windows 运行 `install.bat`，macOS/Linux 运行 `install.sh`）即可。
Windows 用户亦可双击 `self-heal.bat` 验证补丁与自愈状态。
