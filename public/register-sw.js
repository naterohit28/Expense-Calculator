if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').then(reg => {
    reg.update().catch(() => {});
  }).catch(console.error);
}
