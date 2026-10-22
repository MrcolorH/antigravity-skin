/**
 * wallpaper-library.mjs - Wallpaper Engine / WallpaperMachine 外部素材库解析与零拷贝伺服引擎
 *
 * 设计原则：
 *  1. 零拷贝：外部素材永远原地读取，绝不 fs.copyFile 到插件目录；
 *  2. 严格过滤：type === 'application' 或入口为 .exe 的壁纸一律跳过；
 *  3. 白名单：仅允许读取已授权库根目录（libraryPath）与已挂载单壁纸目录（mountedFolders）内的文件；
 *  4. 轻量缓存：按「目录 mtime + project.json mtime」自动失效，全量扫描 300+ 壁纸仅首次触盘。
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const VIDEO_EXTS = new Set(['.mp4', '.webm', '.mov', '.mkv', '.m4v']);
const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif', '.bmp']);
const AUDIO_EXTS = new Set(['.mp3', '.ogg', '.wav', '.m4a', '.flac', '.aac']);
const WEB_ENTRY_NAMES = ['index.html', 'index.htm'];
const PREVIEW_NAMES = ['preview.jpg', 'preview.jpeg', 'preview.gif', 'preview.png', 'preview.webp'];
const SCENE_ENTRY_NAMES = ['scene.json', 'scene.pkg'];

export const WALLPAPER_TYPES = ['video', 'web', 'scene'];

const MIME_MAP = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.bmp': 'image/bmp',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.mkv': 'video/x-matroska',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.flac': 'audio/flac',
  '.aac': 'audio/aac',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.txt': 'text/plain; charset=utf-8'
};

export function getMimeType(filePath) {
  return MIME_MAP[path.extname(filePath || '').toLowerCase()] || 'application/octet-stream';
}

function safeReaddir(dir) {
  try {
    return fs.readdirSync(dir, { withFileTypes: true });
  } catch (_) {
    return [];
  }
}

function statSafe(p) {
  try {
    return fs.statSync(p);
  } catch (_) {
    return null;
  }
}

/**
 * 判断 target 是否位于 root 内部（含 root 自身）。跨盘符返回 false。
 */
export function isSubPath(root, target) {
  if (!root || !target) return false;
  const rel = path.relative(path.resolve(root), path.resolve(target));
  if (rel === '') return true;
  if (path.isAbsolute(rel)) return false;
  return !rel.startsWith('..' + path.sep) && rel !== '..';
}

/**
 * 年龄分级归一化（对齐 Steam 创意工坊 / WallpaperMachine 的 rating 标签）。
 * - Everyone (G) / Questionable (PG-13) / Mature (R-18)
 * - 缺失时按 Wallpaper Engine 官方默认视作 Everyone，并标记 inferred
 * - 未来未知分级归入 unknown（始终可见，不参与排除）
 */
export function normalizeRating(raw) {
  const value = String(raw || '').trim().toLowerCase();
  if (!value) return { rating: 'everyone', ratingInferred: true };
  if (value === 'everyone' || value === 'g' || value === 'all') {
    return { rating: 'everyone', ratingInferred: false };
  }
  if (value === 'questionable' || value === 'pg-13' || value === 'pg13' || value === 'pg') {
    return { rating: 'questionable', ratingInferred: false };
  }
  if (value === 'mature' || value === 'r-18' || value === 'r18' || value === 'r') {
    return { rating: 'mature', ratingInferred: false };
  }
  return { rating: 'unknown', ratingInferred: false };
}

/** 清理 Wallpaper Engine 描述中的 BBCode / HTML，便于 UI 一行展示 */
function cleanDescription(raw, maxLen = 180) {
  if (!raw || typeof raw !== 'string') return '';
  let out = raw
    .replace(/\[\/?(img|url|b|i|u|h1|h2|h3|list|\*|spoiler|quote|code)[^\]]*\]/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .trim();
  if (out.length > maxLen) out = out.slice(0, maxLen).trim() + '…';
  return out;
}

/** 在目录清单中按文件名（不区分大小写）定位入口文件 */
function findEntry(files, name) {
  if (!name) return '';
  const target = String(name).replace(/\\/g, '/').toLowerCase();
  const hit = files.find(f => f.rel.toLowerCase() === target) ||
              files.find(f => f.name.toLowerCase() === path.basename(target));
  return hit ? hit.rel : '';
}

function inferTypeFromEntry(entryRel) {
  const ext = path.extname(entryRel || '').toLowerCase();
  if (VIDEO_EXTS.has(ext)) return 'video';
  if (ext === '.html' || ext === '.htm') return 'web';
  if (ext === '.json' || ext === '.pkg') return 'scene';
  return '';
}

