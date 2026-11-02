'use strict';
/* ========== Reports ========== */
R.reports = () => {
  const coop = isCoop();
  const b = (href, icon, label) => '<a class="lrow" href="' + href + '"><span class="no">' + icon + '</span><span class="nm"><b>' + label + '</b></span><span class="rt">›</span></a>';
  return {
    title: t('tReports'),
    html: '<h3>🥛 ' + t('liters') + '</h3>' +
      b('#/day', '📆', t('rDay')) + b('#/rmonth', '🗓️', t('rMilkMonth')) +
      (coop ? b('#/rsheet', '📋', t('rMonthSheet')) + b('#/rstmt', '🧑‍🌾', t('rFarmerStmt'))
        : b('#/rsales', '🧾', t('rSales')) + b('#/ranimal', '🐄', t('rAnimal')) + b('#/rfeed', '🌾', t('rFeedAnimal')) + b('#/rledger?acc=recv', '📒', accName('recv'))) +
      '<h3>📒 ' + t('tAccounts') + '</h3>' +
      b('#/rcash', '💵', t('rCash')) + b('#/rledger', '📖', t('rLedger')) + b('#/rtb', '⚖️', t('rTB')) + b('#/ris', '📈', t('rIS')) + b('#/rbs', '🏛️', t('rBS')),
  };
};

/* ---- controls (any change reloads the report with new values) ---- */
function ctlBox(route, inner) { return '<div class="card ctl" data-route="' + route + '">' + inner + '</div>'; }
document.addEventListener('change', e => {
  const c = e.target.closest('.ctl'); if (!c) return;
  const [, q] = parseHash(); const v = vals(c);
  history.replaceState(null, '', '#/' + c.dataset.route + '?' + qs({ ...q, ...v })); render();
});
function monthCtl(q, route) {
  const td = BS.parse(BS.today()); const y = +q.y || td.y, m = +q.m || td.m;
  const ys = []; for (let i = BS.START; i <= BS.END; i++) ys.push(i);
  return {
    y, m, from: BS.monthStart(y, m), to: BS.monthEnd(y, m),
    html: ctlBox(route, '<div class="row2"><select class="inp" name="y">' + ys.map(v => '<option value="' + v + '" ' + (v === y ? 'selected' : '') + '>' + nd(v) + '</option>').join('') + '</select>' +
      '<select class="inp" name="m">' + BS.MONTHS[lang()].map((n, i) => '<option value="' + (i + 1) + '" ' + (i + 1 === m ? 'selected' : '') + '>' + n + '</option>').join('') + '</select></div>'),
  };
}
function rangeCtl(q, route, extra = '') {
  const td = BS.parse(BS.today());
  let from = q.from && BS.valid(q.from) ? q.from : BS.monthStart(td.y, td.m), to = q.to && BS.valid(q.to) ? q.to : BS.today();
  if (to < from) to = from;
  return { from, to, html: ctlBox(route, extra + dateField('from', from, t('from')) + dateField('to', to, t('to'))) };
}
function fyCtl(q, route) {
  const cur = BS.fyOf(BS.today()); const fy = Math.min(BS.END - 1, Math.max(BS.START, +q.fy || cur));
  const s = BS.fyStart(fy), e = BS.fyEnd(fy);
  let upto = q.upto && BS.valid(q.upto) ? q.upto : BS.today();
  if (upto < s || upto > e) upto = BS.today() >= s && BS.today() <= e ? BS.today() : e;
  const ys = []; for (let i = BS.START; i < BS.END; i++) ys.push(i);
  return {
    fy, s, upto,
    html: ctlBox(route, fld(t('fy'), '<select class="inp" name="fy">' + ys.map(v => '<option value="' + v + '" ' + (v === fy ? 'selected' : '') + '>' + fyLabel(v) + '</option>').join('') + '</select>') + dateField('upto', upto, t('asAt'))),
  };
}
function repWrap(title, sub, body) {
  return '<div id="rep" class="report"><h2>' + title + '</h2><div class="rsub">' + esc(S.settings.name || t('appName')) + ' · ' + sub + '</div>' + body + '</div>' +
    '<div class="row2">' + (isNative() ? '' : '<button class="btn blue" onclick="window.print()">🖨 ' + t('print') + '</button>') +
    '<button class="btn green exp-rep" data-title="' + esc(title) + '">💾 ' + t('saveFile') + '</button></div>';
}
const REPORT_CSS = 'body{font-family:system-ui,"Noto Sans Devanagari",sans-serif;margin:16px;color:#111}h2{margin:0}.rsub{color:#555;margin-bottom:10px}table{border-collapse:collapse;width:100%;margin:8px 0}td,th{border:1px solid #bbb;padding:5px 7px;text-align:left}td.n,th.n{text-align:right}tfoot td,tr.tot td{font-weight:bold;background:#f2f2f2}h3{margin:14px 0 4px}.ok{color:green}.bad{color:#c00}';
document.addEventListener('click', e => {
  const b = e.target.closest('.exp-rep'); if (!b) return;
  const name = b.dataset.title;
  const html = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>' + esc(name) + '</title><style>' + REPORT_CSS + '</style></head><body>' + $('#rep').outerHTML + '</body></html>';
  saveFile(name.replace(/[^\wऀ-ॿ]+/g, '-').replace(/^-|-$/g, '') + '-' + BS.today() + '.html', html, 'text/html');
});
const N = v => '<td class="n">' + v + '</td>';
const TH = v => '<th class="n">' + v + '</th>';

