'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {JSDOM}=require('jsdom');
const html=fs.readFileSync('index.html','utf8');
const renderer=fs.readFileSync('renderer.js','utf8');
const dom=new JSDOM(html,{url:'file:///C:/PROJECT_NEXUS/index.html',runScripts:'outside-only',pretendToBeVisual:true});
const {window}=dom,doc=window.document;
const p={id:'p1',name:'测试桥梁',kind:'机械',links:[{path:'C:\\Demo\\Bridge_V15.wbpj',type:'file',date:'2026-01-01T08:00:00.000Z'}],tasks:[],createdAt:'2026-01-01T08:00:00.000Z'};
const state={projects:[p],works:[],apps:[{id:'a1',name:'ANSYS Workbench',kind:'工程设计',path:'C:\\Demo\\Workbench.lnk',pinned:true}],roots:[]};
window.nexus={
 profiles:async()=>({DeepSeek:{endpoint:'https://api.deepseek.com/chat/completions',model:'deepseek-chat'}}),
 getSettings:async()=>({provider:'DeepSeek',model:'deepseek-chat',endpoint:'https://api.deepseek.com/chat/completions',hasKey:false}),
 load:async()=>state,listHistory:async()=>[],getProjectChat:async()=>[],getMemory:async()=>'',radarGet:async()=>({files:[],warnings:[]}),
 listModes:async()=>[{id:'mechanical',title:'机械建模',icon:'🧩',hint:'SolidWorks · CAD'}],
 previewMode:async()=>({id:'mechanical',title:'机械建模',apps:[],files:[]}),
 getAppIcon:async()=>null,getTimeline:async()=>[{time:'2026-01-01T08:00:00.000Z',title:'创建工程',source:'本地项目',details:''}],
 getSnapshots:async()=>[],getGraph:async()=>({nodes:[{id:'project',title:p.name,type:'项目'}],edges:[]}),
 healthCheck:async()=>({checks:[],passed:0,total:0,time:'2026-01-01T08:00:00.000Z'}),
 getGitHubStatus:async()=>[],getVersions:async()=>[],toggleFullscreen:async()=>true
};
window.confirm=()=>true;
function byAct(name){return doc.querySelector('[data-act="'+name+'"]')}
const wait=()=>new Promise(r=>setTimeout(r,45));
(async()=>{
 window.eval(renderer);await wait();
 assert(byAct('nav'),'Navigation not rendered');
 assert(doc.querySelector('.project-card'),'Project card not visible on home page');
 assert(doc.querySelector('.hero'),'Quick-start hero missing');
 const tools=doc.querySelector('[data-act="nav"][data-id="tools"]');
 assert(tools,'Efficiency tools nav missing');tools.click();await wait();
 assert(doc.body.textContent.includes('一键工作模式'),'Tools panel missing');
 assert(byAct('mode-preview'),'Mode preview action missing');
 byAct('mode-preview').click();await wait();assert(byAct('mode-start'),'Mode preview results missing');
 doc.querySelector('[data-act="nav"][data-id="projects"]').click();await wait();
 assert(doc.querySelector('.file-tile'),'Project source-file drawer missing');
 assert(doc.body.textContent.includes('AI 进度评估'),'AI progress review missing');
 assert(doc.querySelector('[data-act="project-archive-tab"][data-view="timeline"]'),'Timeline switch missing');
 doc.querySelector('[data-act="project-archive-tab"][data-view="timeline"]').click();await wait();
 assert(doc.body.textContent.includes('创建工程'),'Project timeline missing');
 doc.querySelector('[data-act="nav"][data-id="apps"]').click();await wait();
 assert(doc.querySelector('.app-icon'),'Native app icon container missing');
 byAct('command-open').click();await wait();assert(doc.querySelector('#nexus-commands'),'Ctrl+K command palette missing');
 const command=doc.querySelector('#command-search');command.value='测试桥梁';command.dispatchEvent(new window.Event('input',{bubbles:true}));
 assert(doc.querySelector('[data-command]'),'Command search found no project');
 command.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
 assert(!doc.querySelector('#nexus-commands'),'Command palette cannot close');
 doc.querySelector('[data-act="nav"][data-id="ai"]').click();await wait();
 assert(doc.querySelector('#chat-input'),'AI composer not visible');
 assert(byAct('window-picker'),'Screenshot of selected window missing');
 console.log('PASS: Home, projects, file drawer, modes, timeline, app icons, command search, AI and visual tools');
 dom.window.close();
})().catch(e=>{console.error(e);dom.window.close();process.exitCode=1});
