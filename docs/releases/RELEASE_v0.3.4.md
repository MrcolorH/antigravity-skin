# Antigravity Skin & Theme v0.3.4 发布说明

## 📌 版本信息
- **版本号**：`v0.3.4`
- **发布日期**：2026-11-28
- **核心重点**：默认全面回归「100% 零改包 / 零重签」纯净启动架构，彻底消除修改官方客户端与代码签名的顾虑；保留侧边栏按需开启「内核级前置注入」与一键无损还原官方原版能力，并同步完成全链路安全加固。

---

## 🌟 核心架构升级：默认全面回归「100% 零改包」纯净模式

为了彻底消除大家对“修改官方客户端文件 / 重签名”的顾虑，本版本对 Windows 与 macOS 安装、自愈与热更新架构进行了全面重构：

* **默认零修改官方客户端（`features.kernelInjection: false`）**：
  * `install.ps1`、`install.sh`、`scripts/install.mjs`、开机自愈守护与在线热更新（`extractAndDeploy`）默认**不再修改** `app.asar`，macOS **不再执行** `codesign` 重签名，100% 保留 Google 官方原厂文件与数字签名完整性，客户端自动更新零干扰。
* **Windows 无侵入启动（全路径覆盖 + 自动兜底 + 失参自修）**：
  * 自动通过 Shell API 为桌面（兼容 OneDrive 重定向桌面）、开始菜单、公共菜单以及任务栏固定栏中的 `*Antigravity*.lnk` 快捷方式附加 `--remote-debugging-port=0` 参数；
  * 当系统安装目录（如 `Program Files`）为只读不可写时，自动在用户桌面生成专属 `Antigravity (Skin).lnk` 并记录索引，卸载时完整清理；
  * 若客户端升级覆盖了官方快捷方式参数，Sidecar 在纯净模式下检测到 CDP 未激活时自动尝试补齐参数。
* **macOS 零改包单一入口启动器（`macLauncherMode: "isolate" | "keep_original"`）**：
  * 默认 `isolate` 模式：将未经任何修改的官方 `Antigravity.app` 无损移动至安全隔离目录，并在 `/Applications/Antigravity.app` 生成轻量化启动器，完整保留原版图标、文件拖放与 URL 协议关联，且保持单入口聚焦体验；
  * 自动识别官网 `.dmg` 手动覆盖升级，绝不用隔离区旧版反向覆写新版；支持在侧边栏一键切换为 `keep_original`（保留官方位置 + 独立 `~/Applications/Antigravity Skin.app`）；卸载时自动校验 `CFBundleIdentifier` 并完整归位官方 `.app` 及重新注册 Launch Services。
* **侧边栏面板按需开启 & 安全沙箱合规（`sidecars/panel/*`）**：
  * 仍需要「开机首帧防白闪视频动画」的用户，可在 `Antigravity Skin` 侧边栏面板「插件通道状态」卡片中按需开启可选内核注入（面板内嵌高对比度二次确认框，全程不调用受限的 `window.confirm()` / `alert()`，并明确提示 macOS 签名不可逆规则）；
  * 支持一键切回零改包纯净启动（调用 `/api/patch-restore` → `/api/restore-boot`，从 `app.asar.bak` 还原官方包、注销 Windows 自愈任务并保留 `--remote-debugging-port=0` 重启）；
  * 老版本已注入过 `app.asar` 的用户升级后平滑继承原有习惯（`kernelInjection: true`），新装与未改包用户默认 `false`。

---

## 🛡️ 安全边界说明与自查提醒（重要）

1. **本插件的安全边界**
   * 本项目仅工作于**本地界面渲染层与只读本地看板**（动态壁纸、毛玻璃样式、UI 文案汉化、本地用量展示）。
   * **绝不**读取、提取或上传任何 Google 账号 OAuth Token，**绝不**拦截、伪造或代理发往 Google 服务器的 API 请求；本版本进一步收紧本地 HTTP/WebSocket `Host` 与 `CORS` 校验、严格限制 `POST /api/update/apply` 与重定向目标为官方 GitHub 仓库白名单、全面剔除 OAuth/登录页/回调路径（`/oauth`、`/login`、`/signin`、`/callback` 等）注入、并移除第三方更新镜像兜底源。
2. **⚠️ 强烈建议自查是否存在「第三方违规调用」**
   * 近期社区反馈的 Antigravity 账号风控（如 `Error 403` / 服务禁用），主要诱因集中在**将 Antigravity OAuth 凭证接入第三方客户端、API 反代/中转代理、多号池轮询工具、高频自动化刷量脚本或高风险代理网络环境**。
   * **请务必自查**：您当前的账号或本机环境中，是否同时安装或授权过上述第三方中转代理、号池管理工具或外部桥接脚本（可前往 Google 账号的「第三方应用与服务权限」页面检查并及时撤销非官方授权），切勿将此类风险与纯本地 UI 换肤/汉化插件混为一谈。

---

## ✅ 验证情况
- 已完成零改包配置体系、共享宿主管理模块（`scripts/platform-host.mjs`）、模式 A/B 安装卸载脚本、Sidecar 与侧边栏安全确认交互及自动化测试用例落地；
- 测试套件 `npm test`、`node --test tests/i18n-engine.test.mjs`、`sidecars/panel/tests/` 通过验证。
