import {DEFAULT_VOLUMES,DEFAULT_NOTES,clamp,parseWav,MixerDSP} from './dsp-core.js';
import {BOARD_PARTS,createBoardPlan} from './board-info.js';
const $=id=>document.getElementById(id),buttons=[...document.querySelectorAll('[data-note]')];
const state={power:false,playing:false,note:-1,test:false,live:false,overload:false,volumes:[...DEFAULT_VOLUMES],notes:[...DEFAULT_NOTES],duties:Array(8).fill(.535),wave:Array(256).fill(0),peak:0,clipMic:false,clipMix:false,clipAmp:false};
let ctx,node,initPromise,model,stream,micSource,micRequest=0,wav=null,wavName='',micPending=false;
const status=(message)=>{$('status').textContent=message;};
const config=()=>({power:state.power,playing:state.playing,note:state.note,test:state.test,live:state.live,overload:state.overload,volumes:[...state.volumes],notes:state.notes,duties:state.duties});
function sync(){if(node?.port)node.port.postMessage({type:'configure',value:config()});else node?.dsp?.configure(config());updateUI();}
function updateUI(){
  $('power').classList.toggle('on',state.power);$('power').setAttribute('aria-pressed',state.power);$('power').querySelector('span').textContent=state.power?'电源已开启':'打开电源';
  $('play').textContent=state.playing?'暂停播放':wav?'播放 WAV':'播放示范曲';$('music-activity').classList.toggle('active',state.power&&state.playing);
  $('music-name').textContent=wav?wavName:'内置示范曲 · 8 位 DAC';$('demo-reset').hidden=!wav;
  for(let i=0;i<4;i++){const val=Math.round(state.volumes[i]*100);$('vol'+i).value=val;$('vol'+i).style.setProperty('--value',val+'%');if(i<3)$('out'+i).textContent=val+'%';else $('master-value').replaceChildren(String(val),Object.assign(document.createElement('span'),{textContent:'%'}));}
  buttons.forEach((b,i)=>{b.classList.toggle('pressed',state.note===i&&state.power);b.setAttribute('aria-pressed',state.note===i&&state.power);});
  $('note-label').textContent=state.note>=0?`${state.notes[state.note].toFixed(1)} Hz`:'— Hz';
  $('mic-test').classList.toggle('selected',state.test);$('mic-test').setAttribute('aria-pressed',state.test);
  $('microphone').classList.toggle('selected',state.live);$('microphone').setAttribute('aria-pressed',state.live);$('microphone').textContent=micPending?'等待授权…':state.live?'关闭麦克风':'使用麦克风';
  $('mic-activity').classList.toggle('active',state.power&&(state.test||state.live));$('overload').checked=state.overload;
  $('mic-description').textContent=state.live?'本机麦克风 · 输入电压为映射值':state.test?`700 Hz · 输入 ${state.overload?'35':'7.9'} mVp`:'前置放大 · 约 101 倍';
}
function meters(data){Object.assign(state,data);$('peak-label').textContent=(state.power?data.peak:0).toFixed(2)+' Vp';
  const clipping=state.power&&(data.clipMic||data.clipMix||data.clipAmp),signal=state.power&&data.peak>.002;
  $('clip-state').textContent=clipping?data.clipMic?'前级削顶':data.clipMix?'混音削顶':'功放限幅':signal?'电平正常':'无信号';$('clip-state').classList.toggle('clipped',clipping);
  $('signal-state').textContent=state.power?signal?'实时信号':'电源已开启':'等待开机';drawScope();
}
async function ensureAudio(){
  if(!initPromise)initPromise=(async()=>{
    const AudioContext=window.AudioContext||window.webkitAudioContext;if(!AudioContext)throw Error('此浏览器不支持 Web Audio，请使用新版 Chrome、Edge 或 Safari。');
    ctx=new AudioContext({latencyHint:'interactive'});
    if(ctx.audioWorklet){await ctx.audioWorklet.addModule('./audio-worklet.js');node=new AudioWorkletNode(ctx,'trio-mixer',{numberOfInputs:1,numberOfOutputs:1,outputChannelCount:[1]});node.port.onmessage=({data})=>meters(data);}
    else {node=ctx.createScriptProcessor(1024,1,1);node.dsp=new MixerDSP(ctx.sampleRate);node.onaudioprocess=e=>{const out=e.outputBuffer.getChannelData(0),input=e.inputBuffer.getChannelData(0);for(let i=0;i<out.length;i++)out[i]=node.dsp.sample(input[i]);meters(node.dsp.meters());};}
    node.connect(ctx.destination);sendWav();sync();
    ctx.onstatechange=()=>{if(ctx.state==='suspended'&&state.power)status('音频已被浏览器暂停，点击任一声音按钮恢复。');};
  })().catch(error=>{initPromise=null;if(ctx)ctx.close().catch(()=>{});ctx=null;node=null;throw error;});
  // resume is invoked from the original user event, before awaiting module load.
  const resume=ctx?.resume();await initPromise;if(resume)await resume;if(ctx.state!=='running')await ctx.resume();
}
async function powerOn(){state.power=true;sync();try{await ensureAudio();sync();if(state.power)status('电源已开启，可以同时播放音乐、琴键和测试音。');}catch(e){state.power=false;sync();throw e;}}
function stopMic(){micRequest++;micPending=false;micSource?.disconnect();micSource=null;stream?.getTracks().forEach(t=>t.stop());stream=null;state.live=false;}
function powerOff(){state.power=false;state.playing=false;state.note=-1;state.test=false;stopMic();sync();status('电源已关闭。');setTimeout(()=>{if(!state.power)ctx?.suspend().catch(()=>{});meters({wave:Array(256).fill(0),peak:0,clipMic:false,clipMix:false,clipAmp:false});},100);}
async function togglePower(){if(state.power)powerOff();else await powerOn();}
async function togglePlay(){if(!state.power)await powerOn();else await ensureAudio();if(!state.power)return;state.playing=!state.playing;sync();status(state.playing?'正在播放，可叠加琴键和麦克风测试音。':'音乐已暂停，其他音源可以继续发声。');}
async function noteOn(i){state.note=i;sync();if(!state.power)await powerOn();else await ensureAudio();sync();}
function noteOff(i){if(i===undefined||state.note===i){state.note=-1;sync();}}
function volume(i,v){state.volumes[i]=clamp(v,0,1);sync();}
const safe=fn=>(...args)=>Promise.resolve().then(()=>fn(...args)).catch(e=>status(e.message||'操作未完成，请重试。'));
// Gesture functions execute synchronously until their first await to unlock audio on iOS.
const gesture=fn=>(...args)=>{try{const p=fn(...args);p?.catch(e=>status(e.message||'操作未完成，请重试。'));}catch(e){status(e.message);}};
$('power').onclick=gesture(togglePower);$('play').onclick=gesture(togglePlay);
for(let i=0;i<4;i++)$('vol'+i).oninput=e=>volume(i,Number(e.target.value)/100);
for(const b of buttons){const i=Number(b.dataset.note);b.onpointerdown=e=>{e.preventDefault();b.focus();b.setPointerCapture(e.pointerId);gesture(noteOn)(i);};b.onpointerup=()=>noteOff(i);b.onpointercancel=()=>noteOff(i);b.onlostpointercapture=()=>noteOff(i);b.onkeydown=e=>{if((e.code==='Space'||e.code==='Enter')&&!e.repeat){e.preventDefault();gesture(noteOn)(i);}};b.onkeyup=e=>{if(e.code==='Space'||e.code==='Enter'){e.preventDefault();noteOff(i);}};b.onblur=()=>noteOff(i);}
const keyCodes=['KeyA','KeyS','KeyD','KeyF','KeyG','KeyH','KeyJ','KeyK'];
document.addEventListener('keydown',e=>{if(e.ctrlKey||e.altKey||e.metaKey||e.repeat||$('results-dialog').open||/INPUT|TEXTAREA|SELECT/.test(e.target.tagName))return;const i=keyCodes.indexOf(e.code);if(i>=0){e.preventDefault();gesture(noteOn)(i);}});
document.addEventListener('keyup',e=>{const i=keyCodes.indexOf(e.code);if(i>=0)noteOff(i);});window.addEventListener('blur',()=>noteOff());
$('mic-test').onclick=gesture(async()=>{if(!state.power)await powerOn();else await ensureAudio();state.test=!state.test;sync();status(state.test?'测试音已开启：700 Hz，可观察混音与前级过载。':'测试音已关闭。');});
$('overload').onchange=e=>{state.overload=e.target.checked;sync();if(state.overload)status('测试输入增大为 35 mVp；前级失真无法用后级音量恢复。');};
$('microphone').onclick=gesture(async()=>{
  if(state.live||micPending){stopMic();sync();status('麦克风已关闭。');return;}
  if(!navigator.mediaDevices?.getUserMedia)throw Error('此浏览器不支持麦克风访问，请改用 700 Hz 测试音。');
  if(!state.power)await powerOn();else await ensureAudio();if(!state.power)return;
  const request=++micRequest;micPending=true;updateUI();status('请允许本机麦克风；声音不会上传，建议戴耳机防止反馈。');
  try{const captured=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:false},video:false});if(request!==micRequest||!state.power){captured.getTracks().forEach(t=>t.stop());return;}
    stream=captured;micSource=ctx.createMediaStreamSource(stream);micSource.connect(node);state.live=true;micPending=false;sync();status('麦克风已连接，只在本机处理；输入电压按示意比例映射。');
  }catch(e){if(request===micRequest){micPending=false;sync();status('未取得麦克风权限，可继续使用 700 Hz 测试音。');}}
});
function sendWav(){if(node?.port)node.port.postMessage({type:'wav',samples:wav});else node?.dsp?.setWav(wav);}
$('wav').onchange=safe(async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>25*1024*1024)throw Error('WAV 文件请小于 25 MB。');const samples=parseWav(await file.arrayBuffer());wav=samples;wavName=file.name;state.playing=false;sendWav();sync();status('WAV 已在本机载入，点击播放。文件不会上传。');}finally{e.target.value='';}});
$('demo-reset').onclick=()=>{wav=null;wavName='';state.playing=false;sendWav();sync();status('已恢复内置示范曲。');};
$('reset').onclick=()=>{powerOff();state.volumes=[...DEFAULT_VOLUMES];state.overload=false;wav=null;wavName='';sendWav();sync();model?.view('reset');status('已恢复默认设置，点击电源开始。');};
window.addEventListener('pagehide',()=>{stopMic();ctx?.suspend();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&state.live){stopMic();sync();status('页面已切换到后台，麦克风已关闭。');}});

