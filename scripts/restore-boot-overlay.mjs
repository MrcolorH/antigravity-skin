import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  findOriginalResourcesDir,
  resolveMacLaunchTarget,
  updateKernelInjectionConfig,
  patchWindowsShortcuts,
  getDefaultPluginRoot,
  runPowerShellScript
} from './platform-host.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const args = process.argv.slice(2);
const NO_RESTART = args.includes('--no-restart');
const FROM_PLUGIN = args.includes('--from-plugin');
const IS_DETACHED_WORKER = args.includes('--detached-worker');
const delayArg = args.find(a => a.startsWith('--delay-ms='));
const DELAY_MS = delayArg ? Math.max(0, Number(delayArg.split('=')[1]) || 0) : 0;

if (IS_DETACHED_WORKER && DELAY_MS > 0) {
  await new Promise(resolve => setTimeout(resolve, DELAY_MS));
}

console.log('==================================================');
console.log('  Antigravity 前置开机动画与内核补丁一键还原工具');
console.log('==================================================');

if (process.platform !== 'win32' && process.platform !== 'darwin' && process.platform !== 'linux') {
  console.log('📌 提示：当前脚本仅适用于 Windows、macOS 与 Linux 系统。');
  process.exit(0);
}

const resourcesDir = findOriginalResourcesDir({ includeBackupOnly: true });
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
const isInsideAntigravityHost = !!(process.env.ANTIGRAVITY_LS_ADDRESS || process.env.ANTIGRAVITY_CSRF_TOKEN || process.env.SKIP_KILL === '1');

if (process.platform === 'win32' && isInsideAntigravityHost && FROM_PLUGIN && !IS_DETACHED_WORKER && !NO_RESTART) {
  const workerArgs = [__filename, '--detached-worker', '--from-plugin', '--delay-ms=1200'];
  const cleanEnv = { ...process.env };
  delete cleanEnv.ANTIGRAVITY_LS_ADDRESS;
  delete cleanEnv.ANTIGRAVITY_CSRF_TOKEN;
  delete cleanEnv.SKIP_KILL;
  delete cleanEnv.ELECTRON_RUN_AS_NODE;
  delete cleanEnv.ELECTRON_NO_ASAR;
  delete cleanEnv.NODE_OPTIONS;
  delete cleanEnv.NODE_ENV;
  delete cleanEnv.ATOM_SHELL_INTERNAL_RUN_AS_NODE;
  const child = spawn(process.execPath, workerArgs, {
    cwd: path.dirname(resourcesDir),
    detached: true,
    windowsHide: true,
    stdio: 'ignore',
    env: cleanEnv
  });
  child.unref();
  console.log('🚀 已投递后台独立还原任务，正在重启 Antigravity 切换回零改包纯净启动...');
  process.exit(0);
}

// 自动安全关闭运行中的客户端解除文件占用
try {
  if (isInsideAntigravityHost) {
    console.log('📌 检测到当前运行于 Antigravity 宿主会话中，启用无感在线还原模式（跳过强制退出以防止中断会话）。');
  } else if (process.platform === 'win32') {
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

  updateKernelInjectionConfig(false, getDefaultPluginRoot());
  if (process.platform === 'win32') {
    const regScript = path.join(__dirname, 'register-self-heal.mjs');
    if (fs.existsSync(regScript)) {
      try { execSync(`"${process.execPath}" "${regScript}" --unregister`, { stdio: 'ignore' }); } catch (_) {}
    }
    if (FROM_PLUGIN) {
      try { patchWindowsShortcuts({ pluginRoot: getDefaultPluginRoot() }); } catch (_) {}
    }
  }

  function restartAntigravity() {
    try {
      console.log('🚀 正在自动为您重新启动 Antigravity 客户端...');
      if (process.platform === 'darwin') {
        const launch = resolveMacLaunchTarget(resourcesDir);
        const launchArgs = FROM_PLUGIN ? '--args --remote-debugging-port=0' : '';
        const targetCmd = launch.target.startsWith('/') || launch.target.includes('.app')
          ? `open -a "${launch.target}" ${launchArgs}`.trim()
          : `open -b "${launch.target}" ${launchArgs}`.trim();
        if (isInsideAntigravityHost && FROM_PLUGIN) {
          const shCmd = `sleep 1.2; osascript -e 'tell application id "com.google.antigravity" to quit' >/dev/null 2>&1 || true; i=0; while pgrep -x "Antigravity" >/dev/null 2>&1 && [ $i -lt 30 ]; do sleep 0.2; i=$((i+1)); done; pkill -x "Antigravity" >/dev/null 2>&1 || true; sleep 0.3; ${targetCmd}`;
          const child = spawn('sh', ['-c', shCmd], { detached: true, stdio: 'ignore' });
          child.unref();
          console.log('✨ 已投递 macOS 后台安全重启，即将以官方原版零改包模式拉起！');
          return;
        }
        execSync(targetCmd, { stdio: 'ignore' });
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
          try {
            const shortcutTarget = runPowerShellScript(`
              $desktop = [Environment]::GetFolderPath('Desktop')
              $wsh = New-Object -ComObject WScript.Shell
              foreach ($name in @('Antigravity.lnk', 'Antigravity IDE.lnk', 'Antigravity (Skin).lnk')) {
                $p = Join-Path $desktop $name
                if (Test-Path $p) {
                  $t = $wsh.CreateShortcut($p).TargetPath
                  if ($t -and (Test-Path $t)) { Write-Output $t; break }
                }
              }
            `);
            if (shortcutTarget && fs.existsSync(shortcutTarget)) return shortcutTarget;
          } catch (_) {}
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

          const escapedExe = exe.replace(/'/g, "''");
          const escapedDir = exeDir.replace(/'/g, "''");
          const argClause = FROM_PLUGIN ? " -ArgumentList '--remote-debugging-port=0'" : '';
          const spawnArgs = FROM_PLUGIN ? ['--remote-debugging-port=0'] : [];
          try {
            execSync(`powershell.exe -NoProfile -NonInteractive -Command "Start-Process -FilePath '${escapedExe}'${argClause} -WorkingDirectory '${escapedDir}'"`, {
              windowsHide: true,
              stdio: 'ignore',
              env: cleanEnv
            });
          } catch (_) {
            const child = spawn(exe, spawnArgs, {
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
        execSync(FROM_PLUGIN ? 'antigravity --remote-debugging-port=0 &' : 'antigravity &', { stdio: 'ignore' });
        console.log('✨ 客户端已成功拉起启动！');
      }
    } catch (_) {
      console.log('   重新启动 Antigravity 客户端即可恢复官方初始状态。');
    }
  }

  if (!NO_RESTART) {
    restartAntigravity();
  }
} catch (e) {
  console.error('❌ 还原失败:', e.message);
  process.exit(1);
}
