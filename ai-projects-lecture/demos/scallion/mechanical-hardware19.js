import * as T from 'three';
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z),Y=V(0,1,0),Z=V(0,0,1),TAU=Math.PI*2;
// Nominal geometry in metres. Thread forms are simplified; no torque, grade,
// fatigue, seal, thread tolerance or manufacturing acceptance is implied.
export function completeHardware(k){
 const {root,parts,bodies,group,add,box,beam}=k,records=[],joints=[],profiles=[],cache=new Map();
 const geo=(key,fn)=>{if(!cache.has(key))cache.set(key,fn());return cache.get(key);};
 const hide=p=>{p.visible=false;p.role='superseded';};
 function rectangle(w,h){const s=new T.Shape();s.moveTo(-w/2,-h/2);s.lineTo(w/2,-h/2);s.lineTo(w/2,h/2);s.lineTo(-w/2,h/2);s.closePath();return s;}
 function extrude(s,d){return new T.ExtrudeGeometry(s,{depth:d,bevelEnabled:false,curveSegments:24}).translate(0,0,-d/2);}
 function perforated(w,h,d,holes=[]){const s=rectangle(w,h);for(const {x=0,y=0,r}of holes){const a=new T.Path();a.absarc(x,y,r,0,TAU,true);s.holes.push(a);}return extrude(s,d);}
 function ring(outer,inner,h,sides=32){const s=new T.Shape();for(let i=0;i<sides;i++){const a=i*TAU/sides;i?s.lineTo(outer*Math.cos(a),outer*Math.sin(a)):s.moveTo(outer*Math.cos(a),outer*Math.sin(a));}s.closePath();const a=new T.Path();a.absarc(0,0,inner,0,TAU,true);s.holes.push(a);return extrude(s,h).rotateX(-Math.PI/2);}
 function hexHead(D,H,AF,depth){const s=new T.Shape();s.absarc(0,0,D/2,0,TAU,false);const hole=new T.Path(),r=AF/Math.sqrt(3);for(let i=0;i<6;i++){const a=-i*TAU/6;i?hole.lineTo(r*Math.cos(a),r*Math.sin(a)):hole.moveTo(r*Math.cos(a),r*Math.sin(a));}hole.closePath();s.holes.push(hole);const bottom=new T.CylinderGeometry(D/2,D/2,H-depth,32).translate(0,(H-depth)/2,0),top=extrude(s,depth).rotateX(-Math.PI/2).translate(0,H-depth/2,0);return [bottom,top];}
 function thread(d,L,pitch){const nr=24,nz=Math.ceil(L/pitch*8),v=[],idx=[],depth=.6134345*pitch,rootR=d/2-depth;
  for(let j=0;j<=nz;j++){const u=L*j/nz;for(let i=0;i<=nr;i++){const a=TAU*i/nr,phase=((u/pitch-a/TAU)%1+1)%1;let f=phase<1/8?1:phase<23/48?1-(phase-1/8)/(17/48):phase<31/48?0:(phase-31/48)/(17/48);const taper=Math.min(1,u/(pitch*.6),(L-u)/(pitch*.6)),r=rootR+depth*f*Math.max(0,taper);v.push(r*Math.cos(a),-u,r*Math.sin(a));}}
  for(let j=0;j<nz;j++)for(let i=0;i<nr;i++){const a=j*(nr+1)+i,b=a+nr+1;idx.push(a,b,a+1,a+1,b,b+1);}for(const j of [0,nz]){const c=v.length/3;v.push(0,-L*j/nz,0);for(let i=0;i<nr;i++){const a=j*(nr+1)+i;j?idx.push(c,a+1,a):idx.push(c,a,a+1);}}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(v,3));g.setIndex(idx);g.computeVertexNormals();return g;}
 const specs={M4:{d:.004,pitch:.0007,L:.016,D:.007,H:.004,AF:.003,recess:.002,washerID:.0043,washerOD:.009,washerT:.0008,nutAF:.007,nutH:.0032},M6:{d:.006,pitch:.001,L:.045,D:.010,H:.006,AF:.005,recess:.003,washerID:.0064,washerOD:.012,washerT:.0016,nutAF:.010,nutH:.005}};
 function record(id,title,base,support,power,drive,focus,build){const r={id,title,base,support,power,drive,focus,parts:[],witness:null,limit:'名义装配几何；螺纹为简化外形，内螺纹牙型未展开。螺栓等级、拧紧扭矩、防松、材料与载荷均待工程选型。'};records.push(r);const start=parts.length;build(r);for(const p of parts.slice(start)){p.hardware19=id;r.parts.push(p.index);}if(r.witness===null)r.witness=r.parts[0];return r;}
 function throughJoint(r,body,x,z,underHead,bottomFace,spec,targets,tag){const s=specs[spec],id=tag,ids=[],put=(name,g,mat,y)=>{const p=add(name,body,g,mat,V(x,y,z));p.joint19=id;ids.push(p.index);return p;};
  const head=geo(spec+'head',()=>hexHead(s.D,s.H,s.AF,s.recess));put('hardware19_socket_head_base',head[0],'steel',underHead);put('hardware19_socket_head_recess',head[1],'steel',underHead);
  const shank=put('hardware19_thread_'+spec,geo(spec+'thread',()=>thread(s.d,s.L,s.pitch)),'steel',underHead);
  const washer=geo(spec+'washer',()=>ring(s.washerOD/2,s.washerID/2,s.washerT));put('hardware19_upper_washer',washer,'steel',underHead-s.washerT/2);put('hardware19_lower_washer',washer,'steel',bottomFace-s.washerT/2);
  put('hardware19_hex_nut_'+spec,geo(spec+'nut',()=>ring(s.nutAF/Math.sqrt(3),s.d*.43,s.nutH,6)),'dark',bottomFace-s.washerT-s.nutH/2);
  const protrusion=s.L-(underHead-bottomFace+s.washerT+s.nutH);joints.push({id,record:r.id,body:body.name,bodyRef:body,x,z,under_head_y:underHead,bottom_face_y:bottomFace,spec:spec+'×'+s.L*1000,pitch_m:s.pitch,clearance_diameter_m:s.d+.0005+(spec==='M6'?.0001:0),nominal_diameter_m:s.d,length_m:s.L,washer_id_m:s.washerID,washer_od_m:s.washerOD,washer_thickness_m:s.washerT,nut_af_m:s.nutAF,nut_height_m:s.nutH,head_diameter_m:s.D,head_height_m:s.H,hex_socket_af_m:s.AF,protrusion_m:protrusion,protruding_pitches:protrusion/s.pitch,parts:ids,targets,shank:shank.index});return shank;
 }
 // Fixed header clamps. The old stand-off ended at the pipe centre and has
 // been removed rather than hidden inside a new decorative ring.
 for(const [i,old]of parts.filter(p=>p.visible!==false&&p.name==='header_split_clamp').entries()){
  const oldStem=parts[old.index-1];if(oldStem.name!=='header_clamp_standoff')throw Error('Header clamp support order');hide(old);hide(oldStem);
  const p=V(),q=new T.Quaternion(),sz=V();old.local.decompose(p,q,sz);const air=p.y>1.95,pipeR=air?.018:.013,Ri=pipeR+.001,Ro=pipeR+.003,sign=air?-1:1;
  const b=group('hardware19_header_clamp_'+i,old.body,'utilities');b.position.copy(p);b.quaternion.copy(q);
  record('clamp_'+i,(air?'气':'水')+'总管 · 分体管夹 '+(Math.floor(i/2)+1),'utilities','总管→1mm衬垫→上下半夹→双耳螺栓；承载半夹→焊接座→短撑→固定环支架','被动夹紧，无独立动力','固定连接；不跨越旋转部，短撑终止于夹体外壁',{module:'peel',time:26},r=>{
   const liner=add('hardware19_pipe_liner',b,geo('liner'+pipeR,()=>ring(pipeR+.001,pipeR,.012).rotateX(Math.PI/2)),'pad');r.witness=liner.index;
   for(const side of [-1,1]){const a=Math.asin(.0005/Ri),s=new T.Shape();s.absarc(0,0,Ro,a,Math.PI-a,false);s.lineTo(Ri*Math.cos(Math.PI-a),Ri*Math.sin(Math.PI-a));s.absarc(0,0,Ri,Math.PI-a,a,true);s.closePath();const band=add('header_split_clamp',b,geo('band'+pipeR+side,()=>extrude(s,.012).rotateZ(side>0?0:Math.PI)),'steel');band.note='R19分体半夹，1mm分缝；实际环带与拆卸耳板';
    for(const sx of [-1,1]){const ear=add('hardware19_clamp_lug',b,geo('M4ear',()=>perforated(.014,.016,.004,[{r:.00225}])),'steel',V(sx*(Ro+.006),side*.0025,0),V(1,1,1),new T.Quaternion().setFromUnitVectors(Z,Y));ear.hole19={diameter_m:.0045,axis_local:'Y'};}
   }
   for(const sx of [-1,1]){const targets=parts.filter(v=>v.body===b&&v.name==='hardware19_clamp_lug'&&Math.sign(v.local.elements[12])===sx).map(v=>v.index);throughJoint(r,b,sx*(Ro+.006),0,.0053,-.0045,'M4',targets,'clamp_'+i+'_'+sx);}
   box('hardware19_clamp_weld_boss',b,0,sign*(Ro+.0005),0,.012,.003,.012,'steel','焊接座仅落在承载半夹外壁；焊缝尺寸待载荷计算');box('hardware19_clamp_support_shoe',b,0,sign*(Ro+.003),0,.018,.004,.018);beam('hardware19_header_standoff',b,V(0,1.95-p.y,0),V(0,sign*(Ro+.005),0),.010,.010);
  });
 }
 // Lift motors: a projecting nominal motor flange exposes the bolts beyond
 // the gearbox envelope. Both members have the matching clearance holes.
 for(const j of [1,2]){const fixed=bodies.find(b=>b.name==='fixed_station_'+j),gm=bodies.find(b=>b.name==='peel_scan_servo_'+j),plate=parts.find(p=>p.body===fixed&&p.name==='detail_peel_lift_bored_motor_plate'),flange=parts.find(p=>p.body===fixed&&p.name==='detail_peel_lift_motor_flange');
  for(const p of parts.filter(p=>p.body===fixed&&/^detail_peel_lift_flange_bolt_/.test(p.name)))hide(p);
  const holes=[{r:.016}];for(const dx of [-.055,.055])for(const dz of [-.055,.055])holes.push({x:dx,y:dz,r:.0033});
  plate.geometry=perforated(.16,.16,.020,holes);flange.geometry=perforated(.14,.14,.0125,holes);plate.holes19=holes;flange.holes19=holes;
  root.updateMatrixWorld(true);flange.local.premultiply(fixed.matrixWorld).premultiply(gm.matrixWorld.clone().invert());flange.body=gm;flange.support=gm.name;flange.note='电机整体法兰名义外形：140mm方形、4×Ø6.6通孔；须按选定电机供应商图纸复核';
  record('lift_flange_'+j,'去皮 '+j+' · 电机法兰穿栓接头','process','电机整体法兰→4套M6穿栓→20mm顶板→斜撑→立柱；中心孔让输出轴通过','竖直伺服 / 抱闸由电柜驱动，输出轴朝下','电机→联轴器→升降丝杠；穿栓将电机反扭矩传至固定支架',{module:'peel',time:j===1?26:34},r=>{
   for(const dx of [-.055,.055])for(const dz of [-.055,.055])throughJoint(r,fixed,1.61+dx,.34+dz,1.7691,1.735,'M6',[plate.index,flange.index],'lift_'+j+'_'+dx+'_'+dz);
   r.witness=flange.index;flange.hardware19=r.id;plate.hardware19=r.id;r.parts.push(plate.index,flange.index);r.limit+=' 电机法兰为设计接口，尚非已采购电机图纸；4.3mm伸出量仅按当前名义叠厚计算。';
  });
 }
 // Box sections are genuinely hollow, inside their old outer envelope. End
 // caps close open edges. Wall values are design assumptions, not load ratings.
 const profileRE=/^(?:base_rail|base_cross|track_outrigger_|station_cantilever_|drive_drop_column_|peel_column_|airknife_post$|load_bed$|unload_bed$|load_cantilever_arm$|unload_cantilever_arm$|dock_outboard_box_boom)/;
 for(const p of parts.filter(p=>p.visible!==false&&p.geometry.type==='BoxGeometry'&&profileRE.test(p.name))){const position=V(),q=new T.Quaternion(),s=V();p.local.decompose(position,q,s);const dims=s.toArray(),axis=dims.indexOf(Math.max(...dims)),cross=[0,1,2].filter(i=>i!==axis),[w,h]=cross.map(i=>dims[i]),L=dims[axis];if(L<3*Math.max(w,h)||Math.min(w,h)<.02)continue;const wall=Math.min(w,h)>=.05?.003:Math.min(w,h)>=.03?.002:.0015,cap=.002;
  const shape=rectangle(w,h),hole=rectangle(w-2*wall,h-2*wall);shape.holes.push(new T.Path(hole.getPoints().reverse()));const tube=extrude(shape,L);tube.translate(0,0,0);const map=new T.Matrix4().set(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1);const rows=[[],[],[]];for(let i=0;i<3;i++){rows[i]=[0,0,0];rows[i][i===cross[0]?0:i===cross[1]?1:2]=1;}if(axis===1)rows[cross[1]][1]=-1;map.set(...[...rows[0],0,...rows[1],0,...rows[2],0,0,0,0,1]);tube.applyMatrix4(map).scale(1/dims[0],1/dims[1],1/dims[2]);p.geometry=tube;p.profile19={outer_m:dims,wall_m:wall,end_cap_m:cap,axis,assumption:true};
  for(const sign of [-1,1]){const cs=[w,h,cap],g=new T.BoxGeometry(...cs).translate(0,0,sign*(L-cap)/2).applyMatrix4(map).scale(1/dims[0],1/dims[1],1/dims[2]);const c=add('hardware19_tube_end_cap',p.body,g,p.mat);c.local.copy(p.local);c.hardware19='profiles';c.note='封口板焊接名义外形；焊缝及排水/卫生细节待工程设计';}
  profiles.push({part:p.index,name:p.name,body:p.body.name,...p.profile19});
 }
 const pending=parts.filter(p=>p.visible!==false&&p.name.endsWith('_shank')).map(p=>({part:p.index,name:p.name,body:p.body.name,module:p.module,status:'待匹配孔、叠厚、螺纹、工具空间与防松选型'}));
 const byId=new Map(records.map(r=>[r.id,r]));return {records,joints,profiles,pending,specs,inspect(p){const r=byId.get(p.hardware19);if(r)return {record:r.base,support:r.support,power:r.power,transmission:r.drive,note:(p.note?p.note+'\n':'')+r.limit,hardware_id:r.id};if(p.profile19||p.hardware19==='profiles')return {note:'R19空心型材与封口板名义形态；壁厚为设计假设，尚未验算强度、焊缝和排水。'};if(p.name.endsWith('_shank'))return {note:'遗留简化紧固点：尚未完成对应孔、螺纹、叠厚、防松和工具空间复核。'};return null;}};
}
