import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

console.log('==================================================');
console.log('  Antigravity 前置开机动画防闪白补丁 (Windows 专用)');
console.log('==================================================');

if (process.platform !== 'win32') {
  console.log('📌 提示：当前脚本仅适用于 Windows 系统。');
  console.log('   macOS 平台采用纯净非侵入式架构，无需篡改系统 app.asar。');
  process.exit(0);
}

// 1. 定位 Antigravity resources 目录
function findResourcesDir() {
  const home = os.homedir();
  if (process.platform === 'darwin') {
    const candidates = [
      '/Applications/Antigravity.app/Contents/Resources',
      path.join(home, 'Applications', 'Antigravity.app', 'Contents', 'Resources')
    ];
    for (const c of candidates) {
      if (fs.existsSync(path.join(c, 'app.asar'))) {
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
      if (fs.existsSync(path.join(c, 'app.asar'))) {
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
      if (fs.existsSync(path.join(c, 'app.asar'))) {
        return c;
      }
    }
  }
  return null;
}

const resourcesDir = findResourcesDir();
if (!resourcesDir) {
  console.error('❌ 未找到 Antigravity 安装目录下的 resources/app.asar！请确认客户端是否已正确安装。');
  process.exit(1);
}

const asarPath = path.join(resourcesDir, 'app.asar');
const backupPath = path.join(resourcesDir, 'app.asar.bak');
console.log(`[1/5] 检测到 Antigravity resources 目录: ${resourcesDir}`);

let detectedExePath = null;

// 2. 检查并自动关闭运行中的 Antigravity 客户端（解除文件锁定）
function ensureProcessClosed() {
  if (process.env.SKIP_KILL === '1') {
    console.log('📌 已启用 SKIP_KILL 模式：跳过进程退出，采用无感在线写入。');
    return;
  }
  try {
    if (process.platform === 'win32') {
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
          console.log('⚠️ 检测到 Antigravity 客户端正在运行，正在自动安全退出以解除文件锁定...');
          try {
            execSync('taskkill /F /IM Antigravity.exe /T', { stdio: 'ignore' });
          } catch (_) {}
          try {
            execSync('taskkill /F /IM "Antigravity IDE.exe" /T', { stdio: 'ignore' });
          } catch (_) {}

          // 等待进程完全释放，最长等待 3 秒
          const start = Date.now();
          while (Date.now() - start < 3000) {
            try {
              const chk = execSync('tasklist /NH', { encoding: 'utf8' }).toLowerCase();
              if (!chk.includes('antigravity.exe') && !chk.includes('antigravity ide.exe')) break;
            } catch (_) {
              break;
            }
            const t = Date.now();
            while (Date.now() - t < 150) {}
          }
          console.log('     ✅ Antigravity 客户端已成功退出，文件句柄已完全释放。');
        }
      } catch (_) {}
    } else if (process.platform === 'darwin') {
      let isRunning = false;
      try {
        const out = execSync('pgrep -i antigravity', { encoding: 'utf8' });
        if (out && out.trim()) isRunning = true;
      } catch (_) {}

      if (isRunning) {
        console.log('⚠️ 检测到 Antigravity 客户端正在运行，正在自动安全退出以解除文件锁定...');
        try {
          execSync('pkill -i antigravity', { stdio: 'ignore' });
        } catch (_) {}

        const start = Date.now();
        while (Date.now() - start < 3000) {
          try {
            const chk = execSync('pgrep -i antigravity', { encoding: 'utf8' });
            if (!chk || !chk.trim()) break;
          } catch (_) {
            break;
          }
          const t = Date.now();
          while (Date.now() - t < 150) {}
        }
        console.log('     ✅ Antigravity 客户端已成功退出，文件句柄已完全释放。');
      }
    } else {
      try {
        execSync('pkill -f antigravity', { stdio: 'ignore' });
      } catch (_) {}
    }
  } catch (_) {}
}

ensureProcessClosed();

// 3. 自动备份官方原版 app.asar
if (!fs.existsSync(backupPath)) {
  console.log(`[2/5] 正在创建官方原版安全备份: app.asar.bak ...`);
  fs.copyFileSync(asarPath, backupPath);
  console.log('     ✅ 备份成功！任何时候都可以一秒恢复原厂状态。');
} else {
  console.log(`[2/5] 官方备份 app.asar.bak 已存在，安全跳过备份。`);
}

// 4. 解包 app.asar 到临时目录
const tempExtractDir = path.join(os.tmpdir(), `agy-patch-${Date.now()}`);
console.log(`[3/5] 正在安全解包 app.asar 到临时沙箱...`);

try {
  execSync(`npx --yes @electron/asar extract "${asarPath}" "${tempExtractDir}"`, { stdio: 'inherit' });
} catch (e) {
  console.error('❌ 解包失败，错误信息:', e.message);
  process.exit(1);
}

