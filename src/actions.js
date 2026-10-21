
/* ---------- 登録フォームの操作 ---------- */
function addEntry(raw, msgLabel){
  if (readOnly()) return null;
  const e = sanitizeEntry(raw);
  if (!e) { toast('入力内容を確認してください。'); return null; }
  const id = newId();
  putEntry(Object.assign({id: id}, e));
  flush(); render();
  toast(msgLabel(e), {undo: () => { removeEntry(id); flush(); render(); }});
  return id;
}
function startEdit(id){
  const e = getEntries().find(x => x.id === id);
  if (!e || readOnly()) return;
  ui.editId = id; ui.cat = e.c;
  $('editBar').hidden = false; $('btnSave').textContent = '更新'; $('entryTitle').textContent = '症例を編集';
  render();
  fillForm(e);
  $('fTech').value = e.t || '';
  $('nHint').hidden = !(e.n > 1);
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  $('entry').scrollIntoView({behavior: reduce ? 'auto' : 'smooth', block: 'start'});
}

function endEdit(){
  ui.editId = null;
  $('editBar').hidden = true; $('btnSave').textContent = '登録'; $('entryTitle').textContent = '症例を登録';
}

function submitForm(ev){
  ev.preventDefault();
  if (!state.ready || readOnly()) return;
  const d = $('fDate').value;
  if (!isDate(d)) { toast('日付を入力してください。'); $('fDate').focus(); return; }
  const raw = formEntry(d);
  if (raw.k) {
    const used = slotMap(getEntries().filter(e => e.id !== ui.editId))[Number(raw.k)];
    if (used) { toast('その枠は別の症例（' + used.d + '）が使っています。先に割り当てを外してください。'); return; }
  }
  if ($('fAge').value !== '' && raw.n === 1 && intIn($('fAge').value, 0, 120) == null) { toast('年齢は0〜120で入力してください。'); $('fAge').focus(); return; }
  if (ui.editId) {
    const e = sanitizeEntry(raw);
    if (!e) { toast('入力内容を確認してください。'); return; }
    const id = ui.editId;
    removeEntry(id); putEntry(Object.assign({id: id}, e));
    endEdit(); clearCaseFields(); flush(); render(); toast('更新しました。');
    return;
  }
  const id = addEntry(raw, e => CAT_BY[e.c].label + ' を' + (e.n > 1 ? e.n + '件 ' : '') + '登録しました（' + e.d + '）' + (e.k ? ' 枠' + e.k : ''));
  if (!id) return;
  clearCaseFields(); render();
  $('fAge').focus({preventScroll: true});
}

function setN(v){ $('fN').value = clampN(v); $('nHint').hidden = !(Number($('fN').value) > 1); }

/* ---------- 疾患群の枠 ---------- */

/* ---------- 疾患・病態 ---------- */
/* ---------- 出力 ---------- */
// 1件の記録の一部だけを書き換える（patch の値が空なら、その項目を消す）。変更前の記録を返す
function updateEntry(id, patch){
  const old = getEntries().find(x => x.id === id);
  if (!old || readOnly()) return null;
  const body = Object.assign({}, old, patch);
  Object.keys(patch).forEach(k => { if (patch[k] == null || patch[k] === '') delete body[k]; });
  delete body.id;
  const e = sanitizeEntry(body);
  if (!e) return null;
  removeEntry(id); putEntry(Object.assign({id: id}, e));
  return old;
}

// 進捗画面の「+」: その区分を選んだ状態で、登録フォームの年齢欄へ移る
function pickCat(key){
  if (!state.ready || !CAT_BY[key]) return;
  ui.cat = key; render();
  const f = $('fAge');
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  $('entry').scrollIntoView({behavior: reduce ? 'auto' : 'smooth', block: 'start'});
  if (f) f.focus({preventScroll: true});
}

function fillForm(e){
  $('fDate').value = e.d; $('fN').value = e.n;
  $('fAge').value = e.a != null ? e.a : ''; $('fSex').value = e.x || '';
  $('fPart').value = e.p || ''; $('fKind').value = e.q || ''; $('fReq').value = e.r || '';
  $('fProc').value = e.h || ''; $('fRole').value = e.ro || ''; $('fDxOnly').checked = !!e.o;
  $('fTx').value = e.tx || ''; $('fDz').value = e.z || '';
  $('fSite').value = e.s || ''; $('fF1').value = e.f1 || ''; $('fF2').value = e.f2 || ''; $('fMemo').value = e.m || '';
  $('fSlot').value = e.k ? String(e.k) : '';
  document.querySelector('.moredet').open = !!(e.s || e.f1 || e.f2 || e.m);
}

function clearCaseFields(){
  ['fAge', 'fPart', 'fKind', 'fReq', 'fProc', 'fTx', 'fDz', 'fMemo'].forEach(id => { $(id).value = ''; });
  $('fSex').value = ''; $('fRole').value = ''; $('fDxOnly').checked = false; $('fN').value = 1;
  $('fSlot').value = '';
  $('nHint').hidden = true;
}

function formEntry(d){
  const g = CAT_BY[ui.cat].g, n = clampN($('fN').value);
  const raw = {d: d, c: ui.cat, n: n, z: $('fDz').value.trim(), m: $('fMemo').value.trim(), s: $('fSite').value.trim(), f1: $('fF1').value.trim(), f2: $('fF2').value.trim()};
  if (n === 1) {
    raw.a = $('fAge').value; raw.x = $('fSex').value;
    if (g === 'img') { raw.p = $('fPart').value.trim(); raw.q = $('fKind').value.trim(); raw.r = $('fReq').value.trim(); raw.k = $('fSlot').value; }
    if (g === 'ivr') { raw.h = $('fProc').value.trim(); raw.ro = $('fRole').value; raw.o = $('fDxOnly').checked; }
  }
  if (g === 'rt') { raw.t = $('fTech').value; raw.tx = $('fTx').value.trim(); }
  return raw;
}

