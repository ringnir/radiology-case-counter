
/* ---------- state & storage ---------- */
const LS_KEY = 'senmoni-case-counter.v1';
const LS_TRACK = 'senmoni-case-counter.track';
const LS_SESS = 'senmoni-case-counter.sess';
const GASRUN = (typeof google !== 'undefined' && google.script && google.script.run) ? google.script.run : null;
const state = {months:{}, settings:defaultSettings(), mode:'init', ready:false, loaded:false, status:'init', session:null, appUrl:''};
const ui = {
  screen:'auth', view:'progress', cat:'ct', editId:null, logLimit:60, track:'base', pendingDelete:null, restore:null,
  authTab:'login', authErr:'', authBusy:false, ping:null, upg:false,
  all:null, aloading:false, asMember:null, own:null, aq:'', asort:'name', adir:1, mgr:null, mgrMsg:'',
  dzSlot:null, slotQ:'', imp:null, aExpMsg:'', aCohort:'all'
};
try { const t = localStorage.getItem(LS_TRACK); if (t && TRACK_BY[t]) ui.track = t; } catch (e) {}
try { const c = localStorage.getItem('senmoni-case-counter.cohort'); if (c && /^(all|\d{1,4})$/.test(c)) ui.aCohort = c; } catch (e) {}

const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmtN = n => Number(n).toLocaleString('ja-JP');
const getEntries = () => allEntries(state.months);
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const readOnly = () => !!ui.asMember;

let dirty = new Set(), flushing = false, toastT = null, lastLoad = 0;

function putEntry(entry){
  if (readOnly()) return;
  const mk = monthKey(entry.d);
  const body = Object.assign({}, entry); delete body.id;
  (state.months[mk] = state.months[mk] || {})[entry.id] = body;
  dirty.add(mk);
}
function removeEntry(id){
  if (readOnly()) return false;
  for (const mk in state.months) {
    if (state.months[mk][id]) {
      delete state.months[mk][id];
      if (!Object.keys(state.months[mk]).length) delete state.months[mk];
      dirty.add(mk);
      return true;
    }
  }
  return false;
}
function existsId(id){ return Object.keys(state.months).some(mk => !!state.months[mk][id]); }
function saveSettings(){ if (readOnly()) return; dirty.add('settings'); flush(); }

/* ---------- 保存先: ローカル（このブラウザ） ---------- */
function loadLocal(){
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return;
    const j = JSON.parse(raw);
    state.months = cleanMonths(j.months);
    state.settings = sanitizeSettings(j.settings);
  } catch (e) {}
}
function saveLocal(){
  localStorage.setItem(LS_KEY, JSON.stringify({v:1, months:state.months, settings:state.settings}));
}

/* ---------- 保存先: スプレッドシート（Apps Script） ---------- */
function mkErr(e){
  const msg = String((e && e.message) || e || '');
  const m = /E:([a-z_]+)/.exec(msg);
  return {code: m ? m[1] : 'error', message: msg};
}
function rpc(fn){
  const args = Array.prototype.slice.call(arguments, 1);
  return new Promise((resolve, reject) => {
    if (!GASRUN) { reject({code:'no_server', message:'no server'}); return; }
    try {
      const r = GASRUN.withSuccessHandler(resolve).withFailureHandler(e => reject(mkErr(e)));
      r[fn].apply(r, args);
    } catch (e) { reject(mkErr(e)); }
  });
}
function loadSess(){
  try { const j = JSON.parse(localStorage.getItem(LS_SESS) || 'null'); if (j && typeof j.token === 'string') return j; } catch (e) {}
  return null;
}
function saveSess(){
  try {
    if (state.session) localStorage.setItem(LS_SESS, JSON.stringify(state.session));
    else localStorage.removeItem(LS_SESS);
  } catch (e) {}
}
function applyLoad(r){
  const months = {}; let settings = null;
  Object.keys(r.docs || {}).forEach(k => {
    let j = null;
    try { j = JSON.parse(r.docs[k]); } catch (e) { return; }
    if (k === 'settings') settings = j;
    else if (k.indexOf('m-') === 0) months[k] = j;
  });
  state.months = cleanMonths(months);
  state.settings = sanitizeSettings(settings);
  lastLoad = Date.now();
}
function docJson(k){
  if (k === 'settings') return JSON.stringify(state.settings);
  if (k === 'summary') return JSON.stringify(makeSummary(getEntries(), state.settings));      // 管理者の一覧用の集計
  const m = state.months[k];
  return m && Object.keys(m).length ? JSON.stringify(m) : null;
}

