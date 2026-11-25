import { percent, rate, count, elapsed, countdown, resetDate } from './format.mjs';
import { createI18n } from './i18n.js';
import { createTheme } from './theme.js';

const $ = id => document.getElementById(id);
const host = window.antigravity;
const standalone = !host;
if (standalone) document.body.classList.add('standalone');

const TEXTS = {
  'zh-CN': {
    repairTitle: '插件通道状态',
    cdpLabel: '热同步',
    backupLabel: '备份',
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
    sourceType: '素材类型',
    sourceVideo: '内置视频 (Video)',
    sourceScene: '场景素材库 (Scene)',
    selectVideo: '选择壁纸视频',
    selectScene: '选择场景壁纸',
    fitMode: '画面适配',
    fitCover: '填充裁切 (Cover)',
    fitContain: '完整适应 (Contain)',
    fitFill: '拉伸铺满 (Fill)',
    brightness: '亮度',
    contrast: '对比度',
    audioEnable: '背景音频',
    interactionEnable: '鼠标视差与滚轮交互',
    bootTitle: '开机动画',
    bootType: '动效类型',
    bootVideo: '短视频 (Video)',
    bootCode: '代码动效 (Script)',
    selectBootVideo: '启动视频',
    selectBootScript: '动效脚本',
    bootDelay: '自动进入延迟 (秒)',
    libraryTitle: '外部壁纸库',
    pickDir: '选择目录',
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
    yes: '正常',
    no: '未就绪',
    hasBackup: '已有备份',
    noBackup: '无备份',
    ready: '配置已就绪',
    saved: '已保存并同步到窗口',
    saveError: '保存失败：',
    noDir: '未配置目录（点击右上角选择）',
    defaultOption: '默认内置'
  },
  en: {
    repairTitle: 'Plugin Channel',
    cdpLabel: 'Live Sync',
    backupLabel: 'Backup',
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
    sourceType: 'Source Type',
    sourceVideo: 'Built-in Video',
    sourceScene: 'Scene Library',
    selectVideo: 'Wallpaper Video',
    selectScene: 'Scene Wallpaper',
    fitMode: 'Fit Mode',
    fitCover: 'Cover',
    fitContain: 'Contain',
    fitFill: 'Fill',
    brightness: 'Brightness',
    contrast: 'Contrast',
    audioEnable: 'Background Audio',
    interactionEnable: 'Parallax & Wheel Interaction',
    bootTitle: 'Boot Animation',
    bootType: 'Animation Type',
    bootVideo: 'Video',
    bootCode: 'Code Script',
    selectBootVideo: 'Boot Video',
    selectBootScript: 'Boot Script',
    bootDelay: 'Auto-enter Delay (s)',
    libraryTitle: 'External Wallpaper Library',
    pickDir: 'Choose Folder',
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
    yes: 'Online',
    no: 'Offline',
    hasBackup: 'Available',
    noBackup: 'None',
    ready: 'Ready',
    saved: 'Saved & synced',
    saveError: 'Save failed: ',
    noDir: 'No folder configured',
    defaultOption: 'Default'
  }
};

let lang = 'zh-CN';
let config = {};
let assets = { wallpapers: [], bootVideos: [], bootScripts: [], libraryItems: [] };
let saveTimer = null;
let lastLocalSaveAt = 0;
let lastStateSig = '';

const t = key => (TEXTS[lang] || TEXTS['zh-CN'])[key] || key;

