import test from 'node:test';
import assert from 'node:assert/strict';
import {requestCacheMetrics,trajectoryMetrics,tokenCount} from '../metrics.mjs';
const request=(id,usage)=>({chatModel:{usage:{messageId:id,...usage},streamingDuration:'2s'}});

test('long historical conversation keeps all output tokens when 253 requests lack cache data',()=>{
  const known=request('known',{apiProvider:'API_PROVIDER_GOOGLE_GEMINI',inputTokens:'15578',cacheReadTokens:'11063',outputTokens:'880'});
  const old=Array.from({length:253},(_,i)=>request(`old-${i}`,{outputTokens:i===0?'89749':'0'}));
  const first=trajectoryMetrics({trajectory:{generatorMetadata:[known,...old]}});
  assert.equal(first.counts.output,90629);
  assert.equal(first.tokens.outputTokens,90629);
  assert.equal(first.tokens.totalTokens,117270);
  assert.equal(first.tokens.missingInputRequests,253);
  assert.equal(first.tokens.missingOutputRequests,0);
  assert.equal(first.tokens.complete,false);
  assert.equal(first.cache.missingRequests,253);
  assert.equal(first.cache.hitRate,11063/26641);
  const next=trajectoryMetrics({trajectory:{generatorMetadata:[known,...old,request('next',{outputTokens:'500'})]}});
  assert.equal(next.tokens.totalTokens,117770,'New output grows even without new cache statistics');
  assert.equal(next.tokens.outputTokens,91129);
});

test('output-only and unknown-provider usage are available without inventing cache ratios',()=>{
  const cases=[
    [{outputTokens:'200'},200,0,false],
    [{apiProvider:'UNKNOWN',inputTokens:'123',outputTokens:'200'},323,1,true],
    [{apiProvider:'API_PROVIDER_OPENAI',inputTokens:'100',cacheReadTokens:'invalid',outputTokens:'200'},300,0,false],
  ];
  for(const [usage,total,inputRequests,complete] of cases) {
    const data=trajectoryMetrics({trajectory:{generatorMetadata:[request('output',usage)]}});
    assert.equal(data.tokens.outputTokens,200);
    assert.equal(data.tokens.outputRequests,1);
    assert.equal(data.tokens.inputRequests,inputRequests);
    assert.equal(data.tokens.totalTokens,total);
    assert.equal(data.tokens.complete,complete);
    assert.equal(data.cache.hitRate,null);
  }
  const zero=trajectoryMetrics({trajectory:{generatorMetadata:[request('zero',{outputTokens:'0'})]}});
  assert.equal(zero.tokens.outputRequests,1);
  assert.equal(zero.tokens.totalTokens,0);
});

test('malformed token counters cannot become real usage through JavaScript coercion',()=>{
  for(const value of [true,false,[],[42],{},'', ' ', '1e3',Infinity,NaN,-1,1.5,Number.MAX_SAFE_INTEGER+1]) {
    assert.equal(tokenCount(value),null);
    const data=trajectoryMetrics({trajectory:{generatorMetadata:[request('bad',{apiProvider:'API_PROVIDER_OPENAI',inputTokens:value,outputTokens:value,cacheReadTokens:value})]}});
    assert.equal(data.tokens.measuredRequests,0);assert.equal(data.cache.hitRate,null);
  }
  assert.equal(tokenCount('0'),0);assert.equal(tokenCount(0),0);assert.equal(tokenCount('42'),42);
});

test('issue 12: known zero input is valid usage and does not create missing-cache warnings',()=>{
  for(const apiProvider of ['API_PROVIDER_GOOGLE_GEMINI','UNKNOWN',undefined]) {
    const usage={apiProvider,inputTokens:'0',outputTokens:'200'};
    const data=trajectoryMetrics({trajectory:{generatorMetadata:[request('tool-followup',usage)]}});
    assert.equal(data.tokens.totalTokens,200);assert.equal(data.tokens.inputRequests,1);
    assert.equal(data.tokens.complete,true);assert.equal(data.cache.missingRequests,0);
    assert.equal(data.cache.hitRate,null,'A zero denominator is unavailable, not a fabricated 0%');
  }
});

test('issue 12: valid input components survive incomplete cache-ratio samples',()=>{
  const records=[
    request('normal',{apiProvider:'API_PROVIDER_GOOGLE_GEMINI',inputTokens:'100',cacheReadTokens:'50',outputTokens:'10'}),
    request('tool',{apiProvider:'API_PROVIDER_GOOGLE_GEMINI',inputTokens:'0',outputTokens:'20'}),
    request('partial',{apiProvider:'API_PROVIDER_GOOGLE_GEMINI',inputTokens:'100',cacheReadTokens:'invalid',outputTokens:'30'}),
    request('cache-only',{apiProvider:'API_PROVIDER_GOOGLE_GEMINI',cacheReadTokens:'40',cacheWriteTokens:'5',outputTokens:'50'}),
  ];
  const data=trajectoryMetrics({trajectory:{generatorMetadata:records}});
  assert.equal(data.tokens.uncachedTokens,200);assert.equal(data.tokens.cachedTokens,90);
  assert.equal(data.tokens.cacheWriteTokens,5);assert.equal(data.tokens.inputTokens,295);
  assert.equal(data.tokens.outputTokens,110);assert.equal(data.tokens.totalTokens,405);
  assert.equal(data.tokens.inputRequests,2);assert.equal(data.tokens.uncachedRequests,3);
  assert.equal(data.tokens.cachedRequests,3);assert.equal(data.tokens.cacheWriteRequests,4);
  assert.equal(data.tokens.complete,false);assert.equal(data.cache.hitRate,1/3);
});

test('component arithmetic cannot overflow into a falsely complete total',()=>{
  const data=trajectoryMetrics({trajectory:{generatorMetadata:[
    request('a',{apiProvider:'API_PROVIDER_GOOGLE_GEMINI',inputTokens:String(Number.MAX_SAFE_INTEGER),outputTokens:'10'}),
    request('b',{apiProvider:'API_PROVIDER_GOOGLE_GEMINI',inputTokens:'1',outputTokens:'20'}),
  ]}});
  assert.equal(data.tokens.uncachedTokens,null);assert.equal(data.tokens.complete,false);
  assert.equal(data.tokens.outputTokens,30);assert.equal(data.tokens.totalTokens,30);
});
