> **导航**：[⬅ 返回缺陷总清单 (BUG_TRACKING_LIST.md)](./BUG_TRACKING_LIST.md)

---

# BUG-020: 重启电脑后皮肤与开机动效整体变回官方原样（安装未落盘 + 更新覆盖无自愈）

- **缺陷编号**：`BUG-020`
- **涉及需求 / 模块**：Wallpaper 素材库集成 / 安装部署与开机动画持久化
- **严重级别**：P0
- **当前状态**：`已修复`
- **发现时间**：2026-10-25
- **修复完成时间**：2026-10-25
- **报告人**：用户实机反馈

## 1. 问题现场

| 检查项 | 期望 | 实测（故障时） |
| :--- | :--- | :--- |
| `~/.gemini/config/plugins/antigravity-skin/` | 已部署 | **不存在**（plugins 目录 mtime 停留在更早日期，说明从未成功落盘） |
| `~/.gemini/config/config.json` 中插件启用项 | 存在 | **缺失** |
| `resources/app.asar` 补丁 | 已注入 | **官方原版**（无 `app.asar.bak`，`agy-video-boot-host` 标记数 0） |

## 2. 缺陷现象描述

1. 用户在开发会话中通过 `npm run hot-sync` 热更新样式，客户端内一切正常（壁纸、毛玻璃、开机动效全部生效）；
2. 重启电脑后重新打开 Antigravity，皮肤、动态壁纸与开机动效**全部回到官方原样**；
3. 再次执行安装脚本时，控制台报 `❌ 未找到待注入的 loadingOverlay.js 源码文件`。

## 3. 期望表现（规范定义）

1. 安装完成后所有运行时代码必须落在持久化目录（`~/.gemini/config/plugins/antigravity-skin`），与仓库解压目录无关；
2. 客户端自动更新覆盖 `app.asar` 后，开机动效补丁应能被自动或一键恢复；
3. 安装过程中的任何一步失败都必须显式报错，不允许「静默成功」；
4. 状态必须可在客户端内可视化查看，避免用户误判。

## 4. 根本原因深度分析（代码级诊断）

- **文件位置**：`scripts/install.mjs`、`scripts/patch-boot-overlay.mjs`、`sidecars/skin-engine/main.mjs`
- **核心诱因（三层叠加）**：
  1. **白名单漏项**：`scripts/install.mjs` 的 `WHITELIST_FILES` 漏掉了 `loadingOverlay.js`（`install.ps1` / `install.sh` / `scripts/pack.mjs` 中均存在），部署到插件目录后补丁脚本找不到注入源 → 开机动效补丁注入失败，且失败仅打印警告不影响退出码，容易被忽略；
  2. **更新即覆盖**：Antigravity 每次自动更新都会整体替换 `resources/app.asar`，其中注入的开机动效补丁必然丢失，而产品侧没有任何检测与重打机制；
  3. **一次性注入被误认为已安装**：`scripts/hot-sync.mjs` 通过 CDP 向当前渲染进程注入 CSS/JS，进程退出即消失；用户看到的「装好了」实际只存在于该会话内。
- **附带缺陷**：Sidecar 运行于 Electron 宿主，Electron 劫持 `fs` 后对 `*.asar` 路径的 `readFileSync` 会抛 `ENOENT`（被当作读取 asar 内成员），导致补丁健康状态探针恒返回「未打补丁」。

## 5. 建议修复方案（技术执行路径）

1. `scripts/install.mjs` 白名单补齐 `loadingOverlay.js` / `provisionSplash.js` / `self-heal.bat`，并让补丁失败以非零退出码暴露；
2. 新增 `scripts/self-heal.mjs`：以 `agy-video-boot-host` 标记做二值判定，缺失时在客户端未运行的前提下静默重打（`SKIP_KILL=1` + `SKIP_RELAUNCH=1`），客户端运行中则写入 pending 状态顺延，绝不强杀会话；
3. 新增 `scripts/register-self-heal.mjs`：注册到用户启动文件夹 `Startup\AntigravitySkinSelfHeal.vbs`（`wscript` 隐藏执行，无需管理员权限），失败时降级为 `HKCU\...\Run`；
4. 新增 `GET /api/boot-patch/status` 与外观设置内的可视化状态（✅ 已就绪 / ⚠️ 缺失），并对 `.asar` 读取改用 `original-fs`；
5. 卸载链路同步注销守护进程与启动项。

## 6. 验证与验收标准

- [x] 安装后插件目录、`config.json` 启用项、`app.asar` 补丁三件套全部就位；
- [x] 用官方原版 asar 覆盖模拟「客户端更新」后，执行 `self-heal.mjs` 3.8 秒内自动恢复补丁并重建 `app.asar.bak`；
- [x] 客户端运行中执行自愈：进程未被强杀（11 个进程存活），退出码 2 且 `pending=true`；
- [x] 外观设置接口 `/api/boot-patch/status` 在补丁在位时返回 `patched=true`；
- [x] `--status` 能列出启动项、补丁状态与最近自愈时间；
- [x] 卸载后启动项、隐藏启动器与历史计划任务全部清除。

## 7. 修复与复盘记录

- **修复方案摘要**：补全部署白名单；新增开机自愈守护（启动文件夹 VBS 隐藏执行）与手动自检入口 `self-heal.bat`；新增补丁健康状态接口与 UI 提示；Sidecar 改用 `original-fs` 读取 asar；`patch-boot-overlay.mjs` 支持 `SKIP_RELAUNCH=1` 自愈模式。
- **验证结论**：在 Windows 11 + Antigravity 2.26.0 实机完成「模拟更新 → 自动自愈 → 重启后仍生效」全链路验证。
- **复盘**：
  1. **部署白名单是跨脚本共用的契约**，任何新增运行时文件必须同步 `install.mjs` / `install.ps1` / `install.sh` / `pack.mjs` 四处（后续建议抽成单一 `manifest` 常量）；
  2. **凡是「对客户端安装目录动手」的能力，都必须配套自愈**，因为官方更新会无条件覆盖；
  3. **Electron 宿主内的 `fs` 不等价于 Node 的 `fs`**，处理 `.asar` 一律走 `original-fs`。

---
