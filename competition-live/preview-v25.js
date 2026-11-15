/* Isolated visual fixture. CSP blocks all connections; no official results. */
(() => {
  'use strict';
  const params = new URLSearchParams(location.search);
  let scene = params.get('scene') || 'live';
  function fixture(scene) {
  const allScored = scene === 'awards';
  const scored = allScored ? 36 : scene === 'scored' ? 8 : scene === 'upcoming' ? 0 : 6;
  const remaining = scene === 'warning' ? 25 : scene === 'critical' ? 9 : scene === 'expired' ? 0 : 105;
  const teams = window.COMP26_TEAMS.map((t, i) => ({
    ...t, id: 'preview-' + (i + 1), draw_order: t.order, round_no: t.round,
    status: i < scored ? 'scored' : 'pending',
    score: i < scored ? +(98.15 - i * 1.28).toFixed(2) : null,
    elapsed_ms: i < scored ? 82500 + i * 1970 : null,
    elapsed_source: i < scored ? 'stopwatch' : null,
    attempt_count: 1, tie_order: null, note: ''
  }));
  const event = {
    id:'v25-local-preview', current_round:allScored ? 18 : scene === 'upcoming' ? 1 : 4,
    phase:allScored ? 'awards' : scene === 'upcoming' ? 'upcoming' : 'live',
    awards_revealed:allScored, active_retry_team:null,
    announcement:'V25 设计预览 · 所有成绩均为本机演示数据。第4轮正在比赛，下一轮选手请前往调试区。',
    round_started_at:new Date(Date.now() - (240 - remaining) * 1000).toISOString()
  };
    return {event,teams};
  }
  localStorage.setItem('comp26_preview_v25', JSON.stringify(fixture(scene)));
  document.addEventListener('DOMContentLoaded', () => {
    const menu = document.createElement('nav');
    menu.id = 'v25-preview-menu';
    menu.setAttribute('aria-label', 'V25本机设计预览');
    menu.innerHTML = '<details><summary>V25 · 切换预览</summary><div>' +
      [['live','比赛中'],['upcoming','待开赛'],['warning','最后25秒'],['critical','最后9秒'],['expired','时间到'],['scored','成绩揭晓'],['awards','黑金颁奖']]
        .map(([value,label])=>'<a data-preview-scene="'+value+'" href="?scene='+value+'"'+(scene===value?' aria-current="page"':'')+'>'+label+'</a>').join('') +
      '<button id="v25-replay">重播入场 / 揭晓</button><button data-presentation-fullscreen>全屏投影</button></div></details>';
    document.body.append(menu);
    const style = document.createElement('style');
    style.textContent = '#v25-preview-menu{position:fixed;z-index:2000;right:18px;bottom:54px;font:12px/1.5 system-ui;color:#d9e7e7}#v25-preview-menu summary{cursor:pointer;list-style:none;background:#14262ded;border:1px solid #526773;padding:8px 12px}#v25-preview-menu details>div{background:#101a22f5;border:1px solid #526773;padding:8px;display:grid;gap:4px;max-height:70vh;overflow:auto}#v25-preview-menu a,#v25-preview-menu button{display:block;color:#d9e7e7;background:transparent;border:0;padding:8px 14px;text-align:left;text-decoration:none;cursor:pointer;font:inherit}#v25-preview-menu a[aria-current],#v25-preview-menu a:hover,#v25-preview-menu button:hover{background:#40edbd1c;color:#75f4d1}#v25-preview-menu :focus-visible{outline:2px solid #40edbd}';
    document.head.append(style);
    function replay() {
      document.querySelectorAll('.ma24-lane').forEach(el=>{
        el.classList.remove('ma24-scene-change'); void el.offsetWidth;
        el.classList.add('ma24-scene-change');
      });
      if(scene==='scored')document.querySelectorAll('.ma24-result:first-child,.ma24-row.ma24-scored').forEach(el=>{
        el.classList.remove('ma24-score-change');void el.offsetWidth;el.classList.add('ma24-score-change');
      });
      if(scene==='awards')document.querySelector('#openAwards')?.click();
    }
    document.querySelector('#v25-replay').addEventListener('click',replay);
    menu.addEventListener('click',event=>{
      const link=event.target.closest('[data-preview-scene]');
      if(!link)return;
      event.preventDefault();
      scene=link.dataset.previewScene;
      const data=fixture(scene);
      localStorage.setItem('comp26_preview_v25',JSON.stringify(data));
      const url=new URL(location.href);url.searchParams.set('scene',scene);
      history.replaceState(null,'',url);
      menu.querySelectorAll('[data-preview-scene]').forEach(a=>{
        if(a===link)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');
      });
      menu.querySelector('details').open=false;
      window.dispatchEvent(new CustomEvent('comp26-preview-scene',{detail:data}));
      if(scene!=='awards')menu.querySelector('summary').focus();
      replay();
    });
    replay();
  });
})();
