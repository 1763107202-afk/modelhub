import * as T from 'three';
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z),X=V(1,0,0),Y=V(0,1,0),Z=V(0,0,1);
// Nominal assembly detail. No vendor rating, thread fit or structural acceptance
// is implied by a mesh, a connection record or its AABB adjacency check.
export function completeMechanicalDetails(k){
 const {parts,bodies,box,cyl,beam,add,transfers}=k,records=[],connections=[];
 const find=n=>{const b=bodies.find(b=>b.name===n);if(!b)throw Error('Missing body '+n);return b;};
 const part=(name,body)=>{const p=parts.find(p=>p.name===name&&(!body||p.body===body));if(!p)throw Error('Missing detail anchor '+name);return p;};
 const edit=(p,position,scale)=>{const a=V(),q=new T.Quaternion(),s=V();p.local.decompose(a,q,s);p.local.compose(position??a,q,scale??s);return p;};
 function blockBore(name,body,p,size,r,axis=X){
  const [sx,sy,sz]=size,depth=axis===X?sx:axis===Y?sy:sz,w=axis===X?sz:sx,h=axis===Y?sz:sy;
  const sh=new T.Shape();sh.moveTo(-w/2,-h/2);sh.lineTo(w/2,-h/2);sh.lineTo(w/2,h/2);sh.lineTo(-w/2,h/2);sh.closePath();
  const hole=new T.Path();hole.absarc(0,0,r,0,Math.PI*2,true);sh.holes.push(hole);
  const geo=new T.ExtrudeGeometry(sh,{depth,bevelEnabled:false,curveSegments:20}).translate(0,0,-depth/2);
  return add(name,body,geo,'blue',p,V(1,1,1),new T.Quaternion().setFromUnitVectors(Z,axis),'带实际通孔的名义支承块；轴承内圈、配合与预紧待选型');
 }
 const hex=new T.CylinderGeometry(1,1,1,6);
 function bolt(n,b,p,axis=Y){const a=cyl(n+'_shank',b,...p.toArray(),.0022,.014,'steel',axis);add(n+'_head',b,hex,'dark',p.clone().addScaledVector(axis,.008),V(.004,.004,.004),new T.Quaternion().setFromUnitVectors(Y,axis),'名义紧固件；孔距、扭矩和防松未定型');return a;}
 function link(d,a,b,kind='固定件名义接邻'){connections.push({detail:d.id,a:a.index,b:b.index,kind});}
 function detail(id,title,base,power,support,drive,build){const start=parts.length,d={id,title,base,power,support,drive,parts:[],witness:null,limit:'名义安装细节；接邻检查不等于承载接触、孔配合、制动或疲劳验证'};records.push(d);build(d);for(const p of parts.slice(start)){p.detail18=id;d.parts.push(p.index);}if(d.witness===null)d.witness=d.parts[0];return d;}
 // Five independent fixed-station drive-engagement axes. The nut, its bridge,
 // fixed/supported ends and the servo coupling were absent in the old detail.
 for(const j of [1,2,3,5,6]){
  const s=find('fixed_station_'+j),live=find('retractable_drive_'+j);
  detail('engage_'+j,'工位 '+j+' · 自转接合丝杠', 'process','电柜伺服驱动→接合电机；工位自转电机独立供电','接合螺母→连接耳→活动安装板；两端支承→上横梁→固定下吊柱→中心固定架','伺服→同轴联轴器→丝杠/螺母→径向接合；滑轨承担侧向载荷',d=>{
   const plate=part('drive_head_top_mount_'+j,live),column=part('drive_drop_column_'+j,s);
   const nut=blockBore('detail_engagement_ballnut',live,V(.925,1.14,.195),[.035,.030,.035],.0053);
   const ear=box('detail_engagement_nut_bridge',live,.925,1.16,.195,.030,.012,.094);
   for(const z of [.155,.235]){const leg=box('detail_engagement_nut_side_leg',live,.925,1.11125,z,.025,.0975,.014);link(d,ear,leg);link(d,leg,plate);}
   const bridge=beam('detail_engagement_fixed_bridge',s,V(.75,1.186,.195),V(1.045,1.186,.195),.024,.024);
   link(d,nut,ear,'螺母壳体→绕导轨的上置耳板');link(d,bridge,column);
   for(const [i,u]of [[0,.705],[1,1.045]]){
    const bearing=blockBore(i?'detail_engagement_supported_end':'detail_engagement_fixed_end',s,V(u,1.14,.195),[.022,.034,.034],.0055);
    const hanger=box('detail_engagement_bearing_hanger',s,u,1.166,.195,.022,.026,.028);
    const tie=beam('detail_engagement_bearing_top_tie',s,V(u,1.186,.195),V(.75,1.186,.195),.020,.020);
    link(d,bearing,hanger);link(d,hanger,tie);link(d,tie,column);
    bolt('detail_engagement_end_bolt',s,V(u,1.187,.195));
   }
   blockBore('detail_engagement_shaft_coupling',s,V(.675,1.14,.195),[.030,.025,.025],.0055);
   const shim=box('detail_engagement_motor_mount_shim',s,.60,1.095,.195,.10,.006,.10);
   link(d,shim,part('station_drive_motor_seat',s));
   for(const u of [.805,.925]){
    const mount=beam('detail_engagement_sensor_bracket',s,V(u,1.186,.195),V(u,1.202,.230),.012,.012);
    const sensor=box('detail_engagement_limit_sensor',s,u,1.209,.230,.022,.020,.018,'dark');
    link(d,mount,bridge);link(d,sensor,mount);
   }
   const flag=box('detail_engagement_limit_flag',live,.925,1.155,.230,.025,.055,.006,'brass');
   const flagArm=beam('detail_engagement_flag_root',live,V(.925,1.0775,.195),V(.925,1.0775,.230),.012,.012),flagStem=box('detail_engagement_flag_stem',live,.925,1.1145,.230,.012,.074,.006);link(d,flagStem,flagArm);link(d,flag,flagStem);link(d,flagArm,plate);
   d.witness=nut.index;
  });
 }
 // Radial stages sit ABOVE the head crossbars. In the previous arrangement
 // the live crossbar and fixed crossplate shared a plane; adding a simple ear
 // there would force a rigid link through the fixed plate or a guide rail.
 for(const j of [1,2]){
  const s=find('fixed_station_'+j),h=find('peel_scan_head_'+j),bank=find('peel_retractable_nozzle_bank_'+j);
  detail('peel_radial_'+j,'去皮 '+j+' · 上置径向滑台','process','径向伺服→联轴器；气路经拖链进入歧管','喷头横梁→抬高连接架→滑块/导轨→开口框→竖直滑块；螺母绕轨连接','径向导轨和丝杠分层；上部开口固定框给喷头横梁留出完整行程',d=>{
   for(const p of parts.filter(p=>p.body===s&&p.name==='station_ground_'+j+'_plate')){const a=V(),q=new T.Quaternion(),sz=V();p.local.decompose(a,q,sz);edit(p,a,V(.090,.020,.090));}
   const cross=part('peel_nozzle_bank_crosshead',bank);edit(cross,V(1.57,.12,0),V(.035,.050,.56));
   const fixed=part('peel_vertical_crossplate',h);edit(fixed,V(1.93,.43,0),V(.050,.035,.68));
   for(const p of parts.filter(p=>p.body===h&&p.name==='peel_radial_guide'))edit(p,V(1.73,.29,Math.sign(p.local.elements[14])*.30),V(.40,.020,.020));
   for(const p of parts.filter(p=>p.body===bank&&p.name==='peel_radial_carriage_block'))edit(p,V(1.64,.315,Math.sign(p.local.elements[14])*.30));
   for(const p of parts.filter(p=>p.body===h&&p.name==='peel_vertical_bearing_block')){
    const sign=Math.sign(p.local.elements[14]);p.visible=false;p.role='superseded';
    const guideBlock=blockBore('detail_peel_vertical_guide_block',h,V(1.58,.12,sign*.37),[.055,.080,.040],.0086,Y);
    const rise=beam('detail_peel_open_frame_riser',h,V(1.58,.12,sign*.37),V(1.58,.43,sign*.33),.024,.024);
    const rail=beam('detail_peel_open_frame_side',h,V(1.52,.43,sign*.33),V(1.93,.43,sign*.33),.024,.024);
    link(d,rise,guideBlock);link(d,rise,rail);link(d,rail,fixed);
    const front=box('detail_peel_front_rail_drop',h,1.53,.35,sign*.30,.025,.16,.025);
    const top=beam('detail_peel_front_rail_top',h,V(1.52,.43,sign*.33),V(1.53,.43,sign*.30),.024,.024);
    const rear=box('detail_peel_rear_rail_drop',h,1.93,.35,sign*.30,.025,.16,.025);
    link(d,front,top);link(d,top,rail);link(d,rear,fixed);
    const guide=parts.find(p=>p.body===h&&p.name==='peel_radial_guide'&&Math.sign(p.local.elements[14])===sign);link(d,front,guide);link(d,rear,guide);
    const tower=beam('detail_peel_carriage_tower',bank,V(1.57,.12,sign*.24),V(1.57,.35,sign*.24),.014,.014);
    const bridge=beam('detail_peel_carriage_bridge',bank,V(1.57,.35,sign*.24),V(1.64,.35,sign*.30),.014,.014);
    const drop=beam('detail_peel_carriage_drop',bank,V(1.64,.35,sign*.30),V(1.64,.315,sign*.30),.014,.014);
    const slider=parts.find(p=>p.body===bank&&p.name==='peel_radial_carriage_block'&&Math.sign(p.local.elements[14])===sign);
    link(d,tower,cross);link(d,bridge,tower);link(d,bridge,drop);link(d,drop,slider);
    bolt('detail_peel_carriage_bolt',bank,V(1.635,.327,sign*.30));
   }
   const nut=part('peel_radial_ballnut',bank);edit(nut,V(1.64,.40,-.30));
   const cap=box('detail_peel_nut_top_cap',bank,1.64,.420,-.27,.030,.012,.075);
   const ear=box('detail_peel_nut_connection_ear',bank,1.64,.385,-.24,.016,.070,.016);
   const lower=beam('detail_peel_nut_lower_arm',bank,V(1.64,.35,-.24),V(1.64,.35,-.30),.016,.016);link(d,cap,nut);link(d,ear,cap);link(d,ear,lower);link(d,lower,parts.find(p=>p.body===bank&&p.name==='detail_peel_carriage_drop'&&p.local.elements[14]<0));
   edit(part('peel_radial_ball_screw',h),V(1.74,.40,-.30),V(.006,.38,.006));
   const gm=find('peel_radial_servo_'+j);gm.position.set(1.46,.40,-.30);
   edit(part('peel_radial_motor_plate',h),V(1.49,.30,-.30));
   const motorFoot=box('detail_peel_radial_motor_foot',h,1.46,.3325,-.30,.080,.045,.080);link(d,motorFoot,part('peel_radial_motor_plate',h));link(d,motorFoot,part('peel_radial_servo_'+j+'_gearbox',gm));
   const motorSeat=beam('detail_peel_radial_motor_seat_link',h,V(1.52,.43,-.33),V(1.49,.30,-.30),.024,.024);link(d,motorSeat,part('peel_radial_motor_plate',h));
   link(d,motorSeat,parts.find(p=>p.name==='detail_peel_open_frame_side'&&p.body===h&&p.local.elements[14]<0));
   for(const b of bodies.filter(b=>b.parent===h&&b.name==='peel_radial_end_bearing')){
    const u=b.position.x<1.7?1.56:1.90;b.position.set(u,.40,-.30);
    const hanger=box('detail_peel_radial_bearing_hanger',h,u,.420,-.30,.028,.035,.028);
    const tie=beam('detail_peel_radial_bearing_top',h,V(u,.43,-.30),V(u<1.7?1.52:1.93,.43,-.33),.024,.024);
    link(d,hanger,part('peel_radial_end_bearing_mount',b));link(d,hanger,tie);link(d,tie,parts.find(p=>p.name==='detail_peel_open_frame_side'&&p.body===h&&p.local.elements[14]<0));
   }
   blockBore('detail_peel_radial_coupling',h,V(1.548,.40,-.30),[.030,.022,.022],.0065);
   const verticalNut=part('peel_vertical_ballnut',h),nutBridge=beam('detail_peel_vertical_nut_bridge',h,V(1.61,.12,.34),V(1.58,.12,.37),.018,.018);link(d,nutBridge,verticalNut);link(d,nutBridge,parts.find(p=>p.name==='detail_peel_vertical_guide_block'&&p.body===h&&p.local.elements[14]>0));
   d.witness=ear.index;
  });
  detail('peel_lift_'+j,'去皮 '+j+' · 竖直电机与固定端','process','竖直抱闸电机，经联轴器驱动扫描丝杠','电机法兰→带孔顶板→立柱；丝杠轴向反力经固定端回到立柱','修正电机输出轴朝下；贯通顶板让输出轴与丝杠同轴连接',d=>{
   const gauge=part('peel_pressure_gauge_'+j,s),regulator=part('peel_pressure_regulator_'+j,s);
   const gaugeStem=cyl('detail_pressure_gauge_stem',s,1.96,2.095,.15,.004,.040,'brass',Y);
   const columnCap=box('detail_peel_top_column_extension',s,1.64,1.80,.37,.035,.080,.035);
   link(d,gaugeStem,gauge);link(d,gaugeStem,regulator);link(d,columnCap,parts.find(p=>p.name==='peel_column_'+j&&p.body===s&&p.local.elements[14]>0));link(d,columnCap,part('peel_regulator_mount',s));link(d,columnCap,part('peel_hose_anchor_bracket',s));
   const gaugeInfo={support:'压力表壳→测压短接→减压阀块→安装斜撑→加长立柱→地脚',power:'被动气压测量；经减压阀测压口感压，无电机驱动',transmission:'阀块测压口→短接→压力表；表内测量机构未展开'};
   gauge.detail18=d.id;gauge.detail18Info=gaugeInfo;gaugeStem.detail18Info=gaugeInfo;
   const gm=find('peel_scan_servo_'+j);gm.quaternion.setFromUnitVectors(Z,V(0,-1,0));
   const old=part('peel_motor_top_plate',s);old.visible=false;old.role='superseded';
   const mount=blockBore('detail_peel_lift_bored_motor_plate',s,V(1.61,1.745,.34),[.16,.020,.16],.016,Y);
   const oldLeg=part('peel_motor_plate_leg',s);oldLeg.visible=false;oldLeg.role='superseded';
   const seat=beam('detail_peel_lift_top_seat',s,V(1.64,1.74,.37),V(1.66,1.745,.37),.028,.028);
   link(d,mount,seat);link(d,seat,parts.find(p=>p.name==='peel_column_'+j&&p.body===s&&p.local.elements[14]>0));
   const flange=blockBore('detail_peel_lift_motor_flange',s,V(1.61,1.76125,.34),[.10,.0125,.10],.016,Y);link(d,flange,mount);link(d,flange,part('peel_scan_servo_'+j+'_gearbox',gm));
   blockBore('detail_peel_lift_shaft_coupling',s,V(1.61,1.744,.34),[.026,.040,.026],.007,Y);
   const brake=part('peel_scan_motor_brake',s);brake.visible=false;brake.role='superseded';
   for(const dx of [-.035,.035])for(const dz of [-.035,.035])bolt('detail_peel_lift_flange_bolt',s,V(1.61+dx,1.754,.34+dz));
   d.witness=flange.index;d.limit+='；抱闸仅为电机集成设计要求，尚无选定电机保持转矩或停电验收';
  });
 }
 for(const j of [5,6]){
  const s=find('fixed_station_'+j),bank=find('retractable_airknife_bank_'+j);
  detail('airknife_'+j,'风刀 '+j+' · 上置滑台与风箱连接','process','退让伺服→丝杠；风源为独立过滤鼓风机','风箱加强立耳→高位滑块/导轨→开口固定框→原落地立柱','导轨在1.78m、丝杠在1.90m；螺母从内侧绕过导轨接回风箱',d=>{
   const plenum=part('airknife_plenum_'+j,bank);
   const rear=box('detail_airknife_rear_frame',s,1.94,2.00,0,.030,.030,.68);
   for(const sign of [-1,1]){
    const cap=box('detail_airknife_column_extension',s,1.72,1.89,sign*.37,.035,.13,.035);
    const rail=beam('detail_airknife_fixed_side',s,V(1.52,1.95,sign*.33),V(1.94,1.95,sign*.33),.024,.024);
    const capLink=beam('detail_airknife_column_top_link',s,V(1.72,1.95,sign*.37),V(1.72,1.95,sign*.33),.024,.024);
    link(d,cap,parts.find(p=>p.name==='airknife_post'&&p.body===s&&Math.sign(p.local.elements[14])===sign));link(d,cap,capLink);link(d,capLink,rail);const rearRise=beam('detail_airknife_rear_frame_riser',s,V(1.94,1.95,sign*.33),V(1.94,2.00,sign*.33),.024,.024);link(d,rail,rearRise);link(d,rearRise,rear);
    const fixedGuide=parts.find(p=>p.name==='airknife_radial_guide'&&p.body===s&&Math.sign(p.local.elements[14])===sign);edit(fixedGuide,V(1.73,1.78,sign*.30),V(.40,.025,.025));
    for(const u of [1.53,1.93]){const drop=box('detail_airknife_guide_end_drop',s,u,1.865,sign*.30,.025,.17,.025);const tie=beam('detail_airknife_guide_end_top',s,V(u,1.95,sign*.30),V(u,1.95,sign*.33),.024,.024);link(d,drop,fixedGuide);link(d,drop,tie);link(d,tie,rail);}
    const slider=parts.find(p=>p.body===bank&&p.name==='airknife_linear_block'&&Math.sign(p.local.elements[14])===sign);edit(slider,V(1.64,1.805,sign*.30));
    const tower=beam('detail_airknife_carriage_tower',bank,V(1.60,1.64,sign*.24),V(1.60,1.84,sign*.24),.018,.018);
    const bridge=beam('detail_airknife_carriage_bridge',bank,V(1.60,1.84,sign*.24),V(1.64,1.84,sign*.30),.014,.014);
    const drop=beam('detail_airknife_carriage_drop',bank,V(1.64,1.84,sign*.30),V(1.64,1.805,sign*.30),.014,.014);
    link(d,tower,plenum);link(d,tower,bridge);link(d,bridge,drop);link(d,drop,slider);bolt('detail_airknife_bridge_bolt',bank,V(1.635,1.820,sign*.30));
   }
   const nut=part('airknife_retract_ballnut',bank);edit(nut,V(1.64,1.90,-.30));
   const cap=box('detail_airknife_nut_top_cap',bank,1.64,1.9225,-.27,.030,.012,.075),ear=box('detail_airknife_nut_connection_ear',bank,1.64,1.88125,-.24,.020,.0825,.020);
   const lower=beam('detail_airknife_nut_lower_arm',bank,V(1.64,1.84,-.24),V(1.64,1.84,-.30),.020,.020);link(d,cap,nut);link(d,ear,cap);link(d,ear,lower);link(d,lower,parts.find(p=>p.body===bank&&p.name==='detail_airknife_carriage_drop'&&p.local.elements[14]<0));
   edit(part('airknife_retract_screw_'+j,s),V(1.72,1.90,-.30));const gm=find('airknife_retract_servo_'+j);gm.position.set(1.48,1.90,-.30);
   const motor=part('airknife_motor_plate',s);edit(motor,V(1.49,1.844,-.30));
   const seat=beam('detail_airknife_motor_seat_link',s,V(1.52,1.95,-.33),V(1.49,1.844,-.30),.024,.024);link(d,seat,motor);link(d,seat,parts.find(p=>p.name==='detail_airknife_fixed_side'&&p.body===s&&p.local.elements[14]<0));
   for(const b of bodies.filter(b=>b.parent===s&&b.name==='airknife_screw_end')){const u=b.position.x;b.position.set(u,1.90,-.30);const hanger=box('detail_airknife_screw_bearing_seat',s,u,1.923,-.30,.028,.035,.028),tie=beam('detail_airknife_screw_bearing_top',s,V(u,1.95,-.30),V(u<1.7?1.52:1.94,1.95,-.33),.024,.024);link(d,hanger,part('airknife_screw_end_mount',b));link(d,hanger,tie);link(d,tie,parts.find(p=>p.name==='detail_airknife_fixed_side'&&p.body===s&&p.local.elements[14]<0));}
   blockBore('detail_airknife_drive_coupling',s,V(1.538,1.90,-.30),[.025,.022,.022],.0065);d.witness=ear.index;
  });
 }
 for(const {kind,cage}of transfers){
  detail('grip_'+kind,(kind==='load'?'上料':'卸料')+' · 夹爪电机与轴承安装','transfer','夹爪电机→联轴器；上下输出经同步带分配','电机法兰→背部连接板→笼背架；输出轴由独立有孔支座支承','电机→同步带/上下轴→反向齿条→两半笼；根端托叉承担竖直重量',d=>{
   const anchor=kind==='load'?parts.find(p=>p.body===cage&&p.name==='load_slotted_backing_strip'&&Math.abs(p.local.elements[14])<1e-8):part('unload_backing_frame',cage);
   const plate=box('detail_grip_motor_backplate',cage,.292,.16,0,.014,.18,.035);
   const flange=blockBore('detail_grip_motor_flange',cage,V(.306,.16,0),[.014,.10,.074],.014,X);
   link(d,plate,anchor);link(d,flange,plate);
   for(const y of [.13,.19])for(const z of [-.012,.012])bolt('detail_grip_motor_flange_bolt',cage,V(.302,y,z),X);
   for(const y of [.09,.25]){
    const bearing=blockBore('detail_grip_output_bearing',cage,V(.285,y,0),[.016,.025,.025],.0055,X);
    const bracket=box('detail_grip_bearing_bracket',cage,.292,y,0,.018,.030,.035);link(d,bearing,bracket);link(d,bracket,plate);
   }
   d.witness=flange.index;
  });
 }
 const byId=new Map(records.map(r=>[r.id,r]));
 return {records,connections,inspect(p){const d=byId.get(p.detail18);return d?{support:d.support,power:d.power,transmission:d.drive,note:d.limit,record:d.base,detail_id:d.id,...p.detail18Info}:null;}};
}
