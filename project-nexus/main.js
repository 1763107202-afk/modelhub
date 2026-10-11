'use strict';
const { app,BrowserWindow,dialog,ipcMain,shell,safeStorage,desktopCapturer,screen,globalShortcut }=require('electron');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),http=require('node:http'),https=require('node:https');
const admzip=require('adm-zip');
const memory=require('./nexus-memory');
let mainWin=null, chatWin=null;
const home=()=>app.getPath('userData'),f=n=>path.join(home(),n);
function read(n,defaultValue){try{return JSON.parse(fs.readFileSync(f(n),'utf8'))}catch{return defaultValue}}
function write(n,value){fs.mkdirSync(home(),{recursive:true});const tmp=f(n)+'.tmp';fs.writeFileSync(tmp,JSON.stringify(value,null,2),'utf8');fs.renameSync(tmp,f(n));}
const uid=()=>crypto.randomUUID();
function initial(){return {projects:[],works:[],apps:[],roots:[],history:[]}}
function db(){const v=read('workspace.json',null);return v&&Array.isArray(v.projects)?{...initial(),...v}:initial()}
function save(s){write('workspace.json',s);return s}
function project(s,id){return s.projects.find(p=>p.id===id)}
function mainWindow(){
 mainWin=new BrowserWindow({width:1450,height:940,minWidth:980,minHeight:650,backgroundColor:'#0b1420',title:'PROJECT NEXUS · 个人工作站',autoHideMenuBar:true,webPreferences:{preload:path.join(__dirname,'preload.js'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
 mainWin.loadFile(path.join(__dirname,'index.html'));mainWin.once('ready-to-show',()=>mainWin?.maximize());mainWin.on('closed',()=>mainWin=null);
}
function floatWindow(){
 if(chatWin&&!chatWin.isDestroyed()){chatWin.show();chatWin.focus();return true}
 chatWin=new BrowserWindow({width:460,height:700,minWidth:380,minHeight:480,alwaysOnTop:true,autoHideMenuBar:true,title:'NEXUS AI · 悬浮助手',backgroundColor:'#0d1724',webPreferences:{preload:path.join(__dirname,'preload.js'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
 chatWin.loadFile(path.join(__dirname,'index.html'),{query:{float:'1'}});chatWin.on('closed',()=>chatWin=null);return true;
}
app.whenReady().then(()=>{mainWindow();
 globalShortcut.register('Control+Alt+N',()=>{if(!mainWin||mainWin.isDestroyed()){mainWindow();return}if(mainWin.isMinimized())mainWin.restore();mainWin.show();mainWin.focus()});
 globalShortcut.register('Control+Alt+J',()=>floatWindow());
 app.on('activate',()=>{if(!mainWin)mainWindow()});
});app.on('will-quit',()=>globalShortcut.unregisterAll());
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit()});
function local(p){if(typeof p!=='string'||!path.isAbsolute(p))throw Error('路径不合法');return p}
function ensureProject(s,id){const p=project(s,id);if(!p)throw Error('项目不存在');return p}
ipcMain.handle('load',()=>db());
ipcMain.handle('create-project',(_e,name,kind='自定义')=>{name=String(name||'').trim().slice(0,100);if(!name)throw Error('请填写项目名称');const s=db();s.projects.push({id:uid(),name,kind:String(kind).slice(0,40),links:[],tasks:[],createdAt:new Date().toISOString()});return save(s)});
ipcMain.handle('task-add',(_e,id,title)=>{const s=db(),p=ensureProject(s,id);title=String(title||'').trim().slice(0,120);if(!title)throw Error('请填写任务名称');p.tasks??=[];p.tasks.push({id:uid(),title,verified:false,weight:1});return save(s)});
ipcMain.handle('task-toggle',(_e,id,taskId)=>{const s=db(),p=ensureProject(s,id),t=(p.tasks||[]).find(v=>v.id===taskId);if(!t)throw Error('未找到任务');t.verified=!t.verified;return save(s)});
async function addLink(owner,id,type){const s=db(),p=ensureProject(s,id);const result=await dialog.showOpenDialog(BrowserWindow.fromWebContents(owner.sender),{title:type==='folder'?'选择工程文件夹':'选择主工程文件',properties:type==='folder'?['openDirectory']:['openFile','multiSelections']});if(result.canceled)return s;for(const loc of result.filePaths){if(!(p.links||[]).some(x=>x.path.toLowerCase()===loc.toLowerCase()))(p.links??=[]).push({path:loc,type,date:new Date().toISOString()})}return save(s)}
ipcMain.handle('pick-folder',(e,id)=>addLink(e,id,'folder'));
ipcMain.handle('pick-file',(e,id)=>addLink(e,id,'file'));
ipcMain.handle('set-primary-link',(_e,id,index)=>{
 const state=db(),item=ensureProject(state,id);
 const links=item.links||[];
 if(!Number.isInteger(index)||index<0||index>=links.length)throw Error('指定的工程映射不存在');
 links.forEach((link,n)=>{link.isPrimary=n===index});
 return save(state);
});
ipcMain.handle('remove-link',(_e,id,index)=>{const s=db(),p=ensureProject(s,id);if(index<0||index>=(p.links||[]).length)throw Error('无效映射');p.links.splice(index,1);return save(s)});
ipcMain.handle('open-path',async(_e,loc)=>{loc=local(loc);if(!fs.existsSync(loc))throw Error('文件不存在：'+loc);const err=await shell.openPath(loc);if(err)throw Error(err);return true});
ipcMain.handle('reveal-path',(_e,loc)=>{loc=local(loc);if(!fs.existsSync(loc))throw Error('文件不存在：'+loc);shell.showItemInFolder(loc);return true});
ipcMain.handle('open-project',async(_e,id)=>{const p=ensureProject(db(),id);const links=(p.links||[]).filter(x=>fs.existsSync(x.path));const item=links.find(x=>x.isPrimary)||links.find(x=>x.type==='file')||links[0];if(!item)throw Error('请先通过“添加文件夹”或“添加主工程”关联项目');const err=await shell.openPath(item.path);if(err)throw Error(err);return true});
ipcMain.handle('create-work',(_e,title)=>{title=String(title||'').trim().slice(0,120);if(!title)throw Error('请输入工作内容');const s=db();s.works.unshift({id:uid(),title,done:false,date:new Date().toISOString()});return save(s)});
ipcMain.handle('toggle-work',(_e,id)=>{const s=db(),w=s.works.find(x=>x.id===id);if(!w)throw Error('没有这项工作');w.done=!w.done;return save(s)});
ipcMain.handle('add-root',async e=>{const x=await dialog.showOpenDialog(BrowserWindow.fromWebContents(e.sender),{title:'授权扫描的文件夹',properties:['openDirectory']});const s=db();if(!x.canceled)for(const v of x.filePaths)if(!s.roots.includes(v))s.roots.push(v);return save(s)});
function category(name){if(/solidworks|ansys|fluent|unity|blender|keyshot|autocad|cad|arduino|keil|matlab/i.test(name))return '工程设计';if(/word|wps|excel|pdf|powerpoint|浏览器|chrome|edge|office/i.test(name))return '学习办公';if(/visual studio|vs code|github|git|dev-c|python/i.test(name))return '开发工具';return '其他'}
function stableAppId(location){return crypto.createHash('sha256').update(location.toLowerCase()).digest('hex').slice(0,24)}
function crawl(dir,limit,out,depth=0){if(depth>2||out.length>=limit||!fs.existsSync(dir))return;let items=[];try{items=fs.readdirSync(dir,{withFileTypes:true})}catch{return}for(const item of items){if(out.length>=limit)break;const loc=path.join(dir,item.name);if(item.isDirectory())crawl(loc,limit,out,depth+1);else if(/\.(lnk|exe)$/i.test(item.name)&&!/(卸载|uninstall|update|updater|helper|readme|配置|settings|license)/i.test(item.name)){out.push({id:stableAppId(loc),name:item.name.replace(/\.(lnk|exe)$/i,''),path:loc,kind:category(item.name),pinned:false})}}}
ipcMain.handle('scan-apps',()=>{const roots=[app.getPath('desktop'),path.join(process.env.APPDATA||'','Microsoft','Windows','Start Menu','Programs'),path.join(process.env.PROGRAMDATA||'','Microsoft','Windows','Start Menu','Programs')];const found=[];for(const r of roots)crawl(r,900,found);const uniq=new Map();for(const x of found){const name=x.name.trim().toLowerCase();if(!uniq.has(name))uniq.set(name,x)}const s=db(),old=new Map((s.apps||[]).map(x=>[x.path.toLowerCase(),x]));
 s.apps=[...uniq.values()].map(x=>({...x,id:old.get(x.path.toLowerCase())?.id||x.id,pinned:old.get(x.path.toLowerCase())?.pinned||false}));
 appIconCache.clear();
 return save(s)});

const appIconCache=new Map();
ipcMain.handle('app-icon',async(_e,appId)=>{
 const item=(db().apps||[]).find(x=>x.id===appId);
 if(!item||!fs.existsSync(item.path))return null;
 const cached=appIconCache.get(item.path);
 if(cached)return cached;
 let source=item.path;
 if(process.platform==='win32'&&/\.lnk$/i.test(source)){
  try{
   const target=shell.readShortcutLink(source)?.target;
   if(target&&fs.existsSync(target))source=target;
  }catch{} 
 }
 try{
  const icon=await app.getFileIcon(source,{size:'large'});
  if(!icon||icon.isEmpty())return null;
  const data=icon.toDataURL();
  if(appIconCache.size>240)appIconCache.delete(appIconCache.keys().next().value);
  appIconCache.set(item.path,data);
  return data;
 }catch{return null}
});
ipcMain.handle('pin-app',(_e,id)=>{const s=db(),a=s.apps.find(x=>x.id===id);if(!a)throw Error('软件不存在');a.pinned=!a.pinned;return save(s)});
ipcMain.handle('run-app',async(_e,id)=>{const a=db().apps.find(x=>x.id===id);if(!a)throw Error('软件不存在');if(!fs.existsSync(a.path))throw Error('快捷方式路径不存在');const err=await shell.openPath(a.path);if(err)throw Error(err);return true});
const profiles={
 'DeepSeek':{endpoint:'https://api.deepseek.com/chat/completions',model:'deepseek-chat'},
 'OpenAI':{endpoint:'https://api.openai.com/v1/chat/completions',model:'gpt-4.1-mini'},
 '通义千问':{endpoint:'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',model:'qwen-plus'},
 '硅基流动':{endpoint:'https://api.siliconflow.cn/v1/chat/completions',model:''},
 'Ollama 本地':{endpoint:'http://127.0.0.1:11434/v1/chat/completions',model:'qwen2.5:7b'},
 '自定义接口':{endpoint:'',model:''}
};
ipcMain.handle('profiles',()=>profiles);
// 密钥按服务商与 URL 来源隔离。防止切换模型平台时意外把旧平台密钥发送给新平台。
function keyPath(provider,endpoint){
  const origin=new URL(endpoint).origin;
  const slug=crypto.createHash('sha256').update(String(provider)+'\\n'+origin).digest('hex');
  return f('api-key-'+slug+'.enc');
}
function migrateLegacyKey(settings){
  const legacy=f('apikey.enc');
  if(!settings?.provider||!settings?.endpoint||!fs.existsSync(legacy))return;
  let dst;try{dst=keyPath(settings.provider,settings.endpoint)}catch{return}
  if(!fs.existsSync(dst)){
    // 旧版密钥仅迁移到旧版配置对应的平台，绝不复制给新服务商。
    fs.copyFileSync(legacy,dst);
  }
  fs.renameSync(legacy,legacy+'.migrated');
}
ipcMain.handle('settings-get',()=>{
 const s=read('ai-settings.json',{provider:'DeepSeek',...profiles.DeepSeek});
 migrateLegacyKey(s);
 return {...s,hasKey:!!s.endpoint&&fs.existsSync(keyPath(s.provider,s.endpoint))};
});
ipcMain.handle('settings-save',(_e,x)=>{
 const provider=String(x.provider||'DeepSeek'), endpoint=String(x.endpoint||'').trim(),model=String(x.model||'').trim();
 let u;try{u=new URL(endpoint)}catch{throw Error('接口地址不是有效 URL')}
 if(!(u.protocol==='https:'||(u.protocol==='http:'&&['127.0.0.1','localhost'].includes(u.hostname))))throw Error('云端只允许 HTTPS，本地允许 Ollama');
 if(!model)throw Error('请填写模型 ID');
 const previous=read('ai-settings.json',{});
 migrateLegacyKey(previous);
 const destination=keyPath(provider,endpoint);
 if(x.key){
   if(!safeStorage.isEncryptionAvailable())throw Error('Windows 密钥加密不可用');
   fs.writeFileSync(destination,safeStorage.encryptString(String(x.key)));
 }
 write('ai-settings.json',{provider,endpoint,model});
 return {provider,endpoint,model,hasKey:fs.existsSync(destination)};
});
ipcMain.handle('key-clear',()=>{
 const s=read('ai-settings.json',{});
 if(s.endpoint){const p=keyPath(s.provider,s.endpoint);if(fs.existsSync(p))fs.unlinkSync(p)}
 return {hasKey:false};
});
function queryAI(endpoint,model,messages,key){
 return new Promise((resolve,reject)=>{const u=new URL(endpoint),driver=u.protocol==='https:'?https:http;const req=driver.request(u,{method:'POST',timeout:90000,headers:{'Content-Type':'application/json',...(key?{Authorization:'Bearer '+key}:{})}},res=>{const chunks=[];let len=0;res.on('data',v=>{len+=v.length;if(len>4*1024*1024){req.destroy(Error('服务端响应超过大小限制'));return}chunks.push(v)});res.on('end',()=>{const raw=Buffer.concat(chunks).toString('utf8');let obj;try{obj=JSON.parse(raw)}catch{return reject(Error('模型返回无效 JSON：'+raw.slice(0,120)))}if(res.statusCode>=400){const detail=obj.error?.message||obj.message||raw.slice(0,200);return reject(Error('模型请求失败 HTTP '+res.statusCode+'：'+detail))}const txt=obj.choices?.[0]?.message?.content;if(!txt)return reject(Error('模型接口响应成功，但没有返回聊天文本'));resolve(typeof txt==='string'?txt:JSON.stringify(txt))})});req.on('timeout',()=>req.destroy(Error('模型响应超时（90秒）')));req.on('error',reject);req.end(JSON.stringify({model,messages,stream:false}))})
}

function historyRows(){return read('chat-history.json',[])}
function chatStore(){return read('project-chat.json',{})}
function memoryNotes(){return read('project-notes.json',{})}
ipcMain.handle('chat-list',(_e,projectId)=>memory.getTurns(chatStore(),projectId));
ipcMain.handle('chat-clear',(_e,projectId)=>{const x=chatStore();delete x[memory.projectBucket(projectId)];write('project-chat.json',x);return true});
ipcMain.handle('memory-get',(_e,projectId)=>String(memoryNotes()[memory.projectBucket(projectId)]||''));
ipcMain.handle('memory-save',(_e,projectId,value)=>{
 if(projectId&&!project(db(),projectId))throw Error('该项目不存在');
 const x=memoryNotes();x[memory.projectBucket(projectId)]=String(value||'').slice(0,6000);write('project-notes.json',x);return true;
});
ipcMain.handle('chat',async(_e,payload)=>{
 const cfg=read('ai-settings.json',{}),message=String(payload?.message||'').trim().slice(0,10000);
 if(!cfg.endpoint||!cfg.model)throw Error('请先配置模型平台、模型 ID 和接口地址');
 if(!message)throw Error('请输入消息');
 const projectId=String(payload?.projectId||'');
 if(projectId&&!project(db(),projectId))throw Error('没有找到这个项目');
 migrateLegacyKey(cfg);
 const keyFile=keyPath(cfg.provider,cfg.endpoint);let key='';
 if(fs.existsSync(keyFile)){
  if(!safeStorage.isEncryptionAvailable())throw Error('Windows 无法解密 API Key');
  key=safeStorage.decryptString(fs.readFileSync(keyFile));
 }
 if(cfg.provider!=='Ollama 本地'&&!key)throw Error('当前服务商缺少 API Key，请在此平台单独配置');
 const image=String(payload?.image||'');
 if(image&&(!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(image)||image.length>8*1024*1024))throw Error('截图超出大小限制或格式不正确');
 if(image&&cfg.provider==='DeepSeek'&&/^deepseek-(chat|reasoner)$/.test(cfg.model))throw Error('当前 DeepSeek 模型按纯文本配置；请换用支持图片的模型');
 const turns=memory.getTurns(chatStore(),projectId);
 const m=memory.contextForProject({projectId,question:message,turns,notes:memoryNotes(),history:historyRows(),includeHistory:payload?.includeHistory===true});
 const projectInfo=projectId?project(db(),projectId):null;
 const context=projectInfo?'\n项目名称：'+projectInfo.name+'\n已验收：'+(projectInfo.tasks||[]).filter(x=>x.verified).map(x=>x.title).join('、')+'\n文件映射名称：'+(projectInfo.links||[]).map(x=>path.basename(x.path)).join('、'):'';
 const content=image?[{type:'text',text:message},{type:'image_url',image_url:{url:image}}]:message;
 const messages=[{role:'system',content:m.system+context},...m.messages,{role:'user',content}];
 const reply=await queryAI(cfg.endpoint,cfg.model,messages,key);
 let next=memory.addTurn(chatStore(),projectId,'user',message);
 next=memory.addTurn(next,projectId,'assistant',reply);
 write('project-chat.json',next);
 return {reply,projectId,saved:true,usedHistory:m.historyHits};
});
ipcMain.handle('float-open',()=>floatWindow());
ipcMain.handle('fullscreen-toggle',e=>{const w=BrowserWindow.fromWebContents(e.sender);w.setFullScreen(!w.isFullScreen());return w.isFullScreen()});
ipcMain.handle('screen-capture',async()=>{const size=screen.getPrimaryDisplay().size;const sources=await desktopCapturer.getSources({types:['screen'],thumbnailSize:{width:Math.min(size.width,1920),height:Math.min(size.height,1080)}});if(!sources.length||sources[0].thumbnail.isEmpty())throw Error('截图不可用。请尝试 Windows 区域截图或检查系统屏幕捕获权限');return sources[0].thumbnail.toDataURL()});

ipcMain.handle('history-list',()=>historyRows().map(x=>({id:x.id,title:x.title,projectId:x.projectId||null,suggestionProjectId:x.suggestionProjectId||null,suggestionScore:x.suggestionScore||0})).slice(0,1500));
ipcMain.handle('history-assign',(_e,hid,projectId)=>{
 if(projectId&&!project(db(),projectId))throw Error('指定项目不存在');
 const rows=historyRows(),hit=rows.find(x=>x.id===hid);
 if(!hit)throw Error('未找到该历史会话');
 hit.projectId=projectId||null;write('chat-history.json',rows);return true;
});
ipcMain.handle('history-export-open',async()=>{await shell.openExternal('https://chatgpt.com/');return true});
ipcMain.handle('history-import',async e=>{
 const w=BrowserWindow.fromWebContents(e.sender);
 const result=await dialog.showOpenDialog(w,{title:'导入 ChatGPT 官方导出的 ZIP 或 conversations.json',filters:[{name:'官方导出',extensions:['zip','json']}],properties:['openFile']});
 if(result.canceled)return {count:0,added:0,updated:0,suggested:0,canceled:true};
 const loc=result.filePaths[0],stat=fs.statSync(loc);
 if(stat.size>160*1024*1024)throw Error('导出文件超过 160MB，请拆分文件后导入');
 let json;
 if(/\.zip$/i.test(loc)){
  const zip=new admzip(loc);
  const entries=zip.getEntries().filter(x=>!x.isDirectory&&/(^|\/)conversations\.json$/i.test(x.entryName));
  if(entries.length!==1)throw Error('ZIP 中没有唯一的 conversations.json，请确认是 ChatGPT 官方导出文件');
  const entry=entries[0];
  if(entry.header.size>120*1024*1024)throw Error('聊天 JSON 解压后超过安全上限');
  const buf=entry.getData();
  if(buf.length>120*1024*1024)throw Error('导出内容超出安全限制');
  json=JSON.parse(buf.toString('utf8'));
 }else{
  if(stat.size>120*1024*1024)throw Error('聊天 JSON 超出安全限制');
  json=JSON.parse(fs.readFileSync(loc,'utf8'));
 }
 const imported=memory.extractExport(json);
 const merged=memory.mergeHistory(historyRows(),imported,db().projects);
 write('chat-history.json',merged.rows);
 return {count:merged.rows.length,added:merged.added,updated:merged.updated,suggested:merged.suggested};
});
