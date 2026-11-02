'use strict';
/* ========== Core: state, storage, formatting, widgets, accounting ========== */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const APP_VERSION = '1.4.0';

const DEFAULT_STATE = () => ({
  v: 1,
  settings: { lang: 'ne', mode: 'farmer', setupDone: false, name: '', buyFatRate: '', sellFatRate: '', buyAddM: '', buyAddE: '', sellAddM: '', sellAddE: '', big: false, lastNotify: '' },
  farmers: [], animals: [], prod: [], milk: [], feed: [], txns: [], bills: [], ins: [],
  opening: { cash: 0, bank: 0, recv: 0, livestock: 0, equip: 0, loan: 0, payable: 0 },
});
let S = DEFAULT_STATE();

const GROUP = {
  cash: 'A', bank: 'A', recv: 'A', livestock: 'A', equip: 'A',
  farmerPay: 'L', loan: 'L', payable: 'L',
  capital: 'E', retained: 'E', drawings: 'E',
  milkSales: 'I', animalSale: 'I', manureSale: 'I', subsidy: 'I', memberFee: 'I', otherIncome: 'I',
  milkPurchase: 'X', feed: 'X', vet: 'X', labor: 'X', insurance: 'X', transport: 'X', electricity: 'X',
  repair: 'X', interest: 'X', rent: 'X', otherExp: 'X',
};
const isPL = a => GROUP[a] === 'I' || GROUP[a] === 'X';

/* ---------- text & numbers ---------- */
const lang = () => (S.settings.lang === 'en' ? 'en' : 'ne');
const isNe = () => lang() === 'ne';
function t(k) { const v = L[k]; return v ? v[isNe() ? 1 : 0] : k; }
function tn(pair) { return pair ? pair[isNe() ? 1 : 0] : ''; }
const accName = a => tn(ACC_NAMES[a]) || a;
const DEV = '०१२३४५६७८९';
function nd(x) { x = String(x); return isNe() ? x.replace(/[0-9]/g, d => DEV[d]) : x; }
function toNum(v) {
  if (v == null) return 0;
  v = String(v).replace(/[०-९]/g, d => DEV.indexOf(d)).replace(/,/g, '').trim();
  const n = parseFloat(v); return isFinite(n) ? n : 0;
}
const r2 = n => Math.round((n + Number.EPSILON) * 100) / 100;
function money(n, rs = true) {
  const s = Math.abs(r2(n)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (n < -0.004 ? '-' : '') + (rs ? t('rs') + ' ' : '') + nd(s);
}
function num(n, dec = 2) { return nd(r2(n).toLocaleString('en-IN', { maximumFractionDigits: dec })); }
const ltr = n => num(n) + ' ' + t('ltr');
function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function bsLabel(s, week) {
  if (!s || !BS.valid(s)) return '—';
  const { y, m, d } = BS.parse(s);
  let o = nd(d) + ' ' + BS.MONTHS[lang()][m - 1] + ' ' + nd(y);
  if (week) o = BS.WEEK[lang()][BS.weekday(s)] + ', ' + o;
  return o;
}
function monthLabel(y, m) { return BS.MONTHS[lang()][m - 1] + ' ' + nd(y); }
function adLabel(s) { return BS.toAD(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }); }
const fyLabel = fy => nd(fy + '/' + String(fy + 1).slice(-2));
const defaultShift = () => (new Date().getHours() < 12 ? 'm' : 'e');

