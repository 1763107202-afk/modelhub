import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3} from 'three';
import {MeArmModel} from '../lib/sim/mearm-model.mjs';
import {Simulation,DEFAULT_CONFIG,armPoints} from '../lib/sim/world.mjs';

test('Empty simulator stays idle with centered real sensors until user supplies code',()=>{
 const world=new Simulation(),pose={...world.pose};world.tick(1000);
 assert.equal(world.vm,null);assert.equal(world.error,null);assert.deepEqual(world.motor,[0,0,0,0]);assert.deepEqual(world.pose,pose);assert.deepEqual(world.sensors,[0,1,1,0]);
});

test('MeArm plates remain connected and rendered grip matches the physical grip after yaw and vehicle rotation',()=>{
 const world=new Simulation(),model=new MeArmModel(DEFAULT_CONFIG);
 for(const angles of [[90,90,90,140],[32,90,125,155],[140,90,70,155],[22,120,135,155],[115,80,60,155]]){
  model.update(angles,world.config);model.root.updateMatrixWorld(true);
  const pivots=armPoints(angles,world.config);
  for(const {p,a,b,x,length} of model.links){
   const start=p.localToWorld(new Vector3(0,0,0)),end=p.localToWorld(new Vector3(0,length,0));
   const expectedStart=model.yaw.localToWorld(new Vector3(x,pivots[a].y,-pivots[a].r)),expectedEnd=model.yaw.localToWorld(new Vector3(x,pivots[b].y,-pivots[b].r));
   assert.ok(start.distanceTo(expectedStart)<1e-9);assert.ok(end.distanceTo(expectedEnd)<1e-9);
  }
  for(const theta of [-Math.PI/2,.62,Math.PI]){
   world.pose={x:1,z:2,theta};world.angles=[...angles.slice(0,3),155];world.objects=[{x:0,y:0,z:0,held:true}];world.held=0;world.updateGrip();
   model.update(world.angles,world.config);model.root.updateMatrixWorld(true);
   const grip=model.head.localToWorld(new Vector3(0,-.008,-.091));grip.applyAxisAngle(new Vector3(0,1,0),-theta-Math.PI/2).add(new Vector3(1,0,2));
   const obj=world.objects[0];assert.ok(grip.distanceTo(new Vector3(obj.x,obj.y,obj.z))<1e-9);
  }
 }
});

 test('Stopped wheels do not spin visually when the opposite side drives',()=>{
 const world=new Simulation();world.load('void setup(){digitalWrite(4,HIGH);digitalWrite(16,LOW);analogWrite(2,160);}void loop(){}');world.tick(500);assert.ok(world.wheelAngles[0]<0);assert.deepEqual(world.wheelAngles.slice(1),[0,0,0]);
 });
