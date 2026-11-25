import test from 'node:test';
import assert from 'node:assert/strict';
import {Script,runInNewContext} from 'node:vm';
import {panelAppSource,panelPageSource} from '../panel-source.mjs';

test('sidecar bundle parses as classic JavaScript and waits for its DOM',()=>{
 const source=panelAppSource();assert.doesNotThrow(()=>new Script(source));
 const handlers=[];const window={};
 runInNewContext(source,{window,document:{readyState:'loading',addEventListener:(...args)=>handlers.push(args)}});
 assert.equal(window.__agPulsePanelInstalled,undefined);assert.equal(handlers.length,1);
 assert.equal(handlers[0][0],'DOMContentLoaded');assert.equal(handlers[0][2].once,true);
});

test('an incomplete sidecar document does not register listeners against missing widgets',()=>{
 const window={};assert.doesNotThrow(()=>runInNewContext(panelAppSource(),{window,document:{readyState:'complete',querySelector:()=>null}}));
 assert.equal(window.__agPulsePanelInstalled,undefined);
});

test('panel HTML versions script and styles together using their source content',()=>{
 const html=panelPageSource();const versions=[...html.matchAll(/(?:theme\.css|styles\.css|app\.js)\?v=([a-f0-9]{16})/g)].map(m=>m[1]);
 assert.equal(versions.length,3);assert.equal(new Set(versions).size,1);assert.ok(html.includes(`content="${versions[0]}"`));
 assert.match(html,/<script defer src="\/app\.js\?v=/);assert.doesNotMatch(html,/type="module"/);
});
