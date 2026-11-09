import fs from 'fs';

const css = fs.readFileSync('client/styles/glass-theme.css', 'utf8');

const blocks = css.match(/[^{}]+{[^{}]+backdrop-filter:[^;]*blur[^;]*;[^{}]*}/gi) || [];
console.log('Total rules with blur:', blocks.length);
blocks.forEach((b, i) => {
  const sel = b.split('{')[0].trim().replace(/\s+/g, ' ');
  const m = b.match(/backdrop-filter:[^;]+;/i);
  console.log(`${i+1}. [${sel}] => ${m ? m[0] : ''}`);
});
