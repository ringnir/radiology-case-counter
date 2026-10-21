/*LOGIC_START*/
const CATS = [
  {k:'xray', g:'img', label:'X線単純撮影', short:'X線'},
  {k:'gi', g:'img', label:'消化管X線', short:'消化管'},
  {k:'us', g:'img', label:'超音波', short:'超音波'},
  {k:'ct', g:'img', label:'CT', short:'CT'},
  {k:'mri', g:'img', label:'MRI', short:'MRI'},
  {k:'rn', g:'img', label:'核医学', short:'核医学'},
  {k:'ivr_v', g:'ivr', label:'IVR 血管系', short:'血管系'},
  {k:'ivr_n', g:'ivr', label:'IVR 非血管系', short:'非血管系'},
  {k:'rt_head', g:'rt', label:'治療 脳・頭頸部', short:'脳・頭頸部'},
  {k:'rt_chest', g:'rt', label:'治療 胸部・乳腺', short:'胸部・乳腺'},
  {k:'rt_abd', g:'rt', label:'治療 腹部・骨盤', short:'腹部・骨盤'},
  {k:'rt_msk', g:'rt', label:'治療 骨軟部・四肢・皮膚・他', short:'骨軟部・他'}
];
const GROUPS = [
  {id:'img', label:'画像診断（読影・検査）', hint:'読影の経験とは、第一読影者としてレポートを作成し、指導医の確認を経て発行された読影を指します（基本領域の定義）。'},
  {id:'ivr', label:'IVR', hint:'IVRの経験とは、指導医とともに実施し、術者または第一助手を務めた手技を指します（基本領域の定義）。'},
  {id:'rt', label:'放射線治療', hint:'放射線治療の経験とは、第一立案者として治療計画を立案し、指導医の確認を受けた治療を指します（基本領域の定義）。'}
];
const TECHS = [
  {k:'imrt', label:'強度変調放射線治療'},
  {k:'srt', label:'定位放射線照射'},
  {k:'hp', label:'高精度放射線治療（強度変調・定位の区別なし）'},
  {k:'brachy', label:'密封小線源治療'},
  {k:'special', label:'特殊治療'}
];
const CAT_BY = {}; CATS.forEach(c => { CAT_BY[c.k] = c; });
const GROUP_BY = {}; GROUPS.forEach(g => { GROUP_BY[g.id] = g; });
const TECH_BY = {}; TECHS.forEach(t => { TECH_BY[t.k] = t; });
const RT4 = ['rt_head','rt_chest','rt_abd','rt_msk'];
// 放射線治療の「治療種別・技術」: t は治療技術（集計用）、mt は研修手帳の「治療種別」欄に書く名前
const RT_KINDS = [
  {id:'', label:'指定なし', t:'', mt:''},
  {id:'3dcrt', label:'3DCRT', t:'', mt:'3DCRT'},
  {id:'imrt', label:'強度変調放射線治療（IMRT）', t:'imrt', mt:'IMRT'},
  {id:'srt_h', label:'頭部定位放射線照射', t:'srt', mt:'頭部定位放射線照射'},
  {id:'srt_b', label:'体幹部定位放射線照射', t:'srt', mt:'体幹部定位放射線照射'},
  {id:'particle', label:'粒子線治療', t:'special', mt:'粒子線治療'},
  {id:'brachy', label:'密封小線源治療', t:'brachy', mt:'密封小線源治療'},
  {id:'special', label:'特殊治療（全身照射・術中照射など。内容は「治療法」に）', t:'special', mt:''},
  {id:'srt', label:'定位放射線照射（頭部・体幹を分けない）', t:'srt', mt:''},
  {id:'hp', label:'高精度（強度変調・定位の区別なし）', t:'hp', mt:''}
];
const RT_MT = RT_KINDS.filter(k => k.mt).map(k => k.mt);
const RT_PURPOSES = ['根治', '準根治', '姑息・緩和', '他'];
// 記録 → 選択肢のid（完全一致 → 技術だけ一致 → 種別だけ一致の順）
function rtKindId(e){
  const t = (e && e.t) || '', mt = (e && e.mt) || '';
  const hit = RT_KINDS.find(k => k.id && k.t === t && k.mt === mt) || RT_KINDS.find(k => k.id && t && k.t === t) || RT_KINDS.find(k => k.id && mt && k.mt === mt);
  return hit ? hit.id : '';
}

