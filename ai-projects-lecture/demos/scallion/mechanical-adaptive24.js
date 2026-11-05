import * as T from 'three';import {GRIP24} from './grip24-data.js';import {A24,clamp24} from './adaptive24.js';import {C,laneZ,localPoint} from './flow14.js';
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
// Circular wire is rebuilt on its helix; wire diameter never scales with stroke.
export function spring24(lengthMM=25){const N=22,ns=N*24,nr=6,R=2.75,r=.225,L=lengthMM,vs=[],ix=[];
 const axial=u=>u<1?.225+.45*u:u<=21?.675+(L-1.35)*(u-1)/20:L-.675+.45*(u-21);
 for(let j=0;j<=ns;j++){const u=N*j/ns,a=u*Math.PI*2,x=axial(u),pitch=u<1||u>21?.45:(L-1.35)/20,t=V(pitch, -2*Math.PI*R*Math.sin(a),2*Math.PI*R*Math.cos(a)).normalize(),n=V(0,Math.cos(a),Math.sin(a)),b=t.clone().cross(n).normalize();for(let k=0;k<nr;k++){const q=k/nr*Math.PI*2;vs.push((x+r*(Math.cos(q)*n.x+Math.sin(q)*b.x))*.001,(R*Math.cos(a)+r*(Math.cos(q)*n.y+Math.sin(q)*b.y))*.001,(R*Math.sin(a)+r*(Math.cos(q)*n.z+Math.sin(q)*b.z))*.001);}}
 for(let j=0;j<ns;j++)for(let k=0;k<nr;k++){const a=j*nr+k,b=j*nr+(k+1)%nr,c=a+nr,d=b+nr;ix.push(a,c,b,b,c,d);}for(const j of [0,ns]){const c=vs.length/3;vs.push(axial(N*j/ns)*.001,R*.001,0);for(let k=0;k<nr;k++){const a=j*nr+k,b=j*nr+(k+1)%nr;if(j)ix.push(c,a,b);else ix.push(c,b,a);}}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vs,3));g.setIndex(ix);g.computeVertexNormals();return g;
}
