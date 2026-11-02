'use strict';
/* ========== Start-up ========== */
(async function start() {
  await loadState();
  window.addEventListener('hashchange', render);
  render();
  cleanupPhotos();
  notifyWeb();
  scheduleReminders();
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
  // Android app (Capacitor): hardware back button
  const C = window.Capacitor;
  if (C && C.Plugins && C.Plugins.App && isNative()) {
    C.Plugins.App.addListener('backButton', () => {
      if ($('#modal').classList.contains('show')) { closeModal(); return; }
      const [p] = parseHash();
      if (p === 'home' || p === 'setup') C.Plugins.App.exitApp(); else history.back();
    });
  }
  // Offline support when used as a web app
  if ('serviceWorker' in navigator && location.protocol.startsWith('http') && !isNative()) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
