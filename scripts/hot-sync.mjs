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

const target = list.find(t => t.type === 'page' || (!t.type && t.webSocketDebuggerUrl));
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
        else resolve(msg.result);
      }
    };
    ws.addEventListener('message', handler);
    ws.send(JSON.stringify({ id: callId, method, params }));
  });
}

await new Promise(r => ws.onopen = r);

// 读取最新 css
const cssPath = path.resolve('client', 'styles', 'glass-theme.css');
const cssContent = fs.readFileSync(cssPath, 'utf8');

// 热更新注入主窗口
await send('Runtime.evaluate', {
  expression: `(() => {
    // 移除旧测试标签
    const oldTag = document.getElementById('agy-glass-theme-style');
    if (oldTag) oldTag.remove();

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

console.log('Hot reloaded in main window.');

// 同步拷贝到已安装插件目录
const targetPluginCss = path.join(process.env.USERPROFILE, '.gemini', 'config', 'plugins', 'antigravity-skin', 'client', 'styles', 'glass-theme.css');
if (fs.existsSync(path.dirname(targetPluginCss))) {
  fs.writeFileSync(targetPluginCss, cssContent, 'utf8');
  console.log('Synced to installed plugin directory.');
}

ws.close();
