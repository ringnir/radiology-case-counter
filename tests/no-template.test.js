// 公開するもの（生成物・ソース・リポジトリ）に、学会・機構の様式（Excel）が混ざっていないことを確かめる
const fs = require('fs'), path = require('path'), assert = require('assert'), cp = require('child_process');
const ROOT = path.join(__dirname, '..');
let n = 0, fail = 0;
function t(name, fn) { try { fn(); n++; console.log('ok  ', name); } catch (e) { fail++; console.log('FAIL', name, '\n    ', e.message); process.exitCode = 1; } }
const rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const tracked = (() => { try { return cp.execSync('git ls-files', { cwd: ROOT }).toString().split('\n').filter(Boolean); } catch (e) { return null; } })();

t('配布するHTML（index.html・apps-script/Index.html）に様式のデータ（xlsxのbase64）が無い', () => {
  ['index.html', 'apps-script/Index.html'].forEach(f => {
    const s = rd(f);
    assert.ok(!/UEsD[A-Za-z0-9+\/]{100}/.test(s), f + ' に xlsx(zip) の base64 らしき文字列がある');
    assert.ok(/const TPL_B64 = "";/.test(s), f + ' の TPL_B64 が空ではない');
  });
});
t('ソース（src/）に、長いbase64の塊が無い', () => {
  fs.readdirSync(path.join(ROOT, 'src')).forEach(f => {
    assert.ok(f !== 'template-b64.js' || !tracked || !tracked.includes('src/' + f), 'template-b64.js が追跡対象');
    const s = rd('src/' + f);
    assert.ok(!/[A-Za-z0-9+\/]{2000}/.test(s), 'src/' + f + ' に長いbase64らしき文字列がある');
  });
});
t('リポジトリに、Excelファイルや zip 形式のファイルが追跡されていない', () => {
  if (!tracked) { console.log('     （gitの管理下ではないため省略）'); return; }
  const bad = tracked.filter(f => /\.(xlsx|xlsm|xls|xltx|zip)$/i.test(f));
  assert.deepStrictEqual(bad, []);
  const sig = tracked.filter(f => { const p = path.join(ROOT, f); if (!fs.existsSync(p)) return false; const b = fs.readFileSync(p); return b.length > 4 && b[0] === 0x50 && b[1] === 0x4b && b[2] === 3 && b[3] === 4; });
  assert.deepStrictEqual(sig, [], 'zip形式（xlsx・docxなど）のファイルがある');
});
t('.gitignore が、xlsx・内蔵用ファイル・出力フォルダを除外している', () => {
  const g = rd('.gitignore');
  ['*.xlsx', 'src/template-b64.js', 'dist/', 'tests/out/', 'tests/fixtures/*'].forEach(x => assert.ok(g.includes(x), x));
});
console.log('\n' + n + ' passed' + (fail ? ', ' + fail + ' failed' : ''));
