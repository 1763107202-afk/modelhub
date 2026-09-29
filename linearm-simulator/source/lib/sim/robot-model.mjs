import * as THREE from 'three';
import {MeArmModel} from './mearm-model.mjs';
import {material,mesh,box,cylinder,roundedRect,hole,slot,plate,bolt,cable} from './model-parts.mjs';

export function makeRobot(config){
 const root=new THREE.Group(),parts={};
 const metal=material(0xbac8ca,{metalness:.72,roughness:.27}),tire=material(0x172026,{roughness:.88}),yellow=material(0xf0cb1e,{roughness:.42}),dark=material(0x1c252c),green=material(0x205b46),white=material(0xe9ece4),acrylic=material(0xbddfe0,{transparent:true,opacity:.48,roughness:.2,metalness:.08,depthWrite:false});
 // The deck is 36 cm long, compared with the former 28 cm block.
 // Its front edge stays behind the unchanged 17 cm sensor sample position.
 for(const [y,w,l] of [[.096,.198,.36],[.182,.202,.35]]){
  const shape=roundedRect(-w/2,-l/2-.025,w,l,.025);
  for(const x of [-.08,.08])for(const r of [-.15,-.02,.125])hole(shape,x,r,.003);
  for(const x of [-.047,.034])slot(shape,x,-.045,.013,.052,.004);
  const deck=plate(root,shape,.004,acrylic,'flat');deck.position.y=y;
  const perimeter=new THREE.EdgesGeometry(deck.geometry,30);const edges=new THREE.LineSegments(perimeter,new THREE.LineBasicMaterial({color:0xa9c5c8,transparent:true,opacity:.8}));edges.position.copy(deck.position);root.add(edges);
 }
 for(const x of [-.08,.08])for(const z of [-.125,.02,.15]){cylinder(root,.003,.086,metal,x,.138,z);cylinder(root,.0048,.075,white,x,.139,z);bolt(root,metal,x,.187,z,'y');}
 parts.wheels=[];
 for(const x of [-.116,.116])for(const z of [-.105,.125]){
  const w=new THREE.Group();w.position.set(x,.052,z);root.add(w);
  const t=cylinder(w,.052,.033,tire);t.rotation.z=Math.PI/2;
  // An open five-spoke yellow wheel face on each side, with rubber tread.
  for(const face of [-1,1]){
   const ring=mesh(w,new THREE.TorusGeometry(.037,.005,7,28),yellow,face*.018,0,0);ring.rotation.y=Math.PI/2;
   const hub=cylinder(w,.011,.005,yellow,face*.019,0,0);hub.rotation.z=Math.PI/2;
   for(let n=0;n<5;n++){const a=n*Math.PI*2/5,spoke=box(w,.006,.013,.033,yellow,face*.018,Math.sin(a)*.021,Math.cos(a)*.021);spoke.rotation.x=-a;}
  }
  for(let n=0;n<22;n++){const a=n*Math.PI*2/22,b=box(w,.034,.004,.01,tire,0,Math.cos(a)*.052,Math.sin(a)*.052);b.rotation.x=a;}
  const axle=cylinder(w,.004,.043,metal);axle.rotation.z=Math.PI/2;parts.wheels.push(w);
  box(root,.031,.027,.049,yellow,x*.70,.06,z);const motor=cylinder(root,.012,.033,metal,x*.7,.066,z+.034);motor.rotation.x=Math.PI/2;
 }
 // Battery holder, two motor drivers, ESP32 board and visible plug headers.
 box(root,.075,.034,.08,dark,-.035,.119,.115);
 for(const x of [-.054,-.024]){const cell=cylinder(root,.013,.066,material(0x5a635b),x,.127,.115);cell.rotation.x=Math.PI/2;const cap=cylinder(root,.012,.004,metal,x,.127,.149);cap.rotation.x=Math.PI/2;}
 for(const z of [-.062,.015]){
  box(root,.06,.003,.048,green,.037,.109,z);box(root,.032,.009,.026,dark,.038,.117,z);
  for(let i=0;i<5;i++)box(root,.003,.032,.025,dark,.022+i*.007,.133,z);
  for(const x of [.015,.06])box(root,.009,.012,.03,material(0x3c987d),x,.117,z);
 }
 box(root,.045,.003,.058,green,-.038,.111,-.055);box(root,.023,.007,.029,metal,-.038,.117,-.05);box(root,.022,.003,.012,dark,-.038,.115,-.076);
 for(let i=0;i<8;i++)for(const x of [-.062,-.014])box(root,.004,.006,.002,metal,x,.117,-.077+i*.006);
 for(const [i,color] of [0xef862f,0xd85543,0x34475a,0xf1cc50,0x558d70,0xebc2a1].entries())cable(root,[[-.03,.143,.105],[.075-i*.006,.166,.05],[.02,.146,-.045-i*.01],[-.05,.12,-.06]],color,.0013);
 // Long top tray and rear arm pedestal follow the two supplied side views.
 for(const x of [-.051,.051]){const tray=cylinder(root,.029,.005,material(0x28362e),x,.191,-.044);const rim=mesh(root,new THREE.TorusGeometry(.0275,.0025,6,24),metal,x,.195,-.044);rim.rotation.x=Math.PI/2;}
 const pack=plate(root,roundedRect(-.036,-.025,.072,.06,.007),.023,material(0xe9e5e1),'flat');pack.position.set(.008,.2,-.125);
 box(root,.052,.002,.018,material(0xc9c3c3),.008,.213,-.131);cable(root,[[.037,.2,-.116],[.086,.183,-.115],[.06,.118,-.06]],0xe1ded8,.003);
 parts.sensorMounts=new THREE.Group();root.add(parts.sensorMounts);
 for(const x of [-.047,.047]){cylinder(parts.sensorMounts,.0025,.065,metal,x,.063,-config.sensorForward);bolt(parts.sensorMounts,metal,x,.098,-config.sensorForward,'y');}
 parts.sensorBar=box(root,.115,.006,.022,green,0,.028,-config.sensorForward);parts.sensors=[];
 for(let i=0;i<4;i++){const g=new THREE.Group();box(g,.013,.009,.015,dark);cylinder(g,.003,.003,metal,0,-.006,0);const status=mesh(g,new THREE.SphereGeometry(.0028,8,6),new THREE.MeshBasicMaterial({color:0x64e0cd}),0,.007,.003);root.add(g);parts.sensors.push(g);g.userData.status=status;}
 parts.mearm=new MeArmModel(config);root.add(parts.mearm.root);
 return{root,...parts};
}
