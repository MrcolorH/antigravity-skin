/**
 * wallpaper-library-ui.js - Wallpaper 外部素材库资产中心（零拷贝原地引用）
 *
 * 阶段四模型：
 *  - 素材库不再持有自己的总开关；动态壁纸 / 开屏动画各自在原生区块里拥有一个「使用素材库」开关；
 *  - 本模块只负责渲染素材库区块：路径配置、状态、类型/分级筛选、搜索、分页、资产卡片；
 *  - 卡片按钮按开关裁剪：壁纸开关开→「设为动态壁纸」，开屏开关开→「设为开屏动画」；
 *  - 选中态外框按动作配色：壁纸蓝 / 开屏绿 / 两者渐变。
 */

(() => {
  if (typeof window === 'undefined') return;

  const RATING_KEYS = ['everyone', 'questionable', 'mature'];
  const RATING_STORAGE_KEY = 'agy.lib.ratingFilter';

  const I18N = {
    zh: {
      title: 'Wallpaper 素材库',
      desc: '原地引用 Wallpaper Engine / WallpaperMachine 素材，零拷贝不占额外磁盘',
      pathPlaceholder: '素材库根目录，例如 E:\\SteamLibrary\\steamapps\\workshop\\content\\431960',
      mountRoot: '📁 选择根目录',
      mountSingle: '📄 载入单个壁纸目录',
      pickRootTitle: '选择 Wallpaper Engine 素材库根目录',
      pickSingleTitle: '选择 Wallpaper Engine 单个壁纸工程目录',
      mounting: '⏳ 正在载入...',
      mountSuccess: '素材库挂载成功',
      refresh: '🔄 刷新',
      scanning: '⏳ 正在扫描素材库...',
      empty: '尚未选择素材库根目录，点击「📁 选择根目录」或直接点击下方检测到的素材库',
      notMounted: '未挂载素材库',
      suggest: '检测到本机素材库（点击即可一键使用）',
      use: '使用',
      status: (total, byType) => `已索引 ${total} 款壁纸 · 视频 ${byType.video || 0} / 场景 ${byType.scene || 0} / 网页 ${byType.web || 0} · 0 MB 本地冗余`,
      filtered: (n) => `已过滤 ${n} 个不支持的 exe / application 项目`,
      hiddenByRating: (n) => `已隐藏 ${n} 款（分级）`,
      filterAll: '全部',
      filterVideo: '🎬 视频',
      filterWeb: '🌐 网页',
      filterScene: '🎨 场景',
      ratingLabel: '分级',
      ratingG: '所有人',
      ratingPG: '辅导级',
      ratingR18: '限制级',
      ratingChipTitle: (name, included) => `${name} — 点击${included ? '隐藏' : '显示'}`,
      searchPlaceholder: '搜索标题 / 文件夹 id',
      more: '显示更多',
      setWallpaper: '设为动态壁纸',
      setBoot: '设为开屏动画',
      inUse: '使用中',
      activeWall: '动态壁纸 · 使用中',
      activeBoot: '开屏动画 · 使用中',
      applied: '已设为动态壁纸',
      bootApplied: '已设为开屏动画',
      noPreview: '无封面',
      libEmptyTip: '素材库为空，可能是路径下没有 Wallpaper Engine 项目文件夹',
      noMatch: '当前筛选无匹配，试试放宽分级或类型',
      scanFailed: '扫描失败',
      mountFailed: '挂载失败',
      current: '使用中',
      video: '视频壁纸',
      web: '网页壁纸',
      scene: '场景壁纸',
      unknown: '未知类型',
      author: '作者',
      size: '体积',
      keepExternalHint: '素材库模式已关闭，当前仍在使用外部素材；可在下拉框中选择内置素材',
      pagePrev: '‹ 上一页',
      pageNext: '下一页 ›',
      pageFirst: '« 首页',
      pageLast: '末页 »',
      pageInfo: (cur, total, count) => `共 ${count} 款 · 第 ${cur} / ${total} 页`,
      pageJump: '跳至',
      pageUnit: '页',
      pageGo: '前往'
    },
    en: {
      title: 'Wallpaper Library',
      desc: 'Reference Wallpaper Engine / WallpaperMachine files in place — zero copy, zero extra disk',
      pathPlaceholder: 'Library root, e.g. E:\\SteamLibrary\\steamapps\\workshop\\content\\431960',
      mountRoot: '📁 Select Root Folder',
      mountSingle: '📄 Load Single Wallpaper Folder',
      pickRootTitle: 'Select Wallpaper Engine Library Root Folder',
      pickSingleTitle: 'Select Single Wallpaper Folder',
      mounting: '⏳ Loading...',
      mountSuccess: 'Library mounted successfully',
      refresh: '🔄 Refresh',
      scanning: '⏳ Scanning library...',
      empty: 'No library mounted yet. Click "📁 Select Root Folder" or pick a detected library below',
      notMounted: 'No library mounted',
      suggest: 'Detected library (click to use)',
      use: 'Use',
      status: (total, byType) => `${total} wallpapers indexed · ${byType.video || 0} video / ${byType.scene || 0} scene / ${byType.web || 0} web · 0 MB local duplication`,
      filtered: (n) => `${n} unsupported exe / application items filtered out`,
      hiddenByRating: (n) => `${n} hidden by age rating`,
      filterAll: 'All',
      filterVideo: '🎬 Video',
      filterWeb: '🌐 Web',
      filterScene: '🎨 Scene',
      ratingLabel: 'Rating',
      ratingG: 'Everyone',
      ratingPG: 'Questionable',
      ratingR18: 'Mature',
      ratingChipTitle: (name, included) => `${name} — click to ${included ? 'hide' : 'show'}`,
      searchPlaceholder: 'Search title / folder id',
      more: 'Show more',
      setWallpaper: 'Set as wallpaper',
      setBoot: 'Set as boot animation',
      inUse: 'In use',
      activeWall: 'Wallpaper · in use',
      activeBoot: 'Boot animation · in use',
      applied: 'Applied as wallpaper',
      bootApplied: 'Applied as boot animation',
      noPreview: 'No preview',
      libEmptyTip: 'Library is empty — no Wallpaper Engine project folders found',
      noMatch: 'Nothing matches the current filters — try relaxing rating or type',
      scanFailed: 'Scan failed',
      mountFailed: 'Mount failed',
      current: 'In use',
      video: 'Video',
      web: 'Web',
      scene: 'Scene',
      unknown: 'Unknown',
      author: 'Author',
      size: 'Size',
      keepExternalHint: 'Library mode is off. The current external asset keeps playing — pick a built-in asset from the dropdown to switch.',
      pagePrev: '‹ Prev',
      pageNext: 'Next ›',
      pageFirst: '« First',
      pageLast: 'Last »',
      pageInfo: (cur, total, count) => `${count} items · Page ${cur} of ${total}`,
      pageJump: 'Go to',
      pageUnit: 'Page',
      pageGo: 'Go'
    }
  };

  const state = {
    container: null,
    ctx: null,
    list: [],
    stats: null,
    filtered: [],
    libraryPath: '',
    loading: false,
    loadedOnce: false,
    filter: 'all',
    target: 'wallpaper', // 'wallpaper' 或 'boot'
    keyword: '',
    currentPage: 1,
    limit: 20,
    error: '',
    detectCandidates: [],
    detected: false,
    excludedRatings: getDefaultExcludedRatings(),
    toastTimer: null
  };

  const PAGE_SIZE = 20;

  function t() {
    const lang = state.ctx && typeof state.ctx.isZh === 'function' && !state.ctx.isZh() ? 'en' : 'zh';
    return I18N[lang];
  }

  function apiBase() {
    return (state.ctx && state.ctx.apiBase) || `http://127.0.0.1:${window.__AG_SKIN_PORT__ || 59288}`;
  }

  // ---------------- 双开关读取 ----------------
  function readCfg() {
    return (state.ctx && state.ctx.getConfig()) || {};
  }

  function libCfg() {
    const lib = readCfg().features?.externalWallpaperLibrary || {};
    // 兼容旧单开关：新字段缺失时按 enabled 推导
    const legacy = lib.enabled === true;
    return {
      ...lib,
      wallpaperEnabled: lib.wallpaperEnabled !== undefined ? lib.wallpaperEnabled === true : legacy,
      bootEnabled: lib.bootEnabled !== undefined ? lib.bootEnabled === true : legacy
    };
  }

  function isWallpaperEnabled() {
    return libCfg().wallpaperEnabled === true;
  }

  function isBootEnabled() {
    return libCfg().bootEnabled === true;
  }

  function isAnyEnabled() {
    return isWallpaperEnabled() || isBootEnabled();
  }

  function saveCfg(cfg) {
    if (state.ctx && typeof state.ctx.saveConfig === 'function') {
      state.ctx.saveConfig(cfg);
    }
    if (state.ctx && typeof state.ctx.onApplied === 'function') {
      try { state.ctx.onApplied(); } catch (_) {}
    }
  }

  // ---------------- 通用格式化 ----------------
  function fmtSize(bytes) {
    const n = Number(bytes) || 0;
    if (!n) return '';
    if (n >= 1024 * 1024 * 1024) return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
    if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
    if (n >= 1024) return `${(n / 1024).toFixed(0)} KB`;
    return `${n} B`;
  }

  function typeLabel(type) {
    const L = t();
    if (type === 'video') return `🎬 ${L.video}`;
    if (type === 'web') return `🌐 ${L.web}`;
    if (type === 'scene') return `🎨 ${L.scene}`;
    return L.unknown;
  }

  function typeBadgeClass(type) {
    if (type === 'web') return 'agy-lib-badge agy-lib-badge-web';
    if (type === 'scene') return 'agy-lib-badge agy-lib-badge-scene';
    return 'agy-lib-badge agy-lib-badge-video';
  }

  function normalizeKey(p) {
    return String(p || '').replace(/\//g, '\\').toLowerCase();
  }

  function absoluteUrl(rel) {
    if (!rel) return '';
    if (/^https?:\/\//i.test(rel)) return rel;
    return `${apiBase()}${rel}`;
  }

  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function escapeAttr(str) {
    return escapeHtml(str).replace(/'/g, '&#39;');
  }

  // ---------------- 分级筛选状态（默认只选择所有人，pg13和r18都默认不勾选） ----------------
  function getDefaultExcludedRatings() {
    // 集合中存放被排除的分级；未被排除的处于激活勾选状态
    // 默认勾选所有人（everyone），默认排除（不勾选）PG-13（questionable）与 R-18（mature）
    return new Set(['questionable', 'mature']);
  }

  try {
    localStorage.removeItem(RATING_STORAGE_KEY);
  } catch (_) {}

  function ratingCounts() {
    const fromServer = state.stats?.byRating;
    if (fromServer && typeof fromServer === 'object') {
      return {
        everyone: fromServer.everyone || 0,
        questionable: fromServer.questionable || 0,
        mature: fromServer.mature || 0,
        unknown: fromServer.unknown || 0
      };
    }
    const acc = { everyone: 0, questionable: 0, mature: 0, unknown: 0 };
    for (const w of state.list) {
      const key = RATING_KEYS.includes(w.rating) ? w.rating : 'unknown';
      acc[key] = (acc[key] || 0) + 1;
    }
    return acc;
  }

  // ---------------- 样式 ----------------
  function ensureStyle() {
    let style = document.getElementById('agy-library-style');
    const isNew = !style;
    if (isNew) {
      style = document.createElement('style');
      style.id = 'agy-library-style';
    }
    style.textContent = `
      .agy-lib-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(168px, 1fr));
        gap: 8px;
        margin-top: 2px;
      }
      .agy-lib-card {
        position: relative;
        display: flex;
        flex-direction: column;
        border: 2px solid rgba(15, 23, 42, 0.10);
        border-radius: 10px;
        overflow: hidden;
        background: rgba(255, 255, 255, 0.72);
        transition: border-color .16s ease, box-shadow .16s ease, transform .16s ease;
      }
      .agy-lib-card:hover {
        border-color: rgba(14, 165, 233, 0.55);
        box-shadow: 0 6px 18px rgba(2, 132, 199, 0.16);
        transform: translateY(-1px);
      }
      /* 选中态：动态壁纸 = 天蓝（与「设为动态壁纸」按钮同色） */
      .agy-lib-card.is-wall {
        border-color: #0284c7;
        box-shadow: 0 0 0 1px rgba(2, 132, 199, 0.45) inset, 0 6px 20px rgba(2, 132, 199, 0.22);
      }
      /* 选中态：开屏动画 = 翠绿（与「设为开屏动画」按钮同色） */
      .agy-lib-card.is-boot {
        border-color: #10b981;
        box-shadow: 0 0 0 1px rgba(16, 185, 129, 0.45) inset, 0 6px 20px rgba(16, 185, 129, 0.22);
      }
      /* 选中态：两者皆是 = 45° 蓝绿渐变描边（mask 实现圆角边框） */
      .agy-lib-card.is-both {
        border-color: transparent;
        box-shadow: 0 6px 22px rgba(2, 132, 199, 0.18), 0 6px 22px rgba(16, 185, 129, 0.18);
      }
      .agy-lib-card.is-both::after {
        content: '';
        position: absolute;
        inset: 0;
        border-radius: 8px;
        padding: 2px;
        background: linear-gradient(135deg, #0284c7 0%, #10b981 100%);
        -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
        -webkit-mask-composite: xor;
        mask-composite: exclude;
        pointer-events: none;
      }
      .dark .agy-lib-card, .theme-dark .agy-lib-card, [data-theme="dark"] .agy-lib-card {
        border-color: rgba(255, 255, 255, 0.10);
        background: rgba(255, 255, 255, 0.04);
      }
      .agy-lib-thumb {
        position: relative;
        width: 100%;
        aspect-ratio: 16 / 9;
        background: linear-gradient(135deg, rgba(2, 132, 199, 0.14), rgba(148, 163, 184, 0.18));
        overflow: hidden;
      }
      .agy-lib-thumb img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }
      .agy-lib-freeze-canvas {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
        z-index: 1;
        pointer-events: none;
        opacity: 1;
        transition: opacity .22s cubic-bezier(0.16, 1, 0.3, 1);
      }
      .agy-lib-card:hover .agy-lib-freeze-canvas {
        opacity: 0;
      }
      .agy-lib-gif-badge {
        position: absolute;
        top: 6px;
        right: 6px;
        padding: 1px 5px;
        border-radius: 4px;
        font-size: 9px;
        font-weight: 700;
        font-family: monospace;
        letter-spacing: 0.5px;
        background: rgba(15, 23, 42, 0.75);
        color: #38bdf8;
        border: 1px solid rgba(56, 189, 248, 0.4);
        pointer-events: none;
        z-index: 3;
        backdrop-filter: blur(4px);
        transition: background .2s ease, color .2s ease;
      }
      .agy-lib-card:hover .agy-lib-gif-badge {
        background: #0284c7;
        color: #ffffff;
        border-color: #38bdf8;
      }
      .agy-lib-thumb-empty {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 11px;
        color: #64748b;
      }
      .agy-lib-badge {
        position: absolute;
        top: 6px;
        left: 6px;
        font-size: 10px;
        line-height: 1.4;
        padding: 1px 6px;
        border-radius: 999px;
        color: #fff;
        font-weight: 600;
        letter-spacing: .2px;
        backdrop-filter: blur(4px);
      }
      .agy-lib-badge-video { background: rgba(2, 132, 199, 0.88); }
      .agy-lib-badge-web { background: rgba(147, 51, 234, 0.86); }
      .agy-lib-badge-scene { background: rgba(13, 148, 136, 0.88); }
      .agy-lib-states {
        position: absolute;
        top: 6px;
        right: 6px;
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 3px;
      }
      .agy-lib-state-tag {
        font-size: 10px;
        padding: 1px 6px;
        border-radius: 999px;
        color: #fff;
        font-weight: 600;
        white-space: nowrap;
      }
      .agy-lib-state-wall { background: rgba(2, 132, 199, 0.95); }
      .agy-lib-state-boot { background: rgba(16, 185, 129, 0.95); }
      .agy-lib-body {
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding: 7px 8px 8px;
        min-width: 0;
        flex: 1;
      }
      .agy-lib-title {
        font-size: 12px;
        font-weight: 600;
        line-height: 1.35;
        overflow: hidden;
        text-overflow: ellipsis;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        word-break: break-word;
      }
      .agy-lib-meta {
        font-size: 10.5px;
        color: #64748b;
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
        overflow: hidden;
        min-height: 14px;
      }
      .dark .agy-lib-meta, .theme-dark .agy-lib-meta { color: #94a3b8; }
      .agy-lib-actions {
        display: flex;
        gap: 5px;
        margin-top: auto;
        padding-top: 3px;
      }
      .agy-lib-btn {
        flex: 1;
        font-size: 11px;
        line-height: 1.5;
        padding: 3px 5px;
        border-radius: 6px;
        cursor: pointer;
        border: 1px solid transparent;
        transition: background .15s ease, border-color .15s ease, color .15s ease;
        white-space: nowrap;
      }
      .agy-lib-btn-wall {
        background: rgba(2, 132, 199, 0.12);
        border-color: rgba(2, 132, 199, 0.45);
        color: #0369a1;
      }
      .agy-lib-btn-wall:hover { background: rgba(2, 132, 199, 0.22); }
      .agy-lib-btn-boot {
        background: rgba(16, 185, 129, 0.10);
        border-color: rgba(16, 185, 129, 0.42);
        color: #047857;
      }
      .agy-lib-btn-boot:hover { background: rgba(16, 185, 129, 0.2); }
      .agy-lib-btn.is-in-use {
        cursor: default;
      }
      .agy-lib-btn.is-in-use.agy-lib-btn-wall {
        background: rgba(2, 132, 199, 0.9);
        border-color: #0284c7;
        color: #fff;
      }
      .agy-lib-btn.is-in-use.agy-lib-btn-boot {
        background: rgba(16, 185, 129, 0.9);
        border-color: #10b981;
        color: #fff;
      }
      .dark .agy-lib-btn-wall { color: #7dd3fc; }
      .dark .agy-lib-btn-boot { color: #6ee7b7; }
      .agy-lib-chip {
        font-size: 11px;
        padding: 2px 9px;
        border-radius: 999px;
        border: 1px solid rgba(15, 23, 42, 0.12);
        background: transparent;
        color: #475569;
        cursor: pointer;
        white-space: nowrap;
      }
      .agy-lib-chip.active {
        background: #0284c7;
        border-color: #0284c7;
        color: #fff;
        font-weight: 600;
      }
      .dark .agy-lib-chip { border-color: rgba(255, 255, 255, 0.14); color: #cbd5e1; }
      .dark .agy-lib-chip.active { background: #0284c7; border-color: #38bdf8; color: #fff; }
      .agy-lib-rchip {
        font-size: 10.5px;
        padding: 1px 7px;
        border-radius: 999px;
        border: 1px solid rgba(15, 23, 42, 0.14);
        background: transparent;
        color: #475569;
        cursor: pointer;
        white-space: nowrap;
        display: inline-flex;
        align-items: center;
        gap: 3px;
        opacity: .5;
        text-decoration: line-through;
      }
      .agy-lib-rchip.active {
        opacity: 1;
        text-decoration: none;
        border-color: rgba(2, 132, 199, 0.5);
        background: rgba(2, 132, 199, 0.10);
        color: #0369a1;
        font-weight: 600;
      }
      .agy-lib-rchip b { font-weight: 700; }
      .agy-lib-rchip i { font-style: normal; opacity: .7; font-size: 9.5px; }
      .dark .agy-lib-rchip { border-color: rgba(255, 255, 255, 0.16); color: #cbd5e1; }
      .dark .agy-lib-rchip.active { color: #7dd3fc; background: rgba(2, 132, 199, 0.18); }
      .agy-lib-input {
        font-size: 11.5px;
        padding: 4px 8px;
        border-radius: 6px;
        border: 1px solid rgba(15, 23, 42, 0.14);
        background: rgba(255, 255, 255, 0.8);
        color: inherit;
        outline: none;
        min-width: 0;
      }
      .agy-lib-input:focus { border-color: #0284c7; }
      .dark .agy-lib-input { border-color: rgba(255, 255, 255, 0.16); background: rgba(255, 255, 255, 0.06); }
      .agy-lib-scroll { max-height: 372px; overflow-y: auto; padding-right: 2px; }
      .agy-lib-in-modal {
        display: flex !important;
        flex-direction: column !important;
        height: 100% !important;
        max-height: 100% !important;
        min-height: 0 !important;
        overflow: hidden !important;
        padding: 14px 20px 8px !important;
        box-sizing: border-box !important;
      }
      .agy-lib-in-modal .agy-lib-root {
        display: flex !important;
        flex-direction: column !important;
        height: 100% !important;
        min-height: 0 !important;
        overflow: hidden !important;
        flex: 1 1 0 !important;
      }
      .agy-lib-in-modal .agy-lib-scroll {
        flex: 1 1 0 !important;
        min-height: 0 !important;
        max-height: none !important;
        height: auto !important;
        overflow-y: auto !important;
        overflow-x: hidden !important;
        padding-right: 4px !important;
      }
      .agy-lib-in-modal .agy-lib-pagination {
        flex-shrink: 0 !important;
        margin-top: 6px !important;
        padding: 8px 4px 4px !important;
        border-top: 1px solid rgba(15, 23, 42, 0.08);
      }
      .dark .agy-lib-in-modal .agy-lib-pagination,
      .theme-dark .agy-lib-in-modal .agy-lib-pagination {
        border-top-color: rgba(255, 255, 255, 0.08);
      }
      .agy-lib-scroll::-webkit-scrollbar { width: 6px; }
      .agy-lib-scroll::-webkit-scrollbar-thumb { background: rgba(100, 116, 139, 0.35); border-radius: 3px; }
      .agy-lib-suggest-item {
        transition: background .15s ease, border-color .15s ease, transform .12s ease;
      }
      .agy-lib-suggest-item:hover {
        transform: translateY(-1px);
        box-shadow: 0 2px 8px rgba(245, 158, 11, 0.15);
      }
      .agy-lib-pagination {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 5px;
        margin-top: 10px;
        padding: 6px 4px 2px;
        flex-wrap: wrap;
        user-select: none;
      }
      .agy-lib-page-info {
        font-size: 11px;
        color: #64748b;
        margin-right: 6px;
        white-space: nowrap;
      }
      .dark .agy-lib-page-info, .theme-dark .agy-lib-page-info {
        color: #94a3b8;
      }
      .agy-lib-page-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 28px;
        height: 26px;
        padding: 0 7px;
        font-size: 11px;
        border-radius: 6px;
        border: 1px solid rgba(15, 23, 42, 0.12);
        background: rgba(255, 255, 255, 0.7);
        color: #475569;
        cursor: pointer;
        transition: all 0.15s ease;
      }
      .agy-lib-page-btn:hover:not(:disabled) {
        background: rgba(2, 132, 199, 0.12);
        border-color: rgba(2, 132, 199, 0.45);
        color: #0284c7;
      }
      .agy-lib-page-btn.active {
        background: #0284c7;
        border-color: #0284c7;
        color: #ffffff;
        font-weight: 600;
        cursor: default;
        box-shadow: 0 2px 6px rgba(2, 132, 199, 0.28);
      }
      .agy-lib-page-btn:disabled {
        opacity: 0.35;
        cursor: not-allowed;
        pointer-events: none;
      }
      .dark .agy-lib-page-btn {
        border-color: rgba(255, 255, 255, 0.14);
        background: rgba(255, 255, 255, 0.05);
        color: #cbd5e1;
      }
      .dark .agy-lib-page-btn:hover:not(:disabled) {
        background: rgba(2, 132, 199, 0.2);
        border-color: #38bdf8;
        color: #38bdf8;
      }
      .dark .agy-lib-page-btn.active {
        background: #0284c7;
        border-color: #38bdf8;
        color: #ffffff;
      }
      .agy-lib-page-ellipsis {
        font-size: 11px;
        color: #94a3b8;
        padding: 0 2px;
        user-select: none;
      }
      .agy-lib-page-jump {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 11px;
        color: #64748b;
        margin-left: 6px;
      }
      .dark .agy-lib-page-jump {
        color: #94a3b8;
      }
      .agy-lib-page-jump-input {
        width: 44px;
        height: 24px;
        padding: 0 4px;
        text-align: center;
        font-size: 11px;
        border-radius: 4px;
        border: 1px solid rgba(15, 23, 42, 0.14);
        background: rgba(255, 255, 255, 0.85);
        color: inherit;
        outline: none;
      }
      .agy-lib-page-jump-input:focus {
        border-color: #0284c7;
      }
      .dark .agy-lib-page-jump-input {
        border-color: rgba(255, 255, 255, 0.16);
        background: rgba(255, 255, 255, 0.08);
      }
    `;
    const host = document.head || document.documentElement;
    if (isNew && host) host.appendChild(style);
  }

    // ---------------- 原生系统目录选择器 ----------------
  async function pickDirectory(title = '选择 Wallpaper Engine 素材库根目录') {
    // 1. 首选 Antigravity 宿主原生 Electron 弹窗（已暴露 dialog.showOpenDialog）
    if (window.dialog && typeof window.dialog.showOpenDialog === 'function') {
      try {
        const p = await window.dialog.showOpenDialog();
        if (p && typeof p === 'string') return p;
        if (Array.isArray(p) && p.length > 0) return p[0];
      } catch (err) {
        console.warn('[agy-lib] window.dialog.showOpenDialog warning:', err);
      }
    }

    // 2. 备选：Sidecar 原生系统弹窗接口
    try {
      const res = await fetch(`${apiBase()}/api/wallpaper-library/pick-directory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
        signal: AbortSignal.timeout(120000)
      });
      const data = await res.json();
      if (data && data.ok && data.path) {
        return data.path;
      }
    } catch (err) {
      console.warn('[agy-lib] sidecar pick-directory warning:', err);
    }

    return null;
  }

  // ---------------- 渲染骨架 ----------------
  function renderShell() {
    if (!state.container) return;
    const L = t();
    const inModal = state.container.classList.contains("agy-lib-in-modal") || !!state.container.closest(".agy-modal-container");

    const headerHtml = inModal ? "" : `
        <div class="flex justify-between items-start gap-3" id="agy-lib-header-inner">
          <div class="flex flex-col gap-0.5 min-w-0">
            <div class="flex items-center gap-1.5 flex-wrap">
              <span class="text-xs font-medium">${L.title}</span>
              <span class="text-[10px] px-1.5 py-0.2 rounded bg-violet-500/15 text-violet-500 border border-violet-500/30 font-mono">ZERO-COPY</span>
            </div>
            <span class="text-[11px] text-muted-foreground opacity-70">${L.desc}</span>
          </div>
          <button type="button" id="agy-lib-refresh" class="text-[11px] px-2 py-1 rounded border border-border bg-secondary/30 hover:bg-secondary/60 cursor-pointer shrink-0">${L.refresh}</button>
        </div>
    `;

    const pathRowRefreshBtn = inModal ? `
      <button type="button" id="agy-lib-refresh" class="text-[11px] px-2.5 py-1 rounded border border-border bg-secondary/30 hover:bg-secondary/60 cursor-pointer shrink-0 whitespace-nowrap transition-colors">${L.refresh}</button>
    ` : "";

    state.container.innerHTML = `
      <div class="agy-lib-root flex flex-col gap-2">
        ${headerHtml}
        <div class="agy-lib-top-bar flex flex-col gap-2 shrink-0">
          <div class="flex items-center gap-1.5">
            <input type="text" id="agy-lib-path" class="agy-lib-input flex-1" placeholder="${L.pathPlaceholder}" spellcheck="false">
            <button type="button" id="agy-lib-mount-root" class="text-[11px] px-2.5 py-1 rounded border border-sky-500/40 text-sky-500 bg-sky-500/10 hover:bg-sky-500/20 cursor-pointer shrink-0 whitespace-nowrap transition-colors">${L.mountRoot}</button>
            <button type="button" id="agy-lib-mount-single" class="text-[11px] px-2.5 py-1 rounded border border-teal-500/40 text-teal-500 bg-teal-500/10 hover:bg-teal-500/20 cursor-pointer shrink-0 whitespace-nowrap transition-colors">${L.mountSingle}</button>
            ${pathRowRefreshBtn}
          </div>

          <div id="agy-lib-toast" class="text-[11px] px-2 py-1.5 rounded border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300" style="display:none;"></div>
          <div id="agy-lib-suggest" class="text-[11px] px-2.5 py-2 rounded-lg border border-amber-500/35 bg-amber-500/10 text-amber-600 dark:text-amber-300 flex-col gap-1.5" style="display:none;"></div>
          <div id="agy-lib-status" class="text-[11px] text-muted-foreground opacity-80 leading-relaxed"></div>

          <div id="agy-lib-toolbar" class="flex items-center gap-1.5 flex-wrap" style="display:none;">
            ${state.target === 'boot' ? `
              <button type="button" class="agy-lib-chip active" data-lib-filter="video">🎬 视频类素材 (推荐)</button>
              <span class="text-[11px] text-amber-500/90 font-medium ml-1">💡 这里真优化不动了，先只用视频当做开屏动画吧</span>
            ` : `
              <button type="button" class="agy-lib-chip active" data-lib-filter="all">${L.filterAll}</button>
              <button type="button" class="agy-lib-chip" data-lib-filter="video">${L.filterVideo}</button>
              <button type="button" class="agy-lib-chip" data-lib-filter="web">${L.filterWeb}</button>
              <button type="button" class="agy-lib-chip" data-lib-filter="scene">${L.filterScene}</button>
            `}
            <span class="text-[10px] text-muted-foreground opacity-60 ml-1">${L.ratingLabel}</span>
            <span id="agy-lib-ratings" class="flex items-center gap-1"></span>
            <input type="text" id="agy-lib-search" class="agy-lib-input ml-auto" style="width:128px;" placeholder="${L.searchPlaceholder}" spellcheck="false">
          </div>
        </div>

        <div id="agy-lib-scroll" class="agy-lib-scroll" style="display:none;">
          <div id="agy-lib-grid" class="agy-lib-grid"></div>
          <div id="agy-lib-empty" class="text-[11px] text-muted-foreground opacity-70 text-center py-4" style="display:none;"></div>
        </div>

        <div id="agy-lib-pagination" class="agy-lib-pagination" style="display:none;"></div>
      </div>
    `;
    bindShellEvents();
    syncPathInput();
    renderRatings();
    renderStatus();
    renderGrid();
    if (!libCfg().libraryPath && state.detectCandidates.length && (!state.list || !state.list.length)) {
      showSuggest(t().suggest, true);
    }
  }

    function bindShellEvents() {
    const btnRefresh = document.getElementById('agy-lib-refresh');
    const btnRoot = document.getElementById('agy-lib-mount-root');
    const btnSingle = document.getElementById('agy-lib-mount-single');
    const inputPath = document.getElementById('agy-lib-path');
    const inputSearch = document.getElementById('agy-lib-search');

    if (btnRefresh) {
      btnRefresh.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        load({ force: true });
      };
    }

    if (btnRoot) {
      btnRoot.onclick = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        btnRoot.disabled = true;
        const origText = btnRoot.textContent;
        btnRoot.textContent = '⏳ 正在选择...';
        try {
          const picked = await pickDirectory(t().pickRootTitle);
          if (picked) {
            const inputPathEl = document.getElementById('agy-lib-path');
            if (inputPathEl) inputPathEl.value = picked;
            state.libraryPath = picked;
            const cfg = readCfg();
            if (!cfg.features) cfg.features = {};
            if (!cfg.features.externalWallpaperLibrary) cfg.features.externalWallpaperLibrary = {};
            cfg.features.externalWallpaperLibrary.libraryPath = picked;
            saveCfg(cfg);
            await load({ path: picked, mount: true, force: true });
            notify(t().mountSuccess || '素材库挂载成功');
          }
        } finally {
          btnRoot.disabled = false;
          btnRoot.textContent = origText;
        }
      };
    }

    if (btnSingle) {
      btnSingle.onclick = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        btnSingle.disabled = true;
        const origText = btnSingle.textContent;
        btnSingle.textContent = '⏳ 正在选择...';
        try {
          const picked = await pickDirectory(t().pickSingleTitle);
          if (picked) {
            await importFolder(picked);
          }
        } finally {
          btnSingle.disabled = false;
          btnSingle.textContent = origText;
        }
      };
    }

    if (inputPath) {
      inputPath.onkeydown = (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const typed = (inputPath.value || '').trim();
          if (typed) {
            state.libraryPath = typed;
            const cfg = readCfg();
            if (!cfg.features) cfg.features = {};
            if (!cfg.features.externalWallpaperLibrary) cfg.features.externalWallpaperLibrary = {};
            cfg.features.externalWallpaperLibrary.libraryPath = typed;
            saveCfg(cfg);
            load({ path: typed, mount: true, force: true });
          }
        }
      };
    }

    if (inputSearch) {
      inputSearch.oninput = () => {
        state.keyword = (inputSearch.value || '').trim().toLowerCase();
        state.currentPage = 1;
        state.limit = PAGE_SIZE;
        renderGrid();
      };
    }

    state.container.querySelectorAll('[data-lib-filter]').forEach(btn => {
      btn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        state.filter = btn.getAttribute('data-lib-filter') || 'all';
        state.currentPage = 1;
        state.limit = PAGE_SIZE;
        state.container.querySelectorAll('[data-lib-filter]').forEach(b => {
          if (b === btn) b.classList.add('active');
          else b.classList.remove('active');
        });
        renderGrid();
      };
    });
  }

  // ---------------- 分级筛选渲染 ----------------
  function renderRatings() {
    const box = document.getElementById('agy-lib-ratings');
    if (!box) return;
    const L = t();
    const counts = ratingCounts();
    const defs = [
      { key: 'everyone', short: 'G', name: L.ratingG, count: counts.everyone },
      { key: 'questionable', short: 'PG-13', name: L.ratingPG, count: counts.questionable },
      { key: 'mature', short: 'R-18', name: L.ratingR18, count: counts.mature }
    ];
    box.innerHTML = defs.map(d => {
      const included = !state.excludedRatings.has(d.key);
      return `<button type="button" class="agy-lib-rchip${included ? ' active' : ''}" data-lib-rating="${d.key}" title="${escapeAttr(L.ratingChipTitle(d.name, included))}"><b>${d.short}</b>${escapeHtml(d.name)}<i>${d.count}</i></button>`;
    }).join('');
    box.querySelectorAll('[data-lib-rating]').forEach(btn => {
      btn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const key = btn.getAttribute('data-lib-rating');
        if (state.excludedRatings.has(key)) state.excludedRatings.delete(key);
        else state.excludedRatings.add(key);
        state.currentPage = 1;
        state.limit = PAGE_SIZE;
        renderRatings();
        renderStatus();
        renderGrid();
      };
    });
  }

  // ---------------- 数据加载 ----------------
  async function load(options = {}) {
    if (state.loading) return;
    const configured = libCfg().libraryPath || '';
    const targetPath = options.path || configured || state.libraryPath || '';

    state.loading = true;
    state.error = '';
    renderStatus(t().scanning);

    try {
      const params = new URLSearchParams();
      if (options.path) params.set('path', options.path);
      if (options.mount) params.set('mount', '1');
      if (options.force) params.set('force', '1');
      const url = `${apiBase()}/api/wallpaper-library/scan${params.toString() ? '?' + params.toString() : ''}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
      const data = await res.json();

      if (!data.ok) {
        state.error = data.error || t().scanFailed;
        state.list = [];
        state.stats = null;
        renderStatus();
        renderGrid();
        if (options.mount) showSuggest(data.error);
        return;
      }

      state.list = Array.isArray(data.wallpapers) ? data.wallpapers : [];
      state.stats = data.stats || null;
      state.filtered = Array.isArray(data.filtered) ? data.filtered : [];
      state.libraryPath = data.libraryPath || data.root || targetPath;
      state.loadedOnce = true;

      // 成功挂载后将路径持久化到前端全局配置
      if (options.mount && state.libraryPath) {
        const cfg = readCfg();
        if (!cfg.features) cfg.features = {};
        if (!cfg.features.externalWallpaperLibrary) cfg.features.externalWallpaperLibrary = {};
        if (cfg.features.externalWallpaperLibrary.libraryPath !== state.libraryPath) {
          cfg.features.externalWallpaperLibrary.libraryPath = state.libraryPath;
          saveCfg(cfg);
        }
      }

      if (state.ctx && typeof state.ctx.onLibraryLoaded === 'function') {
        try { state.ctx.onLibraryLoaded(state.list, state.stats); } catch (_) {}
      }

      await detectIfNeeded();
      renderRatings();
      renderStatus();
      renderGrid();
      syncPathInput();

      if (!state.list.length) showSuggest(t().libEmptyTip, true);
      else hideSuggest();
    } catch (err) {
      state.error = `${t().scanFailed}：${err.message}`;
      renderStatus();
    } finally {
      state.loading = false;
    }
  }

  async function importFolder(folderPath) {
    if (!folderPath) return;
    try {
      const res = await fetch(`${apiBase()}/api/wallpaper-library/import-folder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderPath, mount: true })
      });
      const data = await res.json();
      if (data.ok && data.wallpaper) {
        const exists = state.list.find(w => normalizeKey(w.folderPath) === normalizeKey(data.wallpaper.folderPath));
        if (!exists) state.list.unshift(data.wallpaper);
        state.loadedOnce = true;
        renderRatings();
        renderStatus();
        renderGrid();
      } else {
        showSuggest(data.error || t().mountFailed, true);
      }
    } catch (err) {
      showSuggest(`${t().mountFailed}：${err.message}`, true);
    }
  }

  async function detectIfNeeded(force = false) {
    if (state.detected && !force) return;
    state.detected = true;
    try {
      const res = await fetch(`${apiBase()}/api/wallpaper-library/detect`, { signal: AbortSignal.timeout(8000) });
      const data = await res.json();
      if (data && data.ok && Array.isArray(data.candidates)) {
        state.detectCandidates = data.candidates;
        const configured = libCfg().libraryPath || state.libraryPath || '';
        if (!configured && state.detectCandidates.length && (!state.list || !state.list.length)) {
          showSuggest(t().suggest, true);
        }
      }
    } catch (_) {}
  }

  // ---------------- 状态与推荐提示 ----------------
  function renderStatus(text) {
    const el = document.getElementById('agy-lib-status');
    if (!el) return;
    const L = t();

    if (text) {
      el.textContent = text;
      el.className = 'text-[11px] text-sky-500 font-medium';
      return;
    }

    if (state.error) {
      el.textContent = `❌ ${state.error}`;
      el.className = 'text-[11px] text-rose-500 font-medium';
      return;
    }

    const configured = libCfg().libraryPath || state.libraryPath || '';
    if (!configured) {
      el.textContent = L.empty;
      el.className = 'text-[11px] text-muted-foreground opacity-75';
      return;
    }

    if (!state.loadedOnce) {
      el.textContent = `${L.notMounted} · ${configured}`;
      el.className = 'text-[11px] text-muted-foreground opacity-75';
      return;
    }

    const stats = state.stats || { byType: {} };
    const parts = [L.status(state.list.length, stats.byType || {})];
    if (state.filtered.length) parts.push(L.filtered(state.filtered.length));
    const ratingHidden = state.list.filter(w => state.excludedRatings.has(w.rating)).length;
    if (ratingHidden > 0) parts.push(L.hiddenByRating(ratingHidden));
    el.textContent = parts.join(' · ');
    el.className = 'text-[11px] text-emerald-600 dark:text-emerald-400 font-medium';
  }

    function showSuggest(message, withCandidates = false) {
    const box = document.getElementById('agy-lib-suggest');
    if (!box) return;
    const L = t();
    const candidates = state.detectCandidates;
    let html = `<div class="font-semibold text-[11.5px]">${escapeHtml(message || L.suggest)}</div>`;
    if (withCandidates && candidates && candidates.length) {
      html += candidates.slice(0, 3).map(c => `
        <div class="agy-lib-suggest-item flex items-center justify-between gap-2.5 p-1.5 px-2.5 rounded-md bg-amber-500/10 hover:bg-amber-500/25 border border-amber-500/30 transition-all cursor-pointer" data-lib-use="${encodeURIComponent(c.path)}" title="点击立即挂载此素材库">
          <div class="flex items-center gap-1.5 truncate flex-1 min-w-0 pointer-events-none">
            <span class="text-sm shrink-0">📂</span>
            <span class="font-medium text-amber-700 dark:text-amber-200">${escapeHtml(c.label)}</span>
            <span class="opacity-75 text-[10.5px] shrink-0">（${c.count} 款）</span>
            <span class="opacity-50 text-[10px] font-mono truncate ml-1">${escapeHtml(c.path)}</span>
          </div>
          <button type="button" class="agy-lib-use-btn text-[11px] font-medium px-2.5 py-0.5 rounded border border-amber-500/50 bg-amber-500/20 hover:bg-amber-500/40 text-amber-700 dark:text-amber-200 cursor-pointer shrink-0 transition-all">${L.use}</button>
        </div>
      `).join('');
    }
    box.innerHTML = html;
    box.style.display = 'flex';

    box.querySelectorAll('[data-lib-use]').forEach(item => {
      item.onclick = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const p = decodeURIComponent(item.getAttribute('data-lib-use') || '');
        if (!p) return;

        const btn = item.querySelector('.agy-lib-use-btn') || item;
        const origText = btn.textContent;
        btn.textContent = '⏳ 挂载中...';
        item.style.pointerEvents = 'none';

        const input = document.getElementById('agy-lib-path');
        if (input) input.value = p;

        state.libraryPath = p;
        const cfg = readCfg();
        if (!cfg.features) cfg.features = {};
        if (!cfg.features.externalWallpaperLibrary) cfg.features.externalWallpaperLibrary = {};
        cfg.features.externalWallpaperLibrary.libraryPath = p;
        saveCfg(cfg);

        try {
          await load({ path: p, mount: true, force: true });
          hideSuggest();
          notify(t().mountSuccess || `已成功挂载素材库：${p}`);
        } catch (err) {
          btn.textContent = origText;
          item.style.pointerEvents = 'auto';
          showSuggest(`${t().mountFailed}：${err.message}`, true);
        }
      };
    });
  }

  function hideSuggest() {
    const box = document.getElementById('agy-lib-suggest');
    if (box) box.style.display = 'none';
  }

  function syncPathInput() {
    const input = document.getElementById('agy-lib-path');
    if (!input) return;
    const configured = libCfg().libraryPath || '';
    if (document.activeElement !== input) {
      input.value = configured || state.libraryPath || '';
    }
  }

  // ---------------- 资产网格 ----------------
  function filteredList() {
    let list = state.list;
    // 关键策略：开屏素材库模式下，仅保留视频类素材，直接屏蔽场景与网页类素材！
    if (state.target === 'boot') {
      list = list.filter(w => w.type === 'video');
    } else if (state.filter !== 'all') {
      list = list.filter(w => w.type === state.filter);
    }
    if (state.excludedRatings.size) {
      list = list.filter(w => !state.excludedRatings.has(w.rating));
    }
    if (state.keyword) {
      list = list.filter(w => {
        const hay = `${w.title || ''} ${w.id || ''} ${w.folderName || ''}`.toLowerCase();
        return hay.includes(state.keyword);
      });
    }
    return list;
  }

  function activeKeys() {
    const cfg = readCfg();
    const dw = cfg.features?.dynamicWallpaper || {};
    const boot = cfg.features?.bootAnimationConfig || {};
    return {
      wall: dw.enabled === true && dw.wallpaperDir ? normalizeKey(dw.wallpaperDir) : '',
      boot: cfg.features?.bootAnimation === true && boot.wallpaperDir ? normalizeKey(boot.wallpaperDir) : ''
    };
  }

  // 增量同步已有卡片的选中态与按钮，绝不销毁已有 DOM 与图片，彻底根除闪现！
  function syncCardStates() {
    const grid = document.getElementById('agy-lib-grid');
    if (!grid) return;
    const act = activeKeys();
    const L = t();
    const wallOn = isWallpaperEnabled();
    const bootOn = isBootEnabled();

    const cards = grid.querySelectorAll('[data-lib-card]');
    if (!cards || !cards.length) return;

    cards.forEach(card => {
      const folderPath = card.getAttribute('data-lib-card');
      const key = normalizeKey(folderPath);
      const isWall = !!act.wall && act.wall === key;
      const isBoot = !!act.boot && act.boot === key;
      const isBoth = isWall && isBoot;

      const targetClass = `agy-lib-card${isBoth ? ' is-both' : (isWall ? ' is-wall' : (isBoot ? ' is-boot' : ''))}`;
      if (card.className !== targetClass) {
        card.className = targetClass;
      }

      let statesWrap = card.querySelector('.agy-lib-states');
      const stateTags = [];
      if (isWall) stateTags.push(`<span class="agy-lib-state-tag agy-lib-state-wall">${L.activeWall}</span>`);
      if (isBoot) stateTags.push(`<span class="agy-lib-state-tag agy-lib-state-boot">${L.activeBoot}</span>`);
      const targetStateHtml = stateTags.join('');

      if (!statesWrap && targetStateHtml) {
        const thumb = card.querySelector('.agy-lib-thumb');
        if (thumb) {
          statesWrap = document.createElement('div');
          statesWrap.className = 'agy-lib-states';
          thumb.appendChild(statesWrap);
        }
      }
      if (statesWrap) {
        if (targetStateHtml) {
          if (statesWrap.innerHTML !== targetStateHtml) statesWrap.innerHTML = targetStateHtml;
          statesWrap.style.display = 'flex';
        } else {
          statesWrap.style.display = 'none';
        }
      }

      const actionsWrap = card.querySelector('.agy-lib-actions');
      if (actionsWrap) {
        const btnWall = actionsWrap.querySelector('[data-lib-apply="wallpaper"]');
        if (btnWall) {
          btnWall.style.display = wallOn ? 'inline-block' : 'none';
          btnWall.disabled = isWall;
          btnWall.textContent = isWall ? L.inUse : L.setWallpaper;
          if (isWall) btnWall.classList.add('is-in-use'); else btnWall.classList.remove('is-in-use');
        }
        const btnBoot = actionsWrap.querySelector('[data-lib-apply="boot"]');
        if (btnBoot) {
          const w = state.list.find(item => normalizeKey(item.folderPath) === key);
          const isVideo = w ? w.type === 'video' : false;
          btnBoot.style.display = (bootOn && isVideo) ? 'inline-block' : 'none';
          btnBoot.disabled = isBoot;
          btnBoot.textContent = isBoot ? L.inUse : L.setBoot;
          if (isBoot) btnBoot.classList.add('is-in-use'); else btnBoot.classList.remove('is-in-use');
        }
      }
    });
  }

  let lastRenderSig = '';
  // 静态冻结动图第一帧：杜绝素材库多张动图同时闪烁晃动，悬停时平滑恢复动效预览
  function freezeGifThumbs(container) {
    if (!container) return;
    const gifImgs = container.querySelectorAll('img[data-is-gif="true"]');
    gifImgs.forEach(img => {
      const parent = img.parentElement;
      if (!parent || parent.querySelector('canvas.agy-lib-freeze-canvas')) return;
      const doFreeze = () => {
        if (parent.querySelector('canvas.agy-lib-freeze-canvas')) return;
        const w = img.naturalWidth || 300;
        const h = img.naturalHeight || 200;
        if (w <= 0 || h <= 0) return;
        const canvas = document.createElement('canvas');
        canvas.className = 'agy-lib-freeze-canvas';
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        try {
          ctx.drawImage(img, 0, 0, w, h);
          parent.appendChild(canvas);
        } catch (_) {}
      };
      if (img.complete && img.naturalWidth > 0) {
        doFreeze();
      } else {
        img.addEventListener('load', doFreeze, { once: true });
      }
    });
  }

  function renderPagination(container, totalCount, totalPages, scrollEl) {
    if (!container) return;
    const L = t();
    const hasAny = state.list.length > 0;
    if (!hasAny || totalCount === 0 || totalPages <= 1) {
      if (hasAny && totalCount > 0 && totalPages === 1) {
        container.innerHTML = `<span class="agy-lib-page-info">${escapeHtml(L.pageInfo(1, 1, totalCount))}</span>`;
        container.style.display = 'flex';
      } else {
        container.style.display = 'none';
      }
      return;
    }

    container.style.display = 'flex';
    const cur = state.currentPage;

    // 智能页码按钮分布
    const pageButtons = [];
    const maxButtons = 7;
    if (totalPages <= maxButtons) {
      for (let i = 1; i <= totalPages; i++) pageButtons.push(i);
    } else {
      pageButtons.push(1);
      let left = Math.max(2, cur - 1);
      let right = Math.min(totalPages - 1, cur + 1);
      if (cur <= 3) {
        right = 4;
      } else if (cur >= totalPages - 2) {
        left = totalPages - 3;
      }
      if (left > 2) pageButtons.push('...');
      for (let i = left; i <= right; i++) pageButtons.push(i);
      if (right < totalPages - 1) pageButtons.push('...');
      pageButtons.push(totalPages);
    }

    const pagesHtml = pageButtons.map(p => {
      if (p === '...') {
        return `<span class="agy-lib-page-ellipsis">…</span>`;
      }
      const isCur = p === cur;
      return `<button type="button" class="agy-lib-page-btn${isCur ? ' active' : ''}" data-lib-page="${p}" ${isCur ? 'disabled' : ''}>${p}</button>`;
    }).join('');

    container.innerHTML = `
      <span class="agy-lib-page-info">${escapeHtml(L.pageInfo(cur, totalPages, totalCount))}</span>
      <button type="button" class="agy-lib-page-btn" data-lib-page="1" ${cur <= 1 ? 'disabled' : ''} title="${escapeAttr(L.pageFirst)}">${L.pageFirst}</button>
      <button type="button" class="agy-lib-page-btn" data-lib-page="${cur - 1}" ${cur <= 1 ? 'disabled' : ''} title="${escapeAttr(L.pagePrev)}">${L.pagePrev}</button>
      ${pagesHtml}
      <button type="button" class="agy-lib-page-btn" data-lib-page="${cur + 1}" ${cur >= totalPages ? 'disabled' : ''} title="${escapeAttr(L.pageNext)}">${L.pageNext}</button>
      <button type="button" class="agy-lib-page-btn" data-lib-page="${totalPages}" ${cur >= totalPages ? 'disabled' : ''} title="${escapeAttr(L.pageLast)}">${L.pageLast}</button>
      <span class="agy-lib-page-jump">
        ${L.pageJump}
        <input type="number" min="1" max="${totalPages}" class="agy-lib-page-jump-input" value="${cur}">
        ${L.pageUnit}
      </span>
    `;

    const gotoPage = (p) => {
      const target = Math.max(1, Math.min(totalPages, Number(p) || 1));
      if (target !== state.currentPage) {
        state.currentPage = target;
        if (scrollEl) scrollEl.scrollTop = 0;
        renderGrid();
      }
    };

    container.querySelectorAll('[data-lib-page]').forEach(btn => {
      btn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const p = parseInt(btn.getAttribute('data-lib-page'), 10);
        if (p) gotoPage(p);
      };
    });

    const jumpInput = container.querySelector('.agy-lib-page-jump-input');
    if (jumpInput) {
      jumpInput.onkeydown = (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          gotoPage(jumpInput.value);
        }
      };
      jumpInput.onblur = () => {
        gotoPage(jumpInput.value);
      };
    }
  }

  function renderGrid() {
    const grid = document.getElementById('agy-lib-grid');
    const scroll = document.getElementById('agy-lib-scroll');
    const toolbar = document.getElementById('agy-lib-toolbar');
    const paginationEl = document.getElementById('agy-lib-pagination');
    const emptyEl = document.getElementById('agy-lib-empty');
    if (!grid) return;

    const L = t();
    const wallOn = isWallpaperEnabled();
    const bootOn = isBootEnabled();
    const all = filteredList();
    const totalCount = all.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

    if (state.currentPage > totalPages) state.currentPage = totalPages;
    if (state.currentPage < 1) state.currentPage = 1;

    const startIndex = (state.currentPage - 1) * PAGE_SIZE;
    const visible = all.slice(startIndex, startIndex + PAGE_SIZE);
    const hasAny = state.list.length > 0;

    if (scroll) scroll.style.display = hasAny ? 'block' : 'none';
    if (toolbar) toolbar.style.display = hasAny ? 'flex' : 'none';
    if (emptyEl) {
      const showEmpty = hasAny && all.length === 0;
      emptyEl.style.display = showEmpty ? 'block' : 'none';
      if (showEmpty) emptyEl.textContent = L.noMatch;
    }

    // 核心脏检查：若过滤条件、查询词、页码和卡片数未改变，仅更新已有卡片的状态与按钮，绝不重新渲染 innerHTML！
    const curSig = `${state.filter}|${state.keyword}|${state.currentPage}|${PAGE_SIZE}|${visible.length}|${Array.from(state.excludedRatings).sort().join(',')}`;
    const curCardCount = grid.querySelectorAll('[data-lib-card]').length;
    if (curSig === lastRenderSig && curCardCount === visible.length) {
      syncCardStates();
      renderPagination(paginationEl, totalCount, totalPages, scroll);
      return;
    }
    lastRenderSig = curSig;

    const act = activeKeys();

    grid.innerHTML = visible.map(w => {
      const key = normalizeKey(w.folderPath);
      const isWall = !!act.wall && act.wall === key;
      const isBoot = !!act.boot && act.boot === key;
      const isBoth = isWall && isBoot;
      const cover = w.previewUrl ? absoluteUrl(w.previewUrl) : '';
      const meta = [];
      if (w.author) meta.push(`${L.author}: ${escapeHtml(w.author)}`);
      if (w.size) meta.push(fmtSize(w.size));
      if (!meta.length && w.description) meta.push(escapeHtml(w.description.slice(0, 40)));

      const cardClass = `agy-lib-card${isBoth ? ' is-both' : (isWall ? ' is-wall' : (isBoot ? ' is-boot' : ''))}`;
      const stateTags = [];
      if (isWall) stateTags.push(`<span class="agy-lib-state-tag agy-lib-state-wall">${L.activeWall}</span>`);
      if (isBoot) stateTags.push(`<span class="agy-lib-state-tag agy-lib-state-boot">${L.activeBoot}</span>`);

      const actionBtns = [];
      if (wallOn && state.target !== 'boot') {
        actionBtns.push(`<button type="button" class="agy-lib-btn agy-lib-btn-wall${isWall ? ' is-in-use' : ''}" data-lib-apply="wallpaper" ${isWall ? 'disabled' : ''}>${isWall ? L.inUse : L.setWallpaper}</button>`);
      }
      // 关键策略：开屏动画只支持视频类素材，非视频素材绝不提供“设为开屏”按钮！
      const isVideo = w.type === 'video';
      if (bootOn && isVideo) {
        actionBtns.push(`<button type="button" class="agy-lib-btn agy-lib-btn-boot${isBoot ? ' is-in-use' : ''}" data-lib-apply="boot" ${isBoot ? 'disabled' : ''}>${isBoot ? L.inUse : L.setBoot}</button>`);
      }

      const isGif = !!(cover && cover.toLowerCase().includes('.gif'));
      return `
        <div class="${cardClass}" data-lib-card="${escapeAttr(w.folderPath)}">
          <div class="agy-lib-thumb">
            ${cover
              ? `<img src="${escapeAttr(cover)}" loading="lazy" decoding="async" alt="${escapeAttr(w.title)}" crossorigin="anonymous" ${isGif ? 'data-is-gif="true"' : ''} onerror="this.style.display='none'">`
              : `<div class="agy-lib-thumb-empty">${L.noPreview}</div>`}
            <span class="${typeBadgeClass(w.type)}">${typeLabel(w.type)}</span>
            ${isGif ? '<span class="agy-lib-gif-badge">GIF</span>' : ''}
            ${stateTags.length ? `<div class="agy-lib-states">${stateTags.join('')}</div>` : ''}
          </div>
          <div class="agy-lib-body">
            <div class="agy-lib-title" title="${escapeAttr(w.title)}">${escapeHtml(w.title)}</div>
            <div class="agy-lib-meta">${meta.join(' · ') || escapeHtml(w.id)}</div>
            ${actionBtns.length ? `<div class="agy-lib-actions">${actionBtns.join('')}</div>` : ''}
          </div>
        </div>
      `;
    }).join('');

    grid.querySelectorAll('[data-lib-apply]').forEach(btn => {
      btn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (btn.disabled) return;
        const card = btn.closest('[data-lib-card]');
        const folderPath = card ? card.getAttribute('data-lib-card') : '';
        const wallpaper = state.list.find(w => w.folderPath === folderPath);
        if (!wallpaper) return;
        if (btn.getAttribute('data-lib-apply') === 'boot') applyBoot(wallpaper);
        else applyWallpaper(wallpaper);
      };
    });
    freezeGifThumbs(grid);
    renderPagination(paginationEl, totalCount, totalPages, scroll);
  }

  // ---------------- 一键应用 ----------------
  function buildWallpaperPayload(w) {
    const isVideo = w.type === 'video';
    return {
      enabled: true,
      sourceType: w.type,
      wallpaperDir: w.folderPath,
      wallpaperId: w.id || '',
      entryFile: w.entryFile || '',
      previewFile: w.previewFile || '',
      audioFile: w.audioFile || '',
      title: w.title || '',
      videoPath: isVideo && w.entryFile ? `${w.folderPath}/${w.entryFile}` : ''
    };
  }

  function applyWallpaper(w) {
    const cfg = readCfg();
    if (!cfg.features) cfg.features = {};
    cfg.features.dynamicWallpaper = {
      ...(cfg.features.dynamicWallpaper || {}),
      ...buildWallpaperPayload(w)
    };
    saveCfg(cfg);
    if (w.type === 'scene' && w.folderPath) {
      fetch(`${apiBase()}/api/wallpaper-library/scene-poster?folder=${encodeURIComponent(w.folderPath)}`).catch(() => {});
    }
    renderGrid();
    notify(t().applied);
  }

  function applyBoot(w) {
    if (w.type !== 'video') {
      notify('开屏动画目前仅支持视频类素材，这里真优化不动啦！');
      return;
    }
    const cfg = readCfg();
    if (!cfg.features) cfg.features = {};
    const normVidPath = w.entryFile ? `${w.folderPath}/${w.entryFile}`.replace(/\\/g, '/') : '';
    const normDirPath = w.folderPath ? w.folderPath.replace(/\\/g, '/') : '';
    cfg.features.bootAnimationConfig = {
      ...(cfg.features.bootAnimationConfig || {}),
      type: 'video',
      videoPath: normVidPath,
      wallpaperDir: normDirPath,
      previewFile: w.previewFile || '',
      wallpaperTitle: w.title || ''
    };
    cfg.features.bootAnimation = true;
    saveCfg(cfg);
    renderGrid();
    notify(t().bootApplied);
  }

  function notify(text) {
    const el = document.getElementById('agy-lib-toast');
    if (el) {
      el.textContent = `✅ ${text}`;
      el.style.display = 'block';
      clearTimeout(state.toastTimer);
      state.toastTimer = setTimeout(() => { el.style.display = 'none'; }, 3200);
    }
    if (state.ctx && typeof state.ctx.onToast === 'function') {
      try { state.ctx.onToast(text); } catch (_) {}
    }
  }

  // ---------------- 对外接口 ----------------
  const api = {
    init(container, ctx) {
      ensureStyle();
      state.container = container;
      state.ctx = ctx || {};
      state.excludedRatings = getDefaultExcludedRatings();
      state.currentPage = 1;
      renderShell();
      if (isAnyEnabled()) {
        api.ensureLoaded();
      } else {
        detectIfNeeded().then(() => renderStatus());
      }
      return api;
    },
    openModal(ctx) {
      if (ctx) state.ctx = ctx;
      state.target = (ctx && ctx.target === 'boot') ? 'boot' : 'wallpaper';
      state.filter = (state.target === 'boot') ? 'video' : 'all';
      ensureStyle();
      if (!window.__agyModal) return;
      // 每次打开素材库都重置分级筛选：默认只选择所有人，pg13和r18都默认不勾选
      state.excludedRatings = getDefaultExcludedRatings();
      state.currentPage = 1;
      const L = t();
      const modalSubtitle = state.target === 'boot'
        ? '💡 这里真优化不动了，先只用视频当做开屏动画吧（开屏仅支持视频类壁纸，秒开 0 延迟）'
        : L.desc;
      window.__agyModal.open({
        id: 'agy-wallpaper-library-modal',
        title: state.target === 'boot' ? `选择开屏动画视频素材 (ZERO-COPY)` : `${L.title} (ZERO-COPY)`,
        subtitle: modalSubtitle,
        width: '920px',
        height: '84vh',
        render: (bodyEl, modalApi) => {
          bodyEl.classList.add('agy-lib-in-modal');
          state.container = bodyEl;
          lastRenderSig = '';
          renderShell();
          const footer = document.createElement('div');
          footer.className = 'agy-modal-footer';
          footer.innerHTML = `
            <div class="agy-modal-footer-left">
              <span style="font-size:11.5px;opacity:0.7;">💡 点击设置后即刻生效，弹窗保持打开方便连续试看</span>
            </div>
            <button type="button" class="agy-btn-primary" id="agy-lib-modal-done">完成</button>
          `;
          footer.querySelector('#agy-lib-modal-done').addEventListener('click', () => modalApi.close());
          
          if (bodyEl.parentElement && bodyEl.parentElement.classList.contains('agy-modal-container')) {
            bodyEl.parentElement.appendChild(footer);
          } else {
            bodyEl.appendChild(footer);
          }

          if (isAnyEnabled()) {
            api.ensureLoaded();
          } else {
            detectIfNeeded().then(() => renderStatus());
          }
        },
        onClose: () => {
          const host = document.getElementById('agy-wallpaper-library');
          if (host) {
            state.container = host;
          }
        }
      });
    },
    refresh(force = false) {
      return load({ force });
    },
    ensureLoaded(force = false) {
      if (state.loading) return Promise.resolve(state.list);
      if (state.loadedOnce && !force) return Promise.resolve(state.list);
      if (!libCfg().libraryPath) {
        return detectIfNeeded().then(() => {
          if (state.detectCandidates.length) showSuggest(t().suggest, true);
          renderStatus();
          return state.list;
        });
      }
      return load({ force }).then(() => state.list);
    },
    /** 双开关变化时调用：轻量增量同步按钮与选中态，绝不全量重刷卡片 */
    syncMode() {
      syncCardStates();
      renderStatus();
      renderRatings();
      if (isAnyEnabled() && !state.loadedOnce) {
        api.ensureLoaded();
      }
    },
    getList() {
      return state.list;
    },
    getByKey(key) {
      return state.list.find(w => normalizeKey(w.folderPath) === normalizeKey(key)) || null;
    },
    isWallpaperEnabled,
    isBootEnabled,
    applyWallpaper,
    applyBoot,
    rerender() {
      if (!state.container) return;
      lastRenderSig = '';
      renderShell();
      renderStatus();
      renderGrid();
    },
    syncPath() {
      syncPathInput();
      renderStatus();
    }
  };

  window.__agyWallpaperLibrary = api;
})();
