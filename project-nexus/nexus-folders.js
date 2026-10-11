'use strict';
const fs=require('node:fs'),path=require('node:path');
const SKIP=/^(\.git|\.vs|node_modules|Library|Temp|cache|\.cache|obj|bin|venv|__pycache__|System Volume Information|\$RECYCLE.BIN)$/i;
const MAX_ROOTS=12,MAX_FOLDERS=300;
function norm(v){return String(v||'').toLowerCase().replace(/[\s_\-]+/g,'')}
function rankFolder(folder,projects=[]){
 const name=norm(folder.name),full=norm(folder.path);
 let best={projectId:null,projectName:null,confidence:0,reason:'尚未识别项目'};
 for(const p of projects){
  const pname=norm(p.name);
  let score=0,reason='';
  if(pname.length>=3&&name===pname){score=97;reason='一级文件夹与项目名称完全匹配'}
  else if(pname.length>=3&&(name.includes(pname)||pname.includes(name))){score=80;reason='一级文件夹名称与项目匹配'}
  if((p.links||[]).some(l=>l.type==='folder'&&norm(l.path)===full)){score=100;reason='已人工关联工程文件夹'}
  if(score>best.confidence)best={projectId:p.id,projectName:p.name,confidence:score,reason};
 }
 return best;
}
function browseRoots(roots,projects=[]){
 const folders=[],warnings=[],seen=new Set();
 for(const root of (roots||[]).slice(0,MAX_ROOTS)){
  if(typeof root!=='string'||!path.isAbsolute(root)){warnings.push('无效授权目录：'+root);continue}
  let st;try{st=fs.statSync(root)}catch{warnings.push('授权目录不存在或不可读取：'+root);continue}
  if(!st.isDirectory()){warnings.push('不是文件夹：'+root);continue}
  let list;
  try{list=fs.readdirSync(root,{withFileTypes:true})}catch{warnings.push('无法列出授权目录：'+root);continue}
  for(const item of list){
   if(folders.length>=MAX_FOLDERS)break;
   if(!item.isDirectory()||item.isSymbolicLink()||SKIP.test(item.name)||item.name.startsWith('.'))continue;
   const target=path.join(root,item.name),id=target.toLowerCase();
   if(seen.has(id))continue;seen.add(id);
   let mod=null;
   try{mod=fs.statSync(target).mtime.toISOString()}catch{}
   const info={name:item.name,path:target,root,level:1,modifiedAt:mod};
   folders.push({...info,...rankFolder(info,projects)});
  }
  if(folders.length>=MAX_FOLDERS){warnings.push('一级工程目录过多，已限制显示前 '+MAX_FOLDERS+' 项');break}
 }
 return {folders:folders.sort((a,b)=>a.name.localeCompare(b.name,'zh-CN')),warnings,scannedAt:new Date().toISOString(),level:1,scoped:true};
}
function isListedFolder(folderPath,list){
 return (list?.folders||[]).some(x=>x.path===folderPath&&x.level===1);
}
module.exports={browseRoots,rankFolder,isListedFolder,MAX_FOLDERS};