# Antigravity Skin & Theme 官方无感集成插件

<p align="center">
  <img src="https://img.shields.io/badge/Antigravity-2.0+-blue?style=flat-square" alt="Antigravity">
  <img src="https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey?style=flat-square" alt="Platform">
  <img src="https://img.shields.io/badge/Architecture-Official%20Sidecar%20Daemon-success?style=flat-square" alt="Architecture">
  <img src="https://img.shields.io/badge/Zero--Patch-100%25%20No%20ASAR%20Tampering-green?style=flat-square" alt="Zero Patch">
  <img src="https://img.shields.io/badge/License-MIT-orange?style=flat-square" alt="License">
</p>

> **免侵入、零改包、升级无损** 的 Google Antigravity 主题、动态视频壁纸、流浪地球 550C 开机动效与原生外观设置菜单无缝集成插件。

---

## 🌟 核心特性概览

### 1. 官方原生「设置 - 外观」无缝集成
- **原生第四主题模式**：直接在 Antigravity「设置」->「外观」的原生“主题”单选组中无缝注入 **「✨ 自定义」** 选项，与官方原生「系统」、「浅色」、「深色」并列。
- **纯净双向退回**：切换为官方「系统 / 浅色 / 深色」时，**100% 干净卸载**所有自定义样式并停止视频壁纸，彻底恢复官方原生黑白界面；切换为「✨ 自定义」时自动展开个性化控制台。
- **设置面板高对比度控件**：全面重构开关与滑块视觉效果，在浅色与深色背景下均清晰醒目。

### 2. 全局动态视频壁纸与毛玻璃穿透
- **本地流媒体分块加速**：内置基于 HTTP Range 分块响应的视频流媒体服务，支持视频进度任意跳转拖拽，超低 CPU 与内存占用。
- **全局毛玻璃透明穿透**：左侧边栏、主工作区、对话气泡、消息输入框、状态栏、辅助侧边栏深度透明穿透。
- **多素材自定义**：支持内置动态视频，亦可一键填入**本地任意 MP4/WebM 视频绝对路径**或**网络在线视频链接**。
- **实时无级滤镜调节**：支持亮度（Brightness）、对比度（Contrast）滑块实时无级微调，调节时画面完全不中断。
- **用户对话气泡折叠增强**：长文本提问气泡智能限高并提供一键折叠/展开按钮。

### 3. 流浪地球 550C & 自定义开机引导动画
- **零延迟秒开引导**：启动客户端即刻全屏呈现开机动效，杜绝加载过程中的黑屏假死感。
- **多模式开机素材自由切换**：
  - 💻 **流浪地球 2 · 550C 量子计算机引导动效**：完整复刻原电影量子计算机终端启动序列。
  - 🎬 **短视频开机动画**：支持自定义加载全屏短视频作为启动动画。
  - ⚡ **自定义代码脚本**：支持挂载自定义 JavaScript 动画程序。
- **即时交互与安全退出**：全屏播放期间随时按 `ESC` 键或点击屏幕跳过；内置「🎬 立即预览开机动画」按钮，随时试看效果。

### 4. 深度隔离中文化引擎
- 内置隔离汉化引擎，智能汉化官方常用菜单、侧边栏与提示文案。
- **代码与终端严格隔离**：采用容器级回溯检测，自动规避代码块（`<pre>`, `<code>`）、Monaco/Ace 代码编辑器与终端输出，绝不污染代码原文。
- 汉化选项直接内嵌至外观设置卡片下方，支持一键热开关。

### 5. 官方 Sidecar 架构与长连接热自愈
- **零篡改 `app.asar`**：采用 Antigravity 官方 Sidecar 伴生进程规范，无需拆包或修改客户端核心程序，Antigravity 官方升级推送**完全不受任何影响**。
- **长连接持久巡检**：CDP 通道保持长效保活，页面重载、导航或热更新时自动无感补注皮肤，防止主题掉落。
- **优雅退出**：客户端关闭时自动注销清理进程与端口，杜绝僵尸进程占用资源。

---

## ❓ 常见疑问解答（FAQ）

### Q1：有可以直接安装的 Release 版本吗？
**答：有的！**
本项目在 GitHub Releases 页面提供了已打包好的纯净发布压缩包 `antigravity-skin.zip`：
1. 从 [Releases](../../releases) 页面下载最新版本的 `antigravity-skin.zip`。
2. 解压到任意临时目录，**双击运行其中的 `install.bat`**（Windows）或执行 `./install.sh`（macOS/Linux）。
3. 脚本会自动将插件安装到官方持久化插件目录并激活，**解压后的临时文件夹可以直接删除**，无需保留。

### Q2：必须保留仓库这个文件目录格式吗？能否直接搞一个一键安装到反重力 App 根目录的脚本？
**答：为什么千万不能安装到反重力 App 安装根目录？**
- 反重力（Antigravity）客户端具有**后台静默自动升级**机制。如果将文件强行复制到 App 根目录（例如 `C:\Program Files\Antigravity` 或 `AppData\Local\Programs\Antigravity`），或者去改动 `app.asar`，那么**只要客户端一更新，所有修改就会被官方升级包全量清除覆盖，甚至引发哈希校验失败导致闪退**！
- Antigravity 官方专为插件设计的标准持久化目录是：
  - **Windows**：`%USERPROFILE%\.gemini\config\plugins\antigravity-skin`（即 `C:\Users\<你的用户名>\.gemini\config\plugins\antigravity-skin`）
  - **macOS / Linux**：`~/.gemini/config/plugins/antigravity-skin`
