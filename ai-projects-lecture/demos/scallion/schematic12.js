const e=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;');
export function diagram12(state,t,program){
const f=state.flow,phase=f.phase.id,p=f.stageProgress,green='#8dd6b7',white='#dceae7',blue='#59c4de',gold='#deb97b';
const text=(x,y,s,c=white,sz=13)=>`<text x="${x}" y="${y}" fill="${c}" font-size="${sz}" font-family="sans-serif">${e(s)}</text>`;
const rect=(x,y,w,h,fill='#284859',stroke='#78929d',r=3)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" stroke="${stroke}"/>`;
const stem=(x,y,film=false)=>`<path d="M${x-6} ${y}L${x-5} ${y-104}L${x+5} ${y-104}L${x+6} ${y}Z" fill="#e5e9ca"/><path d="M${x-4} ${y-102}Q${x-25} ${y-154} ${x-13} ${y-180}M${x} ${y-101}Q${x+4} ${y-160} ${x+18} ${y-177}M${x+3} ${y-101}L${x+6} ${y-184}" stroke="#6fbb71" stroke-width="6" fill="none"/>${film?`<rect x="${x-15}" y="${y-118}" width="30" height="125" fill="#b5deed1c" stroke="#9bd6e2" stroke-width="1.5"/>`:''}`;
const motor=(x,y)=>rect(x,y,35,28,'#243640')+text(x+7,y+18,'M',green,12);
const rails=(x,y,w)=>`<path d="M${x} ${y}h${w}M${x} ${y+15}h${w}" stroke="#a8b8bd" stroke-width="4"/><path d="M${x} ${y+7}h${w}" stroke="#b1a47f" stroke-width="3"/>`;
let content='';
if(['infeed','feed','load','root','trim'].includes(phase)){
let angle=phase==='infeed'?(state.q.infeed_turn12??0)*180/Math.PI:-90;
content=rect(45,310,275,18,'#243740')+rails(45,335,310)+motor(47,360)+`<path d="M65 302h230" stroke="${green}" stroke-width="2" stroke-dasharray="10 13" stroke-dashoffset="${-t*20%23}"/>`;
content+=`<g transform="translate(283 296) rotate(${90+angle})">${stem(0,0)}${rect(-24,-100,48,12,'#244c45',green)}</g>`;
content+=rect(360,305,160,14)+rect(390,310,28,38,'#41605a')+stem(404,306)+rect(385,175,38,14,'#285745',green)+text(55,265,'双通道定距输送',green)+text(250,110,'夹持翻转90°',gold)+text(385,382,'立式托杯 → 主夹');
content+=text(45,433,phase==='infeed'?'到料检测 → 闭夹 → 翻转 → 平移 → 下降入杯 → 松夹 → 退回':state.label,white,12);
}else if(phase==='wash'||phase==='dry'){
content=rect(175,95,270,286,'#163c4a55',blue)+stem(310,327)+rect(140,345,340,28,'#25434b',blue)+`<path d="M430 371v45h75" stroke="#df9e5c" stroke-width="6" fill="none"/>`;
for(const x of[227,392]){content+=rect(x,175,12,155,'#2d6980',blue);for(let j=0;j<6;j++)content+=`<path d="M${x<300?x+12:x} ${190+j*24}L${x<300?290:330} ${201+j*24}" stroke="${blue}" opacity="${.3+.6*((t+j*.2)%1)}" stroke-width="${phase==='wash'?2:1}"/>`;}
content+=text(190,70,phase==='wash'?'喷淋清洗 · 两侧挡水':'水阀关闭 · 对向风刀向下除水',green)+text(435,435,'污水下排',gold)+text(70,435,'关水 → 滴沥 → 除水 → 退回 → 开门 → 分度');
}else if(phase==='weigh'){
content=stem(300,300)+rect(275,300,50,24,'#c5c9b0')+rect(270,334,84,19,'#aaaeb2')+rect(330,354,26,41)+rect(220,395,180,18)+rails(150,419,330)+motor(110,415);
const jaw=state.q.grip_0_0_jaw_1>0?35:0;content+=rect(255-jaw,138,25,15,'#35745e',green)+rect(320+jaw,138,25,15,'#35745e',green)+`<path d="M300 316v15" stroke="${gold}" stroke-width="4" marker-end="url(#arrow)"/>`;
content+=text(385,160,'主夹彻底松开',green)+text(380,341,'传感器承载端',gold)+text(358,388,'固定端 / 升降底座')+text(55,78,'成袋后检重：夹爪和固定件脱离，整袋只由承载端支承',green,13)+text(55,470,'托杯升起 → 主夹松开 → 等待稳定 → 读数 → 重新夹持 → 退回');
}else if(phase==='wrap'||phase==='seal'){
content=stem(308,315,true);for(const x of[119,483])content+=`<circle cx="${x}" cy="212" r="36" fill="#cbb47e" stroke="${gold}"/><circle cx="${x}" cy="212" r="9" fill="#183441"/><path d="M${x} 176L${x<300?269:347} 180L${x<300?289:327} 305" fill="none" stroke="#a2cbd6" stroke-width="3"/>`;
content+=rect(278,180,4,133,gold,gold)+rect(333,180,4,133,gold,gold)+text(55,104,'膜卷 → 夹辊定长 → 两侧纵封与切片',green);
const close=phase==='seal'?1-Math.min(1,Math.abs(state.q.seal_jaw11_1??.08)/.08):0;
content+=rect(230,342,65,13,'#bd874b',gold)+rect(345,342,65,13,'#bd874b',gold)+`<path d="M270 335L${292+close*14} 335M370 335L${328-close*14} 335" stroke="${gold}" stroke-width="6"/>`+rails(180,396,300)+motor(137,393);
content+=text(425,351,'根端下方封底',gold,12)+text(55,445,'顶部保持开口；先热封，再保压冷却，最后开钳移载。',white,12);
}else if(phase==='outfeed'||phase==='return'){
content=rect(120,390,400,13)+`<ellipse cx="320" cy="392" rx="200" ry="45" fill="#1e4444" stroke="${green}"/>`;
for(let j=0;j<5;j++){let x=165+j*75;content+=rect(x-18,338,36,42,'#718977')+`<ellipse cx="${x}" cy="296" rx="23" ry="7" fill="none" stroke="${green}" stroke-width="4"/><ellipse cx="${x}" cy="262" rx="23" ry="7" fill="none" stroke="${green}" stroke-width="4"/><path d="M${x+25} 392V260" stroke="#758e96" stroke-width="4"/>`;}
let up=(state.q.unload_Z12??0)*180,x=315;content+=stem(x,338-up,true)+rect(x-24,185-up,48,13,'#315e4e',green)+text(65,93,'上提 → 平移 → 竖直穿圈 → 杯底承接 → 松夹',green)+text(455,258,'上层扶正圈',green,12)+text(455,295,'下层扶正圈',green,12)+text(455,356,'底托杯承重',gold,12)+text(65,465,'12排 × 双通道 = 24位；到满盘后停机等待取料。',white,12);
}else{
content=`<ellipse cx="320" cy="300" rx="185" ry="115" fill="#15333d" stroke="#65828b" stroke-width="3"/>`;
for(let i=0;i<6;i++){let a=i*Math.PI/3,x=320+170*Math.cos(a),y=300+100*Math.sin(a);content+=`<circle cx="${x}" cy="${y}" r="25" fill="#305348" stroke="${green}"/>`+text(x-5,y+5,String(i+1),green,13);}
content+=stem(320,300)+text(90,85,'六工位正向分度 · 工具退出才允许转位',green)+text(55,450,state.label,white,12);
}
return `<svg viewBox="0 0 640 510" role="img" aria-label="${e(f.phase.label)}机构剖解与动作示意"><defs><marker id="arrow" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto"><path d="M0 0L6 3L0 6Z" fill="${gold}"/></marker></defs>${text(22,29,'PROCESS DETAIL / '+f.phase.label,green,12)}${content}${text(22,502,'原理示意 · 动作与三维模型共用时序；比例为便于阅读的示意比例','#89a6af',10)}</svg>`;
}
