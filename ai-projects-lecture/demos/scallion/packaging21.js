import * as T from 'three';
import {buildFilmUnit} from './film-unit16.js';
import {laneZ,ramp,stationQ,localPoint,productPose} from './flow14.js';
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z),Y=V(0,1,0),Z=V(0,0,1),X=V(1,0,0);
export const PACK21=Object.freeze({lanePitch:.60,oldPitch:.12,wrapperOffset:3,downstreamOffset:4.1,delay:24,bagPitch:.60});
export function shuttleState(kind,l,t){const b=((t-80)%8+8)%8,narrow=laneZ(l),wide=(l-1.5)*.60;
 if(kind==='in')return {z:narrow+(wide-narrow)*(ramp(b,0,1.5)-ramp(b,5,6.2)),fed:ramp(b,1.7,4.8),loaded:b<=4.8,phase:b};
 return {z:wide+(narrow-wide)*(ramp(b,2.1,3.3)-ramp(b,6.1,7.6)),fed:.88*ramp(b,0,2)+.88*ramp(b,3.4,6),loaded:b<=6,phase:b};
}
// Subdivide at the fold line so each side bends rigidly without stretching a triangle.
function creaseGeometry(g,y=-.014){const src=g.index?g.toNonIndexed():g.clone(),a=src.attributes.position,v=[];
 for(let i=0;i<a.count;i+=3){const tri=[0,1,2].map(k=>new T.Vector3().fromBufferAttribute(a,i+k));for(const sign of [-1,1]){let poly=[];for(let k=0;k<3;k++){const A=tri[k],B=tri[(k+1)%3],aa=(A.y-y)*sign>=-1e-10,bb=(B.y-y)*sign>=-1e-10;if(aa)poly.push(A);if(aa!==bb)poly.push(A.clone().lerp(B,(y-A.y)/(B.y-A.y)));}for(let k=1;k<poly.length-1;k++)for(const p of [poly[0],poly[k],poly[k+1]])v.push(...p.toArray());}}
 const out=new T.BufferGeometry();out.setAttribute('position',new T.Float32BufferAttribute(v,3));out.computeVertexNormals();return out;
}
export function completePackaging21(k){
 const {root,bodies,parts,group,add,box,cyl,beam,material,pack,weigh,discharge,out,plantActors,mechanics}=k,start=parts.length;
 // Retain old IDs for historical records, never render the invalid 120 mm wrapper.
 const old=[];for(const p of parts){let b=p.body,inside=false;while(b){if(b===pack)inside=true;b=b.parent;}if(inside&&!/bare_receiving|wrapper_bare|wrapper_frame_rail|^leg_|^levelling_foot_|^foot_screw_/.test(p.name)){p.visible=false;p.role='superseded';old.push(p.index);}}
 for(const b of [weigh,discharge,out])b.position.add(localPoint(7,4.1,0));
 const frame=group('R21_packaging_expanded_line',root,'pack');frame.quaternion.copy(stationQ(7));
 const shuttles=[],units=[],mapped=[],bagMeshes=[],hotSlides=[];
 // Fixed narrow conveyor clears the unloader before spreading.
 for(let l=0;l<4;l++){const z=laneZ(l),a=2.585,b=3.73;
  box('R21_extension_top',frame,(a+b)/2,1.043,z,b-a,.002,.090,'belt');box('R21_extension_return',frame,(a+b)/2,1.019,z,b-a,.002,.090,'belt');
  for(const x of [a,b]){cyl('R21_extension_roller',frame,x,1.031,z,.011,.096,'steel',Z);for(const dz of [-.052,.052]){box('R21_extension_bearing',frame,x,1.031,z+dz,.024,.026,.010,'blue');box('R21_extension_bearing_post',frame,x,.98,z+dz,.018,.078,.010);}}
  box('R21_extension_spine',frame,(a+b)/2,.935,z,b-a,.035,.070);for(const x of [3.45,3.60]){box('R21_extension_leg',frame,x,.46,z,.030,.91,.030);cyl('R21_extension_foot',frame,x,.014,z,.035,.028,'dark');}
  cyl('R21_extension_motor',frame,b-.05,.974,z,.020,.064,'blue',Z);box('R21_extension_motor_seat',frame,b-.05,.949,z,.065,.010,.074);for(const [x,y]of [[b-.05,.974],[b,1.031]])cyl('R21_extension_pulley',frame,x,y,z+.055,.010,.005,'dark',Z);for(const dx of [-.009,.009])beam('R21_extension_timing_belt',frame,V(b-.05+dx,.974,z+.055),V(b+dx,1.031,z+.055),.002,.005,'belt');
 }
 // Parallel 600 mm centres leave 120 mm between 480 mm nominal unit frames.
 for(let l=0;l<4;l++){
  const unit=buildFilmUnit(),base=group('R21_wrapper_'+l,frame,'pack');base.position.set(3,0,(l-1.5)*.60);base.add(unit.root);
  // Separate powered hot heads retract from stationary film. Cold nip holds pitch.
  const fixed=unit.root.getObjectByName('fixed_packaging_frame');
  for(const sign of [-1,1]){
   const slide=new T.Group();slide.name='R21_hot_head_slide_'+l+'_'+sign;unit.root.add(slide);
   const wheel=unit.actors.finActors.find(a=>a.sign===sign&&a.g.name.startsWith('heated_fin_pair')).g;slide.attach(wheel);
   for(const mesh of unit.parts){if(mesh.parent===wheel&&/gear/.test(mesh.name))mesh.userData.omit21=true;
    if(mesh.parent===fixed&&Math.abs(mesh.position.x-2.82)<1e-7&&Math.sign(mesh.position.z)===sign&&/short_vertical_wheel_axle|wheel_bearing|heated_fin_pair_gearmotor|heated_fin_pair_coupling/.test(mesh.name))slide.attach(mesh);
    if(mesh.name==='heated_fin_pair_bearing_mount')mesh.userData.omit21=true;
   }
   const slideBody=group('R21_hot_slide_support_'+l+'_'+sign,base,'pack','hot-retract');
   box('R21_hot_slide_plate',slideBody,2.82,1.135,sign*.044,.070,.012,.068);
   // Each half has its own motor: no meshing gears are separated by retraction.
   if(sign>0){cyl('R21_hot_independent_motor',slideBody,2.82,1.258,.02503,.029,.10,'blue',Y);cyl('R21_hot_independent_coupling',slideBody,2.82,1.176,.02503,.006,.064,'steel',Y);}
   box('R21_hot_motor_base',slideBody,2.82,1.205,sign*.02503,.070,.006,.064);
   beam('R21_hot_motor_bracket',slideBody,V(2.79,1.141,sign*.06),V(2.79,1.202,sign*.06),.012,.012);
   for(const dx of [-.025,.025]){cyl('R21_hot_guide_rod',base,2.82+dx,1.15,sign*.10,.003,.16,'steel',Z);box('R21_hot_guide_end',base,2.82+dx,1.15,sign*.18,.012,.022,.018,'blue');box('R21_hot_slide_bushing',slideBody,2.82+dx,1.15,sign*.06,.012,.018,.028,'blue');}
   box('R21_hot_actuator_anchor',base,2.82,1.15,sign*.19,.075,.045,.018);
   cyl('R21_hot_spring_return_cylinder',base,2.82,1.15,sign*.145,.012,.065,'blue',Z);
   cyl('R21_hot_cylinder_rod',slideBody,2.82,1.15,sign*.080,.003,.070,'steel',Z);
   beam('R21_hot_fixed_seat',base,V(2.775,1.18,sign*.18),V(2.82,1.15,sign*.19),.012,.012);
   hotSlides.push({slide,slideBody,sign});
  }
  const cropSet=new Set();for(const a of unit.actors.crops)a.g.traverse(o=>cropSet.add(o));
  unit.root.traverse(o=>{if(!o.isMesh){o.userData={...o.userData,module:'pack',active:true};bodies.push(o);}});
  const map={web:'film',bag:'film',trace:'brass',white:'white',leaf:'leaf',steel:'steel',dark:'dark',belt:'belt',blue:'blue',hot:'hot'};
  for(const mesh of unit.parts){mesh.visible=false;if(cropSet.has(mesh)||mesh.userData.omit21)continue;mesh.updateMatrix();const p=add('R21_L'+l+'_'+mesh.name,mesh.parent,mesh.geometry,map[mesh.userData.material],V());p.local.copy(mesh.matrix);p.role=mesh.userData.role==='rigid'?'part':mesh.userData.role;p.note='R21独立包装单元；600mm列距。膜路、轴承和机架保留可检查的父装配关系；采购件内部及公差待定。';mapped.push({mesh,p});}
  units.push(unit);
 }
 for(const [kind,a,b]of [['in',3.76,4.73],['out',6.85,7.58]]){
  const f=group('R21_'+kind+'_shuttle_base',frame,'pack');
  for(const x of [a+.08,b-.08]){
   box('R21_transverse_rail_bed',f,x,.865,0,.065,.055,2.22);
   box('R21_linear_rail',f,x,.902,0,.018,.018,2.16,'dark');
   for(const z of [-1.08,1.08]){box('R21_shuttle_leg',f,x,.44,z,.05,.83,.05);cyl('R21_shuttle_foot',f,x,.014,z,.045,.028,'dark');cyl('R21_foot_adjuster',f,x,.05,z,.008,.05);}
  }
  for(const z of [-1.08,1.08])box('R21_shuttle_longitudinal_tie',f,(a+b)/2,.42,z,b-a,.045,.045);
  for(let l=0;l<4;l++){
   const s=group('R21_'+kind+'_belt_carrier_'+l,f,'pack','spread'),ax=a+.22+l*.14;
   box('R21_carrier_spine',s,(a+b)/2,.955,0,b-a,.025,.070);
   for(const x of [a+.08,b-.08]){box('R21_rail_carriage',s,x,.926,0,.036,.030,.090,'blue');box('R21_carriage_attachment',s,x,.947,0,.060,.012,.105);for(const dx of [-.020,.020])for(const z of [-.032,.032]){cyl('R21_carriage_M5_shank',s,x+dx,.941,z,.0025,.028);cyl('R21_carriage_M5_head',s,x+dx,.957,z,.0043,.005,'dark');}}
   box(kind==='in'?'R21_bare_receiving_belt_'+l+'_top':'R21_contract_belt_'+l+'_top',s,(a+b)/2,1.043,0,b-a,.002,.090,'belt');box('R21_carrier_belt_return',s,(a+b)/2,1.019,0,b-a,.002,.090,'belt');
   const rollers=[];for(const x of [a,b]){const rr=group('R21_carrier_roller',s,'pack','belt');rr.position.set(x,1.031,0);cyl('R21_carrier_end_roller',rr,0,0,0,.011,.096,'steel',Z);box('R21_carrier_roller_witness',rr,0,.0115,0,.004,.001,.094,'brass');rollers.push(rr);for(const z of [-.052,.052]){box('R21_carrier_bearing',s,x,1.031,z,.024,.026,.010,'blue');box('R21_carrier_bearing_post',s,x,.994,z,.018,.050,.010);}}
   // Motor below its own belt envelope; no side motor collides at 120 mm pitch.
   cyl('R21_carrier_belt_motor',s,b-.05,.974,0,.020,.064,'blue',Z);box('R21_carrier_motor_seat',s,b-.05,.949,0,.065,.010,.074);
   for(const [x,y]of [[b-.05,.974],[b,1.031]])cyl('R21_carrier_timing_pulley',s,x,y,.055,.010,.005,'dark',Z);
   for(const dx of [-.009,.009])beam('R21_carrier_timing_belt',s,V(b-.05+dx,.974,.055),V(b+dx,1.031,.055),.002,.005,'belt');
   // Dedicated screws are staggered longitudinally under the common rail bed.
   cyl('R21_spread_ball_screw',f,ax,.79,0,.006,2.14,'brass',Z);for(const z of [-1.08,1.08]){box('R21_screw_end_bearing',f,ax,.79,z,.035,.038,.030,'blue');beam('R21_screw_end_bracket',f,V(ax,.79,z),V(a+.08,.845,z),.020,.020);}
   cyl('R21_spread_servo',f,ax,.79,-1.18,.026,.12,'blue',Z);cyl('R21_spread_coupling',f,ax,.79,-1.105,.010,.03,'steel',Z);box('R21_servo_flange',f,ax,.79,-1.115,.070,.070,.010);
   beam('R21_servo_support',f,V(ax,.79,-1.115),V(a+.08,.845,-1.08),.025,.025);
   box('R21_moving_ballnut',s,ax,.79,0,.025,.027,.035,'blue');box('R21_ballnut_riser',s,ax,.866,0,.020,.125,.026);
   for(const z of [-.051,.051])box('R21_low_edge_guide',s,(a+b)/2,1.056,z,b-a-.04,.020,.003,'pad');
   // End switches and flag, needed to establish actual in-position permissions.
   for(const z of [laneZ(l),(l-1.5)*.60])box('R21_position_sensor',f,ax+.027,.82,z,.012,.020,.025,'dark');box('R21_position_flag',s,ax+.020,.82,0,.002,.028,.018);
   const links=[],cableX=ax+.045;
   box('R21_cable_chain_tray',f,cableX,.599,.05,.028,.012,2.30,'dark');
   for(const z of [-1.08,1.08]){beam('R21_chain_tray_bracket',f,V(a+.08,.70,z),V(cableX,.605,z),.012,.012);}
   box('R21_chain_fixed_anchor',f,cableX,.62,-1.05,.025,.025,.035,'blue');box('R21_chain_moving_anchor',s,cableX,.70,0,.025,.025,.035,'blue');beam('R21_chain_terminal_riser',s,V(cableX,.71,0),V(ax,.94,0),.012,.012);
   for(let j=0;j<48;j++){const link=group('R21_energy_chain_link_'+kind+'_'+l+'_'+j,f,'pack','cable-chain');box('R21_energy_chain_enclosure',link,0,0,0,.018,.012,2.4/48,'dark');cyl('R21_power_cable_segment',link,0,0,0,.003,2.4/48,'blue',Z);links.push(link);}
   shuttles.push({kind,l,g:s,rollers,links,cableX});
  }
 }
 // Small fixed bridge ends before the live weighing platform. No weighing shunt.
 for(let l=0;l<4;l++){const z=laneZ(l);box('R21_weigh_entry_bridge',frame,7.625,1.042,z,.090,.004,.090);box('R21_bridge_stem',frame,7.625,.985,z,.018,.11,.018);box('R21_bridge_floor_leg',frame,7.625,.44,z,.030,.87,.030);cyl('R21_bridge_foot',frame,7.625,.014,z,.035,.028,'dark');}
 // Two outboard fingers turn the front seal upward before the cassette takes load.
 // An overhead electric slide raises the fingers before the loaded cassette lifts.
 const tucker=group('R21_front_seal_tucker',frame,'pack','seal-tucker');
 for(const z of [-2.70,2.70]){box('R21_tucker_column',frame,8.40,1.12,z,.060,2.2,.060);cyl('R21_tucker_foot',frame,8.40,.02,z,.075,.035,'dark');beam('R21_tucker_portal_knee',frame,V(8.4,1.92,z),V(8.4,2.19,z-Math.sign(z)*.30),.035,.035);}
 for(const z of [-.40,.40]){box('R21_tucker_vertical_rail',frame,8.40,1.85,z,.016,.70,.020,'dark');box('R21_tucker_guide_block',tucker,8.40,1.52,z,.030,.060,.032,'blue');}
 box('R21_tucker_crosshead',tucker,8.40,1.52,0,.035,.025,.84);box('R21_tucker_top_bridge',frame,8.40,2.23,0,.080,.060,5.46);
 cyl('R21_tucker_lift_screw',frame,8.40,1.86,.37,.004,.68,'brass',Y);cyl('R21_tucker_servo',frame,8.40,2.30,.37,.022,.08,'blue',Y);box('R21_tucker_ballnut',tucker,8.40,1.52,.37,.025,.028,.025,'blue');
 for(let l=0;l<4;l++)for(const sign of [-1,1]){const z=laneZ(l)+sign*.040;box('R21_tucker_finger_hanger',tucker,8.405,1.30,z,.006,.43,.006);
  const path=u=>{const a=Math.PI/2*ramp(u,8.30,8.40);return V(u+.014+.016*Math.cos(a),1.0575+.016*Math.sin(a),z);};
  for(let i=0;i<16;i++)beam('R21_front_seal_forming_finger',tucker,path(8.30+i*.10/16),path(8.30+(i+1)*.10/16),.002,.004,'pad');
 }
 // Reuse the material-coordinate bag shape from the corrected single-lane unit.
 // Clip material coordinates at the fixed cut plane; never scale the completed bag.
 const template=units[0].actors.crops[0].g;template.updateMatrixWorld(true);const inv=template.matrixWorld.clone().invert(),rot=new T.Matrix4().makeRotationZ(-Math.PI/2),templates=[];
 template.traverse(mesh=>{if(!mesh.isMesh||mesh.userData.role!=='membrane')return;const geo=mesh.geometry.clone().applyMatrix4(rot.clone().multiply(inv).multiply(mesh.matrixWorld));templates.push({name:mesh.name,geo:mesh.name.startsWith('front')?creaseGeometry(geo):geo,mat:mesh.userData.material==='hot'?'hot':'film'});});
 for(const a of plantActors){const bg=group('R21_constant_material_bag_'+a.n+'_'+a.l,a.g,'product');for(const tmp of templates){const geo=tmp.geo.clone(),raw=Float32Array.from(geo.attributes.position.array),p=add('R21_'+tmp.name,bg,geo,tmp.mat);bagMeshes.push({a,bg,p,raw,geo,minY:Math.min(...raw.filter((_,i)=>i%3===1)),name:tmp.name});}}
 const record={id:'pack21',title:'R21 展距、自动包装与并距',module:'pack',support:'120mm窄距小车→双直线导轨/独立丝杠→地脚；600mm包装机架；成袋小车并回独立检重带',power:'四台包装独立定长驱动；八台横移伺服与八条输送带驱动；热轮独立电机＋弹簧复位气缸',transmission:'先横移定位再送料，产品尾端完全离开后空车返回；热轮停膜退让、冷轮夹膜、上下横封梁对合切袋',witness:['R21_L0_flat_web_reel_212mm','R21_spread_ball_screw','R21_weigh_entry_bridge'],limit:'名义运动与支承方案；本轮未完成整机实体干涉、公差、张力/叶片柔性、实膜与安全回路验收。',focus:{module:'pack',time:102,target:localPoint(7,5.82,1.10,-.9).toArray(),distance:2.3}};
 mechanics.records.push(record);const previousCategory=mechanics.category;mechanics.category=p=>p.index>=start&&p.module!=='product'?'pack21':previousCategory(p);
 return {units,shuttles,hotSlides,parts:parts.slice(start),record,update(t,halt=false){
   for(const u of units)u.update(t-16);
   const phase=((t-96)%8+8)%8,open=halt||t<96?1:ramp(phase,5.20,5.30)-ramp(phase,7.7,8);
   if(halt)for(const u of units){u.actors.upper.position.y=1.23;u.actors.lower.position.y=1.032;}
   for(const h of hotSlides){h.slide.position.z=h.sign*.006*open;h.slideBody.position.z=h.sign*.006*open;}
   for(const {mesh,p}of mapped){mesh.updateMatrix();p.local.copy(mesh.matrix);}
   for(const s of shuttles){const state=shuttleState(s.kind,s.l,t);s.g.position.z=state.z;
    const R=.04,L=2.4,za=-1.05,zb=state.z,zc=(L+za+zb-Math.PI*R)/2,d=zc-za;
    const point=x=>x<d?V(s.cableX,.62,za+x):x<d+Math.PI*R?V(s.cableX,.66-R*Math.cos((x-d)/R),zc+R*Math.sin((x-d)/R)):V(s.cableX,.70,zc-(x-d-Math.PI*R));
    s.links.forEach((g,i)=>{const x=(i+.5)/s.links.length*L;g.position.copy(point(x));g.quaternion.setFromUnitVectors(Z,point(Math.min(L,x+.0001)).sub(point(Math.max(0,x-.0001))).normalize());});
    for(const r of s.rollers)r.rotation.z=-state.fed/.011;}
   const tp=((t-120)%8+8)%8;tucker.position.y=.30*(1-ramp(tp,5.4,5.7)+ramp(tp,6.5,6.8));
   for(const b of bagMeshes){const age=t-b.a.n*8;b.bg.userData.active=age>=96;const end=b.name.startsWith('front')?101.9:b.name.startsWith('rear')?109.9:96;b.p.visible=age>=end;const st=age-96,u=5.32+.60*(Math.floor(Math.max(0,st)/8)+ramp(Math.max(0,st)%8,0,5.3));const cut=age>=112?Infinity:u-5.95,arr=b.geo.attributes.position.array;if(cut<b.minY)b.p.visible=false;for(let j=0;j<arr.length;j+=3){arr[j]=b.raw[j];arr[j+1]=Math.min(b.raw[j+1],cut);arr[j+2]=b.raw[j+2];if(b.name.startsWith('front')&&age>=125.4&&b.raw[j+1]<-.014){const u=8.28+.74*ramp(age,125.4,128),angle=Math.PI/2*ramp(u,8.30,8.40),dy=b.raw[j+1]+.014;arr[j]=b.raw[j]*Math.cos(angle)-dy*Math.sin(angle);arr[j+1]=-.014+b.raw[j]*Math.sin(angle)+dy*Math.cos(angle);}}b.geo.attributes.position.needsUpdate=true;b.geo.boundingBox=null;b.geo.boundingSphere=null;}
  },inspect(p){if(p.index<start)return null;return {record:'pack21',module:p.module,name:p.name,support:record.support,power:record.power,transmission:record.transmission,note:p.note||record.limit};}};
}
