# Antigravity Skin & Theme 官方无感集成插件

<p align="center">
  <img src="https://img.shields.io/badge/Antigravity-2.0+-blue?style=flat-square" alt="Antigravity">
  <img src="https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey?style=flat-square" alt="Platform">
  <img src="https://img.shields.io/badge/Architecture-Official%20Sidecar%20Daemon-success?style=flat-square" alt="Architecture">
  <img src="https://img.shields.io/badge/Architecture-100%25%20Zero--Patch%20Default%20%7C%20Optional%20Kernel%20Boot-brightgreen?style=flat-square" alt="Zero Patch Architecture">
  <img src="https://img.shields.io/badge/License-MIT-orange?style=flat-square" alt="License">
</p>

> [!IMPORTANT]
> ### 🌟 `v0.3.4` 核心架构升级：默认全面回归「100% 零改包 / 零重签」纯净启动
>
> 为了彻底消除大家对“修改官方客户端文件 / 重签名”的顾虑，本插件自 `v0.3.4` 起默认全面采用**零改包、零重签**启动架构：
>
> 1. **默认零修改官方客户端（`features.kernelInjection: false`）**：
>    - 安装过程（`install.bat` / `install.ps1` / `install.sh` / `scripts/install.mjs`）、Windows 开机自愈与在线热更新**默认均不再修改官方 `app.asar`**，macOS **不再执行 `codesign` 重签名**，100% 完整保留 Google 官方原厂二进制与数字签名。
>    - 客户端后续自动更新**不会与插件产生冲突**（仅当系统清理了快捷方式参数时自动无感修复）。
> 2. **跨平台零改包无感启动入口**：
>    - **🪟 Windows**：安装脚本自动通过 Shell API 为桌面（兼容 OneDrive 重定向桌面）、开始菜单与任务栏固定快捷方式附加 `--remote-debugging-port=0` 参数（当 `Program Files` 只读时自动在用户桌面补充 `Antigravity (Skin).lnk`）。
>    - **🍎 macOS**：自动将未经修改的官方 `Antigravity.app` 无损隔离并生成轻量化单入口启动器（保留原版图标、文件拖放、URL 关联及统一入口体验；亦可在侧边栏切为“保留官方位置 + 独立启动器”模式）。
> 3. **按需开启可选内核注入**：
>    - 如仍需要「开机首帧零白闪视频 / 免参直启」，可在右上角 `⋮ -> 插件 -> Antigravity Skin` 侧边栏面板中手动确认开启「内核级前置注入」，并支持随时**一键从备份还原 100% 官方原版并切回纯净模式**。（*注：若 macOS 曾开启并执行过重签名，仅还原 `app.asar.bak` 无法恢复原厂数字签名，需从官方重新下载覆盖 `.app`*）。
> 4. **🛡️ 安全边界与自查提醒（重要）**：
>    - 本插件仅作用于**本地 UI 渲染与只读看板**，**绝不**读取或上传任何 Google 账号 OAuth 凭据、**绝不**拦截/反代任何 API 请求，已隔离本地 OAuth/登录页面并对本地服务与更新源实施严格白名单校验。
>    - 近期若遇到账号 `Error 403` / 封禁风险，请重点自查账号或本机是否安装/授权过**第三方 API 反代中转、号池工具、自动化刷量脚本或高风险代理节点**（可前往 Google 账号第三方权限页检查撤销）。

> **无缝集成、体验极致** 的 Google Antigravity 主题、动态视频壁纸、自定义开机引导动效与独立侧边栏控制面板插件。（**默认 Windows / macOS 全平台 100% 纯净零改包零重签**；**可选侧边栏按需开启深度防白闪增强**）

---

## 🖼️ 效果图预览 (Showcase)

