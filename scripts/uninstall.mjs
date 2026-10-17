import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

const home = os.homedir();
const targetPluginDir = path.join(home, '.gemini', 'config', 'plugins', 'antigravity-skin');
const configFile = path.join(home, '.gemini', 'config', 'config.json');

console.log('==================================================');
console.log('  正在卸载 Antigravity 主题与皮肤插件...');
console.log('==================================================');

if (fs.existsSync(targetPluginDir)) {
  console.log('[1/2] 移除插件挂载目录...');
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

console.log('[2/2] 注销插件配置...');

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
    const configData = JSON.parse(fs.readFileSync(configFile, 'utf8'));
    if (configData.plugins && configData.plugins['antigravity-skin']) {
      delete configData.plugins['antigravity-skin'];
      const tmp = `${configFile}.tmp.${Date.now()}`;
      fs.writeFileSync(tmp, JSON.stringify(configData, null, 2), 'utf8');
      try {
        fs.renameSync(tmp, configFile);
      } catch (_) {
        fs.copyFileSync(tmp, configFile);
        try { fs.unlinkSync(tmp); } catch(__) {}
      }
    }
  } catch (e) {}
}

// 3. 若处于 Windows 且存在开机补丁备份，自动恢复官方原版 app.asar
if (process.platform === 'win32') {
  const restoreScript = path.join(PROJECT_ROOT, 'scripts', 'restore-boot-overlay.mjs');
  if (fs.existsSync(restoreScript)) {
    try {
      execSync(`node "${restoreScript}"`, { stdio: 'inherit' });
    } catch (_) {}
  }
}

console.log('==================================================');
console.log(' [√] 卸载成功！已安全还原为官方初始状态。');
console.log('==================================================');
