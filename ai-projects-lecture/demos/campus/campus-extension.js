import * as THREE from 'three';
import {sideGates,inSideEntranceRoad,inReservedGround,roadRects,buildingFootprints,containsRect,pointInPolygon,lakeControl,adminOffsetZ,rearOffsetZ,sportsOffsetZ} from './layout.js?v=7';

// Estimated site layout: entrance at +Z, rear garden at -Z.
// These are visual reconstructions from the supplied photos, not survey dimensions.
export function buildExtendedCampus(api){
  const {scene,M,mat,box,beam,mesh,pole,ball,instance,snowCap,windowGrid,roofEquipment,tree,hedgeLine,grassPatch,shrub,crown,random,snow,textPlane,withZOffset,worldZ}=api;
  Object.assign(M,{
    brick:mat('#5c6260',.95),slate:mat('#36484d',.85),tileLine:mat('#647275',.88),
    wood:mat('#be944d',.75),woodDark:mat('#655334',.84),lakeEdge:mat('#99977b',.96),
    turfA:mat('#68943d',.96),turfB:mat('#88ad4c',.95),trackRubber:mat('#bf7165',.95),sportSurface:mat('#51a99b',.94),
    courtBlue:mat('#559aa8',.88),net:mat('#608e84',.68,.18),whitePaint:mat('#e6e6db',.87),
    seatRed:mat('#c45c4c',.78),seatGold:mat('#deb347',.77),seatGreen:mat('#6ba787',.78),seatBlue:mat('#7bb6c5',.77),
    courtGlass:mat('#405457',.27,.28),path:mat('#d2d3c2',.93)
  });
  const waterAreas=[],nightFixtures=[],footpathMeshes=[];
  let updateClock=()=>{};
  function addNight(...fixtures){for(const f of fixtures){f.position[2]=worldZ(f.position[2]);if(f.target)f.target[2]=worldZ(f.target[2]);nightFixtures.push(f);}}
  function addWater(id,outline){waterAreas.push({id,outline:outline.map(([x,z])=>[x,worldZ(z)])});}

  function polygonGeometry(points,holes=[]){
    const shape=new THREE.Shape();points.forEach(([x,z],i)=>i?shape.lineTo(x,-z):shape.moveTo(x,-z));shape.closePath();
    for(const outline of holes){const h=new THREE.Path();outline.forEach(([x,z],i)=>i?h.lineTo(x,-z):h.moveTo(x,-z));h.closePath();shape.holes.push(h);}
    return new THREE.ShapeGeometry(shape);
  }
  function patch(points,y,material,holes=[]){const m=mesh(polygonGeometry(points,holes),material);m.rotation.x=-Math.PI/2;m.position.y=y;m.castShadow=false;return m;}
  function line(points,material=M.whitePaint,width=.09,y=.23){
    const p=[];
    for(let i=0;i<points.length-1;i++){
      const [x,z]=points[i],[nx,nz]=points[i+1],d=Math.hypot(nx-x,nz-z)||1,ox=-(nz-z)/d*width/2,oz=(nx-x)/d*width/2;
      p.push(x+ox,y,z+oz,nx+ox,y,nz+oz,x-ox,y,z-oz,x-ox,y,z-oz,nx+ox,y,nz+oz,nx-ox,y,nz-oz);
    }
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.computeVertexNormals();const m=mesh(g,material);m.castShadow=false;return m;
  }
  function ring(cx,cz,rx,rz,material=M.whitePaint,width=.09,y=.24,start=0,end=Math.PI*2){const points=[];for(let i=0;i<=80;i++){const a=start+(end-start)*i/80;points.push([cx+Math.cos(a)*rx,cz+Math.sin(a)*rz]);}return line(points,material,width,y);}
  // Clip path triangles against carriageways and building footprints. Adjacent
  // road and path surfaces share an edge instead of drawing over one another.
  function clipHalf(poly,axis,k,keepLess){
    const out=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],ia=keepLess?a[axis]<=k:a[axis]>=k,ib=keepLess?b[axis]<=k:b[axis]>=k;if(ia)out.push(a);if(ia!==ib){const t=(k-a[axis])/(b[axis]-a[axis]);out.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);}}return out;
  }
  function subtractRect(poly,r){
    let inner=poly;const out=[];
    for(const [axis,k,less] of [[0,r.x-r.w/2,false],[0,r.x+r.w/2,true],[1,r.z-r.d/2,false],[1,r.z+r.d/2,true]]){if(inner.length<3)break;const outer=clipHalf(inner,axis,k,!less);if(outer.length>2)out.push(outer);inner=clipHalf(inner,axis,k,less);}
    return out;
  }
  function path(points,width=2.2){
    const dz=worldZ(0),curve=new THREE.CatmullRomCurve3(points.map(([x,z])=>new THREE.Vector3(x,0,z+dz)),false,'centripetal'),ps=curve.getPoints(Math.max(18,Math.ceil(curve.getLength()/1.2)));
    const sides=ps.map((p,i)=>{const a=ps[Math.max(0,i-1)],b=ps[Math.min(ps.length-1,i+1)],len=Math.hypot(b.x-a.x,b.z-a.z)||1;return [[p.x-(b.z-a.z)/len*width/2,p.z+(b.x-a.x)/len*width/2],[p.x+(b.z-a.z)/len*width/2,p.z-(b.x-a.x)/len*width/2]];});
    const positions=[];
    for(let i=0;i<sides.length-1;i++){
      let pieces=[[sides[i][0],sides[i][1],sides[i+1][1],sides[i+1][0]]];
      const bounds={minX:Math.min(...pieces[0].map(p=>p[0])),maxX:Math.max(...pieces[0].map(p=>p[0])),minZ:Math.min(...pieces[0].map(p=>p[1])),maxZ:Math.max(...pieces[0].map(p=>p[1]))};
      for(const r of [...roadRects,...buildingFootprints]){if(r.x+r.w/2<bounds.minX||r.x-r.w/2>bounds.maxX||r.z+r.d/2<bounds.minZ||r.z-r.d/2>bounds.maxZ)continue;pieces=pieces.flatMap(p=>subtractRect(p,r));}
      for(const p of pieces){const x=p.reduce((a,v)=>a+v[0],0)/p.length,z=p.reduce((a,v)=>a+v[1],0)/p.length;if(waterAreas.some(w=>pointInPolygon(x,z,w.outline)))continue;for(let j=1;j<p.length-1;j++)for(const q of [p[0],p[j+1],p[j]])positions.push(q[0],.38,q[1]-dz);}
    }
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.computeVertexNormals();const m=mesh(g,M.path);m.castShadow=false;m.name='沿地形衔接的步道';m.userData.kind='footpath';footpathMeshes.push(m);return m;
  }
  function lightPost(x,z,height=4.2){
    if(inReservedGround(x,worldZ(z),1))return;
    box(x,.17,z,.48,.26,.48,M.dark);box(x,height/2,z,.16,height,.16,M.frame);box(x,height-.4,z,.25,.7,.25,M.light);box(x,height+.02,z,.4,.07,.4,M.dark);
  }
  function rectangularFence(cx,cz,w,d,height=2.8){
    const x1=cx-w/2,x2=cx+w/2,z1=cz-d/2,z2=cz+d/2;
    for(const x of [x1,x2]){for(let z=z1;z<=z2+.1;z+=3.1)pole(x,height/2+.2,z,.055,height,M.net);for(const y of [.35,1.6,height+.2])box(x,y,cz,.04,.035,d,M.net);}
    for(const z of [z1,z2]){for(let x=x1;x<=x2+.1;x+=3.1)pole(x,height/2+.2,z,.055,height,M.net);for(const y of [.35,1.6,height+.2])box(cx,y,z,w,.035,.04,M.net);}
    // Fine fencing is a single line mesh, not hundreds of separate objects.
    const positions=[];for(const x of [x1,x2])for(let z=z1;z<z2;z+=.6)positions.push(x,.28,z,x,height+.18,z);
    for(const z of [z1,z2])for(let x=x1;x<x2;x+=.6)positions.push(x,.28,z,x,height+.18,z);
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));const m=new THREE.LineSegments(g,new THREE.LineBasicMaterial({color:'#739d91',transparent:true,opacity:.28}));m.position.z=worldZ(0);scene.add(m);
  }
  function wallWithMoonGate(x,y,z,w,h){
    const shape=new THREE.Shape();shape.moveTo(-w/2,0);shape.lineTo(w/2,0);shape.lineTo(w/2,h);shape.lineTo(-w/2,h);shape.closePath();
    const hole=new THREE.Path();hole.absarc(0,1.7,1.35,0,Math.PI*2,true);shape.holes.push(hole);
    const g=new THREE.ExtrudeGeometry(shape,{depth:.28,bevelEnabled:false,curveSegments:32});mesh(g,M.white,x,y,z);box(x,y+h+.05,z,w+.2,.15,.42,M.slate);snowCap(x,y+h+.13,z,w+.2,.45);
  }

  // Campus perimeter, service roads and a tree-lined arrival bridge over the canal.
  for(const sign of [-1,1]){
    const gate=sign<0?sideGates.west:sideGates.east;

    box(sign*148,.075,-142.5,2.3,.16,405,M.paving,0,false,false);
    for(let z=-330;z<63;z+=12){box(sign*154,.314,z,.13,.025,5,M.mark,0,false,false);tree(sign*160,z,.87+random()*.18,false);}
    // Leave an actual opening for each entrance, including the low boundary wall.
    for(const [a,b] of [[-345,gate.z-gate.fenceGap],[gate.z+gate.fenceGap,65]]){
      box(sign*162,.28,(a+b)/2,.5,.56,b-a,M.dark);
      for(let z=a;z<=b;z+=3)box(sign*162,1.25,z,.12,1.95,.12,M.frame);
      for(const y of [.8,2.05])box(sign*162,y,(a+b)/2,.06,.05,b-a,M.frame);
    }
  }

  box(0,.04,132,390,.14,20,M.road,0,false,false);
  for(let x=-187;x<190;x+=9)box(x,.12,132,4.5,.025,.13,M.mark,0,false,false);
  for(const sign of [-1,1]){
    box(sign*82,.22,74,138,.30,9,M.lawn,0,false,false);
    box(sign*82,.2,115,138,.3,10,M.lawn,0,false,false);
    for(let x=21;x<151;x+=9){tree(sign*x,71,.7+random()*.15,false);tree(sign*x,117,.75+random()*.2,false);}
    box(sign*80,1.1,67,135,.08,.075,M.frame);for(let x=15;x<149;x+=2.5)box(sign*x,.75,67,.09,1.4,.09,M.frame);
  }
  addWater('entrance-canal',[[-195,82],[195,82],[195,109],[-195,109]]);
  box(0,.34,95,23,.56,57,M.stone);box(0,.655,95,18.5,.08,57,M.road);
  for(const x of [-10.3,10.3]){box(x,.72,95,1.8,.17,57,M.paving);for(const y of [1.1,1.62,1.95])box(x,y,95,.07,.06,57,M.steel);for(let z=67;z<=123;z+=1.7)box(x,1.34,z,.065,1.27,.065,M.steel);}
  for(let z=68;z<124;z+=6)box(0,.704,z,.11,.022,3.4,M.mark,0,false,false);
  for(const x of [-7.8,7.8])box(x,.705,95,.12,.022,56,M.mark,0,false,false);
  // Approach ramps keep the bridge joined to both roads.
  for(let i=0;i<10;i++){box(0,.655-i*.060,123.5+i*.62,20,.08,.67,M.road,0,false,false);box(0,.655-i*.060,66.5-i*.48,20,.08,.54,M.road,0,false,false);}
  for(let z=125;z<=138;z+=1.6){box(-20,.125,z,12,.025,.6,M.mark,0,false,false);box(20,.125,z,12,.025,.6,M.mark,0,false,false);}

  withZOffset(adminOffsetZ,()=>{
  // Rear face of the main building: broad blue glazing and a generous central opening.
  windowGrid(0,17.6,-73.22,18,18,11,10,M.glassLight,M.frame,-1);
  for(const x of [-16.2,16.2]){
    windowGrid(x,15.8,-73.22,13.5,20.6,8,6,M.glassLight,M.frame,-1);
    box(x,4.35,-73.5,14.3,.3,1.25,M.white);snowCap(x,4.52,-73.5,14.3,1.2);
  }
  // Extend the existing raised circulation floor through the rear facade and
  // onto one connected landing. The stair starts at that landing's outer edge.
  box(0,4.05,-69.4,18,.3,12.8,M.paving);
  for(const x of [-8.5,8.5])for(const z of [-70,-74.5])box(x,1.98,z,.5,3.96,.5,M.stone);
  box(0,4.04,-75.6,18,.32,.4,M.white);snowCap(0,4.21,-74.6,18,2.4);
  const rearLandingZ=-75.8,rearLandingY=4.2,rearPlazaY=.26,rearStepCount=18,rearTread=.6;
  for(let i=0;i<rearStepCount;i++){
    const h=rearLandingY-(i+1)*(rearLandingY-rearPlazaY)/rearStepCount,z=rearLandingZ-(i+.5)*rearTread;
    box(0,h/2,z,17.2,h,rearTread+.012,M.stone);
    box(0,h+.012,z+.265,17.2,.024,.055,M.white);snowCap(0,h,z,17.2,rearTread-.03);
  }
  for(const x of [-8.8,8.8]){
    beam([x,5.15,rearLandingZ],[x,1.21,rearLandingZ-rearStepCount*rearTread],.055,M.steel);
    for(let i=0;i<=rearStepCount;i+=3){const h=rearLandingY-i*(rearLandingY-rearPlazaY)/rearStepCount;pole(x,h+.46,rearLandingZ-i*rearTread,.038,.94,M.steel);}
    beam([x,5.15,-73],[x,5.15,rearLandingZ],.055,M.steel);
  }
  });
  // Landings, the rear carriageway and the lake promenade are separate surfaces.
  box(0,.12,-115,84,.24,8,M.paving,0,false,false);
  box(0,.14,-132.5,84,.28,11,M.paving,0,false,false);
  for(let x=-28;x<=28;x+=4)box(x,.291,-132.5,.035,.012,11,M.seam,0,false,false);
  for(let z=-137;z<-127;z+=2)box(0,.292,z,61,.012,.035,M.seam,0,false,false);
  box(0,.27,-139,3.4,.20,9,M.white);
  const lakeDeck=mesh(new THREE.CylinderGeometry(5,5,.24,48),M.paving,0,.35,-143);lakeDeck.name='湖前圆形观景台';
  for(let i=0;i<=15;i++){const a=Math.PI*i/15;const x=Math.cos(a)*4.7,z=-143-Math.sin(a)*4.7;pole(x,.96,z,.045,1.02,M.frame);if(i>0){const b=Math.PI*(i-1)/15;beam([Math.cos(b)*4.7,1.46,-143-Math.sin(b)*4.7],[x,1.46,z],.045,M.steel);}}

  withZOffset(rearOffsetZ,()=>{
  // Irregular lake and pale footpaths form the centre of the back half of campus.
  const shoreControl=lakeControl;
  const lakeCurve=new THREE.CatmullRomCurve3(shoreControl.map(([x,z])=>new THREE.Vector3(x,0,z)),true,'catmullrom',.3);
  const lakeOutline=lakeCurve.getPoints(120).slice(0,-1).map(p=>[p.x,p.z]);
  const outer=lakeOutline.map(([x,z])=>[x*1.065,(z+125)*1.065-125]);
  patch(outer,.23,M.lakeEdge,[lakeOutline]);addWater('lake',lakeOutline);
  path([[-41,-90],[-48,-108],[-49,-127],[-37,-149],[-15,-158],[0,-160],[27,-153],[43,-139],[47,-121],[41,-104],[20,-94]],2.35);
  path([[-27,-158],[-51,-166],[-62,-181],[-48,-200],[-62,-220],[-45,-248],[-12,-255],[0,-266]],2.4);
  path([[-35,-150],[-57,-139],[-63,-153],[-51,-172],[-68,-192],[-55,-212],[-70,-239],[-44,-264]],1.8);
  path([[28,-151],[41,-159],[40,-189],[45,-219],[31,-249],[10,-258],[0,-275]],2.2);
  for(let i=0;i<40;i++){const p=lakeCurve.getPoint(i/40),out=new THREE.Vector3(p.x,0,p.z+125).normalize();const s=.6+random()*.6;ball(p.x+out.x*1.1,.18,p.z+out.z*1.1,s,.35+s*.25,s*.75,M.lakeEdge);}
  // Two small garden bridges cross the narrowed paths at the pond edge.
  for(const [x,z,ry] of [[36,-147,.28],[-35,-139,-.6]]){
    box(x,.55,z,3.5,.32,10,M.stone,ry);box(x,.78,z,3.45,.13,9.95,M.snow,ry,true);
    const dir=new THREE.Vector3(Math.sin(ry),0,Math.cos(ry)),side=new THREE.Vector3(Math.cos(ry),0,-Math.sin(ry));
    for(const s of [-1,1]){const a=new THREE.Vector3(x,1.5,z).addScaledVector(side,s*1.6);beam(a.clone().addScaledVector(dir,-5).toArray(),a.clone().addScaledVector(dir,5).toArray(),.055,M.frame);for(let k=-4;k<=4;k+=2){const p=a.clone().addScaledVector(dir,k);pole(p.x,1.08,p.z,.045,.84,M.frame);}}
  }
  // Long, open pergola on the west bank.
  for(let z=-102;z>=-145;z-=4){for(const x of [-51,-47])pole(x,1.65,z,.12,3.3,M.woodDark);box(-49,3.35,z,4.8,.16,.18,M.wood);}
  for(const x of [-51.1,-46.9])box(x,3.35,-124,.16,.18,46,M.woodDark);
  for(let z=-101;z>=-147;z-=.6)box(-49,3.51,z,5.2,.12,.13,M.wood);

  });
  // Western supporting buildings. Their functions are not inferred from the photos.
  function modernHall(cx,cz,w,d,h,courtyard=false){
    if(courtyard){
      for(const z of [cz-d/2+5.5,cz+d/2-5.5])box(cx,h/2,z,w,h,11,M.dark);
      for(const x of [cx-w/2+5,cx+w/2-5])box(x,h/2,cz,10,h,d-22,M.dark);
      box(cx,.12,cz,w-20,.15,d-22,M.paving,0,false,false);
      for(const z of [cz-d/2+5.5,cz+d/2-5.5]){box(cx,h+.15,z,w+1.2,.3,11.7,M.white);box(cx,h+.34,z,w-.1,.1,10.8,M.roof);snowCap(cx,h+.39,z,w,11);}
      for(const x of [cx-w/2+5,cx+w/2-5]){box(x,h+.15,cz,10.7,.3,d-22,M.white);box(x,h+.34,cz,9.9,.1,d-22,M.roof);snowCap(x,h+.4,cz,10.1,d-22);}
    }else{box(cx,h/2,cz,w,h,d,M.dark);box(cx,h+.15,cz,w+1.4,.3,d+1.3,M.white);box(cx,h+.35,cz,w,.1,d,M.roof);snowCap(cx,h+.4,cz,w+.2,d+.2);}
    const front=cz+d/2+.1;
    windowGrid(cx,h-3,front,w-4,4.6,Math.round(w/1.6),2,M.glassLight);
    for(let x=cx-w/2+2.5;x<cx+w/2-1.5;x+=3.6){windowGrid(x,3.6,front,1.25,4.6,1,2,M.glass);box(x-.8,3.65,front+.1,.13,4.9,.2,M.white);}
    for(const sign of [-1,1]){const x=cx+sign*(w/2+.1);box(x,h-3,cz,.2,4.6,d-3,M.glassLight);for(let z=cz-d/2+1.5;z<cz+d/2;z+=1.8)box(x+sign*.14,h-3,z,.13,4.7,.075,M.frame);}
    box(cx,h-5.65,front,w,.36,.8,M.white);
    if(!courtyard){for(let x=cx-w/2+1;x<cx+w/2;x+=2)box(x,h/2,front+.38,.22,h,1.15,M.white);roofEquipment(cx-7,h+.43,cz-5,6);roofEquipment(cx+8,h+.43,cz+5,5);}
    else roofEquipment(cx,h+.43,cz+d/2-5,5);
    for(const x of [cx-3.8,cx, cx+3.8])windowGrid(x,2.4,front+.24,3.2,4.3,2,2,M.glass);
    addNight({position:[cx,5,front+3],color:'#e2d5b6',intensity:190,distance:43});
  }
  withZOffset(rearOffsetZ,()=>{
  modernHall(-91,-112,58,44,12.8,true);
  modernHall(-94,-203,55,43,15.8,false);
  // Visible exterior stair on the garden side of the taller building.
  for(let i=0;i<31;i++){const h=(i+1)*.25;box(-62.7,h/2,-180-i*.48,5.4,h,.51,M.stone);}
  for(const x of [-65.5,-59.9]){beam([x,1,-179.8],[x,8.7,-194.8],.055,M.frame);for(let i=0;i<7;i++)pole(x,.5+i*1.28,-179.8-i*2.5,.04,1,M.frame);}
  box(-62.7,7.7,-198,5.7,.25,7.5,M.paving);snowCap(-62.7,7.85,-198,5.7,7.5);

  });
  // Two additional connected wings behind each teaching side, across the road.
  // Their outer connector leaves the inner court open toward the main building.
  for(const sign of [-1,1]){
    const cx=sign*70,zs=[-77,-105];
    for(const z of zs){
      box(cx,1.7,z,62,3.4,12,M.dark);box(cx,12.85,z,62,18.9,12,M.stone);
      for(const facing of [-1,1]){
        const courtFace=(z===-77&&facing<0)||(z===-105&&facing>0),fz=z+facing*6.1;
        for(let y=5.1;y<21;y+=3.6){
          for(let x=41.4;x<(courtFace?89:100);x+=3.0)windowGrid(sign*x,y,fz,2.05,2.55,2,2,M.glass,M.frame,facing);
          box(sign*(courtFace?65:70),y-1.5,fz,courtFace?50:62,.3,.7,M.white);
        }
        for(let x=42;x<(courtFace?89:100);x+=5)windowGrid(sign*x,1.7,fz,2.65,2.5,2,1,M.glass,M.frame,facing);
      }
      roofEquipment(cx,23.55,z,5);
    }
    box(sign*95.5,1.7,-91,11,3.4,16,M.dark);box(sign*95.5,12.85,-91,11,18.9,16,M.stone);
    for(const x of [sign*101.12,sign*89.88])for(let y=5.1;y<21;y+=3.6){
      const depth=Math.abs(x)>100?38:15.7;box(x,y,-91,.16,2.6,depth,M.glassLight);
      for(let z=-91-depth/2+.2;z<-91+depth/2;z+=2.6)box(x+Math.sign(x)*.11,y,z,.15,2.7,.15,M.white);
      box(x,y-1.52,-91,.65,.25,depth,M.white);
    }
    // The broad end elevations and dark roof outline are visible in the new aerial.
    for(const z of zs)for(let y=5.1;y<21;y+=3.6)for(const dz of [-3.2,0,3.2])box(sign*38.9,y,z+dz,.17,2.45,1.5,M.glass);
    const outline=[[39,-71],[101,-71],[101,-111],[39,-111],[39,-99],[90,-99],[90,-83],[39,-83]].map(([x,z])=>[sign*x,z]);
    const shape=new THREE.Shape();outline.forEach(([x,z],i)=>i?shape.lineTo(x,-z):shape.moveTo(x,-z));shape.closePath();
    for(const [material,y,h,snowy] of [[M.white,22.3,.55,false],[M.roof,22.88,.48,false],[M.snow,23.43,.15,true]]){
      const m=mesh(new THREE.ExtrudeGeometry(shape,{depth:h,bevelEnabled:false}),material,0,y,0,snowy);m.rotation.x=-Math.PI/2;m.name=(sign<0?'西':'东')+'侧后排两栋连体建筑';
    }
    for(let i=0;i<outline.length;i++){const a=outline[i],b=outline[(i+1)%outline.length];box((a[0]+b[0])/2,23.49,(a[1]+b[1])/2,Math.abs(a[0]-b[0])+.12,.24,Math.abs(a[1]-b[1])+.12,M.frame);}
    box(sign*67,.18,-91,43,.24,15.5,M.paving,0,false,false);
    box(sign*67,.38,-91,29,.25,5.5,M.white);box(sign*67,.56,-91,28.6,.12,5.1,M.lawn);snowCap(sign*67,.64,-91,28.6,5.1);
    for(const x of [57,67,77])tree(sign*x,-91,.55,true);
    // Raised, covered connection across the side avenue; columns stand off the lane.
    box(sign*31.15,4.05,-94,15.8,.3,4.0,M.paving);
    for(const x of [sign*24.4,sign*38])for(const z of [-95.7,-92.3])box(x,3.5,z,.22,7,.22,M.frame);
    box(sign*31.15,7.12,-94,16.2,.18,4.3,M.white);snowCap(sign*31.15,7.23,-94,16.2,4.3);
    for(const z of [-95.7,-92.3]){box(sign*31.15,4.96,z,15.8,.065,.06,M.steel);box(sign*31.15,6.05,z,15.8,1.6,.06,M.glassLight);}
    addNight({position:[sign*68,5,-90],color:'#e5d2ac',intensity:120,distance:30});
  }

  // Side entrances share their alignment with the roads and perimeter openings.
  // The west approach lies in the gap between the two supporting facilities.
  const west=sideGates.west,east=sideGates.east;
  for(const sign of [-1,1]){
    box(sign*190,.045,-85,14,.15,428,M.road,0,false,false);
    for(let z=-287;z<122;z+=9)box(sign*190,.126,z,.12,.02,4,M.mark,0,false,false);
  }


  for(const side of [-1,1]){
    const z=west.z+side*8.1;
    path([[-187.5,z],[-20.5,z]],1.8);
    for(let x=-185;x<-20;x+=8)box(x,.314,west.z+side*3.5,3.7,.025,.12,M.mark,0,false,false);
  }
  // A turning apron and an independent eastern gate sit well beyond the last
  // teaching wing; the cross road meets the existing inner service road.


  for(const offset of [-.23,.23])box(174,.314,east.z+offset,71,.025,.12,M.gold,0,false,false);
  for(let x=39;x<130;x+=9)box(x,.314,east.z,4,.025,.10,M.mark,0,false,false);
  for(const side of [-1,1]){
    path([[36.5,east.z+side*5.4],[135.5,east.z+side*5.4]],.85);
    for(let x=159;x<188;x+=6)box(x,.314,east.z+side*7.4,2.9,.023,.12,M.mark,0,false,false);
    // Low white approach rails, visible in the east-gate reference.
    box(182,.63,east.z+side*12.6,24,.7,.55,M.white);
    box(182,1.53,east.z+side*12.6,23,.065,.08,M.steel);
    for(let x=170;x<194;x+=1.2)box(x,1.12,east.z+side*12.6,.06,.85,.065,M.steel);
  }
  function sideGlazing(x,y,z,w,h,columns,rows,outward){
    box(x,y,z,.16,h,w,M.glassLight);
    for(let i=0;i<=columns;i++)box(x+outward*.11,y,z-w/2+w*i/columns,.08,h,.075,M.frame);
    for(let j=0;j<=rows;j++)box(x+outward*.12,y-h/2+h*j/rows,z,.08,.075,w,M.frame);
  }
  function foldingGate(x,cz,from,to){
    for(let u=from;u<to-.6;u+=.72){
      beam([x,.27,cz+u],[x,1.95,cz+u+.72],.032,M.dark);
      beam([x,1.95,cz+u],[x,.27,cz+u+.72],.032,M.dark);
      pole(x,1.03,cz+u,.045,1.86,M.dark);box(x,.15,cz+u,.17,.21,.18,M.dark);
    }
    box(x,1.98,cz+(from+to)/2,.09,.10,to-from,M.dark);
  }
  // West: twin low glass guardhouses, flat projecting canopies and a name stone.
  for(const side of [-1,1]){
    const z=west.z+side*18.3;
    box(west.x,1.84,z,5.8,3.6,6.4,M.glass);
    box(west.x,.25,z,6.2,.5,6.8,M.white);
    sideGlazing(west.x-2.95,2.05,z,6.2,2.9,4,2,-1);
    sideGlazing(west.x+2.95,2.05,z,6.2,2.9,4,2,1);
    for(const end of [-1,1])windowGrid(west.x,2.05,z+end*3.24,5.7,2.9,4,2,M.glass,M.frame,end);
    box(west.x-.4,3.78,z,8.5,.26,8.8,M.white);box(west.x-.6,4.03,z,9.3,.16,9.2,M.dark);snowCap(west.x-.6,4.13,z,9.3,9.2);
    box(west.x-3.1,3.6,z,.12,.12,5.6,M.light);
  }
  box(west.x,1.1,west.z,1.0,2.15,6.6,M.bronze);snowCap(west.x,2.2,west.z,1.0,6.6);
  const westName=textPlane('江苏省兴化中学',west.x-.53,1.2,west.z,6.0,.74,'#d4bc87');westName.rotation.y=-Math.PI/2;
  foldingGate(west.x,west.z,-14.9,-3.5);foldingGate(west.x,west.z,3.5,14.9);
  for(const side of [-1,1]){box(west.x,.9,west.z+side*22.3,.8,1.8,1.7,M.white);box(west.x,1.89,west.z+side*22.3,1,.16,1.9,M.dark);}
  // The west-facing grand facades have tall columns and layered roof overhangs.
  withZOffset(rearOffsetZ,()=>{
  for(const hall of [{x:-120,z:-112,d:44,h:12.8},{x:-121.5,z:-203,d:43,h:15.8}]){
    sideGlazing(hall.x-.12,hall.h/2+.2,hall.z,hall.d-2,hall.h-1,Math.round(hall.d/1.6),4,-1);
    for(let z=hall.z-hall.d/2+1.8;z<hall.z+hall.d/2;z+=5.2)box(hall.x-3.5,hall.h/2,z,.62,hall.h,.62,M.white);
    box(hall.x-2.6,hall.h-.12,hall.z,7.8,.26,hall.d+5.5,M.bronze);
    for(let tier=0;tier<3;tier++)box(hall.x-2.6,hall.h+.15+tier*.21,hall.z,8.1+tier*.35,.14,hall.d+5.8+tier*.6,M.white);
    snowCap(hall.x-2.6,hall.h+.66,hall.z,8.8,hall.d+7.1);
  }
  });
  // East: a freestanding rectangular entrance, glazed side rooms, dark roof trim.
  for(const side of [-1,1]){
    const z=east.z+side*14.4;
    box(east.x,3.7,z,5.2,7.4,6.5,M.white);
    sideGlazing(east.x+2.64,3.65,z,4.5,5.25,3,3,1);
    for(const dz of [-1.6,0,1.6])box(east.x+2.79,3.65,z+dz,.17,5.4,.32,M.white);
    box(east.x,7.98,z,5.5,.16,6.7,M.dark);snowCap(east.x,8.1,z,5.5,6.7);
    for(let y=1;y<7.4;y+=1.2)box(east.x+2.61,y,z,.025,.022,6.4,M.seam,0,false,false);
  }
  box(east.x,7.6,east.z,5.2,.65,35.2,M.white);
  box(east.x,8.01,east.z,5.8,.17,35.9,M.dark);snowCap(east.x,8.13,east.z,5.8,35.9);
  box(east.x+.1,7.22,east.z,3.9,.09,22,M.bronze);
  const eastName=textPlane('东门',east.x+2.64,7.62,east.z,2.2,.42,'#626b68');eastName.rotation.y=Math.PI/2;
  foldingGate(east.x,east.z,-10.8,10.8);
  for(const z of [east.z-19.2,east.z+19.2]){box(east.x,.65,z,.85,1.3,3.0,M.white);box(east.x,1.4,z,.96,.15,3.1,M.dark);}
  addNight({position:[west.x-2,4.7,west.z],color:'#f1ddb8',intensity:180,distance:35},{position:[east.x+2,7,east.z],color:'#f1ddb8',intensity:180,distance:35});

  withZOffset(sportsOffsetZ,()=>{
  // Running oval, striped football pitch, goals, coloured stand and basketball courts.
  const sx=91,sz=-182;
  box(sx,.07,sz,88,.13,157,M.sportSurface,0,false,false);
  function oval(radius){const pts=[];for(let i=0;i<=52;i++){const a=Math.PI*i/52;pts.push([sx+Math.cos(a)*radius,sz+35+Math.sin(a)*radius]);}for(let i=0;i<=52;i++){const a=Math.PI+Math.PI*i/52;pts.push([sx+Math.cos(a)*radius,sz-35+Math.sin(a)*radius]);}pts.push(pts[0]);return pts;}
  patch(oval(38.4),.17,M.trackRubber);patch(oval(31.8),.183,M.turfA);
  for(let lane=0;lane<=8;lane++)line(oval(31.8+lane*.825),M.whitePaint,.065,.19);
  box(sx,.195,sz,58,.022,98,M.turfA,0,false,false);
  for(let i=0;i<14;i++)box(sx,.211,sz-49+(i+.5)*7,58,.018,7,i%2?M.turfB:M.turfA,0,false,false);
  line([[sx-29,sz-49],[sx+29,sz-49],[sx+29,sz+49],[sx-29,sz+49],[sx-29,sz-49]],M.whitePaint,.13,.23);
  line([[sx-29,sz],[sx+29,sz]],M.whitePaint,.13,.23);ring(sx,sz,8,8,M.whitePaint,.12,.235);
  for(const sign of [-1,1]){
    const z=sz+sign*49;
    line([[sx-17,z],[sx-17,z-sign*14],[sx+17,z-sign*14],[sx+17,z]],M.whitePaint,.11,.24);
    line([[sx-7.5,z],[sx-7.5,z-sign*5],[sx+7.5,z-sign*5],[sx+7.5,z]],M.whitePaint,.11,.24);
    for(const x of [sx-3.5,sx+3.5]){box(x,1.34,z,.1,2.6,.1,M.whitePaint);beam([x,2.63,z],[x,1.8,z+sign*1.9],.045,M.whitePaint);box(x,.16,z+sign*.9,.075,.075,1.9,M.whitePaint);}
    box(sx,2.63,z,7.1,.1,.1,M.whitePaint);box(sx,1.8,z+sign*1.9,7,.055,.055,M.frame);
    for(let x=sx-3.5;x<=sx+3.5;x+=.45)beam([x,2.61,z],[x,.23,z+sign*1.9],.009,M.whitePaint);
    for(const x of [sx-29,sx+29]){pole(x,.8,z,.035,1.4,M.whitePaint);box(x+.21,1.43,z,.42,.25,.02,M.seatGold);}
  }
  // The stand sits on the outer/eastern long side, consistent in both panoramas.
  const standX=135.4;
  for(let row=0;row<9;row++){
    const x=standX+row*.94,h=.5+row*.52;box(x,h/2,sz,.95,h,86,M.stone);
    for(let section=0;section<4;section++){
      const z=sz-32.2+section*21.5,material=[M.seatRed,M.seatGold,M.seatGreen,M.seatBlue][section];
      box(x,h+.08,z,.65,.16,20,material);box(x+.36,h+.38,z,.13,.6,20,material);
      box(x,h+.18,z,.64,.10,20,M.snow,0,true);
    }
  }
  for(const z of [sz-43,sz-21.5,sz,sz+21.5,sz+43])for(let row=0;row<9;row++){const h=.5+row*.52;box(standX+row*.94,h/2+.03,z,.95,h+.06,.78,M.white);}
  for(let z=sz-34;z<=sz+34;z+=17){box(144.2,6.35,z,.20,12.5,.2,M.white);}
  box(140.5,10.3,sz,10.5,.24,49,M.white);snowCap(140.5,10.43,sz,10.5,49);
  for(let z=sz-34;z<=sz+34;z+=17)box(144.2,12.4,z,.9,.9,.04,M.whitePaint);
  // Basketball courts on the end nearest the teaching zone.
  for(let c=0;c<3;c++){
    const x=64+c*27,z=-89;
    box(x,.11,z,25,.16,32,M.sportSurface,0,false,false);box(x,.20,z,15,.025,28,M.courtBlue,0,false,false);
    line([[x-7.5,z-14],[x+7.5,z-14],[x+7.5,z+14],[x-7.5,z+14],[x-7.5,z-14]],M.whitePaint,.09,.23);line([[x-7.5,z],[x+7.5,z]],M.whitePaint,.09,.23);ring(x,z,1.8,1.8,M.whitePaint,.09,.24);
    for(const sign of [-1,1]){
      const zz=z+sign*12.6;box(x,1.75,z+sign*14.7,.15,3.4,.15,M.net);beam([x,3.5,z+sign*14.7],[x,3.5,zz],.075,M.net);
      box(x,3.65,zz,1.8,1.05,.06,M.white);box(x,3.55,zz-sign*.038,.8,.55,.021,M.dark);
      const hoop=mesh(new THREE.TorusGeometry(.30,.025,5,16),M.red,x,3.03,zz-sign*.40);hoop.rotation.x=Math.PI/2;
      line([[x-2.45,z+sign*14],[x-2.45,z+sign*8.2],[x+2.45,z+sign*8.2],[x+2.45,z+sign*14]],M.whitePaint,.09,.24);
      ring(x,z+sign*12,6.0,6.0,M.whitePaint,.09,.24,sign===1?Math.PI:0,sign===1?Math.PI*2:Math.PI);
    }
  }
  rectangularFence(91,-166,91,191,3.1);
  for(const [x,z] of [[50,-111],[147,-111],[50,-256],[147,-256]]){
    pole(x,10,z,.14,20,M.steel);box(x,20,z,3.9,.1,.18,M.frame);
    for(let i=0;i<4;i++)box(x-1.5+i,20.3,z,.66,.65,.2,M.light);
  }
  addNight({position:[69,22,-138],target:[91,0,-170],color:'#d7e8ff',intensity:9000,distance:175,spot:true},{position:[135,22,-224],target:[91,0,-188],color:'#d7e8ff',intensity:9000,distance:175,spot:true});

  });
  withZOffset(rearOffsetZ,()=>{
  // Modern Chinese courtyard ensemble: tiled roofs, timber screens and a water court.
  function hipRoof(cx,y,cz,w,d,rise=2.6){
    const p=[[-w/2,0,d/2],[w/2,0,d/2],[w/2,0,-d/2],[-w/2,0,-d/2],[-w*.26,rise,0],[w*.26,rise,0]],idx=[0,1,5,0,5,4,1,2,5,2,3,4,2,4,5,3,0,4];
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(idx.flatMap(i=>p[i]),3));g.computeVertexNormals();mesh(g,M.slate,cx,y,cz);mesh(g,M.snow,cx,y+.065,cz,true);
    for(const z of [cz-d/2,cz+d/2]){box(cx,y-.04,z,w,.18,.25,M.wood);for(let x=-w/2+.15;x<w/2;x+=.53)box(cx+x,y-.17,z,.1,.26,.72,M.wood);}
    box(cx,y+rise+.04,cz,w*.57,.12,.19,M.tileLine);
    for(let x=-w/2+.15;x<w/2;x+=.78){const ridgeX=Math.max(-w*.26,Math.min(w*.26,x));beam([cx+x,y+.024,cz+d/2],[cx+ridgeX,y+rise+.03,cz],.025,M.tileLine);beam([cx+x,y+.024,cz-d/2],[cx+ridgeX,y+rise+.03,cz],.025,M.tileLine);}
  }
  function lattice(cx,y,z,w=2.8,h=3.8){
    box(cx,y,z,w,h,.10,M.courtGlass);
    for(const x of [cx-w/2,cx+w/2])box(x,y,z+.09,.06,h,.09,M.wood);
    for(const yy of [y-h/2,y+h/2])box(cx,yy,z+.09,w,.06,.09,M.wood);
    for(let row=0;row<5;row++)for(let col=0;col<4;col++){
      const x=cx-w/2+(col+.5)*w/4,yy=y-h/2+(row+.5)*h/5,dx=w/8,dy=h/10;
      beam([x-dx,yy,z+.095],[x,yy+dy,z+.095],.023,M.wood);beam([x,yy+dy,z+.095],[x+dx,yy,z+.095],.023,M.wood);
      beam([x+dx,yy,z+.095],[x,yy-dy,z+.095],.023,M.wood);beam([x,yy-dy,z+.095],[x-dx,yy,z+.095],.023,M.wood);
    }
  }
  function pavilionHall(cx,cz,w,d,h=7.6){
    box(cx,.4,cz,w+.8,.7,d+.8,M.dark);box(cx,h/2+.6,cz,w,h,d,M.brick);
    for(let x=cx-w/2+2;x<cx+w/2-1;x+=3.8)lattice(x,3.3,cz+d/2+.11,2.9,4.3);
    for(let x=cx-w/2+1.5;x<cx+w/2;x+=2.4)windowGrid(x,h-.5,cz+d/2+.12,1.7,1.8,1,1,M.glass);
    hipRoof(cx,h+1.0,cz,w+3.3,d+3.0,w>22?2.45:3.0);
    for(let y=1.2;y<h;y+=.5)box(cx,y,cz+d/2+.055,w,.02,.018,M.seam,0,false,false);
  }
  const gz=-210;
  box(0,.1,gz,78,.18,77,M.paving,0,false,false);
  for(const x of [-27,27])for(const z of [-185,-233])pavilionHall(x,z,20,16,8.1);
  pavilionHall(0,-239,29,12,6.0);pavilionHall(0,-181,29,10,6.1);
  for(const x of [-32,32]){
    box(x,2.65,gz,9,5.3,38,M.brick);hipRoof(x,5.5,gz,11,40,2.0);
    for(let z=-225;z<=-193;z+=4){box(x-Math.sign(x)*4.59,2.8,z,.14,4.3,2.8,M.courtGlass);pole(x-Math.sign(x)*6.3,2.75,z,.19,5.5,M.wood);}
    box(x-Math.sign(x)*5.2,.4,gz,4.8,.7,39,M.stone);snowCap(x-Math.sign(x)*5.2,.76,gz,4.7,39);
  }
  // The open central pool and freestanding timber pavilion match the close-up photos.
  box(0,-.12,-210,35,.24,28,M.waterEdge);
  addWater('courtyard-water',[[-16.7,-196],[16.7,-196],[16.7,-224],[-16.7,-224]]);
  for(const x of [-17.4,17.4]){box(x,.34,-210,.5,.6,29,M.white);snowCap(x,.66,-210,.52,29);}
  for(const z of [-195.7,-224.3]){box(0,.34,z,35,.6,.5,M.white);snowCap(0,.65,z,35,.52);}
  box(0,.40,-210,3.6,.7,39,M.dark);box(0,.80,-210,3.5,.10,39,M.paving);snowCap(0,.86,-210,3.5,39);
  box(0,.77,-209.5,9,.22,9,M.dark);
  for(const x of [-3.2,3.2])for(const z of [-212.7,-206.3]){box(x,1.3,z,.9,1.1,.9,M.dark);pole(x,4.1,z,.34,5.7,M.wood);}
  hipRoof(0,7,-209.5,11.6,11.6,2.6);
  for(let x=-4.2;x<=4.2;x+=.48)box(x,6.81,-209.5,.095,.17,9.2,M.woodDark);
  box(0,1.3,-214,2.6,1.0,1.65,M.stone);ball(0,2.04,-214,.68,.48,.4,M.lakeEdge);
  // Low colonnades, patterned screens and moon-shaped openings around the court.
  for(const z of [-190,-229]){
    box(0,.42,z,48,.7,4.5,M.stone);hipRoof(0,5.3,z,49,6.8,1.9);
    for(let x=-22;x<=22;x+=4.4)pole(x,2.9,z+.8,.20,5.0,M.wood);
  }
  for(const x of [-18,18])wallWithMoonGate(x,.3,-180.75,7.5,4.8);
  for(const z of [-247,-173]){path([[-35,z],[-19,z-3],[0,z],[20,z-3],[35,z]],2.1);}
  addNight({position:[0,5.5,-209.5],color:'#ffd69a',intensity:155,distance:30},{position:[-24,5,-190],color:'#ffd69a',intensity:95,distance:28},{position:[24,5,-229],color:'#ffd69a',intensity:95,distance:28});

  // Seven golden eave tiers and a clock crown on a tall pale-stone base.
  const tx=0,tz=-163;
  box(tx,.23,tz,15,.45,17,M.paving);box(tx,4.45,tz,5.2,8.5,5.8,M.white);
  for(const sign of [-1,1]){box(tx+sign*2.62,4.7,tz,.06,7.7,1.4,M.glassTintB);box(tx,4.7,tz+sign*2.92,1.35,7.7,.06,M.glassTintB);}
  for(let i=0;i<7;i++){
    const y=8.9+i*2.9,r=3.25-i*.095;
    const wall=mesh(new THREE.CylinderGeometry(r*.66,r*.66,2.25,8),M.glassTintB,tx,y+.65,tz);wall.rotation.y=Math.PI/8;
    const roofGeo=new THREE.CylinderGeometry(r*.63,r,.85,8,1,false);const roof=mesh(roofGeo,M.wood,tx,y+1.91,tz);roof.rotation.y=Math.PI/8;const whiteRoof=mesh(roofGeo,M.snow,tx,y+1.98,tz,true);whiteRoof.rotation.y=Math.PI/8;
    for(let j=0;j<8;j++){const a=j*Math.PI/4+Math.PI/8;pole(tx+Math.sin(a)*r*.66,y+.65,tz+Math.cos(a)*r*.66,.034,2.2,M.frame);}
  }
  const clockCrown=mesh(new THREE.CylinderGeometry(1.78,1.78,2.2,8),M.courtGlass,tx,29.3,tz);clockCrown.rotation.y=Math.PI/8;
  const crownRoof=mesh(new THREE.ConeGeometry(2.4,3.2,8),M.wood,tx,31.95,tz);crownRoof.rotation.y=Math.PI/8;const crownSnow=mesh(crownRoof.geometry,M.snow,tx,32.03,tz,true);crownSnow.rotation.y=Math.PI/8;pole(tx,34.1,tz,.065,1.25,M.steel);
  const dialCanvas=document.createElement('canvas');dialCanvas.width=dialCanvas.height=256;const dial=dialCanvas.getContext('2d');const dialTexture=new THREE.CanvasTexture(dialCanvas);dialTexture.colorSpace=THREE.SRGBColorSpace;
  M.clockFace=mat('#ffffff',.68,0,{map:dialTexture,transparent:true,alphaTest:.03,emissive:'#dfcba7',emissiveIntensity:.12});
  for(let side=0;side<4;side++){const a=side*Math.PI/2,m=mesh(new THREE.PlaneGeometry(1.85,1.85),M.clockFace,tx+Math.sin(a)*1.79,29.2,tz+Math.cos(a)*1.79);m.rotation.y=a;m.castShadow=false;}
  let previousHour=-1;
  updateClock=function(hour){
    if(Math.abs(hour-previousHour)<.001)return;previousHour=hour;dial.clearRect(0,0,256,256);dial.fillStyle='#f1ecdd';dial.beginPath();dial.arc(128,128,123,0,Math.PI*2);dial.fill();dial.strokeStyle='#454944';dial.lineWidth=5;
    for(let i=0;i<12;i++){const a=i*Math.PI/6;dial.beginPath();dial.moveTo(128+Math.sin(a)*102,128-Math.cos(a)*102);dial.lineTo(128+Math.sin(a)*114,128-Math.cos(a)*114);dial.stroke();}
    for(const [angle,length,width] of [[hour*Math.PI/6,57,8],[(hour%1)*Math.PI*2,86,5]]){dial.lineWidth=width;dial.beginPath();dial.moveTo(128,128);dial.lineTo(128+Math.sin(angle)*length,128-Math.cos(angle)*length);dial.stroke();}
    dial.beginPath();dial.arc(128,128,7,0,Math.PI*2);dial.fillStyle='#605844';dial.fill();dialTexture.needsUpdate=true;
  }
  updateClock(15);addNight({position:[0,7,-157.5],color:'#ffcf8c',intensity:240,distance:45});

  });
  withZOffset(rearOffsetZ,()=>{
  // Paths, planting and the modest rear gateway complete the continuous grounds.
  box(0,.11,-274,5,.2,42,M.paving,0,false,false);
  for(const x of [-8.5,8.5]){wallWithMoonGate(x,.1,-295,7.6,3.8);box(x,5.0,-295,8.8,.55,.65,M.white);for(const dx of [-4,4])box(x+dx,2.55,-295,.65,5.1,.8,M.white);}
  for(const sign of [-1,1]){
    box(sign*82,.4,-305,134,.7,.55,M.white);for(let x=16;x<148;x+=3)box(sign*x,1.35,-305,.09,1.9,.09,M.frame);box(sign*82,2.28,-305,134,.055,.06,M.frame);
    for(let z=-280;z>=-296;z-=8)tree(sign*8,z,.85,false);
    for(let z=-72;z>=-273;z-=15){const x=sign*(z>-145?44:43);if(z<-150||sign<0){tree(x,z,.8+random()*.3,false);lightPost(x+sign*2.2,z);}}
  }
  for(let i=0;i<96;i++){
    const z=-258-random()*40,x=(random()-.5)*260;if(Math.abs(x)<9)continue;tree(x,z,.65+random()*.45,false);
  }
  for(let i=0;i<32;i++){
    const x=-42-random()*21,z=-154-random()*93;tree(x,z,.65+random()*.3,false);if(i%3===0)shrub(x+2,z+1,.65);
  }
  for(const [x,z] of [[-18,-157],[20,-155],[-40,-184],[40,-215],[-19,-249],[20,-253]]){tree(x,z,.92,true);lightPost(x+2,z-1,3.7);}
  for(let z=-268;z<=-112;z+=11)tree(48,z,.7+random()*.19,false);
  for(let x=-128;x<=128;x+=13)tree(x,-289,.8+random()*.2,false);
  for(const z of [-260,-250])for(const sign of [-1,1])hedgeLine(sign*22,z,25,false);

  });
  for(const sign of [-1,1]){
    for(const z of [48,11,-31])for(const x of [58,82,101]){if(z===48)tree(sign*x,z,.76+random()*.18,false);else{box(sign*x,.23,z,9,.25,4.3,M.lawn,0,false,false);tree(sign*x,z,.62+random()*.11,false);}}
  }
  const xs=[...new Set([...roadRects,...buildingFootprints].flatMap(r=>[r.x-r.w/2,r.x+r.w/2]))].sort((a,b)=>a-b),zs=[...new Set([...roadRects,...buildingFootprints].flatMap(r=>[r.z-r.d/2,r.z+r.d/2]))].sort((a,b)=>a-b),roadVertices=[];
  for(let i=0;i<xs.length-1;i++)for(let j=0;j<zs.length-1;j++){
    const a=xs[i],b=xs[i+1],c=zs[j],d=zs[j+1],x=(a+b)/2,z=(c+d)/2;
    if(!roadRects.some(r=>containsRect(x,z,r))||buildingFootprints.some(r=>containsRect(x,z,r)))continue;
    roadVertices.push(a,.30,c,a,.30,d,b,.30,c,b,.30,c,a,.30,d,b,.30,d);
  }
  const roadGeometry=new THREE.BufferGeometry();roadGeometry.setAttribute('position',new THREE.Float32BufferAttribute(roadVertices,3));roadGeometry.computeVertexNormals();
  const carriageway=mesh(roadGeometry,M.road);carriageway.castShadow=false;carriageway.name='连续车行道路';carriageway.userData.kind='carriageway';
  M.road.polygonOffset=true;M.road.polygonOffsetFactor=-1;M.road.polygonOffsetUnits=-1;
  // Mark only the clear central sections of the two main transverse roads.
  for(const z of [-62.5,-123])for(let x=-145;x<145;x+=9)if(!buildingFootprints.some(r=>containsRect(x,z,r)))box(x,.315,z,3.7,.02,.10,M.mark,0,false,false);
  for(const x of [-32,32])for(const z of [-62.5,-123])for(let i=-2;i<=2;i++)box(x+i*.9,.318,z, .45,.02,5.5,M.mark,0,false,false);
  return {waterAreas,nightFixtures,updateClock,sideGates,footpathMeshes,carriageway,bounds:{minX:-166,maxX:166,minZ:-347,maxZ:143},regions:{lake:[0,-158],sports:[91,-242],garden:[0,-250],tower:[0,-203],commons:[-91,-196],admin:[0,-92.5]}};
}