> 💡 **搭配灵感 · 小红车 (Wallpaper Engine) 联动玩法**：
> 想要打造浑然一体的梦幻沉浸式桌面？
> 可以在 Steam **Wallpaper Engine（小红车）** 中挑选喜欢的视频壁纸（MP4 / WebM 格式），然后在 Antigravity「设置 - 外观」中直接载入。当反重力客户端与 Windows 桌面使用同款壁纸时，配合插件的全局毛玻璃通透穿透效果，窗口仿佛与桌面融为一体，带来极致的沉浸美感！

### 1. 桌面协同融合（配合 Wallpaper Engine 动态壁纸）
> 客户端窗口全局毛玻璃与桌面动态壁纸完美对准，边栏与气泡半透明悬浮，浑然天成。

<p align="center">
  <img src="docs/images/showcase-desktop.jpg" alt="配合桌面动态壁纸联动效果" width="95%">
</p>

### 2. 工作台主界面与动态壁纸穿透
> 无论是左侧项目栏、对话历史还是核心提问面板，均呈现晶莹的毛玻璃质感，底盘动态循环流动。

<p align="center">
  <img src="docs/images/showcase-glass.jpg" alt="主界面毛玻璃与动态壁纸穿透" width="95%">
</p>

### 3. 全屏沉浸式开机引导动画
> 彻底移除官方原版呼吸遮罩，启动时呈现丝滑全屏短视频或极客代码动效，支持按 `ESC` 随时跳过与平滑溶入主界面。

<p align="center">
  <img src="docs/images/showcase-boot.jpg" alt="全屏沉浸式开机引导动画" width="95%">
</p>

### 4. 官方原生「设置 - 外观」无缝集成控制面板
> 直接在官方外观设置中一键载入壁纸素材、微调亮度与对比度滑块、切换开机动画方案，即调即显。

<p align="center">
  <img src="docs/images/showcase-settings.png" alt="外观设置与个性化控制面板" width="95%">
</p>

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
- **展陈几何自适应（彻底无黑边）**：素材的定位与填充由独立几何控制器以最高优先级内联接管，窗口缩放、分屏、全屏、高 DPI 切换均实时跟随；提供 `铺满裁切 / 模糊填充 / 完整显示 / 拉伸铺满` 四种策略与九宫格裁切重心，默认「铺满裁切」可保证**任何比例素材都不出现黑边**。
- **用户对话气泡折叠增强**：长文本提问气泡智能限高并提供一键折叠/展开按钮。

### 3. 可定制开机引导动画（真·零延迟动态联动 & 影院级溶出）
- **官方 Logo 呼吸彻底移除（Windows 专属增强）**：彻底解除官方反重力呼吸 Logo 遮罩，直接动态联动呈现您在「设置 - 外观」中配置的专属开机动画（短视频或科技代码）。
- **零白闪平滑溶出（Cross-Dissolve）**：底层深度探测主工作台 DOM 与动态壁纸真实就绪状态后才提示「就绪」，点击跳过后通过 450ms 贝塞尔曲线自然溶入主界面，无缝衔接。
- **两套素材方案独立下拉切换（不管底层文件物理路径）**：
  - 🎬 **短视频开机方案**：内置独立视频下拉库，支持导入 MP4/WebM，直接通过下拉框在多个视频间自由切换。
  - 💻 **代码渲染动效方案**：内置极客科技动效预设与独立脚本下拉库，支持导入任意 Canvas / WebGL / DOM 渲染脚本，通过下拉框在各个代码动效方案间自由切换。
  - 两种模式下拉框完全独立，互不混杂，提供素材一键上传与安全删除管理。
- **即时交互与安全退出**：全屏播放期间随时按 `ESC` 键或点击屏幕跳过；内置「▶️ 立即预览」按钮，随时试看效果。

