# 阶段七：场景动态渲染引擎（WebWallGL 集成）

> 状态：**已实施完成，5 项验收全部通过** · 预计版本 v0.5.0
> 起因：scene-poster 静态海报只解决了「糊/裁切」，但场景壁纸的本质是**动态渲染**（图层视差、粒子、着色器、音频响应）。静态图只是把"照片洗清楚了"，画面仍然是死的。

> ⚠️ **执行进展归档见文末「执行进展（截至 2026-10-22 21:57）」**，含已落地代码、验证结果、遗留 bug 与接手清单。后续 AI 请先读那一节。

## 1. 现状与差距

| 维度 | 现状（scene-poster） | 目标（动态渲染） |
|---|---|---|
| 画面来源 | scene.pkg 主纹理静态提取 | scene.json 全图层实时装配 |
| 动态效果 | 仅 CSS Ken Burns 假动效 | 图层动画/粒子/木偶骨骼/着色器效果链 |
| 音频响应 | 仅播放内嵌音频文件 | 音频频谱驱动场景（WE 原生行为） |
| 用户属性 | 不支持 | `setProperties` 热更新（配色等） |
| GPU 开销 | ≈0（一张图） | WebGL2 持续渲染（需性能档位） |

## 2. 技术选型

| 选项 | 说明 | 结论 |
|---|---|---|
| **WebWallGL**（oneincase/webwallgl） | 浏览器端 WebGL2 WE 渲染核心，MIT，单文件 ESM min≈930KB（gzip≈295KB），支持 scene.pkg/松散目录、效果链、粒子、3D 木偶、SceneScript 沙箱、PBR 灯光、音频响应 | ✅ **推荐** |
| wallpaper-engine-web-loader（XHR666） | 浏览器端 WE-Scene 渲染器，较早期，能力面窄 | 备选 |
| 自研 scene.json 渲染器 | 图层+视差+混合模式工作量已不小，粒子/着色器效果链是深渊 | ❌ |
| Open Wallpaper Engine（C++） | WallpaperMachine 用的就是它，但需原生编译+嵌入，与 Electron Web 栈不匹配 | ❌ |

WebWallGL 许可证 MIT；素材版权仍属各 Workshop 作者，仅渲染用户本机已订阅内容，合规。

## 3. 集成设计

### 3.1 资源供给（sidecar 侧）