const TRACKS = [
  {
    id:'base', name:'放射線科専門医', sub:'基本領域', src:'off', srcTag:'学会資料に基づく',
    srcText:'研修手帳の様式（経験症例記録）の各シートの題に書かれた目標症例数と、学会の専門研修プログラム（作成：日本医学放射線学会。2015年12月承認、2023年5月修正版）に示された経験目標です。IVRは血管系10以上・非血管系5以上、放射線治療は4部位それぞれ4以上、疾患・病態は100枠のうち90以上です。',
    items:[
      {id:'xray', label:'X線単純撮影', keys:['xray'], goal:400, grp:'画像診断・読影'},
      {id:'gi', label:'消化管X線検査', keys:['gi'], goal:60},
      {id:'us', label:'超音波検査', keys:['us'], goal:120},
      {id:'ct', label:'CT', keys:['ct'], goal:600},
      {id:'mri', label:'MRI', keys:['mri'], goal:300},
      {id:'rn', label:'核医学検査', keys:['rn'], goal:50},
      {id:'ivr', label:'IVR', keys:['ivr_v','ivr_n'], goal:30, grp:'IVR'},
      {id:'ivr_v', label:'血管系（以上）', keys:['ivr_v'], goal:10, sub:1},
      {id:'ivr_n', label:'非血管系（以上）', keys:['ivr_n'], goal:5, sub:1},
      {id:'rt', label:'放射線治療', keys:RT4, goal:30, grp:'放射線治療'},
      {id:'rt_head', label:'脳・頭頸部（以上）', keys:['rt_head'], goal:4, sub:1},
      {id:'rt_chest', label:'胸部・乳腺（以上）', keys:['rt_chest'], goal:4, sub:1},
      {id:'rt_abd', label:'腹部・骨盤（以上）', keys:['rt_abd'], goal:4, sub:1},
      {id:'rt_msk', label:'骨軟部（以上）', keys:['rt_msk'], goal:4, sub:1},
      {id:'dz', label:'経験すべき疾患・病態', keys:['dz'], goal:90, grp:'疾患・病態', note:'研修手帳の100枠（11領域）のうち90以上'}
    ],
    checks:[
      '初期臨床研修期間を含め5年以上の臨床経験（申請時）',
      '日本医学放射線学会の正会員として3年以上（申請時）',
      '専門研修3年以上（うち1年以上は学会認定の総合修練機関）',
      '研修プログラム管理委員会による研修修了（または仮修了）の判定',
      '研修プログラムが定める講習会の受講記録',
      '研修プログラムが定める学術業績（学会発表・論文）の記録',
      '出願期間内に、受験申込（会員専用ページ）と願書類の提出'
    ]
  },
  {
    id:'diag', name:'診断専門医', sub:'サブスペシャルティ・診断', src:'off', srcTag:'学会資料に基づく',
    srcText:'日本専門医機構「専攻医研修手帳（放射線診断領域）」の経験症例記録（2023年12月付）に書かれた、専門研修が満了するまでの目標症例数です。受験資格は学会の診断専門医試験案内（第3回・2026年4月7日掲載）に基づきます。IVRは合計40例以上で、手技ごとの目標は研修手帳には載っていないため、血管系・非血管系の内訳は未設定にしてあります（血管系・非血管系を合わせて10例までは画像診断のみの検査を含めてよい、とされています）。',
    items:[
      {id:'xray', label:'X線単純撮影', keys:['xray'], goal:400, grp:'画像診断・読影'},
      {id:'gi', label:'消化管X線検査', keys:['gi'], goal:40},
      {id:'us', label:'超音波検査', keys:['us'], goal:50},
      {id:'ct', label:'CT', keys:['ct'], goal:1500},
      {id:'mri', label:'MRI', keys:['mri'], goal:1000},
      {id:'rn', label:'核医学検査', keys:['rn'], goal:60},
      {id:'ivr', label:'IVR', keys:['ivr_v','ivr_n'], goal:40, grp:'IVR'},
      {id:'ivr_v', label:'血管系', keys:['ivr_v'], goal:null, sub:1},
      {id:'ivr_n', label:'非血管系', keys:['ivr_n'], goal:null, sub:1}
    ],
    checks:[
      '初期臨床研修期間を含め7年以上の臨床経験（申請時）',
      '日本医学放射線学会の正会員として5年以上（申請時）',
      '研修管理委員会による研修修了（または仮修了）の判定',
      '研修期間中に、学術集会で筆頭演者として発表した記録',
      '研修期間中に、論文発表（筆頭著者または共著者）の記録',
      '講習会の受講記録（医療安全・感染対策・医療倫理を各1回以上）',
      '出願期間内に、受験申込（会員専用ページ）と願書類の提出'
    ]
  },
  {
    id:'rt', name:'治療専門医', sub:'サブスペシャルティ・治療', src:'off', srcTag:'学会資料に基づく',
    srcText:'日本専門医機構「専攻医研修手帳（放射線治療領域）」の経験症例記録（2023年12月付）に書かれた、専門研修が満了するまでの目標です。部位別の経験症例は合計200例以上（脳・頭頸部、胸部、腹部・骨盤部は各30例以上、四肢・皮膚・その他は設定なし）、治療技術は合計30件以上（密封小線源5件以上、高精度は強度変調5件以上と定位放射線照射5件以上で合計10件以上、特殊治療は設定なし）です。部位別と技術は重複して数えられます。受験資格は学会の治療専門医試験案内（第1回・2024年4月9日掲載）に基づきます。',
    items:[
      {id:'rt', label:'部位別の経験症例（合計）', keys:RT4, goal:200, grp:'部位別の経験症例'},
      {id:'rt_head', label:'脳・頭頸部（以上）', keys:['rt_head'], goal:30, sub:1},
      {id:'rt_chest', label:'胸部・乳腺（以上）', keys:['rt_chest'], goal:30, sub:1},
      {id:'rt_abd', label:'腹部・骨盤（以上）', keys:['rt_abd'], goal:30, sub:1},
      {id:'rt_msk', label:'四肢・皮膚・その他（設定なし）', keys:['rt_msk'], goal:null, sub:1},
      {id:'tech', label:'放射線治療技術（合計）', keys:['t_imrt','t_srt','t_hp','t_brachy','t_special'], goal:30, grp:'治療技術'},
      {id:'t_brachy', label:'密封小線源治療（以上）', keys:['t_brachy'], goal:5, sub:1},
      {id:'t_hp', label:'高精度放射線治療（強度変調＋定位の合計・以上）', keys:['t_imrt','t_srt','t_hp'], goal:10, sub:1},
      {id:'t_imrt', label:'　うち強度変調放射線治療（以上）', keys:['t_imrt'], goal:5, sub:1},
      {id:'t_srt', label:'　うち定位放射線照射（以上）', keys:['t_srt'], goal:5, sub:1},
      {id:'t_special', label:'特殊治療（設定なし）', keys:['t_special'], goal:null, sub:1}
    ],
    checks:[
      '日本医学放射線学会と日本放射線腫瘍学会の会員であること',
      '初期臨床研修期間を含め7年以上の臨床経験（申請時）',
      '日本医学放射線学会の正会員として5年以上、日本放射線腫瘍学会の正会員として2年以上（申請時）',
      '研修管理委員会による研修修了（または仮修了）の判定',
      '研修期間中に、学術集会で筆頭演者として発表した記録',
      '研修期間中に、論文発表（筆頭著者または共著者）の記録',
      '講習会の受講記録（医療安全〔放射線防護を含む〕・感染対策・医療倫理を必ず受講）',
      '出願期間内に、受験申込と願書類の提出'
    ]
  }
];
const TRACK_BY = {}; TRACKS.forEach(t => { TRACK_BY[t.id] = t; });

