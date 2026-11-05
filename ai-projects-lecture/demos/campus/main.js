import * as THREE from 'three';
import {OrbitControls} from './vendor/OrbitControls.js';
import {Reflector} from './vendor/Reflector.js';
import {buildCampus} from './model.js?v=7';

const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const host=$('#scene'), loading=$('#loading');
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
const mobile=matchMedia('(max-width: 700px)').matches;
const state={hour:15,weather:'sunny',view:'aerial',rotate:false};
let renderer;
try{
  renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
}catch(error){
  showFallback();
}
if(renderer){
renderer.setPixelRatio(Math.min(devicePixelRatio,mobile?1.35:1.8));
renderer.setSize(host.clientWidth,host.clientHeight);
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.13;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;
host.appendChild(renderer.domElement);
const scene=new THREE.Scene();scene.fog=new THREE.FogExp2('#afc5d0',.0027);
const camera=new THREE.PerspectiveCamera(48,host.clientWidth/host.clientHeight,.35,5000);
const controls=new OrbitControls(camera,renderer.domElement);
controls.enableDamping=true;controls.dampingFactor=.065;controls.maxPolarAngle=Math.PI*.485;controls.minPolarAngle=.13;
controls.minDistance=8;controls.maxDistance=1450;controls.panSpeed=.72;controls.rotateSpeed=.48;controls.zoomSpeed=.8;controls.autoRotateSpeed=.45;
controls.touches.ONE=THREE.TOUCH.ROTATE;controls.touches.TWO=THREE.TOUCH.DOLLY_PAN;
controls.screenSpacePanning=false;
controls.listenToKeyEvents(host);
let transition=null,lastTick=0,lastRendered=0,elapsed=0,toastTimer,hidden=false;
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),2500);}

// Directional sky and soft, changing natural light.
const hemi=new THREE.HemisphereLight('#d3e9ff','#786e57',2.3);scene.add(hemi);
const sun=new THREE.DirectionalLight('#fff1d4',3.2);sun.castShadow=true;sun.shadow.mapSize.set(mobile?1536:2048,mobile?1536:2048);
sun.shadow.camera.left=-101;sun.shadow.camera.right=101;sun.shadow.camera.top=111;sun.shadow.camera.bottom=-111;
sun.shadow.camera.near=1;sun.shadow.camera.far=1450;sun.shadow.bias=-.00015;sun.shadow.normalBias=.13;sun.shadow.radius=2;
sun.target.position.set(0,0,-17);scene.add(sun,sun.target);
const fill=new THREE.DirectionalLight('#acc9e5',.45);fill.position.set(-85,40,-100);scene.add(fill);
const skyUniforms={topColor:{value:new THREE.Color('#5294c3')},bottomColor:{value:new THREE.Color('#d4e4e8')},sunDir:{value:new THREE.Vector3()},sunColor:{value:new THREE.Color('#fff1cc')},sunPower:{value:1},night:{value:0}};
const sky=new THREE.Mesh(new THREE.SphereGeometry(2100,32,20),new THREE.ShaderMaterial({
  uniforms:skyUniforms,side:THREE.BackSide,depthWrite:false,
  vertexShader:'varying vec3 vDirection;void main(){vDirection=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader:`varying vec3 vDirection;uniform vec3 topColor;uniform vec3 bottomColor;uniform vec3 sunDir;uniform vec3 sunColor;uniform float sunPower;uniform float night;void main(){vec3 d=normalize(vDirection);float elevation=max(d.y,0.);vec3 col=mix(bottomColor,topColor,pow(elevation,.55));float sun=max(dot(d,normalize(sunDir)),0.);col+=sunColor*(pow(sun,100.)*.24+pow(sun,750.)*.8+smoothstep(.9996,.99985,sun)*1.8)*sunPower;gl_FragColor=vec4(col,1.);#include <tonemapping_fragment>\n#include <colorspace_fragment>}`.replace(';#include',';\n#include')
}));sky.renderOrder=-10;scene.add(sky);
function environmentTexture(){const c=document.createElement('canvas');c.width=512;c.height=256;const q=c.getContext('2d'),g=q.createLinearGradient(0,0,0,256);g.addColorStop(0,'#9bbbd5');g.addColorStop(.43,'#d4e4e9');g.addColorStop(.51,'#92a8ad');g.addColorStop(.57,'#82947e');g.addColorStop(1,'#515953');q.fillStyle=g;q.fillRect(0,0,512,256);q.fillStyle='#ffffff';q.fillRect(150,50,95,22);const t=new THREE.CanvasTexture(c);t.mapping=THREE.EquirectangularReflectionMapping;t.colorSpace=THREE.SRGBColorSpace;return t;}
scene.environment=environmentTexture();scene.environmentIntensity=.6;
const campus=buildCampus(scene),M=campus.materials;
const baseColors=new Map(Object.values(M).map(m=>[m,m.color.clone()]));

