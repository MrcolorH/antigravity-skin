import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import http from 'node:http';

function getPlatformAppDirs({ platform = process.platform, home = os.homedir(), env = process.env } = {}) {
  let localBase;
  if (platform === 'win32') {
    localBase = env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');
  } else if (platform === 'darwin') {
    localBase = path.join(home, 'Library', 'Application Support');
  } else {
    localBase = env.XDG_DATA_HOME || path.join(home, '.local', 'share');
  }
  return {
    pulseSettings: path.join(localBase, 'AntigravityPulse', 'settings.json'),
    pulseBackups: path.join(localBase, 'AntigravityPulseBackups')
  };
}

function locateAppAsar({ platform = process.platform, home = os.homedir(), env = process.env } = {}) {
  const candidates = [];
  if (env.AG_SKIN_ASAR_PATH) candidates.push(env.AG_SKIN_ASAR_PATH);
  if (platform === 'darwin') {
    candidates.push(
      '/Applications/Antigravity.app/Contents/Resources/app.asar',
      path.join(home, 'Applications', 'Antigravity.app', 'Contents', 'Resources', 'app.asar')
    );
  } else if (platform === 'win32') {
    const local = env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');
    candidates.push(
      path.join(local, 'Programs', 'antigravity', 'resources', 'app.asar'),
      path.join(local, 'Programs', 'Antigravity', 'resources', 'app.asar'),
      'C:\\Program Files\\Antigravity\\resources\\app.asar'
    );
  } else {
    candidates.push(
      '/opt/Antigravity/resources/app.asar',
      '/opt/antigravity/resources/app.asar',
      '/usr/share/antigravity/resources/app.asar'
    );
  }
  return candidates.find(p => fs.existsSync(p)) || null;
}

export function detectLegacyPulse({ home = os.homedir(), pluginsDir, configFile } = {}) {
  const pDir = pluginsDir || path.join(home, '.gemini', 'config', 'plugins');
  const legacyPluginDir = path.join(pDir, 'antigravity-pulse');
  const cfgFile = configFile || path.join(home, '.gemini', 'config', 'config.json');

  let hasDir = false;
  if (fs.existsSync(legacyPluginDir)) {
    try {
      const pj = path.join(legacyPluginDir, 'plugin.json');
      if (!fs.existsSync(pj)) {
        hasDir = true;
      } else {
        const parsed = JSON.parse(fs.readFileSync(pj, 'utf8'));
        hasDir = parsed?.name === 'antigravity-pulse';
      }
    } catch {
      hasDir = true;
    }
  }

  let hasConfig = false;
  if (fs.existsSync(cfgFile)) {
    try {
      const cfg = JSON.parse(fs.readFileSync(cfgFile, 'utf8'));
      hasConfig = !!(cfg?.plugins?.['antigravity-pulse'] || cfg?.sidecars?.['antigravity-pulse/panel']);
    } catch {}
  }

  return { detected: hasDir || hasConfig, hasDir, hasConfig, legacyPluginDir, configFile: cfgFile };
}

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

export function restoreLegacyPulseAsarPatch({ asarPath, backupsDir } = {}) {
  const targetAsar = asarPath || locateAppAsar();
  const targetBackups = backupsDir || getPlatformAppDirs().pulseBackups;
  if (!targetAsar || !fs.existsSync(targetAsar)) return { restored: false, reason: 'no_asar' };

  const currentBuf = fs.readFileSync(targetAsar);
  if (!currentBuf.includes(Buffer.from('// AG_PULSE_INLINE_V1'))) {
    return { restored: false, reason: 'not_patched' };
  }

  const currentHash = crypto.createHash('sha256').update(currentBuf).digest('hex');
  if (!fs.existsSync(targetBackups)) {
    throw new Error('检测到旧版 antigravity-pulse 内联补丁 (// AG_PULSE_INLINE_V1)，但未找到 AntigravityPulseBackups 备份目录，已中止修改 app.asar。');
  }

  const entries = fs.readdirSync(targetBackups, { withFileTypes: true })
    .filter(e => e.isDirectory())
    .sort((a, b) => b.name.localeCompare(a.name));

  for (const entry of entries) {
    const dir = path.join(targetBackups, entry.name);
    const patchMetaPath = path.join(dir, 'patch.json');
    if (!fs.existsSync(patchMetaPath)) continue;
    try {
      const meta = JSON.parse(fs.readFileSync(patchMetaPath, 'utf8'));
      if (meta.patchedSha256 && meta.patchedSha256 !== currentHash) continue;
      const backupCandidate = [
        meta.backupFile ? path.join(dir, meta.backupFile) : '',
        path.join(dir, 'app.asar'),
        path.join(dir, 'original.asar')
      ].find(p => p && fs.existsSync(p));
      if (!backupCandidate) continue;
      if (meta.originalSha256 && sha256File(backupCandidate) !== meta.originalSha256) continue;

      fs.copyFileSync(backupCandidate, targetAsar);
      if (meta.originalSha256 && sha256File(targetAsar) !== meta.originalSha256) {
        throw new Error('还原原版 app.asar 后 SHA256 校验失败。');
      }
      return { restored: true, backupDir: dir };
    } catch (err) {
      if (err.message.includes('SHA256')) throw err;
    }
  }

  throw new Error('检测到旧版 antigravity-pulse 内联补丁 (// AG_PULSE_INLINE_V1)，但未找到 SHA256 匹配的原版备份，已中止覆盖 app.asar。');
}

