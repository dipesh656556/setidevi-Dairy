/**
 * Setidevi Dairy — cloud server (Google Apps Script, attached to one Google Sheet)
 *
 * The phone app sends each farmer's records here; they are stored in the sheet's tabs
 * (Farmers, Milk, Production, Feed, Money, Insurance, Animals, Bills, Profiles).
 * The admin dashboard (Dashboard.html) is served by doGet().
 *
 * Setup: see SETUP-GUIDE.md. Deploy as Web app → Execute as: Me → Who has access: Anyone.
 */

var APP = 'setidevi-dairy';
var MAX_FAILS = 5;            // wrong PIN tries before a short lock
var LOCK_MINUTES = 15;

// One sheet per kind of record. `cols` are the readable columns shown in the sheet.
var SCHEMA = {
  milk:    { sheet: 'Milk',       cols: ['date', 'shift', 'liters', 'fat', 'rate', 'amount', 'buyer', 'paid_by'] },
  prod:    { sheet: 'Production', cols: ['date', 'shift', 'animal', 'liters'] },
  feed:    { sheet: 'Feed',       cols: ['date', 'animal', 'item', 'qty', 'unit', 'cost', 'paid_by'] },
  txns:    { sheet: 'Money',      cols: ['date', 'type', 'in_out', 'amount', 'paid_by', 'party', 'note'] },
  ins:     { sheet: 'Insurance',  cols: ['insured', 'company', 'policy', 'start', 'expiry', 'sum_insured', 'premium', 'renewed'] },
  animals: { sheet: 'Animals',    cols: ['animal_type', 'name', 'tag', 'breed', 'status', 'active'] },
  bills:   { sheet: 'Bills',      cols: ['date', 'title', 'amount'] },
};
var FARMER_COLS = ['phone', 'name', 'pin_hash', 'salt', 'token', 'created', 'last_sync', 'active', 'fails', 'locked_until', 'app_version'];
var PROFILE_COLS = ['phone', 'name', 'updated', 'json'];

/* ------------------------------------------------------------------ helpers */
function ss_() { return SpreadsheetApp.getActiveSpreadsheet(); }
function now_() { return new Date().toISOString(); }
function txt_(v) { return (typeof v === 'string' && v !== '') ? "'" + v : v; } // keep text as text (no auto date)
function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

function sheet_(name, headers) {
  var ss = ss_();
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold').setBackground('#e7f5ec');
    sh.setFrozenRows(1);
  }
  return sh;
}
function dataHeaders_(kind) { return ['key', 'phone', 'farmer'].concat(SCHEMA[kind].cols).concat(['updated', 'json']); }
function farmersSheet_() { return sheet_('Farmers', FARMER_COLS); }
function rows_(sh) {
  var last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, sh.getLastColumn()).getValues();
}
function findFarmer_(phone) {
  var sh = farmersSheet_(); var rows = rows_(sh);
  for (var i = 0; i < rows.length; i++) if (String(rows[i][0]) === String(phone)) return { sh: sh, row: i + 2, v: rows[i] };
  return null;
}
function hash_(salt, pin) {
  var raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + ':' + pin, Utilities.Charset.UTF_8);
  return Utilities.base64Encode(raw);
}
function cleanPhone_(p) { return String(p || '').replace(/[०-९]/g, function (d) { return '०१२३४५६७८९'.indexOf(d); }).replace(/\D/g, ''); }
function validPin_(p) { return /^\d{4}$/.test(String(p || '')); }

/* ------------------------------------------------------------------ web entry points */
function doGet(e) {
  if (e && e.parameter && e.parameter.ping) return out_({ ok: true, app: APP, time: now_() });
  return HtmlService.createHtmlOutputFromFile('Dashboard')
    .setTitle('Setidevi Dairy — Admin')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function doPost(e) {
  var req;
  try { req = JSON.parse(e.postData.contents); } catch (err) { return out_({ ok: false, error: 'bad_request' }); }
  try {
    switch (req.action) {
      case 'register': return out_(register_(req));
      case 'login':    return out_(login_(req));
      case 'sync':     return out_(sync_(req));
      case 'pull':     return out_(pull_(req));
      case 'ping':     return out_({ ok: true });
      default:         return out_({ ok: false, error: 'unknown_action' });
    }
  } catch (err) {
    return out_({ ok: false, error: 'server', message: String(err && err.message || err) });
  }
}

/* ------------------------------------------------------------------ farmer accounts */
function register_(req) {
  var phone = cleanPhone_(req.phone), pin = String(req.pin || ''), name = String(req.name || '').trim();
  if (phone.length < 7) return { ok: false, error: 'bad_phone' };
  if (!validPin_(pin)) return { ok: false, error: 'bad_pin' };
  if (!name) return { ok: false, error: 'no_name' };
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    if (findFarmer_(phone)) return { ok: false, error: 'exists' };
    var salt = Utilities.getUuid(), token = Utilities.getUuid();
    farmersSheet_().appendRow([txt_(phone), txt_(name), hash_(salt, pin), salt, token, now_(), '', 'yes', 0, '', txt_(String(req.version || ''))]);
    return { ok: true, token: token, name: name, phone: phone };
  } finally { lock.releaseLock(); }
}

