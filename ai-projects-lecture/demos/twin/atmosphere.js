import * as THREE from './vendor/three.module.js';

export function buildAtmosphere(renderer,scene){
 const uniforms={day:{value:0},zenith:{value:new THREE.Color('#34456f')},horizon:{value:new THREE.Color('#e7ac9b')},band:{value:new THREE.Color('#a17c9a')}};
 const material=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms,vertexShader:`varying vec3 direction;void main(){direction=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,fragmentShader:`
  varying vec3 direction;uniform float day;uniform vec3 zenith,horizon,band;
  void main(){vec3 d=normalize(direction);float h=max(d.y,0.0);vec3 dusk=mix(horizon,band,smoothstep(0.0,0.24,h));dusk=mix(dusk,zenith,smoothstep(0.18,0.92,h));vec3 daylight=mix(vec3(.61,.77,.88),vec3(.22,.43,.67),pow(h,.48));vec3 col=mix(dusk,daylight,day);float sun=pow(max(dot(d,normalize(vec3(-.81,.12,-.48))),0.0),110.0);col+=vec3(.55,.27,.09)*sun*(1.0-day*.72);float cloud=sin(d.x*17.0+d.z*9.0+sin(d.z*33.0)*.45)*sin(d.z*35.0-d.x*7.0);float veil=smoothstep(.35,.85,cloud)*exp(-pow((h-.23)*7.0,2.0));col=mix(col,vec3(.76,.57,.58),veil*.18*(1.0-day));gl_FragColor=vec4(col,1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
 }`});
 const sky=new THREE.Mesh(new THREE.SphereGeometry(180,48,24),material);sky.name='SunsetSky';sky.frustumCulled=false;sky.renderOrder=-100;scene.add(sky);
 const room=new THREE.Scene(),roomSky=new THREE.Mesh(sky.geometry,material);room.add(roomSky);
 const panel=(color,intensity,w,h,p)=>{const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide}));m.material.color.multiplyScalar(intensity);m.position.set(...p);m.lookAt(0,3,0);room.add(m);};
 panel('#fff5e4',2.4,20,10,[-18,17,-13]);panel('#bcdfff',1.4,14,18,[22,12,8]);panel('#fff2df',1.2,28,6,[0,28,0]);panel('#e8a797',1.5,24,4,[-8,7,25]);
 const generator=new THREE.PMREMGenerator(renderer);generator.compileCubemapShader();const maps=new Map();
 function setDay(day){uniforms.day.value=day?1:0;if(!maps.has(day))maps.set(day,generator.fromScene(room,.07,.1,220));scene.environment=maps.get(day).texture;scene.environmentIntensity=day?.78:.90;}
 setDay(false);
 return {sky,setDay,update(camera){sky.position.copy(camera.position);}};
}