const DEMO = {xray:212, gi:31, us:64, ct:388, mri:171, rn:23, ivr_v:6, ivr_n:2, rt_head:3, rt_chest:5, rt_abd:4, rt_msk:1, dz:37, t_hp:3, t_brachy:1};

function pad(n){ return String(n).padStart(2, '0'); }
function todayStr(d){ d = d || new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
function isDate(s){
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const a = s.split('-').map(Number);
  const dt = new Date(Date.UTC(a[0], a[1] - 1, a[2]));
  return dt.getUTCFullYear() === a[0] && dt.getUTCMonth() === a[1] - 1 && dt.getUTCDate() === a[2];
}
function monthKey(d){ return 'm-' + d.slice(0, 7); }
function clampN(n){ n = Math.round(Number(n)); if (!isFinite(n) || n < 1) return 1; return Math.min(n, 999); }
function isId(id){ return typeof id === 'string' && /^[A-Za-z0-9_-]{4,40}$/.test(id); }

const TXT_MAX = {z:80, m:120, s:60, p:30, q:20, r:80, f1:20, f2:20, h:60, tx:60, u:20, ae:40, nu:12};
function intIn(v, lo, hi){
  if (v === '' || v == null) return null;
  const n = Math.round(Number(v));
  return isFinite(n) && n >= lo && n <= hi ? n : null;
}
function numIn(v, lo, hi, dec){
  if (v === '' || v == null) return null;
  const n = Number(v);
  if (!isFinite(n) || n < lo || n > hi) return null;
  const k = Math.pow(10, dec || 0);
  return Math.round(n * k) / k;
}
function isMonth(s){ return typeof s === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(s) && Number(s.slice(0, 4)) >= 2000 && Number(s.slice(0, 4)) <= 2100; }
function cleanTxt(v, max){ return String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max); }
// 1件の記録: d 日付 / c 区分 / n 件数 / a 年齢 / x 性別(M,F) / p 部位 / q 種別 / r 依頼内容 / z 診断名・疾患名 / k 疾患群の枠(1-100)
//          f1 第一読影者・術者・立案者 / f2 確定者・指導医 / h 手技(IVR) / tx 治療法(放射線治療) / ro 術・助 / o 診断のみ / t 治療技術 / s 施設 / m メモ
//          放射線治療のみ: mt 治療種別 / pu 目的 / p 照射部位 / u 依頼科 / ds 1回線量(Gy) / fx 照射回数 / td 全照射量(Gy) / d2 終了年月 / ae 有害事象 / nu 核種（小線源）
function sanitizeEntry(raw){
  if (!raw || typeof raw !== 'object') return null;
  if (!isDate(raw.d) || typeof raw.c !== 'string' || !CAT_BY[raw.c]) return null;
  const g = CAT_BY[raw.c].g;
  const e = {d: raw.d, c: raw.c, n: clampN(raw.n)};
  if (g === 'rt') {
    if (raw.t && TECH_BY[raw.t]) e.t = raw.t;
    if (raw.mt && RT_MT.indexOf(raw.mt) >= 0) e.mt = raw.mt;
    if (RT_PURPOSES.indexOf(raw.pu) >= 0) e.pu = raw.pu;
    const ds = numIn(raw.ds, 0.01, 100, 2); if (ds != null) e.ds = ds;
    const fx = intIn(raw.fx, 1, 99); if (fx != null) e.fx = fx;
    const td = numIn(raw.td, 0.1, 200, 2); if (td != null) e.td = td;
    if (isMonth(raw.d2)) e.d2 = raw.d2;
  }
  const a = intIn(raw.a, 0, 120); if (a != null) e.a = a;
  if (raw.x === 'M' || raw.x === 'F') e.x = raw.x;
  const keys = ['z', 'm', 's', 'f1', 'f2'];
  if (g === 'img') keys.push('p', 'q', 'r');
  if (g === 'ivr') keys.push('h');
  if (g === 'rt') keys.push('tx', 'p', 'u', 'ae', 'nu');
  keys.forEach(k => { if (raw[k]) { const v = cleanTxt(raw[k], TXT_MAX[k]); if (v) e[k] = v; } });
  if (g === 'img' && e.n === 1) { const k = intIn(raw.k, 1, 100); if (k != null) e.k = k; }
  if (g === 'ivr' || (g === 'rt' && e.t === 'brachy')) { if (raw.ro === '術' || raw.ro === '助') e.ro = raw.ro; }
  if (g === 'ivr' && raw.o) e.o = 1;
  return e;
}
function cleanMonths(rawMonths){
  const out = {};
  if (!rawMonths || typeof rawMonths !== 'object') return out;
  for (const mk in rawMonths) {
    const m = rawMonths[mk];
    if (!m || typeof m !== 'object') continue;
    for (const id in m) {
      if (!isId(id)) continue;
      const e = sanitizeEntry(m[id]);
      if (!e) continue;
      const k = monthKey(e.d);
      (out[k] = out[k] || {})[id] = e;
    }
  }
  return out;
}
function allEntries(months){
  const out = [];
  for (const mk in months) {
    const m = months[mk];
    for (const id in m) out.push(Object.assign({id: id}, m[id]));
  }
  return out;
}
function sortEntries(list){
  return list.sort((a, b) => a.d === b.d ? (a.id < b.id ? 1 : -1) : (a.d < b.d ? 1 : -1));
}

