'use strict';
/* ========== Screens ========== */
const R = {};
const isCoop = () => S.settings.mode === 'coop';

function parseHash() {
  const h = location.hash.replace(/^#\/?/, ''); const [p, qs] = h.split('?');
  return [p || 'home', Object.fromEntries(new URLSearchParams(qs || ''))];
}
function qs(o) { return Object.entries(o).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => k + '=' + encodeURIComponent(v)).join('&'); }
function render() {
  document.body.classList.toggle('big', !!S.settings.big);
  document.documentElement.lang = isNe() ? 'ne' : 'en';
  let [p, q] = parseHash();
  if (!S.settings.setupDone) p = 'setup';
  const out = (R[p] || R.home)(q) || {};
  const home = p === 'home' || p === 'setup';
  $('#app').innerHTML = (p === 'setup' ? '' :
    '<header class="top"><button class="hb" ' + (home ? 'style="visibility:hidden"' : '') + ' onclick="history.back()" aria-label="' + t('back') + '">←</button>' +
    '<h1>' + esc(out.title || S.settings.name || t('appName')) + '</h1>' +
    (home ? '<button class="hb lang" onclick="toggleLang()">' + (isNe() ? 'EN' : 'ने') + '</button>' : '<button class="hb" onclick="go(\'#/home\')" aria-label="' + t('home') + '">🏠</button>') +
    '</header>') + '<main>' + out.html + '</main>';
  window.scrollTo(0, 0);
  if (out.after) out.after($('#app'));
  loadPhotos($('#app'));
}
function toggleLang() { S.settings.lang = isNe() ? 'en' : 'ne'; persist(); render(); }
function empty(msg) { return '<div class="empty">📭 ' + (msg || t('none')) + '</div>'; }
function saveRec(col, rec) {
  const i = S[col].findIndex(r => r.id === rec.id);
  if (i >= 0) S[col][i] = rec; else S[col].push(rec);
  persist();
}
async function delRec(col, id) {
  if (!(await ask(t('sureDelete')))) return false;
  S[col] = S[col].filter(r => r.id !== id); persist(); toast('🗑'); return true;
}
function bindDelete(root, col, id, then) {
  const b = $('#dl', root); if (b) b.onclick = async () => { if (await delRec(col, id)) then ? then() : history.back(); };
}

/* ---------- first-run setup ---------- */
R.setup = () => {
  const st = S.settings;
  return {
    html: '<div class="setup"><div class="logo">🐄🥛</div><h1>' + t('appName') + '</h1>' +
      '<div class="lb">' + t('chooseLang') + '</div>' +
      choice('lang', [{ v: 'ne', icon: '🇳🇵', label: 'नेपाली' }, { v: 'en', icon: '🔤', label: 'English' }], st.lang, 'two') +
      txtIn('name', t('yourName'), st.name) + rateFields('sell', st) +
      '<p class="help">💡 ' + t('rateHelp') + '</p><button class="btn big green" id="go">✔ ' + t('start') + '</button></div>',
    after() {
      const box = $('.setup');
      box.addEventListener('change', e => { if (e.target.name === 'lang') { const v = vals(box); st.lang = e.target.value; st.name = v.name; readRates(v, st); render(); } });
      $('#go').onclick = () => {
        const v = vals(box);
        Object.assign(st, { mode: 'farmer', setupDone: true, name: v.name.trim() }); readRates(v, st);
        persist(); go('#/home'); render();
      };
    },
  };
};

/* ---------- home ---------- */
function dueIns() { return S.ins.filter(i => !i.renewedBy && i.expiry && BS.valid(i.expiry) && BS.diffDays(BS.today(), i.expiry) <= 30); }
function daysText(dl) { return dl < 0 ? t('expired') : dl === 0 ? t('expiresToday') : nd(dl) + ' ' + t('daysLeft'); }
R.home = () => {
  const td = BS.today(); const coop = isCoop();
  const b = balances(td);
  const tm = milkSum(S.milk.filter(e => e.date === td && e.kind === (coop ? 'buy' : 'sell')));
  const prod = r2(S.prod.filter(e => e.date === td).reduce((a, e) => a + (+e.liters || 0), 0));
  const alerts = dueIns().map(i => {
    const dl = BS.diffDays(td, i.expiry);
    return '<a class="alert ' + (dl < 0 ? 'red' : 'orange') + '" href="#/ins">🛡️ <b>' + t('insDue') + '</b><span>' + esc(i.what) + ' — ' + bsLabel(i.expiry) + ' (' + daysText(dl) + ')</span></a>';
  }).join('');
  const tile = (href, icon, label, c) => '<a class="tile ' + c + '" href="' + href + '"><span class="ic">' + icon + '</span><span>' + label + '</span></a>';
  const tiles = coop ? [
    tile('#/collect', '🥛', t('tCollect'), 'c1'), tile('#/sell', '🚚', t('tSell'), 'c2'),
    tile('#/txn?type=farmerPay', '💵', t('tPayFarmer'), 'c3'), tile('#/farmers', '🧑‍🌾', t('tFarmers'), 'c4'),
    tile('#/calendar', '📅', t('tCalendar'), 'c5'), tile('#/feed', '🌾', t('tFeed'), 'c6'),
    tile('#/money?dir=in', '⬇️💰', t('tMoneyIn'), 'c7'), tile('#/money?dir=out', '⬆️💸', t('tMoneyOut'), 'c8'),
    tile('#/bills', '📷', t('tBills'), 'c9'), tile('#/ins', '🛡️', t('tIns'), 'c10'),
    tile('#/reports', '📊', t('tReports'), 'c11'), tile('#/settings', '⚙️', t('tSettings'), 'c12'),
  ] : [
    tile('#/prod', '🥛', t('tProduce'), 'c1'), tile('#/sell', '🏪', t('tSell'), 'c2'),
    tile('#/animals', '🐄', t('tAnimals'), 'c4'), tile('#/feed', '🌾', t('tFeed'), 'c6'),
    tile('#/calendar', '📅', t('tCalendar'), 'c5'), tile('#/ins', '🛡️', t('tIns'), 'c10'),
    tile('#/money?dir=in', '⬇️💰', t('tMoneyIn'), 'c7'), tile('#/money?dir=out', '⬆️💸', t('tMoneyOut'), 'c8'),
    tile('#/bills', '📷', t('tBills'), 'c9'), tile('#/reports', '📊', t('tReports'), 'c11'),
    tile('#/settings', '⚙️', t('tSettings'), 'c12'),
  ];
  return {
    title: S.settings.name || t('appName'),
    html: '<a class="todaycard" href="#/day?date=' + td + '"><div class="big-date">' + bsLabel(td, true) + '</div><small>' + adLabel(td) + '</small></a>' + alerts +
      '<div class="stats">' +
      (coop ? '<div><span>🥛 ' + t('todayMilk') + '</span><b>' + ltr(tm.lt) + '</b></div><div><span>' + t('todayAmt') + '</span><b>' + money(tm.amt) + '</b></div>'
        : '<div><span>🥛 ' + t('produced') + '</span><b>' + ltr(prod) + '</b></div><div><span>🏪 ' + t('sold') + '</span><b>' + ltr(tm.lt) + '</b></div>') +
      '<div><span>💵 ' + t('cashBal') + '</span><b>' + money(b.cash || 0) + '</b></div></div>' +
      '<div class="tiles">' + tiles.join('') + '</div>',
  };
};

