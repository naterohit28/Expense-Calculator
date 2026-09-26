/**
 * app.js — Flavor Fusion v2
 * UI logic: rendering, modals, navigation, events
 * Imports from db.js and utils.js
 */

import {
  openDB, getAll, getOne, putOne, deleteOne, getMeta, setMeta,
  savePhoto, getPhotosForEvent, deletePhoto,
  exportAllData, importAllData, checkAndMigrate, APP_VERSION
} from './db.js';

import {
  EXPENSE_HEADS, CAT_ICONS, EVENT_TYPES, PAY_MODES, SEED_DATA,
  uid, today, fmtDate, fmtCurrency,
  validate, EVENT_RULES, EXPENSE_RULES, PAYMENT_RULES, VENDOR_RULES, VPAY_RULES,
  calcEventReceived, calcEventExpenses, calcEventPL, calcVendorBalance,
  generateInsights, hashPin, verifyPin
} from './utils.js';

/* ── STATE ───────────────────────────────────────── */
let D = { events: [], expenses: [], vendors: [], cPays: [], vPays: [] };
let CT = 'home';
let pendingPhotoEvId = null;
let lightboxState    = { evId: null, photoIds: [], idx: 0 };
let pinBuffer        = '';

/* ── BOOT ────────────────────────────────────────── */
async function boot() {
  showLoading(true);
  try {
    await checkAndMigrate();
    await loadAll();
    await seedIfEmpty();

    const pin = await getMeta('pin_hash');
    if (pin) {
      showPinScreen('unlock');
    } else {
      launchApp();
    }
  } catch (err) {
    console.error('[Boot]', err);
    showToast('App failed to start. Please refresh.', 'error');
  } finally {
    showLoading(false);
  }
}

async function loadAll() {
  const [events, expenses, vendors, cPays, vPays] = await Promise.all([
    getAll('events'), getAll('expenses'), getAll('vendors'),
    getAll('cPays'), getAll('vPays')
  ]);
  D = { events, expenses, vendors, cPays, vPays };
}

async function seedIfEmpty() {
  if (D.events.length > 0) return;
  const s = SEED_DATA;
  await Promise.all([
    ...s.events.map(r => putOne('events', r)),
    ...s.cPays.map(r => putOne('cPays', r)),
    ...s.expenses.map(r => putOne('expenses', r)),
    ...s.vendors.map(r => putOne('vendors', r)),
    ...s.vPays.map(r => putOne('vPays', r))
  ]);
  await loadAll();
}

function launchApp() {
  bindAllEvents();
  initTheme();
  go('home');
}

/* ── LOADING ─────────────────────────────────────── */
function showLoading(show) {
  document.getElementById('loading').classList.toggle('active', show);
}

/* ── TOAST ───────────────────────────────────────── */
function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = type === 'error' ? '⚠ ' + msg : '✓ ' + msg;
  t.className   = type;
  t.style.display = 'block';
  clearTimeout(t._t);
  t._t = setTimeout(() => { t.style.display = 'none'; }, 2500);
}

/* ── THEME ───────────────────────────────────────── */
function initTheme() {
  const s = localStorage.getItem('ffv2_theme') || 'dark';
  document.documentElement.className = s;
  document.getElementById('theme-btn').textContent = s === 'dark' ? '🌙' : '☀️';
}

function toggleTheme() {
  const h = document.documentElement;
  const b = document.getElementById('theme-btn');
  if (h.classList.contains('dark')) {
    h.classList.replace('dark', 'light'); b.textContent = '☀️'; localStorage.setItem('ffv2_theme', 'light');
  } else {
    h.classList.replace('light', 'dark'); b.textContent = '🌙'; localStorage.setItem('ffv2_theme', 'dark');
  }
}

/* ── PIN LOCK ────────────────────────────────────── */
function showPinScreen(mode) {
  pinBuffer = '';
  const screen = document.getElementById('pin-screen');
  screen.dataset.mode = mode;
  document.getElementById('pin-title').textContent =
    mode === 'unlock' ? 'Enter PIN – पिन टाका' :
    mode === 'set'    ? 'Set New PIN – नवीन पिन' :
                        'Confirm PIN – पिन पुष्टी करा';
  document.getElementById('pin-sub').textContent =
    mode === 'unlock' ? 'Enter your 4-digit PIN' :
    mode === 'set'    ? 'Choose a 4-digit PIN for your app' : 'Re-enter your PIN';
  document.getElementById('pin-error').textContent = '';
  document.getElementById('pin-alt').style.display = mode === 'unlock' ? 'block' : 'none';
  renderPinDots();
  screen.classList.add('active');
}

function renderPinDots() {
  const dots = document.querySelectorAll('.pin-dot');
  dots.forEach((d, i) => {
    d.className = 'pin-dot' + (i < pinBuffer.length ? ' filled' : '');
  });
}

function pinKey(val) {
  if (val === 'del') {
    pinBuffer = pinBuffer.slice(0, -1);
    renderPinDots();
    return;
  }
  if (pinBuffer.length >= 4) return;
  pinBuffer += val;
  renderPinDots();

  if (pinBuffer.length === 4) {
    setTimeout(() => handlePinComplete(), 200);
  }
}

async function handlePinComplete() {
  const screen = document.getElementById('pin-screen');
  const mode   = screen.dataset.mode;
  const errEl  = document.getElementById('pin-error');

  if (mode === 'unlock') {
    const stored = await getMeta('pin_hash');
    if (verifyPin(pinBuffer, stored)) {
      screen.classList.remove('active');
      launchApp();
    } else {
      errEl.textContent = 'Wrong PIN – चुकीचा पिन';
      document.querySelectorAll('.pin-dot').forEach(d => d.className = 'pin-dot error');
      setTimeout(() => { pinBuffer = ''; renderPinDots(); errEl.textContent = ''; }, 800);
    }
  } else if (mode === 'set') {
    screen.dataset.firstPin = pinBuffer;
    pinBuffer = '';
    renderPinDots();
    showPinScreen('confirm');
  } else if (mode === 'confirm') {
    if (pinBuffer === screen.dataset.firstPin) {
      await setMeta('pin_hash', hashPin(pinBuffer));
      screen.classList.remove('active');
      showToast('PIN set – पिन सेट झाला');
      if (!document.getElementById('tab-home').classList.contains('active')) {
        launchApp();
      }
    } else {
      errEl.textContent = 'PINs do not match – पिन जुळत नाही';
      document.querySelectorAll('.pin-dot').forEach(d => d.className = 'pin-dot error');
      setTimeout(() => { pinBuffer = ''; showPinScreen('set'); }, 800);
    }
  }
}

