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

let detectedExePath = null;
try {
  const pPath = execSync('powershell.exe -NoProfile -NonInteractive -Command "(Get-Process -Name Antigravity, \'Antigravity IDE\' -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Path -First 1)"', { encoding: 'utf8' }).trim();
  if (pPath && fs.existsSync(pPath)) {
    detectedExePath = pPath;
  }
} catch (_) {}

try {
  const out = execSync('tasklist /NH', { encoding: 'utf8' }).toLowerCase();
  const isRunning = out.includes('antigravity.exe') || out.includes('antigravity ide.exe');
  if (isRunning) {
    console.log('⚠️ 检测到 Antigravity 客户端正在运行，正在自动退出以恢复官方备份...');
    try {
      execSync('taskkill /F /IM Antigravity.exe /T', { stdio: 'ignore' });
    } catch (_) {}
    try {
      execSync('taskkill /F /IM "Antigravity IDE.exe" /T', { stdio: 'ignore' });
    } catch (_) {}
    const start = Date.now();
    while (Date.now() - start < 3000) {
      try {
        const chk = execSync('tasklist /NH', { encoding: 'utf8' }).toLowerCase();
        if (!chk.includes('antigravity.exe') && !chk.includes('antigravity ide.exe')) break;
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
    if (detectedExePath && fs.existsSync(detectedExePath)) {
      return detectedExePath;
    }
    if (resourcesDir) {
      const parentDir = path.resolve(resourcesDir, '..');
      const directCandidates = [
        path.join(parentDir, 'Antigravity.exe'),
        path.join(parentDir, 'Antigravity IDE.exe')
      ];
      for (const c of directCandidates) {
        if (fs.existsSync(c)) return c;
      }
    }
    const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
    const candidates = [
      path.join(localAppData, 'Programs', 'antigravity', 'Antigravity.exe'),
      path.join(localAppData, 'Programs', 'Antigravity', 'Antigravity.exe'),
      'C:\\Program Files\\Antigravity\\Antigravity.exe',
      'C:\\Program Files (x86)\\Antigravity\\Antigravity.exe',
      'D:\\soft\\Antigravity IDE\\Antigravity IDE.exe'
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) return c;
    }
    return null;
  }

  try {
    const exe = findAntigravityExe();
    if (exe) {
      console.log(`🚀 正在自动为您重新启动 Antigravity 客户端 (${path.basename(exe)})...`);
      const exeDir = path.dirname(exe);
      const cleanEnv = { ...process.env };
      delete cleanEnv.ELECTRON_RUN_AS_NODE;
      delete cleanEnv.ELECTRON_NO_ASAR;
      delete cleanEnv.NODE_OPTIONS;
      delete cleanEnv.NODE_ENV;
      delete cleanEnv.ATOM_SHELL_INTERNAL_RUN_AS_NODE;

      try {
        execSync(`powershell.exe -NoProfile -NonInteractive -Command "Start-Process -FilePath '${exe}' -WorkingDirectory '${exeDir}'"`, {
          windowsHide: true,
          stdio: 'ignore',
          env: cleanEnv
        });
      } catch (_) {
        const { spawn } = await import('node:child_process');
        const child = spawn(exe, [], {
          cwd: exeDir,
          detached: true,
          stdio: 'ignore',
          env: cleanEnv
        });
        child.unref();
      }
      console.log('✨ 客户端已成功重新拉起启动！');
    }
  } catch (_) {
    console.log('   重新启动 Antigravity 客户端即可恢复官方初始状态。');
  }
} catch (e) {
  console.error('❌ 还原失败:', e.message);
  process.exit(1);
}
