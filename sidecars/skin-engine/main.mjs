import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

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
function readConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    }
    if (fs.existsSync(DEFAULT_CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(DEFAULT_CONFIG_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('[Skin Engine] Failed to read config:', e);
  }
  return {
    enabled: true,
    features: {
      bootAnimation: false,
      bootAnimationConfig: {
        type: 'video',
        customCodePath: '',
        videoPath: ''
      },
      themeStyles: true,
      crtScanlines: false,
      chineseLocalization: true,
      dynamicWallpaper: {
        enabled: false,
        videoPath: '',
        brightness: 0.85,
        contrast: 1.05
      }
    }
  };
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
const HTTP_PORT = 59288;

function resolveVideoPath(videoPath) {
  if (!videoPath) {
    return null;
  }
  // 1. 绝对路径且存在
  if (path.isAbsolute(videoPath)) {
    if (fs.existsSync(videoPath)) return videoPath;
  } else {
    // 2. 相对插件根目录路径（如 assets/videos/xxx.mp4）
    const rel = path.resolve(PLUGIN_ROOT, videoPath);
    if (fs.existsSync(rel)) return rel;

    // 3. 如果是纯文件名或简写路径，优先在 assets/videos/ 中查找同名素材
    const baseName = path.basename(videoPath);
    const inAssets = path.join(ASSETS_DIR, 'videos', baseName);
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

  // API: 保存配置
  if (url.pathname === '/api/config' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const parsed = JSON.parse(body);
        writeConfig(parsed);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // API: 获取内置壁纸视频列表
  if (url.pathname === '/api/wallpaper/list' && req.method === 'GET') {
    try {
      const videosDir = path.join(ASSETS_DIR, 'videos');
      if (!fs.existsSync(videosDir)) {
        fs.mkdirSync(videosDir, { recursive: true });
      }
      const files = fs.readdirSync(videosDir);
      const validExts = ['.mp4', '.webm', '.mov', '.mkv'];
      const videos = [];
      for (const file of files) {
        const ext = path.extname(file).toLowerCase();
        if (validExts.includes(ext)) {
          const fullPath = path.join(videosDir, file);
          const stat = fs.statSync(fullPath);
          videos.push({
            name: file,
            displayName: `🎬 ${file}`,
            relPath: `assets/videos/${file}`,
            size: stat.size,
            isDefault: false
          });
        }
      }
      videos.sort((a, b) => a.name.localeCompare(b.name));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, videos }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: err.message }));
    }
    return;
  }

  // API: 直接二进制流上传外部视频到内置 assets/videos 目录
  if (url.pathname === '/api/wallpaper/upload' && req.method === 'POST') {
    try {
      let fileNameParam = url.searchParams.get('name') || `custom_${Date.now()}.mp4`;
      try { fileNameParam = decodeURIComponent(fileNameParam); } catch (_) {}
      const cleanFileName = path.basename(fileNameParam).replace(/[^\w\d\.\-_\u4e00-\u9fa5]/g, '_');
      const videosDir = path.join(ASSETS_DIR, 'videos');
      if (!fs.existsSync(videosDir)) {
        fs.mkdirSync(videosDir, { recursive: true });
      }

      const parsedPath = path.parse(cleanFileName);
      let targetFileName = parsedPath.base;
      let destPath = path.join(videosDir, targetFileName);

      // 如果同名文件已存在，为避免覆盖生成不重复的文件名
      if (fs.existsSync(destPath)) {
        targetFileName = `${parsedPath.name}_${Date.now()}${parsedPath.ext || '.mp4'}`;
        destPath = path.join(videosDir, targetFileName);
      }

      const fileWriteStream = fs.createWriteStream(destPath);
      req.pipe(fileWriteStream);

      fileWriteStream.on('finish', () => {
        const relPath = `assets/videos/${targetFileName}`;
        console.log(`[Skin Engine] Successfully uploaded video: ${relPath}`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          ok: true,
          relPath,
          fileName: targetFileName,
          message: '已成功上传并保存到插件内置素材库'
        }));
      });

      fileWriteStream.on('error', (err) => {
        console.error('[Skin Engine] Failed to write uploaded video:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: '写入文件失败: ' + err.message }));
      });
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: err.message }));
    }
    return;
  }

  // API: 导入外部视频到内置 assets/videos 目录（支持绝对路径复制）
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

        const videosDir = path.join(ASSETS_DIR, 'videos');
        if (!fs.existsSync(videosDir)) {
          fs.mkdirSync(videosDir, { recursive: true });
        }

        const parsedPath = path.parse(sourcePath);
        let targetFileName = parsedPath.base;
        let destPath = path.join(videosDir, targetFileName);

        if (fs.existsSync(destPath)) {
          const srcStat = fs.statSync(sourcePath);
          const destStat = fs.statSync(destPath);
          if (srcStat.size !== destStat.size) {
            targetFileName = `${parsedPath.name}_${Date.now()}${parsedPath.ext}`;
            destPath = path.join(videosDir, targetFileName);
            fs.copyFileSync(sourcePath, destPath);
          }
        } else {
          fs.copyFileSync(sourcePath, destPath);
        }

        const relPath = `assets/videos/${targetFileName}`;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          ok: true,
          relPath,
          fileName: targetFileName,
          message: '已成功复制到插件内置素材库'
        }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: err.message }));
      }
    });
    return;
  }

  // API: 删除内置 assets/videos 中的视频素材
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
        const videosDir = path.join(ASSETS_DIR, 'videos');
        const targetFullPath = path.join(videosDir, baseName);

        // 安全检查：防止目录穿越
        if (!targetFullPath.startsWith(videosDir)) {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: '非法路径，禁止访问素材库以外的文件' }));
          return;
        }

        if (fs.existsSync(targetFullPath)) {
          fs.unlinkSync(targetFullPath);
          console.log(`[Skin Engine] Successfully deleted video file: ${targetFullPath}`);
        }

        // 检查并自动更新配置文件，如果正在使用的是被删除的文件，重置为空
        const config = readConfig();
        let configChanged = false;
        if (config.features?.dynamicWallpaper?.videoPath &&
            (config.features.dynamicWallpaper.videoPath.includes(baseName) || config.features.dynamicWallpaper.videoPath === targetRelPath)) {
          config.features.dynamicWallpaper.videoPath = '';
          configChanged = true;
        }
        if (config.features?.bootAnimationConfig?.videoPath &&
            (config.features.bootAnimationConfig.videoPath.includes(baseName) || config.features.bootAnimationConfig.videoPath === targetRelPath)) {
          config.features.bootAnimationConfig.videoPath = '';
          configChanged = true;
        }
        if (configChanged) {
          writeConfig(config);
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          ok: true,
          message: `已成功删除素材：${baseName}`,
          fallbackPath: '',
          configReset: configChanged
        }));
      } catch (err) {
        console.error('[Skin Engine] Delete video error:', err);
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

  // 视频流服务核心函数
  function streamVideoFile(vidPath, contentType = 'video/mp4') {
    if (!vidPath || !fs.existsSync(vidPath)) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Video not found');
      return;
    }

    try {
      const stat = fs.statSync(vidPath);
      const fileSize = stat.size;
      const range = req.headers.range;

      if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunkSize = (end - start) + 1;
        const fileStream = fs.createReadStream(vidPath, { start, end });

        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunkSize,
          'Content-Type': contentType
        });
        fileStream.pipe(res);
      } else {
        res.writeHead(200, {
          'Content-Length': fileSize,
          'Content-Type': contentType
        });
        fs.createReadStream(vidPath).pipe(res);
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
    const vidPath = resolveVideoPath(targetVideo);
    return streamVideoFile(vidPath);
  }

  // 2. 开机动画视频流
  if (url.pathname === '/boot-video.mp4') {
    const queryPath = url.searchParams.get('path');
    const config = readConfig();
    const targetVideo = queryPath || config.features?.bootAnimationConfig?.videoPath;
    const vidPath = resolveVideoPath(targetVideo);
    return streamVideoFile(vidPath);
  }

  // 3. 通用本地视频代理
  if (url.pathname === '/api/video') {
    const targetPath = url.searchParams.get('path');
    const vidPath = resolveVideoPath(targetPath);
    return streamVideoFile(vidPath);
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


  const bootCode = readClientModule('client/modules/boot-animation.js');
  const wallpaperMod = readClientModule('client/modules/wallpaper.js');
  const crtMod = readClientModule('client/modules/crt-theme.js');
  const appearanceMenuMod = readClientModule('client/modules/appearance-menu.js');
  const indexMod = readClientModule('client/index.js');

  let bundleParts = [];

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

  // 1. 开机动画模块（优先载入就绪，确保开机最早期捕获播放状态与挂载素材）
  if (bootCode) bundleParts.push(bootCode);

  // 2. 动态壁纸与毛玻璃模块
  bundleParts.push(wallpaperMod);

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
const activeSessions = new Map(); // targetId -> { ws, send, isAttached }

function createCdpSession(target) {
  const targetId = target.id;
  const wsUrl = target.webSocketDebuggerUrl;

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
    injecting: false
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
    console.log(`[Skin Engine] CDP session opened for target ${targetId} (${target.title || target.url})`);
    // 关键优化：WebSocket 刚建立握手的第 0 毫秒，立即极速执行轻量透明指令，消除大 bundle 编译等待期间的视觉白块
    try {
      await send('Runtime.evaluate', {
        expression: `if (window.electronNative && typeof window.electronNative.setTitleBarOverlay === 'function') {
          window.electronNative.setTitleBarOverlay({ color: 'rgba(0, 0, 0, 0)', symbolColor: '#f8fafc', height: 35 }).catch(() => {});
        }`
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
              (cfg?.features?.bootAnimation && !sessionStorage.getItem('__agy_booted__'))) {
            return true;
          }
          const needStyle = cfg?.features?.themeStyles !== false;
          const wallCfg = cfg?.features?.dynamicWallpaper;
          const needWall = needStyle && wallCfg?.enabled === true && !!(wallCfg?.videoPath && String(wallCfg.videoPath).trim());
          if (needWall && !document.getElementById("agy-dynamic-video")) return false;
          if (needStyle && !document.getElementById("agy-dynamic-wallpaper-style")) return false;
          return true;
        })()`,
        returnByValue: true
      });

      const isAlive = result?.result?.value === true;
      if (!isAlive) {
        console.log(`[Skin Engine] Target ${targetId} lost skin or state out-of-sync, auto-healing...`);
        await executeInjection();
      }
    } catch (e) {
      // 正在导航中，静默跳过
    }
  };

  return session;
}

// 6.5 精准主窗口 Target 判定（坚决剔除临时原生遮罩、嵌入插件 iframe、DevTools 等死靶）
function isMainAppTarget(target) {
  if (!target || !target.webSocketDebuggerUrl) return false;
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

async function pollAndInject() {
  const portFile = getDevToolsPortPath();
  if (!fs.existsSync(portFile)) return;

  let port = null;
  try {
    const raw = fs.readFileSync(portFile, 'utf8');
    const p = parseInt(raw.split(/\r?\n/)[0].trim(), 10);
    if (!isNaN(p) && p > 0) port = p;
  } catch (e) {
    return;
  }

  if (!port) return;

  try {
    const targets = await fetchJson(`http://127.0.0.1:${port}/json/list`);
    if (!Array.isArray(targets)) return;

    const currentTargetIds = new Set();

    for (const target of targets) {
      // 核心拦截：精准识别主窗口，彻底避免打到临时 loadingOverlay 导致状态竞态
      if (isMainAppTarget(target)) {
        currentTargetIds.add(target.id);

        let session = activeSessions.get(target.id);
        if (!session || session.ws.readyState !== WebSocket.OPEN) {
          session = createCdpSession(target);
          if (session) {
            activeSessions.set(target.id, session);
          }
        } else {
          // 常驻会话定期巡检与自愈
          await session.checkHealthAndHeal();
        }
      }
    }

    // 清理已关闭的 target
    for (const [id, session] of activeSessions.entries()) {
      if (!currentTargetIds.has(id)) {
        try { session.ws.close(); } catch (e) {}
        activeSessions.delete(id);
      }
    }
  } catch (e) {
    // 宿主可能尚未就绪，静默重试
  }
}

