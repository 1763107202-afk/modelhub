/* UX43: progress submission review and session-scoped drafts.
   No credentials, file contents, or server writes are stored by this module. */
(function(){
"use strict";
const SCHEMA=1, MAX_AGE=72*3600*1000;
const FIELD_IDS={
 personal:["progressProject","progressCurrent","progressGoal","progressLink"],
 team:["teamProject","teamCompetitionName","teamCurrentProgress","teamNextGoal","teamProgressLink"]
};
let userId="",initialized=false,timeout=null;
const el=id=>document.getElementById(id);
const key=()=> "justLab:progress-draft:v"+SCHEMA+":"+userId;
function storeGet(){
 try{const raw=sessionStorage.getItem(key());if(!raw)return {};
  const value=JSON.parse(raw);
  if(!value||value.schema!==SCHEMA||Date.now()-value.at>MAX_AGE){sessionStorage.removeItem(key());return {}}
  return value.drafts||{};
 }catch(_){return {}}
}
function storePut(drafts){
 try{if(Object.keys(drafts).length)sessionStorage.setItem(key(),JSON.stringify({schema:SCHEMA,at:Date.now(),drafts}));
 else sessionStorage.removeItem(key());return true}catch(_){return false}
}
function fields(kind){return (FIELD_IDS[kind]||[]).map(el).filter(Boolean)}
function capture(kind){
 const result={};
 for(const field of fields(kind))result[field.id]=field.value;
 return result;
}
function hasData(obj){return Object.values(obj||{}).some(v=>String(v||"").trim().length)}
function status(kind,message){
 const out=el(kind==="personal"?"progressDraftStatusPersonal":"progressDraftStatusTeam");
 if(out)out.textContent=message;
}
function save(){
 if(!userId)return;
 const drafts=storeGet();
 for(const kind of ["personal","team"]){const current=capture(kind);if(hasData(current))drafts[kind]=current;else delete drafts[kind]}
 if(storePut(drafts)){
  for(const kind of ["personal","team"])status(kind,drafts[kind]?"已在本标签页暂存 · 附件和成员选择不会保留":"尚无草稿");
 }else for(const kind of ["personal","team"])status(kind,"浏览器禁止暂存，请及时提交");
}
function schedule(){clearTimeout(timeout);timeout=setTimeout(save,450)}
function clear(kind){
 if(!userId||!FIELD_IDS[kind])return;
 const drafts=storeGet();delete drafts[kind];storePut(drafts);
 status(kind,"已提交，暂存草稿已清除");
}
function escapeReview(){const modal=el("progressUx43Review");if(modal?.open)modal.close("cancel")}
function describe(kind){
 const map=kind==="personal"?
  [["项目","progressProject"],["近期进度","progressCurrent"],["下期目标","progressGoal"],["关联链接","progressLink"]]:
  [["已有项目","teamProject"],["比赛 / 项目","teamCompetitionName"],["队伍进度","teamCurrentProgress"],["下期目标","teamNextGoal"],["关联链接","teamProgressLink"]];
 return map.map(([label,id])=>{
   const field=el(id);
   let value=field?.value?.trim()||"";
   if(field?.tagName==="SELECT")value=field.selectedOptions[0]?.textContent?.trim()||value;
   return [label,value||"（未填写）"];
 });
}
function review(kind){
 const dlg=el("progressUx43Review");
 const body=el("progressUx43ReviewFields");
 if(!dlg||!body||dlg.open)return Promise.resolve(false);
 body.replaceChildren();
 for(const [label,value] of describe(kind)){
  const row=document.createElement("div");row.className="progressReviewRow";
  const name=document.createElement("strong");name.textContent=label;
  const detail=document.createElement("p");detail.textContent=value;
  row.append(name,detail);body.append(row);
 }
 if(kind==="team"){
  const row=document.createElement("div");row.className="progressReviewRow";
  const name=document.createElement("strong");name.textContent="本次队伍成员";
  const detail=document.createElement("p");detail.textContent=el("teamSelectedPreview")?.textContent?.trim()||"请回到表单检查成员";
  row.append(name,detail);body.append(row);
 }
 const file=el(kind==="personal"?"progressFile":"teamProgressFile")?.files?.[0];
 const row=document.createElement("div");row.className="progressReviewRow";
 const title=document.createElement("strong");title.textContent="附件";
 const val=document.createElement("p");val.textContent=file?file.name+"（"+(file.size/1024/1024).toFixed(2)+" MB）":"未选择附件";
 row.append(title,val);body.append(row);
 el("progressUx43ReviewTitle").textContent=kind==="personal"?"核对个人进度":"核对队伍进度";
 return new Promise(resolve=>{
  const accept=el("progressUx43Approve"),cancel=el("progressUx43Cancel");
  let done=false;
  function finish(ok){if(done)return;done=true;accept.removeEventListener("click",approve);cancel.removeEventListener("click",reject);dlg.removeEventListener("close",onClose);if(dlg.open)dlg.close(ok?"approved":"cancel");resolve(ok)}
  function approve(){finish(true)}
  function reject(){finish(false)}
  function onClose(){finish(false)}
  accept.addEventListener("click",approve);cancel.addEventListener("click",reject);dlg.addEventListener("close",onClose);
  dlg.showModal();
 });
}
function init(id){
 if(!id)return;
 const nextId=String(id);
 if(initialized&&userId===nextId)return;
 userId=nextId;
 const drafts=storeGet();
 for(const kind of ["personal","team"]){
  const data=drafts[kind];
  if(data){
   for(const field of fields(kind)){
    if(Object.prototype.hasOwnProperty.call(data,field.id)){
     if(field.tagName==="SELECT"&&![...field.options].some(x=>x.value===data[field.id]))continue;
     field.value=data[field.id];
     if(field.tagName==="SELECT")field.dispatchEvent(new Event("change",{bubbles:true}));
    }
   }
   status(kind,"已恢复本标签页草稿 · 请重新选择附件及核对队伍成员");
  }else status(kind,"输入内容将暂存于本标签页，不上传云端");
 }
 if(initialized)return;
 initialized=true;
 for(const kind of ["personal","team"]){
  for(const field of fields(kind)){field.addEventListener("input",schedule);field.addEventListener("change",schedule)}
  el(kind==="personal"?"progressForm":"teamProgressForm")?.addEventListener("submit",()=>clearTimeout(timeout));
  const btn=el(kind==="personal"?"progressDraftClearPersonal":"progressDraftClearTeam");
  btn?.addEventListener("click",()=>{
   if(!window.confirm("清空"+(kind==="personal"?"个人":"队伍")+"表单中当前填写的文字和本标签页暂存草稿？附件不会被上传。"))return;
   for(const field of fields(kind)){
    if(field.tagName==="SELECT"){field.selectedIndex=0;field.dispatchEvent(new Event("change",{bubbles:true}))}
    else field.value="";
   }
   const drafts=storeGet();delete drafts[kind];storePut(drafts);
   status(kind,"草稿已清空");
  });
 }
 window.addEventListener("pagehide",()=>{clearTimeout(timeout);save()});
 for(const kind of ["personal","team"]){
  const file=el(kind==="personal"?"progressFile":"teamProgressFile");
  file?.addEventListener("change",()=>{
   const output=el(kind==="personal"?"progressAttachmentNotePersonal":"progressAttachmentNoteTeam");
   if(output)output.textContent=file.files?.length?"附件已选择；刷新页面后需要重新选择，提交时才上传。":"未选择附件 · 草稿不包含附件";
  });
 }
}
window.JUSTProgressUX43={init,clear,review};
})();
