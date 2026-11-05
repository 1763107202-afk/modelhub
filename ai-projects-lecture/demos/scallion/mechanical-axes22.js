import * as T from 'three';
import {AXES22} from './axes22-data.js';
import {shuttleState} from './packaging21.js';
import {localPoint} from './flow14.js';
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z),X=V(1,0,0);
export function completeAxes22(k){
 const {parts,bodies,group,add,box,cyl,beam,mechanics}=k,start=parts.length,geos=new Map(),axes=[];
 const replace=/^R21_(spread_ball_screw|screw_end_bearing|screw_end_bracket|spread_servo|spread_coupling|servo_flange|servo_support|moving_ballnut|ballnut_riser)$/;
 for(const p of parts)if(replace.test(p.name)){p.visible=false;p.role='superseded';}
 for(const kind of ['in','out'])for(let l=0;l<4;l++){
  const f=bodies.find(b=>b.name==='R21_'+kind+'_shuttle_base'),carrier=bodies.find(b=>b.name==='R21_'+kind+'_belt_carrier_'+l),a=kind==='in'?3.76:6.85,ax=a+.16+l*.14;
  const sp=AXES22.spines[`spine_${kind}_${l}`],sd=AXES22.geometries[sp.geometry],sg=new T.BufferGeometry();sg.setAttribute('position',new T.Float32BufferAttribute(sd.v.map(v=>v*.001),3));sg.setIndex(sd.i);sg.computeVertexNormals();const oldSpine=parts.find(p=>p.body===carrier&&p.name==='R21_carrier_spine');oldSpine.geometry=sg;oldSpine.local.makeTranslation(sp.centre_x_mm*.001,.955,0);oldSpine.note='R22同源CAD脊梁，4×Ø4.4孔对应转接座M4×40';
  const fixed=group(`R22_${kind}_${l}_axis`,f,'pack'),moving=group(`R22_${kind}_${l}_clamp`,carrier,'pack');fixed.position.set(ax,.79,0);moving.position.set(ax,.79,0);
  const drive=group(`R22_${kind}_${l}_drive_shaft`,fixed,'pack'),idler=group(`R22_${kind}_${l}_idler_shaft`,fixed,'pack');drive.position.z=-1.02;idler.position.z=1.02;
  const groups={fixed,carriage:moving,drive,idler};
  for(const row of AXES22.parts){let geo=geos.get(row.geometry);if(!geo){const d=AXES22.geometries[row.geometry];geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(d.v.map(v=>v*.001),3));geo.setIndex(d.i);geo.computeVertexNormals();geos.set(row.geometry,geo);}const pos=V(...row.position_mm.map(v=>v*.001));if(row.body==='drive')pos.z+=1.02;if(row.body==='idler')pos.z-=1.02;const p=add(`R22_${kind}_${l}_${row.name}`,groups[row.body],geo,row.material,pos);p.note=row.description;p.axis22=row;}
  // Belt material loop: 2040 mm centres + 160 mm pulley circumference = 4240 mm.
  const R=.160/(2*Math.PI),L=4.24,segments=212,links=[];
  function path(s){s=(s%L+L)%L;if(s<2.04)return V(0,R,-1.02+s);s-=2.04;if(s<Math.PI*R)return V(0,R*Math.cos(s/R),1.02+R*Math.sin(s/R));s-=Math.PI*R;if(s<2.04)return V(0,-R,1.02-s);s-=2.04;return V(0,-R*Math.cos(s/R),-1.02-R*Math.sin(s/R));}
  // Continuous backing is fixed envelope, teeth/witnesses follow actual material displacement.
  for(const sign of [-1,1])box('R22_belt_backing',fixed,0,sign*(R+.0005),0,.015,.002,2.04,'belt');
  for(const z of [-1.02,1.02]){const sh=new T.Shape(),ro=R+.0015,ri=R-.0005;sh.absarc(0,0,ro,-Math.PI/2,Math.PI/2,false);sh.absarc(0,0,ri,Math.PI/2,-Math.PI/2,true);sh.closePath();const arc=new T.ExtrudeGeometry(sh,{depth:.015,bevelEnabled:false,curveSegments:32});arc.rotateY(-Math.PI/2);arc.translate(.0075,0,0);if(z<0)arc.rotateX(Math.PI);add('R22_belt_wrap_envelope',fixed,arc,'belt',V(0,0,z));}
  for(let j=0;j<segments;j++){const g=group('R22_belt_material_marker',fixed,'pack');box('R22_belt_marker',g,0,0,0,.015,.001,.002,'brass');links.push(g);}
  for(const z of [-1.02,1.02]){

   beam('R22_axis_mount_crossmember',f,V(a+.08,.739,z),V(ax+.05,.739,z),.028,.028);
   beam('R22_axis_mount_to_rail_bed',f,V(a+.08,.739,z),V(a+.08,.8235,z),.028,.028);
  }
  // Motor / coupling retain their own support and shaft line; no floating motor.
  beam('R22_axis_motor_mount',fixed,V(-.05,-.035,-1.02),V(-.025,-.034,-1.02),.018,.022);
  axes.push({kind,l,drive,idler,links,path,R});
 }
 const rec=mechanics.records.find(r=>r.id==='pack21');Object.assign(rec,{title:'R22 四路包装与同步带横移',power:'八台候选伺服驱动横移同步带；承托带另有独立电机；包装热轮与封切各自驱动',transmission:'600mm包装列距；双导轨承重，同步带夹块牵引小车；32齿×5mm节距，端轴承座/轴肩/键传矩。短程折边升降丝杠保留。',limit:'R22同步带轴局部同源CAD；电机接口、张紧结构、夹带齿形/拉脱力、完整安装紧固、公差与强度仍待完成，不是制造放行。'});
 return {axes,parts:parts.slice(start),update(t){for(const a of axes){const z=shuttleState(a.kind,a.l,t).z;a.drive.rotation.x=z/a.R;a.idler.rotation.x=z/a.R;for(let j=0;j<a.links.length;j++){const s=j*4.24/a.links.length+z,g=a.links[j],p=a.path(s);g.position.copy(p);g.quaternion.setFromUnitVectors(V(0,0,1),a.path(s+.00001).sub(a.path(s-.00001)).normalize());}}},inspect(p){if(!p.name.startsWith('R22_'))return null;return {record:'pack21',support:'同步带端轴→双轴承座→底板/横梁→导轨床/立腿→地脚；夹带座→小车→双导轨',power:rec.power,transmission:rec.transmission,note:(p.note||'名义机械部件')+'；'+rec.limit};}};
}
