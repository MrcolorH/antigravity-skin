> **导航**：[⬅ 返回缺陷总清单 (BUG_TRACKING_LIST.md)](./BUG_TRACKING_LIST.md)

---

# BUG-009: 场景壁纸开屏加载首帧海报提取错误导致画面呈现拆解部件与诡异穿帮

- **缺陷编号**：`BUG-009`
- **涉及需求 / 模块**：Wallpaper素材库集成 (`sidecars/skin-engine/scene-pkg.mjs`, `sidecars/skin-engine/main.mjs`, `client/modules/boot-animation.js`, `scripts/patch-boot-overlay.mjs`)
- **严重级别**：P1（视觉穿帮与首帧渲染缺陷）
- **当前状态**：`已修复`
- **发现时间**：2026-10-23
- **修复完成时间**：2026-10-23
- **报告人**：用户 / 测试

## 1. 问题现场与截图
在将场景类壁纸（以《WLOP Chapter4 上》3737267090 及《熠烛 御剑驭龙-红鸾樱落》3233141951 为例）设为开屏动画并进行“开屏动画预览”或启动应用进入 loading 状态时，屏幕上首先渲染出的静态海报画面并非完整的全景壁纸，而是人物的脸颊、眉毛、胸口衣服、手部、悬空眼镜等各个零件被生硬拆开散落在大黑底板上的怪异图集，右下角带有“系统启动中...”加载胶囊，画面呈现极其违和恐怖的“开膛破肚/散装人体”穿帮。

![BUG-009 异常首帧现场实机截图](assets/BUG-009_broken_split_character.png)

## 2. 缺陷现象描述
1. **开屏首帧人物素材被拆解成零件孤立呈现**：在开屏 loading 阶段（`WebWallGL` 还在下载数十兆 `scene.pkg` 并编译着色器前），界面加载的静态过渡底板 `scene-poster` 显示的不是整张全景图，而是模型骨骼图集（如 `WLOP Chapter4 上` 中的 `556` 图集材质），导致用户在开机前几秒直面被拆散的人体部位零件（脸、眼睛、手部散落各处）。
2. **多图层场景误提取问题普遍存在**：通过全量遍历创意工坊场景壁纸包（如 `3737267090` 提取出拆解零件图层 `556`、`3233141951` 提取出变色层“紫”、`3243449890` 提取出“鼠标指针”、`3669680904` 提取出“Vinyl Shadow”黑胶阴影层），证实只要场景包含 2D Puppet 动画、变色选项或多层特效，原算法极易误中副产物图层。
3. **持久化缓存污染导致错误画面被固化**：首次访问场景提取海报后，错误的局部图层被直接写回壁纸目录的 `scene-poster.png` 以及系统临时缓存中。即使后续反复预览，系统也始终读取并展示被污染的错误拆解图。

## 3. 期望表现（规范定义）
1. **开屏首帧必须呈现场景的最底层完整主背景或合成全貌**：无论场景壁纸包含多少动态分层、骨骼部件或变色选项，在提取首帧静态海报时，必须严格选出承载全局视野的底板图层（如尺寸匹配工程正交分辨率 `orthogonalprojection`、全屏背景图层、或不透明/主全景图），坚决杜绝选出单独的人物肢体、局部发光变色层、鼠标指针或阴影小部件。
2. **绝对禁止提取 Puppet 骨骼网格（`.mdl` / `puppet`）图层材质**：Wallpaper Engine 中带有 `puppet` 的模型均为 2D 骨骼形变部件，其材质本质上是散装图集（Atlas）。若场景主体为纯 Puppet 组装且不存在独立全景底图，提取算法必须明确返回 `null` 并安全回退到原作者提供的完整预渲染缩略图（`preview.jpg` / `preview.gif`，通常为 1024x1024 高清完整图），绝不展示任何散装贴图。
3. **严密过滤默认隐藏与用户切换图层**：对于 `visible.value === false` 的配置项图层、变色图层、半透明附加图层，提取算法必须精准识别并予以剔除或降权。
4. **健壮解析复杂属性对象**：`size` 与 `scale` 字段在包含动画脚本或配置对象时，应安全解析其真实基准数值，防止因 `[object Object]` 导致尺寸归零或局部部件放大倍数误判。
5. **具备缓存自愈与纠错机制**：修复算法后，自动清理并覆盖所有壁纸目录下之前生成的错误 `scene-poster.*`，即时重新生成正确的高清全屏原生海报。

