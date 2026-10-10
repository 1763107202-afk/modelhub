const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('nexus',{
 load:()=>ipcRenderer.invoke('load'),
 createProject:(name)=>ipcRenderer.invoke('create-project',name),
 pickFolder:(id)=>ipcRenderer.invoke('pick-folder',id),
 pickFile:(id)=>ipcRenderer.invoke('pick-file',id),
 openPath:(path)=>ipcRenderer.invoke('open-path',path),
 openProject:(id)=>ipcRenderer.invoke('open-project',id),
 removeLink:(id,index)=>ipcRenderer.invoke('remove-link',id,index),
 getSettings:()=>ipcRenderer.invoke('get-settings'),
 saveSettings:(settings)=>ipcRenderer.invoke('save-settings',settings),
 chat:(payload)=>ipcRenderer.invoke('chat',payload),
 toggleFullscreen:()=>ipcRenderer.invoke('fullscreen'),
 openHistoryImport:()=>ipcRenderer.invoke('import-history')
});