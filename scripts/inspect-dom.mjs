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

const check = await send('Runtime.evaluate', {
  expression: `(() => {
    const folder = document.querySelector('.group\\\\/headerbtn');
    const selectedRow = document.querySelector('[data-testid="conversation-row-sidebar"][data-selected="true"]');
    const unselectedRow = document.querySelector('[data-testid="conversation-row-sidebar"][data-selected="false"]');
    return {
      folderNonHoverBg: folder ? window.getComputedStyle(folder).backgroundColor : null,
      selectedConversationBg: selectedRow ? window.getComputedStyle(selectedRow).backgroundColor : null,
      selectedConversationShadow: selectedRow ? window.getComputedStyle(selectedRow).boxShadow : null,
      unselectedConversationBg: unselectedRow ? window.getComputedStyle(unselectedRow).backgroundColor : null
    };
  })()`,
  returnByValue: true
});
console.log('Comparison:', JSON.stringify(check.result.value, null, 2));
ws.close();
