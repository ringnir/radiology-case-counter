const fs=require('fs'), assert=require('assert');
const path=require('path');
const dir=__dirname, SRC=path.join(dir,'..','src'), OUT=path.join(dir,'out'); fs.mkdirSync(OUT,{recursive:true});
const src=fs.readFileSync(SRC+'/logic.js','utf8')+fs.readFileSync(SRC+'/template.js','utf8')+fs.readFileSync(SRC+'/case.js','utf8');
// 学会配布の様式（リポジトリには含まれない）。TPL_XLSX で指定。無ければ様式を使う試験は省略
const TPL=path.resolve(process.env.TPL_XLSX||path.join(dir,'fixtures','template.xlsx'));
const TPL_BYTES=fs.existsSync(TPL)?fs.readFileSync(TPL):null;
// 診断専門医・治療専門医の専攻医研修手帳（同じく学会配布・リポジトリには含まれない）。TPL_DIAG / TPL_RT で指定
const rdOpt=(env,def)=>{ const f=path.resolve(process.env[env]||path.join(dir,'fixtures',def)); return fs.existsSync(f)?fs.readFileSync(f):null; };
const DIAG_BYTES=rdOpt('TPL_DIAG','diag.xlsx'), RT_BYTES=rdOpt('TPL_RT','rt.xlsx');
const names=['suggestCat','parseDelimited','parseDateLoose','guessHeaderRow','headerList','guessCols','scanImport','aggregateImport','importEntries','impId','sanitizeImp','sanitizeSettings','defaultSettings','isPrivateHeader','sanitizeEntry','tally','progress','summarize','TRACKS','CATS','cleanMonths','parseAge','parseSex','scrubText','buildCaseImport','caseImportEntries','isImpId','toCSV','ENTRY_HEAD','entryRow','parseBackup',
 'SLOTS','slotAreas','slotMap','slotLabel','daysUntil','paceOf','examState','nextExam','makeSummary','sanitizeSummary','buildTemplateData','reportWarnings','fillSheetXml','buildTemplateXlsx','openTemplate','checkTemplateZip','dateSerial','expandCases','pickCap','TPL_SLOTS','TPL_SHEETS','TPL_AREAS','TPL_RT_SITES','IMP_ROLE_KEYS','goalOf','allEntries','buildDiagData','buildRtData','buildKindData','extendSheetXml','lastNumRow','RT_KINDS','RT_MT','RT_PURPOSES','rtKindId','TPL_KINDS','NB','numIn','isMonth'];
const L=new Function(src+'\nreturn {'+names.join(',')+'};')();
let n=0; function t(name,fn){ try{fn();n++;console.log('ok  ',name);}catch(e){console.log('FAIL',name,'\n   ',(process.env.FULL?e.message.split('\n').slice(0,60):e.stack.split('\n').slice(0,4)).join('\n    '));process.exitCode=1;} }

t('suggestCat: modality codes and Japanese names',()=>{
  const c=(s,e)=>assert.strictEqual(L.suggestCat(s),e,s);
  c('CT','ct');c('ct','ct');c('MR','mri');c('MRI','mri');c('ＭＲＩ','mri');c('MRCP','mri');c('US','us');c('超音波','us');c('エコー','us');
  c('CR','xray');c('DX','xray');c('一般撮影','xray');c('単純X線','xray');c('Ｘ線撮影','xray');
  c('NM','rn');c('PET','rn');c('PET-CT','rn');c('核医学','rn');c('シンチグラフィ','rn');c('PT','rn');
  c('XA','ivr_v');c('血管造影','ivr_v');c('TACE','ivr_v');c('ドレナージ','ivr_n');c('CT下生検','ivr_n');c('RFA','ivr_n');
  c('消化管造影','gi');c('上部消化管','gi');c('注腸','gi');
  c('放射線治療 脳','rt_head');c('RT\u0001頭頸部','rt_head');c('放射線治療 肺','rt_chest');c('IMRT 前立腺','rt_abd');c('照射 骨転移','rt_msk');c('放射線治療',null);
  c('MG',null);c('OT',null);c('',null);c('RF',null);
});
t('parseDateLoose formats',()=>{
  const d=L.parseDateLoose;
  assert.strictEqual(d('2024-04-03'),'2024-04-03');assert.strictEqual(d('2024/4/3 10:15'),'2024-04-03');assert.strictEqual(d('2024.04.03'),'2024-04-03');
  assert.strictEqual(d('20240403'),'2024-04-03');assert.strictEqual(d('202404031015'),'2024-04-03');assert.strictEqual(d('2024年4月3日'),'2024-04-03');
  assert.strictEqual(d('令和6年4月3日'),'2024-04-03');assert.strictEqual(d('R6.4.3'),'2024-04-03');assert.strictEqual(d('令和元年5月1日'),'2019-05-01');assert.strictEqual(d('H30/12/31'),'2018-12-31');
  assert.strictEqual(d('4/3/2024'),'2024-04-03');assert.strictEqual(d('25/12/2024'),'2024-12-25');
  assert.strictEqual(d('45383'),'2024-04-01');assert.strictEqual(d('２０２４／０４／０３'),'2024-04-03');
  ['','abc','2024-13-01','2024-02-30','1899-01-01','12345678','99999',null,'0'].forEach(x=>assert.strictEqual(d(x),null,String(x)));
});
t('parseDelimited: quotes, CRLF, tabs, semicolons, BOM, embedded newline',()=>{
  const r=L.parseDelimited('﻿検査日,モダリティ,メモ\r\n2024-04-03,CT,"a,b"\r\n2024-04-04,MR,"x\ny ""q"""\r\n\r\n');
  assert.deepStrictEqual(r,[['検査日','モダリティ','メモ'],['2024-04-03','CT','a,b'],['2024-04-04','MR','x\ny "q"']]);
  assert.deepStrictEqual(L.parseDelimited('a\tb\n1\t2'),[['a','b'],['1','2']]);
  assert.deepStrictEqual(L.parseDelimited('a;b\n1;2'),[['a','b'],['1','2']]);
});
t('guessHeaderRow / guessCols / private columns',()=>{
  const g=[['○○病院 読影レポート一覧'],['出力日','2024-05-01'],['患者ID','患者氏名','検査日','モダリティ','検査名','生年月日','依頼医'],['000123','山田太郎','2024-04-03','CT','胸腹部CT','1970-01-01','田中']];
  const h=L.guessHeaderRow(g); assert.strictEqual(h,2);
  const heads=L.headerList(g,h);
  assert.deepStrictEqual(heads.map(x=>x.priv),[true,true,false,false,false,true,true]);
  const c=L.guessCols(heads,null); assert.deepStrictEqual(c,{date:2,cat:3,cat2:-1,age:-1,sex:-1,part:-1,kind:-1,req:-1,diag:-1,proc:-1,sv:-1});
  const c2=L.guessCols(heads,{date:'検査日',cat:'検査名',cat2:'モダリティ'}); assert.deepStrictEqual([c2.date,c2.cat,c2.cat2],[2,4,3]);
  const c3=L.guessCols(heads,{date:'患者ID',cat:'',cat2:''}); assert.strictEqual(c3.date,2); // 個人情報列は保存済みでも使わない
});
t('scan → aggregate → entries; privacy: only chosen columns are read',()=>{
  const g=[['患者氏名','検査日','モダリティ','部位'],
    ['A','2024-04-03','CT','胸部'],['B','2024-04-03','CT','腹部'],['C','2024-04-03','MR','頭部'],['D','2024-04-04','US',''],
    ['E','','CT',''],['F','2024-04-05','OT',''],['','','',''],['G','2024-04-06','RT','乳房'],['H','令和6年4月7日','CR','']];
  const o={hdr:0,date:1,cat:2,cat2:-1,from:'',to:'',vals:{}};
  const sc=L.scanImport(g,o);
  assert.strictEqual(sc.rows,8); assert.strictEqual(sc.badDate,1); assert.strictEqual(sc.minD,'2024-04-03'); assert.strictEqual(sc.maxD,'2024-04-07');
  const sug={}; sc.keys.forEach(k=>sug[k.key]=k.sug); assert.deepStrictEqual(sug,{CT:'ct',MR:'mri',US:'us',OT:null,RT:null,CR:'xray'});
  sc.keys.forEach(k=>o.vals[k.key]=k.sug||'-');
  let a=L.aggregateImport(g,o);
  assert.deepStrictEqual(a.agg,{'2024-04-03|ct':2,'2024-04-03|mri':1,'2024-04-04|us':1,'2024-04-07|xray':1});
  assert.strictEqual(a.stat.badDate,1); assert.strictEqual(a.stat.skipCat,2); assert.strictEqual(a.stat.ok,5);
  o.from='2024-04-04'; a=L.aggregateImport(g,o); assert.strictEqual(a.stat.outside,3); assert.deepStrictEqual(Object.keys(a.agg).sort(),['2024-04-04|us','2024-04-07|xray']);
  // 2列キー（部位で分ける）
  const o2={hdr:0,date:1,cat:2,cat2:3,from:'',to:'',vals:{'RT\u0001乳房':'rt_chest','CT\u0001胸部':'ct'}};
  const a2=L.aggregateImport(g,o2); assert.deepStrictEqual(a2.agg,{'2024-04-03|ct':1,'2024-04-06|rt_chest':1});
  const es=L.importEntries({'2024-04-03|ct':2500,'2024-04-04|us':3},'○○病院','自動取込');
  assert.strictEqual(es.length,4); assert.deepStrictEqual(es.filter(e=>e.c==='ct').map(e=>e.n),[999,999,502]);
  assert.strictEqual(new Set(es.map(e=>e.id)).size,4);
  es.forEach(e=>{ assert.ok(L.sanitizeEntry(e)); assert.ok(/^[A-Za-z0-9_-]{4,40}$/.test(e.id)); });
  assert.strictEqual(es[0].id, L.importEntries({'2024-04-03|ct':1},'', '')[0].id); // 決定的ID（再取り込みで二重にならない）
});