async function removePin() {
  await setMeta('pin_hash', null);
  showToast('PIN removed – पिन काढला');
}

/* ── NAVIGATION ──────────────────────────────────── */
function go(id) {
  document.querySelectorAll('.tab, .nav-it, .d-item').forEach(el => el.classList.remove('active'));
  ['tab-' + id, 'n-' + id, 'd-' + id].forEach(s => {
    const el = document.getElementById(s); if (el) el.classList.add('active');
  });
  const fab = document.getElementById('fab');
  fab.style.display = ['evdetail', 'vendetail', 'summary'].includes(id) ? 'none' : 'flex';
  CT = id;
  renderPage(id);
  window.scrollTo(0, 0);
}

function renderPage(id) {
  if (id === 'home')    rHome();
  if (id === 'events')  rEvents();
  if (id === 'expenses') rExp();
  if (id === 'vendors') rVen();
  if (id === 'summary') rSummary();
}

function fabAction() {
  if (CT === 'expenses') openExpModal();
  else if (CT === 'vendors') openVenModal();
  else openEvModal();
}

/* ── HOME ────────────────────────────────────────── */
function rHome() {
  const tb = D.events.reduce((s, e) => s + e.billing, 0);
  const te = D.expenses.reduce((s, x) => s + x.amt, 0);
  const tr = D.cPays.reduce((s, p) => s + p.amt, 0);

  document.getElementById('kpi').innerHTML = `
    <div class="sc"><div class="lbl">Portfolio – एकूण बिल</div><div class="n-lg" style="margin-top:4px">${fmtCurrency(tb)}</div></div>
    <div class="sc"><div class="lbl cr">Expenses – खर्च</div><div class="n-lg cr" style="margin-top:4px">${fmtCurrency(te)}</div></div>
    <div class="sc"><div class="lbl cg">Received – मिळाले</div><div class="n-lg cg" style="margin-top:4px">${fmtCurrency(tr)}</div></div>
    <div class="sc"><div class="lbl ca">Pending – बाकी</div><div class="n-lg ca" style="margin-top:4px">${fmtCurrency(tb - tr)}</div></div>
    <div class="sc full acc"><div class="lbl">Net Profit – निव्वळ नफा</div><div class="n-lg" style="margin-top:4px">${fmtCurrency(tb - te)}</div></div>
  `;

  // Insights
  const insights = generateInsights(D.events, D.cPays, D.expenses, D.vendors);
  const insightHtml = insights.length
    ? insights.map(i => `<div class="insight-row ${i.type}"><div class="insight-icon">${i.icon}</div><div class="insight-text">${i.text}</div></div>`).join('')
    : '';
  document.getElementById('insights-wrap').innerHTML = insightHtml;
  document.getElementById('insights-wrap').style.display = insights.length ? 'block' : 'none';

  // Overdue
  const od = D.events
    .map(e => ({ ...e, _p: e.billing - calcEventReceived(e.id, D.cPays) }))
    .filter(e => e._p > 0).sort((a, b) => b._p - a._p);

  document.getElementById('od-list').innerHTML = od.map(e => `
    <div class="od-row" data-action="evdetail" data-id="${e.id}">
      <div><div class="n-sm">${e.name}</div><div class="b-sm">${fmtDate(e.date)} · ${e.venue}</div></div>
      <div style="text-align:right"><div class="n-md ca">${fmtCurrency(e._p)}</div><div class="b-sm">pending – बाकी</div></div>
    </div>
  `).join('') || '<div class="empty" style="padding:20px"><div class="empty-ic">🎉</div><div class="empty-tx">All clear – सर्व वसुली झाली!</div></div>';
}

/* ── EVENTS ──────────────────────────────────────── */
function rEvents() {
  const list = [...D.events].sort((a, b) => new Date(b.date) - new Date(a.date));
  if (!list.length) {
    document.getElementById('ev-list').innerHTML = `
      <div class="empty">
        <div class="empty-ic">📅</div>
        <div class="empty-tx">No events – कार्यक्रम नाही</div>
        <button class="empty-cta" onclick="openEvModal()">+ New Event – नवीन कार्यक्रम</button>
      </div>`;
    return;
  }
  document.getElementById('ev-list').innerHTML = list.map(ev => {
    const { received: rec, pending: pend, pctPaid: pct } = calcEventPL(ev, D.cPays, D.expenses);
    let bc = 'b-pending', bl = 'Pending';
    if (pend <= 0) { bc = 'b-paid'; bl = 'Paid'; }
    else if (rec > 0) { bc = 'b-partial'; bl = 'Partial'; }
    return `<div class="ev-card" data-action="evdetail" data-id="${ev.id}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div>
          <div class="n-sm">${ev.name}</div>
          <div class="b-sm" style="margin-top:2px">${fmtDate(ev.date)} · ${ev.venue} · ${ev.type}</div>
        </div>
        <div style="display:flex;align-items:center;gap:6px">
          <span class="badge ${bc}">${bl}</span>
          <button class="del-btn" data-action="delete" data-type="events" data-id="${ev.id}">×</button>
        </div>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-top:12px">
        <div><div class="lbl">Pending – बाकी</div><div class="n-md ca">${fmtCurrency(Math.max(0, pend))}</div></div>
        <div style="text-align:right">
          <div class="b-sm">Billing: ${fmtCurrency(ev.billing)}</div>
          <div style="font-size:11px;font-weight:600;color:var(--green);margin-top:1px">Rcvd: ${fmtCurrency(rec)}</div>
        </div>
      </div>
      <div class="prog"><div class="prog-fill" style="width:${pct}%"></div></div>
    </div>`;
  }).join('');
}

