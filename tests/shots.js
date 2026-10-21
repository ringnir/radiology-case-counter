// README・使い方ガイド用の画面キャプチャを、架空のデモデータで作り直す。
//   npm run shots
// 学会・機構の様式ファイルが手元にあるときだけ、様式を読み込んだ状態の画面も撮る（環境変数 TPL_XLSX / TPL_DIAG / TPL_RT）。
// 撮った画像には、様式ファイルの中身は写りません（ファイル名と件数のみ）。患者情報・実在の人名は使いません。
const fs = require('fs'), path = require('path');
const L = require('./e2e-lib.js');
const { chromium } = require('playwright-core');
const { env, newPage, TPL, HAS_TPL, TPL_DIAG, TPL_RT, HAS_DIAG, HAS_RT } = L;
const IMG = path.join(__dirname, '..', 'docs', 'images'); fs.mkdirSync(IMG, { recursive: true });
const TMP = path.join(__dirname, 'out'); fs.mkdirSync(TMP, { recursive: true });

/* ---------- デモデータ（再現できるよう、疑似乱数は固定） ---------- */
function rng(seed) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
const pad = n => String(n).padStart(2, '0');
const ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const today = new Date(); today.setHours(12, 0, 0, 0);
const plus = n => { const d = new Date(today); d.setDate(d.getDate() + n); return ymd(d); };
const TPLS = new Function(fs.readFileSync(path.join(__dirname, '..', 'src', 'template.js'), 'utf8') + '\nreturn {slots: TPL_SLOTS};')().slots;   // [番号, 行, 領域index, 疾患群, ...]
const PARTS = { ct: ['胸腹部', '頭部', '胸部', '腹部骨盤'], mri: ['頭部', '腰椎', '骨盤', '膝'], xray: ['胸部', '腹部', '膝'], us: ['腹部', '甲状腺', '乳腺'], gi: ['上部消化管', '注腸'], rn: ['骨', '脳血流', '心筋'] };
const DX = { 'ct:胸腹部': ['肺癌', '肝細胞癌', '大腸癌'], 'ct:頭部': ['脳梗塞', '慢性硬膜下血腫'], 'ct:胸部': ['肺炎', '肺癌'], 'ct:腹部骨盤': ['急性虫垂炎', '尿管結石', '膵嚢胞'],
  'mri:頭部': ['脳梗塞', '髄膜腫'], 'mri:腰椎': ['椎間板ヘルニア', '脊柱管狭窄症'], 'mri:骨盤': ['子宮筋腫', '前立腺癌'], 'mri:膝': ['半月板損傷'],
  'xray:胸部': ['肺炎', '気胸'], 'xray:腹部': ['腸閉塞'], 'xray:膝': ['変形性膝関節症'], 'us:腹部': ['胆嚢結石', '脂肪肝'], 'us:甲状腺': ['甲状腺腫瘍'], 'us:乳腺': ['乳腺嚢胞'],
  'gi:上部消化管': ['胃潰瘍'], 'gi:注腸': ['大腸ポリープ'], 'rn:骨': ['骨転移'], 'rn:脳血流': ['認知症'], 'rn:心筋': ['虚血性心疾患'],
  ivr_v: ['肝細胞癌'], ivr_n: ['胆管炎'], '骨盤部': ['前立腺癌'], '頭頸部': ['咽頭癌'], '胸部': ['肺癌', '食道癌'], '腹部': ['膵癌'] };
