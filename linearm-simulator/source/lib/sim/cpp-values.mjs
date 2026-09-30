import {CodeError} from './cpp-parser.mjs';
export const metadata=new WeakMap();
export const baseType=type=>type.replace(/\b(const|static|volatile|extern|inline)\b/g,'').trim().replace(/\s+/g,' ');
export const integralType=type=>!['float','double','String','Servo','void'].includes(baseType(type));
export function copyValue(value){
 if(!value||typeof value!=='object'||value.servo)return value;
 const result=Array.isArray(value)?value.map(copyValue):Object.assign(Object.create(null),Object.fromEntries(Object.entries(value).map(([k,v])=>[k,copyValue(v)])));
 const meta=metadata.get(value);if(meta)metadata.set(result,{...meta,readonly:false});return result;
}
export function cast(value,type,line=1){
 const t=baseType(type),meta=value&&typeof value==='object'?metadata.get(value):null;
 if(meta?.kind==='struct'){if(meta.type!==t)throw new CodeError(`结构体类型不匹配：${meta.type} → ${t}`,line);return copyValue(value);}
 if(Array.isArray(value)||value?.servo)return value;
 if(t==='String')return String(value??'');if(t==='void')return 0;
 if(t==='bool'||t==='boolean')return value?1:0;
 const number=Number(value);if(!Number.isFinite(number))throw new CodeError(`不能把这个值转换为 ${t}`,line);
 if(t==='float'||t==='double')return number;
 if(!/^(?:int|long|short|char|byte|word|size_t|u?int\d+_t|unsigned(?: .*?)?|signed(?: .*?)?)$/.test(t))throw new CodeError(`需要 ${t} 结构体值`,line);
 const n=Math.trunc(number),bits=/char|byte|int8_t/.test(t)?8:/short|word|int16_t/.test(t)?16:32,unsigned=/unsigned|^uint|^byte$|^word$|^size_t$/.test(t);
 if(unsigned)return bits===32?n>>>0:(n%(2**bits)+2**bits)%(2**bits);
 return bits===32?n|0:(n<<(32-bits))>>(32-bits);
}
export class Env{
 constructor(parent=null){this.parent=parent;this.vars=Object.create(null);}
 declare(name,value,type='int',dims=[],line=1){if(Object.hasOwn(this.vars,name))throw new CodeError(`重复声明 ${name}`,line);this.vars[name]={v:cast(value,type,line),type,dims};}
 bind(name,cell,line=1){if(Object.hasOwn(this.vars,name))throw new CodeError(`重复声明 ${name}`,line);this.vars[name]=cell;}
 lookup(name,line=1){if(Object.hasOwn(this.vars,name))return this.vars[name];if(this.parent)return this.parent.lookup(name,line);throw new CodeError(`未定义变量 ${name}`,line);}
 get(name,line){return this.lookup(name,line).v;}
 set(name,value,line){const c=this.lookup(name,line);if(/\bconst\b/.test(c.type))throw new CodeError(`不能修改常量 ${name}`,line);if(c.dims.length)throw new CodeError('不能给整个数组赋值，请修改数组元素',line);c.v=cast(value,c.type,line);return c.v;}
}
