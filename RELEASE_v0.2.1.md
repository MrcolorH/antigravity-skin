# 🌟 Antigravity Theme & Skin v0.2.1 发布说明

本版本为 **反重力最新版布局深度适配与滚动接缝防闪优化专项版**，全面解决了反重力新版更新后主工作区被原生纯白底板遮挡的问题，并彻底根除了滚动时消息与代码块滑过输入框上边界视口裁切线所引发的高频闪烁。

---

### 🐛 缺陷修复与核心改进

#### 1. 深度适配反重力最新版外层布局，彻底消除“大白屏”
- **根因诊断**：
  官方最新版本重构了前端外层容器，在主工作区与对话区引入了 `.agy-sheet` 与 `.agy-shell`，并注入默认样式 `body[data-agy-theme] .agy-sheet { background-color: var(--background); }` 及首页微光背景。在浅色或未适配的主题下，纯白实体背景强行覆盖在最上层，彻底遮挡了底层的动态壁纸与毛玻璃磨砂层。
- **修复方案**：
  - 在全局毛玻璃基础层 [`client/styles/glass-theme.css`](file:///Users/colorh/Project/AICODING/antigravity-skin/client/styles/glass-theme.css) 中补全了针对 `.agy-sheet`、`.agy-shell`、`body[data-agy-theme] .agy-sheet` 以及 `body[data-agy-home-glow] .agy-sheet:has(.agy-home)` 的全量穿透规则；
  - 在动态壁纸模块 [`client/modules/wallpaper.js`](file:///Users/colorh/Project/AICODING/antigravity-skin/client/modules/wallpaper.js) 中加入对应内联样式兜底，确保无论外部样式加载时机如何均能 100% 实现纯透明穿透。

#### 2. 彻底根除滚动视口接缝处的持续高频白条频闪（Layout Thrashing Loop）
- **根因诊断**：
  此前样式中为了“提升长列表性能”，对所有消息气泡（`[aria-label="Agent response"]`、`[aria-label="User query"]`）应用了 `content-visibility: auto !important; contain-intrinsic-size: auto 120px !important;`。
  当长卡片（数百至上千像素）随着页面滚动滑到滚动视口下边界（正好与输入框上边缘重合，Y ≈ 696px）时：
  1. Chromium 视口检测判定该卡片部分溢出，立即将其子内容卸载并折叠至 `120px` 占位框；
  2. 卡片高度瞬间缩水，引发滚动容器总高度剧烈坍塌；
  3. 滚动容器高度缩小后，滚动相对位置发生变化，Chromium 重新计算发现卡片“又在可见视口内了”；
  4. Chromium 重新全量计算并展开子 DOM，卡片瞬间撑回原高；
  5. 卡片再次溢出视口边界，再次触发折叠……
  此循环在 Chromium 内部以每秒 60 次的频率高频震荡（Layout Thrashing），引发主消息容器不断处于重排重绘死循环中。
  由于视口下边缘紧贴着底部输入框的 `backdrop-filter: blur(26px)` 毛玻璃模糊层以及底层的 60fps 动态壁纸，每一次高度震荡的重排都被高斯模糊重新采样并投射到屏幕上，导致肉眼可见极度剧烈的高频白色/半透明横条频闪。
- **修复方案**：
  - **彻底禁用 `content-visibility: auto`**：在 [`client/styles/glass-theme.css`](file:///Users/colorh/Project/AICODING/antigravity-skin/client/styles/glass-theme.css) 中明确将消息卡片的 `content-visibility` 锁定为 `visible !important`，`contain-intrinsic-size: none !important`。现代 Chromium 原生对视口外静态文本绘制性能优秀，杜绝任何人工干预导致的高度尺寸突变与震荡死循环；
  - **自包含局部重绘**：对代码块添加轻量级局部保护 `contain: layout paint !important;`，防止重绘穿透；
  - **恢复悬浮按钮原生动画**：移除对 `.agy-scroll-bottom` 的过度覆盖，恢复官方原生 `transform: translate(-50%, 16px)` 的流畅退出与渐隐逻辑。

#### 3. 跨平台开发与热同步脚本兼容性提升
- 优化了 [`scripts/hot-sync.mjs`](file:///Users/colorh/Project/AICODING/antigravity-skin/scripts/hot-sync.mjs) 与 [`scripts/inspect-dom.mjs`](file:///Users/colorh/Project/AICODING/antigravity-skin/scripts/inspect-dom.mjs)，自动无缝识别 macOS 的 `Library/Application Support/Antigravity` 及 Windows 的 `%APPDATA%` 路径与用户主目录。

---

### 🚀 客户端内一键在线热更新
- 已安装 `v0.2.0` 或更早版本的用户，打开 Antigravity「外观设置」菜单，点击 **「⚡ 检查更新」**，即可立即检测到 `v0.2.1` 并一键点击 **「🚀 立即热更新」** 无感升级生效！