/* ---------- milk entry lists ---------- */
function milkTable(list, kind) {
  if (!list.length) return empty();
  const s = milkSum(list);
  return '<table class="tbl"><thead><tr><th></th><th>' + (kind === 'buy' ? t('farmer') : t('buyer')) + '</th><th>' + t('liters') + '</th><th>' + t('fat') + '</th><th>' + t('rs') + '</th></tr></thead><tbody>' +
    list.map(e => '<tr class="tap" onclick="go(\'#/' + (kind === 'buy' ? 'collect' : 'sell') + '?id=' + e.id + '\')"><td>' + shiftIcon(e.shift) + '</td><td>' + esc(kind === 'buy' ? farmerName(e.farmerId) : e.buyer) + '</td><td>' + num(e.liters) + '</td><td>' + num(e.fat) + '</td><td>' + money(e.amount, false) + '</td></tr>').join('') +
    '</tbody><tfoot><tr><td></td><td>' + t('total') + ' (' + nd(s.n) + ')</td><td>' + num(s.lt) + '</td><td>' + num(s.fat) + '</td><td>' + money(s.amt, false) + '</td></tr></tfoot></table>';
}
function milkForm(kind) {
  return q => {
    const e = q.id ? byId('milk', q.id) : null; const buy = kind === 'buy';
    const date = e ? e.date : q.date || BS.today(); const shift = e ? e.shift : q.shift || defaultShift();
    if (buy && !S.farmers.length) return { title: t('tCollect'), html: empty(t('noFarmers')) + '<a class="btn big green" href="#/farmer">➕ ' + t('addNew') + '</a>' };
    const html = '<form id="f" class="card" onsubmit="return false">' + dateField('date', date) + choice('shift', shiftOpts(), shift, 'two') +
      (buy ? '<div class="lb">' + t('farmer') + '</div><div id="fsel"></div><input class="inp big" id="fq" inputmode="text" placeholder="🔍 ' + t('search') + '" autocomplete="off"><div id="flist" class="flist"></div><input type="hidden" name="farmerId" value="' + (e ? e.farmerId : '') + '">'
        : txtIn('buyer', t('buyer'), e ? e.buyer : (S.settings.lastBuyer || t('buyerDefault')))) +
      '<div class="row2">' + numIn('liters', '🥛 ' + t('liters'), e ? e.liters : '') + numIn('fat', t('fat'), e ? e.fat : '') + '</div>' +
      '<input type="hidden" name="rate" value="' + (e ? e.rate : '') + '">' +
      (buy ? '' : '<div class="lb">' + t('receivedNow') + '</div>' + choice('method', [{ v: 'credit', icon: '📒', label: t('laterCredit') }, { v: 'cash', icon: '💵', label: t('cash') }, { v: 'bank', icon: '🏦', label: t('bank') }], e ? e.method : 'credit', 'three')) +
      '<div class="amtbox"><span>' + t('total') + '</span><b id="amt">' + money(e ? e.amount : 0) + '</b></div>' +
      '<button class="btn big green" id="sv">✔ ' + (e ? t('save') : buy ? t('saveNext') : t('save')) + '</button>' +
      (e ? '<button type="button" class="btn red" id="dl">🗑 ' + t('del') + '</button>' : '') +
      '</form><h3>' + t('todayEntries') + '</h3><div id="list"></div>';
    return {
      title: buy ? t('tCollect') : t('tSell'), html,
      after(root) {
        const f = $('#f'); let rateTouched = !!e;
        const calc = () => {
          const v = vals(f); if (!rateTouched) { const r = rateFromFat(toNum(v.fat), kind, v.shift); f.rate.value = r || ''; }
          $('#amt').textContent = money(r2(toNum(f.liters.value) * toNum(f.rate.value)));
        };
        f.fat.addEventListener('input', () => { rateTouched = false; calc(); });
        f.liters.addEventListener('input', calc);
        const drawList = () => {
          const v = vals(f);
          $('#list').innerHTML = milkTable(S.milk.filter(x => x.kind === kind && x.date === v.date && x.shift === v.shift).sort((a, b) => (a.ts || 0) - (b.ts || 0)), kind);
        };
        f.addEventListener('change', ev => { if (ev.target.name === 'date' || ev.target.name === 'shift') drawList(); if (ev.target.name === 'shift') { rateTouched = false; calc(); } });
        // farmer picker
        const pick = id => {
          f.farmerId.value = id || '';
          const fr = byId('farmers', id);
          $('#fsel').innerHTML = fr ? '<div class="picked"><b>' + esc(farmerName(id)) + '</b><button type="button" class="btn grey" id="chg">✖</button></div>' : '';
          $('#fq').hidden = !!fr; $('#flist').innerHTML = '';
          if (fr) { $('#chg').onclick = () => { pick(''); $('#fq').value = ''; $('#fq').focus(); }; f.liters.focus(); }
        };
        if (buy) {
          const fq = $('#fq');
          fq.addEventListener('input', () => {
            const s = toNum(fq.value) ? String(toNum(fq.value)) : fq.value.trim().toLowerCase();
            const act = S.farmers.filter(x => x.active !== false);
            const exact = act.find(x => String(x.no) === s);
            const list = s ? act.filter(x => String(x.no).startsWith(s) || (x.name || '').toLowerCase().includes(s)).slice(0, 12) : [];
            $('#flist').innerHTML = list.map(x => '<button type="button" class="btn fbtn" data-id="' + x.id + '"><b>' + nd(x.no) + '</b> ' + esc(x.name) + '</button>').join('');
            $$('.fbtn').forEach(b => b.onclick = () => pick(b.dataset.id));
            if (exact && list.length === 1) pick(exact.id);
          });
          pick(e ? e.farmerId : '');
          if (!e) setTimeout(() => fq.focus(), 50);
        }
        // Enter key moves to next box
        $$('input.inp', f).forEach((inp, i, arr) => inp.addEventListener('keydown', ev => {
          if (ev.key === 'Enter') { ev.preventDefault(); const nx = arr.slice(i + 1).find(x => !x.hidden); if (inp.name === 'fat' || !nx) $('#sv').click(); else nx.focus(); }
        }));
        $('#sv').onclick = async () => {
          const v = vals(f); const liters = toNum(v.liters), fat = toNum(v.fat), rate = toNum(v.rate);
          if (buy && !v.farmerId) { toast(t('pickFarmer')); $('#fq').focus(); return; }
          if (!(liters > 0)) { toast(t('required') + ': ' + t('liters')); f.liters.focus(); return; }
          if (!(fat > 0)) { toast(t('required') + ': ' + t('fat')); f.fat.focus(); return; }
          if (!(rate > 0)) { if (await ask(t('setRateFirst'), false)) go('#/settings'); return; }
          if (buy && !e && S.milk.some(x => x.kind === 'buy' && x.farmerId === v.farmerId && x.date === v.date && x.shift === v.shift)) {
            if (!(await ask('⚠ ' + farmerName(v.farmerId) + ' — ' + t('todayEntries') + '. ' + t('add') + '?', false))) return;
          }
          const rec = { id: e ? e.id : uid(), ts: e ? e.ts : Date.now(), kind, date: v.date, shift: v.shift, liters, fat, rate, amount: r2(liters * rate) };
          if (buy) rec.farmerId = v.farmerId; else { rec.buyer = v.buyer.trim(); rec.method = v.method; S.settings.lastBuyer = rec.buyer; }
          saveRec('milk', rec); toast(t('saved') + ' ' + money(rec.amount));
          if (e || !buy) { history.back(); return; }
          pick(''); $('#fq').value = ''; f.liters.value = ''; f.fat.value = ''; f.rate.value = ''; rateTouched = false; calc(); drawList(); $('#fq').focus();
        };
        bindDelete(root, 'milk', e && e.id);
        drawList(); if (!e && !buy) f.liters.focus();
      },
    };
  };
}
R.collect = milkForm('buy');
R.sell = milkForm('sell');

