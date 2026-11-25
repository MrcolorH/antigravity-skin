# Antigravity Skin & Theme v0.3.0 发布说明

## 📌 版本信息
- **版本号**：`v0.3.0`
- **发布日期**：2026-11-25
- **核心重点**：一仓一体集成反重力看板（`antigrative-dashboard`）、存量 `antigravity-pulse` 无损替换、「模型与用量」原生风格单开关、统一中英文实时联动、Antigravity 2.35+ 环境变量凭据兼容及零命令行更新自愈架构。

---

## 🌟 核心更新内容

### 1. 反重力看板一仓一体集成（双 Sidecar 协同）
- 引入 `sidecars/panel` 与 `sidecars/panel/compat`，保留换肤引擎 `skin-engine` 与看板 `panel` 进程隔离协同；
- 完整支持对话输入框旁内嵌监控条（生成速率 `tok/s`、缓存命中率、上下文占用、5h/周共享额度、本地 Token 用量图表）与右侧 `＋ → Extensions → Antigrative Dashboard` 常驻辅助面板；
- 适配 Antigravity 2.35.1+ 移除 CLI `--csrf_token` 参数的变更，支持通过 `ANTIGRAVITY_LS_ADDRESS` 与 `ANTIGRAVITY_CSRF_TOKEN` 环境变量自动发现凭据。

### 2. 存量独立版看板平滑替换与数据无损迁移
- 安装脚本（`install.mjs`、`install.sh`、`install.ps1`）自动识别存量 `antigravity-pulse` 插件；
- 优先通过 SHA256 校验无损还原旧版 `// AG_PULSE_INLINE_V1` 补丁，再复制迁移 `history-v1` / `usage-v1` 历史数据并清理旧插件注册；
- 卸载脚本默认保留历史统计账本（附加 `--purge-data` 时才彻底清理）。

### 3. 「模型与用量」原生风格单开关 & 统一语言联动
- 在 **设置 → 模型与用量（Models & Usage）** 中注入与原生深/浅色主题完全一致的单行开关 **「开启反重力看板」**（与自定义皮肤总开关解耦，开启/关闭秒级生效）；
- 移除看板独立的语言切换按钮与首次语言引导，统一跟随换肤插件 `features.chineseLocalization` 实时切换中英文。

### 4. 零命令行更新自愈（方案 A）
- `skin-engine` 启动 100ms 内检测 `app.asar` 补丁与 `DevToolsActivePort` 状态；
- 检测到客户端更新覆盖补丁后，在无 CDP 依赖的右侧 `Aux Pane` 顶部展示「立即修复并重启」横幅并触发一次性系统原生轻提醒；
- 后台派生脱离式退出守望进程 `scripts/exit-heal-watcher.mjs`，在用户正常退出客户端后 2 秒内静默重注 `app.asar`（不打断、不自动重启），macOS 附带 ad-hoc `codesign` 兜底。
