(function(){
  "use strict";

  const script=document.currentScript;
  const base=new URL("./",script?.src||document.baseURI);

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
      const next=withVersion(link.getAttribute("href"),version);
      if(link.href!==next)link.href=next;
    });
  }

  function refreshInternalRoutes(version){
    document.querySelectorAll('a[href]').forEach(anchor=>{
      const raw=anchor.getAttribute("href")||"";
      if(!raw||raw.startsWith("#")||/^(?:mailto:|tel:|javascript:)/i.test(raw))return;
      try{
        const url=new URL(raw,document.baseURI);
        if(url.origin!==location.origin)return;
        if(!url.pathname.startsWith(base.pathname))return;
        if(!/\.html$/i.test(url.pathname))return;
        url.searchParams.set("v",version);
        anchor.href=url.href;
      }catch(_e){}
    });
  }

  async function readVersion(){
    const url=new URL("site-version.json",base);
    url.searchParams.set("_",Date.now().toString(36));
    const response=await fetch(url.href,{cache:"no-store"});
    if(!response.ok)throw new Error("VERSION_HTTP_"+response.status);
    const data=await response.json();
    const version=String(data?.version||"").trim();
    if(!version)throw new Error("VERSION_EMPTY");
    return version;
  }

  async function start(){
    let version="fallback";
    try{
      version=await readVersion();
    }catch(err){
      console.warn("统一缓存版本读取失败，使用兼容模式",err);
    }

    globalThis.JUST_APP_VERSION=version;
    globalThis.JUSTVersionUrl=raw=>withVersion(raw,version);

    refreshManagedStyles(version);
    refreshInternalRoutes(version);

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

    refreshInternalRoutes(version);
  }

  start();
})();