function assignSlot(id, no){
  if (readOnly()) return;
  const other = slotMap(getEntries())[no];
  if (other && other.id !== id) { toast('その枠はすでに使われています。'); return; }
  const old = updateEntry(id, {k: no});
  if (!old) { toast('この症例は枠に使えません（件数が2以上、または画像診断以外）。'); return; }
  ui.dzSlot = null; flush(); render();
  toast('枠' + no + '「' + slotLabel(no) + '」に割り当てました。', {undo: () => { updateEntry(id, {k: old.k || null}); flush(); render(); }});
}

function clearSlot(id){
  const old = updateEntry(id, {k: null});
  if (!old) return;
  ui.dzSlot = null; flush(); render();
  toast('割り当てを外しました。', {undo: () => { updateEntry(id, {k: old.k}); flush(); render(); }});
}

function newForSlot(no){
  if (readOnly()) return;
  if (CAT_BY[ui.cat].g !== 'img') ui.cat = 'ct';
  if (ui.editId) { endEdit(); clearCaseFields(); }
  render();
  $('fSlot').value = String(no);
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  $('entry').scrollIntoView({behavior: reduce ? 'auto' : 'smooth', block: 'start'});
  $('fAge').focus({preventScroll: true});
  toast('枠' + no + '「' + slotLabel(no) + '」に登録します。症例の内容を入力してください。');
}

/* ---------- 出力 ---------- */

// 研修手帳の様式（元のxlsx）に症例を書き込んで保存する
async function onTplFile(file){
  ui.tplMsg = '';
  if (!file) return;
  try {
    if (file.size > 8 * 1024 * 1024) throw new Error('ファイルが大きすぎます。');
    if (typeof JSZip === 'undefined') throw new Error('Excelを読む部品を読み込めませんでした。ページを開き直してください。');
    const bytes = new Uint8Array(await file.arrayBuffer());
    await openTemplate(JSZip, bytes);                                 // 学会の様式として読めるか確認
    tplStore.file = {name: file.name, size: bytes.length, bytes: bytes};
    await tplPersist();
    toast('様式ファイルを読み込みました: ' + file.name);
  } catch (e) {
    ui.tplMsg = ((e && e.message) || '読み込めませんでした。') + ' 学会が配布している研修手帳の様式（経験症例記録）のExcelを選んでください。';
  }
  render();
}
async function tplForget(){
  tplStore.file = null; tplStore.saved = false; ui.tplMsg = '';
  try { await tplIdb('readwrite', st => st.delete('tpl')); } catch (e) {}
  render(); toast('保存した様式ファイルを削除しました。');
}

async function exportTemplate(){
  const src = tplSource();
  if (src == null) {
    toast('先に、研修手帳の様式ファイル（学会配布のExcel）を選んでください。');
    if (!ui.asMember && ui.view !== 'export') { ui.view = 'export'; render(); }
    return;
  }
  if (typeof JSZip === 'undefined') { toast('様式のExcelを作る部品（JSZip）を読み込めませんでした。ネットワークを確認して、ページを開き直してください。'); return; }
  const entries = getEntries();
  if (!entries.length) { toast('症例がまだありません。'); return; }
  try {
    const r = await buildTemplateXlsx(JSZip, entries, state.settings, src);
    const ok = await saveFile(fname('研修手帳', 'xlsx'), new Blob([r.bytes], {type: XLSX_MIME}), XLSX_MIME);
    const w = reportWarnings(r.report);
    if (ok && w.length && ui.view !== 'export') setTimeout(() => toast(w[0] + (w.length > 1 ? '（ほか' + (w.length - 1) + '件の注意があります）' : '')), 2200);
  } catch (e) {
    toast('様式のExcelを作れませんでした: ' + ((e && e.message) || '原因不明') + (e && e.problems ? ' 様式ファイルを選び直してください。' : ''));
  }
}

function parseDocs(docs){
  const months = {}; let settings = null, summary = null;
  Object.keys(docs || {}).forEach(k => {
    let j = null;
    try { j = JSON.parse(docs[k]); } catch (e) { return; }
    if (k === 'settings') settings = j; else if (k === 'summary') summary = j; else if (k.indexOf('m-') === 0) months[k] = j;
  });
  return {months: cleanMonths(months), settings: sanitizeSettings(settings), summary: sanitizeSummary(summary)};
}

function shownMembers(){
  return (ui.all || []).filter(m => ui.aCohort === 'all' || (m.cohort || 0) === Number(ui.aCohort));
}

// 全員出力用: 各メンバーの全記録を順に読み込む
async function fetchFull(){
  const list = shownMembers().slice().sort((a, b) => a.name < b.name ? -1 : 1), out = [];
  for (let i = 0; i < list.length; i++) {
    ui.aExpMsg = '読み込み中… ' + (i + 1) + ' / ' + list.length + '（' + esc(list[i].name) + '）'; if (ui.view === 'a-export') renderAExport();
    const r = await rpc('api_adminMember', state.session.token, list[i].id);
    const d = parseDocs(r.docs), entries = allEntries(d.months);
    const tracks = TRACKS.map(t => summarize(progress(t, tally(entries, d.settings.range[t.id]), d.settings)));
    out.push({m: list[i], st: d.settings, entries: entries, tracks: tracks, tl: tally(entries)});
  }
  ui.aExpMsg = '';
  return out;
}

function summaryAoa(full){
  const head = ['氏名', '入学年度', '次の受験予定', 'あと(日)', '最終入力日', '放射線科専門医(%)', '診断専門医(%)', '治療専門医(%)', '登録件数(合計)', '疾患群の枠(件)'].concat(CATS.map(c => c.label));
  const rows = full.map(f => {
    const nx = nextExam(f.st);
    const lastD = f.entries.reduce((a, e) => e.d > a ? e.d : a, '');
    return [f.m.name, f.st.cohort || '', nx ? nx.date + '（' + TRACK_BY[nx.id].name + '）' : '', nx ? nx.days : '', lastD, f.tracks[0].pct, f.tracks[1].pct, f.tracks[2].pct,
      f.entries.reduce((s, e) => s + e.n, 0), f.tl.dz || 0].concat(CATS.map(c => f.tl[c.k] || 0));
  });
  return [head].concat(rows);
}

