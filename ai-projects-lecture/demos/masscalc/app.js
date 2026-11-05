import {createMesh,projectFaces,theoreticalVolume} from './geometry.js';
const $=id=>document.getElementById(id),canvas=$('modelCanvas'),ctx=canvas.getContext('2d');
let models=[],current,mesh=[],yaw=.55,pitch=.46,zoom=1,section=false,spinning=false,drag=null,last=0;
function resize(){const box=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(box.width*dpr);canvas.height=Math.round(box.height*dpr);draw();}
function draw(){if(!ctx||!current)return;const w=canvas.width,h=canvas.height,dpr=Math.min(devicePixelRatio||1,2);ctx.clearRect(0,0,w,h);
  const scale=Math.min(w*.71,h*.74),cx=w*.5,cy=h*.57;
  const g=ctx.createRadialGradient(cx,cy+scale*.36,0,cx,cy+scale*.36,scale*.57);g.addColorStop(0,'#06161e88');g.addColorStop(1,'#06161e00');ctx.save();ctx.translate(0,cy+scale*.36);ctx.scale(1,.22);ctx.translate(0,-(cy+scale*.36));ctx.fillStyle=g;ctx.fillRect(0,0,w,h*4);ctx.restore();
  const faces=projectFaces(mesh,yaw,pitch,zoom);
  for(const f of faces){ctx.beginPath();f.points.forEach(([x,y],i)=>{const X=cx+x*scale,Y=cy+y*scale;i?ctx.lineTo(X,Y):ctx.moveTo(X,Y);});ctx.closePath();ctx.fillStyle=f.color;ctx.fill();ctx.strokeStyle=f.color;ctx.lineWidth=.65*dpr;ctx.stroke();}
  ctx.font=`${9*dpr}px sans-serif`;ctx.fillStyle='#6f9d9c';ctx.fillText('mm / 名义尺寸',w-98*dpr,h-15*dpr);
}
function setModel(id){current=models.find(x=>x.id===id)||models[0];section=false;mesh=createMesh(current,false);yaw=.55;pitch=current.type==='cover'?.69:.46;zoom=1;
  $('drawing').src=current.drawing;$('drawing').alt=current.name+'原始图纸';$('partCode').textContent=current.code;$('drawingPage').textContent=`WSFM4022(5).pdf · 第 ${current.page} 页`;$('modelBasis').textContent=current.why;
  $('modelId').textContent=current.id+' / 原参数重建';$('modelName').textContent=current.name;$('mass').textContent=(theoreticalVolume(current)*current.density/1e9).toFixed(4);$('volume').textContent=theoreticalVolume(current).toLocaleString('zh-CN',{maximumFractionDigits:2})+' mm³';$('material').textContent=current.material;$('risk').textContent=current.risk;
  $('parameters').replaceChildren(...Object.entries(current.params).map(([k,v])=>{const div=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=k;dd.textContent=v;div.append(dt,dd);return div;}));
  document.querySelectorAll('[data-model]').forEach(b=>b.classList.toggle('active',b.dataset.model===current.id));$('section').setAttribute('aria-pressed','false');$('section').disabled=current.type==='cover';$('viewStatus').textContent='完整模型';resize();
}
$('rotate').onclick=()=>{spinning=!spinning;$('rotate').setAttribute('aria-pressed',String(spinning));$('rotate').textContent=spinning?'暂停旋转':'自动旋转';};
$('section').onclick=()=>{section=!section;if(section){yaw=.8;pitch=.62;}mesh=createMesh(current,section);$('section').setAttribute('aria-pressed',String(section));$('viewStatus').textContent=section?'剖切观察 / 完整件质量':'完整模型';draw();};
$('reset').onclick=()=>setModel(current.id);
canvas.addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener('pointermove',e=>{if(!drag)return;yaw+=(e.clientX-drag.x)*.009;pitch=Math.max(-1.35,Math.min(1.35,pitch+(e.clientY-drag.y)*.008));drag={x:e.clientX,y:e.clientY};draw();});
canvas.addEventListener('pointerup',()=>drag=null);canvas.addEventListener('pointercancel',()=>drag=null);
canvas.addEventListener('wheel',e=>{e.preventDefault();zoom=Math.max(.5,Math.min(2,zoom*Math.exp(-e.deltaY*.001)));draw();},{passive:false});
function openDrawing(){$('largeDrawing').src=current.drawing;$('drawingTitle').textContent=current.name+' · 第 '+current.page+' 页';$('drawingDialog').showModal();}
$('openDrawing').onclick=openDrawing;$('drawingZoom').onclick=openDrawing;$('closeDrawing').onclick=()=>$('drawingDialog').close();$('showProvenance').onclick=()=>$('provenance').showModal();$('closeProvenance').onclick=()=>$('provenance').close();
new ResizeObserver(resize).observe(canvas.parentElement);
function frame(t){const dt=Math.min(50,t-last||16);last=t;if(spinning&&!drag&&!document.hidden){yaw+=dt*.00023;draw();}requestAnimationFrame(frame);}requestAnimationFrame(frame);
fetch('./data.json').then(r=>{if(!r.ok)throw Error('data');return r.json();}).then(data=>{models=data.models;for(const model of models){const v=theoreticalVolume(model);if(Math.abs(v-model.volume)>Math.max(1e-5,model.volume*1e-7))throw Error('volume mismatch');const b=document.createElement('button');b.dataset.model=model.id;b.append(document.createTextNode(model.name));const span=document.createElement('span');span.textContent=model.id;b.append(span);b.onclick=()=>setModel(model.id);$('partTabs').append(b);}setModel(models[0].id);}).catch(()=>{$('loadError').hidden=false;});
