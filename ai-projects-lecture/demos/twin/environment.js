import * as THREE from './vendor/three.module.js';
import {TAU,pointAt,STATION_THETA} from './sequence.js';
import {group,material,luminous,mesh,box,cyl,ball,leaf,beam,boxBeam,torus,roundedBox,textSign,batchStatic} from './geometry.js';

export function buildEnvironment(scene){
 const ground=group(scene,'ParkGround'),park=group(scene,'FutureThemePark');
 const arrivalX=pointAt(STATION_THETA,0)[0];
 const mat={paving:material('#9299a4',.06,.76),edge:material('#526572',.3,.55),dark:material('#203747',.5,.48),light:material('#c6d3d8',.55,.28),grass:material('#486450',0,.92),soil:material('#3b4944',0,1),leaf:material('#3f6546',.02,.85),leaf2:material('#698757',.03,.8),leaf3:material('#2f4e3b',0,.9),wood:material('#876e56',0,.8),glass:new THREE.MeshPhysicalMaterial({color:'#678994',metalness:.1,roughness:.11,transparent:true,opacity:.42,side:THREE.DoubleSide}),cyan:luminous('#7de5e6',1.5),amber:luminous('#f5c78f',1.5),white:luminous('#e7e7d0',1.7),water:new THREE.MeshPhysicalMaterial({color:'#527488',metalness:.64,roughness:.10,clearcoat:1,clearcoatRoughness:.08})};
 box(ground,[0,-.24,0],[200,.30,200],mat.grass);
 cyl(ground,[0,-.045,0],24,.12,mat.paving);
 const waterRing=mesh(park,new THREE.RingGeometry(10.10,11.67,128),mat.water,[0,.045,0]);waterRing.rotation.x=-Math.PI/2;waterRing.name='AnnularReflectingWater';torus(park,[0,.046,0],10.12,.035,mat.edge);torus(park,[0,.049,0],11.68,.048,mat.light);
 for(const r of [10.36,10.84,11.31])torus(park,[0,.053,0],r,.009,mat.light);
 box(park,[arrivalX,.095,-11.1],[2.6,.16,3.3],mat.paving);box(park,[-arrivalX,.095,11.1],[2.6,.16,3.3],mat.paving);
 for(const r of [12.1,15.8,21.4,23.6])torus(ground,[0,.025,0],r,.026,mat.edge);
 for(let i=0;i<72;i++){
  const a=i/72*TAU;beam(ground,[Math.cos(a)*12.0,.025,Math.sin(a)*12.0],[Math.cos(a)*23.7,.025,Math.sin(a)*23.7],.012,mat.edge);
 }
 // Large-format paving joints and twin-colored guide lights make the plaza legible in 3D.
 for(let i=-28;i<=28;i+=2)for(let j=-28;j<=28;j+=2){if(Math.hypot(i,j)<23.8&&Math.hypot(i,j)>10.4){box(ground,[i,.026,j],[1.975,.011,.016],mat.edge);box(ground,[i,.027,j],[.016,.011,1.975],mat.edge);}}
 for(let i=0;i<60;i++){const a=i/60*TAU;if(Math.sin(a)<-.94)continue;const m=box(park,[Math.cos(a)*12.0,.052,Math.sin(a)*12.0],[.22,.023,.08],i<30?mat.cyan:mat.amber);m.rotation.y=-a;}
 box(ground,[arrivalX,.012,-31],[5.0,.06,22],mat.paving);
 for(const x of [arrivalX-2.62,arrivalX+2.62])box(ground,[x,.045,-31],[.13,.065,22],mat.dark);
 // Six planted islands with layered foliage, trunks, shrubs, stone edging, and benches.
 for(let i=0;i<7;i++){
  const a=.13+i/7*TAU;if(Math.sin(a)<-.87)continue;const x=Math.cos(a)*19.2,z=Math.sin(a)*19.2,g=group(park,'PlantedIsland_'+i);g.position.set(x,0,z);
  cyl(g,[0,.24,0],3.0,.40,mat.edge);cyl(g,[0,.47,0],2.89,.055,mat.soil);torus(g,[0,.49,0],2.92,.04,mat.light);
  for(let j=0;j<20;j++){const b=j/20*TAU;ball(g,[Math.cos(b)*2.25,.78,Math.sin(b)*2.25],[.39,.36,.39],j%2?mat.leaf:mat.leaf2);for(let k=0;k<3;k++){const q=b+k*2.2;ball(g,[Math.cos(b)*2.3+Math.cos(q)*.17,1.01,Math.sin(b)*2.3+Math.sin(q)*.17],.033,j%3===0?mat.amber:mat.light);}}
  for(let tree=0;tree<3;tree++){
   const tx=tree===0?-.72:tree===1?.90:.05,tz=tree===0?-.48:tree===1?-.20:.90,h=tree===1?4.1:3.55;
   cyl(g,[tx,h/2+.5,tz],.105,h,mat.wood);
   for(let branch=0;branch<9;branch++){const b=branch/9*TAU+tree;const bx=tx+Math.cos(b)*.82,bz=tz+Math.sin(b)*.82;beam(g,[tx,2.4,tz],[bx,h+.18,bz],.045,mat.wood);leaf(g,[bx,h+.43+Math.sin(b*3)*.22,bz],[.75,.65,.80],branch%2?mat.leaf:mat.leaf2);for(let k=0;k<2;k++)leaf(g,[bx+Math.cos(b+k)*.4,h+.8+k*.2,bz+Math.sin(b+k)*.35],[.43,.39,.46],branch%3?mat.leaf2:mat.leaf3);}
   leaf(g,[tx,h+1.1,tz],[.92,.73,.97],mat.leaf3);leaf(g,[tx-.18,h+1.55,tz-.12],[.64,.60,.70],mat.leaf2);
  }
  const bench=group(park,'Bench');bench.position.set(Math.cos(a)*15.5,.0,Math.sin(a)*15.5);bench.rotation.y=Math.PI/2-a;
  for(let slat=0;slat<5;slat++)box(bench,[0,.52,(slat-2)*.105],[2.0,.07,.084],mat.wood);
  for(const bx of [-.76,.76]){box(bench,[bx,.28,0],[.11,.50,.50],mat.dark);beam(bench,[bx,.52,-.26],[bx,1.06,-.32],.038,mat.dark);}for(let slat=0;slat<4;slat++)box(bench,[0,.67+slat*.105,-.30],[2.0,.075,.066],mat.wood);
 }
 // Architectural lighting poles: slanted stems and slender, two-sided illuminated wings.
 for(let i=0;i<12;i++){
  const a=i/12*TAU+.13,x=Math.cos(a)*17.1,z=Math.sin(a)*17.1,g=group(park,'LightPole');g.position.set(x,0,z);g.rotation.y=-a;
  cyl(g,[0,.12,0],.20,.18,mat.dark);boxBeam(g,[0,.18,0],[.65,5.20,0],.10,.12,mat.light);boxBeam(g,[.65,5.20,0],[-.72,5.75,0],.12,.18,mat.dark);box(g,[-.07,5.42,.10],[1.35,.045,.045],mat.white);
 }
 // A glazed operations pavilion with roof ribs, screens, door, roof trim and service equipment.
 const control=group(park,'OperationsPavilion');control.position.set(13.6,0,-10.3);control.rotation.y=-.38;
 roundedBox(control,[0,.24,0],[5.0,.44,3.9],.18,mat.edge);box(control,[0,1.80,.26],[4.5,2.7,3.10],mat.dark);
 box(control,[0,1.92,-1.34],[4.25,2.40,.05],mat.glass);for(const x of [-1.95,-.65,.65,1.95])box(control,[x,1.90,-1.40],[.05,2.5,.07],mat.light);
 roundedBox(control,[0,3.26,0],[5.38,.20,4.35],.17,mat.light);box(control,[0,3.32,-2.2],[4.65,.035,.035],mat.cyan);
 for(let i=0;i<9;i++)box(control,[-2.3+i*.575,3.44,0],[.05,.12,3.9],mat.edge);
 for(let i=0;i<3;i++){box(control,[-1.3+i*1.25,1.20,-.20],[.9,.77,.65],mat.edge);const screen=box(control,[-1.3+i*1.25,1.88,-.35],[.65,.4,.04],mat.cyan);screen.rotation.x=-.18;}
 roundedBox(control,[0,2.63,-1.47],[2.7,.36,.08],.055,mat.dark);textSign(control,'航程控制 / CONTROL',[0,2.64,-1.52],2.5,'#cdf1f3');
 box(control,[2.29,1.4,.33],[.04,1.9,.92],mat.glass);box(control,[2.35,1.35,.02],[.025,.19,.07],mat.light);
 for(let i=0;i<3;i++)box(control,[2.50,.18+i*.13,.35],[.72,.17+i*.13,1.1],mat.edge);
 // Entry portal and information plinths support the same cold/warm visual identity as the two cars.
 const entry=group(park,'ArrivalPortal');entry.position.set(arrivalX,0,-22.0);
 for(const x of [-3.25,3.25]){roundedBox(entry,[x,2.2,0],[.40,4.4,.48],.07,mat.light);box(entry,[x+(x<0?.23:-.23),2.22,0],[.045,3.8,.22],x<0?mat.cyan:mat.amber);box(entry,[x,.08,0],[.9,.16,.9],mat.dark);}
 roundedBox(entry,[0,4.42,0],[7.15,.71,.63],.14,mat.dark);box(entry,[0,4.83,-.32],[6.5,.028,.034],mat.cyan);textSign(entry,'T W I N   R I F T',[0,4.46,-.335],5.0,'#e8f5f9');
 for(const x of [-4.1,4.1]){roundedBox(entry,[x,.80,1.30],[.65,1.50,.50],.08,mat.dark);const plaque=box(entry,[x,1.12,1.015],[.49,.55,.025],x<0?mat.cyan:mat.amber);plaque.rotation.x=-.07;}
 // Serpentine queue lane, with believable gates, shade ribs and waiting guests.
 const queue=group(park,'Queue');queue.position.set(-9.8,0,-15.8);
 for(const z of [-2.1,-.7,.7,2.1])for(let x=-3.8;x<=3.8;x+=.95){beam(queue,[x,.05,z],[x,1.08,z],.027,mat.light);cyl(queue,[x,.035,z],.12,.04,mat.dark);if(x<3.8)beam(queue,[x,1.08,z],[x+.95,1.08,z],.025,mat.dark);}
 for(let i=0;i<6;i++){const x=-3.6+i*1.44;beam(queue,[x,.05,2.5],[x,3.5,2.5],.048,mat.light);boxBeam(queue,[x,3.5,2.5],[x,3.82,-2.7],.10,.10,mat.dark);}
 const roof=mesh(queue,new THREE.PlaneGeometry(8.7,5.4),new THREE.MeshStandardMaterial({color:'#b9ccd5',transparent:true,opacity:.68,side:THREE.DoubleSide,roughness:.65}),[0,3.66,-.08]);roof.rotation.x=-Math.PI/2-.06;
 // A shallow landscape water strip catches the rail colors without enclosing the ride.
 const water=group(park,'ReflectingPool');water.position.set(9.0,0,14.2);water.rotation.y=-.45;
 roundedBox(water,[0,.10,0],[8.8,.22,2.2],.60,mat.edge);roundedBox(water,[0,.23,0],[8.43,.03,1.88],.52,mat.water);box(water,[0,.27,-.99],[7.45,.018,.026],mat.amber);
 function person(x,z,h,color,yaw=0){const p=group(park,'Visitor');p.position.set(x,.06,z);p.rotation.y=yaw;const shirt=material(color,0,.85),skin=mat.wood,pants=mat.dark;ball(p,[0,h*.84,0],[h*.080,h*.098,h*.079],skin);ball(p,[0,h*.59,0],[h*.11,h*.18,h*.065],shirt);for(const s of [-1,1]){beam(p,[s*.10,h*.44,0],[s*.10,.12,s*.025],.057,pants);ball(p,[s*.10,.08,.07],[.075,.055,.13],pants);beam(p,[s*.15,h*.69,0],[s*.18,h*.42,.05],.045,shirt);ball(p,[s*.18,h*.39,.05],.04,skin);}}
 for(let i=0;i<10;i++)person(-13.1+(i%5)*1.4,-16.35+Math.floor(i/5)*1.40,1.57+(i%3)*.065,['#456078','#9b7b67','#727e70','#a1a8aa'][i%4],Math.PI/2);
 for(const [x,z,h,c,y] of [[-3,-22,1.72,'#596f85',.4],[.7,-23.4,1.65,'#9d8570',.7],[8,-5,1.71,'#718b87',-1.2],[10,7,1.62,'#ab9271',1.8],[-12,8,1.74,'#7e8797',2.3],[-13,8.4,1.6,'#ad9486',2.0],[4,17,1.76,'#5b7a84',-.4]])person(x,z,h,c,y);
 // Quiet distant vegetation gives depth without crowding the mechanical scene.
 for(let i=0;i<30;i++){const a=i/30*TAU,r=33+(i%4)*3,x=Math.cos(a)*r,z=Math.sin(a)*r;if(Math.abs(x+1.42)<4&&z<0)continue;const h=4+(i%4)*.45;cyl(park,[x,h/2,z],.13,h,mat.wood);leaf(park,[x,h,z],[1.9,2.2,1.8],i%2?mat.leaf:mat.leaf3);}
 for(let i=0;i<7;i++){const a=.25+i/7*Math.PI,x=Math.cos(a)*42,z=Math.sin(a)*42,g=group(park,'GardenPavilion');g.position.set(x,0,z);g.rotation.y=-a;roundedBox(g,[0,.55,0],[7.6,1.0,5.4],.25,mat.edge);box(g,[0,2.0,0],[6.8,2.4,4.8],mat.glass);for(const dx of [-3.2,3.2])for(const dz of [-2.2,2.2])box(g,[dx,2.0,dz],[.13,2.8,.13],mat.light);roundedBox(g,[0,3.38,0],[8.1,.22,5.85],.3,mat.light);box(g,[0,3.51,-2.9],[7.7,.025,.035],i%2?mat.amber:mat.cyan);}
 batchStatic(ground);batchStatic(park);
 return {ground,park,mat};
}
