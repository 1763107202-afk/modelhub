'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const EXTS=/\.(sldasm|sldprt|slddrw|wbpj|wbpz|cas|dat|h5|step|stp|stl|unity|blend|dwg|dxf|pdf|doc|docx|pptx|xlsx|json|csv|zip|ino|py|js|ts|cs|html)$/i;
const SKIP=/^(node_modules|\.git|\.vs|Library|Temp|obj|bin|Build|Builds|cache|\.cache|venv)$/i;
const norm=s=>String(s||'').toLowerCase().replace(/[\s_-]+/g,'');
function category(file){if(/\.sld(asm|prt|drw)$/i.test(file))return 'SolidWorks';if(/\.wbp(j|z)$/i.test(file))return 'ANSYS';if(/\.(cas|dat)(\.h5)?$/i.test(file))return 'Fluent';if(/\.unity$/i.test(file))return 'Unity';if(/\.(step|stp|stl|dwg|dxf)$/i.test(file))return '机械模型';if(/\.(pdf|docx?|pptx?|xlsx)$/i.test(file))return '文档报告';return '其他工程文件';}
function suggest(file,projects){const name=norm(file),choices=(projects||[]).map(p=>{let score=0,reason='';if(norm(p.name).length>=3&&name.includes(norm(p.name))){score=93;reason='路径包含项目名称';}for(const l of p.links||[]){const dir=norm(l.type==='folder'?l.path:path.dirname(l.path));if(dir.length>=8&&name.startsWith(dir)){score=99;reason='位于已映射工程目录';}}return {projectId:p.id,projectName:p.name,score,reason}}).sort((a,b)=>b.score-a.score);return choices[0]?.score>=70?choices[0]:null;}
function radar(roots,projects,{maxFiles=650,maxDepth=3}={}){maxFiles=Math.max(1,Math.min(1500,maxFiles));maxDepth=Math.max(0,Math.min(4,maxDepth));const files=[],warnings=[],seen=new Set();
 function scan(dir,depth){if(files.length>=maxFiles)return;let list;try{list=fs.readdirSync(dir,{withFileTypes:true});}catch{warnings.push('无法读取：'+dir);return}
 for(const item of list){if(files.length>=maxFiles)break;if(item.isSymbolicLink())continue;const full=path.join(dir,item.name);
 if(item.isDirectory()){if(depth<maxDepth&&!SKIP.test(item.name))scan(full,depth+1);continue}
 if(!item.isFile()||!EXTS.test(item.name))continue;
 if(seen.has(full.toLowerCase()))continue;seen.add(full.toLowerCase());try{const st=fs.statSync(full),guess=suggest(full,projects);files.push({path:full,name:item.name,type:category(full),size:st.size,modifiedAt:st.mtime.toISOString(),projectId:guess?.projectId||null,projectName:guess?.projectName||null,confidence:guess?.score||0,reason:guess?.reason||'无法确认项目归属'});}catch{warnings.push('文件无法访问：'+full);}
 }}
 for(const root of (roots||[]).slice(0,12)){try{if(path.isAbsolute(root)&&fs.statSync(root).isDirectory())scan(root,0);else warnings.push('非法或不可用目录：'+root);}catch{warnings.push('目录不可访问：'+root);}}
 return {files:files.sort((a,b)=>b.modifiedAt.localeCompare(a.modifiedAt)),warnings:warnings.slice(0,60),scannedAt:new Date().toISOString(),limitReached:files.length>=maxFiles};
}
function extractVersion(name){const match=String(name).match(/(?:^|[_. -])(?:v|ver|version|版本)\s*(\d+)(?:[._-](\d+))?(?:[._-](\d+))?/i);if(!match)return null;return {label:match[0].trim(),order:Number(match[1])*1000000+Number(match[2]||0)*1000+Number(match[3]||0)};}
function versions(files){const groups=new Map();for(const f of files||[]){const version=extractVersion(f.name);if(!version)continue;const base=String(f.name).replace(/(?:^|[_. -])(?:v|ver|version|版本)\s*\d+(?:[._-]\d+){0,2}/i,'').toLowerCase();const key=String(f.projectId||'unknown')+'|'+base;const list=groups.get(key)||[];list.push({name:f.name,path:f.path,version:version.label,order:version.order,modifiedAt:f.modifiedAt});groups.set(key,list)}return [...groups.values()].filter(g=>g.length>=2).map(g=>g.sort((a,b)=>b.order-a.order)).slice(0,80);}
function timeline(project,history=[],chat=[]){const items=[];const push=(time,title,source,details='')=>{let d=new Date(time);if(!Number.isNaN(d.getTime()))items.push({time:d.toISOString(),title:String(title).slice(0,130),source,details:String(details).slice(0,240)})};
 if(project.createdAt)push(project.createdAt,'创建工程项目','本地项目');
 for(const file of project.links||[])if(file.date||file.addedAt)push(file.date||file.addedAt,'关联文件：'+path.basename(file.path),'工程文件',file.path);
 for(const task of project.tasks||[]){if(task.createdAt)push(task.createdAt,'创建任务：'+task.title,'任务');if(task.verified&&task.verifiedAt)push(task.verifiedAt,'完成验收：'+task.title,'人工验收');}
 for(const record of history.filter(h=>h.projectId===project.id).slice(0,150)){if(Number(record.date)>0)push(Number(record.date)*1000,'聊天历史：'+record.title,'ChatGPT 导入');}
 for(const msg of chat.slice(-100))if(msg.time)push(msg.time,(msg.role==='user'?'发起问题：':'AI 回复：')+String(msg.text).slice(0,46),'NEXUS 聊天');
 if(project.aiReview?.createdAt)push(project.aiReview.createdAt,'AI 生成进度建议','进度评估',project.aiReview.summary);
 return items.sort((a,b)=>b.time.localeCompare(a.time)).slice(0,160);
}
function graph(project,history=[]){const nodes=[{id:'project',title:project.name,type:'工程'}],edges=[];function add(id,title,type){nodes.push({id,title,type});edges.push({from:'project',to:id})}
 (project.links||[]).slice(0,40).forEach((x,i)=>add('file'+i,path.basename(x.path),'工程文件'));
 (project.tasks||[]).slice(0,40).forEach((x,i)=>add('task'+i,x.title,x.verified?'已验收':'任务'));
 history.filter(h=>h.projectId===project.id).slice(0,40).forEach((x,i)=>add('chat'+i,x.title,'聊天历史'));
 return {nodes,edges,description:'仅显示已有项目关联，不自动推断额外事实'};}