function login_(req) {
  var phone = cleanPhone_(req.phone), pin = String(req.pin || '');
  var f = findFarmer_(phone);
  if (!f) return { ok: false, error: 'not_found' };
  var v = f.v; // phone,name,pin_hash,salt,token,created,last_sync,active,fails,locked_until
  if (String(v[7]) === 'no') return { ok: false, error: 'disabled' };
  if (v[9] && new Date(v[9]) > new Date()) return { ok: false, error: 'locked' };
  if (hash_(v[3], pin) !== v[2]) {
    var fails = (Number(v[8]) || 0) + 1;
    f.sh.getRange(f.row, 9, 1, 2).setValues([[fails >= MAX_FAILS ? 0 : fails, fails >= MAX_FAILS ? new Date(Date.now() + LOCK_MINUTES * 60000).toISOString() : '']]);
    return { ok: false, error: fails >= MAX_FAILS ? 'locked' : 'wrong_pin' };
  }
  var token = v[4] || Utilities.getUuid();
  f.sh.getRange(f.row, 5).setValue(token);
  f.sh.getRange(f.row, 9, 1, 2).setValues([[0, '']]);
  return { ok: true, token: token, name: String(v[1]), phone: phone };
}

function auth_(req) {
  var f = findFarmer_(cleanPhone_(req.phone));
  if (!f || !req.token || String(f.v[4]) !== String(req.token)) return null;
  if (String(f.v[7]) === 'no') return null;
  return f;
}

/* ------------------------------------------------------------------ sync from the phone */
// req: { phone, token, version, profile:{name, json}, upserts:{kind:[{id, view:{...}, rec:{...}}]}, deletes:{kind:[id]} }
function sync_(req) {
  var f = auth_(req);
  if (!f) return { ok: false, error: 'auth' };
  var phone = String(f.v[0]), name = String(f.v[1]);
  var lock = LockService.getScriptLock(); lock.waitLock(30000);
  var done = { upserts: 0, deletes: 0 };
  try {
    Object.keys(req.upserts || {}).forEach(function (kind) {
      if (!SCHEMA[kind]) return;
      var list = req.upserts[kind] || []; if (!list.length) return;
      var sh = sheet_(SCHEMA[kind].sheet, dataHeaders_(kind));
      var rows = list.map(function (it) {
        var view = it.view || {};
        return [txt_(phone + ':' + it.id), txt_(phone), txt_(name)]
          .concat(SCHEMA[kind].cols.map(function (c) { return txt_(view[c] === undefined || view[c] === null ? '' : view[c]); }))
          .concat([now_(), txt_(JSON.stringify(it.rec || {}))]);
      });
      upsertRows_(sh, rows); done.upserts += rows.length;
    });
    Object.keys(req.deletes || {}).forEach(function (kind) {
      if (!SCHEMA[kind]) return;
      var ids = req.deletes[kind] || []; if (!ids.length) return;
      var sh = sheet_(SCHEMA[kind].sheet, dataHeaders_(kind));
      done.deletes += deleteKeys_(sh, ids.map(function (id) { return phone + ':' + id; }));
    });
    if (req.profile) {
      var ps = sheet_('Profiles', PROFILE_COLS);
      upsertRows_(ps, [[txt_(phone), txt_(name), now_(), txt_(JSON.stringify(req.profile.json || {}))]]); // the account name (set at registration) stays the farmer's name
    }
    f.sh.getRange(f.row, 7).setValue(now_());
    if (req.version) f.sh.getRange(f.row, 11).setValue(txt_(String(req.version)));
  } finally { lock.releaseLock(); }
  return { ok: true, done: done, time: now_() };
}

