import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

async function fetchJson(url) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Antigravity-Skin-Updater' } });
    if (!res.ok) {
      console.warn(`[WARN] HTTP ${res.status} when fetching ${url}`);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.error(`[ERR] Failed to fetch ${url}:`, err.message);
    return null;
  }
}

async function main() {
  console.log('==================================================');
  console.log('  正在从上游开源仓库同步并整合全生态中文词库...');
  console.log('==================================================');

  const exactEntries = new Map();
  const patternList = [];

  // 1. 读取当前本地 i18n-engine.js 中的已有词条，作为基础
  const currentEnginePath = path.join(PROJECT_ROOT, 'client', 'modules', 'i18n-engine.js');
  if (fs.existsSync(currentEnginePath)) {
    const currentCode = fs.readFileSync(currentEnginePath, 'utf8');
    const phraseMatch = currentCode.match(/const phrases = new Map\(\[\s*([\s\S]*?)\]\);/);
    if (phraseMatch) {
      // 提取当前的 key, value
      const reg = /\[\s*(['"`])([\s\S]*?)\1\s*,\s*(['"`])([\s\S]*?)\3\s*\]/g;
      let m;
      let localCount = 0;
      while ((m = reg.exec(phraseMatch[1])) !== null) {
        const k = m[2].replace(/\\'/g, "'").replace(/\\"/g, '"');
        const v = m[4].replace(/\\'/g, "'").replace(/\\"/g, '"');
        if (k && v && k !== v) {
          exactEntries.set(k, v);
          localCount++;
        }
      }
      console.log(`[本地基准] 提取出当前引擎中已有的 ${localCount} 条词条。`);
    }
  }

  // 2. 从 qqxpee/antigravity2-cn 拉取所有词典模块
  console.log('\n[上游源 1] 正在同步 qqxpee/antigravity2-cn 模块化词典...');
  const qqxFiles = [
    'common.json', 'menu_nav.json', 'page_agents.json', 'page_mcp_knowledge.json',
    'page_settings.json', 'page_v218_extra.json', 'page_v222_patch.json',
    'page_v226_patch.json', 'page_v227_patch.json', 'page_v228_patch.json',
    'page_v229_patch.json', 'page_workspaces.json'
  ];
  let qqxAdded = 0;
  for (const f of qqxFiles) {
    const data = await fetchJson(`https://raw.githubusercontent.com/qqxpee/antigravity2-cn/main/dicts/${f}`);
    if (data && typeof data === 'object') {
      let fCount = 0;
      for (const [k, v] of Object.entries(data)) {
        if (!k || !v || typeof v !== 'string' || k === v) continue;
        // 如果本地没有，或者本地词条过短，填入
        if (!exactEntries.has(k)) {
          exactEntries.set(k, v);
          fCount++;
          qqxAdded++;
        }
      }
      console.log(`  - ${f}: 获取 ${Object.keys(data).length} 条 (新增 ${fCount} 条)`);
    }
  }
  console.log(`[上游源 1 完成] 累计新增 ${qqxAdded} 条。`);

  // 3. 从 Silas-02/antigravity-desktop-cn 拉取词典 (如 marketplace_plugins.json, release.json 等)
  console.log('\n[上游源 2] 正在同步 Silas-02/antigravity-desktop-cn 扩展词典...');
  const silasFiles = [
    'common.json', 'marketplace_plugins.json', 'menu_nav.json',
    'page_agents.json', 'page_mcp_knowledge.json', 'page_settings.json',
    'page_workspaces.json', 'release.json'
  ];
  let silasAdded = 0;
  for (const f of silasFiles) {
    const data = await fetchJson(`https://raw.githubusercontent.com/Silas-02/antigravity-desktop-cn/main/dicts/${f}`);
    if (data && typeof data === 'object') {
      let fCount = 0;
      for (const [k, v] of Object.entries(data)) {
        if (!k || !v || typeof v !== 'string' || k === v) continue;
        if (!exactEntries.has(k)) {
          exactEntries.set(k, v);
          fCount++;
          silasAdded++;
        }
      }
      console.log(`  - ${f}: 获取 ${Object.keys(data).length} 条 (新增 ${fCount} 条)`);
    }
  }
  console.log(`[上游源 2 完成] 累计新增 ${silasAdded} 条。`);

  // 4. 从 yiheng8023/antigravity-chinese 拉取 zh-CN.json (exact + patterns)
  console.log('\n[上游源 3] 正在同步 yiheng8023/antigravity-chinese 全量字典与正则...');
  const yhData = await fetchJson('https://raw.githubusercontent.com/yiheng8023/antigravity-chinese/main/dict/zh-CN.json');
  let yhAdded = 0;
  if (yhData) {
    if (yhData.exact) {
      for (const [k, v] of Object.entries(yhData.exact)) {
        if (!k || !v || typeof v !== 'string' || k === v) continue;
        if (!exactEntries.has(k)) {
          exactEntries.set(k, v);
          yhAdded++;
        }
      }
      console.log(`  - exact 词典: 获取 ${Object.keys(yhData.exact).length} 条 (新增 ${yhAdded} 条)`);
    }
    if (yhData.patterns && typeof yhData.patterns === 'object') {
      const pEntries = Array.isArray(yhData.patterns) ? yhData.patterns : Object.values(yhData.patterns);
      for (const item of pEntries) {
        if (item && item.regex && item.replacement) {
          patternList.push(item);
        }
      }
      console.log(`  - patterns 正则规则: 获取 ${patternList.length} 条`);
    }
  }

  // 5. 数据过滤与清洗
  console.log('\n[数据清洗] 正在剔除高危、污染或无意义单字条目...');
  const forbiddenKeys = new Set([
    'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm',
    'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
    'id', 'px', 'em', 'rem', 'css', 'js', 'ts', 'git', 'npm', 'yarn',
    'pnpm', 'node', 'diff', 'patch', 'api', 'url', 'uri', 'dom', 'ui'
  ]);

  let cleanedCount = 0;
  for (const [k, v] of exactEntries.entries()) {
    const trimmed = k.trim();
    // 纯英文小写单字或技术缩写跳过
    if (forbiddenKeys.has(trimmed.toLowerCase())) {
      exactEntries.delete(k);
      cleanedCount++;
      continue;
    }
    // 纯数字或标点符号跳过
    if (!/[A-Za-z]/.test(k)) {
      exactEntries.delete(k);
      cleanedCount++;
      continue;
    }
    // 译文中不包含任何中文字符的跳过
    if (!/[\u4e00-\u9fa5]/.test(v)) {
      exactEntries.delete(k);
      cleanedCount++;
      continue;
    }
  }
  console.log(`  - 清洗掉 ${cleanedCount} 条可能引起副作用的条目。`);

  // 6. 保存整合好的全量字典到 client/i18n/dicts.json
  const i18nDir = path.join(PROJECT_ROOT, 'client', 'i18n');
  if (!fs.existsSync(i18nDir)) {
    fs.mkdirSync(i18nDir, { recursive: true });
  }

  const allExactObj = {};
  // 按长度倒序，便于直接序列化
  const sortedPairs = Array.from(exactEntries.entries()).sort((a, b) => b[0].length - a[0].length);
  for (const [k, v] of sortedPairs) {
    allExactObj[k] = v;
  }

  const outputPayload = {
    updatedAt: new Date().toISOString(),
    totalExact: sortedPairs.length,
    totalPatterns: patternList.length,
    exact: allExactObj,
    patterns: patternList
  };

  const jsonPath = path.join(i18nDir, 'zh-CN.all.json');
  fs.writeFileSync(jsonPath, JSON.stringify(outputPayload, null, 2), 'utf8');

  console.log('\n==================================================');
  console.log(` [√] 词库同步与全量合并成功！`);
  console.log(` 最终词库精准条目数: ${sortedPairs.length} 条 (相比升级前提升 ${(sortedPairs.length / 732).toFixed(1)} 倍)`);
  console.log(` 最终动态模式条目数: ${patternList.length} 条`);
  console.log(` 输出保存位置: ${jsonPath}`);
  console.log('==================================================');
}

main().catch(err => {
  console.error('[FATAL] 同步失败:', err);
  process.exit(1);
});
