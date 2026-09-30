// Bounded Arduino C++ subset parser. No eval, Function, or host code execution.
export class CodeError extends Error {
  constructor(message,line=1){super(`第 ${line} 行：${message}`);this.line=line;}
}
const BUILTINS=new Set(['void','int','long','short','float','double','bool','boolean','char','byte','word','size_t','uint8_t','uint16_t','uint32_t','int8_t','int16_t','int32_t','unsigned','signed','String','Servo']);
const QUALIFIERS=new Set(['const','static','volatile','extern','inline']);
const PREC={',':0,'=':1,'+=':1,'-=':1,'*=':1,'/=':1,'%=':1,'&=':1,'|=':1,'^=':1,'<<=':1,'>>=':1,'?':2,'||':3,'&&':4,'|':5,'^':6,'&':7,'==':8,'!=':8,'<':9,'>':9,'<=':9,'>=':9,'<<':10,'>>':10,'+':11,'-':11,'*':12,'/':12,'%':12};
function lex(source,line=1){
 const out=[];let i=0;
 while(i<source.length){
  const ch=source[i];if(/\s/.test(ch)){if(ch==='\n')line++;i++;continue;}
  if(ch==='"'||ch==="'"){const quote=ch,start=line;let value='';i++;while(i<source.length&&source[i]!==quote){if(source[i]==='\\'){i++;const c=source[i++];value+=({n:'\n',r:'\r',t:'\t','0':'\0'}[c]??c);}else{if(source[i]==='\n')line++;value+=source[i++];}}if(i>=source.length)throw new CodeError('字符串没有闭合',start);i++;if(quote==="'"&&[...value].length!==1)throw new CodeError('字符常量需要一个字符',start);out.push({v:quote==="'"?value.codePointAt(0):value,t:quote==="'"?'num':'str',line:start});continue;}
  const n=source.slice(i).match(/^(?:0[xX][0-9a-fA-F]+[uUlL]*|0[bB][01]+[uUlL]*|(?:\d+(?:\.\d*)?(?:[eE][+-]?\d+)?|\.\d+)[uUlLfF]*)/);
  if(n){const raw=n[0],hex=/^0[xX]/.test(raw),bin=/^0[bB]/.test(raw),clean=raw.replace(hex||bin?/[uUlL]+$/:/[uUlLfF]+$/,'');const float=!hex&&!bin&&/[.eEfF]/.test(raw);const value=!float&&/^0[0-7]+$/.test(clean)?parseInt(clean,8):Number(clean);if(!Number.isFinite(value))throw new CodeError('无效数字',line);out.push({v:value,t:'num',float,line});i+=raw.length;continue;}
  const id=source.slice(i).match(/^[A-Za-z_]\w*/);if(id){out.push({v:id[0],t:'id',line});i+=id[0].length;continue;}
  const op=source.slice(i).match(/^(?:<<=|>>=|\+\+|--|<=|>=|==|!=|&&|\|\||\+=|-=|\*=|\/=|%=|<<|>>|&=|\|=|\^=|->|::|[{}()\[\];,.:?+*/%!=<>~&|^\-])/);
  if(!op)throw new CodeError(`无法识别「${ch}」`,line);out.push({v:op[0],t:'op',line});i+=op[0].length;
 }return out;
}
function expand(tokens,macros,hidden=new Set(),depth=0){
 if(depth>30)throw new CodeError('宏展开层数过多',tokens[0]?.line);const out=[];
 for(let i=0;i<tokens.length;i++){
  const t=tokens[i],m=t.t==='id'&&!hidden.has(t.v)?macros.get(t.v):null;
  if(!m){out.push(t);continue;}let args=null;
  if(m.params){if(tokens[i+1]?.v!=='('){out.push(t);continue;}i+=2;args=[];let arg=[],nest=0;
   for(;i<tokens.length;i++){const v=tokens[i].v;if(v===')'&&nest===0){if(arg.length||m.params.length)args.push(arg);break;}if(v===','&&nest===0){args.push(arg);arg=[];continue;}if(v==='(')nest++;if(v===')')nest--;arg.push(tokens[i]);}
   if(i===tokens.length||args.length!==m.params.length)throw new CodeError(`宏 ${t.v} 参数数量不匹配或括号未闭合`,t.line);
  }
  const body=m.body.flatMap(x=>{const p=m.params?.indexOf(x.v)??-1;return (p>=0?expand(args[p],macros,hidden,depth+1):[x]).map(y=>({...y,line:t.line}));});
  out.push(...expand(body,macros,new Set([...hidden,t.v]),depth+1));if(out.length>150000)throw new CodeError('宏展开后程序过大',t.line);
 }return out;
}
function tokenize(source){
 if(source.length>90000)throw new CodeError('程序太长，请限制在 90,000 字符以内');
 // Remove comments without changing source line numbers or quoted literals.
 source=source.replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\/\/[^\n]*|\/\*[\s\S]*?\*\//g,s=>s.startsWith('/')?s.replace(/[^\n]/g,' '):s);
 const lines=source.split('\n'),out=[],macros=new Map(),conditions=[];let active=true,chunk='',start=1;
 const flush=()=>{out.push(...expand(lex(chunk,start),macros));chunk='';};
 for(let i=0;i<lines.length;i++){
  let s=lines[i],line=i+1;if(!/^\s*#/.test(s)){if(!chunk)start=line;chunk+=active?s+'\n':'\n';continue;}flush();
  while(/\\\s*$/.test(s)&&i+1<lines.length)s=s.replace(/\\\s*$/,' ')+lines[++i];
  const d=s.match(/^\s*#\s*(\w+)\s*(.*)$/);if(!d)throw new CodeError('无效预处理指令',line);const [,kind,body]=d;
  if(kind==='ifdef'||kind==='ifndef'){const yes=macros.has(body.trim())===(kind==='ifdef');conditions.push({parent:active,yes,elseSeen:false});active=active&&yes;continue;}
  if(kind==='else'){const c=conditions.at(-1);if(!c||c.elseSeen)throw new CodeError('没有匹配的 #if 或重复 #else',line);c.elseSeen=true;active=c.parent&&!c.yes;continue;}
  if(kind==='endif'){const c=conditions.pop();if(!c)throw new CodeError('没有匹配的 #if',line);active=c.parent;continue;}
  if(kind==='if'||kind==='elif')throw new CodeError('条件表达式 #if / #elif 尚未适配；支持 #ifdef / #ifndef',line);
  if(!active)continue;
  if(kind==='include'){if(!/^[<"](?:ESP32Servo|Servo|Arduino|stdint|stdbool|stddef|math|stdlib)\.h[>"]\s*$/.test(body))throw new CodeError('这个库尚未适配。支持 Arduino.h、ESP32Servo.h、Servo.h 及基础类型/数学头文件',line);continue;}
  if(kind==='define'){const m=body.match(/^(\w+)(\([^)]*\))?\s*(.*)$/);if(!m)throw new CodeError('无效宏定义',line);const params=m[2]===undefined?null:m[2].slice(1,-1).trim()?m[2].slice(1,-1).split(',').map(x=>x.trim()):[];if(params?.some(p=>!/^\w+$/.test(p)))throw new CodeError('暂不支持可变参数宏',line);macros.set(m[1],{params,body:lex(m[3],line)});continue;}
  if(kind==='undef'){macros.delete(body.trim());continue;}
  if(kind==='pragma'&&body.trim()==='once')continue;
  throw new CodeError(`暂不支持 #${kind} 预处理指令`,line);
 }flush();if(conditions.length)throw new CodeError('条件编译缺少 #endif',lines.length);out.push({v:'EOF',t:'eof',line:lines.length});return out;
}
class Parser{
 constructor(source){this.ts=tokenize(source);this.p=0;this.structs=Object.create(null);this.aliases=Object.create(null);this.enums=new Set();this.anon=0;this.loopDepth=0;this.switchDepth=0;}
 get t(){return this.ts[this.p];}is(v){return this.t.v===v;}pop(){return this.ts[this.p++];}match(v){if(this.is(v)){this.p++;return true;}return false;}
 need(v){if(!this.match(v))throw new CodeError(`这里需要 ${v}，实际为 ${this.t.v}`,this.t.line);}
 name(){if(this.t.t!=='id')throw new CodeError('需要变量或函数名',this.t.line);return this.pop().v;}
 isType(v=this.t.v){return BUILTINS.has(v)||QUALIFIERS.has(v)||Object.hasOwn(this.structs,v)||Object.hasOwn(this.aliases,v)||this.enums.has(v)||v==='struct'||v==='enum';}
 type(){const parts=[];while(QUALIFIERS.has(this.t.v))parts.push(this.pop().v);const t=this.t;
  if(this.match('struct')){const n=this.name();if(!Object.hasOwn(this.structs,n))throw new CodeError(`未定义结构体 ${n}`,t.line);parts.push(n);}
  else if(this.match('enum')){const n=this.name();if(!this.enums.has(n))throw new CodeError(`未定义枚举 ${n}`,t.line);parts.push('int');}
  else if(Object.hasOwn(this.aliases,t.v)){parts.push(this.aliases[this.pop().v]);}
  else if(Object.hasOwn(this.structs,t.v)){parts.push(this.pop().v);}
  else if(this.enums.has(t.v)){this.pop();parts.push('int');}
  else {let n=0;while(BUILTINS.has(this.t.v)){parts.push(this.pop().v);n++;}if(!n)throw new CodeError(`不支持的声明 ${t.v}。类、模板和指针尚未适配`,t.line);}
  while(QUALIFIERS.has(this.t.v))parts.push(this.pop().v);
  if(parts.filter(p=>p==='long').length>1)throw new CodeError('暂不支持 64 位 long long；当前整数模型为 32 位',t.line);
  if(this.is('*'))throw new CodeError('暂不支持指针；函数数组参数可写为 int a[]',this.t.line);return parts.join(' ');
 }
 program(){const globals=[],funcs=Object.create(null),protos=Object.create(null);
  while(!this.is('EOF')){
   if(this.match(';'))continue;const line=this.t.line;
   if(this.is('typedef')){this.pop();if(this.is('struct')&&(this.ts[this.p+1]?.v==='{'||this.ts[this.p+2]?.v==='{')){globals.push(...this.record(true));continue;}const type=this.type(),name=this.name();this.need(';');this.aliases[name]=type;continue;}
   if(this.match('using')){const name=this.name();this.need('=');this.aliases[name]=this.type();this.need(';');continue;}
   if(this.is('struct')&&(this.ts[this.p+1]?.v==='{'||this.ts[this.p+2]?.v==='{')){globals.push(...this.record(false));continue;}
   if(this.is('enum')&&(this.ts[this.p+1]?.v==='{'||this.ts[this.p+2]?.v==='{')){globals.push(...this.enumeration());continue;}
   const type=this.type(),name=this.name();
   if(this.match('(')){
    const params=[];if(!this.is(')')){if(this.is('void')&&this.ts[this.p+1]?.v===')')this.pop();else do{const type=this.type(),reference=this.match('&'),name=this.t.t==='id'?this.name():null,dims=this.dimensions();const value=this.match('=')?this.expr(1):null;params.push({type,name,reference,dims,value});}while(this.match(','));}this.need(')');
    if(this.match(';')){protos[name]=params;continue;}
    if(Object.hasOwn(funcs,name))throw new CodeError(`重复定义 ${name}()；函数重载暂不支持，setup() 和 loop() 只能各一个`,line);
    if(params.some(p=>!p.name))throw new CodeError('函数定义需要参数名',line);
    const previous=protos[name];params.forEach((p,i)=>{if(!p.value&&previous?.[i]?.value)p.value=previous[i].value;});
    funcs[name]={type,params,body:this.block(),line};
   }else globals.push(this.declaration(type,name,line,true));
  }if(!funcs.setup||!funcs.loop)throw new CodeError('需要 void setup() 和 void loop()');return {globals,funcs,structs:this.structs,aliases:this.aliases};
 }
 record(alias){const line=this.pop().line,name=this.is('{')?`__record${++this.anon}`:this.name();if(Object.hasOwn(this.structs,name))throw new CodeError(`重复定义结构体 ${name}`,line);const fields=[];this.structs[name]=fields;this.need('{');
  while(!this.match('}')){if(this.is('EOF'))throw new CodeError('结构体缺少 }',line);const l=this.t.line,type=this.type(),field=this.name();if(this.is('('))throw new CodeError('结构体成员函数尚未适配',l);const decl=this.declaration(type,field,l,true);for(const v of decl.vars){if(fields.some(f=>f.name===v.name))throw new CodeError(`重复结构体成员 ${v.name}`,l);fields.push({...v,type,line:l});}}
  if(alias){const a=this.name();this.aliases[a]=name;this.need(';');return [];}
  if(this.match(';'))return [];return [this.declaration(name,this.name(),line,true)];
 }
 enumeration(){const line=this.pop().line;if(!this.is('{'))this.enums.add(this.name());this.need('{');const vars=[];let last=null;
  while(!this.is('}')){const name=this.name();const value=this.match('=')?this.expr(1):last?{k:'binary',op:'+',left:{k:'id',name:last,line},right:{k:'num',v:1,line},line}:{k:'num',v:0,line};vars.push({name,dims:[],value});last=name;if(!this.match(','))break;}this.need('}');this.need(';');return [{k:'decl',type:'const int',vars,line}];
 }
 dimensions(){const dims=[];while(this.match('[')){dims.push(this.is(']')?null:this.expr(1));this.need(']');if(dims.length>4)throw new CodeError('最多支持四维数组',this.t.line);}return dims;}
 initializer(){if(!this.match('{'))return this.expr(1);const line=this.t.line,items=[];if(!this.is('}'))do{items.push(this.initializer());}while(this.match(',')&&!this.is('}'));this.need('}');return {k:'init',items,line};}
 declaration(type,name,line,semi){const vars=[];do{const dims=this.dimensions();const value=this.match('=')||this.is('{')?this.initializer():null;vars.push({name,dims,value});if(!this.match(','))break;name=this.name();}while(true);if(semi)this.need(';');return {k:'decl',type,vars,line};}
 block(){const line=this.t.line;this.need('{');const items=[];while(!this.is('}')){if(this.is('EOF'))throw new CodeError('缺少右花括号 }',line);items.push(this.stmt());}this.need('}');return {k:'block',items,line};}
 loopBody(){this.loopDepth++;try{return this.stmt();}finally{this.loopDepth--;}}
 stmt(){const line=this.t.line;if(this.is('{'))return this.block();if(this.match(';'))return {k:'empty',line};
  if(this.match('if')){this.need('(');const cond=this.expr();this.need(')');const yes=this.stmt(),no=this.match('else')?this.stmt():null;return {k:'if',cond,yes,no,line};}
  if(this.match('for')){this.need('(');let init=null;if(!this.is(';')){if(this.isType()){const type=this.type();init=this.declaration(type,this.name(),line,false);}else init={k:'expr',expr:this.expr(),line};}this.need(';');const cond=this.is(';')?null:this.expr();this.need(';');const step=this.is(')')?null:this.expr();this.need(')');return {k:'for',init,cond,step,body:this.loopBody(),line};}
  if(this.match('while')){this.need('(');const cond=this.expr();this.need(')');return {k:'while',cond,body:this.loopBody(),line};}
  if(this.match('do')){const body=this.loopBody();this.need('while');this.need('(');const cond=this.expr();this.need(')');this.need(';');return {k:'do',body,cond,line};}
  if(this.match('switch')){this.need('(');const expr=this.expr();this.need(')');this.need('{');const cases=[];let current=null,hasDefault=false;this.switchDepth++;
   while(!this.match('}')){if(this.is('EOF'))throw new CodeError('switch 缺少 }',line);if(this.match('case')){current={value:this.expr(1),items:[]};this.need(':');cases.push(current);}else if(this.match('default')){if(hasDefault)throw new CodeError('重复 default',this.t.line);hasDefault=true;this.need(':');current={value:null,items:[]};cases.push(current);}else{if(!current)throw new CodeError('switch 中需要 case 或 default',this.t.line);current.items.push(this.stmt());}}
   this.switchDepth--;return {k:'switch',expr,cases,line};}
  if(this.match('return')){const expr=this.is(';')?null:this.expr();this.need(';');return {k:'return',expr,line};}
  if(this.is('break')||this.is('continue')){const k=this.pop().v;if(k==='continue'?!this.loopDepth:!this.loopDepth&&!this.switchDepth)throw new CodeError(`${k} 不能写在循环${k==='break'?'或 switch':''}之外`,line);this.need(';');return {k,line};}
  if(this.isType()){const type=this.type();return this.declaration(type,this.name(),line,true);}
  const expr=this.expr();this.need(';');return {k:'expr',expr,line};
 }
 expr(min=0){let left=this.prefix();while(Object.hasOwn(PREC,this.t.v)&&PREC[this.t.v]>=min){const {v:op,line}=this.pop(),p=PREC[op];if(op==='?'){const yes=this.expr();this.need(':');left={k:'ternary',cond:left,yes,no:this.expr(1),line};continue;}const right=this.expr(p+(p===1?0:1));left={k:p===1?'assign':op===','?'sequence':'binary',op,left,right,line};}return left;}
 prefix(){const token=this.pop(),{v,t,line}=token;let n;
  if(['!','~','-','+','++','--'].includes(v))n={k:'unary',op:v,arg:this.prefix(),line};
  else if(v==='('){if(this.isType()){const type=this.type();this.need(')');n={k:'cast',type,arg:this.prefix(),line};}else{n=this.expr();this.need(')');}}
  else if(v==='sizeof'){this.need('(');if(this.isType()){const type=this.type(),dims=this.dimensions();this.need(')');n={k:'sizeof',type,dims,line};}else{const arg=this.expr();this.need(')');n={k:'sizeof',arg,line};}}
  else if(v==='{'){this.p--;n=this.initializer();}
  else if(t==='num'||t==='str')n={k:t,v,float:token.float,line};else if(t==='id')n={k:'id',name:v,line};else throw new CodeError(`不支持的表达式 ${v}；指针和取地址尚未适配`,line);
  if(n.k==='id'&&this.isType(n.name)&&this.is('{'))n={k:'cast',type:this.aliases[n.name]??n.name,arg:this.initializer(),line};
  while(true){if(this.match('(')){const args=[];if(!this.is(')'))do{args.push(this.expr(1));}while(this.match(','));this.need(')');n={k:'call',callee:n,args,line};}
   else if(this.match('.'))n={k:'member',object:n,name:this.name(),line};
   else if(this.match('[')){const index=this.expr();this.need(']');n={k:'index',object:n,index,line};}
   else if(this.is('++')||this.is('--'))n={k:'postfix',op:this.pop().v,arg:n,line};else break;}
  return n;
 }
}
export function compile(source){try{return new Parser(source).program();}catch(e){if(e instanceof RangeError)throw new CodeError('语法嵌套过深，请简化表达式');throw e;}}
