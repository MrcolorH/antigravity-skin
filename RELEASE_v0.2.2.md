# 🌟 Antigravity Theme & Skin v0.2.2 发布说明

本版本为 **滚动接缝排版震荡彻底根治专项版**，彻底排查并根除了长消息/代码块在滑过底部输入框上边缘视口裁切线时发生的高频白条频闪问题。

---

### 🐛 缺陷根因分析与彻底修复

#### 1. 视口排版高度震荡（Layout Thrashing Loop）根治
- **深度病理剖析**：
  此前样式中为了“提升长列表性能”，对所有消息气泡（`[aria-label="Agent response"]`、`[aria-label="User query"]`）应用了 `content-visibility: auto !important; contain-intrinsic-size: auto 120px !important;`。
  当长卡片（数百至上千像素）随着页面滚动滑到滚动视口下边界（正好与输入框上边缘重合，Y ≈ 696px）时：
  1. Chromium 视口检测判定该卡片部分溢出，立即将其子内容卸载并折叠至 `120px` 占位框；
  2. 卡片高度瞬间缩水，引发滚动容器总高度剧烈坍塌；
  3. 滚动容器高度缩小后，滚动相对位置发生变化，Chromium 重新计算发现卡片“又在可见视口内了”；
  4. Chromium 重新全量计算并展开子 DOM，卡片瞬间撑回原高；
  5. 卡片再次溢出视口边界，再次触发折叠……
  此循环在 Chromium 内部以每秒 60 次的频率高频震荡（Layout Thrashing），引发主消息容器不断处于重排重绘死循环中。
  由于视口下边缘紧贴着底部输入框的 `backdrop-filter: blur(26px)` 毛玻璃模糊层以及底层的 60fps 动态壁纸，每一次高度震荡的重排都被高斯模糊重新采样并投射到屏幕上，导致肉眼可见极度剧烈的高频白色/半透明横条频闪。

- **根本性解决方案**：
  - **彻底禁用 `content-visibility: auto`**：在 [`client/styles/glass-theme.css`](file:///Users/colorh/Project/AICODING/antigravity-skin/client/styles/glass-theme.css) 中明确将消息卡片的 `content-visibility` 锁定为 `visible !important`，`contain-intrinsic-size: none !important`。现代 Chromium 原生对视口外静态文本绘制性能优秀，杜绝任何人工干预导致的高度尺寸突变与震荡死循环；
  - **精简图层与重绘边界**：移除输入框上非必要的 `will-change: transform`，避免额外的合成层开销；对代码块添加轻量级局部保护 `contain: layout paint !important;`；
  - **恢复悬浮按钮原生矩阵平移**：解除对 `.agy-scroll-bottom` 的强制样式覆盖，恢复官方原生 `transform: translate(-50%, 16px)` 的流畅退出与渐隐逻辑。

---

### 🚀 客户端内一键在线热更新
- 已安装用户只需打开 Antigravity「外观设置」菜单，点击 **「⚡ 检查更新」**，即可立即检测到 `v0.2.2` 并一键点击 **「🚀 立即热更新」** 无感升级生效！
