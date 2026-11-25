import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { SessionHistory, safeMetrics } from '../history.mjs';
import { MetricsStore } from '../store.mjs';
import { trajectoryMetrics } from '../metrics.mjs';
import { serverFromDiscovery } from '../client.mjs';

const id='11111111-1111-1111-1111-111111111111', other='22222222-2222-2222-2222-222222222222';
const scope=email=>createHash('sha256').update(email).digest('hex');
const raw=(n=1)=>({trajectory:{cascadeId:id,generatorMetadata:Array.from({length:n},(_,i)=>({chatModel:{usage:{messageId:String(i),inputTokens:'1000',outputTokens:'100',responseOutputTokens:'100',apiProvider:'API_PROVIDER_GOOGLE_GEMINI'},streamingDuration:'2s'}})),steps:[]}});
async function fixture(t) {
  const dir=await mkdtemp(join(tmpdir(),'ag-history-')); t.after(()=>rm(dir,{recursive:true,force:true}));
  return {dir,history:new SessionHistory(dir)};
}
const client=(trajectory=async()=>raw())=>({discover:async()=>({pid:1}),trajectory,call:async method=>method==='GetUserStatus'?{userStatus:{email:'a@example.test'}}:method==='GetAllCascadeTrajectories'?{trajectorySummaries:{[id]:{summary:'private title'}}}:{response:{groups:[]}}});

test('cache coverage regression does not freeze new token output, steps or context; restart preserves both groups',async t=>{
  const {history}=await fixture(t);let response=raw(3);
  const store=new MetricsStore(client(async()=>response),{history});
  await store.snapshot({conversationId:id});
  response=raw(4);
  for(const g of response.trajectory.generatorMetadata) delete g.chatModel.usage.apiProvider;
  response.trajectory.steps=[{type:'USER_INPUT'},{type:'USER_INPUT'}];
  response.trajectory.generatorMetadata.at(-1).chatModel.chatStartMetadata={contextWindowMetadata:{estimatedTokensUsed:123,maxContextTokens:1000}};
  const updated=(await store.snapshot({conversationId:id,force:true})).speed;
  assert.equal(updated.requests,4);assert.equal(updated.rounds,2);
  assert.equal(updated.tokens.outputTokens,400);assert.equal(updated.tokens.totalTokens,4400);
  assert.equal(updated.tokens.uncachedTokens,4000,'Missing cache-provider eligibility cannot discard normalized input');
  assert.equal(updated.cache.measuredRequests,3);assert.equal(updated.cacheRestoredFromHistory,true);
  assert.equal(updated.restoredFromHistory,false);assert.equal(updated.context.usedTokens,123);
  const offline=(await new MetricsStore(client(async()=>{throw Error('offline');}),{history:new SessionHistory(history.directory)}).snapshot({conversationId:id})).speed;
  assert.equal(offline.tokens.outputTokens,400);assert.equal(offline.cacheRestoredFromHistory,true);
  response=raw(5);const recovered=(await store.snapshot({conversationId:id,force:true})).speed;
  assert.equal(recovered.tokens.outputTokens,500);assert.equal(recovered.cache.measuredRequests,5);
  assert.equal(recovered.cacheRestoredFromHistory,false);
});

test('old schema-1 token undercounts recover independent output without deleting history',async t=>{
  const {history}=await fixture(t);const a=scope('a@example.test');
  const value=trajectoryMetrics(raw(3));delete value.tokens;
  value.cache.outputTokens=100;value.cache.inputTokens=1000;value.cache.totalTokens=1100;
  value.cache.uncachedTokens=1000;
  value.cache.measuredRequests=1;value.cache.missingRequests=2;value.cache.complete=false;
  await history.save(a,id,value);
  const loaded=await history.load(a,id);
  assert.equal(loaded.metrics.tokens.outputTokens,300);
  assert.equal(loaded.metrics.tokens.totalTokens,3300);
  assert.equal(loaded.metrics.tokens.uncachedTokens,3000,'Legacy counts retain input excluded by the cache card');
  assert.equal(loaded.metrics.tokens.complete,false);
  const restored=(await new MetricsStore(client(async()=>{throw Error('offline');}),{history}).snapshot({conversationId:id})).speed;
  assert.equal(restored.tokens.outputTokens,300);
});

