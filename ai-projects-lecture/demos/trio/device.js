import * as THREE from './assets/three.module.js';
import { OrbitControls } from './assets/OrbitControls.js';
import { createCircuitBoard } from './circuit-board.js';

export function createDevice(host,actions,getState){
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(34,1,.1,100);
  const initial=new THREE.Vector3(8.4,10.8,12.4),target=new THREE.Vector3(0,.6,0);
  camera.position.copy(initial);camera.lookAt(target);
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.setClearColor(0x000000,0);host.append(renderer.domElement);
  const controls=new OrbitControls(camera,renderer.domElement);controls.target.copy(target);controls.enableDamping=true;controls.enablePan=false;
  controls.minDistance=7;controls.maxDistance=25;controls.maxPolarAngle=Math.PI*.47;controls.minPolarAngle=.02;
  scene.add(new THREE.HemisphereLight(0xffffff,0x546669,2.5));
  const light=new THREE.DirectionalLight(0xffffff,4);light.position.set(-4,11,6);light.castShadow=true;light.shadow.mapSize.set(1024,1024);
  Object.assign(light.shadow.camera,{left:-8,right:8,top:8,bottom:-8,near:.5,far:25});light.shadow.bias=-.0004;scene.add(light);
  const fill=new THREE.DirectionalLight(0xc3edfa,1.2);fill.position.set(7,4,-5);scene.add(fill);
  const matte=(color,metalness=.2,roughness=.55)=>new THREE.MeshStandardMaterial({color,metalness,roughness});
  const teal=matte(0x1b3437,.48,.42),side=matte(0x10282b,.45,.4),dark=matte(0x101c1e,.2,.58),lime=matte(0xd3f47c,.15,.4),cream=matte(0xebeee2,.05,.38),silver=matte(0x748c8f,.82,.25);
  function mesh(geometry,material,x,y,z){const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;scene.add(m);return m;}
  function rounded(w,d,h,r,material,x=0,y=0,z=0){
    const s=new THREE.Shape(),a=-w/2,b=-d/2;s.moveTo(a+r,b);s.lineTo(a+w-r,b);s.quadraticCurveTo(a+w,b,a+w,b+r);s.lineTo(a+w,b+d-r);s.quadraticCurveTo(a+w,b+d,a+w-r,b+d);s.lineTo(a+r,b+d);s.quadraticCurveTo(a,b+d,a,b+d-r);s.lineTo(a,b+r);s.quadraticCurveTo(a,b,a+r,b);
    const g=new THREE.ExtrudeGeometry(s,{depth:h,bevelEnabled:true,bevelSegments:3,steps:1,bevelSize:.045,bevelThickness:.045,curveSegments:12});g.rotateX(-Math.PI/2);return mesh(g,material,x,y,z);
  }
  function label(text,x,z,w=1.5,size=38,color='#a2b8b6',y=1.424){
    const c=document.createElement('canvas');c.width=512;c.height=96;const ctx=c.getContext('2d');ctx.clearRect(0,0,c.width,c.height);ctx.font=`600 ${size}px Arial, sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=color;ctx.fillText(text,256,48);
    const tx=new THREE.CanvasTexture(c);tx.colorSpace=THREE.SRGBColorSpace;
    const m=mesh(new THREE.PlaneGeometry(w,w*96/512),new THREE.MeshBasicMaterial({map:tx,transparent:true,depthWrite:false}),x,y,z);m.rotation.x=-Math.PI/2;m.castShadow=false;return m;
  }
  rounded(9.4,5.5,.96,.38,side,0,.32,0);rounded(9.39,5.48,.09,.38,teal,0,1.31,0);
  for(const x of [-3.8,3.8])for(const z of [-1.95,1.95])mesh(new THREE.CylinderGeometry(.33,.38,.28,24),dark,x,.17,z);
  const floor=mesh(new THREE.PlaneGeometry(100,100),new THREE.ShadowMaterial({opacity:.13}),0,.015,0);floor.rotation.x=-Math.PI/2;floor.castShadow=false;
  for(const x of [-4.26,4.26])for(const z of [-2.3,2.3]){mesh(new THREE.CylinderGeometry(.09,.09,.026,20),silver,x,1.43,z);const screw=mesh(new THREE.BoxGeometry(.10,.009,.014),dark,x,1.447,z);screw.rotation.y=.6;}
  // Speaker grill with actual geometry; enclosure proportions are illustrative.
  mesh(new THREE.CylinderGeometry(1.09,1.09,.045,64),silver,-3.12,1.441,-1.1);
  mesh(new THREE.CylinderGeometry(1.055,1.055,.048,64),dark,-3.12,1.465,-1.1);
  const holes=[];for(let x=-.86;x<.9;x+=.14)for(let z=-.86;z<.9;z+=.14)if(x*x+z*z<.86*.86)holes.push([x,z]);
  const inst=new THREE.InstancedMesh(new THREE.CylinderGeometry(.035,.035,.01,8),matte(0x4c6465,.4),holes.length),dummy=new THREE.Object3D();
  holes.forEach(([x,z],i)=>{dummy.position.set(x-3.12,1.497,z-1.1);dummy.updateMatrix();inst.setMatrixAt(i,dummy.matrix);});scene.add(inst);
  label('TRIO',.30,-2.22,1.25,62,'#e6eedb');label('THREE-CHANNEL MIXER',.32,-1.95,2.4,29);
  rounded(3.14,1.20,.055,.1,dark,.35,1.424,-1.13);
  const screen=document.createElement('canvas');screen.width=640;screen.height=224;const sc=screen.getContext('2d'),st=new THREE.CanvasTexture(screen);st.colorSpace=THREE.SRGBColorSpace;
  const sm=mesh(new THREE.PlaneGeometry(2.92,1.01),new THREE.MeshBasicMaterial({map:st}),.35,1.489,-1.13);sm.rotation.x=-Math.PI/2;sm.castShadow=false;
  const power=mesh(new THREE.CylinderGeometry(.29,.31,.14,40),lime,3.53,1.49,-1.48);power.userData.control={type:'power'};label('POWER',3.53,-.92,1.05,33);
  label('⏻',3.53,-1.48,.38,74,'#17282a',1.57);
  const ledmat=new THREE.MeshStandardMaterial({color:0x53664d,emissive:0xaaff33,emissiveIntensity:0});mesh(new THREE.SphereGeometry(.064,16,12),ledmat,3.53,1.46,-2.05);
  const knobs=[],knobNames=['SD MUSIC','KEY TONE','MIC','MASTER'];
  for(let i=0;i<4;i++){
    const x=-3+i*2;const group=new THREE.Group();group.position.set(x,1.46,.62);group.userData.control={type:'knob',index:i};scene.add(group);
    const rim=new THREE.Mesh(new THREE.CylinderGeometry(.43,.46,.10,48),silver);rim.position.y=.015;group.add(rim);
    const body=new THREE.Mesh(new THREE.CylinderGeometry(.365,.385,.45,48),i===3?lime:dark);body.position.y=.25;body.castShadow=true;group.add(body);
    for(let k=0;k<28;k++){const t=k*Math.PI*2/28,rib=new THREE.Mesh(new THREE.BoxGeometry(.025,.32,.024),i===3?lime:matte(0x30484b));rib.position.set(Math.sin(t)*.371,.24,Math.cos(t)*.371);rib.rotation.y=t;group.add(rib);}
    const tick=new THREE.Mesh(new THREE.BoxGeometry(.035,.012,.20),i===3?dark:lime);tick.position.set(0,.483,-.21);group.add(tick);knobs.push(group);
    label(knobNames[i],x,-.05,1.42,34,i===3?'#d3f47c':'#a7bfbc');
    const arc=new THREE.EllipseCurve(0,0,.58,.58,Math.PI*.75,Math.PI*2.25,false,0),pts=arc.getPoints(44).map(p=>new THREE.Vector3(p.x+x,1.423,p.y+.62));
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:0x5d7776})));
  }
  const keys=[];for(let i=0;i<8;i++){
    const x=-3.48+i*.995,k=rounded(.83,.76,.145,.075,cream,x,1.43,1.94);k.userData.control={type:'key',index:i};keys.push(k);
    label(['C','D','E','F','G','A','B','C′'][i],x,1.96,.46,55,'#354b4b',1.633);
  }
  // Rear I/O and front identification.
  rounded(.98,.10,.11,.025,dark,-2.9,.83,-2.76);rounded(.66,.12,.15,.04,silver,-1.65,.78,-2.76);
  const badge=label('ESP32  /  ANALOG SERIES',2.55,2.50,2.6,22,'#78938f');badge.position.y=1.423;
  // Preserve the enclosure controls, and make the open board the default view.
  const enclosure=new THREE.Group();enclosure.name='Enclosure';for(const obj of [...scene.children])if(!obj.isLight&&obj!==floor)enclosure.add(obj);scene.add(enclosure);
  const board=createCircuitBoard();scene.add(board.group);enclosure.visible=false;
  const ray=new THREE.Raycaster(),pointer=new THREE.Vector2();let held=null,cameraGoal=null,mode='board',cameraView='reset';
  function fittedPosition(view){
    const direction=(view==='top'?new THREE.Vector3(0,16,.1):mode==='board'?new THREE.Vector3(4.2,12.5,10.5):initial.clone()).normalize();
    const probe=camera.clone();let distance=16;
    for(let pass=0;pass<3;pass++){
      probe.position.copy(direction).multiplyScalar(distance).add(target);probe.lookAt(target);probe.updateMatrixWorld();probe.updateProjectionMatrix();let extentX=0,extentY=0;
      for(const x of [-4.8,4.8])for(const y of [0,mode==='board'?1.05:2.05])for(const z of [mode==='board'?-3.4:-2.85,mode==='board'?3.4:2.85]){const p=new THREE.Vector3(x,y,z).project(probe);extentX=Math.max(extentX,Math.abs(p.x));extentY=Math.max(extentY,Math.abs(p.y));}
      distance*=Math.max(extentX/.90,extentY/.77);
    }
    return direction.multiplyScalar(distance).add(target);
  }
  function pick(event){const b=renderer.domElement.getBoundingClientRect();pointer.set((event.clientX-b.left)/b.width*2-1,-(event.clientY-b.top)/b.height*2+1);ray.setFromCamera(pointer,camera);for(const hit of ray.intersectObject(mode==='board'?board.group:enclosure,true)){let o=hit.object;while(o&&!o.userData.control)o=o.parent;if(o)return o.userData.control;}return null;}
  function release(e){if(held?.control.type==='key')actions.noteOff(held.control.index);if(held?.control.type==='part'&&e?.type==='pointerup'&&Math.hypot(e.clientX-held.x,e.clientY-held.y)<7)actions.selectPart(held.control.id);held=null;controls.enabled=true;}
  renderer.domElement.addEventListener('pointerdown',e=>{const control=pick(e);if(!control)return;held={control,x:e.clientX,y:e.clientY,value:getState().volumes[control.index]};if(control.type==='part')return;e.stopImmediatePropagation();controls.enabled=false;renderer.domElement.setPointerCapture(e.pointerId);if(control.type==='key')actions.noteOn(control.index);if(control.type==='power')actions.power();},{capture:true});
  renderer.domElement.addEventListener('pointermove',e=>{if(held&&held.control.type!=='part'){e.stopImmediatePropagation();if(held.control.type==='knob')actions.volume(held.control.index,held.value+(held.y-e.clientY+e.clientX-held.x)/230);}else renderer.domElement.style.cursor=pick(e)?'pointer':'grab';},{capture:true});
  renderer.domElement.addEventListener('pointerup',release,{capture:true});renderer.domElement.addEventListener('pointercancel',release,{capture:true});window.addEventListener('blur',release);
  const resize=new ResizeObserver(()=>{const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;renderer.setSize(w,h);camera.aspect=w/h;camera.fov=w/h<1.5?43:34;camera.updateProjectionMatrix();camera.position.copy(fittedPosition(cameraView));cameraGoal=null;camera.lookAt(target);controls.target.copy(target);controls.update();});resize.observe(host);
  let lastScreen=0,raf=0;
  function frame(now){raf=requestAnimationFrame(frame);let s=getState();knobs.forEach((k,i)=>{k.rotation.y=(-135+s.volumes[i]*270)*Math.PI/180;});keys.forEach((k,i)=>{k.position.y=s.note===i&&s.power?1.375:1.43;});ledmat.emissiveIntensity=s.power?2:0;
    board.update(s);
    if(cameraGoal){camera.position.lerp(cameraGoal,.13);if(camera.position.distanceTo(cameraGoal)<.01)cameraGoal=null;}controls.update();
    if(now-lastScreen>70){lastScreen=now;sc.fillStyle='#0b181b';sc.fillRect(0,0,640,224);sc.font='500 24px monospace';sc.fillStyle=s.power?'#dbfa8c':'#4b6564';sc.fillText(s.power?'TRIO / MIX ENGINE':'TRIO / STANDBY',26,38);sc.font='22px monospace';sc.fillText(s.power?`01 ${Math.round(s.volumes[0]*100)}   02 ${Math.round(s.volumes[1]*100)}   03 ${Math.round(s.volumes[2]*100)}`:'PRESS POWER TO START',26,198);
      sc.strokeStyle=s.power?'#cbea84':'#344c4a';sc.lineWidth=2;sc.beginPath();const wave=s.wave||[];for(let i=0;i<256;i++){let x=26+i*2.3,y=111-(s.power?(wave[i]||0)*23:0);i?sc.lineTo(x,y):sc.moveTo(x,y);}sc.stroke();st.needsUpdate=true;}
    renderer.render(scene,camera);
  }
  raf=requestAnimationFrame(frame);
  return {view(view){cameraView=view;cameraGoal=fittedPosition(view);controls.target.copy(target);},mode(next){release();mode=next==='case'?'case':'board';board.group.visible=mode==='board';enclosure.visible=mode==='case';cameraView='reset';cameraGoal=fittedPosition('reset');controls.target.copy(target);},selectPart(id){board.select(id);},dispose(){cancelAnimationFrame(raf);resize.disconnect();release();window.removeEventListener('blur',release);controls.dispose();renderer.dispose();renderer.domElement.remove();}};
}