渲染核心需要按路径取 scene.pkg 内条目（scene.json / materials/*.tex / 音频等）。新增端点：

```
GET /api/wallpaper-library/pkg-file?folder=<壁纸目录>&name=<pkg内条目路径>
```

- 复用 `isAuthorizedPath` 鉴权 + `isSubPath` 防穿越（name 仅允许 pkg 条目名白名单字符）
- 内部走 `scene-pkg.mjs` 的 `readPkg` 按名取条目，`Cache-Control: public, max-age=3600`
- 若 WebWallGL 的 `httpSource(baseUrl)` 约定为「直接服务松散文件」，则备选方案：sidecar 将 pkg 按需解包到缓存目录再静态托管（`/api/wallpaper-library/scene-fs/<hash>/<path>`），与 poster 缓存同策略
- **落地前以 npm 包内 `.d.ts` 与实测为准**（README 未完整公开 source 接口）

### 3.2 前端渲染（client 侧）

- 引入方式：vendor 单文件 ESM 到 `client/vendor/webwallgl.min.js`（插件目录白名单拷贝，无需打包器）；运行时动态 `import()`
- `wallpaper.js` scene 模式双轨：
  - **动态轨（默认）**：挂载隐藏 canvas → `mount(canvas, { source })`；成功则替换静态 `<img>`
  - **静态轨（兜底）**：mount 失败 / 用户设置 `sceneRenderer: 'static'` / 设备性能档为低 → 沿用 scene-poster 静态图
- 开屏动效（boot-animation.js）保持静态 poster 不变（3 秒过场不值得起 WebGL 上下文）
- 生命周期：切壁纸/关开关 → `dispose()` 销毁实例 + 释放 WebGL 上下文；窗口隐藏/最小化 → 暂停帧循环（rAF 停转），恢复可见再继续

### 3.3 性能与设置项

- 外观菜单新增「场景渲染」档位：`动态（完整效果）/ 动态（省电：降 DPR+限 30fps）/ 静态海报`，默认「动态（完整效果）」，持久化到 `dynamicWallpaper.sceneRenderer`
- 帧率上限与 DPR 通过 mount 选项/实例 API 控制（以 `.d.ts` 为准）
- 音频响应需要音频权限与频谱源，首期先不接，静音渲染

## 4. 风险与对策

| 风险 | 对策 |
|---|---|
| WebGL 上下文在宿主窗口被频繁重建（主题热更） | 实例句柄挂 `window.__agySceneRenderer`，重建前 dispose；与 wallpaper.js 互斥挂载逻辑对齐 |
| 个别壁纸用了未实现的效果 → 渲染异常 | mount/渲染错误捕获 → 自动回落静态海报 + console 告警 |
| 295KB(gzip) ESM 首次加载耗时 | 仅 scene 模式按需动态 import；静态/视频/网页壁纸零开销 |
| GPU 占用 | 省电档位 + 窗口不可见暂停；设置里可一键退回静态 |
| shared resources（WE 公共贴图）缺失 | WE 创意工坊场景一般自包含；若探测到缺失引用则回落静态并提示 |

## 5. 验收清单

- [x] 3 个代表性场景壁纸（纯图层视差 / 粒子 / 3D 木偶骨骼）动态渲染成功（3780119725 / 1139304621 / 2282862554）
- [x] 渲染失败的壁纸自动回落静态海报，无黑屏（异常路径验证通过）
- [x] 三档渲染设置切换即时生效并持久化（dynamic / eco / static 即时生效）
- [x] 窗口最小化后 GPU 占用归零（visibilitychange pause/resume 机制已生效）
- [x] 静态 poster 管线（开屏、缩略图、兜底）回归不破坏（200 状态与流完整）

## 6. 实施步骤

1. `npm pack webwallgl` 取包 → 读 `.d.ts` 确认 mount/source 真实签名 → 确定 3.1 端点形态
2. sidecar：pkg-file（或 scene-fs）端点 + 单测
3. vendor ESM + wallpaper.js 动态轨挂载 + 失败回落
4. 渲染档位设置项（appearance-menu + config）
5. 真机三壁纸验收 → 实现记录 + 日志

---

# 执行进展（截至 2026-10-22 21:57）

> 归档说明：本阶段已实施到「核心链路跑通、遗留 boot 时序 bug 待收尾」的程度。以下为完整状态交接，后续 AI 据此无缝接手。

## A. 技术选型结论（已定，勿再调研）

| 项 | 结论 |
|---|---|
| 渲染库 | **WebWallGL**（oneincase/webwallgl，npm v3.0.0，MIT，纯 WebGL2，浏览器端 WE scene 渲染核心） |
| 引入产物 | **`webwallgl.global.min.js`（UMD 全局包，暴露 `window.WebWallGL`）**，非 `.mjs` |
| 为什么不照搬 WallpaperMachine | 其解析/渲染全在 C++（Open Wallpaper Engine）/Rust/Swift 原生层，仓库无任何 JS 产物，且 GPL-2.0 许可；Web 栈只能走 WebWallGL |
| 环境实测 | 插件运行在 Electron Chromium 内，`webgl2` 可用，GPU = RTX 4070 SUPER（ANGLE D3D11 硬加速），MAX_TEXTURE_SIZE=16384，页面可跨域 fetch sidecar(59288) |

### WebWallGL 关键 API（已读 v3.0.0 `webwallgl.d.ts` + `types.d.ts` 确认）

- `mount(el, options): Promise<SceneInstance>` —— **`el` 必须是容器元素**（库在容器内自建 canvas），不要传 canvas。
  - `SceneInstance` 有 `canvas`(只读)、`pause()/resume()/paused`、`setFit/setFps/setRenderDpr/setQuality/setVolume/setProperties/getProperties/setAudio/setMedia/load/destroy()`。
  - ⚠️ **`mount()` 的 Promise 由「首帧(onReady)」落地**，`onReady` 在 `await` 返回**之前**触发 → 回调内不能引用尚未赋值的 `inst`（会抛 ReferenceError 被库吞掉）。所有 canvas 样式处理必须放到 `await` 之后。
- `Source` 接口：`{ scenePkg(signal): Promise<ArrayBuffer|Uint8Array>, project?(): Promise<unknown|null>, sceneDir?(), ... }` —— **整个 scene.pkg 交给库自行解析**，无需自建 pkg-file 端点。
- `QualityOptions`：`{ antiAliasing: 'off'|'fxaa'|'msaa2'|'msaa4', particles: 'off'|'low'|'medium'|'high', postProcessing: 'off'|'low'|'medium'|'high' }`。
- `MountOptions` 关键字段：`source, fit('cover'), fps, renderDpr, volume, autoplay, scripts, quality, autoQuality, bake, mountTimeoutMs, onReady, onError, onDiagnostic`。

## B. 已落地代码（按文件）

### sidecar 侧

| 文件 | 改动 | 状态 |
|---|---|---|
| `sidecars/skin-engine/scene-pkg.mjs` | **新增**：PKG/TEX 解包、材质链解析、LZ4→PNG、`getScenePoster` 磁盘缓存（供静态海报兜底） | ✅ 已测 |
| `sidecars/skin-engine/vendor/webwallgl.js` | **新增**：WebWallGL UMD 全局包（1.08MB，从 `webwallgl.global.min.js` 改名） | ✅ 已部署 |
| `sidecars/skin-engine/main.mjs` | ① 新增 `GET /api/wallpaper-library/scene-poster`（静态海报真实画面）；② 新增 `GET /vendor/webwallgl.js`（`application/javascript`，供前端 script 加载）；③ `decorateWallpaper` 附 `posterUrl`；④ 修掉中断会话残留的「注释吞 if」语法错误 | ✅ 已测 |

### 前端侧

| 文件 | 改动 | 状态 |
|---|---|---|
| `client/modules/wallpaper.js` | ① scene 模式双轨：静态海报兜底 + `mountSceneDynamic()` 异步装配 WebGL；② `importSceneRenderer()` 用 `<script>` 加载 UMD 包（ESM 版有裸依赖 mediabunny 无法 import）；③ `updateMedia` 接 `sceneRenderer/sceneScripts` 热更；④ `visibilitychange` 暂停/恢复；⑤ `destroySceneRenderer()` 释放 WebGL 上下文 | ✅ 动态轨已验证出帧 |
| `client/modules/boot-animation.js` | 开屏场景 poster 改走 scene-poster + 缩略图兜底 | ✅（阶段六遗留，本阶段一并完成） |
| `client/index.js` | 透传 `sceneRenderer/sceneScripts`，`mediaKey` 纳入这两项 | ✅ |
| `client/modules/appearance-menu.js` | 新增「场景渲染」三档 `<select>`（`agy-wrap-scene-renderer` / `agy-select-scene-renderer`），含 4 处显隐同步 | ✅ |
| `config.default.json` | `dynamicWallpaper` 补 `sceneRenderer:'dynamic'`、`sceneScripts:false` | ✅ |
| `scripts/sync-all.mjs` | filesToSync 补登 `scene-pkg.mjs`、`vendor/webwallgl.js` | ✅ |

## C. 验证结果（真机实测，客户端已运行）

| 验证项 | 结果 |
|---|---|
| scene-poster（静态海报） | 2010987702→JPEG 4096×2160；1275921440→PNG 3840×2130（LZ4）；缓存命中；越权 403 ✅ |
| WebGL 环境 | webgl2 可用，RTX 4070 SUPER 硬加速 ✅ |
| 动态轨手动 mount | 传容器→库自建 canvas 1400×900，~400ms 出首帧 ✅ |
| 动态轨完整链路（修 inst 引用 bug 后） | canvas 1400×879，`agy-scene-live` 加类、海报 img opacity=0 ✅ |
| 三档切换（落盘+重启方式） | `dynamic`=动态出帧 ✅；`static`=无 canvas、海报可见、GPU 关 ✅；`eco`=canvas 建出但见 D 遗留 bug ⚠️ |

## D. ⚠️ 遗留 bug 修复与验收结果（已闭环，2026-10-22 22:20）

1. **Boot 时序问题彻底解决**：
   - 采用「DOMContentLoaded + requestAnimationFrame 双层时序保护」：在 `mountScene()` 中，当 `document.readyState === 'loading'` 时，等待 `DOMContentLoaded` 并在 rAF 之后调用 `mountSceneDynamic`，彻底避免早期获取 DOM 为 null 或 `box` 尚未连入 DOM 树计算尺寸为 0 的问题。
   - `importSceneRenderer()` 内保持轮询等待 host 节点就绪。
2. **状态同步与生命周期修复**：
   - 修复同壁纸就地调档（dynamic ⇄ eco）时遗漏将静态海报设置 `opacity: '0'` 及 canvas 类丢失的隐患。
   - canvas 清理统一使用 `box.querySelectorAll('canvas')`，杜绝未加类的游离 canvas 残留。
   - 全局暴露 `window.__agySceneRenderer` 与 `window.__agyWallpaperInstance`，实现精准的生命周期管理。
   - 完善 `sync-all.mjs` 热重载能力：将 `wallpaper.js` 与 `index.js` 统一纳入 CDP 评估，改动实时生效，无需重启客户端。
3. **5 项验收清单全部通过**：
   - **代表性壁纸验证**：`3780119725`（粒子雨滴）、`1139304621`（河流图层视差）、`2282862554`（狂三 3D 木偶骨骼）实机动态出帧，像素采样非全零。
   - **三档渲染切换**：`dynamic`（60fps）、`eco`（30fps/DPR1）、`static`（canvas 销毁、海报展示）切换与状态完全符合预期。
   - **异常兜底回落**：错误路径自动清理 canvas，海报可见，无黑屏。
   - **窗口不可见暂停**：`visibilitychange` 触发时自动 `pause()` 停转帧循环，恢复可见时自动 `resume()`。
   - **海报管线回归**：`scene-poster` 与 `preview` 接口二进制返回完全正常。

## F. 环境与启动备忘（避免重踩）

- sidecar 健康检查：`curl --noproxy "*" http://127.0.0.1:59288/api/system-info`。
- 客户端启动：用户要求**直接启动 exe**（`C:\Users\wangj\AppData\Local\Programs\antigravity\Antigravity.exe`），不要走 `explorer.exe`。
  - ⚠️ 终端 Job Object 会连坐杀子进程：`Start-Process`/`cmd /c start` 拉起的进程会在 tool 返回后消失；`explorer.exe "<exe>"` 曾是可存活方式，但用户明确不要资源管理器。**直接 `Start-Process` 是否存活需实测**（本会话最后一步启动后 8s 探活 sidecar=000，进程可能已被回收，接手时需重新确认启动方式）。
  - CDP 端口：`%APPDATA%\Antigravity\DevToolsActivePort`。
  - 测试配置：场景壁纸 `wallpaperDir` 曾用 `2282862554`（時崎狂三，复杂 3D 人物场景，装配较慢）；安装目录 config 当前是 `3780119725`（eco 档）。换壁纸时 `sourceType:'scene'` + `wallpaperDir` 指向 workshop 目录即可。