## 4. 根本原因分析（代码级诊断）
1. **Puppet 骨骼网格材质特性未做甄别与阻断**：
   - 场景壁纸中为了实现人物呼吸、眼神追踪与骨骼摆动，大量采用 2D Puppet（网格形变技术，如 `models/556.json` 中配置了 `"puppet": "models/556_puppet.mdl"`）。这类模型引用的 `.tex` 材质实质是供网格 UV 映射切割的散装零件图集（Texture Atlas），包含分散的脸部、手部、眼镜、衣领等。
   - 原代码仅根据尺寸/面积机械排序，且 `556` 图层的基准尺寸（4200x2160）甚至超过了场景正交工程分辨率（3840x2160），导致该散装图集被评选为“覆盖面积最大的主图层”，直接作为平铺海报吐出。
2. **图层可见性判断类型漏洞**：
   - 位于 `sidecars/skin-engine/scene-pkg.mjs` 中的 `extractScenePoster`：
     ```javascript
     const imageLayers = (Array.isArray(scene.objects) ? scene.objects : [])
       .filter(o => o && o.image && o.visible !== false);
     ```
   - Wallpaper Engine 的 `scene.json` 中，用户可配置图层（如变色层、音条层、挂件层）的 `visible` 通常是一个对象：`{ user: { condition: '1', name: 'newproperty36' }, value: false }`。在 JavaScript 中，任何对象与 `false` 做全等判断（`!== false`）均恒为 `true`，导致默认关闭的变色图层（如御剑驭龙中的“紫”、“粉”）全部逃逸过滤，被当做可见图层参与海报选优。
3. **面积评分算法与局部缩放权重缺陷**：
   - 原代码中计算图层面积为：`Math.abs(size[0] * scale[0]) * Math.abs(size[1] * scale[1])`。
   - 局部部件通过配置极高 scale 放大，计算面积反超完整底板背景；且 `parseVec3` 对对象型 `scale`（包含动画/脚本）强转 `String` 导致 `[object Object]` 解析为 `[0, 0, 0]`，使大量真实主图层面积归零。
4. **服务层缺少旧缓存刷新与 fallback 拦截**：
   - `/api/wallpaper-library/scene-poster` 盲目优先读取本地已有的 `scene-poster.*`，即使传入 `refresh=1` 也未跳过；且当无可用底图时直接返回 404 造成前端闪黑，未就地回退 `preview.*`。

## 5. 建议修复方案
1. **重构 `scene-pkg.mjs` 中的图层可见性与属性提取器**：
   - 编写 `resolveLayerVisibility(obj)`：深度解构 `obj.visible`，支持布尔值、字符串（`"false"`）以及包含 `value: false` 的对象；
   - 编写 `safeParseVec3(val, fallback)`：支持直接字符串、数字以及包含 `value` 属性的对象，杜绝 `[object Object]` 产生 NaN/0；
2. **设计多维度综合评分权重算法（Smart Poster Layer Ranker）并阻断 Puppet 模型**：
   - **绝对阻断 Puppet**：检查 `mdl.puppet`，凡是带有骨骼网格形变动画的图层直接 `continue` 跳过，绝不选为海报；
   - **基准像素面积**：优先以素材原生分辨率作为画质基准；
   - **工程分辨率吻合度**：若图层尺寸与 `scene.general.orthogonalprojection`（如 4096x2296, 3840x2160）1:1 吻合，赋予极高加权（+25,000,000 分）；
   - **Z-Order 底层加权**：底层背景图层优先加权；
   - **语义特征加权与惩罚**：正向加权“背景/base/wallpaper”，严厉惩罚“指针/阴影/音条/挂饰/蒙版/粒子”等；
   - **安全兜底**：若场景不存在任何合格的无 Puppet 全景底图，`extractScenePoster` 明确返回 `null`；
