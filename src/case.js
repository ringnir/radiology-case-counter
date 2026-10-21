
/* ---------- 疾患群の枠（研修手帳「A.疾患」の100枠） ---------- */
const SLOTS = TPL_SLOTS.map(a => ({no: a[0], row: a[1], area: a[2], grp: a[3], gi: a[4], size: a[5]}));
function slotLabel(no){
  const s = SLOTS[no - 1];
  return s ? s.grp + (s.size > 1 ? '（' + (s.gi + 1) + '/' + s.size + '）' : '') : '';
}
function slotAreas(){
  const areas = TPL_AREAS.map(n => ({name: n, groups: []}));
  SLOTS.forEach(s => {
    const A = areas[s.area];
    if (s.gi === 0 || !A.groups.length) A.groups.push({name: s.grp, size: s.size, slots: [s.no]});
    else A.groups[A.groups.length - 1].slots.push(s.no);
  });
  return areas;
}
// 枠番号 → その枠に割り当てた症例（同じ枠が重複していたら、日付の早いほうを採用）
function slotMap(entries){
  const m = {};
  entries.forEach(e => {
    if (!e.k) return;
    const cur = m[e.k];
    if (!cur || e.d < cur.d || (e.d === cur.d && e.id < cur.id)) m[e.k] = e;
  });
  return m;
}

/* ---------- 入学年度・受験予定・残り日数 ---------- */
function dayNum(s){ const a = s.split('-').map(Number); return Math.round(Date.UTC(a[0], a[1] - 1, a[2]) / 86400000); }
function daysUntil(d, today){ return dayNum(d) - dayNum(today || todayStr()); }
function paceOf(rest, days){
  if (!(days > 0) || !(rest > 0)) return null;
  const w = days / 7;
  return {perWeek: Math.round(rest / w * 10) / 10, perDay: Math.round(rest / days * 100) / 100, weeks: Math.round(w * 10) / 10};
}
function examState(st, trackId, rest, today){
  const d = st.exams && st.exams[trackId];
  if (!d) return null;
  const days = daysUntil(d, today);
  return {date: d, days: days, rest: rest, pace: paceOf(rest, days), past: days < 0, today: days === 0};
}
// 今日以降でいちばん近い受験予定
function nextExam(st, today){
  let best = null;
  TRACKS.forEach(t => {
    const d = st.exams && st.exams[t.id];
    if (!d) return;
    const days = daysUntil(d, today);
    if (days >= 0 && (!best || days < best.days)) best = {id: t.id, date: d, days: days};
  });
  return best;
}
function cohortLabel(y){ return y ? y + '年度入学' : '未設定'; }
function cohortOptions(){
  const y = new Date().getFullYear(), out = [];
  for (let i = y + 1; i >= y - 9; i--) out.push(i);
  return out;
}

/* ---------- 管理者の一覧用: 自分の集計（保存のたびに一緒に保存する） ---------- */
function makeSummary(entries, st){
  const tr = {};
  TRACKS.forEach(t => { tr[t.id] = tally(entries, st.range[t.id]); });
  let n = 0, lastD = '', inc = 0;
  entries.forEach(e => {
    n += e.n; if (e.d > lastD) lastD = e.d;
    if (CAT_BY[e.c].g === 'img' && (e.a == null || !e.x)) inc += e.n;
  });
  return {v: 1, n: n, lastD: lastD, inc: inc, tl: tally(entries), tr: tr};
}
function cleanTally(raw){
  const o = {};
  if (!raw || typeof raw !== 'object') return o;
  Object.keys(raw).forEach(k => {
    const ok = k === 'dz' || CAT_BY[k] || /^t_(hp|brachy|special)$/.test(k);
    const v = raw[k];
    if (ok && typeof v === 'number' && isFinite(v) && v >= 0) o[k] = Math.min(Math.round(v), 99999);
  });
  return o;
}
function sanitizeSummary(raw){
  if (!raw || typeof raw !== 'object') return null;
  const o = {v: 1, n: 0, lastD: '', inc: 0, tl: cleanTally(raw.tl), tr: {}};
  const num = v => (typeof v === 'number' && isFinite(v) && v >= 0 ? Math.min(Math.round(v), 999999) : 0);
  o.n = num(raw.n); o.inc = num(raw.inc);
  if (isDate(raw.lastD)) o.lastD = raw.lastD;
  TRACKS.forEach(t => { o.tr[t.id] = cleanTally(raw.tr && raw.tr[t.id]); });
  return o;
}