const ERR_MSG = {
  login:'氏名またはパスコードが違います。',
  locked:'失敗が続いたため、15分ほど入力できません。しばらくしてからやり直してください。',
  join:'招待コードが違います。',
  name_taken:'その氏名はすでに登録されています。別の表記にするか、ログインしてください。',
  weak:'パスコードは6文字以上にしてください。',
  bad_name:'氏名は1〜24文字で入力してください。',
  not_configured:'管理者の初期設定（管理者パスコードと招待コードの設定）がまだ終わっていません。',
  not_setup:'管理者の初期設定（setup の実行）がまだ終わっていません。',
  busy:'混み合っています。少し待ってからもう一度お試しください。',
  too_large:'データが大きすぎて保存できません。',
  forbidden:'この操作は管理者のみ可能です。',
  full:'登録人数の上限に達しています。',
  not_found:'対象が見つかりません。',
  bad_request:'入力内容を確認してください。',
  no_member:'この操作にはメンバーとしてログインする必要があります。',
  no_server:'サーバーに接続できません。'
};
function errText(e){ return ERR_MSG[e && e.code] || ('エラーが発生しました（' + ((e && (e.code || e.message)) || 'unknown') + '）。'); }

function handleAuthErr(e){
  if (e && e.code === 'auth') { logout('ログインの有効期限が切れました。もう一度ログインしてください。', true); return true; }
  return false;
}

async function flush(){
  if (readOnly()) { dirty.clear(); return; }
  if (state.mode === 'local') {
    dirty.clear();
    try { saveLocal(); setStatus('local'); } catch (e) { setStatus('err'); toast('保存できませんでした。バックアップを保存してください。'); }
    return;
  }
  if (state.mode !== 'gas' || !state.session || !state.session.me) { dirty.clear(); return; }
  if (flushing) return;
  flushing = true; setStatus('busy');
  try {
    while (dirty.size) {
      const keys = Array.from(dirty); dirty.clear();
      let i = 0;
      while (i < keys.length) {                       // 20文書・約3MBずつに分けて送る
        const docs = {}; let size = 0, cnt = 0;
        while (i < keys.length && cnt < 20 && size < 3000000) { const j = docJson(keys[i]); docs[keys[i]] = j; size += j ? j.length : 0; cnt++; i++; }
        if (i >= keys.length) docs.summary = docJson('summary');
        try { await rpc('api_save', state.session.token, docs); }
        catch (e) { keys.slice(i - cnt).forEach(k => dirty.add(k)); throw e; }
      }
    }
    setStatus('ok');
  } catch (e) {
    if (!handleAuthErr(e)) {
      setStatus('err');
      toast('保存できませんでした（' + errText(e).replace(/。$/, '') + '）。「再試行」を押してください。');
    }
  } finally { flushing = false; }
}

async function logout(msg, skipFlush){
  if (!skipFlush && dirty.size && state.mode === 'gas' && state.session) { try { await flush(); } catch (e) {} }
  state.session = null; saveSess();
  state.months = {}; state.settings = defaultSettings();
  ui.asMember = null; ui.own = null; ui.all = null; ui.imp = null; ui.upg = false; ui.mgr = null; ui.dzSlot = null;
  ui.screen = 'auth'; ui.authTab = 'login'; ui.authErr = msg || ''; ui.view = 'progress';
  dirty.clear(); flushing = false;
  setStatus('init'); render();
}

