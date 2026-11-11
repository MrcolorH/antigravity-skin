import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

// 构造简易 JSDOM 环境验证翻译逻辑
const code = fs.readFileSync(path.join(PROJECT_ROOT, 'client', 'modules', 'i18n-engine.js'), 'utf8');

// 提取核心 translate 函数进行独立测验
// 创建一个模拟沙箱执行
const sandbox = {
  window: {},
  document: { readyState: 'complete', documentElement: { lang: '' }, createTreeWalker: () => ({ nextNode: () => null }) },
  Node: { ELEMENT_NODE: 1, TEXT_NODE: 3, DOCUMENT_NODE: 9 },
  NodeFilter: { SHOW_TEXT: 4, SHOW_ELEMENT: 1, FILTER_ACCEPT: 1, FILTER_REJECT: 2 },
  MutationObserver: class {
    observe() {}
    disconnect() {}
  }
};

const fn = new Function('window', 'document', 'Node', 'NodeFilter', 'MutationObserver', code);
fn(sandbox.window, sandbox.document, sandbox.Node, sandbox.NodeFilter, sandbox.MutationObserver);

console.log('window.__agyI18n exists:', !!sandbox.window.__agyI18n);

// 测试关键词条在 exactMap 和 patterns 中的表现
const jsonPath = path.join(PROJECT_ROOT, 'client', 'i18n', 'zh-CN.all.json');
const { exact, patterns } = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

console.log('--------------------------------------------------');
console.log('测试典型词条翻译情况：');

const testCases = [
  'Projects',
  'No items found',
  'Keep the app accessible from the menu bar and running in the background when all windows are closed.',
  'Choose a predefined security preset for the agent. This controls terminal auto-execution policy, and file access policy.',
  'Within each group, models share a weekly limit and a 5-hour limit. Quota is consumed proportionally to the cost of the tokens. Thus, limits will last longer with shorter tasks or using more cost-effective models. The 5-hour limit smooths out aggregate demand to fairly distribute global capacity across all users, while your weekly limit is tied directly to your individual tier.',
  'Gemini Live',
  'Reload Window',
  'Settings'
];

for (const tc of testCases) {
  if (exact[tc]) {
    console.log(`[PASS] "${tc.slice(0, 30)}..." -> "${exact[tc].slice(0, 30)}..."`);
  } else {
    console.log(`[WARN] Not in exact: "${tc}"`);
  }
}

console.log('--------------------------------------------------');
console.log('词库规模与状态：');
console.log(`- 精确词条总数: ${Object.keys(exact).length}`);
console.log(`- 正则模式总数: ${patterns.length}`);
console.log('--------------------------------------------------');
