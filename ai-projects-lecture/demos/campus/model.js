import * as THREE from 'three';
import {buildExtendedCampus} from './campus-extension.js?v=7';
import {teachingWingCenters,teachingWingDepth,inSideEntranceRoad,inReservedGround,adminOffsetZ} from './layout.js?v=7';

// Dimensions are estimated from the entrance photos and the added courtyard panorama.
// +Z faces the street. The gate, pool and main building share the X=0 axis.
export function buildCampus(scene) {
  let seed=240913;
  const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};
  const snow=new THREE.Group();snow.name='积雪';scene.add(snow);
  const batches=new Map(), snowBatches=new Map();
  let offsetZ=0;
  const worldZ=z=>z+offsetZ;
  function withZOffset(delta,build){const before=offsetZ;offsetZ+=delta;try{return build();}finally{offsetZ=before;}}
  const boxGeo=new THREE.BoxGeometry(1,1,1), ballGeo=new THREE.IcosahedronGeometry(1,1), trunkGeo=new THREE.CylinderGeometry(.65,1,1,8);
  const leafGeo=new THREE.BufferGeometry();
  leafGeo.setAttribute('position',new THREE.Float32BufferAttribute([
    0,0,0,-.32,.04,.43,0,.15,.57, 0,0,0,0,.15,.57,.32,.04,.43,
    -.32,.04,.43,0,0,1.13,0,.15,.57, .32,.04,.43,0,.15,.57,0,0,1.13
  ],3));leafGeo.computeVertexNormals();
  const crownGeo=new THREE.IcosahedronGeometry(1,1);
  const distantCrownGeo=new THREE.IcosahedronGeometry(1,0);
  const crownPoints=crownGeo.attributes.position;
  for(let i=0;i<crownPoints.count;i++){const x=crownPoints.getX(i),y=crownPoints.getY(i),z=crownPoints.getZ(i),s=.9+.085*Math.sin(x*8+y*7)+.065*Math.cos(z*11-x*5);crownPoints.setXYZ(i,x*s,y*s,z*s);}
  crownPoints.needsUpdate=true;crownGeo.computeBoundingSphere();
  const wind={time:{value:0},strength:{value:.6}};
  const temp=new THREE.Object3D();
  const mat=(color,roughness=.7,metalness=0,extra={})=>new THREE.MeshStandardMaterial({color,roughness,metalness,...extra});
  function noiseTexture(size=128){const c=document.createElement('canvas');c.width=c.height=size;const q=c.getContext('2d');const d=q.createImageData(size,size);for(let i=0;i<d.data.length;i+=4){const v=212+random()*43;d.data[i]=d.data[i+1]=d.data[i+2]=v;d.data[i+3]=255}q.putImageData(d,0,0);const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(2,2);t.colorSpace=THREE.SRGBColorSpace;return t;}
  const noise=noiseTexture();
  const M={
    stone:mat('#d9d9cf',.88,0,{map:noise}),white:mat('#eeeee5',.75),seam:mat('#adb0a8',.85),
    bronze:mat('#7c6850',.66,.27),gold:mat('#d7aa63',.5,.22),dark:mat('#303d41',.78),
    glass:mat('#4c8294',.24,.42,{envMapIntensity:1.35}),glassLight:mat('#6e9cac',.2,.38),
    frame:mat('#bbc8c7',.39,.45),steel:mat('#a5b6b7',.31,.67),road:mat('#444f54',.92),
    paving:mat('#a5aca8',.9,0,{map:noise}),paveLine:mat('#c5c9c1',.9),waterEdge:mat('#424f52',.44,.12),
    lawn:mat('#6c884c',.96),soil:mat('#625c43',1),hedge:mat('#4a6d3b',.95),bark:mat('#796d59',1,0,{map:noise}),
    leafA:mat('#5e863e',.92),leafB:mat('#83a64d',.92),leafC:mat('#3d653a',.94),
    leafFineA:mat('#729549',.9,0,{side:THREE.DoubleSide}),leafFineB:mat('#a0b768',.95,0,{side:THREE.DoubleSide}),leafFineC:mat('#416b3c',.94,0,{side:THREE.DoubleSide}),
    shrub:mat('#829447',.95),roof:mat('#4b5454',.91),blind:mat('#a4b1aa',.82),
    glassTintA:mat('#779da6',.25,.34),glassTintB:mat('#4e7482',.26,.4),
    snow:mat('#edf5f8',.84),mark:mat('#e3e2cd',.88),red:mat('#a6292d',.7),
    light:mat('#e9d4a4',.4,0,{emissive:'#ffd894',emissiveIntensity:0}),
    glassGlow:mat('#547f8e',.25,.3,{emissive:'#efbf70',emissiveIntensity:0})
  };
  // Only the fine leaves move; woody stems and the broad shadow volumes stay stable.
  for(const material of [M.leafFineA,M.leafFineB,M.leafFineC]){
    material.onBeforeCompile=shader=>{
      shader.uniforms.campusWindTime=wind.time;shader.uniforms.campusWindStrength=wind.strength;
      shader.vertexShader='uniform float campusWindTime;\nuniform float campusWindStrength;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
        #ifdef USE_INSTANCING
          float leafPhase=instanceMatrix[3].x*.31+instanceMatrix[3].z*.19;
          transformed.x+=sin(campusWindTime*1.6+leafPhase+position.z*2.)*.09*campusWindStrength;
          transformed.y+=cos(campusWindTime*1.2+leafPhase)*.045*campusWindStrength;
        #endif`);
    };
    material.customProgramCacheKey=()=> 'campus-leaves-v2';
  }
  function instance(geometry,material,x,y,z,sx,sy,sz,rx=0,ry=0,rz=0,isSnow=false,cast=true){
    const map=isSnow?snowBatches:batches,key=geometry.uuid+material.uuid+cast;
    if(!map.has(key))map.set(key,{geometry,material,matrices:[],cast});
    temp.position.set(x,y,worldZ(z));temp.scale.set(sx,sy,sz);temp.rotation.set(rx,ry,rz);temp.updateMatrix();map.get(key).matrices.push(temp.matrix.clone());
  }
  function box(x,y,z,w,h,d,material=M.stone,ry=0,isSnow=false,cast=true){instance(boxGeo,material,x,y,z,w,h,d,0,ry,0,isSnow,cast);}
  function ball(x,y,z,sx,sy,sz,material,isSnow=false){instance(ballGeo,material,x,y,z,sx,sy,sz,0,random()*6,0,isSnow);}
  function pole(x,y,z,r,h,material=M.steel){instance(trunkGeo,material,x,y,z,r,h,r);}
  function beam(a,b,r,material=M.frame,isSnow=false){const A=new THREE.Vector3(...a),B=new THREE.Vector3(...b),C=A.clone().add(B).multiplyScalar(.5);C.z+=offsetZ;const map=isSnow?snowBatches:batches,key=trunkGeo.uuid+material.uuid+true;if(!map.has(key))map.set(key,{geometry:trunkGeo,material,matrices:[],cast:true});temp.position.copy(C);temp.scale.set(r,A.distanceTo(B),r);temp.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),B.clone().sub(A).normalize());temp.updateMatrix();map.get(key).matrices.push(temp.matrix.clone());}
  function mesh(geo,material,x=0,y=0,z=0,isSnow=false){const m=new THREE.Mesh(geo,material);m.position.set(x,y,worldZ(z));m.castShadow=true;m.receiveShadow=true;(isSnow?snow:scene).add(m);return m;}
  function snowCap(x,y,z,w,d){box(x,y+.08,z,w,.16,d,M.snow,0,true);}
  function textPlane(text,x,y,z,w,h,color='#daba70',vertical=false){
    const c=document.createElement('canvas');c.width=vertical?192:2048;c.height=vertical?1024:256;
    const q=c.getContext('2d');q.textAlign='center';q.textBaseline='middle';q.font='bold '+(vertical?144:182)+'px "STKaiti","KaiTi","Songti SC","Noto Serif CJK SC",serif';
    q.shadowColor='#776348';q.shadowBlur=3;q.shadowOffsetY=3;q.fillStyle=color;
    [...text].forEach((ch,i)=>q.fillText(ch,vertical?96:(i+.5)*c.width/text.length,vertical?(i+.5)*c.height/text.length:126));
    const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;
    const m=mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshStandardMaterial({map:t,transparent:true,alphaTest:.1,roughness:.4,metalness:.28,emissive:color,emissiveIntensity:.1,side:THREE.DoubleSide}),x,y,z);m.castShadow=false;return m;
  }
  // A flared, bronze-lined eave, the defining roof form of the campus.
  function flaredRoof(cx,cy,cz,bw,bd,tw,td,h){
    const p=[[-bw/2,0,bd/2],[bw/2,0,bd/2],[bw/2,0,-bd/2],[-bw/2,0,-bd/2],[-tw/2,h,td/2],[tw/2,h,td/2],[tw/2,h,-td/2],[-tw/2,h,-td/2]];
    const idx=[0,1,5,0,5,4,1,2,6,1,6,5,2,3,7,2,7,6,3,0,4,3,4,7,0,3,2,0,2,1,4,5,6,4,6,7];
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(idx.flatMap(i=>p[i]),3));geo.computeVertexNormals();mesh(geo,M.bronze,cx,cy,cz);
    box(cx,cy+h+.12,cz,tw+.25,.25,td+.25,M.white);snowCap(cx,cy+h+.26,cz,tw,td);
    for(let x=-bw/2;x<bw/2;x+=.47){beam([cx+x,cy-.01,cz+bd/2],[cx+x*(tw/bw),cy+h-.08,cz+td/2],.045,M.gold);beam([cx+x,cy-.01,cz-bd/2],[cx+x*(tw/bw),cy+h-.08,cz-td/2],.045,M.gold);}
  }
  function windowGrid(cx,cy,z,w,h,columns,rows,glass=M.glass,frame=M.frame,facing=1){
    box(cx,cy,z-.11*facing,w,h,.18,glass);
    if(columns>2&&rows>1){for(let i=0;i<columns;i++)for(let j=0;j<rows;j++)if((i*7+j*3)%5===0){box(cx-w/2+w*(i+.5)/columns,cy-h/2+h*(j+.5)/rows,z-.004*facing,w/columns-.10,h/rows-.11,.025,(i+j)%2?M.glassTintA:M.glassTintB,0,false,false);}}
    for(let i=0;i<=columns;i++)box(cx-w/2+w*i/columns,cy,z+.02*facing,.075,h,.09,frame);
    for(let j=0;j<=rows;j++)box(cx,cy-h/2+h*j/rows,z+.04*facing,w,.08,.1,frame);
  }
  function roofEquipment(cx,cy,cz,count=4){
    for(let i=0;i<count;i++){const x=cx+(i-(count-1)/2)*2.35;
      box(x,cy+.12,cz,1.75,.22,1.6,M.dark);box(x,cy+.72,cz,1.45,1.05,1.2,M.white);
      box(x,cy+1.29,cz,1.56,.1,1.3,M.frame);
      for(let j=0;j<5;j++)box(x,cy+.37+j*.16,cz+.614,1.15,.06,.04,M.dark);
      pole(x,cy+1.35,cz,.35,.06,M.dark);snowCap(x,cy+1.35,cz,1.5,1.2);
    }
  }
  // Site ground, entrance road and large-format stone pavers.
  box(0,-1,-100,2000,.5,2000,M.lawn,0,false,false);
  box(0,-.48,-140,324,.9,414,M.lawn,0,false,false);
  box(0,-.01,-15,223,.15,154,M.paving,0,false,false);
  box(0,.04,63,300,.18,14,M.road,0,false,false);
  // Internal carriageways are emitted once from the shared road layout.
  for(let x=-64;x<=64;x+=4)box(x,.081,-13,.025,.025,140,M.seam,0,false,false);
  for(let z=-81;z<56;z+=4)box(0,.084,z,136,.025,.025,M.seam,0,false,false);
  for(let x=-28;x<=28;x+=14)box(x,.101,8,.38,.03,85,M.paveLine,0,false,false);
  for(const z of [35,28,-22,-29])box(0,.11,z,61,.06,.8,M.paveLine,0,false,false);
  for(const side of [-1,1])for(let z=58;z<72;z+=1.3)box(side*34,.142,z,16,.035,.55,M.mark,0,false,false);
  for(let x=-82;x<85;x+=8)box(x,.145,75,4,.035,.14,M.mark,0,false,false);
  // Gate: concave fascia, deep timber-toned soffit, tall pale stone piers.
  for(const x of [-30,30]){
    box(x,8.8,46,4.5,17.6,8.5);box(x,17.6,46,4.6,.3,8.7,M.white);snowCap(x,17.76,46,4.5,8.5);
    for(let y=1;y<17;y+=1.6)box(x,y,50.27,4.5,.025,.018,M.seam,0,false,false);
    for(const xx of [-.9,.9])box(x+xx,8.8,50.29,.025,17.5,.025,M.seam,0,false,false);
  }
  // Right pier has three tall recessed panels, as in the reference photographs.
  for(const x of [27.15,29.65,32.15])box(x,8.1,41.69,1.5,14.2,.07,M.dark);
  for(let x=-29.5;x<30;x+=.5){const yy=16.45+.95*Math.pow(x/30,2);box(x,yy,46,.51,1.15,9.3,M.bronze);box(x,yy+.74,46,.51,.45,9.55,M.white);box(x,yy+.99,46,.51,.09,9.45,M.snow,0,true);box(x,yy-.67,46,.10,.27,9.25,M.gold);}
  // An uninterrupted fascia masks the segment joins without flattening the curve.
  const fascia=new THREE.Shape();fascia.moveTo(-32.3,18.1);fascia.quadraticCurveTo(0,16.05,32.3,18.1);fascia.lineTo(32.3,18.9);fascia.quadraticCurveTo(0,16.85,-32.3,18.9);fascia.closePath();
  mesh(new THREE.ExtrudeGeometry(fascia,{depth:.18,bevelEnabled:false,curveSegments:60}),M.stone,0,0,50.75);
  textPlane('江苏省兴化中学',0,19.5,50.75,36,3.3);
  for(let x=-15.4;x<16;x+=5.15){pole(x,18.15,50.4,.045,1.1,M.bronze);}
  box(-25,7,45,5.3,12.5,6.6,M.dark);
  box(-22.5,3.2,50,12.3,6.4,8.5,M.glass);
  windowGrid(-22.5,3.3,54.31,12.3,6.2,6,5,M.glass);
  for(const xx of [-28.71,-16.29]){box(xx,3.3,50,.1,6.4,8.5,M.glassLight);for(let z=46;z<54.5;z+=1.4)box(xx+(xx>0?.05:-.05),3.3,z,.10,6.3,.09,M.frame);for(let y=.3;y<6.5;y+=1.24)box(xx,y,50,.13,.08,8.5,M.frame);}
  box(-22.5,.25,50,12.6,.5,8.7,M.white);box(-22.5,6.5,50,12.6,.15,8.7,M.frame);snowCap(-22.5,6.58,50,12.55,8.55);
  // Access bollards and yellow folding barrier.
  for(let x=-13.5;x<27;x+=2.8){pole(x,.68,53,.15,1.2,M.steel);pole(x,1.27,53,.16,.09,M.gold);box(x,.10,53,.38,.08,.38,M.dark);}
  for(let x=-28;x<-18.5;x+=.85){beam([x,.3,55],[x+.9,1.45,55],.055,M.gold);beam([x,1.45,55],[x+.9,.3,55],.055,M.gold);pole(x,.14,55,.1,.23,M.dark);}
  box(-23.3,1.4,55,10.3,.12,.15,M.gold);
  // Low stone name wall in front of the central water garden.
  box(0,1.1,33,11,2.2,1.35,M.stone);textPlane('兴中',0,1.22,33.69,3.9,1.15);snowCap(0,2.2,33,11,1.35);
  // Reflecting pool and the repeated glass pyramids along its centre.
  const poolZ=4;
  box(0,-.10,poolZ,20,.35,51,M.waterEdge);
  for(const x of [-10.2,10.2]){box(x,.4,poolZ,.48,.65,51.8,M.white);snowCap(x,.73,poolZ,.52,51.8)}
  for(const z of [-21.65,29.65]){box(0,.4,z,20.9,.65,.5,M.white);snowCap(0,.73,z,20.9,.52)}
  box(0,.47,poolZ,5.35,.45,44.8,M.dark);box(0,.73,poolZ,4.9,.09,44.6,M.frame);
  const pyramidGlass=mat('#8fbfc1',.13,.32,{transparent:true,opacity:.48,side:THREE.DoubleSide,depthWrite:false});
  for(let i=0;i<7;i++){
    const z=-14.6+i*6.2,sz=5.75,half=2.28,h=3.55;
    const vertices=[[-half,.8,z-sz/2],[half,.8,z-sz/2],[half,.8,z+sz/2],[-half,.8,z+sz/2],[0,h+.8,z]];
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute([0,1,4,1,2,4,2,3,4,3,0,4].flatMap(j=>vertices[j]),3));geo.computeVertexNormals();mesh(geo,pyramidGlass);
    for(let j=0;j<4;j++){beam(vertices[j],vertices[4],.058,M.frame);beam(vertices[j],vertices[(j+1)%4],.052,M.frame);const a=new THREE.Vector3(...vertices[j]).lerp(new THREE.Vector3(...vertices[4]),.48);const b=new THREE.Vector3(...vertices[(j+1)%4]).lerp(new THREE.Vector3(...vertices[4]),.48);beam(a.toArray(),b.toArray(),.04,M.frame);}
    beam([-.03,4.36,z],[.03,4.36,z],.12,M.snow,true);
  }
  withZOffset(adminOffsetZ,()=>{
  // Main building: dark base, ceremonial stair, gold side wings and glass atrium.
  const front=-52,back=-73;
  for(const sign of [-1,1]){
    const x=sign*16.2;
    box(x,2, -62.5,14.4,4,21,M.dark);box(x,15.35,-62.5,14.4,22.5,21,M.stone);
    windowGrid(x,6.05,front+.12,13.6,4.05,6,1,M.glassLight);
    for(let y=9.6;y<=23.7;y+=3.6){
      box(x,y,front+.08,14.3,3.45,.22,M.gold);
      for(let col=0;col<7;col++){const xx=x-6.2+col*2.06;windowGrid(xx,y,front+.29,.85,2.8,1,2,col%3===0?M.glassGlow:M.glass);box(xx-.52,y,front+.43,.13,3.35,.42,M.white);}
      box(x,y-1.8,front+.33,15.6,.36,1.24,M.white);snowCap(x,y-1.58,front+.53,15.5,.82);
    }
    windowGrid(x,26.1,front+.12,13.5,1.75,7,1,M.glass);
    box(x,4,front+.20,14.7,.35,.8,M.white);snowCap(x,4.18,front+.30,14.6,.7);
    for(let col=0;col<6;col++)windowGrid(x-5.8+col*2.3,1.65,front+.1,1.75,2.35,2,3,M.glass);
    for(let y=.55;y<3.9;y+=.57)box(x,y,front+.22,14.35,.025,.025,M.seam,0,false,false);
    for(let xx=x-7;xx<x+7;xx+=1.2)box(xx,2,front+.23,.024,3.8,.03,M.seam,0,false,false);
    for(let col=0;col<3;col++){
      const xx=x-4.7+col*4.7;box(xx,4.34,front+.62,2.8,.13,1.65,M.frame);
      box(xx,5.28,front+.24,.085,1.7,.12,M.steel);
      box(xx+.28,4.95,front+.34,.045,.48,.04,M.steel);
    }
    // Side elevation windows are actual recesses, not a single flat facade.
    const sx=sign*23.43;
    for(let y=10;y<27;y+=3.6)for(let z=-71;z<-54;z+=2.8){box(sx,y,z,.12,2.45,1.2,M.glass);box(sx+sign*.1,y,z-.7,.22,2.65,.1,M.white);}
    box(sign*9.25,17.6,-52.2,.55,19.9,1.6,M.dark);
  }
  box(0,8.2,-63,19,.6,19,M.dark);windowGrid(0,17.65,-53.65,18.1,18.05,11,10,M.glassLight);
  for(const x of [-8.8,-4.4,0,4.4,8.8])box(x,17.65,-53.45,.12,18.1,.15,M.frame);
  for(const y of [8.65,12.25,15.85,19.45,23.05,26.7])box(0,y,-53.41,18.2,.17,.16,M.white);
  // Atrium interior floors and roof glazing give depth through the central opening.
  box(0,8.65,-66,18,.28,15,M.paving);box(0,17.5,-72.5,18,18,.3,M.glass);
  for(const x of [-8.5,8.5])for(const z of [-54.5,-64.5,-72])box(x,6.1,z,.52,4.4,.52,M.white);
  for(let i=0;i<22;i++){const y=(i+1)*.185;box(0,y/2,-39.8-i*.53,17.2,y,.56,M.stone);box(0,y+.012,-39.57-i*.53,17.25,.024,.055,M.white);}
  for(const x of [-8.85,8.85]){beam([x,.95,-39.3],[x,5.15,-51.1],.055,M.steel);for(let i=0;i<6;i++){const t=i/5;pole(x,.47+4.2*t,-39.3-11.8*t,.038,.96,M.steel);}}
  box(0,4.05,-58.5,18,.3,17,M.paving);
  flaredRoof(0,27.4,-62.5,48.5,21.8,59,31.5,2.3);
  box(0,29.98,-63,45,.06,17,M.roof);
  roofEquipment(0,30.02,-68,4);
  for(const x of [-7,7]){box(x,30.2,-59,8,.42,5,M.frame);box(x,30.43,-59,7.65,.06,4.7,M.glassLight);for(let i=-3;i<=3;i++)box(x+i,30.49,-59,.07,.06,4.75,M.white);snowCap(x,30.51,-59,7.7,4.8);}
  });
  // Exactly THREE classroom buildings on each side, sharing a continuous
  // longitudinal connection. The three wings leave two open courts per side.
  const teachingCourtyards=[];
  function teachingSide(sign){
    const frontZ=teachingWingCenters[0],rearZ=teachingWingCenters.at(-1);
    const cx=sign*70,w=62,d=teachingWingDepth,inner=sign*39,joinX=sign*45;
    const cz=(frontZ+rearZ)/2,length=frontZ-rearZ+d;
    const gaps=teachingWingCenters.slice(0,-1).map((z,i)=>({z:(z+teachingWingCenters[i+1])/2,depth:z-teachingWingCenters[i+1]-d}));
    for(const z of teachingWingCenters){
      box(cx,1.8,z,w,3.6,d,M.dark);box(cx,14,z,w,21,d,M.stone);
      // Both long elevations retain the classroom window rhythm. Omit windows
      // where the longitudinal wing meets the two courtyard-facing elevations.
      for(const facing of [-1,1]){
        const courtyardFace=(z!==rearZ&&facing===-1)||(z!==frontZ&&facing===1);
        const start=courtyardFace?52.6:40.7,end=99.3,fz=z+facing*(d/2+.09);
        for(let y=7.7;y<=22.2;y+=3.6){
          for(let x=start;x<=end;x+=2.8){
            const xx=sign*x;
            windowGrid(xx,y,fz,1.36,2.8,1,2,M.glass,M.frame,facing);
            box(xx,y-1.46,fz+facing*.18,1.64,.11,.42,M.white);
            for(const edge of [-.78,.78])box(xx+edge,y,fz+facing*.10,.11,3.02,.16,M.white);
            if((Math.round(x*10)+Math.round(y*10))%5===0)box(xx,y+.95,fz+facing*.18,1.2,.42,.04,M.blind,0,false,false);
          }
          const visibleW=courtyardFace?50:w,visibleX=courtyardFace?sign*76:cx;
          box(visibleX,y-1.8,fz,visibleW,.21,.46,M.white);
        }
        const baseStart=courtyardFace?53:41;
        for(let x=baseStart;x<100;x+=4.2)windowGrid(sign*x,1.85,fz,2.3,2.65,2,1,M.glass,M.frame,facing);
      }
      // Pale end walls and narrow windows face the outer campus road.
      for(let y=7.7;y<=22.2;y+=3.6)for(const dz of [-3.5,0,3.5]){
        box(sign*101.1,y,z+dz,.16,2.8,1.22,M.glass);
        for(const edge of [-.72,.72])box(sign*101.2,y,z+dz+edge,.15,3.03,.10,M.white);
      }
      box(cx,4.35,z,w+.8,.34,d+.8,M.white);snowCap(cx,4.54,z,w+.75,d+.75);
      roofEquipment(cx+sign*6,26.49,z,6);
      roofEquipment(cx-sign*15,26.49,z,3);
    }
    // The connector is a complete occupied building volume, matching the height
    // and width of the classroom wings; it is not a low pedestrian bridge.
    for(const {z,depth} of gaps){
      box(joinX,1.8,z,12,3.6,depth,M.dark);box(joinX,14,z,12,21,depth,M.stone);
      box(joinX,4.35,z,12.8,.34,depth,M.white);snowCap(joinX,4.54,z,12.75,depth);
    }
    // Continuous glass-and-fin elevation joins all three buildings on this side.
    const bays=7,bayDepth=length/bays;
    for(let bay=0;bay<bays;bay++){
      const bz=cz+(bay-(bays-1)/2)*bayDepth,gw=bayDepth-1.6;
      box(inner,13.7,bz,.22,17.8,gw,M.glassLight);
      for(let z=bz-gw/2+.2;z<bz+gw/2;z+=1.32){
        box(inner-sign*.14,13.7,z,.13,17.8,.065,M.frame);
        box(inner-sign*.37,13.75,z+.18,.64,18.05,.14,M.white);
        for(let row=0;row<5;row++)if((row+Math.round(z*10))%3===0)box(inner-sign*.13,6.4+row*3.6,z+.54,.07,2.65,.93,row%2?M.glassTintA:M.glassTintB,0,false,false);
      }
      for(let y=4.8;y<23;y+=3.6){box(inner-sign*.19,y,bz,.14,.12,gw,M.frame);box(inner-sign*.13,y+.32,bz,.06,.4,gw,M.glassTintB);}
      box(inner,23.63,bz,.24,1.36,gw,M.glass);
    }
    for(let i=0;i<=bays;i++)box(inner-sign*.25,14,cz-length/2+i*bayDepth,.64,21.7,1.44,M.white);
    // Both connecting sections are full-height and meet the middle building.
    for(const {z:gapZ,depth:gap} of gaps){
      for(let y=7.7;y<=22.2;y+=3.6){
        box(sign*51.08,y,gapZ,.16,2.8,gap-.6,M.glass);
        for(let z=gapZ-gap/2+.5;z<gapZ+gap/2;z+=2.6)box(sign*51.23,y,z,.24,3.15,.22,M.white);
        box(sign*51.3,y-1.8,gapZ,.75,.24,gap,M.white);
      }
      box(sign*51.7,3.7,gapZ,2,.24,gap,M.dark);snowCap(sign*51.7,3.84,gapZ,1.95,gap);
      for(let z=gapZ-gap/2+1;z<gapZ+gap/2;z+=3.4){box(sign*52.55,1.8,z,.28,3.6,.28,M.white);box(sign*51.1,1.8,z,.16,2.9,2.6,M.glassGlow);}
      teachingCourtyards.push({sign,x:sign*76,z:gapZ,width:50,depth:gap});
    }
    // The lower colonnade also follows the uninterrupted inner elevation.
    box(inner-sign*1.95,3.7,cz,4.65,.24,length+1.1,M.dark);snowCap(inner-sign*1.95,3.84,cz,4.55,length+1.05);
    for(let z=cz-length/2+.6;z<cz+length/2;z+=3.5){
      box(inner-sign*3.95,1.85,z,.3,3.7,.36,M.white);
      box(inner-sign*.06,1.8,z,.11,3.25,2.65,M.glass);
      box(inner-sign*.15,1.8,z,.1,3.25,.065,M.frame);
      box(inner-sign*2,3.55,z,.78,.035,.22,M.light);
    }
    for(const y of [3.92,4.36,4.68])box(inner-sign*3.94,y,cz,.065,.065,length+.4,M.steel);
    for(let z=cz-length/2;z<=cz+length/2;z+=.73)box(inner-sign*3.94,4.29,z,.045,.81,.045,M.steel);
    // A single concave roof footprint joins the three wings. The courtyard stays
    // open through the roof and its snow cap; no intersecting end parapets remain.
    function outline(m){
      const points=[[39-m,frontZ+d/2+m],[101+m,frontZ+d/2+m]];
      for(let i=0;i<teachingWingCenters.length;i++){
        const bottom=teachingWingCenters[i]-d/2-m;points.push([101+m,bottom]);
        if(i<teachingWingCenters.length-1){const nextTop=teachingWingCenters[i+1]+d/2+m;points.push([51+m,bottom],[51+m,nextTop],[101+m,nextTop]);}
      }
      points.push([39-m,rearZ-d/2-m]);return points.map(([x,z])=>[sign*x,z]);
    }
    function roofLayer(material,y,h,m,isSnow=false){
      const shape=new THREE.Shape();outline(m).forEach(([x,z],i)=>i?shape.lineTo(x,-z):shape.moveTo(x,-z));shape.closePath();
      const roof=mesh(new THREE.ExtrudeGeometry(shape,{depth:h,bevelEnabled:false}),material,0,y,0,isSnow);roof.rotation.x=-Math.PI/2;
      roof.name=(sign<0?'西':'东')+'侧三栋连体教学楼'+(isSnow?' 积雪屋面':' 连续屋面');
    }
    roofLayer(M.bronze,24.6,1.6,1.2);roofLayer(M.white,26.2,.2,1.35);roofLayer(M.roof,26.42,.07,1.15);roofLayer(M.snow,26.57,.16,1.12,true);
    function roofEdge(a,b,y,h,t,material){box((a[0]+b[0])/2,y,(a[1]+b[1])/2,Math.abs(a[0]-b[0])+t,h,Math.abs(a[1]-b[1])+t,material);}
    const edge=outline(1.25);
    for(let i=0;i<edge.length;i++){
      const a=edge[i],b=edge[(i+1)%edge.length];
      for(let y=24.69;y<26.17;y+=.19)roofEdge(a,b,y,.067,.075,M.gold);
      roofEdge(a,b,26.63,.28,.14,M.frame);
    }
    for(const z of [cz-length/2+.25,cz+length/2-.25])pole(inner-sign*.6,13,z,.085,24.5,M.frame);
  }
  for(const sign of [-1,1])teachingSide(sign);
  textPlane('行素楼',-96,16.2,38.2,2.1,7.8,'#8b3033',true);
  // Flag podium and mast on the central axis.
  for(let i=0;i<4;i++)box(0,.15+i*.22,-27,8.5-i*.8,.3,6.2-i*.65,M.dark);
  box(0,1,-27,2.8,.55,2.1,M.stone);pole(0,12.5,-27,.095,24,M.steel);ball(0,24.6,-27,.18,.18,.18,M.gold);snowCap(0,.98,-27,5.9,3.7);
  function flagTexture(){const c=document.createElement('canvas');c.width=384;c.height=256;const q=c.getContext('2d');q.fillStyle='#d91e2c';q.fillRect(0,0,384,256);function star(x,y,r,angle=-Math.PI/2){q.beginPath();for(let i=0;i<10;i++){const a=angle+i*Math.PI/5,rr=i%2?r*.39:r;i?q.lineTo(x+Math.cos(a)*rr,y+Math.sin(a)*rr):q.moveTo(x+Math.cos(a)*rr,y+Math.sin(a)*rr)}q.closePath();q.fillStyle='#ffde58';q.fill()}star(64,64,27);for(const [x,y]of [[115,27],[140,52],[140,90],[115,115]])star(x,y,9,Math.atan2(64-y,64-x));const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;}
  const flagGeometry=new THREE.PlaneGeometry(4.5,3,22,12);flagGeometry.translate(2.25,-1.5,0);
  const flag=mesh(flagGeometry,new THREE.MeshStandardMaterial({map:flagTexture(),side:THREE.DoubleSide,roughness:.8}),.1,24.1,-27);flag.rotation.y=-.22;
  const flagBase=flagGeometry.attributes.position.array.slice();
  // Layered, irregular planting based on the added summer courtyard panorama.
  const treeRecords=[];
  const leafMaterials=[M.leafFineA,M.leafFineB,M.leafFineC];
  const crownMaterials=[M.leafA,M.leafB,M.leafC];
  function leaf(x,y,z,size,material=leafMaterials[Math.floor(random()*3)],rx=0,ry=0,rz=0){
    instance(leafGeo,material,x,y,z,size,size,size,rx,ry,rz,false,false);
  }
  function crown(x,y,z,sx,sy,sz,material,detail=true){instance(detail?crownGeo:distantCrownGeo,material,x,y,z,sx,sy,sz,0,random()*6.28,0);}
  function tree(x,z,scale=1,detail=true){
    if(inReservedGround(x,worldZ(z),1.25))return;
    const h=(4.45+random()*1.05)*scale,r=(2.25+random()*.55)*scale;
    const leanX=(random()-.5)*.35*scale,leanZ=(random()-.5)*.28*scale;
    beam([x,.25,z],[x+leanX,h*.67,z+leanZ],.19*scale,M.bark);
    beam([x+leanX,h*.67,z+leanZ],[x+leanX*1.4,h+1.1*scale,z+leanZ*1.4],.105*scale,M.bark);
    if(detail){
      for(let i=0;i<4;i++){const a=i*1.57+random()*.3;beam([x,.25,z],[x+Math.cos(a)*.55*scale,.1,z+Math.sin(a)*.55*scale],.1*scale,M.bark);}
      // Three slender support stakes, as seen along the real campus paths.
      for(let i=0;i<3;i++){const a=i*2.094+.2;beam([x+Math.cos(a)*.63,.2,z+Math.sin(a)*.63],[x+Math.cos(a)*.12,1.8,z+Math.sin(a)*.12],.035,M.bark);}
    }
    const branchCount=detail?8:5;
    for(let j=0;j<branchCount;j++){
      const angle=j*2.39996+random()*.38,level=j%3,reach=r*(level===2?.35:.7+random()*.12);
      const cx=x+Math.cos(angle)*reach,cz=z+Math.sin(angle)*reach,cy=h-.1*scale+level*.68*scale+random()*.35*scale;
      const sx=(.88+random()*.37)*scale,sy=(.82+random()*.5)*scale,sz=(.98+random()*.42)*scale;
      beam([x+leanX,h*(.5+level*.1),z+leanZ],[cx,cy-.3*scale,cz],.075*scale,M.bark);
      if(detail){
        for(let fork=0;fork<2;fork++){const a=angle+(fork?-.6:.6);beam([cx,cy-.55*scale,cz],[cx+Math.cos(a)*.7*scale,cy+.45*scale,cz+Math.sin(a)*.7*scale],.028*scale,M.bark);}
      }
      crown(cx,cy,cz,sx,sy,sz,crownMaterials[j%3],detail);
      // Smaller off-axis lobes break up the outline of each main branch cluster.
      if(detail)crown(cx+sx*.52,cy+sy*.18,cz-sz*.22,sx*.7,sy*.63,sz*.65,crownMaterials[(j+1)%3]);
      instance(detail?ballGeo:distantCrownGeo,M.snow,cx-.07*scale,cy+sy*.76,cz,sx*.68,.14*scale,sz*.7,0,0,0,true);
      if(detail){
        for(let k=0;k<27;k++){
          const u=random()*Math.PI*2,v=Math.acos(2*random()-1),q=.85+random()*.28;
          const lx=cx+Math.cos(u)*Math.sin(v)*sx*q,ly=cy+Math.cos(v)*sy*q,lz=cz+Math.sin(u)*Math.sin(v)*sz*q;
          const size=(.24+random()*.2)*scale;
          leaf(lx,ly,lz,size,leafMaterials[(j+k)%3],(random()-.5)*1.5,u,(random()-.5)*1.7);
        }
      }
    }
    crown(x+leanX,h+1.38*scale,z+leanZ,1.1*scale,1.24*scale,1.18*scale,M.leafA,detail);
    instance(detail?ballGeo:distantCrownGeo,M.snow,x+leanX,h+2.35*scale,z+leanZ,.87*scale,.14*scale,.91*scale,0,0,0,true);
    treeRecords.push([x,worldZ(z),h+2.6*scale]);
  }
  function shrub(x,z,s=.65){
    if(inReservedGround(x,worldZ(z),s))return;
    crown(x,.7+s*.24,z,s,.5+s*.15,s*.85,random()>.5?M.hedge:M.shrub);
    crown(x+s*.5,.59,z+s*.13,s*.5,.35,s*.58,M.hedge);
    ball(x,.97+s*.2,z,s*.75,.10,s*.64,M.snow,true);
    for(let k=0;k<9;k++){const a=k*2.4;leaf(x+Math.cos(a)*s*.75,.8+random()*.5,z+Math.sin(a)*s*.8,.19+random()*.1,leafMaterials[k%3],-.2,a,.2);}
  }
  function hedgeLine(x,z,length,alongZ=true){
    box(x,.77,z,alongZ?.68:length,.5,alongZ?length:.68,M.hedge);
    for(let d=-length/2+.27;d<length/2;d+=.54){const xx=x+(alongZ?0:d),zz=z+(alongZ?d:0);crown(xx,1.02,zz,.41,.31,.39,random()>.5?M.hedge:M.shrub);ball(xx,1.24,zz,.30,.065,.31,M.snow,true);}
  }
  function grassPatch(cx,cz,w,d,count=110){
    for(let i=0;i<count;i++){
      const x=cx+(random()-.5)*w,z=cz+(random()-.5)*d;
      leaf(x,.67,z,.16+random()*.13,i%4===0?M.leafFineB:M.leafFineA,-1.14-random()*.3,random()*6.28,.2);
    }
  }
  function noticeBoard(sign,z){
    const x=sign*26.25;
    for(const dz of [-1.35,1.35]){box(x,1.31,z+dz,.11,2.2,.11,M.steel);box(x,.24,z+dz,.30,.18,.33,M.dark);}
    box(x,1.99,z,.16,1.28,2.9,M.red);
    box(x-sign*.095,1.99,z,.035,1.06,2.62,M.white);
    for(let i=0;i<4;i++)box(x-sign*.119,2.28-i*.17,z,.02,.045,1.7+(i%2)*.38,M.seam,0,false,false);
    box(x,2.67,z,.3,.11,3.1,M.dark);snowCap(x,2.73,z,.32,3.1);
  }
  // Small planted courts sit in the open sides of the connected teaching wings.
  for(const court of teachingCourtyards){
    for(const dz of [-court.depth*.27,court.depth*.27]){
      box(court.x,.24,court.z+dz,39,.3,3.6,M.white);
      box(court.x,.43,court.z+dz,38.6,.12,3.2,M.lawn);snowCap(court.x,.5,court.z+dz,38.6,3.2);
      for(const dx of [-13,0,13]){tree(court.x+dx,court.z+dz,.48,false);shrub(court.x+dx+1.5,court.z+dz,.48);}
    }
  }
  const lamps=[];
  for(const sign of [-1,1]){
    for(let i=0;i<7;i++){
      const z=-46+i*13;
      // Light granite edging encloses grass, layered shrubs and two uneven trees.
      box(sign*23,.28,z,9,.37,11,M.white);box(sign*23,.49,z,8.55,.07,10.55,M.soil);box(sign*23,.56,z,8.30,.12,10.30,M.lawn);snowCap(sign*23,.63,z,8.3,10.3);
      tree(sign*(22.8+(i%2)*.8),z+(i%2?1.4:-1),1.03+random()*.16,true);
      tree(sign*(25.9-(i%2)*1.5),z+(i%2?-3.2:3.3),.64+random()*.17,true);
      hedgeLine(sign*27,z,9.4,true);
      hedgeLine(sign*22.7,z-4.55,7.6,false);
      for(let j=0;j<4;j++)shrub(sign*(19.65+(j%2)*1.25),z-1.9+j*1.3,.49+random()*.24);
      grassPatch(sign*23,z,7.6,9.3,115);
      if(i%2===0)noticeBoard(sign,z+2.1);
    }
    // Forecourt planting around the flag plaza and the foot of the main building.
    for(const z of [-74,-81,-91]){
      box(sign*26,.28,z,3.8,.32,5.8,M.white);box(sign*26,.50,z,3.4,.14,5.4,M.lawn);snowCap(sign*26,.6,z,3.4,5.4);
      tree(sign*26,z,.82+random()*.17,true);
      for(const dx of [-1.65,1.65])shrub(sign*26+dx,z+1.5,.65);
      grassPatch(sign*26,z,3.2,5.1,55);
    }
    for(let z=-47;z<=37;z+=10.5){const x=sign*17.6;box(x,.25,z,.8,.5,.8,M.dark);box(x,2.8,z,.28,5.5,.28,M.dark);box(x,5,z,.38,1.5,.38,M.frame);box(x,5.1,z,.25,1.25,.43,M.light);for(let y=4.55;y<5.85;y+=.25)box(x,y,z,.43,.05,.43,M.dark);box(x,5.88,z,.52,.10,.52,M.dark);lamps.push(new THREE.Vector3(x,5.15,z));}
    for(let z=-68;z<=39;z+=12)tree(sign*110,z,.9+random()*.25,false);
    for(let z=-27;z<=27;z+=18){box(sign*13.8,.67,z,.9,.15,3.2,M.bronze);for(const dz of [-1.1,1.1])box(sign*13.8,.37,z+dz,.75,.6,.15,M.dark);snowCap(sign*13.8,.75,z,.9,3.2);}
    // Feathered palm fronds replace the sparse spokes of the first model.
    for(const x of [8,13]){
      const px=sign*x;pole(px,.65,35,.55,1.1,M.dark);pole(px,1.72,35,.11,1.6,M.bark);
      for(let j=0;j<6;j++)pole(px,1.16+j*.19,35,.13,.045,M.bronze);
      for(let a=0;a<9;a++){
        const angle=a*Math.PI*2/9,dx=Math.cos(angle),dz=Math.sin(angle);
        const start=[px,2.8,35],mid=[px+dx*.93,3.05,35+dz*.93],end=[px+dx*1.9,2.27,35+dz*1.9];
        beam(start,mid,.026,M.leafC);beam(mid,end,.018,M.leafC);
        for(let k=1;k<14;k++){
          const t=k/14,reach=1.9*t,y=2.8+.55*Math.sin(t*Math.PI)-.53*t;
          for(const s of [-1,1]){const direction=angle+s*1.15,ex=px+dx*reach,ez=35+dz*reach;
            leaf(ex,y,ez,(.42+.12*Math.sin(t*Math.PI))*(1-t*.4),k%2?M.leafFineA:M.leafFineC,-.12,direction+.9,s*.15);
          }
        }
      }
      ball(px,2.78,35,.30,.07,.30,M.snow,true);
    }
  }
  for(let i=0;i<42;i++){const side=i%2?-1:1,x=side*(113+random()*13),z=-66+random()*109;if(!inSideEntranceRoad(x,z,1.2))crown(x,.4,z,.6+random(),.45,.7,M.hedge,false);}
  const extension=buildExtendedCampus({scene,M,mat,box,beam,mesh,pole,ball,instance,snowCap,windowGrid,roofEquipment,tree,hedgeLine,grassPatch,shrub,crown,random,snow,textPlane,withZOffset,worldZ});
  function flush(map,parent){for(const {geometry,material,matrices,cast}of map.values()){const m=new THREE.InstancedMesh(geometry,material,matrices.length);matrices.forEach((matrix,i)=>m.setMatrixAt(i,matrix));m.castShadow=cast;m.receiveShadow=true;m.computeBoundingSphere();parent.add(m);}}
  flush(batches,scene);flush(snowBatches,snow);snow.visible=false;
  return {materials:M,wind,snow,flag,flagBase,lamps,pool:{width:19.9,length:50.5,z:poolZ,y:.18},treeRecords,...extension};
}
