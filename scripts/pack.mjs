import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

const distDir = path.join(PROJECT_ROOT, 'dist');
const stagingDir = path.join(distDir, 'antigravity-skin');
const zipFile = path.join(distDir, 'antigravity-skin.zip');

console.log('==================================================');
console.log('  正在打包 Antigravity Skin Release 发布文件...');
console.log('==================================================');

// 1. 重建 dist 目录
if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true, force: true });
}
fs.mkdirSync(stagingDir, { recursive: true });

// 2. 纯净白名单拷贝
const WHITELIST_DIRS = ['client', 'sidecars', 'assets', 'scripts'];
const WHITELIST_FILES = [
  'plugin.json', 'config.default.json', 'package.json', 'README.md',
  'install.bat', 'uninstall.bat', 'install.ps1', 'uninstall.ps1', 'install.sh', 'uninstall.sh',
  'patch-loading.bat', 'restore-loading.bat', 'loadingOverlay.js', 'provisionSplash.js', 'self-heal.bat'
];

for (const dir of WHITELIST_DIRS) {
  const src = path.join(PROJECT_ROOT, dir);
  const dest = path.join(stagingDir, dir);
  if (fs.existsSync(src)) {
    fs.cpSync(src, dest, {
      recursive: true,
      force: true,
      filter: (item) => {
        const lower = item.toLowerCase();
        if (item.includes('.git') || item.includes('node_modules') || item.endsWith('.tmp')) return false;
        // 关键过滤：严禁将用户私有音视频大文件打包进 Release 归档包
        if (lower.endsWith('.mp4') || lower.endsWith('.webm') || lower.endsWith('.mov') || lower.endsWith('.mkv')) return false;
        return true;
      }
    });
  }
}

// 确保打包目录中具备 assets/videos 目录结构与各专属子库 .gitkeep
const destVideosDir = path.join(stagingDir, 'assets', 'videos');
const destWallDir = path.join(destVideosDir, 'wallpaper');
const destBootDir = path.join(destVideosDir, 'boot');
fs.mkdirSync(destVideosDir, { recursive: true });
fs.mkdirSync(destWallDir, { recursive: true });
fs.mkdirSync(destBootDir, { recursive: true });
for (const p of [destVideosDir, destWallDir, destBootDir]) {
  const k = path.join(p, '.gitkeep');
  if (!fs.existsSync(k)) fs.writeFileSync(k, '', 'utf8');
}

for (const file of WHITELIST_FILES) {
  const src = path.join(PROJECT_ROOT, file);
  const dest = path.join(stagingDir, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
  }
}

// 确保默认 config 目录存在出厂配置
const destConfigDir = path.join(stagingDir, 'config');
fs.mkdirSync(destConfigDir, { recursive: true });
fs.copyFileSync(path.join(PROJECT_ROOT, 'config.default.json'), path.join(destConfigDir, 'config.json'));

console.log('[1/2] 纯净运行环境组装完成。');

// 3. 压缩打包
console.log('[2/2] 正在压缩生成 zip 归档包...');
try {
  if (process.platform === 'win32') {
    execSync(`powershell -NoProfile -Command "Compress-Archive -Path '${stagingDir}\\*' -DestinationPath '${zipFile}' -Force"`, {
      stdio: 'inherit'
    });
  } else {
    execSync(`cd "${distDir}" && zip -r "${zipFile}" "antigravity-skin"`, {
      stdio: 'inherit'
    });
  }
  const size = fs.statSync(zipFile).size;
  const sizeStr = size > 1024 * 1024 ? `${(size / 1024 / 1024).toFixed(2)} MB` : `${(size / 1024).toFixed(1)} KB`;
  console.log('==================================================');
  console.log(` [√] 打包成功！输出文件: ${zipFile} (${sizeStr})`);
  console.log(' 该 zip 文件为纯净发行包（不含本地私有素材），可直接上传发布！');
  console.log('==================================================');
} catch (e) {
  console.error('打包压缩失败:', e.message);
}
