import {createClient} from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
let __tusModulePromise=null;
async function getTusModule(){
  if(__tusModulePromise)return __tusModulePromise;
  __tusModulePromise=(async()=>{
    for(const url of [
      "https://cdn.jsdelivr.net/npm/tus-js-client@4.3.1/+esm",
      "https://esm.sh/tus-js-client@4.3.1"
    ]){
      try{
        const mod=await import(url);
        if(mod?.Upload)return mod;
      }catch(err){console.warn("TUS 模块加载失败，尝试备用源",url,err)}
    }
    throw new Error("上传组件加载失败，请切换网络后重试");
  })();
  return __tusModulePromise;
}
const SUPABASE_URL="https://qqkudaaxudxbfyeepyqw.supabase.co";
const SUPABASE_KEY="sb_publishable_Fc_a5wM_PDh_FsaCW2UjzQ_oI98Dhef";
const PROJECT_REF="qqkudaaxudxbfyeepyqw";

// Android APP 双线路：默认使用当前网络；Supabase 请求在 WiFi 等线路
// 失败/长时间无响应时，由原生桥接自动改走蜂窝网络。浏览器端仍使用标准 fetch。
const __platformNativeFetch=globalThis.fetch.bind(globalThis);
function __androidNetworkBridge(){
  try{return globalThis.JUSTNetworkBridge&&typeof globalThis.JUSTNetworkBridge.request==="function"
    ?globalThis.JUSTNetworkBridge:null}catch(_e){return null}
}
async function __platformFetch(input,init={}){
  const bridge=__androidNetworkBridge();
  const url=typeof input==="string"?input:input?.url;
  if(!bridge||!url||!String(url).startsWith(SUPABASE_URL)){
    return __platformNativeFetch(input,init);
  }

  const method=String(init?.method||(input instanceof Request?input.method:"GET")||"GET").toUpperCase();
  const upstreamSignal=init?.signal||(input instanceof Request?input.signal:null);
  const controller=new AbortController();
  let upstreamAbort=null;
  if(upstreamSignal){
    if(upstreamSignal.aborted)controller.abort(upstreamSignal.reason);
    else{
      upstreamAbort=()=>controller.abort(upstreamSignal.reason);
      upstreamSignal.addEventListener("abort",upstreamAbort,{once:true});
    }
  }
  const timer=setTimeout(()=>{
    try{controller.abort(new DOMException("PRIMARY_NETWORK_TIMEOUT","AbortError"))}catch(_e){controller.abort()}
  },6500);

  let directError=null;
  try{
    return await __platformNativeFetch(input,{...init,signal:controller.signal});
  }catch(error){
    directError=error;
  }finally{
    clearTimeout(timer);
    if(upstreamSignal&&upstreamAbort){
      try{upstreamSignal.removeEventListener("abort",upstreamAbort)}catch(_e){}
    }
  }

  if(upstreamSignal?.aborted)throw (upstreamSignal.reason||directError||new Error("REQUEST_ABORTED"));

  let body=init?.body??null;
  if(body==null&&input instanceof Request&&!["GET","HEAD"].includes(method)){
    try{body=await input.clone().text()}catch(_e){}
  }
  if(body!=null&&typeof body!=="string"){
    throw directError||new TypeError("当前备用线路不支持该请求体");
  }

  try{
    const headers={};
    if(input instanceof Request){
      input.headers.forEach((v,k)=>{headers[k]=v});
    }
    new Headers(init?.headers||{}).forEach((v,k)=>{headers[k]=v});
    const raw=bridge.request(method,String(url),JSON.stringify(headers),body||"");
    const result=JSON.parse(String(raw||"{}"));
    if(result?.error)throw new Error(result.error);
    globalThis.__justCellularFallbackUsedAt=Date.now();
    try{
      globalThis.dispatchEvent(new CustomEvent("just-network-fallback",{detail:{route:"cellular",url:String(url)}}));
    }catch(_e){}
    return new Response(result?.body??"",{
      status:Number(result?.status||502),
      headers:result?.headers||{}
    });
  }catch(nativeError){
    console.warn("蜂窝备用线路调用失败",nativeError);
    throw directError||nativeError;
  }
}
const supabase=createClient(SUPABASE_URL,SUPABASE_KEY,{global:{fetch:__platformFetch}});
const page=document.body.dataset.page||"home";
const q=s=>document.querySelector(s);
globalThis.addEventListener?.("just-network-fallback",()=>{
  const auth=q("#auth"),pass=q("#passAuth");
  const authMsg=q("#authMsg"),passMsg=q("#passMsg");
  if(auth?.open&&authMsg)authMsg.textContent="WiFi 线路不稳定，已自动切换移动数据备用线路…";
  if(pass?.open&&passMsg)passMsg.textContent="WiFi 线路不稳定，已自动切换移动数据备用线路继续注册…";
});
const state={user:null,profile:null,authz:null};
let __passwordChangeReauthBusy=false;
const teamMemberSelection=new Set();
const teamMemberDirectory=new Map();
const THEME_KEY="justLabTokyoV2Theme";
const REMEMBER_LOGIN_KEY="justLabTokyoV2RememberLogin";
const SESSION_LOGIN_KEY="justLabTokyoV2SessionLogin";
const progressSignedUrlCache=new Map();
const PROGRESS_SIGNED_URL_TTL=50*60*1000;
const __inflightRequests=new Map();
function singleFlight(key,factory){
  const existing=__inflightRequests.get(key);
  if(existing)return existing;
  const promise=Promise.resolve()
    .then(factory)
    .finally(()=>{
      if(__inflightRequests.get(key)===promise)__inflightRequests.delete(key);
    });
  __inflightRequests.set(key,promise);
  return promise;
}
function authScopedKey(key){
  return key+":"+(state.user?.id||"anon");
}
function fetchHomeMetricsOnce(){
  return singleFlight("rpc:get_home_operational_metrics",()=>supabase.rpc("get_home_operational_metrics"));
}
function fetchMemberCountOnce(){
  return singleFlight("rpc:get_member_count",()=>supabase.rpc("get_member_count"));
}
function fetchProgressRemindersOnce(){
  return singleFlight(authScopedKey("rpc:get_progress_reminders"),()=>supabase.rpc("get_progress_reminders"));
}
function fetchProgressMemberStatusOnce(){
  return singleFlight(authScopedKey("rpc:get_progress_member_status"),()=>supabase.rpc("get_progress_member_status"));
}
function fetchFormalMemberDirectoryOnce(){
  return singleFlight(authScopedKey("rpc:get_formal_member_directory"),()=>supabase.rpc("get_formal_member_directory"));
}
function fetchSiteNotificationsOnce(){
  return singleFlight(authScopedKey("rpc:get_site_notifications"),()=>supabase.rpc("get_site_notifications"));
}
const PROFILE_CACHE_KEY="justLabTokyoV2ProfileCache";
const PROFILE_CACHE_LEGACY_KEYS=["justLabTokyoV2ProfileCacheV2","justLabTokyoV2ProfileCacheV1"];
const PROFILE_CACHE_TTL=30*24*60*60*1000;
const AUTHZ_CACHE_KEY="justLabTokyoV2AuthzCacheV1";
const AUTHZ_CACHE_TTL=10*60*1000;
const STARTUP_SPLASH_STARTED=performance.now();
let __startupSplashDone=false;
let __authBootstrapDone=false;
let __resolveAuthBootstrap;
const __authBootstrapReady=new Promise(resolve=>{__resolveAuthBootstrap=resolve});
let __authLoginBusy=false;
let __authLoginSeq=0;
let __manualLoginEpoch=0;
let __authRegisterBusy=false;
let __authRegisterSeq=0;
let __authRegisterEpoch=0;
const AUTH_RESTORE_TIMEOUT=4000;
const LOGIN_SLOW_NOTICE_MS=6000;
const LOGIN_HARD_TIMEOUT_MS=30000;
const SIGNUP_SLOW_NOTICE_MS=8000;
const SIGNUP_HARD_TIMEOUT_MS=35000;
function finishAuthBootstrap(){
  if(__authBootstrapDone)return;
  __authBootstrapDone=true;
  try{__resolveAuthBootstrap?.()}catch(_e){}
}
function setStartupSplashStatus(message){
  const el=q("#startupSplashStatus");
  if(el&&message)el.textContent=message;
}
function finishStartupSplash(message){
  if(__startupSplashDone)return;
  const splash=q("#startupSplash");
  if(!splash){__startupSplashDone=true;return}
  __startupSplashDone=true;
  if(message)setStartupSplashStatus(message);
  try{sessionStorage.setItem("justLabTokyoV2SplashSeen","1")}catch(_e){}
  const wait=Math.max(0,520-(performance.now()-STARTUP_SPLASH_STARTED));
  setTimeout(()=>{
    splash.classList.add("isLeaving");
    setTimeout(()=>splash.remove(),360);
  },wait);
}
function runWhenIdle(fn,timeout=1400){
  const task=()=>Promise.resolve().then(fn).catch(err=>console.warn("后台延迟任务失败",err));
  if("requestIdleCallback" in globalThis)globalThis.requestIdleCallback(task,{timeout});
  else setTimeout(task,450);
}
function preferredTheme(){
  try{
    const saved=localStorage.getItem(THEME_KEY);
    if(saved==="light"||saved==="dark")return saved;
  }catch(_e){}
  return globalThis.matchMedia?.("(prefers-color-scheme: light)")?.matches?"light":"dark";
}
function applyTheme(theme,save=false){
  const next=theme==="light"?"light":"dark";
  document.documentElement.dataset.theme=next;
  document.documentElement.style.colorScheme=next;
  if(save){try{localStorage.setItem(THEME_KEY,next)}catch(_e){}}
  const btn=q("#themeToggle");
  if(btn){
    const hint=next==="light"?"切换为深色模式":"切换为浅色模式";
    btn.setAttribute("aria-label",hint);
    btn.setAttribute("title",hint);
    btn.innerHTML=next==="light"?"<svg class=\"themeGlyph\" width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.85\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M20.985 12.486A9 9 0 0 1 11.514 3.015a9 9 0 1 0 9.47 9.47\"/></svg>":"<svg class=\"themeGlyph\" width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.85\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\" focusable=\"false\"><circle cx=\"12\" cy=\"12\" r=\"4\"/><path d=\"M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42\"/></svg>";
  }
}
applyTheme(preferredTheme());

const SITE_VISIT_SESSION_KEY="justLabTokyoV2SiteVisitSessionV1";
async function logSiteVisitOnce(){
  try{
    const today=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Shanghai",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
    const saved=sessionStorage.getItem(SITE_VISIT_SESSION_KEY);
    if(saved===today)return;
    const r=await supabase.rpc("log_site_visit");
    if(!r.error)sessionStorage.setItem(SITE_VISIT_SESSION_KEY,today);
  }catch(_e){}
}
void logSiteVisitOnce();
const DESKTOP_SESSION_KEY="justTokyoV2Desktop";
const desktopMode=(()=>{
  try{
    const params=new URLSearchParams(location.search);
    if(params.get("desktop")==="1")sessionStorage.setItem(DESKTOP_SESSION_KEY,"1");
    return sessionStorage.getItem(DESKTOP_SESSION_KEY)==="1";
  }catch(_e){return false}
})();
if(desktopMode){
  document.addEventListener("click",event=>{
    const anchor=event.target?.closest?.("a[href]");
    if(!anchor)return;
    const raw=anchor.getAttribute("href")||"";
    if(!raw||raw.startsWith("#")||/^javascript:/i.test(raw))return;
    let target;
    try{target=new URL(anchor.href,location.href)}catch(_e){return}
    const supported=["http:","https:","mailto:","tel:"].includes(target.protocol);
    const shouldCurrent=supported&&(anchor.target==="_blank"||anchor.hasAttribute("download")||!isOwnPlatformUrl(target.href));
    if(!shouldCurrent)return;
    event.preventDefault();
    event.stopPropagation();
    location.assign(target.href);
  },true);
  const nativeWindowOpen=window.open.bind(window);
  window.open=(url,target,features)=>{
    if(url){
      try{
        const next=new URL(String(url),location.href);
        if(["http:","https:","mailto:","tel:"].includes(next.protocol)){
          location.assign(next.href);
          return null;
        }
      }catch(_e){}
    }
    return nativeWindowOpen(url,target,features);
  };
}
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fmt=v=>v?new Date(v).toLocaleString("zh-CN",{hour12:false}):"未设置";
const safe=n=>n.replace(/[^\w.\-\u4e00-\u9fff]/g,"_");
function toast(m){const t=q("#toast");if(!t)return;t.textContent=m;t.classList.add("on");setTimeout(()=>t.classList.remove("on"),2500)}
const __moduleRetryHandlers=new Map();
function moduleRetryMarkup(message,key){
  return '<div class="empty moduleRetryBox"><div>'+esc(message||"模块加载失败，请稍后重试。")+'</div><div class="actions" style="justify-content:center;margin-top:12px"><button class="btn sec moduleRetryBtn" type="button" data-retry-key="'+esc(key)+'">重新加载</button></div></div>';
}
function registerModuleRetry(key,handler){
  if(!key||typeof handler!=="function")return;
  __moduleRetryHandlers.set(key,handler);
  setTimeout(()=>{
    document.querySelectorAll('.moduleRetryBtn[data-retry-key="'+CSS.escape(key)+'"]').forEach(btn=>{
      btn.onclick=async()=>{
        if(btn.disabled)return;
        const old=btn.textContent;
        btn.disabled=true;
        btn.textContent="正在重试…";
        try{await handler()}
        catch(err){
          console.warn("模块重试失败",key,err);
          btn.disabled=false;
          btn.textContent=old;
        }
      };
    });
  },0);
}
function showModuleRetry(target,message,key,handler){
  const el=typeof target==="string"?q(target):target;
  if(!el)return;
  el.innerHTML=moduleRetryMarkup(message,key);
  registerModuleRetry(key,handler);
}
function profileDisplayOnly(row){
  if(!row)return null;
  return {
    id:row.id||null,
    email:row.email||null,
    full_name:row.full_name||null,
    major:row.major||null,
    phone:row.phone||null,
    qq:row.qq||null,
    created_at:row.created_at||null
  };
}
function profileAuthzOnly(row){
  if(!row)return null;
  return {
    role:row.role||"member",
    membership_status:row.membership_status||"formal"
  };
}
function authzRole(){return state.authz?.role||"member"}
function membershipStatus(){return state.authz?.membership_status||null}
function isAdmin(){return ["admin","super_admin"].includes(authzRole())}
function roleName(r){return r==="super_admin"?"主管理员":r==="admin"?"副管理员":"普通成员"}
function navLink(key,href,label){return '<a class="'+(page===key?"active":"")+'" href="'+href+'">'+label+'</a>'}
function renderChrome(){
  const globalSearchMarkup='<div class="globalSearch" id="globalSearch"><div class="globalSearchInputWrap"><span class="globalSearchIcon">⌕</span><input id="globalSearchInput" type="search" autocomplete="off" placeholder="搜索项目、成员、教程、资料、作品、公告…" aria-label="全站搜索关键词"><button id="globalSearchClear" class="globalSearchClear hidden" type="button" aria-label="清空搜索">×</button></div><div id="globalSearchResults" class="globalSearchResults hidden" aria-live="polite"></div></div>';
  q("#siteHeader").innerHTML='<header class="siteHeader '+(page==="home"?"homeSearchHeader":"")+'"><div class="wrap headerInner"><a class="brand" href="./index.html"><img src="./assets/lab-logo-transparent.svg?v=3" alt="实验室标志"><span class="brandText"><b><span class="brandSchoolName">江苏科技大学</span><span class="brandLabName">机械创新实验室</span></b><small>交流平台 · 学习资料 · 项目协作</small></span></a>'+(page==="home"?globalSearchMarkup:"")+'<nav class="nav">'+
    navLink("lab","./lab.html","实验室")+navLink("works","./works.html","往届作品")+'<span class="navSep"></span>'+
    navLink("exams","./exams.html","试卷任务")+navLink("tutorials","./tutorials.html","教程")+navLink("files","./files.html?v=20260924-2458","资料库")+navLink("projects","./projects.html","项目管理")+navLink("progress","./progress.html","近期进度")+navLink("space","./space.html","进度空间")+'<span class="navSep"></span>'+
    navLink("submit","./submit.html","提交作业")+navLink("mine","./mine.html","我的提交")+navLink("profile","./profile.html?v=20260925-profilehome11","个人主页")+navLink("download","./download.html","软件下载")+navLink("notify-settings","./notify-settings.html","🔔 通知设置")+
    '<span class="navSep adminSep hidden"></span><a id="adminNav" class="'+(page==="admin"?"active ":"")+'hidden" href="./admin.html">管理后台</a></nav><div class="acct">'+(page==="home"?"":'<button id="globalSearchLaunch" class="btn ghost globalSearchLaunch" type="button" aria-label="打开全站搜索" title="全站搜索（Ctrl+K）">⌕ <span>搜索</span></button>')+'<button id="themeToggle" class="btn ghost themeToggle" type="button"></button><button id="notifyOpen" class="btn ghost hidden" type="button" aria-label="站内通知" title="站内通知">🔔<span id="notifyDot" class="notifyDot hidden"></span></button><a id="adminQuick" class="btn sec hidden" href="./admin.html">管理后台</a><span id="badge" class="pill hidden"></span><button id="changePasswordOpen" class="btn ghost hidden" type="button" title="修改当前账号的登录密码">修改密码</button><button id="authOpen" class="btn ghost">登录</button><button id="logout" class="btn ghost hidden">退出</button><button id="accountMenuToggle" class="btn ghost hidden" type="button" aria-label="打开账户菜单" aria-controls="accountMenuPanel" aria-expanded="false"><span id="accountMenuAvatar" class="accountMenuAvatar" aria-hidden="true">我</span><span id="accountMenuName" class="accountMenuName">我的账户</span><span class="accountMenuChevron" aria-hidden="true">⌄</span></button><div id="accountMenuPanel" class="hidden" aria-label="账户管理"><div class="accountMenuHeading">账户管理</div><a href="./profile.html" class="accountMenuItem">👤　个人主页</a><a href="./notify-settings.html" class="accountMenuItem">🔔　微信 / 系统通知设置</a><a id="accountMenuAdmin" href="./admin.html" class="accountMenuItem hidden">⚙️　管理后台</a><button id="accountMenuPassword" class="accountMenuItem" type="button">🔒　修改密码</button><button id="accountMenuLogout" class="accountMenuItem accountMenuExit" type="button">↪　退出登录</button></div></div></div></header>';
  q("#siteFooter").innerHTML='<footer class="foot"><div class="wrap footInner"><img src="./assets/lab-logo-transparent.svg?v=3" alt="实验室标志"><div><b>江苏科技大学机械创新实验室</b><small>交流平台 · 学习资料 · 项目协作</small></div></div></footer>';
  document.body.insertAdjacentHTML("beforeend",'<dialog id="auth" class="dialog"><div class="dialogbox"><h2 id="authModeTitle" style="margin:0">成员登录</h2><p id="authModeHint" style="margin:0;color:#8fa4bd">已注册成员只需要邮箱和密码即可登录。</p><div id="registerFields" class="two hidden"><label>姓名（首次注册必填）<input id="regName" maxlength="40" autocomplete="name" placeholder="请输入真实姓名"></label><label>年级 / 校区 / 专业（首次注册必填）<input id="regMajor" maxlength="60" placeholder="例如：24级东校区机械工程；苏理工机械工程"></label><label>是否为大一新生<select id="regFreshman"><option value="">请选择</option><option value="yes">是，我是大一新生</option><option value="no">否，我是正式成员</option></select></label></div><label>邮箱<input id="email" type="email" autocomplete="email"></label><label>密码<input id="password" type="password" minlength="6" autocomplete="current-password"></label><label id="rememberLoginWrap" style="display:flex;align-items:center;gap:8px;font-size:13px;color:#9db0c5;cursor:pointer"><input id="rememberLogin" type="checkbox" checked style="width:16px;height:16px;margin:0">记住登录状态 <span style="opacity:.72">（下次打开无需重新登录）</span></label><div class="actions"><button id="login" class="btn pri" type="button">登录</button><button id="retryLogin" class="btn sec hidden" type="button">重新连接</button><button id="showRegister" class="btn sec" type="button">首次注册</button><button id="continueRegister" class="btn pri hidden" type="button">继续注册</button><button id="backLogin" class="btn ghost hidden" type="button">返回登录</button><button id="closeAuth" class="btn ghost" type="button">关闭</button></div><small id="authMsg" style="color:#8fa4bd"></small></div></dialog><dialog id="passwordChangeDialog" class="dialog"><form id="passwordChangeForm" class="dialogbox" style="width:min(470px,92vw)" autocomplete="off"><div><span class="eyebrow">ACCOUNT SECURITY</span><h2 style="margin:5px 0 0">修改登录密码</h2><p style="color:#8fa4bd;font-size:13px;line-height:1.65;margin:8px 0 2px">请先验证当前密码。修改成功后，下次登录请使用新密码。</p></div><label>当前密码<input id="passwordCurrent" type="password" autocomplete="current-password" required placeholder="请输入当前登录密码"></label><label>新密码<input id="passwordNext" type="password" autocomplete="new-password" minlength="8" maxlength="72" required placeholder="8–72 位，须同时包含字母和数字"></label><label>确认新密码<input id="passwordNextConfirm" type="password" autocomplete="new-password" minlength="8" maxlength="72" required placeholder="再次输入新密码"></label><small id="passwordChangeMessage" role="status" aria-live="polite" style="color:#9db0c5;min-height:1.3em"></small><div class="actions"><button id="passwordChangeCancel" class="btn ghost" type="button">取消</button><button id="passwordChangeSubmit" class="btn pri" type="submit">保存新密码</button></div></form></dialog><dialog id="passAuth" class="dialog"><div class="dialogbox"><span class="eyebrow">LAB ACCESS</span><h2 style="margin:0">实验室通行证验证</h2><p style="margin:0;color:#8fa4bd">通行证只在首次注册时验证，之后登录无需再次填写。</p><label>实验室通行证<input id="passcodeConfirm" type="password" autocomplete="off"></label><div class="actions"><button id="confirmPasscode" class="btn pri" type="button">验证并注册</button><button id="cancelPasscode" class="btn ghost" type="button">返回</button></div><small id="passMsg" style="color:#8fa4bd"></small></div></dialog><dialog id="notifyDialog" class="dialog"><div class="dialogbox notifyDialogBox"><div class="notifyHead"><div><span class="eyebrow">NOTIFICATIONS</span><h2 style="margin:0">站内通知</h2></div><button id="notifyClose" class="btn ghost" type="button">关闭</button></div><div class="notifyToolbar"><span id="notifySummary">正在加载…</span><button id="notifyReadAll" class="btn sec" type="button">全部标为已读</button></div><div id="notifyList" class="notifyList"><div class="empty">正在加载通知…</div></div></div></dialog><style id="notifyStyles">#notifyOpen{position:relative;min-width:44px}.notifyDot{position:absolute;right:6px;top:5px;min-width:17px;height:17px;padding:0 4px;border-radius:99px;background:#e45b66;color:white;font-size:10px;line-height:17px;text-align:center;border:2px solid rgba(15,22,32,.9)}.notifyDialogBox{width:min(720px,92vw);max-height:82vh}.notifyHead,.notifyToolbar{display:flex;align-items:center;justify-content:space-between;gap:12px}.notifyToolbar{margin-top:10px;color:#8fa4bd;font-size:13px}.notifyList{display:flex;flex-direction:column;gap:10px;margin-top:14px;max-height:58vh;overflow:auto;padding-right:3px}.notifyItem{display:block;text-decoration:none;border:1px solid #26384d;border-radius:14px;padding:13px 14px;background:#101a27;color:inherit}.notifyItem.unread{border-color:#426b9e;background:#122238;box-shadow:0 0 0 1px #426b9e24}.notifyItem:hover{transform:translateY(-1px)}.notifyItemTop{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}.notifyItem b{font-size:14px}.notifyItem p{margin:5px 0 0;color:#a9b8ca;font-size:13px;line-height:1.55}.notifyItem time{white-space:nowrap;color:#708399;font-size:11px}.notifyType{display:inline-flex;align-items:center;gap:5px;margin-bottom:5px;font-size:11px;color:#7ea8d8}.notifyUnreadMark{width:7px;height:7px;border-radius:50%;background:#5ba6ff;display:inline-block}.notifyEmpty{padding:28px 10px;text-align:center;color:#8092a7}.notifyItem[data-type="deadline"].unread,.notifyItem[data-type="progress"].unread{border-color:#8b4950;background:#2b171b}html[data-theme="light"] .notifyItem{background:#fff;border-color:#dbe4ee}html[data-theme="light"] .notifyItem.unread{background:#f2f7ff;border-color:#8db5e6}html[data-theme="light"] .notifyItem p{color:#5f6f81}html[data-theme="light"] .notifyDot{border-color:#fff}@media(max-width:620px){.notifyItemTop{flex-direction:column}.notifyToolbar{align-items:flex-start;flex-direction:column}}.siteHeader.homeSearchHeader .headerInner{grid-template-columns:minmax(210px,255px) minmax(360px,760px) max-content;grid-template-areas:"brand search acct" "nav nav nav";row-gap:7px}.siteHeader.homeSearchHeader .brand{grid-area:brand}.siteHeader.homeSearchHeader .globalSearch{grid-area:search;position:relative;width:100%;justify-self:center;z-index:70}.siteHeader.homeSearchHeader .acct{grid-area:acct;justify-self:end}.siteHeader.homeSearchHeader .nav{grid-area:nav;justify-content:flex-start;border-top:1px solid #ffffff0d;padding:6px 0 2px}.globalSearchInputWrap{height:44px;display:flex;align-items:center;gap:9px;padding:0 12px;border:1px solid #2a4665;border-radius:14px;background:#0a192acc;box-shadow:0 7px 24px #0002}.globalSearchInputWrap:focus-within{border-color:#5b8bc2;box-shadow:0 0 0 3px #4c83bd20,0 8px 26px #0003}.globalSearchIcon{font-size:21px;color:#77a7d8;line-height:1}.globalSearchInputWrap input{flex:1;min-width:0;border:0;outline:0;background:transparent;color:#edf5ff;padding:0;font-size:14px}.globalSearchInputWrap input::placeholder{color:#7189a5}.globalSearchClear{width:28px;height:28px;border:0;border-radius:9px;background:#162b43;color:#9fb8d2;cursor:pointer;font-size:18px;line-height:1}.globalSearchResults{position:absolute;top:calc(100% + 8px);left:0;right:0;max-height:min(64vh,560px);overflow:auto;padding:7px;border:1px solid #284563;border-radius:16px;background:#081522f7;box-shadow:0 20px 60px #0008;backdrop-filter:blur(18px)}.globalSearchItem{display:grid;grid-template-columns:36px minmax(0,1fr) 18px;gap:10px;align-items:center;padding:10px 11px;border-radius:11px}.globalSearchItem:hover{background:#102941}.globalSearchItemIcon{width:34px;height:34px;display:grid;place-items:center;border-radius:10px;background:#102a44;font-size:16px}.globalSearchItemBody{display:flex;flex-direction:column;min-width:0}.globalSearchItemBody b{font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.globalSearchItemBody small{font-size:11px;color:#8299b3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.globalSearchArrow{color:#6385a9;font-size:20px}.globalSearchMessage{padding:18px 14px;text-align:center;color:#8198b2;font-size:13px}html[data-theme="light"] .globalSearchInputWrap{background:#fff;border-color:#c8d9e8;box-shadow:0 7px 24px #31557910}html[data-theme="light"] .globalSearchInputWrap input{color:#18314c}html[data-theme="light"] .globalSearchResults{background:#fff;border-color:#ccdae7;box-shadow:0 20px 50px #28435b24}html[data-theme="light"] .globalSearchItem:hover{background:#f0f6fb}html[data-theme="light"] .globalSearchItemIcon{background:#edf5fb}@media(max-width:1200px){.siteHeader.homeSearchHeader .headerInner{grid-template-columns:minmax(0,1fr) max-content;grid-template-areas:"brand acct" "search search" "nav nav"}.siteHeader.homeSearchHeader .globalSearch{max-width:none}}@media(max-width:720px){.globalSearchInputWrap{height:42px}.globalSearchInputWrap input{font-size:13px}.siteHeader.homeSearchHeader .headerInner{grid-template-areas:"brand acct" "search search" "nav nav"}}/* Mobile header v20261013: prevent branding compression and route account controls to an overflow menu */ #accountMenuToggle{display:none!important} #accountMenuPanel{position:absolute;right:0;top:calc(100% + 9px);z-index:100;width:226px;max-width:calc(100vw - 24px);padding:8px;border-radius:16px;border:1px solid #35516f;background:#0d1c2e;box-shadow:0 18px 45px rgba(0,0,0,.3);color:#eaf3ff} #accountMenuPanel .accountMenuHeading{padding:8px 12px 10px;color:#91abc7;font-size:12px;letter-spacing:.04em;font-weight:750} #accountMenuPanel .accountMenuItem{display:block;width:100%;padding:12px 13px;border:0;border-radius:10px;background:transparent;text-align:left;color:inherit;font:inherit;font-size:14px;cursor:pointer;text-decoration:none;white-space:nowrap} #accountMenuPanel .accountMenuItem:hover,#accountMenuPanel .accountMenuItem:focus-visible{background:rgba(108,156,230,.16);outline:none} #accountMenuPanel .accountMenuExit{color:#f2aeb8;border-top:1px solid rgba(144,163,190,.13);border-radius:0 0 9px 9px;margin-top:5px} html[data-theme="light"] #accountMenuPanel{background:#fff;color:#273f58;border-color:#d7e3ef;box-shadow:0 18px 45px rgba(37,72,112,.17)} html[data-theme="light"] #accountMenuPanel .accountMenuHeading{color:#6a8098} html[data-theme="light"] #accountMenuPanel .accountMenuItem:hover,html[data-theme="light"] #accountMenuPanel .accountMenuItem:focus-visible{background:#edf4fe} html[data-theme="light"] #accountMenuPanel .accountMenuExit{color:#bd3f57} @media(max-width:720px){ .siteHeader .headerInner{width:calc(100% - 24px);min-height:0;display:grid;grid-template-columns:minmax(0,1fr) max-content;grid-template-areas:"brand acct" "nav nav";align-items:center;gap:8px 8px;padding:9px 0 7px} .siteHeader.homeSearchHeader .headerInner{grid-template-columns:minmax(0,1fr) max-content;grid-template-areas:"brand acct" "search search" "nav nav";gap:8px 8px} .siteHeader .brand{grid-area:brand;display:flex;align-items:center;min-width:0;max-width:100%;gap:9px;overflow:hidden} .siteHeader .brand img{height:44px!important;width:44px!important;min-width:44px;flex:0 0 44px;border-radius:50%!important} .siteHeader .brandText{display:block;min-width:0;flex:1} .siteHeader .brandText b{font-size:13px!important;line-height:1.35;letter-spacing:0;white-space:normal!important;font-weight:850} .siteHeader .brandText b>span{display:block;white-space:nowrap} .siteHeader .brandText small{display:none!important} .siteHeader .acct{grid-area:acct;min-width:0;display:flex;align-items:center;gap:5px;justify-self:end;margin:0;position:relative} .siteHeader .acct #adminQuick,.siteHeader .acct #logout,.siteHeader .acct #changePasswordOpen{display:none!important} .siteHeader .acct #accountMenuToggle:not(.hidden){display:inline-flex!important} .siteHeader .acct #themeToggle,.siteHeader .acct #notifyOpen,.siteHeader .acct #accountMenuToggle{width:38px;height:38px;min-width:38px!important;padding:0!important;display:inline-flex;justify-content:center;align-items:center;border-radius:12px;font-size:18px;line-height:1} .siteHeader .acct #notifyOpen.hidden,.siteHeader .acct #accountMenuToggle.hidden{display:none!important} .siteHeader .acct #authOpen{height:38px;padding:0 12px!important;font-size:12px!important} .siteHeader .nav{grid-area:nav;width:100%;min-width:0;overflow-x:auto;overflow-y:hidden;-webkit-overflow-scrolling:touch;overscroll-behavior-x:contain;scroll-snap-type:x proximity;justify-content:flex-start;gap:3px;margin:0;padding:5px 0 2px;border-top:1px solid rgba(126,151,180,.13)} .siteHeader .nav a{flex:0 0 auto;scroll-snap-align:start;padding:7px 10px!important;font-size:12px!important;line-height:1.45;border-radius:11px;white-space:nowrap} .siteHeader.homeSearchHeader .globalSearch{grid-area:search;width:100%;min-width:0;max-width:100%;margin:0} .siteHeader.homeSearchHeader .globalSearchInputWrap{height:40px;padding:0 12px;border-radius:13px;box-shadow:none} .siteHeader.homeSearchHeader .globalSearchInputWrap input{font-size:12px;min-width:0;text-overflow:ellipsis} .siteHeader{overflow:visible} } @media(max-width:360px){ .siteHeader .brand img{width:40px!important;height:40px!important;min-width:40px;flex-basis:40px} .siteHeader .brandText b{font-size:11.5px!important} .siteHeader .acct{gap:4px} .siteHeader .acct #themeToggle,.siteHeader .acct #notifyOpen,.siteHeader .acct #accountMenuToggle{width:35px;height:35px;min-width:35px!important} } </style><div id="toast" class="toast"></div>');
  if(page!=="home"){
    const dialog=document.createElement("dialog");
    dialog.id="globalSearchDialog";
    dialog.className="globalSearchDialog";
    dialog.setAttribute("aria-label","全站搜索");
    dialog.innerHTML='<div class="globalSearchDialogHead"><strong>全站搜索</strong><button id="globalSearchClose" type="button" class="btn ghost">关闭</button></div>'+globalSearchMarkup+'<p class="globalSearchHelp">搜索项目、成员、资料、教程、作品与公告 · 按 Esc 关闭</p>';
    document.body.append(dialog);
  }
  // Keep the existing navigation semantics, while presenting five primary destinations.
  const topNav=q(".siteHeader .nav");
  const account=q(".siteHeader .acct");
  if(topNav&&account){
    topNav.setAttribute("aria-label","实验室网站导航");
    const homeLink=document.createElement("a");
    homeLink.href="./index.html";homeLink.textContent="首页";
    if(page==="home"){homeLink.className="active";homeLink.setAttribute("aria-current","page")}
    topNav.prepend(homeLink);
    const more=document.createElement("details");
    more.className="uxNavMore";
    const summary=document.createElement("summary");
    summary.textContent="更多模块 ▾";
    summary.setAttribute("aria-label","展开更多实验室模块");
    const panel=document.createElement("div");panel.className="uxMorePanel";
    const primaryKeys=["index.html","projects.html","progress.html","space.html","files.html","tutorials.html"];
    for(const child of [...topNav.children]){
      if(child===homeLink)continue;
      if(child.classList.contains("navSep")){child.remove();continue}
      if(child.id==="adminNav"){panel.appendChild(child);continue}
      const url=child.getAttribute("href")||"";
      const filename=url.split("?")[0].replace(/^\.\//,"");
      if(!primaryKeys.includes(filename))panel.appendChild(child);
      if(child.classList?.contains("active"))child.setAttribute("aria-current","page");
    }
    // Group existing secondary destinations without recreating links or permissions.
    const secondary=[...panel.querySelectorAll(":scope > a")];
    const groups=[
      {title:"实验室与成果",files:new Set(["lab.html","works.html"])},
      {title:"学习与任务",files:new Set(["exams.html","submit.html","mine.html"])},
      {title:"个人与工具",files:new Set(["profile.html","download.html","notify-settings.html"])}
    ];
    const placed=new Set();
    groups.forEach((group,index)=>{
      const links=secondary.filter(link=>{
        const filename=new URL(link.getAttribute("href")||"./index.html",location.href).pathname.split("/").pop();
        return group.files.has(filename);
      });
      if(!links.length)return;
      const section=document.createElement("section");section.className="uxMoreGroup";
      const heading=document.createElement("h2");heading.className="uxMoreGroupTitle";
      heading.id="uxMoreGroup"+index;heading.textContent=group.title;
      section.setAttribute("aria-labelledby",heading.id);
      section.append(heading,...links);panel.append(section);
      links.forEach(link=>placed.add(link));
    });
    const other=secondary.filter(link=>!placed.has(link));
    if(other.length){
      const section=document.createElement("section");section.className="uxMoreGroup";
      const heading=document.createElement("h2");heading.className="uxMoreGroupTitle";
      heading.id="uxMoreGroupOther";heading.textContent="其他与管理";
      section.setAttribute("aria-labelledby",heading.id);
      section.append(heading,...other);panel.append(section);
    }
    if(secondary.some(link=>link.classList.contains("active"))){
      more.classList.add("uxMoreHasActive");
      summary.setAttribute("aria-label","当前页面位于更多模块，展开菜单");
    }
    more.addEventListener("toggle",()=>summary.setAttribute("aria-expanded",String(more.open)));
    summary.setAttribute("aria-expanded","false");
    more.append(summary,panel);topNav.append(more);
    panel.addEventListener("click",event=>{if(event.target.closest("a"))more.open=false});
    document.addEventListener("click",event=>{
      if(more.open&&!more.contains(event.target))more.open=false;
    });
    const mobileToggle=document.createElement("button");
    mobileToggle.type="button";mobileToggle.className="btn ghost uxMobileMenuToggle";
    mobileToggle.textContent="全部模块";mobileToggle.setAttribute("aria-controls","siteMobileSections");
    mobileToggle.setAttribute("aria-expanded","false");mobileToggle.setAttribute("aria-label","展开全部导航模块");
    topNav.id="siteMobileSections";
    account.append(mobileToggle);
    const closeNavigation=()=>{
      q(".siteHeader")?.classList.remove("uxNavOpen");
      mobileToggle.setAttribute("aria-expanded","false");
    };
    mobileToggle.addEventListener("click",()=>{
      const open=q(".siteHeader")?.classList.toggle("uxNavOpen");
      mobileToggle.setAttribute("aria-expanded",String(!!open));
      if(!open)more.open=false;
    });
    document.addEventListener("click",event=>{
      if(q(".siteHeader")?.classList.contains("uxNavOpen")&&!q(".siteHeader")?.contains(event.target))closeNavigation();
    });
    document.addEventListener("keydown",event=>{
      if(event.key!=="Escape")return;
      const wasOpen=more.open;
      closeNavigation();more.open=false;
      if(wasOpen)summary.focus();
    });
    topNav.addEventListener("click",event=>{if(event.target.closest("a"))closeNavigation()});
    const mobileNav=document.createElement("nav");
    mobileNav.className="uxBottomNav";mobileNav.setAttribute("aria-label","手机端常用导航");
    const tabs=[
      ["home","./index.html","⌂","首页"],
      ["progress","./progress.html","▥","进度"],
      ["space","./space.html","◉","空间"],
      ["notification","","♧","消息"],
      ["profile","./profile.html","♙","我的"]
    ];
    for(const [key,href,symbol,label] of tabs){
      const node=key==="notification"?document.createElement("button"):document.createElement("a");
      if(key!=="notification"){node.href=href;if(page===key){node.setAttribute("aria-current","page")}}
      else{node.type="button";node.id="uxBottomNotify";node.setAttribute("aria-label","打开站内通知")}
      const pict=document.createElement("span");pict.className="uxBottomIcon";pict.setAttribute("aria-hidden","true");pict.textContent=symbol;
      const caption=document.createElement("span");caption.className="uxBottomLabel";caption.textContent=label;
      node.append(pict,caption);mobileNav.append(node);
      if(key==="notification")node.addEventListener("click",()=>{
        if(!state.user){q("#authOpen")?.click();return}
        q("#notifyOpen")?.click();
      });
    }
    document.body.append(mobileNav);
  }
  // Read the current app release from its versioned module URL.
  // The old fixed stylesheet URL caused mobile browsers to keep using stale styles.
  const uxModuleVersion=new URL(import.meta.url).searchParams.get("v") || globalThis.JUST_APP_VERSION || "2026.10.21.ui-cache-fix15";
  const uxStyle=document.querySelector('link[data-lab-ux="true"]') || document.createElement("link");
  uxStyle.rel="stylesheet";
  uxStyle.dataset.cacheManaged="";
  uxStyle.dataset.labUx="true";
  uxStyle.href="./ux-phase1-v1.css?v="+encodeURIComponent(uxModuleVersion);
  if(!uxStyle.isConnected)document.head.append(uxStyle);
  document.documentElement.dataset.labUiVersion=uxModuleVersion;
  const themeBtn=q("#themeToggle");
  if(themeBtn){
    applyTheme(document.documentElement.dataset.theme||preferredTheme());
    themeBtn.onclick=()=>{
      const next=document.documentElement.dataset.theme==="light"?"dark":"light";
      applyTheme(next,true);
    };
  }
  bindAuth();
  bindMobileAccountMenu();
  bindPasswordChange();
  bindNotifications();
  bindGlobalSearch();
  enableNavPrefetch();
}


function bindMobileAccountMenu(){
  const toggle=q("#accountMenuToggle");
  const panel=q("#accountMenuPanel");
  if(!toggle||!panel)return;
  const close=()=>{panel.classList.add("hidden");toggle.setAttribute("aria-expanded","false");};
  toggle.onclick=()=>{
    const next=panel.classList.toggle("hidden");
    toggle.setAttribute("aria-expanded",next?"false":"true");
  };
  q("#accountMenuPassword").onclick=()=>{close();q("#changePasswordOpen")?.click()};
  q("#accountMenuLogout").onclick=()=>{close();q("#logout")?.click()};
  document.addEventListener("pointerdown",event=>{
    if(!panel.classList.contains("hidden")&&!panel.contains(event.target)&&!toggle.contains(event.target))close();
  });
  document.addEventListener("keydown",event=>{if(event.key==="Escape")close()});
  window.addEventListener("resize",()=>{if(window.innerWidth>720)close()});
}

function bindGlobalSearch(){
  const root=q("#globalSearch"),input=q("#globalSearchInput"),results=q("#globalSearchResults"),clear=q("#globalSearchClear");
  if(!root||!input||!results||!clear)return;

  let timer=null;
  let seq=0;
  const typeMeta={
    project:["项目","🧩"],
    member:["成员","👤"],
    tutorial:["教程","📚"],
    file:["资料","🗂"],
    share:["分享","🔗"],
    work:["作品","🏆"],
    announcement:["公告","📢"],
    exam:["任务","📄"]
  };
  const close=()=>results.classList.add("hidden");
  const dialog=q("#globalSearchDialog");
  const openSearch=()=>{if(dialog&&!dialog.open)dialog.showModal();input.focus()};
  q("#globalSearchLaunch")?.addEventListener("click",openSearch);
  q("#globalSearchClose")?.addEventListener("click",()=>dialog?.close());
  dialog?.addEventListener("close",()=>{seq++;close();input.value="";clear.classList.add("hidden")});
  document.addEventListener("keydown",event=>{
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==="k"){
      event.preventDefault();openSearch();
    }
  });
  const renderMessage=(msg)=>{results.innerHTML='<div class="globalSearchMessage">'+esc(msg)+'</div>';results.classList.remove("hidden")};

  const run=async()=>{
    const keyword=input.value.trim();
    clear.classList.toggle("hidden",!keyword);
    const mySeq=++seq;
    if(!keyword){close();return}
    if(keyword.length<2){renderMessage("再输入至少 1 个字符即可搜索全站");return}
    if(!state.user){renderMessage("登录后可搜索项目、成员、教程、资料、作品和公告");return}

    results.innerHTML='<div class="globalSearchMessage">正在搜索…</div>';
    results.classList.remove("hidden");
    const r=await supabase.rpc("global_site_search",{p_query:keyword});
    if(mySeq!==seq)return;
    if(r.error){renderMessage("搜索失败："+r.error.message);return}
    const rows=r.data||[];
    if(!rows.length){renderMessage("没有找到与“"+keyword+"”相关的内容");return}

    results.innerHTML=rows.map(x=>{
      const meta=typeMeta[x.result_type]||["内容","⌕"];
      const href=spaceSafeLink(x.href||"");
      if(!href)return "";
      return '<a class="globalSearchItem" href="'+esc(href)+'"><span class="globalSearchItemIcon">'+meta[1]+'</span><span class="globalSearchItemBody"><b>'+esc(x.title||"未命名内容")+'</b><small>'+esc(meta[0]+(x.subtitle?" · "+x.subtitle:""))+'</small></span><span class="globalSearchArrow">›</span></a>';
    }).join("");
  };

  input.addEventListener("input",()=>{
    clearTimeout(timer);
    timer=setTimeout(run,180);
  });
  input.addEventListener("focus",()=>{if(input.value.trim())run()});
  input.addEventListener("keydown",e=>{
    if(e.key==="Escape"){input.blur();close()}
    if(e.key==="Enter"){
      e.preventDefault();
      const first=results.querySelector(".globalSearchItem");
      if(first)first.click(); else run();
    }
  });
  clear.onclick=()=>{input.value="";clear.classList.add("hidden");close();input.focus()};
  document.addEventListener("pointerdown",e=>{if(!root.contains(e.target))close()});
}

