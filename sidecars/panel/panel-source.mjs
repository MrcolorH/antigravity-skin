// Custom-scheme sidecars load a classic, self-contained script. Keep the
// editable modules as the single source, with explicit dependency boundaries.
import {readFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const HERE=dirname(fileURLToPath(import.meta.url));
export function panelAppSource(){
 const read=name=>readFileSync(join(HERE,name),'utf8');
 const factory=name=>{
  const source=read('./compat/'+name+'.cjs'),prefix='module.exports = ',index=source.indexOf(prefix);
  if(index<0)throw Error('Panel factory format changed: '+name);
  return source.slice(index+prefix.length).trim().replace(/;$/,'');
 };
 let app=read('app.js');
 for(const line of ["import { percent, rate, count, elapsed, countdown, resetDate } from './format.mjs';","import { createI18n } from './i18n.js';","import { createTheme } from './theme.js';"]){
  if(!app.includes(line))throw Error('Panel dependency list changed');app=app.replace(line,'');
 }
 const format=read('format.mjs').replace(/^export function /gm,'function ');
 if(/^\s*(?:import|export)\b/m.test(app+format))throw Error('Unsupported panel module dependency');
 return `(()=>{'use strict';\n${format}\nconst createI18n=(${factory('i18n')});\nconst createTheme=(${factory('theme')});\n${app}\n})();`;
}

export function panelPageSource(){
 const assets=/(href|src)="\/(theme\.css|styles\.css|app\.js)(?:\?[^\"]*)?"/g;
 const html=readFileSync(join(HERE,'index.html'),'utf8').replace(/<meta name="ag-pulse-panel-assets"[^>]*>/g,'').replace(assets,'$1="/$2"');
 const version=createHash('sha256').update(html).update(panelAppSource()).update(readFileSync(join(HERE,'styles.css'))).update(readFileSync(join(HERE,'./compat/theme.cjs'))).digest('hex').slice(0,16);
 return html.replace(assets,(_,attribute,path)=>`${attribute}="/${path}?v=${version}"`).replace('</head>',`<meta name="ag-pulse-panel-assets" content="${version}"></head>`);
}
