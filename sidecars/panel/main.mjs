import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { homedir } from 'node:os';
import { createRequire } from 'node:module';
import { MetricsStore } from './store.mjs';
import { DesktopUsage } from './usage.mjs';
import { loadSidecarSdk } from './sdk.mjs';
import { RuntimeUi, makeRendererSource } from './compat/runtime-ui.mjs';
import { platformPaths, migrateLegacyPulseData } from './compat/platform.mjs';
import { PreferencesStore } from './compat/preferences.mjs';
import { SidecarOwner } from './compat/sidecar-owner.mjs';
import { readHostTheme } from './compat/host-theme.mjs';
import { panelAppSource,panelPageSource } from './panel-source.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const createTheme=createRequire(import.meta.url)('./compat/theme.cjs');
const themeCss=()=>createTheme().css(':root');
migrateLegacyPulseData();
const store = new MetricsStore();
const usage=new DesktopUsage(store);
store.onTrajectory=(scope,id,raw)=>usage.ingest(scope,id,raw);
const preferences=new PreferencesStore();
const ownership=process.env.ANTIGRAVITY_SIDECAR_WEB_PORT?new SidecarOwner(platformPaths().data):null;
const readSkinConfig = () => {
  try { return JSON.parse(readFileSync(platformPaths().skinConfig, 'utf8').replace(/^\uFEFF/, '')); } catch { return {}; }
};
const readPatchSentinel = () => {
  try { return JSON.parse(readFileSync(platformPaths().patchSentinel, 'utf8').replace(/^\uFEFF/, '')); } catch { return null; }
};
const hostLanguage = () => readSkinConfig()?.features?.chineseLocalization === false ? 'en' : 'zh-CN';
const callSkinEngine = async (path, method = 'GET', bodyData = undefined) => {
  const port = Number(process.env.AG_SKIN_PORT || 59288);
  const init = { method };
  if (bodyData !== undefined) {
    init.headers = { 'Content-Type': 'application/json' };
    init.body = typeof bodyData === 'string' ? bodyData : JSON.stringify(bodyData);
  }
  const res = await fetch(`http://127.0.0.1:${port}${path}`, init);
  if (!res.ok) {
    let detail = '';
    try { detail = await res.text(); } catch {}
    throw new Error(`Skin engine ${path} returned ${res.status}${detail ? `: ${detail}` : ''}`);
  }
  return res.json();
};
const writeSkinConfigFallback = (cfg) => {
  const file = platformPaths().skinConfig;
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(cfg, null, 2), 'utf8');
  return { ok: true, fallback: true };
};
const getSkinPanelState = async () => {
  let config = readSkinConfig();
  let patchStatus = readPatchSentinel() || { state: 'unknown', patched: false };
  let engineOnline = false;
  try {
    const [remoteCfg, remotePatch] = await Promise.all([
      callSkinEngine('/api/config', 'GET').catch(() => null),
      callSkinEngine('/api/boot-patch/status', 'GET').catch(() => null)
    ]);
    if (remoteCfg && typeof remoteCfg === 'object') { config = remoteCfg; engineOnline = true; }
    if (remotePatch && typeof remotePatch === 'object') { patchStatus = remotePatch; engineOnline = true; }
  } catch {}
  return {
    platform: process.platform,
    engineOnline,
    hostLanguage: config?.features?.chineseLocalization === false ? 'en' : 'zh-CN',
    config,
    patchStatus: { ...patchStatus, platform: process.platform }
  };
};
const getSkinAssets = async () => {
  const [wallpapers, bootVideos, bootScripts, library] = await Promise.all([
    callSkinEngine('/api/wallpaper/list', 'GET').catch(() => ({ files: [] })),
    callSkinEngine('/api/boot-video/list', 'GET').catch(() => ({ files: [] })),
    callSkinEngine('/api/boot-script/list', 'GET').catch(() => ({ files: [] })),
    callSkinEngine('/api/wallpaper-library/scan', 'GET').catch(() => ({ items: [] }))
  ]);
  return {
    wallpapers: wallpapers?.files || wallpapers?.items || [],
    bootVideos: bootVideos?.files || bootVideos?.items || [],
    bootScripts: bootScripts?.files || bootScripts?.items || [],
    libraryItems: library?.items || []
  };
};
const metrics = async input => {
  const base=await store.snapshot(input);if(input?.force)void usage.sync(true);
  return {...base,usage:await usage.snapshot(),preferences:await preferences.snapshot(),hostLanguage:hostLanguage(),patchStatus:readPatchSentinel(),theme:await readHostTheme(),integration:integration.health};
};
const usageSource=()=>{const s=readFileSync(join(HERE,'compat','usage-ui.cjs'),'utf8');return `window.__agPulseUsageFactory=(${s.slice(s.indexOf('module.exports = ')+17).trim().replace(/;$/,'')});`;};
const staticFiles = { '/': ['index.html', 'text/html'], '/styles.css': ['styles.css', 'text/css'], '/format.mjs': ['format.mjs', 'text/javascript'] };
const inlineSource=()=>{
  const file=readFileSync(join(HERE,'compat','inline-widget.cjs'),'utf8');
  const i18n=readFileSync(join(HERE,'compat','i18n.cjs'),'utf8');
  const theme=readFileSync(join(HERE,'compat','theme.cjs'),'utf8');
  const extract=s=>s.slice(s.indexOf('module.exports = ')+'module.exports = '.length).trim().replace(/;$/,'');
  return usageSource()+`window.__agPulseI18nFactory=(${extract(i18n)});window.__agPulseThemeFactory=(${extract(theme)});(${extract(file)})();`;
};
const i18nModule=()=>{const s=readFileSync(join(HERE,'compat','i18n.cjs'),'utf8');return 'export const createI18n='+s.slice(s.indexOf('module.exports = ')+'module.exports = '.length);};
const themeModule=()=>{const s=readFileSync(join(HERE,'compat','theme.cjs'),'utf8');return 'export const createTheme='+s.slice(s.indexOf('module.exports = ')+'module.exports = '.length);};
const runtimeSettings = () => {
  const skinCfg = readSkinConfig();
  const dash = skinCfg?.features?.dashboard || {};
  let enabled = skinCfg?.enabled !== false && dash.enabled !== false && dash.inlineEnabled !== false;
  try {
    const globalCfg = JSON.parse(readFileSync(platformPaths().pluginConfig, 'utf8').replace(/^\uFEFF/, ''));
    if (globalCfg.plugins?.['antigravity-skin']?.enabled === false) enabled = false;
  } catch {}
  return { enabled };
};
const integration = new RuntimeUi({
  snapshot: input => metrics(input),
  preferences,
  owner:ownership?.token,owns:()=>ownership?ownership.isOwner():true,
  source: makeRendererSource(readFileSync(join(HERE,'compat','i18n.cjs'),'utf8'),readFileSync(join(HERE,'compat','inline-widget.cjs'),'utf8'),readFileSync(join(HERE,'compat','theme.cjs'),'utf8'),ownership?.token,ownership?.startedAt,usageSource()),
  dataDir: platformPaths().data,
  interval: 1000,
  enabled: () => runtimeSettings().enabled,
});