// Real planar reflection, with a slight animated distortion for water ripples.
const pool=campus.pool;
const waterShader={...Reflector.ReflectorShader,uniforms:THREE.UniformsUtils.clone(Reflector.ReflectorShader.uniforms)};
waterShader.uniforms.time={value:0};waterShader.uniforms.ripple={value:.001};
waterShader.fragmentShader=waterShader.fragmentShader.replace('uniform vec3 color;','uniform vec3 color;uniform float time;uniform float ripple;').replace('vec4 base = texture2DProj( tDiffuse, vUv );','vec4 rippleUv=vUv; rippleUv.x+=sin(vUv.y*61.+time*.8)*ripple*vUv.w; rippleUv.y+=cos(vUv.x*55.+time*.7)*ripple*.55*vUv.w;vec4 base = texture2DProj(tDiffuse,rippleUv);');
// All four water areas share one reflection pass, including on phones.
const waterOutlines=[{outline:[[-pool.width/2,pool.z-pool.length/2],[pool.width/2,pool.z-pool.length/2],[pool.width/2,pool.z+pool.length/2],[-pool.width/2,pool.z+pool.length/2]]},...campus.waterAreas];
const waterVertices=[];
for(const {outline}of waterOutlines){const shape=new THREE.Shape();outline.forEach(([x,z],i)=>i?shape.lineTo(x,-z):shape.moveTo(x,-z));shape.closePath();let g=new THREE.ShapeGeometry(shape);if(g.index)g=g.toNonIndexed();waterVertices.push(...g.attributes.position.array);g.dispose();}
const waterGeometry=new THREE.BufferGeometry();waterGeometry.setAttribute('position',new THREE.Float32BufferAttribute(waterVertices,3));waterGeometry.computeVertexNormals();
const water=new Reflector(waterGeometry,{color:'#68868a',textureWidth:mobile?512:1024,textureHeight:mobile?512:1024,clipBias:.003,shader:waterShader,multisample:0});
water.rotation.x=-Math.PI/2;water.position.set(0,pool.y,0);scene.add(water);
const ice=new THREE.Mesh(waterGeometry,new THREE.MeshStandardMaterial({color:'#b9d5df',roughness:.3,metalness:.16,transparent:true,opacity:0,depthWrite:false}));ice.rotation.x=-Math.PI/2;ice.position.set(0,pool.y+.035,0);scene.add(ice);

function roundTexture(kind){
  const c=document.createElement('canvas');c.width=c.height=128;const q=c.getContext('2d');
  if(kind==='cloud'){
    const shapes=[[35,65,29],[55,45,31],[80,57,35],[98,72,21],[58,74,31]];
    for(const[x,y,r]of shapes){const g=q.createRadialGradient(x,y,1,x,y,r);g.addColorStop(0,'rgba(255,255,255,.62)');g.addColorStop(.55,'rgba(255,255,255,.42)');g.addColorStop(1,'rgba(255,255,255,0)');q.fillStyle=g;q.fillRect(x-r,y-r,r*2,r*2);}
  }else{const g=q.createRadialGradient(64,64,0,64,64,62);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(kind==='snow'?.45:.1,'rgba(255,255,255,'+(kind==='snow'?'.94':'.5')+')');g.addColorStop(1,'rgba(255,255,255,0)');q.fillStyle=g;q.fillRect(0,0,128,128);}
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
}
const cloudTexture=roundTexture('cloud'),clouds=[];
for(let i=0;i<22;i++){const material=new THREE.SpriteMaterial({map:cloudTexture,transparent:true,opacity:.5,depthWrite:false,fog:false});const c=new THREE.Sprite(material);c.position.set((i%7-3)*75,70+(i%3)*21,-195+Math.floor(i/7)*95);c.scale.set(73+(i%4)*12,27+(i%3)*6,1);scene.add(c);clouds.push(c);}
const starPositions=[];for(let i=0;i<750;i++){const a=i*2.3999632,y=.1+(Math.sin(i*34.123)*43758.5453%1+1)*.42,r=Math.sqrt(1-y*y);starPositions.push(Math.cos(a)*r*1900,y*1900,Math.sin(a)*r*1900)}
const starGeo=new THREE.BufferGeometry();starGeo.setAttribute('position',new THREE.Float32BufferAttribute(starPositions,3));
const stars=new THREE.Points(starGeo,new THREE.PointsMaterial({color:'#d6e8ff',size:3.2,sizeAttenuation:true,transparent:true,opacity:0,depthWrite:false,fog:false}));scene.add(stars);
const moon=new THREE.Mesh(new THREE.SphereGeometry(11,20,16),new THREE.MeshBasicMaterial({color:'#f3edd9',transparent:true,opacity:0,fog:false}));moon.position.set(-700,800,-1250);scene.add(moon);
const glowTexture=roundTexture('glow');
const moonGlow=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTexture,color:'#e6eef3',transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false,fog:false}));moonGlow.position.copy(moon.position);moonGlow.scale.set(82,82,1);scene.add(moonGlow);
const lampSprites=[];
for(const p of campus.lamps){const s=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTexture,color:'#ffd396',transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending}));s.position.copy(p);s.scale.set(3.1,3.1,1);scene.add(s);lampSprites.push(s);}
const nightLights=[];
for(const z of [-18,17])for(const x of [-17.5,17.5]){const l=new THREE.PointLight('#ffdc9a',0,26,2);l.position.set(x,4.8,z);scene.add(l);nightLights.push(l);}
const entryLight=new THREE.PointLight('#fbd092',0,65,2);entryLight.position.set(0,13,45);scene.add(entryLight);
const mainLight=new THREE.PointLight('#e2dbb9',0,54,2);mainLight.position.set(0,13,-76);scene.add(mainLight);
const regionLights=campus.nightFixtures.map(item=>{const light=item.spot?new THREE.SpotLight(item.color,0,item.distance,.75,.5,2):new THREE.PointLight(item.color,0,item.distance,2);light.position.fromArray(item.position);if(item.target){light.target.position.fromArray(item.target);scene.add(light.target);}scene.add(light);return{light,power:item.intensity};});

