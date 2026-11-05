// Candidate operating envelope. All values are design assumptions until real-food trials.
export const A24=Object.freeze({minDiameter:18,maxDiameter:34,maxBow:4,gripSpan:200,guideMin:-14,guideMax:10,gateStroke:42,rearR:21,frontR:11,rearZ:26,wire:.45,coilMean:5.5,activeTurns:20,totalTurns:22,freeLength:50,G:70000,nominalCoilLength:25});
export const rearX24=-Math.sqrt((21+14)**2-26**2);
export function clamp24(diameter=28,bow=0){
 const r=diameter/2,radicand=(r+21)**2-26**2,cx=radicand>=0?rearX24+Math.sqrt(radicand):NaN,q=cx+r+11-25,L=25-q,k=A24.G*A24.wire**4/(8*A24.coilMean**3*A24.activeTurns),F=k*(50-L),solid=A24.totalTurns*A24.wire;
 const valid=Number.isFinite(q)&&diameter>=18&&diameter<=34&&bow>=0&&bow<=4&&q>=-14&&q<=10&&L>solid+2;
 const bowAtGuard=bow*Math.sin(Math.PI*25/200),guardInnerX=25,stemFrontAtGuard=cx+r+bowAtGuard;
 return {diameter,bow,r,cx,q,coilLength:L,coilForce:F,stiffness:k,solidHeight:solid,tiltDeg:Math.atan(Math.PI*bow/200)*180/Math.PI,guardFrontClearance:guardInnerX-stemFrontAtGuard,openSideClearance:42-16-(r+bow),captureCornerGap:16,minRetainingMargin:diameter-16,allowed:valid&&stemFrontAtGuard<25,why:diameter<18||diameter>34?'直径超出本轮设计范围':bow>4?'弓高超出本轮设计范围':!valid?'导向行程/弹簧工作长度超限':'初步几何范围内；尚需实料标定'};
}
export function handover24(stage,signals={}){
 if(!['load','unload','belt'].includes(stage))return {release:false,missing:['unknown_stage'],rule:'未知交接阶段禁止释放'};
 const need=stage==='load'?['root_supported','receiver_closed','source_ready']:stage==='unload'?['receiver_toe','receiver_closed','rotor_stopped']:['belt_ready','product_supported'];
 const missing=need.filter(k=>signals[k]!==true);return {release:missing.length===0,missing,rule:'接收方接重并闭合确认后，才允许释放源夹具'};
}
export function screening24(items){const cases=items.map(v=>clamp24(v.diameter,v.bow));return {feed:items.length===4&&cases.every(x=>x.allowed),cases,action:items.length===4&&cases.every(x=>x.allowed)?'整批进站许可（设计逻辑）':'整批禁止进站；请求上游回送/重分级，回送配套未建模'};}