/* ---------- 研修手帳の様式（xlsx）への書き込み ---------- */
const MOD_LABEL = {xray: '単純X線', gi: '消化管', us: '超音波', ct: 'CT', mri: 'MRI', rn: '核医学'};
const B_ORDER = ['xray', 'gi', 'us', 'ct', 'mri', 'rn'];
const RT_BLOCK = {rt_head: 1, rt_chest: 5, rt_abd: 9, rt_msk: 13};     // 放射線治療シートの部位別の先頭番号（各4行）

function dateSerial(s){
  const a = s.split('-').map(Number);
  return (Date.UTC(a[0], a[1] - 1, a[2]) - Date.UTC(1899, 11, 30)) / 86400000;
}
function facOf(st, name){
  const list = (st && st.facs) || [];
  if (name) { const f = list.find(x => x.n === name); return f || {n: name, c: ''}; }
  return list[0] || {n: '', c: ''};
}
function sortAsc(list){ return list.slice().sort((a, b) => a.d === b.d ? (a.id < b.id ? -1 : a.id > b.id ? 1 : 0) : (a.d < b.d ? -1 : 1)); }
// 件数が2以上の記録は、その件数ぶんの行に展開する（詳細のない行になる）
function expandCases(entries){
  const out = [];
  sortAsc(entries).forEach(e => {
    for (let i = 0; i < (e.n || 1); i++) {
      const c = Object.assign({}, e, {n: 1});
      if (i > 0) { delete c.k; c.dup = 1; }
      out.push(c);
    }
  });
  return out;
}
// 様式の行数を超えるときは、疾患群の枠に使った症例を必ず残し、あとは日付の古い順に詰める
function pickCap(list, cap){
  if (list.length <= cap) return {rows: list, cut: 0};
  const keep = new Set(list.filter(e => e.k));
  let room = cap - keep.size;
  for (const e of list) { if (room <= 0) break; if (!keep.has(e)) { keep.add(e); room--; } }
  const rows = list.filter(e => keep.has(e));
  return {rows: rows, cut: list.length - rows.length};
}
function buildTemplateData(entries, st){
  const rep = {counts: {}, cut: {}, noAge: 0, noSex: 0, noFac: 0, noCode: 0, slots: 0, slotNoDiag: 0, total: 0, expanded: 0};
  const sheets = {a: {}};
  const all = expandCases(entries);
  const me = st.me || '', sv = st.sv || '';
  const note = (e, f) => {
    rep.total++;
    if (e.dup) rep.expanded++;
    if (e.a == null) rep.noAge++;
    if (!e.x) rep.noSex++;
    if (!f.n) rep.noFac++; else if (!f.c) rep.noCode++;
  };
  B_ORDER.forEach(k => {
    const pc = pickCap(all.filter(e => e.c === k), TPL_SHEETS[k].cap);
    const rows = {};
    pc.rows.forEach((e, i) => {
      const no = i + 1, f = facOf(st, e.s);
      note(e, f);
      rows[5 + no] = {B: f.n, C: f.c, D: dateSerial(e.d), E: e.a, F: e.x, G: e.p, H: e.q, I: e.r, J: e.z, K: e.f1 || me, L: e.f2 || sv};
      if (e.k && SLOTS[e.k - 1] && !sheets.a[SLOTS[e.k - 1].row]) {
        sheets.a[SLOTS[e.k - 1].row] = {D: f.n, E: f.c, F: dateSerial(e.d), G: e.a, H: e.x, I: e.z || '', J: MOD_LABEL[k], K: no};
        rep.slots++;
        if (!e.z) rep.slotNoDiag++;
      }
    });
    sheets[k] = rows; rep.counts[k] = pc.rows.length; if (pc.cut) rep.cut[k] = pc.cut;
  });
  // IVR
  {
    const pc = pickCap(all.filter(e => e.c === 'ivr_v' || e.c === 'ivr_n'), TPL_SHEETS.ivr.cap), rows = {};
    pc.rows.forEach((e, i) => {
      const f = facOf(st, e.s); note(e, f);
      rows[6 + i] = {B: f.n, C: f.c, D: dateSerial(e.d), E: e.a, F: e.x, G: e.z, H: e.h, I: e.c === 'ivr_v' ? '血管系' : '非血管系', J: e.o ? '○' : '', K: e.f1 || me, L: e.ro, M: e.f2 || sv};
    });
    sheets.ivr = rows; rep.counts.ivr = pc.rows.length; if (pc.cut) rep.cut.ivr = pc.cut;
  }
  // 放射線治療: 先頭の16行は部位が決まっている（各部位4件まで）。あふれた分は17行目以降に部位名つきで並べる
  {
    const rows = {}, over = [];
    Object.keys(RT_BLOCK).forEach(c => {
      const list = all.filter(e => e.c === c);
      list.slice(0, 4).forEach((e, i) => {
        const f = facOf(st, e.s); note(e, f);
        rows[6 + RT_BLOCK[c] - 1 + i] = {B: f.n, C: f.c, D: dateSerial(e.d), E: e.a, F: e.x, G: e.z, I: e.tx, J: e.f1 || me, K: e.f2 || sv};
      });
      list.slice(4).forEach(e => over.push(e));
    });
    const room = TPL_SHEETS.rt.cap - 16;
    sortAsc(over).slice(0, room).forEach((e, i) => {
      const f = facOf(st, e.s); note(e, f);
      rows[6 + 16 + i] = {B: f.n, C: f.c, D: dateSerial(e.d), E: e.a, F: e.x, G: e.z, H: TPL_RT_SITES[RT_BLOCK[e.c]], I: e.tx, J: e.f1 || me, K: e.f2 || sv};
    });
    sheets.rt = rows;
    rep.counts.rt = Object.keys(rows).length;
    if (over.length > room) rep.cut.rt = over.length - room;
  }
  return {sheets: sheets, report: rep};
}
function reportWarnings(rep){
  const w = [];
  if (rep.noFac) w.push('施設名が入っていない症例が ' + rep.noFac + ' 件あります（設定で施設を登録すると入ります）。');
  if (rep.noCode) w.push('施設コード（9桁）が未設定の症例が ' + rep.noCode + ' 件あります。');
  if (rep.noAge) w.push('年齢が未入力の症例が ' + rep.noAge + ' 件あります。');
  if (rep.noSex) w.push('性別が未入力の症例が ' + rep.noSex + ' 件あります。');
  if (rep.expanded) w.push('件数だけで登録された記録を ' + rep.expanded + ' 行に展開しました（年齢・性別などは空欄です）。');
  if (rep.slotNoDiag) w.push('疾患・病態名が空の疾患群の枠が ' + rep.slotNoDiag + ' 件あります。');
  Object.keys(rep.cut).forEach(k => {
    const nm = k === 'ivr' ? 'IVR' : k === 'rt' ? '放射線治療' : (CAT_BY[k] ? CAT_BY[k].short : k);
    w.push(nm + 'は様式の行数を超えたため、' + rep.cut[k] + ' 件を書き込めませんでした（疾患群に使った症例は優先して残しています）。');
  });
  return w;
}