/* ── EVENT DETAIL ────────────────────────────────── */
async function showEvDetail(id) {
  const ev = D.events.find(e => e.id === id); if (!ev) return;
  const pays = [...D.cPays.filter(p => p.evId === id)].sort((a, b) => new Date(b.date) - new Date(a.date));
  const exps = [...D.expenses.filter(x => x.evId === id)].sort((a, b) => new Date(b.date) - new Date(a.date));
  const { received: rec, expTotal: exTot, pending: pend, profit, margin, pctPaid: pct } = calcEventPL(ev, D.cPays, D.expenses);

  // Load photos from IndexedDB
  const photos = await getPhotosForEvent(id);

  const photoHtml = `<div class="photo-strip">
    ${photos.map(p => `<img class="photo-thumb" src="${p.data}" loading="lazy" data-action="lightbox" data-photoid="${p.id}" data-evid="${id}">`).join('')}
    <div class="photo-add" data-action="add-photo" data-id="${id}"><div style="font-size:22px">📷</div><div>Add – जोडा</div></div>
  </div>`;

  document.getElementById('tab-evdetail').innerHTML = `
    <button class="back-btn" data-action="go" data-id="events">← Events – कार्यक्रम</button>
    <div class="d-hdr">
      <div class="d-nm">${ev.name}</div>
      <div class="d-mt">${fmtDate(ev.date)} · ${ev.venue} · ${ev.type}${ev.mobile ? ' · 📞 ' + ev.mobile : ''}</div>
      <div class="d-stats">
        <div><div class="ds-l">Billing – बिल</div><div class="ds-v">${fmtCurrency(ev.billing)}</div></div>
        <div><div class="ds-l">Received – मिळाले</div><div class="ds-v">${fmtCurrency(rec)}</div></div>
        <div><div class="ds-l">Pending – बाकी</div><div class="ds-v">${fmtCurrency(Math.max(0, pend))}</div></div>
      </div>
      <div style="height:5px;background:rgba(255,255,255,.2);border-radius:3px;margin-top:12px;overflow:hidden">
        <div style="height:100%;width:${pct}%;background:#fff;border-radius:3px;transition:width .4s"></div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:16px">
      <div class="card-sm" style="padding:12px;text-align:center">
        <div class="lbl ca">Expenses – खर्च</div>
        <div class="n-md ca" style="margin-top:4px">${fmtCurrency(exTot)}</div>
      </div>
      <div class="card-sm" style="padding:12px;text-align:center">
        <div class="lbl" style="color:${profit >= 0 ? 'var(--green)' : 'var(--red)'}">Profit – नफा</div>
        <div class="n-md" style="margin-top:4px;color:${profit >= 0 ? 'var(--green)' : 'var(--red)'}">${fmtCurrency(profit)}</div>
      </div>
      <div class="card-sm" style="padding:12px;text-align:center">
        <div class="lbl">Margin – मार्जिन</div>
        <div class="n-md" style="margin-top:4px;color:${profit >= 0 ? 'var(--green)' : 'var(--red)'}">${ev.billing > 0 ? margin + '%' : '—'}</div>
      </div>
    </div>

    ${ev.notes ? `<div class="card-sm" style="padding:12px 14px;margin-bottom:16px"><div class="lbl" style="margin-bottom:4px">Notes – नोंदी</div><div style="font-size:13px;line-height:1.5">${ev.notes}</div></div>` : ''}

    <div class="sec">Photos – फोटो</div>
    <div class="card-sm" style="padding:12px 14px;margin-bottom:16px">${photoHtml}</div>

    <div style="display:flex;justify-content:space-between;align-items:center;margin:18px 0 10px">
      <div class="sec" style="margin:0">Client Payments – ग्राहक देयके</div>
      <button style="background:var(--accent);color:#fff;border:none;border-radius:8px;padding:6px 14px;font-size:12px;font-weight:600;cursor:pointer" data-action="open-cpay" data-id="${ev.id}">+ Add – जोडा</button>
    </div>
    <div class="card" style="padding:0 16px;margin-bottom:16px">
      ${pays.map(p => `<div class="pay-row">
        <div>
          <div class="n-sm">${fmtCurrency(p.amt)}</div>
          <div class="b-sm">${fmtDate(p.date)} · ${p.mode || 'Cash'}${p.notes ? ' · ' + p.notes : ''}</div>
        </div>
        <button class="del-btn" data-action="delete" data-type="cPays" data-id="${p.id}" data-refresh="evdetail" data-refresh-id="${ev.id}">×</button>
      </div>`).join('') || '<div style="padding:14px 0;text-align:center" class="b-sm">No payments – देयक नाही</div>'}
    </div>

    <div style="display:flex;justify-content:space-between;align-items:center;margin:18px 0 10px">
      <div class="sec" style="margin:0">Event Expenses – कार्यक्रम खर्च</div>
      <button style="background:var(--red);color:#fff;border:none;border-radius:8px;padding:6px 14px;font-size:12px;font-weight:600;cursor:pointer" data-action="open-exp" data-id="${ev.id}">+ Add – जोडा</button>
    </div>
    <div class="card" style="padding:0 16px;margin-bottom:16px">
      ${exps.map(x => {
        const ven = D.vendors.find(v => v.id === x.venId);
        return `<div class="row-item">
          <div class="row-ico" style="background:rgba(220,38,38,.08)">${CAT_ICONS[x.cat] || '💸'}</div>
          <div class="row-body"><div class="row-nm">${x.head}</div><div class="row-mt">${fmtDate(x.date)}${ven ? ' · ' + ven.name : ''}</div></div>
          <div class="n-sm cr">${fmtCurrency(x.amt)}</div>
        </div>`;
      }).join('') || '<div style="padding:14px 0;text-align:center" class="b-sm">No expenses – खर्च नाही</div>'}
    </div>
    ${exps.length ? `<div class="card-sm" style="padding:12px 16px;display:flex;justify-content:space-between;margin-bottom:12px"><span class="n-sm">Total Expenses – एकूण खर्च</span><span class="n-sm cr">${fmtCurrency(exTot)}</span></div>` : ''}
    <button class="btn btn-ol" data-action="open-ev-edit" data-id="${ev.id}">✏ Edit Event – संपादित करा</button>
  `;

  document.getElementById('tab-evdetail').dataset.evid = id;
  go('evdetail');
}

/* ── EXPENSES ────────────────────────────────────── */
function rExp() {
  const list = [...D.expenses].sort((a, b) => new Date(b.date) - new Date(a.date));
  document.getElementById('exp-ct').textContent  = list.length;
  document.getElementById('exp-tot').textContent = fmtCurrency(list.reduce((s, x) => s + x.amt, 0));
  if (!list.length) {
    document.getElementById('exp-list').innerHTML = `<div class="empty" style="padding:32px 20px"><div class="empty-ic">💸</div><div class="empty-tx">No expenses – खर्च नाही</div></div>`;
    return;
  }
  document.getElementById('exp-list').innerHTML = list.map(x => {
    const ev  = D.events.find(e => e.id === x.evId);
    const ven = D.vendors.find(v => v.id === x.venId);
    return `<div class="row-item">
      <div class="row-ico" style="background:rgba(220,38,38,.08)">${CAT_ICONS[x.cat] || '💸'}</div>
      <div class="row-body">
        <div class="row-nm">${x.head}</div>
        <div class="row-mt">${ev?.name || '—'} · ${fmtDate(x.date)}</div>
        ${ven ? `<div style="font-size:10px;color:var(--blue);font-weight:600;margin-top:1px">${ven.name}</div>` : ''}
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:5px">
        <div class="n-sm cr">${fmtCurrency(x.amt)}</div>
        <button class="del-btn" data-action="delete" data-type="expenses" data-id="${x.id}">×</button>
      </div>
    </div>`;
  }).join('');
}

