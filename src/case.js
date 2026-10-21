
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
    const ok = k === 'dz' || CAT_BY[k] || /^t_(hp|imrt|srt|brachy|special)$/.test(k);
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
  const rep = {kind: 'base', counts: {}, cut: {}, noAge: 0, noSex: 0, noFac: 0, noCode: 0, slots: 0, slotNoDiag: 0, total: 0, expanded: 0};
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
/* ---------- 診断専門医・治療専門医の「専攻医研修手帳」（日本専門医機構） ---------- */
const TPL_KINDS = [
  {id: 'base', name: '放射線科専門医（基本領域）', track: 'base', file: '経験症例記録の様式'},
  {id: 'diag', name: '診断専門医', track: 'diag', file: '専攻医研修手帳（放射線診断領域）'},
  {id: 'rt', name: '治療専門医', track: 'rt', file: '専攻医研修手帳（放射線治療領域）'}
];
const KIND_BY = {}; TPL_KINDS.forEach(k => { KIND_BY[k.id] = k; });
// シート名・先頭の行・様式の行数（cap）。診断の行数は様式の既定値（足りなければ行を追加する）
const NB = {
  diag: {
    first: 6,
    sheets: {
      xray: {name: '形成評価（Ⅳ.経験B.単純）', cap: 403}, gi: {name: '形成評価（Ⅳ.経験B.消化管）', cap: 63}, us: {name: '形成評価（Ⅳ.経験B.超音波）', cap: 123},
      ct: {name: '形成評価（Ⅳ.経験B.CT）', cap: 603}, mri: {name: '形成評価（Ⅳ.経験B.MRI）', cap: 303}, rn: {name: '形成評価（Ⅳ.経験B.核医）', cap: 53},
      ivr: {name: '形成評価（Ⅳ.経験 C.IVR）', cap: 33}
    },
    marks: ['施設番号', '研修指導医確認', '手技・治療法']
  },
  rt: {
    sheets: {
      head: {name: '☆形成評価（Ⅳ.経験症例 A.部位-頭部・頭頸部）', first: 7, cap: 150, cat: 'rt_head'},
      chest: {name: '☆形成評価（Ⅳ.経験症例 A.部位-胸部）', first: 7, cap: 150, cat: 'rt_chest'},
      abd: {name: '☆形成評価（Ⅳ.経験症例 A.部位-腹部 骨盤部）', first: 7, cap: 150, cat: 'rt_abd'},
      msk: {name: '☆形成評価（Ⅳ.経験症例 A.部位-四肢・皮膚・その他）', first: 7, cap: 150, cat: 'rt_msk'},
      brachy: {name: '☆形成評価（Ⅳ.治療技術 B.技術-密封小線源）', first: 7, cap: 33, tech: 'brachy'},
      imrt: {name: '☆形成評価（Ⅳ.治療技術 B.技術-高精度治療-強度変調）', first: 6, cap: 33, tech: 'imrt'},
      srt: {name: '☆形成評価（Ⅳ.治療技術 B.技術-高精度治療-定位放射線照射', first: 6, cap: 33, tech: 'srt'},
      special: {name: '☆形成評価（Ⅳ.治療技術 B.技術-特殊治療）', first: 6, cap: 33, tech: 'special'}
    },
    marks: ['施設番号', '初期治療医', '照射部位', '核種']
  }
};
function nbNo(f){ return f.k || f.n || ''; }                       // 手帳の「施設番号」: 設定の施設番号。無ければ施設名
function ymd8(d){ return d.replace(/-/g, ''); }
function monthSerial(m){ return m ? dateSerial(m + '-01') : ''; }
function gy(n){ return n == null ? '' : n + ' Gy'; }
function totalDose(e){ return e.td != null ? e.td : (e.ds != null && e.fx != null ? Math.round(e.ds * e.fx * 100) / 100 : null); }
function noteCase(rep, e, f){
  rep.total++;
  if (e.dup) rep.expanded++;
  if (e.a == null) rep.noAge++;
  if (!e.x) rep.noSex++;
  if (!f.n) rep.noFac++; else if (!f.k) rep.noNo++;
}
function newNbReport(kind){ return {kind: kind, counts: {}, cut: {}, added: {}, noAge: 0, noSex: 0, noFac: 0, noNo: 0, noMe: 0, noDetail: 0, hpSkipped: 0, total: 0, expanded: 0}; }

