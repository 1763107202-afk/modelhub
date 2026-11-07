/* MOVE.ARENA | Official ranking v8.
   Scores descend; within equal scores shorter certified elapsed time wins.
   Manual tie order applies only after equal score and equal elapsed time.
   Unknown duration must never be treated as 0 seconds. */
(function(root) {
  'use strict';
  const hasTime = t => Number.isInteger(Number(t?.elapsed_ms)) && Number(t.elapsed_ms) > 0;
  const duration = t => hasTime(t) ? Number(t.elapsed_ms) : Infinity;
  const scoreOf = t => Number(t.score);
  function compare(a,b) {
    const diff = scoreOf(b)-scoreOf(a);
    if(diff) return diff;
    const timeDiff = duration(a)-duration(b);
    if(Number.isFinite(timeDiff) && timeDiff) return timeDiff;
    if(duration(a)!==duration(b)) return duration(a)===Infinity ? 1 : -1;
    const tieA = a.tie_order==null ? Infinity : Number(a.tie_order);
    const tieB = b.tie_order==null ? Infinity : Number(b.tie_order);
    if(tieA!==tieB) return tieA-tieB;
    return Number(a.draw_order??a.order??0)-Number(b.draw_order??b.order??0);
  }
  function sortRank(teams) {
    return teams.filter(t=>t.score!==null && t.score!==undefined).slice().sort(compare);
  }
  function rankNum(ranked,i) {
    const t=ranked[i]; if(!t)return null;
    return ranked.findIndex(x=>scoreOf(x)===scoreOf(t) &&
      duration(x)===duration(t) &&
      (x.tie_order==null ? null : Number(x.tie_order))===(t.tie_order==null ? null : Number(t.tie_order)))+1;
  }
  function displayTime(ms) {
    if(!Number.isInteger(Number(ms)) || Number(ms)<=0) return '—';
    const cs=Math.round(Number(ms)/10);
    const mm=Math.floor(cs/6000),ss=Math.floor((cs%6000)/100),xx=cs%100;
    return String(mm).padStart(2,'0')+':'+String(ss).padStart(2,'0')+'.'+String(xx).padStart(2,'0');
  }
  const api={compare,sortRank,rankNum,displayTime};
  root.COMP26_RANKING=api;
  if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