/* ── VENDORS ─────────────────────────────────────── */
function rVen() {
  if (!D.vendors.length) {
    document.getElementById('ven-list').innerHTML = `<div class="empty"><div class="empty-ic">🤝</div><div class="empty-tx">No vendors – विक्रेते नाही</div><button class="empty-cta" onclick="openVenModal()">+ Add Vendor – विक्रेता जोडा</button></div>`;
    return;
  }
  document.getElementById('ven-list').innerHTML = D.vendors.map(v => {
    const { balance: bal } = calcVendorBalance(v.id, D.expenses, D.vPays);
    return `<div class="ven-card" data-action="vendetail" data-id="${v.id}">
      <div style="flex:1;min-width:0">
        <div class="n-sm">${v.name}</div>
        <div class="b-sm" style="margin-top:2px">${v.cat}${v.specialty ? ' · ' + v.specialty : ''}</div>
        ${v.phone ? `<div style="font-size:11px;color:var(--muted);margin-top:2px">📞 ${v.phone}</div>` : ''}
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:5px;margin-left:12px">
        <div class="n-md" style="color:${bal > 0 ? 'var(--red)' : 'var(--green)'}">${fmtCurrency(bal)}</div>
        <div class="lbl">Balance – शिल्लक</div>
        <button class="del-btn" data-action="delete" data-type="vendors" data-id="${v.id}">×</button>
      </div>
    </div>`;
  }).join('');
}

/* ── VENDOR DETAIL ───────────────────────────────── */
function showVenDetail(id) {
  const vn = D.vendors.find(v => v.id === id); if (!vn) return;
  const exps = D.expenses.filter(x => x.venId === id);
  const pays = D.vPays.filter(p => p.venId === id);
  const { credited: te, paid: tp, balance: bal } = calcVendorBalance(id, D.expenses, D.vPays);

  document.getElementById('tab-vendetail').innerHTML = `
    <button class="back-btn" data-action="go" data-id="vendors">← Vendors – विक्रेते</button>
    <div class="card" style="padding:18px;margin-bottom:16px">
      <div class="n-md" style="margin-bottom:3px">${vn.name}</div>
      <div class="b-sm" style="margin-bottom:14px">${vn.cat}${vn.phone ? ' · 📞 ' + vn.phone : ''}${vn.notes ? ' · ' + vn.notes : ''}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;text-align:center">
        <div><div class="lbl ca">Credit – क्रेडिट</div><div class="n-md ca" style="margin-top:4px">${fmtCurrency(te)}</div></div>
        <div><div class="lbl cg">Paid – दिले</div><div class="n-md cg" style="margin-top:4px">${fmtCurrency(tp)}</div></div>
        <div><div class="lbl">Balance – शिल्लक</div><div class="n-md" style="margin-top:4px;color:${bal > 0 ? 'var(--red)' : 'var(--green)'}">${fmtCurrency(bal)}</div></div>
      </div>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
      <div class="sec" style="margin:0">Vendor Payments – विक्रेता देयके</div>
      <button style="background:var(--accent);color:#fff;border:none;border-radius:8px;padding:6px 14px;font-size:12px;font-weight:600;cursor:pointer" data-action="open-vpay" data-id="${vn.id}">+ Add – जोडा</button>
    </div>
    <div class="card" style="padding:0 16px;margin-bottom:16px">
      ${pays.map(p => {
        const ev = D.events.find(e => e.id === p.evId);
        return `<div class="pay-row">
          <div style="flex:1;min-width:0">
            <div class="n-sm">${fmtCurrency(p.amt)}</div>
            <div class="b-sm">${fmtDate(p.date)} · ${p.mode}${ev ? ' · ' + ev.name : ''}</div>
            ${p.head ? `<div style="font-size:10px;font-weight:600;color:var(--blue);margin-top:1px">${p.cat} → ${p.head}</div>` : ''}
          </div>
          <button class="del-btn" data-action="delete" data-type="vPays" data-id="${p.id}" data-refresh="vendetail" data-refresh-id="${vn.id}">×</button>
        </div>`;
      }).join('') || '<div style="padding:14px 0;text-align:center" class="b-sm">No payments – देयक नाही</div>'}
    </div>
    <div class="sec">Expenses Assigned – नियुक्त खर्च</div>
    <div class="card" style="padding:0 16px;margin-bottom:16px">
      ${exps.map(x => {
        const ev = D.events.find(e => e.id === x.evId);
        return `<div class="row-item">
          <div class="row-ico" style="background:rgba(220,38,38,.08)">${CAT_ICONS[x.cat] || '💸'}</div>
          <div class="row-body"><div class="row-nm">${x.head}</div><div class="row-mt">${fmtDate(x.date)}${ev ? ' · ' + ev.name : ''}</div></div>
          <div class="n-sm cr">${fmtCurrency(x.amt)}</div>
        </div>`;
      }).join('') || '<div style="padding:14px 0;text-align:center" class="b-sm">No expenses – खर्च नाही</div>'}
    </div>
    <button class="btn btn-ol" data-action="open-ven-edit" data-id="${vn.id}">✏ Edit Vendor – संपादित करा</button>
    <button class="btn btn-blue" data-action="open-link" data-id="${vn.id}" style="margin-top:8px">🔗 Link Expenses – खर्च जोडा</button>
  `;

  document.getElementById('tab-vendetail').dataset.vnid = id;
  go('vendetail');
}

