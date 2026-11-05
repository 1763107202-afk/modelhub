import * as THREE from './vendor/three.module.js';
import {OrbitControls} from './vendor/OrbitControls.js';
import {buildRide,placeCabin} from './model.js';
import {buildEnvironment} from './environment.js';
import {buildAtmosphere} from './atmosphere.js';
import {SPEC,STAGES,MODES,stateAt} from './sequence.js';

const $=id=>document.getElementById(id);
const state={time:0,mode:'stellar',playing:false,rate:1,view:'orbit',day:false,structure:false,autoorbit:false};
let renderer,scene,camera,controls,ride,environment,atmosphere,sun,hemi,last=0,frame=0,viewport,latest,transition=null;
const duration=()=>state.mode==='explore'?150:165;
const formatTime=t=>`${Math.floor(t/60).toString().padStart(2,'0')}:${Math.floor(t%60).toString().padStart(2,'0')}`;
const modeNotes={explore:'平缓走行，主动滚转不超过45°，适合先观察机构。',stellar:'独立追逐、中央掠过、90°侧倾与180°翻转。',rift:'完整追逐与俯冲，外侧弧段完成360°主动滚转。'};
function setMode(mode){if(!MODES[mode])throw new Error('未知玩法');state.mode=mode;state.time=0;state.playing=false;document.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));$('mode-note').textContent=modeNotes[mode];$('duration-label').textContent=duration()+' s';$('clock-total').textContent=' / '+formatTime(duration());$('scrub').max=duration();document.querySelectorAll('[data-stage]').forEach(b=>b.querySelector('small').textContent=Math.round(STAGES[Number(b.dataset.stage)].start/165*duration())+'s');updateScene();updateUI();return getState();}
function getState(){return {mode:state.mode,playing:state.playing,time:Number(state.time.toFixed(2)),duration:duration(),view:state.view,stage:STAGES[latest?.stage??0].name};}
function setTime(time){if(typeof time!=='number'||!Number.isFinite(time)||time<0||time>duration())throw new Error('时间超出当前航程范围');state.time=time;if(time===duration())state.playing=false;updateScene();updateUI();return getState();}
function setPlaying(playing){if(typeof playing!=='boolean')throw new Error('playing 必须为布尔值');if(playing&&state.time>=duration())state.time=0;state.playing=playing;updateUI();return getState();}
function updateUI(){
 if(!latest)return;const phase=STAGES[latest.stage];$('stage-number').textContent=`0${latest.stage+1} / 07`;$('stage-title').textContent=phase.name;$('stage-detail').textContent=phase.detail;
 const k=165/duration();$('speed-a').innerHTML=(latest.va*k).toFixed(1)+'<small> m/s</small>';$('speed-b').innerHTML=(latest.vb*k).toFixed(1)+'<small> m/s</small>';$('rpm-value').innerHTML=(latest.rpm*k).toFixed(2)+'<small> rpm</small>';
 $('roll-value').textContent=`${Math.round(latest.rollA*180/Math.PI)}° / ${Math.round(latest.rollB*180/Math.PI)}°`;$('clock').textContent=formatTime(state.time);$('scrub').value=state.time;
 $('play').innerHTML=state.playing?'Ⅱ <span>暂停航程</span>':state.time===duration()?'▶ <span>再次体验</span>':'▶ <span>开始航程</span>';$('play').setAttribute('aria-label',state.playing?'暂停演示':'开始完整演示');
 document.querySelectorAll('[data-stage]').forEach(b=>b.classList.toggle('active',Number(b.dataset.stage)===latest.stage));
}
function updateScene(){
 if(!ride)return;latest=stateAt(state.time/duration()*165,state.mode);ride.rotating.rotation.y=latest.yaw;
 placeCabin(ride.cabins[0],latest.thetaA,latest.rollA,latest.da,latest.restraintBlend);placeCabin(ride.cabins[1],latest.thetaB,latest.rollB,latest.db,latest.restraintBlend);
 for(let i=0;i<ride.gates.length;i++)ride.gates[i].rotation.y=(1-latest.restraintBlend)*(i%2===0?1:-1)*1.12;
 scene.updateMatrixWorld(true);
}
function viewPose(view){
 const mobile=innerWidth<761;
 if(view==='orbit')return {position:new THREE.Vector3(mobile?21:-8,mobile?22:14,mobile?45:30),target:new THREE.Vector3(mobile?0:2.4,7.8,0)};
 if(view==='detail')return {position:new THREE.Vector3(-11,10,-14),target:new THREE.Vector3(-2.2,7.0,0)};
 if(view==='top')return {position:new THREE.Vector3(.05,48,-.1),target:new THREE.Vector3(0,0,0)};
 const cabin=ride.cabins[0];const pos=new THREE.Vector3();cabin.inner.getWorldPosition(pos);const q=new THREE.Quaternion();cabin.inner.getWorldQuaternion(q);
 if(view==='rider'){const eye=new THREE.Vector3(.25,.92,.87).applyQuaternion(q).add(pos),look=new THREE.Vector3(.25,.80,10).applyQuaternion(q).add(pos);return {position:eye,target:look,up:new THREE.Vector3(0,1,0).applyQuaternion(q)};}
 const forward=new THREE.Vector3(0,0,1).applyQuaternion(q),up=new THREE.Vector3(0,1,0).applyQuaternion(q);
 return {position:pos.clone().addScaledVector(forward,-7.2).addScaledVector(up,3.0).add(new THREE.Vector3(1,2,0)),target:pos.clone().addScaledVector(forward,2),up:new THREE.Vector3(0,1,0)};
}
function setView(view){if(!['orbit','chase','rider','detail','top'].includes(view))throw new Error('未知观察视角');state.view=view;document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view));controls.enabled=!['chase','rider'].includes(view);camera.up.set(0,1,0);const pose=viewPose(view);if(controls.enabled){transition={start:performance.now(),from:camera.position.clone(),targetFrom:controls.target.clone(),to:pose.position,targetTo:pose.target};camera.fov=view==='detail'?43:view==='orbit'?(innerWidth<761?46:36):42;camera.updateProjectionMatrix();}else{transition=null;camera.fov=view==='rider'?68:50;camera.updateProjectionMatrix();}return getState();}
function resize(){
 const w=innerWidth,h=innerHeight;viewport={width:w,height:h};renderer.setSize(w,h,false);camera.aspect=w/h;
 // The off-center projection reserves room for the controls while keeping the model unobstructed.
 if(w>=761){camera.setViewOffset(w,h,Math.round(w*.105),0,w,h);}else{camera.setViewOffset(w,h,0,Math.round(h*.16),w,h);}
 camera.updateProjectionMatrix();
}
function setDay(day){state.day=day;scene.background.set(day?'#adc6d2':'#b092ab');scene.fog.color.copy(scene.background);atmosphere.setDay(day);hemi.intensity=day?2.0:1.1;sun.intensity=day?3.1:3.0;sun.color.set(day?'#fff4db':'#ffd0a0');renderer.toneMappingExposure=day?1.0:1.03;$('environment').textContent=day?'日间园区':'暮色园区';for(const m of [...Object.values(ride.mats),...Object.values(environment.mat)])if(m.emissive){if(m.userData.baseEmission===undefined)m.userData.baseEmission=m.emissiveIntensity;m.emissiveIntensity=m.userData.baseEmission*(day?.26:1);}return getState();}
function setStructure(value){state.structure=value;environment.park.visible=!value;environment.ground.visible=!value;ride.mats.deck.transparent=value;ride.mats.deck.opacity=value?.28:1;ride.mats.deck.depthWrite=!value;ride.mats.deck.needsUpdate=true;ride.mats.white.transparent=value;ride.mats.white.opacity=value?.60:1;ride.mats.white.depthWrite=!value;ride.mats.white.needsUpdate=true;document.body.classList.toggle('structure',value);}
function animate(now){
 const dt=Math.min(.1,(now-last)/1000||0);last=now;if(state.playing){state.time=Math.min(duration(),state.time+dt*state.rate);if(state.time>=duration())state.playing=false;updateScene();}
 controls.autoRotate=state.autoorbit&&state.view==='orbit';controls.autoRotateSpeed=.32;
 if(transition){const u=Math.min(1,(now-transition.start)/900),s=u*u*(3-2*u);camera.position.lerpVectors(transition.from,transition.to,s);controls.target.lerpVectors(transition.targetFrom,transition.targetTo,s);if(u===1)transition=null;}
 if(['chase','rider'].includes(state.view)){const pose=viewPose(state.view);camera.position.copy(pose.position);camera.up.copy(pose.up);camera.lookAt(pose.target);}else controls.update();
 atmosphere.update(camera);if(frame++%6===0)updateUI();renderer.render(scene,camera);requestAnimationFrame(animate);
}
function registerAgentTools(){
 const registry=document.modelContext;if(!registry?.registerTool)return;const lifecycle=new AbortController();
 const register=tool=>{try{Promise.resolve(registry.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch{}};
 register({name:'read_twin_rift_state',title:'读取双子星运行状态',description:'读取当前玩法、播放时间、阶段及观察视角。',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:false},execute:getState});
 register({name:'configure_twin_rift_show',title:'配置双子星运行演示',description:'设置可见界面的玩法、时间、播放和观察视角。',inputSchema:{type:'object',properties:{mode:{type:'string',enum:Object.keys(MODES)},time:{type:'number',minimum:0,maximum:165},playing:{type:'boolean'},view:{type:'string',enum:['orbit','chase','rider','detail','top']}},additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute(input){if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('输入必须为对象');for(const key of Object.keys(input))if(!['mode','time','playing','view'].includes(key))throw new Error('未知参数');if(input.mode!==undefined&&!MODES[input.mode])throw new Error('未知玩法');if(input.view!==undefined&&!['orbit','chase','rider','detail','top'].includes(input.view))throw new Error('未知视角');const d=input.mode==='explore'?150:input.mode?165:duration();if(input.time!==undefined&&(typeof input.time!=='number'||!Number.isFinite(input.time)||input.time<0||input.time>d))throw new Error('时间超出航程');if(input.playing!==undefined&&typeof input.playing!=='boolean')throw new Error('播放参数无效');if(input.mode!==undefined)setMode(input.mode);if(input.time!==undefined)setTime(input.time);if(input.view!==undefined)setView(input.view);if(input.playing!==undefined)setPlaying(input.playing);return getState();}});
 addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
}
try{
 scene=new THREE.Scene();scene.background=new THREE.Color('#b092ab');scene.fog=new THREE.Fog('#b092ab',60,150);
 renderer=new THREE.WebGLRenderer({canvas:$('canvas'),antialias:true,alpha:false,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,innerWidth<761?1.5:1.8));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 const initialMobile=innerWidth<761;camera=new THREE.PerspectiveCamera(initialMobile?46:36,innerWidth/innerHeight,.05,250);camera.position.set(initialMobile?21:-8,initialMobile?22:14,initialMobile?45:30);
 controls=new OrbitControls(camera,$('canvas'));controls.target.set(initialMobile?0:2.4,7.8,0);controls.enableDamping=true;controls.dampingFactor=.07;controls.minDistance=4;controls.maxDistance=80;controls.maxPolarAngle=Math.PI*.49;controls.enablePan=true;
 hemi=new THREE.HemisphereLight('#c1cbec','#615849',1.1);scene.add(hemi);sun=new THREE.DirectionalLight('#ffd0a0',3.0);sun.position.set(-35,24,-20);sun.castShadow=true;sun.shadow.mapSize.set(innerWidth<761?1024:2048,innerWidth<761?1024:2048);sun.shadow.camera.left=-28;sun.shadow.camera.right=28;sun.shadow.camera.top=28;sun.shadow.camera.bottom=-28;sun.shadow.camera.far=110;sun.shadow.normalBias=.035;sun.shadow.bias=-.00015;scene.add(sun);
 const fill=new THREE.DirectionalLight('#adc8ff',.7);fill.position.set(15,14,20);scene.add(fill);
 ride=buildRide(scene);environment=buildEnvironment(scene);
 atmosphere=buildAtmosphere(renderer,scene);renderer.toneMappingExposure=1.03;
 for(const [p,color] of [[[-7,7,-1],'#58dbf0'],[[7,7,2],'#ffb267']]){const light=new THREE.PointLight(color,12,20,2);light.position.set(...p);scene.add(light);}
 updateScene();resize();controls.update();updateUI();requestAnimationFrame(animate);
 const loading=$('loading');loading.style.opacity=0;setTimeout(()=>loading.remove(),600);
 $('play').addEventListener('click',()=>setPlaying(!state.playing));$('reset').addEventListener('click',()=>{setPlaying(false);setTime(0);});$('scrub').addEventListener('input',e=>setTime(Number(e.target.value)));$('rate').addEventListener('change',e=>{state.rate=Number(e.target.value);});
 document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.mode)));document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.view)));
 STAGES.forEach((phase,i)=>{const button=document.createElement('button');button.dataset.stage=i;button.innerHTML=phase.short+`<small>${phase.start}s</small>`;button.setAttribute('aria-label',`跳到${phase.name}`);button.addEventListener('click',()=>setTime(phase.start/165*duration()));$('stage-markers').append(button);});
 $('environment').addEventListener('click',()=>setDay(!state.day));$('structure').addEventListener('change',e=>setStructure(e.target.checked));$('envelope').addEventListener('change',e=>ride.cabins.forEach(c=>c.envelope.visible=e.target.checked));$('autoorbit').addEventListener('change',e=>{state.autoorbit=e.target.checked;});$('panel-toggle').addEventListener('click',()=>document.body.classList.toggle('panel-hidden'));
 $('fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await $('workspace').requestFullscreen();}catch{}});
 const reference=$('reference-dialog');$('reference').addEventListener('click',()=>{setPlaying(false);reference.showModal();});$('reference-close').addEventListener('click',()=>reference.close());reference.addEventListener('click',e=>{if(e.target===reference)reference.close();});
 addEventListener('resize',resize);addEventListener('keydown',e=>{if(e.code==='Space'&&!['INPUT','SELECT','SUMMARY'].includes(document.activeElement.tagName)){e.preventDefault();setPlaying(!state.playing);}if(e.code==='KeyR')setTime(0);});
 document.addEventListener('visibilitychange',()=>{last=performance.now();});
 controls.addEventListener('start',()=>{transition=null;});
 registerAgentTools();
 window.twinRift={getState,setMode,setTime,setPlaying,setView,ride,scene,renderer};
}catch(error){console.error('Twin Rift initialization failed',error);$('loading').remove();$('error').hidden=false;}
