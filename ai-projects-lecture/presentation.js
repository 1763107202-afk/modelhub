'use strict';
(() => {
  const body = document.body;
  const controls = document.getElementById('lectureControls');
  const desktop = matchMedia('(min-width:1100px) and (min-height:840px)');
  let pending = false;

  function apply(wrap, growth) {
    wrap.style.setProperty('--talk-scale', (1 + growth * .16).toFixed(4));
    wrap.style.setProperty('--talk-image-extra', (growth * 150).toFixed(2) + 'px');
    wrap.style.setProperty('--talk-space-extra', (growth * 18).toFixed(2) + 'px');
  }
  function fit() {
    pending = false;
    if (!body.classList.contains('preso') || !desktop.matches || controls.hidden) return;
    const wrap = document.querySelector('.scene.active > .wrap');
    if (!wrap) return;
    apply(wrap, 0);
    const limit = controls.getBoundingClientRect().top - 28;
    const padding = parseFloat(getComputedStyle(wrap).paddingBottom) || 0;
    const fits = () => wrap.getBoundingClientRect().bottom - padding <= limit;
    if (!fits()) return;
    let lower = 0, upper = 1.6;
    for (let step = 0; step < 9; step++) {
      const candidate = (lower + upper) / 2;
      apply(wrap, candidate);
      if (fits()) lower = candidate;
      else upper = candidate;
    }
    apply(wrap, lower);
  }
  function schedule() {
    if (!pending) { pending = true; requestAnimationFrame(fit); }
  }
  new MutationObserver(records => {
    if (records.some(record => record.target === body || record.target.classList.contains('scene'))) schedule();
  }).observe(body, {subtree:true,attributes:true,attributeFilter:['class']});
  addEventListener('resize', schedule, {passive:true});
  addEventListener('fullscreenchange', schedule);
  document.addEventListener('toggle', schedule, true);
  document.fonts?.ready.then(schedule);
  document.addEventListener('load', event => {
    if (event.target instanceof HTMLImageElement && event.target.closest('.scene.active')) schedule();
  }, true);
  schedule();
})();
