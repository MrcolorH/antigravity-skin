> **导航**：[⬅ 返回缺陷总清单 (BUG_TRACKING_LIST.md)](./BUG_TRACKING_LIST.md)

---

# BUG-002: 外观设置残留冗余横幅卡片，且热更新标题在深色主题下异常显示为黑色

- **缺陷编号**：`BUG-002`
- **涉及需求 / 模块**：【散】外观设置面板 & 深色主题样式适配 (`client/modules/appearance-menu.js`, `client/styles/glass-theme.css`)
- **严重级别**：P2（视觉干扰 & 无障碍对比度失效）
- **当前状态**：`已修复`
- **发现时间**：2026-10-23
- **修复完成时间**：2026-10-23
- **报告人**：用户

## 1. 问题现场与截图
用户在深色模式下打开客户端“外观”配置面板时发现两处缺陷：
1. **红框区域**：底部残留了名为“Wallpaper Engine 本地素材库 (零拷贝挂载)”的横幅卡片，与上方壁纸/动效模块已有的“浏览素材库”按键重复，属于冗余组件。
2. **绿框区域**：“⚡ 插件版本与在线热更新”标题文本呈现纯深色/黑色（`#111827`），在深色背景下与底色严重融为一体，几乎无法被肉眼辨认。

![BUG-002 现场截图](assets/BUG-002_settings_redundant_card_and_dark_text.png)

## 2. 缺陷现象描述
1. **红框组件冗余**：
   - 界面底部仍渲染有 `<div id="agy-wrap-integrated-banner">` 包含的“Wallpaper Engine 本地素材库 已挂载创意工坊本地资产，点击浏览全屏素材画廊 [浏览素材库 →]”卡片。
   - 上方的“全局动态视频壁纸”及“开机引导动画”已在配置项右侧直接集成了原生“浏览素材库”按钮，底部的独立大横幅已不再具备独立业务价值，造成用户操作视线分散和垂直空间浪费。
2. **绿框深色文字变黑（对比度归零）**：
   - 在深色主题下，“⚡ 插件版本与在线热更新”标题文字颜色变为深黑色，而旁边的小徽标 `v0.4.0`、副标题说明文案以及右侧“🔄 检查更新”按钮均正常显示为浅色/亮色。
   - 用户难以辨识该模块的主要标题与功能定位。

## 3. 期望表现（规范定义）
1. **彻底剔除红框冗余横幅**：
   - 从外观设置面板中完全移除该横幅卡片 DOM 节点及关联逻辑，保持设置面板信息层级精简聚焦。
2. **绿框文字双主题严格适配**：
   - 在深色主题下，“⚡ 插件版本与在线热更新”标题文字应显示为高对比度亮白色或浅灰色（如 `#f9fafb` 或 `text-foreground` 变量对应的亮色），确保文本清晰易读；
   - 在浅色主题下，正常显示为深灰色/黑色，双主题无缝切换自适应。

## 4. 根本原因深度分析（代码级诊断）
1. **红框冗余横幅根因**：
   - **代码位置**：`client/modules/appearance-menu.js` (第 786~803 行)
   - 此卡片是历史版本中探索“将素材库悬浮入口移入框内”时的过渡实现。在后续将“浏览素材库”和“显示与渲染设置”直接集成到开关行的标准输入控件流后，未将该遗留横幅代码移除。