/* ---------- farmer mode: production per animal ---------- */
R.prod = q => {
  const date = q.date || BS.today(), shift = q.shift || defaultShift();
  const animals = S.animals.filter(a => a.active !== false);
  if (!animals.length) return { title: t('tProduce'), html: empty(t('noAnimals')) + '<a class="btn big green" href="#/animal">➕ ' + t('addNew') + '</a>' };
  const ex = S.prod.filter(p => p.date === date && p.shift === shift);
  const val = id => { const p = ex.find(x => x.animalId === id); return p ? p.liters : ''; };
  return {
    title: t('tProduce'),
    html: '<form id="f" class="card" onsubmit="return false">' + dateField('date', date) + choice('shift', shiftOpts(), shift, 'two') +
      animals.map(a => '<label class="prow"><img data-photo="' + esc(a.photo || '') + '" class="thumb" alt=""><span class="pn">' + animalIcon(a.type) + ' ' + esc(a.name || '') + ' <small>' + esc(a.tag || '') + '</small></span><input class="inp num" name="a_' + a.id + '" inputmode="decimal" value="' + val(a.id) + '" placeholder="' + t('ltr') + '"></label>').join('') +
      '<div class="amtbox"><span>' + t('total') + '</span><b id="tot"></b></div><button class="btn big green" id="sv">✔ ' + t('save') + '</button></form>' +
      '<a class="btn big blue" href="#/sell?date=' + date + '">🏪 ' + t('tSell') + '</a>',
    after() {
      const f = $('#f');
      const tot = () => { $('#tot').textContent = ltr($$('input[name^=a_]', f).reduce((a, i) => a + toNum(i.value), 0)); };
      f.addEventListener('input', tot); tot();
      f.addEventListener('change', e => { if (e.target.name === 'date' || e.target.name === 'shift') { const v = vals(f); history.replaceState(null, '', '#/prod?' + qs({ date: v.date, shift: v.shift })); render(); } });
      $$('input[name^=a_]', f).forEach((inp, i, arr) => inp.addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); (arr[i + 1] || $('#sv')).focus(); } }));
      $('#sv').onclick = () => {
        const v = vals(f);
        S.prod = S.prod.filter(p => !(p.date === v.date && p.shift === v.shift));
        animals.forEach(a => { const l = toNum(v['a_' + a.id]); if (l > 0) S.prod.push({ id: uid(), date: v.date, shift: v.shift, animalId: a.id, liters: l }); });
        persist(); toast(t('saved')); go('#/day?date=' + v.date);
      };
    },
  };
};

/* ---------- day view ---------- */
R.day = q => {
  const d = q.date || BS.today(); const coop = isCoop();
  const buys = S.milk.filter(e => e.date === d && e.kind === 'buy');
  const sells = S.milk.filter(e => e.date === d && e.kind === 'sell');
  const prod = S.prod.filter(e => e.date === d);
  const feed = S.feed.filter(e => e.date === d);
  const tx = S.txns.filter(e => e.date === d);
  let h = '<div class="daynav"><a class="btn grey" href="#/day?date=' + BS.addDays(d, -1) + '">◀</a><div><b>' + bsLabel(d, true) + '</b><small>' + adLabel(d) + '</small></div><a class="btn grey" href="#/day?date=' + BS.addDays(d, 1) + '">▶</a></div>';
  if (coop) {
    ['m', 'e'].forEach(sh => { const l = buys.filter(e => e.shift === sh); h += '<h3>' + shiftIcon(sh) + ' ' + t('collected') + ' — ' + (sh === 'm' ? t('morning') : t('evening')) + '</h3>' + milkTable(l, 'buy'); });
    h += '<a class="btn big green" href="#/collect?date=' + d + '">➕ ' + t('tCollect') + '</a>';
  } else {
    const ps = r2(prod.reduce((a, e) => a + e.liters, 0));
    h += '<h3>🥛 ' + t('produced') + ': ' + ltr(ps) + '</h3>' + (prod.length ? '<table class="tbl"><tbody>' + prod.map(p => '<tr><td>' + shiftIcon(p.shift) + '</td><td>' + esc(animalName(p.animalId)) + '</td><td>' + ltr(p.liters) + '</td></tr>').join('') + '</tbody></table>' : empty()) +
      '<div class="row2"><a class="btn green" href="#/prod?date=' + d + '&shift=m">☀️ ' + t('morning') + '</a><a class="btn green" href="#/prod?date=' + d + '&shift=e">🌙 ' + t('evening') + '</a></div>';
  }
  h += '<h3>🚚 ' + t('sold') + '</h3>' + milkTable(sells, 'sell') + '<a class="btn blue" href="#/sell?date=' + d + '">➕ ' + t('tSell') + '</a>';
  if (feed.length) h += '<h3>🌾 ' + t('tFeed') + '</h3>' + feedTable(feed);
  if (tx.length) h += '<h3>💵 ' + t('tAccounts') + '</h3>' + txnTable(tx);
  return { title: t('rDay'), html: h };
};

