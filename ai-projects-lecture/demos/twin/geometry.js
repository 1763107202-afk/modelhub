import * as THREE from './vendor/three.module.js';
const geo={box:new THREE.BoxGeometry(1,1,1),cylinder:new THREE.CylinderGeometry(1,1,1,24),sphere:new THREE.SphereGeometry(1,16,10),cone:new THREE.ConeGeometry(1,1,16),leaf:new THREE.IcosahedronGeometry(1,2)};
const roundedCache=new Map();
const wideCylinder=new THREE.CylinderGeometry(1,1,1,96);
export const V=p=>new THREE.Vector3(...p);
export function group(parent,name){const g=new THREE.Group();g.name=name;parent.add(g);return g;}
export function material(color,metalness=.3,roughness=.5){return new THREE.MeshStandardMaterial({color,metalness,roughness});}
export function luminous(color,intensity=1){return new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:intensity,roughness:.35,metalness:.25});}
export function mesh(parent,geometry,mat,p=[0,0,0],scale=[1,1,1]){const m=new THREE.Mesh(geometry,mat);m.position.set(...p);m.scale.set(...scale);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
export const box=(parent,p,size,mat)=>mesh(parent,geo.box,mat,p,size);
export const cyl=(parent,p,r,h,mat)=>mesh(parent,r>2?wideCylinder:geo.cylinder,mat,p,[r,h,r]);
export const ball=(parent,p,size,mat)=>mesh(parent,geo.sphere,mat,p,typeof size==='number'?[size,size,size]:size);
export const leaf=(parent,p,size,mat)=>mesh(parent,geo.leaf,mat,p,size);
export function beam(parent,a,b,r,mat){const av=V(a),bv=V(b),d=bv.clone().sub(av);const m=cyl(parent,av.clone().add(bv).multiplyScalar(.5).toArray(),r,d.length(),mat);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());return m;}
export function boxBeam(parent,a,b,w,h,mat){const av=V(a),bv=V(b),d=bv.clone().sub(av);const m=box(parent,av.clone().add(bv).multiplyScalar(.5).toArray(),[w,d.length(),h],mat);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());return m;}
export function torus(parent,p,r,t,mat,axis='y',arc=Math.PI*2){const m=mesh(parent,new THREE.TorusGeometry(r,t,8,Math.max(24,Math.ceil(r*18)),arc),mat,p);if(axis==='y')m.rotation.x=Math.PI/2;return m;}
export function tube(parent,points,r,mat,closed=false,segments=points.length*2){const path=new THREE.CatmullRomCurve3(points.map(V),closed,'centripetal');return mesh(parent,new THREE.TubeGeometry(path,segments,r,6,closed),mat);}
export function roundedBox(parent,p,size,r,mat){
 const key=size.join(',')+'/'+r;if(roundedCache.has(key))return mesh(parent,roundedCache.get(key),mat,p);
 const [w,h,d]=size,shape=new THREE.Shape(),x=-w/2,y=-h/2;
 shape.moveTo(x+r,y);shape.lineTo(x+w-r,y);shape.quadraticCurveTo(x+w,y,x+w,y+r);shape.lineTo(x+w,y+h-r);shape.quadraticCurveTo(x+w,y+h,x+w-r,y+h);shape.lineTo(x+r,y+h);shape.quadraticCurveTo(x,y+h,x,y+h-r);shape.lineTo(x,y+r);shape.quadraticCurveTo(x,y,x+r,y);
 const g=new THREE.ExtrudeGeometry(shape,{depth:d,bevelEnabled:true,bevelThickness:r*.22,bevelSize:r*.22,bevelSegments:2,steps:1,curveSegments:5});g.translate(0,0,-d/2);roundedCache.set(key,g);return mesh(parent,g,mat,p);
}
export function textSign(parent,text,p,size,color='#d9f6f5',background=null){
 const c=document.createElement('canvas');c.width=1024;c.height=256;const ctx=c.getContext('2d');if(background){ctx.fillStyle=background;ctx.fillRect(0,0,c.width,c.height);}ctx.font='600 86px Arial, Microsoft YaHei, sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=color;ctx.fillText(text,512,128);
 const map=new THREE.CanvasTexture(c);map.colorSpace=THREE.SRGBColorSpace;const mat=new THREE.MeshBasicMaterial({map,transparent:!background,side:THREE.DoubleSide,depthWrite:false});return mesh(parent,new THREE.PlaneGeometry(size,size/4),mat,p);
}
export function batchStatic(root){
 root.updateMatrixWorld(true);const inv=root.matrixWorld.clone().invert(),batches=new Map();
 root.traverse(m=>{if(!m.isMesh||Array.isArray(m.material)||m.material.transparent||m.geometry.attributes.position.count>5000)return;let p=m;while(p&&p!==root){if(p.userData.dynamic)return;p=p.parent;}const key=m.geometry.uuid+'/'+m.material.uuid;let b=batches.get(key);if(!b){b={geo:m.geometry,mat:m.material,items:[]};batches.set(key,b);}b.items.push(m);});
 for(const b of batches.values()){if(b.items.length<3)continue;const instance=new THREE.InstancedMesh(b.geo,b.mat,b.items.length);for(let i=0;i<b.items.length;i++){instance.setMatrixAt(i,inv.clone().multiply(b.items[i].matrixWorld));b.items[i].removeFromParent();}instance.castShadow=true;instance.receiveShadow=true;instance.instanceMatrix.needsUpdate=true;instance.computeBoundingSphere();root.add(instance);}
}