function entriesAoa(full){
  const rows = [];
  full.forEach(f => sortEntries(f.entries.slice()).reverse().forEach(e => rows.push([f.m.name, f.st.cohort || ''].concat(entryRow(e, true)))));
  return [['氏名', '入学年度'].concat(ENTRY_HEAD)].concat(rows);
}

function whoTag(){ return ui.asMember ? ui.asMember.name.replace(/[\\/:*?"<>|\s]+/g, '_') : (state.session && state.session.me ? state.session.me.name.replace(/[\\/:*?"<>|\s]+/g, '_') : ''); }
function fname(prefix, ext){ return prefix + (whoTag() ? '_' + whoTag() : '') + '_' + todayStr() + '.' + ext; }
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
function summaryRows(){
  const entries = getEntries(), st = state.settings;
  const aoa = [['専門医症例カウンター 集計'], ['出力日', todayStr()]];
  if (whoTag()) aoa.push(['氏名', ui.asMember ? ui.asMember.name : state.session.me.name]);
  if (st.cohort) aoa.push(['入学年度', st.cohort + '年度']);
  aoa.push([]);
  TRACKS.forEach(t => {
    const rows = progress(t, tally(entries, st.range[t.id]), st);
    const rg = st.range[t.id], sm = summarize(rows);
    const ex = examState(st, t.id, sm.restSum, todayStr());
    aoa.push([t.name + '（' + t.sub + '）' + (rg && (rg.from || rg.to) ? ' 集計期間 ' + (rg.from || '') + '〜' + (rg.to || '') : '')]);
    if (ex) aoa.push(['受験予定日', ex.date, ex.past ? '（過ぎています）' : 'あと' + ex.days + '日', ex.pace ? '不足' + sm.restSum + '件・週' + ex.pace.perWeek + '件のペース' : '']);
    aoa.push(['項目', '目標', '現在', '不足', '達成']);
    rows.forEach(r => aoa.push([(r.item.sub ? '　' : '') + r.item.label, r.has ? r.goal : '規定なし', r.count, r.has ? r.rest : '', r.done ? '○' : '']));
    aoa.push([]);
  });
  return aoa;
}

function xlsxBlob(wb){ return new Blob([XLSX.write(wb, {bookType: 'xlsx', type: 'array'})], {type: XLSX_MIME}); }
async function exportXlsx(){
  if (typeof XLSX === 'undefined') { toast('Excel出力の部品を読み込めませんでした。CSV出力をご利用ください。'); return; }
  const list = sortEntries(getEntries()).reverse();
  const wb = XLSX.utils.book_new();
  const ws1 = XLSX.utils.aoa_to_sheet(summaryRows());
  ws1['!cols'] = [{wch:38}, {wch:11}, {wch:11}, {wch:30}, {wch:7}];
  XLSX.utils.book_append_sheet(wb, ws1, '集計');
  const ws2 = XLSX.utils.aoa_to_sheet([ENTRY_HEAD].concat(list.map(e => entryRow(e, true))));
  ws2['!cols'] = [{wch:12}, {wch:24}, {wch:6}, {wch:6}, {wch:6}, {wch:12}, {wch:8}, {wch:24}, {wch:28}, {wch:8}, {wch:14}, {wch:16}, {wch:6}, {wch:8}, {wch:18}, {wch:14}, {wch:14}, {wch:24}];
  XLSX.utils.book_append_sheet(wb, ws2, '症例一覧');
  await saveFile(fname('症例カウンター', 'xlsx'), xlsxBlob(wb), XLSX_MIME);
}

async function exportCsv(){
  await saveFile(fname('症例一覧', 'csv'), toCSV(sortEntries(getEntries()).reverse()), 'text/csv;charset=utf-8');
}
async function exportJson(){
  const body = JSON.stringify({app:'senmoni-case-counter', v:1, exported:new Date().toISOString(), months:state.months, settings:state.settings}, null, 1);
  const ok = await saveFile(fname('症例カウンター_backup', 'json'), body, 'application/json');
  if (ok) { state.settings.backup = todayStr(); saveSettings(); renderExport(); }
}
function onRestoreFile(file){
  if (!file) return;
  const fr = new FileReader();
  fr.onload = () => {
    const p = parseBackup(String(fr.result || ''));
    if (!p.error) p.fresh = allEntries(p.months).filter(e => !existsId(e.id)).length;
    ui.restore = p; renderExport();
  };
  fr.onerror = () => { ui.restore = {error:'ファイルを読み込めませんでした。'}; renderExport(); };
  fr.readAsText(file);
}
function applyRestore(){
  const r = ui.restore;
  if (!r || r.error) return;
  allEntries(r.months).forEach(e => { if (!existsId(e.id)) putEntry(e); });
  state.settings = r.settings;
  dirty.add('settings'); ui.restore = null;
  flush(); render(); toast('バックアップを取り込みました。');
}

