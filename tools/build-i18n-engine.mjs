import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

const jsonPath = path.join(PROJECT_ROOT, 'client', 'i18n', 'zh-CN.all.json');
if (!fs.existsSync(jsonPath)) {
  console.error(`[ERR] ${jsonPath} 不存在，请先运行 update-i18n-upstream.mjs`);
  process.exit(1);
}

const allData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
const { exact, patterns } = allData;

console.log(`[构建] 正在将 ${Object.keys(exact).length} 条词条与 ${patterns.length} 条动态正则构建至 i18n-engine.js...`);

// 准备构建 i18n-engine.js
// 为防止单个 JS 文件中字面量过大导致解析变慢，采用分块或紧凑的键值对数组
const exactEntriesJson = JSON.stringify(Object.entries(exact));
const patternsJson = JSON.stringify(patterns);

const engineTemplate = `(() => {
  if (typeof window === 'undefined') return;
  if (window.__antigravityZhPatchInstalled === true && window.__observedDocument === document) return;
  window.__antigravityZhPatchInstalled = true;
  window.__observedDocument = document;

  // 1. 全量静态精确词典表 (O(1) 阶梯极速查找)
  const rawExactEntries = ${exactEntriesJson};
  const exactMap = new Map(rawExactEntries);

  // 纯静态精准词典（按键长度倒序，用于长句复合匹配）
  // 优化：仅选取长度 >= 4 且包含空格的短语进入子串替换流，避免单字误伤
  const substringPhrases = rawExactEntries.filter(([k]) => k.length >= 4 && /\\s/.test(k));

  // 2. 动态模板与正则规则表
  const rawPatterns = ${patternsJson};
  const compiledPatterns = [];

  for (const item of rawPatterns) {
    try {
      const reg = new RegExp(item.regex, item.flags || 'g');
      compiledPatterns.push([reg, item.replacement]);
    } catch (e) {
      // 忽略非法正则
    }
  }

  // 3. 专用动态时间与业务参数处理
  function formatRelativeTime(str) {
    if (!str) return str;
    return str
      .replace(/(\\d+)\\s*years?\\b/gi, (_m, n) => n + ' 年')
      .replace(/(\\d+)\\s*months?\\b/gi, (_m, n) => n + ' 个月')
      .replace(/(\\d+)\\s*weeks?\\b/gi, (_m, n) => n + ' 周')
      .replace(/(\\d+)\\s*days?\\b/gi, (_m, n) => n + ' 天')
      .replace(/(\\d+)\\s*hours?\\b/gi, (_m, n) => n + ' 小时')
      .replace(/(\\d+)\\s*minutes?\\b/gi, (_m, n) => n + ' 分钟')
      .replace(/(\\d+)\\s*seconds?\\b/gi, (_m, n) => n + ' 秒')
      .replace(/,\\s*/g, ' ')
      .trim();
  }

  const specialDynamicPatterns = [
    // 动态权限请求
    [/Requesting permission to (read access to this path|write access to this path|reading this URL|executing actions on this URL|running this command|running this command outside the sandbox|using this MCP tool) (.+)/g, (_match, action, target) => {
      const actions = {
        'read access to this path': '读取此路径',
        'write access to this path': '写入此路径',
        'reading this URL': '读取此 URL',
        'executing actions on this URL': '在此 URL 上执行操作',
        'running this command': '运行此命令',
        'running this command outside the sandbox': '在沙盒外运行此命令',
        'using this MCP tool': '使用此 MCP 工具',
      };
      return '正在请求权限：' + (actions[action] ?? action) + ' ' + target;
    }],
    [/Agent needs permission to act on (.+)/g, '智能体需要权限才能操作 $1'],
    [/Agent needs permission to execute JavaScript on (.+)/g, '智能体需要权限才能在 $1 上执行 JavaScript'],
    [/Yes, save rule for '([^']+)' (when not in a project|in this project|in this workspace|globally)/g, (_m, target, scope) => {
      const scopes = { 'when not in a project': '在未处于项目时', 'in this project': '在此项目中', 'in this workspace': '在此工作区', 'globally': '全局' };
      return \`是，并在\${scopes[scope] || scope}保存 '\${target}' 的规则\`;
    }],
    [/Yes, save rule (when not in a project|in this project|in this workspace|globally)/g, (_m, scope) => {
      const scopes = { 'when not in a project': '在未处于项目时', 'in this project': '在此项目中', 'in this workspace': '在此工作区', 'globally': '全局' };
      return \`是，并在\${scopes[scope] || scope}保存规则\`;
    }],
    [/Yes, and always allow '([^']+)'( (when not in a project|in this project|in this workspace))?/g, (_m, target, _p, scope) => {
      const scopes = { 'when not in a project': '在未处于项目时', 'in this project': '在此项目中', 'in this workspace': '在此工作区' };
      return \`是，并\${scope ? '在' + scopes[scope] : ''}始终允许 '\${target}'\`;
    }],
    [/Yes, and always allow( (when not in a project|in this project|in this workspace))?/g, (_m, _p, scope) => {
      const scopes = { 'when not in a project': '在未处于项目时', 'in this project': '在此项目中', 'in this workspace': '在此工作区' };
      return \`是，并\${scope ? '在' + scopes[scope] : ''}始终允许\`;
    }],

    // 动态时间与耗时
    [/Worked for (\\d+)\\s*s\\b/gi, '已工作 $1 秒'],
    [/Worked for (\\d+)\\s*m\\b/gi, '已工作 $1 分钟'],
    [/Worked for (\\d+)\\s*h\\b/gi, '已工作 $1 小时'],
    [/(\\d+)\\s*minutes?\\s*ago\\b/gi, '$1 分钟前'],
    [/(\\d+)\\s*hours?\\s*ago\\b/gi, '$1 小时前'],
    [/(\\d+)\\s*days?\\s*ago\\b/gi, '$1 天前'],
    [/(\\d+)\\s*weeks?\\s*ago\\b/gi, '$1 周前'],
    [/(\\d+)\\s*months?\\s*ago\\b/gi, '$1 个月前'],
    [/(\\d+)\\s*years?\\s*ago\\b/gi, '$1 年前'],
    [/Refreshes in (.+)/gi, (_m, time) => \`\${formatRelativeTime(time)}后刷新\`],
    [/You have used (some|all) of your (weekly|5-hour) limit, it will (?:fully )?refresh in (.+?)\\.?$/gi, (_m, qty, type, time) => {
      const isAll = qty.toLowerCase() === 'all';
      const typeZh = type.toLowerCase() === 'weekly' ? '周' : ' 5 小时';
      const action = isAll ? '已用尽' : '已使用部分';
      return \`您\${action}\${typeZh}额度，将在 \${formatRelativeTime(time)}后完全刷新。\`;
    }],
    [/^(\\d+\\s*(?:years?|months?|weeks?|days?|hours?|minutes?|seconds?)(?:,\\s*\\d+\\s*(?:years?|months?|weeks?|days?|hours?|minutes?|seconds?))*)$/gi, (_m, dur) => formatRelativeTime(dur)],

    // 动态用量与数量词
    [/(\\d+(?:\\.\\d+)?)% of the customization budget is available\\./g, '自定义预算还剩 $1%。'],
    [/(\\d+)\\s*agents running/g, '$1 个代理正在运行'],
    [/See all \\((\\d+)\\)/g, '查看全部 ($1)'],
    [/Show (\\d+)\\s*breakdowns?/gi, '显示 $1 个明细'],
    [/No more older messages, showing (\\d+) of (\\d+)/g, '没有更早的消息了，显示 $1 / $2'],
    [/showing (\\d+) of (\\d+)/gi, '显示 $1 / $2'],
    [/(\\d+) files?, (\\d+) folders?/gi, '$1 个文件, $2 个文件夹'],
    [/(\\d+) files?, (\\d+) searches?/gi, '$1 个文件, $2 次搜索'],
    [/(\\d+)\\s*folders?/gi, '$1 个文件夹'],
    [/(\\d+)\\s*files?/gi, '$1 个文件'],
    [/(\\d+)\\s*searches?/gi, '$1 次搜索'],
    [/(\\d+)\\s*search\\b/gi, '$1 次搜索'],
    [/(\\d+)\\s*tokens?/gi, '$1 个 Token'],
    [/^(\\d+)d$/g, '$1天'],
    [/^(\\d+)m$/g, '$1分钟'],
    [/^(\\d+)s$/g, '$1秒'],

    // 动态下拉与控件参数
    [/Toggle Agent(\\s*\\([^)]+\\))?/g, '切换智能体$1'],
    [/Select (Next|Previous) (Conversation|对话)/g, (_m, dir) => \`选择\${dir === 'Next' ? '下一个' : '上一个'}对话\`],
    [/Select model, current: (.+)/g, '选择模型，当前：$1'],
    [/Your Plan:\\s*(.+)/g, '你的套餐：$1'],
    [/Autocomplete Speed:\\s*(.+)/g, '补全速度: $1'],
    [/Send feedback as (.+)/g, '以 $1 发送反馈'],
    [/Gemini ([^(]+) \\((High|Medium|Low)\\)/g, (_match, model, effort) => {
      const efforts = { High: '高', Medium: '中', Low: '低' };
      return 'Gemini ' + model.trim() + ' (' + (efforts[effort] ?? effort) + ')';
    }],
    [/(Learn more|了解更多) about\\s*(.+)/g, '了解更多关于 $2']
  ];

  // 后置清理收尾
  const patternsPost = [
    [/^Allow (.+)$/g, '允许 $1'],
    [/^(.+)\\s+options$/g, '$1 选项'],
    [/(?:刷新|Refresh)\\s*MCP\\s*servers?/gi, '刷新 MCP 服务器'],
    [/\\btokens\\)/gi, 'Token)'],
    [/(\\d+)\\s*搜索/g, '$1 次搜索'],
    [/(\\d+)\\s*days?\\b/gi, '$1 天'],
    [/(\\d+)\\s*hours?\\b/gi, '$1 小时'],
    [/(\\d+)\\s*minutes?\\b/gi, '$1 分钟'],
    [/(\\d+)\\s*seconds?\\b/gi, '$1 秒'],
    [/(\\d+)\\s*weeks?\\b/gi, '$1 周'],
    [/(\\d+)\\s*months?\\b/gi, '$1 个月'],
    [/(\\d+)\\s*years?\\b/gi, '$1 年']
  ];

  // 正则短语缓存
  const regexCache = new Map();
  function getPhraseRegex(source) {
    let cached = regexCache.get(source);
    if (!cached) {
      const escaped = source.replace(/[|\\\\{}()[\\]^$+*?.]/g, '\\\\$&');
      const startsWord = /^[A-Za-z0-9]/.test(source);
      const endsWord = /[A-Za-z0-9]$/.test(source);
      cached = new RegExp((startsWord ? '(?<![A-Za-z0-9])' : '') + escaped + (endsWord ? '(?![A-Za-z0-9])' : ''), 'g');
      regexCache.set(source, cached);
    }
    return cached;
  }

  // 核心翻译流水线 (三级加速)
  function translate(value) {
    if (!value || !/[A-Za-z]/.test(value)) return value;

    // 阶段 1: O(1) 整串极速精准匹配 (处理 85%+ UI 按钮/菜单/标题/整行提示)
    const trimmed = value.trim();
    if (exactMap.has(trimmed)) {
      const trans = exactMap.get(trimmed);
      if (trimmed === value) return trans;
      // 保留首尾空白字符
      const lead = value.match(/^\\s*/)[0];
      const trail = value.match(/\\s*$/)[0];
      return lead + trans + trail;
    }

    let next = value;

    // 阶段 2: 动态模式与正则规则匹配 (380+ 条上游模式 + 核心业务规则)
    for (const [pattern, target] of compiledPatterns) {
      if (pattern.test(next)) {
        pattern.lastIndex = 0;
        next = next.replace(pattern, target);
      }
    }
    for (const [pattern, target] of specialDynamicPatterns) {
      if (pattern.test(next)) {
        pattern.lastIndex = 0;
        next = next.replace(pattern, target);
      }
    }

    // 阶段 3: 复杂长文本子串替换
    if (next.length >= 8 && /\\s/.test(next)) {
      for (const [source, target] of substringPhrases) {
        if (next.includes(source)) {
          const pattern = getPhraseRegex(source);
          next = next.replace(pattern, target);
        }
      }
    }

    // 阶段 4: 后置微调
    for (const [pattern, target] of patternsPost) {
      if (pattern.test(next)) {
        pattern.lastIndex = 0;
        next = next.replace(pattern, target);
      }
    }

    return next;
  }

  // 高性能子树快速跳过判定
  function isPrunableSubtree(element) {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) return false;
    const tag = element.tagName;
    if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'TEXTAREA' || tag === 'CODE' || tag === 'PRE') {
      return true;
    }
    const cls = element.className;
    if (typeof cls === 'string' && (cls.includes('xterm') || cls.includes('monaco-editor') || cls.includes('md-code-block'))) {
      return true;
    }
    if (element.hasAttribute('contenteditable')) {
      const ce = element.getAttribute('contenteditable');
      if (ce === '' || ce === 'true') return true;
    }
    if (element.getAttribute('data-testid') === 'user-input-step' || element.getAttribute('aria-label') === 'User message') {
      return true;
    }
    return false;
  }

  function shouldSkip(node) {
    const element = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
    if (!element) return false;

    if (isPrunableSubtree(element)) return true;

    // 跳过代码与编辑区祖先
    if (element.closest('script, style, textarea, code, pre, .xterm, .monaco-editor, [contenteditable="true"]')) {
      return true;
    }

    // 跳过会话历史中非操作按钮的文本
    const historyItem = element.closest('.past-conversations, .conversation-list, .history-list, .conversations-list, [data-testid="history-list"], [data-testid="past-conversations"], .conversation-item, .convo-item, .history-item');
    if (historyItem) {
      const isActionBtn = element.closest('button[aria-label], button[title], [class*="delete"], [class*="pin"], [class*="archive"]');
      if (!isActionBtn) return true;
    }

    // 跳过用户输入
    if (element.closest('[data-testid="user-input-step"], [aria-label="User message"], [aria-label="用户消息"]')) {
      return true;
    }

    // 跳过回复正文（保留控件操作按钮）
    const agentResponse = element.closest('[aria-label="Agent response"], [aria-label="智能体回复"]');
    if (agentResponse) {
      const isInteractive = element.closest('button, [role="button"], [class*="action"], [class*="button-container"]');
      if (!isInteractive) return true;
    }

    return false;
  }

  // 扩展后的全局容器白名单（全面覆盖新版 Antigravity UI）
  function isInAntigravityContainer(node) {
    const element = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
    if (!element) return false;

    // 主窗口白名单
    const isMainWindow = window.location.pathname.endsWith('workbench.html') ||
      window.location.href.indexOf('/workbench.html') >= 0 ||
      window.location.href.indexOf('\\\\workbench.html') >= 0;
    if (!isMainWindow) return true;

    const containerSelector = [
      '.settings-modal-backdrop',
      '.settings-modal-container',
      '[class*="settings-modal"]',
      '[class*="modal"]',
      '[class*="antigravity"]',
      '[id*="antigravity"]',
      '[class*="jetski"]',
      '[id*="jetski"]',
      '.client-experience-pill',
      '.diff-hunk-widget',
      '.keep-changes',
      '.discard-changes',
      '.monaco-dialog-box',
      '.dialog-box',
      '[role="dialog"]',
      '.inline-chat-widget',
      '.inline-chat-overflow',
      '.monaco-hover',
      '.monaco-hover-content',
      '.context-view',
      '.monaco-select-box',
      '.monaco-menu',
      '.quick-input-widget',
      '.notification-toast',
      '.notifications-toasts',
      '.settings-editor',
      '.settings-body',
      '[class*="settings"]',
      '[id*="settings"]',
      '#workbench\\\\.parts\\\\.titlebar .titlebar-right',
      '#workbench\\\\.parts\\\\.titlebar .action-label',
      '#workbench\\\\.parts\\\\.titlebar .action-nudge-button',
      '.antigravity-welcome-container',
      '[class*="welcome"]',
      '[class*="agent"]',
      '[id*="agent"]',
      // 新版组件增强选择器
      '[class*="inline-action"]',
      '[class*="action-card"]',
      '[class*="floating-card"]',
      '[class*="chat-input"]',
      '[class*="input-tools"]',
      '[class*="composer"]',
      '[class*="quota"]',
      '[class*="sidebar"]',
      '[class*="drawer"]',
      '[id*="workbench.parts.auxiliarybar"]',
      '[id*="workbench.parts.sidebar"]'
    ].join(', ');

    return !!element.closest(containerSelector);
  }

  function translateElement(element) {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) return;
    for (const attr of ['aria-label', 'title', 'placeholder', 'alt']) {
      const value = element.getAttribute(attr);
      if (!value || !/[a-zA-Z]/.test(value)) continue;
      const originalKey = \`__orig_\${attr}\`;
      if (element[originalKey] === undefined) {
        element[originalKey] = value;
      }
      const translated = translate(element[originalKey]);
      if (translated !== value) element.setAttribute(attr, translated);
    }
  }

  function translateSingleTextNode(node) {
    if (!node || node.nodeType !== Node.TEXT_NODE || node.__zh_patched) return;
    const val = node.nodeValue || '';
    if (val.length === 0 || !/[a-zA-Z]/.test(val)) {
      node.__zh_patched = true;
      return;
    }
    if (shouldSkip(node)) return;
    if (!isInAntigravityContainer(node)) return;

    if (node.__original_en === undefined) {
      node.__original_en = val;
    }
    const translated = translate(node.__original_en);
    if (translated !== val) {
      node.nodeValue = translated;
    }
    node.__zh_patched = true;
  }

  function translateNode(root) {
    if (!root || !root.isConnected) return;
    if (root.nodeType === Node.TEXT_NODE) {
      translateSingleTextNode(root);
      return;
    }
    if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE) return;

    if (root.nodeType === Node.ELEMENT_NODE) {
      if (isPrunableSubtree(root)) return;
      if (!root.__zh_patched) {
        if (isInAntigravityContainer(root)) {
          translateElement(root);
          root.__zh_patched = true;
        }
      }
    }

    const walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
      {
        acceptNode(node) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            if (isPrunableSubtree(node)) {
              return NodeFilter.FILTER_REJECT;
            }
            return NodeFilter.FILTER_ACCEPT;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (node.nodeType === Node.TEXT_NODE) {
        translateSingleTextNode(node);
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        if (node.__zh_patched) continue;
        if (shouldSkip(node)) continue;
        if (!isInAntigravityContainer(node)) continue;
        translateElement(node);
        node.__zh_patched = true;
      }
    }
  }

  function revertToEnglish(root = document) {
    document.documentElement.lang = 'en';
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (node.nodeType === Node.TEXT_NODE) {
        if (node.__original_en !== undefined) {
          node.nodeValue = node.__original_en;
        }
        node.__zh_patched = false;
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        for (const attr of ['aria-label', 'title', 'placeholder', 'alt']) {
          const orig = node[\`__orig_\${attr}\`];
          if (orig !== undefined) {
            node.setAttribute(attr, orig);
          }
        }
        node.__zh_patched = false;
      }
    }
  }

  let i18nObserver = null;
  let i18nTimer = null;
  const pendingNodes = new Set();
  let urgentTranslationUntil = 0;

  function triggerUrgentTranslationMode(durationMs = 1500) {
    urgentTranslationUntil = Date.now() + durationMs;
  }
  window.__agyTriggerUrgentTranslation = triggerUrgentTranslationMode;

  function isUrgentNode(node) {
    if (!node) return false;
    if (Date.now() < urgentTranslationUntil) return true;
    const el = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
    if (!el) return false;
    return !!el.closest?.(
      '.settings-modal-backdrop, .settings-modal-container, [role="dialog"], .monaco-dialog-box, .dialog-box, .monaco-menu, .context-view, .quick-input-widget, [class*="modal"], [class*="settings"], .monaco-hover'
    );
  }

  function flushPendingTranslations() {
    i18nTimer = null;
    if (window.__agyCurrentLang === 'en' || pendingNodes.size === 0) {
      pendingNodes.clear();
      return;
    }
    const nodes = Array.from(pendingNodes);
    pendingNodes.clear();

    for (const node of nodes) {
      if (node.isConnected) {
        translateNode(node);
      }
    }
  }

  function scheduleIncrementalTranslation(node) {
    if (!node) return;
    if (isUrgentNode(node)) {
      translateNode(node);
      return;
    }

    pendingNodes.add(node);
    if (!i18nTimer) {
      if (typeof queueMicrotask === 'function') {
        i18nTimer = 1;
        queueMicrotask(() => {
          flushPendingTranslations();
        });
      } else {
        i18nTimer = setTimeout(flushPendingTranslations, 16);
      }
    }
  }

  function startObserver() {
    if (i18nObserver) {
      try { i18nObserver.disconnect(); } catch (e) {}
    }
    if (window.__agyI18nObserver && window.__agyI18nObserver !== i18nObserver) {
      try { window.__agyI18nObserver.disconnect(); } catch (e) {}
    }
    i18nObserver = new MutationObserver((mutations) => {
      if (window.__agyCurrentLang === 'en') return;
      for (let i = 0; i < mutations.length; i++) {
        const m = mutations[i];
        if (m.type === 'childList') {
          for (let j = 0; j < m.addedNodes.length; j++) {
            scheduleIncrementalTranslation(m.addedNodes[j]);
          }
        } else if (m.type === 'characterData') {
          scheduleIncrementalTranslation(m.target);
        } else if (m.type === 'attributes') {
          scheduleIncrementalTranslation(m.target);
        }
      }
    });

    const targetRoot = document.body || document.documentElement || document;
    i18nObserver.observe(targetRoot, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['aria-label', 'title', 'placeholder', 'alt', 'data-testid']
    });
    window.__agyI18nObserver = i18nObserver;
  }

  function applyLanguage(lang) {
    window.__agyCurrentLang = lang;
    if (lang === 'en') {
      if (i18nObserver) {
        try { i18nObserver.disconnect(); } catch (e) {}
        i18nObserver = null;
      }
      if (typeof document !== 'undefined') {
        revertToEnglish(document);
      }
    } else {
      if (document && document.documentElement) {
        document.documentElement.lang = 'zh-CN';
      }
      if (typeof document !== 'undefined') {
        translateNode(document);
      }
      startObserver();
    }
  }

  window.__agyI18n = {
    getLanguage: () => window.__agyCurrentLang || 'zh-CN',
    setLanguage: (lang) => applyLanguage(lang),
    triggerUrgent: triggerUrgentTranslationMode
  };

  const initialLang = (window.__AG_SKIN_CONFIG__ && window.__AG_SKIN_CONFIG__.features?.language) || 'zh-CN';
  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', () => applyLanguage(initialLang), { once: true });
  } else {
    applyLanguage(initialLang);
  }
})();
`;

const outputPath = path.join(PROJECT_ROOT, 'client', 'modules', 'i18n-engine.js');
fs.writeFileSync(outputPath, engineTemplate, 'utf8');

const stat = fs.statSync(outputPath);
console.log(`[完成] client/modules/i18n-engine.js 构建成功！文件大小: ${(stat.size / 1024).toFixed(1)} KB`);
