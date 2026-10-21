const fs = require('fs'), path = require('path'), assert = require('assert'), cp = require('child_process');
const L = require('./e2e-lib.js');
const { chromium } = require('playwright-core');
const { env, step, newPage, txt, shot, login, waitSaved, errs, DIR, OUT, XLSX, EMBEDDED, TPL, HAS_TPL, CAN_TPL, ensureTpl } = L;

/* ---- サーバー側の状態を管理者APIで読む補助 ---- */
const admTok = () => env.call('api_adminLogin', 'adminpass1').token;
const memberByName = n => env.call('api_adminAll', admTok()).members.find(m => m.name === n);
function docsOf(n) { return env.call('api_adminMember', admTok(), memberByName(n).id).docs; }
function entriesOf(n) {
  const d = docsOf(n), out = [];
  Object.keys(d).filter(k => k.startsWith('m-')).forEach(k => { const j = JSON.parse(d[k]); Object.keys(j).forEach(id => out.push(Object.assign({ id }, j[id]))); });
  return out;
}
const settingsOf = n => JSON.parse(docsOf(n).settings || '{}');
const ymd = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const inDays = n => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + n); return ymd(d); };
function dumpTpl(p) { return JSON.parse(cp.execFileSync('python3', [path.join(DIR, 'dump_tpl.py'), p], { maxBuffer: 1 << 26 }).toString()); }
const ST = { A: '形成評価（Ⅳ.経験 A.疾患）指導医確認なし', CT: '形成評価（Ⅳ.経験B.CT）', MRI: '形成評価（Ⅳ.経験B.MRI）', US: '形成評価（Ⅳ.経験B.超音波）', X: '形成評価（Ⅳ.経験B.単純）' };

