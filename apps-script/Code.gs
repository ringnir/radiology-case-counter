/**
 * 専門医症例カウンター（複数人管理版） サーバー側コード
 *
 * 【最初にやること】
 *  1. 下の「★設定」の2か所（管理者パスコード・招待コード）を書き換える
 *  2. 上のメニューで関数「setup」を選び、実行（初回は権限の承認が必要）
 *  3. デプロイ → 新しいデプロイ → 種類「ウェブアプリ」
 *       次のユーザーとして実行: 自分 ／ アクセスできるユーザー: 全員
 *  4. 表示されたURLを、Googleサイトの「埋め込み」→「URL」に貼る
 *
 * 【更新するとき】 Code.gs と Index.html を新しい内容に差し替え → 関数「setup」をもう一度実行
 *   → デプロイ → デプロイを管理 → 鉛筆アイコン → バージョン「新バージョン」→ デプロイ（URLは変わりません）
 *
 * データはこのスクリプトと同じGoogleアカウントのドライブに作られる
 * スプレッドシート「専門医症例カウンター_データ…」に保存されます。
 */

// ★設定（ここだけ書き換えてください）★★★★★★★★★★★★★★★★★★★★★★★★
const ADMIN_PASSCODE = '';   // 管理者パスコード（8文字以上）
const JOIN_CODE = '';        // 招待コード（メンバーが新規登録するときの合言葉・6文字以上）
// ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★

const APP_TITLE = '専門医症例カウンター';
const DB_NAME = APP_TITLE + '_データ（直接編集しないでください）';
const SH_MEMBERS = 'members', SH_DOCS = 'docs', SH_CONFIG = 'config';
const HEAD_MEMBERS = ['id', '氏名', 'nameKey', 'salt', 'hash', '登録日時', '最終ログイン'];
const CHUNK = 40000;            // 1セルあたりの最大文字数（上限50000未満）
const MAXCH = 16;               // 1ドキュメントを分割できるセル数（1か月分の症例が約640,000文字まで）
const DOC_W = 4 + MAXCH;
const HEAD_DOCS = ['key', 'member', 'doc', 'updated'].concat(Array.from({length: MAXCH}, (_, i) => 'c' + (i + 1)));
const TOKEN_DAYS = 30;
const MAX_FAILS = 5;            // この回数失敗したら15分ロック
const VIEW_SHEETS = ['全員サマリ', '全員症例一覧'];

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle(APP_TITLE)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/** 最初に1回だけ、エディタから実行します。データ用スプレッドシートを作ります。 */
function setup() {
  const lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    const p = PropertiesService.getScriptProperties();
    let ss = null;
    const id = p.getProperty('SS_ID');
    if (id) { try { ss = SpreadsheetApp.openById(id); } catch (e) { ss = null; } }
    if (!ss) { ss = SpreadsheetApp.create(DB_NAME); p.setProperty('SS_ID', ss.getId()); }
    ensureSheet_(ss, SH_MEMBERS, HEAD_MEMBERS);
    ensureSheet_(ss, SH_DOCS, HEAD_DOCS);
    ensureSheet_(ss, SH_CONFIG, ['k', 'v']);
    if (!p.getProperty('SECRET')) p.setProperty('SECRET', Utilities.getUuid() + Utilities.getUuid());
    const first = ss.getSheetByName('シート1');
    if (first && ss.getSheets().length > 1 && first.getLastRow() === 0) ss.deleteSheet(first);
    const msg = configured_()
      ? '準備ができました。次はデプロイ（ウェブアプリ）に進んでください。データ保存先: ' + ss.getUrl()
      : '先に、このファイル上部の ADMIN_PASSCODE と JOIN_CODE を書き換えてから、もう一度 setup を実行してください。';
    Logger.log(msg);
    return msg;
  } finally {
    lock.releaseLock();
  }
}

/* ============================ 基本ヘルパー ============================ */

function err_(code) { return new Error('E:' + code); }

function configured_() {
  return String(ADMIN_PASSCODE).length >= 8 && String(JOIN_CODE).length >= 6;
}

function ensureSheet_(ss, name, head) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getMaxColumns() < head.length) sh.insertColumnsAfter(sh.getMaxColumns(), head.length - sh.getMaxColumns());
  sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).setNumberFormat('@');
  sh.getRange(1, 1, 1, head.length).setValues([head]);
  sh.setFrozenRows(1);
  return sh;
}

