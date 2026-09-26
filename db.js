/**
 * db.js — Flavor Fusion v2
 * IndexedDB data layer with localStorage migration
 * Stores: events, expenses, vendors, cPays, vPays
 * Images stored separately in 'photos' store (blob/base64)
 */

const DB_NAME    = 'FlavorFusionDB';
const DB_VERSION = 2;
const STORES     = ['events','expenses','vendors','cPays','vPays','photos','meta'];

let _db = null;

/* ── OPEN / INIT ─────────────────────────────────── */
export function openDB() {
  return new Promise((resolve, reject) => {
    if (_db) { resolve(_db); return; }
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = e => {
      const db = e.target.result;
      STORES.forEach(name => {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name, { keyPath: 'id' });
        }
      });
    };

    req.onsuccess = e => { _db = e.target.result; resolve(_db); };
    req.onerror   = e => reject(e.target.error);
  });
}

/* ── GENERIC CRUD ────────────────────────────────── */
export async function getAll(store) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror   = () => reject(req.error);
  });
}

export async function getOne(store, id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror   = () => reject(req.error);
  });
}

export async function putOne(store, record) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(store, 'readwrite');
    const req = tx.objectStore(store).put(record);
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

export async function putMany(store, records) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const os = tx.objectStore(store);
    records.forEach(r => os.put(r));
    tx.oncomplete = () => resolve();
    tx.onerror    = () => reject(tx.error);
  });
}

export async function deleteOne(store, id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(store, 'readwrite');
    const req = tx.objectStore(store).delete(id);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

export async function clearStore(store) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(store, 'readwrite');
    const req = tx.objectStore(store).clear();
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

/* ── META (app version, PIN, etc.) ──────────────── */
export async function getMeta(key) {
  const row = await getOne('meta', key);
  return row ? row.value : null;
}

export async function setMeta(key, value) {
  await putOne('meta', { id: key, value });
}

/* ── PHOTO STORAGE (compressed) ─────────────────── */
export async function savePhoto(eventId, dataUrl) {
  const compressed = await compressImage(dataUrl, 800, 0.72);
  const id = `photo_${eventId}_${Date.now()}`;
  await putOne('photos', { id, eventId, data: compressed, createdAt: new Date().toISOString() });
  return id;
}

export async function getPhotosForEvent(eventId) {
  const all = await getAll('photos');
  return all.filter(p => p.eventId === eventId);
}

export async function deletePhoto(photoId) {
  await deleteOne('photos', photoId);
}

function compressImage(dataUrl, maxWidth, quality) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let w = img.width, h = img.height;
      if (w > maxWidth) { h = Math.round(h * maxWidth / w); w = maxWidth; }
      canvas.width  = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.src = dataUrl;
  });
}

/* ── MIGRATION: localStorage → IndexedDB ────────── */
const LS_KEYS = { EV:'ffv5_ev', CP:'ffv5_cp', EX:'ffv5_ex', VN:'ffv5_vn', VP:'ffv5_vp' };
const STORE_MAP = { EV:'events', CP:'cPays', EX:'expenses', VN:'vendors', VP:'vPays' };

export async function migrateFromLocalStorage() {
  const migrated = await getMeta('ls_migrated');
  if (migrated) return false; // already done

  let hasSomething = false;
  for (const [key, store] of Object.entries(STORE_MAP)) {
    const raw = localStorage.getItem(LS_KEYS[key]);
    if (!raw) continue;
    try {
      const records = JSON.parse(raw);
      if (!Array.isArray(records) || !records.length) continue;

      // For events, migrate photos out of the record blob into photos store
      if (store === 'events') {
        for (const ev of records) {
          const photos = ev.photos || [];
          const photoIds = [];
          for (const dataUrl of photos) {
            if (dataUrl && dataUrl.startsWith('data:')) {
              const pid = await savePhoto(ev.id, dataUrl);
              photoIds.push(pid);
            }
          }
          delete ev.photos; // remove from event record
          ev.photoIds = photoIds;
          ev._v = 2;
        }
      }

      await putMany(store, records);
      hasSomething = true;
    } catch (e) {
      console.warn(`Migration failed for ${store}:`, e);
    }
  }

  if (hasSomething) {
    await setMeta('ls_migrated', new Date().toISOString());
    // Keep localStorage as safety backup for 30 days, don't delete
    console.log('[DB] Migrated data from localStorage → IndexedDB');
  }

  return hasSomething;
}

/* ── FULL EXPORT (all stores) ────────────────────── */
export async function exportAllData() {
  const [events, cPays, expenses, vendors, vPays, photos] = await Promise.all([
    getAll('events'), getAll('cPays'), getAll('expenses'),
    getAll('vendors'), getAll('vPays'), getAll('photos')
  ]);
  return {
    version: 'ffv2',
    exportedAt: new Date().toISOString(),
    appVersion: APP_VERSION,
    events, cPays, expenses, vendors, vPays, photos
  };
}

/* ── FULL IMPORT ─────────────────────────────────── */
export async function importAllData(payload, mode = 'replace') {
  const requiredKeys = ['events','cPays','expenses','vendors','vPays'];
  for (const k of requiredKeys) {
    if (!Array.isArray(payload[k])) throw new Error(`Missing or invalid field: ${k}`);
  }

  if (mode === 'replace') {
    for (const store of [...requiredKeys, 'photos']) {
      await clearStore(store);
    }
  }

  await putMany('events',   payload.events   || []);
  await putMany('cPays',    payload.cPays     || []);
  await putMany('expenses', payload.expenses  || []);
  await putMany('vendors',  payload.vendors   || []);
  await putMany('vPays',    payload.vPays     || []);
  if (payload.photos?.length) {
    await putMany('photos', payload.photos);
  }
}

/* ── VERSIONING ──────────────────────────────────── */
export const APP_VERSION = '2.0.0';

export async function checkAndMigrate() {
  await openDB();
  const storedVer = await getMeta('app_version');

  // Run localStorage migration if needed
  await migrateFromLocalStorage();

  // Future: add v2→v3 migrations here
  // if (storedVer === '2.0.0') { ... }

  await setMeta('app_version', APP_VERSION);
  return storedVer;
}
