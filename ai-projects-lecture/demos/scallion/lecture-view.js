import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {buildMachine} from './machine14.js';
import {C,stageAt} from './flow14.js';
const $=id=>document.getElementById(id),stage=$('stage');
try{
  const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.25));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.3;stage.prepend(renderer.domElement);
  const scene=new THREE.Scene();scene.background=new THREE.Color('#e7ecdf');const camera=new THREE.PerspectiveCamera(37,1,.03,150),controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.minDistance=.7;controls.maxDistance=48;controls.maxPolarAngle=Math.PI*.49;
  scene.add(new THREE.HemisphereLight(0xffffff,0x63735d,2.5));const light=new THREE.DirectionalLight(0xffffff,3.2);light.position.set(-3,8,5);scene.add(light);const pm=new THREE.PMREMGenerator(renderer);scene.environment=pm.fromScene(new RoomEnvironment(),.04).texture;pm.dispose();
  const machine=buildMachine();scene.add(machine.root);let time=0,playing=false,prev=0;
  const target=new THREE.Vector3(1.7,1,-1.25),dir=new THREE.Vector3(1.15,.8,1.3).normalize();
  function fit(top=false){controls.target.copy(target);camera.position.copy(target).addScaledVector(top?new THREE.Vector3(.001,1,.001):dir,stage.clientWidth<600?30:24);controls.update();}
  function resize(){const w=stage.clientWidth,h=stage.clientHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();}new ResizeObserver(resize).observe(stage);resize();fit();
  $('timeline').max=C.duration;$('play').onclick=()=>{playing=!playing;$('play').textContent=playing?'暂停运行':'运行设备';};$('reset').onclick=()=>{playing=false;time=0;machine.update(0,true);$('play').textContent='运行设备';fit();};$('top').onclick=()=>fit(true);$('iso').onclick=()=>fit();$('timeline').oninput=e=>{time=Number(e.target.value);playing=false;$('play').textContent='运行设备';machine.update(time,true);};
  function tick(t){requestAnimationFrame(tick);const dt=Math.min(.05,(t-prev)/1000||0);prev=t;if(playing){time=(time+dt*1.5)%C.duration;machine.update(time);}$('timeline').value=time;$('time').textContent=time.toFixed(1)+'s';const s=stageAt(time);$('status').textContent=(s?.name||'整线动作方案')+' · 拖动旋转 / 滚轮缩放';controls.update();renderer.render(scene,camera);}
  machine.update(0,true);$('loading').hidden=true;requestAnimationFrame(tick);
}catch(e){$('loading').innerHTML='当前设备未能加载三维视图。<br>可关闭此窗口查看原始模型图，或打开原站点。';console.error(e);}
