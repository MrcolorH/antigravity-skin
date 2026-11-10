# 🌟 Antigravity Theme & Skin v0.2.8 发布说明

本版本为 **全面适配 Antigravity v2.30.0+ 新版架构与动态壁纸毛玻璃穿透修复专项版**。针对官方最新更新引入的全新 Tailwind 样式体系与分层容器布局，全面重构了全局穿透规则，彻底修复了客户端更新后动态壁纸被官方实色画板遮盖、导致壁纸呈现纯白/纯黑一片的故障。

---

### 🚀 核心改进与修复说明

#### 1. 全面适配 Antigravity v2.30+ 容器架构
- **根因诊断**：
  官方自 `v2.30.0` 起对前端界面引入了分层卡片容器架构与 `compiled_tailwind.css`：
  - 新增外层布局壳 `.agy-inset-shell` 并设置了 `.bg-[var(--shell-canvas)]` 与 `--shell-canvas: var(--sidebar)`；
  - 新增工作区容器规则：`.agy-sheet[data-sheet-inset] [data-main-content-body]` 与 `[data-side-panel-body]`，官方强制涂刷了实色背景 `background-color: var(--background)`。
  上述新版专属类名此前未收录进穿透规则白名单，导致官方绘制了一层 100% 不透明实色画板，将底层正常运行的 WebGL 场景与动态壁纸彻底遮挡。
- **架构适配与穿透修复**：
  - 全局重置 `--shell-canvas: transparent !important;`，自顶向下消除一切依赖该变量绘制的背景；
  - 将 `.agy-inset-shell`、`[data-main-content-body]`、`[data-side-panel-body]` 以及 `.agy-sheet[data-sheet-inset]` 全面纳入全局透明与毛玻璃穿透白名单；
  - 完美恢复对话工作区、项目边栏、输入栏与动态壁纸的全局通透毛玻璃质感。

#### 2. 优化 macOS 原生过渡层守护会话重连逻辑
- **连接状态闭环管理**：
  - 修复了 macOS 端原生 `loadingOverlay` 会话在完成渐变中和并安全关闭连接后，因关闭事件意外清空状态缓存而引发的高频周期性重连尝试；
  - 保持已处理标记，仅当 Chromium `Target.targetDestroyed` 生命周期触发时再做清理，彻底消除守护进程后台无意义的日志刷屏与多余调度开销。

---

### 📦 变更文件一览
- [`client/styles/glass-theme.css`](client/styles/glass-theme.css)：适配 Antigravity 2.30+ 容器，覆盖 `--shell-canvas`，补全 `.agy-inset-shell` 与 `[data-main-content-body]` 等穿透规则；
- [`sidecars/skin-engine/main.mjs`](sidecars/skin-engine/main.mjs)：优化 `loadingOverlay` 会话关闭逻辑，避免重连日志循环；
- [`package.json`](package.json) / [`plugin.json`](plugin.json)：版本号升级至 `v0.2.8`；
- [`CHANGELOG.md`](CHANGELOG.md)：登记 v0.2.8 更新说明与索引。

---

### ⚡ 升级指南
已安装插件的用户打开 Antigravity，点击左下角 **「设置 - 外观」** -> **「⚡ 检查更新」**，即可检测到 `v0.2.8` 并点击 **「🚀 立即热更新」** 无感升级！
新用户可直接运行 `install.sh`（macOS/Linux）或 `install.bat`（Windows）一键安装。
