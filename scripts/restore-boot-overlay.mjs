import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync, spawn } from 'node:child_process';

console.log('==================================================');
console.log('  Antigravity 前置开机动画一键还原工具 (Windows 专用)');
console.log('==================================================');

if (process.platform !== 'win32') {
  console.log('📌 提示：当前脚本仅适用于 Windows 系统。macOS 采用纯非侵入式架构，无需还原。');
  process.exit(0);
}

function findResourcesDir() {
  const home = os.homedir();
  if (process.platform === 'darwin') {
    const candidates = [
      '/Applications/Antigravity.app/Contents/Resources',
      path.join(home, 'Applications', 'Antigravity.app', 'Contents', 'Resources')
    ];
    for (const c of candidates) {
      if (fs.existsSync(path.join(c, 'app.asar')) || fs.existsSync(path.join(c, 'app.asar.bak'))) {
        return c;
      }
    }
  } else if (process.platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');
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
  } else {
    const candidates = [
      '/usr/lib/antigravity/resources',
      '/opt/Antigravity/resources',
      '/opt/antigravity/resources',
      path.join(home, '.local', 'share', 'antigravity', 'resources')
    ];
    for (const c of candidates) {
      if (fs.existsSync(path.join(c, 'app.asar')) || fs.existsSync(path.join(c, 'app.asar.bak'))) {
        return c;
      }
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

// 自动安全关闭运行中的客户端解除文件占用
try {
  if (process.platform === 'win32') {
    try {
      const pPath = execSync('powershell.exe -NoProfile -NonInteractive -Command "(Get-Process -Name Antigravity, \'Antigravity IDE\' -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Path -First 1)"', { encoding: 'utf8' }).trim();
      if (pPath && fs.existsSync(pPath)) {
        detectedExePath = pPath;
      }
    } catch (_) {}

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
  } else if (process.platform === 'darwin') {
    let isRunning = false;
    try {
      const out = execSync('pgrep -i antigravity', { encoding: 'utf8' });
      if (out && out.trim()) isRunning = true;
    } catch (_) {}

    if (isRunning) {
      console.log('⚠️ 检测到 Antigravity 客户端正在运行，正在自动退出以恢复官方备份...');
      try {
        execSync('pkill -i antigravity', { stdio: 'ignore' });
      } catch (_) {}
      const start = Date.now();
      while (Date.now() - start < 3000) {
        try {
          const chk = execSync('pgrep -i antigravity', { encoding: 'utf8' });
          if (!chk || !chk.trim()) break;
        } catch (_) { break; }
        const t = Date.now(); while (Date.now() - t < 150) {}
      }
      console.log('✅ Antigravity 客户端已成功退出。');
    }
  } else {
    try { execSync('pkill -f antigravity', { stdio: 'ignore' }); } catch (_) {}
  }
} catch (_) {}

try {
  if (fs.existsSync(asarPath)) {
    fs.unlinkSync(asarPath);
  }
  fs.copyFileSync(backupPath, asarPath);
  console.log('✅ 已成功还原为 100% 官方原版 app.asar！');

  function restartAntigravity() {
    try {
      console.log('🚀 正在自动为您重新启动 Antigravity 客户端...');
      if (process.platform === 'darwin') {
        const home = os.homedir();
        const candidates = [
          '/Applications/Antigravity.app',
          path.join(home, 'Applications', 'Antigravity.app')
        ];
        for (const app of candidates) {
          if (fs.existsSync(app)) {
            execSync(`open -a "${app}"`, { stdio: 'ignore' });
            console.log('✨ 客户端已成功拉起启动！');
            return;
          }
        }
        execSync('open -b com.google.antigravity', { stdio: 'ignore' });
        console.log('✨ 客户端已成功拉起启动！');
      } else if (process.platform === 'win32') {
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
            path.join(localAppData, 'Programs', 'Antigravity IDE', 'Antigravity IDE.exe'),
            'C:\\Program Files\\Antigravity\\Antigravity.exe',
            'C:\\Program Files (x86)\\Antigravity\\Antigravity.exe',
            'D:\\soft\\Antigravity IDE\\Antigravity IDE.exe'
          ];
          for (const c of candidates) {
            if (fs.existsSync(c)) return c;
          }
          return null;
        }

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
            const { spawn } = import('node:child_process');
            const child = spawn(exe, [], {
              cwd: exeDir,
              detached: true,
              stdio: 'ignore',
              env: cleanEnv
            });
            child.unref();
          }
          console.log('✨ 客户端已成功重新拉起启动！');
        } else {
          console.log('   重新启动 Antigravity 客户端即可恢复官方初始状态。');
        }
      } else {
        execSync('antigravity &', { stdio: 'ignore' });
        console.log('✨ 客户端已成功拉起启动！');
      }
    } catch (_) {
      console.log('   重新启动 Antigravity 客户端即可恢复官方初始状态。');
    }
  }

  restartAntigravity();
} catch (e) {
  console.error('❌ 还原失败:', e.message);
  process.exit(1);
}
