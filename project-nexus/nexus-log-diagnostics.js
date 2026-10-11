'use strict';
const fs=require('node:fs'),path=require('node:path');
const MAX_SIZE=8*1024*1024;
const rules=[
 {id:'fluent-divergence',tool:'Fluent',severity:'严重',pattern:/floating.point.exception|divergence detected|divergent solution|negative cell volume/i,advice:'检查网格质量、边界条件、物性参数和时间步；必要时降低松弛因子。'},
 {id:'fluent-reverse',tool:'Fluent',severity:'提醒',pattern:/reversed flow|backflow detected/i,advice:'检查出口位置、压力出口反向流设置及计算域长度。'},
 {id:'fluent-geometry',tool:'Fluent',severity:'严重',pattern:/non-conformal|mesh is not connected|unconnected.*zone/i,advice:'检查流体域拓扑是否联通、接触面是否共享、是否有非共形网格接口。'},
 {id:'ansys-mesh',tool:'ANSYS',severity:'严重',pattern:/mesh.*failed|failed to generate mesh|highly distorted element|mesh quality.*error/i,advice:'检查几何小面、干涉、接触面和网格尺寸并逐体排查。'},
 {id:'ansys-solver',tool:'ANSYS',severity:'严重',pattern:/solution.*failed|solver.*failed|pivot.*error|insufficient.*memory/i,advice:'先查看求解器输出、约束与接触设置，并核实物理内存和磁盘余量。'},
 {id:'unity-null',tool:'Unity',severity:'严重',pattern:/NullReferenceException|MissingReferenceException|ArgumentNullException/i,advice:'检查堆栈中的脚本、组件引用和场景对象生命周期。'},
 {id:'unity-build',tool:'Unity',severity:'严重',pattern:/BuildFailedException|gradle.*failed|failure: build failed|CommandInvokationFailure/i,advice:'检查 Editor.log / Gradle 构建错误、Android SDK、PICO 插件版本与依赖。'},
 {id:'unity-memory',tool:'Unity',severity:'严重',pattern:/OutOfMemoryException|not enough memory|out of memory/i,advice:'检查资源导入大小、材质纹理、缓存目录及构建输出的内存消耗。'},
 {id:'general-error',tool:'通用',severity:'提醒',pattern:/\b(error|fatal exception|fatal)\b|错误|失败/i,advice:'结合上下文检查实际报错起因，关键字本身不一定表示流程失败。'}
];
function analyzeText(text,label='日志',maxFindings=28){
 const lines=String(text||'').split(/\r?\n/),found=[],seen=new Set();
 for(let n=0;n<lines.length&&found.length<maxFindings;n++){
  const line=lines[n].trim();if(!line)continue;
  const rule=rules.find(r=>r.id!=='general-error'&&r.pattern.test(line))||rules.find(r=>r.id==='general-error'&&r.pattern.test(line));
  if(!rule)continue;
  const key=rule.id+'|'+line.slice(0,80);if(seen.has(key))continue;seen.add(key);
  found.push({id:rule.id,tool:rule.tool,severity:rule.severity,line:n+1,excerpt:line.slice(0,220),advice:rule.advice});
 }
 return {title:String(label).slice(0,140),lines:lines.length,findings:found,hasCritical:found.some(f=>f.severity==='严重'),checkedAt:new Date().toISOString(),
  note:'本地关键词筛查不等于完整求解器诊断。请结合前后文和真实工程结果复核。'};
}
function analyzeFile(file){
 if(typeof file!=='string'||!path.isAbsolute(file))throw Error('日志路径非法');
 const stat=fs.statSync(file);if(!stat.isFile())throw Error('只能检查普通日志文件');
 if(stat.size>MAX_SIZE)throw Error('日志大于 8 MB，请截取关键错误段后再分析');
 if(!/\.(log|txt|out|err)$/i.test(file))throw Error('仅支持 .log、.txt、.out、.err 日志文件');
 return {...analyzeText(fs.readFileSync(file,'utf8'),path.basename(file)),file,bytes:stat.size};
}
module.exports={analyzeText,analyzeFile};