'use strict';
/* ========== Online: phone + PIN login, automatic sync to the cooperative's Google Sheet ========== */
const CLOUD_KINDS = ['milk', 'prod', 'feed', 'txns', 'ins', 'animals', 'bills'];
const cloud = () => (S.cloud = S.cloud || { phone: '', token: '', name: '', synced: {}, profileHash: '', lastSync: '', lastError: '', url: '' });
const cloudUrl = () => (typeof CLOUD_URL !== 'undefined' && CLOUD_URL) || cloud().url || '';
const loggedIn = () => !!(cloud().token && cloud().phone);

function strHash(s) { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36) + s.length.toString(36); }

// Readable columns for the Google Sheet (the full record is also stored for restoring)
function cloudView(kind, r) {
  const sh = x => (x === 'e' ? 'Evening' : 'Morning');
  const an = id => { const a = byId('animals', id); return a ? (a.name || '') + (a.tag ? ' (' + a.tag + ')' : '') : 'All animals'; };
  switch (kind) {
    case 'milk': return { date: r.date, shift: sh(r.shift), liters: +r.liters || 0, fat: +r.fat || 0, rate: +r.rate || 0, amount: +r.amount || 0, buyer: r.buyer || '', paid_by: r.method || '' };
    case 'prod': return { date: r.date, shift: sh(r.shift), animal: an(r.animalId), liters: +r.liters || 0 };
    case 'feed': return { date: r.date, animal: an(r.animalId), item: r.item || '', qty: +r.qty || 0, unit: r.unit || '', cost: +r.cost || 0, paid_by: r.method || '' };
    case 'txns': { const d = TXN[r.type] || {}; return { date: r.date, type: d.name ? d.name[0] : r.type, in_out: d.dir === 'in' ? 'In' : 'Out', amount: +r.amount || 0, paid_by: r.method || '', party: r.party || '', note: r.note || '' }; }
    case 'ins': return { insured: r.what || '', company: r.company || '', policy: r.policy || '', start: r.start || '', expiry: r.expiry || '', sum_insured: +r.sum || 0, premium: +r.premium || 0, renewed: r.renewedBy ? 'yes' : '' };
    case 'animals': return { animal_type: r.type || '', name: r.name || '', tag: r.tag || '', breed: r.breed || '', status: r.status || '', active: r.active === false ? 'no' : 'yes' };
    case 'bills': return { date: r.date, title: r.title || '', amount: +r.amount || 0 };
  }
  return {};
}
function cloudProfile() {
  const st = S.settings;
  return { name: st.name || '', json: { settings: { name: st.name, sellFatRate: st.sellFatRate, sellAddM: st.sellAddM, sellAddE: st.sellAddE, lang: st.lang }, opening: S.opening } };
}
// Work out what changed since the last successful sync
function cloudChanges() {
  const c = cloud(); const up = {}, del = {}; const seen = {}; let n = 0;
  CLOUD_KINDS.forEach(kind => {
    (S[kind] || []).forEach(r => {
      const k = kind + ':' + r.id; seen[k] = 1;
      const h = strHash(JSON.stringify(r) + '|' + JSON.stringify(cloudView(kind, r)));
      if (c.synced[k] !== h) { (up[kind] = up[kind] || []).push({ id: r.id, view: cloudView(kind, r), rec: r, _h: h }); n++; }
    });
  });
  Object.keys(c.synced).forEach(k => { if (!seen[k]) { const [kind, id] = [k.slice(0, k.indexOf(':')), k.slice(k.indexOf(':') + 1)]; (del[kind] = del[kind] || []).push(id); n++; } });
  const prof = cloudProfile(); const ph = strHash(JSON.stringify(prof));
  return { up, del, n, profile: c.profileHash !== ph ? prof : null, profileHash: ph };
}
const pendingCount = () => (loggedIn() ? cloudChanges().n : 0);

async function cloudCall(body) {
  const url = cloudUrl(); if (!url) throw new Error('no_url');
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body), redirect: 'follow' });
  const txt = await r.text(); let j;
  try { j = JSON.parse(txt); } catch (e) { throw new Error('bad_response'); }
  return j;
}

