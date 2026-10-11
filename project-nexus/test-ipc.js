'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const main=fs.readFileSync('main.js','utf8'),preload=fs.readFileSync('preload.js','utf8');
const handles=new Set([...main.matchAll(/ipcMain\.handle\('([^']+)'/g)].map(x=>x[1]));
const calls=new Set([...preload.matchAll(/call\('([^']+)'/g)].map(x=>x[1]));
const missing=[...calls].filter(x=>!handles.has(x));
assert.deepEqual(missing,[],'These renderer actions do not have implemented desktop handlers');
for(const x of ['radar-scan','mode-preview','mode-start','timeline-get','graph-get','health-check','report-export','github-status','logs-pick','screen-capture-window','history-import','progress-analyze','snapshot-create'])
 assert(handles.has(x),'Missing critical handler '+x);
console.log('PASS: '+calls.size+' UI backend channels mapped to '+handles.size+' implemented handlers.');