/* ── SUMMARY / REPORTS ───────────────────────────── */
function rSummary() {
  const totalBill = D.events.reduce((s, e) => s + e.billing, 0);
  const totalExp  = D.expenses.reduce((s, x) => s + x.amt, 0);
  const profit    = totalBill - totalExp;

  const byCat = {};
  D.expenses.forEach(x => { byCat[x.cat] = (byCat[x.cat] || 0) + x.amt; });
  const maxCat = Math.max(...Object.values(byCat), 1);

  const catBars = Object.entries(byCat).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => `
    <div class="bar-row">
      <div class="bar-label">${cat}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${amt/maxCat*100}%;background:var(--red)"></div></div>
      <div class="bar-val cr">${fmtCurrency(amt)}</div>
    </div>`).join('') || '<div class="b-sm" style="text-align:center;padding:16px">No data – माहिती नाही</div>';

  const evPL = D.events.map(ev => ({ ev, ...calcEventPL(ev, D.cPays, D.expenses) })).sort((a, b) => b.profit - a.profit);

  const plRows = evPL.map(r => `
    <div class="bar-row" style="align-items:center;gap:10px;margin-bottom:12px;cursor:pointer" data-action="evdetail" data-id="${r.ev.id}">
      <div style="width:110px;flex-shrink:0">
        <div style="font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${r.ev.name}</div>
        <div class="b-sm">${fmtDate(r.ev.date)}</div>
      </div>
      <div style="flex:1"><div class="bar-track"><div class="bar-fill" style="width:${r.pctPaid}%;background:${r.profit >= 0 ? 'var(--green)' : 'var(--red)'}"></div></div></div>
      <div style="width:72px;text-align:right;flex-shrink:0;font-size:12px;font-weight:700;color:${r.profit >= 0 ? 'var(--green)' : 'var(--red)'}">${fmtCurrency(r.profit)}</div>
    </div>`).join('') || '<div class="b-sm" style="text-align:center;padding:16px">No events – कार्यक्रम नाही</div>';

  const byMode = {};
  D.cPays.forEach(p => { byMode[p.mode] = (byMode[p.mode] || 0) + p.amt; });
  const modeColors = { Cash:'#D97706', UPI:'#2563EB', NEFT:'#16A34A', Cheque:'#EA580C', Bank:'#7c3aed' };
  const modeRows = Object.entries(byMode).sort((a, b) => b[1] - a[1]).map(([m, a]) => `
    <div class="bar-row">
      <div class="bar-label">${m}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${a/Math.max(...Object.values(byMode),1)*100}%;background:${modeColors[m]||'var(--blue)'}"></div></div>
      <div class="bar-val cg">${fmtCurrency(a)}</div>
    </div>`).join('') || '<div class="b-sm" style="text-align:center;padding:16px">No data – माहिती नाही</div>';

  document.getElementById('summary-content').innerHTML = `
    <div class="stat-grid" style="margin-bottom:16px">
      <div class="sc"><div class="lbl">Events – कार्यक्रम</div><div class="n-lg" style="margin-top:4px">${D.events.length}</div></div>
      <div class="sc"><div class="lbl cg">Net Profit – निव्वळ नफा</div><div class="n-lg cg" style="margin-top:4px">${fmtCurrency(profit)}</div></div>
      <div class="sc"><div class="lbl">Margin – मार्जिन</div><div class="n-lg" style="margin-top:4px;color:${totalBill > 0 ? (profit >= 0 ? 'var(--green)' : 'var(--red)') : 'var(--muted)'}">
        ${totalBill > 0 ? Math.round(profit/totalBill*100) + '%' : '—'}</div></div>
      <div class="sc"><div class="lbl">Vendors – विक्रेते</div><div class="n-lg" style="margin-top:4px">${D.vendors.length}</div></div>
    </div>
    <div class="chart-card">
      <div class="chart-title">📅 Profit/Loss Per Event – नफा/तोटा</div>${plRows}
    </div>
    <div class="chart-card">
      <div class="chart-title">💸 Expenses by Category – खर्चाचा प्रकार</div>${catBars}
    </div>
    <div class="chart-card">
      <div class="chart-title">💳 Collections by Mode – पद्धतीनुसार वसुली</div>${modeRows}
    </div>
    <div class="chart-card">
      <div class="chart-title">🏆 Event Leaderboard – बिलनुसार यादी</div>
      ${[...D.events].sort((a,b)=>b.billing-a.billing).map((e,i)=>`
        <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--border);cursor:pointer" data-action="evdetail" data-id="${e.id}">
          <div style="display:flex;align-items:center;gap:10px">
            <div style="width:24px;height:24px;border-radius:6px;background:${i===0?'var(--amber)':i===1?'var(--muted)':i===2?'var(--accent)':'var(--card2)'};display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:${i<3?'#fff':'var(--muted)'}">${i+1}</div>
            <div><div style="font-size:13px;font-weight:600">${e.name}</div><div class="b-sm">${fmtDate(e.date)} · ${e.venue}</div></div>
          </div>
          <div class="n-md co">${fmtCurrency(e.billing)}</div>
        </div>`).join('') || '<div class="b-sm" style="text-align:center;padding:16px">No events</div>'}
    </div>
  `;
}

/* ── MODAL HELPERS ───────────────────────────────── */
function q(id)  { return document.getElementById(id); }
function qv(id) { return q(id).value.trim(); }
function qf(id) { return parseFloat(q(id).value); }

function closeModals() {
  document.querySelectorAll('.modal-ov').forEach(m => m.classList.remove('active'));
}

function populateSelect(id, options, selected = '') {
  q(id).innerHTML = options.map(o =>
    typeof o === 'string'
      ? `<option value="${o}"${o===selected?' selected':''}>${o}</option>`
      : `<option value="${o.v}"${o.v===selected?' selected':''}>${o.l}</option>`
  ).join('');
}

