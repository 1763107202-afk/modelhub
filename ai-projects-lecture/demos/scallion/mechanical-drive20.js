import * as T from 'three';
import {CAD20} from './drive20-data.js';
import {rotorAngle} from './flow14.js';
// Meshes come from the same valid B-rep solids as the STEP, converted mm→m.
export function completeDrive20(k){
 const {root,parts,frame,rotor,group,add,mechanics,hardware}=k;
 const replaced=/^(?:fixed_central_mast|slew_fixed_race|slew_rolling_race|rotor_hub_hollow|ring_gear|rotor_pinion|gear_tooth_\d+|mast_base_flange(?:_.*)?|rotor_motor_mount(?:_.*)?|rotor_motor_pedestal|rotor_output_coupling)$/;
 for(const p of parts){let oldMotor=false;for(let b=p.body;b;b=b.parent)if(b.name==='rotor_servo_gearbox')oldMotor=true;if(replaced.test(p.name)||oldMotor){p.visible=false;p.role='superseded';}}
 hardware.pending.splice(0,hardware.pending.length,...hardware.pending.filter(p=>parts[p.part].visible!==false));
 const groups={fixed:group('R20_grounded_main_drive',frame,'frame'),rotor:group('R20_rotor_hub_and_gear',rotor,'rotary','rotor'),pinion:group('R20_pinion_shaft_train',frame,'frame','pinion')};groups.pinion.position.x=.464;
 const geometries=new Map(),added=[];
 for(const row of CAD20.parts){let g=geometries.get(row.geometry);if(!g){const data=CAD20.geometries[row.geometry];g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(data.v.map(x=>x*.001),3));g.setIndex(data.i);g.computeVertexNormals();geometries.set(row.geometry,g);}const pos=new T.Vector3(...row.position_mm.map(x=>x*.001));if(row.body==='pinion')pos.x-=.464;const p=add(row.name,groups[row.body],g,row.material,pos);p.drive20=row;p.note=row.description;p.family20=row.family;added.push(p);}
 const base=mechanics.records.find(r=>r.id==='rotor');Object.assign(base,{title:'R20 旋转主体与实体主传动',support:'辐条→开孔轮毂→12套隔柱/M10→回转内圈→外圈/承托环/焊接肋→空心立柱和地脚；外环轨道轮分担载荷',power:'候选750W伺服→40:1减速器；扭矩、制动与惯量按实机复核',transmission:'Ø18输出轴→开缝夹紧爪式联轴器→双轴承Ø20阶梯轴/6×6键→m8/20齿小齿轮→m8/96齿环齿轮',witness:['ring_gear','pinion_stepped_shaft','shaft_slotted_locknut','track_wheel_stub'],limit:'主传动由有效CAD实体生成；回转支承内部、轴承载荷、齿根刀具圆角、联轴器夹紧容量、公差、预紧及整机实料验收尚待完成。'});
 const records=[
 {id:'gear',title:'96 / 20 齿轮副',support:'环齿轮→12个套筒/M8穿栓＋2个定位销→16mm轮毂板→回转内圈；小齿轮→键和轴肩→双轴承座',power:'候选伺服与40:1减速器，经夹紧联轴器输入',drive:'m8、20°压力角、中心距464mm；反向传动比4.8。原方块齿和光圆小齿轮已替换。',names:/ring_gear|rotor_pinion|gear_|rotor_hub|carrier_|slew_|bearing_fixed_/,witness:'rotor_pinion',target:[.40,.855,0],distance:.55},
 {id:'shaft',title:'轴系、键与轴向锁止',support:'轴肩和M20锁紧螺母定位上轴承；下轴承外圈允许0.3mm轴向浮动；上盖可拆',power:'开缝夹紧爪式联轴器→阶梯轴',drive:'6×6×24键传矩，轴端压板/M6限制齿轮上窜；内舌垫圈入轴槽、外舌入圆螺母槽。',names:/pinion_|shaft_|bearing_cover_|rotor_motor_portal/,witness:'shaft_slotted_locknut',target:[.464,.81,0],distance:.30},
 {id:'coupling',title:'联轴器与电机安装',support:'4套M8贯穿电机法兰/20mm平台；双立柱和斜撑接底架，双轴承架接平台',power:'750W / 40:1仅为计算候选，待供应商实物接口定案',drive:'Ø18/Ø20夹紧孔；交错三爪与六瓣弹性体；两个M8夹紧螺钉分别落在沉孔/对侧螺纹包络内。',names:/clamp_jaw|coupling_|motor_|rotor_servo|pinion_bearing_|bearing_cover_/,witness:'clamp_jaw_coupling_lower',target:[.464,.69,0],distance:.40},
 {id:'foundation',title:'回转支承与承托基础',support:'固定外圈→12套M10穿栓→承托环/四块焊接肋→Ø200×8空心柱→320mm底板/灌浆/锚杆',power:'固定承载件，无独立动力；螺栓承受反力',drive:'移动内圈→12个47.5mm隔柱→轮毂；固定外圈不随转子运动。',names:/slew_|carrier_|rotor_hub|fixed_central|mast_grout|foundation_|bearing_fixed_/,witness:'slew_fixed_race',target:[0,.79,0],distance:1.15}
 ].map(r=>({...r,base:'rotor',focus:{module:'all',time:7,target:r.target,distance:r.distance},parts:added.filter(p=>r.names.test(p.name)).map(p=>p.index),witness:added.find(p=>p.name===r.witness).index,limit:base.limit}));
 return {records,parts:added,joints:CAD20.joints,groups,metadata:CAD20,update(t){groups.pinion.rotation.y=Math.PI/20-4.8*rotorAngle(t);},inspect(p){if(!p.drive20)return null;return {record:'rotor',support:base.support,power:base.power,transmission:base.transmission,note:p.note+'\n'+base.limit,cad_source:'R20 B-rep / STEP'};}};
}
