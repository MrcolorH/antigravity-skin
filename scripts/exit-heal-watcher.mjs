/**
 * exit-heal-watcher.mjs - Detached silent watcher that re-patches app.asar
 * within ~2s after Antigravity and its language_server completely exit.
 * Never kills or relaunches the running client.
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PLUGIN_ROOT = path.resolve(__dirname, '..');
const STATE_DIR = path.join(PLUGIN_ROOT, 'state');
const LOCK_FILE = path.join(STATE_DIR, '.exit-heal.lock');
const SENTINEL_FILE = path.join(STATE_DIR, 'patch-sentinel.json');

export function acquireWatcherLock(lockFile = LOCK_FILE, pid = process.pid) {
  fs.mkdirSync(path.dirname(lockFile), { recursive: true });
  if (fs.existsSync(lockFile)) {
    try {
      const existingPid = parseInt(fs.readFileSync(lockFile, 'utf8').trim(), 10);
      if (Number.isInteger(existingPid) && existingPid > 0 && existingPid !== pid) {
        try {
          process.kill(existingPid, 0);
          return false; // Another watcher is still alive
        } catch (_) {}
      }
    } catch (_) {}
  }
  fs.writeFileSync(lockFile, String(pid), 'utf8');
  return true;
}

export function releaseWatcherLock(lockFile = LOCK_FILE) {
  try {
    if (fs.existsSync(lockFile)) fs.unlinkSync(lockFile);
  } catch (_) {}
}

export function isHostProcessRunning(platform = process.platform) {
  try {
    if (platform === 'win32') {
      const out = execSync('tasklist /NH', { encoding: 'utf8', windowsHide: true }).toLowerCase();
      return out.includes('antigravity.exe') || out.includes('antigravity ide.exe') || out.includes('language_server');
    }
    if (platform === 'darwin') {
      try {
        const gui = execSync('pgrep -x "Antigravity"', { encoding: 'utf8' }).trim();
        if (gui) return true;
      } catch (_) {}
      try {
        const ls = execSync('pgrep -f "language_server.*antigravity"', { encoding: 'utf8' }).trim();
        if (ls) return true;
      } catch (_) {}
      return false;
    }
    try {
      const any = execSync('pgrep -f "antigravity|language_server"', { encoding: 'utf8' }).trim();
      return !!any;
    } catch (_) {
      return false;
    }
  } catch (_) {
    return false;
  }
}

function updateSentinelState(patch) {
  try {
    fs.mkdirSync(STATE_DIR, { recursive: true });
    let cur = {};
    if (fs.existsSync(SENTINEL_FILE)) {
      cur = JSON.parse(fs.readFileSync(SENTINEL_FILE, 'utf8'));
    }
    fs.writeFileSync(SENTINEL_FILE, JSON.stringify({ ...cur, ...patch }, null, 2), 'utf8');
  } catch (_) {}
}

export async function runExitHealWatcher({
  pollMs = 800,
  maxWaitMs = 6 * 60 * 60 * 1000,
  lockFile = LOCK_FILE,
  isRunning = isHostProcessRunning
} = {}) {
  if (!acquireWatcherLock(lockFile)) return { started: false, reason: 'locked' };

  const startedAt = Date.now();
  try {
    while (Date.now() - startedAt < maxWaitMs) {
      if (!isRunning()) {
        // Double-check after a short settle window (500ms) so we don't race with OS process cleanup
        await new Promise(r => setTimeout(r, 500));
        if (!isRunning()) break;
      }
      await new Promise(r => setTimeout(r, pollMs));
    }

    if (isRunning()) {
      return { started: true, patched: false, reason: 'timeout' };
    }

    const patchScript = path.join(PLUGIN_ROOT, 'scripts', 'patch-boot-overlay.mjs');
    if (fs.existsSync(patchScript)) {
      const cleanEnv = {
        ...process.env,
        SKIP_KILL: '1',
        SKIP_RELAUNCH: '1'
      };
      delete cleanEnv.ELECTRON_RUN_AS_NODE;
      delete cleanEnv.ELECTRON_NO_ASAR;
      delete cleanEnv.ATOM_SHELL_INTERNAL_RUN_AS_NODE;
      execSync(`"${process.execPath}" "${patchScript}" --no-restart --from-host`, {
        cwd: PLUGIN_ROOT,
        env: cleanEnv,
        stdio: 'ignore'
      });
      updateSentinelState({
        state: 'repaired_on_exit',
        patched: true,
        repairedAt: new Date().toISOString()
      });
      return { started: true, patched: true };
    }
    return { started: true, patched: false, reason: 'no_patch_script' };
  } finally {
    releaseWatcherLock(lockFile);
  }
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename);
if (isDirectRun) {
  runExitHealWatcher().then(() => process.exit(0)).catch(() => process.exit(1));
}
