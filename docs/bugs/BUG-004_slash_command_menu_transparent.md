> **导航**：[⬅ 返回缺陷总清单 (BUG_TRACKING_LIST.md)](./BUG_TRACKING_LIST.md)

---

# BUG-004: 输入框快捷指令斜杠菜单完全透明，导致文字与背景严重混杂无法辨识

- **缺陷编号**：`BUG-004`
- **涉及需求 / 模块**：【散】快捷指令菜单 / 毛玻璃与高对比度适配 (`client/styles/glass-theme.css`)
- **严重级别**：P2（视觉干扰 & 无障碍对比度失效）
- **当前状态**：`已修复`
- **发现时间**：2026-10-23
- **修复完成时间**：2026-10-23
- **报告人**：用户 / 测试

## 1. 问题现场与截图
在聊天输入框中输入 `/` 触发快捷指令/斜杠命令（Slash Commands）自动完成建议菜单时，弹出的快捷指令菜单没有有效的背景底色与毛玻璃磨砂遮罩，处于近乎完全透明状态。菜单中的指令名称（如 `goal`、`compact`、`schedule`、`browser`、`plan`、`grill-me` 等）与功能描述文字直接叠加在底层高对比度壁纸的线条和亮斑之上，导致文字严重失真、几乎无法阅读与选择。

![BUG-004 现场截图](assets/BUG-004_slash_command_menu_transparent.png)

## 2. 缺陷现象描述
1. **背景近乎全透**：触发 `/` 快捷指令弹出的悬浮菜单缺乏磨砂毛玻璃（Backdrop Filter）或适度的半透明底板遮挡；
2. **文本可读性极差**：在复杂、高饱和度或亮暗反差明显的壁纸背景下，命令名称和灰色辅助描述文本与壁纸图案交叠混杂，视觉辨识度极差；
3. **高亮与交互反馈薄弱**：菜单项在悬停（Hover）或键盘光标切换选中状态时，缺乏明显的选中高亮背景与对比度增强反馈。

## 3. 期望表现
1. **统一的高级磨砂毛玻璃卡片质感**：
   - 快捷指令菜单容器应具备高质感的毛玻璃磨砂效果（如 `backdrop-filter: blur(28px) saturate(180%)`）；
   - 深色主题下具备半透明深色保护底板（如 `rgba(18, 22, 34, 0.78)`），浅色模式下具备温润半透明浅色底板（如 `rgba(255, 255, 255, 0.78)`），确保无论底层壁纸为何种花色，均能清晰隔绝背景干扰；
   - 拥有细腻的微光边框与景深投影（`box-shadow`）。
2. **文字高对比度保证**：
   - 指令名称（Command Keyword）清晰加粗高亮；
   - 描述文本（Description）采用清晰的高对比度字体色彩（深色模式下为 `#cbd5e1`，浅色模式下为 `#475569`），必要时搭配文字微投影；
3. **明确的选中项高亮态**：
   - 鼠标悬停或键盘聚焦高亮的条目拥有清晰的背景光晕胶囊底色（`bg-secondary` 或主题 accent 强调色）。

## 4. 根本原因深度分析（代码级诊断）
1. **宿主 DOM 结构特征与选择器未覆盖（核心主因）**：
   - Antigravity 宿主前端基于 Lexical 编辑器的 Typeahead 架构渲染快捷命令（Slash Commands）与 Mention 菜单；
   - 浮层容器渲染为 `#typeahead-menu[role="listbox"][aria-label="Typeahead menu"]`，其内部实际承载菜单的子节点为 `div.typeahead-popover.mentions-menu`，列表项为 `ul > li.item`（选中态为 `li.item.selected`）；
   - 在当前主题文件 `client/styles/glass-theme.css`（第 2697 行）中，仅对常规 Radix 下拉菜单配置了毛玻璃样式规则：
     ```css
     [role="menu"], [data-radix-menu-content], [data-radix-popper-content-wrapper] > div, ...
     ```
   - 现有的菜单选择器只命中了 `[role="menu"]`，而快捷指令菜单的角色为 `[role="listbox"]`，容器 ID 为 `#typeahead-menu`，类名为 `.typeahead-popover.mentions-menu`，因此**完全避开了现有的菜单毛玻璃样式规则**，退化为无背景透明状态。
