// Optional local text estimates. Never substitute these for host context or
// request usage. The cache contains numeric summaries, not transcript bodies.
import {open,realpath,stat} from 'node:fs/promises';
import {join,relative,isAbsolute} from 'node:path';
import {homedir} from 'node:os';
import {createHash} from 'node:crypto';
import {StringDecoder} from 'node:string_decoder';
import {setImmediate as yieldLoop} from 'node:timers/promises';
import {TrajectoryJson} from './trajectory-json.mjs';

const GUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SCOPE=/^[0-9a-f]{64}$/;
const fields=['userTokens','assistantTokens','toolTokens','systemTokens'];
const count=n=>Number.isSafeInteger(n)&&n>=0;
const projection={step_index:'scalar',type:'scalar',source:'scalar',created_at:'scalar',content:'textEstimate',thinking:'textEstimate'};
const statuses=['loading','ready','partial','unavailable'];
const reasons=['reading','missing','unsafe-path','invalid-boundary','row-limit','invalid-record','unmatched-record','incomplete-line','io-error'];
export function transcriptBrainRoot(host='app'){
 if(!['app','ide'].includes(host))throw Error('Unsupported transcript host');
 return join(homedir(),'.gemini',host==='ide'?'antigravity-ide':'antigravity','brain');
}
export function safeTranscriptStats(value){
 if(!value||typeof value!=='object'||!statuses.includes(value.status)||value.version!==undefined&&value.version!==1)return null;
 const result={version:1,status:value.status,reason:reasons.includes(value.reason)?value.reason:null,
  source:'local-recorded-text',estimated:true,complete:value.status==='ready'&&value.complete===true};
 for(const key of [...fields,'matchedSteps','compactionMarkers','imageSteps'])result[key]=count(value[key])?value[key]:0;
 result.totalTokens=fields.reduce((n,k)=>n+result[k],0);
 if(!count(result.totalTokens))return null;
 // Unknown/unavailable is not a measured zero, and malformed saved estimates
 // cannot claim complete coverage. Extra fields and arbitrary URLs are dropped.
 if([...fields,'matchedSteps','compactionMarkers','imageSteps'].some(k=>!count(value[k])))result.complete=false;
 if(result.matchedSteps>8192||result.compactionMarkers>result.matchedSteps||result.imageSteps>result.matchedSteps)return null;
 if(['unavailable','loading'].includes(result.status)){for(const k of [...fields,'matchedSteps','compactionMarkers','imageSteps','totalTokens'])result[k]=0;result.complete=false;}
 return result;
}
const empty=(status,reason)=>safeTranscriptStats({status,reason,...Object.fromEntries([...fields,'matchedSteps','compactionMarkers','imageSteps'].map(k=>[k,0]))});
const timestamp=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))?Date.parse(value):null;
const timeQuantum=value=>typeof value==='string'?10**Math.max(0,3-(value.match(/\.(\d+)(?:Z|[+-]\d\d:\d\d)$/)?.[1].length||0)):1000;
const stepType=value=>typeof value==='string'&&value.length<=128?value.replace(/^CORTEX_STEP_TYPE_/,''):null;
// Verified local App log mappings (2026-10-14). Unknown tool enums do not
// silently match GENERIC: their records remain partial/unmatched.
const genericHostTypes=new Set(['RUN_COMMAND','VIEW_FILE']);
function boundary(raw,maxRows){
 const steps=raw?.trajectory?.steps??raw?.steps;
 if(!Array.isArray(steps)||steps.length>maxRows)return null;
 // Array position is the host's step index. Line count is never a boundary.
 const active=steps.map(s=>({type:stepType(s?.type),time:timestamp(s?.metadata?.createdAt),quantum:timeQuantum(s?.metadata?.createdAt)}));
 return {active};
}
function summary(record){
 if(!count(record.step_index)||typeof record.type!=='string'||!record.type.length||record.type.length>128)return null;
 const type=stepType(record.type),content=record.content?.tokens||0,thinking=record.thinking?.tokens||0;
 if(!count(content)||!count(thinking)||!count(content+thinking))return null;
 const row={index:record.step_index,type,time:timestamp(record.created_at),quantum:timeQuantum(record.created_at),...Object.fromEntries(fields.map(k=>[k,0]))};
 // Explicit step semantics only. A quoted checkpoint or a model name containing
 // "image" cannot create a marker or an image-generation event.
 row.compaction=type==='COMPACTION'||type==='CONTEXT_COMPACTION'||type==='CHECKPOINT'&&/^\s*(?:\[?context (?:summary|compaction)\]?|conversation (?:summary|checkpoint)|checkpoint summary|# Resuming from a compaction|<CONTEXT_SUMMARY>)/i.test(record.content?.prefix||'')?1:0;
 row.image=['GENERATE_IMAGE','IMAGE_GENERATION'].includes(type)?1:0;
 if(type==='USER_INPUT')row.userTokens=content;
 else if(type==='PLANNER_RESPONSE')row.assistantTokens=content+thinking;
 else if(type==='SYSTEM_MESSAGE'||type==='CHECKPOINT'||row.compaction)row.systemTokens=content;
 else if(type==='GENERIC'||type==='TOOL_RESULT'||type==='TOOL_OUTPUT')row.toolTokens=content;
 else row.unknown=content>0||thinking>0;
 return row;
}
function aggregate(entry){
 if(!entry.boundary)return empty('unavailable','invalid-boundary');
 if(entry.error)return empty('unavailable',entry.error);
 if(!entry.state)return empty('loading','reading');
 const s=entry.state,out=empty('partial','reading');let partial=s.invalid,unmatched=false;
 for(const row of s.rows.values()){
  const active=entry.boundary.active[row.index];
  if(!active)continue; // Includes zero steps and records beyond an undo point.
  const typeMatches=active.type===row.type||row.type==='GENERIC'&&genericHostTypes.has(active.type);
  // Logs in the installed App truncate creation times to whole seconds while
  // the RPC uses nanoseconds. Compare at the log's declared precision; never
  // invent an arbitrary time tolerance or call a coarse match fully verified.
  const quantum=Math.max(active.quantum,row.quantum);
  const timeMatches=active.time===null||row.time!==null&&Math.floor(active.time/quantum)===Math.floor(row.time/quantum);
  if(!typeMatches||!timeMatches){unmatched=true;continue;}
  // Missing identity timestamps are a best-effort match, never full coverage.
  if(active.time===null||row.time===null||active.quantum!==row.quantum||active.type!==row.type||row.unknown)partial=true;
  out.matchedSteps++;for(const k of fields)out[k]+=row[k];
  out.compactionMarkers+=row.compaction;out.imageSteps+=row.image;
 }
 out.totalTokens=fields.reduce((n,k)=>n+out[k],0);
 const covered=out.matchedSteps===entry.boundary.active.length;
 if(s.limit){out.reason='row-limit';partial=true;}
 else if(unmatched||!covered){out.reason='unmatched-record';partial=true;}
 else if(s.invalid){out.reason='invalid-record';}
 else if(s.eof&&s.lineStarted){out.reason='incomplete-line';partial=true;}
 else if(s.eof){out.reason=null;}
 out.complete=s.eof&&!s.lineStarted&&!partial&&covered;
 out.status=out.complete?'ready':'partial';
 return safeTranscriptStats(out);
}
const contains=(root,file)=>{const r=relative(root,file);return r!==''&&!r.startsWith('..')&&!isAbsolute(r);};
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const newState=(identity,info)=>({identity,size:info.size,mtime:info.mtimeMs,offset:0,rows:new Map(),decoder:new StringDecoder('utf8'),parser:null,lineStarted:false,invalid:false,eof:false,limit:false,anchors:[]});

export class TranscriptReader {
 constructor({root=transcriptBrainRoot(),maxEntries=8,maxRows=8192,bytesPerPass=2*1024*1024,passMs=100}={}){
  this.root=root;this.maxEntries=count(maxEntries)&&maxEntries>0?Math.min(8,maxEntries):8;
  this.maxRows=count(maxRows)&&maxRows>0?Math.min(8192,maxRows):8192;
  this.bytesPerPass=count(bytesPerPass)?Math.max(65536,Math.min(2*1024*1024,bytesPerPass)):2*1024*1024;
  this.passMs=count(passMs)?Math.max(1,Math.min(100,passMs)):100;
 }
 entries=new Map();generation=0;running=null;
 reset(){this.generation++;this.entries.clear();}
 request(scope,id,raw){
  if(!SCOPE.test(scope||'')||!GUID.test(id||''))return empty('unavailable','invalid-boundary');
  const key=scope+':'+id.toLowerCase(),b=boundary(raw,this.maxRows);
  if(!b)return empty('unavailable','invalid-boundary');
  let entry=this.entries.get(key);
  if(!entry)entry={key,id:id.toLowerCase(),state:null,error:null};
  entry.boundary=b;entry.requested=true;
  this.entries.delete(key);this.entries.set(key,entry);
  while(this.entries.size>this.maxEntries)this.entries.delete(this.entries.keys().next().value);
  this.schedule();return aggregate(entry);
 }
 schedule(){
  if(this.running)return;
  this.running=Promise.resolve().then(async()=>{
   for(;;){const entry=[...this.entries.values()].find(e=>e.requested);if(!entry)break;
    entry.requested=false;const generation=this.generation;
    try{await this.read(entry,()=>generation===this.generation&&this.entries.get(entry.key)===entry);}
    catch{if(generation===this.generation&&this.entries.get(entry.key)===entry)entry.error='io-error';}
   }
  }).finally(()=>{this.running=null;if([...this.entries.values()].some(e=>e.requested))this.schedule();});
 }
 async idle(){while(this.running)await this.running;}
 peek(scope,id){return aggregate(this.entries.get(scope+':'+id.toLowerCase())||{});}
 async locate(id){
  let root;try{root=await realpath(this.root);}catch(e){if(e.code==='ENOENT')return {error:'missing'};throw e;}
  for(const name of ['transcript_full.jsonl','transcript.jsonl']){
   const candidate=join(this.root,id,'.system_generated','logs',name);
   try{
    const file=await realpath(candidate),expected=join(root,id,'.system_generated','logs',name);
    const normalize=p=>process.platform==='win32'?p.toLowerCase():p;
    if(!contains(root,file)||normalize(file)!==normalize(expected))return {error:'unsafe-path'};
    const info=await stat(file);if(!info.isFile())return {error:'unsafe-path'};
    return {file,info};
   }catch(e){if(e.code!=='ENOENT')throw e;}
  }
  return {error:'missing'};
 }
 async read(entry,current){
  const located=await this.locate(entry.id);if(!current())return;
  if(located.error){entry.error=located.error;entry.state=null;return;}
  const {file,info}=located,identity=[file,info.dev,info.ino,info.birthtimeMs].join(':');
  let s=entry.state;const changed=s&&(s.size!==info.size||s.mtime!==info.mtimeMs);
  if(!s||s.identity!==identity||info.size<s.size||info.size<=s.size&&info.mtimeMs!==s.mtime){
   s=entry.state=newState(identity,info);
  }
  entry.error=null;
  const handle=await open(file,'r');
  try{
   const opened=await handle.stat();if(opened.dev!==info.dev||opened.ino!==info.ino){entry.error='io-error';return;}
   // A growing file may have been rewritten rather than appended. Verify the
   // first and most recently consumed chunks without caching their plaintext.
   if(changed){for(const anchor of s.anchors){const bytes=Buffer.alloc(anchor.length);const read=await handle.read(bytes,0,bytes.length,anchor.offset);
    if(read.bytesRead!==bytes.length||digest(bytes)!==anchor.hash){s=entry.state=newState(identity,info);break;}
   }}
   s.size=info.size;s.mtime=info.mtimeMs;if(s.limit)return;
   const buffer=Buffer.alloc(65536),end=Math.min(info.size,s.offset+this.bytesPerPass),deadline=performance.now()+this.passMs;
   while(s.offset<end&&current()){
    const {bytesRead}=await handle.read(buffer,0,Math.min(buffer.length,end-s.offset),s.offset);
    if(!bytesRead)break;
    const anchor={offset:s.offset,length:bytesRead,hash:digest(buffer.subarray(0,bytesRead))};
    if(!s.anchors.length)s.anchors=[anchor];else s.anchors=[s.anchors[0],anchor];s.offset+=bytesRead;
    const text=s.decoder.write(buffer.subarray(0,bytesRead));
    let start=0;
    for(let i=0;i<=text.length;i++){
     if(i!==text.length&&text[i]!=='\n')continue;
     const part=text.slice(start,i);start=i+1;
     if(part.trim().length||s.lineStarted){
      s.lineStarted=true;s.parser??=new TrajectoryJson({projection,maxRetainedBytes:32768});
      if(!s.badLine){try{s.parser.write(part);}catch{s.badLine=true;s.invalid=true;}}
     }
     if(i===text.length)break;
     if(s.lineStarted&&!s.badLine){try{
      const row=summary(s.parser.end());
      if(!row)s.invalid=true;
      else if(!s.rows.has(row.index)&&s.rows.size>=this.maxRows){s.limit=true;break;}
      else s.rows.set(row.index,row); // Last revision of an explicit index wins.
     }catch{s.invalid=true;}}
     s.parser=null;s.lineStarted=false;s.badLine=false;
    }
    await yieldLoop();if(s.limit||performance.now()>=deadline)break;
   }
   if(!current())return;
   s.eof=s.offset===info.size;
  }finally{await handle.close();}
 }
}
