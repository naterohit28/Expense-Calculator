// Meal-by-meal menus (services): built from the older event fields without changing them, saved only for events
// edited meal by meal, kept in step when this app edits the older fields, rebuilt when an older app version did.
// Synthetic data only.
const BASE_URL = process.env.TEST_BASE_URL; if (!BASE_URL || !/^http:\/\/127\.0\.0\.1:\d+$/.test(BASE_URL)) throw new Error('Use npm test to run against the isolated local test server.');
const { chromium, devices } = require('playwright');
const assert = require('node:assert/strict');

const day = n => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };   // local date, as the app uses
const LEGACY = { id: 'e1', name: 'Sample Two Meal Wedding', date: day(9), venue: 'Sample Lawns', type: 'Wedding – लग्न', billing: 300000, guests: 300, meals: ['lunch', 'dinner'], photoIds: [],
  mealPlan: { lunch: { guests: 250, rate: 450, menu: 'golden' }, dinner: { guests: 300, rate: 650 } },
  dishes: [{ name: 'Jeera Rice', head: '', meal: 'lunch' }, { name: 'Pani Puri', head: 'Chaat – चाट', meal: 'lunch' }, { name: 'Jeera Rice', head: '', meal: 'dinner' }, { name: 'Mineral Water', head: '' }] };