function defaultSettings(){ return {goals:{}, range:{}, checks:{}, backup:'', imp:null, cohort:0, exams:{}, ev:[], facs:[], me:'', sv:''}; }
function sanitizeSettings(s){
  const o = defaultSettings();
  if (!s || typeof s !== 'object') return o;
  if (typeof s.backup === 'string' && isDate(s.backup)) o.backup = s.backup;
  if (s.goals && typeof s.goals === 'object') {
    for (const t in s.goals) {
      if (!TRACK_BY[t] || !s.goals[t] || typeof s.goals[t] !== 'object') continue;
      const g = {};
      for (const id in s.goals[t]) {
        if (!TRACK_BY[t].items.some(i => i.id === id)) continue;
        const v = s.goals[t][id];
        if (v === null) g[id] = null;
        else if (typeof v === 'number' && isFinite(v) && v >= 0) g[id] = Math.min(Math.round(v), 99999);
      }
      o.goals[t] = g;
    }
  }
  if (s.range && typeof s.range === 'object') {
    for (const t in s.range) {
      if (!TRACK_BY[t] || !s.range[t] || typeof s.range[t] !== 'object') continue;
      const r = {};
      if (isDate(s.range[t].from)) r.from = s.range[t].from;
      if (isDate(s.range[t].to)) r.to = s.range[t].to;
      o.range[t] = r;
    }
  }
  if (s.checks && typeof s.checks === 'object') {
    for (const t in s.checks) {
      if (!TRACK_BY[t] || !Array.isArray(s.checks[t])) continue;
      o.checks[t] = s.checks[t].slice(0, 30).filter(c => c && typeof c.t === 'string' && c.t.trim())
        .map(c => ({t: c.t.slice(0, 80), done: !!c.done, custom: !!c.custom}));
    }
  }
  o.imp = sanitizeImp(s.imp);
  const co = intIn(s.cohort, 2000, 2100); if (co != null) o.cohort = co;
  if (s.exams && typeof s.exams === 'object') TRACKS.forEach(t => { if (isDate(s.exams[t.id])) o.exams[t.id] = s.exams[t.id]; });
  if (Array.isArray(s.ev)) {
    o.ev = s.ev.slice(0, 30).filter(x => x && isDate(x.d) && typeof x.t === 'string' && cleanTxt(x.t, 40))
      .map(x => ({d: x.d, t: cleanTxt(x.t, 40)})).sort((a, b) => a.d < b.d ? -1 : a.d > b.d ? 1 : 0);
  }
  if (Array.isArray(s.facs)) {
    s.facs.slice(0, 8).forEach(f => {
      if (!f || typeof f.n !== 'string') return;
      const n = cleanTxt(f.n, 40); if (!n || o.facs.some(x => x.n === n)) return;
      const c = String(f.c == null ? '' : f.c).normalize('NFKC').replace(/\s/g, '');
      const k = cleanTxt(String(f.k == null ? '' : f.k).normalize('NFKC'), 12);
      const fo = {n: n, c: /^\d{9}$/.test(c) ? c : ''};
      if (k) fo.k = k;
      o.facs.push(fo);
    });
  }
  if (typeof s.me === 'string') o.me = cleanTxt(s.me, 20);
  if (typeof s.sv === 'string') o.sv = cleanTxt(s.sv, 20);
  return o;
}