if (process.env.ANTIGRAVITY_SIDECAR_WEB_PORT) {
  const { SidecarApp, Response } = await loadSidecarSdk();
  if(!await ownership.claim())process.exit(0);
  const app = new SidecarApp();
  for (const [path, [file, type]] of Object.entries(staticFiles)) app.api(path, () => new Response(path==='/'?panelPageSource():readFileSync(join(HERE, file), 'utf8'), { contentType: type,headers:{'Cache-Control':'no-store'} }), 'GET');
  app.page('/app.js',()=>new Response(panelAppSource(),{contentType:'application/javascript',headers:{'Cache-Control':'no-store'}}));
  app.page('/i18n.js',i18nModule);
  app.page('/theme.js',themeModule);
  app.api('/theme.css',()=>new Response(themeCss(),{contentType:'text/css'}),'GET');
  app.api('/api/metrics', data => metrics({ conversationId: data.conversationId || null, force: data.force === true || data.force === '1' }), 'GET');
  app.api('/api/integration', () => integration.health, 'GET');
  app.api('/api/patch-status', async () => {
    try { return { ...(await callSkinEngine('/api/boot-patch/status', 'GET')), platform: process.platform }; }
    catch { return { ...(readPatchSentinel() || { state: 'unknown', patched: false }), platform: process.platform }; }
  }, 'GET');
  app.api('/api/patch-repair', async () => {
    try { return await callSkinEngine('/api/patch-boot', 'POST'); }
    catch (err) { return new Response(JSON.stringify({ ok: false, error: err?.message || 'Repair unavailable' }), { status: 502, contentType: 'application/json' }); }
  }, 'POST');
  app.api('/api/skin-state', () => getSkinPanelState(), 'GET');
  app.api('/api/skin-config', async () => {
    try { return await callSkinEngine('/api/config', 'GET'); }
    catch { return readSkinConfig(); }
  }, 'GET');
  app.api('/api/skin-config', async data => {
    try { return await callSkinEngine('/api/config', 'POST', data); }
    catch { return writeSkinConfigFallback(data); }
  }, 'POST');
  app.api('/api/skin-assets', () => getSkinAssets(), 'GET');
  app.api('/api/skin-pick-library', async () => {
    try { return await callSkinEngine('/api/wallpaper-library/pick-directory', 'POST'); }
    catch (err) { return new Response(JSON.stringify({ ok: false, error: err?.message || 'Pick directory unavailable' }), { status: 502, contentType: 'application/json' }); }
  }, 'POST');
  app.api('/api/preferences',()=>preferences.snapshot(),'GET');
  app.api('/api/preferences',async data=>{try{return await preferences.set(data);}catch{return new Response(JSON.stringify({error:'Language preference could not be saved'}),{status:400,contentType:'application/json'});}},'POST');
  app.run();
  integration.start();
  const shutdown=async()=>{
    const exitTimer=setTimeout(()=>process.exit(0),2000);exitTimer.unref();
    await integration.stop();ownership.stop();process.exit(0);
  };
  ownership.watch(shutdown);
  for (const signal of ['SIGTERM','SIGINT']) process.once(signal, () => {
    void shutdown();
  });
} else {
  // A dependency-free local preview uses the same collector and frontend.
  const port = Number(process.env.AG_PULSE_PORT || 17891);
  const server = createServer(async (req, res) => {
    const host = req.headers.host || '';
    if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host)) { res.writeHead(403); res.end(); return; }
    const url = new URL(req.url, `http://${host}`);
    if (url.pathname === '/api/preferences') {
      const sameOrigin=req.headers.origin===`http://${host}`;
      if(req.headers.origin&&!sameOrigin){res.writeHead(403);res.end();return;}
      res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json; charset=utf-8');
      if(req.method==='GET'){res.end(JSON.stringify(await preferences.snapshot()));return;}
      if(req.method==='POST'&&sameOrigin&&String(req.headers['content-type']).startsWith('application/json')){
        let body='';
        try {for await(const chunk of req){body+=chunk;if(body.length>1024)throw new Error('Preference payload too large');}
          res.end(JSON.stringify(await preferences.set(JSON.parse(body))));
        }catch{res.writeHead(400);res.end(JSON.stringify({error:'Language preference could not be saved'}));}
        return;
      }
      res.writeHead(405);res.end();return;
    }
    if (url.pathname === '/api/patch-status' && req.method === 'GET') {
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      try { res.end(JSON.stringify({ ...(await callSkinEngine('/api/boot-patch/status', 'GET')), platform: process.platform })); }
      catch { res.end(JSON.stringify({ ...(readPatchSentinel() || { state: 'unknown', patched: false }), platform: process.platform })); }
      return;
    }
    if (url.pathname === '/api/patch-repair' && req.method === 'POST') {
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      try { res.end(JSON.stringify(await callSkinEngine('/api/patch-boot', 'POST'))); }
      catch (err) { res.writeHead(502); res.end(JSON.stringify({ ok: false, error: err?.message || 'Repair unavailable' })); }
      return;
    }
    if (url.pathname === '/api/skin-state' && req.method === 'GET') {
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify(await getSkinPanelState()));
      return;
    }
    if (url.pathname === '/api/skin-assets' && req.method === 'GET') {
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify(await getSkinAssets()));
      return;
    }
    if (url.pathname === '/api/skin-pick-library' && req.method === 'POST') {
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      try { res.end(JSON.stringify(await callSkinEngine('/api/wallpaper-library/pick-directory', 'POST'))); }
      catch (err) { res.writeHead(502); res.end(JSON.stringify({ ok: false, error: err?.message || 'Pick directory unavailable' })); }
      return;
    }
    if (url.pathname === '/api/skin-config') {
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      if (req.method === 'GET') {
        try { res.end(JSON.stringify(await callSkinEngine('/api/config', 'GET'))); }
        catch { res.end(JSON.stringify(readSkinConfig())); }
        return;
      }
      if (req.method === 'POST') {
        let body = '';
        try {
          for await (const chunk of req) body += chunk;
          const parsed = JSON.parse(body);
          try { res.end(JSON.stringify(await callSkinEngine('/api/config', 'POST', parsed))); }
          catch { res.end(JSON.stringify(writeSkinConfigFallback(parsed))); }
        } catch (err) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: err?.message || 'Invalid config payload' }));
        }
        return;
      }
      res.writeHead(405); res.end(); return;
    }
    if (req.method !== 'GET') { res.writeHead(405); res.end(); return; }
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (url.pathname === '/api/metrics') {
      if (req.headers.origin && req.headers.origin !== `http://${host}`) { res.writeHead(403); res.end(); return; }
      try { res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(await metrics({ conversationId: url.searchParams.get('conversationId'), force: url.searchParams.get('force') === '1' }))); }
      catch { res.writeHead(500); res.end('{"error":"数据暂时不可用"}'); }
      return;
    }
    if (url.pathname === '/api/integration') { res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(integration.health)); return; }
    if (url.pathname === '/preload.js') { res.writeHead(200, { 'Content-Type': 'text/javascript' }); res.end('// Standalone preview: no host bridge.'); return; }
    if(url.pathname==='/i18n.js'){res.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8'});res.end(i18nModule());return;}
    if(url.pathname==='/theme.js'){res.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8'});res.end(themeModule());return;}
    if(url.pathname==='/theme.css'){res.writeHead(200,{'Content-Type':'text/css; charset=utf-8'});res.end(themeCss());return;}
    if(url.pathname==='/inline-widget.js'){res.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8'});res.end(inlineSource());return;}
    if(url.pathname==='/app.js'){res.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8'});res.end(panelAppSource());return;}
    if(url.pathname.startsWith('/toolbar-preview')){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(readFileSync(join(HERE,'toolbar-preview.html')));return;}
    const file = staticFiles[url.pathname];
    if (!file) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': `${file[1]}; charset=utf-8` }); res.end(url.pathname==='/'?panelPageSource():readFileSync(join(HERE, file[0])));
  });
  server.listen(port, '127.0.0.1', () => console.log(`Antigrative Dashboard: http://127.0.0.1:${port}`));
}