function health(state,settings,roots){const checks=[],add=(title,ok,detail)=>checks.push({title,ok,detail});add('项目数据库',Array.isArray(state?.projects)&&Array.isArray(state?.works),'检查项目与工作数据结构');
 const ids=new Set((state.projects||[]).map(p=>p.id));add('项目 ID 唯一性',ids.size===(state.projects||[]).length,'防止项目 ID 冲突');
 let missing=0;for(const p of state.projects||[])for(const l of p.links||[])if(!fs.existsSync(l.path))missing++;add('工程文件路径',missing===0,missing+' 个失效路径');
 const bad=(roots||[]).filter(x=>!fs.existsSync(x));add('扫描目录',bad.length===0,bad.length+' 个不可用目录');
 add('AI 模型配置',!!settings?.endpoint&&!!settings?.model,settings?.model||'尚未配置（离线功能仍可使用）');
 const free=Math.round(os.freemem()/107374182.4)/10;add('系统可用内存',free>=2,'约 '+free+' GB');
 try{
  const root=process.platform==='win32'?(process.env.SystemDrive||'C:')+'\\':'/';
  if(typeof fs.statfsSync==='function'){
   const disk=fs.statfsSync(root),freeGB=Math.round(disk.bavail*disk.bsize/1073741824*10)/10;
   add('系统盘剩余空间',freeGB>=10,'系统盘可用约 '+freeGB+' GB；低于 10 GB 时建议检查 Unity、ANSYS 缓存');
  }
 }catch{add('系统盘空间',true,'此系统未提供可读取的磁盘信息（已跳过）')}
 return {checks,passed:checks.filter(x=>x.ok).length,total:checks.length,time:new Date().toISOString()};}
function report(project,events,check){let output='# NEXUS 项目阶段报告\n\n项目：'+project.name+'\n生成日期：'+new Date().toLocaleString('zh-CN')+'\n\n## 验收任务\n';
 for(const task of project.tasks||[])output+='- ['+(task.verified?'x':' ')+'] '+task.title.replace(/[\r\n]/g,' ')+'\n';
 output+='\n## 历史时间线\n';for(const item of events.slice(0,35))output+='- '+item.time.slice(0,16)+' '+item.title+'（'+item.source+'）\n';
 output+='\n## 工程文件\n';for(const file of (project.links||[]).slice(0,80))output+='- '+file.path+'\n';
 output+='\n## AI 进度建议（未必经过验收）\n'+String(project.aiReview?.summary||'暂无')+'\n';
 output+='\n## 工作站自检\n'+check.passed+'/'+check.total+' 项通过\n';for(const item of check.checks)output+='- '+item.title+'：'+item.detail+'\n';
 output+='\n注：聊天分析与文件索引不等同于实际仿真结果的验收。';return output.slice(0,150000);}
module.exports={radar,suggest,versions,extractVersion,timeline,graph,health,report,category};