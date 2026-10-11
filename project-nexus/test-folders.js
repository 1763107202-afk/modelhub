'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const F=require('./nexus-folders');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'nexus-first-level-'));
try{
 const root=path.join(dir,'工程总目录');fs.mkdirSync(root);
 const a=path.join(root,'桥梁有限元'),b=path.join(root,'船舶数字化');
 fs.mkdirSync(a);fs.mkdirSync(b);
 fs.mkdirSync(path.join(a,'V15'));fs.writeFileSync(path.join(a,'V15','网格.wbpj'),'test');
 fs.mkdirSync(path.join(root,'node_modules'));
 const list=F.browseRoots([root],[{id:'1',name:'桥梁有限元',links:[]}]);
 assert.equal(list.folders.length,2);
 assert(!list.folders.some(x=>x.name==='V15'));
 assert(!list.folders.some(x=>x.name==='node_modules'));
 assert.equal(list.folders.find(x=>x.path===a).projectId,'1');
 assert(F.isListedFolder(a,list));
 assert(!F.isListedFolder(path.join(a,'V15'),list));
 assert(!F.isListedFolder(path.join(a,'V15','网格.wbpj'),list));
 assert(F.browseRoots([path.join(root,'missing')],[]).warnings.length>0);
 console.log('PASS: 仅显示授权一级工程目录、排除缓存和内部文件、校验归属');
}finally{fs.rmSync(dir,{recursive:true,force:true})}
