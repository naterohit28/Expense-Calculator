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
  'Wedding – लग्न','Reception – स्वागत समारंभ','Haldi – हळद',
  'Birthday – वाढदिवस','Corporate – कॉर्पोरेट','Other – इतर'
];

export const PAY_MODES = ['Cash – रोख','UPI','NEFT','Cheque – चेक','Bank – बँक'];

/* ── ID / DATE ───────────────────────────────────── */
export function uid(prefix = 'id') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
}

export function today() {
  return new Date().toISOString().split('T')[0];
}

export function fmtDate(d) {
  if (!d) return '—';
  const date = new Date(d);
  if (isNaN(date)) return '—';
  return date.toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
}

export function fmtCurrency(n) {
  return '₹' + Number(n || 0).toLocaleString('en-IN');
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
  return { received, expTotal, pending, profit, margin, pctPaid };
}

export function calcVendorBalance(vendorId, expenses, vPays) {
  const credited = expenses.filter(x => x.venId === vendorId).reduce((s, x) => s + (x.amt || 0), 0);
  const paid     = vPays.filter(p => p.venId === vendorId).reduce((s, p) => s + (p.amt || 0), 0);
  return { credited, paid, balance: credited - paid };
}

/* ── INSIGHTS ────────────────────────────────────── */
export function generateInsights(events, cPays, expenses, vendors) {
  if (!events.length) return [];
  const insights = [];

  const evPL = events.map(ev => ({
    ev,
    ...calcEventPL(ev, cPays, expenses)
  }));

  // Best profit event
  const best = evPL.reduce((a, b) => a.profit > b.profit ? a : b, evPL[0]);
  if (best.profit > 0) {
    insights.push({ type: 'success', icon: '🏆', text: `Best event: ${best.ev.name} with ${fmtCurrency(best.profit)} profit – नफा` });
  }

  // Worst (loss-making) events
  const losses = evPL.filter(r => r.profit < 0).sort((a, b) => a.profit - b.profit).slice(0, 3);
  if (losses.length) {
    insights.push({ type: 'warning', icon: '⚠️', text: `${losses.length} loss-making event${losses.length > 1 ? 's' : ''}: ${losses.map(r => r.ev.name).join(', ')}` });
  }

  // Highest expense category
  const byCat = {};
  expenses.forEach(x => { byCat[x.cat] = (byCat[x.cat] || 0) + x.amt; });
  const topCat = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0];
  if (topCat) {
    insights.push({ type: 'info', icon: '💸', text: `Highest expense: ${topCat[0]} at ${fmtCurrency(topCat[1])} – सर्वाधिक खर्च` });
  }

  // Overdue collections
  const overdue = evPL.filter(r => r.pending > 0);
  if (overdue.length) {
    const totalPending = overdue.reduce((s, r) => s + r.pending, 0);
    insights.push({ type: 'alert', icon: '🔴', text: `${overdue.length} event${overdue.length > 1 ? 's' : ''} with pending: ${fmtCurrency(totalPending)} – थकीत रक्कम` });
  }

  // Vendor balance warning
  const totalVenBal = vendors.reduce((s, v) => {
    const { balance } = calcVendorBalance(v.id, expenses, []);
    return s + balance;
  }, 0);
  if (totalVenBal > 0) {
    insights.push({ type: 'warning', icon: '🤝', text: `Vendor dues: ${fmtCurrency(totalVenBal)} unpaid – विक्रेत्यांची थकबाकी` });
  }

  return insights;
}

/* ── PIN HELPERS ─────────────────────────────────── */
export function hashPin(pin) {
  // Simple obfuscation — not cryptographic, but sufficient for a personal offline app
  let h = 0;
  for (let i = 0; i < pin.length; i++) {
    const char = pin.charCodeAt(i);
    h = ((h << 5) - h) + char;
    h = h & h;
  }
  return `ffpin_${Math.abs(h).toString(36)}_${pin.length}`;
}

export function verifyPin(input, stored) {
  return hashPin(String(input)) === stored;
}

