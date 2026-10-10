'use strict';
const { app,BrowserWindow,dialog,ipcMain,shell,safeStorage,desktopCapturer,screen }=require('electron');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),http=require('node:http'),https=require('node:https');
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
 mainWin.loadFile(path.join(__dirname,'index.html'));mainWin.on('closed',()=>mainWin=null);
}
function floatWindow(){
 if(chatWin&&!chatWin.isDestroyed()){chatWin.show();chatWin.focus();return true}
 chatWin=new BrowserWindow({width:460,height:700,minWidth:380,minHeight:480,alwaysOnTop:true,autoHideMenuBar:true,title:'NEXUS AI · 悬浮助手',backgroundColor:'#0d1724',webPreferences:{preload:path.join(__dirname,'preload.js'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
 chatWin.loadFile(path.join(__dirname,'index.html'),{query:{float:'1'}});chatWin.on('closed',()=>chatWin=null);return true;
}
app.whenReady().then(()=>{mainWindow();app.on('activate',()=>{if(!mainWin)mainWindow()})});
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
ipcMain.handle('remove-link',(_e,id,index)=>{const s=db(),p=ensureProject(s,id);if(index<0||index>=(p.links||[]).length)throw Error('无效映射');p.links.splice(index,1);return save(s)});
ipcMain.handle('open-path',async(_e,loc)=>{loc=local(loc);if(!fs.existsSync(loc))throw Error('文件不存在：'+loc);const err=await shell.openPath(loc);if(err)throw Error(err);return true});
ipcMain.handle('reveal-path',(_e,loc)=>{loc=local(loc);if(!fs.existsSync(loc))throw Error('文件不存在：'+loc);shell.showItemInFolder(loc);return true});
ipcMain.handle('open-project',async(_e,id)=>{const p=ensureProject(db(),id);const item=(p.links||[]).find(x=>fs.existsSync(x.path));if(!item)throw Error('请先通过“添加文件夹”或“添加主工程”关联项目');const err=await shell.openPath(item.path);if(err)throw Error(err);return true});
ipcMain.handle('create-work',(_e,title)=>{title=String(title||'').trim().slice(0,120);if(!title)throw Error('请输入工作内容');const s=db();s.works.unshift({id:uid(),title,done:false,date:new Date().toISOString()});return save(s)});
ipcMain.handle('toggle-work',(_e,id)=>{const s=db(),w=s.works.find(x=>x.id===id);if(!w)throw Error('没有这项工作');w.done=!w.done;return save(s)});
ipcMain.handle('add-root',async e=>{const x=await dialog.showOpenDialog(BrowserWindow.fromWebContents(e.sender),{title:'授权扫描的文件夹',properties:['openDirectory']});const s=db();if(!x.canceled)for(const v of x.filePaths)if(!s.roots.includes(v))s.roots.push(v);return save(s)});
function category(name){if(/solidworks|ansys|fluent|unity|blender|keyshot|autocad|cad|arduino|keil|matlab/i.test(name))return '工程设计';if(/word|wps|excel|pdf|powerpoint|浏览器|chrome|edge|office/i.test(name))return '学习办公';if(/visual studio|vs code|github|git|dev-c|python/i.test(name))return '开发工具';return '其他'}
function crawl(dir,limit,out,depth=0){if(depth>2||out.length>=limit||!fs.existsSync(dir))return;let items=[];try{items=fs.readdirSync(dir,{withFileTypes:true})}catch{return}for(const item of items){if(out.length>=limit)break;const loc=path.join(dir,item.name);if(item.isDirectory())crawl(loc,limit,out,depth+1);else if(/\.(lnk|exe)$/i.test(item.name)&&!/(卸载|uninstall|update|updater|helper|readme|配置|settings|license)/i.test(item.name)){out.push({id:uid(),name:item.name.replace(/\.(lnk|exe)$/i,''),path:loc,kind:category(item.name),pinned:false})}}}
ipcMain.handle('scan-apps',()=>{const roots=[app.getPath('desktop'),path.join(process.env.APPDATA||'','Microsoft','Windows','Start Menu','Programs'),path.join(process.env.PROGRAMDATA||'','Microsoft','Windows','Start Menu','Programs')];const found=[];for(const r of roots)crawl(r,900,found);const uniq=new Map();for(const x of found){const name=x.name.trim().toLowerCase();if(!uniq.has(name))uniq.set(name,x)}const s=db(),old=new Map((s.apps||[]).map(x=>[x.path.toLowerCase(),x]));s.apps=[...uniq.values()].map(x=>({...x,pinned:old.get(x.path.toLowerCase())?.pinned||false}));return save(s)});
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
ipcMain.handle('settings-get',()=>{const s=read('ai-settings.json',{provider:'DeepSeek',...profiles.DeepSeek});return {...s,hasKey:fs.existsSync(f('apikey.enc'))}});
ipcMain.handle('settings-save',(_e,x)=>{const provider=String(x.provider||'DeepSeek');let endpoint=String(x.endpoint||'').trim(),model=String(x.model||'').trim();let u;try{u=new URL(endpoint)}catch{throw Error('接口地址不是有效 URL')}if(!(u.protocol==='https:'||(u.protocol==='http:'&&['127.0.0.1','localhost'].includes(u.hostname))))throw Error('云端只允许 HTTPS，本地允许 Ollama');if(!model)throw Error('请填写模型 ID');if(x.key){if(!safeStorage.isEncryptionAvailable())throw Error('Windows 密钥加密不可用');fs.writeFileSync(f('apikey.enc'),safeStorage.encryptString(String(x.key)))}write('ai-settings.json',{provider,endpoint,model});return {provider,endpoint,model,hasKey:fs.existsSync(f('apikey.enc'))}});
function queryAI(endpoint,model,messages,key){
 return new Promise((resolve,reject)=>{const u=new URL(endpoint),driver=u.protocol==='https:'?https:http;const req=driver.request(u,{method:'POST',timeout:90000,headers:{'Content-Type':'application/json',...(key?{Authorization:'Bearer '+key}:{})}},res=>{const chunks=[];let len=0;res.on('data',v=>{len+=v.length;if(len>4*1024*1024){req.destroy(Error('服务端响应超过大小限制'));return}chunks.push(v)});res.on('end',()=>{const raw=Buffer.concat(chunks).toString('utf8');let obj;try{obj=JSON.parse(raw)}catch{return reject(Error('模型返回无效 JSON：'+raw.slice(0,120)))}if(res.statusCode>=400){const detail=obj.error?.message||obj.message||raw.slice(0,200);return reject(Error('模型请求失败 HTTP '+res.statusCode+'：'+detail))}const txt=obj.choices?.[0]?.message?.content;if(!txt)return reject(Error('模型接口响应成功，但没有返回聊天文本'));resolve(typeof txt==='string'?txt:JSON.stringify(txt))})});req.on('timeout',()=>req.destroy(Error('模型响应超时（90秒）')));req.on('error',reject);req.end(JSON.stringify({model,messages,stream:false}))})
}
ipcMain.handle('chat',async(_e,payload)=>{const s=read('ai-settings.json',{}),message=String(payload?.message||'').trim().slice(0,10000);if(!s.endpoint||!s.model)throw Error('请先在「AI 设置」中填写模型接口地址和模型 ID');if(!message)throw Error('请输入消息');const keyFile=f('apikey.enc');let key='';if(fs.existsSync(keyFile)){if(!safeStorage.isEncryptionAvailable())throw Error('Windows 凭据无法解密');key=safeStorage.decryptString(fs.readFileSync(keyFile))}if(s.provider!=='Ollama 本地'&&!key)throw Error('当前服务商缺少 API Key');const context=[];if(payload?.projectId){const p=project(db(),payload.projectId);if(p){context.push('当前项目：'+p.name);context.push('工程映射：'+(p.links||[]).map(x=>path.basename(x.path)).join('、'));context.push('已验收任务：'+(p.tasks||[]).filter(x=>x.verified).map(x=>x.title).join('、'));}}if(payload?.includeHistory){const matches=read('chat-history.json',[]).filter(x=>x.projectId===payload.projectId).slice(0,8);for(const c of matches)context.push('历史摘录：'+c.title+' '+String(c.snippet||'').slice(0,600))}
 const img=String(payload?.image||'');if(img&&s.provider==='DeepSeek'&&/^deepseek-(chat|reasoner)$/.test(s.model))throw Error('所选 DeepSeek 模型当前按纯文本配置，无法接收截图；请改用支持图像输入的模型');
 const content=img?[{type:'text',text:message},{type:'image_url',image_url:{url:img}}]:message;
 const messages=[{role:'system',content:'你是 PROJECT NEXUS 的简体中文工程助手。请根据确切的项目记录作答，区分未验证的用户陈述和已验收工作。不声称自动读取 ChatGPT 实时聊天。'+context.join('\n')},{role:'user',content}];
 return queryAI(s.endpoint,s.model,messages,key);
});
ipcMain.handle('float-open',()=>floatWindow());
ipcMain.handle('fullscreen-toggle',e=>{const w=BrowserWindow.fromWebContents(e.sender);w.setFullScreen(!w.isFullScreen());return w.isFullScreen()});
ipcMain.handle('screen-capture',async()=>{const size=screen.getPrimaryDisplay().size;const sources=await desktopCapturer.getSources({types:['screen'],thumbnailSize:{width:Math.min(size.width,1920),height:Math.min(size.height,1080)}});if(!sources.length||sources[0].thumbnail.isEmpty())throw Error('截图不可用。请尝试 Windows 区域截图或检查系统屏幕捕获权限');return sources[0].thumbnail.toDataURL()});
ipcMain.handle('history-import',async e=>{const x=await dialog.showOpenDialog(BrowserWindow.fromWebContents(e.sender),{title:'导入 ChatGPT 导出的 conversations.json',filters:[{name:'JSON',extensions:['json']}],properties:['openFile']});if(x.canceled)return {count:0};const loc=x.filePaths[0];if(fs.statSync(loc).size>100*1024*1024)throw Error('聊天导出文件过大，请先拆分');const raw=JSON.parse(fs.readFileSync(loc,'utf8'));if(!Array.isArray(raw))throw Error('JSON 格式不是 ChatGPT 对话导出');const arr=raw.map(c=>{const snippets=[];for(const v of Object.values(c.mapping||{})){const m=v?.message,parts=m?.content?.parts||[];if(['user','assistant'].includes(m?.author?.role)){for(const t of parts)if(typeof t==='string'&&t.trim())snippets.push(t.slice(0,240))}}return {id:uid(),title:String(c.title||'').slice(0,150),snippet:snippets.slice(-3).join(' ').slice(0,750),projectId:null}});write('chat-history.json',arr);return {count:arr.length}});
