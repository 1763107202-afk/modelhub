import * as T from 'three';
const V=()=>new T.Vector3();
// Weld coincident triangle vertices, close boundary loops, preserve outer dimensions.
export function closeSurface23(source,thickness=0){
 const a=source.attributes.position,ix=source.index,verts=[],lookup=new Map(),map=[];
 for(let i=0;i<a.count;i++){const p=[a.getX(i),a.getY(i),a.getZ(i)],k=p.map(v=>Math.round(v*1e8)).join(':');if(!lookup.has(k)){lookup.set(k,verts.length);verts.push(p);}map.push(lookup.get(k));}
 let faces=[];for(let i=0;i<(ix?ix.count:a.count);i+=3){const f=[0,1,2].map(k=>map[ix?ix.getX(i+k):i+k]);if(new Set(f).size===3)faces.push(f);}
 const edges=new Map();for(const f of faces)for(let i=0;i<3;i++){const e=[f[i],f[(i+1)%3]],k=[...e].sort((a,b)=>a-b).join(':');if(!edges.has(k))edges.set(k,[]);edges.get(k).push(e);}
 const boundary=[...edges.values()].filter(x=>x.length===1).map(x=>x[0]);
 if(thickness){
  const normals=verts.map(()=>V());for(const [a,b,c]of faces){const n=new T.Vector3(...verts[b]).sub(new T.Vector3(...verts[a])).cross(new T.Vector3(...verts[c]).sub(new T.Vector3(...verts[a])));for(const j of [a,b,c])normals[j].add(n);}for(const n of normals)n.normalize();
  const n=verts.length;let vv=[];for(const sign of [-1,1])verts.forEach((p,i)=>vv.push(new T.Vector3(...p).addScaledVector(normals[i],sign*thickness/2).toArray()));verts.splice(0,verts.length,...vv);const old=faces;faces=[];for(const [a,b,c]of old)faces.push([c,b,a],[a+n,b+n,c+n]);for(const [a,b]of boundary)faces.push([a,b,b+n],[a,b+n,a+n]);
 }else{
  const remaining=new Map(boundary.map(([a,b])=>[a,b]));while(remaining.size){const first=remaining.keys().next().value,loop=[first];let cur=first;for(let i=0;i<boundary.length+1;i++){const next=remaining.get(cur);remaining.delete(cur);if(next===undefined||next===first)break;loop.push(next);cur=next;}if(loop.length<3)throw Error('Invalid open boundary');const centre=[0,0,0];for(const i of loop)for(let j=0;j<3;j++)centre[j]+=verts[i][j]/loop.length;const c=verts.length;verts.push(centre);for(let i=0;i<loop.length;i++)faces.push([loop[(i+1)%loop.length],loop[i],c]);}
 }
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(verts.flat(),3));g.setIndex(faces.flat());g.computeVertexNormals();return g;
}
export function completeRefine23({parts,box}){
 const modified=[],endplates=[],cache=new Map();
 const tubeNames=/^(leg_|base_rail$|base_cross$|base_diagonal$|pan_bracket_|track_wheel_pedestal_|.*(?:_column|_column_extension|_frame_rail|_frame_side|_frame_riser|_shuttle_leg|_longitudinal_tie|_floor_leg|_carrier_spine|_support_post|_frame_post|_crossmember|_extension_leg|_drop_column|_fixed_side|_end_drop|_motor_seat_link|_mast_diagonal|_portal_knee)$)/;
 for(const p of [...parts]){
  if(p.visible===false||['product','effect'].includes(p.module)||p.role==='overlay')continue;
  if(p.geometry.type==='TubeGeometry'||p.name==='crossfeed_belt_end_wrap'||/^R21_L\d_belt_end_wrap$/.test(p.name)){
   const th=p.geometry.type==='TubeGeometry'?0:.001,key=p.geometry.uuid+':'+th;if(!cache.has(key))cache.set(key,closeSurface23(p.geometry,th));p.geometry=cache.get(key);p.detail23={kind:th?'closed-belt-wrap':'closed-wire-cable',thickness_mm:th*1000,limit:'闭合实体不证明材料变形、弹簧端接或寿命通过'};modified.push(p);continue;
  }
  const g=p.geometry;if(p.axis22||p.drive20||p.cad23||g.type!=='BoxGeometry'||!tubeNames.test(p.name))continue;
  if(g.parameters.width!==1||g.parameters.height!==1||g.parameters.depth!==1)continue;
  const pos=V(),scale=V(),q=new T.Quaternion();p.local.decompose(pos,q,scale);const dims=scale.toArray(),axis=dims.indexOf(Math.max(...dims)),cross=[0,1,2].filter(i=>i!==axis),L=dims[axis],w=dims[cross[0]],h=dims[cross[1]];
  if(L<.12||L/Math.max(w,h)<4||Math.min(w,h)<.020)continue;const t=Math.min(w,h)<.04?.002:.003;
  const sh=new T.Shape();sh.moveTo(-w/2,-h/2);sh.lineTo(w/2,-h/2);sh.lineTo(w/2,h/2);sh.lineTo(-w/2,h/2);sh.closePath();const hole=new T.Path();hole.moveTo(-w/2+t,-h/2+t);hole.lineTo(-w/2+t,h/2-t);hole.lineTo(w/2-t,h/2-t);hole.lineTo(w/2-t,-h/2+t);hole.closePath();sh.holes.push(hole);
  const ng=new T.ExtrudeGeometry(sh,{depth:L-2*t,bevelEnabled:false});ng.translate(0,0,-(L-2*t)/2);
  const basis=new T.Matrix4();const u=V().setComponent(cross[0],1),v=V().setComponent(cross[1],1),n=V().setComponent(axis,1);basis.makeBasis(u,v,n);if(basis.determinant()<0){v.negate();basis.makeBasis(u,v,n);}ng.applyMatrix4(basis);p.geometry=ng;p.local.compose(pos,q,new T.Vector3(1,1,1));p.detail23={kind:'RHS-with-separate-endplates',wall_mm:t*1000,limit:'名义焊接空心型材，焊缝承载与防腐待核'};modified.push(p);
  for(const sign of [-1,1]){const d=[...dims];d[axis]=t;const offset=V().setComponent(axis,sign*(L-t)/2).applyQuaternion(q).add(pos),cap=box('R23_endplate_'+p.index+'_'+sign,p.body,...offset.toArray(),...d,'steel','独立焊接端封板；名义对接',q);cap.detail23={kind:'welded-endplate',source_part:p.index};endplates.push(cap);}
 }
 return {parts:modified,endplates,inspect(p){return p.detail23?{note:(p.note||'')+'；R23 '+p.detail23.kind+'；'+(p.detail23.limit||'焊缝强度待验')}:null;}};
}
