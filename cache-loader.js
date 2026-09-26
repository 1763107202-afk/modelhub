(function(){
  "use strict";

  const script=document.currentScript;
  const base=new URL("./",script?.src||document.baseURI);
  const loadMainApp=script?.dataset.app!=="false";
  const VERSION_KEY="justLabSiteVersionV1";
  const VERSION_CHECK_KEY="justLabSiteVersionCheckedAtV1";
  const BOOTSTRAP_VERSION="2026.09.26.7";
  const VERSION_CHECK_INTERVAL=2*60*1000;
  let routeVersion=BOOTSTRAP_VERSION;

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
    const appUrl=new URL("app-v74.js",base);
    appUrl.searchParams.set("v",version);
    try{
      await import(appUrl.href);
    }catch(err){
      console.error("主程序加载失败",err);
      const splash=document.querySelector("#startupSplashStatus");
      if(splash)splash.textContent="正在重新连接平台…";
      try{
        await import(new URL("app-v74.js",base).href);
      }catch(secondError){
        console.error("主程序备用加载失败",secondError);
        if(splash)splash.textContent="平台加载失败，请检查网络后重试";
      }
    }
  }

  async function start(){
    const version=readLocalVersion()||BOOTSTRAP_VERSION;
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