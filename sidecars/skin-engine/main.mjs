import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawn, execSync, execFile } from 'node:child_process';
import {
  parseWallpaperFolder,
  scanLibrary,
  detectLibraryCandidates,
  resolveFolderByHint,
  serveLocalFile,
  isSubPath,
  clearScanCache
} from './wallpaper-library.mjs';
import { getScenePoster } from './scene-pkg.mjs';

// 1. 确保启用原生 WebSocket (Node 20+ --experimental-websocket)
if (typeof WebSocket === 'undefined' && !process.env.__AG_WS_SPAWNED) {
  process.env.__AG_WS_SPAWNED = '1';
  const child = spawn(process.execPath, ['--experimental-websocket', fileURLToPath(import.meta.url), ...process.argv.slice(2)], {
    stdio: 'inherit',
    env: process.env
  });
  child.on('exit', (code) => process.exit(code ?? 0));
  process.on('SIGINT', () => child.kill('SIGINT'));
  process.on('SIGTERM', () => child.kill('SIGTERM'));
  process.on('exit', () => child.kill());
} else {


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PLUGIN_ROOT = path.resolve(__dirname, '..', '..');

// 2. 路径定义
const CONFIG_FILE = path.join(PLUGIN_ROOT, 'config', 'config.json');
const DEFAULT_CONFIG_FILE = path.join(PLUGIN_ROOT, 'config.default.json');
const ASSETS_DIR = path.join(PLUGIN_ROOT, 'assets');
const SCRIPTS_DIR = path.join(ASSETS_DIR, 'scripts');
const VIDEOS_DIR = path.join(ASSETS_DIR, 'videos');
const WALLPAPER_VIDEOS_DIR = path.join(VIDEOS_DIR, 'wallpaper');
const BOOT_VIDEOS_DIR = path.join(VIDEOS_DIR, 'boot');

// 确保素材目录完备就绪
for (const dir of [SCRIPTS_DIR, VIDEOS_DIR, WALLPAPER_VIDEOS_DIR, BOOT_VIDEOS_DIR]) {
  if (!fs.existsSync(dir)) {
    try { fs.mkdirSync(dir, { recursive: true }); } catch (_) {}
  }
}

// 自动热重载：当 main.mjs 在磁盘上被更新时，自动退出以触发宿主自动重启生效最新逻辑
try {
  fs.watchFile(__filename, { interval: 1000 }, (curr, prev) => {
    if (curr.mtimeMs !== prev.mtimeMs) {
      console.log('[Skin Engine] main.mjs has been updated on disk. Gracefully exiting to trigger host auto-restart...');
      process.exit(0);
    }
  });
} catch (_) {}

// 活跃 CDP 会话管理集合 (提升至全局作用域供 HTTP 路由与热重载共享访问)
const activeSessions = new Map(); // targetId -> { ws, send, isAttached, checkHealthAndHeal }

function getDevToolsPortPath() {
  const home = os.homedir();
  if (process.platform === 'darwin') {
    return path.join(home, 'Library', 'Application Support', 'Antigravity', 'DevToolsActivePort');
  } else if (process.platform === 'win32') {
    const appdata = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
    return path.join(appdata, 'Antigravity', 'DevToolsActivePort');
  } else {
    const xdgConfig = process.env.XDG_CONFIG_HOME || path.join(home, '.config');
    return path.join(xdgConfig, 'Antigravity', 'DevToolsActivePort');
  }
}

// 3. 配置读写
// 阶段五：媒体铺满策略白名单（与客户端 wallpaper.js 的 FIT_MODES / FIT_POSITIONS 保持一致）
const WALLPAPER_FIT_MODES = new Set(['auto', 'cover', 'contain', 'fill', 'blur']);
const WALLPAPER_FIT_POSITIONS = new Set([
  'center', 'top', 'bottom', 'left', 'right',
  'top left', 'top right', 'bottom left', 'bottom right'
]);

// 默认配置（作为一切旧版本配置的补全基线，确保向后兼容）
function buildDefaultConfig() {
  return {
    enabled: true,
    features: {
      bootAnimation: false,
      bootAnimationConfig: {
        type: 'video',
        customCodePath: '',
        videoPath: '',
        wallpaperDir: '',
        previewFile: '',
        // —— 阶段八：开屏独立几何、调色、性能与时序控制 ——
        fit: 'cover',
        fitPosition: 'center',
        brightness: 1.0,
        contrast: 1.0,
        fps: 60,
        renderDpr: 1.0,
        autoEnterDelay: 3
      },
      themeStyles: false,
      crtScanlines: false,
      chineseLocalization: true,
      dynamicWallpaper: {
        enabled: false,
        sourceType: 'video',
        videoPath: '',
        wallpaperDir: '',
        wallpaperId: '',
        entryFile: '',
        previewFile: '',
        audioFile: '',
        audioEnabled: false,
        title: '',
        brightness: 0.85,
        contrast: 1.05,
        // —— 阶段五/六：媒体铺满策略 ——
        fit: 'auto',
        fitMigrated: true,
        fitPosition: 'center',
        // —— 阶段八：壁纸独立性能与渲染精细控制 ——
        fps: 60,
        renderDpr: 1.0,
        sceneRenderer: 'dynamic',
        sceneScripts: false
      },
      externalWallpaperLibrary: {
        wallpaperEnabled: false,
        bootEnabled: false,
        libraryPath: '',
        autoScan: true,
        mountedFolders: []
      }
    }
  };
}

// 深合并：仅补齐缺失字段，绝不覆盖用户已有配置
function normalizeConfig(raw) {
  const base = buildDefaultConfig();
  if (!raw || typeof raw !== 'object') return base;
  const out = { ...base, ...raw };
  out.features = { ...base.features, ...(raw.features || {}) };
  out.features.dynamicWallpaper = { ...base.features.dynamicWallpaper, ...(raw.features?.dynamicWallpaper || {}) };
  out.features.bootAnimationConfig = { ...base.features.bootAnimationConfig, ...(raw.features?.bootAnimationConfig || {}) };
  const lib = raw.features?.externalWallpaperLibrary || {};
  out.features.externalWallpaperLibrary = {
    ...base.features.externalWallpaperLibrary,
    ...lib,
    mountedFolders: Array.isArray(lib.mountedFolders) ? lib.mountedFolders.filter(Boolean) : []
  };
  // 路径归一化：容忍用户手填 E:////foo 或正反斜杠混写
  try {
    const libCfg = out.features.externalWallpaperLibrary;
    if (libCfg.libraryPath) {
      libCfg.libraryPath = path.resolve(String(libCfg.libraryPath).trim().replace(/^["']|["']$/g, ''));
    }
    libCfg.mountedFolders = libCfg.mountedFolders.map(p => {
      try { return path.resolve(String(p).trim()); } catch (_) { return p; }
    });
  } catch (_) {}

  // 双开关迁移：旧版单开关 enabled → 壁纸/开屏同时开启；新字段存在时以新字段为准
  try {
    const libCfg = out.features.externalWallpaperLibrary;
    const hasNewSwitches = lib.wallpaperEnabled !== undefined || lib.bootEnabled !== undefined;
    const legacyEnabled = lib.enabled === true;
    libCfg.wallpaperEnabled = hasNewSwitches ? lib.wallpaperEnabled === true : legacyEnabled;
    libCfg.bootEnabled = hasNewSwitches ? lib.bootEnabled === true : legacyEnabled;
    delete libCfg.enabled;
  } catch (_) {}
  // 旧配置兼容：仅有 videoPath 时自动推导 sourceType
  const dw = out.features.dynamicWallpaper;
  if (!dw.sourceType) {
    dw.sourceType = dw.wallpaperDir ? 'scene' : 'video';
  }
  // 阶段五：铺满策略枚举白名单，非法值静默回退默认（旧配置无这两个字段时即自动补齐）
  // 归一化口径与客户端 wallpaper.js 的 normalizeFitMode / normalizeFitPosition 保持一致：
  // 容忍大小写、首尾空格与多空格（用户手改 config.json 时写 " Cover " 也应生效）
  const fitRaw = typeof dw.fit === 'string' ? dw.fit.trim().toLowerCase().replace(/\s+/g, ' ') : '';
  if (dw.fitMigrated !== true) {
    // 阶段六迁移：旧的全局默认 cover 会让正方形的场景缩略图被裁掉近一半画面，
    // 且叠加 Ken Burns 后放大到 1.1 倍，观感就是「只看到一部分 + 很糊」。
    // 这里把「未显式配置」或「仍是旧默认 cover」的配置一次性升级为 auto，并打标记，
    // 之后用户在设置里手动选 cover 不会被反复覆盖。
    dw.fit = (!WALLPAPER_FIT_MODES.has(fitRaw) || fitRaw === 'cover') ? 'auto' : fitRaw;
    dw.fitMigrated = true;
  } else {
    dw.fit = WALLPAPER_FIT_MODES.has(fitRaw) ? fitRaw : 'auto';
  }
  const posRaw = typeof dw.fitPosition === 'string' ? dw.fitPosition.trim().toLowerCase().replace(/\s+/g, ' ') : '';
  dw.fitPosition = WALLPAPER_FIT_POSITIONS.has(posRaw) ? posRaw : 'center';

  // 阶段八：剔除阶段七粗粒度复合档位，针对旧配置的 'eco' 档位做无损拆解迁移
  const rawDw = raw.features?.dynamicWallpaper || {};
  if (rawDw.sceneRenderer === 'eco') {
    dw.sceneRenderer = 'dynamic';
    if (rawDw.fps === undefined) dw.fps = 30;
    if (rawDw.renderDpr === undefined) dw.renderDpr = 0.75;
  } else if (dw.sceneRenderer === 'static') {
    dw.sceneRenderer = 'static';
  } else {
    dw.sceneRenderer = 'dynamic';
  }
  dw.fps = Number.isFinite(dw.fps) ? Math.max(0, Math.round(dw.fps)) : 60;
  dw.renderDpr = Number.isFinite(dw.renderDpr) ? Math.max(0.5, Math.min(2.0, dw.renderDpr)) : 1.0;
  dw.sceneScripts = dw.sceneScripts === true;

  // 阶段八：开屏动效独立参数校验与 clamp
  const boot = out.features.bootAnimationConfig || {};
  boot.fit = (boot.fit && typeof boot.fit === 'string') ? boot.fit : 'cover';
  boot.fitPosition = (boot.fitPosition && typeof boot.fitPosition === 'string') ? boot.fitPosition : 'center';
  boot.brightness = Number.isFinite(boot.brightness) ? Math.max(0.2, Math.min(1.5, boot.brightness)) : 1.0;
  boot.contrast = Number.isFinite(boot.contrast) ? Math.max(0.5, Math.min(1.5, boot.contrast)) : 1.0;
  boot.fps = Number.isFinite(boot.fps) ? Math.max(0, Math.round(boot.fps)) : 60;
  boot.renderDpr = Number.isFinite(boot.renderDpr) ? Math.max(0.5, Math.min(2.0, boot.renderDpr)) : 1.0;
  boot.autoEnterDelay = Number.isFinite(boot.autoEnterDelay)
    ? Math.min(10, Math.max(0, Math.round(boot.autoEnterDelay)))
    : 3;

  return out;
}

function readConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return normalizeConfig(JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')));
    }
    if (fs.existsSync(DEFAULT_CONFIG_FILE)) {
      return normalizeConfig(JSON.parse(fs.readFileSync(DEFAULT_CONFIG_FILE, 'utf8')));
    }
  } catch (e) {
    console.error('[Skin Engine] Failed to read config:', e);
  }
  return buildDefaultConfig();
}

function writeConfig(newConfig) {
  try {
    fs.mkdirSync(path.dirname(CONFIG_FILE), { recursive: true });
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(newConfig, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error('[Skin Engine] Failed to write config:', e);
    return false;
  }
}

// 4. 本地 HTTP 服务（分块视频流 + 配置接口）
let currentVideoPath = '';
const HTTP_PORT = process.env.AGY_SKIN_PORT ? parseInt(process.env.AGY_SKIN_PORT, 10) : 59288;

function resolveVideoPath(videoPath, preferredSubdir = '') {
  if (!videoPath) {
    return null;
  }
  // 1. 绝对路径且存在
  if (path.isAbsolute(videoPath)) {
    if (fs.existsSync(videoPath)) return videoPath;
  } else {
    // 2. 相对插件根目录路径（如 assets/videos/wallpaper/xxx.mp4 或 assets/videos/boot/xxx.mp4）
    const rel = path.resolve(PLUGIN_ROOT, videoPath);
    if (fs.existsSync(rel)) return rel;

    const baseName = path.basename(videoPath);
    // 3. 优先在指定的专属子目录中查找
    if (preferredSubdir) {
      const inPref = path.join(VIDEOS_DIR, preferredSubdir, baseName);
      if (fs.existsSync(inPref)) return inPref;
    }
    // 4. 在壁纸目录、开机视频目录或根素材目录查找同名素材
    const inWall = path.join(WALLPAPER_VIDEOS_DIR, baseName);
    if (fs.existsSync(inWall)) return inWall;
    const inBoot = path.join(BOOT_VIDEOS_DIR, baseName);
    if (fs.existsSync(inBoot)) return inBoot;
    const inAssets = path.join(VIDEOS_DIR, baseName);
    if (fs.existsSync(inAssets)) return inAssets;
  }
  return null;
}

function resolveScriptPath(scriptPath) {
  if (!scriptPath) {
    return path.join(SCRIPTS_DIR, 'default-boot.js');
  }
  // 1. 绝对路径且存在
  if (path.isAbsolute(scriptPath)) {
    if (fs.existsSync(scriptPath)) return scriptPath;
  } else {
    // 2. 相对插件根目录路径（如 assets/scripts/xxx.js）
    const rel = path.resolve(PLUGIN_ROOT, scriptPath);
    if (fs.existsSync(rel)) return rel;

    // 3. 如果是纯文件名或简写路径，优先在 assets/scripts/ 中查找同名素材
    const baseName = path.basename(scriptPath);
    const inScripts = path.join(SCRIPTS_DIR, baseName);
    if (fs.existsSync(inScripts)) return inScripts;
  }
  return path.join(SCRIPTS_DIR, 'default-boot.js');
}

// 自动检测并无损前置 MP4 moov atom（实现 Web 极速秒开，无需等待全量缓冲）
function ensureFastStart(filePath) {
  if (!filePath || !fs.existsSync(filePath) || !filePath.toLowerCase().endsWith('.mp4')) return false;
  try {
    const fd = fs.openSync(filePath, 'r');
    const stat = fs.statSync(filePath);
    let pos = 0;
    const buf = Buffer.alloc(8);
    let moovBeforeMdat = false;
    let foundMdat = false;

    while (pos < stat.size) {
      const bytesRead = fs.readSync(fd, buf, 0, 8, pos);
      if (bytesRead < 8) break;
      const size = buf.readUInt32BE(0);
      const type = buf.toString('ascii', 4, 8);
      if (type === 'moov') {
        if (!foundMdat) moovBeforeMdat = true;
        break;
      }
      if (type === 'mdat') {
        foundMdat = true;
      }
      if (size === 0 || size === 1) break;
      pos += size;
    }
    fs.closeSync(fd);

    if (moovBeforeMdat) {
      return true;
    }

    // 尝试调用 ffmpeg 进行零转码无损 faststart 封装优化 (耗时仅 10~50ms)
    const tmpOut = filePath + '.faststart.tmp.mp4';
    execSync(`ffmpeg -v error -i "${filePath}" -c copy -movflags +faststart "${tmpOut}" -y`, { timeout: 30000 });
    if (fs.existsSync(tmpOut) && fs.statSync(tmpOut).size > 0) {
      fs.unlinkSync(filePath);
      fs.renameSync(tmpOut, filePath);
      console.log(`[Skin Engine] FastStart optimized: ${path.basename(filePath)}`);
      return true;
    }
  } catch (e) {
    // 若系统无 ffmpeg 或优化失败，静默保持原样
  }
  return false;
}

function listVideosFromDir(dirPath, relPrefix) {
  if (!fs.existsSync(dirPath)) {
    try { fs.mkdirSync(dirPath, { recursive: true }); } catch (_) {}
    return [];
  }
  const files = fs.readdirSync(dirPath);
  const validExts = ['.mp4', '.webm', '.mov', '.mkv'];
  const list = [];
  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    if (validExts.includes(ext)) {
      const fullPath = path.join(dirPath, file);
      try {
        const stat = fs.statSync(fullPath);
        if (stat.isFile()) {
          list.push({
            name: file,
            displayName: `🎬 ${file}`,
            relPath: `${relPrefix}/${file}`,
            size: stat.size,
            isDefault: false
          });
        }
      } catch (_) {}
    }
  }
  list.sort((a, b) => a.name.localeCompare(b.name));
  return list;
}

function optimizeVideoAssets() {
  try {
    for (const dir of [WALLPAPER_VIDEOS_DIR, BOOT_VIDEOS_DIR, VIDEOS_DIR]) {
      if (!fs.existsSync(dir)) continue;
      const files = fs.readdirSync(dir);
      for (const f of files) {
        if (f.toLowerCase().endsWith('.mp4')) {
          ensureFastStart(path.join(dir, f));
        }
      }
    }
  } catch (_) {}
}

// ==========================================
// 插件在线热更新系统 (Cross-Platform In-App Hot Update Engine)
// ==========================================
const GITHUB_REPO = 'MrcolorH/antigravity-skin';

function getLocalPluginVersion() {
  try {
    const p = path.join(PLUGIN_ROOT, 'plugin.json');
    if (fs.existsSync(p)) {
      const data = JSON.parse(fs.readFileSync(p, 'utf8'));
      return data.version || '0.0.1';
    }
  } catch (_) {}
  return '0.0.1';
}

function compareSemver(v1, v2) {
  const p1 = (v1 || '').replace(/^[^\d]*/, '').split('.').map(n => parseInt(n, 10) || 0);
  const p2 = (v2 || '').replace(/^[^\d]*/, '').split('.').map(n => parseInt(n, 10) || 0);
  const len = Math.max(p1.length, p2.length);
  for (let i = 0; i < len; i++) {
    const a = p1[i] || 0;
    const b = p2[i] || 0;
    if (a > b) return 1;
    if (a < b) return -1;
  }
  return 0;
}

// 检查 GitHub 最新 Release（带国内加速节点与 Fallback）
async function checkPluginUpdate() {
  const currentVersion = getLocalPluginVersion();
  let latestInfo = null;

  // 1. 首选：GitHub Releases 官方开放 API
  const ghApiUrls = [
    `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`,
    `https://gh-api.pwrpkg.workers.dev/repos/${GITHUB_REPO}/releases/latest`
  ];

  for (const apiUrl of ghApiUrls) {
    try {
      const res = await fetch(apiUrl, {
        signal: AbortSignal.timeout(6000),
        headers: {
          'User-Agent': 'Antigravity-Skin-Updater',
          'Accept': 'application/vnd.github.v3+json'
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.tag_name) {
          const latestTag = data.tag_name.replace(/^[^\d]*/, '');
          const assetZip = data.assets && Array.isArray(data.assets)
            ? data.assets.find(a => a.name && a.name.endsWith('.zip'))
            : null;
          const downloadUrl = assetZip
            ? assetZip.browser_download_url
            : `https://github.com/${GITHUB_REPO}/releases/download/${data.tag_name}/antigravity-skin.zip`;

          latestInfo = {
            currentVersion,
            latestVersion: latestTag,
            hasUpdate: compareSemver(latestTag, currentVersion) > 0,
            name: data.name || `v${latestTag}`,
            changelog: data.body || '无更新说明',
            publishedAt: data.published_at || new Date().toISOString(),
            downloadUrl
          };
          break;
        }
      }
    } catch (_) {}
  }

  // 2. 备用兜底：若 API 受到 403 频控或直连超时，尝试直接请求远程 CDN 上的 plugin.json
  if (!latestInfo) {
    const rawUrls = [
      `https://fastly.jsdelivr.net/gh/${GITHUB_REPO}@main/plugin.json`,
      `https://raw.githubusercontent.com/${GITHUB_REPO}/main/plugin.json`,
      `https://raw.gitmirror.com/${GITHUB_REPO}/main/plugin.json`
    ];
    for (const rawUrl of rawUrls) {
      try {
        const res = await fetch(rawUrl, { signal: AbortSignal.timeout(5000) });
        if (res.ok) {
          const rawData = await res.json();
          if (rawData && rawData.version) {
            const rawVer = rawData.version;
            latestInfo = {
              currentVersion,
              latestVersion: rawVer,
              hasUpdate: compareSemver(rawVer, currentVersion) > 0,
              name: `v${rawVer}`,
              changelog: rawData.description || '常规功能优化与性能提升',
              publishedAt: new Date().toISOString(),
              downloadUrl: `https://github.com/${GITHUB_REPO}/releases/latest/download/antigravity-skin.zip`
            };
            break;
          }
        }
      } catch (_) {}
    }
  }

  if (!latestInfo) {
    throw new Error('无法连接到更新服务器，请检查网络连接后重试。');
  }

  return latestInfo;
}

// 下载更新包（多镜像源自动重试）
async function downloadUpdateZip(rawDownloadUrl, destZipPath) {
  const targetUrls = [
    rawDownloadUrl,
    `https://ghproxy.net/${rawDownloadUrl}`,
    `https://mirror.ghproxy.com/${rawDownloadUrl}`
  ];

  let lastError = null;
  for (const url of targetUrls) {
    try {
      console.log(`[Skin Engine] Attempting to download update from: ${url}`);
      const res = await fetch(url, {
        signal: AbortSignal.timeout(45000),
        headers: { 'User-Agent': 'Antigravity-Skin-Updater' }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 1024) throw new Error('下载文件大小异常');
      fs.writeFileSync(destZipPath, buf);
      console.log(`[Skin Engine] Download succeeded: ${(buf.length / 1024).toFixed(1)} KB`);
      return;
    } catch (err) {
      lastError = err;
      console.warn(`[Skin Engine] Download attempt failed: ${url} ->`, err.message);
    }
  }
  throw new Error(`下载更新安装包失败：${lastError?.message || '网络连接超时'}`);
}

// 解压并安全部署
async function extractAndDeploy(zipFilePath) {
  const tempExtractDir = path.join(os.tmpdir(), `agy-skin-update-${Date.now()}`);
  if (!fs.existsSync(tempExtractDir)) {
    fs.mkdirSync(tempExtractDir, { recursive: true });
  }

  try {
    // 1. 系统原生极速解压 (跨平台支持：Windows 10/11 & macOS & Linux 均内置 bsdtar / tar，秒级完成)
    let extracted = false;
    try {
      execSync(`tar -xf "${zipFilePath}" -C "${tempExtractDir}"`, { timeout: 30000, stdio: 'pipe' });
      extracted = true;
    } catch (tarErr) {
      console.warn('[Skin Engine] tar extraction failed, falling back to powershell / unzip:', tarErr.message);
    }

    if (!extracted) {
      if (process.platform === 'win32') {
        execSync(`powershell -NoProfile -Command "Expand-Archive -Path '${zipFilePath}' -DestinationPath '${tempExtractDir}' -Force"`, { timeout: 45000, stdio: 'pipe' });
      } else {
        execSync(`unzip -o -q "${zipFilePath}" -d "${tempExtractDir}"`, { timeout: 30000, stdio: 'pipe' });
      }
    }

    // 2. 定位解压出的项目根目录（判断是否有外层文件夹包装）
    let sourceRoot = tempExtractDir;
    if (!fs.existsSync(path.join(sourceRoot, 'plugin.json'))) {
      const entries = fs.readdirSync(tempExtractDir, { withFileTypes: true });
      const sub = entries.find(e => e.isDirectory() && fs.existsSync(path.join(tempExtractDir, e.name, 'plugin.json')));
      if (sub) {
        sourceRoot = path.join(tempExtractDir, sub.name);
      }
    }

    if (!fs.existsSync(path.join(sourceRoot, 'plugin.json'))) {
      throw new Error('解压后的安装包中未找到 plugin.json，安装包结构异常');
    }

    // 3. 白名单安全覆盖（严格保护用户的 config.json 与已有音视频素材）
    const copyDirs = ['client', 'sidecars', 'scripts'];
    for (const dir of copyDirs) {
      const src = path.join(sourceRoot, dir);
      const dest = path.join(PLUGIN_ROOT, dir);
      if (fs.existsSync(src)) {
        fs.cpSync(src, dest, { recursive: true, force: true });
      }
    }

    // 增量合入素材脚本（如新的开机动效预设），但绝不覆盖或删除用户自定义脚本
    const srcScriptsDir = path.join(sourceRoot, 'assets', 'scripts');
    const destScriptsDir = path.join(PLUGIN_ROOT, 'assets', 'scripts');
    if (fs.existsSync(srcScriptsDir)) {
      if (!fs.existsSync(destScriptsDir)) fs.mkdirSync(destScriptsDir, { recursive: true });
      const scriptFiles = fs.readdirSync(srcScriptsDir);
      for (const sf of scriptFiles) {
        const srcFile = path.join(srcScriptsDir, sf);
        const destFile = path.join(destScriptsDir, sf);
        if (fs.statSync(srcFile).isFile()) {
          fs.copyFileSync(srcFile, destFile);
        }
      }
    }

    // 复制白名单元文件
    const safeFiles = [
      'plugin.json', 'package.json', 'config.default.json', 'README.md',
      'install.bat', 'uninstall.bat', 'install.ps1', 'uninstall.ps1',
      'install.sh', 'uninstall.sh', 'patch-loading.bat', 'restore-loading.bat'
    ];
    for (const f of safeFiles) {
      const src = path.join(sourceRoot, f);
      const dest = path.join(PLUGIN_ROOT, f);
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, dest);
      }
    }

    console.log('[Skin Engine] Core plugin files successfully updated on disk.');
  } finally {
    // 清理临时解压目录
    try { fs.rmSync(tempExtractDir, { recursive: true, force: true }); } catch (_) {}
  }
}

// ==========================================
// 外部 Wallpaper 素材库：权限白名单与 URL 装饰
// ==========================================
function getLibraryConfig() {
  const cfg = readConfig();
  return cfg.features?.externalWallpaperLibrary || { libraryPath: '', autoScan: true, mountedFolders: [] };
}

// 已授权的可读取根目录：库根目录 + 已挂载的单壁纸目录 + 当前动态壁纸目录（杜绝冷启动初期素材库未完成全盘扫描前 403）
function getAuthorizedRoots() {
  const lib = getLibraryConfig();
  const roots = [];
  if (lib.libraryPath) roots.push(path.resolve(lib.libraryPath));
  for (const p of (Array.isArray(lib.mountedFolders) ? lib.mountedFolders : [])) {
    if (p) roots.push(path.resolve(p));
  }
  try {
    const cfg = readConfig();
    const currentWallpaperDir = cfg.features?.dynamicWallpaper?.wallpaperDir;
    if (currentWallpaperDir) {
      roots.push(path.resolve(currentWallpaperDir));
    }
  } catch (_) {}
  return roots;
}

function isAuthorizedPath(target) {
  if (!target) return false;
  const abs = path.resolve(target);
  return getAuthorizedRoots().some(root => isSubPath(root, abs));
}

function toBase64Url(str) {
  return Buffer.from(String(str), 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function fromBase64Url(str) {
  try {
    return Buffer.from(String(str).replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
  } catch (_) {
    return '';
  }
}

// 呼出系统原生目录选择对话框（桌面系统原生窗口，避免浏览器上传控件）
function pickDirectoryNative(title = '选择素材库根目录') {
  return new Promise((resolve) => {
    if (process.platform === 'win32') {
      const psScript = `
        Add-Type -AssemblyName System.Windows.Forms
        $f = New-Object System.Windows.Forms.FolderBrowserDialog
        $f.Description = '${String(title || '选择素材库根目录').replace(/'/g, "''")}'
        $f.ShowNewFolderButton = $false
        if ($f.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
          [Console]::Out.Write($f.SelectedPath)
        }
      `.trim();
      execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-STA', '-Command', psScript], { timeout: 120000 }, (err, stdout) => {
        if (err || !stdout) resolve(null);
        else resolve(stdout.trim());
      });
    } else if (process.platform === 'darwin') {
      const osaScript = `POSIX path of (choose folder with prompt "${String(title || '选择素材库根目录').replace(/"/g, '\\"')}")`;
      execFile('osascript', ['-e', osaScript], { timeout: 120000 }, (err, stdout) => {
        if (err || !stdout) resolve(null);
        else resolve(stdout.trim());
      });
    } else {
      resolve(null);
    }
  });
}

// 为壁纸补充可直接使用的前端 URL（客户端无需自行拼接与转义）
function decorateWallpaper(w) {
  if (!w) return w;
  const enc = encodeURIComponent;
  const folder = w.folderPath || '';
  return {
    ...w,
    previewUrl: w.previewFile
      ? `/api/wallpaper-library/preview?folder=${enc(folder)}&file=${enc(w.previewFile)}`
      : '',
    // 场景壁纸的真实画面（从 scene.pkg 解包，原生分辨率）；前端优先用它，失败再回落缩略图
    posterUrl: w.type === 'scene'
      ? `/api/wallpaper-library/scene-poster?folder=${enc(folder)}`
      : '',
    audioUrl: w.audioFile
      ? `/api/wallpaper-library/audio?folder=${enc(folder)}&file=${enc(w.audioFile)}`
      : '',
    fileUrl: w.entryFile
      ? `/api/wallpaper-library/file?folder=${enc(folder)}&file=${enc(w.entryFile)}`
      : '',
    streamUrl: (w.type === 'video' && w.entryFile)
      ? `/api/video?path=${enc(path.join(folder, w.entryFile))}`
      : '',
    webUrl: (w.type === 'web' && w.entryFile)
      ? `/api/wallpaper-library/web-proxy/${toBase64Url(folder)}/${String(w.entryFile).split('/').map(enc).join('/')}`
      : ''
  };
}

function persistLibraryConfig(mutator) {
  const cfg = readConfig();
  if (!cfg.features) cfg.features = {};
  const lib = cfg.features.externalWallpaperLibrary || {};
  lib.mountedFolders = Array.isArray(lib.mountedFolders) ? lib.mountedFolders : [];
  mutator(lib, cfg);
  // 去重 + 去掉被库根目录覆盖的冗余条目
  const seen = new Set();
  lib.mountedFolders = lib.mountedFolders.filter(p => {
    if (!p) return false;
    const abs = path.resolve(p);
    const key = process.platform === 'win32' ? abs.toLowerCase() : abs;
    if (seen.has(key)) return false;
    seen.add(key);
    if (lib.libraryPath && isSubPath(lib.libraryPath, abs)) return false;
    return true;
  });
  cfg.features.externalWallpaperLibrary = lib;
  writeConfig(cfg);
  return cfg;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // API: 获取配置
  if (url.pathname === '/api/config' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(readConfig()));
    return;
  }

  // 自动提取并持久化场景原画大图，确保主进程冷启动时无需拉起 sidecar 即可秒级展示所选壁纸原图
  function ensureScenePoster(folder, forceRefresh = false) {
    if (!folder || typeof folder !== 'string') return;
    try {
      const localPosters = ['scene-poster.jpg', 'scene-poster.png', 'scene-poster.webp'];
      if (!forceRefresh) {
        for (const lp of localPosters) {
          if (fs.existsSync(path.join(folder, lp))) return;
        }
      }
      const wpId = path.basename(folder).replace(/[^a-zA-Z0-9_\-]/g, '_');
      const cacheDir = path.join(os.homedir(), '.gemini', 'config', 'plugins', 'antigravity-skin', 'cache');
      if (!forceRefresh) {
        for (const ext of ['.jpg', '.png', '.webp']) {
          if (fs.existsSync(path.join(cacheDir, `poster-${wpId}${ext}`))) return;
        }
      }
      const pkgPath = path.resolve(folder, 'scene.pkg');
      if (!fs.existsSync(pkgPath)) return;
      const poster = getScenePoster(pkgPath, { refresh: forceRefresh });
      if (poster && poster.buffer && poster.buffer.length) {
        const ext = poster.mime === 'image/jpeg' ? '.jpg' : '.png';
        try {
          fs.writeFileSync(path.join(folder, 'scene-poster' + ext), poster.buffer);
        } catch (_) {}
        try {
          fs.mkdirSync(cacheDir, { recursive: true });
          fs.writeFileSync(path.join(cacheDir, `poster-${wpId}${ext}`), poster.buffer);
        } catch (_) {}
      }
    } catch (err) {
      console.warn('[Skin Engine] ensureScenePoster failed:', err.message);
    }
  }

  // API: 保存配置
  if (url.pathname === '/api/config' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const parsed = JSON.parse(body);
        writeConfig(parsed);
        // 若配置了场景素材，后台静默自动提取并持久化该素材的高清大图，为冷启动提供 100% 动态对齐的高清原画
        const bootWp = parsed?.features?.bootAnimationConfig?.wallpaperDir;
        const dwWp = parsed?.features?.dynamicWallpaper?.wallpaperDir;
        if (bootWp) setTimeout(() => ensureScenePoster(bootWp), 10);
        if (dwWp && dwWp !== bootWp) setTimeout(() => ensureScenePoster(dwWp), 50);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // API: 获取操作系统与运行平台信息
  if (url.pathname === '/api/system-info' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      ok: true,
      platform: process.platform,
      isWindows: process.platform === 'win32',
      isMac: process.platform === 'darwin',
      isLinux: process.platform === 'linux'
    }));
    return;
  }

  // API: Windows 平台专属 - 一键重新合入开机动效补丁
  if (url.pathname === '/api/patch-boot' && req.method === 'POST') {
    if (process.platform !== 'win32') {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: '开机动效引擎补丁仅适用于 Windows 平台，macOS 无需合入。' }));
      return;
    }

    const batPath = path.join(PLUGIN_ROOT, 'patch-loading.bat');
    if (!fs.existsSync(batPath)) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: `未在插件安装目录下找到修复脚本: ${batPath}` }));
      return;
    }

    // 立即响应前端，确保 HTTP 报文顺利送达，避免因客户端退出引发网络中断报错
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, message: '已成功启动开机动效修复引擎，客户端即将退出并自动重启。' }));

    // 延时 500ms 后脱离当前进程树，拉起独立的 cmd 控制台执行 patch-loading.bat
    setTimeout(() => {
      try {
        const cleanEnv = { ...process.env };
        delete cleanEnv.ELECTRON_RUN_AS_NODE;
        delete cleanEnv.ELECTRON_NO_ASAR;
        delete cleanEnv.NODE_OPTIONS;
        delete cleanEnv.NODE_ENV;
        delete cleanEnv.ATOM_SHELL_INTERNAL_RUN_AS_NODE;

        const child = spawn('cmd.exe', ['/c', 'start', '""', batPath], {
          cwd: PLUGIN_ROOT,
          detached: true,
          stdio: 'ignore',
          env: cleanEnv
        });
        child.unref();
      } catch (err) {
        console.error('[Skin Engine] Failed to spawn patch process:', err);
      }
    }, 500);
    return;
  }

  // API: 检查插件最新版本
  if (url.pathname === '/api/update/check' && req.method === 'GET') {
    checkPluginUpdate()
      .then(info => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, ...info }));
      })
      .catch(err => {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: err.message, currentVersion: getLocalPluginVersion() }));
      });
    return;
  }

  // API: 客户端执行一键在线热更新
  if (url.pathname === '/api/update/apply' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      let tmpZip = '';
      try {
        let downloadUrl = '';
        if (body) {
          try {
            const parsed = JSON.parse(body);
            downloadUrl = parsed.downloadUrl || '';
          } catch (_) {}
        }
        if (!downloadUrl) {
          const info = await checkPluginUpdate();
          downloadUrl = info.downloadUrl;
        }

        tmpZip = path.join(os.tmpdir(), `agy-skin-update-${Date.now()}.zip`);
        await downloadUpdateZip(downloadUrl, tmpZip);
        await extractAndDeploy(tmpZip);

        const newVersion = getLocalPluginVersion();

        // 立即尝试通过活跃 CDP 会话在已打开的主窗口热更新前端 Bundle
        let bundleEvaluated = false;
        try {
          const newBundle = buildClientBundle();
          for (const [targetId, session] of activeSessions.entries()) {
            try {
              await session.send('Runtime.evaluate', {
                expression: `(() => {
                  try {
                    console.log('[Skin Engine] Hot reload triggering in client window...');
                    if (window.__agyCurrentMenuInstance && typeof window.__agyCurrentMenuInstance.destroy === 'function') {
                      window.__agyCurrentMenuInstance.destroy();
                    }
                  } catch (_) {}
                  ${newBundle}
                })()`
              });
              bundleEvaluated = true;
            } catch (cdpErr) {
              console.warn(`[Skin Engine] CDP hot evaluate failed for ${targetId}:`, cdpErr.message);
            }
          }
        } catch (bErr) {
          console.warn('[Skin Engine] Failed to rebuild bundle after update:', bErr.message);
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          ok: true,
          version: newVersion,
          bundleEvaluated,
          message: `已成功更新至 v${newVersion}！新特性已实时生效。`
        }));

        // 延时 800ms 让 HTTP 报文顺利送达前端，随后正常退出触发宿主自动重启拉起最新的 main.mjs
        setTimeout(() => {
          console.log('[Skin Engine] Update deployed successfully. Gracefully exiting to reload sidecar daemon...');
          process.exit(0);
        }, 800);
      } catch (err) {
        console.error('[Skin Engine] Update apply failed:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: err.message }));
      } finally {
        if (tmpZip && fs.existsSync(tmpZip)) {
          try { fs.unlinkSync(tmpZip); } catch (_) {}
        }
      }
    });
    return;
  }

  // API: 获取内置壁纸视频列表
  if (url.pathname === '/api/wallpaper/list' && req.method === 'GET') {
    try {
      const videos = listVideosFromDir(WALLPAPER_VIDEOS_DIR, 'assets/videos/wallpaper');
      const rootVideos = listVideosFromDir(VIDEOS_DIR, 'assets/videos');
      for (const rv of rootVideos) {
        if (!videos.some(v => v.name === rv.name)) {
          videos.push(rv);
        }
      }
      const crossVideos = listVideosFromDir(BOOT_VIDEOS_DIR, 'assets/videos/boot');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, videos, crossVideos }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: err.message }));
    }
    return;
  }

  // API: 上传视频到内置动态壁纸库 assets/videos/wallpaper
  if (url.pathname === '/api/wallpaper/upload' && req.method === 'POST') {
    try {
      let fileNameParam = url.searchParams.get('name') || `custom_wall_${Date.now()}.mp4`;
      try { fileNameParam = decodeURIComponent(fileNameParam); } catch (_) {}
      const cleanFileName = path.basename(fileNameParam).replace(/[^\w\d\.\-_\u4e00-\u9fa5]/g, '_');
      if (!fs.existsSync(WALLPAPER_VIDEOS_DIR)) {
        fs.mkdirSync(WALLPAPER_VIDEOS_DIR, { recursive: true });
      }

      const parsedPath = path.parse(cleanFileName);
      let targetFileName = parsedPath.base;
      let destPath = path.join(WALLPAPER_VIDEOS_DIR, targetFileName);

      if (fs.existsSync(destPath)) {
        targetFileName = `${parsedPath.name}_${Date.now()}${parsedPath.ext || '.mp4'}`;
        destPath = path.join(WALLPAPER_VIDEOS_DIR, targetFileName);
      }

      const fileWriteStream = fs.createWriteStream(destPath);
      req.pipe(fileWriteStream);

      fileWriteStream.on('finish', () => {
        try { ensureFastStart(destPath); } catch (_) {}
        const relPath = `assets/videos/wallpaper/${targetFileName}`;
        console.log(`[Skin Engine] Successfully uploaded wallpaper: ${relPath}`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          ok: true,
          relPath,
          fileName: targetFileName,
          message: '已成功上传并保存到动态壁纸素材库'
        }));
      });

      fileWriteStream.on('error', (err) => {
        console.error('[Skin Engine] Failed to write uploaded wallpaper:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: '写入文件失败: ' + err.message }));
      });
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: err.message }));
    }
    return;
  }

  // API: 导入外部视频到内置壁纸素材库（支持绝对路径复制）
  if (url.pathname === '/api/wallpaper/import' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const parsed = JSON.parse(body);
        let sourcePath = (parsed.sourcePath || '').trim();
        if (!sourcePath) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: '请提供有效的源视频文件路径' }));
          return;
        }

        if (!path.isAbsolute(sourcePath)) {
          const inCwd = path.resolve(process.cwd(), sourcePath);
          if (fs.existsSync(inCwd)) {
            sourcePath = inCwd;
          }
        }

        if (!fs.existsSync(sourcePath)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: `源视频文件未找到，请确认本地路径是否正确：${sourcePath}` }));
          return;
        }

        if (!fs.existsSync(WALLPAPER_VIDEOS_DIR)) {
          fs.mkdirSync(WALLPAPER_VIDEOS_DIR, { recursive: true });
        }

        const parsedPath = path.parse(sourcePath);
        let targetFileName = parsedPath.base;
        let destPath = path.join(WALLPAPER_VIDEOS_DIR, targetFileName);

        if (fs.existsSync(destPath)) {
          const srcStat = fs.statSync(sourcePath);
          const destStat = fs.statSync(destPath);
          if (srcStat.size !== destStat.size) {
            targetFileName = `${parsedPath.name}_${Date.now()}${parsedPath.ext}`;
            destPath = path.join(WALLPAPER_VIDEOS_DIR, targetFileName);
            fs.copyFileSync(sourcePath, destPath);
          }
        } else {
          fs.copyFileSync(sourcePath, destPath);
        }

        try { ensureFastStart(destPath); } catch (_) {}
        const relPath = `assets/videos/wallpaper/${targetFileName}`;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          ok: true,
          relPath,
          fileName: targetFileName,
          message: '已成功导入动态壁纸素材库'
        }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: err.message }));
      }
    });
    return;
  }

  // API: 删除内置壁纸素材（独立管理，绝不干扰开机短视频配置与素材）
  if ((url.pathname === '/api/wallpaper/delete' && req.method === 'POST') ||
      (url.pathname === '/api/wallpaper' && req.method === 'DELETE')) {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        let targetRelPath = '';
        if (body) {
          try {
            const parsed = JSON.parse(body);
            targetRelPath = parsed.path || '';
          } catch (e) {}
        }
        if (!targetRelPath) {
          targetRelPath = url.searchParams.get('path') || '';
        }

        if (!targetRelPath) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: '缺少要删除的文件路径参数' }));
          return;
        }

        const baseName = path.basename(targetRelPath);
        let targetFullPath = path.join(WALLPAPER_VIDEOS_DIR, baseName);
        if (!fs.existsSync(targetFullPath)) {
          targetFullPath = path.join(VIDEOS_DIR, baseName);
        }

        // 安全检查：防止目录穿越
        if (!targetFullPath.startsWith(VIDEOS_DIR)) {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: '非法路径，禁止访问素材库以外的文件' }));
          return;
        }

        if (fs.existsSync(targetFullPath)) {
          fs.unlinkSync(targetFullPath);
          console.log(`[Skin Engine] Successfully deleted wallpaper video: ${targetFullPath}`);
        }

        // 仅检查并重置壁纸配置，严禁连带清空开机短视频！
        const config = readConfig();
        let configChanged = false;
        if (config.features?.dynamicWallpaper?.videoPath &&
            (config.features.dynamicWallpaper.videoPath.includes(baseName) || config.features.dynamicWallpaper.videoPath === targetRelPath)) {
          config.features.dynamicWallpaper.videoPath = '';
          configChanged = true;
          writeConfig(config);
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          ok: true,
          message: `已成功删除壁纸素材：${baseName}`,
          fallbackPath: '',
          configReset: configChanged
        }));
      } catch (err) {
        console.error('[Skin Engine] Delete wallpaper error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: '删除失败: ' + err.message }));
      }
    });
    return;
  }

  // API: 获取开机短视频素材列表
  if (url.pathname === '/api/boot-video/list' && req.method === 'GET') {
    try {
      const videos = listVideosFromDir(BOOT_VIDEOS_DIR, 'assets/videos/boot');
      const rootVideos = listVideosFromDir(VIDEOS_DIR, 'assets/videos');
      for (const rv of rootVideos) {
        if (!videos.some(v => v.name === rv.name)) {
          videos.push(rv);
        }
      }
      const crossVideos = listVideosFromDir(WALLPAPER_VIDEOS_DIR, 'assets/videos/wallpaper');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, videos, crossVideos }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: err.message }));
    }
    return;
  }

  // API: 上传视频到内置开机短视频库 assets/videos/boot
  if (url.pathname === '/api/boot-video/upload' && req.method === 'POST') {
    try {
      let fileNameParam = url.searchParams.get('name') || `custom_boot_${Date.now()}.mp4`;
      try { fileNameParam = decodeURIComponent(fileNameParam); } catch (_) {}
      const cleanFileName = path.basename(fileNameParam).replace(/[^\w\d\.\-_\u4e00-\u9fa5]/g, '_');
      if (!fs.existsSync(BOOT_VIDEOS_DIR)) {
        fs.mkdirSync(BOOT_VIDEOS_DIR, { recursive: true });
      }

      const parsedPath = path.parse(cleanFileName);
      let targetFileName = parsedPath.base;
      let destPath = path.join(BOOT_VIDEOS_DIR, targetFileName);

      if (fs.existsSync(destPath)) {
        targetFileName = `${parsedPath.name}_${Date.now()}${parsedPath.ext || '.mp4'}`;
        destPath = path.join(BOOT_VIDEOS_DIR, targetFileName);
      }

      const fileWriteStream = fs.createWriteStream(destPath);
      req.pipe(fileWriteStream);

      fileWriteStream.on('finish', () => {
        try { ensureFastStart(destPath); } catch (_) {}
        const relPath = `assets/videos/boot/${targetFileName}`;
        console.log(`[Skin Engine] Successfully uploaded boot video: ${relPath}`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          ok: true,
          relPath,
          fileName: targetFileName,
          message: '已成功上传并保存到开机短视频素材库'
        }));
      });

      fileWriteStream.on('error', (err) => {
        console.error('[Skin Engine] Failed to write uploaded boot video:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: '写入文件失败: ' + err.message }));
      });
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: err.message }));
    }
    return;
  }

  // API: 导入外部绝对路径视频到内置开机短视频素材库
  if (url.pathname === '/api/boot-video/import' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const parsed = JSON.parse(body);
        let sourcePath = (parsed.sourcePath || '').trim();
        if (!sourcePath) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: '请提供有效的源视频文件路径' }));
          return;
        }

        if (!path.isAbsolute(sourcePath)) {
          const inCwd = path.resolve(process.cwd(), sourcePath);
          if (fs.existsSync(inCwd)) {
            sourcePath = inCwd;
          }
        }

        if (!fs.existsSync(sourcePath)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: `源视频文件未找到，请确认本地路径是否正确：${sourcePath}` }));
          return;
        }

        if (!fs.existsSync(BOOT_VIDEOS_DIR)) {
          fs.mkdirSync(BOOT_VIDEOS_DIR, { recursive: true });
        }

        const parsedPath = path.parse(sourcePath);
        let targetFileName = parsedPath.base;
        let destPath = path.join(BOOT_VIDEOS_DIR, targetFileName);

        if (fs.existsSync(destPath)) {
          const srcStat = fs.statSync(sourcePath);
          const destStat = fs.statSync(destPath);
          if (srcStat.size !== destStat.size) {
            targetFileName = `${parsedPath.name}_${Date.now()}${parsedPath.ext}`;
            destPath = path.join(BOOT_VIDEOS_DIR, targetFileName);
            fs.copyFileSync(sourcePath, destPath);
          }
        } else {
          fs.copyFileSync(sourcePath, destPath);
        }

        try { ensureFastStart(destPath); } catch (_) {}
        const relPath = `assets/videos/boot/${targetFileName}`;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          ok: true,
          relPath,
          fileName: targetFileName,
          message: '已成功导入开机短视频素材库'
        }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: err.message }));
      }
    });
    return;
  }

  // API: 删除内置开机短视频素材（独立管理，绝不干扰壁纸配置与素材）
  if ((url.pathname === '/api/boot-video/delete' && req.method === 'POST') ||
      (url.pathname === '/api/boot-video' && req.method === 'DELETE')) {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        let targetRelPath = '';
        if (body) {
          try {
            const parsed = JSON.parse(body);
            targetRelPath = parsed.path || '';
          } catch (e) {}
        }
        if (!targetRelPath) {
          targetRelPath = url.searchParams.get('path') || '';
        }

        if (!targetRelPath) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: '缺少要删除的文件路径参数' }));
          return;
        }

        const baseName = path.basename(targetRelPath);
        let targetFullPath = path.join(BOOT_VIDEOS_DIR, baseName);
        if (!fs.existsSync(targetFullPath)) {
          targetFullPath = path.join(VIDEOS_DIR, baseName);
        }

        // 安全检查：防止目录穿越
        if (!targetFullPath.startsWith(VIDEOS_DIR)) {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: '非法路径，禁止访问素材库以外的文件' }));
          return;
        }

        if (fs.existsSync(targetFullPath)) {
          fs.unlinkSync(targetFullPath);
          console.log(`[Skin Engine] Successfully deleted boot video: ${targetFullPath}`);
        }

        // 仅检查并重置开机短视频配置，严禁连带清空壁纸！
        const config = readConfig();
        let configChanged = false;
        if (config.features?.bootAnimationConfig?.videoPath &&
            (config.features.bootAnimationConfig.videoPath.includes(baseName) || config.features.bootAnimationConfig.videoPath === targetRelPath)) {
          config.features.bootAnimationConfig.videoPath = '';
          configChanged = true;
          writeConfig(config);
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          ok: true,
          message: `已成功删除开机视频素材：${baseName}`,
          fallbackPath: '',
          configReset: configChanged
        }));
      } catch (err) {
        console.error('[Skin Engine] Delete boot video error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: '删除失败: ' + err.message }));
      }
    });
    return;
  }

  // API: 获取动效脚本列表
  if (url.pathname === '/api/boot-script/list' && req.method === 'GET') {
    try {
      if (!fs.existsSync(SCRIPTS_DIR)) {
        fs.mkdirSync(SCRIPTS_DIR, { recursive: true });
      }
      const files = fs.readdirSync(SCRIPTS_DIR);
      const scripts = [];
      for (const file of files) {
        if (file.toLowerCase().endsWith('.js')) {
          const fullPath = path.join(SCRIPTS_DIR, file);
          const stat = fs.statSync(fullPath);
          const isDefault = file === 'default-boot.js';
          scripts.push({
            name: file,
            displayName: isDefault ? '🌟 默认极客科技动效 (default-boot.js)' : `💻 ${file}`,
            relPath: `assets/scripts/${file}`,
            size: stat.size,
            isDefault
          });
        }
      }
      scripts.sort((a, b) => {
        if (a.isDefault) return -1;
        if (b.isDefault) return 1;
        return a.name.localeCompare(b.name);
      });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, scripts }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: err.message }));
    }
    return;
  }

  // API: 二进制流上传动效脚本到 assets/scripts 目录
  if (url.pathname === '/api/boot-script/upload' && req.method === 'POST') {
    try {
      let fileNameParam = url.searchParams.get('name') || `custom_boot_${Date.now()}.js`;
      try { fileNameParam = decodeURIComponent(fileNameParam); } catch (_) {}
      let cleanFileName = path.basename(fileNameParam).replace(/[^\w\d\.\-_\u4e00-\u9fa5]/g, '_');
      if (!cleanFileName.toLowerCase().endsWith('.js')) {
        cleanFileName += '.js';
      }
      if (!fs.existsSync(SCRIPTS_DIR)) {
        fs.mkdirSync(SCRIPTS_DIR, { recursive: true });
      }

      const parsedPath = path.parse(cleanFileName);
      let targetFileName = parsedPath.base;
      let destPath = path.join(SCRIPTS_DIR, targetFileName);

      if (fs.existsSync(destPath)) {
        targetFileName = `${parsedPath.name}_${Date.now()}.js`;
        destPath = path.join(SCRIPTS_DIR, targetFileName);
      }

      const fileWriteStream = fs.createWriteStream(destPath);
      req.pipe(fileWriteStream);

      fileWriteStream.on('finish', () => {
        const relPath = `assets/scripts/${targetFileName}`;
        console.log(`[Skin Engine] Successfully uploaded boot script: ${relPath}`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          ok: true,
          relPath,
          fileName: targetFileName,
          message: '已成功上传并保存到动效脚本库'
        }));
      });

      fileWriteStream.on('error', (err) => {
        console.error('[Skin Engine] Failed to write uploaded script:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: '写入文件失败: ' + err.message }));
      });
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: err.message }));
    }
    return;
  }

  // API: 删除 assets/scripts 中的动效脚本
  if ((url.pathname === '/api/boot-script/delete' && req.method === 'POST') ||
      (url.pathname === '/api/boot-script' && req.method === 'DELETE')) {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        let targetRelPath = '';
        if (body) {
          try {
            const parsed = JSON.parse(body);
            targetRelPath = parsed.path || '';
          } catch (e) {}
        }
        if (!targetRelPath) {
          targetRelPath = url.searchParams.get('path') || '';
        }

        if (!targetRelPath) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: '缺少要删除的文件路径参数' }));
          return;
        }

        const baseName = path.basename(targetRelPath);
        if (baseName === 'default-boot.js') {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: '默认动效脚本受系统保护，不可删除' }));
          return;
        }

        const targetFullPath = path.join(SCRIPTS_DIR, baseName);

        if (!targetFullPath.startsWith(SCRIPTS_DIR)) {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: '非法路径，禁止访问动效库以外的文件' }));
          return;
        }

        if (fs.existsSync(targetFullPath)) {
          fs.unlinkSync(targetFullPath);
          console.log(`[Skin Engine] Successfully deleted script file: ${targetFullPath}`);
        }

        const config = readConfig();
        let configChanged = false;
        if (config.features?.bootAnimationConfig?.customCodePath &&
            (config.features.bootAnimationConfig.customCodePath.includes(baseName) || config.features.bootAnimationConfig.customCodePath === targetRelPath)) {
          config.features.bootAnimationConfig.customCodePath = 'assets/scripts/default-boot.js';
          configChanged = true;
          writeConfig(config);
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          ok: true,
          message: `已成功删除动效方案：${baseName}`,
          fallbackPath: 'assets/scripts/default-boot.js',
          configReset: configChanged
        }));
      } catch (err) {
        console.error('[Skin Engine] Delete script error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: '删除失败: ' + err.message }));
      }
    });
    return;
  }

  // ==========================================================
  // 外部 Wallpaper 素材库 API（零拷贝原地引用 / 阶段一）
  // ==========================================================
  function sendJson(status, payload) {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(payload));
  }

  // 1. 自动探测本机常见素材库目录（Steam 创意工坊 / WallpaperMachine）
  if (url.pathname === '/api/wallpaper-library/detect' && req.method === 'GET') {
    try {
      const candidates = detectLibraryCandidates();
      sendJson(200, {
        ok: true,
        platform: process.platform,
        candidates,
        configuredPath: getLibraryConfig().libraryPath || ''
      });
    } catch (err) {
      sendJson(500, { ok: false, error: err.message });
    }
    return;
  }

  // 1.5 原生系统目录选择对话框（避免网页文件上传控件）
  if (url.pathname === '/api/wallpaper-library/pick-directory' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      let title = '选择素材库根目录';
      try {
        const parsed = JSON.parse(body || '{}');
        if (parsed.title) title = String(parsed.title);
      } catch (_) {}
      try {
        const picked = await pickDirectoryNative(title);
        sendJson(200, { ok: true, path: picked || null, canceled: !picked });
      } catch (err) {
        sendJson(500, { ok: false, error: err.message });
      }
    });
    return;
  }

  // 2. 扫描素材库根目录（mount=1 时同时持久化挂载该根目录）
  if (url.pathname === '/api/wallpaper-library/scan' && req.method === 'GET') {
    const libCfg = getLibraryConfig();
    const rawPath = (url.searchParams.get('path') || libCfg.libraryPath || '').trim().replace(/^["']|["']$/g, '');
    const force = url.searchParams.get('force') === '1' || url.searchParams.get('refresh') === '1';
    const shouldMount = url.searchParams.get('mount') === '1';

    if (!rawPath) {
      sendJson(400, { ok: false, error: '请提供素材库根目录路径（?path=）或在设置中先完成挂载' });
      return;
    }

    scanLibrary(rawPath, { force })
      .then(result => {
        if (!result.ok) {
          sendJson(400, result);
          return;
        }
        let mounted = false;
        if (shouldMount) {
          try {
            persistLibraryConfig(lib => {
              lib.libraryPath = result.root;
              lib.autoScan = true;
            });
            mounted = true;
          } catch (_) {}
        }
        const authorized = isAuthorizedPath(result.root);
        sendJson(200, {
          ...result,
          mounted,
          authorized,
          wallpapers: result.wallpapers.map(decorateWallpaper),
          libraryPath: getLibraryConfig().libraryPath || ''
        });
      })
      .catch(err => sendJson(500, { ok: false, error: err.message }));
    return;
  }

  // 3. 挂载单个壁纸目录（支持绝对路径，也支持仅传工坊 id 由服务端在已知根目录中定位）
  if (url.pathname === '/api/wallpaper-library/import-folder' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        let parsed = {};
        try { parsed = body ? JSON.parse(body) : {}; } catch (_) { parsed = {}; }
        const hint = parsed.folderPath || parsed.folder || parsed.id || '';
        if (!hint) {
          sendJson(400, { ok: false, error: '请提供壁纸目录路径（folderPath）或工坊文件夹 id' });
          return;
        }

        const roots = getAuthorizedRoots();
        const resolvedFolder = resolveFolderByHint(hint, roots);
        if (!resolvedFolder) {
          sendJson(404, {
            ok: false,
            error: `未找到壁纸目录：${hint}。请粘贴完整绝对路径，或先挂载所在素材库根目录。`
          });
          return;
        }

        const result = parseWallpaperFolder(resolvedFolder);
        if (!result.ok) {
          sendJson(400, { ok: false, error: result.error });
          return;
        }
        if (result.skipped) {
          const reasonMap = {
            application: '该壁纸为 application（可执行程序）类型，出于安全策略已严格过滤，不予载入。',
            'unknown-type': '无法识别该目录的壁纸类型（缺少 project.json 或有效入口文件）。',
            'missing-media': '该目录内未找到可用的媒体入口或封面素材。'
          };
          sendJson(200, {
            ok: false,
            filtered: true,
            reason: result.reason,
            error: reasonMap[result.reason] || '该壁纸不受支持，已跳过。',
            wallpaper: result.wallpaper || null
          });
          return;
        }

        if (parsed.mount !== false) {
          try {
            persistLibraryConfig(lib => {
              const libPath = lib.libraryPath ? path.resolve(lib.libraryPath) : '';
              if (!libPath || !isSubPath(libPath, path.resolve(resolvedFolder))) {
                lib.mountedFolders.push(path.resolve(resolvedFolder));
              }
            });
          } catch (_) {}
        }

        sendJson(200, {
          ok: true,
          mounted: parsed.mount !== false,
          authorized: isAuthorizedPath(resolvedFolder),
          wallpaper: decorateWallpaper(result.wallpaper)
        });
      } catch (err) {
        sendJson(500, { ok: false, error: err.message });
      }
    });
    return;
  }

  // 4. 外部封面图代理（强缓存，减少重复解码）
  if (url.pathname === '/api/wallpaper-library/preview' && req.method === 'GET') {
    const folder = url.searchParams.get('folder') || '';
    const file = url.searchParams.get('file') || '';
    if (!folder) {
      sendJson(400, { ok: false, error: '缺少 folder 参数' });
      return;
    }
    if (!isAuthorizedPath(folder)) {
      sendJson(403, { ok: false, error: '该目录尚未挂载或不在已授权的素材库范围内' });
      return;
    }
    const target = path.resolve(folder, file || 'preview.jpg');
    if (!isSubPath(folder, target)) {
      sendJson(403, { ok: false, error: '非法路径，禁止访问壁纸目录以外的文件' });
      return;
    }
    serveLocalFile(req, res, target, { cacheControl: 'public, max-age=86400' });
    return;
  }

  // 4.5 场景壁纸真实画面：从 scene.pkg 解包主纹理（原生分辨率，非正方形缩略图）
  if (url.pathname === '/api/wallpaper-library/scene-poster' && req.method === 'GET') {
    const folder = url.searchParams.get('folder') || '';
    const refresh = url.searchParams.get('refresh') === '1';
    if (!folder) {
      sendJson(400, { ok: false, error: '缺少 folder 参数' });
      return;
    }
    if (!isAuthorizedPath(folder)) {
      sendJson(403, { ok: false, error: '该目录尚未挂载或不在已授权的素材库范围内' });
      return;
    }
    // 优先命中本地已持久化的 4K/1080P 原生大图（秒级直出，杜绝重复解包与缩略图降级）
    // 注意：若传入 refresh=1，强制跳过本地文件并重新解包覆盖
    if (!refresh) {
      const localPosters = ['scene-poster.png', 'scene-poster.jpg', 'scene-poster.webp'];
      for (const lp of localPosters) {
        const fullLp = path.join(folder, lp);
        if (fs.existsSync(fullLp)) {
          try {
            const buf = fs.readFileSync(fullLp);
            const mime = lp.endsWith('.png') ? 'image/png' : 'image/jpeg';
            res.writeHead(200, {
              'Content-Type': mime,
              'Content-Length': buf.length,
              'Cache-Control': 'public, max-age=86400',
              'X-Poster-Direct': '1'
            });
            res.end(buf);
            return;
          } catch (_) {}
        }
      }
    }

    const pkgPath = path.resolve(folder, 'scene.pkg');
    if (!isSubPath(path.resolve(folder), pkgPath) || !fs.existsSync(pkgPath)) {
      sendJson(404, { ok: false, error: '该目录下没有 scene.pkg' });
      return;
    }
    try {
      const poster = getScenePoster(pkgPath, { refresh });
      if (!poster || !poster.buffer || !poster.buffer.length) {
        sendJson(404, { ok: false, error: '无法从 scene.pkg 解析出画面纹理' });
        return;
      }

      // 异步持久化保存一份到壁纸目录与全局缓存，确保主进程冷启动时无需启动 sidecar 即可直接读取原生大图
      try {
        const ext = poster.mime === 'image/jpeg' ? '.jpg' : '.png';
        const targetFile = path.join(folder, 'scene-poster' + ext);
        // refresh 或文件未就绪时直接覆盖写入
        fs.writeFileSync(targetFile, poster.buffer);
        const wpId = path.basename(folder).replace(/[^a-zA-Z0-9_\-]/g, '_');
        const cacheDir = path.join(os.homedir(), '.gemini', 'config', 'plugins', 'antigravity-skin', 'cache');
        fs.mkdirSync(cacheDir, { recursive: true });
        const cacheFile = path.join(cacheDir, `poster-${wpId}${ext}`);
        fs.writeFileSync(cacheFile, poster.buffer);
      } catch (_) {}

      res.writeHead(200, {
        'Content-Type': poster.mime || 'image/jpeg',
        'Content-Length': poster.buffer.length,
        'Cache-Control': 'public, max-age=86400',
        'X-Poster-Width': String(poster.width || 0),
        'X-Poster-Height': String(poster.height || 0),
        'X-Poster-Cached': poster.cached ? '1' : '0'
      });
      res.end(poster.buffer);
    } catch (e) {
      sendJson(500, { ok: false, error: 'scene.pkg 解包失败: ' + e.message });
    }
    return;
  }

  // 5. 场景壁纸内嵌音频 / 通用文件读取
  if ((url.pathname === '/api/wallpaper-library/audio' || url.pathname === '/api/wallpaper-library/file') && req.method === 'GET') {
    const folder = url.searchParams.get('folder') || '';
    const file = url.searchParams.get('file') || '';
    if (!folder || !file) {
      sendJson(400, { ok: false, error: '缺少 folder 或 file 参数' });
      return;
    }
    if (!isAuthorizedPath(folder)) {
      sendJson(403, { ok: false, error: '该目录尚未挂载或不在已授权的素材库范围内' });
      return;
    }
    const target = path.resolve(folder, file);
    if (!isSubPath(folder, target)) {
      sendJson(403, { ok: false, error: '非法路径，禁止访问壁纸目录以外的文件' });
      return;
    }
    serveLocalFile(req, res, target, { cacheControl: 'public, max-age=3600' });
    return;
  }

  // 6. Web 壁纸静态托管（/api/wallpaper-library/web-proxy/<base64url 目录>/<相对路径>）
  if (url.pathname.startsWith('/api/wallpaper-library/web-proxy/') && (req.method === 'GET' || req.method === 'HEAD')) {
    const prefix = '/api/wallpaper-library/web-proxy/';
    const rest = url.pathname.slice(prefix.length);
    let folder = url.searchParams.get('folder') || '';
    let relPath = url.searchParams.get('file') || '';

    if (!folder) {
      const slashIdx = rest.indexOf('/');
      const folderToken = slashIdx === -1 ? rest : rest.slice(0, slashIdx);
      const relToken = slashIdx === -1 ? '' : rest.slice(slashIdx + 1);
      folder = fromBase64Url(folderToken);
      if (!relPath) {
        try { relPath = decodeURIComponent(relToken); } catch (_) { relPath = relToken; }
      }
    }

    if (!folder) {
      sendJson(400, { ok: false, error: '缺少素材目录标识' });
      return;
    }
    if (!isAuthorizedPath(folder)) {
      sendJson(403, { ok: false, error: '该目录尚未挂载或不在已授权的素材库范围内' });
      return;
    }

    const folderAbs = path.resolve(folder);
    const target = relPath ? path.resolve(folderAbs, relPath) : path.join(folderAbs, 'index.html');
    if (!isSubPath(folderAbs, target)) {
      sendJson(403, { ok: false, error: '非法路径，禁止访问壁纸目录以外的文件' });
      return;
    }
    serveLocalFile(req, res, target, { cacheControl: 'public, max-age=600' });
    return;
  }

  function getVideoMimeType(filePath) {
    const ext = path.extname(filePath || '').toLowerCase();
    switch (ext) {
      case '.webm': return 'video/webm';
      case '.mov': return 'video/quicktime';
      case '.mkv': return 'video/x-matroska';
      case '.mp4':
      default:
        return 'video/mp4';
    }
  }

  // 视频流服务核心函数（高吞吐 512KB 缓冲、强缓存、HEAD 极速元数据响应）
  function streamVideoFile(vidPath, contentType = '') {
    if (!vidPath || !fs.existsSync(vidPath)) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Video not found');
      return;
    }

    const mime = contentType || getVideoMimeType(vidPath);

    try {
      const stat = fs.statSync(vidPath);
      const fileSize = stat.size;
      const mtime = stat.mtime.toUTCString();
      const etag = `"${stat.size}-${Math.floor(stat.mtimeMs)}"`;

      // 强缓存与秒级 304 协商
      if (req.headers['if-none-match'] === etag) {
        res.writeHead(304);
        res.end();
        return;
      }

      // 浏览器 HEAD 请求（极速返回视频大小与 Range 支持情况，不读文件内容）
      if (req.method === 'HEAD') {
        res.writeHead(200, {
          'Content-Length': fileSize,
          'Content-Type': mime,
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'public, max-age=31536000, immutable',
          'ETag': etag,
          'Last-Modified': mtime
        });
        res.end();
        return;
      }

      const range = req.headers.range;

      if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunkSize = (end - start) + 1;
        // 扩充 highWaterMark 至 512KB，大幅压低 Windows 平台下的逐包传输开销
        const fileStream = fs.createReadStream(vidPath, { start, end, highWaterMark: 1024 * 512 });

        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunkSize,
          'Content-Type': mime,
          'Cache-Control': 'public, max-age=31536000, immutable',
          'ETag': etag,
          'Last-Modified': mtime
        });
        fileStream.pipe(res);
      } else {
        res.writeHead(200, {
          'Content-Length': fileSize,
          'Content-Type': mime,
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'public, max-age=31536000, immutable',
          'ETag': etag,
          'Last-Modified': mtime
        });
        fs.createReadStream(vidPath, { highWaterMark: 1024 * 512 }).pipe(res);
      }
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Streaming error: ' + err.message);
    }
  }

  // 1. 壁纸视频流
  if (url.pathname === '/wallpaper.mp4') {
    const queryPath = url.searchParams.get('path');
    const config = readConfig();
    const targetVideo = queryPath || config.features?.dynamicWallpaper?.videoPath;
    const vidPath = resolveVideoPath(targetVideo, 'wallpaper');
    return streamVideoFile(vidPath);
  }

  // 2. 开机动画视频流
  if (url.pathname === '/boot-video.mp4') {
    const queryPath = url.searchParams.get('path');
    const config = readConfig();
    const targetVideo = queryPath || config.features?.bootAnimationConfig?.videoPath;
    const vidPath = resolveVideoPath(targetVideo, 'boot');
    return streamVideoFile(vidPath);
  }

  // 3. 通用本地视频代理
  if (url.pathname === '/api/video') {
    const targetPath = url.searchParams.get('path');
    const vidPath = resolveVideoPath(targetPath);
    return streamVideoFile(vidPath);
  }

  // 5. Vendor 静态库托管（场景动态渲染核心 webwallgl，仅本仓库随包文件，无路径参数）
  if (url.pathname === '/vendor/webwallgl.js' && (req.method === 'GET' || req.method === 'HEAD')) {
    const vendorFile = path.join(__dirname, 'vendor', 'webwallgl.js');
    if (!fs.existsSync(vendorFile)) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('vendor library not found');
      return;
    }
    serveLocalFile(req, res, vendorFile, {
      contentType: 'application/javascript; charset=utf-8',
      cacheControl: 'public, max-age=86400'
    });
    return;
  }

  // 4. 自定义动效脚本读取接口（支持智能路径解析与 fallback）
  if (url.pathname === '/api/script') {
    const targetPath = url.searchParams.get('path');
    const resolved = resolveScriptPath(targetPath);
    if (!fs.existsSync(resolved)) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Script file not found: ' + resolved }));
      return;
    }
    try {
      const content = fs.readFileSync(resolved, 'utf8');
      res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8' });
      res.end(content);
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  res.writeHead(404);
  res.end('Not Found');
});

