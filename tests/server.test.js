const fs = require('fs');
const assert = require('assert');
const { makeEnv } = require('./mock-gas.js');
const code = fs.readFileSync(__dirname + '/../apps-script/Code.gs', 'utf8');

let pass = 0;
function t(name, fn) {
  try { fn(); pass++; console.log('ok  ', name); }
  catch (e) { console.log('FAIL', name, '\n    ', e && e.stack || e); process.exitCode = 1; }
}
function code_(fn) { try { fn(); } catch (e) { return (/E:([a-z_]+)/.exec(e.message) || [])[1] || e.message; } return 'no-error'; }

/* --- 未設定ではログインできない --- */
t('not configured → E:not_configured / not_setup', () => {
  const e0 = makeEnv(code, {});
  assert.strictEqual(e0.call('api_ping').configured, false);
  assert.strictEqual(code_(() => e0.call('api_login', 'a', 'b')), 'not_configured');
  const e1 = makeEnv(code, { admin: 'adminpass1', join: 'join123' });
  assert.strictEqual(e1.call('api_ping').ready, false);
  assert.strictEqual(code_(() => e1.call('api_login', 'a', 'b')), 'not_setup');
});

const E = makeEnv(code, { admin: 'adminpass1', join: 'join123' });
t('api_ping before setup: ready=false; register → not_setup', () => {
  assert.strictEqual(E.call('api_ping').ready, false);
  assert.strictEqual(code_(() => E.call('api_register', '山田', 'secret1', 'join123')), 'not_setup');
});
t('setup creates spreadsheet with 3 sheets, text format, secret', () => {
  E.call('setup');
  const ss = E.sheetsets[E.props.SS_ID];
  ['members', 'docs', 'config'].forEach(n => assert.ok(ss.getSheetByName(n), n));
  assert.strictEqual(ss.getSheetByName('シート1'), null);
  assert.ok(E.props.SECRET.length > 40);
  assert.ok(E.sheet('members').plain);
  assert.strictEqual(E.stats.created, 1);
  E.call('setup');                       // 冪等
  assert.strictEqual(E.stats.created, 1);
  assert.strictEqual(E.call('api_ping').ready, true);
});

let tokA, meA;
t('register: wrong join code → join; locks after 5 fails', () => {
  assert.strictEqual(code_(() => E.call('api_register', '山田', 'secret1', 'bad')), 'join');
  for (let i = 0; i < 4; i++) E.call.bind(E, 'api_register', '山田', 'secret1', 'bad');
  for (let i = 0; i < 3; i++) code_(() => E.call('api_register', '山田', 'secret1', 'bad'));
  assert.strictEqual(code_(() => E.call('api_register', '山田', 'secret1', 'bad')), 'join'); // 5回目
  assert.strictEqual(code_(() => E.call('api_register', '山田', 'secret1', 'join123')), 'locked'); // ロック中は正解でも拒否
  E.advance(16 * 60 * 1000);
  assert.strictEqual(code_(() => E.call('api_register', '山田', 'secret1', 'join123')), 'no-error'); // 解除後OK
});
t('register: rules (weak pass, bad name, duplicate incl. width/space/case)', () => {
  assert.strictEqual(code_(() => E.call('api_register', '佐藤', '123', 'join123')), 'weak');
  assert.strictEqual(code_(() => E.call('api_register', '   ', 'secret1', 'join123')), 'bad_name');
  assert.strictEqual(code_(() => E.call('api_register', 'あ'.repeat(25), 'secret1', 'join123')), 'bad_name');
  assert.strictEqual(code_(() => E.call('api_register', '山田', 'secret1', 'join123')), 'name_taken');
  assert.strictEqual(code_(() => E.call('api_register', ' 山 田 ', 'secret1', 'join123')), 'name_taken');
  const r = E.call('api_register', 'Taro Suzuki', 'secret1', 'join123');
  assert.strictEqual(code_(() => E.call('api_register', 'ＴＡＲＯ　suzuki', 'secret1', 'join123')), 'name_taken');
  assert.ok(r.token && r.me.name === 'Taro Suzuki');
});
t('login: ok / wrong / unknown share one error; lock after 5', () => {
  const ok = E.call('api_login', '山田', 'secret1');
  tokA = ok.token; meA = ok.me;
  assert.ok(tokA && meA.id && ok.admin === false);
  assert.strictEqual(code_(() => E.call('api_login', '山田', 'wrong')), 'login');
  assert.strictEqual(code_(() => E.call('api_login', '存在しない人', 'x')), 'login');
  for (let i = 0; i < 3; i++) code_(() => E.call('api_login', '山田', 'wrong'));
  assert.strictEqual(code_(() => E.call('api_login', '山田', 'wrong')), 'login');
  assert.strictEqual(code_(() => E.call('api_login', '山田', 'secret1')), 'locked');
  E.advance(16 * 60 * 1000);
  assert.strictEqual(code_(() => E.call('api_login', '山田', 'secret1')), 'no-error');
});
t('members sheet holds hash+salt only (no plain passcode)', () => {
  const rows = E.sheet('members').getRange(2, 1, 5, 7).getValues().filter(r => r[0]);
  const blob = JSON.stringify(rows);
  assert.ok(!blob.includes('secret1'));
  assert.ok(rows.every(r => /^[0-9a-f]{64}$/.test(r[4])));
});

