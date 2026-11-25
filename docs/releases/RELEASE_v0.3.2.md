# Antigravity Skin & Theme v0.3.2 发布说明

## 📌 版本信息
- **版本号**：`v0.3.2`
- **发布日期**：2026-11-25
- **核心重点**：修复 Windows 版顶部菜单栏在新版客户端 DOM 结构下残留实色底与字色误翻的问题；重构「Antigravity Skin」侧边栏面板并实现与核心外观配置的实时双向同步。

---

## 🛠️ 更新与修复详情

### 1. 修复 Windows 版顶部栏残留实色底问题（`client/styles/glass-theme.css`）
- 适配新版客户端在 `div.shrink-0.flex.bg-sidebar` 与 `[data-testid="title-menu-bar"]` 之间新增 `<div class="flex-1 min-w-0">` 包装层的结构变化；
- 将 `glass-theme.css` 第 2.5 节的直接子代选择器 `div.shrink-0:has(> [data-testid="title-menu-bar"])` 调整为后代匹配 `div.shrink-0:has([data-testid="title-menu-bar"])` 及中间包裹容器透明化；
- 消除顶部外层 `bg-sidebar` 残留底色（如浅色主题下的 `rgb(250, 250, 250)`），并同步解决 Contrast Guard 因检测到白底而将顶部菜单文字误翻为深色的问题。

### 2. 「Antigravity Skin」侧边栏配置面板重构与双向同步（`sidecars/panel/*`、`client/*`、`sidecars/skin-engine/main.mjs`）
- 将侧边栏面板名称统一为 **Antigravity Skin**，精简面板结构为「立即修复 + 核心外观配置」，与系统设置中的外观菜单形成互补；
- 移除冗余的 `themeStyles` 总开关阻断，改为各独立功能开关直接生效；
- 在 `client/index.js` 与 `sidecars/skin-engine/main.mjs` 中新增配置实时同步通道（`__agySyncConfigFromEngine` + 焦点/轮询兜底拉取），确保侧边栏与原生设置面板修改即时互通、打开弹窗自动重绘；
- 将侧边栏全部静态资源纳入 `scripts/sync-all.mjs` 热同步清单。

---

## ✅ 验证情况
- 已通过 `npm test` 全部 4 组自动化测试套件；
- Windows 实机 CDP 验证顶部栏外层容器背景色为 `rgba(0, 0, 0, 0)`，深色壁纸下顶部菜单字色为 `rgb(242, 246, 252)`；
- 已构建并验证 `dist/antigravity-skin.zip` 发布包。
