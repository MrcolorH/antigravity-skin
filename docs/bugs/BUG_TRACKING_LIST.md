# 系统缺陷追踪与管理总清单 (Bug Tracking Master List)

> **架构说明**：本系统缺陷管理采用**“1 个总清单看板 + N 个独立缺陷明细文档”**的解耦架构。  
> - **总清单 (`BUG_TRACKING_LIST.md`)**：聚焦全局状态流转、版本监控、指标统计与快速检索，告别单文档臃肿；  
> - **独立明细 (`BUG-XXX_*.md`)**：每个缺陷拥有独立的生命周期文档，完整记录问题现场、截图、根因诊断、修复方案、验收标准与复盘总结，便于专项查找、隔离编辑与精准修复。

---

## 一、缺陷追踪全局仪表盘

| 指标维度 | 统计数据 | 占比与状态说明 |
| :--- | :---: | :--- |
| **已登记缺陷总数** | **24** 条 | 覆盖全部历史及近期测试缺陷 |
| **已修复封版** | **24** 条 | 占比 **100.0%**（全量已完成实机验证与复盘归档） |
| **待验证 (实机确认中)** | **0** 条 | 占比 **0.0%** |
| **修复中 / 待修复** | **0** 条 | 占比 **0.0%** |

---

## 二、缺陷追踪概览总表

> 点击 **Bug 编号** 或 **明细文档** 即可快速跳转至该缺陷的专属进展与解决方案文档。

