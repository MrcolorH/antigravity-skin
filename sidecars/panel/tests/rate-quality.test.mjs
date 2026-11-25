import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { trajectoryMetrics, seconds } from '../metrics.mjs';

const make = (id,tokens,duration,options={}) => ({stepIndices:options.tool?[0]:[],chatModel:{modelDisplayName:options.model||'Model A',
  usage:{messageId:id,responseOutputTokens:tokens,outputTokens:tokens,inputTokens:1000,cacheReadTokens:500,apiProvider:'API_PROVIDER_GOOGLE_GEMINI',...options.usage},
  streamingDuration:duration,timeToFirstToken:options.ttft??2,...options.chat}});
const result = generators => trajectoryMetrics({trajectory:{generatorMetadata:generators,steps:[{type:'CORTEX_STEP_TYPE_PLANNER_RESPONSE',plannerResponse:{toolCalls:[{}]}}]}});

test('real buffered-tool reproduction is quarantined; usage, cache and TTFT survive',()=>{
  const normal=make('normal',909,9.6352291),bad=make('buffered',17776,.349271,{tool:true,ttft:106.005289});
  const data=result([normal,bad]);
  assert.ok(Math.abs(data.tps-94.34129594282298)<1e-8);
  assert.equal(data.latestTps,null);assert.equal(data.latestRateStatus,'unreliable');
  assert.equal(data.measuredRequests,1);assert.equal(data.excludedTiming,1);
  assert.equal(data.timingReasons['short-tool-window'],1);
  assert.equal(data.counts.responseOutput,18685);assert.equal(data.cache.outputTokens,18685);
  assert.equal(data.cache.measuredRequests,2);assert.equal(data.ttftSeconds,54.0026445);
});
test('ordinary short text and genuinely sustained high throughput remain measurable',()=>{
  for(const sample of [make('text',27,.0797699,{ttft:4.0878562}),make('fast',30000,2),make('tool',68,.06,{tool:true,ttft:.1})]){
    const data=result([sample]);assert.equal(data.measuredRequests,1);assert.equal(data.excludedTiming,0);assert.ok(data.tps>0);
  }
});
test('five same-model normal samples identify a short outlier; different models cannot supply the baseline',()=>{
  const baseline=Array.from({length:5},(_,i)=>make('normal'+i,200,2));
  const data=result([...baseline,make('spike',1000,.01)]);
  assert.equal(data.tps,100);assert.equal(data.latestTps,null);assert.equal(data.timingReasons['short-outlier'],1);
  const other=result([...baseline,make('new-model',1000,.01,{model:'Model B'})]);
  assert.equal(other.excludedTiming,0);assert.equal(other.rateWarnings,1);
  const sustained=result([...baseline,make('fast',10000,2)]);
  assert.equal(sustained.excludedTiming,0);assert.equal(sustained.rateWarnings,1);assert.ok(sustained.latestTps>1000);
});
test('one attempt record is valid; differing multiple-attempt usage is not paired to a single duration',()=>{
  const single=make('single',100,2,{chat:{retryInfos:[{usage:{outputTokens:100,responseOutputTokens:100}}]}});
  assert.equal(result([single]).tps,50);
  const multi=make('retry',100,2,{chat:{retryInfos:[{usage:{outputTokens:80,responseOutputTokens:80}},{usage:{outputTokens:100,responseOutputTokens:100}}]}});
  const data=result([multi]);assert.equal(data.tps,null);assert.equal(data.counts.output,100);assert.equal(data.timingReasons['retry-scope'],1);
});
test('conflicting duplicate timing and inconsistent token scopes cannot poison TPS',()=>{
  const a=make('same',100,2),b=make('same',100,.001);
  const duplicate=result([a,b]);assert.equal(duplicate.requests,1);assert.equal(duplicate.tps,null);assert.equal(duplicate.counts.output,100);
  assert.equal(duplicate.timingReasons['duplicate-scope'],1);
  for(const usage of [{thinkingOutputTokens:200},{responseOutputTokens:'bad'},{responseOutputTokens:80,thinkingOutputTokens:40}]){
    const data=result([make('bad',100,2,{usage})]);assert.equal(data.tps,null);assert.equal(data.excludedTiming,1);
    assert.equal(data.timingReasons['token-scope'],1);
  }
});
test('latest missing timing never borrows the previous rate; malformed durations stay unknown',()=>{
  const data=result([make('normal',100,2),make('missing',100,undefined)]);
  assert.equal(data.latestTps,null);assert.equal(data.latestRateStatus,'missing');assert.equal(data.tps,50);
  for(const duration of [{},{seconds:2,nanos:-1},{seconds:2,nanos:1e9},'9'.repeat(400)+'s'])assert.equal(seconds(duration),null);
});
test('all rejected samples have no fabricated TPS; the UI keeps only the calculation basis',()=>{
  const data=result([make('tool',17776,.349271,{tool:true,ttft:106})]);assert.equal(data.tps,null);assert.equal(data.latestTps,null);
  assert.equal(data.rateBasis,'response');
  const i18n=createRequire(import.meta.url)('../compat/i18n.cjs');
  for(const locale of ['en','zh-CN']) assert.equal(i18n(locale).rateNote(data),i18n(locale).t('responseBasis'));
  assert.equal(i18n('zh-CN').rateNote({...data,latestRateStatus:'legacy'}),'等待重算');
});