/* ---------- calendar ---------- */
R.calendar = q => {
  const td = BS.parse(BS.today()); let y = +q.y || td.y, m = +q.m || td.m; const coop = isCoop();
  const perDay = {};
  (coop ? S.milk.filter(e => e.kind === 'buy') : S.prod).forEach(e => { perDay[e.date] = (perDay[e.date] || 0) + (+e.liters || 0); });
  const ms = BS.monthStart(y, m), me = BS.monthEnd(y, m);
  const monthLt = Object.entries(perDay).filter(([d]) => inRange(d, ms, me)).reduce((a, [, v]) => a + v, 0);
  const sold = milkSum(S.milk.filter(e => e.kind === 'sell' && inRange(e.date, ms, me)));
  const prev = m === 1 ? { y: y - 1, m: 12 } : { y, m: m - 1 }, next = m === 12 ? { y: y + 1, m: 1 } : { y, m: m + 1 };
  const a1 = BS.toAD(ms), a2 = BS.toAD(me);
  const adr = a1.toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' }) + '–' + a2.toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' });
  return {
    title: t('tCalendar'),
    html: '<div class="daynav"><a class="btn grey" href="#/calendar?y=' + prev.y + '&m=' + prev.m + '">◀</a><div><b>' + monthLabel(y, m) + '</b><small>' + adr + '</small></div><a class="btn grey" href="#/calendar?y=' + next.y + '&m=' + next.m + '">▶</a></div>' +
      '<div class="card cal">' + monthGrid(y, m, { extra: s => (perDay[s] ? '<i>' + num(perDay[s], 1) + '</i>' : '') }) + '</div>' +
      '<div class="stats"><div><span>🥛 ' + (coop ? t('collected') : t('produced')) + '</span><b>' + ltr(monthLt) + '</b></div><div><span>🚚 ' + t('sold') + '</span><b>' + ltr(sold.lt) + '</b></div><div><span>' + t('rs') + '</span><b>' + money(sold.amt) + '</b></div></div>' +
      '<a class="btn grey" href="#/calendar">' + t('today') + '</a>',
    after(root) { $$('.cal-d', root).forEach(b => b.onclick = () => go('#/day?date=' + b.dataset.date)); },
  };
};

/* ---------- farmers (cooperative) ---------- */
R.farmers = () => {
  const td = BS.parse(BS.today()); const ms = BS.monthStart(td.y, td.m);
  const rows = S.farmers.slice().sort((a, b) => a.no - b.no).map(f => {
    const ml = milkSum(S.milk.filter(e => e.kind === 'buy' && e.farmerId === f.id && e.date >= ms));
    return '<a class="lrow ' + (f.active === false ? 'off' : '') + '" href="#/farmer?id=' + f.id + '" data-s="' + esc((f.no + ' ' + f.name + ' ' + (f.addr || '')).toLowerCase()) + '"><span class="no">' + nd(f.no) + '</span><span class="nm"><b>' + esc(f.name) + '</b><small>' + esc(f.addr || '') + '</small></span><span class="rt">' + ltr(ml.lt) + '<small>' + t('due') + ': ' + money(farmerDue(f.id), false) + '</small></span></a>';
  });
  return {
    title: t('tFarmers'),
    html: '<a class="btn big green" href="#/farmer">➕ ' + t('addNew') + ' ' + t('farmer') + '</a><input class="inp" id="fs" placeholder="🔍 ' + t('search') + '">' +
      '<div class="lb">' + monthLabel(td.y, td.m) + '</div><div id="fl">' + (rows.join('') || empty()) + '</div>',
    after() {
      $('#fs').oninput = e => { const s = e.target.value.toLowerCase().replace(/[०-९]/g, d => DEV.indexOf(d)); $$('#fl .lrow').forEach(r => r.hidden = !r.dataset.s.includes(s)); };
    },
  };
};
R.farmer = q => {
  const f = q.id ? byId('farmers', q.id) : null;
  const nextNo = S.farmers.reduce((a, x) => Math.max(a, +x.no || 0), 0) + 1;
  return {
    title: f ? f.name : t('addNew') + ' ' + t('farmer'),
    html: '<form id="f" class="card" onsubmit="return false">' + numIn('no', t('farmerNo'), f ? f.no : nextNo) + txtIn('name', '👤 ' + t('name'), f && f.name) +
      txtIn('phone', '📞 ' + t('phone'), f && f.phone, 'inputmode="tel"') + txtIn('addr', '🏠 ' + t('address'), f && f.addr) +
      numIn('openingDue', t('opening') + ' ' + t('due') + ' (' + t('rs') + ')', f ? f.openingDue : '') +
      (f ? choice('active', [{ v: 'y', icon: '✅', label: t('active') }, { v: 'n', icon: '🚫', label: t('hidden') }], f.active === false ? 'n' : 'y', 'two') : '') +
      '<button class="btn big green" id="sv">✔ ' + t('save') + '</button>' +
      (f ? '<div class="row2"><a class="btn blue" href="#/rstmt?fid=' + f.id + '">📄 ' + t('rFarmerStmt') + '</a><a class="btn blue" href="#/txn?type=farmerPay&fid=' + f.id + '">💵 ' + t('tPayFarmer') + '</a></div>' +
        (f.phone ? '<a class="btn grey" href="tel:' + esc(f.phone) + '">📞 ' + esc(f.phone) + '</a>' : '') +
        '<div class="amtbox"><span>' + t('due') + '</span><b>' + money(farmerDue(f.id)) + '</b></div><button type="button" class="btn red" id="dl">🗑 ' + t('del') + '</button>' : '') + '</form>',
    after(root) {
      const fm = $('#f'); if (!f) fm.name.focus();
      $('#sv').onclick = () => {
        const v = vals(fm); const no = toNum(v.no);
        if (!v.name.trim()) { toast(t('required') + ': ' + t('name')); fm.name.focus(); return; }
        if (!no || S.farmers.some(x => +x.no === no && (!f || x.id !== f.id))) { toast(t('farmerNo') + ' ✖'); fm.no.focus(); return; }
        saveRec('farmers', { ...(f || { id: uid() }), no, name: v.name.trim(), phone: v.phone.trim(), addr: v.addr.trim(), openingDue: toNum(v.openingDue), active: v.active !== 'n' });
        toast(t('saved')); history.back();
      };
      if (f) $('#dl').onclick = async () => {
        const used = S.milk.some(e => e.farmerId === f.id) || S.txns.some(e => e.farmerId === f.id);
        if (used) { f.active = false; persist(); toast(t('hidden')); history.back(); return; }
        if (await delRec('farmers', f.id)) history.back();
      };
    },
  };
};

