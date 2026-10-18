import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';

const portFile = path.join(process.env.APPDATA, 'Antigravity', 'DevToolsActivePort');
const port = parseInt(fs.readFileSync(portFile, 'utf8').split(/\r?\n/)[0].trim(), 10);

const list = await new Promise((resolve, reject) => {
  http.get('http://127.0.0.1:' + port + '/json/list', res => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => resolve(JSON.parse(data)));
  }).on('error', reject);
});

// 精准锁定主窗口 Target（绝不误连 boot 页面或 iframe）
const target = list.find(t => t.type === 'page' && t.url && t.url.startsWith('https://127.0.0.1:')) ||
               list.find(t => t.type === 'page' && !t.url.startsWith('data:'));
if (!target) throw new Error('Main window target not found');

console.log('Target window:', target.title, target.url.slice(0, 80));
const ws = new WebSocket(target.webSocketDebuggerUrl);

let id = 1;
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const callId = id++;
    const handler = (evt) => {
      const msg = JSON.parse(evt.data);
      if (msg.id === callId) {
        ws.removeEventListener('message', handler);
        if (msg.error) reject(msg.error);
        else if (msg.result && msg.result.exceptionDetails) {
          reject(new Error(msg.result.exceptionDetails.text + ': ' + (msg.result.exceptionDetails.exception?.description || 'Script Error')));
        } else resolve(msg.result);
      }
    };
    ws.addEventListener('message', handler);
    ws.send(JSON.stringify({ id: callId, method, params }));
  });
}

await new Promise(r => ws.onopen = r);

// 1. 读取最新 css 和 wallpaper.js
const cssPath = path.resolve('client', 'styles', 'glass-theme.css');
const cssContent = fs.readFileSync(cssPath, 'utf8');

const jsPath = path.resolve('client', 'modules', 'wallpaper.js');
const jsContent = fs.readFileSync(jsPath, 'utf8');
const cleanJs = jsContent.replace(/^export\s+(function|const|let|var|class)\s+/gm, (m, g1) => g1 + ' ');

// 2. 热更新注入样式
await send('Runtime.evaluate', {
  expression: `(() => {
    let tag = document.getElementById('agy-dynamic-wallpaper-style');
    if (!tag) {
      tag = document.createElement('style');
      tag.id = 'agy-dynamic-wallpaper-style';
      (document.head || document.documentElement || document.body).appendChild(tag);
    }
    tag.textContent = ${JSON.stringify(cssContent)};
    window.__AG_SKIN_GLASS_CSS__ = ${JSON.stringify(cssContent)};
    return true;
  })()`
});
// 2.5 扫描本地长会话并注入预载清单
const brainDir = path.join(process.env.USERPROFILE, '.gemini', 'antigravity', 'brain');
const longSessionIds = [];
if (fs.existsSync(brainDir)) {
  const dirs = fs.readdirSync(brainDir, { withFileTypes: true });
  for (const d of dirs) {
    if (d.isDirectory()) {
      const tFile = path.join(brainDir, d.name, '.system_generated', 'logs', 'transcript.jsonl');
      if (fs.existsSync(tFile)) {
        try {
          const stat = fs.statSync(tFile);
          if (stat.size > 10 * 1024) { // 大于 10KB 判定为长会话
            longSessionIds.push(d.name);
          }
        } catch(e) {}
      }
    }
  }
}

// 3. 热更新注入 wallpaper.js
await send('Runtime.evaluate', {
  expression: `(() => {
    window.__AGY_PRELOADED_LONG_SESSIONS__ = ${JSON.stringify(longSessionIds)};
    try {
      const saved = JSON.parse(localStorage.getItem('__agy_long_sessions') || '[]');
      const merged = Array.from(new Set([...saved, ...window.__AGY_PRELOADED_LONG_SESSIONS__]));
      localStorage.setItem('__agy_long_sessions', JSON.stringify(merged));
    } catch(e) {}
    ${cleanJs}
    if (window.__agyWallpaperInstance && typeof window.__agyWallpaperInstance.destroy === 'function') {
      try { window.__agyWallpaperInstance.destroy(); } catch (e) {}
    }
    if (typeof window.__agyInitWallpaper === 'function') {
      window.__agyWallpaperInstance = window.__agyInitWallpaper();
    }
    return true;
  })()`
});
console.log('✅ Wallpaper module successfully updated in runtime.');

// 4. 同步拷贝到已安装插件目录
const targetPluginDir = path.join(process.env.USERPROFILE, '.gemini', 'config', 'plugins', 'antigravity-skin');
const targetPluginCss = path.join(targetPluginDir, 'client', 'styles', 'glass-theme.css');
const targetPluginJs = path.join(targetPluginDir, 'client', 'modules', 'wallpaper.js');

if (fs.existsSync(path.dirname(targetPluginCss))) {
  fs.writeFileSync(targetPluginCss, cssContent, 'utf8');
  console.log('✅ Synced glass-theme.css to installed plugin directory.');
}
if (fs.existsSync(path.dirname(targetPluginJs))) {
  fs.writeFileSync(targetPluginJs, jsContent, 'utf8');
  console.log('✅ Synced wallpaper.js to installed plugin directory.');
}

ws.close();
