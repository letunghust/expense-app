// End-to-end check of the web/iPhone build with an iPhone viewport.
// usage: node pwa-test.mjs URL chromium|webkit OUTDIR [IMAGE]
// Copy next to a node_modules that has playwright (see SKILL.md).
import { chromium, devices, webkit } from 'playwright';

const [url, engine = 'chromium', out = '.', image] = process.argv.slice(2);
const browser = engine === 'webkit' ? await webkit.launch() : await chromium.launch({ channel: 'chrome' });
const ctx = await browser.newContext({ ...devices['iPhone 13'] });
const page = await ctx.newPage();
const logs = [];
page.on('console', (m) => ['error', 'warning'].includes(m.type()) && logs.push(`${m.type()}: ${m.text()}`));
page.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
page.on('dialog', (d) => {
  logs.push(`dialog: ${d.message()}`);
  d.accept();
});
const home = () => page.getByText('Tổng quan').first().waitFor({ timeout: 30000 });
async function fail(step, error) {
  await page.screenshot({ path: `${out}/${engine}-fail.png` }).catch(() => {});
  console.log(`FAIL at ${step} (${page.url()}): ${error.message.split('\n')[0]}\n  ${logs.join('\n  ')}`);
  await browser.close();
  process.exit(1);
}

try {
  await page.goto(url);
  await home();
} catch (e) {
  await fail('first load', e);
}
console.log('crossOriginIsolated:', await page.evaluate(() => crossOriginIsolated));
await page.evaluate(() => navigator.serviceWorker.ready);
await page.reload();
await home();
console.log('service worker controls page:', await page.evaluate(() => Boolean(navigator.serviceWorker.controller)));
await page.screenshot({ path: `${out}/${engine}-home.png` });

if (image) {
  try {
    const chooser = page.waitForEvent('filechooser');
    await page.getByLabel('Quét ảnh chuyển khoản').click();
    await (await chooser).setFiles(image);
    await page.getByText(/Đã tự điền|Không đọc được|Chưa tìm thấy/).first().waitFor({ timeout: 180000 });
    await page.screenshot({ path: `${out}/${engine}-scan.png` });
    const values = await page.locator('input').evaluateAll((els) => els.map((e) => e.value));
    console.log('scan:', values.filter(Boolean).join(' | '));
    await page.getByText('Khác', { exact: true }).first().click();
    await page.getByText('Lưu giao dịch').click();
    await home();
    console.log('saved');
  } catch (e) {
    await fail('scan', e);
  }
}

// Offline: the whole app must open from the service worker cache.
await ctx.setOffline(true);
try {
  await page.reload();
  await home();
  console.log('offline reload ok, isolated:', await page.evaluate(() => crossOriginIsolated));
  for (const [tab, expect] of [['Giao dịch', 'Giao dịch'], ['Ngân sách', 'Ngân sách'], ['Cài đặt', 'Sao lưu toàn bộ dữ liệu']]) {
    await page.getByRole('tab', { name: tab }).click();
    await page.getByText(expect).last().waitFor({ timeout: 15000 });
    console.log('offline tab ok:', tab);
  }
  await page.goto(new URL('/transaction/new', url).href);
  await page.getByText('Lưu giao dịch').waitFor({ timeout: 15000 });
  console.log('offline add form ok');
} catch (e) {
  await fail('offline', e);
}
console.log('logs:', logs.length ? '\n  ' + logs.join('\n  ') : 'none');
await browser.close();
