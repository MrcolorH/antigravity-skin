# 缺陷追踪与管理中心 (Docs/Bugs)

欢迎访问项目的缺陷追踪与问题管理目录。为保证大型迭代与日常维护的高效性，本项目采用**“总览看板与单点缺陷深度解耦”**的文档架构。

---

## 📌 核心入口

👉 **[点击进入：系统缺陷追踪与管理总清单 (BUG_TRACKING_LIST.md)](./BUG_TRACKING_LIST.md)**

在总清单中，你可以获得：
- 缺陷全局监控仪表盘（总数、修复率、待验证项统计）；
- 全量缺陷汇总看板（编号、所属需求、级别、当前状态、修复日期）；
- 按功能需求（如 `Wallpaper素材库集成`）与零散缺陷（`【散】`）的分组快速索引；
- 标准化建档模板与生命周期流转规范。

---

## 📁 目录结构说明

```
docs/bugs/
├── BUG_TRACKING_LIST.md                       # 缺陷总控看板与快速检索索引
├── README.md                                  # 目录说明引导文档
├── assets/                                    # 缺陷现场截图与对比素材统一存储库
│   ├── BUG-001_wallpaper_modal_overflow.png
│   ├── BUG-002_settings_redundant_card_and_dark_text.png
│   └── ...
├── BUG-001_wallpaper_modal_overflow.md        # BUG-001 独立进展与解决方案
├── BUG-002_appearance_settings_...md          # BUG-002 独立进展与解决方案
├── ...
└── BUG-013_boot_to_home_black_to_white_flash.md # BUG-013 独立进展与解决方案
```

---

## 🚀 缺陷快速直达

| 编号 | 模块 | 缺陷标题 | 状态 | 独立文档 |
| :---: | :--- | :--- | :---: | :--- |
| **BUG-001** | Wallpaper素材库集成 | 资源库弹窗无法一页全览，底部确认按钮需下拉滚动条 | 已修复 | [BUG-001](./BUG-001_wallpaper_modal_overflow.md) |
| **BUG-002** | 【散】外观与主题 | 外观面板残留冗余素材库横幅；深色模式热更新标题发黑 | 已修复 | [BUG-002](./BUG-002_appearance_settings_redundant_banner_and_dark_title.md) |
| **BUG-003** | Wallpaper素材库集成 | 从开机引导动画过渡到首页加载期间动态背景黑闪与跳动 | 已修复 | [BUG-003](./BUG-003_boot_to_home_black_flash_and_jump.md) |
| **BUG-004** | 【散】快捷指令菜单 | 输入框触发斜杠指令弹出菜单完全透明无底色 | 已修复 | [BUG-004](./BUG-004_slash_command_menu_transparent.md) |
| **BUG-005** | Wallpaper素材库集成 | 场景壁纸在开屏动画中动效缺失，动态背景偶现静止或缩放异常 | 已修复 | [BUG-005](./BUG-005_scene_wallpaper_boot_missing_animation.md) |
| **BUG-006** | Wallpaper素材库集成 | Windows版运行补丁脚本后官方原版loading依旧出现且导致动效异常 | 已修复 | [BUG-006](./BUG-006_windows_patch_loading_conflict.md) |
| **BUG-007** | 【散】外观与样式解耦 | 快捷指令毛玻璃调整导致浅色模式设置页面毛玻璃效果异常 | 已修复 | [BUG-007](./BUG-007_slash_menu_blur_decouple_appearance.md) |
| **BUG-008** | Wallpaper素材库集成 | 开屏动画设置自动进入首页时间为0时未能一致常驻等待 | 已修复 | [BUG-008](./BUG-008_boot_stay_time_zero_auto_exit.md) |
| **BUG-009** | Wallpaper素材库集成 | 场景壁纸开屏首帧海报提取错误导致画面呈现拆解部件穿帮 | **待验证** | [BUG-009](./BUG-009_scene_poster_extraction_glitch.md) |
| **BUG-010** | Wallpaper素材库集成 | 系统准备到就绪闪烁切换与多余加载组件，缺少平滑活态化过渡 | 已修复 | [BUG-010](./BUG-010_boot_transition_flicker_and_smooth_handover.md) |
| **BUG-011** | Wallpaper素材库集成 | 从素材库选择视频设为开屏动画后开屏画面全黑无视频播放 | 已修复 | [BUG-011](./BUG-011_video_boot_black_screen.md) |
| **BUG-012** | Wallpaper素材库集成 | 动态壁纸功能中场景素材渲染因 isBootActive 未定义异常中断 | 已修复 | [BUG-012](./BUG-012_scene_wallpaper_isBootActive_crash.md) |
| **BUG-013** | Wallpaper素材库集成 | 开屏动画到首页先缓黑后闪现白屏且缺少丝滑过渡效果 | **待验证** | [BUG-013](./BUG-013_boot_to_home_black_to_white_flash.md) |
