// Browser audio approximation of the V2.0 circuit. SI units throughout.
// This is separate from the downloadable ngspice verification.
export const DEFAULT_VOLUMES = [0.70, 0.55, 0.50, 0.60];
export const DEFAULT_NOTES = [261.63,293.66,329.63,349.23,392,440,493.88,523.25];
export const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));

class Pole {
  constructor(fs,tau,hp=false){let k=2*fs*tau;this.a=(k-1)/(k+1);this.b=(hp?k:1)/(k+1);this.hp=hp;this.x=0;this.y=0;}
  step(x){this.y=this.a*this.y+this.b*(x+(this.hp?-this.x:this.x));this.x=x;return this.y;}
}

// Linear passive RC network, solved by trapezoidal companion models.
// Node -1 is ground, -2 is the ideal source. Capacitor histories persist
// when a pot is moved, so the coupling capacitors retain their charge.
class RCNetwork {
  constructor(fs,n,resistors,caps,out){this.fs=fs;this.n=n;this.caps=caps.map(([a,b,c])=>({a,b,g:2*fs*c,h:0}));this.out=out;this.v=new Float64Array(n);this.rhs=new Float64Array(n);this.update(resistors);}
  update(resistors){
    const n=this.n,m=Array.from({length:n},(_,i)=>Array.from({length:2*n},(_,j)=>j===i+n?1:0));
    this.src=new Float64Array(n);
    const stamp=(a,b,g)=>{if(a>=0){m[a][a]+=g;if(b>=0)m[a][b]-=g;else if(b===-2)this.src[a]+=g;}if(b>=0){m[b][b]+=g;if(a>=0)m[b][a]-=g;else if(a===-2)this.src[b]+=g;}};
    for(const [a,b,r] of resistors)stamp(a,b,1/Math.max(.001,r));
    for(const c of this.caps)stamp(c.a,c.b,c.g);
    for(let j=0;j<n;j++){
      let p=j;for(let i=j+1;i<n;i++)if(Math.abs(m[i][j])>Math.abs(m[p][j]))p=i;
      [m[j],m[p]]=[m[p],m[j]];let d=m[j][j];if(Math.abs(d)<1e-20)throw Error('Singular RC network');
      for(let k=0;k<2*n;k++)m[j][k]/=d;
      for(let i=0;i<n;i++)if(i!==j){let f=m[i][j];for(let k=0;k<2*n;k++)m[i][k]-=f*m[j][k];}
    }
    this.inv=m.map(row=>row.slice(n));
  }
  step(input){
    let {n,rhs,v}=this;for(let i=0;i<n;i++)rhs[i]=this.src[i]*input;
    for(const c of this.caps){if(c.a>=0)rhs[c.a]-=c.h;if(c.b>=0)rhs[c.b]+=c.h;}
    for(let i=0;i<n;i++){let s=0;for(let j=0;j<n;j++)s+=this.inv[i][j]*rhs[j];v[i]=s;}
    const voltage=i=>i>=0?v[i]:i===-2?input:0;
    for(const c of this.caps)c.h=-2*c.g*(voltage(c.a)-voltage(c.b))-c.h;
    return v[this.out];
  }
}

function pathR(p,series,rin,dac){
  let a=dac?1:0,w=a+1,i=a+2;
  const rs=[[a,w,series+10000*(1-p)],[w,-1,Math.max(.001,10000*p)],[i,-1,rin]];
  if(dac)rs.push([-2,0,1000]);return rs;
}
function masterR(p){return [[0,-1,1e6],[0,1,180000+10000*(1-p)],[1,-1,Math.max(.001,10000*p)],[1,-1,50000]];}

