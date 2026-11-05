import * as T from 'three';
const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
export function batchAnchors(names,flow){
 return [0,1].map(l=>{let obj,offset=new T.Vector3(),yOffset=0;
  if(flow.owner==='belt'){obj=names.get('belt_infeed12');offset.set([2.12,1.98][l],.58,-.370+.4*(1-(flow.beltFeed??1)));return {position:obj.localToWorld(offset).clone(),quaternion:obj.getWorldQuaternion(new T.Quaternion()).multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),Math.PI/2))};}
  else if(flow.owner==='infeed'){obj=names.get('infeed_flip12');offset.set([.330,.190][l],-.450,.080);return {position:obj.localToWorld(offset).clone(),quaternion:obj.getWorldQuaternion(new T.Quaternion()).multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),Math.PI/2))};}
  else if(flow.owner==='stock'){obj=names.get(`feed_cup_0_${1-l}`);yOffset=.024;}
  else if(flow.owner==='loader'){obj=names.get(`loader_grip_${l}`);offset.y=-.34;}
  else if(flow.owner==='weigh'){obj=names.get('weigh_cup_'+[-.51,-.37][l]);yOffset=.004;}
  else if(flow.owner==='unload'){obj=names.get(`unload_grip_${l}`);offset.y=-.34;}
  else if(flow.owner==='outfeed'){obj=names.get(`out_cup_6_${1-l}`);yOffset=-.100-(flow.outfeedDrop??0);}
  else{obj=names.get(`grip_0_${l}`);offset.y=-.46;}
  if(!obj)throw Error('Missing batch anchor '+flow.owner+' / '+l);
  const position=obj.localToWorld(offset).clone();position.y+=yOffset;
  const orientation=obj.getWorldQuaternion(new T.Quaternion());if(['loader','carousel','weigh','unload','outfeed'].includes(flow.owner))orientation.multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),Math.PI));return {position,quaternion:orientation};
 });
}
export function createProcessScene(model,names){
 const root=new T.Group();root.name='process_demo_08';model.add(root);const meshes=[],batch=[],demoGroups=[];
 const mat=(color,metalness=.3,roughness=.45)=>new T.MeshStandardMaterial({color,metalness,roughness});
 const steel=mat(0x9caeb8,.85,.3),dark=mat(0x233b49,.7,.4),gold=mat(0xd6a857,.65,.32),white=mat(0xd9e7db,.05,.6),brown=mat(0x96804f,.05,.8);
 function mesh(parent,geometry,material,pos,name){const o=new T.Mesh(geometry,material);o.position.fromArray(pos);o.name=name;o.userData={support:parent.name,connection:'工艺演示附加件；流体或膜材显示；机械实体使用STEP11共享几何'};parent.add(o);meshes.push(o);return o;}
 function box(p,size,pos,m=steel,n='demo_bracket'){return mesh(p,new T.BoxGeometry(...size),m,pos,n);}
 function cyl(p,r,h,pos,m=steel,n='demo_shaft'){return mesh(p,new T.CylinderGeometry(r,r,h,20),m,pos,n);}
 function beam(p,a,b,w=.018,m=steel){const A=new T.Vector3(...a),B=new T.Vector3(...b),v=B.clone().sub(A),o=box(p,[w,v.length(),w],A.clone().add(B).multiplyScalar(.5).toArray(),m);o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),v.normalize());return o;}
 function sprite(text,width=.35){const c=document.createElement('canvas');c.width=640;c.height=112;const ctx=c.getContext('2d');ctx.fillStyle='#142b3ee8';ctx.fillRect(0,0,640,112);ctx.strokeStyle='#73caa3';ctx.lineWidth=4;ctx.strokeRect(2,2,636,108);ctx.fillStyle='#e4f6ef';ctx.font='42px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,320,56);const tex=new T.CanvasTexture(c),o=new T.Sprite(new T.SpriteMaterial({map:tex,depthTest:false}));o.scale.set(width,width*112/640,1);return o;}
 for(let l=0;l<2;l++){
  const g=names.get(`product_0_${l}`).clone(true);g.name='tracked_batch_'+l;g.position.set(0,0,0);root.add(g);
  const roles=[];g.traverse(o=>{if(!o.isMesh)return;o.material=o.material.clone();o.material.clippingPlanes=[];o.userData={...o.userData,connection:'A组物料：全流程追踪'};const name=o.name;roles.push({o,name,pos:o.position.clone(),scale:o.scale.clone()});if(name.includes('_leaf_4'))o.material.color.setHex(0x989044);});
  const film=mesh(g,new T.CylinderGeometry(.032,.032,1,32,1,true),new T.MeshPhysicalMaterial({color:0xe1f2fa,transparent:true,opacity:.19,roughness:.13,metalness:0,side:T.DoubleSide,depthWrite:false}),[0,.39,0],'demo_film_sleeve');
  const seam=box(g,[.110,.006,.003],[0,.060,0],gold,'demo_heat_seam');
  const cap=mesh(g,new T.PlaneGeometry(.110,.003),film.material.clone(),[0,.060,0],'demo_sealed_film_end');cap.rotation.x=-Math.PI/2;
  batch.push({g,roles,film,seam,cap});
 }
 const marker=sprite('A组 · 双通道物料',.36);root.add(marker);
 const waste=new T.Group();root.add(waste);const rootBits=[],leafBits=[],skinBits=[];
 for(let l=0;l<2;l++){
  rootBits.push(mesh(waste,new T.CylinderGeometry(.0135,.014,.110,14),brown,[0,0,0],'demo_root_waste_'+l));
  leafBits.push(mesh(waste,new T.ConeGeometry(.009,.13,5),mat(0x9c9348),[0,0,0],'demo_leaf_waste_'+l));
  for(let j=0;j<6;j++)skinBits.push(mesh(waste,new T.PlaneGeometry(.012,.065),brown.clone(),[0,0,0],'demo_skin_waste_'+l+'_'+j));
 }
 // Receiving inserts are revision-10 CAD parts, shared with STEP.
 const adapters=[];
 const wrapper={fixed:names.get('wrap_axis'),g:names.get('wrap_axis_slide'),jaws:[]},sealer={fixed:names.get('seal_axis'),g:names.get('seal_axis_slide'),jaws:[]};
 // Effects use the actual nozzle geometry centres and the tracked batch positions.
 function centres(prefix){const result=[];for(const [n,o]of names)if(n.startsWith(prefix)&&o.isMesh){o.geometry.computeBoundingBox();result.push({o,local:o.geometry.boundingBox.getCenter(new T.Vector3())});}return result;}
 const waterNozzles=centres('wash_nozzle_'),peelNozzles=centres('peel_nozzle_'),airKnives=centres('air_knife_').filter(x=>!x.o.name.includes('inlet'));
 const particlesN=180,positions=new Float32Array(particlesN*3),colors=new Float32Array(particlesN*3),geo=new T.BufferGeometry();geo.setAttribute('position',new T.BufferAttribute(positions,3));geo.setAttribute('color',new T.BufferAttribute(colors,3));
 const jets=new T.Points(geo,new T.PointsMaterial({size:.005,vertexColors:true,transparent:true,opacity:.8,depthWrite:false,sizeAttenuation:true}));root.add(jets);jets.frustumCulled=false;
 let enabled=false,lastAnchors=null;
 function update(state,t){
  if(!state.flow)return;const f=state.flow,anchors=batchAnchors(names,f);lastAnchors=anchors;
  batch.forEach(({g,roles,film,seam,cap},l)=>{
   g.position.copy(anchors[l].position);g.quaternion.copy(anchors[l].quaternion);
   for(const r of roles){r.o.visible=!(f.rootCut&&r.name.includes('_root_'));r.o.position.copy(r.pos);r.o.scale.copy(r.scale);
    if(r.name.endsWith('_stem')&&f.rootCut){r.o.scale.y=.75;r.o.position.y=.275;}
    if(r.name.includes('_leaf_')){if(f.leafCut){r.o.geometry.computeBoundingBox();const top=r.o.geometry.boundingBox.max.y;r.o.scale.y=(.60-.48)/Math.max(.01,top-.48);r.o.position.y=.48*(1-r.o.scale.y);}if(f.leafCut&&r.name.includes('_leaf_4'))r.o.visible=false;}
    if(r.name.includes('_skin_shell')){if(f.rootCut){r.o.scale.y=.75;r.o.position.y=.245;}r.o.visible=!f.peeled;r.o.material.transparent=true;r.o.material.opacity=1-(f.peelFraction??0);}
    if(r.name.endsWith('_stem')||r.name.includes('_leaf_'))r.o.material.roughness=f.water?.18:f.air?.35:.6;
   }
   const fold=f.phase.id==='weigh'?Math.min(1,(state.q.weigh_lift??0)/.040):f.owner==='outfeed'?1:(f.owner==='unload'&&(state.q.unload_axis??0)>.74?Math.max(0,1-(state.q.unload_Z12??.45)/.050):0),h=(f.sealed?.340-.050*fold:.350)*f.film;seam.position.y=cap.position.y=.060+.050*fold;film.visible=f.film>.001;film.scale.set(1,Math.max(.001,h),1);film.position.y=.400-h/2;seam.visible=f.sealed;cap.visible=f.sealed;
  });
  const centre=anchors[0].position.clone().add(anchors[1].position).multiplyScalar(.5);marker.position.copy(centre).add(new T.Vector3(0,.84,0));
  for(let l=0;l<2;l++){
   const rr=rootBits[l],lr=leafBits[l];rr.visible=f.rootCut&&f.rootWaste<1;lr.visible=f.leafCut&&f.leafWaste<1;
   if(rr.visible){const p=batchAnchors(names,{owner:'stock'})[l];rr.position.copy(p.position).add(new T.Vector3(0,.055-.35*f.rootWaste*f.rootWaste,0));rr.quaternion.copy(p.quaternion);}
   if(lr.visible){lr.position.copy(anchors[l].position).add(new T.Vector3(.04*Math.sin(t*3),.65-.8*f.leafWaste*f.leafWaste,.1*f.leafWaste));lr.rotation.set(f.leafWaste*3,t+l,0);}
  }
  for(let i=0;i<skinBits.length;i++){const o=skinBits[i],l=Math.floor(i/6),a=i*Math.PI/3;o.visible=f.peeled&&f.skinWaste<1;if(o.visible){o.position.copy(anchors[l].position).add(new T.Vector3(Math.cos(a)*(.018+.05*f.skinWaste),.20-.40*f.skinWaste*f.skinWaste,Math.sin(a)*(.018+.05*f.skinWaste)));o.rotation.set(t*.7,a,t);}}
  const wet=f.water,air=f.peelAir||f.air;const sources=f.water?waterNozzles:f.peelAir?peelNozzles:f.air?airKnives:[];jets.visible=enabled&&sources.length>0;
  if(jets.visible){const count=f.air?80+Math.floor(100*(1-f.dryFraction)):particlesN;geo.setDrawRange(0,count);for(let i=0;i<count;i++){const src=sources[i%sources.length],start=src.o.localToWorld(src.local.clone()),target=anchors[i%2].position.clone();target.y=start.y;const u=(t*(air?6:3.0)+i*.618)%1;const p=start.lerp(target,Math.min(1,u*1.35));p.y-=(wet||(f.air&&i>=80))?.24*u*u:.025*u;const jitter=.003*Math.sin(i*7+t*15);p.x+=jitter;p.z-=jitter;p.toArray(positions,i*3);colors.set((f.water||(f.air&&i>=80))?[.15,.85,1]:[.72,.95,1],i*3);}geo.attributes.position.needsUpdate=true;geo.attributes.color.needsUpdate=true;}
 }
 function setEnabled(on,products=true){enabled=on;root.visible=on;batch.forEach(b=>b.g.visible=on&&products);marker.visible=on&&products;for(const g of [...adapters,...demoGroups])g.visible=on;}
 function focus(mode,state){const a=lastAnchors??batchAnchors(names,state.flow),centre=a[0].position.clone().add(a[1].position).multiplyScalar(.5).add(new T.Vector3(0,.35,0).applyQuaternion(a[0].quaternion));let target=centre.clone();
  if(mode==='process'&&state.flow.phase.focus!=='batch'&&state.flow.phase.focus!=='stock'){
   const object=names.get(state.flow.phase.focus);if(object){const p=object.getWorldPosition(new T.Vector3());p.y=centre.y;target.lerp(p,.18);}
  }
  const radial=new T.Vector3(centre.x,0,centre.z).normalize();if(radial.lengthSq()<.1)radial.set(1,0,0);const tangent=new T.Vector3(-radial.z,0,radial.x),distance=mode==='material'?1.70:2.10;
  return {target,position:target.clone().addScaledVector(radial,distance).addScaledVector(tangent,.55).add(new T.Vector3(0,.48,0))};
 }
 return {root,meshes,batch,adapters,wrapper,sealer,update,setEnabled,focus};
}