/* ---- monthly milk summary: each day split into morning / evening ---- */
R.rmonth = q => {
  const c = monthCtl(q, 'rmonth'); const coop = isCoop(); const rows = [];
  for (let d = 1; d <= BS.dim(c.y, c.m); d++) {
    const s = BS.str(c.y, c.m, d);
    const per = ['m', 'e'].map(sh => {
      const inL = coop ? milkSum(S.milk.filter(e => e.kind === 'buy' && e.date === s && e.shift === sh)).lt
        : r2(S.prod.filter(e => e.date === s && e.shift === sh).reduce((a, e) => a + e.liters, 0));
      return { sh, inL, out: milkSum(S.milk.filter(e => e.kind === 'sell' && e.date === s && e.shift === sh)) };
    });
    if (!per.some(x => x.inL || x.out.lt)) continue;
    per.forEach((x, i) => rows.push('<tr class="tap" onclick="go(\'#/day?date=' + s + '\')">' + (i === 0 ? '<td rowspan="2"><b>' + nd(d) + '</b></td>' : '') +
      '<td>' + shiftIcon(x.sh) + '</td>' + N(x.inL ? num(x.inL) : '–') + N(x.out.lt ? num(x.out.lt) : '–') + N(x.out.lt ? num(x.out.fat) : '–') + N(x.out.amt ? money(x.out.amt, false) : '–') + '</tr>'));
  }
  const st = shiftStats(c.from, c.to);
  const foot = (label, r) => '<tr><td colspan="2">' + label + '</td>' + N(num(r.prod)) + N(num(r.sold.lt)) + N(r.sold.lt ? num(r.sold.fat) : '–') + N(money(r.sold.amt, false)) + '</tr>';
  const head = '<tr><th>' + t('date') + '</th><th>' + t('shift') + '</th>' + TH((coop ? t('collected') : t('produced')) + ' ' + t('ltr')) + TH(t('sold') + ' ' + t('ltr')) + TH(t('fat')) + TH(t('amount')) + '</tr>';
  const body = rows.length ? '<table class="tbl"><thead>' + head + '</thead><tbody>' + rows.join('') + '</tbody><tfoot>' +
    foot('☀️ ' + t('morning') + ' ' + t('total'), st.m) + foot('🌙 ' + t('evening') + ' ' + t('total'), st.e) + foot(t('total'), st.t) + '</tfoot></table>' : empty();
  return { title: t('rMilkMonth'), html: c.html + repWrap(t('rMilkMonth'), monthLabel(c.y, c.m), body) };
};

