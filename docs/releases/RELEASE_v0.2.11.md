# 🌟 Antigravity Theme & Skin v0.2.11 发布说明

本版本为 **适配 Antigravity 新版消息容器与 AI 对话框毛玻璃背景多维容错修复专项版**。针对官方近期更新中重构消息 DOM 结构、移除 `aria-label="Agent response"` 导致 AI 回复卡片丢失毛玻璃衬底并退化为全透明背景的问题进行了全面修复，并建立了多维容错选择器矩阵。

---

### 🚀 核心改进与修复说明

#### 1. 全面适配 Antigravity 新版 AI 回复容器（`data-testid="agent-response"`）
- **根因诊断**：
  Antigravity 官方近期前端更新中移除了 AI 回复外层容器的 `role="article"` 与 `aria-label="Agent response"` 属性，改为了新的 `data-testid="agent-response"`。原先依赖 `aria-label` 属性命中的 CSS 选择器全量失效，导致 AI 回复内容继承了工作区穿透规则（`background: transparent`），正文文字与代码块直接悬浮在透明壁纸上，严重影响阅读体验。
- **双轨选择器升级**：
  - 全面支持 `[data-testid="agent-response"]`、`div[data-testid="agent-response"]`；
  - 完整保留历史 `aria-label` 选择器，确保在不同 Antigravity 版本下均能无缝向下兼容。

#### 2. AI 回复卡片与子元素全量毛玻璃及对比度恢复
- **卡片主体**：
  恢复浅色模式 `var(--agy-agent-light-bg)`（阻光率 65% 水润牛奶磨砂玻璃）与深色模式 `var(--agy-agent-dark-bg)`（黑曜石磨砂玻璃），搭配 28px 高级高斯模糊、微光边框与柔和投影；
- **子元素与代码块**：
  同步修复了 AI 回复卡片内部的代码块（`pre` / `code`）、行内代码胶囊、链接、表格分隔线、次级弱化文字（`text-muted-foreground`）以及语法高亮 Token 的选择器链，杜绝代码块透视与字迹泛白问题。

#### 3. i18n 本地化引擎节点穿透保护增强
- 在 [`client/modules/i18n-engine.js`](client/modules/i18n-engine.js) 中同步加入 `[data-testid="agent-response"]` 容器识别，确保双语本地化引擎准确隔离 AI 生成正文与交互控件。

---

### 📦 变更文件一览
- [`client/styles/glass-theme.css`](client/styles/glass-theme.css)：全面接入 `[data-testid="agent-response"]` 双轨选择器矩阵，恢复 AI 对话框卡片、代码块、链接、表格与语法高亮毛玻璃材质；
- [`client/modules/i18n-engine.js`](client/modules/i18n-engine.js)：增加 `[data-testid="agent-response"]` 容器识别与操作控件保护；
- [`package.json`](package.json) / [`plugin.json`](plugin.json)：版本号升级至 `v0.2.11`；
- [`CHANGELOG.md`](CHANGELOG.md)：登记 v0.2.11 更新记录与版本索引；
- [`docs/releases/RELEASE_v0.2.11.md`](docs/releases/RELEASE_v0.2.11.md)：版本发布说明文档。

---

### ⚡ 升级指南
已安装插件的用户打开 Antigravity，点击左下角 **「设置 - 外观」** -> **「⚡ 检查更新」**，即可检测到 `v0.2.11` 并点击 **「🚀 立即热更新」** 无感升级！
新用户可直接运行 `install.sh`（macOS/Linux）或 `install.bat`（Windows）一键安装。
