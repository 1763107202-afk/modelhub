import * as THREE from 'three';

export const material=(color,extra={})=>new THREE.MeshStandardMaterial({color,roughness:.5,...extra});
export function mesh(parent,geometry,m,x=0,y=0,z=0){const o=new THREE.Mesh(geometry,m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;}
export function box(parent,w,h,d,m,x=0,y=0,z=0){return mesh(parent,new THREE.BoxGeometry(w,h,d),m,x,y,z);}
export function cylinder(parent,r,h,m,x=0,y=0,z=0,r2=r,segments=16){return mesh(parent,new THREE.CylinderGeometry(r,r2,h,segments),m,x,y,z);}
export function roundedRect(x,y,w,h,r){const s=new THREE.Shape();s.moveTo(x+r,y);s.lineTo(x+w-r,y);s.quadraticCurveTo(x+w,y,x+w,y+r);s.lineTo(x+w,y+h-r);s.quadraticCurveTo(x+w,y+h,x+w-r,y+h);s.lineTo(x+r,y+h);s.quadraticCurveTo(x,y+h,x,y+h-r);s.lineTo(x,y+r);s.quadraticCurveTo(x,y,x+r,y);return s;}
export function hole(shape,x,y,r){const h=new THREE.Path();h.absarc(x,y,r,0,Math.PI*2,true);shape.holes.push(h);}
export function slot(shape,x,y,w,h,r=.002){shape.holes.push(new THREE.Path(roundedRect(x,y,w,h,r).getPoints(5)));}
export function extrude(shape,thickness=.003){const g=new THREE.ExtrudeGeometry(shape,{depth:thickness,bevelEnabled:false,curveSegments:8});g.translate(0,0,-thickness/2);return g;}
export function plate(parent,shape,thickness,m,plane='side'){const g=extrude(shape,thickness);if(plane==='side')g.rotateY(Math.PI/2);else g.rotateX(-Math.PI/2);return mesh(parent,g,m);}
const fastenerGeometry=new THREE.CylinderGeometry(.0036,.0036,.0025,6);
const washerGeometry=new THREE.CylinderGeometry(.0048,.0048,.0009,16);
export function bolt(parent,m,x,y,z,axis='x'){const group=new THREE.Group();group.position.set(x,y,z);const head=mesh(group,fastenerGeometry,m,0,.0015,0);mesh(group,washerGeometry,m);box(group,.004,.0005,.0007,material(0x46525b),0,.0029,0);if(axis==='x')group.rotation.z=-Math.PI/2;parent.add(group);return group;}
export function cable(parent,points,color,r=.0012){const path=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));return mesh(parent,new THREE.TubeGeometry(path,20,r,5,false),material(color));}
export function servo(parent,m,metal){const g=new THREE.Group();parent.add(g);box(g,.025,.027,.031,m,0,-.018,0);box(g,.025,.008,.027,m,0,-.002,0);box(g,.037,.003,.01,m,0,-.008,0);for(const x of [-.016,.016])cylinder(g,.0015,.004,metal,x,-.005,0);cylinder(g,.006,.005,m,0,.003,0);cylinder(g,.004,.009,metal,0,.008,0);box(g,.022,.002,.006,material(0xe5e8df),0,.012,0);return g;}
