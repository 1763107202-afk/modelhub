import * as T from 'three';
export const C=Object.freeze({radius:1.22,rootY:1.04,pitch:.12,lanes:4,stations:12,cycle:8,dwell:6,duration:216,packet:.60,stock:16,magazineV:2.0,paperTray:false});
export const laneZ=l=>(l-1.5)*C.pitch;
export const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v));
export const smooth=x=>{x=clamp(x);return x*x*x*(10+x*(-15+6*x));};
export const cutAge=(l,k=0)=>{let a=0,b=1,w=(laneZ(l)+.32)/.64;for(let i=0;i<26;i++){const m=(a+b)/2;if(smooth(m)<w)a=m;else b=m;}return 9+.2*k+3.3*(a+b)/2;};
export const ramp=(t,a,b)=>smooth((t-a)/(b-a));
export const mix=(a,b,x)=>a+(b-a)*x;
export const stationAngle=j=>Math.PI-j*Math.PI/6;
export const stationQ=j=>new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),-stationAngle(j));
export const localPoint=(j,u,y,v=0)=>new T.Vector3(u,y,v).applyQuaternion(stationQ(j));
export const indexAt=t=>Math.floor(t/8)+ramp(t%8,6,8);
export const rotorAngle=t=>indexAt(t)*Math.PI/6;
const tiltQ=a=>new T.Quaternion().setFromAxisAngle(new T.Vector3(0,0,1),a);
const localPose=(j,u,y,v,tilt=0)=>({p:localPoint(j,u,y,v),q:stationQ(j).multiply(tiltQ(tilt))});
export function cradleMotion(kind,t){
 const p=t%8;
 if(kind==='load')return {u:mix(2.05,C.radius,ramp(p,3.1,4.1))+mix(0,2.05-C.radius,ramp(p,5.25,6)),y:1.06+.32*ramp(p,.5,1.2)-.34*ramp(p,2.6,3.1)+.34*ramp(p,6,6.5)-.32*ramp(p,7.3,8),tilt:-Math.PI/2*(1-ramp(p,1.2,2.6)+ramp(p,6.5,7.3)),open:1-ramp(p,0,.5)+ramp(p,4.8,5.25),toe:ramp(p,5.05,5.25)-ramp(p,5.65,5.85)};
 if(p<6)return {u:mix(1.65,C.radius,ramp(p,0,.75))+1.10*ramp(p,1.75,3.65),y:C.rootY+.024*ramp(p,1.5,1.75)+.096*ramp(p,2.1,2.7)-.102*ramp(p,4.9,5.3),tilt:Math.PI/2*ramp(p,3.65,4.9),open:1-ramp(p,.8,1.3)+ramp(p,5.35,5.8),toe:1-ramp(p,.8,1.05)+ramp(p,5.4,5.8)};
 const f=ramp(p,6.7,8);return {u:mix(2.32,1.65,f),y:1.058+.13*ramp(p,6,6.35)-.148*ramp(p,7.15,8),tilt:Math.PI/2*(1-ramp(p,6,6.7)),open:1,toe:1};
}
export const cradlePose=(kind,t,l=0)=>{const s=cradleMotion(kind,t);return localPose(kind==='load'?0:7,s.u,s.y,laneZ(l),s.tilt);};
export const magazineSide=n=>n%2?1:-1;
// Positive push; retract 80 mm before lifting so the bar clears the cassette ear.
export function pusherState(t,side){
 const origin=136+(side>0?8:0);if(t<origin)return {phase:-1,offset:0,lift:0};
 const phase=(t-origin)%16,D=C.magazineV-.85;
 const advance=D*ramp(phase,.2,1.4),retreat=.08*ramp(phase,1.4,1.6)+(D-.08)*ramp(phase,1.8,3.0);
 return {phase,offset:-side*(advance-retreat),lift:.34*(ramp(phase,1.6,1.8)-ramp(phase,3.1,3.4))};
}
export function collectionLift(b){const d=.014-Math.sqrt(.014**2-.011**2);return .16*(ramp(b,-6.5,-5.9)-ramp(b,-4.8,-4.0))+d*ramp(b,0,.30)+(.16-d)*ramp(b,.30,.85)-.16*ramp(b,2,2.8);}
export function rackPose(n,t){
 const age=t-n*8,b=age-128,side=magazineSide(n),v=side*.85;
 let u=9.02,y=1.044+collectionLift(b),z=v,tilt=Math.PI/2;
 if(n>=C.stock)return null;
 if(n>=2&&b< -7.8){let lifts=0;for(let k=0;k<6;k++)lifts+=ramp(t,137.5+(n%2)*8+k*16,138.5+(n%2)*8+k*16);y-=.128*(Math.floor(n/2)-1-lifts);z=side*C.magazineV;}
 else if(n>=2&&b< -6.6){z=mix(side*C.magazineV,v,ramp(b,-7.8,-6.6));}
 else if(b< -4.8){z=mix(v,0,ramp(b,-5.8,-4.8));}
 else if(b<1){z=0;}
 else if(b<2){z=mix(0,v,ramp(b,1,2));}
 if(b>=2){tilt=Math.PI/2*(1-ramp(b,2,5));u+=.24*ramp(b,5.3,6.2);y-=.013*ramp(b,6.2,6.5);if(b>=6.5)u=b<7.3?mix(9.26,9.80,ramp(b,6.5,7.3)):mix(9.80,13.60-.50*Math.floor(n/2),ramp(b,7.3,14));}
 return {...localPose(7,u,y,z,tilt),age,feet:ramp(b,5,5.3),u,y,v:z,tilt};
}
export const rackRoot=n=>new T.Vector3();
export const bagFinished=age=>age>=109.9;
export const trayPresent=age=>false;
export const cassetteFoodOffset=age=>.014-(.014-Math.sqrt(.014**2-.011**2))*ramp(age,128,128.30);
export function productPose(n,l,t){
 const age=t-n*8;
 if(age<0)return null;
 if(age<8)return {...localPose(0,mix(4.5,3.65,ramp(age,0,6))-mix(0,.85,ramp(age,6,8)),1.06,laneZ(l),-Math.PI/2),age,owner:'输送盘槽底＋上方限高带'};
 if(age<14)return {...localPose(0,2.8,1.06,laneZ(l),-Math.PI/2),age,owner:'槽底承托＋夹持带限位；端部切割'};
 if(age<16)return {...localPose(0,mix(2.8,2.05,ramp(age,14,16)),1.06,laneZ(l),-Math.PI/2),age,owner:'接驳托槽＋上压带'};
 if(age<20.5)return {...cradlePose('load',age-16,l),age,owner:'根端托叉承重＋上下两道分体笼扶持'};
 if(age<73.5){const j=indexAt(t)-(n+2);return {...localPose(j,C.radius,C.rootY,laneZ(l)),age,owner:'旋转托座：根底托条承重＋上下滚轮笼限位'};}
 if(age<77.85){const p=cradlePose('unload',age-72,l);return {...p,age,owner:age>=77.3?'接料带已接重，移载笼随后打开、托叉退出':'卸料托叉承重＋两道分体笼包围'};}
 if(age<80)return {...localPose(7,2.32,1.058,laneZ(l),Math.PI/2),age,owner:'可清洗全宽接料带承重，低导向槽限位；无纸托'};
 if(age<88)return {...localPose(7,2.32+1.38*ramp(age,80,83)+.62*ramp(age,86.2,87.85),1.058,laneZ(l),Math.PI/2),age,owner:'入口带暂存；横移小车回到窄距并停稳后才送料，完全接入后展距'};
 if(age<96){const b=age-88;return {...localPose(7,4.32+ramp(b,1.7,4.8),1.058,laneZ(l)+((l-1.5)*.60-laneZ(l))*ramp(b,0,1.5),Math.PI/2),age,owner:'展距小车实体皮带承重；先展距定位，再同步送入包装机'};}
 if(age<112){const b=age-96,u=5.32+.60*(Math.floor(b/8)+ramp(b%8,0,5.3));return {...localPose(7,u,1.058,(l-1.5)*.60,Math.PI/2),age,owner:'独立包装带/成形托板承托；平膜自动退卷、顶封与双端横封'};}
 if(age<120){const b=age-112,u=6.52+.88*ramp(b,0,2)+.88*ramp(b,3.4,6);return {...localPose(7,u,1.058,(l-1.5)*.60+(laneZ(l)-(l-1.5)*.60)*ramp(b,2.1,3.3),Math.PI/2),age,owner:'出料小车承托完整袋；全袋离开包装机后并距，再送入独立秤带'};}
 if(age<128){const u=8.28+.74*ramp(age,125.4,128);return {...localPose(7,u,1.058,laneZ(l),Math.PI/2),age,owner:age<125.4?'整袋仅由独立检重带承重；前后夹具与固定桥板退出受力链':'固定窄带经框底槽自动送框'};}
 const r=rackPose(n,t);if(!r)return null;
 return {p:r.p.clone().add(new T.Vector3(cassetteFoodOffset(age),0,laneZ(l)).applyQuaternion(r.q)),q:r.q.clone(),age,owner:age<128.3?'框底缓升接触并托起袋装葱体，固定窄带脱离受力链':age<134.5?'抬框离带后横移；框底托条承重、导框与锁销保持':'根端软托座承重，封边进入让位槽；双层框扶正、锁定支脚防倾倒'};
}
export const STAGES=[
 [0,'自动输送','根向一致的采收载盘自动接入，四槽并列；根端、茎体全程落在实体托面上。','infeed'],
 [8.5,'端部修整','托槽承重、上下压带夹稳，挡根梳定位后退让；切根和叶尖锯片横向移动，废料进入侧槽。','trim'],
 [16.3,'四联接管','先合分体笼，再用根端托叉起料；不是靠湿茎摩擦悬吊。','load'],
 [19.8,'送入旋转托座','托叉与根底托条交错插入；主笼到位确认后，源笼才松开。','load'],
 [25,'去皮 A','上下错列双喷头向根端扫描，喷头与葱轴夹角35°；双后滚轮带动葱体自转6圈，根底托条承重。','peel'],
 [33,'去皮 B','另一方位斜吹补充处理，轴向夹角45°；葱体再转6圈。转速未确认或喷头未退出时禁止分度。','peel'],
 [41,'清洗','固定喷管冲洗；污水与葱皮进入下方斜盘、滤篮及排污管。','wash'],
 [49,'沥水','先重力排水，降低风刀负荷；根端托条不离开。','wash'],
 [57,'风刀 A','风刀向下25°斜吹；葱体真实自转4圈，使各个朝向依次经过风幕。液滴落入集水盘。','dry'],
 [65,'风刀 B','另一方位复吹并再转4圈，避免始终只吹一面；喷幅与残水仍须实测，不代表叶鞘内部已干燥。','dry'],
 [72,'空笼接近停稳转盘','空笼在R1650mm外等待，转盘停稳后才径向接近。','unload'],
 [72.8,'托叉接根与收笼','根托叉接重，双层笼闭合；源托座暂不释放。','unload'],
 [73.35,'源夹具退让','接重与闭合确认后，源门才开始打开。','unload'],
 [73.5,'四联自动卸料','接料分体笼闭合、托叉接根，旋转主笼打开；先沿半径移出，再翻平。','unload'],
 [77.3,'接料带接重后松笼','移载笼先降至葱体底面接触实体带面，77.35秒才开始松笼；根托随后退出。','pack'],
 [82,'向外缓冲送料','保持120mm四列，先离开旋转卸料及服务柱包络，再进入展距段。','pack'],
 [90,'四列展距','窄距皮带小车从120mm展至600mm，产品保持落在承托带上；送料完成后空车复位。','pack'],
 [102,'顶封与前端横封','四列600mm间距，下置单层平膜卷、制动及张力辊供膜；成形口将裸葱包入膜内，顶封轮夹紧膜边后封接。','pack'],
 [110.5,'后端横封切断','连续侧封与前后横封围成完整袋体；袋膜保持靠闭合封口，不靠贴在湿葱上，也不需要纸托。','pack'],
 [115,'成袋并距','尾封完全离开包装出料带后横移，600mm并回120mm；随后送秤，空车返回。','pack'],
 [123,'独立整包检重','整袋完全进入独立称重带，夹具与前后输送带离开受力链；2 秒停留为设计值。','weigh'],
 [131.8,'整框翻直','框底先缓升接管，再上提160mm完全离带，横移后整框翻转；根端软托座通过袋膜承托根端，封边在旁侧让位槽内。','out'],
 [137,'载具直立输出','支脚展开并锁定，收集框下降到输送辊，向外缓存；产品留在框内直立，成品不消失。','out']
].map(([at,name,note,module])=>({at,name,note,module}));
export const stageAt=age=>[...STAGES].reverse().find(s=>age>=s.at)??STAGES[0];
export const FAULTS={infeed:{at:14,name:'来料/压带未确认'},load:{at:20.4,name:'主笼闭合未确认'},drive:{at:30,name:'从动轮未检测到自转'},unloadStop:{at:72,name:'卸料转盘停稳未确认'},unloadReceive:{at:73.3,name:'卸料接重/闭合未确认'},tray:{at:77.25,name:'裸料接料带未到位'},seal:{at:103.2,name:'封口温度/膜张力异常'},weight:{at:125,name:'检重超差'},rack:{at:129,name:'收集框未抬离/未锁紧'},full:{at:133.3,name:'收集区满位'}};
export const designNotes=[
 '输入接口为根向一致、尺寸分级的采收载盘/上游定向线。四联取料是自动动作；任意乱序缠绕散料的解缠与定向尚未验证。',
 '示例单支原料长 720 mm，修整后 530 mm，茎部名义直径 28 mm。可调范围、叶片摆动包络和夹伤阈值待实测。',
 '12 个分度工位，4 支/分度，设计节拍 8 s，理论 1800 支/h；不是实测合格产能。',
 '取消纸托耗材、料仓、升降和推托；裸料由可清洗输送面承托。单层平膜采用顶封＋双端横封，膜材防穿刺、保鲜和封口强度仍需实料验证。',
 '风刀只对表面除水；风量、过滤等级、吹扫时间、残水指标与葱体损伤需以实料试验确定。',
 '模型包含主要机架、轴系、传动、导轨、支承和固定管路；紧固件、密封、润滑、卫生细节及安全回路不等于生产图。',
 '本版是机构方案和确定性运动演示，不是刚柔耦合仿真；不能用来宣称零干涉、食品卫生认证或可直接投产。',
 '收集框需要下游清空、回洗与回供接口。演示含 16 框有限库存及满位停机；不宣称无限循环。'
];
