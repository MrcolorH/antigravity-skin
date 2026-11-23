# Antigravity Skin & Theme v0.2.17 发布说明

## 📌 版本信息
- **版本号**：`v0.2.17`
- **发布日期**：2026-11-23
- **核心重点**：修复侧边栏打开内置浏览器/网页时主会话区壁纸黑屏遮挡、辅助侧边栏浏览器视口清晰穿透与免模糊优化、主窗口会话路由 CDP 守护加固。

---

## 🌟 背景与问题根因

在 Antigravity 侧边栏打开网页（例如浏览 GitHub Release、文档或内嵌网页）时，宿主会进入分层打孔渲染模式（在 `body` 注入 `data-has-browser-hole="true"`）。此时存在以下体验问题：
1. **主会话区壁纸黑屏遮挡**：
   官方原生编译样式（`compiled_tailwind.css`）预设了保底规则 `body[data-has-browser-hole="true"] [data-pane-id]:not([data-has-browser-hole="true"]) { background-color: var(--background); }`，在非打孔分栏上强刷 `#070708` 实黑底色与线性渐变。在透明皮肤体系下，这层实黑直接覆盖了底层动态壁纸画布（`#agy-dynamic-scene`），导致左侧会话区瞬间变成黑屏。
2. **辅助侧边栏浏览器视口模糊与暗色蒙层**：
   辅助侧边栏外层容器带有 `backdrop-filter: blur(36px)` 与半透明背景，当其作为浏览器视口载体时，导致底层 `WebContentsView` 视口被模糊与遮挡。
3. **输入框毛玻璃误匹配浏览器地址栏**：
   输入框选择器 `div:has(> form)` 意外命中了浏览器地址栏表单（`form[data-testid="browser-url-bar"]`），造成地址栏周围出现不必要的输入框磨砂圆角卡片。
4. **主窗口路由模式匹配遗漏**：
   `main.mjs` 中的 `isWorkbenchHost` 原正则缺少对官方 `/c/<conversation-id>` 子路径路由的匹配，在分栏或路由跳转后影响 CDP 准确定位。

---

## 🛠️ 改造与更新详情

### 1. 全局分栏透明穿透修复（`client/styles/glass-theme.css`）
- 新增 `2.1 穿透修复`：针对 `body[data-has-browser-hole="true"]` 下的 `[data-pane-id]`、`[data-tiling-pane]`、`div.border-border` 等分栏底板提升优先级，强制置为 `background: transparent !important; background-image: none !important;`。
- 无论用户打开多少个网页标签页或分栏，主对话区壁纸始终 100% 纯净透出，彻底告别黑屏。

### 2. 浏览器视口免模糊免遮挡穿透（`client/styles/glass-theme.css`）
- 新增 `2.2 视口穿透`：当辅助侧边栏含有 `[data-has-browser-hole="true"]` 或承载 `[data-browser-hole="true"]` 视口时，移除暗色蒙层并将 `backdrop-filter` 置为 `none`，确保网页内容高清直通。
- 排除浏览器地址栏 form：在输入框卡片毛玻璃规则中精确增加 `:not([data-testid*="browser"]):not([data-testid*="browser"] *)` 过滤，消除对浏览器工具栏的意外样式污染。

### 3. 主窗口路由匹配加固（`sidecars/skin-engine/main.mjs`）
- 优化 `isWorkbenchHost` 正则为 `/^https?:\/\/127\.0\.0\.1:\d+(?:\/.*)?$/i`，保证主窗口进入会话子路径或带 query 分栏时，后台皮肤引擎与 CDP 连接始终精确守护。

### 4. 自动化回归测试体系（`tests/test-startup-blackscreen-fixes.mjs`）
- 补充测试用例 7.3 与 URL 路由识别断言，全套 30 项自动化测试 100% 通过。

---

## ✅ 验证方案
- [x] 全套 30 项自动化测试通过（`npm test`）；
- [x] 实机 CDP 注入与截图核验：侧边栏开启网页时，左侧会话区完整透出动态壁纸，右侧浏览器内容清晰展现；
- [x] 验证打包脚本生成纯净 `dist/antigravity-skin.zip` 安装包；
- [x] 验证一键安装脚本 `install.sh` 执行顺畅。
