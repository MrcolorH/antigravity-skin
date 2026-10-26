/**
 * register-self-heal.mjs - 注册 / 注销 Windows 开机自愈守护
 *
 * 用法：
 *   node scripts/register-self-heal.mjs               # 注册（幂等，重复执行只覆盖）
 *   node scripts/register-self-heal.mjs --status      # 查看当前守护状态
 *   node scripts/register-self-heal.mjs --unregister  # 注销
 *
 * 为什么用「启动文件夹」而不是计划任务：
 *   计划任务 / schtasks 在标准（非管理员）账户下常被系统策略拒绝（0x80070005），
 *   而 %APPDATA%\...\Startup 属于用户自有目录，写入即生效、无需提权、不会被 UAC 打断。
 *
 * 隐藏执行链：Startup\*.vbs（wscript 无窗口）→ node.exe scripts/self-heal.mjs --quiet
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCRIPT_ROOT = path.resolve(__dirname, '..');

const LEGACY_TASK_NAME = 'AntigravitySkinSelfHeal';
const RUN_KEY = 'Registry::HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Run';
const RUN_VALUE = 'AntigravitySkinSelfHeal';

function resolvePluginRoot() {
  const deployed = path.join(os.homedir(), '.gemini', 'config', 'plugins', 'antigravity-skin');
  if (fs.existsSync(path.join(deployed, 'plugin.json'))) return deployed;
  return SCRIPT_ROOT;
}

const PLUGIN_ROOT = resolvePluginRoot();
const STATE_DIR = path.join(PLUGIN_ROOT, 'state');
const HEAL_SCRIPT = fs.existsSync(path.join(PLUGIN_ROOT, 'scripts', 'self-heal.mjs'))
  ? path.join(PLUGIN_ROOT, 'scripts', 'self-heal.mjs')
  : path.join(SCRIPT_ROOT, 'scripts', 'self-heal.mjs');

const APPDATA = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
const STARTUP_DIR = path.join(APPDATA, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup');
const STARTUP_VBS = path.join(STARTUP_DIR, 'AntigravitySkinSelfHeal.vbs');

const mode = process.argv.includes('--unregister')
  ? 'unregister'
  : (process.argv.includes('--status') ? 'status' : 'register');

function ps(script) {
  const tmp = path.join(os.tmpdir(), `agy-selfheal-${Date.now()}.ps1`);
  fs.writeFileSync(tmp, '\ufeff' + script, 'utf8'); // BOM：避免 PS 5.1 下中文乱码
  try {
    return execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', tmp], {
      encoding: 'utf8',
      windowsHide: true
    }).trim();
  } finally {
    try { fs.unlinkSync(tmp); } catch (_) {}
  }
}

function buildVbs(delaySeconds) {
  const nodePath = process.execPath;
  return [
    "' Antigravity Skin 开机自愈守护（由插件自动生成，请勿删除）",
    "' 作用：Antigravity 客户端更新覆盖 resources/app.asar 后，登录 Windows 时静默重打开机动画补丁",
    'Option Explicit',
    'Dim sh',
    'Set sh = CreateObject("WScript.Shell")',
    `WScript.Sleep ${delaySeconds * 1000}`,
    `sh.Run """${nodePath}"" ""${HEAL_SCRIPT}"" --quiet", 0, False`
  ].join('\r\n');
}

function register() {
  if (process.platform !== 'win32') {
    console.log('📌 非 Windows 平台无需注册自愈守护（macOS / Linux 采用非侵入式架构，无需改动 app.asar）。');
    return 0;
  }
  if (!fs.existsSync(HEAL_SCRIPT)) {
    console.error('❌ 未找到 self-heal.mjs，无法注册自愈守护。');
    return 1;
  }
  if (!fs.existsSync(path.dirname(process.execPath))) {
    console.error('❌ 未找到 node.exe，无法注册自愈守护。');
    return 1;
  }

  // 同时保留一份隐藏启动器在插件 state 目录，便于排查与手动触发
  try {
    fs.mkdirSync(STATE_DIR, { recursive: true });
    fs.writeFileSync(path.join(STATE_DIR, 'self-heal-launcher.vbs'), buildVbs(0), 'utf8');
  } catch (_) {}

  // 首选：启动文件夹（无需管理员权限，登录后 10 秒静默执行）
  try {
    fs.mkdirSync(STARTUP_DIR, { recursive: true });
    fs.writeFileSync(STARTUP_VBS, buildVbs(10), 'utf8');
    // 顺手清理历史遗留计划任务 / Run 项，避免重复执行
    cleanupLegacy();
    console.log('✅ 已注册开机自愈守护：登录 Windows 后 10 秒静默自检开机动画补丁。');
    console.log('   启动项：' + STARTUP_VBS);
    return 0;
  } catch (e) {
    console.log('⚠️ 启动文件夹写入失败，降级为注册表自启动项：' + (e.message || '').split('\n')[0]);
  }

  // 降级：HKCU Run 自启动项（同样通过 wscript 隐藏窗口，绝不闪黑框）
  const wscript = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'wscript.exe');
  try {
    ps(`
$ErrorActionPreference = 'Stop'
$vbs = '${path.join(STATE_DIR, 'self-heal-launcher.vbs')}'
Set-ItemProperty -Path '${RUN_KEY}' -Name '${RUN_VALUE}' -Value ('"' + '${wscript}' + '" "' + $vbs + '"')
Write-Output 'RUN_OK'
`);
    console.log('✅ 已写入登录自启动项（HKCU\\...\\Run）：登录后静默自检开机动画补丁。');
    return 0;
  } catch (e) {
    console.error('❌ 自愈守护注册失败：' + ((e.stderr || e.message || '')).toString().split('\n')[0]);
    return 1;
  }
}

function cleanupLegacy() {
  const wscript = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'wscript.exe');
  try {
    ps(`
$ErrorActionPreference = 'SilentlyContinue'
Unregister-ScheduledTask -TaskName '${LEGACY_TASK_NAME}' -Confirm:$false -ErrorAction SilentlyContinue
$v = (Get-ItemProperty -Path '${RUN_KEY}' -Name '${RUN_VALUE}' -ErrorAction SilentlyContinue).${RUN_VALUE}
if ($v) { Remove-ItemProperty -Path '${RUN_KEY}' -Name '${RUN_VALUE}' -ErrorAction SilentlyContinue }
Write-Output 'CLEAN_OK'
`);
  } catch (_) {}
}

function unregister() {
  if (process.platform !== 'win32') return 0;

  try { fs.unlinkSync(STARTUP_VBS); } catch (_) {}
  try { fs.unlinkSync(path.join(STATE_DIR, 'self-heal-launcher.vbs')); } catch (_) {}
  cleanupLegacy();
  console.log('✅ 已移除开机自愈守护（启动项 / 隐藏启动器 / 历史计划任务）。');
  return 0;
}

function status() {
  if (process.platform !== 'win32') {
    console.log('平台：' + process.platform + '（无需自愈守护）');
    return 0;
  }

  console.log('启动项：' + (fs.existsSync(STARTUP_VBS) ? '✅ 已注册 → ' + STARTUP_VBS : '❌ 未注册'));

  let runValue = '';
  try {
    runValue = ps(`
$v = (Get-ItemProperty -Path '${RUN_KEY}' -Name '${RUN_VALUE}' -ErrorAction SilentlyContinue).${RUN_VALUE}
if ($v) { Write-Output $v }
`);
  } catch (_) {}
  if (runValue) console.log('注册表自启动项：✅ ' + runValue);

  let taskState = '';
  try {
    taskState = ps(`
$t = Get-ScheduledTask -TaskName '${LEGACY_TASK_NAME}' -ErrorAction SilentlyContinue
if ($t) { Write-Output $t.State }
`);
  } catch (_) {}
  if (taskState) console.log('历史计划任务：' + taskState);

  let state = null;
  try { state = JSON.parse(fs.readFileSync(path.join(STATE_DIR, 'boot-patch.json'), 'utf8')); } catch (_) {}
  if (state) {
    console.log(`补丁状态：${state.patched ? '✅ 已就绪' : '⚠️ 缺失'}${state.pending ? '（已排队待下次登录恢复）' : ''}`);
    if (state.lastHealAt) console.log('最近一次自愈：' + state.lastHealAt);
  } else {
    console.log('补丁状态：尚未执行过自检（可双击 self-heal.bat 立即自检）');
  }
  console.log('自愈日志：' + path.join(STATE_DIR, 'self-heal.log'));
  return 0;
}

const code = mode === 'unregister' ? unregister() : (mode === 'status' ? status() : register());
process.exit(code);