const DATA = { version: 'ffv2', photos: [], cPays: [], vPays: [], expenses: [], vendors: [],
  events: [structuredClone(LEGACY), { id: 'e2', name: 'Sample Plain Party', date: day(12), venue: 'Sample Hall', type: 'Party – पार्टी', billing: 50000, guests: 80, photoIds: [], dishes: [{ name: 'Veg Pulao', head: '' }] }] };

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const ctx = await browser.newContext({ ...devices['Pixel 5'], viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage(); p.setDefaultTimeout(10000);
  const errors = []; p.on('pageerror', e => errors.push(e.message));
  let failed = 0;
  const test = async (name, fn) => { try { await fn(); console.log(name + ' PASS'); } catch (e) { failed++; console.error(e); console.log(name + ' FAIL'); } };
  const dump = () => p.evaluate(async () => (await import('./db.js')).exportAllData());
  const ev = async id => (await dump()).events.find(e => e.id === id);
  const fresh = async () => { await p.reload(); await p.waitForSelector('#kpi .card'); };
  const openEvent = async name => { await fresh(); await p.locator('#n-events:visible').click(); await p.locator('#ev-list [data-action="evdetail"]:visible', { hasText: name }).first().click(); await p.waitForSelector('#tab-evdetail .detail-name'); await p.waitForTimeout(200); };
  const U = (fn, arg) => p.evaluate(async ([src, a]) => { const u = await import('./utils.js'); return new Function('u', 'a', `return (${src})(u, a)`)(u, a); }, [fn.toString(), arg]);
  await p.goto(BASE_URL); await p.waitForSelector('#kpi .card');
  await p.evaluate(async d => { const db = await import('./db.js'); await db.importAllData(d); }, DATA);
  await fresh();

  await test('services are built from an older event without changing it: own dishes per meal, the same dish at two meals, shared dishes, meal prices and menu', async () => {
    const r = await U((u, e) => ({ out: u.eventServices(e), before: JSON.stringify(e) }), LEGACY);
    assert.equal(r.out.stale, false);
    const [lunch, dinner] = r.out.services;
    assert.deepEqual([lunch.meal, lunch.guests, lunch.rate, lunch.template?.id], ['lunch', 250, 450, 'golden']);
    assert.deepEqual([dinner.meal, dinner.guests, dinner.rate, dinner.template], ['dinner', 300, 650, null]);
    assert.deepEqual(lunch.dishes.map(d => [d.name, d.head, !!d.shared]), [['Jeera Rice', '', false], ['Pani Puri', 'Chaat – चाट', false], ['Mineral Water', '', true]]);
    assert.deepEqual(dinner.dishes.map(d => d.name), ['Jeera Rice', 'Mineral Water'], 'Jeera Rice served at both meals');
    assert.equal(r.before, JSON.stringify(LEGACY), 'input untouched');
    const plain = await U((u, e) => u.eventServices(e).services, DATA.events[1]);
    assert.deepEqual(plain.map(s => [s.meal, s.dishes.map(d => d.name)]), [['', ['Veg Pulao']]], 'an event without meals is one service');
  });

  await test('a library menu chosen for a meal with no dishes typed shows its dishes, marked unconfirmed, and they are never saved as dishes', async () => {
    const r = await U((u, e) => { const x = { ...e, dishes: [] }; const s = u.eventServices(x).services; return { s, saved: u.applyServices(x, s) }; }, LEGACY);
    assert.equal(r.s[0].fromTemplate, true); assert.ok(r.s[0].dishes.length > 3, 'Golden menu dishes listed for lunch');
    assert.equal(r.s[1].fromTemplate, undefined); assert.deepEqual(r.s[1].dishes, []);
    assert.deepEqual(r.saved.dishes, [], 'nothing invented in the dish list');
    assert.deepEqual(r.saved.services[0].dishes, []); assert.equal(r.saved.services[0].fromTemplate, undefined);
  });

  await test('saved services write the older fields back exactly; dish details, times and a different date are kept', async () => {
    const r = await U((u, e) => {
      const s = u.eventServices(e).services;
      s[0].time = '12:30'; s[1].time = '20:00'; s[1].date = '2099-01-02';
      s[0].dishes[0] = { ...s[0].dishes[0], id: 'd1', cat: 'rice', diet: ['veg', 'jain'] };
      const saved = u.applyServices(e, s), rec = { ...e, ...saved };
      return { saved, view: u.eventServices(rec) };
    }, LEGACY);
    assert.deepEqual(r.saved.meals, LEGACY.meals); assert.deepEqual(r.saved.mealPlan, LEGACY.mealPlan); assert.equal(r.saved.menu, 'golden');
    assert.deepEqual(r.saved.dishes.map(d => [d.name, d.meal || '']), [['Jeera Rice', 'lunch'], ['Pani Puri', 'lunch'], ['Mineral Water', ''], ['Jeera Rice', 'dinner']]);
    assert.equal(r.view.stale, false); assert.deepEqual(r.view.services, r.saved.services, 'read back as saved');
    assert.deepEqual(r.view.services[0].dishes[0], { name: 'Jeera Rice', head: '', id: 'd1', cat: 'rice', diet: ['veg', 'jain'] });
    assert.deepEqual([r.view.services[0].time, r.view.services[1].time, r.view.services[1].date, r.view.services[0].date], ['12:30', '20:00', '2099-01-02', undefined]);
  });

  await test('an older app version changes the dishes: services are rebuilt from them, details kept for dishes still there, marked as changed', async () => {
    const r = await U((u, e) => {
      const s = u.eventServices(e).services; s[0].dishes[0].cat = 'rice'; s[0].dishes[1].cat = 'other'; s[0].time = '12:30';
      const rec = { ...e, ...u.applyServices(e, s) };
      // what an older version does: edits the dish list, keeps the unknown fields as they were
      const old = { ...rec, dishes: [...rec.dishes.filter(d => d.name !== 'Pani Puri'), { name: 'Gulab Jamun', head: '', meal: 'dinner' }] };
      return u.eventServices(old);
    }, LEGACY);
    assert.equal(r.stale, true);
    assert.deepEqual(r.services[0].dishes.map(d => [d.name, d.cat]), [['Jeera Rice', 'rice'], ['Mineral Water', undefined]]);
    assert.deepEqual(r.services[1].dishes.map(d => d.name), ['Jeera Rice', 'Gulab Jamun', 'Mineral Water']);
    assert.equal(r.services[0].time, '12:30', 'meal time kept');
  });

  await test('editing the menu in this app keeps saved services in step, without reordering dishes or adding a menu version', async () => {
    // Give e1 saved services with a dish category
    await p.evaluate(async () => { const db = await import('./db.js'), u = await import('./utils.js');
      const d = await db.exportAllData(); delete d.manifest; const e = d.events.find(x => x.id === 'e1');
      const s = u.eventServices(e).services; s[0].dishes[0].cat = 'rice'; s[1].time = '20:00';
      Object.assign(e, u.applyServices(e, s)); delete e._rev; await db.importAllData(d, 'replace'); });
    const start = await ev('e1');
    // Reopen and save unchanged: nothing changes
    await openEvent('Sample Two Meal Wedding'); await p.locator('[data-action="menu-edit"]').first().click(); await p.waitForSelector('#menu-modal.active');
    await p.locator('#btn-save-menu').click(); await p.waitForTimeout(500);
    const same = await ev('e1'); delete same._rev; delete start._rev;
    assert.deepEqual(same, start, 'unchanged menu saved: record identical');
    // Add a dinner dish through the sheet
    await openEvent('Sample Two Meal Wedding'); await p.locator('[data-action="menu-edit"]').first().click(); await p.waitForSelector('#menu-modal.active');
    await p.fill('#menu-text', (await p.inputValue('#menu-text')) + '\nGulab Jamun');
    await p.waitForTimeout(500); await p.locator('#btn-save-menu').click(); await p.waitForTimeout(500);
    const e = await ev('e1');
    const view = await U((u, x) => u.eventServices(x), e);
    assert.equal(view.stale, false, 'saved in this app: not marked as changed elsewhere');
    assert.deepEqual(view.services[1].dishes.map(d => d.name), ['Jeera Rice', 'Gulab Jamun', 'Mineral Water']);
    assert.equal(view.services[0].dishes[0].cat, 'rice', 'category kept'); assert.equal(view.services[1].time, '20:00', 'time kept');
    assert.equal(e.menuVersions.length, 1, 'one version: the real change');
  });

  await test('the event form keeps saved services in step; an event without them gets no new fields', async () => {
    await openEvent('Sample Two Meal Wedding'); await p.locator('#hdr-edit').click(); await p.waitForSelector('#ev-modal.active');
    if (await p.locator('#ev-mp').getAttribute('open') === null) await p.locator('#ev-mp summary').click();
    await p.fill('#ev-mp-dinner-g', '320');
    await p.locator('#btn-save-event').click(); await p.waitForTimeout(500);
    if (await p.locator('#ask-modal.active').count()) await p.locator('#ask-actions button').last().click();
    const e = await ev('e1');
    assert.equal(e.mealPlan.dinner.guests, 320);
    const view = await U((u, x) => u.eventServices(x), e);
    assert.equal(view.stale, false); assert.equal(view.services[1].guests, 320); assert.equal(view.services[1].time, '20:00');
    const before = await ev('e2');
    await openEvent('Sample Plain Party'); await p.locator('#hdr-edit').click(); await p.waitForSelector('#ev-modal.active');
    await p.locator('#btn-save-event').click(); await p.waitForTimeout(500);
    const after = await ev('e2'); delete before._rev; delete after._rev;
    assert.deepEqual(after, before, 'no services or other field added');
  });

  await test('backups keep saved services; malformed meal menus are refused', async () => {
    const r = await p.evaluate(async () => { const db = await import('./db.js'); const out = [];
      const d0 = await db.exportAllData(); delete d0.manifest;
      await db.importAllData(structuredClone(d0), 'replace');
      out.push(JSON.stringify((await db.exportAllData()).events.find(e => e.id === 'e1').services) === JSON.stringify(d0.events.find(e => e.id === 'e1').services) ? 'kept' : 'lost');
      const svc = d0.events.find(e => e.id === 'e1').services;
      for (const bad of [{ services: 'x' }, { services: [{ ...svc[0], meal: 'supper' }] }, { services: [svc[0], svc[0]] }, { services: [{ ...svc[0], guests: -1 }] },
        { services: [{ ...svc[0], rate: 1.234 }] }, { services: [{ ...svc[0], dishes: [{ name: 'x', cat: 'snack' }] }] }, { services: [{ ...svc[0], dishes: [{ name: 'x', diet: ['vegan'] }] }] },
        { services: [{ ...svc[0], date: '2026-13-01' }] }, { servicesSig: 5 }]) {
        const d = structuredClone(d0); Object.assign(d.events.find(e => e.id === 'e1'), bad);
        try { await db.importAllData(d, 'replace'); out.push('accepted'); } catch (e) { out.push(e.message.split('.')[0]); } }
      return out; });
    assert.equal(r[0], 'kept');
    assert.deepEqual(r.slice(1), ['Invalid meal menus', 'Invalid meal menus', 'Invalid meal menus', 'Invalid meal menus', 'Invalid money amount: meal rate', 'Invalid meal menus', 'Invalid meal menus', 'Invalid meal menus', 'Invalid meal menus']);
  });

  assert.deepEqual(errors, []);
  await browser.close();
  console.log(failed ? 'meal services FAIL' : 'meal services PASS');
  if (failed) process.exitCode = 1;
})().catch(e => { console.error(e); console.log('meal services FAIL'); process.exitCode = 1; });