/** 浅层递归收集文件（最多 maxDepth 层），用于无 project.json 或入口失效时的兜底 */
function collectFiles(dir, maxDepth = 1, base = '', out = []) {
  if (maxDepth < 0) return out;
  for (const d of safeReaddir(dir)) {
    if (d.name.startsWith('.')) continue;
    const rel = base ? `${base}/${d.name}` : d.name;
    const full = path.join(dir, d.name);
    if (d.isFile()) {
      const st = statSafe(full);
      out.push({
        name: d.name,
        rel,
        ext: path.extname(d.name).toLowerCase(),
        size: st ? st.size : 0,
        mtimeMs: st ? st.mtimeMs : 0
      });
    } else if (d.isDirectory() && maxDepth > 0) {
      collectFiles(full, maxDepth - 1, rel, out);
    }
  }
  return out;
}

/**
 * 解析单个壁纸目录。
 * 返回 { ok, wallpaper?, skipped?, reason?, error? }
 */
export function parseWallpaperFolder(folderPath) {
  if (!folderPath || typeof folderPath !== 'string') {
    return { ok: false, error: '缺少壁纸目录路径' };
  }
  const abs = path.resolve(folderPath.trim().replace(/^["']|["']$/g, ''));
  const dirStat = statSafe(abs);
  if (!dirStat) return { ok: false, error: `目录不存在或不可访问：${abs}` };
  if (!dirStat.isDirectory()) return { ok: false, error: `目标不是文件夹：${abs}` };

  const folderName = path.basename(abs);
  const manifestPath = path.join(abs, 'project.json');
  let project = null;
  let hasManifest = false;

  if (fs.existsSync(manifestPath)) {
    hasManifest = true;
    try {
      const raw = fs.readFileSync(manifestPath, 'utf8').replace(/^\uFEFF/, '');
      project = JSON.parse(raw);
    } catch (_) {
      project = null;
    }
  }

  const topFiles = collectFiles(abs, 1);
  const rawType = String(project?.type || '').trim().toLowerCase();
  const declaredFile = typeof project?.file === 'string' ? project.file : '';
  const title = (project?.title && String(project.title).trim()) || folderName;
  const previewDeclared = typeof project?.preview === 'string' ? project.preview : '';

  // ---- 1. 严格过滤 application / exe ----
  if (rawType === 'application' || /\.exe$/i.test(declaredFile)) {
    return {
      ok: true,
      skipped: true,
      reason: 'application',
      wallpaper: { id: folderName, folderPath: abs, title, type: 'application' }
    };
  }

  // ---- 2. 类型归一化（真实库中存在 Web / Scene / Video 大写写法）----
  let type = rawType;
  if (!WALLPAPER_TYPES.includes(type)) {
    type = inferTypeFromEntry(declaredFile) || '';
  }
  if (!type) {
    if (topFiles.some(f => VIDEO_EXTS.has(f.ext) && !f.rel.includes('/'))) type = 'video';
    else if (topFiles.some(f => WEB_ENTRY_NAMES.includes(f.name.toLowerCase()))) type = 'web';
    else if (topFiles.some(f => SCENE_ENTRY_NAMES.includes(f.name.toLowerCase()))) type = 'scene';
  }
  if (!type) {
    return { ok: true, skipped: true, reason: 'unknown-type', wallpaper: { id: folderName, folderPath: abs, title } };
  }

  // ---- 3. 入口文件解析 ----
  let entryFile = declaredFile ? findEntry(topFiles, declaredFile) : '';
  if (!entryFile) {
    if (type === 'web') {
      const webHit = topFiles.find(f => WEB_ENTRY_NAMES.includes(f.name.toLowerCase()) && !f.rel.includes('/'));
      entryFile = webHit ? webHit.rel : '';
    } else if (type === 'video') {
      const vidHit = topFiles.find(f => VIDEO_EXTS.has(f.ext));
      entryFile = vidHit ? vidHit.rel : '';
    } else if (type === 'scene') {
      const sceneHit = topFiles.find(f => SCENE_ENTRY_NAMES.includes(f.name.toLowerCase()) && !f.rel.includes('/'));
      entryFile = sceneHit ? sceneHit.rel : '';
    }
  }

  // 三无目录：既无清单也无有效入口，跳过以免污染资产中心
  if (!entryFile && !previewDeclared && !topFiles.some(f => IMAGE_EXTS.has(f.ext))) {
    return { ok: true, skipped: true, reason: 'missing-media', wallpaper: { id: folderName, folderPath: abs, title } };
  }

  // ---- 4. 封面解析（优先 project.preview，其次标准命名，最后任意图片）----
  let previewFile = previewDeclared ? findEntry(topFiles, previewDeclared) : '';
  if (!previewFile) {
    for (const name of PREVIEW_NAMES) {
      const hit = topFiles.find(f => f.name.toLowerCase() === name);
      if (hit) { previewFile = hit.rel; break; }
    }
  }
  if (!previewFile) {
    const imgHit = topFiles.find(f => IMAGE_EXTS.has(f.ext) && !f.rel.includes('/'));
    if (imgHit) previewFile = imgHit.rel;
  }

  // ---- 5. 场景壁纸内嵌音频（氛围音）----
  let audioFile = '';
  if (type === 'scene' || type === 'web') {
    const audioHit = topFiles.find(f => AUDIO_EXTS.has(f.ext));
    if (audioHit) audioFile = audioHit.rel;
  }

  const entryMeta = entryFile ? topFiles.find(f => f.rel === entryFile) : null;
  const previewMeta = previewFile ? topFiles.find(f => f.rel === previewFile) : null;
  const totalSize = topFiles.reduce((sum, f) => sum + (f.size || 0), 0);
  const ratingInfo = normalizeRating(project?.contentrating);

  const wallpaper = {
    id: folderName,
    folderPath: abs,
    folderName,
    title,
    type,
    sourceType: type,
    entryFile,
    previewFile,
    audioFile,
    // 主文件体积（视频/网页入口），无入口时回退到封面体积
    size: (entryMeta && entryMeta.size) || (previewMeta && previewMeta.size) || 0,
    totalSize,
    description: cleanDescription(project?.description || ''),
    author: String(project?.author || project?.general?.author || '').trim(),
    tags: Array.isArray(project?.tags) ? project.tags.slice(0, 8).map(t => String(t)) : [],
    contentRating: String(project?.contentrating || ''),
    // 年龄分级：对齐 Steam / WallpaperMachine 的 Everyone | Questionable | Mature
    rating: ratingInfo.rating,
    ratingInferred: ratingInfo.ratingInferred,
    ratingRaw: String(project?.contentrating || ''),
    ratingSex: String(project?.ratingsex || ''),
    ratingViolence: String(project?.ratingviolence || ''),
    hasManifest,
    virtual: !hasManifest,
    addedAt: dirStat.mtimeMs ? new Date(dirStat.mtimeMs).toISOString() : '',
    streamable: type === 'video' && !!entryFile,
    scalable: type === 'scene'
  };

  return { ok: true, wallpaper };
}

/** 在已知根目录中，按文件夹名（工坊 id）定位壁纸目录 */
export function resolveFolderByHint(hint, roots) {
  const raw = String(hint || '').trim().replace(/^["']|["']$/g, '');
  if (!raw) return null;
  // 1. 直接就是绝对路径
  if (path.isAbsolute(raw)) {
    const st = statSafe(raw);
    if (st && st.isDirectory()) return path.resolve(raw);
  }
  // 2. 逐个根目录拼接探测（支持多级相对路径）
  for (const root of roots || []) {
    if (!root) continue;
    const candidate = path.resolve(root, raw);
    const st = statSafe(candidate);
    if (st && st.isDirectory()) return candidate;
  }
  // 3. 仅给出目录名时，在根目录第一层匹配
  const base = path.basename(raw);
  for (const root of roots || []) {
    if (!root) continue;
    const candidate = path.join(root, base);
    const st = statSafe(candidate);
    if (st && st.isDirectory()) return candidate;
  }
  return null;
}

// ---------------- 扫描缓存（目录 mtime 驱动，天然失效） ----------------
const scanCache = new Map(); // folderPath -> { stamp, data }

function computeStamp(abs) {
  const dirStat = statSafe(abs);
  if (!dirStat) return '';
  const manifestStat = statSafe(path.join(abs, 'project.json'));
  return `${dirStat.mtimeMs}|${manifestStat ? manifestStat.mtimeMs : 0}`;
}

function parseWithCache(abs) {
  const stamp = computeStamp(abs);
  const cached = scanCache.get(abs);
  if (cached && cached.stamp === stamp) {
    return { ...cached.data, cached: true };
  }
  const result = parseWallpaperFolder(abs);
  if (result.ok) {
    scanCache.set(abs, { stamp, data: result });
  }
  return { ...result, cached: false };
}

export function clearScanCache() {
  scanCache.clear();
}

async function mapLimit(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  const runners = new Array(Math.min(limit, items.length || 1)).fill(0).map(async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index], index);
    }
  });
  await Promise.all(runners);
  return results;
}

/**
 * 扫描素材库根目录下所有子文件夹。
 */
export async function scanLibrary(rootPath, options = {}) {
  const startedAt = Date.now();
  if (!rootPath) return { ok: false, error: '缺少素材库根目录路径' };
  const root = path.resolve(String(rootPath).trim().replace(/^["']|["']$/g, ''));
  const rootStat = statSafe(root);
  if (!rootStat) return { ok: false, error: `素材库根目录不存在：${root}` };
  if (!rootStat.isDirectory()) return { ok: false, error: `素材库根目录不是文件夹：${root}` };

  if (options.force) {
    // 仅清理该根目录下的缓存条目，避免误伤其他已挂载目录
    for (const key of Array.from(scanCache.keys())) {
      if (isSubPath(root, key)) scanCache.delete(key);
    }
  }

  const entries = safeReaddir(root).filter(d => d.isDirectory() && !d.name.startsWith('.'));
  const parsed = await mapLimit(entries, 8, d => parseWithCache(path.join(root, d.name)));

  const wallpapers = [];
  const filtered = [];
  for (const item of parsed) {
    if (!item || !item.ok) continue;
    if (item.skipped) {
      filtered.push({
        id: item.wallpaper?.id || '',
        title: item.wallpaper?.title || '',
        reason: item.reason,
        type: item.wallpaper?.type || 'unknown'
      });
      continue;
    }
    wallpapers.push(item.wallpaper);
  }

  // 最新添加优先，同时间按标题排序，保证界面稳定可预期
  wallpapers.sort((a, b) => {
    if (b.addedAt !== a.addedAt) return String(b.addedAt).localeCompare(String(a.addedAt));
    return String(a.title).localeCompare(String(b.title), 'zh-CN');
  });

  return {
    ok: true,
    root,
    wallpapers,
    filtered,
    stats: {
      total: entries.length,
      supported: wallpapers.length,
      filtered: filtered.length,
      byType: wallpapers.reduce((acc, w) => {
        acc[w.type] = (acc[w.type] || 0) + 1;
        return acc;
      }, {}),
      // 年龄分级计数：供前端 chip 展示（包含 everyone 的缺失兜底桶）
      byRating: wallpapers.reduce((acc, w) => {
        const key = w.rating || 'unknown';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, { everyone: 0, questionable: 0, mature: 0, unknown: 0 })
    },
    durationMs: Date.now() - startedAt,
    scannedAt: new Date().toISOString()
  };
}

// ---------------- 默认素材库目录自动探测 ----------------
function pushCandidate(list, p, label, kind) {
  if (!p) return;
  const abs = path.resolve(p);
  if (list.some(item => item.path.toLowerCase() === abs.toLowerCase())) return;
  const st = statSafe(abs);
  if (!st || !st.isDirectory()) return;
  let count = 0;
  try {
    count = safeReaddir(abs).filter(d => d.isDirectory()).length;
  } catch (_) {}
  list.push({ path: abs, label, kind, count });
}

/** 解析 Steam 的 libraryfolders.vdf，取出所有 Steam 库根目录 */
function readSteamLibraries(steamRoot) {
  const vdf = path.join(steamRoot, 'steamapps', 'libraryfolders.vdf');
  const stat = statSafe(vdf);
  if (!stat) return [];
  try {
    const text = fs.readFileSync(vdf, 'utf8');
    const paths = [];
    const re = /"path"\s+"([^"]+)"/gi;
    let m;
    while ((m = re.exec(text))) {
      paths.push(m[1].replace(/\\\\/g, '\\'));
    }
    return paths;
  } catch (_) {
    return [];
  }
}

/**
 * 探测本机常见 Wallpaper Engine / WallpaperMachine 素材库目录。
 * 返回 [{ path, label, kind, count }]
 */
export function detectLibraryCandidates() {
  const found = [];
  const home = os.homedir();

  if (process.platform === 'darwin') {
    pushCandidate(found, path.join(home, 'Library', 'Application Support', 'WallpaperMachine', 'Library'), 'WallpaperMachine 默认素材库', 'wallpapermachine');
    pushCandidate(found, path.join(home, 'Library', 'Application Support', 'Steam', 'steamapps', 'workshop', 'content', '431960'), 'Steam 创意工坊 Wallpaper Engine', 'steam');
  } else if (process.platform === 'win32') {
    const steamRoots = new Set();
    const pf86 = process.env['ProgramFiles(x86)'];
    const pf = process.env['ProgramFiles'];
    if (pf86) steamRoots.add(path.join(pf86, 'Steam'));
    if (pf) steamRoots.add(path.join(pf, 'Steam'));
    // 常见盘符逐盘探测（仅 stat，成本极低）
    for (let i = 67; i <= 90; i++) {
      const drive = `${String.fromCharCode(i)}:\\`;
      steamRoots.add(path.join(drive, 'Steam'));
      steamRoots.add(path.join(drive, 'SteamLibrary'));
      steamRoots.add(path.join(drive, 'Program Files (x86)', 'Steam'));
      steamRoots.add(path.join(drive, 'Games', 'Steam'));
    }

    const workshopQueue = [];
    for (const root of steamRoots) {
      const st = statSafe(root);
      if (!st || !st.isDirectory()) continue;
      workshopQueue.push(path.join(root, 'steamapps', 'workshop', 'content', '431960'));
      for (const libRoot of readSteamLibraries(root)) {
        workshopQueue.push(path.join(libRoot, 'steamapps', 'workshop', 'content', '431960'));
      }
    }
    for (const p of workshopQueue) {
      pushCandidate(found, p, 'Steam 创意工坊 Wallpaper Engine', 'steam');
    }
    // 兜底：部分用户把素材直接放在 Wallpaper Engine 安装目录的 projects 下
    for (const root of steamRoots) {
      if (found.length) break;
      pushCandidate(found, path.join(root, 'steamapps', 'common', 'wallpaper_engine', 'projects', 'myprojects'), 'Wallpaper Engine 本地项目目录', 'steam');
    }
  } else {
    pushCandidate(found, path.join(home, '.local', 'share', 'Steam', 'steamapps', 'workshop', 'content', '431960'), 'Steam 创意工坊 Wallpaper Engine', 'steam');
    pushCandidate(found, path.join(home, '.steam', 'steam', 'steamapps', 'workshop', 'content', '431960'), 'Steam 创意工坊 Wallpaper Engine', 'steam');
  }

  // 单一文件（非目录）场景兜底：Windows 上 Wallpaper Engine 也可安装在非标准路径，
  // 此时仅返回已探测到的结果，由用户手动粘贴路径。
  return found;
}

// ---------------- 静态文件伺服（支持 Range / 304 / HEAD） ----------------
export function serveLocalFile(req, res, filePath, options = {}) {
  const stat = statSafe(filePath);
  if (!stat || !stat.isFile()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not Found: ' + path.basename(filePath || ''));
    return false;
  }

  const contentType = options.contentType || getMimeType(filePath);
  const cacheControl = options.cacheControl || 'public, max-age=86400';
  const etag = `"${stat.size}-${Math.floor(stat.mtimeMs)}"`;

  const baseHeaders = {
    'Content-Type': contentType,
    'Accept-Ranges': 'bytes',
    'Cache-Control': cacheControl,
    'ETag': etag,
    'Last-Modified': stat.mtime.toUTCString(),
    // Web 壁纸为同源 iframe 场景，放开跨域便于调试与资源加载
    'Access-Control-Allow-Origin': '*'
  };

  if (req.headers['if-none-match'] === etag) {
    res.writeHead(304, baseHeaders);
    res.end();
    return true;
  }

  if (req.method === 'HEAD') {
    res.writeHead(200, { ...baseHeaders, 'Content-Length': stat.size });
    res.end();
    return true;
  }

  const range = req.headers.range;
  if (range && /^bytes=/.test(range)) {
    const parts = String(range).replace(/bytes=/, '').split('-');
    let start = parseInt(parts[0], 10);
    let end = parts[1] !== undefined && parts[1] !== '' ? parseInt(parts[1], 10) : stat.size - 1;
    if (isNaN(start)) start = 0;
    if (isNaN(end) || end >= stat.size) end = stat.size - 1;
    if (start > end || start >= stat.size) {
      res.writeHead(416, { 'Content-Range': `bytes */${stat.size}` });
      res.end();
      return true;
    }
    res.writeHead(206, {
      ...baseHeaders,
      'Content-Range': `bytes ${start}-${end}/${stat.size}`,
      'Content-Length': (end - start) + 1
    });
    fs.createReadStream(filePath, { start, end, highWaterMark: 256 * 1024 })
      .on('error', () => { try { res.end(); } catch (_) {} })
      .pipe(res);
    return true;
  }

  res.writeHead(200, { ...baseHeaders, 'Content-Length': stat.size });
  fs.createReadStream(filePath, { highWaterMark: 256 * 1024 })
    .on('error', () => { try { res.end(); } catch (_) {} })
    .pipe(res);
  return true;
}