/* ---------- animals (farmer) ---------- */
R.animals = () => {
  const td = BS.parse(BS.today()); const ms = BS.monthStart(td.y, td.m);
  const rows = S.animals.map(a => {
    const lt = S.prod.filter(p => p.animalId === a.id && p.date >= ms).reduce((x, p) => x + p.liters, 0);
    return '<a class="lrow ' + (a.active === false ? 'off' : '') + '" href="#/animal?id=' + a.id + '"><img class="thumb" data-photo="' + esc(a.photo || '') + '" alt=""><span class="nm"><b>' + animalIcon(a.type) + ' ' + esc(a.name || '') + '</b><small>' + esc(a.tag || '') + ' ' + esc(a.breed || '') + ' · ' + t(a.status || 'milking') + '</small></span><span class="rt">' + ltr(lt) + '<small>' + BS.MONTHS[lang()][td.m - 1] + '</small></span></a>';
  });
  return { title: t('tAnimals'), html: '<a class="btn big green" href="#/animal">➕ ' + t('addNew') + ' ' + t('animal') + '</a>' + (rows.join('') || empty()) };
};
R.animal = q => {
  const a = q.id ? byId('animals', q.id) : null;
  const types = [{ v: 'cow', icon: '🐄', label: t('cow') }, { v: 'buffalo', icon: '🐃', label: t('buffalo') }, { v: 'goat', icon: '🐐', label: t('goat') }, { v: 'other', icon: '🐾', label: t('other') }];
  const sts = [{ v: 'milking', icon: '🥛', label: t('milking') }, { v: 'pregnant', icon: '🤰', label: t('pregnant') }, { v: 'dry', icon: '⏸️', label: t('dry') }];
  return {
    title: a ? a.name || t('animal') : t('addNew') + ' ' + t('animal'),
    html: '<form id="f" class="card" onsubmit="return false">' + photoField('photo', a && a.photo) +
      choice('type', types, a ? a.type : 'cow', 'four') + txtIn('name', t('name'), a && a.name) + txtIn('tag', t('tag'), a && a.tag) + txtIn('breed', t('breed'), a && a.breed) +
      choice('status', sts, a ? a.status : 'milking', 'three') + dateField('birth', (a && a.birth) || BS.today(), t('birth')) + numIn('price', t('price'), a ? a.price : '') +
      txtIn('note', t('note'), a && a.note) +
      (a ? choice('active', [{ v: 'y', icon: '✅', label: t('active') }, { v: 'n', icon: '🚫', label: t('hidden') }], a.active === false ? 'n' : 'y', 'two') : '') +
      '<button class="btn big green" id="sv">✔ ' + t('save') + '</button>' +
      (a ? '<a class="btn blue" href="#/insf?aid=' + a.id + '">🛡️ ' + t('tIns') + '</a><button type="button" class="btn red" id="dl">🗑 ' + t('del') + '</button>' : '') + '</form>',
    after(root) {
      const fm = $('#f');
      $('#sv').onclick = () => {
        const v = vals(fm);
        if (!v.name.trim() && !v.tag.trim()) { toast(t('required') + ': ' + t('name')); fm.name.focus(); return; }
        saveRec('animals', { ...(a || { id: uid() }), type: v.type, name: v.name.trim(), tag: v.tag.trim(), breed: v.breed.trim(), status: v.status, birth: v.birth, price: toNum(v.price), note: v.note, photo: v.photo, active: v.active !== 'n' });
        toast(t('saved')); history.back();
      };
      if (a) $('#dl').onclick = async () => {
        if (S.prod.some(p => p.animalId === a.id) || S.feed.some(p => p.animalId === a.id)) { a.active = false; persist(); toast(t('hidden')); history.back(); return; }
        if (await delRec('animals', a.id)) history.back();
      };
    },
  };
};

/* ---------- feed ---------- */
function feedTable(list) {
  if (!list.length) return empty();
  return '<table class="tbl"><tbody>' + list.map(e => '<tr class="tap" onclick="go(\'#/feedf?id=' + e.id + '\')"><td>' + bsLabel(e.date) + '</td><td>' + esc(e.item) + ' <small>' + (e.qty ? num(e.qty) + ' ' + esc(t(e.unit || 'kg')) : '') + '</small><br><small>' + esc(animalName(e.animalId)) + '</small></td><td>' + money(e.cost, false) + (e.method === 'credit' ? ' 📒' : '') + (e.photo ? ' 📷' : '') + '</td></tr>').join('') +
    '</tbody><tfoot><tr><td></td><td>' + t('total') + '</td><td>' + money(list.reduce((a, e) => a + (+e.cost || 0), 0), false) + '</td></tr></tfoot></table>';
}
R.feed = () => ({
  title: t('tFeed'),
  html: '<a class="btn big green" href="#/feedf">➕ ' + t('addNew') + '</a>' + feedTable(S.feed.slice().sort(sortDate).reverse().slice(0, 60)),
});
R.feedf = q => {
  const e = q.id ? byId('feed', q.id) : null;
  const animals = S.animals.filter(a => a.active !== false);
  const aOpts = [{ v: '', icon: '🐄🐃', label: t('allAnimals') }].concat(animals.map(a => ({ v: a.id, icon: animalIcon(a.type), label: esc(a.name || a.tag) })));
  const names = t('feedNames').split(',');
  return {
    title: t('tFeed'),
    html: '<form id="f" class="card" onsubmit="return false">' + dateField('date', e ? e.date : BS.today()) +
      (isCoop() || !animals.length ? '<input type="hidden" name="animalId" value="">' : '<div class="lb">' + t('animal') + '</div>' + choice('animalId', aOpts, e ? e.animalId || '' : '', 'wrap')) +
      '<div class="lb">' + t('feedItem') + '</div><div class="chips">' + names.map(n => '<button type="button" class="chip">' + esc(n) + '</button>').join('') + '</div>' +
      '<input class="inp" name="item" value="' + esc(e ? e.item : '') + '" placeholder="' + t('feedItem') + '">' +
      numIn('qty', t('qty'), e ? e.qty : '') + choice('unit', [{ v: 'kg', label: t('kg') }, { v: 'sack', label: t('sack') }, { v: 'bundle', label: t('bundle') }], e ? e.unit : 'kg', 'three small') +
      numIn('cost', '💰 ' + t('cost'), e ? e.cost : '') + '<div class="lb">' + t('paidHow') + '</div>' + choice('method', methodOpts(true), e ? e.method : 'cash', 'three') +
      '<div class="lb">' + t('attachBill') + '</div>' + photoField('photo', e && e.photo) +
      '<button class="btn big green" id="sv">✔ ' + t('save') + '</button>' + (e ? '<button type="button" class="btn red" id="dl">🗑 ' + t('del') + '</button>' : '') + '</form>',
    after(root) {
      const fm = $('#f');
      $$('.chip', fm).forEach(c => c.onclick = () => { fm.item.value = c.textContent; fm.qty.focus(); });
      $('#sv').onclick = () => {
        const v = vals(fm);
        if (!v.item.trim()) { toast(t('required') + ': ' + t('feedItem')); fm.item.focus(); return; }
        saveRec('feed', { ...(e || { id: uid() }), date: v.date, animalId: v.animalId, item: v.item.trim(), qty: toNum(v.qty), unit: v.unit, cost: toNum(v.cost), method: v.method, photo: v.photo });
        toast(t('saved')); history.back();
      };
      bindDelete(root, 'feed', e && e.id);
    },
  };
};

