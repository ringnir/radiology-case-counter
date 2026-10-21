// tools/diagrams/diagrams.html の各図を、docs/images/gas-*.png に書き出す（node tools/render-diagrams.js）
const path = require('path'), fs = require('fs');
const { chromium } = require('playwright-core');
(async () => {
  const out = path.join(__dirname, '..', 'docs', 'images'); fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 1100, height: 900 }, deviceScaleFactor: 1.5 });
  await p.goto('file://' + path.join(__dirname, 'diagrams', 'diagrams.html'));
  for (const id of await p.$$eval('section.fig', els => els.map(e => e.id))) {
    await p.locator('#' + id).screenshot({ path: path.join(out, id + '.png') }); console.log('ok  ', id);
  }
  await b.close();
})();