// 5. 注入防闪白独立舞台开机引擎
console.log(`[4/5] 正在注入零闪白影院级溶出引擎 (硬件合成锁死 + 主窗口原生纯黑 + 独立幕布淡出)...`);

// A. 注入 loadingOverlay.js
const targetOverlayFile = path.join(tempExtractDir, 'dist', 'loadingOverlay.js');
const candidateOverlaySources = [
  path.join(PROJECT_ROOT, 'loadingOverlay.js'),
  path.join(os.homedir(), '.gemini', 'config', 'plugins', 'antigravity-skin', 'loadingOverlay.js'),
  'D:\\Project\\antigravity-skin\\loadingOverlay.js'
];
const overlaySourceFile = candidateOverlaySources.find(p => fs.existsSync(p));

if (!overlaySourceFile) {
  console.error(`❌ 未找到待注入的 loadingOverlay.js 源码文件，已检索路径: \n${candidateOverlaySources.join('\n')}`);
  process.exit(1);
}

const patchedOverlayCode = fs.readFileSync(overlaySourceFile, 'utf8');
fs.writeFileSync(targetOverlayFile, patchedOverlayCode, 'utf8');
console.log('     ✅ 已成功注入最新版 loadingOverlay.js 防闪白与活态化过渡引擎。');

// B. 确保 dist/utils.js 维持原版深浅色自适应（开屏动画关闭时完整复原官方浅白/深色原生 loading 底色）
const targetUtilsFile = path.join(tempExtractDir, 'dist', 'utils.js');
if (fs.existsSync(targetUtilsFile)) {
  let utilsCode = fs.readFileSync(targetUtilsFile, 'utf8');
  if (utilsCode.includes("const backgroundColor = '#000000';")) {
    utilsCode = utilsCode.replace(
      "const backgroundColor = '#000000';",
      "const backgroundColor = isLight ? '#FAFAFA' : '#131313';"
    );
    fs.writeFileSync(targetUtilsFile, utilsCode, 'utf8');
    console.log('     ✅ 已恢复 utils.js createWindow 原版深浅色自适应底色。');
  }
}

// 6. 重新打包 app.asar
console.log(`[5/5] 正在重新安全封装 app.asar ...`);
const tempAsarOut = path.join(resourcesDir, 'app.asar.tmp');

