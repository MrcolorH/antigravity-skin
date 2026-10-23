/**
 * sync-all.mjs —— 开发期热重载脚本（汉化引擎 + 外观设置菜单）
 *
 * 与 hot-sync.mjs 的分工：
 *   - hot-sync.mjs：只热重载 wallpaper.js + glass-theme.css
 *   - sync-all.mjs：热重载 i18n-engine.js + appearance-menu.js + index.js + glass-theme.css
 *
 * 流程：① 拷贝源文件到已安装插件目录 → ② 连接 CDP → ③ 在运行中的主窗口重新求值注入
 */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';

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
  'plugin.json',
  'patch-loading.bat',
  'loadingOverlay.js',
  'scripts/patch-boot-overlay.mjs',
  'scripts/restore-boot-overlay.mjs',
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
  if (fs.existsSync(dest) && sha1(src) === sha1(dest)) {
    console.log(`⏭  Unchanged ${f}`);
    continue;
  }
  fs.copyFileSync(src, dest);
  console.log(`✅ Synced ${f} to installed plugin directory.`);
}

console.log('🎉 所有插件核心文件已同步到系统插件目录！');