test('output-only records without cache, timing or context persist and remain isolated',async t=>{
  const {history}=await fixture(t);
  const data=trajectoryMetrics({trajectory:{cascadeId:id,generatorMetadata:[{chatModel:{usage:{outputTokens:'42'}}}]}});
  await history.save(scope('a'),id,data);
  assert.equal((await history.load(scope('a'),id)).metrics.tokens.outputTokens,42);
  assert.equal(await history.load(scope('b'),id),null);
});

test('legacy output sums do not imply recorded per-request output coverage',()=>{
  const value=trajectoryMetrics(raw(2));delete value.tokens;
  const migrated=safeMetrics(value,id);
  assert.equal(migrated.tokens.outputTokens,200);
  assert.equal(migrated.tokens.complete,false);
  assert.equal(migrated.tokens.missingOutputRequests,null);
  const emptyOutput=structuredClone(value);emptyOutput.counts.output=0;
  const zero=safeMetrics(emptyOutput,id);
  assert.equal(zero.tokens.outputTokens,0);
  assert.equal(zero.tokens.complete,false,'A stored zero can be the old missing-value default');
});

test('unchanged healthy snapshots preserve values, history timestamps and write idempotence',async t=>{
  const {history}=await fixture(t);const store=new MetricsStore(client(),{history});
  const first=(await store.snapshot({conversationId:id})).speed;
  const original=await history.load(scope('a@example.test'),id);
  const next=(await store.snapshot({conversationId:id,force:true})).speed;
  assert.deepEqual(next.tokens,first.tokens);assert.deepEqual(next.cache,first.cache);
  assert.equal(next.speedRestoredFromHistory,false);assert.equal(next.cacheRestoredFromHistory,false);
  assert.equal((await history.load(scope('a@example.test'),id)).savedAt,original.savedAt);
  assert.equal(next.tokens.complete,true);assert.equal(next.tokens.totalTokens,next.cache.totalTokens);
});

test('restored cache timestamp survives subsequent live updates and new backend processes',async t=>{
  const {history}=await fixture(t);let response=raw(2);
  const store=new MetricsStore(client(async()=>response),{history});await store.snapshot({conversationId:id});
  const cacheAt=(await history.load(scope('a@example.test'),id)).savedAt;
  response=raw(3);for(const g of response.trajectory.generatorMetadata)delete g.chatModel.usage.apiProvider;
  const first=(await store.snapshot({conversationId:id,force:true})).speed;
  assert.equal(first.cacheSavedAt,cacheAt);
  response=raw(4);for(const g of response.trajectory.generatorMetadata)delete g.chatModel.usage.apiProvider;
  const c=client(async()=>response);c.discover=async()=>({pid:2});
  const restarted=(await new MetricsStore(c,{history:new SessionHistory(history.directory)}).snapshot({conversationId:id})).speed;
  assert.equal(restarted.tokens.outputTokens,400);
  assert.equal(restarted.cacheSavedAt,cacheAt);assert.equal(restarted.cacheRestoredFromHistory,true);
});

test('new token history rejects fractional, unsafe counters and false completeness',()=>{
  const value=trajectoryMetrics(raw());
  value.tokens.outputTokens=1.5;
  const invalid=safeMetrics(value,id);
  assert.equal(invalid.tokens.outputTokens,null);assert.equal(invalid.tokens.complete,false);
  assert.equal(invalid.tokens.outputAvailable,false);assert.equal(invalid.tokens.totalTokens,1000);
  value.tokens.outputTokens=Number.MAX_SAFE_INTEGER+1;
  assert.equal(safeMetrics(value,id).tokens.outputTokens,null);
  value.tokens.outputTokens=100;value.tokens.totalTokens=9999;
  const repaired=safeMetrics(value,id);
  assert.equal(repaired.tokens.complete,false);
  assert.equal(repaired.tokens.totalTokens,1100,'A corrupt saved total cannot be advertised as a lower bound');
});