/* ---------- 症例リスト取り込み ---------- */
function decodeText(buf){
  const u8 = new Uint8Array(buf);
  try { return new TextDecoder('utf-8', {fatal: true}).decode(u8); } catch (e) {}
  try { return new TextDecoder('shift_jis').decode(u8); } catch (e) {}
  return new TextDecoder('utf-8').decode(u8);
}
// シートを文字列の2次元配列にする。日付セルは表示形式に左右されないよう、自前で yyyy-mm-dd にする
function sheetGrid(wb, i){
  const ws = wb.Sheets[wb.SheetNames[i]];
  if (!ws || !ws['!ref']) return [];
  const rg = XLSX.utils.decode_range(ws['!ref']);
  const d1904 = !!(wb.Workbook && wb.Workbook.WBProps && wb.Workbook.WBProps.date1904);
  const pad = n => (n < 10 ? '0' : '') + n;
  const out = [], last = Math.min(rg.e.r, rg.s.r + 300000);
  for (let r = rg.s.r; r <= last; r++) {
    const row = [];
    for (let c = rg.s.c; c <= rg.e.c; c++) {
      const cell = ws[XLSX.utils.encode_cell({r: r, c: c})];
      let v = '';
      if (cell && cell.t !== 'z') {
        let p = null;
        if (cell.t === 'n' && typeof cell.v === 'number' && cell.z && XLSX.SSF.is_date(cell.z)) p = XLSX.SSF.parse_date_code(cell.v, {date1904: d1904});
        if (p && p.y > 1900) v = p.y + '-' + pad(p.m) + '-' + pad(p.d);
        else if (cell.t === 'd' && cell.v instanceof Date) v = cell.v.getFullYear() + '-' + pad(cell.v.getMonth() + 1) + '-' + pad(cell.v.getDate());
        else v = cell.w != null ? String(cell.w) : (cell.v != null ? String(cell.v) : '');
      }
      row.push(v);
    }
    out.push(row);
  }
  return out;
}
function impRescan(I){
  if (I.cols.date < 0 || I.cols.cat < 0) { I.scan = null; I.aggKey = ''; return; }
  I.scan = scanImport(I.grid, {hdr: I.hdr, date: I.cols.date, cat: I.cols.cat, cat2: I.cols.cat2});
  const savedVals = (state.settings.imp && state.settings.imp.vals) || {};
  const prev = I.vals; I.vals = {};
  I.scan.keys.forEach(k => { I.vals[k.key] = prev[k.key] || savedVals[k.key] || k.sug || '-'; });
  I.aggKey = '';
}

function impRefresh(I, useSaved){
  I.heads = headerList(I.grid, I.hdr);
  I.cols = guessCols(I.heads, useSaved && state.settings.imp ? state.settings.imp.cols : null);
  I.vals = {};
  impRescan(I);
}

async function onImpFile(file){
  ui.impMsg = ''; ui.impDel = false;
  if (!file) return;
  if (file.size > 60 * 1024 * 1024) { ui.impMsg = 'ファイルが大きすぎます（60MBまで）。'; render(); return; }
  try {
    const buf = await file.arrayBuffer();
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    let grid, wb = null, sheets;
    if (ext === 'xlsx' || ext === 'xls') {
      if (typeof XLSX === 'undefined') throw new Error('Excelを読み込む部品を読み込めませんでした。CSVで出力して取り込んでください。');
      wb = XLSX.read(buf, {type: 'array', cellNF: true});
      sheets = wb.SheetNames.slice(0, 30);
      grid = sheetGrid(wb, 0);
    } else {
      grid = parseDelimited(decodeText(buf));
      sheets = ['(CSV)'];
    }
    if (!grid.length) throw new Error('データが見つかりませんでした。');
    const sv = state.settings.imp;
    const I = {name: file.name, grid: grid, wb: wb, sheets: sheets, sheet: 0, hdr: guessHeaderRow(grid), heads: [], cols: {}, mode: sv && sv.mode === 'count' ? 'count' : 'case',
      scan: null, vals: {}, from: '', to: '', site: (sv && sv.site) || '', aggKey: '', res: null};
    impRefresh(I, true);
    ui.imp = I;
  } catch (e) {
    ui.impMsg = '読み込めませんでした: ' + (e && e.message ? e.message : 'ファイルの形式を確認してください。');
  }
  render();
}

function impCommit(){
  const I = ui.imp, res = I && impAgg();
  if (!I || !res || readOnly()) return;
  const plan = impPlan(I, res);
  if (!plan.ents.length) { toast('取り込める症例がありません。'); return; }
  const prev = {};                                                  // id → 変更前の記録（なければ null）
  plan.stale.forEach(e => { prev[e.id] = Object.assign({}, e); removeEntry(e.id); });
  plan.ents.forEach(e => {
    const old = plan.byId[e.id];
    prev[e.id] = old ? Object.assign({}, old) : null;
    const body = Object.assign({}, old || {}, e);                  // 既存の枠・手入力の項目は残し、ファイルにある項目で上書き
    delete body.id;
    const s = sanitizeEntry(body);
    if (s) { if (old) removeEntry(e.id); putEntry(Object.assign({id: e.id}, s)); }
  });
  if (I.mode === 'case') {                                          // 同じ期間・区分の「件数だけ」の取り込み分は、症例ごとの記録に置き換える
    const cats = new Set(plan.ents.map(e => e.c));
    getEntries().filter(e => e.id.indexOf('imp') === 0 && e.d >= plan.lo && e.d <= plan.hi && cats.has(e.c)).forEach(e => {
      prev[e.id] = Object.assign({}, e); removeEntry(e.id);
    });
  }
  const label = i => (i >= 0 && I.heads[i] ? I.heads[i].label : '');
  const vals = Object.assign({}, (state.settings.imp && state.settings.imp.vals) || {});
  I.scan.keys.forEach(k => { vals[k.key] = I.vals[k.key]; });
  const cols = {}; IMP_ROLE_KEYS.forEach(k => { cols[k] = label(I.cols[k]); });
  state.settings.imp = sanitizeImp({cols: cols, vals: vals, site: I.site, mode: I.mode});
  dirty.add('settings');
  const n = res.stat.ok;
  ui.imp = null; ui.impMsg = '';
  flush(); render();
  toast(fmtN(n) + ' 件を取り込みました' + (I.mode === 'case' ? '（新規 ' + plan.add + '・更新 ' + plan.upd + (plan.stale.length ? '・削除 ' + plan.stale.length : '') + '）' : '') + '。', {undo: () => {
    Object.keys(prev).forEach(id => { removeEntry(id); if (prev[id]) putEntry(prev[id]); });
    flush(); render();
  }});
}

/* ---------- ログイン・セッション ---------- */

function impDeleteAll(){
  if (!ui.impDel) { ui.impDel = true; renderImport(); setTimeout(() => { if (ui.impDel) { ui.impDel = false; if (ui.view === 'import') renderImport(); } }, 5000); return; }
  const olds = impEntryList().map(e => Object.assign({}, e));
  olds.forEach(e => removeEntry(e.id));
  ui.impDel = false;
  flush(); render();
  toast(olds.length + ' 件の取り込み分を削除しました。', {undo: () => { olds.forEach(e => putEntry(e)); flush(); render(); }});
}

