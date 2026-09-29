// A small, explicit Arduino/C++ interpreter. User text is never passed to eval.
export class CodeError extends Error {
  constructor(message, line = 1) { super(`第 ${line} 行：${message}`); this.line = line; }
}
const TYPES = new Set(['void','int','long','short','float','double','bool','boolean','char','byte','uint8_t','uint16_t','uint32_t','int8_t','int16_t','int32_t','unsigned','signed','const','static','String','Servo']);
const INTEGER = /^(int|long|short|char|byte|uint|unsigned|signed)/;
function preprocess(source) {
  if(source.length > 90000) throw new CodeError('程序太长，请限制在 90,000 字符以内');
  return source.split('\n').map((s, i) => {
    if(/^\s*#include/.test(s)) {
      if(!/^\s*#include\s*[<"](?:ESP32Servo|Servo|Arduino)\.h[>"]\s*(?:\/\/.*)?$/.test(s)) throw new CodeError('暂不支持这个库。支持 Arduino.h、ESP32Servo.h 和 Servo.h',i+1);
      return '';
    }
    const m=s.match(/^\s*#define\s+(\w+)\s+(.+)$/);
    if(m) return `const int ${m[1]} = ${m[2].replace(/\/\/.*$/,'').trim()};`;
    if(/^\s*#/.test(s)) throw new CodeError('暂不支持此预处理指令',i+1);
    return s;
  }).join('\n');
}
function tokenize(source) {
  source=preprocess(source); const out=[]; let i=0,line=1;
  while(i<source.length){
    const ch=source[i];
    if(/\s/.test(ch)){if(ch==='\n')line++;i++;continue;}
    if(source.startsWith('//',i)){while(i<source.length&&source[i]!=='\n')i++;continue;}
    if(source.startsWith('/*',i)){i+=2;while(i<source.length&&!source.startsWith('*/',i)){if(source[i++]==='\n')line++;}if(i>=source.length)throw new CodeError('注释没有闭合',line);i+=2;continue;}
    if(ch==='"'||ch==="'"){const quote=ch,start=line;let value='';i++;while(i<source.length&&source[i]!==quote){if(source[i]==='\\'){i++;const c=source[i++];value+=({n:'\n',r:'\r',t:'\t'}[c]??c);}else{if(source[i]==='\n')line++;value+=source[i++];}}if(i>=source.length)throw new CodeError('字符串没有闭合',start);i++;out.push({v:value,t:'str',line:start});continue;}
    const n=source.slice(i).match(/^(?:0[xX][0-9a-fA-F]+|\d+(?:\.\d*)?(?:[eE][+-]?\d+)?|\.\d+)(?:[uUlLfF]*)/);
    if(n){out.push({v:Number(n[0].replace(/[uUlLfF]+$/,'')),t:'num',line});i+=n[0].length;continue;}
    const id=source.slice(i).match(/^[A-Za-z_]\w*/);if(id){out.push({v:id[0],t:'id',line});i+=id[0].length;continue;}
    const op=source.slice(i).match(/^(?:<<=|>>=|\+\+|--|<=|>=|==|!=|&&|\|\||\+=|-=|\*=|\/=|%=|<<|>>|&=|\|=|\^=|[{}()\[\];,.:?+*/%!=<>~&|^\-])/);
    if(!op)throw new CodeError(`无法识别「${ch}」`,line);out.push({v:op[0],t:'op',line});i+=op[0].length;
  }out.push({v:'EOF',line,t:'eof'});return out;
}
const PREC={'=':1,'+=':1,'-=':1,'*=':1,'/=':1,'%=':1,'&=':1,'|=':1,'^=':1,'<<=':1,'>>=':1,'?':2,'||':3,'&&':4,'|':5,'^':6,'&':7,'==':8,'!=':8,'<':9,'>':9,'<=':9,'>=':9,'<<':10,'>>':10,'+':11,'-':11,'*':12,'/':12,'%':12};
class Parser {
  constructor(source){this.ts=tokenize(source);this.p=0;}
  get t(){return this.ts[this.p]}; is(v){return this.t.v===v;}
  pop(){return this.ts[this.p++];} match(v){if(this.is(v)){this.p++;return true;}return false;}
  need(v){if(!this.match(v))throw new CodeError(`这里需要 ${v}，实际为 ${this.t.v}`,this.t.line);}
  name(){if(this.t.t!=='id')throw new CodeError('需要变量或函数名',this.t.line);return this.pop().v;}
  type(){let type='';while(TYPES.has(this.t.v)){type+=(type?' ':'')+this.pop().v;}if(!type)throw new CodeError(`不支持的声明 ${this.t.v}`,this.t.line);return type;}
  program(){const globals=[],funcs={};while(!this.is('EOF')){if(this.match(';'))continue;const line=this.t.line,type=this.type(),name=this.name();
    if(this.match('(')){const params=[];if(!this.is(')')){if(this.is('void')&&this.ts[this.p+1]?.v===')')this.pop();else{do{const type=this.type(),name=this.name();params.push({type,name});}while(this.match(','));}}this.need(')');if(this.match(';'))continue;if(funcs[name])throw new CodeError(`重复定义 ${name}()，融合程序只能有一个 setup() 和 loop()`,line);funcs[name]={type,params,body:this.block(),line};}
    else globals.push(this.declaration(type,name,line,true));
  }if(!funcs.setup||!funcs.loop)throw new CodeError('需要 void setup() 和 void loop()');return {globals,funcs};}
  declaration(type,name,line,semi){const vars=[];do{let size=null,value=null;if(this.match('[')){size=this.is(']')?null:this.expr();this.need(']');size=size??{k:'num',v:0,line};}if(this.match('=')){if(this.match('{')){const items=[];if(!this.is('}')){do{items.push(this.expr());}while(this.match(',')&&!this.is('}'));}this.need('}');value={k:'array',items,line};}else value=this.expr();}vars.push({name,size,value});if(!this.match(','))break;name=this.name();}while(true);if(semi)this.need(';');return {k:'decl',type,vars,line};}
  block(){const line=this.t.line;this.need('{');const items=[];while(!this.is('}')){if(this.is('EOF'))throw new CodeError('缺少右花括号 }',line);items.push(this.stmt());}this.need('}');return {k:'block',items,line};}
  stmt(){const line=this.t.line;if(this.is('{'))return this.block();if(this.match(';'))return {k:'empty',line};
    if(this.match('if')){this.need('(');const cond=this.expr();this.need(')');const yes=this.stmt();const no=this.match('else')?this.stmt():null;return {k:'if',cond,yes,no,line};}
    if(this.match('for')){this.need('(');let init=null;if(!this.is(';')){if(TYPES.has(this.t.v)){const type=this.type();init=this.declaration(type,this.name(),line,false);}else init={k:'expr',expr:this.expr(),line};}this.need(';');const cond=this.is(';')?null:this.expr();this.need(';');const step=this.is(')')?null:this.expr();this.need(')');return {k:'for',init,cond,step,body:this.stmt(),line};}
    if(this.match('while')){this.need('(');const cond=this.expr();this.need(')');return {k:'while',cond,body:this.stmt(),line};}
    if(this.match('do')){const body=this.stmt();this.need('while');this.need('(');const cond=this.expr();this.need(')');this.need(';');return {k:'do',body,cond,line};}
    if(this.match('return')){const expr=this.is(';')?null:this.expr();this.need(';');return {k:'return',expr,line};}
    if(this.is('break')||this.is('continue')){const k=this.pop().v;this.need(';');return {k,line};}
    if(TYPES.has(this.t.v)){const type=this.type();return this.declaration(type,this.name(),line,true);}
    const expr=this.expr();this.need(';');return {k:'expr',expr,line};
  }
  expr(min=1){let left=this.prefix();while(PREC[this.t.v]>=min){const {v:op,line}=this.pop(),p=PREC[op];if(op==='?'){const yes=this.expr();this.need(':');left={k:'ternary',cond:left,yes,no:this.expr(2),line};continue;}const right=this.expr(p+(p===1?0:1));left={k:p===1?'assign':'binary',op,left,right,line};}return left;}
  prefix(){const {v,t,line}=this.pop();let n;
    if(['!','~','-','+','++','--'].includes(v))n={k:'unary',op:v,arg:this.prefix(),line};
    else if(v==='('){if(TYPES.has(this.t.v)&&this.ts[this.p+1]?.v===')'){const type=this.type();this.need(')');n={k:'cast',type,arg:this.prefix(),line};}else{n=this.expr();this.need(')');}}
    else if(t==='num'||t==='str')n={k:t,v,line};else if(t==='id')n={k:'id',name:v,line};else throw new CodeError(`不支持的表达式 ${v}`,line);
    while(true){if(this.match('(')){const args=[];if(!this.is(')')){do{args.push(this.expr());}while(this.match(','));}this.need(')');n={k:'call',callee:n,args,line};}
    else if(this.match('.'))n={k:'member',object:n,name:this.name(),line};
    else if(this.match('[')){const index=this.expr();this.need(']');n={k:'index',object:n,index,line};}
    else if(this.is('++')||this.is('--'))n={k:'postfix',op:this.pop().v,arg:n,line};else break;}return n;
  }
}
export function compile(source){return new Parser(source).program();}
function cast(value,type){if(Array.isArray(value)||value?.servo)return value;if(/bool/.test(type))return value?1:0;if(type==='String')return String(value);if(INTEGER.test(type.replace(/\b(?:const|static)\b/g,'').trim())){let n=Math.trunc(Number(value));if(/uint8|byte/.test(type))return (n%256+256)%256;if(/uint16/.test(type))return(n%65536+65536)%65536;if(/unsigned|uint32/.test(type))return n>>>0;return n|0;}return value;}
class Env{
  constructor(parent=null){this.parent=parent;this.vars=Object.create(null);}
  declare(name,value,type='int'){if(Object.hasOwn(this.vars,name))throw new CodeError(`重复声明 ${name}`);this.vars[name]={v:cast(value,type),type};}
  lookup(name,line){if(Object.hasOwn(this.vars,name))return this.vars[name];if(this.parent)return this.parent.lookup(name,line);throw new CodeError(`未定义变量 ${name}`,line);}
  get(name,line){return this.lookup(name,line).v;}
  set(name,value,line){const c=this.lookup(name,line);if(c.type.includes('const'))throw new CodeError(`不能修改常量 ${name}`,line);c.v=cast(value,c.type);return c.v;}
}
class Flow{constructor(kind,value){this.kind=kind;this.value=value;}}
function binary(op,a,b,line){switch(op){case '+':return a+b;case '-':return a-b;case '*':return a*b;case '/':if(!b)throw new CodeError('除数不能为 0',line);return a/b;case '%':return a%b;case '<':return +(a<b);case '>':return +(a>b);case '<=':return +(a<=b);case '>=':return +(a>=b);case '==':return +(a===b);case '!=':return +(a!==b);case '&':return a&b;case '|':return a|b;case '^':return a^b;case '<<':return a<<b;case '>>':return a>>b;}throw new CodeError(`不支持运算 ${op}`,line);}
export class ArduinoVM{
 constructor(ast,hardware){this.ast=ast;this.hw=hardware;this.global=new Env();this.line=1;this.time=0;this.wake=0;this.reason='';this.depth=0;this.loopCount=0;this.steps=0;this.error=null;this.iter=this.main();for(const [k,v] of Object.entries({HIGH:1,LOW:0,INPUT:0,OUTPUT:1,INPUT_PULLUP:2,INPUT_PULLDOWN:3,true:1,false:0,PI:Math.PI,DEG_TO_RAD:Math.PI/180,RAD_TO_DEG:180/Math.PI}))this.global.declare(k,v,'const double');}
 *main(){for(const n of this.ast.globals)yield* this.statement(n,this.global);yield* this.callFunction('setup',[]);while(true){yield* this.callFunction('loop',[]);this.loopCount++;yield{kind:'cycle',ms:1};}}
 *callFunction(name,args,line=1){const f=this.ast.funcs[name];if(!f)throw new CodeError(`暂不支持函数 ${name}()`,line);if(args.length!==f.params.length)throw new CodeError(`${name}() 参数数量不匹配`,line);if(++this.depth>40)throw new CodeError('函数调用层数过多',line);const env=new Env(this.global);f.params.forEach((p,i)=>env.declare(p.name,args[i],p.type));try{yield* this.statement(f.body,env);}catch(e){if(e instanceof Flow&&e.kind==='return')return cast(e.value,f.type);throw e;}finally{this.depth--;}return 0;}
 *statement(n,env){if(!n)return;this.line=n.line;yield{kind:'line',line:n.line};switch(n.k){
  case 'block':{const local=new Env(env);for(const c of n.items)yield* this.statement(c,local);break;}
  case 'decl':for(const v of n.vars){let value;if(n.type.includes('static'))throw new CodeError('暂不支持 static 局部状态，请改为全局变量',n.line);if(n.type.includes('Servo'))value={servo:true,pin:null,min:544,max:2400,angle:90,us:1500};else value=v.value?yield* this.evaluate(v.value,env):0;if(v.size){const size=yield* this.evaluate(v.size,env);if(size<0||size>4096)throw new CodeError('数组长度需在 0–4096 之间',n.line);value=Array.isArray(value)?value:Array(size).fill(0);}env.declare(v.name,value,n.type);}break;
  case 'expr':yield* this.evaluate(n.expr,env);break;
  case 'if':if(yield* this.evaluate(n.cond,env))yield* this.statement(n.yes,env);else if(n.no)yield* this.statement(n.no,env);break;
  case 'for':{const local=new Env(env);if(n.init)yield* this.statement(n.init,local);while(!n.cond||(yield* this.evaluate(n.cond,local))){yield{kind:'line',line:n.line};try{yield* this.statement(n.body,local);}catch(e){if(e instanceof Flow&&e.kind==='break')break;if(!(e instanceof Flow&&e.kind==='continue'))throw e;}if(n.step)yield* this.evaluate(n.step,local);}break;}
  case 'while':case 'do':{let first=n.k==='do';while(first||(yield* this.evaluate(n.cond,env))){first=false;yield{kind:'line',line:n.line};try{yield* this.statement(n.body,env);}catch(e){if(e instanceof Flow&&e.kind==='break')break;if(!(e instanceof Flow&&e.kind==='continue'))throw e;}}break;}
  case 'return':throw new Flow('return',n.expr?yield* this.evaluate(n.expr,env):0);
  case 'break':case 'continue':throw new Flow(n.k);case 'empty':break;
 }}
 *reference(n,env){if(n.k==='id')return {get:()=>env.get(n.name,n.line),set:v=>env.set(n.name,v,n.line)};if(n.k==='index'){const arr=yield* this.evaluate(n.object,env),i=yield* this.evaluate(n.index,env);if(!Array.isArray(arr)||i<0||i>=arr.length||!Number.isInteger(i))throw new CodeError('数组索引越界',n.line);return{get:()=>arr[i],set:v=>(arr[i]=v)};}throw new CodeError('左侧必须是变量',n.line);}
 *evaluate(n,env){switch(n.k){
 case 'num':case 'str':return n.v;case 'id':return env.get(n.name,n.line);case 'cast':return cast(yield* this.evaluate(n.arg,env),n.type);
 case 'array':{const a=[];for(const x of n.items)a.push(yield* this.evaluate(x,env));return a;}
 case 'index':return(yield* this.reference(n,env)).get();
 case 'assign':{const ref=yield* this.reference(n.left,env),v=yield* this.evaluate(n.right,env);return ref.set(n.op==='='?v:binary(n.op.slice(0,-1),ref.get(),v,n.line));}
 case 'unary':case 'postfix':{if(n.op==='++'||n.op==='--'){const ref=yield* this.reference(n.arg,env),old=ref.get(),v=ref.set(old+(n.op==='++'?1:-1));return n.k==='postfix'?old:v;}const a=yield* this.evaluate(n.arg,env);return n.op==='!'?+!a:n.op==='~'?~a:n.op==='-'?-a:+a;}
 case 'binary':{const a=yield* this.evaluate(n.left,env);if(n.op==='&&')return a?+(!!(yield* this.evaluate(n.right,env))):0;if(n.op==='||')return a?1:+(!!(yield* this.evaluate(n.right,env)));let result=binary(n.op,a,yield* this.evaluate(n.right,env),n.line);if(n.op==='/'&&this.integral(n.left,env)&&this.integral(n.right,env))result=Math.trunc(result);return result;}
 case 'ternary':return yield* this.evaluate((yield* this.evaluate(n.cond,env))?n.yes:n.no,env);
 case 'call':{const args=[];for(const a of n.args)args.push(yield* this.evaluate(a,env));if(n.callee.k==='member'){const name=n.callee.name,obj=n.callee.object;if(obj.k==='id'&&obj.name==='Serial'){if(!['begin','print','println','printf','flush'].includes(name))throw new CodeError(`暂不支持 Serial.${name}`,n.line);this.hw.serial(name,args);return 0;}const servo=yield* this.evaluate(obj,env);if(!servo?.servo)throw new CodeError('仅支持 Servo 对象的成员函数',n.line);if(name==='attach'){servo.pin=args[0];servo.min=args[1]??544;servo.max=args[2]??2400;servo.angle=Math.max(0,Math.min(180,(1500-servo.min)/(servo.max-servo.min)*180));this.hw.servo(servo.pin,servo.angle);return 1;}if(name==='detach'){servo.pin=null;return 0;}if(name==='attached')return +(servo.pin!==null);if(name==='read')return Math.round(servo.angle);if(name==='readMicroseconds')return Math.round(servo.us);if(name==='setPeriodHertz')return 0;if(name==='write'||name==='writeMicroseconds'){let v=Number(args[0]);if(!Number.isFinite(v))throw new CodeError('舵机角度必须是数字',n.line);const micro=name==='writeMicroseconds'||v>=500;servo.angle=micro?(v-servo.min)/(servo.max-servo.min)*180:v;servo.angle=Math.max(0,Math.min(180,servo.angle));servo.us=servo.min+servo.angle/180*(servo.max-servo.min);if(servo.pin!==null)this.hw.servo(servo.pin,servo.angle);return 0;}throw new CodeError(`暂不支持 Servo.${name}`,n.line);}
 if(n.callee.k!=='id')throw new CodeError('不支持此函数调用',n.line);const name=n.callee.name;if(this.ast.funcs[name])return yield* this.callFunction(name,args,n.line);
 if(name==='delay'||name==='delayMicroseconds'){const ms=Number(args[0])/(name==='delayMicroseconds'?1000:1);if(!Number.isFinite(ms)||ms<0||ms>86400000)throw new CodeError('延时应为 0–86400000 ms',n.line);this.line=n.line;yield{kind:'delay',ms,line:n.line};return 0;}
 if(name==='millis')return Math.floor(this.time)>>>0;if(name==='micros')return Math.floor(this.time*1000)>>>0;
 if(['pinMode','digitalRead','digitalWrite','analogWrite','analogRead'].includes(name))return this.hw.io(name,args,n.line);
 const math={abs:Math.abs,min:Math.min,max:Math.max,sqrt:Math.sqrt,sin:Math.sin,cos:Math.cos,tan:Math.tan,atan2:Math.atan2,pow:Math.pow,round:Math.round,floor:Math.floor,ceil:Math.ceil,sq:x=>x*x,constrain:(x,a,b)=>Math.max(a,Math.min(b,x)),map:(x,a,b,c,d)=>Math.trunc((x-a)*(d-c)/(b-a)+c),radians:x=>x*Math.PI/180,degrees:x=>x*180/Math.PI,int:x=>Math.trunc(x),float:Number,String:String};if(math[name])return math[name](...args);
 throw new CodeError(`暂不支持 ${name}()；请查看「支持范围」`,n.line);
 }
 default:throw new CodeError(`暂不支持语法 ${n.k}`,n.line);
 }}
 integral(n,env){if(n.k==='num')return Number.isInteger(n.v);if(n.k==='id'){const t=env.lookup(n.name,n.line).type;return !/float|double|String/.test(t);}if(n.k==='cast')return !/float|double/.test(n.type);if(n.k==='binary')return this.integral(n.left,env)&&this.integral(n.right,env);return false;}
 runAt(now){this.time=now;if(this.error||now+0.00001<this.wake)return;let budget=60000;try{while(budget--){const r=this.iter.next();this.steps++;if(r.done)return;if(r.value.kind==='line'){this.line=r.value.line;continue;}this.reason=r.value.kind;this.line=r.value.line??this.line;this.wake=now+Math.max(0,r.value.ms);if(r.value.ms>0)return;}throw new CodeError('单次执行过长，可能存在死循环；请在循环中加入 delay() 或修正条件',this.line);}catch(e){this.error=e instanceof CodeError?e:new CodeError(e?.message??'程序执行异常',this.line);this.hw.fail(this.error);}}
 variables(){return Object.fromEntries(Object.entries(this.global.vars).filter(([k,v])=>!v.type.includes('const')&&!v.v?.servo).map(([k,v])=>[k,v.v]));}
}
