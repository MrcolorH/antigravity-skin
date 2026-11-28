import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  findOriginalResourcesDir,
  restoreWindowsShortcuts,
  teardownMacZeroPatchLauncher,
  writeJsonAtomic,
  readJsonSafe
} from './platform-host.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

const home = os.homedir();
const targetPluginDir = path.join(home, '.gemini', 'config', 'plugins', 'antigravity-skin');
const configFile = path.join(home, '.gemini', 'config', 'config.json');

console.log('==================================================');
console.log('  正在卸载 Antigravity 主题与皮肤插件...');
console.log('==================================================');

console.log('[1/4] 清理开机自愈守护与纯净启动入口...');
const unregisterScript = fs.existsSync(path.join(targetPluginDir, 'scripts', 'register-self-heal.mjs'))
  ? path.join(targetPluginDir, 'scripts', 'register-self-heal.mjs')
  : path.join(PROJECT_ROOT, 'scripts', 'register-self-heal.mjs');
if (process.platform === 'win32') {
  if (fs.existsSync(unregisterScript)) {
    try {
      execSync(`"${process.execPath}" "${unregisterScript}" --unregister`, { stdio: 'inherit' });
    } catch (_) {}
  }
  try {
    restoreWindowsShortcuts({ pluginRoot: targetPluginDir });
  } catch (_) {}
}

console.log('[2/4] 检查官方备份并恢复零改包原版状态...');
if (process.platform === 'win32' || process.platform === 'darwin') {
  const resourcesDir = findOriginalResourcesDir({ includeBackupOnly: true });
  const hasBackup = resourcesDir && fs.existsSync(path.join(resourcesDir, 'app.asar.bak'));
  const restoreScript = fs.existsSync(path.join(targetPluginDir, 'scripts', 'restore-boot-overlay.mjs'))
    ? path.join(targetPluginDir, 'scripts', 'restore-boot-overlay.mjs')
    : path.join(PROJECT_ROOT, 'scripts', 'restore-boot-overlay.mjs');
  if (hasBackup && fs.existsSync(restoreScript)) {
    try {
      execSync(`"${process.execPath}" "${restoreScript}" --no-restart`, { stdio: 'inherit' });
    } catch (_) {}
  }
}

if (process.platform === 'darwin') {
  try {
    teardownMacZeroPatchLauncher();
  } catch (_) {}
}

if (fs.existsSync(targetPluginDir)) {
  console.log('[3/4] 移除插件挂载目录...');
  try {
    const stat = fs.lstatSync(targetPluginDir);
    if (stat.isSymbolicLink()) {
      fs.unlinkSync(targetPluginDir);
    } else {
      fs.rmSync(targetPluginDir, { recursive: true, force: true });
    }
  } catch (e) {
    if (process.platform === 'win32') {
      execSync(`rmdir /s /q "${targetPluginDir}"`, { shell: 'cmd.exe', stdio: 'ignore' });
    }
  }
}

console.log('[4/4] 注销插件配置...');

async function disablePluginViaRpc() {
  const lsAddress = process.env.ANTIGRAVITY_LS_ADDRESS;
  const csrfToken = process.env.ANTIGRAVITY_CSRF_TOKEN;
  if (!lsAddress || !csrfToken) return false;

  const [host, port] = lsAddress.split(':');
  const postData = JSON.stringify({
    userConfig: {
      plugins: {
        'antigravity-skin': { enabled: false }
      }
    }
  });

  return new Promise((resolve) => {
    const req = http.request({
      host,
      port: parseInt(port, 10),
      path: '/exa.language_server_pb.LanguageServerService/JetboxWriteState',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-codeium-csrf-token': csrfToken,
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: 2000
    }, (res) => resolve(res.statusCode === 200));
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.write(postData);
    req.end();
  });
}

const rpcOk = await disablePluginViaRpc();
if (!rpcOk && fs.existsSync(configFile)) {
  try {
    const configData = readJsonSafe(configFile);
    if (configData && configData.plugins && configData.plugins['antigravity-skin']) {
      delete configData.plugins['antigravity-skin'];
      writeJsonAtomic(configFile, configData);
    }
  } catch (e) {}
}

console.log('==================================================');
console.log(' [√] 卸载成功！已安全还原为官方初始状态。');
const purgeData = process.argv.includes('--purge-data');
if (purgeData) {
  const sidecarDataDir = path.join(home, '.gemini', 'antigravity', 'sidecar_data', 'antigravity-skin');
  if (fs.existsSync(sidecarDataDir)) {
    try { fs.rmSync(sidecarDataDir, { recursive: true, force: true }); } catch (_) {}
    console.log(' 🧹 已根据 --purge-data 参数清理看板历史统计数据。');
  }
} else {
  console.log(' 💾 看板历史统计数据 (history-v1 / usage-v1) 已保留，如需彻底清理请附加 --purge-data。');
}
console.log('==================================================');