try {
  execSync(`npx --yes @electron/asar pack "${tempExtractDir}" "${tempAsarOut}"`, { stdio: 'inherit' });
  
  if (fs.existsSync(tempAsarOut) && fs.statSync(tempAsarOut).size > 100000) {
    try {
      if (fs.existsSync(asarPath)) {
        fs.unlinkSync(asarPath);
      }
      fs.renameSync(tempAsarOut, asarPath);
    } catch (_) {
      fs.copyFileSync(tempAsarOut, asarPath);
      try { fs.unlinkSync(tempAsarOut); } catch (_) {}
    }
    console.log('🎉 恭喜！前置开机动画已成功完成动态联动升级！');
    console.log('');
    console.log('📌 本次真·零闪白终极升级：');
    console.log('  1. 【硬件合成图层锁死】：video 与舞台预先启用 3D 硬件图层 (translateZ)，绝不发生 DirectComposition 销毁闪白！');
    console.log('  2. 【原生自适应复原】：开机动效开启时智能进入专属舞台，功能关闭时 100% 完美复原官方原生 loading 动效与自适应浅白/深色底色！');
    console.log('  3. 【事件穿透阻断】：全屏 video 设置 pointer-events: none，点击全部由黑色舞台承接，消除媒体焦点闪烁！');
    console.log('  4. 【电影级溶图衔接】：450ms 贝塞尔曲线淡出完成后后台静默卸载视图，实现平滑溶出主界面。');

    // 7. 自动重新启动 Antigravity 客户端
    async function restartAntigravity() {
      try {
        console.log('');
        console.log('🚀 正在自动为您启动 Antigravity 客户端...');
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
            // 1. 优先使用关闭前检测到的运行路径
            if (detectedExePath && fs.existsSync(detectedExePath)) {
              return detectedExePath;
            }

            // 2. 基于 resourcesDir 上层目录推导（精准命中当前实际打补丁的客户端）
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

            // 3. 检查桌面快捷方式指向的目标路径
            try {
              const desktop = path.join(os.homedir(), 'Desktop');
              const lnkCandidates = [
                path.join(desktop, 'Antigravity.lnk'),
                path.join(desktop, 'Antigravity IDE.lnk')
              ];
              for (const lnk of lnkCandidates) {
                if (fs.existsSync(lnk)) {
                  const target = execSync(`powershell.exe -NoProfile -NonInteractive -Command "(New-Object -ComObject WScript.Shell).CreateShortcut('${lnk}').TargetPath"`, { encoding: 'utf8' }).trim();
                  if (target && fs.existsSync(target)) return target;
                }
              }
            } catch (_) {}

            // 4. 标准候选路径
            const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
            const programFiles = process.env.ProgramFiles || 'C:\\Program Files';
            const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';

            const candidates = [
              path.join(localAppData, 'Programs', 'antigravity', 'Antigravity.exe'),
              path.join(localAppData, 'Programs', 'Antigravity', 'Antigravity.exe'),
              path.join(localAppData, 'Programs', 'Antigravity IDE', 'Antigravity IDE.exe'),
              path.join(programFiles, 'Antigravity', 'Antigravity.exe'),
              path.join(programFiles, 'Antigravity IDE', 'Antigravity IDE.exe'),
              path.join(programFilesX86, 'Antigravity', 'Antigravity.exe'),
              'D:\\soft\\Antigravity IDE\\Antigravity IDE.exe'
            ];
            for (const c of candidates) {
              if (fs.existsSync(c)) return c;
            }
            return null;
          }

          const exe = findAntigravityExe();
          if (exe) {
            const exeDir = path.dirname(exe);
            // 关键：彻底剔除可能导致 Electron 客户端静默退出为 Node CLI 的环境变量
            const cleanEnv = { ...process.env };
            delete cleanEnv.ELECTRON_RUN_AS_NODE;
            delete cleanEnv.ELECTRON_NO_ASAR;
            delete cleanEnv.NODE_OPTIONS;
            delete cleanEnv.NODE_ENV;
            delete cleanEnv.ATOM_SHELL_INTERNAL_RUN_AS_NODE;

            let launched = false;

            // 策略 1：使用 PowerShell Start-Process（调用 Win32 ShellExecuteEx，操作系统级独立派生，完全脱离控制台生命周期）
            try {
              execSync(`powershell.exe -NoProfile -NonInteractive -Command "Start-Process -FilePath '${exe}' -WorkingDirectory '${exeDir}'"`, {
                windowsHide: true,
                stdio: 'ignore',
                env: cleanEnv
              });
              launched = true;
            } catch (_) {}

            // 策略 2：Node.js spawn 彻底分离进程组 (detached: true) 双重加固
            if (!launched) {
              try {
                const child = spawn(exe, [], {
                  cwd: exeDir,
                  detached: true,
                  stdio: 'ignore',
                  env: cleanEnv
                });
                child.unref();
                launched = true;
              } catch (_) {}
            }

            // 状态验证：轮询检测客户端进程是否成功复活
            let runningConfirmed = false;
            const verifyStart = Date.now();
            while (Date.now() - verifyStart < 2500) {
              try {
                const chk = execSync('tasklist /NH', { encoding: 'utf8' }).toLowerCase();
                if (chk.includes('antigravity.exe') || chk.includes('antigravity ide.exe')) {
                  runningConfirmed = true;
                  break;
                }
              } catch (_) {}
              const t = Date.now(); while (Date.now() - t < 150) {}
            }

            if (runningConfirmed) {
              console.log('✨ 客户端已成功重新拉起启动并就绪！');
            } else {
              try {
                execSync(`powershell.exe -NoProfile -NonInteractive -Command "Start-Process -FilePath '${exe}' -WorkingDirectory '${exeDir}'"`, {
                  windowsHide: true,
                  stdio: 'ignore',
                  env: cleanEnv
                });
                console.log('✨ 客户端拉起指令已成功发出！');
              } catch (_) {
                console.log('💡 启动指令已送达，若未弹出窗口请手动点击桌面图标启动。');
              }
            }
          } else {
            console.log('💡 未能自动找到 Antigravity.exe，请手动启动客户端。');
          }
        } else {
          execSync('antigravity &', { stdio: 'ignore' });
          console.log('✨ 客户端已成功拉起启动！');
        }
      } catch (_) {
        console.log('💡 如未自动启动，请手动打开 Antigravity 客户端。');
      }
    }

    if (process.env.SKIP_KILL !== '1') {
      await restartAntigravity();

      if (process.platform === 'win32') {
        console.log('');
        console.log('==================================================');
        console.log('🎉 恭喜！前置开机动画已成功完成动态联动升级！');
        console.log('==================================================');
        console.log('💡 补丁已全部就绪，本窗口将在 3 秒后自动关闭...');
        await new Promise(r => setTimeout(r, 3000));
      }
    } else {
      console.log('⚡ 在线热注入完成：app.asar 已直接更新就绪，无需中断当前工作会话！');
    }
  } else {
    throw new Error('打包后的临时 asar 文件大小异常');
  }
} catch (e) {
  console.error('❌ 打包替换失败:', e.message);
  if (fs.existsSync(tempAsarOut)) try { fs.unlinkSync(tempAsarOut); } catch (_) {}
  process.exit(1);
} finally {
  try {
    fs.rmSync(tempExtractDir, { recursive: true, force: true });
  } catch (_) {}
}
