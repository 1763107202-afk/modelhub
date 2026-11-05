import * as THREE from './vendor/three.module.js';
import {pointAt,tangentAt,advanceTheta,TAU,STATION_THETA,PATH} from './sequence.js';
import {V,group,material,luminous,mesh,box,cyl,ball,beam,boxBeam,torus,tube,roundedBox,textSign,batchStatic} from './geometry.js';

export function buildRide(scene){
 const fixed=group(scene,'FIXED_BASE'),rotating=group(scene,'ROTATING_PLATFORM'),service=group(fixed,'ServiceDeck');
 const mats={steel:material('#bac7d0',.88,.22),dark:material('#28313f',.84,.3),white:material('#d9e0e7',.72,.21),deck:material('#647082',.74,.34),concrete:material('#7d8795',.12,.86),black:material('#152333',.25,.66),rubber:material('#151c24',.1,.86),cyan:luminous('#3eceff',2.6),amber:luminous('#ff9a48',2.3),warning:luminous('#ffb96e',.5),glass:new THREE.MeshPhysicalMaterial({color:'#789cae',metalness:.15,roughness:.08,transparent:true,opacity:.38,side:THREE.DoubleSide})};
 const baseLift=3.2,stationA=pointAt(STATION_THETA,0),stationB=pointAt(TAU-STATION_THETA,1),dockY=stationA[1]+PATH.cabinOffset-1.08;
 // L0/L1: the foundation and outer service platform remain stationary.
 cyl(fixed,[0,.12,0],10,.24,mats.concrete);
 cyl(fixed,[0,.51,0],9.6,.62,mats.dark);cyl(fixed,[0,.88,0],9.25,.14,mats.white);
 torus(fixed,[0,.27,0],9.88,.045,mats.cyan);torus(fixed,[0,.95,0],9.18,.035,mats.amber);
 const terrace=mesh(fixed,new THREE.RingGeometry(6.4,9.1,96),mats.deck,[0,1.06,0]);terrace.rotation.x=-Math.PI/2;
 mesh(fixed,new THREE.CylinderGeometry(5.9,6.65,2.24,96),mats.dark,[0,2.17,0]);
 cyl(fixed,[0,3.30,0],6.08,.18,mats.white);cyl(fixed,[0,3.49,0],5.82,.18,mats.dark);
 torus(fixed,[0,3.61,0],5.2,.15,mats.dark);torus(fixed,[0,3.68,0],4.98,.105,mats.steel);torus(fixed,[0,3.69,0],5.34,.035,mats.cyan);
 for(let i=0;i<48;i++){const a=i/48*TAU,x=Math.cos(a),z=Math.sin(a);boxBeam(fixed,[x*6.58,1.1,z*6.58],[x*5.88,3.25,z*5.88],.11,.17,mats.steel);const panel=box(fixed,[x*6.38,1.72,z*6.38],[.055,.76,.24],i%2?mats.dark:mats.deck);panel.rotation.y=-a;beam(fixed,[x*6.64,1.1,z*6.64],[x*6.4,1.85,z*6.4],.022,i<24?mats.cyan:mats.amber);boxBeam(fixed,[x*6.5,1.07,z*6.5],[x*9.08,1.07,z*9.08],.025,.022,mats.steel);}
 for(let i=0;i<24;i++){const a=i/24*TAU,x=Math.cos(a),z=Math.sin(a);boxBeam(fixed,[0,3.48,0],[x*5.5,3.48,z*5.5],.14,.22,mats.dark);cyl(fixed,[x*5.8,3.43,z*5.8],.24,.18,mats.white);for(let j=0;j<4;j++){const q=j/4*TAU;cyl(fixed,[x*5.8+Math.cos(q)*.16,3.54,z*5.8+Math.sin(q)*.16],.022,.025,mats.steel);}}
 for(let i=0;i<80;i++){const a=i/80*TAU,b=(i+1)/80*TAU;if(Math.sin(a)<-.96)continue;const x=Math.cos(a)*9.13,z=Math.sin(a)*9.13;beam(fixed,[x,1.08,z],[x,2.14,z],.023,mats.steel);beam(fixed,[x,2.14,z],[Math.cos(b)*9.13,2.14,Math.sin(b)*9.13],.038,mats.white);const glass=box(fixed,[Math.cos((a+b)/2)*9.13,1.60,Math.sin((a+b)/2)*9.13],[.64,.86,.025],mats.glass);glass.rotation.y=Math.PI/2-(a+b)/2;}
 // L2: fixed bearing ring, rotating ring gear, and four physical drives.
 const deck= cyl(rotating,[0,.67+baseLift,0],5.5,.27,mats.deck);deck.name='RotatingDeck_11m';
 torus(rotating,[0,.82+baseLift,0],5.46,.036,mats.cyan);torus(rotating,[0,.55+baseLift,0],4.8,.085,mats.steel);
 for(let i=0;i<144;i++){const a=i/144*TAU,m=box(rotating,[Math.cos(a)*4.96,.48+baseLift,Math.sin(a)*4.96],[.13,.11,.13],mats.steel);m.rotation.y=-a;}
 for(let i=0;i<32;i++){const a=i/32*TAU;boxBeam(rotating,[Math.cos(a)*1.8,4.01,Math.sin(a)*1.8],[Math.cos(a)*5.35,4.01,Math.sin(a)*5.35],.024,.013,mats.steel);}
 for(let i=0;i<4;i++){
  const a=Math.PI/4+i*Math.PI/2,x=Math.cos(a)*5.65,z=Math.sin(a)*5.65,g=group(fixed,'SlewDrive_'+i);g.position.set(x,.55+baseLift,z);g.rotation.y=-a;
  roundedBox(g,[0,.14,0],[.64,.37,.46],.07,mats.white);box(g,[0,-.12,0],[.78,.12,.60],mats.dark);const motor=cyl(g,[0,.15,.42],.20,.52,mats.dark);motor.rotation.x=Math.PI/2;
  for(let j=0;j<6;j++){const m=cyl(g,[0,.15,.21+j*.055],.22,.02,mats.steel);m.rotation.x=Math.PI/2;}
  cyl(g,[-.18,.15,0],.055,.58,mats.steel);box(g,[.24,.36,0],[.12,.055,.16],mats.cyan);
 }
 // The small boarding dock belongs to the rotating platform. The exterior bridge is fixed.
 for(let side=0;side<2;side++){const z=side===0?-2.77:2.77,x=(side===0?stationA:stationB)[0];box(rotating,[x,dockY,z],[3.95,.12,1.02],mats.dark);for(let j=0;j<8;j++)box(rotating,[x-1.75+j*.5,dockY+.07,z],[.025,.012,.96],mats.steel);for(const dx of [-1.45,1.45])boxBeam(rotating,[x+dx,4.02,z],[x+dx,dockY-.08,z],.16,.18,mats.white);}
 for(const side of [0,1]){const x=(side?stationB:stationA)[0],s=side?1:-1;box(rotating,[x,dockY,s*4.30],[2.0,.12,2.03],mats.deck);for(const dx of [-.82,.82])boxBeam(rotating,[x+dx,4.02,s*4.95],[x+dx,dockY,s*4.95],.14,.16,mats.white);}
 const center=roundedBox(rotating,[0,1.01+baseLift,0],[3.0,.34,4.4],.16,mats.dark);center.name='CenterSupportSeat';
 cyl(rotating,[0,4.49,0],1.2,.30,mats.white);torus(rotating,[0,4.65,0],1.13,.035,mats.cyan);
 const tracks=[];
 function railVector(theta,side,outward=0,depth=0){const p=V(pointAt(theta,side)),t=V(tangentAt(theta,side)),n=new THREE.Vector3(t.y,-t.x,0);return p.addScaledVector(n,outward).add(new THREE.Vector3(0,0,depth));}
 for(let side=0;side<2;side++){
  const tr=group(rotating,side===0?'Track_A':'Track_B');tracks.push(tr);const color=side===0?mats.cyan:mats.amber;
  const pts=(out,depth)=>Array.from({length:160},(_,i)=>railVector(i/160*TAU,side,out,depth).toArray());
  tube(tr,pts(0,-.29),.072,mats.steel,true,320);tube(tr,pts(0,.29),.072,mats.steel,true,320);
  tube(tr,pts(.76,-.30),.092,mats.dark,true,320);tube(tr,pts(.76,.30),.092,mats.dark,true,320);
  for(const depth of [-.38,.38])for(const out of [.20,.62])tube(tr,pts(out,depth),.027,color,true,320);
  for(let i=0;i<96;i++){
   const t=i/96*TAU,tn=(i+1)/96*TAU,a=railVector(t,side,0,-.29),b=railVector(t,side,0,.29),c=railVector(t,side,.76,-.30),d=railVector(t,side,.76,.30);
   beam(tr,a.toArray(),b.toArray(),.033,mats.steel);beam(tr,c.toArray(),d.toArray(),.035,mats.steel);
   for(const dep of [-.30,.30]){beam(tr,railVector(t,side,0,dep).toArray(),railVector(t,side,.76,dep).toArray(),.035,mats.white);beam(tr,railVector(t,side,0,dep).toArray(),railVector(tn,side,.76,dep).toArray(),.029,mats.steel);}
   for(const dep of [-.34,.34]){boxBeam(tr,railVector(t+.002,side,.41,dep).toArray(),railVector(tn-.002,side,.41,dep).toArray(),.56,.046,i%8===0?mats.dark:mats.white);if(i%3===0){const bolt=cyl(tr,railVector(t+.015,side,.40,dep*1.11).toArray(),.021,.018,mats.dark);bolt.rotation.x=Math.PI/2;}}
  }
  // Two V frames per ring: feet on the rotating deck, all rail joints on the outside chord.
  for(let j=0;j<2;j++){
   const theta=side===0?[3.75,4.82][j]:TAU-[3.75,4.82][j];const tip=railVector(theta,side,.80,side===0?-2.15:2.15).toArray();
   const footX=(side===0?-1:1)*(j===0?1.8:3.5),footZ=side===0?-3.3:3.3;
   for(const dx of [-.40,.40]){const foot=[footX+dx,1.01+baseLift,footZ];box(rotating,foot,[.7,.12,.65],mats.white);boxBeam(rotating,foot,tip,.30,.34,mats.white);const fv=V(foot),tv=V(tip),at=u=>fv.clone().lerp(tv,u).toArray();beam(rotating,at(.08),at(.58),.22,mats.steel);beam(rotating,at(.59),at(.92),.13,mats.dark);for(const u of [.10,.56,.88])beam(rotating,at(u),at(u+.017),.26,mats.dark);for(let k=0;k<4;k++){const a=k/4*TAU;cyl(rotating,[footX+dx+Math.cos(a)*.22,1.09+baseLift,footZ+Math.sin(a)*.22],.024,.07,mats.steel);}}
   ball(rotating,tip,.28,mats.dark);const p=railVector(theta,side,.80,side===0?-.30:.30).toArray();beam(rotating,tip,p,.16,mats.steel);for(const dz of [-.23,.23]){const collar=cyl(rotating,[tip[0],tip[1],tip[2]+dz],.34,.08,mats.white);collar.rotation.x=Math.PI/2;}for(let k=0;k<8;k++){const a=k/8*TAU;const bolt=cyl(rotating,[tip[0]+Math.cos(a)*.25,tip[1]+Math.sin(a)*.25,tip[2]+.285],.026,.055,mats.dark);bolt.rotation.x=Math.PI/2;}
  }
 }
 // Maintenance bridge, steps, guardrails, and access gates.
 const stationX=stationA[0];box(service,[stationX,dockY,-8.0],[2.1,.14,4.65],mats.deck);
 for(const x of [stationX-1.03,stationX+1.03]){for(let z=-10.2;z<-5.8;z+=.67)beam(service,[x,dockY+.09,z],[x,dockY+1.07,z],.026,mats.steel);beam(service,[x,dockY+1.07,-10.25],[x,dockY+1.07,-5.7],.035,mats.white);beam(service,[x,dockY+.58,-10.25],[x,dockY+.58,-5.7],.022,mats.steel);for(const z of [-10.02,-6.1])boxBeam(service,[x,.28,z],[x,dockY-.08,z],.18,.22,mats.white);}
 const steps=32,rise=(dockY+.07)/steps,tread=.30,firstZ=-10.3-(steps-1)*tread;
 for(let i=0;i<steps;i++){const y=(i+1)*rise;box(service,[stationX,y-.06,firstZ+i*tread],[2.1,.12,.32],mats.deck);box(service,[stationX,y+.005,firstZ+i*tread-.13],[1.98,.014,.04],i%4===0?mats.cyan:mats.steel);}
 for(const x of [stationX-1.10,stationX+1.10]){boxBeam(service,[x,rise-.14,firstZ-.1],[x,dockY-.10,-10.1],.13,.18,mats.dark);beam(service,[x,rise+1.02,firstZ-.1],[x,dockY+1.05,-10.1],.037,mats.white);for(let i=0;i<steps;i+=3){const y=(i+1)*rise;beam(service,[x,y-.05,firstZ+i*tread],[x,y+1.04,firstZ+i*tread],.025,mats.steel);}}
 for(let i=0;i<96;i++){const a=i/96*TAU;if(Math.abs(Math.atan2(Math.cos(a),-Math.sin(a)))<.19)continue;const x=Math.cos(a)*11.25,z=Math.sin(a)*11.25;beam(fixed,[x,.26,z],[x,1.55,z],.025,mats.steel);const b=(i+1)/96*TAU;beam(fixed,[x,1.55,z],[Math.cos(b)*11.25,1.55,Math.sin(b)*11.25],.033,mats.dark);beam(fixed,[x,.87,z],[Math.cos(b)*11.25,.87,Math.sin(b)*11.25],.02,mats.steel);}
 const gates=[];for(const sign of [-1,1]){const g=group(service,'BoardingGate');g.userData.dynamic=true;g.position.set(stationX+sign*1.02,dockY+.07,-5.82);for(let y of [.25,.6,.94])box(g,[sign*-.5,y,0],[1.0,.028,.08],mats.white);beam(g,[sign*-.99,.07,0],[sign*-.99,1.08,0],.024,mats.steel);gates.push(g);}
 const rearService=service.clone(true);rearService.name='ServiceDeck_B';rearService.rotation.y=Math.PI;fixed.add(rearService);rearService.traverse(o=>{if(o.name==='BoardingGate')gates.push(o);});
 // Two independent path carriers; bogies and roll modules are not baked into the track.
 const cabins=[];
 for(let side=0;side<2;side++){
  const path=group(rotating,side===0?'CAR_A_PATH':'CAR_B_PATH'),bogie=group(path,'Bogie'),frame=group(path,'Cabin_Frame'),inner=group(path,'Cabin_Inner');path.userData.dynamic=true;inner.position.y=2.2;
  const color=side===0?mats.cyan:mats.amber;
  const suit=material(side===0?'#557e91':'#916d59',0,.8),skin=material('#c6ac97',0,.84);
  const wheels=[],restraints=[],trucks=[];
  for(const z of [-1.27,1.27]){
   const truck=group(bogie,'ArticulatedBogie');truck.position.z=z;truck.userData.offset=z;trucks.push(truck);
   roundedBox(truck,[0,.13,0],[.92,.21,.38],.045,mats.dark);box(truck,[0,.35,0],[.74,.12,.25],mats.white);
   for(const x of [-.30,.30]){
    const w=cyl(truck,[x,.19,0],.19,.14,mats.rubber);w.rotation.z=Math.PI/2;wheels.push(w);const hub=cyl(truck,[x*1.13,.19,0],.09,.02,mats.steel);hub.rotation.z=Math.PI/2;
    const anti=cyl(truck,[x,-.18,0],.095,.10,mats.rubber);anti.rotation.z=Math.PI/2;wheels.push(anti);
    const guide=cyl(truck,[x*1.38,-.015,0],.095,.12,mats.rubber);wheels.push(guide);
    box(truck,[x,.12,.25],[.16,.17,.28],mats.dark);box(truck,[x,.25,.24],[.16,.03,.21],mats.steel);
   }
   roundedBox(truck,[0,.37,0],[.34,.24,.36],.045,mats.white);box(truck,[.22,.45,0],[.055,.10,.16],color);
   // Independent front and rear end bearings leave the rolling passenger module unobstructed.
   const end=z<0?-1.75:1.75;boxBeam(frame,[0,.37,z],[0,2.2,end],.15,.17,mats.white);torus(frame,[0,2.2,end],.28,.062,mats.steel,'z');torus(frame,[0,2.2,end],.36,.042,color,'z');beam(frame,[0,2.2,end-.14],[0,2.2,end+.14],.11,mats.dark);
   const m=cyl(frame,[.38,2.2,end],.17,.28,mats.dark);m.rotation.x=Math.PI/2;roundedBox(frame,[.36,2.2,end],[.40,.38,.30],.045,mats.white);
  }
  // Passenger hull: 3.6m length, 2.1m width and 2.3m neutral envelope including protection.
  const hull=roundedBox(inner,[0,-.89,0],[1.97,.28,3.17],.12,mats.white);hull.name='PassengerHull';
  roundedBox(inner,[0,-1.06,0],[1.75,.12,2.96],.08,mats.dark);
  for(const x of [-1.0,1.0]){box(inner,[x,-.49,0],[.08,.54,2.97],mats.white);tube(inner,[[x,-.76,-1.48],[x,-.71,-.65],[x,-.72,.65],[x,-.76,1.48]],.029,color);}
  for(const z of [-1.47,1.47]){roundedBox(inner,[0,-.45,z],[1.98,.68,.13],.09,mats.white);box(inner,[0,-.4,z*1.047],[1.73,.07,.025],color);}
  // Elliptical end hoops and longitudinal canopy spars form the capsule silhouette in the render.
  for(const z of [-1.42,1.42]){const hoop=Array.from({length:64},(_,i)=>{const a=i/64*TAU;return [Math.cos(a)*.992,Math.sin(a)*1.075,z];});tube(inner,hoop,.048,mats.white,true,96);const trim=Array.from({length:48},(_,i)=>{const a=i/48*TAU;return [Math.cos(a)*.938,Math.sin(a)*1.02,z+(z>0?.027:-.027)];});tube(inner,trim,.023,color,true,72);}
  for(const x of [-.72,.72]){boxBeam(inner,[x,.78,-1.42],[x,.78,1.42],.085,.075,mats.white);tube(inner,[[x,.824,-1.41],[x,.824,0],[x,.824,1.41]],.019,color);}
  roundedBox(inner,[0,1.02,0],[.37,.09,2.76],.038,mats.dark);box(inner,[0,1.071,0],[.13,.017,2.62],color);
  for(const sign of [-1,1]){const vertices=[],indices=[];for(let i=0;i<=18;i++){const a=.12+i/18*1.22;for(const z of [-1.32,1.32])vertices.push(sign*.965*Math.cos(a),1.04*Math.sin(a),z);}for(let i=0;i<18;i++){const k=i*2;indices.push(k,k+1,k+2,k+1,k+3,k+2);}const geom=new THREE.BufferGeometry();geom.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geom.setIndex(indices);geom.computeVertexNormals();const canopy=mesh(inner,geom,mats.glass);canopy.name='CurvedCapsuleGlazing';}
  for(const z of [-1.54,1.54])for(const x of [-.84,.84]){const bolt=cyl(inner,[x,-.43,z],.028,.034,mats.dark);bolt.rotation.x=Math.PI/2;}
  for(let row=0;row<2;row++)for(let col=0;col<4;col++){
   const x=(col-1.5)*.49,z=row===0?-.69:.66,seat=group(inner,'Seat_'+(row*4+col+1));seat.position.set(x,-.62,z);
   roundedBox(seat,[0,.09,0],[.43,.16,.45],.055,mats.dark);const back=roundedBox(seat,[0,.52,-.15],[.44,.87,.12],.055,mats.black);back.rotation.x=-.075;roundedBox(seat,[0,1.0,-.19],[.27,.20,.13],.04,mats.dark);
   // Visible 5th/50th/95th percentile silhouettes, with arms inside the restraint envelope.
   const bodyHeight=[.50,.57,.63][(row*4+col)%3];
   ball(seat,[0,.22,0],[.17,.17,.15],suit);ball(seat,[0,.43+bodyHeight*.21,-.075],[.18,bodyHeight*.53,.115],suit);ball(seat,[0,.52+bodyHeight,-.07],[.12,.145,.12],skin);
   for(const sign of [-1,1]){beam(seat,[sign*.10,.24,.04],[sign*.12,.20,.31],.065,suit);beam(seat,[sign*.12,.20,.31],[sign*.12,-.28,.30],.052,suit);ball(seat,[sign*.12,-.29,.38],[.075,.055,.12],mats.black);beam(seat,[sign*.15,.67,-.05],[sign*.18,.39,.08],.044,suit);beam(seat,[sign*.18,.39,.08],[sign*.12,.32,.20],.037,skin);}
   const bar=group(seat,'ShoulderRestraint');bar.userData.dynamic=true;bar.position.set(0,.87,-.18);for(const sign of [-1,1]){tube(bar,[[sign*.15,0,0],[sign*.20,-.10,.14],[sign*.20,-.40,.28],[sign*.15,-.63,.25]],.035,mats.white);beam(bar,[sign*.13,-.54,.25],[sign*.13,-.37,.27],.024,mats.dark);}beam(bar,[-.15,-.63,.25],[.15,-.63,.25],.03,mats.white);box(bar,[0,-.59,.28],[.09,.06,.055],color);restraints.push(bar);
   box(seat,[0,.25,.11],[.05,.015,.15],mats.black);
  }
  // Faceted wind deflector and end identifiers are small, separate details.
  const glass=roundedBox(inner,[0,.02,1.50],[1.80,.35,.025],.06,mats.glass);glass.rotation.x=.18;
  textSign(inner,side===0?'A  /  08':'B  /  08',[0,-.29,1.57],.74,side===0?'#94f7ff':'#ffd5ae');
  const envelope=mesh(inner,new THREE.BoxGeometry(2.1,2.3,3.6),new THREE.MeshBasicMaterial({color:side===0?'#4ce0f2':'#ffc092',wireframe:true,transparent:true,opacity:.42}),[0,0,0]);envelope.visible=false;
  batchStatic(inner);batchStatic(frame);for(const wheel of wheels)wheel.userData.dynamic=true;for(const truck of trucks){truck.userData.dynamic=true;batchStatic(truck);}
  cabins.push({path,inner,frame,bogie,trucks,wheels,restraints,envelope,side,hull});
 }
 batchStatic(fixed);batchStatic(rotating);
 // Only the fixed and rotating structures are batched; moving cabins keep separate hierarchies.
 return {fixed,rotating,tracks,cabins,gates,mats,deck,service};
}

export function placeCabin(cabin,theta,roll,distance,locked){
 const p=V(pointAt(theta,cabin.side)),forward=V(tangentAt(theta,cabin.side)).multiplyScalar(cabin.side===0?1:-1),cross=new THREE.Vector3(0,0,cabin.side===0?-1:1),up=forward.clone().cross(cross).normalize();
 cabin.path.position.copy(p);cabin.path.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(cross,up,forward));cabin.inner.rotation.z=cabin.side===0?roll:-roll;
 for(const truck of cabin.trucks){const th=advanceTheta(theta,truck.userData.offset*(cabin.side===0?1:-1)),tp=V(pointAt(th,cabin.side)),tf=V(tangentAt(th,cabin.side)).multiplyScalar(cabin.side===0?1:-1),tu=tf.clone().cross(cross).normalize();truck.position.copy(tp.sub(p).applyQuaternion(cabin.path.quaternion.clone().invert()));truck.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(cross,tu,tf));truck.quaternion.premultiply(cabin.path.quaternion.clone().invert());}
 for(const wheel of cabin.wheels)wheel.rotation.x=distance/.19;
 const angle=typeof locked==='number'?-.82*(1-locked):locked?0:-.82;for(const bar of cabin.restraints)bar.rotation.x=angle;
}
