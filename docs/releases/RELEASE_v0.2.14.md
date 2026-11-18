# Antigravity Skin & Theme v0.2.14 发布说明

## 📌 版本信息
- **版本号**：`v0.2.14`
- **发布日期**：2026-11-18
- **核心重点**：全面适配 Antigravity v2.33.0+ 默认禁用 CDP 调试端口变更，安装脚本自动注入 `remote-debugging-port` 启动参数与快捷方式全量自愈。

---

## 🌟 背景与问题根因

在 Antigravity 升级至 **v2.33.0** 后，官方在主进程代码（`app.asar/dist/main.js`）实施了更严格的安全沙箱加固：
1. 默认不再开启 Chromium 远程调试端口（CDP）；
2. 启动时若未检测到 `--remote-debugging-port` 命令行开关，主进程会主动扫描并强制删除 `~/Library/Application Support/Antigravity/DevToolsActivePort`（Windows 下位于 `%APPDATA%\Antigravity\DevToolsActivePort`）。
3. 这导致在 macOS 纯净非侵入式架构下，Sidecar 伴生守护进程无法获取到 CDP 端口建立握手连接，前端毛玻璃、动态壁纸与外观控制面板表现为未挂载状态。

---

## 🛠️ 改造与适配详情

### 1. Windows 端双重保障（补丁注入 + 快捷方式全量自愈）
- **内核级补丁（`patch-boot-overlay.mjs`）**：
  在解包 `app.asar` 注入开机动画时，同步向 `dist/main.js` 注入 `electron_1.app.commandLine.appendSwitch('remote-debugging-port', '0');`。即使不经快捷方式启动，也保证 100% 开启 CDP。
- **快捷方式扫描与追加（`install.ps1` & `install.mjs`）**：
  自动扫描桌面和开始菜单的 `*Antigravity*.lnk` 快捷方式，自动在启动参数后追加 `--remote-debugging-port=0`。

### 2. macOS 端纯净拉起与便捷唤起命令
- **保持 100% 纯净非侵入式**：
  绝不篡改 macOS 版 `app.asar`，100% 保护 Google Developer ID 官方代码签名与系统权限完整。
- **自动重启逻辑增强（`install.sh` & `install.mjs`）**：
  安装完成后自动重启客户端处改为 `open -a Antigravity --args --remote-debugging-port=0`，安装完毕即可秒级生效恢复。
- **全局快速启动命令**：
  安装脚本自动在 `~/.local/bin/antigravity` 创建便捷启动脚本，方便开发者随时从终端一键带参唤起。

---

## ✅ 验证方案
- [x] 安装脚本自动带参拉起 Antigravity；
- [x] Windows 补丁脚本注入 `remote-debugging-port` 验证；
- [x] Windows 快捷方式参数追加自动化覆盖；
- [x] macOS 代码签名完整性零侵入守护。