/* ---------- money in / out ---------- */
function txnTable(list) {
  if (!list.length) return empty();
  return '<table class="tbl"><tbody>' + list.map(e => {
    const d = TXN[e.type] || {};
    return '<tr class="tap" onclick="go(\'#/txn?id=' + e.id + '\')"><td>' + bsLabel(e.date) + '</td><td>' + (d.icon || '') + ' ' + esc(tn(d.name)) + '<br><small>' + esc(e.farmerId ? farmerName(e.farmerId) : e.party || '') + ' ' + esc(e.note || '') + '</small></td><td class="' + (d.dir === 'in' ? 'pos' : 'neg') + '">' + (d.dir === 'in' ? '+' : '−') + money(e.amount, false) + (e.photo ? ' 📷' : '') + '</td></tr>';
  }).join('') + '</tbody></table>';
}
const txnTypesFor = dir => Object.entries(TXN).filter(([, d]) => d.dir === dir && (!d.modes || d.modes.includes(S.settings.mode)));
R.money = q => {
  const dir = q.dir === 'out' ? 'out' : 'in';
  return {
    title: dir === 'in' ? t('moneyIn') : t('moneyOut'),
    html: '<div class="tiles small">' + txnTypesFor(dir).map(([k, d]) => '<a class="tile ' + (dir === 'in' ? 'cin' : 'cout') + '" href="#/txn?type=' + k + '"><span class="ic">' + d.icon + '</span><span>' + tn(d.name) + '</span></a>').join('') +
      (dir === 'out' ? '<a class="tile cout" href="#/feedf"><span class="ic">🌾</span><span>' + t('tFeed') + '</span></a><a class="tile cout" href="#/insf"><span class="ic">🛡️</span><span>' + accName('insurance') + '</span></a>' : '') + '</div>' +
      '<h3>' + t('entries') + '</h3>' + txnTable(S.txns.filter(e => (TXN[e.type] || {}).dir === dir).sort(sortDate).reverse().slice(0, 40)),
  };
};
R.txn = q => {
  const e = q.id ? byId('txns', q.id) : null; const type = e ? e.type : q.type; const d = TXN[type];
  if (!d) return R.money({});
  const isFarmer = d.party === 'farmer';
  const fid = e ? e.farmerId : q.fid || '';
  const fOpts = S.farmers.filter(f => f.active !== false || f.id === fid).sort((a, b) => a.no - b.no);
  return {
    title: d.icon + ' ' + tn(d.name),
    html: '<form id="f" class="card" onsubmit="return false">' + dateField('date', e ? e.date : BS.today()) +
      (isFarmer ? fld(t('farmer'), '<select class="inp" name="farmerId"><option value="">— ' + t('pickFarmer') + ' —</option>' + fOpts.map(f => '<option value="' + f.id + '" ' + (f.id === fid ? 'selected' : '') + '>' + nd(f.no) + '. ' + esc(f.name) + '</option>').join('') + '</select>') + '<div class="amtbox"><span>' + t('due') + '</span><b id="due">—</b></div>'
        : txtIn('party', t('party'), e && e.party)) +
      numIn('amount', '💰 ' + t('amount'), e ? e.amount : '') +
      (d.fixed ? '' : '<div class="lb">' + (d.dir === 'in' ? t('receivedHow') : t('paidHow')) + '</div>' + choice('method', methodOpts(false), e ? e.method : 'cash', 'two')) +
      txtIn('note', t('note'), e && e.note) + '<div class="lb">' + t('attachBill') + '</div>' + photoField('photo', e && e.photo) +
      '<button class="btn big green" id="sv">✔ ' + t('save') + '</button>' + (e ? '<button type="button" class="btn red" id="dl">🗑 ' + t('del') + '</button>' : '') + '</form>',
    after(root) {
      const fm = $('#f');
      const showDue = () => { if (!isFarmer) return; const id = fm.farmerId.value; $('#due').textContent = id ? money(farmerDue(id) + (e && e.farmerId === id ? e.amount : 0)) : '—'; if (id && !fm.amount.value && !e) fm.amount.placeholder = String(Math.max(0, farmerDue(id))); };
      if (isFarmer) { fm.farmerId.onchange = showDue; showDue(); }
      if (!e) fm.amount.focus();
      $('#sv').onclick = () => {
        const v = vals(fm); const amount = toNum(v.amount) || (isFarmer && !v.amount && fm.amount.placeholder ? toNum(fm.amount.placeholder) : 0);
        if (isFarmer && !v.farmerId) { toast(t('pickFarmer')); return; }
        if (!(amount > 0)) { toast(t('required') + ': ' + t('amount')); fm.amount.focus(); return; }
        saveRec('txns', { ...(e || { id: uid() }), type, date: v.date, amount, method: d.fixed ? 'cash' : v.method, farmerId: isFarmer ? v.farmerId : undefined, party: isFarmer ? undefined : (v.party || '').trim(), note: v.note, photo: v.photo });
        toast(t('saved') + ' ' + money(amount)); history.back();
      };
      bindDelete(root, 'txns', e && e.id);
    },
  };
};

/* ---------- bill photos ---------- */
R.bills = () => {
  const items = [];
  S.bills.forEach(b => items.push({ id: b.id, photo: b.photo, date: b.date, title: b.title, amt: b.amount, href: '#/bill?id=' + b.id }));
  S.txns.filter(x => x.photo).forEach(x => items.push({ photo: x.photo, date: x.date, title: tn((TXN[x.type] || {}).name), amt: x.amount, href: '#/txn?id=' + x.id }));
  S.feed.filter(x => x.photo).forEach(x => items.push({ photo: x.photo, date: x.date, title: t('tFeed') + ': ' + x.item, amt: x.cost, href: '#/feedf?id=' + x.id }));
  S.ins.filter(x => x.photo).forEach(x => items.push({ photo: x.photo, date: x.start || x.expiry, title: t('tIns') + ': ' + x.what, amt: x.premium, href: '#/insf?id=' + x.id }));
  items.sort((a, b) => (a.date < b.date ? 1 : -1));
  return {
    title: t('tBills'),
    html: '<a class="btn big green" href="#/bill">📷 ' + t('addNew') + '</a><div class="gallery">' + (items.map(i => '<a class="gi" href="' + i.href + '"><img data-photo="' + esc(i.photo) + '" alt=""><b>' + esc(i.title || '') + '</b><small>' + bsLabel(i.date) + (i.amt ? ' · ' + money(i.amt) : '') + '</small></a>').join('') || empty()) + '</div>',
  };
};
R.bill = q => {
  const b = q.id ? byId('bills', q.id) : null;
  const cats = txnTypesFor('out').filter(([, d]) => !d.fixed && !d.party);
  return {
    title: t('tBills'),
    html: '<form id="f" class="card" onsubmit="return false">' + photoField('photo', b && b.photo) + txtIn('title', t('billTitle'), b && b.title) + dateField('date', b ? b.date : BS.today()) +
      numIn('amount', t('amount'), b ? b.amount : '') +
      (b ? '' : '<label class="check"><input type="checkbox" name="asExp"> ' + t('alsoExpense') + '</label><div id="expx" hidden>' + fld(t('category'), '<select class="inp" name="cat">' + cats.map(([k, d]) => '<option value="' + k + '">' + d.icon + ' ' + tn(d.name) + '</option>').join('') + '</select>') + choice('method', methodOpts(false), 'cash', 'two') + '</div>') +
      '<button class="btn big green" id="sv">✔ ' + t('save') + '</button>' + (b ? '<button type="button" class="btn red" id="dl">🗑 ' + t('del') + '</button>' : '') + '</form>',
    after(root) {
      const fm = $('#f');
      if (fm.asExp) fm.asExp.onchange = () => { $('#expx').hidden = !fm.asExp.checked; };
      if (!b) setTimeout(() => $('.pf-cam', fm).click(), 200);
      $('#sv').onclick = () => {
        const v = vals(fm);
        if (!v.photo) { toast(t('required') + ': ' + t('photo')); return; }
        if (v.asExp) {
          if (!(toNum(v.amount) > 0)) { toast(t('required') + ': ' + t('amount')); return; }
          saveRec('txns', { id: uid(), type: v.cat, date: v.date, amount: toNum(v.amount), method: v.method, party: '', note: v.title, photo: v.photo });
        } else saveRec('bills', { ...(b || { id: uid() }), title: v.title.trim(), date: v.date, amount: toNum(v.amount), photo: v.photo });
        toast(t('saved')); history.back();
      };
      bindDelete(root, 'bills', b && b.id);
    },
  };
};

