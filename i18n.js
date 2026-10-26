/**
 * i18n.js — Flavor Fusion v2
 * Language display: 'both' (English – मराठी), 'en' or 'mr'.
 *
 * The app's copy is written as "English – मराठी" pairs, and stored data
 * (expense heads, event types, payment modes) uses the same form. Rather than
 * rewrite every string, a MutationObserver rewrites text nodes as they are
 * rendered, keeping the original so switching language is instant.
 *
 * Sentences that don't split cleanly use <span class="t-en"> / <span class="t-mr">,
 * shown or hidden by CSS on html[data-lang].
 * Anything inside [data-nl] (user-typed names, notes) is never touched.
 */

const KEY   = 'ffv2_lang';
const MODES = ['both', 'en', 'mr'];
const DEV   = /[ऀ-ॿ]/;
// "<English> – <Marathi>": English side has no Devanagari, Marathi side has some
const PAIR  = /^(\s*)([^ऀ-ॿ]*?\S)\s+–\s+(.*[ऀ-ॿ].*?)(\s*)$/s;

let mode = 'both';
const originals = new WeakMap();   // text node → original "English – मराठी" string

export function L(text) {
  if (mode === 'both' || !text || !DEV.test(text)) return text;
  const m = PAIR.exec(text);
  if (!m) return text;
  return m[1] + (mode === 'en' ? m[2] : m[3]) + m[4];
}

function skip(node) {
  const p = node.parentElement;
  return !p || p.closest('[data-nl], script, style, textarea');
}

function fixNode(node) {
  if (skip(node)) return;
  let orig = originals.get(node);
  // The app changed this node's text since we last saw it → that's the new original
  if (orig === undefined || node.data !== L(orig)) { orig = node.data; originals.set(node, orig); }
  const want = L(orig);
  if (node.data !== want) node.data = want;
}

function walk(root) {
  if (root.nodeType === Node.TEXT_NODE) { fixNode(root); return; }
  if (root.nodeType !== Node.ELEMENT_NODE) return;
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let n; while ((n = w.nextNode())) fixNode(n);
}

export function initLang() {
  try { const s = localStorage.getItem(KEY); if (MODES.includes(s)) mode = s; } catch {}
  document.documentElement.dataset.lang = mode;
  walk(document.body);
  new MutationObserver(muts => {
    for (const m of muts) {
      if (m.type === 'characterData') fixNode(m.target);
      else m.addedNodes.forEach(walk);
    }
  }).observe(document.body, { childList: true, subtree: true, characterData: true });
}

export function getLang() { return mode; }

export function setLang(next) {
  if (!MODES.includes(next)) return;
  mode = next;
  document.documentElement.dataset.lang = mode;
  try { localStorage.setItem(KEY, mode); } catch {}
  // Re-derive every node from its stored original
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = w.nextNode())) {
    if (skip(n)) continue;
    const orig = originals.get(n);
    if (orig !== undefined) n.data = L(orig); else fixNode(n);
  }
}