/* ---- milk sales statement: every sale with shift, liters, fat, rate; money received; balance ---- */
R.rsales = q => {
  const c = rangeCtl(q, 'rsales');
  const sells = S.milk.filter(e => e.kind === 'sell' && inRange(e.date, c.from, c.to)).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.shift === 'm' ? -1 : 1));
  const recv = S.txns.filter(e => e.type === 'milkRecv' && inRange(e.date, c.from, c.to)).sort(sortDate);
  const st = shiftStats(c.from, c.to);
  const sd = x => { const { m, d } = BS.parse(x); return nd(d) + ' ' + BS.MONTHS[lang()][m - 1]; };
  const rows = sells.map(e => '<tr><td style="white-space:nowrap">' + sd(e.date) + '</td><td>' + shiftIcon(e.shift) + '</td>' + N(num(e.liters)) + N(num(e.fat)) + N(num(e.rate)) + N(money(e.amount, false)) + '</tr>').join('');
  const foot = (label, r) => '<tr><td colspan="2">' + label + '</td>' + N(num(r.sold.lt)) + N(r.sold.lt ? num(r.sold.fat) : '–') + N('') + N(money(r.sold.amt, false)) + '</tr>';
  const recvTot = r2(recv.reduce((a, e) => a + e.amount, 0));
  const L = accountLedger('recv', c.from, c.to); const closing = r2(L.open + L.rows.reduce((a, r) => a + r.v, 0));
  const body = (sells.length ? '<table class="tbl"><thead><tr><th>' + t('date') + '</th><th>' + t('shift') + '</th>' + TH(t('ltr')) + TH(t('fat')) + TH(t('rate')) + TH(t('amount')) + '</tr></thead><tbody>' + rows + '</tbody><tfoot>' +
      foot('☀️ ' + t('morning') + ' ' + t('total'), st.m) + foot('🌙 ' + t('evening') + ' ' + t('total'), st.e) + foot(t('total'), st.t) + '</tfoot></table>' : empty()) +
    '<h3>💵 ' + t('received') + '</h3>' + (recv.length ? '<table class="tbl"><tbody>' + recv.map(e => '<tr><td>' + bsLabel(e.date) + '</td><td>' + esc(e.party || e.note || '') + '</td>' + N(money(e.amount, false)) + '</tr>').join('') + '</tbody><tfoot><tr><td colspan="2">' + t('total') + '</td>' + N(money(recvTot, false)) + '</tr></tfoot></table>' : empty()) +
    '<div class="amtbox"><span>' + accName('recv') + '</span><b>' + money(closing) + '</b></div>';
  return { title: t('rSales'), html: c.html + repWrap(t('rSales'), bsLabel(c.from) + ' – ' + bsLabel(c.to), body) };
};

/* ---- cooperative: monthly payment sheet ---- */
R.rsheet = q => {
  const c = monthCtl(q, 'rsheet'); const T = { lt: 0, amt: 0, paid: 0, due: 0 };
  const rows = S.farmers.slice().sort((a, b) => a.no - b.no).map(f => {
    const ms = milkSum(S.milk.filter(e => e.kind === 'buy' && e.farmerId === f.id && inRange(e.date, c.from, c.to)));
    const paid = r2(S.txns.filter(e => e.type === 'farmerPay' && e.farmerId === f.id && inRange(e.date, c.from, c.to)).reduce((a, e) => a + e.amount, 0));
    const due = farmerDue(f.id, c.to);
    if (!ms.lt && !paid && !due) return '';
    T.lt += ms.lt; T.amt += ms.amt; T.paid += paid; T.due += due;
    return '<tr class="tap" onclick="go(\'#/rstmt?fid=' + f.id + '&from=' + c.from + '&to=' + c.to + '\')"><td>' + nd(f.no) + '</td><td>' + esc(f.name) + '</td>' + N(num(ms.lt)) + N(num(ms.fat)) + N(money(ms.amt, false)) + N(money(paid, false)) + N(money(due, false)) + '</tr>';
  }).join('');
  const body = rows ? '<table class="tbl"><thead><tr><th>' + t('farmerNo') + '</th><th>' + t('name') + '</th>' + TH(t('ltr')) + TH(t('avgFat')) + TH(t('amount')) + TH(t('paid')) + TH(t('due')) + '</tr></thead><tbody>' + rows + '</tbody>' +
    '<tfoot><tr><td></td><td>' + t('total') + '</td>' + N(num(T.lt)) + N(T.lt ? num(S.milk.filter(e => e.kind === 'buy' && inRange(e.date, c.from, c.to)).reduce((a, e) => a + e.liters * e.fat, 0) / T.lt) : '') + N(money(T.amt, false)) + N(money(T.paid, false)) + N(money(T.due, false)) + '</tr></tfoot></table>' : empty();
  return { title: t('rMonthSheet'), html: c.html + repWrap(t('rMonthSheet'), monthLabel(c.y, c.m), body) };
};