| Bug 编号 | 涉及需求 / 模块 | 缺陷摘要 | 严重级别 | 当前状态 | 报告日期 | 修复日期 | 明细与解决方案 |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| [BUG-024](./BUG-024_cold_boot_double_splash_flicker.md) | 开机自愈守护与对比度守护 | 冷启动开屏结束时闪黑并再次闪现开屏画面，宿主原生遮罩与前端DOM开屏存在异步竞态穿帮 | P1 | **已修复** | 2026-10-27 | 2026-10-27 | [查看详情](./BUG-024_cold_boot_double_splash_flicker.md) |
| [BUG-001](./BUG-001_wallpaper_modal_overflow.md) | Wallpaper素材库集成 | 资源库弹窗无法一页全览，底部确认按钮需下拉滚动条，分页未固定 | P2 | **已修复** | 2026-10-23 | 2026-10-23 | [查看详情](./BUG-001_wallpaper_modal_overflow.md) |
| [BUG-002](./BUG-002_appearance_settings_redundant_banner_and_dark_title.md) | 【散】外观设置面板 / 主题适配 | 外观面板残留冗余素材库横幅需剔除；版本热更新标题在深色模式下文字发黑无法辨识 | P2 | **已修复** | 2026-10-23 | 2026-10-23 | [查看详情](./BUG-002_appearance_settings_redundant_banner_and_dark_title.md) |
| [BUG-003](./BUG-003_boot_to_home_black_flash_and_jump.md) | Wallpaper素材库集成 | 从开机引导动画过渡到首页加载期间，动态壁纸（特别是场景壁纸）出现黑闪与抽搐闪动 | P1 | **已修复** | 2026-10-23 | 2026-10-23 | [查看详情](./BUG-003_boot_to_home_black_flash_and_jump.md) |
| [BUG-004](./BUG-004_slash_command_menu_transparent.md) | 【散】快捷指令菜单 / 毛玻璃适配 | 输入框触发斜杠指令(/)弹出菜单完全透明无底色与毛玻璃防护，文字直接混杂在壁纸中完全看不清 | P2 | **已修复** | 2026-10-23 | 2026-10-23 | [查看详情](./BUG-004_slash_command_menu_transparent.md) |
| [BUG-005](./BUG-005_scene_wallpaper_boot_missing_animation.md) | Wallpaper素材库集成 | 场景壁纸在开屏动画中仅展示拉伸静态海报无动态渲染；动态背景下偶现静止或画布缩放裁切异常 | P1 | **已修复** | 2026-10-23 | 2026-10-23 | [查看详情](./BUG-005_scene_wallpaper_boot_missing_animation.md) |
| [BUG-006](./BUG-006_windows_patch_loading_conflict.md) | Wallpaper素材库集成 | 执行patch脚本后官方loading仍旧显现；补丁模板未适配素材库/场景壁纸导致降级回退，主进程掐灭渲染端动效 | P1 | **已修复** | 2026-10-23 | 2026-10-23 | [查看详情](./BUG-006_windows_patch_loading_conflict.md) |
| [BUG-007](./BUG-007_slash_menu_blur_decouple_appearance.md) | 【散】快捷指令与外观样式解耦 | 修复快捷指令时更改了毛玻璃材质，因缺少独立作用域控制导致浅色主题下设置页面毛玻璃效果异常，两处样式未解耦拆分 | P2 | **已修复** | 2026-10-23 | 2026-10-23 | [查看详情](./BUG-007_slash_menu_blur_decouple_appearance.md) |
| [BUG-008](./BUG-008_boot_stay_time_zero_auto_exit.md) | Wallpaper素材库集成 | 开屏动画设置自动进入首页时间为0时，因主进程loadingOverlay未适配时序控制逻辑且视频播完/超时自动退出、以及渲染端任意键退出等缺陷，导致未能一致等待用户按ESC或点击即自动进入首页 | P2 | **已修复** | 2026-10-23 | 2026-10-23 | [查看详情](./BUG-008_boot_stay_time_zero_auto_exit.md) |
| [BUG-009](./BUG-009_scene_poster_extraction_glitch.md) | Wallpaper素材库集成 | 场景壁纸开屏与loading期间首帧海报提取算法缺陷，将默认隐藏/局部变色部件误判为全屏背景，导致开屏画面人物素材被拆开并产生诡异穿帮 | P1 | **已修复** | 2026-10-23 | 2026-10-23 | [查看详情](./BUG-009_scene_poster_extraction_glitch.md) |
| [BUG-010](./BUG-010_boot_transition_flicker_and_smooth_handover.md) | Wallpaper素材库集成 | 系统准备到就绪过程中存在明显闪烁切换，主进程检测到就绪后擅自立即finish强退，且渲染端冗余加载多余科技环与二次遮罩打架；缺少从静态截图平滑淡出至动态场景的无缝过渡 | P1 | **已修复** | 2026-10-23 | 2026-10-23 | [查看详情](./BUG-010_boot_transition_flicker_and_smooth_handover.md) |
| [BUG-011](./BUG-011_video_boot_black_screen.md) | Wallpaper素材库集成 | 从 Wallpaper 素材库选择视频设为开屏动画后，开屏时画面正中完全全黑无视频播放，仅右下角显示状态按钮 | P1 | **已修复** | 2026-10-23 | 2026-10-23 | [查看详情](./BUG-011_video_boot_black_screen.md) |
| [BUG-012](./BUG-012_scene_wallpaper_isBootActive_crash.md) | Wallpaper素材库集成 | 动态壁纸功能中选择场景素材后无法正常动态渲染，因内部将 shouldDeferWallpaperForBoot 误调用为未定义函数 isBootActive 导致挂载首帧抛出异常并自动销毁渲染器 | P1 | **已修复** | 2026-10-23 | 2026-10-23 | [查看详情](./BUG-012_scene_wallpaper_isBootActive_crash.md) |
| [BUG-013](./BUG-013_boot_to_home_black_to_white_flash.md) | Wallpaper素材库集成 | 开屏动画到首页时出现先画面缓黑、随后白屏一闪而过再进入首页的视觉割裂，因淡出前清空视频源、浅色底板裸露及底层壁纸唤醒时序脱节导致 | P1 | **已修复** | 2026-10-23 | 2026-10-23 | [查看详情](./BUG-013_boot_to_home_black_to_white_flash.md) |
| [BUG-014](./BUG-014_scene_wallpaper_boot_and_switch_black_screen.md) | Wallpaper素材库集成 | 场景壁纸切换及开屏后黑屏早退，且多图层场景出现“空背景-黑屏-突现主角”穿帮 | P1 | **已修复** | 2026-10-23 | 2026-10-23 | [查看详情](./BUG-014_scene_wallpaper_boot_and_switch_black_screen.md) |
| [BUG-015](./BUG-015_scene_wallpaper_dark_mode_black_screen.md) | Wallpaper素材库集成 | 场景素材动态壁纸在切换至深色模式后画面消失并呈现全黑底色，因CSS选择器特异度覆盖导致body实黑物理遮挡底层壁纸 | P1 | **已修复** | 2026-10-23 | 2026-10-23 | [查看详情](./BUG-015_scene_wallpaper_dark_mode_black_screen.md) |
| [BUG-016](./BUG-016_boot_atomic_readiness_and_seamless_reveal.md) | Wallpaper素材库集成 | 开屏引导动画与宿主主页加载冲突（双重动画、早泄穿帮与首帧无缝呈现闭环） | P1 | **已修复** | 2026-10-23 | 2026-10-23 | [查看详情](./BUG-016_boot_atomic_readiness_and_seamless_reveal.md) |
| [BUG-017](./BUG-017_scene_boot_style_missing_and_session_loader_overflow.md) | Wallpaper素材库集成 | 场景壁纸模式冷启动核心样式缺失导致会话加载器错位、视口滚动条溢出与10秒死锁 | P0 | **已修复** | 2026-10-23 | 2026-10-23 | [查看详情](./BUG-017_scene_boot_style_missing_and_session_loader_overflow.md) |
| [BUG-018](./BUG-018_windows_boot_black_flicker_and_delay_stuck.md) | Wallpaper素材库集成 | Windows客户端开屏动画退出进入首页出现450ms黑屏停滞一闪而过 | P1 | **已修复** | 2026-10-24 | 2026-10-24 | [查看详情](./BUG-018_windows_boot_black_flicker_and_delay_stuck.md) |
| [BUG-019](./BUG-019_macos_boot_black_white_flicker_and_delay.md) | Wallpaper素材库集成 | macOS客户端启动时闪烁黑屏白屏再延迟进入开屏动画（官方遮罩自毁白闪与CDP底板置黑接力修复） | P1 | **已修复** | 2026-10-24 | 2026-10-24 | [查看详情](./BUG-019_macos_boot_black_white_flicker_and_delay.md) |
| [BUG-020](./BUG-020_boot_patch_lost_after_update_and_reboot.md) | Wallpaper素材库集成 | 重启电脑后皮肤与开机动效整体变回官方原样（安装白名单漏项未落盘 + 客户端更新覆盖 app.asar 无自愈机制） | P0 | **已修复** | 2026-10-25 | 2026-10-25 | [查看详情](./BUG-020_boot_patch_lost_after_update_and_reboot.md) |
| [BUG-021](./BUG-021_top_bar_unreadable_and_wco_buttons_hidden.md) | Wallpaper素材库集成 | 顶部文字黑压黑几乎不可读，且原生最小化/最大化/关闭按钮整体消失（WCO 底色被设为全透明 + 字色只看原生主题） | P0 | **已修复** | 2026-10-25 | 2026-10-25 | [查看详情](./BUG-021_top_bar_unreadable_and_wco_buttons_hidden.md) |
| [BUG-022](./BUG-022_wco_opaque_patch_breaks_immersion.md) | 开机自愈守护与对比度守护 | 右上角原生窗口按钮 (WCO) 底色被强设为不透明纯色导致矩形色块突兀，破坏毛玻璃与壁纸沉浸感 | P1 | **已修复** | 2026-10-26 | 2026-10-26 | [查看详情](./BUG-022_wco_opaque_patch_breaks_immersion.md) |
| [BUG-023](./BUG-023_native_theme_switch_out_of_sync.md) | 开机自愈守护与对比度守护 | 缺乏深浅色主题切换实时联动，且明亮主题加白背景下顶部操作栏与右上角 WCO 严重隐形看不清 | P1 | **已修复** | 2026-10-26 | 2026-10-26 | [查看详情](./BUG-023_native_theme_switch_out_of_sync.md) |

