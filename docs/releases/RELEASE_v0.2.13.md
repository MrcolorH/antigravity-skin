# 🌟 Antigravity Theme & Skin v0.2.13 发布说明

本版本为 **冷启动与首页黑屏卡死深度治理专项版**。针对 Antigravity 2.31+（Electron 44 / Chromium 152）环境下冷启动黑屏一闪、进首页全黑等候数十秒才展示壁纸、以及启动期主线程竞争导致的重绘滞后等问题进行了全链路根治，并完整合入 `v0.2.12` 的全语言 AI 回复气泡毛玻璃适配。

---

### 🚀 核心改进与修复说明

#### 1. 本地回环媒体 `fetch()` → `blob:` 共享缓存加载器（解决 15 秒媒体阻塞）
- **根因诊断**：在 Antigravity 2.31+ / Electron 44 (`https://127.0.0.1`) 页面中，`<video>` / `<img>` / `<audio>` 直连 sidecar 回环地址（`http://127.0.0.1:<port>`）每次请求会触发约 15 秒的内部阻塞；遇到 `moov` 原子位于文件末尾的视频或循环重缓冲时，会连续叠加多次 15 秒黑屏等待，同时拖慢壁纸封面亮度探测。
- **架构修复**：
  - 在 [`client/modules/boot-animation.js`](client/modules/boot-animation.js) 提供 `window.__agyResolveBlobMediaUrl`（基于同端口 `fetch()` 获取后生成内存 `blob:` URL，配合 LRU 缓存上限 4 条、单文件 250 MB 阈值保护及错误自动回退直连 URL）；
  - 对 `/boot-video.mp4?path=...`、`/wallpaper.mp4?path=...`、`/api/video?path=...` 按实际本地路径归一化缓存键，开机视频与首页壁纸指向同一视频时直接 0ms 共享同一份 `blob:` 内存对象；
  - 在 [`client/modules/wallpaper.js`](client/modules/wallpaper.js) 与 [`client/index.js`](client/index.js) 中接入视频壁纸、场景海报、场景音频与亮度探测图的统一极速加载路径（使用 `dataset.agyLogicalSrc` 保持热更新逻辑路径幂等比对）。

#### 2. 开机动画首帧门控与无黑帧无缝衔接
- 在 [`client/modules/boot-animation.js`](client/modules/boot-animation.js) 新增 `videoFrameReady` 与 `maybeStartDismissScheduler()`：开机视频必须真实解码出首帧（`loadeddata` / `canplay` / `playing`）后再启动 `autoEnterDelay` 倒计时（保留 ESC / 点击跳过与 5 秒容灾超时兜底），彻底杜绝视频 0 帧时纯黑闪退；
- 在开屏退场 T=0 同步清理 macOS 防闪白样式并通知 `/api/boot-finished`，避免重入时误清 `__agyBootPlaying` 锁。

#### 3. Sidecar、CDP 注入与防白底遮罩加固
- [`sidecars/skin-engine/main.mjs`](sidecars/skin-engine/main.mjs)：
  - 仅在配置了场景壁纸/场景开屏时随包内联 `webwallgl.js`（约 1.1 MB），视频/网页模式按需注入并提供 `POST /api/vendor/webwallgl/ensure`；
  - 新增 CDP 包哈希（`__AG_SKIN_BUNDLE_HASH__`）去重、子帧导航过滤（`parentId`）与 `CONNECTING` 并发保护，避免冷启动重复注入打断渲染；
  - 原生遮罩识别不区分大小写兼容小写 `<!doctype html>` 的纯白底页（`#FFFFFF`），且无 Logo 时只置黑不叠加载胶囊；
  - `streamVideoFile` 完善后缀字节范围、`416` 校验与 `req/res` `close` 流销毁清理；
  - 为 macOS 防闪黑覆盖增加 12 秒自愈看门狗与 `alreadyBooted` 校验。

#### 4. 冷启动主线程性能与样式整合
- [`client/index.js`](client/index.js)：`ContrastGuard` 拆分为纯读阶段与批量写阶段（消除强制同步布局回流），支持开屏期间推迟遍历与阴性祖先缓存，去重重复 `setLanguage` 调用；
- [`tools/build-i18n-engine.mjs`](tools/build-i18n-engine.mjs) & [`client/modules/i18n-engine.js`](client/modules/i18n-engine.js)：修复 `chineseLocalization: false` 未生效问题，冷启动开屏期间延后首次全树 `TreeWalker`，并增加自身属性修改免疫与时间片节流；
- [`client/styles/glass-theme.css`](client/styles/glass-theme.css)：合入 `v0.2.12` 中全语言（含中文 `aria-label="智能体回复"` 与 `turn-cards-container`）毛玻璃气泡规则。

---

### 📦 变更文件一览
- [`sidecars/skin-engine/main.mjs`](sidecars/skin-engine/main.mjs)
- [`client/modules/boot-animation.js`](client/modules/boot-animation.js)
- [`client/modules/wallpaper.js`](client/modules/wallpaper.js)
- [`client/index.js`](client/index.js)
- [`tools/build-i18n-engine.mjs`](tools/build-i18n-engine.mjs) / [`client/modules/i18n-engine.js`](client/modules/i18n-engine.js)
- [`client/styles/glass-theme.css`](client/styles/glass-theme.css)
- [`tests/test-startup-blackscreen-fixes.mjs`](tests/test-startup-blackscreen-fixes.mjs)
- [`package.json`](package.json) / [`plugin.json`](plugin.json) / [`CHANGELOG.md`](CHANGELOG.md)
- [`docs/releases/RELEASE_v0.2.13.md`](docs/releases/RELEASE_v0.2.13.md)

---

### ⚡ 升级指南
已安装插件的用户打开 Antigravity，点击左下角 **「设置 - 外观」** -> **「⚡ 检查更新」**，即可检测到 `v0.2.13` 并点击 **「🚀 立即热更新」** 无感升级！
新用户可直接运行 `install.sh`（macOS/Linux）或 `install.bat`（Windows）一键安装。
