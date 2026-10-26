/**
 * utils.js — Flavor Fusion v2
 * Helpers, validation, constants, and expense taxonomy
 */

/* ── APP CONSTANTS ───────────────────────────────── */
export const EXPENSE_HEADS = {
  'Raw Material': [
    'Grocery – किराणा','Other Grocery – इतर किराणा','Vegetable – भाजी','Fruits',
    'Juice – ज्यूस','Water – पाणी','Ice + Milk – बर्फ + दूध','Bread – ब्रेड',
    'Pickle – लोणचे','Sweet – मिठाई','Dry Fruits','Spices / Masala',
    'Oil / Ghee','Paneer / Dairy'
  ],
  'Live Counter': [
    'Chaat – चाट','Starter – स्टार्टर','Dosa – डोसा','Chinese – चायनीज',
    'Ice Cream – आईस्क्रीम','Paan Mukhwas – पान मुखवास','Counter Setup – काउंटर',
    'Pav Bhaji Counter','Pizza / Italian Counter','Dessert Counter','Beverage Counter'
  ],
  'Labour': [
    'Rojiya Labour – रोजीया मजूर','Boys – बॉईज','Ghati – घाटी','Cook – स्वयंपाकी',
    'Helper Staff','Roti Labour – रोटी मजूर','Cleaner / Washing',
    'PRO – पी.आर.О.','Supervisor','Loading / Unloading Labour'
  ],
  'Operations': [
    'Transport – वाहतूक','Fuel / Diesel','Gas / Cylinder – सिलिंडर',
    'Rented Material – भाड्याचे साहित्य','Disposable – डिस्पोजेबल',
    'Packaging Material','New Utensils – नवीन भांडी','Equipment Repair',
    'Generator / Power','Ice Blocks','Water Tanker'
  ],
  'Admin': [
    'Royalty – रॉयल्टी','Office Expense','Phone / Internet',
    'Printing / Stationery','Permission / License','Commission',
    'Marketing Expense','Tips – टीप / बक्षीस','Misc – इतर खर्च','Unaccounted'
  ],
  'Adjustment': [
    'Damage / Breakage','Refund / Compensation','Staff Advance','Cash Difference'
  ]
};

export const CAT_ICONS = {
  'Raw Material':'🥘','Live Counter':'🍽','Labour':'👷',
  'Operations':'🚚','Admin':'📋','Adjustment':'🔄'
};

export const EVENT_TYPES = [
  'Wedding – लग्न','Engagement – साखरपुडा','Reception – स्वागत समारंभ','Haldi – हळद',
  'Birthday – वाढदिवस','Corporate – कॉर्पोरेट','Other – इतर'
];

export const PAY_MODES = ['Cash – रोख','UPI','NEFT','Cheque – चेक','Bank – बँक'];

/* ── ID / DATE ───────────────────────────────────── */
export function uid(prefix = 'id') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
}

// Local date, not UTC — toISOString() returns yesterday before 05:30 IST
export function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function daysSince(d) {
  if (!d) return 0;
  return Math.floor((new Date(today()) - new Date(d)) / 86400000);
}

/* ── HTML ESCAPING ───────────────────────────────── */
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ESC[c]);
}

export function fmtDate(d) {
  if (!d) return '—';
  const date = new Date(d);
  if (isNaN(date)) return '—';
  return date.toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
}

export function fmtCurrency(n) {
  const v = Number(n || 0);
  return (v < 0 ? '-₹' : '₹') + Math.abs(v).toLocaleString('en-IN');
}