// 診断専門医の専攻医研修手帳: B.検査（単純・消化管・超音波・CT・MRI・核医学）とC.IVR。行が足りなければ書き込み時に行を足す
function buildDiagData(entries, st){
  const rep = newNbReport('diag'), first = NB.diag.first, S = NB.diag.sheets;
  const all = expandCases(entries), me = st.me || '', sv = st.sv || '', sheets = {}, need = {};
  B_ORDER.forEach(k => {
    const list = all.filter(e => e.c === k), rows = {};
    list.forEach((e, i) => {
      const f = facOf(st, e.s); noteCase(rep, e, f);
      rows[first + i] = {B: nbNo(f), C: ymd8(e.d), D: e.a, E: e.x, F: e.p, G: e.q, H: e.r, I: e.z, J: e.f1 || me, K: e.f2 || sv};
    });
    sheets[k] = rows; need[k] = first - 1 + list.length; rep.counts[k] = list.length;
  });
  const list = all.filter(e => e.c === 'ivr_v' || e.c === 'ivr_n'), rows = {};
  list.forEach((e, i) => {
    const f = facOf(st, e.s); noteCase(rep, e, f);
    rows[first + i] = {B: nbNo(f), C: ymd8(e.d), D: e.a, E: e.x, F: e.z, G: e.h, H: e.c === 'ivr_v' ? '血管系' : '非血管系', I: e.o ? '○' : '', J: e.f1 || me, K: e.ro, L: e.f2 || sv};
  });
  sheets.ivr = rows; need.ivr = first - 1 + list.length; rep.counts.ivr = list.length;
  Object.keys(S).forEach(k => { const add = (need[k] || 0) - (first - 1 + S[k].cap); if (add > 0) rep.added[k] = add; });
  return {sheets: sheets, report: rep, need: need};
}

// 治療専門医の専攻医研修手帳: 部位別の4シート（A.）と治療技術の4シート（B.）。同じ症例が部位別と技術の両方に入ることがある
function buildRtData(entries, st){
  const rep = newNbReport('rt'), S = NB.rt.sheets;
  const all = expandCases(entries).filter(e => CAT_BY[e.c].g === 'rt'), me = st.me || '', sv = st.sv || '', sheets = {};
  const fxs = e => e.fx != null ? e.fx + '回' : '';
  const roS = e => e.ro ? '（' + e.ro + '）' : '';
  Object.keys(S).filter(k => S[k].cat).forEach(k => {
    const pc = pickCap(all.filter(e => e.c === S[k].cat), S[k].cap), rows = {};
    pc.rows.forEach((e, i) => {
      const f = facOf(st, e.s); noteCase(rep, e, f);
      if (!(e.f1 || me)) rep.noMe++;
      if (!e.dup && (!e.pu || e.fx == null)) rep.noDetail++;
      const kindName = e.mt || e.tx || (e.t === 'imrt' ? 'IMRT' : e.t === 'brachy' ? '密封小線源治療' : '');
      rows[S[k].first + i] = {B: nbNo(f), C: e.a, D: e.x, E: e.u, F: e.z, G: e.p, H: kindName, I: e.pu, J: gy(e.ds), K: fxs(e), L: gy(totalDose(e)),
        M: dateSerial(e.d), N: monthSerial(e.d2), O: e.ae, P: e.f1 || me, Q: roS(e), S: e.f2 || sv};
    });
    sheets[k] = rows; rep.counts[k] = pc.rows.length; if (pc.cut) rep.cut[k] = pc.cut;
  });
  rep.hpSkipped = all.filter(e => e.t === 'hp').length;
  Object.keys(S).filter(k => S[k].tech).forEach(k => {
    const pc = pickCap(all.filter(e => e.t === S[k].tech), S[k].cap), rows = {};
    pc.rows.forEach((e, i) => {
      const f = facOf(st, e.s), td = totalDose(e);
      rows[S[k].first + i] = k === 'brachy'
        ? {B: nbNo(f), C: e.a, D: e.x, E: e.u, F: e.z, G: e.p, H: e.pu, I: e.nu, J: fxs(e), K: gy(td), L: dateSerial(e.d), M: e.ae, N: e.f1 || me, O: roS(e), Q: e.f2 || sv}
        : {B: nbNo(f), C: e.a, D: e.x, E: e.u, F: e.z, G: k === 'special' ? (e.tx || e.mt || '') : e.p, H: e.pu, I: fxs(e), J: gy(td), K: dateSerial(e.d), L: monthSerial(e.d2), M: e.ae, N: e.f1 || me, Q: e.f2 || sv};
    });
    sheets[k] = rows; rep.counts[k] = pc.rows.length; if (pc.cut) rep.cut[k] = pc.cut;
  });
  return {sheets: sheets, report: rep, need: {}};
}
function buildKindData(kind, entries, st){
  return kind === 'diag' ? buildDiagData(entries, st) : kind === 'rt' ? buildRtData(entries, st) : buildTemplateData(entries, st);
}