---

## 三、按模块与需求快速检索

### 1. Wallpaper 素材库集成（主规划需求：16 项）
- [BUG-001: Wallpaper 素材库弹窗无法一页全览，底部确认按钮溢出被遮挡](./BUG-001_wallpaper_modal_overflow.md) `[已修复]`
- [BUG-003: 从开屏动画到首页完整加载动态背景出现黑闪与跳动](./BUG-003_boot_to_home_black_flash_and_jump.md) `[已修复]`
- [BUG-005: Wallpaper素材库场景壁纸在开屏动画与动态背景中动效缺失或缩放异常](./BUG-005_scene_wallpaper_boot_missing_animation.md) `[已修复]`
- [BUG-006: Windows版运行补丁脚本后官方原版loading依旧出现且导致开屏动效异常](./BUG-006_windows_patch_loading_conflict.md) `[已修复]`
- [BUG-008: 开屏动画设置自动进入首页时间为0时未能一致常驻等待，依然自动进入首页](./BUG-008_boot_stay_time_zero_auto_exit.md) `[已修复]`
- [BUG-009: 场景壁纸开屏加载首帧海报提取错误导致画面呈现拆解部件与诡异穿帮](./BUG-009_scene_poster_extraction_glitch.md) `[已修复]`
- [BUG-010: 开屏动画从准备到就绪存在闪烁切换与多余加载组件，且未平滑活态化过渡](./BUG-010_boot_transition_flicker_and_smooth_handover.md) `[已修复]`
- [BUG-011: 从素材库选择视频设为开屏动画后开屏画面全黑无视频播放](./BUG-011_video_boot_black_screen.md) `[已修复]`
- [BUG-012: 动态壁纸功能中场景素材动态渲染因 isBootActive 未定义异常导致失效中断](./BUG-012_scene_wallpaper_isBootActive_crash.md) `[已修复]`
- [BUG-013: 开屏动画到首页先缓黑后闪现白屏且缺少丝滑过渡效果](./BUG-013_boot_to_home_black_to_white_flash.md) `[已修复]`
- [BUG-014: 场景壁纸切换及开屏后黑屏早退，且多图层场景出现“空背景-黑屏-突现主角”穿帮](./BUG-014_scene_wallpaper_boot_and_switch_black_screen.md) `[已修复]`
- [BUG-015: 场景素材动态壁纸在切换至深色模式后画面消失并呈现全黑底色](./BUG-015_scene_wallpaper_dark_mode_black_screen.md) `[已修复]`
- [BUG-016: 开屏引导动画与宿主主页加载冲突（双重动画、早泄穿帮与首帧无缝呈现闭环）](./BUG-016_boot_atomic_readiness_and_seamless_reveal.md) `[已修复]`
- [BUG-017: 场景壁纸模式冷启动核心样式缺失导致会话加载器错位、视口滚动条溢出与10秒死锁](./BUG-017_scene_boot_style_missing_and_session_loader_overflow.md) `[已修复]`
- [BUG-018: Windows客户端开屏动画退出进入首页出现450ms黑屏停滞一闪而过](./BUG-018_windows_boot_black_flicker_and_delay_stuck.md) `[已修复]`
- [BUG-019: macOS客户端启动时闪烁黑屏白屏再延迟进入开屏动画](./BUG-019_macos_boot_black_white_flicker_and_delay.md) `[已修复]`
- [BUG-020: 重启电脑后皮肤与开机动效整体变回官方原样（安装未落盘 + 更新覆盖无自愈）](./BUG-020_boot_patch_lost_after_update_and_reboot.md) `[已修复]`
- [BUG-021: 顶部文字黑压黑不可读，且原生最小化/最大化/关闭按钮整体消失](./BUG-021_top_bar_unreadable_and_wco_buttons_hidden.md) `[已修复]`

