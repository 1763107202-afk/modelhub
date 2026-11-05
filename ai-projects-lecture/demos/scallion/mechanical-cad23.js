import * as T from 'three';
import {DETAIL23} from './detail23-data.js';
import {ramp,localPoint} from './flow14.js';
const V=(...a)=>new T.Vector3(...a);
export function tuckerLift23(t){const p=((t-120)%8+8)%8;return .30*(1-ramp(p,3,5)+ramp(p,6.4,7.8));}
export function completeCAD23({parts,bodies,group,add,mechanics}){
 const start=parts.length,frame=bodies.find(b=>b.name==='R21_packaging_expanded_line'),panRoot=bodies.find(b=>b.name==='gravity_pan_and_filter'),live=bodies.find(b=>b.name==='R21_front_seal_tucker');
 if(!frame||!panRoot||!live)throw Error('Missing R23 mounting parents');
 const fixed=group('R23_tucker_fixed',frame,'pack'),shaft=group('R23_tucker_shaft',frame,'pack');shaft.position.set(8.4,0,.30);
 const pan=group('R23_sloped_pan',panRoot,'wash');pan.position.y=.64;pan.rotation.z=-.018;const wash=group('R23_filter_and_drain',panRoot,'wash');
 const old=/^R21_tucker_(vertical_rail|guide_block|crosshead|top_bridge|portal_knee|lift_screw|servo|ballnut)$/,
 oldWash=/^(annular_drain_pan|pan_bracket_\d+|pan_outer_upstand|gravity_drain_\d+|gravity_drain_elbow_\d+|removable_skin_filter|waste_outlet_\d+|waste_outlet_elbow_\d+|filter_stand.*)$/;
 for(const p of parts){if(old.test(p.name)||oldWash.test(p.name)){p.visible=false;p.role='superseded';}if(p.name==='R21_tucker_column'){p.review23='portal-column';const v=new T.Vector3(),q=new T.Quaternion(),s=new T.Vector3();p.local.decompose(v,q,s);v.x=8.28;v.y=1.0775;v.z=Math.sign(v.z)*1.35;s.y=2.085;p.local.compose(v,q,s);}if(p.name==='R21_tucker_foot'){p.review23='portal-foot';const v=new T.Vector3(),q=new T.Quaternion(),s=new T.Vector3();p.local.decompose(v,q,s);v.x=8.28;v.y=.0175;v.z=Math.sign(v.z)*1.35;p.local.compose(v,q,s);}}
 const parents={fixed,shaft,pan,wash,live},cache=new Map();
 for(const row of DETAIL23.parts){let g=cache.get(row.geometry);if(!g){const d=DETAIL23.geometries[row.geometry];g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(d.v.map(x=>x*.001),3));g.setIndex(d.i);g.computeVertexNormals();cache.set(row.geometry,g);}const p=add('R23_'+row.name,parents[row.body],g,row.material,V(...row.position_mm.map(x=>x*.001)));p.cad23=row;p.note=row.description;}
 const rec={id:'detail23',title:'R23 折边轴与接水结构',module:'pack',support:'双导杆→带孔端座/背板→空心门架→立柱/地脚；丝杆固定端轴承→贯穿紧固/压缩套筒→门架。接水盘→四根斜撑→底架；滤篮→落地箱体。',power:'候选带制动伺服→分缝联轴器→Ø20/20mm导程丝杆；排水依靠重力',transmission:'丝杆旋转→法兰螺母→带孔安装板→横梁/双导杆滑块→八根折边指。降程2s、升程1.4s，0.3m行程。',witness:['R23_lift_screw_20x20','R23_sloped_drain_pan'],limit:'名义实体工程细化，非制造放行。轴承内部/预紧、电机制动与选型、联轴器夹紧、全部配孔和密封端接、焊缝/疲劳、卫生结构、全机连续干涉及实料验证尚未完成。'};
 rec.focus={module:'pack',time:125,target:localPoint(7,8.4,1.75,.30).toArray(),distance:1.3};mechanics.records.push(rec);const oldCategory=mechanics.category;mechanics.category=p=>(p.cad23||p.review23)?'detail23':oldCategory(p);
 return {parts:parts.slice(start),groups:parents,metadata:DETAIL23,update(t){const lift=tuckerLift23(t);live.position.y=lift;shaft.rotation.y=-lift/.020*2*Math.PI;},inspect(p){if(!p.cad23&&!p.review23)return null;return {record:'detail23',support:rec.support,power:rec.power,transmission:rec.transmission,note:p.note+'；'+rec.limit,cad_source:'R23 nominal B-rep'};}};
}
