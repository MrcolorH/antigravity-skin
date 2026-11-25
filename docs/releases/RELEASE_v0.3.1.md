# Antigravity Skin & Theme v0.3.1 发布说明

## 📌 版本信息
- **版本号**：`v0.3.1`
- **发布日期**：2026-11-25
- **核心重点**：修复「设置 → 模型与用量（Models & Usage）」中「反重力看板」开关卡片的定位错位、开关样式与开启态颜色异常，以及页面重载后设置项消失的注入竞态问题。

---

## 🛠️ 修复详情

### 1. 精确定位至「模型积分」与「Gemini 模型」之间（`client/modules/dashboard-settings.js`）
- 新增 `findModelsUsageAnchorInfo`，优先匹配「模型积分 / Model Credits / AI Credits」标题并在扁平兄弟节点或包裹容器中精准收敛至对应卡片区块，避免锚点上浮穿透至外层全宽容器；
- 将「反重力看板」卡片稳定插入「模型积分」区块之后、「Gemini 模型」之前，并完整继承原生卡片布局、标题与描述样式（兼容深色与浅色主题）；
- 保留 `findModelsUsagePlanAnchor` 向后兼容导出。

### 2. 对齐原生开关尺寸与开启态蓝色高亮（`client/modules/dashboard-settings.js`）
- 改用独立 `.agy-dash-*` 与 `.agy-dash-switch` 样式体系，隔离外观菜单 `.agy-switch-*` 的全局 CSS 冲突；
- 不再错误复用原生开关关闭态的灰色背景类，对齐原生「模型积分」开关比例（`36×20px` 轨道、`16×16px` 圆形滑块、`translateX(16px)`），开启态呈现清晰蓝色（`#007acc`），关闭态为柔和中性灰。

### 3. 修复页面重载后设置项消失与冷启动竞态（`client/modules/dashboard-settings.js`、`client/index.js`、`sidecars/skin-engine/main.mjs`）
- 为 `attachObserver` 增加 `document.body || document.documentElement` 空值防护与 `DOMContentLoaded` 兜底，消除 `document_start` 时机下 `MutationObserver.observe` 抛出 `TypeError` 导致设置模块未挂载的问题；
- 在 `client/index.js` 中增加 `__agyDashboardSettingsFn` 句柄刷新校验，并在 `skin-engine` 的 `Page.loadEventFired` 中统一调用 `executeInjection({ forceEvaluate: false })`，确保刷新或热更新后补丁稳定重注；
- 将 `client/modules/dashboard-settings.js` 纳入 `scripts/sync-all.mjs` 同步清单，支持开发热同步立即生效。

---

## ✅ 验证情况
- 已通过 `npm test` 全部 4 组自动化测试套件（包含新增的 `findModelsUsageAnchorInfo` 布局测试与 `document_start` 安全挂载测试）；
- 已构建并验证纯净 `dist/antigravity-skin.zip` 发布包，支持插件内置「检查更新」在线直连/镜像热更新及 `install.sh` / `install.ps1` 一键安装覆盖升级。
