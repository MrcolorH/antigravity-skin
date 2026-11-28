import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  BOOT_PATCH_MARKER,
  MAC_LAUNCHER_BUNDLE_ID,
  getMacIsolationPaths,
  writeJsonAtomic,
  readJsonSafe,
  updateKernelInjectionConfig,
  isLauncherAppBundle,
  findAllOriginalResourcesDirs,
  detectAsarPatchState,
  extractPlistArraySection,
  buildMacLauncherAppleScript,
  buildMacLauncherInfoPlist,
  resolveMacLaunchTarget
} from '../scripts/platform-host.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

function readText(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
}

test('v0.3.4: manifests and config defaults enforce zero-patch default', () => {
  const pkg = JSON.parse(readText('package.json'));
  const plugin = JSON.parse(readText('plugin.json'));
  const defCfg = JSON.parse(readText('config.default.json'));

  assert.equal(pkg.version, '0.3.4');
  assert.equal(plugin.version, '0.3.4');
  assert.equal(defCfg.features.kernelInjection, false);
  assert.equal(defCfg.features.macLauncherMode, 'isolate');
});

test('v0.3.4: platform-host atomic JSON write, config sync & asar patch detection', () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'agy-skin-host-'));
  try {
    const cfgPath = path.join(tmpRoot, 'config', 'config.json');
    writeJsonAtomic(cfgPath, { enabled: true, features: { themeStyles: true, kernelInjection: false } });
    assert.deepEqual(readJsonSafe(cfgPath), { enabled: true, features: { themeStyles: true, kernelInjection: false } });

    updateKernelInjectionConfig(true, tmpRoot);
    assert.equal(readJsonSafe(cfgPath).features.kernelInjection, true);
    assert.equal(readJsonSafe(cfgPath).features.themeStyles, true);

    const asarUnpatched = path.join(tmpRoot, 'app-clean.asar');
    const asarPatched = path.join(tmpRoot, 'app-patched.asar');
    fs.writeFileSync(asarUnpatched, Buffer.from('{"main":"main.js"}', 'utf8'));
    fs.writeFileSync(asarPatched, Buffer.from(`{"marker":"${BOOT_PATCH_MARKER}"}`, 'utf8'));

    assert.equal(detectAsarPatchState(asarUnpatched).patched, false);
    assert.equal(detectAsarPatchState(asarPatched).patched, true);
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});