/* ---- cooperative: farmer statement ---- */
R.rstmt = q => {
  const fl = S.farmers.slice().sort((a, b) => a.no - b.no);
  const fid = q.fid || (fl[0] && fl[0].id) || '';
  const sel = fld(t('farmer'), '<select class="inp" name="fid">' + fl.map(f => '<option value="' + f.id + '" ' + (f.id === fid ? 'selected' : '') + '>' + nd(f.no) + '. ' + esc(f.name) + '</option>').join('') + '</select>');
  const c = rangeCtl(q, 'rstmt', sel);
  if (!fid) return { title: t('rFarmerStmt'), html: empty(t('noFarmers')) };
  const open = farmerDue(fid, BS.addDays(c.from, -1));
  const ev = [];
  S.milk.filter(e => e.kind === 'buy' && e.farmerId === fid && inRange(e.date, c.from, c.to)).forEach(e => ev.push({ date: e.date, shift: e.shift, lt: e.liters, fat: e.fat, rate: e.rate, cr: e.amount }));
  S.txns.filter(e => e.type === 'farmerPay' && e.farmerId === fid && inRange(e.date, c.from, c.to)).forEach(e => ev.push({ date: e.date, shift: 'z', pay: e.amount, note: e.note }));
  ev.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.shift < b.shift ? -1 : 1));
  let bal = open; const ms = milkSum(ev.filter(e => e.lt).map(e => ({ liters: e.lt, fat: e.fat, amount: e.cr }))); let paid = 0;
  const rows = ev.map(e => { bal = r2(bal + (e.cr || 0) - (e.pay || 0)); paid += e.pay || 0;
    return e.pay ? '<tr><td>' + bsLabel(e.date) + '</td><td colspan="4">💵 ' + t('paid') + ' ' + esc(e.note || '') + '</td>' + N('') + N(money(e.pay, false)) + N(money(bal, false)) + '</tr>'
      : '<tr><td>' + bsLabel(e.date) + '</td><td>' + shiftIcon(e.shift) + '</td>' + N(num(e.lt)) + N(num(e.fat)) + N(num(e.rate)) + N(money(e.cr, false)) + N('') + N(money(bal, false)) + '</tr>'; }).join('');
  const body = '<h3>' + esc(farmerName(fid)) + '</h3><table class="tbl"><thead><tr><th>' + t('date') + '</th><th></th>' + TH(t('ltr')) + TH(t('fat')) + TH(t('rate')) + TH(t('amount')) + TH(t('paid')) + TH(t('due')) + '</tr></thead><tbody>' +
    '<tr class="tot"><td colspan="7">' + t('opening') + ' ' + t('due') + '</td>' + N(money(open, false)) + '</tr>' + rows + '</tbody><tfoot><tr><td colspan="2">' + t('total') + '</td>' + N(num(ms.lt)) + N(num(ms.fat)) + N('') + N(money(ms.amt, false)) + N(money(paid, false)) + N(money(bal, false)) + '</tr></tfoot></table>' +
    '<div class="amtbox"><span>' + t('due') + '</span><b>' + money(bal) + '</b></div>';
  return { title: t('rFarmerStmt'), html: c.html + repWrap(t('rFarmerStmt'), bsLabel(c.from) + ' – ' + bsLabel(c.to), body) + '<a class="btn big green" href="#/txn?type=farmerPay&fid=' + fid + '">💵 ' + t('tPayFarmer') + '</a>' };
};