/* ---------- status, toast, files ---------- */
const STATUS_TEXT = {init:'ログインしてください', ok:'保存済み', busy:'保存中…', local:'このブラウザに保存済み', err:'保存できていません'};
function setStatus(s){ state.status = s; renderStatus(); }
function renderStatus(){
  const el = $('status');
  el.setAttribute('data-s', state.status);
  const txt = (ui.screen === 'auth' || (ui.screen === 'admin' && !(state.session && state.session.me))) && state.status !== 'busy' && state.status !== 'err'
    ? (ui.screen === 'auth' ? STATUS_TEXT.init : '管理者として閲覧中') : STATUS_TEXT[state.status];
  el.innerHTML = '<i></i><span>' + esc(txt) + '</span>' +
    (state.status === 'err' ? '<button type="button" data-act="retry">再試行</button>' : '');
}
function toast(msg, opt){
  const el = $('toast');
  el.innerHTML = '';
  const sp = document.createElement('span'); sp.textContent = msg; el.appendChild(sp);
  if (opt && opt.undo) {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = '取り消し';
    b.onclick = () => { opt.undo(); el.hidden = true; };
    el.appendChild(b);
  }
  el.hidden = false;
  clearTimeout(toastT);
  toastT = setTimeout(() => { el.hidden = true; }, opt && opt.undo ? 7000 : 4200);
}
async function saveFile(name, data, mime){
  try {
    const blob = data instanceof Blob ? data : new Blob([data], {type: mime || 'application/octet-stream'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name; a.style.display = 'none';
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 5000);
    toast('ダウンロードを開始しました: ' + name);
    return true;
  } catch (e) {}
  if (typeof data === 'string' && navigator.clipboard) {
    try { await navigator.clipboard.writeText(data); toast('この環境ではファイル保存ができないため、内容をクリップボードにコピーしました。'); return true; } catch (e) {}
  }
  toast('この環境ではファイルを保存できません。ページ下の「別のタブで開く」から開き直してください。');
  return false;
}

/* ---------- 様式ファイル（GitHub版: 利用者が学会配布のxlsxを読み込む） ---------- */
const TPL_EMBEDDED = typeof TPL_B64 === 'string' && TPL_B64.length > 1000;      // 様式を内蔵した版か
const tplStore = {file: null, saved: false};                                  // file: {name, size, bytes(Uint8Array)}
function tplDb(){
  return new Promise((resolve, reject) => {
    try {
      const rq = indexedDB.open('senmoni-case-counter', 1);
      rq.onupgradeneeded = () => { rq.result.createObjectStore('kv'); };
      rq.onsuccess = () => resolve(rq.result);
      rq.onerror = () => reject(rq.error || new Error('idb'));
      rq.onblocked = () => reject(new Error('blocked'));
    } catch (e) { reject(e); }
  });
}
async function tplIdb(mode, fn){
  const db = await tplDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('kv', mode), rq = fn(tx.objectStore('kv'));
      tx.oncomplete = () => resolve(rq && rq.result);
      tx.onerror = () => reject(tx.error || new Error('idb'));
      tx.onabort = () => reject(tx.error || new Error('idb'));
    });
  } finally { db.close(); }
}
async function tplLoadSaved(){
  if (TPL_EMBEDDED) return;
  try {
    const r = await tplIdb('readonly', st => st.get('tpl'));
    if (r && r.bytes && r.name) { tplStore.file = {name: String(r.name), size: r.size || r.bytes.byteLength, bytes: new Uint8Array(r.bytes)}; tplStore.saved = true; }
  } catch (e) {}
}
async function tplPersist(){
  const f = tplStore.file;
  try { await tplIdb('readwrite', st => st.put({name: f.name, size: f.size, bytes: f.bytes.slice().buffer, at: Date.now()}, 'tpl')); tplStore.saved = true; }
  catch (e) { tplStore.saved = false; }
}
function tplSource(){ return TPL_EMBEDDED ? TPL_B64 : (tplStore.file ? tplStore.file.bytes : null); }