const J=o=>JSON.parse(JSON.stringify(o));
t('sanitizeEntry: per-case fields, group-specific, bounds',()=>{
  const e=L.sanitizeEntry({d:'2025-04-01',c:'ct',n:1,a:'45',x:'M',p:' 胸腹部 ',q:'造影',r:'肺癌 精査',z:'肺腺癌',k:'12',f1:'甲',f2:'乙',h:'x',tx:'y',ro:'術',o:1,junk:1,m:'メモ',s:'○○病院'});
  assert.deepStrictEqual(J(e),{d:'2025-04-01',c:'ct',n:1,a:45,x:'M',z:'肺腺癌',m:'メモ',s:'○○病院',f1:'甲',f2:'乙',p:'胸腹部',q:'造影',r:'肺癌 精査',k:12});
  const iv=L.sanitizeEntry({d:'2025-04-01',c:'ivr_v',a:0,x:'F',z:'肝癌',h:'TACE',ro:'助',o:true,p:'no',k:3});
  assert.deepStrictEqual(J(iv),{d:'2025-04-01',c:'ivr_v',n:1,a:0,x:'F',z:'肝癌',h:'TACE',ro:'助',o:1});
  const rt=L.sanitizeEntry({d:'2025-04-01',c:'rt_head',t:'hp',tx:'外部照射',h:'no'});
  assert.deepStrictEqual(J(rt),{d:'2025-04-01',c:'rt_head',n:1,t:'hp',tx:'外部照射'});
  const bad=L.sanitizeEntry({d:'2025-04-01',c:'ct',a:150,x:'Z',k:101,ro:'術'});
  assert.deepStrictEqual(J(bad),{d:'2025-04-01',c:'ct',n:1});
  assert.strictEqual(L.sanitizeEntry({d:'2025-04-01',c:'ct',n:5,k:3}).k,undefined,'n>1 は枠に使えない');
  assert.strictEqual(L.sanitizeEntry({d:'2025-04-01',c:'dz'}),null,'dz は区分でなくなった');
  assert.strictEqual(L.sanitizeEntry({d:'2025-04-01',c:'ct',a:''}).a,undefined);
  assert.strictEqual(L.sanitizeEntry({d:'2025-04-01',c:'ct',z:'a\u0000b\nc'}).z,'a b c');
  assert.strictEqual(L.sanitizeEntry({d:'2025-04-01',c:'ct',r:'x'.repeat(200)}).r.length,80);
});
t('sanitizeSettings: cohort/exams/events/facilities; old dzl ignored; roundtrip',()=>{
  const s=L.sanitizeSettings({cohort:'2024',exams:{base:'2027-02-14',diag:'bad',zzz:'2027-01-01'},
    ev:[{d:'2026-11-01',t:'学会'},{d:'2026-09-01',t:' 講習会 '},{d:'bad',t:'x'},{d:'2026-10-01',t:''},null],
    facs:[{n:'琉大病院',c:'０１２３４５６７８'},{n:'琉大病院',c:'1'},{n:'B病院',c:'12'},{n:'',c:'123456789'}],me:' 山田 ',sv:'佐藤',dzl:[{g:'a',items:['x']}]});
  assert.strictEqual(s.cohort,2024); assert.deepStrictEqual(J(s.exams),{base:'2027-02-14'});
  assert.deepStrictEqual(J(s.ev),[{d:'2026-09-01',t:'講習会'},{d:'2026-11-01',t:'学会'}]);
  assert.deepStrictEqual(J(s.facs),[{n:'琉大病院',c:'012345678'},{n:'B病院',c:''}]);
  assert.strictEqual(s.me,'山田'); assert.strictEqual(s.dzl,undefined);
  assert.deepStrictEqual(J(L.sanitizeSettings(J(s))),J(s));
  const d=L.sanitizeSettings(null); assert.strictEqual(d.cohort,0); assert.strictEqual(d.imp,null); assert.deepStrictEqual(J(d.facs),[]);
  assert.strictEqual(L.sanitizeSettings({cohort:1999}).cohort,0);
  const im=L.sanitizeSettings({imp:{cols:{date:'検査日',cat:'モダリティ',cat2:7,age:'年齢'},vals:{CT:'ct',X:'dz',Y:'-',Z:'zzz',R:'rt_head'},site:'病院',mode:'count'}}).imp;
  assert.deepStrictEqual(J(im.vals),{CT:'ct',Y:'-',R:'rt_head'}); assert.strictEqual(im.cols.age,'年齢'); assert.strictEqual(im.cols.cat2,''); assert.strictEqual(im.mode,'count');
});
t('tally: dz = distinct slots, range applies',()=>{
  const es=[{id:'a1',d:'2025-01-05',c:'ct',n:1,k:5},{id:'a2',d:'2025-02-05',c:'mri',n:1,k:5},{id:'a3',d:'2025-03-05',c:'us',n:1,k:7},{id:'a4',d:'2025-03-06',c:'xray',n:3},{id:'a5',d:'2025-03-06',c:'rt_head',n:2,t:'hp',}];
  const t1=L.tally(es); assert.strictEqual(t1.dz,2); assert.strictEqual(t1.xray,3); assert.strictEqual(t1.t_hp,2); assert.strictEqual(t1.rt_head,2);
  assert.strictEqual(L.tally(es,{from:'2025-03-01'}).dz,1);
  assert.strictEqual(L.tally([]).dz,0);
  const base=L.TRACKS[0], rows=L.progress(base,t1,L.defaultSettings());
  const dz=rows.find(r=>r.item.id==='dz'); assert.strictEqual(dz.count,2); assert.strictEqual(dz.goal,90); assert.strictEqual(dz.rest,88);
});
t('診断・治療専門医: 研修手帳の目標、治療技術の重複カウント',()=>{
  const by=(tr,id)=>tr.items.find(i=>i.id===id);
  const D=L.TRACKS.find(x=>x.id==='diag'), R=L.TRACKS.find(x=>x.id==='rt');
  assert.deepStrictEqual(D.items.map(i=>[i.id,i.goal]),[['xray',400],['gi',40],['us',50],['ct',1500],['mri',1000],['rn',60],['ivr',40],['ivr_v',null],['ivr_n',null]]);
  assert.deepStrictEqual(R.items.map(i=>[i.id,i.goal]),[['rt',200],['rt_head',30],['rt_chest',30],['rt_abd',30],['rt_msk',null],['tech',30],['t_brachy',5],['t_hp',10],['t_imrt',5],['t_srt',5],['t_special',null]]);
  const es=[
    {id:'r1',d:'2025-03-01',c:'rt_abd',n:1,t:'imrt'},{id:'r2',d:'2025-03-02',c:'rt_head',n:1,t:'srt'},{id:'r3',d:'2025-03-03',c:'rt_abd',n:1,t:'brachy'},
    {id:'r4',d:'2025-03-04',c:'rt_chest',n:2,t:'hp'},{id:'r5',d:'2025-03-05',c:'rt_msk',n:1,t:'special'},{id:'r6',d:'2025-03-06',c:'rt_chest',n:1}];
  const t=L.tally(es), rows=L.progress(R,t,L.defaultSettings()), g=id=>rows.find(r=>r.item.id===id);
  assert.strictEqual(g('rt').count,7); assert.strictEqual(g('tech').count,6);          // 部位別と技術は重複して数える
  assert.strictEqual(g('t_hp').count,4); assert.strictEqual(g('t_imrt').count,1); assert.strictEqual(g('t_srt').count,1);   // 高精度 = 強度変調 + 定位 + 区別なし
  assert.strictEqual(g('t_brachy').rest,4); assert.strictEqual(g('rt_msk').has,false); assert.strictEqual(g('t_special').has,false);
  assert.strictEqual(L.sanitizeEntry({d:'2025-03-01',c:'rt_abd',t:'imrt'}).t,'imrt'); assert.strictEqual(L.sanitizeEntry({d:'2025-03-01',c:'ct',t:'imrt'}).t,undefined);
  const sm=L.sanitizeSummary({n:1,lastD:'2025-03-01',tl:{t_imrt:2,t_srt:1,t_x:3},tr:{rt:{t_imrt:2,t_srt:1}}}); assert.deepStrictEqual(J(sm.tl),{t_imrt:2,t_srt:1}); assert.deepStrictEqual(J(sm.tr.rt),{t_imrt:2,t_srt:1});
  // 目標のない項目だけの追跡は 0% / 規定なし 扱い
  const none=L.summarize(L.progress({items:[{id:'a',label:'a',keys:['ct'],goal:null}]},{ct:5},L.defaultSettings())); assert.strictEqual(none.total,0); assert.strictEqual(none.restSum,0);
});
t('100枠: numbering, areas, labels, slotMap',()=>{
  assert.strictEqual(L.SLOTS.length,100); assert.deepStrictEqual(L.SLOTS.map(s=>s.no),Array.from({length:100},(_,i)=>i+1));
  const A=L.slotAreas(); assert.strictEqual(A.length,11);
  assert.deepStrictEqual(A.map(a=>a.groups.reduce((s,g)=>s+g.slots.length,0)),[9,7,7,10,14,8,5,11,10,9,10]);
  A.forEach(a=>a.groups.forEach(g=>assert.strictEqual(g.slots.length,g.size,a.name+g.name)));
  assert.strictEqual(L.slotLabel(4),'頭部外傷（1/2）'); assert.strictEqual(L.slotLabel(1),'先天奇形と発育異常'); assert.strictEqual(L.slotLabel(999),'');
  const m=L.slotMap([{id:'b',d:'2025-02-01',k:3},{id:'a',d:'2025-01-01',k:3},{id:'c',d:'2025-01-01'}]); assert.strictEqual(m[3].id,'a'); assert.strictEqual(Object.keys(m).length,1);
  assert.deepStrictEqual(L.SLOTS.map(s=>s.row),Array.from({length:100},(_,i)=>L.SLOTS[i].row)); assert.ok(L.SLOTS.every(s=>s.row>=5&&s.row<=108));
});
t('countdown & pace',()=>{
  assert.strictEqual(L.daysUntil('2026-10-30','2026-10-20'),10); assert.strictEqual(L.daysUntil('2026-10-20','2026-10-20'),0); assert.strictEqual(L.daysUntil('2026-10-19','2026-10-20'),-1);
  assert.strictEqual(L.daysUntil('2027-03-01','2026-03-01'),365);
  assert.deepStrictEqual(L.paceOf(70,70),{perWeek:7,perDay:1,weeks:10}); assert.strictEqual(L.paceOf(0,10),null); assert.strictEqual(L.paceOf(10,0),null); assert.strictEqual(L.paceOf(10,-3),null);
  assert.strictEqual(L.paceOf(100,30).perWeek,23.3);
  const st=L.sanitizeSettings({exams:{base:'2027-01-31',rt:'2026-12-01'}});
  const x=L.examState(st,'base',120,'2026-10-20'); assert.strictEqual(x.days,103); assert.strictEqual(x.pace.perWeek,8.2); assert.ok(!x.past);
  assert.strictEqual(L.examState(st,'diag',1,'2026-10-20'),null);
  assert.ok(L.examState(st,'base',5,'2027-02-01').past);
  assert.deepStrictEqual(J(L.nextExam(st,'2026-10-20')),{id:'rt',date:'2026-12-01',days:42});
  assert.strictEqual(L.nextExam(st,'2027-02-01'),null);
});
t('parseAge / parseSex / scrubText',()=>{
  const a=L.parseAge; assert.strictEqual(a('45'),45); assert.strictEqual(a('45歳'),45); assert.strictEqual(a('４５才'),45); assert.strictEqual(a('45Y'),45); assert.strictEqual(a('7y'),7); assert.strictEqual(a('0'),0);
  assert.strictEqual(a('3ヶ月'),0); assert.strictEqual(a('2か月'),0); assert.strictEqual(a('45.5'),45);
  ['','abc','150','-3',null,'1985-03-04'].forEach(v=>assert.strictEqual(a(v),null,String(v)));
  const s=L.parseSex; assert.strictEqual(s('男'),'M'); assert.strictEqual(s('男性'),'M'); assert.strictEqual(s('M'),'M'); assert.strictEqual(s('Male'),'M'); assert.strictEqual(s('女'),'F'); assert.strictEqual(s('f'),'F'); assert.strictEqual(s('不明'),''); assert.strictEqual(s(''),'');
  const c=L.scrubText('山田さん 肺癌 TEL 090-1234-5678 ID123456 S60.1.5生 2020/3/4 a@b.co 右肺',80);
  assert.ok(c.changed); assert.ok(!/山田|090|123456|S60|2020|@/.test(c.text),c.text); assert.ok(/肺癌/.test(c.text)&&/右肺/.test(c.text));
  assert.deepStrictEqual(J(L.scrubText('  胸部\n正面  ',30)),{text:'胸部 正面',changed:false});
  assert.strictEqual(L.scrubText('あ'.repeat(100),10).text.length,10);
});
const GRID=[['患者ID','検査日','モダリティ','年齢','性別','部位','依頼内容','診断名','生年月日'],
 ['111','2025-04-03','CT','45','男','胸腹部','肺癌 精査','肺腺癌','1980-01-01'],
 ['112','2025-04-03','CT','45','男','胸腹部','肺癌 精査','肺腺癌','1980-01-01'],
 ['113','2025-04-04','MR','3ヶ月','女','頭部','田中様 発達遅延','','2025-01-01'],
 ['114','2025-04-05','XA','60歳','F','','','肝細胞癌',''],
 ['115','2025-04-06','RT','70','M','','','前立腺癌',''],
 ['116','令和7年4月7日','OT','1','M','','','',''],
 ['117','','CT','1','M','','','','']];