server.listen(HTTP_PORT, '127.0.0.1', () => {
  console.log(`[Skin Engine] Local media & config server running on http://127.0.0.1:${HTTP_PORT}`);
  try { optimizeVideoAssets(); } catch (_) {}
});
server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.warn(`[Skin Engine] Port ${HTTP_PORT} already in use, assuming active daemon.`);
  } else {
    console.error('[Skin Engine] Server error:', e);
  }
});

// 5. 编译前端注入包 (Client Bundle)
function buildClientBundle() {
  const config = readConfig();

  // 读取样式
  const glassCss = fs.existsSync(path.join(PLUGIN_ROOT, 'client', 'styles', 'glass-theme.css'))
    ? fs.readFileSync(path.join(PLUGIN_ROOT, 'client', 'styles', 'glass-theme.css'), 'utf8')
    : '';

  const crtCss = fs.existsSync(path.join(PLUGIN_ROOT, 'client', 'styles', 'crt-theme.css'))
    ? fs.readFileSync(path.join(PLUGIN_ROOT, 'client', 'styles', 'crt-theme.css'), 'utf8')
    : '';

  // 读取客户端模块并移除 export 关键字以适配浏览器顶级执行
  function readClientModule(relPath) {
    const full = path.join(PLUGIN_ROOT, relPath);
    if (!fs.existsSync(full)) return '';
    let code = fs.readFileSync(full, 'utf8');
    return code.replace(/^export\s+(function|const|let|var|class)\s+/gm, (m, g1) => g1 + ' ');
  }


  const agyModalMod = readClientModule('client/modules/agy-modal.js');
  const mediaDisplayModalMod = readClientModule('client/modules/media-display-modal.js');
  const bootCode = readClientModule('client/modules/boot-animation.js');
  const wallpaperMod = readClientModule('client/modules/wallpaper.js');
  const crtMod = readClientModule('client/modules/crt-theme.js');
  const libraryUiMod = readClientModule('client/modules/wallpaper-library-ui.js');
  const appearanceMenuMod = readClientModule('client/modules/appearance-menu.js');
  const indexMod = readClientModule('client/index.js');

  let bundleParts = [];

  // WebWallGL 核心渲染引擎内联注入（0ms 秒开，彻底杜绝 macOS HTTPS 跨协议 Mixed Content 脚本拦截风险）
  const webwallglPath = path.join(PLUGIN_ROOT, 'sidecars', 'skin-engine', 'vendor', 'webwallgl.js');
  if (fs.existsSync(webwallglPath)) {
    try {
      const webwallglCode = fs.readFileSync(webwallglPath, 'utf8');
      if (webwallglCode) bundleParts.push(webwallglCode);
    } catch (e) {
      console.warn('[Skin Engine] Failed to inline webwallgl.js:', e);
    }
  }

  // 0. 最先置顶：第 0 毫秒强力实施标题栏完全透明，彻底消除开机动画加载前后的白条闪烁
  bundleParts.push(`(() => {
    try {
      if (typeof window !== 'undefined' && window.electronNative && typeof window.electronNative.setTitleBarOverlay === 'function') {
        const isCustom = (${JSON.stringify(config)}?.features?.themeStyles !== false);
        if (isCustom) {
          window.electronNative.setTitleBarOverlay({
            color: 'rgba(0, 0, 0, 0)',
            symbolColor: '#f8fafc',
            height: 35
          }).catch(() => {});
        }
      }
    } catch (_) {}
  })();`);

  // 全局注入变量
  bundleParts.push(`window.__AG_SKIN_PORT__ = ${HTTP_PORT};`);
  bundleParts.push(`window.__AG_SKIN_CONFIG__ = ${JSON.stringify(config)};`);
  bundleParts.push(`window.__AG_SKIN_GLASS_CSS__ = ${JSON.stringify(glassCss)};`);
  bundleParts.push(`window.__AG_SKIN_CRT_CSS__ = ${JSON.stringify(crtCss)};`);

  // 0.5 弹窗基座与独立参数设置弹窗（优先载入就绪）
  if (agyModalMod) bundleParts.push(agyModalMod);
  if (mediaDisplayModalMod) bundleParts.push(mediaDisplayModalMod);

  // 1. 开机动画模块（优先载入就绪，确保开机最早期捕获播放状态与挂载素材）
  if (bootCode) bundleParts.push(bootCode);

  // 2. 动态壁纸与毛玻璃模块
  bundleParts.push(wallpaperMod);

  // 2.5 外部 Wallpaper 素材库资产中心（须先于外观菜单注册到全局）
  if (libraryUiMod) bundleParts.push(libraryUiMod);

  // 3. CRT 及设置菜单模块
  bundleParts.push(crtMod);
  bundleParts.push(appearanceMenuMod);

  // 4. 汉化与多语言模块（由 window.__agyI18n 动态控制语言切换）
  const hansCode = readClientModule('client/modules/i18n-engine.js');
  if (hansCode) bundleParts.push(hansCode);

  // 5. 启动主入口
  bundleParts.push(indexMod);

  return bundleParts.join('\n\n');
}

