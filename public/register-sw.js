// Updates activate without a controllerchange reload, preserving open entries.
window.caterDeskUpdate = async function () {
  if (!('serviceWorker' in navigator)) throw new Error('Updates are unavailable in this browser.');
  const reg = await navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' });
  await reg.update();
  const installing = reg.installing || reg.waiting;
  if (installing && installing.state !== 'activated') {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => { cleanup(); reject(new Error('Update still downloading. Try again shortly.')); }, 20000);
      function cleanup() { clearTimeout(timer); installing.removeEventListener('statechange', changed); }
      function changed() {
        if (installing.state === 'activated') { cleanup(); resolve(); }
        else if (installing.state === 'redundant') { cleanup(); reject(new Error('Update failed. Your current app is still available.')); }
      }
      installing.addEventListener('statechange', changed); changed();
    });
  }
  if (!reg.active) throw new Error('App is being installed. Try again shortly.');
  return new Promise((resolve, reject) => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => { channel.port1.close(); reject(new Error('Reopen the app to finish updating.')); }, 4000);
    channel.port1.onmessage = e => { clearTimeout(timer); channel.port1.close(); resolve(e.data.release); };
    reg.active.postMessage({ type: 'GET_RELEASE' }, [channel.port2]);
  });
};
if ('serviceWorker' in navigator) window.caterDeskUpdate().catch(() => {});
