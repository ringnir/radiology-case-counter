const fs = require('fs'), path = require('path'), assert = require('assert'), cp = require('child_process');
const { chromium } = require('playwright-core');
const XLSX = require('xlsx');
const { makeEnv } = require('./mock-gas.js');

const DIR = __dirname;
const ROOT = path.join(DIR, '..');
const OUT = path.join(DIR, 'out'); fs.mkdirSync(OUT, { recursive: true });
const code = fs.readFileSync(path.join(ROOT, 'apps-script', 'Code.gs'), 'utf8');
const env = makeEnv(code, { admin: 'adminpass1', join: 'join123' });
env.call('setup');
const XLSX_SRC = fs.readFileSync(require.resolve('xlsx/dist/xlsx.full.min.js'), 'utf8');
const URL_ = 'http://app.test/';
// APP=dist/Index.embedded.html で様式内蔵版を試験。既定は様式を含まない index.html
const APP = path.resolve(ROOT, process.env.APP || 'index.html');
const INDEX_HTML = () => fs.readFileSync(APP, 'utf8');
const EMBEDDED = /const TPL_B64 = "UEsD/.test(INDEX_HTML());
// 様式ファイル（学会配布のxlsx）。リポジトリには含まれないので、TPL_XLSX で場所を指定する
const TPL = path.resolve(process.env.TPL_XLSX || path.join(DIR, 'fixtures', 'template.xlsx'));
const HAS_TPL = fs.existsSync(TPL);
const CAN_TPL = EMBEDDED || HAS_TPL;                       // 様式への書き込みを試験できるか
// 診断専門医・治療専門医の専攻医研修手帳（同じく学会配布）。TPL_DIAG / TPL_RT で指定
const TPL_DIAG = path.resolve(process.env.TPL_DIAG || path.join(DIR, 'fixtures', 'diag.xlsx'));
const TPL_RT = path.resolve(process.env.TPL_RT || path.join(DIR, 'fixtures', 'rt.xlsx'));
const HAS_DIAG = fs.existsSync(TPL_DIAG), HAS_RT = fs.existsSync(TPL_RT);
// 様式を内蔵していない版では、様式ファイルを選ぶ（内蔵版の基本領域では何もしない）。kind: base | diag | rt
async function ensureTpl(page, kind) {
  kind = kind || 'base';
  const file = kind === 'diag' ? TPL_DIAG : kind === 'rt' ? TPL_RT : TPL;
  if (kind === 'base' && (EMBEDDED || !HAS_TPL)) return;
  if (await page.locator('[data-view="export"]').count()) await page.click('[data-view="export"]');
  if (await page.locator('[data-act="tplforget"][data-k="' + kind + '"]').count()) return;
  await page.setInputFiles('#fTpl', file);
  await page.waitForSelector('[data-act="tplforget"][data-k="' + kind + '"]');
}
const SHOT = path.join(OUT, 'shots'); fs.mkdirSync(SHOT, { recursive: true });

let n = 0; const errs = [];
async function step(name, fn) {
  try { await fn(); n++; console.log('ok  ', name); }
  catch (e) { console.log('FAIL', name, '\n    ', (e && e.stack || e).toString().split('\n').slice(0, 16).join('\n     ')); process.exitCode = 1; }
}

async function newPage(browser, opts) {
  opts = opts || {};
  const ctx = await browser.newContext({ viewport: { width: opts.w || 1180, height: opts.h || 900 }, acceptDownloads: true });
  await ctx.route(/^https?:/, r => r.abort());
  await ctx.route('http://app.test/', r => r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: INDEX_HTML() }));
  const page = await ctx.newPage();
  page.setDefaultTimeout(6000);
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::/.test(m.text())) errs.push('console: ' + m.text()); });
  await page.exposeFunction('__rpc', (name, args) => {
    try { return { ok: true, v: env.call(name, ...args) }; } catch (e) { return { ok: false, m: String(e.message) }; }
  });
  if (!opts.local) {
    await page.addInitScript(() => {
      const mk = (ok, fail) => new Proxy({}, { get(_, prop) {
        if (prop === 'withSuccessHandler') return f => mk(f, fail);
        if (prop === 'withFailureHandler') return f => mk(ok, f);
        return (...a) => { window.__rpc(String(prop), a).then(r => { if (r.ok) ok && ok(r.v); else fail && fail({ message: r.m }); }); };
      } });
      window.google = { script: { run: mk(null, null) } };
    });
  }
  await page.addInitScript(() => {
    window.__dlNames = [];
    const orig = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () { if (this.download) window.__dlNames.push(this.download); return orig.apply(this, arguments); };
  });
  await page.addInitScript(XLSX_SRC);
  await page.goto(URL_);
  return { ctx, page };
}
const txt = (page, sel) => page.locator(sel).innerText();
const shot = (page, name) => page.screenshot({ path: path.join(SHOT, name + '.png'), fullPage: true });
async function login(page, name, pass) {
  await page.click('[data-atab="login"]');
  await page.fill('#inName', name); await page.fill('#inPass', pass);
  await page.click('#authGo');
}
async function waitSaved(page) {
  await page.waitForFunction(() => document.querySelector('#status').getAttribute('data-s') === 'ok', null, { timeout: 5000 });
}


module.exports = { env, step, newPage, txt, shot, login, waitSaved, errs, DIR, ROOT, OUT, XLSX, APP, EMBEDDED, TPL, HAS_TPL, CAN_TPL, TPL_DIAG, TPL_RT, HAS_DIAG, HAS_RT, ensureTpl, getN: () => n, code, SHOT };
