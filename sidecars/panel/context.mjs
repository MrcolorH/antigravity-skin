// The current request's host-reported capacity is the occupancy denominator.
// Provider specifications are separately sourced references, never overrides.
const count=value=>(typeof value==='number'||typeof value==='string'&&/^\d+$/.test(value))&&Number.isSafeInteger(Number(value))&&Number(value)>=0?Number(value):null;
const aliases=new Map([
 ['model_placeholder_m318','Gemini 3.8 Flash (High)'],
 ['model_placeholder_m319','Gemini 3.8 Flash (Medium)'],
 ['model_placeholder_m320','Gemini 3.8 Flash (Low)'],
 ['model_placeholder_m35','Claude Sonnet 4.6 (Thinking)'],
 ['model_placeholder_m26','Claude Opus 4.6 (Thinking)'],
 ['model_openai_gpt_oss_120b_medium','GPT-OSS 120B (Medium)'],
]);
// Placeholder aliases above were checked against the installed host's model
// catalog on 2026-10-14. Unknown placeholders stay unknown, not a family guess.
function identify(model){
 if(typeof model!=='string')return null;
 let name=model.replace(/[\x00-\x1f\x7f\u202a-\u202e\u2066-\u2069]/g,'').trim().slice(0,256);
 if(!name)return null;name=aliases.get(name.toLowerCase())||name;
 const normalized=name.toLowerCase().replace(/(\d)[._-](\d)/g,'$1.$2').replace(/[\s()_]+/g,'-').replace(/-+$/,'');
 let match=normalized.match(/^gemini-3\.8-flash(?:-(n|high|medium|low))?$/);
 if(match)return {key:'gemini-3.8-flash',display:'Gemini 3.8 Flash'+(match[1]&&match[1]!=='n'?` (${match[1][0].toUpperCase()+match[1].slice(1)})`:'')};
 match=normalized.match(/^claude-(sonnet|opus)-(4\.6|5\.5)(?:-(thinking|high|medium|low))?(?:-\d{8})?$/);
 if(match)return {key:`claude-${match[1]}-${match[2]}`,display:`Claude ${match[1][0].toUpperCase()+match[1].slice(1)} ${match[2]}`+(match[3]?` (${match[3][0].toUpperCase()+match[3].slice(1)})`:'')};
 match=normalized.match(/^gpt-oss-120b(?:-(high|medium|low))?$/);
 if(match)return {key:'gpt-oss-120b',display:'GPT-OSS 120B'+(match[1]?` (${match[1][0].toUpperCase()+match[1].slice(1)})`:'')};
 return {key:null,display:name};
}
export function formatModelName(model){return identify(model)?.display||null;}
export function modelContextReference(model){
 const key=identify(model)?.key;
 if(key==='gemini-3.8-flash')return {tokens:1048576,label:'1,048,576',kind:'provider-input-limit',source:'https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash',checkedAt:'2026-10-14'};
 if(key==='gpt-oss-120b')return {tokens:131072,label:'131,072',kind:'provider-context-window',source:'https://developers.openai.com/api/docs/models/gpt-oss-120b',checkedAt:'2026-10-14'};
 if(/^claude-(sonnet|opus)-(4\.6|5\.5)$/.test(key||''))return {tokens:null,label:'1M',kind:'provider-context-window',source:`https://platform.claude.com/docs/en/models/${key.slice(7).replace('.', '-')}/overview`,checkedAt:'2026-10-14'};
 // Claude's inspected pages state "1M"; preserve that label rather than
 // inventing a precise 1,048,576-token limit or applying it to this host.
 return null;
}
export function modelContextCapacity(model){return modelContextReference(model)?.tokens??null;}
export function modelCompressionLimit(_model){
 // The inspected host schema has no compaction-threshold field. Neither the
 // provider's capacity nor the host's maxContextTokens proves a trigger value.
 return null;
}
export function contextMetrics(metadata,{model=null,sampledAt=null}={}){
 if(!metadata||typeof metadata!=='object'||Array.isArray(metadata))return null;
 const usedTokens=count(metadata.estimatedTokensUsed),rawMax=count(metadata.maxContextTokens);
 if(usedTokens===null)return null;
 const maxTokens=rawMax>0?rawMax:null,reference=modelContextReference(model);
 return {
  usedTokens,maxTokens,remainingTokens:maxTokens===null?null:Math.max(0,maxTokens-usedTokens),
  usedFraction:maxTokens===null?null:usedTokens/maxTokens,
  remainingFraction:maxTokens===null?null:Math.max(0,1-usedTokens/maxTokens),
  capacitySource:maxTokens===null?null:'host-reported',
  providerMaxTokens:reference?.tokens??null,providerCapacityLabel:reference?.label??null,
  providerCapacitySource:reference?.source??null,providerCapacityKind:reference?.kind??null,
  providerCapacityCheckedAt:reference?.checkedAt??null,
  compressionLimit:null,compressionFraction:null,compressionSource:null,
  model:formatModelName(model),
  sampledAt:typeof sampledAt==='string'&&Number.isFinite(Date.parse(sampledAt))?new Date(sampledAt).toISOString():null,
  source:'Antigravity context window metadata',estimated:true,
 };
}
export function safeContext(value){
 if(!value||typeof value!=='object'||Array.isArray(value))return null;
 // Recalculate all derived fields and provider references. Never trust ratios,
 // arbitrary source URLs, unsupported limits or additional saved properties.
 return contextMetrics({estimatedTokensUsed:value.usedTokens,maxContextTokens:value.maxTokens},{model:value.model,sampledAt:value.sampledAt});
}
