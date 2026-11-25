import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

import {
  detectLegacyPulse,
  restoreLegacyPulseAsarPatch,
  migrateLegacyPulseData,
  cleanupLegacyPulsePlugin
} from '../scripts/migrate-pulse.mjs';
import { acquireWatcherLock, releaseWatcherLock } from '../scripts/exit-heal-watcher.mjs';
import { findModelsUsagePlanAnchor, findModelsUsageAnchorInfo, initDashboardSettings } from '../client/modules/dashboard-settings.js';
import { platformPaths, migrateLegacyPulseData as panelMigrateData } from '../sidecars/panel/compat/platform.mjs';
import { serverFromDiscovery } from '../sidecars/panel/client.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

test('config.default.json includes features.dashboard defaults', () => {
  const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'config.default.json'), 'utf8'));
  assert.equal(cfg.features.dashboard.enabled, true);
  assert.equal(cfg.features.dashboard.inlineEnabled, true);
});

test('panel UI and inline-widget unify language and include repair banner', () => {
  const html = fs.readFileSync(path.join(ROOT, 'sidecars/panel/index.html'), 'utf8');
  const appJs = fs.readFileSync(path.join(ROOT, 'sidecars/panel/app.js'), 'utf8');
  const inlineJs = fs.readFileSync(path.join(ROOT, 'sidecars/panel/compat/inline-widget.cjs'), 'utf8');

  assert.equal(html.includes('id="language-toggle"'), false);
  assert.equal(html.includes('id="patch-repair-banner"'), true);
  assert.equal(appJs.includes('language-toggle'), false);
  assert.equal(appJs.includes('value.hostLanguage'), true);
  assert.equal(inlineJs.includes('data-language-choice'), false);
  assert.equal(inlineJs.includes('id="language-guide"'), false);
  assert.equal(inlineJs.includes('window.__agPulseSetLanguage'), true);
});

