
'use strict';
const api=window.nexus;
const isFloat=new URLSearchParams(location.search).get('float')==='1';
if(isFloat)document.body.classList.add('float');
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const $=id=>document.getElementById(id);
const fileName=path=>String(path||'').split(/[\\/]/).filter(Boolean).pop()||'未命名文件';
const fileType=link=>{
 if(link.type==='folder')return {icon:'📁',type:'工程目录'};
 const ext=(fileName(link.path).split('.').pop()||'').toLowerCase();
 const types={sldasm:['🧩','SolidWorks 装配体'],sldprt:['🧱','SolidWorks 零件'],slddrw:['📐','SolidWorks 工程图'],wbpj:['🔬','ANSYS Workbench'],cas:['🌊','Fluent 算例'],h5:['🌊','仿真数据'],sldasmx:['🧩','SolidWorks 装配体'],unity:['🎮','Unity 场景'],uproject:['🎮','Unity 项目'],blend:['🧊','Blender 模型'],step:['📦','STEP 模型'],stp:['📦','STEP 模型'],pdf:['📕','PDF 文档'],docx:['📄','Word 文档'],xlsx:['📊','Excel 数据'],pptx:['🖼️','演示文稿'],zip:['🗜️','ZIP 压缩包'],js:['💻','JavaScript 源码']};
 const item=types[ext]||['📄',(ext?ext.toUpperCase():'通用')+' 文件'];
 return {icon:item[0],type:item[1]};
};
const btn=(name,act,more='')=>'<button type="button" data-act="'+act+'" '+more+'>'+name+'</button>';
let db={projects:[],works:[],apps:[],roots:[]},page=isFloat?'ai':'home',pid='',profiles={},settings={},uploadImage='',chatMessages=[],busy=false,query='',appKind='常用',activeError='',chatDraft='',historyAllowed=false,historyItems=[],notesText='',radarData={files:[],warnings:[]},radarQuery='',modeData=[],modePreview=null,modeChoice='mechanical',toolTab='modes',projectTab='timeline',projectEvents=[],projectGraph=null,projectSnapshots=[],versionGroups=[],githubRuns=[],healthData=null,githubError='',logReport=null;
function safeErr(e){const x=String(e?.message||e||'未知错误');return x.replace(/^Error invoking remote method '[^']+': Error:\s*/,'').slice(0,1100)}
function notify(message,kind='ok'){const t=$('toast');if(!t)return;t.textContent=message;t.style.color=kind==='error'?'#ffacb5':'#95ecd2';}
function frame(){
 $('root').innerHTML='<div class="layout"><aside class="sidebar"><div class="brand">◆ NEXUS</div><div class="muted" style="margin:0 9px 18px">中文工程 · 智能工作中心</div><div id="navigation"></div><div class="side-foot">● 本地工作站<br><small>源工程保持原位 · 离线可用</small></div></aside><main class="main"><header class="top"><div><div class="muted">PROJECT NEXUS / ENGINEERING CONSOLE</div><div class="title" id="section-title">工程指挥中心</div></div><div class="top-actions">'+btn('⌕ 搜索 Ctrl+K','command-open','class="nav-search"')+btn('✧ AI 悬浮窗','float-open')+btn('⛶ 全屏切换','fullscreen-toggle')+'</div></header><div class="content" id="content"></div></main></div><div id="toast" role="status" aria-live="polite" class="toast"></div>';
 const nav=[['home','▦ 指挥中心'],['projects','◈ 工程项目'],['files','▤ 智能文件柜'],['work','☷ 工作任务'],['apps','▷ 软件启动台'],['tools','▥ 效率工具'],['ai','✧ AI 智能助手'],['settings','⚙ 设置 / 数据']];
 $('navigation').innerHTML=nav.map(([id,title])=>'<button type="button" class="nav '+(page===id?'active':'')+'" data-act="nav" data-id="'+id+'">'+title+'</button>').join('');
}
function percentage(p){const a=p.tasks||[];return a.length?Math.round(100*a.filter(x=>x.verified).length/a.length):null}
function projectCard(p){
 const links=p.links||[],n=percentage(p),main=links.find(l=>l.isPrimary)||links.find(l=>l.type==='file')||links[0];
 const type=main?fileType(main):{icon:'◇',type:'等待关联'};
 return '<article class="card project-card"><div class="project-card-top"><div class="project-symbol">'+type.icon+'</div><div class="project-card-detail"><div class="eyebrow">'+esc(p.kind||'个人工程')+'</div><h3>'+esc(p.name)+'</h3></div></div><div class="project-main-file">'+(main?'<span class="tiny-label">默认打开</span><strong title="'+esc(main.path)+'">'+esc(fileName(main.path))+'</strong><span class="muted">'+esc(type.type)+'</span>':'<span class="muted">尚未关联工程，点击查看抽屉进行设置</span>')+'</div><div class="project-card-bottom"><div class="project-progress"><span>'+(n===null?'暂无验收任务':'进度 '+n+'%')+'</span><span>'+links.length+' 个关联项</span></div><div class="progress"><div style="width:'+(n||0)+'%"></div></div><div class="actions">'+btn(main?'↗ 打开工程':'＋ 添加工程','open-project','data-id="'+esc(p.id)+'" class="primary"')+btn('查看项目','select-project','data-id="'+esc(p.id)+'"')+'</div></div></article>';
}
function breadcrumb(title,desc){return '<div class="section-heading"><div><div class="eyebrow">WORKSPACE / '+esc(page.toUpperCase())+'</div><h1 class="headline">'+title+'</h1><p class="desc">'+desc+'</p></div></div>'}
function home(){const current=db.projects.find(p=>p.id===pid)||db.projects[0];return breadcrumb('打开工作站，继续你的工程','项目、软件、文件、AI 和进度在同一个工作空间。')+'<section class="hero"><div><span class="eyebrow">PROJECT NEXUS / QUICK START</span><h2>从上次工作的项目继续</h2><p>不必逐个打开文件夹，直接进入工程主文件或启用常用工作模式。</p><div class="toolbar">'+(current?btn('↗ 打开 '+esc(current.name),'open-project','data-id="'+esc(current.id)+'" class="primary"'):btn('＋ 创建第一个工程','create-project','class="primary"'))+btn('▥ 一键工作模式','nav','data-id="tools"')+btn('⌕ 全局搜索','command-open')+'</div></div><div class="hero-mark">N</div></section>'+'<div class="cards stat-grid"><div class="card"><div class="muted">项目总数</div><div class="stat">'+db.projects.length+'</div><p>本地项目统一管理</p></div><div class="card"><div class="muted">文件映射</div><div class="stat">'+db.projects.reduce((s,p)=>s+(p.links||[]).length,0)+'</div><p>只保存路径，不复制原件</p></div><div class="card"><div class="muted">待完成任务</div><div class="stat">'+(db.projects.reduce((s,p)=>s+(p.tasks||[]).filter(t=>!t.verified).length,0)+db.works.filter(w=>!w.done).length)+'</div><p>任务需要人工验收</p></div></div><div class="toolbar headline-toolbar"><h2>我的项目</h2>'+btn('＋ 创建项目','create-project','class="primary"')+btn('打开 AI 助手','navigate-ai')+'</div><div class="cards">'+(db.projects.map(projectCard).join('')||'<div class="card empty">还没有项目。点击“创建项目”，然后关联真实的工程文件夹。</div>')+'</div>'}
function selectProject(id){if(pid!==id){projectEvents=[];projectGraph=null;projectSnapshots=[]}pid=id;setPage('projects');execute(async()=>{chatMessages=await api.getProjectChat(id);notesText=await api.getMemory(id)})}
function projectOptions(selected=''){return db.projects.map(p=>'<option value="'+esc(p.id)+'" '+(p.id===selected?'selected':'')+'>'+esc(p.name)+'</option>').join('')}
function projectDetail(){
 const p=db.projects.find(x=>x.id===pid);
 if(!p)return '<div class="panel">请选择一个项目查看文件和任务。</div>';
 const n=percentage(p),links=p.links||[];
 return '<section class="panel project-drawer"><div class="project-detail-header"><div><span class="eyebrow">PROJECT WORKSPACE / 工程工作台</span><h2>'+esc(p.name)+'</h2><p class="muted">工程文件、相关资料和验收进度集中管理，原始文件保持不变。</p></div><div class="drawer-header-actions">'+btn('✧ 用 AI 讨论项目','project-chat','data-id="'+esc(p.id)+'"')+btn('↗ 一键打开工程','open-project','data-id="'+esc(p.id)+'" class="primary"')+'</div></div><div class="project-drawer-toolbar"><div><h3>工程文件抽屉</h3><p class="muted">选择一个文件或目录作为默认入口，之后在首页一键打开。</p></div><div class="toolbar">'+btn('＋ 添加工程文件','pick-file','data-id="'+esc(p.id)+'"')+btn('＋ 添加文件夹','pick-folder','data-id="'+esc(p.id)+'"')+'</div></div><div class="file-grid">'+(links.map((l,i)=>{
  const info=fileType(l),main=l.isPrimary||(!links.some(v=>v.isPrimary)&&l===(links.find(x=>x.type==='file')||links[0]));
  return '<div class="file-tile '+(main?'is-primary':'')+'"><div class="file-tile-head"><div class="file-tile-icon">'+info.icon+'</div><div class="file-tile-name"><strong title="'+esc(l.path)+'">'+esc(fileName(l.path))+'</strong><span>'+esc(info.type)+'</span></div>'+(main?'<span class="primary-mark">默认入口</span>':'')+'</div><div class="file-tile-path" title="'+esc(l.path)+'">'+esc(l.path)+'</div><div class="file-tile-actions">'+btn('打开','open-path','data-path="'+esc(l.path)+'" class="primary"')+btn('定位','reveal','data-path="'+esc(l.path)+'"')+(main?'':btn('设为默认','set-primary','data-id="'+esc(p.id)+'" data-index="'+i+'"'))+btn('移除','remove-link','data-id="'+esc(p.id)+'" data-index="'+i+'" title="只删除关联信息"')+'</div></div>';
 }).join('')||'<div class="empty-drawer"><div class="empty-icon">📁</div><h3>你的工程文件会显示在这里</h3><p>先关联一个 SolidWorks / ANSYS / Unity 主工程文件，之后就可以一键打开。</p>'+btn('添加第一个工程文件','pick-file','data-id="'+esc(p.id)+'" class="primary"')+'</div>')+'</div><div class="project-tasks"><div class="row-between"><h3>项目验收进度</h3><span class="pill">'+(n===null?'尚未设置':n+'% 已验收')+'</span></div><div class="progress"><div style="width:'+(n||0)+'%"></div></div><div class="toolbar"><input id="new-task" placeholder="例如：检查网格质量、完成装配验证">'+btn('添加验收任务','add-task','data-id="'+esc(p.id)+'"')+'</div><div class="listing">'+((p.tasks||[]).map(t=>'<label class="list-item task"><span><input type="checkbox" data-act="toggle-task" data-id="'+esc(p.id)+'" data-task="'+esc(t.id)+'" '+(t.verified?'checked':'')+'> '+esc(t.title)+'</span><span class="pill">'+(t.verified?'已验收':'待验收')+'</span></label>').join('')||'<div class="empty">还没有验收任务。仅确认完成的项目任务才计入进度。</div>')+'</div></div>'+progressReview(p)+projectArchive(p)+'</section>';
}
function progressReview(p){
 const report=p.aiReview;
 return '<section class="ai-progress-review"><div class="row-between"><div><h3>✧ AI 进度评估</h3><p class="muted">分析本项目已保存的聊天与长期记忆，仅作为待审核建议。</p></div>'+btn('根据聊天评估进度','analyze-progress','data-id="'+esc(p.id)+'" class="primary"')+'</div><label class="inline-check"><input type="checkbox" id="progress-include-history"> 授权本次分析使用已关联的 ChatGPT 历史摘录（将向所选模型传输相关文字）</label>'+(report?'<div class="ai-review-summary"><span class="pill">'+esc(report.stage||'待核实')+'</span><p>'+esc(report.summary||'暂无概述')+'</p><p class="muted">'+esc(report.sourceWarning||'结果须人工确认')+'</p></div><div class="review-grid">'+(report.items||[]).map((item,i)=>'<article class="review-item"><div class="row-between"><strong>'+esc(item.title)+'</strong><span class="pill">'+esc(item.status)+'</span></div><p class="muted">证据：'+esc(item.evidence)+'</p><p class="muted">AI 评估把握度 '+Number(item.confidence||0)+'% · 不代表实际完成率</p>'+(item.reviewed?'<span class="pill">已审核</span>':'<div class="toolbar">'+btn('加入待办','accept-progress','data-id="'+esc(p.id)+'" data-index="'+i+'"')+(item.status==='已完成待确认'?btn('确认已完成','verify-progress','data-id="'+esc(p.id)+'" data-index="'+i+'" class="primary"'):'')+'</div>')+'</article>').join('')+'</div>':'<div class="empty">尚无 AI 进度评估。导入或关联项目聊天后，点击“根据聊天评估进度”。</div>')+'</section>';
}
function projects(){return breadcrumb('工程项目','每个项目有独立的文件抽屉、主工程入口和验收进度。')+'<div class="toolbar">'+btn('＋ 新建项目','create-project','class="primary"')+'</div><div class="cards">'+(db.projects.map(p=>projectCard(p)).join('')||'<div class="empty card">暂无工程项目。你可以自由创建，不限制项目数量。</div>')+'</div>'+(pid?projectDetail():'')}
function files(){return breadcrumb('智能文件柜','优先人工映射；支持授权目录扫描。所有工程原文件保持原位。')+'<div class="panel"><h3>已授权扫描目录</h3><div class="toolbar">'+btn('＋ 授权文件夹','add-root')+'</div><div class="muted">'+(db.roots||[]).map(x=>'<div class="file-path">📁 '+esc(x)+'</div>').join('')+'</div><p class="muted">当前版本只记录授权目录，不自动移走文件。AI 归属建议需经过核对。</p></div>'+db.projects.map(p=>'<div class="panel"><div class="row-between"><h3>📂 '+esc(p.name)+'</h3><div class="toolbar">'+btn('添加目录','pick-folder','data-id="'+esc(p.id)+'"')+btn('添加文件','pick-file','data-id="'+esc(p.id)+'"')+'</div></div>'+((p.links||[]).map((l,i)=>'<div class="list-item"><span>'+esc(l.path)+'</span><div class="actions">'+btn('打开','open-path','data-path="'+esc(l.path)+'"')+btn('定位','reveal','data-path="'+esc(l.path)+'"')+btn('取消映射','remove-link','data-id="'+esc(p.id)+'" data-index="'+i+'"')+'</div></div>').join('')||'<p class="muted">暂无关联文件</p>')+'</div>').join('')}
function work(){return breadcrumb('工作任务','既能管理工程，也能记录课程、学习、科研和其他日常工作。')+'<div class="panel"><h3>添加新的工作</h3><div class="toolbar"><input id="work-title" placeholder="输入要完成的工作">'+btn('＋ 添加工作','create-work','class="primary"')+'</div></div><div class="panel"><h3>工作清单</h3>'+((db.works||[]).map(w=>'<label class="list-item task"><span><input type="checkbox" data-act="toggle-work" data-id="'+esc(w.id)+'" '+(w.done?'checked':'')+'> '+esc(w.title)+'</span><span class="pill">'+(w.done?'已完成':'进行中')+'</span></label>').join('')||'<div class="empty">当前没有工作任务。</div>')+'</div>'}
function apps(){
 const kinds=['常用','工程设计','学习办公','开发工具','其他','全部'];
 let items=db.apps||[];
 if(appKind==='常用')items=items.filter(x=>x.pinned);else if(appKind!=='全部')items=items.filter(x=>x.kind===appKind);
 if(query)items=items.filter(x=>(x.name+' '+x.path).toLowerCase().includes(query.toLowerCase()));
 return breadcrumb('软件启动中心','直接使用 Windows 已安装软件的真实图标，让常用软件像桌面 Dock 一样清晰好找。')+'<div class="app-controls"><div class="toolbar">'+btn('◎ 重新扫描应用','scan-apps','class="primary"')+'<input id="app-search" aria-label="搜索软件" placeholder="搜索软件名，例如 SolidWorks、Unity、ANSYS…" value="'+esc(query)+'"></div><div class="app-filters">'+kinds.map(k=>'<button type="button" data-act="app-kind" data-kind="'+k+'" class="'+(k===appKind?'primary':'')+'">'+k+'</button>').join('')+'</div><p class="muted">图标来自 Windows 程序或快捷方式的目标文件。点击星标收藏，保留你最常用的工程与学习软件。</p></div><div class="cards app-grid">'+(items.slice(0,180).map(x=>'<article class="card app-card"><div class="app-head"><div class="app-icon" data-app-icon="'+esc(x.id)+'"><span>'+esc(x.name.slice(0,1).toUpperCase())+'</span></div><div class="app-ident"><h3 title="'+esc(x.name)+'">'+esc(x.name)+'</h3><span class="pill">'+esc(x.kind)+'</span></div></div><p class="app-path" title="'+esc(x.path)+'">'+esc(x.path)+'</p><div class="actions">'+btn('▷ 启动应用','run-app','data-id="'+esc(x.id)+'" class="primary"')+btn(x.pinned?'★ 已收藏':'☆ 收藏','pin-app','data-id="'+esc(x.id)+'"')+'</div></article>').join('')||'<div class="empty-drawer"><h3>这里暂时没有软件</h3><p>先扫描 Windows 开始菜单，再按类别查看并收藏常用软件。</p>'+btn('扫描应用','scan-apps','class="primary"')+'</div>')+'</div>';
}

const toolNames={modes:'一键工作模式',radar:'工程文件雷达',versions:'版本树与快照',health:'工作站自检',github:'GitHub 构建',report:'阶段报告',graph:'工程知识关系'};
function modePanel(){
 return '<div class="cards mode-grid">'+modeData.map(m=>'<article class="card mode-card"><div class="mode-emoji">'+m.icon+'</div><h3>'+esc(m.title)+'</h3><p>'+esc(m.hint)+'</p>'+btn(modeChoice===m.id?'当前选择':'选择模式','mode-choice','data-mode="'+esc(m.id)+'" class="'+(modeChoice===m.id?'primary':'')+'"')+'</article>').join('')+'</div>'+
 '<div class="panel mode-preview"><h3>启动前预览 · '+esc(modePreview?.title||'请选择工作模式')+'</h3><p class="muted">只会打开你在下方选中的软件和文件，启动前需要你确认。不会自动运行未知脚本。</p><div class="columns">'+
 '<div class="field"><label>当前工作项目</label><select id="mode-project"><option value="">不关联项目</option>'+projectOptions(pid)+'</select></div>'+
 '<div class="field"><label>工作模式</label><select id="mode-id">'+modeData.map(m=>'<option value="'+esc(m.id)+'" '+(m.id===modeChoice?'selected':'')+'>'+esc(m.title)+'</option>').join('')+'</select></div></div>'+
 '<div class="toolbar">'+btn('分析推荐的启动项目','mode-preview','class="primary"')+'</div>'+
 (modePreview?'<div class="columns"><div class="field"><label>要打开的软件（可不选）</label><select id="mode-app"><option value="">不启动软件</option>'+modePreview.apps.map(x=>'<option value="'+esc(x.id)+'">'+esc(x.name)+'</option>').join('')+'</select></div><div class="field"><label>要打开的工程文件（可不选）</label><select id="mode-file"><option value="">不打开文件</option>'+modePreview.files.map(x=>'<option value="'+esc(x.path)+'">'+esc(x.name)+'</option>').join('')+'</select></div></div><div class="toolbar">'+btn('确认并启动工作模式','mode-start','class="primary"')+'</div>':'<div class="empty">选择项目与工作模式后，点击“分析推荐的启动项目”。</div>')+'</div>';
}
function radarPanel(){
 const files=(radarData.files||[]).filter(x=>!radarQuery||(x.name+' '+x.path+' '+x.type).toLowerCase().includes(radarQuery.toLowerCase()));
 return '<div class="panel"><div class="row-between"><div><h3>🔎 已授权的工程文件雷达</h3><p class="muted">只读取授权工程目录中的文件名称、时间和大小，最多扫描 700 项。不修改任何工程。</p></div>'+btn('扫描授权目录','radar-scan','class="primary"')+'</div><div class="toolbar"><input id="radar-search" placeholder="搜索工程文件、类型、版本…" value="'+esc(radarQuery)+'"><select id="radar-project" aria-label="文件映射目标项目"><option value="">请选择要关联的项目</option>'+projectOptions(pid)+'</select></div><p class="muted">上次扫描：'+esc(radarData.scannedAt?radarData.scannedAt.slice(0,19).replace('T',' '):'尚未扫描')+' · 找到 '+(radarData.files?.length||0)+' 项'+(radarData.limitReached?' · 已达到数量上限':'')+'</p>'+(radarData.warnings?.length?'<p class="warning-text">有 '+radarData.warnings.length+' 个目录或文件需要检查。</p>':'')+'</div>'+
 '<div class="panel"><h3>文件列表 · '+files.length+' 项</h3><div class="radar-list">'+files.slice(0,130).map(x=>'<div class="radar-item"><div class="radar-item-main"><strong>'+esc(x.name)+'</strong><div class="muted">'+esc(x.type)+' · '+Math.round(x.size/1024)+' KB · '+esc(x.modifiedAt.slice(0,16).replace('T',' '))+'</div><div class="radar-path">'+esc(x.path)+'</div><small>建议归属：'+esc(x.projectName||'尚未确定')+(x.confidence?'（'+x.confidence+'%）':'')+' · '+esc(x.reason)+'</small></div><div class="actions">'+btn('打开','open-path','data-path="'+esc(x.path)+'"')+btn('加入所选项目','radar-link','data-path="'+esc(x.path)+'" class="primary"')+'</div></div>').join('')||'<div class="empty">暂无结果。先在智能文件柜授权扫描目录，或在项目中映射工程文件夹，再点击扫描。</div>'+'</div></div>';
}
function versionsPanel(){
 return '<div class="panel"><div class="row-between"><div><h3>📦 工程版本关系</h3><p class="muted">按文件名中的 V15 / V16 / V17 等版本标记分组，版本顺序是启发式识别，不等于内容差异验证。</p></div>'+btn('重新识别版本','versions-refresh','class="primary"')+'</div></div>'+
 (versionGroups.length?'<div class="cards">'+versionGroups.slice(0,40).map((g,i)=>'<div class="card"><span class="pill">版本组 '+(i+1)+'</span><h3>'+esc(g[0]?.name.replace(/v\d+(?:[._-]\d+)*/i,'V…')||'未知工程')+'</h3>'+g.map(f=>'<div class="version-row"><div><strong>'+esc(f.version)+'</strong><small>'+esc(f.name)+'</small></div>'+btn('打开','open-path','data-path="'+esc(f.path)+'"')+'</div>').join('')+'</div>').join('')+'</div>':'<div class="panel empty">尚无多个版本的匹配记录。扫描包含多个 V 版本的文件夹后再识别。</div>')+
 '<div class="panel"><h3>安全快照</h3><p class="muted">在“工程项目 → 项目档案 → 文件快照”中手动备份已关联的单个工程文件（最大 250MB）。不自动覆盖原工程。</p>'+btn('返回工程项目','nav','data-id="projects"')+'</div>';
}
function healthPanel(){
 return '<div class="panel"><div class="row-between"><div><h3>🛡 工作站功能自检</h3><p class="muted">检查工程路径、数据库结构、AI 配置和内存。不会自动清理系统盘。</p></div>'+btn('运行自检','health-refresh','class="primary"')+'</div>'+(healthData?'<div class="health-score">'+healthData.passed+' / '+healthData.total+' 项通过</div><p class="muted">检测时间：'+esc(healthData.time?.replace('T',' ').slice(0,19))+'</p><div class="health-check-list">'+healthData.checks.map(c=>'<div class="health-item"><span class="'+(c.ok?'healthy':'attention')+'">'+(c.ok?'✓':'!')+'</span><div><strong>'+esc(c.title)+'</strong><small>'+esc(c.detail)+'</small></div></div>').join('')+'</div>':'<div class="empty">点击“运行自检”查看状态。配置未完成将显示提醒，不代表程序损坏。</div>')+'</div>';
}
function githubPanel(){
 return '<div class="panel"><div class="row-between"><div><h3>⛭ GitHub Windows 构建状态</h3><p class="muted">读取 modelhub 仓库的 NEXUS 自动构建结果，不需要 GitHub Token。</p></div>'+btn('刷新构建状态','github-refresh','class="primary"')+'</div><div class="toolbar">'+btn('打开 GitHub 项目','github-open','data-url="https://github.com/1763107202-afk/modelhub"')+'</div>'+ (githubError?'<p class="warning-text">'+esc(githubError)+'</p>':'')+(githubRuns.length?'<div class="build-list">'+githubRuns.map(run=>'<div class="build-item"><div><strong>'+esc(run.name)+'</strong><small>'+esc(run.createdAt?.slice(0,19).replace('T',' '))+' · '+esc(run.sha?.slice(0,8))+'</small></div><div class="actions"><span class="pill">'+esc(run.conclusion||run.status)+'</span>'+btn('查看记录','github-open','data-url="'+esc(run.htmlUrl)+'"')+'</div></div>').join('')+'</div>':'<div class="empty">尚未读取构建数据，点击刷新。若网络不可访问，会显示具体错误。</div>')+'</div>'+
 '<div class="panel"><div class="row-between"><div><h3>🔧 本地仿真日志诊断</h3><p class="muted">选择 ANSYS、Fluent 或 Unity 的日志文件，离线查找关键错误。不会自动上传日志到任何 AI 平台。</p></div>'+btn('选择日志并分析','logs-pick','class="primary"')+'</div>'+(logReport?'<div class="ai-review-summary"><strong>'+esc(logReport.title)+'</strong><p>'+esc(logReport.note)+'</p><p class="muted">共 '+logReport.lines+' 行，发现 '+logReport.findings.length+' 个可能需要检查的线索。</p></div><div class="review-grid">'+logReport.findings.map(f=>'<div class="review-item"><div class="row-between"><strong>'+esc(f.tool)+' · 第 '+f.line+' 行</strong><span class="pill">'+esc(f.severity)+'</span></div><p>'+esc(f.excerpt)+'</p><p class="muted">'+esc(f.advice)+'</p></div>').join('')+'</div><div class="toolbar">'+btn('复制诊断并切换 AI','logs-ask-ai')+'</div>':'<div class="empty">可选择 .log、.txt、.out、.err 文件。扫描后展示线索及建议，仍需复核工程结果。</div>')+'</div>';
}
function reportPanel(){
 return '<div class="panel"><h3>📑 AI 工程档案与阶段报告</h3><p class="muted">根据当前本地项目任务、时间线、已关联文件和 AI 进度建议生成报告。请自行核对真实性。</p><div class="columns"><div class="field"><label>选择项目</label><select id="report-project">'+projectOptions(pid)+'</select></div><div class="field"><label>报告格式</label><select id="report-format"><option value="docx">Word (.docx)</option><option value="pdf">PDF (.pdf)</option><option value="md">Markdown (.md)</option></select></div></div><div class="toolbar">'+btn('导出项目阶段报告','report-export','class="primary"')+'</div><p class="muted">报告由本机生成，不会把项目文件发给云端。已验收和 AI 建议会分别标识。</p></div>';
}
function graphPanel(){
 return '<div class="panel"><div class="row-between"><div><h3>◎ 项目知识关系</h3><p class="muted">把项目、任务、文件和历史对话画成可读的关系图，不虚构文件之间的因果关联。</p></div>'+btn('生成关系图','graph-load','class="primary"')+'</div><div class="toolbar"><label>项目</label><select id="graph-project">'+projectOptions(pid)+'</select></div></div>'+
 (projectGraph?'<div class="panel graph-panel"><div class="graph-center">◆ '+esc(projectGraph.nodes?.[0]?.title||'当前项目')+'</div><div class="graph-branches">'+(projectGraph.nodes||[]).slice(1,100).map(n=>'<div class="graph-leaf"><span class="pill">'+esc(n.type)+'</span><strong>'+esc(n.title)+'</strong></div>').join('')+'</div><p class="muted">'+esc(projectGraph.description||'')+'</p></div>':'<div class="panel empty">选择项目后生成图谱。节点来源于本地明确存在的关联资料。</div>');
}
function tools(){
 const tabs=Object.entries(toolNames);
 const panel={modes:modePanel,radar:radarPanel,versions:versionsPanel,health:healthPanel,github:githubPanel,report:reportPanel,graph:graphPanel}[toolTab]||modePanel;
 return breadcrumb('效率工具中心','一个地方进入工作模式、工程扫描、版本快照、状态监测和报告管理。')+
 '<div class="tools-nav">'+tabs.map(([key,label])=>'<button data-act="tool-tab" data-tool="'+key+'" class="'+(toolTab===key?'primary':'')+'">'+label+'</button>').join('')+'</div>'+panel();
}
function projectArchive(p){
 const tabs=[['timeline','项目时间线'],['snapshots','文件快照'],['graph','知识关系']];
 let body='';
 if(projectTab==='timeline')body=projectEvents.length?'<div class="timeline-list">'+projectEvents.slice(0,70).map(it=>'<div class="timeline-event"><span class="timeline-dot"></span><div><strong>'+esc(it.title)+'</strong><small>'+esc(it.time?.slice(0,16).replace('T',' '))+' · '+esc(it.source)+'</small><p>'+esc(it.details||'')+'</p></div></div>').join('')+'</div>':'<div class="empty">点击刷新，查看工程创建、聊天历史、任务与 AI 评估节点。</div>';
 if(projectTab==='snapshots')body='<div class="toolbar"><select id="snapshot-file"><option value="">选择要备份的主工程文件</option>'+(p.links||[]).filter(x=>x.type==='file').map(x=>'<option value="'+esc(x.path)+'">'+esc(fileName(x.path))+'</option>').join('')+'</select>'+btn('手动保存快照','snapshot-create','data-id="'+esc(p.id)+'" class="primary"')+'</div><p class="muted">单文件限 250MB，备份保存至本机 NEXUS 私有目录，不影响源工程。</p>'+(projectSnapshots.map(x=>'<div class="list-item"><span><strong>'+esc(fileName(x.source))+'</strong><small>'+esc(x.createdAt.slice(0,19).replace('T',' '))+' · '+Math.round(x.size/1024)+' KB</small></span>'+btn('定位备份','snapshot-reveal','data-id="'+esc(p.id)+'" data-snapshot="'+esc(x.id)+'"')+'</div>').join('')||'<div class="empty">还没有保存工程快照。</div>');
 if(projectTab==='graph')body=projectGraph?'<div class="graph-center">◆ '+esc(p.name)+'</div><div class="graph-branches">'+(projectGraph.nodes||[]).slice(1,85).map(n=>'<div class="graph-leaf"><span class="pill">'+esc(n.type)+'</span><strong>'+esc(n.title)+'</strong></div>').join('')+'</div>':'<div class="empty">点击刷新加载当前项目的文件、任务与聊天关系。</div>';
 return '<section class="project-archive"><div class="row-between"><div><h3>工程档案</h3><p class="muted">时间线、备份版本与关联知识可追溯。</p></div>'+btn('刷新当前档案','project-archive-refresh','data-id="'+esc(p.id)+'"')+'</div><div class="tools-nav">'+tabs.map(([key,title])=>'<button data-act="project-archive-tab" data-view="'+key+'" class="'+(projectTab===key?'primary':'')+'">'+title+'</button>').join('')+'</div>'+body+'</section>';
}

function ai(){
 const options=Object.keys(profiles).map(x=>'<option '+(settings.provider===x?'selected':'')+'>'+esc(x)+'</option>').join('');
 return breadcrumb('NEXUS AI · 工程助手','聊天悬浮窗、项目上下文、多模型服务；发送截图和聊天历史必须由你主动确认。')+'<div class="columns chat-area"><section class="panel ai-settings float-hide"><h3>01 · 模型与接口</h3><div class="field"><label>服务平台</label><select id="provider">'+options+'</select></div><div class="field"><label>接口地址</label><input id="endpoint" value="'+esc(settings.endpoint||'')+'" spellcheck="false"></div><div class="field"><label>模型 ID</label><input id="model-id" value="'+esc(settings.model||'')+'" spellcheck="false"></div><div class="field"><label>API Key '+(settings.hasKey?'（已保存，可留空）':'（未配置）')+'</label><input id="api-key" type="password" placeholder="仅输入新密钥时才会覆盖原密钥" autocomplete="off"></div>'+btn('保存 AI 配置','settings-save','class="primary"')+btn('清除此平台密钥','clear-key')+'<p class="muted">密钥只存本机 Windows 加密存储。云端 AI 需要该平台的 API 额度。</p><h3>02 · 项目记忆</h3>'+btn('导入 ChatGPT conversations.json','history-import')+'<p class="muted">一键打开 ChatGPT 官方导出入口，在官网“设置 → 数据控制 → 导出数据”申请导出；收到 ZIP 后直接选择整个压缩包。</p><div class="toolbar">'+btn('① 打开 ChatGPT 官网','open-chatgpt')+btn('② 导入官方 ZIP / JSON','history-import')+'</div><h3>03 · 当前项目长期记忆</h3><p class="muted">只对当前选中项目生效，可记录版本、决策、待解决问题和下一步计划。</p><textarea id="project-notes" placeholder="填写已核实的项目长期资料、方案和进度，模型在本项目聊天时自动参考。">'+esc(notesText)+'</textarea><div class="toolbar">'+btn('保存项目记忆','memory-save','class="primary"')+'</div><div class="history-list">'+historyItems.slice(0,60).map(h=>'<div class="history-row"><span>'+esc(h.title)+(h.suggestionProjectId&&!h.projectId?' <small class="muted">· 建议归属：'+esc(db.projects.find(p=>p.id===h.suggestionProjectId)?.name||'未知项目')+'（请核对）</small>':'')+'</span><select data-history="'+esc(h.id)+'"><option value="">未关联项目</option>'+projectOptions(h.projectId)+'</select></div>').join('')+'</div></section><section class="panel"><div class="row-between"><h3>✧ 与 AI 对话</h3><span class="pill">'+esc(settings.provider||'未设置')+' · '+esc(settings.model||'未选模型')+'</span></div><div class="field"><label>关联项目（可选）</label><select id="chat-project"><option value="">不关联项目</option>'+projectOptions(pid)+'</select></div><label class="inline-check"><input type="checkbox" id="include-history" '+(historyAllowed?'checked':'')+'> 允许本次消息包含本地历史项目摘录</label><div class="chat-log" id="chat-log" aria-live="polite">'+chatMessages.map(m=>'<div class="bubble '+(m.role==='user'?'user':m.role==='error'?'error':'')+'"><small>'+({'user':'我','assistant':'NEXUS AI','error':'请求失败'}[m.role])+'</small><div>'+esc(m.text)+'</div></div>').join('')+'</div><div id="chat-status" class="status">'+esc(activeError)+'</div><div id="image-box">'+(uploadImage?'<div class="image-preview"><img class="preview" id="screenshot-preview" src="'+esc(uploadImage)+'" alt="待发送截图">'+btn('标注截图','annotate-image')+btn('移除截图','remove-image')+'<p class="muted">发送前请确认截图不包含私密信息。</p></div>':'')+'</div><textarea class="chat-input" id="chat-input" placeholder="例如：这个 Fluent 边界为什么为零？也可以粘贴 Win+Shift+S 的截图。">'+esc(chatDraft)+'</textarea><div class="toolbar">'+btn('截取屏幕','capture')+btn('指定窗口截图','window-picker')+btn('清空对话','clear-chat')+btn(busy?'正在请求…':'发送问题','send-chat','class="primary" '+(busy?'disabled':''))+'</div><p class="muted">截图仅在你点击发送后上传至所选模型；不支持图片的模型请先切换。</p></section></div>';
}
function settingsPage(){return breadcrumb('设置与数据','所有数据保存在本机，工程源文件不会自动移动。')+'<div class="panel"><h3>应用设置</h3><p>当前客户端：PROJECT NEXUS · Electron 中文桌面版</p><p class="muted">F11 及右上角按钮可切换全屏。AI 悬浮窗口可置顶其他软件。</p>'+btn('AI 模型设置','navigate-ai')+'</div><div class="panel"><h3>数据与隐私</h3><p class="muted">工程映射仅存储本地路径；聊天导出必须由你主动选择；API Key 用 Windows 安全存储加密。请勿将私人聊天、截图、密钥上传到公开 GitHub 仓库。</p></div>'}
function render(){frame();$('section-title').textContent={home:'指挥中心',projects:'工程项目',files:'智能文件柜',work:'工作中心',apps:'软件启动台',ai:'NEXUS AI',tools:'效率工具',settings:'设置与数据'}[page]||'指挥中心';$('content').innerHTML={home,projects,files,work,apps,ai,tools,settings:settingsPage}[page]();if(page==='ai'){const box=$('chat-log');box.scrollTop=box.scrollHeight;const input=$('chat-input');input?.focus()}if(page==='apps')loadVisibleAppIcons()}
async function loadVisibleAppIcons(){const nodes=[...document.querySelectorAll('[data-app-icon]')].slice(0,90);for(const node of nodes){const id=node.dataset.appIcon;try{const src=await api.getAppIcon(id);if(src&&node.isConnected){const img=document.createElement('img');img.src=src;img.alt='';img.loading='lazy';node.replaceChildren(img)}}catch{}}}

async function showWindowPicker(){
 const windows=await api.listWindows();
 if(!windows?.length)throw Error('没有找到允许捕获的窗口。请先打开工程软件，或改用 Win + Shift + S 区域截图');
 const bg=document.createElement('div');bg.className='modal-overlay screenshot-window-picker';
 bg.innerHTML='<div class="modal"><h2>选择需要分析的窗口</h2><p class="muted">只会截取你确认的窗口；发送给 AI 前还会显示预览。</p><select id="chosen-window">'+windows.map(w=>'<option value="'+esc(w.id)+'">'+esc(w.name)+'</option>').join('')+'</select><div class="toolbar"><button id="window-cancel">取消</button><button id="window-confirm" class="primary">截取所选窗口</button></div></div>';
 document.body.appendChild(bg);
 bg.querySelector('#window-cancel').onclick=()=>bg.remove();
 bg.querySelector('#window-confirm').onclick=async()=>{
  const button=bg.querySelector('#window-confirm');button.disabled=true;
  try{uploadImage=await api.captureWindow(bg.querySelector('#chosen-window').value);bg.remove();render();notify('已截取指定窗口，请确认内容后再发送给 AI');}
  catch(e){notify(safeErr(e),'error');button.disabled=false;}
 };
}
function showImageEditor(){
 if(!uploadImage)throw Error('请先截图或粘贴图片');
 const bg=document.createElement('div');bg.className='modal-overlay screenshot-editor';
 bg.innerHTML='<div class="editor-panel"><div class="row-between"><div><h3>截图标注</h3><p class="muted">使用红色画笔标记报错位置；只有点击“发送问题”才会上传。</p></div><div class="toolbar"><button id="undo-stroke">撤销一笔</button><button id="clear-stroke">清除标注</button><button id="cancel-editor">取消</button><button id="save-editor" class="primary">保存标注</button></div></div><div class="editor-scroll"><canvas id="editor-canvas" aria-label="工程截图标注画布"></canvas></div></div>';
 document.body.appendChild(bg);
 const canvas=bg.querySelector('canvas'),ctx=canvas.getContext('2d');
 if(!ctx){bg.remove();throw Error('当前设备不支持截图标注画布')}
 const image=new Image(),strokes=[];let current=null;
 const coords=e=>{const box=canvas.getBoundingClientRect();return{x:(e.clientX-box.left)*canvas.width/box.width,y:(e.clientY-box.top)*canvas.height/box.height}};
 const redraw=()=>{ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);ctx.strokeStyle='#ff6275';ctx.lineWidth=4;ctx.lineCap='round';ctx.lineJoin='round';
  for(const list of strokes){ctx.beginPath();ctx.moveTo(list[0].x,list[0].y);for(const p of list.slice(1))ctx.lineTo(p.x,p.y);if(list.length===1)ctx.lineTo(list[0].x+0.1,list[0].y+0.1);ctx.stroke()}
 };
 image.onload=()=>{const ratio=Math.min(1,1400/image.naturalWidth,900/image.naturalHeight);canvas.width=Math.max(1,Math.round(image.naturalWidth*ratio));canvas.height=Math.max(1,Math.round(image.naturalHeight*ratio));redraw()};
 image.onerror=()=>{bg.remove();notify('图片加载失败，请重新截图','error')};
 image.src=uploadImage;
 canvas.addEventListener('pointerdown',e=>{if(!canvas.width)return;e.preventDefault();current=[coords(e)];strokes.push(current);canvas.setPointerCapture(e.pointerId);redraw()});
 canvas.addEventListener('pointermove',e=>{if(!current)return;current.push(coords(e));redraw()});
 const finish=()=>{current=null};canvas.addEventListener('pointerup',finish);canvas.addEventListener('pointercancel',finish);
 bg.querySelector('#undo-stroke').onclick=()=>{strokes.pop();redraw()};
 bg.querySelector('#clear-stroke').onclick=()=>{strokes.length=0;redraw()};
 bg.querySelector('#cancel-editor').onclick=()=>bg.remove();
 bg.querySelector('#save-editor').onclick=()=>{if(!image.complete||!image.naturalWidth)return;uploadImage=canvas.toDataURL('image/jpeg',0.87);bg.remove();render();notify('截图标注已保存，请确认后再发送')};
}