3. **海报接口就地 Fallback 与全局自愈**：
   - 在 `main.mjs` 的 `/api/wallpaper-library/scene-poster` 接口中，支持 `refresh=1` 强制覆盖旧文件；当无法提取纯净大图时，就地自动回退读取该壁纸的 `preview.jpg`/`preview.gif` 返回 200，杜绝 404 与黑屏；
   - 编写自愈逻辑批量刷新工坊壁纸目录，彻底清理历史错误 `scene-poster.png`，替换为真正的 4K 原生画幅。

## 6. 验证与验收标准
- [x] 1. 修复后在 `scene-pkg.mjs` 中重新提取当前开屏壁纸《WLOP Chapter4 上》(3737267090)，成功排除零件图层 `556`，精准命中 3840x2160 4K 原生主背景《3Chapter4_2_8K_29》，生成 2.42MB 完整无拆解海报；
- [x] 2. 重新提取壁纸《熠烛 御剑驭龙-红鸾樱落》(3233141951)，成功排除变色图层“紫”，精准命中 4096x2296 4K 原生主背景《新壁纸，樱》；
- [x] 3. 全局扫描创意工坊场景壁纸库，全部历史异常壁纸均自愈成功，无任何拆散人体零件图残留；
- [x] 4. 完成代码构建与全局热同步部署（`sync-all.mjs`），运行时健康检测全部通过；
- [x] 5. 用户在实机界面中打开“外观设置 -> 开屏动画 (Boot Animation)”点击“预览”，确认开屏首帧与 loading 状态完美呈现完整高清主画面，无拆解穿帮并反馈验收。

## 7. 修复与复盘记录
- **修复方案摘要**：
  1. 在 `sidecars/skin-engine/scene-pkg.mjs` 中重构属性安全解析器（`safeParseVec3`、`isLayerVisible`），彻底修复 `{ value: false }` 逃逸与 `[object Object]` 归零漏洞；
  2. 确立“Puppet 骨骼网格绝对阻断”铁律，杜绝将 Texture Atlas 散装零件贴图当成全屏海报输出；引入工程分辨率匹配（+25,000,000）、Z-Order 渲染顺序与语义加权评分体系；
  3. 当场景壁纸为纯 Puppet 组装时，安全返回 `null` 并由 `main.mjs` 接口自动就地 fallback 回退原作者提供的完整 1024x1024 `preview.jpg`/`preview.gif`，彻底阻断散装人体穿帮；
  4. 彻底清理已污染的历史 `scene-poster.png`，重新生成并持久化覆盖为真正的 4K 原生大图（如 3737267090 现已为 3840x2160 2.42MB 完整画面）；
  5. 完成热部署与 Sidecar 运行时重载。
- **效果对比截图**：
  - **修复前（错误拆解图集穿帮）**：![修复前异常现场](assets/BUG-009_broken_split_character.png)
  - **修复后（原生 4K 完整画幅首帧）**：![修复后完整画面](assets/BUG-009_fixed_wlop_poster.jpg)
- **验证结论**：代码修复与环境部署已全部就绪，已流转为【待验证 (待用户实机确认)】，等待用户在实机点击预览验收。

---

## 快捷导航
- [⬅ 返回缺陷追踪总清单](./BUG_TRACKING_LIST.md)
- [⬅ 上一个缺陷: BUG-008 - 开屏动画设置自动进入首页时间为0时未能一致常驻等待，依然自动进入首页](./BUG-008_boot_stay_time_zero_auto_exit.md)
- [➡ 下一个缺陷: BUG-010 - 开屏动画从准备到就绪存在闪烁切换与多余加载组件，且未平滑活态化过渡](./BUG-010_boot_transition_flicker_and_smooth_handover.md)