/* ---- farmer: milk by animal ---- */
R.ranimal = q => {
  const c = monthCtl(q, 'ranimal'); const T = { m: 0, e: 0 };
  const rows = S.animals.map(a => {
    const p = S.prod.filter(x => x.animalId === a.id && inRange(x.date, c.from, c.to));
    if (!p.length) return '';
    const m = r2(p.filter(x => x.shift === 'm').reduce((s, x) => s + x.liters, 0)), e = r2(p.filter(x => x.shift === 'e').reduce((s, x) => s + x.liters, 0));
    const days = new Set(p.map(x => x.date)).size; T.m += m; T.e += e;
    return '<tr><td>' + esc(animalName(a.id)) + '</td>' + N(num(m)) + N(num(e)) + N(num(m + e)) + N(nd(days)) + N(num((m + e) / days)) + '</tr>';
  }).join('');
  const body = rows ? '<table class="tbl"><thead><tr><th>' + t('animal') + '</th>' + TH('☀️') + TH('🌙') + TH(t('total')) + TH(t('days')) + TH(t('ltr') + '/' + t('days')) + '</tr></thead><tbody>' + rows + '</tbody><tfoot><tr><td>' + t('total') + '</td>' + N(num(T.m)) + N(num(T.e)) + N(num(T.m + T.e)) + N('') + N('') + '</tr></tfoot></table>' : empty();
  return { title: t('rAnimal'), html: c.html + repWrap(t('rAnimal'), monthLabel(c.y, c.m), body) };
};

/* ---- farmer: feed cost by animal ---- */
R.rfeed = q => {
  const c = monthCtl(q, 'rfeed');
  const feed = S.feed.filter(e => inRange(e.date, c.from, c.to));
  const common = r2(feed.filter(e => !e.animalId).reduce((a, e) => a + e.cost, 0));
  const act = S.animals.filter(a => a.active !== false || feed.some(f => f.animalId === a.id));
  const share = act.length ? common / act.length : 0; let T = { d: 0, s: 0, l: 0 };
  const rows = act.map(a => {
    const direct = r2(feed.filter(e => e.animalId === a.id).reduce((s, e) => s + e.cost, 0));
    const lt = r2(S.prod.filter(x => x.animalId === a.id && inRange(x.date, c.from, c.to)).reduce((s, x) => s + x.liters, 0));
    T.d += direct; T.s += share; T.l += lt;
    return '<tr><td>' + esc(animalName(a.id)) + '</td>' + N(money(direct, false)) + N(money(share, false)) + N(money(direct + share, false)) + N(num(lt)) + N(lt ? money((direct + share) / lt, false) : '—') + '</tr>';
  }).join('');
  const body = (rows ? '<table class="tbl"><thead><tr><th>' + t('animal') + '</th>' + TH(t('tFeed')) + TH(t('allAnimals') + ' ÷') + TH(t('total')) + TH(t('ltr')) + TH(t('perLiterCost')) + '</tr></thead><tbody>' + rows + '</tbody><tfoot><tr><td>' + t('total') + '</td>' + N(money(T.d, false)) + N(money(T.s, false)) + N(money(T.d + T.s, false)) + N(num(T.l)) + N(T.l ? money((T.d + T.s) / T.l, false) : '—') + '</tr></tfoot></table>' : empty()) +
    '<h3>' + t('entries') + '</h3>' + feedTable(feed.sort(sortDate));
  return { title: t('rFeedAnimal'), html: c.html + repWrap(t('rFeedAnimal'), monthLabel(c.y, c.m), body) };
};