function tally(entries, range){
  const t = {}, slots = {};
  for (const e of entries) {
    if (range) {
      if (range.from && e.d < range.from) continue;
      if (range.to && e.d > range.to) continue;
    }
    const n = e.n || 1;
    t[e.c] = (t[e.c] || 0) + n;
    if (e.t && e.c.indexOf('rt_') === 0) { const k = 't_' + e.t; t[k] = (t[k] || 0) + n; }
    if (e.k) slots[e.k] = 1;
  }
  t.dz = Object.keys(slots).length;           // 疾患・病態: 割り当てた枠の数
  return t;
}
function goalOf(track, item, settings){
  const o = settings && settings.goals && settings.goals[track.id];
  if (o && Object.prototype.hasOwnProperty.call(o, item.id)) return o[item.id];
  return item.goal;
}
function progress(track, tl, settings){
  return track.items.map(it => {
    const count = it.keys.reduce((s, k) => s + (tl[k] || 0), 0);
    const goal = goalOf(track, it, settings);
    const has = goal != null && goal > 0;
    return {item: it, count: count, goal: goal, has: has,
      ratio: has ? Math.min(count / goal, 1) : null,
      done: has ? count >= goal : false,
      rest: has ? Math.max(goal - count, 0) : 0};
  });
}
function summarize(rows){
  const g = rows.filter(r => r.has);
  const doneN = g.filter(r => r.done).length;
  const pct = g.length ? Math.round(100 * g.reduce((s, r) => s + r.ratio, 0) / g.length) : 0;
  const restSum = g.filter(r => !r.item.sub).reduce((s, r) => s + r.rest, 0);
  return {total: g.length, doneN: doneN, pct: pct, restSum: restSum};
}

function safeText(v){
  v = String(v == null ? '' : v);
  return /^[=+\-@\t\r]/.test(v) ? "'" + v : v;
}
function csvCell(v){
  v = String(v == null ? '' : v);
  return /[",\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
}
function entryRow(e, raw){
  const T = raw ? (v => v == null ? '' : v) : safeText;
  return [e.d, CAT_BY[e.c].label, e.n, e.a != null ? e.a : '', e.x || '', T(e.p), T(e.q), T(e.r), T(e.z), e.k || '',
    e.t ? TECH_BY[e.t].label : '', T(e.h || e.tx), e.ro || '', e.o ? '○' : '', T(e.s), T(e.f1), T(e.f2), T(e.m),
    T(e.u), e.mt || '', e.pu || '', e.ds != null ? e.ds : '', e.fx != null ? e.fx : '', e.td != null ? e.td : '', e.d2 || '', T(e.ae), T(e.nu)];
}
const ENTRY_HEAD = ['検査日・経験日', '区分', '件数', '年齢', '性別', '部位', '種別', '依頼内容', '診断名・疾患名', '疾患群の枠',
  '治療技術', '手技・治療法', '術/助', '診断のみ', '施設', '第一読影者・術者・立案者', '確定者・指導医', 'メモ',
  '依頼科', '治療種別', '目的', '1回線量(Gy)', '照射回数', '全照射量(Gy)', '終了年月', '有害事象', '核種'];
function toCSV(entries){
  const rows = [ENTRY_HEAD].concat(entries.map(entryRow));
  return '﻿' + rows.map(r => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
function parseBackup(text){
  let j;
  try { j = JSON.parse(text); } catch (e) { return {error: 'JSONとして読み込めませんでした。'}; }
  if (!j || j.app !== 'senmoni-case-counter' || !j.months || typeof j.months !== 'object') {
    return {error: 'このアプリのバックアップファイルではありません。'};
  }
  const months = cleanMonths(j.months);
  let n = 0;
  for (const k in months) n += Object.keys(months[k]).length;
  return {months: months, n: n, settings: sanitizeSettings(j.settings)};
}

/* ---------- 共通: 文字列ハッシュ（取り込み記録のIDに使う） ---------- */
function h53(str, seed){
  let h1 = 0xdeadbeef ^ (seed || 0), h2 = 0x41c6ce57 ^ (seed || 0);
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/* ---------- 症例リスト取り込み（CSV / Excel） ---------- */
const IMP_CATS = CATS.slice();
function normText(s){ return String(s == null ? '' : s).normalize('NFKC').toLowerCase().replace(/[\s\u0001]+/g, ' ').trim(); }

// 区分の自動推定。確認用の「提案」であり、画面で必ず修正できる。
function suggestCat(raw){
  const t = normText(raw);
  if (!t) return null;
  const has = re => re.test(t);
  const tok = w => new RegExp('(^|[^a-z])(?:' + w + ')([^a-z]|$)');
  if (has(/放射線治療|照射|リニアック|linac|定位|imrt|vmat|小線源|ガンマナイフ|サイバーナイフ|粒子線|陽子線|重粒子/) || has(tok('rt|rtx'))) {
    if (has(/脳|頭頸|頭蓋|頭部|咽頭|喉頭|口腔|鼻|眼|耳|甲状腺|舌|唾液/)) return 'rt_head';
    if (has(/肺|胸|縦隔|食道|乳/)) return 'rt_chest';
    if (has(/腹|骨盤|肝|胆|膵|胃|直腸|大腸|結腸|膀胱|前立腺|子宮|卵巣|腎|肛門/)) return 'rt_abd';
    if (has(/骨|軟部|四肢|皮膚|脊椎|脊髄|筋|リンパ腫|血液/)) return 'rt_msk';
    return null;
  }
  if (has(/ivr|血管造影|塞栓|ステント|ドレナージ|生検|穿刺|ラジオ波|凍結|ポート|硬化療法|椎体形成|経皮/) || has(tok('tae|tace|pta|dsa|xa|ag|rfa'))) {
    if (has(/ドレナージ|生検|穿刺|ラジオ波|凍結|ポート|硬化|椎体形成|経皮|胆管|膿瘍|嚢胞|胃瘻/) || has(tok('rfa'))) return 'ivr_n';
    return 'ivr_v';
  }
  if (has(/核医学|シンチ|spect|アイソトープ|ガリウム|タリウム/) || has(tok('pet|pt|nm|rn|ri'))) return 'rn';
  if (has(/消化管|バリウム|注腸|胃透視|上部消化|下部消化|食道造影|小腸造影|大腸造影|胃x線|透視.*(胃|腸|食道)/) || has(tok('ugi|ge'))) return 'gi';
  if (has(/磁気共鳴/) || has(tok('mr|mri|mra|mrcp|mrs'))) return 'mri';
  if (has(/コンピュータ断層|コンピューター断層/) || has(tok('ct|cta'))) return 'ct';
  if (has(/超音波|エコー|echo|sonograph/) || has(tok('us'))) return 'us';
  if (has(/単純|一般撮影|x線|レントゲン|胸部撮影|骨撮影/) || has(tok('cr|dr|dx|xr|xp|rg|xray|x-ray'))) return 'xray';
  return null;
}

function parseDelimited(text){
  text = String(text || '').replace(/^﻿/, '');
  const first = (text.split(/\r\n?|\n/).find(l => l.trim()) || '');
  const cnt = ch => (first.match(new RegExp(ch === '\t' ? '\\t' : '\\' + ch, 'g')) || []).length;
  const delim = cnt('\t') >= cnt(',') && cnt('\t') >= cnt(';') && cnt('\t') > 0 ? '\t' : (cnt(';') > cnt(',') ? ';' : ',');
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += c;
    } else if (c === '"' && cell === '') q = true;
    else if (c === delim) { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some(x => x !== '')) rows.push(row);
      row = [];
      if (rows.length > 300000) break;
    } else cell += c;
  }
  row.push(cell);
  if (row.some(x => x !== '')) rows.push(row);
  return rows;
}

function ymd(y, m, d){
  if (y < 1990 || y > 2100) return null;
  const s = y + '-' + pad(m) + '-' + pad(d);
  return isDate(s) ? s : null;
}
function parseDateLoose(v){
  if (v == null) return null;
  const s = String(v).normalize('NFKC').trim();
  if (!s) return null;
  let m;
  if (/^\d{5}(\.\d+)?$/.test(s)) {                       // Excelのシリアル値
    const n = Math.floor(Number(s));
    if (n < 25569 || n > 80000) return null;
    const d = new Date(Date.UTC(1970, 0, 1) + (n - 25569) * 86400000);
    return ymd(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  }
  if ((m = /^(\d{4})[-\/.年]\s*(\d{1,2})[-\/.月]\s*(\d{1,2})/.exec(s))) return ymd(+m[1], +m[2], +m[3]);
  if ((m = /^(\d{4})(\d{2})(\d{2})(\d{0,6})$/.exec(s)) && (s.length === 8 || s.length === 12 || s.length === 14)) return ymd(+m[1], +m[2], +m[3]);
  if ((m = /^(令和|平成|昭和|[RrHhSs])\s*(元|\d{1,2})\s*[-\/.年]\s*(\d{1,2})\s*[-\/.月]\s*(\d{1,2})/.exec(s))) {
    const base = {'令和': 2018, 'r': 2018, '平成': 1988, 'h': 1988, '昭和': 1925, 's': 1925}[m[1].toLowerCase()];
    return ymd(base + (m[2] === '元' ? 1 : +m[2]), +m[3], +m[4]);
  }
  if ((m = /^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})/.exec(s))) {   // 月/日/年（米国式）。月が13以上なら日/月/年
    return +m[1] <= 12 ? ymd(+m[3], +m[1], +m[2]) : ymd(+m[3], +m[2], +m[1]);
  }
  return null;
}

