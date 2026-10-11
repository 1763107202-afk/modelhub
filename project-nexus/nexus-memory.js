'use strict';
// 本地、可测试的项目聊天记忆。所有历史文本只写入当前电脑。
const crypto=require('node:crypto');
const MAX_CONVERSATIONS=12000;
const MAX_TEXT_PER_CONVERSATION=24000;
const MAX_TURNS=300;
const MAX_NOTE=6000;
const sourceId=(obj)=>String(obj?.id||obj?.conversation_id||crypto.createHash('sha256').update(String(obj?.title||'')+':'+String(obj?.create_time||'')).digest('hex'));
const short=(x,n)=>String(x||'').slice(0,n);
function extractExport(items){
 if(!Array.isArray(items))throw Error('导出文件必须包含 conversations 数组');
 if(items.length>MAX_CONVERSATIONS)throw Error('对话数量超过安全上限，请拆分导入');
 return items.map(obj=>{
  const nodes=Object.values(obj?.mapping||{});
  const turns=nodes.map(n=>n?.message).filter(m=>m&&['user','assistant'].includes(m.author?.role))
   .map(m=>{
    const parts=m?.content?.parts||[];
    return {role:m.author.role,text:short(parts.filter(p=>typeof p==='string').join('\n').trim(),4000),time:Number(m.create_time||0)};
   }).filter(m=>m.text).sort((a,b)=>a.time-b.time);
  const full=turns.map(t=>(t.role==='user'?'用户：':'助手：')+t.text).join('\n');
  return {id:sourceId(obj),title:short(obj?.title||'未命名会话',200),
   date:Number(obj?.update_time||obj?.create_time||0),snippet:short(full,MAX_TEXT_PER_CONVERSATION),
   turns:turns.length,projectId:null,suggestionProjectId:null,suggestionScore:0};
 });
}
function keywords(s){return [...new Set((String(s||'').toLowerCase().match(/[\u4e00-\u9fff]{2,}|[a-z0-9_.-]{3,}/g)||[]).filter(t=>t.length<=32))].slice(0,70)}
function propose(conversation,projects){
 const title=String(conversation?.title||'').toLowerCase(),snippet=String(conversation?.snippet||'').toLowerCase();
 let best={id:null,score:0,reason:'未发现可靠关联'};
 for(const p of projects||[]){
  const name=String(p.name||'').trim().toLowerCase();if(!name)continue;
  const fragments=[name,...(Array.isArray(p.aliases)?p.aliases:[])].map(x=>String(x).toLowerCase()).filter(x=>x.length>=2);
  let score=0,reason='';
  for(const f of fragments){
   if(title.includes(f)){score+=90;reason='标题包含项目名称';}
   else if(snippet.includes(f)){score+=32;reason='对话内容出现项目名称';}
  }
  // 单个“桥”“设计”等常见字不自动推断项目。
  if(score>best.score)best={id:p.id,score:Math.min(score,100),reason};
 }
 return best;
}
function mergeHistory(existing,incoming,projects){
 const map=new Map((existing||[]).map(c=>[String(c.id),c]));
 let added=0,updated=0,suggested=0;
 for(const c of incoming){
  const old=map.get(c.id);
  if(old){
   map.set(c.id,{...old,title:c.title,date:c.date,snippet:c.snippet,turns:c.turns});
   updated++;
  }else{
   const guess=propose(c,projects);
   if(guess.score>=65)suggested++;
   map.set(c.id,{...c,suggestionProjectId:guess.score>=65?guess.id:null,suggestionScore:guess.score});
   added++;
  }
 }
 return {rows:[...map.values()].sort((a,b)=>b.date-a.date),added,updated,suggested};
}
function textScore(text,q){
 const xs=keywords(q);if(!xs.length)return 1;
 const s=String(text||'').toLowerCase();
 return xs.reduce((n,x)=>n+(s.includes(x)?Math.min(8,x.length):0),0);
}
function chooseMemory(history,projectId,question,max=6500){
 if(!projectId)return [];
 const items=(history||[]).filter(h=>h.projectId===projectId);
 return items.map(h=>({h,score:textScore(h.title,question)*3+textScore(h.snippet,question)}))
   .sort((a,b)=>b.score-a.score||Number(b.h.date||0)-Number(a.h.date||0))
   .slice(0,8).map(x=>x.h).reduce((r,h)=>{
    const used=r.reduce((n,x)=>n+x.text.length,0);
    if(used>=max)return r;
    const body=short(h.snippet,Math.min(1200,max-used-30));
    r.push({id:h.id,title:h.title,text:'【历史项目记录：'+h.title+'】\n'+body});
    return r;
   },[]);
}
function projectBucket(projectId){return String(projectId||'general')}
function getTurns(store,projectId){return (store?.[projectBucket(projectId)]||[]).slice(-MAX_TURNS)}
function addTurn(store,projectId,role,text){
 if(!['user','assistant'].includes(role))throw Error('无效的聊天角色');
 const key=projectBucket(projectId),out={...(store||{})};
 out[key]=[...(out[key]||[]),{id:crypto.randomUUID(),role,text:short(text,6000),time:new Date().toISOString()}].slice(-MAX_TURNS);
 return out;
}
function contextForProject({projectId,question='',turns=[],notes={},history=[],includeHistory=false}){
 const userNotes=short(notes?.[projectBucket(projectId)]||'',MAX_NOTE);
 const selected=includeHistory?chooseMemory(history,projectId,question):[];
 const messages=(turns||[]).filter(t=>['user','assistant'].includes(t.role)).slice(-12)
   .map(t=>({role:t.role,content:short(t.text,1600)}));
 const memory=['请以简体中文回答。区分事实、推测和待验证任务。不得把讨论过的工作等同于已验收。',
  projectId?'当前仅使用所选项目的长期记忆，禁止混用其他工程。':'当前未选择项目，使用通用聊天，不读取任何工程记忆。',
  userNotes?'【用户确认的长期项目笔记】\n'+userNotes:'',
  ...selected.map(x=>x.text)].filter(Boolean).join('\n\n');
 return {system:short(memory,11500),messages,historyHits:selected.length};
}
module.exports={extractExport,propose,mergeHistory,chooseMemory,projectBucket,getTurns,addTurn,contextForProject,MAX_TEXT_PER_CONVERSATION};