/* ---- cash book & ledger ---- */
function ledgerTable(acc, from, to) {
  const { open, rows } = accountLedger(acc, from, to); let bal = open, ti = 0, to_ = 0;
  const tr = rows.map(r => { bal = r2(bal + r.v); if (r.v > 0) ti += r.v; else to_ -= r.v;
    return '<tr><td>' + bsLabel(r.date) + '</td><td>' + esc(r.desc) + '<br><small>↔ ' + esc(accName(r.other)) + '</small></td>' + N(r.v > 0 ? money(r.v, false) : '') + N(r.v < 0 ? money(-r.v, false) : '') + N(money(bal, false)) + '</tr>'; }).join('');
  return '<table class="tbl"><thead><tr><th>' + t('date') + '</th><th>' + t('details') + '</th>' + TH(t('debit')) + TH(t('creditCol')) + TH(t('closing')) + '</tr></thead><tbody>' +
    '<tr class="tot"><td colspan="4">' + t('opening') + '</td>' + N(money(open, false)) + '</tr>' + tr + '</tbody><tfoot><tr><td colspan="2">' + t('total') + '</td>' + N(money(ti, false)) + N(money(to_, false)) + N(money(bal, false)) + '</tr></tfoot></table>';
}
R.rcash = q => {
  const acc = q.acc === 'bank' ? 'bank' : 'cash';
  const c = rangeCtl(q, 'rcash', choice('acc', [{ v: 'cash', icon: '💵', label: t('cash') }, { v: 'bank', icon: '🏦', label: t('bank') }], acc, 'two'));
  return { title: t('rCash'), html: c.html + repWrap(t('rCash') + ' — ' + accName(acc), bsLabel(c.from) + ' – ' + bsLabel(c.to), ledgerTable(acc, c.from, c.to)) };
};
R.rledger = q => {
  const acc = GROUP[q.acc] ? q.acc : 'cash';
  const c = rangeCtl(q, 'rledger', fld(t('account'), '<select class="inp" name="acc">' + Object.keys(GROUP).filter(a => a !== 'retained').map(a => '<option value="' + a + '" ' + (a === acc ? 'selected' : '') + '>' + esc(accName(a)) + '</option>').join('') + '</select>'));
  if (!q.from && !q.acc) { /* default: from the start of fiscal year */ }
  return { title: t('rLedger'), html: c.html + repWrap(t('rLedger') + ' — ' + accName(acc), bsLabel(c.from) + ' – ' + bsLabel(c.to), ledgerTable(acc, c.from, c.to)) };
};