export function migrateLegacyPulseData({ home = os.homedir(), targetPluginDir, pulseSettingsPath } = {}) {
  const legacyDataDir = path.join(home, '.gemini', 'antigravity', 'sidecar_data', 'antigravity-pulse', 'panel', 'data');
  const newDataDir = path.join(home, '.gemini', 'antigravity', 'sidecar_data', 'antigravity-skin', 'panel', 'data');
  const copied = [];

  for (const sub of ['history-v1', 'usage-v1']) {
    const src = path.join(legacyDataDir, sub);
    const dest = path.join(newDataDir, sub);
    if (fs.existsSync(src) && !fs.existsSync(dest)) {
      fs.mkdirSync(newDataDir, { recursive: true });
      fs.cpSync(src, dest, { recursive: true, force: false });
      copied.push(sub);
    }
  }

  // 继承旧版启用/内嵌偏好
  const settingsFile = pulseSettingsPath || getPlatformAppDirs({ home }).pulseSettings;
  let inheritedDashboard = null;
  if (fs.existsSync(settingsFile)) {
    try {
      const legacy = JSON.parse(fs.readFileSync(settingsFile, 'utf8').replace(/^\uFEFF/, ''));
      if (legacy && typeof legacy === 'object' && (legacy.enabled === false || legacy.inline === false)) {
        inheritedDashboard = {
          enabled: legacy.enabled !== false,
          inlineEnabled: legacy.inline !== false
        };
      }
    } catch {}
  }

  if (inheritedDashboard && targetPluginDir) {
    const skinCfgPath = path.join(targetPluginDir, 'config', 'config.json');
    if (fs.existsSync(skinCfgPath)) {
      try {
        const cfg = JSON.parse(fs.readFileSync(skinCfgPath, 'utf8'));
        if (!cfg.features) cfg.features = {};
        cfg.features.dashboard = {
          ...(cfg.features.dashboard || {}),
          ...inheritedDashboard
        };
        fs.writeFileSync(skinCfgPath, JSON.stringify(cfg, null, 2), 'utf8');
      } catch {}
    }
  }

  return { copied, inheritedDashboard };
}

async function disablePulseViaRpc() {
  const lsAddress = process.env.ANTIGRAVITY_LS_ADDRESS;
  const csrfToken = process.env.ANTIGRAVITY_CSRF_TOKEN;
  if (!lsAddress || !csrfToken) return false;

  const [host, port] = lsAddress.split(':');
  const postData = JSON.stringify({
    userConfig: {
      plugins: {
        'antigravity-pulse': { enabled: false }
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
    }, res => resolve(res.statusCode === 200));
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.write(postData);
    req.end();
  });
}

export async function cleanupLegacyPulsePlugin({ home = os.homedir(), pluginsDir, configFile, isInsideHost = false } = {}) {
  const pDir = pluginsDir || path.join(home, '.gemini', 'config', 'plugins');
  const legacyPluginDir = path.join(pDir, 'antigravity-pulse');
  const cfgFile = configFile || path.join(home, '.gemini', 'config', 'config.json');

  if (isInsideHost) {
    await disablePulseViaRpc();
  }

  if (fs.existsSync(legacyPluginDir)) {
    const stat = fs.lstatSync(legacyPluginDir);
    if (stat.isSymbolicLink()) {
      throw new Error(`Refusing to delete symlinked plugin directory: ${legacyPluginDir}`);
    }
    const resolved = fs.realpathSync(legacyPluginDir);
    const expectedParent = fs.realpathSync(pDir);
    if (path.dirname(resolved) !== expectedParent || path.basename(resolved) !== 'antigravity-pulse') {
      throw new Error(`Plugin path outside expected directory: ${resolved}`);
    }
    fs.rmSync(resolved, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }

  if (fs.existsSync(cfgFile)) {
    try {
      const cfg = JSON.parse(fs.readFileSync(cfgFile, 'utf8'));
      let changed = false;
      if (cfg.plugins && Object.hasOwn(cfg.plugins, 'antigravity-pulse')) {
        delete cfg.plugins['antigravity-pulse'];
        changed = true;
      }
      if (cfg.sidecars && Object.hasOwn(cfg.sidecars, 'antigravity-pulse/panel')) {
        delete cfg.sidecars['antigravity-pulse/panel'];
        changed = true;
      }
      if (changed) {
        const tmp = `${cfgFile}.tmp.${Date.now()}`;
        fs.writeFileSync(tmp, JSON.stringify(cfg, null, 2), 'utf8');
        try {
          fs.renameSync(tmp, cfgFile);
        } catch {
          fs.copyFileSync(tmp, cfgFile);
          try { fs.unlinkSync(tmp); } catch {}
        }
      }
    } catch {}
  }
}

export async function migrateLegacyPulse({ home = os.homedir(), pluginsDir, configFile, targetPluginDir, isInsideHost = false, asarPath, backupsDir } = {}) {
  const info = detectLegacyPulse({ home, pluginsDir, configFile });
  const asarResult = restoreLegacyPulseAsarPatch({ asarPath, backupsDir });
  const dataResult = migrateLegacyPulseData({ home, targetPluginDir });

  if (info.detected) {
    await cleanupLegacyPulsePlugin({ home, pluginsDir, configFile, isInsideHost });
  }
  return { ...info, asarResult, dataResult };
}