let syncing = false, syncTimer = null;
function scheduleSync(ms = 4000) { if (!loggedIn()) return; clearTimeout(syncTimer); syncTimer = setTimeout(() => cloudSync(), ms); }
async function cloudSync(manual) {
  if (!loggedIn() || syncing) return false;
  if (!navigator.onLine) { if (manual) toast('📵 ' + t('offline')); return false; }
  syncing = true; const c = cloud();
  try {
    let ch = cloudChanges();
    if (!ch.n && !ch.profile) { c.lastSync = new Date().toISOString(); c.lastError = ''; persist(); if (manual) toast('☁️ ✔'); return true; }
    // send in batches of up to 200 records
    const kinds = Object.keys(ch.up); let first = true;
    const batches = []; let cur = { up: {}, n: 0 };
    kinds.forEach(k => ch.up[k].forEach(it => { if (cur.n >= 200) { batches.push(cur); cur = { up: {}, n: 0 }; } (cur.up[k] = cur.up[k] || []).push(it); cur.n++; }));
    batches.push(cur);
    for (const b of batches) {
      const body = { action: 'sync', phone: c.phone, token: c.token, version: APP_VERSION, upserts: {}, deletes: first ? ch.del : {}, profile: first ? ch.profile : null };
      Object.keys(b.up).forEach(k => body.upserts[k] = b.up[k].map(({ id, view, rec }) => ({ id, view, rec })));
      const res = await cloudCall(body);
      if (!res.ok) { if (res.error === 'auth') { c.token = ''; c.lastError = t('loginAgain'); persist(); toast('🔒 ' + t('loginAgain')); return false; } throw new Error(res.error || 'error'); }
      Object.keys(b.up).forEach(k => b.up[k].forEach(it => { c.synced[k + ':' + it.id] = it._h; }));
      if (first) { Object.keys(ch.del).forEach(k => ch.del[k].forEach(id => delete c.synced[k + ':' + id])); if (ch.profile) c.profileHash = ch.profileHash; first = false; }
      persist();
    }
    c.lastSync = new Date().toISOString(); c.lastError = '';
    persist(); if (manual) toast('☁️ ' + t('synced') + ' ✔');
    return true;
  } catch (e) {
    c.lastError = e.message === 'no_url' ? t('noServer') : t('syncFailed'); persist();
    if (manual) toast('⚠️ ' + c.lastError);
    return false;
  } finally { syncing = false; if (parseHash()[0] === 'cloud' || parseHash()[0] === 'home') refreshCloudBadge(); }
}
function refreshCloudBadge() { const el = $('#cloudbadge'); if (el) el.outerHTML = cloudBadge(); }
function cloudBadge() {
  if (!loggedIn()) return cloud().phone && cloud().lastError ? '<a id="cloudbadge" class="cloudbadge err" href="#/cloud">🔒 ' + esc(cloud().lastError) + '</a>' : '<a id="cloudbadge" class="cloudbadge off" href="#/cloud">☁️ ' + t('notOnline') + '</a>';
  const c = cloud(); const p = pendingCount();
  const when = c.lastSync ? new Date(c.lastSync) : null;
  const ago = when ? Math.round((Date.now() - when) / 60000) : null;
  const txt = c.lastError ? '⚠️ ' + c.lastError : p ? '⏳ ' + nd(p) + ' ' + t('pending') : '✔ ' + t('synced') + (ago !== null ? ' · ' + (ago < 1 ? t('justNow') : nd(ago < 60 ? ago : Math.round(ago / 60)) + ' ' + (ago < 60 ? t('minAgo') : t('hrAgo'))) : '');
  return '<a id="cloudbadge" class="cloudbadge ' + (c.lastError ? 'err' : p ? 'wait' : 'ok') + '" href="#/cloud">☁️ ' + txt + '</a>';
}

async function cloudPullMerge() {
  const c = cloud();
  const res = await cloudCall({ action: 'pull', phone: c.phone, token: c.token });
  if (!res.ok) throw new Error(res.error || 'error');
  let added = 0;
  CLOUD_KINDS.forEach(kind => {
    const have = new Set((S[kind] || []).map(r => r.id));
    (res.data[kind] || []).forEach(r => { if (r && r.id && !have.has(r.id)) { S[kind].push(r); added++; } });
  });
  if (res.profile && res.profile.settings) {
    const st = S.settings, ps = res.profile.settings;
    ['sellFatRate', 'sellAddM', 'sellAddE'].forEach(k => { if (!st[k] && ps[k]) st[k] = ps[k]; });
    if (!st.name && ps.name) st.name = ps.name;
    if (res.profile.opening && !Object.values(S.opening).some(v => toNum(v))) S.opening = Object.assign(S.opening, res.profile.opening);
  }
  persist(); return added;
}

