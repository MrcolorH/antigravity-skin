# 🌟 Antigravity Theme & Skin v0.2.2 发布说明

本版本为 **反重力最新版输入栏实时语音按钮适配与全局图标隔离优化专项版**，深度适配了反重力最新引入的 Gemini Live 实时语音交互胶囊，彻底修复了未适配时按钮呈现为突兀“纯黑实心色块”的问题，并强化了全局图标选择器边界隔离与中文本地化。

---

### 🐛 缺陷修复与核心改进

#### 1. Gemini Live 实时语音按钮毛玻璃晶莹化深度适配
- **问题根因**：
  官方最新版在输入框右下角引入了 Gemini 实时语音模式胶囊（`[data-testid="voice-live-pill"]`，内含声波柱与星芒图标），其默认带有 `bg-foreground text-background`（在浅色主题下底色为纯黑 `#0a0a0c`）。同时，由于全局第 14 节搜索框的选择器 `div.relative.flex.items-center svg` 规则过宽，意外命中了底栏语音胶囊容器，将内部 SVG 图标强制覆盖为纯黑（`color: #000000 !important`）。
  黑底叠加黑图标，导致用户看到的按钮退化为一个毫无图标细节的纯黑实心圆块。
- **优化方案**：
  - **浅色主题（默认及亮色壁纸）**：重塑为高透光晶莹白透毛玻璃水晶胶囊（`rgba(255, 255, 255, 0.90)` 细腻双层渐变 + 科技蓝微边框与立体内发光），声波与星芒图标呈现饱满的 Gemini 湛蓝色（`#2563eb`），与高透输入框浑然一体；
  - **深色主题（Dark Mode）**：适配为黑曜石磨砂通透质感，搭配柔光幽蓝呼吸边缘（`#60a5fa`）与深邃微阴影；
  - **交互触感与微动效**：增加微悬浮动效（`scale(1.05)`）与光晕扩散阴影，按压时呈现柔和微缩触感反馈；
  - **通话中活跃态（Live 连通中）**：优化连通后的红底通话胶囊（`bg-red-600`）为流光动感红渐变，纯白清晰图标与结束按钮。

#### 2. 全局搜索框选择器边界精准收敛
- **根因修复**：
  将 `glass-theme.css` 第 14 节中宽泛的 `div.relative.flex.items-center svg` 与 `.theme-dark div.relative.flex.items-center svg` 严格收敛限定为 `div.relative.flex.items-center:has(> input) svg`。
  彻底杜绝了搜索框样式对后续任何带有 `relative flex items-center` 布局属性的按钮组、工具栏与弹层图标的颜色误伤。

#### 3. 语音备忘录音麦克风按钮微调
- 协同优化与语音胶囊并列的语音备忘录音按钮（`input-send-button-record-tooltip`），赋予统一的微悬浮动效与深浅色图标对比度。

#### 4. 本地化汉化引擎词条补全
- 在 [`client/modules/i18n-engine.js`](file:///Users/colorh/Project/AICODING/antigravity-skin/client/modules/i18n-engine.js) 中补齐了实时语音相关的中文字典：
  - `Start Voice mode` -> `开启实时语音模式`
  - `End Voice mode` -> `结束实时语音模式`
  - `Start Live Chat` -> `开启实时对话`
  - `End Live chat` -> `结束实时对话`
  - `Finalizing transcription...` -> `正在完成语音识别...`
  - `Finalizing...` -> `正在整理...`

---

### 🚀 客户端内一键在线热更新
- 已安装旧版插件的用户，打开 Antigravity「外观设置」菜单，点击 **「⚡ 检查更新」**，即可立即检测到 `v0.2.2` 并一键点击 **「🚀 立即热更新」** 无感升级生效！