function enableNavPrefetch(){
  const seen=new Set();
  const warm=anchor=>{
    if(!anchor||anchor.target==="_blank"||anchor.hasAttribute("download"))return;
    let url;
    try{url=new URL(anchor.href,location.href)}catch(_e){return}
    if(url.origin!==location.origin||url.href===location.href||seen.has(url.href))return;
    seen.add(url.href);
    const link=document.createElement("link");
    link.rel="prefetch";
    link.href=url.href;
    link.as="document";
    document.head.appendChild(link);
  };
  document.querySelectorAll('.nav a[href],.adminLink[href],.moduleCard[href]').forEach(a=>{
    a.addEventListener("mouseenter",()=>warm(a),{once:true,passive:true});
    a.addEventListener("pointerdown",()=>warm(a),{once:true,passive:true});
    a.addEventListener("touchstart",()=>warm(a),{once:true,passive:true});
  });
}
function updateAuthUI(){
  const on=!!state.user;
  q("#authOpen").classList.toggle("hidden",on);q("#logout").classList.toggle("hidden",!on);q("#badge").classList.toggle("hidden",!on);q("#changePasswordOpen")?.classList.toggle("hidden",!on);q("#accountMenuToggle")?.classList.toggle("hidden",!on);if(!on){q("#accountMenuPanel")?.classList.add("hidden");q("#accountMenuToggle")?.setAttribute("aria-expanded","false")}const no=q("#notifyOpen");if(no)no.classList.toggle("hidden",!on);
  const who=state.profile?.full_name||state.user?.email||"";
  const memberStatus=membershipStatus();
  q("#badge").textContent=on?who+(state.profile?.major?" · "+state.profile.major:"")+(memberStatus==="freshman"&&!isAdmin()?" · 大一新生":"")+(isAdmin()?" · "+roleName(authzRole()):""):"";
  const accountDisplay=state.profile?.full_name||state.user?.email?.split("@")[0]||"我的账户";
  const accountName=q("#accountMenuName"),accountAvatar=q("#accountMenuAvatar"),accountToggle=q("#accountMenuToggle");
  if(accountName)accountName.textContent=accountDisplay;
  if(accountAvatar)accountAvatar.textContent=String(accountDisplay||"我").trim().slice(0,1)||"我";
  if(accountToggle)accountToggle.title=on?"账户管理 · "+accountDisplay:"账户管理";
  q("#adminNav").classList.toggle("hidden",!isAdmin());q("#accountMenuAdmin")?.classList.toggle("hidden",!isAdmin());const aq=q("#adminQuick");if(aq)aq.classList.toggle("hidden",!isAdmin());document.querySelectorAll(".adminSep").forEach(x=>x.classList.toggle("hidden",!isAdmin()));
  const freshmanRestricted=on&&memberStatus==="freshman"&&!isAdmin();
  document.querySelectorAll('a[href="./progress.html"],a[href$="/progress.html"],a[href="./projects.html"],a[href$="/projects.html"]').forEach(a=>a.classList.toggle("hidden",freshmanRestricted));
}
function friendlyAuthError(err){
  const raw=String(err?.message||err||"").trim();
  const low=raw.toLowerCase();
  if(!navigator.onLine)return "当前设备似乎已断网，请检查网络后重试。";
  if(/failed to fetch|networkerror|load failed|network request failed|fetch failed/.test(low))return "无法连接登录服务器。请检查网络，或改用 Chrome / Edge 后重试。";
  if(/invalid login credentials|invalid email or password/.test(low))return "邮箱或密码不正确，请重新检查后登录。";
  if(/email not confirmed/.test(low))return "该邮箱尚未完成验证，请先完成邮箱验证。";
  if(/too many requests|rate limit/.test(low))return "尝试次数过多，请稍后再试。";
  if(/timeout|timed out|abort/.test(low))return "登录请求超时，请检查网络后重新尝试。";
  if(/user not found/.test(low))return "没有找到这个账号，请确认邮箱是否正确，或先完成首次注册。";
  if(/signup disabled/.test(low))return "当前暂时无法注册新账号，请联系管理员。";
  if(/database error|unexpected_failure/.test(low))return "账号服务暂时异常，请稍后重试；若持续出现请联系管理员。";
  return raw?"登录失败："+raw:"登录失败，请稍后重试。";
}
function isAuthNetworkError(err){
  const low=String(err?.message||err||"").toLowerCase();
  return /failed to fetch|networkerror|load failed|network request failed|fetch failed/.test(low);
}
async function getSessionQuick(timeout=3500){
  try{
    return await Promise.race([
      supabase.auth.getSession(),
      new Promise(resolve=>setTimeout(()=>resolve({data:{session:null},error:new Error("SESSION_CHECK_TIMEOUT")}),timeout))
    ]);
  }catch(error){
    return {data:{session:null},error};
  }
}
async function signInWithTimeout(email,password,onSlow){
  const attempt=++__authLoginSeq;
  const epoch=++__manualLoginEpoch;
  let slowTimer=null;
  let hardTimer=null;

  const request=supabase.auth.signInWithPassword({email,password});
  const guarded=request.then(result=>{
    if(epoch!==__manualLoginEpoch)return {error:new Error("LOGIN_STALE"),stale:true,attempt};
    return {...result,attempt};
  }).catch(error=>({error,attempt}));

  const hardTimeout=new Promise(resolve=>{
    slowTimer=setTimeout(()=>{
      try{onSlow?.()}catch(_e){}
    },LOGIN_SLOW_NOTICE_MS);
    hardTimer=setTimeout(()=>{
      resolve({error:new Error("LOGIN_TIMEOUT"),timedOut:true,attempt});
    },LOGIN_HARD_TIMEOUT_MS);
  });

  const result=await Promise.race([guarded,hardTimeout]);
  clearTimeout(slowTimer);
  clearTimeout(hardTimer);
  return result;
}
async function resilientPasswordLogin(email,password,onSlow,onRetry){
  let result=await signInWithTimeout(email,password,onSlow);
  if(result?.error&&isAuthNetworkError(result.error)){
    try{onRetry?.()}catch(_e){}
    await new Promise(resolve=>setTimeout(resolve,900));
    result=await signInWithTimeout(email,password,onSlow);
  }
  if(result?.error&&result.error.message==="LOGIN_TIMEOUT"){
    const late=await getSessionQuick(2500);
    if(late?.data?.session?.user)return {data:late.data,error:null,recovered:true};
  }
  return result;
}
function friendlySignupError(err){
  const raw=String(err?.message||err||"").trim();
  const low=raw.toLowerCase();
  if(!navigator.onLine)return "当前设备似乎已断网，请检查网络后再试。";
  if(/failed to fetch|networkerror|load failed|network request failed|fetch failed/.test(low))return "无法连接注册服务器。请切换网络，或用系统浏览器 / Chrome / Edge 打开后重试。";
  if(/signup_timeout/.test(low))return "注册服务器长时间未响应。本次界面请求已结束；如果刚才其实已完成注册，可直接返回登录尝试。";
  if(/signup_stale/.test(low))return "注册状态已经变化，请重新确认当前账号状态。";
  if(/user already registered|already been registered|already exists|duplicate key|users_email_partial_key/.test(low))return "这个邮箱已经注册过，正在尝试直接登录…";
  if(/实验室通行证不正确|passcode/i.test(raw)&&/incorrect|invalid|不正确/i.test(raw))return "实验室通行证不正确，请检查大小写和字符后重试。";
  if(/database error|unexpected_failure/i.test(raw))return "注册信息未通过验证。请检查实验室通行证；若邮箱已注册，请直接返回登录。";
  if(/rate limit|too many requests/i.test(raw))return "尝试次数过多，请稍后再试。";
  return raw?"注册失败："+raw:"注册失败，请稍后重试。";
}
function isAlreadyRegisteredError(err){
  const raw=String(err?.message||err||"").toLowerCase();
  return /user already registered|already been registered|already exists|duplicate key|users_email_partial_key/.test(raw);
}
async function signUpWithTimeout(payload,onSlow){
  const attempt=++__authRegisterSeq;
  const epoch=++__authRegisterEpoch;
  let slowTimer=null;
  let hardTimer=null;

  const request=supabase.auth.signUp(payload);
  const guarded=request.then(result=>{
    if(epoch!==__authRegisterEpoch)return {error:new Error("SIGNUP_STALE"),stale:true,attempt};
    return {...result,attempt};
  }).catch(error=>({error,attempt}));

  const hardTimeout=new Promise(resolve=>{
    slowTimer=setTimeout(()=>{
      try{onSlow?.()}catch(_e){}
    },SIGNUP_SLOW_NOTICE_MS);
    hardTimer=setTimeout(()=>{
      resolve({error:new Error("SIGNUP_TIMEOUT"),timedOut:true,attempt});
    },SIGNUP_HARD_TIMEOUT_MS);
  });

  let result=await Promise.race([guarded,hardTimeout]);
  clearTimeout(slowTimer);
  clearTimeout(hardTimer);

  // 国内部分 WiFi / WebView 会出现“服务端已创建账号，但响应迟迟没回到前端”。
  // 超时后先检查本地会话，若 Supabase 已经建立登录态，就直接按注册成功处理。
  if(result?.error?.message==="SIGNUP_TIMEOUT"){
    const late=await getSessionQuick(5000);
    if(late?.data?.session?.user){
      result={data:late.data,error:null,recovered:true,attempt};
    }
  }
  return result;
}
async function applyRegisteredSession(session){
  if(!session?.user)return false;
  state.user=session.user;
  updateAuthUI();
  try{
    localStorage.setItem(REMEMBER_LOGIN_KEY,"1");
    sessionStorage.removeItem(SESSION_LOGIN_KEY);
  }catch(_e){}
  void (async()=>{
    try{
      const usedCache=await loadProfile(true);
      if(usedCache)updateAuthUI();
      await loadProfile(false);
      updateAuthUI();
    }catch(err){
      console.warn("注册后成员资料同步失败，保留已建立的登录会话",err);
    }
  })();
  return true;
}

async function fetchTeacherNotices(){
  if(!state.user)return [];
  const r=await supabase.from("progress_member_notices").select("id,sender_name,message_type,message,progress_type,progress_id,created_at,read_at").eq("recipient_id",state.user.id).order("created_at",{ascending:false}).limit(40);
  if(r.error){console.warn("定向通知暂不可用",r.error.message);return []}
  return r.data||[];
}
function teacherNoticeUrl(x){
  if(x.progress_type&&x.progress_id)return "./space.html?type="+encodeURIComponent(x.progress_type)+"&id="+encodeURIComponent(x.progress_id)+(x.message_type==="teacher_comment"?"&note="+encodeURIComponent(x.id):"");
  return "./progress.html#progressComposer";
}
function notificationTypeName(t){
  return t==="announcement"?"公告":t==="task"?"新任务":t==="deadline"?"截止提醒":t==="progress"?"进度提醒":t==="membership"?"成员状态":"通知";
}
function notificationIcon(t){
  return t==="announcement"?"📢":t==="task"?"📄":t==="deadline"?"⏰":t==="progress"?"📈":t==="membership"?"✅":"🔔";
}
async function loadSiteNotifications(openDialog=false){
  const btn=q("#notifyOpen"),dot=q("#notifyDot"),list=q("#notifyList"),summary=q("#notifySummary");
  if(!state.user){
    globalThis.__notifyCache=null;
    if(dot){dot.classList.add("hidden");dot.textContent=""}
    q("#uxBottomNotify")?.classList.remove("uxHasUnread");
    if(list)list.innerHTML='<div class="notifyEmpty">请登录后查看通知。</div>';
    return [];
  }
  const requestUserId=state.user.id;
  const now=Date.now();
  if(!openDialog&&globalThis.__notifyCache?.rows&&globalThis.__notifyCache.userId===requestUserId&&now-globalThis.__notifyCache.at<15000){
    return globalThis.__notifyCache.rows;
  }
  const r=await fetchSiteNotificationsOnce();
  if(r.error){
    if(openDialog&&list)list.innerHTML='<div class="notifyEmpty">通知加载失败：'+esc(r.error.message)+'</div>';
    return [];
  }
  const privateNotes=await fetchTeacherNotices();
  if(state.user?.id!==requestUserId)return [];
  const converted=privateNotes.map(x=>({notification_key:"teacher:"+x.id,notification_type:"progress",title:x.message_type==="teacher_comment"?"老师发来了私密评语":"老师提醒你更新进度",body:(x.sender_name||"实验室老师")+"："+x.message,created_at:x.created_at,link_url:teacherNoticeUrl(x),is_read:!!x.read_at}));
  const rows=[...(r.data||[]),...converted].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)), unread=rows.filter(x=>!x.is_read).length;
  globalThis.__notifyCache={rows,at:Date.now(),userId:requestUserId};
  if(dot){
    dot.textContent=unread>99?"99+":String(unread);
    dot.classList.toggle("hidden",unread===0);
  }
  q("#uxBottomNotify")?.classList.toggle("uxHasUnread",unread>0);
  if(summary)summary.textContent=unread?("未读 "+unread+" 条 · 共 "+rows.length+" 条"):("全部已读 · 共 "+rows.length+" 条");
  if(list){
    list.innerHTML=rows.length?rows.map(x=>{
      const href=esc(spaceSafeLink(x.link_url||"./index.html")||"./index.html"),key=esc(x.notification_key),type=esc(x.notification_type||"");
      return '<a class="notifyItem '+(x.is_read?'':'unread')+'" data-key="'+key+'" data-type="'+type+'" href="'+href+'"><div class="notifyType">'+(x.is_read?'':'<span class="notifyUnreadMark"></span>')+notificationIcon(type)+' '+esc(notificationTypeName(type))+'</div><div class="notifyItemTop"><b>'+esc(x.title||"通知")+'</b><time>'+esc(fmt(x.created_at))+'</time></div><p>'+esc(x.body||"")+'</p></a>';
    }).join(""):'<div class="notifyEmpty">当前没有新的站内通知。</div>';
    list.querySelectorAll(".notifyItem").forEach(el=>el.addEventListener("click",async event=>{
      if(event.ctrlKey||event.metaKey||event.shiftKey||event.altKey||event.button!==0)return;
      const key=el.dataset.key||"", dest=spaceSafeLink(el.href);
      if(!dest)return;
      event.preventDefault();
      if(el.dataset.opening==="true")return;
      el.dataset.opening="true";
      if(key){
        const pending=key.startsWith("teacher:")?
          supabase.rpc("mark_progress_notice_read",{p_notice_id:key.slice(8)}):
          supabase.rpc("mark_site_notification_read",{p_notification_key:key});
        try{
          const result=await Promise.race([pending,new Promise(resolve=>setTimeout(()=>resolve(null),1800))]);
          if(result?.error)console.warn("通知已读同步失败",result.error.message);
        }catch(err){console.warn("通知已读同步异常",err)}
      }
      globalThis.__notifyCache=null;location.assign(dest);
    }));
  }
  if(openDialog&&q("#notifyDialog")&&!q("#notifyDialog").open)q("#notifyDialog").showModal();
  return rows;
}
let __noticePollingStarted=false,__noticePollingBusy=false,__noticeLastChecked=0;
function setupNoticePolling(){
  if(__noticePollingStarted)return;
  __noticePollingStarted=true;
  const refresh=()=>{
    if(!state.user||document.visibilityState!=="visible"||__noticePollingBusy||Date.now()-__noticeLastChecked<40000)return;
    __noticeLastChecked=Date.now();__noticePollingBusy=true;
    globalThis.__notifyCache=null;
    void loadSiteNotifications(false).catch(err=>console.warn("站内通知后台刷新失败",err)).finally(()=>{__noticePollingBusy=false});
  };
  window.setInterval(refresh,60000);
  document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")refresh()});
  window.addEventListener("focus",refresh);
  window.addEventListener("online",refresh);
}
function bindNotifications(){
  const open=q("#notifyOpen"),close=q("#notifyClose"),all=q("#notifyReadAll");
  if(open)open.onclick=()=>loadSiteNotifications(true);
  if(close)close.onclick=()=>q("#notifyDialog")?.close();
  const toolbar=q("#notifyDialog .notifyToolbar");
  if(toolbar&&!q("#notifyRefresh")){
    const refreshBtn=document.createElement("button");
    refreshBtn.type="button";refreshBtn.id="notifyRefresh";refreshBtn.className="btn sec";
    refreshBtn.textContent="↻ 刷新";
    refreshBtn.onclick=async()=>{
      if(refreshBtn.disabled)return;
      refreshBtn.disabled=true;globalThis.__notifyCache=null;
      try{await loadSiteNotifications(true)}finally{refreshBtn.disabled=false}
    };
    toolbar.insertBefore(refreshBtn,all||toolbar.firstChild);
  }
  if(all)all.onclick=async()=>{
    if(!state.user)return;
    all.disabled=true;
    const r=await supabase.rpc("mark_all_site_notifications_read");
    all.disabled=false;
    if(r.error)return toast("操作失败："+r.error.message);
    const notes=await fetchTeacherNotices();
    const pending=notes.filter(x=>!x.read_at);
    const completed=await Promise.allSettled(pending.map(x=>supabase.rpc("mark_progress_notice_read",{p_notice_id:x.id})));
    const failed=completed.filter(x=>x.status==="rejected"||x.value?.error||x.value?.data===false).length;
    globalThis.__notifyCache=null;
    await loadSiteNotifications(true);
    toast(failed?"已处理系统通知，但有 "+failed+" 条私密通知未能标记已读，请重试。":"已全部标为已读");
  };
}

function bindPasswordChange(){
  const dialog=q("#passwordChangeDialog");
  const form=q("#passwordChangeForm");
  const openMain=q("#changePasswordOpen");
  const openProfile=q("#openProfilePassword");
  const cancel=q("#passwordChangeCancel");
  const status=q("#passwordChangeMessage");
  const submit=q("#passwordChangeSubmit");
  if(!dialog||!form||!submit||!status)return;
  const clearFields=()=>{
    form.reset();
    status.textContent="";
  };
  const openDialog=()=>{
    if(!state.user){
      q("#authOpen")?.click();
      return;
    }
    clearFields();
    dialog.showModal();
    q("#passwordCurrent")?.focus();
  };
  if(openMain)openMain.onclick=openDialog;
  if(openProfile)openProfile.onclick=openDialog;
  if(cancel)cancel.onclick=()=>dialog.close();
  dialog.addEventListener("close",clearFields);
  form.addEventListener("submit",async e=>{
    e.preventDefault();
    if(submit.disabled||__passwordChangeReauthBusy)return;
    if(!state.user?.email){
      status.textContent="登录状态已失效，请重新登录后再试。";
      return;
    }
    const current=q("#passwordCurrent").value;
    const next=q("#passwordNext").value;
    const confirm=q("#passwordNextConfirm").value;
    if(!current){status.textContent="请输入当前密码。";return}
    if(next.length<8||next.length>72||!/[A-Za-z]/.test(next)||!/[0-9]/.test(next)){
      status.textContent="新密码须为 8–72 位，且同时包含字母和数字。";
      return;
    }
    if(next===current){status.textContent="新密码不能与当前密码相同。";return}
    if(next!==confirm){status.textContent="两次输入的新密码不一致。";return}
    const email=state.user.email;
    submit.disabled=true;
    if(cancel)cancel.disabled=true;
    submit.textContent="正在验证并保存…";
    status.textContent="正在验证当前密码…";
    __passwordChangeReauthBusy=true;
    try{
      // 实际向认证服务器验证旧密码，避免只靠前端表单判断。
      const verified=await supabase.auth.signInWithPassword({email,password:current});
      if(verified.error){
        const code=String(verified.error.message||"").toLowerCase();
        throw new Error(/invalid login credentials|invalid email or password/.test(code)
          ?"当前密码不正确，请重新输入。":friendlyAuthError(verified.error));
      }
      if(verified.data?.user?.id!==state.user?.id)throw new Error("账号校验异常，请重新登录。");
      status.textContent="当前密码已验证，正在更新…";
      const updated=await supabase.auth.updateUser({current_password:current,password:next});
      if(updated.error)throw new Error(friendlyAuthError(updated.error));
      dialog.close();
      toast("密码修改成功！下次登录请使用新密码。");
    }catch(err){
      status.textContent=err?.message||"修改失败，请稍后重试。";
    }finally{
      __passwordChangeReauthBusy=false;
      submit.disabled=false;
      if(cancel)cancel.disabled=false;
      submit.textContent="保存新密码";
    }
  });
}

