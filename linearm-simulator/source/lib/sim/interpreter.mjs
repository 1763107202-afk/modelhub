// Sandboxed, bounded Arduino C++ interpreter. User code is never evaluated as JavaScript.
import {compile,CodeError} from './cpp-parser.mjs';
import {Env,cast,baseType,integralType,metadata,copyValue} from './cpp-values.mjs';
import {serialText} from './serial-format.mjs';
export {compile,CodeError};
class Flow{constructor(kind,value){this.kind=kind;this.value=value;}}
function binary(op,a,b,line){switch(op){case '+':return a+b;case '-':return a-b;case '*':return a*b;case '/':if(!b)throw new CodeError('除数不能为 0',line);return a/b;case '%':if(!b)throw new CodeError('除数不能为 0',line);return a%b;case '<':return +(a<b);case '>':return +(a>b);case '<=':return +(a<=b);case '>=':return +(a>=b);case '==':return +(a===b);case '!=':return +(a!==b);case '&':return a&b;case '|':return a|b;case '^':return a^b;case '<<':return a<<b;case '>>':return a>>b;}throw new CodeError(`不支持运算 ${op}`,line);}
export class ArduinoVM{
 constructor(ast,hardware){this.ast=ast;this.hw=hardware;this.global=new Env();this.staticCells=new WeakMap();this.randomState=1;this.allocations=0;this.line=1;this.time=0;this.wake=0;this.reason='';this.depth=0;this.loopCount=0;this.steps=0;this.error=null;this.iter=this.main();for(const [k,v] of Object.entries({HIGH:1,LOW:0,INPUT:0,OUTPUT:1,INPUT_PULLUP:2,INPUT_PULLDOWN:3,true:1,false:0,NULL:0,nullptr:0,PI:Math.PI,DEG_TO_RAD:Math.PI/180,RAD_TO_DEG:180/Math.PI,HEX:16,DEC:10,OCT:8,BIN:2,LSBFIRST:0,MSBFIRST:1,TWO_PI:2*Math.PI,HALF_PI:Math.PI/2}))this.global.declare(k,v,'const double');}
 *main(){for(const n of this.ast.globals)yield* this.statement(n,this.global);yield* this.callFunction('setup',[]);while(true){yield* this.callFunction('loop',[]);this.loopCount++;yield{kind:'cycle',ms:1};}}
 *buildValue(type,dims,value,env,line,depth=0){
  if(depth>24||++this.allocations>65536)throw new CodeError('数据结构过深或过大',line);
  const t=baseType(type),items=value?.initializer?value.items:null;
  if(dims.length){const count=dims[0]===null?(items?.length??(typeof value==='string'?value.length+1:Array.isArray(value)?value.length:0)):yield* this.evaluate(dims[0],env);
   if(!Number.isInteger(count)||count<1||count>4096)throw new CodeError('数组长度需在 1–4096 之间；省略长度时需要初始化列表',line);
   const input=items??(typeof value==='string'&&t==='char'?[...value].map(c=>c.codePointAt(0)).concat(0):Array.isArray(value)?value:[]);
   if(value!==undefined&&!items&&!Array.isArray(value)&&typeof value!=='string')throw new CodeError('数组需要使用 { ... } 初始化',line);
   if(input.length>count)throw new CodeError('数组初始化项超出声明长度',line);
   const arr=[];for(let i=0;i<count;i++)arr.push(yield* this.buildValue(type,dims.slice(1),input[i],env,line,depth+1));metadata.set(arr,{kind:'array',type,dims,readonly:/\bconst\b/.test(type)});return arr;
  }
  const fields=this.ast.structs?.[t];
  if(fields){if(value!==undefined&&!items)return cast(value,type,line);if(items&&items.length>fields.length)throw new CodeError(`结构体 ${t} 初始化项过多`,line);
   const obj=Object.create(null);for(let i=0;i<fields.length;i++){const f=fields[i],v=items?.[i]??(f.value?yield* this.evaluate(f.value,env):undefined);obj[f.name]=yield* this.buildValue(f.type,f.dims,v,env,line,depth+1);}metadata.set(obj,{kind:'struct',type:t,fields});return obj;}
  if(t==='Servo'){if(value!==undefined)throw new CodeError('Servo 对象不接受这种初始化',line);return {servo:true,pin:null,min:544,max:2400,angle:90,us:1500};}
  if(items){if(items.length>1)throw new CodeError('标量只能有一个初始化值',line);value=items[0];}
  return cast(value??(t==='String'?'':0),type,line);
 }
 *callFunction(name,args,line=1,argNodes=null,caller=null){
  const f=this.ast.funcs[name];if(!f)throw new CodeError(`暂不支持函数 ${name}()`,line);
  if(args.length>f.params.length||f.params.slice(args.length).some(p=>!p.value))throw new CodeError(`${name}() 参数数量不匹配`,line);
  if(++this.depth>40)throw new CodeError('函数调用层数过多',line);const env=new Env(this.global);
  try{
   for(let i=0;i<f.params.length;i++){const p=f.params[i];let value=i<args.length?args[i]:yield* this.evaluate(p.value,this.global);
    if(p.reference){const ref=args[i]?.reference;if(!ref)throw new CodeError('引用参数需要可寻址的变量、成员或数组元素',line);if(baseType(ref.type)!==baseType(p.type))throw new CodeError('引用参数类型不匹配',line);if(ref.readonly&&!/\bconst\b/.test(p.type))throw new CodeError('不能把常量传入可修改的引用',line);env.bind(p.name,{type:p.type,dims:p.dims,get v(){return ref.get();},set v(v){ref.set(v);}},line);}
    else if(p.dims.length){if(!Array.isArray(value))throw new CodeError('数组参数需要传入数组',line);const meta=metadata.get(value);if(meta&&baseType(meta.type)!==baseType(p.type))throw new CodeError('数组参数元素类型不匹配',line);if(meta?.readonly&&!/\bconst\b/.test(p.type))throw new CodeError('不能把常量数组传入可修改的数组参数',line);env.bind(p.name,{v:value,type:p.type,dims:p.dims},line);}
    else {this.allocations=0;value=yield* this.buildValue(p.type,[],value,env,line);env.declare(p.name,value,p.type,[],line);}
   }
   yield* this.statement(f.body,env);
  }catch(e){if(e instanceof Flow&&e.kind==='return')return cast(e.value,f.type,line);throw e;}finally{this.depth--;}return 0;
 }
 *statement(n,env){if(!n)return;this.line=n.line;yield{kind:'line',line:n.line};switch(n.k){
  case 'block':{const local=new Env(env);for(const c of n.items)yield* this.statement(c,local);break;}
  case 'decl':for(const v of n.vars){const saved=this.staticCells.get(v);if(saved){env.bind(v.name,saved,n.line);continue;}this.allocations=0;const raw=v.value?yield* this.evaluate(v.value,env):undefined;const value=yield* this.buildValue(n.type,v.dims,raw,env,n.line);env.declare(v.name,value,n.type,v.dims,n.line);if(/\bstatic\b/.test(n.type))this.staticCells.set(v,env.lookup(v.name));}break;
  case 'switch':{const value=yield* this.evaluate(n.expr,env),local=new Env(env);let start=-1,fallback=-1;const seen=new Set();for(let i=0;i<n.cases.length;i++){const c=n.cases[i];if(!c.value){fallback=i;continue;}const label=yield* this.evaluate(c.value,env);if(seen.has(label))throw new CodeError('重复的 case 值',n.line);seen.add(label);if(label===value)start=i;}if(start<0)start=fallback;if(start>=0)try{for(let i=start;i<n.cases.length;i++)for(const item of n.cases[i].items)yield* this.statement(item,local);}catch(e){if(!(e instanceof Flow&&e.kind==='break'))throw e;}break;}
  case 'expr':yield* this.evaluate(n.expr,env);break;
  case 'if':if(yield* this.evaluate(n.cond,env))yield* this.statement(n.yes,env);else if(n.no)yield* this.statement(n.no,env);break;
  case 'for':{const local=new Env(env);if(n.init)yield* this.statement(n.init,local);while(!n.cond||(yield* this.evaluate(n.cond,local))){yield{kind:'line',line:n.line};try{yield* this.statement(n.body,local);}catch(e){if(e instanceof Flow&&e.kind==='break')break;if(!(e instanceof Flow&&e.kind==='continue'))throw e;}if(n.step)yield* this.evaluate(n.step,local);}break;}
  case 'while':case 'do':{let first=n.k==='do';while(first||(yield* this.evaluate(n.cond,env))){first=false;yield{kind:'line',line:n.line};try{yield* this.statement(n.body,env);}catch(e){if(e instanceof Flow&&e.kind==='break')break;if(!(e instanceof Flow&&e.kind==='continue'))throw e;}}break;}
  case 'return':throw new Flow('return',n.expr?yield* this.evaluate(n.expr,env):0);
  case 'break':case 'continue':throw new Flow(n.k);case 'empty':break;
 }}
 typeOf(n,env){
  if(n.k==='id'){const c=env.lookup(n.name,n.line);return {type:c.type,dims:c.dims};}
  if(n.k==='index'){const p=this.typeOf(n.object,env);if(p.dims.length)return {...p,dims:p.dims.slice(1)};const t=baseType(p.type);return /\*$/.test(t)?{type:t.slice(0,-1),dims:[]}:{...p,dims:[]};}
  if(n.k==='member'){const p=this.typeOf(n.object,env),f=this.ast.structs?.[baseType(p.type)]?.find(f=>f.name===n.name);if(!f)throw new CodeError(`未定义成员 ${n.name}`,n.line);return {type:f.type,dims:f.dims};}
  if(n.k==='cast')return {type:n.type,dims:[]};
  if(n.k==='call'&&n.callee.k==='id'){const name=n.callee.name;return {type:this.ast.funcs[name]?.type??(['float','double','sin','cos','sqrt','pow','tan','atan2'].includes(name)?'double':'int'),dims:[]};}
  if(n.k==='num')return {type:n.float?'double':'int',dims:[]};
  if(n.k==='binary')return {type:this.integral(n.left,env)&&this.integral(n.right,env)?'int':'double',dims:[]};
  if(n.k==='unary'){const p=this.typeOf(n.arg,env),t=baseType(p.type);if(n.op==='&')return {type:t+'*',dims:[]};if(n.op==='*')return /\*$/.test(t)?{type:t.slice(0,-1),dims:[]}:(p.dims.length?{type:p.type,dims:p.dims.slice(1)}:p);return p;}if(n.k==='postfix')return this.typeOf(n.arg,env);
  if(n.k==='ternary')return {type:this.integral(n.yes,env)&&this.integral(n.no,env)?'int':'double',dims:[]};
  return {type:n.k==='str'?'String':'double',dims:[]};
 }
 readonly(n,env){if(n.k==='id')return /\bconst\b/.test(env.lookup(n.name,n.line).type);if(n.object)return this.readonly(n.object,env)||/\bconst\b/.test(this.typeOf(n,env).type);return false;}
 *reference(n,env){
  if(n.k==='id'){const cell=env.lookup(n.name,n.line);return {type:cell.type,dims:cell.dims,readonly:/\bconst\b/.test(cell.type),get:()=>cell.v,set:v=>env.set(n.name,v,n.line)};}
  if(n.k==='unary'&&n.op==='*'){const p=yield* this.evaluate(n.arg,env);if(p?.pointer)return p.ref;if(Array.isArray(p)){if(!p.length)throw new CodeError('不能解引用空数组',n.line);const meta=metadata.get(p);return {type:meta?.type??'int',dims:meta?.dims?.slice(1)??[],readonly:!!meta?.readonly,get:()=>p[0],set:v=>{if(meta?.readonly)throw new CodeError('不能修改常量数组元素',n.line);p[0]=cast(v,meta?.type??'int',n.line);return p[0];}};}throw new CodeError('只能解引用指针或数组',n.line);}
  if(n.k==='index'||n.k==='member'){
   const obj=yield* this.evaluate(n.object,env),meta=obj&&typeof obj==='object'?metadata.get(obj):null;let key,type,dims;
   if(n.k==='index'){key=yield* this.evaluate(n.index,env);if(!Array.isArray(obj)||key<0||key>=obj.length||!Number.isInteger(key))throw new CodeError('数组索引越界',n.line);type=meta?.type??'int';dims=meta?.dims.slice(1)??[];}
   else{const f=meta?.kind==='struct'?meta.fields.find(f=>f.name===n.name):null;if(!f)throw new CodeError(`未定义结构体成员 ${n.name}`,n.line);key=n.name;type=f.type;dims=f.dims;}
   const readonly=this.readonly(n,env)||meta?.readonly||/\bconst\b/.test(type);
   return {type,dims,readonly,get:()=>obj[key],set:v=>{if(readonly)throw new CodeError('不能修改常量成员或数组元素',n.line);if(dims.length)throw new CodeError('不能给整个数组赋值',n.line);return obj[key]=cast(v,type,n.line);}};
  }throw new CodeError('左侧必须是变量、结构体成员或数组元素',n.line);
 }
 *unevaluatedValue(n,env){
  if(n.k==='id')return env.get(n.name,n.line);
  if(n.k==='index'){const array=yield* this.unevaluatedValue(n.object,env);if(!Array.isArray(array))throw new CodeError('sizeof 下标对象需要数组',n.line);return array[0];}
  if(n.k==='member'){const obj=yield* this.unevaluatedValue(n.object,env);return obj[n.name];}
  return undefined;
 }
 sizeOfType(type,seen=new Set()){
  const t=baseType(type);if(seen.has(t))throw new CodeError('递归结构体没有有限大小',this.line);
  const fields=this.ast.structs?.[t];if(fields){if(fields.some(f=>f.dims.length))throw new CodeError('sizeof 带数组字段的结构体尚未适配',this.line);let size=0,alignment=1;for(const f of fields){const n=this.sizeOfType(f.type,new Set([...seen,t])),a=Math.min(4,n);alignment=Math.max(alignment,a);size=Math.ceil(size/a)*a+n;}return Math.ceil(size/alignment)*alignment;}
  if(/\*$/.test(t))return 4;return /bool|char|byte|int8_t/.test(t)?1:/short|word|int16_t/.test(t)?2:/int64_t|uint64_t|long long|double/.test(t)?8:4;
 }
 sizeOfValue(value,type){if(Array.isArray(value))return value.reduce((a,v)=>a+this.sizeOfValue(v,type),0);return this.sizeOfType(type);}
 *evaluate(n,env){switch(n.k){
 case 'num':case 'str':return n.v;case 'id':return env.get(n.name,n.line);case 'cast':{this.allocations=0;return yield* this.buildValue(n.type,[],yield* this.evaluate(n.arg,env),env,n.line);}
 case 'init':{const items=[];for(const x of n.items)items.push(yield* this.evaluate(x,env));return {initializer:true,items};}
 case 'sequence':yield* this.evaluate(n.left,env);return yield* this.evaluate(n.right,env);
 case 'sizeof':{if(n.arg){const info=this.typeOf(n.arg,env);if(n.arg.k==='id'||n.arg.k==='member'||n.arg.k==='index')return this.sizeOfValue(yield* this.unevaluatedValue(n.arg,env),info.type);return this.sizeOfType(info.type);}let size=this.sizeOfType(n.type);for(const d of n.dims){if(!d)throw new CodeError('sizeof 数组需要指定长度',n.line);size*=yield* this.evaluate(d,env);}return size;}
 case 'member':case 'index':return(yield* this.reference(n,env)).get();
 case 'assign':{const ref=yield* this.reference(n.left,env);let v=yield* this.evaluate(n.right,env);if(v?.initializer){this.allocations=0;v=yield* this.buildValue(ref.type,ref.dims,v,env,n.line);}return ref.set(n.op==='='?v:binary(n.op.slice(0,-1),ref.get(),v,n.line));}
 case 'unary':case 'postfix':{if(n.op==='&'){const ref=yield* this.reference(n.arg,env);return {pointer:true,ref,type:ref.type};}if(n.op==='*')return(yield* this.reference(n,env)).get();if(n.op==='++'||n.op==='--'){const ref=yield* this.reference(n.arg,env),old=ref.get(),v=ref.set(old+(n.op==='++'?1:-1));return n.k==='postfix'?old:v;}const a=yield* this.evaluate(n.arg,env);return n.op==='!'?+!a:n.op==='~'?~a:n.op==='-'?-a:+a;}
 case 'binary':{const a=yield* this.evaluate(n.left,env);if(n.op==='&&')return a?+(!!(yield* this.evaluate(n.right,env))):0;if(n.op==='||')return a?1:+(!!(yield* this.evaluate(n.right,env)));let result=binary(n.op,a,yield* this.evaluate(n.right,env),n.line);if(n.op==='/'&&this.integral(n.left,env)&&this.integral(n.right,env))result=Math.trunc(result);return result;}
 case 'ternary':return yield* this.evaluate((yield* this.evaluate(n.cond,env))?n.yes:n.no,env);
 case 'call':{const args=[],fn=n.callee.k==='id'?this.ast.funcs[n.callee.name]:null;for(let i=0;i<n.args.length;i++){args.push(fn?.params[i]?.reference?{reference:yield* this.reference(n.args[i],env)}:yield* this.evaluate(n.args[i],env));}if(n.callee.k==='member'){const name=n.callee.name,obj=n.callee.object;if(obj.k==='id'&&obj.name==='Serial'){if(['available','availableForWrite'].includes(name))return name==='available'?0:64;if(['read','peek'].includes(name))return -1;if(['readString','readStringUntil'].includes(name))return '';if(['parseInt','parseFloat'].includes(name))return 0;if(['setTimeout','begin','flush','end'].includes(name)){this.hw.serial(name,args);return 0;}if(!['print','println','printf'].includes(name))throw new CodeError(`暂不支持 Serial.${name}`,n.line);const text=serialText(name,args,n.args[0]?this.typeOf(n.args[0],env).type:'String',n.line);this.hw.serial(name==='printf'?'print':name,[text]);return text.length+(name==='println'?1:0);}
 const target=yield* this.evaluate(obj,env);if(typeof target==='string'){if(name==='length')return target.length;if(name==='charAt')return target.codePointAt(Number(args[0])||0)??0;if(name==='substring'){const a=Math.max(0,Number(args[0])||0),b=args.length>1?Math.max(a,Number(args[1])||0):target.length;return target.slice(a,b);}if(name==='indexOf')return target.indexOf(String(args[0]??''),Number(args[1])||0);if(name==='lastIndexOf')return target.lastIndexOf(String(args[0]??''));if(name==='startsWith')return +target.startsWith(String(args[0]??''));if(name==='endsWith')return +target.endsWith(String(args[0]??''));if(name==='equals')return +(target===String(args[0]??''));if(name==='equalsIgnoreCase')return +(target.toLowerCase()===String(args[0]??'').toLowerCase());if(name==='toInt')return parseInt(target,10)||0;if(name==='toFloat')return parseFloat(target)||0;if(name==='c_str')return target;throw new CodeError(`暂不支持 String.${name}`,n.line);}
 const servo=target;if(!servo?.servo)throw new CodeError('暂只支持 Serial、String 和 Servo 对象的成员函数',n.line);if(name==='attach'){servo.pin=args[0];servo.min=args[1]??544;servo.max=args[2]??2400;servo.angle=Math.max(0,Math.min(180,(1500-servo.min)/(servo.max-servo.min)*180));this.hw.servo(servo.pin,servo.angle);return 1;}if(name==='detach'){servo.pin=null;return 0;}if(name==='attached')return +(servo.pin!==null);if(name==='read')return Math.round(servo.angle);if(name==='readMicroseconds')return Math.round(servo.us);if(name==='setPeriodHertz')return 0;if(name==='write'||name==='writeMicroseconds'){let v=Number(args[0]);if(!Number.isFinite(v))throw new CodeError('舵机角度必须是数字',n.line);const micro=name==='writeMicroseconds'||v>=500;servo.angle=micro?(v-servo.min)/(servo.max-servo.min)*180:v;servo.angle=Math.max(0,Math.min(180,servo.angle));servo.us=servo.min+servo.angle/180*(servo.max-servo.min);if(servo.pin!==null)this.hw.servo(servo.pin,servo.angle);return 0;}throw new CodeError(`暂不支持 Servo.${name}`,n.line);}
 if(n.callee.k!=='id')throw new CodeError('不支持此函数调用',n.line);const name=n.callee.name;if(this.ast.funcs[name])return yield* this.callFunction(name,args,n.line,n.args,env);
 if(/^(?:int|long|short|float|double|bool|boolean|char|byte|word|size_t|u?int(?:8|16|32|64)_t)$/.test(name)||Object.hasOwn(this.ast.aliases??{},name)){if(args.length>1)throw new CodeError('类型转换需要一个参数',n.line);return cast(args[0]??0,this.ast.aliases?.[name]??name,n.line);}
 if(name==='delay'||name==='delayMicroseconds'){const ms=Number(args[0])/(name==='delayMicroseconds'?1000:1);if(!Number.isFinite(ms)||ms<0||ms>86400000)throw new CodeError('延时应为 0–86400000 ms',n.line);this.line=n.line;yield{kind:'delay',ms,line:n.line};return 0;}
 if(name==='yield'){yield{kind:'delay',ms:1,line:n.line};return 0;}
 if(name==='randomSeed'){this.randomState=(Number(args[0])>>>0)||1;return 0;}if(name==='random'){this.randomState=(Math.imul(this.randomState,1664525)+1013904223)>>>0;const lo=args.length>1?args[0]:0,hi=args.length>1?args[1]:args[0];return hi<=lo?lo:lo+Math.floor(this.randomState/4294967296*(hi-lo));}
 if(['bitSet','bitClear','bitWrite'].includes(name)){const ref=yield* this.reference(n.args[0],env),mask=1<<args[1];return ref.set(name==='bitSet'||name==='bitWrite'&&args[2]?ref.get()|mask:ref.get()&~mask);}
 if(name==='millis')return Math.floor(this.time)>>>0;if(name==='micros')return Math.floor(this.time*1000)>>>0;
 if(name==='digitalPinToInterrupt')return Number(args[0])||0;
 if(['noInterrupts','interrupts','attachInterrupt','detachInterrupt','tone','noTone','analogReadResolution','analogSetWidth','analogSetAttenuation','analogSetPinAttenuation','shiftOut'].includes(name))return 0;
 if(['pulseIn','pulseInLong','shiftIn'].includes(name))return 0;
 if(name==='strlen')return String(args[0]??'').length;if(name==='strcmp')return String(args[0]??'').localeCompare(String(args[1]??''));if(name==='strncmp')return String(args[0]??'').slice(0,Number(args[2])||0).localeCompare(String(args[1]??'').slice(0,Number(args[2])||0));if(name==='atoi')return parseInt(String(args[0]??''),10)||0;if(name==='atof')return parseFloat(String(args[0]??''))||0;
 if(['pinMode','digitalRead','digitalWrite','analogWrite','analogRead','ledcSetup','ledcAttachPin','ledcAttach','ledcAttachChannel','ledcWrite','ledcWriteChannel','ledcRead','ledcDetach','ledcDetachPin','analogWriteResolution','analogWriteFrequency'].includes(name))return this.hw.io(name,args,n.line);
 const math={abs:Math.abs,min:Math.min,max:Math.max,sqrt:Math.sqrt,sin:Math.sin,cos:Math.cos,tan:Math.tan,asin:Math.asin,acos:Math.acos,atan:Math.atan,atan2:Math.atan2,pow:Math.pow,exp:Math.exp,log:Math.log,log10:Math.log10,hypot:Math.hypot,fmod:(a,b)=>a%b,isnan:x=>+Number.isNaN(x),isinf:x=>+(!Number.isFinite(x)),round:Math.round,floor:Math.floor,ceil:Math.ceil,sq:x=>x*x,constrain:(x,a,b)=>Math.max(a,Math.min(b,x)),map:(x,a,b,c,d)=>Math.trunc((x-a)*(d-c)/(b-a)+c),radians:x=>x*Math.PI/180,degrees:x=>x*180/Math.PI,int:x=>Math.trunc(x),long:x=>Math.trunc(x),float:Number,double:Number,byte:x=>cast(x,'byte'),word:x=>cast(x,'word'),boolean:x=>+!!x,bit:n=>1<<n,bitRead:(x,n)=>(x>>>n)&1,lowByte:x=>x&255,highByte:x=>(x>>>8)&255,F:x=>x,String:(x,base)=>typeof x==='number'&&base?Number.isInteger(x)?x.toString(base):x.toFixed(base):String(x)};if(math[name])return math[name](...args);
 throw new CodeError(`暂不支持 ${name}()；请查看「支持范围」`,n.line);
 }
 default:throw new CodeError(`暂不支持语法 ${n.k}`,n.line);
 }}
 integral(n,env){return integralType(this.typeOf(n,env).type);}
 runAt(now){this.time=now;if(this.error||now+0.00001<this.wake)return;let budget=60000;try{while(budget--){const r=this.iter.next();this.steps++;if(r.done)return;if(r.value.kind==='line'){this.line=r.value.line;continue;}this.reason=r.value.kind;this.line=r.value.line??this.line;this.wake=now+Math.max(0,r.value.ms);if(r.value.ms>0)return;}throw new CodeError('单次执行过长，可能存在死循环；请在循环中加入 delay() 或修正条件',this.line);}catch(e){this.error=e instanceof CodeError?e:new CodeError(e?.message??'程序执行异常',this.line);this.hw.fail(this.error);}}
 variables(){return Object.fromEntries(Object.entries(this.global.vars).filter(([k,v])=>!v.type.includes('const')&&!v.v?.servo).map(([k,v])=>[k,v.v]));}
}
