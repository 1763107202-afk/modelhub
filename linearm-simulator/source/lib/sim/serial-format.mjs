import {CodeError} from './cpp-parser.mjs';
import {baseType} from './cpp-values.mjs';
export function serialText(name,args,type,line){
 if(name==='printf'){
  if(typeof args[0]!=='string')throw new CodeError('Serial.printf 的第一个参数需要格式字符串',line);let i=1;
  const pattern=/%([-+ 0#]*)(\d+)?(?:\.(\d+))?(?:hh|ll|h|l|z)?([diuoxXfFeEgGsc%])/g;
  if(args[0].replace(pattern,'').includes('%'))throw new CodeError('Serial.printf 包含尚未支持的格式符',line);
  const text=args[0].replace(pattern,(token,flags,width,precision,kind)=>{
   if(kind==='%')return '%';if(i>=args.length)throw new CodeError('Serial.printf 参数不足',line);const v=args[i++];let s;
   if(kind==='s')s=String(v);else if(kind==='c')s=String.fromCodePoint(Number(v));
   else if(/[fFeEgG]/.test(kind)){const p=Math.min(20,Number(precision??6));s=/[fF]/.test(kind)?Number(v).toFixed(p):/[eE]/.test(kind)?Number(v).toExponential(p):Number(v).toPrecision(Math.max(1,p));}
   else s=(/[uoxX]/.test(kind)?Number(v)>>>0:Math.trunc(Number(v))).toString(/[xX]/.test(kind)?16:kind==='o'?8:10);
   if(/[XFEG]/.test(kind))s=s.toUpperCase();if(flags.includes('+')&&Number(v)>=0&&!/[sc]/.test(kind))s='+'+s;
   if(flags.includes('#')&&Number(v)!==0){if(/[xX]/.test(kind))s=(kind==='X'?'0X':'0x')+s;else if(kind==='o')s='0'+s;}if(flags.includes(' ')&&!flags.includes('+')&&Number(v)>=0&&/[difFeEgG]/.test(kind))s=' '+s;
   const n=Math.min(1000,Number(width??0));return flags.includes('-')?s.padEnd(n):flags.includes('0')&&/^[+-]/.test(s)?s[0]+s.slice(1).padStart(n-1,'0'):s.padStart(n,flags.includes('0')?'0':' ');
  });
  // Unsupported format specifiers should never print an apparently valid result.
  
  return text;
 }
 if(!args.length)return '';const value=args[0],t=baseType(type);
 if(typeof value==='number'){
  if(t==='float'||t==='double'){const digits=args[1]??2;if(!Number.isInteger(digits)||digits<0||digits>20)throw new CodeError('小数位数需要为 0–20',line);return value.toFixed(digits);}
  if(t==='char'&&args.length===1)return String.fromCodePoint(value);
  const radix=args[1]??10;if(![2,8,10,16].includes(radix))throw new CodeError('串口进制支持 BIN / OCT / DEC / HEX',line);return (radix===10?value:value>>>0).toString(radix).toUpperCase();
 }
 if(Array.isArray(value)&&baseType(type)==='char')return String.fromCodePoint(...value.slice(0,value.indexOf(0)<0?value.length:value.indexOf(0)));
 if(value&&typeof value==='object')throw new CodeError('Serial.print 请指定结构体成员或数组元素',line);
 return String(value);
}