export class MixerDSP {
  constructor(fs=48000){
    this.fs=fs;this.config={power:false,playing:false,note:-1,test:false,live:false,overload:false,volumes:[...DEFAULT_VOLUMES],notes:[...DEFAULT_NOTES],duties:Array(8).fill(.535)};
    this.paths=[new RCNetwork(fs,4,pathR(.7,10000,47000,true),[[0,-1,22e-9],[0,1,1e-6],[2,3,1e-6]],3),new RCNetwork(fs,3,pathR(.55,33000,47000,false),[[-2,0,1e-6],[1,2,1e-6]],2),new RCNetwork(fs,3,pathR(.5,1000,22000,false),[[-2,0,1e-6],[1,2,1e-6]],2)];
    this.master=new RCNetwork(fs,2,masterR(.6),[[-2,0,10e-6]],1);
    this.micHP=new Pole(fs,.1,true);this.micGainHP=new Pole(fs,.01034,true);this.micLP=new Pole(fs,1/(2*Math.PI*9901));
    this.feedback=new Pole(fs,2.2e-6);this.ampLP=new Pole(fs,1/(2*Math.PI*300000));this.speakerHP=new Pole(fs,8.2*220e-6,true);
    this.phase=0;this.testPhase=0;this.dacClock=1;this.demoFrame=0;this.wavFrame=0;this.wav=null;this.dac=0;this.noteEnv=0;this.musicEnv=0;this.powerEnv=0;
    this.wave=new Float32Array(Math.round(fs*.02));this.write=0;this.clipMic=false;this.clipMix=false;this.clipAmp=false;this.peak=0;this.lastMix=0;this.lastPre=0;this.lastSpeaker=0;
  }
  configure(next){
    if(next.volumes){next={...next,volumes:next.volumes.map(v=>clamp(Number(v)||0,0,1))};const p=next.volumes;
      this.paths[0].update(pathR(p[0],10000,47000,true));this.paths[1].update(pathR(p[1],33000,47000,false));this.paths[2].update(pathR(p[2],1000,22000,false));this.master.update(masterR(p[3]));}
    if(Number.isInteger(next.note)&&next.note!==this.config.note&&next.note>=0)this.phase=0;
    Object.assign(this.config,next);
  }
  setWav(samples){this.wav=samples;this.wavFrame=0;this.demoFrame=0;}
  sample(mic=0){
    const c=this.config,fs=this.fs;
    this.powerEnv+=((c.power?1:0)-this.powerEnv)*Math.min(1,1/(fs*.015));
    this.musicEnv+=((c.power&&c.playing?1:0)-this.musicEnv)*Math.min(1,1/(fs*.012));
    this.noteEnv+=((c.power&&c.note>=0?1:0)-this.noteEnv)*Math.min(1,1/(fs*.004));
    this.dacClock+=22050/fs;
    if(this.dacClock>=1){this.dacClock-=1;
      let x=0;if(c.playing){if(this.wav){x=this.wav[this.wavFrame++%this.wav.length];}else{
        const t=this.demoFrame++/22050,beat=t/.24,n=[261.63,329.63,392,523.25,440,392,329.63,293.66][Math.floor(beat)%8],env=Math.exp(-3.6*(beat%1));
        x=.58*env*(Math.sin(2*Math.PI*n*t)+.28*Math.sin(4*Math.PI*n*t))+.10*Math.sin(2*Math.PI*130.815*t);
      }}
      this.dac=(Math.round((clamp(x,-1,1)+1)*127.5)/255*2-1)*1.65;
    }
    const n=c.note>=0?c.note:0;this.phase=(this.phase+c.notes[n]/fs)%1;
    const duty=c.duties[n]||.535,key=5*((this.phase<duty?1:0)-duty)*this.noteEnv;
    this.testPhase=(this.testPhase+700/fs)%1;
    let m=c.power?(c.test?Math.sin(2*Math.PI*this.testPhase)*(c.overload?.035:.0079):0)+(c.live?clamp(mic,-1,1)*.010:0):0;
    const mh=this.micHP.step(m),pre=this.micLP.step(mh+100*this.micGainHP.step(mh));
    const rail=2.43956;this.lastPre=clamp(pre,-rail,rail);this.clipMic||=Math.abs(pre)>rail;
    const v0=this.paths[0].step(this.dac*this.musicEnv),v1=this.paths[1].step(key),v2=this.paths[2].step(this.lastPre);
    const raw=this.feedback.step(-22000*(v0/47000+v1/47000+v2/22000));
    this.lastMix=clamp(raw,-rail,rail);this.clipMix||=Math.abs(raw)>rail;
    const gain=this.ampLP.step(this.master.step(this.lastMix)*20);this.clipAmp||=Math.abs(gain)>2;
    // Output-current limit is represented by the loaded 8 ohm voltage bound.
    this.lastSpeaker=this.speakerHP.step(clamp(gain,-1.64,1.64))*(8/8.2)*this.powerEnv;
    this.clipAmp||=Math.abs(gain)>1.64;
    this.wave[this.write++%this.wave.length]=this.lastMix;this.peak=Math.max(this.peak,Math.abs(this.lastMix));
    return clamp(this.lastSpeaker/2,-.99,.99);
  }
  meters(){
    const points=256,wave=Array.from({length:points},(_,i)=>this.wave[(this.write+Math.floor(i*this.wave.length/points))%this.wave.length]);
    const result={wave,peak:this.peak,clipMic:this.clipMic,clipMix:this.clipMix,clipAmp:this.clipAmp};
    this.peak=0;this.clipMic=false;this.clipMix=false;this.clipAmp=false;return result;
  }
}

export function parseWav(buffer){
  if(buffer.byteLength>25*1024*1024)throw Error('WAV 文件请小于 25 MB。');
  const d=new DataView(buffer),ascii=(p,n)=>String.fromCharCode(...new Uint8Array(buffer,p,n));
  if(d.byteLength<12||ascii(0,4)!=='RIFF'||ascii(8,4)!=='WAVE')throw Error('这不是有效的 RIFF WAV 文件。');
  let fmt=null,data=null;
  for(let p=12;p+8<=d.byteLength;){let name=ascii(p,4),size=d.getUint32(p+4,true),start=p+8;if(start+size>d.byteLength)throw Error('WAV 数据不完整。');
    if(name==='fmt '){if(size<16)throw Error('WAV 格式头不完整。');fmt=[d.getUint16(start,true),d.getUint16(start+2,true),d.getUint32(start+4,true),d.getUint16(start+12,true),d.getUint16(start+14,true)];}
    if(name==='data')data={start,size};p=start+size+(size&1);
  }
  if(!fmt||!data||!data.size)throw Error('WAV 缺少格式或音频数据。');
  if(fmt[0]!==1||fmt[1]!==1||fmt[2]!==22050||fmt[3]!==2||fmt[4]!==16||data.size%2)throw Error('请使用单声道、16 位 PCM、22,050 Hz 的 WAV 文件。');
  const samples=new Float32Array(data.size/2);for(let i=0;i<samples.length;i++)samples[i]=d.getInt16(data.start+i*2,true)/32768;
  return samples;
}