function showFieldErrors(errors) {
  // Clear previous
  document.querySelectorAll('.field-error').forEach(el => el.remove());
  document.querySelectorAll('.error').forEach(el => el.classList.remove('error'));

  for (const [field, msg] of Object.entries(errors)) {
    const inp = document.getElementById(field) || document.querySelector(`[name="${field}"]`);
    if (!inp) continue;
    inp.classList.add('error');
    const err = document.createElement('div');
    err.className = 'field-error'; err.textContent = msg;
    inp.parentNode.appendChild(err);
  }
  // Scroll to first error
  const first = document.querySelector('.field-error');
  if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/* ── EVENT MODAL ─────────────────────────────────── */
function openEvModal(id) {
  const ev = id ? D.events.find(e => e.id === id) : null;
  q('ev-id').value = ev?.id || '';
  q('ev-name').value    = ev?.name    || '';
  q('ev-date').value    = ev?.date    || '';
  q('ev-venue').value   = ev?.venue   || '';
  q('ev-billing').value = ev?.billing || '';
  q('ev-mobile').value  = ev?.mobile  || '';
  q('ev-notes').value   = ev?.notes   || '';
  populateSelect('ev-type', EVENT_TYPES, ev?.type || '');
  q('ev-mtitle').textContent = ev ? 'Edit Event – संपादित करा' : 'New Event – नवीन कार्यक्रम';
  document.querySelectorAll('.field-error').forEach(el => el.remove());
  q('ev-modal').classList.add('active');
}

async function saveEvent() {
  const data = {
    name:    qv('ev-name'),
    date:    qv('ev-date'),
    venue:   qv('ev-venue'),
    billing: qf('ev-billing'),
    mobile:  qv('ev-mobile')
  };
  const { valid, errors } = validate(EVENT_RULES, data);
  if (!valid) { showFieldErrors(errors); return; }

  const id = qv('ev-id');
  const record = {
    id:       id || uid('EV'),
    name:     data.name,
    date:     data.date,
    type:     qv('ev-type'),
    venue:    data.venue,
    billing:  data.billing,
    mobile:   data.mobile,
    notes:    qv('ev-notes'),
    photoIds: id ? (D.events.find(e => e.id === id)?.photoIds || []) : [],
    _v: 2
  };

  await putOne('events', record);
  if (id) D.events = D.events.map(e => e.id === id ? record : e);
  else    D.events.push(record);

  closeModals();
  showToast('Event saved – कार्यक्रम जतन झाला', 'success');
  renderPage(CT);
}

/* ── EXPENSE MODAL ───────────────────────────────── */
function openExpModal(fixEvId) {
  const ex = (fixEvId && typeof fixEvId === 'object') ? fixEvId : null;
  const preEvId = (typeof fixEvId === 'string') ? fixEvId : null;
  q('exp-id').value = ex?.id || '';

  populateSelect('exp-ev', D.events.map(e => ({ v: e.id, l: `${e.name} – ${fmtDate(e.date)}` })), ex?.evId || preEvId || '');
  populateSelect('exp-cat', Object.keys(EXPENSE_HEADS), ex?.cat || '');
  loadExpHeads(ex?.head);
  q('exp-amt').value   = ex?.amt   || '';
  q('exp-date').value  = ex?.date  || today();
  populateSelect('exp-mode', PAY_MODES, ex?.mode || '');
  populateSelect('exp-vendor', [{ v: '', l: 'None – कोणी नाही' }, ...D.vendors.map(v => ({ v: v.id, l: v.name }))], ex?.venId || '');
  q('exp-notes').value = ex?.notes || '';
  q('exp-mtitle').textContent = ex ? 'Edit Expense – संपादित करा' : 'Record Expense – खर्च नोंदवा';
  document.querySelectorAll('.field-error').forEach(el => el.remove());
  q('exp-modal').classList.add('active');
}

function loadExpHeads(selected = '') {
  const cat = qv('exp-cat');
  populateSelect('exp-head', EXPENSE_HEADS[cat] || [], selected);
}

async function saveExpense() {
  const data = {
    evId: qv('exp-ev'),
    amt:  qf('exp-amt'),
    date: qv('exp-date')
  };
  const { valid, errors } = validate(EXPENSE_RULES, data);
  if (!valid) { showFieldErrors(errors); return; }

  const id = qv('exp-id');
  const record = {
    id:    id || uid('EX'),
    evId:  data.evId,
    cat:   qv('exp-cat'),
    head:  qv('exp-head'),
    amt:   data.amt,
    date:  data.date,
    mode:  qv('exp-mode'),
    venId: qv('exp-vendor'),
    notes: qv('exp-notes')
  };

  await putOne('expenses', record);
  if (id) D.expenses = D.expenses.map(x => x.id === id ? record : x);
  else    D.expenses.push(record);

  closeModals();
  showToast('Expense recorded – खर्च नोंदवला', 'success');
  if (CT === 'evdetail') { showEvDetail(q('tab-evdetail').dataset.evid); return; }
  renderPage(CT);
}

/* ── CLIENT PAYMENT MODAL ────────────────────────── */
function openCPayModal(evId) {
  q('cpay-evid').value = evId;
  q('cpay-id').value   = '';
  q('cpay-amt').value  = '';
  q('cpay-date').value = today();
  q('cpay-notes').value = '';
  populateSelect('cpay-mode', PAY_MODES);
  document.querySelectorAll('.field-error').forEach(el => el.remove());
  q('cpay-modal').classList.add('active');
}

async function saveCPay() {
  const evId = qv('cpay-evid');
  const data = { evId, amt: qf('cpay-amt'), date: qv('cpay-date') };
  const { valid, errors } = validate(PAYMENT_RULES, data);
  if (!valid) { showFieldErrors(errors); return; }

  const id = qv('cpay-id');
  const record = { id: id || uid('CP'), evId, amt: data.amt, date: data.date, mode: qv('cpay-mode'), notes: qv('cpay-notes') };

  await putOne('cPays', record);
  if (id) D.cPays = D.cPays.map(p => p.id === id ? record : p);
  else    D.cPays.push(record);

  closeModals();
  showToast('Payment added – देयक जोडले', 'success');
  if (CT === 'evdetail') { showEvDetail(q('tab-evdetail').dataset.evid); return; }
  renderPage(CT);
}

/* ── VENDOR MODAL ────────────────────────────────── */
function openVenModal(id) {
  const vn = id ? D.vendors.find(v => v.id === id) : null;
  q('ven-id').value    = vn?.id       || '';
  q('ven-name').value  = vn?.name     || '';
  q('ven-phone').value = vn?.phone    || '';
  q('ven-notes').value = vn?.notes    || '';
  populateSelect('ven-cat', Object.keys(EXPENSE_HEADS), vn?.cat || '');
  loadVenSpecialty(vn?.specialty);
  q('ven-mtitle').textContent = vn ? 'Edit Vendor – संपादित करा' : 'New Vendor – नवीन विक्रेता';
  document.querySelectorAll('.field-error').forEach(el => el.remove());
  q('ven-modal').classList.add('active');
}

function loadVenSpecialty(selected = '') {
  const cat = qv('ven-cat');
  populateSelect('ven-specialty', EXPENSE_HEADS[cat] || [], selected);
}

async function saveVendor() {
  const data = { name: qv('ven-name'), phone: qv('ven-phone') };
  const { valid, errors } = validate(VENDOR_RULES, data);
  if (!valid) { showFieldErrors(errors); return; }

  const id = qv('ven-id');
  const record = { id: id || uid('VN'), name: data.name, cat: qv('ven-cat'), specialty: qv('ven-specialty'), phone: data.phone, notes: qv('ven-notes') };

  await putOne('vendors', record);
  if (id) D.vendors = D.vendors.map(v => v.id === id ? record : v);
  else    D.vendors.push(record);

  closeModals();
  showToast('Vendor saved – विक्रेता जतन झाला', 'success');
  renderPage(CT);
}

/* ── VENDOR PAYMENT MODAL ────────────────────────── */
function openVPayModal(venId) {
  const vn = D.vendors.find(v => v.id === venId);
  q('vpay-venid').value = venId;
  q('vpay-id').value    = '';
  q('vpay-amt').value   = '';
  q('vpay-date').value  = today();
  q('vpay-notes').value = '';
  populateSelect('vpay-ev', [{ v: '', l: '— No event – कार्यक्रम नाही —' }, ...D.events.map(e => ({ v: e.id, l: `${e.name} – ${fmtDate(e.date)}` }))]);
  populateSelect('vpay-cat', Object.keys(EXPENSE_HEADS), vn?.cat || '');
  loadVPayHead(vn?.specialty);
  populateSelect('vpay-mode', PAY_MODES);
  document.querySelectorAll('.field-error').forEach(el => el.remove());
  q('vpay-modal').classList.add('active');
}

function loadVPayHead(selected = '') {
  const cat = qv('vpay-cat');
  populateSelect('vpay-head', EXPENSE_HEADS[cat] || [], selected);
}

async function saveVPay() {
  const venId = qv('vpay-venid');
  const data = { venId, amt: qf('vpay-amt'), date: qv('vpay-date') };
  const { valid, errors } = validate(VPAY_RULES, data);
  if (!valid) { showFieldErrors(errors); return; }

  const id = qv('vpay-id');
  const record = { id: id || uid('VP'), venId, evId: qv('vpay-ev'), cat: qv('vpay-cat'), head: qv('vpay-head'), amt: data.amt, date: data.date, mode: qv('vpay-mode'), notes: qv('vpay-notes') };

  await putOne('vPays', record);
  if (id) D.vPays = D.vPays.map(p => p.id === id ? record : p);
  else    D.vPays.push(record);

  closeModals();
  showToast('Vendor payment saved – विक्रेता देयक जतन', 'success');
  if (CT === 'vendetail') { showVenDetail(q('tab-vendetail').dataset.vnid); return; }
  renderPage(CT);
}

/* ── DELETE ──────────────────────────────────────── */
async function deleteRow(type, id, refresh, refreshId) {
  if (!confirm('Delete? – हटवायचे का?\nThis cannot be undone.')) return;

  await deleteOne(type, id);
  D[type] = D[type].filter(x => x.id !== id);

  showToast('Deleted – हटवले');
  if (refresh === 'evdetail' && refreshId) { showEvDetail(refreshId); return; }
  if (refresh === 'vendetail' && refreshId) { showVenDetail(refreshId); return; }
  renderPage(CT);
}

/* ── PHOTOS ──────────────────────────────────────── */
function triggerPhoto(evId) {
  pendingPhotoEvId = evId;
  document.getElementById('photo-input').click();
}

async function handlePhotoInput(files) {
  if (!files.length || !pendingPhotoEvId) return;
  const ev = D.events.find(e => e.id === pendingPhotoEvId); if (!ev) return;

  showLoading(true);
  try {
    for (const file of Array.from(files)) {
      const dataUrl = await readFileAsDataUrl(file);
      const photoId = await savePhoto(pendingPhotoEvId, dataUrl);
      if (!ev.photoIds) ev.photoIds = [];
      ev.photoIds.push(photoId);
    }
    await putOne('events', ev);
    showToast('Photo added – फोटो जोडला', 'success');
    showEvDetail(pendingPhotoEvId);
  } finally {
    showLoading(false);
    document.getElementById('photo-input').value = '';
  }
}

function readFileAsDataUrl(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload  = e => res(e.target.result);
    r.onerror = () => rej(new Error('Read failed'));
    r.readAsDataURL(file);
  });
}

