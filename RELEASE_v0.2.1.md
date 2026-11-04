# 🌟 Antigravity Theme & Skin v0.2.1 发布说明

本版本为 **反重力最新版布局深度适配与图层复合防闪优化专项版**，全面解决了反重力新版更新后主工作区被原生纯白底板遮挡的问题，并根治了滚动时代码块滑过输入框上边界所引发的高频闪烁。

---

### 🐛 缺陷修复与核心改进

#### 1. 深度适配反重力最新版外层布局，彻底消除“大白屏”
- **根因诊断**：
  官方最新版本重构了前端外层容器，在主工作区与对话区引入了 `.agy-sheet` 与 `.agy-shell`，并注入默认样式 `body[data-agy-theme] .agy-sheet { background-color: var(--background); }` 及首页微光背景。在浅色或未适配的主题下，纯白实体背景强行覆盖在最上层，彻底遮挡了底层的动态壁纸与毛玻璃磨砂层。
- **修复方案**：
  - 在全局毛玻璃基础层 [`client/styles/glass-theme.css`](file:///Users/colorh/Project/AICODING/antigravity-skin/client/styles/glass-theme.css) 中补全了针对 `.agy-sheet`、`.agy-shell`、`body[data-agy-theme] .agy-sheet` 以及 `body[data-agy-home-glow] .agy-sheet:has(.agy-home)` 的全量穿透规则；
  - 在动态壁纸模块 [`client/modules/wallpaper.js`](file:///Users/colorh/Project/AICODING/antigravity-skin/client/modules/wallpaper.js) 中加入对应内联样式兜底，确保无论外部样式加载时机如何均能 100% 实现纯透明穿透。

#### 2. 彻底根除代码块经过输入框上方时的持续高频闪烁
- **根因诊断**：
  底部输入框卡片（`.surface-composer`）拥有 36px 大半径毛玻璃高斯模糊（`backdrop-filter`），其采样边界会向上溢出扩散；而主消息滚动流被官方设置为 `isolation: isolate; overflow-y: auto;`。当带有独立边框、圆角与复杂 DOM 的 Markdown 代码块恰好滑过视口硬件裁切线（Clip Boundary）时，模糊滤镜对裁切图元的持续重采样与脏矩形失效判定形成闭环，触发了 Chromium 合成器的每秒 60 次死循环重绘（Compositor Invalidation Loop / Dirty Rect Ping-Pong）。
- **修复方案**：
  - 为代码块容器 `.relative.whitespace-pre-wrap` 追加 `contain: paint !important; transform: translateZ(0) !important;`，强制将其确认为自包含绘制图元，硬件裁切时绝不向上级抛出脏矩形重绘事件；
  - 为底部输入框卡片 `.surface-composer` 追加 `transform: translateZ(0) !important; will-change: transform !important;`，提升为独立 GPU 合成层，彻底断绝层间反向模糊重绘循环；
  - 对回到底部悬浮按钮（`.agy-scroll-bottom`）实施硬件加速隔离，防止临界重叠时产生子像素抖动。

#### 3. 跨平台开发与热同步脚本兼容性提升
- 优化了 [`scripts/hot-sync.mjs`](file:///Users/colorh/Project/AICODING/antigravity-skin/scripts/hot-sync.mjs) 与 [`scripts/inspect-dom.mjs`](file:///Users/colorh/Project/AICODING/antigravity-skin/scripts/inspect-dom.mjs)，自动无缝识别 macOS 的 `Library/Application Support/Antigravity` 及 Windows 的 `%APPDATA%` 路径与用户主目录。

---

### 🚀 客户端内一键在线热更新
- 已安装 `v0.2.0` 或更早版本的用户，打开 Antigravity「外观设置」菜单，点击 **「⚡ 检查更新」**，即可立即检测到 `v0.2.1` 并一键点击 **「🚀 立即热更新」** 无感升级生效！