/* ---------- Online screen ---------- */
R.cloud = () => {
  const c = cloud();
  const urlBox = (typeof CLOUD_URL !== 'undefined' && CLOUD_URL) ? '' :
    '<details class="card"><summary class="lb">⚙️ ' + t('serverAddr') + '</summary>' + txtIn('url', t('serverAddr'), c.url, 'inputmode="url" placeholder="https://script.google.com/macros/s/…/exec"') + '<button type="button" class="btn grey" id="saveurl">' + t('save') + '</button></details>';
  if (!loggedIn()) {
    return {
      title: '☁️ ' + t('online'),
      html: '<div class="card"><p class="help">☁️ ' + t('onlineHelp') + '</p></div>' +
        (c.lastError ? '<div class="alert orange">' + esc(c.lastError) + '</div>' : '') +
        '<form id="f" class="card" onsubmit="return false">' +
        choice('mode', [{ v: 'login', icon: '🔑', label: t('loginBtn') }, { v: 'register', icon: '🆕', label: t('registerBtn') }], 'login', 'two') +
        txtIn('phone', '📞 ' + t('phone'), c.phone || '', 'inputmode="tel" autocomplete="tel"') +
        '<div id="nm" hidden>' + txtIn('name', '👤 ' + t('name'), S.settings.name) + '</div>' +
        fld('🔢 ' + t('pin4'), '<input class="inp num pin" name="pin" inputmode="numeric" maxlength="4" autocomplete="off" type="password">') +
        '<div id="pin2" hidden>' + fld('🔢 ' + t('pinAgain'), '<input class="inp num pin" name="pin2" inputmode="numeric" maxlength="4" autocomplete="off" type="password">') + '</div>' +
        '<button class="btn big green" id="go">✔ ' + t('loginBtn') + '</button></form>' + urlBox,
      after() {
        const f = $('#f');
        const mode = () => vals(f).mode;
        f.addEventListener('change', e => { if (e.target.name === 'mode') { const reg = mode() === 'register'; $('#nm').hidden = !reg; $('#pin2').hidden = !reg; $('#go').textContent = '✔ ' + (reg ? t('registerBtn') : t('loginBtn')); } });
        const su = $('#saveurl'); if (su) su.onclick = () => { c.url = ($('input[name=url]').value || '').trim(); c.lastError = ''; persist(); toast(t('saved')); };
        $('#go').onclick = async () => {
          const v = vals(f); const phone = String(v.phone).replace(/[०-९]/g, d => DEV.indexOf(d)).replace(/\D/g, ''); const pin = String(v.pin).replace(/[०-९]/g, d => DEV.indexOf(d));
          if (phone.length < 7) { toast(t('required') + ': ' + t('phone')); f.phone.focus(); return; }
          if (!/^\d{4}$/.test(pin)) { toast(t('pin4')); f.pin.focus(); return; }
          const reg = mode() === 'register';
          if (reg && !v.name.trim()) { toast(t('required') + ': ' + t('name')); f.name.focus(); return; }
          if (reg && String(v.pin2).replace(/[०-९]/g, d => DEV.indexOf(d)) !== pin) { toast(t('pinMismatch')); return; }
          if (!cloudUrl()) { toast('⚠️ ' + t('noServer')); return; }
          if (!navigator.onLine) { toast('📵 ' + t('offline')); return; }
          $('#go').disabled = true; $('#go').textContent = '⏳ …';
          try {
            const res = await cloudCall(reg ? { action: 'register', phone, pin, name: v.name.trim(), version: APP_VERSION } : { action: 'login', phone, pin });
            if (!res.ok) { toast('⚠️ ' + t('err_' + res.error)); return; }
            Object.assign(c, { phone, token: res.token, name: res.name, lastError: '' });
            S.settings.name = res.name; // the account's name is the farmer's name
            persist();
            if (!reg) { try { const n = await cloudPullMerge(); if (n) toast('⬇️ ' + nd(n) + ' ' + t('recordsRestored')); } catch (e) {} }
            await cloudSync(); render();
            toast('☁️ ' + t('nowOnline'));
          } catch (e) { toast('⚠️ ' + t('syncFailed')); }
          finally { const b = $('#go'); if (b) { b.disabled = false; b.textContent = '✔ ' + (mode() === 'register' ? t('registerBtn') : t('loginBtn')); } }
        };
      },
    };
  }
  const p = pendingCount();
  return {
    title: '☁️ ' + t('online'),
    html: cloudBadge() + '<div class="card"><div class="amtbox"><span>👤 ' + esc(c.name) + '</span><b style="font-size:1.1rem">📞 ' + nd(c.phone) + '</b></div>' +
      '<div class="amtbox"><span>⏳ ' + t('pending') + '</span><b>' + nd(p) + '</b></div>' +
      '<p class="help">' + t('lastSync') + ': ' + (c.lastSync ? new Date(c.lastSync).toLocaleString('en-GB') : '—') + '</p>' +
      '<button class="btn big green" id="sync">🔄 ' + t('syncNow') + '</button>' +
      '<button class="btn blue" id="pull">⬇️ ' + t('downloadMine') + '</button></div>' +
      '<p class="help">' + t('autoSyncNote') + '</p>' +
      '<button class="btn red" id="logout">🚪 ' + t('logout') + '</button>' + urlBox,
    after() {
      $('#sync').onclick = async () => { await cloudSync(true); render(); };
      $('#pull').onclick = async () => { try { const n = await cloudPullMerge(); toast('⬇️ ' + nd(n) + ' ' + t('recordsRestored')); render(); } catch (e) { toast('⚠️ ' + t('syncFailed')); } };
      $('#logout').onclick = async () => {
        if (pendingCount() && !(await ask(t('logoutPending')))) return;
        Object.assign(c, { token: '', synced: {}, profileHash: '', lastSync: '', lastError: '' }); persist(); render();
      };
      const su = $('#saveurl'); if (su) su.onclick = () => { c.url = ($('input[name=url]').value || '').trim(); persist(); toast(t('saved')); };
    },
  };
};
