# Antigravity Skin & Theme v0.2.15 发布说明

## 📌 版本信息
- **版本号**：`v0.2.15`
- **发布日期**：2026-11-19
- **核心重点**：修复语言服务超时崩溃与重启后插件脱落隐患（精准隔离外部开发服务 CDP 劫持、阻断 AI 流式输出与 Monaco 编辑器 DOM 监听风暴、安装脚本进程优雅退出与配置写入防竞态）。

---

## 🌟 背景与问题根因

在某些开发场景下（尤其是本地启动开发服务器如 `localhost:3000`/`localhost:3005`，或执行密集 Agent 对话时），部分用户反馈：
1. 客户端运行一段时间后提示 **“语言服务器不可用”**；
2. 手动重启 Antigravity 后，所有 Antigravity 插件消失（表现为“全掉了”）。

经全面排查，定位到以下深层根因：
1. **外部 Webview / Localhost 误劫持与 CDP 会话震荡**：
   `skin-engine` 原先的 `isMainAppTarget` 判定较宽，误将本地开发服务（如 `localhost:3005`）及各类内置临时 Webview 判定为主窗口并注入全套样式与脚本。外部服务刷新或销毁时抛出大量 `ErrorEvent`，引发 Electron 主进程 `webview:execute-js-isolated-world` 异常，进而拖垮并导致语言服务器关闭。
2. **AI 流式输出与高频变动区域引发 DOM 监听风暴**：
   `i18n-engine.js` 与 `ContrastGuard` 原先未严格跳过 Agent 生成过程中的流式 Markdown 内容。每吐出一个 Token 都会触发 `characterData` 变动并执行正则扫描，主渲染线程严重阻塞，导致 Electron 宿主与 Language Server 的心跳检测超时。
3. **安装脚本强退引发的配置覆盖竞态（Race Condition）**：
   原安装脚本使用 `pkill -i antigravity` 强退客户端，但底层的 `language_server` 仍在执行退出清理与落盘。脚本立即写入 `config.json`，随后 `language_server` 析构时将内存旧状态覆写回磁盘，导致重启后插件配置丢失。

---

## 🛠️ 改造与修复详情

### 1. 精准锁定 CDP 目标与外部服务硬隔离（`sidecars/skin-engine/main.mjs`）
- **严格限定工作区特征**：`isMainAppTarget` 增加严格的主机与路径校验，坚决排除包含 `localhost`、第三方端口子路径（如 `/admin`, `/api` 等）及内部临时 Webview。
- **标题双重核验**：确保仅对官方 Antigravity Workbench 主工作区生效，杜绝向任何第三方页面或开发服务注入主题包。

### 2. 优化 DOM 监听范围，彻底消除渲染线程卡顿（`i18n-engine.js` & `index.js`）
- **全链路排除 AI 生成内容**：`isPrunableSubtree` 与 `shouldSkip` 全面忽略 `agent-response`、`model-turn`、`cascade-step`、`rendered-markdown` 及 `markdown-body` 等流式内容区域。
- **微任务与字符数据快速短路**：在 `characterData` 阶段直接阻断父级为跳过容器的节点入队，消除 Agent 打字机阶段的 CPU 占用与心跳丢包。
- **ContrastGuard 避开高负载子树**：对 Monaco 编辑器、终端及 AI 消息容器做短路避让，杜绝全量 `querySelectorAll('*')` 导致的计算雪崩。

### 3. 安装与热更新脚本进程退出与配置原子防竞态（`install.sh`, `scripts/install.mjs`, `install.ps1`）
- **双重进程监听**：关闭客户端时同步轮询 `Antigravity` 与 `language_server` 进程，预留充分的优雅退出窗口，杜绝进程析构写盘覆盖。
- **原子化配置持久化**：使用临时文件与系统级原子重命名（`os.replace` / `renameSync`）写入 `config.json`，确保插件注册 100% 稳定持久化。
- **宿主环境误杀保护**：检测到运行于反重力宿主会话或内嵌终端时，自动切换为无感在线写入模式，严禁强制退出主进程。

### 4. macOS 官方 App 默认注入与原生启动体验（`patch-boot-overlay.mjs`, `install.sh`, `scripts/install.mjs`）
- **内核参数默认化**：全面打通 macOS 平台 `app.asar` 补丁通道，自动向 `dist/main.js` 写入 `remote-debugging-port=0` 默认参数（同时安全生成原厂备份 `app.asar.bak`）。
- **零启动器切换**：彻底废弃外部独立启动器，用户无需更换日常习惯，从程序坞 (Dock)、聚焦搜索 (Spotlight) 或访达直接点击官方原版 Antigravity，即可 100% 默认自动带参拉起并完整生效！
- **一键原厂还原支持**：随时可通过 `scripts/restore-boot-overlay.mjs` 秒级无损还原官方初始 `app.asar`。

### 5. 在线热更新内核联动与零依赖极速闭环（`sidecars/skin-engine/main.mjs`, `appearance-menu.js`）
- **在线升级自动补丁**：老用户通过客户端设置面板“立即在线更新”升级时，系统原生解包后会自动在 `SKIP_KILL=1` 无感保护模式下触发 `patch-boot-overlay.mjs`，自动校验并注入最新内核参数与防闪白舞台代码。
- **全平台一键修复**：外观菜单中的“开机动效与内核补丁”行与“一键修复”按钮全面支持 macOS，可随时检测补丁激活状态并一键补齐。
- **零外部软件依赖**：完全基于系统内置工具（macOS/Windows 内置 `tar`）与插件环境运行，用户无需安装任何第三方软件或运行时。

---

## ✅ 验证方案
- [x] 单元测试套件全部通过（包含 `isMainAppTarget` 过滤与流式跳过回归测试）；
- [x] 验证外部开发服务（`localhost:3005` 等）不被误注入与监听；
- [x] 验证 `config.json` 在进程关闭后的原子稳定落盘；
- [x] 验证 macOS 端 `app.asar` 注入成功并生成安全备份 `app.asar.bak`。
