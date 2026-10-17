import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';

console.log('==================================================');
console.log('  Antigravity 前置开机动画一键还原工具');
console.log('==================================================');

function findResourcesDir() {
  const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
  const candidates = [
    path.join(localAppData, 'Programs', 'antigravity', 'resources'),
    path.join(localAppData, 'Programs', 'Antigravity', 'resources'),
    'C:\\Program Files\\Antigravity\\resources',
    'C:\\Program Files (x86)\\Antigravity\\resources'
  ];

  for (const c of candidates) {
    if (fs.existsSync(path.join(c, 'app.asar')) || fs.existsSync(path.join(c, 'app.asar.bak'))) {
      return c;
    }
  }
  return null;
}

const resourcesDir = findResourcesDir();
if (!resourcesDir) {
  console.error('❌ 未找到 Antigravity 安装目录！');
  process.exit(1);
}

const asarPath = path.join(resourcesDir, 'app.asar');
const backupPath = path.join(resourcesDir, 'app.asar.bak');

if (!fs.existsSync(backupPath)) {
  console.error(`❌ 未找到官方备份文件: ${backupPath}，无法自动还原。`);
  process.exit(1);
}

try {
  const out = execSync('tasklist /FI "IMAGENAME eq Antigravity.exe" /NH', { encoding: 'utf8' });
  if (out.toLowerCase().includes('antigravity.exe')) {
    console.log('⚠️ 检测到 Antigravity 客户端正在运行，正在自动退出以恢复官方备份...');
    try {
      execSync('taskkill /F /IM Antigravity.exe /T', { stdio: 'ignore' });
    } catch (_) {}
    const start = Date.now();
    while (Date.now() - start < 3000) {
      try {
        const chk = execSync('tasklist /FI "IMAGENAME eq Antigravity.exe" /NH', { encoding: 'utf8' });
        if (!chk.toLowerCase().includes('antigravity.exe')) break;
      } catch (_) { break; }
      const t = Date.now(); while (Date.now() - t < 150) {}
    }
    console.log('✅ Antigravity 客户端已成功退出。');
  }
} catch (_) {}

try {
  if (fs.existsSync(asarPath)) {
    fs.unlinkSync(asarPath);
  }
  fs.copyFileSync(backupPath, asarPath);
  console.log('✅ 已成功还原为 100% 官方原版 app.asar！');

  function findAntigravityExe() {
    const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
    const candidates = [
      path.join(localAppData, 'Programs', 'antigravity', 'Antigravity.exe'),
      path.join(localAppData, 'Programs', 'Antigravity', 'Antigravity.exe'),
      'C:\\Program Files\\Antigravity\\Antigravity.exe',
      'C:\\Program Files (x86)\\Antigravity\\Antigravity.exe'
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) return c;
    }
    return null;
  }

  try {
    const exe = findAntigravityExe();
    if (exe) {
      console.log('🚀 正在自动为您重新启动 Antigravity 客户端...');
      const { spawn } = await import('node:child_process');
      const child = spawn(exe, [], {
        detached: true,
        stdio: 'ignore'
      });
      child.unref();
      console.log('✨ 客户端已成功拉起启动！');
    }
  } catch (_) {
    console.log('   重新启动 Antigravity 客户端即可恢复官方初始状态。');
  }
} catch (e) {
  console.error('❌ 还原失败:', e.message);
  process.exit(1);
}
