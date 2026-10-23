# 阶段01：SceneScript 脚本引擎激活与系统时钟时间流注入

> **所属子模块**：子模块四：场景脚本属性与时钟系统  
> **状态**：`待开发 (Pending)` · **优先级**：P0  
> **核心目标**：彻底解决场景壁纸中数字时钟、日期日历、昼夜循环等特性停留在空白或 `<Clock>` 占位字符的缺陷，安全激活 SceneScript 运行时并注入精准的本地时间流。

---

## 1. 现状剖析与问题根因

在当前的渲染管线中（[`client/modules/wallpaper.js`](file:///d:/Project/antigravity-skin/client/modules/wallpaper.js)）：
```javascript
// 当前底层调用配置
const engineOptions = {
  scripts: false, // ⚠️ 当前被硬编码关闭！
  ...
};
```
由于 `scripts: false`：
1. 场景内的 SceneScript 解释器完全处于停摆状态；
2. 绑定在图层上的每帧 `update(value)` 函数不会被调用；
3. 壁纸中的文字图层无法通过 JavaScript 获取系统现实时间（`new Date()`），只能展示创作者在场景包内预留的静态文本（如 `<Clock>`、`00:00`）。

---

## 2. 具体实施方案

### 2.1 引擎启动开关重构
在 `client/modules/wallpaper.js` 中：
1. 将场景初始化配置中的 `scripts` 参数由写死 `false` 调整为受控激活；
2. 仅在场景素材确实包含 `scene.pkg` 且运行在 WebGL2 动态模式下启用脚本引擎。

### 2.2 本地真实时间流与日进度注入
在 WebWallGL 运行上下文中：
1. **系统时间提供者（System Clock Provider）**：
   确保沙箱环境中的 `Date` 原型链完好，直接对齐本地宿主操作系统时间；
2. **昼夜进度变量注入**：
   维护归一化日进度：
   $$timeOfDay = \frac{hours \times 3600 + minutes \times 60 + seconds}{86400}$$
   为支持日夜光照变换、晨昏天空着色器的壁纸提供实时精准的天文时间基准；
3. **动画帧驱动（rAF Driven Loop）**：
   打通每帧 `update(value)` 计算管线，确保时钟文本秒级/毫秒级平滑刷新。

---

## 3. 安全沙箱边界设计
由于创意工坊场景壁纸属于外部第三方代码，脚本执行必须严格处于受限纯净环境中：
1. **禁用 Node.js / Electron 敏感对象**：切断 `require`、`process`、`child_process`、`fs`、`global`；
2. **禁用网络通信能力**：切断 `fetch`、`XMLHttpRequest`、`WebSocket`，杜绝任何外部网络渗漏；
3. **保留纯净数学与时间计算**：仅保留 `Math`、`Date`、`String`、`Array`、`JSON` 等标准纯计算与图层控制 API。

---

## 4. 验证与验收标准
- [ ] 1. 选用带有时钟的创意工坊场景壁纸，壁纸上的时钟文本真实反映当前系统时间（如 `01:15:30`）；
- [ ] 2. 秒针/秒数数字匀速跳动，无卡顿、无停滞；
- [ ] 3. 彻底消除 `<Clock>` 等初始静态占位符；
- [ ] 4. 连续运行 10 分钟，内存与 CPU 占用保持平稳，无内存泄漏与死循环。
