import * as T from 'three';
import {C,ramp,clamp,laneZ} from './flow14.js';
const TAU=Math.PI*2,rad=x=>x*Math.PI/180;
export const P=Object.freeze({stemRadius:.014,rearRollRadius:.021,frontRollRadius:.011,rearHalfSpacing:.026,wormRatio:20,pickupRadius:.034,headWheelRadius:.036,spinStart:.50,spinEnd:5.30,accelTime:.35,retractStroke:.14,scanStroke:.270,jetSpacing:.200,fanFullAngleDeg:32,fanNarrowAngleDeg:3,peelStandoff:.090,dryStandoff:.070,dryPitchDeg:25,stations:{1:{turns:6,azimuth:35,tangent:20,axisAngle:35,pressureMPa:.35},2:{turns:6,azimuth:-35,tangent:-20,axisAngle:45,pressureMPa:.43},3:{turns:3},5:{turns:4,azimuth:35,tangent:0},6:{turns:4,azimuth:-35,tangent:0}}});
export const rearRollX=-Math.sqrt((P.rearRollRadius+P.stemRadius)**2-P.rearHalfSpacing**2);
const integral=x=>x**6-3*x**5+2.5*x**4;
export function spinProgress(phase){const d=P.spinEnd-P.spinStart,a=P.accelTime,s=clamp(phase-P.spinStart,0,d),A=d-a;if(s<=a)return a*integral(s/a)/A;if(s<=d-a)return (s-a/2)/A;const z=s-(d-a);return (d-1.5*a+z-a*integral(z/a))/A;}
export function spinSpeed(phase){const d=P.spinEnd-P.spinStart,a=P.accelTime,s=phase-P.spinStart;if(s<=0||s>=d)return 0;return (ramp(s,0,a)-ramp(s,d-a,d))/(d-a);}
export function cropSpin(age){let turns=0;for(const [j,v]of Object.entries(P.stations)){const start=(2+Number(j))*8;turns+=v.turns*(age>=start+8?1:age<start?0:spinProgress(age-start));}return turns*TAU;}
export function carrierSpin(i,t){const k=Math.floor(t/8);let n=0;for(let c=0;c<k;c++)n+=P.stations[((c-i)%12+12)%12]?.turns??0;const j=((k-i)%12+12)%12;n+=(P.stations[j]?.turns??0)*spinProgress(t%8);return n*TAU;}
export function headState(j,t){const phase=t%8,v=P.stations[j],p=spinProgress(phase),retract=P.retractStroke*(1-ramp(phase,0,.35)+ramp(phase,5.30,5.85));return {phase,retract,progress:p,air:phase>=.60&&phase<=5.25,rpm:(v?.turns??0)*spinSpeed(phase)*60,scanY:C.rootY+P.scanStroke*(phase<=P.spinEnd?1-p:ramp(phase,5.90,8))};}
// Gamma is the incidence angle AT the cylindrical surface. Simply yawing a distant
// nozzle by gamma would miss a 28 mm stem. Solve the finite-radius line geometry.
export function jetPose(j,l,targetHeight=0,dry=false){const s=P.stations[j],alpha=rad(s.azimuth??0),gamma=rad(s.tangent??0),R=P.stemRadius+(dry?P.dryStandoff:P.peelStandoff),yaw=Math.asin(P.stemRadius/R*Math.sin(gamma)),hit=alpha+gamma-yaw,pitch=rad(dry?P.dryPitchDeg:90-s.axisAngle),origin=new T.Vector3(C.radius+R*Math.cos(alpha),0,laneZ(l)+R*Math.sin(alpha)),target=new T.Vector3(C.radius+P.stemRadius*Math.cos(hit),targetHeight,laneZ(l)+P.stemRadius*Math.sin(hit)),horizontal=Math.hypot(origin.x-target.x,origin.z-target.z);origin.y=targetHeight+horizontal*Math.tan(pitch);return {origin,target,direction:target.clone().sub(origin).normalize(),azimuth:alpha,hitAzimuth:hit,pitch,standoff:dry?P.dryStandoff:P.peelStandoff};}
export const airFlowEstimate=(gaugeMPa,diameterMM=2,Cd=.8)=>{const g=1.4,R=287.05,Tk=293.15,p0=gaugeMPa*1e6+101325,area=Math.PI*(diameterMM/2000)**2,mdot=Cd*area*p0*Math.sqrt(g/(R*Tk))*(2/(g+1))**((g+1)/(2*(g-1)));return {mass_kg_s:mdot,FAD_m3_min:mdot/1.204*60,assumptions:'理想气体临界流，Cd=0.8、20°C、等效孔径；不是厂家流量曲线或实测值'};};
export const processNotes=[
 '本版真实驱动葱体、双后滚轮、前从动轮、横轴与工位接触轮；自转在分度前停止，根端由低摩擦可换托条承重。',
 '去皮 A/B 每支两只轴向错列喷头，扫描 270 mm；名义每工位自转 6 圈，峰值约 81 rpm。喷头与葱轴夹角分别为 35° / 45°，方位错开 ±35°，表面切向入射 ±20°；这些是待试验的初始设计值。',
 '风刀 A/B 向下偏转 25°、方位分别 ±35°；每工位名义自转 4 圈。气流由鼓风机供给，水向根端和集水盘排走。',
 '去皮喷口约 90 mm、风刀约 70 mm 名义表面距离，均配 140 mm 径向退让。关气、停止自转、喷头退出与驱动脱开后，才允许转盘分度。',
 '覆盖图按名义喷幅 32°、28 mm 圆柱与确定性位姿计算；尚未计入夹具遮挡和真实叶片包络，不把几何命中率写成去皮率或除水率。',
 '去皮近端压力 0.35 / 0.43 MPa 仅为参考文献启发的初始工况；0.8 MPa 厂务供气经双路减压、过滤和阀组，实际压力、流量、损伤与残皮必须实料标定。'
];