// 6. CDP 探测与注入
function fetchJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

// 6. 活跃 CDP 会话管理与持续巡检保活 (Persistent Keep-Alive & Auto-Heal)
let browserWs = null;
let currentDevToolsPort = null;
let reconnectTimer = null;
let healthCheckTimer = null;

function createCdpSession(target, port) {
  const targetId = target.id || target.targetId;
  const wsUrl = target.webSocketDebuggerUrl || (port ? `ws://127.0.0.1:${port}/devtools/page/${targetId}` : null);

  if (!wsUrl) {
    console.warn(`[Skin Engine] Missing wsUrl for target ${targetId}`);
    return null;
  }

  let ws;
  try {
    ws = new WebSocket(wsUrl);
  } catch (e) {
    console.warn(`[Skin Engine] WebSocket creation failed for ${targetId}:`, e.message);
    return null;
  }

  let idCounter = 1;
  const pendingCalls = new Map();

  function send(method, params = {}) {
    return new Promise((res, rej) => {
      if (ws.readyState !== WebSocket.OPEN) {
        return rej(new Error(`WebSocket not open (state: ${ws.readyState})`));
      }
      const callId = idCounter++;
      pendingCalls.set(callId, { res, rej });
      ws.send(JSON.stringify({ id: callId, method, params }));
    });
  }

  const session = {
    targetId,
    ws,
    send,
    isHealthy: false,
    injecting: false,
    createdAt: Date.now(),
    unhealthyCount: 0
  };

  async function executeInjection() {
    if (session.injecting) return;
    session.injecting = true;
    try {
      const bundle = buildClientBundle();
      await send('Page.enable');
      await send('Runtime.enable');
      // 保持长连接下的全生命周期自动预载（先移除旧版本，避免重复执行残留）
      if (session.lastScriptId) {
        try {
          await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: session.lastScriptId });
        } catch (_) {}
      }
      const addRes = await send('Page.addScriptToEvaluateOnNewDocument', { source: bundle });
      if (addRes && addRes.identifier) {
        session.lastScriptId = addRes.identifier;
      }
      // 立即对当前 DOM 树执行挂载
      await send('Runtime.evaluate', { expression: bundle, returnByValue: true });
      session.isHealthy = true;
      console.log(`[Skin Engine] Successfully attached skin to target ${targetId}`);
    } catch (err) {
      console.warn(`[Skin Engine] Injection error on ${targetId}:`, err.message);
    } finally {
      session.injecting = false;
    }
  }

  ws.onopen = async () => {
    console.log(`[Skin Engine] CDP session opened for target ${targetId} (${target.title || target.url || ''})`);
    // 关键优化：WebSocket 握手就绪时同步标题栏属性，绝不向 DOM 预埋多余全屏容器
    try {
      await send('Runtime.evaluate', {
        expression: `(() => {
          if (window.electronNative && typeof window.electronNative.setTitleBarOverlay === 'function') {
            window.electronNative.setTitleBarOverlay({ color: 'rgba(0, 0, 0, 0)', symbolColor: '#f8fafc', height: 35 }).catch(() => {});
          }
        })()`
      });
    } catch (_) {}
    await executeInjection();
  };

  ws.onmessage = async (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.id && pendingCalls.has(msg.id)) {
        const { res, rej } = pendingCalls.get(msg.id);
        pendingCalls.delete(msg.id);
        if (msg.error) rej(new Error(msg.error.message || JSON.stringify(msg.error)));
        else res(msg.result);
        return;
      }

      // 页面导航或加载完成时的智能保活检查
      if (msg.method === 'Page.frameNavigated') {
        await executeInjection();
      } else if (msg.method === 'Page.loadEventFired') {
        try {
          const chk = await send('Runtime.evaluate', { expression: '!!window.__AG_SKIN_ATTACHED__', returnByValue: true });
          if (!chk?.result?.value) {
            await executeInjection();
          }
        } catch (_) {}
      }
    } catch (e) {}
  };

  ws.onclose = () => {
    console.log(`[Skin Engine] CDP session closed for ${targetId}`);
    activeSessions.delete(targetId);
  };

  ws.onerror = (err) => {
    console.warn(`[Skin Engine] CDP session error on ${targetId}:`, err.message || err);
    try { ws.close(); } catch (e) {}
    activeSessions.delete(targetId);
  };

  session.checkHealthAndHeal = async () => {
    if (ws.readyState !== WebSocket.OPEN) return;
    try {
      const result = await send('Runtime.evaluate', {
        expression: `(() => {
          if (typeof window.__agySyncTitleBar === 'function') {
            try { window.__agySyncTitleBar(true); } catch (e) {}
          }
          if (!window.__AG_SKIN_ATTACHED__) return false;
          const bridge = window.__agySkinBridge;
          const cfg = bridge ? bridge.getConfig() : window.__AG_SKIN_CONFIG__;
          // 关键防护：若开机动画正在全屏播放中，判定为健康活跃态，严禁重复注入打断动画或提前挂载壁纸！
          if (window.__agyBootPlaying ||
              document.getElementById('agy-video-boot-host') ||
              document.getElementById('agy-custom-code-boot-host') ||
              document.getElementById('agy-scene-boot-host')) {
            return true;
          }
          const needStyle = cfg?.features?.themeStyles !== false;
          const wallCfg = cfg?.features?.dynamicWallpaper;
          const wallType = wallCfg?.sourceType || (wallCfg?.wallpaperDir ? 'scene' : 'video');
          const wallHasSource = wallType === 'video'
            ? !!(wallCfg?.videoPath && String(wallCfg.videoPath).trim())
            : !!(wallCfg?.wallpaperDir && String(wallCfg.wallpaperDir).trim());
          const needWall = needStyle && wallCfg?.enabled === true && wallHasSource;
          if (needWall) {
            const wallElId = wallType === 'web' ? 'agy-dynamic-iframe' : (wallType === 'scene' ? 'agy-dynamic-scene' : 'agy-dynamic-video');
            if (!document.getElementById(wallElId)) return false;
          }
          if (needStyle && !document.getElementById("agy-dynamic-wallpaper-style")) return false;
          return true;
        })()`,
        returnByValue: true
      });

      const isAlive = result?.result?.value === true;
      if (!isAlive) {
        session.unhealthyCount = (session.unhealthyCount || 0) + 1;
        // 冷启动 20 秒内处于开屏或页面自然装配期，严禁触发暴力重注入打断已有渲染管线
        const ageMs = Date.now() - (session.createdAt || 0);
        if (ageMs > 20000 && session.unhealthyCount >= 3) {
          console.log(`[Skin Engine] Target ${targetId} lost skin or state out-of-sync (3 consecutive fails), auto-healing...`);
          session.unhealthyCount = 0;
          await executeInjection();
        }
      } else {
        session.unhealthyCount = 0;
      }
    } catch (e) {
      // 正在导航中，静默跳过
    }
  };

  return session;
}