/* ── SEED DATA ───────────────────────────────────── */
export const SEED_DATA = {
  events: [
    {id:'55edf39a',name:'Christ Church Reception',date:'2026-02-07',type:'Reception',venue:'Christ Church',billing:352000,mobile:'',notes:'',photoIds:[],_v:2},
    {id:'29ec4d7f',name:'Dadar Haldi',            date:'2026-02-04',type:'Haldi',    venue:'Dadar',        billing:15000, mobile:'',notes:'',photoIds:[],_v:2},
    {id:'f4412317',name:'Lohar Wadi Wedding',     date:'2026-02-05',type:'Wedding',  venue:'Lohar Wadi',   billing:500000,mobile:'918104334307',notes:'',photoIds:[],_v:2},
    {id:'c335c282',name:'Manav Seva Birthday',    date:'2026-02-14',type:'Birthday', venue:'Manav Seva',   billing:56000, mobile:'918104334307',notes:'',photoIds:[],_v:2}
  ],
  cPays: [
    {id:'b01efcb8',evId:'55edf39a',amt:327000,date:'2026-02-11',mode:'Cash',notes:''},
    {id:'1b6707f6',evId:'55edf39a',amt:25000, date:'2026-02-20',mode:'Cash',notes:''},
    {id:'22b27a5d',evId:'29ec4d7f',amt:15000, date:'2026-02-20',mode:'Cash',notes:''},
    {id:'d3f6b20d',evId:'f4412317',amt:200000,date:'2026-02-01',mode:'Cash',notes:''},
    {id:'6c8598b6',evId:'f4412317',amt:100000,date:'2026-02-05',mode:'UPI', notes:''},
    {id:'09890e1b',evId:'f4412317',amt:100000,date:'2026-02-05',mode:'Cash',notes:''},
    {id:'b62fd4a4',evId:'f4412317',amt:50000, date:'2026-02-18',mode:'Cash',notes:''},
    {id:'a1cbd955',evId:'f4412317',amt:50000, date:'2026-02-18',mode:'UPI', notes:''},
    {id:'c335pay1',evId:'c335c282',amt:56000, date:'2026-02-14',mode:'Cash',notes:''}
  ],
  expenses: [
    {id:'f80e382a',evId:'55edf39a',cat:'Operations',  head:'Transport – वाहतूक',amt:3600, date:'2026-02-07',mode:'Cash',notes:'Tempo fare',     venId:''},
    {id:'e67e27cb',evId:'55edf39a',cat:'Operations',  head:'Water – पाणी',       amt:5000, date:'2026-02-07',mode:'UPI', notes:'',              venId:''},
    {id:'bbb1d027',evId:'29ec4d7f',cat:'Raw Material',head:'Bread – ब्रेड',      amt:600,  date:'2026-02-04',mode:'Cash',notes:'Chapati 150',   venId:''},
    {id:'7a44d5b2',evId:'29ec4d7f',cat:'Operations',  head:'Transport – वाहतूक',amt:964,  date:'2026-02-04',mode:'UPI', notes:'Thane to Dadar',venId:''},
    {id:'exp00005',evId:'29ec4d7f',cat:'Operations',  head:'Transport – वाहतूक',amt:1278, date:'2026-02-04',mode:'UPI', notes:'Dadar to Thane',venId:''},
    {id:'exp00006',evId:'29ec4d7f',cat:'Admin',       head:'Commission',          amt:10000,date:'2026-02-26',mode:'Cash',notes:'Satish Nate',  venId:'5292e26a'},
    {id:'exp00007',evId:'f4412317',cat:'Labour',      head:'Cook – स्वयंपाकी',   amt:25000,date:'2026-02-05',mode:'Cash',notes:'Head cook',    venId:''},
    {id:'exp00008',evId:'f4412317',cat:'Raw Material',head:'Grocery – किराणा',   amt:18000,date:'2026-02-05',mode:'Cash',notes:'',             venId:''},
    {id:'exp00009',evId:'c335c282',cat:'Live Counter',head:'Chaat – चाट',         amt:8000, date:'2026-02-14',mode:'Cash',notes:'',             venId:'5292e26a'}
  ],
  vendors: [
    {id:'5292e26a',name:'Sajid Juice',cat:'Live Counter',specialty:'Juice – ज्यूस',phone:'',notes:''}
  ],
  vPays: [
    {id:'950b615d',venId:'5292e26a',evId:'55edf39a',cat:'Live Counter',head:'Juice – ज्यूस',amt:15000,date:'2026-04-02',mode:'Cash',notes:''}
  ]
};