/* ---------- ログイン・セッション ---------- */
async function enterSession(){
  const r = await rpc('api_load', state.session.token);
  state.session.me = r.me; state.session.admin = !!r.admin; saveSess();
  applyLoad(r);
  state.mode = 'gas'; state.ready = true; state.loaded = true;
  ui.asMember = null; ui.own = null; ui.all = null; ui.upg = false; ui.mgr = null; ui.imp = null; ui.dzSlot = null;
  if (state.session.me) { ui.screen = 'member'; ui.view = 'progress'; $('fDate').value = todayStr(); }
  else { ui.screen = 'admin'; ui.view = 'a-overview'; }
  setStatus('ok'); render();
  if (ui.screen === 'admin') loadAdmin();
}

/* ---------- 管理者 ---------- */

async function submitAuth(ev){
  ev.preventDefault();
  if (ui.authBusy) return;
  const tab = ui.authTab, name = $('inName').value.trim(), pass = $('inPass').value;
  ui.authErr = '';
  if (tab !== 'admin' && !name) { ui.authErr = '氏名を入力してください。'; render(); return; }
  if (!pass) { ui.authErr = 'パスコードを入力してください。'; render(); return; }
  if (tab === 'register') {
    if (pass.length < 6) { ui.authErr = ERR_MSG.weak; render(); return; }
    if (pass !== $('inPass2').value) { ui.authErr = 'パスコード（確認）が一致しません。'; render(); return; }
    if (!$('inJoin').value.trim()) { ui.authErr = '招待コードを入力してください。'; render(); return; }
  }
  ui.authBusy = true; render();
  try {
    const r = tab === 'login' ? await rpc('api_login', name, pass)
      : tab === 'register' ? await rpc('api_register', name, pass, $('inJoin').value.trim())
      : await rpc('api_adminLogin', pass);
    state.session = {token: r.token, me: r.me, admin: !!r.admin}; saveSess();
    $('inPass').value = ''; $('inPass2').value = ''; $('inJoin').value = '';
    await enterSession();
  } catch (e) {
    ui.authErr = errText(e);
  }
  ui.authBusy = false; render();
}
async function submitUpgrade(ev){
  ev.preventDefault();
  const pass = $('upgPass').value;
  if (!pass) return;
  try {
    const r = await rpc('api_upgrade', state.session.token, pass);
    state.session = {token: r.token, me: r.me, admin: true}; saveSess();
    $('upgPass').value = ''; $('upgErr').textContent = ''; ui.upg = false;
    goAdmin();
  } catch (e) {
    if (!handleAuthErr(e)) $('upgErr').textContent = errText(e);
  }
}
function goAdmin(){
  ui.screen = 'admin'; ui.view = 'a-overview'; ui.asMember = null; ui.own = null;
  render();
  if (!ui.all) loadAdmin(); else loadAdmin(true);
}
function goMember(){
  if (ui.asMember) closeMember(true);
  ui.screen = 'member'; ui.view = 'progress'; render();
}

/* ---------- 管理者 ---------- */
// 一覧用: 設定と集計（summary）だけから、人ごとの進捗・次の受験予定を作る
function prepMember(m) {
  const d = parseDocs(m.docs), st = d.settings, sm = d.summary;
  const tracks = TRACKS.map(t => ({id: t.id, s: summarize(progress(t, sm ? sm.tr[t.id] : {}, st))}));
  const next = nextExam(st);
  if (next) { const s = tracks.find(x => x.id === next.id).s; next.rest = s.total ? s.restSum : null; next.pace = s.total ? paceOf(s.restSum, next.days) : null; }
  return {id: m.id, name: m.name, created: m.created, seen: m.seen, upd: m.upd || '', settings: st, cohort: st.cohort, tracks: tracks, next: next, hasSum: !!sm,
    total: sm ? sm.n : 0, dzN: sm ? (sm.tl.dz || 0) : 0, inc: sm ? sm.inc : 0, lastD: sm ? sm.lastD : '', tl: sm ? sm.tl : {}};
}

async function loadAdmin(quiet){
  if (!state.session || !state.session.admin) return;
  ui.aloading = true; ui.aErr = '';
  if (!quiet) ui.all = null;
  render();
  try {
    const r = await rpc('api_adminAll', state.session.token);
    ui.all = r.members.map(prepMember);
  } catch (e) {
    if (!handleAuthErr(e)) { ui.aErr = errText(e); }
  }
  ui.aloading = false; render();
}

async function openMember(id){
  const m = (ui.all || []).find(x => x.id === id);
  if (!m || ui.opening) return;
  ui.opening = true; toast(m.name + ' さんの記録を読み込んでいます…');
  try {
    const r = await rpc('api_adminMember', state.session.token, id);
    const d = parseDocs(r.docs);
    ui.own = {months: state.months, settings: state.settings};
    state.months = d.months; state.settings = d.settings;
    ui.asMember = {id: m.id, name: m.name};
    ui.view = 'progress'; ui.logLimit = 60; ui.dzSlot = null;
    $('toast').hidden = true;
    render();
    window.scrollTo(0, 0);
  } catch (e) {
    if (!handleAuthErr(e)) toast('読み込めませんでした（' + errText(e).replace(/。$/, '') + '）。');
  }
  ui.opening = false;
}