// 行を足す: 最後の番号つきの行（A列が数字の行）を複製して、必要な行数まで増やす。後ろにある行（注記など）は下へずらす
function lastNumRow(xml){
  let last = 0;
  xml.replace(/<c r="A(\d+)"([^>]*)><v>[^<]*<\/v>/g, (m, r, a) => { if (!/\bt="/.test(a)) last = Math.max(last, Number(r)); return m; });
  return last;
}
function shiftRowRef(ref, from, by){
  return ref.replace(/([A-Z]+)(\d+)/g, (m, c, r) => c + (Number(r) > from ? Number(r) + by : r));
}
function extendSheetXml(xml, need){
  const last = lastNumRow(xml);
  if (!last || need <= last) return {xml: xml, added: 0};
  const extra = need - last;
  const rowRe = r => new RegExp('<row r="' + r + '"[^>]*?(?:/>|>[\\s\\S]*?</row>)');
  const lm = rowRe(last).exec(xml), mm = rowRe(last - 1).exec(xml);
  if (!lm || !mm) return {xml: xml, added: 0};
  const n0 = Number((/<c r="A\d+"[^>]*><v>(\d+)<\/v>/.exec(lm[0]) || [0, 0])[1]);
  const clone = (row, r, n) => row.replace(/<row r="\d+"/, '<row r="' + r + '"').replace(/<c r="([A-Z]+)\d+"/g, (m, c) => '<c r="' + c + r + '"')
    .replace(/(<c r="A\d+"[^>]*><v>)\d+(<\/v>)/, '$1' + n + '$2');
  let add = '';
  for (let i = 1; i <= extra; i++) add += clone(i === extra ? lm[0] : mm[0], last + i, n0 + i);
  const end = lm.index + lm[0].length, close = xml.indexOf('</sheetData>');
  const tail = xml.slice(end, close).replace(/<row r="(\d+)"[^>]*?(?:\/>|>[\s\S]*?<\/row>)/g, row => {
    const r = Number(/r="(\d+)"/.exec(row)[1]);
    return row.replace(/<row r="\d+"/, '<row r="' + (r + extra) + '"').replace(/<c r="([A-Z]+)(\d+)"/g, (m, c, rr) => '<c r="' + c + (Number(rr) + extra) + '"');
  });
  let out = xml.slice(0, lm.index) + clone(mm[0], last, n0) + add + tail + xml.slice(close);
  out = out.replace(/(<mergeCell ref=")([^"]+)(")/g, (m, a, ref, b) => a + shiftRowRef(ref, last, extra) + b)
    .replace(/<dimension ref="([A-Z]+\d+):([A-Z]+)(\d+)"/, (m, a, c, r) => '<dimension ref="' + a + ':' + c + (Number(r) >= last ? Number(r) + extra : r) + '"');
  return {xml: out, added: extra};
}

const SHEET_LABEL = {xray: '単純X線', gi: '消化管', us: '超音波', ct: 'CT', mri: 'MRI', rn: '核医学', ivr: 'IVR', rt: '放射線治療',
  head: '脳・頭頸部', chest: '胸部', abd: '腹部・骨盤部', msk: '四肢・皮膚・その他', brachy: '密封小線源', imrt: '強度変調', srt: '定位放射線照射', special: '特殊治療'};
function reportWarnings(rep){
  const w = [];
  if (rep.noFac) w.push('施設名が入っていない症例が ' + rep.noFac + ' 件あります（設定で施設を登録すると入ります）。');
  if (rep.noCode) w.push('施設コード（9桁）が未設定の症例が ' + rep.noCode + ' 件あります。');
  if (rep.noNo) w.push('施設番号（例: 総-12）が未設定の症例が ' + rep.noNo + ' 件あります。施設名を書き込みました（設定の施設に「施設番号」を入れると、その番号が入ります）。');
  if (rep.noAge) w.push('年齢が未入力の症例が ' + rep.noAge + ' 件あります。');
  if (rep.noSex) w.push('性別が未入力の症例が ' + rep.noSex + ' 件あります。');
  if (rep.noMe) w.push('初期治療医（自分の氏名）が空の症例が ' + rep.noMe + ' 件あります。様式の「小計」は初期治療医の欄の入力を数えるため、設定で「自分の氏名」を入れてください。');
  if (rep.noDetail) w.push('目的・照射回数が未入力の症例が ' + rep.noDetail + ' 件あります（様式の項目です。登録画面で入力するか、出力したExcelに直接書き足してください）。');
  if (rep.hpSkipped) w.push('「高精度（強度変調・定位の区別なし）」の記録 ' + rep.hpSkipped + ' 件は、強度変調か定位か分からないため、治療技術のシートには書き込めませんでした。編集して種別を選び直してください。');
  if (rep.expanded) w.push('件数だけで登録された記録を ' + rep.expanded + ' 行に展開しました（年齢・性別などは空欄です）。');
  if (rep.slotNoDiag) w.push('疾患・病態名が空の疾患群の枠が ' + rep.slotNoDiag + ' 件あります。');
  Object.keys(rep.added || {}).forEach(k => {
    if (rep.added[k] > 0) w.push((SHEET_LABEL[k] || k) + 'は様式の行数を超えたため、行を ' + rep.added[k] + ' 行追加して書き込みました（様式の見た目はそのままです）。');
  });
  Object.keys(rep.cut || {}).forEach(k => {
    w.push((SHEET_LABEL[k] || k) + 'は様式の行数を超えたため、' + rep.cut[k] + ' 件を書き込めませんでした' + (rep.kind === 'rt' ? '。' : '（疾患群に使った症例は優先して残しています）。'));
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
// xlsx（JSZipで開いたもの）が、想定した様式かを調べる。{kind, problems: [...], files: {キー: シートのパス}, xml: {キー: シートXML}}
// kind: 'base'（放射線科専門医の経験症例記録）/ 'diag'（診断専門医の専攻医研修手帳）/ 'rt'（治療専門医の専攻医研修手帳）
async function checkTemplateZip(zip){
  const bad = m => ({kind: '', problems: [m], files: {}, xml: {}});
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
  const has = n => !!byName[noWs(n)];
  const rtS = NB.rt.sheets, dgS = NB.diag.sheets;
  let kind = '';
  if (has(TPL_SHEETS.a.name)) kind = 'base';
  else if (Object.keys(rtS).some(k => has(rtS[k].name))) kind = 'rt';
  else if (has(dgS.xray.name) && has(dgS.ivr.name)) kind = 'diag';
  if (!kind) return bad('シート「' + TPL_SHEETS.a.name + '」が見つかりません。対応しているのは、放射線科専門医の経験症例記録、診断専門医・治療専門医の専攻医研修手帳です。');
  const spec = kind === 'base' ? TPL_SHEETS : NB[kind].sheets;
  const problems = [], files = {}, xml = {};
  for (const k of Object.keys(spec)) {
    const path = byName[noWs(spec[k].name)];
    if (!path || !zip.file(path)) { problems.push('シート「' + spec[k].name + '」が見つかりません。'); continue; }
    files[k] = path;
    xml[k] = await zip.file(path).async('string');
    let need;
    if (kind === 'base') need = k === 'a' ? Math.max.apply(null, SLOTS.map(x => x.row)) : 5 + spec[k].cap;
    else if (kind === 'rt') need = spec[k].first + spec[k].cap - 1;
    else need = NB.diag.first;                                    // 診断は、足りない行を書き込み時に足す
    if (xml[k].indexOf('<row r="' + need + '"') < 0) problems.push('「' + spec[k].name + '」の行数が想定（' + need + '行目まで）と違います。');
  }
  if (problems.length) return {kind: kind, problems: problems, files: files, xml: xml};
  // 様式の版の違いの検出: 基本領域は、疾患群・領域・放射線治療の部位の名前。診断・治療は、項目名
  const sst = zip.file('xl/sharedStrings.xml');
  let text = '';
  if (sst) (await sst.async('string')).replace(/<si>([\s\S]*?)<\/si>/g, (m, inner) => { text += '\n' + noWs(xmlUnesc((inner.match(/<t\b[^>]*>[^<]*<\/t>/g) || []).map(t => t.replace(/<[^>]+>/g, '')).join(''))); return m; });
  let names;
  if (kind === 'base') {
    text += '\n' + noWs(xmlUnesc((xml.a.match(/<t\b[^>]*>[^<]*<\/t>/g) || []).map(t => t.replace(/<[^>]+>/g, '')).join('\n')));
    names = TPL_AREAS.concat(SLOTS.map(x => x.grp), Object.keys(TPL_RT_SITES).map(k => TPL_RT_SITES[k]));
  } else names = NB[kind].marks;
  const miss = Array.from(new Set(names)).filter(x => text.indexOf(noWs(x)) < 0);
  if (miss.length) problems.push('様式の内容が想定と違います（「' + miss.slice(0, 3).join('」「') + '」' + (miss.length > 3 ? 'など' + miss.length + '件' : '') + 'が見つかりません）。様式のバージョンが違う可能性があります。');
  return {kind: kind, problems: problems, files: files, xml: xml};
}
// src: base64文字列 / Uint8Array / ArrayBuffer
async function openTemplate(JSZ, src){
  if (src == null || src === '') throw new Error('様式ファイルが選ばれていません。');
  let zip;
  try { zip = typeof src === 'string' ? await JSZ.loadAsync(src, {base64: true}) : await JSZ.loadAsync(src); }
  catch (e) { throw new Error('Excel（.xlsx）ファイルとして読み込めませんでした。'); }
  const chk = await checkTemplateZip(zip);
  if (chk.problems.length) { const e = new Error(chk.problems[0]); e.problems = chk.problems; throw e; }
  return {kind: chk.kind, zip: zip, files: chk.files, xml: chk.xml};
}
// 様式の種類は、ファイルの中身から自動で判別する（kind を渡すと、違う種類のときはエラーにする）
async function buildTemplateXlsx(JSZ, entries, st, src, kind){
  const t = await openTemplate(JSZ, src == null ? (typeof TPL_B64 === 'string' ? TPL_B64 : '') : src);
  if (kind && kind !== t.kind) throw new Error('選んだ様式ファイルは「' + KIND_BY[t.kind].name + '」の様式です（「' + KIND_BY[kind].name + '」ではありません）。');
  const data = buildKindData(t.kind, entries, st);
  Object.keys(t.files).forEach(k => {
    let x = t.xml[k];
    if (data.need && data.need[k]) {
      const r = extendSheetXml(x, data.need[k]);
      x = r.xml;
      if (r.added > 0) data.report.added[k] = r.added; else delete data.report.added[k];
    }
    t.zip.file(t.files[k], fillSheetXml(x, data.sheets[k] || {}));
  });
  // 小計・合計の数式は、Excelで開いたときに必ず計算し直させる（書き込む前の計算結果が残らないように）
  const wbf = t.zip.file('xl/workbook.xml');
  if (wbf) {
    const w = await wbf.async('string');
    t.zip.file('xl/workbook.xml', w.replace(/<calcPr\b([^>]*?)(\/?)>/, (m, a, sl) => /fullCalcOnLoad=/.test(a) ? m : '<calcPr' + a + ' fullCalcOnLoad="1"' + sl + '>'));
  }
  const bytes = await t.zip.generateAsync({type: 'uint8array', compression: 'DEFLATE', compressionOptions: {level: 6}});
  return {bytes: bytes, report: data.report, kind: t.kind};
}
