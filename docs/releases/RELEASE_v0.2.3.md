# 🌟 Antigravity Theme & Skin v0.2.3 发布说明

本版本为 **反重力官方新版对话框文件附件统一包裹、智能两行收起截断、50vh 视窗保护与经典折叠胶囊恢复专项版**。针对 Antigravity 官方在 v2.29+ 中将用户附件（图片、文档、XLSX 等）拆出至气泡外部的新布局进行了深度重构与一体化包裹，重塑了极简紧凑的默认收起态，并彻底修复了展开折叠按钮的视觉样式。

---

### 🚀 核心改进与新特性

#### 1. 新版统一父容器毛玻璃包裹（消灭孤立悬浮附件）
- **现象背景**：
  Antigravity v2.29+ 引入了新的多模态容器结构，将用户上传的文件（`.xlsx`、`.pdf`、`.docx` 等）和图片附件抽离到了独立媒体区域 `[data-testid="user-message-media-scroll"]`，导致附件孤悬在聊天窗口背景上，与下方的文字气泡割裂脱节。
- **重构方案**：
  - CSS 与 JS 引擎向上捕获官方统一包裹容器（`div[class*="max-w-"][class*="80%"]`），将其作为全新的毛玻璃卡片主体进行统一渲染；
  - 剥离内层嵌套容器的重复底色与杂色边框（`bg-card-border` / `bg-card`），实现文件附件芯片与提问文本在同一个珠光微冷毛玻璃气泡中融为一体。

#### 2. 用户提问智能两行收起与附件隐藏（极简默认态）
- **文字收起截断**：
  - 默认收起态（`data-user-collapsed="true"`）下，用户提问最多只显示 **2 行文字**（行高 1.65，`-webkit-line-clamp: 2` 与 `max-height` 严格双重防抖控制），超出部分优雅展示为省略号 `...`；
- **附件默认收起**：
  - 无论是多张大图还是文件清单（XLSX / PDF），在收起态下彻底隐藏（`display: none !important`），将提问卡片收敛至 50~60px 的轻盈横条，绝不霸屏遮挡下方的 AI 回答和桌面动态壁纸。

#### 3. 完整展开与 50vh 视窗防遮挡保护
- **一键展开**：
  - 点击右上角胶囊按钮，提问全文完整展开，图片与文件附件同步无缝呈现；
- **50% 视窗最大高度限制**：
  - 为防止长文本（如包含几千字日志或大型需求文档）展开时撑满整屏甚至溢出视窗，展开态设定最大高度严格限制为窗口的一半（`max-height: 50vh !important`）；
  - 溢出时自动激活精致半透明细滚动条（`overflow-y: auto !important; scrollbar-width: thin;`），平滑滚动浏览。

#### 4. 经典 26px 圆形毛玻璃微光折叠胶囊按钮恢复
- **修复根因**：
  - 排查并修复了 CSS 规则中偶发的语法冗余闭合问题，确保 Chromium CSS 引擎 100% 正确解析并装载折叠按钮规范；
- **经典质感重现**：
  - 精准恢复为经典 $26\text{px} \times 26\text{px}$ 圆形胶囊（`border-radius: 13px`），搭配 `rgba(255, 255, 255, 0.75)` 半透明高透珠光底色与浅冷紫微光边框（`1px solid rgba(199, 210, 254, 0.7)`）；
  - 固定于气泡卡片右上角（`top: 10px; right: 12px;`），收起态下与 2 行文字视觉居中；文本区域预留 42px 专属安全避让区，避免任何遮挡重叠；
  - 完美适配深色主题（`rgba(30, 36, 56, 0.85)` 黑曜石质感）与官方暗黑模式。

---

### 📦 变更文件一览
- [`client/modules/wallpaper.js`](file:///Users/colorh/Project/AICODING/antigravity-skin/client/modules/wallpaper.js)：识别官方新版统一父容器 `max-w-[80%]`，打标 `data-user-collapsible` 并实现折叠展开状态机与 50vh 滚动保护；
- [`client/styles/glass-theme.css`](file:///Users/colorh/Project/AICODING/antigravity-skin/client/styles/glass-theme.css)：统一毛玻璃卡片样式注入、收起态两行截断与附件隐藏、展开态 50vh 自包含滚动、经典 26px 微光胶囊按钮深浅主题样式；
- [`package.json`](file:///Users/colorh/Project/AICODING/antigravity-skin/package.json) / [`plugin.json`](file:///Users/colorh/Project/AICODING/antigravity-skin/plugin.json)：版本号升级至 `v0.2.3`；
- [`CHANGELOG.md`](file:///Users/colorh/Project/AICODING/antigravity-skin/CHANGELOG.md)：版本演进记录归档。

---

### ⚡ 升级指南
已安装插件的用户打开 Antigravity，点击左下角 **「外观设置」** -> **「⚡ 检查更新」**，即可检测到 `v0.2.3` 并点击 **「🚀 立即热更新」** 无感升级！
