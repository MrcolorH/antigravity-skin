# 变更日志 (Changelog)

本项目所有重要更新与发布说明均记录在此文件中。各版本的完整演进细节与技术架构解析可点击对应版本的发布说明查阅。

---

## 📌 版本记录索引

| 版本 | 发布重点 | 详细说明 |
| :--- | :--- | :--- |
| **v0.2.13** | 彻底修复冷启动/首页黑屏卡死（本地回环媒体 Blob 极速加载、开机首帧门控、i18n/ContrastGuard/CDP 冷启动全链路优化） | [RELEASE_v0.2.13.md](docs/releases/RELEASE_v0.2.13.md) |
| **v0.2.12** | 统一 AI 回复正文与工具链毛玻璃气泡形态、全语言容器容错与闭环适配 | [RELEASE_v0.2.12.md](docs/releases/RELEASE_v0.2.12.md) |
| **v0.2.11** | 适配 Antigravity 新版消息容器与 AI 对话框毛玻璃背景多维容错修复 | [RELEASE_v0.2.11.md](docs/releases/RELEASE_v0.2.11.md) |
| **v0.2.10** | 用户消息气泡展开态 50vh 最大高度限制、自包含平滑滚动与防嵌套重叠 | [RELEASE_v0.2.10.md](docs/releases/RELEASE_v0.2.10.md) |
| **v0.2.9** | 在线热更新后版本状态实时自动同步与闭环核验、陈旧缓存防倒退机制修复 | [RELEASE_v0.2.9.md](docs/releases/RELEASE_v0.2.9.md) |
| **v0.2.8** | 全面适配 Antigravity 2.30+ 容器架构、动态壁纸毛玻璃穿透修复、过渡层守护重连优化 | [RELEASE_v0.2.8.md](docs/releases/RELEASE_v0.2.8.md) |
| **v0.2.7** | 纯图片消息默认收起塌陷修复、提问文字与时间戳精准隔离、气泡最小安全底线防护 | [RELEASE_v0.2.7.md](docs/releases/RELEASE_v0.2.7.md) |
| **v0.2.6** | 排队消息卡片右侧按钮图标常态隐形与灰色圆点遮挡修复、徽标选择器精准隔离 | [RELEASE_v0.2.6.md](docs/releases/RELEASE_v0.2.6.md) |
| **v0.2.5** | 彻底消除冷启动穿插黑屏与白闪、重型场景壁纸分段解耦杜绝主线程卡死、退场 Seek 黑帧与死锁修复 | [RELEASE_v0.2.5.md](docs/releases/RELEASE_v0.2.5.md) |
| **v0.2.4** | 冷启动零黑屏秒级开屏引导、macOS 原生过渡层智能接力、开机时序与气泡阅读深度优化 | [RELEASE_v0.2.4.md](docs/releases/RELEASE_v0.2.4.md) |
| **v0.2.3** | 官方新版对话框文件统一气泡包裹、智能两行截断收起、50vh 视窗保护与经典折叠胶囊恢复 | [RELEASE_v0.2.3.md](docs/releases/RELEASE_v0.2.3.md) |
| **v0.2.2** | 输入栏 Gemini Live 实时语音按钮晶莹毛玻璃深度适配、全局搜索框图标隔离与汉化补全 | [RELEASE_v0.2.2.md](docs/releases/RELEASE_v0.2.2.md) |
| **v0.2.1** | 反重力最新版布局深度适配、穿透穿帮修复与滚动接缝防闪优化（Layout Thrashing Loop 修复） | [RELEASE_v0.2.1.md](docs/releases/RELEASE_v0.2.1.md) |
| **v0.2.0** | 壁纸交互穿透与按键响应系统（Hold-to-Interact / Alt 穿透 / WebWallGL 双轨网桥） | [RELEASE_v0.2.1.md](docs/releases/RELEASE_v0.2.1.md) |
| **v0.1.9** | 冷启动开屏体验优化与跨进程原子交接专项修复（消灭冷启动二次开屏闪烁 BUG-024） | [RELEASE_v0.1.9.md](docs/releases/RELEASE_v0.1.9.md) |
| **v0.1.8** | 开机补丁自愈守护、顶部状态栏可读性优化与透明面文字对比度守护引擎 | [RELEASE_v0.1.8.md](docs/releases/RELEASE_v0.1.8.md) |
| **v0.1.7** | Windows 开机动画补丁持久化与自愈守护（防止更新覆盖 `app.asar`） | [RELEASE_v0.1.7.md](docs/releases/RELEASE_v0.1.7.md) |
| **v0.1.5** | macOS & Windows 跨平台冷启动防闪与开屏影院级平滑接力专项版 | [RELEASE_v0.1.5.md](docs/releases/RELEASE_v0.1.5.md) |
| **v0.1.4** | 跨平台开机与开屏过渡体验专项封版（解决菊花复现与白屏跳变） | [RELEASE_v0.1.4.md](docs/releases/RELEASE_v0.1.4.md) |
| **v0.1.3** | 外观配置面板与热更新版本比对紧急修复 | [RELEASE_v0.1.3.md](docs/releases/RELEASE_v0.1.3.md) |
| **v0.1.2** | macOS 平台稳定性与视觉体验专项优化（零改包、零黑屏启动） | [RELEASE_v0.1.2.md](docs/releases/RELEASE_v0.1.2.md) |
| **v0.1.1** | Wallpaper 素材库重磅集成（Wallpaper Engine 深度兼容、4K/60fps WebGL2 场景渲染、双缓冲原子换轨） | [RELEASE_v0.1.1.md](docs/releases/RELEASE_v0.1.1.md) |

---

> 💡 更多历史故障排查报告与专项技术方案，请参考 [docs/bugs/](docs/bugs/README.md) 与 [docs/plan/](docs/plan/Wallpaper素材库集成/README.md)。