// 6.5 精准主窗口 Target 判定（坚决剔除临时原生遮罩、嵌入插件 iframe、DevTools 等死靶）
function isMainAppTarget(target) {
  if (!target) return false;
  if (target.type && target.type !== 'page') return false;
  const url = (target.url || '').trim();
  // 必须排除原生临时 loadingOverlay、嵌入式 iframe、DevTools、扩展及空白页
  if (!url ||
      url.startsWith('data:') ||
      url.startsWith('plugin://') ||
      url.startsWith('devtools://') ||
      url.startsWith('chrome-extension://') ||
      url.startsWith('about:') ||
      url.includes('provisionSplash')) {
    return false;
  }
  // 必须为主应用实际工作区 URL (HTTP/HTTPS 或 vscode-file)
  if (url.startsWith('http://127.0.0.1') ||
      url.startsWith('https://127.0.0.1') ||
      url.startsWith('http://localhost') ||
      url.startsWith('https://localhost') ||
      url.startsWith('vscode-file://')) {
    return true;
  }
  return false;
}

// 6.6 动态接管并无损消除官方原生 Loading 遮罩（纯非侵入式 CDP 样式接管，100% 保持官方代码签名完整）
const neutralizedLoadingTargets = new Set();

function handleNativeLoadingOverlay(target, port) {
  const targetId = target.id || target.targetId;
  if (!targetId || neutralizedLoadingTargets.has(targetId)) return;
  neutralizedLoadingTargets.add(targetId);

  const wsUrl = target.webSocketDebuggerUrl || (port ? `ws://127.0.0.1:${port}/devtools/page/${targetId}` : null);
  if (!wsUrl) return;

  try {
    const ws = new WebSocket(wsUrl);
    ws.onopen = () => {
      console.log(`[Skin Engine] Detected native loadingOverlay (${targetId}), neutralizing official pulsating logo...`);
      const neutralizeScript = `
        try {
          const style = document.createElement('style');
          style.textContent = 'html, body { background: #000000 !important; } svg, .logo { display: none !important; opacity: 0 !important; visibility: hidden !important; }';
          if (document.head) {
            document.head.appendChild(style);
          } else if (document.documentElement) {
            document.documentElement.appendChild(style);
          }
          if (document.body) {
            document.body.style.background = '#000000';
            const logo = document.querySelector('.logo') || document.querySelector('svg');
            if (logo) logo.remove();
          }
        } catch (_) {}
      `;
      ws.send(JSON.stringify({
        id: 1,
        method: 'Runtime.evaluate',
        params: { expression: neutralizeScript }
      }));
      setTimeout(() => {
        try { ws.close(); } catch (_) {}
      }, 500);
    };
    ws.onerror = () => {
      try { ws.close(); } catch (_) {}
    };
  } catch (_) {}
}