function ss_() {
  const id = PropertiesService.getScriptProperties().getProperty('SS_ID');
  if (!id) throw err_('not_setup');
  try { return SpreadsheetApp.openById(id); } catch (e) { throw err_('not_setup'); }
}

function sheet_(name) {
  const sh = ss_().getSheetByName(name);
  if (!sh) throw err_('not_setup');
  return sh;
}

function ensureRows_(sh, upto) {
  if (sh.getMaxRows() < upto) sh.insertRowsAfter(sh.getMaxRows(), upto - sh.getMaxRows());
}
/** 末尾に行を追加（シートの行数が足りなければ増やす） */
function appendRows_(sh, rows, w) {
  const start = Math.max(sh.getLastRow(), 1) + 1;
  ensureRows_(sh, start + rows.length - 1);
  const rg = sh.getRange(start, 1, rows.length, w);
  rg.setNumberFormat('@');
  rg.setValues(rows);
}

function secret_() {
  const s = PropertiesService.getScriptProperties().getProperty('SECRET');
  if (!s) throw err_('not_setup');
  return s;
}

function locked_(fn) {
  const lock = LockService.getScriptLock();
  try { lock.waitLock(25000); } catch (e) { throw err_('busy'); }
  try { return fn(); } finally { lock.releaseLock(); }
}

function hex_(bytes) {
  return bytes.map(function (b) { return ('0' + (b & 255).toString(16)).slice(-2); }).join('');
}
function sha_(s) {
  return hex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8));
}
function eq_(a, b) {
  a = String(a); b = String(b);
  let d = a.length ^ b.length;
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) d |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return d === 0;
}

/* ---- ログイン試行の制限 ---- */
function lockKey_(s) { return 'lf:' + sha_(String(s)).slice(0, 24); }
function throttle_(key) {
  if (Number(CacheService.getScriptCache().get(key) || 0) >= MAX_FAILS) throw err_('locked');
}
function fail_(key) {
  const c = CacheService.getScriptCache();
  c.put(key, String(Number(c.get(key) || 0) + 1), 900);
}
function clearFail_(key) { CacheService.getScriptCache().remove(key); }

/* ---- トークン（ログイン状態） ---- */
function sign_(payload) {
  return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(payload, secret_()));
}
function mkToken_(memberId, admin) {
  const p = Utilities.base64EncodeWebSafe(
    JSON.stringify({ m: memberId || '', a: admin ? 1 : 0, e: Date.now() + TOKEN_DAYS * 86400000 }),
    Utilities.Charset.UTF_8);
  return p + '.' + sign_(p);
}
function parseToken_(t) {
  if (typeof t !== 'string' || t.length > 600) throw err_('auth');
  const i = t.lastIndexOf('.');
  if (i < 1) throw err_('auth');
  const p = t.slice(0, i);
  if (!eq_(t.slice(i + 1), sign_(p))) throw err_('auth');
  let c;
  try { c = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(p)).getDataAsString()); } catch (e) { throw err_('auth'); }
  if (!c || typeof c.e !== 'number' || c.e < Date.now()) throw err_('auth');
  return { m: String(c.m || ''), a: c.a === 1 };
}
/** トークンを検証し、会員が実在することも確認する */
function auth_(token, needAdmin) {
  needAdmin = needAdmin === true;
  if (!configured_()) throw err_('not_configured');
  const c = parseToken_(token);
  if (needAdmin && !c.a) throw err_('forbidden');
  let member = null;
  if (c.m) {
    member = readMembers_().filter(function (x) { return x.id === c.m; })[0] || null;
    if (!member) throw err_('auth');
  }
  return { m: c.m, a: c.a, member: member };
}