/* ---------- insurance ---------- */
R.ins = () => {
  const td = BS.today();
  const list = S.ins.slice().sort((a, b) => (!!a.renewedBy - !!b.renewedBy) || (a.expiry < b.expiry ? -1 : 1));
  return {
    title: t('tIns'),
    html: '<a class="btn big green" href="#/insf">➕ ' + t('addNew') + '</a><button class="btn blue" id="rem">🔔 ' + t('remindOn') + '</button><p class="help">' + t('remindNote') + '</p>' +
      (list.map(i => {
        const dl = BS.valid(i.expiry) ? BS.diffDays(td, i.expiry) : 999;
        const cls = i.renewedBy ? 'done' : dl < 0 ? 'red' : dl <= 30 ? 'orange' : 'green';
        return '<div class="inscard ' + cls + '"><a href="#/insf?id=' + i.id + '"><b>🛡️ ' + esc(i.what) + '</b><small>' + esc(i.company || '') + ' ' + (i.policy ? '#' + esc(i.policy) : '') + '</small>' +
          '<span>' + t('expiry') + ': <b>' + bsLabel(i.expiry) + '</b> — ' + (i.renewedBy ? '✔ ' + t('renewed') : daysText(dl)) + '</span></a>' +
          (!i.renewedBy && dl <= 30 ? '<a class="btn green" href="#/insf?renew=' + i.id + '">🔄 ' + t('renew') + '</a>' : '') + '</div>';
      }).join('') || empty()),
    after() { $('#rem').onclick = enableReminders; },
  };
};
function plusYear(s) { const { y, m, d } = BS.parse(s); const ny = Math.min(BS.END, y + 1); return BS.addDays(BS.str(ny, m, Math.min(d, BS.dim(ny, m))), -1); }
R.insf = q => {
  const old = q.renew ? byId('ins', q.renew) : null;
  const e = q.id ? byId('ins', q.id) : null; const src = e || old || {};
  const a = q.aid ? byId('animals', q.aid) : null;
  const start = e ? e.start : old ? BS.addDays(old.expiry, 1) : BS.today();
  const animals = S.animals.filter(x => x.active !== false);
  return {
    title: old ? '🔄 ' + t('renew') : t('tIns'),
    html: '<form id="f" class="card" onsubmit="return false">' +
      (animals.length ? '<div class="chips">' + animals.map(x => '<button type="button" class="chip" data-v="' + esc(animalIcon(x.type) + ' ' + (x.name || '') + (x.tag ? ' (' + x.tag + ')' : '')) + '">' + animalIcon(x.type) + ' ' + esc(x.name || x.tag) + '</button>').join('') + '</div>' : '') +
      txtIn('what', t('insFor'), src.what || (a ? animalIcon(a.type) + ' ' + (a.name || '') + (a.tag ? ' (' + a.tag + ')' : '') : '')) +
      txtIn('company', t('company'), src.company) + txtIn('policy', t('policy'), old ? '' : src.policy) +
      dateField('start', start, t('startDate')) + dateField('expiry', e ? e.expiry : plusYear(start), t('expiry')) +
      numIn('sum', t('sumInsured'), src.sum) + numIn('premium', t('premium'), e ? e.premium : old ? old.premium : '') +
      '<div class="lb">' + t('paidHow') + '</div>' + choice('method', methodOpts(false), src.method || 'cash', 'two') +
      '<div class="lb">' + t('photo') + ' (' + t('policy') + ')</div>' + photoField('photo', e && e.photo) +
      '<button class="btn big green" id="sv">✔ ' + t('save') + '</button>' + (e ? '<button type="button" class="btn red" id="dl">🗑 ' + t('del') + '</button>' : '') + '</form>',
    after(root) {
      const fm = $('#f');
      $$('.chip', fm).forEach(c => c.onclick = () => { fm.what.value = c.dataset.v; });
      fm.addEventListener('change', ev => { if (ev.target.name === 'start' && !e) setDateField($('.datef[data-name=expiry]', fm), plusYear(ev.target.value)); });
      $('#sv').onclick = () => {
        const v = vals(fm);
        if (!v.what.trim()) { toast(t('required') + ': ' + t('insFor')); fm.what.focus(); return; }
        if (v.expiry < v.start) { toast(t('expiry') + ' ✖'); return; }
        const rec = { ...(e || { id: uid() }), what: v.what.trim(), company: v.company.trim(), policy: v.policy.trim(), start: v.start, expiry: v.expiry, sum: toNum(v.sum), premium: toNum(v.premium), method: v.method, photo: v.photo };
        saveRec('ins', rec);
        if (old) { old.renewedBy = rec.id; persist(); }
        scheduleReminders(); toast(t('saved')); history.back();
      };
      bindDelete(root, 'ins', e && e.id, () => { scheduleReminders(); history.back(); });
    },
  };
};
async function enableReminders() {
  const LN = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.LocalNotifications;
  try {
    if (isNative() && LN) { const p = await LN.requestPermissions(); if (p.display === 'granted') { await scheduleReminders(); toast('🔔 ✔'); } else toast('🔕'); return; }
    if ('Notification' in window) { const p = await Notification.requestPermission(); toast(p === 'granted' ? '🔔 ✔' : '🔕'); S.settings.lastNotify = ''; notifyWeb(); }
  } catch (e) { toast('🔕'); }
}
async function scheduleReminders() {
  const LN = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.LocalNotifications;
  if (!isNative() || !LN) return;
  try {
    const p = await LN.checkPermissions(); if (p.display !== 'granted') return;
    const pend = await LN.getPending(); if (pend.notifications.length) await LN.cancel({ notifications: pend.notifications.map(n => ({ id: n.id })) });
    const list = []; let id = 1; const now = new Date();
    S.ins.filter(i => !i.renewedBy && BS.valid(i.expiry)).forEach(i => [30, 7, 1, 0].forEach(before => {
      const a = BS.toAD(BS.addDays(i.expiry, -before)); const at = new Date(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate(), 9, 0, 0);
      if (at > now) list.push({ id: id++, title: '🛡️ ' + t('insDue'), body: i.what + ' — ' + bsLabel(i.expiry) + ' (' + daysText(before) + ')', schedule: { at, allowWhileIdle: true } });
    }));
    if (list.length) await LN.schedule({ notifications: list });
  } catch (e) { console.log('reminder error', e); }
}
function notifyWeb() {
  if (isNative() || !('Notification' in window) || Notification.permission !== 'granted') return;
  const td = BS.today(); if (S.settings.lastNotify === td) return;
  const due = dueIns(); if (!due.length) return;
  const body = due.map(i => i.what + ' — ' + daysText(BS.diffDays(td, i.expiry))).join('\n');
  S.settings.lastNotify = td; persist();
  if (navigator.serviceWorker && navigator.serviceWorker.controller) navigator.serviceWorker.ready.then(r => r.showNotification('🛡️ ' + t('insDue'), { body, icon: 'icons/icon-192.png' })).catch(() => {});
  else try { new Notification('🛡️ ' + t('insDue'), { body }); } catch (e) {}
}

