import { chromium } from 'playwright';
const id = process.argv[2];
const b = await chromium.launch(); const page = await b.newPage({ viewport: { width: 1360, height: 860 } });
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.goto('http://localhost:4999/'); await page.waitForFunction(() => /NAS/.test(document.querySelector('#sync')?.textContent || ''));
for (const t of ['Call the vet', 'Order resin samples', 'Fence inspection', 'Book the tour']) { await page.fill('#qa', t + ' today'); await page.keyboard.press('Escape'); await page.focus('#qa'); await page.press('#qa', 'Enter'); await page.waitForTimeout(200); }
await page.evaluate(id => CadenceThemes.apply(id), id); await page.waitForTimeout(900);
const open = () => page.locator('.task:not(.td-b):not(.done)').filter({ visible: true });
await open().first().locator('.check').click(); await page.waitForTimeout(600);
await open().first().hover(); await page.waitForTimeout(150);
await page.screenshot({ path: `.scratch/up-${id}.png` });
console.log('errors', errs); await b.close();
