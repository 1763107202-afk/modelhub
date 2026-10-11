'use strict';
const assert=require('node:assert/strict');
const m=require('./nexus-memory');
const samples=[
 {id:'x1',title:'桥梁桁架 ANSYS 网格',create_time:100,mapping:{a:{message:{author:{role:'user'},create_time:1,content:{parts:['桥梁网格重划']} }},b:{message:{author:{role:'assistant'},create_time:2,content:{parts:['建议局部细化']} }}}},
 {id:'x2',title:'Unity 船舶 VR',create_time:200,mapping:{a:{message:{author:{role:'user'},create_time:1,content:{parts:['船舶VR屏幕闪烁']} }}}}
];
const projects=[{id:'bridge',name:'桥梁桁架'},{id:'ship',name:'Unity 船舶 VR'}];
const converted=m.extractExport(samples);
assert.equal(converted.length,2);
assert.match(converted[0].snippet,/桥梁网格重划/);
const first=m.mergeHistory([],converted,projects);
assert.equal(first.added,2);
assert.equal(first.rows.find(x=>x.id==='x1').suggestionProjectId,'bridge');
first.rows.find(x=>x.id==='x1').projectId='bridge';
const second=m.mergeHistory(first.rows,converted,projects);
assert.equal(second.added,0);
assert.equal(second.updated,2);
assert.equal(second.rows.find(x=>x.id==='x1').projectId,'bridge');
const picked=m.chooseMemory(second.rows,'bridge','桥梁网格');
assert.equal(picked.length,1);
assert.equal(m.chooseMemory(second.rows,'ship','桥梁网格').length,0);
let store={};store=m.addTurn(store,'bridge','user','桥梁问题');store=m.addTurn(store,'ship','user','船舶问题');
assert.equal(m.getTurns(store,'bridge')[0].text,'桥梁问题');
const ctx=m.contextForProject({projectId:'bridge',question:'网格',turns:m.getTurns(store,'bridge'),notes:{bridge:'当前进行网格验证'},history:second.rows,includeHistory:true});
assert.match(ctx.system,/当前进行网格验证/);
assert.equal(ctx.historyHits,1);
assert.throws(()=>m.extractExport({}),/数组/);
console.log('PASS: 导入结构、去重、建议、项目隔离、对话上下文与输入校验');