/* ---------- storage (IndexedDB, falls back to localStorage) ---------- */
const DB = {
  db: null,
  open() {
    return new Promise(res => {
      try {
        const r = indexedDB.open('setidevi-dairy', 1);
        r.onupgradeneeded = () => { r.result.createObjectStore('kv'); r.result.createObjectStore('photos'); };
        r.onsuccess = () => { this.db = r.result; res(true); };
        r.onerror = () => res(false);
      } catch (e) { res(false); }
    });
  },
  req(store, mode, fn) {
    return new Promise(res => {
      if (!this.db) return res(this.ls(store, mode, fn));
      try {
        const tx = this.db.transaction(store, mode); const q = fn(tx.objectStore(store));
        tx.oncomplete = () => res(q && q.result); tx.onerror = () => res(null);
      } catch (e) { res(null); }
    });
  },
  ls(store, mode, fn) { // tiny localStorage shim
    const p = 'sd_' + store + '_';
    const os = {
      get: k => ({ result: (() => { try { return JSON.parse(localStorage.getItem(p + k)); } catch (e) { return null; } })() }),
      put: (v, k) => { try { localStorage.setItem(p + k, JSON.stringify(v)); } catch (e) { toast('Storage full!'); } return {}; },
      delete: k => { localStorage.removeItem(p + k); return {}; },
      getAllKeys: () => ({ result: Object.keys(localStorage).filter(k => k.startsWith(p)).map(k => k.slice(p.length)) }),
      clear: () => { Object.keys(localStorage).filter(k => k.startsWith(p)).forEach(k => localStorage.removeItem(k)); return {}; },
    };
    const q = fn(os); return q && q.result;
  },
  get(store, k) { return this.req(store, 'readonly', os => os.get(k)); },
  put(store, k, v) { return this.req(store, 'readwrite', os => os.put(v, k)); },
  del(store, k) { return this.req(store, 'readwrite', os => os.delete(k)); },
  keys(store) { return this.req(store, 'readonly', os => os.getAllKeys()); },
  clear(store) { return this.req(store, 'readwrite', os => os.clear()); },
};
async function loadState() {
  await DB.open();
  const s = await DB.get('kv', 'state');
  if (s && s.v) { const d = DEFAULT_STATE(); S = Object.assign(d, s); S.settings = Object.assign(d.settings, s.settings); S.opening = Object.assign(d.opening, s.opening); }
  // Farmer-only app: older saves that finished setup count as done; always farmer mode
  if (S.settings.setupDone === undefined || (s && s.settings && s.settings.mode && s.settings.setupDone === undefined)) S.settings.setupDone = !!(s && s.settings && s.settings.mode);
  S.settings.mode = 'farmer';
  try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch (e) {}
}
let saveTimer = null;
function persist() { clearTimeout(saveTimer); saveTimer = setTimeout(() => DB.put('kv', 'state', JSON.parse(JSON.stringify(S))), 50); }
function flush() { clearTimeout(saveTimer); return DB.put('kv', 'state', JSON.parse(JSON.stringify(S))); }

/* ---------- photos ---------- */
function compressImage(file) {
  return new Promise(res => {
    const url = URL.createObjectURL(file); const img = new Image();
    img.onload = () => {
      const max = 1400; let { width: w, height: h } = img;
      if (w > max || h > max) { const k = max / Math.max(w, h); w = Math.round(w * k); h = Math.round(h * k); }
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h); URL.revokeObjectURL(url);
      res(c.toDataURL('image/jpeg', 0.72));
    };
    img.onerror = () => { URL.revokeObjectURL(url); res(null); };
    img.src = url;
  });
}
function pickPhoto(camera) {
  return new Promise(res => {
    const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*';
    if (camera) i.setAttribute('capture', 'environment');
    i.onchange = async () => { const f = i.files[0]; if (!f) return res(null); const data = await compressImage(f); if (!data) return res(null); const id = 'p' + uid(); await DB.put('photos', id, data); res(id); };
    i.click();
  });
}
async function loadPhotos(root = document) {
  for (const img of $$('img[data-photo]', root)) {
    const id = img.dataset.photo; if (!id) continue;
    const d = await DB.get('photos', id); if (d) { img.src = d; img.classList.add('has'); }
  }
}
function usedPhotoIds() {
  const ids = new Set();
  ['animals', 'feed', 'txns', 'bills', 'ins', 'farmers'].forEach(c => S[c].forEach(r => r.photo && ids.add(r.photo)));
  return ids;
}
async function cleanupPhotos() {
  const used = usedPhotoIds(); const keys = (await DB.keys('photos')) || [];
  for (const k of keys) if (!used.has(k)) await DB.del('photos', k);
}