### 4. Wallpaper Engine / WallpaperMachine 外部素材库（零拷贝原地引用）
- **双通道独立开关**：动态壁纸与开屏动画各有一个「使用 Wallpaper 素材库」开关，任意组合都合法。开启后自动隐藏该维度的原生「选择 / 载入 / 删除」入口，只保留「当前素材 · 使用中」摘要；关闭则完整恢复插件原本的载入与素材管理。任一开关开启时，素材库区块固定出现在「插件版本与在线热更新」下方。
- **零拷贝、零冗余**：直接以绝对路径原地引用本地已下载的 Wallpaper Engine 创意工坊素材（Steam `431960`）或 WallpaperMachine 素材库，**绝不复制任何视频/图片到插件目录**，磁盘占用零增加。
- **三种形态全支持**：`🎬 video`（MP4/WebM 原生硬件解码）、`🌐 web`（HTML5/JS/WebGL 沙箱 iframe，静态资源经 Sidecar 安全托管）、`🎨 scene`（高清封面 + Ken Burns 微视差呼吸动效，支持内嵌氛围音）。
- **年龄分级筛选**：内置 `G 所有人 / PG-13 辅导级 / R-18 限制级` 三档，语义对齐 WallpaperMachine——默认全选不筛选，取消勾选即隐藏该档，偏好本地记忆。
- **严格安全过滤**：`application` 类型与 `.exe` 入口在扫描阶段即被拦截，永不载入、永不执行；所有文件读取均限制在已挂载的素材库白名单内，并做目录穿越防护。
- **双模式载入**：支持「📁 挂载素材库根目录」全量索引（含 Steam 库路径自动探测）与「📄 载入单个壁纸包」，粘贴路径回车即可挂载，即时展示资产卡片（封面 / 标题 / 类型徽章 / 体积）。
- **双色选中态**：卡片外框随用途配色——`设为动态壁纸` 为天蓝、`设为开屏动画` 为翠绿；同一张素材两者都用时呈现蓝绿渐变描边与双胶囊标记，一眼看清当前占用。

### 5. 深度隔离中文化引擎
- 内置隔离汉化引擎，智能汉化官方常用菜单、侧边栏与提示文案。
- **代码与终端严格隔离**：采用容器级回溯检测，自动规避代码块（`<pre>`, `<code>`）、Monaco/Ace 代码编辑器与终端输出，绝不污染代码原文。
- 汉化选项直接内嵌至外观设置卡片下方，支持一键热开关。

### 6. 官方 Sidecar 伴生架构与跨平台零改包启动
- **核心功能依托官方持久化规范**：主体功能（动态视频壁纸、毛玻璃穿透、独立侧边栏控制面板、在线热更新）基于 Antigravity 官方持久化插件规范与 Sidecar 伴生守护进程运行，核心代码与用户素材独立保存在用户目录（`.gemini/config/plugins`）中。
- **跨平台默认 100% 零改包纯净启动（`kernelInjection: false`）**：
  - **🪟 Windows 端**：默认不修改官方 `app.asar`，也不自动写入开机自愈注册脚本；自动通过 Shell API 为桌面（兼容 OneDrive 重定向桌面）、开始菜单与任务栏固定快捷方式附加 `--remote-debugging-port=0` 参数（当 `Program Files` 只读时自动创建桌面用户级 `Antigravity (Skin).lnk`）。如个人电脑仍需开屏首帧零白闪增强，可在侧边栏面板手动开启可选内核注入，并随时一键还原官方 `app.asar.bak`。
  - **🍎 macOS 端**：默认不修改官方 `app.asar`、不执行 `codesign` 重签名；自动采用隔离无感单入口启动器（或保留官方原位独立启动器），在完全保留官方代码签名与安全沙箱的同时自动携带调试参数启动，并支持在卸载时完整归位官方原版。
- **长连接持久巡检**：CDP 通道保持长效保活，页面重载、导航或热更新时自动无感补注皮肤，防止主题掉落，同时严格隔离登录与 OAuth 授权页。
- **顶部栏与文字对比度自适应（v0.1.8）**：顶部菜单字色跟随「壁纸顶部条带」亮度（而非原生主题），并叠加淡渐变蒙层与文字阴影兜底；同时内置**通用对比度守护**——逐个文本/图标元素计算其实际背景的 WCAG 对比度，低于 3:1 才自动翻色，不透明面板内保持原生配色不变。
- **原生窗口按钮永不失联**：零改包模式下完整保持官方原生窗口控件与色彩表现；可选内核注入模式下 Windows WCO 底色使用不透明保护色，开机动效期间平滑过渡。
- **优雅退出**：客户端关闭时自动注销清理进程与端口，杜绝僵尸进程占用资源。

