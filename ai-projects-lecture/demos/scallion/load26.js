import * as T from'three';import{cradlePose}from'./flow14.js';
// Point-mass translational lower bound only: no contact moment distribution, leaf dynamics or force validation.
const mass=1,g=new T.Vector3(0,-9.81,0),dt=.001,centreY=.265;
function pose(kind,t){const p=cradlePose(kind,t);return{p:p.p.clone().add(new T.Vector3(0,centreY,0).applyQuaternion(p.q)),q:p.q};}
export function inertialDemand26(kind,t){const a=pose(kind,t-dt),b=pose(kind,t),c=pose(kind,t+dt),acc=c.p.add(a.p).addScaledVector(b.p,-2).multiplyScalar(1/(dt*dt)),local=acc.sub(g).applyQuaternion(b.q.clone().invert());return{time:t,local_per_kg:local.toArray(),toe_per_kg:Math.max(0,local.y),friction_per_kg:Math.hypot(local.x,Math.min(0,local.y))};}
let peak=null;
for(const[kind,a,b]of[['load',16.5,20.5],['unload',73.5,77.3]])for(let i=0;i<=Math.floor((b-a)/.005);i++){const s=inertialDemand26(kind,a+i*.005);if(!peak||s.friction_per_kg>peak.friction_per_kg)peak={...s,kind};}
export const peakDemand26=Object.freeze(peak);
export function loadBudget26(normalSumN,massKg=.252,mu=.15,safetyFactor=2){const valid=[normalSumN,massKg,mu,safetyFactor].every(Number.isFinite)&&normalSumN>0&&massKg>0&&mu>=0&&safetyFactor>=1;const demandN=peak.friction_per_kg*massKg,requiredN=demandN*safetyFactor,capacityN=mu*normalSumN;return{valid,massKg,mu,safetyFactor,normalSumN,demandN,requiredN,capacityN,requiredMu:requiredN/normalSumN,necessaryCapacityPass:valid&&capacityN>=requiredN,releaseApproved:false,peak,scope:'质点平移必要条件；未计力矩分配、接触压强、柔性叶片和摩擦实测，数值通过也不允许候选整线释放'};}