function openLightbox(evId, photoId) {
  const photos = document.querySelectorAll(`[data-action="lightbox"][data-evid="${evId}"]`);
  const ids    = Array.from(photos).map(p => p.dataset.photoid);
  const idx    = ids.indexOf(photoId);
  lightboxState = { evId, photoIds: ids, idx: Math.max(0, idx) };
  const src = photos[lightboxState.idx]?.src;
  if (!src) return;
  q('lb-img').src = src;
  q('lightbox').style.display = 'flex';
}

async function deleteCurrentPhoto() {
  const { evId, photoIds, idx } = lightboxState;
  const photoId = photoIds[idx];
  if (!confirm('Delete photo? – फोटो हटवायचा का?')) return;
  await deletePhoto(photoId);
  const ev = D.events.find(e => e.id === evId);
  if (ev) { ev.photoIds = (ev.photoIds || []).filter(id => id !== photoId); await putOne('events', ev); }
  q('lightbox').style.display = 'none';
  showToast('Photo deleted – फोटो हटवला');
  showEvDetail(evId);
}

/* ── LINK EXPENSES TO VENDOR ─────────────────────── */
function openLinkModal(venId) {
  const vn = D.vendors.find(v => v.id === venId); if (!vn) return;
  const unlinked = D.expenses.filter(x => !x.venId);
  if (!unlinked.length) { showToast('No unlinked expenses – न जोडलेले खर्च नाही'); return; }

  q('link-ven-id').value = venId;
  q('link-exp-list').innerHTML = unlinked.map(x => {
    const ev      = D.events.find(e => e.id === x.evId);
    const sameSpec = vn.specialty && x.head === vn.specialty;
    const sameCat  = x.cat === vn.cat;
    return `<label style="display:flex;align-items:flex-start;gap:10px;padding:10px 0;border-bottom:1px solid var(--border);cursor:pointer">
      <input type="checkbox" value="${x.id}" ${sameSpec ? 'checked' : ''} style="width:18px;height:18px;margin-top:2px;accent-color:var(--accent);flex-shrink:0">
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:600">${x.head}</div>
        <div class="b-sm" style="margin-top:1px">${ev?.name || '—'} · ${fmtDate(x.date)} · ${fmtCurrency(x.amt)}</div>
        <div style="font-size:10px;margin-top:2px">
          <span style="background:${sameCat?'rgba(234,88,12,.12)':'rgba(148,163,184,.1)'};color:${sameCat?'var(--accent)':'var(--muted)'};padding:1px 7px;border-radius:10px;font-weight:600">${x.cat}</span>
          ${sameSpec ? '<span style="margin-left:4px;color:var(--green);font-weight:600">✓ matches – जुळते</span>' : ''}
        </div>
      </div>
    </label>`;
  }).join('');
  q('link-modal').classList.add('active');
}

