import {PWMController} from './pwm.mjs';
import {compile,ArduinoVM,CodeError} from './interpreter.mjs';
export const SCALE=.003;
export const ARM_MOUNT_Z=.085;
export const pxToWorld=(x,z)=>({x:(x-580)*SCALE,z:(z-850)*SCALE});
export const worldToPx=(x,z)=>({x:x/SCALE+580,z:z/SCALE+850});
export const DEFAULT_CONFIG={maxSpeed:.52,wheelbase:.21,sensorSpacing:.026,sensorForward:.17,lineWidth:.039,blackHigh:true,reverseSensors:false,autoWiring:true,motorSides:['left','left','right','right'],motorReverse:[false,false,false,false],sensorPins:[33,32,35,34],motorPins:[[2,4,16],[17,5,18],[19,21,22],[23,12,13]],servoPins:[14,26,25,27],servoSpeed:260,baseZero:90,baseDir:1,leftZero:80,leftDir:1,rightZero:-35,rightDir:-1,gripOpen:140,gripClosed:155,upperLength:.15,foreLength:.17,showTrail:true,showSensors:true};
export const START={...pxToWorld(190,1260),theta:-Math.PI/2};
export const PATH=[{a:[190,1380],b:[190,485]},{c:[390,485],r:200,a:Math.PI,b:1.5*Math.PI},{a:[390,285],b:[790,285]},{c:[790,485],r:200,a:-Math.PI/2,b:0},{a:[990,485],b:[990,1253]},{c:[790,1253],r:200,a:0,b:Math.PI/2},{a:[790,1453],b:[143,1453]}];
export const MARKERS=[{a:[76,540],b:[245,540],label:'01'},{a:[666,230],b:[666,342],label:'02'},{a:[934,938],b:[1045,938],label:'03'},{a:[934,1253],b:[1087,1253],label:'04'},{a:[374,1396],b:[374,1509],label:'05'},{a:[143,1396],b:[143,1509],label:'FINISH'}];
function cleanCode(source){return source.replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\/\/[^\n]*|\/\*[\s\S]*?\*\//g,s=>s.startsWith('/')?' ':s.startsWith('"')?'""':"''");}
function inferWiring(source,base){
 const code=cleanCode(source),raw=new Map(),values=new Map(),order=[];
 for(const m of code.matchAll(/^\s*#\s*define\s+([A-Za-z_]\w*)\s+([^\s()]+).*$/gm)){raw.set(m[1],m[2]);order.push(m[1]);}
 for(const m of code.matchAll(/\b(?:const\s+|constexpr\s+)?(?:unsigned\s+)?(?:int|long|short|byte|uint8_t|uint16_t|uint32_t|size_t)\s+([A-Za-z_]\w*)\s*=\s*([A-Za-z_]\w*|0[xX][0-9a-fA-F]+|\d+)\s*;/g)){raw.set(m[1],m[2]);order.push(m[1]);}
 const resolve=(token,seen=new Set())=>{if(token==null)return null;if(/^0[xX][0-9a-fA-F]+$/.test(token)||/^\d+$/.test(token)){const n=Number(token);return Number.isInteger(n)&&n>=0&&n<=39?n:null;}if(seen.has(token)||!raw.has(token))return null;return resolve(raw.get(token),new Set([...seen,token]));};
 for(const name of order){const v=resolve(name);if(v!==null)values.set(name,v);}
 const pinOf=x=>resolve(x);
 const uniquePins=(re)=>{const out=[];for(const m of code.matchAll(re)){const p=pinOf(m[1]);if(p!==null&&!out.includes(p))out.push(p);}return out;};
 let sensors=Array(4).fill(null);
 for(const [name,pin] of values){let m=name.match(/^(?:S|SENSOR|SENSOR_|IR|IR_|GRAY|GRAY_|GREY|GREY_|LINE|LINE_|TRACK|TRACK_)([1-4])$/i);if(m)sensors[Number(m[1])-1]=pin;}
 if(sensors.some(x=>x===null)){const reads=uniquePins(/\b(?:digitalRead|analogRead)\s*\(\s*([A-Za-z_]\w*|\d+)/g);if(reads.length===4)sensors=reads;}
 const groups=Array.from({length:4},()=>({en:null,a:null,b:null}));
 const letters='ABCD';
 for(const [name,pin] of values){
  let m=name.match(/^(?:EN|PWM)_?([ABCD])$/i);if(m){groups[letters.indexOf(m[1].toUpperCase())].en=pin;continue;}
  m=name.match(/^(?:MOTOR|M)?_?([1-4])_?(?:EN|PWM)$/i);if(m){groups[Number(m[1])-1].en=pin;continue;}
  m=name.match(/^(?:EN|PWM)_?([1-4])$/i);if(m){groups[Number(m[1])-1].en=pin;continue;}
  m=name.match(/^IN([1-8])$/i);if(m){const n=Number(m[1])-1,g=Math.floor(n/2);groups[g][n%2?'b':'a']=pin;continue;}
  m=name.match(/^([ABCD])_?IN_?([12])$/i);if(m){const g=letters.indexOf(m[1].toUpperCase());groups[g][m[2]==='1'?'a':'b']=pin;continue;}
  m=name.match(/^(?:MOTOR|M)?_?([1-4])_?IN_?([12])$/i);if(m){const g=Number(m[1])-1;groups[g][m[2]==='1'?'a':'b']=pin;}
 }
 let complete=groups.filter(g=>g.en!==null&&g.a!==null&&g.b!==null);
 if(![2,4].includes(complete.length)){
  const pwm=uniquePins(/\b(?:analogWrite|ledcAttachPin|ledcAttach|ledcAttachChannel)\s*\(\s*([A-Za-z_]\w*|\d+)/g);
  const dirs=uniquePins(/\bdigitalWrite\s*\(\s*([A-Za-z_]\w*|\d+)/g).filter(p=>!pwm.includes(p));
  if(pwm.length===4&&dirs.length>=8)complete=pwm.map((en,i)=>({en,a:dirs[i*2],b:dirs[i*2+1]}));
  else if(pwm.length===2&&dirs.length>=4)complete=pwm.map((en,i)=>({en,a:dirs[i*2],b:dirs[i*2+1]}));
 }
 const next={...base};const notes=[];
 if(sensors.every(Number.isInteger)&&new Set(sensors).size===4){next.sensorPins=sensors;notes.push('4 路灰度');}
 if(complete.length===4){next.motorPins=complete.map(g=>[g.en,g.a,g.b]);notes.push('4 路电机');}
 else if(complete.length===2){next.motorPins=[[complete[0].en,complete[0].a,complete[0].b],[complete[0].en,complete[0].a,complete[0].b],[complete[1].en,complete[1].a,complete[1].b],[complete[1].en,complete[1].a,complete[1].b]];notes.push('2 路电机（自动映射为左右双轮）');}
 const servo=[...base.servoPins],seenServo=new Set();
 for(const m of code.matchAll(/\b([A-Za-z_]\w*)\s*\.\s*attach\s*\(\s*([A-Za-z_]\w*|\d+)/g)){const obj=m[1].toLowerCase(),pin=pinOf(m[2]);if(pin===null)continue;let i=-1;if(/base|zhuan|rotate|turn/.test(obj))i=0;else if(/left|shoulder|big|upper/.test(obj))i=1;else if(/right|elbow|small|fore/.test(obj))i=2;else if(/grip|claw|zhua|hand/.test(obj))i=3;if(i>=0&&!seenServo.has(i)){servo[i]=pin;seenServo.add(i);}}
 if(seenServo.size){next.servoPins=servo;notes.push(`${seenServo.size} 路舵机`);}
 return {config:next,summary:notes.length?`已自动识别接线：${notes.join('、')}`:''};
}
function segmentDistance(x,y,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy)));return Math.hypot(x-a[0]-dx*t,y-a[1]-dy*t);}
export function trackDistance(x,z,markers=true){const p=worldToPx(x,z);let d=Infinity;for(const s of [...PATH,...(markers?MARKERS:[])]){if(s.c){let a=Math.atan2(p.z-s.c[1],p.x-s.c[0]);while(a<s.a)a+=Math.PI*2;if(a<=s.b)d=Math.min(d,Math.abs(Math.hypot(p.x-s.c[0],p.z-s.c[1])-s.r));else d=Math.min(d,Math.hypot(p.x-s.c[0]-Math.cos(s.a)*s.r,p.z-s.c[1]-Math.sin(s.a)*s.r),Math.hypot(p.x-s.c[0]-Math.cos(s.b)*s.r,p.z-s.c[1]-Math.sin(s.b)*s.r));}else d=Math.min(d,segmentDistance(p.x,p.z,s.a,s.b));}return d*SCALE;}
export function armPoints(angles,config){
 const [base,left,right,grip]=angles;
 const az=(base-config.baseZero)*config.baseDir*Math.PI/180;
 const p1=(config.leftZero+(left-90)*config.leftDir)*Math.PI/180;
 const p2=(config.rightZero+(right-90)*config.rightDir)*Math.PI/180;
 const add=(p,r,y)=>({r:p.r+r,y:p.y+y});
 const a={r:0,y:.315};
 const b=add(a,Math.cos(p1)*config.upperLength,Math.sin(p1)*config.upperLength);
 const c=add(b,Math.cos(p2)*config.foreLength,Math.sin(p2)*config.foreLength);
 // Base-mounted second servo drives the elbow through a closed parallel linkage.
 const crank=.042;
 const d=add(a,Math.cos(p2)*crank,Math.sin(p2)*crank);
 const e=add(b,Math.cos(p2)*crank,Math.sin(p2)*crank);
 // A second pair of parallelograms keeps the gripper mounting plate level.
 const offset={r:-.034,y:.016};
 const h=add(a,offset.r,offset.y),j=add(b,offset.r,offset.y),k=add(c,offset.r,offset.y);
 const opening=Math.max(0,Math.min(1,(grip-config.gripClosed)/(config.gripOpen-config.gripClosed||1)));
 const gripCenter=add(c,.091,-.008);
 return {a,b,c,d,e,h,j,k,az,p1,p2,opening,crank,gripCenter};
}
export class Simulation{
 constructor(config={}){this.config={...structuredClone(DEFAULT_CONFIG),...config};this.pose={...START};this.initialPose={...START};this.running=false;this.manualSensors=null;this.logs=[];this.serialBuffer='';this.listeners=new Set();this.wiringSummary='';this.reset();}
 reset(){this.time=0;this.pose={...this.initialPose};this.pins={};this.modes={};this.pwm={};this.pwmController=new PWMController((pin,duty,line)=>{this.pwm[pin]=duty;if(!this.config.motorPins.some(p=>p[0]===pin)&&!this.warningPins.has('pwm'+pin)){this.warningPins.add('pwm'+pin);this.log('warning',`GPIO ${pin} 的 PWM 未连接模型电机 EN，请在「校准参数 → GPIO 接线」中同步引脚`);}});this.targets=[90,90,90,140];this.angles=[90,90,90,140];this.motor=[0,0,0,0];this.wheelAngles=[0,0,0,0];this.trail=[];this.distance=0;this.velocity=0;this.crossings=0;this.lastAll=false;this.lastCross=-Infinity;this.finished=false;this.error=null;this.logs=[];this.serialBuffer='';this.warningPins=new Set();this.objects=[];this.held=-1;this.sample();if(this.source){try{this.vm=new ArduinoVM(compile(this.source),this.hardware());}catch(e){this.error=e;this.vm=null;}}else this.vm=null;this.running=false;}
 hardware(){return {io:(name,args,line)=>this.io(name,args,line),servo:(pin,angle)=>{const i=this.config.servoPins.indexOf(pin);if(i>=0)this.targets[i]=angle;else if(!this.warningPins.has('s'+pin)){this.warningPins.add('s'+pin);this.log('warning',`GPIO ${pin} 未连接模型舵机，请在参数中调整接线`);}},serial:(name,args)=>{if(name==='begin'||name==='flush')return;let txt=args.map(v=>String(v)).join(name==='printf'?' ':'');this.serialBuffer+=txt;if(name==='println'||this.serialBuffer.includes('\n')||this.serialBuffer.length>300){this.log('serial',this.serialBuffer.slice(0,300));this.serialBuffer='';}},fail:e=>{this.error=e;this.running=false;this.motor=[0,0,0,0];this.log('error',e.message);}};}
 io(name,a,line){if(name.startsWith('ledc')||name.startsWith('analogWrite'))return this.pwmController.io(name,a,line);const pin=Number(a[0]);if(!Number.isInteger(pin)||pin<0||pin>39)throw new CodeError(`无效的 GPIO ${a[0]}`,line);if(name==='pinMode'){this.modes[pin]=a[1];return 0;}if(name==='digitalRead'||name==='analogRead'){let i=this.config.sensorPins.indexOf(pin);if(i>=0)return name==='digitalRead'?this.sensors[i]:this.sensors[i]?4095:0;return this.pins[pin]??0;}if(name==='digitalWrite')this.pins[pin]=a[1]?1:0;if(name==='analogWrite'){if(!Number.isFinite(Number(a[1])))throw new CodeError('PWM 需要数字',line);this.pwm[pin]=Math.max(0,Math.min(255,Math.trunc(a[1])));}return 0;}
 load(source){const ast=compile(source); // Validate before replacing a running image.
 this.wiringSummary='';if(this.config.autoWiring!==false){const inferred=inferWiring(source,this.config);this.config=inferred.config;this.wiringSummary=inferred.summary;}
 this.source=source;this.reset();this.vm=new ArduinoVM(ast,this.hardware());this.log('info','程序已载入；运行 setup() 后循环执行 loop()');if(this.wiringSummary)this.log('info',this.wiringSummary);return true;}
 log(type,text){this.logs.push({time:this.time,type,text});if(this.logs.length>140)this.logs.shift();}
 sample(){const c=this.config,f={x:Math.cos(this.pose.theta),z:Math.sin(this.pose.theta)},left={x:f.z,z:-f.x};this.sensorPositions=Array.from({length:4},(_,i)=>{const j=c.reverseSensors?3-i:i,offset=(1.5-j)*c.sensorSpacing;return {x:this.pose.x+f.x*c.sensorForward+left.x*offset,z:this.pose.z+f.z*c.sensorForward+left.z*offset};});this.sensors=this.manualSensors?[...this.manualSensors]:this.sensorPositions.map(p=>{const black=trackDistance(p.x,p.z)<=c.lineWidth/2;return +(c.blackHigh?black:!black);});}
 getMotorOutputs(){return this.config.motorPins.map(([en,a,b],i)=>{const duty=this.pwm[en]??(this.pins[en]?255:0),dir=(this.pins[a]??0)-(this.pins[b]??0);return duty*dir*(this.config.motorReverse[i]?-1:1);});}
 tick(milliseconds){const end=this.time+milliseconds;while(this.time<end-1e-7){const dt=Math.min(1,end-this.time);this.sample();if(this.vm)this.vm.runAt(this.time);if(this.error)break;this.motor=this.getMotorOutputs();const c=this.config;const avg=side=>{const values=this.motor.filter((_,i)=>c.motorSides[i]===side);return values.length?values.reduce((a,b)=>a+b,0)/values.length/255*c.maxSpeed:0;};const vl=avg('left'),vr=avg('right'),v=(vl+vr)/2,w=(vl-vr)/c.wheelbase,ds=dt/1000;const theta=this.pose.theta+w*ds/2;this.pose.x+=Math.cos(theta)*v*ds;this.pose.z+=Math.sin(theta)*v*ds;this.pose.theta+=w*ds;this.velocity=v;this.distance+=Math.abs(v*ds);this.angles=this.angles.map((a,i)=>a+Math.sign(this.targets[i]-a)*Math.min(Math.abs(this.targets[i]-a),c.servoSpeed*ds));this.wheelAngles=this.wheelAngles.map((a,i)=>a-this.motor[i]/255*c.maxSpeed*ds/.052);this.time+=dt;
 const all=this.sensors.every(x=>x===(c.blackHigh?1:0));if(all&&!this.lastAll&&this.time-this.lastCross>150){this.crossings++;this.lastCross=this.time;this.log('marker',`检测到全黑标记，经过次数 ${this.crossings}`);}this.lastAll=all;
 const p=worldToPx(this.pose.x,this.pose.z);if(!this.finished&&p.x<=143&&p.z>1396&&p.z<1509&&this.distance>.3){this.finished=true;this.log('info','经过终点线；是否停车由程序决定');}
 this.updateGrip();if(!Number.isFinite(this.pose.x)||Math.abs(this.pose.x)>20||Math.abs(this.pose.z)>20){this.running=false;this.log('warning','小车已远离赛道，已暂停。可复位或调整位置');break;}}
 if(!this.trail.length||Math.hypot(this.pose.x-this.trail.at(-1).x,this.pose.z-this.trail.at(-1).z)>.01){this.trail.push({...this.pose});if(this.trail.length>1600)this.trail.shift();}this.sample();}
 updateGrip(){const {gripCenter,az,opening}=armPoints(this.angles,this.config);const direction=this.pose.theta-az;const tip={x:this.pose.x-Math.cos(this.pose.theta)*ARM_MOUNT_Z+Math.cos(direction)*gripCenter.r,z:this.pose.z-Math.sin(this.pose.theta)*ARM_MOUNT_Z+Math.sin(direction)*gripCenter.r,y:gripCenter.y};if(this.held>=0){const obj=this.objects[this.held];Object.assign(obj,tip);if(opening>.7){obj.held=false;obj.y=.05;this.log('info','夹爪已释放物体（简化接触模型）');this.held=-1;}}else if(opening<.25){const index=this.objects.findIndex(o=>Math.hypot(o.x-tip.x,o.z-tip.z)<.055&&Math.abs(o.y-tip.y)<.06);if(index>=0){this.held=index;this.objects[index].held=true;this.log('info','夹爪接触并抓取物体（简化接触模型）');}}}
 moveTo(pose){this.pose={...this.pose,...pose};this.initialPose={...this.pose};this.sample();}
 snapshot(){return {time:this.time,running:this.running,pose:{...this.pose},sensors:[...this.sensors],motor:[...this.motor],targets:[...this.targets],angles:[...this.angles],variables:this.vm?.variables()??{},line:this.vm?.line??0,delay:this.vm?.reason==='delay'?Math.max(0,this.vm.wake-this.time):0,loops:this.vm?.loopCount??0,crossings:this.crossings,distance:this.distance,velocity:this.velocity,finished:this.finished,error:this.error?.message??null,wiringSummary:this.wiringSummary,logs:this.logs.slice(-12)};}
}
