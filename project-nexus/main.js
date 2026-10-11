'use strict';
const { app,BrowserWindow,dialog,ipcMain,shell,safeStorage,desktopCapturer,screen,globalShortcut }=require('electron');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),http=require('node:http'),https=require('node:https');
const admzip=require('adm-zip');
const memory=require('./nexus-memory');
const auth=require('./nexus-auth');
const features=require('./nexus-features');
const folders=require('./nexus-folders');
const diagnostics=require('./nexus-log-diagnostics');
let mainWin=null, chatWin=null;
let lockController=null;

const home=()=>app.getPath('userData'),f=n=>path.join(home(),n);
function read(n,defaultValue){
 const target=f(n);
 if(!fs.existsSync(target))return defaultValue;
 try{return JSON.parse(fs.readFileSync(target,'utf8'))}
 catch(e){throw Error('本地数据文件 '+n+' 无法读取或解析。为防止覆盖原有项目数据，程序已停止此项操作。请先备份 '+target+'，再尝试修复。原因：'+e.message)}
}
function write(n,value){
 fs.mkdirSync(home(),{recursive:true});const dst=f(n),tmp=dst+'.tmp';
 fs.writeFileSync(tmp,JSON.stringify(value,null,2),'utf8');
 try{
  if(fs.existsSync(dst)){try{fs.copyFileSync(dst,dst+'.bak')}catch(e){throw Error('创建数据备份失败：'+e.message)}}
  fs.renameSync(tmp,dst);
 }catch(e){try{fs.unlinkSync(tmp)}catch{}throw e}
}
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
app.whenReady().then(()=>{lockController=auth.createController(app.getPath('userData'));mainWindow();
 globalShortcut.register('Control+Alt+N',()=>{if(!mainWin||mainWin.isDestroyed()){mainWindow();return}if(mainWin.isMinimized())mainWin.restore();mainWin.show();mainWin.focus()});
 globalShortcut.register('Control+Alt+J',()=>floatWindow());
 app.on('activate',()=>{if(!mainWin)mainWindow()});
});app.on('will-quit',()=>globalShortcut.unregisterAll());
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit()});
function local(p){if(typeof p!=='string'||!path.isAbsolute(p))throw Error('路径不合法');return p}
function ensureProject(s,id){const p=project(s,id);if(!p)throw Error('项目不存在');return p}

// 所有具名 IPC 除解锁与密码设置外均在主进程校验，不能仅通过前端隐藏内容绕过。
const noAuth=new Set(['auth-status','auth-setup','auth-unlock','auth-lock']);
const registerIpc=ipcMain.handle.bind(ipcMain);
ipcMain.handle=(channel,handler)=>{
 registerIpc(channel,async(event,...args)=>{
  if(!noAuth.has(channel))lockController?.assertUnlocked();
  return handler(event,...args);
 });
};
ipcMain.handle('auth-status',()=>lockController.status());
ipcMain.handle('auth-setup',(_event,password,confirm)=>lockController.setup(password,confirm));
ipcMain.handle('auth-unlock',(_event,password)=>lockController.unlock(password));
ipcMain.handle('auth-lock',()=>{const status=lockController.lock();for(const window of BrowserWindow.getAllWindows())if(!window.isDestroyed())window.webContents.send('nexus-locked');return status});

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