function setPage(x){page=x;render()}

function openCommandPalette(){
 if($('nexus-commands')){$('command-search')?.focus();return}
 const shade=document.createElement('div');shade.id='nexus-commands';shade.className='command-shade';
 shade.innerHTML='<div class="command-dialog" role="dialog" aria-modal="true" aria-label="全局搜索与命令"><div class="command-top"><span>⌕</span><input id="command-search" placeholder="搜索项目、工程文件、软件、任务、历史…"><kbd>ESC</kbd></div><div id="command-results"></div><div class="command-footer">↑↓ 选择　Enter 执行　Esc 关闭</div></div>';
 document.body.appendChild(shade);
 shade.addEventListener('click',e=>{if(e.target===shade)shade.remove()});
 const input=$('command-search');let index=0;
 const items=[
 ...[{title:'指挥中心',id:'home'},{title:'工程项目',id:'projects'},{title:'智能文件柜',id:'files'},{title:'工作任务',id:'work'},{title:'软件启动台',id:'apps'},{title:'效率工具',id:'tools'},{title:'NEXUS AI',id:'ai'},{title:'设置与数据',id:'settings'}].map(x=>({...x,action:'page',subtitle:'打开页面'})),
 ...db.projects.map(p=>({id:p.id,action:'project',title:p.name,subtitle:'项目抽屉和时间线'})),
 ...db.projects.flatMap(p=>(p.links||[]).map(l=>({action:'file',id:l.path,title:fileName(l.path),subtitle:p.name+' · '+l.path}))),
 ...(db.apps||[]).map(a=>({action:'app',id:a.id,title:a.name,subtitle:'启动软件 · '+a.kind})),
 ...(db.works||[]).map(w=>({action:'work',id:'work',title:w.title,subtitle:'工作任务'})),
 ...(radarData.files||[]).slice(0,300).map(f=>({action:'file',id:f.path,title:f.name,subtitle:f.type+' · 扫描文件'})),
 ...(historyItems||[]).slice(0,100).map(h=>({action:'history',id:'ai',title:h.title,subtitle:'ChatGPT 已导入历史'}))
 ];
 function matches(){const q=input.value.trim().toLocaleLowerCase();return items.filter(it=>!q||(it.title+' '+it.subtitle).toLocaleLowerCase().includes(q)).slice(0,30)}
 function paint(){const list=matches();index=Math.max(0,Math.min(index,list.length-1));$('command-results').innerHTML=list.map((it,i)=>'<button type="button" data-command="'+i+'" class="command-item '+(i===index?'selected':'')+'"><span><strong>'+esc(it.title)+'</strong><small>'+esc(it.subtitle)+'</small></span><span>↗</span></button>').join('')||'<div class="empty">没有匹配结果。可尝试工程名称、文件扩展名或软件名。</div>'}
 function go(which){const it=matches()[which];if(!it)return;shade.remove();if(it.action==='page'||it.action==='work'||it.action==='history')return setPage(it.id);
 if(it.action==='project')return selectProject(it.id);
 if(it.action==='file')return execute(()=>api.openPath(it.id));
 if(it.action==='app')return execute(()=>api.runApp(it.id));
 }
 input.addEventListener('input',()=>{index=0;paint()});
 input.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();shade.remove()}
 else if(e.key==='ArrowDown'){e.preventDefault();index=Math.min(index+1,matches().length-1);paint()}
 else if(e.key==='ArrowUp'){e.preventDefault();index=Math.max(0,index-1);paint()}
 else if(e.key==='Enter'){e.preventDefault();go(index)}});
 $('command-results').addEventListener('click',e=>{const row=e.target.closest('[data-command]');if(row)go(Number(row.dataset.command))});
 input.focus();paint();
}