const canvas=$('scope'),g=canvas.getContext('2d');
function drawScope(){let w=canvas.clientWidth,h=canvas.clientHeight;if(!w||!h)return;const dpr=Math.min(devicePixelRatio||1,2);if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}g.setTransform(dpr,0,0,dpr,0,0);g.clearRect(0,0,w,h);
  const left=47,right=w-16,mid=h/2,scale=(h-25)/5,division=state.peak>1.1?1:.5;g.lineWidth=1;g.font='10px ui-monospace,monospace';g.textBaseline='middle';
  document.querySelector('.scope-scale>span:last-child').textContent=`20 ms · ${division} V / 格`;
  for(let i=-2;i<=2;i++){const y=mid-i*scale;g.strokeStyle=i===0?'#435653':'#2c403e';g.setLineDash(i===0?[]:[2,5]);g.beginPath();g.moveTo(left,y);g.lineTo(right,y);g.stroke();g.fillStyle='#8eaaa3';g.fillText((2.49+i*division).toFixed(2),7,y);}
  g.setLineDash([]);g.strokeStyle='#2b403c';for(let i=0;i<=10;i++){const x=left+(right-left)*i/10;g.beginPath();g.moveTo(x,9);g.lineTo(x,h-9);g.stroke();}
  g.save();g.beginPath();g.rect(left,0,right-left,h);g.clip();g.strokeStyle=state.power&&(state.clipMic||state.clipMix)?'#ffb382':'#d5fb89';g.lineWidth=1.65;g.beginPath();state.wave.forEach((v,i)=>{const x=left+(right-left)*i/(state.wave.length-1),y=mid-(state.power?v:0)*scale/division;i?g.lineTo(x,y):g.moveTo(x,y);});g.stroke();g.restore();
}
new ResizeObserver(drawScope).observe(canvas);drawScope();
let deviceMode='board',selectedPart='esp32';
function selectPart(id){const part=BOARD_PARTS[id];if(!part)return;selectedPart=id;model?.selectPart(id);$('part-title').textContent=part.title;$('part-description').textContent=part.description;$('part-connection').textContent=part.connection;document.querySelectorAll('[data-part]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.part===id));}
function setDeviceMode(mode){deviceMode=mode;model?.mode(mode);$('view-board').setAttribute('aria-pressed',mode==='board');$('view-case').setAttribute('aria-pressed',mode==='case');$('board-inspector').hidden=mode!=='board';$('model-tag').textContent=mode==='board'?'电路板视图':'整机外壳';$('stage-hint').textContent=mode==='board'?'拖动旋转 · 点选器件 · 滚轮 / 双指缩放':'拖动旋转 · 拖旋钮调节 · 按琴键发声';}
document.querySelectorAll('[data-part]').forEach(b=>b.onclick=()=>{if(deviceMode!=='board')setDeviceMode('board');selectPart(b.dataset.part);});
const boardPlan=createBoardPlan($('device'),selectPart);selectPart('esp32');$('view-case').disabled=true;
function modelUnavailable(){document.querySelectorAll('#device canvas').forEach(c=>c.remove());$('model-error').hidden=false;$('view-case').disabled=true;$('view-top').disabled=true;$('view-reset').disabled=true;$('stage-hint').textContent='二维器件布局 · 点选器件查看作用';}
import('./device.js?v=2-board').then(({createDevice})=>{try{model=createDevice($('device'),{power:gesture(togglePower),noteOn:gesture(noteOn),noteOff,volume,selectPart},()=>state);boardPlan.remove();$('view-case').disabled=false;setDeviceMode(deviceMode);selectPart(selectedPart);}catch(e){modelUnavailable();}}).catch(modelUnavailable);
$('view-board').onclick=()=>{if(model)setDeviceMode('board');};$('view-case').onclick=()=>{if(model)setDeviceMode('case');};
$('view-top').onclick=()=>model?.view('top');$('view-reset').onclick=()=>model?.view('reset');

let report=null,figuresLoaded=false;
function makeTable(headers,rows){const table=document.createElement('table'),thead=table.createTHead(),hr=thead.insertRow();headers.forEach(t=>{const th=document.createElement('th');th.textContent=t;hr.append(th);});const body=table.createTBody();rows.forEach(r=>{const tr=body.insertRow();r.forEach(t=>{tr.insertCell().textContent=t;});});return table;}
function renderReport(r){
  $('result-summary').textContent=`已完成 ${r.dc_cases} 组电位器直流检查、三路频响、8 键定时与混音瞬态。标称混音输出 ${r.transient.mix_nominal.mix_out.min_v.toFixed(3)}–${r.transient.mix_nominal.mix_out.max_v.toFixed(3)} V，在本行为模型的输出范围内。`;
  const area=$('report-tables');area.replaceChildren();
  const h=document.createElement('h3');h.textContent='工作点与标称混音';area.append(h,makeTable(['检查项','结果'],[['模拟电源',r.dc_nominal.v5a.toFixed(4)+' V'],['偏置参考',r.dc_nominal.vref.toFixed(4)+' V'],['电位器改变时偏置漂移',(r.dc_pot_variation_max_v*1e6).toFixed(2)+' µV'],['8 Ω 等效负载功率',(r.transient.mix_nominal.speaker_power_w*1000).toFixed(2)+' mW'],['步长减半时混音极值差',(r.step_extrema_difference_v*1e6).toFixed(2)+' µV'],['前级过载',r.transient.mic_overload?'35 mVp 输入触及输出限幅':'未完成 SPICE 过载测试']]));
  const nh=document.createElement('h3');nh.textContent='八键实际模型频率';area.append(nh,makeTable(['音符','仿真频率','偏差'],r.tones.map(t=>[t.note,t.frequency_hz.toFixed(2)+' Hz',(t.error_percent>=0?'+':'')+t.error_percent.toFixed(2)+'%'])));
  const note=document.createElement('p');note.className='report-source';note.textContent='以上结果来自离线 ngspice 行为模型。频率偏差未包含 555 芯片阈值公差；零件实测与调音仍然需要。';area.append(note);
}
fetch('./assets/results.json').then(r=>{if(!r.ok)throw Error();return r.json();}).then(r=>{report=r;state.notes=r.tones.map(t=>t.frequency_hz);state.duties=r.tones.map(t=>t.duty);sync();renderReport(r);}).catch(()=>{$('result-summary').textContent='仿真摘要暂不可读，请打开下方完整仿真报告。';});
function openResults(){if(!$('results-dialog').open)$('results-dialog').showModal();if(!figuresLoaded){figuresLoaded=true;const labels=['电源与偏置','ESP32 与 SD 卡','DAC 与音乐输入','NE555 八键音源','麦克风前置放大','三路有源混音','主音量与扬声器功放'];['01_power','02_esp32_sd','03_dac_filter','04_keyboard','05_microphone','06_mixer','07_amplifier'].forEach((name,i)=>{const figure=document.createElement('figure'),img=document.createElement('img'),cap=document.createElement('figcaption');img.src='./assets/'+name+'.png';img.alt=labels[i]+'原理图';img.loading='lazy';cap.textContent=labels[i];figure.append(img,cap);$('schematics').append(figure);});}}
$('results-open').onclick=openResults;$('details-open').onclick=openResults;$('results-close').onclick=()=>$('results-dialog').close();$('results-dialog').onclick=e=>{if(e.target===$('results-dialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}};
// Progressive enhancement: shared action functions also back the optional WebMCP interface.
const modelContext=document.modelContext,lifecycle=new AbortController();
if(modelContext?.registerTool){
  const register=tool=>{try{Promise.resolve(modelContext.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch{}};
  register({name:'read_mixer_state',description:'Read mixer power, source, volume and voltage state.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute:async()=>({...config(),peak:state.peak,clipMic:state.clipMic,clipMix:state.clipMix})});
  register({name:'set_mixer_volumes',description:'Set the three input volumes and master volume from 0 to 100 percent.',inputSchema:{type:'object',properties:{volumes:{type:'array',items:{type:'number',minimum:0,maximum:100},minItems:4,maxItems:4}},required:['volumes'],additionalProperties:false},annotations:{readOnlyHint:false},execute:async(input)=>{const volumes=input?.volumes;if(!Array.isArray(volumes)||volumes.length!==4||volumes.some(v=>!Number.isFinite(v)||v<0||v>100))throw Error('Four volumes between 0 and 100 are required.');state.volumes=volumes.map(v=>v/100);sync();return {volumes};}});
}
window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
updateUI();
