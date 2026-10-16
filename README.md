# Antigravity Skin & Theme 官方插件

> **免侵入、零改包** 的 Google Antigravity 主题、动态视频壁纸、550C 开机动画与外观菜单集成插件。

---

## 🌟 特性概览

1. **官方插件机制接入**：
   - 采用 Antigravity 官方 Sidecar 伴生机制，无需解包或篡改原版 `app.asar`，客户端升级不受任何影响。
   - 告别独立的“反重力 中文.app”魔改打包，直接与官方 Antigravity 协同运行。
2. **全局动态视频壁纸**：
   - 本地 Range 分块流媒体服务（支持拖拽进度、低内存消耗）。
   - 全局界面 100% 透明毛玻璃穿透（侧边栏、对话气泡、输入框、辅助侧栏深度适配）。
   - 用户提问气泡智能折叠/展开增强。
3. **550C 极客特效**：
   - 流浪地球2 550C 量子计算机开机引导动画（支持 ESC 一键跳过）。
   - CRT 荧光微距扫描线与复古琥珀金滚动条。
4. **外观设置页面无缝集成**：
   - 自动在 Antigravity「设置」->「外观」面板中挂载专属「🎨 自定义主题与动态皮肤设置」卡片。
   - 支持可视化开关视频壁纸、实时调节亮度/对比度滑块、开机关机动画、CRT 扫描线及语言切换。
5. **完整中文隔离汉化**：
   - 内置基于 DOM 容器回溯的隔离汉化引擎，严格隔离代码块与编辑器，可一键开关。

---

## 📂 项目结构

```text
antigravity-skin/
├── plugin.json                 # 官方插件元数据声明
├── config.default.json         # 默认出厂配置
├── config/
│   └── config.json             # 用户实时个性化配置（开关、滑块值）
├── install.sh                  # 一键挂载并启用插件
├── uninstall.sh                # 一键卸载插件并还原
├── sidecars/
│   └── skin-engine/
│       ├── sidecar.json        # 官方 Sidecar 声明（Antigravity 启动自动拉起）
│       └── main.mjs            # 后台守护进程（视频流分块服务 + CDP 动态注入 + RPC）
├── client/                     # 注入到宿主渲染层的脚本
│   ├── index.js                # 客户端调度总入口
│   ├── modules/
│   │   ├── wallpaper.js        # 视频壁纸与毛玻璃挂载
│   │   ├── boot-animation.js   # 550C 开机引导动画
│   │   ├── crt-theme.js        # CRT 扫描线与琥珀金主题
│   │   ├── appearance-menu.js  # 外观设置页面注入与交互绑定
│   │   └── i18n-engine.js      # 隔离汉化引擎
│   └── styles/
│       ├── glass-theme.css     # 深度毛玻璃与透明穿透样式表
│       └── crt-theme.css       # CRT 扫描线专属样式表
└── assets/
    └── videos/
        └── default-bg.mp4      # 内置默认视频素材
```

---

## 🚀 快速安装

在终端执行一键安装脚本：

```bash
cd antigravity-skin
./install.sh
```

安装完成后，**完全退出并重新打开 Antigravity** 即可。

---

## ⚙️ 个性化调节

在 Antigravity 客户端中：
1. 点击左侧导航栏底部的 **设置** 图标。
2. 切换到 **外观** 页面。
3. 在页面下方即可看到 **「🎨 自定义主题与动态皮肤设置」** 面板，可随时调整壁纸开关、亮度滑块、开机动画与语言选项。配置将实时生效并自动持久化。

---

## 🗑️ 卸载插件

如需彻底移除：

```bash
cd antigravity-skin
./uninstall.sh
```

重启客户端后即完全恢复官方初始状态。