/* ── VALIDATION ──────────────────────────────────── */
export function validate(rules, data) {
  const errors = {};

  for (const [field, checks] of Object.entries(rules)) {
    const val = data[field];

    if (checks.required && (val === undefined || val === null || String(val).trim() === '')) {
      errors[field] = checks.requiredMsg || `${field} is required`;
      continue;
    }

    if (checks.numeric && val !== undefined && val !== '') {
      const num = Number(val);
      if (isNaN(num) || num < 0) {
        errors[field] = checks.numericMsg || `${field} must be a positive number`;
        continue;
      }
      if (checks.min !== undefined && num < checks.min) {
        errors[field] = checks.minMsg || `${field} must be at least ${checks.min}`;
        continue;
      }
      if (checks.max !== undefined && num > checks.max) {
        errors[field] = checks.maxMsg || `${field} must be at most ${checks.max}`;
        continue;
      }
    }

    if (checks.phone && val && val.trim()) {
      const digits = val.replace(/\D/g, '');
      if (digits.length < 10 || digits.length > 13) {
        errors[field] = 'Enter a valid mobile number';
      }
    }

    if (checks.date && val) {
      const d = new Date(val);
      if (isNaN(d.getTime())) {
        errors[field] = 'Enter a valid date';
      }
    }
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

export const EVENT_RULES = {
  name:    { required: true, requiredMsg: 'Event name – नाव आवश्यक आहे' },
  date:    { required: true, date: true, requiredMsg: 'Date – दिनांक आवश्यक आहे' },
  venue:   { required: true, requiredMsg: 'Venue – ठिकाण आवश्यक आहे' },
  billing: { required: true, numeric: true, min: 1, requiredMsg: 'Billing amount – बिल रक्कम आवश्यक आहे', minMsg: 'Billing must be > 0' },
  mobile:  { phone: true }
};

export const EXPENSE_RULES = {
  evId: { required: true, requiredMsg: 'Select an event – कार्यक्रम निवडा' },
  amt:  { required: true, numeric: true, min: 1, requiredMsg: 'Amount – रक्कम आवश्यक आहे', minMsg: 'Amount must be > 0' },
  date: { required: true, date: true, requiredMsg: 'Date – दिनांक आवश्यक आहे' }
};

export const PAYMENT_RULES = {
  evId: { required: true, requiredMsg: 'Select an event – कार्यक्रम निवडा' },
  amt:  { required: true, numeric: true, min: 1, requiredMsg: 'Amount – रक्कम आवश्यक आहे', minMsg: 'Amount must be > 0' },
  date: { required: true, date: true, requiredMsg: 'Date – दिनांक आवश्यक आहे' }
};

export const VENDOR_RULES = {
  name:   { required: true, requiredMsg: 'Vendor name – विक्रेत्याचे नाव आवश्यक आहे' },
  phone:  { phone: true }
};

export const VPAY_RULES = {
  venId: { required: true, requiredMsg: 'Select a vendor – विक्रेता निवडा' },
  amt:   { required: true, numeric: true, min: 1, requiredMsg: 'Amount – रक्कम आवश्यक आहे', minMsg: 'Amount must be > 0' },
  date:  { required: true, date: true, requiredMsg: 'Date – दिनांक आवश्यक आहे' }
};

/* ── BUSINESS CALCULATIONS ───────────────────────── */
export function calcEventReceived(eventId, cPays) {
  return cPays.filter(p => p.evId === eventId).reduce((s, p) => s + (p.amt || 0), 0);
}

export function calcEventExpenses(eventId, expenses) {
  return expenses.filter(x => x.evId === eventId).reduce((s, x) => s + (x.amt || 0), 0);
}

export function calcEventPL(ev, cPays, expenses) {
  const received = calcEventReceived(ev.id, cPays);
  const expTotal = calcEventExpenses(ev.id, expenses);
  const pending  = ev.billing - received;
  const profit   = ev.billing - expTotal;
  const margin   = ev.billing > 0 ? Math.round(profit / ev.billing * 100) : 0;
  const pctPaid  = ev.billing > 0 ? Math.min(100, received / ev.billing * 100) : 0;
  // Per-plate figures need a guest count; budget figures need an expected cost
  const guests   = Number(ev.guests) || 0;
  const budget   = Number(ev.budget) || 0;
  const perPlate = n => guests ? Math.round(n / guests) : null;
  return {
    received, expTotal, pending, profit, margin, pctPaid,
    guests, billPerPlate: perPlate(ev.billing), costPerPlate: perPlate(expTotal), profitPerPlate: perPlate(profit),
    budget, budgetUsed: budget ? Math.round(expTotal / budget * 100) : null, overBudget: budget ? expTotal - budget : 0
  };
}

/* Credit purchases still unpaid, each with what's left on it. Vendor payments aren't
   tied to a particular purchase, so they settle that vendor's oldest credit first. */
export function unpaidCredit(expenses, vPays) {
  const byVendor = new Map();
  for (const x of expenses) {
    if (!isOnCredit(x) || !x.venId) continue;
    if (!byVendor.has(x.venId)) byVendor.set(x.venId, []);
    byVendor.get(x.venId).push(x);
  }
  const out = [];
  for (const [venId, xs] of byVendor) {
    let pool = vPays.filter(p => p.venId === venId).reduce((s, p) => s + (p.amt || 0), 0);
    xs.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    for (const x of xs) {
      const covered = Math.min(pool, x.amt || 0);
      pool -= covered;
      const left = (x.amt || 0) - covered;
      if (left > 0) out.push({ x, left });
    }
  }
  return out;
}

// Days from today until a YYYY-MM-DD date (negative = past)
export function daysUntil(d) {
  return -daysSince(d);
}

export function addDays(iso, n) {
  const d = new Date(iso);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/* An expense is either paid on the spot (pay: 'paid') or taken on credit from
   its vendor (pay: 'credit'). Older records have no `pay` field; a vendor-linked
   one was always treated as owed, so it stays credit. */
export function isOnCredit(x) {
  return x.pay ? x.pay === 'credit' : !!x.venId;
}

export function calcVendorBalance(vendorId, expenses, vPays) {
  const mine     = expenses.filter(x => x.venId === vendorId);
  const pays     = vPays.filter(p => p.venId === vendorId);
  const supplied = mine.reduce((s, x) => s + (x.amt || 0), 0);
  const credit   = mine.filter(isOnCredit).reduce((s, x) => s + (x.amt || 0), 0);
  const paidNow  = supplied - credit;
  const paid     = paidNow + pays.reduce((s, p) => s + (p.amt || 0), 0);
  return {
    supplied, credit, paid,
    credited: supplied,              // kept for older callers
    balance: credit - (paid - paidNow),
    entries: mine.length + pays.length
  };
}

/* ── PERIODS ─────────────────────────────────────── */
export const PERIODS = {
  month: 'This month – हा महिना',
  '3m':  '3 months – ३ महिने',
  fy:    'This FY – हे आर्थिक वर्ष',
  all:   'All time – सर्व'
};

// Start date (YYYY-MM-DD) of a period, or '' for all time. FY runs April–March.
export function periodStart(period) {
  const d = new Date(today());
  const y = d.getFullYear(), m = d.getMonth();
  const iso = (yy, mm) => `${yy}-${String(mm + 1).padStart(2, '0')}-01`;
  if (period === 'month') return iso(y, m);
  if (period === '3m')    { const s = new Date(y, m - 2, 1); return iso(s.getFullYear(), s.getMonth()); }
  if (period === 'fy')    return iso(m >= 3 ? y : y - 1, 3);
  return '';
}

// Events dated in the period, plus the payments and expenses that belong to them
export function sliceByPeriod(D, period) {
  const start = periodStart(period);
  if (!start) return D;
  const events = D.events.filter(e => (e.date || '') >= start);
  const ids = new Set(events.map(e => e.id));
  return {
    ...D, events,
    expenses: D.expenses.filter(x => ids.has(x.evId)),
    cPays:    D.cPays.filter(p => ids.has(p.evId))
  };
}

// Past events with no expense recorded — their profit figure is not real yet
export function eventsMissingCosts(events, expenses) {
  const withCosts = new Set(expenses.map(x => x.evId));
  return events.filter(e => isOverdue(e) && !withCosts.has(e.id))
               .sort((a, b) => b.date.localeCompare(a.date));
}

/* ── INSIGHTS ────────────────────────────────────── */
export function generateInsights(events, cPays, expenses, vendors, vPays = []) {
  if (!events.length) return [];
  const insights = [];

  const evPL = events.map(ev => ({
    ev,
    ...calcEventPL(ev, cPays, expenses)
  }));

  // Each insight carries an English and a Marathi sentence (HTML-escaped; <b> marks names/amounts)
  const b = t => `<b>${t}</b>`;

  // Costing gaps first — without expenses an event's profit is overstated
  const missing = eventsMissingCosts(events, expenses);
  if (missing.length) {
    insights.push({ type: 'alert', icon: 'receipt',
      en: `${b(missing.length)} past event${missing.length > 1 ? 's have' : ' has'} no expenses recorded — profit is overstated`,
      mr: `${b(missing.length)} मागील कार्यक्रमांचा खर्च नोंदवलेला नाही — नफा जास्त दिसतो` });
  }

  // Best profit event (only among events that have costs, or the "best" is just the uncosted one)
  const costed = evPL.filter(r => !missing.some(m => m.id === r.ev.id));
  const best = costed.length ? costed.reduce((a, c) => a.profit > c.profit ? a : c, costed[0]) : null;
  if (best && best.profit > 0) {
    const n = b(esc(best.ev.name)), amt = b(fmtCurrency(best.profit));
    insights.push({ type: 'success', icon: 'trophy',
      en: `Best event: ${n} with ${amt} profit`,
      mr: `सर्वोत्तम कार्यक्रम: ${n} — ${amt} नफा` });
  }

  // Loss-making events
  const losses = evPL.filter(r => r.profit < 0).sort((a, c) => a.profit - c.profit).slice(0, 3);
  if (losses.length) {
    const names = losses.map(r => b(esc(r.ev.name))).join(', ');
    insights.push({ type: 'alert', icon: 'warn',
      en: `${losses.length} event${losses.length > 1 ? 's' : ''} made a loss: ${names}`,
      mr: `तोट्यातील कार्यक्रम (${losses.length}): ${names}` });
  }

  // Highest expense category
  const byCat = {};
  expenses.forEach(x => { byCat[x.cat] = (byCat[x.cat] || 0) + x.amt; });
  const topCat = Object.entries(byCat).sort((a, c) => c[1] - a[1])[0];
  if (topCat) {
    const amt = b(fmtCurrency(topCat[1]));
    insights.push({ type: 'info', icon: 'chart',
      en: `Biggest cost: ${b(esc(topCat[0]))} at ${amt}`,
      mr: `सर्वाधिक खर्च: ${b(esc(topCat[0]))} — ${amt}` });
  }

  // Overdue collections — only events whose date has passed
  const overdue = evPL.filter(r => r.pending > 0 && isOverdue(r.ev));
  if (overdue.length) {
    const amt = b(fmtCurrency(overdue.reduce((s, r) => s + r.pending, 0)));
    insights.push({ type: 'alert', icon: 'alert',
      en: `${amt} overdue from ${overdue.length} event${overdue.length > 1 ? 's' : ''}`,
      mr: `${overdue.length} कार्यक्रमांची ${amt} थकीत वसुली` });
  }

  // Events that have spent more than their expected cost
  const over = evPL.filter(r => r.budget && r.overBudget > 0).sort((a, c) => c.overBudget - a.overBudget);
  if (over.length) {
    const top = over[0];
    const n = b(esc(top.ev.name)), amt = b(fmtCurrency(top.overBudget));
    insights.push({ type: 'alert', icon: 'warn',
      en: over.length > 1 ? `${over.length} events are over budget — ${n} by ${amt}` : `${n} is ${amt} over budget`,
      mr: over.length > 1 ? `${over.length} कार्यक्रम बजेटपेक्षा जास्त — ${n} ${amt} ने` : `${n} बजेटपेक्षा ${amt} जास्त` });
  }

  // Vendor dues — net of payments made; advances to one vendor don't offset dues to another
  const totalVenBal = vendors.reduce((s, v) => {
    const { balance } = calcVendorBalance(v.id, expenses, vPays);
    return s + Math.max(0, balance);
  }, 0);
  if (totalVenBal > 0) {
    const amt = b(fmtCurrency(totalVenBal));
    insights.push({ type: 'warning', icon: 'store',
      en: `You owe vendors ${amt}`,
      mr: `विक्रेत्यांची थकबाकी: ${amt}` });
  }

  return insights;
}

// An event's balance is overdue once the event date has passed
export function isOverdue(ev) {
  return daysSince(ev.date) > 0;
}

/* ── PIN HELPERS ─────────────────────────────────── */
// Old format (v2.0): a 32-bit string hash. Kept only to verify PINs set before v2.1.
function legacyHash(pin) {
  let h = 0;
  for (let i = 0; i < pin.length; i++) {
    h = ((h << 5) - h) + pin.charCodeAt(i);
    h = h & h;
  }
  return `ffpin_${Math.abs(h).toString(36)}_${pin.length}`;
}

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

// Salted SHA-256, stored as "sha256$<salt>$<hex>". A 4-digit PIN is still guessable
// offline by someone with the device's storage; this stops casual reading of the hash.
export async function hashPin(pin) {
  if (!crypto?.subtle) return legacyHash(pin); // non-secure context (e.g. file://)
  const salt = [...crypto.getRandomValues(new Uint8Array(8))].map(b => b.toString(16).padStart(2, '0')).join('');
  return `sha256$${salt}$${await sha256Hex(salt + pin)}`;
}

export async function verifyPin(input, stored) {
  if (!stored) return false;
  if (stored.startsWith('sha256$')) {
    const [, salt, hex] = stored.split('$');
    return crypto?.subtle ? (await sha256Hex(salt + String(input))) === hex : false;
  }
  return legacyHash(String(input)) === stored;
}

export function isLegacyPinHash(stored) {
  return !!stored && !stored.startsWith('sha256$');
}

/* ── SEED DATA ───────────────────────────────────── */
// The app starts empty. Business records never ship in the code: it is published
// online. The original starting records are kept outside the app folder as an
// importable backup (flavor-fusion-starting-data.json).
export const SEED_DATA = { events: [], cPays: [], expenses: [], vendors: [], vPays: [] };