async function saveLinkExpenses() {
  const venId   = qv('link-ven-id');
  const checked = [...document.querySelectorAll('#link-exp-list input[type=checkbox]:checked')].map(cb => cb.value);
  if (!checked.length) { showToast('Select expense – खर्च निवडा', 'error'); return; }

  for (const id of checked) {
    const x = D.expenses.find(e => e.id === id);
    if (x) { x.venId = venId; await putOne('expenses', x); }
  }
  closeModals();
  showToast(`${checked.length} expense${checked.length > 1 ? 's' : ''} linked – जोडले ✓`, 'success');
  showVenDetail(q('tab-vendetail').dataset.vnid);
}

/* ── EXPORT / IMPORT ─────────────────────────────── */
async function exportData() {
  showLoading(true);
  try {
    const payload = await exportAllData();
    const json    = JSON.stringify(payload, null, 2);
    const blob    = new Blob([json], { type: 'application/json' });
    const url     = URL.createObjectURL(blob);
    const a       = document.createElement('a');
    a.href        = url;
    a.download    = `flavor-fusion-backup-${today()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Exported – निर्यात झाली ✓', 'success');
  } finally { showLoading(false); }
}

async function handleImport(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async e => {
    try {
      const payload = JSON.parse(e.target.result);

      // Validation
      if (!payload.version || !['ffv5', 'ffv2'].includes(payload.version)) {
        showToast('Invalid backup file – चुकीची फाईल', 'error'); return;
      }
      const counts = `• ${(payload.events||[]).length} events\n• ${(payload.expenses||[]).length} expenses\n• ${(payload.cPays||[]).length} payments\n• ${(payload.vendors||[]).length} vendors`;
      const mode = confirm(`Replace OR Merge?\n\nOK = Replace all data\nCancel = Merge (keep existing)\n\n${counts}`) ? 'replace' : 'merge';

      showLoading(true);
      await importAllData(payload, mode);
      await loadAll();
      go('home');
      showToast('Imported – आयात झाली ✓', 'success');
    } catch (err) {
      showToast('Import failed – आयात अयशस्वी', 'error');
      console.error(err);
    } finally {
      showLoading(false);
      document.getElementById('import-input').value = '';
    }
  };
  reader.readAsText(file);
}

/* ── DRAWER ──────────────────────────────────────── */
function toggleDrawer() { document.getElementById('drawer').classList.toggle('active'); }

/* ── EVENT DELEGATION ────────────────────────────── */
function bindAllEvents() {
  // Delegated click handler for the entire body
  document.body.addEventListener('click', async e => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    e.stopPropagation();
    const action    = el.dataset.action;
    const id        = el.dataset.id;
    const type      = el.dataset.type;
    const refresh   = el.dataset.refresh;
    const refreshId = el.dataset.refreshId;

    switch (action) {
      case 'go':          go(id); break;
      case 'evdetail':    showEvDetail(id); break;
      case 'vendetail':   showVenDetail(id); break;
      case 'open-cpay':   openCPayModal(id); break;
      case 'open-exp':    openExpModal(id); break;
      case 'open-ev-edit':openEvModal(id); break;
      case 'open-ven-edit':openVenModal(id); break;
      case 'open-vpay':   openVPayModal(id); break;
      case 'open-link':   openLinkModal(id); break;
      case 'add-photo':   triggerPhoto(id); break;
      case 'lightbox':    openLightbox(el.dataset.evid, el.dataset.photoid); break;
      case 'delete':      await deleteRow(type, id, refresh, refreshId); break;
    }
  });

  // Close modals on backdrop click
  document.querySelectorAll('.modal-ov').forEach(o => {
    o.addEventListener('click', e => { if (e.target === o) closeModals(); });
  });

  // Photo input
  q('photo-input').addEventListener('change', function () {
    handlePhotoInput(this.files);
  });

  // Import input
  q('import-input').addEventListener('change', function () {
    handleImport(this.files[0]);
  });

  // Form submit buttons (avoid inline onclick)
  q('btn-save-event').addEventListener('click', saveEvent);
  q('btn-save-exp').addEventListener('click', saveExpense);
  q('btn-save-cpay').addEventListener('click', saveCPay);
  q('btn-save-ven').addEventListener('click', saveVendor);
  q('btn-save-vpay').addEventListener('click', saveVPay);
  q('btn-save-link').addEventListener('click', saveLinkExpenses);

  // Theme / drawer / fab
  q('theme-btn').addEventListener('click', toggleTheme);
  q('drawer-toggle').addEventListener('click', toggleDrawer);
  q('fab').addEventListener('click', fabAction);

  // Nav items
  ['home','events','expenses','vendors','summary'].forEach(id => {
    q('n-' + id)?.addEventListener('click', () => go(id));
    q('d-' + id)?.addEventListener('click', () => { go(id); toggleDrawer(); });
  });

  // Expense category change
  q('exp-cat').addEventListener('change', () => loadExpHeads());
  q('ven-cat').addEventListener('change', () => loadVenSpecialty());
  q('vpay-cat').addEventListener('change', () => loadVPayHead());

  // Export / Import buttons
  q('btn-export').addEventListener('click', () => { exportData(); toggleDrawer(); });
  q('btn-import').addEventListener('click', () => { q('import-input').click(); toggleDrawer(); });
  q('btn-set-pin').addEventListener('click', () => { toggleDrawer(); showPinScreen('set'); });
  q('btn-remove-pin').addEventListener('click', () => { toggleDrawer(); removePin(); });

  // Lightbox
  q('lb-delete').addEventListener('click', deleteCurrentPhoto);
  q('lightbox').addEventListener('click', e => { if (e.target === q('lightbox')) q('lightbox').style.display = 'none'; });

  // PIN pad
  document.querySelectorAll('.pin-key').forEach(key => {
    key.addEventListener('click', () => pinKey(key.dataset.val));
  });
  q('pin-alt').addEventListener('click', async () => {
    const confirmed = confirm('Bypass PIN? Export your data first!\nPIN बायपास करायचे का?');
    if (confirmed) { q('pin-screen').classList.remove('active'); launchApp(); }
  });
}

/* ── EXPOSE to HTML for PWA install prompt (optional) ── */
window.FF = { exportData, toggleDrawer };

boot();
