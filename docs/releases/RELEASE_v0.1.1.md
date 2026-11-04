## 🌟 Antigravity Theme & Skin v0.1.1 发布说明

### 🎬 Wallpaper 素材库重磅集成 (Wallpaper Engine 深度兼容)
- **支持 Wallpaper Engine 素材无缝导入与多维管理**：
  - 本地与 Steam 创意工坊壁纸素材智能识别、文件夹多级遍历与全类型覆盖（🎬 视频壁纸、🎨 2D/3D Scene 场景壁纸、🌐 Web 网页壁纸）；
  - 全新独立「Wallpaper 素材库」交互面板，支持分类筛选、分页常驻、素材预览与一键应用为桌面壁纸或开屏引导动画；
- **4K / 60fps 场景壁纸实时 WebGL2 渲染引擎**：
  - 深度集成高性能场景渲染管线，完整支持 `scene.pkg` 本地解包、多图层混合、动态着色器编译与 GPU 硬件加速；
  - 独创**智能主海报提取与评分算法**（Smart Poster Ranker），彻底阻断 Puppet 骨骼网格散装零件贴图穿帮，确保开屏与加载期间始终呈现原生 4K 主背景；
- **双缓冲 Canvas 原子性换轨引擎**：
  - 壁纸切换时引入双缓冲接力机制，新素材着色器编译与纹理装配期间旧画面持续维持 60fps 渲染，新首帧成型后平滑交叉淡入（Cross-fade），**彻底消灭切换壁纸时的黑屏断层与抽搐跳动**；
- **影院级零闪白开机引导动画 (Boot Transition Engine)**：
  - 主进程 T=0 秒直接拉起全屏开屏视频硬解秒播，主窗口原生纯黑 + 标题栏无缝透明，**彻底消除前置白闪与黑屏过渡**；
  - **真·完整就绪（Truly Ready）铁壁防线**：开屏动画忠实遮蔽后台冷启动与 React 界面挂载，严格等待主输入框、会话侧边栏、4K 场景壁纸首帧与毛玻璃样式 100% 渲染成型后再点亮变绿；
  - 用户按 ESC 或点击跳过（或设定驻留时间自动进入），开屏视频 450ms 贝塞尔平滑淡出，展现出的是已经完整渲染好的整个首页，**实现零黑屏、零拼凑、开幕即巅峰的影院级视觉标准**；
- **冷启动内核级极速自适应探测**：
  - 引入操作系统内核文件事件监听（`fs.watch`）与 100ms 自适应快频重试，DevTools 调试端口生成 0 毫秒即刻响应，**直接砍掉冷启动 1.5 ~ 2 秒盲等等待**。

---

### 🐛 重点缺陷修复 (16 项全量核销封版)
- **BUG-001 ~ BUG-016 全量修复与规范化归档**：
  - 修复素材库弹窗底部操作栏遮挡与分页滚动问题（[BUG-001](./docs/bugs/BUG-001_wallpaper_modal_overflow.md)）；
  - 修复外观设置残留横幅与深色模式标题文字反色异常（[BUG-002](./docs/bugs/BUG-002_appearance_settings_redundant_banner_and_dark_title.md)）；
  - 消除开屏动画到首页的场景壁纸黑闪与跳动（[BUG-003](./docs/bugs/BUG-003_boot_to_home_black_flash_and_jump.md)）；
  - 修复斜杠指令菜单完全透明无底色文字混杂问题（[BUG-004](./docs/bugs/BUG-004_slash_command_menu_transparent.md)）；
  - 消除场景壁纸海报提取将人物骨骼贴图拆解散开的严重穿帮（[BUG-009](./docs/bugs/BUG-009_scene_poster_extraction_glitch.md)）；
  - 修复素材库视频设为开屏动画全黑无画面（[BUG-011](./docs/bugs/BUG-011_video_boot_black_screen.md)）；
  - 消除深色模式下场景壁纸黑屏遮挡（[BUG-015](./docs/bugs/BUG-015_scene_wallpaper_dark_mode_black_screen.md)）；
  - 彻底解决开机双重动画与进入首页前黑屏拼凑加载的视觉断层（[BUG-016](./docs/bugs/BUG-016_boot_atomic_readiness_and_seamless_reveal.md)）。

---

### 📌 后续版本预告 (Upcoming)
> **说明**：场景背景的高级属性配置（包括自定义参数调控、粒子开关、时钟与日期挂件激活等）正在紧锣密鼓完善中，**将在下一个发版（v0.1.2）中正式上线**，敬请期待！