const IMP_PRIVATE = /患者|氏名|名前|ふりがな|フリガナ|カナ|ｶﾅ|生年|誕生|住所|電話|郵便|保険|カルテ|診察券|依頼医|主治医|担当医|番号|識別|pid|patient|name|birth|(^|[^a-z])id([^a-z]|$)|ｉｄ|no\.?$/i;
function isPrivateHeader(h){ return IMP_PRIVATE.test(String(h || '').normalize('NFKC')); }
// 取り込む列の役割。date・cat は必須、cat2 以降は任意（年齢・性別以外の自由記述は、選んだときだけ読む）
const IMP_ROLES = [
  {k:'age', label:'年齢の列', re:[/^年齢$|年齢|^age$|^歳$/i]},
  {k:'sex', label:'性別の列', re:[/^性別$|性別|^sex$|^gender$/i]},
  {k:'part', label:'部位の列', txt:true, re:[]},
  {k:'kind', label:'種別（単純・造影など）の列', txt:true, re:[]},
  {k:'req', label:'依頼内容の列', txt:true, re:[]},
  {k:'diag', label:'診断名・疾患名の列', txt:true, re:[]},
  {k:'proc', label:'手技・治療法の列（IVR・放射線治療）', txt:true, re:[]},
  {k:'sv', label:'確定者・指導医の列', txt:true, re:[]}
];
const IMP_ROLE_KEYS = ['date', 'cat', 'cat2'].concat(IMP_ROLES.map(r => r.k));

