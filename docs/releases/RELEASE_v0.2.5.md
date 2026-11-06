# 🌟 Antigravity Theme & Skin v0.2.5 发布说明

本版本为 **冷启动零黑屏、零闪白、重型场景壁纸分段解耦与主线程防卡死专项版**。针对冷启动期间偶发的“中途穿插黑屏”、“开屏短视频掉帧卡顿”以及“10~12秒假死等待”等痛点进行了系统性重构与性能深度调优，确保从客户端点击启动、开机引导视频播放，到平滑溶入工作区首页的全流程真正达到影院级零闪烁、满血 60fps 体验。

---

### 🚀 核心改进与新特性

#### 1. 彻底解决冷启动中途穿插黑屏与二次闪现（macOS 与 Windows 双端权责解耦）
- **macOS 原生遮罩权责清晰化**：
  macOS 官方 Electron 在 `did-finish-load`（约 800ms~1s）会无条件移除原生 `loadingOverlay`。先前逻辑强行在原生遮罩塞入 3 秒视频并向主窗口加锁，导致播放 1 秒后被宿主强拔遮罩，视口瞬间暴露出未就绪的空白底板（引发黑屏断层）。
  **新架构**：原生遮罩在启动早期仅作为极简纯黑屏障（抹去官方白色 Logo）；开屏引导动效 100% 由主窗口 DOM (`boot-animation.js`) 全生命周期持久掌控，彻底杜绝被宿主提前掐灭导致的黑屏。
- **Windows 补丁防重复接管**：
  Sidecar 在探测原生遮罩时增加 Windows 补丁状态检测，当系统已打入主进程 `loadingOverlay.js` 补丁时，Sidecar 彻底避让，杜绝一个窗口内两个全屏视频和两套状态胶囊打架重叠。

#### 2. 重型场景壁纸（100MB+ pkg）分段按需装配，彻底根治主线程卡死
- **根因诊断**：
  先前策略在开机动画播放的同时在后台全速解包 `scene.pkg`（如 165MB 动效包），主线程在极短时间内连续执行 Zip 解压、JSON 解析、4K 纹理上传和数十个着色器编译，将渲染进程主线程 100% 占死，导致开机视频严重卡顿、掉帧甚至假死。
- **两阶段按需呈现 (Stage-based Loading)**：
  - **第一阶段（开机期）**：`mountScene()` 挂载轻量封面海报（`img.agy-scene-poster`），在 10ms 内首帧秒级就绪，开机短视频享受 100% 独立 CPU 与 GPU 算力，全程 60fps 丝滑播放；
  - **第二阶段（交接期）**：将重量级 WebWallGL 场景装配推迟到开机动画即将淡出（`__agyResumeBootWallpaper`）或进入工作区后执行，并借助双缓冲 Canvas 与海报平滑 Cross-fade 交叉溶图，实现零卡顿、零黑屏无缝换轨；
  - **纯视频壁纸真实休眠**：修复 `pauseWallpaperVideo()` 误调用 `v.play()` 的问题，在开屏期间真实暂停壁纸解码，完全释放 GPU 硬解资源。

#### 3. 消除视频退场 Seek 黑帧与 10 秒超时死锁
- **消除 Seek 黑帧**：拔除 `timeupdate` 中快播完时暴力重置 `video.currentTime = 0` 的逻辑，彻底消灭 Chromium 硬件解码器 Seek 时必然产生的 100~300ms 黑场闪烁；
- **双重就绪判定**：`__agyIsHostTrulyReady` 与 `canSafelyDismissBoot` 引入海报已加载即判定为具备视觉成型能力，并设定 **3.5 秒绝对超时保底**，杜绝因 WebGL 编译迟缓导致开屏动效无限死等，彻底告别 10~12 秒防假死强制退出的不良体验。

#### 4. 彻底消灭全局底板白闪
- 将 `#agy-wallpaper-backdrop` 的基准默认背景色由纯白 `#ffffff !important;` 彻底修改为纯黑 `#000000 !important;`，杜绝任何阶段主题类名尚未附加时的刺眼白闪。

---

### 📦 变更文件一览
- [`sidecars/skin-engine/main.mjs`](sidecars/skin-engine/main.mjs)：原生遮罩纯黑静音守护，解耦 macOS 与 Windows 开机接管权责；
- [`client/modules/boot-animation.js`](client/modules/boot-animation.js)：拔除退场 Seek 黑帧，引入 3.5s 退出保底，修复壁纸休眠机制；
- [`client/modules/wallpaper.js`](client/modules/wallpaper.js)：引入场景海报即时占位与重型 WebGL 分段推迟装配机制；
- [`loadingOverlay.js`](loadingOverlay.js)：补全对场景海报的就绪识别，避免误触发 10 秒保底；
- [`client/styles/glass-theme.css`](client/styles/glass-theme.css)：将底板全局默认色设为纯黑，彻底消灭白闪；
- [`package.json`](package.json) / [`plugin.json`](plugin.json)：版本号升级至 `v0.2.5`；
- [`CHANGELOG.md`](CHANGELOG.md)：版本演进记录归档。

---

### ⚡ 升级指南
已安装插件的用户打开 Antigravity，点击左下角 **「外观设置」** -> **「⚡ 检查更新」**，即可检测到 `v0.2.5` 并点击 **「🚀 立即热更新」** 无感升级！