function closeMember(silent){
  if (!ui.asMember) return;
  if (ui.own) { state.months = ui.own.months; state.settings = ui.own.settings; }
  ui.asMember = null; ui.own = null;
  if (!silent) { ui.view = 'a-overview'; render(); }
}
async function runMgr(){
  const g = ui.mgr; if (!g) return;
  const m = (ui.all || []).find(x => x.id === g.id); if (!m) return;
  const inp = $('mgrIn') ? $('mgrIn').value.trim() : '';
  ui.mgrBad = false;
  try {
    if (g.mode === 'rename') { await rpc('api_adminRename', state.session.token, g.id, inp); ui.mgrMsg = '名前を「' + inp + '」に変更しました。'; }
    else if (g.mode === 'pass') {
      if (inp.length < 6) { ui.mgrMsg = ERR_MSG.weak; ui.mgrBad = true; renderAMembers(); return; }
      await rpc('api_adminSetPass', state.session.token, g.id, inp); ui.mgrMsg = m.name + ' さんのパスコードを再設定しました。';
    } else if (g.mode === 'del') { await rpc('api_adminDelete', state.session.token, g.id); ui.mgrMsg = m.name + ' さんを削除しました。'; }
    ui.mgr = null;
    await loadAdmin(true);
  } catch (e) {
    if (!handleAuthErr(e)) { ui.mgrMsg = errText(e); ui.mgrBad = true; renderAMembers(); }
  }
}
async function exportAllXlsx(){
  if (typeof XLSX === 'undefined') { toast('Excel出力の部品を読み込めませんでした。CSV出力をご利用ください。'); return; }
  try {
    const full = await fetchFull();
    const wb = XLSX.utils.book_new();
    const w1 = XLSX.utils.aoa_to_sheet(summaryAoa(full)); w1['!cols'] = [{wch:16}, {wch:9}, {wch:30}, {wch:8}, {wch:12}, {wch:14}, {wch:14}, {wch:14}, {wch:12}, {wch:12}];
    XLSX.utils.book_append_sheet(wb, w1, '全員サマリ');
    const w2 = XLSX.utils.aoa_to_sheet(entriesAoa(full)); w2['!cols'] = [{wch:16}, {wch:9}, {wch:12}, {wch:24}, {wch:6}, {wch:6}, {wch:6}, {wch:12}, {wch:8}, {wch:24}, {wch:28}];
    XLSX.utils.book_append_sheet(wb, w2, '全員症例一覧');
    await saveFile('症例カウンター_全員_' + todayStr() + '.xlsx', xlsxBlob(wb), XLSX_MIME);
  } catch (e) { if (!handleAuthErr(e)) { ui.aExpMsg = esc(errText(e)); if (ui.view === 'a-export') renderAExport(); } }
}

async function exportAllCsv(){
  try {
    const full = await fetchFull();
    const rows = entriesAoa(full).map((r, i) => i === 0 ? r : r.map(c => typeof c === 'string' ? safeText(c) : c));
    await saveFile('全員症例一覧_' + todayStr() + '.csv', '﻿' + rows.map(r => r.map(csvCell).join(',')).join('\r\n') + '\r\n', 'text/csv;charset=utf-8');
  } catch (e) { if (!handleAuthErr(e)) { ui.aExpMsg = esc(errText(e)); if (ui.view === 'a-export') renderAExport(); } }
}

async function writeAllSheet(){
  ui.aExpMsg = '書き出し中…'; renderAExport();
  try {
    const full = await fetchFull();
    ui.aExpMsg = '書き出し中…'; renderAExport();
    const a = await rpc('api_adminWriteSheet', state.session.token, '全員サマリ', summaryAoa(full));
    const b = await rpc('api_adminWriteSheet', state.session.token, '全員症例一覧', entriesAoa(full));
    ui.aExpMsg = '書き出しました: <a href="' + esc(a.url) + '" target="_blank" rel="noopener">全員サマリ</a> ／ <a href="' + esc(b.url) + '" target="_blank" rel="noopener">全員症例一覧</a>（スプレッドシートの所有者のアカウントで開きます）';
  } catch (e) {
    if (handleAuthErr(e)) return;
    ui.aExpMsg = esc(errText(e));
  }
  renderAExport();
}

/* ---------- イベント ---------- */
function onAct(a, b){
  switch (a) {
    case 'retry': flush(); break;
    case 'logout': logout(''); break;
    case 'goMember': goMember(); break;
    case 'goAdmin': goAdmin(); break;
    case 'askAdmin': ui.upg = !ui.upg; renderWho(); if (ui.upg) $('upgPass').focus(); break;
    case 'upgCancel': ui.upg = false; renderWho(); break;
    case 'track':
      ui.track = b.dataset.id;
      try { localStorage.setItem(LS_TRACK, ui.track); } catch (e) {}
      renderProgress(); break;
    case 'plus': pickCat(b.dataset.key); break;
    case 'godz': ui.view = 'dz'; render(); break;
    case 'chkdel': {
      if (readOnly()) break;
      const tr = TRACK_BY[ui.track], arr = getChecks(tr).slice();
      arr.splice(Number(b.dataset.i), 1);
      state.settings.checks[tr.id] = arr; saveSettings(); renderProgress(); break;
    }
    case 'more': ui.logLimit += 60; renderLog(); break;
    case 'edit': startEdit(b.dataset.id); break;
    case 'del': {
      if (readOnly()) break;
      const id = b.dataset.id;
      if (ui.pendingDelete === id) {
        const e = getEntries().find(x => x.id === id);
        ui.pendingDelete = null; removeEntry(id); flush(); render();
        if (e) toast('削除しました。', {undo: () => { putEntry(e); flush(); render(); }});
      } else {
        ui.pendingDelete = id; renderLog();
        setTimeout(() => { if (ui.pendingDelete === id) { ui.pendingDelete = null; if (ui.view === 'log') renderLog(); } }, 4000);
      }
      break;
    }
    case 'tpl': exportTemplate(); break;
    case 'tplforget': tplForget(); break;
    case 'slot': { const no = Number(b.dataset.no); ui.dzSlot = ui.dzSlot === no ? null : no; ui.slotQ = ''; renderDz(); break; }
    case 'slotnew': newForSlot(Number(b.dataset.no)); break;
    case 'slotpick': assignSlot(b.dataset.id, ui.dzSlot); break;
    case 'slotclear': clearSlot(b.dataset.id); break;
    case 'evdel': if (!readOnly()) { state.settings.ev.splice(Number(b.dataset.i), 1); saveSettings(); renderProgress(); } break;
    case 'facdel': if (!readOnly()) { state.settings.facs.splice(Number(b.dataset.i), 1); saveSettings(); renderSettings(); } break;
    case 'xlsx': exportXlsx(); break;
    case 'csv': exportCsv(); break;
    case 'json': exportJson(); break;
    case 'restore-ok': applyRestore(); break;
    case 'restore-cancel': ui.restore = null; renderExport(); break;
    case 'impdelall': impDeleteAll(); break;
    case 'impgo': impCommit(); break;
    case 'impcancel': ui.imp = null; ui.impMsg = ''; renderImport(); break;
    case 'resetgoals':
      delete state.settings.goals[b.dataset.t];
      saveSettings(); renderSettings(); toast('目標を初期値に戻しました。'); break;
    case 'areload': loadAdmin(true); break;
    case 'asort': {
      const k = b.dataset.k;
      if (ui.asort === k) ui.adir = -ui.adir; else { ui.asort = k; ui.adir = (k === 'name' ? 1 : -1); }
      renderAOverview(); break;
    }
    case 'open': openMember(b.dataset.id); break;
    case 'closeMember': closeMember(); break;
    case 'mgr': ui.mgr = (ui.mgr && ui.mgr.id === b.dataset.id && ui.mgr.mode === b.dataset.mode) ? null : {id: b.dataset.id, mode: b.dataset.mode}; ui.mgrMsg = ''; renderAMembers(); if ($('mgrIn')) $('mgrIn').focus(); break;
    case 'mgrgo': runMgr(); break;
    case 'mgrno': ui.mgr = null; renderAMembers(); break;
    case 'axlsx': exportAllXlsx(); break;
    case 'acsv': exportAllCsv(); break;
    case 'asheet': writeAllSheet(); break;
  }
}

