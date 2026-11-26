# Antigravity Skin & Theme v0.3.3 发布说明

## 📌 版本信息
- **版本号**：`v0.3.3`
- **发布日期**：2026-11-26
- **核心重点**：升级插件整体交互方式，将配置入口全面收口至「Antigravity Skin」独立侧边栏面板，打造更纯净、低侵入、即改即生效的交互体验；同步修复暗色主题下插件展开子菜单气泡外框颜色不匹配问题。

---

## 🛠️ 更新与改进详情

### 1. 插件交互方式全面升级（`sidecars/panel/*`、`client/index.js`、`sidecars/skin-engine/main.mjs`）
- **统一收口至侧边栏面板**：通过顶部菜单 `⋮ -> 插件 -> Antigravity Skin` 打开独立侧边栏配置面板，替代原先向宿主原生设置弹窗（外观、模型与用量）注入配置项的方式；
- **清理旧版设置页侵入式注入**：在 `client/index.js` 中新增 `cleanupLegacySettingsMenus()`，启动与热切换时自动清理历史注入 DOM 与句柄，彻底避免宿主界面改版导致的布局错位或闪烁；
- **侧边栏交互能力补全**：在 `Antigravity Skin` 侧边栏面板中整合「插件通道状态与版本检查」「界面与交互（汉化、对话气泡样式、内嵌看板）」「动态壁纸（Wallpaper 素材库浏览、场景属性 `SceneScript` 实时调参、背景音频、画面适配与对齐位置）」等完整控制项，配置修改即时热更新生效；
- **场景属性实时联动**：`client/index.js` 支持将 `wallpaperUserProperties` 变更直接同步至渲染引擎，无需重载即可预览场景壁纸配色与开关效果。

### 2. 暗色主题插件子菜单气泡样式修复（`client/styles/glass-theme.css`）
- 补充 `.vscode-dark` 与 `html.agy-native-dark` 选择器，确保通过 Portal 挂载的 Radix 子菜单在暗色主题下正确应用深色毛玻璃底色；
- 修复 `[role="menu"] div[tabindex]:hover` 误匹配嵌套子菜单外层容器的问题（排除 `[role="menu"]` 与 `[data-radix-menu-content]`），避免鼠标悬停在插件子菜单（如 `Antigravity Skin` / `Swarm`）时整个外框变为浅色半透明。

---

## ✅ 验证情况
- 已通过 `npm test` 全部 4 组自动化测试套件；
- macOS 实机 CDP 验证暗色主题下 `⋮ -> 插件` 展开子菜单及悬停态均保持深色毛玻璃外框（`rgba(18, 22, 32, 0.65)`、`12px` 圆角）；
- 已构建并验证 `dist/antigravity-skin.zip` 发布包。
