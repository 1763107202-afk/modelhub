const {contextBridge,ipcRenderer}=require('electron');
const call=(channel,...args)=>ipcRenderer.invoke(channel,...args);
contextBridge.exposeInMainWorld('nexus',{
 load:()=>call('load'),createProject:(name,kind)=>call('create-project',name,kind),
 addTask:(id,title)=>call('task-add',id,title),toggleTask:(id,taskId)=>call('task-toggle',id,taskId),
 pickFolder:id=>call('pick-folder',id),pickFile:id=>call('pick-file',id),removeLink:(id,index)=>call('remove-link',id,index),
 openPath:p=>call('open-path',p),revealPath:p=>call('reveal-path',p),openProject:id=>call('open-project',id),
 createWork:title=>call('create-work',title),toggleWork:id=>call('toggle-work',id),
 addRoot:()=>call('add-root'),scanApps:()=>call('scan-apps'),pinApp:id=>call('pin-app',id),runApp:id=>call('run-app',id),
 profiles:()=>call('profiles'),getSettings:()=>call('settings-get'),saveSettings:s=>call('settings-save',s),
 chat:payload=>call('chat',payload),clearKey:()=>call('key-clear'),openFloat:()=>call('float-open'),toggleFullscreen:()=>call('fullscreen-toggle'),
 capture:()=>call('screen-capture'),importHistory:()=>call('history-import')
});