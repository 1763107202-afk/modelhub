/* UX45: accessible team project picker. No persistence, auth or mutation logic here. */
(function(){
"use strict";
const byId=id=>document.getElementById(id);
const state={items:[],current:"",filter:"joined",query:"",loading:true,error:""};
const dialog=()=>byId("teamProjectPickerDialog");
const escape=val=>String(val??"");
function eligible(p){
 return p.joined||!["completed","archived"].includes(p.status);
}
function chosen(){return byId("teamProject")?.value||""}
function summary(){
 const select=byId("teamProject"),button=byId("teamProjectPickerOpen"),label=byId("teamProjectPickerCurrent");
 if(!select||!button||!label)return;
 const item=state.items.find(x=>x.id===select.value);
 label.textContent=item?item.name:"不关联已有项目，按比赛 / 队伍填写";
 button.disabled=state.loading;
 button.setAttribute("aria-label","选择关联团队项目，当前："+label.textContent);
}
function draw(){
 const area=byId("teamProjectPickerList"),status=byId("teamProjectPickerStatus");
 if(!area||!status)return;
 area.replaceChildren();
 if(state.loading){status.textContent="正在加载团队项目…";return}
 if(state.error){status.textContent="项目读取失败："+state.error+"；可关闭后使用刷新项目重试。";return}
 const eligibleItems=state.items.filter(x=>state.filter==="joined"?x.joined:state.filter==="available"?!x.joined&&eligible(x):!eligible(x));
 const query=state.query.trim().toLocaleLowerCase();
 const matches=eligibleItems.filter(x=>(x.name+" "+x.leaderName+" "+x.typeName).toLocaleLowerCase().includes(query));
 status.textContent=matches.length+" 个"+(state.filter==="joined"?"我已加入的":state.filter==="available"?"可加入的":"已结束的")+"团队项目";
 const make=(title,desc,id,mode,disabled=false)=>{
  const button=document.createElement("button");button.type="button";button.className="teamPickerItem";button.disabled=disabled;
  button.dataset.projectId=id;
  const left=document.createElement("span");left.className="teamPickerText";
  const heading=document.createElement("strong");heading.textContent=title;
  const detail=document.createElement("small");detail.textContent=desc;
  left.append(heading,detail);
  const tag=document.createElement("span");tag.className="teamPickerIndicator";tag.textContent=mode;
  button.append(left,tag);
  button.addEventListener("click",()=>{
   const select=byId("teamProject");
   if(!select||select.disabled)return;
   dialog()?.close();
   if(select.value===id){summary();return}
   select.value=id;
   select.dispatchEvent(new Event("change",{bubbles:true}));
   summary();
  });
  return button;
 };
 if(state.filter==="joined"&&!query){
  area.append(make("不关联项目，手动填写","不会改变你已填写的进度内容","",chosen()===""?"当前":"选择"));
 }
 if(!matches.length){
  const empty=document.createElement("p");empty.className="teamPickerEmpty";
  empty.textContent=state.items.length===0?"暂无团队项目，可前往项目管理创建。":query?"没有匹配的项目，请修改关键词。":"这一分类暂无项目。";
  area.append(empty);
 }else{
  matches.forEach(x=>area.append(make(x.name,escape(x.leaderName||"未设置负责人")+" · "+escape(x.statusName||"进行中")+" · "+x.memberCount+" 位成员",x.id,!eligible(x)?"已结束":chosen()===x.id?"当前":x.joined?"关联":"申请加入",!eligible(x))));
 }
}
function open(){
 const dlg=dialog();
 if(!dlg||state.loading)return;
 state.filter="joined";state.query="";
 const tabs=byId("teamProjectPickerTabs");
 tabs?.querySelectorAll("[data-filter]").forEach(btn=>{
  const selected=btn.dataset.filter===state.filter;
  btn.classList.toggle("is-active",selected);
  btn.setAttribute("aria-selected",String(selected));
 });
 const search=byId("teamProjectPickerSearch");if(search)search.value="";
 draw();
 if(!dlg.open)dlg.showModal();
 if(search)search.focus({preventScroll:true});
}
function init(){
 const select=byId("teamProject"),button=byId("teamProjectPickerOpen"),dlg=dialog();
 if(!select||!button||!dlg)return;
 select.hidden=true;select.setAttribute("aria-hidden","true");select.tabIndex=-1;
 button.hidden=false;button.addEventListener("click",open);
 byId("teamProjectPickerClose")?.addEventListener("click",()=>dlg.close());
 byId("teamProjectPickerSearch")?.addEventListener("input",event=>{state.query=event.target.value;draw()});
 byId("teamProjectPickerTabs")?.querySelectorAll("[data-filter]").forEach(btn=>btn.addEventListener("click",()=>{
  state.filter=btn.dataset.filter;
  byId("teamProjectPickerTabs").querySelectorAll("[data-filter]").forEach(x=>{const active=x===btn;x.classList.toggle("is-active",active);x.setAttribute("aria-selected",String(active))});
  draw();
 }));
 dlg.addEventListener("click",event=>{if(event.target===dlg)dlg.close()});
 summary();
}
function setProjects(rows,userid){
 state.loading=false;state.error="";
 state.items=(rows||[]).filter(x=>x.project_mode==="team").map(x=>({
  id:String(x.id),name:String(x.name||"未命名项目"),
  status:String(x.status||"active"),statusName:({active:"进行中",paused:"暂停",completed:"已完成",archived:"已归档"})[x.status]||"进行中",
  joined:Array.isArray(x.member_ids)&&x.member_ids.includes(userid),
  memberCount:Array.isArray(x.member_ids)?x.member_ids.length:0,
  leaderName:String(x.leader_name||""),typeName:String(x.project_type||"")
 }));
 summary();draw();
}
function setLoading(message){
 state.loading=true;state.error="";summary();
 const label=byId("teamProjectPickerCurrent");if(label)label.textContent=message||"正在读取项目…";
 draw();
}
function setError(message){
 state.loading=false;state.error=String(message||"未知错误");summary();draw();
}
window.JUSTTeamProjectPicker={setProjects,setLoading,setError,sync:summary};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();