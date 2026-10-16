import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

// 1. 确保启用原生 WebSocket (Node 20+ --experimental-websocket)
if (typeof WebSocket === 'undefined') {
  const result = spawnSync(process.execPath, ['--experimental-websocket', fileURLToPath(import.meta.url), ...process.argv.slice(2)], {
    stdio: 'inherit'
  });
  process.exit(result.status || 0);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PLUGIN_ROOT = path.resolve(__dirname, '..', '..');

// 2. 路径定义
const CONFIG_FILE = path.join(PLUGIN_ROOT, 'config', 'config.json');
const DEFAULT_CONFIG_FILE = path.join(PLUGIN_ROOT, 'config.default.json');
const ASSETS_DIR = path.join(PLUGIN_ROOT, 'assets');

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
      themeStyles: true,
      crtScanlines: false,
      chineseLocalization: true,
      dynamicWallpaper: {
        enabled: true,
        videoPath: 'assets/videos/default-bg.mp4',
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
    return path.join(ASSETS_DIR, 'videos', 'default-bg.mp4');
  }
  if (path.isAbsolute(videoPath)) {
    if (fs.existsSync(videoPath)) return videoPath;
  } else {
    const rel = path.resolve(PLUGIN_ROOT, videoPath);
    if (fs.existsSync(rel)) return rel;
  }
  return path.join(ASSETS_DIR, 'videos', 'default-bg.mp4');
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range');

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

  // 视频流服务
  if (url.pathname === '/wallpaper.mp4') {
    const config = readConfig();
    const vidPath = resolveVideoPath(config.features?.dynamicWallpaper?.videoPath);

    if (!fs.existsSync(vidPath)) {
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
          'Content-Type': 'video/mp4'
        });
        fileStream.pipe(res);
      } else {
        res.writeHead(200, {
          'Content-Length': fileSize,
          'Content-Type': 'video/mp4'
        });
        fs.createReadStream(vidPath).pipe(res);
      }
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Streaming error: ' + err.message);
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
    return code.replace(/^export\s+(function|const|let|var|class)\s+/gm, '$1 ');
  }

  const wallpaperMod = readClientModule('client/modules/wallpaper.js');
  const crtMod = readClientModule('client/modules/crt-theme.js');
  const appearanceMenuMod = readClientModule('client/modules/appearance-menu.js');
  const indexMod = readClientModule('client/index.js');

  let bundleParts = [];

  // 全局注入变量
  bundleParts.push(`window.__AG_SKIN_PORT__ = ${HTTP_PORT};`);
  bundleParts.push(`window.__AG_SKIN_CONFIG__ = ${JSON.stringify(config)};`);
  bundleParts.push(`window.__AG_SKIN_GLASS_CSS__ = ${JSON.stringify(glassCss)};`);
  bundleParts.push(`window.__AG_SKIN_CRT_CSS__ = ${JSON.stringify(crtCss)};`);

  // 模块逻辑
  bundleParts.push(wallpaperMod);
  bundleParts.push(crtMod);
  bundleParts.push(appearanceMenuMod);

  // 汉化模块（如果开启）
  if (config.features?.chineseLocalization !== false) {
    const hansCode = readClientModule('client/modules/i18n-engine.js');
    if (hansCode) bundleParts.push(hansCode);
  }

  // 550C 开机引导动画（如果开启）
  if (config.features?.bootAnimation) {
    const bootCode = readClientModule('client/modules/boot-animation.js');
    if (bootCode) bundleParts.push(bootCode);
  }

  // 启动主入口
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

function injectTargetViaCdp(wsUrl, bundleCode) {
  return new Promise((resolve, reject) => {
    let ws;
    try {
      ws = new WebSocket(wsUrl);
    } catch (e) {
      return reject(e);
    }

    let id = 1;
    const pending = new Map();

    const timer = setTimeout(() => {
      try { ws.close(); } catch(e) {}
      reject(new Error('CDP connection timeout'));
    }, 5000);

    ws.onopen = async () => {
      function send(method, params = {}) {
        return new Promise((res, rej) => {
          const callId = id++;
          pending.set(callId, { res, rej });
          ws.send(JSON.stringify({ id: callId, method, params }));
        });
      }

      try {
        await send('Page.enable');
        // 保证刷新页面或新窗口打开时依然有效
        await send('Page.addScriptToEvaluateOnNewDocument', { source: bundleCode });
        // 对当前已载入的页面立即执行
        await send('Runtime.evaluate', { expression: bundleCode, returnByValue: true });
        clearTimeout(timer);
        ws.close();
        resolve(true);
      } catch (err) {
        clearTimeout(timer);
        ws.close();
        reject(err);
      }
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.id && pending.has(msg.id)) {
          const { res, rej } = pending.get(msg.id);
          pending.delete(msg.id);
          if (msg.error) rej(new Error(msg.error.message || JSON.stringify(msg.error)));
          else res(msg.result);
        }
      } catch (e) {}
    };

    ws.onerror = (err) => {
      clearTimeout(timer);
      reject(err);
    };
  });
}

const injectedTargetIds = new Set();

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

    for (const target of targets) {
      if ((target.type === 'page' || !target.type) && target.webSocketDebuggerUrl) {
        // 如果是主界面窗口且未曾注入
        if (!injectedTargetIds.has(target.id)) {
          console.log(`[Skin Engine] Found Antigravity target: ${target.id} (${target.title || target.url})`);
          const bundle = buildClientBundle();
          try {
            await injectTargetViaCdp(target.webSocketDebuggerUrl, bundle);
            injectedTargetIds.add(target.id);
            console.log(`[Skin Engine] Successfully attached skin to target ${target.id}`);
          } catch (injectErr) {
            console.warn(`[Skin Engine] Injection failed on ${target.id}:`, injectErr.message);
          }
        }
      }
    }
  } catch (e) {
    // 宿主可能尚未就绪，静默重试
  }
}

// 7. 定时巡检与保活（每 3 秒检测一次端口与窗口状态）
console.log('[Skin Engine] Antigravity Skin daemon active.');
setInterval(pollAndInject, 3000);
pollAndInject();