const transport = (path, init) => {
  if (host?.fetch) return host.fetch(path, init);
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

function platformName(p) {
  if (p === 'darwin') return 'macOS';
  if (p === 'win32') return 'Windows';
  if (p === 'linux') return 'Linux';
  return p || '—';
}

function localize() {
  for (const el of document.querySelectorAll('[data-t]')) {
    el.textContent = t(el.dataset.t);
  }
  const repairText = $('patch-repair-text');
  const repairSub = $('patch-repair-sub');
  const repairBtn = $('patch-repair-btn');
  if (repairText) repairText.textContent = t('patchMissing');
  if (repairSub) repairSub.textContent = t('patchMissingSub');
  if (repairBtn && !repairBtn.disabled) repairBtn.textContent = t('repairBtn');
}

function fillSelect(selectEl, items, currentVal, getVal, getLabel) {
  if (!selectEl) return;
  const list = Array.isArray(items) ? items : [];
  selectEl.innerHTML = '';
  const def = document.createElement('option');
  def.value = '';
  def.textContent = t('defaultOption');
  selectEl.appendChild(def);
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

function renderPatchStatus(patch) {
  const state = patch?.state || 'unknown';
  const pill = $('patch-state-pill');
  const banner = $('patch-repair-banner');
  $('platform-badge').textContent = platformName(patch?.platform);
  $('meta-cdp').textContent = patch?.cdpAvailable ? t('yes') : t('no');
  $('meta-backup').textContent = patch?.hasBackup ? t('hasBackup') : t('noBackup');

  if (pill) {
    pill.className = 'status-pill ' + (state === 'ok' ? 'ok' : state === 'patch_missing' ? 'warn' : '');
    pill.textContent = state === 'ok' ? t('stateOk') : state === 'patch_missing' ? t('stateMissing') : state === 'not_installed' ? t('stateNotInstalled') : t('stateUnknown');
  }
  if (banner) banner.hidden = state !== 'patch_missing';
}

function renderConfig() {
  const f = config.features || {};
  const dw = f.dynamicWallpaper || {};
  const boot = f.bootAnimationConfig || {};
  const lib = f.externalWallpaperLibrary || {};
  const dash = f.dashboard || {};

  $('cfg-chineseLocalization').checked = f.chineseLocalization !== false;
  $('cfg-chatStyleMode').value = f.chatStyleMode === 'native' ? 'native' : 'bubble';
  $('cfg-dashboardInline').checked = dash.enabled !== false && dash.inlineEnabled !== false;

  const dwOn = dw.enabled === true;
  $('cfg-dw-enabled').checked = dwOn;
  $('wallpaper-options').hidden = !dwOn;

  const dwSource = dw.sourceType || (dw.wallpaperDir ? 'scene' : 'video');
  $('cfg-dw-sourceType').value = dwSource;
  $('dw-video-row').hidden = dwSource !== 'video';
  $('dw-scene-row').hidden = dwSource !== 'scene';

  fillSelect($('cfg-dw-videoPath'), assets.wallpapers, dw.videoPath, i => (typeof i === 'string' ? i : i.name || i.path), i => (typeof i === 'string' ? i : i.name || i.file));
  fillSelect($('cfg-dw-wallpaperDir'), assets.libraryItems, dw.wallpaperDir, i => i.dir || i.path || i.folder, i => i.title || i.name || i.folder);

  $('cfg-dw-fit').value = dw.fit || 'cover';
  const br = Number(dw.brightness ?? 0.85);
  const ct = Number(dw.contrast ?? 1.05);
  $('cfg-dw-brightness').value = String(br);
  $('val-dw-brightness').textContent = br.toFixed(2);
  $('cfg-dw-contrast').value = String(ct);
  $('val-dw-contrast').textContent = ct.toFixed(2);
  $('cfg-dw-audioEnabled').checked = dw.audioEnabled === true;
  $('cfg-dw-interaction').checked = dw.wallpaperInteraction?.enabled !== false;

  const bootOn = f.bootAnimation === true;
  $('cfg-boot-enabled').checked = bootOn;
  $('boot-options').hidden = !bootOn;

  const bootType = boot.type === 'code' ? 'code' : 'video';
  $('cfg-boot-type').value = bootType;
  $('boot-video-row').hidden = bootType !== 'video';
  $('boot-script-row').hidden = bootType !== 'code';

  fillSelect($('cfg-boot-videoPath'), assets.bootVideos, boot.videoPath, i => (typeof i === 'string' ? i : i.name || i.path), i => (typeof i === 'string' ? i : i.name || i.file));
  fillSelect($('cfg-boot-scriptPath'), assets.bootScripts, boot.customCodePath, i => (typeof i === 'string' ? i : i.name || i.path), i => (typeof i === 'string' ? i : i.name || i.file));

  const delay = Number(boot.autoEnterDelay ?? 3);
  $('cfg-boot-delay').value = String(delay);
  $('val-boot-delay').textContent = `${delay}s`;

  const libBox = $('cfg-lib-path');
  libBox.textContent = lib.libraryPath || t('noDir');
  libBox.title = lib.libraryPath || '';
}

function collectConfig() {
  const next = JSON.parse(JSON.stringify(config || {}));
  next.enabled = true;
  next.features = next.features || {};
  const f = next.features;
  const dwEnabled = $('cfg-dw-enabled').checked;
  f.themeStyles = dwEnabled;
  f.chineseLocalization = $('cfg-chineseLocalization').checked;
  f.chatStyleMode = $('cfg-chatStyleMode').value === 'native' ? 'native' : 'bubble';
  f.dashboard = { ...(f.dashboard || {}), enabled: $('cfg-dashboardInline').checked, inlineEnabled: $('cfg-dashboardInline').checked };

  f.dynamicWallpaper = f.dynamicWallpaper || {};
  f.dynamicWallpaper.enabled = $('cfg-dw-enabled').checked;
  f.dynamicWallpaper.sourceType = $('cfg-dw-sourceType').value;
  f.dynamicWallpaper.videoPath = $('cfg-dw-videoPath').value;
  f.dynamicWallpaper.wallpaperDir = $('cfg-dw-wallpaperDir').value;
  f.dynamicWallpaper.fit = $('cfg-dw-fit').value;
  f.dynamicWallpaper.brightness = Number($('cfg-dw-brightness').value);
  f.dynamicWallpaper.contrast = Number($('cfg-dw-contrast').value);
  f.dynamicWallpaper.audioEnabled = $('cfg-dw-audioEnabled').checked;
  f.dynamicWallpaper.wallpaperInteraction = { ...(f.dynamicWallpaper.wallpaperInteraction || {}), enabled: $('cfg-dw-interaction').checked };

  f.bootAnimation = $('cfg-boot-enabled').checked;
  f.bootAnimationConfig = f.bootAnimationConfig || {};
  f.bootAnimationConfig.type = $('cfg-boot-type').value === 'code' ? 'code' : 'video';
  f.bootAnimationConfig.videoPath = $('cfg-boot-videoPath').value;
  f.bootAnimationConfig.customCodePath = $('cfg-boot-scriptPath').value;
  f.bootAnimationConfig.autoEnterDelay = Number($('cfg-boot-delay').value);

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
      $('status-note').textContent = t('saved');
    } catch (err) {
      $('status-note').textContent = `${t('saveError')}${err.message}`;
    }
  };

  clearTimeout(saveTimer);
  if (immediate) return runSave();
  saveTimer = setTimeout(runSave, 180);
}

