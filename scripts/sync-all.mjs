/**
 * sync-all.mjs —— 开发期热重载脚本（汉化引擎 + 外观设置菜单）
 *
 * 与 hot-sync.mjs 的分工：
 *   - hot-sync.mjs：只热重载 wallpaper.js + glass-theme.css
 *   - sync-all.mjs：热重载 i18n-engine.js + appearance-menu.js + index.js + glass-theme.css
 *
 * 流程：① 拷贝源文件到已安装插件目录 → ② 连接 CDP → ③ 在运行中的主窗口重新求值注入
 * 用法：node scripts/sync-all.mjs（需客户端已启动；路径基于 Windows 的 APPDATA / USERPROFILE）
 */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';

const portFile = path.join(process.env.APPDATA, 'Antigravity', 'DevToolsActivePort');
const port = parseInt(fs.readFileSync(portFile, 'utf8').split(/\r?\n/)[0].trim(), 10);

const targetPluginDir = path.join(process.env.USERPROFILE, '.gemini', 'config', 'plugins', 'antigravity-skin');

// 1. 同步文件到已部署的插件目录
const filesToSync = [
  'client/modules/i18n-engine.js',
  'client/modules/appearance-menu.js',
  'client/styles/glass-theme.css',
  'client/index.js'
];

for (const f of filesToSync) {
  const src = path.resolve(f);
  const dest = path.join(targetPluginDir, f);
  if (fs.existsSync(src)) {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
    console.log(`✅ Synced ${f} to installed plugin directory.`);
  }
}

// 2. 连接 CDP 热更新客户端运行时
const list = await new Promise((resolve, reject) => {
  http.get('http://127.0.0.1:' + port + '/json/list', res => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => resolve(JSON.parse(data)));
  }).on('error', reject);
});

const target = list.find(t => t.type === 'page' && t.url && t.url.startsWith('https://127.0.0.1:')) ||
               list.find(t => t.type === 'page' && !t.url.startsWith('data:'));
if (!target) throw new Error('Main window target not found');

console.log('Connecting to target window:', target.title);
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

// 3. 构建并注入最新的 Bundle
function readClientModule(relPath) {
  const full = path.resolve(relPath);
  if (!fs.existsSync(full)) return '';
  let code = fs.readFileSync(full, 'utf8');
  return code.replace(/^export\s+(function|const|let|var|class)\s+/gm, (m, g1) => g1 + ' ');
}

const glassCss = fs.readFileSync(path.resolve('client/styles/glass-theme.css'), 'utf8');
const appearanceMenuMod = readClientModule('client/modules/appearance-menu.js');
const hansCode = readClientModule('client/modules/i18n-engine.js');

await send('Runtime.evaluate', {
  expression: `(() => {
    // 注入最新 CSS
    let tag = document.getElementById('agy-dynamic-wallpaper-style');
    if (tag) {
      tag.textContent = ${JSON.stringify(glassCss)};
    }
    window.__AG_SKIN_GLASS_CSS__ = ${JSON.stringify(glassCss)};

    // 重新加载 i18n-engine
    window.__antigravityZhPatchInstalled = false;
    ${hansCode}

    // 重新初始化设置菜单
    if (window.__agyCurrentMenuInstance && typeof window.__agyCurrentMenuInstance.destroy === 'function') {
      try { window.__agyCurrentMenuInstance.destroy(); } catch (_) {}
    }
    ${appearanceMenuMod}
    if (typeof window.__agyInitAppearanceMenu === 'function') {
      // 复用运行时已有的 bridge，确保热重载后开关仍能真正落盘（不能传空回调，否则配置只存在内存）
      window.__agyInitAppearanceMenu(
        () => (window.__agySkinBridge && window.__agySkinBridge.getConfig
          ? window.__agySkinBridge.getConfig()
          : window.__AG_SKIN_CONFIG__),
        (cfg) => (window.__agySkinBridge && window.__agySkinBridge.saveConfig
          ? window.__agySkinBridge.saveConfig(cfg)
          : undefined),
        (cfg) => {
          if (typeof window.__agyApplyFeatures === 'function') window.__agyApplyFeatures(cfg);
        }
      );
    }
    console.log('✅ Hot reload applied successfully in runtime window.');
    return true;
  })()`
});

console.log('🎉 Runtime evaluation completed successfully.');
ws.close();
