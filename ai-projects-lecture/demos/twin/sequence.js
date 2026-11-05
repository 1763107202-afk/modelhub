export const TAU=Math.PI*2;
export const SPEC={title:'双子星裂隙 Twin Rift',version:'方案 V2.0',duration:165,tilt:25,offset:2.3,seats:8,platformDiameter:11,railSpeedLimit:6.5,rotationLimit:1.5,cabin:[3.6,2.1,2.3],enclosure:22};
export const STAGES=[
 {start:0,end:20,name:'登舱 · 锁定',short:'登舱',detail:'站台静止，头肩压杠闭合，完成锁定自检。'},
 {start:20,end:45,name:'反向爬升',short:'爬升',detail:'双舱沿各自独立轨道反向起步，整机缓慢回转。'},
 {start:45,end:65,name:'中央掠过',short:'交错',detail:'双环前后错层，中央邻近区域将主动滚转回正。'},
 {start:65,end:90,name:'登顶 · 俯冲',short:'俯冲',detail:'轨道俯仰与座舱侧倾叠加，改变乘员视野。'},
 {start:90,end:120,name:'裂隙追逐',short:'高潮',detail:'双舱独立变速追逐；外侧净空区完成主动滚转。'},
 {start:120,end:145,name:'再次交错',short:'反超',detail:'相对相位发生变化，外侧回正后再次掠过。'},
 {start:145,end:165,name:'减速 · 回站',short:'回站',detail:'两舱减速归位，座舱主动滚转归零，回转平台对位停车。'}
];
export const MODES={explore:{label:'探索',factor:.54,bank:Math.PI/4,spin:false},stellar:{label:'星际',factor:1,bank:Math.PI,spin:false},rift:{label:'裂隙',factor:1,bank:TAU,spin:true}};
const tilt=25*Math.PI/180;
export const PATH={radiusX:6.5,radiusY:3.5,centerX:2.15,centerY:9.9,cabinOffset:2.2};
export function pointAt(theta,side){
 const s=side===0?-1:1,cx=side===0?-PATH.centerX:PATH.centerX;
 const x=PATH.radiusX*Math.sin(theta),y=-PATH.radiusY*Math.cos(theta);
 return [cx+Math.cos(tilt)*x-s*Math.sin(tilt)*y,PATH.centerY+s*Math.sin(tilt)*x+Math.cos(tilt)*y,side===0?-1.15:1.15];
}
export function tangentAt(theta,side){
 const s=side===0?-1:1,x=PATH.radiusX*Math.cos(theta),y=PATH.radiusY*Math.sin(theta);
 const dx=Math.cos(tilt)*x-s*Math.sin(tilt)*y,dy=s*Math.sin(tilt)*x+Math.cos(tilt)*y,n=Math.hypot(dx,dy);
 return [dx/n,dy/n,0];
}
const count=4096;
const arc=[0];
let last=pointAt(0,0);
for(let i=1;i<=count;i++){const p=pointAt(i/count*TAU,0);arc.push(arc.at(-1)+Math.hypot(...p.map((v,j)=>v-last[j])));last=p;}
export const TRACK_LENGTH=arc.at(-1);
export const STATION_THETA=Math.atan2(PATH.radiusX*Math.sin(tilt),PATH.radiusY*Math.cos(tilt));
export function thetaAtDistance(distance){
 const target=((distance%TRACK_LENGTH)+TRACK_LENGTH)%TRACK_LENGTH;
 let lo=0,hi=count;
 while(hi-lo>1){const m=(lo+hi)>>1;if(arc[m]>target)hi=m;else lo=m;}
 return (lo+(target-arc[lo])/(arc[hi]-arc[lo]))/count*TAU;
}
const smooth=u=>u*u*(3-2*u);
const speedKeys=[[0,0],[20,0],[45,3.5],[65,3.7],[90,4.8],[105,6.5],[120,5.4],[145,3.2],[165,0]];
const yawKeys=[[0,0],[20,0],[45,.5],[65,.8],[90,1],[120,1.2],[145,.8],[165,0]];
function keyed(t,keys){for(let i=0;i<keys.length-1;i++){const [a,va]=keys[i],[b,vb]=keys[i+1];if(t<=b)return va+(vb-va)*smooth(Math.max(0,(t-a)/(b-a)));}return keys.at(-1)[1];}
const step=.02,N=Math.round(SPEC.duration/step);
const modeTables={};
for(const mode of Object.keys(MODES)){
 const rows=[];let da=0,db=0,yaw=0,prevA=0,prevB=0,prevY=0;
 for(let i=0;i<=N;i++){
  const t=i*step,va=keyed(t,speedKeys)*MODES[mode].factor;
  const vb=va*(1+.075*Math.sin((t-20)/125*TAU));
  const vy=keyed(t,yawKeys)*TAU/60;
  if(i){da+=(va+prevA)*step/2;db+=(vb+prevB)*step/2;yaw+=(vy+prevY)*step/2;}
  rows.push({da,db,yaw,va,vb,vy});prevA=va;prevB=vb;prevY=vy;
 }
 const turnsA=Math.floor(da/TRACK_LENGTH),turnsB=Math.floor(db/TRACK_LENGTH);
 const scaleA=turnsA*TRACK_LENGTH/da,scaleB=turnsB*TRACK_LENGTH/db;
 const yawScale=Math.round(yaw/TAU)*TAU/yaw;
 modeTables[mode]=rows.map(r=>({da:r.da*scaleA,db:r.db*scaleB,yaw:r.yaw*yawScale,va:r.va*scaleA,vb:r.vb*scaleB,rpm:r.vy*yawScale*60/TAU}));
}
function distanceAtTheta(theta){const f=theta/TAU*count,i=Math.floor(f);return arc[i]+(arc[Math.min(count,i+1)]-arc[i])*(f-i);}
const stationDistance=distanceAtTheta(STATION_THETA);
export function advanceTheta(theta,distance){return thetaAtDistance(distanceAtTheta(theta)+distance);}
function timeAtDistance(d,side,mode){
 const rows=modeTables[mode],key=side===0?'da':'db';let lo=0,hi=N;
 while(hi-lo>1){const m=(lo+hi)>>1;if(rows[m][key]>d)hi=m;else lo=m;}
 const span=rows[hi][key]-rows[lo][key];return (lo+(span>0?(d-rows[lo][key])/span:0))*step;
}
function rollAt(theta,side,distance,mode){
 // A complete maneuver is selected at zone entry, so no time boundary can interrupt a roll.
 const minimum=Math.PI*1.5+Math.atan2(PATH.radiusY*Math.sin(tilt),PATH.radiusX*Math.cos(tilt));
 const half=Math.acos((6.35-PATH.centerX)/Math.hypot(PATH.radiusY*Math.sin(tilt),PATH.radiusX*Math.cos(tilt)));
 const aStart=minimum-half,aEnd=minimum+half;
 const start=side===0?aStart:TAU-aEnd,end=side===0?aEnd:TAU-aStart;
 if(theta<start||theta>end)return 0;
 const lap=Math.floor((distance+stationDistance+1e-8)/TRACK_LENGTH)*TRACK_LENGTH;
 const entry=lap+(side===0?distanceAtTheta(start):TRACK_LENGTH-distanceAtTheta(end))-stationDistance;
 const exit=lap+(side===0?distanceAtTheta(end):TRACK_LENGTH-distanceAtTheta(start))-stationDistance;
 const tEntry=timeAtDistance(entry,side,mode),tExit=timeAtDistance(exit,side,mode);
 if(tEntry<65||tExit>145)return 0;
 const u=side===0?(theta-start)/(end-start):(end-theta)/(end-start);
 if(mode==='rift'&&tEntry>=90&&tEntry<=130)return TAU*smooth(u);
 const bank=mode==='explore'?Math.PI/4:(tEntry<90?Math.PI/2:Math.PI);
 return bank*Math.sin(Math.PI*u)**2;
}
export function stateAt(time,mode='stellar'){
 if(!MODES[mode])throw new Error('Unknown mode');
 const t=Math.max(0,Math.min(165,time)),i=Math.min(N-1,Math.floor(t/step)),u=(t-i*step)/step;
 const a=modeTables[mode][i],b=modeTables[mode][i+1],r={};
 for(const k of Object.keys(a))r[k]=a[k]+(b[k]-a[k])*u;
 r.va=Math.max(0,r.va);r.vb=Math.max(0,r.vb);r.rpm=Math.max(0,r.rpm);
 const thetaA=thetaAtDistance(r.da+stationDistance),thetaB=thetaAtDistance(-r.db-stationDistance);
 return {...r,time:t,thetaA,thetaB,rollA:rollAt(thetaA,0,r.da,mode),rollB:rollAt(thetaB,1,r.db,mode),stage:Math.min(6,STAGES.findIndex(s=>t<s.end)===-1?6:STAGES.findIndex(s=>t<s.end)),lock:t>=12,restraintBlend:smooth(Math.max(0,Math.min(1,(t-4)/8)))};
}
