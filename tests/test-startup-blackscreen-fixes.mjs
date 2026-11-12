/**
 * test-startup-blackscreen-fixes.mjs
 * Regression tests for startup & home-screen black-screen fixes across:
 *   1. sidecars/skin-engine/main.mjs (conditional webwallgl bundling & bundle hashing)
 *   2. client/modules/wallpaper.js (boot video deferral, pre-warm, resume, readiness, CDP ensure)
 *   3. client/modules/boot-animation.js (re-entry __agyBootPlaying lock while host active)
 *   4. client/index.js (ContrastGuard pure read/write separation & boot deferral)
 *   5. client/modules/i18n-engine.js (chineseLocalization flag, boot deferral, self-mutation guard)
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = path.resolve(import.meta.dirname, '..');

let passed = 0;
let failed = 0;
const queue = [];

function test(name, fn) {
  queue.push({ name, fn });
}

// =========================================================================
// Helpers for DOM sandbox
// =========================================================================
function createMockDOM(options = {}) {
  const opLog = options.opLog || [];
  const winListeners = new Map();
  const docListeners = new Map();
  const sessionMap = new Map();
  const MutationObservers = [];

  class StyleObj {
    constructor(owner) {
      this._owner = owner;
      this._map = new Map();
    }
    setProperty(k, v, priority = '') {
      opLog.push(`WRITE:style:${this._owner.id || this._owner.tagName}:${k}`);
      this._map.set(k, String(v));
      if (k === 'color') this._owner._computedColor = priority ? (v === '#f4f7fb' ? 'rgb(244, 247, 251)' : 'rgb(11, 15, 20)') : v;
    }
    getPropertyValue(k) { return this._map.get(k) || ''; }
    removeProperty(k) {
      opLog.push(`WRITE:removeProp:${this._owner.id || this._owner.tagName}:${k}`);
      this._map.delete(k);
    }
  }

  class ClassListObj {
    constructor(owner) { this._owner = owner; this._set = new Set(); }
    add(...items) { items.forEach(i => this._set.add(i)); }
    remove(...items) { items.forEach(i => this._set.delete(i)); }
    contains(c) { return this._set.has(c); }
    toggle(c, force) {
      if (force === undefined) return this._set.has(c) ? (this._set.delete(c), false) : (this._set.add(c), true);
      if (force) this._set.add(c); else this._set.delete(c);
      return !!force;
    }
  }

  class Elem {
    constructor(tagName = 'DIV', id = '') {
      this.nodeType = 1;
      this.tagName = tagName.toUpperCase();
      this.namespaceURI = 'http://www.w3.org/1999/xhtml';
      this.id = id;
      this.dataset = {};
      this.classList = new ClassListObj(this);
      this.style = new StyleObj(this);
      this.attributesMap = new Map();
      if (id) this.attributesMap.set('id', id);
      this.childNodes = [];
      this.children = [];
      this.parentElement = null;
      this.isConnected = true;
      this._textContent = '';
      this._computedColor = 'rgb(244, 247, 251)';
      this._computedBg = 'rgba(0, 0, 0, 0)';
      this.readyState = 4;
      this.paused = true;
      this.playCalls = 0;
      this.pauseCalls = 0;
    }
    get className() { return Array.from(this.classList._set).join(' '); }
    set className(v) {
      this.classList._set = new Set(String(v || '').split(/\s+/).filter(Boolean));
    }
    get childElementCount() { return this.children.length; }
    get textContent() {
      if (this._textContent) return this._textContent;
      return this.childNodes.map(c => c.nodeType === 3 ? c.nodeValue : c.textContent).join('');
    }
    set textContent(v) {
      this._textContent = String(v);
      if (this.tagName === 'STYLE') return;
      this.childNodes = v ? [{ nodeType: 3, nodeValue: String(v), parentElement: this, isConnected: true }] : [];
    }
    appendChild(child) {
      child.parentElement = this;
      child.isConnected = true;
      this.childNodes.push(child);
      if (child.nodeType === 1) this.children.push(child);
      return child;
    }
    prepend(child) {
      child.parentElement = this;
      child.isConnected = true;
      this.childNodes.unshift(child);
      if (child.nodeType === 1) this.children.unshift(child);
      return child;
    }
    remove() {
      this.isConnected = false;
      if (!this.parentElement) return;
      this.parentElement.childNodes = this.parentElement.childNodes.filter(n => n !== this);
      this.parentElement.children = this.parentElement.children.filter(n => n !== this);
    }
    hasAttribute(k) { return this.attributesMap.has(k); }
    getAttribute(k) { return this.attributesMap.has(k) ? this.attributesMap.get(k) : null; }
    setAttribute(k, v) {
      opLog.push(`WRITE:attr:${this.id || this.tagName}:${k}`);
      this.attributesMap.set(k, String(v));
      if (k === 'id') this.id = String(v);
    }
    removeAttribute(k) {
      opLog.push(`WRITE:removeAttr:${this.id || this.tagName}:${k}`);
      this.attributesMap.delete(k);
    }
    getBoundingClientRect() {
      opLog.push(`READ:rect:${this.id || this.tagName}`);
      return { left: 0, top: 0, width: 120, height: 24 };
    }
    closest(sel) {
      const parts = sel.split(',').map(s => s.trim()).filter(Boolean);
      let cur = this;
      while (cur) {
        for (const p of parts) {
          if (p.startsWith('#') && cur.id === p.slice(1)) return cur;
          if (p.startsWith('[') && p.endsWith(']')) {
            const inner = p.slice(1, -1);
            if (!inner.includes('=') && cur.hasAttribute(inner)) return cur;
            const m = /^([^=]+)="([^"]+)"$/.exec(inner);
            if (m && cur.getAttribute(m[1]) === m[2]) return cur;
          }
          if (p.startsWith('.') && cur.classList.contains(p.slice(1))) return cur;
        }
        cur = cur.parentElement;
      }
      return null;
    }
    querySelector(sel) { return mockDoc.querySelector(sel, this); }
    querySelectorAll(sel) { return mockDoc.querySelectorAll(sel, this); }
    addEventListener() {}
    removeEventListener() {}
    play() { this.paused = false; this.playCalls++; return Promise.resolve(); }
    pause() { this.paused = true; this.pauseCalls++; }
    load() {}
  }

  function matchSimple(el, sel) {
    if (sel === '*') return true;
    const parts = sel.split(',').map(s => s.trim()).filter(Boolean);
    for (const p of parts) {
      const clean = p.split(':')[0].trim();
      if (clean.startsWith('#') && el.id === clean.slice(1)) return true;
      if (clean.startsWith('.') && el.classList.contains(clean.slice(1))) return true;
      if (clean.startsWith('[') && clean.endsWith(']')) {
        const attr = clean.slice(1, -1);
        if (el.hasAttribute(attr)) return true;
      }
      if (el.tagName === clean.toUpperCase()) return true;
    }
    return false;
  }

  function walkAll(root, out = []) {
    for (const c of root.children) {
      out.push(c);
      walkAll(c, out);
    }
    return out;
  }

  const documentElement = new Elem('HTML', 'html');
  const head = new Elem('HEAD', 'head');
  const body = new Elem('BODY', 'body');
  documentElement.appendChild(head);
  documentElement.appendChild(body);

  const mockDoc = {
    nodeType: 9,
    isConnected: true,
    readyState: options.readyState || 'complete',
    documentElement,
    head,
    body,
    childNodes: [documentElement],
    children: [documentElement],
    activeElement: body,
    createElement(tag) { return new Elem(tag); },
    getElementById(id) {
      if (documentElement.id === id) return documentElement;
      return walkAll(documentElement).find(el => el.id === id) || null;
    },
    querySelector(sel, scope = documentElement) {
      const list = walkAll(scope);
      return list.find(el => matchSimple(el, sel)) || null;
    },
    querySelectorAll(sel, scope = documentElement) {
      const list = walkAll(scope);
      return list.filter(el => matchSimple(el, sel));
    },
    createTreeWalker(root, showMask, filter) {
      options.onTreeWalker?.();
      const flat = [];
      const visit = (n) => {
        if (n !== root) {
          if (n.nodeType === 1) {
            const verdict = filter?.acceptNode ? filter.acceptNode(n) : 1;
            if (verdict === 2) return;
            flat.push(n);
          } else if (n.nodeType === 3) {
            flat.push(n);
          }
        }
        for (const ch of (n.childNodes || [])) visit(ch);
      };
      visit(root);
      let idx = 0;
      return { nextNode: () => flat[idx++] || null };
    },
    addEventListener(type, cb) {
      if (!docListeners.has(type)) docListeners.set(type, []);
      docListeners.get(type).push(cb);
    },
    removeEventListener() {}
  };

  class MockMutationObserver {
    constructor(cb) {
      this._cb = cb;
      this.records = [];
      MutationObservers.push(this);
    }
    observe() {}
    disconnect() {}
    takeRecords() {
      const r = this.records.slice();
      this.records.length = 0;
      return r;
    }
    trigger(mutations) {
      this._cb(mutations);
    }
  }

  const mockWin = {
    innerWidth: 1920,
    innerHeight: 1080,
    devicePixelRatio: 1,
    location: { pathname: '/workbench.html', href: 'vscode-file://vscode-app/workbench.html' },
    document: mockDoc,
    matchMedia: () => ({ matches: true, addEventListener() {}, removeEventListener() {} }),
    getComputedStyle(el) {
      opLog.push(`READ:cs:${el.id || el.tagName}`);
      return {
        visibility: 'visible',
        display: 'block',
        opacity: '1',
        color: el._computedColor || 'rgb(244, 247, 251)',
        backgroundColor: el._computedBg || 'rgba(0, 0, 0, 0)',
        backgroundImage: 'none'
      };
    },
    addEventListener(type, cb) {
      if (!winListeners.has(type)) winListeners.set(type, []);
      winListeners.get(type).push(cb);
    },
    removeEventListener() {},
    requestAnimationFrame(cb) { return setTimeout(cb, 0); },
    cancelAnimationFrame(id) { clearTimeout(id); }
  };

  const sessionStorage = {
    getItem: (k) => (sessionMap.has(k) ? sessionMap.get(k) : null),
    setItem: (k, v) => sessionMap.set(k, String(v)),
    removeItem: (k) => sessionMap.delete(k)
  };

  return { Elem, mockWin, mockDoc, sessionStorage, MockMutationObserver, MutationObservers, opLog };
}

// =========================================================================
// 1. sidecars/skin-engine/main.mjs guards & conditional webwallgl bundling
// =========================================================================
test('1.1 main.mjs shouldInlineWebWallGL & computeBundleHash + CDP guard invariants', () => {
  const mainSrc = fs.readFileSync(path.join(ROOT, 'sidecars/skin-engine/main.mjs'), 'utf8');

  const fnStart = mainSrc.indexOf('function shouldInlineWebWallGL(cfg)');
  const hashEnd = mainSrc.indexOf('async function ensureWebWallGLOnActiveSessions()');
  assert.ok(fnStart > 0 && hashEnd > fnStart, 'main.mjs 必须包含 shouldInlineWebWallGL 与 computeBundleHash');

  const helperSlice = mainSrc.slice(fnStart, hashEnd);
  const sandbox = {};
  vm.runInNewContext(`${helperSlice}\nthis.shouldInlineWebWallGL = shouldInlineWebWallGL;\nthis.computeBundleHash = computeBundleHash;`, sandbox);

  assert.equal(sandbox.shouldInlineWebWallGL({
    enabled: true,
    features: {
      bootAnimation: true,
      bootAnimationConfig: { type: 'video', mode: 'video' },
      dynamicWallpaper: { enabled: true, sourceType: 'video', wallpaperDir: '/some/old/scene' }
    }
  }), false, 'video 模式下即使有历史 wallpaperDir 也不应冷启动内联 1.1MB webwallgl.js');

  assert.equal(sandbox.shouldInlineWebWallGL({
    enabled: true,
    features: {
      bootAnimation: true,
      dynamicWallpaper: { enabled: true, sourceType: 'web', wallpaperDir: '/web/dir' }
    }
  }), false, 'web 模式下不应内联 webwallgl.js');

  assert.equal(sandbox.shouldInlineWebWallGL({
    enabled: true,
    features: {
      dynamicWallpaper: { enabled: true, sourceType: 'scene', wallpaperDir: '/scene/dir' }
    }
  }), true, 'scene 模式必须内联 webwallgl.js');

  assert.equal(sandbox.shouldInlineWebWallGL({
    enabled: true,
    features: {
      bootAnimation: true,
      bootAnimationConfig: { mode: 'scene' },
      dynamicWallpaper: { enabled: false }
    }
  }), true, 'scene 开屏模式必须内联 webwallgl.js');

  const h1 = sandbox.computeBundleHash('abc123');
  const h2 = sandbox.computeBundleHash('abc124');
  assert.notEqual(h1, h2, 'computeBundleHash 应对不同 bundle 生成不同摘要');

  assert.ok(mainSrc.includes('WebSocket.CONNECTING'), 'connectBrowserTarget 必须同时判断 WebSocket.CONNECTING，禁止重复建立 CDP 会话');
  assert.ok(mainSrc.includes("msg.params?.frame?.parentId"), 'Page.frameNavigated 必须跳过子 iframe/webview 导航');
  assert.ok(mainSrc.includes('/api/vendor/webwallgl/ensure'), '必须暴露 /api/vendor/webwallgl/ensure 动态补注端点');
});

// =========================================================================
// 2. client/modules/wallpaper.js video boot deferral, pre-warm & readiness
// =========================================================================
test('2.1 wallpaper.js 视频模式在开屏期延后解码、不阻断就绪检查并支持 prewarm/resume', async () => {
  const { Elem, mockWin, mockDoc, sessionStorage, MockMutationObserver } = createMockDOM();
  const rootEl = new Elem('DIV', 'root');
  rootEl.appendChild(new Elem('MAIN'));
  mockDoc.body.appendChild(rootEl);

  const bootHost = new Elem('DIV', 'agy-video-boot-host');
  mockDoc.body.appendChild(bootHost);

  mockWin.__AG_SKIN_CONFIG__ = {
    enabled: true,
    features: {
      bootAnimation: true,
      themeStyles: true,
      dynamicWallpaper: { enabled: true, sourceType: 'video', videoPath: '/fake/wall.mp4' }
    }
  };
  mockWin.__agyBootPlaying = true;
  mockWin.__AG_SKIN_PORT__ = 59288;

  const ensureCalled = [];
  globalThis.window = mockWin;
  globalThis.document = mockDoc;
  globalThis.sessionStorage = sessionStorage;
  globalThis.history = { pushState() {}, replaceState() {} };
  globalThis.MutationObserver = MockMutationObserver;
  globalThis.fetch = async (url) => {
    ensureCalled.push(url);
    return { ok: true, json: async () => ({ ok: true }) };
  };
  globalThis.navigator = {};

  const { initWallpaper } = await import(`../client/modules/wallpaper.js?t=${Date.now()}`);
  const handle = initWallpaper({
    videoUrl: 'http://127.0.0.1:59288/wallpaper.mp4',
    enableVideo: true,
    sourceType: 'video',
    glassThemeCss: 'body { color: #fff; }'
  });

  assert.equal(mockDoc.getElementById('agy-dynamic-video'), null, '开屏激活期间严禁立即创建并解码 #agy-dynamic-video');
  assert.ok(mockDoc.getElementById('agy-wallpaper-backdrop'), '仍须立即挂载纯色幕布底板防止白屏');
  assert.equal(typeof mockWin.__agyPendingVideoDynamicMount, 'function', '必须注册延迟视频挂载回调');
  assert.equal(mockWin.__agyIsHostTrulyReady(), true, '延迟视频壁纸时 __agyIsHostTrulyReady 应立即返回 true，不死等 readyState>=3');

  // Pre-warm phase (keeps __agyBootPlaying true)
  mockWin.__agyPrewarmBootWallpaper({ pausePlayback: true });
  const prewarmedVid = mockDoc.getElementById('agy-dynamic-video');
  assert.ok(prewarmedVid, '预热后应挂载 #agy-dynamic-video');
  assert.equal(mockWin.__agyBootPlaying, true, '预热阶段不得提前清除 __agyBootPlaying');
  assert.equal(prewarmedVid.paused, true, 'pausePlayback:true 预热时应保持暂停不抢占解码');

  // Resume phase at boot dismiss T=0
  mockWin.__agyResumeBootWallpaper();
  assert.equal(mockWin.__agyBootPlaying, false, '唤醒壁纸时应释放 __agyBootPlaying');
  assert.equal(prewarmedVid.style.getPropertyValue('opacity') || prewarmedVid.style.opacity, '1');
  assert.ok(prewarmedVid.playCalls >= 1, '唤醒时必须启动 play()');

  handle.destroy();
  bootHost.remove();
});

// =========================================================================
// 3. client/modules/boot-animation.js re-entry guard
// =========================================================================
test('3.1 boot-animation.js 重复注入时若开屏宿主仍激活则严禁重置 __agyBootPlaying', () => {
  const { Elem, mockWin, mockDoc, sessionStorage } = createMockDOM();
  const bootHost = new Elem('DIV', 'agy-video-boot-host');
  mockDoc.body.appendChild(bootHost);

  sessionStorage.setItem('__agy_booted__', 'true');
  mockWin.__agyBootPlaying = true;

  let bootCode = fs.readFileSync(path.join(ROOT, 'client/modules/boot-animation.js'), 'utf8');
  bootCode = bootCode.replace(/export\s+function\s+initBootAnimation/g, 'function initBootAnimation');

  const runOnce = new Function('window', 'document', 'sessionStorage', 'fetch', bootCode);
  runOnce(mockWin, mockDoc, sessionStorage, async () => ({ ok: true }));

  assert.equal(mockWin.__agyBootPlaying, true, '开屏宿主仍在播放时，重复注入不得把 __agyBootPlaying 重置为 false');

  bootHost.dataset.agyDismissing = '1';
  runOnce(mockWin, mockDoc, sessionStorage, async () => ({ ok: true }));
  assert.equal(mockWin.__agyBootPlaying, false, '开屏宿主已进入淡出阶段后允许释放 __agyBootPlaying');
});

// =========================================================================
// 4. client/index.js ContrastGuard read/write phase separation
// =========================================================================
test('4.1 ContrastGuard 读写阶段严格分离（零交错回流）且不误写未命中节点', () => {
  const opLog = [];
  const { Elem, mockWin, mockDoc, sessionStorage, MockMutationObserver } = createMockDOM({ opLog });
  mockDoc.documentElement.classList.add('agy-dark-wallpaper');

  const okText = new Elem('DIV', 'ok-text');
  okText.textContent = 'Already bright text';
  okText._computedColor = 'rgb(244, 247, 251)';

  const badText = new Elem('SPAN', 'bad-text');
  badText.textContent = 'Invisible dark text';
  badText._computedColor = 'rgb(15, 15, 15)';

  const svg = new Elem('SVG', 'svg-root');
  svg.namespaceURI = 'http://www.w3.org/2000/svg';
  const pathNode = new Elem('PATH', 'svg-path');
  pathNode.namespaceURI = 'http://www.w3.org/2000/svg';
  svg.appendChild(pathNode);

  mockDoc.body.appendChild(okText);
  mockDoc.body.appendChild(badText);
  mockDoc.body.appendChild(svg);

  mockWin.__AG_SKIN_CONFIG__ = {
    enabled: true,
    features: {
      themeStyles: true,
      bootAnimation: false,
      chineseLocalization: false,
      dynamicWallpaper: { enabled: true, sourceType: 'video', videoPath: '/w.mp4' }
    }
  };
  mockWin.__agyInitWallpaper = () => ({ update() {}, updateFilters() {}, updateInteraction() {}, destroy() {} });
  mockWin.__agyInitAppearanceMenu = () => ({ destroy() {} });
  mockWin.__agyInitBootAnimation = () => {};

  const indexCode = fs.readFileSync(path.join(ROOT, 'client/index.js'), 'utf8');
  const fn = new Function(
    'window', 'document', 'sessionStorage', 'MutationObserver', 'getComputedStyle', 'fetch',
    indexCode
  );
  fn(mockWin, mockDoc, sessionStorage, MockMutationObserver, mockWin.getComputedStyle, async () => ({ ok: true, json: async () => mockWin.__AG_SKIN_CONFIG__ }));

  // While boot playing, ContrastGuard must defer without touching layout/DOM
  opLog.length = 0;
  mockWin.__agyBootPlaying = true;
  mockWin.__agyContrastGuard();
  assert.equal(opLog.length, 0, '开屏播放期间 ContrastGuard 必须推迟，零 Layout 读取与 DOM 写入');

  // After boot ends, run ContrastGuard and inspect strict READ -> WRITE ordering
  mockWin.__agyBootPlaying = false;
  mockWin.__agyContrastGuard();

  const lastReadIdx = opLog.reduce((max, e, idx) => (e.startsWith('READ:') ? idx : max), -1);
  const firstWriteIdx = opLog.findIndex(e => e.startsWith('WRITE:'));

  assert.ok(lastReadIdx >= 0, '应执行元素采样读取');
  assert.ok(firstWriteIdx > lastReadIdx, `所有 READ 必须严格早于首次 WRITE (lastRead=${lastReadIdx}, firstWrite=${firstWriteIdx}, log=${opLog.join(', ')})`);
  assert.equal(badText.getAttribute('data-agy-cg'), 'light', '低对比度暗字应翻转为亮字');
  assert.equal(
    opLog.some(e => e.includes('ok-text') && e.startsWith('WRITE:')),
    false,
    '原本清晰的节点禁止被误调用 style.removeProperty 等写操作'
  );
});

// =========================================================================
// 5. client/modules/i18n-engine.js boot deferral, flag, & self-mutation guard
// =========================================================================
test('5.1 i18n-engine 支持 chineseLocalization:false、开屏期间延迟与自身修改零回环', () => {
  let treeWalkerCount = 0;

  // Case A: chineseLocalization: false
  {
    const { mockWin, mockDoc, MockMutationObserver } = createMockDOM({
      onTreeWalker: () => { treeWalkerCount++; }
    });
    mockWin.__AG_SKIN_CONFIG__ = { features: { chineseLocalization: false, language: 'zh-CN' } };
    const code = fs.readFileSync(path.join(ROOT, 'client/modules/i18n-engine.js'), 'utf8');
    const fn = new Function('window', 'document', 'Node', 'NodeFilter', 'MutationObserver', code);
    fn(mockWin, mockDoc, { ELEMENT_NODE: 1, TEXT_NODE: 3, DOCUMENT_NODE: 9 }, { SHOW_TEXT: 4, SHOW_ELEMENT: 1, FILTER_ACCEPT: 1, FILTER_REJECT: 2 }, MockMutationObserver);
    assert.equal(mockWin.__agyI18n.getLanguage(), 'en', 'chineseLocalization:false 时应保持 en');
    assert.equal(treeWalkerCount, 0, '未启用汉化时不应遍历整个 DOM');
  }

  // Case B: boot deferral + self-mutation attribute guard
  {
    treeWalkerCount = 0;
    const { Elem, mockWin, mockDoc, MockMutationObserver, MutationObservers } = createMockDOM({
      onTreeWalker: () => { treeWalkerCount++; }
    });
    mockWin.__AG_SKIN_CONFIG__ = { features: { chineseLocalization: true, language: 'zh-CN' } };
    mockWin.__agyBootPlaying = true;

    const modal = new Elem('DIV', 'settings');
    modal.classList.add('settings-modal-container');
    const btn = new Elem('BUTTON', 'btn-settings');
    btn.setAttribute('aria-label', 'Settings');
    modal.appendChild(btn);
    mockDoc.body.appendChild(modal);

    const code = fs.readFileSync(path.join(ROOT, 'client/modules/i18n-engine.js'), 'utf8');
    const fn = new Function('window', 'document', 'Node', 'NodeFilter', 'MutationObserver', code);
    fn(mockWin, mockDoc, { ELEMENT_NODE: 1, TEXT_NODE: 3, DOCUMENT_NODE: 9 }, { SHOW_TEXT: 4, SHOW_ELEMENT: 1, FILTER_ACCEPT: 1, FILTER_REJECT: 2 }, MockMutationObserver);

    assert.equal(treeWalkerCount, 0, '开屏动画激活期不得同步执行全树 TreeWalker');

    mockWin.__agyBootPlaying = false;
    mockWin.__agyI18n.resumeAfterBoot();
    assert.equal(treeWalkerCount, 1, '开屏结束唤醒后应执行 1 次全树汉化');
    assert.equal(btn.getAttribute('aria-label'), '设置', '按钮 aria-label 应被翻译为 设置');

    // Redundant setLanguage('zh-CN') must not re-walk entire document
    mockWin.__agyI18n.setLanguage('zh-CN');
    assert.equal(treeWalkerCount, 1, '相同语言重复调用 setLanguage 不得反复全树 TreeWalker');

    // Attribute mutation matching our own translated value must NOT schedule TreeWalker
    const obs = MutationObservers[MutationObservers.length - 1];
    assert.ok(obs, '应启动 i18n MutationObserver');
    obs.trigger([{ type: 'attributes', target: btn, attributeName: 'aria-label' }]);
    assert.equal(treeWalkerCount, 1, '自身 aria-label 属性回流不得触发 TreeWalker');
  }
});

// =========================================================================
// 6. Loopback blob media loader, boot video frame gate & main.mjs checks
// =========================================================================
test('6.1 __agyResolveBlobMediaUrl 复用同路径视频 blob URL 并安全兜底大文件与远端 URL', async () => {
  const { mockWin, mockDoc, sessionStorage } = createMockDOM();
  let fetchCalls = 0;
  let blobCounter = 0;
  const revoked = [];

  const mockFetch = async (url) => {
    fetchCalls++;
    if (String(url).includes('oversize.mp4')) {
      return {
        ok: true,
        headers: { get: (k) => (k.toLowerCase() === 'content-length' ? String(300 * 1024 * 1024) : null) },
        blob: async () => ({ size: 300 * 1024 * 1024 })
      };
    }
    if (String(url).includes('fail.mp4')) {
      return { ok: false, status: 500 };
    }
    return {
      ok: true,
      headers: { get: () => String(1024) },
      blob: async () => ({ size: 1024 })
    };
  };
  class MockURL extends URL {
    static createObjectURL() { return `blob:https://127.0.0.1:51848/${++blobCounter}`; }
    static revokeObjectURL(u) { revoked.push(u); }
  }

  const bootCode = fs.readFileSync(path.join(ROOT, 'client/modules/boot-animation.js'), 'utf8');
  const fn = new Function('window', 'document', 'MutationObserver', 'sessionStorage', 'fetch', 'URL', bootCode);
  fn(mockWin, mockDoc, createMockDOM().MockMutationObserver, sessionStorage, mockFetch, MockURL);

  assert.equal(typeof mockWin.__agyResolveBlobMediaUrl, 'function', '应导出 __agyResolveBlobMediaUrl');

  const bootUrl = 'http://127.0.0.1:59288/boot-video.mp4?path=%2Ftmp%2Fhero.mp4';
  const wallUrl = 'http://127.0.0.1:59288/wallpaper.mp4?path=%2Ftmp%2Fhero.mp4';
  const r1 = await mockWin.__agyResolveBlobMediaUrl(bootUrl);
  const r2 = await mockWin.__agyResolveBlobMediaUrl(wallUrl);
  assert.equal(r1.isBlob, true, '本地回环视频应转为 blob URL');
  assert.equal(r1.url, r2.url, '相同本地路径的开机视频与壁纸应共享同一个 blob URL');
  assert.equal(fetchCalls, 1, '同路径视频仅应 fetch 一次，零重复传输');

  const rRemote = await mockWin.__agyResolveBlobMediaUrl('https://example.com/demo.mp4');
  assert.equal(rRemote.isBlob, false, '非本地回环 URL 不应被拦截');
  assert.equal(rRemote.url, 'https://example.com/demo.mp4');

  const rOversize = await mockWin.__agyResolveBlobMediaUrl('http://127.0.0.1:59288/wallpaper.mp4?path=%2Ftmp%2Foversize.mp4');
  assert.equal(rOversize.isBlob, false, '超过 250MB 阈值的视频应回退直连流');

  const rFail = await mockWin.__agyResolveBlobMediaUrl('http://127.0.0.1:59288/wallpaper.mp4?path=%2Ftmp%2Ffail.mp4');
  assert.equal(rFail.isBlob, false, 'fetch 失败时应安全回退原始 URL');
});

test('6.2 startVideoBoot 必须等待首帧就绪后再启动自动倒计时与退场', async () => {
  const { mockWin, mockDoc, sessionStorage } = createMockDOM();
  const listenersMap = new WeakMap();
  const origCreate = mockDoc.createElement.bind(mockDoc);
  let createdVideo = null;
  mockDoc.createElement = (tag) => {
    const el = origCreate(tag);
    if (String(tag).toLowerCase() === 'video') {
      createdVideo = el;
      el.readyState = 0;
      const map = new Map();
      listenersMap.set(el, map);
      el.addEventListener = (type, cb) => {
        if (!map.has(type)) map.set(type, []);
        map.get(type).push(cb);
      };
      el.dispatch = (type) => {
        for (const cb of (map.get(type) || [])) cb({ type });
      };
    }
    return el;
  };
  mockWin.__AG_SKIN_CONFIG__ = {
    enabled: true,
    features: {
      bootAnimation: true,
      bootAnimationConfig: { type: 'video', autoEnterDelay: 1, videoPath: '/tmp/boot.mp4' }
    }
  };
  mockWin.__agyIsHostTrulyReady = () => true;

  const timers = [];
  const intervals = [];
  const fakeSetTimeout = (fn, ms) => {
    const entry = { fn, ms, cleared: false };
    timers.push(entry);
    return entry;
  };
  const fakeClearTimeout = (t) => { if (t) t.cleared = true; };
  const fakeSetInterval = (fn, ms) => {
    const entry = { fn, ms, cleared: false };
    intervals.push(entry);
    return entry;
  };
  const fakeClearInterval = (t) => { if (t) t.cleared = true; };

  const bootCode = fs.readFileSync(path.join(ROOT, 'client/modules/boot-animation.js'), 'utf8');
  const fn = new Function(
    'window', 'document', 'MutationObserver', 'sessionStorage', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
    bootCode
  );
  fn(mockWin, mockDoc, createMockDOM().MockMutationObserver, sessionStorage, fakeSetTimeout, fakeClearTimeout, fakeSetInterval, fakeClearInterval);

  mockWin.__triggerVideoBoot('/local-static.mp4');
  assert.ok(createdVideo, '应创建开机视频元素');
  assert.equal(createdVideo.dataset.agyLogicalSrc, '/local-static.mp4');

  // Tick readyCheckTimer while video.readyState === 0 (video still pure black, not decoded yet)
  intervals.forEach(i => { if (!i.cleared) i.fn(); });
  const earlyDismissTimer = timers.find(t => t.ms === 1000 && !t.cleared);
  assert.equal(earlyDismissTimer, undefined, '视频首帧未就绪时，即使宿主 DOM 已就绪也不得启动 autoEnterDelay 倒计时');

  // Simulate video decoding frame 1
  createdVideo.readyState = 2;
  createdVideo.dispatch('loadeddata');
  const readyDismissTimer = timers.find(t => t.ms === 1000 && !t.cleared);
  assert.ok(readyDismissTimer, '视频触发 loadeddata 后应立即启动 autoEnterDelay 倒计时');
});

test('6.3 main.mjs 覆盖小写 doctype 白底页降黑及 streamVideoFile 流关闭保护', () => {
  const mainSrc = fs.readFileSync(path.join(ROOT, 'sidecars/skin-engine/main.mjs'), 'utf8');
  assert.ok(mainSrc.includes("lowerUrl.includes('doctype')"), 'handleNativeLoadingOverlay 应不区分大小写匹配 <!doctype html> 白底页面');
  assert.ok(mainSrc.includes('const hadLogo = !!oldLogo;'), '纯白背景页无 Logo 时只置黑背景，不叠加载旋转胶囊');
  assert.ok(mainSrc.includes("req.on('close', destroyStream)") && mainSrc.includes("res.on('close', destroyStream)"), 'streamVideoFile 应在请求/响应中断时销毁 fileStream');
});

// Run queue cleanly
for (const item of queue) {
  try {
    await item.fn();
    console.log(`  ✅ [PASS] ${item.name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${item.name}`);
    console.error(err);
    failed++;
  }
}

console.log(`\n========================================`);
console.log(`🎉 启动与首页黑屏回归测试执行完毕！通过数: ${passed}, 失败数: ${failed}`);
console.log(`========================================`);

if (failed > 0) process.exit(1);
