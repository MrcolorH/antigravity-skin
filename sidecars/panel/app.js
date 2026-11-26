import { percent, rate, count, elapsed, countdown, resetDate } from './format.mjs';
import { createI18n } from './i18n.js';
import { createTheme } from './theme.js';

const $ = id => (typeof document !== 'undefined' ? document.getElementById?.(id) : null);
const host = typeof window !== 'undefined' ? (window.antigravity || window.sidecar) : null;
const inFrame = typeof window !== 'undefined' && window.parent && window.parent !== window;
const standalone = !host && !inFrame;
if (standalone && typeof document !== 'undefined' && document.body?.classList) {
  document.body.classList.add('standalone');
}

const TEXTS = {
  'zh-CN': {
    repairTitle: '插件通道状态',
    versionLabel: '当前版本',
    checkUpdate: '检查更新',
    checkingUpdate: '检查中…',
    applyUpdate: '立即更新',
    applyingUpdate: '更新中…',
    upToDate: '已是最新版本',
    updateFound: '发现新版本',
    updateSuccess: '已更新至 v{v}，正在重启引擎…',
    updateFail: '更新失败：',
    checkFail: '检查失败：',
    updateConfirm: '确认立即热更新至 v{v} 吗？\n\n更新将自动下载并部署最新代码，您的配置和壁纸素材会完整保留。',
    forceRepair: '重新修复',
    generalTitle: '界面与交互',
    syncHint: '与「外观」菜单同步',
    chineseLoc: '界面汉化 (中文)',
    chineseLocDesc: '切换界面与看板语言',
    chatStyle: '对话气泡样式',
    chatBubble: '气泡卡片 (Bubble)',
    chatNative: '原生透底 (Native)',
    inlineDash: '对话栏内嵌看板',
    inlineDashDesc: '在输入框旁显示轻量指标条',
    wallpaperTitle: '动态壁纸',
    useWallpaperLib: '使用 Wallpaper 素材库',
    useWallpaperLibDesc: '零拷贝引用本地场景/视频/网页壁纸',
    selectVideo: '选择壁纸视频',
    uploadVideoTip: '支持 MP4 / WebM',
    uploadVideo: '载入新视频',
    currentWallpaper: '当前壁纸',
    browseLibrary: '浏览素材库',
    scenePropsTitle: '场景属性配置',
    resetAuthorDefault: '恢复默认',
    audioEnable: '背景音频',
    audioEnableDesc: '播放场景内嵌氛围音',
    fitMode: '画面适配',
    fitCover: '填充裁切 (Cover)',
    fitAuto: '按素材自动 (Auto)',
    fitBlur: '模糊铺满 (Blur)',
    fitContain: '完整适应 (Contain)',
    fitFill: '拉伸铺满 (Fill)',
    fitPosition: '对齐位置',
    posCenter: '居中 (Center)',
    posTop: '顶部 (Top)',
    posBottom: '底部 (Bottom)',
    posLeft: '左侧 (Left)',
    posRight: '右侧 (Right)',
    posTopLeft: '左上角',
    posTopRight: '右上角',
    posBottomLeft: '左下角',
    posBottomRight: '右下角',
    brightness: '亮度',
    contrast: '对比度',
    dwAdvancedTitle: '渲染性能与交互设置',
    fpsLimit: '渲染帧率 (FPS)',
    fpsUnlimited: '无限制 (0)',
    renderDpr: '渲染精度 (DPR)',
    scenePipeline: '场景渲染模式',
    pipelineDynamic: '实时动态 (WebGL2)',
    pipelineStatic: '静态海报 (省电)',
    interactionEnable: '按键穿透与视差交互',
    modifierKey: '触发修饰键',
    wheelEnable: '穿透时响应滚轮',
    hudEnable: '显示交互状态 HUD',
    resetDisplayDefault: '恢复默认设置',
    bootTitle: '开机动画',
    previewBoot: '预览',
    bootType: '动效类型',
    bootVideo: '短视频 (Video)',
    bootCode: '代码动效 (Script)',
    useBootLib: '使用 Wallpaper 素材库',
    useBootLibDesc: '从素材库选择视频类开屏',
    selectBootVideo: '启动视频',
    currentBoot: '当前开屏',
    selectBootScript: '动效脚本',
    uploadScriptTip: '支持 JS 动效脚本',
    uploadScript: '载入脚本',
    bootDelay: '自动进入延迟 (0s=纯手动)',
    bootAdvancedTitle: '开屏显示与渲染设置',
    bootBrightness: '开屏亮度',
    bootContrast: '开屏对比度',
    libraryTitle: '外部壁纸库',
    detectDir: '检测',
    pickDir: '选择目录',
    openBrowser: '浏览素材',
    filterAll: '全部',
    filterScene: '场景',
    filterVideo: '视频',
    filterWeb: '网页',
    ratingLabel: '分级:',
    ratingG: '所有人',
    ratingPG: '辅导级',
    ratingR18: '限制级',
    prevPage: '上一页',
    nextPage: '下一页',
    jumpGo: '跳转',
    pageInfo: (cur, total, count) => `共 ${count} 款 · ${cur}/${total}`,
    patchMissing: '检测到反重力未激活插件通道（首次安装 / 版本已更新）',
    patchMissingSub: '点击下方按钮自动注入并重启客户端即可生效。',
    repairBtn: '立即修复并重启',
    repairing: '正在修复并准备重启…',
    repairDone: '修复指令已发送，请等待客户端重启',
    repairFail: '修复失败：',
    stateOk: '已激活',
    stateMissing: '需要修复',
    stateNotInstalled: '未检测到安装',
    stateUnknown: '未知',
    ready: '配置已就绪',
    saved: '已保存并同步到窗口',
    saveError: '保存失败：',
    noDir: '未配置目录（点击右上角选择或检测）',
    defaultOption: '默认内置',
    notSelected: '尚未选择',
    uploading: '正在上传…',
    uploaded: '上传成功',
    deleted: '已删除',
    previewSent: '已发送预览指令到主窗口',
    libModalWall: '选择动态壁纸',
    libModalBoot: '选择开屏视频',
    libEmpty: '暂无匹配素材',
    libNoCover: '无封面',
    libInUse: '使用中',
    libSearchPlaceholder: '搜索标题 / ID…',
    libSummary: (n, s, v, w) => `已索引 ${n} 款 (场景 ${s} / 视频 ${v} / 网页 ${w})`,
    libNotScanned: '尚未扫描素材库'
  },
  en: {
    repairTitle: 'Plugin Channel',
    versionLabel: 'Version',
    checkUpdate: 'Check Updates',
    checkingUpdate: 'Checking…',
    applyUpdate: 'Update Now',
    applyingUpdate: 'Updating…',
    upToDate: 'Up to date',
    updateFound: 'Update available',
    updateSuccess: 'Updated to v{v}, restarting engine…',
    updateFail: 'Update failed: ',
    checkFail: 'Check failed: ',
    updateConfirm: 'Hot-update to v{v} now?\n\nYour settings and wallpaper assets will be preserved.',
    forceRepair: 'Re-patch',
    generalTitle: 'UI & Interaction',
    syncHint: 'Synced with Appearance',
    chineseLoc: 'Chinese Localization',
    chineseLocDesc: 'Switch UI & dashboard language',
    chatStyle: 'Chat Bubble Style',
    chatBubble: 'Bubble',
    chatNative: 'Native Transparent',
    inlineDash: 'Inline Status Bar',
    inlineDashDesc: 'Show compact metrics beside composer',
    wallpaperTitle: 'Dynamic Wallpaper',
    useWallpaperLib: 'Use Wallpaper Library',
    useWallpaperLibDesc: 'Zero-copy local scene/video/web wallpapers',
    selectVideo: 'Wallpaper Video',
    uploadVideoTip: 'Supports MP4 / WebM',
    uploadVideo: 'Load Video',
    currentWallpaper: 'Current Wallpaper',
    browseLibrary: 'Browse Library',
    scenePropsTitle: 'Scene Properties',
    resetAuthorDefault: 'Reset Defaults',
    audioEnable: 'Background Audio',
    audioEnableDesc: 'Play embedded scene ambient audio',
    fitMode: 'Fit Mode',
    fitCover: 'Cover',
    fitAuto: 'Auto',
    fitBlur: 'Blur Fill',
    fitContain: 'Contain',
    fitFill: 'Fill',
    fitPosition: 'Position',
    posCenter: 'Center',
    posTop: 'Top',
    posBottom: 'Bottom',
    posLeft: 'Left',
    posRight: 'Right',
    posTopLeft: 'Top Left',
    posTopRight: 'Top Right',
    posBottomLeft: 'Bottom Left',
    posBottomRight: 'Bottom Right',
    brightness: 'Brightness',
    contrast: 'Contrast',
    dwAdvancedTitle: 'Performance & Interaction',
    fpsLimit: 'FPS Limit',
    fpsUnlimited: 'Unlimited (0)',
    renderDpr: 'Render Scale (DPR)',
    scenePipeline: 'Scene Pipeline',
    pipelineDynamic: 'Dynamic (WebGL2)',
    pipelineStatic: 'Static Poster',
    interactionEnable: 'Parallax & Key Interaction',
    modifierKey: 'Modifier Key',
    wheelEnable: 'Mouse Wheel on Hold',
    hudEnable: 'Show Interaction HUD',
    resetDisplayDefault: 'Reset Defaults',
    bootTitle: 'Boot Animation',
    previewBoot: 'Preview',
    bootType: 'Animation Type',
    bootVideo: 'Video',
    bootCode: 'Code Script',
    useBootLib: 'Use Wallpaper Library',
    useBootLibDesc: 'Pick a video from Wallpaper Library',
    selectBootVideo: 'Boot Video',
    currentBoot: 'Current Boot',
    selectBootScript: 'Boot Script',
    uploadScriptTip: 'Supports JS scripts',
    uploadScript: 'Load Script',
    bootDelay: 'Auto-enter Delay (0s=Manual)',
    bootAdvancedTitle: 'Boot Display & Rendering',
    bootBrightness: 'Boot Brightness',
    bootContrast: 'Boot Contrast',
    libraryTitle: 'External Wallpaper Library',
    detectDir: 'Detect',
    pickDir: 'Choose Folder',
    openBrowser: 'Browse',
    filterAll: 'All',
    filterScene: 'Scene',
    filterVideo: 'Video',
    filterWeb: 'Web',
    ratingLabel: 'Rating:',
    ratingG: 'Everyone',
    ratingPG: 'PG',
    ratingR18: 'Mature',
    prevPage: 'Prev',
    nextPage: 'Next',
    jumpGo: 'Go',
    pageInfo: (cur, total, count) => `${count} items · ${cur}/${total}`,
    patchMissing: 'Antigravity host patch missing (first install or app updated)',
    patchMissingSub: 'Click below to inject the patch and restart Antigravity.',
    repairBtn: 'Repair & Restart',
    repairing: 'Repairing & restarting…',
    repairDone: 'Repair triggered, waiting for restart…',
    repairFail: 'Repair failed: ',
    stateOk: 'Active',
    stateMissing: 'Needs Repair',
    stateNotInstalled: 'Not Installed',
    stateUnknown: 'Unknown',
    ready: 'Ready',
    saved: 'Saved & synced',
    saveError: 'Save failed: ',
    noDir: 'No folder configured',
    defaultOption: 'Default',
    notSelected: 'Not selected',
    uploading: 'Uploading…',
    uploaded: 'Uploaded',
    deleted: 'Deleted',
    previewSent: 'Boot preview triggered',
    libModalWall: 'Select Dynamic Wallpaper',
    libModalBoot: 'Select Boot Video',
    libEmpty: 'No matching items',
    libNoCover: 'No Preview',
    libInUse: 'In Use',
    libSearchPlaceholder: 'Search title / ID…',
    libSummary: (n, s, v, w) => `${n} items (${s} scene / ${v} video / ${w} web)`,
    libNotScanned: 'Not scanned yet'
  }
};