function bindAuth(){
  const setAuthMode=mode=>{
    const reg=mode==="register";
    q("#registerFields").classList.toggle("hidden",!reg);
    q("#login").classList.toggle("hidden",reg);
    q("#retryLogin")?.classList.add("hidden");
    q("#showRegister").classList.toggle("hidden",reg);
    q("#continueRegister").classList.toggle("hidden",!reg);
    q("#backLogin").classList.toggle("hidden",!reg);
    q("#authModeTitle").textContent=reg?"首次注册":"成员登录";
    q("#authModeHint").textContent=reg?"首次注册需填写姓名，以及“年级 + 校区 + 专业”或“苏理工 + 专业”，并验证实验室通行证。":"已注册成员只需要邮箱和密码即可登录。";
    const rw=q("#rememberLoginWrap"),rc=q("#rememberLogin");
    if(rw)rw.classList.toggle("hidden",reg);
    if(rc&&!reg){try{rc.checked=localStorage.getItem(REMEMBER_LOGIN_KEY)!=="0"}catch(_e){rc.checked=true}}
    q("#authMsg").textContent="";
  };
  q("#authOpen").onclick=()=>{setAuthMode("login");q("#auth").showModal()};
  q("#closeAuth").onclick=()=>q("#auth").close();
  q("#logout").onclick=()=>{try{sessionStorage.removeItem(SESSION_LOGIN_KEY)}catch(_e){}supabase.auth.signOut()};
  q("#showRegister").onclick=()=>setAuthMode("register");
  q("#backLogin").onclick=()=>setAuthMode("login");

  const performLogin=async()=>{
    const email=q("#email").value.trim().toLowerCase(),password=q("#password").value;
    q("#email").value=email;
    const btn=q("#login"),retry=q("#retryLogin"),msg=q("#authMsg"),remember=q("#rememberLogin")?.checked!==false;
    if(__authLoginBusy){
      msg.textContent="登录请求正在处理中，请稍候…";
      return;
    }
    if(!email||!password){msg.textContent="请输入邮箱和密码";return}
    if(!navigator.onLine){msg.textContent="当前设备似乎已断网，请连接网络后重试。";retry?.classList.remove("hidden");return}
    __authLoginBusy=true;
    btn.disabled=true;
    if(retry)retry.disabled=true;
    retry?.classList.add("hidden");
    msg.textContent="正在连接登录服务器…";
    try{
      if(!__authBootstrapDone){
        msg.textContent="正在恢复已有登录状态…";
        await Promise.race([
          __authBootstrapReady,
          new Promise(resolve=>setTimeout(resolve,5000))
        ]);
        if(state.user){
          msg.textContent="已恢复登录状态";
          updateAuthUI();
          q("#auth").close();
          return;
        }
        msg.textContent="正在连接登录服务器…";
      }

      // 先确认是否其实已经存在有效会话。某些 WiFi 下 token 刷新成功，
      // 但首屏恢复较慢，用户会误以为“没有登录成功”而再次输入密码。
      const existing=await getSessionQuick(2200);
      if(existing?.data?.session?.user){
        state.user=existing.data.session.user;
        updateAuthUI();
        msg.textContent="已恢复现有登录状态";
        q("#auth").close();
        void (async()=>{
          try{
            const usedCache=await loadProfile(true);
            if(usedCache)updateAuthUI();
            await loadProfile(false);
            updateAuthUI();
          }catch(_e){}
        })();
        return;
      }

      const r=await resilientPasswordLogin(email.toLowerCase(),password,()=>{
        msg.textContent="当前网络响应较慢，仍在等待登录结果，请不要重复点击…";
      },()=>{
        msg.textContent="首次连接失败，正在自动重试登录线路…";
      });
      if(r?.error){
        const message=r.error.message==="LOGIN_TIMEOUT"
          ?"账号服务器暂时没有响应。若网络稍后恢复，成功的迟到登录会自动生效；也可以点击“重新登录”。"
          :r.error.message==="LOGIN_STALE"
            ?"登录状态已经变化，请重新确认当前账号状态。"
            :friendlyAuthError(r.error);
        msg.textContent=message;
        if(/无法连接|超时|断网|暂时异常|没有响应/.test(message))retry?.classList.remove("hidden");
        return;
      }
      if(r?.data?.session?.user){
        state.user=r.data.session.user;
        try{
          localStorage.setItem(REMEMBER_LOGIN_KEY,remember?"1":"0");
          if(remember)sessionStorage.removeItem(SESSION_LOGIN_KEY);
          else sessionStorage.setItem(SESSION_LOGIN_KEY,"1");
        }catch(_e){}
        updateAuthUI();
        msg.textContent=remember?"登录成功，已记住登录状态":"登录成功，本次会话内保持登录";
        q("#auth").close();

        // 登录成功后立即放行界面；成员资料在后台补齐，避免移动网络上
        // profile 请求稍慢时出现“账号已登录但弹窗一直不关”的假失败。
        void (async()=>{
          try{
            const usedCache=await loadProfile(true);
            if(usedCache)updateAuthUI();
            await loadProfile(false);
            updateAuthUI();
          }catch(err){
            console.warn("登录后成员资料同步失败，保留已建立的登录会话",err);
          }
        })();
        return;
      }
      throw new Error("LOGIN_SESSION_MISSING");
    }catch(err){
      const message=friendlyAuthError(err);
      msg.textContent=message;
      if(/无法连接|超时|断网|暂时异常/.test(message))retry?.classList.remove("hidden");
    }finally{
      __authLoginBusy=false;
      btn.disabled=false;
      if(retry)retry.disabled=false;
    }
  };
  q("#login").onclick=performLogin;
  q("#retryLogin")&&(q("#retryLogin").onclick=performLogin);
  q("#password").addEventListener("keydown",e=>{if(e.key==="Enter"&&!q("#login").classList.contains("hidden")&&!__authLoginBusy)performLogin()});

  q("#continueRegister").onclick=()=>{
    if(__authRegisterBusy)return;
    const n=q("#regName").value.trim(),m=q("#regMajor").value.trim(),e=q("#email").value.trim().toLowerCase(),p=q("#password").value;
    q("#email").value=e;
    if(!n)return q("#authMsg").textContent="首次注册请填写姓名";
    if(!m)return q("#authMsg").textContent="首次注册请填写年级、校区和专业信息";
    const freshman=q("#regFreshman")?.value||"";
    if(!freshman)return q("#authMsg").textContent="请选择是否为大一新生";
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))return q("#authMsg").textContent="请输入有效邮箱地址";
    if(p.length<8)return q("#authMsg").textContent="首次注册密码至少需要 8 位";
    if(!/[A-Za-z]/.test(p)||!/[0-9]/.test(p))return q("#authMsg").textContent="首次注册密码必须同时包含字母和数字";
    q("#authMsg").textContent="";q("#passMsg").textContent="";q("#passcodeConfirm").value="";
    q("#auth").close();q("#passAuth").showModal();
  };
  q("#cancelPasscode").onclick=()=>{
    if(__authRegisterBusy){
      q("#passMsg").textContent="注册正在处理中，请等待当前请求结束。";
      return;
    }
    q("#passAuth").close();
    setAuthMode("register");
    q("#auth").showModal();
  };
  q("#confirmPasscode").onclick=async()=>{
    const full_name=q("#regName").value.trim();
    const major=q("#regMajor").value.trim();
    const email=q("#email").value.trim().toLowerCase();
    const password=q("#password").value;
    const lab_passcode=q("#passcodeConfirm").value.trim();
    const is_freshman=q("#regFreshman")?.value==="yes";
    const btn=q("#confirmPasscode"),cancel=q("#cancelPasscode"),msg=q("#passMsg");

    if(__authRegisterBusy){
      msg.textContent="注册请求正在处理中，请稍候…";
      return;
    }
    if(!lab_passcode)return msg.textContent="请输入实验室通行证";
    if(!navigator.onLine)return msg.textContent="当前设备似乎已断网，请连接网络后重试。";
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return msg.textContent="邮箱格式不正确，请返回检查。";
    if(password.length<8)return msg.textContent="首次注册密码至少需要 8 位，请返回修改。";
    if(!/[A-Za-z]/.test(password)||!/[0-9]/.test(password))return msg.textContent="首次注册密码必须同时包含字母和数字，请返回修改。";

    __authRegisterBusy=true;
    btn.disabled=true;
    if(cancel)cancel.disabled=true;
    msg.textContent="正在验证通行证并创建账号…";

    try{
      const r=await signUpWithTimeout(
        {email,password,options:{data:{lab_passcode,full_name,major,is_freshman}}},
        ()=>{msg.textContent="当前网络响应较慢，注册仍在处理中，请不要重复点击或退出页面…";}
      );

      if(r?.error){
        if(isAlreadyRegisteredError(r.error)){
          msg.textContent="检测到该邮箱已经注册，正在尝试直接登录…";
          const s=await resilientPasswordLogin(
            email,password,
            ()=>{msg.textContent="账号已存在，当前网络较慢，仍在尝试登录…";},
            ()=>{msg.textContent="首次连接失败，正在自动重试账号登录…";}
          );
          if(s?.error){
            msg.textContent=s.error.message==="LOGIN_TIMEOUT"
              ?"账号已存在，但自动登录超时。请返回登录页重新登录。"
              :friendlyAuthError(s.error);
            return;
          }
          if(await applyRegisteredSession(s?.data?.session)){
            msg.textContent="账号已存在，已使用当前密码登录";
            setTimeout(()=>q("#passAuth").close(),350);
            return;
          }
          msg.textContent="账号已存在，请返回登录页直接登录。";
          return;
        }

        if(isAuthNetworkError(r.error)||r.error?.message==="SIGNUP_TIMEOUT"){
          msg.textContent="注册响应没有及时返回，正在确认账号是否其实已经创建成功…";
          const recovered=await resilientPasswordLogin(
            email,password,
            ()=>{msg.textContent="正在确认账号状态，当前网络仍然较慢…";},
            ()=>{msg.textContent="正在通过备用重试确认账号状态…";}
          );
          if(!recovered?.error&&await applyRegisteredSession(recovered?.data?.session)){
            msg.textContent="账号已经创建成功，已自动恢复登录";
            setTimeout(()=>q("#passAuth").close(),350);
            return;
          }
        }
        msg.textContent=friendlySignupError(r.error);
        return;
      }

      if(r?.data?.session?.user){
        msg.textContent="账号创建成功，正在同步成员资料…";
        await applyRegisteredSession(r.data.session);
        msg.textContent="注册成功，已自动登录";
        setTimeout(()=>q("#passAuth").close(),350);
        return;
      }

      // 某些 Supabase 配置注册成功后不直接返回 session，受控执行一次登录。
      msg.textContent="账号创建成功，正在建立登录会话…";
      const s=await resilientPasswordLogin(
        email,password,
        ()=>{msg.textContent="账号已经创建，当前网络较慢，仍在建立登录会话…";},
        ()=>{msg.textContent="正在自动重试建立登录会话…";}
      );
      if(s?.error){
        msg.textContent=s.error.message==="LOGIN_TIMEOUT"
          ?"账号已经创建成功，但自动登录超时。请返回登录页直接登录。"
          :friendlyAuthError(s.error);
        return;
      }

      msg.textContent="正在同步成员资料…";
      await applyRegisteredSession(s?.data?.session);
      msg.textContent="注册成功，已自动登录";
      setTimeout(()=>q("#passAuth").close(),350);
    }catch(err){
      msg.textContent=friendlySignupError(err);
    }finally{
      __authRegisterBusy=false;
      btn.disabled=false;
      if(cancel)cancel.disabled=false;
    }
  };
}
async function loadProfile(preferCache=false){
  if(!state.user){
    state.profile=null;
    state.authz=null;
    return false;
  }

  if(preferCache){
    let usedDisplayCache=false;
    const keys=[PROFILE_CACHE_KEY,...PROFILE_CACHE_LEGACY_KEYS];
    for(const store of [localStorage,sessionStorage]){
      for(const key of keys){
        try{
          const cached=JSON.parse(store.getItem(key)||"null");
          if(cached?.uid===state.user.id&&cached.profile&&Date.now()-Number(cached.savedAt||0)<PROFILE_CACHE_TTL){
            state.profile=profileDisplayOnly(cached.profile);
            const payload=JSON.stringify({uid:state.user.id,profile:state.profile,savedAt:Date.now()});
            try{localStorage.setItem(PROFILE_CACHE_KEY,payload)}catch(_e){}
            try{sessionStorage.setItem(PROFILE_CACHE_KEY,payload)}catch(_e){}
            usedDisplayCache=true;
            break;
          }
        }catch(_e){}
      }
      if(usedDisplayCache)break;
    }

    try{
      const cachedAuthz=JSON.parse(sessionStorage.getItem(AUTHZ_CACHE_KEY)||"null");
      if(cachedAuthz?.uid===state.user.id&&cachedAuthz.authz&&Date.now()-Number(cachedAuthz.savedAt||0)<AUTHZ_CACHE_TTL){
        state.authz={
          role:cachedAuthz.authz.role||"member",
          membership_status:cachedAuthz.authz.membership_status||"formal"
        };
      }else{
        state.authz=null;
      }
    }catch(_e){
      state.authz=null;
    }

    return usedDisplayCache;
  }

  const profileKey=authScopedKey("profile:current");
  const r=await singleFlight(profileKey,()=>supabase.from("profiles")
    .select("id,email,role,full_name,major,phone,qq,membership_status,created_at")
    .eq("id",state.user.id)
    .maybeSingle());
  if(r.error){
    console.warn("成员资料/权限刷新失败",r.error);
    return false;
  }

  if(r.data){
    state.profile=profileDisplayOnly(r.data);
    state.authz=profileAuthzOnly(r.data);
  }

  if(state.profile){
    const payload=JSON.stringify({uid:state.user.id,profile:state.profile,savedAt:Date.now()});
    try{sessionStorage.setItem(PROFILE_CACHE_KEY,payload)}catch(_e){}
    try{localStorage.setItem(PROFILE_CACHE_KEY,payload)}catch(_e){}
  }

  if(state.authz){
    try{
      sessionStorage.setItem(AUTHZ_CACHE_KEY,JSON.stringify({
        uid:state.user.id,
        authz:state.authz,
        savedAt:Date.now()
      }));
    }catch(_e){}
  }
  return false;
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
let __activeUploadCount=0;
function setUploadActive(active){
  __activeUploadCount=Math.max(0,__activeUploadCount+(active?1:-1));
  document.documentElement.classList.toggle("uploadInProgress",__activeUploadCount>0);
}
window.addEventListener("beforeunload",event=>{
  if(__activeUploadCount<=0)return;
  event.preventDefault();
  event.returnValue="";
});
function sleepMs(ms){return new Promise(resolve=>setTimeout(resolve,ms))}
const STORAGE_CLEANUP_QUEUE_KEY="justLabTokyoV2StorageCleanupQueueV1";
function readStorageCleanupQueue(){
  try{
    const rows=JSON.parse(localStorage.getItem(STORAGE_CLEANUP_QUEUE_KEY)||"[]");
    return Array.isArray(rows)?rows.filter(x=>x?.bucket&&x?.path):[];
  }catch(_e){return []}
}
function writeStorageCleanupQueue(rows){
  try{localStorage.setItem(STORAGE_CLEANUP_QUEUE_KEY,JSON.stringify(rows.slice(-300)))}catch(_e){}
}
function queueStorageCleanup(bucket,path){
  if(!bucket||!path)return;
  const rows=readStorageCleanupQueue();
  if(!rows.some(x=>x.bucket===bucket&&x.path===path)){
    rows.push({bucket,path,queued_at:new Date().toISOString()});
    writeStorageCleanupQueue(rows);
  }
}
async function removeStorageObjectSafe(bucket,path,{queueOnFail=false}={}){
  if(!bucket||!path)return {data:null,error:null};
  let last={data:null,error:null};
  for(let attempt=0;attempt<3;attempt++){
    try{
      last=await supabase.storage.from(bucket).remove([path]);
      if(!last?.error)return last;
    }catch(error){
      last={data:null,error};
    }
    if(attempt<2)await sleepMs(attempt===0?700:1600);
  }
  if(queueOnFail)queueStorageCleanup(bucket,path);
  console.warn("Storage 文件清理失败，已重试",bucket,path,last?.error);
  return last;
}
async function removeStorageObjectsSafe(bucket,paths=[],{queueOnFail=false}={}){
  const unique=[...new Set((paths||[]).filter(Boolean))];
  if(!bucket||!unique.length)return {data:null,error:null};
  let last={data:null,error:null};
  for(let attempt=0;attempt<3;attempt++){
    try{
      last=await supabase.storage.from(bucket).remove(unique);
      if(!last?.error)return last;
    }catch(error){
      last={data:null,error};
    }
    if(attempt<2)await sleepMs(attempt===0?700:1600);
  }
  if(queueOnFail)unique.forEach(path=>queueStorageCleanup(bucket,path));
  console.warn("Storage 批量清理失败，已重试",bucket,unique,last?.error);
  return last;
}
async function flushStorageCleanupQueue(){
  if(!navigator.onLine)return;
  const rows=readStorageCleanupQueue();
  if(!rows.length)return;
  const keep=[];
  for(const item of rows){
    const r=await removeStorageObjectSafe(item.bucket,item.path);
    if(r?.error)keep.push(item);
  }
  writeStorageCleanupQueue(keep);
}
function storageObjectPath(prefix,fileName){
  const ext=(fileName.match(/\.[A-Za-z0-9]{1,10}$/)||[""])[0].toLowerCase();
  const id=(globalThis.crypto?.randomUUID?.()||Math.random().toString(36).slice(2)+Date.now().toString(36)).replace(/[^a-zA-Z0-9-]/g,"");
  return (prefix?prefix+"/":"")+Date.now()+"-"+id+ext;
}
function tutorialStoragePath(type,fileName){return storageObjectPath(type,fileName)}
async function uploadStorageFile(bucket,path,file,onProgress){
  throw new Error("东京 V2 禁止写入 Supabase Storage");
  const sess=await supabase.auth.getSession();
  const token=sess.data.session?.access_token;
  if(!token)throw new Error("登录状态已失效，请重新登录后再上传");
  const tus=await getTusModule();
  setUploadActive(true);
  try{
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
  }finally{
    setUploadActive(false);
  }
}
async function uploadTutorialFile(path,file,onProgress){return uploadStorageFile("tutorials",path,file,onProgress)}
const QINIU_PUBLIC_DOMAIN="http://jxcxsys.rqez.cn";
function qiniuFileCategory(file,resourceType=""){
  const n=(file?.name||"").toLowerCase();
  if(resourceType==="video"||/\.(mp4|webm|ogg|mov|m4v|avi|mkv)$/i.test(n))return "video";
  if(resourceType==="archive"||/\.(zip|rar|7z)$/i.test(n))return "archive";
  return "admin-resource";
}
function isQiniuStorageKey(path=""){
  return /^(?:videos|archives|submissions|progress|team-progress|tutorials|resources|shares|exams|images|works)\//.test(String(path||""));
}
function qiniuPublicUrlFromKey(key=""){
  if(!key)return "";
  return QINIU_PUBLIC_DOMAIN.replace(/\/$/,"")+"/"+String(key).split("/").map(encodeURIComponent).join("/");
}
async function qiniuSignedInfo(key,expiresIn=300){
  if(!key)throw new Error("缺少七牛云文件路径");
  const r=await supabase.functions.invoke("qiniu-https-route-check",{body:{key,action:"download"}});
  if(r.error)throw new Error(r.error.message||"七牛私有下载链接生成失败");
  if(r.data?.error)throw new Error(r.data.error);
  if(!r.data?.url||r.data.httpStatus!==206||r.data.rangeOK!==true||!r.data.url.startsWith("https://"))throw new Error("七牛 HTTPS 下载线路未通过验证，请稍后重试");
  return r.data;
}
async function qiniuSignedUrl(key,expiresIn=3600){
  return (await qiniuSignedInfo(key,expiresIn)).url;
}
async function fastestQiniuVideoUrl(info){
  const candidates=Array.isArray(info?.candidates)?info.candidates.filter(x=>x?.url):[];
  if(candidates.length<2)return info.url;
  const cacheKey="justQiniuVideoRouteV3";
  try{
    const saved=JSON.parse(localStorage.getItem(cacheKey)||"null");
    if(saved?.region&&Date.now()-Number(saved.ts||0)<6*60*60*1000){
      const hit=candidates.find(x=>x.region===saved.region);
      if(hit)return hit.url;
    }
  }catch(_e){}
  const probe=async item=>{
    const ctl=new AbortController();
    const timer=setTimeout(()=>ctl.abort(),2200);
    const started=performance.now();
    try{
      const res=await fetch(item.url,{method:"GET",headers:{Range:"bytes=0-0"},cache:"no-store",signal:ctl.signal});
      if(res.status!==206&&res.status!==200)throw new Error("HTTP "+res.status);
      try{await res.body?.cancel()}catch(_e){}
      return {item,ms:performance.now()-started};
    }finally{clearTimeout(timer)}
  };
  const results=(await Promise.all(candidates.map(async item=>{try{return await probe(item)}catch(_e){return null}}))).filter(Boolean);
  if(!results.length)return info.url;
  results.sort((a,b)=>a.ms-b.ms);
  const best=results[0];
  try{localStorage.setItem(cacheKey,JSON.stringify({region:best.item.region,ts:Date.now(),ms:Math.round(best.ms)}))}catch(_e){}
  return best.item.url;
}
async function openQiniuKey(key,button=null){
  const old=button?.textContent||"";
  let popup=null;
  try{
    if(button){button.disabled=true;button.textContent=isQiniuStorageKey(key)&&String(key).startsWith("videos/")?"正在选择最快线路…":"正在生成安全链接…";}
    try{popup=window.open("about:blank","_blank")}catch(_e){}
    const info=await qiniuSignedInfo(key,300);
    const url=info.url;
    if(popup&&!popup.closed)popup.location.replace(url);
    else window.location.href=url;
  }catch(err){
    try{popup?.close()}catch(_e){}
    toast("文件打开失败："+(err?.message||String(err)));
  }finally{
    if(button){button.disabled=false;button.textContent=old;}
  }
}
async function playQiniuProgressVideo(btn){
  const wrapper=btn.closest(".progressSecureVideo");
  const video=wrapper?.querySelector("video");
  if(!video)return;
  const original=btn.textContent;
  btn.disabled=true;btn.textContent="正在生成七牛云播放链接…";
  try{
    const info=await qiniuSignedInfo(btn.dataset.key,1200);
    if(!info?.url||!info.url.startsWith("https://"))throw new Error("没有可用的 HTTPS 播放线路");
    video.src=info.url;video.hidden=false;video.load();
    await video.play();
    btn.textContent="重新获取播放链接";
  }catch(error){
    btn.textContent="播放失败 · 点击重试";
    toast("视频播放暂不可用："+(error?.message||String(error)));
  }finally{btn.disabled=false}
}
function bindQiniuOpenButtons(scope=document){
  scope.querySelectorAll(".qiniuPlayBtn").forEach(btn=>{btn.onclick=()=>playQiniuProgressVideo(btn)});
  scope.querySelectorAll(".qiniuOpenBtn").forEach(btn=>{
    btn.onclick=()=>openQiniuKey(btn.dataset.key||"",btn);
  });
}
async function uploadQiniuFile(file,category,onProgress){
  const sess=await supabase.auth.getSession();
  if(!sess.data.session?.access_token)throw new Error("登录状态已失效，请重新登录后再上传");
  const tokenReq=await supabase.functions.invoke("qiniu-upload-token",{body:{fileName:file.name,fileSize:file.size,category}});
  if(tokenReq.error)throw new Error(tokenReq.error.message||"七牛上传凭证获取失败");
  const cfg=tokenReq.data||{};
  if(!cfg.token||!cfg.key||!cfg.uploadUrl)throw new Error(cfg.error||"七牛上传凭证无效");
  if(!/^https:\/\/upload\.(?:qiniup|qiniu)\.com(?:\/|$)/.test(cfg.uploadUrl))throw new Error("未授权的文件上传域名");
  setUploadActive(true);
  try{
    await new Promise((resolve,reject)=>{
      const xhr=new XMLHttpRequest();
      xhr.open("POST",cfg.uploadUrl,true);
      xhr.upload.onprogress=e=>{if(onProgress&&e.lengthComputable)onProgress(Math.round(e.loaded/e.total*100))};
      xhr.onerror=()=>reject(new Error("七牛上传网络异常"));
      xhr.onload=()=>{
        if(xhr.status>=200&&xhr.status<300)return resolve();
        let msg="七牛上传失败";
        try{msg=JSON.parse(xhr.responseText||"{}")?.error||msg}catch(_e){}
        reject(new Error(msg+"（HTTP "+xhr.status+"）"));
      };
      const form=new FormData();
      form.append("token",cfg.token);
      form.append("key",cfg.key);
      form.append("file",file,file.name);
      xhr.send(form);
    });
    return {key:cfg.key,url:qiniuPublicUrlFromKey(cfg.key),storage_backend:"qiniu"};
  }finally{
    setUploadActive(false);
  }
}
async function removeQiniuObjectSafe(key){
  if(!key)return {data:null,error:null};
  try{
    const r=await supabase.functions.invoke("qiniu-object",{body:{key}});
    if(r.error)return {data:null,error:r.error};
    if(r.data?.error)return {data:null,error:new Error(r.data.error)};
    return {data:r.data,error:null};
  }catch(error){
    console.warn("七牛文件清理失败",key,error);
    return {data:null,error};
  }
}

/* Secure Qiniu image preview: signed HTTPS links are generated only at display time. */
const privateImageCache=new Map();
function privateImageKey(path="",url=""){
  const key=String(path||"").trim();
  if(key&&isQiniuStorageKey(key))return key;
  try{
    const u=new URL(String(url||""));
    if(u.hostname!=="jxcxsys.rqez.cn")return "";
    return u.pathname.replace(/^\/+|\/+$/g,"").split("/").map(decodeURIComponent).join("/");
  }catch(_e){return ""}
}
async function privateImageUrl(key,{refresh=false}={}){
  const entry=privateImageCache.get(key);
  if(refresh)privateImageCache.delete(key);
  else if(entry&&entry.until>Date.now())return entry.url;
  return singleFlight(authScopedKey("qiniu-image:"+key+(refresh?":refresh":"")),async()=>{
    const response=await supabase.functions.invoke("qiniu-image-preview",{body:{key}});
    if(response.error||response.data?.error||!response.data?.url)throw new Error(response.data?.error||response.error?.message||"安全预览地址获取失败");
    const until=Math.min(Date.now()+90*1000,Number(response.data?.expiresAt||0)*1000-15000||Date.now()+90*1000);
    privateImageCache.set(key,{url:response.data.url,until});
    return response.data.url;
  });
}
function loadSignedImage(img,url,timeoutMs=17000){
  return new Promise((resolve,reject)=>{
    let settled=false;
    const timer=setTimeout(()=>finish(new Error("图片加载超时")),timeoutMs);
    const finish=error=>{
      if(settled)return;
      settled=true;clearTimeout(timer);img.onload=null;img.onerror=null;
      if(error)reject(error);else resolve();
    };
    img.loading="eager";
    img.onload=()=>finish();
    img.onerror=()=>finish(new Error("图片链接无法加载"));
    img.src=url;
    if(img.complete&&img.naturalWidth>0)finish();
  });
}
function siteImageMarkup(url="",path="",imageClass="",alt="图片"){
  const key=privateImageKey(path,url);
  if(key)return '<img class="'+esc(imageClass)+' securedMediaImage securedMediaHidden" data-secure-image-key="'+esc(key)+'" alt="'+esc(alt)+'" loading="lazy" decoding="async">';
  if(url&&!isRestrictedLegacyStorageUrl(url)&&/^https:\/\//i.test(url))
    return '<img class="'+esc(imageClass)+' externalMediaPreview" src="'+esc(url)+'" alt="'+esc(alt)+'" loading="lazy" decoding="async">';
  return url?'<div class="securedMediaMessage" role="status">当前图片地址不支持安全预览</div>':"";
}
function bindSiteMedia(scope=document){
  const load=async(img,state)=>{
    if(!img.isConnected||img.dataset.mediaBusy==="1")return;
    const key=img.dataset.secureImageKey;
    if(!key)return;
    img.dataset.mediaBusy="1";
    state.disabled=true;state.textContent="正在加载七牛云安全预览…";
    state.classList.remove("hidden");
    img.classList.add("securedMediaHidden");
    img.removeAttribute("src");
    try{
      let lastError;
      for(let attempt=0;attempt<2;attempt++){
        if(!img.isConnected)return;
        try{
          const url=await privateImageUrl(key,{refresh:attempt>0});
          await loadSignedImage(img,url,attempt===0?16000:19000);
          if(!img.isConnected)return;
          img.classList.remove("securedMediaHidden");
          state.classList.add("hidden");
          return;
        }catch(error){
          lastError=error;privateImageCache.delete(key);
          img.removeAttribute("src");
          if(attempt===0){state.textContent="线路繁忙，正在自动重试…";}
        }
      }
      state.textContent="预览暂不可用 · 点击重新尝试";
      state.disabled=false;state.classList.remove("hidden");
      console.warn("七牛图片预览失败",key,lastError);
    }finally{delete img.dataset.mediaBusy}
  };
  let observer=null;
  if(typeof IntersectionObserver!=="undefined"){
    observer=new IntersectionObserver(entries=>{
      for(const entry of entries){
        if(!entry.isIntersecting)continue;
        observer.unobserve(entry.target);
        const img=entry.target.previousElementSibling;
        if(img?.matches("img.securedMediaImage"))void load(img,entry.target);
      }
    },{rootMargin:"320px 0px"});
  }
  scope.querySelectorAll("img.securedMediaImage[data-secure-image-key]").forEach(img=>{
    if(img.dataset.mediaBound==="1")return;
    img.dataset.mediaBound="1";
    let state=img.nextElementSibling;
    if(!state?.classList?.contains("securedMediaState")){
      state=document.createElement("button");
      state.type="button";state.className="securedMediaState";
      state.textContent="正在准备图片预览…";
      img.insertAdjacentElement("afterend",state);
    }
    state.onclick=()=>{privateImageCache.delete(img.dataset.secureImageKey);void load(img,state)};
    if(observer)observer.observe(state);else void load(img,state);
  });
  scope.querySelectorAll("img.externalMediaPreview").forEach(img=>{
    img.onerror=()=>{
      const message=document.createElement("div");
      message.className="securedMediaMessage";
      message.textContent="原图片地址暂时无法访问";
      img.replaceWith(message);
    };
  });
}

function isRestrictedLegacyStorageUrl(url=""){
  const raw=String(url||"");
  return /^https?:\/\/[a-z0-9-]+\.supabase\.co\/storage\/v1\//i.test(raw) && !raw.includes(PROJECT_REF+".supabase.co");
}
function pendingLegacyFileMarkup(label="旧文件"){
  return '<span class="notice" role="status" title="原 Supabase 文件尚未补传">'+esc(label)+' · 待补传七牛云</span>';
}
function resourcePreview(x){
  if(isRestrictedLegacyStorageUrl(x.video_url))return '<div class="docPreview"><div class="docIcon">!</div><strong>'+esc(x.file_name||x.title||"旧教程")+'</strong><span>历史文件尚未迁入七牛云，原数据库记录仍保留。请等待管理员补传。</span></div>';
  const type=x.resource_type||"video",url=x.video_url||"";
  if(x.storage_backend==="qiniu"&&x.storage_path){
    const icon=type==="video"?"VID":type==="archive"?"ZIP":type==="pdf"?"PDF":type==="word"?"DOCX":"FILE";
    return '<div class="docPreview"><div class="docIcon '+esc(type)+'">'+icon+'</div><strong>'+esc(x.file_name||resourceTypeName(type))+'</strong><span>七牛私有存储 · 点击下方按钮生成临时安全访问链接</span></div>';
  }
  if(type==="video"&&isOwnPlatformUrl(url)){
    return '<div class="notice" style="margin:18px">视频链接设置错误。'+(isAdmin()?'<div class="actions" style="margin-top:12px"><button class="btn pri editTutorialUrl" type="button" data-id="'+esc(x.id)+'" data-url="'+esc(url)+'">立即修改视频链接</button></div>':' 请联系管理员修改外部视频地址。')+'</div>';
  }
  if(type==="video"){
    if(/^http:\/\//i.test(url))return '<div class="docPreview"><div class="docIcon video">VID</div><strong>'+esc(x.file_name||"视频教程")+'</strong><span>当前使用七牛测试域名，点击下方按钮打开或下载；绑定正式 HTTPS 域名后可恢复网页内播放。</span></div>';
    return embed(url);
  }
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
  img.removeAttribute("src");
  const priorState=q("#importantAnnouncementImageSecureState");
  if(priorState)priorState.remove();
  delete img.dataset.secureImageKey;
  delete img.dataset.mediaBound;
  delete img.dataset.mediaBusy;
  img.classList.remove("securedMediaImage","securedMediaHidden");
  const pictureKey=privateImageKey(x.image_path,x.image_url);
  if(pictureKey){
    img.classList.remove("hidden");
    img.classList.add("securedMediaImage","securedMediaHidden");
    img.dataset.secureImageKey=pictureKey;
    bindSiteMedia(d);
    const imageState=img.nextElementSibling;
    if(imageState?.classList?.contains("securedMediaState"))imageState.id="importantAnnouncementImageSecureState";
  }else if(x.image_url&&!isRestrictedLegacyStorageUrl(x.image_url)&&/^https:\/\//i.test(x.image_url)){
    img.src=x.image_url;img.classList.remove("hidden");img.onerror=()=>img.classList.add("hidden");
  }else{img.classList.add("hidden")}
  q("#importantAnnouncementMeta").textContent="发布人："+(x.publisher_name||"管理员")+" · 发布时间："+fmt(x.created_at);
  q("#closeImportantAnnouncement").onclick=()=>{sessionStorage.setItem(key,"seen");d.close()};
  d.addEventListener("cancel",()=>sessionStorage.setItem(key,"seen"),{once:true});
  d.showModal();
}
function announcementCoverHtml(announcement){
  const markup=siteImageMarkup(announcement.image_url||"",announcement.image_path||"","announcementImage","公告图片");
  // Historical or unsupported URLs must not create large blank cover panels.
  if(!markup||markup.includes('class="securedMediaMessage"'))
    return '<div class="announcementCoverFallback" role="note"><span aria-hidden="true">▧</span><span>封面暂不可预览，公告正文仍可正常查看。</span></div>';
  return '<div class="announcementCoverFrame">'+markup+'</div>';
}
async function loadAnnouncements(adminMode=false){
  const req=supabase.from("announcements").select("*").order("pinned",{ascending:false}).order("pinned_at",{ascending:false,nullsFirst:false}).order("created_at",{ascending:false}).limit(adminMode?50:6);
  const importantReq=adminMode?Promise.resolve({data:[],error:null}):supabase.from("announcements").select("*").eq("level","important").order("pinned",{ascending:false}).order("pinned_at",{ascending:false,nullsFirst:false}).order("created_at",{ascending:false}).limit(1);
  const [r,important]=await Promise.all([req,importantReq]);
  if(r.error){
    console.error("公告加载失败",r.error);
    const box=q("#announcementList"),section=q("#announcementSection");
    if(section)section.classList.remove("hidden");
    if(box)showModuleRetry(box,"公告暂时加载失败："+(r.error?.message||"网络异常"),"announcements",()=>loadAnnouncements(adminMode));
    return;
  }
  const data=r.data||[];
  const badges=x=>'<span class="announcementBadge">'+(x.level==="important"?"重要公告":"公告")+'</span>'+(x.pinned?'<span class="announcementBadge pinnedBadge">置顶</span>':'');
  if(adminMode){
    const box=q("#adminAnnouncementList");
    const count=q("#adminAnnouncementCount");if(count)count.textContent=String(data.length);
    if(!box)return;
    box.innerHTML=data.length?data.map(x=>'<article class="announcement adminAnnouncement '+(x.level==="important"?"important ":"")+(x.pinned?"pinned":"")+'"><div class="announcementTop"><div><div class="announcementBadges">'+badges(x)+'</div><h3>'+esc(x.title)+'</h3></div><div class="rowActions"><button class="btn '+(x.pinned?"ghost":"sec")+' togglePinAnnouncement" data-id="'+esc(x.id)+'" data-pinned="'+(x.pinned?"1":"0")+'">'+(x.pinned?"取消置顶":"置顶")+'</button><button class="btn danger delAnnouncement" data-id="'+esc(x.id)+'" data-path="'+esc(x.image_path||"")+'">删除</button></div></div>'+(x.image_url||x.image_path?announcementCoverHtml(x):"")+(x.content?'<p>'+esc(x.content)+'</p>':'')+'<div class="publisherMeta">发布人：'+esc(x.publisher_name||"管理员")+'</div><small>'+fmt(x.created_at)+'</small></article>').join(""):'<div class="empty">暂无公告。</div>';
    bindSiteMedia(box);
    document.querySelectorAll(".togglePinAnnouncement").forEach(b=>b.onclick=async()=>{
      const now=b.dataset.pinned!=="1";
      const u=await supabase.from("announcements").update({pinned:now,pinned_at:now?new Date().toISOString():null}).eq("id",b.dataset.id);
      if(u.error)return toast((now?"置顶":"取消置顶")+"失败："+u.error.message);
      toast(now?"公告已置顶":"已取消置顶");
      await loadAnnouncements(true);
    });
    document.querySelectorAll(".delAnnouncement").forEach(b=>b.onclick=async()=>{
      if(!confirm("确定删除这条公告吗？"))return;
      const d=await supabase.from("announcements").delete().eq("id",b.dataset.id);
      if(d.error)return toast("删除失败："+d.error.message);
      let cleanupError=null;
      if(b.dataset.path){
        const rm=privateImageKey(b.dataset.path,"")?await removeQiniuObjectSafe(b.dataset.path):await removeStorageObjectSafe("announcement-images",b.dataset.path,{queueOnFail:true});
        cleanupError=rm.error||null;
      }
      toast(cleanupError?"公告已删除，图片文件已加入待清理队列":"公告已删除");
      await loadAnnouncements(true);
    });
  }else{
    const box=q("#announcementList"),section=q("#announcementSection");
    if(!box||!section)return;
    section.classList.remove("hidden");
    box.innerHTML=data.length?data.map(x=>'<article class="announcement '+(x.level==="important"?"important ":"")+(x.pinned?"pinned":"")+'"><div class="announcementTop"><div><div class="announcementBadges">'+badges(x)+'</div><h3>'+esc(x.title)+'</h3></div><div class="announcementMeta"><span class="publisherMeta">发布人：'+esc(x.publisher_name||"管理员")+'</span><small>'+fmt(x.created_at)+'</small></div></div>'+(x.image_url||x.image_path?announcementCoverHtml(x):"")+(x.content?'<p>'+esc(x.content)+'</p>':'')+'</article>').join(""):'<div class="empty">暂无公告。</div>';
    bindSiteMedia(box);
    if(important?.error)console.error("重要公告加载失败",important.error);
    else showImportantAnnouncement((important?.data||[])[0]);
  }
}
async function refreshHomeSummary(){
  const alertBox=q("#homeProgressAlert"),progressModule=q("#homeProgressModule"),alertText=q("#homeProgressAlertText");
  if(alertBox){alertBox.hidden=true;alertBox.classList.remove("show")}
  if(progressModule)progressModule.classList.remove("progressOverdue");
  if(alertText)alertText.textContent="请尽快更新个人进度，或由所在队伍提交队伍进度并将你加入成员名单。";

  const reminderPromise=(state.user&&membershipStatus()==="formal")
    ?fetchProgressRemindersOnce()
    :Promise.resolve({data:[],error:null});
  const minePromise=state.user
    ?supabase.from("submissions").select("id",{count:"exact",head:true}).eq("user_id",state.user.id)
    :Promise.resolve({count:null,data:null,error:null});

  const [metricsReq,reminderReq,mineReq]=await Promise.all([
    fetchHomeMetricsOnce(),
    reminderPromise,
    minePromise
  ]);

  if(!reminderReq.error){
    const mine=(reminderReq.data||[]).find(x=>x.user_id===state.user?.id);
    if(mine){
      if(alertBox){alertBox.hidden=false;alertBox.classList.add("show")}
      if(progressModule)progressModule.classList.add("progressOverdue");
      if(alertText)alertText.textContent="你已经 "+mine.days_since+" 天没有新的个人或队伍进度记录，请尽快更新。";
    }
  }

  const metrics=Array.isArray(metricsReq.data)?metricsReq.data[0]:metricsReq.data;
  const hp=q("#homeActiveProjects");if(hp)hp.textContent=metricsReq.error?"—":String(metrics?.active_projects??0);
  const hu=q("#homeUpdatedMembers");if(hu)hu.textContent=metricsReq.error?"—":String(metrics?.updated_members_14d??0);
  const ho=q("#homeOverdueMembers");if(ho)ho.textContent=metricsReq.error?"—":String(metrics?.overdue_members_14d??0);
  const hm=q("#homeMembers");
  if(hm){
    if(metrics?.formal_members!=null)hm.textContent=String(metrics.formal_members);
    else{
      const members=await fetchMemberCountOnce();
      hm.textContent=members.error?"—":String(members.data??0);
    }
  }
  const mine=q("#homeMine");if(mine)mine.textContent=state.user?(mineReq.error?"—":String(mineReq.count||0)):"—";
}
async function initHome(){
  await Promise.all([refreshHomeSummary(),loadAnnouncements(false)]);
}
async function initWorks(){
  const r=await supabase.from("past_works").select("*").order("year",{ascending:false}).order("created_at",{ascending:false});
  if(r.error){
    showModuleRetry("#worksGrid","往届作品加载失败："+r.error.message,"works",()=>initWorks());
    q("#worksEmpty").classList.add("hidden");
    return;
  }
  const data=r.data||[];
  q("#worksGrid").innerHTML=data.map(x=>'<article class="workCard"><div class="workCover">'+(x.cover_url||x.storage_path?siteImageMarkup(x.cover_url,x.storage_path,"","作品封面："+x.title):'<div class="workFallback">⚙</div>')+'</div><div class="workBody"><div class="workTop"><h3>'+esc(x.title)+'</h3>'+(x.year?'<span class="workYear">'+esc(x.year)+' 届</span>':'')+'</div><div class="workMeta">'+esc(x.team_name||"机械创新实验室")+'</div><p>'+esc(x.description||"暂无作品简介")+'</p><div class="actions">'+(x.detail_url?'<a class="btn sec" target="_blank" rel="noopener" href="'+esc(x.detail_url)+'">查看详情</a>':'')+(isAdmin()?'<button class="btn ghost editWork" data-id="'+esc(x.id)+'">编辑作品</button><button class="btn danger delWork" data-id="'+esc(x.id)+'" data-path="'+esc(x.storage_path||"")+'">删除作品</button>':'')+'</div></div></article>').join("");
  q("#worksEmpty").classList.toggle("hidden",data.length>0);
  bindSiteMedia(q("#worksGrid"));

  document.querySelectorAll(".editWork").forEach(b=>b.onclick=()=>{
    const x=data.find(v=>v.id===b.dataset.id);
    if(!x)return;
    q("#workEditId").value=x.id;
    q("#workEditOldPath").value=x.storage_path||"";
    q("#workEditOldCover").value=x.cover_url||"";
    q("#workEditTitle").value=x.title||"";
    q("#workEditYear").value=x.year||"";
    q("#workEditTeam").value=x.team_name||"";
    q("#workEditDesc").value=x.description||"";
    q("#workEditUrl").value=x.detail_url||"";
    q("#workEditCover").value="";
    q("#workEditDialog").showModal();
  });

  document.querySelectorAll(".delWork").forEach(b=>b.onclick=async()=>{
    if(!confirm("确定删除这个作品吗？"))return;
    const d=await supabase.from("past_works").delete().eq("id",b.dataset.id);
    if(d.error)return toast(d.error.message);
    let cleanupError=null;
    if(b.dataset.path){
      const rm=privateImageKey(b.dataset.path,"")?await removeQiniuObjectSafe(b.dataset.path):await removeStorageObjectSafe("works",b.dataset.path,{queueOnFail:true});
      cleanupError=rm.error||null;
    }
    toast(cleanupError?"作品记录已删除，封面已加入待清理队列":"作品已删除");
    await initWorks();
  });

  const cancel=q("#workEditCancel");
  if(cancel)cancel.onclick=()=>q("#workEditDialog")?.close();

  const form=q("#workEditForm");
  if(form)form.onsubmit=async e=>{
    e.preventDefault();
    const id=q("#workEditId").value;
    const title=q("#workEditTitle").value.trim();
    const yearRaw=q("#workEditYear").value;
    const team=q("#workEditTeam").value.trim();
    const desc=q("#workEditDesc").value.trim();
    const detail=q("#workEditUrl").value.trim();
    const file=q("#workEditCover")?.files?.[0]||null;
    const oldPath=q("#workEditOldPath").value||null;
    const oldCover=q("#workEditOldCover").value||null;
    if(!title)return toast("请填写作品名称");
    if(detail){
      try{new URL(detail)}catch(_e){return toast("详情链接格式不正确")}
    }

    let storage_path=oldPath,cover_url=oldCover;
    const btn=e.submitter||q("#workEditSave");
    const oldText=btn?.textContent||"保存修改";
    let newPath=null;
    try{
      if(file){
        newPath=storageObjectPath("covers",file.name);
        if(btn){btn.disabled=true;btn.textContent="封面上传中 0%"}
        const up=await uploadQiniuFile(file,"admin-work",p=>{if(btn)btn.textContent="封面上传中 "+p+"%"});newPath=up.key;storage_path=up.key;cover_url=up.url;
      }
      if(btn){btn.disabled=true;btn.textContent="正在保存…"}
      const u=await supabase.from("past_works").update({
        title,
        year:yearRaw?Number(yearRaw):null,
        team_name:team||null,
        description:desc||null,
        detail_url:detail||null,
        storage_path,
        cover_url
      }).eq("id",id);
      if(u.error){
        if(newPath)await removeQiniuObjectSafe(newPath);
        throw u.error;
      }
      if(newPath&&oldPath&&oldPath!==newPath){
        const rm=privateImageKey(oldPath,oldCover)?await removeQiniuObjectSafe(oldPath):await removeStorageObjectSafe("works",oldPath);
        if(rm.error)console.warn("旧作品封面清理失败",rm.error);
      }
      q("#workEditDialog").close();
      toast("作品信息已更新");
      await initWorks();
    }catch(err){
      toast("作品修改失败："+(err?.message||String(err)));
    }finally{
      if(btn){btn.disabled=false;btn.textContent=oldText}
    }
  };
}
function examUsesQiniu(exam){
  return exam.storage_backend==="qiniu"||isQiniuStorageKey(exam.storage_path);
}
function examAttachmentMarkup(exam){
  const path=exam.storage_path||"";
  if(examUsesQiniu(exam)&&path){
    return '<button class="btn sec qiniuOpenBtn" type="button" data-key="'+esc(path)+'">打开 / 下载附件</button>';
  }
  const url=exam.file_url||(path?supabase.storage.from("exams").getPublicUrl(path).data.publicUrl:"");
  if(!/^https?:\/\//i.test(url))return "";
  if(isRestrictedLegacyStorageUrl(url))return pendingLegacyFileMarkup("作业附件");
  const isPdf=/\.pdf(?:$|[?#])/i.test(exam.file_name||path||url);
  return '<a class="btn sec" target="_blank" rel="noopener" href="'+esc(url)+'">'+(isPdf?"查看 / 下载 PDF":"打开 / 下载附件")+'</a>';
}
async function initExams(){
  const r=await supabase.from("exams").select("*").order("created_at",{ascending:false});
  if(r.error){
    showModuleRetry("#examGrid","作业加载失败："+r.error.message,"exams",()=>initExams());
    q("#examEmpty").classList.add("hidden");
    return;
  }
  const data=r.data||[];
  q("#examGrid").innerHTML=data.map(x=>{
    const attachment=examAttachmentMarkup(x);
    const fileInfo=attachment?'<div class="meta" style="overflow-wrap:anywhere">附件：'+esc(x.file_name||"作业附件")+'</div>':'<div class="meta">本作业无附件，请按作业说明完成。</div>';
    return '<article class="card"><span class="tag">作业 / 任务</span><h3>'+esc(x.title)+'</h3><p style="white-space:pre-wrap;overflow-wrap:anywhere">'+esc(x.description||"暂无说明")+'</p><div class="meta">截止：'+fmt(x.deadline)+'</div>'+fileInfo+'<div class="actions">'+attachment+'<a class="btn pri" href="./submit.html?exam='+encodeURIComponent(x.id)+'">提交作业</a>'+(isAdmin()?'<button class="btn danger delExam" data-id="'+esc(x.id)+'" data-path="'+esc(x.storage_path||"")+'" data-backend="'+(examUsesQiniu(x)?"qiniu":"supabase")+'">删除</button>':'')+'</div></article>';
  }).join("");
  bindQiniuOpenButtons(q("#examGrid"));
  q("#examEmpty").classList.toggle("hidden",data.length>0);
  document.querySelectorAll(".delExam").forEach(b=>b.onclick=async()=>{
    if(!confirm("确定删除该作业 / 任务及关联提交吗？"))return;
    const rel=await supabase.from("submissions").select("storage_path,storage_backend").eq("exam_id",b.dataset.id);
    if(rel.error)return toast("关联提交读取失败："+rel.error.message);
    const related=(rel.data||[]).filter(x=>x.storage_path);
    const qiniuPaths=related.filter(x=>x.storage_backend==="qiniu"||isQiniuStorageKey(x.storage_path)).map(x=>x.storage_path);
    const supabasePaths=related.filter(x=>!(x.storage_backend==="qiniu"||isQiniuStorageKey(x.storage_path))).map(x=>x.storage_path);
    const d=await supabase.from("exams").delete().eq("id",b.dataset.id);
    if(d.error)return toast("删除任务失败："+d.error.message);
    const cleanupResults=[];
    if(qiniuPaths.length){
      const qr=await Promise.all(qiniuPaths.map(path=>removeQiniuObjectSafe(path)));
      cleanupResults.push(...qr);
    }
    if(supabasePaths.length)cleanupResults.push(await removeStorageObjectsSafe("submissions",supabasePaths,{queueOnFail:true}));
    if(b.dataset.path)cleanupResults.push(b.dataset.backend==="qiniu"
      ?await removeQiniuObjectSafe(b.dataset.path)
      :await removeStorageObjectSafe("exams",b.dataset.path,{queueOnFail:true}));
    const cleanupFailed=cleanupResults.some(x=>x?.error);
    toast(cleanupFailed?"任务及关联记录已删除，但有云端文件清理失败，请稍后重试":"试卷 / 任务、关联提交及云端文件已同步删除");
    await initExams();
  });
}
async function initTutorials(){
  const r=await supabase.from("tutorials").select("*").order("created_at",{ascending:false});
  if(r.error){
    showModuleRetry("#videoGrid","教程资料加载失败："+r.error.message,"tutorials",()=>initTutorials());
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
      const type=x.resource_type||"video",url=x.video_url||"",legacyFile=isRestrictedLegacyStorageUrl(url),action=type==="video"?"打开 / 播放视频":type==="pdf"?"查看 / 下载 PDF":type==="word"?"打开 / 下载 Word":type==="archive"?"下载压缩包":"打开 / 下载 PPT";
      const qiniuAction=x.storage_backend==="qiniu"&&x.storage_path
        ?'<button class="btn sec qiniuOpenBtn" type="button" data-key="'+esc(x.storage_path)+'">'+action+'</button>'
        :"";
      const normalAction=qiniuAction?"":(legacyFile?pendingLegacyFileMarkup("教程文件"):((type==="video"&&(!/^https?:/i.test(url)||isOwnPlatformUrl(url)))?"":'<a class="btn sec" target="_blank" rel="noopener" href="'+esc(url)+'">'+action+'</a>'));
      return '<article class="video"><div class="frame '+(type!=="video"?"docFrame":"")+'">'+resourcePreview(x)+'</div><div class="info"><span class="resourceType">'+resourceTypeName(type)+'</span><h3>'+esc(x.title)+'</h3><p style="color:#8fa4bd">'+esc(x.description||"暂无简介")+'</p><div class="actions">'+qiniuAction+normalAction+(isAdmin()&&!x.storage_path&&!isOwnPlatformUrl(url)?'<button class="btn ghost editTutorialUrl" data-id="'+esc(x.id)+'" data-url="'+esc(url)+'">修改链接</button>':'')+(isAdmin()?'<button class="btn danger delTutorial" data-id="'+esc(x.id)+'" data-url="'+esc(url)+'" data-path="'+esc(x.storage_path||"")+'" data-backend="'+esc(x.storage_backend||"supabase")+'">删除教程</button>':'')+'</div></div></article>';
    }).join("");
    q("#videoEmpty").classList.toggle("hidden",data.length>0);
    q("#videoEmpty").textContent=all.length?"没有找到符合条件的教程资料。":"暂时还没有教程。";
    bindQiniuOpenButtons(q("#videoGrid"));
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
      const d=await supabase.from("tutorials").delete().eq("id",b.dataset.id);
      if(d.error)return toast(d.error.message);
      let cleanupError=null;
      if(p){
        const rm=b.dataset.backend==="qiniu"
          ?await removeQiniuObjectSafe(p)
          :await removeStorageObjectSafe("tutorials",p,{queueOnFail:true});
        cleanupError=rm.error||null;
      }
      toast(cleanupError?"教程记录已删除，文件已加入待清理队列":"教程资料已删除");
      await initTutorials();
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
  if(r.error){showModuleRetry(box,"资料分享加载失败："+r.error.message,"resource-shares",()=>loadResourceShares());return}
  const data=r.data||[];
  q("#resourceShareCount")&&(q("#resourceShareCount").textContent=String(data.length));
  box.innerHTML=data.length?data.map(x=>{
    const link=x.link_url||"";
    return '<article class="shareCard">'+(x.image_url||x.image_path?siteImageMarkup(x.image_url,x.image_path,"shareImage","资料分享图片"):"")+'<div class="shareBody"><div class="fileTop"><span class="resourceType">资料分享</span><small>'+fmt(x.created_at)+'</small></div><h3>'+esc(x.title)+'</h3>'+(x.content?'<p>'+esc(x.content)+'</p>':'')+'<div class="actions">'+(link?'<a class="btn sec" href="'+esc(link)+'" target="_blank" rel="noopener noreferrer">打开链接</a>':'')+(isAdmin()?'<button class="btn danger delResourceShare" data-id="'+esc(x.id)+'" data-path="'+esc(x.image_path||"")+'">删除分享</button>':'')+'</div></div></article>';
  }).join(""):'<div class="empty">暂时还没有资料分享。</div>';
  bindSiteMedia(box);
  document.querySelectorAll(".delResourceShare").forEach(b=>b.onclick=async()=>{
    if(!confirm("确定删除这条资料分享吗？"))return;
    const d=await supabase.from("resource_shares").delete().eq("id",b.dataset.id);
    if(d.error)return toast("删除失败："+d.error.message);
    let cleanupError=null;
    if(b.dataset.path){
      const rm=privateImageKey(b.dataset.path,"")?await removeQiniuObjectSafe(b.dataset.path):await removeStorageObjectSafe("resource-share-images",b.dataset.path,{queueOnFail:true});
      cleanupError=rm.error||null;
    }
    toast(cleanupError?"资料分享已删除，图片已加入待清理队列":"资料分享已删除");
    await loadResourceShares();
  });
}
let __fileLibraryLoadSeq=0;
async function initFiles(){
  const loadSeq=++__fileLibraryLoadSeq;
  const refreshBtn=q("#fileRefresh");
  if(refreshBtn){
    refreshBtn.disabled=true;
    refreshBtn.textContent="刷新中…";
    refreshBtn.onclick=()=>initFiles();
  }
  const [filesReq,sharesReq]=await Promise.all([
    supabase.from("lab_files").select("*").order("created_at",{ascending:false}),
    supabase.from("resource_shares").select("*").order("created_at",{ascending:false})
  ]);
  if(loadSeq!==__fileLibraryLoadSeq)return;
  if(filesReq.error||sharesReq.error){
    const msg=filesReq.error?.message||sharesReq.error?.message||"未知错误";
    showModuleRetry("#fileGrid","资料库加载失败："+msg,"files",()=>initFiles());
    if(refreshBtn){refreshBtn.disabled=false;refreshBtn.textContent="刷新资料";}
    return;
  }
  const fileRows=(filesReq.data||[]).map(x=>({...x,_source:"lab"}));
  const shareRows=(sharesReq.data||[]).map(x=>({
    id:x.id,
    title:x.title,
    description:x.content||null,
    category:x.file_name?progressFileKind(x.file_name,x.file_mime):x.link_url?"link":x.image_url?"image":"text",
    resource_mode:x.file_name?"file":x.link_url?"link":"text",
    external_url:x.link_url||null,
    image_url:x.image_url||null,
    image_path:x.image_path||null,
    image_name:x.image_name||null,
    file_url:x.file_url||null,
    file_path:x.file_path||null,
    file_name:x.file_name||null,
    storage_path:x.file_path||null,
    storage_backend:x.file_storage_backend||"supabase",
    file_storage_backend:x.file_storage_backend||"supabase",
    file_size:Number(x.file_size||0),
    file_mime:x.file_mime||null,
    publisher_name:x.publisher_name||"管理员",
    created_at:x.created_at,
    _source:"share"
  }));
  const all=[...fileRows,...shareRows].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
  const select=q("#fileFilter"),search=q("#fileSearch");
  const render=()=>{
    const f=select?.value||"all",term=(search?.value||"").trim().toLowerCase();
    let data=f==="all"?all:all.filter(x=>x.category===f);
    if(term)data=data.filter(x=>{
      const hay=[x.title,x.description,x.file_name,x.external_url,x.publisher_name,labFileTypeName(x.category),x._source==="share"?"资料分享":"资料库"].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(term);
    });
    q("#fileCount").textContent=String(data.length);
    q("#fileGrid").innerHTML=data.length?data.map(x=>{
      const mode=x.resource_mode||"file";
      let action="";
      if(mode==="file"&&x.storage_path){
        if(x.storage_backend==="qiniu"){
          action='<button class="btn sec qiniuOpenBtn" type="button" data-key="'+esc(x.storage_path)+'">打开 / 下载</button>';
        }else{
          const url=x._source==="share"&&x.file_url
            ?x.file_url
            :supabase.storage.from("lab-files").getPublicUrl(x.storage_path).data.publicUrl;
          action=isRestrictedLegacyStorageUrl(url)?pendingLegacyFileMarkup("资料附件"):'<a class="btn sec" href="'+esc(url)+'" target="_blank" rel="noopener">打开 / 下载</a>';
        }
      }else if(mode==="link"&&x.external_url){
        action='<a class="btn sec" href="'+esc(x.external_url)+'" target="_blank" rel="noopener noreferrer">打开链接</a>';
      }
      const meta=x._source==="share"?"资料分享":mode==="file"?(esc(x.file_name||"文件")+' · '+bytesText(Number(x.file_size||0))):mode==="link"?"外部链接":"文字资料";
      const image=x.image_url||x.image_path?siteImageMarkup(x.image_url,x.image_path,"libraryShareImage","资料图片"):"";
      return '<article class="fileCard '+esc(mode)+'Mode">'+
        '<div class="fileIcon '+esc(x.category)+'">'+labFileIcon(x.category)+'</div>'+
        '<div class="fileBody"><div class="fileTop"><span class="resourceType">'+labFileTypeName(x.category)+'</span><small>'+fmt(x.created_at)+'</small></div>'+
        '<h3>'+esc(x.title)+'</h3>'+image+(x.description?'<p>'+esc(x.description)+'</p>':'')+
        '<div class="fileMeta">'+meta+'</div><div class="publisherMeta">发布人：'+esc(x.publisher_name||"管理员")+'</div><div class="actions">'+action+
        (isAdmin()&&x._source==="share"&&!x.file_path?'<button class="btn ghost attachShareFile" data-id="'+esc(x.id)+'">补传文件</button>':'')+
        (isAdmin()?'<button class="btn danger delUnifiedResource" data-id="'+esc(x.id)+'" data-source="'+esc(x._source)+'" data-backend="'+esc(x._source==="share"?(x.file_storage_backend||"supabase"):(x.storage_backend||"supabase"))+'" data-path="'+esc(x.storage_path||x.file_path||x.image_path||"")+'" data-filepath="'+esc(x.file_path||"")+'" data-imagepath="'+esc(x.image_path||"")+'">删除</button>':'')+
        '</div></div></article>';
    }).join(""):'<div class="empty">'+(term?"没有找到匹配的资料。":"当前分类暂无资料。")+'</div>';
    bindQiniuOpenButtons(q("#fileGrid"));
    bindSiteMedia(q("#fileGrid"));
    document.querySelectorAll(".attachShareFile").forEach(b=>b.onclick=()=>{
      const input=document.createElement("input");
      input.type="file";
      input.accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv,.zip,.rar,.7z,video/*,audio/*";
      input.onchange=async()=>{
        const f=input.files[0];if(!f)return;
        let path=null,url=null,backend="supabase";
        try{
          const cloudCategory="admin-share";
          if(cloudCategory){
            toast("正在直传七牛云…");
            const uploaded=await uploadQiniuFile(f,cloudCategory);
            path=uploaded.key;url=uploaded.url;backend="qiniu";
          }else{
            path=state.user.id+"/"+storageObjectPath("share-files",f.name);
            toast("正在上传附件…");
            await uploadStorageFile("resource-share-files",path,f);
            url=supabase.storage.from("resource-share-files").getPublicUrl(path).data.publicUrl;
          }
          const u=await supabase.from("resource_shares").update({file_url:url,file_path:path,file_name:f.name,file_size:f.size,file_mime:f.type||null,file_storage_backend:backend}).eq("id",b.dataset.id);
          if(u.error){
            if(backend==="qiniu")await removeQiniuObjectSafe(path);
            else await removeStorageObjectSafe("resource-share-files",path);
            throw u.error
          }
          toast("附件已补传");await initFiles();
        }catch(err){toast("附件上传失败："+(err?.message||String(err)))}
      };
      input.click();
    });
    document.querySelectorAll(".delUnifiedResource").forEach(b=>b.onclick=async()=>{
      if(!confirm("确定删除这条资料吗？删除后无法恢复。"))return;
      const source=b.dataset.source,backend=b.dataset.backend||"supabase",path=b.dataset.path||"",filePath=b.dataset.filepath||"",imagePath=b.dataset.imagepath||"";
      const oldText=b.textContent||"删除";
      b.disabled=true;
      b.textContent="删除中…";
      const card=b.closest(".fileCard");
      const d=source==="lab"
        ?await supabase.from("lab_files").delete().eq("id",b.dataset.id)
        :await supabase.from("resource_shares").delete().eq("id",b.dataset.id);
      if(d.error){
        b.disabled=false;
        b.textContent=oldText;
        return toast((source==="lab"?"记录":"分享")+"删除失败："+d.error.message);
      }

      // 数据库删除完成后立即更新界面，云端对象清理放到后台执行，避免七牛接口延迟阻塞用户。
      if(card)card.remove();
      const countEl=q("#fileCount");
      if(countEl){
        const n=Number(countEl.textContent||0);
        if(Number.isFinite(n)&&n>0)countEl.textContent=String(n-1);
      }
      toast(backend==="qiniu"?"资料已删除，七牛云文件正在后台清理…":"资料已删除");

      void (async()=>{
        const cleanupResults=[];
        if(source==="lab"&&path)cleanupResults.push(backend==="qiniu"?await removeQiniuObjectSafe(path):await removeStorageObjectSafe("lab-files",path,{queueOnFail:true}));
        if(source!=="lab"&&filePath)cleanupResults.push(backend==="qiniu"?await removeQiniuObjectSafe(filePath):await removeStorageObjectSafe("resource-share-files",filePath,{queueOnFail:true}));
        if(source!=="lab"&&imagePath)cleanupResults.push(privateImageKey(imagePath,"")?await removeQiniuObjectSafe(imagePath):await removeStorageObjectSafe("resource-share-images",imagePath,{queueOnFail:true}));
        const cleanupFailed=cleanupResults.some(x=>x?.error);
        if(cleanupFailed)toast("资料记录已删除，但部分云端文件清理失败，可稍后再清理");
      })();
    });
  };
  if(select)select.onchange=render;
  if(search)search.oninput=render;
  render();
  if(refreshBtn){refreshBtn.disabled=false;refreshBtn.textContent="刷新资料";}
}

function progressFileKind(name="",mime=""){
  const n=(name||"").toLowerCase(),m=(mime||"").toLowerCase();
  if(m.startsWith("image/")||/\.(png|jpe?g|webp|gif)$/i.test(n))return "image";
  if(m.startsWith("video/")||/\.(mp4|webm|ogg|mov|m4v)$/i.test(n))return "video";
  if(/\.(ppt|pptx)$/i.test(n))return "ppt";
  if(/\.(xls|xlsx|csv)$/i.test(n))return "sheet";
  if(/\.pdf$/i.test(n))return "pdf";
  if(/\.(doc|docx)$/i.test(n))return "word";
  if(/\.(zip|rar|7z)$/i.test(n))return "archive";
  return "file";
}
async function preloadProgressSignedUrls(rows=[]){
  const now=Date.now();
  const paths=[...new Set(rows.map(x=>x?.attachment_path).filter(path=>path&&!isQiniuStorageKey(path)))];
  const needed=paths.filter(path=>{
    const hit=progressSignedUrlCache.get(path);
    return !hit||hit.expiresAt<=now;
  });
  if(!needed.length)return;
  try{
    const r=await supabase.storage.from("progress-files").createSignedUrls(needed,3600);
    if(!r.error){
      (r.data||[]).forEach((item,i)=>{
        const path=item.path||needed[i];
        if(path&&item.signedUrl)progressSignedUrlCache.set(path,{url:item.signedUrl,expiresAt:now+PROGRESS_SIGNED_URL_TTL});
      });
      return;
    }
  }catch(_e){}
  await Promise.all(needed.map(async path=>{
    try{
      const s=await supabase.storage.from("progress-files").createSignedUrl(path,3600);
      if(!s.error&&s.data?.signedUrl)progressSignedUrlCache.set(path,{url:s.data.signedUrl,expiresAt:now+PROGRESS_SIGNED_URL_TTL});
    }catch(_e){}
  }));
}
async function progressAttachmentHtml(x){
  if(!x.attachment_path)return "";
  const kind=progressFileKind(x.attachment_name,x.attachment_mime);
  if(isQiniuStorageKey(x.attachment_path)){
    if(kind==="image")return '<div class="progressSecurePreview">'+siteImageMarkup("",x.attachment_path,"progressMedia progressImage",x.attachment_name||"进度图片")+
      '<button class="progressAttachment btn sec qiniuOpenBtn" type="button" data-key="'+esc(x.attachment_path)+'" title="'+esc(x.attachment_name||"图片")+'">查看原图 ↗</button></div>';
    if(kind==="video"&&/\.(mp4|webm)$/i.test(x.attachment_name||x.attachment_path)){
      return '<div class="progressSecureVideo"><video class="progressMedia progressVideo" controls playsinline preload="none" hidden></video><div class="actions"><button type="button" class="progressAttachment btn pri qiniuPlayBtn" data-key="'+esc(x.attachment_path)+'" title="'+esc(x.attachment_name||"视频")+'">▶ 在线播放</button><button type="button" class="progressAttachment btn sec qiniuOpenBtn" data-key="'+esc(x.attachment_path)+'" title="'+esc(x.attachment_name||"视频")+'">↗ 打开 / 下载</button></div></div>';
    }
    const label=kind==="video"?"打开 / 下载视频":"打开附件";
    return '<button class="progressAttachment btn sec qiniuOpenBtn" type="button" data-key="'+esc(x.attachment_path)+'" title="'+esc(x.attachment_name||"文件")+'">'+label+'</button>';
  }
  let hit=progressSignedUrlCache.get(x.attachment_path);
  if(!hit||hit.expiresAt<=Date.now()){
    await preloadProgressSignedUrls([x]);
    hit=progressSignedUrlCache.get(x.attachment_path);
  }
  if(!hit?.url)return '<div class="progressFileMeta">附件暂时无法打开</div>';
  const url=hit.url;
  if(kind==="image")return '<a href="'+esc(url)+'" target="_blank" rel="noopener"><img class="progressMedia progressImage" loading="lazy" decoding="async" src="'+esc(url)+'" alt="'+esc(x.attachment_name||"进度图片")+'"></a>';
  if(kind==="video")return '<video class="progressMedia progressVideo" controls preload="metadata" playsinline src="'+esc(url)+'"></video>';
  return '<a class="progressAttachment btn sec" href="'+esc(url)+'" target="_blank" rel="noopener" title="'+esc(x.attachment_name||"文件")+'">打开附件 ↗</a>';
}
async function progressCardHtml(x,adminMode=false){
  const media=await progressAttachmentHtml(x);
  const project=x.project_id?(await fetchProjectDirectory()).find(p=>p.id===x.project_id):null;
  const mine=state.user&&x.user_id===state.user.id;
  return '<article class="progressCard">'+
    '<div class="progressCardTop"><div><span class="resourceType">'+esc(x.member_name||"成员")+'</span><h3>'+esc(x.member_name||"成员")+(x.member_major?' · '+esc(x.member_major):'')+'</h3>'+(project?'<div class="meta">关联项目：'+esc(project.name)+'</div>':'')+'</div><time>'+fmt(x.created_at)+'</time></div>'+
    '<div class="progressColumns"><section><span>近期进度</span><p>'+esc(x.current_progress||"")+'</p></section><section><span>下一时期目标</span><p>'+esc(x.next_goal||"")+'</p></section></div>'+
    (x.link_url?'<div class="actions"><a class="btn sec" href="'+esc(x.link_url)+'" target="_blank" rel="noopener noreferrer">打开相关链接</a></div>':'')+
    media+
    ((adminMode||mine)?'<div class="actions"><button class="btn danger delProgress" data-id="'+esc(x.id)+'" data-path="'+esc(x.attachment_path||"")+'">删除记录</button></div>':'')+
    '</article>';
}
async function renderProgressList(rows,box,adminMode=false){
  if(!box)return;
  if(!rows.length){box.innerHTML='<div class="empty">暂时还没有进度更新。</div>';return}
  await preloadProgressSignedUrls(rows);
  box.innerHTML=(await Promise.all(rows.map(x=>progressCardHtml(x,adminMode)))).join("");
  bindQiniuOpenButtons(box);
  bindSiteMedia(box);
  box.querySelectorAll(".delProgress").forEach(b=>b.onclick=async()=>{
    if(!confirm("确定删除这条进度记录吗？"))return;
    const d=await supabase.from("progress_updates").delete().eq("id",b.dataset.id);
    if(d.error)return toast("删除失败："+d.error.message);
    let cleanupError=null;
    if(b.dataset.path){
      const rm=isQiniuStorageKey(b.dataset.path)
        ?await removeQiniuObjectSafe(b.dataset.path)
        :await removeStorageObjectSafe("progress-files",b.dataset.path,{queueOnFail:true});
      cleanupError=rm.error||null;
    }
    toast(cleanupError?"进度记录已删除，附件已加入待清理队列":"进度记录已删除");
    await loadProgressPage();
  });
}
async function loadTeamMemberOptions(resetSelection=false){
  const box=q("#teamMemberOptions");if(!box||!state.user)return;
  const search=q("#teamMemberSearch"),selected=q("#teamMemberSelectedCount"),preview=q("#teamSelectedPreview");
  const r=await fetchFormalMemberDirectoryOnce();
  if(r.error){box.innerHTML='<div class="empty">正式成员加载失败：'+esc(r.error.message)+'</div>';return}
  const rows=r.data||[];
  teamMemberDirectory.clear();
  rows.forEach(m=>teamMemberDirectory.set(m.id,m));

  if(resetSelection){
    teamMemberSelection.clear();
    if(state.user?.id&&teamMemberDirectory.has(state.user.id))teamMemberSelection.add(state.user.id);
  }else if(teamMemberSelection.size===0&&state.user?.id&&teamMemberDirectory.has(state.user.id)){
    teamMemberSelection.add(state.user.id);
  }

  const renderPreview=()=>{
    if(selected)selected.textContent="已选 "+teamMemberSelection.size+" 人";
    const members=[...teamMemberSelection].map(id=>teamMemberDirectory.get(id)).filter(Boolean);
    if(preview){
      preview.innerHTML=members.length
        ? members.map(m=>'<span class="teamSelectedChip">'+esc(m.full_name||"成员")+'</span>').join("")
        : '<span class="profileHint">本次将计入：尚未选择成员</span>';
    }
    const leader=q("#teamLeader");
    if(leader){
      const previous=leader.value;
      leader.innerHTML='<option value="">请选择负责人</option>'+members.map(m=>'<option value="'+esc(m.id)+'">'+esc(m.full_name||"成员")+(m.major?' · '+esc(m.major):'')+'</option>').join("");
      if(previous&&teamMemberSelection.has(previous))leader.value=previous;
    }
  };

  box.innerHTML=rows.length?rows.map(m=>{
    const name=m.full_name||"成员";
    const meta=m.major||"专业信息未填写";
    const searchText=(name+" "+meta).toLowerCase();
    return '<label class="teamMemberChoice" data-search="'+esc(searchText)+'"><input type="checkbox" class="teamMemberCheck" value="'+esc(m.id)+'" '+(teamMemberSelection.has(m.id)?'checked':'')+'><span class="teamMemberText"><b>'+esc(name)+'</b><small>'+esc(meta)+'</small></span></label>';
  }).join(""):'<div class="empty">当前没有正式成员。</div>';

  const filter=()=>{
    const key=(search?.value||"").trim().toLowerCase();
    let shown=0;
    box.querySelectorAll(".teamMemberChoice").forEach(el=>{
      const ok=!key||(el.dataset.search||"").includes(key);
      el.classList.toggle("hidden",!ok);
      if(ok)shown++;
    });
    let empty=q("#teamMemberSearchEmpty");
    if(!shown&&rows.length){
      if(!empty){empty=document.createElement("div");empty.id="teamMemberSearchEmpty";empty.className="teamMemberSearchEmpty";box.appendChild(empty)}
      empty.textContent='没有找到匹配“'+(search?.value||"")+'”的正式成员';
      empty.classList.remove("hidden");
    }else if(empty)empty.classList.add("hidden");
  };

  box.querySelectorAll(".teamMemberCheck").forEach(x=>x.addEventListener("change",()=>{
    if(x.checked)teamMemberSelection.add(x.value);else teamMemberSelection.delete(x.value);
    renderPreview();
  }));
  if(search){search.oninput=filter;search.value="";}
  renderPreview();
  filter();
}
function applyProgressFeedSearch(){
  const input=q("#progressFeedSearch");
  const clear=q("#progressFeedSearchClear");
  const summary=q("#progressFeedSearchResult");
  if(!input)return;
  const keyword=input.value.trim().toLowerCase();
  const personalCards=[...document.querySelectorAll("#progressFeed .progressCard")];
  const teamCards=[...document.querySelectorAll("#teamProgressFeed .teamProgressCard")];
  const filterCards=cards=>{
    let visible=0;
    cards.forEach(card=>{
      const hit=!keyword||(card.textContent||"").toLowerCase().includes(keyword);
      card.classList.toggle("hidden",!hit);
      if(hit)visible++;
    });
    return visible;
  };
  const personalVisible=filterCards(personalCards);
  const teamVisible=filterCards(teamCards);
  if(clear)clear.classList.toggle("hidden",!keyword);
  if(summary){
    summary.textContent=keyword
      ?"个人匹配 "+personalVisible+" 条 · 队伍匹配 "+teamVisible+" 条"
      :"可搜索姓名、专业、比赛名称、进度内容和下一阶段目标";
  }
}
function bindProgressFeedSearch(){
  const input=q("#progressFeedSearch"),clear=q("#progressFeedSearchClear");
  if(!input)return;
  input.oninput=applyProgressFeedSearch;
  if(clear)clear.onclick=()=>{input.value="";applyProgressFeedSearch();input.focus()};
  applyProgressFeedSearch();
}
async function loadTeamProgressFeed(){
  const box=q("#teamProgressFeed");
  if(!box){
    const metric=q("#progressTeamRecordMetric");
    if(metric){
      const {count,error}=await supabase.from("team_progress_updates").select("id",{count:"exact",head:true});
      if(!error)metric.textContent=String(count||0);
    }
    return;
  }
  const [t,m]=await Promise.all([
    supabase.from("team_progress_updates").select("*").order("created_at",{ascending:false}),
    supabase.from("team_progress_members").select("team_progress_id,member_id,member_name_snapshot")
  ]);
  if(t.error){showModuleRetry(box,"队伍进度加载失败："+t.error.message,"team-progress",()=>loadTeamProgressFeed());return}
  if(m.error){showModuleRetry(box,"队伍成员加载失败："+m.error.message,"team-progress-members",()=>loadTeamProgressFeed());return}
  const membersBy=new Map();
  (m.data||[]).forEach(x=>{if(!membersBy.has(x.team_progress_id))membersBy.set(x.team_progress_id,[]);membersBy.get(x.team_progress_id).push(x)});
  const rows=t.data||[];
  await preloadProgressSignedUrls(rows);
  const count=q("#teamProgressCount");if(count)count.textContent=String(rows.length);
  if(!rows.length){box.innerHTML='<div class="empty">暂时还没有队伍进度更新。</div>';return}

  box.innerHTML=(await Promise.all(rows.map(async x=>{
    const ms=membersBy.get(x.id)||[];
    const media=await progressAttachmentHtml(x);
    const project=x.project_id?(await fetchProjectDirectory()).find(p=>p.id===x.project_id):null;
    return '<article class="teamProgressCard"><div class="progressCardTop"><div><span class="eyebrow">TEAM PROGRESS</span><h3>'+esc(x.competition_name||"比赛")+'</h3>'+(project?'<div class="meta">关联项目：'+esc(project.name)+'</div>':'')+'</div><time>'+fmt(x.created_at)+'</time></div>'+
      '<div class="progressColumns"><section><span>队伍进度</span><p>'+esc(x.team_progress||"")+'</p></section>'+
      (x.next_goal?'<section><span>下一阶段目标</span><p>'+esc(x.next_goal)+'</p></section>':'')+'</div>'+
      '<div class="meta">提交人：'+esc(x.created_by_name||"成员")+'</div>'+
      '<div class="teamProgressMembers">'+ms.map(v=>'<span class="teamProgressMember">'+esc(v.member_name_snapshot||"成员")+'</span>').join("")+'</div>'+
      (x.link_url?'<div class="actions"><a class="btn sec" target="_blank" rel="noopener noreferrer" href="'+esc(x.link_url)+'">打开相关链接</a></div>':'')+
      media+
      ((state.user&&x.created_by===state.user.id)||isAdmin()?'<div class="actions"><button class="btn danger delTeamProgress" data-id="'+esc(x.id)+'" data-path="'+esc(x.attachment_path||"")+'">删除队伍进度</button></div>':'')+
      '</article>';
  }))).join("");

  bindQiniuOpenButtons(box);
  bindSiteMedia(box);
  box.querySelectorAll(".delTeamProgress").forEach(b=>b.onclick=async()=>{
    if(!confirm("确定删除这条队伍进度吗？\n\n该队伍记录、成员关联和附件都会一起清理。"))return;
    const d=await supabase.from("team_progress_updates").delete().eq("id",b.dataset.id);
    if(d.error)return toast("删除失败："+d.error.message);
    if(b.dataset.path){
      const rm=isQiniuStorageKey(b.dataset.path)
        ?await removeQiniuObjectSafe(b.dataset.path)
        :await removeStorageObjectSafe("progress-files",b.dataset.path,{queueOnFail:true});
      if(rm.error)console.warn("队伍附件清理失败",rm.error);
    }
    toast("队伍进度已删除");
    await loadProgressPage();
  });
  applyProgressFeedSearch();
}
async function loadPersonalProgressFeed(){
  if(!state.user)return;
  const r=await supabase.from("progress_updates").select("*").order("created_at",{ascending:false});
  if(r.error){
    const box=q("#progressFeed");if(box)showModuleRetry(box,"个人进度加载失败："+r.error.message,"personal-progress",()=>loadPersonalProgressFeed());
    return;
  }
  const all=r.data||[],own=all.filter(x=>x.user_id===state.user.id);
  const c=q("#progressAllCount");if(c)c.textContent=String(all.length);
  const m=q("#progressMineCount");if(m)m.textContent=String(own.length);
  const personalStatusLabel=q("#personalStatusLabel");
  const personalStatusTime=q("#personalStatusTime");
  const latestOwn=own[0]||null;
  if(personalStatusLabel)personalStatusLabel.textContent=latestOwn?"已更新":"尚未更新";
  if(personalStatusTime)personalStatusTime.textContent=latestOwn?fmt(latestOwn.created_at):"—";
  await Promise.all([
    renderProgressList(all,q("#progressFeed"),false),
    renderProgressList(own,q("#myProgressList"),false)
  ]);
  applyProgressFeedSearch();
}
let progressBulkEligible=[];
let progressBulkReady=false;
async function sendBulkReminders(){
 const selected=[...q("#progressBulkChoices").querySelectorAll('input:checked')].map(x=>x.value);
 const eligible=new Map(progressBulkEligible.map(x=>[x.user_id,x]));
 const ids=selected.filter(id=>eligible.has(id));
 if(!ids.length){q("#progressBulkStatus").textContent="请至少选择一名成员";return}
 if(!confirm("确定对选中的 "+ids.length+" 名逾期成员逐一发送提醒？"))return;
 const btn=q("#progressBulkSend"),cancel=q("#progressBulkCancel");btn.disabled=true;cancel.disabled=true;
 let site=0,push=0,failed=0,skipped=0;
 for(let i=0;i<ids.length;i++){
   const id=ids[i];q("#progressBulkStatus").textContent="正在处理 "+(i+1)+"/"+ids.length+"；站内成功 "+site+"，微信已接受 "+push+"，跳过 "+skipped+"，失败 "+failed;
   try{
     const row={sender_id:state.user.id,recipient_id:id,message_type:"reminder",message:"你的近期项目进度已经超过两周没有更新，请及时登录实验室网站补充当前成果与下一步计划。"};
     const result=await supabase.from("progress_member_notices").insert(row).select("id").single();
     if(result.error){skipped++;continue}
     site++;
     try{const remote=await supabase.functions.invoke("serverchan-dispatch",{body:{kind:"notice",notice_id:result.data.id}});if(!remote.error&&remote.data?.ok)push++;else failed++}catch(_e){failed++}
   }catch(_e){failed++}
 }
 q("#progressBulkStatus").textContent="已完成：站内 "+site+" 条；微信接口接受 "+push+" 条；微信未成功 "+failed+" 条；重复提醒或限制跳过 "+skipped+" 条。微信是否实际收到需成员确认。";
 btn.textContent="已执行";cancel.disabled=false;
}
function setupProgressBulkReminder(reminders){
 const actions=q("#progressBulkActions"),dialog=q("#progressBulkDialog");
 if(!actions||!dialog||!state.user)return;
 // A member can read the overdue list, but may not send without server authorization.
 const eligible=reminders.filter(x=>x.user_id&&x.user_id!==state.user.id);
 progressBulkEligible=eligible;
 if(!progressBulkReady){
  progressBulkReady=true;
  q("#progressBulkOpen").onclick=()=>{
   q("#progressBulkChoices").innerHTML=progressBulkEligible.map(x=>'<label><input type="checkbox" value="'+esc(x.user_id)+'" checked><span>'+esc(x.member_name||"成员")+' · 已 '+esc(x.days_since)+' 天未更新</span></label>').join("");
   q("#progressBulkStatus").textContent="将向勾选成员发送站内提醒并尝试微信推送。";
   q("#progressBulkSend").disabled=false;q("#progressBulkSend").textContent="确认发送";
   dialog.showModal();
  };
  q("#progressBulkCancel").onclick=()=>dialog.close();
  q("#progressBulkForm").onsubmit=e=>{e.preventDefault();void sendBulkReminders()};
 }
 actions.hidden=false;
 const bulkButton=q("#progressBulkOpen");if(bulkButton){bulkButton.disabled=!eligible.length;bulkButton.textContent=eligible.length?"🔔 批量提醒（"+eligible.length+"）":"暂无逾期成员";}

}
async function loadProgressOverview(){
  if(!state.user)return;
  const [statusReq,teamMemberReq,teamProgressReq,reminderReq]=await Promise.all([
    fetchProgressMemberStatusOnce(),
    supabase.from("team_progress_members").select("team_progress_id,member_id,member_name_snapshot"),
    supabase.from("team_progress_updates").select("id,competition_name,created_at"),
    fetchProgressRemindersOnce()
  ]);

  const statuses=statusReq.error?[]:(statusReq.data||[]);
  const personal=statuses.filter(x=>x.personal_updated);
  const progressByTeam=new Map((teamProgressReq.data||[]).map(x=>[x.id,x]));
  const teamMap=new Map();
  if(!teamMemberReq.error&&!teamProgressReq.error){
    (teamMemberReq.data||[]).forEach(x=>{
      const info=progressByTeam.get(x.team_progress_id);
      if(!info)return;
      const prev=teamMap.get(x.member_id);
      if(!prev||new Date(info.created_at||0)>new Date(prev.created_at||0)){
        teamMap.set(x.member_id,{
          member_id:x.member_id,
          member_name:x.member_name_snapshot||"成员",
          competition_name:info.competition_name||null,
          created_at:info.created_at||null
        });
      }
    });
  }
  const team=[...teamMap.values()];

  const pc=q("#personalUpdatedCount");if(pc)pc.textContent=String(personal.length);
  const tc=q("#teamUpdatedCount");if(tc)tc.textContent=String(team.length);
  const pn=q("#personalUpdatedNames");
  if(pn)pn.innerHTML=personal.length?personal.map(x=>'<span class="progressNameChip">'+esc(x.member_name||"成员")+'</span>').join(""):'<span class="progressNoSubmitter">暂时还没有个人进度更新</span>';
  const tn=q("#teamUpdatedNames");
  if(tn)tn.innerHTML=team.length?team.map(x=>'<span class="progressNameChip">'+esc(x.member_name||"成员")+(x.competition_name?' · '+esc(x.competition_name):'')+'</span>').join(""):'<span class="progressNoSubmitter">暂时还没有队伍进度更新</span>';

  const reminders=reminderReq.error?[]:(reminderReq.data||[]);
  const permission=await supabase.from("profiles").select("role,progress_exempt").eq("id",state.user.id).maybeSingle();
  const authorized=!permission.error&&(permission.data?.role==="super_admin"||permission.data?.progress_exempt===true);
  if(authorized)setupProgressBulkReminder(reminders);
  else if(q("#progressBulkActions")){q("#progressBulkActions").hidden=true;}
  if(reminderReq.error&&authorized){const b=q("#progressBulkOpen");if(b){b.disabled=true;b.textContent="成员名单加载失败，请刷新重试";}}

  const rc=q("#progressReminderCount");if(rc)rc.textContent=String(reminders.length);
  const rb=q("#progressReminderList");
  if(rb){
    if(reminderReq.error){
      showModuleRetry(rb,"提醒区加载失败："+reminderReq.error.message,"progress-overview",()=>loadProgressOverview());
    }else rb.innerHTML=reminders.length?reminders.map(x=>'<article class="progressReminderItem"><div><b>'+esc(x.member_name||"成员")+'</b>'+(x.member_major?'<span>'+esc(x.member_major)+'</span>':'')+'</div><div class="progressReminderMeta">'+(x.last_progress_at?'最近进度：'+fmt(x.last_progress_at):'尚未提交过进度')+' · 已 '+esc(x.days_since)+' 天</div></article>').join(""):'<div class="progressReminderOk">当前没有超过两周未更新的成员。</div>';
  }
}
async function loadProgressPage(){
  if(!state.user)return;
  await Promise.all([
    loadPersonalProgressFeed(),
    loadProgressOverview(),
    loadTeamProgressFeed()
  ]);
  applyProgressFeedSearch();
}

function projectTypeName(t){
  return ({competition:"竞赛项目",simulation_paper:"仿真 / 论文",research:"科研项目",patent:"专利项目",design:"机械设计 / 制作",course:"课程设计",other:"其他项目"})[t]||"其他项目";
}
function projectStatusName(s){
  return ({active:"进行中",paused:"暂停",completed:"已完成",archived:"已归档"})[s]||"进行中";
}
let __projectDirectoryCache=[];
async function fetchProjectDirectory(force=false){
  if(!force&&__projectDirectoryCache.length)return __projectDirectoryCache;
  return singleFlight(authScopedKey("rpc:get_project_directory_v2"),async()=>{
    if(!force&&__projectDirectoryCache.length)return __projectDirectoryCache;
    const r=await supabase.rpc("get_project_directory_v2");
    if(r.error)throw r.error;
    __projectDirectoryCache=r.data||[];
    return __projectDirectoryCache;
  });
}
async function populateProgressProjectOptions(){
  if(!state.user)return;
  const rows=await fetchProjectDirectory(true);
  const mine=rows.filter(x=>(x.member_ids||[]).includes(state.user.id));
  const personal=q("#progressProject");
  const personalList=q("#progressProjectList");
  if(personal&&personalList){
    personalList.innerHTML=mine.map(x=>'<option value="'+esc(x.name)+'">'+esc(projectTypeName(x.project_type))+' · '+(x.project_mode==="team"?"团队项目":"个人项目")+'</option>').join("");
    const preselectId=new URLSearchParams(location.search).get("project");
    const hit=mine.find(x=>x.id===preselectId);
    if(hit&&!personal.value)personal.value=hit.name;
  }
  const team=q("#teamProject");
  if(team){
    const teamRows=mine.filter(x=>x.project_mode==="team");
    team.innerHTML='<option value="">不关联已有项目，按比赛 / 队伍填写</option>'+teamRows.map(x=>'<option value="'+esc(x.id)+'">'+esc(x.name)+'</option>').join("");
    team.onchange=()=>{
      const hit=teamRows.find(x=>x.id===team.value);
      const name=q("#teamCompetitionName");
      const wrap=q("#teamProjectHint");
      if(hit){
        if(name){name.value=hit.name;name.readOnly=true}
        if(wrap)wrap.textContent="已关联项目："+hit.name+"；队伍成员将自动采用项目成员名单。";
        const ids=new Set(hit.member_ids||[]);
        teamMemberSelection.clear();
        ids.forEach(id=>teamMemberSelection.add(id));
        document.querySelectorAll(".teamMemberCheck").forEach(cb=>cb.checked=teamMemberSelection.has(cb.value));
        const selected=q("#teamMemberSelectedCount");if(selected)selected.textContent="已选 "+teamMemberSelection.size+" 人";
        const preview=q("#teamSelectedPreview");
        if(preview){
          const members=[...teamMemberSelection].map(id=>teamMemberDirectory.get(id)).filter(Boolean);
          preview.innerHTML=members.length?members.map(m=>'<span class="teamSelectedChip">'+esc(m.full_name||"成员")+'</span>').join(""):'<span class="profileHint">项目成员由项目管理页维护</span>';
        }
        const leader=q("#teamLeader");
        if(leader){
          const members=[...teamMemberSelection].map(id=>teamMemberDirectory.get(id)).filter(Boolean);
          leader.innerHTML='<option value="">请选择负责人</option>'+members.map(m=>'<option value="'+esc(m.id)+'">'+esc(m.full_name||"成员")+(m.major?' · '+esc(m.major):'')+'</option>').join("");
          if(hit.leader_id&&teamMemberSelection.has(hit.leader_id))leader.value=hit.leader_id;
        }
        const hint=q("#teamLeaderHint");
        if(hint)hint.textContent="当前项目负责人："+(hit.leader_name||"未设置")+"；如需调整可在本次提交时重新选择。";
      }else{
        if(name){name.readOnly=false}
        if(wrap)wrap.textContent="可关联已有团队项目；也可以直接填写新的比赛 / 队伍进度。";
        const hint=q("#teamLeaderHint");
        if(hint)hint.textContent="负责人必须从已选队伍成员中选择；提交后会同步到项目负责人。";
      }
    };
  }
}
async function refreshProjectProgressCounts(){
  if(page!=="projects"||!state.user)return;
  try{
    const rows=await fetchProjectDirectory(true);
    rows.forEach(x=>{
      const personal=q('.projectProgressBtn[data-id="'+CSS.escape(x.id)+'"][data-kind="personal"] b');
      const team=q('.projectProgressBtn[data-id="'+CSS.escape(x.id)+'"][data-kind="team"] b');
      if(personal)personal.textContent=String(x.personal_progress_count||0)+" 条";
      if(team)team.textContent=String(x.team_progress_count||0)+" 条";
    });
  }catch(err){
    console.warn("项目进度计数刷新失败",err);
  }
}
async function initProjects(){
  const gate=q("#projectGate"),content=q("#projectContent");
  if(state.user&&membershipStatus()==="freshman"&&!isAdmin()){
    if(content)content.classList.add("hidden");
    if(gate)gate.innerHTML='<div class="notice"><b>项目管理仅对正式成员开放。</b><br>转为正式成员后即可创建或加入项目。</div>';
    return;
  }
  if(!state.user){
    if(content)content.classList.add("hidden");
    if(gate)gate.innerHTML='<div class="notice">登录后可以查看和管理实验室项目。 <button class="btn sec" id="projectLoginBtn" type="button">登录</button></div>';
    q("#projectLoginBtn")&&(q("#projectLoginBtn").onclick=()=>q("#authOpen").click());
    return;
  }
  if(gate)gate.innerHTML="";
  if(content)content.classList.remove("hidden");

  let projects,membersReq;
  try{
    [projects,membersReq]=await Promise.all([
      fetchProjectDirectory(true),
      fetchFormalMemberDirectoryOnce()
    ]);
  }catch(err){
    const box=q("#projectGrid");
    if(box)showModuleRetry(box,"项目加载失败："+(err?.message||String(err)),"projects",()=>initProjects());
    return;
  }
  const memberRows=membersReq.error?[]:(membersReq.data||[]);
  const memberMap=new Map(memberRows.map(x=>[x.id,x]));
  const canManage=x=>isAdmin()||x.leader_id===state.user.id;

  const renderProjects=()=>{
    const box=q("#projectGrid");
    if(!box)return;
    const searchInput=q("#projectDirectorySearch");
    const meta=q("#projectSearchMeta");
    const keyword=(searchInput?.value||"").trim().toLowerCase();
    const visibleProjects=projects.filter(x=>{
      if(!keyword)return true;
      const haystack=[
        x.name,x.leader_name,x.description,x.stage,
        ...(x.member_names||[]),
        ...(x.pending_member_names||[])
      ].filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(keyword);
    });
    if(meta){
      meta.textContent=keyword
        ?"找到 "+visibleProjects.length+" 个项目"
        :"可搜索项目、负责人、已注册成员和未注册成员";
    }
    box.innerHTML=visibleProjects.length?visibleProjects.map(x=>{
      const statusClass=x.status==="completed"?"completed":x.status==="paused"?"paused":x.status==="archived"?"archived":"";
      const members=(x.member_names||[]);
      const pending=(x.pending_member_names||[]);
      const joined=(x.member_ids||[]).includes(state.user.id);
      const canJoin=x.project_mode==="team"&&!joined&&!["completed","archived"].includes(x.status);
      return '<article class="projectCardV2"><div class="projectTopV2"><div><span class="statusTag '+statusClass+'">'+esc(projectStatusName(x.status))+'</span><h3>'+esc(x.name)+'</h3><div class="projectMeta">'+esc(projectTypeName(x.project_type))+' · '+(x.project_mode==="personal"?"个人项目":"团队项目")+' · 负责人：'+esc(x.leader_name||"成员")+'</div></div></div>'+
      (x.description?'<p class="projectDesc">'+esc(x.description)+'</p>':'')+
      '<div class="projectMembersV2">'+members.map(n=>'<span class="projectChip">'+esc(n)+'</span>').join("")+pending.map(n=>'<span class="projectChip pending">'+esc(n)+' · 未注册</span>').join("")+'</div>'+
      '<div class="projectStats"><div class="projectStat"><span>当前阶段</span><b>'+esc(x.stage||"未填写")+'</b></div><button class="projectStat projectProgressBtn" type="button" data-id="'+esc(x.id)+'" data-kind="personal"><span>个人进度</span><b>'+esc(x.personal_progress_count||0)+' 条</b></button><button class="projectStat projectProgressBtn" type="button" data-id="'+esc(x.id)+'" data-kind="team"><span>队伍进度</span><b>'+esc(x.team_progress_count||0)+' 条</b></button></div>'+
      '<div class="actions"><a class="btn sec" href="./progress.html?project='+encodeURIComponent(x.id)+'">更新进度</a><a class="btn ghost" href="./member.html?id='+encodeURIComponent(x.leader_id||state.user.id)+'">负责人主页</a>'+(canJoin?'<button class="btn pri joinProject" data-id="'+esc(x.id)+'">加入项目</button>':'')+(canManage(x)?'<button class="btn ghost editProject" data-id="'+esc(x.id)+'">编辑</button><button class="btn danger deleteProject" data-id="'+esc(x.id)+'">删除</button>':'')+'</div></article>';
    }).join(""):(keyword?'<div class="empty">没有找到匹配“'+esc(searchInput?.value||"")+'”的项目或成员。</div>':'<div class="empty">目前还没有项目。可以新建竞赛、仿真论文、科研、专利、机械设计或课程设计项目。</div>');

    box.querySelectorAll(".projectProgressBtn").forEach(b=>b.onclick=async()=>{
      const projectId=b.dataset.id,kind=b.dataset.kind;
      const x=projects.find(v=>v.id===projectId);if(!x)return;
      const dialog=q("#projectProgressDialog"),title=q("#projectProgressTitle"),meta=q("#projectProgressMeta"),list=q("#projectProgressList");
      if(!dialog||!title||!meta||!list)return;
      title.textContent=x.name+" · "+(kind==="personal"?"个人进度":"队伍进度");
      meta.textContent=(kind==="personal"?"成员个人贡献记录":"团队整体进度记录")+" · 当前阶段："+(x.stage||"未填写");
      list.innerHTML='<div class="projectProgressEmpty">正在加载…</div>';
      dialog.showModal();
      if(kind==="personal"){
        const r=await supabase.from("progress_updates").select("id,user_id,member_name,current_progress,next_goal,created_at").eq("project_id",projectId).order("created_at",{ascending:false});
        if(r.error){list.innerHTML='<div class="projectProgressEmpty">加载失败：'+esc(r.error.message)+'</div>';return}
        const rows=r.data||[];
        list.innerHTML=rows.length?rows.map(v=>
          '<article class="projectProgressItem"><div class="projectProgressItemHead"><b>'+esc(v.member_name||"成员")+'</b><time>'+esc(fmt(v.created_at))+'</time></div>'+
          '<div class="projectProgressFields"><section><span>近期进度</span><p>'+esc(v.current_progress||"")+'</p></section><section><span>下一时期目标</span><p>'+esc(v.next_goal||"未填写")+'</p></section></div></article>'
        ).join(""):'<div class="projectProgressEmpty">这个项目暂时没有个人进度。</div>';
      }else{
        const r=await supabase.from("team_progress_updates").select("id,competition_name,team_progress,next_goal,created_at,created_by_name").eq("project_id",projectId).order("created_at",{ascending:false});
        if(r.error){list.innerHTML='<div class="projectProgressEmpty">加载失败：'+esc(r.error.message)+'</div>';return}
        const rows=r.data||[];
        list.innerHTML=rows.length?rows.map(v=>
          '<article class="projectProgressItem"><div class="projectProgressItemHead"><b>'+esc(v.created_by_name||"队伍")+'</b><time>'+esc(fmt(v.created_at))+'</time></div>'+
          '<div class="projectProgressFields"><section><span>队伍进度</span><p>'+esc(v.team_progress||"")+'</p></section><section><span>下一阶段目标</span><p>'+esc(v.next_goal||"未填写")+'</p></section></div></article>'
        ).join(""):'<div class="projectProgressEmpty">这个项目暂时没有队伍进度。</div>';
      }
    });
    if(q("#projectProgressClose"))q("#projectProgressClose").onclick=()=>q("#projectProgressDialog")?.close();
    box.querySelectorAll(".joinProject").forEach(b=>b.onclick=async()=>{
      const x=projects.find(v=>v.id===b.dataset.id);if(!x)return;
      if(!confirm("确定加入项目“"+x.name+"”吗？"))return;
      const r=await supabase.rpc("join_project",{p_project_id:x.id});
      if(r.error)return toast("加入项目失败："+r.error.message);
      __projectDirectoryCache=[];
      toast("已加入项目");
      await initProjects();
    });
    box.querySelectorAll(".editProject").forEach(b=>b.onclick=()=>openProjectDialog(projects.find(x=>x.id===b.dataset.id)||null));
    box.querySelectorAll(".deleteProject").forEach(b=>b.onclick=async()=>{
      const x=projects.find(v=>v.id===b.dataset.id);if(!x)return;
      if(!confirm("确定删除项目“"+x.name+"”吗？\n\n已有个人 / 队伍进度记录不会被删除，只会取消项目关联。"))return;
      const r=await supabase.rpc("delete_project",{p_id:x.id});
      if(r.error)return toast("删除失败："+r.error.message);
      __projectDirectoryCache=[];toast("项目已删除");await initProjects();
    });
  };

  const picker=q("#projectMemberPicker"),search=q("#projectMemberSearch");
  const pendingInput=q("#pendingMemberInput"),pendingTags=q("#pendingMemberTags");
  let pendingNames=[];
  const renderPending=()=>{
    if(!pendingTags)return;
    pendingTags.innerHTML=pendingNames.length?pendingNames.map((n,i)=>'<span class="pendingTag">'+esc(n)+' · 未注册 <button type="button" data-i="'+i+'" aria-label="移除">×</button></span>').join(""):'<span class="projectMeta">暂无未注册成员</span>';
    pendingTags.querySelectorAll("button[data-i]").forEach(b=>b.onclick=()=>{pendingNames.splice(Number(b.dataset.i),1);renderPending()});
  };
  const addPending=()=>{
    const name=(pendingInput?.value||"").trim();
    if(!name)return;
    if(pendingNames.some(x=>x.toLowerCase()===name.toLowerCase()))return toast("这个未注册成员已经添加");
    const registered=memberRows.find(m=>(m.full_name||"").trim().toLowerCase()===name.toLowerCase());
    if(registered)return toast("该成员已经注册，请直接在上方勾选");
    pendingNames.push(name);
    if(pendingInput)pendingInput.value="";
    renderPending();
  };
  if(q("#addPendingMember"))q("#addPendingMember").onclick=addPending;
  if(pendingInput)pendingInput.onkeydown=e=>{if(e.key==="Enter"){e.preventDefault();addPending()}};

  const renderPicker=(selectedIds=new Set())=>{
    if(!picker)return;
    const key=(search?.value||"").trim().toLowerCase();
    const rows=memberRows.filter(m=>!key||([m.full_name,m.major].join(" ").toLowerCase().includes(key)));
    picker.innerHTML=rows.length?rows.map(m=>'<label class="memberPick"><input type="checkbox" class="projectMemberCheck" value="'+esc(m.id)+'" '+(selectedIds.has(m.id)?'checked':'')+'><span><b>'+esc(m.full_name||"成员")+'</b> <small class="projectMeta">'+esc(m.major||"")+'</small></span></label>').join(""):'<div class="empty">没有匹配成员</div>';
  };

  let editing=null;
  const openProjectDialog=x=>{
    editing=x||null;
    q("#projectDialogTitle").textContent=x?"编辑项目":"新建项目";
    q("#projectId").value=x?.id||"";
    q("#projectName").value=x?.name||"";
    q("#projectType").value=x?.project_type||"competition";
    q("#projectMode").value=x?.project_mode||"personal";
    q("#projectStatus").value=x?.status||"active";
    q("#projectStage").value=x?.stage||"";
    q("#projectDescription").value=x?.description||"";
    const ids=new Set(x?.member_ids||[state.user.id]);
    if(!ids.size)ids.add(state.user.id);
    pendingNames=[...(x?.pending_member_names||[])];
    if(pendingInput)pendingInput.value="";
    renderPending();
    renderPicker(ids);
    const toggle=()=>{
      const isPersonal=q("#projectMode").value==="personal";
      q("#projectMembersWrap").classList.toggle("hidden",isPersonal);
      if(isPersonal){pendingNames=[];renderPending()}
    };
    q("#projectMode").onchange=toggle;toggle();
    if(search){search.value="";search.oninput=()=>renderPicker(new Set([...picker.querySelectorAll(".projectMemberCheck:checked")].map(i=>i.value)))}
    q("#projectDialog").showModal();
  };
  const projectDirectorySearch=q("#projectDirectorySearch");
  if(projectDirectorySearch)projectDirectorySearch.oninput=renderProjects;
  q("#newProjectBtn").onclick=()=>openProjectDialog(null);
  q("#projectCancel").onclick=()=>q("#projectDialog").close();
  q("#projectForm").onsubmit=async e=>{
    e.preventDefault();
    const mode=q("#projectMode").value;
    const ids=mode==="team"?[...q("#projectMemberPicker").querySelectorAll(".projectMemberCheck:checked")].map(i=>i.value):[state.user.id];
    const r=await supabase.rpc("save_project_v2",{
      p_id:q("#projectId").value||null,
      p_name:q("#projectName").value.trim(),
      p_project_type:q("#projectType").value,
      p_project_mode:mode,
      p_description:q("#projectDescription").value.trim()||null,
      p_stage:q("#projectStage").value.trim()||null,
      p_status:q("#projectStatus").value,
      p_member_ids:ids,
      p_pending_member_names:mode==="team"?pendingNames:[]
    });
    if(r.error)return toast("项目保存失败："+r.error.message);
    q("#projectDialog").close();
    __projectDirectoryCache=[];
    toast("项目已保存");
    await initProjects();
  };
  renderProjects();
}
async function chooseExistingProjectForPersonalProgress(projectName){
  const rows=await fetchProjectDirectory(true);
  const mine=rows.filter(x=>(x.member_ids||[]).includes(state.user?.id));

  const dialog=q("#personalMergeDialog");
  const list=q("#personalMergeProjectList");
  const entered=q("#personalMergeEnteredName");
  const independent=q("#personalMergeIndependent");
  const cancel=q("#personalMergeCancel");
  if(!dialog||!list||!entered||!independent||!cancel)return {mode:"independent",project:null};

  entered.textContent=projectName;
  list.innerHTML=mine.length?mine.map(x=>
    '<button class="mergeProjectOption" type="button" data-id="'+esc(x.id)+'"><b>'+esc(x.name)+'</b><small>'+
    (x.project_mode==="team"?"团队项目":"个人项目")+
    ' · 负责人：'+esc(x.leader_name||"未设置")+
    (x.stage?' · 当前阶段：'+esc(x.stage):'')+
    (x.project_mode==="team"?' · 成员：'+esc((x.member_names||[]).join("、")||"暂无"):'')+
    '</small></button>'
  ).join(""):'<div class="empty">你目前没有可合并的已有项目。本次可以按填写的项目名称建立或更新个人项目。</div>';

  return await new Promise(resolve=>{
    let settled=false;
    const finish=value=>{
      if(settled)return;
      settled=true;
      dialog.close();
      resolve(value);
    };
    list.querySelectorAll(".mergeProjectOption").forEach(btn=>{
      btn.onclick=()=>finish({mode:"existing",project:mine.find(x=>x.id===btn.dataset.id)||null});
    });
    independent.onclick=()=>finish({mode:"independent",project:null});
    cancel.onclick=()=>finish({mode:"cancel",project:null});
    dialog.oncancel=e=>{e.preventDefault();finish({mode:"cancel",project:null})};
    dialog.showModal();
  });
}
async function chooseExistingTeamProjectForTeamProgress(teamName){
  const rows=await fetchProjectDirectory(true);
  const mineTeams=rows.filter(x=>x.project_mode==="team"&&(x.member_ids||[]).includes(state.user?.id));
  if(!mineTeams.length)return {mode:"independent",project:null};

  const normalized=String(teamName||"").trim().toLowerCase();
  const exact=mineTeams.find(x=>String(x.name||"").trim().toLowerCase()===normalized);
  if(exact)return {mode:"existing",project:exact,automatic:true};

  const dialog=q("#teamMergeDialog");
  const list=q("#teamMergeProjectList");
  const entered=q("#teamMergeEnteredName");
  const independent=q("#teamMergeIndependent");
  const cancel=q("#teamMergeCancel");
  if(!dialog||!list||!entered||!independent||!cancel)return {mode:"independent",project:null};

  entered.textContent=teamName||"（未填写）";
  list.innerHTML=mineTeams.map(x=>
    '<button class="mergeProjectOption" type="button" data-id="'+esc(x.id)+'"><b>'+esc(x.name)+'</b><small>'+
    '负责人：'+esc(x.leader_name||"未设置")+
    (x.stage?' · 当前阶段：'+esc(x.stage):'')+
    ' · 成员：'+esc((x.member_names||[]).join("、")||"暂无")+
    '</small></button>'
  ).join("");

  return await new Promise(resolve=>{
    let settled=false;
    const finish=value=>{
      if(settled)return;
      settled=true;
      dialog.close();
      resolve(value);
    };
    list.querySelectorAll(".mergeProjectOption").forEach(btn=>{
      btn.onclick=()=>finish({mode:"existing",project:mineTeams.find(x=>x.id===btn.dataset.id)||null,automatic:false});
    });
    independent.onclick=()=>finish({mode:"independent",project:null});
    cancel.onclick=()=>finish({mode:"cancel",project:null});
    dialog.oncancel=e=>{e.preventDefault();finish({mode:"cancel",project:null})};
    dialog.showModal();
  });
}
async function initProgress(){
  const gate=q("#progressGate"),content=q("#progressContent");
  if(state.user&&membershipStatus()==="freshman"&&!isAdmin()){
    if(content)content.classList.add("hidden");
    if(gate)gate.innerHTML='<div class="notice"><b>近期进度仅对正式成员开放。</b><br>大一新生阶段可正常查看任务、提交作业并在“我的提交”中查看提交情况；转为正式成员后将自动开放进度查看与更新功能。</div>';
    return;
  }
  if(!state.user){
    if(gate)gate.innerHTML='<div class="notice">登录后可以查看成员近期进度并提交自己的更新。 <button class="btn sec" id="progressLoginBtn" type="button">登录</button></div>';
    if(content)content.classList.add("hidden");
    const b=q("#progressLoginBtn");if(b)b.onclick=()=>q("#authOpen").click();
    return;
  }
  if(gate)gate.innerHTML="";
  if(content)content.classList.remove("hidden");
  bindProgressFeedSearch();
  const form=q("#progressForm");
  if(form)form.onsubmit=async e=>{
    e.preventDefault();
    const current=q("#progressCurrent").value.trim(),goal=q("#progressGoal").value.trim(),rawLink=q("#progressLink").value.trim(),file=q("#progressFile").files[0];
    if(!current)return toast("请填写近期进度");
    if(!goal)return toast("请填写下一时期目标");
    const projectName=q("#progressProject")?.value.trim();
    if(!projectName)return toast("请填写项目名称");
    const link_url=rawLink?normalizeShareLink(rawLink):null;
    if(rawLink&&!link_url)return toast("链接格式不正确");

    const mergeChoice=await chooseExistingProjectForPersonalProgress(projectName);
    if(mergeChoice.mode==="cancel")return;

    const btn=e.submitter||form.querySelector("button[type=submit]"),old=btn?.textContent||"提交近期进度";
    let attachment_path=null,attachment_url=null,attachment_name=null,attachment_size=0,attachment_mime=null;
    let attachment_backend="supabase";
    try{
      if(file){
        attachment_name=file.name;attachment_size=file.size;attachment_mime=file.type||null;
        const cloudCategory="progress";
        if(cloudCategory){
          if(btn){btn.disabled=true;btn.textContent="七牛云上传中 0%"}
          const uploaded=await uploadQiniuFile(file,cloudCategory,p=>{if(btn)btn.textContent="七牛云上传中 "+p+"%"});
          attachment_path=uploaded.key;attachment_url=uploaded.url;attachment_backend="qiniu";
        }else{
          attachment_path=state.user.id+"/"+storageObjectPath("progress",file.name);
          if(btn){btn.disabled=true;btn.textContent="附件上传中 0%"}
          await uploadStorageFile("progress-files",attachment_path,file,p=>{if(btn)btn.textContent="附件上传中 "+p+"%"});
        }
      }
      if(btn){btn.disabled=true;btn.textContent="正在提交…"}
      const ins=mergeChoice.mode==="existing"&&mergeChoice.project
        ? await supabase.rpc("replace_personal_progress_v3",{
            p_current_progress:current,
            p_next_goal:goal,
            p_project_id:mergeChoice.project.id,
            p_link_url:link_url||null,
            p_attachment_path:attachment_path,
            p_attachment_name:attachment_name,
            p_attachment_size:attachment_size,
            p_attachment_mime:attachment_mime
          })
        : await supabase.rpc("replace_personal_progress_by_project_name",{
            p_project_name:projectName,
            p_current_progress:current,
            p_next_goal:goal,
            p_link_url:link_url||null,
            p_attachment_path:attachment_path,
            p_attachment_name:attachment_name,
            p_attachment_size:attachment_size,
            p_attachment_mime:attachment_mime
          });
      if(ins.error){
        if(attachment_path){
          if(attachment_backend==="qiniu")await removeQiniuObjectSafe(attachment_path);
          else await removeStorageObjectSafe("progress-files",attachment_path);
        }
        throw ins.error
      }
      const oldAttachment=Array.isArray(ins.data)?ins.data[0]?.old_attachment_path:ins.data?.old_attachment_path;
      if(oldAttachment&&oldAttachment!==attachment_path){
        const rm=isQiniuStorageKey(oldAttachment)
          ?await removeQiniuObjectSafe(oldAttachment)
          :await removeStorageObjectSafe("progress-files",oldAttachment);
        if(rm.error)console.warn("旧个人进度附件清理失败",rm.error);
      }
      const resultRow=Array.isArray(ins.data)?ins.data[0]:ins.data;
      form.reset();q("#progressFilePreview").textContent="";
      __projectDirectoryCache=[];
      if(mergeChoice.mode==="existing"&&mergeChoice.project){
        toast("个人进度已更新，并合并到"+(mergeChoice.project.project_mode==="team"?"团队项目：":"个人项目：")+mergeChoice.project.name);
      }else{
        toast(resultRow?.created_project?"个人进度已更新，并自动创建新的个人项目":resultRow?.resolved_project_mode==="team"?"个人进度已同步到同名团队项目":"个人进度已同步到个人项目");
      }
      await loadProgressPage();
    }catch(err){toast("提交失败："+(err?.message||String(err)))}
    finally{if(btn){btn.disabled=false;btn.textContent=old}}
  };
  const teamForm=q("#teamProgressForm");
  if(teamForm)teamForm.onsubmit=async e=>{
    e.preventDefault();
    const competition=q("#teamCompetitionName").value.trim();
    const teamProgress=q("#teamCurrentProgress").value.trim();
    const nextGoal=q("#teamNextGoal").value.trim();
    const rawLink=q("#teamProgressLink").value.trim();
    const file=q("#teamProgressFile")?.files?.[0]||null;
    const memberIds=[...teamMemberSelection];
    let selectedProject=q("#teamProject")?.value||null;
    const leaderId=q("#teamLeader")?.value||null;
    if(!selectedProject&&!competition)return toast("请选择项目或填写比赛 / 队伍名称");
    if(!selectedProject&&competition){
      const mergeChoice=await chooseExistingTeamProjectForTeamProgress(competition);
      if(mergeChoice.mode==="cancel")return;
      if(mergeChoice.mode==="existing"&&mergeChoice.project){
        selectedProject=mergeChoice.project.id;
      }
    }
    if(!teamProgress)return toast("请填写队伍进度");
    if(!selectedProject&&!memberIds.length)return toast("请至少选择一名队伍成员");
    if(!leaderId)return toast("请选择队伍负责人");
    if(!teamMemberSelection.has(leaderId))return toast("负责人必须是已选队伍成员");
    const link_url=rawLink?normalizeShareLink(rawLink):null;
    if(rawLink&&!link_url)return toast("链接格式不正确");
    const btn=e.submitter||teamForm.querySelector("button[type=submit]");
    const old=btn?.textContent||"提交队伍进度";
    let attachment_path=null,attachment_name=null,attachment_size=0,attachment_mime=null;
    let attachment_backend="supabase";
    try{
      if(file){
        attachment_name=file.name;attachment_size=file.size;attachment_mime=file.type||null;
        const cloudCategory="team-progress";
        if(cloudCategory){
          if(btn){btn.disabled=true;btn.textContent="七牛云上传中 0%"}
          const uploaded=await uploadQiniuFile(file,cloudCategory,p=>{if(btn)btn.textContent="七牛云上传中 "+p+"%"});
          attachment_path=uploaded.key;attachment_backend="qiniu";
        }else{
          attachment_path=state.user.id+"/"+storageObjectPath("team-progress",file.name);
          if(btn){btn.disabled=true;btn.textContent="附件上传中 0%"}
          await uploadStorageFile("progress-files",attachment_path,file,p=>{if(btn)btn.textContent="附件上传中 "+p+"%"});
        }
      }
      if(btn){btn.disabled=true;btn.textContent="正在提交…"}
      const rr=await supabase.rpc("upsert_team_progress_v4",{
        p_competition_name:competition,
        p_team_progress:teamProgress,
        p_next_goal:nextGoal||null,
        p_link_url:link_url||null,
        p_member_ids:memberIds,
        p_leader_id:leaderId,
        p_project_id:selectedProject||null,
        p_attachment_path:attachment_path,
        p_attachment_name:attachment_name,
        p_attachment_size:attachment_size,
        p_attachment_mime:attachment_mime
      });
      if(rr.error){
        if(attachment_path){
          if(attachment_backend==="qiniu")await removeQiniuObjectSafe(attachment_path);
          else await removeStorageObjectSafe("progress-files",attachment_path);
        }
        throw rr.error
      }
      const resultRow=Array.isArray(rr.data)?rr.data[0]:rr.data;
      const teamId=resultRow?.team_progress_id;
      if(file&&teamId){
        const verify=await supabase.from("team_progress_updates")
          .select("attachment_path,attachment_name,attachment_mime,attachment_size")
          .eq("id",teamId)
          .maybeSingle();
        const saved=verify.data;
        if(verify.error||!saved?.attachment_path){
          if(attachment_path){
            if(attachment_backend==="qiniu")await removeQiniuObjectSafe(attachment_path);
            else await removeStorageObjectSafe("progress-files",attachment_path);
          }
          throw new Error("队伍附件保存校验失败，请重新选择附件后再提交");
        }
      }
      const oldTeamAttachment=resultRow?.old_attachment_path;
      if(oldTeamAttachment&&oldTeamAttachment!==attachment_path){
        const rm=isQiniuStorageKey(oldTeamAttachment)
          ?await removeQiniuObjectSafe(oldTeamAttachment)
          :await removeStorageObjectSafe("progress-files",oldTeamAttachment);
        if(rm.error)console.warn("旧队伍进度附件清理失败",rm.error);
      }
      teamForm.reset();
      const teamPreview=q("#teamProgressFilePreview");if(teamPreview)teamPreview.textContent="";
      await loadTeamMemberOptions(true);
      const verifyMembers=await supabase.from("team_progress_members").select("member_id",{count:"exact",head:true});
      toast(selectedProject?"队伍进度已更新并同步到已有团队项目":"队伍进度已更新，名单正在同步");
      await loadProgressPage();
      const wantsPersonal=confirm("队伍进度已更新。\n\n你是否还有个人进度需要更新？\n没有个人进度可选择“取消”，本次到此结束。");
      if(wantsPersonal){
        window.JUSTProgressSetTab?.("personal",false);
        q("#progressCurrent")?.focus();
        q("#progressForm")?.scrollIntoView({behavior:"smooth",block:"start"});
      }
    }catch(err){toast("队伍进度提交失败："+(err?.message||String(err)))}
    finally{if(btn){btn.disabled=false;btn.textContent=old}}
  };
  await loadTeamMemberOptions(true);
  await populateProgressProjectOptions();
  const preselect=new URLSearchParams(location.search).get("project");
  if(preselect){
    const ts=q("#teamProject");
    if(ts&&[...ts.options].some(o=>o.value===preselect)){ts.value=preselect;ts.dispatchEvent(new Event("change"));}
  }
  const teamFile=q("#teamProgressFile");
  if(teamFile)teamFile.onchange=()=>{
    const f=teamFile.files[0],box=q("#teamProgressFilePreview");
    if(box)box.textContent=f?f.name+" · "+bytesText(f.size):"";
  };
  const fileInput=q("#progressFile");
  if(fileInput)fileInput.onchange=()=>{
    const f=fileInput.files[0],box=q("#progressFilePreview");
    box.textContent=f?f.name+" · "+bytesText(f.size):"";
  };
  await loadProgressPage();
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
    const requestedExam=new URLSearchParams(location.search).get("exam");
    if(requestedExam&&exams.some(x=>x.id===requestedExam))q("#examSel").value=requestedExam;
    const countCard=q("#submitCountCard"),countEl=q("#submitterCount"),countHint=q("#submitCountHint");
    const refreshSubmitterCount=async()=>{
      const examId=q("#examSel").value;
      if(!examId){
        if(countCard)countCard.classList.add("hidden");
        if(countEl)countEl.textContent="0";
        return;
      }
      if(countCard)countCard.classList.remove("hidden");
      if(countHint)countHint.textContent="正在统计…";
      const cr=await supabase.rpc("get_exam_submitter_count",{p_exam_id:examId});
      if(cr.error){
        if(countEl)countEl.textContent="—";
        if(countHint)countHint.textContent="人数统计加载失败";
        return;
      }
      if(countEl)countEl.textContent=String(cr.data??0);
      if(countHint)countHint.textContent="按成员账号去重统计；同一成员重复提交只计 1 人。";
    };
    q("#examSel").onchange=refreshSubmitterCount;
    void refreshSubmitterCount();
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
    if(!globalThis.__submitCountRealtime){
      globalThis.__submitCountRealtime=supabase.channel("submit-count-live")
        .on("postgres_changes",{event:"*",schema:"public",table:"submissions"},()=>refreshSubmitterCount())
        .subscribe();
    }
    btn.onclick=async()=>{
      const f=q("#subFile").files[0];
      const exam=q("#examSel").value;
      const submitter=q("#submitName").value.trim();
      const note=q("#note").value.trim();
      if(!exam){setStatus("请先选择对应试卷 / 任务。","error");toast("请选择试卷 / 任务");return}
      if(!submitter){setStatus("请填写姓名 / 队伍名称。","error");toast("请填写姓名 / 队伍名称");return}
      if(!f){setStatus("请先选择 ZIP / RAR / 7Z 建模压缩包。","error");toast("请选择建模压缩包");return}
      if(!/\.(zip|rar|7z)$/i.test(f.name)){setStatus("文件格式不正确，仅支持 ZIP / RAR / 7Z。","error");toast("仅支持 ZIP / RAR / 7Z");return}
      let p=null,fileUrl=null;
      const oldText=btn.textContent||"提交文件";
      try{
        btn.disabled=true;
        btn.textContent="七牛云上传中 0% · "+bytesText(f.size);
        setStatus("正在直传七牛云，请不要关闭页面…","info");
        const uploaded=await uploadQiniuFile(f,"submission",x=>{
          btn.textContent="七牛云上传中 "+x+"% · "+bytesText(f.size);
          setStatus("正在上传："+x+"%","info");
        });
        p=uploaded.key;fileUrl=uploaded.url;
        btn.textContent="正在保存提交记录…";
        setStatus("文件上传完成，正在保存提交记录…","info");
        const ins=await supabase.from("submissions").insert({
          user_id:state.user.id,
          exam_id:exam,
          submitter_name:submitter,
          note,
          file_name:f.name,
          storage_path:p,
          storage_backend:"qiniu",
          file_url:fileUrl,
          file_size:f.size,
          file_mime:f.type||null,
          status:"已提交"
        });
        if(ins.error){
          if(p)await removeQiniuObjectSafe(p);
          throw ins.error;
        }
        q("#subForm").reset();
        q("#fileText").textContent="点击选择建模压缩包";
        q("#submitName").value=state.profile?.full_name||"";
        await refreshSubmitterCount();
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
    if(gate)showModuleRetry(gate,"提交页面加载失败："+msg,"submit-init",()=>initSubmit());
    if(form)form.classList.add("hidden");
  }
}
async function initMine(){
  if(!requireLogin())return;
  const [r,e]=await Promise.all([
    supabase.from("submissions").select("*,exams(title)").eq("user_id",state.user.id).order("created_at",{ascending:false}),
    supabase.from("exams").select("id,title").order("created_at",{ascending:false})
  ]);
  if(e.error){
    const body=q("#mineBody");
    if(body)showModuleRetry(body,"任务列表加载失败："+e.error.message,"mine-exams",()=>initMine());
    return;
  }
  if(r.error){
    const body=q("#mineBody");
    if(body)showModuleRetry(body,"提交记录加载失败："+r.error.message,"mine",()=>initMine());
    return;
  }
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
    let newPath=null,newUrl=null;
    try{
      saveBtn.disabled=true;
      if(newFile){
        saveBtn.textContent="七牛云上传新文件 0%";
        const uploaded=await uploadQiniuFile(newFile,"submission",p=>{saveBtn.textContent="七牛云上传新文件 "+p+"%"});
        newPath=uploaded.key;newUrl=uploaded.url;
      }
      saveBtn.textContent="正在保存修改…";
      const payload={exam_id,submitter_name,note};
      if(newFile){
        payload.file_name=newFile.name;
        payload.storage_path=newPath;
        payload.storage_backend="qiniu";
        payload.file_url=newUrl;
        payload.file_size=newFile.size;
        payload.file_mime=newFile.type||null;
      }
      const u=await supabase.from("submissions").update(payload).eq("id",id).eq("user_id",state.user.id);
      if(u.error){if(newPath)await removeQiniuObjectSafe(newPath);throw u.error}
      if(newFile&&old.storage_path&&old.storage_path!==newPath){
        if(old.storage_backend==="qiniu")await removeQiniuObjectSafe(old.storage_path);
        else await removeStorageObjectSafe("submissions",old.storage_path);
      }
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
        const rm=x.storage_backend==="qiniu"
          ?await removeQiniuObjectSafe(x.storage_path)
          :await removeStorageObjectSafe("submissions",x.storage_path,{queueOnFail:true});
        if(rm.error)console.warn("提交记录已删除，但云端文件清理失败",rm.error);
      }
      toast("已取消提交");
      await initMine();
    }catch(err){
      console.error("取消提交失败",err);
      toast("取消失败："+(err?.message||String(err)));
    }
  });
}
function renderOwnProfileIdentity(){
  const p=state.profile||{};
  const name=p.full_name||"未填写姓名";
  const major=p.major||"未填写专业";
  const email=p.email||state.user?.email||"—";
  const membership=membershipStatus()==="freshman"?"大一新生":"正式成员";
  const avatar=(name||"?").trim().slice(0,1).toUpperCase();

  q("#profileAvatar")&&(q("#profileAvatar").textContent=avatar);
  q("#profileDisplayName")&&(q("#profileDisplayName").textContent=name);
  q("#profileDisplayMajor")&&(q("#profileDisplayMajor").textContent=major);
  q("#profileRole")&&(q("#profileRole").textContent=roleName(authzRole()));
  q("#profileMembership")&&(q("#profileMembership").textContent=membership);
  q("#profileDisplayPhone")&&(q("#profileDisplayPhone").textContent=p.phone||"未填写");
  q("#profileDisplayQQ")&&(q("#profileDisplayQQ").textContent=p.qq||"未填写");
  q("#profileEmail")&&(q("#profileEmail").textContent=email);

  const createdAt=p.created_at?new Date(p.created_at):null;
  if(createdAt&&!Number.isNaN(createdAt.getTime())){
    const days=Math.max(1,Math.floor((Date.now()-createdAt.getTime())/86400000)+1);
    q("#profileJoinDays")&&(q("#profileJoinDays").textContent=days+" 天");
    q("#profileJoinDate")&&(q("#profileJoinDate").textContent="注册于 "+createdAt.toLocaleDateString("zh-CN"));
  }else{
    q("#profileJoinDays")&&(q("#profileJoinDays").textContent="—");
    q("#profileJoinDate")&&(q("#profileJoinDate").textContent="注册时间暂无");
  }
}
async function initProfile(){
  if(!requireLogin())return;
  const home=q("#profileHome");
  if(home)home.classList.remove("hidden");
  renderOwnProfileIdentity();

  let projects=[],personal=[],teamRows=[],submissions=[];
  try{
    const [projectReq,personalReq,membershipReq,submissionReq]=await Promise.all([
      fetchProjectDirectory(true),
      supabase.from("progress_updates").select("*").eq("user_id",state.user.id).order("created_at",{ascending:false}),
      supabase.from("team_progress_members").select("team_progress_id,member_id,member_name_snapshot").eq("member_id",state.user.id),
      supabase.from("submissions").select("id,file_name,status,created_at,exam_id,exams(title)").eq("user_id",state.user.id).order("created_at",{ascending:false})
    ]);
    projects=(projectReq||[]).filter(x=>(x.member_ids||[]).includes(state.user.id));
    personal=personalReq.error?[]:(personalReq.data||[]);
    submissions=submissionReq.error?[]:(submissionReq.data||[]);
    const teamIds=[...new Set((membershipReq.error?[]:(membershipReq.data||[])).map(x=>x.team_progress_id).filter(Boolean))];
    if(teamIds.length){
      const tr=await supabase.from("team_progress_updates").select("*").in("id",teamIds).order("created_at",{ascending:false});
      if(!tr.error)teamRows=tr.data||[];
    }
  }catch(err){
    console.warn("个人主页数据加载失败",err);
    const target=q("#profileProjectList")||q("#profileHome");
    if(target)showModuleRetry(target,"个人主页数据加载失败："+(err?.message||String(err)),"profile",()=>initProfile());
    q("#profileProjectCount")&&(q("#profileProjectCount").textContent="—");
    q("#profileProgressCount")&&(q("#profileProgressCount").textContent="—");
    q("#profileSubmissionCount")&&(q("#profileSubmissionCount").textContent="—");
    return;
  }

  q("#profileProjectCount")&&(q("#profileProjectCount").textContent=String(projects.length));
  q("#profileProgressCount")&&(q("#profileProgressCount").textContent=String(personal.length+teamRows.length));
  q("#profileSubmissionCount")&&(q("#profileSubmissionCount").textContent=String(submissions.length));

  const projectList=q("#profileProjectList");
  if(projectList){
    projectList.innerHTML=projects.length?projects.map(x=>
      '<article class="myProjectItem"><div class="myProjectTop"><div><h4>'+esc(x.name||"未命名项目")+'</h4><div class="myProjectMeta">'+esc(projectTypeName(x.project_type))+' · '+(x.project_mode==="team"?"团队项目":"个人项目")+' · '+esc(x.stage||"未填写阶段")+'</div></div><span class="myStatus">'+esc(projectStatusName(x.status))+'</span></div>'+
      (x.description?'<p class="myProjectDesc">'+esc(x.description)+'</p>':'')+
      '<div class="actions"><a class="btn ghost" href="./progress.html?project='+encodeURIComponent(x.id)+'">查看 / 更新进度</a></div></article>'
    ).join(""):'<div class="emptyHome">暂时还没有参与项目。可以前往项目管理创建或加入项目。</div>';
  }

  const projectMap=new Map(projects.map(x=>[x.id,x]));
  const latestPersonal=personal[0]||null;
  const latestTeam=teamRows[0]||null;
  const latestProgress=[latestPersonal&&{kind:"personal",row:latestPersonal},latestTeam&&{kind:"team",row:latestTeam}]
    .filter(Boolean).sort((a,b)=>new Date(b.row.created_at)-new Date(a.row.created_at))[0]||null;
  const lp=q("#profileLatestProgress"),lpt=q("#profileLatestProgressTime");
  if(latestProgress){
    const row=latestProgress.row;
    if(lpt)lpt.textContent=fmt(row.created_at);
    if(lp){
      if(latestProgress.kind==="personal"){
        const proj=row.project_id?projectMap.get(row.project_id):null;
        lp.innerHTML='<article class="myLatestCard"><h4>'+(proj?esc(proj.name):'个人进度')+'</h4><div class="myProjectMeta">'+fmt(row.created_at)+'</div><div class="myLatestCols"><section><span>近期进度</span><p>'+esc(row.current_progress||"暂无内容")+'</p></section><section><span>下一时期目标</span><p>'+esc(row.next_goal||"暂无内容")+'</p></section></div></article>';
      }else{
        lp.innerHTML='<article class="myLatestCard"><h4>'+esc(row.competition_name||"队伍进度")+'</h4><div class="myProjectMeta">'+fmt(row.created_at)+'</div><div class="myLatestCols"><section><span>队伍进度</span><p>'+esc(row.team_progress||"暂无内容")+'</p></section><section><span>下一阶段目标</span><p>'+esc(row.next_goal||"暂无内容")+'</p></section></div></article>';
      }
    }
  }else{
    if(lpt)lpt.textContent="—";
    if(lp)lp.innerHTML='<div class="emptyHome">暂时还没有进度记录。</div>';
  }

  const activity=[
    ...personal.map(x=>({type:"个人进度",title:x.project_id&&projectMap.get(x.project_id)?projectMap.get(x.project_id).name:"更新了个人进度",detail:x.current_progress||"",created_at:x.created_at})),
    ...teamRows.map(x=>({type:"队伍进度",title:x.competition_name||"队伍进度",detail:x.team_progress||"",created_at:x.created_at})),
    ...submissions.map(x=>({type:"作业提交",title:x.exams?.title||"提交作业",detail:x.file_name||"",created_at:x.created_at}))
  ].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)).slice(0,8);
  const al=q("#profileActivityList");
  if(al){
    al.innerHTML=activity.length?activity.map(x=>
      '<article class="myActivityItem"><div class="myActivityTop"><div><span class="myActivityType">'+esc(x.type)+'</span><b>'+esc(x.title)+'</b></div><time class="myActivityMeta">'+fmt(x.created_at)+'</time></div>'+(x.detail?'<p>'+esc(x.detail.length>100?x.detail.slice(0,100)+"…":x.detail)+'</p>':'')+'</article>'
    ).join(""):'<div class="emptyHome">暂时还没有近期动态。</div>';
  }

  const edit=q("#profileEditDialog"),open=q("#openProfileEdit"),close=q("#closeProfileEdit");
  const fillEdit=()=>{
    q("#profileName").value=state.profile?.full_name||"";
    q("#profileMajor").value=state.profile?.major||"";
    q("#profilePhone").value=state.profile?.phone||"";
    q("#profileQQ").value=state.profile?.qq||"";
    q("#profileEditEmail").textContent=state.profile?.email||state.user.email||"—";
  };
  if(open)open.onclick=()=>{fillEdit();edit?.showModal()};
  if(close)close.onclick=()=>edit?.close();

  q("#profileForm").onsubmit=async e=>{
    e.preventDefault();
    const full_name=q("#profileName").value.trim(),major=q("#profileMajor").value.trim(),phone=q("#profilePhone").value.trim(),qq=q("#profileQQ").value.trim();
    if(!full_name||!major)return toast("姓名和专业不能为空");
    if(phone&&!/^[0-9+()\-\s]{5,30}$/.test(phone))return toast("请输入有效电话号码");
    if(qq&&!/^\d{5,20}$/.test(qq))return toast("QQ 号应为 5-20 位数字");
    const btn=e.submitter;
    const oldText=btn?.textContent||"保存个人资料";
    if(btn){btn.disabled=true;btn.textContent="正在保存…"}
    try{
      const r=await supabase.from("profiles").update({full_name,major,phone:phone||null,qq:qq||null}).eq("id",state.user.id).select("id,email,role,full_name,major,phone,qq,membership_status,created_at").single();
      if(r.error)throw r.error;
      state.profile=profileDisplayOnly(r.data);
      state.authz=profileAuthzOnly(r.data);
      const profilePayload=JSON.stringify({uid:state.user.id,profile:state.profile,savedAt:Date.now()});
      try{sessionStorage.setItem(PROFILE_CACHE_KEY,profilePayload)}catch(_e){}
      try{localStorage.setItem(PROFILE_CACHE_KEY,profilePayload)}catch(_e){}
      try{sessionStorage.setItem(AUTHZ_CACHE_KEY,JSON.stringify({uid:state.user.id,authz:state.authz,savedAt:Date.now()}))}catch(_e){}
      updateAuthUI();
      edit?.close();
      toast("个人资料已保存，并同步到管理员后台");
      await initProfile();
    }catch(err){
      toast("保存失败："+(err?.message||String(err)));
    }finally{
      if(btn){btn.disabled=false;btn.textContent=oldText}
    }
  };
}
const STORAGE_HEALTH_PLAN_BYTES=1024*1024*1024;
let __storageHealthRows=[];
function storageHealthPathDetails(paths=[]){
  const rows=Array.isArray(paths)?paths:[];
  if(!rows.length)return "—";
  const visible=rows.slice(0,20);
  return '<div class="storagePathList"><details><summary>'+rows.length+' 个路径</summary>'+visible.map(x=>'<div>'+esc(x)+'</div>').join("")+(rows.length>visible.length?'<div>…其余 '+(rows.length-visible.length)+' 个</div>':'')+'</details></div>';
}
function renderStorageHealth(rows=[]){
  __storageHealthRows=rows;
  const totals=rows.reduce((a,x)=>{
    a.objects+=Number(x.object_count||0);
    a.bytes+=Number(x.total_bytes||0);
    a.orphans+=Number(x.orphan_count||0);
    a.orphanBytes+=Number(x.orphan_bytes||0);
    a.missing+=Number(x.missing_reference_count||0);
    return a;
  },{objects:0,bytes:0,orphans:0,orphanBytes:0,missing:0});
  const used=q("#storageUsed"),objects=q("#storageObjectCount"),orphans=q("#storageOrphanCount"),orphanBytes=q("#storageOrphanBytes"),missing=q("#storageMissingCount"),bar=q("#storageUsageBar"),body=q("#storageHealthBody"),clean=q("#storageHealthClean"),updated=q("#storageHealthUpdated"),status=q("#storageHealthStatus");
  if(used)used.textContent=bytesText(totals.bytes);
  if(objects)objects.textContent=String(totals.objects);
  if(orphans)orphans.textContent=String(totals.orphans);
  if(orphanBytes)orphanBytes.textContent="可释放 "+bytesText(totals.orphanBytes);
  if(missing)missing.textContent=String(totals.missing);
  if(bar)bar.style.width=Math.min(100,Math.max(0,totals.bytes/STORAGE_HEALTH_PLAN_BYTES*100)).toFixed(1)+"%";
  if(updated)updated.textContent="扫描于 "+new Date().toLocaleString("zh-CN",{hour12:false});
  if(clean)clean.disabled=totals.orphans===0;
  if(status){
    if(totals.orphans||totals.missing)status.textContent="发现 "+totals.orphans+" 个孤立文件、"+totals.missing+" 个失效引用。";
    else status.textContent="Storage 与数据库引用目前一致。";
  }
  if(body){
    body.innerHTML=rows.map(x=>{
      const orphanN=Number(x.orphan_count||0),missingN=Number(x.missing_reference_count||0);
      const stateClass=missingN?"bad":orphanN?"warn":"ok";
      const stateText=missingN?"需检查":orphanN?"可清理":"正常";
      return '<tr><td><b>'+esc(x.bucket_name)+'</b></td><td>'+esc(x.object_count||0)+' 个<br><small>'+bytesText(Number(x.total_bytes||0))+'</small></td><td>'+esc(x.referenced_object_count||0)+'</td><td>'+esc(orphanN)+'<br><small>'+bytesText(Number(x.orphan_bytes||0))+'</small>'+storageHealthPathDetails(x.orphan_paths)+'</td><td>'+esc(missingN)+storageHealthPathDetails(x.missing_reference_paths)+'</td><td><span class="storageHealthStatus '+stateClass+'">'+stateText+'</span></td></tr>';
    }).join("")||'<tr><td colspan="6">没有可显示的数据。</td></tr>';
  }
}
async function loadStorageHealth(){
  if(page!=="admin"||!state.user||!isAdmin())return;
  const scan=q("#storageHealthScan"),clean=q("#storageHealthClean"),status=q("#storageHealthStatus");
  const old=scan?.textContent||"重新扫描";
  if(scan){scan.disabled=true;scan.textContent="扫描中…"}
  if(clean)clean.disabled=true;
  if(status)status.textContent="正在核对 Storage 对象与数据库引用…";
  try{
    const r=await supabase.rpc("get_storage_health");
    if(r.error)throw r.error;
    renderStorageHealth(r.data||[]);
  }catch(err){
    console.error("存储健康扫描失败",err);
    if(status)showModuleRetry(status,"存储健康扫描失败："+(err?.message||String(err)),"storage-health",()=>loadStorageHealth());
    const body=q("#storageHealthBody");if(body)body.innerHTML='<tr><td colspan="6">扫描失败。</td></tr>';
  }finally{
    if(scan){scan.disabled=false;scan.textContent=old}
  }
}
async function cleanStorageOrphans(){
  if(page!=="admin"||!state.user||!isAdmin())return;
  const clean=q("#storageHealthClean"),scan=q("#storageHealthScan"),status=q("#storageHealthStatus");
  if(clean)clean.disabled=true;
  if(scan)scan.disabled=true;
  try{
    if(status)status.textContent="正在重新核对孤立文件，防止删除刚被引用的对象…";
    const fresh=await supabase.rpc("get_storage_health");
    if(fresh.error)throw fresh.error;
    const rows=fresh.data||[];
    const beforeCount=rows.reduce((n,x)=>n+Number(x.orphan_count||0),0);
    const beforeBytes=rows.reduce((n,x)=>n+Number(x.orphan_bytes||0),0);
    if(!beforeCount){
      toast("当前没有孤立文件需要清理");
      renderStorageHealth(rows);
      return;
    }
    if(!confirm("确认安全清理 "+beforeCount+" 个孤立文件吗？\n\n预计释放 "+bytesText(beforeBytes)+"。\n只会删除当前扫描确认没有数据库引用的文件。"))return;

    if(status)status.textContent="正在清理孤立文件…";
    for(const row of rows){
      const paths=Array.isArray(row.orphan_paths)?row.orphan_paths:[];
      if(!paths.length)continue;
      await removeStorageObjectsSafe(row.bucket_name,paths,{queueOnFail:true});
    }

    if(status)status.textContent="正在复核实际清理结果…";
    const verify=await supabase.rpc("get_storage_health");
    if(verify.error)throw verify.error;
    const verifiedRows=verify.data||[];
    const afterCount=verifiedRows.reduce((n,x)=>n+Number(x.orphan_count||0),0);
    const afterBytes=verifiedRows.reduce((n,x)=>n+Number(x.orphan_bytes||0),0);
    const removedCount=Math.max(0,beforeCount-afterCount);
    const releasedBytes=Math.max(0,beforeBytes-afterBytes);

    renderStorageHealth(verifiedRows);

    if(afterCount===0){
      toast("清理完成：已删除 "+removedCount+" 个孤立文件，释放 "+bytesText(releasedBytes));
      if(status)status.textContent="Storage 与数据库引用目前一致。";
    }else if(removedCount>0){
      toast("已清理 "+removedCount+" 个，仍有 "+afterCount+" 个未清理");
      if(status)status.textContent="仍有 "+afterCount+" 个孤立文件未清理，请稍后重试。";
    }else{
      toast("未清理掉任何文件，请检查 Storage 权限后重试");
      if(status)status.textContent="清理请求已发送，但实际孤立文件数量没有下降。";
    }
  }catch(err){
    console.error("孤立文件清理失败",err);
    toast("清理失败："+(err?.message||String(err)));
    if(status)status.textContent="清理失败，请重新扫描后再试。";
  }finally{
    if(scan)scan.disabled=false;
    if(clean)clean.disabled=__storageHealthRows.reduce((n,x)=>n+Number(x.orphan_count||0),0)===0;
  }
}

async function loadAdminDashboard(){
  if(!state.user||!isAdmin())return;
  const r=await supabase.rpc("get_admin_dashboard_stats");
  const vals=r.data?.[0];
  const map=[["#dashFreshman","freshman_count"],["#dashFormal","formal_count"],["#dashUpdated","progress_updated_count"],["#dashOverdue","overdue_count"]];
  if(r.error||!vals){
    map.forEach(([sel])=>{const el=q(sel);if(el)el.textContent="—"});
    const target=q("#dashFreshman")?.closest?.(".stat")||q("#adminContent");
    if(target){
      const oldRetry=target.querySelector?.(".moduleRetryBox");
      if(!oldRetry){
        const box=document.createElement("div");
        box.innerHTML=moduleRetryMarkup("后台统计加载失败："+(r.error?.message||"未知错误"),"admin-dashboard");
        target.appendChild(box.firstElementChild);
      }
      registerModuleRetry("admin-dashboard",()=>loadAdminDashboard());
    }
    return;
  }
  const retryBox=q("#dashFreshman")?.closest?.(".stat")?.querySelector?.(".moduleRetryBox");
  if(retryBox)retryBox.remove();
  map.forEach(([sel,key])=>{const el=q(sel);if(el)el.textContent=String(vals[key]??0)});
}
function initExamForm(){
  const form=q("#examForm"),input=q("#examFile")||q("#pdf");
  if(!form||!input)return;
  // Keep cached copies of the old form compatible with optional attachments.
  input.required=false;
  input.removeAttribute("accept");
  const clear=q("#examFileClear"),preview=q("#examFilePreview");
  const updateAttachment=()=>{
    const file=input.files[0];
    if(clear){clear.hidden=!file;clear.classList.toggle("hidden",!file)}
    if(preview)preview.textContent=file?file.name+" · "+bytesText(file.size):"未添加附件，可直接发布文字作业。";
  };
  input.onchange=updateAttachment;
  if(clear)clear.onclick=()=>{input.value="";updateAttachment()};
  updateAttachment();
  form.onsubmit=async e=>{
    e.preventDefault();
    if(form.dataset.publishing==="true")return;
    const title=q("#examTitle").value.trim(),description=q("#examDesc").value.trim();
    const deadlineValue=q("#deadline").value,file=input.files[0];
    if(!title)return toast("请填写作业标题");
    if(deadlineValue&&Number.isNaN(new Date(deadlineValue).getTime()))return toast("请填写有效的截止时间");
    const deadline=deadlineValue?new Date(deadlineValue).toISOString():null;
    const btn=e.submitter||form.querySelector('button[type="submit"]')||form.querySelector("button");
    const oldText=btn?.textContent||"发布作业";
    let storage_path=null,file_url=null,storage_backend="supabase";
    form.dataset.publishing="true";
    if(btn)btn.disabled=true;
    try{
      if(file){
        const category="admin-exam";
        const progress=p=>{if(btn)btn.textContent="附件上传中 "+p+"% · "+bytesText(file.size)};
        progress(0);
        if(category){
          const uploaded=await uploadQiniuFile(file,category,progress);
          storage_path=uploaded.key;file_url=uploaded.url;storage_backend="qiniu";
        }else{
          storage_path=storageObjectPath("attachments",file.name);
          await uploadStorageFile("exams",storage_path,file,progress);
          file_url=supabase.storage.from("exams").getPublicUrl(storage_path).data.publicUrl;
        }
      }
      if(btn)btn.textContent="正在发布作业…";
      const ins=await supabase.from("exams").insert({
        title,description,deadline,file_url,storage_path,
        file_name:file?.name||null,storage_backend,created_by:state.user.id
      });
      if(ins.error){
        if(storage_path){
          if(storage_backend==="qiniu")await removeQiniuObjectSafe(storage_path);
          else await removeStorageObjectSafe("exams",storage_path,{queueOnFail:true});
        }
        throw ins.error;
      }
      form.reset();updateAttachment();toast("作业 / 任务发布成功");
      setTimeout(()=>location.href="./exams.html",450);
    }catch(err){
      console.error("作业发布失败",err);
      toast("作业发布失败："+(err?.message||String(err)));
    }finally{
      delete form.dataset.publishing;
      if(btn){btn.disabled=false;btn.textContent=oldText}
    }
  };
}
async function initAdmin(){
  if(!state.user||!isAdmin()){q("#adminGate").innerHTML='<div class="notice">当前账号没有管理权限。</div>';q("#adminContent").classList.add("hidden");return}
  q("#adminContent").classList.remove("hidden");
  loadAdminDashboard();
  loadStorageHealth();
  const storageScan=q("#storageHealthScan");if(storageScan)storageScan.onclick=()=>loadStorageHealth();
  const storageClean=q("#storageHealthClean");if(storageClean)storageClean.onclick=()=>cleanStorageOrphans();
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
        const up=await uploadQiniuFile(file,"admin-image",p=>{if(btn)btn.textContent="图片上传中 "+p+"%"});image_path=up.key;image_url=up.url;
      }
      if(btn){btn.disabled=true;btn.textContent="正在发布…"}
      const ins=await supabase.from("announcements").insert({title,content:content||null,level,image_url,image_path,image_name,created_by:state.user.id});
      if(ins.error){if(image_path)await removeQiniuObjectSafe(image_path);throw ins.error}
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
  loadAnnouncements(true);
  q("#resourceShareForm").onsubmit=async e=>{
    e.preventDefault();
    const title=q("#resourceShareTitle").value.trim(),content=q("#resourceShareContent").value.trim(),rawLink=q("#resourceShareLink").value.trim(),imageFile=q("#resourceShareImage").files[0],attachFile=q("#resourceShareFile").files[0];
    const link_url=rawLink?normalizeShareLink(rawLink):null;
    if(!title)return toast("请填写分享标题");
    if(rawLink&&!link_url)return toast("链接格式不正确");
    if(!content&&!link_url&&!imageFile&&!attachFile)return toast("文字、链接、图片、文件至少填写一项");
    if(imageFile&&!(imageFile.type||"").startsWith("image/")&&!/\.(png|jpe?g|webp|gif)$/i.test(imageFile.name))return toast("图片请选择 PNG、JPG、WEBP 或 GIF");
    const btn=e.submitter||q("#resourceShareForm button");
    const oldText=btn?.textContent||"发布资料分享";
    let image_path=null,image_url=null,image_name=null,file_path=null,file_url=null,file_name=null,file_size=0,file_mime=null,file_storage_backend="supabase";
    try{
      if(imageFile){
        image_path=state.user.id+"/"+storageObjectPath("shares",imageFile.name);
        image_name=imageFile.name;
        if(btn){btn.disabled=true;btn.textContent="图片上传中 0%"}
        const up=await uploadQiniuFile(imageFile,"admin-image",p=>{if(btn)btn.textContent="图片上传中 "+p+"%"});image_path=up.key;image_url=up.url;
      }
      if(attachFile){
        file_name=attachFile.name;file_size=attachFile.size;file_mime=attachFile.type||null;
        const cloudCategory="admin-share";
        if(cloudCategory){
          if(btn){btn.disabled=true;btn.textContent="七牛云上传中 0% · "+bytesText(attachFile.size)}
          const uploaded=await uploadQiniuFile(attachFile,cloudCategory,p=>{if(btn)btn.textContent="七牛云上传中 "+p+"% · "+bytesText(attachFile.size)});
          file_path=uploaded.key;file_url=uploaded.url;file_storage_backend="qiniu";
        }else{
          file_path=state.user.id+"/"+storageObjectPath("share-files",attachFile.name);
          if(btn){btn.disabled=true;btn.textContent="附件上传中 0% · "+bytesText(attachFile.size)}
          await uploadStorageFile("resource-share-files",file_path,attachFile,p=>{if(btn)btn.textContent="附件上传中 "+p+"% · "+bytesText(attachFile.size)});
          file_url=supabase.storage.from("resource-share-files").getPublicUrl(file_path).data.publicUrl;
        }
      }
      if(btn){btn.disabled=true;btn.textContent="正在发布…"}
      const ins=await supabase.from("resource_shares").insert({title,content:content||null,link_url,image_url,image_path,image_name,file_url,file_path,file_name,file_size,file_mime,file_storage_backend,created_by:state.user.id});
      if(ins.error){
        if(image_path)await removeQiniuObjectSafe(image_path);
        if(file_path){
          if(file_storage_backend==="qiniu")await removeQiniuObjectSafe(file_path);
          else await removeStorageObjectSafe("resource-share-files",file_path);
        }
        throw ins.error;
      }
      e.target.reset();q("#resourceShareImagePreview").innerHTML="";q("#resourceShareFilePreview").textContent="";toast("资料分享发布成功");
    }catch(err){toast("资料分享发布失败："+(err?.message||String(err)))}
    finally{if(btn){btn.disabled=false;btn.textContent=oldText}}
  };
  q("#resourceShareImage").onchange=()=>{
    const f=q("#resourceShareImage").files[0],box=q("#resourceShareImagePreview");
    if(!f){box.innerHTML="";return}
    const u=URL.createObjectURL(f);
    box.innerHTML='<img class="announcementImagePreviewImg" src="'+u+'" alt="资料分享图片预览"><small>'+esc(f.name)+' · '+bytesText(f.size)+'</small>';
  };
  q("#resourceShareFile").onchange=()=>{
    const f=q("#resourceShareFile").files[0],box=q("#resourceShareFilePreview");
    box.textContent=f?f.name+" · "+bytesText(f.size):"";
  };
  q("#labFileForm").onsubmit=async e=>{
    e.preventDefault();
    const title=q("#labFileTitle").value.trim(),mode=q("#labFileMode").value,description=q("#labFileDesc").value.trim();
    let category=q("#labFileCategory").value,external_url=null,file_name=null,storage_path=null,file_size=0,mime_type=null,storage_backend="supabase";
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
        file_name=f.name;file_size=f.size;mime_type=f.type||null;
        const cloudCategory="admin-resource";
        if(cloudCategory){
          if(btn){btn.disabled=true;btn.textContent="七牛云上传中 0% · "+bytesText(f.size)}
          const uploaded=await uploadQiniuFile(f,cloudCategory,p=>{if(btn)btn.textContent="七牛云上传中 "+p+"% · "+bytesText(f.size)});
          storage_path=uploaded.key;external_url=uploaded.url;storage_backend="qiniu";
        }else{
          storage_path=state.user.id+"/"+category+"/"+storageObjectPath("files",f.name);
          if(btn){btn.disabled=true;btn.textContent="上传中 0% · "+bytesText(f.size)}
          await uploadStorageFile("lab-files",storage_path,f,p=>{if(btn)btn.textContent="上传中 "+p+"% · "+bytesText(f.size)});
        }
      }
      if(btn){btn.disabled=true;btn.textContent="正在保存资料信息…"}
      const ins=await supabase.from("lab_files").insert({title,description:description||null,category,resource_mode:mode,external_url,file_name,storage_path,file_size,mime_type,storage_backend,created_by:state.user.id});
      if(ins.error){
        if(storage_path){
          if(storage_backend==="qiniu")await removeQiniuObjectSafe(storage_path);
          else await removeStorageObjectSafe("lab-files",storage_path);
        }
        throw ins.error
      }
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
  q("#workForm").onsubmit=async e=>{e.preventDefault();const title=q("#workTitle").value.trim();if(!title)return toast("请填写作品名称");let cover_url="",storage_path=null;const f=q("#workCover").files[0];const btn=e.submitter||q("#workForm button");const oldText=btn?.textContent||"发布作品";try{if(f){storage_path=storageObjectPath("covers",f.name);if(btn){btn.disabled=true;btn.textContent="封面上传中 0%"}const up=await uploadQiniuFile(f,"admin-work",p=>{if(btn)btn.textContent="封面上传中 "+p+"%"});storage_path=up.key;cover_url=up.url}if(btn){btn.disabled=true;btn.textContent="正在发布…"}const ins=await supabase.from("past_works").insert({title,year:q("#workYear").value?Number(q("#workYear").value):null,team_name:q("#workTeam").value.trim(),description:q("#workDesc").value.trim(),cover_url:cover_url||null,storage_path,detail_url:q("#workUrl").value.trim()||null,created_by:state.user.id});if(ins.error){if(storage_path)await removeQiniuObjectSafe(storage_path);throw ins.error}e.target.reset();toast("往届作品发布成功");setTimeout(()=>location.href="./works.html",450)}catch(err){console.error("作品发布失败",err);toast("作品发布失败："+(err?.message||String(err)))}finally{if(btn){btn.disabled=false;btn.textContent=oldText}}};
  initExamForm();
  q("#tutorialForm").onsubmit=async e=>{e.preventDefault();const type=q("#resourceType").value,mode=q("#resourceMode").value,title=q("#tutorialTitle").value.trim();let url=q("#resourceUrl").value.trim(),storage_path=null,file_name=null,storage_backend="supabase";if(mode==="url"){url=normalizeExternalUrl(url);if(!url)return toast("请输入正确的外部链接");if(isOwnPlatformUrl(url))return toast("你填的是本站首页/后台地址，请粘贴真正的视频或资料链接");}const btn=e.submitter||q("#tutorialForm button[type=submit]")||q("#tutorialForm button");const oldText=btn?.textContent||"发布教程";try{if(!title)return toast("请填写教程标题");if(mode==="file"){const f=q("#resourceFile").files[0];if(!f)return toast("请选择要上传的教程文件");if(type==="pdf"&&!/\.pdf$/i.test(f.name))return toast("PDF 教程请选择 .pdf 文件");if(type==="word"&&!/\.(doc|docx)$/i.test(f.name))return toast("Word 教程请选择 .doc 或 .docx 文件");if(type==="ppt"&&!/\.(ppt|pptx)$/i.test(f.name))return toast("PPT 教程请选择 .ppt 或 .pptx 文件");if(type==="archive"&&!/\.(zip|rar|7z)$/i.test(f.name))return toast("压缩包教程请选择 .zip、.rar 或 .7z 文件");if(type==="video"&&!(f.type||"").startsWith("video/")&&!/\.(mp4|webm|ogg|mov|m4v|avi|mkv)$/i.test(f.name))return toast("请选择视频文件");file_name=f.name;const cloudCategory="admin-tutorial";if(cloudCategory){if(btn){btn.disabled=true;btn.textContent="七牛云上传中 0% · "+bytesText(f.size)}const uploaded=await uploadQiniuFile(f,cloudCategory,p=>{if(btn)btn.textContent="七牛云上传中 "+p+"% · "+bytesText(f.size)});storage_path=uploaded.key;url=uploaded.url;storage_backend="qiniu";}else{storage_path=tutorialStoragePath(type,f.name);if(btn){btn.disabled=true;btn.textContent="上传中 0% · "+bytesText(f.size)}await uploadTutorialFile(storage_path,f,p=>{if(btn)btn.textContent="上传中 "+p+"% · "+bytesText(f.size)});url=supabase.storage.from("tutorials").getPublicUrl(storage_path).data.publicUrl}}if(!url)return toast("请输入资料链接或选择文件");if(btn){btn.disabled=true;btn.textContent="正在发布…"}const ins=await supabase.from("tutorials").insert({title,description:q("#tutorialDesc").value.trim(),video_url:url,resource_type:type,file_name,storage_path,storage_backend,created_by:state.user.id});if(ins.error){if(storage_path){if(storage_backend==="qiniu")await removeQiniuObjectSafe(storage_path);else await removeStorageObjectSafe("tutorials",storage_path)}throw ins.error}e.target.reset();toggleResourceForm();toast(resourceTypeName(type)+"发布成功");setTimeout(()=>location.href="./tutorials.html",450)}catch(err){const msg=err?.message||String(err);console.error("教程发布失败",err);if(/maximum|too large|payload|entity too large|exceeded/i.test(msg))toast("文件超过当前上传上限，请压缩后重试");else if(/row-level security|policy|permission|unauthorized|jwt/i.test(msg))toast("发布权限或登录状态异常，请重新登录后再试");else toast("发布失败："+msg)}finally{if(btn){btn.disabled=false;btn.textContent=oldText}}};
  function toggleResourceForm(){const type=q("#resourceType").value,mode=q("#resourceMode").value,isFile=mode==="file";q("#resourceUrlWrap").classList.toggle("hidden",isFile);q("#resourceFileWrap").classList.toggle("hidden",!isFile);q("#resourceUrlLabel").textContent=type==="video"?"视频链接":type==="pdf"?"PDF 链接":type==="word"?"Word 链接":type==="archive"?"压缩包链接":"PPT 链接";q("#resourceFileLabel").textContent=type==="video"?"视频文件":type==="pdf"?"PDF 文件":type==="word"?"Word 文件":type==="archive"?"压缩包文件":"PPT 文件";q("#resourceFile").accept=type==="video"?"video/*":type==="pdf"?".pdf,application/pdf":type==="word"?".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document":type==="archive"?".zip,.rar,.7z,application/zip,application/x-rar-compressed,application/x-7z-compressed":".ppt,.pptx,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"}q("#resourceType").onchange=toggleResourceForm;q("#resourceMode").onchange=toggleResourceForm;toggleResourceForm();
  loadAllSubmissions();
}
async function loadAllSubmissions(){
  const r=await supabase.from("submissions").select("*,exams(title),profiles(email,full_name,major)").order("created_at",{ascending:false});const data=r.data||[];
  const count=q("#adminSubmissionCount");if(count)count.textContent=String(data.length);
  q("#allBody").innerHTML=data.length?data.map(x=>'<tr><td>'+esc(x.exams?.title||"—")+'</td><td>'+esc(x.profiles?.full_name||"—")+'</td><td>'+esc(x.profiles?.major||"—")+'</td><td>'+esc(x.submitter_name||x.profiles?.email||"—")+'</td><td>'+esc(x.file_name)+'</td><td>'+fmt(x.created_at)+'</td><td><button class="btn ghost dl" data-p="'+esc(x.storage_path)+'">下载</button> <button class="btn danger delSub" data-id="'+esc(x.id)+'" data-p="'+esc(x.storage_path)+'">删除</button></td></tr>').join(""):'<tr><td colspan="7">暂无提交。</td></tr>';
  document.querySelectorAll(".dl").forEach(b=>b.onclick=async()=>{const p=b.dataset.p||"";if(isQiniuStorageKey(p))return openQiniuKey(p,b);const s=await supabase.storage.from("submissions").createSignedUrl(p,120);if(s.error)return toast(s.error.message);window.open(s.data.signedUrl,"_blank")});
  document.querySelectorAll(".delSub").forEach(b=>b.onclick=async()=>{
    if(!confirm("确定删除这条提交吗？"))return;
    const d=await supabase.from("submissions").delete().eq("id",b.dataset.id);
    if(d.error)return toast(d.error.message);
    let cleanupError=null;
    if(b.dataset.p){
      const rm=isQiniuStorageKey(b.dataset.p)?await removeQiniuObjectSafe(b.dataset.p):await removeStorageObjectSafe("submissions",b.dataset.p,{queueOnFail:true});
      cleanupError=rm.error||null;
    }
    toast(cleanupError?"提交记录已删除，文件已加入待清理队列":"提交已删除");
    await loadAllSubmissions();
  });
}
let __siteRealtimeTimer=null;
const __siteRealtimePendingTables=new Set();
let __siteRealtimeBusy=false;

async function refreshRealtimeBatch(tables){
  if(!tables.size)return;

  const has=(...names)=>names.some(name=>tables.has(name));

  // 当前账号资料只在 profiles 变化时校准一次，避免其他实时事件重复查 profiles。
  if(tables.has("profiles")&&state.user){
    await loadProfile(false);
    updateAuthUI();
    if(page==="profile")renderOwnProfileIdentity();
  }

  // 通知独立刷新，不再和页面模块刷新绑定。
  if(state.user&&has("announcements","exams","progress_updates","team_progress_updates","team_progress_members","submissions","profiles")){
    loadSiteNotifications(false);
  }

  if(page==="home"){
    const jobs=[];
    if(tables.has("announcements"))jobs.push(loadAnnouncements(false));
    if(has("profiles","projects","progress_updates","team_progress_updates","team_progress_members","submissions"))jobs.push(refreshHomeSummary());
    if(jobs.length)await Promise.all(jobs);
    return;
  }

  if(page==="works"&&tables.has("past_works"))return initWorks();
  if(page==="exams"&&tables.has("exams"))return initExams();
  if(page==="tutorials"&&tables.has("tutorials"))return initTutorials();
  if(page==="files"&&has("lab_files","resource_shares"))return initFiles();

  if(page==="progress"){
    const jobs=[];
    if(has("projects","project_members")){
      __projectDirectoryCache=[];
      jobs.push(populateProgressProjectOptions());
    }
    if(tables.has("profiles"))jobs.push(loadTeamMemberOptions(false));
    if(tables.has("progress_updates")){
      progressSignedUrlCache.clear();
      jobs.push(loadPersonalProgressFeed());
      jobs.push(loadProgressOverview());
    }
    if(has("team_progress_updates","team_progress_members")){
      progressSignedUrlCache.clear();
      jobs.push(loadTeamProgressFeed());
      jobs.push(loadProgressOverview());
    }
    if(jobs.length)await Promise.allSettled(jobs);
    applyProgressFeedSearch();
    return;
  }

  if(page==="submit"&&tables.has("exams"))return initSubmit();
  if(page==="mine"&&has("submissions","exams"))return initMine();

  if(page==="profile"){
    // 身份区在上面已经处理；下面仅刷新真正受影响的数据模块。
    if(has("projects","project_members","progress_updates","team_progress_updates","team_progress_members","submissions")){
      __projectDirectoryCache=[];
      return initProfile();
    }
    return;
  }

  if(page==="projects"){
    if(has("projects","project_members","project_pending_members","profiles")){
      __projectDirectoryCache=[];
      return initProjects();
    }
    if(has("progress_updates","team_progress_updates")){
      __projectDirectoryCache=[];
      return refreshProjectProgressCounts();
    }
    return;
  }

  if(page==="admin"){
    const jobs=[];
    if(has("profiles","progress_updates","team_progress_updates","team_progress_members"))jobs.push(loadAdminDashboard());
    if(tables.has("announcements"))jobs.push(loadAnnouncements(true));
    if(tables.has("submissions")&&typeof loadAllSubmissions==="function")jobs.push(loadAllSubmissions());
    if(jobs.length)await Promise.allSettled(jobs);
  }
}

function scheduleRealtimeRefresh(table){
  __siteRealtimePendingTables.add(table);
  clearTimeout(__siteRealtimeTimer);
  __siteRealtimeTimer=setTimeout(async()=>{
    if(__siteRealtimeBusy)return;
    __siteRealtimeBusy=true;
    const tables=new Set(__siteRealtimePendingTables);
    __siteRealtimePendingTables.clear();
    try{
      await refreshRealtimeBatch(tables);
    }catch(err){
      console.error("实时刷新失败",[...tables].join(","),err);
    }finally{
      __siteRealtimeBusy=false;
      if(__siteRealtimePendingTables.size){
        scheduleRealtimeRefresh([...__siteRealtimePendingTables][0]);
      }
    }
  },420);
}
function setupSiteRealtime(){
  if(globalThis.__siteRealtimeChannel)return;
  const notificationTables=state.user?["announcements","exams","progress_updates","team_progress_updates","team_progress_members","submissions","profiles"]:[];
  const pageTables={
    home:["announcements","profiles","projects","progress_updates","team_progress_updates","team_progress_members","submissions"],
    works:["past_works"],
    exams:["exams"],
    tutorials:["tutorials"],
    files:["lab_files","resource_shares"],
    progress:["progress_updates","team_progress_updates","team_progress_members","projects","project_members","profiles"],
    projects:["projects","project_members","project_pending_members","progress_updates","team_progress_updates","profiles"],
    submit:["exams"],
    mine:["submissions","exams"],
    profile:["profiles","projects","project_members","progress_updates","team_progress_updates","team_progress_members","submissions"],
    admin:["profiles","progress_updates","team_progress_updates","team_progress_members","announcements","submissions"]
  }[page]||[];
  const tables=[...new Set([...notificationTables,...pageTables])];
  if(!tables.length)return;
  const ch=supabase.channel("site-content-live-"+page);
  tables.forEach(table=>{
    ch.on("postgres_changes",{event:"*",schema:"public",table},()=>scheduleRealtimeRefresh(table));
  });
  globalThis.__siteRealtimeChannel=ch.subscribe();
}
async function enforceRememberLoginPolicy(){
  try{
    const remember=localStorage.getItem(REMEMBER_LOGIN_KEY);
    const sessionOnly=sessionStorage.getItem(SESSION_LOGIN_KEY);
    if(remember==="0"&&!sessionOnly)await supabase.auth.signOut({scope:"local"});
  }catch(_e){}
}

const spaceState={items:[],comments:[],reads:new Set(),likes:[],filter:"all",keyword:"",directory:new Map(),interactionsReady:false,teacherAuthorized:false,visibleCount:10,renderEpoch:0,lastRefreshAt:0,pruneTimer:null,expanded:new Set(),privateNotes:[],userId:null,syncBusy:false,lastSyncAttemptAt:0};
const SPACE_WINDOW_MS=21*24*60*60*1000;
function spaceVisibleItems(){const cutoff=Date.now()-SPACE_WINDOW_MS;return spaceState.items.filter(item=>Number.isFinite(Date.parse(item.created_at))&&Date.parse(item.created_at)>=cutoff)}
function spaceHasPendingDraft(){return [...(q("#spaceFeed")?.querySelectorAll(".spaceCommentForm textarea")||[])].some(el=>document.activeElement===el||el.value.trim().length>0)}
async function spaceRunRefresh(manual=false){
 if(!spaceAllowed()||spaceState.syncBusy)return;
 if(!manual&&spaceHasPendingDraft())return;
 spaceState.syncBusy=true;spaceState.lastSyncAttemptAt=Date.now();
 const button=q("#spaceRefresh"),status=q("#spaceSyncStatus");
 if(button){button.disabled=true;button.textContent="同步中…"}
 try{
   const ok=await spaceRefresh();
   if(manual&&status)status.textContent=ok?"已检查最新动态 · "+new Date().toLocaleTimeString("zh-CN",{hour:"2-digit",minute:"2-digit"}):"同步未完成，请检查网络后重试";
 }catch(err){
   if(status)status.textContent="同步失败，请点击刷新重试";
   console.warn("空间同步失败",err);
 }finally{
   spaceState.syncBusy=false;
   if(button){button.disabled=false;button.textContent="↻ 刷新动态"}
 }
}
function spaceSafeLink(raw){try{const url=new URL(raw,location.href);return ["https:","http:"].includes(url.protocol)?url.href:""}catch(_e){return ""}}
function spaceKey(type,id){return type+":"+id}
function spaceFind(type,id){return spaceVisibleItems().find(x=>x.type===type&&x.id===id)}
function spaceAlert(message){const e=q("#spaceMessage");if(e){e.textContent=message;e.hidden=!message}}
function spaceAllowed(){return !!state.user&&(membershipStatus()==="formal"||isAdmin())}
async function initSpace(){
 const gate=q("#spaceGate"),content=q("#spaceContent");
 if(!spaceAllowed()){if(spaceState.pruneTimer){clearInterval(spaceState.pruneTimer);spaceState.pruneTimer=null}gate.innerHTML=state.user?'<div class="notice">进度空间仅正式成员开放。</div>':'<div class="notice">登录后查看实验室进度空间。 <button id="spaceLogin" class="btn sec">登录</button></div>';content.hidden=true;q("#spaceLogin")?.addEventListener("click",()=>q("#authOpen")?.click());return}
 gate.innerHTML="";content.hidden=false;
 q("#spaceSearch").oninput=e=>{spaceState.keyword=e.target.value.trim().toLowerCase();spaceState.visibleCount=10;spaceRenderFeed()};
 q("#spaceFilter").onchange=e=>{spaceState.filter=e.target.value;spaceState.visibleCount=10;spaceRenderFeed()};
 q("#spaceInboxOpen").onclick=()=>{q("#spaceInbox").hidden=false;q("#spaceFeedSection").hidden=true;q("#spaceInboxOpen").hidden=true;q("#spaceMobileInboxOpen").hidden=true;spaceRenderInbox()};
 q("#spaceMobileInboxOpen").onclick=()=>q("#spaceInboxOpen").click();
 q("#spaceInboxClose").onclick=()=>{q("#spaceInbox").hidden=true;q("#spaceFeedSection").hidden=false;q("#spaceInboxOpen").hidden=!spaceState.interactionsReady;q("#spaceMobileInboxOpen").hidden=!spaceState.interactionsReady};
 q("#spaceRefresh").onclick=()=>void spaceRunRefresh(true);
 await spaceRunRefresh(true);
 if(!spaceState.pruneTimer){
  // Preserve in-progress comments: never replace the feed while a draft is being edited.
  spaceState.pruneTimer=setInterval(()=>{
   if(document.visibilityState!=="visible"||!spaceAllowed())return;
   const current=spaceVisibleItems();
   if(current.length!==spaceState.items.length&&!spaceHasPendingDraft()){
    spaceState.items=current;spaceRenderFeed();spaceRenderInbox();spaceRenderBanner();spaceRenderDesktop();
   }
   if(Date.now()-spaceState.lastSyncAttemptAt>=60000)void spaceRunRefresh(false);
  },30000);
  document.addEventListener("visibilitychange",()=>{
   if(document.visibilityState==="visible"&&Date.now()-spaceState.lastSyncAttemptAt>60000)void spaceRunRefresh(false);
  });
  window.addEventListener("online",()=>void spaceRunRefresh(false));
  window.addEventListener("focus",()=>{if(Date.now()-spaceState.lastSyncAttemptAt>=60000)void spaceRunRefresh(false)});
 }
 const params=new URLSearchParams(location.search);if(params.has("type")&&params.has("id"))spaceJump(params.get("type"),params.get("id"),params.get("open")==="comments",params.get("note"));
}
async function spaceRefresh(){
 // 21 days is a visibility window for the community feed only.
 // Do not remove original progress, project, or attachment records.
 const requestUserId=state.user.id;
 if(spaceState.userId!==requestUserId){
   spaceState.userId=requestUserId;
   spaceState.items=[];spaceState.comments=[];spaceState.likes=[];spaceState.privateNotes=[];
   spaceState.reads.clear();spaceState.expanded.clear();
   spaceState.teacherAuthorized=false;
   q("#spaceFeed").innerHTML='<div class="empty">正在同步当前账号的动态…</div>';
 }
 const spaceCutoff=new Date(Date.now()-SPACE_WINDOW_MS).toISOString();
 const teacherCutoff=new Date(Date.now()-15*24*60*60*1000).toISOString();
 const [a,b,m,c,l,r,dir,privateReply]=await Promise.all([
  supabase.from("progress_updates").select("id,user_id,member_name,member_major,current_progress,next_goal,link_url,attachment_path,attachment_name,attachment_mime,attachment_size,created_at,project_id").gte("created_at",spaceCutoff).order("created_at",{ascending:false}),
  supabase.from("team_progress_updates").select("id,created_by,created_by_name,competition_name,team_progress,next_goal,link_url,created_at,attachment_path,attachment_name,attachment_mime,attachment_size,project_id").gte("created_at",spaceCutoff).order("created_at",{ascending:false}),
  supabase.from("team_progress_members").select("team_progress_id,member_name_snapshot"),
  supabase.from("progress_space_comments").select("id,progress_type,progress_id,author_id,recipient_id,parent_id,content,created_at").gte("created_at",spaceCutoff).order("created_at",{ascending:true}),
  supabase.from("progress_space_likes").select("progress_type,progress_id,user_id").gte("created_at",spaceCutoff),
  supabase.from("progress_space_comment_reads").select("comment_id").eq("user_id",state.user.id),
  fetchFormalMemberDirectoryOnce(),
  supabase.from("progress_member_notices").select("id,progress_type,progress_id,sender_id,recipient_id,sender_name,message,created_at,read_at").eq("message_type","teacher_comment").not("progress_id","is",null).gte("created_at",teacherCutoff).order("created_at",{ascending:false}).limit(100)
 ]);
 if(state.user?.id!==requestUserId)return;
 if(a.error||b.error){spaceAlert("动态加载失败，请刷新后重试。");return false}
 const myTeacher=await supabase.from("profiles").select("role,progress_exempt").eq("id",state.user.id).maybeSingle();
 spaceState.teacherAuthorized=!myTeacher.error&&!!(myTeacher.data?.role==="super_admin"||myTeacher.data?.progress_exempt);
 q("#spaceTeacherBulkLink")?.toggleAttribute("hidden",!spaceState.teacherAuthorized);
 const memberMap=new Map();(m.data||[]).forEach(x=>{let ar=memberMap.get(x.team_progress_id)||[];ar.push(x.member_name_snapshot);memberMap.set(x.team_progress_id,ar)});
 spaceState.lastRefreshAt=Date.now();
 spaceState.items=[...(a.data||[]).map(x=>({...x,type:"personal",owner:x.user_id,title:x.member_name||"成员",body:x.current_progress,goal:x.next_goal})),...(b.data||[]).map(x=>({...x,type:"team",owner:x.created_by,title:x.competition_name||"队伍",body:x.team_progress,goal:x.next_goal,members:memberMap.get(x.id)||[]}))].sort((x,y)=>new Date(y.created_at)-new Date(x.created_at));
 spaceState.comments=c.error?[]:c.data||[];
 spaceState.privateNotes=privateReply.error?[]:(privateReply.data||[]).filter(x=>x.sender_id===requestUserId||x.recipient_id===requestUserId);
 spaceState.likes=l.error?[]:l.data||[];
 spaceState.reads=new Set((r.data||[]).map(x=>x.comment_id));
 spaceState.directory=new Map((dir.data||[]).map(x=>[x.id,x.full_name||"成员"]));
 spaceState.interactionsReady=!(c.error||r.error||l.error);
 if(!spaceState.interactionsReady)spaceAlert("进度空间已开放，但评论或点赞功能加载失败，请刷新重试。");
 else if(privateReply.error)spaceAlert("动态已加载，但私密教师评语暂时无法读取，请重试或检查权限。");
 else spaceAlert("");
 q("#spaceInboxOpen").hidden=!spaceState.interactionsReady||!q("#spaceInbox").hidden;
 q("#spaceMobileInboxOpen").hidden=!spaceState.interactionsReady||!q("#spaceInbox").hidden;
 spaceRenderFeed();spaceRenderInbox();spaceRenderBanner();
 return true;
}
function spaceRenderDesktop(){
 const own=spaceVisibleItems().filter(x=>x.owner===state.user?.id);
 const unread=spaceState.comments.filter(c=>c.recipient_id===state.user?.id&&c.author_id!==state.user?.id&&!spaceState.reads.has(c.id)&&spaceFind(c.progress_type,c.progress_id));
 const notes=spaceState.privateNotes.filter(n=>n.recipient_id===state.user?.id);
 const put=(id,value)=>{const e=q(id);if(e)e.textContent=String(value)};
 put("#spaceDeskMyCount",own.length);put("#spaceDeskUnreadCount",unread.length);put("#spaceDeskPrivateCount",notes.length);
 const badge=q("#spaceDeskInboxBadge");if(badge){badge.hidden=!unread.length;badge.textContent=String(unread.length)}
 const pbtn=q("#spaceDeskPrivateBtn");
 if(pbtn){
  const latest=notes.find(n=>spaceFind(n.progress_type,n.progress_id));
  pbtn.hidden=!latest;
  pbtn.onclick=()=>{if(!latest)return;q("#spaceInbox").hidden=true;q("#spaceFeedSection").hidden=false;spaceJump(latest.progress_type,latest.progress_id,false,latest.id)};
 }
 const target=q("#spaceDeskLatest");if(!target)return;
 target.innerHTML=spaceVisibleItems().slice(0,5).map(x=>'<button type="button" class="spaceSideLatestItem" data-latest-type="'+esc(x.type)+'" data-latest-id="'+esc(x.id)+'"><strong>'+esc(x.title||"阶段更新")+'</strong><small>'+esc(x.type==="team"?"团队":"个人")+' · '+esc(fmt(x.created_at))+'</small></button>').join("")||'<p class="spaceSideEmpty">最近 21 天暂无动态。</p>';
 target.querySelectorAll("[data-latest-id]").forEach(b=>b.onclick=()=>{q("#spaceInbox").hidden=true;q("#spaceFeedSection").hidden=false;spaceJump(b.dataset.latestType,b.dataset.latestId,false)});
}
function spaceRenderBanner(){
 const unread=spaceState.comments.filter(c=>c.recipient_id===state.user.id&&c.author_id!==state.user.id&&!spaceState.reads.has(c.id)&&spaceFind(c.progress_type,c.progress_id));
 const bar=q("#spaceUnreadBar");bar.hidden=!unread.length;
 q("#spaceUnreadCount").textContent=String(unread.length);
 spaceRenderDesktop();
}
function spaceRenderInbox(){
 const inbox=q("#spaceInboxList");
 const mine=spaceState.comments.filter(c=>c.recipient_id===state.user.id&&c.author_id!==state.user.id&&spaceFind(c.progress_type,c.progress_id)).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
 inbox.innerHTML=mine.length?mine.map(c=>{
  const item=spaceFind(c.progress_type,c.progress_id),unread=!spaceState.reads.has(c.id);
  return '<button class="spaceInboxItem '+(unread?'isUnread':'')+'" data-comment="'+esc(c.id)+'"><b>'+esc(spaceState.directory.get(c.author_id)||"实验室成员")+'</b><span>'+esc(c.content)+'</span><small>'+esc(item.title)+' · '+fmt(c.created_at)+'</small></button>'
 }).join(""):'<div class="empty">暂时没有收到评论。</div>';
 inbox.querySelectorAll("[data-comment]").forEach(b=>b.onclick=async()=>{
  const c=spaceState.comments.find(x=>x.id===b.dataset.comment);
  if(!c)return;
  await spaceMarkRead([c.id]);
  q("#spaceInbox").hidden=true;q("#spaceFeedSection").hidden=false;q("#spaceInboxOpen").hidden=false;
  spaceState.filter="all";q("#spaceFilter").value="all";spaceState.keyword="";q("#spaceSearch").value="";
  spaceRenderFeed();spaceJump(c.progress_type,c.progress_id,true);
 });
}
async function spaceMarkRead(ids){
 const missing=ids.filter(id=>!spaceState.reads.has(id));if(!missing.length)return;
 const {error}=await supabase.from("progress_space_comment_reads").upsert(missing.map(comment_id=>({comment_id,user_id:state.user.id})),{onConflict:"user_id,comment_id",ignoreDuplicates:true});
 if(error){spaceAlert("标记已读失败："+error.message);return}
 missing.forEach(id=>spaceState.reads.add(id));spaceRenderBanner();spaceRenderInbox();
}
function spaceJump(type,id,expand=true,noteId=null){
 let target=[...q("#spaceFeed").querySelectorAll("[data-post-id]")].find(x=>x.dataset.postId===id&&x.dataset.postType===type);
 if(!target){
  const index=spaceVisibleItems().findIndex(x=>x.id===id&&x.type===type);
  if(index>=0){
    spaceState.keyword="";spaceState.filter="all";spaceState.visibleCount=Math.max(spaceState.visibleCount,index+1);
    q("#spaceSearch").value="";q("#spaceFilter").value="all";
    spaceRenderFeed();
    target=[...q("#spaceFeed").querySelectorAll("[data-post-id]")].find(x=>x.dataset.postId===id&&x.dataset.postType===type);
  }
 }
 if(!target){
   const notice=q("#spaceMessage");
   if(notice){
     notice.textContent="该动态已超过21天展示期、已删除，或暂时不可见。原始进度仍可在进度管理页面查询。";
     const link=document.createElement("a");link.href="./progress.html";link.className="btn sec spaceExpiredLink";link.textContent="查看历史进度 →";
     notice.append(document.createTextNode(" "),link);notice.hidden=false;
   }
   return;
 }
 if(expand){spaceState.expanded.add(spaceKey(type,id));target.querySelector(".spaceComments")?.removeAttribute("hidden");spaceReadPost(type,id)}
 if(noteId){
   const own=spaceState.privateNotes.find(n=>n.id===noteId&&n.progress_type===type&&n.progress_id===id);
   if(own){
     const detail=target.querySelector(".spacePrivateFeedback");
     if(detail){detail.open=true;const note=[...detail.querySelectorAll("[data-private-note]")].find(n=>n.dataset.privateNote===noteId);note?.classList.add("spacePrivateFocused");note?.scrollIntoView({behavior:"smooth",block:"center"})}
   }
 }
 target.scrollIntoView({behavior:"smooth",block:"center"});target.classList.add("spaceFlash");setTimeout(()=>target.classList.remove("spaceFlash"),2300);
 history.replaceState(null,"","./space.html?type="+encodeURIComponent(type)+"&id="+encodeURIComponent(id)+(expand?"&open=comments":"")+(noteId?"&note="+encodeURIComponent(noteId):""));
}
async function spaceReadPost(type,id){
 const ids=spaceState.comments.filter(c=>c.progress_type===type&&c.progress_id===id&&c.recipient_id===state.user.id&&!spaceState.reads.has(c.id)).map(c=>c.id);
 await spaceMarkRead(ids);
}
function spaceTeacherEligible(){return state.user&&(authzRole()==="super_admin"||spaceState.teacherAuthorized===true)}
function spaceTeacherTargets(){
 const rows=[...spaceState.directory.entries()].map(([id,name])=>({id,name}));
 if(!rows.some(x=>x.id===state.user.id))rows.push({id:state.user.id,name:state.profile?.full_name||"我自己"});
 return rows.sort((a,b)=>a.name.localeCompare(b.name,"zh"));
}

function spaceTeacherDialog({mode,commentId=null,item=null}){
 if(!spaceTeacherEligible())return;
 const c=commentId?spaceState.comments.find(x=>x.id===commentId):null;
 const privateComment=mode==="private_comment";
 if(mode==="teacher_comment"&&(!c||c.author_id!==state.user.id)){spaceAlert("仅能转发自己发表的评论");return}
 if(privateComment&&(!item?.owner||!["personal","team"].includes(item.type))){spaceAlert("无法确定此动态的发布人");return}
 const targets=spaceTeacherTargets(), suggested=item?.owner||state.user.id;
 const dialog=document.createElement("dialog");dialog.className="spaceTeacherDialog";
 const title=privateComment?"发送私密教师评语":mode==="teacher_comment"?"转发我的公开评论":"提醒成员更新";
 const intro=privateComment?"只有发送教师和接收成员可以查看此评语，不会进入公开评论区。":mode==="teacher_comment"?"评论原文仍对实验室正式成员公开。":"成员会在站内通知铃铛中看到私密提醒。";
 const recipients=privateComment?
   '<div class="spaceTeacherRecipient">接收人：<strong>'+esc(targets.find(t=>t.id===suggested)?.name||"进度发布人")+'</strong></div>':
   '<label>选择接收成员<select name="recipient" required>'+targets.map(t=>'<option value="'+esc(t.id)+'"'+(t.id===suggested?" selected":"")+'>'+esc(t.name)+(t.id===state.user.id?"（我自己 · 测试）":"")+'</option>').join("")+'</select></label>';
 const messageField=privateComment?
   '<label>私密评语<textarea name="message" maxlength="1200" rows="5" placeholder="输入具体问题和下一步建议…" required></textarea></label>':
   mode==="reminder"?'<label>提醒内容<textarea name="message" maxlength="500" rows="3" required>请及时更新近期项目进度，并补充阶段成果和下一步计划。</textarea></label>':
   '<div class="spaceTeacherDescription">评论内容：'+esc(c?.content||"")+'</div>';
 dialog.innerHTML='<form class="spaceTeacherForm"><h3>'+title+'</h3><p class="spaceTeacherDescription">'+intro+'</p>'+recipients+messageField+
   '<p class="spaceTeacherFeedback" role="status" aria-live="polite">先保存站内通知，再尝试发送微信摘要，不在微信中泄露评语原文。</p>'+
   '<div class="spaceTeacherActions"><button type="button" class="btn sec" data-cancel>取消</button><button type="submit" class="btn pri">确认发送</button></div></form>';
 document.body.append(dialog);
 dialog.querySelector("[data-cancel]").onclick=()=>dialog.close();dialog.onclose=()=>dialog.remove();
 dialog.querySelector("form").onsubmit=async e=>{
   e.preventDefault();
   const form=e.currentTarget,submit=form.querySelector('[type="submit"]'),feedback=form.querySelector(".spaceTeacherFeedback");
   const recipient=privateComment?item.owner:form.elements.recipient?.value;
   if(!recipient||(!privateComment&&!targets.some(t=>t.id===recipient))){feedback.textContent="收件人无效";return}
   const message=privateComment||mode==="reminder"?String(form.elements.message?.value||"").trim():String(c?.content||"").trim();
   if(!message||message.length>1200){feedback.textContent="内容不能为空，且不能超过1200字";return}
   submit.disabled=true;feedback.textContent="正在保存站内通知…";
   try{
     const row={sender_id:state.user.id,recipient_id:recipient,message_type:privateComment?"teacher_comment":mode,message,
       comment_id:mode==="teacher_comment"?c.id:null,
       progress_type:item?.type==="personal"||item?.type==="team"?item.type:null,
       progress_id:item?.id||null};
     const result=await supabase.from("progress_member_notices").insert(row).select("id").single();
     if(result.error)throw result.error;
     feedback.textContent="站内通知已保存，正在尝试微信推送…";
     let accepted=false,detail="";
     try{
       const push=await supabase.functions.invoke("serverchan-dispatch",{body:{kind:"notice",notice_id:result.data.id}});
       let payload=push.data;
       if(push.error?.context?.json){try{payload=await push.error.context.json()}catch(_e){}}
       accepted=!push.error&&payload?.ok===true;
       detail=accepted?"微信接口已接受，请收件人确认收到。":"微信未确认成功："+String(payload?.message||payload?.error||push.error?.message||"接口未返回成功状态")+
         (payload?.code?"（代码："+String(payload.code).slice(0,40)+"）":"");
     }catch(pushErr){detail="微信调用异常："+String(pushErr?.message||pushErr)}
     feedback.textContent="站内通知已保存。"+detail;
     globalThis.__notifyCache=null;void loadSiteNotifications(false);
     submit.textContent="站内已保存";dialog.querySelector("[data-cancel]").textContent="关闭";
     if(accepted)setTimeout(()=>{if(dialog.open)dialog.close()},1900);
   }catch(err){feedback.textContent="站内通知保存失败："+(err?.message||String(err));submit.disabled=false}
 };
 dialog.showModal();
}
function spacePrivateFeedback(item){
 const notes=spaceState.privateNotes.filter(n=>n.progress_type===item.type&&n.progress_id===item.id);
 if(!notes.length)return "";
 const unread=notes.filter(n=>n.recipient_id===state.user.id&&!n.read_at).length;
 return '<details class="spacePrivateFeedback"><summary>🔒 私密教师评语 <strong>'+notes.length+'</strong>'+(unread?'<span class="spacePrivateUnread">'+unread+' 条未读</span>':'')+'<small>仅相关发送人与接收人可见</small></summary><div class="spacePrivateFeedbackList">'+notes.map(n=>{
   const fromMe=n.sender_id===state.user.id,person=fromMe?"我发送的评语":n.sender_name||"指导老师";
   return '<article class="spacePrivateNote" data-private-note="'+esc(n.id)+'"><div class="spacePrivateNoteMeta"><b>'+esc(person)+'</b><time>'+esc(fmt(n.created_at))+'</time></div><p>'+esc(n.message)+'</p></article>';
 }).join("")+'</div></details>';
}
function spaceCommentTree(item){
 const arr=spaceState.comments.filter(c=>c.progress_type===item.type&&c.progress_id===item.id);
 return arr.length?arr.map(c=>{
  const parent=arr.find(x=>x.id===c.parent_id);
  return '<div class="spaceComment" data-comment-id="'+esc(c.id)+'"><b>'+esc(spaceState.directory.get(c.author_id)||"成员")+'</b>'+(parent?' <small>回复 '+esc(spaceState.directory.get(parent.author_id)||"成员")+'</small>':'')+'<span>：'+esc(c.content)+'</span><button class="spaceReply" data-reply-id="'+esc(c.id)+'" type="button">回复</button>'+(spaceTeacherEligible()&&c.author_id===state.user.id?'<button class="spaceTeacherForward" data-comment-id="'+esc(c.id)+'" type="button">↗ 转发评语</button>':'')+''+(c.author_id===state.user.id||authzRole()==="super_admin"?'<button class="spaceDelete" data-delete-id="'+esc(c.id)+'" type="button">删除</button>':'')+'</div>'
 }).join(""):'<div class="spaceEmptyComments">还没有评论，来说两句吧。</div>';
}
function spaceRenderFeed(){
 const k=spaceState.keyword,items=spaceVisibleItems().filter(x=>(spaceState.filter==="all"||spaceState.filter===x.type)&&(!k||[x.title,x.body,x.goal,x.created_by_name,(x.members||[]).join(" ")].join(" ").toLowerCase().includes(k)));
 q("#spaceTotal").textContent=items.length;
 const box=q("#spaceFeed"),epoch=++spaceState.renderEpoch;
 const drafts=new Map();
 box.querySelectorAll(".spacePost").forEach(post=>{
  const form=post.querySelector(".spaceCommentForm");
  const input=form?.querySelector("textarea"),reply=form?.querySelector('[name="reply"]');
  if(input&&(input.value||reply?.value))drafts.set(spaceKey(post.dataset.postType,post.dataset.postId),{content:input.value,reply:reply?.value||""});
 });
 const visible=items.slice(0,spaceState.visibleCount);
 const more=q("#spaceMore");
 if(more){more.hidden=items.length<=visible.length;more.textContent="加载更多动态（"+visible.length+" / "+items.length+"）";more.onclick=()=>{spaceState.visibleCount+=10;spaceRenderFeed()}}
 box.innerHTML=items.length?visible.map(x=>{
  const key=spaceKey(x.type,x.id),liked=spaceState.likes.some(l=>l.progress_type===x.type&&l.progress_id===x.id&&l.user_id===state.user.id);
  const cnt=spaceState.likes.filter(l=>l.progress_type===x.type&&l.progress_id===x.id).length;
  const comments=spaceState.comments.filter(c=>c.progress_type===x.type&&c.progress_id===x.id).length;
  const avatar=(x.type==="team"?"团":String(x.title||"成").slice(0,1));
   const safeLink=spaceSafeLink(x.link_url);
  return '<article class="spacePost" data-post-type="'+esc(x.type)+'" data-post-id="'+esc(x.id)+'"><div class="spacePostHead"><div class="spaceAvatar">'+esc(avatar)+'</div><div><strong>'+esc(x.type==="team"?(x.created_by_name||"队伍成员"):x.title)+'</strong><small>'+(x.type==="team"?"团队动态 · "+esc(x.title):"个人动态")+' · '+fmt(x.created_at)+'</small></div></div><div class="spacePostBody"><p>'+esc(x.body||"")+'</p>'+(x.goal?'<div class="spaceGoal"><b>下一阶段目标</b><p>'+esc(x.goal)+'</p></div>':'')+(x.members?.length?'<small>队伍成员：'+esc(x.members.join("、"))+'</small>':'')+'</div>'+
  (safeLink?'<a class="spaceLink" href="'+esc(safeLink)+'" rel="noopener noreferrer" target="_blank">查看相关链接 ↗</a>':'')+
  spacePrivateFeedback(x)+
   (x.attachment_name?'<div class="spaceAttachment"><span class="spaceAttachmentLabel">附件：</span><span class="spaceAttachmentFilename" title="'+esc(x.attachment_name)+'">'+esc(x.attachment_name)+'</span></div><div class="spaceMedia" data-space-media="'+esc(x.type+':'+x.id)+'"></div>':'')+
  (spaceState.interactionsReady?'<div class="spacePostActions"><button class="spaceLike '+(liked?'isLiked':'')+'" type="button">♡ 赞 '+cnt+'</button><button class="spaceCommentToggle" type="button">▤ 评论 '+comments+'</button>'+(spaceTeacherEligible()?'<button class="spaceTeacherPrivate" type="button">✎ 私密评语</button><button class="spaceTeacherRemind" type="button">🔔 提醒更新</button>':'')+'</div><div class="spaceComments" hidden>':'<div class="spacePostActions"><small>互动功能配置中</small></div><div class="spaceComments" hidden>')+'<div class="spaceCommentList">'+spaceCommentTree(x)+'</div><form class="spaceCommentForm"><textarea maxlength="1000" rows="2" placeholder="写下你的想法…" required></textarea><input type="hidden" name="reply" value=""><div class="spaceReplyHint" hidden></div><button class="btn pri" type="submit">发送评论</button></form></div></article>'
 }).join(""):'<div class="empty">近21天暂无符合条件的空间动态。历史进度仍可在进度页面查看。</div>';
 box.querySelectorAll(".spacePost").forEach(card=>{
  const key=spaceKey(card.dataset.postType,card.dataset.postId);
  if(spaceState.expanded.has(key))card.querySelector(".spaceComments")?.removeAttribute("hidden");
  const draft=drafts.get(key);
  if(draft){
   const form=card.querySelector(".spaceCommentForm");
   if(form){form.querySelector("textarea").value=draft.content;form.querySelector('[name="reply"]').value=draft.reply}
   card.querySelector(".spaceComments")?.removeAttribute("hidden");
  }
});
 // Media is loaded as each visible card approaches the viewport, not on every feed render.
 const mediaTargets=new Map(visible.filter(x=>x.attachment_path).map(x=>[spaceKey(x.type,x.id),x]));
 const loadMedia=async target=>{
   const x=mediaTargets.get(target.dataset.spaceMedia);
   if(!x||target.dataset.mediaLoaded==="true")return;
   target.dataset.mediaLoaded="true";
   try{
     const markup=await progressAttachmentHtml(x);
     if(spaceState.renderEpoch!==epoch||!target.isConnected)return;
     target.innerHTML=markup;
     bindQiniuOpenButtons(target);
     bindSiteMedia(target);
   }catch(err){
     target.dataset.mediaLoaded="false";
     if(spaceState.renderEpoch===epoch&&target.isConnected)target.textContent="附件暂时无法加载";
     console.warn("空间附件加载失败",err);
   }
 };
 const mediaElements=[...box.querySelectorAll(".spaceMedia[data-space-media]")];
 if(typeof IntersectionObserver==="function"){
   const observer=new IntersectionObserver(entries=>{
     for(const entry of entries)if(entry.isIntersecting){observer.unobserve(entry.target);void loadMedia(entry.target)}
   },{rootMargin:"250px 0px",threshold:0});
   mediaElements.forEach(el=>observer.observe(el));
 }else mediaElements.forEach(el=>{void loadMedia(el)});

 box.querySelectorAll(".spacePost").forEach(article=>{
  const type=article.dataset.postType,id=article.dataset.postId,item=spaceFind(type,id);
  const privateBox=article.querySelector(".spacePrivateFeedback");
  if(privateBox)privateBox.addEventListener("toggle",async()=>{
   if(!privateBox.open||!state.user)return;
   const currentUser=state.user.id;
   const unread=spaceState.privateNotes.filter(n=>n.progress_type===type&&n.progress_id===id&&n.recipient_id===currentUser&&!n.read_at);
   if(!unread.length)return;
   const outcomes=await Promise.allSettled(unread.map(n=>supabase.rpc("mark_progress_notice_read",{p_notice_id:n.id})));
   if(state.user?.id!==currentUser)return;
   let didChange=false;
   outcomes.forEach((outcome,index)=>{
    if(outcome.status==="fulfilled"&&!outcome.value.error&&outcome.value.data===true){unread[index].read_at=new Date().toISOString();didChange=true}
   });
   if(didChange){
    const badge=privateBox.querySelector(".spacePrivateUnread");
    const remaining=unread.filter(n=>!n.read_at).length;
    if(badge){if(remaining)badge.textContent=remaining+" 条未读";else badge.remove()}
    globalThis.__notifyCache=null;void loadSiteNotifications(false);
   }
  });
  if(!spaceState.interactionsReady)return;
  article.querySelector(".spaceCommentToggle").onclick=()=>{const panel=article.querySelector(".spaceComments");panel.hidden=!panel.hidden;if(!panel.hidden){spaceState.expanded.add(spaceKey(type,id));spaceReadPost(type,id)}else spaceState.expanded.delete(spaceKey(type,id))};
  article.querySelector(".spaceLike").onclick=async e=>{
    const btn=e.currentTarget;if(btn.disabled)return;
    const liked=spaceState.likes.some(l=>l.progress_type===type&&l.progress_id===id&&l.user_id===state.user.id);
    const data={progress_type:type,progress_id:id,user_id:state.user.id};
    btn.disabled=true;
    try{
      const result=liked?await supabase.from("progress_space_likes").delete().match(data):await supabase.from("progress_space_likes").insert(data);
      if(result.error){spaceAlert("点赞失败："+result.error.message);return}
      if(liked)spaceState.likes=spaceState.likes.filter(l=>!(l.progress_type===type&&l.progress_id===id&&l.user_id===state.user.id));
      else spaceState.likes.push(data);
      btn.classList.toggle("isLiked",!liked);
      btn.textContent="♡ 赞 "+spaceState.likes.filter(l=>l.progress_type===type&&l.progress_id===id).length;
    }finally{btn.disabled=false}
  };
  article.querySelectorAll(".spaceTeacherForward").forEach(b=>b.onclick=()=>spaceTeacherDialog({mode:"teacher_comment",commentId:b.dataset.commentId,item}));
  article.querySelector(".spaceTeacherPrivate")?.addEventListener("click",()=>spaceTeacherDialog({mode:"private_comment",item}));
   article.querySelector(".spaceTeacherRemind")?.addEventListener("click",()=>spaceTeacherDialog({mode:"reminder",item}));
  article.querySelectorAll(".spaceReply").forEach(b=>b.onclick=()=>{const parent=spaceState.comments.find(c=>c.id===b.dataset.replyId);article.querySelector('[name="reply"]').value=parent.id;const hint=article.querySelector(".spaceReplyHint");hint.hidden=false;hint.textContent="正在回复 "+(spaceState.directory.get(parent.author_id)||"成员")+"（点击可取消）";hint.onclick=()=>{article.querySelector('[name="reply"]').value="";hint.hidden=true};article.querySelector("textarea").focus()});
  article.querySelectorAll(".spaceDelete").forEach(b=>b.onclick=async()=>{if(!confirm("确定删除此评论？"))return;const r=await supabase.from("progress_space_comments").delete().eq("id",b.dataset.deleteId);if(r.error)spaceAlert("删除评论失败："+r.error.message);else await spaceRefresh()});
  article.querySelector(".spaceCommentForm").onsubmit=async e=>{
   e.preventDefault();const form=e.currentTarget,textarea=form.querySelector("textarea"),content=textarea.value.trim(),parent=spaceState.comments.find(c=>c.id===form.querySelector('[name="reply"]').value);if(!content)return;
   const btn=form.querySelector('[type="submit"]');btn.disabled=true;
   const result=await supabase.from("progress_space_comments").insert({progress_type:type,progress_id:id,author_id:state.user.id,recipient_id:parent?.author_id||item.owner,parent_id:parent?.id||null,content});
   btn.disabled=false;
   if(result.error)spaceAlert("评论失败："+result.error.message);else {textarea.value="";form.querySelector('[name="reply"]').value="";spaceState.expanded.add(spaceKey(type,id));await spaceRefresh();const refreshed=[...q("#spaceFeed").querySelectorAll(".spacePost")].find(a=>a.dataset.postType===type&&a.dataset.postId===id);refreshed?.querySelector(".spaceComments")?.removeAttribute("hidden");refreshed?.scrollIntoView({block:"center"})}
  };
 });
}

async function runPage(){if(page==="home")return initHome();if(page==="works")return initWorks();if(page==="exams")return initExams();if(page==="tutorials")return initTutorials();if(page==="files")return initFiles();if(page==="progress")return initProgress();if(page==="space")return initSpace();if(page==="submit")return initSubmit();if(page==="mine")return initMine();if(page==="profile")return initProfile();if(page==="projects")return initProjects();if(page==="admin")return initAdmin()}
renderChrome();
// Older cached theme-init scripts may rerender labels on DOMContentLoaded; keep the compact icon in control.
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>applyTheme(document.documentElement.dataset.theme||preferredTheme()),{once:true});
void flushStorageCleanupQueue();
window.addEventListener("online",()=>{void flushStorageCleanupQueue()});
setStartupSplashStatus("正在恢复账号状态…");
await enforceRememberLoginPolicy();
let s={data:{session:null},error:null};
const bootstrapLoginEpoch=__manualLoginEpoch;
let bootstrapTimedOut=false;
try{
  const sessionPromise=supabase.auth.getSession();
  const timeoutPromise=new Promise(resolve=>setTimeout(()=>{
    bootstrapTimedOut=true;
    resolve({data:{session:null},error:new Error("SESSION_RESTORE_TIMEOUT")});
  },AUTH_RESTORE_TIMEOUT));
  s=await Promise.race([sessionPromise,timeoutPromise]);
  state.user=s?.data?.session?.user||null;

  if(bootstrapTimedOut){
    console.warn("登录状态恢复超过 4 秒，先进入页面并在后台继续校准");
    sessionPromise.then(late=>{
      if(__manualLoginEpoch!==bootstrapLoginEpoch||__authLoginBusy)return;
      const lateUser=late?.data?.session?.user||null;
      if((lateUser?.id||null)===(state.user?.id||null))return;
      state.user=lateUser;
      updateAuthUI();
      if(lateUser){
        loadProfile(true).then(hit=>{
          if(hit)updateAuthUI();
          return loadProfile(false);
        }).then(()=>updateAuthUI()).catch(()=>{});
      }
    }).catch(()=>{});
  }
}catch(err){
  console.warn("初始登录状态恢复失败",err);
  state.user=null;
}finally{
  finishAuthBootstrap();
}
// 会话本身来自本地存储，先立即反映“已登录”，不要等待 profiles 网络请求。
updateAuthUI();
const usedProfileCache=await loadProfile(true);
if(usedProfileCache)updateAuthUI();

const bootUserId=state.user?.id||null;
if(state.user&&(!usedProfileCache||!state.authz)){
  // 资料可长期缓存，但权限缓存缺失/过期时必须先校准权限再进入受限页面。
  setStartupSplashStatus(state.authz?"正在同步成员资料…":"正在校准成员权限…");
  await loadProfile(false);
  updateAuthUI();
}

finishStartupSplash(state.user?"账号状态已恢复":"正在进入平台…");
await runPage();
runWhenIdle(()=>loadSiteNotifications(false),1000);
runWhenIdle(()=>setupNoticePolling(),1450);
runWhenIdle(()=>setupSiteRealtime(),1800);

// 每次启动都在后台刷新成员资料和权限；资料缓存用于首屏速度，权限以服务器为准。
if(state.user){
  runWhenIdle(async()=>{await loadProfile(false);updateAuthUI()},usedProfileCache?450:1200);
}

supabase.auth.onAuthStateChange(async(event,session)=>{
  const nextUser=session?.user||null;

  // 自助改密中的旧密码再验证会更新 session；此时不要重新初始化整页。
  if(__passwordChangeReauthBusy&&["SIGNED_IN","TOKEN_REFRESHED","USER_UPDATED"].includes(event)){
    if(nextUser)state.user=nextUser;
    return;
  }

  if(__authRegisterBusy&&event==="SIGNED_IN"){
    state.user=nextUser;
    updateAuthUI();
    const passDialog=q("#passAuth");
    const passMsg=q("#passMsg");
    if(passMsg)passMsg.textContent="账号已创建，登录状态已建立";
    if(passDialog?.open)setTimeout(()=>passDialog.close(),250);
    void (async()=>{
      try{
        await loadProfile(false);
        updateAuthUI();
      }catch(err){
        console.warn("注册成功后成员资料同步失败，保留已建立会话",err);
      }
    })();
    return;
  }
  if(__authLoginBusy&&event==="SIGNED_IN"){
    state.user=nextUser;
    updateAuthUI();
    // 某些 Android WebView / 家庭宽带链路会先触发 SIGNED_IN，
    // 但 signInWithPassword Promise 的响应体迟迟不结束。事件本身已证明会话成立，
    // 因此立即关闭登录弹窗，不再让用户看到“登录中”。
    const authDialog=q("#auth");
    if(authDialog?.open){
      const authMsg=q("#authMsg");
      if(authMsg)authMsg.textContent="登录成功";
      authDialog.close();
    }
    void (async()=>{
      try{
        const usedCache=await loadProfile(true);
        if(usedCache)updateAuthUI();
        await loadProfile(false);
        updateAuthUI();
      }catch(err){
        console.warn("SIGNED_IN 后成员资料同步失败",err);
      }
    })();
    return;
  }
  if((__authLoginBusy||__authRegisterBusy)&&event==="TOKEN_REFRESHED"){
    return;
  }

  // getSession() 已完成首屏恢复，Supabase 随后的 INITIAL_SESSION 不再重复整页加载。
  if(event==="INITIAL_SESSION"&&(nextUser?.id||null)===bootUserId)return;

  // Token 自动续期不应触发整页重载。
  if(event==="TOKEN_REFRESHED"){
    state.user=nextUser;
    return;
  }

  state.user=nextUser;
  globalThis.__notifyCache=null;
  if(!state.user){
    state.profile=null;
    state.authz=null;
    __inflightRequests.clear();
    try{sessionStorage.removeItem(PROFILE_CACHE_KEY)}catch(_e){}
    try{sessionStorage.removeItem(AUTHZ_CACHE_KEY)}catch(_e){}
  }

  try{
    if(globalThis.__siteRealtimeChannel){
      await supabase.removeChannel(globalThis.__siteRealtimeChannel);
      globalThis.__siteRealtimeChannel=null;
    }
  }catch(_e){}

  // 登录后先显示会话，再用缓存补姓名/身份，最后后台校准资料。
  updateAuthUI();
  const usedCache=await loadProfile(true);
  if(usedCache)updateAuthUI();

  if(state.user&&(!usedCache||!state.authz)){
    setStartupSplashStatus(state.authz?"正在同步成员资料…":"正在校准成员权限…");
    await loadProfile(false);
    updateAuthUI();
  }

  finishStartupSplash(state.user?"账号状态已恢复":"正在进入平台…");
  await runPage();
  runWhenIdle(()=>loadSiteNotifications(false),900);
  runWhenIdle(()=>setupSiteRealtime(),1500);
  if(state.user&&usedCache)runWhenIdle(async()=>{await loadProfile(false);updateAuthUI()},450);
});