/* ---- 会員 ---- */
function normName_(s) { return String(s || '').normalize('NFKC').replace(/[\s　]+/g, '').toLowerCase(); }
function cleanName_(s) {
  s = String(s || '').replace(/[\u0000-\u001f\u007f]/g, '').replace(/[\s　]+/g, ' ').trim();
  if (!s || s.length > 24) throw err_('bad_name');
  return s;
}
function checkPass_(p, min) {
  p = String(p == null ? '' : p);
  if (p.length < (min || 6) || p.length > 64) throw err_('weak');
  return p;
}
function readMembers_() {
  const sh = sheet_(SH_MEMBERS);
  const last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, HEAD_MEMBERS.length).getValues().map(function (r, i) {
    return { id: String(r[0]), name: String(r[1]), nk: String(r[2]), salt: String(r[3]), hash: String(r[4]),
      created: String(r[5]), seen: String(r[6]), row: i + 2 };
  }).filter(function (m) { return m.id; });
}
function memberOut_(m) { return { id: m.id, name: m.name }; }

/* ---- ドキュメント（月ごと・設定）の保存 ---- */
function readDocRows_(onlyMember, onlyDocs) {
  const sh = sheet_(SH_DOCS);
  const last = sh.getLastRow();
  if (last < 2) return [];
  const keys = sh.getRange(2, 1, last - 1, 4).getValues();      // key, member, doc, updated だけを先に読む
  const hit = [];
  keys.forEach(function (r, i) {
    if (!r[0]) return;
    if (onlyMember && String(r[1]) !== onlyMember) return;
    if (onlyDocs && onlyDocs.indexOf(String(r[2])) < 0) return;
    hit.push({ row: i + 2, m: String(r[1]), doc: String(r[2]), upd: String(r[3]), json: '' });
  });
  let i = 0;                                                    // 必要な行だけ、連続する行はまとめて読む
  while (i < hit.length) {
    let j = i;
    while (j + 1 < hit.length && hit[j + 1].row === hit[j].row + 1) j++;
    const vals = sh.getRange(hit[i].row, 5, j - i + 1, MAXCH).getValues();
    for (let k = i; k <= j; k++) hit[k].json = vals[k - i].join('');
    i = j + 1;
  }
  return hit;
}
function writeDocs_(mid, docs) {
  const sh = sheet_(SH_DOCS);
  const last = sh.getLastRow();
  const keys = last > 1 ? sh.getRange(2, 1, last - 1, 1).getValues().map(function (r) { return String(r[0]); }) : [];
  const rowOf = {};
  keys.forEach(function (k, i) { rowOf[k] = i + 2; });
  const now = new Date().toISOString();
  const appends = [], dels = [];
  Object.keys(docs).forEach(function (doc) {
    const key = mid + '|' + doc, v = docs[doc];
    if (v === null) { if (rowOf[key]) dels.push(rowOf[key]); return; }
    const row = [key, mid, doc, now];
    for (let i = 0; i < MAXCH; i++) row.push(v.substr(i * CHUNK, CHUNK));
    if (rowOf[key]) {
      const rg = sh.getRange(rowOf[key], 1, 1, DOC_W);
      rg.setNumberFormat('@'); rg.setValues([row]);
    } else appends.push(row);
  });
  if (appends.length) appendRows_(sh, appends, DOC_W);
  dels.sort(function (a, b) { return b - a; }).forEach(function (r) { sh.deleteRow(r); });
}
function validDocs_(docs) {
  if (!docs || typeof docs !== 'object' || Array.isArray(docs)) throw err_('bad_request');
  const keys = Object.keys(docs);
  if (keys.length > 60) throw err_('bad_request');
  keys.forEach(function (k) {
    if (!/^(m-\d{4}-\d{2}|settings|summary)$/.test(k)) throw err_('bad_request');
    const v = docs[k];
    if (v === null) return;
    if (typeof v !== 'string' || v.length > CHUNK * MAXCH) throw err_('too_large');
    let j;
    try { j = JSON.parse(v); } catch (e) { throw err_('bad_request'); }
    if (!j || typeof j !== 'object' || Array.isArray(j)) throw err_('bad_request');
  });
}

/* ============================ 公開API（ページから呼ばれる） ============================ */

function api_ping() {
  let ready = true, url = '';
  try { ss_(); } catch (e) { ready = false; }
  try { url = ScriptApp.getService().getUrl() || ''; } catch (e) {}
  return { ok: true, configured: configured_(), ready: ready, url: url };
}

