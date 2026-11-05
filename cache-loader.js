(function(){
  "use strict";

  const script=document.currentScript;
  const base=new URL("./",script?.src||document.baseURI);
  const loadMainApp=script?.dataset.app!=="false";
  const VERSION_KEY="justLabSiteVersionV1";
  const VERSION_CHECK_KEY="justLabSiteVersionCheckedAtV1";
  const BOOTSTRAP_VERSION="2026.11.05.private-note-delete1";
  const VERSION_CHECK_INTERVAL=2*60*1000;
  let routeVersion=BOOTSTRAP_VERSION;

  function showStartupShell(){
    const header=document.querySelector("#siteHeader");
    if(!header||header.children.length)return;
    header.innerHTML='<header class="siteHeader"><div class="wrap headerInner"><a class="brand" href="./index.html">江苏科技大学 · 机械创新实验室</a><nav class="nav" aria-label="实验室网站导航"><a href="./index.html">首页</a><a href="./tutorials.html">教程</a><a href="./files.html">资料库</a><a href="./projects.html">项目管理</a><a href="./progress.html">近期进度</a><a href="./space.html">进度空间</a></nav><span role="status">正在连接平台…</span></div></header>';
  }

  function showStartupFailure(){
    let notice=document.querySelector("#labStartupFailure");
    if(!notice){
      notice=document.createElement("div");notice.id="labStartupFailure";
      notice.setAttribute("role","alert");
      notice.style.cssText="max-width:1000px;margin:16px auto;padding:16px 20px;border:1px solid #b8c9dd;border-radius:12px;background:#edf4fc;color:#173149;font:14px/1.7 system-ui,sans-serif";
      const message=document.createElement("span");
      message.textContent="平台组件连接失败，导航仍可使用。请重新加载页面；若仍失败，请将当前页面和提示发给管理员。 ";
      const retry=document.createElement("button");retry.type="button";retry.textContent="重新加载";
      retry.onclick=()=>location.reload();notice.append(message,retry);
      document.querySelector("#siteHeader")?.after(notice);
    }
    const splash=document.querySelector("#startupSplash");if(splash)splash.remove();
    document.documentElement.classList.remove("startupPending");
  }

  function validVersion(value){
    return /^[A-Za-z0-9._-]{1,64}$/.test(String(value||""));
  }

  function readLocalVersion(){
    try{
      const value=localStorage.getItem(VERSION_KEY);
      return validVersion(value)?value:null;
    }catch(_e){
      return null;
    }
  }

  function saveLocalVersion(version){
    if(!validVersion(version))return;
    try{localStorage.setItem(VERSION_KEY,version)}catch(_e){}
  }

  function withVersion(raw,version){
    try{
      const url=new URL(raw,document.baseURI);
      url.searchParams.set("v",version);
      return url.href;
    }catch(_e){
      return raw;
    }
  }

  function refreshManagedStyles(version){
    document.querySelectorAll('link[data-cache-managed][href]').forEach(link=>{
      const raw=link.getAttribute("href")||"";
      const next=withVersion(raw,version);
      if(link.href!==next)link.href=next;
    });
  }

  function isManagedInternalRoute(url){
    return url.origin===location.origin
      && url.pathname.startsWith(base.pathname)
      && (/\.html$/i.test(url.pathname)||url.pathname.endsWith("/"));
  }

  function refreshInternalRoutes(version){
    document.querySelectorAll('a[href]').forEach(anchor=>{
      const raw=anchor.getAttribute("href")||"";
      if(!raw||raw.startsWith("#")||/^(?:mailto:|tel:|javascript:)/i.test(raw))return;
      try{
        const url=new URL(raw,document.baseURI);
        if(!isManagedInternalRoute(url))return;
        url.searchParams.set("v",version);
        anchor.href=url.href;
      }catch(_e){}
    });
  }

  function prefetchVersion(version){
    const assets=[
      ...(loadMainApp?[{href:withVersion(new URL("app-v74.js",base).href,version),as:"script"}]:[]),
      ...[...document.querySelectorAll('link[data-cache-managed][href]')].map(link=>({
        href:withVersion(link.getAttribute("href"),version),
        as:"style"
      }))
    ];
    assets.forEach(asset=>{
      try{
        const link=document.createElement("link");
        link.rel="prefetch";
        link.href=asset.href;
        link.as=asset.as;
        document.head.appendChild(link);
      }catch(_e){}
    });
  }

  async function readRemoteVersion(){
    const url=new URL("site-version.json",base);
    url.searchParams.set("_",Date.now().toString(36));
    const response=await fetch(url.href,{cache:"no-store"});
    if(!response.ok)throw new Error("VERSION_HTTP_"+response.status);
    const data=await response.json();
    const version=String(data?.version||"").trim();
    if(!validVersion(version))throw new Error("VERSION_INVALID");
    return version;
  }

  function shouldCheckRemoteVersion(){
    try{
      const last=Number(localStorage.getItem(VERSION_CHECK_KEY)||0);
      return !last||Date.now()-last>=VERSION_CHECK_INTERVAL;
    }catch(_e){
      return true;
    }
  }

  async function checkRemoteVersion(currentVersion){
    if(!shouldCheckRemoteVersion())return;
    try{localStorage.setItem(VERSION_CHECK_KEY,String(Date.now()))}catch(_e){}

    try{
      const latest=await readRemoteVersion();
      saveLocalVersion(latest);
      globalThis.JUST_LATEST_VERSION=latest;

      if(latest!==currentVersion){
        routeVersion=latest;
        refreshInternalRoutes(latest);
        prefetchVersion(latest);
        try{
          window.dispatchEvent(new CustomEvent("just:version-ready",{detail:{current:currentVersion,latest}}));
        }catch(_e){}
      }
    }catch(err){
      console.warn("后台版本检查失败",err);
    }
  }

  async function loadApp(version){
    showStartupShell();
    const timer=setTimeout(()=>{if(!globalThis.JUST_CHROME_READY)showStartupFailure()},12000);
    window.addEventListener("just:chrome-ready",()=>{clearTimeout(timer);document.querySelector("#labStartupFailure")?.remove()},{once:true});
    const appUrl=new URL("app-v74.js",base);
    appUrl.searchParams.set("v",version);
    try{
      await import(appUrl.href);
    }catch(err){
      console.error("主程序加载失败",err);
      if(globalThis.JUST_CHROME_READY){showStartupFailure();return}
      const splash=document.querySelector("#startupSplashStatus");
      if(splash)splash.textContent="正在重新连接平台…";
      try{
        await import(new URL("app-v74.js",base).href);
      }catch(secondError){
        console.error("主程序备用加载失败",secondError);
        if(splash)splash.textContent="平台加载失败，请检查网络后重试";
        showStartupFailure();
      }
    }finally{
      clearTimeout(timer);
    }
  }

  async function start(){
    const version=BOOTSTRAP_VERSION;
    saveLocalVersion(version);
    routeVersion=version;

    globalThis.JUST_APP_VERSION=version;
    globalThis.JUST_CACHE_MODE=loadMainApp?"app":"standalone";
    globalThis.JUST_LATEST_VERSION=version;
    globalThis.JUSTVersionUrl=raw=>withVersion(raw,globalThis.JUST_LATEST_VERSION||version);

    // 首屏不等待远程版本检查：立即使用本地版本启动主程序。
    refreshManagedStyles(version);
    refreshInternalRoutes(version);

    // 版本检查与主程序加载并行进行，不再增加首屏网络串行等待。
    // standalone 页面只使用统一版本/路由管理，不重复加载 app-v74.js。
    const appPromise=loadMainApp?loadApp(version):Promise.resolve();
    void checkRemoteVersion(version);

    await appPromise;
    refreshInternalRoutes(routeVersion);
  }

  start();
})();