function bindEvents(){
  $('entryForm').addEventListener('submit', submitForm);
  $('cancelEdit').addEventListener('click', () => { endEdit(); clearCaseFields(); render(); });
  $('nDec').addEventListener('click', () => setN(Number($('fN').value) - 1));
  $('nInc').addEventListener('click', () => setN(Number($('fN').value) + 1));
  $('fN').addEventListener('change', () => setN($('fN').value));
  $('fN').addEventListener('input', () => { $('nHint').hidden = !(Number($('fN').value) > 1); });
  $('catChips').addEventListener('click', ev => {
    const b = ev.target.closest('[data-cat]');
    if (!b) return;
    ui.cat = b.dataset.cat; render();
    const nb = document.querySelector('.chip[data-cat="' + ui.cat + '"]'); if (nb) nb.focus();
  });
  $('nav').addEventListener('click', ev => {
    const b = ev.target.closest('[data-view]');
    if (!b) return;
    ui.view = b.dataset.view; render();
    if (ui.view === 'a-overview' || ui.view === 'a-members' || ui.view === 'a-export') { if (!ui.all && !ui.aloading) loadAdmin(); }
  });
  $('authTabs').addEventListener('click', ev => {
    const b = ev.target.closest('[data-atab]');
    if (!b) return;
    ui.authTab = b.dataset.atab; ui.authErr = ''; renderAuth();
  });
  $('authForm').addEventListener('submit', submitAuth);
  $('upgForm').addEventListener('submit', submitUpgrade);

  document.addEventListener('click', ev => {
    const b = ev.target.closest('[data-act]');
    if (b) onAct(b.dataset.act, b);
  });
  document.addEventListener('submit', ev => {
    const id = ev.target.id;
    if (id === 'chkForm') {
      ev.preventDefault();
      if (readOnly()) return;
      const v = $('chkNew').value.trim();
      if (!v) return;
      const tr = TRACK_BY[ui.track], arr = getChecks(tr).map(x => Object.assign({}, x));
      if (arr.length >= 30) { toast('追加できる項目は30件までです。'); return; }
      arr.push({t: v.slice(0, 80), done: false, custom: true});
      state.settings.checks[tr.id] = arr; saveSettings(); renderProgress();
    } else if (id === 'evForm') {
      ev.preventDefault();
      if (readOnly()) return;
      const d = $('evDate').value, t = cleanTxt($('evTitle').value, 40);
      if (!isDate(d) || !t) { toast('予定の日付と名前を入力してください。'); return; }
      if (state.settings.ev.length >= 30) { toast('登録できる予定は30件までです。'); return; }
      state.settings.ev.push({d: d, t: t});
      state.settings.ev.sort((a, b) => a.d < b.d ? -1 : a.d > b.d ? 1 : 0);
      saveSettings(); renderProgress();
    } else if (id === 'facForm') {
      ev.preventDefault();
      if (readOnly()) return;
      const n = cleanTxt($('facName').value, 40), c = $('facCode').value.normalize('NFKC').replace(/\s/g, ''), msg = $('facMsg');
      if (!n) { msg.textContent = '施設名を入力してください。'; return; }
      if (c && !/^\d{9}$/.test(c)) { msg.textContent = '施設コードは9桁の数字で入力してください（空欄でも登録できます）。'; return; }
      if (state.settings.facs.some(f => f.n === n)) { msg.textContent = 'その施設はすでに登録されています。'; return; }
      if (state.settings.facs.length >= 8) { msg.textContent = '登録できる施設は8件までです。'; return; }
      state.settings.facs.push({n: n, c: c});
      saveSettings(); renderSettings();
    } else if (id === 'pwForm') {
      ev.preventDefault();
      const msg = $('pwMsg');
      const o = $('pwOld').value, n = $('pwNew').value;
      if (n.length < 6) { msg.className = 'msgline bad'; msg.textContent = ERR_MSG.weak; return; }
      rpc('api_changePass', state.session.token, o, n).then(() => {
        msg.className = 'msgline'; msg.textContent = 'パスコードを変更しました。'; $('pwOld').value = ''; $('pwNew').value = '';
      }).catch(e => { if (!handleAuthErr(e)) { msg.className = 'msgline bad'; msg.textContent = e.code === 'login' ? 'いまのパスコードが違います。' : errText(e); } });
    }
  });
  document.addEventListener('change', ev => {
    const t = ev.target;
    if (t.id === 'fImp') { onImpFile(t.files[0]); t.value = ''; return; }
    if (t.id === 'fRestore') { onRestoreFile(t.files[0]); t.value = ''; return; }
    if (t.id === 'fTpl') { onTplFile(t.files[0]); t.value = ''; return; }
    if (t.id === 'logCat') { ui.logLimit = 60; renderLog(); return; }
    if (t.id === 'dzOnly') { renderDz(); return; }
    if (t.id === 'aCohort') { ui.aCohort = t.value; try { localStorage.setItem('senmoni-case-counter.cohort', t.value); } catch (e) {} renderAOverview(); return; }
    const imp = t.closest('[data-imp]');
    if (imp && ui.imp) {
      const I = ui.imp, k = imp.dataset.imp;
      if (k === 'sheet') { I.sheet = Number(imp.value); I.grid = sheetGrid(I.wb, I.sheet); I.hdr = guessHeaderRow(I.grid); impRefresh(I, false); }
      else if (k === 'hdr') { I.hdr = Number(imp.value); impRefresh(I, false); }
      else if (k === 'date' || k === 'cat' || k === 'cat2') { I.cols[k] = Number(imp.value); impRescan(I); }
      else if (k === 'role') { I.cols[imp.dataset.role] = Number(imp.value); I.aggKey = ''; }
      else if (k === 'mode') { I.mode = imp.value === 'count' ? 'count' : 'case'; I.aggKey = ''; }
      else if (k === 'val') { const key = I.scan.keys[Number(imp.dataset.i)]; if (key) I.vals[key.key] = imp.value; I.aggKey = ''; }
      else if (k === 'from' || k === 'to') I[k] = isDate(imp.value) ? imp.value : '';
      else if (k === 'site') I.site = imp.value.trim().slice(0, 60);
      renderImport();
      return;
    }
    const el = t.closest('[data-act]');
    if (!el || readOnly()) return;
    const tid = el.dataset.t;
    if (el.dataset.act === 'check') {
      const tr = TRACK_BY[ui.track], arr = getChecks(tr).map(x => Object.assign({}, x));
      arr[Number(el.dataset.i)].done = el.checked;
      state.settings.checks[tr.id] = arr; saveSettings();
    } else if (el.dataset.act === 'goal') {
      const g = state.settings.goals[tid] = state.settings.goals[tid] || {};
      g[el.dataset.i] = el.value === '' ? null : Math.min(Math.max(Math.round(Number(el.value)) || 0, 0), 99999);
      saveSettings();
    } else if (el.dataset.act === 'cohort') {
      state.settings.cohort = intIn(el.value, 2000, 2100) || 0;
      saveSettings(); render();
    } else if (el.dataset.act === 'exam') {
      if (isDate(el.value)) state.settings.exams[tid] = el.value; else delete state.settings.exams[tid];
      saveSettings(); renderProgress();
    } else if (el.dataset.act === 'me' || el.dataset.act === 'sv') {
      state.settings[el.dataset.act] = cleanTxt(el.value, 20);
      saveSettings();
    } else if (el.dataset.act === 'range') {
      const r = state.settings.range[tid] = state.settings.range[tid] || {};
      if (isDate(el.value)) r[el.dataset.f] = el.value; else delete r[el.dataset.f];
      saveSettings();
    }
  });
  document.addEventListener('input', ev => {
    const id = ev.target.id;
    if (id === 'logQ') { ui.logLimit = 60; renderLog(); }
    else if (id === 'dzQ') renderDz();
    else if (id === 'aq') renderAOverview();
    else if (id === 'slotQ') { ui.slotQ = ev.target.value; const pk = $('slotPick'); if (pk) pk.innerHTML = slotPickHtml(); }
  });
  document.addEventListener('dragover', ev => {
    const z = ev.target.closest && ev.target.closest('#impDrop');
    if (z) { ev.preventDefault(); z.classList.add('over'); }
  });
  document.addEventListener('dragleave', ev => { const z = $('impDrop'); if (z) z.classList.remove('over'); });
  document.addEventListener('drop', ev => {
    const z = ev.target.closest && ev.target.closest('#impDrop');
    if (!z) return;
    ev.preventDefault(); z.classList.remove('over');
    if (ev.dataTransfer && ev.dataTransfer.files && ev.dataTransfer.files[0]) onImpFile(ev.dataTransfer.files[0]);
  });
  document.addEventListener('visibilitychange', refreshData);
}