test('v0.3.4: macOS launcher plist, AppleScript & bundle isolation guards', () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'agy-skin-mac-'));
  try {
    const iso = getMacIsolationPaths('/Users/tester');
    assert.ok(iso.isolatedApp.includes('AntigravitySkin.noindex'));
    assert.ok(iso.keepOriginalLauncher.endsWith('Antigravity Skin.app'));

    const samplePlist = `<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0">
<dict>
  <key>CFBundleIconFile</key>
  <string>Antigravity.icns</string>
  <key>CFBundleDocumentTypes</key>
  <array>
    <dict>
      <key>CFBundleTypeExtensions</key>
      <array>
        <string>txt</string>
      </array>
    </dict>
  </array>
  <key>CFBundleURLTypes</key>
  <array>
    <dict>
      <key>CFBundleURLSchemes</key>
      <array>
        <string>antigravity</string>
      </array>
    </dict>
  </array>
</dict>
</plist>`;

    const docSection = extractPlistArraySection(samplePlist, 'CFBundleDocumentTypes');
    assert.ok(docSection.includes('<string>txt</string>'));
    assert.equal((docSection.match(/<array>/g) || []).length, 2, 'must preserve nested array pairs inside CFBundleDocumentTypes');
    assert.equal((docSection.match(/<\/array>/g) || []).length, 2, 'must preserve matching closing array tags');
    const urlSection = extractPlistArraySection(samplePlist, 'CFBundleURLTypes');
    assert.ok(urlSection.includes('<string>antigravity</string>'));

    const launcherPlist = buildMacLauncherInfoPlist(samplePlist, {
      name: 'Antigravity',
      version: '1.0.0'
    });
    assert.ok(launcherPlist.includes(MAC_LAUNCHER_BUNDLE_ID));
    assert.ok(/<key>LSUIElement<\/key>\s*<true\/>/.test(launcherPlist));
    assert.ok(launcherPlist.includes('<string>Antigravity.icns</string>'));
    assert.ok(launcherPlist.includes('<key>CFBundleDocumentTypes</key>'));
    assert.ok(launcherPlist.includes('<key>CFBundleURLTypes</key>'));
    assert.ok(launcherPlist.includes('<string>txt</string>'));
    assert.ok(launcherPlist.includes('<string>antigravity</string>'));

    const script = buildMacLauncherAppleScript('/Users/tester/Library/Application Support/AntigravitySkin.noindex/Antigravity.app');
    assert.ok(script.includes('on run'));
    assert.ok(script.includes('on open theItems'));
    assert.ok(script.includes('on open location theUrl'));
    assert.ok(script.includes('--args --remote-debugging-port=0'));
    assert.ok(!script.includes('System Events'));

    const fakeLauncher = path.join(tmpRoot, 'Launcher.app');
    const fakeRealApp = path.join(tmpRoot, 'Real.app');
    fs.mkdirSync(path.join(fakeLauncher, 'Contents', 'Resources'), { recursive: true });
    fs.mkdirSync(path.join(fakeRealApp, 'Contents', 'Resources'), { recursive: true });
    fs.writeFileSync(path.join(fakeLauncher, 'Contents', 'Info.plist'), launcherPlist, 'utf8');
    fs.writeFileSync(path.join(fakeRealApp, 'Contents', 'Info.plist'), '<string>com.google.antigravity</string>', 'utf8');
    fs.writeFileSync(path.join(fakeRealApp, 'Contents', 'Resources', 'app.asar'), 'official', 'utf8');

    assert.equal(isLauncherAppBundle(fakeLauncher), true);
    assert.equal(isLauncherAppBundle(fakeRealApp), false);

    // Ensure findAllOriginalResourcesDirs skips user-level launcher bundle and locates isolated real bundle
    const fakeMacHome = path.join(tmpRoot, 'mac-home');
    const userLauncherApp = path.join(fakeMacHome, 'Applications', 'Antigravity.app');
    const isolatedRealApp = getMacIsolationPaths(fakeMacHome).isolatedApp;
    fs.mkdirSync(path.join(userLauncherApp, 'Contents', 'Resources'), { recursive: true });
    fs.mkdirSync(path.join(isolatedRealApp, 'Contents', 'Resources'), { recursive: true });
    fs.writeFileSync(path.join(userLauncherApp, 'Contents', 'Info.plist'), launcherPlist, 'utf8');
    fs.writeFileSync(path.join(userLauncherApp, 'Contents', 'Resources', 'app.asar'), 'fake', 'utf8');
    fs.writeFileSync(path.join(isolatedRealApp, 'Contents', 'Info.plist'), '<string>com.google.antigravity</string>', 'utf8');
    fs.writeFileSync(path.join(isolatedRealApp, 'Contents', 'Resources', 'app.asar'), 'official', 'utf8');

    const macDirs = findAllOriginalResourcesDirs({ platform: 'darwin', home: fakeMacHome, env: {} });
    assert.ok(macDirs.includes(path.join(isolatedRealApp, 'Contents', 'Resources')));
    assert.ok(!macDirs.includes(path.join(userLauncherApp, 'Contents', 'Resources')));
    const launch = resolveMacLaunchTarget('', { home: fakeMacHome });
    assert.ok(typeof launch.target === 'string');
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});

test('v0.3.4: skin-engine enforces zero-patch sentinel, URL whitelist & protected config keys', () => {
  const src = readText('sidecars/skin-engine/main.mjs');

  assert.ok(src.includes('kernelInjection: false'));
  assert.ok(src.includes("macLauncherMode: 'isolate'"));
  assert.ok(src.includes('ensureKernelInjectionSyncedWithHost'));
  assert.ok(src.includes("if (!kernelInjection || !versionChanged) return;"));
  assert.ok(src.includes("state = cdpAvailable ? 'ok' : 'cdp_inactive'"));
  assert.ok(src.includes('function isTrustedUpdateEntryUrl('));
  assert.ok(src.includes('function isTrustedUpdateRedirectUrl('));
  assert.ok(src.includes('isAllowedCorsOrigin'));
  assert.ok(!src.includes('ghproxy'), 'third-party update mirror proxies must be removed');
  assert.ok(src.includes("typeof session.clearAntiFlash === 'function'"), 'boot-finished must symmetrically clear CDP anti-flash on all platforms');
  assert.ok(src.includes('readConfig()?.features?.kernelInjection === true'), 'hot-update extractAndDeploy must only auto-patch when kernelInjection is true');
  assert.ok(src.includes("'/api/restore-boot'") || src.includes("url.pathname === '/api/restore-boot'"));
  assert.ok(src.includes("'/api/mac-launcher/mode'") || src.includes("url.pathname === '/api/mac-launcher/mode'"));
  assert.ok(src.includes("'/api/shortcuts/repair'") || src.includes("url.pathname === '/api/shortcuts/repair'"));
  assert.ok(src.includes("'CHANGELOG.md'") && src.includes("'provisionSplash.js'") && src.includes("'self-heal.bat'"));
});

