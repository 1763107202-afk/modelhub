/* XiaoSheng Android enhancement bridge: keep upstream scripts and gallery intact. */
(function(){
'use strict';
const people=['lead_wang_xiaomiao','lead_muma','lead_monv','lead_vivi','lead_gangjie'];
const places=[['云栖咖啡馆','☕'],['晚霞广场','🌇'],['海风栈道','🌊'],['城南书店','📚'],['星河公园','🌿'],['湖边观景台','🌙'],['月见车站','🚉'],['晴空花店','🌷']];
const pending=new Map();let serial=0,context=null,positionRoom='',share=null;
function native(){return typeof window.PhoneAI==='object'&&typeof window.PhoneAI.chat==='function'}
window.XiaoBridge={
 finish:function(id,json){const job=pending.get(id);if(!job)return;pending.delete(id);try{const data=JSON.parse(json);if(data.ok)job.resolve(data);else job.reject(new Error(data.error||'AI请求失败'));}catch(e){job.reject(e)}}
};
function request(kind,payload){
 return new Promise((resolve,reject)=>{
  if(!native()){reject(new Error('仅 Android 安装版支持本机 API'));return;}
  const id='req_'+Date.now()+'_'+(++serial);
  pending.set(id,{resolve,reject});
  const timer=setTimeout(()=>{const j=pending.get(id);if(j){pending.delete(id);j.reject(new Error('请求超时'));}},kind==='chat'?45000:85000);
  const obj=pending.get(id);
  obj.resolve=(data)=>{clearTimeout(timer);resolve(data)};
  obj.reject=(error)=>{clearTimeout(timer);reject(error)};
  try{window.PhoneAI[kind](JSON.stringify(payload),id)}catch(e){pending.delete(id);clearTimeout(timer);reject(e)}
 });
}
function notify(text){const t=document.getElementById('toast');if(!t)return;t.textContent=text;t.classList.add('visible');setTimeout(()=>t.classList.remove('visible'),2500);}
function storeAudio(id,base64){
 return new Promise((resolve,reject)=>{
  try{
   const binary=atob(base64),bytes=new Uint8Array(binary.length);
   for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
   const blob=new Blob([bytes],{type:'audio/mpeg'});
   const req=indexedDB.open('xiaosheng-phone-media',1);
   req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains('audio'))req.result.createObjectStore('audio')};
   req.onerror=()=>reject(new Error('无法打开音频存储'));
   req.onsuccess=()=>{
    const db=req.result,tx=db.transaction('audio','readwrite');
    tx.objectStore('audio').put(blob,id);
    tx.oncomplete=()=>{db.close();resolve(blob)};
    tx.onerror=()=>{db.close();reject(new Error('无法保存音频'))};
   };
  }catch(e){reject(e)}
 });
}
function messagesFor(state,id){
 return (state.chatMessages[id]||[]).filter(x=>x.type==='text'&&typeof x.text==='string')
  .slice(-14).map(x=>({role:x.from==='self'?'user':'assistant',content:x.text.slice(0,1000)}));
}
function renderMessage(ctx,id,m){
 try{
  if(ctx.getRoute().app==='room'&&ctx.getRoute().id===id){
   const list=document.querySelector('.wx-chat-scroll[data-room-id="'+id+'"]'),bottom=document.getElementById('wx-chat-bottom');
   if(list&&bottom){
    const el=document.createElement('div');el.className='wx-message-anchor';el.dataset.messageId=m.id;
    el.innerHTML=ctx.renderBubble(m,id);bottom.before(el);list.scrollTop=list.scrollHeight;
   }
  }
  ctx.refreshList();ctx.onIncoming&&ctx.onIncoming(id,m);
 }catch(e){console.warn('UI刷新异常',e)}
}
async function reply(ctx,id,message,fallback){
 if(!native()||!window.PhoneAI.canChat()){fallback();return;}
 const state=ctx.getState(),owner=state;
 const content=messagesFor(state,id);
 if(!content.length||content[content.length-1].role!=='user'){fallback();return;}
 try{
  const result=await request('chat',{characterId:id,messages:content});
  if(ctx.getState()!==owner)return;
  const all=owner.chatMessages[id]||[];
  if(!all.find(x=>x.id===message.id)||all.some(x=>x.autoReply&&x.replyTo&&x.replyTo.includes(message.id)))return;
  const text=String(result.reply||'').trim().slice(0,1000);
  if(!text){fallback();return;}
  const row={id:'enh_'+Date.now()+'_'+(++serial),type:'text',text,from:'other',time:new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',hour12:false}),autoReply:true,replyTo:[message.id],replyOrigin:'deepseek'};
  const mode=Number(window.PhoneAI.mode());
  const count=all.filter(x=>x.autoReply).length;
  if(mode===2||(mode===1&&count%3===2)){
   try{
    if(window.PhoneAI.canTts()&&text.length<=240){
     const audio=await request('tts',{characterId:id,text:text});
     if(ctx.getState()!==owner)return;
     await storeAudio(row.id,audio.audio);
     row.blobKey=row.id;row.duration=Math.max(2,Math.ceil(text.length/4));row.type='voice';
    }
   }catch(e){notify('阿里云语音失败，已发文字回复');}
  }
  if(ctx.getState()!==owner)return;
  if(all.some(x=>x.autoReply&&x.replyTo&&x.replyTo.includes(message.id)))return;
  all.push(row);ctx.save();renderMessage(ctx,id,row);
 }catch(e){notify('DeepSeek 暂不可用，使用离线回复');fallback()}
}
function attach(createName,isWang){
 const original=window[createName]&&window[createName].create;
 if(!original)return;
 window[createName].create=function(ctx){
  context=ctx;
  const runtime=original.call(this,ctx);
  const old=runtime.enqueue.bind(runtime);
  if(isWang)runtime.enqueue=function(m){reply(ctx,people[0],m,()=>old(m))};
  else runtime.enqueue=function(id,m){reply(ctx,id,m,()=>old(id,m))};
  return runtime;
 };
}
attach('WangChatRuntime',true);
attach('PersonaChatRuntime',false);
function addText(id,text,from){
 if(!context)return;
 const s=context.getState();s.chatMessages[id]||=[];
 const row={id:'loc_'+Date.now()+'_'+(++serial),type:'text',from:from||'self',text: text,time:new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',hour12:false}),locationKind:'fictional'};
 s.chatMessages[id].push(row);
 if(row.from==='other')s.chatReadRooms=(s.chatReadRooms||[]).filter(x=>x!==id);
 context.save();renderMessage(context,id,row);
}
function closePos(){document.querySelector('#virtual-location-dialog')?.remove();}
function showPos(room){
 positionRoom=room||positionRoom;
 closePos();
 const modal=document.createElement('div');modal.id='virtual-location-dialog';modal.style.cssText='position:fixed;inset:0;background:#000b;z-index:999999;display:flex;align-items:center;justify-content:center;padding:12px;';
 const panel=document.createElement('div');panel.style.cssText='background:#fff;border-radius:20px;padding:18px;max-width:420px;width:100%;max-height:80vh;overflow:auto;color:#273342;font-size:15px;';
 const title=document.createElement('div');title.style.cssText='font-size:20px;font-weight:700;margin-bottom:8px';title.textContent='发送虚拟位置（非真实 GPS）';panel.append(title);
 const note=document.createElement('p');note.textContent='以下地点全部属于星湾虚构世界，不会读取手机定位。';panel.append(note);
 places.forEach(([name,emoji])=>{
  const b=document.createElement('button');b.type='button';b.textContent=emoji+' '+name+'  →';
  b.style.cssText='display:block;width:100%;border:0;border-bottom:1px solid #eee;text-align:left;padding:12px;background:white;font-size:15px;color:#1b3443;';
  b.onclick=()=>{addText(positionRoom,'📍 [虚拟位置]\n星湾 · '+name+'\n（剧情位置，非真实GPS）');closePos()};
  panel.append(b);
 });
 const shareBtn=document.createElement('button');shareBtn.textContent=share?'结束模拟实时共享':'共享虚拟实时位置（30分钟）';
 shareBtn.style.cssText='width:100%;margin:16px 0;padding:12px;border:0;border-radius:12px;color:white;background:#199b77;';
 shareBtn.onclick=()=>{
  if(share){addText(positionRoom,'🔴 已结束虚拟实时位置共享');share=null;}
  else{share={room:positionRoom,start:Date.now(),end:Date.now()+30*60*1000};addText(positionRoom,'🟢 已开始虚拟实时位置共享（30分钟）\n地图中的位置和轨迹均为模拟');}
  closePos();
 };
 panel.append(shareBtn);
 const close=document.createElement('button');close.textContent='取消';close.style.cssText='width:100%;border:0;padding:12px;background:#f3f5f7;border-radius:12px';close.onclick=closePos;panel.append(close);
 modal.append(panel);modal.addEventListener('click',e=>{if(e.target===modal)closePos()});document.body.append(modal);
}
function maybeProactive(){
 if(!context||!document.querySelector('.wx-tabs'))return;
 const s=context.getState();if(!s||!s.unlocked)return;
 const today=new Date().toLocaleDateString('sv-SE');
 const key='xiaosheng-virtual-location-daily-'+today;
 if(localStorage.getItem(key)==='done')return;
 localStorage.setItem(key,'done');
 people.forEach((id,i)=>{
  const value=[...today+id].reduce((n,c)=>(n*33+c.charCodeAt(0))>>>0,5381);
  if(value%7>2)return;
  const [p]=places.filter((_,k)=>k===value%places.length);
  if(!p)return;addText(id,'📍 [模拟位置] 我在星湾的「'+p[0]+'」逛逛，想和你分享这里的风景～','other');
 });
}
function augment(){
 if(document.querySelector('.wx-extra-panel')&&!document.querySelector('#virtual-place-quick')){
  const parent=document.querySelector('.wx-extra-panel button[data-action="wx-pick-photo"]')?.parentNode;
  if(parent){
   const btn=document.createElement('button');btn.type='button';btn.id='virtual-place-quick';btn.textContent='📍 位置';
   btn.setAttribute('data-action','enh-virtual-place');
   parent.insertBefore(btn,parent.firstChild);
  }
 }
 const profile=document.querySelector('.settings-profile');
 if(profile&&!document.querySelector('#enh-ai-options')){
  const b=document.createElement('div');b.id='enh-ai-options';b.className='list-group';
  b.innerHTML='<button type="button" class="list-row" data-action="enh-ai-config"><span class="row-label">AI 服务配置<small>DeepSeek · 阿里云百炼 · 五位女主音色</small></span><span>›</span></button>'+
  '<div class="list-row"><span class="row-label">虚拟定位（已开启）<small>发送位置、角色主动分享、30分钟模拟共享；真实GPS始终关闭</small></span></div>';
  profile.after(b);
 }
 if(share&&Date.now()>share.end)share=null;
 maybeProactive();
}
document.addEventListener('click',function(e){
 const t=e.target.closest('[data-action="enh-virtual-place"],[data-action="enh-ai-config"]');
 if(!t)return;
 e.stopImmediatePropagation();e.preventDefault();
 if(t.dataset.action==='enh-ai-config')window.PhoneAI?.openSettings();
 if(t.dataset.action==='enh-virtual-place')showPos(document.querySelector('.wx-chat-scroll')?.dataset.roomId);
},true);
new MutationObserver(()=>{if(!augment.busy){augment.busy=true;queueMicrotask(()=>{augment.busy=false;augment()})}}).observe(document.documentElement,{childList:true,subtree:true});
document.addEventListener('DOMContentLoaded',augment);
})();