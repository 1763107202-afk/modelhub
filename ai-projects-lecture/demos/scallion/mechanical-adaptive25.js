import * as T from 'three';import {GRIP24} from './grip24-data.js';import {A24,clamp24} from './adaptive24.js';import {C,laneZ,localPoint} from './flow14.js';
import {TRANSFER25} from './transfer25-data.js';
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
// Circular wire is rebuilt on its helix; wire diameter never scales with stroke.
export function spring24(lengthMM=25){const N=22,ns=N*24,nr=6,R=2.75,r=.225,L=lengthMM,vs=[],ix=[];
 const axial=u=>u<1?.225+.45*u:u<=21?.675+(L-1.35)*(u-1)/20:L-.675+.45*(u-21);
 for(let j=0;j<=ns;j++){const u=N*j/ns,a=u*Math.PI*2,x=axial(u),pitch=u<1||u>21?.45:(L-1.35)/20,t=V(pitch, -2*Math.PI*R*Math.sin(a),2*Math.PI*R*Math.cos(a)).normalize(),n=V(0,Math.cos(a),Math.sin(a)),b=t.clone().cross(n).normalize();for(let k=0;k<nr;k++){const q=k/nr*Math.PI*2;vs.push((x+r*(Math.cos(q)*n.x+Math.sin(q)*b.x))*.001,(R*Math.cos(a)+r*(Math.cos(q)*n.y+Math.sin(q)*b.y))*.001,(R*Math.sin(a)+r*(Math.cos(q)*n.z+Math.sin(q)*b.z))*.001);}}
 for(let j=0;j<ns;j++)for(let k=0;k<nr;k++){const a=j*nr+k,b=j*nr+(k+1)%nr,c=a+nr,d=b+nr;ix.push(a,c,b,b,c,d);}for(const j of [0,ns]){const c=vs.length/3;vs.push(axial(N*j/ns)*.001,R*.001,0);for(let k=0;k<nr;k++){const a=j*nr+k,b=j*nr+(k+1)%nr;if(j)ix.push(c,a,b);else ix.push(c,b,a);}}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vs,3));g.setIndex(ix);g.computeVertexNormals();return g;
}
export function completeAdaptive25({parts,bodies,keepers,group,add,beam,transfers,mechanics}){
 const start=parts.length,cache=new Map(),units=[],rear=[];
 const nominal=clamp24(28,0);const wire=spring24(nominal.coilLength);
 function addRow(row,parent,prefix){let g=cache.get(row.geometry);if(!g){const d=GRIP24.geometries[row.geometry];g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(d.v.map(x=>x*.001),3));g.setIndex(d.i);g.computeVertexNormals();cache.set(row.geometry,g);}const p=add(prefix+row.name,parent,g,row.material,V(...row.position_mm.map(x=>x*.001)));p.cad24=row;p.note=row.description;return p;}
 for(const p of parts){if(p.visible===false)continue;if(/^front_food_roller_|^front_pin$|^follower_rotation_mark$|^front_radial_spring_slide$|^follower_preload_spring$|^follower_encoder/.test(p.name)){p.visible=false;p.role='superseded';}}
 for(const {g:gate,i,l}of keepers){const cell=gate.parent,z=laneZ(l),dir=l<2?1:-1,levels=l%2?[1.10,1.20,1.36,1.46]:[1.115,1.185,1.375,1.445];
  // A former solid link crossed the new cartridge. The replacement roof/side link supplies its load path.
  for(const p of parts.filter(p=>p.body===gate&&(/keeper_C_arm_|^keeper_front_link$/.test(p.name)))){if([1.191,1.3675].some(y=>Math.abs(p.local.elements[13]-y)<.011)){p.visible=false;p.role='superseded';}}
  for(const [h,oldH]of [[1.15,1.15],[1.35,1.41]]){
   const fixed=group(`R24_fixed_${i}_${l}_${h}`,gate,'rotary'),moving=group(`R24_moving_${i}_${l}_${h}`,gate,'rotary'),wheel=bodies.find(b=>b.name===`front_sprung_follower_${i}_${l}_${oldH}`),rearGuard=group(`R24_rear_capture_${i}_${l}_${h}`,cell,'rotary');
   fixed.position.set(.025,h,0);moving.position.set(.025,h,0);wheel.position.set(.025,h,0);rearGuard.position.set(C.radius+.025,h,z);
   const parents={fixed,moving,wheel,rear:rearGuard};for(const row of GRIP24.parts)if(parents[row.body])addRow(row,parents[row.body],`R24_${i}_${l}_${h}_`);
   const sp=add('R24_guided_compression_spring',fixed,wire,'brass',V(.030,.041,0));sp.adaptiveSpring24={wire_mm:.45,mean_diameter_mm:5.5,active_coils:20,free_length_mm:50};sp.note='闭合端圈，Ø0.45线径独立几何；弹簧常数按假定材料计算，端面磨平/疲劳与腐蚀需试验';
   const y=h<1.2?levels[0]:levels[3];beam('R24_gate_mount_link',gate,V(.0395,y+(h<1.2?.0045:-.0045),dir*.014),V(.0395,h+(h<1.2?.063:.067),dir*.014),.004,.004,'steel','新夹具上桥→侧置焊接拉杆→原门架横臂；不穿过滑杆或弹簧');
   for(const dy of [-.025,.025])beam('R24_rear_capture_spine_link',cell,V(C.radius-.061,h+dy,z),V(C.radius-.040,h+dy,z),.004,.008,'steel','后U框→短焊接梁→托座背柱');
   units.push({fixed,moving,wheel,spring:sp,i,l,h});
  }
 }
 // Replace both old long contact bands; retain the existing powered vertical shafts.
 for(let i=0;i<12;i++)for(let l=0;l<4;l++)for(const sign of [-1,1]){const shaft=bodies.find(b=>b.name===`rear_roller_rotor_${i}_${l}_${sign}`),cell=shaft.parent;
  for(const p of parts.filter(p=>p.body===shaft&&/^rear_food_roller_|^rear_roller_pin$|^rear_roller_rotation_mark$/.test(p.name))){p.visible=false;p.role='superseded';}
  for(const [h,old]of [[1.15,1.15],[1.35,1.41]]){const w=group(`R24_rear_wheel_${i}_${l}_${sign}_${h}`,shaft,'rotary');w.position.y=h;for(const row of GRIP24.parts.filter(r=>r.body==='rearwheel'))addRow(row,w,`R24_${i}_${l}_${sign}_${h}_`);rear.push(w);
   if(h!==old)for(const p of parts.filter(p=>p.body===cell&&p.name==='rear_roller_mount'&&Math.abs(p.local.elements[13]-(old+.040))<1e-5&&Math.abs(p.local.elements[14]-(laneZ(l)+sign*.026))<1e-5)){const pos=V(),q=new T.Quaternion(),s=V();p.local.decompose(pos,q,s);pos.y-=old-h;p.local.compose(pos,q,s);}
  }
 }
 // Replace complete transfer fingers and rails; continuous steel, actual separate liners.
 for(const p of [...parts])if(/^(load|unload)_split_(longitudinal_rail_|C_)/.test(p.name)){p.visible=false;p.role='superseded';}
 const transferParts=[];
 function transferRow(n,row,parent,pos){const d=TRANSFER25.geometries[row.geometry];let geo=cache.get('t25_'+row.geometry);if(!geo){geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(d.v.map(x=>x*.001),3));geo.setIndex(d.i);geo.computeVertexNormals();cache.set('t25_'+row.geometry,geo);}const p=add(n,parent,geo,row.material,pos);p.transfer25=row;p.note=row.name.startsWith('frame')?'C钢骨→径向梁→折弯梁→开让位槽纵杆→原齿条支座；焊接载荷待核':row.name.startsWith('liner')?'填入钢骨浅槽的独立包胶；粘接、材料和寿命待试验':'Ø10导杆分体限位环，Ø10.1真实孔、开缝、M3孔/螺钉/垫圈；夹紧防滑待核';transferParts.push(p);return p;}
 for(const t of transfers){for(let l=0;l<4;l++)for(const [side,parent]of [['L',t.left],['R',t.right]]){const family=l%2?'odd':'even';for(const row of TRANSFER25.parts.filter(r=>r.name.includes('_'+family+'_'+side)))transferRow(`R25_transfer_${t.kind}_${l}_${row.name}`,row,parent,V(0,0,laneZ(l)));}
 // Outer fixed collars meet the ±250mm slide's ±30mm end face at 22mm stroke.
 for(const h of [.07,.23])for(const sign of [-1,1])for(const row of TRANSFER25.parts.filter(r=>r.name.startsWith('stop_')))transferRow(`R25_${t.kind}_${h}_${sign}_${row.name}`,row,t.cage,V(.28,h,sign*.306));}
 const transferRecord={id:'transfer25',title:'R25 移载钢骨、包胶与硬限位',module:'unload',support:'根端托叉承重；C钢骨→径向细梁→折弯梁→外侧纵杆→齿条支座→导杆滑块→翻转架→升降/径向导轨→落地床身。',power:'原夹笼电机→同步带→上下齿轮齿条；原径移/升降丝杠与翻转伺服。',transmission:'每半笼开20mm；Ø10导杆上的开缝限位环在22mm接触蓝色滑块端面；空笼外停R1650mm，转盘停稳后才接近。',witness:[transferParts[0].name],limit:'当前整线仅Ø28直葱；C笼口未完成Ø18–34/弯曲适配。硬限位夹紧力、冲击载荷、焊接与包胶材料待验证。',focus:{module:'unload',time:73.3,target:localPoint(7,1.26,1.25,-.18).toArray(),distance:.8}};
 mechanics.records.push(transferRecord);
 const record={id:'adaptive25',title:'R25 分层浮动夹持与防掉框',module:'rotary',support:'根托承担自重；短鼓形后轮由原纵轴驱动。前轮→Ø5轴/轴承→滑动叉架/Ø4导杆→前后衬套→管夹→上桥/侧拉杆→门架。后U框接托座背柱，前挡条随门打开。',power:'工位接触驱动→原横轴/蜗轮/同步带→两后轮；每个前轮独立导向压簧提供限力，固定工位开笼执行器退让。',transmission:'夹持中心改为根上110/310mm，鼓形接触带14mm；每层弹簧独立。机械捕获框限制脱出，避免仅靠湿茎摩擦悬吊；名义开笼42mm。',witness:['R24_guided_compression_spring','R24_0_0_1.15_moving_rod_and_fork'],limit:'Ø18–34、200mm夹距弓高≤4mm只是本轮几何/弹簧候选范围，尚非实料适配认证。整线主动画仍按Ø28直葱；变径/弯曲见专项试验页。移载夹爪、全线供膜与全部实料工况未完成范围验证。',focus:{module:'peel',time:26,target:localPoint(1,C.radius,1.25,-.18).toArray(),distance:.65}};
 mechanics.records.push(record);const prior=mechanics.category;mechanics.category=p=>p.cad24||p.adaptiveSpring24||p.name.startsWith('R24_')?'adaptive25':p.transfer25?'transfer25':prior(p);
 return {units,transferParts,parts:parts.slice(start),metadata:GRIP24,record,update(t){for(const {g,l}of keepers){const open=Math.abs(g.position.z-laneZ(l))/.042;g.position.z=laneZ(l)+(l<2?1:-1)*.042*open;}for(const b of bodies.filter(b=>/^keeper_return_spring_/.test(b.name))){const l=Number(b.name.split('_').at(-1)),cell=b.parent,g=keepers.find(k=>k.g.parent===cell&&k.l===l)?.g;if(g)b.scale.z=(.06+Math.abs(g.position.z-laneZ(l)))/.06;}for(const b of bodies.filter(b=>/^keeper_opener_fork_/.test(b.name)))b.position.z*=42/42;},inspect(p){if(p.transfer25)return{record:'transfer25',support:transferRecord.support,power:transferRecord.power,transmission:transferRecord.transmission,note:p.note+'；'+transferRecord.limit};return p.cad24||p.adaptiveSpring24||p.name.startsWith('R24_')?{record:'adaptive25',support:record.support,power:record.power,transmission:record.transmission,note:(p.note||'')+'；'+record.limit}:null;}};
}