t('buildCaseImport: per-case fields, privacy, scrub, deterministic ids',()=>{
  const heads=L.headerList(GRID,0);
  assert.deepStrictEqual(heads.map(x=>x.priv),[true,false,false,false,false,false,false,false,true]);
  const g=L.guessCols(heads,null);
  assert.strictEqual(g.date,1); assert.strictEqual(g.cat,2); assert.strictEqual(g.age,3); assert.strictEqual(g.sex,4); assert.strictEqual(g.part,-1,'自由記述は自動選択しない'); assert.strictEqual(g.diag,-1);
  const cols=Object.assign({},g,{part:5,req:6,diag:7});
  const o={hdr:0,cols:cols,vals:{CT:'ct',MR:'mri',XA:'ivr_v',RT:'rt_chest',OT:'-'},from:'',to:''};
  const r=L.buildCaseImport(GRID,o);
  assert.strictEqual(r.stat.ok,5); assert.strictEqual(r.stat.skipCat,1); assert.strictEqual(r.stat.badDate,1); assert.strictEqual(r.stat.scrubbed,1);
  assert.deepStrictEqual(J(r.items[0]),{d:'2025-04-03',c:'ct',a:45,x:'M',z:'肺腺癌',p:'胸腹部',r:'肺癌 精査'});
  assert.deepStrictEqual(J(r.items[2]),{d:'2025-04-04',c:'mri',a:0,x:'F',p:'頭部',r:'発達遅延'});
  assert.deepStrictEqual(J(r.items[3]),{d:'2025-04-05',c:'ivr_v',a:60,x:'F',z:'肝細胞癌'});
  assert.deepStrictEqual(J(r.items[4]),{d:'2025-04-06',c:'rt_chest',a:70,x:'M',z:'前立腺癌'});
  assert.ok(!JSON.stringify(r.items).match(/111|1980|山田|田中/),'ID・生年月日・氏名は取り込まれない');
  const es=L.caseImportEntries(r.items,'琉大病院');
  assert.strictEqual(es.length,5); assert.strictEqual(new Set(es.map(e=>e.id)).size,5,'同内容の2行も別ID');
  es.forEach(e=>{ assert.ok(L.sanitizeEntry(e),JSON.stringify(e)); assert.ok(/^imc[A-Za-z0-9]+-[0-9a-z]+$/.test(e.id)); assert.ok(L.isImpId(e.id)); assert.strictEqual(e.s,'琉大病院'); });
  const es2=L.caseImportEntries(L.buildCaseImport(GRID,o).items,'琉大病院'); assert.deepStrictEqual(es.map(e=>e.id),es2.map(e=>e.id),'同じファイルは同じID');
  const o2=Object.assign({},o,{from:'2025-04-04'}); assert.strictEqual(L.buildCaseImport(GRID,o2).stat.ok,3);
  const noDetail=L.buildCaseImport(GRID,{hdr:0,cols:{date:1,cat:2,cat2:-1,age:-1,sex:-1,part:-1,kind:-1,req:-1,diag:-1,proc:-1,sv:-1},vals:o.vals,from:'',to:''});
  assert.deepStrictEqual(J(noDetail.items[0]),{d:'2025-04-03',c:'ct'});
  assert.ok(L.isImpId('imp1234')&&!L.isImpId('m1abc'));
});
t('makeSummary / sanitizeSummary',()=>{
  const es=[{id:'a1',d:'2025-01-05',c:'ct',n:1,k:5,a:30,x:'F'},{id:'a2',d:'2025-02-05',c:'ct',n:2},{id:'a3',d:'2025-03-05',c:'ivr_v',n:1}];
  const st=L.sanitizeSettings({range:{base:{from:'2025-02-01'}}});
  const sm=L.makeSummary(es,st);
  assert.strictEqual(sm.n,4); assert.strictEqual(sm.lastD,'2025-03-05'); assert.strictEqual(sm.inc,2,'画像診断で年齢か性別がない件数');
  assert.strictEqual(sm.tl.ct,3); assert.strictEqual(sm.tr.base.ct,2); assert.strictEqual(sm.tr.diag.ct,3); assert.strictEqual(sm.tr.base.dz,0); assert.strictEqual(sm.tl.dz,1);
  assert.deepStrictEqual(J(L.sanitizeSummary(J(sm))),J(sm));
  assert.strictEqual(L.sanitizeSummary('x'),null);
  const bad=L.sanitizeSummary({n:'a',lastD:'zz',tl:{ct:5,evil:9,dz:2,t_hp:1,t_x:3},tr:{base:{ct:-1,mri:2}}});
  assert.deepStrictEqual(J(bad.tl),{ct:5,dz:2,t_hp:1}); assert.deepStrictEqual(J(bad.tr.base),{mri:2}); assert.strictEqual(bad.n,0); assert.strictEqual(bad.lastD,'');
});
const ST=L.sanitizeSettings({facs:[{n:'琉大病院',c:'012345678'}],me:'専攻 太郎',sv:'指導 花子'});
t('buildTemplateData: B/A/IVR/RT cell maps',()=>{
  const es=[
    {id:'e2',d:'2025-04-02',c:'ct',n:1,a:60,x:'F',p:'胸部',q:'造影',r:'依頼',z:'肺癌',k:23},
    {id:'e1',d:'2025-04-01',c:'ct',n:1,a:50,x:'M'},
    {id:'e3',d:'2025-04-03',c:'mri',n:1,a:30,x:'F',z:'脳梗塞',k:6,f2:'別の指導医'},
    {id:'e4',d:'2025-04-04',c:'ct',n:3},
    {id:'v1',d:'2025-04-05',c:'ivr_n',n:1,a:70,x:'M',z:'膿瘍',h:'ドレナージ',ro:'術',o:1},
    {id:'r1',d:'2025-04-06',c:'rt_abd',n:1,a:65,x:'M',z:'前立腺癌',tx:'外部照射'},
    {id:'r2',d:'2025-04-07',c:'rt_head',n:1,z:'脳転移'}];
  const D=L.buildTemplateData(es,ST), S=D.sheets;
  // CT: e1(No.1), e2(No.2), e4×3 (No.3-5). 枠23 → CT No.2
  assert.deepStrictEqual(J(S.ct[6]),{B:'琉大病院',C:'012345678',D:L.dateSerial('2025-04-01'),E:50,F:'M',K:'専攻 太郎',L:'指導 花子'});
  assert.deepStrictEqual(J(S.ct[7]),{B:'琉大病院',C:'012345678',D:45749,E:60,F:'F',G:'胸部',H:'造影',I:'依頼',J:'肺癌',K:'専攻 太郎',L:'指導 花子'});
  assert.strictEqual(L.dateSerial('2025-04-01'),45748); assert.strictEqual(L.dateSerial('2025-04-02'),45749);
  assert.strictEqual(Object.keys(S.ct).length,5); assert.strictEqual(S.ct[10].E,undefined);
  const a23=S.a[L.SLOTS[22].row]; assert.deepStrictEqual(J(a23),{D:'琉大病院',E:'012345678',F:L.dateSerial('2025-04-02'),G:60,H:'F',I:'肺癌',J:'CT',K:2});
  const a6=S.a[L.SLOTS[5].row]; assert.strictEqual(a6.J,'MRI'); assert.strictEqual(a6.K,1); assert.strictEqual(a6.I,'脳梗塞');
  assert.strictEqual(S.mri[6].L,'別の指導医');
  assert.deepStrictEqual(J(S.ivr[6]),{B:'琉大病院',C:'012345678',D:L.dateSerial('2025-04-05'),E:70,F:'M',G:'膿瘍',H:'ドレナージ',I:'非血管系',J:'○',K:'専攻 太郎',L:'術',M:'指導 花子'});
  assert.strictEqual(S.rt[6+8].G,'前立腺癌'); assert.strictEqual(S.rt[6+8].I,'外部照射'); assert.strictEqual(S.rt[6].G,'脳転移'); assert.strictEqual(S.rt[6].H,undefined);
  const R=D.report;
  assert.strictEqual(R.slots,2); assert.strictEqual(R.counts.ct,5); assert.strictEqual(R.counts.ivr,1); assert.strictEqual(R.counts.rt,2); assert.strictEqual(R.expanded,2);
  assert.strictEqual(R.noAge,2+1+1); // e4 の3行（うち展開2行＋本体1行）… 加えて r2（年齢なし）
  const w=L.reportWarnings(R).join('\n'); assert.ok(/年齢が未入力/.test(w)); assert.ok(/展開/.test(w));
  assert.ok(!/施設名が入っていない|施設コード/.test(w));
  const D2=L.buildTemplateData([es[1]],L.sanitizeSettings({}));
  assert.ok(/施設名が入っていない/.test(L.reportWarnings(D2.report).join()));
  const D3=L.buildTemplateData([es[1]],L.sanitizeSettings({facs:[{n:'A',c:''}]}));
  assert.ok(/施設コード/.test(L.reportWarnings(D3.report).join()));
});
t('buildTemplateData: RT overflow rows, capacity keeps slot cases',()=>{
  const rt=[]; for(let i=0;i<6;i++) rt.push({id:'h'+i,d:'2025-05-0'+(i+1),c:'rt_head',n:1,z:'H'+i});
  rt.push({id:'m0',d:'2025-05-09',c:'rt_msk',n:1,z:'骨転移'});
  const S=L.buildTemplateData(rt,ST).sheets.rt;
  for(let i=0;i<4;i++) assert.strictEqual(S[6+i].G,'H'+i);
  assert.strictEqual(S[6+12].G,'骨転移'); // 骨軟部の先頭(No.13=行18)
  assert.strictEqual(S[22].G,'H4'); assert.strictEqual(S[22].H,'脳・頭頸部'); assert.strictEqual(S[23].G,'H5');
  const many=[]; for(let i=0;i<30;i++) many.push({id:'x'+String(i).padStart(3,'0'),d:'2025-01-01',c:'rn',n:1});
  many.push({id:'zz',d:'2026-01-01',c:'rn',n:1,k:9,z:'甲状腺'});
  const big=[]; for(let i=0;i<120;i++) big.push({id:'n'+String(i).padStart(4,'0'),d:'2025-01-01',c:'rn',n:1});
  big.push({id:'late',d:'2026-12-31',c:'rn',n:1,k:9,z:'甲状腺'});
  const D=L.buildTemplateData(big,ST);
  assert.strictEqual(D.report.counts.rn,100); assert.strictEqual(D.report.cut.rn,21);
  assert.ok(/核医学は様式の行数を超えた/.test(L.reportWarnings(D.report).join()));
  assert.strictEqual(D.sheets.a[L.SLOTS[8].row].K,100,'枠に使った症例は日付が新しくても残り、最後の番号になる');
  const pc=L.pickCap([{k:1},{},{},{}],2); assert.strictEqual(pc.rows.length,2); assert.strictEqual(pc.cut,2); assert.ok(pc.rows[0].k);
});
t('fillSheetXml: replaces only targeted cells, keeps style, escapes, handles self-closing/missing cells',()=>{
  const xml='<sheetData><row r="5" spans="1:3" ht="24"><c r="A5" s="80" t="s"><v>5</v></c><c r="B5" s="3"/><c r="D5" s="13"/></row><row r="6"><c r="A6"><v>1</v></c></row><row r="7" ht="3"/><row r="8"><c r="A8"/></row></sheetData>';
  const out=L.fillSheetXml(xml,{5:{B:'a<&>"b',C:'x y ',D:0,E:3.5},7:{A:'z'},9:{A:'no row'}});
  assert.ok(out.includes('<c r="A5" s="80" t="s"><v>5</v></c>'));
  assert.ok(out.includes('<c r="B5" s="3" t="inlineStr"><is><t xml:space="preserve">a&lt;&amp;&gt;&quot;b</t></is></c>'));
  assert.ok(out.includes('<c r="C5" t="inlineStr"><is><t xml:space="preserve">x y </t></is></c>'));
  assert.ok(out.includes('<c r="D5" s="13"><v>0</v></c>')); assert.ok(out.includes('<c r="E5"><v>3.5</v></c>'));
  assert.ok(out.indexOf('r="C5"')<out.indexOf('r="D5"')&&out.indexOf('r="D5"')<out.indexOf('r="E5"'),'列順');
  assert.ok(out.includes('<row r="7" ht="3"><c r="A7" t="inlineStr">'));
  assert.ok(out.includes('<row r="6"><c r="A6"><v>1</v></c></row>')&&out.includes('<row r="8"><c r="A8"/></row>'));
  assert.ok(!out.includes('no row')); assert.strictEqual(L.fillSheetXml(xml,{}),xml);
  assert.ok(L.fillSheetXml('<row r="5"><c r="B5"/></row>',{5:{B:'a\u0001b'}}).includes('>ab<'),'制御文字は除く');
});
t('CSV / backup roundtrip with new fields',()=>{
  const e={id:'a1',d:'2025-04-01',c:'ct',n:1,a:45,x:'M',p:'胸部',q:'造影',r:'=cmd',z:'肺癌',k:7,s:'病院',m:'メモ',f1:'甲',f2:'乙'};
  const row=L.entryRow(e); assert.strictEqual(row.length,L.ENTRY_HEAD.length); assert.strictEqual(row[7],"'=cmd"); assert.strictEqual(L.entryRow(e,true)[7],'=cmd');
  const csv=L.toCSV([e]); assert.ok(csv.startsWith('﻿検査日'));
  const b=L.parseBackup(JSON.stringify({app:'senmoni-case-counter',v:1,months:{'m-2025-04':{a1xx:{d:'2025-04-01',c:'ct',n:1,a:45,x:'M',k:7,z:'肺癌',c2:1}}},settings:{cohort:2024}}));
  assert.strictEqual(b.n,1); assert.strictEqual(b.months['m-2025-04'].a1xx.k,7); assert.strictEqual(b.settings.cohort,2024);
});
t('放射線治療の詳細項目: 範囲チェック・術/助は小線源のみ・治療種別の対応',()=>{
  const base={d:'2025-05-01',c:'rt_abd',n:1};
  const e=L.sanitizeEntry(Object.assign({},base,{t:'imrt',mt:'IMRT',pu:'根治',ds:'2.5',fx:'30',td:'75',d2:'2025-07',ae:' 軽度の排尿障害 ',u:'泌尿器科',p:'骨盤部',nu:'192-Ir',ro:'術'}));
  assert.deepStrictEqual(JSON.parse(JSON.stringify(e)),{d:'2025-05-01',c:'rt_abd',n:1,t:'imrt',mt:'IMRT',pu:'根治',ds:2.5,fx:30,td:75,d2:'2025-07',ae:'軽度の排尿障害',u:'泌尿器科',p:'骨盤部',nu:'192-Ir'});   // 術/助は小線源のときだけ
  const b=L.sanitizeEntry(Object.assign({},base,{t:'brachy',mt:'密封小線源治療',ro:'助',nu:'192-Ir'})); assert.strictEqual(b.ro,'助'); assert.strictEqual(b.nu,'192-Ir');
  const bad=L.sanitizeEntry(Object.assign({},base,{mt:'ナニカ',pu:'不明',ds:'0',fx:'100',td:'-1',d2:'2025-13'}));
  ['mt','pu','ds','fx','td','d2'].forEach(k=>assert.strictEqual(bad[k],undefined,k));
  assert.strictEqual(L.sanitizeEntry({d:'2025-05-01',c:'ct',n:1,pu:'根治',ds:2,u:'x',ae:'y'}).pu,undefined);          // 治療以外には付かない
  assert.strictEqual(L.numIn('2.555',0,10,2),2.56); assert.strictEqual(L.numIn('',0,10,2),null); assert.ok(L.isMonth('2025-12')&&!L.isMonth('2025-00')&&!L.isMonth('1999-01')&&!L.isMonth('2025-1'));
  assert.deepStrictEqual(L.RT_KINDS.filter(k=>k.id).map(k=>[k.id,k.t]).slice(0,3),[['3dcrt',''],['imrt','imrt'],['srt_h','srt']]);
  assert.strictEqual(L.rtKindId({t:'imrt',mt:'IMRT'}),'imrt'); assert.strictEqual(L.rtKindId({t:'srt',mt:'体幹部定位放射線照射'}),'srt_b'); assert.strictEqual(L.rtKindId({t:'srt'}),'srt');
  assert.strictEqual(L.rtKindId({t:'imrt'}),'imrt'); assert.strictEqual(L.rtKindId({mt:'3DCRT'}),'3dcrt'); assert.strictEqual(L.rtKindId({}),''); assert.strictEqual(L.rtKindId({t:'hp'}),'hp');
  assert.strictEqual(L.rtKindId({t:'special',mt:'粒子線治療'}),'particle'); assert.strictEqual(L.rtKindId({t:'special'}),'special');
  const st=L.sanitizeSettings({facs:[{n:'A病院',c:'123456789',k:'総-12'},{n:'B病院',c:'x',k:'  '},{n:'C',k:'総－１２'}]});
  assert.deepStrictEqual(JSON.parse(JSON.stringify(st.facs)),[{n:'A病院',c:'123456789',k:'総-12'},{n:'B病院',c:''},{n:'C',c:'',k:'総-12'}]);   // 全角はNFKCで半角に
  const row=L.entryRow(Object.assign({id:'x'},e)); assert.strictEqual(row.length,L.ENTRY_HEAD.length); assert.strictEqual(row[L.ENTRY_HEAD.indexOf('1回線量(Gy)')],2.5); assert.strictEqual(row[L.ENTRY_HEAD.indexOf('治療種別')],'IMRT');
});
t('extendSheetXml: 行を足す（最後の行の複製・番号・後ろの行のずらし・結合セル・範囲）',()=>{
  const row=(r,a,extra,s)=>'<row r="'+r+'" spans="1:3"><c r="A'+r+'" s="'+s+'"><v>'+a+'</v></c><c r="B'+r+'" s="7" t="s"><v>5</v></c><c r="C'+r+'" s="8"/>'+(extra||'')+'</row>';
  const xml='<worksheet><dimension ref="A1:C9"/><sheetData><row r="5"><c r="A5" t="s"><v>0</v></c></row>'+row(6,1,'',63)+row(7,2,'',63)+row(8,3,'',51)+'<row r="9"><c r="A9" t="s"><v>9</v></c></row></sheetData><mergeCells count="2"><mergeCell ref="A1:C2"/><mergeCell ref="A9:C9"/></mergeCells></worksheet>';
  assert.strictEqual(L.lastNumRow(xml),8);
  assert.strictEqual(L.extendSheetXml(xml,8).added,0); assert.strictEqual(L.extendSheetXml(xml,8).xml,xml); assert.strictEqual(L.extendSheetXml(xml,3).added,0);
  const r=L.extendSheetXml(xml,11); assert.strictEqual(r.added,3);
  const x=r.xml, rows=[...x.matchAll(/<row r="(\d+)"/g)].map(m=>Number(m[1]));
  assert.deepStrictEqual(rows,[5,6,7,8,9,10,11,12]);                          // 8行目の後ろに3行、注記の行(9)は12へ
  assert.ok(/<row r="12"[^>]*><c r="A12" t="s"><v>9<\/v>/.test(x));
  assert.ok(/<row r="8"[^>]*><c r="A8" s="63"><v>3<\/v>/.test(x),'元の最終行は途中の行の書式になる');
  assert.ok(/<row r="11"[^>]*><c r="A11" s="51"><v>6<\/v><\/c><c r="B11" s="7" t="s">/.test(x),'新しい最終行は元の最終行の書式・番号は続き');
  assert.ok(/<row r="9"[^>]*><c r="A9" s="63"><v>4<\/v>/.test(x));
  assert.ok(x.includes('<mergeCell ref="A12:C12"/>')&&x.includes('<mergeCell ref="A1:C2"/>')&&x.includes('<dimension ref="A1:C12"/>'));
  assert.strictEqual(L.extendSheetXml('<worksheet><sheetData><row r="5"/></sheetData></worksheet>',20).added,0);   // 番号つきの行がなければ何もしない
});
t('buildDiagData: 列の対応・件数の展開・行の追加見込み',()=>{
  const st=L.sanitizeSettings({me:'自分',sv:'指導医',facs:[{n:'A病院',c:'123456789',k:'総-12'},{n:'B病院'}]});
  const es=[
    {id:'a',d:'2025-03-02',c:'ct',n:1,a:50,x:'F',p:'胸腹部',q:'造影',r:'精査',z:'肝癌',s:'A病院'},
    {id:'b',d:'2025-03-01',c:'ct',n:2,s:'B病院'},
    {id:'c',d:'2025-03-03',c:'ivr_n',n:1,a:70,x:'M',z:'胆管炎',h:'PTCD',ro:'助',o:1,f1:'術者A',f2:'確認B'},
    {id:'d',d:'2025-03-04',c:'rt_head',n:1}];
  const D=L.buildDiagData(es.map(e=>Object.assign({},e,L.sanitizeEntry(e))),st);
  assert.deepStrictEqual(D.sheets.ct[6],{B:'B病院',C:'20250301',D:undefined,E:undefined,F:undefined,G:undefined,H:undefined,I:undefined,J:'自分',K:'指導医'});     // 日付の古い順。施設番号が無ければ施設名
  assert.deepStrictEqual(D.sheets.ct[8],{B:'総-12',C:'20250302',D:50,E:'F',F:'胸腹部',G:'造影',H:'精査',I:'肝癌',J:'自分',K:'指導医'});
  assert.deepStrictEqual(D.sheets.ivr[6],{B:'総-12',C:'20250303',D:70,E:'M',F:'胆管炎',G:'PTCD',H:'非血管系',I:'○',J:'術者A',K:'助',L:'確認B'});
  assert.strictEqual(D.report.counts.ct,3); assert.strictEqual(D.need.ct,8); assert.strictEqual(D.report.expanded,1); assert.strictEqual(D.report.noNo,2); assert.deepStrictEqual(D.report.added,{});
  assert.strictEqual(D.sheets.rt,undefined);                                  // 治療の記録は診断の手帳に出さない
  const many=[]; for(let i=0;i<620;i++) many.push({id:'m'+i,d:'2025-01-01',c:'ct',n:1}); for(let i=0;i<34;i++) many.push({id:'v'+i,d:'2025-01-01',c:'ivr_v',n:1});
  const M=L.buildDiagData(many,st); assert.deepStrictEqual(M.report.added,{ct:17,ivr:1}); assert.ok(/CTは様式の行数を超えた[\s\S]*17 行/.test(L.reportWarnings(M.report).join('\n')));
});
t('buildRtData: 部位別と技術別の列・重複・上限',()=>{
  const st=L.sanitizeSettings({me:'自分',sv:'指導医',facs:[{n:'A病院',k:'総-12'}]});
  let seq=0; const mk=o=>Object.assign({id:'r'+String(++seq).padStart(4,'0')},L.sanitizeEntry(Object.assign({d:'2025-04-05',n:1,a:60,x:'M',z:'前立腺癌',u:'泌尿器科',p:'骨盤部',pu:'根治',ds:2,fx:30,d2:'2025-06',ae:'軽度の排尿障害',s:'A病院'},o)));
  const es=[mk({c:'rt_abd',t:'imrt',mt:'IMRT'}),mk({c:'rt_chest',t:'brachy',mt:'密封小線源治療',nu:'192-Ir',ro:'助',ds:6,fx:4,td:24,z:'子宮頸癌'}),mk({c:'rt_msk',t:'special',tx:'全身照射',z:'白血病'}),mk({c:'rt_head',t:'hp'}),mk({c:'rt_abd',z:'肝癌',ds:null,fx:null,pu:undefined}),{id:'x',d:'2025-04-05',c:'ct',n:1}];
  const R=L.buildRtData(es,st), S=R.sheets;
  assert.deepStrictEqual(S.abd[7],{B:'総-12',C:60,D:'M',E:'泌尿器科',F:'前立腺癌',G:'骨盤部',H:'IMRT',I:'根治',J:'2 Gy',K:'30回',L:'60 Gy',M:L.dateSerial('2025-04-05'),N:L.dateSerial('2025-06-01'),O:'軽度の排尿障害',P:'自分',Q:'',S:'指導医'});
  assert.deepStrictEqual(S.chest[7],{B:'総-12',C:60,D:'M',E:'泌尿器科',F:'子宮頸癌',G:'骨盤部',H:'密封小線源治療',I:'根治',J:'6 Gy',K:'4回',L:'24 Gy',M:L.dateSerial('2025-04-05'),N:L.dateSerial('2025-06-01'),O:'軽度の排尿障害',P:'自分',Q:'（助）',S:'指導医'});
  assert.deepStrictEqual(S.brachy[7],{B:'総-12',C:60,D:'M',E:'泌尿器科',F:'子宮頸癌',G:'骨盤部',H:'根治',I:'192-Ir',J:'4回',K:'24 Gy',L:L.dateSerial('2025-04-05'),M:'軽度の排尿障害',N:'自分',O:'（助）',Q:'指導医'});
  assert.deepStrictEqual(S.imrt[6],{B:'総-12',C:60,D:'M',E:'泌尿器科',F:'前立腺癌',G:'骨盤部',H:'根治',I:'30回',J:'60 Gy',K:L.dateSerial('2025-04-05'),L:L.dateSerial('2025-06-01'),M:'軽度の排尿障害',N:'自分',Q:'指導医'});
  assert.strictEqual(S.special[6].G,'全身照射'); assert.strictEqual(S.msk[7].H,'全身照射');                    // 治療法が種別欄にも入る
  assert.strictEqual(S.srt[6],undefined); assert.strictEqual(Object.keys(S.imrt).length,1);
  assert.strictEqual(R.report.hpSkipped,1); assert.strictEqual(R.report.noDetail,1); assert.strictEqual(R.report.total,5); assert.strictEqual(R.report.noNo,0);
  assert.deepStrictEqual(R.report.counts,{head:1,chest:1,abd:2,msk:1,brachy:1,imrt:1,srt:0,special:1});
  assert.ok(R.sheets.ct===undefined);
  const w=L.reportWarnings(R.report).join('\n'); assert.ok(/高精度（強度変調・定位の区別なし）」の記録 1 件/.test(w)); assert.ok(/目的・照射回数が未入力の症例が 1 件/.test(w));
  const noMe=L.buildRtData([mk({c:'rt_abd'})],L.sanitizeSettings({})); assert.strictEqual(noMe.report.noMe,1); assert.ok(/初期治療医[\s\S]*小計/.test(L.reportWarnings(noMe.report).join()));
  const many=[]; for(let i=0;i<40;i++) many.push(mk({c:'rt_abd',t:'imrt'})); const M=L.buildRtData(many,st);
  assert.strictEqual(M.report.cut.imrt,7); assert.strictEqual(Object.keys(M.sheets.imrt).length,33); assert.strictEqual(M.report.counts.abd,40);
});
(async()=>{
  const JSZip=require('jszip');
  await new Promise(r=>setTimeout(r,0));
  if(!TPL_BYTES){ console.log('skip 様式ファイルを使う試験（TPL_XLSX で学会配布の様式を指定してください）'); console.log('\n'+n+' passed'); return; }
  const rej=async(name,mk,re)=>{
    try{ await L.openTemplate(JSZip,await mk()); throw new Error('エラーになるはずが通った'); }
    catch(e){ if(/エラーになるはず/.test(e.message)) throw e; assert.match(e.message,re); }
  };
  const mod=async fn=>{ const z=await JSZip.loadAsync(TPL_BYTES); await fn(z); return z.generateAsync({type:'uint8array'}); };
  const as=async(name,fn)=>{ try{ await fn(); n++; console.log('ok  ',name); }catch(e){ console.log('FAIL',name,'\n   ',e.stack.split('\n').slice(0,5).join('\n    ')); process.exitCode=1; } };
  await as('openTemplate: the real template opens (Uint8Array / ArrayBuffer / base64)',async()=>{
    const t=await L.openTemplate(JSZip,TPL_BYTES); assert.deepStrictEqual(Object.keys(t.files).sort(),Object.keys(L.TPL_SHEETS).sort());
    await L.openTemplate(JSZip,new Uint8Array(TPL_BYTES).buffer);
    await L.openTemplate(JSZip,Buffer.from(TPL_BYTES).toString('base64'));
  });
  await as('openTemplate: rejects empty / garbage / a different workbook / renamed sheet / changed slot names',async()=>{
    await rej('none',()=>null,/選ばれていません/);
    await rej('empty',()=>'',/選ばれていません/);
    await rej('garbage',()=>Buffer.from('hello'),/Excel（\.xlsx）ファイルとして読み込めませんでした/);
    await rej('zip without workbook',async()=>{ const z=new JSZip(); z.file('a.txt','x'); return z.generateAsync({type:'uint8array'}); },/Excel（\.xlsx）ファイルとして読めませんでした/);
    await rej('renamed sheet',()=>mod(async z=>{ z.file('xl/workbook.xml',(await z.file('xl/workbook.xml').async('string')).replace('形成評価（Ⅳ.経験B.CT）','別の名前')); }),/シート「形成評価（Ⅳ\.経験B\.CT）」が見つかりません/);
    await rej('changed group name',()=>mod(async z=>{ z.file('xl/sharedStrings.xml',(await z.file('xl/sharedStrings.xml').async('string')).split('尿路結石症').join('尿路結石')); }),/様式の内容が想定と違います/);
    await rej('too few rows',()=>mod(async z=>{ const names=Object.keys(z.files).filter(k=>/xl\/worksheets\/sheet\d+\.xml$/.test(k)); for(const k of names){ const x=await z.file(k).async('string'); if(/<row r="1205"/.test(x)) z.file(k,x.replace(/<row r="1205"[\s\S]*?<\/row>/,'')); } }),/行数が想定/);
  });
  await as('buildTemplateXlsx: needs a template; writes entries into it',async()=>{
    const es=[]; const mods=['xray','gi','us','ct','mri','rn'];
    mods.forEach((m,i)=>{ for(let k=0;k<3;k++) es.push({id:'q'+m+k,d:'2025-0'+(i+1)+'-1'+k,c:m,n:1,a:20+i*10+k,x:k%2?'F':'M',p:'部位'+i,q:'単純',r:'依頼<'+k+'>',z:'診断&'+k,k:i*3+k+1}); });
    es.push({id:'iv',d:'2025-07-01',c:'ivr_v',n:1,a:70,x:'M',z:'肝癌',h:'TACE',ro:'術'});
    ['rt_head','rt_chest','rt_abd','rt_msk'].forEach((c,i)=>es.push({id:'rt'+i,d:'2025-08-0'+(i+1),c:c,n:1,a:60,x:'F',z:'疾患'+i,tx:'外部照射'}));
    let threw=false; try{ await L.buildTemplateXlsx(JSZip,es,ST); }catch(e){ threw=/選ばれていません/.test(e.message); }
    assert.ok(threw,'様式なしでは作れない（埋め込みの様式は無い）');
    const r=await L.buildTemplateXlsx(JSZip,es,ST,TPL_BYTES);
    fs.writeFileSync(path.join(OUT,'out-test.xlsx'),Buffer.from(r.bytes));
    fs.writeFileSync(path.join(OUT,'out-test.json'),JSON.stringify(es));
    assert.strictEqual(r.report.slots,18); assert.ok(r.bytes.length>100000);
    // 元の様式は書き換えていない（同じバイト列から何度でも作れる）
    const r2=await L.buildTemplateXlsx(JSZip,es,ST,TPL_BYTES); assert.strictEqual(r2.bytes.length,r.bytes.length);
  });
  const asNb=async(name,bytes,fn)=>{ if(!bytes){ console.log('skip',name,'（TPL_DIAG / TPL_RT が無い）'); return; } await as(name,()=>fn(bytes)); };
  const XLSX=require('xlsx');
  const cells=(bytes,sheet)=>{ const wb=XLSX.read(bytes,{cellDates:false,cellNF:true}); const key=wb.SheetNames.find(n=>n.replace(/\s/g,'')===sheet.replace(/\s/g,'')); assert.ok(key,'sheet '+sheet); return wb.Sheets[key]; };
  const v=(ws,a)=>ws[a]&&ws[a].v;
  await as('openTemplate: 3種類の様式を自動で判別する（基本領域の様式 → base）',async()=>{ assert.strictEqual((await L.openTemplate(JSZip,TPL_BYTES)).kind,'base'); });
  await asNb('openTemplate: 診断専門医の専攻医研修手帳 → diag',DIAG_BYTES,async b=>{
    const t=await L.openTemplate(JSZip,b); assert.strictEqual(t.kind,'diag'); assert.deepStrictEqual(Object.keys(t.files).sort(),Object.keys(L.NB.diag.sheets).sort());
    for(const k of Object.keys(L.NB.diag.sheets)) assert.strictEqual(L.lastNumRow(t.xml[k])-L.NB.diag.first+1,L.NB.diag.sheets[k].cap,k+' の様式の行数');
  });
  await asNb('openTemplate: 治療専門医の専攻医研修手帳 → rt',RT_BYTES,async b=>{
    const t=await L.openTemplate(JSZip,b); assert.strictEqual(t.kind,'rt'); assert.deepStrictEqual(Object.keys(t.files).sort(),Object.keys(L.NB.rt.sheets).sort());
    for(const k of Object.keys(L.NB.rt.sheets)){ const S=L.NB.rt.sheets[k]; assert.strictEqual(L.lastNumRow(t.xml[k])-S.first+1,S.cap,k+' の様式の行数'); }
  });
  await asNb('openTemplate(診断・治療): 名前を変えたシート・版の違いは受け付けない',DIAG_BYTES,async b=>{
    const m=async(bytes,fn)=>{ const z=await JSZip.loadAsync(bytes); await fn(z); return z.generateAsync({type:'uint8array'}); };
    await rej('diag renamed sheet',()=>m(b,async z=>{ z.file('xl/workbook.xml',(await z.file('xl/workbook.xml').async('string')).replace('形成評価（Ⅳ.経験B.CT）','別の名前')); }),/シート「形成評価（Ⅳ\.経験B\.CT）」が見つかりません/);
    await rej('diag changed header',()=>m(b,async z=>{ z.file('xl/sharedStrings.xml',(await z.file('xl/sharedStrings.xml').async('string')).split('研修指導医確認').join('指導医')); }),/様式の内容が想定と違います/);
    if(RT_BYTES) await rej('rt changed header',()=>m(RT_BYTES,async z=>{ z.file('xl/sharedStrings.xml',(await z.file('xl/sharedStrings.xml').async('string')).split('初期治療医').join('治療医')); }),/様式の内容が想定と違います/);
    let threw=false; try{ await L.buildTemplateXlsx(JSZip,[{id:'q',d:'2025-01-01',c:'ct',n:1}],ST,b,'rt'); }catch(e){ threw=/「診断専門医」の様式です/.test(e.message); }
    assert.ok(threw,'種類が違う様式は、はっきり断る');
  });
  await asNb('buildTemplateXlsx(診断): 書き込み・CTは行を追加・IVRの注記は下へ・他のシートは変わらない',DIAG_BYTES,async b=>{
    const st=L.sanitizeSettings({me:'自分',sv:'指導医',facs:[{n:'A病院',k:'総-12'}]}), es=[];
    for(let i=0;i<610;i++) es.push({id:'c'+i,d:'2025-03-'+String(1+i%28).padStart(2,'0'),c:'ct',n:1,a:30+i%40,x:i%2?'F':'M',p:'胸腹部',q:'造影',r:'依頼<'+i+'>&',z:'診断'+i,s:'A病院'});
    for(let i=0;i<35;i++) es.push({id:'v'+i,d:'2025-04-01',c:i<20?'ivr_v':'ivr_n',n:1,a:60,x:'M',z:'肝癌',h:'TACE',ro:'術',o:i===0?1:0});
    es.push({id:'g',d:'2025-02-01',c:'gi',n:1,a:40,x:'M'});
    const r=await L.buildTemplateXlsx(JSZip,es,st,b);
    assert.strictEqual(r.kind,'diag'); assert.deepStrictEqual(r.report.added,{ct:7,ivr:2}); assert.strictEqual(r.report.counts.ct,610);
    const ct=cells(r.bytes,'形成評価（Ⅳ.経験B.CT）');
    assert.strictEqual(v(ct,'A6'),1); assert.strictEqual(v(ct,'B6'),'総-12'); assert.strictEqual(v(ct,'C6'),'20250301'); assert.strictEqual(v(ct,'J6'),'自分'); assert.strictEqual(v(ct,'K6'),'指導医');
    assert.strictEqual(v(ct,'A615'),610); assert.ok(/依頼<\d+>&/.test(v(ct,'H615'))); assert.strictEqual(v(ct,'A616'),undefined); assert.strictEqual(v(ct,'A5'),'例');
    assert.strictEqual(ct['!ref'],'A1:K615');
    const ivr=cells(r.bytes,'形成評価（Ⅳ.経験 C.IVR）');
    assert.strictEqual(v(ivr,'H6'),'血管系'); assert.strictEqual(v(ivr,'H25'),'非血管系'); assert.strictEqual(v(ivr,'I6'),'○'); assert.strictEqual(v(ivr,'K6'),'術');
    assert.strictEqual(v(ivr,'A40'),35); assert.ok(/^IVRについては/.test(v(ivr,'A41')),'注記の行は2行下へ'); assert.strictEqual(v(ivr,'A39'),34);
    assert.strictEqual(v(cells(r.bytes,'形成評価（Ⅳ.経験B.消化管）'),'D6'),40);
    // 触っていないシート（表紙・総括）は元のまま
    const z0=await JSZip.loadAsync(b), z1=await JSZip.loadAsync(r.bytes);
    for(const f of ['xl/worksheets/sheet1.xml','xl/worksheets/sheet23.xml','xl/sharedStrings.xml','xl/styles.xml']) assert.strictEqual(await z1.file(f).async('string'),await z0.file(f).async('string'),f);
    assert.ok(/<calcPr [^>]*fullCalcOnLoad="1"/.test(await z1.file('xl/workbook.xml').async('string')),'開いたときに数式を計算し直す');
    const r2=await L.buildTemplateXlsx(JSZip,es,st,b); assert.strictEqual(r2.bytes.length,r.bytes.length);     // 元の様式は書き換えていない
  });
  await asNb('buildTemplateXlsx(治療): 部位別と技術別に書き込む・数式の小計・保護や入力規則は残る',RT_BYTES,async b=>{
    const st=L.sanitizeSettings({me:'自分',sv:'指導医',facs:[{n:'A病院',k:'総-12'}]});
    const mk=o=>L.sanitizeEntry(Object.assign({d:'2025-04-05',n:1,a:60,x:'M',z:'前立腺癌',u:'泌尿器科',p:'骨盤部',pu:'根治',ds:2,fx:30,d2:'2025-06',ae:'軽度の排尿障害',s:'A病院'},o));
    const es=[mk({c:'rt_abd',t:'imrt',mt:'IMRT'}),mk({c:'rt_chest',t:'brachy',mt:'密封小線源治療',nu:'192-Ir',ro:'助',ds:6,fx:4,z:'子宮頸癌'}),mk({c:'rt_head',t:'srt',mt:'頭部定位放射線照射',fx:1,ds:24,p:'頭部'}),mk({c:'rt_msk',t:'special',tx:'全身照射'})].map((e,i)=>Object.assign({id:'t'+i},e));
    const r=await L.buildTemplateXlsx(JSZip,es,st,b);
    assert.strictEqual(r.kind,'rt'); assert.deepStrictEqual(r.report.counts,{head:1,chest:1,abd:1,msk:1,brachy:1,imrt:1,srt:1,special:1});
    const abd=cells(r.bytes,'☆形成評価（Ⅳ.経験症例 A.部位-腹部 骨盤部）');
    assert.strictEqual(v(abd,'B7'),'総-12'); assert.strictEqual(v(abd,'H7'),'IMRT'); assert.strictEqual(v(abd,'J7'),'2 Gy'); assert.strictEqual(v(abd,'K7'),'30回'); assert.strictEqual(v(abd,'L7'),'60 Gy'); assert.strictEqual(v(abd,'P7'),'自分'); assert.strictEqual(v(abd,'S7'),'指導医');
    assert.strictEqual(abd.M7.v,L.dateSerial('2025-04-05')); assert.strictEqual(abd.M7.z,'yyyy/m'); assert.strictEqual(abd.N7.v,L.dateSerial('2025-06-01')); assert.strictEqual(v(abd,'A156'),150);
    assert.ok(/COUNTA\(P7:P156\)/.test(abd.S157.f),'小計の数式は残る');
    const bra=cells(r.bytes,'☆形成評価（Ⅳ.治療技術 B.技術-密封小線源）'); assert.strictEqual(v(bra,'I7'),'192-Ir'); assert.strictEqual(v(bra,'O7'),'（助）'); assert.strictEqual(v(bra,'K7'),'24 Gy'); assert.strictEqual(v(bra,'J7'),'4回'); assert.strictEqual(v(bra,'N7'),'自分');
    const srt=cells(r.bytes,'☆形成評価（Ⅳ.治療技術 B.技術-高精度治療-定位放射線照射'); assert.strictEqual(v(srt,'G6'),'頭部'); assert.strictEqual(v(srt,'J6'),'24 Gy');
    const sp=cells(r.bytes,'☆形成評価（Ⅳ.治療技術 B.技術-特殊治療）'); assert.strictEqual(v(sp,'G6'),'全身照射');
    const z0=await JSZip.loadAsync(b), z1=await JSZip.loadAsync(r.bytes);
    for(const f of Object.keys(z0.files).filter(f=>/sheet(14|25)\.xml$/.test(f)||/sharedStrings|styles/.test(f))) assert.strictEqual(await z1.file(f).async('string'),await z0.file(f).async('string'),f);   // 連動研修分などは触らない
    const x1=await z1.file('xl/worksheets/sheet10.xml').async('string'); assert.ok(/<sheetProtection [^>]*sheet="1"/.test(x1)&&/<dataValidations count="5">/.test(x1),'保護・入力規則は元のまま');
  });
  console.log('\n'+n+' passed');
})();