// Weather particles live in world space and continue to work while the camera moves.
const snowCount=mobile?3600:6200,rainCount=mobile?2800:4300;
let prng=87123;function rand(){prng=(prng*1664525+1013904223)>>>0;return prng/4294967296;}
const snowPos=new Float32Array(snowCount*3),snowSpeed=new Float32Array(snowCount),snowPhase=new Float32Array(snowCount);
for(let i=0;i<snowCount;i++){snowPos[i*3]=(rand()-.5)*350;snowPos[i*3+1]=rand()*92;snowPos[i*3+2]=(rand()-.5)*530-114;snowSpeed[i]=1.2+rand()*2.1;snowPhase[i]=rand()*Math.PI*2;}
const snowGeo=new THREE.BufferGeometry();snowGeo.setAttribute('position',new THREE.BufferAttribute(snowPos,3));
const snowfall=new THREE.Points(snowGeo,new THREE.PointsMaterial({color:'#f7fbff',map:roundTexture('snow'),size:mobile?.46:.36,sizeAttenuation:true,transparent:true,opacity:.95,depthWrite:false}));snowfall.frustumCulled=false;snowfall.visible=false;scene.add(snowfall);
const rainPos=new Float32Array(rainCount*6),rainSpeed=new Float32Array(rainCount);
for(let i=0;i<rainCount;i++){const j=i*6;rainPos[j]=(rand()-.5)*350;rainPos[j+1]=rand()*92;rainPos[j+2]=(rand()-.5)*530-114;rainPos[j+3]=rainPos[j]-.19;rainPos[j+4]=rainPos[j+1]-1.4;rainPos[j+5]=rainPos[j+2]+.06;rainSpeed[i]=23+rand()*13;}
const rainGeo=new THREE.BufferGeometry();rainGeo.setAttribute('position',new THREE.BufferAttribute(rainPos,3));
const rainfall=new THREE.LineSegments(rainGeo,new THREE.LineBasicMaterial({color:'#c7e1ee',transparent:true,opacity:.38,depthWrite:false}));rainfall.frustumCulled=false;rainfall.visible=false;scene.add(rainfall);
const nearCount=mobile?360:600,nearSnowPos=new Float32Array(nearCount*3),nearRainPos=new Float32Array(nearCount*6);
for(let i=0;i<nearCount;i++){for(let axis=0;axis<3;axis++)nearSnowPos[i*3+axis]=(rand()-.5)*80;const j=i*6;nearRainPos[j]=(rand()-.5)*80;nearRainPos[j+1]=(rand()-.5)*80;nearRainPos[j+2]=(rand()-.5)*80;nearRainPos[j+3]=nearRainPos[j]-.12;nearRainPos[j+4]=nearRainPos[j+1]-.85;nearRainPos[j+5]=nearRainPos[j+2];}
const nearSnowGeo=new THREE.BufferGeometry();nearSnowGeo.setAttribute('position',new THREE.BufferAttribute(nearSnowPos,3));const nearSnowMaterial=snowfall.material.clone();nearSnowMaterial.size=.13;
const nearSnow=new THREE.Points(nearSnowGeo,nearSnowMaterial);nearSnow.frustumCulled=false;nearSnow.visible=false;scene.add(nearSnow);
const nearRainGeo=new THREE.BufferGeometry();nearRainGeo.setAttribute('position',new THREE.BufferAttribute(nearRainPos,3));const nearRain=new THREE.LineSegments(nearRainGeo,rainfall.material);nearRain.frustumCulled=false;nearRain.visible=false;scene.add(nearRain);
const weatherCenter=new THREE.Vector3();
const smooth=(a,b,x)=>{const t=THREE.MathUtils.clamp((x-a)/(b-a),0,1);return t*t*(3-2*t)};
const color=(v)=>new THREE.Color(v);
const palette={dayTop:color('#5b9fc9'),dayBottom:color('#ccdfe5'),dawnTop:color('#7c9bb7'),dawnBottom:color('#f6c5a3'),nightTop:color('#09182b'),nightBottom:color('#263c56'),cloudTop:color('#8098aa'),cloudBottom:color('#c5cfd0'),snowTop:color('#91a6bc'),snowBottom:color('#d7e4eb')};
let climate={snow:0,rain:0,cloud:0};let climateTarget={...climate};let environmentDirty=true;
let shadowExtent=0;const shadowFocus=new THREE.Vector3(1e6,0,1e6);
function updateSceneRange(){
  const distance=camera.position.distanceTo(controls.target),extent=THREE.MathUtils.clamp(distance*.46,82,245);
  if(Math.abs(extent-shadowExtent)>2){shadowExtent=extent;sun.shadow.camera.left=-extent;sun.shadow.camera.right=extent;sun.shadow.camera.top=extent*1.23;sun.shadow.camera.bottom=-extent*1.23;sun.shadow.camera.updateProjectionMatrix();renderer.shadowMap.needsUpdate=true;}
  sun.target.position.set(THREE.MathUtils.clamp(controls.target.x,-115,115),0,THREE.MathUtils.clamp(controls.target.z,-320,64));
  if(shadowFocus.distanceToSquared(sun.target.position)>2.25){shadowFocus.copy(sun.target.position);renderer.shadowMap.needsUpdate=true;}
  sun.position.copy(skyUniforms.sunDir.value).add(sun.target.position);
  scene.fog.density=(.0008+climate.cloud*.0011+climate.snow*.00065)*Math.min(1,250/Math.max(distance,1));
}
function applyLighting(){
  renderer.shadowMap.needsUpdate=true;
  const hour=state.hour===24?0:state.hour,a=(hour-6)*Math.PI/12,height=Math.sin(a),day=smooth(-.19,.23,height),warm=(1-smooth(.05,.65,height))*day;
  const night=1-day,overcast=climate.cloud,white=climate.snow;
  const sunVector=new THREE.Vector3(-Math.cos(a)*390,Math.max(height*440,60),180);
  sun.position.copy(sunVector).add(sun.target.position);skyUniforms.sunDir.value.copy(sunVector);
  skyUniforms.topColor.value.copy(palette.nightTop).lerp(palette.dayTop,day).lerp(palette.dawnTop,warm*.62).lerp(palette.cloudTop,overcast*day*.87).lerp(palette.snowTop,white*day*.75);
  skyUniforms.bottomColor.value.copy(palette.nightBottom).lerp(palette.dayBottom,day).lerp(palette.dawnBottom,warm*.84*(1-overcast)).lerp(palette.cloudBottom,overcast*day*.72).lerp(palette.snowBottom,white*day*.66);
  skyUniforms.sunPower.value=day*(1-overcast*.96);skyUniforms.sunColor.value.set(warm>.3?'#ffc58b':'#fff1d3');
  scene.fog.color.copy(skyUniforms.bottomColor.value);
  sun.color.set('#fff3da').lerp(color('#ffb46d'),warm*.85);sun.intensity=3.2*day*(1-overcast*.83);sun.castShadow=day>.15&&overcast<.92;
  hemi.color.set('#bcdcf5').lerp(color('#c4bfc3'),warm*.3).lerp(color('#748aa7'),night*.65);hemi.groundColor.set('#84795d').lerp(color('#c2d2dc'),white*.8);hemi.intensity=.27+day*1.75+overcast*.2*day;
  fill.intensity=.16+day*.4;fill.color.set(day>.5?'#bacde0':'#758cae');
  scene.environmentIntensity=.12+day*.62;renderer.toneMappingExposure=1.05+night*.25;
  for(const c of clouds){c.material.opacity=(.25+overcast*.62)*(.5+day*.5);c.material.color.set('#ffffff').lerp(color('#b1bcca'),overcast*.36).lerp(color('#2b3b54'),night*.9);}
  stars.material.opacity=night*.82*(1-overcast*.92);stars.visible=night>.03&&overcast<.95;
  moon.material.opacity=night*(1-overcast*.78);moonGlow.material.opacity=night*.25*(1-overcast);
  const lights=smooth(.48,.94,night);M.light.emissiveIntensity=lights*3.5;M.glassGlow.emissiveIntensity=lights*1.25;M.glass.emissive.set('#d6b778');M.glass.emissiveIntensity=lights*.2;M.glassLight.emissive.set('#b3c5ce');M.glassLight.emissiveIntensity=lights*.13;
  for(const s of lampSprites)s.material.opacity=lights*.75;for(const l of nightLights)l.intensity=lights*45;entryLight.intensity=lights*230;mainLight.intensity=lights*220;
  for(const item of regionLights)item.light.intensity=lights*item.power;
  M.clockFace.emissiveIntensity=.10+lights*.75;campus.updateClock(state.hour);
  M.paving.color.copy(baseColors.get(M.paving)).lerp(color('#dde7eb'),white*.9).lerp(color('#667e89'),climate.rain*.27);
  M.road.color.copy(baseColors.get(M.road)).lerp(color('#c0cdd3'),white*.61).lerp(color('#253b49'),climate.rain*.38);
  M.lawn.color.copy(baseColors.get(M.lawn)).lerp(color('#e4edf0'),white*.94);
  M.hedge.color.copy(baseColors.get(M.hedge)).lerp(color('#b7c9c7'),white*.6);
  for(const m of [M.leafA,M.leafB,M.leafC,M.leafFineA,M.leafFineB,M.leafFineC,M.shrub])m.color.copy(baseColors.get(m)).lerp(color('#a8b9af'),white*.64);
  for(const m of [M.glassTintA,M.glassTintB]){m.emissive.set('#c3cdd0');m.emissiveIntensity=lights*.12;}
  for(const m of [M.turfA,M.turfB,M.sportSurface,M.courtBlue,M.path])m.color.copy(baseColors.get(m)).lerp(color('#dce7ec'),white*.92);
  M.trackRubber.color.copy(baseColors.get(M.trackRubber)).lerp(color('#d5e0e5'),white*.80);
  campus.wind.strength.value=.55+climate.rain*.95+overcast*.22;
  M.paving.roughness=.9-climate.rain*.61;M.road.roughness=.95-climate.rain*.59;
  campus.snow.visible=white>.16;M.snow.color.set('#edf4f7');ice.material.opacity=white*.76;
  water.material.uniforms.color.value.set('#76979a').lerp(color('#344e64'),night*.8).lerp(color('#a9c4cd'),white*.42);
  water.material.uniforms.ripple.value=.0008+climate.rain*.003;
  snowfall.material.opacity=.94*(.7+day*.3);
  nearSnow.material.opacity=snowfall.material.opacity;
  updateSceneRange();
}
const descriptions={sunny:'阳光落在熟悉的屋檐',cloudy:'云影缓缓掠过校园',rain:'听雨，落满整个广场',snow:'飘雪与积雪，一起到来'};
const weatherNames={sunny:'晴空',cloudy:'多云',rain:'细雨',snow:'飘雪'},symbols={sunny:'☀',cloudy:'☁',rain:'☂',snow:'❄'};
function formatTime(h){const minutes=Math.round((h%24)*60);return String(Math.floor(minutes/60)).padStart(2,'0')+':'+String(minutes%60).padStart(2,'0');}
function updateLabels(){const h=state.hour%24,period=h<5?'深夜':h<9?'清晨':h<13?'日间':h<17?'午后':h<19?'黄昏':'夜晚';$('#scene-label').textContent=period+' · '+weatherNames[state.weather];$('#time-output').textContent=$('#clock').textContent=formatTime(state.hour);$('#weather-symbol').textContent=symbols[state.weather];$('#weather-note').textContent=descriptions[state.weather];$$('[data-weather]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.weather===state.weather)));$$('[data-time]').forEach(b=>b.classList.toggle('active',Math.abs(Number(b.dataset.time)-state.hour)<.25));}
function setTime(hour){if(!Number.isFinite(hour)||hour<0||hour>24)throw new Error('时刻必须在 0 至 24 之间');state.hour=hour;$('#time').value=hour;environmentDirty=true;updateLabels();}
function setWeather(weather){if(!Object.hasOwn(weatherNames,weather))throw new Error('未知天气');state.weather=weather;climateTarget={snow:weather==='snow'?1:0,rain:weather==='rain'?1:0,cloud:weather==='sunny'?0:weather==='cloudy'?.78:.98};snowfall.visible=nearSnow.visible=weather==='snow';rainfall.visible=nearRain.visible=weather==='rain';environmentDirty=true;updateLabels();}

// On a portrait screen, compose the subject in the space above the controls.
const views={
  gate:{position:[14,11.5,110],target:[0,10,-3],portrait:[10,21,180],portraitTarget:[0,8,1]},
  plaza:{position:[15,28,35],target:[0,12,-76],portrait:[9,40,69],portraitTarget:[0,11,-69]},
  teaching:{position:[-126,58,74],target:[-63,9,-8],portrait:[-181,110,123],portraitTarget:[-52,5,-17]},
  admin:{position:[112,105,-202],target:[0,6,-75],portrait:[210,230,-327],portraitTarget:[0,5,-85]},
  westgate:{position:[-227,15,-203],target:[-137,6,-203],portrait:[-268,33,-203],portraitTarget:[-137,7,-203]},
  eastgate:{position:[229,20,-63],target:[147,5,-62.5],portrait:[279,43,-62.5],portraitTarget:[145,7,-62.5]},
  aerial:{position:[245,305,360],target:[0,1,-131],portrait:[385,545,525],portraitTarget:[0,1,-132]},
  lake:{position:[26,26,-111],target:[0,10,-197],portrait:[45,56,-78],portraitTarget:[0,9,-193]},
  sports:{position:[16,85,-152],target:[95,2,-240],portrait:[-44,174,-51],portraitTarget:[93,0,-236]},
  tower:{position:[30,24,-170],target:[0,16,-210],portrait:[42,31,-151],portraitTarget:[0,16,-212]},
  garden:{position:[12,15,-232],target:[0,3.9,-252],portrait:[17,29,-211],portraitTarget:[0,4,-251]},
  commons:{position:[-32,50,-113],target:[-89,6,-191],portrait:[-4,94,-54],portraitTarget:[-92,6,-198]},
  rear:{position:[-218,225,-494],target:[0,2,-171],portrait:[-330,455,-738],portraitTarget:[0,1,-146]}
};
const viewTitles={aerial:'全校',gate:'校门',teaching:'教学区',admin:'行政区',westgate:'西门',eastgate:'东门',plaza:'广场',lake:'湖畔',sports:'运动场',tower:'塔楼',garden:'园林院落',commons:'配套建筑',rear:'后侧'};
function setView(view,immediate=false){
  if(!Object.hasOwn(views,view))throw new Error('未知视角');state.view=view;state.rotate=false;controls.autoRotate=false;$('#rotate').setAttribute('aria-pressed','false');
  const portrait=host.clientWidth/host.clientHeight<.85,preset=views[view],p=new THREE.Vector3(...(portrait?preset.portrait:preset.position)),t=new THREE.Vector3(...(portrait?preset.portraitTarget:preset.target));
  if(immediate||reducedMotion){camera.position.copy(p);controls.target.copy(t);controls.update();transition=null;}else transition={from:camera.position.clone(),to:p,fromTarget:controls.target.clone(),toTarget:t,start:performance.now(),duration:1500};
  $$('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===view)));
  const button=$('[data-view="'+view+'"]');if(button){const nav=$('.view-nav');nav.scrollTo({left:button.offsetLeft-nav.clientWidth/2+button.clientWidth/2,behavior:immediate||reducedMotion?'auto':'smooth'});}
}
function composeCamera(){const w=host.clientWidth,h=host.clientHeight,panelHeight=$('.controls').getBoundingClientRect().height;document.documentElement.style.setProperty('--controls-height',panelHeight+'px');camera.aspect=w/h;camera.fov=w/h<.85?66:48;camera.clearViewOffset();if(w/h<.85){camera.setViewOffset(w,h,0,Math.min(h*.15,(panelHeight+90)*.38),w,h);}camera.updateProjectionMatrix();}
function resize(){renderer.setSize(host.clientWidth,host.clientHeight);composeCamera();}
new ResizeObserver(resize).observe(host);
new ResizeObserver(composeCamera).observe($('.controls'));
controls.addEventListener('start',()=>{transition=null;state.rotate=false;controls.autoRotate=false;$('#rotate').setAttribute('aria-pressed','false');});
controls.addEventListener('change',()=>{controls.target.x=THREE.MathUtils.clamp(controls.target.x,-174,174);controls.target.y=THREE.MathUtils.clamp(controls.target.y,.8,52);controls.target.z=THREE.MathUtils.clamp(controls.target.z,-355,143);});
$('#time').addEventListener('input',e=>setTime(Number(e.target.value)));
$$('[data-time]').forEach(b=>b.addEventListener('click',()=>setTime(Number(b.dataset.time))));
$$('[data-weather]').forEach(b=>b.addEventListener('click',()=>setWeather(b.dataset.weather)));
$$('[data-view]').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.view)));
$('#reset').addEventListener('click',()=>{setView(state.view);toast('已回到'+viewTitles[state.view]+'视角');});
$('#rotate').addEventListener('click',()=>{transition=null;state.rotate=!state.rotate;controls.autoRotate=state.rotate;$('#rotate').setAttribute('aria-pressed',String(state.rotate));});
$('#collapse').addEventListener('click',()=>{const closed=$('.controls').classList.toggle('collapsed');document.body.classList.toggle('panel-collapsed',closed);$('#collapse').setAttribute('aria-expanded',String(!closed));$('#collapse').setAttribute('aria-label',closed?'展开设置':'收起设置');composeCamera();});
$('#fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement){await document.exitFullscreen();}else if($('#app').requestFullscreen){await $('#app').requestFullscreen();}else{toast('此浏览器可横屏观看，获得更大画面');}}catch{toast('可横屏观看，获得更大画面');}});
document.addEventListener('fullscreenchange',resize);
host.addEventListener('keydown',e=>{if(e.key==='Home'){setView('aerial');e.preventDefault();}if(e.key==='+'||e.key==='='){camera.position.sub(controls.target).multiplyScalar(.9).add(controls.target);e.preventDefault();}if(e.key==='-'){camera.position.sub(controls.target).multiplyScalar(1.1).add(controls.target);e.preventDefault();}});
renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();loading.classList.remove('done');loading.querySelector('strong').textContent='画面暂时中断';loading.querySelector('span').textContent='正在等待图形恢复，也可以刷新页面重新进入。';});
renderer.domElement.addEventListener('webglcontextrestored',()=>location.reload());