/* ---------- settings ---------- */
R.settings = () => {
  const st = S.settings;
  return {
    title: t('tSettings'),
    html: '<form id="f" class="card" onsubmit="return false"><div class="lb">' + t('language') + '</div>' +
      choice('lang', [{ v: 'ne', icon: '🇳🇵', label: 'नेपाली' }, { v: 'en', icon: '🔤', label: 'English' }], st.lang, 'two') +
      txtIn('name', t('yourName'), st.name) + (st.mode === 'coop' ? rateFields('buy', st) : '') + rateFields('sell', st) +
      '<p class="help">💡 ' + t('rateHelp') + '</p><p class="help">🔄 ' + t('rateNote') + '</p><label class="check"><input type="checkbox" name="big" ' + (st.big ? 'checked' : '') + '> 🔠 ' + t('bigText') + '</label>' +
      '<button class="btn big green" id="sv">✔ ' + t('save') + '</button></form>' +
      '<a class="btn big blue" href="#/opening">📒 ' + t('openingBal') + '</a>' +
      '<div class="card"><p class="help">💾 ' + t('backupTip') + '</p><button class="btn big green" id="bk">💾 ' + t('backup') + '</button><button class="btn blue" id="rs">📂 ' + t('restore') + '</button></div>' +
      '<button class="btn blue" id="rem">🔔 ' + t('remindOn') + '</button>' +
      '<button class="btn red" id="reset">⚠️ ' + t('resetAll') + '</button><p class="help center">' + t('appName') + ' v' + APP_VERSION + ' · ' + t('about') + '</p>',
    after() {
      const fm = $('#f');
      fm.addEventListener('change', ev => { if (ev.target.name === 'lang') { st.lang = ev.target.value; persist(); render(); } });
      $('#sv').onclick = () => {
        const v = vals(fm);
        Object.assign(st, { name: v.name.trim(), big: v.big }); readRates(v, st);
        persist(); toast(t('saved')); render();
      };
      $('#bk').onclick = doBackup; $('#rs').onclick = doRestore; $('#rem').onclick = enableReminders;
      $('#reset').onclick = async () => {
        if (!(await ask(t('resetSure')))) return; if (!(await ask(t('resetSure')))) return;
        const keepLang = st.lang; S = DEFAULT_STATE(); S.settings.lang = keepLang; await flush(); await DB.clear('photos'); go('#/home'); render();
      };
    },
  };
};
R.opening = () => {
  const o = S.opening; const coop = isCoop();
  const fp = S.farmers.reduce((a, f) => a + toNum(f.openingDue), 0);
  const A = ['cash', 'bank', 'recv'].concat(coop ? ['equip'] : ['livestock', 'equip']);
  const Lb = ['loan', 'payable'];
  return {
    title: t('openingBal'),
    html: '<form id="f" class="card" onsubmit="return false"><p class="help">' + t('openingHelp') + '</p><h3>' + t('assets') + '</h3>' + A.map(k => numIn(k, accName(k), o[k] || '')).join('') +
      '<h3>' + t('liabilities') + '</h3>' + Lb.map(k => numIn(k, accName(k), o[k] || '')).join('') +
      (coop ? '<div class="amtbox"><span>' + accName('farmerPay') + '</span><b>' + money(fp) + '</b></div><p class="help">(' + t('tFarmers') + ' → ' + t('opening') + ' ' + t('due') + ')</p>' : '') +
      '<div class="amtbox"><span>' + accName('capital') + '</span><b id="cap"></b></div><button class="btn big green" id="sv">✔ ' + t('save') + '</button></form>',
    after() {
      const fm = $('#f');
      const calc = () => { const v = vals(fm); $('#cap').textContent = money(A.reduce((a, k) => a + toNum(v[k]), 0) - Lb.reduce((a, k) => a + toNum(v[k]), 0) - fp); };
      fm.addEventListener('input', calc); calc();
      $('#sv').onclick = () => { const v = vals(fm); A.concat(Lb).forEach(k => o[k] = toNum(v[k])); persist(); toast(t('saved')); history.back(); };
    },
  };
};
async function doBackup() {
  await flush();
  const photos = {}; for (const k of (await DB.keys('photos')) || []) photos[k] = await DB.get('photos', k);
  const data = JSON.stringify({ app: 'setidevi-dairy', version: APP_VERSION, exported: BS.today(), state: S, photos });
  await saveFile('setidevi-backup-' + BS.today() + '.json', data, 'application/json');
}
function doRestore() {
  const i = document.createElement('input'); i.type = 'file'; i.accept = '.json,application/json,text/plain,*/*';
  i.onchange = async () => {
    const f = i.files[0]; if (!f) return;
    try {
      const d = JSON.parse(await f.text());
      if (d.app !== 'setidevi-dairy' || !d.state || !d.state.v) throw new Error('not a backup file');
      if (!(await ask(t('restoreSure')))) return;
      await DB.clear('photos'); for (const [k, v] of Object.entries(d.photos || {})) await DB.put('photos', k, v);
      const base = DEFAULT_STATE(); S = Object.assign(base, d.state); S.settings = Object.assign(base.settings, d.state.settings); S.opening = Object.assign(base.opening, d.state.opening); if (d.state.settings && d.state.settings.setupDone === undefined) S.settings.setupDone = true; S.settings.mode = 'farmer';
      await flush(); toast(t('restored')); scheduleReminders(); go('#/home'); render();
    } catch (e) { toast('✖ ' + e.message); }
  };
  i.click();
}
