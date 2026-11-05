import {completeAdaptive25} from './mechanical-adaptive25.js';
import * as T from 'three';
import {C,laneZ,stationQ,localPoint,rotorAngle,cradleMotion,productPose,rackPose,ramp,mix,clamp,magazineSide,cutAge,collectionLift,pusherState} from './flow14.js';
import {P,rearRollX,cropSpin,carrierSpin,headState,jetPose} from './process15.js';
import {completeMechanics} from './mechanics17.js';
import {completeMechanicalDetails} from './mechanical-details18.js';
import {completeHardware} from './mechanical-hardware19.js';
import {completeCAD23} from './mechanical-cad23.js';
import {completeRefine23} from './mechanical-refine23.js';
import {completeAxes22} from './mechanical-axes22.js';
import {completePackaging21} from './packaging21.js';
import {completeDrive20} from './mechanical-drive20.js';

// SI units. Parts keep an explicit local matrix and a grounded parent body.
// Instancing is a renderer optimisation, not a replacement for part records.
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z),Q=(axis,a)=>new T.Quaternion().setFromAxisAngle(axis,a);
const X=V(1,0,0),Y=V(0,1,0),Z=V(0,0,1);
export function buildMachine({transferStroke=.020}={}){
 if(!Number.isFinite(transferStroke)||transferStroke<0||transferStroke>.022)throw Error('Transfer command exceeds 22mm stop');
 const root=new T.Group();root.name='assembly14';
 const bodies=[],parts=[],joints=[],geoCache=new Map(),material={};
 const colors={steel:'#b9c7ce',dark:'#3e555f',blue:'#3b6b8a',belt:'#243c40',green:'#176a50',pad:'#cabf87',brass:'#c49440',air:'#45a4cf',water:'#4c7db8',drain:'#788b95',paper:'#d3bd8a',white:'#ecf0d3',leaf:'#43843d',leaf2:'#75a748',film:'#c6e5eb',hot:'#e39b47',guard:'#acc6c5',red:'#ac6850'};
 for(const [k,c] of Object.entries(colors))material[k]=new T.MeshStandardMaterial({color:c,metalness:['steel','dark','brass'].includes(k)?.72:.12,roughness:k==='steel'?.3:.67,transparent:k==='film'||k==='guard',opacity:k==='film'?.24:k==='guard'?.14:1,depthWrite:!['film','guard'].includes(k),side:T.DoubleSide});
 const group=(name,parent=root,module='frame',motion='fixed')=>{const g=new T.Group();g.name=name;g.userData={module,motion,active:true};parent.add(g);bodies.push(g);return g;};
 const geometry=(key,fn)=>{if(!geoCache.has(key))geoCache.set(key,fn());return geoCache.get(key);};
 const boxGeo=geometry('box',()=>new T.BoxGeometry(1,1,1));
 const cylinderGeo=geometry('cylinder',()=>new T.CylinderGeometry(1,1,1,18));
 const ballGeo=geometry('ball',()=>new T.SphereGeometry(1,10,8));
 const add=(name,body,geo,mat,pos=V(),scale=V(1,1,1),quat=new T.Quaternion(),note='',role='part',show=null)=>{const p={name,body,geometry:geo,mat,local:new T.Matrix4().compose(pos,quat,scale),module:body.userData.module,support:body.name,note,role,show,index:parts.length};parts.push(p);return p;};
 const box=(n,b,x,y,z,sx,sy,sz,m='steel',note='',q)=>add(n,b,boxGeo,m,V(x,y,z),V(sx,sy,sz),q,note);
 const cyl=(n,b,x,y,z,r,h,m='steel',axis=Y,note='')=>add(n,b,cylinderGeo,m,V(x,y,z),V(r,h,r),new T.Quaternion().setFromUnitVectors(Y,axis),note);
 const ball=(n,b,p,r,m='steel')=>add(n,b,ballGeo,m,p,V(r,r,r));
 function beam(n,b,a,c,w=.04,h=w,m='steel',note=''){const d=c.clone().sub(a);return add(n,b,boxGeo,m,a.clone().add(c).multiplyScalar(.5),V(w,d.length(),h),new T.Quaternion().setFromUnitVectors(Y,d.normalize()),note);}
 const pipe=(n,b,points,r=.012,m='air',note='固定管卡→支架→机架')=>{for(let i=1;i<points.length;i++){const a=points[i-1],c=points[i],d=c.clone().sub(a);cyl(n+'_'+i,b,...a.clone().add(c).multiplyScalar(.5).toArray(),r,d.length(),m,d.normalize(),note);ball(n+'_elbow_'+i,b,c,r*1.1,m);}};
 const torus=(n,b,x,y,z,R,r,m='steel',arc=Math.PI*2,rotation=new T.Quaternion())=>{const g=geometry('torus'+R+':'+r+':'+arc,()=>new T.TorusGeometry(R,r,6,44,arc));return add(n,b,g,m,V(x,y,z),V(1,1,1),rotation);};
 const annulus=(n,b,rin,rout,y,h,m='steel')=>{const key=`annulus${rin}:${rout}:${h}`,g=geometry(key,()=>{const s=new T.Shape();s.absarc(0,0,rout,0,Math.PI*2);const hole=new T.Path();hole.absarc(0,0,rin,0,Math.PI*2,true);s.holes.push(hole);return new T.ExtrudeGeometry(s,{depth:h,bevelEnabled:false,curveSegments:72}).rotateX(-Math.PI/2);});return add(n,b,g,m,V(0,y-h/2,0));};
 const legs=(b,coords,top=.90)=>coords.forEach(([x,z],i)=>{box('leg_'+i,b,x,top/2,z,.055,top,.055,'steel','立柱→地脚→地面');cyl('levelling_foot_'+i,b,x,.035,z,.05,.025,'dark');cyl('foot_screw_'+i,b,x,.075,z,.012,.07,'steel');});
 const motor=(n,b,x,y,z,axis=Z)=>{const g=group(n,b,b.userData.module,b.userData.motion);g.position.set(x,y,z);g.quaternion.setFromUnitVectors(Z,axis);box(n+'_gearbox',g,0,0,0,.09,.09,.085,'blue','减速箱法兰→电机支座');cyl(n+'_case',g,0,0,-.085,.042,.11,'dark',Z);cyl(n+'_shaft',g,0,0,.065,.009,.045,'steel',Z);for(let i=0;i<3;i++)torus(n+'_fin_'+i,g,0,0,-.06-i*.026,.043,.003,'steel');return g;};
 const bearing=(n,b,x,y,z,axis=Z,r=.016)=>{const g=group(n,b,b.userData.module,b.userData.motion);g.position.set(x,y,z);g.quaternion.setFromUnitVectors(Z,axis);box(n+'_mount',g,0,-r*.8,0,r*3,r*2.7,r*1.3,'blue','轴承座→横梁');torus(n+'_race',g,0,0,0,r,.004,'steel');return g;};
 function belt(n,b,a,c,y,width=.092,v=0,{r=.035,frame=true,drive=true,common=false}={}){
  const len=c-a;box(n+'_top',b,(a+c)/2,y,v,len,.006,width,'belt','皮带→端辊→轴承座→横梁');box(n+'_return',b,(a+c)/2,y-2*r,v,len,.004,width,'belt');
  for(const [k,u] of [[0,a],[1,c]]){cyl(n+'_roller_'+k,b,u,y-r,v,r,width+.008,'steel',Z);if(!common)for(const s of [-1,1])bearing(n+'_bearing_'+k+'_'+s,b,u,y-r,v+s*(width/2+.025),Z,.010);}
  if(frame){for(const s of [-1,1])box(n+'_side_'+s,b,(a+c)/2,y-.04,v+s*(width/2+.038),len+.08,.065,.015,'steel');}
  if(drive)motor(n+'_drive',b,c,y-r,v+width/2+.11,Z);
 }
 const frame=group('grounded_welded_frame');legs(frame,[[-.75,-.75],[.75,-.75],[-.75,.75],[.75,.75]],.78);
 for(const z of [-.75,.75])box('base_rail',frame,0,.30,z,1.65,.06,.06);for(const x of [-.75,.75])box('base_cross',frame,x,.30,0,.06,.06,1.5);
 for(const z of [-.75,.75])beam('base_diagonal',frame,V(-.72,.17,z),V(.72,.72,z),.03,.03,'dark');
 cyl('fixed_central_mast',frame,0,.98,0,.10,1.96,'dark',Y,'空心转子中心留孔；立柱固定到底架');box('mast_head',frame,0,1.98,0,.28,.07,.28);
 annulus('slew_fixed_race',frame,.16,.34,.79,.055,'dark');annulus('slew_rolling_race',frame,.16,.33,.831,.025);
 const rotor=group('rotary_12_station_body',root,'rotary','rotor');annulus('rotor_hub_hollow',rotor,.145,.37,.86,.035);annulus('ring_inner',rotor,1.015,1.055,.91,.025);annulus('ring_outer',rotor,1.385,1.42,.91,.025);annulus('running_track',rotor,1.27,1.31,.885,.027,'dark');annulus('ring_gear',rotor,.37,.405,.85,.026,'brass');
 for(let k=0;k<96;k++){const a=k*Math.PI/48;box('gear_tooth_'+k,rotor,.411*Math.cos(a),.85,.411*Math.sin(a),.025,.026,.014,'brass','环齿轮→中心法兰',Q(Y,-a));}
 motor('rotor_servo_gearbox',frame,.47,.72,0,Y);cyl('rotor_pinion',frame,.47,.85,0,.054,.028,'brass');
 for(let k=0;k<6;k++){const a=k*Math.PI/3;beam('track_wheel_pedestal_'+k,frame,V(1.29*Math.cos(a),.10,1.29*Math.sin(a)),V(1.29*Math.cos(a),.81,1.29*Math.sin(a)),.05);cyl('radial_track_wheel_'+k,frame,1.29*Math.cos(a),.812,1.29*Math.sin(a),.06,.035,'pad',V(Math.cos(a),0,Math.sin(a)));}
 // Open, sloping catch pan with an actual gravity outlet, not a solid disk across the mast.
 const pan=group('gravity_pan_and_filter',root,'wash');const panShape=geometry('pan',()=>{const s=new T.Shape();s.absarc(0,0,1.51,0,Math.PI*2);const h=new T.Path();h.absarc(0,0,.73,0,Math.PI*2,true);s.holes.push(h);return new T.ShapeGeometry(s,72).rotateX(-Math.PI/2);});add('annular_drain_pan',pan,panShape,'steel',V(0,.64,0),V(1,1,1),Q(Z,.018));torus('pan_outer_upstand',pan,0,.666,0,1.51,.023,'steel',Math.PI*2,Q(X,Math.PI/2));
 for(let j=0;j<4;j++){const a=j*Math.PI/2;beam('pan_bracket_'+j,pan,V(.77*Math.cos(a),.38,.77*Math.sin(a)),V(1.45*Math.cos(a),.63,1.45*Math.sin(a)),.025);}
 pipe('gravity_drain',pan,[V(1.48,.62,0),V(1.64,.48,0),V(1.64,.18,.5)],.035,'drain');box('removable_skin_filter',pan,1.64,.18,.55,.26,.25,.28,'dark','滤篮→地面支架；排污接口在滤篮底部');pipe('waste_outlet',pan,[V(1.64,.08,.55),V(1.64,.06,.9)],.025,'drain');
 const keepers=[],rolls=[],lineShafts=[],driveWheels=[],rootX=C.radius+rearRollX,lineX=rootX-.024;
 for(let i=0;i<12;i++){
  const cell=group('rotary_carrier_'+i,rotor,'rotary','rotor');cell.quaternion.copy(stationQ(-i));
  box('spoke_'+i,cell,.79,.906,0,.88,.028,.06,'steel','中心轮毂→辐条→环梁');
  box('four_cell_crossbeam_'+i,cell,C.radius,.932,0,.14,.045,.56,'steel','转子环梁→四联托座；给横轴和接触轮留出真实空间');
  for(let l=0;l<4;l++){
   const z=laneZ(l),post=C.radius-.070;box('carrier_spine_'+i+'_'+l,cell,post,1.295,z,.018,.55,.028,'steel','下横梁→立柱→上下滚轮');
   box('spine_lower_extension',cell,post,.984,z,.018,.064,.028);for(const dz of [-.010,.010]){box('root_support_comb_'+i+'_'+l+'_'+dz,cell,C.radius,1.036,z+dz,.070,.008,.008,'pad','可更换低摩擦根托条承重；中间留托叉通道');box('root_comb_stanchion',cell,C.radius+.028,.986,z+dz,.012,.092,.008);}
   for(const s of [-1,1]){const r=group('rear_roller_rotor_'+i+'_'+l+'_'+s,cell,'rotary','roll_'+i+'_'+l+'_'+s);r.position.set(rootX,0,z+s*P.rearHalfSpacing);rolls.push({g:r,i,ratio:-P.stemRadius/P.rearRollRadius});for(const yy of [1.15,1.41]){cyl('rear_food_roller_'+i+'_'+l+'_'+yy+'_'+s,r,0,yy,0,P.rearRollRadius,.054,'pad');const mark=box('rear_roller_rotation_mark',r,.0215,yy,0,.002,.048,.003,'dark');mark.role='overlay';cyl('rear_roller_pin',r,0,yy,0,.004,.075);box('rear_roller_mount',cell,post+.020,yy+.040,z+s*.026,.080,.012,.012);}cyl('rear_full_axle',r,0,1.23,0,.005,.53);if(s<0)cyl('roller_worm_wheel',r,0,.995,0,.018,.012,'brass');torus('lower_sync_pulley',r,0,1.01,0,.015,.003,'dark',Math.PI*2,Q(X,Math.PI/2));}
   const gate=group('sliding_front_keeper_'+i+'_'+l,cell,'rotary','gate_'+i+'_'+l);gate.position.set(C.radius,0,z);keepers.push({g:gate,i,l});
   for(const yy of [1.15,1.41]){const follower=group('front_sprung_follower_'+i+'_'+l+'_'+yy,gate,'rotary','front_roll_'+i+'_'+l);follower.position.set(.025,yy,0);rolls.push({g:follower,i,ratio:-P.stemRadius/P.frontRollRadius});cyl('front_food_roller_'+i+'_'+l+'_'+yy,follower,0,0,0,.011,.050,'pad');cyl('front_pin',follower,0,0,0,.0035,.070);const mark=box('follower_rotation_mark',follower,.0115,0,0,.002,.04,.003,'dark');mark.role='overlay';box('front_radial_spring_slide',gate,.044,yy+.041,0,.048,.012,.022,'blue','径向浮动从动轮，螺钉调预压；湿态摩擦和压伤阈值待测');for(let k=0;k<5;k++)torus('follower_preload_spring',gate,.052+k*.004,yy+.041,0,.006,.001,'brass',Math.PI*2,Q(Y,Math.PI/2));}cyl('follower_encoder_stub',gate,.025,1.450,0,.0035,.018,'steel');box('follower_encoder',gate,.025,1.464,0,.023,.018,.026,'blue','从动轮测转；转速偏差联锁，不能只看电机指令');
   const dir=l<2?1:-1,levels=l%2?[1.10,1.20,1.36,1.46]:[1.115,1.185,1.375,1.445];
   for(let k=0;k<4;k++){const yy=levels[k],back=l%2?-.14:-.10;beam('keeper_C_arm_'+i+'_'+l+'_'+k,gate,V(back,yy,dir*.05),V(.046,yy,dir*.05),.009,.009);beam('keeper_front_link',gate,V(.046,yy,dir*.05),V(.046,yy,0),.009,.009);}
   box('keeper_linear_guide_'+i+'_'+l,cell,C.radius-.10,1.26,z,.028,.04,.105,'dark','直线轴承→背柱；前笼沿切向让开');box('keeper_latch_'+i+'_'+l,gate,-.10,1.30,dir*.04,.025,.035,.025,'brass','机械过中心锁；闭合位置需双通道确认');
   for(const s of [-1,1])box('paired_roller_sync_belt',cell,rootX+s*.015,1.01,z,.003,.005,.052,'belt','主动滚轮轴→闭合齿形带→第二滚轮轴');
  }
  const shaft=group('carrier_input_shaft_'+i,cell,'rotary','line_'+i);shaft.position.set(lineX,.995,0);lineShafts.push({g:shaft,i});cyl('four_cell_line_shaft_'+i,shaft,0,0,0,.006,.60,'steel',Z);for(let l=0;l<4;l++)cyl('worm_input_'+i+'_'+l,shaft,0,0,laneZ(l)-.026,.008,.026,'brass',Z);cyl('pickup_drive_wheel_'+i,shaft,0,0,.265,.034,.018,'pad',Z);const pm=box('pickup_rotation_spoke',shaft,0,0,.276,.058,.003,.002,'dark');pm.role='overlay';for(const v of [-.285,.285]){bearing('line_shaft_support_'+i,cell,lineX,.995,v,Z,.012);box('line_shaft_pedestal',cell,lineX,.962,v,.036,.020,.035);}
 }
 // Input conveyor uses an explicit oriented-carrier interface. No invisible loose-pile sorting.
 const input=group('four_lane_conveyor_infeed',root,'infeed');input.quaternion.copy(stationQ(0));legs(input,[[2.32,-.39],[2.32,.39],[3.6,-.39],[3.6,.39],[4.9,-.39],[4.9,.39]],.93);
 for(const z of [-.39,.39])box('input_longitudinal_rail',input,3.65,.89,z,3.05,.06,.05);
 for(let l=0;l<4;l++){
  const v=laneZ(l);for(const [k,a,b]of [[0,2.65,2.76],[1,2.84,3.29],[2,3.37,5.15]])belt('raw_infeed_'+l+'_'+k,input,a,b,1.043,.087,v,{drive:false,common:true});
  for(const [a,b] of [[2.65,2.77],[2.83,3.30],[3.36,5.15]])for(const s of [-1,1])box('input_low_sideguide',input,(a+b)/2,1.056,v+s*.048,b-a,.028,.008,'pad','低侧导向为两处锯片留通槽');
 }
 // Individually supported pickup rollers. Longitudinal lower shafts and bevel
 // drives leave open vertical slots for the interleaved lift-cage comb.
 for(let l=0;l<4;l++){const z=laneZ(l);cyl('pickup_longitudinal_drive',input,2.35,.60,z,.004,.56,'steel',X);for(const u of [2.095,2.20,2.40,2.45,2.50,2.57,2.60]){cyl('pickup_food_roller',input,u,1.032,z,.014,.020,'pad',Z);cyl('pickup_stub_axle',input,u,1.032,z,.003,.030,'steel',Z);box('pickup_roller_bevelbox',input,u,1.008,z,.018,.020,.018,'blue');cyl('pickup_vertical_drive',input,u,.804,z,.003,.39,'steel');box('pickup_lower_bevelbox',input,u,.60,z,.018,.018,.018,'blue');box('pickup_internal_post',input,u,.80,z+Math.sign(z)*.012,.008,.40,.005,'steel');}for(const u of [2.095,2.60])box('pickup_lower_bearing_block',input,u,.60,z,.020,.025,.025,'blue');}
 cyl('pickup_lower_common_input',input,2.60,.60,0,.006,.90,'steel',Z);motor('pickup_lower_gearmotor',input,2.60,.60,.53,V(0,0,-1));for(const z of [-.35,.35]){box('pickup_lower_support',input,2.38,.565,z,.61,.04,.035);box('pickup_support_leg',input,2.38,.28,z,.035,.56,.035);}
 const upperPinch=group('input_hold_down_belts',input,'infeed','pinch');for(let l=0;l<4;l++)for(const [k,a,b]of [[0,2.65,2.75],[1,2.86,3.27],[2,3.39,5.15]])belt('upper_pinch_'+l+'_'+k,upperPinch,a,b,1.126,.072,laneZ(l),{r:.025,frame:true,drive:false,common:true});
 for(const u of [3.04,4.20,5.35]){for(const z of [-.40,.40])box('pinch_support_column',input,u,1.22,z,.026,.46,.026);box('pinch_bridge',input,u,1.45,0,.04,.035,.84);}
 const commonConveyorDrive=(n,b,a,c,y,r)=>{for(const u of [a,c]){cyl(n+'_common_shaft',b,u,y-r,0,.006,1.04,'steel',Z);for(const z of [-.35,.52])bearing(n+'_end_bearing',b,u,y-r,z,Z,.013);}motor(n+'_common_drive',b,c,y-r,.64,V(0,0,-1));box(n+'_drive_support',b,c,y-r-.064,.56,.14,.025,.31,'steel','共轴驱动四条带；电机位于通道外');};
 for(const [k,a,b]of [[0,2.65,2.76],[1,2.84,3.29],[2,3.37,5.15]])commonConveyorDrive('input_section_'+k,input,a,b,1.043,k===3?.025:.035);
 for(const [k,a,b]of [[0,2.65,2.75],[1,2.86,3.27],[2,3.39,5.15]])commonConveyorDrive('pinch_section_'+k,upperPinch,a,b,1.126,.025);
 const cut=group('trim_gantry',input,'trim');
 const sawGroups=[];for(const [k,u] of [[0,2.80],[1,3.33]]){
  for(const z of [-.49,.49])box('saw_post_'+k,cut,u,1.19,z,.045,.56,.045);box('saw_bridge_'+k,cut,u,1.48,0,.065,.06,1.04);
  for(const yy of [1.43,1.47])cyl('cross_rail_'+k,cut,u,yy,0,.008,.92,'steel',Z);cyl('cross_ball_screw_'+k,cut,u+.055,1.455,0,.006,.94,'brass',Z);motor('saw_cross_servo_'+k,cut,u+.055,1.455,.58,V(0,0,-1));
  const g=group('saw_traverse_'+k,cut,'trim','cut_'+k);sawGroups.push(g);g.position.set(u,0,-.39);
  box('saw_linear_carriage_'+k,g,0,1.455,0,.085,.08,.07,'blue','双导杆滑块→固定桥');box('saw_drop_'+k,g,0,1.31,0,.028,.26,.035);motor('saw_spindle_motor_'+k,g,.16,1.38,0,V(-1,0,0));box('saw_motor_bracket',g,.12,1.438,0,.20,.025,.08);cyl('saw_motor_extension',g,.10,1.38,0,.006,.12,'steel',X);cyl('saw_spindle',g,.025,1.17,0,.006,.115,'steel',X);bearing('saw_spindle_bearing',g,.035,1.17,0,X,.012);for(const y of [1.17,1.38])cyl('saw_timing_pulley',g,.065,y,0,.022,.014,'dark',X);for(const z of [-.022,.022])box('saw_vertical_timing_belt',g,.065,1.275,z,.014,.21,.003,'belt','电机→两带轮/同步带→高于葱体的刀轴');
  const blade=geometry('blade',()=>new T.CylinderGeometry(.135,.135,.002,48));add('trim_disk_'+k,g,blade,'steel',V(0,1.17,0),V(1,1,1),Q(Z,Math.PI/2),'刀轴高于葱体；刃口进入真实刀槽，回程前停止送料','blade');
  for(const s of [-1,1]){const a=V(u+.04,.92,0),b=V(u+.07,.78,s*.65);beam('waste_chute_'+k+'_'+s,cut,a,b,.14,.008);box('waste_bin_floor_'+k+'_'+s,cut,u+.06,.08,s*.71,.28,.015,.24,'dark','开口废料箱；可从机架侧向抽出');for(const dx of [-.14,.14])box('waste_bin_endwall',cut,u+.06+dx,.35,s*.71,.012,.54,.24,'dark');for(const dz of [-.12,.12])box('waste_bin_sidewall',cut,u+.06,.35,s*.71+dz,.28,.54,.012,'dark');}
 }
 const rootStop=group('root_alignment_comb',input,'trim','stop');rootStop.position.set(2.72,0,0);box('stop_overhead_bar',rootStop,0,1.23,0,.025,.025,.60,'blue');for(let l=0;l<4;l++){box('stop_hanger',rootStop,0,1.13,laneZ(l),.009,.19,.009);box('root_end_stop',rootStop,.055,1.058,laneZ(l),.016,.028,.06,'pad');}
 for(const s of [-1,1]){box('stop_guide',input,2.72,1.32,s*.37,.035,.29,.035);box('stop_mount',input,2.72,1.48,s*.37,.08,.025,.08);}
 const wasteActors=[];for(let k=0;k<2;k++)for(let l=0;l<4;l++){const g=group('trim_waste_'+k+'_'+l,input,'trim','waste');for(let j=0;j<3;j++)beam('cut_waste_piece',g,V(-.018,0,(j-1)*.007),V(k?.16:.018,0,(j-1)*.008),k?.007:.002,k?.007:.002,k?'leaf':'paper');wasteActors.push({g,k,l});}
 for(const z of [-.40,.40])box('vision_post',input,3.95,1.24,z,.03,.58,.03);box('vision_bridge',input,3.95,1.54,0,.05,.04,.85);for(let l=0;l<4;l++){box('root_direction_camera',input,3.95,1.49,laneZ(l),.055,.05,.05,'dark');box('inspection_light',input,3.88,1.46,laneZ(l),.06,.025,.04,'white');}
 // Transfer cages: root toe carries the load; two interleaved split cages constrain the plant.
 const transfers=[];
 for(const kind of ['load','unload']){
  const station=kind==='load'?0:7,axis=group(kind+'_fixed_axis',root,kind,'fixed');axis.quaternion.copy(stationQ(station));
  legs(axis,[[1.69,-.45],[1.69,.45],[3.43,-.45],[3.43,.45]],.29);for(const s of [-1,1]){box(kind+'_bed',axis,2.55,.27,s*.36,1.83,.07,.06);box(kind+'_radial_rail',axis,2.55,.335,s*.36,1.83,.025,.025,'dark');}cyl(kind+'_radial_screw',axis,2.55,.31,.28,.008,1.88,'brass',X);motor(kind+'_radial_servo',axis,3.55,.31,.28,X);
  const carriage=group(kind+'_radial_carriage',axis,kind,kind+'_radial');box(kind+'_carriage_plate',carriage,0,.38,0,.28,.035,.83);for(const z of [-.36,.36])box(kind+'_linear_block',carriage,0,.36,z,.12,.04,.055,'blue');
  for(const s of [-1,1]){box(kind+'_lift_guide',carriage,0,.99,s*.43,.035,1.28,.035,'dark');box(kind+'_top_cap',carriage,0,1.65,s*.43,.10,.035,.08);}
  cyl(kind+'_lift_screw',carriage,0,.99,.43,.009,1.27,'brass');motor(kind+'_lift_motor',carriage,0,.30,.43,Y);
  const lift=group(kind+'_lift_crosshead',carriage,kind,kind+'_lift');for(const s of [-1,1]){box(kind+'_vertical_block',lift,0,0,s*.43,.075,.10,.065,'blue');beam(kind+'_cantilever_arm',lift,V(0,0,s*.43),V(-.65,0,s*.37),.055,.035);bearing(kind+'_trunnion_bearing',lift,-.65,0,s*.37,Z,.028);cyl(kind+'_stub_shaft',lift,-.65,0,s*.34,.014,.10,'steel',Z);}
  motor(kind+'_tilt_servo',lift,0,0,-.52,Z);for(const u of [0,-.65])cyl(kind+'_tilt_timing_pulley',lift,u,0,-.49,.047,.015,'dark',Z);for(const y of [-.047,.047])beam(kind+'_tilt_belt',lift,V(0,y,-.49),V(-.65,y,-.49),.006,.014,'belt');
  const cage=group(kind+'_rotating_cage',lift,kind,kind+'_tilt');cage.position.x=-.65;
  const left=group(kind+'_left_split_cages',cage,kind,kind+'_gripL'),right=group(kind+'_right_split_cages',cage,kind,kind+'_gripR'),toe=group(kind+'_root_toes',cage,kind,kind+'_toe');
  if(kind==='load'){for(const z of [-.28,-.12,0,.12,.28])box('load_slotted_backing_strip',cage,.28,.21,z,.035,.54,.018,'steel','梳形背架避开窄接料辊支柱；接料辊采用短轴和下置纵轴驱动');for(const yy of [.48])box('load_backing_end_crossbar',cage,.28,yy,0,.035,.018,.60);}else box(kind+'_backing_frame',cage,.28,.21,0,.035,.54,.60);for(const z of [-.32,.32])beam(kind+'_trunnion_side_cheek',cage,V(0,0,z),V(.28,.20,z),.018,.018);
  for(let l=0;l<4;l++){
   const z=laneZ(l),levels=l%2?[.19,.27]:[.020,.25];
   for(const [half,g,sgn] of [['L',left,-1],['R',right,1]]){
    const railx=l%2?.105:.080;box(kind+'_split_longitudinal_rail_'+l+half,g,railx,.18,z+sgn*.027,.009,.34,.009,'steel');
    for(const h of levels){const rr=.0185;const geom=geometry('splitC'+sgn,()=>new T.TorusGeometry(rr,.0035,5,14,Math.PI*2/3));const qq=Q(X,Math.PI/2).multiply(Q(Z,sgn===1?0:-Math.PI*2/3));add(kind+'_split_C_'+l+half+h,g,geom,'pad',V(0,h,z),V(1,1,1),qq,'两片120°包络指爪合成240°，后开口小于名义茎径；开合不扫过背轮长轴');beam(kind+'_split_C_arm',g,V(railx,h,z+sgn*.027),V(0,h,z+sgn*.0185),.007,.007);}
    beam(kind+'_rack_support',g,V(.28,l%2?.23:.07,z+sgn*.035),V(railx,l%2?.23:.07,z+sgn*.035),.009,.009);
   }
   box(kind+'_root_toe_'+l,toe,.0065,-.004,z,.043,.008,.007,'pad','根底托叉承重；微型丝杠驱动，沿根底平面退出');beam(kind+'_toe_outer_riser',toe,V(.022,-.004,z),V(.022,.010,z),.007,.007);beam(kind+'_toe_dogleg',toe,V(.022,.010,z),V(.022,.010,z+.040),.007,.007);beam(kind+'_toe_link',toe,V(.022,.010,z+.040),V(.10,.010,z+.040),.007,.007);cyl(kind+'_toe_screw',cage,.16,.010,z+.040,.003,.24,'brass',X);cyl(kind+'_toe_micro_gearmotor',cage,.30,.010,z+.040,.012,.040,'blue',X);box(kind+'_toe_ballnut',toe,.10,.010,z+.040,.018,.018,.018,'brass');cyl(kind+'_toe_guide',cage,.16,-.035,z+.055,.003,.24,'steel',X);beam(kind+'_toe_actuator_bracket',cage,V(.28,.07,z+.035),V(.28,-.035,z+.055),.012,.012);
  }
  for(const h of [.07,.23]){cyl(kind+'_grip_guide',cage,.28,h,0,.005,.69,'steel',Z);for(const [g,s]of [[left,-1],[right,1]]){box(kind+'_grip_slide',g,.28,h,s*.25,.03,.025,.06,'blue');box(kind+'_opposed_rack',g,.25,h+.02+s*.020,s*.12,.014,.014,.34,'brass');}cyl(kind+'_rack_pinion',cage,.25,h+.02,0,.018,.012,'brass',X);}
  motor(kind+'_grip_drive',cage,.33,.16,0,V(-1,0,0)).scale.setScalar(.85);cyl(kind+'_grip_motor_coupling',cage,.26,.16,0,.006,.055,'steel',X);for(const yy of [.09,.16,.25])cyl(kind+'_grip_sync_pulley',cage,.22,yy,0,.018,.010,'dark',X);for(const z of [-.018,.018])box(kind+'_grip_sync_belt',cage,.22,.17,z,.006,.16,.003,'belt');for(const yy of [.09,.25])cyl(kind+'_grip_output_axle',cage,.25,yy,0,.005,.075,'steel',X);transfers.push({kind,axis,carriage,lift,cage,left,right,toe});
 }
 // Fixed services hang from the fixed mast. No endlessly twisting carousel hoses.
 const services=group('fixed_service_skid',root,'utilities');legs(services,[[.28,1.95],[.68,1.95],[.28,2.35],[.68,2.35]],.22);box('utility_skid',services,.48,.24,2.15,.5,.07,.56);
 cyl('air_receiver',services,.38,.70,2.15,.14,.85,'air');box('plant_air_filter_regulator',services,.68,.64,2.16,.18,.30,.15,'blue','厂务压缩气接口→过滤器→储气罐；未假定小压缩机足够');pipe('plant_air_inlet',services,[V(.9,.32,2.15),V(.7,.32,2.15),V(.7,.75,2.15)],.018,'air');
 const utilityRing=group('overhead_fixed_headers',root,'utilities');for(let i=0;i<8;i++){const a=i*Math.PI/4;if(i===4){beam('header_input_overhead_cantilever',utilityRing,V(-.14,1.95,0),V(-1.78,1.95,0),.06,.05);continue;}beam('header_column_'+i,utilityRing,V(2.10*Math.cos(a),.05,2.10*Math.sin(a)),V(2.10*Math.cos(a),1.95,2.10*Math.sin(a)),.035);beam('header_radial_bracket_'+i,utilityRing,V(2.10*Math.cos(a),1.95,2.10*Math.sin(a)),V(1.78*Math.cos(a),1.95,1.78*Math.sin(a)),.025);}
 torus('fixed_air_header',utilityRing,0,2.02,0,1.78,.018,'air',Math.PI*2,Q(X,Math.PI/2));torus('fixed_water_header',utilityRing,0,1.91,0,1.85,.013,'water',Math.PI*2,Q(X,Math.PI/2));pipe('air_skid_to_header',services,[V(.38,1.1,2.15),V(.38,2.02,2.15),V(.38,2.02,1.74)],.018,'air');pipe('water_supply_interface',services,[V(.8,.18,2.25),V(.8,1.91,2.25),V(.8,1.91,1.67)],.013,'water');
 const processHeads=[],driveHeads=[],dryHeads=[],jetEffects=[];
 for(const j of [1,2,3,5,6]){
  const s=group('fixed_station_'+j,root,j<3?'peel':j===3?'wash':'dry');s.quaternion.copy(stationQ(j));
  beam('station_cantilever_'+j,s,V(.10,1.98,0),V(.75,1.98,0),.065,.05);box('drive_drop_column_'+j,s,.75,1.52,.195,.045,.88,.045);
  const engage=group('retractable_drive_'+j,s,s.userData.module,'drive_'+j),wheelX=lineX-.070;motor('station_gearmotor_'+j,engage,.75,.995,.195,X);cyl('station_horizontal_torque_shaft_'+j,engage,.965,.995,.195,.006,.31,'steel',X);box('station_bevel_gearcase_'+j,engage,wheelX,.995,.195,.050,.050,.050,'blue','内侧电机→水平扭矩轴→直角齿轮箱→接触轮；不穿过下方辐条');cyl('station_bevel_input',engage,wheelX,.995,.195,.017,.018,'brass',X);cyl('station_output_stub',engage,wheelX,.995,.235,.007,.10,'steel',Z);const w=group('station_wheel_rotor_'+j,engage,s.userData.module,'drive_wheel_'+j);w.position.set(wheelX,.995,.265);cyl('contact_drive_wheel_'+j,w,0,0,0,.036,.018,'pad',Z);const wm=box('drive_wheel_rotation_spoke',w,0,0,.012,.064,.003,.002,'dark');wm.role='overlay';driveWheels.push({g:w,j});box('drive_head_top_mount_'+j,engage,.94,1.065,.195,.35,.025,.10);box('drive_radial_slide_'+j,s,.88,1.11,.195,.34,.025,.035,'dark');box('drive_linear_block_'+j,engage,.96,1.091,.195,.08,.025,.055,'blue');cyl('drive_engagement_screw_'+j,s,.86,1.14,.195,.005,.40,'brass',X);motor('drive_engagement_servo_'+j,s,.60,1.14,.195,X);driveHeads.push(engage);
  if(j<3){
   box('peel_pressure_regulator_'+j,s,1.96,2.02,.15,.09,.12,.08,'blue','固定总管后分路减压，初始近端压力 '+P.stations[j].pressureMPa+' MPa，待实测标定');cyl('peel_pressure_gauge_'+j,s,1.96,2.12,.15,.025,.020,'white',Z);beam('peel_regulator_mount',s,V(1.64,1.83,.37),V(1.96,1.98,.15),.018);
   for(const z of [-.37,.37]){box('peel_column_'+j,s,1.64,1.27,z,.035,1.0,.035);cyl('peel_lift_guide_'+j,s,1.58,1.36,z,.008,.73);}
   cyl('peel_lift_screw_'+j,s,1.61,1.36,.34,.006,.76,'brass');motor('peel_scan_servo_'+j,s,1.61,1.81,.34,Y);
   const h=group('peel_scan_head_'+j,s,'peel','scan_'+j);for(const z of [-.35,.35]){box('peel_vertical_bearing_block',h,1.58,.12,z,.055,.08,.04,'blue');box('peel_radial_guide',h,1.72,.12,z,.36,.020,.020,'dark');}box('peel_vertical_ballnut',h,1.61,.12,.34,.035,.04,.035,'brass');box('peel_vertical_crossplate',h,1.64,.12,0,.12,.045,.74);cyl('peel_radial_ball_screw',h,1.75,.21,-.35,.006,.40,'brass',X);motor('peel_radial_servo_'+j,h,1.46,.21,-.35,X);
   const radial=group('peel_retractable_nozzle_bank_'+j,h,'peel','peel_radial_'+j);box('peel_nozzle_bank_crosshead',radial,1.57,.12,0,.035,.050,.66,'blue');for(const z of [-.35,.35])box('peel_radial_carriage_block',radial,1.64,.145,z,.08,.035,.035,'blue');box('peel_radial_ballnut',radial,1.64,.21,-.35,.03,.03,.035,'brass');
   for(let l=0;l<4;l++)for(let k=0;k<2;k++){const a=jetPose(j,l,k*P.jetSpacing),back=a.origin.clone().addScaledVector(a.direction,-.045),mid=a.origin.clone().addScaledVector(a.direction,-.021);pipe('peel_split_branch_'+j+'_'+l+'_'+k,radial,[V(1.57,.12,laneZ(l)),V(1.50,.12,laneZ(l)),back],.005,'air');cyl('peel_oblique_nozzle_'+j+'_'+l+'_'+k,radial,...mid.toArray(),.008,.042,'brass',a.direction,'可调锁紧角度：相对葱轴 '+P.stations[j].axisAngle+'°，切向入射20°；非最佳角度试验结论');cyl('peel_nozzle_aperture',radial,...a.origin.toArray(),.001,.0015,'dark',a.direction);torus('nozzle_angle_lock_arc',radial,...back.toArray(),.016,.002,'steel',Math.PI*.7,Q(X,Math.PI/2));const f=group('peel_flow_visual_'+j+'_'+l+'_'+k,radial,'effect','jet_'+j);beam('nominal_peel_jet_axis',f,a.origin,a.target,.0018,.0018,'air');jetEffects.push({g:f,j});}
   box('peel_header_anchor_'+j,s,2.15,1.87,.43,.07,.05,.05,'blue');beam('peel_hose_anchor_bracket',s,V(1.64,1.83,.37),V(2.15,1.87,.43),.025);pipe('peel_fixed_supply_'+j,s,[V(1.78,2.02,.0),V(2.15,2.02,.43),V(2.15,1.87,.43)],.011,'air');pipe('peel_moving_upper_terminal_'+j,h,[V(1.99,.10,.43),V(1.99,.20,.43),V(1.76,.20,.43),V(1.76,.10,.43)],.010,'air','轴向拖链与径向拖链串联，两个固定端都有支架');pipe('peel_radial_terminal_'+j,radial,[V(1.57,.10,.27),V(1.57,.12,.27)],.010,'air');
   const hose=group('peel_moving_hose_'+j,s,'peel','hose_'+j),radialHose=group('peel_radial_hose_'+j,h,'peel','radial_hose_'+j);processHeads.push({h,hose,j,radial,radialHose});
  }else if(j===3){
   for(const z of [-.33,.33])box('wash_post',s,1.62,1.27,z,.035,1.0,.035);for(const y of [1.16,1.39,1.58]){pipe('wash_bar_'+y,s,[V(1.85,1.91,.32),V(1.62,1.91,.32),V(1.62,y,.32),V(1.62,y,-.32)],.010,'water');for(let l=0;l<4;l++)cyl('wash_jet',s,1.54,y,laneZ(l),.008,.14,'blue',X);}
  }else{
   for(const z of [-.37,.37]){box('airknife_post',s,1.72,1.28,z,.035,1.12,.035);box('airknife_radial_guide',s,1.67,1.70,z,.38,.025,.025,'dark');}cyl('airknife_retract_screw_'+j,s,1.72,1.75,-.37,.006,.36,'brass',X);motor('airknife_retract_servo_'+j,s,1.48,1.75,-.37,X);const bank=group('retractable_airknife_bank_'+j,s,'dry','dry_radial_'+j);box('airknife_plenum_'+j,bank,1.57,1.36,0,.10,.60,.65,'air','风刀整体径向退让；过滤鼓风机独立供气');for(const z of [-.37,.37])box('airknife_linear_block',bank,1.64,1.68,z,.09,.04,.045,'blue');box('airknife_retract_ballnut',bank,1.64,1.75,-.37,.03,.035,.035,'brass');
   for(let l=0;l<4;l++){const a=jetPose(j,l,C.rootY+.280,true),back=a.origin.clone().addScaledVector(a.direction,-.035);beam('knife_rigid_branch',bank,V(1.52,1.36,laneZ(l)),back,.035,.025,'air');for(const v of [-1,1]){const n=V(-Math.sin(a.azimuth),0,Math.cos(a.azimuth)).multiplyScalar(v*.006);box('airknife_lip_'+j+'_'+l+'_'+v,bank,a.origin.x+n.x,a.origin.y,a.origin.z+n.z,.006,.515,.004,'steel','竖直狭缝内部导流片向下25°；不是只吹单一静止表面',Q(Y,-a.azimuth));}for(let k=0;k<8;k++){const jet=jetPose(j,l,C.rootY+.025+k*.073,true),f=group('dry_flow_visual_'+j+'_'+l+'_'+k,bank,'effect','jet_'+j);beam('nominal_dry_jet_axis',f,jet.origin,jet.target,.0015,.0015,'air');jetEffects.push({g:f,j});}}
   pipe('airknife_moving_inlet',bank,[V(1.59,1.75,.31),V(1.59,1.68,.31)],.033,'air');const bellows=group('blower_flexible_bellows_'+j,s,'dry','bellows_'+j),rings=[];for(let k=0;k<20;k++){const g=group('bellows_convolution_'+j+'_'+k,bellows,'dry','bellows_'+j);torus('bellows_reinforcement',g,0,0,0,.036,.003,'dark',Math.PI*2,Q(Y,Math.PI/2));cyl('bellows_flexible_sleeve',g,0,0,0,.034,.020,'air',X);rings.push(g);}box('bellows_fixed_bracket',s,1.88,1.70,.31,.05,.04,.10);dryHeads.push({bank,j,rings});
  }
 }
 const blower=group('filtered_air_blower',root,'dry');legs(blower,[[2.25,.75],[2.75,.75],[2.25,1.20],[2.75,1.20]],.22);box('blower_skid',blower,2.5,.25,.98,.62,.06,.54);cyl('blower_housing',blower,2.45,.51,.98,.18,.23,'blue',Z);motor('blower_motor',blower,2.72,.51,.98,X);box('air_filter_box',blower,2.20,.60,.98,.22,.34,.28,'dark');pipe('blower_main_duct',blower,[V(2.45,.67,.98),V(2.45,1.80,.98),V(1.68,1.80,.98)],.065,'air');
 for(const j of [5,6]){const p=localPoint(j,1.88,1.75,.31);pipe('airknife_fixed_duct_'+j,blower,[V(1.68,1.80,.98),V(1.68,1.80,0),V(p.x,1.80,p.z),p],.033,'air');}
 // Trayless, centre-fold web from below; a low side seal leaves the support belt intact.
 const pack=group('four_lane_flow_wrapper',root,'pack');pack.quaternion.copy(stationQ(7));legs(pack,[[2.38,-.40],[2.38,.40],[3.4,-.40],[3.4,.40]],.94);
 for(const z of [-.40,.40])box('wrapper_frame_rail',pack,2.86,.91,z,1.25,.06,.045);
 for(let l=0;l<4;l++){
  const v=laneZ(l);belt('bare_receiving_belt_'+l,pack,1.76,2.55,1.041,.090,v,{r:.020,drive:false,common:true});belt('wrapped_out_belt_'+l,pack,2.982,3.49,1.041,.090,v,{r:.010,drive:false,common:true});
  box('forming_support_plate_'+l,pack,2.734,1.040,v,.368,.008,.085,'steel','裸料由接料带、成形托板和出料带连续承托；横封处留真实断口');
  for(const sg of [-1,1])box('bare_receiving_low_guide',pack,2.455,1.062,v+sg*.049,.19,.028,.006,'pad','低侧导向限位；叶片在承托面上柔顺收拢，当前模型形变未作柔性求解');const reel=group('folded_film_reel_'+l,pack,'pack','reel_'+l);reel.position.set(2.89,.60,v);cyl('folded_film_roll_'+l,reel,0,0,0,.12,.106,'film',Z);cyl('film_roll_core_'+l,reel,0,0,0,.025,.112,'steel',Z);cyl('film_brake_disc_'+l,reel,0,0,.056,.040,.002,'dark',Z);box('film_brake_caliper_'+l,pack,2.93,.60,v+.056,.025,.025,.006,'blue');
  beam('lower_folded_web_'+l,pack,V(2.78,.65,v),V(2.60,1.044,v),.001,.106,'film');beam('opened_upper_web_'+l,pack,V(2.60,1.11,v),V(2.90,1.086,v),.001,.075,'film');
  for(const u of [2.60,2.74]){cyl('film_guide_roller_'+l,pack,u,.990,v,.012,.106,'steel',Z);for(const dz of [-.055,.055])box('film_guide_support',pack,u,.950,v+dz,.015,.08,.006);}
  for(const sg of [-1,1])beam('folding_plow_'+l+'_'+sg,pack,V(2.70,1.110,v+sg*.046),V(2.88,1.086,v+sg*.028),.005,.004,'steel');
  for(const sg of [-1,1]){cyl('side_seal_wheel_'+l+'_'+sg,pack,2.82,1.046+sg*.02505,v+.036,.025,.012,'hot',Z);cyl('side_seal_axle',pack,2.82,1.046+sg*.02505,v+.054,.004,.034,'steel',Z);box('side_seal_bearing_bracket',pack,2.82,1.046+sg*.02505,v+.060,.025,.024,.012,'blue');}
  box('side_sealer_post',pack,2.82,.960,v+.060,.022,.20,.015);box('side_seal_web_'+l,pack,2.78,1.046,v+.036,.26,.0008,.016,'film','折膜两开边在侧面热封；成袋由封边闭合保持，不靠湿葱摩擦');
 }
 cyl('four_film_fixed_spindle',pack,2.89,.60,0,.012,.70,'steel',Z);for(const z of [-.35,.35]){bearing('film_spindle_bearing',pack,2.89,.60,z,Z,.018);box('film_spindle_pedestal',pack,2.89,.755,z,.035,.30,.035);}
 for(const [n,a,c,r]of [['bare',1.76,2.55,.020],['wrapped',2.982,3.49,.010]])commonConveyorDrive('wrapper_'+n,pack,a,c,1.041,r);
 // Geared side-seal shafts, with paired spur gears reversing the upper wheels.
 for(const sg of [-1,1]){cyl('side_seal_common_shaft',pack,2.82,1.046+sg*.02505,0,.004,.64,'steel',Z);cyl('side_seal_reversing_gear',pack,2.82,1.046+sg*.02505,.32,.025,.012,'brass',Z);bearing('side_seal_end_bearing',pack,2.82,1.046+sg*.02505,-.32,Z,.010);}motor('side_seal_gearmotor',pack,2.82,1.02095,.46,V(0,0,-1));
 const jaws=group('four_lane_transverse_sealer',pack,'pack','seal');for(const z of [-.43,.43]){box('seal_press_column',pack,2.95,1.25,z,.04,.60,.04);cyl('seal_guide',pack,2.95,1.29,z,.01,.49);box('seal_moving_guide_block',jaws,2.95,.10,z,.06,.075,.065,'blue');box('jaw_crosshead_drop',jaws,2.95,.05,z,.035,.10,.035);}
 box('seal_press_top_bridge',pack,2.95,1.65,0,.18,.04,.98);box('jaw_crosshead',jaws,2.95,.10,0,.09,.035,.90);box('upper_heat_jaw',jaws,2.95,0,0,.035,.045,.55,'hot','横封梁→双导柱、双丝杠；折膜侧封后再做前后横封');box('seal_cut_knife',jaws,2.95,-.026,0,.001,.012,.55,'steel');box('lower_heat_jaw',pack,2.95,1.0335,0,.035,.025,.55,'hot');
 for(const z of [-.37,.37]){cyl('seal_vertical_ball_screw',pack,2.95,1.36,z,.006,.55,'brass');box('seal_travelling_nut',jaws,2.95,.10,z,.032,.035,.032,'brass');cyl('seal_bevel_gear',pack,2.95,1.64,z,.023,.017,'brass');bearing('seal_screw_lower_bearing',pack,2.95,1.105,z,Y,.012);}cyl('seal_cross_drive_shaft',pack,2.95,1.64,0,.007,.91,'steel',Z);motor('seal_lift_gearmotor',pack,2.95,1.64,.56,V(0,0,-1));
 // Four separate weighing frames. Only a flexible signal cable reaches each live frame.
 const weigh=group('four_independent_checkweighers',root,'weigh');weigh.quaternion.copy(stationQ(7));legs(weigh,[[3.59,-.41],[3.59,.41],[4.25,-.41],[4.25,.41]],.81);
 const liveFrames=[];for(let l=0;l<4;l++){const v=laneZ(l);box('weigh_fixed_base_'+l,weigh,3.905,.83,v,.71,.025,.105,'steel');box('load_cell_'+l,weigh,3.905,.88,v,.18,.045,.034,'blue','传感器固定端→底架；活动端→独立秤架');box('load_cell_fixed_spacer_'+l,weigh,3.84,.850,v,.050,.015,.034);const live=group('weigh_live_frame_'+l,weigh,'weigh','live_'+l);box('load_cell_live_spacer_'+l,live,3.97,.915,v,.050,.025,.034);for(const u of [3.62,4.18])box('weigh_overload_stop',weigh,u,.88325,v,.025,.0815,.025,'brass','限位柱与活动秤架留 3.5 mm 空隙，不桥接称重受力链');box('weigh_live_cradle_'+l,live,3.905,.94,v,.67,.025,.09);belt('weigh_belt_'+l,live,3.57,4.24,1.041,.09,v,{r:.020,drive:false});motor('weigh_independent_drive_'+l,live,4.24,.89,v,X);cyl('weigh_drive_cross_output',live,4.24,.89,v+.04,.005,.04,'steel',Z);for(const y of [.89,1.021])cyl('weigh_drive_pulley',live,4.24,y,v+.058,.017,.008,'dark',Z);for(const s of [-1,1])box('weigh_vertical_timing_belt',live,4.24+s*.017,.9555,v+.058,.003,.131,.008,'belt');liveFrames.push(live);pipe('flex_signal_loop_'+l,weigh,[V(3.905,.90,v+.02),V(3.85,.865,v+.07),V(3.79,.83,v+.07)],.0025,'dark','软电缆，禁止刚性导管桥接秤架');}
 // Slotted-frame insertion: internal bearings stay within 22 mm floor slots.
 const discharge=group('weigh_discharge_transfer',root,'out');discharge.quaternion.copy(stationQ(7));legs(discharge,[[5.35,-.30],[5.35,.30]],.62);
 const insertLift=group('fixed_insert_belt_frame',discharge,'out','fixed');box('insert_lift_crosshead',insertLift,5.35,.68,0,.08,.08,.39,'blue');for(const z of [-.15,.15])beam('insert_cantilever',insertLift,V(5.35,.65,z),V(4.90,.65,z),.035,.035);
 for(let l=0;l<4;l++){const v=laneZ(l);box('insert_narrow_belt_'+l+'_top',insertLift,4.58,1.041,v,.60,.006,.014,'belt','穿过收集框底部 22 mm 槽；框底缓升接管，上提160 mm完全离带后才允许横移');box('insert_narrow_belt_'+l+'_return',insertLift,4.58,1.013,v,.60,.004,.014,'belt');box('insert_internal_beam',insertLift,4.60,1.027,v,.60,.014,.008);for(const u of [4.28,4.88]){cyl('insert_internal_roller',insertLift,u,1.027,v,.014,.014,'steel',Z);for(const sg of [-1,1])box('insert_internal_bearing_fork',insertLift,u,1.027,v+sg*.0075,.026,.020,.002,'blue');}box('insert_front_support',insertLift,4.90,.841,v,.006,.372,.006);}
 cyl('insert_rear_common_shaft',insertLift,4.28,1.027,0,.004,.88,'steel',Z);motor('insert_belt_gearmotor',insertLift,4.20,1.027,0,V(0,0,-1));for(const u of [4.20,4.28])cyl('insert_drive_pulley',insertLift,u,1.027,-.06,.020,.010,'dark',Z);for(const y of [1.007,1.047])box('insert_drive_timing_belt',insertLift,4.24,y,-.06,.080,.003,.010,'belt');box('insert_motor_bracket',insertLift,4.20,.967,0,.12,.025,.15);
 // A/B four-slot cassettes. Empty stock enters horizontally from side magazines.
 const out=group('cassette_shuttles_and_buffer',root,'out');out.quaternion.copy(stationQ(7));const docks=[],magazines=[];
 for(const side of [-1,1]){
  const v=side*.85;legs(out,[[4.18,v-.34],[4.18,v+.34],[4.97,v-.34],[4.97,v+.34],[6.3,v-.34],[6.3,v+.34],[8.0,v-.34],[8.0,v+.34],[9.85,v-.34],[9.85,v+.34]],.94);
  for(const z of [v-.35,v+.35]){box('buffer_rail_'+side,out,7.45,.94,z,4.85,.07,.04);box('finished_sideguide_'+side,out,7.45,1.19,z,4.85,.035,.014,'pad');}
  for(let k=0;k<46;k++){const u=5.06+k*.105;cyl('finished_roller_'+side+'_'+k,out,u,.991,v,.020,.64,'steel',Z);for(const s of [-1,1])bearing('buffer_bearing',out,u,.991,v+s*.338,Z,.010);if(k%4===0)cyl('roller_drive_pulley',out,u,.991,v+.37,.025,.012,'dark',Z);}
  motor('buffer_roller_drive_'+side,out,9.85,.94,v+.46,V(0,0,-1));box('buffer_synchronous_drive_guard_'+side,out,7.45,.978,v+.385,4.85,.085,.032,'dark','封闭同步带→各辊外端带轮→减速机');box('full_sensor_'+side,out,9.55,1.20,v-.32,.04,.055,.03,'dark');
  if(side<0)for(const u of [4.25,4.67])box('dock_transverse_rail',out,u,.78,0,.028,.025,2.07,'dark');
  const shuttle=group('dock_shuttle_'+side,out,'out','dock_'+side);for(const u of [4.25,4.67])box('dock_linear_block',shuttle,u,.805,0,.12,.045,.095,'blue');box('dock_base',shuttle,4.48,.845,0,.75,.035,.63);for(const z of [-.265,.265])box('dock_foreaft_guide',shuttle,4.54,.89,z,.55,.02,.025,'dark');
  for(const z of [-.265,.265])box('dock_foreaft_guide_spacer',shuttle,4.54,.87125,z,.55,.0175,.025);  const fore=group('dock_foreaft_slide_'+side,shuttle,'out','dock_fore_'+side);box('foreaft_plate',fore,4.62,.916,0,.5,.025,.60);for(const z of [-.265,.265])box('foreaft_live_slide_block',fore,4.54,.908,z,.12,.016,.045,'blue');
  // Lift the locked cassette off a fixed conveyor; no moving belt motor or
  // full-depth cutouts through lower decks are required.
  for(const z of [-.37,.37])box('cassette_lift_fixed_column',fore,4.98,1.125,z,.030,.41,.030);box('cassette_lift_upper_bridge',fore,4.98,1.34,0,.060,.035,.80);
  for(const z of [-.34,.34]){cyl('cassette_lift_guide',fore,4.92,1.135,z,.008,.33);cyl('cassette_lift_ball_screw',fore,4.98,1.13,z,.006,.35,'brass');cyl('cassette_lift_bevel_gear',fore,4.98,1.32,z,.022,.016,'brass');}
  cyl('cassette_lift_common_shaft',fore,4.98,1.32,0,.006,.80,'steel',Z);motor('cassette_lift_gearmotor_'+side,fore,4.98,1.32,side*.56,V(0,0,-side));
  const elev=group('cassette_vertical_lift_'+side,fore,'out','cassette_lift_'+side);box('cassette_lift_crosshead',elev,4.92,1.06,0,.026,.035,.76);for(const z of [-.34,.34]){box('cassette_lift_guide_block',elev,4.92,1.06,z,.050,.080,.040,'blue');box('cassette_lift_ballnut',elev,4.98,1.06,z,.030,.035,.030,'brass');beam('cassette_lift_nut_bracket',elev,V(4.92,1.06,z),V(4.98,1.06,z),.016,.016);}
  for(const z of [-.34,.34]){box('dock_trunnion_pedestal',elev,4.92,.995,z,.055,.16,.035);bearing('dock_trunnion_bearing',elev,4.92,1.044,z,Z,.023);cyl('dock_stub_shaft',elev,4.92,1.044,z,.012,.09,'steel',Z);}
const tilt=group('dock_tilt_bed_'+side,elev,'out','dock_tilt_'+side);tilt.position.set(4.92,1.044,0);
  // Slots admit fixed side-feed belts; a full plate here would collide with them.
  for(const [u,w]of [[-.5675,.065],[-.400,.13],[-.2025,.125]])for(const z of [-.24,-.12,0,.12,.24])box('slotted_docking_bed',tilt,u,-.0295,z,w,.035,.016,'steel','横向供框带穿过底床空槽；侧向定位销锁框');
  for(const z of [-.30,.30])box('cassette_lock_pin',tilt,-.30,.015,z,.035,.045,.025,'brass');motor('dock_tilt_brake_servo_'+side,elev,4.92,1.044,side*.46,V(0,0,-side));
  motor('dock_shuttle_servo_'+side,out,4.48,.75,side*1.1,Z);cyl('dock_shuttle_screw_'+side,out,4.48,.75,0,.007,2.1,'brass',Z);motor('dock_foreaft_motor_'+side,shuttle,4.20,.60,.27,X);cyl('dock_foreaft_ball_screw',shuttle,4.55,.88,.27,.006,.55,'brass',X);box('dock_foreaft_ballnut',fore,4.62,.88,.27,.035,.035,.035,'brass');for(const y of [.60,.88])cyl('dock_foreaft_pulley',shuttle,4.27,y,.27,.025,.014,'dark',X);for(const z of [.245,.295])box('dock_foreaft_timing_belt',shuttle,4.27,.74,z,.014,.28,.003,'belt');
  const mv=side*C.magazineV;for(const u of [4.22,4.99])for(const dz of [-.34,.34])box('empty_magazine_post',out,u,.70,mv+dz,.035,1.30,.035);for(const dz of [-.34,.34])box('empty_magazine_top',out,4.61,1.36,mv+dz,.83,.035,.035);
  const lift=group('empty_cassette_stack_lift_'+side,out,'out','empty_lift_'+side);box('empty_stack_platform',lift,4.61,0,mv,.68,.016,.63,'blue','七框非嵌套堆叠；四外侧叠放柱传力');for(const u of [4.24,4.97])cyl('empty_stack_lift_guide',out,u,.68,mv+side*.35,.009,1.14);cyl('empty_stack_ball_screw',out,4.61,.68,mv+side*.35,.008,1.16,'brass');motor('empty_stack_lift_motor_'+side,out,4.61,.14,mv+side*.35,Y);
  for(const u of [4.42,4.62]){const mid=(mv+v)/2;box('cross_feed_belt_'+side,out,u,1.027,mid,.045,.006,C.magazineV-.85,'belt','水平取顶框，叠仓升降台每次上升 128 mm');for(const zz of [v,mv]){cyl('crossfeed_end_roller',out,u,1.004,zz,.02,.055,'steel',X);bearing('crossfeed_end_bearing',out,u+.04,1.004,zz,X,.009);}}
  const push=group('empty_cassette_top_pusher_'+side,out,'out','empty_push_'+side);box('empty_positive_push_bar',push,4.61,1.08,mv+side*.33,.48,.035,.018,'pad','推杆正向推送外侧支耳，禁止只依赖摩擦瞬间加速');for(const u of [4.3,4.9])box('top_pusher_rail',out,u,1.15,(mv+v)/2,.018,.018,1.08,'dark');magazines.push({side,lift,push});docks.push({side,shuttle,fore,tilt,elev});
 }
 // Reusable cassette geometry, and independent locked outrigger feet.
 const rackActors=[];
 for(let n=0;n<C.stock;n++){
  const g=group('collection_cassette_'+n,root,'out','rack_'+n),feet=[];
  const limits=[-.28,...Array.from({length:4},(_,l)=>[laneZ(l)-.011,laneZ(l)+.011]).flat(),.28];for(let k=0;k<5;k++){const lo=limits[k*2],hi=limits[k*2+1];box('cassette_floor_strip_'+n+'_'+k,g,-.006,.28,(lo+hi)/2,.012,.56,hi-lo,'steel','五条底板留四条 22 mm 通槽，让插带穿入；抬框时两侧实体托条接重');}box('cassette_floor_root_bridge_'+n,g,-.006,-.020,0,.012,.016,.56,'steel');
  for(let l=0;l<4;l++){
   const z=laneZ(l);for(const yy of [.11,.38]){for(const s of (l===0?[-1,1]:[1]))box('cassette_guide_side_'+n+'_'+l+'_'+yy,g,.035,yy,z+s*.060,.080,.012,.008,'pad');box('cassette_guide_front',g,.072,yy,z,.008,.012,.112,'pad');}
   // Split heel stops leave a central recess for the flexible transverse seal.
   box('cassette_root_heel_'+n+'_'+l,g,.010,-.004,z,.040,.008,.042,'pad','根端隔膜落在软托座上；端封边折入下方和侧方让位槽，封缝不作吊带');
  }
  for(const u of [.30,.50])for(const s of [-1,1]){box('cassette_stack_lug_'+n,g,-.007,u,s*.295,.014,.035,.030,'steel');box('cassette_stack_post_'+n,g,.057,u,s*.295,.114,.020,.020,'steel','四外侧堆叠柱隔开上下框；避免框体互相嵌套');}
  for(const [k,xx,zz]of [[0,-.09,-.25],[1,-.09,.25],[2,.09,-.25],[3,.09,.25]]){const f=group('cassette_fold_foot_'+n+'_'+k,g,'out','foot_'+n+'_'+k);f.position.set(xx,-.008,zz);box('folding_outrigger_'+n+'_'+k,f,xx<0?-.065:.065,-.005,0,.16,.014,.04,'dark');cyl('foot_hinge_pin',f,0,0,0,.006,.055,'steel',Z);box('foot_overcentre_lock',f,xx<0?-.03:.03,.012,0,.04,.017,.025,'brass');feet.push({g:f,sign:xx<0?-1:1});}
  rackActors.push({g,feet,n});
 }
 const plantActors=[];
 const endGeo=(sign)=>geometry('folded_end_'+sign,()=>{const v=[[-.014,0,-.028],[.028,0,-.028],[.028,0,.028],[-.014,0,.028],[-.012,sign*.015,-.028],[-.012,sign*.015,.044]],idx=[0,1,4,1,2,5,1,5,4,2,3,5,3,0,4,3,4,5],g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(idx.flatMap(i=>v[i]),3));g.computeVertexNormals();return g;});
 const greenGeos=[];for(let k=0;k<5;k++){const angle=k*Math.PI*2/5,curve=new T.QuadraticBezierCurve3(V(.003*Math.cos(angle),.36,.003*Math.sin(angle)),V(.015*Math.cos(angle),.46,.015*Math.sin(angle)),V(.021*Math.cos(angle),.535-(k%2)*.018,.021*Math.sin(angle)));greenGeos.push(geometry('leaf_'+k,()=>new T.TubeGeometry(curve,9,.005,5,false)));}
 for(let n=0;n<Math.ceil(C.duration/8)+1;n++)for(let l=0;l<4;l++){
  const g=group('scallion_'+n+'_'+l,root,'product','food_'+n+'_'+l),crop=group('crop_self_spin_'+n+'_'+l,g,'product','crop_spin'),leafCluster=group('soft_leaf_gathering_'+n+'_'+l,crop,'product','leaf_gather');cyl('white_stem',crop,0,.185,0,.014,.37,'white');for(let k=0;k<5;k++)add('green_leaf_'+k,leafCluster,greenGeos[k],k%2?'leaf':'leaf2');const mark=box('self_spin_visual_trace',crop,.0147,.20,0,.001,.22,.002,'hot');mark.role='overlay';mark.note='表面自转示踪线，仅可视化，不是实体附件';
  const raw=group('raw_uncut_'+n+'_'+l,crop,'product','food_raw'),rawLeaf=group('raw_leaf_tips_'+n+'_'+l,raw,'product','food_raw'),rawRoot=group('raw_root_fibres_'+n+'_'+l,raw,'product','food_raw');for(let k=0;k<3;k++)beam('uncut_leaf_tip',rawLeaf,V((k-1)*.008,.49,0),V((k-1)*.012,.72,0),.008,.008,'leaf');for(let k=0;k<4;k++)beam('raw_root_fibre',rawRoot,V((k-1.5)*.005,0,0),V((k-1.5)*.009,-.038,.004*(k%2)),.0016,.0016,'paper');
  const bag=group('film_bag_'+n+'_'+l,g,'product','food_bag');box('bag_upper_side',bag,.028,.270,0,.0005,.54,.056,'film');const lower=geometry('conformal_bag_lower',()=>{const vs=[];for(let k=0;k<32;k++){const z0=-.028+k*.056/32,z1=z0+.056/32,x=z=>Math.abs(z)<.014?-Math.sqrt(.014**2-z*z):0;vs.push(x(z0),0,z0,x(z1),0,z1,x(z1),.54,z1,x(z0),0,z0,x(z1),.54,z1,x(z0),.54,z0);}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vs,3));g.computeVertexNormals();return g;});add('bag_conformal_lower_side',bag,lower,'film');for(const sg of [-1,1])box('bag_folded_side',bag,.014,.270,sg*.028,.028,.54,.0005,'film');box('long_side_seam',bag,-.012,.270,.036,.0008,.54,.016,'hot');
  const front=group('bag_front_end_seal',bag,'product','food_seal');add('front_folded_end',front,endGeo(-1),'film');box('front_transverse_seal',front,-.012,-.015,.008,.0008,.006,.072,'hot');const rear=group('bag_rear_end_seal',bag,'product','food_seal');add('rear_folded_end',rear,endGeo(1),'film',V(0,.54,0));box('rear_transverse_seal',rear,-.012,.555,.008,.0008,.006,.072,'hot');
  plantActors.push({g,crop,leafCluster,raw,rawLeaf,rawRoot,bag,front,rear,n,l});
 }
 // Fixed transparent splash panels only around wet stations, open at both transfers.
 const guards=group('wet_station_splash_guards',root,'guard');for(const j of [1,2,3,4,5,6]){const g=group('guard_panel_'+j,guards,'guard');g.quaternion.copy(stationQ(j));box('splash_guard',g,1.99,1.34,0,.004,.98,.66,'guard');for(const z of [-.35,.35]){box('splash_guard_post',g,2.00,1.23,z,.025,1.38,.025);}}
 const effect=group('process_effects',root,'effect');const effects=[];for(const [j,m]of [[3,'water']])for(let l=0;l<4;l++){const g=group('jet_effect_'+j+'_'+l,effect,'effect');g.quaternion.copy(stationQ(j));for(let k=0;k<4;k++)beam('flow_arrow',g,V(1.48,1.12+k*.13,laneZ(l)),V(1.29,1.10+k*.13,laneZ(l)),.003,.003,m);effects.push({g,j});}
 const mechanics=completeMechanics({root,bodies,parts,group,box,cyl,beam,pipe,torus,motor,bearing,add,frame,input,upperPinch,rootStop,pan,services,utilityRing,blower,transfers,docks,magazines,rackActors,keepers,out});
 const details=completeMechanicalDetails({parts,bodies,box,cyl,beam,add,transfers});mechanics.details=details;
 const hardware=completeHardware({root,parts,bodies,group,add,box,beam});mechanics.hardware=hardware;
 const drive20=completeDrive20({root,parts,frame,rotor,group,add,mechanics,hardware});mechanics.drive20=drive20;
 const packaging21=completePackaging21({root,bodies,parts,group,add,box,cyl,beam,material,pack,weigh,discharge,out,plantActors,mechanics});mechanics.packaging21=packaging21;
 const axes22=completeAxes22({parts,bodies,group,add,box,cyl,beam,mechanics});mechanics.axes22=axes22;
 const cad23=completeCAD23({parts,bodies,group,add,mechanics});mechanics.cad23=cad23;
 const refine23=completeRefine23({parts,box});mechanics.refine23=refine23;
 const adaptive25=completeAdaptive25({parts,bodies,keepers,group,add,beam,transfers,mechanics});mechanics.adaptive25=adaptive25;
 const batches=new Map(),worldM=new T.Matrix4(),zero=new T.Matrix4().makeScale(0,0,0);
 // Preserve part IDs within each instance batch for transparent inspection.
 for(const p of parts){const key=p.geometry.uuid+':'+p.mat;let b=batches.get(key);if(!b)batches.set(key,b={geometry:p.geometry,mat:p.mat,parts:[]});b.parts.push(p);}
 for(const b of batches.values()){const mesh=new T.InstancedMesh(b.geometry,material[b.mat],b.parts.length);mesh.name='part_batch_'+b.mat;mesh.frustumCulled=false;mesh.userData.parts=b.parts;mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);root.add(mesh);b.mesh=mesh;}
 let last=-1,lastHalt=false,filters={pipes:true,guards:false,products:true,focus:'all',isolated:null};
 function active(body){for(let b=body;b&&b!==root;b=b.parent)if(b.userData.active===false)return false;return true;}
 function renderBatches(){root.updateMatrixWorld(true);for(const b of batches.values()){for(let i=0;i<b.parts.length;i++){const p=b.parts[i],show=p.visible!==false&&active(p.body)&&(filters.pipes||!['air','water','drain'].includes(p.mat))&&(filters.guards||p.module!=='guard')&&(filters.products||p.module!=='product')&&(!filters.isolated||filters.isolated.has(p.index));b.mesh.setMatrixAt(i,show?worldM.multiplyMatrices(p.body.matrixWorld,p.local):zero);}b.mesh.instanceMatrix.needsUpdate=true;}}
 const hoseData=[];for(const h of processHeads){const links=[],radialLinks=[];for(let i=0;i<36;i++){const g=group('hose_chain_link_'+h.j+'_'+i,h.hose,'peel','hose_'+h.j);box('energy_chain_side',g,0,0,-.014,.038,.015,.006,'dark');box('energy_chain_side',g,0,0,.014,.038,.015,.006,'dark');cyl('flex_air_hose_segment',g,0,0,0,.008,1.35/36,'air',X);links.push(g);}for(let i=0;i<16;i++){const g=group('radial_hose_link_'+h.j+'_'+i,h.radialHose,'peel','radial_hose_'+h.j);for(const y of [-.014,.014])box('radial_chain_side',g,0,y,0,.031,.006,.018,'dark');cyl('radial_air_segment',g,0,0,0,.008,.50/16,'air',X);radialLinks.push(g);}hoseData.push({...h,links,radialLinks});}
 // Hose chain parts were made after initial batching; put them into their own batches.
 for(const p of parts.filter(p=>p.index>=Array.from(batches.values()).reduce((a,b)=>a+b.parts.length,0))){const key='late'+p.geometry.uuid+p.mat;let b=batches.get(key);if(!b)batches.set(key,b={geometry:p.geometry,mat:p.mat,parts:[]});b.parts.push(p);}
 for(const b of batches.values())if(!b.mesh){const mesh=new T.InstancedMesh(b.geometry,material[b.mat],b.parts.length);mesh.frustumCulled=false;mesh.userData.parts=b.parts;root.add(mesh);b.mesh=mesh;}
 function update(t,force=false,halt=false){if(t===last&&!force&&halt===lastHalt)return;last=t;lastHalt=halt;rotor.rotation.y=rotorAngle(t);const phase=t%8,to=t-24;
  for(const {g,i,l}of keepers){const j=((rotorAngle(t)/(Math.PI/6)-i)%12+12)%12;let open=j>11?ramp(j,11,12):0;if(j<1e-7)open=1-ramp(phase,4.5,4.7);if(Math.abs(j-7)<1e-7)open=ramp(phase,1.35,1.5)*(1-ramp(phase,3.65,3.95));g.position.z=laneZ(l)+(l<2?1:-1)*.042*open;}
  upperPinch.position.y=.12*(ramp(phase,5.2,5.5)-ramp(phase,7.7,8));rootStop.position.y=.18*(ramp(phase,.35,.65)-ramp(phase,5.65,5.9));
  sawGroups.forEach((g,i)=>{g.position.z=mix(-.32,.32,ramp(phase,1.0+i*.2,4.3+i*.2))-mix(0,.64,ramp(phase,5.3,5.9));});
  for(const a of wasteActors){const p=phase-(cutAge(a.l,a.k)-8),s=laneZ(a.l)<0?-1:1;a.g.userData.active=t>=8&&p>=0&&p<2.2;const f=ramp(p,.18,.8);a.g.position.set((a.k?3.33:2.8)+mix(a.k?.02:-.02,.06,f),p<.18?1.06-.5*9.81*p*p:mix(.901,.78,f)-.63*ramp(p,.8,1.25),mix(laneZ(a.l),s*.71,f));a.g.rotation.z=p>.18?.5*ramp(p,.18,.8):0;}
  for(const a of transfers){const s=cradleMotion(a.kind,t);a.carriage.position.x=s.u+.65;a.lift.position.y=s.y;a.cage.rotation.z=s.tilt;a.left.position.z=-transferStroke*clamp(s.open);a.right.position.z=transferStroke*clamp(s.open);const tx=a.kind==='load'?ramp(phase,5.05,5.25)-ramp(phase,5.65,5.85):phase<6?1-ramp(phase,.8,1.05)+ramp(phase,5.4,5.6):1,ty=a.kind==='load'?ramp(phase,5.25,5.55)-ramp(phase,6,8):phase<6?ramp(phase,5.6,5.8):1-ramp(phase,6,6.2);a.toe.position.set(.06*tx,0,0);}
  for(const {g,i,ratio}of rolls)g.rotation.y=carrierSpin(i,t)*ratio;
  for(const {g,i}of lineShafts)g.rotation.z=carrierSpin(i,t)*(-P.stemRadius/P.rearRollRadius)*P.wormRatio;
  for(const {g,j}of driveWheels)g.rotation.z=(P.stations[j]?.turns||0)*Math.PI*2*headState(j,t).progress*(P.stemRadius/P.rearRollRadius)*P.wormRatio*P.pickupRadius/P.headWheelRadius;
  driveHeads.forEach(g=>g.position.x=-.12*(1-ramp(phase,0,.30)+ramp(phase,5.40,5.90)));
  for(const {h,j,radial,links,radialLinks}of hoseData){const st=headState(j,t),height=st.scanY;h.position.y=height;radial.position.x=st.retract;const R=.08,L=1.35,yA=1.87,yB=height+.10,yc=(yA+yB+Math.PI*R-L)/2,a=yA-yc;
   const at=s=>s<a?V(2.15,yA-s,.43):s<a+Math.PI*R?V(2.07+R*Math.cos((s-a)/R),yc-R*Math.sin((s-a)/R),.43):V(1.99,yc+s-a-Math.PI*R,.43);
   links.forEach((g,i)=>{const s=(i+.5)/links.length*L;g.position.copy(at(s));g.quaternion.setFromUnitVectors(X,at(Math.min(L,s+.0001)).sub(at(Math.max(0,s-.0001))).normalize());});
   const La=.50,xA=1.76,xB=1.57+st.retract,xc=(La+xA+xB-Math.PI*R)/2,d=xc-xA;
   const along=s=>s<d?V(xA+s,.10,.43):s<d+Math.PI*R?V(xc+R*Math.sin((s-d)/R),.10,.35+R*Math.cos((s-d)/R)):V(xc-(s-d-Math.PI*R),.10,.27);
   radialLinks.forEach((g,i)=>{const s=(i+.5)/radialLinks.length*La;g.position.copy(along(s));g.quaternion.setFromUnitVectors(X,along(Math.min(La,s+.0001)).sub(along(Math.max(0,s-.0001))).normalize());});
  }
  for(const {bank,j,rings}of dryHeads){const st=headState(j,t);bank.position.x=st.retract;rings.forEach((g,i)=>g.position.set(mix(1.59+st.retract,1.88,(i+.5)/rings.length),1.75,.31));}
  for(const {g,j}of jetEffects)g.userData.active=headState(j,t).air;
  jaws.position.y=1.23-.1615*(ramp(phase,5.4,5.75)-ramp(phase,6.2,6.6));insertLift.position.y=0;
  for(const {side,shuttle,fore,tilt,elev}of docks){const first=side>0?1:0,n=first+2*Math.max(0,Math.floor((to-(113.0+first*8))/16)+1),b=to-n*8-104;let z=side*.85;if(b>=-6.6&&b<1)z=mix(side*.85,0,ramp(b,-5.8,-4.8));else if(b>=1&&b<2)z=mix(0,side*.85,ramp(b,1,2));shuttle.position.z=z;elev.position.y=collectionLift(b);fore.position.x=.24*(ramp(b,5.3,6.2)-ramp(b,7.35,7.95));tilt.rotation.z=-Math.PI/2*(ramp(b,2,5)-ramp(b,7.95,8.7));}
  for(const {side,lift,push}of magazines){let n=0;for(let k=0;k<6;k++)n+=ramp(to,113.5+(side>0?8:0)+k*16,114.5+(side>0?8:0)+k*16);lift.position.y=.252+.128*n;push.position.z=pusherState(t,side).offset;}
  for(const a of rackActors){const r=rackPose(a.n,t);a.g.userData.active=!!r;if(r){a.g.position.copy(r.p);a.g.quaternion.copy(r.q);for(const f of a.feet)f.g.rotation.z=f.sign*Math.PI/2*(1-r.feet);}}
  for(const a of plantActors){const p=productPose(a.n,a.l,t);a.g.userData.active=!!p;if(p){a.g.position.copy(p.p);a.g.quaternion.copy(p.q);a.raw.userData.active=p.age<14;a.rawRoot.userData.active=p.age<cutAge(a.l,0);a.rawLeaf.userData.active=p.age<cutAge(a.l,1);a.crop.rotation.y=cropSpin(p.age);a.leafCluster.scale.x=a.leafCluster.scale.z=1-.5*ramp(p.age,77,77.85);a.bag.userData.active=false;}}
  for(const a of effects)a.g.userData.active=phase>.4&&phase<5.4;
  mechanics.update(t);drive20.update(t);packaging21.update(t,halt);axes22.update(t);cad23.update(t);adaptive25.update(t);root.updateMatrixWorld(true);renderBatches();
 }
 update(0,true);
 return {root,parts,bodies,batches,material,update,setFilters(next){filters={...filters,...next};if('xray' in next)for(const [k,v]of Object.entries(material)){if(['white','leaf','leaf2','film','hot'].includes(k))continue;v.transparent=!!next.xray||k==='guard';v.opacity=next.xray?.16:k==='guard'?.14:1;v.depthWrite=!next.xray&&k!=='guard';v.needsUpdate=true;}update(last,true,lastHalt);},inspect:p=>({...mechanics.inspect(p),...details.inspect(p),...hardware.inspect(p),...drive20.inspect(p),...packaging21.inspect(p),...axes22.inspect(p),...cad23.inspect(p),...adaptive25.inspect(p),...refine23.inspect(p)}),mechanics,stats:{parts:parts.length,drawMeshes:batches.size},actors:{plants:plantActors,racks:rackActors,transfers,docks,keepers,insertLift,processHeads,dryHeads,rolls},active,renderBatches};
}