### 2. 【散】外观设置与主题适配（零散缺陷：3 项）
- [BUG-002: 外观设置残留冗余横幅卡片，且热更新标题在深色主题下异常显示为黑色](./BUG-002_appearance_settings_redundant_banner_and_dark_title.md) `[已修复]`
- [BUG-004: 输入框快捷指令斜杠菜单完全透明，导致文字与背景严重混杂无法辨识](./BUG-004_slash_command_menu_transparent.md) `[已修复]`
- [BUG-007: 快捷指令毛玻璃材质调整与设置页面样式耦合，导致浅色主题下设置页面毛玻璃效果异常](./BUG-007_slash_menu_blur_decouple_appearance.md) `[已修复]`

### 3. 开机自愈守护与对比度守护（主规划需求：3 项）
- [BUG-022: 右上角原生窗口按钮 (WCO) 底色被强设为不透明纯色导致矩形色块突兀，破坏毛玻璃与壁纸沉浸感](./BUG-022_wco_opaque_patch_breaks_immersion.md) `[已修复]`
- [BUG-023: 缺乏深浅色主题切换实时联动，且明亮主题加白背景下顶部操作栏与右上角 WCO 严重隐形看不清](./BUG-023_native_theme_switch_out_of_sync.md) `[已修复]`
- [BUG-024: 冷启动开屏结束时闪黑并再次闪现开屏画面，宿主原生遮罩与前端DOM开屏存在异步竞态穿帮](./BUG-024_cold_boot_double_splash_flicker.md) `[已修复]`

