# 🌟 Antigravity Theme & Skin v0.2.4 发布说明

本版本为 **冷启动零黑屏秒级开屏引导、macOS 原生过渡层智能接力、开机时序与气泡阅读深度优化专项版**。彻底消除了 macOS 平台冷启动期间由于本地 Hub 服务初始化耗时与遮罩涂黑引发的“长达数秒死黑屏”断层，实现了全平台一致的冷启动第 0 毫秒秒开开屏动效、平滑无缝溶入工作区的极致启动体验。

---

### 🚀 核心改进与新特性

#### 1. 彻底解决客户端重新打开长时间黑屏才进入开屏动画问题 (macOS Native Boot Overlay 秒级接力)
- **根因诊断**：
  macOS 平台冷启动时，Antigravity 本地 Hub / Language Server 服务启动并返回首个 HTML 存在 4.8 ~ 5.5 秒的物理等待期。官方原生在窗口最顶层挂载了一个带呼吸 Logo 的 `WebContentsView` 遮罩用来填补空窗期。先前逻辑为消除官方 Logo，直接给该遮罩注入样式将其强行设为纯黑并删除了 Logo，导致在后台服务就绪前的整整 5 秒内，屏幕呈现一片死黑；直到 5 秒后官方移走遮罩，底层主窗口才开始执行开屏动效，形成“黑屏很久才进开机动画”的严重视觉脱节。
- **重构方案**：
  - **原生遮罩秒级接管（T=0.1s）**：Sidecar 在 100ms 内检测到顶层原生过渡遮罩后，立即向其注入开屏视频舞台与毛玻璃状态胶囊，从点击打开到开屏视频播放实现零延迟秒播，用高质感全屏画面填满冷启动加载期，物理级消灭死黑等待；
  - **双端确定性互斥防线**：原生遮罩播放时立下 `nativeOverlayBootHandled` 铁锁，主窗口在生成 Client Bundle 时同步注入 `__agyMasterBootHandled = true` 与 `sessionStorage` 互斥标记，底层主窗口 5 秒后加载成型时直接呈现毛玻璃工作区，彻底杜绝冷启动二次开屏与画面闪烁；
  - **优雅降级与暗黑模式适配**：若用户未开启开屏动画，原生遮罩仅平滑自适应为深色并保留官方原生脉冲，绝不粗暴清空导致死黑。

#### 2. 开屏时序与宿主就绪检测深度优化
- **足额保证观赏时长**：拔除开机调度器中根据冷启动时间误扣减倒计时的隐患，确保用户设定的 `autoEnterDelay` 观赏时长完整呈现；
- **末帧优雅保持**：视频播放结束时保持最后一帧画面，消除淡出前清空视频源引发的闪黑断层；
- **宿主就绪全兼容**：宿主交互就绪检测（`__agyIsHostTrulyReady`）全面适配欢迎页、空白工程及主要布局容器，防止在无输入框场景下被误判卡住。

#### 3. 用户提问气泡展开态阅读体验优化
- 彻底解除展开态内部多层嵌套滚动条限制，消除内层细滚动条与外层对话滚动条并排重叠问题；
- 展开态下全文与多图附件完整自然展开，由外部对话视口统一平滑滚动，大幅提升长提问与多图附件的阅读浏览舒适度。

---

### 📦 变更文件一览
- [`sidecars/skin-engine/main.mjs`](file:///Users/colorh/Project/AICODING/antigravity-skin/sidecars/skin-engine/main.mjs)：重构 `handleNativeLoadingOverlay` 原生顶层秒开开屏舞台、注入双端确定性互斥铁锁；
- [`client/modules/boot-animation.js`](file:///Users/colorh/Project/AICODING/antigravity-skin/client/modules/boot-animation.js)：优化开屏倒计时调度器，保证足额播放时长，避免过早掐断；
- [`client/modules/wallpaper.js`](file:///Users/colorh/Project/AICODING/antigravity-skin/client/modules/wallpaper.js)：增强 `__agyIsHostTrulyReady` 首页布局全兼容就绪判定；
- [`client/styles/glass-theme.css`](file:///Users/colorh/Project/AICODING/antigravity-skin/client/styles/glass-theme.css)：优化用户提问卡片展开态视窗与滚动条，消除滚动条并排重叠；
- [`package.json`](file:///Users/colorh/Project/AICODING/antigravity-skin/package.json) / [`plugin.json`](file:///Users/colorh/Project/AICODING/antigravity-skin/plugin.json)：版本号升级至 `v0.2.4`；
- [`CHANGELOG.md`](file:///Users/colorh/Project/AICODING/antigravity-skin/CHANGELOG.md)：版本演进记录归档。

---

### ⚡ 升级指南
已安装插件的用户打开 Antigravity，点击左下角 **「外观设置」** -> **「⚡ 检查更新」**，即可检测到 `v0.2.4` 并点击 **「🚀 立即热更新」** 无感升级！
