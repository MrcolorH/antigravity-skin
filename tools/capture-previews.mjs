import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const IMAGES_DIR = path.join(PROJECT_ROOT, 'docs', 'images');

if (!fs.existsSync(IMAGES_DIR)) {
  fs.mkdirSync(IMAGES_DIR, { recursive: true });
}

function getPort() {
  const home = os.homedir();
  const portFile = process.platform === 'win32'
    ? path.join(process.env.APPDATA || path.join(home, 'AppData', 'Roaming'), 'Antigravity', 'DevToolsActivePort')
    : (process.platform === 'darwin'
      ? path.join(home, 'Library', 'Application Support', 'Antigravity', 'DevToolsActivePort')
      : path.join(home, '.config', 'Antigravity', 'DevToolsActivePort'));

  if (!fs.existsSync(portFile)) throw new Error('未找到 DevToolsActivePort 文件，请确保 Antigravity 正在运行');
  const raw = fs.readFileSync(portFile, 'utf8');
  return parseInt(raw.split(/\r?\n/)[0].trim(), 10);
}

async function fetchJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function main() {
  console.log('==================================================');
  console.log('  正在通过 CDP 安全生成脱敏预览截图...');
  console.log('==================================================');

  const port = getPort();
  const targets = await fetchJson(`http://127.0.0.1:${port}/json/list`);
  const page = targets.find(t => t.type === 'page' || (!t.type && t.webSocketDebuggerUrl));
  if (!page) throw new Error('未找到主窗口 Target');

  const ws = new WebSocket(page.webSocketDebuggerUrl);

  let id = 1;
  const pending = new Map();

  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const callId = id++;
      pending.set(callId, { resolve, reject });
      ws.send(JSON.stringify({ id: callId, method, params }));
    });
  }

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.id && pending.has(msg.id)) {
        const { resolve, reject } = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message || JSON.stringify(msg.error)));
        else resolve(msg.result);
      }
    } catch (_) {}
  };

  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });

  await send('Page.enable');
  await send('Runtime.enable');

  // ==========================================
  // 1. 截取开机引导动效
  // ==========================================
  console.log('[1/3] 正在截取【开机引导动画】...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      if (typeof window.__triggerBootAnimation === 'function') {
        window.__triggerBootAnimation('video');
      }
    })()`
  });

  await sleep(1500);

  const shot1 = await send('Page.captureScreenshot', { format: 'png' });
  const file1 = path.join(IMAGES_DIR, 'preview-boot.png');
  fs.writeFileSync(file1, Buffer.from(shot1.data, 'base64'));
  console.log(`  [√] 开机动效截图已生成: ${file1}`);

  // 关闭开机动效
  await send('Runtime.evaluate', {
    expression: `(() => {
      const esc = new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true });
      window.dispatchEvent(esc);
      const host = document.getElementById('agy-video-boot-host') || document.getElementById('agy-custom-code-boot-host');
      if (host) host.remove();
    })()`
  });
  await sleep(800);

  // ==========================================
  // 2. 截取原生外观设置卡片 (带自定义皮肤选项)
  // ==========================================
  console.log('[2/3] 正在打开设置并截取【原生外观设置卡片】...');

  // 点击左下角齿轮打开设置
  await send('Runtime.evaluate', {
    expression: `(() => {
      const btn = document.elementFromPoint(18, window.innerHeight - 18)?.closest('button');
      if (btn) btn.click();
    })()`
  });
  await sleep(700);

  // 点击左侧导航“外观”或“Appearance”
  await send('Runtime.evaluate', {
    expression: `(() => {
      const dialog = document.querySelector('[role="dialog"]') || document.querySelector('.settings-modal-container');
      if (dialog) {
        const tabs = Array.from(dialog.querySelectorAll('button, div, [role="tab"]'));
        const appTab = tabs.find(el => {
          const t = el.textContent?.trim();
          return t === '外观' || t === 'Appearance';
        });
        if (appTab) appTab.click();
      }
    })()`
  });
  await sleep(900);

  // 严格脱敏：模糊弹窗背景的一切会话与项目信息，保护任何敏感数据
  await send('Runtime.evaluate', {
    expression: `(() => {
      let mask = document.getElementById('agy-privacy-mask-settings');
      if (!mask) {
        mask = document.createElement('style');
        mask.id = 'agy-privacy-mask-settings';
        mask.textContent = \`
          /* 背景全景深度高斯模糊遮蔽 */
          #app-root > div:not([data-radix-popper-content-wrapper]),
          .bg-sidebar {
            filter: blur(14px) opacity(0.2) !important;
          }
        \`;
        document.head.appendChild(mask);
      }
    })()`
  });
  await sleep(500);

  const shot2 = await send('Page.captureScreenshot', { format: 'png' });
  const file2 = path.join(IMAGES_DIR, 'preview-settings.png');
  fs.writeFileSync(file2, Buffer.from(shot2.data, 'base64'));
  console.log(`  [√] 外观设置面板截图已生成: ${file2}`);

  // 移除设置页脱敏遮罩，并按 ESC 关闭设置弹窗
  await send('Runtime.evaluate', {
    expression: `(() => {
      const mask = document.getElementById('agy-privacy-mask-settings');
      if (mask) mask.remove();
      const esc = new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true });
      window.dispatchEvent(esc);
    })()`
  });
  await sleep(700);

  // ==========================================
  // 3. 截取全局毛玻璃工作区 (全方位 100% 会话与项目脱敏)
  // ==========================================
  console.log('[3/3] 正在截取【全局动态壁纸与毛玻璃透明工作区】(深度脱敏遮罩)...');

  // 对工作区应用全量脱敏：
  // 1. 模糊侧边栏中的全部会话历史标题与项目名称；
  // 2. 模糊主对话流中的用户气泡、AI 回复文本、代码块；
  // 3. 模糊顶部标题栏。
  await send('Runtime.evaluate', {
    expression: `(() => {
      let mask = document.getElementById('agy-privacy-mask-workspace');
      if (!mask) {
        mask = document.createElement('style');
        mask.id = 'agy-privacy-mask-workspace';
        mask.textContent = \`
          /* 1. 侧边栏全部会话和项目名深度模糊 */
          .bg-sidebar span,
          .bg-sidebar [class*="truncate"],
          .bg-sidebar button div {
            filter: blur(7px) !important;
            user-select: none !important;
          }

          /* 2. 主会话区文字、气泡、代码全部深度模糊 */
          .prose,
          pre,
          code,
          [data-conversation],
          [data-message],
          div[class*="rounded-2xl"],
          .user-bubble,
          .agent-bubble,
          p, h1, h2, h3, h4,
          div[class*="text-zinc"],
          div[class*="text-slate"] {
            filter: blur(8px) !important;
            user-select: none !important;
          }

          /* 3. 窗口标题栏文字模糊 */
          header,
          title,
          [data-tauri-drag-region] span,
          [data-tauri-drag-region] div {
            filter: blur(6px) !important;
          }
        \`;
        document.head.appendChild(mask);
      }
    })()`
  });
  await sleep(500);

  const shot3 = await send('Page.captureScreenshot', { format: 'png' });
  const file3 = path.join(IMAGES_DIR, 'preview-glass-workspace.png');
  fs.writeFileSync(file3, Buffer.from(shot3.data, 'base64'));
  console.log(`  [√] 全局毛玻璃工作区截图已生成: ${file3}`);

  // 彻底移除脱敏遮罩，完全恢复宿主页面显示
  await send('Runtime.evaluate', {
    expression: `(() => {
      const mask = document.getElementById('agy-privacy-mask-workspace');
      if (mask) mask.remove();
    })()`
  });

  ws.close();
  console.log('==================================================');
  console.log(' [√] 全部截图已完成脱敏并安全生成！');
  console.log(` 保存目录: ${IMAGES_DIR}`);
  console.log('==================================================');
}

main().catch(err => {
  console.error('截图生成失败:', err.message);
  process.exit(1);
});