async function refreshAll(silent = false) {
  if (silent && (saveTimer || Date.now() - lastLocalSaveAt < 1400)) return;
  const btn = $('refresh-button');
  if (!silent) btn?.setAttribute('aria-busy', 'true');
  try {
    const [value, assetData] = await Promise.all([
      apiJson('/api/skin-state'),
      silent ? Promise.resolve(assets) : apiJson('/api/skin-assets').catch(() => assets)
    ]);
    if (silent && (saveTimer || Date.now() - lastLocalSaveAt < 1400)) return;
    const nextSig = JSON.stringify({ config: value.config, patch: value.patchStatus, lang: value.hostLanguage });
    if (silent && nextSig === lastStateSig) return;
    lastStateSig = nextSig;

    if (value.hostLanguage) lang = value.hostLanguage;
    config = value.config || {};
    assets = assetData || assets;
    $('connection-dot').className = 'connection-dot ' + (value.engineOnline ? 'live' : 'stale');
    localize();
    renderPatchStatus(value.patchStatus);
    renderConfig();
    if (!silent) $('status-note').textContent = t('ready');
  } catch (err) {
    $('connection-dot').className = 'connection-dot stale';
    if (!silent) $('status-note').textContent = err.message;
  } finally {
    if (!silent) btn?.removeAttribute('aria-busy');
  }
}

async function triggerRepair(btn) {
  if (!btn) return;
  btn.disabled = true;
  const orig = btn.textContent;
  btn.textContent = t('repairing');
  $('repair-feedback').textContent = '';
  try {
    await apiJson('/api/patch-repair', 'POST');
    $('repair-feedback').textContent = t('repairDone');
  } catch (err) {
    $('repair-feedback').textContent = `${t('repairFail')}${err.message}`;
    btn.disabled = false;
    btn.textContent = orig;
  }
}

function bindEvents() {
  $('refresh-button').addEventListener('click', () => refreshAll(false));
  $('patch-repair-btn').addEventListener('click', () => triggerRepair($('patch-repair-btn')));
  $('force-repair-btn').addEventListener('click', () => triggerRepair($('force-repair-btn')));

  const immediateIds = [
    'cfg-chineseLocalization', 'cfg-chatStyleMode', 'cfg-dashboardInline',
    'cfg-dw-enabled', 'cfg-dw-sourceType', 'cfg-dw-videoPath', 'cfg-dw-wallpaperDir', 'cfg-dw-fit',
    'cfg-dw-audioEnabled', 'cfg-dw-interaction',
    'cfg-boot-enabled', 'cfg-boot-type', 'cfg-boot-videoPath', 'cfg-boot-scriptPath'
  ];
  for (const id of immediateIds) {
    $(id)?.addEventListener('change', () => persistConfig(true));
  }

  $('cfg-dw-brightness').addEventListener('input', e => {
    $('val-dw-brightness').textContent = Number(e.target.value).toFixed(2);
    persistConfig(false);
  });
  $('cfg-dw-contrast').addEventListener('input', e => {
    $('val-dw-contrast').textContent = Number(e.target.value).toFixed(2);
    persistConfig(false);
  });
  $('cfg-boot-delay').addEventListener('input', e => {
    $('val-boot-delay').textContent = `${e.target.value}s`;
    persistConfig(false);
  });

  $('pick-library-btn').addEventListener('click', async () => {
    try {
      const res = await apiJson('/api/skin-pick-library', 'POST');
      if (res?.path) {
        config.features = config.features || {};
        config.features.externalWallpaperLibrary = { ...(config.features.externalWallpaperLibrary || {}), libraryPath: res.path };
        await persistConfig(true);
        await refreshAll();
      }
    } catch (err) {
      $('status-note').textContent = err.message;
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refreshAll(false);
  });
  window.addEventListener('focus', () => refreshAll(false));
  setInterval(() => {
    if (!document.hidden) refreshAll(true);
  }, 1500);
}

try { createTheme?.(); } catch {}
bindEvents();
refreshAll();
