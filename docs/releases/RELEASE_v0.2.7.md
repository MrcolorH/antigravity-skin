# 🌟 Antigravity Theme & Skin v0.2.7 发布说明

本版本为 **纯图片与媒体消息默认折叠塌陷修复专项版**。彻底修复了当用户提问无正文文字、仅包含上传图片/附件时，因误读外部时间戳导致触发收起态并隐藏图片附件，造成用户信息框内容全空、几何塌陷缩小为 32px 异常微点的严重体验问题。

---

### 🚀 核心改进与修复说明

#### 1. 精准隔离提问正文，彻底消除时间戳误判
- **根因诊断**：
  先前在判定用户输入是否包含文本时，代码使用了 `const textContent = (textEl ? textEl.textContent : step.textContent || '').trim();` 作为兜底。
  当用户提问仅包含图片（无文本）时，`textEl` 为空，代码回退读取了整条会话外层步骤容器 `step.textContent`，意外把操作栏中的时间戳文本（如 `"15m ago"` / `"2m ago"`）读取为提问正文，导致系统错误判定 `hasText = true` 并满足了折叠逻辑。
- **架构治理**：
  - 严格限制 `textContent` 仅从真正的用户消息正文节点（如 `[data-quotable="true"]`、`.whitespace-pre-wrap`、`[data-testid="user-message-content"]`）读取，坚决禁绝向外层步骤容器兜底；
  - 准确识别无文字状态（`hasText = false`），从源头斩断时间戳干扰。

#### 2. 建立纯媒体免折叠保护防线
- **纯图片消息默认保持完整展示**：
  在 Antigravity 原生交互中，上传的图片自带 64px 缩略图横排展示（单图约 64px 高度，多图自带水平滚动栏），纵向高度极小，天然不会遮挡屏幕；
  新版明确确立规则：**若完全没有文字（`!hasText`），绝不判定为超长折叠内容（`isLongContent = false`）**，默认完整展现图片缩略图，不注入多余的折叠/展开胶囊按钮。

#### 3. CSS 附件隐藏条件与卡片尺寸底线防护
- **附件隐藏前置约束**：
  收起态隐藏附件的 CSS 规则增加 `[data-has-text="true"]` 前置属性约束；仅在存在提问文本且处于收起态时隐藏多余附件；若无正文，图片与媒体滚动栏绝对不被隐藏。
- **媒体栏间距自适应优化**：
  当 `data-has-text="false"` 时，自动消除媒体容器底部多余的 `margin-bottom`，且在无折叠按钮时取消右侧预留的 38px 避让间隙。
- **气泡卡片安全尺寸底线**：
  为气泡卡片建立物理尺寸防线（`min-width: 52px; min-height: 40px;`），彻底杜绝极端异常场景下气泡发生视觉塌陷缩成空点。

---

### 📦 变更文件一览
- [`client/modules/wallpaper.js`](client/modules/wallpaper.js)：隔离提问正文文本读取，建立纯媒体免折叠规则与动态重校验；
- [`client/styles/glass-theme.css`](client/styles/glass-theme.css)：收起态附件隐藏增加文本约束，优化无文字媒体边距，建立卡片安全最小尺寸；
- [`package.json`](package.json) / [`plugin.json`](plugin.json)：版本号升级至 `v0.2.7`；
- [`CHANGELOG.md`](CHANGELOG.md)：记录 v0.2.7 更新说明。

---

### ⚡ 升级指南
已安装插件的用户打开 Antigravity，点击左下角 **「外观设置」** -> **「⚡ 检查更新」**，即可检测到 `v0.2.7` 并点击 **「🚀 立即热更新」** 无感升级！