async function fillCase(page, o) {
  if (o.cat) await page.click(`.chip[data-cat="${o.cat}"]`);
  if (o.date) await page.fill('#fDate', o.date);
  if (o.n) await page.fill('#fN', String(o.n));
  if (o.age != null) await page.fill('#fAge', String(o.age));
  if (o.sex) await page.selectOption('#fSex', o.sex);
  if (o.part) await page.fill('#fPart', o.part);
  if (o.kind) await page.fill('#fKind', o.kind);
  if (o.req) await page.fill('#fReq', o.req);
  if (o.dz) await page.fill('#fDz', o.dz);
  if (o.slot) await page.selectOption('#fSlot', String(o.slot));
}

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--no-sandbox'] });

  /* 取り込み用のテストファイル（患者情報を含む） */
  const rows = ['患者ID,患者氏名,検査日,モダリティ,検査名,生年月日'];
  const mod = ['CT', 'CT', 'MR', 'US', 'CR', 'OT', 'CT', 'PT'];
  for (let i = 0; i < 40; i++) rows.push(`PAT${1000 + i},患者${i}太郎,2026/04/${String(1 + (i % 9)).padStart(2, '0')},${mod[i % mod.length]},検査${i},19700101`);
  rows.push('PAT9999,不明さん,日付不明,CT,検査x,19700101');
  fs.writeFileSync(path.join(OUT, 'rep-utf8.csv'), '﻿' + rows.join('\r\n'));
  fs.writeFileSync(path.join(OUT, 'rep-nobom.csv'), rows.join('\r\n'));
  cp.execSync(`iconv -f UTF-8 -t CP932 ${path.join(OUT, 'rep-nobom.csv')} > ${path.join(OUT, 'rep-sjis.csv')}`);
  // 症例ごと取り込み用: 年齢・性別・部位・診断名つき（診断名には個人情報らしい文字列を混ぜる）
  const cr = ['患者ID,患者氏名,検査日,モダリティ,年齢,性別,部位,診断名,生年月日'];
  const cMod = ['CT', 'MR', 'US', 'CR', 'OT', 'CT'], cAge = ['45', '3ヶ月', '70歳', '82', '9', '61'], cSex = ['男', 'F', '女性', 'M', '男性', '女'];
  const cDiag = ['肺炎、鈴木様のご紹介', '脳梗塞 test@example.com', '肝嚢胞 ID12345678'];
  for (let i = 0; i < 12; i++) cr.push(`PAT${2000 + i},患者${i}次郎,2026/05/${String(1 + (i % 5)).padStart(2, '0')},${cMod[i % 6]},${cAge[i % 6]},${cSex[i % 6]},${['胸部', '腹部', '頭部'][i % 3]},${i < 3 ? cDiag[i] : '診断' + i},19600101`);
  fs.writeFileSync(path.join(OUT, 'rep-case.csv'), '﻿' + cr.join('\r\n'));
  const aoa = [['○○病院 読影レポート一覧'], ['出力日', '2026-05-01'], ['患者ID', '患者氏名', '検査日', 'モダリティ', '部位']];
  for (let i = 0; i < 12; i++) aoa.push(['X' + i, '患者' + i, new Date(Date.UTC(2026, 4, 1 + (i % 4))), ['MR', 'RT', 'CT'][i % 3], ['胸部', '乳房', '頭部'][i % 3]]);
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa, { cellDates: true }), 'Sheet1');
  XLSX.writeFile(wb, path.join(OUT, 'rep.xlsx'), { cellDates: true });

  /* ================= メンバー山田 ================= */
  const A = await newPage(browser); const a = A.page;
  await step('auth screen shows; register tab fields', async () => {
    await a.waitForSelector('#auth:not([hidden])');
    assert.ok(await a.isHidden('#appmain'));
    await a.click('[data-atab="register"]');
    assert.ok(await a.isVisible('#aJoin') && await a.isVisible('#aPass2'));
    await shot(a, '01-auth');
  });
  await step('register validation (mismatch / bad join code) then success', async () => {
    await a.fill('#inName', '山田 太郎'); await a.fill('#inPass', 'secret1'); await a.fill('#inPass2', 'secret2'); await a.fill('#inJoin', 'join123');
    await a.click('#authGo');
    assert.match(await txt(a, '#authErr'), /一致しません/);
    await a.fill('#inPass2', 'secret1'); await a.fill('#inJoin', 'wrong');
    await a.click('#authGo');
    await a.waitForFunction(() => /招待コード/.test(document.querySelector('#authErr').textContent));
    await a.fill('#inJoin', 'join123');
    await a.click('#authGo');
    await a.waitForSelector('#appmain:not([hidden])');
    assert.match(await txt(a, '#who'), /山田 太郎 さん/);
    assert.ok(await a.isVisible('#entry'));
    await waitSaved(a);
  });

  /* ---- 症例を1件ずつ登録 ---- */
  await step('add a case with age/sex/part/kind/request/diagnosis/slot → server has it + a summary doc', async () => {
    assert.ok(await a.isVisible('.demo-banner'));
    await fillCase(a, { date: '2026-04-03', cat: 'ct', age: 67, sex: 'M', part: '胸腹部', kind: '造影', req: '肝腫瘤精査', dz: '肝細胞癌', slot: 64 });
    await a.click('.moredet summary');
    await a.fill('#fSite', '○○病院'); await a.fill('#fF1', '専攻 太郎'); await a.fill('#fF2', '指導 花子');
    await a.click('#btnSave');
    await a.waitForFunction(() => !document.querySelector('.demo-banner'));
    await waitSaved(a);
    const es = entriesOf('山田 太郎');
    assert.strictEqual(es.length, 1);
    const e = es[0];
    assert.deepStrictEqual([e.d, e.c, e.n, e.a, e.x, e.p, e.q, e.r, e.z, e.k, e.s, e.f1, e.f2], ['2026-04-03', 'ct', 1, 67, 'M', '胸腹部', '造影', '肝腫瘤精査', '肝細胞癌', 64, '○○病院', '専攻 太郎', '指導 花子']);
    const m = memberByName('山田 太郎');
    const sm = JSON.parse(m.docs.summary);
    assert.ok(sm && sm.n === 1 && sm.lastD === '2026-04-03', JSON.stringify(sm));
    assert.ok(Object.keys(m.docs).every(k => k === 'settings' || k === 'summary') && m.docs.summary);      // 一覧用には症例が含まれない
    await shot(a, '02-member-progress');
  });
  await step('form: age out of range is refused; count>1 saves a count-only record (no age/slot)', async () => {
    await a.fill('#fAge', '150'); await a.click('#btnSave');
    assert.ok(await a.evaluate(() => document.getElementById('fAge').validity.rangeOverflow));      // ブラウザの入力チェックで止まる
    await a.waitForTimeout(150);
    assert.strictEqual(entriesOf('山田 太郎').length, 1);
    await a.fill('#fAge', '');
    await fillCase(a, { date: '2026-04-04', cat: 'ct', n: 3, age: 50, sex: 'F' });
    assert.ok(await a.isVisible('#nHint'));
    await a.click('#btnSave'); await waitSaved(a);
    const e = entriesOf('山田 太郎').find(x => x.d === '2026-04-04');
    assert.ok(e && e.n === 3 && e.a === undefined && e.x === undefined && e.k === undefined, JSON.stringify(e));
    await a.fill('#fN', '1');
  });
  await step('form: a used slot is disabled in the select', async () => {
    assert.strictEqual(await a.locator('#fSlot option[value="64"]').evaluate(o => o.disabled), true);
    assert.strictEqual(await a.locator('#fSlot option[value="65"]').evaluate(o => o.disabled), false);
  });

  /* ---- 100枠 ---- */
  await step('dz tab: assigned chip, new case for an empty slot, pick an existing case, clear', async () => {
    await a.click('[data-view="dz"]');
    assert.strictEqual(await a.getAttribute('.dzchip[data-no="64"]', 'aria-pressed'), 'true');
    assert.match(await txt(a, '#dzSummary'), /割り当て済み\s*1\s*\/\s*100枠/);
    // 空き枠 12 に新しい症例
    await a.click('.dzchip[data-no="12"]');
    await a.click('[data-act="slotnew"]');
    assert.strictEqual(await a.inputValue('#fSlot'), '12');
    await fillCase(a, { date: '2026-04-06', age: 33, sex: 'F', part: '頭部', dz: '副鼻腔炎' });
    await a.click('#btnSave'); await waitSaved(a);
    assert.strictEqual(entriesOf('山田 太郎').find(e => e.z === '副鼻腔炎').k, 12);
    // 枠なしで1件登録 → 枠30に割り当て
    await fillCase(a, { date: '2026-04-07', age: 71, sex: 'M', part: '頭部', dz: '脳梗塞' });
    await a.click('#btnSave'); await waitSaved(a);
    assert.strictEqual(entriesOf('山田 太郎').find(e => e.z === '脳梗塞').k, undefined);
    await a.click('.dzchip[data-no="30"]');
    await a.fill('#slotQ', '脳梗塞');
    await a.click('[data-act="slotpick"]');
    await waitSaved(a);
    assert.strictEqual(entriesOf('山田 太郎').find(e => e.z === '脳梗塞').k, 30);
    assert.strictEqual(await a.getAttribute('.dzchip[data-no="30"]', 'aria-pressed'), 'true');
    assert.match(await txt(a, '#dzSummary'), /割り当て済み\s*3\s*\/\s*100枠/);
    // 外す
    await a.click('.dzchip[data-no="30"]');
    await a.click('[data-act="slotclear"]'); await waitSaved(a);
    assert.strictEqual(entriesOf('山田 太郎').find(e => e.z === '脳梗塞').k, undefined);
    assert.match(await txt(a, '#dzSummary'), /割り当て済み\s*2\s*\/\s*100枠/);
    // 絞り込み
    await a.fill('#dzQ', '肝'); assert.match(await txt(a, '#dzGroups'), /肝・胆道/); await a.fill('#dzQ', '');
    await a.check('#dzOnly'); assert.ok(await a.locator('.dzchip.slot').count() < 100); await a.uncheck('#dzOnly');
    await shot(a, '03-dz');
  });
  await step('progress dz row reflects distinct slots and links to the dz tab', async () => {
    await a.click('[data-view="progress"]');
    const row = a.locator('.row', { hasText: '経験すべき疾患・病態' });
    assert.match(await row.innerText(), /2\s*\/\s*90/);
    await row.locator('[data-act="godz"]').click();
    assert.ok(await a.isVisible('#v-dz'));
  });

  /* ---- 入学年度・受験予定・カウントダウン ---- */
  const examBase = inDays(100), examDiag = inDays(50);
  await step('cohort + exam date → days left, shortfall and weekly pace; events add/delete; persisted', async () => {
    await a.click('[data-view="progress"]');
    await a.selectOption('#v-progress select[data-act="cohort"]', '2025');
    await a.fill('#v-progress input[data-act="exam"][data-t="base"]', examBase);
    await a.waitForSelector('.cd-main');
    const cd = await txt(a, '.cd');
    assert.match(cd, /100\s*日後/); assert.match(cd, /不足/); assert.match(cd, /週\d+/);
    assert.match(await txt(a, '.row:has-text("CT")'), /あと\d+/);
    // 行ごとのペース（小さな「週N」）
    assert.ok(await a.locator('.row .rest small').count() > 3);
    // 診断専門医タブにも別の受験予定日
    await a.click('[data-act="track"][data-id="diag"]');
    assert.match(await txt(a, '.cd'), /受験予定日を入れると/);
    await a.fill('#v-progress input[data-act="exam"][data-t="diag"]', examDiag);
    await a.waitForSelector('.cd-main');
    assert.match(await txt(a, '.cd'), /50\s*日後/);
    await a.click('[data-act="track"][data-id="base"]');
    // イベント
    await a.fill('#evDate', inDays(30)); await a.fill('#evTitle', '日本医学放射線学会総会');
    await a.click('#evForm button');
    await a.waitForSelector('.evlist li');
    assert.match(await txt(a, '.evlist'), /日本医学放射線学会総会[\s\S]*あと30日/);
    await a.fill('#evDate', inDays(10)); await a.fill('#evTitle', '提出期限'); await a.click('#evForm button');
    assert.strictEqual(await a.locator('.evlist li').count(), 2);
    assert.match(await a.locator('.evlist li').first().innerText(), /提出期限/);          // 日付順
    await a.locator('.evlist li:has-text("提出期限") [data-act="evdel"]').click();
    assert.strictEqual(await a.locator('.evlist li').count(), 1);
    await waitSaved(a);
    const st = settingsOf('山田 太郎');
    assert.strictEqual(st.cohort, 2025);
    assert.deepStrictEqual(st.exams, { base: examBase, diag: examDiag });
    assert.deepStrictEqual(st.ev.map(x => x.t), ['日本医学放射線学会総会']);
    await shot(a, '04-countdown');
  });

  /* ---- 設定（施設・氏名） ---- */
  await step('settings: facility validation (9-digit code), default names; persisted', async () => {
    await a.click('[data-view="settings"]');
    await a.fill('#facName', '琉大病院'); await a.fill('#facCode', '12345');
    await a.click('#facForm button');
    await a.waitForFunction(() => document.querySelector('#facMsg').textContent.trim().length > 0);
    assert.strictEqual(settingsOf('山田 太郎').facs.length, 0);
    await a.fill('#facCode', '012345678'); await a.click('#facForm button');
    await a.waitForSelector('.faclist li');
    await a.fill('#facName', '○○病院'); await a.fill('#facCode', '987654321'); await a.click('#facForm button');
    assert.strictEqual(await a.locator('.faclist li').count(), 2);
    await a.fill('#v-settings input[data-act="me"]', '専攻 太郎'); await a.fill('#v-settings input[data-act="sv"]', '指導 花子');
    await a.locator('#v-settings input[data-act="sv"]').blur();
    await waitSaved(a);
    const st = settingsOf('山田 太郎');
    assert.deepStrictEqual(st.facs, [{ n: '琉大病院', c: '012345678' }, { n: '○○病院', c: '987654321' }]);
    assert.strictEqual(st.me, '専攻 太郎'); assert.strictEqual(st.sv, '指導 花子');
  });

  /* ---- 症例ごとの取り込み ---- */
  await step('per-case import: patient columns blocked, age/sex guessed, free-text scrubbed, no patient data in DOM/server', async () => {
    await a.click('[data-view="import"]');
    await a.setInputFiles('#fImp', path.join(OUT, 'rep-case.csv'));
    await a.waitForSelector('[data-imp="mode"]');
    assert.ok(await a.locator('[data-imp="mode"][value="case"]').isChecked());
    assert.strictEqual(await a.locator('[data-imp="role"][data-role="age"] option:checked').innerText(), '年齢');
    assert.strictEqual(await a.locator('[data-imp="role"][data-role="sex"] option:checked').innerText(), '性別');
    assert.strictEqual(await a.inputValue('[data-imp="role"][data-role="diag"]'), '-1');         // 自由記述は自動では読まない
    const dis = await a.locator('[data-imp="role"][data-role="part"] option[disabled]').allInnerTexts();
    assert.ok(dis.some(t => /患者ID/.test(t)) && dis.some(t => /生年月日/.test(t)) && dis.some(t => /患者氏名/.test(t)), dis.join('|'));
    await a.selectOption('[data-imp="role"][data-role="part"]', { label: '部位' });
    await a.selectOption('[data-imp="role"][data-role="diag"]', { label: '診断名' });
    const body = await a.locator('body').innerText();
    assert.ok(!/患者\d+次郎|PAT\d{4}|19600101/.test(body), 'patient data leaked into DOM');
    assert.ok(!/鈴木様|example\.com|ID12345678/.test(body), 'free-text identifiers not scrubbed in preview');
    assert.match(await txt(a, '#v-import'), /年齢あり\s*10\s*件／性別あり\s*10\s*件/);
    assert.match(await txt(a, '#v-import'), /取り除いた項目\s*3\s*件/);
    assert.strictEqual(await a.locator('tr:has-text("OT") select').inputValue(), '-');
    await shot(a, '05-import-case');
    await a.click('[data-act="impgo"]'); await waitSaved(a);
    assert.ok(await a.isHidden('[data-act="impgo"]'));
    const imc = entriesOf('山田 太郎').filter(e => e.id.startsWith('imc'));
    assert.strictEqual(imc.length, 10);
    assert.deepStrictEqual(Array.from(new Set(imc.map(e => e.x))).sort(), ['F', 'M']);
    assert.ok(imc.some(e => e.a === 70) && imc.some(e => e.a === 0));                                // 「3ヶ月」→0歳
    assert.ok(imc.every(e => e.n === 1 && e.d.startsWith('2026-05')));
    const blob = JSON.stringify(docsOf('山田 太郎'));
    assert.ok(!/患者\d+次郎|PAT\d{4}|鈴木様|example\.com|ID12345678|19600101/.test(blob), 'patient data stored on server');
    assert.ok(imc.some(e => /肺炎/.test(e.z || '')) && imc.some(e => /脳梗塞/.test(e.z || '')));
  });
  await step('re-import merges by id: slot assignment and counts survive; mapping is remembered', async () => {
    await a.click('[data-view="dz"]');
    await a.click('.dzchip[data-no="30"]');
    await a.fill('#slotQ', '脳梗塞');
    await a.click('[data-act="slotpick"]'); await waitSaved(a);
    const before = entriesOf('山田 太郎').find(e => /脳梗塞/.test(e.z || '') && e.id.startsWith('imc'));
    assert.strictEqual(before.k, 30);
    await a.click('[data-view="import"]');
    assert.match(await txt(a, '#v-import'), /取り込み済みの記録/);
    await a.setInputFiles('#fImp', path.join(OUT, 'rep-case.csv'));
    await a.waitForSelector('[data-act="impgo"]');
    assert.strictEqual(await a.locator('[data-imp="role"][data-role="diag"] option:checked').innerText(), '診断名');   // 前回の列が記憶されている
    assert.match(await txt(a, '#v-import'), /更新され[\s\S]*新規は\s*0\s*件/);
    await a.click('[data-act="impgo"]'); await waitSaved(a);
    const es = entriesOf('山田 太郎').filter(e => e.id.startsWith('imc'));
    assert.strictEqual(es.length, 10);
    assert.strictEqual(es.find(e => e.id === before.id).k, 30);
  });
  await step('import → manual entries in the same period are not touched; delete imports (two-step)', async () => {
    const man = entriesOf('山田 太郎').filter(e => !e.id.startsWith('imc')).length;
    await a.click('[data-view="import"]');
    await a.click('[data-act="impdelall"]');
    assert.match(await txt(a, '[data-act="impdelall"]'), /本当に/);
    await a.click('[data-act="impdelall"]'); await waitSaved(a);
    const es = entriesOf('山田 太郎');
    assert.strictEqual(es.length, man);
    assert.ok(es.every(e => !e.id.startsWith('imc')));
    assert.ok(es.some(e => e.z === '肝細胞癌' && e.k === 64));
    // 次の検査用に取り込み直す（症例ごと）
    await a.setInputFiles('#fImp', path.join(OUT, 'rep-case.csv'));
    await a.waitForSelector('[data-act="impgo"]'); await a.click('[data-act="impgo"]'); await waitSaved(a);
    assert.strictEqual(entriesOf('山田 太郎').filter(e => e.id.startsWith('imc')).length, 10);
    // 取り込んだ症例を枠30に割り当て直す（様式への出力で確認する）
    await a.click('[data-view="dz"]'); await a.click('.dzchip[data-no="30"]');
    await a.fill('#slotQ', '脳梗塞'); await a.click('[data-act="slotpick"]'); await waitSaved(a);
    assert.ok(entriesOf('山田 太郎').some(e => /脳梗塞/.test(e.z || '') && e.k === 30));
  });

  /* ---- 研修手帳への出力 ---- */
  /* ---- 様式ファイルを各自が読み込む（様式を含まない版） ---- */
  if (!EMBEDDED && HAS_TPL) await step('template file: must be chosen first; wrong files are rejected; a valid one is kept in the browser and can be removed', async () => {
    const JSZip = require('jszip');
    const T = await newPage(browser, { local: true }); const t = T.page;
    await t.waitForSelector('#appmain:not([hidden])');
    await t.click('[data-view="export"]');
    assert.match(await txt(t, '#tplFile'), /最初に、研修手帳の様式ファイルを選んでください[\s\S]*様式ファイルは含まれていません/);
    assert.ok(await t.locator('.tplfile.need').count() === 1);
    // 様式なしで出力しようとすると案内が出て、ダウンロードは起きない
    await t.click('#v-export [data-act="tpl"]');
    assert.match(await txt(t, '#toast'), /先に、研修手帳の様式ファイル/);
    assert.strictEqual(await t.evaluate(() => window.__dlNames.length), 0);
    const bad = async (file, re, label) => {
      await t.setInputFiles('#fTpl', file);
      await t.waitForFunction(src => new RegExp(src).test((document.querySelector('#tplFile .msgline.bad') || {}).textContent || ''), re.source);   // 前のエラー表示と取り違えない
      assert.match(await txt(t, '#tplFile .msgline.bad'), re, label);
      assert.ok(await t.locator('.tplfile.need').count() === 1, label + ': 状態が変わった');
    };
    // 1) Excelではないファイル
    await bad({ name: 'x.xlsx', mimeType: 'application/octet-stream', buffer: Buffer.from('hello') }, /Excel（\.xlsx）ファイルとして読み込めませんでした/, 'garbage');
    // 2) 別のExcel（シート名が違う）
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['a', 'b']]), 'Sheet1');
    await bad({ name: 'other.xlsx', mimeType: 'application/octet-stream', buffer: XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) }, /シート「.+」が見つかりません/, 'other workbook');
    // 3) 様式の疾患群名が違う（様式のバージョン違い）
    const z = await JSZip.loadAsync(fs.readFileSync(TPL));
    let ss = await z.file('xl/sharedStrings.xml').async('string'); ss = ss.split('尿路結石症').join('尿路結石'); z.file('xl/sharedStrings.xml', ss);
    await bad({ name: 'old.xlsx', mimeType: 'application/octet-stream', buffer: Buffer.from(await z.generateAsync({ type: 'uint8array' })) }, /様式の内容が想定と違います/, 'changed version');
    // 4) 正しい様式 → 受け付けて、ブラウザに保存される
    await t.setInputFiles('#fTpl', TPL);
    await t.waitForSelector('.tplfile:not(.need)');
    const nm = path.basename(TPL);
    assert.match(await txt(t, '#tplFile'), new RegExp('使用する様式: ' + nm.replace(/\./g, '\\.')));
    assert.match(await txt(t, '#tplFile'), /このブラウザに保存済み/);
    assert.ok(await t.locator('#tplFile .msgline.bad').count() === 0);
    await shot(t, '06a-template-file');
    // 5) 開き直しても残る（IndexedDB）
    await t.reload();
    await t.waitForSelector('#appmain:not([hidden])');
    await t.click('[data-view="export"]');
    await t.waitForSelector('.tplfile:not(.need)');
    assert.match(await txt(t, '#tplFile'), new RegExp(nm.replace(/\./g, '\\.')));
    // 6) 保存した様式を削除 → 開き直しても戻らない
    await t.click('[data-act="tplforget"]');
    await t.waitForSelector('.tplfile.need');
    await t.reload();
    await t.waitForSelector('#appmain:not([hidden])');
    await t.click('[data-view="export"]');
    await t.waitForSelector('.tplfile.need');
    // 7) 別のファイルに変える
    await t.setInputFiles('#fTpl', TPL); await t.waitForSelector('.tplfile:not(.need)');
    await t.setInputFiles('#fTpl', TPL); await t.waitForSelector('.tplfile:not(.need)');
    await T.ctx.close();
  });
  if (!EMBEDDED) await step('template file: this build ships no template (no embedded base64)', async () => {
    const html = fs.readFileSync(L.APP, 'utf8');
    assert.ok(!/UEsDB[A-Za-z0-9+\/]{200}/.test(html), '様式のデータ（xlsxのbase64）が含まれている');
    assert.ok(/const TPL_B64 = "";/.test(html));
  });

  await step('template export: downloads xlsx; cells filled from the entries; no patient data; formats intact', async () => {
    await a.click('[data-view="log"]');
    assert.match(await txt(a, '#logList'), /肝細胞癌/);
    await a.click('[data-view="export"]');
    assert.match(await txt(a, '#tplInfo'), /CT[\s\S]*疾患群の枠/);
    await shot(a, '06-export');
    if (!CAN_TPL) { console.log('     （様式ファイルがないため、様式への書き込みの試験は省略: TPL_XLSX を指定してください）'); return; }
    await ensureTpl(a);
    const [dl] = await Promise.all([a.waitForEvent('download'), a.click('#v-export [data-act="tpl"]')]);
    assert.match(await a.evaluate(() => window.__dlNames.slice(-1)[0]), /^研修手帳_山田_太郎_\d{4}-\d{2}-\d{2}\.xlsx$/);
    const out = path.join(OUT, 'out-e2e-a.xlsx'); await dl.saveAs(out);
    const d = dumpTpl(out);
    assert.deepStrictEqual(d.names.length, 9);
    const ct = d.sheets[ST.CT];
    // 施設名はフォームで入れた「○○病院」→ 施設コードは設定の同名施設
    const r1 = ct.find(r => r[9] === '肝細胞癌');
    assert.ok(r1, JSON.stringify(ct.slice(0, 3)));
    assert.deepStrictEqual([r1[1], r1[2], r1[3], r1[4], r1[5], r1[6], r1[7], r1[8], r1[10], r1[11]], ['○○病院', '987654321', '2026-04-03', 67, 'M', '胸腹部', '造影', '肝腫瘤精査', '専攻 太郎', '指導 花子']);
    const r1b = ct.find(r => r[9] === '副鼻腔炎');                                                     // 登録フォームの施設欄は次の症例にも残る
    assert.strictEqual(r1b[1], '○○病院');
    const r2 = ct.find(r => /肺炎/.test(r[9] || ''));                                                  // 取り込み分は施設未入力 → 設定の先頭施設・既定の氏名
    assert.ok(r2, JSON.stringify(ct.slice(0, 4)));
    assert.deepStrictEqual([r2[1], r2[2], r2[4], r2[5], r2[6], r2[10], r2[11]], ['琉大病院', '012345678', 45, 'M', '胸部', '専攻 太郎', '指導 花子']);
    assert.ok(ct.some(r => r[4] === 70) || d.sheets[ST.MRI].length > 0);
    // 疾患（A）シート: 枠64・12・30
    const A_ = d.sheets[ST.A];
    const a64 = A_.find(r => r[8] === '肝細胞癌'), a12 = A_.find(r => r[8] === '副鼻腔炎'), a30 = A_.find(r => /脳梗塞/.test(r[8] || ''));
    assert.ok(a64 && a12 && a30);
    assert.deepStrictEqual([a64[2], a64[5], a64[6], a64[7], a64[9]], [64, '2026-04-03', 67, 'M', 'CT']);
    assert.strictEqual(a12[2], 12); assert.strictEqual(a30[2], 30);
    // n=3 の件数だけの記録は症例行に展開されない（年齢なし）→ 注意として出ている
    const all = JSON.stringify(d.sheets);
    assert.ok(!/患者\d+次郎|PAT\d{4}|鈴木様|example\.com|ID12345678|19600101/.test(all), 'patient data in the template output');
    Object.keys(d.meta).forEach(k => assert.ok(d.meta[k].dv >= 1, 'validation lost in ' + k));
    assert.ok(d.meta[ST.A].merged >= 20);
  });
  await step('template export: the plain Excel/CSV exports still work and carry the new columns', async () => {
    const [d1] = await Promise.all([a.waitForEvent('download'), a.click('#v-export [data-act="xlsx"]')]);
    const w = XLSX.readFile(await d1.path());
    assert.deepStrictEqual(w.SheetNames, ['集計', '症例一覧']);
    const ls = XLSX.utils.sheet_to_json(w.Sheets['症例一覧'], { header: 1 });
    assert.ok(ls[0].includes('年齢') && ls[0].includes('性別') && ls[0].includes('疾患群の枠'), ls[0].join(','));
    const sm = XLSX.utils.sheet_to_json(w.Sheets['集計'], { header: 1 }).flat().join('|');
    assert.match(sm, /入学年度\|2025年度/); assert.match(sm, /受験予定日/);
    const [d2] = await Promise.all([a.waitForEvent('download'), a.click('#v-export [data-act="csv"]')]);
    const csv = fs.readFileSync(await d2.path(), 'utf8');
    assert.ok(csv.startsWith('﻿') && /肝細胞癌/.test(csv) && !/PAT\d{4}/.test(csv));
  });
  await step('backup JSON roundtrip keeps the new fields (age/sex/slot/cohort/facilities)', async () => {
    const [d3] = await Promise.all([a.waitForEvent('download'), a.click('#v-export [data-act="json"]')]);
    const j = JSON.parse(fs.readFileSync(await d3.path(), 'utf8'));
    const es = Object.values(j.months).flatMap(m => Object.values(m));
    assert.ok(es.some(e => e.a === 67 && e.x === 'M' && e.k === 64));
    assert.strictEqual(j.settings.cohort, 2025); assert.strictEqual(j.settings.facs.length, 2);
  });

  /* ---- ログイン周り ---- */
  await step('settings: change passcode', async () => {
    await a.click('[data-view="settings"]');
    await a.fill('#pwOld', 'wrong'); await a.fill('#pwNew', 'newsecret1'); await a.click('#pwForm button');
    await a.waitForFunction(() => /違います/.test(document.querySelector('#pwMsg').textContent));
    await a.fill('#pwOld', 'secret1'); await a.click('#pwForm button');
    await a.waitForFunction(() => /変更しました/.test(document.querySelector('#pwMsg').textContent));
  });
  await step('reload restores session and all data; logout; old passcode rejected', async () => {
    await a.reload(); await a.waitForSelector('#appmain:not([hidden])');
    assert.match(await txt(a, '#who'), /山田 太郎/);
    await waitSaved(a);
    await a.click('[data-view="settings"]');
    assert.strictEqual(await a.inputValue('#v-settings input[data-act="me"]'), '専攻 太郎');
    await a.click('[data-view="progress"]');
    assert.match(await txt(a, '.cd'), /100\s*日後/);
    await a.click('[data-view="dz"]');
    assert.strictEqual(await a.getAttribute('.dzchip[data-no="64"]', 'aria-pressed'), 'true');
    await a.click('[data-act="logout"]');
    await a.waitForSelector('#auth:not([hidden])');
    await login(a, '山田 太郎', 'secret1');
    await a.waitForFunction(() => /違います/.test(document.querySelector('#authErr').textContent));
    await a.fill('#inPass', 'newsecret1'); await a.click('#authGo');
    await a.waitForSelector('#appmain:not([hidden])');
  });

  /* ================= メンバー佐藤（別ブラウザ・件数だけの取り込み） ================= */
  const B = await newPage(browser); const b = B.page;
  await step('second member registers, enters a case, and is isolated from the first', async () => {
    await b.click('[data-atab="register"]');
    await b.fill('#inName', '佐藤 花子'); await b.fill('#inPass', 'hanako-pass'); await b.fill('#inPass2', 'hanako-pass'); await b.fill('#inJoin', 'join123');
    await b.click('#authGo'); await b.waitForSelector('#appmain:not([hidden])');
    await fillCase(b, { date: '2026-05-10', cat: 'mri', age: 30, sex: 'F', part: '頭部', dz: '脳腫瘍' });
    await b.click('#btnSave'); await waitSaved(b);
    await b.click('[data-view="log"]');
    const t = await txt(b, '#logList');
    assert.ok(/MRI/.test(t) && /脳腫瘍/.test(t) && !/肝細胞癌/.test(t));
    await b.click('[data-view="settings"]');
    await b.selectOption('#v-settings select[data-act="cohort"]', '2026'); await waitSaved(b);
  });
  await step('count-mode import (Shift-JIS): patient columns blocked, nothing leaks, idempotent', async () => {
    await b.click('[data-view="import"]');
    await b.setInputFiles('#fImp', path.join(OUT, 'rep-sjis.csv'));
    await b.waitForSelector('[data-imp="date"]');
    assert.strictEqual(await b.locator('[data-imp="date"] option:checked').innerText(), '検査日');
    assert.strictEqual(await b.locator('[data-imp="cat"] option:checked').innerText(), 'モダリティ');
    await b.check('[data-imp="mode"][value="count"]');
    const optDis = await b.locator('[data-imp="date"] option[disabled]').allInnerTexts();
    assert.ok(optDis.some(t => /患者ID/.test(t)) && optDis.some(t => /生年月日/.test(t)), optDis.join('|'));
    const body = await b.locator('body').innerText();
    assert.ok(!/患者\d+太郎|PAT\d{4}|不明さん|19700101/.test(body), 'patient data leaked into DOM');
    assert.ok(!/患者\d+太郎|PAT\d{4}|不明さん/.test(await b.content()), 'patient data leaked into HTML');
    const mapTxt = await txt(b, '#v-import');
    assert.match(mapTxt, /CT[\s\S]*MR[\s\S]*US/);
    assert.strictEqual(await b.locator('tr:has-text("PT") select').inputValue(), 'rn');
    assert.strictEqual(await b.locator('tr:has-text("OT") select').inputValue(), '-');
    assert.match(mapTxt, /日付を読めない\s*1/);
    await b.click('[data-act="impgo"]'); await waitSaved(b);
    const total = () => entriesOf('佐藤 花子').filter(e => e.id.startsWith('imp')).reduce((s, e) => s + e.n, 0);
    const t1 = total();
    assert.strictEqual(t1, 40 - 5);
    assert.ok(!JSON.stringify(docsOf('佐藤 花子')).match(/患者\d+太郎|PAT\d{4}/));
    await b.click('[data-view="import"]');
    await b.setInputFiles('#fImp', path.join(OUT, 'rep-utf8.csv'));
    await b.waitForSelector('[data-act="impgo"]');
    assert.ok(await b.locator('[data-imp="mode"][value="count"]').isChecked());                      // 前回のモードを記憶
    assert.match(await txt(b, '#v-import'), /置き換わります/);
    await b.click('[data-act="impgo"]'); await waitSaved(b);
    assert.strictEqual(total(), t1);
  });
  await step('count-mode import (xlsx, header on row 3, real date cells, 2-column key for RT)', async () => {
    await b.click('[data-view="import"]');
    await b.setInputFiles('#fImp', path.join(OUT, 'rep.xlsx'));
    await b.waitForSelector('[data-imp="hdr"]');
    assert.strictEqual(await b.locator('[data-imp="hdr"]').inputValue(), '2');
    await b.check('[data-imp="mode"][value="count"]');
    await b.selectOption('[data-imp="cat2"]', { label: '部位' });
    await b.waitForSelector('tr:has-text("RT / 乳房")');
    await b.selectOption('tr:has-text("RT / 乳房") select', 'rt_chest');
    assert.match(await txt(b, '#v-import'), /治療 胸部・乳腺[\s\S]*?4/);
    assert.ok(/2026-05-01/.test(await txt(b, '#v-import')));
    await b.click('[data-act="impcancel"]');
  });

  /* ================= 管理者 ================= */
  const C = await newPage(browser); const c = C.page;
  await step('admin overview: cohort/exam/pace columns; cohort filter; sort; search', async () => {
    await c.click('[data-atab="admin"]');
    assert.ok(await c.isHidden('#aName'));
    await c.fill('#inPass', 'wrong'); await c.click('#authGo');
    await c.waitForFunction(() => /違います/.test(document.querySelector('#authErr').textContent));
    await c.fill('#inPass', 'adminpass1'); await c.click('#authGo');
    await c.waitForSelector('#v-a-overview:not([hidden])');
    await c.waitForSelector('.atable');
    assert.ok(await c.isHidden('#entry'));
    const t = await txt(c, '#aTable');
    assert.ok(/山田 太郎/.test(t) && /佐藤 花子/.test(t));
    assert.match(await txt(c, '#aInfo'), /表示 2 人/);
    const yr = c.locator('.atable tbody tr:has-text("山田 太郎")');
    const ytxt = await yr.innerText();
    assert.match(ytxt, /2025年度/);
    assert.match(ytxt, new RegExp(examDiag));                    // 受験予定の早い方（診断専門医）が「次の予定」
    assert.match(ytxt, /あと50日/); assert.match(ytxt, /診断専門医/); assert.match(ytxt, /週\d+/);
    assert.match(await c.locator('.atable tbody tr:has-text("佐藤 花子")').innerText(), /2026年度[\s\S]*未設定/);
    // 入学年度で絞り込み（毎年使い回し）
    const opts = await c.locator('#aCohort option').allInnerTexts();
    assert.ok(opts.some(o => /2025年度入学（1人）/.test(o)) && opts.some(o => /2026年度入学（1人）/.test(o)), opts.join('|'));
    await c.selectOption('#aCohort', '2025');
    assert.strictEqual(await c.locator('.atable tbody tr').count(), 1);
    assert.match(await txt(c, '#aInfo'), /表示 1 人/);
    await c.selectOption('#aCohort', 'all');
    assert.strictEqual(await c.locator('.atable tbody tr').count(), 2);
    await c.click('[data-act="asort"][data-k="total"]');
    assert.ok((await c.locator('.atable tbody tr').first().innerText()).includes('佐藤'));       // 件数の多い順（佐藤は件数だけの取り込みで35件以上）
    await c.click('[data-act="asort"][data-k="next"]');
    await c.fill('#aq', '佐藤'); assert.strictEqual(await c.locator('.atable tbody tr').count(), 1); await c.fill('#aq', '');
    await shot(c, '07-admin-overview');
  });
  await step('admin overview loads only settings+summary (no case docs) until a member is opened', async () => {
    const all = env.call('api_adminAll', admTok());
    all.members.forEach(m => assert.ok(Object.keys(m.docs).every(k => k === 'settings' || k === 'summary')));
    assert.ok(JSON.parse(all.members.find(m => m.name === '山田 太郎').docs.summary).n >= 12);
  });
  await step('drill-down: read-only member view loaded on demand; template/xlsx export for that member', async () => {
    await c.click('.nm:has-text("山田 太郎")');
    await c.waitForSelector('#drill:not([hidden])');
    await c.waitForFunction(() => /山田 太郎 さんの記録（閲覧のみ）/.test(document.querySelector('#drill').textContent));
    assert.ok(await c.isHidden('#entry'));
    assert.ok(await c.locator('[data-act="plus"]').count() === 0);
    assert.match(await txt(c, '#v-progress'), /100\s*日後/);
    await c.click('[data-view="log"]');
    assert.ok(await c.locator('[data-act="edit"]').count() === 0 && await c.locator('[data-act="del"]').count() === 0);
    assert.match(await txt(c, '#logList'), /肝細胞癌/);
    await c.click('[data-view="dz"]');
    await c.click('.dzchip[data-no="64"]');
    assert.match(await txt(c, '#dzGroups'), /肝細胞癌/);
    assert.ok(await c.locator('[data-act="slotclear"], [data-act="slotnew"], [data-act="slotpick"]').count() === 0);
    await c.click('.dzchip[data-no="65"]');
    assert.match(await txt(c, '#dzGroups'), /まだ症例が割り当てられていません/);
    if (CAN_TPL) {
      await ensureTpl(c);
      const [dl] = await Promise.all([c.waitForEvent('download'), c.click('#drill [data-act="tpl"]')]);
      assert.match(await c.evaluate(() => window.__dlNames.slice(-1)[0]), /^研修手帳_山田_太郎_\d{4}-\d{2}-\d{2}\.xlsx$/);
      const out = path.join(OUT, 'out-e2e-admin.xlsx'); await dl.saveAs(out);
      const d = dumpTpl(out);
      assert.ok(d.sheets[ST.CT].some(r => r[9] === '肝細胞癌' && r[2] === '987654321'));
    }
    const [dl2] = await Promise.all([c.waitForEvent('download'), c.click('#drill [data-act="xlsx"]')]);
    assert.match(await c.evaluate(() => window.__dlNames.slice(-1)[0]), /^症例カウンター_山田_太郎_\d{4}-\d{2}-\d{2}\.xlsx$/);
    assert.deepStrictEqual(XLSX.readFile(await dl2.path()).SheetNames, ['集計', '症例一覧']);
    await shot(c, '08-admin-drill');
    await c.click('[data-act="closeMember"]');
    await c.waitForSelector('.atable');
    assert.ok(await c.isHidden('#drill'));
  });
  await step('admin cannot modify member data while drilling (state restored after leaving)', async () => {
    const before = JSON.stringify(['山田 太郎', '佐藤 花子'].map(n => [n, docsOf(n)]));
    await c.click('.nm:has-text("佐藤 花子")');
    await c.waitForSelector('#drill:not([hidden])');
    await c.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await c.click('[data-act="closeMember"]');
    await c.waitForTimeout(200);
    assert.strictEqual(JSON.stringify(['山田 太郎', '佐藤 花子'].map(n => [n, docsOf(n)])), before);
  });
  await step('all-members export respects the cohort filter: xlsx (summary+cases), csv, sheet write', async () => {
    await c.click('[data-view="a-export"]');
    const [d1] = await Promise.all([c.waitForEvent('download'), c.click('[data-act="axlsx"]')]);
    const w = XLSX.readFile(await d1.path());
    assert.deepStrictEqual(w.SheetNames, ['全員サマリ', '全員症例一覧']);
    const sm = XLSX.utils.sheet_to_json(w.Sheets['全員サマリ'], { header: 1 });
    assert.strictEqual(sm.length, 3);
    assert.ok(sm[0].includes('入学年度') && sm[0].includes('次の受験予定') && sm[0].includes('CT'), sm[0].join(','));
    const yr = sm.find(r => r[0] === '山田 太郎');
    assert.strictEqual(yr[1], 2025); assert.match(String(yr[2]), new RegExp(examDiag)); assert.strictEqual(yr[3], 50);
    const ls = XLSX.utils.sheet_to_json(w.Sheets['全員症例一覧'], { header: 1 });
    assert.ok(ls[0].slice(0, 4).join(',') === '氏名,入学年度,検査日・経験日,区分', ls[0].join(','));
    assert.ok(ls.some(r => r[0] === '山田 太郎' && r.includes('肝細胞癌') && r.includes(67)));
    assert.ok(ls.some(r => r[0] === '佐藤 花子' && r.includes('脳腫瘍')));
    const [d2] = await Promise.all([c.waitForEvent('download'), c.click('[data-act="acsv"]')]);
    const csv = fs.readFileSync(await d2.path(), 'utf8');
    assert.ok(csv.startsWith('﻿氏名,入学年度,検査日・経験日,区分') && /佐藤 花子,2026,2026-05-10,MRI/.test(csv));
    assert.ok(!/PAT\d{4}|患者\d+/.test(csv));
    // 入学年度で絞ると、その年度の人だけが出る
    await c.click('[data-view="a-overview"]');
    await c.selectOption('#aCohort', '2025');
    await c.click('[data-view="a-export"]');
    const [d3] = await Promise.all([c.waitForEvent('download'), c.click('[data-act="axlsx"]')]);
    const w3 = XLSX.readFile(await d3.path());
    assert.strictEqual(XLSX.utils.sheet_to_json(w3.Sheets['全員サマリ'], { header: 1 }).length, 2);
    await c.click('[data-view="a-overview"]'); await c.selectOption('#aCohort', 'all');
    await c.click('[data-view="a-export"]');
    await c.click('[data-act="asheet"]');
    await c.waitForSelector('#v-a-export a[href*="#gid="]');
    assert.strictEqual(await c.locator('#v-a-export a[href*="#gid="]').count(), 2);
  });
  await step('a member who changes their cohort/exam shows up in the admin view after reload', async () => {
    await b.click('[data-view="progress"]');
    await b.click('[data-act="track"][data-id="rt"]');
    await b.fill('#v-progress input[data-act="exam"][data-t="rt"]', inDays(20)); await waitSaved(b);
    await c.click('[data-view="a-overview"]');
    await c.click('[data-act="areload"]');
    await c.waitForFunction(() => /あと20日/.test(document.querySelector('#aTable').textContent));
    assert.match(await c.locator('.atable tbody tr:has-text("佐藤 花子")').innerText(), /治療専門医/);
  });
  await step('member management: rename, duplicate, passcode reset (+ login), delete (two-step UI)', async () => {
    await c.click('[data-view="a-members"]');
    await c.waitForSelector('.mrow');
    await c.click('.mrow:has-text("佐藤 花子") [data-act="mgr"][data-mode="rename"]');
    await c.fill('#mgrIn', '山田 太郎'); await c.click('[data-act="mgrgo"]');
    await c.waitForFunction(() => /すでに登録/.test(document.querySelector('#v-a-members').textContent));
    await c.fill('#mgrIn', '佐藤 はな子'); await c.click('[data-act="mgrgo"]');
    await c.waitForFunction(() => /佐藤 はな子 に変更|「佐藤 はな子」に変更/.test(document.querySelector('#v-a-members').textContent));
    await c.click('.mrow:has-text("佐藤 はな子") [data-act="mgr"][data-mode="pass"]');
    await c.fill('#mgrIn', '123'); await c.click('[data-act="mgrgo"]');
    assert.match(await txt(c, '#v-a-members'), /6文字以上/);
    await c.fill('#mgrIn', 'temp-pass-77'); await c.click('[data-act="mgrgo"]');
    await c.waitForFunction(() => /再設定しました/.test(document.querySelector('#v-a-members').textContent));
    assert.ok(env.call('api_login', '佐藤 はな子', 'temp-pass-77').token);
  });
  await step('delete a member: removes data (incl. summary); their session is invalidated; list updates', async () => {
    const n0 = env.call('api_adminAll', admTok()).members.length;
    await c.click('.mrow:has-text("佐藤 はな子") [data-act="mgr"][data-mode="del"]');
    await c.click('[data-act="mgrgo"]');
    await c.waitForFunction(() => /削除しました/.test(document.querySelector('#v-a-members').textContent));
    assert.strictEqual(env.call('api_adminAll', admTok()).members.length, n0 - 1);
    await b.click('[data-view="log"]');
    await b.fill('#fDate', '2026-05-11'); await b.click('[data-view="progress"]'); await b.click('.chip[data-cat="us"]'); await b.click('#btnSave');
    await b.waitForSelector('#auth:not([hidden])', { timeout: 5000 });
    assert.match(await txt(b, '#authErr'), /有効期限/);
  });

  /* ---- 兼任（メンバー＋管理者） ---- */
  await step('member can upgrade to admin with admin passcode and switch views', async () => {
    await a.reload(); await a.waitForSelector('#appmain:not([hidden])');
    await a.click('[data-act="askAdmin"]');
    await a.fill('#upgPass', 'nope'); await a.click('#upgForm .primary');
    await a.waitForFunction(() => /違います/.test(document.querySelector('#upgErr').textContent));
    await a.fill('#upgPass', 'adminpass1'); await a.click('#upgForm .primary');
    await a.waitForSelector('#v-a-overview:not([hidden])');
    await a.waitForSelector('.atable');
    assert.match(await txt(a, '#who'), /管理者/);
    await a.click('[data-act="goMember"]');
    await a.waitForSelector('#entry:not([hidden])');
    assert.match(await txt(a, '#v-progress'), /100\s*日後/);
  });

  /* ---- ローカル（サーバーなし） ---- */
  await step('local mode (no server): per-case entry, slot, template export, localStorage', async () => {
    const Lc = await newPage(browser, { local: true }); const l = Lc.page;
    await l.waitForSelector('#appmain:not([hidden])');
    assert.ok(await l.isHidden('#who'));
    await fillCase(l, { date: '2026-06-01', cat: 'ct', age: 40, sex: 'M', dz: '肺癌', slot: 50 });
    await l.click('#btnSave');
    await l.waitForFunction(() => !document.querySelector('.demo-banner'));
    assert.ok(await l.evaluate(() => /2026-06/.test(localStorage.getItem('senmoni-case-counter.v1') || '')));
    await l.click('[data-view="export"]');
    if (CAN_TPL) {
      await ensureTpl(l);
      const [dl] = await Promise.all([l.waitForEvent('download'), l.click('#v-export [data-act="tpl"]')]);
      const out = path.join(OUT, 'out-e2e-local.xlsx'); await dl.saveAs(out);
      const d = dumpTpl(out);
      assert.ok(d.sheets[ST.A].some(r => r[2] === 50 && r[8] === '肺癌' && r[6] === 40));
    }
    await l.click('[data-view="settings"]');
    assert.ok(await l.locator('#pwForm').count() === 0);
    await Lc.ctx.close();
  });

  /* ---- 見た目（狭い画面） ---- */
  await step('mobile width: no horizontal overflow on auth, member (progress/dz/import/export/settings) and admin', async () => {
    const M = await newPage(browser, { w: 390, h: 800 }); const m = M.page;
    const ov = () => m.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(await ov() <= 1, 'auth overflow ' + await ov());
    await shot(m, '09-mobile-auth');
    await login(m, '山田 太郎', 'newsecret1');
    await m.waitForSelector('#appmain:not([hidden])'); await waitSaved(m);
    for (const v of ['progress', 'dz', 'log', 'import', 'export', 'settings']) {
      await m.click(`[data-view="${v}"]`); await m.waitForTimeout(100);
      assert.ok(await ov() <= 1, v + ' overflow ' + await ov());
    }
    await m.click('[data-view="dz"]'); await m.click('.dzchip[data-no="65"]');
    assert.ok(await ov() <= 1, 'slot editor overflow ' + await ov());
    await shot(m, '10-mobile-dz');
    await m.click('[data-view="progress"]'); await shot(m, '11-mobile-progress');
    await m.click('[data-act="logout"]');
    await m.waitForSelector('#auth:not([hidden])');
    await m.click('[data-atab="admin"]'); await m.fill('#inPass', 'adminpass1'); await m.click('#authGo');
    await m.waitForSelector('.atable');
    const pageOv = await ov();
    assert.ok(pageOv <= 1, 'admin page overflow ' + pageOv);
    await shot(m, '12-mobile-admin');
    await M.ctx.close();
  });

  console.log('\n' + L.getN() + ' steps passed; page errors:', errs.length ? errs : 'none');
  if (errs.length) process.exitCode = 1;
  await browser.close();
})().catch(e => { console.error('E2E crashed', e); process.exit(2); });