// 7. 高速冷启动探测与常驻自愈巡检（自适应动态频次）
console.log('[Skin Engine] Antigravity Skin daemon active with adaptive CDP keep-alive.');
let isFastPolling = true;
const daemonStartTime = Date.now();

async function pollLoop() {
  try {
    await pollAndInject();
  } catch (_) {}
  // 启动前 15 秒内高速轮询，极速捕获冷启动 DevToolsActivePort 和窗口页面；之后转为 2000ms 定期保活
  const elapsed = Date.now() - daemonStartTime;
  if (elapsed > 15000 && activeSessions.size > 0) {
    isFastPolling = false;
  }
  // 未连接到主会话前采用 80ms 极速探测，连接后提升至 200ms，稳定 15 秒后转为 2000ms 定期保活
  const nextDelay = isFastPolling ? (activeSessions.size === 0 ? 80 : 200) : 2000;
  setTimeout(pollLoop, nextDelay);
}
pollLoop();

// 8. 优雅退出与资源清理（杜绝重启客户端时形成僵尸进程占用端口）
function gracefulShutdown(signal) {
  console.log(`[Skin Engine] Received ${signal}, cleanly shutting down...`);
  for (const [id, session] of activeSessions.entries()) {
    try { session.ws.close(); } catch (e) {}
  }
  activeSessions.clear();
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

