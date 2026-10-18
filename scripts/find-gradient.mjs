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

const target = list.find(t => t.type === 'page' && t.url && t.url.startsWith('https://127.0.0.1:'));
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r);

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

const code = `
(() => {
  // 查找所有具有紫/粉背景或渐变的元素
  const elements = Array.from(document.querySelectorAll('*'));
  const suspicious = [];
  for (const el of elements) {
    const cs = window.getComputedStyle(el);
    const before = window.getComputedStyle(el, '::before');
    const after = window.getComputedStyle(el, '::after');
    const check = (s, pseudo) => {
      if (s.backgroundImage && (s.backgroundImage.includes('gradient') || s.backgroundImage.includes('url'))) {
        suspicious.push({ tag: el.tagName, className: el.className, pseudo, bgImage: s.backgroundImage, rect: el.getBoundingClientRect() });
      }
      if (s.backgroundColor && s.backgroundColor.includes('rgb') && !s.backgroundColor.includes('rgba(0, 0, 0, 0)')) {
        // 检查是否在侧边栏附近 (left < 400)
        const rect = el.getBoundingClientRect();
        if (rect.left < 400 && rect.width > 100 && rect.height > 100) {
          suspicious.push({ tag: el.tagName, className: el.className, pseudo, bgColor: s.backgroundColor, bgImage: s.backgroundImage, rect });
        }
      }
    };
    check(cs, '');
    check(before, '::before');
    check(after, '::after');
  }
  return suspicious;
})()
`;

const res = await send('Runtime.evaluate', {
  expression: code,
  returnByValue: true
});

console.log(JSON.stringify(res.result.value, null, 2));
ws.close();