function parseProgressProposal(reply) {
 const raw=String(reply||'').trim(),start=raw.indexOf('{'),end=raw.lastIndexOf('}');
 if(start===-1||end<=start)throw Error('模型没有返回有效的进度分析 JSON，请重试或更换模型');
 let result;
 try{result=JSON.parse(raw.slice(start,end+1))}catch{throw Error('模型进度分析不是可解析的 JSON，请重试')}
 const statuses=['已完成待确认','进行中','尚未开始','证据不足'];
 return {stage:String(result.stage||'阶段未确定').slice(0,100),summary:String(result.summary||'').slice(0,900),
  sourceWarning:'AI 仅根据已授权聊天材料推断，未经人工验收不计入完成进度。',
  items:(Array.isArray(result.items)?result.items:[]).slice(0,18).map(v=>({
   title:String(v.title||'').trim().slice(0,120),status:statuses.includes(v.status)?v.status:'证据不足',
   evidence:String(v.evidence||'未引用明确证据').slice(0,550),confidence:Math.max(0,Math.min(100,Number(v.confidence)||0)),
   reviewed:false
  })).filter(v=>v.title)};
}
ipcMain.handle('progress-analyze',async(_e,projectId,options={})=>{
 const p=ensureProject(db(),projectId),cfg=read('ai-settings.json',{});
 if(!cfg.endpoint||!cfg.model)throw Error('请先配置 AI 服务商及模型 ID');
 migrateLegacyKey(cfg);
 const filename=keyPath(cfg.provider,cfg.endpoint),key=fs.existsSync(filename)?safeStorage.decryptString(fs.readFileSync(filename)):'';
 if(!key&&cfg.provider!=='Ollama 本地')throw Error('当前 AI 平台尚未设置自己的 API Key');
 const turnText=memory.getTurns(chatStore(),projectId).slice(-30)
  .map(t=>((t.role==='user')?'用户':'AI')+'：'+String(t.text||'').slice(0,850)).join('\n').slice(-14500);
 const prior=options.includeHistory===true?historyRows().filter(h=>h.projectId===projectId).slice(0,15):[];
 const priorText=prior.map(h=>'【导入的 ChatGPT 对话：'+h.title+'】\n'+String(h.snippet||'').slice(0,1000)).join('\n\n').slice(0,16000);
 const notes=String(memoryNotes()[memory.projectBucket(projectId)]||'').slice(0,4000);
 if(!turnText&&!priorText&&!notes)throw Error('这个项目暂无聊天或记忆资料，无法据此判断进度。请先导入记录并关联项目。');
 const system='你是机械工程项目进度审查员，只使用输入材料提出进度建议，必须用简体中文。不得把“计划/准备/询问/讨论”算作完成。' +
 '“已完成待确认”仅适用于资料明确陈述已实际完成，但仍须用户确认。' +
 '严格返回 JSON，格式为 {"stage":"阶段","summary":"总体判断","items":[{"title":"可验收任务","status":"已完成待确认|进行中|尚未开始|证据不足","evidence":"在记录中找到的对应简短原文或事实依据","confidence":0-100}]}；不要 Markdown。' +
 '最多12项，信息不足须标为证据不足，不能虚构日期、数值、文件验证或已执行的工作。';
 const record='项目：'+p.name+'\n已验收任务：'+(p.tasks||[]).filter(t=>t.verified).map(t=>t.title).join('、')+
 '\n【已保存项目长期笔记】\n'+notes+'\n【NEXUS 本项目聊天】\n'+turnText+
 '\n【经用户授权的 ChatGPT 历史摘录】\n'+priorText;
 const reply=await queryAI(cfg.endpoint,cfg.model,[{role:'system',content:system},{role:'user',content:record}],key);
 const proposal=parseProgressProposal(reply);
 proposal.createdAt=new Date().toISOString();
 proposal.sources={nexus:turnText.length>0,historyCount:prior.length,notes:!!notes};
 const latest=db(),target=ensureProject(latest,projectId);
 target.aiReview=proposal;save(latest);
 return proposal;
});
ipcMain.handle('progress-accept',(_e,projectId,index,verified)=>{
 const state=db(),p=ensureProject(state,projectId),review=p.aiReview;
 if(!review||!Array.isArray(review.items)||!Number.isInteger(index)||index<0||index>=review.items.length)throw Error('进度建议已失效，请重新分析');
 const suggestion=review.items[index];
 if(suggestion.reviewed)throw Error('该条建议已处理');
 const title=suggestion.title.trim().slice(0,120);
 if(!title)throw Error('建议任务无效');
 if(verified&&suggestion.status!=='已完成待确认')throw Error('当前建议不属于已完成状态，只能作为待办添加');
 p.tasks??=[];
 let task=p.tasks.find(t=>String(t.title||'').trim().toLowerCase()===title.toLowerCase());
 if(!task){task={id:uid(),title,verified:false,weight:1,origin:'ai-suggestion'};p.tasks.push(task)}
 if(verified)task.verified=true;
 suggestion.reviewed=true;suggestion.acceptedAt=new Date().toISOString();
 save(state);return state;
});