/* 別の端末で更新された内容を、操作の合間に取り込む */
async function refreshData(){
  if (document.visibilityState !== 'visible') return;
  if (state.mode !== 'gas' || !state.session || !state.session.me || ui.screen !== 'member' || ui.asMember) return;
  if (dirty.size || flushing || ui.imp || ui.view === 'settings' || Date.now() - lastLoad < 90000) return;
  try {
    const r = await rpc('api_load', state.session.token);
    if (dirty.size || flushing || ui.asMember) return;
    applyLoad(r); render();
  } catch (e) { handleAuthErr(e); }
}

/* ---------- 起動 ---------- */
async function init(){
  $('fDate').value = todayStr();
  $('logCat').innerHTML = '<option value="">すべての区分</option>' + CATS.map(c => '<option value="' + c.k + '">' + esc(c.label) + '</option>').join('');
  bindEvents();
  tplLoadSaved().then(() => { if (ui.screen !== 'auth') renderTplFile(); });
  if (!GASRUN) {                                  // サーバーがない環境（HTMLを直接開いた場合）: このブラウザだけに保存
    state.mode = 'local'; loadLocal(); state.ready = true; state.loaded = true;
    ui.screen = 'member'; setStatus('local'); render(); return;
  }
  state.mode = 'gas'; ui.screen = 'auth'; render();
  rpc('api_ping').then(p => { ui.ping = p; state.appUrl = p.url || ''; render(); }).catch(() => {});
  const s = loadSess();
  if (s) {
    state.session = {token: s.token, me: s.me || null, admin: !!s.admin};
    try { await enterSession(); }
    catch (e) {
      state.session = null; saveSess();
      ui.authErr = e.code === 'auth' ? 'ログインの有効期限が切れました。もう一度ログインしてください。' : (e.code === 'not_setup' || e.code === 'not_configured' ? '' : '接続できませんでした。もう一度ログインしてください。');
      render();
    }
  }
}
init();