function guessHeaderRow(grid){
  const lim = Math.min(grid.length, 20);
  const numLike = c => /^[\d\s\-\/.:年月日]+$/.test(String(c).trim());
  for (let i = 0; i < lim; i++) {
    const cells = grid[i].map(c => String(c == null ? '' : c).trim()).filter(Boolean);
    if (cells.length >= 3 && cells.filter(numLike).length / cells.length < 0.3) return i;
  }
  return 0;
}
function headerList(grid, hdr){
  const r = grid[hdr] || [];
  let w = 0; grid.slice(hdr, hdr + 200).forEach(x => { if (x.length > w) w = x.length; });
  const out = [];
  for (let i = 0; i < w; i++) {
    const t = String(r[i] == null ? '' : r[i]).replace(/\s+/g, ' ').trim().slice(0, 40);
    out.push({i: i, label: t || '(列' + (i + 1) + ')', priv: isPrivateHeader(t)});
  }
  return out;
}
function guessCols(heads, saved){
  const pick = (res, exclude) => {
    for (const re of res) {
      const h = heads.find(x => !x.priv && exclude.indexOf(x.i) < 0 && re.test(x.label.normalize('NFKC')));
      if (h) return h.i;
    }
    return -1;
  };
  const byName = n => { const h = n ? heads.find(x => !x.priv && x.label === n) : null; return h ? h.i : -1; };
  const o = {};
  IMP_ROLE_KEYS.forEach(k => { o[k] = byName(saved && saved[k]); });
  if (o.date < 0) o.date = pick([/検査(実施)?日時?$|検査日/, /実施日|施行日|撮影日|撮像日/, /報告日|読影日|レポート日/, /日付|年月日|日時|date/i], []);
  if (o.cat < 0) o.cat = pick([/モダリティ|modality/i, /検査(種別|区分|種類|分類|科目)|部門|撮影種別/, /検査項目|検査名|検査内容|術式|手技/], [o.date]);
  const used = () => IMP_ROLE_KEYS.map(k => o[k]).filter(i => i >= 0);
  if (o.age < 0) o.age = pick(IMP_ROLES[0].re, used());
  if (o.sex < 0) o.sex = pick(IMP_ROLES[1].re, used());
  if (o.cat2 === o.date || o.cat2 === o.cat) o.cat2 = -1;
  return o;
}

function cellText(row, i){ return i >= 0 && row[i] != null ? String(row[i]).trim() : ''; }
function rowKey(row, o){
  const a = cellText(row, o.cat).slice(0, 60);
  if (o.cat2 < 0) return a;
  return a + '\u0001' + cellText(row, o.cat2).slice(0, 40);
}
// 取り込み候補の走査: 区分の種類ごとの件数と、日付の範囲
function scanImport(grid, o){
  const keys = {}; let rows = 0, badDate = 0, minD = '', maxD = '';
  for (let r = o.hdr + 1; r < grid.length; r++) {
    const row = grid[r];
    if (!row || !row.some(c => c != null && String(c).trim() !== '')) continue;
    rows++;
    const d = parseDateLoose(cellText(row, o.date));
    if (!d) { badDate++; continue; }
    if (!minD || d < minD) minD = d;
    if (d > maxD) maxD = d;
    const k = rowKey(row, o);
    keys[k] = (keys[k] || 0) + 1;
  }
  const list = Object.keys(keys).map(k => ({key: k, n: keys[k], sug: suggestCat(k)})).sort((a, b) => b.n - a.n);
  return {rows: rows, badDate: badDate, minD: minD, maxD: maxD, keys: list};
}
// 確定した読み替えで集計する（日付×区分 → 件数）
function aggregateImport(grid, o){
  const agg = {}, perCat = {};
  const st = {rows: 0, ok: 0, badDate: 0, skipCat: 0, outside: 0};
  for (let r = o.hdr + 1; r < grid.length; r++) {
    const row = grid[r];
    if (!row || !row.some(c => c != null && String(c).trim() !== '')) continue;
    st.rows++;
    const d = parseDateLoose(cellText(row, o.date));
    if (!d) { st.badDate++; continue; }
    if ((o.from && d < o.from) || (o.to && d > o.to)) { st.outside++; continue; }
    const c = o.vals[rowKey(row, o)];
    if (!c || c === '-' || !CAT_BY[c] || c === 'dz') { st.skipCat++; continue; }
    agg[d + '|' + c] = (agg[d + '|' + c] || 0) + 1;
    perCat[c] = (perCat[c] || 0) + 1;
    st.ok++;
  }
  return {agg: agg, perCat: perCat, stat: st};
}
function impId(d, c, part){ return 'imp' + h53(d + '|' + c) + (part ? '-' + part : ''); }
function importEntries(agg, site, memo){
  const out = [];
  Object.keys(agg).forEach(k => {
    const p = k.split('|'), d = p[0], c = p[1];
    let left = agg[k], part = 0;
    while (left > 0) {
      const n = Math.min(left, 999);
      const e = {id: impId(d, c, part), d: d, c: c, n: n};
      if (site) e.s = String(site).slice(0, 60);
      if (memo) e.m = String(memo).slice(0, 120);
      out.push(e); left -= n; part++;
    }
  });
  return out;
}
function sanitizeImp(raw){
  if (!raw || typeof raw !== 'object') return null;
  const o = {cols: {}, vals: {}, site: '', mode: 'case'};
  IMP_ROLE_KEYS.forEach(k => { o.cols[k] = ''; });
  if (raw.cols && typeof raw.cols === 'object') IMP_ROLE_KEYS.forEach(k => { if (typeof raw.cols[k] === 'string') o.cols[k] = raw.cols[k].slice(0, 40); });
  if (raw.vals && typeof raw.vals === 'object') {
    Object.keys(raw.vals).slice(0, 300).forEach(k => {
      const v = raw.vals[k];
      if (k.length <= 110 && (v === '-' || (typeof v === 'string' && CAT_BY[v]))) o.vals[k] = v;
    });
  }
  if (typeof raw.site === 'string') o.site = raw.site.slice(0, 60);
  if (raw.mode === 'count') o.mode = 'count';
  return o;
}