const modes=[
 {id:'mechanical',title:'机械建模',icon:'🧩',hint:'SolidWorks · AutoCAD · 工程模型',pattern:/solidworks|autocad|cad|keyshot|creo|inventor/i,ext:/\.(sldasm|sldprt|slddrw|step|stp|stl|dwg)$/i},
 {id:'simulation',title:'有限元与流体仿真',icon:'🔬',hint:'ANSYS · Fluent · 网格与求解文件',pattern:/ansys|fluent|mechanical|matlab/i,ext:/\.(wbpj|wbpz|cas|dat|h5)$/i},
 {id:'vr',title:'Unity 与 VR',icon:'🥽',hint:'Unity · PICO · VR 场景',pattern:/unity|pico|steamvr|blender/i,ext:/\.(unity|blend|fbx)$/i},
 {id:'study',title:'学习与报告',icon:'📚',hint:'Word · WPS · PDF · 课程资料',pattern:/word|wps|office|edge|chrome|pdf|powerpoint/i,ext:/\.(pdf|docx?|pptx|xlsx)$/i}
];
function scanRoots(){
 const state=db();
 // 授权范围：用户手动授权的目录，以及已明确映射为工程目录的位置。
 return [...new Set([...(state.roots||[]),...state.projects.flatMap(p=>(p.links||[]).filter(l=>l.type==='folder').map(l=>l.path))])].filter(x=>typeof x==='string'&&path.isAbsolute(x)).slice(0,12);
}
function cachedRadar(){return read('file-radar.json',{files:[],warnings:[],scannedAt:null})}
function authorizedFolderIndex(){return folders.browseRoots((db().roots||[]),db().projects)}
ipcMain.handle('folders-list',()=>authorizedFolderIndex());
ipcMain.handle('folders-scan',()=>{const result=authorizedFolderIndex();write('folder-index.json',result);return result});
ipcMain.handle('folders-link',(_e,projectId,folderPath)=>{
 const index=authorizedFolderIndex();
 if(!folders.isListedFolder(folderPath,index))throw Error('只允许关联已授权根目录下的一级工程文件夹；请先授权根目录并重新扫描');
 const state=db(),p=ensureProject(state,projectId);
 p.links??=[];
 if(!p.links.some(x=>x.path.toLowerCase()===folderPath.toLowerCase()))p.links.push({path:folderPath,type:'folder',date:new Date().toISOString()});
 return save(state);
});
ipcMain.handle('folders-ai-suggest',async(_e,folderPaths)=>{
 const index=authorizedFolderIndex(),paths=Array.isArray(folderPaths)?folderPaths.slice(0,45):[];
 if(paths.some(p=>!folders.isListedFolder(p,index)))throw Error('选中的文件夹不在授权一级目录范围');
 const selected=index.folders.filter(x=>paths.includes(x.path));
 if(!selected.length)throw Error('请先勾选需要判断归属的一级工程文件夹');
 const cfg=read('ai-settings.json',{});
 if(!cfg.endpoint||!cfg.model)throw Error('请先配置 AI 模型');
 migrateLegacyKey(cfg);
 const keyfile=keyPath(cfg.provider,cfg.endpoint);
 const key=fs.existsSync(keyfile)?safeStorage.decryptString(fs.readFileSync(keyfile)):'';
 if(!key&&cfg.provider!=='Ollama 本地')throw Error('当前模型尚未设置 API Key');
 const state=db();
 if(!state.projects.length)throw Error('请先创建工程项目');
 const prompt='你是中文工程目录归类助手。只能根据目录名和项目名推荐归属，绝不能假装已经打开目录内的文件。返回一个 JSON 对象，格式 {"items":[{"path":"原始路径","projectId":"已给出的项目ID或空字符串","confidence":0到100,"reason":"简短依据"}]}。不确定则 projectId 为空。';
 const payload={folders:selected.map(x=>({name:x.name,path:x.path})),projects:state.projects.map(p=>({id:p.id,name:p.name}))};
 const response=await queryAI(cfg.endpoint,cfg.model,[{role:'system',content:prompt},{role:'user',content:JSON.stringify(payload)}],key);
 let data;try{data=JSON.parse(response.slice(response.indexOf('{'),response.lastIndexOf('}')+1))}catch{throw Error('AI 未返回有效 JSON，请重试；任何文件夹都尚未关联')}
 const items=(Array.isArray(data.items)?data.items:[]).filter(x=>selected.some(y=>y.path===x.path)).map(x=>({path:x.path,name:path.basename(x.path),
  projectId:state.projects.some(p=>p.id===x.projectId)?x.projectId:null,
  projectName:state.projects.find(p=>p.id===x.projectId)?.name||'未确定',
  confidence:Math.min(100,Math.max(0,Number(x.confidence)||0)),
  reason:String(x.reason||'未说明').slice(0,200)}));
 return {items,warning:'AI 仅收到授权一级工程文件夹的名称和路径，没有扫描其内部文件。建议必须人工确认。'};
});
ipcMain.handle('radar-scan',()=>{
 const root=scanRoots();
 if(!root.length)throw Error('请先在智能文件柜授权扫描目录，或映射一个工程文件夹');
 const result=features.radar(root,db().projects,{maxFiles:700,maxDepth:3});
 write('file-radar.json',result);
 return result;
});
ipcMain.handle('radar-get',()=>cachedRadar());
ipcMain.handle('radar-link',(_e,projectId,filePath)=>{
 const file=cachedRadar().files.find(x=>x.path===filePath);
 if(!file||!fs.existsSync(file.path)||!fs.statSync(file.path).isFile())throw Error('文件不在已扫描索引中，或已被移动。请重新扫描');
 const state=db(),project=ensureProject(state,projectId);
 if(!(project.links||[]).some(l=>l.path.toLowerCase()===file.path.toLowerCase()))(project.links??=[]).push({path:file.path,type:'file',date:new Date().toISOString()});
 return save(state);
});
ipcMain.handle('versions-list',(_e,projectId)=>{
 const state=db();if(projectId)ensureProject(state,projectId);
 const sources=[...cachedRadar().files];
 // 显式映射的工程文件在尚未扫描时也能参与版本识别
 for(const p of state.projects){if(projectId&&p.id!==projectId)continue;
 for(const l of p.links||[]){if(l.type!=='file'||sources.some(x=>x.path===l.path)||!fs.existsSync(l.path))continue;
 try{const stat=fs.statSync(l.path);sources.push({name:path.basename(l.path),path:l.path,projectId:p.id,modifiedAt:stat.mtime.toISOString()})}catch{}
 }}
 return features.versions(projectId?sources.filter(x=>x.projectId===projectId):sources);
});
ipcMain.handle('snapshot-list',(_e,projectId)=>{
 ensureProject(db(),projectId);
 return read('snapshots.json',[]).filter(x=>x.projectId===projectId).slice(-80).reverse();
});
ipcMain.handle('snapshot-create',(_e,projectId,sourcePath)=>{
 const p=ensureProject(db(),projectId);
 const file=(p.links||[]).find(l=>l.path===sourcePath&&l.type==='file');
 if(!file)throw Error('只能对已明确关联的工程文件创建快照');
 const stat=fs.statSync(file.path);
 if(!stat.isFile()||stat.size>250*1024*1024)throw Error('快照只支持不超过 250MB 的单个普通文件');
 const dir=path.join(home(),'snapshots',projectId);fs.mkdirSync(dir,{recursive:true});
 const id=uid(),dst=path.join(dir,id+'-'+path.basename(file.path).replace(/[<>:"/\\|?*]/g,'_'));
 fs.copyFileSync(file.path,dst,fs.constants.COPYFILE_EXCL);
 const items=read('snapshots.json',[]);
 const snapshot={id,projectId,source:file.path,target:dst,size:stat.size,createdAt:new Date().toISOString()};
 items.push(snapshot);write('snapshots.json',items.slice(-800));return snapshot;
});
ipcMain.handle('snapshot-reveal',(_e,projectId,snapshotId)=>{
 ensureProject(db(),projectId);
 const item=read('snapshots.json',[]).find(x=>x.projectId===projectId&&x.id===snapshotId);
 if(!item||!fs.existsSync(item.target))throw Error('未找到此快照文件');
 shell.showItemInFolder(item.target);return true;
});
ipcMain.handle('timeline-get',(_e,projectId)=>{
 const project=ensureProject(db(),projectId),base=features.timeline(project,historyRows(),memory.getTurns(chatStore(),projectId));
 for(const s of read('snapshots.json',[]).filter(x=>x.projectId===projectId)){
 base.push({time:s.createdAt,title:'保存文件快照：'+path.basename(s.source),source:'本机备份',details:s.target});
 }
 return base.sort((a,b)=>b.time.localeCompare(a.time)).slice(0,160);
});
ipcMain.handle('graph-get',(_e,projectId)=>features.graph(ensureProject(db(),projectId),historyRows()));
ipcMain.handle('health-check',()=>features.health(db(),read('ai-settings.json',{}),scanRoots()));
ipcMain.handle('modes-list',()=>modes.map(({id,title,icon,hint})=>({id,title,icon,hint})));
ipcMain.handle('mode-preview',(_e,projectId,modeId)=>{
 const cfg=modes.find(x=>x.id===modeId);if(!cfg)throw Error('未知工作模式');
 const state=db(),p=projectId?ensureProject(state,projectId):null;
 const apps=(state.apps||[]).filter(a=>cfg.pattern.test(a.name)).sort((a,b)=>(b.pinned?1:0)-(a.pinned?1:0)).slice(0,5).map(a=>({id:a.id,name:a.name,kind:a.kind}));
 const files=(p?.links||[]).filter(x=>x.type==='file'&&cfg.ext.test(x.path)).slice(0,7).map(x=>({path:x.path,name:path.basename(x.path)}));
 return {id:cfg.id,title:cfg.title,hint:cfg.hint,apps,files,project:p?.name||'未选择项目'};
});
ipcMain.handle('mode-start',async(_e,projectId,modeId,appId,filePath)=>{
 const preview=modes.find(x=>x.id===modeId);if(!preview)throw Error('未知工作模式');
 const state=db(),p=projectId?ensureProject(state,projectId):null;
 const selectedApp=appId?(state.apps||[]).find(a=>a.id===appId&&preview.pattern.test(a.name)):null;
 const selectedFile=filePath?(p?.links||[]).find(l=>l.path===filePath&&l.type==='file'&&preview.ext.test(l.path)):null;
 if(!selectedApp&&!selectedFile)throw Error('请先选择此模式推荐的程序或项目文件');
 const opened=[];
 if(selectedApp){if(!fs.existsSync(selectedApp.path))throw Error('软件快捷方式不存在');const err=await shell.openPath(selectedApp.path);if(err)throw Error(err);opened.push(selectedApp.name)}
 if(selectedFile){if(!fs.existsSync(selectedFile.path))throw Error('关联工程文件不存在');const err=await shell.openPath(selectedFile.path);if(err)throw Error(err);opened.push(path.basename(selectedFile.path))}
 return {opened};
});
function publicGithubStatus(){
 return new Promise((resolve,reject)=>{
 const url='https://api.github.com/repos/1763107202-afk/modelhub/actions/runs?per_page=12';
 const req=https.get(url,{timeout:10000,headers:{'User-Agent':'PROJECT-NEXUS','Accept':'application/vnd.github+json'}},res=>{
  const chunks=[];let size=0;res.on('data',buf=>{size+=buf.length;if(size>350000)req.destroy(Error('GitHub 返回数据过大'));else chunks.push(buf)});
  res.on('end',()=>{if(res.statusCode!==200)return reject(Error('GitHub HTTP '+res.statusCode));let result;try{result=JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{return reject(Error('GitHub 数据解析失败'))}
    resolve((result.workflow_runs||[]).filter(x=>/nexus/i.test(x.name)).slice(0,8).map(x=>({id:x.id,name:x.name,status:x.status,conclusion:x.conclusion,createdAt:x.created_at,htmlUrl:x.html_url,sha:x.head_sha})));
  });
 });req.on('error',reject);req.on('timeout',()=>req.destroy(Error('GitHub 请求超时')));
 });
}

ipcMain.handle('logs-pick',async(e)=>{
 const dialogResult=await dialog.showOpenDialog(BrowserWindow.fromWebContents(e.sender),{
  title:'选择 ANSYS / Fluent / Unity 运行日志',properties:['openFile'],
  filters:[{name:'工程日志',extensions:['log','txt','out','err']}]});
 if(dialogResult.canceled)return {canceled:true};
 return diagnostics.analyzeFile(dialogResult.filePaths[0]);
});
ipcMain.handle('github-status',()=>publicGithubStatus());
ipcMain.handle('github-open',async(_e,url)=>{
 const addr=String(url||'');
 if(!/^https:\/\/github\.com\/1763107202-afk\/modelhub(?:\/actions(?:\/runs\/\d+|\/workflows\/[a-z0-9_-]+\.yml)?)?\/?$/i.test(addr))throw Error('只允许打开当前工程仓库的 GitHub 页面');
 await shell.openExternal(addr);return true;
});
ipcMain.handle('report-export',async(e,projectId,format)=>{
 const p=ensureProject(db(),projectId),ext=['md','pdf','docx'].includes(format)?format:'md';
 const health=features.health(db(),read('ai-settings.json',{}),scanRoots());
 const events=features.timeline(p,historyRows(),memory.getTurns(chatStore(),projectId));
 const text=features.report(p,events,health);
 const outcome=await dialog.showSaveDialog(BrowserWindow.fromWebContents(e.sender),{
  title:'导出项目阶段报告',defaultPath:path.join(app.getPath('documents'),'NEXUS-'+p.name.replace(/[<>:"/\\|?*]/g,'_')+'-'+new Date().toISOString().slice(0,10)+'.'+ext),
  filters:[{name:ext.toUpperCase(),extensions:[ext]}]});
 if(outcome.canceled||!outcome.filePath)return {canceled:true};
 if(ext==='md'){fs.writeFileSync(outcome.filePath,text,'utf8');return {path:outcome.filePath}};
 if(ext==='docx'){
  const {Document,Paragraph,Packer,HeadingLevel}=require('docx');
  const blocks=text.split('\n').map(raw=>{
   const line=raw.slice(0,1400);
   if(line.startsWith('# '))return new Paragraph({text:line.slice(2),heading:HeadingLevel.TITLE,spacing:{before:200,after:220}});
   if(line.startsWith('## '))return new Paragraph({text:line.slice(3),heading:HeadingLevel.HEADING_1,spacing:{before:300,after:120}});
   if(line.startsWith('- '))return new Paragraph({text:'• '+line.slice(2),indent:{left:280},spacing:{after:65}});
   return new Paragraph({text:line,spacing:{after:75}});
  });
  const doc=new Document({sections:[{children:blocks}]});
  fs.writeFileSync(outcome.filePath,await Packer.toBuffer(doc));return {path:outcome.filePath};
 }
 const escapeHtml=x=>String(x).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
 const body=text.split('\n').map(line=>{
  if(line.startsWith('# '))return '<h1>'+escapeHtml(line.slice(2))+'</h1>';
  if(line.startsWith('## '))return '<h2>'+escapeHtml(line.slice(3))+'</h2>';
  if(line.startsWith('- '))return '<div class="list-item">'+escapeHtml(line.slice(2))+'</div>';
  return line.trim()?'<p>'+escapeHtml(line)+'</p>':'<div class="space"></div>';
 }).join('');
 const html='<html><head><meta charset="utf-8"><style>body{font-family:"Microsoft YaHei",sans-serif;color:#17314a;font-size:10pt;line-height:1.6;margin:28px 34px}h1{color:#086887;font-size:23pt;border-bottom:3px solid #1a84ad;padding-bottom:12px}h2{color:#185675;font-size:14pt;margin:22px 0 10px;break-after:avoid}p{margin:5px 0}.list-item{margin:5px 0 5px 16px;overflow-wrap:anywhere}.space{height:10px}*{overflow-wrap:anywhere}</style></head><body>'+body+'</body></html>';
 const win=new BrowserWindow({show:false,webPreferences:{sandbox:true,nodeIntegration:false,contextIsolation:true}});
 try{await win.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent(html));const bytes=await win.webContents.printToPDF({printBackground:true,pageSize:'A4'});fs.writeFileSync(outcome.filePath,bytes)}finally{win.destroy()}
 return {path:outcome.filePath};
});

ipcMain.handle('float-open',()=>floatWindow());
ipcMain.handle('fullscreen-toggle',e=>{const w=BrowserWindow.fromWebContents(e.sender);w.setFullScreen(!w.isFullScreen());return w.isFullScreen()});
ipcMain.handle('screen-capture',async()=>{const size=screen.getPrimaryDisplay().size;const sources=await desktopCapturer.getSources({types:['screen'],thumbnailSize:{width:Math.min(size.width,1920),height:Math.min(size.height,1080)}});if(!sources.length||sources[0].thumbnail.isEmpty())throw Error('截图不可用。请尝试 Windows 区域截图或检查系统屏幕捕获权限');return sources[0].thumbnail.toDataURL()});


ipcMain.handle('screen-list-windows',async()=>{
 const sources=await desktopCapturer.getSources({types:['window'],thumbnailSize:{width:64,height:64}});
 return sources.filter(x=>x.name&&x.name.trim()).slice(0,80).map(x=>({id:x.id,name:x.name.slice(0,120)}));
});
ipcMain.handle('screen-capture-window',async(_e,id)=>{
 if(typeof id!=='string'||id.length>300)throw Error('未选择有效窗口');
 const sources=await desktopCapturer.getSources({types:['window'],thumbnailSize:{width:1440,height:900}});
 const selected=sources.find(x=>x.id===id);
 if(!selected||selected.thumbnail.isEmpty())throw Error('目标窗口已经关闭，或 Windows 禁止捕获该画面');
 return selected.thumbnail.toDataURL();
});

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
