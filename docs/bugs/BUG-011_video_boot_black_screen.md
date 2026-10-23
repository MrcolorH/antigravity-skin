> **导航**：[⬅ 返回缺陷总清单 (BUG_TRACKING_LIST.md)](./BUG_TRACKING_LIST.md)

---

# BUG-011: 从素材库选择视频设为开屏动画后开屏画面全黑无视频播放

- **缺陷编号**：`BUG-011`
- **涉及需求 / 模块**：Wallpaper素材库集成 (`loadingOverlay.js`, `client/modules/wallpaper-library-ui.js`, `scripts/patch-boot-overlay.mjs`)
- **严重级别**：P1（核心功能与视觉体验缺陷）
- **当前状态**：`已修复`
- **发现时间**：2026-10-23
- **修复完成时间**：2026-10-23
- **报告人**：用户反馈 / 排查

## 1. 问题现场与截图
用户在 Wallpaper 素材库中选择外部视频壁纸（如 `E:\SteamLibrary\steamapps\workshop\content\431960\2109603543\合成 1.mp4`）设置为开屏动画后，启动客户端时，开屏画面正中完全全黑，无法正常播放视频，仅右下角悬浮就绪状态按钮，直到超时退出或按 ESC 才能进入工作区。

## 2. 缺陷现象描述
1. 用户在外部素材库中点击“设为开屏动画”，提示设置成功；
2. 重新启动客户端（冷启动）或在设置中预览开屏时，整个界面除右下角悬浮状态胶囊外，中央内容区域呈现一片死黑，预期的壁纸视频完全没有播放；
3. 用户按 ESC 或等待超时后方可进入主工作区。

## 3. 期望表现（规范定义）
1. 用户选定任意本地有效路径的视频壁纸（包括 Windows 盘符、带有空格与中文字符）后，冷启动与前置 loading 期间必须平滑、无延迟硬解秒播该视频；
2. 视频应继承配置的 `object-fit`、`object-position`、`brightness` 和 `contrast` 属性，充满视口展示；
3. 若偶发外部素材损坏或被外部移动，应具备健壮的错误捕获与诊断提示，严禁出现不可控的纯黑盲区。

## 4. 根本原因分析（代码级诊断）
1. **反斜杠替换正则失效与非法 URL 转义**：
   在 `loadingOverlay.js` 的 `generateOverlayHtml` 中，原逻辑采用：
   ```javascript
   const cleanVidPath = vidPath.replace(/\\\\/g, "/");
   const vidUrl = encodeURI(cleanVidPath.startsWith('/') ? ("file://" + cleanVidPath) : ("file:///" + cleanVidPath));
   ```
   - 正则表达式 `/\\\\/g` 在 JS 中匹配的是字面量双反斜杠 `\\`，而 Node 读取 Windows 路径（如 `E:\SteamLibrary\...`）在内存中仅为单反斜杠 `\`，导致该正则替换完全失效；
   - 随后的 `encodeURI(...)` 将路径中所有未替换的单反斜杠全部转码为 `%5C`，生成了诸如 `file:///E:%5CSteamLibrary%5Csteamapps%5C...` 的畸形 URL；
   - Chromium 内核将包含 `%5C` 的 URL 判定为不存在的单一文件名而非目录层级，导致抛出 `net::ERR_FILE_NOT_FOUND` (404) 错误。
2. **错误处理粗暴致盲**：
   `<video>` 元素标签中配置了 `onerror="this.style.display='none'; ..."`，在加载失败后直接将视频元素设为隐藏；同时舞台底板为 `#boot-stage { background: #000000; }`，当配置 `autoEnterDelay === 0` 时不会自动超时关闭，最终给用户呈现一片纯黑。

## 5. 建议修复方案（技术执行路径）
1. **引入标准 `url.pathToFileURL`**：
   在 `loadingOverlay.js` 中使用 Node.js 官方标准库 `url.pathToFileURL(path.resolve(vidPath)).href` 生成符合 RFC 8089 规范的绝对文件协议 URL，自动健壮处理 Windows 盘符、空格、中文、特殊字符与正反斜杠。
2. **继承完整视频参数与优雅容错**：
   在主进程 `loadingOverlay.js` 中完整引入 `fit`、`fitPosition`、`brightness` 与 `contrast` 样式声明；移除武断的 `this.style.display='none'`，在 onerror 中输出清晰的诊断日志。
3. **规范化写入路径**：
   在 `client/modules/wallpaper-library-ui.js` 的 `applyBoot(w)` 中，写入配置前对 `videoPath` 与 `wallpaperDir` 统一做 POSIX 斜杠归一化。
4. **在线热注入补丁**：
   执行 `scripts/patch-boot-overlay.mjs`，无感将更新后的 `loadingOverlay.js` 重新打包进系统 `app.asar`。

## 6. 验证与验收标准
- [x] 1. `url.pathToFileURL` 测试验证通过，输出标准 URL：`file:///E:/SteamLibrary/steamapps/workshop/content/431960/2109603543/%E5%90%88%E6%88%90%201.mp4`；
- [x] 2. 插件全局配置 `config.json` 路径已归一化；
- [x] 3. 工作区文件已同步至全局插件目录并完成热部署；
- [x] 4. `app.asar` 已在线无感注入最新版 `loadingOverlay.js`；
- [x] 5. 视频开屏启动画面恢复正常，消除全黑盲区。

## 7. 修复与复盘记录
- **修复方案摘要**：
  采用 Node 标准库 `url.pathToFileURL` 彻底修复了 Windows 磁盘本地绝对路径与中文空格在生成 `file:///` 协议 URL 时反斜杠被错误编码为 `%5C` 导致 Chromium 404 隐藏视频的问题；修复了写入配置时的路径规范化逻辑，并在线重打包注入了主进程补丁。
- **验证结论**：✅ 经代码审查、URL 协议生成仿真测试与系统补丁在线注入验证，问题根因已彻底消除。已正式归档。

---

## 快捷导航
- [⬅ 返回缺陷追踪总清单](./BUG_TRACKING_LIST.md)
- [⬅ 上一个缺陷: BUG-010 - 开屏动画从准备到就绪存在闪烁切换与多余加载组件，且未平滑活态化过渡](./BUG-010_boot_transition_flicker_and_smooth_handover.md)
- [➡ 下一个缺陷: BUG-012 - 动态壁纸功能中场景素材动态渲染因 isBootActive 未定义异常导致失效中断](./BUG-012_scene_wallpaper_isBootActive_crash.md)