test('issue 12: continued zero-input tool calls grow usage and survive restart without false cache gaps',async t=>{
  const {history}=await fixture(t);
  const first={chatModel:{usage:{responseId:'normal',apiProvider:'API_PROVIDER_GOOGLE_GEMINI',inputTokens:'15578',cacheReadTokens:'11063',outputTokens:'880'},streamingDuration:'2s'}};
  const followups=Array.from({length:253},(_,i)=>({chatModel:{usage:{responseId:'tool-'+i,apiProvider:'API_PROVIDER_GOOGLE_GEMINI',inputTokens:'0',outputTokens:i===0?'89749':'0'},streamingDuration:'2s'}}));
  let response={trajectory:{cascadeId:id,generatorMetadata:[first,...followups]}};
  const store=new MetricsStore(client(async()=>response),{history});
  const full=(await store.snapshot({conversationId:id})).speed;
  assert.equal(full.tokens.totalTokens,117270);assert.equal(full.tokens.outputTokens,90629);
  assert.equal(full.tokens.complete,true);assert.equal(full.cache.missingRequests,0);
  assert.equal(full.cache.hitRate,11063/26641);
  response.trajectory.generatorMetadata.push({chatModel:{usage:{responseId:'next-tool',apiProvider:'API_PROVIDER_GOOGLE_GEMINI',inputTokens:'0',outputTokens:'500'},streamingDuration:'2s'}});
  const next=(await store.snapshot({conversationId:id,force:true})).speed;
  assert.equal(next.tokens.totalTokens,117770);assert.equal(next.cache.missingRequests,0);
  const restored=(await new MetricsStore(client(async()=>{throw Error('offline');}),{history:new SessionHistory(history.directory)}).snapshot({conversationId:id})).speed;
  assert.equal(restored.tokens.totalTokens,117770);assert.equal(restored.tokens.complete,true);
  assert.equal(restored.tokens.cachedRequests,255);assert.equal(restored.cache.hitRate,11063/26641);
});

test('component coverage upgrades earlier token records conservatively without losing values',()=>{
  const earlier=trajectoryMetrics(raw());
  for(const key of ['uncachedRequests','cachedRequests','cacheWriteRequests'])delete earlier.tokens[key];
  const migrated=safeMetrics(earlier,id);
  assert.equal(migrated.tokens.totalTokens,1100);assert.equal(migrated.tokens.complete,true);
  assert.equal(migrated.tokens.uncachedRequests,1);assert.equal(migrated.tokens.cachedRequests,1);
});

test('legacy input parts rejected by cache eligibility can be recovered without a live trajectory',async t=>{
  const {history}=await fixture(t);
  const legacy=trajectoryMetrics({trajectory:{cascadeId:id,generatorMetadata:[{chatModel:{usage:{inputTokens:'100',cacheReadTokens:'40',cacheWriteTokens:'5',outputTokens:'50'}}}]}});
  delete legacy.tokens;
  assert.equal(legacy.cache.measuredRequests,0);
  await history.save(scope('a@example.test'),id,legacy);
  const restored=(await new MetricsStore(client(async()=>{throw Error('offline');}),{history}).snapshot({conversationId:id})).speed;
  assert.equal(restored.tokens.inputTokens,145);assert.equal(restored.tokens.totalTokens,195);
  assert.equal(restored.tokens.uncachedTokens,100);assert.equal(restored.tokens.cachedTokens,40);
  assert.equal(restored.tokens.cacheWriteTokens,5);assert.equal(restored.tokens.complete,false);
  assert.equal(restored.cache.hitRate,null);
});

test('cache recovery cannot revive TPS rejected by current rate-quality classification',async t=>{
  const {history}=await fixture(t);let response=raw(2);
  const store=new MetricsStore(client(async()=>response),{history});
  assert.equal((await store.snapshot({conversationId:id})).speed.tps,50);
  response=raw(2);response.trajectory.steps=[{type:'CORTEX_STEP_TYPE_PLANNER_RESPONSE',plannerResponse:{response:'',toolCalls:[{}]}}];
  for(const g of response.trajectory.generatorMetadata){g.stepIndices=[0];g.chatModel.streamingDuration='0.001s';g.chatModel.timeToFirstToken='2s';delete g.chatModel.usage.apiProvider;}
  const fresh=(await store.snapshot({conversationId:id,force:true})).speed;
  assert.equal(fresh.tps,null);assert.equal(fresh.latestRateStatus,'unreliable');
  assert.equal(fresh.cacheRestoredFromHistory,true);assert.equal(fresh.restoredFromHistory,false);
  assert.equal(fresh.tokens.totalTokens,2200);assert.equal(fresh.counts.output,200);
});