function upsertRows_(sh, rows) {
  if (!rows.length) return;
  var existing = rows_(sh), idx = {};
  for (var i = 0; i < existing.length; i++) idx[String(existing[i][0])] = i + 2;
  var appends = [];
  rows.forEach(function (r) {
    var key = String(r[0]).replace(/^'/, '');
    if (idx[key]) sh.getRange(idx[key], 1, 1, r.length).setValues([r]);
    else { appends.push(r); idx[key] = -1; }
  });
  if (appends.length) sh.getRange(sh.getLastRow() + 1, 1, appends.length, appends[0].length).setValues(appends);
}
function deleteKeys_(sh, keys) {
  var want = {}; keys.forEach(function (k) { want[k] = true; });
  var existing = rows_(sh), del = [];
  for (var i = 0; i < existing.length; i++) if (want[String(existing[i][0])]) del.push(i + 2);
  for (var j = del.length - 1; j >= 0; j--) sh.deleteRow(del[j]);
  return del.length;
}

/* ------------------------------------------------------------------ restore to a new phone */
function pull_(req) {
  var f = auth_(req);
  if (!f) return { ok: false, error: 'auth' };
  var phone = String(f.v[0]); var data = {};
  Object.keys(SCHEMA).forEach(function (kind) {
    var sh = ss_().getSheetByName(SCHEMA[kind].sheet); data[kind] = [];
    if (!sh) return;
    var jsonCol = dataHeaders_(kind).length - 1;
    rows_(sh).forEach(function (r) {
      if (String(r[1]) !== phone) return;
      try { data[kind].push(JSON.parse(r[jsonCol])); } catch (e) {}
    });
  });
  var profile = null, ps = ss_().getSheetByName('Profiles');
  if (ps) rows_(ps).forEach(function (r) { if (String(r[0]) === phone) { try { profile = JSON.parse(r[3]); } catch (e) {} } });
  return { ok: true, data: data, profile: profile, name: String(f.v[1]) };
}

/* ------------------------------------------------------------------ admin (called from Dashboard.html) */
function adminCheck_(password) {
  var props = PropertiesService.getScriptProperties();
  var saved = props.getProperty('ADMIN_HASH');
  if (!saved) throw new Error('NO_PASSWORD');
  if (hash_(props.getProperty('ADMIN_SALT'), password) !== saved) throw new Error('WRONG_PASSWORD');
}
function adminStatus() { return { hasPassword: !!PropertiesService.getScriptProperties().getProperty('ADMIN_HASH') }; }
function adminSetPassword(newPassword, oldPassword) {
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty('ADMIN_HASH')) adminCheck_(oldPassword);
  if (!newPassword || String(newPassword).length < 6) throw new Error('SHORT_PASSWORD');
  var salt = Utilities.getUuid();
  props.setProperties({ ADMIN_SALT: salt, ADMIN_HASH: hash_(salt, newPassword) });
  return { ok: true };
}
function adminLogin(password) { adminCheck_(password); return { ok: true }; }

// All records (readable columns only), for the dashboard to analyse.
function adminData(password) {
  adminCheck_(password);
  var res = { farmers: [], time: now_() };
  rows_(farmersSheet_()).forEach(function (r) {
    res.farmers.push({ phone: String(r[0]), name: String(r[1]), created: String(r[5]), lastSync: String(r[6]), active: String(r[7]) !== 'no', version: String(r[10] || '') });
  });
  Object.keys(SCHEMA).forEach(function (kind) {
    var sh = ss_().getSheetByName(SCHEMA[kind].sheet); res[kind] = [];
    if (!sh) return;
    var cols = ['key', 'phone', 'farmer'].concat(SCHEMA[kind].cols);
    rows_(sh).forEach(function (r) {
      var o = {}; cols.forEach(function (c, i) { o[c] = r[i] instanceof Date ? r[i].toISOString() : r[i]; });
      res[kind].push(o);
    });
  });
  return res;
}
function adminResetPin(password, phone, newPin) {
  adminCheck_(password);
  if (!validPin_(newPin)) throw new Error('BAD_PIN');
  var f = findFarmer_(cleanPhone_(phone)); if (!f) throw new Error('NOT_FOUND');
  var salt = Utilities.getUuid();
  f.sh.getRange(f.row, 3, 1, 3).setValues([[hash_(salt, newPin), salt, Utilities.getUuid()]]); // new token → old phones must log in again
  f.sh.getRange(f.row, 9, 1, 2).setValues([[0, '']]);
  return { ok: true };
}
function adminSetActive(password, phone, active) {
  adminCheck_(password);
  var f = findFarmer_(cleanPhone_(phone)); if (!f) throw new Error('NOT_FOUND');
  f.sh.getRange(f.row, 8).setValue(active ? 'yes' : 'no');
  return { ok: true };
}
