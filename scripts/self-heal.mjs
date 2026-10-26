/**
 * self-heal.mjs - Antigravity Skin 开机自愈守护 (Windows 专用)
 *
 * 背景：Antigravity 客户端每次自动更新都会整体替换 resources/app.asar,
 *       插件目录与主题不受影响，但注入在 asar 里的「前置开机动效引擎」会丢失。
 *
 * 本脚本职责（幂等、可重复执行）：
 *   1. 定位 app.asar，检查补丁标记是否仍然存在（快路径，< 100ms 直接退出）
 *   2. 标记缺失 → 在客户端未运行的前提下自动重打补丁（不弹出客户端、不打断会话）
 *   3. 客户端正在运行 → 写入 pending 状态并在下次开机补打，绝不强杀用户窗口
 *   4. 全过程写入插件 state/self-heal.log，并把结果落盘给 UI 读取
 *
 * 退出码：0 = 已就绪/已修复；2 = 延后（客户端运行中）；1 = 异常
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync, execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCRIPT_ROOT = path.resolve(__dirname, '..');

const SILENT = process.argv.includes('--quiet');
const MARKER = 'agy-video-boot-host';
const LOCK_STALE_MS = 10 * 60 * 1000;
const PATCH_TIMEOUT_MS = 5 * 60 * 1000;

/** 插件运行根目录：优先使用已部署目录（持久化位置），否则回退到仓库根 */
function resolvePluginRoot() {
  const deployed = path.join(os.homedir(), '.gemini', 'config', 'plugins', 'antigravity-skin');
  if (fs.existsSync(path.join(deployed, 'plugin.json'))) return deployed;
  return SCRIPT_ROOT;
}

const PLUGIN_ROOT = resolvePluginRoot();
const STATE_DIR = path.join(PLUGIN_ROOT, 'state');
const LOG_FILE = path.join(STATE_DIR, 'self-heal.log');
const STATE_FILE = path.join(STATE_DIR, 'boot-patch.json');
const LOCK_FILE = path.join(STATE_DIR, '.self-heal.lock');

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  if (!SILENT) console.log(msg);
  try {
    fs.mkdirSync(STATE_DIR, { recursive: true });
    try {
      if (fs.statSync(LOG_FILE).size > 512 * 1024) {
        fs.renameSync(LOG_FILE, `${LOG_FILE}.1`);
      }
    } catch (_) {}
    fs.appendFileSync(LOG_FILE, line + '\n', 'utf8');
  } catch (_) {}
}

