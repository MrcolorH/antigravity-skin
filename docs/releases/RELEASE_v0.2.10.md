# 🌟 Antigravity Theme & Skin v0.2.10 发布说明

本版本为 **用户消息气泡展开态 50vh 最大高度限制与自包含滚动专项版**。针对用户提问卡片展开时由于长文本与附件过高撑满屏幕、遮挡下方 AI 消息流的体验问题进行了深度优化与视窗保护。

---

### 🚀 核心改进与修复说明

#### 1. 展开态视窗最大高度保护（最高为总窗口一半）
- **现象背景**：
  在之前的版本中，用户提问卡片展开态完全解除了高度限制（`max-height: none`）。当用户发送较长的需求文档、日志或大段代码并点击展开时，卡片垂直高度无限膨胀，严重遮盖甚至霸占大半个工作区，阻碍了对后续对话上下文与输入框的正常查看。
- **重构方案**：
  - 对展开态（`data-user-collapsed="false"`）下的卡片容器主体施加 `max-height: 50vh !important` 严格视窗保护，确保卡片展开时最高仅占总视口的一半；
  - 内容较短时保持自适应贴合，仅在内容超出总窗口一半时精准触发高度封顶。

#### 2. 自包含平滑滚动与滚动防穿透
- 卡片主体启用 `overflow-y: auto !important` 与 `overscroll-behavior: contain !important`；
- 超出 $50\text{vh}$ 时自动激活半透明晶莹圆角细滚动条，支持卡片内部平滑滚动浏览；
- 滚动至顶部或底部时杜绝连带影响外部消息流页面滚动（消除滚动连锁穿透）。

#### 3. 内部多层嵌套滚动条彻底清空
- 将卡片内部子容器（`.flex-1`、`[data-testid="user-message-content"]`、`[data-testid="user-message-bubble"]` 等）的独立滚动条彻底抹平（`scrollbar-width: none` 与 `::-webkit-scrollbar { display: none }`）；
- 杜绝卡片内外多层滚动条并排重叠的问题，保证视觉纯净清爽。

---

### 📦 变更文件一览
- [`client/styles/glass-theme.css`](client/styles/glass-theme.css)：增加展开态 `50vh` 最大高度限制、卡片自包含平滑滚动、深浅色模式滚动条适配与内部嵌套滚动条清空；
- [`package.json`](package.json) / [`plugin.json`](plugin.json)：版本号升级至 `v0.2.10`；
- [`CHANGELOG.md`](CHANGELOG.md)：登记 v0.2.10 更新说明；
- [`docs/releases/RELEASE_v0.2.10.md`](docs/releases/RELEASE_v0.2.10.md)：发布说明文档。

---

### ⚡ 升级指南
已安装插件的用户打开 Antigravity，点击左下角 **「设置 - 外观」** -> **「⚡ 检查更新」**，即可检测到 `v0.2.10` 并点击 **「🚀 立即热更新」** 无感升级！
