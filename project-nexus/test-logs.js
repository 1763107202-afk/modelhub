'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {analyzeText,analyzeFile}=require('./nexus-log-diagnostics');
const a=analyzeText('Warning: reversed flow at pressure-outlet 2\nfloating point exception\n','fluent.log');
assert(a.findings.some(x=>x.id==='fluent-reverse'));
assert(a.findings.some(x=>x.id==='fluent-divergence'));assert(a.hasCritical);
const b=analyzeText('NullReferenceException: Object reference not set to an instance of an object','Editor.log');
assert.equal(b.findings[0].id,'unity-null');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'nexus-log-'));
try{
 const loc=path.join(temp,'mechanical.log');fs.writeFileSync(loc,'mesh failed\nsolver failed\n','utf8');
 assert(analyzeFile(loc).findings.length>=2);
 const evil=path.join(temp,'secret.exe');fs.writeFileSync(evil,'solver failed');
 assert.throws(()=>analyzeFile(evil),/仅支持/);
}finally{fs.rmSync(temp,{recursive:true,force:true})}
console.log('PASS: 本地 Fluent / ANSYS / Unity 日志解析、大小和扩展名约束');
