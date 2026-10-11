'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const F=require('./nexus-features');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'nexus-features-'));
try{
 const dir=path.join(root,'桥梁桁架');fs.mkdirSync(dir);
 const a=path.join(dir,'Bridge_V15.wbpj'),b=path.join(dir,'Bridge_V16.wbpj'),c=path.join(dir,'报告.docx');
 fs.writeFileSync(a,'test');fs.writeFileSync(b,'test');fs.writeFileSync(c,'test');
 fs.mkdirSync(path.join(dir,'node_modules'));fs.writeFileSync(path.join(dir,'node_modules','ignore.js'),'ignore');
 const project={id:'bridge',name:'桥梁桁架',createdAt:'2026-01-01T00:00:00.000Z',links:[{path:dir,type:'folder',date:'2026-01-02T00:00:00.000Z'}],tasks:[{title:'网格验证',verified:true,verifiedAt:'2026-01-04T00:00:00.000Z'}]};
 const files=F.radar([dir],[project],{maxFiles:10,maxDepth:2});
 assert.equal(files.files.length,3);assert.equal(files.files.find(x=>x.name==='Bridge_V16.wbpj').projectId,'bridge');
 assert.equal(F.versions(files.files).length,1);
 assert.equal(F.versions(files.files)[0][0].name,'Bridge_V16.wbpj');
 const timeline=F.timeline(project,[{projectId:'bridge',title:'已有记录',date:1770000000}],[{role:'user',text:'测试问题',time:'2026-01-03T00:00:00.000Z'}]);
 assert(timeline.some(x=>x.title.startsWith('聊天历史')));
 const graph=F.graph(project,[{projectId:'bridge',title:'桥梁进度'}]);
 assert(graph.nodes.length>=3);assert(graph.edges.length>=2);
 const health=F.health({projects:[project],works:[]},{endpoint:'https://api.example.com',model:'example'},[dir]);
 assert(health.total>=5);assert.equal(health.passed,health.total);
 const report=F.report(project,timeline,health);
 assert(report.includes('桥梁桁架'));assert(report.includes('网格验证'));assert(report.includes('AI 进度建议'));
 const bad=F.radar([path.join(root,'does_not_exist')],[project]);assert(bad.warnings.length>0);
 console.log('PASS: 有界文件扫描、版本识别、时间线、关系图、自检和报告');
}finally{fs.rmSync(root,{recursive:true,force:true})}