### 7. 客户端内一键在线热更新（跨平台：Windows & macOS）
- **免手动重复下载与安装**：在右侧 `Antigravity Skin` 面板顶部直接点击「检查更新」，自动对接 GitHub Releases 获取最新发布。
- **真·无感热重载**：点击「立即更新」后，后台严格校验官方仓库下载地址与重定向白名单，安全流式下载并热更新插件源码，默认零改包模式下绝不触碰官方 `app.asar`。
- **用户数据绝对安全**：白名单增量更新严格保留本地个性化配置（`config.json`）与所有自定义壁纸/开机素材，绝无被覆盖丢失的风险。


---

## 🚀 安装步骤（三种方式任选其一）

### 方式一：下载 Release 压缩包一键安装（推荐，免 Git）
1. 前往 GitHub 仓库右侧的 [Releases](../../releases) 下载最新版的 `antigravity-skin.zip`。
2. 将压缩包解压到任意位置（如桌面或下载文件夹）。
3. 执行一键安装：
   - **Windows**：直接**双击运行 `install.bat`**。（或右键使用 PowerShell 运行 `install.ps1`）
   - **macOS / Linux**：在终端进入解压目录，运行：
     ```bash
     chmod +x install.sh
     ./install.sh
     ```
4. 安装完成后，**彻底退出并重新启动 Antigravity 客户端**即可！
   *(提示：安装成功后，解压出来的文件夹可以直接删除)*

---

### 方式二：终端一行命令极速在线安装（免手动下载）
无需手动下载压缩包，直接在终端中粘贴并回车：

- **Windows (PowerShell)**：
  ```powershell
  irm https://raw.githubusercontent.com/MrcolorH/antigravity-skin/main/install.ps1 | iex
  ```

- **macOS / Linux (Terminal)**：
  ```bash
  curl -fsSL https://raw.githubusercontent.com/MrcolorH/antigravity-skin/main/install.sh | bash
  ```

---

### 方式三：从源码仓库安装（适合开发者）
如果您已经通过 `git clone` 将本仓库克隆到了本地：

- **Windows**：直接双击 `install.bat` 或在 PowerShell 执行 `.\install.ps1`。
- **macOS / Linux**：终端执行 `./install.sh`。

---

### 🎬 跨平台启动入口与可选开机动画配置（Windows & macOS）

- **🍎 macOS 平台（默认零改包 / 零重签无感启动器）**：
  - 安装脚本自动构建轻量化单入口启动器（默认 `isolate` 模式接管 `/Applications/Antigravity.app` 并完整隔离官方 `.app`，或通过侧边栏切为 `keep_original` 模式）；
  - Sidecar 守护进程通过 Chromium CDP 事件在毫秒级平滑过渡原生 Loading 遮罩，100% 保持官方代码签名与沙箱完整性；
  - 若需要底层主进程级开屏视频，可在侧边栏确认开启可选内核注入（需执行 ad-hoc 重签名），并支持从备份还原。

- **🪟 Windows 平台（默认零改包快捷方式启动 + 可选内核增强）**：
  - 安装时默认仅配置快捷方式启动参数（桌面、开始菜单、任务栏固定栏，及只读安装目录自动补充用户桌面快捷方式），**不修改官方 `app.asar`**；
  - 如需启用高阶开屏首帧拦截，可在 `Antigravity Skin` 侧边栏按需确认开启，也可随时一键切回纯净启动或运行 `patch-loading.bat` / `restore-loading.bat`。

---

## ⚙️ 如何在客户端中个性化设置

