import {buildFullProgram,flowState} from './workflow.js';
// SI units. All moving CAD groups are positioned through declared joints.
export function ramp(d,v,a,t){const S=Math.abs(d),sg=Math.sign(d);if(S<1e-12)return {q:0,T:0,velocity:0};let ta=Math.min(v/a,Math.sqrt(S/a)),vp=a*ta,tc=Math.max(0,S/vp-ta),T=2*ta+tc;t=Math.max(0,Math.min(T,t));let q=t<ta?.5*a*t*t:t<ta+tc?.5*a*ta*ta+vp*(t-ta):S-.5*a*(T-t)**2;return {q:sg*q,T,velocity:sg*(t<ta?a*t:t<ta+tc?vp:a*(T-t))};}
export function duration(d,v=.1,a=.5){return ramp(d,v,a,1e9).T;}
export function makeProgram(data,id){
 if(id==='full')return buildFullProgram(data,duration);
 const homes=Object.fromEntries(data.joints.map(j=>[j.name,j.home??0]));homes.main_index=0;homes.magazine_index=0;homes.outfeed_index=0;
 const steps=[];let time=0;
 const move=(name,to,label,v=.1,a=.5)=>{if(name==='load_axis')v=Math.min(v,.075);if(name==='unload_axis')v=Math.min(v,.070);if(name==='trim_axis')v=Math.min(v,.04);if(name==='seal_axis')v=Math.min(v,.030);const from=homes[name]??0,dt=duration(to-from,v,a);steps.push({name,from,to,start:time,end:time+dt,label,v,a});homes[name]=to;time+=dt;};
 const hold=(dt,label)=>{steps.push({start:time,end:time+dt,label});time+=dt;};
 // All programs start at the actual assembled home configuration.
 if(['assembly','drive'].includes(id)){hold(.5,'空载复核 · 升降门在上位保持');move('main_index',-Math.PI/3,'解除锁止 · 60°受控分度',.35,.4);hold(.8,'到位保持 · 各工位允许进入');}
 if(id==='axis'){move('load_axis',.70,'进入料盘交接位');hold(.4,'名义取料位 · 夹持高度错开主夹');move('load_axis',0,'丝杠正转 · 径向进入');hold(.6,'空载交接复核');move('load_axis',1.10,'退出料盘并到停车位');}
 if(id==='root'){hold(.5,'原料由杯托与夹具支承');move('root_cut',.09,'φ80气缸伸出 · 导向双刀切根',.06,.3);hold(.4,'反刃承受剪切反力');move('root_cut',0,'退刀 · 刀刃离开原料',.06,.3);hold(.5,'允许料盘分度');}
 if(id==='magazine'){hold(.5,'刀架与取料夹在退出位');move('magazine_index',Math.PI/6,'上料盘30°空载分度',.5,1);hold(.8,'杯托到位保持');}
 if(id==='trim'){move('trim_axis',0,'剪叶架进入');move('trim_counter_shift',0,'反刃侧向就位',.05,.3);move('trim_cut',.08,'导向刀架剪叶',.06,.3);move('trim_cut',0,'剪叶刀退回',.06,.3);move('trim_counter_shift',.25,'反刃侧向退让',.05,.3);move('trim_axis',data.linear_axes.find(a=>a.name==='trim_axis').stroke,'剪叶架退出');}
 if(id==='peel'){move('peel_scan',.030,'先下降30 mm清出保膜夹片',.08,.5);move('peel_radial',0,'低位径向进入');move('peel_scan',0,'上升至扫描起点',.08,.5);for(let l=0;l<2;l++)for(const s of [-1,1])move(`nozzle_${l}_${s}`,0,'开合缸回程 · 半环围合',.08,.5);move('peel_scan',.30,'1605丝杠驱动 · 向下扫描',.08,.5);hold(.3,'扫描下端');move('peel_scan',0,'竖直滑台上行',.08,.5);for(let l=0;l<2;l++)for(const s of [-1,1])move(`nozzle_${l}_${s}`,.065,'半环打开 · 释放转位空间',.08,.5);move('peel_scan',.030,'低位退出准备',.08,.5);move('peel_radial',.65,'整体径向退出');move('peel_scan',0,'高度归位',.08,.5);}
 if(id==='clamp'){for(let l=0;l<2;l++)for(const s of [-1,1])move(`grip_0_${l}_jaw_${s}`,.018,'气缸开夹 · 双导杆约束',.03,.3);hold(.6,'保持开口 / 物料另有支承');for(let l=0;l<2;l++)for(const s of [-1,1])move(`grip_0_${l}_jaw_${s}`,0,'低压闭合 · 柔性垫接触',.03,.3);}
 if(id==='wash'){move('wash_flap_-1',0,'隔水升降门下降',.20,.6);move('wash_flap_1',0,'隔水升降门下降',.20,.6);move('wash_axis',0,'喷淋与风刀组件进入');hold(2,'冲洗 · 废水落入独立接水盘');hold(2,'关闭水阀 · 风刀吹干');move('wash_axis',.55,'组件退回 · 准备转位');move('wash_flap_-1',1,'隔水门上升 · 留出转位空间',.20,.6);move('wash_flap_1',1,'隔水门上升 · 留出转位空间',.20,.6);}
 if(id==='weigh'){move('weigh_axis',0,'称重座径向进入');move('weigh_lift',.04,'导向缸抬升40 mm · 杯底承接',.03,.5);for(let l=0;l<2;l++)for(const s of [-1,1])move(`grip_4_${l}_jaw_${s}`,.018,'主夹松开 · 载荷转至传感器',.03,.3);hold(1.2,'双通道独立称重 · 静置采样');for(let l=0;l<2;l++)for(const s of [-1,1])move(`grip_4_${l}_jaw_${s}`,0,'主夹重新夹持',.03,.3);move('weigh_lift',0,'升降缸下降 · 杯托离开物料',.03,.5);move('weigh_axis',.42,'径向滑台退出');}
 if(id==='outfeed'){move('unload_axis',0,'卸料夹具进入空载交接位');hold(.4,'错层交接位置');move('unload_axis',.75,'移向成品盘杯托位');hold(.4,'成品盘交接位置');move('unload_axis',1.15,'卸料夹具退出回转区域');hold(.5,'成品盘双支承保持');move('outfeed_index',Math.PI/6,'30°分度 · 电机与盘轴同轴驱动',.5,1);hold(.8,'杯托到位 · 保持');}
 if(['wrap','seal'].includes(id)){
  if(id==='seal'){for(let l=0;l<2;l++)for(const side of [-1,1])move(`unload_grip_${l}_jaw_${side}`,.018,'卸料夹打开',.03,.3);move('unload_axis',0,'卸料架进入待料位 · 清出封口通道');}
  move(id+'_axis',0,'径向进入');
  for(const [to,label]of [[0,'左右旋丝杠同步合口'],[id==='wrap'?.24:.08,'开口退让']]){const targets=[-1,1].map(side=>({name:id+'_jaw11_'+side,from:homes[id+'_jaw11_'+side],to,v:.01,a:.08})),dt=duration(id==='wrap'?.24:.08,.01,.08);steps.push({start:time,end:time+dt,label,targets});time+=dt;for(const x of targets)homes[x.name]=to;if(to===0)hold(1,'封口保持 / 工艺参数待试验');}
  move(id+'_axis',id==='seal'?1.60:.75,'径向退出');if(id==='seal')move('unload_axis',1.15,'卸料架退出');
 }
 if(id==='utility'){hold(2,'静止配气与旋转夹具气路分开');hold(2,'剥皮 / 清水 / 排水接口');}
 if(time===0)hold(2,'静止装配');
 return {id,steps,duration:time,initial:Object.fromEntries(data.joints.map(j=>[j.name,j.home??0]))};
}
export function evaluate(program,data,t){
 const q={...program.initial};let label='装配位置';
 for(const s of program.steps){if(t<s.start)break;label=s.label;for(const m of s.targets??(s.name?[s]:[])){const v=ramp(m.to-m.from,m.v,m.a,t-s.start);q[m.name]=m.from+v.q;}if(t<=s.end)break;}
 for(const side of [-1,1])q['wash_gate_motor_'+side]=((q['wash_flap_'+side]??1)-1)/.022;
 for(const a of data.linear_axes)q[a.name+'_screw']=2*Math.PI*((q[a.name]??a.home)-a.home)/a.lead;
 for(const id of ['wrap','seal'])q[id+'_jaw_rotation11']=2*Math.PI*((q[id+'_jaw11_1']??(id==='wrap'?.24:.08))-(id==='wrap'?.24:.08))/.003;
 for(const lane of [0,1])q['seat_screw_turn13_'+lane]=2*Math.PI*((q['seat_guide13_'+lane+'_1']??.035)-.035)/.002;
 q.trim_counter_rotation11=2*Math.PI*((q.trim_counter_shift??.25)-.25)/.003;
 // Gate upper positions are required before the main carousel may index.
 return {q,label,flow:flowState(program,t),safeToIndex:Math.abs((q.infeed_X12??.95)-.95)<1e-8&&Math.abs((q.infeed_settle12??.53)-.53)<1e-8&&Math.abs(q.infeed_turn12??0)<1e-8&&Math.abs((q.trim_counter_shift??.25)-.25)<1e-8&&['wrap','seal'].every(id=>[-1,1].every(side=>Math.abs((q[id+'_jaw11_'+side]??(id==='wrap'?.24:.08))-(id==='wrap'?.24:.08))<1e-8))&&Math.abs(q.weigh_lift??0)<1e-8&&Math.abs(q.unload_Z12??0)<1e-8&&[-1,1].every(s=>Math.abs((q['wash_flap_'+s]??1)-1)<1e-8)&&data.linear_axes.filter(a=>!['peel_scan','unload_Z12','infeed_X12'].includes(a.name)).every(a=>Math.abs((q[a.name]??a.home)-a.stroke)<1e-8)&&data.joints.filter(j=>j.name.startsWith('grip_')&&j.type==='prismatic').every(j=>Math.abs(q[j.name]??0)<1e-8)};
}