/* ---------- UI helpers ---------- */
function toast(msg) {
  let el = $('#toast'); el.textContent = msg; el.classList.add('show');
  clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('show'), 1800);
}
function modal(html, cls = '') {
  const m = $('#modal'); m.className = 'modal show ' + cls;
  m.innerHTML = '<div class="sheet">' + html + '</div>';
  m.onclick = e => { if (e.target === m) closeModal(); };
  loadPhotos(m);
  return m;
}
function closeModal() { const m = $('#modal'); m.className = 'modal'; m.innerHTML = ''; }
function ask(msg, danger = true) {
  return new Promise(res => {
    const m = modal('<div class="ask"><p>' + esc(msg) + '</p><div class="row2"><button class="btn big ' + (danger ? 'red' : 'green') + '" data-a="1">' + t('yes') + '</button><button class="btn big grey" data-a="0">' + t('no') + '</button></div></div>');
    $$('[data-a]', m).forEach(b => b.onclick = () => { closeModal(); res(b.dataset.a === '1'); });
  });
}
function go(h) { if (location.hash === h) render(); else location.hash = h; }
function vals(root) {
  const o = {}; $$('[name]', root).forEach(el => { if (el.type === 'checkbox') o[el.name] = el.checked; else o[el.name] = el.value; }); return o;
}
function fld(label, inner, cls = '') { return '<label class="fld ' + cls + '"><span class="lb">' + label + '</span>' + inner + '</label>'; }
function numIn(name, label, val, extra = '') {
  return fld(label, '<input class="inp num" name="' + name + '" inputmode="decimal" autocomplete="off" value="' + esc(val === 0 || val ? val : '') + '" ' + extra + '>');
}
function txtIn(name, label, val, extra = '') {
  return fld(label, '<input class="inp" name="' + name + '" autocomplete="off" value="' + esc(val || '') + '" ' + extra + '>');
}
function choice(name, opts, val, cls = '') {
  return '<div class="choice ' + cls + '" data-name="' + name + '">' + opts.map(o =>
    '<button type="button" class="ch ' + (String(o.v) === String(val) ? 'on' : '') + '" data-v="' + esc(o.v) + '">' +
    (o.icon ? '<span class="ic">' + o.icon + '</span>' : '') + '<span class="tx">' + o.label + '</span></button>').join('') +
    '<input type="hidden" name="' + name + '" value="' + esc(val ?? '') + '"></div>';
}
function dateField(name, val, label) {
  return (label ? '<div class="lb">' + label + '</div>' : '') +
    '<div class="datef" data-name="' + name + '"><button type="button" class="dp-btn" data-dp="-1">◀</button>' +
    '<button type="button" class="dp-show"><b>' + bsLabel(val, true) + '</b><small>' + adLabel(val) + '</small></button>' +
    '<button type="button" class="dp-btn" data-dp="1">▶</button><input type="hidden" name="' + name + '" value="' + val + '"></div>';
}
function photoField(name, id) {
  return '<div class="photof" data-name="' + name + '"><img data-photo="' + esc(id || '') + '" alt="">' +
    '<div class="pbtns"><button type="button" class="btn blue pf-cam">📷 ' + t('takePhoto') + '</button>' +
    '<button type="button" class="btn grey pf-gal">🖼️</button>' +
    '<button type="button" class="btn grey pf-del" ' + (id ? '' : 'hidden') + '>✖</button></div>' +
    '<input type="hidden" name="' + name + '" value="' + esc(id || '') + '"></div>';
}
const shiftOpts = () => [{ v: 'm', icon: '☀️', label: t('morning') }, { v: 'e', icon: '🌙', label: t('evening') }];
const methodOpts = credit => [{ v: 'cash', icon: '💵', label: t('cash') }, { v: 'bank', icon: '🏦', label: t('bank') }].concat(credit ? [{ v: 'credit', icon: '📒', label: t('credit') }] : []);
const shiftIcon = s => (s === 'm' ? '☀️' : '🌙');
const animalIcon = ty => ({ cow: '🐄', buffalo: '🐃', goat: '🐐' }[ty] || '🐾');