安装生效后，请点击 Antigravity 右上角菜单 `⋮` → `插件 (Plugins)` → **`Antigravity Skin`** 打开独立侧边栏控制面板：

1. 查看顶部「插件通道状态」（零改包运行中 / 可选内核注入运行中）及在线更新状态；
2. 调节「界面与交互」（界面汉化、对话气泡样式、对话栏内嵌看板）；
3. 配置「动态壁纸」、「Wallpaper 素材库」零拷贝引用及「开机动画」效果。
4. 此时下方将展开专属控制台：
   - **动态视频壁纸**：一键开启或关闭；
   - **壁纸素材库与一键载入**：
     - 点击 **「📁 载入新视频壁纸」** 即可选取任意本地 `.mp4` / `.webm` 格式视频（**小红车 Wallpaper Engine 中的视频壁纸可直接在此载入**）；
     - 导入后自动纳入插件素材库，随时可通过下拉菜单自由切换；
   - **亮度 / 对比度调节**：拖动滑块实时无级微调毛玻璃透光度与对比反差；
   - **开机引导动画**：自由选择【代码动效】或【自定义短视频】，支持载入新开机短视频与一键「▶️ 立即预览」；
4. 如需「开机首帧防白闪视频 / 免参直启」，可在面板底部切换「内核级前置注入 (可选高级模式)」并确认；
5. 所有的调整均**实时生效**，并自动持久化保存，下次启动客户端自动应用。

---

## 🗑️ 彻底卸载（支持本地与一行命令）

如果您希望卸载本插件并恢复纯官方初始环境：

### 1. 终端一行指令在线卸载（最方便）
- **macOS / Linux**：
  ```bash
  curl -fsSL https://raw.githubusercontent.com/MrcolorH/antigravity-skin/main/uninstall.sh | bash
  ```
- **Windows (PowerShell)**：
  ```powershell
  irm https://raw.githubusercontent.com/MrcolorH/antigravity-skin/main/uninstall.ps1 | iex
  ```

### 2. 本地脚本卸载
- **Windows**：双击运行 `uninstall.bat`（或在 PowerShell 中执行 `.\uninstall.ps1`）。
- **macOS / Linux**：终端执行 `./uninstall.sh`。

脚本会自动从官方插件目录安全移除插件并清理配置文件。重启 Antigravity 即可完全恢复。

---

## 📦 项目代码结构