function writeState(patch) {
  try {
    fs.mkdirSync(STATE_DIR, { recursive: true });
    let prev = {};
    try { prev = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch (_) {}
    fs.writeFileSync(STATE_FILE, JSON.stringify({ ...prev, ...patch, updatedAt: new Date().toISOString() }, null, 2), 'utf8');
  } catch (_) {}
}

/** 定位所有可能的 Antigravity resources 目录（含 app.asar 的） */
function findResourcesDirs() {
  const home = os.homedir();
  const localAppData = process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');
  const programFiles = process.env.ProgramFiles || 'C:\\Program Files';
  const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
  const candidates = [
    path.join(localAppData, 'Programs', 'antigravity', 'resources'),
    path.join(localAppData, 'Programs', 'Antigravity', 'resources'),
    path.join(localAppData, 'Programs', 'Antigravity IDE', 'resources'),
    path.join(programFiles, 'Antigravity', 'resources'),
    path.join(programFilesX86, 'Antigravity', 'resources'),
    'D:\\soft\\Antigravity IDE\\resources'
  ];
  const found = [];
  const seen = new Set();
  for (const dir of candidates) {
    let asarPath;
    try { asarPath = path.join(dir, 'app.asar'); } catch (_) { continue; }
    if (!fs.existsSync(asarPath)) continue;
    // Windows 路径大小写不敏感，用 realpath 去重避免重复打补丁
    let key = dir;
    try { key = fs.realpathSync.native(dir).toLowerCase(); } catch (_) { key = dir.toLowerCase(); }
    if (seen.has(key)) continue;
    seen.add(key);
    found.push(dir);
  }
  return found;
}

/** 通过全量扫描 asar 二进制判断补丁标记是否存在（asar 未压缩，直接字符串检索即可） */
function isPatched(asarPath) {
  try {
    const buf = fs.readFileSync(asarPath);
    return buf.includes(MARKER);
  } catch (e) {
    log(`⚠️ 无法读取 ${asarPath}: ${e.message}`);
    return null;
  }
}

function isClientRunning() {
  try {
    const out = execSync('tasklist /NH', { encoding: 'utf8', windowsHide: true }).toLowerCase();
    return out.includes('antigravity.exe') || out.includes('antigravity ide.exe');
  } catch (_) {
    return true; // 检测失败时保守放行，避免误杀/误改
  }
}

function acquireLock() {
  try {
    fs.mkdirSync(STATE_DIR, { recursive: true });
    if (fs.existsSync(LOCK_FILE)) {
      const age = Date.now() - fs.statSync(LOCK_FILE).mtimeMs;
      if (age < LOCK_STALE_MS) return false;
      log('🔓 检测到过期锁文件，强制接管。');
    }
    fs.writeFileSync(LOCK_FILE, String(process.pid), 'utf8');
    return true;
  } catch (_) {
    return false;
  }
}

function releaseLock() {
  try { fs.unlinkSync(LOCK_FILE); } catch (_) {}
}

function runPatcher() {
  const deployed = path.join(PLUGIN_ROOT, 'scripts', 'patch-boot-overlay.mjs');
  const patcher = fs.existsSync(deployed) ? deployed : path.join(SCRIPT_ROOT, 'scripts', 'patch-boot-overlay.mjs');
  if (!fs.existsSync(patcher)) {
    log(`❌ 未找到补丁脚本: ${patcher}`);
    return false;
  }

  const cleanEnv = { ...process.env };
  delete cleanEnv.ELECTRON_RUN_AS_NODE;
  delete cleanEnv.ELECTRON_NO_ASAR;
  delete cleanEnv.NODE_OPTIONS;
  delete cleanEnv.NODE_ENV;
  cleanEnv.SKIP_KILL = '1';      // 前面已确认客户端未运行，禁用强杀，任何情况下都不打断用户
  cleanEnv.SKIP_RELAUNCH = '1';  // 自愈场景不主动拉起客户端
  cleanEnv.SELF_HEAL = '1';

  log(`🔧 开始重打开机动画补丁: ${patcher}`);
  const res = spawnSync(process.execPath, [patcher], {
    cwd: PLUGIN_ROOT,
    env: cleanEnv,
    encoding: 'utf8',
    timeout: PATCH_TIMEOUT_MS,
    windowsHide: true
  });

  const output = `${res.stdout || ''}${res.stderr || ''}`.trim();
  if (output) {
    for (const line of output.split(/\r?\n/)) {
      if (line.trim()) log(`   │ ${line.trim()}`);
    }
  }
  if (res.error) log(`❌ 补丁进程异常: ${res.error.message}`);
  return res.status === 0;
}

function main() {
  if (process.platform !== 'win32') {
    // macOS / Linux 采用非侵入式架构，无 asar 补丁，直接跳过
    return 3;
  }

  const dirs = findResourcesDirs();
  if (!dirs.length) {
    log('ℹ️ 未检测到 Antigravity 安装目录（app.asar 缺失），跳过自愈。');
    writeState({ supported: true, installed: false, patched: false });
    return 0;
  }

  const unpatched = [];
  for (const dir of dirs) {
    const asarPath = path.join(dir, 'app.asar');
    const patched = isPatched(asarPath);
    if (patched === true) {
      log(`✅ 补丁完好: ${asarPath}`);
    } else if (patched === false) {
      log(`⚠️ 补丁缺失: ${asarPath}`);
      unpatched.push(asarPath);
    }
  }

  if (!unpatched.length) {
    writeState({ supported: true, installed: true, patched: true, pending: false, deferredReason: '', asarPath: dirs[0] && path.join(dirs[0], 'app.asar') });
    return 0;
  }

  const asarPath = unpatched[0];
  if (isClientRunning()) {
    log('⏸ Antigravity 客户端正在运行，为避免打断会话，本次延后到下次开机自动补打。');
    writeState({ supported: true, installed: true, patched: false, pending: true, deferredReason: 'client-running', asarPath });
    return 2;
  }

  if (!acquireLock()) {
    log('⏸ 已有自愈任务在执行，跳过本次。');
    return 2;
  }

  try {
    const ok = runPatcher();
    const nowPatched = isPatched(asarPath) === true;
    if (ok && nowPatched) {
      log('🎉 开机动画补丁已自动恢复。');
      writeState({ supported: true, installed: true, patched: true, pending: false, deferredReason: '', asarPath, lastHealAt: new Date().toISOString() });
      return 0;
    }
    log('❌ 自愈失败，补丁仍未生效（可在外观设置中点击「一键修复」手动重试）。');
    writeState({ supported: true, installed: true, patched: false, pending: true, deferredReason: 'patch-failed', asarPath });
    return 1;
  } finally {
    releaseLock();
  }
}

let code = 1;
try {
  code = main();
} catch (e) {
  log(`❌ 自愈脚本异常: ${e.stack || e.message}`);
  code = 1;
}
process.exit(code);
