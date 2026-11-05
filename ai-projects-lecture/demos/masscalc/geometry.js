const TAU=Math.PI*2;
export function theoreticalVolume(model){
  const p=model.params;
  if(model.type==='sleeve')return Math.PI/4*(p['外径']**2*p['总长']-p['内腔径']**2*p['内腔深']-p['底孔径']**2*(p['总长']-p['内腔深']));
  if(model.type==='shaft')return Math.PI/4*(p['法兰径']**2*p['法兰厚']+p['主体径']**2*p['主体长']+p['尾径']**2*p['尾长']);
  if(model.type==='washer')return Math.PI/4*(p['外径']**2-p['内径']**2)*p['厚度'];
  return (p['长']*p['宽']-(4-Math.PI)*p['圆角半径']**2)*p['厚度'];
}
function triangulate(poly){
  let indices=poly.map((_,i)=>i),area=0;const out=[];
  for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length];area+=a[0]*b[1]-b[0]*a[1];}
  const sign=Math.sign(area)||1,cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
  let guard=0;
  while(indices.length>3&&guard++<200){let cut=false;
    for(let k=0;k<indices.length;k++){
      const ids=[indices[(k+indices.length-1)%indices.length],indices[k],indices[(k+1)%indices.length]],pts=ids.map(i=>poly[i]);
      if(cross(...pts)*sign<=1e-9)continue;
      const inside=indices.some(i=>!ids.includes(i)&&cross(pts[0],pts[1],poly[i])*sign>=-1e-9&&cross(pts[1],pts[2],poly[i])*sign>=-1e-9&&cross(pts[2],pts[0],poly[i])*sign>=-1e-9);
      if(inside)continue;out.push(ids);indices.splice(k,1);cut=true;break;
    }if(!cut)break;
  }if(indices.length===3)out.push([...indices]);return out;
}
export function createMesh(model,section=false){
  const p=model.params,faces=[];let height=1,diameter=1;
  const face=(a,b,c,cut=false)=>faces.push({v:[a,b,c],cut});
  if(model.type==='cover'){
    const w=p['长'],h=p['宽'],r=p['圆角半径'],t=p['厚度'],poly=[];height=t;diameter=Math.max(w,h);
    const corners=[[w/2-r,h/2-r,0],[-w/2+r,h/2-r,Math.PI/2],[-w/2+r,-h/2+r,Math.PI],[w/2-r,-h/2+r,Math.PI*1.5]];
    for(const [cx,cz,start]of corners)for(let i=0;i<=20;i++){const a=start+i*Math.PI/40;poly.push([cx+r*Math.cos(a),cz+r*Math.sin(a)]);}
    for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],v0=[a[0],-t/2,a[1]],v1=[b[0],-t/2,b[1]],v2=[b[0],t/2,b[1]],v3=[a[0],t/2,a[1]];face(v0,v1,v2);face(v0,v2,v3);face([0,t/2,0],v3,v2);face([0,-t/2,0],v1,v0);}
  }else{
    let profile;
    if(model.type==='sleeve'){height=p['总长'];diameter=p['外径'];const bottom=height-p['内腔深'];profile=[[p['外径']/2,0],[p['外径']/2,height],[p['内腔径']/2,height],[p['内腔径']/2,bottom],[p['底孔径']/2,bottom],[p['底孔径']/2,0]];}
    else if(model.type==='shaft'){height=p['法兰厚']+p['主体长']+p['尾长'];diameter=p['法兰径'];const a=p['法兰厚'],b=a+p['主体长'];profile=[[0,0],[p['法兰径']/2,0],[p['法兰径']/2,a],[p['主体径']/2,a],[p['主体径']/2,b],[p['尾径']/2,b],[p['尾径']/2,height],[0,height]];}
    else{height=p['厚度'];diameter=p['外径'];profile=[[p['外径']/2,0],[p['外径']/2,height],[p['内径']/2,height],[p['内径']/2,0]];}
    const n=128,start=section?-Math.PI/2:0,end=section?Math.PI/2:TAU;
    const v=(q,a)=>[q[0]*Math.cos(a),q[1]-height/2,q[0]*Math.sin(a)];
    for(let i=0;i<n;i++){const a=start+(end-start)*i/n,b=start+(end-start)*(i+1)/n;for(let j=0;j<profile.length;j++){const q=profile[j],r=profile[(j+1)%profile.length];face(v(q,a),v(r,a),v(r,b));face(v(q,a),v(r,b),v(q,b));}}
    if(section)for(const ids of triangulate(profile)){const [a,b,c]=ids.map(i=>profile[i]);face(v(a,start),v(b,start),v(c,start),true);face(v(c,end),v(b,end),v(a,end),true);}
  }
  const size=Math.max(height,diameter),tilt=model.type==='shaft'?-.95:0;
  return faces.map(f=>({...f,v:f.v.map(([x,y,z])=>[(x*Math.cos(tilt)-y*Math.sin(tilt))/size,(x*Math.sin(tilt)+y*Math.cos(tilt))/size,z/size])}));
}
export function projectFaces(mesh,yaw=.55,pitch=.48,zoom=1){
  const cy=Math.cos(yaw),sy=Math.sin(yaw),cx=Math.cos(pitch),sx=Math.sin(pitch);
  return mesh.map(f=>{const v=f.v.map(([x,y,z])=>{const X=x*cy+z*sy,Z=z*cy-x*sy;return [X,(y*cx-Z*sx),y*sx+Z*cx];});
    const u=v[1].map((x,i)=>x-v[0][i]),w=v[2].map((x,i)=>x-v[0][i]),n=[u[1]*w[2]-u[2]*w[1],u[2]*w[0]-u[0]*w[2],u[0]*w[1]-u[1]*w[0]],len=Math.hypot(...n)||1;
    const light=Math.abs((n[0]*-.35+n[1]*.65+n[2]*.68)/len),shade=Math.round(40+light*39),color=f.cut?`hsl(41 53% ${shade+5}%)`:`hsl(182 24% ${shade}%)`;
    return {points:v.map(([x,y,z])=>{const k=1/(1-z*.22);return [x*k*zoom,-y*k*zoom];}),depth:v.reduce((s,p)=>s+p[2],0)/3,color};
  }).sort((a,b)=>a.depth-b.depth);
}
