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
import crypto from 'node:crypto';

const portFile = path.join(process.env.APPDATA, 'Antigravity', 'DevToolsActivePort');
const port = parseInt(fs.readFileSync(portFile, 'utf8').split(/\r?\n/)[0].trim(), 10);

const targetPluginDir = path.join(process.env.USERPROFILE, '.gemini', 'config', 'plugins', 'antigravity-skin');

// 1. 同步文件到已部署的插件目录
const filesToSync = [
  'client/modules/i18n-engine.js',
  'client/modules/agy-modal.js',
  'client/modules/media-display-modal.js',
  'client/modules/appearance-menu.js',
  'client/modules/wallpaper-library-ui.js',
  'client/modules/wallpaper.js',
  'client/modules/boot-animation.js',
  'client/styles/glass-theme.css',
  'client/index.js',
  // Sidecar 后端：拷贝后其内置 watchFile 会优雅退出并由宿主自动拉起最新逻辑
  'sidecars/skin-engine/main.mjs',
  'sidecars/skin-engine/wallpaper-library.mjs',
  'sidecars/skin-engine/scene-pkg.mjs',
  'sidecars/skin-engine/vendor/webwallgl.js',
  'sidecars/skin-engine/sidecar.json'
];

const sha1 = (p) => crypto.createHash('sha1').update(fs.readFileSync(p)).digest('hex');

for (const f of filesToSync) {
  const src = path.resolve(f);
  const dest = path.join(targetPluginDir, f);
  if (!fs.existsSync(src)) continue;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  // 内容一致则跳过：避免无意义的 sidecar 拷贝触发其自退出，导致宿主不重启而服务中断
  try {
    if (fs.existsSync(dest) && sha1(src) === sha1(dest)) {
      console.log(`⏭  Unchanged ${f}`);
      continue;
    }
  } catch (_) {}
  fs.copyFileSync(src, dest);
  console.log(`✅ Synced ${f} to installed plugin directory.`);
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
const agyModalMod = readClientModule('client/modules/agy-modal.js');
const mediaDisplayModalMod = readClientModule('client/modules/media-display-modal.js');
const bootAnimationMod = readClientModule('client/modules/boot-animation.js');
const wallpaperMod = readClientModule('client/modules/wallpaper.js');
const libraryUiMod = readClientModule('client/modules/wallpaper-library-ui.js');
const appearanceMenuMod = readClientModule('client/modules/appearance-menu.js');
const hansCode = readClientModule('client/modules/i18n-engine.js');
const indexCode = fs.readFileSync(path.resolve('client/index.js'), 'utf8');

await send('Runtime.evaluate', {
  expression: `(() => {
    // 注入最新 CSS
    let tag = document.getElementById('agy-dynamic-wallpaper-style');
    if (tag) {
      tag.textContent = ${JSON.stringify(glassCss)};
    }
    window.__AG_SKIN_GLASS_CSS__ = ${JSON.stringify(glassCss)};

    // 注入 Modal 基座与独立设置弹窗
    ${agyModalMod}
    ${mediaDisplayModalMod}
    ${bootAnimationMod}

    // 重新加载 wallpaper 模块
    ${wallpaperMod}

    // 重新加载 i18n-engine
    window.__antigravityZhPatchInstalled = false;
    ${hansCode}

    // 重新加载外部素材库资产中心（必须先于菜单重新注册到全局）
    ${libraryUiMod}

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
    // 重新执行 index.js 以刷新主控制器和 applyFeatures
    try {
      ${indexCode}
    } catch (e) {
      console.warn('Re-exec index.js error:', e);
    }

    // 重新触发一次壁纸应用
    try {
      const activeCfg = (window.__agySkinBridge && window.__agySkinBridge.getConfig)
        ? window.__agySkinBridge.getConfig()
        : window.__AG_SKIN_CONFIG__;
      if (activeCfg && typeof window.__agyApplyFeatures === 'function') {
        if (window.__agyWallpaperInstance && typeof window.__agyWallpaperInstance.destroy === 'function') {
          try { window.__agyWallpaperInstance.destroy(); } catch (_) {}
          window.__agyWallpaperInstance = null;
        }
        window.__agyApplyFeatures(activeCfg);
      }
    } catch (e) {
      console.warn('Re-apply features error:', e);
    }

    console.log('✅ Hot reload applied successfully in runtime window.');
    return true;
  })()`
});

console.log('🎉 Runtime evaluation completed successfully.');
ws.close();

// 4. 侧车健康检查：main.mjs 变更会让旧进程优雅退出，宿主并不一定会自动重新拉起
await new Promise(r => setTimeout(r, 6000));
const sidecarAlive = await new Promise((resolve) => {
  const req = http.get('http://127.0.0.1:59288/api/system-info', { timeout: 2500 }, res => {
    res.resume();
    resolve(res.statusCode === 200);
  });
  req.on('error', () => resolve(false));
  req.on('timeout', () => { req.destroy(); resolve(false); });
});
if (sidecarAlive) {
  console.log('✅ Sidecar is healthy on http://127.0.0.1:59288');
} else {
  console.log('');
  console.log('⚠️  侧车进程未在监听 59288（宿主没有自动拉起）。');
  console.log('    👉 请重启一次 Antigravity 客户端；配置与素材不会丢失。');
  console.log('');
}
