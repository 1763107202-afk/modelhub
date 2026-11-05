import * as T from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
const $=id=>document.getElementById(id),stage=$('stage');
function fallback(){const o=$('overlay');o.hidden=false;o.innerHTML='<img id="fallbackImage" src="../../assets/ship-latest-overview.webp" alt="最新版船厂工程几何渲染"><small>当前浏览器显示最新版工程模型静帧，可切换总览和工位。</small>';const images={yard:'overview',line:'line',first:'station',weld:'weld'};document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-view]').forEach(x=>x.classList.toggle('active',x===b));$('fallbackImage').src='../../assets/ship-latest-'+images[b.dataset.view]+'.webp';});$('auto').disabled=true;$('auto').textContent='三维需图形支持';}
async function unpack(url){const r=await fetch(url);if(!r.ok)throw Error('model fetch failed');return await new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();}
try{
 const renderer=new T.WebGLRenderer({antialias:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.4));renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;stage.prepend(renderer.domElement);
 const scene=new T.Scene();scene.background=new T.Color('#d3e0e4');const camera=new T.PerspectiveCamera(42,1,.1,2500),controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.minDistance=3;controls.maxDistance=950;controls.maxPolarAngle=Math.PI*.49;controls.target.set(0,3,-30);
 scene.add(new T.HemisphereLight(0xffffff,0x74858c,2.3));const sun=new T.DirectionalLight(0xfffaf0,3);sun.position.set(150,240,150);scene.add(sun);const pm=new T.PMREMGenerator(renderer);scene.environment=pm.fromScene(new RoomEnvironment(),.04).texture;pm.dispose();
 $('loadDescription').textContent='正在准备原工程几何数据…';
 const [model,yard,raw,yr]=await Promise.all([fetch('model.json').then(x=>x.json()),fetch('yard.json').then(x=>x.json()),unpack('geometry.bin.gz'),unpack('yardgeometry.bin.gz')]);
 const mat=d=>{const c=d.color||[.7,.75,.75,1];return new T.MeshStandardMaterial({color:new T.Color(c[0],c[1],c[2]),metalness:d.metallic??.06,roughness:d.roughness??.65,transparent:!!d.transparent,opacity:d.transparent?c[3]:1,side:T.DoubleSide});};
 const materials=model.materials.map(mat),ym=yard.materials.map(mat),geometries=new Map();
 function geometry(d,buffer){const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(new Float32Array(buffer,d.positionOffset,d.vertexCount*3),3));g.setAttribute('normal',new T.BufferAttribute(new Float32Array(buffer,d.normalOffset,d.vertexCount*3),3));g.setIndex(new T.BufferAttribute(new Uint32Array(buffer,d.indexOffset,d.indexCount),1));g.computeBoundingSphere();return g;}
 const group=new T.Group(),outside=new T.Group();scene.add(group,outside);const nodes=model.nodes.map(n=>{const o=new T.Group();o.name=n.name;o.position.fromArray(n.p);o.quaternion.fromArray(n.q);o.scale.fromArray(n.s);o.visible=n.active!==false;if(n.mesh>=0){if(!geometries.has(n.mesh))geometries.set(n.mesh,geometry(model.meshes[n.mesh],raw));o.add(new T.Mesh(geometries.get(n.mesh),materials[n.material]));}return o;});model.nodes.forEach((n,i)=>(n.parent>=0?nodes[n.parent]:group).add(nodes[i]));
 for(const b of yard.batches){const m=new T.Mesh(geometry(b,yr),ym[b.material]);m.name=b.group;outside.add(m);}
 const views={yard:{p:[310,245,340],t:[0,5,-45],yard:true},line:{p:[118,59,115],t:[-20,3,-10],yard:false},first:{p:[-96,16,20],t:[-115,3,-11],yard:false},weld:{p:[-55,16,18],t:[-75,3,-11],yard:false}};
 function view(key){const v=views[key];camera.position.fromArray(v.p);controls.target.fromArray(v.t);outside.visible=v.yard;controls.update();document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===key));}
 document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>view(b.dataset.view));$('auto').onclick=()=>{controls.autoRotate=!controls.autoRotate;$('auto').classList.toggle('active',controls.autoRotate);};controls.autoRotateSpeed=.5;
 function resize(){const w=Math.max(1,stage.clientWidth),h=Math.max(1,stage.clientHeight);renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();}new ResizeObserver(resize).observe(stage);resize();view('yard');$('overlay').hidden=true;
 function draw(){requestAnimationFrame(draw);controls.update();renderer.render(scene,camera);}requestAnimationFrame(draw);
}catch(e){fallback();console.error(e);}
