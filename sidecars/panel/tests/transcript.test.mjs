import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,appendFile,rm,rename,symlink,utimes} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {TranscriptReader,safeTranscriptStats,transcriptBrainRoot} from '../transcript.mjs';
import {TrajectoryJson} from '../trajectory-json.mjs';
import {MetricsStore} from '../store.mjs';
import {safeMetrics,reconcileMetrics,SessionHistory} from '../history.mjs';
import {trajectoryMetrics} from '../metrics.mjs';

const id='11111111-1111-1111-1111-111111111111',scope='a'.repeat(64),other='b'.repeat(64);
const time=i=>new Date(Date.UTC(2026,9,14,0,0,i)).toISOString();
const row=(index,type,content='abcd',extra={})=>({step_index:index,type,created_at:time(index),content,...extra});
const raw=rows=>({trajectory:{steps:rows.map(r=>({type:r.type,metadata:{createdAt:r.created_at}}))}});
const jsonl=rows=>rows.map(r=>JSON.stringify(r)+'\n').join('');
async function fixture(t,options={}){
 const root=await mkdtemp(join(tmpdir(),'ag-transcript-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const directory=join(root,id,'.system_generated','logs');await mkdir(directory,{recursive:true});
 const file=join(directory,'transcript_full.jsonl'),reader=new TranscriptReader({root,...options});
 return {root,directory,file,reader};
}
async function collect(reader,steps,account=scope){reader.request(account,id,raw(steps));await reader.idle();return reader.peek(account,id);}

test('classification is separate from host occupancy and ignores media/tool arguments',async t=>{
 const {reader,file}=await fixture(t);
 const rows=[row(0,'USER_INPUT','你好',{media:'PRIVATE_MEDIA'}),row(1,'PLANNER_RESPONSE','abcd',{thinking:'abcdefgh',tool_calls:[{arguments:'PRIVATE_ARGUMENTS'}]}),row(2,'GENERIC','abcdefgh'),row(3,'SYSTEM_MESSAGE','abcd')];
 await writeFile(file,jsonl(rows));const stats=await collect(reader,rows);
 assert.equal(stats.status,'ready');assert.deepEqual([stats.userTokens,stats.assistantTokens,stats.toolTokens,stats.systemTokens],[2,3,2,1]);
 assert.equal(stats.totalTokens,8);assert.equal(JSON.stringify([...reader.entries.values()]).includes('PRIVATE'),false);
 const host=trajectoryMetrics({trajectory:{generatorMetadata:[{chatModel:{chatStartMetadata:{contextWindowMetadata:{estimatedTokensUsed:50,maxContextTokens:100}}}}]}});
 const saved=safeMetrics({...host,transcriptStats:stats},id);
 assert.equal(saved.context.usedTokens,50);assert.equal(saved.context.usedFraction,.5);assert.equal(saved.transcriptStats.totalTokens,8);
 assert.equal(transcriptBrainRoot('ide').includes('antigravity-ide'),true);assert.throws(()=>transcriptBrainRoot('cli'));
});
test('undo and zero active steps use explicit indexes, not line count',async t=>{
 const {reader,file}=await fixture(t);const rows=[row(0,'USER_INPUT'),row(1,'PLANNER_RESPONSE','x'.repeat(4000)),row(2,'GENERIC')];
 await writeFile(file,jsonl([rows[0],rows[1],rows[1],rows[2]]));assert.equal((await collect(reader,rows)).totalTokens,1002);
 const undone=await collect(reader,rows.slice(0,1));assert.equal(undone.totalTokens,1);assert.equal(undone.matchedSteps,1);
 const zero=await collect(reader,[]);assert.equal(zero.totalTokens,0);assert.equal(zero.matchedSteps,0);
});
test('replacement at the same index rejects stale type/timestamp and accepts appended revision',async t=>{
 const {reader,file}=await fixture(t);const original=[row(0,'USER_INPUT'),row(1,'PLANNER_RESPONSE','x'.repeat(4000))];
 await writeFile(file,jsonl(original));await collect(reader,original);
 const changed=[original[0],row(1,'PLANNER_RESPONSE','abcd',{created_at:time(5)})];
 const stale=await collect(reader,changed);assert.equal(stale.totalTokens,1);assert.equal(stale.status,'partial');
 await appendFile(file,jsonl([changed[1]]));assert.equal((await collect(reader,changed)).totalTokens,2);
 const different=[original[0],row(1,'GENERIC')];assert.equal((await collect(reader,different)).totalTokens,1);
});
test('host enum prefixes normalize exactly and active timestamps still reject old branches',async t=>{
 const {reader,file}=await fixture(t);const rows=[row(0,'USER_INPUT')];await writeFile(file,jsonl(rows));
 const prefixed={trajectory:{steps:[{type:'CORTEX_STEP_TYPE_USER_INPUT',metadata:{createdAt:time(0)}}]}};
 reader.request(scope,id,prefixed);await reader.idle();assert.equal(reader.peek(scope,id).status,'ready');
 prefixed.trajectory.steps[0].metadata.createdAt=time(1);reader.request(scope,id,prefixed);assert.equal(reader.peek(scope,id).totalTokens,0);
});
test('real App whole-second timestamps and explicit GENERIC mappings retain useful but partial coverage',async t=>{
 const {reader,file}=await fixture(t);const rows=[row(0,'USER_INPUT'),row(1,'GENERIC'),row(2,'GENERIC')];await writeFile(file,jsonl(rows));
 const active={trajectory:{steps:[
  {type:'CORTEX_STEP_TYPE_USER_INPUT',metadata:{createdAt:time(0).replace('.000Z','.259520800Z')}},
  {type:'CORTEX_STEP_TYPE_RUN_COMMAND',metadata:{createdAt:time(1).replace('.000Z','.912052800Z')}},
  {type:'CORTEX_STEP_TYPE_UNKNOWN_TOOL',metadata:{createdAt:time(2)}},
 ]}};
 // Match log precision, not an invented tolerance. Fixture logs have .000
 // precision; change them to the whole-second format observed in the App.
 await writeFile(file,jsonl(rows.map(r=>({...r,created_at:r.created_at.replace('.000Z','Z')}))));
 reader.request(scope,id,active);await reader.idle();const stats=reader.peek(scope,id);
 assert.equal(stats.matchedSteps,2);assert.equal(stats.totalTokens,2);assert.equal(stats.complete,false);
 active.trajectory.steps[1].metadata.createdAt=time(5);reader.request(scope,id,active);assert.equal(reader.peek(scope,id).matchedSteps,1);
});
test('compaction markers do not delete history or claim active context; quotes and generation names are harmless',async t=>{
 const {reader,file}=await fixture(t);
 const rows=[row(0,'USER_INPUT','# Resuming from a compaction'),row(1,'CHECKPOINT','# Resuming from a compaction\nsummary'),row(2,'COMPACTION'),row(3,'PLANNER_RESPONSE','image generate',{model:'image-banana'}),row(4,'IMAGE_GENERATION'),row(5,'GENERATE_CODE')];
 await writeFile(file,jsonl(rows));const stats=await collect(reader,rows);assert.equal(stats.compactionMarkers,2);assert.equal(stats.imageSteps,1);
 assert.equal(stats.status,'partial');assert.ok(stats.userTokens>0);
});
test('partial final lines, malformed rows and later completion are explicit',async t=>{
 const {reader,file}=await fixture(t);const rows=[row(0,'USER_INPUT'),row(1,'PLANNER_RESPONSE','abcd')];
 await writeFile(file,jsonl([rows[0]])+JSON.stringify(rows[1]).slice(0,-1));
 const incomplete=await collect(reader,rows);assert.equal(incomplete.totalTokens,1);assert.equal(incomplete.complete,false);
 await appendFile(file,'}\n');assert.equal((await collect(reader,rows)).totalTokens,2);
 await appendFile(file,'INVALID\n');assert.equal((await collect(reader,rows)).reason,'invalid-record');
});
test('fallback, truncation and file replacement restart numeric projection',async t=>{
 const {reader,file,directory}=await fixture(t);const rows=[row(0,'USER_INPUT','x'.repeat(400))];
 await writeFile(join(directory,'transcript.jsonl'),jsonl(rows));assert.equal((await collect(reader,rows)).totalTokens,100);
 await writeFile(file,jsonl([row(0,'USER_INPUT')]));assert.equal((await collect(reader,rows)).totalTokens,1);
 await writeFile(file,jsonl([row(0,'USER_INPUT','abcdefgh')]));await utimes(file,new Date(),new Date(Date.now()+1000));assert.equal((await collect(reader,rows)).totalTokens,2);
 const replacement=file+'.new';await writeFile(replacement,jsonl([row(0,'USER_INPUT','x'.repeat(40))]));await rm(file);await rename(replacement,file);
 assert.equal((await collect(reader,rows)).totalTokens,10);
 await writeFile(file,'');assert.equal((await collect(reader,[])).totalTokens,0);
});
test('bounded chunk passes resume even within a huge line and yield to other work',async t=>{
 const {reader,file}=await fixture(t,{bytesPerPass:65536,passMs:1000});const rows=[row(0,'USER_INPUT','x'.repeat(2*1024*1024))];
 await writeFile(file,jsonl(rows));let beats=0;const timer=setInterval(()=>beats++,0);t.after(()=>clearInterval(timer));
 let stats=await collect(reader,rows);assert.equal(stats.complete,false);assert.equal(reader.entries.get(scope+':'+id).state.offset,65536);
 for(let i=0;i<40&&!stats.complete;i++)stats=await collect(reader,rows);
 assert.equal(stats.totalTokens,524288);assert.equal(stats.status,'ready');assert.ok(beats>0);
 const state=reader.entries.get(scope+':'+id).state;assert.equal(state.rows.size,1);assert.equal(state.parser,null);
});
test('large escaped/unicode strings are estimated incrementally without retaining bodies',()=>{
 const p=new TrajectoryJson({projection:{text:'textEstimate'},maxRetainedBytes:1024});
 p.write('{"text":"');for(let i=0;i<100;i++)p.write('x'.repeat(65536));p.write('\\u4f60\\u597d\\n"}');
 const result=p.end();assert.equal(result.text.tokens,Math.ceil((6553600+1)/4+2/1.5));assert.equal(result.text.prefix.length,256);assert.ok(p.retained<1024);
});
test('LRU, row budget, scope changes and cancellation stay bounded',async t=>{
 const {reader,file}=await fixture(t,{maxEntries:2,maxRows:2});const rows=[row(0,'USER_INPUT'),row(1,'GENERIC'),row(2,'GENERIC')];
 await writeFile(file,jsonl(rows));assert.equal((await collect(reader,rows)).reason,'invalid-boundary');
 const limited=await collect(reader,rows.slice(0,2));assert.equal(limited.reason,'row-limit');assert.equal(limited.complete,false);
 reader.request(other,id,raw(rows.slice(0,1)));reader.request('c'.repeat(64),id,raw([]));assert.equal(reader.entries.size,2);
 assert.equal(reader.peek(scope,id).status,'unavailable');reader.reset();await reader.idle();assert.equal(reader.entries.size,0);
});
test('missing/unsafe paths and other product roots cannot pollute estimates',async t=>{
 const {reader,root,directory,file}=await fixture(t);assert.equal((await collect(reader,[])).reason,'missing');
 assert.equal(reader.request(scope,'../escape',raw([])).reason,'invalid-boundary');
 await writeFile(join(directory,'unrelated.jsonl'),jsonl([row(0,'USER_INPUT')]));assert.equal((await collect(reader,[])).reason,'missing');
 const outside=await mkdtemp(join(tmpdir(),'ag-outside-'));t.after(()=>rm(outside,{recursive:true,force:true}));await writeFile(join(outside,'secret'),jsonl([row(0,'USER_INPUT')]));
 try{await symlink(join(outside,'secret'),file,'file');}catch(e){if(e.code==='EPERM'){t.diagnostic('Symlink privilege unavailable on this Windows host');return;}throw e;}
 assert.equal((await collect(reader,[])).reason,'unsafe-path');assert.equal(reader.entries.get(scope+':'+id).state,null);
});
test('timestamps missing from the host are partial and persisted fields are whitelisted',async t=>{
 const {reader,file}=await fixture(t);const rows=[row(0,'USER_INPUT')];await writeFile(file,jsonl(rows));
 reader.request(scope,id,{trajectory:{steps:[{type:'USER_INPUT'}]}});await reader.idle();assert.equal(reader.peek(scope,id).complete,false);
 const sanitized=safeTranscriptStats({...reader.peek(scope,id),totalTokens:99999,source:'https://untrusted',payload:'PRIVATE',userTokens:-1,complete:true});
 assert.equal(sanitized.userTokens,0);assert.equal(sanitized.totalTokens,0);assert.equal(sanitized.complete,false);assert.equal(sanitized.payload,undefined);
 assert.equal(safeTranscriptStats({status:'invented'}),null);
});
test('optional transcript failure never blocks metrics and undo cannot revive saved estimates',async()=>{
 const client={trajectory:async()=>({trajectory:{steps:[],generatorMetadata:[]}})};
 const history={load:async()=>null,save:async()=>null};
 const store=new MetricsStore(client,{history,transcripts:{request(){throw Error('PRIVATE');}}});store.identity=scope;
 const result=await store.session(id,true);assert.equal(result.steps,0);assert.equal(result.transcriptStats,undefined);
 const saved={...result,requests:1,counts:{output:100},tokens:{measuredRequests:1},transcriptStats:{status:'ready',totalTokens:999}};
 const fresh={...result,transcriptStats:emptyStats()};assert.equal(reconcileMetrics(saved,fresh).transcriptStats.totalTokens,0);
});
test('saved numeric estimates survive restart; zero-step undo replaces them even without host context',async t=>{
 const {root}=await fixture(t),history=new SessionHistory(join(root,'history'));
 const measured=trajectoryMetrics({trajectory:{steps:[],generatorMetadata:[{chatModel:{usage:{inputTokens:100,outputTokens:100,apiProvider:'API_PROVIDER_GOOGLE_GEMINI'},streamingDuration:'2s'}}]}});
 const stats={...emptyStats(),userTokens:100,totalTokens:100,matchedSteps:1};
 await history.save(scope,id,{...measured,transcriptStats:stats});
 assert.equal((await new SessionHistory(history.directory).load(scope,id)).metrics.transcriptStats.totalTokens,100);
 const fresh={...trajectoryMetrics({trajectory:{steps:[],generatorMetadata:[]}}),transcriptStats:emptyStats()};
 await history.save(scope,id,reconcileMetrics((await history.load(scope,id)).metrics,fresh));
 const after=(await history.load(scope,id)).metrics;assert.equal(after.transcriptStats.totalTokens,0);assert.equal(after.tokens.outputTokens,100);
 const record=await (await import('node:fs/promises')).readFile(history.file(scope,id),'utf8');assert.equal(record.includes('content'),false);
});
function emptyStats(){return safeTranscriptStats({status:'ready',complete:true,userTokens:0,assistantTokens:0,toolTokens:0,systemTokens:0,matchedSteps:0,compactionMarkers:0,imageSteps:0});}