2. **绿框深色模式下文字显示为黑色的根本原因**：
   - **代码位置**：`client/styles/glass-theme.css` (第 2359~2368 行)
   - 在设置弹窗样式中，浅色模式定义了强制文字颜色规则：
     ```css
     .animate-modalScaleIn h2,
     div[class*="animate-modalScaleIn"] h2,
     .animate-modalScaleIn [class*="font-medium"][class*="text-foreground"] {
       color: #111827 !important; /* 强制覆盖为深黑灰色 */
       font-weight: 600 !important;
     }
     ```
   - 而当系统切换到深色模式（`.theme-dark` / `.dark`）时，深色样式覆盖只针对了 `h2` 元素：
     ```css
     .theme-dark .animate-modalScaleIn h2,
     .theme-dark div[class*="animate-modalScaleIn"] h2 {
       color: #f9fafb !important;
     }
     ```
   - **深色模式遗漏了对 `[class*="font-medium"][class*="text-foreground"]` 的颜色重置！**
   - 热更新模块标题恰好使用了：
     ```html
     <span class="text-xs font-medium text-foreground flex items-center gap-1">
       <span>⚡ 插件版本与在线热更新</span>
     </span>
     ```
   - 包含 `font-medium` 与 `text-foreground` 两个类，因此在深色模式下被浅色规则里的 `color: #111827 !important;` 强制穿透覆盖，而深色规则未作反向覆盖，导致文本直接呈现深黑色！

## 5. 建议修复方案（技术执行路径）
1. **剔除红框横幅代码**：
   - 在 `client/modules/appearance-menu.js` 中删除 `#agy-wrap-integrated-banner` 及其所有内部 HTML；
   - 同步清理 `appearance-menu.js` 中相关的引用与绑定，如：
     - 去除 `customOptions.querySelector('#agy-integrated-library-banner')` 完整性校验；
     - 删除 `agy-btn-banner-open-lib` 的点击事件绑定；
     - 删除 `updateIntegratedBanner()` 或相关状态同步代码。
2. **补全深色主题样式规则**：
   - 在 `client/styles/glass-theme.css` 的深色主题模式适配块中，追加覆盖：
     ```css
     .theme-dark .animate-modalScaleIn [class*="font-medium"][class*="text-foreground"],
     .dark .animate-modalScaleIn [class*="font-medium"][class*="text-foreground"] {
       color: #f9fafb !important;
     }
     ```
   - 或者将强行硬编码的 `#111827 !important` 降级，改为依赖上下文变量 `var(--foreground)`，避免使用带 `!important` 的硬编码色值。

## 6. 验证与验收标准
- [x] 打开外观设置面板，确认“开机动效引擎修复”与“插件版本与在线热更新”之间无任何多余素材库横幅卡片。
- [x] 切换至深色（Dark）模式，检查“⚡ 插件版本与在线热更新”标题颜色为纯白/浅灰亮色，对比度清晰正常。
- [x] 切换至浅色（Light）模式，该标题正常呈现为深灰/黑色，双主题切换无异常。
- [x] 点击热更新检查、壁纸与开机动画各功能，控制台无残留 DOM 相关的报错。

## 7. 修复与复盘记录
- **修复方案摘要**：
  1. 彻底剔除冗余横幅：在 `client/modules/appearance-menu.js` 中完整移除了 `#agy-wrap-integrated-banner` 节点，并清理了 DOM 完整性检查条件、横幅点击跳转事件与素材数量同步函数，消除无用代码与残留 UI。
  2. 补齐深色主题高对比度样式：在 `client/styles/glass-theme.css` 中为 `.theme-dark` 与 `.dark` 主题补齐了 `.animate-modalScaleIn [class*="font-medium"][class*="text-foreground"] { color: #f9fafb !important; }` 样式重置；同时在 HTML 标题 span 上追加 `dark:text-gray-100`，彻底解决深色模式下文字显示为纯深黑色的对比度失效问题。
- **验证结论**：✅ 经用户实机测试确认通过，冗余横幅已剔除，深色文字对比度完全正常。已正式归档。

---

## 快捷导航
- [⬅ 返回缺陷追踪总清单](./BUG_TRACKING_LIST.md)
- [⬅ 上一个缺陷: BUG-001 - Wallpaper 素材库弹窗无法一页全览，底部确认按钮溢出被遮挡](./BUG-001_wallpaper_modal_overflow.md)
- [➡ 下一个缺陷: BUG-003 - 从开屏动画到首页完整加载动态背景出现黑闪与跳动](./BUG-003_boot_to_home_black_flash_and_jump.md)
