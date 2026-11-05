// Engineering assumptions, never sensor measurements. F is force per finger.
export function gripBudget({mass=.25,mu=.10,pressureMPa=.18,boreMM=25,efficiency=.70,acceleration=.30,safety=4,contactFraction=.5}={}){
 if(![mass,mu,pressureMPa,boreMM,efficiency,acceleration,safety,contactFraction].every(Number.isFinite)||mass<=0||mu<=0||pressureMPa<=0||boreMM<=0||efficiency<=0||efficiency>1||acceleration<0||safety<1||contactFraction<=0||contactFraction>1)return {valid:false,forceN:0,requiredPerFingerN:0,margin:0,maxMassKg:0,averageContactKPa:0,passesAssumedSlip:false,bruiseTested:false,measured:false};
 const force=pressureMPa*1e6*Math.PI*(boreMM/1000)**2/4*efficiency,load=mass*(9.81+acceleration),capacity=2*mu*force;
 return {valid:true,mass,mu,pressureMPa,boreMM,efficiency,acceleration,safety,forceN:force,requiredPerFingerN:load*safety/(2*mu),margin:capacity/(load*safety),maxMassKg:capacity/(safety*(9.81+acceleration)),averageContactKPa:force/(.045*.040*contactFraction)/1000,passesAssumedSlip:capacity>=load*safety,bruiseTested:false,measured:false};
}
export const FAULTS={empty:'夹空 / 夹爪位置不在有料窗口',cup:'杯底未检测到载荷',pressure:'夹持气压不足',slip:'轴向滑移超限',receiver:'主夹未确认接管',film:'夹膜未夹到膜',band:'束口带未确认闭合'};
// These are review gates inserted in the nominal program; a real controller must
// acquire the signals, debounce, timeout and handle power-loss independently.
export function retentionGates(program){
 const find=s=>program.steps.find(x=>x.label.includes(s))?.start;
 return [
 {id:'empty',at:find('夹爪位置在有料窗口'),phase:'infeed',signals:['双通道有料','夹爪位置有料窗口','夹持压力许可','根端止挡到位'],holds:'托叉和两点托架承重；翻转未启动',action:'保持夹爪与托叉，停止输送，不翻转'},
 {id:'cup',at:find('托杯接触载荷'),phase:'infeed',signals:['根端存在','杯托接触载荷','上部导向夹就绪'],holds:'翻转夹和根端托叉继续保持',action:'不退叉、不松夹，停在接料位'},
 {id:'pressure',at:find('取料夹：有料位置窗口'),phase:'root',signals:['取料夹位置有料窗口','夹持压力许可','物料存在'],holds:'原料仍由杯托和导向夹支承',action:'禁止切根，原支承保持'},
 {id:'slip',at:find('取料夹：有料位置窗口'),phase:'root',signals:['轴向位移稳定','夹持压力许可','有料位置窗口'],holds:'原托杯与导向夹仍在保护物料',action:'滑移报警，禁止切根和移载'},
 {id:'film',at:find('夹膜有料与位置确认'),phase:'wrap',signals:['夹膜有料','夹膜指位置','成袋断膜完成'],holds:'成形器继续保持；袋子尚未悬空转移',action:'成形器不打开、不退出'},
 {id:'band',at:find('封接保持'),phase:'band',signals:['袋口已收拢','带口存在','封接位置确认'],holds:'原夹膜指继续夹住袋口',action:'不撤夹膜、不转位；封接缺陷实物需复检'},
 {id:'receiver',at:find('主夹夹持位置与压力确认'),phase:'load',signals:['主夹有料位置窗口','主夹压力许可','轴向位移稳定'],holds:'取料夹仍保持，主夹不单独承重',action:'不松取料夹、不分度，停机待处理'}
 ].filter(g=>Number.isFinite(g.at));
}
export function gateStatus(program,t,fault='none'){
 const gates=retentionGates(program),g=gates.find(x=>x.id===fault),blocked=!!g&&t>=g.at;
 return {blocked,gate:blocked?g:null,limit:g?.at??Infinity,simulated:true};
}
