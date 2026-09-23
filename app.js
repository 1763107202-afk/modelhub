import {createClient} from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
const supabase=createClient("https://yodtphuzgngxpihnfwop.supabase.co","sb_publishable_VHuHgObgmWWdY8PBl65OeQ_T7prL9wX");
const page=document.body.dataset.page||"home";
const q=s=>document.querySelector(s);
const state={user:null,profile:null};
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fmt=v=>v?new Date(v).toLocaleString("zh-CN",{hour12:false}):"未设置";
const safe=n=>n.replace(/[^\w.\-\u4e00-\u9fff]/g,"_");
function toast(m){const t=q("#toast");if(!t)return;t.textContent=m;t.classList.add("on");setTimeout(()=>t.classList.remove("on"),2500)}
function isAdmin(){return ["admin","super_admin"].includes(state.profile?.role)}
function roleName(r){return r==="super_admin"?"主管理员":r==="admin"?"副管理员":"普通成员"}
function navLink(key,href,label){return '<a class="'+(page===key?"active":"")+'" href="'+href+'">'+label+'</a>'}
function renderChrome(){
  q("#siteHeader").innerHTML='<header class="siteHeader"><div class="wrap headerInner"><a class="brand" href="./index.html"><img src="./lab-logo.svg?v=13" alt="实验室标志"><span class="brandText"><b>江苏科技大学机械创新实验室</b><small>ModelHub · 建模学习与作业平台</small></span></a><nav class="nav">'+
    navLink("lab","./lab.html","实验室")+navLink("works","./works.html","往届作品")+'<span class="navSep"></span>'+
    navLink("exams","./exams.html","试卷任务")+navLink("tutorials","./tutorials.html","教程")+'<span class="navSep"></span>'+
    navLink("submit","./submit.html","提交作业")+navLink("mine","./mine.html","我的提交")+navLink("profile","./profile.html","个人资料")+
    '<span class="navSep adminSep hidden"></span><a id="adminNav" class="'+(page==="admin"?"active ":"")+'hidden" href="./admin.html">管理后台</a></nav><div class="acct"><span id="badge" class="pill hidden"></span><button id="authOpen" class="btn ghost">登录 / 注册</button><button id="logout" class="btn ghost hidden">退出</button></div></div></header>';
  q("#siteFooter").innerHTML='<footer class="foot"><div class="wrap footInner"><img src="./lab-logo.svg?v=13" alt="实验室标志"><div><b>江苏科技大学机械创新实验室</b><small>ModelHub · 独立模块化学习平台</small></div></div></footer>';
  document.body.insertAdjacentHTML("beforeend",'<dialog id="auth" class="dialog"><div class="dialogbox"><h2 style="margin:0">登录 / 注册</h2><p style="margin:0;color:#8fa4bd">登录只需邮箱和密码；注册需填写姓名、专业并通过实验室通行证。</p><div class="two"><label>姓名（注册必填）<input id="regName" maxlength="40" autocomplete="name" placeholder="请输入真实姓名"></label><label>专业（注册必填）<input id="regMajor" maxlength="60" placeholder="例如：机械工程"></label></div><label>邮箱<input id="email" type="email" autocomplete="email"></label><label>密码<input id="password" type="password" minlength="6" autocomplete="current-password"></label><div class="actions"><button id="login" class="btn pri" type="button">登录</button><button id="register" class="btn sec" type="button">注册</button><button id="closeAuth" class="btn ghost" type="button">关闭</button></div><small id="authMsg" style="color:#8fa4bd"></small></div></dialog><dialog id="passAuth" class="dialog"><div class="dialogbox"><span class="eyebrow">LAB ACCESS</span><h2 style="margin:0">实验室通行证验证</h2><p style="margin:0;color:#8fa4bd">验证正确后账号直接创建。</p><label>实验室通行证<input id="passcodeConfirm" type="password" autocomplete="off"></label><div class="actions"><button id="confirmPasscode" class="btn pri" type="button">验证并注册</button><button id="cancelPasscode" class="btn ghost" type="button">返回</button></div><small id="passMsg" style="color:#8fa4bd"></small></div></dialog><div id="toast" class="toast"></div>');
  bindAuth();
}
function updateAuthUI(){
  const on=!!state.user;
  q("#authOpen").classList.toggle("hidden",on);q("#logout").classList.toggle("hidden",!on);q("#badge").classList.toggle("hidden",!on);
  const who=state.profile?.full_name||state.user?.email||"";
  q("#badge").textContent=on?who+(state.profile?.major?" · "+state.profile.major:"")+(isAdmin()?" · "+roleName(state.profile.role):""):"";
  q("#adminNav").classList.toggle("hidden",!isAdmin());document.querySelectorAll(".adminSep").forEach(x=>x.classList.toggle("hidden",!isAdmin()));
}
function bindAuth(){
  q("#authOpen").onclick=()=>q("#auth").showModal();q("#closeAuth").onclick=()=>q("#auth").close();q("#logout").onclick=()=>supabase.auth.signOut();
  q("#login").onclick=async()=>{const r=await supabase.auth.signInWithPassword({email:q("#email").value.trim(),password:q("#password").value});q("#authMsg").textContent=r.error?r.error.message:"登录成功";if(!r.error)q("#auth").close()};
  q("#register").onclick=()=>{const n=q("#regName").value.trim(),m=q("#regMajor").value.trim(),e=q("#email").value.trim(),p=q("#password").value;if(!n)return q("#authMsg").textContent="请填写姓名";if(!m)return q("#authMsg").textContent="请填写专业";if(!e||p.length<6)return q("#authMsg").textContent="请输入有效邮箱，密码至少 6 位";q("#authMsg").textContent="";q("#passMsg").textContent="";q("#passcodeConfirm").value="";q("#auth").close();q("#passAuth").showModal()};
  q("#cancelPasscode").onclick=()=>{q("#passAuth").close();q("#auth").showModal()};
  q("#confirmPasscode").onclick=async()=>{const full_name=q("#regName").value.trim(),major=q("#regMajor").value.trim(),email=q("#email").value.trim(),password=q("#password").value,lab_passcode=q("#passcodeConfirm").value.trim();if(!lab_passcode)return q("#passMsg").textContent="请输入实验室通行证";q("#passMsg").textContent="正在验证并注册…";const r=await supabase.auth.signUp({email,password,options:{data:{lab_passcode,full_name,major}}});if(r.error){q("#passMsg").textContent=/Database error|unexpected_failure/i.test(r.error.message||"")?"通行证不正确或注册失败":r.error.message;return}if(r.data.session){q("#passMsg").textContent="注册成功，已自动登录";setTimeout(()=>q("#passAuth").close(),400);return}const s=await supabase.auth.signInWithPassword({email,password});q("#passMsg").textContent=s.error?s.error.message:"注册成功，已自动登录";if(!s.error)setTimeout(()=>q("#passAuth").close(),400)};
}
async function loadProfile(){
  if(!state.user){state.profile=null;return}
  const r=await supabase.from("profiles").select("id,email,role,full_name,major,phone,qq,created_at").eq("id",state.user.id).maybeSingle();
  state.profile=r.data||null;
}
function requireLogin(box="#pageGate"){
  if(state.user)return true;
  const el=q(box);if(el)el.innerHTML='<div class="notice">此页面需要登录后使用。 <button id="gateLogin" class="btn sec" type="button">立即登录</button></div>';
  setTimeout(()=>{const b=q("#gateLogin");if(b)b.onclick=()=>q("#auth").showModal()},0);return false;
}
function embed(u){
  if(!u)return '<div style="font-size:44px;color:#3a5677">▶</div>';
  const y=u.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{6,})/);if(y)return '<iframe src="https://www.youtube.com/embed/'+esc(y[1])+'" allowfullscreen></iframe>';
  if(/\.(mp4|webm|ogg|mov|m4v)(\?|$)/i.test(u))return '<video controls preload="metadata" src="'+esc(u)+'"></video>';
  return '<a class="btn sec" target="_blank" rel="noopener" href="'+esc(u)+'">打开视频</a>';
}
function resourceTypeName(t){return t==="pdf"?"PDF 文档":t==="word"?"Word 文档":"视频教程"}
function resourcePreview(x){
  const type=x.resource_type||"video",url=x.video_url||"";
  if(type==="video")return embed(url);
  const icon=type==="pdf"?"PDF":"DOCX";
  const hint=type==="pdf"?"点击下方按钮在线查看或下载 PDF":"点击下方按钮打开或下载 Word 文档";
  return '<div class="docPreview"><div class="docIcon '+esc(type)+'">'+icon+'</div><strong>'+esc(x.file_name||resourceTypeName(type))+'</strong><span>'+hint+'</span></div>';
}
async function initHome(){
  const [e,v,w]=await Promise.all([supabase.from("exams").select("id"),supabase.from("tutorials").select("id"),supabase.from("past_works").select("id")]);
  q("#homeExams").textContent=(e.data||[]).length;q("#homeVideos").textContent=(v.data||[]).length;q("#homeWorks").textContent=(w.data||[]).length;
  if(state.user){const m=await supabase.from("submissions").select("id").eq("user_id",state.user.id);q("#homeMine").textContent=(m.data||[]).length}else q("#homeMine").textContent="—";
}
async function initWorks(){
  const r=await supabase.from("past_works").select("*").order("year",{ascending:false}).order("created_at",{ascending:false});const data=r.data||[];
  q("#worksGrid").innerHTML=data.map(x=>'<article class="workCard"><div class="workCover">'+(x.cover_url?'<img src="'+esc(x.cover_url)+'" alt="'+esc(x.title)+'">':'<div class="workFallback">⚙</div>')+'</div><div class="workBody"><div class="workTop"><h3>'+esc(x.title)+'</h3>'+(x.year?'<span class="workYear">'+esc(x.year)+' 届</span>':'')+'</div><div class="workMeta">'+esc(x.team_name||"机械创新实验室")+'</div><p>'+esc(x.description||"暂无作品简介")+'</p><div class="actions">'+(x.detail_url?'<a class="btn sec" target="_blank" rel="noopener" href="'+esc(x.detail_url)+'">查看详情</a>':'')+(isAdmin()?'<button class="btn danger delWork" data-id="'+esc(x.id)+'" data-path="'+esc(x.storage_path||"")+'">删除作品</button>':'')+'</div></div></article>').join("");
  q("#worksEmpty").classList.toggle("hidden",data.length>0);
  document.querySelectorAll(".delWork").forEach(b=>b.onclick=async()=>{if(!confirm("确定删除这个作品吗？"))return;if(b.dataset.path){const rm=await supabase.storage.from("works").remove([b.dataset.path]);if(rm.error)return toast(rm.error.message)}const d=await supabase.from("past_works").delete().eq("id",b.dataset.id);if(d.error)return toast(d.error.message);toast("作品已删除");await initWorks()});
}
async function initExams(){
  const r=await supabase.from("exams").select("*").order("created_at",{ascending:false});const data=r.data||[];
  q("#examGrid").innerHTML=data.map(x=>'<article class="card"><span class="tag">PDF 试卷 / 任务</span><h3>'+esc(x.title)+'</h3><p>'+esc(x.description||"暂无说明")+'</p><div class="meta">截止：'+fmt(x.deadline)+'</div><div class="actions"><a class="btn sec" target="_blank" rel="noopener" href="'+esc(x.file_url)+'">查看 / 下载 PDF</a>'+(isAdmin()?'<button class="btn danger delExam" data-id="'+esc(x.id)+'" data-path="'+esc(x.storage_path||"")+'">删除</button>':'')+'</div></article>').join("");
  q("#examEmpty").classList.toggle("hidden",data.length>0);
  document.querySelectorAll(".delExam").forEach(b=>b.onclick=async()=>{if(!confirm("确定删除该试卷及关联提交吗？"))return;const rel=await supabase.from("submissions").select("storage_path").eq("exam_id",b.dataset.id);if(rel.error)return toast(rel.error.message);const paths=(rel.data||[]).map(x=>x.storage_path).filter(Boolean);if(paths.length){const rm=await supabase.storage.from("submissions").remove(paths);if(rm.error)return toast(rm.error.message);await supabase.from("submissions").delete().eq("exam_id",b.dataset.id)}if(b.dataset.path){const rm2=await supabase.storage.from("exams").remove([b.dataset.path]);if(rm2.error)return toast(rm2.error.message)}const d=await supabase.from("exams").delete().eq("id",b.dataset.id);if(d.error)return toast(d.error.message);toast("试卷已删除");await initExams()});
}
async function initTutorials(){
  const r=await supabase.from("tutorials").select("*").order("created_at",{ascending:false});const data=r.data||[];
  q("#videoGrid").innerHTML=data.map(x=>{const type=x.resource_type||"video",url=x.video_url||"",action=type==="video"?"打开 / 播放视频":type==="pdf"?"查看 / 下载 PDF":"打开 / 下载 Word";return '<article class="video"><div class="frame '+(type!=="video"?"docFrame":"")+'">'+resourcePreview(x)+'</div><div class="info"><span class="resourceType">'+resourceTypeName(type)+'</span><h3>'+esc(x.title)+'</h3><p style="color:#8fa4bd">'+esc(x.description||"暂无简介")+'</p><div class="actions">'+(type==="video"&&!/^https?:/i.test(url)?"":'<a class="btn sec" target="_blank" rel="noopener" href="'+esc(url)+'">'+action+'</a>')+(isAdmin()?'<button class="btn danger delTutorial" data-id="'+esc(x.id)+'" data-url="'+esc(url)+'" data-path="'+esc(x.storage_path||"")+'">删除教程</button>':'')+'</div></div></article>'}).join("");
  q("#videoEmpty").classList.toggle("hidden",data.length>0);
  document.querySelectorAll(".delTutorial").forEach(b=>b.onclick=async()=>{if(!confirm("确定删除这个教程资料吗？"))return;let p=b.dataset.path||"";if(!p){const u=b.dataset.url||"",key="/storage/v1/object/public/tutorials/";if(u.includes(key)){try{p=decodeURIComponent(u.split(key)[1].split("?")[0])}catch(_e){}}}if(p){const rm=await supabase.storage.from("tutorials").remove([p]);if(rm.error)return toast(rm.error.message)}const d=await supabase.from("tutorials").delete().eq("id",b.dataset.id);if(d.error)return toast(d.error.message);toast("教程资料已删除");await initTutorials()});
}
async function initSubmit(){
  if(!requireLogin())return;
  const e=await supabase.from("exams").select("id,title").order("created_at",{ascending:false});
  q("#examSel").innerHTML='<option value="">请选择试卷 / 任务</option>'+(e.data||[]).map(x=>'<option value="'+esc(x.id)+'">'+esc(x.title)+'</option>').join("");
  q("#submitName").value=state.profile?.full_name||"";
  q("#subFile").onchange=()=>q("#fileText").textContent=q("#subFile").files[0]?.name||"点击选择建模压缩包";
  q("#subForm").onsubmit=async ev=>{ev.preventDefault();const f=q("#subFile").files[0],exam=q("#examSel").value;if(!f||!exam)return toast("请选择任务和文件");if(!/\.(zip|rar|7z)$/i.test(f.name))return toast("仅支持 ZIP / RAR / 7Z");const p=state.user.id+"/"+exam+"/"+Date.now()+"-"+safe(f.name);const up=await supabase.storage.from("submissions").upload(p,f);if(up.error)return toast(up.error.message);const ins=await supabase.from("submissions").insert({user_id:state.user.id,exam_id:exam,submitter_name:q("#submitName").value.trim(),note:q("#note").value.trim(),file_name:f.name,storage_path:p,status:"已提交"});if(ins.error)return toast(ins.error.message);ev.target.reset();q("#fileText").textContent="点击选择建模压缩包";q("#submitName").value=state.profile?.full_name||"";toast("提交成功")};
}
async function initMine(){
  if(!requireLogin())return;
  const r=await supabase.from("submissions").select("*,exams(title)").eq("user_id",state.user.id).order("created_at",{ascending:false});const data=r.data||[];
  q("#mineBody").innerHTML=data.length?data.map(x=>'<tr><td>'+esc(x.exams?.title||"—")+'</td><td>'+esc(x.file_name)+'</td><td><span class="status">'+esc(x.status)+'</span></td><td>'+fmt(x.created_at)+'</td></tr>').join(""):'<tr><td colspan="4" style="color:#7890aa">暂无提交记录。</td></tr>';
}
async function initProfile(){
  if(!requireLogin())return;
  q("#profileName").value=state.profile?.full_name||"";q("#profileMajor").value=state.profile?.major||"";q("#profilePhone").value=state.profile?.phone||"";q("#profileQQ").value=state.profile?.qq||"";q("#profileEmail").textContent=state.profile?.email||state.user.email;q("#profileRole").textContent=roleName(state.profile?.role);q("#profileDisplayName").textContent=state.profile?.full_name||"未填写姓名";q("#profileDisplayMajor").textContent=state.profile?.major||"未填写专业";
  q("#profileForm").onsubmit=async e=>{e.preventDefault();const full_name=q("#profileName").value.trim(),major=q("#profileMajor").value.trim(),phone=q("#profilePhone").value.trim(),qq=q("#profileQQ").value.trim();if(!full_name||!major)return toast("姓名和专业不能为空");if(phone&&!/^[0-9+()\-\s]{5,30}$/.test(phone))return toast("请输入有效电话号码");if(qq&&!/^\d{5,20}$/.test(qq))return toast("QQ 号应为 5-20 位数字");const r=await supabase.from("profiles").update({full_name,major,phone:phone||null,qq:qq||null}).eq("id",state.user.id).select("id,email,role,full_name,major,phone,qq,created_at").single();if(r.error)return toast("保存失败："+r.error.message);state.profile=r.data;updateAuthUI();q("#profileDisplayName").textContent=full_name;q("#profileDisplayMajor").textContent=major;toast("个人资料已保存，并同步到管理员后台")};
}
async function initAdmin(){
  if(!state.user||!isAdmin()){q("#adminGate").innerHTML='<div class="notice">当前账号没有管理权限。</div>';q("#adminContent").classList.add("hidden");return}
  q("#adminContent").classList.remove("hidden");
  q("#workForm").onsubmit=async e=>{e.preventDefault();let cover_url="",storage_path=null;const f=q("#workCover").files[0];if(f){const p=Date.now()+"-"+safe(f.name);const up=await supabase.storage.from("works").upload(p,f);if(up.error)return toast(up.error.message);storage_path=p;cover_url=supabase.storage.from("works").getPublicUrl(p).data.publicUrl}const title=q("#workTitle").value.trim();if(!title)return toast("请填写作品名称");const ins=await supabase.from("past_works").insert({title,year:q("#workYear").value?Number(q("#workYear").value):null,team_name:q("#workTeam").value.trim(),description:q("#workDesc").value.trim(),cover_url:cover_url||null,storage_path,detail_url:q("#workUrl").value.trim()||null,created_by:state.user.id});if(ins.error){if(storage_path)await supabase.storage.from("works").remove([storage_path]);return toast(ins.error.message)}e.target.reset();toast("往届作品发布成功")};
  q("#examForm").onsubmit=async e=>{e.preventDefault();const f=q("#pdf").files[0];if(!f)return toast("请选择 PDF");const p=Date.now()+"-"+safe(f.name),up=await supabase.storage.from("exams").upload(p,f);if(up.error)return toast(up.error.message);const url=supabase.storage.from("exams").getPublicUrl(p).data.publicUrl;const ins=await supabase.from("exams").insert({title:q("#examTitle").value.trim(),description:q("#examDesc").value.trim(),deadline:q("#deadline").value?new Date(q("#deadline").value).toISOString():null,file_url:url,storage_path:p,created_by:state.user.id});if(ins.error)return toast(ins.error.message);e.target.reset();toast("试卷 / 任务发布成功")};
  q("#tutorialForm").onsubmit=async e=>{e.preventDefault();const type=q("#resourceType").value,mode=q("#resourceMode").value;let url=q("#resourceUrl").value.trim(),storage_path=null,file_name=null;if(mode==="file"){const f=q("#resourceFile").files[0];if(!f)return toast("请选择要上传的教程文件");if(type==="pdf"&&!/\.pdf$/i.test(f.name))return toast("PDF 教程请选择 .pdf 文件");if(type==="word"&&!/\.(doc|docx)$/i.test(f.name))return toast("Word 教程请选择 .doc 或 .docx 文件");if(type==="video"&&!(f.type||"").startsWith("video/")&&!/\.(mp4|webm|ogg|mov|m4v)$/i.test(f.name))return toast("请选择视频文件");storage_path=type+"/"+Date.now()+"-"+safe(f.name);file_name=f.name;const up=await supabase.storage.from("tutorials").upload(storage_path,f);if(up.error)return toast(up.error.message);url=supabase.storage.from("tutorials").getPublicUrl(storage_path).data.publicUrl}if(!url)return toast("请输入资料链接或选择文件");const ins=await supabase.from("tutorials").insert({title:q("#tutorialTitle").value.trim(),description:q("#tutorialDesc").value.trim(),video_url:url,resource_type:type,file_name,storage_path,created_by:state.user.id});if(ins.error){if(storage_path)await supabase.storage.from("tutorials").remove([storage_path]);return toast(ins.error.message)}e.target.reset();toggleResourceForm();toast(resourceTypeName(type)+"发布成功")};
  function toggleResourceForm(){const type=q("#resourceType").value,mode=q("#resourceMode").value,isFile=mode==="file";q("#resourceUrlWrap").classList.toggle("hidden",isFile);q("#resourceFileWrap").classList.toggle("hidden",!isFile);q("#resourceUrlLabel").textContent=type==="video"?"视频链接":type==="pdf"?"PDF 链接":"Word 链接";q("#resourceFileLabel").textContent=type==="video"?"视频文件":type==="pdf"?"PDF 文件":"Word 文件";q("#resourceFile").accept=type==="video"?"video/*":type==="pdf"?".pdf,application/pdf":".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"}q("#resourceType").onchange=toggleResourceForm;q("#resourceMode").onchange=toggleResourceForm;toggleResourceForm();
  await loadAllSubmissions();
}
async function loadAllSubmissions(){
  const r=await supabase.from("submissions").select("*,exams(title),profiles(email,full_name,major)").order("created_at",{ascending:false});const data=r.data||[];
  q("#allBody").innerHTML=data.length?data.map(x=>'<tr><td>'+esc(x.exams?.title||"—")+'</td><td>'+esc(x.profiles?.full_name||"—")+'</td><td>'+esc(x.profiles?.major||"—")+'</td><td>'+esc(x.submitter_name||x.profiles?.email||"—")+'</td><td>'+esc(x.file_name)+'</td><td>'+fmt(x.created_at)+'</td><td><button class="btn ghost dl" data-p="'+esc(x.storage_path)+'">下载</button> <button class="btn danger delSub" data-id="'+esc(x.id)+'" data-p="'+esc(x.storage_path)+'">删除</button></td></tr>').join(""):'<tr><td colspan="7">暂无提交。</td></tr>';
  document.querySelectorAll(".dl").forEach(b=>b.onclick=async()=>{const s=await supabase.storage.from("submissions").createSignedUrl(b.dataset.p,120);if(s.error)return toast(s.error.message);window.open(s.data.signedUrl,"_blank")});
  document.querySelectorAll(".delSub").forEach(b=>b.onclick=async()=>{if(!confirm("确定删除这条提交吗？"))return;if(b.dataset.p){const rm=await supabase.storage.from("submissions").remove([b.dataset.p]);if(rm.error)return toast(rm.error.message)}const d=await supabase.from("submissions").delete().eq("id",b.dataset.id);if(d.error)return toast(d.error.message);toast("提交已删除");await loadAllSubmissions()});
}
async function runPage(){if(page==="home")return initHome();if(page==="works")return initWorks();if(page==="exams")return initExams();if(page==="tutorials")return initTutorials();if(page==="submit")return initSubmit();if(page==="mine")return initMine();if(page==="profile")return initProfile();if(page==="admin")return initAdmin()}
renderChrome();
const s=await supabase.auth.getSession();state.user=s.data.session?.user||null;await loadProfile();updateAuthUI();await runPage();
supabase.auth.onAuthStateChange(async(_e,session)=>{state.user=session?.user||null;await loadProfile();updateAuthUI();await runPage()});