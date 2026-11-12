'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {planAwards} = require('../awards.js');

function entrants() {
  return Array.from({length:36},(_,i)=>({
    id:'t'+(i+1),name:'队伍'+String(i+1).padStart(2,'0'),draw_order:i+1,
    score:100-i,elapsed_ms:100000+i*1000,tie_order:null,status:'scored'
  }));
}

test('unresolved first-prize boundary blocks automatic award allocation',()=>{
  const teams=entrants();
  teams[3].score=teams[2].score;
  teams[3].elapsed_ms=teams[2].elapsed_ms;
  const plan=planAwards(teams);
  assert.equal(plan.ready,false);
  assert.ok(plan.issues.some(x=>x.code==='unresolved_tie' && x.boundary===3));
});

test('a short or unscored roster cannot produce a releasable award list',()=>{
  const short=entrants().slice(0,35);
  assert.equal(planAwards(short).ready,false);
  assert.ok(planAwards(short).issues.some(x=>x.code==='incomplete_roster'));
  for(const missing of [null,undefined,'',NaN,Infinity]) {
    const teams=entrants();
    teams[35].score=missing;
    const plan=planAwards(teams);
    assert.equal(plan.ready,false,'missing score: '+String(missing));
    assert.ok(plan.issues.some(x=>x.code==='missing_scores'));
  }
});

test('36 confirmed results fill 3 / 7 / 8 names by official rank without changing input',()=>{
  const teams=entrants().reverse();
  const before=JSON.stringify(teams);
  const plan=planAwards(teams);
  assert.equal(plan.ready,true);
  assert.deepEqual(plan.issues,[]);
  assert.deepEqual(plan.groups.map(g=>[g.label,g.teams.length]),[['一等奖',3],['二等奖',7],['三等奖',8]]);
  assert.deepEqual(plan.groups[0].teams.map(t=>t.name),['队伍01','队伍02','队伍03']);
  assert.deepEqual(plan.groups[1].teams.map(t=>t.id),['t4','t5','t6','t7','t8','t9','t10']);
  assert.deepEqual(plan.groups[2].teams.map(t=>t.id),['t11','t12','t13','t14','t15','t16','t17','t18']);
  assert.equal(new Set(plan.groups.flatMap(g=>g.teams.map(t=>t.id))).size,18);
  assert.equal(JSON.stringify(teams),before);
});

for(const boundary of [10,18]) {
  test('unresolved boundary '+boundary+'/'+(boundary+1)+' prevents release',()=>{
    const teams=entrants();
    teams[boundary].score=teams[boundary-1].score;
    teams[boundary].elapsed_ms=teams[boundary-1].elapsed_ms;
    assert.equal(planAwards(teams).ready,false);
    assert.ok(planAwards(teams).issues.some(x=>x.code==='unresolved_tie' && x.boundary===boundary));
  });
}

test('equal scores use shorter certified time to decide the first-prize name',()=>{
  const teams=entrants();
  teams[3].score=teams[2].score;
  teams[2].elapsed_ms=112000;
  teams[3].elapsed_ms=95000;
  teams[2].tie_order=1;
  teams[3].tie_order=2;
  const plan=planAwards(teams);
  assert.equal(plan.ready,true);
  assert.deepEqual(plan.groups[0].teams.map(t=>t.id),['t1','t2','t4']);
  assert.equal(plan.groups[1].teams[0].id,'t3');
});

test('manual tie order resolves a boundary only after score and time match',()=>{
  const teams=entrants();
  teams[3].score=teams[2].score;
  teams[3].elapsed_ms=teams[2].elapsed_ms;
  teams[2].tie_order=2;
  teams[3].tie_order=1;
  const plan=planAwards(teams);
  assert.equal(plan.ready,true);
  assert.equal(plan.groups[0].teams[2].id,'t4');
  teams[2].tie_order=1;
  assert.equal(planAwards(teams).ready,false,'duplicate tie orders still mean an unresolved boundary');
});

test('unknown duration is never treated as a zero-second win',()=>{
  const teams=entrants();
  teams[3].score=teams[2].score;
  teams[2].elapsed_ms=null;
  teams[3].elapsed_ms=120000;
  const plan=planAwards(teams);
  assert.equal(plan.ready,true);
  assert.equal(plan.groups[0].teams[2].id,'t4');
  assert.equal(plan.groups[1].teams[0].id,'t3');
  teams[3].elapsed_ms=null;
  assert.equal(planAwards(teams).ready,false,'two unknown equal times do not break a boundary tie');
});

test('a tie fully inside the same prize tier does not prevent a valid release',()=>{
  const teams=entrants();
  teams[1].score=teams[0].score;
  teams[1].elapsed_ms=teams[0].elapsed_ms;
  assert.equal(planAwards(teams).ready,true);
});

test('recorded zero-score DNF remains a scored team under the existing ranking rules',()=>{
  const teams=entrants();
  teams[35].score=0;
  teams[35].status='dnf';
  teams[35].elapsed_ms=null;
  const plan=planAwards(teams);
  assert.equal(plan.ready,true);
  assert.equal(plan.ranked.length,36);
  assert.equal(plan.ranked[35].id,'t36');
});