---

## 四、缺陷生命周期与状态定义

```mermaid
flowchart LR
    A["待修复<br/>(发现建档)"] --> B["修复中<br/>(代码修改)"]
    B --> C["待验证<br/>(自测通过/等待用户确认)"]
    C -- "实机确认通过" --> D["已修复<br/>(封版归档)"]
    C -- "体验未达标" --> B
```

- **`待修复`**：问题已确认并建档分配编号，尚未开始代码修改；
- **`修复中`**：正在排查根因、修改代码或调试；
- **`待验证 (待用户实机确认)`**：代码修复自检通过并已完成热载/部署，**绝不擅自关闭**，等待用户在实际场景中体验并确认；
- **`已修复`**：用户确认效果达标，验收标准全量勾选 `[x]`，补全复盘记录后封版。

---

## 五、新缺陷建档工作流与模板

当发现新缺陷时，遵循以下两步流程：

### 步骤 1：创建独立缺陷文档
在 `docs/bugs/` 目录下创建新文件 `BUG-XXX_简短英文描述.md`，使用以下标准模板填充：

```markdown
> **导航**：[⬅ 返回缺陷总清单 (BUG_TRACKING_LIST.md)](./BUG_TRACKING_LIST.md)

---

# BUG-XXX: [简要标题]

- **缺陷编号**：`BUG-XXX`
- **涉及需求 / 模块**：[优先匹配 docs/plan/ 子目录名；无对应则加注【散】]
- **严重级别**：[P0 致命 / P1 严重 / P2 一般 / P3 轻微]
- **当前状态**：`待修复`
- **发现时间**：YYYY-MM-DD
- **修复完成时间**：-
- **报告人**：[姓名/测试组]

## 1. 问题现场与截图
[截图放置在 docs/bugs/assets/ 目录下，使用相对路径引用]
![BUG-XXX 现场截图](assets/BUG-XXX_xxx.png)

## 2. 缺陷现象描述
1. [复现步骤 1]
2. [实际异常表现]

## 3. 期望表现（规范定义）
1. [正确的交互与视觉预期]

## 4. 根本原因深度分析（代码级诊断）
- **文件位置**：`path/to/file`
- **核心诱因**：[精准分析逻辑漏洞、样式冲突或时序缺陷]

## 5. 建议修复方案（技术执行路径）
1. [具体代码调整路径]

## 6. 验证与验收标准
- [ ] [验收条件 1]
- [ ] [验收条件 2]

## 7. 修复与复盘记录
- **修复方案摘要**：[实际修改内容]
- **验证结论**：[实机效果]

---

## 快捷导航
- [⬅ 返回缺陷追踪总清单](./BUG_TRACKING_LIST.md)
```

### 步骤 2：登记至本总清单
在 `BUG_TRACKING_LIST.md` 的概览看板表格中新增一行，更新全局统计数字，并加入分类检索列表。

---

## 六、资产与归档规范

1. **截图资产统一入库**：所有缺陷截图存放在 `docs/bugs/assets/` 下，命名格式统一为 `BUG-XXX_简要英文描述.png`，严禁使用外部图床或临时路径；
2. **需求对齐准则**：涉及主线需求的缺陷严格对齐 `docs/plan/` 对应立项需求名（如 `Wallpaper素材库集成`），零散缺陷前置加注 `【散】` 标签；
3. **技术材料沉淀**：每个独立 Bug 文档中的“根本原因深度分析”与“修复与复盘记录”作为高质量技术素材，可直接支撑后续 Release Notes、技术复盘报告与交付总结。