```text
antigravity-skin/
├── plugin.json                 # Antigravity 官方插件清单声明
├── config.default.json         # 出厂默认配置模板
├── CHANGELOG.md                # 版本演进总览与变更日志
├── install.bat                 # Windows 双击一键安装脚本
├── uninstall.bat               # Windows 双击一键卸载脚本
├── install.ps1                 # Windows PowerShell 自动部署脚本
├── uninstall.ps1               # Windows PowerShell 自动清理脚本
├── install.sh                  # macOS / Linux 一键安装脚本
├── uninstall.sh                # macOS / Linux 一键卸载脚本
├── patch-loading.bat           # Windows 前置开机动画防闪白溶出引擎升级脚本
├── restore-loading.bat         # Windows 一键安全恢复官方原厂开机状态脚本
├── self-heal.bat               # Windows 开机动画补丁立即自检与自愈（附守护状态）
├── loadingOverlay.js           # Windows 主进程 T=0 秒开机补丁模板
├── provisionSplash.js          # Electron 初始化 Splash 垫片
├── client/                     # 客户端渲染层代码
│   ├── index.js                # 客户端总控中心与配置桥接
│   └── modules/
│       ├── agy-modal.js        # 原生质感弹窗基建
│       ├── boot-animation.js   # 视频 / 场景封面 / 代码三类全屏开机动画引擎
│       ├── crt-theme.js        # 复古 CRT 特效模块
│       ├── i18n-engine.js      # 智能防污染中文隔离汉化引擎（含认证页隔离）
│       ├── media-display-modal.js # 独立参数调节面板与修饰键配置
│       ├── wallpaper-library-ui.js # 外部素材库资产中心（卡片网格 / 筛选 / 双向应用）
│       └── wallpaper.js        # 多形态壁纸渲染器（video / web iframe / scene）与毛玻璃
│   └── styles/
│       ├── crt-theme.css       # 复古扫描线样式
│       └── glass-theme.css     # 深度毛玻璃与窗口穿透核心样式
├── sidecars/
│   ├── panel/                  # Antigravity Skin 独立侧边栏控制面板（WebView / Sidecar UI）
│   └── skin-engine/
│       ├── sidecar.json        # 官方 Sidecar 服务声明配置
│       ├── main.mjs            # 守护进程（流媒体 Range 服务 + CDP 注入 + 零改包状态机）
│       ├── scene-pkg.mjs       # PKG 解包与 Scene 数据流驱动
│       ├── wallpaper-library.mjs # 外部素材库解析引擎（project.json / 缓存 / 静态伺服）
│       └── vendor/             # 场景渲染三方依赖 (WebWallGL)
├── scripts/                    # 部署、运维与发布管理脚本
│   ├── hot-sync.mjs            # 源码文件变动实时监听与自动热同步
│   ├── install.mjs             # 跨平台纯净白名单部署、快捷方式/mac启动器与 RPC 注册
│   ├── pack.mjs                # 一键构建 GitHub Release 压缩包脚本
│   ├── patch-boot-overlay.mjs  # 可选内核注入与原生窗口锁黑补丁 (Win & macOS)
│   ├── platform-host.mjs       # 跨平台宿主寻址、快捷方式/启动器与配置原子写入公共模块
│   ├── register-self-heal.mjs  # 注册/注销开机自愈守护（仅内核注入开启时生效）
│   ├── restore-boot-overlay.mjs# 跨平台官方 app.asar 自动还原与纯净模式切换脚本
│   ├── self-heal.mjs           # 开机自愈（严格门控于 kernelInjection === true）
│   ├── sync-all.mjs            # 全量文件一键快速热同步至系统插件目录
│   └── uninstall.mjs           # 跨平台安全卸载与启动器归位引擎
├── tools/                      # 开发者辅助工具
│   ├── capture-previews.mjs    # 文档效果图与界面截图自动化采集
│   └── inspect-dom.mjs         # CDP 实时 DOM 节点与计算样式快速探查
├── tests/                      # 自动化测试套件 (`npm test`)
│   ├── test-scenescript-properties.mjs   # 场景脚本属性解析与沙箱测试
│   └── test-wallpaper-interaction.mjs    # 壁纸按键穿透与双轨网桥测试
├── docs/                       # 核心文档与设计归档
│   ├── bugs/                   # 缺陷追踪与技术复盘报告 (BUG-001 ~ BUG-024)
│   ├── images/                 # 项目效果图与文档用图
│   ├── plan/                   # 模块架构总设计与阶段演进规划
│   └── releases/               # 历史版本 Release Notes (v0.1.1 ~ v0.2.1)
└── assets/
    ├── scripts/
    │   └── default-boot.js     # 内置极客科技开机引导代码动效预设
    └── videos/                 # 本地视频素材管理库（支持随时载入/删除 MP4/WebM）
```

---

## 🤝 交流反馈与参与共建 (Feedback & Contributing)

非常欢迎大家体验使用并提供宝贵的意见与灵感！
- **遇到问题或有优化建议**：欢迎前往 [Issues](https://github.com/MrcolorH/antigravity-skin/issues) 提交反馈，我们会持续快速跟进与迭代优化；
- **参与开发与特性贡献**：热烈欢迎大家多多提交 [Pull Requests (PR)](https://github.com/MrcolorH/antigravity-skin/pulls)！无论是动效素材扩展、毛玻璃细节打磨、隔离汉化词条补充还是性能优化，期待与大家一同共建更好看、更好用的 Antigravity！

---

## 📄 开源许可证

本项目基于 [MIT License](LICENSE) 开源发布。