- **一键脚本已经为你全自动化处理好了一切**：
  本项目的 `install.bat` / `install.ps1` / `install.sh` 会自动按官方纯净白名单将插件部署到系统的 `.gemini` 官方持久化插件目录，并自动在 `config.json` 注册启用。**即使你以后更新反重力客户端，主题与个性化配置依然永久有效**！

---

## 🚀 安装步骤（三种方式任选其一）

### 方式一：下载 Release 压缩包一键安装（推荐，免 Git）
1. 前往 GitHub 仓库右侧的 [Releases](../../releases) 下载最新版的 `antigravity-skin.zip`。
2. 将压缩包解压到任意位置。
3. 执行一键安装：
   - **Windows**：直接**双击运行 `install.bat`**。（或右键使用 PowerShell 运行 `install.ps1`）
   - **macOS / Linux**：在终端进入解压目录，运行：
     ```bash
     chmod +x install.sh
     ./install.sh
     ```
4. 安装完成后，**完全退出并重新启动 Antigravity 客户端**即可！
   *(安装完成后，解压出来的文件夹可以随时删除)*

---

### 方式二：PowerShell 一行命令在线安装（Windows 极速免下载）
无需手动下载压缩包，直接在 PowerShell 窗口中粘贴并回车：

```powershell
irm https://raw.githubusercontent.com/MrcolorH/antigravity-skin/main/install.ps1 | iex
```
*(注：如果因网络无法访问 raw 内容，推荐直接采用【方式一】下载 Release 压缩包)*

---

### 方式三：从源码仓库安装（适合开发者）
如果您已经通过 `git clone` 将本仓库克隆到了本地：

- **Windows**：
  ```powershell
  cd antigravity-skin
  .\install.ps1
  ```
  *(或双击 `install.bat`)*

- **macOS / Linux**：
  ```bash
  cd antigravity-skin
  chmod +x install.sh
  ./install.sh
  ```

安装成功后，重启 Antigravity 即可。

---

## ⚙️ 如何在客户端中个性化设置

安装生效后，主题已与 Antigravity 原生设置融为一体：

1. 点击 Antigravity 左侧导航栏底部的 **⚙️ 设置（Settings）** 图标。
2. 切换至 **外观（Appearance）** 标签页。
3. 在顶部的 **「主题 (Theme)」** 选项中，点击 **「✨ 自定义」**。
4. 此时下方将展开专属控制台：
   - **动态视频壁纸**：一键开启或关闭；
   - **壁纸视频路径**：支持输入本地任意视频路径（如 `D:\Videos\my-bg.mp4`）或网络 URL；
   - **亮度 / 对比度调节**：拖动滑块实时预览毛玻璃透光效果；
   - **开机动画**：自由选择【流浪地球 550C 代码动效】或【自定义短视频】，支持一键点击「🎬 立即预览开机动画」；
   - **界面语言 (Language)**：自由切换中文（增强汉化）与默认英文。
5. 所有的调整均**实时生效**，并自动持久化保存，下次启动客户端自动应用。

---

## 🗑️ 彻底卸载

如果您希望卸载本插件并恢复纯官方初始环境：

- **Windows**：双击运行 `uninstall.bat`（或在 PowerShell 中执行 `.\uninstall.ps1`）。
- **macOS / Linux**：终端执行 `./uninstall.sh`。

脚本会自动从 `~/.gemini/config/plugins` 中安全移除插件，并自动清理配置项。重启 Antigravity 即可完全还原。

---

## 📦 项目代码结构

```text
antigravity-skin/
├── plugin.json                 # Antigravity 官方插件清单声明
├── config.default.json         # 出厂默认配置
├── install.bat                 # Windows 双击一键安装脚本
├── uninstall.bat               # Windows 双击一键卸载脚本
├── install.ps1                 # Windows PowerShell 自动部署脚本
├── uninstall.ps1               # Windows PowerShell 自动清理脚本
├── install.sh                  # macOS / Linux 一键安装脚本
├── uninstall.sh                # macOS / Linux 一键卸载脚本
├── sidecars/
│   └── skin-engine/
│       ├── sidecar.json        # 官方 Sidecar 服务声明配置
│       └── main.mjs            # 守护进程（流媒体 Range 服务 + CDP 长连接注入 + 状态自愈）
├── client/                     # 客户端渲染层代码
│   ├── index.js                # 客户端总控中心与配置桥接
│   ├── modules/
│   │   ├── appearance-menu.js  # 原生外观设置卡片深度无缝注入
│   │   ├── wallpaper.js        # 视频壁纸挂载、毛玻璃滤镜与气泡折叠
│   │   ├── boot-animation.js   # 550C 与自定义视频全屏开机动画引擎
│   │   ├── i18n-engine.js      # 智能防污染中文隔离汉化引擎
│   │   └── crt-theme.js        # 复古 CRT 特效模块
│   └── styles/
│       ├── glass-theme.css     # 深度毛玻璃与窗口穿透核心样式
│       └── crt-theme.css       # 复古扫描线样式
├── scripts/
│   ├── install.mjs             # 跨平台纯净白名单部署与 RPC 注册引擎
│   ├── uninstall.mjs           # 跨平台安全卸载引擎
│   └── pack.mjs                # 一键构建 GitHub Release 压缩包脚本
└── assets/
    └── videos/
        └── default-bg.mp4      # 内置精选默认动态壁纸素材
```

---

## 📄 开源许可证

本项目基于 [MIT License](LICENSE) 开源发布。
欢迎提交 Issue 和 Pull Request 共建更好看的 Antigravity！
