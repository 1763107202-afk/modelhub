import * as THREE from 'three';
import {armPoints,ARM_MOUNT_Z} from './world.mjs';
import {material,box,cylinder,roundedRect,hole,slot,plate,bolt,servo,cable} from './model-parts.mjs';

// All moving plates use the same pivot positions as the simulated gripper.
// Laser-cut plywood and blue micro servos follow the user's actual car photos.
export class MeArmModel{
 constructor(config){
  this.root=new THREE.Group();this.root.position.z=ARM_MOUNT_Z;
  this.ply=material(0xdcc68f,{roughness:.68});this.edge=material(0x96733f,{roughness:.74});this.plates=[this.ply,this.edge];this.metal=material(0xbfcbd0,{metalness:.75,roughness:.26});this.blue=material(0x145ca6,{roughness:.3});this.black=material(0x202833);
  const platform=roundedRect(-.065,-.064,.13,.126,.009);for(const x of [-.05,.05])for(const y of [-.047,.047])hole(platform,x,y,.0025);
  const base=plate(this.root,platform,.004,this.plates,'flat');base.position.y=.243;
  for(const x of [-.05,.05])for(const z of [-.047,.047]){cylinder(this.root,.0035,.056,this.metal,x,.214,z);cylinder(this.root,.0055,.041,material(0xe1e8df),x,.215,z);bolt(this.root,this.metal,x,.247,z,'y');}
  this.baseServo=servo(this.root,this.blue,this.metal);this.baseServo.position.set(0,.231,0);
  this.yaw=new THREE.Group();this.root.add(this.yaw);
  const turn=plate(this.yaw,roundedRect(-.051,-.048,.102,.096,.009),.004,this.plates,'flat');turn.position.y=.253;
  cylinder(this.yaw,.027,.004,this.edge,0,.249,0);
  for(const x of [-.032,.032]){
   const frame=roundedRect(-.039,.26,.082,.076,.009);slot(frame,-.018,.274,.033,.028,.002);hole(frame,0,.315,.004);hole(frame,-.034,.331,.003);for(const r of [-.03,.033])hole(frame,r,.266,.002);
   const p=plate(this.yaw,frame,.003,this.plates);p.position.x=x;
   for(const r of [-.03,.033])bolt(this.yaw,this.metal,x+(x>0?.003:-.003),.266,-r);
  }
  box(this.yaw,.061,.019,.003,this.plates,0,.266,.039);
  box(this.yaw,.061,.011,.003,this.plates,0,.27,-.041);
  for(const side of [-1,1]){const s=servo(this.yaw,this.blue,this.metal);s.position.set(side*.033,.315,0);s.rotation.z=-side*Math.PI/2;}
  for(const [i,color] of [0x342c29,0xcd4d2c,0xf1b32f].entries())cable(this.yaw,[[.039,.297,.015],[.058+i*.002,.276,.044],[.014,.257,.044],[.008,.239,.025]],color,.001);
  this.links=[];this.fixed=[];this.joints=[];this.buildLinkage(config);
 }
 strap(a,b,x,width,baseLength,slotted=false){
  const s=roundedRect(-width/2,-width/2,width,baseLength+width,width/2);hole(s,0,0,.0022);hole(s,0,baseLength,.0022);
  if(slotted&&baseLength>.07)slot(s,-width*.16,.017,width*.32,baseLength-.034,width*.12);
  const p=plate(this.yaw,s,.003,this.plates);this.links.push({p,a,b,x,length:baseLength});return p;
 }
 triangle(points,pivot,x,holes=[],rotation='fixed'){
  const s=new THREE.Shape();points.forEach(([r,y],i)=>i?s.lineTo(r,y):s.moveTo(r,y));s.closePath();holes.forEach(([r,y])=>hole(s,r,y,.0023));const p=plate(this.yaw,s,.003,this.plates);this.fixed.push({p,pivot,x,rotation});return p;
 }
 buildLinkage(config){
  const L=config.upperLength,F=config.foreLength;
  this.strap('a','b',-.023,.018,L,true);this.strap('a','b',.023,.018,L,true);
  this.strap('h','j',.038,.011,L);
  this.strap('a','d',-.04,.015,.042);
  this.strap('d','e',-.047,.011,L);
  for(const x of [-.02,.02])this.strap('b','c',x,.023,F,true);
  this.strap('j','k',.039,.01,F);
  this.triangle([[-.011,-.01],[.05,-.01],[.05,.01],[.005,.032],[-.011,.024]],'b',-.04,[[0,0],[.042,0]],'p2');
  this.triangle([[-.042,.008],[-.04,.027],[.01,.014],[.012,-.009],[-.006,-.015]],'b',.03,[[0,0],[-.034,.016]]);
  this.triangle([[-.041,.024],[-.042,.008],[-.01,-.013],[.025,-.013],[.025,.011]],'c',.03,[[0,0],[-.034,.016]]);
  this.axles=[];
  for(const name of ['a','b','c']){const width=name==='c'?.064:.092;const axle=cylinder(this.yaw,.0023,width,this.metal);axle.rotation.z=Math.PI/2;this.axles.push({axle,name});for(const side of [-1,1]){const x=side*width/2;const cap=bolt(this.yaw,this.metal,x,0,0);if(side<0)cap.rotation.z=Math.PI/2;this.joints.push({cap,name,x});}}
  for(const name of ['d','e','h','j','k']){const x=name==='d'||name==='e'?-.05:.043;const cap=bolt(this.yaw,this.metal,x,0,0);if(x<0)cap.rotation.z=Math.PI/2;this.joints.push({cap,name,x});}
  this.braces=Array.from({length:2},()=>box(this.yaw,.043,.008,.014,this.ply));
  this.head=new THREE.Group();this.yaw.add(this.head);
  const headShape=roundedRect(-.028,-.014,.056,.081,.007);hole(headShape,-.016,.037,.002);hole(headShape,.016,.037,.002);const hp=plate(this.head,headShape,.003,this.plates,'flat');hp.position.y=-.005;
  const clawServo=servo(this.head,this.blue,this.metal);clawServo.position.set(0,.031,.001);clawServo.rotation.y=Math.PI/2;
  this.jaws=[];this.gears=[];
  for(const side of [-1,1]){
   const pivot=new THREE.Group();pivot.position.set(side*.016,-.008,-.037);this.head.add(pivot);this.jaws.push(pivot);
   const shape=new THREE.Shape();const points=[[-.009,-.008],[.009,-.008],[.021,.009],[.023,.035],[-.006,.071],[-.013,.072],[-.013,.062],[.008,.033],[.005,.015],[-.008,.007]];
   points.forEach(([x,y],i)=>i?shape.lineTo(x*side,y):shape.moveTo(x*side,y));shape.closePath();hole(shape,0,0,.0024);
   plate(pivot,shape,.005,this.plates,'flat');
   // Small gripping teeth run along each inner jaw face.
   for(let j=0;j<5;j++){const t=box(pivot,.0025,.005,.004,this.edge,side*(-.01+j*.0038),0,-.063+j*.005);t.rotation.y=-side*.6;}
   const gearShape=new THREE.Shape();for(let i=0;i<48;i++){const a=i/48*Math.PI*2,r=i%4<2?.0165:.0145;const x=Math.cos(a)*r,y=Math.sin(a)*r;i?gearShape.lineTo(x,y):gearShape.moveTo(x,y);}gearShape.closePath();hole(gearShape,0,0,.0022);const gear=plate(pivot,gearShape,.003,this.edge,'flat');gear.position.y=.004;this.gears.push(gear);
   bolt(this.head,this.metal,side*.016,.001,-.037,'y');
  }
  this.clawWire=null;this.update([90,90,90,140],config);
 }
 update(angles,config){
  const p=armPoints(angles,config);this.yaw.rotation.y=p.az;this.pivots=p;
  for(const {p:o,a,b,x,length} of this.links){const A=p[a],B=p[b],dr=B.r-A.r,dy=B.y-A.y;o.position.set(x,A.y,-A.r);o.rotation.x=Math.atan2(-dr,dy);o.scale.y=Math.hypot(dr,dy)/length;}
  for(const {p:o,pivot,x,rotation} of this.fixed){const P=p[pivot];o.position.set(x,P.y,-P.r);o.rotation.x=rotation==='p2'?p.p2:0;}
  for(const {cap,name,x} of this.joints){cap.position.set(x,p[name].y,-p[name].r);}
  for(const {axle,name} of this.axles)axle.position.set(0,p[name].y,-p[name].r);
  this.braces.forEach((o,i)=>{const t=i?.72:.3;o.position.set(0,p.b.y+(p.c.y-p.b.y)*t,-p.b.r-(p.c.r-p.b.r)*t);o.rotation.x=p.p2;});
  this.head.position.set(0,p.c.y,-p.c.r);
  this.jaws.forEach((jaw,i)=>{const side=i?1:-1;jaw.rotation.y=-side*p.opening*.48;});
  if(this.clawWire){this.clawWire.geometry.dispose();this.yaw.remove(this.clawWire);this.clawWire.material.dispose();}
  this.clawWire=cable(this.yaw,[[-.034,.302,.02],[-.043,p.b.y+.014,-p.b.r],[-.041,p.c.y+.055,-p.c.r+.02],[0,p.c.y+.019,-p.c.r+.006]],0xcf612f,.0014);
 }
}
