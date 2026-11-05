import { MixerDSP } from './dsp-core.js';
class TrioProcessor extends AudioWorkletProcessor {
  constructor(){super();this.dsp=new MixerDSP(sampleRate);this.count=0;this.port.onmessage=({data})=>{if(data.type==='configure')this.dsp.configure(data.value);if(data.type==='wav')this.dsp.setWav(data.samples);};}
  process(inputs,outputs){const output=outputs[0][0],input=inputs[0]?.[0];if(!output)return true;
    for(let i=0;i<output.length;i++)output[i]=this.dsp.sample(input?.[i]||0);
    this.count+=output.length;if(this.count>=2048){this.count=0;this.port.postMessage(this.dsp.meters());}return true;
  }
}
registerProcessor('trio-mixer',TrioProcessor);
