/**
 * test-wallpaper-interaction.mjs
 * 子模块五：壁纸交互穿透与按键响应系统 (Hold-to-Interact & Dual-Track Event Bridge)
 * 单元与集成自动化测试套件（涵盖冷启动、热更新与双轨事件网桥）
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

console.log('🧪 开始执行子模块五（壁纸交互穿透与按键响应系统）自动化测试套件...\n');

let passedTests = 0;
let failedTests = 0;

const testQueue = [];
function test(name, fn) {
  testQueue.push({ name, fn });
}

// =========================================================================
// 测试分组 1：冷启动与默认配置完整性 (Cold Boot & Default Configs)
// =========================================================================
test('1.1 config.default.json 预置 wallpaperInteraction 默认规范', () => {
  const configPath = path.resolve('config.default.json');
  assert.ok(fs.existsSync(configPath), 'config.default.json 必须存在');
  const raw = fs.readFileSync(configPath, 'utf8');
  const cfg = JSON.parse(raw);
  const dw = cfg.features?.dynamicWallpaper;
  assert.ok(dw, 'features.dynamicWallpaper 必须存在');
  assert.ok(dw.wallpaperInteraction, 'dynamicWallpaper.wallpaperInteraction 必须存在');
  assert.equal(dw.wallpaperInteraction.enabled, true, '默认必须启用');
  assert.equal(dw.wallpaperInteraction.modifierKey, 'alt', '默认修饰键必须为 alt');
  assert.equal(dw.wallpaperInteraction.showHud, true, '默认开启 HUD 提示');
  assert.equal(dw.wallpaperInteraction.enableWheel, true, '默认开启滚轮穿透');
});

test('1.2 客户端 index.js 对接并透传 wallpaperInteraction', () => {
  const indexPath = path.resolve('client/index.js');
  const indexCode = fs.readFileSync(indexPath, 'utf8');
  assert.ok(indexCode.includes('wallpaperInteraction'), 'client/index.js 必须提取 dw.wallpaperInteraction');
  assert.ok(indexCode.includes('updateInteraction'), 'client/index.js 必须支持 updateInteraction 热更新桥接');
});

test('1.3 独立设置弹窗 media-display-modal.js 完备性', () => {
  const modalPath = path.resolve('client/modules/media-display-modal.js');
  const modalCode = fs.readFileSync(modalPath, 'utf8');
  assert.ok(modalCode.includes('agy-w-interact-enabled'), '设置弹窗中必须包含启用开关');
  assert.ok(modalCode.includes('agy-w-interact-key'), '设置弹窗中必须包含修饰键下拉框');
  assert.ok(modalCode.includes('agy-w-interact-wheel'), '设置弹窗中必须包含滚轮开关');
  assert.ok(modalCode.includes('agy-w-interact-hud'), '设置弹窗中必须包含 HUD 开关');
  assert.ok(modalCode.includes('updateInteraction'), '设置弹窗保存时必须调用 updateInteraction');
});

// =========================================================================
// 测试沙箱环境构建
// =========================================================================
class MockStyle {
  constructor() { this.props = new Map(); }
  setProperty(k, v) { this.props.set(k, String(v)); }
  getPropertyValue(k) { return this.props.get(k) || ''; }
  removeProperty(k) { this.props.delete(k); }
}

class MockClassList {
  constructor() { this.classes = new Set(); }
  add(cls) { this.classes.add(cls); }
  remove(cls) { this.classes.delete(cls); }
  contains(cls) { return this.classes.has(cls); }
}

class MockElement {
  constructor(id = '', tagName = 'div') {
    this.id = id;
    this.tagName = tagName.toUpperCase();
    this.classList = new MockClassList();
    this.style = new MockStyle();
    this.dataset = {};
    this.children = [];
    this.parentElement = null;
    this.innerHTML = '';
    this._textContent = '';
  }
  get textContent() { return this._textContent; }
  set textContent(v) { this._textContent = v; }
  appendChild(child) {
    this.children.push(child);
    child.parentElement = this;
    return child;
  }
  prepend(child) {
    this.children.unshift(child);
    child.parentElement = this;
    return child;
  }
  querySelector(sel) {
    if (sel.startsWith('#')) {
      const targetId = sel.slice(1);
      return findById(this, targetId);
    }
    return null;
  }
  querySelectorAll() { return []; }
  remove() {
    if (this.parentElement) {
      this.parentElement.children = this.parentElement.children.filter(c => c !== this);
    }
  }
  removeAttribute() {}
  setAttribute() {}
  getAttribute() { return ''; }
  closest() { return null; }
  addEventListener() {}
  removeEventListener() {}
  play() { return Promise.resolve(); }
  pause() {}
  getBoundingClientRect() {
    return { left: 0, top: 0, width: 1920, height: 1080 };
  }
}

function findById(root, id) {
  if (root.id === id) return root;
  for (const child of root.children) {
    const found = findById(child, id);
    if (found) return found;
  }
  return null;
}

let eventListeners = new Map();
let documentElement = new MockElement('html', 'html');
let body = new MockElement('body', 'body');
let head = new MockElement('head', 'head');
documentElement.appendChild(head);
documentElement.appendChild(body);

const mockWindow = {
  innerWidth: 1920,
  innerHeight: 1080,
  devicePixelRatio: 1,
  addEventListener(type, handler, opts) {
    if (!eventListeners.has(type)) eventListeners.set(type, []);
    eventListeners.get(type).push({ handler, capture: !!opts?.capture });
  },
  removeEventListener(type, handler) {
    if (!eventListeners.has(type)) return;
    eventListeners.set(type, eventListeners.get(type).filter(item => item.handler !== handler));
  },
  dispatchEvent(e) {
    const list = eventListeners.get(e.type) || [];
    for (const item of list.slice()) {
      item.handler(e);
    }
  },
  focus() {},
  requestAnimationFrame(cb) { return setTimeout(cb, 0); },
  cancelAnimationFrame(id) { clearTimeout(id); }
};

const mockDocument = {
  documentElement,
  body,
  head,
  activeElement: body,
  getElementById(id) { return findById(documentElement, id); },
  createElement(tag) { return new MockElement('', tag); },
  addEventListener(type, handler) { mockWindow.addEventListener(type, handler); },
  removeEventListener(type, handler) { mockWindow.removeEventListener(type, handler); },
  querySelector(sel) { return documentElement.querySelector(sel); },
  querySelectorAll() { return []; }
};

globalThis.window = mockWindow;
globalThis.document = mockDocument;
globalThis.history = { pushState() {}, replaceState() {} };
globalThis.MutationObserver = class {
  observe() {}
  disconnect() {}
};

function triggerKey(type, key, code) {
  let prevented = false;
  const evt = {
    type,
    key,
    code,
    preventDefault() { prevented = true; }
  };
  mockWindow.dispatchEvent(evt);
  return { prevented };
}

// 导入待测组件
const { initWallpaper } = await import('../client/modules/wallpaper.js');

// =========================================================================
// 测试分组 2：交互状态机、冷启动与热更新模拟测试
// =========================================================================
test('2.1 冷启动与默认挂载：初始状态无穿透，DOM 就绪', () => {
  const handle = initWallpaper({
    sourceType: 'scene',
    wallpaperInteraction: {
      enabled: true,
      modifierKey: 'alt',
      showHud: true,
      enableWheel: true
    }
  });

  assert.equal(handle.isPiercing(), false, '初始状态下 isPiercing 必须为 false');
  assert.equal(mockDocument.documentElement.classList.contains('agy-wallpaper-pierce-active'), false, '初始无穿透 active class');
  
  // 注入样式必须就绪
  const pierceStyle = mockDocument.getElementById('agy-wallpaper-pierce-style');
  assert.ok(pierceStyle, 'agy-wallpaper-pierce-style 必须已注入');
  assert.ok(pierceStyle.textContent.includes('agy-wallpaper-pierce-active'), '穿透 CSS 规则必须生效');

  handle.destroy();
});

test('2.2 按住 Alt 键穿透激活与松开恢复 (Hold-to-Interact)', () => {
  const handle = initWallpaper({
    sourceType: 'scene',
    wallpaperInteraction: {
      enabled: true,
      modifierKey: 'alt',
      showHud: true
    }
  });

  // 按下 Alt 键
  const downRes = triggerKey('keydown', 'Alt', 'AltLeft');
  assert.equal(downRes.prevented, true, 'Alt 键按下必须被 preventDefault 避免 Windows 菜单劫持');
  assert.equal(handle.isPiercing(), true, '按下 Alt 后 isPiercing 必须变为 true');
  assert.equal(mockDocument.documentElement.classList.contains('agy-wallpaper-pierce-active'), true, 'html 必须带有 agy-wallpaper-pierce-active');

  // HUD 提示节点检查
  const hud = mockDocument.getElementById('agy-interact-hud');
  assert.ok(hud, 'HUD 药丸必须已生成');
  assert.equal(hud.classList.contains('active'), true, 'HUD 必须处于 active 状态');

  // 松开 Alt 键
  triggerKey('keyup', 'Alt', 'AltLeft');
  assert.equal(handle.isPiercing(), false, '松开 Alt 后 isPiercing 必须恢复为 false');
  assert.equal(mockDocument.documentElement.classList.contains('agy-wallpaper-pierce-active'), false, '穿透 class 必须已移除');
  assert.equal(hud.classList.contains('active'), false, 'HUD 必须已淡出');

  handle.destroy();
});

test('2.3 热更新修饰键 (updateInteraction modifierKey: shift)', () => {
  const handle = initWallpaper({
    sourceType: 'scene',
    wallpaperInteraction: {
      enabled: true,
      modifierKey: 'alt'
    }
  });

  // 热更新为 Shift 键
  handle.updateInteraction({ modifierKey: 'shift' });

  // 此时按 Alt 应当无效
  triggerKey('keydown', 'Alt', 'AltLeft');
  assert.equal(handle.isPiercing(), false, '修改为 shift 后按 Alt 不得激活穿透');

  // 按 Shift 键激活
  triggerKey('keydown', 'Shift', 'ShiftLeft');
  assert.equal(handle.isPiercing(), true, '按 Shift 键成功激活穿透');

  // 松开 Shift 恢复
  triggerKey('keyup', 'Shift', 'ShiftLeft');
  assert.equal(handle.isPiercing(), false, '松开 Shift 键恢复');

  handle.destroy();
});

test('2.4 热更新禁用开关 (updateInteraction enabled: false 强制退出)', () => {
  const handle = initWallpaper({
    sourceType: 'scene',
    wallpaperInteraction: {
      enabled: true,
      modifierKey: 'alt'
    }
  });

  // 先激活穿透
  triggerKey('keydown', 'Alt', 'AltLeft');
  assert.equal(handle.isPiercing(), true);

  // 热更新关闭交互功能
  handle.updateInteraction({ enabled: false });
  assert.equal(handle.isPiercing(), false, '热更新关闭后必须立即强制退出穿透');
  assert.equal(mockDocument.documentElement.classList.contains('agy-wallpaper-pierce-active'), false);

  handle.destroy();
});

test('2.5 异常与边界避让：窗口失焦 (blur) 与组合键强退', () => {
  const handle = initWallpaper({
    sourceType: 'scene',
    wallpaperInteraction: { enabled: true, modifierKey: 'alt' }
  });

  // 1. 穿透中触发 window.blur
  triggerKey('keydown', 'Alt', 'AltLeft');
  assert.equal(handle.isPiercing(), true);
  mockWindow.dispatchEvent({ type: 'blur' });
  assert.equal(handle.isPiercing(), false, '窗口失焦必须强制退出穿透状态');

  // 2. 穿透中按下了打字/快捷键（非修饰键）
  triggerKey('keydown', 'Alt', 'AltLeft');
  assert.equal(handle.isPiercing(), true);
  triggerKey('keydown', 'a', 'KeyA');
  assert.equal(handle.isPiercing(), false, '按下其他字母打字键必须立刻释放穿透');

  handle.destroy();
});

test('2.6 资源销毁安全 (destroy 完整注销所有 DOM 与监听)', () => {
  const handle = initWallpaper({
    sourceType: 'scene',
    wallpaperInteraction: { enabled: true, modifierKey: 'alt' }
  });

  // 激活再销毁
  triggerKey('keydown', 'Alt', 'AltLeft');
  handle.destroy();

  assert.equal(handle.isPiercing(), false, '销毁后必须非穿透');
  assert.equal(mockDocument.getElementById('agy-wallpaper-pierce-style'), null, '穿透样式必须被清除');
  assert.equal(mockDocument.getElementById('agy-interact-hud'), null, 'HUD 节点必须被清除');
  assert.equal(mockDocument.getElementById('agy-interact-hud-style'), null, 'HUD 样式必须被清除');
});

// =========================================================================
// 测试分组 3：双轨事件网桥与细节开关测试
// =========================================================================
test('3.1 穿透态下的滚轮事件拦截阻断 (preventDefault)', () => {
  const handle = initWallpaper({
    sourceType: 'scene',
    wallpaperInteraction: { enabled: true, modifierKey: 'alt', enableWheel: true }
  });

  // 未穿透时，wheel 事件不被 preventDefault
  let prevented1 = false;
  mockWindow.dispatchEvent({
    type: 'wheel',
    deltaX: 0,
    deltaY: 100,
    deltaMode: 0,
    clientX: 500,
    clientY: 500,
    preventDefault() { prevented1 = true; }
  });
  assert.equal(prevented1, false, '未穿透态下不得阻断宿主滚动');

  // 进入穿透态
  triggerKey('keydown', 'Alt', 'AltLeft');
  assert.equal(handle.isPiercing(), true);

  // 穿透时，wheel 事件必须被 preventDefault 阻断
  let prevented2 = false;
  mockWindow.dispatchEvent({
    type: 'wheel',
    deltaX: 0,
    deltaY: 100,
    deltaMode: 0,
    clientX: 500,
    clientY: 500,
    preventDefault() { prevented2 = true; }
  });
  assert.equal(prevented2, true, '穿透态下滚轮事件必须被 preventDefault 阻断宿主滚动');

  handle.destroy();
});

test('3.2 HUD 开关热更新控制 (showHud: false)', () => {
  const handle = initWallpaper({
    sourceType: 'scene',
    wallpaperInteraction: { enabled: true, modifierKey: 'alt', showHud: false }
  });

  // 按下 Alt 键激活穿透
  triggerKey('keydown', 'Alt', 'AltLeft');
  assert.equal(handle.isPiercing(), true);

  // 当 showHud: false 时，HUD 元素不应被设为 active
  const hud = mockDocument.getElementById('agy-interact-hud');
  assert.equal(hud ? hud.classList.contains('active') : false, false, 'showHud 为 false 时 HUD 不得激活');

  // 热更新开启 HUD
  handle.updateInteraction({ showHud: true });
  const hudUpdated = mockDocument.getElementById('agy-interact-hud');
  assert.ok(hudUpdated, '热更新开启 HUD 后节点必须就绪');
  assert.equal(hudUpdated.classList.contains('active'), true, '热更新开启后 HUD 立即激活');

  handle.destroy();
});

test('3.3 Web 轨 Iframe postMessage 协议广播', () => {
  // 创建 iframe mock
  const postedMessages = [];
  const iframeMock = mockDocument.createElement('iframe');
  iframeMock.id = 'agy-dynamic-iframe';
  iframeMock.contentWindow = {
    postMessage(msg) {
      postedMessages.push(msg);
    }
  };
  mockDocument.body.appendChild(iframeMock);

  const handle = initWallpaper({
    sourceType: 'web',
    webUrl: 'http://127.0.0.1:59288/proxy/test',
    wallpaperInteraction: { enabled: true, modifierKey: 'alt' }
  });

  // 激活穿透
  triggerKey('keydown', 'Alt', 'AltLeft');

  // 模拟全局 pointerdown 点击
  mockWindow.dispatchEvent({
    type: 'pointerdown',
    clientX: 200,
    clientY: 300,
    buttons: 1
  });

  // 检验 iframe 是否收到了规范消息
  const lastMsg = postedMessages[postedMessages.length - 1];
  assert.ok(lastMsg, 'iframe 必须收到消息');
  assert.equal(lastMsg.__we, 1, '必须遵循 Wallpaper Engine 协议头 __we: 1');
  assert.equal(lastMsg.op, 'pointer');
  assert.equal(lastMsg.x, 200);
  assert.equal(lastMsg.y, 300);
  assert.equal(lastMsg.b, 1);

  // 退出穿透
  triggerKey('keyup', 'Alt', 'AltLeft');
  const leaveMsg = postedMessages[postedMessages.length - 1];
  assert.equal(leaveMsg.op, 'pointerLeave', '退出穿透时必须广播 pointerLeave');

  handle.destroy();
  iframeMock.remove();
});

// =========================================================================
// 执行所有测试
// =========================================================================
for (const item of testQueue) {
  try {
    item.fn();
    console.log(`  ✅ [PASS] ${item.name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${item.name}`);
    console.error(err);
    failedTests++;
  }
}

console.log(`\n========================================`);
console.log(`🎉 测试套件执行完毕！通过数: ${passedTests}, 失败数: ${failedTests}`);
console.log(`========================================\n`);

if (failedTests > 0) {
  process.exit(1);
}