function api_register(name, pass, join) {
  if (!configured_()) throw err_('not_configured');
  const jk = lockKey_('join');
  throttle_(jk);
  if (!eq_(String(join || '').trim(), JOIN_CODE)) { fail_(jk); throw err_('join'); }
  name = cleanName_(name);
  pass = checkPass_(pass, 6);
  return locked_(function () {
    const nk = normName_(name);
    const list = readMembers_();
    if (list.some(function (m) { return m.nk === nk; })) throw err_('name_taken');
    if (list.length >= 500) throw err_('full');
    const id = 'u' + Utilities.getUuid().replace(/-/g, '').slice(0, 12);
    const salt = Utilities.getUuid().replace(/-/g, '');
    const now = new Date().toISOString();
    appendRows_(sheet_(SH_MEMBERS), [[id, name, nk, salt, sha_(salt + pass), now, now]], HEAD_MEMBERS.length);
    return { token: mkToken_(id, false), me: { id: id, name: name }, admin: false };
  });
}

function api_login(name, pass) {
  if (!configured_()) throw err_('not_configured');
  const nk = normName_(name);
  if (!nk) throw err_('login');
  const key = lockKey_('n:' + nk);
  throttle_(key);
  const m = readMembers_().filter(function (x) { return x.nk === nk; })[0];
  if (!m || !eq_(sha_(m.salt + String(pass == null ? '' : pass)), m.hash)) { fail_(key); throw err_('login'); }
  clearFail_(key);
  touch_(m, true);
  return { token: mkToken_(m.id, false), me: memberOut_(m), admin: false };
}

function api_adminLogin(pass) {
  if (!configured_()) throw err_('not_configured');
  const key = lockKey_('admin');
  throttle_(key);
  if (!eq_(String(pass == null ? '' : pass), ADMIN_PASSCODE)) { fail_(key); throw err_('login'); }
  clearFail_(key);
  return { token: mkToken_('', true), me: null, admin: true };
}

/** ログイン中のメンバーが、管理者パスコードで管理者権限も得る */
function api_upgrade(token, pass) {
  const c = auth_(token, false);
  const key = lockKey_('admin');
  throttle_(key);
  if (!eq_(String(pass == null ? '' : pass), ADMIN_PASSCODE)) { fail_(key); throw err_('login'); }
  clearFail_(key);
  return { token: mkToken_(c.m, true), me: c.member ? memberOut_(c.member) : null, admin: true };
}

function touch_(m, force) {
  const t = Date.parse(m.seen) || 0;
  if (!force && Date.now() - t < 600000) return;
  try {
    const rg = sheet_(SH_MEMBERS).getRange(m.row, 7);
    rg.setNumberFormat('@'); rg.setValue(new Date().toISOString());
  } catch (e) {}
}

/** 自分のデータと、共通の疾患リストを返す */
function api_load(token) {
  const c = auth_(token, false);
  const out = { me: c.member ? memberOut_(c.member) : null, admin: c.a, docs: {} };
  if (c.m) {
    readDocRows_(c.m, null).forEach(function (d) { out.docs[d.doc] = d.json; });
    touch_(c.member, false);
  }
  return out;
}

function api_save(token, docs) {
  const c = auth_(token, false);
  if (!c.m) throw err_('no_member');
  validDocs_(docs);
  locked_(function () { writeDocs_(c.m, docs); });
  return { ok: true, t: Date.now() };
}

function api_changePass(token, oldPass, newPass) {
  const c = auth_(token, false);
  if (!c.m) throw err_('no_member');
  const key = lockKey_('n:' + c.member.nk);
  throttle_(key);
  if (!eq_(sha_(c.member.salt + String(oldPass == null ? '' : oldPass)), c.member.hash)) { fail_(key); throw err_('login'); }
  newPass = checkPass_(newPass, 6);
  locked_(function () { setPass_(c.m, newPass); });
  return { ok: true };
}

function setPass_(id, pass) {
  const m = readMembers_().filter(function (x) { return x.id === id; })[0];
  if (!m) throw err_('not_found');
  const salt = Utilities.getUuid().replace(/-/g, '');
  const rg = sheet_(SH_MEMBERS).getRange(m.row, 4, 1, 2);
  rg.setNumberFormat('@'); rg.setValues([[salt, sha_(salt + pass)]]);
}

/* ---------------- 管理者用 ---------------- */