let lang = 'zh-CN';
let config = {};
let assets = { wallpapers: [], bootVideos: [], bootScripts: [], libraryItems: [] };
let saveTimer = null;
let lastLocalSaveAt = 0;
let lastStateSig = '';
let latestUpdateInfo = null;

// Scene Inspector state
let scenePropsState = { dir: '', wpId: '', meta: null };
let propSaveTimer = null;

// Library Browser state
let libModalState = {
  open: false,
  target: 'wallpaper', // 'wallpaper' | 'boot'
  typeFilter: 'all',
  ratings: new Set(['everyone', 'questionable']),
  query: '',
  page: 1,
  pageSize: 12,
  totalPages: 1,
  candidates: []
};

const t = key => (TEXTS[lang] || TEXTS['zh-CN'])[key] || key;

const transport = (path, init) => {
  if (typeof window !== 'undefined' && window.antigravity?.fetch) return window.antigravity.fetch(path, init);
  return fetch(path, init);
};

async function apiJson(path, method = 'GET', body) {
  const init = { method };
  if (body !== undefined) {
    init.headers = { 'Content-Type': 'application/json' };
    init.body = JSON.stringify(body);
  }
  const res = await transport(path, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

function setNote(msg) {
  const el = $('status-note');
  if (el) el.textContent = msg;
}

function platformName(p) {
  if (p === 'darwin') return 'macOS';
  if (p === 'win32') return 'Windows';
  if (p === 'linux') return 'Linux';
  return p || '—';
}

function localize() {
  if (typeof document === 'undefined') return;
  for (const el of document.querySelectorAll('[data-t]')) {
    el.textContent = t(el.dataset.t);
  }
  const search = $('lib-search-input');
  if (search) search.placeholder = t('libSearchPlaceholder');
  const repairText = $('patch-repair-text');
  const repairSub = $('patch-repair-sub');
  const repairBtn = $('patch-repair-btn');
  if (repairText) repairText.textContent = t('patchMissing');
  if (repairSub) repairSub.textContent = t('patchMissingSub');
  if (repairBtn && !repairBtn.disabled) repairBtn.textContent = t('repairBtn');
}

function fillSelect(selectEl, items, currentVal, getVal, getLabel, includeDefault = true) {
  if (!selectEl) return;
  const list = Array.isArray(items) ? items : [];
  selectEl.innerHTML = '';
  if (includeDefault) {
    const def = document.createElement('option');
    def.value = '';
    def.textContent = t('defaultOption');
    selectEl.appendChild(def);
  }
  for (const item of list) {
    const val = getVal(item);
    if (!val) continue;
    const opt = document.createElement('option');
    opt.value = val;
    opt.textContent = getLabel(item) || val;
    selectEl.appendChild(opt);
  }
  if (currentVal && !Array.from(selectEl.options).some(o => o.value === currentVal)) {
    const extra = document.createElement('option');
    extra.value = currentVal;
    extra.textContent = currentVal.split(/[/\\]/).pop() || currentVal;
    selectEl.appendChild(extra);
  }
  selectEl.value = currentVal || '';
}

function renderPatchStatus(patch, pluginVersion) {
  const state = patch?.state || 'unknown';
  const pill = $('patch-state-pill');
  const banner = $('patch-repair-banner');
  const badge = $('platform-badge');
  if (badge) badge.textContent = platformName(patch?.platform);
  const verPill = $('plugin-version-pill');
  if (verPill && pluginVersion) verPill.textContent = `v${pluginVersion}`;

  if (pill) {
    pill.className = 'status-pill ' + (state === 'ok' ? 'ok' : state === 'patch_missing' ? 'warn' : '');
    pill.textContent = state === 'ok' ? t('stateOk') : state === 'patch_missing' ? t('stateMissing') : state === 'not_installed' ? t('stateNotInstalled') : t('stateUnknown');
  }
  if (banner) banner.hidden = state !== 'patch_missing';
}

function rgbStrToHex(str) {
  if (typeof str !== 'string') return '#ffffff';
  if (str.startsWith('#') && (str.length === 7 || str.length === 4)) return str;
  const parts = str.trim().split(/[\s,]+/).map(Number);
  if (parts.length < 3 || parts.some(n => !Number.isFinite(n))) return '#ffffff';
  const scale = parts.slice(0, 3).some(n => n > 1) ? 1 : 255;
  const toHex = n => Math.max(0, Math.min(255, Math.round(n * scale))).toString(16).padStart(2, '0');
  return `#${toHex(parts[0])}${toHex(parts[1])}${toHex(parts[2])}`;
}

function hexToRgbStr(hex) {
  const clean = String(hex || '#ffffff').replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  if (![r, g, b].every(Number.isFinite)) return '1 1 1';
  return `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)}`;
}

function scheduleSaveProperty(wpId, key, val) {
  if (!wpId) return;
  config.features = config.features || {};
  config.features.dynamicWallpaper = config.features.dynamicWallpaper || {};
  const dw = config.features.dynamicWallpaper;
  dw.wallpaperUserProperties = dw.wallpaperUserProperties || {};
  dw.wallpaperUserProperties[wpId] = dw.wallpaperUserProperties[wpId] || {};
  dw.wallpaperUserProperties[wpId][key] = val;
  lastLocalSaveAt = Date.now();
  clearTimeout(propSaveTimer);
  propSaveTimer = setTimeout(async () => {
    try {
      await apiJson('/api/skin-config', 'POST', config);
      setNote(t('saved'));
    } catch (err) {
      setNote(`${t('saveError')}${err.message}`);
    }
  }, 180);
}

function renderSceneInspector() {
  const section = $('scene-inspector-section');
  const listEl = $('scene-prop-list');
  const countEl = $('scene-prop-count');
  if (!section || !listEl) return;

  const dw = config?.features?.dynamicWallpaper || {};
  const isScene = dw.enabled === true && (dw.sourceType === 'scene' || (!dw.sourceType && dw.wallpaperDir));
  if (!isScene || !dw.wallpaperDir || !scenePropsState.meta || Object.keys(scenePropsState.meta).length === 0) {
    section.hidden = true;
    return;
  }

  section.hidden = false;
  const entries = Object.entries(scenePropsState.meta).sort((a, b) => (Number(a[1].order) || 0) - (Number(b[1].order) || 0));
  if (countEl) countEl.textContent = String(entries.length);

  const wpId = scenePropsState.wpId;
  const userProps = dw.wallpaperUserProperties?.[wpId] || {};
  listEl.innerHTML = '';

  for (const [key, meta] of entries) {
    const val = userProps[key] !== undefined ? userProps[key] : meta.value;
    const labelText = meta.text || key;

    if (meta.type === 'bool') {
      const row = document.createElement('label');
      row.className = 'toggle-row';
      const span = document.createElement('span');
      const strong = document.createElement('strong');
      strong.textContent = labelText;
      span.appendChild(strong);
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = Boolean(val);
      input.addEventListener('change', () => scheduleSaveProperty(wpId, key, input.checked));
      row.append(span, input);
      listEl.appendChild(row);
    } else if (meta.type === 'slider') {
      const min = Number.isFinite(meta.min) ? meta.min : 0;
      const max = Number.isFinite(meta.max) ? meta.max : 100;
      const step = Number.isFinite(meta.step) ? meta.step : 1;
      const prec = Number.isFinite(meta.precision) ? meta.precision : (step < 1 ? 2 : 0);
      const curNum = Number.isFinite(Number(val)) ? Number(val) : min;

      const wrap = document.createElement('div');
      wrap.className = 'slider-row';
      const head = document.createElement('div');
      head.className = 'slider-head';
      const nameSpan = document.createElement('span');
      nameSpan.textContent = labelText;
      const valStrong = document.createElement('strong');
      valStrong.textContent = curNum.toFixed(prec);
      head.append(nameSpan, valStrong);

      const range = document.createElement('input');
      range.type = 'range';
      range.min = String(min);
      range.max = String(max);
      range.step = String(step);
      range.value = String(curNum);
      range.addEventListener('input', () => {
        const nextVal = Number(range.value);
        valStrong.textContent = nextVal.toFixed(prec);
        scheduleSaveProperty(wpId, key, nextVal);
      });
      wrap.append(head, range);
      listEl.appendChild(wrap);
    } else if (meta.type === 'color') {
      const hex = rgbStrToHex(val);
      const row = document.createElement('div');
      row.className = 'inspector-color-row';
      const label = document.createElement('span');
      label.style.fontSize = '11px';
      label.textContent = labelText;
      const right = document.createElement('div');
      right.className = 'inspector-color-wrap';
      const hexSpan = document.createElement('span');
      hexSpan.className = 'inspector-color-hex';
      hexSpan.textContent = hex.toUpperCase();
      const input = document.createElement('input');
      input.type = 'color';
      input.className = 'inspector-color-input';
      input.value = hex;
      input.addEventListener('input', () => {
        hexSpan.textContent = input.value.toUpperCase();
        scheduleSaveProperty(wpId, key, hexToRgbStr(input.value));
      });
      right.append(hexSpan, input);
      row.append(label, right);
      listEl.appendChild(row);
    } else if (meta.type === 'combo') {
      const row = document.createElement('div');
      row.className = 'field-row';
      const label = document.createElement('label');
      label.textContent = labelText;
      const select = document.createElement('select');
      const opts = Array.isArray(meta.options) ? meta.options : [];
      for (const o of opts) {
        const opt = document.createElement('option');
        opt.value = o.value;
        opt.textContent = o.label || o.value;
        select.appendChild(opt);
      }
      select.value = String(val ?? '');
      select.addEventListener('change', () => scheduleSaveProperty(wpId, key, select.value));
      row.append(label, select);
      listEl.appendChild(row);
    } else if (meta.type === 'text') {
      const row = document.createElement('div');
      row.className = 'inspector-text-row';
      const label = document.createElement('label');
      label.textContent = labelText;
      const input = document.createElement('input');
      input.type = 'text';
      input.value = String(val ?? '');
      input.addEventListener('input', () => scheduleSaveProperty(wpId, key, input.value));
      row.append(label, input);
      listEl.appendChild(row);
    }
  }
}

async function syncSceneInspector() {
  const dw = config?.features?.dynamicWallpaper || {};
  const isScene = dw.enabled === true && (dw.sourceType === 'scene' || (!dw.sourceType && dw.wallpaperDir));
  const dir = dw.wallpaperDir || '';
  if (!isScene || !dir) {
    scenePropsState = { dir: '', wpId: '', meta: null };
    renderSceneInspector();
    return;
  }
  const wpId = dw.wallpaperId || String(dir).split(/[/\\]/).filter(Boolean).pop() || '';
  if (scenePropsState.dir === dir && scenePropsState.meta) {
    renderSceneInspector();
    return;
  }
  try {
    const res = await apiJson(`/api/skin-lib-properties?folder=${encodeURIComponent(dir)}`);
    if (res?.ok && res.hasProperties && res.properties && Object.keys(res.properties).length > 0) {
      scenePropsState = { dir, wpId: res.id || wpId, meta: res.properties };
    } else {
      scenePropsState = { dir, wpId, meta: null };
    }
  } catch {
    scenePropsState = { dir, wpId, meta: null };
  }
  renderSceneInspector();
}

function renderLibrarySummary() {
  const sumEl = $('lib-summary-text');
  if (!sumEl) return;
  const items = Array.isArray(assets.libraryItems) ? assets.libraryItems : [];
  if (items.length === 0) {
    sumEl.textContent = t('libNotScanned');
    return;
  }
  let s = 0, v = 0, w = 0;
  for (const it of items) {
    if (it.type === 'scene') s++;
    else if (it.type === 'video') v++;
    else if (it.type === 'web') w++;
  }
  sumEl.textContent = t('libSummary')(items.length, s, v, w);
}

function renderConfig() {
  const f = config.features || {};
  const dw = f.dynamicWallpaper || {};
  const wi = dw.wallpaperInteraction || {};
  const boot = f.bootAnimationConfig || {};
  const lib = f.externalWallpaperLibrary || {};
  const dash = f.dashboard || {};

  if ($('cfg-chineseLocalization')) $('cfg-chineseLocalization').checked = f.chineseLocalization !== false;
  if ($('cfg-chatStyleMode')) $('cfg-chatStyleMode').value = f.chatStyleMode === 'native' ? 'native' : 'bubble';
  if ($('cfg-dashboardInline')) $('cfg-dashboardInline').checked = dash.enabled !== false && dash.inlineEnabled !== false;

  const dwOn = dw.enabled === true;
  if ($('cfg-dw-enabled')) $('cfg-dw-enabled').checked = dwOn;
  if ($('wallpaper-options')) $('wallpaper-options').hidden = !dwOn;

  const dwUseLib = lib.wallpaperEnabled === true || (lib.wallpaperEnabled === undefined && !!dw.wallpaperDir);
  if ($('cfg-dw-useLibrary')) $('cfg-dw-useLibrary').checked = dwUseLib;
  if ($('dw-builtin-section')) $('dw-builtin-section').hidden = dwUseLib;
  if ($('dw-library-section')) $('dw-library-section').hidden = !dwUseLib;

  fillSelect($('cfg-dw-videoPath'), assets.wallpapers, dw.videoPath, i => (typeof i === 'string' ? i : i.path || i.name), i => (typeof i === 'string' ? i : i.name || i.file));
  const delWallBtn = $('dw-delete-video-btn');
  if (delWallBtn) delWallBtn.disabled = !dw.videoPath || dw.videoPath.startsWith('agy-lib:');

  const dwTitleEl = $('dw-active-title');
  const dwBadgeEl = $('dw-active-type-badge');
  if (dwTitleEl) {
    dwTitleEl.textContent = dw.title || (dw.wallpaperDir ? String(dw.wallpaperDir).split(/[/\\]/).filter(Boolean).pop() : t('notSelected'));
  }
  if (dwBadgeEl) {
    if (dw.wallpaperDir && dw.sourceType) {
      dwBadgeEl.textContent = dw.sourceType;
      dwBadgeEl.hidden = false;
    } else {
      dwBadgeEl.hidden = true;
    }
  }

  const audioRow = $('dw-audio-row');
  if (audioRow) audioRow.hidden = !(dwUseLib && (dw.sourceType === 'scene' || dw.audioFile));
  if ($('cfg-dw-audioEnabled')) $('cfg-dw-audioEnabled').checked = dw.audioEnabled === true;

  if ($('cfg-dw-fit')) $('cfg-dw-fit').value = dw.fit || 'cover';
  if ($('cfg-dw-fitPosition')) $('cfg-dw-fitPosition').value = dw.fitPosition || 'center';
  const br = Number(dw.brightness ?? 0.85);
  const ct = Number(dw.contrast ?? 1.05);
  if ($('cfg-dw-brightness')) $('cfg-dw-brightness').value = String(br);
  if ($('val-dw-brightness')) $('val-dw-brightness').textContent = br.toFixed(2);
  if ($('cfg-dw-contrast')) $('cfg-dw-contrast').value = String(ct);
  if ($('val-dw-contrast')) $('val-dw-contrast').textContent = ct.toFixed(2);

  if ($('cfg-dw-fps')) $('cfg-dw-fps').value = String(Number.isFinite(dw.fps) ? dw.fps : 60);
  if ($('cfg-dw-renderDpr')) $('cfg-dw-renderDpr').value = Number(dw.renderDpr ?? 1.0).toFixed(Number(dw.renderDpr ?? 1.0) % 1 === 0 ? 1 : 2);
  if ($('cfg-dw-sceneRenderer')) $('cfg-dw-sceneRenderer').value = dw.sceneRenderer === 'static' ? 'static' : 'dynamic';
  if ($('cfg-dw-interaction')) $('cfg-dw-interaction').checked = wi.enabled !== false;
  if ($('cfg-dw-modifierKey')) $('cfg-dw-modifierKey').value = wi.modifierKey || 'alt';
  if ($('cfg-dw-enableWheel')) $('cfg-dw-enableWheel').checked = wi.enableWheel !== false;
  if ($('cfg-dw-showHud')) $('cfg-dw-showHud').checked = wi.showHud !== false;

  const bootOn = f.bootAnimation === true;
  if ($('cfg-boot-enabled')) $('cfg-boot-enabled').checked = bootOn;
  if ($('boot-options')) $('boot-options').hidden = !bootOn;

  const bootType = boot.type === 'code' ? 'code' : 'video';
  if ($('cfg-boot-type')) $('cfg-boot-type').value = bootType;
  if ($('boot-video-row')) $('boot-video-row').hidden = bootType !== 'video';
  if ($('boot-script-row')) $('boot-script-row').hidden = bootType !== 'code';

  const bootUseLib = lib.bootEnabled === true;
  if ($('cfg-boot-useLibrary')) $('cfg-boot-useLibrary').checked = bootUseLib;
  if ($('boot-builtin-section')) $('boot-builtin-section').hidden = bootUseLib;
  if ($('boot-library-section')) $('boot-library-section').hidden = !bootUseLib;

  fillSelect($('cfg-boot-videoPath'), assets.bootVideos, boot.videoPath, i => (typeof i === 'string' ? i : i.path || i.name), i => (typeof i === 'string' ? i : i.name || i.file));
  const delBootVidBtn = $('boot-delete-video-btn');
  if (delBootVidBtn) delBootVidBtn.disabled = !boot.videoPath || boot.videoPath.startsWith('agy-lib:');

  if ($('boot-active-title')) {
    $('boot-active-title').textContent = boot.wallpaperTitle || boot.title || (boot.wallpaperDir ? String(boot.wallpaperDir).split(/[/\\]/).filter(Boolean).pop() : t('notSelected'));
  }

  fillSelect($('cfg-boot-scriptPath'), assets.bootScripts, boot.customCodePath || 'assets/scripts/default-boot.js', i => (typeof i === 'string' ? i : i.path || i.name), i => (typeof i === 'string' ? i : i.name || i.file), false);
  const delScriptBtn = $('boot-delete-script-btn');
  if (delScriptBtn) {
    const sVal = $('cfg-boot-scriptPath')?.value || '';
    delScriptBtn.disabled = !sVal || sVal === 'assets/scripts/default-boot.js' || sVal.endsWith('/default-boot.js');
  }

  const delay = Number(boot.autoEnterDelay ?? 3);
  if ($('cfg-boot-delay')) $('cfg-boot-delay').value = String(delay);
  if ($('val-boot-delay')) $('val-boot-delay').textContent = delay === 0 ? '0s' : `${delay}s`;

  if ($('cfg-boot-fit')) $('cfg-boot-fit').value = boot.fit || 'cover';
  if ($('cfg-boot-fitPosition')) $('cfg-boot-fitPosition').value = boot.fitPosition || 'center';
  const bBr = Number(boot.brightness ?? 1.0);
  const bCt = Number(boot.contrast ?? 1.0);
  if ($('cfg-boot-brightness')) $('cfg-boot-brightness').value = String(bBr);
  if ($('val-boot-brightness')) $('val-boot-brightness').textContent = bBr.toFixed(2);
  if ($('cfg-boot-contrast')) $('cfg-boot-contrast').value = String(bCt);
  if ($('val-boot-contrast')) $('val-boot-contrast').textContent = bCt.toFixed(2);
  if ($('cfg-boot-fps')) $('cfg-boot-fps').value = String(Number.isFinite(boot.fps) ? boot.fps : 60);
  if ($('cfg-boot-renderDpr')) $('cfg-boot-renderDpr').value = Number(boot.renderDpr ?? 1.0).toFixed(Number(boot.renderDpr ?? 1.0) % 1 === 0 ? 1 : 2);

  const libBox = $('cfg-lib-path');
  if (libBox) {
    libBox.textContent = lib.libraryPath || t('noDir');
    libBox.title = lib.libraryPath || '';
  }

  renderLibrarySummary();
  syncSceneInspector();
}

function collectConfig() {
  const next = JSON.parse(JSON.stringify(config || {}));
  next.enabled = true;
  next.features = next.features || {};
  const f = next.features;
  const dwEnabled = $('cfg-dw-enabled')?.checked === true;
  f.themeStyles = dwEnabled;
  f.chineseLocalization = $('cfg-chineseLocalization')?.checked !== false;
  f.language = f.chineseLocalization ? 'zh-CN' : 'en';
  f.chatStyleMode = $('cfg-chatStyleMode')?.value === 'native' ? 'native' : 'bubble';
  f.dashboard = { ...(f.dashboard || {}), enabled: $('cfg-dashboardInline')?.checked !== false, inlineEnabled: $('cfg-dashboardInline')?.checked !== false };

  f.externalWallpaperLibrary = f.externalWallpaperLibrary || {};
  const dwUseLib = $('cfg-dw-useLibrary')?.checked === true;
  const bootUseLib = $('cfg-boot-useLibrary')?.checked === true;
  f.externalWallpaperLibrary.wallpaperEnabled = dwUseLib;
  f.externalWallpaperLibrary.bootEnabled = bootUseLib;

  f.dynamicWallpaper = f.dynamicWallpaper || {};
  f.dynamicWallpaper.enabled = dwEnabled;
  if (!dwUseLib) {
    f.dynamicWallpaper.sourceType = 'video';
    f.dynamicWallpaper.videoPath = $('cfg-dw-videoPath')?.value || '';
  } else if (!f.dynamicWallpaper.sourceType) {
    f.dynamicWallpaper.sourceType = f.dynamicWallpaper.wallpaperDir ? 'scene' : 'video';
  }
  f.dynamicWallpaper.fit = $('cfg-dw-fit')?.value || 'cover';
  f.dynamicWallpaper.fitPosition = $('cfg-dw-fitPosition')?.value || 'center';
  f.dynamicWallpaper.brightness = Number($('cfg-dw-brightness')?.value ?? 0.85);
  f.dynamicWallpaper.contrast = Number($('cfg-dw-contrast')?.value ?? 1.05);
  f.dynamicWallpaper.fps = Number($('cfg-dw-fps')?.value ?? 60);
  f.dynamicWallpaper.renderDpr = Number($('cfg-dw-renderDpr')?.value ?? 1.0);
  f.dynamicWallpaper.sceneRenderer = $('cfg-dw-sceneRenderer')?.value === 'static' ? 'static' : 'dynamic';
  f.dynamicWallpaper.audioEnabled = $('cfg-dw-audioEnabled')?.checked === true;
  f.dynamicWallpaper.wallpaperInteraction = {
    ...(f.dynamicWallpaper.wallpaperInteraction || {}),
    enabled: $('cfg-dw-interaction')?.checked !== false,
    modifierKey: $('cfg-dw-modifierKey')?.value || 'alt',
    enableWheel: $('cfg-dw-enableWheel')?.checked !== false,
    showHud: $('cfg-dw-showHud')?.checked !== false
  };

  f.bootAnimation = $('cfg-boot-enabled')?.checked === true;
  f.bootAnimationConfig = f.bootAnimationConfig || {};
  f.bootAnimationConfig.type = $('cfg-boot-type')?.value === 'code' ? 'code' : 'video';
  if (!bootUseLib) {
    f.bootAnimationConfig.videoPath = $('cfg-boot-videoPath')?.value || '';
  }
  f.bootAnimationConfig.customCodePath = $('cfg-boot-scriptPath')?.value || 'assets/scripts/default-boot.js';
  f.bootAnimationConfig.autoEnterDelay = Number($('cfg-boot-delay')?.value ?? 3);
  f.bootAnimationConfig.fit = $('cfg-boot-fit')?.value || 'cover';
  f.bootAnimationConfig.fitPosition = $('cfg-boot-fitPosition')?.value || 'center';
  f.bootAnimationConfig.brightness = Number($('cfg-boot-brightness')?.value ?? 1.0);
  f.bootAnimationConfig.contrast = Number($('cfg-boot-contrast')?.value ?? 1.0);
  f.bootAnimationConfig.fps = Number($('cfg-boot-fps')?.value ?? 60);
  f.bootAnimationConfig.renderDpr = Number($('cfg-boot-renderDpr')?.value ?? 1.0);

  return next;
}

async function persistConfig(immediate = false) {
  config = collectConfig();
  lastLocalSaveAt = Date.now();
  lang = config?.features?.chineseLocalization === false ? 'en' : 'zh-CN';
  localize();
  renderConfig();

  const runSave = async () => {
    saveTimer = null;
    lastLocalSaveAt = Date.now();
    try {
      await apiJson('/api/skin-config', 'POST', config);
      lastStateSig = JSON.stringify({ config, patchState: $('patch-state-pill')?.textContent });
      setNote(t('saved'));
    } catch (err) {
      setNote(`${t('saveError')}${err.message}`);
    }
  };

  clearTimeout(saveTimer);
  if (immediate) return runSave();
  saveTimer = setTimeout(runSave, 180);
}

async function refreshAll(silent = false) {
  if (silent && (saveTimer || propSaveTimer || Date.now() - lastLocalSaveAt < 1400)) return;
  const btn = $('refresh-button');
  if (!silent) btn?.setAttribute('aria-busy', 'true');
  try {
    const [value, assetData] = await Promise.all([
      apiJson('/api/skin-state'),
      silent ? Promise.resolve(assets) : apiJson('/api/skin-assets').catch(() => assets)
    ]);
    if (silent && (saveTimer || propSaveTimer || Date.now() - lastLocalSaveAt < 1400)) return;
    const nextSig = JSON.stringify({ config: value.config, patch: value.patchStatus, lang: value.hostLanguage });
    if (silent && nextSig === lastStateSig) return;
    lastStateSig = nextSig;

    if (value.hostLanguage) lang = value.hostLanguage;
    config = value.config || {};
    assets = assetData || assets;
    const dot = $('connection-dot');
    if (dot) dot.className = 'connection-dot ' + (value.engineOnline ? 'live' : 'stale');
    localize();
    renderPatchStatus(value.patchStatus, value.pluginVersion);
    renderConfig();
    if (libModalState.open) renderLibGrid();
    if (!silent) setNote(t('ready'));
  } catch (err) {
    const dot = $('connection-dot');
    if (dot) dot.className = 'connection-dot stale';
    if (!silent) setNote(err.message);
  } finally {
    if (!silent) btn?.removeAttribute('aria-busy');
  }
}

async function triggerRepair(btn) {
  if (!btn) return;
  btn.disabled = true;
  const orig = btn.textContent;
  btn.textContent = t('repairing');
  const fb = $('repair-feedback');
  if (fb) { fb.hidden = false; fb.textContent = ''; }
  try {
    await apiJson('/api/patch-repair', 'POST');
    if (fb) fb.textContent = t('repairDone');
  } catch (err) {
    if (fb) fb.textContent = `${t('repairFail')}${err.message}`;
    btn.disabled = false;
    btn.textContent = orig;
  }
}

async function handleFileUpload(file, target) {
  if (!file) return;
  setNote(t('uploading'));
  try {
    const buf = await file.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    const dataBase64 = btoa(binary);
    const res = await apiJson('/api/skin-upload', 'POST', { target, name: file.name, dataBase64 });
    if (res?.relPath) {
      config.features = config.features || {};
      if (target === 'wallpaper') {
        config.features.dynamicWallpaper = { ...(config.features.dynamicWallpaper || {}), enabled: true, sourceType: 'video', videoPath: res.relPath };
      } else if (target === 'boot-video') {
        config.features.bootAnimation = true;
        config.features.bootAnimationConfig = { ...(config.features.bootAnimationConfig || {}), type: 'video', videoPath: res.relPath };
      } else if (target === 'boot-script') {
        config.features.bootAnimation = true;
        config.features.bootAnimationConfig = { ...(config.features.bootAnimationConfig || {}), type: 'code', customCodePath: res.relPath };
      }
      await apiJson('/api/skin-config', 'POST', config);
      await refreshAll(false);
      setNote(t('uploaded'));
    }
  } catch (err) {
    setNote(`${t('saveError')}${err.message}`);
  }
}

async function handleDeleteAsset(target, pathVal) {
  if (!pathVal) return;
  try {
    await apiJson('/api/skin-delete-asset', 'POST', { target, path: pathVal });
    config.features = config.features || {};
    if (target === 'wallpaper' && config.features.dynamicWallpaper?.videoPath === pathVal) {
      config.features.dynamicWallpaper.videoPath = '';
    } else if (target === 'boot-video' && config.features.bootAnimationConfig?.videoPath === pathVal) {
      config.features.bootAnimationConfig.videoPath = '';
    } else if (target === 'boot-script' && config.features.bootAnimationConfig?.customCodePath === pathVal) {
      config.features.bootAnimationConfig.customCodePath = 'assets/scripts/default-boot.js';
    }
    await apiJson('/api/skin-config', 'POST', config);
    await refreshAll(false);
    setNote(t('deleted'));
  } catch (err) {
    setNote(`${t('saveError')}${err.message}`);
  }
}

function renderDetectCandidates() {
  const box = $('lib-detect-box');
  if (!box) return;
  const list = libModalState.candidates || [];
  if (list.length === 0) {
    box.hidden = true;
    return;
  }
  box.hidden = false;
  box.innerHTML = '';
  for (const c of list) {
    const p = typeof c === 'string' ? c : c.path;
    if (!p) continue;
    const row = document.createElement('div');
    row.className = 'lib-detect-item';
    const pathSpan = document.createElement('span');
    pathSpan.className = 'lib-detect-path';
    pathSpan.textContent = p;
    pathSpan.title = p;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-xs btn-primary-soft';
    btn.textContent = t('pickDir');
    btn.addEventListener('click', async () => {
      await scanAndMountLibrary(p);
    });
    row.append(pathSpan, btn);
    box.appendChild(row);
  }
}

async function scanAndMountLibrary(dirPath, force = false) {
  try {
    const qs = new URLSearchParams();
    if (dirPath) {
      qs.set('path', dirPath);
      qs.set('mount', '1');
    }
    if (force) qs.set('force', '1');
    const res = await apiJson(`/api/skin-lib-scan?${qs.toString()}`);
    if (res?.wallpapers) {
      assets.libraryItems = res.wallpapers;
      if (res.libraryPath) {
        config.features = config.features || {};
        config.features.externalWallpaperLibrary = { ...(config.features.externalWallpaperLibrary || {}), libraryPath: res.libraryPath };
      }
      libModalState.candidates = [];
      renderDetectCandidates();
      renderConfig();
      renderLibGrid();
    }
  } catch (err) {
    setNote(err.message);
  }
}

function renderLibGrid() {
  const grid = $('lib-grid');
  const empty = $('lib-empty');
  const pag = $('lib-pagination');
  const pageInfo = $('lib-page-info');
  if (!grid) return;

  const isBoot = libModalState.target === 'boot';
  const items = Array.isArray(assets.libraryItems) ? assets.libraryItems : [];
  const q = libModalState.query.trim().toLowerCase();

  const filtered = items.filter(item => {
    const type = item.type || 'unknown';
    if (isBoot && type !== 'video') return false;
    if (!isBoot && libModalState.typeFilter !== 'all' && type !== libModalState.typeFilter) return false;
    const rating = item.rating || 'everyone';
    if (!libModalState.ratings.has(rating)) return false;
    if (q) {
      const hay = `${item.title || ''} ${item.id || ''} ${item.folderName || item.folder || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / libModalState.pageSize));
  libModalState.totalPages = totalPages;
  if (libModalState.page > totalPages) libModalState.page = totalPages;
  if (libModalState.page < 1) libModalState.page = 1;
  const start = (libModalState.page - 1) * libModalState.pageSize;
  const pageItems = filtered.slice(start, start + libModalState.pageSize);

  grid.innerHTML = '';
  if (pageItems.length === 0) {
    if (empty) {
      empty.textContent = t('libEmpty');
      empty.hidden = false;
    }
    if (pag) pag.hidden = true;
    return;
  }
  if (empty) empty.hidden = true;
  if (pag) pag.hidden = false;
  if (pageInfo) pageInfo.textContent = t('pageInfo')(libModalState.page, totalPages, filtered.length);
  if ($('lib-jump-input')) {
    $('lib-jump-input').max = String(totalPages);
    $('lib-jump-input').value = String(libModalState.page);
  }
  if ($('lib-first-btn')) $('lib-first-btn').disabled = libModalState.page <= 1;
  if ($('lib-prev-btn')) $('lib-prev-btn').disabled = libModalState.page <= 1;
  if ($('lib-next-btn')) $('lib-next-btn').disabled = libModalState.page >= totalPages;
  if ($('lib-last-btn')) $('lib-last-btn').disabled = libModalState.page >= totalPages;

  const activeDir = isBoot
    ? config?.features?.bootAnimationConfig?.wallpaperDir
    : config?.features?.dynamicWallpaper?.wallpaperDir;

  for (const item of pageItems) {
    const itemDir = item.folderPath || item.dir || '';
    const itemPreview = item.previewFile || item.preview || '';
    const itemFolder = item.folderName || item.folder || '';
    const card = document.createElement('button');
    card.type = 'button';
    const isActive = Boolean(activeDir && itemDir === activeDir);
    card.className = 'lib-card' + (isActive ? ' is-active' : '');

    const thumb = document.createElement('div');
    thumb.className = 'lib-thumb';
    if (itemPreview && itemDir) {
      const img = document.createElement('img');
      img.loading = 'lazy';
      img.src = `/api/skin-lib-preview?folder=${encodeURIComponent(itemDir)}&file=${encodeURIComponent(itemPreview)}`;
      img.alt = item.title || '';
      thumb.appendChild(img);
    } else {
      const ph = document.createElement('span');
      ph.className = 'lib-thumb-placeholder';
      ph.textContent = t('libNoCover');
      thumb.appendChild(ph);
    }

    const badge = document.createElement('span');
    badge.className = 'lib-card-badge';
    badge.textContent = item.type || 'file';
    thumb.appendChild(badge);

    if (isActive) {
      const activeTag = document.createElement('span');
      activeTag.className = 'lib-card-active-tag';
      activeTag.textContent = t('libInUse');
      thumb.appendChild(activeTag);
    }

    const body = document.createElement('div');
    body.className = 'lib-card-body';
    const title = document.createElement('span');
    title.className = 'lib-card-title';
    title.textContent = item.title || item.id || itemFolder || 'Untitled';
    title.title = title.textContent;
    const meta = document.createElement('span');
    meta.className = 'lib-card-meta';
    meta.textContent = item.id || itemFolder || '';
    body.append(title, meta);

    card.append(thumb, body);
    card.addEventListener('click', () => applyLibraryItem(item));
    grid.appendChild(card);
  }
}

async function applyLibraryItem(item) {
  config.features = config.features || {};
  config.features.externalWallpaperLibrary = config.features.externalWallpaperLibrary || {};
  const itemDir = item.folderPath || item.dir || '';
  const itemEntry = item.entryFile || item.entry || '';
  const itemPreview = item.previewFile || item.preview || '';
  const itemAudio = item.audioFile || item.audio || '';

  if (libModalState.target === 'boot') {
    config.features.bootAnimation = true;
    config.features.externalWallpaperLibrary.bootEnabled = true;
    config.features.bootAnimationConfig = {
      ...(config.features.bootAnimationConfig || {}),
      type: 'video',
      videoPath: itemEntry ? `${itemDir}/${itemEntry}` : '',
      wallpaperDir: itemDir,
      wallpaperTitle: item.title || '',
      previewFile: itemPreview
    };
  } else {
    config.features.themeStyles = true;
    config.features.externalWallpaperLibrary.wallpaperEnabled = true;
    config.features.dynamicWallpaper = {
      ...(config.features.dynamicWallpaper || {}),
      enabled: true,
      sourceType: item.type || 'scene',
      wallpaperDir: itemDir,
      wallpaperId: item.id || '',
      entryFile: itemEntry,
      previewFile: itemPreview,
      audioFile: itemAudio,
      title: item.title || '',
      videoPath: (item.type === 'video' && itemEntry) ? `${itemDir}/${itemEntry}` : ''
    };
  }

  lastLocalSaveAt = Date.now();
  renderConfig();
  closeLibModal();
  try {
    await apiJson('/api/skin-config', 'POST', config);
    setNote(t('saved'));
  } catch (err) {
    setNote(`${t('saveError')}${err.message}`);
  }
}

async function openLibModal(target = 'wallpaper') {
  libModalState.open = true;
  libModalState.target = target;
  libModalState.page = 1;
  libModalState.typeFilter = target === 'boot' ? 'video' : 'all';

  const modal = $('lib-modal');
  const titleEl = $('lib-modal-title');
  const typeRow = $('lib-type-filters');
  if (titleEl) titleEl.textContent = target === 'boot' ? t('libModalBoot') : t('libModalWall');
  if (typeRow) {
    typeRow.hidden = target === 'boot';
    for (const chip of typeRow.querySelectorAll('.filter-chip')) {
      chip.classList.toggle('active', chip.dataset.type === libModalState.typeFilter);
    }
  }
  if (modal) modal.hidden = false;

  if (!assets.libraryItems?.length) {
    const libPath = config?.features?.externalWallpaperLibrary?.libraryPath;
    if (libPath) {
      await scanAndMountLibrary(libPath);
    } else {
      try {
        const res = await apiJson('/api/skin-lib-detect');
        libModalState.candidates = res?.candidates || [];
        renderDetectCandidates();
      } catch {}
    }
  }
  renderLibGrid();
}

function closeLibModal() {
  libModalState.open = false;
  const modal = $('lib-modal');
  if (modal) modal.hidden = true;
}

function bindEvents() {
  $('refresh-button')?.addEventListener('click', () => refreshAll(false));
  $('patch-repair-btn')?.addEventListener('click', () => triggerRepair($('patch-repair-btn')));
  $('force-repair-btn')?.addEventListener('click', () => triggerRepair($('force-repair-btn')));

  $('check-update-btn')?.addEventListener('click', async () => {
    const btn = $('check-update-btn');
    const line = $('update-status-line');
    const pill = $('update-available-pill');
    const applyBtn = $('apply-update-btn');
    if (btn) { btn.disabled = true; btn.textContent = t('checkingUpdate'); }
    try {
      const res = await apiJson('/api/update-check');
      latestUpdateInfo = res;
      if (res?.hasUpdate && res?.latestVersion) {
        if (pill) { pill.textContent = `v${res.latestVersion}`; pill.hidden = false; }
        if (applyBtn) applyBtn.hidden = false;
        if (line) { line.textContent = `${t('updateFound')}: v${res.latestVersion}`; line.className = 'update-status-line ok'; line.hidden = false; }
      } else {
        if (pill) pill.hidden = true;
        if (applyBtn) applyBtn.hidden = true;
        if (line) { line.textContent = t('upToDate'); line.className = 'update-status-line'; line.hidden = false; }
      }
    } catch (err) {
      if (line) { line.textContent = `${t('checkFail')}${err.message}`; line.className = 'update-status-line warn'; line.hidden = false; }
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = t('checkUpdate'); }
    }
  });

  $('apply-update-btn')?.addEventListener('click', async () => {
    const ver = latestUpdateInfo?.latestVersion || '';
    if (typeof confirm === 'function' && !confirm(t('updateConfirm').replace('{v}', ver))) return;
    const btn = $('apply-update-btn');
    const line = $('update-status-line');
    if (btn) { btn.disabled = true; btn.textContent = t('applyingUpdate'); }
    try {
      await apiJson('/api/update-apply', 'POST', latestUpdateInfo || {});
      if (line) { line.textContent = t('updateSuccess').replace('{v}', ver); line.className = 'update-status-line ok'; line.hidden = false; }
    } catch (err) {
      if (line) { line.textContent = `${t('updateFail')}${err.message}`; line.className = 'update-status-line warn'; line.hidden = false; }
      if (btn) { btn.disabled = false; btn.textContent = t('applyUpdate'); }
    }
  });

  const immediateIds = [
    'cfg-chineseLocalization', 'cfg-chatStyleMode', 'cfg-dashboardInline',
    'cfg-dw-enabled', 'cfg-dw-useLibrary', 'cfg-dw-videoPath', 'cfg-dw-fit', 'cfg-dw-fitPosition',
    'cfg-dw-audioEnabled', 'cfg-dw-fps', 'cfg-dw-renderDpr', 'cfg-dw-sceneRenderer',
    'cfg-dw-interaction', 'cfg-dw-modifierKey', 'cfg-dw-enableWheel', 'cfg-dw-showHud',
    'cfg-boot-enabled', 'cfg-boot-type', 'cfg-boot-useLibrary', 'cfg-boot-videoPath', 'cfg-boot-scriptPath',
    'cfg-boot-fit', 'cfg-boot-fitPosition', 'cfg-boot-fps', 'cfg-boot-renderDpr'
  ];
  for (const id of immediateIds) {
    $(id)?.addEventListener('change', () => persistConfig(true));
  }

  $('cfg-dw-brightness')?.addEventListener('input', e => {
    if ($('val-dw-brightness')) $('val-dw-brightness').textContent = Number(e.target.value).toFixed(2);
    persistConfig(false);
  });
  $('cfg-dw-contrast')?.addEventListener('input', e => {
    if ($('val-dw-contrast')) $('val-dw-contrast').textContent = Number(e.target.value).toFixed(2);
    persistConfig(false);
  });
  $('cfg-boot-delay')?.addEventListener('input', e => {
    const v = Number(e.target.value);
    if ($('val-boot-delay')) $('val-boot-delay').textContent = v === 0 ? '0s' : `${v}s`;
    persistConfig(false);
  });
  $('cfg-boot-brightness')?.addEventListener('input', e => {
    if ($('val-boot-brightness')) $('val-boot-brightness').textContent = Number(e.target.value).toFixed(2);
    persistConfig(false);
  });
  $('cfg-boot-contrast')?.addEventListener('input', e => {
    if ($('val-boot-contrast')) $('val-boot-contrast').textContent = Number(e.target.value).toFixed(2);
    persistConfig(false);
  });

  // Upload & Delete built-in assets
  $('dw-upload-video-btn')?.addEventListener('click', () => $('dw-upload-video-file')?.click());
  $('dw-upload-video-file')?.addEventListener('change', e => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (f) handleFileUpload(f, 'wallpaper');
  });
  $('dw-delete-video-btn')?.addEventListener('click', () => handleDeleteAsset('wallpaper', $('cfg-dw-videoPath')?.value));

  $('boot-upload-video-btn')?.addEventListener('click', () => $('boot-upload-video-file')?.click());
  $('boot-upload-video-file')?.addEventListener('change', e => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (f) handleFileUpload(f, 'boot-video');
  });
  $('boot-delete-video-btn')?.addEventListener('click', () => handleDeleteAsset('boot-video', $('cfg-boot-videoPath')?.value));

  $('boot-upload-script-btn')?.addEventListener('click', () => $('boot-upload-script-file')?.click());
  $('boot-upload-script-file')?.addEventListener('change', e => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (f) handleFileUpload(f, 'boot-script');
  });
  $('boot-delete-script-btn')?.addEventListener('click', () => handleDeleteAsset('boot-script', $('cfg-boot-scriptPath')?.value));

  // Boot preview
  $('boot-preview-btn')?.addEventListener('click', async () => {
    try {
      await apiJson('/api/skin-boot-preview', 'POST');
      setNote(t('previewSent'));
    } catch (err) {
      setNote(err.message);
    }
  });

  // Reset display & scene properties defaults
  $('dw-display-reset-btn')?.addEventListener('click', () => {
    config.features = config.features || {};
    const dw = config.features.dynamicWallpaper || {};
    Object.assign(dw, {
      fit: 'cover', fitPosition: 'center', brightness: 0.85, contrast: 1.05,
      fps: 60, renderDpr: 1.0, sceneRenderer: 'dynamic',
      wallpaperInteraction: { enabled: true, modifierKey: 'alt', enableWheel: true, showHud: true }
    });
    config.features.dynamicWallpaper = dw;
    renderConfig();
    persistConfig(true);
  });

  $('boot-display-reset-btn')?.addEventListener('click', () => {
    config.features = config.features || {};
    const boot = config.features.bootAnimationConfig || {};
    Object.assign(boot, {
      fit: 'cover', fitPosition: 'center', brightness: 1.0, contrast: 1.0,
      fps: 60, renderDpr: 1.0, autoEnterDelay: 3
    });
    config.features.bootAnimationConfig = boot;
    renderConfig();
    persistConfig(true);
  });

  $('scene-prop-reset-btn')?.addEventListener('click', async () => {
    const wpId = scenePropsState.wpId;
    if (!wpId || !config?.features?.dynamicWallpaper?.wallpaperUserProperties?.[wpId]) return;
    delete config.features.dynamicWallpaper.wallpaperUserProperties[wpId];
    renderSceneInspector();
    try {
      await apiJson('/api/skin-config', 'POST', config);
      setNote(t('saved'));
    } catch (err) {
      setNote(`${t('saveError')}${err.message}`);
    }
  });

  // Library directory & browser triggers
  $('pick-library-btn')?.addEventListener('click', async () => {
    try {
      const res = await apiJson('/api/skin-pick-library', 'POST');
      if (res?.path) {
        await scanAndMountLibrary(res.path, true);
        await persistConfig(true);
      }
    } catch (err) {
      setNote(err.message);
    }
  });

  $('detect-library-btn')?.addEventListener('click', async () => {
    await openLibModal('wallpaper');
    try {
      const res = await apiJson('/api/skin-lib-detect');
      libModalState.candidates = res?.candidates || [];
      renderDetectCandidates();
    } catch {}
  });

  $('open-wall-lib-btn')?.addEventListener('click', () => openLibModal('wallpaper'));
  $('open-boot-lib-btn')?.addEventListener('click', () => openLibModal('boot'));
  $('open-lib-browser-btn')?.addEventListener('click', () => openLibModal('wallpaper'));
  $('lib-close-btn')?.addEventListener('click', closeLibModal);
  $('lib-refresh-btn')?.addEventListener('click', () => {
    const libPath = config?.features?.externalWallpaperLibrary?.libraryPath;
    if (libPath) scanAndMountLibrary(libPath, true);
  });

  $('lib-search-input')?.addEventListener('input', e => {
    libModalState.query = e.target.value || '';
    libModalState.page = 1;
    renderLibGrid();
  });

  $('lib-type-filters')?.addEventListener('click', e => {
    const btn = e.target.closest?.('.filter-chip');
    if (!btn || !btn.dataset.type) return;
    libModalState.typeFilter = btn.dataset.type;
    libModalState.page = 1;
    for (const c of $('lib-type-filters').querySelectorAll('.filter-chip')) {
      c.classList.toggle('active', c === btn);
    }
    renderLibGrid();
  });

  $('lib-rating-filters')?.addEventListener('click', e => {
    const btn = e.target.closest?.('.filter-chip');
    if (!btn || !btn.dataset.rating) return;
    const r = btn.dataset.rating;
    if (libModalState.ratings.has(r)) libModalState.ratings.delete(r);
    else libModalState.ratings.add(r);
    btn.classList.toggle('active', libModalState.ratings.has(r));
    libModalState.page = 1;
    renderLibGrid();
  });

  const goToPage = (p) => {
    const next = Math.max(1, Math.min(libModalState.totalPages || 1, Number(p) || 1));
    if (next === libModalState.page) return;
    libModalState.page = next;
    renderLibGrid();
    const scroller = typeof document !== 'undefined' ? document.querySelector?.('.lib-grid-scroll') : null;
    if (scroller) scroller.scrollTop = 0;
  };
  $('lib-first-btn')?.addEventListener('click', () => goToPage(1));
  $('lib-prev-btn')?.addEventListener('click', () => goToPage(libModalState.page - 1));
  $('lib-next-btn')?.addEventListener('click', () => goToPage(libModalState.page + 1));
  $('lib-last-btn')?.addEventListener('click', () => goToPage(libModalState.totalPages || 1));
  $('lib-jump-btn')?.addEventListener('click', () => goToPage($('lib-jump-input')?.value));
  $('lib-jump-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') goToPage(e.target.value);
  });

  if (typeof document !== 'undefined') {
    document.addEventListener?.('visibilitychange', () => {
      if (!document.hidden) refreshAll(false);
    });
  }
  if (typeof window !== 'undefined') {
    window.addEventListener?.('focus', () => refreshAll(false));
  }
  if (typeof setInterval === 'function') {
    setInterval(() => {
      if (typeof document !== 'undefined' && !document.hidden) refreshAll(true);
    }, 1500);
  }
}

function initPanel() {
  try { createTheme?.()?.attach?.(document.documentElement); } catch {}
  bindEvents();
  if (typeof fetch === 'function' || host?.fetch) refreshAll();
}

if (typeof document !== 'undefined' && document.readyState !== 'complete' && document.readyState !== 'interactive') {
  document.addEventListener?.('DOMContentLoaded', initPanel, { once: true });
} else {
  initPanel();
}
