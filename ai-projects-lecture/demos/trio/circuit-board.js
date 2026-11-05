import * as THREE from './assets/three.module.js';

// Physical layout and colored signal paths are explanatory, not PCB fabrication data.
import {BOARD_PARTS} from './board-info.js';


export function createCircuitBoard(){
  const group=new THREE.Group();group.name='Open circuit board';
  const material=(color,metalness=.1,roughness=.5)=>new THREE.MeshStandardMaterial({color,metalness,roughness});
  const green=material(0x087e5c,.25,.45),black=material(0x172225),blue=material(0x145995,.2),silver=material(0xc1c7c2,.8,.28),gold=material(0xc9a55b,.78,.25),white=material(0xf0f0da),ceramic=material(0xd5ae65),copper=material(0x44a57a,.35,.6);
  function add(geometry,mat,x,y,z,parent=group){const m=new THREE.Mesh(geometry,mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
  function box(w,h,d,mat,x,y,z,parent=group){return add(new THREE.BoxGeometry(w,h,d),mat,x,y,z,parent);}
  function cyl(r,h,mat,x,y,z,parent=group){return add(new THREE.CylinderGeometry(r,r,h,28),mat,x,y,z,parent);}
  function text(label,x,z,w=1,size=40,color='#f1f4da',y=.37,parent=group){
    const c=document.createElement('canvas');c.width=512;c.height=128;const cx=c.getContext('2d');cx.font=`600 ${size}px Arial, sans-serif`;cx.textAlign='center';cx.textBaseline='middle';cx.fillStyle=color;cx.fillText(label,256,64);
    const tx=new THREE.CanvasTexture(c);tx.colorSpace=THREE.SRGBColorSpace;const m=add(new THREE.PlaneGeometry(w,w*.25),new THREE.MeshBasicMaterial({map:tx,transparent:true,depthWrite:false}),x,y,z,parent);m.rotation.x=-Math.PI/2;m.castShadow=false;return m;
  }
  function path(points,color,r=.022,parent=group){const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)),false,'centripetal');return add(new THREE.TubeGeometry(curve,Math.max(12,points.length*5),r,6,false),typeof color==='number'?material(color,.12,.45):color,0,0,0,parent);}
  function trace(points){return path(points.map(([x,z])=>[x,.349,z]),copper,.015);}
  const board=box(9.4,.16,6.6,green,0,.25,0);board.name='PCB';
  // Low feet and plated mounting holes keep every major device visible.
  for(const x of [-4.38,4.38])for(const z of [-2.98,2.98]){
    cyl(.14,.18,gold,x,.13,z);cyl(.12,.015,gold,x,.34,z);cyl(.064,.017,black,x,.351,z);
  }
  text('TRIO / ANALOG MIXER',-.4,-3.01,3.0,32);text('5 V',3.75,-3.00,.60,36);
  for(const z of [-2.68,-1.08,.9,1.14])trace([[-4.04,z],[-3.9,z+.06],[3.95,z+.06],[4.07,z]]);
  for(const x of [-4,-1.65,.1,2.05,4.04])trace([[x,-2.60],[x,1.18],[x+.15,1.31]]);

  const parts={};
  function part(id){const p=new THREE.Group();p.name=id;p.userData.control={type:'part',id};group.add(p);parts[id]=p;return p;}
  // 30-pin development board: 15 contacts along each side, shield, antenna, USB.
  const esp=part('esp32'),ex=-2.85,ez=-1.12;
  box(2.02,.13,3.30,black,ex,.445,ez,esp);
  for(const side of [-1,1]){
    box(.19,.19,3.0,black,ex+side*.85,.62,ez,esp);
    for(let i=0;i<15;i++){
      const z=ez-1.40+i*.2;box(.06,.21,.06,gold,ex+side*.85,.69,z,esp);
      const pad=add(new THREE.TorusGeometry(.067,.017,6,12),gold,ex+side*.87,.52,z,esp);pad.rotation.x=Math.PI/2;
    }
  }
  box(1.25,.19,1.26,silver,ex,.60,ez-.38,esp);text('ESP32',ex,ez-.53,1.04,63,'#364442',.703,esp);text('WROOM-32',ex,ez-.19,1.08,36,'#52625b',.704,esp);
  box(1.26,.07,.70,material(0x1e3430),ex,.54,ez-1.36,esp);
  path([[ex-.52,.58,ez-1.61],[ex-.52,.58,ez-1.1],[ex-.30,.58,ez-1.1],[ex-.30,.58,ez-1.61],[ex-.08,.58,ez-1.61],[ex-.08,.58,ez-1.1],[ex+.16,.58,ez-1.1],[ex+.16,.58,ez-1.61],[ex+.48,.58,ez-1.61]],gold,.023,esp);
  box(.49,.16,.35,silver,ex,.59,ez+1.62,esp);box(.33,.105,.04,black,ex,.59,ez+1.801,esp);
  box(.32,.08,.33,black,ex,.555,ez+.78,esp);box(.24,.095,.34,silver,ex+.46,.56,ez+.58,esp);
  for(const x of [ex-.53,ex+.53]){box(.25,.1,.20,silver,x,.58,ez+1.22,esp);box(.12,.05,.12,black,x,.66,ez+1.22,esp);}
  for(let i=0;i<6;i++)box(.10,.05,.17,i%2?black:ceramic,ex-.50+i*.20,.55,ez+.25,esp);
  text('01 ESP32',ex,.74,1.9,38);

  const sd=part('sd');box(1.30,.12,1.36,blue,-.75,.42,-2.12,sd);box(1.04,.12,.80,silver,-.75,.53,-2.18,sd);
  box(.77,.03,.47,black,-.75,.61,-2.02,sd);text('microSD',-.75,-2.07,.74,41,'#dce9dd',.633,sd);
  for(let i=0;i<6;i++)box(.07,.15,.08,gold,-1.22+i*.19,.51,-1.48,sd);text('02 SD CARD',-.75,-1.15,1.38,35);
  // Jumper harness: SD ↔ development board. Functional routes, not pin-level wiring.
  for(let i=0;i<4;i++)path([[-1.40,.65,-1.70+i*.15],[-1.54,.84,-1.47+i*.18],[-1.99,.78,-1.37+i*.18]],0x5c7f91,.021);

  function dip(id,x,z,title){const p=part(id);box(.76,.14,1.17,black,x,.47,z,p);box(.63,.22,1.14,material(0x1c2427),x,.61,z,p);
    for(let side of [-1,1])for(let i=0;i<4;i++){box(.18,.045,.085,silver,x+side*.41,.56,z-.42+i*.28,p);box(.05,.20,.085,silver,x+side*.49,.455,z-.42+i*.28,p);}
    cyl(.052,.008,white,x-.19,.725,z-.44,p);text(title,x,z,1.07,title.length>6?37:49,'#dbddd3',.731,p);return p;
  }
  dip('timer',-.68,.02,'NE555');dip('mixer',1.18,-.15,'MCP6002');dip('amp',3.20,-.05,'LM386');
  text('03 TONE',-.68,-.89,1.12,35);text('04 MIX',1.18,-1.02,1.02,35);text('06 AMP',3.20,.85,1.08,35);
  function resistor(x,z,rotate=false){const p=new THREE.Group();p.position.set(x,.46,z);p.rotation.y=rotate?Math.PI/2:0;group.add(p);box(.67,.035,.035,silver,0,0,0,p);const r=add(new THREE.CylinderGeometry(.062,.062,.34,12),ceramic,0,0,0,p);r.rotation.z=Math.PI/2;for(const [dx,col] of [[-.11,0x714625],[-.03,0x202323],[.04,0x8b3835],[.12,0xd6b457]]){const b=add(new THREE.CylinderGeometry(.064,.064,.034,12),material(col),dx,0,0,p);b.rotation.z=Math.PI/2;}}
  for(let i=0;i<4;i++){resistor(-1.5+i*.59,1.11,true);resistor(-1.5+i*.59,.85,true);}
  resistor(2.11,-.48,true);resistor(2.11,.32,true);resistor(.37,-.42,true);resistor(-.60,-.77);
  function capacitor(x,z,r=.14,h=.43){cyl(r,h,blue,x,.34+h/2,z);cyl(r*.97,.018,silver,x,.35+h,z);box(r*1.35,.006,.018,black,x,.365+h,z);box(.018,.006,r*1.35,black,x,.365+h,z);}
  capacitor(2.48,.43,.19,.57);capacitor(3.94,.35,.21,.65);capacitor(.37,-1.20,.13,.36);capacitor(2.19,-1.30,.16,.48);capacitor(3.86,-1.10,.15,.47);
  for(const [x,z] of [[-.08,-.44],[.65,-1.55],[2.40,-.58],[-1.53,-.72]])cyl(.095,.20,material(0xd68943),x,.43,z);
  const mic=part('mic');cyl(.28,.44,silver,1.18,.58,-2.25,mic);cyl(.25,.015,material(0x696f68),1.18,.811,-2.25,mic);
  for(let i=0;i<7;i++){let a=i*Math.PI*2/7;cyl(.025,.017,black,1.18+Math.cos(a)*.14,.824,-2.25+Math.sin(a)*.14,mic);}cyl(.04,.018,black,1.18,.827,-2.25,mic);text('05 MIC',1.18,-2.77,.87,39);
  // Output speaker with a visible cone, attached to the amplifier output pair.
  cyl(.69,.17,silver,3.50,.45,-2.10);cyl(.62,.20,black,3.50,.55,-2.10);
  add(new THREE.ConeGeometry(.55,.13,48,1,true),material(0x394442),3.50,.73,-2.10).rotation.x=Math.PI;
  add(new THREE.SphereGeometry(.19,24,12,0,Math.PI*2,0,Math.PI/2),black,3.50,.72,-2.10);
  text('8 OHM SPEAKER',3.48,-2.94,1.76,31);
  path([[3.62,.47,-.50],[4.23,.56,-.78],[4.16,.75,-1.73],[3.94,.58,-2.10]],0xd67859,.035);
  path([[3.82,.42,-.40],[4.37,.52,-.76],[4.30,.66,-1.89],[3.96,.48,-2.18]],0x222c2f,.035);
  // Colored wires indicate the three input paths towards the summing stage.
  path([[-1.98,.57,.06],[-1.78,.63,.43],[-1.75,.54,1.18],[-2.94,.47,1.42]],0x5cbeed,.026);
  path([[-3.03,.40,1.34],[-3.03,.385,1.25],[.85,.385,1.25],[1.08,.42,.43]],0x5cbeed,.022);
  path([[-.20,.52,.20],[.12,.67,.44],[-1.05,.53,1.47]],0xefb15c,.027);
  path([[-1.05,.39,1.38],[.81,.385,1.39],[1.33,.46,.39]],0xefb15c,.023);
  path([[1.19,.52,-2.02],[1.80,.64,-1.92],[1.81,.58,-.40],[1.67,.53,-.31]],0xeb89a9,.027);
  path([[1.70,.49,.13],[1.97,.62,.68],[1.10,.49,1.45]],0xeb89a9,.026);
  path([[1.64,.51,.20],[2.28,.68,.99],[3.06,.49,1.42]],0xd7e797,.027);

  const knobs=[];const knobMat=material(0x34444a,.4,.35),accent=material(0xd6f48c,.15,.35);
  for(let i=0;i<4;i++){
    let x=-3.05+i*2.05,z=1.79;const p=new THREE.Group();p.position.set(x,.34,z);p.userData.control={type:'knob',index:i};group.add(p);
    box(.65,.22,.61,silver,0,.12,0,p);for(let k=-1;k<=1;k++)box(.05,.04,.23,gold,k*.2,.09,-.38,p);
    const rotor=new THREE.Group();rotor.position.y=.22;p.add(rotor);cyl(.29,.38,i===3?accent:knobMat,0,.20,0,rotor);box(.028,.015,.16,i===3?black:white,0,.40,-.14,rotor);knobs.push(rotor);
    text(['MUSIC','KEY','MIC','MASTER'][i],x,2.29,1.10,38);
  }
  const keys=[];
  for(let i=0;i<8;i++){
    const p=new THREE.Group();p.position.set(-3.50+i,.34,2.80);p.userData.control={type:'key',index:i};group.add(p);box(.60,.09,.45,black,0,.05,0,p);box(.49,.09,.36,silver,0,.12,0,p);const key=cyl(.145,.115,white,0,.21,0,p);keys.push(key);text(['C','D','E','F','G','A','B','C\u2032'][i],-3.50+i,3.18,.39,64);
  }
  const switchGroup=new THREE.Group();switchGroup.userData.control={type:'power'};group.add(switchGroup);box(.47,.19,.38,black,-4.07,.48,-2.47,switchGroup);box(.20,.08,.30,white,-4.07,.615,-2.47,switchGroup);text('PWR',-4.07,-2.05,.53,45);
  const ledMat=new THREE.MeshStandardMaterial({color:0x79b846,emissive:0x88ff33,emissiveIntensity:0});cyl(.067,.13,ledMat,-4.07,.44,-1.65);
  // Outline marks the selected functional area without hiding its components.
  const outline=new THREE.Line(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:0xe3ff96}));outline.position.y=.85;group.add(outline);
  function select(id){const p=BOARD_PARTS[id];if(!p){outline.visible=false;return;}outline.visible=true;const [x,,z]=p.center,[w,d]=p.size;outline.geometry.dispose();outline.geometry=new THREE.BufferGeometry().setFromPoints([[-w/2,-d/2],[w/2,-d/2],[w/2,d/2],[-w/2,d/2],[-w/2,-d/2]].map(([a,b])=>new THREE.Vector3(x+a,0,z+b)));}
  select('esp32');
  return {group,parts,select,update(state){knobs.forEach((p,i)=>{p.rotation.y=(-135+state.volumes[i]*270)*Math.PI/180;});keys.forEach((k,i)=>{k.position.y=state.power&&state.note===i?.17:.21;});ledMat.emissiveIntensity=state.power?1.8:0;}};
}
