/* The document root stays fullscreen while its scenes and dialogs change. */
(() => {
  'use strict';
  function syncButtons() {
    const active=!!document.fullscreenElement;
    document.querySelectorAll('[data-presentation-fullscreen]').forEach(button=>{
      button.textContent=active?'已全屏 · Esc退出':'全屏投影';
      button.disabled=active;
      button.setAttribute('aria-pressed',String(active));
    });
  }
  document.addEventListener('click', async event=>{
    const button=event.target.closest?.('[data-presentation-fullscreen]');
    if(!button||document.fullscreenElement)return;
    try {
      if(!document.documentElement.requestFullscreen)throw new Error('Fullscreen unavailable');
      await document.documentElement.requestFullscreen({navigationUI:'hide'});
    } catch {
      button.textContent='请按 F11 全屏';
      button.setAttribute('aria-label','浏览器未开启网页全屏，请按F11或使用浏览器全屏菜单');
    }
  });
  document.addEventListener('fullscreenchange',syncButtons);
  syncButtons();
})();