function monthGrid(y, m, opts = {}) {
  const first = BS.str(y, m, 1); const wd = BS.weekday(first); const n = BS.dim(y, m); const td = BS.today();
  let h = '<div class="cal-grid">' + BS.WEEK[lang()].map((w, i) => '<div class="cal-h ' + (i === 6 ? 'sat' : '') + '">' + w + '</div>').join('');
  for (let i = 0; i < wd; i++) h += '<div></div>';
  for (let d = 1; d <= n; d++) {
    const s = BS.str(y, m, d); const a = BS.toAD(s);
    h += '<button type="button" class="cal-d ' + (s === td ? 'today ' : '') + (s === opts.sel ? 'sel ' : '') + (BS.weekday(s) === 6 ? 'sat' : '') + '" data-date="' + s + '">' +
      '<b>' + nd(d) + '</b><small>' + a.getUTCDate() + '</small>' + (opts.extra ? opts.extra(s) : '') + '</button>';
  }
  return h + '</div>';
}
function openDatePicker(cur, onPick) {
  let { y, m } = BS.parse(cur);
  const draw = () => {
    const years = []; for (let i = BS.START; i <= BS.END; i++) years.push(i);
    const mm = modal('<div class="dp"><div class="dp-top"><button class="btn grey dpm" data-k="-1">◀</button>' +
      '<select class="inp dpy">' + years.map(v => '<option ' + (v === y ? 'selected' : '') + ' value="' + v + '">' + nd(v) + '</option>').join('') + '</select>' +
      '<select class="inp dpmo">' + BS.MONTHS[lang()].map((n, i) => '<option ' + (i + 1 === m ? 'selected' : '') + ' value="' + (i + 1) + '">' + n + '</option>').join('') + '</select>' +
      '<button class="btn grey dpm" data-k="1">▶</button></div>' + monthGrid(y, m, { sel: cur }) +
      '<div class="row2"><button class="btn green dptoday">' + t('today') + '</button><button class="btn grey dpclose">' + t('cancel') + '</button></div></div>');
    $$('.dpm', mm).forEach(b => b.onclick = () => { m += +b.dataset.k; if (m < 1) { m = 12; y--; } if (m > 12) { m = 1; y++; } y = Math.min(BS.END, Math.max(BS.START, y)); draw(); });
    $('.dpy', mm).onchange = e => { y = +e.target.value; draw(); };
    $('.dpmo', mm).onchange = e => { m = +e.target.value; draw(); };
    $$('.cal-d', mm).forEach(b => b.onclick = () => { closeModal(); onPick(b.dataset.date); });
    $('.dptoday', mm).onclick = () => { closeModal(); onPick(BS.today()); };
    $('.dpclose', mm).onclick = closeModal;
  };
  draw();
}
function setDateField(box, v) {
  const inp = $('input', box); inp.value = v;
  $('.dp-show', box).innerHTML = '<b>' + bsLabel(v, true) + '</b><small>' + adLabel(v) + '</small>';
  inp.dispatchEvent(new Event('change', { bubbles: true }));
}
// Global delegated handlers for widgets
document.addEventListener('click', async e => {
  const ch = e.target.closest('.ch');
  if (ch) {
    const box = ch.closest('.choice'); $$('.ch', box).forEach(b => b.classList.toggle('on', b === ch));
    const inp = box.querySelector('input[type=hidden]'); inp.value = ch.dataset.v; inp.dispatchEvent(new Event('change', { bubbles: true }));
    return;
  }
  const dpb = e.target.closest('.dp-btn');
  if (dpb) { const box = dpb.closest('.datef'); const v = BS.addDays($('input', box).value, +dpb.dataset.dp); if (BS.valid(v)) setDateField(box, v); return; }
  const dps = e.target.closest('.dp-show');
  if (dps) { const box = dps.closest('.datef'); openDatePicker($('input', box).value, v => setDateField(box, v)); return; }
  const pf = e.target.closest('.pf-cam, .pf-gal, .pf-del');
  if (pf) {
    const box = pf.closest('.photof'); const inp = $('input', box); const img = $('img', box);
    if (pf.classList.contains('pf-del')) { inp.value = ''; img.removeAttribute('src'); img.classList.remove('has'); $('.pf-del', box).hidden = true; return; }
    const id = await pickPhoto(pf.classList.contains('pf-cam'));
    if (id) { inp.value = id; img.dataset.photo = id; await loadPhotos(box); $('.pf-del', box).hidden = false; }
    return;
  }
  const ph = e.target.closest('img.has[data-photo]');
  if (ph && !ph.closest('.modal')) { showPhoto(ph.dataset.photo); }
});
async function showPhoto(id) {
  const d = await DB.get('photos', id); if (!d) return;
  const m = modal('<img class="full" src="' + d + '"><button class="btn big grey" onclick="closeModal()">✖</button>', 'dark');
}