// scale: 進み具合（1 = 目標の3〜4割ほど）。すべて1件ずつの症例（年齢・性別・診断名つき）で作る
function demo(scale, seed, start) {
  const r = rng(seed), months = {}, put = (e) => { const mk = 'm-' + e.d.slice(0, 7); (months[mk] = months[mk] || {})['d' + seed + '-' + Object.keys(months[mk]).length + '-' + Math.floor(r() * 1e6)] = e; };
  const base = { xray: 120, gi: 22, us: 45, ct: 190, mri: 110, rn: 16, ivr_v: 10, ivr_n: 8, rt_head: 8, rt_chest: 9, rt_abd: 14, rt_msk: 4 };
  const first = new Date(start); first.setHours(12, 0, 0, 0);
  const span = Math.max(30, Math.floor((today - first) / 86400000) - 1);
  const list = [];
  Object.keys(base).forEach(c => {
    const n = Math.round(base[c] * scale);
    for (let i = 0; i < n; i++) {
      const d = new Date(first); d.setDate(d.getDate() + Math.floor(r() * span));
      const e = { d: ymd(d), c, n: 1, a: 25 + Math.floor(r() * 60), x: r() < 0.5 ? 'M' : 'F', s: '○○大学病院', f1: '専攻 太郎', f2: '指導 花子' };
      const p = PARTS[c]; if (p) { e.p = p[Math.floor(r() * p.length)]; if (c === 'ct' || c === 'mri') { e.q = r() < 0.6 ? '造影' : '単純'; e.r = '精査'; } const dl = DX[c + ':' + e.p] || ['精査']; e.z = dl[Math.floor(r() * dl.length)]; }
      if (c.indexOf('ivr') === 0) { e.z = DX[c][0]; e.h = c === 'ivr_v' ? 'TACE' : 'ドレナージ'; e.ro = r() < 0.5 ? '術' : '助'; }
      if (c.indexOf('rt_') === 0) {
        const t = ['imrt', '', 'srt', 'brachy', '', ''][i % 6];
        if (t) e.t = t;
        e.u = ['泌尿器科', '耳鼻咽喉科', '呼吸器内科', '消化器内科'][i % 4]; e.pu = ['根治', '根治', '姑息・緩和', '準根治'][i % 4]; e.ds = [2, 1.8, 3, 2][i % 4]; e.fx = [30, 25, 10, 33][i % 4];
        e.mt = t === 'imrt' ? 'IMRT' : t === 'srt' ? '体幹部定位放射線照射' : t === 'brachy' ? '密封小線源治療' : '3DCRT'; e.p = ['骨盤部', '頭頸部', '胸部', '腹部'][i % 4]; e.z = DX[e.p][i % DX[e.p].length];
        const dd = new Date(e.d + 'T12:00:00'); dd.setMonth(dd.getMonth() + 1); e.d2 = ymd(dd).slice(0, 7);
        if (t === 'brachy') { e.nu = '192-Ir'; e.ro = '助'; }
      }
      list.push(e);
    }
  });
  const slots = []; for (let i = 1; i <= 100; i++) slots.push(i);
  for (let i = slots.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [slots[i], slots[j]] = [slots[j], slots[i]]; }
  const cand = list.filter(e => e.c.indexOf('rt_') !== 0 && e.c.indexOf('ivr') !== 0);
  const nSlot = Math.round(58 * Math.min(1.1, scale));
  for (let i = 0; i < Math.min(nSlot, cand.length); i++) { const e = cand[Math.floor(i * cand.length / nSlot)]; e.k = slots[i]; e.z = TPLS.find(x => x[0] === e.k)[3]; }
  list.forEach(put);
  return months;
}
function settingsFor(o) {
  return Object.assign({ cohort: 2024, exams: { base: plus(120), diag: plus(300) }, ev: [{ d: plus(35), t: '学会発表（○○学会）' }],
    facs: [{ n: '○○大学病院', c: '123456789', k: '総-01' }, { n: '△△総合病院', c: '234567890', k: '総-07' }], me: '専攻 太郎', sv: '指導 花子' }, o || {});
}
const backup = (months, settings) => ({ app: 'senmoni-case-counter', v: 1, months, settings });
const LS_KEY = 'senmoni-case-counter.v1';

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--no-sandbox'] });
  const out = name => path.join(IMG, name + '.png');
  const clip = async (page, sel, name, pad_, maxH) => {
    const b = await page.locator(sel).boundingBox(); const p = pad_ == null ? 8 : pad_;
    await page.screenshot({ path: out(name), fullPage: true, clip: { x: Math.max(0, b.x - p), y: Math.max(0, b.y - p), width: b.width + p * 2, height: Math.min(b.height, maxH || 1e5) + p * 2 } });
  };
  const local = async (opts) => {
    const T = await newPage(browser, Object.assign({ local: true }, opts || {})); const page = T.page;
    await page.evaluate(([k, v]) => localStorage.setItem(k, v), [LS_KEY, JSON.stringify({ v: 1, months: demo(1, 7, '2024-04-08'), settings: settingsFor() })]);
    await page.reload(); await page.waitForSelector('#appmain:not([hidden])');
    await page.waitForTimeout(300);
    return T;
  };
  const shotsDone = [];
  const done = n => { shotsDone.push(n); console.log('ok  ', n); };

  /* ===== 個人で使う版（デスクトップ） ===== */
  {
    const T = await local(); const p = T.page;
    await p.screenshot({ path: out('app-progress'), fullPage: false }); done('app-progress');
    await p.click('[data-act="track"][data-id="diag"]');
    await p.waitForTimeout(200);
    await p.screenshot({ path: out('app-progress-diag') }); done('app-progress-diag');
    await p.click('[data-act="track"][data-id="base"]');
    await p.click('[data-view="dz"]'); await p.waitForTimeout(150);
    await p.locator('.dzchip').nth(11).click(); await p.waitForTimeout(150);
    await p.screenshot({ path: out('app-dz'), fullPage: false }); done('app-dz');
    await p.click('[data-view="log"]'); await p.waitForTimeout(150);
    await p.screenshot({ path: out('app-log') }); done('app-log');
    await p.click('[data-view="import"]'); await p.waitForTimeout(150);
    await p.screenshot({ path: out('app-import') }); done('app-import');
    await p.click('[data-view="settings"]'); await p.waitForTimeout(150);
    await clip(p, '#v-settings', 'app-settings', 8, 1000); done('app-settings');
    await p.click('[data-view="export"]'); await p.waitForTimeout(150);
    await clip(p, '#v-export', 'app-export-empty', 8, 430); done('app-export-empty');
    if (HAS_TPL && HAS_DIAG && HAS_RT) {
      const up = (file, name) => p.setInputFiles('#fTpl', { name, mimeType: 'application/octet-stream', buffer: fs.readFileSync(file) });
      await up(TPL, '様式_放射線科専門医（基本領域）.xlsx'); await p.waitForTimeout(400);
      await up(TPL_DIAG, '専攻医研修手帳_診断.xlsx'); await p.waitForTimeout(400);
      await up(TPL_RT, '専攻医研修手帳_治療.xlsx'); await p.waitForTimeout(500);
      await p.evaluate(() => { window.scrollTo(0, 0); const t = document.getElementById('toast'); if (t) t.style.display = 'none'; });
      await clip(p, '#v-export', 'app-export', 8, 980); done('app-export'); await clip(p, '#v-export', 'app-export-full'); done('app-export');
    } else console.log('     （様式ファイルがないため、様式を読み込んだ画面は撮りません。既存の画像はそのままです）');
    // 登録フォーム（画像診断）
    await p.click('[data-view="progress"]');
    await p.click('.chip[data-cat="ct"]'); await p.fill('#fAge', '67'); await p.selectOption('#fSex', 'M'); await p.fill('#fPart', '胸腹部'); await p.fill('#fKind', '造影'); await p.fill('#fReq', '肝腫瘤精査'); await p.fill('#fDz', '肝細胞癌');
    await clip(p, '#entry', 'app-entry-ct'); done('app-entry-ct');
    // 登録フォーム（放射線治療・詳細つき）
    await p.click('.chip[data-cat="rt_abd"]'); await p.selectOption('#fTech', 'imrt');
    await p.evaluate(() => { document.getElementById('rtDet').open = true; });
    await p.fill('#fAge', '72'); await p.fill('#fDz', '前立腺癌'); await p.fill('#fU', '泌尿器科'); await p.fill('#fRtSite', '骨盤部'); await p.selectOption('#fPu', '根治');
    await p.fill('#fDs', '2'); await p.fill('#fFx', '30'); await p.fill('#fD2', ymd(today).slice(0, 7)); await p.fill('#fAe', '軽度の排尿障害');
    await clip(p, '#entry', 'app-entry-rt'); done('app-entry-rt');
    await T.ctx.close();
  }

  /* ===== 個人で使う版（スマートフォン） ===== */
  {
    const T = await local({ w: 390, h: 780 }); const p = T.page;
    await p.screenshot({ path: out('app-mobile-form') }); done('app-mobile-form');
    const toNav = () => p.evaluate(() => { const r = document.getElementById('nav').getBoundingClientRect(); window.scrollTo(0, window.scrollY + r.top - 12); });
    await toNav(); await p.waitForTimeout(150);
    await p.screenshot({ path: out('app-mobile-progress') }); done('app-mobile-progress');
    await p.click('[data-view="export"]'); await p.waitForTimeout(150); await toNav(); await p.waitForTimeout(150);
    await p.screenshot({ path: out('app-mobile-export') }); done('app-mobile-export');
    await T.ctx.close();
  }

  /* ===== 複数人で使う版（ログイン・管理者）。デモ用の名前で、メンバーを数人つくる ===== */
  {
    const names = [['デモ 太郎', 1.05, 2023, 11], ['デモ 花子', 0.8, 2024, 12], ['デモ 次郎', 0.55, 2024, 13], ['デモ 美咲', 0.35, 2025, 14], ['デモ 健', 0.95, 2023, 15], ['デモ 葵', 0.2, 2025, 16]];
    const A = await newPage(browser, { w: 1000, h: 760 });
    await A.page.waitForSelector('#auth:not([hidden])');
    await A.page.screenshot({ path: out('gas-login') }); done('gas-login');
    await A.page.click('[data-atab="register"]'); await A.page.waitForTimeout(100);
    await A.page.screenshot({ path: out('gas-register') }); done('gas-register');
    await A.ctx.close();
    for (const [nm, sc, co, seed] of names) {
      const M = await newPage(browser, { w: 1100, h: 800 }); const m = M.page;
      await m.click('[data-atab="register"]');
      await m.fill('#inName', nm); await m.fill('#inPass', 'demo-pass-1'); await m.fill('#inPass2', 'demo-pass-1'); await m.fill('#inJoin', 'join123');
      await m.click('#authGo'); await m.waitForSelector('#appmain:not([hidden])');
      const start = co + '-04-10';
      const st = settingsFor({ cohort: co, exams: { base: plus(60 + seed * 12), diag: plus(250 + seed * 9) }, me: nm });
      const f = path.join(TMP, 'demo-backup-' + seed + '.json'); fs.writeFileSync(f, JSON.stringify(backup(demo(sc, seed, start), st)));
      await m.click('[data-view="export"]'); await m.setInputFiles('#fRestore', f);
      await m.waitForSelector('[data-act="restore-ok"]'); await m.click('[data-act="restore-ok"]');
      await m.waitForFunction(() => document.querySelector('#status').getAttribute('data-s') === 'ok', null, { timeout: 8000 });
      await m.waitForTimeout(300);
      await M.ctx.close();
    }
    const C = await newPage(browser, { w: 1340, h: 820 }); const c = C.page;
    await c.click('[data-atab="admin"]'); await c.fill('#inPass', 'adminpass1'); await c.click('#authGo');
    await c.waitForSelector('.atable'); await c.waitForTimeout(400);
    await c.screenshot({ path: out('gas-admin-overview') }); done('gas-admin-overview');
    await c.click('.nm:has-text("デモ 花子")'); await c.waitForSelector('#drill:not([hidden])'); await c.waitForTimeout(500);
    await c.screenshot({ path: out('gas-admin-member') }); done('gas-admin-member');
    await c.click('[data-act="closeMember"]'); await c.waitForSelector('.atable');
    await c.click('[data-view="a-members"]'); await c.waitForTimeout(200);
    await c.screenshot({ path: out('gas-admin-members') }); done('gas-admin-members');
    await c.click('[data-view="a-export"]'); await c.waitForTimeout(200);
    await c.screenshot({ path: out('gas-admin-export') }); done('gas-admin-export');
    await C.ctx.close();
    // メンバー側のログイン後の画面
    const D = await newPage(browser, { w: 1180, h: 820 }); const d = D.page;
    await d.click('[data-atab="login"]'); await d.fill('#inName', 'デモ 花子'); await d.fill('#inPass', 'demo-pass-1'); await d.click('#authGo');
    await d.waitForSelector('#appmain:not([hidden])'); await d.waitForTimeout(500);
    await d.screenshot({ path: out('gas-member') }); done('gas-member');
    await D.ctx.close();
  }
  await browser.close();
  console.log('\n' + shotsDone.length + ' 枚を ' + IMG + ' に出力しました');
})().catch(e => { console.error(e); process.exit(1); });