/* ---------- 症例ごとの取り込み（年齢・性別・診断名など） ---------- */
function isImpId(id){ return /^im[pc]/.test(String(id)); }
function parseAge(v){
  const s = String(v == null ? '' : v).normalize('NFKC').trim();
  if (!s) return null;
  if (/[ヶヵケか]月|ヶ月|日齢|週/.test(s) && !/歳|才/.test(s)) return 0;
  const m = /^(\d{1,3})(?:\.\d+)?\s*(歳|才|y|yo|Y|YO|$)/.exec(s);
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 0 && n <= 120 ? n : null;
}
function parseSex(v){
  const s = String(v == null ? '' : v).normalize('NFKC').trim().toLowerCase();
  if (!s) return '';
  if (/^(m|male|man|男|男性|雄|1)$/.test(s)) return 'M';
  if (/^(f|female|woman|女|女性|雌|2)$/.test(s)) return 'F';
  return '';
}
// 自由記述に紛れた個人情報らしい表現を取り除く（完全ではないので、取り込み前の確認が前提）
function scrubText(v, max){
  let s = String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, ' ');
  const before = s;
  s = s.replace(/[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/g, '')
    .replace(/(昭和|平成|令和|[SHRshr])\s?\d{1,2}\s?[.\/年]\s?\d{1,2}\s?[.\/月]\s?\d{1,2}日?/g, '')
    .replace(/\d{4}\s?[\/\-.年]\s?\d{1,2}\s?[\/\-.月]\s?\d{1,2}日?/g, '')
    .replace(/[0-9０-９][0-9０-９\-－ー]{5,}/g, '')
    .replace(/[一-龥ぁ-んァ-ヶー]{1,6}(様|さん|殿)/g, '');
  s = s.replace(/\s+/g, ' ').trim().slice(0, max);
  return {text: s, changed: s !== before.replace(/\s+/g, ' ').trim().slice(0, max)};
}
function buildCaseImport(grid, o){
  const items = [], perCat = {};
  const st = {rows: 0, ok: 0, badDate: 0, skipCat: 0, outside: 0, scrubbed: 0, ageN: 0, sexN: 0};
  const C = o.cols;
  const txt = (row, role, max) => {
    if (C[role] == null || C[role] < 0) return '';
    const raw = cellText(row, C[role]);
    if (!raw) return '';
    const r = scrubText(raw, max);
    if (r.changed) st.scrubbed++;
    return r.text;
  };
  for (let r = o.hdr + 1; r < grid.length; r++) {
    const row = grid[r];
    if (!row || !row.some(c => c != null && String(c).trim() !== '')) continue;
    st.rows++;
    const d = parseDateLoose(cellText(row, C.date));
    if (!d) { st.badDate++; continue; }
    if ((o.from && d < o.from) || (o.to && d > o.to)) { st.outside++; continue; }
    const c = o.vals[rowKey(row, {cat: C.cat, cat2: C.cat2})];
    if (!c || c === '-' || !CAT_BY[c]) { st.skipCat++; continue; }
    const g = CAT_BY[c].g;
    const it = {d: d, c: c};
    const a = C.age >= 0 ? parseAge(cellText(row, C.age)) : null;
    if (a != null) { it.a = a; st.ageN++; }
    const x = C.sex >= 0 ? parseSex(cellText(row, C.sex)) : '';
    if (x) { it.x = x; st.sexN++; }
    const z = txt(row, 'diag', TXT_MAX.z); if (z) it.z = z;
    const f2 = txt(row, 'sv', TXT_MAX.f2); if (f2) it.f2 = f2;
    if (g === 'img') {
      const p = txt(row, 'part', TXT_MAX.p), q = txt(row, 'kind', TXT_MAX.q), rq = txt(row, 'req', TXT_MAX.r);
      if (p) it.p = p; if (q) it.q = q; if (rq) it.r = rq;
    } else if (g === 'ivr') { const h = txt(row, 'proc', TXT_MAX.h); if (h) it.h = h; }
    else if (g === 'rt') { const tx = txt(row, 'proc', TXT_MAX.tx); if (tx) it.tx = tx; }
    items.push(it);
    perCat[c] = (perCat[c] || 0) + 1;
    st.ok++;
  }
  return {items: items, perCat: perCat, stat: st};
}
// 同じ内容の行は区別できないので、「内容の指紋＋同じ指紋の通し番号」をIDにする（同じファイルを再度取り込んでも同じIDになる）
function caseImportEntries(items, site){
  const seen = {}, out = [];
  items.forEach(it => {
    const fp = h53([it.d, it.c, it.a == null ? '' : it.a, it.x || '', it.p || '', it.q || '', it.r || '', it.z || '', it.h || '', it.tx || ''].join('|'));
    const n = seen[fp] = (seen[fp] || 0) + 1;
    const e = Object.assign({id: 'imc' + fp + '-' + n.toString(36), n: 1}, it);
    if (site) e.s = String(site).slice(0, 60);
    out.push(e);
  });
  return out;
}

/*LOGIC_END*/