/** 全員の一覧用。設定（settings）と集計（summary）だけを返す（症例そのものは返さない） */
function api_adminAll(token) {
  auth_(token, true);
  const by = {}, order = [];
  readMembers_().forEach(function (m) {
    by[m.id] = { id: m.id, name: m.name, created: m.created, seen: m.seen, upd: '', docs: {} };
    order.push(m.id);
  });
  readDocRows_(null, ['settings', 'summary']).forEach(function (d) {
    const b = by[d.m];
    if (!b) return;
    b.docs[d.doc] = d.json;
    if (d.upd > b.upd) b.upd = d.upd;
  });
  return { members: order.map(function (id) { return by[id]; }) };
}

/** 1人分の全記録（その人を開くとき・全員出力のとき） */
function api_adminMember(token, memberId) {
  auth_(token, true);
  const m = readMembers_().filter(function (x) { return x.id === String(memberId); })[0];
  if (!m) throw err_('not_found');
  const docs = {};
  readDocRows_(m.id, null).forEach(function (d) { docs[d.doc] = d.json; });
  return { id: m.id, name: m.name, docs: docs };
}

function api_adminSetPass(token, memberId, newPass) {
  auth_(token, true);
  newPass = checkPass_(newPass, 6);
  locked_(function () { setPass_(String(memberId), newPass); });
  clearFail_(lockKey_('n:' + ((readMembers_().filter(function (x) { return x.id === memberId; })[0] || {}).nk || '')));
  return { ok: true };
}

function api_adminRename(token, memberId, name) {
  auth_(token, true);
  name = cleanName_(name);
  return locked_(function () {
    const nk = normName_(name);
    const list = readMembers_();
    const m = list.filter(function (x) { return x.id === memberId; })[0];
    if (!m) throw err_('not_found');
    if (list.some(function (x) { return x.id !== memberId && x.nk === nk; })) throw err_('name_taken');
    const rg = sheet_(SH_MEMBERS).getRange(m.row, 2, 1, 2);
    rg.setNumberFormat('@'); rg.setValues([[name, nk]]);
    return { ok: true, name: name };
  });
}

function api_adminDelete(token, memberId) {
  auth_(token, true);
  return locked_(function () {
    const m = readMembers_().filter(function (x) { return x.id === memberId; })[0];
    if (!m) throw err_('not_found');
    const sh = sheet_(SH_DOCS);
    const last = sh.getLastRow();
    if (last > 1) {
      const rows = sh.getRange(2, 2, last - 1, 1).getValues();
      const dels = [];
      rows.forEach(function (r, i) { if (String(r[0]) === memberId) dels.push(i + 2); });
      dels.sort(function (a, b) { return b - a; }).forEach(function (r) { sh.deleteRow(r); });
    }
    sheet_(SH_MEMBERS).deleteRow(m.row);
    return { ok: true };
  });
}

/** 全員分の一覧をスプレッドシートのシートとして書き出し、URLを返す（確認・印刷用） */
function api_adminWriteSheet(token, name, rows) {
  auth_(token, true);
  if (VIEW_SHEETS.indexOf(name) < 0) throw err_('bad_request');
  if (!Array.isArray(rows) || rows.length < 1 || rows.length > 40000) throw err_('bad_request');
  let w = 1;
  rows.forEach(function (r) { if (!Array.isArray(r)) throw err_('bad_request'); if (r.length > w) w = r.length; });
  if (w > 60) throw err_('bad_request');
  const data = rows.map(function (r) {
    const o = [];
    for (let i = 0; i < w; i++) {
      let v = r[i];
      if (typeof v === 'number' && isFinite(v)) { o.push(v); continue; }
      v = v == null ? '' : String(v).slice(0, 500);
      o.push(/^[=+\-@]/.test(v) ? "'" + v : v);
    }
    return o;
  });
  return locked_(function () {
    const ss = ss_();
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    sh.clear();
    if (sh.getMaxColumns() < w) sh.insertColumnsAfter(sh.getMaxColumns(), w - sh.getMaxColumns());
    if (sh.getMaxRows() < data.length) sh.insertRowsAfter(sh.getMaxRows(), data.length - sh.getMaxRows());
    sh.getRange(1, 1, data.length, w).setValues(data);
    sh.setFrozenRows(1);
    return { url: ss.getUrl() + '#gid=' + sh.getSheetId() };
  });
}