test('v0.3.4: auth and OAuth isolation in skin-engine, runtime-ui, and i18n-engine', () => {
  const skinSrc = readText('sidecars/skin-engine/main.mjs');
  const runtimeSrc = readText('sidecars/panel/compat/runtime-ui.mjs');
  const i18nSrc = readText('client/modules/i18n-engine.js');

  for (const token of ['oauth', 'login', 'signin', 'callback']) {
    assert.ok(skinSrc.includes(token), `skin-engine must exclude ${token}`);
    assert.ok(i18nSrc.includes(token), `i18n-engine must exclude ${token}`);
  }
  assert.ok(i18nSrc.includes('accounts.google.com'));
  assert.ok(runtimeSrc.includes('callback|oauth|auth|login|signin|sso'));
});

test('v0.3.4: host & Mode B install/uninstall/self-heal scripts align with zero-patch architecture', () => {
  const installMjs = readText('scripts/install.mjs');
  const uninstallMjs = readText('scripts/uninstall.mjs');
  const selfHealMjs = readText('scripts/self-heal.mjs');
  const restoreMjs = readText('scripts/restore-boot-overlay.mjs');
  const installPs1 = readText('install.ps1');
  const uninstallPs1 = readText('uninstall.ps1');
  const installSh = readText('install.sh');
  const uninstallSh = readText('uninstall.sh');

  assert.ok(selfHealMjs.includes('cfg?.features?.kernelInjection !== true'));
  assert.ok(restoreMjs.includes('--no-restart'));
  assert.ok(restoreMjs.includes('--from-plugin'));
  assert.ok(restoreMjs.includes('updateKernelInjectionConfig(false'));

  assert.ok(installMjs.includes('if (effectiveKernelInjection)'));
  assert.ok(installMjs.includes('patchWindowsShortcuts'));
  assert.ok(installMjs.includes('setupMacZeroPatchLauncher'));
  assert.ok(uninstallMjs.includes('--no-restart'));
  assert.ok(uninstallMjs.includes('teardownMacZeroPatchLauncher'));
  assert.ok(uninstallMjs.includes('restoreWindowsShortcuts'));

  assert.ok(installPs1.includes('provisionSplash.js'));
  assert.ok(installPs1.includes('Quick Launch\\User Pinned\\TaskBar'));
  assert.ok(installPs1.includes('user-shortcuts.json'));
  assert.ok(installPs1.includes('if ($kernelInjection)'));
  assert.ok(uninstallPs1.includes('user-shortcuts.json'));
  assert.ok(uninstallPs1.includes('AntigravitySkinSelfHeal.vbs'));

  assert.ok(installSh.includes('provisionSplash.js'));
  assert.ok(installSh.includes('com.antigravity-skin.launcher'));
  assert.ok(installSh.includes('if [ "$KERNEL_INJECTION" = "1" ]; then'));
  assert.ok(uninstallSh.includes('com.antigravity-skin.launcher'));
  assert.ok(uninstallSh.includes('lsregister'));
});

test('v0.3.4: Sidecar panel uses inline confirmation (no confirm/alert) & exposes restore/mode routes', () => {
  const html = readText('sidecars/panel/index.html');
  const appJs = readText('sidecars/panel/app.js');
  const panelMain = readText('sidecars/panel/main.mjs');
  const platformCompat = readText('sidecars/panel/compat/platform.mjs');

  assert.ok(html.includes('id="patch-repair-banner"'));
  assert.ok(html.includes('id="cfg-kernelInjection"'));
  assert.ok(html.includes('id="cfg-macLauncherMode"'));
  assert.ok(html.includes('id="mac-sign-warning"'));
  assert.ok(html.includes('id="kernel-confirm-box"'));
  assert.ok(html.includes('id="kernel-confirm-ok"'));
  assert.ok(html.includes('id="kernel-confirm-cancel"'));

  assert.ok(!/\bconfirm\s*\(/.test(appJs), 'panel app.js must not call window.confirm() in sandboxed iframe');
  assert.ok(!/\balert\s*\(/.test(appJs), 'panel app.js must not call window.alert() in sandboxed iframe');
  assert.ok(!appJs.includes('updateConfirm'), 'dead updateConfirm text should be removed');
  assert.ok(appJs.includes('/api/patch-restore'));
  assert.ok(appJs.includes('/api/shortcuts-repair'));
  assert.ok(appJs.includes('/api/mac-launcher-mode'));

  assert.ok(panelMain.includes('/api/patch-restore'));
  assert.ok(panelMain.includes('/api/shortcuts-repair'));
  assert.ok(panelMain.includes('/api/mac-launcher-mode'));
  assert.ok(panelMain.includes('prevFeatures.kernelInjection'));
  assert.ok(platformCompat.includes('AntigravitySkin.noindex'));

  const syncSrc = readText('scripts/sync-all.mjs');
  for (const requiredFile of [
    'config.default.json',
    'scripts/platform-host.mjs',
    'scripts/self-heal.mjs',
    'sidecars/panel/compat/platform.mjs',
    'sidecars/panel/compat/runtime-ui.mjs'
  ]) {
    assert.ok(syncSrc.includes(requiredFile), `sync-all.mjs must include ${requiredFile}`);
  }
});
