import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {TrajectoryJson} from '../trajectory-json.mjs';
import {AntigravityClient} from '../client.mjs';
import {trajectoryMetrics} from '../metrics.mjs';
import {usageRecords} from '../usage.mjs';
const id='11111111-1111-1111-1111-111111111111';
const record={trajectory:{cascadeId:id,steps:[{type:'USER_INPUT',userInput:{text:'PRIVATE PROMPT'}},
 {type:'PLANNER_RESPONSE',metadata:{createdAt:'2026-10-13T01:00:00Z'},plannerResponse:{response:'A short reply',toolCalls:[{arguments:'PRIVATE TOOL INPUT'}]}},
 {type:'RUN_COMMAND',metadata:{startedAt:'2026-10-13T01:00:00Z',completedAt:'2026-10-13T01:00:05Z',toolCall:{}},result:'PRIVATE OUTPUT'}],
 generatorMetadata:[{stepIndices:[1],chatModel:{messages:[{content:'PRIVATE CONTEXT'}],usage:{inputTokens:100,outputTokens:200,responseOutputTokens:200,cacheReadTokens:300,cacheWriteTokens:0,apiProvider:'API_PROVIDER_GOOGLE_GEMINI',responseId:'request-1'},
 modelDisplayName:'Gemini',streamingDuration:'2s',timeToFirstToken:{seconds:1,nanos:0},retryInfos:[{usage:{outputTokens:200}}],
 chatStartMetadata:{createdAt:'2026-10-13T01:00:00Z',contextWindowMetadata:{estimatedTokensUsed:400,maxContextTokens:10000}}}}]},numTotalSteps:3,numTotalGeneratorMetadata:1,status:'CASCADE_RUN_STATUS_IDLE'};
const project=(text,size=1)=>{const p=new TrajectoryJson();for(let i=0;i<text.length;i+=size)p.write(text.slice(i,i+size));return p.end();};
test('all statistical values and usage identities survive projection across single-character chunks',()=>{
 const raw=JSON.stringify(record),small=project(raw);
 assert.deepEqual(trajectoryMetrics(small),trajectoryMetrics(record));assert.deepEqual(usageRecords(small,id),usageRecords(record,id));
 assert.ok(!JSON.stringify(small).includes('PRIVATE'));assert.equal(small.trajectory.steps.length,3);
 assert.deepEqual(small,project(raw,65));
});
test('escaped response text retains only its trimmed presence; tool calls retain presence, not arguments',()=>{
 for(const response of ['', ' \u2000\n', ' \u2000正文🧩']){
  const raw={trajectory:{steps:[{plannerResponse:{response,toolCalls:response?['private']:[]}}]}};
  const reduced=project(JSON.stringify(raw));const planner=reduced.trajectory.steps[0].plannerResponse;
  assert.equal(Boolean(planner.response.trim()),Boolean(response.trim()));assert.equal(planner.toolCalls.length,raw.trajectory.steps[0].plannerResponse.toolCalls.length);
 }
});
test('malformed JSON is rejected even in discarded fields',()=>{
 for(const text of ['{"ignored":"bad\\x"}','{"ignored":"bad\\uABQ1"}','{"ignored":[1,]}','{"ignored":{"x":1,}}','{"ignored":01}','{"trajectory":{}}garbage','{"ignored":"unterminated','{"ignored":"\n"}'])assert.throws(()=>project(text));
 const p=new TrajectoryJson({maxRetainedBytes:1});assert.throws(()=>p.write('{"trajectory":{}}'),/上限/);
 assert.deepEqual(project('{"__proto__":{"usage":"private"},"constructor":"private"}'),{});
});
test('step and generator page schemas preserve array offsets and distinct metadata spelling',()=>{
 assert.deepEqual(project(JSON.stringify({steps:record.trajectory.steps})).steps.length,3);
 assert.equal(project(JSON.stringify({generatorMetadatas:record.trajectory.generatorMetadata})).generatorMetadatas.length,1);
});
test('a real HTTP step page above the old 32 MiB cap restores all metrics without whole-trajectory RPCs',async t=>{
 const head=JSON.stringify({steps:record.trajectory.steps}).slice(0,-1)+',"largeToolOutput":"',tail='"}',chunk='x'.repeat(64*1024);let wireBytes=0,scans=0;const methods=[];
 const server=createServer(async(req,res)=>{
  let text='';for await(const c of req)text+=c;const body=JSON.parse(text),method=req.url.split('/').at(-1);methods.push(method);res.writeHead(200,{'Content-Type':'application/json'});
  if(method==='GetAllCascadeTrajectories'){res.end(JSON.stringify({trajectorySummaries:{[id]:{stepCount:3,lastModifiedTime:'2026-10-13T01:00:00Z',status:record.status}}}));return;}
  if(method==='GetCascadeTrajectoryGeneratorMetadata'){assert.equal(body.includeMessages,false);res.end(JSON.stringify({generatorMetadata:body.generatorMetadataOffset===0?record.trajectory.generatorMetadata:[]}));return;}
  assert.equal(method,'GetCascadeTrajectorySteps');assert.equal(body.stepOffset,0);
  res.write(head);wireBytes+=Buffer.byteLength(head);
  for(let i=0;i<640;i++){wireBytes+=chunk.length;if(!res.write(chunk))await once(res,'drain');}
  res.end(tail);wireBytes+=Buffer.byteLength(tail);
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));
 const port=server.address().port,client=new AntigravityClient({paths:()=>({log:'fixture'}),readLog:async()=>`listening on random port at ${port} for HTTP\n`,
 processes:async()=>{scans++;return [{ProcessId:42,CommandLine:'language_server --standalone --csrf_token=fixture',Ports:[port]}];}});
 const raw=await client.trajectory(id);assert.ok(wireBytes>32*1024*1024);assert.ok(Buffer.byteLength(JSON.stringify(raw))<4096);assert.ok(!methods.includes('GetCascadeTrajectory'));
 assert.deepEqual(trajectoryMetrics(raw),trajectoryMetrics(record));assert.deepEqual(usageRecords(raw,id),usageRecords(record,id));assert.equal(scans,1);
 assert.equal(trajectoryMetrics(raw).tps,100);assert.equal(trajectoryMetrics(raw).cache.hitRate,.75);
 console.log(JSON.stringify({longConversationRegression:true,wireBytes,retainedBytes:Buffer.byteLength(JSON.stringify(raw)),context:trajectoryMetrics(raw).context.usedTokens,cache:trajectoryMetrics(raw).cache.hitRate}));
});