async function switchProject(id){pid=id;chatMessages=await api.getProjectChat(pid);notesText=await api.getMemory(pid);activeError='已切换项目，对话与长期记忆彼此隔离。';render()}
function askProjectName(){return new Promise(resolve=>{const bg=document.createElement('div');bg.className='modal-overlay';bg.innerHTML='<div class="modal"><h2>创建新的项目抽屉</h2><p class="muted">支持科研、工程、课程与任何新工作。</p><input id="modal-name" maxlength="100" placeholder="例如：桥梁有限元分析"><div class="toolbar"><button id="modal-cancel">取消</button><button id="modal-ok" class="primary">确认创建</button></div></div>';document.body.appendChild(bg);const done=v=>{bg.remove();resolve(v)};bg.querySelector('#modal-cancel').onclick=()=>done('');bg.querySelector('#modal-ok').onclick=()=>done(bg.querySelector('#modal-name').value.trim());bg.querySelector('#modal-name').addEventListener('keydown',e=>{if(e.key==='Enter')done(e.target.value.trim());if(e.key==='Escape')done('')});bg.querySelector('#modal-name').focus()})}
async function refresh(){db=await api.load();if(!pid&&db.projects?.length)pid=db.projects[0].id;render()}
async function execute(fn){try{await fn()}catch(e){const error=safeErr(e);notify(error,'error');if(page==='ai'){activeError=error;chatMessages.push({role:'error',text:error});render()}console.error(e)}}
async function ask(prompt){const value=String(prompt||'').trim();if(!value||busy)return;busy=true;chatDraft=value;activeError='正在等待模型响应…';chatMessages.push({role:'user',text:value});const payload={message:value,projectId:pid||'',includeHistory:historyAllowed,image:uploadImage||''};uploadImage='';chatDraft='';render();try{const result=await api.chat(payload);chatMessages=await api.getProjectChat(pid);activeError='已保存当前项目聊天 · 引用历史 '+result.usedHistory+' 条';}catch(e){activeError=safeErr(e);chatMessages.push({role:'error',text:activeError});}finally{busy=false;render()}}
document.addEventListener('input',e=>{if(e.target.id==='chat-input')chatDraft=e.target.value;if(e.target.id==='radar-search'){radarQuery=e.target.value;const start=e.target.selectionStart;render();const target=$('radar-search');target?.focus();target?.setSelectionRange(start,start)}if(e.target.id==='app-search'){query=e.target.value;const start=e.target.selectionStart;const end=e.target.selectionEnd;render();$('app-search')?.focus();$('app-search')?.setSelectionRange(start,end)}});
document.addEventListener('change',e=>{if(e.target.id==='include-history')historyAllowed=e.target.checked;if(e.target.id==='chat-project'){execute(()=>switchProject(e.target.value))}if(e.target.id==='project-notes')notesText=e.target.value;if(e.target.dataset.history){execute(async()=>{await api.assignHistory(e.target.dataset.history,e.target.value);historyItems=await api.listHistory();notify('历史记录已关联到项目，只有授权时才会发送摘要。')})}if(e.target.id==='provider'){const p=e.target.value;settings.provider=p;settings.endpoint=profiles[p]?.endpoint||'';settings.model=profiles[p]?.model||'';settings.hasKey=false;render()}if(e.target.dataset.act==='toggle-task')execute(async()=>{db=await api.toggleTask(e.target.dataset.id,e.target.dataset.task);render()});if(e.target.dataset.act==='toggle-work')execute(async()=>{db=await api.toggleWork(e.target.dataset.id);render()})});
document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();openCommandPalette();return}if(e.key==='Escape'&&$('nexus-commands')){$('nexus-commands').remove();return}if(e.key==='Enter'&&e.ctrlKey&&e.target.id==='chat-input'){e.preventDefault();execute(()=>ask(e.target.value))}if(e.key==='F11'){e.preventDefault();execute(()=>api.toggleFullscreen())}});
document.addEventListener('paste',e=>{if(page!=='ai')return;const item=[...(e.clipboardData?.items||[])].find(x=>x.type.startsWith('image/'));if(!item)return;e.preventDefault();const reader=new FileReader();reader.onload=()=>{uploadImage=String(reader.result);render();notify('已粘贴截图。发送前请确认隐私信息。')};reader.readAsDataURL(item.getAsFile())});
document.addEventListener('click',e=>{
 const el=e.target.closest('[data-act]');if(!el)return;const a=el.dataset.act,id=el.dataset.id;
 if(a==='nav'){setPage(id);return}if(a==='navigate-ai'){setPage('ai');return}if(a==='command-open'){openCommandPalette();return}
 execute(async()=>{
  switch(a){

   case 'tool-tab':toolTab=el.dataset.tool||'modes';render();return;
   case 'mode-choice':modeChoice=el.dataset.mode||'mechanical';modePreview=null;render();return;
   case 'mode-preview':{
    const chosen=$('mode-id')?.value||modeChoice;
    const projectId=$('mode-project')?.value||'';
    modeChoice=chosen;
    pid=projectId;
    modePreview=await api.previewMode(projectId,chosen);
    render();return;
   }
   case 'mode-start':{
    if(!modePreview)throw Error('请先查看当前工作模式的推荐项目');
    const appId=$('mode-app')?.value||'',filePath=$('mode-file')?.value||'';
    const projectId=$('mode-project')?.value||'';
    if(!appId&&!filePath)throw Error('至少选择一个软件或工程文件');
    if(!confirm('即将打开选中的软件和工程文件。确定继续吗？'))return;
    const started=await api.startMode(projectId,modePreview.id,appId,filePath);
    notify('已启动：'+started.opened.join('、'));return;
   }
   case 'radar-scan':radarData=await api.radarScan();render();notify('扫描完成，发现 '+radarData.files.length+' 项工程文件');return;
   case 'radar-link':{
    const projectId=$('radar-project')?.value||'';
    if(!projectId)throw Error('请先选择要将文件关联到哪个项目');
    const projectName=db.projects.find(x=>x.id===projectId)?.name||'项目';
    if(!confirm('将这个文件加入「'+projectName+'」的文件抽屉？\n不会复制或移动原文件。'))return;
    db=await api.radarLink(projectId,el.dataset.path);
    render();notify('已关联到：'+projectName);return;
   }
   case 'versions-refresh':versionGroups=await api.getVersions('');render();notify('已完成版本文件识别');return;
   case 'health-refresh':healthData=await api.healthCheck();render();notify('自检完成：'+healthData.passed+'/'+healthData.total+' 项通过');return;

   case 'logs-pick':{const result=await api.diagnoseLog();if(result.canceled)return;logReport=result;render();notify('日志分析已完成，发现 '+logReport.findings.length+' 个可能的问题');return}
   case 'logs-ask-ai':{
    if(!logReport)throw Error('请先选择日志文件');
    chatDraft='请根据以下来自本地日志的线索分析可能原因，并说明进一步检查步骤。不要把关键词匹配当作已经确定的故障。\n'+
    logReport.findings.slice(0,12).map(x=>x.tool+' 第'+x.line+'行：'+x.excerpt+'\n建议：'+x.advice).join('\n\n');
    setPage('ai');notify('诊断内容已放入聊天输入框，确认后再发送给模型');return;
   }
   case 'github-refresh':{
    githubError='';
    try{githubRuns=await api.getGitHubStatus();}catch(e){githubError=safeErr(e);githubRuns=[]}
    render();return;
   }
   case 'github-open':await api.openGitHub(el.dataset.url);return;
   case 'report-export':{
    const projectId=$('report-project')?.value||'';
    if(!projectId)throw Error('请先创建或选择项目');
    const output=await api.exportReport(projectId,$('report-format')?.value||'docx');
    if(!output.canceled)notify('报告已经导出：'+output.path);return;
   }
   case 'graph-load':{
    const projectId=$('graph-project')?.value||'';
    if(!projectId)throw Error('请先选择项目');
    pid=projectId;
    projectGraph=await api.getGraph(pid);
    render();return;
   }
   case 'project-archive-tab':{
    projectTab=el.dataset.view||'timeline';
    if(projectTab==='timeline')projectEvents=await api.getTimeline(pid);
    if(projectTab==='snapshots')projectSnapshots=await api.getSnapshots(pid);
    if(projectTab==='graph')projectGraph=await api.getGraph(pid);
    render();return;
   }
   case 'project-archive-refresh':{
    if(!pid)throw Error('尚未选择项目');
    if(projectTab==='timeline')projectEvents=await api.getTimeline(pid);
    if(projectTab==='snapshots')projectSnapshots=await api.getSnapshots(pid);
    if(projectTab==='graph')projectGraph=await api.getGraph(pid);
    render();return;
   }
   case 'snapshot-create':{
    const location=$('snapshot-file')?.value||'';
    if(!location)throw Error('请选择已关联的工程文件');
    if(!confirm('将对这个工程文件创建独立备份快照（不修改原件）。确定继续吗？'))return;
    await api.snapshotFile(pid,location);
    projectSnapshots=await api.getSnapshots(pid);
    render();notify('快照已保存到 NEXUS 本机私有目录');return;
   }
   case 'snapshot-reveal':await api.revealSnapshot(id,el.dataset.snapshot);return;
   case 'fullscreen-toggle':await api.toggleFullscreen();return;
   case 'float-open':await api.openFloat();return;
   case 'create-project':{const name=await askProjectName();if(!name)return;db=await api.createProject(name,'自定义项目');pid=db.projects.at(-1)?.id;render();return}
   case 'select-project':selectProject(id);return;
   case 'project-chat':await switchProject(id);setPage('ai');return;
   case 'set-primary':db=await api.setPrimaryLink(id,Number(el.dataset.index));render();notify('已设置为项目默认打开项');return;
   case 'analyze-progress':{const agree=$('progress-include-history')?.checked===true;const b=el;b.disabled=true;b.textContent='正在分析…';try{await api.assessProgress(id,{includeHistory:agree});db=await api.load();render();notify('已生成带证据的进度建议，等待审核');}finally{if(b.isConnected)b.disabled=false}return}
   case 'accept-progress':db=await api.acceptProgress(id,Number(el.dataset.index),false);render();notify('任务已加入待办，尚未验收');return;
   case 'verify-progress':if(!confirm('确认这项工作在工程中确已完成？确认后将计入项目进度。'))return;db=await api.acceptProgress(id,Number(el.dataset.index),true);render();notify('已人工确认完成并计入进度');return;
   case 'open-project':await api.openProject(id);return;
   case 'pick-folder':db=await api.pickFolder(id);render();return;
   case 'pick-file':db=await api.pickFile(id);render();return;
   case 'remove-link':if(!confirm('确定只取消这个映射吗？源文件不会被删除。'))return;db=await api.removeLink(id,Number(el.dataset.index));render();return;
   case 'open-path':await api.openPath(el.dataset.path);return;
   case 'reveal':await api.revealPath(el.dataset.path);return;
   case 'add-task':{const title=$('new-task')?.value;if(!title?.trim())throw Error('请输入验收任务名称');db=await api.addTask(id,title);render();return}
   case 'create-work':{const title=$('work-title')?.value;if(!title?.trim())throw Error('请输入工作名称');db=await api.createWork(title);render();return}
   case 'add-root':db=await api.addRoot();render();return;
   case 'scan-apps':db=await api.scanApps();appKind='工程设计';render();notify('扫描完成：请按分类查看与收藏');return;
   case 'app-kind':appKind=el.dataset.kind;render();return;
   case 'pin-app':db=await api.pinApp(id);render();return;
   case 'run-app':await api.runApp(id);return;
   case 'settings-save':{const payload={provider:$('provider').value,endpoint:$('endpoint').value,model:$('model-id').value,key:$('api-key').value};settings=await api.saveSettings(payload);render();notify('模型设置已保存，可以发送“你好”测试。');return}
   case 'history-import':{const result=await api.importHistory();historyItems=await api.listHistory();render();notify('新增 '+result.added+' 条，更新 '+result.updated+' 条，识别建议 '+result.suggested+' 条；请核对归属。');return}case 'open-chatgpt':await api.openChatGPTExport();return;case 'memory-save':{notesText=$('project-notes')?.value||'';await api.saveMemory(pid,notesText);notify('已保存当前项目的长期记忆');return}case 'clear-key':{if(!confirm('确定清除当前 AI 平台保存的密钥？'))return;await api.clearKey();settings.hasKey=false;render();notify('当前平台密钥已清除');return}
   case 'send-chat':await ask($('chat-input')?.value||chatDraft);return;
   case 'capture':{const image=await api.capture();uploadImage=image;render();notify('截图已预览，只有点击发送才会上传');return}
   case 'window-picker':await showWindowPicker();return;
   case 'annotate-image':showImageEditor();return;
   case 'remove-image':uploadImage='';render();return;
   case 'clear-chat':if(!confirm('永久清空当前项目的本地 AI 对话？其他项目不受影响。'))return;await api.clearProjectChat(pid);chatMessages=[];activeError='';render();return;
  }
 });
});
async function start(){try{profiles=await api.profiles();settings=await api.getSettings();db=await api.load();historyItems=await api.listHistory();try{radarData=await api.radarGet();modeData=await api.listModes();}catch(e){console.warn('部分扩展工具初始化失败：',e)}if(db.projects?.length)pid=db.projects[0].id;chatMessages=await api.getProjectChat(pid);notesText=await api.getMemory(pid);if(isFloat)page='ai';render()}catch(e){$('root').textContent='NEXUS 初始化失败：'+safeErr(e);console.error(e)}}
start();