// 7. 纯事件驱动核心：Browser 级别长连接与 0 轮询目标发现 (0% CPU Idle)
console.log('[Skin Engine] Antigravity Skin daemon active in Event-Driven mode (0% idle CPU).');

const sidecarBootStartTime = Date.now();
function getAdaptiveReconnectDelay() {
  // 冷启动黄金 8 秒内：采用 100ms 极速快频探测，直接砍掉原先 2 秒盲等等待！
  if (Date.now() - sidecarBootStartTime < 8000) {
    return 100;
  }
  return 2000;
}

function scheduleReconnect(delayMs) {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  const finalDelay = delayMs !== undefined ? delayMs : getAdaptiveReconnectDelay();
  reconnectTimer = setTimeout(() => {
    ensureEventDrivenEngine();
  }, finalDelay);
}

async function connectBrowserTarget(port) {
  if (browserWs && (browserWs.readyState === WebSocket.OPEN || browserWs.readyState === WebSocket.CONNECTING)) {
    return;
  }
  currentDevToolsPort = port;

  let versionInfo = null;
  try {
    versionInfo = await fetchJson(`http://127.0.0.1:${port}/json/version`);
  } catch (err) {
    scheduleReconnect(2000);
    return;
  }

  const browserWsUrl = versionInfo?.webSocketDebuggerUrl;
  if (!browserWsUrl) {
    scheduleReconnect(2000);
    return;
  }

  try {
    const ws = new WebSocket(browserWsUrl);
    browserWs = ws;

    ws.onopen = () => {
      console.log(`[Skin Engine] Browser-level CDP connected on port ${port}. Event-driven mode active (0% idle CPU).`);
      // 订阅全域 Target 事件推送（0 轮询，由 Chromium 在窗口创建或销毁时主动推送）
      ws.send(JSON.stringify({
        id: 1,
        method: 'Target.setDiscoverTargets',
        params: { discover: true }
      }));
    };

    ws.onmessage = async (event) => {
      try {
        const msg = JSON.parse(event.data);
        const method = msg.method;
        if (method === 'Target.targetCreated' || method === 'Target.targetInfoChanged') {
          const info = msg.params?.targetInfo;
          if (info) {
            const url = (info.url || '').trim();
            // 动态接管原生 loadingOverlay 遮罩
            if (url.startsWith('data:') && (url.includes('logo') || url.includes('svg') || url.includes('DOCTYPE') || url.includes('%3C') || url.includes('%21DOCTYPE'))) {
              const cfg = readConfig();
              if (cfg?.enabled && cfg?.features?.bootAnimation) {
                handleNativeLoadingOverlay(info, port);
              }
            } else if (isMainAppTarget(info)) {
              const targetId = info.targetId;
              let session = activeSessions.get(targetId);
              if (!session || session.ws.readyState !== WebSocket.OPEN) {
                const fullTarget = {
                  id: targetId,
                  targetId: targetId,
                  type: info.type,
                  title: info.title,
                  url: info.url,
                  webSocketDebuggerUrl: `ws://127.0.0.1:${port}/devtools/page/${targetId}`
                };
                session = createCdpSession(fullTarget, port);
                if (session) {
                  activeSessions.set(targetId, session);
                }
              }
            }
          }
        } else if (method === 'Target.targetDestroyed') {
          const targetId = msg.params?.targetId;
          if (targetId) {
            neutralizedLoadingTargets.delete(targetId);
            if (activeSessions.has(targetId)) {
              const session = activeSessions.get(targetId);
              try { session.ws.close(); } catch (_) {}
              activeSessions.delete(targetId);
              console.log(`[Skin Engine] Target destroyed via event: ${targetId}`);
            }
          }
        }
      } catch (_) {}
    };

    ws.onclose = () => {
      console.log('[Skin Engine] Browser-level CDP connection closed.');
      browserWs = null;
      scheduleReconnect();
    };

    ws.onerror = (err) => {
      console.warn('[Skin Engine] Browser-level CDP error:', err.message || err);
      try { ws.close(); } catch (_) {}
      browserWs = null;
      scheduleReconnect();
    };
  } catch (err) {
    browserWs = null;
    scheduleReconnect();
  }
}

