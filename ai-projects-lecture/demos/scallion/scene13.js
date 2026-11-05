import {diagram12} from './schematic12.js';
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const C={ink:'#e3ece8',muted:'#98b0b5',line:'#617f8d',steel:'#8099a3',green:'#8dd6b7',gold:'#e1b878',blue:'#65cde0',red:'#ef9c88'};
const txt=(x,y,s,c=C.ink,z=13)=>`<text x="${x}" y="${y}" fill="${c}" font-size="${z}" font-family="sans-serif">${esc(s)}</text>`;
const box=(x,y,w,h,fill='#294553',stroke=C.line,r=3)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" stroke="${stroke}"/>`;
const ln=(x,y,X,Y,c=C.steel,w=3,dash='')=>`<path d="M${x} ${y}L${X} ${Y}" fill="none" stroke="${c}" stroke-width="${w}" ${dash?`stroke-dasharray="${dash}"`:''}/>`;
const circle=(x,y,r,fill,stroke=C.line)=>`<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="${stroke}"/>`;
function plant(x,y,{angle=0,film=0,band=false,gather=0,raw=true,scale=1}={}){
 const mouth=23,neck=23-13*gather,top=-155;
 let s=`<g transform="translate(${x} ${y}) rotate(${angle}) scale(${scale})">`;
 s+=`<path d="M-9 0L-8 -175Q-7 -200 -4 -205L5 -205Q8 -185 8 -173L10 0Z" fill="#e5ebcc" stroke="#bbc5a5"/>`;
 if(raw)for(let i=0;i<5;i++)s+=`<path d="M${(i-2)*3} 0q${i-2} 13 ${(i-2)*4} 20" stroke="#b9a27c" stroke-width="1.5" fill="none"/>`;
 s+=`<path d="M-4 -193Q-38 -209 -24 -258M0 -193Q-8 -230 10 -270M5 -193Q34 -210 32 -251" stroke="#70af70" stroke-width="8" fill="none"/>`;
 if(film>0){const h=152*film;s+=`<path d="M${-mouth} ${top}L${-neck} -130Q-25 -97 -25 ${top+h}L25 ${top+h}Q25 -97 ${neck} -130L${mouth} ${top}Z" fill="#7cbbd822" stroke="#96d4e3" stroke-width="1.6"/>`;if(film>=.99)s+=ln(-25,-3,25,-3,C.gold,3);for(let i=0;i<3;i++)s+=circle(-18+i*18,-72+(i%2)*24,1.2,'#afd7dc','#afd7dc');}
 if(band)s+=box(-12,-134,24,9,C.gold,C.gold,1)+ln(-11,-129,11,-129,'#725633',1);
 s+=txt(-13,36,'A组',C.green,10)+'</g>';return s;
}
function jaw(x,y,open=0,caption=true){return box(x-34-open,y-10,28,18,'#2d6853',C.green)+box(x+6+open,y-10,28,18,'#2d6853',C.green)+(caption?txt(x+65,y+4,open>2?'夹爪打开':'软垫夹持',C.green,11):'');}
const head=(label,caption)=>txt(24,30,'REVIEW 12.1 / '+label,C.green,12)+txt(24,54,caption,C.muted,11);
const foot=()=>txt(24,500,'机构方案示意 · 传感器为模拟信号 · 新增结构尚未完成CAD避碰验收',C.muted,10);
export function scene13(state,t,program,blocked=null){
 const f=state.flow,id=f.phase.id,q=state.q;let s=head(f.phase.label,'绿色：正在保持的支承　 金色：封接 / 束口　 蓝色：膜与气水');
 if(['infeed','feed','root','load'].includes(id)){
  // One tracked lane, shown at enlarged scale. Root positions follow the proposed
  // radial and Z joints; the second lane follows the same sequence in parallel.
  const P=(x,y,z)=>[38+155*x+120*z,478-190*y+22*z];
  const root=(()=>{if(f.owner==='belt')return [1.98,.58,-.37+.4*(1-f.beltFeed)];if(f.owner==='infeed'){const a=q.infeed_turn12??0;return [.84+(q.infeed_X12??.95)+.19,.23+(q.infeed_settle12??.53)+.27-.45*Math.cos(a)-.08*Math.sin(a),-.45-.45*Math.sin(a)+.08*Math.cos(a)];}if(f.owner==='stock')return [1.03+(q.feed_shuttle13??0),.58,0];if(f.owner==='loader')return [.33+(q.load_axis??0),.58,0];return [.33,.58,0];})();
  const [rx,ry]=P(...root),tilt=f.owner==='belt'?78:f.owner==='infeed'?78+(q.infeed_turn12??0)/Math.PI*156:0;
  const a=P(.98,.42,0),b=P(1.68,.42,0);s+=ln(...a,...b,C.steel,5)+ln(a[0],a[1]+10,b[0],b[1]+10,'#b3aa82',3)+box(a[0]-25,a[1]-8,25,25,'#243b45')+txt(a[0]-26,a[1]+42,'双杯送料滑台',C.muted,10);
  const c=P(1.03+(q.feed_shuttle13??0),.58,0);s+=box(c[0]-18,c[1]+2,36,21,'#7b8970',C.green)+ln(c[0]+28,c[1]+18,c[0]+28,c[1]-65,C.steel,4)+jaw(c[0],c[1]-65,(q.seat_guide13_0_1??.035)*300,false);
  // Belt remains visible while the same batch is lifted away.
  const b0=P(1.98,.56,-.45),b1=P(1.98,.56,1.45);s+=ln(...b0,...b1,'#263a42',21)+ln(...b0,...b1,C.green,2,'8 10')+ln(b0[0],b0[1]+12,b0[0],b0[1]+50,C.steel,4)+ln(b1[0]-20,b1[1]+12,b1[0]-20,b1[1]+35,C.steel,4)+txt(398,443,'开槽承载带 / 到料检测',C.green,11);
  const clampOpen=(q.infeed_jaw12_0_1??.025)*500,fork=(q.infeed_fork13_0??0)*220;
  if(id==='infeed'){
   s+=plant(rx,ry,{angle:tilt,scale:.73,raw:!f.rootCut});
   const fa=q.infeed_turn12??0,fp=P(.84+(q.infeed_X12??.95)+.19,.23+(q.infeed_settle12??.53)+.27-.45*Math.cos(fa)-.08*Math.sin(fa),-.45-.45*Math.sin(fa)+.08*Math.cos(fa));s+=`<g transform="translate(${fp[0]} ${fp[1]}) rotate(${78+fa/Math.PI*156})">${jaw(0,-99,clampOpen,false)}${ln(44,7,44,-139,C.steel,4)}${ln(44,-139,0,-139,C.steel,4)}${box(-19+fork,4,38,5,C.gold,C.gold,1)}${box(-18+fork,-39,9,5,C.green,C.green,1)}${box(9+fork,-39,9,5,C.green,C.green,1)}${ln(44,7,44+fork,7,C.steel,3)}${ln(44+fork,7,19+fork,7,C.steel,3)}${ln(44+fork,-34,-18+fork,-34,C.steel,3)}</g>`;
   s+=box(30,80,172,103,'#15392f',C.green)+txt(42,102,'上料保持',C.green,13)+txt(42,124,'① 横料：托架承托下垂',C.ink,11)+txt(42,145,'② 翻转：根端托叉承重',C.ink,11)+txt(42,166,'③ 入杯确认后才退托叉',C.ink,11);
   s+=txt(250,88,'上方滑台与升降导向',C.muted,11)+ln(260,101,470,101,C.steel,5)+ln(340,107,340,245,C.steel,4)+box(326,145,28,32,'#3c6878')+ln(340,177,fp[0]+44*Math.cos((78+fa/Math.PI*156)*Math.PI/180)+139*Math.sin((78+fa/Math.PI*156)*Math.PI/180),fp[1]+44*Math.sin((78+fa/Math.PI*156)*Math.PI/180)-139*Math.cos((78+fa/Math.PI*156)*Math.PI/180),C.steel,4);
  }else{
   s+=plant(rx,ry,{raw:!f.rootCut,scale:.79})+jaw(rx,ry-110,(q.loader_grip_0_jaw_1??0)*650,false);
   const main=P(.33,.58,0);s+=jaw(main[0],main[1]-144,(q.grip_0_0_jaw_1??0)*550,false)+txt(35,89,'取料夹先夹稳；切根后由夹爪独立保持。',C.green,12)+txt(35,111,'主夹接管确认后，取料夹才松开。',C.muted,11);
   if(id==='root'){const cut=(q.root_cut??0)*400;s+=box(rx-42,ry-30,25,8,C.gold,C.gold)+box(rx+18-cut,ry-30,26,8,C.gold,C.gold)+ln(rx+75,ry-26,rx+44-cut,ry-26,C.steel,6)+box(rx+75,ry-38,40,24,'#35728a')+txt(385,248,'导向切根刀',C.gold,11);}
  }
  s+=txt(29,474,'单通道放大；两通道同步。定向来料接入，随机散料解缠尚未验证。',C.muted,10);
 }else if(['wrap','band','seal'].includes(id)){
  const isBand=id==='band',g=f.banded?1:Math.max(0,Math.min(1,f.gather??0)),clip=(q.film_hold13_0_1??.006)*1600;
  s+=plant(318,385,{film:f.film,band:f.banded,gather:g,raw:false,scale:.94})+jaw(318,205,(q.grip_0_0_jaw_1??0)*700,false)+txt(370,206,'主夹握葱体',C.green,11);
  // Separate inner anvil and moving outer pad visibly pinch the film wall.
  for(const side of [-1,1]){const x=318+side*22;s+=ln(x+side*60,215,x+side*60,241,C.steel,3)+ln(x+side*60,241,x+side*8,241,C.steel,3)+box(x-side*3-2,232,4,16,'#acb8b3',C.ink,1)+box(x+side*(4+clip)-3,234,6,12,'#43816b',C.green,1);}
  s+=txt(412,233,'独立夹膜指',C.green,11)+txt(412,250,'内砧＋软垫夹膜',C.muted,10);
  if(!isBand){
   for(const side of [-1,1]){const x=318+side*179;s+=circle(x,300,30,'#b9a677',C.gold)+circle(x,300,6,'#233c47',C.gold)+ln(x,270,318+side*29,243,C.blue,2)+box(318+side*35-4,261,8,110,'#31515d',C.gold);}
   s+=box(277,386,82,8,'#bd985d',C.gold)+txt(60,100,id==='seal'?'复检袋底、纵封、束口与膜口状态':'拉片 → 两侧纵封切断 → 袋底热封 → 保压冷却',C.gold,12)+txt(55,429,'临时夹膜指防转位下滑；袋口束带用于成品离机后的保持。',C.green,11);
  }else{
   const approach=1-(q.band_head13??.30)/.30,frameX=473-75*approach;
   s+=`<path d="M${frameX-83} 210h83v87h-83" fill="none" stroke="#7a98a5" stroke-width="9"/><path d="M${frameX-81} 210h75v84h-75" fill="none" stroke="${C.gold}" stroke-width="2" stroke-dasharray="7 5"/>`;
   s+=circle(111,317,30,'#cab98e',C.gold)+circle(111,317,7,'#233c47',C.gold)+ln(111,287,224,287,C.gold,3)+box(181,275,25,25,'#3b6577')+circle(187,287,5,'#536f79')+circle(201,287,5,'#536f79')+box(237,276,25,22,'#926e40',C.gold);
   const close=1-(q.band_gather13??.018)/.018;s+=jaw(318,262,18*(1-close),false)+ln(318-14,262,318+14,262,C.gold,Math.max(1,6*f.bandProgress));
   s+=box(420,315,77,28,'#466c7d')+box(499,318,29,22,'#b29a66',C.gold)+txt(419,365,'超声封接头 / 切带刀',C.gold,10)+ln(458,315,345,262,C.steel,3);
   s+=txt(37,95,'夹膜保持 → 柔性收口 → 导框送带 → 低张力封接 → 确认',C.gold,12)+txt(54,372,'束带料卷',C.gold,11)+txt(154,326,'送带夹辊',C.muted,10)+txt(240,324,'切断',C.muted,10)+txt(47,426,'束带圈住的是预留膜口与坚实葱白段；不勒住空心葱叶。',C.green,11)+txt(47,448,'张力、抗滑移及压伤需湿态试验。封接信号不等于已验证封接强度。',C.muted,10);
  }
 }else if(id==='weigh'){
  s+=plant(306,347,{film:1,band:f.banded,gather:1,raw:false,scale:.90})+jaw(306,177,(q.grip_0_0_jaw_1??0)*900,false);
  const y=355-(q.weigh_lift??0)*200;s+=box(280,y,53,21,'#a3ad92',C.green)+ln(306,y+21,306,y+34,C.steel,11)+box(264,y+34,95,18,'#8d9c9b',C.gold)+ln(339,y+52,339,443,C.steel,12)+box(234,443,157,13)+txt(376,198,'主夹、夹膜指都松开',C.green,11)+txt(376,218,'束带随整袋一起称重',C.muted,10)+txt(372,y+48,'传感器承载端',C.gold,11)+txt(43,95,'整袋由托杯承重；任何固定夹膜指都不能留在受力链上。',C.green,12)+txt(45,478,'杯托承接确认 → 松夹与松膜 → 稳定检重 → 重夹确认 → 撤托杯',C.muted,11);
 }else if(['outfeed','return'].includes(id)){
  const z=(q.unload_Z12??0)/.45,x=225+110*Math.min(1,(q.unload_axis??0)/.75),y=359-z*90;
  s+=`<ellipse cx="343" cy="398" rx="185" ry="36" fill="#20463f" stroke="${C.green}"/>`+box(158,397,370,14,'#24483f',C.green);
  for(let i=0;i<3;i++){const X=335+i*73;s+=`<path d="M${X-18} 342V359H${X+18}V342" fill="#84927955" stroke="${C.green}" stroke-width="4"/>`+`<ellipse cx="${X}" cy="307" rx="23" ry="6" fill="none" stroke="${C.green}" stroke-width="4"/><ellipse cx="${X}" cy="277" rx="23" ry="6" fill="none" stroke="${C.green}" stroke-width="4"/>`+ln(X-12,359,X-12,397,C.steel,3)+ln(X+12,359,X+12,397,C.steel,3)+ln(X+27,395,X+27,275,C.steel,4)+ln(X+23,277,X+27,277,C.steel,3)+ln(X+23,307,X+27,307,C.steel,3);}
  const px=f.owner==='outfeed'?335:x,py=f.owner==='outfeed'?359:y;s+=plant(px,py,{film:1,band:f.banded,gather:1,raw:false,scale:.79})+(f.owner!=='outfeed'?jaw(px,py-117,(q.unload_grip_0_jaw_1??0)*800,false):'');
  s+=txt(48,93,'上提越过导向圈 → 平移 → 下降落杯 → 确认承接 → 松夹',C.green,12)+txt(450,276,'上圈：限制摆动',C.green,10)+txt(450,307,'下圈：扶正定位',C.green,10)+txt(450,367,'杯底：承担重量',C.gold,10)+txt(48,464,'束带保持膜口；托杯承重、双圈扶正。24位盘满后停机，换盘尚未自动化。',C.muted,10);
 }else{
  let base=diagram12(state,t,program);base=base.replace('</svg>',`${f.banded?box(300,147,30,7,C.gold,C.gold):''}</svg>`);return base;
 }
 if(blocked)s+=box(22,67,596,49,'#542f29',C.red)+txt(35,88,'已停住：'+blocked.action,C.red,13)+txt(35,106,'原支承保持；本项信号为故障模拟，不会自动假定已到位。',C.ink,10);
 return `<svg viewBox="0 0 640 515" role="img" aria-label="${esc(f.phase.label)}机构方案与物料支承">${s}${foot()}</svg>`;
}