t('token tampering / garbage → auth', () => {
  assert.strictEqual(code_(() => E.call('api_load', 'garbage')), 'auth');
  assert.strictEqual(code_(() => E.call('api_load', null)), 'auth');
  const [p, s] = tokA.split('.');
  assert.strictEqual(code_(() => E.call('api_load', p + '.' + s.slice(0, -2) + 'AA')), 'auth');
  const forged = Buffer.from(JSON.stringify({ m: meA.id, a: 1, e: Date.now() + 1e9 })).toString('base64url') + '.' + s;
  assert.strictEqual(code_(() => E.call('api_adminAll', forged)), 'auth');
  assert.strictEqual(code_(() => E.call('api_adminAll', tokA)), 'forbidden');
});

const m1 = JSON.stringify({ e1abc: { d: '2026-04-03', c: 'ct', n: 2 }, e2abc: { d: '2026-04-05', c: 'mri', n: 1, z: '肝細胞癌' } });
t('save + load roundtrip; settings; delete via null', () => {
  assert.deepStrictEqual(E.call('api_load', tokA).docs, {});
  E.call('api_save', tokA, { 'm-2026-04': m1, settings: JSON.stringify({ goals: {} }) });
  const l = E.call('api_load', tokA);
  assert.strictEqual(l.docs['m-2026-04'], m1);
  assert.strictEqual(l.docs.settings, '{"goals":{}}');
  assert.strictEqual(l.me.name, '山田');
  E.call('api_save', tokA, { 'm-2026-04': m1.replace('"n":2', '"n":3') });                 // 更新（行は増えない）
  assert.strictEqual(E.sheet('docs').getLastRow(), 3);
  assert.ok(E.call('api_load', tokA).docs['m-2026-04'].includes('"n":3'));
  E.call('api_save', tokA, { 'm-2026-04': null });                                            // 削除
  assert.strictEqual(E.sheet('docs').getLastRow(), 2);
  assert.deepStrictEqual(Object.keys(E.call('api_load', tokA).docs), ['settings']);
});
t('save validation: bad key / non-JSON / array / too large / not member', () => {
  assert.strictEqual(code_(() => E.call('api_save', tokA, { 'evil': '{}' })), 'bad_request');
  assert.strictEqual(code_(() => E.call('api_save', tokA, { 'summary2': '{}' })), 'bad_request');
  assert.strictEqual(code_(() => E.call('api_save', tokA, { 'm-2026-04': 'not json' })), 'bad_request');
  assert.strictEqual(code_(() => E.call('api_save', tokA, { 'm-2026-04': '[]' })), 'bad_request');
  assert.strictEqual(code_(() => E.call('api_save', tokA, { 'm-2026-04': '{"a":"' + 'x'.repeat(700000) + '"}' })), 'too_large');
  assert.strictEqual(code_(() => E.call('api_save', tokA, null)), 'bad_request');
  const adm = E.call('api_adminLogin', 'adminpass1');
  assert.strictEqual(code_(() => E.call('api_save', adm.token, { settings: '{}' })), 'no_member');
});
t('large month is chunked across cells and restored exactly (and > 1000 rows grows sheet)', () => {
  const big = {}; for (let i = 0; i < 400; i++) big['id' + String(i).padStart(4, '0')] = { d: '2026-05-01', c: 'ct', n: 1, m: 'メモ'.repeat(40), s: 'x'.repeat(60), z: 'y'.repeat(80) };
  const js = JSON.stringify(big);
  assert.ok(js.length > 40000 && js.length < 320000, String(js.length));
  E.call('api_save', tokA, { 'm-2026-05': js });
  assert.strictEqual(E.call('api_load', tokA).docs['m-2026-05'], js);
  // 行数を増やして 1000 行を超えても追記できる
  const many = {}; for (let i = 0; i < 60; i++) many['m-2020-' + String(i % 12 + 1).padStart(2, '0')] = '{}';
  const reg = [];
  for (let i = 0; i < 25; i++) reg.push(E.call('api_register', 'ユーザー' + i, 'secret1', 'join123'));
  // 1ユーザー12ドキュメント × 80人 = 960行超 を作る
  for (let u = 0; u < 25; u++) {
    const docs = {}; for (let k = 1; k <= 12; k++) docs['m-2025-' + String(k).padStart(2, '0')] = '{"x1abc":{"d":"2025-01-01","c":"ct","n":1}}';
    E.call('api_save', reg[u].token, docs);
  }
  assert.strictEqual(E.call('api_load', reg[24].token).docs['m-2025-12'].length > 10, true);
});
t('rows beyond 1000 are appendable (insertRows)', () => {
  const E2 = makeEnv(code, { admin: 'adminpass1', join: 'join123' });
  E2.call('setup');
  const r = E2.call('api_register', 'A', 'secret1', 'join123');
  for (let b = 0; b < 17; b++) {
    const docs = {}; for (let k = 0; k < 60; k++) docs['m-' + (2000 + b * 5 + Math.floor(k / 12)) + '-' + String(k % 12 + 1).padStart(2, '0')] = '{"a":{}}';
    E2.call('api_save', r.token, docs);
  }
  assert.ok(E2.sheet('docs').getLastRow() > 1000, String(E2.sheet('docs').getLastRow()));
  assert.ok(E2.sheet('docs').getMaxRows() >= E2.sheet('docs').getLastRow());
  assert.strictEqual(Object.keys(E2.call('api_load', r.token).docs).length, 17 * 60);
});