const XML_BAD = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g;
function xmlEsc(s){ return String(s).replace(XML_BAD, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function colNum(L){ let n = 0; for (let i = 0; i < L.length; i++) n = n * 26 + L.charCodeAt(i) - 64; return n; }
function cellXml(ref, style, v){
  const sa = style != null ? ' s="' + style + '"' : '';
  if (v == null || v === '') return '<c r="' + ref + '"' + sa + '/>';
  if (typeof v === 'number') return '<c r="' + ref + '"' + sa + '><v>' + v + '</v></c>';
  return '<c r="' + ref + '"' + sa + ' t="inlineStr"><is><t xml:space="preserve">' + xmlEsc(v) + '</t></is></c>';
}
// rows: {行番号: {列記号: 値}}。値の入る行のセルだけを置き換え、書式・結合・入力規則はそのまま残す
function fillSheetXml(xml, rows){
  if (!Object.keys(rows).length) return xml;
  return xml.replace(/<row r="(\d+)"([^>]*?)(\/>|>([\s\S]*?)<\/row>)/g, (m, r, attrs, tail, inner) => {
    const upd = rows[r];
    if (!upd) return m;
    const cells = [], have = {};
    (inner || '').replace(/<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>[\s\S]*?<\/c>)/g, (cm, col, ca) => {
      const sm = /\ss="(\d+)"/.exec(ca);
      have[col] = 1;
      cells.push({n: colNum(col), x: Object.prototype.hasOwnProperty.call(upd, col) ? cellXml(col + r, sm ? sm[1] : null, upd[col]) : cm});
      return cm;
    });
    Object.keys(upd).forEach(col => { if (!have[col]) cells.push({n: colNum(col), x: cellXml(col + r, null, upd[col])}); });
    cells.sort((a, b) => a.n - b.n);
    return '<row r="' + r + '"' + attrs.replace(/\/$/, '') + '>' + cells.map(c => c.x).join('') + '</row>';
  });
}
/* ---------- 様式ファイル（学会配布のxlsx）の検査と書き込み ---------- */
function xmlUnesc(s){
  return String(s).replace(/&#(\d+);/g, (m, n) => String.fromCharCode(Number(n))).replace(/&#x([0-9a-fA-F]+);/g, (m, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
}
const noWs = s => String(s).replace(/[\s　]+/g, '');
// xlsx（JSZipで開いたもの）が、想定した様式かを調べる。{problems: [...], files: {キー: シートのパス}, xml: {キー: シートXML}}
async function checkTemplateZip(zip){
  const bad = m => ({problems: [m], files: {}, xml: {}});
  const wbf = zip.file('xl/workbook.xml'), rf = zip.file('xl/_rels/workbook.xml.rels');
  if (!wbf || !rf) return bad('Excel（.xlsx）ファイルとして読めませんでした。');
  const wbXml = await wbf.async('string'), relXml = await rf.async('string');
  const target = {};
  relXml.replace(/<Relationship\b[^>]*>/g, m => {
    const i = /\bId="([^"]+)"/.exec(m), t = /\bTarget="([^"]+)"/.exec(m);
    if (i && t) target[i[1]] = t[1].charAt(0) === '/' ? t[1].slice(1) : 'xl/' + t[1];
    return m;
  });
  const byName = {};
  wbXml.replace(/<sheet\b[^>]*>/g, m => {
    const n = /\bname="([^"]*)"/.exec(m), r = /\br:id="([^"]+)"/.exec(m);
    if (n && r && target[r[1]]) byName[noWs(xmlUnesc(n[1]))] = target[r[1]];
    return m;
  });
  const problems = [], files = {}, xml = {};
  const keys = Object.keys(TPL_SHEETS);
  for (const k of keys) {
    const path = byName[noWs(TPL_SHEETS[k].name)];
    if (!path || !zip.file(path)) { problems.push('シート「' + TPL_SHEETS[k].name + '」が見つかりません。'); continue; }
    files[k] = path;
    xml[k] = await zip.file(path).async('string');
    const need = k === 'a' ? Math.max.apply(null, SLOTS.map(x => x.row)) : 5 + TPL_SHEETS[k].cap;
    if (xml[k].indexOf('<row r="' + need + '"') < 0) problems.push('「' + TPL_SHEETS[k].name + '」の行数が想定（' + need + '行目まで）と違います。');
  }
  if (problems.length) return {problems: problems, files: files, xml: xml};
  // 疾患群・領域の名前が、様式の中に想定どおり並んでいるか（様式のバージョン違いの検出）
  const sst = zip.file('xl/sharedStrings.xml');
  let text = '';
  if (sst) (await sst.async('string')).replace(/<si>([\s\S]*?)<\/si>/g, (m, inner) => { text += '\n' + noWs(xmlUnesc((inner.match(/<t\b[^>]*>[^<]*<\/t>/g) || []).map(t => t.replace(/<[^>]+>/g, '')).join(''))); return m; });
  text += '\n' + noWs(xmlUnesc((xml.a.match(/<t\b[^>]*>[^<]*<\/t>/g) || []).map(t => t.replace(/<[^>]+>/g, '')).join('\n')));
  const names = TPL_AREAS.concat(SLOTS.map(x => x.grp), Object.keys(TPL_RT_SITES).map(k => TPL_RT_SITES[k]));
  const miss = Array.from(new Set(names)).filter(x => text.indexOf(noWs(x)) < 0);
  if (miss.length) problems.push('様式の内容が想定と違います（「' + miss.slice(0, 3).join('」「') + '」' + (miss.length > 3 ? 'など' + miss.length + '件' : '') + 'が見つかりません）。様式のバージョンが違う可能性があります。');
  return {problems: problems, files: files, xml: xml};
}
// src: base64文字列 / Uint8Array / ArrayBuffer
async function openTemplate(JSZ, src){
  if (src == null || src === '') throw new Error('様式ファイルが選ばれていません。');
  let zip;
  try { zip = typeof src === 'string' ? await JSZ.loadAsync(src, {base64: true}) : await JSZ.loadAsync(src); }
  catch (e) { throw new Error('Excel（.xlsx）ファイルとして読み込めませんでした。'); }
  const chk = await checkTemplateZip(zip);
  if (chk.problems.length) { const e = new Error(chk.problems[0]); e.problems = chk.problems; throw e; }
  return {zip: zip, files: chk.files, xml: chk.xml};
}
async function buildTemplateXlsx(JSZ, entries, st, src){
  const data = buildTemplateData(entries, st);
  const t = await openTemplate(JSZ, src == null ? (typeof TPL_B64 === 'string' ? TPL_B64 : '') : src);
  Object.keys(TPL_SHEETS).forEach(k => { t.zip.file(t.files[k], fillSheetXml(t.xml[k], data.sheets[k] || {})); });
  const bytes = await t.zip.generateAsync({type: 'uint8array', compression: 'DEFLATE', compressionOptions: {level: 6}});
  return {bytes: bytes, report: data.report};
}
