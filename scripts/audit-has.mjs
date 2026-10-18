import fs from 'fs';

const css = fs.readFileSync('client/styles/glass-theme.css', 'utf8');

const hasMatches = css.match(/[^\r\n{}]+:has\([^)]+\)[^\r\n{]*/g) || [];
const uniqueHas = [...new Set(hasMatches.map(s => s.trim()))];
console.log('Total unique :has:', uniqueHas.length);

// 统计最常见的 :has 模式
const groups = {};
uniqueHas.forEach(sel => {
  const m = sel.match(/:has\([^)]+\)/);
  if (m) {
    const pattern = m[0];
    groups[pattern] = (groups[pattern] || 0) + 1;
  }
});

const sorted = Object.entries(groups).sort((a, b) => b[1] - a[1]);
sorted.forEach(([pat, count]) => {
  console.log(`${count.toString().padStart(3)}: ${pat}`);
});