2. **输入框内层通配性透明规则潜在波及**：
   - 在 `glass-theme.css` 的第 1989~1996 行中，为了去除输入框内部死白，配置了：
     ```css
     div[class*="rounded-2xl"]:has(textarea) div:not(button):not(button *) { background: transparent !important; }
     ```
   - 一旦该浮层挂载在输入框容器内部或相邻层级，极易被全局透明规则暴力重置为 `transparent`，导致底色彻底丢失。

## 5. 建议修复方案（技术执行路径）
1. **在 `client/styles/glass-theme.css` 中为 `#typeahead-menu` 与 `.typeahead-popover` 建立专属毛玻璃规范**：
   ```css
   /* 快捷指令与输入建议弹窗 (#typeahead-menu / .typeahead-popover / .mentions-menu) 毛玻璃高对比度适配 */
   #typeahead-menu,
   .typeahead-popover,
   .mentions-menu {
     background: rgba(255, 255, 255, 0.78) !important;
     background-color: rgba(255, 255, 255, 0.78) !important;
     backdrop-filter: blur(32px) saturate(190%) !important;
     -webkit-backdrop-filter: blur(32px) saturate(190%) !important;
     border: 1px solid rgba(255, 255, 255, 0.6) !important;
     border-radius: 12px !important;
     box-shadow: 0 16px 40px rgba(0, 0, 0, 0.15) !important;
     overflow: hidden !important;
   }

   .theme-dark #typeahead-menu,
   .dark #typeahead-menu,
   .theme-dark .typeahead-popover,
   .dark .typeahead-popover,
   .theme-dark .mentions-menu,
   .dark .mentions-menu {
     background: rgba(18, 22, 34, 0.78) !important;
     background-color: rgba(18, 22, 34, 0.78) !important;
     border: 1px solid rgba(255, 255, 255, 0.14) !important;
     box-shadow: 0 16px 45px rgba(0, 0, 0, 0.55) !important;
   }
   ```
2. **适配列表项及选中态**：
   - 对 `li.item` 及 `li.item.selected` / `[role="option"][aria-selected="true"]` 配置鲜明的悬停高亮底色；
   - 强化标题与描述文本色彩，深色模式下使用 `#f8fafc` 与 `#cbd5e1`，并赋予微弱文字阴影防眩光。

## 6. 验证与验收标准
- [x] 在输入框输入 `/` 时，弹出的快捷指令菜单具备高雾度磨砂毛玻璃背景，底层壁纸内容完全被柔化遮挡；
- [x] 指令关键字与右侧详细描述文字黑白分明、清晰可辨，对比度满足无障碍阅读要求；
- [x] 键盘上下方向键切换及鼠标悬停时，当前选中项具有高可见度的高亮胶囊背景；
- [x] 在深色主题与浅色主题之间切换，弹窗配色自然匹配。

## 7. 修复与复盘记录
- **修复方案摘要**：
  1. 专属磨砂与半透明保护层：在 `client/styles/glass-theme.css` 中为 `#typeahead-menu`, `div.typeahead-popover`, `.mentions-menu`, `[role="listbox"][aria-label*="Typeahead"]` 建立了专属毛玻璃规范，赋予 `backdrop-filter: blur(36px) saturate(200%)`、高透半透明底色（浅色模式 `rgba(255, 255, 255, 0.82)`，深色模式 `rgba(18, 22, 34, 0.84)`）与立体微光边框投影。
  2. 防穿透冲刷保护：对输入框内部的全局透明通配选择器追加排除规则，杜绝快捷指令弹窗内部 DOM 被冲刷成 `transparent`。
  3. 选区与对比度增强：优化列表项悬停与键盘选中态胶囊高亮（深色模式下为半透明高亮底色与微投影），强化指令关键字高亮与描述文本色彩（深色模式统一映射为 `#cbd5e1` / `#ffffff`，搭配微文字阴影），彻底隔绝底层壁纸图案干扰。
- **验证结论**：✅ 经用户实机测试确认快捷指令菜单已修复，高雾度毛玻璃与文本对比度均正常。已正式归档。

---

## 快捷导航
- [⬅ 返回缺陷追踪总清单](./BUG_TRACKING_LIST.md)
- [⬅ 上一个缺陷: BUG-003 - 从开屏动画到首页完整加载动态背景出现黑闪与跳动](./BUG-003_boot_to_home_black_flash_and_jump.md)
- [➡ 下一个缺陷: BUG-005 - Wallpaper素材库场景壁纸在开屏动画与动态背景中动效缺失或缩放异常](./BUG-005_scene_wallpaper_boot_missing_animation.md)
