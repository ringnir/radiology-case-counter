
/* ---------- renderers: 共通 ---------- */
function isDemo(){ return state.loaded && ui.screen === 'member' && !ui.asMember && getEntries().length === 0; }
const fmtDT = iso => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return todayStr(d) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
};
const daysAgo = n => { const d = new Date(); d.setDate(d.getDate() - n); return todayStr(d); };

function renderAuth(){
  const tab = ui.authTab;
  document.querySelectorAll('[data-atab]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.atab === tab)));
  $('aName').hidden = tab === 'admin';
  $('aPass2').hidden = tab !== 'register';
  $('aJoin').hidden = tab !== 'register';
  $('passLabel').textContent = tab === 'admin' ? '管理者パスコード' : 'パスコード';
  $('inPass').setAttribute('autocomplete', tab === 'register' ? 'new-password' : 'current-password');
  $('authGo').textContent = ui.authBusy ? '確認中…' : (tab === 'login' ? 'ログイン' : tab === 'register' ? '登録して始める' : '管理者としてログイン');
  $('authGo').disabled = ui.authBusy;
  $('authHint').textContent = tab === 'register'
    ? '招待コードは管理者から聞いてください。パスコードは6文字以上です。忘れたときは管理者が再設定できます。'
    : tab === 'admin' ? '全メンバーの進捗を見るための入口です。' : '登録した氏名とパスコードを入力してください。';
  $('authErr').textContent = ui.authErr;
  const p = ui.ping;
  $('authNote').innerHTML = p && (!p.configured || !p.ready)
    ? '<div class="setupwarn">' + (!p.configured
      ? '管理者の初期設定が終わっていません。Code.gs の ADMIN_PASSCODE と JOIN_CODE を設定してください。'
      : 'データ保存先がまだ作られていません。Apps Script で関数 setup を一度実行してください。') + '</div>'
    : '';
}

function renderWho(){
  const el = $('who'), s = state.session;
  if (!s || ui.screen === 'auth' || state.mode !== 'gas') { el.hidden = true; el.innerHTML = ''; return; }
  el.hidden = false;
  let h = '<span class="who-name">' + (s.me ? esc(s.me.name) + ' さん' : '管理者') + (s.admin ? '<span class="tag off">管理者</span>' : '') + '</span>';
  if (s.me && s.admin) h += ui.screen === 'admin'
    ? '<button type="button" data-act="goMember">自分の記録へ</button>'
    : '<button type="button" data-act="goAdmin">管理者画面へ</button>';
  if (s.me && !s.admin) h += '<button type="button" data-act="askAdmin">管理者として入る</button>';
  h += '<button type="button" data-act="logout">ログアウト</button>';
  el.innerHTML = h;
  $('upgForm').hidden = !(ui.upg && s.me && !s.admin);
}

function viewList(){
  if (ui.screen === 'admin' && !ui.asMember) return [['a-overview', '全員の進捗'], ['a-members', 'メンバー管理'], ['a-export', '全員出力']];
  if (ui.asMember) return [['progress', '進捗'], ['dz', '疾患群（100枠）'], ['log', '症例一覧']];
  return [['progress', '進捗'], ['dz', '疾患群（100枠）'], ['log', '症例一覧'], ['import', 'リスト取り込み'], ['export', '出力・バックアップ'], ['settings', '設定']];
}

function renderViews(){
  const list = viewList();
  if (!list.some(v => v[0] === ui.view)) ui.view = list[0][0];
  $('nav').innerHTML = list.map(v => '<button type="button" role="tab" data-view="' + v[0] + '" aria-selected="' + (v[0] === ui.view) + '">' + esc(v[1]) + '</button>').join('');
  ['progress', 'dz', 'log', 'import', 'export', 'settings', 'a-overview', 'a-members', 'a-export'].forEach(v => { $('v-' + v).hidden = (v !== ui.view); });
}

function renderDrill(){
  const el = $('drill');
  if (!ui.asMember) { el.hidden = true; return; }
  el.hidden = false;
  const m = ui.asMember;
  el.innerHTML = '<span><b>' + esc(m.name) + '</b> さんの記録（閲覧のみ）' + (state.settings.cohort ? ' <span class="dim">' + esc(cohortLabel(state.settings.cohort)) + '</span>' : '') + '</span><span class="acts2">' +
    TPL_KINDS.map(k => '<button type="button" class="btn small' + (k.id === 'base' ? ' primary' : '') + '" data-act="tpl" data-k="' + k.id + '">' + (k.id === 'base' ? '研修手帳（基本領域）' : '研修手帳（' + k.name.replace('専門医', '') + '）') + '</button>').join('') +
    '<button type="button" class="btn small" data-act="xlsx">Excel</button>' +
    '<button type="button" class="btn small" data-act="csv">CSV</button>' +
    '<button type="button" class="btn small" data-act="closeMember">← 全員の一覧へ戻る</button></span>';
}

/* ---------- 登録フォーム側 ---------- */

/* ---------- 登録フォーム側 ---------- */
function renderChips(){
  const tl = tally(getEntries());
  let h = '';
  GROUPS.forEach(g => {
    h += '<div class="chipgroup"><h4>' + esc(g.label) + '</h4><div class="chips">';
    CATS.filter(c => c.g === g.id).forEach(c => {
      h += '<button type="button" role="radio" class="chip" aria-checked="' + (ui.cat === c.k) + '" data-cat="' + c.k + '"><span>' +
        esc(c.short) + '</span><b>' + fmtN(tl[c.k] || 0) + '</b></button>';
    });
    h += '</div></div>';
  });
  $('catChips').innerHTML = h;
}

function renderSites(){
  const sites = (state.settings.facs || []).map(f => f.n), parts = [], kinds = [];
  sortEntries(getEntries()).forEach(e => {
    if (e.s && sites.indexOf(e.s) < 0 && sites.length < 20) sites.push(e.s);
    if (e.p && parts.indexOf(e.p) < 0 && parts.length < 30) parts.push(e.p);
    if (e.q && kinds.indexOf(e.q) < 0 && kinds.length < 10) kinds.push(e.q);
  });
  ['単純', '造影'].forEach(k => { if (kinds.indexOf(k) < 0) kinds.push(k); });
  const opt = a => a.map(s => '<option value="' + esc(s) + '"></option>').join('');
  $('siteList').innerHTML = opt(sites); $('partList').innerHTML = opt(parts); $('kindList').innerHTML = opt(kinds);
  $('fSite').placeholder = state.settings.facs.length ? '空欄なら「' + state.settings.facs[0].n + '」' : '例: ○○病院';
}

// 密封小線源のときだけ、術者／第一助手と核種の欄を出す
function updateRtFields(){
  const k = RT_KINDS.find(x => x.id === $('fTech').value) || RT_KINDS[0], br = k.t === 'brachy';
  $('roleRtWrap').hidden = !br; $('nuWrap').hidden = !br;
  if (!br) { $('fRoleRt').value = ''; $('fNu').value = ''; }
}
function updateFormForCat(){
  if (!CAT_BY[ui.cat]) ui.cat = 'ct';
  const c = CAT_BY[ui.cat], g = c.g;
  $('detImg').hidden = g !== 'img'; $('detIvr').hidden = g !== 'ivr'; $('detRt').hidden = g !== 'rt'; $('slotWrap').hidden = g !== 'img';
  $('lblDate').textContent = g === 'img' ? '検査日' : '経験日';
  $('lblDz').textContent = g === 'img' ? '診断名（任意）' : '疾患名（任意）';
  $('lblF1').textContent = g === 'img' ? '第一読影者' : g === 'ivr' ? '術者／第一助手' : '第一立案者';
  $('lblF2').textContent = g === 'img' ? '確定者（指導医）' : '指導医確認';
  $('fF1').placeholder = state.settings.me ? '空欄なら「' + state.settings.me + '」' : '';
  $('fF2').placeholder = state.settings.sv ? '空欄なら「' + state.settings.sv + '」' : '';
  if (!$('fTech').options.length) $('fTech').innerHTML = RT_KINDS.map(k => '<option value="' + k.id + '">' + esc(k.label) + '</option>').join('');
  if (g !== 'rt') { $('fTech').value = ''; $('fTx').value = ''; }
  updateRtFields();
  $('catHint').textContent = GROUP_BY[g].hint;
  $('nHint').hidden = !(Number($('fN').value) > 1);
  $('btnSave').disabled = !state.ready;
  renderSlotSelect();
}

/* ---------- 進捗 ---------- */

/* ---------- 進捗 ---------- */
function trackTally(t, entries){
  if (isDemo()) return DEMO;
  return tally(entries, state.settings.range[t.id]);
}
function getChecks(t){
  return state.settings.checks[t.id] || t.checks.map(x => ({t:x, done:false}));
}
function renderSlotSelect(){
  const sel = $('fSlot');
  const cur = sel.value;
  const used = slotMap(getEntries().filter(e => e.id !== ui.editId));
  let h = '<option value="">割り当てない</option>';
  slotAreas().forEach(a => {
    h += '<optgroup label="' + esc(a.name) + '">';
    a.groups.forEach(g => g.slots.forEach(no => {
      h += '<option value="' + no + '"' + (used[no] ? ' disabled' : '') + '>' + no + ' ' + esc(slotLabel(no)) + (used[no] ? '（使用済み）' : '') + '</option>';
    }));
    h += '</optgroup>';
  });
  sel.innerHTML = h; sel.value = cur;
}

function evRows(ro){
  const today = todayStr();
  return state.settings.ev.map((x, i) => {
    const d = daysUntil(x.d, today);
    return '<li class="' + (d < 0 ? 'past' : '') + '"><span class="ed">' + esc(x.d) + '</span><span class="et">' + esc(x.t) + '</span><span class="edays">' +
      (d < 0 ? '終了' : d === 0 ? '本日' : 'あと' + fmtN(d) + '日') + '</span>' +
      (ro ? '' : '<button type="button" class="x" data-act="evdel" data-i="' + i + '" aria-label="この予定を削除">×</button>') + '</li>';
  }).join('');
}
function countdownHtml(tr, sm){
  const st = state.settings, ro = readOnly();
  const ex = examState(st, tr.id, sm.restSum, todayStr());
  let h = '<section class="card cd"><div class="cd-head"><h3>' + esc(tr.name) + 'の受験予定</h3><div class="cd-inputs">' +
    '<label><span>入学年度</span><select data-act="cohort"' + (ro ? ' disabled' : '') + '><option value="0">未設定</option>' +
    cohortOptions().concat(st.cohort && cohortOptions().indexOf(st.cohort) < 0 ? [st.cohort] : []).sort((a, b) => b - a)
      .map(y => '<option value="' + y + '"' + (st.cohort === y ? ' selected' : '') + '>' + y + '年度</option>').join('') + '</select></label>' +
    '<label><span>受験予定日</span><input type="date" data-act="exam" data-t="' + tr.id + '" value="' + esc(st.exams[tr.id] || '') + '"' + (ro ? ' disabled' : '') + '></label></div></div>';
  if (!ex) h += '<p class="cd-none">' + (ro ? '受験予定日は未設定です。' : '受験予定日を入れると、残り日数と、1週間あたりに必要な症例数が表示されます。') + '</p>';
  else if (ex.past) h += '<p class="cd-none">受験予定日（' + esc(ex.date) + '）を過ぎています。' + (ro ? '' : '日付を更新してください。') + '</p>';
  else {
    h += '<div class="cd-main"><div class="cd-stat"><span class="cd-big">' + (ex.today ? '本日' : fmtN(ex.days)) + '</span><span class="cd-unit">' + (ex.today ? '受験' : '日後（約' + (Math.round(ex.days / 7 * 10) / 10) + '週）') + '</span></div>';
    if (!sm.total) h += '<div class="cd-stat"><span class="cd-unit">症例数の目標が未設定のため、不足は計算していません（「設定」タブで入力できます）</span></div>';
    else h += '<div class="cd-stat"><span class="cd-unit">不足</span><span class="cd-big">' + fmtN(sm.restSum) + '</span><span class="cd-unit">症例</span></div>';
    if (sm.total && ex.pace) h += '<div class="cd-stat"><span class="cd-unit">必要なペース</span><span class="cd-big">週' + ex.pace.perWeek + '</span><span class="cd-unit">症例（1日あたり' + ex.pace.perDay + '）</span></div>';
    else if (sm.total && sm.restSum === 0) h += '<div class="cd-stat"><span class="cd-big ok">達成</span><span class="cd-unit">主要項目はそろっています</span></div>';
    h += '</div>';
  }
  h += '<div class="cd-ev"><h4>予定・イベント</h4>';
  h += st.ev.length ? '<ul class="evlist">' + evRows(ro) + '</ul>' : '<p class="cd-none">学会・講習会・提出期限など、予定を追加できます。</p>';
  if (!ro) h += '<form id="evForm" class="evform"><input id="evDate" type="date" aria-label="予定の日付"><input id="evTitle" type="text" maxlength="40" placeholder="予定の名前（例: 日本医学放射線学会総会）" aria-label="予定の名前"><button class="btn small" type="submit">追加</button></form>';
  return h + '</div></section>';
}

function slotChip(no, e, ro){
  const label = e ? (e.z || CAT_BY[e.c].short) : '';
  return '<button type="button" class="dzchip slot" data-act="slot" data-no="' + no + '" aria-pressed="' + (!!e) + '" aria-expanded="' + (ui.dzSlot === no) + '"' +
    ' title="' + esc(no + ' ' + slotLabel(no)) + '"><span class="sn">' + no + '</span>' + (e ? '<span class="sd">' + esc(label) + '</span>' : '') + '</button>';
}

function slotDemog(e){
  return [e.a != null ? e.a + '歳' : '', e.x === 'M' ? '男' : e.x === 'F' ? '女' : ''].filter(Boolean).join(' ');
}

function slotPickHtml(){
  const q = (ui.slotQ || '').trim().toLowerCase();
  const list = sortEntries(getEntries().filter(e => CAT_BY[e.c].g === 'img' && !e.k && e.n === 1 &&
    (!q || [e.z, e.p, e.r, e.d].join(' ').toLowerCase().indexOf(q) >= 0))).slice(0, 12);
  if (!list.length) return '<p class="dim" style="font-size:13px">条件に合う、枠が未割り当ての症例がありません。</p>';
  return list.map(e => '<button type="button" class="pickrow" data-act="slotpick" data-id="' + esc(e.id) + '"><span class="d">' + esc(e.d) + '</span><span>' +
    esc(CAT_BY[e.c].short) + '</span><span>' + esc(slotDemog(e)) + '</span><span class="t">' + esc([e.z, e.p].filter(Boolean).join(' / ') || '（診断名なし）') + '</span></button>').join('');
}

function slotEditor(no, e, ro){
  let h = '<div class="sloted"><div class="se-h"><b>' + no + '</b> ' + esc(slotLabel(no)) + '</div>';
  if (e) {
    h += '<p class="se-cur">' + esc([e.d, CAT_BY[e.c].short, slotDemog(e), e.z].filter(Boolean).join(' ・ ')) + '</p>';
    if (!ro) h += '<div class="row2"><button type="button" class="btn small" data-act="edit" data-id="' + esc(e.id) + '">症例を編集</button>' +
      '<button type="button" class="btn small danger" data-act="slotclear" data-id="' + esc(e.id) + '">割り当てを外す</button></div>';
  } else if (!ro) {
    h += '<div class="row2"><button type="button" class="btn small primary" data-act="slotnew" data-no="' + no + '">この枠に新しい症例を登録</button></div>' +
      '<label class="fld" style="margin:10px 0 6px"><span>または、登録済みの症例から選ぶ</span><input id="slotQ" type="search" placeholder="診断名・部位・依頼内容・日付で検索" value="' + esc(ui.slotQ || '') + '"></label>' +
      '<div id="slotPick" class="pickbox">' + slotPickHtml() + '</div>';
  } else h += '<p class="se-cur">この枠にはまだ症例が割り当てられていません。</p>';
  return h + '</div>';
}

function renderTplFile(){
  // 管理者が他のメンバーの記録を開いているとき（出力タブがない）は、上部の帯の下に出す
  const el = $(ui.asMember ? 'drillTpl' : 'tplFile'), other = $(ui.asMember ? 'tplFile' : 'drillTpl');
  if (other) other.innerHTML = '';
  if (!el) return;
  const kb = n => n >= 1048576 ? (Math.round(n / 104857.6) / 10) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';
  const any = TPL_KINDS.some(k => tplSource(k.id) != null);
  const rows = TPL_KINDS.map(k => {
    const f = tplStore.files[k.id];
    if (k.id === 'base' && TPL_EMBEDDED) return '<p class="tplrow"><span class="kn">' + esc(k.name) + '</span>様式はこのページに内蔵されています。</p>';
    if (!f) return '';
    return '<p class="tplrow"><span class="kn">' + esc(k.name) + '</span>使用する様式: <b>' + esc(f.name) + '</b>（' + kb(f.size) + '）' +
      (tplStore.saved[k.id] ? '　このブラウザに保存済み' : '　<span class="dim">この環境では保存できないため、開き直すと選び直しが必要です</span>') +
      ' <button type="button" class="btn small" data-act="tplforget" data-k="' + k.id + '">削除</button></p>';
  }).join('');
  el.innerHTML = '<div class="tplfile' + (any ? '' : ' need') + '">' + rows + (any
    ? '<div class="row2"><label class="btn small" for="fTpl">様式ファイルを追加・変更する</label><span class="dim">基本領域・診断・治療のどれでも選べます（自動で判別します）</span></div>'
    : '<p><b>最初に、研修手帳の様式ファイルを選んでください。</b>日本医学放射線学会などが配布している、放射線科専門医の経験症例記録のExcel、または診断専門医・治療専門医の専攻医研修手帳のExcel（.xlsx）です。このアプリには様式ファイルは含まれていません。選んだファイルはこのブラウザの外には送られず、ブラウザの中に保存されるので、次回からは選び直し不要です。基本領域・診断・治療のどれでも選べます（自動で判別します）。</p>' +
      '<div class="row2"><label class="btn primary" for="fTpl">様式ファイルを選ぶ</label></div>') +
    '<input id="fTpl" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden>' +
    (ui.tplMsg ? '<p class="msgline bad">' + esc(ui.tplMsg) + '</p>' : '') + '</div>';
}
// 出力タブの、様式ごとの「書き込む件数」と注意点
const TPL_INFO_ROWS = {
  base: [['xray', '単純X線', 'xray'], ['gi', '消化管', 'gi'], ['us', '超音波', 'us'], ['ct', 'CT', 'ct'], ['mri', 'MRI', 'mri'], ['rn', '核医学', 'rn'], ['ivr', 'IVR', 'ivr'], ['rt', '放射線治療', 'rt']],
  diag: [['xray', '単純X線', 'xray'], ['gi', '消化管', 'gi'], ['us', '超音波', 'us'], ['ct', 'CT', 'ct'], ['mri', 'MRI', 'mri'], ['rn', '核医学', 'rn'], ['ivr', 'IVR', 'ivr']],
  rt: [['head', '部位別: 脳・頭頸部', 'rt_head'], ['chest', '部位別: 胸部', 'rt_chest'], ['abd', '部位別: 腹部・骨盤部', 'rt_abd'], ['msk', '部位別: 四肢・皮膚・その他', 'rt_msk'],
    ['brachy', '技術: 密封小線源', 't_brachy'], ['imrt', '技術: 強度変調', 't_imrt'], ['srt', '技術: 定位放射線照射', 't_srt'], ['special', '技術: 特殊治療', 't_special']]
};
function renderTplInfo(){
  const el = $('tplInfo');
  if (!el) return;
  el.innerHTML = TPL_KINDS.map(k => {
    const data = buildKindData(k.id, entriesFor(k.track), state.settings), rep = data.report, tr = TRACK_BY[k.track];
    const goal = id => { const it = tr.items.find(i => i.id === id); return it ? goalOf(tr, it, state.settings) : null; };
    const rows = TPL_INFO_ROWS[k.id].map(r => '<tr><td>' + r[1] + '</td><td class="r">' + fmtN(rep.counts[r[0]] || 0) + '</td><td class="r dim">' + (goal(r[2]) != null ? '目標 ' + fmtN(goal(r[2])) : '') + '</td></tr>');
    if (k.id === 'base') rows.push('<tr><td>疾患群の枠（A.疾患）</td><td class="r">' + fmtN(rep.slots) + '</td><td class="r dim">目標 ' + fmtN(goal('dz') || 90) + ' / 100枠</td></tr>');
    const w = reportWarnings(rep), has = tplSource(k.id) != null;
    return '<section class="tplkind" data-kind="' + k.id + '"><h4>' + esc(k.name) + '<span class="dim">　' + esc(k.file) + '</span></h4>' +
      '<table class="itable"><thead><tr><th>シート</th><th class="r">書き込む件数</th><th></th></tr></thead><tbody>' + rows.join('') + '</tbody></table>' +
      (w.length ? '<ul class="warnlist">' + w.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>' : '<p class="msgline">未入力の注意点はありません。</p>') +
      '<div class="row2"><button class="btn primary" data-act="tpl" data-k="' + k.id + '">' + esc(k.name.replace('（基本領域）', '')) + 'の様式に書き込んで出力</button>' +
      (has ? '' : '<span class="dim">先に、上で様式ファイルを選んでください</span>') + '</div></section>';
  }).join('');
}

function renderProgress(){
  const entries = getEntries(), ro = readOnly();
  const demo = isDemo();
  const tr = TRACK_BY[ui.track] || TRACKS[0];
  const all = TRACKS.map(t => {
    const rows = progress(t, trackTally(t, entries), state.settings);
    return {t: t, rows: rows, s: summarize(rows)};
  });
  const cur = all.find(x => x.t.id === tr.id);
  let h = '<div class="tracks" role="tablist" aria-label="専門医の種類">';
  all.forEach(x => {
    h += '<button type="button" class="track" role="tab" data-act="track" data-id="' + x.t.id + '" aria-selected="' + (x.t.id === tr.id) + '">' +
      '<span class="t-name">' + esc(x.t.name) + '</span><span class="t-sub">' + esc(x.t.sub) + '</span>' +
      '<span class="t-pct">' + (x.s.total ? x.s.pct + '%' : '—') + '</span></button>';
  });
  h += '</div>';
  if (demo) h += '<div class="demo-banner">サンプル表示です。最初の症例を登録すると、実際の件数に切り替わります。</div>';
  h += countdownHtml(tr, cur.s);
  h += '<div class="srcnote"><span class="tag ' + tr.src + '">' + esc(tr.srcTag) + '</span><span>' + esc(tr.srcText) + '</span></div>';
  const rg = state.settings.range[tr.id];
  const ex = examState(state.settings, tr.id, cur.s.restSum, todayStr());
  h += '<p class="sum">' + (cur.s.total
    ? '<span>達成 <b>' + cur.s.doneN + '</b> / <b>' + cur.s.total + '</b> 項目</span><span>不足 <b>' + fmtN(cur.s.restSum) + '</b> 件（主要項目の合計）</span>'
    : '<span>症例数の目標が未設定です。件数は数えます。目標は「設定」タブで入力できます。</span>') +
    (rg && (rg.from || rg.to) ? '<span>集計期間 <b>' + esc(rg.from || '—') + ' 〜 ' + esc(rg.to || '—') + '</b></span>' : '') + '</p>';
  h += '<div class="rows' + (demo ? ' demo' : '') + (state.loaded ? '' : ' loading') + '">';
  cur.rows.forEach(r => {
    const it = r.item;
    if (it.grp) h += '<div class="grp">' + esc(it.grp) + '</div>';
    const k0 = it.keys.length === 1 ? it.keys[0] : null;
    let act = '';
    if (!ro && k0 === 'dz') act = '<button type="button" class="plus" data-act="godz" aria-label="疾患群の枠を開く" title="疾患群（100枠）を開く">→</button>';
    else if (!ro && k0 && CAT_BY[k0]) act = '<button type="button" class="plus" data-act="plus" data-key="' + k0 + '" aria-label="' + esc(CAT_BY[k0].label) + 'を登録" title="この区分で症例を登録">+</button>';
    const pace = ex && !ex.past && r.has && !r.done ? paceOf(r.rest, ex.days) : null;
    h += '<div class="row' + (it.sub ? ' sub' : '') + (r.done ? ' done' : '') + (r.has ? '' : ' nogoal') + '">' +
      '<div class="lbl">' + esc(it.label) + (it.note ? '<small>' + esc(it.note) + '</small>' : '') + '</div>' +
      '<div class="bar">' + (r.has ? '<i style="width:' + Math.round(r.ratio * 100) + '%"></i>' : '') + '</div>' +
      '<div class="num"><b>' + fmtN(r.count) + '</b><span>' + (r.has ? ' / ' + fmtN(r.goal) : ' 規定なし') + '</span></div>' +
      '<div class="rest' + (r.done ? ' done' : '') + '">' + (r.has ? (r.done ? '達成' : 'あと' + fmtN(r.rest) + (pace ? '<small>週' + pace.perWeek + '</small>' : '')) : '') + '</div>' +
      '<div class="act">' + act + '</div></div>';
  });
  h += '</div>';
  const checks = getChecks(tr);
  h += '<section class="card checks"><h3>ほかの受験要件</h3><ul>' + checks.map((c, i) =>
    '<li><label><input type="checkbox" data-act="check" data-i="' + i + '"' + (c.done ? ' checked' : '') + (ro ? ' disabled' : '') + '><span>' + esc(c.t) + '</span></label>' +
    (c.custom && !ro ? '<button type="button" class="x" data-act="chkdel" data-i="' + i + '" aria-label="この項目を削除">×</button>' : '') + '</li>').join('') +
    '</ul>' + (ro ? '' : '<form id="chkForm" class="addchk"><input id="chkNew" type="text" maxlength="80" placeholder="項目を追加（例: 学会発表2回）" aria-label="追加する要件">' +
    '<button class="btn small" type="submit">追加</button></form>') + '</section>';
  $('v-progress').innerHTML = h;
}

/* ---------- 疾患群の枠（研修手帳「A.疾患」の100枠） ---------- */

/* ---------- 疾患・病態（タップ選択） ---------- */
function renderDz(){
  const ro = readOnly(), map = slotMap(getEntries());
  const goal = goalOf(TRACK_BY.base, TRACK_BY.base.items.find(i => i.id === 'dz'), state.settings);
  const nDone = Object.keys(map).length;
  const ratio = goal ? Math.min(nDone / goal, 1) : 0;
  $('dzSummary').innerHTML = '<div class="dzsum"><span>割り当て済み <b class="num2">' + fmtN(nDone) + '</b> / 100枠' + (goal ? '（目標 <b class="num2">' + fmtN(goal) + '</b>）' : '') + '</span>' +
    '<div class="bar" aria-hidden="true"><i style="width:' + Math.round(ratio * 100) + '%"></i></div></div>' +
    '<p class="loginfo">研修手帳の「A.疾患」の100枠です。枠をタップして、すでに登録した症例を選ぶか、新しい症例を登録します。割り当てた症例は様式のExcelにそのまま書き込まれます。</p>';
  const q = ($('dzQ').value || '').trim().toLowerCase(), only = $('dzOnly').checked;
  let h = '';
  slotAreas().forEach(a => {
    const total = a.groups.reduce((s, g) => s + g.slots.length, 0);
    const done = a.groups.reduce((s, g) => s + g.slots.filter(n => map[n]).length, 0);
    let gh = '';
    a.groups.forEach(g => {
      const hit = !q || (g.name + ' ' + a.name).toLowerCase().indexOf(q) >= 0 || g.slots.some(n => map[n] && (map[n].z || '').toLowerCase().indexOf(q) >= 0);
      if (!hit || (only && g.slots.every(n => map[n]))) return;
      gh += '<div class="slotgrp"><div class="sg-name">' + esc(g.name) + (g.size > 1 ? '<small>' + g.size + '枠</small>' : '') + '</div><div class="dzchips">' +
        g.slots.map(n => slotChip(n, map[n], ro)).join('') + '</div></div>';
      if (ui.dzSlot && g.slots.indexOf(ui.dzSlot) >= 0) gh += slotEditor(ui.dzSlot, map[ui.dzSlot], ro);
    });
    if (gh) h += '<section class="dzgrp"><h4>' + esc(a.name) + '<b>' + done + ' / ' + total + '</b></h4><div class="slotgrid">' + gh + '</div></section>';
  });
  $('dzGroups').innerHTML = h || '<div class="empty">条件に合う枠がありません。</div>';
}

/* ---------- 症例一覧 ---------- */

/* ---------- 症例一覧 ---------- */
function renderLog(){
  const ro = readOnly();
  const all = sortEntries(getEntries());
  const fc = $('logCat').value, q = $('logQ').value.trim().toLowerCase();
  const list = all.filter(e => (!fc || e.c === fc) && (!q || [e.z, e.p, e.q, e.r, e.h, e.tx, e.m, e.s, e.f1, e.f2, e.u, e.ae].join(' ').toLowerCase().indexOf(q) >= 0));
  const shown = list.slice(0, ui.logLimit);
  const total = list.reduce((s, e) => s + e.n, 0);
  $('logInfo').textContent = list.length ? '該当 ' + fmtN(list.length) + ' 件（症例数の合計 ' + fmtN(total) + '）' : '';
  if (!list.length) {
    $('logList').innerHTML = '<div class="empty">' + (all.length ? '条件に合う症例がありません。' : (ro ? '記録がありません。' : 'まだ症例がありません。左のフォームから登録してください。')) + '</div>';
    $('logMore').hidden = true;
    return;
  }
  $('logList').innerHTML = shown.map(e => {
    const g = CAT_BY[e.c].g;
    const rtd = g === 'rt' ? [e.mt, e.pu, e.ds != null ? e.ds + ' Gy' : '', e.fx != null ? e.fx + '回' : '', e.td != null ? '計' + e.td + ' Gy' : '', e.u].filter(Boolean).join(' ') : '';
    const subs = [slotDemog(e), e.p, e.q, e.z, e.r ? '依頼: ' + e.r : '', e.h, e.tx, rtd, e.s, e.m].filter(Boolean).map(esc).join(' ・ ');
    const del = ui.pendingDelete === e.id;
    const bad = g === 'img' && e.n === 1 && (e.a == null || !e.x);
    return '<div class="logrow"><div class="d">' + esc(e.d) + '</div>' +
      '<div class="c">' + esc(CAT_BY[e.c].label) + (e.t ? '<span class="tt">' + esc(TECH_BY[e.t].label) + '</span>' : '') +
      (e.k ? '<span class="tt slotb">枠' + e.k + ' ' + esc(slotLabel(e.k)) + '</span>' : '') +
      (bad ? '<span class="tt warnb">年齢・性別なし</span>' : '') + '</div>' +
      '<div class="n">' + (e.n > 1 ? '×' + e.n : '') + '</div>' +
      '<div class="ops">' + (ro ? '' :
        '<button type="button" class="btn small" data-act="edit" data-id="' + e.id + '">編集</button>' +
        '<button type="button" class="btn small danger" data-act="del" data-id="' + e.id + '">' + (del ? '削除する？' : '削除') + '</button>') + '</div>' +
      (subs ? '<div class="sub">' + subs + '</div>' : '') + '</div>';
  }).join('');
  $('logMore').hidden = list.length <= shown.length;
}

/* ---------- 症例リスト取り込み ---------- */
function impEntryList(){ return getEntries().filter(e => isImpId(e.id)); }

function impAgg(){
  const I = ui.imp;
  if (!I || I.cols.date < 0 || I.cols.cat < 0) return null;
  const key = JSON.stringify([I.mode, I.hdr, I.cols, I.vals, I.from, I.to, I.sheet]);
  if (I.aggKey !== key) {
    I.res = I.mode === 'count'
      ? aggregateImport(I.grid, {hdr: I.hdr, date: I.cols.date, cat: I.cols.cat, cat2: I.cols.cat2, vals: I.vals, from: I.from, to: I.to})
      : buildCaseImport(I.grid, {hdr: I.hdr, cols: I.cols, vals: I.vals, from: I.from, to: I.to});
    I.aggKey = key;
  }
  return I.res;
}
// 取り込み内容と、いまの記録との関係（新規・更新・置き換えで消える分・手入力との重複）
function impPlan(I, res){
  const cur = getEntries(), byId = {};
  cur.forEach(e => { byId[e.id] = e; });
  let ents, lo = '', hi = '';
  if (I.mode === 'count') {
    ents = importEntries(res.agg, I.site, '自動取込');
    Object.keys(res.agg).forEach(k => { const d = k.split('|')[0]; if (!lo || d < lo) lo = d; if (d > hi) hi = d; });
  } else {
    ents = caseImportEntries(res.items, I.site);
    ents.forEach(e => { if (!lo || e.d < lo) lo = e.d; if (e.d > hi) hi = e.d; });
  }
  const ids = new Set(ents.map(e => e.id)), cats = new Set(ents.map(e => e.c));
  const upd = ents.filter(e => byId[e.id]).length;
  const stale = I.mode === 'count' ? [] : cur.filter(e => isImpId(e.id) && !ids.has(e.id) && !e.k && lo && e.d >= lo && e.d <= hi && cats.has(e.c));
  const manual = cur.filter(e => !isImpId(e.id) && lo && e.d >= lo && e.d <= hi && cats.has(e.c)).length;
  const otherMode = I.mode === 'count' ? cur.filter(e => e.id.indexOf('imc') === 0 && lo && e.d >= lo && e.d <= hi && cats.has(e.c)).length : 0;
  return {ents: ents, byId: byId, ids: ids, add: ents.length - upd, upd: upd, stale: stale, manual: manual, otherMode: otherMode, lo: lo, hi: hi};
}

function impColOptions(I, selected, allowNone){
  let h = allowNone ? '<option value="-1">使わない</option>' : '<option value="-1" disabled' + (selected < 0 ? ' selected' : '') + '>選んでください</option>';
  I.heads.forEach(x => {
    h += '<option value="' + x.i + '"' + (x.priv ? ' disabled' : '') + (x.i === selected ? ' selected' : '') + '>' + esc(x.label) + (x.priv ? '（個人情報のため使えません）' : '') + '</option>';
  });
  return h;
}

function impSample(I, col, scrub){
  if (col < 0) return '';
  const out = [];
  for (let r = I.hdr + 1; r < I.grid.length && out.length < 3; r++) {
    let v = cellText(I.grid[r] || [], col);
    if (v && scrub) v = scrubText(v, 40).text;                                       // 自由記述の列は、個人情報らしい表現を除いた形で見せる
    if (v && out.indexOf(v) < 0) out.push(v);
  }
  return out.length ? '例: ' + out.map(v => esc(v.slice(0, 20))).join(' / ') : '';
}
function renderImport(){
  const el = $('v-import'), I = ui.imp;
  let h = '<div class="imp-wrap">';
  if (!I) {
    const done = impEntryList();
    const days = new Set(done.map(e => e.d)).size;
    h += '<div class="card"><h3>症例リストから取り込む</h3>' +
      '<p>レポート（RIS）などから出力した症例リスト（CSV・Excel）を読み込んで、すでに終わった分をまとめて登録します。<b>1行を1症例</b>として、検査日・区分に加え、年齢・性別（と、選んだ場合は部位・依頼内容・診断名など）を取り込みます。研修手帳の様式に書き込むための情報です。</p>' +
      '<div class="imp-priv">患者氏名・患者ID・生年月日・住所などの列は選べず、読み込みません。年齢と性別は様式で必要なため取り込めますが、不要なら「使わない」にできます。部位・依頼内容・診断名などの自由記述は、列を選んだときだけ読みます。ファイルの中身はこのブラウザの外には送られません。</div>' +
      '<div class="dropzone" id="impDrop"><span>ここにファイルをドロップ、または</span>' +
      '<label class="btn primary" for="fImp">ファイルを選ぶ</label><input id="fImp" type="file" accept=".csv,.tsv,.txt,.xlsx,.xls" hidden>' +
      '<span class="dim" style="font-size:12.5px">対応形式: CSV（UTF-8・Shift-JIS）、Excel（.xlsx / .xls）</span></div>' +
      (ui.impMsg ? '<p class="msgline bad">' + esc(ui.impMsg) + '</p>' : '') + '</div>';
    if (done.length) {
      h += '<div class="card"><h3>取り込み済みの記録</h3><p>取り込みで登録された記録が <b>' + fmtN(done.length) + '</b> 件（' + fmtN(days) + ' 日分）あります。同じリストをもう一度取り込んでも、同じ症例は更新されるだけで二重にはなりません。疾患群の枠に割り当てた症例は、再取り込みしても残ります（ただし下の「すべて削除」は、枠に割り当てた取り込み分も含めて消します）。</p>' +
        '<div><button type="button" class="btn small danger" data-act="impdelall">' + (ui.impDel ? '本当に削除する？（もう一度押す）' : '取り込み分をすべて削除') + '</button></div></div>';
    }
    el.innerHTML = h + '</div>';
    return;
  }
  const res = impAgg();
  h += '<div class="card"><h3>1. 列を確認 <span class="dim" style="font-weight:400;font-size:13px">' + esc(I.name) + '</span></h3>';
  if (I.sheets.length > 1) {
    h += '<label class="fld" style="margin:0"><span>シート</span><select data-imp="sheet">' + I.sheets.map((n, i) => '<option value="' + i + '"' + (i === I.sheet ? ' selected' : '') + '>' + esc(n) + '</option>').join('') + '</select></label>';
  }
  h += '<div class="imp-sel"><label class="fld" style="margin:0"><span>見出し（列名）がある行</span><select data-imp="hdr">' +
    Array.from({length: Math.min(I.grid.length, 20)}, (_, i) => '<option value="' + i + '"' + (i === I.hdr ? ' selected' : '') + '>' + (i + 1) + '行目</option>').join('') + '</select></label>' +
    '<label class="fld" style="margin:0"><span>検査日の列（必須）</span><select data-imp="date">' + impColOptions(I, I.cols.date, false) + '</select><small class="dim">' + impSample(I, I.cols.date) + '</small></label>' +
    '<label class="fld" style="margin:0"><span>区分の列（モダリティ・検査種別など／必須）</span><select data-imp="cat">' + impColOptions(I, I.cols.cat, false) + '</select><small class="dim">' + impSample(I, I.cols.cat) + '</small></label>' +
    '<label class="fld" style="margin:0"><span>さらに細かく分ける列（任意。放射線治療の部位など）</span><select data-imp="cat2">' + impColOptions(I, I.cols.cat2, true) + '</select></label></div>';
  h += '<div class="imp-mode" role="radiogroup" aria-label="取り込み方"><label><input type="radio" name="impmode" data-imp="mode" value="case"' + (I.mode === 'case' ? ' checked' : '') + '> 症例ごとに取り込む（様式への書き出し用・おすすめ）</label>' +
    '<label><input type="radio" name="impmode" data-imp="mode" value="count"' + (I.mode === 'count' ? ' checked' : '') + '> 件数だけ取り込む（日付×区分の合計のみ）</label></div>';
  if (I.mode === 'case') {
    h += '<details class="detcols"' + (IMP_ROLES.some(r => I.cols[r.k] >= 0) ? ' open' : '') + '><summary>年齢・性別・診断名などの列（任意）</summary><div class="imp-sel" style="margin-top:10px">' +
      IMP_ROLES.map(r => '<label class="fld" style="margin:0 0 10px"><span>' + esc(r.label) + (r.txt ? '（自由記述）' : '') + '</span><select data-imp="role" data-role="' + r.k + '">' + impColOptions(I, I.cols[r.k], true) + '</select><small class="dim">' + impSample(I, I.cols[r.k], !!r.txt) + '</small></label>').join('') +
      '</div><p class="dim" style="font-size:12.5px">自由記述の列は選んだときだけ読みます。電話番号・長い数字・日付・「○○様」のような個人情報らしい表現は自動で取り除きますが、完全ではありません。下の「取り込み内容」のサンプルで必ず確認してください。</p></details>';
  }
  h += (I.heads.some(x => x.priv) ? '<div class="imp-priv">個人情報とみられる列（' + esc(I.heads.filter(x => x.priv).map(x => x.label).join('、')) + '）は選べず、読み込みません。</div>' : '') + '</div>';
  if (!res) {
    h += '<div class="card"><p>検査日と区分の列を選ぶと、次の手順が表示されます。</p><div><button type="button" class="btn" data-act="impcancel">キャンセル</button></div></div>';
    el.innerHTML = h + '</div>';
    return;
  }
  const sc = I.scan;
  h += '<div class="card"><h3>2. 区分の読み替えを確認</h3><p>列の値を、このアプリの区分に対応づけます。自動で当てはまりそうなものを選んであります。違うものは直してください。次回から覚えています。</p>' +
    '<table class="itable"><thead><tr><th>列の値</th><th class="r">行数</th><th>取り込み先</th></tr></thead><tbody>' +
    sc.keys.slice(0, 80).map((k, i) => '<tr><td class="k">' + esc(k.key.replace('\u0001', ' / ') || '(空欄)') + '</td><td class="r">' + fmtN(k.n) + '</td><td>' +
      '<select data-imp="val" data-i="' + i + '" aria-label="取り込み先">' +
      '<option value="-"' + (I.vals[k.key] === '-' || !I.vals[k.key] ? ' selected' : '') + '>取り込まない</option>' +
      IMP_CATS.map(c => '<option value="' + c.k + '"' + (I.vals[k.key] === c.k ? ' selected' : '') + '>' + esc(c.label) + '</option>').join('') +
      '</select></td></tr>').join('') + '</tbody></table>' +
    (sc.keys.length > 80 ? '<p>件数の多い上位80種類を表示しています。残りは自動の当てはめに従います。</p>' : '') + '</div>';
  const st = res.stat, plan = impPlan(I, res);
  h += '<div class="card"><h3>3. 期間と施設（任意）</h3><div class="imp-sel">' +
    '<label class="fld" style="margin:0"><span>この日以降だけ取り込む</span><input type="date" data-imp="from" value="' + esc(I.from) + '"></label>' +
    '<label class="fld" style="margin:0"><span>この日以前だけ取り込む</span><input type="date" data-imp="to" value="' + esc(I.to) + '"></label>' +
    '<label class="fld" style="margin:0"><span>施設（全件に付ける。空欄なら設定の先頭の施設）</span><input type="text" data-imp="site" list="siteList" maxlength="60" value="' + esc(I.site) + '"></label></div>' +
    '<p>ファイルの検査日の範囲: ' + esc(sc.minD || '—') + ' 〜 ' + esc(sc.maxD || '—') + '</p></div>';
  h += '<div class="card"><h3>4. 取り込み内容</h3>';
  if (!st.ok) h += '<p>取り込める症例がありません。区分の読み替えか、列の選択を確認してください。</p>';
  else {
    h += '<table class="itable"><thead><tr><th>区分</th><th class="r">件数</th></tr></thead><tbody>' +
      IMP_CATS.filter(c => res.perCat[c.k]).map(c => '<tr><td>' + esc(c.label) + '</td><td class="r">' + fmtN(res.perCat[c.k]) + '</td></tr>').join('') +
      '<tr><td><b>合計</b></td><td class="r"><b>' + fmtN(st.ok) + '</b></td></tr></tbody></table>';
    if (I.mode === 'case') {
      h += '<p>年齢あり ' + fmtN(st.ageN) + ' 件／性別あり ' + fmtN(st.sexN) + ' 件' + (st.scrubbed ? '／個人情報らしい表現を取り除いた項目 ' + fmtN(st.scrubbed) + ' 件' : '') + '</p>';
      h += '<p class="dim" style="font-size:12.5px">保存される内容のサンプル（先頭の5件）</p><div class="tablewrap"><table class="itable"><thead><tr><th>日付</th><th>区分</th><th>年齢</th><th>性別</th><th>部位</th><th>依頼内容</th><th>診断名</th></tr></thead><tbody>' +
        plan.ents.slice(0, 5).map(e => '<tr><td class="num2">' + esc(e.d) + '</td><td>' + esc(CAT_BY[e.c].short) + '</td><td>' + (e.a != null ? e.a : '') + '</td><td>' + esc(e.x || '') + '</td><td>' + esc(e.p || '') + '</td><td>' + esc(e.r || '') + '</td><td>' + esc(e.z || '') + '</td></tr>').join('') + '</tbody></table></div>';
    }
  }
  h += '<p>読み込んだ行 ' + fmtN(st.rows) + '／取り込み ' + fmtN(st.ok) + '／日付を読めない ' + fmtN(st.badDate) + '／「取り込まない」の区分 ' + fmtN(st.skipCat) + '／期間外 ' + fmtN(st.outside) + '</p>';
  if (I.mode === 'case') {
    if (plan.upd) h += '<p>すでに取り込み済みの症例 ' + fmtN(plan.upd) + ' 件は更新され（疾患群の枠などはそのまま）、新規は ' + fmtN(plan.add) + ' 件です。</p>';
    if (plan.stale.length) h += '<p>前回の取り込みにあって今回のファイルにない記録 ' + fmtN(plan.stale.length) + ' 件（枠に使っていないもの）は削除されます。</p>';
  } else if (plan.upd) h += '<p>同じ日・同じ区分の取り込み済み記録 ' + fmtN(plan.upd) + ' 件は、今回の件数で置き換わります。</p>';
  if (plan.otherMode) h += '<p class="msgline bad">同じ期間に、症例ごとに取り込んだ記録が ' + fmtN(plan.otherMode) + ' 件あります。件数だけの取り込みを重ねると二重に数えます。</p>';
  if (plan.manual) h += '<p class="msgline bad">同じ期間（' + esc(plan.lo) + ' 〜 ' + esc(plan.hi) + '）に、手入力した症例がすでに ' + fmtN(plan.manual) + ' 件あります。同じ症例を二重に数えないよう、必要なら先に整理してください。</p>';
  h += '<div class="row2" style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="btn primary" data-act="impgo"' + (st.ok ? '' : ' disabled') + '>' + fmtN(st.ok) + ' 件を取り込む</button>' +
    '<button type="button" class="btn" data-act="impcancel">キャンセル</button></div></div>';
  el.innerHTML = h + '</div>';
}

/* ---------- 出力・設定 ---------- */

/* ---------- 出力・設定 ---------- */
function renderExport(){
  const es = getEntries();
  $('exInfo').textContent = '登録 ' + fmtN(es.length) + ' 件（症例数の合計 ' + fmtN(es.reduce((s, e) => s + e.n, 0)) + '）';
  renderTplInfo();
  $('bkInfo').textContent = state.settings.backup ? '最終バックアップ: ' + state.settings.backup : 'まだバックアップしていません。';
  $('storeInfo').textContent = state.mode === 'gas'
    ? 'データは管理者のスプレッドシートに保存されています。管理者は全メンバーの記録を閲覧できます（他のメンバーからは見えません）。'
    : 'データはこのブラウザの中にだけ保存されています。ブラウザの設定を消去すると失われるため、バックアップを保存してください。';
  const r = ui.restore;
  $('restoreBox').innerHTML = !r ? '' : r.error
    ? '<span style="color:var(--bad)">' + esc(r.error) + '</span>'
    : '<span>症例 ' + fmtN(r.n) + ' 件を検出（新規 ' + fmtN(r.fresh) + ' 件）。</span><div style="display:flex;gap:8px"><button type="button" class="btn small primary" data-act="restore-ok">取り込む</button><button type="button" class="btn small" data-act="restore-cancel">キャンセル</button></div>';
}

function renderSettings(){
  const st = state.settings;
  let h = '';
  if (state.mode === 'gas' && state.session && state.session.me) {
    h += '<section class="card set"><h3>アカウント</h3><p class="srcp">' + esc(state.session.me.name) + ' さんとしてログイン中です。</p>' +
      '<form id="pwForm" class="imp-sel" autocomplete="off">' +
      '<label class="fld"><span>いまのパスコード</span><input id="pwOld" type="password" autocomplete="current-password" maxlength="64"></label>' +
      '<label class="fld"><span>新しいパスコード（6文字以上）</span><input id="pwNew" type="password" autocomplete="new-password" maxlength="64"></label>' +
      '<div class="fld" style="align-content:end"><button class="btn" type="submit">パスコードを変更</button></div></form>' +
      '<p class="msgline" id="pwMsg"></p></section>';
  }
  h += '<section class="card set"><h3>基本情報</h3><p class="srcp">研修手帳の様式に書き込むときに使います。施設コードは9桁の数字です（放射線科専門医の様式で使います）。施設番号は、診断専門医・治療専門医の専攻医研修手帳の「施設番号」欄に入れる番号です（例: 総-12。空欄なら施設名が入ります）。</p>' +
    '<div class="imp-sel">' +
    '<label class="fld"><span>入学年度</span><select data-act="cohort"><option value="0">未設定</option>' +
    cohortOptions().concat(st.cohort && cohortOptions().indexOf(st.cohort) < 0 ? [st.cohort] : []).sort((a, b) => b - a).map(y => '<option value="' + y + '"' + (st.cohort === y ? ' selected' : '') + '>' + y + '年度</option>').join('') + '</select></label>' +
    '<label class="fld"><span>自分の氏名（第一読影者・術者・立案者の既定）</span><input type="text" data-act="me" maxlength="20" value="' + esc(st.me) + '"></label>' +
    '<label class="fld"><span>指導医の氏名（確定者・指導医確認の既定）</span><input type="text" data-act="sv" maxlength="20" value="' + esc(st.sv) + '"></label></div>' +
    '<h4 class="subh">研修施設（先頭の施設が既定になります）</h4>' +
    (st.facs.length ? '<ul class="faclist">' + st.facs.map((f, i) => '<li><span class="fn">' + esc(f.n) + '</span><span class="fc num2">' + (f.c ? esc(f.c) : '<em class="bad">コード未設定</em>') + (f.k ? ' ・ 番号 ' + esc(f.k) : '') + '</span><button type="button" class="x" data-act="facdel" data-i="' + i + '" aria-label="この施設を削除">×</button></li>').join('') + '</ul>' : '<p class="srcp">まだ施設が登録されていません。</p>') +
    '<form id="facForm" class="evform"><input id="facName" type="text" maxlength="40" placeholder="施設名（例: ○○大学病院）" aria-label="施設名"><input id="facCode" type="text" inputmode="numeric" maxlength="9" placeholder="施設コード9桁" aria-label="施設コード"><input id="facNo" type="text" maxlength="12" placeholder="施設番号（診断・治療用）" aria-label="施設番号"><button class="btn small" type="submit">追加</button></form>' +
    '<p class="msgline bad" id="facMsg"></p></section>';
  h += TRACKS.map(t => {
    const r = st.range[t.id] || {};
    const g = st.goals[t.id] || {};
    return '<section class="card set"><h3>' + esc(t.name) + '<span class="tag ' + t.src + '">' + esc(t.srcTag) + '</span></h3>' +
      '<p class="srcp">' + esc(t.srcText) + '</p>' +
      '<div class="rangeRow"><label class="fld"><span>集計の開始日（空欄で制限なし）</span><input type="date" data-act="range" data-t="' + t.id + '" data-f="from" value="' + esc(r.from || '') + '"></label>' +
      '<label class="fld"><span>集計の終了日（空欄で制限なし）</span><input type="date" data-act="range" data-t="' + t.id + '" data-f="to" value="' + esc(r.to || '') + '"></label></div>' +
      '<div class="goalgrid">' + t.items.map(it => {
        const v = Object.prototype.hasOwnProperty.call(g, it.id) ? g[it.id] : it.goal;
        return '<label><span>' + (it.sub ? '└ ' : '') + esc(it.label) + '</span><input type="number" min="0" max="99999" inputmode="numeric" data-act="goal" data-t="' + t.id + '" data-i="' + it.id +
          '" value="' + (v == null ? '' : v) + '" placeholder="規定なし" aria-label="' + esc(it.label) + 'の目標"></label>';
      }).join('') + '</div>' +
      '<button type="button" class="btn small" data-act="resetgoals" data-t="' + t.id + '">目標を初期値に戻す</button></section>';
  }).join('');
  $('v-settings').innerHTML = h;
}

/* ---------- 管理者 ---------- */

/* ---------- 管理者 ---------- */
const ASORT = {
  name: m => m.name, cohort: m => m.cohort || 0, base: m => m.tracks[0].s.pct, diag: m => m.tracks[1].s.pct, rt: m => m.tracks[2].s.pct,
  next: m => m.next ? m.next.days : 99999, total: m => m.total, dz: m => m.dzN, lastD: m => m.lastD, upd: m => m.upd
};

function pctCell(t){
  if (!t.s.total) return '<td><span class="dim" title="症例数の目標が未設定です">—</span></td>';
  return '<td><div class="pc" title="達成 ' + t.s.doneN + ' / ' + t.s.total + ' 項目"><div class="mini' + (t.s.pct >= 100 ? ' ok' : '') + '"><i style="width:' + t.s.pct + '%"></i></div><b>' + t.s.pct + '%</b></div></td>';
}
function renderAOverview(){
  const L = ui.all, box = $('aTable');
  if (!L) {
    box.innerHTML = '<div class="empty">' + (ui.aloading ? '読み込み中…' : (ui.aErr || '読み込めませんでした。「最新の状態に更新」を押してください。')) + '</div>';
    $('aInfo').textContent = '';
    $('aCohort').innerHTML = '<option value="all">すべての入学年度</option>';
    return;
  }
  const years = Array.from(new Set(L.map(m => m.cohort || 0))).sort((a, b) => b - a);
  if (ui.aCohort !== 'all' && years.indexOf(Number(ui.aCohort)) < 0) ui.aCohort = 'all';
  $('aCohort').innerHTML = '<option value="all">すべての入学年度（' + L.length + '人）</option>' + years.map(y =>
    '<option value="' + y + '"' + (String(ui.aCohort) === String(y) ? ' selected' : '') + '>' + (y ? y + '年度入学' : '入学年度 未設定') + '（' + L.filter(m => (m.cohort || 0) === y).length + '人）</option>').join('');
  const q = ($('aq').value || '').trim().toLowerCase();
  const rows = L.filter(m => (ui.aCohort === 'all' || (m.cohort || 0) === Number(ui.aCohort)) && (!q || m.name.toLowerCase().indexOf(q) >= 0));
  const f = ASORT[ui.asort] || ASORT.name;
  rows.sort((a, b) => { const x = f(a), y = f(b); return (x < y ? -1 : x > y ? 1 : 0) * ui.adir || (a.name < b.name ? -1 : 1); });
  const lim = daysAgo(30);
  const active = rows.filter(m => m.lastD && m.lastD >= lim).length;
  $('aInfo').textContent = '表示 ' + rows.length + ' 人 ／ 最近30日に症例の入力あり ' + active + ' 人 ／ なし ' + (rows.length - active) + ' 人' +
    (ui.aloading ? '（更新中…）' : '');
  if (!L.length) { box.innerHTML = '<div class="empty">まだメンバーがいません。招待コードを伝えて、「新規登録」してもらってください。</div>'; return; }
  const th = (k, label, cls) => '<th class="' + (cls || '') + '"' + (ui.asort === k ? ' aria-sort="' + (ui.adir > 0 ? 'ascending' : 'descending') + '"' : '') +
    '><button type="button" data-act="asort" data-k="' + k + '">' + label + (ui.asort === k ? (ui.adir > 0 ? ' ▲' : ' ▼') : '') + '</button></th>';
  box.innerHTML = '<table class="atable"><thead><tr>' + th('name', '氏名') + th('cohort', '入学年度') + th('base', '放射線科専門医') + th('diag', '診断専門医') + th('rt', '治療専門医') +
    th('next', '次の受験予定') + '<th>必要なペース</th>' + th('total', '登録件数', 'r') + th('dz', '疾患群(枠)', 'r') + th('lastD', '最終入力日') + th('upd', '最終保存') + '</tr></thead><tbody>' +
    rows.map(m => {
      const nx = m.next;
      return '<tr><td><button type="button" class="nm" data-act="open" data-id="' + esc(m.id) + '">' + esc(m.name) + '</button></td>' +
        '<td class="num2' + (m.cohort ? '' : ' dim') + '">' + (m.cohort ? esc(m.cohort + '年度') : '未設定') + '</td>' +
        pctCell(m.tracks[0]) + pctCell(m.tracks[1]) + pctCell(m.tracks[2]) +
        '<td class="num2">' + (nx ? esc(nx.date) + ' <b>あと' + fmtN(nx.days) + '日</b> <span class="dim">' + esc(TRACK_BY[nx.id].name) + '</span>' : '<span class="dim">未設定</span>') + '</td>' +
        '<td class="num2">' + (nx ? (nx.rest == null ? '<span class="dim">目標未設定</span>' : nx.rest > 0 ? '不足' + fmtN(nx.rest) + '・' + (nx.pace ? '<b>週' + nx.pace.perWeek + '</b>' : '本日') : '<span class="ok-t">達成</span>') : '<span class="dim">—</span>') + '</td>' +
        '<td class="r num2">' + fmtN(m.total) + (m.inc ? '<small class="dim" title="年齢・性別が未入力の画像診断症例"> (未入力' + fmtN(m.inc) + ')</small>' : '') + '</td><td class="r num2">' + fmtN(m.dzN) + '</td>' +
        '<td class="num2' + (m.lastD && m.lastD < lim ? ' stale' : '') + (m.lastD ? '' : ' dim') + '">' + esc(m.lastD || '入力なし') + '</td>' +
        '<td class="num2 dim">' + esc(fmtDT(m.upd)) + '</td></tr>';
    }).join('') + '</tbody></table>';
}

function renderAMembers(){
  const L = ui.all, el = $('v-a-members');
  if (!L) { el.innerHTML = '<div class="empty">' + (ui.aloading ? '読み込み中…' : '読み込めませんでした。') + '</div>'; return; }
  let h = '<p class="loginfo">メンバー ' + L.length + ' 人。名前の修正、パスコードの再設定（忘れたとき）、削除ができます。</p>';
  if (ui.mgrMsg) h += '<p class="msgline' + (ui.mgrBad ? ' bad' : '') + '">' + esc(ui.mgrMsg) + '</p>';
  h += '<div class="loglist">';
  if (!L.length) h += '<div class="empty">まだメンバーがいません。</div>';
  L.slice().sort((a, b) => a.name < b.name ? -1 : 1).forEach(m => {
    const open = ui.mgr && ui.mgr.id === m.id ? ui.mgr.mode : '';
    h += '<div class="mrow"><div><div class="nmx">' + esc(m.name) + ' <span class="dim" style="font-weight:400;font-size:12.5px">' + esc(cohortLabel(m.cohort)) + '</span></div><div class="meta">登録 ' + esc(fmtDT(m.created)) + ' ／ 最終ログイン ' + esc(fmtDT(m.seen)) + '</div></div>' +
      '<div class="meta">登録 ' + fmtN(m.total) + ' 件</div>' +
      '<div class="ops"><button type="button" class="btn small" data-act="mgr" data-mode="rename" data-id="' + esc(m.id) + '">名前を変更</button>' +
      '<button type="button" class="btn small" data-act="mgr" data-mode="pass" data-id="' + esc(m.id) + '">パスコードを再設定</button>' +
      '<button type="button" class="btn small danger" data-act="mgr" data-mode="del" data-id="' + esc(m.id) + '">削除</button></div>';
    if (open === 'rename') h += '<div class="inl"><input id="mgrIn" type="text" maxlength="24" value="' + esc(m.name) + '" aria-label="新しい氏名"><button type="button" class="btn small primary" data-act="mgrgo">保存</button><button type="button" class="btn small" data-act="mgrno">キャンセル</button></div>';
    if (open === 'pass') h += '<div class="inl"><input id="mgrIn" type="text" maxlength="64" placeholder="新しいパスコード（6文字以上）" aria-label="新しいパスコード" autocomplete="off"><button type="button" class="btn small primary" data-act="mgrgo">設定</button><button type="button" class="btn small" data-act="mgrno">キャンセル</button><span class="meta" style="flex-basis:100%">設定後、本人にこのパスコードを伝え、ログイン後に「設定」から変更してもらってください。</span></div>';
    if (open === 'del') h += '<div class="inl"><span>' + esc(m.name) + ' さんと、その全記録を削除します。元に戻せません。</span><button type="button" class="btn small danger" data-act="mgrgo">削除する</button><button type="button" class="btn small" data-act="mgrno">キャンセル</button></div>';
    h += '</div>';
  });
  el.innerHTML = h + '</div>';
}

function renderAExport(){
  const L = ui.all || [];
  const years = Array.from(new Set(L.map(m => m.cohort || 0))).sort((a, b) => b - a);
  const sel = ui.aCohort;
  const n = L.filter(m => sel === 'all' || (m.cohort || 0) === Number(sel)).length;
  $('v-a-export').innerHTML = '<p class="loginfo">対象: ' + (sel === 'all' ? 'すべての入学年度' : (Number(sel) ? sel + '年度入学' : '入学年度 未設定')) + '（' + n + '人）。「全員の進捗」タブの入学年度の絞り込みに従います。 ／ 登録 ' + fmtN(L.reduce((s, m) => s + m.total, 0)) + ' 件（全員）</p>' +
    '<div class="acts"><div class="card"><h3>Excel（.xlsx）</h3><p>「全員サマリ」に人ごとの入学年度・受験予定・達成率・区分別の件数、「全員症例一覧」に全員の症例を出します。各メンバーの記録を順に読み込むため、少し時間がかかります。</p><button class="btn primary" data-act="axlsx">Excelで出力</button></div>' +
    '<div class="card"><h3>CSV</h3><p>全員の症例一覧のみ。UTF-8（BOM付き）です。</p><button class="btn" data-act="acsv">CSVで出力</button></div>' +
    '<div class="card"><h3>スプレッドシートに書き出す</h3><p>データ用スプレッドシートに「全員サマリ」「全員症例一覧」のシートを作り直します。ダウンロードできない環境でも確認・印刷できます。</p><button class="btn" data-act="asheet">書き出してリンクを表示</button></div></div>' +
    (ui.aExpMsg ? '<p class="msgline" style="margin-top:12px">' + ui.aExpMsg + '</p>' : '') +
    '<p class="loginfo" style="margin-top:14px">各メンバーの研修手帳の様式（Excel）は、「全員の進捗」で名前を開き、上のバーの「研修手帳の様式で出力」から出せます。</p>';
}

/* ---------- 全体 ---------- */
function render(){
  renderStatus(); renderWho();
  const scr = ui.screen;
  $('auth').hidden = scr !== 'auth';
  $('appmain').hidden = scr === 'auth';
  if (scr === 'auth') { renderAuth(); renderFoot(); return; }
  const member = scr === 'member' && !ui.asMember;
  $('entry').hidden = !member;
  $('layout').classList.toggle('solo', !member);
  renderViews(); renderDrill(); renderTplFile();
  if (member) { renderChips(); renderSites(); updateFormForCat(); }
  switch (ui.view) {
    case 'progress': renderProgress(); break;
    case 'dz': renderDz(); break;
    case 'log': renderLog(); break;
    case 'import': renderImport(); break;
    case 'export': renderExport(); break;
    case 'settings': renderSettings(); break;
    case 'a-overview': renderAOverview(); break;
    case 'a-members': renderAMembers(); break;
    case 'a-export': renderAExport(); break;
  }
  renderFoot();
}

function renderFoot(){
  $('foot').innerHTML = state.appUrl && state.mode === 'gas'
    ? 'ダウンロードや表示がうまくいかないときは <a href="' + esc(state.appUrl) + '" target="_blank" rel="noopener">別のタブで開く</a> と改善することがあります。'
    : '';
}
