export const BOARD_PARTS = {
  esp32:{title:'ESP32 开发板',label:'01 · ESP32',description:'读取 SD 卡中的音频，通过 GPIO25 的 DAC 输出音乐。两侧各 15 针排针；开发板内的金属屏蔽罩下是 ESP32 模组。',connection:'GPIO25 → 低通与隔直 → 音乐音量 → 混音',center:[-2.85,.50,-1.12],size:[2.2,3.50]},
  sd:{title:'MicroSD 卡模块',label:'02 · SD 卡',description:'存储单声道、16 位 PCM、22,050 Hz WAV。SPI 接线：CS 21、MOSI 23、MISO 19、SCK 18，逻辑电平为 3.3 V。',connection:'SD 卡 → ESP32 → 8 位 DAC',center:[-.75,.48,-2.12],size:[1.45,1.55]},
  timer:{title:'NE555 八键音源',label:'03 · NE555',description:'八个按键选择不同定时电阻，产生单音方波。板前端的八键可以直接按；任意时刻只选择一个音符。',connection:'NE555 的 3 脚 → 衰减与隔直 → 琴键音量 → 混音',center:[-.68,.40,.02],size:[1.1,1.4]},
  mixer:{title:'MCP6002 前级与混音',label:'04 · MCP6002',description:'双运放的 A 路放大话筒信号，交流增益约 101；B 路将音乐、琴键、话筒相加。音频围绕约 2.49 V 偏置变化。',connection:'三路音源 → 运放求和 → 主音量 → LM386',center:[1.18,.40,-.15],size:[1.12,1.4]},
  mic:{title:'驻极体麦克风',label:'05 · 话筒',description:'顶部带小孔的金属圆筒是咪头。信号先经过偏置和隔直，再进入 MCP6002 的前置放大通道。',connection:'咪头 → 前级放大 → 话筒音量 → 混音',center:[1.18,.45,-2.25],size:[.85,.85]},
  amp:{title:'LM386 扬声器功放',label:'06 · LM386',description:'增益设为 20 倍，输出通过 220 µF 电容连接 8 Ω 扬声器。扬声器标称 1 W 是选型额定值，不代表本方案的实际输出功率。',connection:'主音量 → LM386 → 输出隔直电容 → 扬声器',center:[3.20,.40,-.05],size:[1.10,1.40]}
};

export function createBoardPlan(host,onSelect){
  const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 960 660');svg.classList.add('board-plan');svg.setAttribute('aria-label','电路板二维器件布局');
  const node=(tag,attrs,parent=svg)=>{const n=document.createElementNS(ns,tag);for(const [k,v] of Object.entries(attrs))n.setAttribute(k,v);parent.append(n);return n;};
  node('rect',{x:12,y:12,width:936,height:636,rx:20,fill:'#176f54',stroke:'#0a513e','stroke-width':4});
  node('path',{d:'M95 300 H220 V450 H540 V355 M415 270 V435 H545 M595 140 V370 H530 M560 320 H770 V175',fill:'none',stroke:'#67c8a3','stroke-width':5,'stroke-linejoin':'round'});
  const name=(text,x,y,size=23,parent=svg)=>{const t=node('text',{x,y,fill:'#f1f5df','text-anchor':'middle','font-family':'system-ui,sans-serif','font-size':size},parent);t.textContent=text;return t;};
  name('TRIO · 三路混音电路板',470,48,24);
  for(const [id,p] of Object.entries(BOARD_PARTS)){
    const [x,,z]=p.center,[w,d]=p.size,cx=480+x*91,cy=330+z*91,bw=w*82,bh=d*82;
    const g=node('g',{'data-part-id':id,role:'button',tabindex:0,'aria-label':p.title});
    node('rect',{x:cx-bw/2,y:cy-bh/2,width:bw,height:bh,rx:8,fill:id==='esp32'?'#152c30':id==='sd'?'#2a587c':id==='mic'?'#77867d':'#263d3d',stroke:'#c3d8a9','stroke-width':2},g);
    if(id==='esp32'){node('rect',{x:cx-48,y:cy-80,width:96,height:115,rx:5,fill:'#abb9ae'},g);for(let i=0;i<15;i++){node('rect',{x:cx-bw/2-5,y:cy-bh/2+9+i*18,width:10,height:9,fill:'#e2c780'},g);node('rect',{x:cx+bw/2-5,y:cy-bh/2+9+i*18,width:10,height:9,fill:'#e2c780'},g);}name('ESP32',cx,cy-21,22,g);name('GPIO25 · DAC',cx,cy+85,17,g);}
    else name(id==='timer'?'NE555':id==='mixer'?'MCP6002':id==='amp'?'LM386':id==='sd'?'SD 卡':'话筒',cx,cy+8,id==='mixer'?17:21,g);
    g.addEventListener('click',()=>onSelect(id));g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onSelect(id);}});
  }
  ['音乐音量','琴键音量','话筒音量','主音量'].forEach((t,i)=>{const x=185+i*196;node('circle',{cx:x,cy:489,r:32,fill:'#243f3d',stroke:'#e4eda6','stroke-width':4});node('path',{d:`M${x} 489 v-22`,stroke:'#e4eda6','stroke-width':5});name(t,x,541,20);});
  ['C','D','E','F','G','A','B','C′'].forEach((t,i)=>{const x=146+i*94;node('rect',{x:x-23,y:571,width:46,height:42,rx:7,fill:'#e9ead4'});const label=name(t,x,600,22);label.setAttribute('fill','#203c33');});
  for(const x of [39,921])for(const y of [39,621])node('circle',{cx:x,cy:y,r:9,fill:'#d7bd77'});
  host.append(svg);return svg;
}
