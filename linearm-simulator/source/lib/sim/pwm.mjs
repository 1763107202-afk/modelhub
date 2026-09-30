import {CodeError} from './cpp-parser.mjs';
// Duty-cycle model for the classic ESP32: no pulse timing or channel contention.
export class PWMController{
 constructor(write){this.write=write;this.mode=null;this.channels=new Map();this.pins=new Map();this.analogBits=new Map();}
 select(mode,line){if(this.mode&&this.mode!==mode)throw new CodeError('同一程序不能混用 ESP32 2.x 的 LEDC 通道写法与 3.x 的引脚写法',line);this.mode=mode;}
 pin(pin,line){if(!Number.isInteger(pin)||pin<0||pin>39)throw new CodeError(`无效的 GPIO ${pin}`,line);}
 channel(ch,line){if(!Number.isInteger(ch)||ch<0||ch>15)throw new CodeError('LEDC 通道需为 0–15',line);}
 settings(freq,bits,line){if(!Number.isFinite(freq)||freq<=0||!Number.isInteger(bits)||bits<1||bits>20)throw new CodeError('PWM 频率需大于 0，分辨率需为 1–20 位',line);}
 attach(pin,ch,line){this.pin(pin,line);this.channel(ch,line);if(!this.channels.has(ch))throw new CodeError('请先调用 ledcSetup 配置该通道',line);this.pins.set(pin,ch);this.apply(ch,this.channels.get(ch).duty??0,line);}
 apply(ch,duty,line){const config=this.channels.get(ch);if(!config)throw new CodeError('LEDC 尚未配置，请先配置并绑定引脚',line);if(!Number.isFinite(duty)||duty<0)throw new CodeError('PWM 占空比需要非负数字',line);const max=2**config.bits-1;config.duty=Math.min(max,Math.trunc(duty));for(const [pin,c] of this.pins)if(c===ch)this.write(pin,255*config.duty/max,line);return 1;}
 analog(pin,duty,line){this.pin(pin,line);if(!Number.isFinite(duty))throw new CodeError('PWM 需要数字',line);const max=2**(this.analogBits.get(pin)??8)-1;this.write(pin,Math.max(0,Math.min(max,Math.trunc(duty)))*255/max,line);return 0;}
 io(name,a,line){
  const [x,y,z,ch]=a;
  switch(name){
   case 'analogWrite':return this.analog(x,Number(y),line);
   case 'analogWriteResolution':this.pin(x,line);this.settings(1000,y,line);this.analogBits.set(x,y);return 0;
   case 'analogWriteFrequency':this.pin(x,line);this.settings(y,8,line);return 0;
   case 'ledcSetup':this.select('legacy',line);this.channel(x,line);this.settings(y,z,line);this.channels.set(x,{freq:y,bits:z,duty:0});return y;
   case 'ledcAttachPin':this.select('legacy',line);this.attach(x,y,line);return 0;
   case 'ledcAttach':case 'ledcAttachChannel':{
    this.select('modern',line);this.settings(y,z,line);this.pin(x,line);if(this.pins.has(x))throw new CodeError(`GPIO ${x} 已绑定 LEDC，请先解除绑定`,line);
    const channel=name==='ledcAttachChannel'?ch:Array.from({length:16},(_,i)=>i).find(i=>!this.channels.has(i));this.channel(channel,line);
    if(!this.channels.has(channel))this.channels.set(channel,{freq:y,bits:z,duty:0});this.attach(x,channel,line);return 1;
   }
   case 'ledcWrite':return this.apply(this.mode==='legacy'?x:this.pins.get(x),y,line);
   case 'ledcWriteChannel':if(this.mode==='legacy')throw new CodeError('ledcWriteChannel 属于 ESP32 3.x 写法',line);return this.apply(x,y,line);
   case 'ledcRead':{const config=this.channels.get(this.mode==='legacy'?x:this.pins.get(x));if(!config)throw new CodeError('LEDC 尚未绑定',line);return config.duty;}
   case 'ledcDetachPin':case 'ledcDetach':this.pin(x,line);this.pins.delete(x);this.write(x,0,line);return 1;
   default:throw new CodeError(`暂不支持 ${name}()`,line);
  }
 }
}
