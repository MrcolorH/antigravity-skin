> **导航**：[⬅ 返回缺陷总清单 (BUG_TRACKING_LIST.md)](./BUG_TRACKING_LIST.md)

---

# BUG-001: Wallpaper 素材库弹窗无法一页全览，底部确认按钮溢出被遮挡

- **缺陷编号**：`BUG-001`
- **涉及需求 / 模块**：Wallpaper素材库集成 (`client/modules/wallpaper-library-ui.js`, `client/modules/wallpaper.js`)
- **严重级别**：P2（体验阻断与布局缺陷）
- **当前状态**：`已修复`
- **发现时间**：2026-10-23
- **修复完成时间**：2026-10-23
- **报告人**：用户 / 测试

## 1. 问题现场与截图
在打开“Wallpaper 素材库 (ZERO-COPY)”弹窗时，弹窗外部容器整体超出了视口可见高度，弹窗底部的操作栏（提示文字及“完成”确认按钮）被截断下移，第三排壁纸缩略图亦被截断一半。用户必须主动下拉外层滚动条才能点击“完成”按钮关闭弹窗。

![BUG-001 现场截图](assets/BUG-001_wallpaper_modal_overflow.png)

## 2. 缺陷现象描述
1. **外框无法一页完整展示**：弹窗外框未能在视口高度限制内完全容纳其子元素，出现弹窗整体的纵向滚动条。
2. **确认按钮被挤压到底部视区外**：右下角“完成”按钮（及左侧操作提示）未能吸底固定展示，露出一半甚至完全沉入视窗外。
3. **分页器与内容混排滚动**：分页控件（Pagination）被直接塞在素材列表容器底部，当壁纸卡片较多时，分页按钮随壁纸一同滚动，无法固定在操作视区内。

## 3. 期望表现（规范定义）
1. **弹窗外框必须 100% 在当前视窗内完整展示**：整个弹窗主体（Header、筛选路径栏、内容区、分页区、Footer）一屏全览，**严禁外层容器或整个弹窗出现滚动条**。
2. **仅素材浏览区支持内部垂直滚动**：
   - 顶部：标题、路径选择行、分类/分级筛选工具栏全部固定在弹窗顶部；
   - 中间：仅卡片缩略图网格容器（`#agy-lib-scroll` / `#agy-lib-grid`）允许产生独立的纵向滚动条（`overflow-y: auto`）；
   - 底部：分页栏（Pagination）与底部操作栏（完成按钮及提示信息）必须固定在弹窗底部，任何时刻均无需下拉滚动条即可直接点击。

## 4. 根本原因分析（代码级诊断）
- **文件位置**：`client/modules/wallpaper-library-ui.js`
- **布局机制缺陷**：
  1. 弹窗打开函数 `openModal` 中定义了固定高度 `'84vh'`，但在渲染主体内容 `renderShell()` 和追加 `footer` 时，未将弹窗容器（`.agy-modal-body` / `.agy-lib-in-modal`）配置为标准的 Flex 垂直自适应容器（`display: flex; flex-direction: column; height: 100%; min-height: 0;`）。
  2. 列表中采用了静态的高度计算 `.agy-lib-in-modal .agy-lib-scroll { max-height: calc(84vh - 240px); }`，当不同屏幕分辨率、缩放比例或头部筛选项换行时，头部实际高度超出 240px 预估值，导致总高度超过 `84vh`，整体产生外层溢出。
  3. `footer` 是以 `document.createElement('div')` 附加在末尾，外层没有 `overflow: hidden` 与 `flex: 1` 约束，直接被推到容器下方。
  4. 分页器 `#agy-lib-pagination` 被置于 `#agy-lib-scroll` 滚动容器内部，导致其与卡片混杂，无法常驻视窗。

## 5. 建议修复方案（技术执行路径）
1. **重构弹窗主体为 Flex 约束模型**：
   ```css
   .agy-lib-in-modal {
     display: flex !important;
     flex-direction: column !important;
     height: 100% !important;
     max-height: 100% !important;
     min-height: 0 !important;
     overflow: hidden !important;
   }
   ```
2. **划分三大固定与自适应区域**：
   - **固定顶部（Header & Toolbar）**：设置 `flex-shrink: 0;`，包含路径选择、类型过滤、分级标签与搜索框。
   - **自适应滚动区（Grid View）**：将 `#agy-lib-scroll` 设置为 `flex: 1 1 auto; min-height: 0; overflow-y: auto;`，取消脆弱的 `calc(84vh - 240px)` 硬编码。
   - **固定底部（Pagination & Footer）**：设置 `flex-shrink: 0;`，将 `#agy-lib-pagination` 移出滚动层放置于 Footer 上方或直接与 Footer 整合，保证分页控制与“完成”按钮永远置顶可见。

## 6. 验证与验收标准
- [x] 弹窗在 1080P、2K 以及不同系统 DPI 缩放（100%、125%、150%）下打开，弹窗外边框完整呈现，弹窗外层不出现纵向滚动条。
- [x] 底部“完成”按钮与左侧提示文字完整可见，无需下拉即可直接点击。
- [x] 素材网格区域正常滚动，滚动时不带动分页栏和底部按钮移动。
- [x] 翻页栏固定可见，点击不同页码时素材区平滑置顶。

## 7. 修复与复盘记录
- **修复方案摘要**：
  1. 重构弹窗根节点样式：在 `client/modules/wallpaper-library-ui.js` 中将 `.agy-lib-in-modal` 及 `.agy-lib-root` 定义为标准 Flex 纵向自适应容器（`display: flex; flex-direction: column; height: 100%; min-height: 0; overflow: hidden;`），消除外层溢出滚动。
  2. 滚动区独立：卡片缩略图包裹层 `.agy-lib-scroll` 设置为 `flex: 1 1 0; min-height: 0; overflow-y: auto;`，取消脆弱的 `calc(84vh - 240px)` 硬编码。
  3. 分页栏常驻吸底：将 `#agy-lib-pagination` 从滚动区移出作为独立的 `shrink-0` 容器，置于列表下方并带有边框分割，翻页控件不再跟随卡片滚动。
  4. 底部栏挂载至容器级：将包含“完成”按钮的 `footer` 挂载在主容器 `.agy-modal-container` 的底部，作为独立吸底 Footer，保证用户无需滚动即可一键确认。
- **验证结论**：✅ 经用户实机测试确认通过，弹窗一屏展现完整，完成按钮与分页栏完美固定。已正式归档。

---

## 快捷导航
- [⬅ 返回缺陷追踪总清单](./BUG_TRACKING_LIST.md)
- [➡ 下一个缺陷: BUG-002 - 外观设置残留冗余横幅卡片，且热更新标题在深色主题下异常显示为黑色](./BUG-002_appearance_settings_redundant_banner_and_dark_title.md)
