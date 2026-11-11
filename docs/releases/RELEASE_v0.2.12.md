# 🌟 Antigravity Theme & Skin v0.2.12 发布说明

本版本为 **AI 回复正文与工具链毛玻璃气泡形态全场景统一专项版**。针对用户反馈在不同阶段消息气泡形态不一致（工具运行态具备完整的毛玻璃圆角气泡，而生成正文阶段出现背景脱落或视觉割裂）的体验问题，进行了全生命周期气泡形态统一、多语言属性容错与容器闭环加固。

---

### 🚀 核心改进与修复说明

#### 1. 全生命周期消息气泡形态统一
- **消除形态差异**：
  统一了 AI 消息在工具调用运行态（`Tool Group / Execution Steps`）与最终正文输出态（Markdown、文本总结、代码块、数据表格）的视觉气泡规格，确保从思考到输出始终保持高质感的统一圆角磨砂气泡卡片；
- **材质与圆角精密对齐**：
  卡片主体严格统一为 18px 大圆角、65% 阻光率水润牛奶磨砂玻璃（浅色）/ 70% 黑曜石磨砂玻璃（深色）、28px 高级高斯模糊与极细微光边框，彻底消除正文浮在壁纸上的透明脱底问题。

#### 2. 多语言与结构级容器容错矩阵增强
- 在双轨选择器基础上，进一步补全了本地化容器与结构容错链：
  - `div[role="article"][aria-label="智能体回复"]` / `div[aria-label="智能体回复"]`
  - `div.flex.flex-col:has(> [data-testid="turn-cards-container"])`
- 杜绝在多语言切换、子轮次更新或不同 Antigravity 补丁版本下的选择器失效隐患。

#### 3. 运行环境与安装包全量打包归档
- 构建纯净发行包 `dist/antigravity-skin.zip`；
- 同步更新系统插件运行目录并热重载生效。

---

### 📦 变更文件一览
- [`client/styles/glass-theme.css`](client/styles/glass-theme.css)：补齐智能体回复多语言与结构级毛玻璃气泡选择器，统一回复形态与内边距圆角；
- [`package.json`](package.json) / [`plugin.json`](plugin.json)：版本号升级至 `v0.2.12`；
- [`CHANGELOG.md`](CHANGELOG.md)：登记 v0.2.12 更新索引；
- [`docs/releases/RELEASE_v0.2.12.md`](docs/releases/RELEASE_v0.2.12.md)：版本发布说明文档。

---

### ⚡ 升级指南
已安装插件的用户打开 Antigravity，点击左下角 **「设置 - 外观」** -> **「⚡ 检查更新」**，即可检测到 `v0.2.12` 并点击 **「🚀 立即热更新」** 无感升级！
新用户可直接运行 `install.sh`（macOS/Linux）或 `install.bat`（Windows）一键安装。