/* ---- trial balance / income statement / balance sheet ---- */
function finals(fy, s, upto) {
  const b = balances(upto, s); const keys = Object.keys(GROUP);
  const inc = keys.filter(a => GROUP[a] === 'I').map(a => [a, r2(-(b[a] || 0))]).filter(x => Math.abs(x[1]) > 0.004);
  const exp = keys.filter(a => GROUP[a] === 'X').map(a => [a, r2(b[a] || 0)]).filter(x => Math.abs(x[1]) > 0.004);
  const ti = r2(inc.reduce((a, x) => a + x[1], 0)), te = r2(exp.reduce((a, x) => a + x[1], 0));
  return { b, keys, inc, exp, ti, te, profit: r2(ti - te) };
}
R.rtb = q => {
  const c = fyCtl(q, 'rtb'); const { b, keys } = finals(c.fy, c.s, c.upto); let td = 0, tc = 0;
  const rows = keys.filter(a => Math.abs(b[a] || 0) > 0.004).map(a => { const v = b[a]; if (v > 0) td += v; else tc -= v;
    return '<tr class="tap" onclick="go(\'#/rledger?acc=' + a + '&from=' + c.s + '&to=' + c.upto + '\')"><td>' + esc(accName(a)) + '</td>' + N(v > 0 ? money(v, false) : '') + N(v < 0 ? money(-v, false) : '') + '</tr>'; }).join('');
  const ok = Math.abs(td - tc) < 0.01;
  const body = rows ? '<table class="tbl"><thead><tr><th>' + t('account') + '</th>' + TH(t('debit') + ' (' + t('rs') + ')') + TH(t('creditCol') + ' (' + t('rs') + ')') + '</tr></thead><tbody>' + rows + '</tbody><tfoot><tr><td>' + t('total') + '</td>' + N(money(td, false)) + N(money(tc, false)) + '</tr></tfoot></table>' +
    '<p class="' + (ok ? 'ok' : 'bad') + '">' + (ok ? t('balanced') : t('notBalanced')) + '</p>' : empty();
  return { title: t('rTB'), html: c.html + repWrap(t('rTB'), t('fy') + ' ' + fyLabel(c.fy) + ' · ' + t('asAt') + ' ' + bsLabel(c.upto), body) };
};
R.ris = q => {
  const c = fyCtl(q, 'ris'); const F = finals(c.fy, c.s, c.upto);
  const lt = (k) => r2(S.milk.filter(e => e.kind === k && inRange(e.date, c.s, c.upto)).reduce((a, e) => a + e.liters, 0));
  const sec = (title, list, tot) => '<h3>' + title + '</h3><table class="tbl"><tbody>' + (list.map(([a, v]) => '<tr><td>' + esc(accName(a)) + '</td>' + N(money(v, false)) + '</tr>').join('') || '<tr><td>—</td>' + N('0') + '</tr>') + '</tbody><tfoot><tr><td>' + t('total') + ' ' + title + '</td>' + N(money(tot, false)) + '</tr></tfoot></table>';
  const body = sec(t('income'), F.inc, F.ti) + sec(t('expenses'), F.exp, F.te) +
    '<div class="amtbox ' + (F.profit >= 0 ? 'good' : 'badbg') + '"><span>' + (F.profit >= 0 ? t('netProfit') : t('netLoss')) + '</span><b>' + money(Math.abs(F.profit)) + '</b></div>' +
    '<h3>🥛 ' + t('shiftSummary') + '</h3>' + shiftTable(c.s, c.upto);
  return { title: t('rIS'), html: c.html + repWrap(t('rIS'), t('fy') + ' ' + fyLabel(c.fy) + ' · ' + bsLabel(c.s) + ' – ' + bsLabel(c.upto), body) };
};
R.rbs = q => {
  const c = fyCtl(q, 'rbs'); const F = finals(c.fy, c.s, c.upto); const b = F.b;
  const A = F.keys.filter(a => GROUP[a] === 'A' && Math.abs(b[a] || 0) > 0.004).map(a => [a, r2(b[a])]);
  const Lb = F.keys.filter(a => GROUP[a] === 'L' && Math.abs(b[a] || 0) > 0.004).map(a => [a, r2(-b[a])]);
  const E = [['capital', r2(-(b.capital || 0))], ['retained', r2(-(b.retained || 0))], ['drawings', r2(-(b.drawings || 0))], ['__p', F.profit]].filter(x => Math.abs(x[1]) > 0.004);
  const ta = r2(A.reduce((a, x) => a + x[1], 0)), tl = r2(Lb.reduce((a, x) => a + x[1], 0)), te = r2(E.reduce((a, x) => a + x[1], 0));
  const nm = a => (a === '__p' ? (F.profit >= 0 ? t('curProfit') : t('netLoss')) : a === 'drawings' ? '(−) ' + accName(a) : accName(a));
  const sec = (title, list, tot) => '<h3>' + title + '</h3><table class="tbl"><tbody>' + (list.map(([a, v]) => '<tr><td>' + esc(nm(a)) + '</td>' + N(money(v, false)) + '</tr>').join('') || '<tr><td>—</td>' + N('0') + '</tr>') + '</tbody><tfoot><tr><td>' + t('total') + '</td>' + N(money(tot, false)) + '</tr></tfoot></table>';
  const ok = Math.abs(ta - tl - te) < 0.01;
  const body = sec(t('assets'), A, ta) + sec(t('liabilities'), Lb, tl) + sec(t('equity'), E, te) +
    '<table class="tbl"><tbody><tr class="tot"><td>' + t('totalAssets') + '</td>' + N(money(ta, false)) + '</tr><tr class="tot"><td>' + t('totalLiabEq') + '</td>' + N(money(tl + te, false)) + '</tr></tbody></table>' +
    '<p class="' + (ok ? 'ok' : 'bad') + '">' + (ok ? t('balanced') : t('notBalanced')) + '</p>';
  return { title: t('rBS'), html: c.html + repWrap(t('rBS'), t('asAt') + ' ' + bsLabel(c.upto), body) };
};