test('migrate-pulse detects, restores ASAR backup by SHA256, migrates data, and cleans up safely', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'agy-migrate-test-'));
  try {
    const home = path.join(tmp, 'home');
    const pluginsDir = path.join(home, '.gemini', 'config', 'plugins');
    const pulseDir = path.join(pluginsDir, 'antigravity-pulse');
    const skinDir = path.join(pluginsDir, 'antigravity-skin');
    const configFile = path.join(home, '.gemini', 'config', 'config.json');

    fs.mkdirSync(pulseDir, { recursive: true });
    fs.mkdirSync(path.join(skinDir, 'config'), { recursive: true });
    fs.writeFileSync(path.join(pulseDir, 'plugin.json'), JSON.stringify({ name: 'antigravity-pulse' }));
    fs.writeFileSync(path.join(skinDir, 'config', 'config.json'), JSON.stringify({ enabled: true, features: {} }));
    fs.writeFileSync(configFile, JSON.stringify({
      plugins: { 'antigravity-pulse': { enabled: true } },
      sidecars: { 'antigravity-pulse/panel': { enabled: true } }
    }));

    // Legacy data
    const legacyHist = path.join(home, '.gemini', 'antigravity', 'sidecar_data', 'antigravity-pulse', 'panel', 'data', 'history-v1');
    fs.mkdirSync(legacyHist, { recursive: true });
    fs.writeFileSync(path.join(legacyHist, 'ledger.json'), '{"ok":true}');

    // Legacy settings
    const legacySettings = path.join(tmp, 'pulse-settings.json');
    fs.writeFileSync(legacySettings, JSON.stringify({ enabled: true, inline: false }));

    const det = detectLegacyPulse({ home, pluginsDir, configFile });
    assert.equal(det.detected, true);
    assert.equal(det.hasDir, true);
    assert.equal(det.hasConfig, true);

    // ASAR backup restore
    const backupsDir = path.join(tmp, 'backups');
    const b1 = path.join(backupsDir, '20260101');
    fs.mkdirSync(b1, { recursive: true });
    const origBuf = Buffer.from('ORIGINAL_ASAR_CONTENT');
    const patchedBuf = Buffer.from('PATCHED // AG_PULSE_INLINE_V1 CONTENT');
    const origHash = crypto.createHash('sha256').update(origBuf).digest('hex');
    const patchedHash = crypto.createHash('sha256').update(patchedBuf).digest('hex');
    const asarPath = path.join(tmp, 'app.asar');
    fs.writeFileSync(asarPath, patchedBuf);
    fs.writeFileSync(path.join(b1, 'original.asar'), origBuf);
    fs.writeFileSync(path.join(b1, 'patch.json'), JSON.stringify({
      originalSha256: origHash,
      patchedSha256: patchedHash,
      backupFile: 'original.asar'
    }));

    const restored = restoreLegacyPulseAsarPatch({ asarPath, backupsDir });
    assert.equal(restored.restored, true);
    assert.deepEqual(fs.readFileSync(asarPath), origBuf);

    // Tampered ASAR with AG_PULSE_INLINE_V1 but no matching backup throws safely
    fs.writeFileSync(asarPath, Buffer.from('UNKNOWN // AG_PULSE_INLINE_V1'));
    assert.throws(() => restoreLegacyPulseAsarPatch({ asarPath, backupsDir }), /未找到/);

    const mig = migrateLegacyPulseData({ home, targetPluginDir: skinDir, pulseSettingsPath: legacySettings });
    assert.deepEqual(mig.copied, ['history-v1']);
    assert.equal(mig.inheritedDashboard.inlineEnabled, false);
    const copiedFile = path.join(home, '.gemini', 'antigravity', 'sidecar_data', 'antigravity-skin', 'panel', 'data', 'history-v1', 'ledger.json');
    assert.equal(fs.existsSync(copiedFile), true);
    assert.equal(fs.existsSync(path.join(legacyHist, 'ledger.json')), true); // cold backup preserved

    await cleanupLegacyPulsePlugin({ home, pluginsDir, configFile, isInsideHost: false });
    assert.equal(fs.existsSync(pulseDir), false);
    const nextCfg = JSON.parse(fs.readFileSync(configFile, 'utf8'));
    assert.equal(nextCfg.plugins['antigravity-pulse'], undefined);
    assert.equal(nextCfg.sidecars['antigravity-pulse/panel'], undefined);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('serverFromDiscovery falls back to ANTIGRAVITY_CSRF_TOKEN when --csrf_token is omitted in CLI', () => {
  const rows = [{ ProcessId: 14103, CommandLine: 'language_server --standalone --read_host_bridge_token_from_stdin', Ports: [51234] }];
  const log = 'listening on random port at 51234 for HTTP\n';
  assert.throws(() => serverFromDiscovery(log, rows, {}), /当前版本未提供可用的本地检测凭据/);
  assert.deepEqual(
    serverFromDiscovery(log, rows, { ANTIGRAVITY_CSRF_TOKEN: 'env-token-123' }),
    { port: 51234, csrf: 'env-token-123', pid: 14103 }
  );
});

test('exit-heal-watcher lock prevents duplicate watchers', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'agy-lock-test-'));
  const lockFile = path.join(tmp, '.exit-heal.lock');
  try {
    assert.equal(acquireWatcherLock(lockFile, process.pid), true);
    assert.equal(acquireWatcherLock(lockFile, process.pid + 99999), false); // current pid is alive
    releaseWatcherLock(lockFile);
    assert.equal(fs.existsSync(lockFile), false);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('serverFromDiscovery falls back to ANTIGRAVITY_CSRF_TOKEN when --csrf_token is omitted in CLI', () => {
  const rows = [{ ProcessId: 14103, CommandLine: 'language_server --standalone --read_host_bridge_token_from_stdin', Ports: [51234] }];
  const log = 'listening on random port at 51234 for HTTP\n';
  assert.throws(() => serverFromDiscovery(log, rows, {}), /当前版本未提供可用的本地检测凭据/);
  assert.deepEqual(
    serverFromDiscovery(log, rows, { ANTIGRAVITY_CSRF_TOKEN: 'env-token-123' }),
    { port: 51234, csrf: 'env-token-123', pid: 14103 }
  );
});

test('findModelsUsagePlanAnchor locates Your Plan in EN and ZH modals and ignores Appearance', () => {
  const makeCard = (title, cls = 'rounded-lg border p-4') => {
    const h = {
      textContent: title,
      closest: () => null,
      parentElement: null
    };
    const card = {
      className: cls,
      textContent: `${title} Details`,
      parentElement: null
    };
    h.parentElement = card;
    return { h, card };
  };

  const enPlan = makeCard('Your Plan');
  const enModal = {
    textContent: 'Models & Usage Your Plan Quota',
    querySelectorAll: () => [enPlan.h]
  };
  enPlan.card.parentElement = enModal;
  assert.equal(findModelsUsagePlanAnchor(enModal), enPlan.card);

  const zhPlan = makeCard('您的套餐');
  const zhModal = {
    textContent: '模型与用量 您的套餐 配额',
    querySelectorAll: () => [zhPlan.h]
  };
  zhPlan.card.parentElement = zhModal;
  assert.equal(findModelsUsagePlanAnchor(zhModal), zhPlan.card);

  const appearanceModal = {
    textContent: 'Appearance Theme Wallpaper',
    querySelectorAll: () => [enPlan.h]
  };
  assert.equal(findModelsUsagePlanAnchor(appearanceModal), null);
});

test('findModelsUsageAnchorInfo prefers Model Credits section over Plan and never escapes to outer scroll pane', () => {
  const outerScrollPane = {
    className: 'rounded-xl bg-background overflow-y-auto',
    textContent: '模型与用量 套餐计划 您的套餐：Google AI Pro 模型积分 启用 AI 积分超额使用 Gemini 模型 剩余周额度',
    parentElement: null,
    closest: () => null
  };
  const centerCol = {
    className: 'mx-auto max-w-2xl space-y-6',
    textContent: outerScrollPane.textContent,
    parentElement: outerScrollPane,
    closest: () => null
  };
  const modal = {
    textContent: outerScrollPane.textContent,
    querySelectorAll: () => [planHeading, creditsHeading]
  };
  outerScrollPane.parentElement = modal;

  // Plan section
  const planSection = {
    className: 'space-y-2',
    textContent: '套餐计划 您的套餐：Google AI Pro',
    parentElement: centerCol,
    closest: () => null
  };
  const planHeading = {
    textContent: '套餐计划',
    className: 'text-sm font-medium',
    children: [],
    parentElement: planSection,
    closest: () => null
  };

  // Credits section (heading is sibling of rounded card, both inside creditsSection)
  const creditsSection = {
    className: 'space-y-2',
    textContent: '模型积分 启用 AI 积分超额使用',
    parentElement: centerCol,
    closest: () => null
  };
  const creditsHeading = {
    textContent: '模型积分',
    className: 'text-sm font-medium',
    children: [],
    parentElement: creditsSection,
    closest: () => null
  };
  const creditsCard = {
    className: 'rounded-lg border p-4 flex justify-between items-center',
    textContent: '启用 AI 积分超额使用',
    parentElement: creditsSection,
    closest: () => null
  };
  creditsHeading.nextElementSibling = creditsCard;
  creditsSection.querySelectorAll = () => [creditsHeading, creditsCard];

  const info = findModelsUsageAnchorInfo(modal);
  assert.equal(info?.tier, 'credits');
  assert.equal(info?.anchor, creditsSection);
  assert.equal(info?.cardEl, creditsCard);
  assert.notEqual(info?.anchor, outerScrollPane);
  assert.notEqual(info?.anchor, centerCol);

  // Flat-sibling layout (no section wrapper)
  const flatCol = {
    className: 'mx-auto max-w-2xl',
    textContent: 'Models & Usage Model Credits Enable AI credit overages Gemini Models',
    parentElement: outerScrollPane,
    closest: () => null
  };
  const flatHeading = {
    textContent: 'Model Credits',
    className: 'text-sm font-medium',
    children: [],
    parentElement: flatCol,
    closest: () => null
  };
  const flatCard = {
    className: 'rounded-lg border p-4',
    textContent: 'Enable AI credit overages',
    parentElement: flatCol,
    closest: () => null
  };
  flatHeading.nextElementSibling = flatCard;
  const flatModal = {
    textContent: flatCol.textContent,
    querySelectorAll: () => [flatHeading]
  };
  const flatInfo = findModelsUsageAnchorInfo(flatModal);
  assert.equal(flatInfo?.tier, 'credits');
  assert.equal(flatInfo?.anchor, flatCard);
});

test('initDashboardSettings does not throw at document_start when document.body and documentElement are null', () => {
  const prevDoc = globalThis.document;
  const prevWin = globalThis.window;
  const prevMO = globalThis.MutationObserver;
  const listeners = new Map();
  let observed = false;

  globalThis.MutationObserver = class {
    observe(target) {
      if (!target) throw new TypeError("parameter 1 is not of type 'Node'");
      observed = true;
    }
    disconnect() {}
  };
  globalThis.window = {};
  globalThis.document = {
    body: null,
    documentElement: null,
    querySelectorAll: () => [],
    getElementById: () => null,
    addEventListener: (ev, fn) => listeners.set(ev, fn),
    removeEventListener: (ev) => listeners.delete(ev)
  };

  try {
    const handle = initDashboardSettings(() => ({ features: { dashboard: { enabled: true } } }), () => {});
    assert.equal(observed, false);
    assert.equal(typeof listeners.get('DOMContentLoaded'), 'function');
    // Simulate DOMContentLoaded once body exists
    globalThis.document.body = { nodeType: 1 };
    listeners.get('DOMContentLoaded')();
    assert.equal(observed, true);
    handle.destroy();
  } finally {
    globalThis.document = prevDoc;
    globalThis.window = prevWin;
    globalThis.MutationObserver = prevMO;
  }
});

test('platformPaths points to antigravity-skin data dir and migrates legacy data', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'agy-plat-test-'));
  try {
    const p = platformPaths({ platform: 'darwin', home: tmp, env: {} });
    assert.equal(p.data.endsWith(path.join('sidecar_data', 'antigravity-skin', 'panel', 'data')), true);
    const legacyUsage = path.join(p.legacyData, 'usage-v1');
    fs.mkdirSync(legacyUsage, { recursive: true });
    fs.writeFileSync(path.join(legacyUsage, '2026-11.json'), '{"tokens":42}');
    assert.equal(panelMigrateData(p), true);
    assert.equal(fs.existsSync(path.join(p.data, 'usage-v1', '2026-11.json')), true);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('serverFromDiscovery falls back to ANTIGRAVITY_CSRF_TOKEN when --csrf_token is omitted in CLI', () => {
  const rows = [{ ProcessId: 14103, CommandLine: 'language_server --standalone --read_host_bridge_token_from_stdin', Ports: [51234] }];
  const log = 'listening on random port at 51234 for HTTP\n';
  assert.throws(() => serverFromDiscovery(log, rows, {}), /当前版本未提供可用的本地检测凭据/);
  assert.deepEqual(
    serverFromDiscovery(log, rows, { ANTIGRAVITY_CSRF_TOKEN: 'env-token-123' }),
    { port: 51234, csrf: 'env-token-123', pid: 14103 }
  );
});