let portFileWatcher = null;
function setupPortFileWatcher() {
  if (portFileWatcher) return;
  try {
    const portFile = getDevToolsPortPath();
    const dir = path.dirname(portFile);
    if (fs.existsSync(dir)) {
      portFileWatcher = fs.watch(dir, (eventType, filename) => {
        if (filename === 'DevToolsActivePort') {
          // 操作系统内核事件驱动：端口文件一旦创建或更新，0 毫秒即刻连接！
          ensureEventDrivenEngine();
        }
      });
      portFileWatcher.on('error', () => {
        try { portFileWatcher.close(); } catch (_) {}
        portFileWatcher = null;
      });
    }
  } catch (_) {}
}

async function ensureEventDrivenEngine() {
  const portFile = getDevToolsPortPath();
  if (!fs.existsSync(portFile)) {
    setupPortFileWatcher();
    scheduleReconnect();
    return;
  }

  let port = null;
  try {
    const raw = fs.readFileSync(portFile, 'utf8');
    const p = parseInt(raw.split(/\r?\n/)[0].trim(), 10);
    if (!isNaN(p) && p > 0) port = p;
  } catch (e) {
    scheduleReconnect();
    return;
  }

  if (!port) {
    scheduleReconnect();
    return;
  }

  if (browserWs && currentDevToolsPort !== port) {
    try { browserWs.close(); } catch (_) {}
    browserWs = null;
  }

  if (!browserWs || browserWs.readyState !== WebSocket.OPEN) {
    await connectBrowserTarget(port);
  }
}

