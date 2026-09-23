import {createClient} from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import * as tus from "https://cdn.jsdelivr.net/npm/tus-js-client@4.3.1/+esm";
const SUPABASE_URL="https://yodtphuzgngxpihnfwop.supabase.co";
const SUPABASE_KEY="sb_publishable_VHuHgObgmWWdY8PBl65OeQ_T7prL9wX";
const PROJECT_REF="yodtphuzgngxpihnfwop";
const supabase=createClient(SUPABASE_URL,SUPABASE_KEY);
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
  q("#siteHeader").innerHTML='<header class="siteHeader"><div class="wrap headerInner"><a class="brand" href="./index.html"><img src="./assets/lab-logo.webp?v=14" alt="实验室标志"><span class="brandText"><b>江苏科技大学机械创新实验室</b><small>交流平台 · 学习资料 · 项目协作</small></span></a><nav class="nav">'+
    navLink("lab","./lab.html","实验室")+navLink("works","./works.html","往届作品")+'<span class="navSep"></span>'+
    navLink("exams","./exams.html","试卷任务")+navLink("tutorials","./tutorials.html","教程")+navLink("files","./files/","资料库")+'<span class="navSep"></span>'+
    navLink("submit","./submit.html","提交作业")+navLink("mine","./mine.html","我的提交")+navLink("profile","./profile.html","个人资料")+
    '<span class="navSep adminSep hidden"></span><a id="adminNav" class="'+(page==="admin"?"active ":"")+'hidden" href="./admin.html">管理后台</a></nav><div class="acct"><a id="adminQuick" class="btn sec hidden" href="./admin.html">管理后台</a><span id="badge" class="pill hidden"></span><button id="authOpen" class="btn ghost">登录</button><button id="logout" class="btn ghost hidden">退出</button></div></div></header>';
  q("#siteFooter").innerHTML='<footer class="foot"><div class="wrap footInner"><img src="./assets/lab-logo.webp?v=14" alt="实验室标志"><div><b>江苏科技大学机械创新实验室</b><small>交流平台 · 学习资料 · 项目协作</small></div></div></footer>';
  document.body.insertAdjacentHTML("beforeend",'<dialog id="auth" class="dialog"><div class="dialogbox"><h2 id="authModeTitle" style="margin:0">成员登录</h2><p id="authModeHint" style="margin:0;color:#8fa4bd">已注册成员只需要邮箱和密码即可登录。</p><div id="registerFields" class="two hidden"><label>姓名（首次注册必填）<input id="regName" maxlength="40" autocomplete="name" placeholder="请输入真实姓名"></label><label>年级 / 校区 / 专业（首次注册必填）<input id="regMajor" maxlength="60" placeholder="例如：24级东校区机械工程；苏理工机械工程"></label></div><label>邮箱<input id="email" type="email" autocomplete="email"></label><label>密码<input id="password" type="password" minlength="6" autocomplete="current-password"></label><div class="actions"><button id="login" class="btn pri" type="button">登录</button><button id="showRegister" class="btn sec" type="button">首次注册</button><button id="continueRegister" class="btn pri hidden" type="button">继续注册</button><button id="backLogin" class="btn ghost hidden" type="button">返回登录</button><button id="closeAuth" class="btn ghost" type="button">关闭</button></div><small id="authMsg" style="color:#8fa4bd"></small></div></dialog><dialog id="passAuth" class="dialog"><div class="dialogbox"><span class="eyebrow">LAB ACCESS</span><h2 style="margin:0">实验室通行证验证</h2><p style="margin:0;color:#8fa4bd">通行证只在首次注册时验证，之后登录无需再次填写。</p><label>实验室通行证<input id="passcodeConfirm" type="password" autocomplete="off"></label><div class="actions"><button id="confirmPasscode" class="btn pri" type="button">验证并注册</button><button id="cancelPasscode" class="btn ghost" type="button">返回</button></div><small id="passMsg" style="color:#8fa4bd"></small></div></dialog><div id="toast" class="toast"></div>');
  bindAuth();
}
function updateAuthUI(){
  const on=!!state.user;
  q("#authOpen").classList.toggle("hidden",on);q("#logout").classList.toggle("hidden",!on);q("#badge").classList.toggle("hidden",!on);
  const who=state.profile?.full_name||state.user?.email||"";
  q("#badge").textContent=on?who+(state.profile?.major?" · "+state.profile.major:"")+(isAdmin()?" · "+roleName(state.profile.role):""):"";
  q("#adminNav").classList.toggle("hidden",!isAdmin());const aq=q("#adminQuick");if(aq)aq.classList.toggle("hidden",!isAdmin());document.querySelectorAll(".adminSep").forEach(x=>x.classList.toggle("hidden",!isAdmin()));
}
function bindAuth(){
  const setAuthMode=mode=>{
    const reg=mode==="register";
    q("#registerFields").classList.toggle("hidden",!reg);
    q("#login").classList.toggle("hidden",reg);
    q("#showRegister").classList.toggle("hidden",reg);
    q("#continueRegister").classList.toggle("hidden",!reg);
    q("#backLogin").classList.toggle("hidden",!reg);
    q("#authModeTitle").textContent=reg?"首次注册":"成员登录";
    q("#authModeHint").textContent=reg?"首次注册需填写姓名，以及“年级 + 校区 + 专业”或“苏理工 + 专业”，并验证实验室通行证。":"已注册成员只需要邮箱和密码即可登录。";
    q("#authMsg").textContent="";
  };
  q("#authOpen").onclick=()=>{setAuthMode("login");q("#auth").showModal()};
  q("#closeAuth").onclick=()=>q("#auth").close();
  q("#logout").onclick=()=>supabase.auth.signOut();
  q("#showRegister").onclick=()=>setAuthMode("register");
  q("#backLogin").onclick=()=>setAuthMode("login");
  q("#login").onclick=async()=>{
    const email=q("#email").value.trim(),password=q("#password").value;
    if(!email||!password)return q("#authMsg").textContent="请输入邮箱和密码";
    q("#authMsg").textContent="正在登录…";
    const r=await supabase.auth.signInWithPassword({email,password});
    q("#authMsg").textContent=r.error?r.error.message:"登录成功";
    if(!r.error)q("#auth").close();
  };
  q("#continueRegister").onclick=()=>{
    const n=q("#regName").value.trim(),m=q("#regMajor").value.trim(),e=q("#email").value.trim(),p=q("#password").value;
    if(!n)return q("#authMsg").textContent="首次注册请填写姓名";
    if(!m)return q("#authMsg").textContent="首次注册请填写年级、校区和专业信息";
    if(!e||p.length<6)return q("#authMsg").textContent="请输入有效邮箱，密码至少 6 位";
    q("#authMsg").textContent="";q("#passMsg").textContent="";q("#passcodeConfirm").value="";
    q("#auth").close();q("#passAuth").showModal();
  };
  q("#cancelPasscode").onclick=()=>{q("#passAuth").close();setAuthMode("register");q("#auth").showModal()};
  q("#confirmPasscode").onclick=async()=>{
    const full_name=q("#regName").value.trim(),major=q("#regMajor").value.trim(),email=q("#email").value.trim(),password=q("#password").value,lab_passcode=q("#passcodeConfirm").value.trim();
    if(!lab_passcode)return q("#passMsg").textContent="请输入实验室通行证";
    q("#passMsg").textContent="正在验证并注册…";
    const r=await supabase.auth.signUp({email,password,options:{data:{lab_passcode,full_name,major}}});
    if(r.error){q("#passMsg").textContent=/Database error|unexpected_failure/i.test(r.error.message||"")?"通行证不正确或注册失败":r.error.message;return}
    if(r.data.session){q("#passMsg").textContent="注册成功，已自动登录";setTimeout(()=>q("#passAuth").close(),400);return}
    const s=await supabase.auth.signInWithPassword({email,password});
    q("#passMsg").textContent=s.error?s.error.message:"注册成功，已自动登录";
    if(!s.error)setTimeout(()=>q("#passAuth").close(),400);
  };
}
async function loadProfile(){
  if(!state.user){state.profile=null;return}
  const r=await supabase.from("profiles").select("id,email,role,full_name,major,phone,qq,created_at").eq("id",state.user.id).maybeSingle();
  state.profile=r.data||null;
}
function requireLogin(box="#pageGate"){
  if(state.user)return true;
  const el=q(box);if(el)el.innerHTML='<div class="notice">此页面需要登录后使用。 <button id="gateLogin" class="btn sec" type="button">立即登录</button></div>';
  setTimeout(()=>{const b=q("#gateLogin");if(b)b.onclick=()=>q("#authOpen").click()},0);return false;
}
function normalizeExternalUrl(u){
  let v=(u||"").trim();
  if(!v)return "";
  if(!/^https?:\/\//i.test(v))v="https://"+v;
  try{
    const x=new URL(v);
    if(!/^https?:$/.test(x.protocol))return "";
    return x.href;
  }catch(_e){return ""}
}
function isOwnPlatformUrl(u){
  try{
    const x=new URL(u);
    return /(^|\.)1763107202-afk\.github\.io$/i.test(x.hostname)&&x.pathname.startsWith("/modelhub");
  }catch(_e){return false}
}
function embed(u){
  if(!u)return '<div style="font-size:44px;color:#3a5677">▶</div>';
  if(isOwnPlatformUrl(u))return '<div class="notice" style="margin:18px">视频链接设置错误，请管理员修改外部视频地址。</div>';
  const y=u.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{6,})/);if(y)return '<iframe src="https://www.youtube.com/embed/'+esc(y[1])+'?autoplay=0&playsinline=1&rel=0" loading="lazy" allow="fullscreen; picture-in-picture" allowfullscreen></iframe>';
  const b=u.match(/bilibili\.com\/video\/(BV[\w]+)/i);if(b)return '<iframe src="https://player.bilibili.com/player.html?bvid='+esc(b[1])+'&page=1&high_quality=1&autoplay=0" loading="lazy" allow="fullscreen; picture-in-picture" allowfullscreen scrolling="no"></iframe>';
  if(/\.(mp4|webm|ogg|mov|m4v)(\?|$)/i.test(u))return '<video controls preload="metadata" playsinline src="'+esc(u)+'"></video>';
  return '<a class="btn sec" target="_blank" rel="noopener noreferrer" href="'+esc(u)+'">打开视频</a>';
}
function resourceTypeName(t){return t==="pdf"?"PDF 文档":t==="word"?"Word 文档":t==="ppt"?"PPT 演示文稿":t==="archive"?"压缩包教程":"视频教程"}
function bytesText(n){if(n<1024)return n+" B";if(n<1024*1024)return (n/1024).toFixed(1)+" KB";if(n<1024*1024*1024)return (n/1024/1024).toFixed(1)+" MB";return (n/1024/1024/1024).toFixed(2)+" GB"}
function storageObjectPath(prefix,fileName){
  const ext=(fileName.match(/\.[A-Za-z0-9]{1,10}$/)||[""])[0].toLowerCase();
  const id=(globalThis.crypto?.randomUUID?.()||Math.random().toString(36).slice(2)+Date.now().toString(36)).replace(/[^a-zA-Z0-9-]/g,"");
  return (prefix?prefix+"/":"")+Date.now()+"-"+id+ext;
}
function tutorialStoragePath(type,fileName){return storageObjectPath(type,fileName)}
async function uploadStorageFile(bucket,path,file,onProgress){
  const sess=await supabase.auth.getSession();
  const token=sess.data.session?.access_token;
  if(!token)throw new Error("登录状态已失效，请重新登录后再上传");
  await new Promise((resolve,reject)=>{
    const upload=new tus.Upload(file,{
      endpoint:`https://${PROJECT_REF}.storage.supabase.co/storage/v1/upload/resumable`,
      retryDelays:[0,3000,5000,10000,20000],
      headers:{authorization:`Bearer ${token}`,apikey:SUPABASE_KEY},
      uploadDataDuringCreation:true,
      removeFingerprintOnSuccess:true,
      chunkSize:6*1024*1024,
      metadata:{
        bucketName:bucket,
        objectName:path,
        contentType:file.type||"application/octet-stream",
        cacheControl:"3600"
      },
      onError:error=>reject(error),
      onProgress:(sent,total)=>{if(onProgress)onProgress(total?Math.round(sent/total*100):0)},
      onSuccess:()=>resolve()
    });
    upload.findPreviousUploads().then(previous=>{
      if(previous.length)upload.resumeFromPreviousUpload(previous[0]);
      upload.start();
    }).catch(reject);
  });
}
async function uploadTutorialFile(path,file,onProgress){return uploadStorageFile("tutorials",path,file,onProgress)}
function resourcePreview(x){
  const type=x.resource_type||"video",url=x.video_url||"";
  if(type==="video"&&isOwnPlatformUrl(url)){
    return '<div class="notice" style="margin:18px">视频链接设置错误。'+(isAdmin()?'<div class="actions" style="margin-top:12px"><button class="btn pri editTutorialUrl" type="button" data-id="'+esc(x.id)+'" data-url="'+esc(url)+'">立即修改视频链接</button></div>':' 请联系管理员修改外部视频地址。')+'</div>';
  }
  if(type==="video")return embed(url);
  const icon=type==="pdf"?"PDF":type==="word"?"DOCX":type==="archive"?"ZIP":"PPTX";
  const hint=type==="pdf"?"点击下方按钮在线查看或下载 PDF":type==="word"?"点击下方按钮打开或下载 Word 文档":type==="archive"?"点击下方按钮下载压缩包教程":"点击下方按钮打开或下载 PPT 演示文稿";
  return '<div class="docPreview"><div class="docIcon '+esc(type)+'">'+icon+'</div><strong>'+esc(x.file_name||resourceTypeName(type))+'</strong><span>'+hint+'</span></div>';
}
function showImportantAnnouncement(x){
  if(!x)return;
  const key="important-announcement:"+x.id;
  if(sessionStorage.getItem(key)==="seen")return;
  let d=q("#importantAnnouncementDialog");
  if(!d){
    document.body.insertAdjacentHTML("beforeend",'<dialog id="importantAnnouncementDialog" class="dialog importantAnnouncementDialog"><div class="importantAnnouncementBox"><div class="importantAnnouncementIcon">!</div><span class="eyebrow">IMPORTANT ANNOUNCEMENT</span><h2 id="importantAnnouncementTitle"></h2><p id="importantAnnouncementContent"></p><div class="importantAnnouncementMeta" id="importantAnnouncementMeta"></div><div class="actions"><button id="closeImportantAnnouncement" class="btn pri" type="button">我知道了</button></div></div></dialog>');
    d=q("#importantAnnouncementDialog");
  }
  q("#importantAnnouncementTitle").textContent=x.title||"重要公告";
  q("#importantAnnouncementContent").textContent=x.content||"";
  let img=q("#importantAnnouncementImage");
  if(!img){
    q("#importantAnnouncementContent").insertAdjacentHTML("beforebegin",'<img id="importantAnnouncementImage" class="importantAnnouncementImage hidden" alt="公告图片">');
    img=q("#importantAnnouncementImage");
  }
  if(x.image_url){img.src=x.image_url;img.classList.remove("hidden")}else{img.removeAttribute("src");img.classList.add("hidden")}
  q("#importantAnnouncementMeta").textContent="发布时间："+fmt(x.created_at);
  q("#closeImportantAnnouncement").onclick=()=>{sessionStorage.setItem(key,"seen");d.close()};
  d.addEventListener("cancel",()=>sessionStorage.setItem(key,"seen"),{once:true});
  d.showModal();
}
async function loadAnnouncements(adminMode=false){
  const req=supabase.from("announcements").select("*").order("pinned",{ascending:false}).order("pinned_at",{ascending:false,nullsFirst:false}).order("created_at",{ascending:false}).limit(adminMode?50:6);
  const importantReq=adminMode?Promise.resolve({data:[],error:null}):supabase.from("announcements").select("*").eq("level","important").order("pinned",{ascending:false}).order("pinned_at",{ascending:false,nullsFirst:false}).order("created_at",{ascending:false}).limit(1);
  const [r,important]=await Promise.all([req,importantReq]);
  if(r.error){
    console.error("公告加载失败",r.error);
    const box=q("#announcementList"),section=q("#announcementSection");
    if(section)section.classList.remove("hidden");
    if(box)box.innerHTML='<div class="empty">公告暂时加载失败，请稍后刷新。</div>';
    return;
  }
  const data=r.data||[];
  const badges=x=>'<span class="announcementBadge">'+(x.level==="important"?"重要公告":"公告")+'</span>'+(x.pinned?'<span class="announcementBadge pinnedBadge">置顶</span>':'');
  if(adminMode){
    const box=q("#adminAnnouncementList");
    if(!box)return;
    box.innerHTML=data.length?data.map(x=>'<article class="announcement adminAnnouncement '+(x.level==="important"?"important ":"")+(x.pinned?"pinned":"")+'"><div class="announcementTop"><div><div class="announcementBadges">'+badges(x)+'</div><h3>'+esc(x.title)+'</h3></div><div class="rowActions"><button class="btn '+(x.pinned?"ghost":"sec")+' togglePinAnnouncement" data-id="'+esc(x.id)+'" data-pinned="'+(x.pinned?"1":"0")+'">'+(x.pinned?"取消置顶":"置顶")+'</button><button class="btn danger delAnnouncement" data-id="'+esc(x.id)+'" data-path="'+esc(x.image_path||"")+'">删除</button></div></div>'+(x.image_url?'<img class="announcementImage" src="'+esc(x.image_url)+'" alt="公告图片">':'')+(x.content?'<p>'+esc(x.content)+'</p>':'')+'<small>'+fmt(x.created_at)+'</small></article>').join(""):'<div class="empty">暂无公告。</div>';
    document.querySelectorAll(".togglePinAnnouncement").forEach(b=>b.onclick=async()=>{
      const now=b.dataset.pinned!=="1";
      const u=await supabase.from("announcements").update({pinned:now,pinned_at:now?new Date().toISOString():null}).eq("id",b.dataset.id);
      if(u.error)return toast((now?"置顶":"取消置顶")+"失败："+u.error.message);
      toast(now?"公告已置顶":"已取消置顶");
      await loadAnnouncements(true);
    });
    document.querySelectorAll(".delAnnouncement").forEach(b=>b.onclick=async()=>{
      if(!confirm("确定删除这条公告吗？"))return;
      if(b.dataset.path){const rm=await supabase.storage.from("announcement-images").remove([b.dataset.path]);if(rm.error)return toast("公告图片删除失败："+rm.error.message)}
      const d=await supabase.from("announcements").delete().eq("id",b.dataset.id);
      if(d.error)return toast("删除失败："+d.error.message);
      toast("公告已删除");
      await loadAnnouncements(true);
    });
  }else{
    const box=q("#announcementList"),section=q("#announcementSection");
    if(!box||!section)return;
    section.classList.remove("hidden");
    box.innerHTML=data.length?data.map(x=>'<article class="announcement '+(x.level==="important"?"important ":"")+(x.pinned?"pinned":"")+'"><div class="announcementTop"><div><div class="announcementBadges">'+badges(x)+'</div><h3>'+esc(x.title)+'</h3></div><small>'+fmt(x.created_at)+'</small></div>'+(x.image_url?'<img class="announcementImage" src="'+esc(x.image_url)+'" alt="公告图片">':'')+(x.content?'<p>'+esc(x.content)+'</p>':'')+'</article>').join(""):'<div class="empty">暂无公告。</div>';
    if(important?.error)console.error("重要公告加载失败",important.error);
    else showImportantAnnouncement((important?.data||[])[0]);
  }
}
async function initHome(){
  const [e,v,w,members]=await Promise.all([supabase.from("exams").select("id"),supabase.from("tutorials").select("id"),supabase.from("past_works").select("id"),supabase.rpc("get_member_count")]);
  await loadAnnouncements(false);
  q("#homeExams").textContent=(e.data||[]).length;q("#homeVideos").textContent=(v.data||[]).length;q("#homeWorks").textContent=(w.data||[]).length;const hm=q("#homeMembers");if(hm)hm.textContent=members.error?"—":String(members.data??0);
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
  const r=await supabase.from("tutorials").select("*").order("created_at",{ascending:false});
  if(r.error){
    q("#videoGrid").innerHTML='<div class="empty">教程资料加载失败：'+esc(r.error.message)+'</div>';
    q("#videoEmpty").classList.add("hidden");
    return;
  }
  const all=r.data||[];
  let activeType="all";
  const search=q("#tutorialSearch");
  const count=q("#tutorialCount");
  const render=()=>{
    const keyword=(search?.value||"").trim().toLowerCase();
    const data=all.filter(x=>{
      const type=x.resource_type||"video";
      const typeOk=activeType==="all"||type===activeType;
      const text=[x.title,x.description,x.file_name,resourceTypeName(type)].filter(Boolean).join(" ").toLowerCase();
      return typeOk&&(!keyword||text.includes(keyword));
    });
    if(count)count.textContent=String(data.length);
    q("#videoGrid").innerHTML=data.map(x=>{
      const type=x.resource_type||"video",url=x.video_url||"",action=type==="video"?"打开 / 播放视频":type==="pdf"?"查看 / 下载 PDF":type==="word"?"打开 / 下载 Word":type==="archive"?"下载压缩包":"打开 / 下载 PPT";
      return '<article class="video"><div class="frame '+(type!=="video"?"docFrame":"")+'">'+resourcePreview(x)+'</div><div class="info"><span class="resourceType">'+resourceTypeName(type)+'</span><h3>'+esc(x.title)+'</h3><p style="color:#8fa4bd">'+esc(x.description||"暂无简介")+'</p><div class="actions">'+((type==="video"&&(!/^https?:/i.test(url)||isOwnPlatformUrl(url)))?"":'<a class="btn sec" target="_blank" rel="noopener" href="'+esc(url)+'">'+action+'</a>')+(isAdmin()&&!x.storage_path&&!isOwnPlatformUrl(url)?'<button class="btn ghost editTutorialUrl" data-id="'+esc(x.id)+'" data-url="'+esc(url)+'">修改链接</button>':'')+(isAdmin()?'<button class="btn danger delTutorial" data-id="'+esc(x.id)+'" data-url="'+esc(url)+'" data-path="'+esc(x.storage_path||"")+'">删除教程</button>':'')+'</div></div></article>';
    }).join("");
    q("#videoEmpty").classList.toggle("hidden",data.length>0);
    q("#videoEmpty").textContent=all.length?"没有找到符合条件的教程资料。":"暂时还没有教程。";
    document.querySelectorAll(".editTutorialUrl").forEach(b=>b.onclick=async()=>{
      const raw=prompt("请输入正确的外部视频 / 资料链接：",b.dataset.url||"");
      if(raw===null)return;
      const url=normalizeExternalUrl(raw);
      if(!url)return toast("链接格式不正确，请输入完整网址");
      if(isOwnPlatformUrl(url))return toast("不能填写本站管理后台或首页地址，请粘贴实际视频链接");
      const u=await supabase.from("tutorials").update({video_url:url}).eq("id",b.dataset.id);
      if(u.error)return toast("链接修改失败："+u.error.message);
      toast("链接已修改");await initTutorials();
    });
    document.querySelectorAll(".delTutorial").forEach(b=>b.onclick=async()=>{
      if(!confirm("确定删除这个教程资料吗？"))return;
      let p=b.dataset.path||"";
      if(!p){
        const u=b.dataset.url||"",key="/storage/v1/object/public/tutorials/";
        if(u.includes(key)){try{p=decodeURIComponent(u.split(key)[1].split("?")[0])}catch(_e){}}
      }
      if(p){const rm=await supabase.storage.from("tutorials").remove([p]);if(rm.error)return toast(rm.error.message)}
      const d=await supabase.from("tutorials").delete().eq("id",b.dataset.id);
      if(d.error)return toast(d.error.message);
      toast("教程资料已删除");await initTutorials();
    });
  };
  document.querySelectorAll(".tutorialFilterBtn").forEach(btn=>btn.onclick=()=>{
    activeType=btn.dataset.type||"all";
    document.querySelectorAll(".tutorialFilterBtn").forEach(x=>x.classList.toggle("active",x===btn));
    render();
  });
  if(search)search.oninput=render;
  render();
}
function labFileTypeName(t){return ({sheet:"表格",word:"Word",ppt:"PPT",archive:"压缩包",video:"视频",pdf:"PDF",image:"图片",cad:"CAD / 模型",link:"链接",text:"文字资料",other:"其他"})[t]||"其他"}
function labFileIcon(t){return ({sheet:"XLS",word:"DOC",ppt:"PPT",archive:"ZIP",video:"VID",pdf:"PDF",image:"IMG",cad:"CAD",link:"LINK",text:"TXT",other:"FILE"})[t]||"FILE"}
function normalizeShareLink(u){
  let v=(u||"").trim();
  if(!v)return "";
  if(!/^https?:\/\//i.test(v))v="https://"+v;
  try{const x=new URL(v);return /^https?:$/.test(x.protocol)?x.href:""}catch(_e){return ""}
}
async function loadResourceShares(){
  const box=q("#resourceShareGrid");
  if(!box)return;
  const r=await supabase.from("resource_shares").select("*").order("created_at",{ascending:false});
  if(r.error){box.innerHTML='<div class="empty">资料分享加载失败：'+esc(r.error.message)+'</div>';return}
  const data=r.data||[];
  q("#resourceShareCount")&&(q("#resourceShareCount").textContent=String(data.length));
  box.innerHTML=data.length?data.map(x=>{
    const link=x.link_url||"";
    return '<article class="shareCard">'+(x.image_url?'<img class="shareImage" src="'+esc(x.image_url)+'" alt="资料分享图片">':'')+'<div class="shareBody"><div class="fileTop"><span class="resourceType">资料分享</span><small>'+fmt(x.created_at)+'</small></div><h3>'+esc(x.title)+'</h3>'+(x.content?'<p>'+esc(x.content)+'</p>':'')+'<div class="actions">'+(link?'<a class="btn sec" href="'+esc(link)+'" target="_blank" rel="noopener noreferrer">打开链接</a>':'')+(isAdmin()?'<button class="btn danger delResourceShare" data-id="'+esc(x.id)+'" data-path="'+esc(x.image_path||"")+'">删除分享</button>':'')+'</div></div></article>';
  }).join(""):'<div class="empty">暂时还没有资料分享。</div>';
  document.querySelectorAll(".delResourceShare").forEach(b=>b.onclick=async()=>{
    if(!confirm("确定删除这条资料分享吗？"))return;
    if(b.dataset.path){const rm=await supabase.storage.from("resource-share-images").remove([b.dataset.path]);if(rm.error)return toast("图片删除失败："+rm.error.message)}
    const d=await supabase.from("resource_shares").delete().eq("id",b.dataset.id);
    if(d.error)return toast("删除失败："+d.error.message);
    toast("资料分享已删除");await loadResourceShares();
  });
}
async function initFiles(){
  await loadResourceShares();
  const r=await supabase.from("lab_files").select("*").order("created_at",{ascending:false});
  if(r.error){q("#fileGrid").innerHTML='<div class="empty">资料库加载失败：'+esc(r.error.message)+'</div>';return}
  const all=r.data||[];
  const select=q("#fileFilter");
  const render=()=>{
    const f=select?.value||"all";
    const data=f==="all"?all:all.filter(x=>x.category===f);
    q("#fileCount").textContent=String(data.length);
    q("#fileGrid").innerHTML=data.length?data.map(x=>{
      const mode=x.resource_mode||"file";
      let action="";
      if(mode==="file"&&x.storage_path){
        const url=supabase.storage.from("lab-files").getPublicUrl(x.storage_path).data.publicUrl;
        action='<a class="btn sec" href="'+esc(url)+'" target="_blank" rel="noopener">打开 / 下载</a>';
      }else if(mode==="link"&&x.external_url){
        action='<a class="btn sec" href="'+esc(x.external_url)+'" target="_blank" rel="noopener noreferrer">打开链接</a>';
      }
      const meta=mode==="file"?(esc(x.file_name||"文件")+' · '+bytesText(Number(x.file_size||0))):mode==="link"?"外部链接":"文字资料";
      return '<article class="fileCard '+esc(mode)+'Mode"><div class="fileIcon '+esc(x.category)+'">'+labFileIcon(x.category)+'</div><div class="fileBody"><div class="fileTop"><span class="resourceType">'+labFileTypeName(x.category)+'</span><small>'+fmt(x.created_at)+'</small></div><h3>'+esc(x.title)+'</h3>'+(x.description?'<p>'+esc(x.description)+'</p>':'')+'<div class="fileMeta">'+meta+'</div><div class="actions">'+action+(isAdmin()?'<button class="btn danger delLabFile" data-id="'+esc(x.id)+'" data-path="'+esc(x.storage_path||"")+'">删除</button>':'')+'</div></div></article>';
    }).join(""):'<div class="empty">当前分类暂无资料。</div>';
    document.querySelectorAll(".delLabFile").forEach(b=>b.onclick=async()=>{
      if(!confirm("确定删除这条资料吗？删除后无法恢复。"))return;
      if(b.dataset.path){
        const rm=await supabase.storage.from("lab-files").remove([b.dataset.path]);
        if(rm.error)return toast("文件删除失败："+rm.error.message);
      }
      const d=await supabase.from("lab_files").delete().eq("id",b.dataset.id);
      if(d.error)return toast("记录删除失败："+d.error.message);
      toast("资料已删除");await initFiles();
    });
  };
  if(select)select.onchange=render;
  render();
}
async function initSubmit(){
  const gate=q("#pageGate"),form=q("#subForm"),btn=q("#submitBtn"),status=q("#submitStatus");
  if(!state.user){
    if(form)form.classList.add("hidden");
    requireLogin();
    return;
  }
  if(form)form.classList.remove("hidden");
  if(gate)gate.innerHTML="";
  const setStatus=(msg,type="info")=>{
    if(!status)return;
    status.textContent=msg||"";
    status.className="submitStatus "+type;
  };
  try{
    const e=await supabase.from("exams").select("id,title").order("created_at",{ascending:false});
    if(e.error)throw e.error;
    const exams=e.data||[];
    q("#examSel").innerHTML='<option value="">请选择试卷 / 任务</option>'+exams.map(x=>'<option value="'+esc(x.id)+'">'+esc(x.title)+'</option>').join("");
    q("#submitName").value=state.profile?.full_name||"";
    q("#subFile").onchange=()=>{
      const f=q("#subFile").files[0];
      q("#fileText").textContent=f?f.name:"点击选择建模压缩包";
      setStatus(f?"已选择："+f.name:"");
    };
    if(!exams.length){
      setStatus("当前没有可提交的任务，请管理员先发布试卷 / 任务。","warn");
      if(btn)btn.disabled=true;
      return;
    }
    if(btn)btn.disabled=false;
    btn.onclick=async()=>{
      const f=q("#subFile").files[0];
      const exam=q("#examSel").value;
      const submitter=q("#submitName").value.trim();
      const note=q("#note").value.trim();
      if(!exam){setStatus("请先选择对应试卷 / 任务。","error");toast("请选择试卷 / 任务");return}
      if(!submitter){setStatus("请填写姓名 / 队伍名称。","error");toast("请填写姓名 / 队伍名称");return}
      if(!f){setStatus("请先选择 ZIP / RAR / 7Z 建模压缩包。","error");toast("请选择建模压缩包");return}
      if(!/\.(zip|rar|7z)$/i.test(f.name)){setStatus("文件格式不正确，仅支持 ZIP / RAR / 7Z。","error");toast("仅支持 ZIP / RAR / 7Z");return}
      const p=state.user.id+"/"+exam+"/"+storageObjectPath("files",f.name);
      const oldText=btn.textContent||"提交文件";
      try{
        btn.disabled=true;
        btn.textContent="上传中 0% · "+bytesText(f.size);
        setStatus("正在上传文件，请不要关闭页面…","info");
        await uploadStorageFile("submissions",p,f,x=>{
          btn.textContent="上传中 "+x+"% · "+bytesText(f.size);
          setStatus("正在上传："+x+"%","info");
        });
        btn.textContent="正在保存提交记录…";
        setStatus("文件上传完成，正在保存提交记录…","info");
        const ins=await supabase.from("submissions").insert({
          user_id:state.user.id,
          exam_id:exam,
          submitter_name:submitter,
          note,
          file_name:f.name,
          storage_path:p,
          status:"已提交"
        });
        if(ins.error){
          await supabase.storage.from("submissions").remove([p]);
          throw ins.error;
        }
        q("#subForm").reset();
        q("#fileText").textContent="点击选择建模压缩包";
        q("#submitName").value=state.profile?.full_name||"";
        setStatus("提交成功，正在跳转到“我的提交”…","success");
        toast("提交成功");
        setTimeout(()=>location.href="./mine.html",650);
      }catch(err){
        const msg=err?.message||String(err);
        console.error("作业提交失败",err);
        if(/row-level security|policy|permission|unauthorized|jwt/i.test(msg))setStatus("提交失败：登录状态或上传权限异常，请重新登录后再试。","error");
        else if(/maximum|too large|payload|entity too large|exceeded/i.test(msg))setStatus("提交失败：文件过大，请压缩后重试。","error");
        else setStatus("提交失败："+msg,"error");
        toast("提交失败："+msg);
      }finally{
        btn.disabled=false;
        btn.textContent=oldText;
      }
    };
  }catch(err){
    const msg=err?.message||String(err);
    console.error("提交页面初始化失败",err);
    if(gate)gate.innerHTML='<div class="notice">提交页面加载失败：'+esc(msg)+'。请刷新页面或重新登录后再试。</div>';
    if(form)form.classList.add("hidden");
  }
}
async function initMine(){
  if(!requireLogin())return;
  const [r,e]=await Promise.all([
    supabase.from("submissions").select("*,exams(title)").eq("user_id",state.user.id).order("created_at",{ascending:false}),
    supabase.from("exams").select("id,title").order("created_at",{ascending:false})
  ]);
  if(r.error)return toast("加载提交记录失败："+r.error.message);
  const data=r.data||[], exams=e.data||[];
  const body=q("#mineBody");
  body.innerHTML=data.length?data.map(x=>'<tr><td>'+esc(x.exams?.title||"—")+'</td><td>'+esc(x.file_name)+'</td><td><span class="status">'+esc(x.status)+'</span></td><td>'+fmt(x.created_at)+'</td><td><div class="rowActions"><button class="btn sec editSub" data-id="'+esc(x.id)+'">修改</button><button class="btn danger cancelSub" data-id="'+esc(x.id)+'">取消提交</button></div></td></tr>').join(""):'<tr><td colspan="5" style="color:#7890aa">暂无提交记录。</td></tr>';

  const editDialog=q("#editSubmissionDialog"), editForm=q("#editSubmissionForm"), editExam=q("#editExam"), editName=q("#editSubmitName"), editNote=q("#editNote"), editFile=q("#editFile"), editCurrent=q("#editCurrentFile"), editStatus=q("#editStatus");
  editExam.innerHTML=exams.map(x=>'<option value="'+esc(x.id)+'">'+esc(x.title)+'</option>').join("");

  document.querySelectorAll(".editSub").forEach(b=>b.onclick=()=>{
    const x=data.find(s=>s.id===b.dataset.id); if(!x)return;
    q("#editSubmissionId").value=x.id;
    editExam.value=x.exam_id||"";
    editName.value=x.submitter_name||state.profile?.full_name||"";
    editNote.value=x.note||"";
    editFile.value="";
    editCurrent.textContent="当前文件："+(x.file_name||"—");
    editStatus.textContent="如不选择新文件，将只修改任务、姓名/队伍名称和备注。";
    editDialog.showModal();
  });

  q("#closeEditSubmission").onclick=()=>editDialog.close();
  editForm.onsubmit=async ev=>{
    ev.preventDefault();
    const id=q("#editSubmissionId").value;
    const old=data.find(s=>s.id===id); if(!old)return;
    const exam_id=editExam.value, submitter_name=editName.value.trim(), note=editNote.value.trim(), newFile=editFile.files[0];
    if(!exam_id)return toast("请选择任务");
    if(!submitter_name)return toast("请填写姓名 / 队伍名称");
    if(newFile&&!/\.(zip|rar|7z)$/i.test(newFile.name))return toast("替换文件仅支持 ZIP / RAR / 7Z");
    const saveBtn=q("#saveSubmissionEdit"), oldText=saveBtn.textContent;
    let newPath=null;
    try{
      saveBtn.disabled=true;
      if(newFile){
        newPath=state.user.id+"/"+exam_id+"/"+storageObjectPath("files",newFile.name);
        saveBtn.textContent="上传新文件 0%";
        await uploadStorageFile("submissions",newPath,newFile,p=>{saveBtn.textContent="上传新文件 "+p+"%"});
      }
      saveBtn.textContent="正在保存修改…";
      const payload={exam_id,submitter_name,note};
      if(newFile){payload.file_name=newFile.name;payload.storage_path=newPath}
      const u=await supabase.from("submissions").update(payload).eq("id",id).eq("user_id",state.user.id);
      if(u.error){if(newPath)await supabase.storage.from("submissions").remove([newPath]);throw u.error}
      if(newFile&&old.storage_path&&old.storage_path!==newPath)await supabase.storage.from("submissions").remove([old.storage_path]);
      toast("提交记录已修改");
      editDialog.close();
      await initMine();
    }catch(err){
      console.error("修改提交失败",err);
      editStatus.textContent="修改失败："+(err?.message||String(err));
      toast("修改失败："+(err?.message||String(err)));
    }finally{
      saveBtn.disabled=false;
      saveBtn.textContent=oldText;
    }
  };

  document.querySelectorAll(".cancelSub").forEach(b=>b.onclick=async()=>{
    const x=data.find(s=>s.id===b.dataset.id); if(!x)return;
    if(!confirm("确定取消这次提交吗？取消后该提交记录和已上传文件都会删除，无法恢复。"))return;
    try{
      const d=await supabase.from("submissions").delete().eq("id",x.id).eq("user_id",state.user.id);
      if(d.error)throw d.error;
      if(x.storage_path){
        const rm=await supabase.storage.from("submissions").remove([x.storage_path]);
        if(rm.error)console.warn("提交记录已删除，但文件清理失败",rm.error);
      }
      toast("已取消提交");
      await initMine();
    }catch(err){
      console.error("取消提交失败",err);
      toast("取消失败："+(err?.message||String(err)));
    }
  });
}
async function initProfile(){
  if(!requireLogin())return;
  q("#profileName").value=state.profile?.full_name||"";q("#profileMajor").value=state.profile?.major||"";q("#profilePhone").value=state.profile?.phone||"";q("#profileQQ").value=state.profile?.qq||"";q("#profileEmail").textContent=state.profile?.email||state.user.email;q("#profileRole").textContent=roleName(state.profile?.role);q("#profileDisplayName").textContent=state.profile?.full_name||"未填写姓名";q("#profileDisplayMajor").textContent=state.profile?.major||"未填写专业";
  q("#profileForm").onsubmit=async e=>{e.preventDefault();const full_name=q("#profileName").value.trim(),major=q("#profileMajor").value.trim(),phone=q("#profilePhone").value.trim(),qq=q("#profileQQ").value.trim();if(!full_name||!major)return toast("姓名和专业不能为空");if(phone&&!/^[0-9+()\-\s]{5,30}$/.test(phone))return toast("请输入有效电话号码");if(qq&&!/^\d{5,20}$/.test(qq))return toast("QQ 号应为 5-20 位数字");const r=await supabase.from("profiles").update({full_name,major,phone:phone||null,qq:qq||null}).eq("id",state.user.id).select("id,email,role,full_name,major,phone,qq,created_at").single();if(r.error)return toast("保存失败："+r.error.message);state.profile=r.data;updateAuthUI();q("#profileDisplayName").textContent=full_name;q("#profileDisplayMajor").textContent=major;toast("个人资料已保存，并同步到管理员后台")};
}
async function initAdmin(){
  if(!state.user||!isAdmin()){q("#adminGate").innerHTML='<div class="notice">当前账号没有管理权限。</div>';q("#adminContent").classList.add("hidden");return}
  q("#adminContent").classList.remove("hidden");
  q("#announcementForm").onsubmit=async e=>{
    e.preventDefault();
    const title=q("#announcementTitle").value.trim(),content=q("#announcementContent").value.trim(),level=q("#announcementLevel").value,file=q("#announcementImage").files[0];
    if(!title)return toast("请填写公告标题");
    if(!content&&!file)return toast("公告文字和图片至少填写一项");
    if(file&&!(file.type||"").startsWith("image/")&&!/\.(png|jpe?g|webp|gif)$/i.test(file.name))return toast("公告图片请选择 PNG、JPG、WEBP 或 GIF");
    const btn=e.submitter||q("#announcementForm button");
    const oldText=btn?.textContent||"发布公告";
    let image_path=null,image_url=null,image_name=null;
    try{
      if(file){
        image_path=state.user.id+"/"+storageObjectPath("announcements",file.name);
        image_name=file.name;
        if(btn){btn.disabled=true;btn.textContent="图片上传中 0%"}
        await uploadStorageFile("announcement-images",image_path,file,p=>{if(btn)btn.textContent="图片上传中 "+p+"%"});
        image_url=supabase.storage.from("announcement-images").getPublicUrl(image_path).data.publicUrl;
      }
      if(btn){btn.disabled=true;btn.textContent="正在发布…"}
      const ins=await supabase.from("announcements").insert({title,content:content||null,level,image_url,image_path,image_name,created_by:state.user.id});
      if(ins.error){if(image_path)await supabase.storage.from("announcement-images").remove([image_path]);throw ins.error}
      e.target.reset();q("#announcementImagePreview").innerHTML="";toast("公告发布成功");await loadAnnouncements(true);
    }catch(err){toast("公告发布失败："+(err?.message||String(err)))}
    finally{if(btn){btn.disabled=false;btn.textContent=oldText}}
  };
  q("#announcementImage").onchange=()=>{
    const f=q("#announcementImage").files[0],box=q("#announcementImagePreview");
    if(!f){box.innerHTML="";return}
    const u=URL.createObjectURL(f);
    box.innerHTML='<img class="announcementImagePreviewImg" src="'+u+'" alt="公告图片预览"><small>'+esc(f.name)+' · '+bytesText(f.size)+'</small>';
  };
  await loadAnnouncements(true);
  q("#resourceShareForm").onsubmit=async e=>{
    e.preventDefault();
    const title=q("#resourceShareTitle").value.trim(),content=q("#resourceShareContent").value.trim(),rawLink=q("#resourceShareLink").value.trim(),file=q("#resourceShareImage").files[0];
    const link_url=rawLink?normalizeShareLink(rawLink):null;
    if(!title)return toast("请填写分享标题");
    if(rawLink&&!link_url)return toast("链接格式不正确");
    if(!content&&!link_url&&!file)return toast("文字、链接、图片至少填写一项");
    if(file&&!(file.type||"").startsWith("image/")&&!/\.(png|jpe?g|webp|gif)$/i.test(file.name))return toast("请选择图片文件");
    const btn=e.submitter||q("#resourceShareForm button");
    const oldText=btn?.textContent||"发布资料分享";
    let image_path=null,image_url=null,image_name=null;
    try{
      if(file){
        image_path=state.user.id+"/"+storageObjectPath("shares",file.name);
        image_name=file.name;
        if(btn){btn.disabled=true;btn.textContent="图片上传中 0%"}
        await uploadStorageFile("resource-share-images",image_path,file,p=>{if(btn)btn.textContent="图片上传中 "+p+"%"});
        image_url=supabase.storage.from("resource-share-images").getPublicUrl(image_path).data.publicUrl;
      }
      if(btn){btn.disabled=true;btn.textContent="正在发布…"}
      const ins=await supabase.from("resource_shares").insert({title,content:content||null,link_url,image_url,image_path,image_name,created_by:state.user.id});
      if(ins.error){if(image_path)await supabase.storage.from("resource-share-images").remove([image_path]);throw ins.error}
      e.target.reset();q("#resourceShareImagePreview").innerHTML="";toast("资料分享发布成功");
    }catch(err){toast("资料分享发布失败："+(err?.message||String(err)))}
    finally{if(btn){btn.disabled=false;btn.textContent=oldText}}
  };
  q("#resourceShareImage").onchange=()=>{
    const f=q("#resourceShareImage").files[0],box=q("#resourceShareImagePreview");
    if(!f){box.innerHTML="";return}
    const u=URL.createObjectURL(f);
    box.innerHTML='<img class="announcementImagePreviewImg" src="'+u+'" alt="资料分享图片预览"><small>'+esc(f.name)+' · '+bytesText(f.size)+'</small>';
  };
  q("#labFileForm").onsubmit=async e=>{
    e.preventDefault();
    const title=q("#labFileTitle").value.trim(),mode=q("#labFileMode").value,description=q("#labFileDesc").value.trim();
    let category=q("#labFileCategory").value,external_url=null,file_name=null,storage_path=null,file_size=0,mime_type=null;
    const f=q("#labFileInput").files[0];
    if(!title)return toast("请填写资料标题");
    if(mode==="file"&&!f)return toast("请选择要上传的文件");
    if(mode==="link"){
      external_url=normalizeShareLink(q("#labFileLink").value);
      if(!external_url)return toast("请输入正确的链接");
      category="link";
    }
    if(mode==="text"){
      if(!description)return toast("纯文字资料请填写内容");
      category="text";
    }
    const btn=e.submitter||q("#labFileForm button");
    const oldText=btn?.textContent||"发布到资料库";
    try{
      if(mode==="file"){
        storage_path=state.user.id+"/"+category+"/"+storageObjectPath("files",f.name);
        file_name=f.name;file_size=f.size;mime_type=f.type||null;
        if(btn){btn.disabled=true;btn.textContent="上传中 0% · "+bytesText(f.size)}
        await uploadStorageFile("lab-files",storage_path,f,p=>{if(btn)btn.textContent="上传中 "+p+"% · "+bytesText(f.size)});
      }
      if(btn){btn.disabled=true;btn.textContent="正在保存资料信息…"}
      const ins=await supabase.from("lab_files").insert({title,description:description||null,category,resource_mode:mode,external_url,file_name,storage_path,file_size,mime_type,created_by:state.user.id});
      if(ins.error){if(storage_path)await supabase.storage.from("lab-files").remove([storage_path]);throw ins.error}
      e.target.reset();toggleLabFileMode();toast(mode==="file"?"文件已发布到资料库":mode==="link"?"链接已发布到资料库":"文字资料已发布");
    }catch(err){console.error("资料库发布失败",err);toast("发布失败："+(err?.message||String(err)))}
    finally{if(btn){btn.disabled=false;btn.textContent=oldText}}
  };
  const toggleLabFileMode=()=>{
    const mode=q("#labFileMode")?.value||"file";
    q("#labFileCategoryWrap")?.classList.toggle("hidden",mode!=="file");
    q("#labFileInputWrap")?.classList.toggle("hidden",mode!=="file");
    q("#labFileLinkWrap")?.classList.toggle("hidden",mode!=="link");
    q("#labFileDescLabel").textContent=mode==="text"?"文字内容":"资料说明";
    q("#labFileDesc").placeholder=mode==="text"?"直接填写要分享的文字内容":mode==="link"?"可补充链接说明":"说明文件用途、版本、适用对象等";
  };
  q("#labFileMode").onchange=toggleLabFileMode;toggleLabFileMode();
  q("#workForm").onsubmit=async e=>{e.preventDefault();const title=q("#workTitle").value.trim();if(!title)return toast("请填写作品名称");let cover_url="",storage_path=null;const f=q("#workCover").files[0];const btn=e.submitter||q("#workForm button");const oldText=btn?.textContent||"发布作品";try{if(f){storage_path=storageObjectPath("covers",f.name);if(btn){btn.disabled=true;btn.textContent="封面上传中 0%"}await uploadStorageFile("works",storage_path,f,p=>{if(btn)btn.textContent="封面上传中 "+p+"%"});cover_url=supabase.storage.from("works").getPublicUrl(storage_path).data.publicUrl}if(btn){btn.disabled=true;btn.textContent="正在发布…"}const ins=await supabase.from("past_works").insert({title,year:q("#workYear").value?Number(q("#workYear").value):null,team_name:q("#workTeam").value.trim(),description:q("#workDesc").value.trim(),cover_url:cover_url||null,storage_path,detail_url:q("#workUrl").value.trim()||null,created_by:state.user.id});if(ins.error){if(storage_path)await supabase.storage.from("works").remove([storage_path]);throw ins.error}e.target.reset();toast("往届作品发布成功");setTimeout(()=>location.href="./works.html",450)}catch(err){console.error("作品发布失败",err);toast("作品发布失败："+(err?.message||String(err)))}finally{if(btn){btn.disabled=false;btn.textContent=oldText}}};
  q("#examForm").onsubmit=async e=>{e.preventDefault();const title=q("#examTitle").value.trim(),f=q("#pdf").files[0];if(!title)return toast("请填写任务标题");if(!f)return toast("请选择 PDF 文件");if(!/\.pdf$/i.test(f.name))return toast("任务文件必须是 PDF");const p=storageObjectPath("pdf",f.name);const btn=e.submitter||q("#examForm button");const oldText=btn?.textContent||"发布任务";try{if(btn){btn.disabled=true;btn.textContent="PDF 上传中 0% · "+bytesText(f.size)}await uploadStorageFile("exams",p,f,x=>{if(btn)btn.textContent="PDF 上传中 "+x+"% · "+bytesText(f.size)});const url=supabase.storage.from("exams").getPublicUrl(p).data.publicUrl;if(btn)btn.textContent="正在发布任务…";const ins=await supabase.from("exams").insert({title,description:q("#examDesc").value.trim(),deadline:q("#deadline").value?new Date(q("#deadline").value).toISOString():null,file_url:url,storage_path:p,created_by:state.user.id});if(ins.error){await supabase.storage.from("exams").remove([p]);throw ins.error}e.target.reset();toast("试卷 / 任务发布成功");setTimeout(()=>location.href="./exams.html",450)}catch(err){console.error("任务发布失败",err);toast("任务发布失败："+(err?.message||String(err)))}finally{if(btn){btn.disabled=false;btn.textContent=oldText}}};
  q("#tutorialForm").onsubmit=async e=>{e.preventDefault();const type=q("#resourceType").value,mode=q("#resourceMode").value,title=q("#tutorialTitle").value.trim();let url=q("#resourceUrl").value.trim(),storage_path=null,file_name=null;if(mode==="url"){url=normalizeExternalUrl(url);if(!url)return toast("请输入正确的外部链接");if(isOwnPlatformUrl(url))return toast("你填的是本站首页/后台地址，请粘贴真正的视频或资料链接");}const btn=e.submitter||q("#tutorialForm button[type=submit]")||q("#tutorialForm button");const oldText=btn?.textContent||"发布教程";try{if(!title)return toast("请填写教程标题");if(mode==="file"){const f=q("#resourceFile").files[0];if(!f)return toast("请选择要上传的教程文件");if(type==="pdf"&&!/\.pdf$/i.test(f.name))return toast("PDF 教程请选择 .pdf 文件");if(type==="word"&&!/\.(doc|docx)$/i.test(f.name))return toast("Word 教程请选择 .doc 或 .docx 文件");if(type==="ppt"&&!/\.(ppt|pptx)$/i.test(f.name))return toast("PPT 教程请选择 .ppt 或 .pptx 文件");if(type==="archive"&&!/\.(zip|rar|7z)$/i.test(f.name))return toast("压缩包教程请选择 .zip、.rar 或 .7z 文件");if(type==="video"&&!(f.type||"").startsWith("video/")&&!/\.(mp4|webm|ogg|mov|m4v)$/i.test(f.name))return toast("请选择视频文件");storage_path=tutorialStoragePath(type,f.name);file_name=f.name;if(btn){btn.disabled=true;btn.textContent="上传中 0% · "+bytesText(f.size)}await uploadTutorialFile(storage_path,f,p=>{if(btn)btn.textContent="上传中 "+p+"% · "+bytesText(f.size)});url=supabase.storage.from("tutorials").getPublicUrl(storage_path).data.publicUrl}if(!url)return toast("请输入资料链接或选择文件");if(btn){btn.disabled=true;btn.textContent="正在发布…"}const ins=await supabase.from("tutorials").insert({title,description:q("#tutorialDesc").value.trim(),video_url:url,resource_type:type,file_name,storage_path,created_by:state.user.id});if(ins.error){if(storage_path)await supabase.storage.from("tutorials").remove([storage_path]);throw ins.error}e.target.reset();toggleResourceForm();toast(resourceTypeName(type)+"发布成功");setTimeout(()=>location.href="./tutorials.html",450)}catch(err){const msg=err?.message||String(err);console.error("教程发布失败",err);if(/maximum|too large|payload|entity too large|exceeded/i.test(msg))toast("文件超过当前存储上传上限，请压缩视频或改用外部链接");else if(/row-level security|policy|permission|unauthorized|jwt/i.test(msg))toast("发布权限或登录状态异常，请重新登录后再试");else toast("发布失败："+msg)}finally{if(btn){btn.disabled=false;btn.textContent=oldText}}};
  function toggleResourceForm(){const type=q("#resourceType").value,mode=q("#resourceMode").value,isFile=mode==="file";q("#resourceUrlWrap").classList.toggle("hidden",isFile);q("#resourceFileWrap").classList.toggle("hidden",!isFile);q("#resourceUrlLabel").textContent=type==="video"?"视频链接":type==="pdf"?"PDF 链接":type==="word"?"Word 链接":type==="archive"?"压缩包链接":"PPT 链接";q("#resourceFileLabel").textContent=type==="video"?"视频文件":type==="pdf"?"PDF 文件":type==="word"?"Word 文件":type==="archive"?"压缩包文件":"PPT 文件";q("#resourceFile").accept=type==="video"?"video/*":type==="pdf"?".pdf,application/pdf":type==="word"?".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document":type==="archive"?".zip,.rar,.7z,application/zip,application/x-rar-compressed,application/x-7z-compressed":".ppt,.pptx,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"}q("#resourceType").onchange=toggleResourceForm;q("#resourceMode").onchange=toggleResourceForm;toggleResourceForm();
  await loadAllSubmissions();
}
async function loadAllSubmissions(){
  const r=await supabase.from("submissions").select("*,exams(title),profiles(email,full_name,major)").order("created_at",{ascending:false});const data=r.data||[];
  q("#allBody").innerHTML=data.length?data.map(x=>'<tr><td>'+esc(x.exams?.title||"—")+'</td><td>'+esc(x.profiles?.full_name||"—")+'</td><td>'+esc(x.profiles?.major||"—")+'</td><td>'+esc(x.submitter_name||x.profiles?.email||"—")+'</td><td>'+esc(x.file_name)+'</td><td>'+fmt(x.created_at)+'</td><td><button class="btn ghost dl" data-p="'+esc(x.storage_path)+'">下载</button> <button class="btn danger delSub" data-id="'+esc(x.id)+'" data-p="'+esc(x.storage_path)+'">删除</button></td></tr>').join(""):'<tr><td colspan="7">暂无提交。</td></tr>';
  document.querySelectorAll(".dl").forEach(b=>b.onclick=async()=>{const s=await supabase.storage.from("submissions").createSignedUrl(b.dataset.p,120);if(s.error)return toast(s.error.message);window.open(s.data.signedUrl,"_blank")});
  document.querySelectorAll(".delSub").forEach(b=>b.onclick=async()=>{if(!confirm("确定删除这条提交吗？"))return;if(b.dataset.p){const rm=await supabase.storage.from("submissions").remove([b.dataset.p]);if(rm.error)return toast(rm.error.message)}const d=await supabase.from("submissions").delete().eq("id",b.dataset.id);if(d.error)return toast(d.error.message);toast("提交已删除");await loadAllSubmissions()});
}
let __siteRealtimeTimer=null;
function scheduleRealtimeRefresh(table){
  clearTimeout(__siteRealtimeTimer);
  __siteRealtimeTimer=setTimeout(async()=>{
    try{
      if(table==="profiles"&&state.user){await loadProfile();updateAuthUI()}
      if(page==="home"&&["exams","tutorials","past_works","announcements"].includes(table))return initHome();
      if(page==="works"&&table==="past_works")return initWorks();
      if(page==="exams"&&table==="exams")return initExams();
      if(page==="tutorials"&&table==="tutorials")return initTutorials();
      if(page==="files"&&["lab_files","resource_shares"].includes(table))return initFiles();
      if(page==="submit"&&["exams","profiles"].includes(table))return initSubmit();
      if(page==="mine"&&["submissions","exams","profiles"].includes(table))return initMine();
      if(page==="profile"&&table==="profiles")return initProfile();
      if(page==="admin")return initAdmin();
    }catch(err){console.error("实时刷新失败",table,err)}
  },180);
}
function setupSiteRealtime(){
  if(globalThis.__siteRealtimeChannel)return;
  const ch=supabase.channel("site-content-live");
  ["exams","tutorials","past_works","announcements","lab_files","resource_shares","submissions","profiles"].forEach(table=>{
    ch.on("postgres_changes",{event:"*",schema:"public",table},()=>scheduleRealtimeRefresh(table));
  });
  globalThis.__siteRealtimeChannel=ch.subscribe();
}
async function runPage(){if(page==="home")return initHome();if(page==="works")return initWorks();if(page==="exams")return initExams();if(page==="tutorials")return initTutorials();if(page==="files")return initFiles();if(page==="submit")return initSubmit();if(page==="mine")return initMine();if(page==="profile")return initProfile();if(page==="admin")return initAdmin()}
renderChrome();
const s=await supabase.auth.getSession();state.user=s.data.session?.user||null;await loadProfile();updateAuthUI();await runPage();setupSiteRealtime();
supabase.auth.onAuthStateChange(async(_e,session)=>{state.user=session?.user||null;await loadProfile();updateAuthUI();await runPage()});