t('members only see their own data', () => {
  const b = E.call('api_login', 'Taro Suzuki', 'secret1');
  assert.deepStrictEqual(E.call('api_load', b.token).docs, {});
  assert.ok(Object.keys(E.call('api_load', tokA).docs).length >= 2);
});

let adm;
t('admin login: wrong → login, lock; right → admin token without member', () => {
  assert.strictEqual(code_(() => E.call('api_adminLogin', 'nope')), 'login');
  adm = E.call('api_adminLogin', 'adminpass1');
  assert.ok(adm.admin && adm.me === null);
  const l = E.call('api_load', adm.token);
  assert.strictEqual(l.me, null); assert.strictEqual(l.admin, true); assert.deepStrictEqual(l.docs, {});
  for (let i = 0; i < 5; i++) code_(() => E.call('api_adminLogin', 'nope'));
  assert.strictEqual(code_(() => E.call('api_adminLogin', 'adminpass1')), 'locked');
  E.advance(16 * 60 * 1000);
  adm = E.call('api_adminLogin', 'adminpass1');
});
t('api_upgrade gives admin to a member token', () => {
  assert.strictEqual(code_(() => E.call('api_upgrade', tokA, 'nope')), 'login');
  const u = E.call('api_upgrade', tokA, 'adminpass1');
  assert.ok(u.admin && u.me.id === meA.id);
  assert.ok(E.call('api_adminAll', u.token).members.length >= 2);
  assert.ok(Object.keys(E.call('api_load', u.token).docs).length >= 2);    // 自分のデータも読める
});
t('adminAll is slim: only settings + summary (no cases), with last update', () => {
  E.call('api_save', tokA, { settings: JSON.stringify({ cohort: 2025 }), summary: JSON.stringify({ v: 1, n: 5 }) });
  const all = E.call('api_adminAll', adm.token);
  const y = all.members.find(m => m.name === '山田');
  assert.ok(y && y.upd);
  assert.deepStrictEqual(Object.keys(y.docs).sort(), ['settings', 'summary']);
  assert.strictEqual(y.docs.summary, '{"v":1,"n":5}');
  assert.ok(!Object.keys(y.docs).some(k => k.indexOf('m-') === 0));
  assert.strictEqual(all.dzlist, undefined);
  assert.strictEqual(code_(() => E.call('api_adminAll', tokA)), 'forbidden');
});
t('adminMember returns all docs of one member (admin only)', () => {
  const r = E.call('api_adminMember', adm.token, meA.id);
  assert.strictEqual(r.id, meA.id); assert.strictEqual(r.name, '山田');
  assert.ok(r.docs['m-2026-05'] && r.docs.settings && r.docs.summary);
  assert.strictEqual(code_(() => E.call('api_adminMember', tokA, meA.id)), 'forbidden');
  assert.strictEqual(code_(() => E.call('api_adminMember', adm.token, 'nope')), 'not_found');
  const other = E.call('api_login', 'Taro Suzuki', 'secret1');
  assert.deepStrictEqual(E.call('api_adminMember', adm.token, other.me.id).docs, {});
});
t('two-phase read: non-contiguous rows and a 600k-char month across 16 cells', () => {
  const E3 = makeEnv(code, { admin: 'adminpass1', join: 'join123' });
  E3.call('setup');
  const a = E3.call('api_register', 'A', 'secret1', 'join123'), b = E3.call('api_register', 'B', 'secret1', 'join123');
  const big = JSON.stringify({ k1abc: { d: '2026-01-01', c: 'ct', n: 1, m: 'メ'.repeat(600000) } });
  assert.ok(big.length > 600000 && big.length <= 640000);
  E3.call('api_save', a.token, { 'm-2026-01': big, settings: '{"cohort":2024}' });
  E3.call('api_save', b.token, { 'm-2026-01': '{"b1abc":{"d":"2026-01-02","c":"ct","n":1}}', summary: '{"v":1}' });
  E3.call('api_save', a.token, { summary: '{"v":1,"n":1}', 'm-2026-02': '{"z1abc":{"d":"2026-02-01","c":"mri","n":1}}' });   // A の行が B をはさんで離れる
  assert.strictEqual(E3.call('api_load', a.token).docs['m-2026-01'], big);
  const am = E3.call('api_adminMember', E3.call('api_adminLogin', 'adminpass1').token, a.me.id);
  assert.strictEqual(am.docs['m-2026-01'], big);
  assert.deepStrictEqual(Object.keys(am.docs).sort(), ['m-2026-01', 'm-2026-02', 'settings', 'summary']);
  const all = E3.call('api_adminAll', E3.call('api_adminLogin', 'adminpass1').token);
  assert.strictEqual(all.members.find(m => m.name === 'A').docs.settings, '{"cohort":2024}');
  assert.strictEqual(all.members.find(m => m.name === 'B').docs.summary, '{"v":1}');
  assert.strictEqual(code_(() => E3.call('api_save', a.token, { 'm-2026-03': JSON.stringify({ x: 'メ'.repeat(650000) }) })), 'too_large');
});
t('change own passcode; old fails; admin reset; rename; duplicate rename', () => {
  assert.strictEqual(code_(() => E.call('api_changePass', tokA, 'wrong', 'newsecret1')), 'login');
  assert.strictEqual(code_(() => E.call('api_changePass', tokA, 'secret1', '123')), 'weak');
  E.call('api_changePass', tokA, 'secret1', 'newsecret1');
  assert.strictEqual(code_(() => E.call('api_login', '山田', 'secret1')), 'login');
  E.call('api_login', '山田', 'newsecret1');
  E.call('api_adminSetPass', adm.token, meA.id, 'reset-pass-9');
  E.call('api_login', '山田', 'reset-pass-9');
  assert.strictEqual(code_(() => E.call('api_adminSetPass', tokA, meA.id, 'abcdefg')), 'forbidden');
  assert.strictEqual(code_(() => E.call('api_adminRename', adm.token, meA.id, 'Taro Suzuki')), 'name_taken');
  assert.strictEqual(E.call('api_adminRename', adm.token, meA.id, '山田 太郎').name, '山田 太郎');
  E.call('api_login', '山田太郎', 'reset-pass-9');                                           // 空白無視で一致
  assert.strictEqual(code_(() => E.call('api_adminRename', adm.token, 'nope', 'x')), 'not_found');
});
t('names starting with = are stored as text (no formula)', () => {
  const r = E.call('api_register', '=1+1', 'secret1', 'join123');
  const row = E.sheet('members').getRange(2, 1, E.sheet('members').getLastRow() - 1, 7).getValues().find(x => x[0] === r.me.id);
  assert.strictEqual(row[1], '=1+1');
  assert.ok(E.sheet('members').plain);
});
t('delete member removes docs and invalidates token', () => {
  const before = E.sheet('docs').getLastRow();
  const n = Object.keys(E.call('api_load', tokA).docs).length;
  assert.ok(n >= 2);
  E.call('api_adminDelete', adm.token, meA.id);
  assert.strictEqual(E.sheet('docs').getLastRow(), before - n);
  assert.strictEqual(code_(() => E.call('api_load', tokA)), 'auth');
  assert.strictEqual(code_(() => E.call('api_login', '山田太郎', 'reset-pass-9')), 'login');
  assert.strictEqual(code_(() => E.call('api_adminMember', adm.token, meA.id)), 'not_found');
  assert.ok(!E.call('api_adminAll', adm.token).members.some(m => m.id === meA.id));
  assert.strictEqual(code_(() => E.call('api_adminDelete', adm.token, meA.id)), 'not_found');
});
t('expired token → auth', () => {
  const b = E.call('api_login', 'Taro Suzuki', 'secret1');
  E.advance(31 * 86400000);
  assert.strictEqual(code_(() => E.call('api_load', b.token)), 'auth');
});
t('adminWriteSheet: whitelist, formula guard, url', () => {
  const adm2 = E.call('api_adminLogin', 'adminpass1');
  assert.strictEqual(code_(() => E.call('api_adminWriteSheet', adm2.token, 'members', [['x']])), 'bad_request');
  const r = E.call('api_adminWriteSheet', adm2.token, '全員症例一覧', [['氏名', '件数'], ['=HYPERLINK("x")', 5], ['+cmd', 1]]);
  assert.ok(/#gid=\d+$/.test(r.url));
  const sh = E.sheetsets[E.props.SS_ID].getSheetByName('全員症例一覧');
  assert.deepStrictEqual(sh.getRange(1, 1, 3, 2).getValues(), [['氏名', '件数'], ["'=HYPERLINK(\"x\")", 5], ["'+cmd", 1]]);
  E.call('api_adminWriteSheet', adm2.token, '全員症例一覧', [['再'], ['書き込み']]);          // 上書き
  assert.strictEqual(sh.getLastRow(), 2);
  const big = Array.from({ length: 1500 }, (_, i) => ['r' + i, i]);
  E.call('api_adminWriteSheet', adm2.token, '全員サマリ', big);                                  // 1000行超
});
t('private helpers (trailing _) are not callable through call()', () => {
  assert.throws(() => E.call('sha_', 'x'));
});
console.log('\n' + pass + ' passed');
