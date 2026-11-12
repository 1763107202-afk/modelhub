/* MOVE.ARENA | Award allocation follows the shared official ranking. */
(function(root) {
  'use strict';
  const ranking = typeof module === 'object' && module.exports ? require('./ranking.js') : root.COMP26_RANKING;
  const hasScore = t => t && t.score !== null && t.score !== undefined &&
    String(t.score).trim() !== '' && Number.isFinite(Number(t.score));
  function planAwards(teams) {
    const roster = Array.isArray(teams) ? teams : [];
    const ranked = ranking.sortRank(roster.filter(hasScore));
    const issues = [];
    if(roster.length !== 36) issues.push({code:'incomplete_roster',
      message:'赛事名单应为36队，当前载入'+roster.length+'队，请先确认名单完整。'});
    const missing = roster.filter(t => !hasScore(t));
    if(missing.length) issues.push({code:'missing_scores',count:missing.length,
      message:'还有'+missing.length+'队未确认有效成绩，暂不能公布获奖名单。'});
    for(const boundary of [3,10,18]) {
      if(ranked[boundary] && ranking.rankNum(ranked,boundary-1) === ranking.rankNum(ranked,boundary)) {
        issues.push({code:'unresolved_tie',boundary,
          message:'第'+boundary+'/'+(boundary+1)+'名得分与用时相同，请先完成同分裁决。'});
      }
    }
    return {
      ready: issues.length === 0,
      issues,
      ranked,
      groups: [
        {key:'first',label:'一等奖',count:3,startRank:1,endRank:3,teams:ranked.slice(0,3)},
        {key:'second',label:'二等奖',count:7,startRank:4,endRank:10,teams:ranked.slice(3,10)},
        {key:'third',label:'三等奖',count:8,startRank:11,endRank:18,teams:ranked.slice(10,18)}
      ]
    };
  }
  const api = {planAwards};
  root.COMP26_AWARDS = api;
  if(typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