// The same actions are available to supporting assistants through WebMCP.
if(document.modelContext?.registerTool){const lifecycle=new AbortController();const register=tool=>{try{Promise.resolve(document.modelContext.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch{}};
  register({name:'configure_campus_scene',title:'设置校园光影与天气',description:'调整完整校园的时刻、天气及观赏区域；与页面上的设置保持一致。',inputSchema:{type:'object',properties:{hour:{type:'number',minimum:0,maximum:24},weather:{type:'string',enum:['sunny','cloudy','rain','snow']},view:{type:'string',enum:Object.keys(views)}},additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},async execute(input){if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('需要设置对象');for(const key of Object.keys(input))if(!['hour','weather','view'].includes(key))throw new Error('未知设置');if(input.hour!==undefined&&(!Number.isFinite(input.hour)||input.hour<0||input.hour>24))throw new Error('时刻必须在 0 至 24 之间');if(input.weather!==undefined&&!Object.hasOwn(weatherNames,input.weather))throw new Error('未知天气');if(input.view!==undefined&&!Object.hasOwn(views,input.view))throw new Error('未知视角');if(input.hour!==undefined)setTime(input.hour);if(input.weather!==undefined){setWeather(input.weather);climate={...climateTarget};}if(input.view!==undefined)setView(input.view,true);applyLighting();renderer.render(scene,camera);return{hour:state.hour,weather:state.weather,view:state.view};}});
  register({name:'read_campus_scene',description:'读取当前校园时刻、天气和观赏位置。',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:false},execute(){return{hour:state.hour,weather:state.weather,view:state.view};}});
  addEventListener('pagehide',e=>{if(!e.persisted)lifecycle.abort();});
}

function animate(now){
  if(hidden)return;if(mobile&&now-lastRendered<31)return;lastRendered=now;const dt=Math.min((now-lastTick)/1000||.016,.05);lastTick=now;elapsed+=dt;
  if(transition){const u=Math.min((now-transition.start)/transition.duration,1),e=u*u*(3-2*u);camera.position.lerpVectors(transition.from,transition.to,e);camera.position.y+=Math.sin(Math.PI*e)*Math.min(75,transition.from.distanceTo(transition.to)*.16);controls.target.lerpVectors(transition.fromTarget,transition.toTarget,e);if(u>=1)transition=null;}
  controls.update(dt);
  updateSceneRange();camera.getWorldDirection(weatherCenter);weatherCenter.multiplyScalar(35).add(camera.position);nearSnow.position.copy(weatherCenter);nearRain.position.copy(weatherCenter);
  let changing=false;for(const k of ['snow','rain','cloud']){const d=climateTarget[k]-climate[k];if(Math.abs(d)>.002){climate[k]+=d*Math.min(dt*2.5,1);changing=true;}else climate[k]=climateTarget[k];}
  if(environmentDirty||changing){applyLighting();environmentDirty=false;}
  if(!reducedMotion){
    campus.wind.time.value=elapsed;
    water.material.uniforms.time.value=elapsed;
    const p=campus.flag.geometry.attributes.position;for(let i=0;i<p.count;i++){const x=campus.flagBase[i*3],y=campus.flagBase[i*3+1];p.array[i*3+2]=Math.sin(x*2.2-elapsed*3.1+y*.3)*.2*x/4.5+Math.sin(x*1.1-elapsed*2.2)*.08*x;p.array[i*3+1]=y+Math.sin(x*2.8-elapsed*3)*.07*x/4.5;}p.needsUpdate=true;
    for(const c of clouds){c.position.x+=dt*(.28+climate.cloud*.23);if(c.position.x>300)c.position.x=-300;}
    if(snowfall.visible){for(let i=0;i<snowCount;i++){const j=i*3;snowPos[j]+=dt*(.52+Math.sin(elapsed*.6+snowPhase[i])*.5);snowPos[j+1]-=dt*snowSpeed[i];snowPos[j+2]+=dt*Math.cos(elapsed*.45+snowPhase[i])*.25;if(snowPos[j+1]<.25){snowPos[j+1]=92;snowPos[j]=(rand()-.5)*350;snowPos[j+2]=(rand()-.5)*530-114;}if(snowPos[j]>180)snowPos[j]=-175;}snowGeo.attributes.position.needsUpdate=true;for(let i=0;i<nearCount;i++){const j=i*3;nearSnowPos[j+1]-=dt*(1.2+i%3*.4);nearSnowPos[j]+=Math.sin(elapsed*.8+i)*dt*.3;if(nearSnowPos[j+1]<-40)nearSnowPos[j+1]=40;if(nearSnowPos[j]>40)nearSnowPos[j]=-40;}nearSnowGeo.attributes.position.needsUpdate=true;}
    if(rainfall.visible){for(let i=0;i<rainCount;i++){const j=i*6;rainPos[j]-=dt*3.8;rainPos[j+1]-=dt*rainSpeed[i];if(rainPos[j+1]<.1){rainPos[j+1]=92;rainPos[j]=(rand()-.5)*350;}rainPos[j+3]=rainPos[j]-.19;rainPos[j+4]=rainPos[j+1]-1.4;rainPos[j+5]=rainPos[j+2]+.06;}rainGeo.attributes.position.needsUpdate=true;for(let i=0;i<nearCount;i++){const j=i*6;nearRainPos[j+1]-=dt*24;if(nearRainPos[j+1]<-40)nearRainPos[j+1]=40;nearRainPos[j+3]=nearRainPos[j]-.12;nearRainPos[j+4]=nearRainPos[j+1]-.85;nearRainPos[j+5]=nearRainPos[j+2];}nearRainGeo.attributes.position.needsUpdate=true;}
  }
  renderer.render(scene,camera);
}
document.addEventListener('visibilitychange',()=>{hidden=document.hidden;if(!hidden)lastTick=performance.now();});
setView('aerial',true);setWeather('sunny');composeCamera();applyLighting();updateLabels();
renderer.setAnimationLoop(animate);
requestAnimationFrame(()=>requestAnimationFrame(()=>loading.classList.add('done')));

}
function showFallback(){
 document.body.innerHTML=`<main class="campus-stills"><img id="campusStill" src="../../assets/campus-overview.webp" alt="原校园模型全景"><header><small>江苏省兴化中学 / 原项目模型</small><h1>走进三维校园</h1><p>建筑与空间按参考照片近似复原</p></header><nav aria-label="原模型渲染视角"><button data-still="overview" class="active">校园全景</button><button data-still="gate">正门广场</button><button data-still="teaching">教学建筑</button><button id="stillFull">全屏 ⛶</button></nav><footer>当前展示为原模型几何渲染静帧 · 尺寸与局部布局为估算</footer></main>`;
 document.querySelectorAll('[data-still]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-still]').forEach(x=>x.classList.toggle('active',x===b));document.getElementById('campusStill').src='../../assets/campus-'+b.dataset.still+'.webp';});
 document.getElementById('stillFull').onclick=()=>document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen();
}