/* ---------- lookups & milk maths ---------- */
const byId = (col, id) => S[col].find(r => r.id === id);
const farmerName = id => { const f = byId('farmers', id); return f ? nd(f.no) + '. ' + f.name : '?'; };
const animalName = id => { const a = byId('animals', id); return a ? animalIcon(a.type) + ' ' + (a.name || '') + (a.tag ? ' (' + a.tag + ')' : '') : t('allAnimals'); };
// Rate per liter = fat % × rate per fat + extra per liter (different for morning / evening)
function rateParts(kind, shift) {
  const st = S.settings, b = kind === 'buy' ? 'buy' : 'sell';
  return { fr: toNum(st[b + 'FatRate']), add: toNum(st[b + (shift === 'e' ? 'AddE' : 'AddM')]) };
}
function rateFromFat(fat, kind, shift) {
  const { fr, add } = rateParts(kind, shift);
  if (!(fr > 0 && fat > 0)) return 0;
  const milli = Math.round(fat * fr * 1000) + Math.round(add * 1000); // exact in 1/1000 rupee
  return Math.round(milli / 10) / 100; // round half up to paisa
}
function rateExplain(fat, kind, shift) {
  const { fr, add } = rateParts(kind, shift);
  if (!(fr > 0 && fat > 0)) return '';
  return num(fat) + ' × ' + num(fr) + (add ? ' + ' + num(add) : '') + ' = ' + t('rs') + ' ' + num(rateFromFat(fat, kind, shift));
}
// Settings fields for one side (buy / sell)
function rateFields(b, st) {
  return '<div class="card rates"><div class="lb">' + t(b + 'FatRate') + '</div>' + numIn(b + 'FatRate', t('fatRate'), st[b + 'FatRate']) +
    '<div class="row2">' + numIn(b + 'AddM', '☀️ ' + t('addMorning'), st[b + 'AddM']) + numIn(b + 'AddE', '🌙 ' + t('addEvening'), st[b + 'AddE']) + '</div></div>';
}
function readRates(v, st) {
  ['buy', 'sell'].forEach(b => ['FatRate', 'AddM', 'AddE'].forEach(k => { if (v[b + k] !== undefined) st[b + k] = toNum(v[b + k]) || ''; }));
}
function milkSum(list) {
  const lt = list.reduce((a, e) => a + (+e.liters || 0), 0);
  const fatL = list.reduce((a, e) => a + (+e.liters || 0) * (+e.fat || 0), 0);
  const amt = list.reduce((a, e) => a + (+e.amount || 0), 0);
  return { lt: r2(lt), fat: lt ? r2(fatL / lt) : 0, amt: r2(amt), n: list.length };
}
const inRange = (d, a, b) => d >= a && d <= b;
const sortDate = (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (a.shift || '') < (b.shift || '') ? 1 : -1);

/* ---------- double-entry accounting ---------- */
function journal() {
  const J = []; const M = m => (m === 'bank' ? 'bank' : 'cash');
  const push = (date, dr, cr, amt, desc, ref) => { amt = r2(+amt || 0); if (amt > 0) J.push({ date, dr, cr, amt, desc, ref }); };
  S.milk.forEach(e => {
    if (e.kind === 'buy') push(e.date, 'milkPurchase', 'farmerPay', e.amount, t('collected') + ': ' + farmerName(e.farmerId) + ' ' + ltr(e.liters), e.id);
    else push(e.date, e.method === 'credit' || !e.method ? 'recv' : M(e.method), 'milkSales', e.amount, t('sold') + ' ' + shiftIcon(e.shift) + ' ' + (e.shift === 'e' ? t('evening') : t('morning')) + ': ' + ltr(e.liters) + ', ' + t('fat') + ' ' + num(e.fat) + (e.buyer ? ' — ' + e.buyer : ''), e.id);
  });
  S.feed.forEach(e => push(e.date, 'feed', e.method === 'credit' ? 'payable' : M(e.method), e.cost, t('tFeed') + ': ' + (e.item || '') + ' — ' + animalName(e.animalId), e.id));
  S.txns.forEach(e => {
    const d = TXN[e.type]; if (!d) return;
    const dr = d.dr === 'M' ? M(e.method) : d.dr, cr = d.cr === 'M' ? M(e.method) : d.cr;
    push(e.date, dr, cr, e.amount, tn(d.name) + (e.farmerId ? ': ' + farmerName(e.farmerId) : e.party ? ': ' + e.party : '') + (e.note ? ' — ' + e.note : ''), e.id);
  });
  S.ins.forEach(e => push(e.start || e.expiry, 'insurance', M(e.method), e.premium, t('tIns') + ': ' + (e.what || '') + ' ' + (e.company || ''), e.id));
  return J.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}
