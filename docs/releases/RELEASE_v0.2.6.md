# 🌟 Antigravity Theme & Skin v0.2.6 发布说明

本版本为 **排队消息卡片右侧操作按钮与图标常态可见性修复专项版**。针对排队消息（Queued Messages）卡片右侧折叠按钮及消息操作按钮（立即发送、编辑、删除）在常态下“图标消失、仅显灰色实心圆点、鼠标悬停才显现图标”的视觉缺陷进行了彻底修复。

---

### 🚀 核心改进与修复说明

#### 1. 彻底解决排队卡片右侧按钮图标常态隐形缺陷
- **根因诊断**：
  先前排队卡片样式中定义了 `[data-testid="queued-messages-card"] [class*="bg-secondary"]`，本意是给消息数量角标（Badge）添加半透明毛玻璃衬底。然而，该属性选择器的模糊子串匹配无意中命中了卡片内所有带有 Tailwind 悬停类 `hover:bg-secondary` 的 ghost 操作按钮。
  这导致按钮在非悬停常态下被强制注入了 `rgba(255, 255, 255, 0.4)` / `0.12` 的背景色与圆角，而在暗色半透明卡片与壁纸叠加下，该背景色恰好与按钮内原生的 `text-muted-foreground` 图标颜色相近，使图标完全被背景“吃掉”，视觉上退化为 4 颗单一纯色的实心灰圆点；只有当鼠标 hover 时，图标受 `hover:text-foreground` 影响被刷白才临时可见。
- **选择器精准隔离**：
  - 将数量角标样式精准收敛绑定至 `span.bg-secondary` 与 `span[class*="rounded-full"]`，彻底杜绝模糊匹配向按钮溢出；
  - 显式声明 `[data-testid="queued-messages-card"] button` 默认背景为完全透明（`background: transparent !important`），拔除突兀的实心圆底。

#### 2. 全主题高对比度与常态常亮保障
- **常态（非悬停）**：
  - 深色主题及暗底壁纸下，折叠展开按钮与单条消息操作按钮组（发送、编辑、删除）文字及内部 SVG 图标强制设为明亮可见的 `rgba(255, 255, 255, 0.78)`，`opacity: 1 !important`，`fill: currentColor !important`，保证无需鼠标悬停即常亮清晰；
  - 浅色主题及亮底壁纸下，文字与图标设为高可读深灰色 `rgba(30, 41, 59, 0.78)`。
- **悬停交互（Hover）**：
  - 鼠标放上去时，平滑过渡显示细腻的磨砂玻璃衬底（`rgba(255, 255, 255, 0.16)` / `rgba(0, 0, 0, 0.08)`）及 100% 鲜白/深黑图标；
  - 为删除操作按钮保留专属柔红警示光（`hover: rgba(239, 68, 68, 0.18)`），为发送按钮保留科技蓝微光（`hover: rgba(59, 130, 246, 0.18)`）。

#### 3. 开发期热同步脚本精准目标匹配
- 修复了 `scripts/sync-all.mjs` 中查找 CDP Target 时误连 Splash 启动遮罩页面的问题，与 `hot-sync.mjs` 统一锁定 Antigravity 主渲染窗口，确保热重载即时生效。

---

### 📦 变更文件一览
- [`client/styles/glass-theme.css`](client/styles/glass-theme.css)：重构排队消息卡片徽标选择器与按钮常态/悬停样式，彻底恢复图标常亮；
- [`scripts/sync-all.mjs`](scripts/sync-all.mjs)：修正 CDP 主窗口 Target 匹配规则；
- [`package.json`](package.json) / [`plugin.json`](plugin.json)：版本号升级至 `v0.2.6`；
- [`CHANGELOG.md`](CHANGELOG.md)：记录 v0.2.6 更新说明。

---

### ⚡ 升级指南
已安装插件的用户打开 Antigravity，点击左下角 **「外观设置」** -> **「⚡ 检查更新」**，即可检测到 `v0.2.6` 并点击 **「🚀 立即热更新」** 无感升级！
