# VS Code 动态皮肤插件 (VS Code Dynamic Skin)

> 🎨 **专为 VS Code 打造的极简动态视频皮肤插件**：只专注于两件事——**加载本地素材目录** 与 **全屏视频渲染及半透明毛玻璃穿透**，没有任何多余开销与复杂杂项。

---

## 💡 为什么可以做？核心原理分析

VS Code 的扩展架构（Extension Host）基于 Node.js 进程沙箱，默认不提供直接修改主窗口 DOM 和挂载底层 `<video>` 的官方 API。

本插件借鉴了成熟社区方案（如 `vscode-background` 等）的标准工作流：
1. **直接定位工作台渲染主入口**：利用 `vscode.env.appRoot` 动态定位 `${appRoot}/out/vs/workbench/workbench.desktop.main.js`；
2. **轻量沙箱渲染注入**：在文件尾部注入独立标记的闭包代码，挂载全屏底层 `<video>` 容器，并通过 VS Code 原生内置的 `vscode-file://` 安全协议直接读取用户磁盘中的 MP4 / WebM 视频；
3. **精准毛玻璃与透明度覆盖**：自动将编辑器、侧边栏、标题栏与面板背景转为半透明（可自定义透明度与高斯模糊模糊度），让动态视频丝滑穿透；
4. **安全可逆与无损还原**：所有注入均包裹在明确的标记区间内，首次应用时自动备份原文件，点击「卸载」即可秒级 100% 还原为官方原生状态。

---

## 🚀 核心命令与使用方法

按下 `Ctrl+Shift+P`（Mac 为 `Cmd+Shift+P`）打开命令面板，输入 `动态皮肤` 或 `Dynamic Skin`：

| 命令 | 说明 |
| :--- | :--- |
| **动态皮肤: 📁 选择视频素材目录** | 打开文件夹选择框，指定存放 MP4/WebM 视频的文件夹（自动扫描） |
| **动态皮肤: 🎬 选择当前播放视频** | 在当前目录所包含的视频素材列表中快速下拉挑选 |
| **动态皮肤: ✨ 应用/刷新动态皮肤** | 写入渲染注入代码，并引导一键重新加载窗口生效 |
| **动态皮肤: 🧹 卸载/恢复原生界面** | 彻底清除所有注入代码，100% 恢复 VS Code 官方默认样式 |
| **动态皮肤: ⚙️ 打开个性化配置** | 打开设置面板快速调节不透明度、模糊度、填充方式与亮度 |

---

## ⚙️ 个性化配置项 (`settings.json`)

在 VS Code `settings.json` 中可直接微调以下选项：

```json
{
  // 视频壁纸目录路径
  "dynamicSkin.directory": "/Users/yourname/Videos/Wallpapers",

  // 当前播放的视频文件名（留空默认使用目录内首个视频）
  "dynamicSkin.currentVideo": "cyberpunk_city.mp4",

  // 代码编辑区不透明度 (0.1 ~ 1.0，越小越透，默认 0.85)
  "dynamicSkin.opacity": 0.85,

  // 背景毛玻璃模糊半径 (px，默认 5)
  "dynamicSkin.blur": 5,

  // 视频填充模式: cover (铺满无黑边，推荐) | contain (等比保留) | fill (拉伸)
  "dynamicSkin.videoFit": "cover",

  // 视频画面亮度调节 (0.1 ~ 2.0，默认 0.9，避免背景太亮抢眼)
  "dynamicSkin.brightness": 0.9,

  // 视频画面对比度调节 (0.1 ~ 2.0，默认 1.0)
  "dynamicSkin.contrast": 1.0,

  // 播放倍速 (0.25 ~ 2.0，默认 1.0)
  "dynamicSkin.playbackRate": 1.0
}
```

---

## 🛠️ 本地安装与调试方法

### 方式 1：直接软链接或复制到插件目录（极速生效）
无需打包，将本目录直接放到 VS Code 的用户扩展目录：
* **macOS / Linux**:
  ```bash
  ln -s "$(pwd)" ~/.vscode/extensions/vscode-dynamic-skin
  ```
* **Windows (PowerShell)**:
  ```powershell
  New-Item -ItemType SymbolicLink -Path "$HOME\.vscode\extensions\vscode-dynamic-skin" -Target (Get-Location)
  ```
重启 VS Code，即可在扩展列表中看到并使用。

### 方式 2：打包为 `.vsix` 文件安装
确保已安装 `vsce`：
```bash
npx vsce package --no-dependencies
# 会生成 vscode-dynamic-skin-0.1.0.vsix
# 在 VS Code 中按 Cmd+Shift+P 输入: Extensions: Install from VSIX... 选择安装即可
```

---

## 📌 注意事项与常见问题

1. **更新后提示 "[不受支持]" (Unsupported)**：
   - 这是 VS Code 检测到 `workbench.desktop.main.js` 文件哈希发生变化后的官方安全校验提示，属正常现象。可以点击右上角齿轮选择“不再显示”，或使用插件 `Fix VSCode Checksums` 消除警告。
2. **VS Code 客户端版本升级后失效**：
   - 官方更新会重新下载并覆盖 `workbench.desktop.main.js` 文件，只需在更新后再次执行一次命令 **`动态皮肤: ✨ 应用/刷新动态皮肤`** 即可立即恢复。
3. **文件写入权限不足**：
   - 若遇到 `EACCES` 或 `EPERM` 报错，说明 VS Code 安装在系统受保护目录下（如 macOS 的 `/Applications` 或 Windows 的 `Program Files`）。
   - **macOS**: 在终端执行一次 `sudo chown -R $(whoami) "/Applications/Visual Studio Code.app"` 即可。
   - **Windows**: 右键 VS Code 选择「以管理员身份运行」执行一次应用即可。