function openingLines() {
  const o = S.opening; const b = {};
  let cap = 0;
  ['cash', 'bank', 'recv', 'livestock', 'equip'].forEach(k => { const v = toNum(o[k]); if (v) { b[k] = v; cap += v; } });
  const fp = S.farmers.reduce((a, f) => a + toNum(f.openingDue), 0);
  const liab = { loan: toNum(o.loan), payable: toNum(o.payable), farmerPay: fp };
  Object.entries(liab).forEach(([k, v]) => { if (v) { b[k] = -v; cap -= v; } });
  if (cap) b.capital = -cap;
  return b;
}
// balances as at `upto`; P&L accounts only from fyS (earlier P&L rolled into "retained")
function balances(upto, fyS) {
  const b = openingLines(); const add = (a, v) => (b[a] = r2((b[a] || 0) + v));
  journal().forEach(j => {
    if (j.date > upto) return;
    const early = fyS && j.date < fyS;
    add(early && isPL(j.dr) ? 'retained' : j.dr, j.amt);
    add(early && isPL(j.cr) ? 'retained' : j.cr, -j.amt);
  });
  return b;
}
function accountLedger(acc, from, to) {
  let open = acc in openingLines() ? openingLines()[acc] : 0; const rows = [];
  journal().forEach(j => {
    if (j.dr !== acc && j.cr !== acc) return;
    const v = j.dr === acc ? j.amt : -j.amt;
    if (j.date < from) open = r2(open + v); else if (j.date <= to) rows.push({ ...j, v, other: j.dr === acc ? j.cr : j.dr });
  });
  return { open, rows };
}
function farmerDue(fid, upto = '9999') {
  const f = byId('farmers', fid); let due = toNum(f && f.openingDue);
  S.milk.forEach(e => { if (e.kind === 'buy' && e.farmerId === fid && e.date <= upto) due += +e.amount || 0; });
  S.txns.forEach(e => { if (e.type === 'farmerPay' && e.farmerId === fid && e.date <= upto) due -= +e.amount || 0; });
  return r2(due);
}

/* ---------- save / share a file (works in browser and in the Android app) ---------- */
async function saveFile(name, content, mime) {
  const C = window.Capacitor;
  if (C && C.isNativePlatform && C.isNativePlatform() && C.Plugins && C.Plugins.Filesystem) {
    try {
      const FS = C.Plugins.Filesystem;
      try { await FS.writeFile({ path: name, data: content, directory: 'DOCUMENTS', encoding: 'utf8', recursive: true }); } catch (e) {}
      const r = await FS.writeFile({ path: name, data: content, directory: 'CACHE', encoding: 'utf8', recursive: true });
      if (C.Plugins.Share) await C.Plugins.Share.share({ title: name, files: [r.uri], url: r.uri }).catch(() => {});
      toast(t('saved'));
      return;
    } catch (e) { toast('Error: ' + e.message); return; }
  }
  const blob = new Blob([content], { type: mime });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  toast(t('saved'));
}
const isNative = () => !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());

/* ---------- morning / evening summaries (used by reports) ---------- */
function shiftStats(from, to) {
  const out = {};
  ['m', 'e'].forEach(sh => {
    const prod = r2(S.prod.filter(p => p.shift === sh && inRange(p.date, from, to)).reduce((a, p) => a + (+p.liters || 0), 0));
    out[sh] = { prod, sold: milkSum(S.milk.filter(x => x.kind === 'sell' && x.shift === sh && inRange(x.date, from, to))) };
  });
  const all = milkSum(S.milk.filter(x => x.kind === 'sell' && inRange(x.date, from, to)));
  out.t = { prod: r2(out.m.prod + out.e.prod), sold: all };
  return out;
}
function shiftTable(from, to) {
  const st = shiftStats(from, to);
  const row = (label, r, cls) => '<tr' + (cls ? ' class="' + cls + '"' : '') + '><td>' + label + '</td><td class="n">' + num(r.prod) + '</td><td class="n">' + num(r.sold.lt) + '</td><td class="n">' + (r.sold.lt ? num(r.sold.fat) : '—') + '</td><td class="n">' + money(r.sold.amt, false) + '</td></tr>';
  return '<table class="tbl"><thead><tr><th>' + t('shift') + '</th><th class="n">' + t('produced') + ' (' + t('ltr') + ')</th><th class="n">' + t('sold') + ' (' + t('ltr') + ')</th><th class="n">' + t('avgFat') + '</th><th class="n">' + t('amount') + '</th></tr></thead><tbody>' +
    row('☀️ ' + t('morning'), st.m) + row('🌙 ' + t('evening'), st.e) + '</tbody><tfoot>' + row(t('total'), st.t) + '</tfoot></table>';
}