// 启动内核文件监听与事件引擎
setupPortFileWatcher();
ensureEventDrivenEngine();

// 极温和保活巡检（每 4 秒检查一次，没有活跃窗口时完全不做 DOM 运算，0% CPU）
if (healthCheckTimer) clearInterval(healthCheckTimer);
healthCheckTimer = setInterval(async () => {
  if (!browserWs || browserWs.readyState !== WebSocket.OPEN) {
    await ensureEventDrivenEngine();
  }
  if (activeSessions.size > 0) {
    for (const [id, session] of activeSessions.entries()) {
      if (session && session.checkHealthAndHeal) {
        await session.checkHealthAndHeal();
      }
    }
  }
}, 4000);

// 8. 优雅退出与资源清理（杜绝重启客户端时形成僵尸进程占用端口）
function gracefulShutdown(signal) {
  console.log(`[Skin Engine] Received ${signal}, cleanly shutting down...`);
  if (reconnectTimer) clearTimeout(reconnectTimer);
  if (healthCheckTimer) clearInterval(healthCheckTimer);
  if (portFileWatcher) {
    try { portFileWatcher.close(); } catch (_) {}
    portFileWatcher = null;
  }
  if (browserWs) {
    try { browserWs.close(); } catch (_) {}
    browserWs = null;
  }
  for (const [id, session] of activeSessions.entries()) {
    try { session.ws.close(); } catch (e) {}
  }
  activeSessions.clear();
  neutralizedLoadingTargets.clear();
  try {
    server.close(() => {
      process.exit(0);
    });
  } catch (e) {
    process.exit(0);
  }
  setTimeout(() => process.exit(0), 1000).unref();
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGHUP', () => gracefulShutdown('SIGHUP'));
}

